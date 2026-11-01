/**
 * Content Script for Google Flow Tool App (flow.google.com)
 * 
 * Specifically customized to automate "VIDEOTOOL PRO / ImageTool Pro" tool:
 * URL: https://flow.google.com/project/dadaf5cb-2bbf-4c4b-b622-014e2a6cda1b/tool/b18b72cc-9dc1-4560-bf52-70266e226a18?mode=APP
 */

(function () {
  // Prevent duplicate script execution
  if (window.__FLOW_CONTENT_SCRIPT_INITIALIZED__) {
    console.log('[Flow Bridge] Content script already initialized in this tab.');
    return;
  }
  window.__FLOW_CONTENT_SCRIPT_INITIALIZED__ = true;

  // Convert base64 (raw or data URL) to File object safely without crashing
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

    // Clean any whitespace / newlines
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

  // Convert blob URL to base64 Data URL so it is cross-origin accessible
  async function resolveVideoSrc(src) {
    if (!src) return null;
    if (src.startsWith('blob:')) {
      try {
        console.log('[Flow Bridge] Converting blob video to base64 dataURL for cross-domain support...');
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

  // Helper to click an interactive element matching text
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

  // Ensure the tool panel is expanded and not an empty grey canvas
  async function ensureToolPanelOpen() {
    // Check if tool form / tabs already present
    const hasToolUi =
      document.querySelector('textarea, input[type="file"]') ||
      [...document.querySelectorAll('button, div')].some((el) => {
        const txt = (el.innerText || '').toLowerCase();
        return (
          txt.includes('khởi tạo video') ||
          txt.includes('model video') ||
          txt.includes('media tham chiếu') ||
          txt.includes('studio ảnh ai')
        );
      });

    if (hasToolUi) {
      console.log('[Flow Bridge] Tool UI already visible on canvas.');
      return;
    }

    console.log('[Flow Bridge] Tool UI not visible (blank canvas), opening tool panel...');

    // 1. Try clicking "Công cụ" button at top bar
    const topButtons = [...document.querySelectorAll('button, div[role="button"]')];
    const congCuBtn = topButtons.find((b) => (b.innerText || '').trim().toLowerCase() === 'công cụ');
    if (congCuBtn) {
      congCuBtn.click();
      console.log('[Flow Bridge] Clicked "Công cụ" button at top');
      await new Promise((r) => setTimeout(r, 1500));
    }

    // 2. Try clicking pinned tool in sidebar if still not visible
    const sidebarItems = [...document.querySelectorAll('[class*="pinned"], [role="button"], a, div')];
    const pinnedTool = sidebarItems.find((el) => {
      const txt = (el.innerText || el.getAttribute('aria-label') || '').toLowerCase();
      return txt.includes('videotool') || txt.includes('imagetool') || txt.includes('pro studio');
    });
    if (pinnedTool) {
      pinnedTool.click();
      console.log('[Flow Bridge] Clicked pinned tool in sidebar');
      await new Promise((r) => setTimeout(r, 1500));
    }
  }

  // Ensure the "KHỞI TẠO VIDEO" tab is selected if the tool has multiple tabs (Screenshot 2)
  async function ensureVideoTabSelected() {
    const allTabs = [
      ...document.querySelectorAll('button, div[role="tab"], div[role="button"], div, a'),
    ];
    const videoTab = allTabs.find((el) => {
      const txt = (el.innerText || el.textContent || '').toLowerCase().trim();
      return txt.includes('khởi tạo video') || txt.includes('motion fidelity');
    });

    if (videoTab) {
      videoTab.click();
      console.log('[Flow Bridge] Switched to KHỞI TẠO VIDEO tab');
      await new Promise((r) => setTimeout(r, 1200));
    }
  }

  // Listen for execution commands from background script
  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'EXECUTE_TOOL') {
      handleToolExecution(request.data)
        .then((result) => sendResponse({ ok: true, result }))
        .catch((err) => sendResponse({ ok: false, error: err.message || String(err) }));
      return true; // Keep message channel open for async response
    }
  });

  async function handleToolExecution(data) {
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

    console.log('[Flow Bridge] Starting synced execution on VideoTool Pro:', {
      model,
      preset,
      aspectRatio,
      resolution,
      duration,
      variations,
      hasImage: !!imageBase64,
    });

    // 1. Wait for page interactive
    await new Promise((r) => setTimeout(r, 2000));

    // 2. Ensure tool panel is open on the canvas (fixes blank grey canvas)
    await ensureToolPanelOpen();

    // 3. Ensure "KHỞI TẠO VIDEO" tab is active
    await ensureVideoTabSelected();

    // 4. Select Model Video AI (Omni 1.1 Flash, Veo 3.1 - Lite, Veo 3.1 - Fast)
    if (model) {
      if (model.includes('Lite')) {
        clickElementByText(['Veo 3.1 - Lite', 'Veo 3.1 Lite', 'Lite']);
      } else if (model.includes('Fast')) {
        clickElementByText(['Veo 3.1 - Fast', 'Veo 3.1 Fast', 'Fast']);
      } else if (model.includes('Omni') || model.includes('Flash')) {
        clickElementByText(['Omni 1.1 Flash', 'Omni']);
      }
      await new Promise((r) => setTimeout(r, 400));
    }

    // 5. Upload / Inject source photo into ẢNH NGUỒN TẠO VIDEO (I2V) / MEDIA THAM CHIẾU
    if (imageBase64) {
      try {
        const file = base64ToFile(imageBase64, 'source_photo.png');
        if (!file) {
          throw new Error('Dữ liệu ảnh nguồn không hợp lệ hoặc không chuyển đổi được.');
        }
        console.log('[Flow Bridge] Prepared source image File:', file.name, file.size, 'bytes, type:', file.type);

        const dt = new DataTransfer();
        dt.items.add(file);

        // Strategy A: Find all file inputs currently in DOM
        let fileInputs = [...document.querySelectorAll('input[type="file"]')];

        // Strategy B: Click upload trigger box if no file input found
        if (fileInputs.length === 0) {
          const uploadBox = [...document.querySelectorAll('button, div[role="button"], div, label')].find((el) => {
            const txt = (el.innerText || el.textContent || '').toLowerCase();
            return (
              txt.includes('thêm ảnh nguồn') ||
              txt.includes('media tham chiếu') ||
              txt.includes('tải lên')
            );
          });
          if (uploadBox) {
            uploadBox.click();
            await new Promise((r) => setTimeout(r, 600));
            fileInputs = [...document.querySelectorAll('input[type="file"]')];
          }
        }

        // Populate file inputs
        if (fileInputs.length > 0) {
          for (const input of fileInputs) {
            input.files = dt.files;
            input.dispatchEvent(new Event('input', { bubbles: true }));
            input.dispatchEvent(new Event('change', { bubbles: true }));
            console.log('[Flow Bridge] Injected image into file input element');
          }
        }

        // Strategy C: Dispatch drag & drop on dropzones
        const dropZones = [...document.querySelectorAll('div, section, label')].filter((el) => {
          const txt = (el.innerText || el.textContent || '').toLowerCase();
          return (
            txt.includes('thêm ảnh nguồn') ||
            txt.includes('media tham chiếu') ||
            el.className?.includes?.('drop') ||
            el.className?.includes?.('upload')
          );
        });
        for (const target of dropZones.slice(0, 3)) {
          target.dispatchEvent(new DragEvent('dragenter', { bubbles: true, cancelable: true, dataTransfer: dt }));
          target.dispatchEvent(new DragEvent('dragover', { bubbles: true, cancelable: true, dataTransfer: dt }));
          target.dispatchEvent(new DragEvent('drop', { bubbles: true, cancelable: true, dataTransfer: dt }));
          console.log('[Flow Bridge] Dispatched drop event on dropzone');
        }

        // Strategy D: Dispatch paste event
        try {
          const pasteEvent = new ClipboardEvent('paste', {
            bubbles: true,
            cancelable: true,
            clipboardData: dt,
          });
          document.dispatchEvent(pasteEvent);
        } catch (pe) {}

        console.log('[Flow Bridge] Image injection routines executed');
        await new Promise((r) => setTimeout(r, 2000));
      } catch (err) {
        console.warn('[Flow Bridge] Error uploading image:', err);
      }
    }

    // 6. Select Preset Chuyển Động
    if (preset) {
      clickElementByText([
        preset,
        preset.replace('Chân dung tự nhiên', 'Chân dung'),
        preset.replace('Camera Pan điện ảnh', 'Camera Pan'),
        preset.replace('Bước đi Fashion Runway', 'Fashion Runway'),
        preset.replace('Gió & Ngoại cảnh phiêu lãng', 'Gió & Ngoại cảnh'),
        preset.replace('Slow Push-in (Tiến gần)', 'Slow Push-in'),
      ]);
      await new Promise((r) => setTimeout(r, 400));
    }

    // 7. Select Tỉ lệ khung hình (16:9 / 9:16)
    if (aspectRatio) {
      clickElementByText([aspectRatio, aspectRatio === '16:9' ? 'Ngang' : 'Dọc']);
      await new Promise((r) => setTimeout(r, 300));
    }

    // 8. Select Độ phân giải (360p / 720p)
    if (resolution) {
      clickElementByText([resolution, resolution === '720p' ? 'Chuẩn sắc nét' : 'Xem trước']);
      await new Promise((r) => setTimeout(r, 300));
    }

    // 9. Select Thời lượng (4s, 6s, 8s, 10s)
    if (duration) {
      const durStr = duration.endsWith('s') ? duration : `${duration}s`;
      clickElementByText([durStr, `${duration} Giây`]);
      await new Promise((r) => setTimeout(r, 300));
    }

    // 10. Select Số lượng biến thể (1 video, 2 video, 3 video)
    if (variations) {
      clickElementByText([`${variations} video`, `${variations}`]);
      await new Promise((r) => setTimeout(r, 300));
    }

    // 11. Input Prompt / Kịch bản bổ sung
    if (prompt) {
      const textareas = [
        ...document.querySelectorAll('textarea, div[contenteditable="true"], input[type="text"]'),
      ];
      const promptArea =
        textareas.find((el) => {
          const placeholder = (el.placeholder || el.getAttribute('aria-label') || '').toLowerCase();
          return (
            placeholder.includes('chuyển động') ||
            placeholder.includes('kịch bản') ||
            placeholder.includes('prompt') ||
            placeholder.includes('chi tiết')
          );
        }) || textareas[0];

      if (promptArea) {
        if (promptArea.tagName === 'TEXTAREA' || promptArea.tagName === 'INPUT') {
          promptArea.value = prompt;
          promptArea.dispatchEvent(new Event('input', { bubbles: true }));
          promptArea.dispatchEvent(new Event('change', { bubbles: true }));
        } else {
          promptArea.textContent = prompt;
          promptArea.dispatchEvent(new Event('input', { bubbles: true }));
        }
        console.log('[Flow Bridge] Set prompt value');
        await new Promise((r) => setTimeout(r, 400));
      }
    }

    // 12. Click Action Button (Tạo video / Khởi tạo)
    // Wait up to 20s for uploaded image to process and enable button
    let submitBtn = null;
    const startWait = Date.now();
    while (Date.now() - startWait < 20000) {
      const allActionBtns = [...document.querySelectorAll('button, div[role="button"]')];

      // Debug logging to console of available buttons
      const btnNames = allActionBtns.map((b) => (b.innerText || b.textContent || '').trim()).filter(Boolean);
      console.log('[Flow Bridge] Checking action buttons:', btnNames);

      submitBtn = allActionBtns.find((btn) => {
        const txt = (btn.innerText || btn.textContent || '').toLowerCase().trim();
        if (btn.disabled || btn.getAttribute('aria-disabled') === 'true') return false;
        if (txt.includes('hãy tải') || txt.includes('ít nhất 1 ảnh')) return false;
        return (
          txt.includes('tạo chuyển động') ||
          txt.includes('khởi tạo') ||
          txt.includes('tạo video') ||
          txt.includes('generate')
        );
      });

      if (submitBtn) break;
      await new Promise((r) => setTimeout(r, 1200));
    }

    if (!submitBtn) {
      // If button still not found, check if it's currently rendering
      const isAlreadyGenerating = [...document.querySelectorAll('button, div')].some((el) => {
        const txt = (el.innerText || el.textContent || '').toLowerCase();
        return txt.includes('đang khởi tạo') || txt.includes('tạo chuyển động video');
      });

      if (!isAlreadyGenerating) {
        throw new Error('Nút Tạo Video đang bị khoá hoặc Google Flow chưa nhận ảnh nguồn. Hãy kiểm tra tab Google Flow.');
      }
      console.log('[Flow Bridge] Generation appears already started');
    } else {
      submitBtn.click();
      console.log('[Flow Bridge] Clicked submit button successfully!');
    }

    // 13. Monitor loop: send progress updates and detect completed video
    const startTime = Date.now();
    const MAX_WAIT_MS = 600000; // 10 minutes

    while (Date.now() - startTime < MAX_WAIT_MS) {
      await new Promise((r) => setTimeout(r, 3000));
      const elapsed = Math.round((Date.now() - startTime) / 1000);

      // Grab progress status text from floating status pills or progress bars (Screenshot 2: "TẠO CHUYỂN ĐỘNG VIDEO 2/4...")
      const progressEl = document.querySelector(
        '[class*="progress"], [class*="status"], div:has(> svg):has([class*="bar"]), [role="progressbar"]'
      );
      let statusText = progressEl ? (progressEl.innerText || progressEl.textContent || '').trim() : '';
      if (!statusText || statusText.length < 3) {
        statusText = `Google Flow đang render video (${elapsed}s)...`;
      }

      chrome.runtime.sendMessage({
        type: 'FLOW_PROGRESS_UPDATE',
        requestId,
        status: statusText,
      });

      // Check for completed video element
      const videoElements = [...document.querySelectorAll('video')];
      for (const v of videoElements) {
        const rawSrc = v.src || v.querySelector('source')?.src;
        if (
          rawSrc &&
          (rawSrc.includes('googlevideo.com') ||
            rawSrc.includes('storage.googleapis.com') ||
            rawSrc.includes('.mp4') ||
            rawSrc.startsWith('blob:'))
        ) {
          console.log('[Flow Bridge] Found finished video:', rawSrc);
          const resolvedUrl = await resolveVideoSrc(rawSrc);
          return {
            videoUrl: resolvedUrl,
          };
        }
      }

      // Check download button: "TẢI TÁC PHẨM ĐANG CHỌN" (Screenshot 2)
      const downloadBtn = [...document.querySelectorAll('a, button')].find((el) => {
        const txt = (el.innerText || el.textContent || '').toLowerCase();
        return txt.includes('tải tác phẩm') || txt.includes('download') || txt.includes('tải về');
      });

      if (downloadBtn) {
        if (
          downloadBtn.tagName === 'A' &&
          downloadBtn.href &&
          (downloadBtn.href.includes('.mp4') || downloadBtn.href.startsWith('blob:'))
        ) {
          console.log('[Flow Bridge] Found download link:', downloadBtn.href);
          const resolvedUrl = await resolveVideoSrc(downloadBtn.href);
          return {
            videoUrl: resolvedUrl,
          };
        }
      }
    }

    throw new Error('Thời gian tạo video trên Google Flow đã hết (Timeout).');
  }
})();
