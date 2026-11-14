# Releasing the reader

> English | [简体中文](../zh-CN/releasing.md)

The current specification is **1.0.0-draft.1 (unstable draft)**. It is not finalized and does not promise backward compatibility between drafts; fields, component names, worlds, ABI, and protocol conventions may change. Program and specification versions are maintained independently.

The program version uses SemVer, currently `0.1.0`; later official releases bump it, e.g. `0.1.1`. Each build's Release uses its own UTC time-based number; no fourth numeric segment is appended to the program version. The CAFD spec version is maintained independently, currently `1.0.0-draft.1`.

| Purpose | Example |
| --- | --- |
| Program version | `0.1.0` |
| Release tag | `build-20261110T073000Z` |
| Release title | `CAFD Reader 0.1.0 · 20261110T073000Z` |

The time number is generated once by the leading validation job (UTC, second precision) and passed to every build and the aggregation job — per-platform clocks are not used. The number represents the build start time; the publication time is recorded separately by GitHub. Every job pins the checkout to the commit SHA that triggered the run, and the resulting build tag also points at that commit. File names carry the program version plus the same time number, distinguishing different builds of one program version.

## Release scope

CI keeps only `Reader Release` (`.github/workflows/release.yml`), which supports manual runs on a chosen branch or tag in Actions, and pushing a `v*` release tag. The workflow validates that the program versions in package.json, package-lock.json, Tauri, Cargo.toml, and Cargo.lock all match; when triggered by a `v*` tag it additionally requires the tag to equal `v` + program version (e.g. `v0.1.0`). That is merely the trigger for an official release — the final Release tag is always `build-<time-number>`. It builds separately:

| Platform | Release attachment | Notes |
| --- | --- | --- |
| Windows x64 | `cafd-reader-0.1.0-20261110T073000Z-windows-x64-setup.exe` | NSIS installer, currently without Windows code signing |
| Ubuntu x64 | `cafd-reader-0.1.0-20261110T073000Z-ubuntu-x64.deb` | Built on Ubuntu 22.04, targeting Ubuntu 22.04+ x64; needs system WebKitGTK 4.1 etc. — install/run compatibility still has to be accepted on the target system |
| macOS universal | `cafd-reader-0.1.0-20261110T073000Z-macos-universal.dmg` | Universal DMG (Apple Silicon + Intel), unsigned and unnotarized; first launch needs a right-click → Open or `xattr -cr` to drop the quarantine attribute |
| Android ARM64 | `cafd-reader-0.1.0-20261110T073000Z-android-arm64.apk` | Android 7.0 / API 24+, signed in CI with the fixed keystore from Secrets (v1+v2) and installs directly; in-place upgrades require an unchanged certificate |
| Web | `cafd-reader-web-0.1.0-20261110T073000Z.tar.gz` | Static host (`dist-host/`) with a per-file SHA-256 `release.json`, so content projects can pin the hash and integrate it |

No iOS CI builds or Release attachments; its local build entry point remains. Installers contain the host only, no works.

Desktop builds run `cargo make test`; Linux additionally runs the native-relaunch acceptance with the standalone fixtures; Android runs basic checks, then the collected release `*-unsigned.apk` is aligned with zipalign, signed with the fixed keystore from Secrets via apksigner, and verified; the web host is assembled directly by a Node script (no Rust compilation) and packaged after the unit tests pass. A packaged build does not imply passing real-device acceptance on Windows/Android.

The four installers and the web host tarball must share the same program version and time number. Once all five are present and non-empty, `SHA256SUMS` is generated, a build tag pointing at the commit is created, and everything is uploaded together to a single Release draft. A failed build creates neither tag nor draft; a duplicate tag name fails the creation — tags are never reused, moved, or attachments overwritten. The workflow never publishes the draft automatically, never modifies or commits source, and never uploads to app stores.

When the program version is a pre-release (e.g. `0.1.1-beta.1`), the draft is marked prerelease; a plain `build-` prefix never makes a release program version look like a pre-release. Multiple build Releases may exist for one program version, but the time number does not replace the version comparison inside the installers. An official outward upgrade still requires bumping the program version.

## Artifact signing

