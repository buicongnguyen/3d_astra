// V4 signature shots (src/fx-kinds/signature.js): every unit of the five factions fires its faction's look, drawn from the
// existing effect pools; creatures, bosses, the Iron units, bombers, flamers and medics keep their own. View only: flight times
// are the weapons' visual-style `life`, and nothing here reads what fog hides or writes to the simulation.
import test from "node:test";
import assert from "node:assert/strict";
import balance from "../src/balance.json" with { type: "json" };
import STYLE from "../src/visual-style.json" with { type: "json" };
import { BASE_UNIT_SLOTS } from "../src/factions.js";
import { weaponStyle } from "../src/visual-style.js";
import { SHEETS, LAYOUT, SHEET_NAMES } from "../src/fx-sprites-data.js";
import { CELL, CELLS, CLASSIC_CELLS, ATLAS_COLUMNS, ATLAS_ROWS } from "../src/fx-kinds/cells.js";
import { SIGNATURE_CELLS } from "../src/fx-kinds/signature-cells.js";

const ctx = { createImageData: (w, h) => ({ data: new Uint8ClampedArray(w * h * 4) }), putImageData() {} };
globalThis.document ??= { createElement: () => ({ getContext: () => ctx, width: 0, height: 0 }) };
const { Effects } = await import("../src/fx.js");
const { SIGNATURE, signatureOf, signatureLook, shotFaction, signatureShot, signaturePartial, signatureSupport } = await import("../src/fx-kinds/signature.js");
const { KINDS } = await import("../src/fx-kinds/signature-kinds.js");
const { IMPACTS } = await import("../src/fx-kinds/signature-impacts.js");
const { PALETTES, FILL } = await import("../src/fx-kinds/signature-common.js");

const D = balance.definitions, FACTIONS = Object.keys(balance.factions);
const seeded = (s) => () => ((s = (s * 16807) % 2147483647) / 2147483647);
// Every armed type a faction fields: its slots (swapped), its flyer, its workshop units, and the Sentinel tower.
function fielded(faction) {
  const f = balance.factions[faction], types = BASE_UNIT_SLOTS.filter((s) => !f.exclude?.includes(s)).map((s) => f.swap[s] || s);
  types.push(...Object.values(f.extra || {}).flat(), "tower");
  for (const [type, d] of Object.entries(D)) if (d.workshop === faction) types.push(type);
  return [...new Set(types)].filter((t) => D[t]?.damage > 0);
}
// Kept on purpose: the flamer, the bombers (their drops), creatures, bosses and the Iron units.
// The Vanguard is a sword fighter (src/vanguard-sword.js): its slash is its own look.
const OWN_LOOK = new Set(["scorcher", "balloon", "glider", "vanguard"]);
const NEVER = ["wyrm", "wyrmling", "acidhound", "vaultsentinel", "ironvanguard", "ironsovereign", "ironsovereign2", "emberdrake", "carrier", "kite"];

function stage({ motion = true, lowPower = false, factions = { 0: "meridian", 1: "ashfall" }, mission = null, units = [] } = {}) {
  const view = { lowPower, scene: { add() {} }, terrain: { id: "riverlands" }, activity: { combat: { motion } }, motionLevel: 2, unitsPerPixel: 0.05, colors: [0x92ebc5, 0xef7660], mission };
  const fx = new Effects(view);
  fx.rng = seeded(7);
  const entities = [...units];
  const sim = { entities, time: 0, factions, factionId: (t) => factions[t] || "meridian", isVisible: (e) => e.visible !== false, get: (id) => entities.find((e) => e.id === id) || null,
    hostile: (a, b) => a !== b };
  fx.frameSim = sim;
  return { fx, sim, view };
}
const shot = (unit, extra = {}) => ({ type: "shot", unit, weapon: D[unit]?.shot || unit, source: 1, target: 2, x: 0, z: 0, tx: 10, tz: 2, team: 0, ...extra });
const aimFor = (fx, ev, sim) => {
  const { style, nx, nz, from, to, land } = fx.aim(ev, sim), dx = to.x - from.x, dy = to.y - from.y, dz = to.z - from.z, len = Math.hypot(dx, dy, dz);
  const ux = dx / len, uy = dy / len, uz = dz / len, h = Math.hypot(ux, uz);
  return { from, to, land, ux, uy, uz, len, sx: -uz / h, sz: ux / h, nx, nz, travel: style.life, anchor: { ...ev, shot: true, targetWidth: 2.6, direct: false }, power: 1, style };
};
const records = (fx) => [...fx.glow.items, ...fx.smoke.items, ...fx.decals.items];

