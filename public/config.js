// 站点配置
// 注意：API Key 也可以通过环境变量 REACT_APP_UPTIMEROBOT_API_KEYS 配置（逗号分隔多个key）
// 环境变量优先级高于此配置文件

window.Config = {

    // 显示标题
    SiteName: '站点监控',

    // UptimeRobot API Keys (V3 API，使用 Read-Only API Key 或 Account API Key)
    // 支持在 Vercel/Netlify 等平台通过环境变量 REACT_APP_UPTIMEROBOT_API_KEYS 配置
    // 多个 key 用逗号分隔，例如: key1,key2,key3
    ApiKeys: [],

    // 日志天数
    CountDays: 90,

    // 是否显示检测站点的链接
    ShowLink: true,

    // 监控间隔（分钟），用于计算下次检测倒计时
    CheckInterval: 5,

    // 导航栏菜单
    Navi: [],
};
