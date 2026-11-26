// R3-U (AAA round 3): audio juice. Weapon classes that match the R3-X looks, layered impacts by size,
// falling whistles that end on the landing, unit voice barks (rate-limited, muted in quiet mode),
// stingers (boss stage, boss surge, victory), the low-HP heartbeat and thunder, and a 60 s scripted
// battle played through the real AudioDirector on a fake AudioContext (no Web Audio in Node).
import test from "node:test";
import assert from "node:assert/strict";
import { Simulation } from "../src/simulation.js";
import balance from "../src/balance.json" with { type: "json" };
import style from "../src/visual-style.json" with { type: "json" };
import { BARK, BOMB_WHISTLE, BarkGate, LOB_WHISTLE, LowHpWatch, STINGERS, ThunderWatch, WEAPON_CLASSES, barkKind, barkType, barkVoice, coreHealth, flightTime, impactLayer, landingFor, soundFor, stingerFor, weaponClass } from "../src/audio-logic.js";
import { BANK } from "../src/sfx-bank.js";
import { BARK_KINDS, barkRecipe, hasSound } from "../src/sfx.js";
import { SYNTH_RATE, renderSound } from "../src/audio-synth.js";
import { defaults, normalize } from "../src/settings.js";
import { AudioDirector } from "../src/audio.js";
import { WEATHER } from "../src/mission-looks.js";

const D = balance.definitions;
const shot = (unit, extra = {}) => ({ type: "shot", weapon: D[unit]?.shot || unit, unit, x: 0, z: 0, tx: 5, tz: 0, team: 0, ...extra });

test("weapon classes: every armed unit has one, each class fires its own sound", () => {
  for (const [type, d] of Object.entries(D)) {
    if (!(d.damage > 0) || (d.kind !== "unit" && type !== "tower")) continue;
    const cls = weaponClass(shot(type), type);
    assert.ok(WEAPON_CLASSES.includes(cls), `${type} -> ${cls}`);
    assert.ok(hasSound(soundFor(shot(type), type).name), `${type} sound`);
  }
  const sample = {
    melee: ["vanguard", {}], tracer: ["ranger", {}], shell: ["tank", {}], lob: ["breaker", {}], flak: ["tower", { tAir: 3.6 }], beam: ["watcher", {}],
    flamer: ["scorcher", {}], missile: ["antitank", {}], bomb: ["glider", {}], strafe: ["hawk", {}],
  };
  const names = new Set();
  for (const [cls, [unit, extra]] of Object.entries(sample)) {
    assert.equal(weaponClass(shot(unit, extra), unit), cls, unit);
    const s = soundFor(shot(unit, extra), unit);
    assert.ok(hasSound(s.name) && s.group === "weapon", `${cls} ${s.name}`);
    names.add(s.name);
  }
  const heal = { type: "support", weapon: "medic", x: 0, z: 0, tx: 2, tz: 0, team: 0 };
  assert.equal(weaponClass(heal), "heal"); assert.equal(soundFor(heal).name, "shot:heal");
  names.add(soundFor(heal).name);
  assert.equal(names.size, WEAPON_CLASSES.length, `distinct firing sounds: ${[...names].join(", ")}`);
  // A ground-to-air missile and the balloon's fire bomb get their own voices; a hawk at a flyer keeps its pods.
  assert.equal(soundFor(shot("antitank", { tAir: 3.6 }), "antitank").name, "shot:sam");
  assert.equal(soundFor(shot("hawk", { tAir: 3.6, sAir: 3.6 }), "hawk").name, "shot:pod");
  assert.equal(soundFor({ type: "bossSurge", x: 0, z: 0, team: 1 }).name, "sting:surge");
});

