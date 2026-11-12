import { test } from "node:test";
import assert from "node:assert/strict";
import { createMessageQueue, ALERT, ROUTINE, SHOW_MS } from "../src/message-queue.js";

const text = (q) => q.current?.text ?? null;

test("an alert is never replaced by a routine notice; the notice waits its turn", () => {
  const q = createMessageQueue();
  q.push("Under attack!", ALERT, 0);
  q.push("Orders cleared.", ROUTINE, 1000);
  assert.equal(text(q), "Under attack!");
  assert.equal(q.current.priority, ALERT);
  assert.deepEqual(q.waiting.map((w) => w.text), ["Orders cleared."]);
  q.update(SHOW_MS - 1);
  assert.equal(text(q), "Under attack!", "the alert stays its full time");
  q.update(SHOW_MS);
  assert.equal(text(q), "Orders cleared.");
  assert.equal(q.current.until, SHOW_MS * 2, "the waiting notice gets its own full time");
  q.update(SHOW_MS * 2);
  assert.equal(q.current, null);
});

test("an alert replaces a routine notice at once and the notice comes back after it", () => {
  const q = createMessageQueue();
  q.push("Vanguard promoted to rank 1", ROUTINE, 0);
  q.push("Enemy attack incoming!", ALERT, 500);
  assert.equal(text(q), "Enemy attack incoming!");
  q.update(500 + SHOW_MS);
  assert.equal(text(q), "Vanguard promoted to rank 1");
});

test("the same alert again only refreshes its time", () => {
  const q = createMessageQueue();
  q.push("Under attack!", ALERT, 0);
  q.push("Under attack!", ALERT, 3000);
  assert.equal(q.current.until, 3000 + SHOW_MS);
  assert.deepEqual(q.waiting, []);
  // A routine notice with the alert's text keeps the alert style.
  q.push("Under attack!", ROUTINE, 3500);
  assert.equal(q.current.priority, ALERT);
});

test("a second alert waits for the first; routine notices replace each other", () => {
  const q = createMessageQueue();
  q.push("Under attack!", ALERT, 0);
  q.push("Ridge lost", ALERT, 100);
  q.push("No idle Harvesters.", ROUTINE, 200);
  assert.deepEqual(q.waiting.map((w) => w.text), ["Ridge lost", "No idle Harvesters."], "alerts go first");
  q.update(SHOW_MS);
  assert.equal(text(q), "Ridge lost");
  q.update(SHOW_MS + 100);
  q.push("No idle army units.", ROUTINE, SHOW_MS + 200);
  assert.equal(text(q), "Ridge lost");
  q.update(SHOW_MS * 2);
  assert.equal(text(q), "No idle Harvesters.");
  q.push("No idle army units.", ROUTINE, SHOW_MS * 2 + 10);
  assert.equal(text(q), "No idle army units.");
  assert.deepEqual(q.waiting, []);
});

test("identical waiting notices are kept once and the line is capped", () => {
  const q = createMessageQueue({ maxWaiting: 3 });
  q.push("Under attack!", ALERT, 0);
  for (const t of ["a", "b", "a", "c", "d"]) q.push(t, ROUTINE, 10);
  assert.deepEqual(q.waiting.map((w) => w.text), ["b", "c", "d"], "oldest routine notice dropped");
  q.push("Point lost", ALERT, 20);
  assert.deepEqual(q.waiting.map((w) => w.text), ["Point lost", "c", "d"]);
});

test("successful work hides routine notices but never an alert", () => {
  const q = createMessageQueue();
  q.push("Select units first.", ROUTINE, 0);
  assert.equal(q.dismissRoutine(10), null);
  q.push("Under attack!", ALERT, 20);
  q.push("Select units first.", ROUTINE, 30);
  q.dismissRoutine(40);
  assert.equal(text(q), "Under attack!");
  assert.deepEqual(q.waiting, []);
  q.clear();
  assert.equal(q.current, null);
});

test("same inputs, same outcome (deterministic)", () => {
  const run = () => {
    const q = createMessageQueue(), seen = [];
    const script = [[0, "A1", ALERT], [100, "r1", ROUTINE], [200, "A2", ALERT], [300, "r2", ROUTINE], [4600, null], [9200, null], [13800, null], [18400, null]];
    for (const [t, m, p] of script) { if (m) q.push(m, p, t); else q.update(t); seen.push(text(q)); }
    return seen;
  };
  assert.deepEqual(run(), run());
  assert.deepEqual(run(), ["A1", "A1", "A1", "A1", "A2", "r1", "r2", null]);
});
