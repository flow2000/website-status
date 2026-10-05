import dayjs from 'dayjs';

// 从服务端代理 API 获取监控数据
// 服务端会调用 UptimeRobot V3 + V2 API 并合并数据
export async function GetMonitors(countDays) {
  try {
    const response = await fetch(`/api/monitors?days=${countDays}`);

    if (response.status === 429) {
      const data = await response.json().catch(() => ({}));
      const retryAfter = data.retryAfter || 60;
      throw new Error(`请求过于频繁，请 ${retryAfter} 秒后再试`);
    }

    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      throw new Error(data.error || `请求失败 (${response.status})`);
    }

    const data = await response.json();
    const monitors = data.monitors || [];

    // 将日期字符串转为 dayjs 对象（服务端返回的是字符串，需要转回日期对象）
    return monitors.map(m => ({
      ...m,
      daily: (m.daily || []).map(d => ({
        ...d,
        date: dayjs(d.date),
      })),
    }));
  } catch (err) {
    if (err.message.includes('Failed to fetch') || err.message.includes('fetch')) {
      throw new Error('无法连接到服务器，请检查网络或 API 配置');
    }
    throw err;
  }
}
