import ReactTooltip from 'react-tooltip';
import { formatDuration, formatNumber } from '../common/helper';
import Link from './link';

// 估算下次检测时间
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
    'HTTP': '通过 HEAD 请求检测网站是否可访问（免费）',
    'HTTPS': '通过 HTTPS 请求检测网站是否可访问',
    'PING': '通过 Ping 检测服务器是否在线（免费）',
    'PORT': '检测端口是否开放',
    'KEYWORD': '检测页面是否包含指定关键词',
    'HEAD': '通过 HEAD 请求检测网站是否可访问（免费）',
  };

  return `
    <div class="tooltip-detail">
      <div class="tooltip-row"><span class="tooltip-label">监控类型：</span><span class="tooltip-value">${type === 'HTTP' ? 'HEAD' : type}</span></div>
      <div class="tooltip-desc">${typeDesc[type] || '监控站点可用性'}</div>
      <div class="tooltip-row"><span class="tooltip-label">检测间隔：</span><span class="tooltip-value">每 ${intervalMin} 分钟检测一次</span></div>
      <div class="tooltip-row"><span class="tooltip-label">状态持续：</span><span class="tooltip-value">已经${site.status === 'ok' ? '正常运行' : '出现故障'} ${stateDuration}</span></div>
      <div class="tooltip-row"><span class="tooltip-label">下次检测：</span><span class="tooltip-value">${nextCheck}进行下一次检测</span></div>
    </div>
  `;
}

function UptimeRobot({ monitors, error, loading, onRefresh }) {

  const statusText = {
    ok: '正常',
    down: '无法访问',
    unknow: '未知'
  };

  const config = window.Config || {};
  const CountDays = config.CountDays || 90;
  const ShowLink = config.ShowLink !== false;
  const CheckInterval = config.CheckInterval || 5;

  // 错误状态
  if (error) {
    return (
      <div className="site error-site">
        <div className="error-box">
          <div className="error-icon">❌</div>
          <h3>加载失败</h3>
          <p className="error-message">{error}</p>
          <button className="retry-btn" onClick={onRefresh} disabled={loading}>
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
                {site.type === 'HTTP' || !site.type ? 'HEAD' : site.type} / {site.interval ? Math.floor(site.interval / 60) : CheckInterval}m
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
