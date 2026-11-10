# 发布阅读器

程序版本使用 SemVer，目前为 `0.1.0`；后续正式发布递增，例如 `0.1.1`。每次构建的 Release 使用独立 UTC 时间编号，不追加第四段数字到程序版本。CAFD 规范版本独立维护，目前为 `1.0.0`。

| 用途 | 示例 |
| --- | --- |
| 程序版本 | `0.1.0` |
| Release 标签 | `build-20261110T073000Z` |
| Release 标题 | `CAFD Reader 0.1.0 · 20261110T073000Z` |

时间编号由最前面的校验 job 生成一次（UTC、精确到秒），传递给全部构建和汇总 job，不使用各平台各自的时钟。编号代表构建开始时间，公开时间由 GitHub 另外记录。所有 job 固定检出触发运行时的提交 SHA，最终生成的构建标签也指向该提交。文件名带程序版本和同一时间编号，便于区分同一程序版本的不同构建。

## 发布范围

`.github/workflows/release.yml` 支持在 Actions 手动选择分支或标签运行，也支持推送 `v*` 正式版本标签。工作流校验 package.json、package-lock.json、Tauri、Cargo.toml、Cargo.lock 的程序版本完全一致；通过 `v*` 标签触发时还要求标签等于 `v` + 程序版本（例如 `v0.1.0`）。这只是正式版本的触发入口，最终 Release 标签始终为 `build-时间编号`。分别构建：

| 平台 | Release 附件 | 条件 |
| --- | --- | --- |
| Windows x64 | `cafd-reader-0.1.0-20261110T073000Z-windows-x64-setup.exe` | NSIS 安装包，当前不带 Windows 代码签名 |
| Ubuntu x64 | `cafd-reader-0.1.0-20261110T073000Z-ubuntu-x64.deb` | 在 Ubuntu 22.04 构建，目标为 Ubuntu 22.04+ x64；需系统 WebKitGTK 4.1 等依赖，安装与运行兼容性仍须在目标系统验收 |
| Android ARM64 | `cafd-reader-0.1.0-20261110T073000Z-android-arm64.apk` | Android 7.0 / API 24+，使用固定发布密钥签名 |

不包含 iOS 或 macOS Release 附件；本地构建入口及手动 macOS 验证仍保留。安装包只含宿主，不包含作品。

桌面构建执行 `cargo make test`，Linux 另用独立夹具执行原生重开验收；Android 执行基础检查，构建正式 APK 后先 zipalign，再 apksigner 签名，最后校验签名和对齐。打包完成不代表已经通过 Windows／Android 实机验收。

三个安装包必须具有相同程序版本和时间编号，齐全且非空后生成 `SHA256SUMS`，再创建指向本次提交的构建标签，一起上传到同一 Release 草稿。构建失败不会创建标签或草稿；标签重名时创建会失败，不复用、移动标签或覆盖已有附件。工作流不会自动公开草稿，不修改或提交源码，不上传应用商店。

程序版本为预发布版本（例如 `0.1.1-beta.1`）时草稿标记为 prerelease；普通 `build-` 前缀不会导致正式程序版本被误判为预发布。同一程序版本可生成多个构建 Release，但时间编号不替代安装包内的版本比较。正式对外升级时仍须递增程序版本。

## Android 签名配置

在仓库 Settings → Secrets and variables → Actions 中配置以下 Repository secrets：

| Secret | 值 |
| --- | --- |
| `ANDROID_KEYSTORE_BASE64` | 长期发布 keystore 文件的 Base64 编码 |
| `ANDROID_KEYSTORE_PASSWORD` | keystore 密码 |
| `ANDROID_KEY_ALIAS` | keystore 中发布密钥的 alias |
| `ANDROID_KEY_PASSWORD` | 发布密钥密码；与 keystore 密码相同时也要填写 |

已有发布密钥时沿用原密钥；首次发布可在本地通过 JDK `keytool` 创建并安全备份，例如：

```bash
keytool -genkeypair -v -keystore cafd-reader-release.jks \
  -alias cafd-reader -keyalg RSA -keysize 2048 -validity 10000
```

按提示设置密码，将 keystore 编码后作为 Secret 保存（不要提交 keystore 或编码文本）。例如 Ubuntu 使用 `base64 -w 0 cafd-reader-release.jks`。后续版本沿用同一签名密钥，以支持覆盖升级；调试包使用不同密钥，无法直接覆盖为正式包。

缺少任一 Secret 时 Android job 报错停止，不降级为调试包，也不临时生成发布密钥。密钥仅在签名步骤解码到 runner 临时目录，完成后始终执行清理，不上传密钥、密码或构建目录。

## 操作步骤

1. 同步修改 package.json、package-lock.json 根项目版本、src-tauri/tauri.conf.json、src-tauri/Cargo.toml 和 Cargo.lock 根包版本，更新版本说明。不要联动修改规范版本。
2. 本地执行 `cargo make test`，审查修改并提交；提交信息使用中文。
3. 明确决定构建发布包后，在 Actions 中手动运行“阅读器 Release”，选择包含此工作流的分支或标签；正式版本也可通过推送 `v0.1.0` 这样的对应标签触发。无需手动创建 `build-*` 标签。
4. 等待三个平台全部通过，在 Releases 检查 `build-*` 草稿中的程序版本、UTC 编号、三个附件和 SHA256SUMS，完成必要的目标系统验收并补齐发布说明后手动公开。

只有最后汇总 job 拥有 `contents: write`；其余 job 为只读。仓库必须允许 GitHub Actions 创建标签和 Release。整个工作流按仓库串行运行，避免同时汇总发布。仅重跑失败 job 沿用已生成的编号；重跑整个工作流时重新生成编号。若汇总阶段已经创建标签、但后续 Release 创建失败，重跑汇总会因标签存在而停止，可重跑整个工作流生成新编号，原标签另行人工处理。
