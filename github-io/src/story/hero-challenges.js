// H8 Hero challenges (HERO-COINS-PLAN.md, owner 2026-11-28): the first two, as plain missions for the mission engine
// (sim/missions.js) with a `challenge` part for their own rules (sim/content/hero-challenges.js). Each is about 3 to 5
// minutes on an existing map, played as Skywing in Hero mode, and pays 1 to 3 stars plus coins (src/meta/coins.js).
// Rescue and Gauntlet come in a later push. Not CS-style rounds and no squad orders (owner decisions).
//
// Coordinates are world metres on the named map; cover pieces are [kind (0 wall, 1 sandbags, 2 crates), x, z, angle]
// (src/sim/cover.js) and hazards [x, z] (src/sim/hazards.js). tests/hero-challenges.test.js keeps every piece on
// standing ground, the nav grid in one piece, and plays both through.

// Sabotage: Basin, the Ashfall camp in the north-east. Slip in from the south-west corner through the fog past three
// patrols and two guards, set a charge on each of the two signal relays, and get out at the east edge.
export const SABOTAGE = {
  id: "hc-sabotage",
  challenge: {
    id: "sabotage", kind: "sabotage",
    start: { x: -50, z: 46, angle: Math.PI * 0.75, landed: true },
    relays: ["relayA", "relayB"],
    extract: "extract",
    watchers: [
      { type: "ranger", x: -14, z: -18, to: { x: 16, z: -18 } },
      { type: "ranger", x: 2, z: -30, to: { x: 2, z: -52 } },
      { type: "ranger", x: 18, z: -40, angle: Math.PI * 1.15, sweep: 55, speed: 0.8 },
      { type: "ranger", x: 32, z: -10, to: { x: 54, z: -10 } },
      { type: "ranger", x: 51, z: -27, angle: -Math.PI * 0.62, sweep: 50, speed: 0.7 },
    ],
    cover: [
      [0, -4, -12, 0], [1, 10, -13, 0], [2, -4, -25, Math.PI / 2], [0, 9, -27, 0.5],
      [1, 9, -45, Math.PI / 2], [2, 18, -51, 0], [2, 29, -21, 0], [0, 40, -14, 0],
      [1, 40, -27, 0.4], [1, 50, -44, Math.PI / 2],
    ],
    hazards: [[14, -22], [-2, -34], [36, -21], [52, -40]],
    alarm: { from: "enemyBase", units: { vanguard: 2, ranger: 1 }, reach: 30 },
    stars: { time: 180 },
  },
  title: "Sabotage",
  map: "basin",
  land: "basin",
  enemies: 1, speed: "relaxed", alliance: "ffa",
  factions: { 1: "ashfall" },
  rules: { ai: false, playerBase: false, enemyBase: true, rosters: true, hero: true },
  briefing: {
    place: "Hero challenge · Basin",
    lines: [{ who: "vale", text: "Skywing, the Ashfall relay calls their raids. Get in unseen, set the charge, get out." }],
    intel: ["Stay out of the patrols' view cones. Walls and crates hide you; crouch behind sandbags.", "Hold Plant beside a relay for two seconds.", "Being seen sounds the alarm. It is not over: run for the extraction point."],
  },
  regions: {
    relayA: { x: 14, z: -46, r: 4 },
    relayB: { x: 46, z: -20, r: 4 },
    extract: { x: 58, z: -2, r: 5 },
  },
  setup: [
    { spawn: "relay", team: 1, at: "relayA", tag: "relayA", name: "Signal relay", hp: 900, exact: true },
    { spawn: "relay", team: 1, at: "relayB", tag: "relayB", name: "Signal relay", hp: 900, exact: true },
    { challenge: true },
  ],
  objectives: [
    { id: "plant", text: "Plant charges on both signal relays", type: "challenge", check: "plant", need: 2 },
    { id: "escape", text: "Escape to the extraction point", type: "challenge", check: "escape", hidden: true },
  ],
  win: ["plant", "escape"],
  lose: [{ type: "tagLost", tag: "hero" }, { type: "time", seconds: 900 }],
  triggers: [
    { when: { time: 0.5 }, do: [{ ping: "relayA" }, { music: "tense" }] },
    { when: { objective: "plant" }, do: [{ reveal: "escape" }, { ping: "extract" }] },
  ],
  design: "H8 Hero challenge 1 (owner 2026-11-28). Basin, Skywing on foot from the south-west corner, about 3 to 4 minutes. Three patrols (across the approach at z -18, north-south past relay A, east-west before relay B) and a sweeping guard at each relay; ten hand-placed cover pieces along the way and four explosive barrels. Seen fills a meter; full, the alarm brings two Vanguards and a Ranger from the base (scaled by difficulty) but never fails the run. Stars: done, no alarm, under 3:00.",
};

