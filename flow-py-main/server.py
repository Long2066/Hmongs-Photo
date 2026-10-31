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
OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
TEMP_INPUT_DIR.mkdir(parents=True, exist_ok=True)

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

# In-memory job store: job_id -> dict
_jobs: dict[str, dict[str, Any]] = {}


# ── Browser & Session Helpers ─────────────────────────────────────────────────

async def _get_or_start_bm(headless: bool = False) -> BrowserManager:
    """Return the singleton BrowserManager (launches persistent Chrome context)."""
    global _bm
    if _bm is not None and _bm._ctx is not None:
        try:
            if _bm.headless != headless:
                await _bm.stop()
                _bm = None
            else:
                _ = _bm._ctx.pages
                return _bm
        except Exception:
            try:
                await _bm.stop()
            except Exception:
                pass
            _bm = None

    ensure_dirs()
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

    # 3. Look for existing project links in DOM
    try:
        href = await page.evaluate("""
            () => {
                const links = [...document.querySelectorAll('a[href*="/project/"]')];
                return links.length ? links[0].getAttribute('href') : null;
            }
        """)
        if href:
            m2 = re.search(r"/project/([a-f0-9\-]{8,})", href)
            if m2:
                pid = m2.group(1)
                set_active_project(pid, f"https://labs.google/fx/tools/flow/project/{pid}")
                add_project(pid, "auto", f"https://labs.google/fx/tools/flow/project/{pid}")
                return pid
    except Exception:
        pass

    # 4. Try clicking "New project" / "Create project" button if on Flow dashboard
    try:
        clicked = await page.evaluate("""
            () => {
                const btns = [...document.querySelectorAll('button, a')];
                const target = btns.find(b => {
                    const t = (b.textContent || '').toLowerCase();
                    return t.includes('new project') || t.includes('dự án mới') || t.includes('create project') || t.includes('get started');
                });
                if (target) { target.click(); return true; }
                return false;
            }
        """)
        if clicked:
            for _ in range(15):
                await asyncio.sleep(1)
                m3 = re.search(r"/project/([a-f0-9\-]{8,})", page.url)
                if m3:
                    pid = m3.group(1)
                    set_active_project(pid, f"https://labs.google/fx/tools/flow/project/{pid}")
                    add_project(pid, "auto", f"https://labs.google/fx/tools/flow/project/{pid}")
                    return pid
    except Exception:
        pass

    return None