test("impacts layer by size; whistles end as the round lands; stingers exist and render", () => {
  assert.equal(soundFor(shot("vanguard")).name, "shot:blade");
  assert.equal(soundFor({ type: "shot" }).name, "shot:smg");
  assert.ok(BANK["impact:blade"]);
  assert.deepEqual(impactLayer(shot("vanguard")), { name: "impact:blade", size: "small", delay: style.weapons.vanguard.life });
  assert.equal(impactLayer(shot("ranger"), "ranger").name, "impact:small");
  assert.equal(impactLayer(shot("antitank"), "antitank").name, "impact:medium");
  assert.equal(impactLayer(shot("tank"), "tank").name, "impact:heavy");
  assert.equal(impactLayer(shot("ranger", { tAir: 3 }), "ranger"), null, "a flyer hit has no ground impact");
  assert.equal(impactLayer(shot("tank"), "tank").delay, style.weapons.tank.life, "lands with the shell");
  const lob = landingFor(shot("breaker"), "breaker"), bomb = landingFor(shot("glider"), "glider"), fire = landingFor(shot("balloon"), "balloon");
  assert.ok(Math.abs(lob.incoming.delay + LOB_WHISTLE - flightTime(shot("breaker"), "breaker")) < 1e-9);
  assert.ok(Math.abs(bomb.incoming.delay + BOMB_WHISTLE - bomb.hit.delay) < 1e-9 && bomb.hit.name === "hit:bomb");
  assert.equal(fire.hit.name, "hit:firebomb");
  assert.equal(landingFor(shot("tower", { tAir: 3 }), "tower").hit.name, "hit:flak");
  // The whistles are as long as the code says (they end on the landing).
  for (const [name, len] of [["incoming:lob", LOB_WHISTLE], ["incoming:bomb", BOMB_WHISTLE]]) assert.ok(Math.abs(Math.max(...BANK[name].layers.map((l) => (l.at || 0) + l.dur)) - len) < 1e-9, name);
  for (const n of [...STINGERS, "impact:small", "impact:medium", "impact:heavy", "warn:lowhp", "thunder"]) assert.ok(BANK[n], n);
  assert.equal(stingerFor({ type: "bossStage" }), "sting:boss"); assert.equal(stingerFor({ type: "shot" }), null);
  // Bigger impacts carry more energy.
  const energy = (n) => renderSound(BANK[n], { seed: 2 }).reduce((s, v) => s + v * v, 0) / SYNTH_RATE;
  assert.ok(energy("impact:small") < energy("impact:medium") && energy("impact:medium") < energy("impact:heavy"));
});

test("barks: per-type voice, at most two a second, silent in quiet mode; settings keep quiet mode", () => {
  const gate = new BarkGate();
  let n = 0;
  for (let t = 0; t < 3; t += 0.05) if (gate.allow(t)) n++;
  assert.ok(n <= 3 * BARK.max && n >= 3, `${n} barks in 3 s`);
  const q = new BarkGate();
  for (let t = 0; t < 3; t += 0.05) assert.equal(q.allow(t, true), false);
  const a = barkVoice("ranger", "ranged"), b = barkVoice("rider", "ranged"), c = barkVoice("tank", "armor");
  assert.ok(a.hz !== b.hz && c.hz < a.hz, "types differ; armour is lower");
  for (const k of BARK_KINDS) assert.ok(barkRecipe(a, k).length >= 4, k);
  assert.equal(barkType([{ kind: "unit", type: "ranger" }, { kind: "unit", type: "tank" }, { kind: "unit", type: "tank" }, { kind: "building", type: "hq" }]).type, "tank");
  assert.equal(barkType([{ kind: "building", type: "hq" }]), null);
  assert.equal(barkKind("attack"), "attack"); assert.equal(barkKind("move"), "order"); assert.equal(barkKind("stop"), null);
  assert.equal(defaults().quietMode, false);
  assert.equal(normalize({ ...defaults(), quietMode: true }).quietMode, true);
  assert.equal(normalize({ version: 1 }).quietMode, false, "old saves get the default");
});

test("low-HP heartbeat only while the core is low and being hit; thunder once per strike", () => {
  const w = new LowHpWatch();
  assert.equal(w.update(0, 0.9), false); assert.equal(w.update(1, 0.3), true, "dropped below 35 %");
  assert.equal(w.update(1.5, 0.29), false, "not before the next beat");
  assert.equal(w.update(3.5, 0.28), true);
  assert.equal(w.update(20, 0.28), false, "no damage for a while: quiet");
  assert.equal(w.update(21, 0.1), true); assert.equal(w.update(22.5, 0.09), true, "critical beats faster");
  assert.equal(w.update(30, null), false, "no core");
  const sim = { entities: [{ team: 0, type: "hq", hp: 50, maxHp: 200 }, { team: 0, type: "hq", hp: 150, maxHp: 200 }, { team: 1, type: "hq", hp: 1, maxHp: 200 }] };
  assert.equal(coreHealth(sim), 0.25); assert.equal(coreHealth({ entities: [] }), null);
  const t = new ThunderWatch();
  assert.equal(t.update(0, 1), false); assert.equal(t.update(0.9, 1), true); assert.equal(t.update(1, 1), false); assert.equal(t.update(0.1, 1), false);
  assert.equal(t.update(0.9, 0), false, "no storm, no thunder");
});

