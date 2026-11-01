/**
 * Content Bridge Script for ImageTool Web App
 * 
 * Runs on https://vip-imagetools.vercel.app, *.vercel.app, and localhost
 * Bridges communication between web UI, Google Flow Extension, and Google Quota Station.
 */

// Mark DOM without violating Content Security Policy (No inline <script>)
try {
  document.documentElement.dataset.flowBridgeInstalled = 'true';
  document.documentElement.dataset.flowBridgeVersion = '1.0.5';
  window.dispatchEvent(new CustomEvent('imagetool-flow-bridge-ready', { detail: { version: '1.0.5' } }));
} catch (e) {
  // Ignore fallback
}

// Safely check if extension context is valid
function isExtensionValid() {
  try {
    return !!(typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.id);
  } catch (e) {
    return false;
  }
}

// Notify page via postMessage
function notifyPageReady() {
  if (!isExtensionValid()) return;
  try {
    document.documentElement.dataset.flowBridgeInstalled = 'true';
  } catch (e) {}

  window.postMessage(
    {
      type: 'FLOW_BRIDGE_PONG',
      version: '1.0.5',
      installed: true,
    },
    '*'
  );
}

notifyPageReady();
// Periodic announcement for SPAs after initial load
const timer = setInterval(() => {
  if (!isExtensionValid()) {
    clearInterval(timer);
    return;
  }
  notifyPageReady();
}, 2500);

// Listen for requests from web page
window.addEventListener('message', async (event) => {
  // Only accept messages from same window
  if (event.source !== window || !event.data || !event.data.type) return;

  const { type, requestId, payload } = event.data;

  // 1. Ping
  if (type === 'FLOW_BRIDGE_PING') {
    notifyPageReady();
    return;
  }

  // Check if extension was reloaded in developer mode
  if (!isExtensionValid()) {
    if (type === 'FLOW_EXECUTE_GENERATE') {
      window.postMessage(
        {
          type: 'FLOW_GENERATE_ERROR',
          requestId,
          error: 'Tiện ích mở rộng vừa được tải lại. Vui lòng bấm F5 (Tải lại trang web) để làm mới kết nối.',
        },
        '*'
      );
    }
    return;
  }

  // 2. Check Auth Status
  if (type === 'FLOW_CHECK_AUTH') {
    try {
      chrome.runtime.sendMessage({ action: 'CHECK_AUTH' }, (response) => {
        if (chrome.runtime.lastError) return;
        window.postMessage(
          {
            type: 'FLOW_AUTH_STATUS',
            requestId,
            ...response,
          },
          '*'
        );
      });
    } catch (e) {}
    return;
  }

  // 3. Open Flow login tab
  if (type === 'FLOW_TRIGGER_LOGIN') {
    try {
      chrome.runtime.sendMessage({ action: 'OPEN_LOGIN' }, (response) => {
        if (chrome.runtime.lastError) return;
        window.postMessage(
          {
            type: 'FLOW_LOGIN_TRIGGERED',
            requestId,
            ...response,
          },
          '*'
        );
      });
    } catch (e) {}
    return;
  }

  // 4. Request Video Generation
  if (type === 'FLOW_EXECUTE_GENERATE') {
    try {
      chrome.runtime.sendMessage(
        {
          action: 'GENERATE_VIDEO',
          requestId,
          payload,
        },
        (response) => {
          if (chrome.runtime.lastError) {
            window.postMessage(
              {
                type: 'FLOW_GENERATE_ERROR',
                requestId,
                error: chrome.runtime.lastError.message || 'Lỗi kết nối tiện ích mở rộng',
              },
              '*'
            );
          } else if (response && !response.ok) {
            window.postMessage(
              {
                type: 'FLOW_GENERATE_ERROR',
                requestId,
                error: response.error || 'Lỗi khi khởi chạy tạo video trên Flow',
              },
              '*'
            );
          }
        }
      );
    } catch (err) {
      console.warn('[Bridge] Extension context error:', err);
      window.postMessage(
        {
          type: 'FLOW_GENERATE_ERROR',
          requestId,
          error: 'Tiện ích mở rộng vừa được cập nhật. Vui lòng nhấn F5 (Tải lại trang web) để làm mới kết nối.',
        },
        '*'
      );
    }
    return;
  }
});

// Listen for progress/success events and OAuth captures from background script
try {
  if (isExtensionValid()) {
    chrome.runtime.onMessage.addListener((message) => {
      if (!message || !message.type) return;

      if (message.type.startsWith('FLOW_') || message.type.startsWith('QUOTA_')) {
        window.postMessage(message, '*');
      }
    });
  }
} catch (e) {}
