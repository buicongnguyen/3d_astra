// H2 coins (src/meta/coins.js; HERO-COINS-PLAN.md, owner 2026-11-27): the wallet's storage and migration, the
// 100-coin gift, the earn table (a loss pays 25), paying for Skywing, the "Need help?" hint, the inert rewards
// connector, and the bench check: a player who loses one mission in three can afford Skywing whenever they want.
import test from "node:test";
import assert from "node:assert/strict";
import { KEY, START, SKYWING_PRICE, EARN, newWallet, migrate, loadWallet, saveWallet, canAfford, spend, earnings, settle, wantsHint, markHinted, dayKey } from "../src/meta/coins.js";
import { rewards } from "../src/rewards-connector.js";
import { MISSIONS } from "../src/story/missions.js";

const store = (text = null) => { const m = new Map(text === null ? [] : [[KEY, text]]); return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), map: m }; };
const day1 = new Date(2026, 10, 27, 12), day2 = new Date(2026, 10, 28, 9);

test("a new player starts with 100 coins, enough for one Skywing; no free purchase", () => {
  const w = newWallet();
  assert.equal(START, 100);
  assert.equal(w.coins, 100);
  assert.equal(SKYWING_PRICE, 60);
  assert.ok(canAfford(w));
  const paid = spend(w);
  assert.equal(paid.coins, 40);
  assert.equal(paid.spent, 60);
  assert.equal(spend(paid), null, "40 coins do not buy a second one");
  assert.equal(w.coins, 100, "records are never changed in place");
});

test("storage: versioned key, try/catch, migration cleans every field", () => {
  assert.equal(KEY, "frontier-coins-v1");
  const s = store();
  assert.equal(loadWallet(null, s).coins, 100, "nothing stored: a new wallet");
  assert.equal(loadWallet(null, store("{broken")).coins, 100, "broken JSON: a new wallet");
  const throwing = { getItem() { throw new Error("denied"); }, setItem() { throw new Error("full"); } };
  assert.equal(loadWallet(null, throwing).coins, 100);
  assert.equal(saveWallet(newWallet(), throwing), false, "a full or blocked storage never throws");
  const w = migrate({ coins: -5, earned: "x", won: ["m01", 3, "m01"], losses: { m02: 2, m03: -1, m04: "a" }, hinted: "no", day: 7, paidAch: ["a"], extra: 1 });
  assert.deepEqual({ coins: w.coins, earned: w.earned, won: w.won, losses: w.losses, hinted: w.hinted, day: w.day, paidAch: w.paidAch, v: w.v }, { coins: 0, earned: 0, won: ["m01"], losses: { m02: 2 }, hinted: [], day: null, paidAch: ["a"], v: 1 });
  saveWallet({ ...newWallet(), coins: 230 }, s);
  assert.equal(loadWallet(null, s).coins, 230);
  // A player from before the wallet: missions already won and achievements already earned are not paid again.
  const old = newWallet({ cleared: { "m01-first-light": { time: 300 } }, earned: ["first-steps"] });
  assert.deepEqual(old.won, ["m01-first-light"]);
  assert.deepEqual(old.paidAch, ["first-steps"]);
  assert.equal(old.coins, 100);
});

