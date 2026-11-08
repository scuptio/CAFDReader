# 迁移来源

从 libai 提交 `2daba7b748e2cf2c805489fb663d15ec7077cf9f` 抽取通用宿主、Tauri 适配、任务入口及协议验证。原始项目来源 https://github.com/ybbh/libai.git （本地提取路径仅作迁移记录，不作为构建依赖）。

web/reader/caf.js 是随本阅读器携带的固定 CAF 浏览器运行时快照，SHA-256 `da8f207c95e05549cce78a26f3ed43fd008c4e6cea7e98a8b3cd9baf22b444eb`；提取时相邻 CAF 仓库提交为 1eea5ef04ac619b85b2d9b39ef7fafbf918077ca。文件内 CAFD Worker 能力参数适配来自阅读器集成。本仓库不将其声称为上游未经修改副本；更新运行时须重新通过协议、隔离和容器兼容验证。

源项目未提供顶层 LICENSE，本次迁移不新增授权声明；第三方依赖各自许可仍适用。