test("every look the factions name exists, with a kind, an impact, a palette and readable sizes", () => {
  for (const [faction, table] of Object.entries(SIGNATURE.factions)) {
    assert.ok(PALETTES[faction]?.main && PALETTES[faction]?.core && PALETTES[faction]?.deep && PALETTES[faction]?.spark, faction);
    for (const [key, id] of Object.entries(table)) {
      const look = SIGNATURE.looks[id];
      assert.ok(look, `${faction}.${key} -> ${id}`);
      assert.equal(typeof KINDS[look.kind], "function", id);
      if (look.impact) assert.equal(typeof IMPACTS[look.impact], "function", `${id} impact ${look.impact}`);
      for (const k of ["length", "width", "head", "body", "halo", "tail", "size", "muzzle"]) if (look[k]) {
        assert.equal(look[k].length, 2, `${id}.${k} is [metres, px]`);
        assert.ok(look[k][0] > 0 && look[k][1] >= 2, `${id}.${k} has a CSS-pixel floor`);
      }
      if (look.sheet) assert.ok(SIGNATURE.sheets[look.sheet], `${id} sheet ${look.sheet}`);
    }
  }
  for (const [unit, family] of Object.entries(SIGNATURE.families)) assert.ok(D[unit], unit), assert.ok(typeof family === "string");
});

test("every armed unit a faction fields fires that faction's look; the flamer and bombers keep theirs", () => {
  for (const faction of FACTIONS) {
    const types = fielded(faction);
    assert.ok(types.length >= 7, `${faction}: ${types}`);
    for (const type of types) {
      const sig = signatureOf(faction, type);
      if (OWN_LOOK.has(type)) assert.equal(sig, null, `${faction} ${type} keeps its own look`);
      else assert.ok(sig, `${faction} ${type} has a signature look`);
    }
  }
  // Each faction's looks are its own: no two factions share a look for the same slot.
  for (const slot of ["ranger", "tank", "tower", "breaker", "antitank", "worker"]) {
    const ids = FACTIONS.map((f) => signatureOf(f, slot)?.id);
    assert.equal(new Set(ids).size, FACTIONS.length, `${slot}: ${ids}`);
  }
  // The faction-unique units the brief names.
  assert.equal(signatureOf("wardens", "walker").look.style, "electric");
  assert.equal(signatureOf("wardens", "tower").look.kind, "arc");
  assert.equal(signatureOf("wardens", "halo").look.kind, "hoops");
  assert.equal(signatureOf("veil", "ranger").look.kind, "crescent");
  assert.equal(signatureOf("veil", "tank").look.style, "void");
  assert.equal(signatureOf("veil", "moth").look.kind, "wisps");
  assert.equal(signatureOf("sunward", "tank").look.style, "disc");
  assert.equal(signatureOf("ashfall", "tank").look.style, "slug");
  assert.equal(signatureOf("meridian", "tank").look.style, "plasma");
  assert.equal(signatureOf("meridian", "hawk", true), null, "the Hawk's missiles at flyers keep the pods");
});

test("creatures, bosses, the Iron units, the Ember Drake and the wild team keep their own looks", () => {
  const { fx, sim } = stage();
  for (const faction of FACTIONS) for (const type of NEVER) assert.equal(signatureOf(faction, type), null, `${faction} ${type}`);
  assert.equal(signatureLook(fx, shot("tank", { boss: 9 }), sim), null, "a boss's gun");
  assert.equal(signatureLook(fx, shot("wyrm", { team: -2 }), sim), null, "the wild team");
  assert.equal(shotFaction(fx, sim, -2), null);
});

