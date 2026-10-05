window.Config = {

    // 站点名称（也可通过环境变量 REACT_APP_SITE_NAME 设置）
    SiteName: '站点监控',

    // 可用率统计天数（也可通过环境变量 REACT_APP_COUNT_DAYS 设置）
    CountDays: 90,

    // 自动刷新间隔（分钟，也可通过环境变量 REACT_APP_CHECK_INTERVAL 设置）
    // 注意：这是前端刷新间隔，建议与 UptimeRobot 的监控间隔一致
    CheckInterval: 5,

    // 是否显示跳转链接
    ShowLink: true,

    // 导航菜单
    Navi: [
        // { url: 'https://github.com', text: 'GitHub' },
    ],
}
