// R3-R: commander rank and unlocks (src/profile-rank.js, pure). The XP formula, the twenty ranks and their
// unlocks, the stored profile, one match into the profile (rank up, Daily order once a day), the paint
// view plugin, and that no pick can reach the simulation. The page side is tests/rank.mjs (CI matrix r3-r).
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { translate } from '../src/i18n.js';
import { RULE_OPTIONS } from '../src/app/rule-options.js';
import { VIEW_PLUGINS } from '../src/view-plugins.js';
import {
  RANKS, ITEMS, KINDS, KIND_LABELS, MAX_RANK, XP, PLEDGE_XP, PROFILE_KEY, xpForRank, xpForMatch, rankOf, recordMatch,
  freshProfile, normalizeProfile, loadProfile, saveProfile, withPick, RankPaintView, setActivePaint, activePaint, paintTint,
} from '../src/profile-rank.js';

const win = { mode: 'skirmish', result: 'victory', win: true, seconds: 900, stats: { killed: 10, lost: 8, built: 9 }, difficulty: 'standard', medal: null, stars: null, score: null };
const loss = { ...win, result: 'defeat', win: false, stats: { killed: 3, lost: 12, built: 4 } };

test('XP formula: played, win, Veteran, medal, Defence stars and waves, kills, the cap', () => {
  assert.deepEqual(xpForMatch(win), { total: 105, parts: [{ label: 'Match played', xp: 25 }, { label: 'Victory', xp: 75 }, { label: 'Kills', xp: 5 }], pledgeMet: false });
  assert.equal(xpForMatch(loss).total, 25 + 1, 'a loss still pays the match played and its kills');
  assert.equal(xpForMatch({ ...win, difficulty: 'veteran' }).total, 105 + XP.veteran);
  assert.equal(xpForMatch({ ...loss, difficulty: 'veteran' }).total, 26, 'the Veteran bonus is for a win');
  assert.equal(xpForMatch({ ...win, mode: 'campaign', medal: 'gold' }).total, 105 + 50);
  assert.equal(xpForMatch({ ...win, mode: 'campaign', medal: 'bronze' }).total, 105 + 20);
  assert.equal(xpForMatch({ ...win, mode: 'defence', stars: 3, stats: {} }).total, 25 + 75 + 60, 'Defence: 20 XP a star');
  // Endless / Daily: a score is never a defeat; 5 XP a wave held, at most 50 waves.
  assert.equal(xpForMatch({ mode: 'defence', result: 'defeat', win: false, score: 12, stats: {} }).total, 25 + 75 + 60);
  assert.equal(xpForMatch({ mode: 'defence', result: 'defeat', win: false, score: 900, medal: 'gold', difficulty: 'veteran', stats: { killed: 9999 } }).total, XP.cap, 'capped at 400 a match');
  assert.equal(xpForMatch({ mode: 'training', result: 'victory', tutorialDone: true }).total, 100);
  assert.equal(xpForMatch({ mode: 'training', result: 'victory', tutorialDone: false }).total, 25);
  assert.equal(xpForMatch({ ...win, stats: { killed: 400 } }).total, 25 + 75 + XP.maxKills, 'kills: 1 XP per 2, at most 25');
  // Daily orders: only on a win, only when met, only while today's is unused.
  const lean = { ...win, stats: { killed: 0, lost: 0, built: 4 } };
  assert.equal(xpForMatch(lean, { pledge: 'lean' }).total, 100 + PLEDGE_XP);
  assert.equal(xpForMatch(lean, { pledge: 'lean', pledgeReady: false }).total, 100);
  assert.equal(xpForMatch(lean, { pledge: 'hunter' }).total, 100, 'not met: no bonus');
  assert.equal(xpForMatch({ ...lean, result: 'defeat', win: false }, { pledge: 'lean' }).total, 25, 'a loss meets no order');
  assert.equal(xpForMatch({ ...win, seconds: 700 }, { pledge: 'swift' }).pledgeMet, true);
  assert.equal(xpForMatch({ ...win, stats: { lost: 5 } }, { pledge: 'ironline' }).pledgeMet, true);
});

