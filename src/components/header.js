import { useEffect, useMemo, useState } from 'react';
import Link from './link';

// 根据故障情况计算 banner 颜色等级
// level: 0=全部正常, 1=轻微故障, 2=中等故障, 3=严重故障
function getStatusLevel(monitors) {
  if (!monitors || monitors.length === 0) return 0;
  const downCount = monitors.filter(m => m.status === 'down').length;
  if (downCount === 0) return 0;

  const total = monitors.length;
  const ratio = downCount / total;

  if (ratio >= 0.5) return 3; // 一半以上故障
  if (ratio >= 0.25) return 2; // 1/4以上故障
  return 1; // 少量故障
}

// 格式化倒计时
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

function Header({ monitors, countdown, onRefresh, loading }) {
  const siteName = useMemo(() => {
    if (process.env.REACT_APP_SITE_NAME) {
      return process.env.REACT_APP_SITE_NAME;
    }
    return window.Config?.SiteName || '站点监控';
  }, []);

  const navi = useMemo(() => {
    return window.Config?.Navi || [];
  }, []);

  const [currentTime, setCurrentTime] = useState('');

  useEffect(() => {
    document.title = siteName;
    // 更新当前时间
    const updateTime = () => {
      const now = new Date();
      const h = String(now.getHours()).padStart(2, '0');
      const m = String(now.getMinutes()).padStart(2, '0');
      const s = String(now.getSeconds()).padStart(2, '0');
      setCurrentTime(`${h}:${m}:${s}`);
    };
    updateTime();
    const timer = setInterval(updateTime, 1000);
    return () => clearInterval(timer);
  }, [siteName]);

  const level = getStatusLevel(monitors);

  // 状态文案
  const statusInfo = useMemo(() => {
    if (!monitors) return { text: '加载中...', sub: '' };
    const total = monitors.length;
    const down = monitors.filter(m => m.status === 'down').length;
    const ok = total - down;

    if (down === 0) {
      return { text: '所有站点运行正常', sub: `共 ${total} 个监控站点，全部正常` };
    }
    if (down === total) {
      return { text: '所有站点均出现异常', sub: `共 ${total} 个监控站点，${down} 个异常` };
    }
    return { text: '部分站点出现异常', sub: `共 ${total} 个监控站点，${ok} 个正常，${down} 个异常` };
  }, [monitors]);

  return (
    <div id='header' className={`banner-level-${level}`}>
      {/* 水波纹 SVG */}
      <div className="wave-container">
        <svg className="wave wave1" viewBox="0 0 1440 120" preserveAspectRatio="none">
          <path d="M0,64L48,58.7C96,53,192,43,288,48C384,53,480,75,576,80C672,85,768,75,864,64C960,53,1056,43,1152,42.7C1248,43,1344,53,1392,58.7L1440,64L1440,120L1392,120C1344,120,1248,120,1152,120C1056,120,960,120,864,120C768,120,672,120,576,120C480,120,384,120,288,120C192,120,96,120,48,120L0,120Z"></path>
        </svg>
        <svg className="wave wave2" viewBox="0 0 1440 120" preserveAspectRatio="none">
          <path d="M0,32L60,42.7C120,53,240,75,360,80C480,85,600,75,720,64C840,53,960,43,1080,48C1200,53,1320,75,1380,85.3L1440,96L1440,120L1380,120C1320,120,1200,120,1080,120C960,120,840,120,720,120C600,120,480,120,360,120C240,120,120,120,60,120L0,120Z"></path>
        </svg>
        <svg className="wave wave3" viewBox="0 0 1440 120" preserveAspectRatio="none">
          <path d="M0,96L48,90.7C96,85,192,75,288,69.3C384,64,480,64,576,69.3C672,75,768,85,864,85.3C960,85,1056,75,1152,69.3C1248,64,1344,64,1392,64L1440,64L1440,120L1392,120C1344,120,1248,120,1152,120C1056,120,960,120,864,120C768,120,672,120,576,120C480,120,384,120,288,120C192,120,96,120,48,120L0,120Z"></path>
        </svg>
      </div>

      <div className='container header-top'>
        <h1 className='logo'>{siteName}</h1>
        <div className='navi'>
          {navi.map((item, index) => (
            <Link key={index} to={item.url} text={item.text} />
          ))}
        </div>
      </div>

      <div className='container banner-content'>
        <div className="banner-status">
          <span className={`status-dot level-${level}`}>
            <span className="status-ring"></span>
            <span className="status-ring delay"></span>
          </span>
          <div className="status-text">
            <h2 className="status-title">{statusInfo.text}</h2>
            <p className="status-sub">{statusInfo.sub}</p>
          </div>
        </div>
        <div className="banner-info">
          <div className="info-item">
            <span className="info-label">更新于</span>
            <span className="info-value">{currentTime}</span>
          </div>
          <div className="info-item">
            <span className="info-label">将于</span>
            <span className="info-value countdown">{formatCountdown(countdown)}</span>
            <span className="info-label">后刷新</span>
          </div>
          <button className="refresh-btn-banner" onClick={onRefresh} disabled={loading} title="刷新数据">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={loading ? 'spin' : ''}>
              <path d="M23 4v6h-6" />
              <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}

export default Header;
