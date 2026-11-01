/**
 * Background Service Worker for vip-imagetools Extension (v1.0.5)
 * 
 * Tối ưu hoá Phương án 2: Bắt trực tiếp tab Google Flow đang mở của người dùng,
 * giữ kết nối liên tục (heartbeat) để chống Chrome đóng băng ngầm (tab throttling),
 * tự động bắt link video trả thẳng về web vip-imagetools.
 */

const DEFAULT_FALLBACK_PROJECT_ID = 'dadaf5cb-2bbf-4c4b-b622-014e2a6cda1b';
const DEFAULT_TOOL_URL = `https://flow.google.com/project/${DEFAULT_FALLBACK_PROJECT_ID}`;

// 1. Check if user has active Google Flow cookies
async function checkFlowAuth() {
  try {
    const cookie = await chrome.cookies.get({
      url: 'https://flow.google.com',
      name: '__Secure-1PSID',
    });
    return {
      authenticated: !!cookie && !!cookie.value,
      email: cookie ? 'Tài khoản Google đang kết nối' : null,
    };
  } catch (err) {
    return {
      authenticated: false,
      error: err.message,
    };
  }
}

// =========================================================================
// GOOGLE QUOTA STATION: AUTO-CAPTURE OAUTH CALLBACK FROM GOOGLE
// Automatically intercepts http://localhost:51121/oauth-callback?code=...
// Sends the captured URL to the active ImageTool tab and closes the dead tab!
// =========================================================================
let lastCapturedOAuthUrl = '';
let lastCapturedOAuthTime = 0;

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  const currentUrl = changeInfo.url || tab?.url || '';
  if (!currentUrl) return;

  const isLocalHost = currentUrl.includes('localhost:') || currentUrl.includes('127.0.0.1:');
  const isOAuthCallback = (
    currentUrl.includes('oauth-callback') ||
    currentUrl.includes('auth/callback') ||
    (currentUrl.includes('code=') && currentUrl.includes('state='))
  );

  if (isLocalHost && isOAuthCallback) {
    const now = Date.now();
    if (currentUrl === lastCapturedOAuthUrl && (now - lastCapturedOAuthTime) < 4000) {
      return;
    }
    lastCapturedOAuthUrl = currentUrl;
    lastCapturedOAuthTime = now;

    console.log('[Flow Bridge] Intercepted Google Quota OAuth Callback:', currentUrl);

    // Broadcast to all active tool tabs
    chrome.tabs.query({}, (tabs) => {
      tabs.forEach((t) => {
        if (!t.id) return;
        chrome.tabs.sendMessage(t.id, {
          type: 'QUOTA_OAUTH_CAPTURED',
          callbackUrl: currentUrl
        }).catch(() => {});
      });
    });

    // Auto-close the dead localhost tab after a short moment so user doesn't see error page
    setTimeout(() => {
      chrome.tabs.remove(tabId).catch(() => {});
    }, 700);
  }
});

