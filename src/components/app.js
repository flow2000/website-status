import { useMemo, useEffect, useState, useCallback, useRef } from 'react';
import Link from './link';
import Header from './header';
import UptimeRobot from './uptimerobot';
import Package from '../../package.json';
import { GetMonitors } from '../common/uptimerobot';

// 估算下次检测时间
function getNextCheckSeconds(currentStateDuration, intervalSeconds) {
  if (!intervalSeconds) return null;
  const elapsed = currentStateDuration || 0;
  const sinceLastCheck = elapsed % intervalSeconds;
  return intervalSeconds - sinceLastCheck;
}

function App() {
  const config = useMemo(() => {
    const windowConfig = window.Config || {};

    let countDays = 90;
    const envCountDays = process.env.REACT_APP_COUNT_DAYS;
    if (envCountDays && !isNaN(parseInt(envCountDays))) {
      countDays = parseInt(envCountDays);
    } else if (windowConfig.CountDays) {
      countDays = windowConfig.CountDays;
    }

    let checkInterval = 5;
    const envInterval = process.env.REACT_APP_CHECK_INTERVAL;
    if (envInterval && !isNaN(parseInt(envInterval))) {
      checkInterval = parseInt(envInterval);
    } else if (windowConfig.CheckInterval) {
      checkInterval = windowConfig.CheckInterval;
    }

    let showLink = true;
    if (typeof windowConfig.ShowLink === 'boolean') {
      showLink = windowConfig.ShowLink;
    }

    return {
      countDays,
      checkInterval,
      showLink,
    };
  }, []);

  const [monitors, setMonitors] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);
  const [countdown, setCountdown] = useState(config.checkInterval * 60);
  const [apiReady, setApiReady] = useState(null);
  const countdownTimerRef = useRef(null);

  // 注入配置
  useEffect(() => {
    if (!window.Config) window.Config = {};
    window.Config.CountDays = config.countDays;
    window.Config.CheckInterval = config.checkInterval;
    window.Config.ShowLink = config.showLink;
  }, [config]);

  // 计算最早的下次检测秒数
  const getMinNextCheckSeconds = useCallback(() => {
    if (!monitors || monitors.length === 0) return config.checkInterval * 60;
    let min = Infinity;
    monitors.forEach((m) => {
      const secs = getNextCheckSeconds(m.currentStateDuration, m.interval || config.checkInterval * 60);
      if (secs !== null && secs < min) min = secs;
    });
    return min === Infinity ? config.checkInterval * 60 : Math.max(Math.ceil(min), 5);
  }, [monitors, config.checkInterval]);

  // 刷新数据
  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await GetMonitors(config.countDays);
      setMonitors(data);
      setApiReady(true);
    } catch (err) {
      setError(err.message || '加载失败');
      setMonitors(null);
    } finally {
      setLoading(false);
    }
  }, [config.countDays]);

  // 初始加载 + 检查 API
  useEffect(() => {
    async function init() {
      try {
        const response = await fetch('/api/monitors?days=1');
        if (response.status === 404) {
          setApiReady(false);
          return;
        }
        setApiReady(true);
        fetchData();
      } catch {
        setApiReady(false);
      }
    }
    init();
  }, []); // eslint-disable-line

  // 数据加载完成后设置倒计时
  useEffect(() => {
    if (!loading && !error && monitors) {
      setCountdown(getMinNextCheckSeconds());
    }
  }, [loading, error, monitors, getMinNextCheckSeconds]);

  // 倒计时定时器
  useEffect(() => {
    if (loading || error || !monitors) return;

    countdownTimerRef.current = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
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

  // 加载中
  if (apiReady === null) {
    return (
      <>
        <Header monitors={null} countdown={0} loading={true} />
        <div className="container">
          <div id="uptime">
            <div className="site">
              <div className="loading" />
            </div>
          </div>
          <div id="footer">
            <p>基于 <Link to="https://uptimerobot.com/" text="UptimeRobot" /> 接口制作</p>
            <p>Version {Package.version}</p>
          </div>
        </div>
      </>
    );
  }

  // API 不可用
  if (apiReady === false) {
    return (
      <>
        <Header monitors={null} countdown={0} loading={false} />
        <div className="container">
          <div id="uptime">
            <div className="error-container">
              <div className="error-icon">⚠️</div>
              <h2>API 未配置</h2>
              <p>未检测到服务端 API，请在部署平台配置 UPTIMEROBOT_API_KEYS 环境变量</p>
              <div className="error-details">
                <p><strong>部署方式：</strong></p>
                <ol>
                  <li>
                    <strong>Vercel：</strong>
                    在 Settings → Environment Variables 添加
                    <code>UPTIMEROBOT_API_KEYS</code>
                  </li>
                  <li>
                    <strong>Netlify：</strong>
                    在 Site settings → Environment variables 添加
                    <code>UPTIMEROBOT_API_KEYS</code>
                  </li>
                </ol>
                <p className="hint">
                  多个 API Key 用逗号分隔。获取 API Key:
                  <Link to="https://uptimerobot.com/dashboard#mySettings" text="UptimeRobot 设置页面" />
                </p>
              </div>
            </div>
          </div>
          <div id="footer">
            <p>基于 <Link to="https://uptimerobot.com/" text="UptimeRobot" /> 接口制作</p>
            <p>Version {Package.version}</p>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <Header
        monitors={monitors}
        countdown={countdown}
        onRefresh={fetchData}
        loading={loading}
      />
      <div className="container">
        <div id="uptime">
          <UptimeRobot monitors={monitors} error={error} loading={loading} onRefresh={fetchData} />
        </div>
        <div id="footer">
          <p>基于 <Link to="https://uptimerobot.com/" text="UptimeRobot" /> 接口制作</p>
          <p>Version {Package.version}</p>
        </div>
      </div>
    </>
  );
}

export default App;
