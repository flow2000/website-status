import { useMemo, useEffect, useState } from 'react';
import Link from './link';
import Header from './header';
import UptimeRobot from './uptimerobot';
import Package from '../../package.json';

function App() {
  const [apiReady, setApiReady] = useState(null); // null=检查中, true=可用, false=不可用

  // 获取配置（环境变量优先）
  const config = useMemo(() => {
    const windowConfig = window.Config || {};

    // CountDays
    let countDays = 90;
    const envCountDays = process.env.REACT_APP_COUNT_DAYS;
    if (envCountDays && !isNaN(parseInt(envCountDays))) {
      countDays = parseInt(envCountDays);
    } else if (windowConfig.CountDays) {
      countDays = windowConfig.CountDays;
    }

    // CheckInterval
    let checkInterval = 5;
    const envInterval = process.env.REACT_APP_CHECK_INTERVAL;
    if (envInterval && !isNaN(parseInt(envInterval))) {
      checkInterval = parseInt(envInterval);
    } else if (windowConfig.CheckInterval) {
      checkInterval = windowConfig.CheckInterval;
    }

    // ShowLink
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

  // 将配置注入到 window.Config 供子组件使用
  useEffect(() => {
    if (!window.Config) window.Config = {};
    window.Config.CountDays = config.countDays;
    window.Config.CheckInterval = config.checkInterval;
    window.Config.ShowLink = config.showLink;
  }, [config]);

  // 检查 API 是否可用
  useEffect(() => {
    async function checkApi() {
      try {
        const response = await fetch('/api/monitors?days=1');
        if (response.status === 404) {
          setApiReady(false);
          return;
        }
        // 只要不是 404，就认为 API 存在（即使返回错误也是配置问题，不是路径问题）
        setApiReady(true);
      } catch {
        setApiReady(false);
      }
    }
    checkApi();
  }, []);

  // 加载中
  if (apiReady === null) {
    return (
      <>
        <Header />
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

  // API 不可用（本地开发环境或未配置服务端函数）
  if (apiReady === false) {
    return (
      <>
        <Header />
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
      <Header />
      <div className="container">
        <div id="uptime">
          <UptimeRobot isFirst={true} />
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
