import ReactTooltip from 'react-tooltip';
import { useEffect, useState, useCallback, useRef } from 'react';
import { GetMonitors } from '../common/uptimerobot';
import { formatDuration, formatNumber, formatRelativeTime, formatNextCheck } from '../common/helper';
import Link from './link';

function UptimeRobot({ apikey, onRefresh, isFirst }) {

  const statusText = {
    ok: '正常',
    down: '无法访问',
    unknow: '未知'
  };

  const { CountDays, ShowLink, CheckInterval } = window.Config;

  const [monitors, setMonitors] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);
  const [lastUpdate, setLastUpdate] = useState(null);
  const [, setTick] = useState(0); // 用于触发重新渲染（倒计时更新）
  const timerRef = useRef(null);

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

  // 倒计时定时器（每30秒更新一次显示）
  useEffect(() => {
    timerRef.current = setInterval(() => {
      setTick((t) => t + 1);
    }, 30000);

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, []);

  // 计算整体的下次检测时间（取所有监控中最早的）
  const getNextCheckText = () => {
    if (!monitors || monitors.length === 0) return '未知';
    let earliestNext = null;
    let earliestInterval = CheckInterval * 60; // 默认5分钟

    monitors.forEach((m) => {
      if (m.lastCheck && m.interval) {
        const nextCheck = m.lastCheck.valueOf() + m.interval * 1000;
        if (!earliestNext || nextCheck < earliestNext) {
          earliestNext = nextCheck;
          earliestInterval = m.interval;
        }
      }
    });

    if (!earliestNext) return '未知';
    const now = Date.now();
    const diffSeconds = Math.floor((earliestNext - now) / 1000);

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
  };

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
      {/* 状态信息栏 - 只在第一个 API Key 显示 */}
      {isFirst && (
        <div className="status-bar">
          <div className="status-info">
            <span className="status-item">
              <span className="status-label">最近更新：</span>
              <span className="status-value">{lastUpdate ? formatRelativeTime(lastUpdate) : '未知'}</span>
            </span>
            <span className="status-item">
              <span className="status-label">下次检测：</span>
              <span className="status-value">{getNextCheckText()}</span>
            </span>
          </div>
          <button className="refresh-btn" onClick={fetchData} disabled={loading} title="刷新数据">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M23 4v6h-6" />
              <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
            </svg>
            刷新
          </button>
        </div>
      )}

      {monitors.map((site) => (
        <div key={site.id} className="site">
          <div className="meta">
            <div className="name-row">
              <span className="name" dangerouslySetInnerHTML={{ __html: site.name }} />
              {ShowLink && site.url && <Link className="link" to={site.url} text={site.name} />}
            </div>
            <span className={'status ' + site.status}>{statusText[site.status]}</span>
          </div>

          {/* 标签显示 */}
          {site.tags && site.tags.length > 0 && (
            <div className="tags">
              {site.tags.map((tag, idx) => (
                <span key={idx} className="tag">{tag}</span>
              ))}
            </div>
          )}

          {/* 监控详情 */}
          <div className="monitor-meta">
            <span className="meta-item">
              <span className="meta-label">类型：</span>
              <span className="meta-value">{site.type || 'HTTP'}</span>
            </span>
            <span className="meta-item">
              <span className="meta-label">间隔：</span>
              <span className="meta-value">{site.interval ? Math.floor(site.interval / 60) : CheckInterval} 分钟</span>
            </span>
            <span className="meta-item">
              <span className="meta-label">上次检测：</span>
              <span className="meta-value">{site.lastCheck ? formatRelativeTime(site.lastCheck) : '未知'}</span>
            </span>
            <span className="meta-item">
              <span className="meta-label">下次检测：</span>
              <span className="meta-value">{formatNextCheck(site.lastCheck, site.interval || CheckInterval * 60)}</span>
            </span>
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
