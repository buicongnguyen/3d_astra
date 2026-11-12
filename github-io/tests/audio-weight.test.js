// "Sound that has weight" (plan 2026-11-13, item 4): the mixing rules and the rendered effect bank.
// Everything here is pure (no Web Audio): voice caps, rate limits, ducking, intensity -> music layers,
// distance gain, weapon voices, and the sample synthesis itself (levels, sizes, loops).
import test from "node:test";
import assert from "node:assert/strict";
import { CombatIntensity, ContactWatch, LoudDuck, RadioGate, VoiceBudget, closeness, combatFloor, composeBar, crossfade, dbToGain, engineMix, explosionSize, hitFor, intensityWeight, radioKind, shouldCull, soundFor, spatialMix, tempoFor, weaponVoice, zoomGain, MAP_FLAVOUR } from "../src/audio-logic.js";
import { MIX } from "../src/audio-mix.js";
import { BANK, ENGINE, RADIO_KINDS, RADIO_VOICE, radioSpec } from "../src/sfx-bank.js";
import { SYNTH_RATE, renderEngine, renderSound } from "../src/audio-synth.js";
import { hasSound, variantsFor } from "../src/sfx.js";
import balance from "../src/balance.json" with { type: "json" };
import style from "../src/visual-style.json" with { type: "json" };

const energy = (x) => { let e = 0; for (const v of x) e += v * v; return e / SYNTH_RATE; };
const peak = (x) => { let p = 0; for (const v of x) p = Math.max(p, Math.abs(v)); return p; };

test("voice budget: global cap of 24 and per-group caps hold through a big fight", () => {
  const b = new VoiceBudget();
  assert.equal(b.max, 24);
  let rnd = 1; const r = () => ((rnd = (rnd * 16807) % 2147483647) / 2147483647);
  const kinds = [["shot:rifle", 2, "weapon", 0.4], ["shot:tank", 3, "weapon", 1.2], ["impact:body", 1, "impact", 0.16], ["hit:shell", 4, "explosion", 1.9], ["boom:heavy", 5, "explosion", 2.4], ["shot:smg", 2, "weapon", 0.5]];
  let worst = 0;
  for (let i = 0; i < 2000; i++) {
    const now = i * 0.004, [name, priority, group, len] = kinds[Math.floor(r() * kinds.length)];
    b.tryAcquire(`${name}`, priority + r(), now, len, 0, group);
    worst = Math.max(worst, b.active);
    assert.ok(b.count("weapon") <= MIX.groupCaps.weapon && b.count("explosion") <= MIX.groupCaps.explosion && b.count("impact") <= MIX.groupCaps.impact);
  }
  assert.ok(worst <= MIX.maxVoices, `peak voices ${worst}`);
});

test("voice budget: a full group steals its own lowest voice, never another group's", () => {
  const b = new VoiceBudget(24, { weapon: 2, explosion: 2 });
  assert.ok(b.tryAcquire("a", 2, 0, 1, 0, "weapon")); assert.ok(b.tryAcquire("b", 3, 0, 1, 0, "weapon"));
  assert.ok(b.tryAcquire("x", 1, 0, 1, 0, "explosion"));
  assert.equal(b.tryAcquire("c", 1, 0.01, 1, 0, "weapon"), null, "lower priority than the group is dropped");
  const got = b.tryAcquire("d", 5, 0.01, 1, 0, "weapon");
  assert.equal(got.stolen.name, "a"); assert.equal(b.count("weapon"), 2); assert.equal(b.count("explosion"), 1);
  assert.equal(new VoiceBudget(24, { radio: 0 }).tryAcquire("r", 9, 0, 1, 0, "radio"), null, "a zero cap mutes a group");
});

