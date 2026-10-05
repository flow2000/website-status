// Netlify Function - /api/monitors
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
  const tags = (v3Monitor.tags || []).map(t => t.name);

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

    if (v2Monitor.logs) {
      const startTime = Math.floor((now.getTime() - days * 86400 * 1000) / 1000);
      const downLogs = v2Monitor.logs.filter(l => l.type === 1 && l.datetime >= startTime);
      totalDownTimes = downLogs.length;
      totalDownDuration = downLogs.reduce((sum, l) => sum + (l.duration || 0), 0);
    }
  }

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

exports.handler = async function(event, context) {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Content-Type': 'application/json',
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  // 限流
  const ip = event.headers['x-forwarded-for']
    || event.headers['x-nf-client-connection-ip']
    || event.headers['client-ip']
    || 'unknown';

  const rateResult = checkRateLimit(ip);
  headers['X-RateLimit-Limit'] = String(RATE_LIMIT);
  headers['X-RateLimit-Remaining'] = String(rateResult.ok ? rateResult.remaining : 0);

  if (!rateResult.ok) {
    headers['Retry-After'] = String(rateResult.retryAfter);
    return {
      statusCode: 429,
      headers,
      body: JSON.stringify({
        error: '请求过于频繁，请稍后再试',
        retryAfter: rateResult.retryAfter,
      }),
    };
  }

  try {
    const apiKeysStr = process.env.UPTIMEROBOT_API_KEYS || process.env.REACT_APP_UPTIMEROBOT_API_KEYS || '';
    if (!apiKeysStr) {
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({ error: '未配置 UptimeRobot API Key，请在环境变量 UPTIMEROBOT_API_KEYS 中设置' }),
      };
    }

    const apiKeys = apiKeysStr.split(',').map(k => k.trim()).filter(Boolean);
    if (apiKeys.length === 0) {
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({ error: 'API Key 配置为空' }),
      };
    }

    const params = event.queryStringParameters || {};
    const days = parseInt(params.days) || 90;

    const allMonitors = [];

    for (const apiKey of apiKeys) {
      const [v3Monitors, v2Monitors] = await Promise.all([
        fetchMonitorsV3(apiKey, days),
        fetchUptimeV2(apiKey, days),
      ]);

      const v2Map = {};
      v2Monitors.forEach(m => {
        v2Map[String(m.id)] = m;
      });

      v3Monitors.forEach(v3 => {
        const v2 = v2Map[String(v3.id)];
        allMonitors.push(mergeMonitorData(v3, v2, days));
      });
    }

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        monitors: allMonitors,
        total: allMonitors.length,
      }),
    };
  } catch (err) {
    console.error('API Error:', err);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: err.message || '服务器内部错误' }),
    };
  }
};
