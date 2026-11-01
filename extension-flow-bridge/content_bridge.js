/**
 * Content Bridge Script for ImageTool Web App
 * 
 * Runs on https://vip-imagetools.vercel.app and localhost:3000
 * Bridges communication between web UI and Google Flow Extension.
 */

// Inject marker into document so web app knows extension is active
try {
  const markerScript = document.createElement('script');
  markerScript.textContent = `
    window.__IMAGETOOL_FLOW_BRIDGE_INSTALLED__ = true;
    window.__IMAGETOOL_FLOW_BRIDGE_VERSION__ = "1.0.0";
    window.dispatchEvent(new CustomEvent("imagetool-flow-bridge-ready", { detail: { version: "1.0.0" } }));
  `;
  (document.head || document.documentElement).appendChild(markerScript);
  markerScript.remove();
} catch (e) {
  // Ignore fallback
}

// Notify page via postMessage
function notifyPageReady() {
  window.postMessage({
    type: 'FLOW_BRIDGE_PONG',
    version: '1.0.0',
    installed: true,
  }, '*');
}

notifyPageReady();
// Periodic announcement for SPAs after initial load
setInterval(notifyPageReady, 3000);

// Listen for requests from web page
window.addEventListener('message', async (event) => {
  // Only accept messages from same origin/window
  if (event.source !== window || !event.data || !event.data.type) return;

  const { type, requestId, payload } = event.data;

  // 1. Ping
  if (type === 'FLOW_BRIDGE_PING') {
    notifyPageReady();
    return;
  }

  // 2. Check Auth Status
  if (type === 'FLOW_CHECK_AUTH') {
    chrome.runtime.sendMessage({ action: 'CHECK_AUTH' }, (response) => {
      window.postMessage({
        type: 'FLOW_AUTH_STATUS',
        requestId,
        ...response,
      }, '*');
    });
    return;
  }

  // 3. Open Flow login tab
  if (type === 'FLOW_TRIGGER_LOGIN') {
    chrome.runtime.sendMessage({ action: 'OPEN_LOGIN' }, (response) => {
      window.postMessage({
        type: 'FLOW_LOGIN_TRIGGERED',
        requestId,
        ...response,
      }, '*');
    });
    return;
  }

  // 4. Request Video Generation
  if (type === 'FLOW_EXECUTE_GENERATE') {
    chrome.runtime.sendMessage({
      action: 'GENERATE_VIDEO',
      requestId,
      payload,
    }, (response) => {
      if (chrome.runtime.lastError) {
        window.postMessage({
          type: 'FLOW_GENERATE_ERROR',
          requestId,
          error: chrome.runtime.lastError.message || 'Lỗi kết nối tiện ích mở rộng',
        }, '*');
      }
    });
    return;
  }
});

// Listen for progress/success events from background
chrome.runtime.onMessage.addListener((message) => {
  if (!message || !message.type) return;

  if (message.type.startsWith('FLOW_')) {
    window.postMessage(message, '*');
  }
});
