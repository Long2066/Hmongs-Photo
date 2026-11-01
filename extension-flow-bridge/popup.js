document.addEventListener('DOMContentLoaded', async () => {
  const authStatusEl = document.getElementById('authStatus');
  const btnLogin = document.getElementById('btnLogin');

  // Check auth status
  chrome.runtime.sendMessage({ action: 'CHECK_AUTH' }, (response) => {
    if (response && response.authenticated) {
      authStatusEl.innerHTML = '<span class="dot green"></span>Đã kết nối';
      authStatusEl.style.color = '#059669';
    } else {
      authStatusEl.innerHTML = '<span class="dot red"></span>Chưa đăng nhập';
      authStatusEl.style.color = '#dc2626';
    }
  });

  btnLogin.addEventListener('click', () => {
    chrome.runtime.sendMessage({ action: 'OPEN_LOGIN' });
  });
});