Windows produces an unsigned NSIS installer; macOS produces an unsigned, unnotarized universal DMG whose first launch requires right-click → Open or `xattr -cr`. The Android release APK is signed by the workflow after zipalign, using the fixed keystore from Secrets via apksigner (v1+v2), and installs directly; the Release's SHA256SUMS corresponds to the signed attachment.

The signing keystore is generated locally by a maintainer, backed up offline, and configured as repository Secrets after base64 encoding: `ANDROID_KEYSTORE_BASE64`, `ANDROID_KEYSTORE_PASSWORD`, `ANDROID_KEY_PASSWORD`, `ANDROID_KEY_ALIAS`. The workflow only reads these Secrets and creates or imports no other keys; the keystore is decoded into a temporary directory and deleted right after signing. Missing secrets fail the Android job — it never falls back to an unsigned or ad-hoc-signed artifact. The certificate defines the in-place upgrade identity: if it is lost or replaced, installed users must uninstall and reinstall.

Under act without signing secrets, the Android job uses a throwaway keystore to verify the pipeline; that artifact carries no upgrade identity and must not be distributed. Pass the real secrets with `-s` for a complete verification.

## Steps

1. Bump the versions in package.json, the package-lock.json root project, src-tauri/tauri.conf.json, src-tauri/Cargo.toml, and the Cargo.lock root package in sync, and update the release notes. Do not touch the spec version.
2. Run `cargo make test` locally, review the changes, and commit; commit messages are written in English.
3. Once producing release packages is explicitly decided, run `Reader Release` manually in Actions, choosing the branch or tag containing the workflow; an official release can also be triggered by pushing the matching tag, e.g. `v0.1.0`. No need to create `build-*` tags manually; the four Android signing secrets must be configured beforehand — the Android job fails without them.
4. Wait for all five build jobs to pass, check the `build-*` draft in Releases for the program version, the UTC number, the five attachments, and SHA256SUMS, finish the necessary target-system acceptance, complete the release notes, and publish manually.

Only the final aggregation job has `contents: write`; every other job is read-only. The repository must allow GitHub Actions to create tags and Releases. The whole workflow runs serially per repository to avoid concurrent aggregations. Re-running only failed jobs reuses the generated number; re-running the whole workflow generates a new one. If the aggregation stage already created the tag but the Release creation then failed, re-running the aggregation stops on the existing tag — re-run the whole workflow for a new number and handle the old tag manually.

## Local verification with act

Artifact actions are pinned to `upload-artifact@v5.0.0` and `download-artifact@v6.0.0` for compatibility with act 0.2.97. Newer upload versions can fail with `unknown field "mime_type"` or blob signature errors in act's artifact server ([upstream issue](https://github.com/nektos/act/issues/6114)). Keep upload and download versions compatible when updating; verify a local upload/download round trip before changing these pins. The workflow uses the same actions on GitHub and locally, and upload failures remain fatal.

Run from the repository root; requires act and a reachable Docker. checkout uses the default event commit: on GitHub it checks out the triggering commit; act by default copies the current local sources (including uncommitted changes), and no token is needed for checkout. Do not add `--no-skip-checkout` — that would perform a real remote checkout.

Run the lightweight validation first:

```bash
act workflow_dispatch -W .github/workflows/release.yml -j validate \
  -P ubuntu-24.04=ghcr.io/catthehacker/ubuntu:act-24.04
```

Run the Ubuntu build, tests, and local artifact upload:

```bash
act workflow_dispatch -W .github/workflows/release.yml \
  -j desktop --matrix os:ubuntu-22.04 \
  -P ubuntu-22.04=ghcr.io/catthehacker/ubuntu:act-22.04 \
  -P ubuntu-24.04=ghcr.io/catthehacker/ubuntu:act-24.04 \
  --artifact-server-path "$PWD/build/act-artifacts"
```

Android can run alone with `-j android` and the Ubuntu 24.04 image; the web job can run alone with `-j web`. With images and Actions cached, add `--pull=false --action-offline-mode`; missing build dependencies still require network access. Windows must be verified in a Windows environment — a Linux container is no substitute. When act's `ACT` environment variable is detected, the final steps that create the GitHub tag and the Release draft are skipped; without signing secrets, the Android job likewise uses a throwaway keystore under act, only to verify the pipeline.
