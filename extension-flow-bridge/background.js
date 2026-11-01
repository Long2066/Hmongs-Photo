/**
 * Background Service Worker for ImageTool Flow Bridge Extension
 */

const DEFAULT_TOOL_URL =
  'https://flow.google.com/project/dadaf5cb-2bbf-4c4b-b622-014e2a6cda1b/tool/b18b72cc-9dc1-4560-bf52-70266e226a18?mode=APP';

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
    chrome.tabs.create(
      {
        url: 'https://flow.google.com',
        active: true,
      },
      (tab) => sendResponse({ ok: true, tabId: tab.id })
    );
    return true;
  }

  // Forward Progress Updates
  if (request.type === 'FLOW_PROGRESS_UPDATE') {
    // Broadcast progress to all ImageTool tabs
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

  // Generate Video
  if (action === 'GENERATE_VIDEO') {
    const callerTabId = sender.tab ? sender.tab.id : null;
    // Acknowledge immediately to prevent port closed errors
    sendResponse({ ok: true, status: 'STARTED' });

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
    return false; // Acknowledged synchronously
  }
});

// 3. Execution Pipeline: Reuses existing tab or opens foreground tab, injects automation, relays results
async function executeVideoGenerationFlow(payload, requestId, callerTabId) {
  const targetUrl = payload?.toolUrl || DEFAULT_TOOL_URL;

  // Step A: Find if user already has Google Flow open
  const existingTabs = await chrome.tabs.query({ url: '*://flow.google.com/*' });
  let flowTab = existingTabs.find((t) => t.url && t.url.includes('b18b72cc-9dc1-4560-bf52-70266e226a18'));
  let isNewTab = false;

  if (flowTab) {
    console.log('[Background] Reusing existing Google Flow tool tab:', flowTab.id);
    await chrome.tabs.update(flowTab.id, { active: true });
  } else if (existingTabs.length > 0) {
    flowTab = existingTabs[0];
    console.log('[Background] Navigating existing Google Flow tab to tool:', flowTab.id);
    await chrome.tabs.update(flowTab.id, { url: targetUrl, active: true });
    // Wait for tab navigation
    await new Promise((r) => setTimeout(r, 4000));
  } else {
    isNewTab = true;
    console.log('[Background] Creating new Google Flow tab');
    flowTab = await chrome.tabs.create({
      url: targetUrl,
      active: true, // Active to prevent background throttling
    });
  }

  // Wait for tab load completion if newly navigated/created
  if (isNewTab || flowTab.status !== 'complete') {
    await new Promise((resolve) => {
      function listener(tabId, info) {
        if (tabId === flowTab.id && info.status === 'complete') {
          chrome.tabs.onUpdated.removeListener(listener);
          resolve();
        }
      }
      chrome.tabs.onUpdated.addListener(listener);
      setTimeout(resolve, 15000); // 15s fallback
    });
  }

  // Give Google Flow SPA 2.5 seconds to fully initialize
  await new Promise((r) => setTimeout(r, 2500));

  // Ensure content_flow.js is present in tab
  try {
    await chrome.scripting.executeScript({
      target: { tabId: flowTab.id },
      files: ['content_flow.js'],
    });
  } catch (e) {
    // Script already injected or restricted
  }

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
      chrome.tabs
        .sendMessage(callerTabId, {
          type: 'FLOW_GENERATE_SUCCESS',
          requestId,
          videoUrl,
          urls: [videoUrl],
        })
        .catch(() => {});
    }

    // Bring caller tab back to focus
    if (callerTabId) {
      chrome.tabs.update(callerTabId, { active: true }).catch(() => {});
    }

    return {
      videoUrl,
      urls: [videoUrl],
    };
  } finally {
    // Only close tab if it was newly opened by extension, otherwise keep user's existing tab
    if (isNewTab && flowTab?.id) {
      try {
        chrome.tabs.remove(flowTab.id);
      } catch (e) {}
    }
  }
}