test("radio replies: one at a time, not the same reply over and over, contact rarely", () => {
  const g = new RadioGate();
  assert.equal(g.allow("move", 0), true);
  assert.equal(g.allow("attack", 1), false, "within 1.5 s of the last reply");
  assert.equal(g.allow("attack", 1.6), true);
  assert.equal(g.allow("move", 3.2), false, "same kind within 4 s");
  assert.equal(g.allow("move", 4.1), true);
  assert.equal(g.allow("contact", 6), true);
  assert.equal(g.allow("contact", 20), false, "contact at most every 20 s");
  assert.equal(g.allow(null, 100), false);
  // A drag of quick orders (ten in a second) gives one reply.
  const d = new RadioGate(); let n = 0;
  for (let i = 0; i < 10; i++) if (d.allow(radioKind(i % 2 ? "move" : "attack"), i * 0.1)) n++;
  assert.equal(n, 1);
  assert.equal(radioKind("attackmove"), "attack"); assert.equal(radioKind("gather"), "move"); assert.equal(radioKind("stop"), null); assert.equal(radioKind("build"), "build");
});

test("enemy contact: the first sighting, then only after a quiet spell", () => {
  const c = new ContactWatch(30);
  assert.equal(c.update(0, 0), false);
  assert.equal(c.update(5, 2), true, "first enemy in sight");
  assert.equal(c.update(6, 3), false);
  assert.equal(c.update(20, 1), false, "seen again soon after");
  assert.equal(c.update(51, 1), true, "back after more than 30 s without contact");
});

test("loud events duck the music: deepest wins, scaled by closeness, then recovers", () => {
  const d = new LoudDuck();
  assert.equal(d.db(0), 0);
  d.hit(0, "medium", 1);
  assert.equal(d.db(0.1), MIX.loudDuck.medium[0]);
  d.hit(0.1, "huge", 0.35);
  assert.ok(Math.abs(d.db(0.2) - MIX.loudDuck.huge[0] * 0.4) < 1e-9, "far off screen ducks 40 % as much");
  assert.equal(d.db(5), 0, "released after the hold");
  d.hit(10, "large", 1, 0.3);
  assert.equal(d.db(10.1), 0, "a shell in flight ducks when it lands");
  assert.equal(d.db(10.35), MIX.loudDuck.large[0]);
  d.hit(20, "small?", 1); assert.equal(d.db(20), 0, "unknown sizes do nothing");
  assert.ok(dbToGain(-6) > 0.49 && dbToGain(-6) < 0.51);
  assert.equal(explosionSize("hit:shell"), "medium"); assert.equal(explosionSize("boom:core"), "huge"); assert.equal(explosionSize("shot:rifle"), null);
});

test("combat intensity drives the combat layer and fades about 8 s after the fight", () => {
  const i = new CombatIntensity();
  assert.deepEqual(crossfade(i.level(0)), { combat: 0, base: 1 });
  i.add(1, intensityWeight("shot:rifle") * 0.25);
  assert.ok(crossfade(i.level(1)).combat < 0.05, "one distant rifle shot barely registers");
  for (let k = 0; k < 12; k++) i.add(2 + k * 0.1, intensityWeight(k % 3 ? "shot:tank" : "hit:shell"));
  const fight = crossfade(i.level(3.2));
  assert.equal(fight.combat, 1, "a close fight brings the full combat layer");
  assert.ok(Math.abs(fight.base - (1 - MIX.baseDip)) < 1e-9, "the base layer dips under it");
  assert.ok(crossfade(i.level(3.1 + 7)).combat > 0.9, "held for 8 s after the last shot");
  assert.ok(crossfade(i.level(3.1 + 8 + 6)).combat < 0.1, "then fades");
  i.reset(); assert.equal(i.level(100), 0);
  assert.equal(crossfade(0, combatFloor("battle", "battle")).combat, 1, "a mission asking for battle gets it all");
  assert.equal(crossfade(0, combatFloor("battle", "calm")).combat, MIX.battleFloor);
  assert.equal(crossfade(0, combatFloor("calm", "calm")).combat, 0);
  assert.equal(intensityWeight("shot:support"), 0, "heals are not combat");
  assert.ok(intensityWeight("boom:building") > intensityWeight("boom:small"));
});

