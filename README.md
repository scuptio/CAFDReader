# CAFD Reader

CAFD（CAF Document，`.cafd`）交互文档的跨平台薄宿主。支持符合当前阅读 profile 的文档，不承诺打开所有 CAF 文件。内容与排版应用随文档，宿主负责文档架、文件、元信息和受限桥接。

## 构建与运行

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

无人值守安装加 `-- --yes`；安装路径会保存为本项目配置，后续 Android 构建自动加载。支持自定义 SDK 目录、复用 CI 工具链，详见 [Android 环境安装与构建](docs/android-build.md)。

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

- [CAFD 1.0.0](spec/CAFD.md)
- [应用桥接协议](spec/ebook-web-v1.md)
- [实现兼容](docs/compatibility.md)
- [CAF 浏览器运行时](docs/runtime.md)

`cargo make reader web` 生成确定性的 dist-host/release.json（软件/规范版本及文件哈希）。部署到内容站点时使用固定清单及校验后的产物，覆盖站点宿主文件，保留其 books/catalog.json 与内容文件。安装包不包含作品。

规范与阅读器版本独立维护；目前程序为 0.2.0，规范为 1.0.0。工作流仅手动构建，不自动发布。构建与测试不依赖外部内容仓库。
