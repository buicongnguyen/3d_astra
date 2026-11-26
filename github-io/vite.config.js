import { defineConfig } from "vite";
import { readFileSync, readdirSync } from "node:fs";
import { createHash } from "node:crypto";

const pkg = JSON.parse(readFileSync(new URL("./package.json", import.meta.url), "utf8"));
// V1 terrain: a hash of the ground detail layers (public/textures/ground/*.webp and 256/*.webp). The game asks for each layer with
// ?v=<this>, so a repainted set with the same file names reaches players without any code change.
function groundTextureVersion() {
  try {
    const dir = new URL("./public/textures/ground/", import.meta.url), webp = (sub) => readdirSync(new URL(sub, dir)).filter((name) => name.endsWith(".webp")).map((name) => sub + name);
    const names = [...webp(""), ...webp("256/")].sort();
    return createHash("sha256").update(names.map((name) => name + createHash("sha256").update(readFileSync(new URL(name, dir))).digest("hex")).join()).digest("hex").slice(0, 10);
  } catch {
    return "";
  }
}

// Publishes sw.js: the template in tools/ with this build's file list and version.
function serviceWorker() {
  const hash = (parts) => createHash("sha256").update(parts).digest("hex").slice(0, 10);
  return {
    name: "publish-service-worker",
    generateBundle(_, bundle) {
      // Audio never enters the precache: recorded music lives in public/music/ and is cached on first
      // play (fc-music in sw.template.js); this filter only guards against a track imported by mistake.
      const files = Object.keys(bundle).filter((name) => !name.endsWith(".md") && !name.endsWith(".map") && !/\.(m4a|mp3|ogg|opus|wav|aac|flac|webm)$/i.test(name));
      // Korean files (the UI and story catalogs and the Hangul font) are fetched only by players who pick
      // Korean, so they are not precached either: the worker keeps each one on its first fetch (LAZY).
      const lazy = files.filter((name) => /(^|\/)(ko|story-ko)-[\w-]+\.js$|noto-sans-kr-subset[\w-]*\.woff2$/.test(name));
      const precache = ["./", "manifest.webmanifest", "favicon.svg", "icons/icon-192.png", "icons/apple-touch-icon.png", ...files.filter((name) => !lazy.includes(name))];
      const models = readdirSync(new URL("./public/models/", import.meta.url)).filter((name) => name.endsWith(".glb")).sort();
      const modelHash = hash(models.map((name) => name + readFileSync(new URL("./public/models/" + name, import.meta.url)).length + hash(readFileSync(new URL("./public/models/" + name, import.meta.url)))).join());
      const build = hash(files.sort().join());
      const source = readFileSync(new URL("./tools/sw.template.js", import.meta.url), "utf8")
        .replace("__BUILD__", build).replace("__MODELS__", modelHash).replace("__PRECACHE__", JSON.stringify([...new Set(precache)])).replace("__LAZY__", JSON.stringify(lazy));
      this.emitFile({ type: "asset", fileName: "sw.js", source });
    },
  };
}

// Platform reach (2026-11-26): the iOS launch screens, one <link> per device and orientation from
// tools/icons/ios-splash.json (images made by tools/app-icons.mjs). iOS shows the one whose media query matches
// while a home-screen launch starts; the files are fetched only by iOS when it installs the app.
export function splashLinks() {
  const { devices } = JSON.parse(readFileSync(new URL("./tools/icons/ios-splash.json", import.meta.url), "utf8"));
  return devices.flatMap(([, w, h, dpr]) => [["portrait", w * dpr, h * dpr], ["landscape", h * dpr, w * dpr]].map(([orientation, pw, ph]) => ({
    href: `./icons/splash/${pw}x${ph}.jpg`,
    media: `(device-width: ${w}px) and (device-height: ${h}px) and (-webkit-device-pixel-ratio: ${dpr}) and (orientation: ${orientation})`,
  })));
}
function iosSplash() {
  return {
    name: "ios-launch-screens",
    transformIndexHtml(html) {
      const links = splashLinks().map(({ href, media }) => `    <link rel="apple-touch-startup-image" media="${media}" href="${href}" />`).join("\n");
      return html.replace(/(<link rel="apple-touch-icon"[^>]*>\r?\n)/, `$1${links}\n`);
    },
  };
}

export default defineConfig({
  base: "./",
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
    __BUILD_DATE__: JSON.stringify(new Date().toISOString().slice(0, 10)),
    __GROUND_TEXTURES__: JSON.stringify(groundTextureVersion()),
  },
  plugins: [serviceWorker(), iosSplash(), {
    name: "publish-recreation-prompt",
    generateBundle() {
      this.emitFile({
        type: "asset",
        fileName: "RECREATE_GAME_PROMPT.md",
        source: readFileSync(new URL("../RECREATE_GAME_PROMPT.md", import.meta.url), "utf8"),
      });
    },
  }],
  build: {
    target: "es2022",
    rolldownOptions: {
      output: {
        codeSplitting: {
          groups: [{ name: "three", test: /node_modules[\\/]three/ }],
        },
      },
    },
  },
});
