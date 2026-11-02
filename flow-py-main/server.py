"""
Google Flow AI (Veo 3.1) Local Server for ToolMedia (Port 8100).

Replaces the old gemini-web-api server completely with flow-py-main.
Provides HTTP endpoints for:
  - GET  /health                        -> Server, Auth, Project & Credits status
  - POST /v1/auth/login                 -> Opens headed Chrome window to sign in to Google Flow
  - POST /v1/auth/project               -> Set or auto-discover active Flow Project ID
  - POST /v1/videos/generations         -> Submit Text-to-Video or Image-to-Video (Veo 3.1)
  - GET  /v1/videos/generations/{job_id}-> Poll job progress & download URL
  - POST /v1/videos/upscale             -> Free 1080p upscale (0 credits)
  - GET  /files/{filename}              -> Serve generated .mp4 files
"""
from __future__ import annotations
import sys
import os
if sys.stdout is None:
    sys.stdout = open(os.devnull, 'w', encoding='utf-8')
if sys.stderr is None:
    sys.stderr = open(os.devnull, 'w', encoding='utf-8')

import asyncio
import base64
import json
import logging
import os
import random
import re
import time
import uuid
from pathlib import Path
from typing import Any, Optional

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from pydantic import BaseModel

from flow._api import (
    FlowAPI,
    FLOW_BASE,
    VIDEO_AR_LANDSCAPE,
    VIDEO_AR_PORTRAIT,
    VIDEO_MODEL_VEO31_FAST,
    VIDEO_MODEL_VEO31_FAST_P,
    VIDEO_MODEL_VEO31_I2V,
    VIDEO_MODEL_VEO31_I2V_P,
)
from flow._browser import BrowserManager, FLOW_BASE_URL
from flow._client import FlowClient
from flow._storage import (
    add_project,
    ensure_dirs,
    get_active_project,
    load_config,
    set_active_project,
    STORAGE_ROOT,
    PROFILE_DIR,
)

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
log = logging.getLogger("flow.server")

