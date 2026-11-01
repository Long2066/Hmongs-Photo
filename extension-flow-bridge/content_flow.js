/**
 * Content Script for Google Flow (flow.google.com)
 * 
 * Runs inside Google Flow pages to automate the user's custom tool
 * and capture the generated video URL.
 */

// Helper to wait for element in DOM
function waitForElement(selector, timeout = 30000) {
  return new Promise((resolve, reject) => {
    const el = document.querySelector(selector);
    if (el) return resolve(el);

    const observer = new MutationObserver(() => {
      const el = document.querySelector(selector);
      if (el) {
        observer.disconnect();
        resolve(el);
      }
    });

    observer.observe(document.body, { childList: true, subtree: true });
    setTimeout(() => {
      observer.disconnect();
      reject(new Error(`Timeout waiting for ${selector}`));
    }, timeout);
  });
}

// Convert base64 data URL to File object
function dataURLtoFile(dataurl, filename = 'input_image.png') {
  const arr = dataurl.split(',');
  const mime = arr[0].match(/:(.*?);/)[1];
  const bstr = atob(arr[1]);
  let n = bstr.length;
  const u8arr = new Uint8Array(n);
  while (n--) {
    u8arr[n] = bstr.charCodeAt(n);
  }
  return new File([u8arr], filename, { type: mime });
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

async function handleToolExecution({ prompt, model, aspectRatio, imageBase64, requestId }) {
  console.log('[ImageTool Bridge] Starting tool execution on Google Flow:', { prompt, model });

  // 1. Wait for Flow page to be interactive
  await new Promise((r) => setTimeout(r, 2000));

  // 2. Locate and set Prompt
  const promptInput = document.querySelector('textarea, div[contenteditable="true"], input[type="text"]');
  if (promptInput) {
    if (promptInput.tagName === 'TEXTAREA' || promptInput.tagName === 'INPUT') {
      promptInput.value = prompt;
      promptInput.dispatchEvent(new Event('input', { bubbles: true }));
      promptInput.dispatchEvent(new Event('change', { bubbles: true }));
    } else {
      promptInput.textContent = prompt;
      promptInput.dispatchEvent(new Event('input', { bubbles: true }));
    }
  }

  // 3. Select Model if button exists (e.g. Veo 3.1 - Lite, Veo 3.1 Fast, Omni 1.1 Flash)
  if (model) {
    const allButtons = [...document.querySelectorAll('button')];
    const targetModelBtn = allButtons.find((btn) => {
      const text = btn.innerText || btn.textContent || '';
      return text.toLowerCase().includes(model.toLowerCase()) || 
             (model.includes('Lite') && text.includes('Lite')) ||
             (model.includes('Fast') && text.includes('Fast'));
    });
    if (targetModelBtn) {
      targetModelBtn.click();
      console.log('[ImageTool Bridge] Selected model button:', model);
    }
  }

  // 4. Attach image if Image-to-Video
  if (imageBase64) {
    try {
      const fileInput = document.querySelector('input[type="file"]');
      if (fileInput) {
        const file = dataURLtoFile(imageBase64, 'reference_image.png');
        const dt = new DataTransfer();
        dt.items.add(file);
        fileInput.files = dt.files;
        fileInput.dispatchEvent(new Event('change', { bubbles: true }));
        console.log('[ImageTool Bridge] Attached reference image');
        await new Promise((r) => setTimeout(r, 1500));
      }
    } catch (e) {
      console.warn('[ImageTool Bridge] Could not attach image:', e);
    }
  }

  // 5. Find and click Create / Submit Button
  const submitBtn = [...document.querySelectorAll('button')].find((btn) => {
    const text = (btn.innerText || btn.textContent || '').toLowerCase();
    return (
      text.includes('tạo chuyển động') ||
      text.includes('khởi tạo') ||
      text.includes('tạo video') ||
      text.includes('generate')
    ) && !btn.disabled;
  });

  if (!submitBtn) {
    throw new Error('Không tìm thấy nút bấm Tạo Video trên trang Google Flow.');
  }

  submitBtn.click();
  console.log('[ImageTool Bridge] Clicked submit button!');

  // 6. Monitor progress and wait for completion
  const startTime = Date.now();
  const MAX_WAIT_MS = 600000; // 10 minutes

  while (Date.now() - startTime < MAX_WAIT_MS) {
    await new Promise((r) => setTimeout(r, 3000));

    // Check status pill / text
    const statusTextEl = document.querySelector(
      '[class*="status"], [class*="progress"], button[disabled], div:has(> [class*="progress"])'
    );
    const statusText = statusTextEl ? statusTextEl.innerText || '' : 'Đang xử lý video...';

    chrome.runtime.sendMessage({
      type: 'FLOW_PROGRESS_UPDATE',
      requestId,
      status: statusText || 'Google Flow đang render video...',
    });

    // Check if video element is ready with valid source
    const videoElements = [...document.querySelectorAll('video')];
    for (const v of videoElements) {
      const src = v.src || v.querySelector('source')?.src;
      if (src && (src.includes('googlevideo.com') || src.includes('storage.googleapis.com') || src.includes('.mp4') || src.startsWith('blob:'))) {
        console.log('[ImageTool Bridge] Found completed video element:', src);
        return {
          videoUrl: src,
        };
      }
    }

    // Check download button (TẢI TÁC PHẨM ĐANG CHỌN)
    const downloadBtn = [...document.querySelectorAll('a, button')].find((el) => {
      const txt = (el.innerText || el.textContent || '').toLowerCase();
      return txt.includes('tải tác phẩm') || txt.includes('download') || txt.includes('tải về');
    });

    if (downloadBtn && downloadBtn.tagName === 'A' && downloadBtn.href && downloadBtn.href.includes('.mp4')) {
      console.log('[ImageTool Bridge] Found download link:', downloadBtn.href);
      return {
        videoUrl: downloadBtn.href,
      };
    }
  }

  throw new Error('Hết thời gian chờ tạo video trên Google Flow.');
}
