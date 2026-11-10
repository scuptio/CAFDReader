# Android 构建环境

支持 Ubuntu 22.04+ x64 和 Windows 10/11 x64。先安装项目基础工具：Node.js 24+、Python 3.11+、Rust（通过 rustup）及 cargo-make 0.37.24+。Windows 的 `python` 命令须可用；系统依赖安装需要 winget（App Installer），首次安装建议在管理员 PowerShell 中运行。

在仓库根目录执行，Ubuntu 和 Windows 使用同一入口：

```text
cargo make setup-android -- --plan
cargo make setup-android
cargo make doctor android
cargo make reader android
```

`setup-android` 安装 Ubuntu 的 Java 21 JDK 和基础编译依赖；Windows 缺少时通过 winget 安装 Temurin 21 JDK 和 Visual Studio C++ Build Tools，已有 Visual Studio 缺少 C++ 组件时补齐。Ubuntu 通过 sudo 请求系统包安装权限，Windows 安装器可能请求提升权限或重启；重启后可重新运行任务。

随后下载并校验 Android 命令行工具，安装 SDK Platform、Build Tools、NDK、platform-tools，添加 ARM64 与 x86_64 Android Rust target，并执行 `npm ci`。版本集中维护在 [工具链配置](../config/android-toolchain.json)。重复运行会复用命令行工具和 SDK 包，不删除现有 SDK，也不执行全局 SDK 升级。

首次运行默认交互接受 Android SDK 许可证。需要无人值守安装时显式使用：

```text
cargo make setup-android -- --yes
```

可选参数：

| 参数 | 用途 |
| --- | --- |
| `--plan` | 仅显示计划，不下载、不安装、不写入 |
| `--platform ubuntu` / `--platform windows` | 与 `--plan` 一起预览指定平台 |
| `--sdk-root "目录"` | 指定 SDK 目录；默认优先复用 `ANDROID_HOME`、`ANDROID_SDK_ROOT`，否则使用用户 SDK 目录 |
| `--skip-system` | CI 等已配置 JDK/编译工具时跳过系统包安装 |
| `--skip-npm` | 跳过 `npm ci` |

SDK 默认目录为 Ubuntu 的 `~/Android/Sdk`、Windows 的 `%LOCALAPPDATA%\Android\Sdk`。需能访问 Google Android 下载站、Rust、npm，以及系统包源；代理使用相应工具的标准配置。

安装成功后写入被 Git 忽略的 `build/android-env.json`。Android 的 `cargo make reader`、`cargo make dev`、`cargo make doctor` 和 `npm run android:*` 会自动加载其中的 `JAVA_HOME`、`ANDROID_HOME`、`ANDROID_SDK_ROOT`、`NDK_HOME` 与 PATH 前缀。这些项目配置优先于当前进程的同名变量，不修改用户全局变量、终端启动文件或其他项目。更换 SDK/JDK 路径后重新运行安装任务；没有此文件时仍使用当前终端环境。

在当前终端手动使用 `adb` 或 `sdkmanager`，可以加载生成的环境脚本：

```bash
# Ubuntu Bash
source build/android-env.sh
```

```powershell
# Windows PowerShell
. .\build\android-env.ps1
```

默认构建 ARM64 调试 APK，输出在 `src-tauri/gen/android/app/build/outputs/apk/`；x86_64 模拟器可用 `cargo make reader android -- --target x86_64`。APK 不包含内容文档。

`cargo make reader android --release` 生成 ARM64 正式 APK，不自动配置签名。本仓库 Release 工作流使用独立密钥签名和校验后上传，签名 Secrets 与发布步骤见 [发布说明](releasing.md)。

工具链依据：[Tauri 前提条件](https://tauri.app/start/prerequisites/)、[Android 命令行工具下载与 SHA-256](https://developer.android.com/studio#command-line-tools-only)、[sdkmanager](https://developer.android.com/tools/sdkmanager)、[Visual Studio 安装命令行](https://learn.microsoft.com/en-us/visualstudio/install/use-command-line-parameters-to-install-visual-studio)。