// Sniper nest: Highlands, the east plateau over the north-south road. Land in the marked nest, scope in and stop the
// supply convoy before it reaches the south exit.
export const SNIPER_NEST = {
  id: "hc-sniper-nest",
  challenge: {
    id: "sniper", kind: "sniper",
    start: { x: 10, z: -34, angle: Math.PI * 0.4, landed: false },
    nest: "nest",
    convoy: {
      route: [{ x: 22, z: -80 }, { x: 22, z: -50 }, { x: 22, z: -20 }, { x: 22, z: 12 }, { x: 22, z: 60 }],
      exit: "exit", gap: 6, start: 25, between: 6, escort: "ranger",
      groups: [{ trucks: 3, escorts: 3 }, { trucks: 2, escorts: 4, armour: 1.3 }],
      hp: { story: 60, standard: 80, veteran: 120 }, speed: { story: 2.2, standard: 2.6, veteran: 3 },
      limit: { story: 4, standard: 3, veteran: 2 },
    },
    cover: [[1, 34, -25, 0], [2, 39, -21, 0.3], [0, 46, -18, Math.PI / 2]],
    hazards: [[18, -36], [18, -14], [26, 22]],
    stars: { long: 24 },
  },
  title: "Sniper nest",
  map: "highlands",
  land: "highlands",
  enemies: 1, speed: "relaxed", alliance: "ffa",
  factions: { 1: "ashfall" },
  rules: { ai: false, playerBase: false, enemyBase: false, rosters: true, hero: true },
  briefing: {
    place: "Hero challenge · Highlands",
    lines: [{ who: "okoro", text: "A supply convoy runs the north road. Take the high ground and stop those trucks." }],
    intel: ["Land in the marked nest on the plateau.", "Stand still: the scope reaches 26 m in its cone.", "Shoot the barrels by the road when a truck passes."],
  },
  regions: {
    nest: { x: 35, z: -23, r: 5 },
    exit: { x: 22, z: 56, r: 7 },
  },
  setup: [{ challenge: true }],
  objectives: [
    { id: "nest", text: "Land in the marked sniper nest", type: "challenge", check: "nest" },
    { id: "convoy", text: "Stop the convoy before it reaches the exit", type: "challenge", check: "convoy", need: 5 },
  ],
  win: ["convoy"],
  lose: [{ type: "tagLost", tag: "hero" }, { type: "objectiveFailed", objective: "convoy" }],
  triggers: [
    { when: { time: 0.5 }, do: [{ ping: "nest" }, { music: "tense" }] },
  ],
  design: "H8 Hero challenge 2 (owner 2026-11-28). Highlands, Skywing in the air west of the east plateau, about 3 minutes. Land in the nest (or wait 25 s): three supply trucks (hp by difficulty) and three Ranger escorts drive the x 22 road south past the plateau to the exit at z 56, then two plated trucks with four escorts. Three trucks through fails (four on Story, two on Veteran). Barrels by the road. Stars: done, no damage taken, a hit on a truck from 24 m or more (the scoped Sniper reaches 26 m).",
};

export const HERO_CHALLENGES = Object.freeze([SABOTAGE, SNIPER_NEST]);
export const challengeById = (id) => HERO_CHALLENGES.find((m) => m.id === id || m.challenge.id === id) || null;
