# Android build environment

> English | [简体中文](../zh-CN/android-build.md)

Supports Ubuntu 22.04+ x64 and Windows 10/11 x64. Install the project's base tooling first: Node.js 24+, Python 3.11+, Rust (via rustup), and cargo-make 0.37.24+. The `python` command must work on Windows; system dependency installation needs winget (App Installer), and the first install is best run from an elevated PowerShell.

Run from the repository root — Ubuntu and Windows share the same entry point:

```text
cargo make setup-android -- --plan
cargo make setup-android
cargo make doctor android
cargo make reader android
```

`setup-android` installs the Java 21 JDK and basic build dependencies on Ubuntu; on Windows it installs the Temurin 21 JDK and Visual Studio C++ Build Tools via winget when missing, and tops up the C++ components when Visual Studio is already present. Ubuntu requests system-package installation privileges through sudo; Windows installers may request elevation or a reboot — rerun the task after a reboot.

It then downloads and verifies the Android command-line tools, installs the SDK Platform, Build Tools, NDK, and platform-tools, adds the ARM64 and x86_64 Android Rust targets, and runs `npm ci`. Versions are maintained centrally in the [toolchain config](../../config/android-toolchain.json). Re-running reuses the command-line tools and SDK packages, never deletes an existing SDK, and never performs a global SDK upgrade.

The first run accepts the Android SDK licenses interactively. For unattended installation, pass it explicitly:

```text
cargo make setup-android -- --yes
```

Optional arguments:

| Argument | Purpose |
| --- | --- |
| `--plan` | Show the plan only — no downloads, no installs, no writes |
| `--platform ubuntu` / `--platform windows` | Preview a specific platform together with `--plan` |
| `--sdk-root "dir"` | Choose the SDK directory; by default prefers reusing `ANDROID_HOME`, `ANDROID_SDK_ROOT`, otherwise the per-user SDK directory |
| `--skip-system` | Skip system-package installation, e.g. in CI where the JDK/build tools are already provisioned |
| `--skip-npm` | Skip `npm ci` |

Default SDK directories are `~/Android/Sdk` on Ubuntu and `%LOCALAPPDATA%\Android\Sdk` on Windows. Access to the Google Android download site, Rust, npm, and the system package sources is required; proxies use each tool's standard configuration.

On success the git-ignored `build/android-env.json` is written. Android's `cargo make reader`, `cargo make dev`, `cargo make doctor`, and `npm run android:*` automatically load `JAVA_HOME`, `ANDROID_HOME`, `ANDROID_SDK_ROOT`, `NDK_HOME`, and the PATH prefixes from it. This project configuration takes precedence over same-named variables in the current process, and does not modify user-global variables, shell startup files, or other projects. Rerun the setup task after changing SDK/JDK paths; without this file the current terminal environment is used as-is.

To use `adb` or `sdkmanager` manually in the current terminal, load the generated environment script:

```bash
# Ubuntu Bash
source build/android-env.sh
```

```powershell
# Windows PowerShell
. .\build\android-env.ps1
```

The default build is an ARM64 debug APK at `src-tauri/gen/android/app/build/outputs/apk/`; for the x86_64 emulator use `cargo make reader android -- --target x86_64`. The APK contains no content documents.

`cargo make reader android --release` produces an ARM64 unsigned release APK. This repository's `Reader Release` workflow only aligns and verifies the APK — it does not sign and needs no signing secrets; an unsigned APK must be signed separately before installation. Release steps are in [the release notes](releasing.md).

Toolchain references: [Tauri prerequisites](https://tauri.app/start/prerequisites/), [Android command-line tools download & SHA-256](https://developer.android.com/studio#command-line-tools-only), [sdkmanager](https://developer.android.com/tools/sdkmanager), [Visual Studio command-line installation](https://learn.microsoft.com/en-us/visualstudio/install/use-command-line-parameters-to-install-visual-studio).
