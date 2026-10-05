import axios from 'axios';
import dayjs from 'dayjs';
import { formatNumber } from './helper';

const V3_API_BASE = 'https://api.uptimerobot.com/v3';
const V2_API_URL = 'https://api.uptimerobot.com/v2/getMonitors';

// V3 状态映射
const STATUS_MAP_V3 = {
  UP: 'ok',
  DOWN: 'down',
  LOOKS_DOWN: 'down',
  STARTED: 'unknow',
  PAUSED: 'unknow',
};

// V2 状态映射
const STATUS_MAP_V2 = {
  2: 'ok',
  9: 'down',
};

// 创建 V3 API 客户端
function createV3Client(apiKey) {
  return axios.create({
    baseURL: V3_API_BASE,
    timeout: 15000,
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
  });
}

// 获取所有监控列表（V3 API，含标签）
async function fetchMonitorsV3(client) {
  const allMonitors = [];
  let cursor = null;

  do {
    const params = { limit: 200 };
    if (cursor) params.cursor = cursor;

    const response = await client.get('/monitors', { params });
    const data = response.data;

    if (data.items && Array.isArray(data.items)) {
      allMonitors.push(...data.items);
    }

    cursor = data.pagination?.nextCursor || null;
  } while (cursor);

  return allMonitors;
}

// 从 V3 监控数据中提取标签
function extractTags(monitor) {
  if (Array.isArray(monitor.tags)) {
    return monitor.tags.map((t) => {
      if (typeof t === 'string') return t;
      return t.name || t.value || t.label || '';
    }).filter(Boolean);
  }
  return [];
}

// 获取可用率数据（V2 API，使用 custom_uptime_ranges）
async function fetchUptimeV2(apiKey, days) {
  const dates = [];
  const today = dayjs(new Date().setHours(0, 0, 0, 0));
  for (let d = 0; d < days; d++) {
    dates.push(today.subtract(d, 'day'));
  }

  const ranges = dates.map((date) => `${date.unix()}_${date.add(1, 'day').unix()}`);
  const start = dates[dates.length - 1].unix();
  const end = dates[0].add(1, 'day').unix();
  ranges.push(`${start}_${end}`);

  const postdata = {
    api_key: apiKey,
    format: 'json',
    logs: 1,
    log_types: '1-2',
    logs_start_date: start,
    logs_end_date: end,
    custom_uptime_ranges: ranges.join('-'),
  };

  const response = await axios.post(V2_API_URL, postdata, { timeout: 15000 });
  if (response.data.stat !== 'ok') {
    const err = response.data.error || {};
    throw new Error(err.message || `API 错误: ${err.type || 'unknown'}`);
  }

  // 构建以 monitor ID 为键的映射
  const uptimeMap = {};
  response.data.monitors.forEach((monitor) => {
    const monitorRanges = monitor.custom_uptime_ranges.split('-');
    const average = formatNumber(monitorRanges.pop());
    const daily = [];
    const dateMap = [];

    dates.forEach((date, index) => {
      dateMap[date.format('YYYYMMDD')] = index;
      daily[index] = {
        date: date,
        uptime: formatNumber(monitorRanges[index]),
        down: { times: 0, duration: 0 },
      };
    });

    const total = monitor.logs.reduce((total, log) => {
      if (log.type === 1) {
        const date = dayjs.unix(log.datetime).format('YYYYMMDD');
        total.duration += log.duration;
        total.times += 1;
        if (dateMap[date] !== undefined) {
          daily[dateMap[date]].down.duration += log.duration;
          daily[dateMap[date]].down.times += 1;
        }
      }
      return total;
    }, { times: 0, duration: 0 });

    uptimeMap[monitor.id] = {
      average,
      daily,
      total,
      status: STATUS_MAP_V2[monitor.status] || 'unknow',
    };
  });

  return uptimeMap;
}

// 主函数：获取监控数据
export async function GetMonitors(apikey, days) {
  const v3Client = createV3Client(apikey);

  try {
    // 1. 使用 V3 API 获取监控列表（含标签）
    const monitorsV3 = await fetchMonitorsV3(v3Client);

    // 2. 使用 V2 API 获取可用率数据
    let uptimeMap = {};
    try {
      uptimeMap = await fetchUptimeV2(apikey, days);
    } catch (v2Error) {
      // V2 API 失败时，用空数据填充
      console.warn('V2 API 获取可用率数据失败，将使用默认数据:', v2Error.message);
    }

    // 3. 合并数据
    const results = monitorsV3.map((monitor) => {
      const id = String(monitor.id);
      const uptimeData = uptimeMap[id] || {
        average: '100',
        daily: [],
        total: { times: 0, duration: 0 },
        status: 'unknow',
      };

      // 优先使用 V2 的状态（更准确），否则用 V3 的状态
      const status = uptimeData.status !== 'unknow'
        ? uptimeData.status
        : STATUS_MAP_V3[monitor.status] || 'unknow';

      // 获取 lastCheck 时间
      let lastCheck = null;
      if (monitor.lastCheckAt) {
        lastCheck = dayjs(monitor.lastCheckAt);
      } else if (monitor.lastCheck) {
        lastCheck = dayjs(monitor.lastCheck);
      }

      return {
        id: id,
        name: monitor.friendlyName || monitor.name || 'Unnamed',
        url: monitor.url || monitor.target || '',
        type: monitor.type || 'HTTP',
        interval: monitor.interval || 300, // 秒
        tags: extractTags(monitor),
        average: uptimeData.average,
        daily: uptimeData.daily,
        total: uptimeData.total,
        status: status,
        lastCheck: lastCheck,
        createDateTime: monitor.createDateTime || null,
      };
    });

    return results;
  } catch (error) {
    // 统一错误处理
    if (error.response) {
      const status = error.response.status;
      const data = error.response.data;

      if (status === 401 || status === 403) {
        throw new Error('API Key 无效或没有权限，请检查您的 API Key 配置');
      }
      if (status === 429) {
        const retryAfter = error.response.headers['retry-after'] || '60';
        throw new Error(`API 请求频率过高，请 ${retryAfter} 秒后再试`);
      }
      if (data && data.message) {
        throw new Error(data.message);
      }
      if (data && data.error && data.error.message) {
        throw new Error(data.error.message);
      }
      throw new Error(`API 请求失败 (HTTP ${status})`);
    }
    if (error.code === 'ECONNABORTED') {
      throw new Error('请求超时，请检查网络连接或稍后再试');
    }
    if (error.message === 'Network Error' || error.code === 'NETWORK_ERROR') {
      throw new Error('无法连接到 UptimeRobot API，请检查网络连接');
    }
    throw error;
  }
}
