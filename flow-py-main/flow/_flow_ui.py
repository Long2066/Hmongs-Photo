"""High-level UI interaction helpers for Google Flow AI.

Covers both the PROJECT page (prompt/settings/submit) and the EDIT page
(extend, camera, insert, remove, upscale, download).

Key insight: Flow has NO mode tabs on the project page. Instead, clicking
the model selector pill opens a settings panel with Image/Video/Aspect/Count.

Edit page layout (from live DOM inspection):
  - Extend / Insert / Remove / Camera buttons across the bottom toolbar
  - Create button submits each operation
  - Download button in top-right corner
  - Model selector dropdown in toolbar
"""
from __future__ import annotations

import asyncio
import logging
from typing import Optional

from ._models import AspectRatio, GenerationMode

log = logging.getLogger(__name__)

# Text found on mode buttons after opening the settings panel
_MODE_BUTTON_TEXT = {
    GenerationMode.IMAGE: ["Image", "imageImage"],
    GenerationMode.VIDEO: ["Video", "videocamVideo"],
    GenerationMode.FRAME_TO_VIDEO: ["Video", "videocamVideo"],
}

# Aspect ratio button texts in the settings panel
_ASPECT_BUTTON_TEXT = {
    AspectRatio.LANDSCAPE: ["Landscape", "crop_16_9Landscape"],
    AspectRatio.PORTRAIT:  ["Portrait",  "crop_9_16Portrait"],
    AspectRatio.SQUARE:    ["Square",    "crop_1_1Square"],
}

# Count button texts
_COUNT_BUTTON_TEXT = {"1": "x1", "2": "x2", "3": "x3", "4": "x4"}

# The settings panel trigger: the model selector pill
# Project page bottom bar shows "Video □ x1" or model name like "Nano Banana 2 … x2"
_SETTINGS_PILL_TEXTS = ["Nano Banana", "Veo", "Imagen", "\U0001f34c", "Video", "Image"]