// ---------------------------------------------------------------- the 60 s scripted battle
// A fake AudioContext: every node is a recording no-op; buffers are real arrays. `time` is advanced by the test.
function fakeNode() {
  const target = function () {};
  return new Proxy(target, {
    get(t, k) { if (k === "then") return undefined; if (k in t) return t[k]; return (t[k] = k === "value" ? 0 : fakeNode()); },
    set(t, k, v) { t[k] = v; return true; },
    apply() { return fakeNode(); },
  });
}
function fakeContext() {
  const ctx = { currentTime: 0, sampleRate: 24000, state: "running", destination: fakeNode() };
  ctx.createBuffer = (channels, length, rate) => { const data = Array.from({ length: channels }, () => new Float32Array(length)); return { duration: length / rate, length, getChannelData: (i) => data[i] }; };
  for (const k of ["createGain", "createOscillator", "createBufferSource", "createBiquadFilter", "createStereoPanner", "createDynamicsCompressor", "createConvolver", "createWaveShaper", "createDelay"]) ctx[k] = () => fakeNode();
  return ctx;
}
function battle({ quiet = false } = {}) {
  const idle = globalThis.requestIdleCallback;
  globalThis.requestIdleCallback = () => 0; // the bank warm-up would otherwise keep rendering after the test
  const ctx = fakeContext(), selected = new Set();
  let director;
  try { director = new AudioDirector(ctx, { selected: () => selected }); } finally { globalThis.requestIdleCallback = idle; }
  const settings = { ...defaults(), music: "off", quietMode: quiet };
  director.applySettings(settings);
  const ids = new Map(), barks = [];
  const heard = director.sfx.onPlay;
  director.sfx.onPlay = (name, gain, delay) => { ids.set(name, (ids.get(name) || 0) + 1); if (name.startsWith("bark:")) barks.push(ctx.currentTime); heard(name, gain, delay); };

  const sim = new Simulation({ ai: false });
  sim.players[0].flak = true;
  const hq = sim.own(0).find((e) => e.type === "hq"), bx = hq.x + 8, bz = hq.z;
  const mine = [["ranger", 0, 0], ["tank", 0, 2], ["breaker", -2, 0], ["antitank", 0, -2], ["medic", -2, 2], ["hawk", -1, -1], ["scorcher", 1, 1]].map(([t, dx, dz]) => sim.spawn(t, 0, bx + dx, bz + dz));
  sim.spawn("tower", 0, bx + 2, bz + 4);
  for (const [t, dx, dz] of [["vanguard", 7, 0], ["tank", 8, 2], ["glider", 6, -2], ["balloon", 7, 3], ["ranger", 9, -1], ["hawk", 4, 4]]) sim.spawn(t, 1, bx + dx, bz + dz);
  for (const e of mine) selected.add(e.id);
  const dt = 0.05;
  let raided = false;
  try {
    for (let i = 0; i < 1200; i++) {
      const t = i * dt;
      ctx.currentTime = t;
      sim.tick(dt);
      // The player clicks about: select spam for 3 s, then an order every 2 s (barks are rate-limited).
      if (t < 3) director.bark("select", mine);
      else if (i % 40 === 0) director.order(i % 80 ? "move" : "attack", sim);
      // A raid on the core from 30 s (the low-HP heartbeat), a lightning strike at 20 s and a boss turning at 40 s.
      if (t >= 30) { hq.hp = Math.max(1, Math.min(hq.hp, hq.maxHp * 0.3) - 4); raided = true; }
      WEATHER.storm = t >= 19 && t < 22 ? 1 : 0; WEATHER.flash = t >= 20 && t < 20.2 ? 1 : 0;
      if (i === 800) sim.events.push({ type: "bossStage", id: hq.id, boss: "x", x: hq.x, z: hq.z, team: 1, stage: 1 }, { type: "bossSurge", id: hq.id, boss: "x", x: hq.x, z: hq.z, team: 1, stage: 1, seconds: 3 });
      for (const event of sim.events.splice(0)) director.event(event, sim);
      director.update(dt, { sim, settings, started: true, paused: false, hidden: false, mapId: "classic" });
    }
  } finally { Object.assign(WEATHER, { name: null, storm: 0, flash: 0 }); }
  return { ids, barks, raided, director };
}

test("60 s scripted battle: at least 12 distinct sound ids; barks at most 2 a second and silent in quiet mode", () => {
  const loud = battle();
  const sfx = [...loud.ids.keys()].filter((n) => !n.startsWith("bark:"));
  assert.ok(sfx.length >= 12, `distinct sound ids: ${sfx.length} (${sfx.sort().join(", ")})`);
  for (const n of ["impact:small", "impact:heavy", "shot:flak", "shot:bomb", "sting:boss", "sting:surge", "warn:lowhp", "thunder"]) assert.ok(loud.ids.has(n), n);
  assert.ok(loud.barks.length > 0, "barks play");
  for (const t of loud.barks) assert.ok(loud.barks.filter((u) => u >= t && u < t + 1).length <= BARK.max, `barks in [${t}, ${t + 1})`);
  const quiet = battle({ quiet: true });
  assert.equal(quiet.barks.length, 0, "quiet mode: no barks");
  assert.equal(quiet.director.barks, 0);
  assert.ok([...quiet.ids.keys()].length >= 12, "quiet mode keeps every other sound");
});
