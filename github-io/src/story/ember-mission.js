// "The Ember Roost" (W9): the optional Act 3 boss mission with the Ember Drake, the first flying boss. Plain
// mission data (docs/MISSIONS.md) in a file of its own, so the campaign list (src/story/missions.js) carries one
// import and one entry. The boss is `emberdrake` (balance.json `ember-drake`, boss engine IV in
// src/sim/boss-flight.js): a Builder fire guardian that roosts on the Crown relay of the Obsidian Highlands.
// It woke when the Crown was tuned (mission 10); Maren learns that it, not a relay, burned her first camp.
//
// The fight: in the air only units that hit air reach it (Rangers, Anti-tank soldiers, towers with Anti-air
// guns); a glowing strip marks each fire breath 2 s ahead; after every second breath it lands on the Crown,
// its wing gust pushes back anyone close, and for 8 s every unit can hit it while it takes extra damage. Health
// stages at 2/3 (a wider sweeping breath joins the line) and 1/3 (it breathes sooner).
//
// Tuning (tools/mission-check.mjs, objective bot): see docs/aaa/BOSSES.md "The Ember Drake". The owner's rule:
// comfortably winnable on Story and Standard, never punishing. Hence a "home" Veil AI that never attacks on its
// own (three small scripted raids), a squad with Rangers and Anti-tank soldiers from the start, and no time limit.
import { SCENES } from "./scenes.js";

// The Drake's entrance, a staged scene (format: src/story/scenes.js), registered next to the only mission that
// plays it; the integrator may move it into SCENES in src/story/scenes.js.
export const EMBER_SCENES = {
  "ember-drake": {
    letterbox: true,
    beats: [
      { camera: { at: "crown", zoom: 0.95, seconds: 2.2 } },
      { fx: { flash: "alarm" } },
      { title: { text: "Ember Drake", sub: "Guardian of the Crown's fire" } },
      { say: { who: "maren", text: "That is the fire that burned my camp. It remembers." } },
      { say: { who: "okoro", text: "A Builder fire drake! Rangers and rockets reach it." } },
      { say: { who: "vale", text: "Step off the glow. When it lands, hit it hard." } },
    ],
  },
};
Object.assign(SCENES, EMBER_SCENES);

