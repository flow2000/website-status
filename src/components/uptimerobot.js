import ReactTooltip from 'react-tooltip';
import { useEffect, useState, useCallback, useRef } from 'react';
import { GetMonitors } from '../common/uptimerobot';
import { formatDuration, formatNumber, formatRelativeTime } from '../common/helper';
import Link from './link';

// 估算下次检测时间（基于当前状态持续时间和监控间隔）
function getNextCheckSeconds(currentStateDuration, intervalSeconds) {
  if (!intervalSeconds) return null;
  const elapsed = currentStateDuration || 0;
  const sinceLastCheck = elapsed % intervalSeconds;
  return intervalSeconds - sinceLastCheck;
}

function getNextCheckText(currentStateDuration, intervalSeconds) {
  const secondsUntilNext = getNextCheckSeconds(currentStateDuration, intervalSeconds);
  if (secondsUntilNext === null) return '未知';
  if (secondsUntilNext <= 0) return '即将检测';
  if (secondsUntilNext < 60) return `${secondsUntilNext} 秒后`;
  if (secondsUntilNext < 3600) {
    const m = Math.floor(secondsUntilNext / 60);
    const s = secondsUntilNext % 60;
    return `${m} 分 ${s} 秒后`;
  }
  const h = Math.floor(secondsUntilNext / 3600);
  const m = Math.floor((secondsUntilNext % 3600) / 60);
  return `${h} 小时 ${m} 分后`;
}

// 生成监控详情的大白话描述（用于tooltip）
function getMonitorTooltip(site, checkInterval) {
  const type = site.type || 'HTTP';
  const intervalMin = site.interval ? Math.floor(site.interval / 60) : checkInterval;
  const stateDuration = site.currentStateDuration ? formatDuration(site.currentStateDuration) : '未知';
  const nextCheck = getNextCheckText(site.currentStateDuration, site.interval || checkInterval * 60);

  const typeDesc = {
    'HTTP': '通过 HTTP 请求检测网站是否可访问',
    'HTTPS': '通过 HTTPS 请求检测网站是否可访问',
    'PING': '通过 Ping 检测服务器是否在线',
    'PORT': '检测端口是否开放',
    'KEYWORD': '检测页面是否包含指定关键词',
  };

  return `
    <div class="tooltip-detail">
      <div class="tooltip-row"><span class="tooltip-label">监控类型：</span><span class="tooltip-value">${type}</span></div>
      <div class="tooltip-desc">${typeDesc[type] || '监控站点可用性'}</div>
      <div class="tooltip-row"><span class="tooltip-label">检测间隔：</span><span class="tooltip-value">每 ${intervalMin} 分钟检测一次</span></div>
      <div class="tooltip-row"><span class="tooltip-label">状态持续：</span><span class="tooltip-value">已经${site.status === 'ok' ? '正常运行' : '出现故障'} ${stateDuration}</span></div>
      <div class="tooltip-row"><span class="tooltip-label">下次检测：</span><span class="tooltip-value">${nextCheck}进行下一次检测</span></div>
    </div>
  `;
}

