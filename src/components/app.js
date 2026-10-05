import { useMemo, useState, useEffect } from 'react';
import Link from './link';
import Header from './header';
import UptimeRobot from './uptimerobot';
import Package from '../../package.json';

function App() {
  // 获取配置（环境变量优先）
  const config = useMemo(() => {
    const windowConfig = window.Config || {};

    // API Keys
    let apiKeys = [];
    const envKeys = process.env.REACT_APP_UPTIMEROBOT_API_KEYS;
    if (envKeys) {
      apiKeys = envKeys.split(',').map((k) => k.trim()).filter(Boolean);
    }
    if (apiKeys.length === 0) {
      if (Array.isArray(windowConfig.ApiKeys)) apiKeys = windowConfig.ApiKeys.filter(Boolean);
      else if (typeof windowConfig.ApiKeys === 'string' && windowConfig.ApiKeys) apiKeys = [windowConfig.ApiKeys];
    }

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
      apiKeys,
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

  // 没有配置 API Key
  if (config.apiKeys.length === 0) {
    return (
      <>
        <Header />
        <div className="container">
          <div id="uptime">
            <div className="error-container">
              <div className="error-icon">⚠️</div>
              <h2>未配置 API Key</h2>
              <p>请在环境变量或 config.js 中配置您的 UptimeRobot API Key</p>
              <div className="error-details">
                <p><strong>配置方式：</strong></p>
                <ol>
                  <li>
                    <strong>环境变量（推荐）：</strong>
                    设置 <code>REACT_APP_UPTIMEROBOT_API_KEYS</code> 环境变量，
                    多个 Key 用逗号分隔
                  </li>
                  <li>
                    <strong>配置文件：</strong>
                    修改 <code>public/config.js</code> 中的 <code>ApiKeys</code> 数组
                  </li>
                </ol>
                <p className="hint">
                  获取 API Key: <Link to="https://uptimerobot.com/dashboard#mySettings" text="UptimeRobot 设置页面" />
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
          {config.apiKeys.map((key, index) => (
            <UptimeRobot
              key={key}
              apikey={key}
              isFirst={index === 0}
            />
          ))}
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