test("the look follows the shooter's faction: a story side's faction, else the simulation's; never the team paint", () => {
  const { fx, sim } = stage({ factions: { 0: "meridian", 1: "meridian" }, mission: { factions: { 1: "ashfall" } } });
  assert.equal(shotFaction(fx, sim, 1), "ashfall", "a story mission's side (paint and emblem) wins over the shared roster");
  assert.equal(shotFaction(fx, sim, 0), "meridian");
  const skirmish = stage({ factions: { 0: "wardens", 1: "wardens" } });
  const a = signatureLook(skirmish.fx, shot("ranger", { team: 0 }), skirmish.sim), b = signatureLook(skirmish.fx, shot("ranger", { team: 1 }), skirmish.sim);
  assert.equal(a.id, b.id);
  assert.equal(a.pal, b.pal, "mint and red teams of one faction fire the same colours");
  // A crewed Defence tower speaks for its crew's weapon.
  assert.equal(signatureLook(fx, shot("tower", { weapon: "ranger" }), sim).id, "m-photon");
  assert.equal(signatureLook(fx, shot("tower", { weapon: "tower" }), sim).id, "m-orb");
  assert.equal(signatureLook(fx, shot("tower", { weapon: "scorcher" }), sim), null, "a flame trap keeps its look");
});

test("Veil's shared-weapon tint is violet now (it was green)", () => {
  const [r, g, b] = STYLE.tints.veil;
  assert.ok(b > g && r > g, `${STYLE.tints.veil}`);
  assert.deepEqual(weaponStyle({ unit: "ranger", weapon: "ranger" }, "veil").color, STYLE.tints.veil);
});

test("the new cells keep every older cell's index and fit the atlas grid", () => {
  assert.deepEqual(CELLS.slice(0, CLASSIC_CELLS), ["glow", "puff", "ring", "streak", "scorch", "flare", "cross", "wrench", "band"]);
  assert.equal(CELLS.length, CLASSIC_CELLS + SIGNATURE_CELLS.length);
  assert.ok(ATLAS_COLUMNS * ATLAS_ROWS >= CELLS.length && ATLAS_COLUMNS * 128 <= 2048);
  for (const c of SIGNATURE_CELLS) assert.ok(FILL[c.name] > 0 && FILL[c.name] <= 1, c.name);
  for (const name of ["orb", "bolt", "crackle", "crescent", "sundisc", "shard", "starburst", "dart"]) assert.ok(Number.isInteger(CELL[name]) && CELL[name] >= CLASSIC_CELLS, name);
});

// Fires every look of every faction once, steps the effects two seconds and checks the pools.
function fireAll({ motion = true, lowPower = false } = {}) {
  const { fx, sim } = stage({ motion, lowPower });
  for (const faction of FACTIONS) {
    sim.factions[0] = faction;
    for (const type of fielded(faction)) {
      const ev = shot(type), sig = signatureLook(fx, ev, sim);
      if (sig) signatureShot(fx, ev, sig, aimFor(fx, ev, sim));
    }
    signatureSupport(fx, { type: "support", weapon: "wagon", x: 0, z: 0, tx: 4, tz: 0, team: 0 }, sim, { from: { x: 0, y: 1.3, z: 0 }, to: { x: 4, y: 1, z: 0 }, land: { x: 4, y: 1, z: 0 }, anchor: { targetWidth: 2 } });
  }
  return { fx, sim };
}

test("all signature shots draw from the existing pools: no new mesh, so no new draw", () => {
  const { fx, sim } = fireAll();
  assert.equal(fx.root.children.length, 6, "decals, smoke, glow, debris, rocket bodies, ordnance (and nothing new)");
  assert.ok(fx.glow.items.length > 100 && fx.smoke.items.length > 50);
  for (let i = 0; i < 40; i++) fx.update(sim, 0.05);
  assert.equal(fx.sig.rounds.length, 0, "every stepped round landed");
  assert.equal(fx.root.children.length, 6);
  assert.ok(!records(fx).some((p) => p.owner && p.keep && p.life > 3), "no part is left owned after its round landed");
});

