
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';

// CLEAR SESSION ON APP START - Yêu cầu đăng nhập lại mỗi lần mở app
localStorage.removeItem('image_gen_logged_in_user');

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