async def refresh_auth_state(force_navigate: bool = False) -> dict[str, Any]:
    """Check if the browser profile is logged in to Google Flow and refresh credits/project."""
    global _auth_state, _client
    async with _browser_lock:
        try:
            bm = await _get_or_start_bm(headless=False)
            page = await bm.page()

            if force_navigate or ("labs.google" not in page.url and "flow.google" not in page.url and "accounts.google" not in page.url):
                saved_pid, _ = get_active_project()
                target_url = (
                    f"https://labs.google/fx/tools/flow/project/{saved_pid}"
                    if saved_pid
                    else FLOW_BASE_URL
                )
                try:
                    await page.goto(target_url, wait_until="domcontentloaded", timeout=25000)
                    await asyncio.sleep(2)
                except Exception as nav_err:
                    log.warning("Navigation warning: %s", nav_err)

            cur_url = page.url
            if "accounts.google.com" in cur_url:
                _auth_state.update({
                    "authenticated": False,
                    "email": None,
                    "error": "Chưa đăng nhập Google Flow. Hãy bấm nút 'Đăng nhập Google Flow' trên giao diện.",
                    "last_checked": time.time(),
                })
                return _auth_state

            # Check session via __NEXT_DATA__ or /fx/api/auth/session
            session_info = await page.evaluate("""
                async () => {
                    try {
                        const nd = window.__NEXT_DATA__?.props?.pageProps?.session;
                        if (nd?.user?.email) {
                            return { email: nd.user.email, token: nd.access_token || null };
                        }
                        const r = await fetch('/fx/api/auth/session', { credentials: 'include' });
                        if (r.ok) {
                            const data = await r.json();
                            if (data?.user?.email) {
                                return { email: data.user.email, token: data.access_token || null };
                            }
                        }
                    } catch (e) {}
                    return null;
                }
            """)

            if not session_info or not session_info.get("email"):
                _auth_state.update({
                    "authenticated": False,
                    "email": None,
                    "error": "Chưa đăng nhập Google Flow trên trình duyệt.",
                    "last_checked": time.time(),
                })
                return _auth_state

            email = session_info["email"]
            pid = await _extract_or_create_project_id(page)

            api = FlowAPI(bm, project_id=pid or "")
            if session_info.get("token"):
                api._bearer_token = session_info["token"]
                api._bearer_token_ts = time.time()

            credits_val = None
            tier_val = None
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
):
    """Execute Flow video generation (UI click interceptor -> fallback direct API) and download MP4."""
    job_entry = _jobs[job_id]
    job_entry["status"] = "processing"
    job_entry["progress_text"] = "Đang chuẩn bị trình duyệt Google Flow..."

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
    api_aspect = VIDEO_AR_PORTRAIT if aspect_mode == "portrait" else VIDEO_AR_LANDSCAPE

    try:
        # Ensure authenticated & project initialized
        state = await refresh_auth_state(force_navigate=False)
        if not state.get("authenticated"):
            job_entry["status"] = "failed"
            job_entry["error"] = (
                "Chưa đăng nhập tài khoản Google trên Google Flow. "
                "Vui lòng bấm nút 'Đăng nhập Google Flow' ở cột bên trái để đăng nhập 1 lần."
            )
            return

        async with _browser_lock:
            bm = await _get_or_start_bm(headless=False)
            page = await bm.page()
            pid = state.get("project_id") or await _extract_or_create_project_id(page)

            if not pid:
                # Navigate to Flow home and try creating a project
                await page.goto(FLOW_BASE_URL, wait_until="domcontentloaded", timeout=25000)
                await asyncio.sleep(3)
                pid = await _extract_or_create_project_id(page)

            if not pid:
                job_entry["status"] = "failed"
                job_entry["error"] = (
                    "Chưa tìm thấy Project trong Google Flow. "
                    "Hãy bấm 'New project' trên cửa sổ Google Flow hoặc nhập Project ID."
                )
                return

            client = FlowClient(FlowAPI(bm, project_id=pid), bm, pid)
            job_entry["progress_text"] = "Đang gửi lệnh tạo video Veo 3.1 qua Google Flow..."

            video_job = None
            # Strategy 1: Full UI automation + reCAPTCHA Enterprise click interception
            try:
                jobs = await client.generate_video(
                    prompt=prompt,
                    model=model_override or "Veo 3.1 - Fast",
                    aspect=aspect_mode,
                    count=1,
                    start_image=str(start_image_path) if start_image_path else None,
                    timeout_s=90,
                )
                if jobs:
                    video_job = jobs[0]
            except Exception as ui_err:
                log.warning("[%s] UI automation fallback triggered (%s), trying direct FlowAPI...", job_id, ui_err)
                # Strategy 2: Direct REST API call with page grecaptcha.enterprise.execute
                api = client._api
                if start_image_path:
                    media_uuid = await api.upload_image(start_image_path)
                    i2v_model = (
                        VIDEO_MODEL_VEO31_I2V_P
                        if aspect_mode == "portrait"
                        else VIDEO_MODEL_VEO31_I2V
                    )
                    video_job = await api.generate_video_from_image(
                        prompt=prompt,
                        start_media_name=media_uuid,
                        model=i2v_model,
                        aspect_ratio=api_aspect,
                    )
                else:
                    t2v_model = (
                        VIDEO_MODEL_VEO31_FAST_P
                        if aspect_mode == "portrait"
                        else VIDEO_MODEL_VEO31_FAST
                    )
                    video_job = await api.generate_video(
                        prompt=prompt,
                        model=t2v_model,
                        aspect_ratio=api_aspect,
                    )

            if not video_job or not video_job.media_name:
                job_entry["status"] = "failed"
                job_entry["error"] = "Google Flow không trả về mã Media ID cho video."
                return

            media_name = video_job.media_name
            job_entry["media_name"] = media_name
            job_entry["project_id"] = pid
            job_entry["progress_text"] = f"Đã gửi thành công (ID: {media_name[:8]}). Veo 3.1 đang render..."
            log.info("[%s] Submitted Flow video media_name=%s", job_id, media_name)

        # Polling outside the browser lock (direct API poll is lightweight)
        t0 = time.monotonic()
        max_wait = 600  # 10 minutes
        while True:
            elapsed = time.monotonic() - t0
            if elapsed > max_wait:
                job_entry["status"] = "failed"
                job_entry["error"] = "Quá thời gian chờ render video từ Google Flow (Timeout 10 phút)."
                return

            await asyncio.sleep(5)
            async with _browser_lock:
                bm = await _get_or_start_bm(headless=False)
                api = FlowAPI(bm, project_id=pid)
                status = await api.poll_video(media_name, project_id=pid)

            job_entry["raw_status"] = status.status
            job_entry["progress_text"] = f"Veo 3.1 đang render ({int(elapsed)}s) • {status.status}"

            if status.complete:
                if not status.fife_url:
                    job_entry["status"] = "failed"
                    job_entry["error"] = "Video đã hoàn tất nhưng không có URL tải về."
                    return

                out_file = OUTPUT_DIR / f"{job_id}.mp4"
                async with _browser_lock:
                    bm = await _get_or_start_bm(headless=False)
                    api = FlowAPI(bm, project_id=pid)
                    await api.download(status.fife_url, out_file)

                file_bytes = out_file.stat().st_size if out_file.exists() else 0
                job_entry["status"] = "completed"
                job_entry["url"] = f"http://localhost:8100/files/{job_id}.mp4"
                job_entry["download_url"] = job_entry["url"]
                job_entry["fife_url"] = status.fife_url
                job_entry["bytes"] = file_bytes
                job_entry["progress_text"] = "Hoàn tất!"
                log.info("[%s] Video completed & saved (%d bytes) -> %s", job_id, file_bytes, out_file)
                return

            if status.failed:
                job_entry["status"] = "failed"
                job_entry["error"] = (
                    f"Google Flow từ chối hoặc lỗi tạo video ({status.status}). "
                    "Hãy thử đổi mô tả kịch bản hoặc ảnh khác."
                )
                return

    except Exception as exc:
        log.exception("[%s] Video generation failed:", job_id)
        job_entry["status"] = "failed"
        job_entry["error"] = str(exc)
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


