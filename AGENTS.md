# CAFD Reader Project Rules

This repository maintains the general-purpose CAFD Reader, the CAFD 1.0.0-draft.1 specification, and compatibility tests. Do not depend on directories, PDFs, editing data, or WASM build artifacts from any content project.

- `web/` is a thin host for the document shelf, opening and closing documents, metadata, and controlled resource/WASM/storage bridges. Do not add content features such as body pagination, annotations, translation, or facsimile rendering.
- `src-tauri/` handles cross-platform files, protocols, the bookshelf, and private records. Preserve compatibility for the application identifier `org.caf.reader`, cafbook/cafcover, and storage keys.
- `spec/` is the sole maintenance location for the specification. Keep `spec/en/` and `spec/zh-CN/` in sync, with matching content and version numbers. Specification versions are independent of application versions; explicitly reject unknown profiles or application protocols. Maintain bilingual documentation with matching filenames in `docs/en/` and `docs/zh-CN/`, and root READMEs at `README.md` (English) and `README.zh-CN.md` (Simplified Chinese). Keep both languages in sync when adding or modifying documentation or specifications.
- Fixtures in `tests/fixtures/` must be independently reproducible. General-purpose tests must not require real works.
- `dist-host/release.json` records the Web artifact version, specification version, and per-file SHA hashes. Content projects should pin its hash instead of copying host source code.
- `cargo make reader [platform]` builds the reader; `cargo make test` checks protocols and Rust; `cargo make test-browser` verifies Web isolation; `cargo make test-native -- --binary ...` tests two launches.
- Install dependencies with `npm ci`. The cargo-make baseline is 0.37.24. Running `cargo make` with no task displays the available tasks.
- Do not alter content document bytes. The host validates the CAF container and supported capabilities before execution. Preserve the iframe sandbox and restrictive CSP, and run WASM in a terminable Worker.
- Publishing, pushing, installing to the system, or changing the user's everyday bookshelf requires explicit authorization. Write commit messages in English.