test('twenty ranks, rising thresholds, one unlock each from rank 2, every item reachable', () => {
  assert.equal(RANKS.length, MAX_RANK);
  assert.equal(MAX_RANK, 20);
  assert.deepEqual(RANKS.slice(0, 5).map((r) => r.xp), [0, 100, 250, 450, 700]);
  assert.equal(xpForRank(20), 10450);
  for (let i = 1; i < RANKS.length; i++) {
    assert.ok(RANKS[i].xp > RANKS[i - 1].xp, `rank ${i + 1} costs more`);
    assert.ok(RANKS[i].unlocks.length >= 1, `rank ${i + 1} unlocks something`);
  }
  assert.deepEqual(RANKS[0].unlocks, [], 'rank 1 has the defaults only');
  assert.deepEqual(RANKS[1].unlocks.map((u) => `${u.kind}:${u.id}`), ['paint:sand'], 'the first rank up unlocks a paint');
  for (const kind of KINDS) {
    assert.equal(ITEMS[kind][0].rank, 1, `${kind}: the default is open from the start`);
    assert.equal(new Set(ITEMS[kind].map((i) => i.id)).size, ITEMS[kind].length);
    for (const item of ITEMS[kind]) assert.ok(item.rank >= 1 && item.rank <= MAX_RANK, `${kind}:${item.id}`);
  }
  assert.deepEqual(rankOf(0), { rank: 1, name: 'Recruit', xp: 0, floor: 0, next: 100, progress: 0 });
  assert.equal(rankOf(99).rank, 1);
  assert.equal(rankOf(100).rank, 2);
  assert.equal(rankOf(1e9).rank, 20);
  assert.equal(rankOf(1e9).next, null);
  // A Standard skirmish win is the first rank up.
  assert.ok(xpForMatch(win).total >= RANKS[1].xp);
});

test('the profile: stored in try/catch, bad data and locked picks fall back, blocked storage is harmless', () => {
  const store = new Map();
  const storage = { getItem: (k) => store.get(k) ?? null, setItem: (k, v) => store.set(k, v) };
  assert.deepEqual(loadProfile(storage), freshProfile());
  const p = withPick({ ...freshProfile(), xp: 300 }, 'emblem', 'spear');
  assert.equal(p.picks.emblem, 'spear');
  assert.equal(withPick(p, 'paint', 'gold'), p, 'a locked item cannot be picked');
  assert.ok(saveProfile(p, storage));
  assert.ok(store.has(PROFILE_KEY));
  assert.deepEqual(loadProfile(storage), p);
  // Hand-edited data: locked picks, unknown ids and junk are cleaned.
  assert.deepEqual(normalizeProfile({ xp: 120, matches: 2, picks: { paint: 'gold', emblem: 'nope', banner: 'field', pledge: 'hunter' }, pledgeDay: 'x' }),
    { xp: 120, matches: 2, picks: { paint: 'factory', emblem: 'ring', banner: 'field', pledge: 'none' }, pledgeDay: null });
  assert.deepEqual(normalizeProfile({ xp: -5, matches: 'many' }), freshProfile());
  const blocked = { getItem() { throw new Error('blocked'); }, setItem() { throw new Error('blocked'); } };
  assert.deepEqual(loadProfile(blocked), freshProfile());
  assert.equal(saveProfile(p, blocked), false);
  storage.setItem(PROFILE_KEY, '{broken');
  assert.deepEqual(loadProfile(storage), freshProfile());
});

test('a match into the profile: rank up with its unlocks, and the Daily order pays once a day', () => {
  const first = recordMatch(freshProfile(), win, { day: '2026-11-22' });
  assert.equal(first.gained, 105);
  assert.equal(first.rankUp, true);
  assert.deepEqual([first.before.rank, first.after.rank], [1, 2]);
  assert.deepEqual(first.unlocked.map((u) => `${u.kind}:${u.id}`), ['paint:sand']);
  assert.equal(first.profile.matches, 1);
  assert.equal(withPick(first.profile, 'paint', 'sand').picks.paint, 'sand', 'the unlocked paint can be picked');
  // Several ranks at once list every unlock between them.
  const jump = recordMatch({ ...freshProfile(), xp: 90 }, { mode: 'defence', score: 60, stats: {} });
  assert.deepEqual([jump.before.rank, jump.after.rank], [1, 3]);
  assert.deepEqual(jump.unlocked.map((u) => u.id), ['sand', 'spear']);
  // Daily order: met today once, then not again until tomorrow.
  let p = { ...freshProfile(), xp: 800, picks: { ...freshProfile().picks, pledge: 'ironline' } };
  const met = { ...win, stats: { killed: 0, lost: 2, built: 3 } };
  const a = recordMatch(p, met, { day: '2026-11-22' });
  assert.equal(a.pledgeMet, true);
  assert.equal(a.gained, 100 + PLEDGE_XP);
  const b = recordMatch(a.profile, met, { day: '2026-11-22' });
  assert.equal(b.pledgeMet, false);
  assert.equal(b.gained, 100);
  assert.equal(recordMatch(b.profile, met, { day: '2026-11-23' }).pledgeMet, true);
});

