# 发布阅读器

> [English](../en/releasing.md) | 简体中文

程序版本使用 SemVer，目前为 `0.1.0`；后续正式发布递增，例如 `0.1.1`。每次构建的 Release 使用独立 UTC 时间编号，不追加第四段数字到程序版本。CAFD 规范版本独立维护，目前为 `1.0.0`。

| 用途 | 示例 |
| --- | --- |
| 程序版本 | `0.1.0` |
| Release 标签 | `build-20261110T073000Z` |
| Release 标题 | `CAFD Reader 0.1.0 · 20261110T073000Z` |

时间编号由最前面的校验 job 生成一次（UTC、精确到秒），传递给全部构建和汇总 job，不使用各平台各自的时钟。编号代表构建开始时间，公开时间由 GitHub 另外记录。所有 job 固定检出触发运行时的提交 SHA，最终生成的构建标签也指向该提交。文件名带程序版本和同一时间编号，便于区分同一程序版本的不同构建。

## 发布范围

CI 仅保留 `Reader Release`（`.github/workflows/release.yml`），支持在 Actions 手动选择分支或标签运行，也支持推送 `v*` 正式版本标签。工作流校验 package.json、package-lock.json、Tauri、Cargo.toml、Cargo.lock 的程序版本完全一致；通过 `v*` 标签触发时还要求标签等于 `v` + 程序版本（例如 `v0.1.0`）。这只是正式版本的触发入口，最终 Release 标签始终为 `build-时间编号`。分别构建：

| 平台 | Release 附件 | 条件 |
| --- | --- | --- |
| Windows x64 | `cafd-reader-0.1.0-20261110T073000Z-windows-x64-setup.exe` | NSIS 安装包，当前不带 Windows 代码签名 |
| Ubuntu x64 | `cafd-reader-0.1.0-20261110T073000Z-ubuntu-x64.deb` | 在 Ubuntu 22.04 构建，目标为 Ubuntu 22.04+ x64；需系统 WebKitGTK 4.1 等依赖，安装与运行兼容性仍须在目标系统验收 |
| Android ARM64 | `cafd-reader-0.1.0-20261110T073000Z-android-arm64-unsigned.apk` | Android 7.0 / API 24+，未签名，另行签名后才能安装 |

不包含 iOS 或 macOS CI 构建及 Release 附件，保留本地构建入口。安装包只含宿主，不包含作品。

桌面构建执行 `cargo make test`，Linux 另用独立夹具执行原生重开验收；Android 执行基础检查，收集正式构建的 `*-unsigned.apk` 后使用 zipalign 对齐并校验，不执行签名。打包完成不代表已经通过 Windows／Android 实机验收。

三个安装包必须具有相同程序版本和时间编号，齐全且非空后生成 `SHA256SUMS`，再创建指向本次提交的构建标签，一起上传到同一 Release 草稿。构建失败不会创建标签或草稿；标签重名时创建会失败，不复用、移动标签或覆盖已有附件。工作流不会自动公开草稿，不修改或提交源码，不上传应用商店。

程序版本为预发布版本（例如 `0.1.1-beta.1`）时草稿标记为 prerelease；普通 `build-` 前缀不会导致正式程序版本被误判为预发布。同一程序版本可生成多个构建 Release，但时间编号不替代安装包内的版本比较。正式对外升级时仍须递增程序版本。

## 未签名产物

`Reader Release` 不执行代码签名，不读取签名 Secrets，不创建或导入密钥。Windows 输出未签名 NSIS 安装包；Android 输出明确带 `-unsigned.apk` 后缀的正式构建，不使用调试签名替代。

Android 系统要求 APK 签名后才能安装。需要安装时，下载后在工作流之外使用自己的密钥签名；后续覆盖升级沿用同一密钥。签名会改变 APK 字节，Release 的 SHA256SUMS 对应原始未签名附件。

## 操作步骤

1. 同步修改 package.json、package-lock.json 根项目版本、src-tauri/tauri.conf.json、src-tauri/Cargo.toml 和 Cargo.lock 根包版本，更新版本说明。不要联动修改规范版本。
2. 本地执行 `cargo make test`，审查修改并提交；提交信息使用中文。
3. 明确决定构建发布包后，在 Actions 中手动运行 `Reader Release`，选择包含此工作流的分支或标签；正式版本也可通过推送 `v0.1.0` 这样的对应标签触发。无需手动创建 `build-*` 标签或配置签名 Secrets。
4. 等待三个平台全部通过，在 Releases 检查 `build-*` 草稿中的程序版本、UTC 编号、三个附件和 SHA256SUMS，完成必要的目标系统验收并补齐发布说明后手动公开。

只有最后汇总 job 拥有 `contents: write`；其余 job 为只读。仓库必须允许 GitHub Actions 创建标签和 Release。整个工作流按仓库串行运行，避免同时汇总发布。仅重跑失败 job 沿用已生成的编号；重跑整个工作流时重新生成编号。若汇总阶段已经创建标签、但后续 Release 创建失败，重跑汇总会因标签存在而停止，可重跑整个工作流生成新编号，原标签另行人工处理。

## 使用 act 本地验证

在仓库根目录运行，需要 act 与可访问的 Docker。checkout 使用默认事件提交：GitHub 上检出触发提交，act 默认复制当前本地源码（包含未提交修改），无需为检出提供 Token。不要添加 `--no-skip-checkout`，否则会执行真实远端检出。

先运行轻量校验：

```bash
act workflow_dispatch -W .github/workflows/release.yml -j validate \
  -P ubuntu-24.04=ghcr.io/catthehacker/ubuntu:act-24.04
```

运行 Ubuntu 构建、测试和本地产物上传：

```bash
act workflow_dispatch -W .github/workflows/release.yml \
  -j desktop --matrix os:ubuntu-22.04 \
  -P ubuntu-22.04=ghcr.io/catthehacker/ubuntu:act-22.04 \
  -P ubuntu-24.04=ghcr.io/catthehacker/ubuntu:act-24.04 \
  --artifact-server-path "$PWD/build/act-artifacts"
```

Android 可用 `-j android` 及 Ubuntu 24.04 镜像单独运行。镜像和 Actions 已缓存时可加 `--pull=false --action-offline-mode`；构建依赖缺失时仍需联网下载。Windows 需在 Windows 环境验证，不能使用 Linux 容器替代。检测到 act 的 `ACT` 环境变量时，最后创建 GitHub 标签和 Release 草稿的步骤会跳过。