test("distance gain: off screen and zoomed out are quieter; far small sounds are skipped", () => {
  assert.equal(zoomGain(22), 1); assert.ok(Math.abs(zoomGain(88) - (1 - MIX.zoomQuiet)) < 1e-9); assert.equal(zoomGain(NaN), 1);
  const centre = spatialMix(500, 300, 1000, 600, 22), far = spatialMix(500, 300, 1000, 600, 88), off = spatialMix(3000, 300, 1000, 600, 22);
  assert.equal(centre.gain, 1); assert.ok(far.gain < centre.gain); assert.ok(off.gain < 0.5 && off.pan > 0.7);
  assert.equal(shouldCull("weapon", off.gain), true); assert.equal(shouldCull("explosion", off.gain), false); assert.equal(shouldCull("weapon", centre.gain), false);
  assert.equal(shouldCull("weapon", off.gain, true), false, "a distant cannon is still heard");
  assert.equal(closeness(1), 1); assert.equal(closeness(0.35), 0);
});

test("every armed unit has a weapon voice; classes sound different; heavy rounds land with a blast", () => {
  const voices = new Set();
  for (const [type, d] of Object.entries(balance.definitions)) {
    if (!(d.damage > 0) || (d.kind !== "unit" && type !== "tower")) continue;
    const s = soundFor({ type: "shot", weapon: d.shot || type }, type);
    assert.ok(hasSound(s.name), `${type} -> ${s.name}`);
    assert.equal(s.group, "weapon");
    voices.add(s.name);
  }
  for (const v of ["rifle", "smg", "rocket", "tank", "artillery", "tower", "flame", "scrap", "silenced", "rail", "drone", "walker"]) assert.ok(voices.has(`shot:${v}`), v);
  assert.equal(weaponVoice("ranger", "drone"), "drone"); assert.equal(weaponVoice("ranger", "rider"), "rifle"); assert.equal(weaponVoice("tank", null), "tank"); assert.equal(weaponVoice("nope", null), "smg");
  // The blast lands when the round does (visual-style.json `life` is the flight time).
  for (const [voice, weapon] of [["tank", "tank"], ["artillery", "breaker"], ["rocket", "antitank"], ["tower", "tower"]]) {
    const hit = hitFor(voice);
    assert.ok(hit && hasSound(hit.name), voice);
    assert.ok(Math.abs(hit.delay - style.weapons[weapon].life) < 1e-9, `${voice} lands after ${style.weapons[weapon].life}s`);
  }
  assert.equal(hitFor("rifle"), null);
  assert.equal(soundFor({ type: "death", building: true, core: true }).name, "boom:core");
  for (const e of [{ type: "death" }, { type: "death", heavy: true }, { type: "death", building: true }, { type: "strike" }, { type: "impact" }, { type: "impact", shield: true }, { type: "impact", building: true }]) assert.ok(hasSound(soundFor(e).name));
});

test("rendered effects: finite, at their level, no DC, short, deterministic, variants differ", () => {
  for (const [name, spec] of Object.entries(BANK)) {
    const x = renderSound(spec, { seed: 2 });
    let sum = 0;
    for (const v of x) { assert.ok(Number.isFinite(v), name); sum += v; }
    assert.ok(peak(x) <= spec.level + 1e-6 && peak(x) > spec.level * 0.98, `${name} peak ${peak(x)}`);
    assert.ok(Math.abs(sum / x.length) < 0.01, `${name} DC`);
    assert.ok(x.length / SYNTH_RATE <= 4.2, `${name} length`);
    assert.ok(Math.abs(x[x.length - 1]) < 1e-3, `${name} ends quietly`);
  }
  assert.deepEqual(renderSound(BANK["shot:rifle"], { seed: 2 }), renderSound(BANK["shot:rifle"], { seed: 2 }));
  assert.notDeepEqual(renderSound(BANK["shot:rifle"], { seed: 2 }), renderSound(BANK["shot:rifle"], { seed: 9 }));
  assert.equal(variantsFor("shot:rifle"), 2); assert.equal(variantsFor("boom:core"), 1);
});

