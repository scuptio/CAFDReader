# CAFD Reader

> English | [简体中文](README.zh-CN.md)

[![Reader Release](https://github.com/ybbh/CAFDReader/actions/workflows/release.yml/badge.svg)](https://github.com/ybbh/CAFDReader/actions/workflows/release.yml)

A cross-platform thin host for CAFD (CAF Document, `.cafd`) interactive documents. It supports documents conforming to the current reading profile and does not promise to open every CAF file. The content and the layout application ship with the document; the host handles the bookshelf, files, metadata, and a restricted bridge. CAFD is a document profile built on the [CAF](https://github.com/ybbh/caf) container format.

## Quick try

```bash
npm ci
cargo make reader web
python3 -m http.server 8612 --bind 127.0.0.1 --directory dist-host
```

Open <http://127.0.0.1:8612/reader/> in a browser, click 「打开 .cafd」 (*Open .cafd*) to pick a local file, or drag a file into the window.

## Build and run

Requires Node.js 24, Python 3.11+, Rust, and the platform SDKs. Linux needs the GTK 3 and WebKitGTK 4.1 development libraries; Windows needs MSVC and WebView2; macOS/iOS need Xcode; Android needs Java 21, the SDK, and the NDK.

```bash
cargo install cargo-make --version 0.37.24 --locked
npm ci
cargo make help
cargo make doctor
cargo make reader             # current desktop
cargo make reader web         # dist-host/
cargo make reader android --plan
cargo make reader android
cargo make reader ios         # builds the simulator on macOS
cargo make dev
```

Supports linux/windows/macos/web/android/ios; actual desktop builds require the matching host system. The first mobile run initializes the generated projects. Desktop builds default to an unsigned verification package, Android to a debug APK, iOS to a simulator build for the host architecture. Installers land in src-tauri/target/release/bundle/; mobile artifacts land in src-tauri/gen/.

On Ubuntu / Windows x64, the Android-only toolchain can be installed and configured in one step (the Node.js, Python, Rust, and cargo-make prerequisites above still apply):

```bash
cargo make setup-android -- --plan  # plan only
cargo make setup-android           # installs dependencies and interactively accepts SDK licenses
cargo make doctor android
cargo make reader android
```

Add `-- --yes` for unattended installation; the install locations are saved as project configuration and picked up automatically by later Android builds. Custom SDK directories and reusing the CI toolchain are supported — see [Android environment setup and build](docs/en/android-build.md).

## Standalone verification

```bash
cargo make test
cargo make reader web
python3 -m http.server 8612 --bind 127.0.0.1 --directory dist-host
# in another terminal; BASE can override the default address
cargo make test-browser
cargo make test-native -- --binary src-tauri/target/release/cafd-reader
```

Tests use small committed protocol fixtures and need neither any content project nor caf-tool. Only rebuilding the fixtures requires rustc's wasm32-unknown-unknown target and the CAF tooling:

```bash
cargo make fixtures -- --caf-tool /path/to/caf-tool
```

## Specification and artifacts

- [CAFD 1.0.0](spec/en/CAFD.md)
- [App bridge protocol](spec/en/ebook-web-v1.md)
- [Implementation compatibility](docs/en/compatibility.md)
- [CAF browser runtime](docs/en/runtime.md)

`cargo make reader web` produces a deterministic dist-host/release.json (software/spec versions and per-file hashes). When deploying to a content site, use the pinned manifest and the verified artifacts, overwriting the site's host files while keeping its books/catalog.json and content files. Installers contain no works.

The spec and the reader are versioned independently; the program is currently 0.1.0 and the spec 1.0.0. CI keeps only `Reader Release`: a manual run or pushing a `v*` release tag builds the Windows x64 installer, the Ubuntu x64 `.deb`, and the Android ARM64 unsigned release APK, collected into a Release draft. The workflow does not sign anything and needs no signing secrets; the Android APK must be signed separately before it can be installed. Every build gets a unified UTC tag, e.g. `build-20261110T073000Z`, titled `CAFD Reader 0.1.0 · 20261110T073000Z`; an actual release still bumps the program version. iOS is not published. Release steps are in [the release notes](docs/en/releasing.md). Builds and tests do not depend on external content repositories.

## Large-document reading

0.1.0 uses synchronous Range XHR from a dedicated Worker on Linux WebKit without JSPI, avoiding converting the whole document into an ArrayBuffer. Local File/Blob is sliced on demand inside the Worker; the raw-block and verified-block caches are each capped at 16 MiB, and re-reads after eviction re-verify the hash. Synchronous I/O never runs on the main thread or in the document iframe. Serving over the network on demand requires a static HTTP server with Range support.

Native acceptance isolates the browser cache and D-Bus on every launch while keeping one temporary native bookshelf to verify record recovery; `--max-read-bytes` and `--max-cache-bytes` check the actual read volume. Inside a book, `data-caf-ready="false"` marks initialization in progress and turns true when done — acceptance never exits early on the cover alone.
