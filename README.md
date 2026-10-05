# 站点监控面板

基于 UptimeRobot API 的个人在线状态面板，使用 V3 API 获取标签信息，支持 Vercel 和 Netlify 一键部署。

> 参考原项目：[yb/uptime-status](https://github.com/yb/uptime-status)

## ✨ 特性

- 🎯 **V3 API 标签支持** - 使用 UptimeRobot V3 API 获取监控标签
- ⏱️ **实时状态显示** - 显示上次检测时间和下次检测倒计时
- 🔄 **手动刷新** - 一键刷新最新状态
- ⚠️ **友好错误提示** - 清晰展示 API Key 缺失、超时、权限错误等问题
- 📱 **响应式设计** - 完美适配桌面和移动设备
- 🚀 **一键部署** - 支持 Vercel / Netlify 一键部署

## 🚀 一键部署

### 部署到 Vercel

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/flow2000/website-status&env=REACT_APP_UPTIMEROBOT_API_KEYS&envDescription=UptimeRobot%20API%20Key%EF%BC%8C%E5%A4%9A%E4%B8%AA%E7%94%A8%E9%80%97%E5%8F%B7%E5%88%86%E9%9A%94&envLink=https://uptimerobot.com/dashboard#mySettings&project-name=website-status&repo-name=website-status)

### 部署到 Netlify

[![Deploy to Netlify](https://www.netlify.com/img/deploy/button.svg)](https://app.netlify.com/start/deploy?repository=https://github.com/flow2000/website-status)

> **部署时设置环境变量 `REACT_APP_UPTIMEROBOT_API_KEYS`** 为您的 UptimeRobot API Key（多个 Key 用逗号分隔）

## ⚙️ 配置说明

### 环境变量（推荐）

在 Vercel / Netlify 或本地 `.env` 文件中配置：

```env
REACT_APP_UPTIMEROBOT_API_KEYS=your_api_key_1,your_api_key_2
```

| 环境变量 | 说明 | 示例 |
|---------|------|------|
| `REACT_APP_UPTIMEROBOT_API_KEYS` | UptimeRobot API Key，多个用逗号分隔 | `key1,key2` |
| `REACT_APP_SITE_NAME` | 站点名称（可选） | `我的监控` |
| `REACT_APP_COUNT_DAYS` | 显示日志天数（可选，默认 90） | `90` |

### 配置文件方式

修改 `public/config.js` 文件：

```javascript
window.Config = {
    // 显示标题
    SiteName: '站点监控',

    // UptimeRobot API Keys (支持 Read-Only 和 Account API Key)
    ApiKeys: [
        'your_api_key_1',
        'your_api_key_2',
    ],

    // 日志天数
    CountDays: 90,

    // 是否显示检测站点的链接
    ShowLink: true,

    // 默认监控间隔（分钟）
    CheckInterval: 5,

    // 导航栏菜单
    Navi: [
        { text: '主页', url: 'https://example.com' },
    ],
};
```

## 📋 事先准备

1. 注册 [UptimeRobot](https://uptimerobot.com/) 账号并添加站点监控
2. 在 [My Settings](https://uptimerobot.com/dashboard#mySettings) 页面获取 API Key
   - 推荐使用 **Read-Only API Key**（只读权限，更安全）
   - 也可以使用 **Account API Key**（完整权限）

## 🛠️ 本地开发

```bash
# 安装依赖
npm install

# 启动开发服务器
npm start

# 构建生产版本
npm run build
```

## 📦 部署方式

### 方式一：一键部署（推荐）

点击上方的 Vercel 或 Netlify 部署按钮，按照提示操作即可。

### 方式二：静态文件部署

1. 执行 `npm run build` 构建
2. 将 `build` 目录上传到任意静态网站托管服务
3. 在服务端配置环境变量或修改 `config.js`

## 📝 API Key 类型说明

| 类型 | 权限 | 适用场景 |
|------|------|---------|
| Read-Only API Key | 只读 | 状态面板展示（推荐） |
| Account API Key | 完整读写 | 需要管理监控时 |
| Monitor-Specific API Key | 单个监控只读 | 单个监控的状态展示 |

## 🆘 常见问题

### 1. 页面显示"未配置 API Key"

请检查环境变量 `REACT_APP_UPTIMEROBOT_API_KEYS` 是否正确设置，或 `config.js` 中的 `ApiKeys` 是否配置了有效的 API Key。

### 2. 显示"API Key 无效或没有权限"

- 检查 API Key 是否复制正确
- 确认使用的是 Read-Only 或 Account API Key
- Monitor-Specific API Key 只能查看对应监控的数据

### 3. 显示"请求超时"

- 检查网络连接
- UptimeRobot API 偶尔会有延迟，可以点击刷新按钮重试

### 4. 标签没有显示

- 确保您的监控在 UptimeRobot 中设置了标签
- V3 API 才能获取标签，确认 API Key 支持 V3 API

## 📄 许可证

MIT License