test("explosions grow with size: rifle impact < tank shell < artillery < Barrage < building < core", () => {
  const order = ["impact:body", "hit:shell", "hit:artillery", "boom:strike", "boom:building", "boom:core"];
  const e = order.map((n) => energy(renderSound(BANK[n], { seed: 2 })));
  for (let i = 1; i < e.length; i++) assert.ok(e[i] > e[i - 1], `${order[i]} (${e[i].toFixed(4)}) > ${order[i - 1]} (${e[i - 1].toFixed(4)})`);
  const len = (n) => renderSound(BANK[n], { seed: 2 }).length;
  assert.ok(len("boom:core") > len("hit:shell") && len("hit:shell") > len("impact:body"), "bigger lasts longer");
});

test("radio replies render for every faction and kind; engine loops are seamless", () => {
  for (const f of Object.keys(RADIO_VOICE)) for (const k of RADIO_KINDS) {
    const x = renderSound(radioSpec(k, f), { seed: 1 });
    assert.ok(x.length / SYNTH_RATE < 0.8 && peak(x) <= 0.41 && peak(x) > 0.3, `${f} ${k}`);
  }
  assert.notDeepEqual(renderSound(radioSpec("move", "meridian")), renderSound(radioSpec("move", "veil")), "factions differ");
  for (const [f, spec] of Object.entries(ENGINE)) {
    const x = renderEngine(spec);
    assert.equal(x.length, SYNTH_RATE);
    assert.ok(peak(x) <= 0.9 + 1e-6, f);
    // The seam is no bigger a step than the loop's own largest sample-to-sample step.
    let step = 0; for (let i = 1; i < x.length; i++) step = Math.max(step, Math.abs(x[i] - x[i - 1]));
    assert.ok(Math.abs(x[0] - x[x.length - 1]) <= step + 1e-6, `${f} loops without a click`);
  }
});

test("engine hum: selected vehicles idle low, moving ones full and revved, capped", () => {
  assert.deepEqual(engineMix([]), { level: 0, rate: MIX.engine.rate[0] });
  const one = engineMix([{ selected: true, moving: true, gain: 1 }]);
  assert.equal(one.level, 1); assert.equal(one.rate, MIX.engine.rate[1]);
  const idle = engineMix([{ selected: true, moving: false, gain: 1 }]);
  assert.equal(idle.level, MIX.engine.idle); assert.equal(idle.rate, MIX.engine.rate[0]);
  assert.equal(engineMix([{ selected: false, moving: false, gain: 1 }]).level, 0, "parked, unselected vehicles are silent");
  assert.equal(engineMix(Array.from({ length: 40 }, () => ({ selected: true, moving: true, gain: 1 }))).level, 1, "a column of tanks is still one quiet hum");
  assert.ok(engineMix([{ selected: true, moving: true, gain: 0.2 }]).level < 0.25, "off to the side is quieter");
});

test("the combat layer shares the field tempo and adds weight", () => {
  for (const map of Object.keys(MAP_FLAVOUR)) assert.equal(tempoFor("calm", map), tempoFor("battle", map));
  assert.notEqual(tempoFor("victory", "classic"), undefined);
  const bar = composeBar({ map: "classic", mood: "battle", bar: 3 });
  for (const v of ["kick", "snare", "cbass", "ost", "tom"]) assert.ok(bar.some((n) => n.voice === v), v);
  assert.ok(composeBar({ map: "classic", mood: "battle", bar: 0 }).some((n) => n.voice === "taiko" || n.voice === "stab"));
});