class FlowUI:
    """Knows the exact selector patterns for labs.google/fx/tools/flow."""

    # ==================================================================
    # PROJECT PAGE — Navigation / Settings / Prompt / Submit
    # ==================================================================

    async def navigate_to_project(self, page, project_url: str) -> None:
        if project_url.rstrip("/") in page.url:
            return
        await page.goto(project_url, wait_until="domcontentloaded", timeout=30_000)
        await asyncio.sleep(2)

    async def navigate_to_edit(self, page, project_id: str, workflow_id: str) -> None:
        """Navigate to the edit view for a specific workflow."""
        url = f"https://labs.google/fx/tools/flow/project/{project_id}/edit/{workflow_id}"
        if url.rstrip("/") in page.url:
            return
        await page.goto(url, wait_until="domcontentloaded", timeout=30_000)
        await asyncio.sleep(2)

    # ------------------------------------------------------------------
    # Settings panel
    # ------------------------------------------------------------------

    async def open_settings_panel(self, page) -> bool:
        """Open the generation settings panel (Image/Video mode, aspect, count)."""
        try:
            await page.wait_for_selector('button', timeout=8000)
        except Exception:
            pass
        await asyncio.sleep(0.5)

        if await self._settings_visible(page):
            return True

        # Strategy 0: Playwright locator for settings trigger pill (works in both English & Vietnamese)
        for sel in [
            'button[aria-label="Điều kiện kích hoạt cài đặt"]',
            'button[aria-label*="kích hoạt cài đặt" i]',
            'button[aria-label*="setting" i]',
            'button:has-text("Nano Banana")',
            'button:has-text("Veo")',
            'button:has-text("Omni")',
            'button:has-text("x1")',
            'button:has-text("x2")',
        ]:
            loc = page.locator(sel).last
            if await loc.count() > 0:
                try:
                    await loc.click(timeout=3000)
                    await asyncio.sleep(0.8)
                    if await self._settings_visible(page):
                        log.debug("Settings panel opened via selector '%s'", sel)
                        return True
                except Exception:
                    continue

        # Strategy 1: click by known pill text fragments
        for text in _SETTINGS_PILL_TEXTS:
            clicked = await page.evaluate(f"""
                () => {{
                    const btns = [...document.querySelectorAll('button')];
                    const b = btns.find(btn => btn.textContent.includes('{text}'));
                    if (b) {{ b.click(); return true; }}
                    return false;
                }}
            """)
            if clicked:
                await asyncio.sleep(0.8)
                if await self._settings_visible(page):
                    log.debug("Settings panel opened via text '%s'", text)
                    return True

        log.warning("Could not open settings panel (no pill found)")
        return False

    async def _settings_visible(self, page) -> bool:
        """Check if the generation mode/aspect/count controls are visible (settings panel open)."""
        count = await page.evaluate("""
            () => {
                const radios = [...document.querySelectorAll('[role=tab], button[role=radio]')];
                return radios.filter(r => {
                    const t = (r.textContent || '');
                    return t.includes('16:9') || t.includes('9:16') || t.includes('x1') || t.includes('Khung hình') || t.includes('Landscape');
                }).length;
            }
        """)
        return int(count or 0) > 0

    # ------------------------------------------------------------------
    # Mode switching
    # ------------------------------------------------------------------

    async def switch_mode(self, page, mode: GenerationMode) -> bool:
        await self.open_settings_panel(page)
        # First ensure Video radio is selected for both VIDEO and FRAME_TO_VIDEO
        if mode in (GenerationMode.VIDEO, GenerationMode.FRAME_TO_VIDEO):
            vid_radio = page.locator("button[role='radio'], [role='tab']").filter(has_text="Video").first
            if await vid_radio.count() > 0:
                try:
                    await vid_radio.click()
                    await asyncio.sleep(0.3)
                except Exception:
                    pass
        label_map = {
            GenerationMode.IMAGE:          ["Hình ảnh", "Image", "image"],
            GenerationMode.VIDEO:          ["Khung hình", "Frames", "Video", "videocam"],
            GenerationMode.FRAME_TO_VIDEO: ["Khung hình", "Frames", "crop_free", "Video"],
        }
        for label in label_map.get(mode, []):
            loc = page.locator("button[role='radio'], [role='tab']").filter(has_text=label).first
            if await loc.count() > 0:
                await loc.click()
                await asyncio.sleep(0.4)
                return True
        log.warning("Could not find mode tab for %s", mode.value)
        return False

    # ------------------------------------------------------------------
    # Aspect ratio
    # ------------------------------------------------------------------

    async def set_aspect_ratio(self, page, ratio: AspectRatio) -> bool:
        await self.open_settings_panel(page)
        label_map = {
            AspectRatio.LANDSCAPE: ["16:9", "Landscape", "crop_16_9"],
            AspectRatio.PORTRAIT:  ["9:16", "Portrait",  "crop_9_16"],
            AspectRatio.SQUARE:    ["1:1",  "Square",    "crop_1_1"],
        }
        for label in label_map.get(ratio, []):
            loc = page.locator("button[role='radio'], [role='tab']").filter(has_text=label).first
            if await loc.count() > 0:
                await loc.click()
                await asyncio.sleep(0.3)
                return True
        log.warning("Could not find aspect ratio tab for %s", ratio.value)
        return False

    # ------------------------------------------------------------------
    # Count & Model family
    # ------------------------------------------------------------------

    async def set_count(self, page, count: int) -> bool:
        await self.open_settings_panel(page)
        count = max(1, min(4, count))
        label = f"x{count}"
        loc = page.locator("button[role='radio'], [role='tab']").filter(has_text=label).first
        if await loc.count() > 0:
            await loc.click()
            await asyncio.sleep(0.3)
            return True
        log.warning("Could not set count to %d", count)
        return False

    async def set_model_family(self, page, model_label: str) -> bool:
        """Select the model family inside the generation settings popover."""
        if not model_label or model_label == "auto":
            return True
        await self.open_settings_panel(page)
        dropdown = page.locator(
            'button[aria-label="Chọn nhóm mô hình"], '
            'button[aria-label*="model" i], '
            'button:has-text("arrow_drop_down")'
        ).last
        if await dropdown.count() > 0:
            try:
                cur_text = (await dropdown.text_content() or "").strip()
                if model_label.lower() in cur_text.lower():
                    return True
                await dropdown.click(timeout=3000)
                await asyncio.sleep(0.5)
                opt = page.locator("button, [role='menuitem'], [role='option']").filter(has_text=model_label).last
                if await opt.count() > 0:
                    await opt.click(timeout=2500)
                    await asyncio.sleep(0.4)
                    return True
            except Exception as e:
                log.warning("Could not select model family '%s': %s", model_label, e)
        return False

    # ------------------------------------------------------------------
    # Prompt input
    # ------------------------------------------------------------------

    async def fill_prompt(self, page, prompt: str) -> bool:
        try:
            await page.keyboard.press("Escape")
            await asyncio.sleep(0.3)
            await page.keyboard.press("Escape")
            await asyncio.sleep(0.2)
        except Exception:
            pass

        els = page.locator("div[contenteditable]")
        count = await els.count()
        for i in range(count):
            el = els.nth(i)
            visible = await el.evaluate(
                "el => el.offsetWidth > 0 && el.offsetHeight > 0 && el.getBoundingClientRect().y > 100"
            )
            if not visible:
                continue
            await el.scroll_into_view_if_needed()
            await asyncio.sleep(0.2)
            await el.click()
            await asyncio.sleep(0.3)
            focused_tag = await page.evaluate(
                "() => document.activeElement.tagName + '|' + document.activeElement.contentEditable"
            )
            if "true" not in focused_tag.lower():
                continue
            await page.keyboard.press("Meta+a")
            await page.keyboard.press("Control+a")
            await asyncio.sleep(0.1)
            await page.keyboard.type(prompt, delay=15)
            await asyncio.sleep(0.2)
            content = await el.text_content()
            if prompt[:10] in (content or ""):
                return True
        log.warning("Could not fill prompt input")
        return False

    # ------------------------------------------------------------------
    # Submit (project page Create button)
    # ------------------------------------------------------------------

    async def click_submit(self, page) -> bool:
        for sel in [
            'button[aria-label*="Bắt đầu tạo" i]',
            'button:has-text("arrow_forward")',
            'button:has-text("Create")',
            'button:has-text("Tạo")',
        ]:
            btn = page.locator(sel).last
            if await btn.count() > 0:
                try:
                    await btn.click(timeout=3000)
                    return True
                except Exception:
                    continue
        log.warning("Could not find submit button")
        return False

    # ------------------------------------------------------------------
    # Image upload (for Frame-to-Video)
    # ------------------------------------------------------------------

    async def upload_image(self, page, image_path: str) -> bool:
        """Upload a start frame image on Google Flow (Vietnamese & English Boq UI)."""
        import os as _os
        filename = _os.path.basename(image_path)

        # 0. Ensure page has loaded its elements
        try:
            await page.wait_for_selector('button', timeout=15000)
            await asyncio.sleep(1.0)
        except Exception:
            pass

        # CRITICAL: Google Flow defaults to Text mode. We MUST switch mode to "Khung hình" (Frames)
        # so that the Start-frame ("Bắt đầu" / "Start") slot is rendered on the UI!
        try:
            await self.switch_mode(page, GenerationMode.FRAME_TO_VIDEO)
            await asyncio.sleep(0.8)
        except Exception as sm_err:
            log.warning("Could not switch to FRAME_TO_VIDEO mode: %s", sm_err)

        # Ensure settings panel is closed first so "Bắt đầu" is unobstructed
        try:
            await page.keyboard.press("Escape")
            await asyncio.sleep(0.4)
            await page.keyboard.press("Escape")
            await asyncio.sleep(0.3)
        except Exception:
            pass

        # Remove any existing start-frame attachment ("Thành phần tạo hình ảnh") first
        old_start = page.locator('button[aria-label*="Thành phần tạo hình ảnh" i]').first
        if await old_start.count() > 0:
            try:
                await old_start.click(timeout=2000)
                await asyncio.sleep(0.5)
            except Exception:
                pass

        # Global file chooser listener to intercept whichever button triggers file dialog
        fc_list = []
        def _on_file_chooser(fc):
            fc_list.append(fc)
        page.on("filechooser", _on_file_chooser)

        # 1. Open the Start-frame ("Bắt đầu" / "Start") picker
        picker_sel = (
            'button:has-text("uploadTải nội dung"), '
            'button:has-text("Tải nội dung nghe nhìn lên"), '
            'button:has-text("Tải nội dung"), '
            'button:has-text("Tải tệp lên"), '
            'button:has-text("Tải ảnh lên"), '
            'button:has-text("Tải lên"), '
            'button:has-text("Upload media"), '
            'button:has-text("Upload file"), '
            'button:has-text("Upload image"), '
            'button:has-text("Upload"), '
            'button[aria-label*="Tải" i], '
            'button[aria-label*="Upload" i], '
            'button:has-text("cloud_upload"), '
            'button:has-text("upload")'
        )

        start_triggers = [
            'button:has-text("Bắt đầu"):not([aria-label*="tạo"]):not([aria-label*="Create"])',
            'button:has-text("Start"):not([aria-label*="tạo"]):not([aria-label*="Create"])',
            'button[aria-label*="Bắt đầu" i]:not([aria-label*="tạo"])',
            'button[aria-label*="Start" i]:not([aria-label*="Create"])',
            'button[aria-label*="khung hình" i]',
            'button[aria-label*="Thêm thành phần" i]',
            'button[aria-label*="Thêm phương tiện" i]',
            'button[aria-label*="Thêm hình ảnh" i]',
            'button[aria-label*="Thêm ảnh" i]',
            'button[aria-label*="Add media" i]',
            'button[aria-label*="Add image" i]',
            'button:has-text("Add Media")',
            '[data-testid*="start-frame"]',
            '[data-testid*="startFrame"]',
            'button:has([data-icon="add"])',
            'button:has-text("add_photo_alternate")',
            'button:has-text("add")',
            'div[class*="start-frame"] button',
            'div[class*="startFrame"] button',
        ]

        for attempt in range(4):
            if await page.locator(picker_sel).count() > 0 or fc_list:
                break
            for trigger_sel in start_triggers:
                trig = page.locator(trigger_sel).first
                if await trig.count() > 0:
                    try:
                        await trig.click(timeout=3000)
                        await asyncio.sleep(1.0)
                        if fc_list or await page.locator(picker_sel).count() > 0:
                            break
                    except Exception:
                        continue
            # Also try JS click fallback on "Bắt đầu" / "Start"
            if await page.locator(picker_sel).count() == 0 and not fc_list:
                await page.evaluate("""
                    () => {
                        const btns = [...document.querySelectorAll('button, [role=button]')];
                        const btn = btns.find(b => {
                            const t = (b.textContent || '').trim();
                            const aria = (b.getAttribute('aria-label') || '').trim();
                            return (t === 'Bắt đầu' || t === 'Start' || aria.includes('Bắt đầu') || aria.includes('Start') || aria.includes('khung hình'));
                        });
                        if (btn) btn.click();
                    }
                """)
                await asyncio.sleep(1.0)

        # 2. If a file chooser was already triggered by clicking the trigger button
        if fc_list:
            try:
                await fc_list[-1].set_files(image_path)
                log.info("File uploaded via eager filechooser event")
            except Exception as fc_err:
                log.warning("Eager file chooser set_files failed: %s", fc_err)
        else:
            # Click the upload button in the picker
            picker_btn = page.locator(picker_sel).last
            if await picker_btn.count() > 0:
                try:
                    async with page.expect_file_chooser(timeout=8000) as fc_info:
                        await picker_btn.click(timeout=4000)
                    fc = await fc_info.value
                    await fc.set_files(image_path)
                except Exception as e:
                    if fc_list:
                        await fc_list[-1].set_files(image_path)
                    else:
                        log.warning("File chooser upload failed: %s", e)
            else:
                file_input = page.locator("input[type='file']").first
                if await file_input.count() > 0:
                    await file_input.set_input_files(image_path)
                else:
                    # Final attempt: inject temporary file input and dispatch change
                    log.warning("Could not find upload button or file input; attempting DOM input fallback")
                    try:
                        await page.evaluate("""
                            () => {
                                let inp = document.querySelector('input[type=file]');
                                if (!inp) {
                                    inp = document.createElement('input');
                                    inp.type = 'file';
                                    inp.id = 'flow-temp-file-input';
                                    inp.style.display = 'none';
                                    document.body.appendChild(inp);
                                }
                            }
                        """)
                        inp = page.locator('#flow-temp-file-input').first
                        if await inp.count() > 0:
                            await inp.set_input_files(image_path)
                            await inp.evaluate("el => el.dispatchEvent(new Event('change', { bubbles: true }))")
                    except Exception as inj_err:
                        log.debug("Fallback input injection notice: %s", inj_err)
                        return False

        # 3. Wait for the image upload to register and finish ("Đang tải lên" disappears)
        await asyncio.sleep(2.0)
        for _ in range(30):
            uploading = await page.evaluate("""
                () => document.body.innerText.includes('Đang tải lên') ||
                      document.body.innerText.includes('Uploading')
            """)
            if not uploading:
                break
            await asyncio.sleep(1.0)

        await asyncio.sleep(1.5)

        # 4. Ensure the uploaded image is firmly attached into the Start-frame ("Bắt đầu") slot!
        attached = False
        for attempt in range(12):
            # Check if start-frame thumbnail is already attached
            attached = await page.evaluate("""
                () => {
                    const btn = document.querySelector('button[aria-label*="Thành phần tạo hình ảnh" i]');
                    if (btn) return true;
                    // Check if there is an image inside the prompt start-frame area
                    const startSlot = document.querySelector('[class*="start-frame"], [class*="startFrame"], [data-testid*="start-frame"]');
                    if (startSlot && startSlot.querySelector('img')) return true;
                    // Check any img with preview in the bottom dock/prompt
                    const dockImgs = document.querySelectorAll('footer img, div[class*="prompt"] img, div[class*="dock"] img, div[class*="input"] img');
                    return dockImgs.length > 0;
                }
            """)
            if attached:
                log.info("Image attachment confirmed in prompt bar on attempt %d", attempt)
                break

            # If not attached, look for "Thêm vào câu lệnh" / "Add to prompt" button
            add_to_prompt = page.locator('button:has-text("Thêm vào câu lệnh"), button:has-text("Add to prompt")').last
            if await add_to_prompt.count() > 0:
                try:
                    if not await add_to_prompt.is_disabled():
                        await add_to_prompt.click(timeout=2000)
                        await asyncio.sleep(1.5)
                        continue
                except Exception:
                    pass

            # Or re-open "Bắt đầu" if popover closed
            if await page.locator('[role="option"]').count() == 0:
                start_btn = page.locator('button:has-text("Bắt đầu"):not([aria-label*="tạo"]), button:has-text("Start")').first
                if await start_btn.count() > 0:
                    try:
                        await start_btn.click(timeout=3000)
                        await asyncio.sleep(1.0)
                    except Exception:
                        pass

            # Click option matching filename or first option
            target_opt = page.locator(f'[role="option"]:has-text("{filename}")').first
            if await target_opt.count() == 0:
                target_opt = page.locator('[role="option"]').first
            if await target_opt.count() > 0:
                try:
                    await target_opt.click(timeout=2500)
                    await asyncio.sleep(1.0)
                except Exception:
                    pass

            # Try clicking add to prompt again
            add_btn = page.locator('button:has-text("Thêm vào câu lệnh"), button:has-text("Add to prompt")').last
            if await add_btn.count() > 0:
                try:
                    if not await add_btn.is_disabled():
                        await add_btn.click(timeout=2000)
                        await asyncio.sleep(1.5)
                except Exception:
                    pass

            await asyncio.sleep(1.0)

        # Settle wait to ensure Angular finishes binding
        await asyncio.sleep(2.0)
        log.info("Uploaded & attached start-frame image (attached=%s): %s", attached, image_path)
        return True

    # ------------------------------------------------------------------
    # Gallery & media extraction (project page)
    # ------------------------------------------------------------------

    async def count_gallery_items(self, page) -> int:
        count = await page.evaluate("""
            () => document.querySelectorAll(
                'img[src*="getMediaUrlRedirect"], video[src*="getMediaUrlRedirect"]'
            ).length
        """)
        return count or 0

    async def check_policy_error(self, page) -> bool:
        policy_strings = [
            "violates our policy", "content policy", "harmful or unsafe",
            "unable to generate", "request was flagged", "couldn't generate",
        ]
        body = await page.evaluate("() => document.body.innerText")
        body_lower = body.lower()
        return any(s in body_lower for s in policy_strings)

    async def get_newest_media_src(self, page) -> Optional[str]:
        src = await page.evaluate("""
            () => {
                const imgs = [...document.querySelectorAll('img[src*="getMediaUrlRedirect"]')];
                const vids = [...document.querySelectorAll('video[src*="getMediaUrlRedirect"]')];
                const all = [...imgs, ...vids];
                if (!all.length) return null;
                return all[all.length - 1].src || all[all.length - 1].currentSrc;
            }
        """)
        return src or None

    async def get_all_media_srcs(self, page) -> list[str]:
        srcs = await page.evaluate("""
            () => {
                const imgs = [...document.querySelectorAll('img[src*="getMediaUrlRedirect"]')];
                const vids = [...document.querySelectorAll('video[src*="getMediaUrlRedirect"]')];
                return [...imgs, ...vids].map(el => el.src || el.currentSrc).filter(Boolean);
            }
        """)
        return srcs or []

    async def wait_for_generation_complete(
        self, page, before_count: int, timeout_s: int = 300, poll_interval: float = 2.0,
    ) -> bool:
        import time as _time
        deadline = _time.monotonic() + timeout_s
        while _time.monotonic() < deadline:
            if await self.check_policy_error(page):
                return False
            count = await self.count_gallery_items(page)
            if count > before_count:
                break
            await asyncio.sleep(poll_interval)
        else:
            return False
        while _time.monotonic() < deadline:
            src = await self.get_newest_media_src(page)
            if src:
                return True
            await asyncio.sleep(poll_interval)
        return False

    # ==================================================================
    # EDIT PAGE — Extend / Camera / Insert / Remove / Upscale / Download
    # ==================================================================

    async def _click_button_with_text(self, page, texts: list[str], timeout: float = 5) -> bool:
        """Try to click a button matching any of the given text patterns."""
        for text in texts:
            btn = page.locator("button").filter(has_text=text).first
            if await btn.count() > 0:
                try:
                    await btn.click(timeout=timeout * 1000)
                    await asyncio.sleep(0.5)
                    return True
                except Exception:
                    continue
        # JS fallback: find button containing text (escape single quotes)
        for text in texts:
            safe_text = text.replace("'", "\\'")
            clicked = await page.evaluate(f"""
                () => {{
                    const btns = [...document.querySelectorAll('button')];
                    const btn = btns.find(b => b.textContent.includes('{safe_text}') && !b.disabled);
                    if (btn) {{ btn.click(); return true; }}
                    return false;
                }}
            """)
            if clicked:
                await asyncio.sleep(0.5)
                return True
        return False

    # ------------------------------------------------------------------
    # Click a video in the project grid to open edit view
    # ------------------------------------------------------------------

    async def click_video_in_grid(self, page, index: int = 0) -> bool:
        """Click a video/image in the project gallery grid.

        After clicking, the page navigates to the edit view.
        """
        clicked = await page.evaluate(f"""
            () => {{
                const items = document.querySelectorAll(
                    'img[src*="getMediaUrlRedirect"], video[src*="getMediaUrlRedirect"]'
                );
                if (items.length > {index}) {{
                    items[{index}].click();
                    return true;
                }}
                return false;
            }}
        """)
        if clicked:
            await asyncio.sleep(2)
            return True
        return False

    # ------------------------------------------------------------------
    # Extend
    # ------------------------------------------------------------------

    async def click_extend(self, page) -> bool:
        """Click the Extend button in the edit view toolbar."""
        return await self._click_button_with_text(page, [
            "Extend", "extension", "extend",
        ])

    async def fill_extend_prompt(self, page, prompt: str) -> bool:
        """Fill the extend prompt input in the extend panel."""
        els = page.locator("div[contenteditable], textarea")
        count = await els.count()
        for i in range(count):
            el = els.nth(i)
            visible = await el.evaluate(
                "el => el.offsetWidth > 0 && el.offsetHeight > 0"
            )
            if not visible:
                continue
            await el.click()
            await asyncio.sleep(0.2)
            await page.keyboard.press("Meta+a")
            await page.keyboard.press("Control+a")
            await page.keyboard.type(prompt, delay=15)
            await asyncio.sleep(0.2)
            return True
        return False

    async def click_create_in_panel(self, page) -> bool:
        """Click the Create button inside any edit panel (Extend/Camera/Insert/Remove).

        Edit page has two Create buttons:
          1. Camera Create [~560, ~242] — initially DISABLED, enables after motion selection
          2. Main Create   [~1558, ~1109] — always enabled, also serves as Extend/Insert trigger

        For camera mode: we specifically want the [560, 242] button (first one).
        For extend/insert/remove: we want the [1558, 1109] button (last enabled one).

        Strategy: click the LAST enabled Create button (bottom-right of screen), since
        that's the main action trigger across all modes.
        """
        clicked = await page.evaluate("""
            () => {
                const btns = [...document.querySelectorAll('button')];
                // Find ALL enabled buttons containing 'Create'
                const creates = btns.filter(b =>
                    !b.disabled &&
                    (b.textContent.trim().endsWith('Create') ||
                     b.textContent.trim() === 'Create')
                );
                if (creates.length === 0) return null;
                // Click the last one (the main Create button at bottom-right)
                creates[creates.length - 1].click();
                return creates.length;
            }
        """)
        if clicked:
            await asyncio.sleep(0.4)
            log.debug("Clicked Create button (%s found)", clicked)
            return True
        log.warning("No enabled Create button found in panel")
        return False

    async def click_camera_create(self, page, wait_for_enable: float = 5.0) -> bool:
        """Click the Camera-specific Create button (top area, not bottom toolbar).

        The camera Create is at approximately [560, 242] and is initially DISABLED.
        It becomes enabled after selecting a camera motion or position.

        Waits up to *wait_for_enable* seconds for it to become enabled.
        """
        deadline = asyncio.get_event_loop().time() + wait_for_enable
        while asyncio.get_event_loop().time() < deadline:
            result = await page.evaluate("""
                () => {
                    const btns = [...document.querySelectorAll('button')];
                    // Camera Create is near the top (y < 400) and contains 'Create'
                    const camCreates = btns.filter(b => {
                        const r = b.getBoundingClientRect();
                        return r.top < 400 && r.top > 0 &&
                               b.textContent.trim().endsWith('Create') &&
                               !b.disabled;
                    });
                    if (camCreates.length > 0) {
                        camCreates[0].click();
                        return camCreates[0].getBoundingClientRect().top;
                    }
                    return null;
                }
            """)
            if result is not None:
                log.debug("Clicked camera Create at y~%.0f", result)
                return True
            await asyncio.sleep(0.3)

        # Fallback: just click any enabled Create
        return await self.click_create_in_panel(page)

    # ------------------------------------------------------------------
    # Camera
    # ------------------------------------------------------------------

    async def click_camera(self, page) -> bool:
        """Click the Camera button in the edit view toolbar."""
        return await self._click_button_with_text(page, [
            "Camera", "videocam", "camera",
        ])

    async def select_camera_motion(self, page, motion_label: str) -> bool:
        """Select a camera motion preset by its display label.

        Labels: "Dolly in", "Dolly out", "Orbit left", "Orbit right",
                "Orbit up", "Orbit low", "Dolly in zoom out", "Dolly out zoom in"
        """
        # Click the "Camera motion" tab first
        motion_tab = page.locator("[role='tab']").filter(has_text="motion").first
        if await motion_tab.count() > 0:
            await motion_tab.click()
            await asyncio.sleep(0.3)
        elif await page.locator("button").filter(has_text="Motion").first.count() > 0:
            await page.locator("button").filter(has_text="Motion").first.click()
            await asyncio.sleep(0.3)

        return await self._click_button_with_text(page, [motion_label])

    async def select_camera_position(self, page, position_label: str) -> bool:
        """Select a camera position preset.

        Labels: "Center", "Left", "Right", "High", "Low", "Closer", "Further"
        """
        pos_tab = page.locator("[role='tab']").filter(has_text="osition").first
        if await pos_tab.count() > 0:
            await pos_tab.click()
            await asyncio.sleep(0.3)
        elif await page.locator("button").filter(has_text="Position").first.count() > 0:
            await page.locator("button").filter(has_text="Position").first.click()
            await asyncio.sleep(0.3)

        return await self._click_button_with_text(page, [position_label])

    # ------------------------------------------------------------------
    # Insert object
    # ------------------------------------------------------------------

    async def click_insert(self, page) -> bool:
        """Click the Insert button in the edit view toolbar."""
        return await self._click_button_with_text(page, [
            "Insert", "add_circle", "insert",
        ])

    async def fill_insert_prompt(self, page, prompt: str) -> bool:
        """Fill the insert object prompt."""
        return await self.fill_extend_prompt(page, prompt)

    # ------------------------------------------------------------------
    # Remove object
    # ------------------------------------------------------------------

    async def click_remove(self, page) -> bool:
        """Click the Remove button in the edit view toolbar."""
        return await self._click_button_with_text(page, [
            "Remove", "remove_circle", "remove",
        ])

    async def draw_removal_mask(self, page, x_pct: float, y_pct: float, radius_pct: float = 0.1) -> bool:
        """Draw a removal mask on the video preview at a percentage position.

        Args:
            x_pct: X position as fraction (0.0 = left, 1.0 = right)
            y_pct: Y position as fraction (0.0 = top, 1.0 = bottom)
            radius_pct: Brush radius as fraction of video width
        """
        drawn = await page.evaluate(f"""
            () => {{
                const canvas = document.querySelector('canvas');
                const video = document.querySelector('video');
                const target = canvas || video;
                if (!target) return false;
                const rect = target.getBoundingClientRect();
                const x = rect.left + rect.width * {x_pct};
                const y = rect.top + rect.height * {y_pct};

                const events = ['pointerdown', 'pointermove', 'pointerup'];
                for (const type of events) {{
                    const evt = new PointerEvent(type, {{
                        clientX: x, clientY: y,
                        bubbles: true, cancelable: true,
                        pointerId: 1, pointerType: 'mouse',
                    }});
                    target.dispatchEvent(evt);
                }}
                return true;
            }}
        """)
        if drawn:
            await asyncio.sleep(0.5)
        return drawn or False

    # ------------------------------------------------------------------
    # Download / Upscale
    # ------------------------------------------------------------------

    async def click_download_button(self, page) -> bool:
        """Click the Download button in the edit view (top-right area)."""
        return await self._click_button_with_text(page, [
            "Download", "download", "file_download",
        ])

    async def click_upscale_1080p(self, page) -> bool:
        """Click '1080p Upscaled' in the download dropdown."""
        return await self._click_button_with_text(page, [
            "1080p", "1080p Upscaled", "Upscaled",
        ])

    async def click_upscale_4k(self, page) -> bool:
        """Click '4K Upscaled' in the download dropdown (if available)."""
        return await self._click_button_with_text(page, [
            "4K", "4K Upscaled",
        ])

    # ------------------------------------------------------------------
    # Model selector (edit page)
    # ------------------------------------------------------------------

    async def get_video_model_selector(self, page) -> str:
        """Return the currently displayed model name from the model selector."""
        text = await page.evaluate("""
            () => {
                const btns = [...document.querySelectorAll('button')];
                const model = btns.find(b =>
                    b.textContent.includes('Veo') ||
                    b.textContent.includes('veo') ||
                    b.textContent.includes('3.1') ||
                    b.textContent.includes('2.1')
                );
                return model ? model.textContent.trim() : '';
            }
        """)
        return text or ""

    async def select_video_model(self, page, model_display_name: str) -> bool:
        """Open model dropdown and select a model by display name."""
        current = await self.get_video_model_selector(page)
        if current:
            model_btn = page.locator("button").filter(has_text=current.split()[0]).first
            if await model_btn.count() > 0:
                await model_btn.click()
                await asyncio.sleep(0.5)
        return await self._click_button_with_text(page, [model_display_name])

    # ------------------------------------------------------------------
    # Screenshot helper
    # ------------------------------------------------------------------

    async def screenshot(self, page, path: str) -> None:
        try:
            await page.screenshot(path=path, full_page=False)
        except Exception as e:
            log.warning("Screenshot failed: %s", e)

    # ------------------------------------------------------------------
    # Utility
    # ------------------------------------------------------------------

    async def get_project_url_from_page(self, page) -> Optional[str]:
        url = page.url
        if "/project/" in url:
            return url
        return None
