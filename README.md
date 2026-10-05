# 站点监控面板

基于 UptimeRobot API 的个人在线状态面板，使用 V3 API 获取标签信息，支持 Vercel 和 Netlify 一键部署。

> 参考原项目：[yb/uptime-status](https://github.com/yb/uptime-status)

## ✨ 特性

- 🔒 **服务端代理** - API Key 存储在服务端，不暴露给前端
- 🎯 **V3 API 标签支持** - 使用 UptimeRobot V3 API 获取监控标签
- ⏱️ **实时倒计时** - 显示下次刷新倒计时，到点自动刷新
- 🚦 **限流保护** - 每分钟最多 60 次请求，防止滥用
- 🔄 **手动刷新** - 一键刷新最新状态
- ⚠️ **友好错误提示** - 清晰展示配置缺失、超时、限流等问题
- 📱 **响应式设计** - 完美适配桌面和移动设备
- 🚀 **一键部署** - 支持 Vercel / Netlify 一键部署

## 🚀 一键部署

### 部署到 Vercel

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/flow2000/website-status&env=UPTIMEROBOT_API_KEYS&envDescription=UptimeRobot%20API%20Key%EF%BC%8C%E5%A4%9A%E4%B8%AA%E7%94%A8%E9%80%97%E5%8F%B7%E5%88%86%E9%9A%94&envLink=https://uptimerobot.com/dashboard#mySettings&project-name=website-status&repo-name=website-status)

### 部署到 Netlify

[![Deploy to Netlify](https://www.netlify.com/img/deploy/button.svg)](https://app.netlify.com/start/deploy?repository=https://github.com/flow2000/website-status)

> **部署时设置环境变量 `UPTIMEROBOT_API_KEYS`** 为您的 UptimeRobot API Key（多个 Key 用逗号分隔）

## ⚙️ 配置说明

### 环境变量（推荐）

在 Vercel / Netlify 的 Environment Variables 中配置：

```env
UPTIMEROBOT_API_KEYS=your_api_key_1,your_api_key_2
```

| 环境变量 | 说明 | 示例 |
|---------|------|------|
| `UPTIMEROBOT_API_KEYS` | **（必需）** UptimeRobot API Key，多个用逗号分隔，配置在服务端 | `key1,key2` |
| `REACT_APP_SITE_NAME` | 站点名称（可选） | `我的监控` |
| `REACT_APP_COUNT_DAYS` | 显示日志天数（可选，默认 90） | `90` |
| `REACT_APP_CHECK_INTERVAL` | 前端自动刷新间隔（分钟，可选，默认 5） | `5` |

### 配置文件方式

修改 `public/config.js` 文件可配置前端展示选项：

```javascript
window.Config = {
    // 站点名称
    SiteName: '站点监控',

    // 可用率统计天数
    CountDays: 90,

    // 自动刷新间隔（分钟，建议与 UptimeRobot 监控间隔一致）
    CheckInterval: 5,

    // 是否显示跳转链接
    ShowLink: true,

    // 导航菜单
    Navi: [
        // { url: 'https://github.com', text: 'GitHub' },
    ],
}
```

## 📡 API 说明

项目通过服务端 API 代理 UptimeRobot 请求，API Key 不会暴露到前端。

### 限流

服务端 API 有限流保护：**60 次 / 分钟 / IP**

### 接口

```
GET /api/monitors?days=90
```

返回示例：
```json
{
  "monitors": [
    {
      "id": "12345",
      "name": "My Website",
      "url": "https://example.com",
      "type": "HTTP",
      "interval": 300,
      "tags": ["Production"],
      "status": "ok",
      "average": "99.97",
      "currentStateDuration": 12345,
      "daily": [...],
      "total": { "times": 2, "duration": 3500 }
    }
  ],
  "total": 1
}
```

## 🔑 API Key 获取

1. 登录 [UptimeRobot](https://uptimerobot.com/)
2. 进入 [My Settings](https://uptimerobot.com/dashboard#mySettings)
3. 找到 **API Settings** → **Main API Key**
4. 复制该 Key 填入环境变量

> 💡 建议使用 **Main API Key**（主 API Key），Monitor-Specific API Key 不支持获取所有监控列表。

## 🛠 本地开发

```bash
# 安装依赖
npm install

# 启动开发服务器
npm start

# 构建生产版本
npm run build
```

> **注意**：本地开发时 `api/monitors` 接口需要在 Vercel/Netlify 环境中才能运行。
> 本地可以通过 `vercel dev` 或 `netlify dev` 启动完整的本地开发环境。

## ❓ 常见问题

**Q: 为什么需要服务端代理？**

A: 将 API Key 放在服务端可以避免泄露，同时可以做限流保护。

**Q: 支持多个 API Key 吗？**

A: 支持，用逗号分隔填入 `UPTIMEROBOT_API_KEYS` 环境变量即可。

**Q: 本地开发看不到数据？**

A: 本地 `npm start` 只启动前端，服务端 API 需要用 `vercel dev` 或 `netlify dev` 才能调用。
部署到 Vercel/Netlify 后自动可用。

**Q: 如何修改刷新间隔？**

A: 通过环境变量 `REACT_APP_CHECK_INTERVAL` 或 `config.js` 中的 `CheckInterval` 设置，单位为分钟。

## 📄 许可证

MIT
