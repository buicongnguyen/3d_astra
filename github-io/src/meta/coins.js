// H2 coins (HERO-COINS-PLAN.md; owner 2026-11-27): one wallet for the campaign, Faction Chronicles, skirmish
// and Frontier Defence, kept on this device. Coins come from playing (every finished mission or match pays,
// a loss too) and buy Skywing (src/sim/content/skywing.js) for one match, paid only when that match starts.
// New players start with a gift of START coins, enough for one Skywing. There is no "first purchase free".
// Ads come later (an AdMob reward in the Android/iOS app) through src/rewards-connector.js, which offers
// nothing today.
//
// Storage: localStorage key KEY (versioned), read and written with try/catch like the campaign progress
// (src/campaign.js): a broken or foreign value is cleaned field by field, never thrown. Editing it to cheat
// is fine in a single-player game. The wallet record:
//   { v: 1, coins, earned, spent, won: [mission ids won once], losses: { id: losses in a row },
//     hinted: [ids whose "Need help?" hint was shown this streak], day: "YYYY-MM-DD" of the last paid match,
//     paidAch: [achievement ids already paid] }
// Pure functions take and return records (Node tests); the storage pair at the bottom touches localStorage.
export const KEY = "frontier-coins-v1";
export const VERSION = 1;
export const START = 100;
export const SKYWING_PRICE = 60;
// The earn table (plan H2, owner update): a story mission pays WIN + STAR per medal star when won, FIRST
// more the first time it is won, LOSS when lost. A skirmish or Defence match pays 15 to 30 by result and
// length. The first paid match of each day adds DAILY; each new achievement ACHIEVEMENT once.
export const EARN = Object.freeze({ win: 40, star: 10, first: 30, loss: 25, matchWin: 20, matchLoss: 15, matchMinute: 1, matchCap: 10, daily: 20, achievement: 25, challengeWin: 20, challengePlay: 10, challengeStar: 15 });
// H8 Hero challenges (src/hero-challenges-ui.js): a finished challenge pays challengeWin (won) or challengePlay (lost:
// failing blocks nothing and still pays), plus challengeStar for each star better than its best so far (`newStars`).
// The briefing suggests Skywing after this many losses in a row on one mission.
export const HINT_AFTER = 2;

const MEDAL_STARS = { bronze: 1, silver: 2, gold: 3 };
const isRecord = (v) => !!v && typeof v === "object" && !Array.isArray(v);
const whole = (n) => (Number.isFinite(n) && n > 0 ? Math.floor(n) : 0);
const ids = (list) => (Array.isArray(list) ? [...new Set(list.filter((id) => typeof id === "string" && id))] : []);

// A new wallet: the starting gift. `progress` (the campaign record) marks the missions already won and the
// achievements already earned before the wallet existed, so an old save is not paid twice for them.
export function newWallet(progress = null) {
  return { v: VERSION, coins: START, earned: 0, spent: 0, won: Object.keys(isRecord(progress?.cleared) ? progress.cleared : {}), losses: {}, hinted: [], day: null, paidAch: ids(progress?.earned) };
}

// Cleans any stored value into a wallet (a missing or broken one becomes a new wallet).
export function migrate(raw, progress = null) {
  if (!isRecord(raw)) return newWallet(progress);
  const w = newWallet(progress);
  w.coins = whole(raw.coins);
  w.earned = whole(raw.earned);
  w.spent = whole(raw.spent);
  w.won = ids(raw.won);
  w.losses = isRecord(raw.losses) ? Object.fromEntries(Object.entries(raw.losses).map(([k, n]) => [k, whole(n)]).filter(([, n]) => n > 0)) : {};
  w.hinted = ids(raw.hinted);
  w.day = typeof raw.day === "string" ? raw.day : null;
  w.paidAch = ids(raw.paidAch);
  return w;
}

