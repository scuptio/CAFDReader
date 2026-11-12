# CAF 浏览器运行时

> [English](../en/runtime.md) | 简体中文

`web/reader/caf.js` 是随本阅读器携带的固定 CAF 浏览器运行时快照，SHA-256 `30b2549f5fa82e3617d49c601833d0ea2cf885257e9c9e88bedb64be7727c666`；对应 CAF 仓库参考提交为 `1eea5ef04ac619b85b2d9b39ef7fafbf918077ca`。文件包含阅读器集成所需的 CAFD Worker 能力参数适配，并非上游未经修改副本。更新运行时须重新通过协议、隔离和容器兼容验证。

本仓库未提供顶层 LICENSE；第三方依赖各自许可仍适用。

0.1.0 加入无 JSPI 的 Worker Range XHR 与本地 Blob 切片读取；原始块和已验证块缓存各最多 16 MiB，缓存淘汰后重新读取必须再次验哈希。同步读取仅在专用 Worker 中使用，主线程不做同步 I/O。