test("the earn table: missions, matches, the first win, the daily bonus and achievements", () => {
  const w = { ...newWallet(), day: dayKey(day1) };
  const sum = (s) => earnings(w, s, day1);
  assert.equal(sum({ mode: "campaign", win: true, missionId: "m01", medal: "gold" }).total, EARN.win + 3 * EARN.star + EARN.first, "40 + 10 per star + 30 the first time");
  assert.equal(sum({ mode: "campaign", win: true, missionId: "m01", medal: "bronze" }).total, 40 + 10 + 30);
  assert.equal(sum({ mode: "campaign", win: false, missionId: "m01" }).total, 25, "a loss pays 25");
  const won = settle(w, { mode: "campaign", win: true, missionId: "m01", medal: "silver" }, day1).wallet;
  assert.equal(earnings(won, { mode: "campaign", win: true, missionId: "m01", medal: "silver" }, day1).total, 60, "no first-win bonus twice");
  for (const [win, seconds] of [[true, 0], [true, 3600], [false, 0], [false, 3600], [true, 300]]) {
    const n = sum({ mode: "skirmish", win, seconds }).total;
    assert.ok(n >= 15 && n <= 30, `skirmish ${win} ${seconds}s pays ${n}`);
    assert.equal(sum({ mode: "defence", win, seconds }).total, n, "Defence pays like a skirmish");
  }
  assert.ok(sum({ mode: "skirmish", win: true, seconds: 900 }).total > sum({ mode: "skirmish", win: false, seconds: 900 }).total, "a win pays more");
  assert.equal(sum({ mode: "training", win: true }).total, 0, "training pays nothing");
  // The first paid match of a day: +20.
  const fresh = newWallet();
  const first = settle(fresh, { mode: "skirmish", win: false, seconds: 0 }, day1);
  assert.equal(first.total, 15 + EARN.daily);
  assert.ok(first.lines.some((l) => l.id === "daily"));
  assert.equal(settle(first.wallet, { mode: "skirmish", win: false, seconds: 0 }, day1).total, 15, "once a day");
  assert.equal(settle(first.wallet, { mode: "skirmish", win: false, seconds: 0 }, day2).total, 35, "the next day again");
  // A new achievement pays once.
  const ach = settle(w, { mode: "campaign", win: false, missionId: "m02", achievements: ["a", "b"] }, day1);
  assert.equal(ach.total, 25 + 2 * EARN.achievement);
  assert.equal(settle(ach.wallet, { mode: "campaign", win: false, missionId: "m02", achievements: ["a", "b"] }, day1).total, 25);
  assert.equal(ach.wallet.coins, w.coins + ach.total);
  assert.equal(ach.wallet.earned, ach.total);
});

test("Need help? Take Skywing: after two losses in a row on one mission, once per streak", () => {
  let w = newWallet();
  const lose = (id) => (w = settle(w, { mode: "campaign", win: false, missionId: id }, day1).wallet);
  lose("m03");
  assert.equal(wantsHint(w, "m03"), false, "one loss");
  lose("m04");
  assert.equal(wantsHint(w, "m03"), false, "losses on two missions are not a streak");
  lose("m03");
  assert.equal(wantsHint(w, "m03"), true, "two in a row on m03");
  w = markHinted(w, "m03");
  assert.equal(wantsHint(w, "m03"), false, "shown once");
  lose("m03");
  assert.equal(wantsHint(w, "m03"), false, "still the same streak");
  w = settle(w, { mode: "campaign", win: true, missionId: "m03", medal: "bronze" }, day1).wallet;
  assert.equal(w.losses.m03, undefined, "a win ends the streak");
  lose("m03"); lose("m03");
  assert.equal(wantsHint(w, "m03"), true, "a new streak may hint again");
  assert.equal(wantsHint(w, null), false, "a skirmish has no mission");
});

test("the rewards connector is an interface only, and off", async () => {
  assert.equal(rewards.available, false);
  assert.deepEqual(rewards.offers(), []);
  assert.deepEqual(await rewards.offer("doubleCoins"), { granted: false, kind: "doubleCoins", reason: "unavailable" });
  assert.ok(Object.isFrozen(rewards));
});

test("bench: a player who loses one mission in three can afford Skywing whenever they want it", () => {
  // The campaign in order on Relaxed and Normal. Every third attempt is a loss (then a retry). The player buys
  // Skywing for every attempt (the most it could be wanted) and earns the worst medal (bronze) on every win,
  // on a single day (no daily bonus after the first match). The wallet must never stop a purchase.
  for (const medal of ["bronze", "silver"]) {
    let w = newWallet(), attempt = 0, low = Infinity, bought = 0;
    for (const m of MISSIONS) {
      for (let won = false; !won;) {
        attempt++;
        const paid = spend(w);
        assert.ok(paid, `${medal}: attempt ${attempt} (${m.id}) could not pay: ${w.coins} coins`);
        w = paid; bought++;
        low = Math.min(low, w.coins);
        won = attempt % 3 !== 0;
        w = settle(w, { mode: "campaign", win: won, missionId: m.id, medal }, day1).wallet;
      }
    }
    assert.equal(bought, attempt);
    assert.ok(low >= 0, `${medal}: lowest balance ${low}`);
  }
  // Replaying won missions (no first-win bonus) still pays for Skywing on every retry after a loss.
  let w = { ...newWallet(), won: MISSIONS.map((m) => m.id) };
  for (let i = 1; i <= 30; i++) {
    const lost = i % 3 === 0;
    if (lost || i % 3 === 1) { const p = spend(w); assert.ok(p, `replay ${i}`); w = p; }
    w = settle(w, { mode: "campaign", win: !lost, missionId: MISSIONS[i % MISSIONS.length].id, medal: "bronze" }, day1).wallet;
  }
});