// 2. Message listener from content_bridge or popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  const { action, requestId, payload } = request;

  // Check Auth
  if (action === 'CHECK_AUTH') {
    checkFlowAuth().then((res) => sendResponse(res));
    return true;
  }

  // Open Login Window
  if (action === 'OPEN_LOGIN') {
    chrome.tabs.create(
      {
        url: DEFAULT_TOOL_URL,
        active: true,
      },
      (tab) => sendResponse({ ok: true, tabId: tab.id })
    );
    return true;
  }

  // Forward Progress Updates to ImageTool web tabs
  if (request.type === 'FLOW_PROGRESS_UPDATE') {
    chrome.tabs.query(
      {
        url: ['https://vip-imagetools.vercel.app/*', 'http://localhost:*/*', 'http://127.0.0.1:*/*'],
      },
      (tabs) => {
        tabs.forEach((t) => {
          chrome.tabs
            .sendMessage(t.id, {
              type: 'FLOW_GENERATE_PROGRESS',
              requestId: request.requestId,
              status: request.status,
            })
            .catch(() => {});
        });
      }
    );
    return;
  }

  // Generate Video: Background Pipeline
  if (action === 'GENERATE_VIDEO') {
    const callerTabId = sender.tab ? sender.tab.id : null;
    sendResponse({ ok: true, status: 'STARTED' });

    // Ensure caller tab stays active and focused
    if (callerTabId) {
      chrome.tabs.update(callerTabId, { active: true }).catch(() => {});
    }

    // Run execution pipeline asynchronously
    executeVideoGenerationFlow(payload, requestId, callerTabId).catch((err) => {
      console.error('[Background] Video Generation Error:', err);
      if (callerTabId) {
        chrome.tabs
          .sendMessage(callerTabId, {
            type: 'FLOW_GENERATE_ERROR',
            requestId,
            error: err.message || 'Lỗi khi tạo video trên Google Flow',
          })
          .catch(() => {});
      }
    });
    return false;
  }
});

// Helper to normalize a Flow URL to the project studio (removing /tools or /tool/...)
function normalizeToStudioUrl(url) {
  if (!url) return DEFAULT_TOOL_URL;
  const match = url.match(/\/project\/([a-f0-9\-]{8,})/i);
  if (match) {
    return `https://flow.google.com/project/${match[1]}`;
  }
  return DEFAULT_TOOL_URL;
}

