import { defineConfig } from "vite";
import { readFileSync, readdirSync } from "node:fs";
import { createHash } from "node:crypto";

const pkg = JSON.parse(readFileSync(new URL("./package.json", import.meta.url), "utf8"));

// Publishes sw.js: the template in tools/ with this build's file list and version.
function serviceWorker() {
  const hash = (parts) => createHash("sha256").update(parts).digest("hex").slice(0, 10);
  return {
    name: "publish-service-worker",
    generateBundle(_, bundle) {
      const files = Object.keys(bundle).filter((name) => !name.endsWith(".md") && !name.endsWith(".map"));
      const precache = ["./", "manifest.webmanifest", "favicon.svg", ...files];
      const models = readdirSync(new URL("./public/models/", import.meta.url)).filter((name) => name.endsWith(".glb")).sort();
      const modelHash = hash(models.map((name) => name + readFileSync(new URL("./public/models/" + name, import.meta.url)).length + hash(readFileSync(new URL("./public/models/" + name, import.meta.url)))).join());
      const build = hash(files.sort().join());
      const source = readFileSync(new URL("./tools/sw.template.js", import.meta.url), "utf8")
        .replace("__BUILD__", build).replace("__MODELS__", modelHash).replace("__PRECACHE__", JSON.stringify([...new Set(precache)]));
      this.emitFile({ type: "asset", fileName: "sw.js", source });
    },
  };
}

export default defineConfig({
  base: "./",
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
    __BUILD_DATE__: JSON.stringify(new Date().toISOString().slice(0, 10)),
  },
  plugins: [serviceWorker(), {
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
