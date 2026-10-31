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

import asyncio
import base64
import json
import logging
import os
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
OUTPUT_DIR = Path(__file__).parent / "flow_outputs"
TEMP_INPUT_DIR = Path(__file__).parent / "flow_inputs"
ACCOUNTS_POOL_FILE = Path(__file__).parent / "accounts_pool.json"
OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
TEMP_INPUT_DIR.mkdir(parents=True, exist_ok=True)

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

async def _ensure_cdp_chrome_running() -> bool:
    """Ensure interactive Chrome is running on the user's real desktop (port 9222)."""
    import urllib.request
    import subprocess
    try:
        with urllib.request.urlopen("http://127.0.0.1:9222/json/version", timeout=1.5) as resp:
            if resp.status == 200:
                return True
    except Exception:
        pass

    bat_path = Path(__file__).parent / "start_cdp_chrome.bat"
    bat_path.write_text(
        '@echo off\n'
        'start "" "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe" '
        '--remote-debugging-port=9222 '
        '--user-data-dir="C:\\Users\\Admin\\.flow-py\\cdp-profile" '
        '--window-position=100,100 --window-size=1280,900 '
        '--no-first-run --no-default-browser-check '
        '"https://flow.google.com"\n',
        encoding="utf-8",
    )
    # Attempt 1: Direct subprocess Popen
    try:
        subprocess.Popen([str(bat_path)], shell=True)
        for _ in range(10):
            await asyncio.sleep(0.5)
            try:
                with urllib.request.urlopen("http://127.0.0.1:9222/json/version", timeout=1.0) as resp:
                    if resp.status == 200:
                        return True
            except Exception:
                pass
    except Exception as direct_err:
        log.debug("Direct launch note: %s", direct_err)

    # Attempt 2: Scheduled task fallback
    try:
        ps_cmd = (
            f'$action = New-ScheduledTaskAction -Execute "{bat_path}"; '
            '$settings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries; '
            'Register-ScheduledTask -TaskName "FlowChromeCDP" -Action $action -Settings $settings -Force | Out-Null; '
            'Start-ScheduledTask -TaskName "FlowChromeCDP"'
        )
        subprocess.run(
            ["powershell", "-NoProfile", "-Command", ps_cmd],
            capture_output=True,
            timeout=8,
        )
        for _ in range(12):
            await asyncio.sleep(0.5)
            try:
                with urllib.request.urlopen("http://127.0.0.1:9222/json/version", timeout=1.0) as resp:
                    if resp.status == 200:
                        return True
            except Exception:
                pass
    except Exception as e:
        log.warning("Could not start CDP Chrome via schtasks: %s", e)
    return False


async def _bring_chrome_to_front(bm: BrowserManager) -> None:
    """Use Chrome DevTools Protocol to bring Chrome window to front on the desktop."""
    try:
        p = await bm.page()
        cdp = await bm.context.new_cdp_session(p)
        win_info = await cdp.send("Browser.getWindowForTarget")
        wid = win_info.get("windowId")
        if wid:
            await cdp.send("Browser.setWindowBounds", {
                "windowId": wid,
                "bounds": {"left": 100, "top": 100, "width": 1280, "height": 900, "windowState": "normal"}
            })
            log.info("Brought CDP Chrome window to front (windowId=%s)", wid)
    except Exception as e:
        log.debug("Bring chrome to front notice: %s", e)


async def _get_or_start_bm(headless: bool = False) -> BrowserManager:
    """Return the singleton BrowserManager."""
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
    # If interactive CDP on 9222 is active, connect to it; otherwise use native persistent context
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

    bm = BrowserManager(headless=headless)
    await bm.start()
    _bm = bm
    return _bm


async def _extract_or_create_project_id(page) -> Optional[str]:
    """Extract project_id from URL, page data, or click 'New project' on Flow dashboard."""
    # 1. Check current URL
    m = re.search(r"/project/([a-f0-9\-]{8,})", page.url)
    if m:
        pid = m.group(1)
        set_active_project(pid, f"https://labs.google/fx/tools/flow/project/{pid}")
        add_project(pid, "auto", f"https://labs.google/fx/tools/flow/project/{pid}")
        return pid

    # 2. Check saved config
    saved_pid, _ = get_active_project()
    if saved_pid:
        return saved_pid

    default_pid = "a589a2fc-8eb7-4b2e-9a39-c6ab11c28444"
    set_active_project(default_pid, f"https://labs.google/fx/tools/flow/project/{default_pid}")
    return default_pid