test("a round lands on the frame its flight time ends, as the target's hit flash does", () => {
  for (const [faction, unit] of [["meridian", "tank"], ["ashfall", "tank"], ["sunward", "tank"], ["wardens", "walker"], ["veil", "tank"], ["meridian", "breaker"], ["wardens", "antitank"]]) {
    const target = { id: 2, hp: 100, x: 10, z: 2, radius: 1.3, kind: "unit" };
    const { fx, sim } = stage({ factions: { 0: faction, 1: "meridian" }, units: [target] });
    const ev = shot(unit), sig = signatureLook(fx, ev, sim), a = aimFor(fx, ev, sim);
    signatureShot(fx, ev, sig, a);
    let t = 0, landed = -1;
    const dt = 1 / 60;
    for (let i = 0; i < 60 && landed < 0; i++) { t += dt; fx.update(sim, dt); if (!fx.sig.rounds.length) landed = t; }
    assert.ok(landed >= a.travel - 1e-9 && landed < a.travel + dt + 1e-9, `${faction} ${unit}: landed at ${landed}, flight ${a.travel}`);
  }
});

test("the same seed draws the same particles", () => {
  const snap = () => { const { fx } = fireAll(); return JSON.stringify(records(fx).map((p) => [p.cell, p.s0, p.life, p.x, p.y, p.z, p.vx])); };
  assert.equal(snap(), snap());
});

test("a round in flight is a projectile the particle cap lets finish; its glow and landing stay trimmable", () => {
  const target = { id: 2, hp: 100, x: 10, z: 2, radius: 1.3, kind: "unit" };
  const { fx, sim } = stage({ units: [target] });
  for (const [faction, unit] of [["meridian", "ranger"], ["meridian", "tank"], ["veil", "ranger"], ["wardens", "drone"]]) {
    sim.factions[0] = faction;
    const ev = shot(unit);
    signatureShot(fx, ev, signatureLook(fx, ev, sim), aimFor(fx, ev, sim));
  }
  fx.update(sim, 0); // a still frame: the stepped rounds take their parts, nothing is trimmed
  const kept = records(fx).filter((p) => p.keep), all = records(fx);
  assert.ok(kept.length >= 6 && kept.length < all.length / 2, `${kept.length} kept of ${all.length}`);
  // One unit on screen: the cap is its floor (12), and every kept record survives the trim.
  fx.nextCount = -1; fx.trimParticles({ entities: [target], isVisible: () => true }, null);
  assert.ok(kept.every((p) => records(fx).includes(p)), "the projectiles survive");
  assert.ok(records(fx).length < all.length, "the detail is trimmed");
});

test("reduced motion or combat motion off: a still line and a calm landing, no flashes, sparks or arcs", () => {
  const { fx } = fireAll({ motion: false });
  // The shared heavy landing (src/fx.js hit) keeps its soft warm flare when calm; nothing bright and white.
  assert.ok(!fx.glow.items.some((p) => p.cell === CELL.flare && p.c0[3] > 0.5), "no white-hot stars");
  assert.ok(!fx.glow.items.some((p) => p.cell === CELL.streak && p.gravity > 0), "no sparks");
  assert.ok(!fx.glow.items.some((p) => p.cell === CELL.bolt), "no arcs");
  assert.ok(!fx.sig?.rounds.length, "nothing flies");
});

test("fog: an unseen shooter shows no muzzle; a seen target still takes the landing on time", () => {
  const { fx, sim } = stage({ factions: { 0: "wardens" } });
  const ev = shot("walker"), sig = signatureLook(fx, ev, sim), a = aimFor(fx, ev, sim), before = fx.timeline.length;
  signaturePartial(fx, ev, sim, sig, a, false, true);
  assert.ok(!records(fx).some((p) => Math.hypot(p.x - a.from.x, p.z - a.from.z) < 0.5), "nothing at the hidden muzzle");
  assert.equal(fx.timeline.length, before + 1, "the landing waits for the flight time");
  assert.ok(Math.abs(fx.timeline.at(-1).at - (fx.time + a.travel)) < 1e-9);
});