test('paint: a view tint on the player\'s units only, Factory sets nothing, a new pick repaints', () => {
  assert.ok(VIEW_PLUGINS.includes(RankPaintView), 'registered as a view plugin');
  const part = () => ({ isMesh: true, userData: {} });
  const unit = (team, kind = 'unit') => {
    const parts = [part(), part()];
    return { e: { team, kind }, root: { userData: { model: { traverse: (fn) => parts.forEach(fn) } } }, parts };
  };
  const objects = new Map();
  const view = { objects };
  const plugin = new RankPaintView(view);
  setActivePaint('factory');
  const mine = unit(0), theirs = unit(1), base = unit(0, 'building');
  for (const [i, u] of [mine, theirs, base].entries()) { plugin.dress(u.root, u.e); objects.set(i, u.root); }
  assert.ok(mine.parts.every((p) => !('tint' in p.userData)), 'Factory: nothing set, the frame is as before');
  setActivePaint('sand');
  assert.equal(activePaint(), 'sand');
  assert.ok(mine.parts.every((p) => p.userData.tint === paintTint('sand')), 'the player\'s unit is repainted');
  assert.ok(theirs.parts.every((p) => !('tint' in p.userData)), 'enemies keep their colours');
  assert.ok(base.parts.every((p) => !('tint' in p.userData)), 'buildings keep their colours');
  const fresh = unit(0);
  plugin.dress(fresh.root, fresh.e);
  assert.ok(fresh.parts.every((p) => p.userData.tint === paintTint('sand')), 'new units come out painted');
  setActivePaint('factory');
  assert.ok(mine.parts.every((p) => !('tint' in p.userData)), 'back to Factory clears the tint');
  setActivePaint('nope');
  assert.equal(activePaint(), 'factory');
});

test('no pick reaches the simulation, and every rank string reads in Vietnamese and Korean', () => {
  const ids = RULE_OPTIONS.map((o) => o.id);
  for (const kind of [...KINDS, 'rank']) assert.ok(!ids.includes(kind), `${kind} is not a battle rule`);
  const read = (p) => readFileSync(new URL(`../src/${p}`, import.meta.url), 'utf8');
  for (const file of ['profile-rank.js', 'rank-ui.js']) {
    const src = read(file);
    assert.doesNotMatch(src, /rules-store|rule-options|S\.rules|options\.rules\s*=|from ["']\.\/sim|simulation\.js/, `${file} never touches the rules or the sim`);
    assert.doesNotMatch(src, /Math\.random/);
  }
  assert.doesNotMatch(read('rank.css'), /system-ui/);
  const strings = [...RANKS.map((r) => r.name), ...KINDS.flatMap((k) => ITEMS[k].flatMap((i) => [i.label, ...(i.help ? [i.help] : [])])), ...Object.values(KIND_LABELS),
    'Commander rank', 'Rank up!', 'Commander XP', 'Unlocked:', 'Daily order met', 'Pick it in the Skirmish setup.', 'Paint · Sand',
    'Rank 3', 'Rank 14', 'Unlocks at rank 6', `Pledge a Daily order for +${PLEDGE_XP} XP on a win, once a day. It never changes a battle.`];
  for (const lang of ['vi', 'ko']) for (const text of strings) assert.notEqual(translate(text, lang), text, `${lang}: ${text}`);
  assert.equal(translate('Rank 14', 'vi'), 'Bậc 14');
  // XP numbers: Vietnamese players say "XP" (kept), Korean reads 경험치.
  assert.equal(translate('250 / 450 XP', 'ko'), '250 / 450 경험치');
  assert.equal(translate('10450 XP', 'ko'), '경험치 10450');
  assert.equal(translate('+105 XP', 'ko'), '+105 경험치');
});
