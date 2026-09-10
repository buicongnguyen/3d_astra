import { defineConfig } from "vite";
import { readFileSync } from "node:fs";

export default defineConfig({
  base: "./",
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