test("chain arcs jump only to nearby enemy units the player can see, and never deal damage", () => {
  const near = { id: 3, kind: "unit", hp: 50, x: 11, z: 3, team: 1 }, hidden = { id: 4, kind: "unit", hp: 50, x: 9, z: 1, team: 1, visible: false };
  const own = { id: 5, kind: "unit", hp: 50, x: 10.5, z: 1, team: 0 }, far = { id: 6, kind: "unit", hp: 50, x: 30, z: 2, team: 1 };
  const units = [{ id: 2, kind: "unit", hp: 80, x: 10, z: 2, team: 1 }, near, hidden, own, far];
  const { fx, sim } = stage({ factions: { 0: "wardens" }, units });
  const hp = units.map((u) => u.hp);
  IMPACTS.discharge(fx, { x: 10, y: 1, z: 2 }, { pal: PALETTES.wardens, s: 1, anchor: { x: 10, z: 2 }, team: 0, target: 2, chain: 2, aloft: false, direct: true, calm: false });
  const arcs = fx.glow.items.filter((p) => p.cell === CELL.bolt && p.anchor?.tx !== undefined);
  assert.ok(arcs.length > 0, "an arc to the visible enemy");
  assert.ok(arcs.every((p) => p.anchor.tx === near.x && p.anchor.tz === near.z && p.anchor.shot), "only to the seen enemy, the whole segment fog-checked");
  assert.deepEqual(units.map((u) => u.hp), hp, "drawing only");
});

test("the Codex sheets: when packed, each flight loop and impact is a sheet of its own, normal alpha, at README speed", () => {
  for (const [name, def] of Object.entries(SIGNATURE.sheets)) {
    if (!LAYOUT.items[name]) continue; // absent: the procedural cells draw it
    assert.ok(SHEET_NAMES.includes(name) && SHEETS[name].blend === "normal", name);
    assert.equal(SHEETS[name].fps, def.fps, name);
    if (name === "lightning" || name === "muzzleEnergy") { assert.equal(SHEETS[name].frames, 16); continue; }
    assert.ok(SHEETS[name].loop && SHEETS[name].frames === 8, `${name} flight loop`);
    assert.ok(!SHEETS[name + "Hit"].loop && SHEETS[name + "Hit"].frames === 8, `${name} impact`);
    assert.ok(def.head[0] >= 0.45 && def.head[0] <= 0.8 && def.cell[0] > 0 && def.cell[1] >= def.cell[2] && def.cell[2] <= 40, name);
  }
  assert.ok(LAYOUT.width <= 2048 && LAYOUT.width / 2 <= 1024, "the phone atlas stays 1024 wide at most");
  assert.ok(LAYOUT.width * LAYOUT.height * 4 < 20e6, "and the desktop atlas under 20 MB of texture memory");
});

test("with the sheets loaded, an orb flies as one painted sprite with its head on the round", () => {
  const { fx, sim } = stage({ factions: { 0: "sunward" } });
  if (!LAYOUT.items.sunDisc) return;
  const taken = [];
  fx.sprites = { ready: true, failed: false, take(name, x, y, z, size) { const p = { name, x, y, z, size, s0: size, s1: size, owner: 0, keep: false, age: 0, life: 1 }; taken.push(p); return p; },
    decal() { return null; }, update() {}, clear() {}, active: 0, batches: null };
  const ev = shot("tank"), sig = signatureLook(fx, ev, sim), a = aimFor(fx, ev, sim);
  signatureShot(fx, ev, sig, a);
  fx.update(sim, 0.05);
  const ball = taken.find((p) => p.name === "sunDisc");
  assert.ok(ball && ball.keep && ball.mode === 2, "the painted flight, turned along the flight, kept");
  for (let i = 0; i < 20; i++) fx.update(sim, 0.05);
  assert.ok(taken.some((p) => p.name === "sunDiscHit"), "the painted starburst on landing");
});
