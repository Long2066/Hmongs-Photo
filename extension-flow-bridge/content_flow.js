/**
 * Content Script for Google Flow (flow.google.com) - Version 1.0.5
 * 
 * Tối ưu hoá tương tác trên Google Flow Studio (veo 3.1):
 * - Tự động phát hiện và thoát khỏi trang danh mục /tools về thẳng Project Studio.
 * - Hỗ trợ nạp ảnh vào khung Bắt đầu (Start Frame), cấu hình Model/Tỉ lệ, nhập Prompt và gửi lệnh Tạo.
 * - Bắt trực tiếp link video từ video elements và Network Interceptor MAIN world.
 */

(function () {
  if (window.__FLOW_CONTENT_SCRIPT_INITIALIZED__) {
    console.log('[Flow Bridge] Content script already initialized in this tab.');
    return;
  }
  window.__FLOW_CONTENT_SCRIPT_INITIALIZED__ = true;

  let latestCapturedVideoUrl = null;

  window.addEventListener('message', (event) => {
    if (event.data && event.data.type === '__FLOW_CAPTURED_VIDEO_MEDIA__' && event.data.url) {
      console.log('[Flow Bridge Content] Captured video URL from page interceptor:', event.data.url);
      latestCapturedVideoUrl = event.data.url;
    }
  });

  // Base64 to File object converter
  function base64ToFile(rawOrDataUrl, filename = 'input_image.png', defaultMime = 'image/png') {
    if (!rawOrDataUrl) return null;

    let base64 = rawOrDataUrl;
    let mime = defaultMime;

    if (rawOrDataUrl.includes(',')) {
      const parts = rawOrDataUrl.split(',');
      const match = parts[0].match(/:(.*?);/);
      if (match) mime = match[1];
      base64 = parts[1];
    } else if (rawOrDataUrl.startsWith('data:')) {
      const commaIdx = rawOrDataUrl.indexOf(',');
      if (commaIdx !== -1) {
        base64 = rawOrDataUrl.substring(commaIdx + 1);
      }
    }

    base64 = base64.replace(/\s/g, '');

    try {
      const bstr = atob(base64);
      let n = bstr.length;
      const u8arr = new Uint8Array(n);
      while (n--) {
        u8arr[n] = bstr.charCodeAt(n);
      }
      return new File([u8arr], filename, { type: mime });
    } catch (err) {
      console.error('[Flow Bridge] Failed to convert base64 to File:', err);
      return null;
    }
  }

  // Convert blob URL to cross-origin accessible base64 Data URL
  async function resolveVideoSrc(src) {
    if (!src) return null;
    if (src.startsWith('blob:')) {
      try {
        console.log('[Flow Bridge] Converting blob video to base64 dataURL for cross-origin access...');
        const resp = await fetch(src);
        const blob = await resp.blob();
        return new Promise((resolve) => {
          const reader = new FileReader();
          reader.onloadend = () => resolve(reader.result);
          reader.onerror = () => resolve(src);
          reader.readAsDataURL(blob);
        });
      } catch (e) {
        console.warn('[Flow Bridge] Could not convert blob to dataURL, using raw src:', e);
        return src;
      }
    }
    return src;
  }

  // Click element matching text
  function clickElementByText(matchers, container = document) {
    const elements = [
      ...container.querySelectorAll(
        'button, div[role="button"], div[role="tab"], div[role="radio"], label, [class*="card"], [class*="option"], [class*="item"]'
      ),
    ];
    const matchArr = Array.isArray(matchers) ? matchers : [matchers];

    for (const matcher of matchArr) {
      const cleanMatch = matcher.toLowerCase().trim();
      const found = elements.find((el) => {
        const txt = (el.innerText || el.textContent || '').toLowerCase().trim();
        return txt.includes(cleanMatch);
      });
      if (found) {
        found.click();
        console.log('[Flow Bridge] Clicked option:', matcher);
        return true;
      }
    }
    return false;
  }

  // Normalize current view: If stuck on /tools catalog, navigate to project studio
  async function ensureProjectStudioView() {
    const curUrl = window.location.href;

    // If on /tools catalog or blank tool app canvas, move to project studio
    if (curUrl.includes('/tools') || (curUrl.includes('/tool/') && curUrl.includes('?mode=APP'))) {
      const match = curUrl.match(/\/project\/([a-f0-9\-]{8,})/i);
      if (match) {
        const studioUrl = `https://flow.google.com/project/${match[1]}`;
        console.log('[Flow Bridge] Navigating from catalog/canvas to project studio:', studioUrl);
        window.location.href = studioUrl;
        await new Promise((r) => setTimeout(r, 4000));
        return;
      }
    }

    // If on shared tool landing page, click use tool if present
    const useToolBtn = [...document.querySelectorAll('button, div[role="button"], a')].find((el) => {
      const txt = (el.innerText || el.textContent || '').toLowerCase().trim();
      return txt === 'sử dụng công cụ' || txt === 'use tool' || txt === 'dùng công cụ';
    });
    if (useToolBtn) {
      useToolBtn.click();
      await new Promise((r) => setTimeout(r, 2000));
    }
  }

  // Standard Google Flow Project Studio: Open settings panel (Veo/Aspect/Count)
  async function openProjectSettingsPanel() {
    // Check if settings popover is already visible
    const isVisible = [...document.querySelectorAll('[role="tab"], button[role="radio"]')].some((el) => {
      const txt = (el.textContent || '').toLowerCase();
      return txt.includes('16:9') || txt.includes('9:16') || txt.includes('video') || txt.includes('khung hình');
    });
    if (isVisible) return true;

    // Trigger settings by clicking model pill button (Nano Banana, Veo, Omni, x1, x2)
    const triggerSels = [
      'button[aria-label="Điều kiện kích hoạt cài đặt"]',
      'button[aria-label*="kích hoạt cài đặt" i]',
      'button[aria-label*="setting" i]',
      'button:has([class*="tune"])',
    ];

    for (const sel of triggerSels) {
      const el = document.querySelector(sel);
      if (el) {
        el.click();
        await new Promise((r) => setTimeout(r, 600));
        return true;
      }
    }

    // Fallback: search by text fragments
    const pillTexts = ['veo', 'omni', 'banana', 'imagen', 'video', 'x1', 'x2'];
    const allBtns = [...document.querySelectorAll('button')];
    const pill = allBtns.find((b) => {
      const t = (b.textContent || '').toLowerCase();
      return pillTexts.some((pt) => t.includes(pt));
    });

    if (pill) {
      pill.click();
      await new Promise((r) => setTimeout(r, 600));
      return true;
    }

    return false;
  }

  // Standard Google Flow: Upload Start-Frame Image
  async function uploadStartFrameImage(file) {
    if (!file) return false;
    const dt = new DataTransfer();
    dt.items.add(file);

    // 1. Click "Bắt đầu" (Start) picker button in the bottom input bar
    const startBtns = [...document.querySelectorAll('button')].filter((b) => {
      const txt = (b.textContent || '').trim().toLowerCase();
      const aria = (b.getAttribute('aria-label') || '').toLowerCase();
      return (txt === 'bắt đầu' || txt === 'start' || txt.includes('thêm thành phần')) && !aria.includes('tạo');
    });

    if (startBtns.length > 0) {
      startBtns[0].click();
      await new Promise((r) => setTimeout(r, 800));
    }

    // 2. Look for file input or trigger "uploadTải nội dung nghe nhìn lên"
    let fileInputs = [...document.querySelectorAll('input[type="file"]')];
    if (fileInputs.length === 0) {
      const uploadTrig = [...document.querySelectorAll('button, div[role="button"], label')].find((el) => {
        const txt = (el.innerText || el.textContent || '').toLowerCase();
        return txt.includes('tải nội dung') || txt.includes('upload media') || txt.includes('tải lên');
      });
      if (uploadTrig) {
        uploadTrig.click();
        await new Promise((r) => setTimeout(r, 600));
        fileInputs = [...document.querySelectorAll('input[type="file"]')];
      }
    }

    if (fileInputs.length > 0) {
      for (const input of fileInputs) {
        input.files = dt.files;
        input.dispatchEvent(new Event('input', { bubbles: true }));
        input.dispatchEvent(new Event('change', { bubbles: true }));
        console.log('[Flow Bridge] Injected image into Google Flow file input');
      }
    }

    // 3. Fallback: Drag and drop on dropzones
    const dropZones = [...document.querySelectorAll('div, section, label')].filter((el) => {
      const txt = (el.innerText || el.textContent || '').toLowerCase();
      return txt.includes('bắt đầu') || txt.includes('thêm ảnh') || el.className?.includes?.('upload');
    });
    for (const dz of dropZones.slice(0, 2)) {
      dz.dispatchEvent(new DragEvent('dragenter', { bubbles: true, cancelable: true, dataTransfer: dt }));
      dz.dispatchEvent(new DragEvent('dragover', { bubbles: true, cancelable: true, dataTransfer: dt }));
      dz.dispatchEvent(new DragEvent('drop', { bubbles: true, cancelable: true, dataTransfer: dt }));
    }

    // 4. Wait for upload to process and attach to prompt
    await new Promise((r) => setTimeout(r, 2000));
    const addPromptBtn = [...document.querySelectorAll('button')].find((b) => {
      const txt = (b.textContent || '').toLowerCase();
      return txt.includes('thêm vào câu lệnh') || txt.includes('add to prompt');
    });
    if (addPromptBtn && !addPromptBtn.disabled) {
      addPromptBtn.click();
      await new Promise((r) => setTimeout(r, 600));
    }

    return true;
  }

  // Fill prompt text
  async function fillPromptText(prompt) {
    if (!prompt) return;

    // Search for contenteditable div (Standard Studio)
    const editables = [...document.querySelectorAll('div[contenteditable="true"]')];
    for (const el of editables) {
      if (el.offsetWidth > 0 && el.offsetHeight > 0) {
        el.focus();
        document.execCommand('selectAll', false, null);
        document.execCommand('insertText', false, prompt);
        el.dispatchEvent(new Event('input', { bubbles: true }));
        el.dispatchEvent(new Event('change', { bubbles: true }));
        console.log('[Flow Bridge] Filled prompt into contenteditable div');
        return;
      }
    }

    // Fallback: textarea or text input
    const textareas = [...document.querySelectorAll('textarea, input[type="text"]')];
    if (textareas.length > 0) {
      const ta = textareas[0];
      ta.value = prompt;
      ta.dispatchEvent(new Event('input', { bubbles: true }));
      ta.dispatchEvent(new Event('change', { bubbles: true }));
      console.log('[Flow Bridge] Filled prompt into textarea');
    }
  }

  // Click Submit (Create) button
  async function clickSubmitButton() {
    const startWait = Date.now();
    while (Date.now() - startWait < 20000) {
      const allBtns = [...document.querySelectorAll('button, div[role="button"]')];

      const submitBtn = allBtns.find((btn) => {
        const txt = (btn.innerText || btn.textContent || '').toLowerCase().trim();
        const aria = (btn.getAttribute('aria-label') || '').toLowerCase();
        if (btn.disabled || btn.getAttribute('aria-disabled') === 'true') return false;
        if (txt.includes('tải tác phẩm') || txt.includes('download')) return false;

        return (
          aria.includes('bắt đầu tạo') ||
          txt.includes('arrow_forward') ||
          txt === 'tạo' ||
          txt === 'create' ||
          txt.includes('tạo chuyển động') ||
          txt.includes('khởi tạo')
        );
      });

      if (submitBtn) {
        submitBtn.click();
        console.log('[Flow Bridge] Clicked submit button successfully!');
        return true;
      }

      await new Promise((r) => setTimeout(r, 1000));
    }

    return false;
  }

  // Listen for execution commands
  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'FLOW_HEARTBEAT') {
      sendResponse({ ok: true, alive: true });
      return false;
    }

    if (request.action === 'EXECUTE_TOOL') {
      handleExecution(request.data)
        .then((result) => sendResponse({ ok: true, result }))
        .catch((err) => sendResponse({ ok: false, error: err.message || String(err) }));
      return true;
    }
  });

  async function handleExecution(data) {
    const {
      prompt,
      model = 'Veo 3.1 - Lite',
      preset = 'Chân dung tự nhiên',
      aspectRatio = '16:9',
      resolution = '720p',
      duration = '8s',
      variations = 1,
      imageBase64,
      requestId,
    } = data;

    latestCapturedVideoUrl = null;

    console.log('[Flow Bridge 1.0.5] Starting generation execution:', {
      model,
      aspectRatio,
      hasImage: !!imageBase64,
    });

    await new Promise((r) => setTimeout(r, 1200));

    // 1. Ensure tab is on Project Studio, not catalog
    await ensureProjectStudioView();

    // 2. Open Settings Panel
    await openProjectSettingsPanel();

    // 3. Switch mode to Video / Frames
    clickElementByText(['Khung hình', 'Frames', 'Video', 'videocam']);
    await new Promise((r) => setTimeout(r, 300));

    // 4. Set Aspect Ratio
    if (aspectRatio === '9:16') {
      clickElementByText(['9:16', 'Portrait', 'Dọc']);
    } else {
      clickElementByText(['16:9', 'Landscape', 'Ngang']);
    }
    await new Promise((r) => setTimeout(r, 300));

    // 5. Set Count
    if (variations) {
      clickElementByText([`x${variations}`, `${variations} video`]);
      await new Promise((r) => setTimeout(r, 300));
    }

    // Close settings panel with Escape
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    await new Promise((r) => setTimeout(r, 400));

    // 6. Upload start-frame image if provided
    if (imageBase64) {
      chrome.runtime.sendMessage({
        type: 'FLOW_PROGRESS_UPDATE',
        requestId,
        status: 'Đang nạp ảnh nguồn vào Google Flow...',
      });
      const file = base64ToFile(imageBase64, 'source_photo.png');
      await uploadStartFrameImage(file);
      await new Promise((r) => setTimeout(r, 1200));
    }

    // 7. Fill prompt
    const finalPrompt = prompt || `${preset}: chuyển động mượt mà điện ảnh`;
    await fillPromptText(finalPrompt);
    await new Promise((r) => setTimeout(r, 600));

    // 8. Submit
    chrome.runtime.sendMessage({
      type: 'FLOW_PROGRESS_UPDATE',
      requestId,
      status: 'Đang gửi lệnh tạo video Veo 3.1...',
    });

    const submitted = await clickSubmitButton();
    if (!submitted) {
      throw new Error('Nút Tạo Video đang bị khoá hoặc Google Flow chưa nhận ảnh nguồn. Hãy kiểm tra tab Google Flow.');
    }

    // 9. Monitor progress and capture video
    const startTime = Date.now();
    const MAX_WAIT_MS = 600000; // 10 mins

    while (Date.now() - startTime < MAX_WAIT_MS) {
      await new Promise((r) => setTimeout(r, 2500));
      const elapsed = Math.round((Date.now() - startTime) / 1000);

      // Check interceptor captured video URL
      if (latestCapturedVideoUrl) {
        console.log('[Flow Bridge] Video captured via network interceptor:', latestCapturedVideoUrl);
        const resolved = await resolveVideoSrc(latestCapturedVideoUrl);
        return { videoUrl: resolved };
      }

      // Check progress status text from DOM
      const domText = document.body.innerText || '';
      const pctMatch = domText.match(/(\d+)%/);
      if (pctMatch) {
        chrome.runtime.sendMessage({
          type: 'FLOW_PROGRESS_UPDATE',
          requestId,
          status: `Veo 3.1 đang render (${pctMatch[1]}% • ${elapsed}s)...`,
        });
      } else {
        chrome.runtime.sendMessage({
          type: 'FLOW_PROGRESS_UPDATE',
          requestId,
          status: `Veo 3.1 đang render video (${elapsed}s)...`,
        });
      }

      // Check for video elements in DOM
      const videos = [...document.querySelectorAll('video')];
      for (const v of videos) {
        const src = v.currentSrc || v.src || v.querySelector('source')?.src;
        if (
          src &&
          (src.includes('googlevideo.com') ||
            src.includes('flow-content') ||
            src.includes('.mp4') ||
            src.startsWith('blob:'))
        ) {
          console.log('[Flow Bridge] Found finished video element in DOM:', src);
          const resolved = await resolveVideoSrc(src);
          return { videoUrl: resolved };
        }
      }

      // If finished, click download button to trigger interceptor
      if (elapsed >= 15 && !domText.includes('Đang tạo') && !domText.includes('Generating') && !pctMatch) {
        const downloadBtn = [...document.querySelectorAll('button, a')].find((el) => {
          const txt = (el.innerText || el.textContent || '').toLowerCase();
          return txt.includes('tải tác phẩm') || txt.includes('download') || txt.includes('tải về');
        });
        if (downloadBtn && !downloadBtn.disabled) {
          downloadBtn.click();
          await new Promise((r) => setTimeout(r, 2000));
          if (latestCapturedVideoUrl) {
            const resolved = await resolveVideoSrc(latestCapturedVideoUrl);
            return { videoUrl: resolved };
          }
        }
      }
    }

    throw new Error('Thời gian tạo video trên Google Flow đã hết (Timeout).');
  }
})();