function UptimeRobot({ apikey, onRefresh, isFirst }) {

  const statusText = {
    ok: '正常',
    down: '无法访问',
    unknow: '未知'
  };

  const config = window.Config || {};
  const CountDays = config.CountDays || 90;
  const ShowLink = config.ShowLink !== false;
  const CheckInterval = config.CheckInterval || 5;

  const [monitors, setMonitors] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);
  const [lastUpdate, setLastUpdate] = useState(null);
  const [, setTick] = useState(0); // 用于触发重新渲染（倒计时更新）
  const tickTimerRef = useRef(null);

  // 刷新数据
  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await GetMonitors(apikey, CountDays);
      setMonitors(data);
      setLastUpdate(new Date());
      if (onRefresh) onRefresh();
    } catch (err) {
      setError(err.message || '加载失败');
      setMonitors(null);
    } finally {
      setLoading(false);
    }
  }, [apikey, CountDays, onRefresh]);

  // 初始加载
  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // 计算最早的下次检测秒数
  const getMinNextCheckSeconds = useCallback(() => {
    if (!monitors || monitors.length === 0) return null;
    let min = Infinity;
    monitors.forEach((m) => {
      const secs = getNextCheckSeconds(m.currentStateDuration, m.interval || CheckInterval * 60);
      if (secs !== null && secs < min) min = secs;
    });
    return min === Infinity ? null : min;
  }, [monitors, CheckInterval]);

  // 每秒更新倒计时 + 自动刷新检测（纯JS定时器）
  useEffect(() => {
    if (!monitors) return;

    let secondsPassed = 0;
    tickTimerRef.current = setInterval(() => {
      secondsPassed += 1;
      setTick((t) => t + 1);

      // 计算当前距离下次检测还有多少秒
      const minNextSeconds = getMinNextCheckSeconds();
      if (minNextSeconds !== null) {
        const remaining = minNextSeconds - secondsPassed;
        // 剩余时间小于等于0时，自动刷新（多等2秒确保API有新数据）
        if (remaining <= -2) {
          secondsPassed = 0;
          fetchData();
        }
      }
    }, 1000);

    return () => {
      if (tickTimerRef.current) {
        clearInterval(tickTimerRef.current);
      }
    };
  }, [monitors, getMinNextCheckSeconds, fetchData]);

  // 计算整体的下次检测时间（取所有监控中最早的）
  const getNextCheckTextGlobal = () => {
    const secs = getMinNextCheckSeconds();
    if (secs === null) return '未知';
    if (secs <= 0) return '即将检测';
    if (secs < 60) return `${secs} 秒后`;
    if (secs < 3600) {
      const m = Math.floor(secs / 60);
      const s = secs % 60;
      return `${m} 分 ${s} 秒后`;
    }
    const h = Math.floor(secs / 3600);
    const m = Math.floor((secs % 3600) / 60);
    return `${h} 小时 ${m} 分后`;
  };

  // 计算正常/异常监控数量
  const getStatusCounts = () => {
    if (!monitors) return { ok: 0, down: 0, total: 0 };
    const counts = { ok: 0, down: 0, total: monitors.length };
    monitors.forEach((m) => {
      if (m.status === 'ok') counts.ok++;
      else if (m.status === 'down') counts.down++;
    });
    return counts;
  };

  const statusCounts = getStatusCounts();
  const allOk = statusCounts.down === 0 && statusCounts.total > 0;

  // 错误状态
  if (error) {
    return (
      <div className="site error-site">
        <div className="error-box">
          <div className="error-icon">❌</div>
          <h3>加载失败</h3>
          <p className="error-message">{error}</p>
          <button className="retry-btn" onClick={fetchData} disabled={loading}>
            {loading ? '加载中...' : '重新加载'}
          </button>
        </div>
      </div>
    );
  }

  // 加载状态
  if (loading || !monitors) {
    return (
      <div className="site">
        <div className="loading" />
      </div>
    );
  }

  // 空数据状态
  if (monitors.length === 0) {
    return (
      <div className="site empty-site">
        <div className="empty-box">
          <div className="empty-icon">📭</div>
          <h3>暂无监控站点</h3>
          <p>当前 API Key 下没有监控站点</p>
        </div>
      </div>
    );
  }

  return (
    <>
      {/* 动态状态栏 - 只在第一个 API Key 显示 */}
      {isFirst && (
        <div className={`status-bar ${allOk ? 'status-all-ok' : 'status-has-down'}`}>
          {/* 动态脉冲指示器 */}
          <div className="pulse-indicator">
            <span className={`pulse-dot ${allOk ? 'pulse-ok' : 'pulse-down'}`}>
              <span className="pulse-ring"></span>
              <span className="pulse-ring pulse-delay"></span>
            </span>
            <span className="pulse-text">
              {allOk ? '全部正常' : `${statusCounts.down} 个异常`}
            </span>
          </div>

          <div className="status-info">
            <span className="status-item">
              <span className="status-label">监控总数：</span>
              <span className="status-value">{statusCounts.total}</span>
            </span>
            <span className="status-item">
              <span className="status-label">最近更新：</span>
              <span className="status-value">{lastUpdate ? formatRelativeTime(lastUpdate) : '未知'}</span>
            </span>
            <span className="status-item">
              <span className="status-label">下次检测：</span>
              <span className="status-value">{getNextCheckTextGlobal()}</span>
            </span>
          </div>

          <div className="status-actions">
            <button className="refresh-btn" onClick={fetchData} disabled={loading} title="刷新数据">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={loading ? 'spin' : ''}>
                <path d="M23 4v6h-6" />
                <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
              </svg>
              刷新
            </button>
          </div>
        </div>
      )}

      {monitors.map((site) => (
        <div key={site.id} className="site">
          <div className="meta">
            <div className="name-row">
              {/* 标签 */}
              {site.tags && site.tags.length > 0 && (
                <div className="tags-inline">
                  {site.tags.map((tag, idx) => (
                    <span key={idx} className="tag tag-inline">{tag}</span>
                  ))}
                  <span className="tag-separator">|</span>
                </div>
              )}
              {/* 名称 */}
              <span className="name" dangerouslySetInnerHTML={{ __html: site.name }} />
              {/* 类型/间隔徽章 - 悬浮显示详情 */}
              <span
                className="monitor-badge"
                data-tip={getMonitorTooltip(site, CheckInterval)}
                data-html={true}
              >
                {site.type || 'HTTP'} / {site.interval ? Math.floor(site.interval / 60) : CheckInterval}m
              </span>
              {/* 外链 */}
              {ShowLink && site.url && <Link className="link" to={site.url} text={site.name} />}
            </div>
            <span className={'status ' + site.status}>{statusText[site.status]}</span>
          </div>

          <div className="timeline">
            {site.daily && site.daily.length > 0 ? site.daily.map((data, index) => {
              let status = '';
              let text = data.date.format('YYYY-MM-DD ');
              if (data.uptime >= 100) {
                status = 'ok';
                text += `可用率 ${formatNumber(data.uptime)}%`;
              }
              else if (data.uptime <= 0 && data.down.times === 0) {
                status = 'none';
                text += '无数据';
              }
              else {
                status = 'down';
                text += `故障 ${data.down.times} 次，累计 ${formatDuration(data.down.duration)}，可用率 ${formatNumber(data.uptime)}%`;
              }
              return (<i key={index} className={status} data-tip={text} />)
            }) : (
              <div className="no-data">暂无可用率数据</div>
            )}
          </div>

          <div className="summary">
            <span>今天</span>
            <span>
              {site.total && site.total.times
                ? `最近 ${CountDays} 天故障 ${site.total.times} 次，累计 ${formatDuration(site.total.duration)}，平均可用率 ${site.average}%`
                : `最近 ${CountDays} 天可用率 ${site.average}%`}
            </span>
            <span>{site.daily && site.daily.length > 0 ? site.daily[site.daily.length - 1].date.format('YYYY-MM-DD') : ''}</span>
          </div>
          <ReactTooltip className="tooltip" place="top" type="dark" effect="solid" />
        </div>
      ))}
    </>
  );
}

export default UptimeRobot;
