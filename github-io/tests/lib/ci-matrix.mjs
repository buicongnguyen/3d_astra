// The CI browser matrix from .github/workflows/pages.yml: each `- name:` entry with its `scripts:`
// and optional `layoutOnly:`. Used by tests/ci-local.mjs and checked by tests/ci-matrix.test.js.
import { readFileSync } from "node:fs";

export const WORKFLOW = new URL("../../../.github/workflows/pages.yml", import.meta.url);

export function readMatrix(text = readFileSync(WORKFLOW, "utf8")) {
  const groups = [];
  for (const line of text.split(/\r?\n/)) {
    let m;
    if ((m = line.match(/^\s+- name: (\S+)\s*$/))) groups.push({ name: m[1], scripts: [], layoutOnly: "" });
    else if (groups.length && (m = line.match(/^\s+scripts: (.+)$/))) groups.at(-1).scripts = m[1].trim().split(/\s+/);
    else if (groups.length && (m = line.match(/^\s+layoutOnly: (.+)$/))) groups.at(-1).layoutOnly = m[1].trim();
  }
  return groups.filter((g) => g.scripts.length);
}
