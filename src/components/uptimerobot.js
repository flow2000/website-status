import ReactTooltip from 'react-tooltip';
import { useEffect, useState, useCallback, useRef } from 'react';
import { GetMonitors } from '../common/uptimerobot';
import { formatDuration, formatNumber } from '../common/helper';
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

// 格式化倒计时显示
function formatCountdown(seconds) {
  if (seconds <= 0) return '即将刷新';
  if (seconds < 60) return `${seconds} 秒`;
  if (seconds < 3600) {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m} 分 ${s} 秒`;
  }
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  return `${h} 小时 ${m} 分`;
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

function UptimeRobot({ isFirst }) {

  const statusText = {
    ok: '正常',
    down: '无法访问',
    unknow: '未知'
  };

  const config = window.Config || {};
  const CountDays = config.CountDays || 90;
  const ShowLink = config.ShowLink !== false;
  const CheckInterval = config.CheckInterval || 5; // 分钟

  const [monitors, setMonitors] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);
  const [countdown, setCountdown] = useState(CheckInterval * 60); // 倒计时秒数
  const countdownTimerRef = useRef(null);

  // 计算所有监控中最早的下次检测秒数
  const getMinNextCheckSeconds = useCallback(() => {
    if (!monitors || monitors.length === 0) return CheckInterval * 60;
    let min = Infinity;
    monitors.forEach((m) => {
      const secs = getNextCheckSeconds(m.currentStateDuration, m.interval || CheckInterval * 60);
      if (secs !== null && secs < min) min = secs;
    });
    // 至少留5秒缓冲，避免立即刷新
    return min === Infinity ? CheckInterval * 60 : Math.max(Math.ceil(min), 5);
  }, [monitors, CheckInterval]);

  // 刷新数据
  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await GetMonitors(CountDays);
      setMonitors(data);
    } catch (err) {
      setError(err.message || '加载失败');
      setMonitors(null);
    } finally {
      setLoading(false);
    }
  }, [CountDays]);

  // 数据加载完成后，根据最早的下次检测时间设置倒计时
  useEffect(() => {
    if (!loading && !error && monitors) {
      setCountdown(getMinNextCheckSeconds());
    }
  }, [loading, error, monitors, getMinNextCheckSeconds]);

  // 初始加载
  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // 倒计时定时器：每秒递减，到0自动刷新
  useEffect(() => {
    if (loading || error || !monitors) return;

    countdownTimerRef.current = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          // 倒计时结束，触发刷新（刷新后 useEffect 会重新设置倒计时）
          fetchData();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      if (countdownTimerRef.current) {
        clearInterval(countdownTimerRef.current);
      }
    };
  }, [loading, error, monitors, fetchData]);

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
      {/* 动态状态栏 - 只在第一个显示 */}
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
              <span className="status-label">下次刷新：</span>
              <span className="status-value countdown-value">{formatCountdown(countdown)}</span>
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
