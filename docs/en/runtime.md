# CAF browser runtime

> English | [简体中文](../zh-CN/runtime.md)

`web/reader/caf.js` is a pinned snapshot of the CAF browser runtime shipped with this reader, SHA-256 `30b2549f5fa82e3617d49c601833d0ea2cf885257e9c9e88bedb64be7727c666`; the corresponding reference commit in the CAF repository is `1eea5ef04ac619b85b2d9b39ef7fafbf918077ca`. The file carries the CAFD Worker capability-parameter adaptation needed for reader integration and is not a byte-identical upstream copy. Updating the runtime requires re-passing the protocol, isolation, and container-compatibility verification.

This repository ships no top-level LICENSE; the licenses of third-party dependencies still apply individually.

0.1.0 adds Worker Range XHR without JSPI and local Blob slice reading; the raw-block and verified-block caches are each capped at 16 MiB, and re-reads after eviction must re-verify the hash. Synchronous reads happen only in the dedicated Worker — never on the main thread.
