# caf:doc-web@1

> English | [简体中文](../zh-CN/ebook-web-v1.md)

Spec version 1.0.0. The current reading-document profile is caf:doc@1; the WASM data interface is provided by the document — the host interprets neither layout nor chapters.

## Discovery and mount

info() returns JSON metadata; the web_app_manifest field points to /app/manifest.json.
Manifest shape:
  {"protocol":"caf:doc-web@1","component":"ebook","entry":"/app/index.html",
   "methods":["info","toc","get","window","search","lookup","entity"],"sources":{...}}
The v1 HTML entry is self-contained in scripts and styles: no remote scripts, no external stylesheets, no nested frames.
The host reads the metadata, manifest, and HTML after CAF Worker verification; unknown protocols or invalid paths are refused a mount.
A legacy CAF without web_app_manifest allows browsing metadata only; there is no host-side layout fallback.

## Startup handshake

1. The host creates an iframe with sandbox="allow-scripts", injecting a host-managed CSP and script nonce.
2. The book sends {type:"caf-app-ready",protocol:"caf:doc-web@1"} to parent.
3. The host accepts exactly one handshake from the current iframe and passes a private MessagePort, the info, and the full rootHash.
4. The in-book client sends {id,op,...} on the port and receives {id,ok,value} or {id,ok:false,error}.

The null origin string is never a trust basis; event.source is checked against the actual current frame object.
Once the port exists, no capability requests are accepted on global window message.

## Port operations

call: {method,args}; only methods declared in the manifest, at most 8 string/u32 arguments,
  total serialized length at most 65536 characters. Execution happens in the serialized-queue WASM Worker.
read: {path}; reads only absolute payload paths that actually exist in the current book,
  rejecting dot segments, backslashes, NULs, missing resources, and over-limit resources;
  the result is a transferable ArrayBuffer.
storage:get: {key}; returns the small JSON value under the current rootHash, null when absent.
storage:set: {key,value}; keys accept only 1–64 letters/digits/:/_/- characters, JSON at most 4096 characters;
  at most 16 keys per book, namespaced as caf-app:<full root hash>:<key>.
No arbitrary host storage, networking, opening another book, popups, host DOM, or similar interfaces.

## Limits and lifecycle

A single resource is at most 32 MiB, the app manifest at most 64 KiB, the HTML entry at most 2 MiB,
and the port allows at most 8 concurrent requests.
A Worker operation times out after 15 seconds, the first network open after 60 seconds;
failure/termination rejects all pending calls; the app handshake is limited to 10 seconds.
On close, book switch, or load cancellation the current session is retired first, then the port is closed,
the iframe destroyed, and the Worker terminated; late responses cannot update the UI or remount.
Blob URLs created by the app are revoked when the document is destroyed.
The CSP blocks external scripts/styles and networking such as fetch; images, fonts, and audio/video
come from in-book bytes or Blob URLs.
The iframe isolates DOM and direct storage access and provides no deterministic JS CPU metering;
WASM terminability is guaranteed by the Worker. v1 targets modern browsers with module Workers,
iframe sandbox, and MessageChannel.

## Static hosting and offline

The host is served over local or remote static HTTP; a local CAF is opened via file picking or
drag-and-drop onto the host area.
No business service, database, login, or CDN is required. In-book resources are read from the
selected CAF over the port.
There is no promise that double-clicking the host HTML over file:// runs ES modules and Workers,
and no browser PWA caching is implemented.
Opening a local CAF downloads no remote book; opening does not mean unpacking a .cafd into a
reading app on a site.