@app.get("/health")
async def health_check(refresh: bool = False):
    """Health check endpoint polled by ToolMedia VideoPanel.
    Does NOT auto-launch browser on passive polls unless refresh=True or already logged in.
    """
    from flow._storage import is_authenticated

    now = time.time()
    if refresh or (_bm is not None and now - _auth_state["last_checked"] > 15 and not _login_in_progress):
        await refresh_auth_state(force_navigate=False)
    elif _bm is None and is_authenticated() and _auth_state["last_checked"] == 0.0:
        await refresh_auth_state(force_navigate=False)

    return {
        "status": "ok",
        "engine": "flow-py",
        "backend_mode": "flow-py (Veo 3.1)",
        "active_backend": "labs.google/fx/tools/flow",
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
    """Ensure local Playwright browser is ready and trigger cookie sync."""
    global _login_in_progress, _ext_reload_done
    _ext_reload_done = False  # Trigger extension reload & cookie sync

    async def _prepare_flow():
        global _login_in_progress
        _login_in_progress = True
        try:
            async with _browser_lock:
                bm = await _get_or_start_bm(headless=False)
                # Inject existing PSID/PSIDTS from .env if available
                psid = os.environ.get("GEMINI_1PSID") or "g.a000DQlMgYC_D4t29VPTlw98-HOZxmdYZpX7uXfLLp1yu6aga1RcmruPhcXIbBfHOhUJyGz8HQACgYKAVoSARYSFQHGX2Mi17xekZ-Tfr3wae8pj7fKRBoVAUF8yKos_o82raucnhngKp8a6E1p0076"
                psidts = os.environ.get("GEMINI_1PSIDTS") or "sidts-CjYBnJZzaon7jTH8FkDQkptukXMpxvAdvnHb-tWCSTtGmxvPkxINYS5FEpHbCkZzDY_EP0nSehkQAA"
                try:
                    await bm.context.add_cookies([
                        {"name": "__Secure-1PSID", "value": psid, "domain": ".google.com", "path": "/", "secure": True, "httpOnly": True},
                        {"name": "__Secure-1PSIDTS", "value": psidts, "domain": ".google.com", "path": "/", "secure": True, "httpOnly": True},
                    ])
                except Exception:
                    pass
            await refresh_auth_state(force_navigate=True)
        except Exception as e:
            log.error("Login preparation error: %s", e)
        finally:
            _login_in_progress = False

    asyncio.create_task(_prepare_flow())

    return {
        "status": "opening_browser",
        "message": "Đã mở tab Google Flow trên Chrome của bạn!",
    }


@app.post("/v1/auth/cookies")
async def sync_cookies_from_extension(req: CookieSyncRequest):
    """Receive Google & labs.google cookies from the user's normal Chrome and inject into Playwright."""
    global _auth_state
    async with _browser_lock:
        bm = await _get_or_start_bm(headless=False)
        pw_cookies = []
        for c in req.cookies:
            name = c.get("name")
            value = c.get("value")
            domain = c.get("domain", ".google.com")
            if not name or value is None:
                continue
            item: dict[str, Any] = {
                "name": str(name),
                "value": str(value),
                "domain": str(domain),
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

        if pw_cookies:
            await bm.context.add_cookies(pw_cookies)
            log.info("Injected %d cookies from user's Chrome into Flow Playwright context", len(pw_cookies))

        if req.project_id:
            set_active_project(req.project_id, f"https://labs.google/fx/tools/flow/project/{req.project_id}")
            add_project(req.project_id, "chrome-sync", f"https://labs.google/fx/tools/flow/project/{req.project_id}")

    state = await refresh_auth_state(force_navigate=True)
    return {
        "status": "ok",
        "injected": len(pw_cookies),
        "authenticated": state.get("authenticated"),
        "email": state.get("email"),
        "project_id": state.get("project_id"),
        "credits": state.get("credits"),
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
        "error": None,
    }

    asyncio.create_task(
        _run_video_generation_job(
            job_id=job_id,
            prompt=req.prompt.strip(),
            aspect_ratio=req.aspect_ratio,
            images=req.images,
            model_override=req.model,
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
