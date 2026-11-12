# CAFD Reader 项目规则

本仓库维护通用 CAFD Reader、CAFD 1.0.0-draft.1 规范与兼容测试。不得依赖任何内容项目的目录、PDF、编辑数据、WASM 构建产物。

- `web/` 是薄宿主：文档架、打开/关闭、元信息、受控资源/WASM/存储桥接，不加入正文分页、注释、翻译、影印等内容业务。
- `src-tauri/` 负责跨平台文件、协议、书架与私有记录。应用 identifier `org.caf.reader`、cafbook/cafcover 与存储键保持兼容。
- `spec/` 是规范唯一维护处；`spec/en/` 与 `spec/zh-CN/` 双语并列、内容同步、版本号一致;规范版本独立于程序版本，未知 profile 或应用协议必须明确拒绝。文档双语维护：`docs/en/` + `docs/zh-CN/` 同名对应，根 README 为 `README.md`（英文）+ `README.zh-CN.md`；新增或修改文档、规范须双语同步。
- `tests/fixtures/` 夹具必须独立可重建；不得将真实作品作为通用测试前提。
- `dist-host/release.json` 记录 Web 产物版本、规范版本及每文件 SHA；内容项目应固定其哈希，不复制宿主源码。
- `cargo make reader [platform]` 构建阅读器，`cargo make test` 检查协议与 Rust，`cargo make test-browser` 验证 Web 隔离，`cargo make test-native -- --binary ...` 两次启动。
- 安装依赖 `npm ci`，cargo-make 基线 0.37.24；默认运行 `cargo make` 显示任务。
- 不修改内容文档的字节；宿主校验 CAF 容器与支持能力后运行。保持 iframe sandbox 和受限 CSP，WASM 用可终止 Worker。
- 发布、推送、安装到系统或改变用户日常书架须有明确授权。提交信息中文。
