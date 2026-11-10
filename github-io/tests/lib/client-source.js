// Source-text access for tests that check client code which needs a DOM and cannot be imported.
// The client lives in src/main.js (composition root) and src/app/*.js. Modules reach shared state
// as `S.x`, the other modules as `A.fn` and the screen machine as `Z.x`; `plain` drops those
// prefixes so a test can keep asserting on the statement as it reads ("sim.result", "hover = null").
import { readFileSync, readdirSync } from "node:fs";

const src = new URL("../../src/", import.meta.url);
const strip = (text) => text.replace(/\b(?:S|A|Z)\.(?=[A-Za-z_$])/g, "");

export function clientFile(name, { plain = true } = {}) {
  const text = readFileSync(new URL(name === "main.js" ? name : `app/${name}`, src), "utf8");
  return plain ? strip(text) : text;
}

export function clientSource({ plain = true } = {}) {
  const files = ["main.js", ...readdirSync(new URL("app/", src)).filter((f) => f.endsWith(".js")).sort()];
  return files.map((f) => clientFile(f, { plain })).join("\n");
}

// The text of `function name(...) { ... }`, up to the closing brace at the same indentation.
export function functionBody(text, name) {
  const start = text.search(new RegExp(`(?:async )?function ${name}\\(`));
  if (start < 0) throw new Error(`function ${name} not found`);
  const lineStart = text.lastIndexOf("\n", start) + 1;
  const indent = text.slice(lineStart, start).match(/^\s*/)[0];
  const end = text.indexOf(`\n${indent}}`, start);
  return text.slice(start, end + indent.length + 2);
}