app = FastAPI(title="Google Flow AI (Veo 3.1) Server", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.middleware("http")
async def add_private_network_access_headers(request, call_next):
    # Support Chrome Private Network Access (HTTPS https://vip-imagetools.vercel.app -> HTTP localhost:8100)
    if request.method == "OPTIONS" and request.headers.get("access-control-request-private-network") == "true":
        from fastapi.responses import Response
        resp = Response(status_code=204)
        resp.headers["Access-Control-Allow-Origin"] = request.headers.get("origin", "*")
        resp.headers["Access-Control-Allow-Methods"] = "GET, POST, PUT, DELETE, OPTIONS"
        resp.headers["Access-Control-Allow-Headers"] = "*"
        resp.headers["Access-Control-Allow-Private-Network"] = "true"
        resp.headers["Access-Control-Allow-Credentials"] = "true"
        return resp

    response = await call_next(request)
    response.headers["Access-Control-Allow-Private-Network"] = "true"
    return response

# Directories for storing temporary input images and downloaded output videos
OUTPUT_DIR = STORAGE_ROOT / "outputs"
TEMP_INPUT_DIR = STORAGE_ROOT / "inputs"
ACCOUNTS_POOL_FILE = STORAGE_ROOT / "accounts_pool.json"

# Migrate old pool file if exists in package root and not yet in STORAGE_ROOT
_legacy_pool = Path(__file__).parent / "accounts_pool.json"
if _legacy_pool.exists() and not ACCOUNTS_POOL_FILE.exists():
    try:
        import shutil
        shutil.copy2(_legacy_pool, ACCOUNTS_POOL_FILE)
    except Exception:
        pass

try:
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    TEMP_INPUT_DIR.mkdir(parents=True, exist_ok=True)
except Exception as _mk_err:
    log.warning("Could not create directories in STORAGE_ROOT: %s", _mk_err)

_pool_rotation_idx: int = 0


def _load_accounts_pool() -> list[dict[str, Any]]:
    if not ACCOUNTS_POOL_FILE.exists():
        return []
    try:
        data = json.loads(ACCOUNTS_POOL_FILE.read_text(encoding="utf-8"))
        if isinstance(data, list):
            return data
    except Exception as e:
        log.warning("Could not load accounts_pool.json: %s", e)
    return []


def _save_accounts_pool(pool: list[dict[str, Any]]) -> None:
    try:
        ACCOUNTS_POOL_FILE.write_text(json.dumps(pool, ensure_ascii=False, indent=2), encoding="utf-8")
    except Exception as e:
        log.warning("Could not save accounts_pool.json: %s", e)


def _flag_pool_account_error(acc_id: str, error_msg: str) -> None:
    """Mark an account in the pool as errored / disabled so jobs won't keep failing on it."""
    try:
        pool = _load_accounts_pool()
        changed = False
        for a in pool:
            if a.get("id") == acc_id:
                a["enabled"] = False
                a["error"] = error_msg
                changed = True
        if changed:
            _save_accounts_pool(pool)
    except Exception as e:
        log.warning("Could not flag pool account error: %s", e)


def _get_next_pool_account() -> Optional[dict[str, Any]]:
    global _pool_rotation_idx
    pool = [a for a in _load_accounts_pool() if a.get("enabled", True) and not a.get("error")]
    if not pool:
        return None
    acc = pool[_pool_rotation_idx % len(pool)]
    _pool_rotation_idx = (_pool_rotation_idx + 1) % len(pool)
    return acc

# ── Shared Browser Session & Job State ────────────────────────────────────────

_browser_lock = asyncio.Lock()
_bm: Optional[BrowserManager] = None
_client: Optional[FlowClient] = None
_login_in_progress: bool = False
_ext_reload_done: bool = False

# Cached auth/account state for fast /health responses
_auth_state: dict[str, Any] = {
    "authenticated": False,
    "email": None,
    "project_id": None,
    "credits": None,
    "tier": None,
    "last_checked": 0.0,
    "error": None,
}

# Shared Bearer token cache across all FlowAPI instances
_shared_bearer_token: str = ""
_shared_bearer_ts: float = 0.0

# In-memory job store: job_id -> dict
_jobs: dict[str, dict[str, Any]] = {}


# ── Browser & Session Helpers ─────────────────────────────────────────────────

async def _ensure_cdp_chrome_running(signin: bool = False) -> bool:
    """Ensure interactive Chrome is running on the user's real desktop (port 9222)."""
    import urllib.request
    import subprocess
    try:
        with urllib.request.urlopen("http://127.0.0.1:9222/json/version", timeout=1.0) as resp:
            if resp.status == 200:
                return True
    except Exception:
        pass

    from flow._storage import PROFILE_DIR
    target_url = (
        "https://accounts.google.com/v3/signin/identifier?continue=https://flow.google.com/&flowName=GlifWebSignIn&flowEntry=ServiceLogin"
        if signin
        else "https://flow.google.com"
    )

    chrome_candidates = [
        Path(r"C:\Program Files\Google\Chrome\Application\chrome.exe"),
        Path(r"C:\Program Files (x86)\Google\Chrome\Application\chrome.exe"),
        Path.home() / "AppData" / "Local" / "Google" / "Chrome" / "Application" / "chrome.exe",
    ]
    exe_path = None
    for cand in chrome_candidates:
        if cand.exists():
            exe_path = str(cand)
            break

    if not exe_path:
        return False

    bat_path = STORAGE_ROOT / "start_cdp_chrome.bat"
    bat_content = (
        "@echo off\r\n"
        f'start "" "{exe_path}" '
        "--remote-debugging-port=9222 "
        f'--user-data-dir="{PROFILE_DIR}" '
        "--start-maximized "
        "--no-first-run --no-default-browser-check "
        f'"{target_url}"\r\n'
    )
    bat_path.write_text(bat_content, encoding="utf-8")

    try:
        import os
        os.startfile(str(bat_path))
        for _ in range(16):
            await asyncio.sleep(0.5)
            try:
                with urllib.request.urlopen("http://127.0.0.1:9222/json/version", timeout=1.0) as resp:
                    if resp.status == 200:
                        return True
            except Exception:
                pass
    except Exception as e:
        log.warning("Could not launch start_cdp_chrome.bat: %s", e)

    return False


async def _bring_chrome_to_front(bm: BrowserManager) -> None:
    """Never force Chrome window to front on desktop during background video work."""
    return


async def _get_or_start_bm(headless: bool = True) -> BrowserManager:
    """Return the singleton BrowserManager in 100% background mode."""
    global _bm
    if _bm is not None and _bm._ctx is not None:
        try:
            if _bm._cdp_browser is not None and not _bm._cdp_browser.is_connected():
                raise RuntimeError("CDP browser disconnected")
            pages = _bm._ctx.pages
            if pages:
                _ = pages[0].url
            else:
                p = await _bm._ctx.new_page()
                _bm._page = p
            return _bm
        except Exception:
            try:
                await _bm.stop()
            except Exception:
                pass
            _bm = None

    ensure_dirs()
    # 1. Connect to live CDP Chrome on port 9222 ONLY IF user currently has it open for login
    try:
        import urllib.request
        with urllib.request.urlopen("http://127.0.0.1:9222/json/version", timeout=0.8) as resp:
            if resp.status == 200:
                bm = BrowserManager.from_cdp("http://127.0.0.1:9222")
                await bm.start()
                _bm = bm
                return _bm
    except Exception:
        pass

    # 2. DO NOT launch native visible Chrome for background jobs.
    # Launch persistent profile in headless mode (zero desktop windows, zero mouse stealing)!
    bm = BrowserManager(headless=headless)
    await bm.start()
    _bm = bm
    return _bm


async def _ensure_in_project(page, target_pid: Optional[str] = None) -> Optional[str]:
    """Ensure browser is inside an active Google Flow project editor view (flow.google.com/project/{pid}).
    Returns valid project ID, or None if unauthenticated / sign-in required.
    """
    # 1. If current page already has a valid project in URL and not an error/about page
    cur_url = page.url
    if "/project/" in cur_url and "accounts.google.com" not in cur_url and "/about" not in cur_url:
        m = re.search(r"/project/([a-f0-9\-]{8,})", cur_url)
        if m:
            pid = m.group(1)
            set_active_project(pid, f"https://flow.google.com/project/{pid}")
            add_project(pid, "active", f"https://flow.google.com/project/{pid}")
            return pid

    # 2. Try candidate project if explicitly provided
    if target_pid and len(target_pid) >= 8:
        try:
            await page.goto(f"https://flow.google.com/project/{target_pid}", wait_until="domcontentloaded", timeout=20000)
            await asyncio.sleep(2.0)
            if "/project/" in page.url and "/about" not in page.url and "accounts.google.com" not in page.url:
                m = re.search(r"/project/([a-f0-9\-]{8,})", page.url)
                if m:
                    pid = m.group(1)
                    set_active_project(pid, f"https://flow.google.com/project/{pid}")
                    return pid
        except Exception as e:
            log.debug("Target candidate project notice: %s", e)

    # 3. If page is blank or not on Google Flow / Labs, navigate to flow.google.com
    if "flow.google.com" not in page.url and "labs.google" not in page.url:
        try:
            log.info("Navigating page to https://flow.google.com/...")
            await page.goto("https://flow.google.com/", wait_until="domcontentloaded", timeout=25000)
            await asyncio.sleep(2.5)
        except Exception as e:
            log.warning("Navigation to flow.google.com error: %s", e)

    # 4. Critical check: Did Google redirect to sign-in?
    if "accounts.google.com" in page.url or "signin" in page.url:
        log.warning("Page is at Google sign-in: %s", page.url)
        return None

    # 5. Check if on /about landing page -> click 'Create with Google Flow' / 'Bắt đầu'
    if "/about" in page.url or page.url.rstrip("/") in ("https://flow.google.com", "https://labs.google/fx/tools/flow"):
        try:
            enter_btn = page.locator('button:has-text("Create with Google Flow"), a:has-text("Create with Google Flow"), button:has-text("Bắt đầu"), a:has-text("Bắt đầu"), button:has-text("Start"), a:has-text("Start"), [data-testid*="landing"]').first
            if await enter_btn.count() > 0:
                log.info("Clicking CTA to enter Google Flow workspace...")
                await enter_btn.click()
                await asyncio.sleep(3.0)
        except Exception as ex:
            log.debug("Landing CTA click notice: %s", ex)

    # 6. Check sign-in again
    if "accounts.google.com" in page.url or "signin" in page.url:
        log.warning("Page redirected to Google sign-in after CTA: %s", page.url)
        return None

    # 7. Check URL again for /project/{pid}
    m = re.search(r"/project/([a-f0-9\-]{8,})", page.url)
    if m:
        pid = m.group(1)
        set_active_project(pid, f"https://flow.google.com/project/{pid}")
        add_project(pid, "active", f"https://flow.google.com/project/{pid}")
        return pid

    # 8. Check dashboard for existing project links
    try:
        links = await page.evaluate("""
            () => [...document.querySelectorAll('a[href*="/project/"]')]
                .map(a => a.href)
        """)
        for link in (links or []):
            m = re.search(r"/project/([a-f0-9\-]{8,})", link)
            if m:
                pid = m.group(1)
                log.info("Found existing project link: %s", pid)
                await page.goto(f"https://flow.google.com/project/{pid}", wait_until="domcontentloaded", timeout=20000)
                await asyncio.sleep(2.0)
                if "/project/" in page.url and "/about" not in page.url and "accounts.google.com" not in page.url:
                    set_active_project(pid, f"https://flow.google.com/project/{pid}")
                    add_project(pid, "discovered", f"https://flow.google.com/project/{pid}")
                    return pid
    except Exception as ex:
        log.debug("Dashboard project discovery notice: %s", ex)

    # 9. Click 'New project' / 'Dự án mới' button
    try:
        new_proj_btn = page.locator('button:has-text("Dự án mới"), button:has-text("New project"), button:has-text("Create project"), button:has-text("Tạo dự án"), [aria-label*="New project"], [aria-label*="Dự án mới"], [aria-label*="Create"]').first
        if await new_proj_btn.count() > 0:
            log.info("Clicking 'New project' button on Flow dashboard...")
            await new_proj_btn.click()
            await asyncio.sleep(3.5)
            m = re.search(r"/project/([a-f0-9\-]{8,})", page.url)
            if m:
                pid = m.group(1)
                log.info("Successfully created new Flow project: %s", pid)
                set_active_project(pid, f"https://flow.google.com/project/{pid}")
                add_project(pid, "new", f"https://flow.google.com/project/{pid}")
                return pid
    except Exception as ex:
        log.debug("New project button notice: %s", ex)

    # 10. Fallback: Initialize a brand new project canvas with a fresh UUID
    new_uuid = str(uuid.uuid4())
    try:
        log.info("Navigating to new project canvas: %s", new_uuid)
        await page.goto(f"https://flow.google.com/project/{new_uuid}", wait_until="domcontentloaded", timeout=25000)
        await asyncio.sleep(2.5)
        if "/about" not in page.url and "accounts.google.com" not in page.url:
            m = re.search(r"/project/([a-f0-9\-]{8,})", page.url)
            pid = m.group(1) if m else new_uuid
            set_active_project(pid, f"https://flow.google.com/project/{pid}")
            add_project(pid, "canvas", f"https://flow.google.com/project/{pid}")
            return pid
    except Exception as e:
        log.debug("Canvas initialization notice: %s", e)

    return None

    

async def refresh_auth_state(force_navigate: bool = False) -> dict[str, Any]:
    """Check if the browser profile is logged in to Google Flow and refresh credits/project."""
    global _auth_state, _client, _bm
    if _login_in_progress and not force_navigate:
        # Never navigate away or interfere while user is typing in Chrome
        return _auth_state
    async with _browser_lock:
        try:
            bm = await _get_or_start_bm(headless=True)
            page = await bm.page()

            saved_pid, _ = get_active_project()
            if force_navigate or ("/project/" not in page.url):
                pid = await _ensure_in_project(page, target_pid=saved_pid)
            else:
                m = re.search(r"/project/([a-f0-9\-]{8,})", page.url)
                pid = m.group(1) if m else await _ensure_in_project(page, target_pid=saved_pid)

            cur_url = page.url
            if "accounts.google.com" in cur_url or "signin" in cur_url or not pid:
                _auth_state.update({
                    "authenticated": False,
                    "email": None,
                    "error": "Vui lòng đăng nhập Google trên cửa sổ Chrome vừa mở hoặc cập nhật Cookie mới",
                    "last_checked": time.time(),
                })
                return _auth_state

            # Check session via DOM account badge or __NEXT_DATA__
            session_info = await page.evaluate(r"""
                async () => {
                    try {
                        const accLink = document.querySelector('a[aria-label*="@"], button[aria-label*="@"]');
                        if (accLink) {
                            const aria = accLink.getAttribute('aria-label') || '';
                            const m = aria.match(/([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/);
                            if (m) return { email: m[1], token: null };
                        }
                        const nd = window.__NEXT_DATA__?.props?.pageProps?.session;
                        if (nd?.user?.email) {
                            return { email: nd.user.email, token: nd.access_token || null };
                        }
                    } catch (e) {}
                    return null;
                }
            """)

            email = (session_info and session_info.get("email")) or _auth_state.get("email") or "Google Flow Active"
            api = FlowAPI(bm, project_id=pid or "")
            credits_val = None
            tier_val = None
            if session_info and session_info.get("token"):
                api._bearer_token = session_info["token"]
                api._bearer_token_ts = time.time()
                try:
                    c = await api.get_credits()
                    credits_val = c.credits
                    tier_val = c.tier
                except Exception as cred_err:
                    log.debug("Could not fetch credits yet: %s", cred_err)

            _client = FlowClient(api, bm, pid)

            _auth_state.update({
                "authenticated": True,
                "email": email,
                "project_id": pid,
                "credits": credits_val,
                "tier": tier_val,
                "error": None,
                "last_checked": time.time(),
            })
            return _auth_state

        except Exception as e:
            log.error("refresh_auth_state error: %s", e)
            if "closed" in str(e).lower():
                try:
                    if _bm:
                        await _bm.stop()
                except Exception:
                    pass
                _bm = None
            _auth_state.update({
                "authenticated": False,
                "error": str(e),
                "last_checked": time.time(),
            })
            return _auth_state


# ── Request Models ────────────────────────────────────────────────────────────

class VideoGenerationRequest(BaseModel):
    prompt: str
    aspect_ratio: str = "16:9"
    images: Optional[list[str]] = None
    model: Optional[str] = None
    count: int = 1
    cookies: Optional[list[dict[str, Any]]] = None
    project_id: Optional[str] = None


class AccountPoolAddRequest(BaseModel):
    label: str
    cookies: list[dict[str, Any]]
    project_id: Optional[str] = None


class SetProjectRequest(BaseModel):
    project_id: str


class CookieSyncRequest(BaseModel):
    cookies: list[dict[str, Any]]
    project_id: Optional[str] = None


class UpscaleVideoRequest(BaseModel):
    media_id: str
    workflow_id: Optional[str] = None
    aspect_ratio: str = "16:9"


# ── Background Video Worker ───────────────────────────────────────────────────

def _save_base64_image(data_uri_or_b64: str, job_id: str) -> Path:
    """Decode base64 image from frontend and save to TEMP_INPUT_DIR."""
    raw = data_uri_or_b64.strip()
    ext = "png"
    if raw.startswith("data:"):
        header, _, b64_part = raw.partition(",")
        if "jpeg" in header or "jpg" in header:
            ext = "jpg"
        elif "webp" in header:
            ext = "webp"
        raw = b64_part
    img_bytes = base64.b64decode(raw)
    out_path = TEMP_INPUT_DIR / f"input_{job_id}.{ext}"
    out_path.write_bytes(img_bytes)
    return out_path


async def _run_video_generation_job(
    job_id: str,
    prompt: str,
    aspect_ratio: str,
    images: Optional[list[str]],
    model_override: Optional[str] = None,
    output_count: int = 1,
    user_cookies: Optional[list[dict[str, Any]]] = None,
    user_project_id: Optional[str] = None,
):
    """Execute Flow video generation directly on the live Google Flow Angular UI and download MP4(s)."""
    global _shared_bearer_token, _shared_bearer_ts, _bm
    job_entry = _jobs[job_id]
    job_entry["status"] = "processing"
    job_entry["progress_text"] = "Đang chuẩn bị trình duyệt Google Flow..."
    output_count = max(1, min(4, int(output_count or 1)))

    start_image_path: Optional[Path] = None
    if images and len(images) > 0:
        try:
            start_image_path = _save_base64_image(images[0], job_id)
            log.info("[%s] Saved input image -> %s", job_id, start_image_path)
        except Exception as img_err:
            job_entry["status"] = "failed"
            job_entry["error"] = f"Lỗi đọc ảnh đầu vào: {img_err}"
            return

    aspect_mode = "portrait" if aspect_ratio == "9:16" else "landscape"

    try:
        # 1. Determine cookies to use: explicit user_cookies > rotated account from pool > current session
        active_cookies = user_cookies
        active_pid = user_project_id
        current_pool_acc_id: Optional[str] = None
        current_pool_acc_label: Optional[str] = None

        if not active_cookies:
            pool_acc = _get_next_pool_account()
            if pool_acc and pool_acc.get("cookies"):
                active_cookies = pool_acc["cookies"]
                active_pid = active_pid or pool_acc.get("project_id")
                current_pool_acc_id = pool_acc.get("id")
                current_pool_acc_label = pool_acc.get("label")
                log.info("[%s] Rotating to pool account: %s", job_id, current_pool_acc_label)

        if active_cookies:
            try:
                await sync_cookies_from_extension(
                    CookieSyncRequest(cookies=active_cookies, project_id=active_pid)
                )
            except Exception as ck_err:
                log.warning("[%s] Cookie injection warning: %s", job_id, ck_err)

        state = await refresh_auth_state(force_navigate=False)
        if not state.get("authenticated"):
            if current_pool_acc_id:
                _flag_pool_account_error(current_pool_acc_id, "Phiên đăng nhập hết hạn")
            job_entry["status"] = "failed"
            acc_name_str = f" ({current_pool_acc_label})" if current_pool_acc_label else ""
            job_entry["error"] = (
                f"Chưa đăng nhập tài khoản Google Flow{acc_name_str} hoặc Cookie đã hết hạn. "
                "Vui lòng bấm 'Mở Google Flow' trên web để đăng nhập trực tiếp trên Chrome hoặc cập nhật Cookie mới."
            )
            return

        async with _browser_lock:
            bm = await _get_or_start_bm(headless=True)
            page = await bm.page()
            pid = active_pid or state.get("project_id") or await _ensure_in_project(page)

            # Ensure we are on the project main view (not /edit/...)
            if "/edit/" in page.url or "/project/" not in page.url:
                proj_url = f"https://flow.google.com/project/{pid}"
                await page.goto(proj_url, wait_until="domcontentloaded", timeout=25000)
                await asyncio.sleep(2.5)

            # CRITICAL SESSION CHECK: Did Google redirect to signin/accounts page?
            if "accounts.google.com" in page.url or "/about" in page.url or "signin" in page.url:
                log.error("[%s] Browser is at '%s' - not authenticated to Google Flow!", job_id, page.url)
                if current_pool_acc_id:
                    _flag_pool_account_error(current_pool_acc_id, "Phiên đăng nhập hết hạn hoặc Google từ chối Cookie.")
                job_entry["status"] = "failed"
                acc_label_str = f" ({current_pool_acc_label})" if current_pool_acc_label else ""
                job_entry["error"] = (
                    f"Tài khoản Google Flow{acc_label_str} chưa được đăng nhập hoặc Cookie đã hết hạn. "
                    "Vui lòng bấm 'Mở Google Flow' trên web để hoàn tất đăng nhập trên cửa sổ Chrome, sau đó thử lại."
                )
                return

            # Record existing GENERATED VIDEO thumbnails before submitting
            before_srcs: list[str] = await page.evaluate("""
                () => [...document.querySelectorAll('img')]
                    .filter(i => i.src && i.src.includes('/asb/') && (
                        (i.alt && (i.alt.includes('video') || i.alt.includes('Video'))) ||
                        (!i.src.includes('-rw') && (!i.alt || !i.alt.includes('hình ảnh')))
                    ))
                    .map(i => i.src)
            """)

            # Enhanced prompt to preserve all characters & subjects from the input frame
            final_prompt = prompt
            if start_image_path:
                two_kw = ["2 người", "hai người", "cặp đôi", "chàng trai", "cô gái", "nam nữ", "vợ chồng", "cả hai", "couple", "two people", "both"]
                is_two_chars = any(k in prompt.lower() for k in two_kw)
                if is_two_chars:
                    enhancement = (
                        " Quay toàn cảnh góc rộng thấy rõ và giữ trọn vẹn cả 2 nhân vật chàng trai và cô gái đứng bên nhau trong suốt video, "
                        "tuyệt đối không cắt bỏ, không zoom lệch làm mất bất kỳ nhân vật nào, giữ cả hai người luôn cùng xuất hiện tự nhiên trong khung hình."
                    )
                else:
                    enhancement = (
                        " Giữ nguyên đầy đủ tất cả các nhân vật và chủ thể trong ảnh gốc, "
                        "không cắt bỏ hay làm mất bất kỳ người nào khỏi khung hình."
                    )
                if "giữ nguyên" not in final_prompt.lower() and "giữ trọn" not in final_prompt.lower() and "keep all" not in final_prompt.lower():
                    final_prompt = f"{prompt.rstrip('. ')};{enhancement}"

            # ─────────────────────────────────────────────────────────────────
            # BÀI 3: DIRECT INTERNAL REST API (Veo 3.1) - 100% HEADLESS
            # ─────────────────────────────────────────────────────────────────
            api = FlowAPI(bm, project_id=pid)
            media_names = []

            if start_image_path:
                job_entry["progress_text"] = "Đang tải ảnh nguồn và khởi tạo tác vụ Veo 3.1..."
                log.info("[%s] Using FlowClient to upload image and submit I2V job...", job_id)
                client = FlowClient(api, bm, pid)
                jobs = await client.generate_video(
                    prompt=final_prompt,
                    aspect=aspect_mode,
                    count=output_count,
                    start_image=str(start_image_path),
                    timeout_s=150,
                )
                media_names = [j.media_name for j in jobs if j.media_name]
                log.info("[%s] FlowClient submitted I2V jobs: %s", job_id, media_names)
            else:
                ar_enum = VIDEO_AR_PORTRAIT if aspect_mode == "portrait" else VIDEO_AR_LANDSCAPE
                model_key = VIDEO_MODEL_VEO31_FAST_P if aspect_mode == "portrait" else VIDEO_MODEL_VEO31_FAST

                job_entry["progress_text"] = f"Đang gửi lệnh tạo {output_count} video qua Veo 3.1 REST API..."
                requests = []
                base_seed = random.randint(0, 2**31)
                for i in range(output_count):
                    req_item = {
                        "aspectRatio": ar_enum,
                        "seed": base_seed + i,
                        "textInput": {"structuredPrompt": {"parts": [{"text": final_prompt}]}},
                        "videoModelKey": model_key,
                        "metadata": {},
                    }
                    requests.append(req_item)

                log.info("[%s] [Bài 3] Calling batchAsyncGenerateVideoText (%d requests, model=%s)", job_id, len(requests), model_key)
                video_job = await api._video_call("video:batchAsyncGenerateVideoText", requests)

                media_list = video_job._raw.get("media", [])
                if not media_list and "workflows" in video_job._raw:
                    media_list = [{"name": wf.get("metadata", {}).get("primaryMediaId")} for wf in video_job._raw.get("workflows", [])]
                media_names = [m.get("name") for m in media_list if m.get("name")]
                if not media_names and video_job.media_name:
                    media_names = [video_job.media_name]

                log.info("[%s] [Bài 3] VideoJob submitted: tracking media %s", job_id, media_names)

            if not media_names:
                job_entry["status"] = "failed"
                job_entry["error"] = "Không thể khởi tạo tác vụ video trên Google Flow (không nhận được phản hồi tạo video)."
                return

            t0 = time.monotonic()
            max_wait = 320
            completed_media = {}

            while time.monotonic() - t0 < max_wait:
                await asyncio.sleep(4.0)
                elapsed = int(time.monotonic() - t0)

                pending = [m for m in media_names if m not in completed_media]
                if not pending:
                    break

                status_payload = {"media": [{"name": mn, "projectId": pid} for mn in pending]}
                try:
                    status_data = await api._fetch("POST", "video:batchCheckAsyncVideoGenerationStatus", status_payload)
                    items = status_data.get("media", [])
                    for itm in items:
                        m_name = itm.get("name")
                        meta = itm.get("mediaMetadata", {})
                        gen_status = meta.get("mediaStatus", {}).get("mediaGenerationStatus", "")
                        vid = itm.get("video", {}).get("generatedVideo", {})
                        fife = vid.get("fifeUrl") or itm.get("fifeUrl") or ""

                        if gen_status in ("MEDIA_GENERATION_STATUS_COMPLETE", "MEDIA_GENERATION_STATUS_SUCCESS", "MEDIA_GENERATION_STATUS_SUCCESSFUL") or fife:
                            if fife and m_name not in completed_media:
                                completed_media[m_name] = fife
                                log.info("[%s] [Bài 3] Media %s complete! fifeUrl: %s", job_id, m_name[:8], fife[:60])
                        elif gen_status in ("MEDIA_GENERATION_STATUS_FAILED", "MEDIA_GENERATION_STATUS_REJECTED"):
                            log.error("[%s] [Bài 3] Media %s failed with status: %s", job_id, m_name[:8], gen_status)
                except Exception as poll_err:
                    log.debug("[%s] [Bài 3] Poll notice: %s", job_id, poll_err)

                cur_done = len(completed_media)
                job_entry["progress_text"] = f"Veo 3.1 đang render ngầm ({cur_done}/{len(media_names)} video • {elapsed}s)..."

                if cur_done >= len(media_names):
                    break

            if completed_media:
                saved_urls = []
                total_bytes = 0
                for idx, (m_name, fife_url) in enumerate(completed_media.items()):
                    suffix = "" if idx == 0 else f"_{idx + 1}"
                    out_file = OUTPUT_DIR / f"{job_id}{suffix}.mp4"
                    job_entry["progress_text"] = f"Đang tải video MP4 gốc ({idx + 1}/{len(completed_media)})..."
                    try:
                        await api.download(fife_url, out_file)
                        if out_file.exists() and out_file.stat().st_size > 0:
                            file_url = f"http://localhost:8100/files/{out_file.name}"
                            saved_urls.append(file_url)
                            total_bytes += out_file.stat().st_size
                            log.info("[%s] [Bài 3] Downloaded MP4 #%d: %s (%d bytes)", job_id, idx + 1, out_file.name, out_file.stat().st_size)
                    except Exception as dl_err:
                        log.warning("[%s] [Bài 3] Download error for %s: %s", job_id, m_name, dl_err)

                if saved_urls:
                    job_entry["status"] = "completed"
                    job_entry["url"] = saved_urls[0]
                    job_entry["urls"] = saved_urls
                    job_entry["download_url"] = saved_urls[0]
                    job_entry["bytes"] = total_bytes
                    job_entry["progress_text"] = "Hoàn tất!"
                    log.info("[%s] [Bài 3] Successfully completed all %d video(s) via REST API!", job_id, len(saved_urls))
                    return

            job_entry["status"] = "failed"
            job_entry["error"] = "Quá thời gian render video trên Google Flow hoặc yêu cầu bị từ chối."
            return
    except Exception as exc:
        log.exception("[%s] Video generation failed:", job_id)
        if "closed" in str(exc).lower():
            try:
                if _bm:
                    await _bm.stop()
            except Exception:
                pass
            _bm = None
            job_entry["error"] = (
                "Cửa sổ trình duyệt Google Flow nền vừa bị đóng trong lúc render. "
                "Hệ thống đã tự khởi động lại ở chế độ thu nhỏ — vui lòng bấm Tạo Video lại!"
            )
        else:
            err_str = str(exc)
            if "Failed to upload" in err_str or "inputs" in err_str:
                job_entry["error"] = (
                    "Không thể tải ảnh nguồn lên Google Flow. "
                    "Vui lòng kiểm tra lại tài khoản trong mục 'Hồ sơ Tài khoản Google' hoặc thử ảnh khác!"
                )
            elif "accounts.google.com" in err_str or "signin" in err_str:
                job_entry["error"] = (
                    "Tài khoản Google Flow đã hết hạn phiên làm việc. "
                    "Vui lòng bấm 'Thêm Gmail' hoặc dán lại Cookie mới!"
                )
            else:
                job_entry["error"] = err_str
        job_entry["status"] = "failed"
    finally:
        if start_image_path and start_image_path.exists():
            try:
                start_image_path.unlink()
            except Exception:
                pass


# ── FastAPI Endpoints ─────────────────────────────────────────────────────────

@app.get("/v1/extension/pending-reload")
async def extension_pending_reload():
    """Auto-reload the user's installed Chrome extension once so it picks up Flow sync."""
    global _ext_reload_done
    if not _ext_reload_done:
        _ext_reload_done = True
        return {"reload": True}
    return {"reload": False}


@app.get("/v1/debug/page")
async def debug_page(goto: Optional[str] = None, test_dl: bool = False, inspect_add: bool = False):
    """Inspect current Playwright page state and cookies."""
    bm = await _get_or_start_bm(headless=True)
    page = await bm.page()
    if inspect_add:
        info = await page.evaluate("""
            () => ({
                options: [...document.querySelectorAll('[role=option], button')].map(b => ({
                    tag: b.tagName,
                    role: b.getAttribute('role'),
                    text: (b.textContent || '').trim(),
                    aria: b.getAttribute('aria-label'),
                    selected: b.getAttribute('aria-selected'),
                    y: Math.round(b.getBoundingClientRect().y),
                })).filter(x => x.y > 0 && (x.role === 'option' || x.text.includes('Bắt đầu') || x.text.includes('Thêm vào') || x.text.includes('test_img'))),
                bodyText: document.body.innerText.slice(-800)
            })
        """)
        return info
    if test_dl:
        import urllib.request
        out_path = OUTPUT_DIR / "test_dl.mp4"
        if out_path.exists():
            out_path.unlink()
        captured_mp4_url: list[str] = []
        dl_errors: list[str] = []

        async def _on_resp(r):
            ct = r.headers.get("content-type", "")
            if "video/mp4" in ct or "flow-content.google/video/" in r.url:
                captured_mp4_url.append(r.url)
                try:
                    b = await r.body()
                    if len(b) > 10000:
                        out_path.write_bytes(b)
                except Exception as e:
                    dl_errors.append(f"body_err:{e}")
            elif "batchexecute" in r.url and "as29s" in r.url:
                try:
                    txt = await r.text()
                    clean_txt = (
                        txt.replace("\\\\u003d", "=")
                        .replace("\\u003d", "=")
                        .replace("\\\\u0026", "&")
                        .replace("\\u0026", "&")
                        .replace('\\"', '"')
                    )
                    m = re.search(r"https://flow-content\.google/video/[a-zA-Z0-9_\-\?=&%]+", clean_txt)
                    if m:
                        captured_mp4_url.append(m.group(0))
                except Exception as e:
                    dl_errors.append(f"as29s_err:{e}")

        page.on("response", lambda r: asyncio.ensure_future(_on_resp(r)))
        if "/edit/" in page.url:
            back_btn = page.locator("button").filter(has_text="arrow_back").first
            if await back_btn.count() > 0:
                await back_btn.click()
                await asyncio.sleep(2.0)

        await page.evaluate("""
            () => {
                const img = [...document.querySelectorAll('img')].find(i => i.src && i.src.includes('/asb/'));
                if (img) img.click();
            }
        """)
        for _ in range(16):
            if captured_mp4_url or (out_path.exists() and out_path.stat().st_size > 10000):
                break
            await asyncio.sleep(0.5)

        if not captured_mp4_url:
            perf_urls = await page.evaluate("""
                () => performance.getEntriesByType('resource')
                    .map(r => r.name)
                    .filter(u => u.includes('flow-content.google/video/'))
            """)
            if perf_urls:
                captured_mp4_url.extend(perf_urls)

        if (not out_path.exists() or out_path.stat().st_size == 0) and captured_mp4_url:
            mp4_url = captured_mp4_url[-1]
            try:
                req = urllib.request.Request(mp4_url, headers={"User-Agent": "Mozilla/5.0"})
                with urllib.request.urlopen(req, timeout=20) as uresp:
                    out_path.write_bytes(uresp.read())
            except Exception as uerr:
                dl_errors.append(f"urllib_err:{uerr}")

        back_btn = page.locator("button").filter(has_text="arrow_back").first
        if await back_btn.count() > 0:
            await back_btn.click()
        return {
            "saved": str(out_path),
            "size": out_path.stat().st_size if out_path.exists() else 0,
            "captured_urls": captured_mp4_url,
            "errors": dl_errors,
        }
    if goto:
        await page.goto(goto, wait_until="domcontentloaded", timeout=20000)
        await asyncio.sleep(3)
    cookies = await _bm.context.cookies()
    title = await page.title()
    extra = await page.evaluate("""
        () => ({
            buttons: [...document.querySelectorAll('button, [role="tab"]')].map(b => ({
                tag: b.tagName,
                role: b.getAttribute('role'),
                ariaLabel: b.getAttribute('aria-label'),
                text: (b.textContent || '').trim(),
                rect: b.getBoundingClientRect().toJSON(),
            })).filter(b => b.rect.width > 0),
            textareas: [...document.querySelectorAll('textarea, [contenteditable]')].map(t => ({
                tag: t.tagName,
                className: t.className,
                placeholder: t.getAttribute('placeholder'),
                rect: t.getBoundingClientRect().toJSON(),
            })),
            hasRecaptcha: typeof window.grecaptcha !== 'undefined',
            hasNextData: typeof window.__NEXT_DATA__ !== 'undefined',
            nextDataKeys: window.__NEXT_DATA__ ? Object.keys(window.__NEXT_DATA__.props?.pageProps || {}) : [],
        })
    """)
    return {
        "url": page.url,
        "title": title,
        "cookie_count": len(cookies),
        "extra": extra,
    }


@app.get("/health")
async def health_check(refresh: bool = False):
    """Health check endpoint polled by ToolMedia VideoPanel.
    Fast & non-blocking: never blocks on _browser_lock during video generation.
    """
    if _login_in_progress:
        return {
            "status": "ok",
            "engine": "flow-py",
            "backend_mode": "flow-py (Veo 3.1)",
            "active_backend": "flow.google.com",
            "authenticated": False,
            "email": None,
            "project_id": None,
            "credits": None,
            "tier": None,
            "login_in_progress": True,
            "auth_error": "Đang mở cửa sổ đăng nhập Chrome trên màn hình...",
        }

    now = time.time()
    if (refresh or (now - _auth_state["last_checked"] > 10.0)) and not _browser_lock.locked():
        asyncio.create_task(refresh_auth_state(force_navigate=False))

    return {
        "status": "ok",
        "engine": "flow-py",
        "backend_mode": "flow-py (Veo 3.1)",
        "active_backend": "flow.google.com",
        "authenticated": _auth_state["authenticated"],
        "email": _auth_state["email"],
        "project_id": _auth_state["project_id"],
        "credits": _auth_state["credits"],
        "tier": _auth_state["tier"],
        "login_in_progress": False,
        "auth_error": _auth_state["error"],
    }


@app.post("/v1/auth/login")
async def trigger_flow_login():
    """Launch visible Chrome login on the user's real desktop without closing while user is typing."""
    global _login_in_progress, _bm
    _login_in_progress = True

    # Safely release browser handle
    async with _browser_lock:
        if _bm is not None:
            try:
                await _bm.stop()
            except Exception:
                pass
            _bm = None

    # 1. Ensure Chrome is running on port 9222 with Google Flow / Sign In
    launched = await _ensure_cdp_chrome_running(signin=True)
    log.info("Chrome sign-in launched on port 9222 (success=%s)", launched)

    # 2. Start gentle background watcher to detect when user finishes login on Chrome
    async def _watch_chrome_login():
        global _login_in_progress, _auth_state
        import urllib.request
        import json as _json
        log.info("Started background login watcher for port 9222...")
        for _ in range(300):  # Watch up to 10 minutes
            await asyncio.sleep(2.0)
            try:
                req = urllib.request.Request("http://127.0.0.1:9222/json", headers={"User-Agent": "Mozilla/5.0"})
                with urllib.request.urlopen(req, timeout=1.0) as resp:
                    if resp.status == 200:
                        tabs = _json.loads(resp.read().decode())
                        for t in tabs:
                            url = t.get("url", "")
                            if "flow.google.com" in url and "accounts.google.com" not in url and "signin" not in url and "/about" not in url:
                                log.info("Google Flow login detected in tab: %s", url)
                                _login_in_progress = False
                                await asyncio.sleep(1.5)
                                state = await refresh_auth_state(force_navigate=False)
                                if state.get("authenticated"):
                                    try:
                                        await snapshot_current_browser_to_pool()
                                        log.info("Auto-saved newly logged-in account to pool!")
                                    except Exception as snap_err:
                                        log.debug("Auto-save to pool notice: %s", snap_err)
                                return
            except Exception:
                pass
        _login_in_progress = False

    asyncio.create_task(_watch_chrome_login())

    return {
        "status": "opening_browser",
        "message": "Đã mở cửa sổ Chrome. Vui lòng đăng nhập Google Flow, web sẽ tự động kết nối ngay khi bạn đăng nhập xong!",
    }


@app.post("/v1/auth/login-done")
async def notify_login_done():
    """Called when login.bat completes interactive Chrome sign-in."""
    global _login_in_progress
    _login_in_progress = False
    state = await refresh_auth_state(force_navigate=True)
    return {
        "status": "ok",
        "authenticated": state.get("authenticated"),
        "email": state.get("email"),
        "project_id": state.get("project_id"),
    }



@app.post("/v1/auth/cookies")
async def sync_cookies_from_extension(req: CookieSyncRequest):
    """Receive Google & Flow cookies from the user's normal Chrome or Electron and inject into Playwright."""
    global _auth_state
    async with _browser_lock:
        bm = await _get_or_start_bm(headless=True)
        try:
            await bm.context.clear_cookies()
        except Exception:
            pass

        pw_cookies = []
        cookie_names = []
        if req.cookies:
            for c in req.cookies:
                name = str(c.get("name", "")).strip()
                value = c.get("value")
                if not name or value is None:
                    continue

                domain = str(c.get("domain", "")).strip()
                is_host_only = bool(c.get("hostOnly") or name.startswith("__Host-"))

                raw_ss = str(c.get("sameSite", "")).lower()
                if raw_ss in ("no_restriction", "none"):
                    same_site = "None"
                elif raw_ss in ("lax", "lax_after_reconnect"):
                    same_site = "Lax"
                elif raw_ss == "strict":
                    same_site = "Strict"
                else:
                    same_site = "None" if c.get("secure") else "Lax"

                cookie_names.append(f"{name}@{domain or 'host'}")

                if is_host_only:
                    target_url = (
                        "https://flow.google.com/"
                        if "flow" in domain or "flow" in name.lower()
                        else "https://accounts.google.com/"
                    )
                    item: dict[str, Any] = {
                        "name": name,
                        "value": str(value),
                        "url": target_url,
                        "path": str(c.get("path", "/")),
                        "secure": bool(c.get("secure", True)),
                        "httpOnly": bool(c.get("httpOnly", True)),
                        "sameSite": same_site,
                    }
                else:
                    if "next-auth" in name.lower() or "flow" in name.lower() or "osid" in name.lower():
                        d = domain if ("flow" in domain or "labs" in domain) else "flow.google.com"
                    elif is_host_only or "lsid" in name.lower() or "gaps" in name.lower():
                        d = domain if "accounts" in domain else "accounts.google.com"
                    else:
                        d = domain or ".google.com"

                    item = {
                        "name": name,
                        "value": str(value),
                        "domain": d,
                        "path": str(c.get("path", "/")),
                        "secure": True if same_site == "None" else bool(c.get("secure", True)),
                        "httpOnly": bool(c.get("httpOnly", False)),
                        "sameSite": same_site,
                    }
                    if "next-auth" in name.lower() or name in ("OSID", "__Secure-OSID"):
                        labs_item = dict(item)
                        labs_item["domain"] = "labs.google"
                        pw_cookies.append(labs_item)

                exp = c.get("expirationDate") or c.get("expires")
                if exp:
                    try:
                        exp_val = float(exp)
                        if exp_val > 0:
                            item["expires"] = exp_val
                    except Exception:
                        pass
                pw_cookies.append(item)

        page = await bm.page()

        # Inject via CDP Network.setCookies for native fidelity if supported
        try:
            cdp = await bm.context.new_cdp_session(page)
            cdp_cookies = []
            for ck in pw_cookies:
                c_copy = dict(ck)
                if "url" not in c_copy and "domain" in c_copy:
                    d = c_copy["domain"].lstrip(".")
                    c_copy["url"] = f"https://{d}{c_copy.get('path', '/')}"
                cdp_cookies.append(c_copy)
            await cdp.send("Network.setCookies", {"cookies": cdp_cookies})
            log.info("Injected %d cookies via CDP Network.setCookies", len(cdp_cookies))
        except Exception as cdp_err:
            log.debug("CDP Network.setCookies notice: %s", cdp_err)

        # Also add directly to context
        for ck in pw_cookies:
            try:
                await bm.context.add_cookies([ck])
            except Exception as ck_err:
                log.debug("Skipped cookie %s: %s", ck.get("name"), ck_err)

        log.info("Cleared old cookies & injected %d cookies: %s", len(pw_cookies), cookie_names)

        if req.project_id:
            set_active_project(req.project_id, f"https://flow.google.com/project/{req.project_id}")
            add_project(req.project_id, "chrome-sync", f"https://flow.google.com/project/{req.project_id}")

        pid = await _ensure_in_project(page, target_pid=req.project_id)
        if pid:
            email_val = "Google Flow Connected"
            try:
                acc_link = await page.evaluate("""
                    () => {
                        const acc = document.querySelector('a[aria-label*="@"], button[aria-label*="@"]');
                        if (acc) {
                            const aria = acc.getAttribute('aria-label') || '';
                            const m = aria.match(/([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+.[a-zA-Z]{2,})/);
                            if (m) return m[1];
                        }
                        return window.__NEXT_DATA__?.props?.pageProps?.session?.user?.email || null;
                    }
                """)
                if acc_link:
                    email_val = acc_link
            except Exception:
                pass
            _auth_state.update({
                "authenticated": True,
                "email": email_val,
                "project_id": pid,
                "error": None,
                "last_checked": time.time(),
            })
            log.info("Cookie injection verified: active in project %s (%s)", pid, email_val)
        else:
            is_signin = "accounts.google.com" in page.url or "signin" in page.url or "/about" in page.url
            _auth_state.update({
                "authenticated": False,
                "email": None,
                "project_id": None,
                "error": "Google từ chối Cookie này (phiên hết hạn hoặc Google yêu cầu đăng nhập trực tiếp trên Chrome). Vui lòng bấm 'Mở cửa sổ Chrome đăng nhập Google' để đăng nhập!",
                "last_checked": time.time(),
            })
            log.warning("Cookie injection check: not authenticated (url=%s)", page.url)

    return {
        "status": "ok" if _auth_state.get("authenticated") else "unauthenticated",
        "injected": len(pw_cookies),
        "authenticated": _auth_state.get("authenticated"),
        "email": _auth_state.get("email"),
        "project_id": _auth_state.get("project_id"),
        "credits": _auth_state.get("credits"),
        "error": _auth_state.get("error"),
    }


@app.post("/v1/auth/project")
async def set_flow_project(req: SetProjectRequest):
    """Manually set the active Google Flow Project ID (or extract from full URL)."""
    raw = req.project_id.strip()
    m = re.search(r"/project/([a-f0-9\-]{8,})", raw)
    pid = m.group(1) if m else raw
    if not pid:
        raise HTTPException(status_code=400, detail="Project ID không hợp lệ.")

    url = f"https://flow.google.com/project/{pid}"
    set_active_project(pid, url)
    add_project(pid, "manual", url)
    state = await refresh_auth_state(force_navigate=True)
    return {
        "status": "ok",
        "project_id": pid,
        "authenticated": state.get("authenticated"),
        "credits": state.get("credits"),
    }


@app.get("/v1/auth/accounts-pool")
async def get_accounts_pool():
    """Return all accounts in the rotation pool (without raw cookie values for compactness)."""
    pool = _load_accounts_pool()
    return {
        "status": "ok",
        "count": len(pool),
        "accounts": [
            {
                "id": a.get("id"),
                "label": a.get("label"),
                "project_id": a.get("project_id"),
                "cookie_count": len(a.get("cookies") or []),
                "enabled": a.get("enabled", True),
                "error": a.get("error"),
                "added_at": a.get("added_at"),
            }
            for a in pool
        ],
    }


@app.post("/v1/auth/accounts-pool")
async def add_account_to_pool(req: AccountPoolAddRequest):
    """Add an account (from Cookie JSON) to the server rotation pool."""
    if not req.cookies:
        raise HTTPException(status_code=400, detail="Không tìm thấy Cookie hợp lệ.")
    pool = _load_accounts_pool()
    acc_id = f"acc_{uuid.uuid4().hex[:8]}"
    label = req.label.strip() or f"Tài khoản #{len(pool) + 1}"
    pool.append({
        "id": acc_id,
        "label": label,
        "cookies": req.cookies,
        "project_id": req.project_id,
        "enabled": True,
        "added_at": time.time(),
    })
    _save_accounts_pool(pool)
    return {
        "status": "ok",
        "id": acc_id,
        "label": label,
        "count": len(pool),
    }


@app.post("/v1/auth/accounts-pool/snapshot")
async def snapshot_current_browser_to_pool(label: Optional[str] = None):
    """Save the currently logged-in Chrome browser session into the rotation pool."""
    async with _browser_lock:
        bm = await _get_or_start_bm(headless=True)
        page = await bm.page()
        pid = await _ensure_in_project(page)
        if not pid or "accounts.google.com" in page.url or "signin" in page.url or "/about" in page.url:
            raise HTTPException(
                status_code=400,
                detail="Trình duyệt Chrome chưa đăng nhập Google Flow! Vui lòng đăng nhập trên cửa sổ Chrome trước khi lưu nick."
            )
        cookies = await bm.context.cookies()
        if not cookies:
            raise HTTPException(status_code=400, detail="Không lấy được Cookie từ trình duyệt hiện tại.")
        pool = _load_accounts_pool()
        acc_id = f"acc_{uuid.uuid4().hex[:8]}"
        acc_label = (label or _auth_state.get("email") or f"Tài khoản #{len(pool) + 1}").strip()
        # Replace existing entry if same email/label already exists
        pool = [a for a in pool if a.get("label") != acc_label]
        pool.append({
            "id": acc_id,
            "label": acc_label,
            "cookies": cookies,
            "project_id": pid,
            "enabled": True,
            "added_at": time.time(),
        })
        _save_accounts_pool(pool)
        return {
            "status": "ok",
            "id": acc_id,
            "label": acc_label,
            "count": len(pool),
            "project_id": pid,
        }


@app.delete("/v1/auth/accounts-pool/{acc_id}")
async def delete_account_from_pool(acc_id: str):
    """Remove an account from the rotation pool."""
    pool = _load_accounts_pool()
    pool = [a for a in pool if a.get("id") != acc_id]
    _save_accounts_pool(pool)
    return {"status": "ok", "count": len(pool)}


@app.post("/v1/videos/generations", status_code=202)
async def create_video_generation(req: VideoGenerationRequest):
    """Submit a Text-to-Video or Image-to-Video generation job via flow-py."""
    if not req.prompt or not req.prompt.strip():
        raise HTTPException(status_code=400, detail="Vui lòng nhập mô tả kịch bản video (prompt).")

    job_id = f"flow_{uuid.uuid4().hex[:12]}"
    _jobs[job_id] = {
        "id": job_id,
        "status": "queued",
        "prompt": req.prompt.strip(),
        "aspect_ratio": req.aspect_ratio,
        "created_at": time.time(),
        "progress_text": "Đang xếp hàng xử lý trên Google Flow...",
        "url": None,
        "urls": [],
        "error": None,
    }

    asyncio.create_task(
        _run_video_generation_job(
            job_id=job_id,
            prompt=req.prompt.strip(),
            aspect_ratio=req.aspect_ratio,
            images=req.images,
            model_override=req.model,
            output_count=req.count,
            user_cookies=req.cookies,
            user_project_id=req.project_id,
        )
    )

    return {
        "id": job_id,
        "status": "queued",
        "engine": "flow-py",
    }


@app.get("/v1/videos/generations/{job_id}")
async def get_video_generation_status(job_id: str):
    """Poll status of a submitted video job."""
    job = _jobs.get(job_id)
    if not job:
        raise HTTPException(status_code=404, detail=f"Không tìm thấy Job ID: {job_id}")
    return job


@app.get("/files/{filename}")
async def serve_video_file(filename: str):
    """Serve downloaded MP4 video files to the ToolMedia frontend."""
    safe_name = os.path.basename(filename)
    file_path = OUTPUT_DIR / safe_name
    if not file_path.exists():
        raise HTTPException(status_code=404, detail="File video không tồn tại.")
    return FileResponse(
        path=str(file_path),
        media_type="video/mp4",
        filename=safe_name,
    )


if __name__ == "__main__":
    import uvicorn

    port = int(os.environ.get("FLOW_SERVER_PORT", "8100"))
    log.info("Starting Google Flow AI (Veo 3.1) Server on http://localhost:%d", port)
    uvicorn.run(app, host="0.0.0.0", port=port, log_level="info")