async def refresh_auth_state(force_navigate: bool = False) -> dict[str, Any]:
    """Check if the browser profile is logged in to Google Flow and refresh credits/project."""
    global _auth_state, _client, _bm
    async with _browser_lock:
        try:
            bm = await _get_or_start_bm(headless=False)
            page = await bm.page()

            if force_navigate or ("labs.google" not in page.url and "flow.google" not in page.url and "accounts.google" not in page.url):
                saved_pid, _ = get_active_project()
                pid_to_use = saved_pid or "a589a2fc-8eb7-4b2e-9a39-c6ab11c28444"
                target_url = f"https://labs.google/fx/tools/flow/project/{pid_to_use}"
                try:
                    await page.goto(target_url, wait_until="domcontentloaded", timeout=25000)
                    await asyncio.sleep(3)
                except Exception as nav_err:
                    log.warning("Navigation warning: %s", nav_err)

            cur_url = page.url
            if "accounts.google.com" in cur_url:
                _auth_state.update({
                    "authenticated": False,
                    "email": None,
                    "error": "Vui lòng đăng nhập Google trên cửa sổ Chrome vừa mở",
                    "last_checked": time.time(),
                })
                return _auth_state

            # Check session via DOM account badge or __NEXT_DATA__
            session_info = await page.evaluate("""
                async () => {
                    try {
                        const accLink = document.querySelector('a[aria-label*="@"], button[aria-label*="@"]');
                        if (accLink) {
                            const aria = accLink.getAttribute('aria-label') || '';
                            const m = aria.match(/([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,})/);
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

            if not session_info or not session_info.get("email"):
                # Check if we are on flow.google.com/project/... without being redirected to accounts.google.com
                if ("flow.google.com/project/" in page.url or "labs.google/fx/tools/flow/project/" in page.url) and "accounts.google.com" not in page.url:
                    session_info = {"email": "Google Flow Active", "token": None}
                else:
                    _auth_state.update({
                        "authenticated": False,
                        "email": None,
                        "error": "Chưa đăng nhập Google Flow.",
                        "last_checked": time.time(),
                    })
                    return _auth_state

            email = session_info["email"]
            pid = await _extract_or_create_project_id(page)

            api = FlowAPI(bm, project_id=pid or "")
            credits_val = None
            tier_val = None
            if session_info.get("token"):
                api._bearer_token = session_info["token"]
                api._bearer_token_ts = time.time()
                try:
                    c = await api.get_credits()
                    credits_val = c.credits
                    tier_val = c.tier
                except Exception as cred_err:
                    log.debug("Could not fetch credits yet: %s", cred_err)

            if pid:
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
            bm = await _get_or_start_bm(headless=False)
            page = await bm.page()
            pid = active_pid or state.get("project_id") or await _extract_or_create_project_id(page)

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

            from flow._flow_ui import FlowUI
            from flow._models import GenerationMode, AspectRatio

            ui = FlowUI()
            job_entry["progress_text"] = "Đang cấu hình thông số Veo 3.1 trên Google Flow..."

            await ui.open_settings_panel(page)
            mode = GenerationMode.FRAME_TO_VIDEO if start_image_path else GenerationMode.VIDEO
            await ui.switch_mode(page, mode)
            ratio = AspectRatio.PORTRAIT if aspect_mode == "portrait" else AspectRatio.LANDSCAPE
            await ui.set_aspect_ratio(page, ratio)
            await ui.set_count(page, output_count)
            if model_override:
                await ui.set_model_family(page, model_override)

            final_prompt = prompt
            if start_image_path:
                job_entry["progress_text"] = "Đang tải ảnh gốc lên khung Bắt đầu của Google Flow..."
                up_ok = await ui.upload_image(page, str(start_image_path))
                if not up_ok:
                    if "accounts.google.com" in page.url or "signin" in page.url:
                        if current_pool_acc_id:
                            _flag_pool_account_error(current_pool_acc_id, "Phiên đăng nhập hết hạn")
                        job_entry["status"] = "failed"
                        job_entry["error"] = "Google Flow yêu cầu đăng nhập lại tài khoản trên Chrome."
                        return
                    job_entry["status"] = "failed"
                    job_entry["error"] = "Không thể tải ảnh đầu vào lên Google Flow. Vui lòng kiểm tra lại kết nối mạng hoặc thử lại."
                    return
                # Refresh before_srcs after uploading start-frame image so uploaded image is never mistaken for a finished video
                before_srcs = await page.evaluate("""
                    () => [...document.querySelectorAll('img')]
                        .filter(i => i.src && i.src.includes('/asb/') && (
                            (i.alt && (i.alt.includes('video') || i.alt.includes('Video'))) ||
                            (!i.src.includes('-rw') && (!i.alt || !i.alt.includes('hình ảnh')))
                        ))
                        .map(i => i.src)
                """)
                # Enhanced prompt to preserve all characters & subjects from the input frame without cropping/dropping anyone
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

            await ui.fill_prompt(page, final_prompt)

            job_entry["progress_text"] = f"Đang gửi lệnh tạo {output_count} video Veo 3.1..."
            submitted = await ui.click_submit(page)
            if not submitted:
                job_entry["status"] = "failed"
                job_entry["error"] = "Không thể bấm nút Tạo video trên Google Flow."
                return

            log.info("[%s] Clicked submit on Google Flow (before_video_srcs=%d, count=%d)", job_id, len(before_srcs), output_count)

            # Wait up to 320s for the new video thumbnail(s) to finish rendering on the project page
            t0 = time.monotonic()
            max_wait = 320
            new_video_srcs: list[str] = []
            while time.monotonic() - t0 < max_wait:
                await asyncio.sleep(3)
                elapsed = int(time.monotonic() - t0)
                dom_state = await page.evaluate("""
                    (beforeList) => {
                        const pctMatch = document.body.innerText.match(/\\d+%/);
                        const pct = pctMatch ? pctMatch[0] : null;
                        const curImgs = [...document.querySelectorAll('img')]
                            .filter(i => i.src && i.src.includes('/asb/') && (
                                (i.alt && (i.alt.includes('video') || i.alt.includes('Video'))) ||
                                (!i.src.includes('-rw') && (!i.alt || !i.alt.includes('hình ảnh')))
                            ))
                            .map(i => i.src);
                        const newImgs = curImgs.filter(s => !beforeList.includes(s));
                        return { pct, newCount: newImgs.length, newSrcs: newImgs, totalCount: curImgs.length };
                    }
                """, before_srcs)

                pct_str = dom_state.get("pct")
                cur_new_count = dom_state.get("newCount", 0)
                if pct_str:
                    job_entry["progress_text"] = f"Veo 3.1 đang render ({pct_str} • {cur_new_count}/{output_count} video • {elapsed}s)..."
                else:
                    job_entry["progress_text"] = f"Veo 3.1 đang xử lý ({cur_new_count}/{output_count} video • {elapsed}s)..."

                # Completed when new generated video thumbnail(s) are present and no percentage spinner remains
                if cur_new_count >= 1 and not pct_str and elapsed >= 8:
                    new_video_srcs = dom_state.get("newSrcs") or []
                    break

            if not new_video_srcs:
                job_entry["status"] = "failed"
                job_entry["error"] = "Quá thời gian chờ hoặc Google Flow từ chối tạo video."
                return

            targets_to_download = new_video_srcs[:output_count]
            saved_urls: list[str] = []
            total_bytes = 0

            for idx, target_src in enumerate(targets_to_download):
                job_entry["progress_text"] = f"Đang tải file video MP4 ({idx + 1}/{len(targets_to_download)})..."
                suffix = "" if idx == 0 else f"_{idx + 1}"
                out_file = OUTPUT_DIR / f"{job_id}{suffix}.mp4"
                captured_mp4_url: list[str] = []

                async def _on_resp(r, _out_file=out_file, _captured=captured_mp4_url):
                    ct = r.headers.get("content-type", "")
                    if "video/mp4" in ct or "flow-content.google/video/" in r.url:
                        _captured.append(r.url)
                        try:
                            b = await r.body()
                            if len(b) > 10000:
                                _out_file.write_bytes(b)
                                log.info("[%s] Saved MP4 directly from response body (%d bytes)", job_id, len(b))
                        except Exception:
                            pass
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
                                _captured.append(m.group(0))
                        except Exception:
                            pass

                def _sync_resp(r, _fn=_on_resp):
                    try:
                        asyncio.get_running_loop().create_task(_fn(r))
                    except Exception:
                        pass

                page.on("response", _sync_resp)
                try:
                    try:
                        await page.evaluate("() => performance.clearResourceTimings()")
                    except Exception:
                        pass

                    await page.evaluate("""
                        (targetSrc) => {
                            const imgs = [...document.querySelectorAll('img')];
                            const exact = imgs.find(i => i.src === targetSrc);
                            if (exact) {
                                exact.click();
                                return;
                            }
                            const vidImg = imgs.find(i => i.src && i.src.includes('/asb/') && i.alt && (i.alt.includes('video') || i.alt.includes('Video')));
                            if (vidImg) vidImg.click();
                        }
                    """, target_src)

                    for _ in range(16):
                        if captured_mp4_url:
                            break
                        await asyncio.sleep(0.5)

                    if not captured_mp4_url:
                        play_btn = page.locator("button").filter(has_text="play_arrow").first
                        if await play_btn.count() > 0:
                            await play_btn.click()
                            for _ in range(10):
                                if captured_mp4_url:
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

                    if (not out_file.exists() or out_file.stat().st_size == 0) and captured_mp4_url:
                        mp4_url = captured_mp4_url[-1]
                        log.info("[%s] Downloading MP4 #%d from %s", job_id, idx + 1, mp4_url[:100])
                        try:
                            import urllib.request
                            req = urllib.request.Request(mp4_url, headers={"User-Agent": "Mozilla/5.0"})
                            with urllib.request.urlopen(req, timeout=25) as uresp:
                                out_file.write_bytes(uresp.read())
                        except Exception as uerr:
                            log.warning("[%s] urllib failed (%s), trying context.request.get...", job_id, uerr)
                            resp = await bm.context.request.get(mp4_url)
                            if resp.status == 200:
                                out_file.write_bytes(await resp.body())
                finally:
                    page.remove_listener("response", _sync_resp)

                # Navigate back to project page before downloading next video (or finishing)
                try:
                    back_btn = page.locator("button").filter(has_text="arrow_back").first
                    if await back_btn.count() > 0:
                        await back_btn.click()
                        await asyncio.sleep(1.5)
                except Exception:
                    pass

                if out_file.exists() and out_file.stat().st_size > 0:
                    file_url = f"http://localhost:8100/files/{out_file.name}"
                    saved_urls.append(file_url)
                    total_bytes += out_file.stat().st_size

            if not saved_urls:
                job_entry["status"] = "failed"
                job_entry["error"] = "Video đã tạo xong trên Google Flow nhưng chưa tự tải về được."
                return

            job_entry["status"] = "completed"
            job_entry["url"] = saved_urls[0]
            job_entry["urls"] = saved_urls
            job_entry["download_url"] = saved_urls[0]
            job_entry["bytes"] = total_bytes
            job_entry["progress_text"] = "Hoàn tất!"
            log.info("[%s] Completed %d video(s) (%d bytes total)", job_id, len(saved_urls), total_bytes)
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
            job_entry["error"] = str(exc)
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
    bm = await _get_or_start_bm(headless=False)
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
    from flow._storage import is_authenticated

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
        "login_in_progress": _login_in_progress,
        "auth_error": _auth_state["error"],
    }


@app.post("/v1/auth/login")
async def trigger_flow_login():
    """Launch visible Chrome login on the user's real desktop."""
    bat_path = Path(__file__).parent / "login.bat"
    try:
        import os
        os.startfile(str(bat_path))
        log.info("Launched %s via Windows Shell (os.startfile)", bat_path)
    except Exception as e:
        log.warning("Could not launch login.bat: %s", e)
    return {
        "status": "opening_browser",
        "message": "Đã mở cửa sổ đăng nhập Google Flow trên màn hình của bạn!",
    }


@app.post("/v1/auth/cookies")
async def sync_cookies_from_extension(req: CookieSyncRequest):
    """Receive Google & Flow cookies from the user's normal Chrome and inject into Playwright."""
    global _auth_state
    async with _browser_lock:
        bm = await _get_or_start_bm(headless=False)
        # Clear any old mismatched cookies first!
        try:
            await bm.context.clear_cookies()
        except Exception:
            pass

        pw_cookies = []
        cookie_names = []
        if req.cookies:
            raw_list = req.cookies
            for c in raw_list:
                name = str(c.get("name", ""))
                value = c.get("value")
                domain = str(c.get("domain", ".google.com"))
                if not name or value is None:
                    continue
                cookie_names.append(f"{name}@{domain}")
                if name.startswith("__Host-"):
                    target_url = (
                        "https://labs.google/"
                        if "labs.google" in domain
                        else "https://flow.google.com/"
                        if "flow.google" in domain
                        else "https://accounts.google.com/"
                    )
                    item: dict[str, Any] = {
                        "name": name,
                        "value": str(value),
                        "url": target_url,
                        "secure": True,
                        "httpOnly": bool(c.get("httpOnly", True)),
                    }
                else:
                    item = {
                        "name": name,
                        "value": str(value),
                        "domain": domain,
                        "path": str(c.get("path", "/")),
                        "secure": bool(c.get("secure", True)),
                        "httpOnly": bool(c.get("httpOnly", False)),
                    }
                same_site = str(c.get("sameSite", "")).lower()
                if same_site in ("strict", "lax", "none"):
                    item["sameSite"] = same_site.capitalize()
                if c.get("expirationDate"):
                    try:
                        item["expires"] = float(c["expirationDate"])
                    except Exception:
                        pass
                pw_cookies.append(item)

        injected_count = 0
        for ck in pw_cookies:
            try:
                await bm.context.add_cookies([ck])
                injected_count += 1
            except Exception as ck_err:
                log.debug("Skipped cookie %s: %s", ck.get("name"), ck_err)

        log.info("Cleared old cookies & injected %d/%d fresh cookies: %s", injected_count, len(pw_cookies), cookie_names)

        if req.project_id:
            set_active_project(req.project_id, f"https://labs.google/fx/tools/flow/project/{req.project_id}")
            add_project(req.project_id, "chrome-sync", f"https://labs.google/fx/tools/flow/project/{req.project_id}")
        else:
            saved_pid, _ = get_active_project()
            if not saved_pid:
                default_pid = "a589a2fc-8eb7-4b2e-9a39-c6ab11c28444"
                set_active_project(default_pid, f"https://labs.google/fx/tools/flow/project/{default_pid}")
                add_project(default_pid, "default", f"https://labs.google/fx/tools/flow/project/{default_pid}")

    # Mark authenticated immediately if valid Google/Flow cookies were injected
    has_auth_ck = any(
        k in str(cookie_names)
        for k in ("SID", "PSID", "OSID", "SAPISID", "session-token", "__Host-")
    )
    pid = req.project_id or "a589a2fc-8eb7-4b2e-9a39-c6ab11c28444"
    if injected_count > 0 and has_auth_ck:
        _auth_state.update({
            "authenticated": True,
            "email": "Google Flow Connected",
            "project_id": pid,
            "error": None,
            "last_checked": time.time(),
        })
        asyncio.create_task(refresh_auth_state(force_navigate=True))
    else:
        await refresh_auth_state(force_navigate=True)

    return {
        "status": "ok",
        "injected": injected_count,
        "authenticated": _auth_state.get("authenticated"),
        "email": _auth_state.get("email"),
        "project_id": _auth_state.get("project_id"),
        "credits": _auth_state.get("credits"),
    }


@app.post("/v1/auth/project")
async def set_flow_project(req: SetProjectRequest):
    """Manually set the active Google Flow Project ID (or extract from full URL)."""
    raw = req.project_id.strip()
    m = re.search(r"/project/([a-f0-9\-]{8,})", raw)
    pid = m.group(1) if m else raw
    if not pid:
        raise HTTPException(status_code=400, detail="Project ID không hợp lệ.")

    url = f"https://labs.google/fx/tools/flow/project/{pid}"
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
    state = await refresh_auth_state(force_navigate=False)
    bm = await _get_or_start_bm(headless=False)
    page = await bm.page()
    if not state.get("authenticated") or "accounts.google.com" in page.url or "/about" in page.url:
        raise HTTPException(
            status_code=400,
            detail="Trình duyệt Chrome chưa đăng nhập Google Flow! Vui lòng đăng nhập trên cửa sổ Chrome trước khi lưu nick."
        )
    cookies = await bm.context.cookies()
    if not cookies:
        raise HTTPException(status_code=400, detail="Không lấy được Cookie từ trình duyệt hiện tại.")
    pool = _load_accounts_pool()
    acc_id = f"acc_{uuid.uuid4().hex[:8]}"
    acc_label = (label or state.get("email") or f"Tài khoản #{len(pool) + 1}").strip()
    # Replace existing entry if same email/label already exists
    pool = [a for a in pool if a.get("label") != acc_label]
    pool.append({
        "id": acc_id,
        "label": acc_label,
        "cookies": cookies,
        "project_id": state.get("project_id"),
        "enabled": True,
        "added_at": time.time(),
    })
    _save_accounts_pool(pool)
    return {
        "status": "ok",
        "id": acc_id,
        "label": acc_label,
        "count": len(pool),
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
