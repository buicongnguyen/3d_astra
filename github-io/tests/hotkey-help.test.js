// W14 (2026-11-25): the PC keyboard list (help, `?`) left out keys the key handler binds itself: Page Up /
// Page Down (turn the camera), G (grid), Esc and ? (this list). Every key app/input-keyboard.js handles must be
// in the list; the list-only entries are never matched as bindings, so their own handlers keep running.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const source = readFileSync(new URL("../src/app/input-keyboard.js", import.meta.url), "utf8");
// src/hotkeys.js imports its CSS (a browser module): read its data and the list template instead.
const HOTKEYS = JSON.parse(readFileSync(new URL("../src/hotkeys.json", import.meta.url), "utf8")).commands;
const helpSource = readFileSync(new URL("../src/hotkeys.js", import.meta.url), "utf8");
const listed = new Set(HOTKEYS.flatMap((k) => k.key.split(" / ")));

test("every key the keyboard handler binds directly is in the help list", () => {
  const direct = { pageup: "Page Up", pagedown: "Page Down", g: "G", "?": "?", escape: "Esc", " ": "Space" };
  for (const [key, shown] of Object.entries(direct)) {
    assert.ok(source.includes(`key==='${key}'`), `the handler still binds ${JSON.stringify(key)}`);
    assert.ok(listed.has(shown), `${shown} is in the help list`);
  }
  assert.ok(helpSource.includes("${HOTKEYS.map(k=>`<button data-shortcut=\"${k.id}\""), "the help list draws every entry");
  for (const k of ["Shift+Space", "Ctrl+A", "Home", "Backspace", "+", "−", ","]) assert.ok(listed.has(k), k);
});

test("list-only entries are skipped as bindings and every listed key appears once", () => {
  assert.match(source, /HOTKEYS\.find\(k=>!k\.listOnly&&/);
  const only = HOTKEYS.filter((k) => k.listOnly).map((k) => k.id).sort();
  assert.deepEqual(only, ["escape", "grid", "help", "turn-left", "turn-right"]);
  for (const id of only) assert.ok(source.includes(`id==='${id}'`), `runShortcut handles ${id} (a click in the list)`);
  const keys = HOTKEYS.map((k) => k.key);
  assert.equal(new Set(keys).size, keys.length);
});

test("the new labels have Vietnamese and Korean text", () => {
  for (const lang of ["vi", "ko"]) {
    const { messages } = JSON.parse(readFileSync(new URL(`../src/locales/${lang}.json`, import.meta.url), "utf8"));
    for (const k of HOTKEYS.filter((h) => h.listOnly)) assert.ok(messages[k.label], `${lang}: ${k.label}`);
  }
});
