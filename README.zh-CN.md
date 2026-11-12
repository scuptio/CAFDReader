# CAFD Reader

> [English](README.md) | 简体中文

当前规范为 **1.0.0-draft.1（不稳定草案）**，尚未定版，不承诺草案之间向后兼容；字段、组件名、world、ABI 和协议约定仍可能调整。程序版本与规范版本独立维护。

[![Reader Release](https://github.com/scuptio/CAFDReader/actions/workflows/release.yml/badge.svg)](https://github.com/scuptio/CAFDReader/actions/workflows/release.yml)

CAFD（CAF Document，`.cafd`）交互文档的跨平台薄宿主。支持符合当前阅读 profile 的文档，不承诺打开所有 CAF 文件。内容与排版应用随文档，宿主负责文档架、文件、元信息和受限桥接。CAFD 是建立在 [CAF](https://github.com/scuptio/caf) 容器格式之上的文档 profile。

## 快速体验

```bash
npm ci
cargo make reader web
python3 -m http.server 8612 --bind 127.0.0.1 --directory dist-host
```

浏览器打开 <http://127.0.0.1:8612/reader/>,点击「打开 .cafd」选择本地文件,或直接把文件拖入窗口。

书架和阅读器的顶部「设置与帮助」菜单提供「中文 / English」界面语言设置，以及「关于阅读器」窗口，显示程序版本、实现对应的 CAFD 规范版本与稳定状态、容器格式、文档能力和应用协议。语言选择保存在本地；切换时保留当前打开的文档，不翻译文档内应用。版本信息在构建时从程序与规范版本记录自动生成。手机端使用右上角更多菜单，控件增大触控区域，「关于阅读器」以底部面板打开。

## 构建与运行

`cargo make` 的项目任务说明、进度、诊断和测试摘要统一使用英文，与阅读器界面语言设置独立。

需要 Node.js 24、Python 3.11+、Rust 和对应平台 SDK。Linux 需 GTK 3、WebKitGTK 4.1 开发库；Windows 需 MSVC 与 WebView2；macOS/iOS 需 Xcode；Android 需 Java 21、SDK、NDK。

```bash
cargo install cargo-make --version 0.37.24 --locked
npm ci
cargo make help
cargo make doctor
cargo make reader             # 当前桌面
cargo make reader web         # dist-host/
cargo make reader android --plan
cargo make reader android
cargo make reader ios         # macOS 上构建模拟器
cargo make dev
```

支持 linux/windows/macos/web/android/ios，桌面实际构建要求宿主系统匹配。移动端首次初始化生成工程。桌面默认未签名验证包、Android 调试 APK、iOS 本机架构模拟器。安装包在 src-tauri/target/release/bundle/，手机产物在 src-tauri/gen/。

Ubuntu / Windows x64 可一键安装配置 Android 专用工具链（需先具备上述 Node.js、Python、Rust 和 cargo-make）：

```bash
cargo make setup-android -- --plan  # 只看计划
cargo make setup-android           # 安装依赖并交互接受 SDK 许可证
cargo make doctor android
cargo make reader android
```

无人值守安装加 `-- --yes`；安装路径会保存为本项目配置，后续 Android 构建自动加载。支持自定义 SDK 目录、复用 CI 工具链，详见 [Android 环境安装与构建](docs/zh-CN/android-build.md)。

## 独立验证

```bash
cargo make test
cargo make reader web
python3 -m http.server 8612 --bind 127.0.0.1 --directory dist-host
# 另一终端；BASE 可覆盖默认地址
cargo make test-browser
cargo make test-native -- --binary src-tauri/target/release/cafd-reader
```

测试使用已提交的小型协议夹具，不需要任何内容项目或 caf-tool。只有重建夹具时需要 rustc 的 wasm32-unknown-unknown target 和 CAF 工具：

```bash
cargo make fixtures -- --caf-tool /path/to/caf-tool
```

## 规范和产物

- [CAFD 1.0.0-draft.1](spec/zh-CN/CAFD.md)
- [应用桥接协议](spec/zh-CN/cafd-web-v1.md)
- [实现兼容](docs/zh-CN/compatibility.md)
- [CAF 浏览器运行时](docs/zh-CN/runtime.md)

`cargo make reader web` 生成确定性的 dist-host/release.json（软件/规范版本及文件哈希）。部署到内容站点时使用固定清单及校验后的产物，覆盖站点宿主文件，保留其 books/catalog.json 与内容文件。安装包不包含作品。

规范与阅读器版本独立维护；目前程序为 0.1.0，规范为 1.0.0-draft.1。CI 仅保留 `Reader Release`，手动运行或推送 `v*` 正式版本标签后，构建 Windows x64 安装包、Ubuntu x64 `.deb` 和 Android ARM64 未签名正式 APK，汇总为 Release 草稿。工作流不执行签名，不需要签名 Secrets；Android APK 需另行签名后才能安装。每次构建统一生成 UTC 标签，例如 `build-20261110T073000Z`，标题为 `CAFD Reader 0.1.0 · 20261110T073000Z`；正式版本升级仍递增程序版本。不发布 iOS。发布步骤见 [发布说明](docs/zh-CN/releasing.md)。构建与测试不依赖外部内容仓库。

## 大文档读取

0.1.0 在无 JSPI 的 Linux WebKit 中使用专用 Worker 的同步 Range XHR，避免把整个文档转成 ArrayBuffer。本地 File/Blob 在 Worker 中按需切片；原始块和已校验块缓存各限 16 MiB，淘汰后读取重新验证哈希。同步 I/O 不在主线程或文档 iframe 执行。静态 HTTP 服务器需要支持 Range 才能使用网络按需读取。

原生验收为每次启动隔离浏览器缓存和 D-Bus，保留同一个临时原生书架验证记录恢复；支持 `--max-read-bytes`、`--max-cache-bytes` 检查实际读取量。书内可用 `data-caf-ready="false"` 表示仍在初始化，完成后设为 true，验收不会只凭封面提前退出。
