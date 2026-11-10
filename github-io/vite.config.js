import { defineConfig } from "vite";
import { readFileSync } from "node:fs";

const pkg = JSON.parse(readFileSync(new URL("./package.json", import.meta.url), "utf8"));

export default defineConfig({
  base: "./",
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
    __BUILD_DATE__: JSON.stringify(new Date().toISOString().slice(0, 10)),
  },
  plugins: [{
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