export const EMBER_ROOST = {
  id: "m10e-the-ember-roost",
  act: 3,
  // A side mission like Crown Hill: it opens after Obsidian Storm and never locks Cut the Draw.
  optional: true,
  title: "The Ember Roost",
  map: "highlands",
  enemies: 1, speed: "relaxed", alliance: "ffa",
  factions: { 1: "veil" },
  bonus: { tower: true },
  rules: { ai: "home", playerBase: true, enemyBase: true, rosters: true },
  briefing: {
    place: "Obsidian Highlands, the Crown, day 50",
    lines: [
      { who: "maren", text: "Thirty years ago my first camp burned in one night. It was not a relay." },
      { who: "okoro", text: "When the Crown woke, something under it woke too. A Builder fire drake." },
      { who: "vale", text: "It roosts on the Crown and burns the highland roads. Bring it down there." },
    ],
    intel: [
      "The Ember Drake flies. In the air only Rangers, Anti-tank soldiers and towers with Anti-air guns can hit it.",
      "A glowing strip marks the ground before each fire breath. Your units step off it on their own.",
      "After every second breath it lands on the Crown to cool. Its wings push back anyone close, then every unit can hit it.",
      "The Veil camp in the north-east sends a few raiders. Their beacons keep the drake away from them.",
    ],
  },
  regions: {
    crown: { x: 4, z: -2, r: 8 },
    southRoad: { x: -30, z: 34, r: 7 },
    veilGate: { x: 40, z: -40, r: 6 },
  },
  setup: [
    { spawn: "ranger", team: 0, at: { x: -44, z: 44 }, count: 6 },
    { spawn: "antitank", team: 0, at: { x: -48, z: 40 }, count: 3 },
    { spawn: "vanguard", team: 0, at: { x: -40, z: 48 }, count: 4 },
    { spawn: "medic", team: 0, at: { x: -46, z: 48 }, count: 1 },
    { resources: { alloy: 900, energy: 350 } },
  ],
  objectives: [
    { id: "drake", text: "Bring down the Ember Drake on the Crown", type: "destroyTag", tag: "drake", hidden: true },
    { id: "towers", text: "Build two more Sentinel towers for the camp", type: "build", building: "tower", count: 3, optional: true },
    { id: "fast", text: "Finish in under 14 minutes", type: "timeUnder", seconds: 840, optional: true },
  ],
  win: ["drake"],
  lose: [{ type: "coreLost" }],
  triggers: [
    { when: { time: 5 }, do: [{ say: { who: "vale", text: "Rangers and Anti-tank soldiers reach it in the air. Train plenty." } }, { ping: "crown" }] },
    { when: { time: 80 }, do: [{ say: { who: "maren", text: "Our beacons keep it off our camp, not yours. I am sorry." } }] },
    // Three small Veil raids, so the camp has something to do; the Veil never attacks on its own (rules.ai "home").
    { when: { time: 100 }, do: [{ wave: { team: 1, units: { vanguard: 3, ranger: 2 }, from: "veilGate", target: "playerBase" } }] },
    { when: { time: 185 }, do: [{ say: { who: "okoro", text: "The Crown runs hot. Something big is flying home to it." } }] },
    // At 4:00 the drake comes home to roost on the Crown, and sleeps there until the army comes near, it is hurt,
    // or the Crown runs hot (`restless`, 200 s later).
    { when: { time: 240 }, do: [
      { spawn: "emberdrake", team: 1, at: "crown", tag: "drake", exact: true, hpByDifficulty: { story: 34000, veteran: 38000 } },
      { reveal: "drake" }, { ping: "crown" },
      { say: { who: "vale", text: "It is on the Crown. Bring the army up the road." } },
    ] },
    { when: { event: "bossWake" }, do: [{ scene: "ember-drake" }, { music: "tense" }] },
    { when: { event: "bossLand" }, do: [{ say: { who: "vale", text: "It landed on the Crown! Everything on it now!" } }] },
    { when: { time: 330 }, do: [{ wave: { team: 1, units: { vanguard: 3, ranger: 2 }, from: "veilGate", target: "playerBase" } }] },
    { when: { bossStage: 2 }, do: [
      { music: "battle" },
      { say: { who: "okoro", text: "Its plates crack! Now it sweeps the fire wide." } },
      { say: { who: "vale", text: "Same rule. Off the glow, and keep firing." } },
    ] },
    { when: { bossStage: 3 }, do: [{ say: { who: "maren", text: "It tires, but it breathes faster. Hold on." } }] },
    { when: { time: 560 }, do: [{ wave: { team: 1, units: { vanguard: 4, ranger: 2 }, from: "veilGate", target: "playerBase" } }] },
    { when: { tagDead: "drake" }, do: [
      { music: "calm" },
      { say: { who: "okoro", text: "It is down. A Builder guardian. Sorry, old one." } },
      { say: { who: "maren", text: "Thirty years I kept the highlands dark for that. Thank you." } },
    ] },
  ],
  debrief: {
    win: [
      { who: "maren", text: "The highlands can have their light now. The Veil will remember who did this." },
      { who: "vale", text: "One fire less on the road to the Keystone. Back to the draw, Commander." },
    ],
    lose: [{ who: "vale", text: "The drake holds the Crown. We pull back to the south road and try again." }],
  },
  // Objective bot: Story 337 s, Standard 357 s, Veteran 400 s, all gold (docs/aaa/BOSSES.md "The Ember Drake").
  medals: { gold: { seconds: 480 }, silver: { seconds: 660 } },
  design: "An optional Act 3 boss mission (W9) on the Obsidian Highlands, day 50, about 8 to 10 minutes against one Veil AI that never attacks on its own (rules.ai \"home\"; raids of 5 at 1:40 and 5:30 and 6 at 9:20). The player starts with the camp, a bonus tower, 900 alloy and a 14-unit squad (6 Rangers, 3 Anti-tank soldiers, 4 Vanguards, a Medic). The Ember Drake (emberdrake, 18000 HP, Story 14000, Veteran 16000; boss engine IV: flight) sleeps on the Crown relay in the middle of the map until the army comes within 16 m, it is hurt, or 3:20 passes. In the air only units that hit air reach it; its fire breath is a 16 m line marked 2 s ahead; after every second breath it flies back to the Crown, marks a 5 m wing-gust circle (3.2 s), pushes everyone in it 3 m out, and lands for 8 s, when every unit can hit it and it takes 1.75x damage. At two thirds it surges and adds a sweeping cone; at one third it breathes sooner. Intended: train Rangers and Anti-tank soldiers, walk to the Crown and fight it there; bring the Vanguards for the landings.",
};
