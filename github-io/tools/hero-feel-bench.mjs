// H8 difficulty check (owner: never make Relaxed or Normal harder): the driven hero's time to kill and the damage it
// takes, in the same duels, with this tree's rules and with another tree's (the code before H8). Usage:
//   node tools/hero-feel-bench.mjs [path/to/other/src]   (default: this tree only)
// Each duel: Hero mode at the default battle time (x0.5), the hero holds fire on the nearest enemy until all are down
// (or 120 real seconds); enemies are Relaxed-skirmish units that fight back. Times are real seconds.
import { pathToFileURL } from "node:url";
import { resolve } from "node:path";

const TICK = 0.05, SCALE = 0.5;
const DUELS = [
  { name: "Skywing on foot (Sniper) vs 3 Rangers at 12 m", hero: "sky", land: true, weapon: "sniper", foes: [["ranger", 12, -2], ["ranger", 12, 0], ["ranger", 12, 2]] },
  { name: "Skywing on foot (Rocket) vs a Battle tank at 11 m", hero: "sky", land: true, weapon: "rocket", foes: [["tank", 11, 0]] },
  { name: "Skywing flying (Sniper) vs 2 Rangers at 10 m", hero: "sky", land: false, weapon: "sniper", foes: [["ranger", 10, -1.5], ["ranger", 10, 1.5]] },
  { name: "Ranger hero (Sol) vs 2 Rangers at 9 m", hero: "sol", foes: [["ranger", 9, -1], ["ranger", 9, 1]] },
];

async function load(root) {
  const url = (p) => pathToFileURL(resolve(root, p)).href;
  const { Simulation } = await import(url("simulation.js"));
  const { makeHero } = await import(url("sim/content/campaign-heroes.js"));
  const { enterCommands } = await import(url("sim/content/hero-mode.js"));
  const sky = await import(url("sim/content/skywing.js"));
  return { Simulation, makeHero, enterCommands, sky };
}

function duel(R, d) {
  const s = new R.Simulation({ map: "classic", ai: false });
  let hero;
  if (d.hero === "sky") {
    s.command({ team: 0, type: "skywing", weapon: d.weapon });
    hero = s.get(s.skywing.id);
    hero.x = 0; hero.z = 0;
    if (d.land) { s.command({ team: 0, type: "skywingLand", id: hero.id, land: true, x: 0, z: 0 }); for (let i = 0; i < 40 && hero.flying; i++) s.tick(TICK); }
  } else { hero = s.spawn("ranger", 0, 0, 0, true, true); R.makeHero(s, hero, "sol"); }
  s.explored[0].fill(1); s.explored[1].fill(1);
  for (const c of R.enterCommands(0, hero.id, SCALE)) s.command(c);
  const foes = d.foes.map(([type, x, z]) => { const t = s.spawn(type, 1, hero.x + x, hero.z + z, true, true); t.orders = [{ type: "attack", target: hero.id }]; return t; });
  s.updateVision();
  hero.cooldown = 0;
  const life = () => hero.hp + (hero.shield || 0), start = life(), t0 = s.time;
  let target = null, done = null;
  for (let i = 0; i < 120 / (TICK / SCALE) && !s.result; i++) {
    const alive = foes.filter((t) => t.hp > 0);
    if (!alive.length) { done = (s.time - t0) / SCALE; break; }
    if (hero.hp <= 0) break;
    const near = alive.reduce((a, b) => (Math.hypot(a.x - hero.x, a.z - hero.z) <= Math.hypot(b.x - hero.x, b.z - hero.z) ? a : b));
    if (near.id !== target) { target = near.id; s.command({ team: 0, type: "heroFire", target, hold: true }); }
    s.tick(TICK);
  }
  return { ttk: done, taken: Math.round(start - life()), down: hero.hp <= 0 };
}

const here = await load(new URL("../src/", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1"));
const other = process.argv[2] ? await load(process.argv[2]) : null;
for (const d of DUELS) {
  const a = duel(here, d), b = other ? duel(other, d) : null;
  const fmt = (r) => `${r.ttk === null ? "not done" : `${r.ttk.toFixed(1)} s`}, taken ${r.taken}${r.down ? " (down)" : ""}`;
  console.log(`${d.name}\n  now:    ${fmt(a)}${b ? `\n  before: ${fmt(b)}\n  ${(a.ttk ?? 999) <= (b.ttk ?? 999) + 1e-9 && a.taken <= b.taken ? "equal or easier" : "HARDER"}` : ""}`);
}