// 3. Execution Pipeline: Reuses Existing Flow Tab & Injects Interceptors
async function executeVideoGenerationFlow(payload, requestId, callerTabId) {
  let targetUrl = payload?.toolUrl || DEFAULT_TOOL_URL;
  targetUrl = normalizeToStudioUrl(targetUrl);

  // Step A: Search for existing tabs on flow.google.com
  const existingTabs = await chrome.tabs.query({ url: '*://flow.google.com/*' });
  
  // 1. Search for existing project tab
  let flowTab = existingTabs.find((t) => t.url && t.url.includes('/project/'));

  // 2. Search by tab title
  if (!flowTab) {
    flowTab = existingTabs.find(
      (t) => t.title && (t.title.includes('Google Flow') || t.title.includes('Flow') || t.title.includes('VideoTool') || t.title.includes('ImageTool'))
    );
  }

  // 3. Fallback: Any Flow tab that is currently open
  if (!flowTab && existingTabs.length > 0) {
    flowTab = existingTabs[0];
  }

  if (flowTab) {
    // If the tab is currently on /tools or a broken /tool/... view, normalize it to the project studio
    const studioUrl = normalizeToStudioUrl(flowTab.url || targetUrl);
    if (!flowTab.url || flowTab.url.includes('/tools') || (flowTab.url.includes('/tool/') && flowTab.url.includes('?mode=APP'))) {
      console.log('[Background] Normalizing existing Flow tab to project studio:', studioUrl);
      await chrome.tabs.update(flowTab.id, { url: studioUrl });
      await new Promise((r) => setTimeout(r, 4000));
    }
  } else {
    console.log('[Background] No Flow tab found, opening project studio in background tab:', targetUrl);
    flowTab = await chrome.tabs.create({
      url: targetUrl,
      active: false,
    });
    await new Promise((r) => setTimeout(r, 4500));
  }

  // Ensure caller tab stays focused so user experience is not disrupted
  if (callerTabId) {
    chrome.tabs.update(callerTabId, { active: true }).catch(() => {});
  }

  // Wait for tab load completion if needed
  if (flowTab.status !== 'complete') {
    await new Promise((resolve) => {
      function listener(tabId, info) {
        if (tabId === flowTab.id && info.status === 'complete') {
          chrome.tabs.onUpdated.removeListener(listener);
          resolve();
        }
      }
      chrome.tabs.onUpdated.addListener(listener);
      setTimeout(resolve, 12000);
    });
  }

  // Short pause for SPA initialization
  await new Promise((r) => setTimeout(r, 2000));

  // Step B: Inject network/blob interceptor into the page MAIN world
  try {
    await chrome.scripting.executeScript({
      target: { tabId: flowTab.id },
      world: 'MAIN',
      func: () => {
        if (window.__FLOW_PAGE_INTERCEPTOR_ACTIVE__) return;
        window.__FLOW_PAGE_INTERCEPTOR_ACTIVE__ = true;
        console.log('[Flow Bridge Interceptor] Active in MAIN world');

        // Hook URL.createObjectURL for video blobs
        const origCreate = URL.createObjectURL;
        URL.createObjectURL = function (obj) {
          const url = origCreate.apply(this, arguments);
          try {
            if (obj instanceof Blob && (obj.type.includes('video') || obj.size > 80000)) {
              console.log('[Flow Interceptor] Captured video blob URL:', url, obj.size);
              window.postMessage({ type: '__FLOW_CAPTURED_VIDEO_MEDIA__', url }, '*');
            }
          } catch (e) {}
          return url;
        };

        // Hook anchor click for download triggers
        const origClick = HTMLAnchorElement.prototype.click;
        HTMLAnchorElement.prototype.click = function () {
          try {
            if (this.href && (this.href.includes('.mp4') || this.href.startsWith('blob:') || this.href.includes('flow-content'))) {
              console.log('[Flow Interceptor] Captured anchor download URL:', this.href);
              window.postMessage({ type: '__FLOW_CAPTURED_VIDEO_MEDIA__', url: this.href }, '*');
            }
          } catch (e) {}
          return origClick.apply(this, arguments);
        };

        // Hook fetch responses for video streams
        const origFetch = window.fetch;
        window.fetch = async function (...args) {
          const resp = await origFetch.apply(this, args);
          try {
            const clone = resp.clone();
            const url = clone.url || '';
            const ct = clone.headers.get('content-type') || '';
            if (ct.includes('video/mp4') || url.includes('/video/') || (url.includes('.mp4') && !url.includes('.js'))) {
              console.log('[Flow Interceptor] Captured fetch video URL:', url);
              window.postMessage({ type: '__FLOW_CAPTURED_VIDEO_MEDIA__', url }, '*');
            }
          } catch (e) {}
          return resp;
        };
      },
    });
  } catch (e) {
    console.warn('[Background] Interceptor injection note:', e);
  }

  // Step C: Ensure content_flow.js is injected
  try {
    await chrome.scripting.executeScript({
      target: { tabId: flowTab.id },
      files: ['content_flow.js'],
    });
  } catch (e) {
    // Script already injected
  }

  // Step D: Start Heartbeat interval to wake up content script and prevent Chrome background tab sleep
  const heartbeatTimer = setInterval(() => {
    chrome.tabs.sendMessage(flowTab.id, { action: 'FLOW_HEARTBEAT', requestId }).catch(() => {});
  }, 2500);

  try {
    // Send execution job to content_flow.js
    const response = await chrome.tabs.sendMessage(flowTab.id, {
      action: 'EXECUTE_TOOL',
      data: {
        ...payload,
        requestId,
      },
    });

    if (!response || !response.ok) {
      throw new Error(response?.error || 'Google Flow không phản hồi.');
    }

    const videoUrl = response.result?.videoUrl;
    if (!videoUrl) {
      throw new Error('Google Flow hoàn tất nhưng không lấy được liên kết video.');
    }

    // Send success back to caller tab
    if (callerTabId) {
      chrome.tabs
        .sendMessage(callerTabId, {
          type: 'FLOW_GENERATE_SUCCESS',
          requestId,
          videoUrl,
          urls: [videoUrl],
        })
        .catch(() => {});
    }

    return {
      videoUrl,
      urls: [videoUrl],
    };
  } finally {
    clearInterval(heartbeatTimer);
    // NEVER close the flow tab - keep it open for subsequent generations!
  }
}
