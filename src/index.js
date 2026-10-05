import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './components/app';
import './app.scss';

// 全局错误捕获：忽略浏览器扩展（content script）引发的非关键错误
// 例如 Selection.getRangeAt 错误通常由翻译、划词等扩展导致
window.addEventListener('error', (e) => {
  const msg = e.message || '';
  const filename = e.filename || '';
  // 忽略扩展 content script 中的 Selection 相关错误
  if (
    msg.includes('getRangeAt') ||
    msg.includes('Selection') ||
    filename.includes('content.js') ||
    filename.includes('content-script')
  ) {
    e.preventDefault();
    e.stopPropagation();
    return false;
  }
}, true);

const root = ReactDOM.createRoot(document.getElementById('app'));
root.render(<App />);
