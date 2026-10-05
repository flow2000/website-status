// Vercel Serverless Function - /api/monitors
// 代理 UptimeRobot API，隐藏 API Key，并做限流

// 简单内存限流（serverless 环境下尽力而为）
const rateLimitMap = new Map();
const RATE_LIMIT = 60; // 每分钟最多请求次数
const RATE_WINDOW = 60 * 1000; // 60秒窗口

function checkRateLimit(ip) {
  const now = Date.now();
  const windowStart = now - RATE_WINDOW;

  if (!rateLimitMap.has(ip)) {
    rateLimitMap.set(ip, { count: 1, firstTime: now });
    return { ok: true, remaining: RATE_LIMIT - 1 };
  }

  const record = rateLimitMap.get(ip);

  // 窗口过期，重置
  if (record.firstTime < windowStart) {
    record.count = 1;
    record.firstTime = now;
    return { ok: true, remaining: RATE_LIMIT - 1 };
  }

  if (record.count >= RATE_LIMIT) {
    const retryAfter = Math.ceil((record.firstTime + RATE_WINDOW - now) / 1000);
    return { ok: false, retryAfter };
  }

  record.count++;
  return { ok: true, remaining: RATE_LIMIT - record.count };
}

// 定期清理过期记录
setInterval(() => {
  const now = Date.now();
  const windowStart = now - RATE_WINDOW;
  for (const [ip, record] of rateLimitMap) {
    if (record.firstTime < windowStart) {
      rateLimitMap.delete(ip);
    }
  }
}, RATE_WINDOW);

async function fetchMonitorsV3(apiKey, days) {
  const url = `https://api.uptimerobot.com/v3/monitors?limit=200`;
  const response = await fetch(url, {
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`V3 API 请求失败 (${response.status}): ${text}`);
  }

  const data = await response.json();
  return data.data || data.items || [];
}

async function fetchUptimeV2(apiKey, days) {
  // 生成 custom_uptime_ranges 字符串
  const ranges = [];
  const now = new Date();
  for (let i = 0; i < days; i++) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    d.setHours(0, 0, 0, 0);
    const start = Math.floor(d.getTime() / 1000);
    const end = start + 86400 - 1;
    ranges.push(`${start}_${end}`);
  }

  const params = new URLSearchParams();
  params.append('api_key', apiKey);
  params.append('format', 'json');
  params.append('logs', '1');
  params.append('log_types', '1-2');
  params.append('logs_limit', '100');
  params.append('response_times', '0');
  params.append('custom_uptime_ranges', ranges.join('-'));

  const response = await fetch('https://api.uptimerobot.com/v2/getMonitors', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: params.toString(),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`V2 API 请求失败 (${response.status}): ${text}`);
  }

  const data = await response.json();
  if (data.stat !== 'ok') {
    throw new Error(data.error?.message || 'UptimeRobot API 返回错误');
  }

  return data.monitors || [];
}

function mergeMonitorData(v3Monitor, v2Monitor, days) {
  const id = String(v3Monitor.id);
  const status = v3Monitor.status === 'UP' ? 'ok' : (v3Monitor.status === 'DOWN' ? 'down' : 'unknow');

  // 解析标签
  const tags = (v3Monitor.tags || []).map(t => t.name);

  // 解析可用率数据
  let daily = [];
  let totalDownTimes = 0;
  let totalDownDuration = 0;

  if (v2Monitor && v2Monitor.custom_uptime_ranges) {
    const ranges = String(v2Monitor.custom_uptime_ranges).split('-');
    const now = new Date();
    daily = ranges.map((rate, index) => {
      const d = new Date(now);
      d.setDate(d.getDate() - index);
      d.setHours(0, 0, 0, 0);
      const uptime = parseFloat(rate) || 0;
      const duration = Math.round((100 - uptime) / 100 * 86400);
      return {
        date: d,
        uptime: uptime,
        down: { times: uptime < 100 ? 1 : 0, duration: duration },
      };
    }).reverse();

    // 计算总故障次数和总时长（从日志中估算）
    if (v2Monitor.logs) {
      const startTime = Math.floor((now.getTime() - days * 86400 * 1000) / 1000);
      const downLogs = v2Monitor.logs.filter(l => l.type === 1 && l.datetime >= startTime);
      totalDownTimes = downLogs.length;
      totalDownDuration = downLogs.reduce((sum, l) => sum + (l.duration || 0), 0);
    }
  }

  // 计算平均可用率
  let average = 100;
  if (daily.length > 0) {
    const sum = daily.reduce((s, d) => s + d.uptime, 0);
    average = (sum / daily.length).toFixed(2);
  }

  return {
    id,
    name: v3Monitor.friendlyName || 'Unnamed',
    url: v3Monitor.url || '',
    type: v3Monitor.type || 'HTTP',
    interval: v3Monitor.interval || 300,
    tags,
    average,
    daily,
    total: { times: totalDownTimes, duration: totalDownDuration },
    status,
    currentStateDuration: v3Monitor.currentStateDuration || 0,
  };
}

export default async function handler(req, res) {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // 限流
  const ip = req.headers['x-forwarded-for'] || req.headers['x-real-ip'] || req.socket?.remoteAddress || 'unknown';
  const rateResult = checkRateLimit(ip);
  res.setHeader('X-RateLimit-Limit', RATE_LIMIT);
  res.setHeader('X-RateLimit-Remaining', rateResult.ok ? rateResult.remaining : 0);

  if (!rateResult.ok) {
    res.setHeader('Retry-After', rateResult.retryAfter);
    return res.status(429).json({
      error: '请求过于频繁，请稍后再试',
      retryAfter: rateResult.retryAfter,
    });
  }

  try {
    // 从环境变量读取 API Key
    const apiKeysStr = process.env.UPTIMEROBOT_API_KEYS || process.env.REACT_APP_UPTIMEROBOT_API_KEYS || '';
    if (!apiKeysStr) {
      return res.status(500).json({ error: '未配置 UptimeRobot API Key，请在环境变量 UPTIMEROBOT_API_KEYS 中设置' });
    }

    const apiKeys = apiKeysStr.split(',').map(k => k.trim()).filter(Boolean);
    if (apiKeys.length === 0) {
      return res.status(500).json({ error: 'API Key 配置为空' });
    }

    const days = parseInt(req.query.days) || 90;

    const allMonitors = [];

    for (const apiKey of apiKeys) {
      // 并行获取 V3 和 V2 数据
      const [v3Monitors, v2Monitors] = await Promise.all([
        fetchMonitorsV3(apiKey, days),
        fetchUptimeV2(apiKey, days),
      ]);

      // 建立 V2 数据的索引
      const v2Map = {};
      v2Monitors.forEach(m => {
        v2Map[String(m.id)] = m;
      });

      // 合并数据
      v3Monitors.forEach(v3 => {
        const v2 = v2Map[String(v3.id)];
        allMonitors.push(mergeMonitorData(v3, v2, days));
      });
    }

    return res.status(200).json({
      monitors: allMonitors,
      total: allMonitors.length,
    });
  } catch (err) {
    console.error('API Error:', err);
    return res.status(500).json({
      error: err.message || '服务器内部错误',
    });
  }
}
