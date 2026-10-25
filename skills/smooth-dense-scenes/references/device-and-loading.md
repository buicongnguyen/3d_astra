# Device choice, safe boot and cache-safe loading

Lessons shipped and tested in Lantern Picnic 1.3/1.3.1 (`3D_claudeopus55`:
`src/engine/quality.js`, `src/lantern-main.js`, `scripts/build.mjs`, `scripts/deploy-play.mjs`,
`tests/quality.test.mjs`). Read this when a game must choose between a full 3D path and a
lighter one, when phones crash or stall on load, or when a CDN serves stale assets.

## 1. Choose the renderer per device, with fallbacks both ways

Send these to the light path (or the low tier): touch devices; screens under 700 px on the
short side; fewer than 4 cores or under 4 GB memory; data saver on; no WebGL2 or a software
renderer (SwiftShader); Intel HD/UHD; Mali, Adreno and PowerVR; Intel Macs.

- Safari reports every Mac GPU as "Apple GPU". Only Apple silicon exposes
  `WEBGL_compressed_texture_astc`, so use that to tell them apart.
- iPadOS reports a Mac user agent: treat `Mac && navigator.maxTouchPoints > 1` as touch.
- Probe the GPU exactly as the renderer will ask:
  `getContext('webgl2', { powerPreference: 'high-performance', failIfMajorPerformanceCaveat: true })`.
- Keep the decision table in a test, so new rules don't silently flip devices.

## 2. Boot must never strand the player

- Check for WebGL2 **before** downloading the 3D engine and models.
- If 3D throws, open the light path. If light assets fail, retry once, then try 3D.
- Write a "3D booting" marker to localStorage and clear it after the first few frames. A
  tab killed by a GPU out-of-memory never throws, so a marker left behind means "play
  light next visit".
- A saved "3D" choice that can't start resets to automatic, with a short message.

## 3. Lazy engine

Load the 3D scene and asset loader with dynamic `import()`, so the light path never
downloads three.js. Verify on the built `dist`: scan the **downloaded JS bodies** for
`WebGLRenderer`. Bundlers name shared chunks (e.g. `shared-*.js`), so checking URLs alone
misses it.

## 4. Fixed-name assets behind a CDN cache

GitHub Pages serves with `max-age=600`, so a redeploy can mix old and new files.
- At build time, write content hashes into a shipped manifest. Request `file?v=<hash>`,
  and fetch the manifest itself with `cache: 'no-cache'`.
- When deploying, keep the previous release's JS chunks (list them in a build-info file),
  so a page still running the old version can load its lazy chunks.

## Fixed-camera note

With a fixed camera, camera poses, particles and image-space effects belong to one baked
picture. On a layout or orientation change, reset them and snap walking characters to their
targets; otherwise the view sweeps off the picture for a second.
