// The browser suites are plain scripts, so nothing but their own assertions says they check anything.
// This parses them (rolldown's parser) and looks for the assertions in the syntax tree, where a call
// swallowed by a trailing // comment is simply not there (K11; replaces review-2026-10-05).
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { parseAst } from "rolldown/parseAst";

const calls = (file) => {
  const out = [];
  const walk = (node) => {
    if (!node || typeof node !== "object") return;
    if (Array.isArray(node)) return node.forEach(walk);
    if (node.type === "CallExpression" && node.callee?.type === "MemberExpression" && node.callee.object?.name === "assert") out.push(node);
    for (const v of Object.values(node)) walk(v);
  };
  walk(parseAst(readFileSync(new URL(`./${file}`, import.meta.url), "utf8"), { lang: "js" }));
  return out;
};
const mentions = (node, name) => JSON.stringify(node).includes(`"name":"${name}"`);

test("the stages suite really asserts the camera focus offset (the assertion is code, not part of a comment)", () => {
  const focus = calls("stages.mjs").filter((c) => c.callee.property.name === "ok" && mentions(c.arguments[0], "abs") && mentions(c.arguments[0], "focus") && mentions(c.arguments[0], "state"));
  assert.ok(focus.length >= 1, "an assert.ok(Math.abs(state.focus - ...)) call exists in stages.mjs");
});

test("every browser suite parses and makes at least one assertion", () => {
  for (const file of ["stages.mjs", "choices.mjs", "story.mjs", "tactics-ui.mjs", "workshops.mjs"]) assert.ok(calls(file).length > 0, `${file} asserts something`);
});
