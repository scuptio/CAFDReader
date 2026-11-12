# CAFD — CAF Document

> English | [简体中文](../zh-CN/CAFD.md)

The current specification is **1.0.0-draft.1 (unstable draft)**. It is not finalized and does not promise backward compatibility between drafts; fields, component names, worlds, ABI, and protocol conventions may change. Program and specification versions are maintained independently.

Spec version: 1.0.0-draft.1. The spec version is maintained independently of the reader product version.

CAFD is an interactive-document convention layered on the CAF container, with the `.cafd` extension — in Chinese, the "CAF 交互文档". A document may carry text, images, data, fonts, and a built-in interactive application; ancient-book e-editions are just one possible content type — CAFD is not limited to books.

## Container and support scope

- The underlying byte format remains CAF: the `CAF\0` magic, format version, hashing, signature, and verification rules are unchanged; keep using `caf-tool build/verify/inspect`.
- The reading profile supported by the current CAFD Reader is `caf:doc@1`, component name `cafd`; the built-in app protocol is `caf:doc-web@1`. The existing `application/x-caf-ebook` payload type is retained and is not a system file MIME.
- The container must actually declare the supported capability, the metadata must provide a valid `web_app_manifest`, and the app manifest must pass validation of its version, entry path, components, and operation scopes. The Worker checks the required capability before instantiation; the manifest is also validated before import into the native bookshelf.
- A `.cafd` file name does not imply verified or supported. Plain CAF files, unknown profiles, unknown app protocols, or corrupt documents must produce a clear error — no app is mounted, and nothing joins the native active bookshelf.
- The current convention reuses the reading profile; future document profiles need their own versions and compatibility capabilities — do not claim from this that the existing reader opens every CAFD.

## Identifier and extension

Extension `.cafd`, project MIME `application/x-cafd`, Apple document type `org.caf.document`. The suffix plays no part in the underlying CAF byte verification and does not make a file trustworthy. The host must verify the capability and the app protocol.

## Versioning and compatibility

Draft 1.0.0-draft.1 describes the current reading profile and app protocol and changes neither the CAF magic nor the ABI. Only profiles that are explicitly declared and verified as supported may run. Future new profiles and incompatible protocols must be negotiated explicitly — do not claim from this that arbitrary CAF files can be opened. An extension migration can keep the container bytes, the root hash, and personal records unchanged.

Capability and app-protocol identifiers are uniformly `caf:doc@1` and `caf:doc-web@1`; the host does not accept legacy names. The component name is `cafd` and the world is `cafd-reader`; the function ABI stays unchanged. Changing the component name, world, capability, or app-protocol declarations inside the container requires repacking and re-verification and changes the container root hash; personal records keyed by the old root hash are not automatically associated with the new container.

App handshake, capability boundaries, and resource/storage limits are specified in [cafd-web v1](cafd-web-v1.md). Reader branding and legacy file/data compatibility belong to the [implementation compatibility notes](../../docs/en/compatibility.md).
