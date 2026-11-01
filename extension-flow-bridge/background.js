/**
 * Background Service Worker for ImageTool Flow Bridge Extension
 */

const DEFAULT_TOOL_URL = 'https://flow.google.com/project/dadaf5cb-2bbf-4c4b-b622-014e2a6cda1b/tool/b18b72cc-9dc1-4560-bf52-70266e226a18?mode=APP';

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
    chrome.tabs.create({
      url: 'https://flow.google.com',
      active: true,
    }, (tab) => sendResponse({ ok: true, tabId: tab.id }));
    return true;
  }

  // Forward Progress Updates
  if (request.type === 'FLOW_PROGRESS_UPDATE') {
    // Broadcast progress to all ImageTool tabs
    chrome.tabs.query({
      url: ['https://vip-imagetools.vercel.app/*', 'http://localhost:*/*', 'http://127.0.0.1:*/*']
    }, (tabs) => {
      tabs.forEach((t) => {
        chrome.tabs.sendMessage(t.id, {
          type: 'FLOW_GENERATE_PROGRESS',
          requestId: request.requestId,
          status: request.status,
        }).catch(() => {});
      });
    });
    return;
  }

  // Generate Video
  if (action === 'GENERATE_VIDEO') {
    const callerTabId = sender.tab ? sender.tab.id : null;
    executeVideoGenerationFlow(payload, requestId, callerTabId)
      .then((res) => sendResponse({ ok: true, ...res }))
      .catch((err) => {
        sendResponse({ ok: false, error: err.message || String(err) });
        if (callerTabId) {
          chrome.tabs.sendMessage(callerTabId, {
            type: 'FLOW_GENERATE_ERROR',
            requestId,
            error: err.message || 'Lỗi khi tạo video trên Google Flow',
          }).catch(() => {});
        }
      });
    return true;
  }
});

// 3. Execution Pipeline: Opens background tab, injects automation, relays results
async function executeVideoGenerationFlow(payload, requestId, callerTabId) {
  const targetUrl = payload?.toolUrl || DEFAULT_TOOL_URL;

  // Open tab in background
  const flowTab = await chrome.tabs.create({
    url: targetUrl,
    active: false,
  });

  // Wait for tab to load
  await new Promise((resolve) => {
    function listener(tabId, info) {
      if (tabId === flowTab.id && info.status === 'complete') {
        chrome.tabs.onUpdated.removeListener(listener);
        resolve();
      }
    }
    chrome.tabs.onUpdated.addListener(listener);
    setTimeout(resolve, 15000); // 15s timeout fallback
  });

  // Give page scripts 2s to initialize
  await new Promise((r) => setTimeout(r, 2500));

  try {
    // Send execution job to content_flow.js inside that tab
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
      chrome.tabs.sendMessage(callerTabId, {
        type: 'FLOW_GENERATE_SUCCESS',
        requestId,
        videoUrl,
        urls: [videoUrl],
      }).catch(() => {});
    }

    return {
      videoUrl,
      urls: [videoUrl],
    };
  } finally {
    // Close background tab after completion to clean up memory
    try {
      chrome.tabs.remove(flowTab.id);
    } catch (e) {
      // Ignore
    }
  }
}
