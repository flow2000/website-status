export function formatNumber(value) {
  return (Math.floor(value * 100) / 100).toString();
}

export function formatDuration(seconds) {
  let s = parseInt(seconds);
  let m = 0;
  let h = 0;
  let d = 0;
  if (s >= 60) {
    m = parseInt(s / 60);
    s = parseInt(s % 60);
    if (m >= 60) {
      h = parseInt(m / 60);
      m = parseInt(m % 60);
      if (h >= 24) {
        d = parseInt(h / 24);
        h = parseInt(h % 24);
      }
    }
  }
  let text = `${s} 秒`;
  if (m > 0) text = `${m} 分 ${text}`;
  if (h > 0) text = `${h} 小时 ${text}`;
  if (d > 0) text = `${d} 天 ${text}`;
  return text;
}

// 格式化相对时间（例如："5分钟前"、"2小时前"）
export function formatRelativeTime(dateObj) {
  if (!dateObj) return '未知';
  const now = Date.now();
  const target = dateObj.valueOf ? dateObj.valueOf() : new Date(dateObj).getTime();
  const diffSeconds = Math.floor((now - target) / 1000);

  if (diffSeconds < 0) return '即将到来';
  if (diffSeconds < 60) return `${diffSeconds} 秒前`;
  if (diffSeconds < 3600) return `${Math.floor(diffSeconds / 60)} 分钟前`;
  if (diffSeconds < 86400) return `${Math.floor(diffSeconds / 3600)} 小时前`;
  if (diffSeconds < 2592000) return `${Math.floor(diffSeconds / 86400)} 天前`;
  return dateObj.format ? dateObj.format('YYYY-MM-DD HH:mm') : new Date(target).toLocaleString();
}

// 计算下次检测的剩余时间
export function formatNextCheck(lastCheck, intervalSeconds) {
  if (!lastCheck || !intervalSeconds) return '未知';
  const nextCheckTime = lastCheck.valueOf() + intervalSeconds * 1000;
  const now = Date.now();
  const diffSeconds = Math.floor((nextCheckTime - now) / 1000);

  if (diffSeconds <= 0) return '即将检测';
  if (diffSeconds < 60) return `${diffSeconds} 秒后`;
  if (diffSeconds < 3600) {
    const m = Math.floor(diffSeconds / 60);
    const s = diffSeconds % 60;
    return `${m} 分 ${s} 秒后`;
  }
  const h = Math.floor(diffSeconds / 3600);
  const m = Math.floor((diffSeconds % 3600) / 60);
  return `${h} 小时 ${m} 分后`;
}