export const dayKey = (now = new Date()) => `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
export const canAfford = (w, price = SKYWING_PRICE) => !!w && w.coins >= price;

// Pays for Skywing: the new wallet, or null when there are not enough coins.
export function spend(w, price = SKYWING_PRICE) {
  if (!canAfford(w, price)) return null;
  return { ...w, coins: w.coins - price, spent: w.spent + price };
}

// What one finished match pays, as lines [{ id, coins }] (the debrief lists them) and their total.
// `summary`: { mode: "campaign"|"skirmish"|"defence", win, missionId, medal, seconds, achievements: [ids] }.
export function earnings(w, summary, now = new Date()) {
  const lines = [];
  const { mode, win, missionId = null, medal = null, seconds = 0 } = summary || {};
  if (mode === "campaign") {
    if (win) {
      lines.push({ id: "win", coins: EARN.win });
      const stars = MEDAL_STARS[medal] || 0;
      if (stars) lines.push({ id: "stars", coins: EARN.star * stars, stars });
      if (missionId && !w.won.includes(missionId)) lines.push({ id: "first", coins: EARN.first });
    } else lines.push({ id: "loss", coins: EARN.loss });
  } else if (mode === "challenge") {
    lines.push({ id: win ? "challengeWin" : "challengePlay", coins: win ? EARN.challengeWin : EARN.challengePlay });
    const fresh = whole(summary.newStars);
    if (fresh) lines.push({ id: "newStars", coins: EARN.challengeStar * fresh, stars: fresh });
  } else if (mode === "skirmish" || mode === "defence") {
    lines.push({ id: win ? "matchWin" : "matchLoss", coins: (win ? EARN.matchWin : EARN.matchLoss) + Math.min(EARN.matchCap, Math.floor(whole(seconds) / 60) * EARN.matchMinute) });
  } else return { lines: [], total: 0 };
  if (w.day !== dayKey(now)) lines.push({ id: "daily", coins: EARN.daily });
  const fresh = ids(summary.achievements).filter((id) => !w.paidAch.includes(id));
  if (fresh.length) lines.push({ id: "achievement", coins: EARN.achievement * fresh.length, count: fresh.length });
  return { lines, total: lines.reduce((n, l) => n + l.coins, 0), fresh };
}

// The wallet after a finished match: coins paid, the day, the first wins, the loss streak and the hint.
export function settle(w, summary, now = new Date()) {
  const { lines, total, fresh = [] } = earnings(w, summary, now);
  if (!lines.length) return { wallet: w, lines, total: 0 };
  const id = summary.missionId || null;
  const next = { ...w, coins: w.coins + total, earned: w.earned + total, day: dayKey(now), paidAch: [...w.paidAch, ...fresh], losses: { ...w.losses }, hinted: [...w.hinted], won: [...w.won] };
  if (id) {
    if (summary.win) {
      if (summary.mode === "campaign" && !next.won.includes(id)) next.won.push(id);
      delete next.losses[id];
      next.hinted = next.hinted.filter((h) => h !== id);
    } else next.losses[id] = (next.losses[id] || 0) + 1;
  }
  return { wallet: next, lines, total };
}

// "Need help? Take Skywing.": after HINT_AFTER losses in a row on this mission, once per streak.
export const wantsHint = (w, missionId) => !!missionId && (w.losses[missionId] || 0) >= HINT_AFTER && !w.hinted.includes(missionId);
export const markHinted = (w, missionId) => (w.hinted.includes(missionId) ? w : { ...w, hinted: [...w.hinted, missionId] });

// ---------------------------------------------------------------- Storage
const storage = () => { try { return globalThis.localStorage ?? null; } catch { return null; } };
export function loadWallet(progress = null, store = storage()) {
  try {
    const text = store?.getItem(KEY);
    return text ? migrate(JSON.parse(text), progress) : newWallet(progress);
  } catch {
    return newWallet(progress);
  }
}
export function saveWallet(w, store = storage()) {
  try { store?.setItem(KEY, JSON.stringify(w)); return true; } catch { return false; }
}
