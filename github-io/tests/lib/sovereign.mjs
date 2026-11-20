// Sandboxes for the Iron Sovereign (W1-E): a field fight and a Defence road fight, shared by the
// tests, the golden pin and the measurement scripts.
import { Simulation } from "../../src/simulation.js";
import { defenceLevel } from "../../src/defence/levels.js";

export const fieldFight = (rangers, breakers, { difficulty = "standard" } = {}) => {
  const mission = { id: "t-sov", map: "classic", enemies: 1, rules: { ai: false, playerBase: true, enemyBase: true },
    setup: [{ spawn: "ironsovereign", team: 1, at: { x: 0, z: -10 }, tag: "boss", exact: true }], objectives: [{ id: "boss", type: "destroyTag", tag: "boss" }], win: ["boss"] };
  const s = new Simulation({ map: "classic", enemyCount: 1, mission, difficulty });
  const army = [];
  for (let i = 0; i < rangers; i++) army.push(s.spawn("ranger", 0, -6 + (i % 6) * 1.5, 8 + Math.floor(i / 6) * 1.5));
  for (let i = 0; i < breakers; i++) army.push(s.spawn("breaker", 0, -4 + i * 2.5, 11));
  const boss = s.tagged("boss")[0];
  s.issue(army.map((e) => e.id), { type: "attackmove", x: 0, z: -10 });
  return { s, boss, army };
};

// The Sovereign alone on a road of d-crossroads (or another level), ten towers at tiers 2 and 3 on
// the first pads. `crews` cycle through the level's own.
export const routeFight = ({ level = "d-crossroads", towers = 10, route, difficulty = "standard" } = {}) => {
  const base = defenceLevel(level), id = route ?? Object.keys(base.defence.routes)[0];
  const defence = { ...base.defence, firstWave: 1, gap: 5, waves: [{ groups: [{ units: { ironsovereign: 1 }, route: id, every: 1 }], bonus: 0 }] };
  delete defence.commander;
  const s = new Simulation({ map: base.map, enemyCount: 1, ai: false, mission: { ...base, id: "d-sov", defence }, difficulty });
  s.players[0].alloy = 1e6;
  defence.pads.slice(0, towers).forEach((p, i) => {
    s.command({ team: 0, type: "padBuild", pad: p.id, crew: defence.crews[i % defence.crews.length] });
    const t = s.towerOn(p.id);
    for (let k = 0; k < 1 + (i % 2); k++) s.command({ team: 0, type: "padUpgrade", building: t.id });
  });
  return { s, route: id };
};
