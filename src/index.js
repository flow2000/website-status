import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './components/app';
import './app.scss';

// Patch Selection.prototype.getRangeAt
// 某些浏览器扩展（翻译、划词、沉浸式翻译等）会在点击/选择文本时
// 调用 Selection.getRangeAt(0)，但当没有选区时会抛出 IndexSizeError。
// 这里 patch 原生方法，越界时返回 null 而非抛错，避免控制台污染。
try {
  const originalGetRangeAt = Selection.prototype.getRangeAt;
  Selection.prototype.getRangeAt = function (index) {
    if (index < 0 || index >= this.rangeCount) {
      return null;
    }
    return originalGetRangeAt.call(this, index);
  };
} catch (e) {
  // 某些环境可能不允许修改原型，忽略即可
}

// 全局错误捕获：忽略浏览器扩展（content script）引发的非关键错误
window.addEventListener('error', (e) => {
  const msg = e.message || '';
  const filename = e.filename || '';
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
