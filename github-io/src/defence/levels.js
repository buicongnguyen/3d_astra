// Frontier Defence levels (release 0.17). Each level is a mission-shaped definition with a
// `defence` block, so the same object can later sit in the campaign MISSIONS list. The rules
// live in src/sim/defence.js; the format is described in docs/MISSIONS.md ("Frontier Defence levels").
//
// Wave groups name roster slots (vanguard, ranger, breaker, tank, antitank, medic): on a faction
// roster (rules.rosters) they become that faction's units, so Ashfall's vanguard is a Scrapper.
// Counts scale with the difficulty like campaign waves (balance.json difficulty.wave).
import MAPS from "./maps.json" with { type: "json" };

const route = (map) => Object.fromEntries(Object.entries(MAPS[map].routes).map(([id, pts]) => [id, pts.map(([x, z]) => ({ x, z }))]));
const exitOf = (map, r = 4) => { const pts = Object.values(MAPS[map].routes)[0], [x, z] = pts.at(-1); return { x, z, r }; };
const group = (units, route = "main", every = 0.7, delay = 0, hp) => ({ units, route, every, delay, ...(hp ? { hp } : {}) });

export const DEFENCE_LEVELS = [
  {
    id: "d-gorge",
    title: "Gorge Road",
    map: "gorge",
    enemies: 1,
    speed: "normal",
    alliance: "ffa",
    // air (0.18.3): Kite spotters and Ember balloons in waves 5, 7, 9 and 10; Ranger, Anti-tank and Watcher crews hit them.
    rules: { ai: false, mode: "defence", rosters: true, air: true },
    factions: { 1: "ashfall" },
    briefing: {
      place: "Gorge Road, below the Keystone relays",
      text: "Ashfall columns climb the gorge to the relay plateau. Crew the pads along the road and hold them for ten waves.",
      tip: "Rim pads see far but can be shot. Deep pads stay hidden from the road.",
    },
    defence: {
      lives: 20,
      alloy: { story: 320, standard: 260, veteran: 240 },
      firstWave: 30,
      gap: 16,
      lane: 2.4,
      pace: 0.85,
      // Wave sizes by difficulty (the campaign uses 0.7 / 1 / 1.35).
      count: { story: 0.7, standard: 1, veteran: 1.35 },
      routes: route("gorge"),
      exit: exitOf("gorge"),
      pads: [
        { id: "g1", x: -27.7, z: -27.9 }, { id: "g2", x: -20.5, z: -40.5 }, { id: "g3", x: 4.7, z: -25.8 },
        { id: "g4", x: -3.9, z: -12.8 }, { id: "g5", x: 10.9, z: -13.2 }, { id: "g6", x: -11.5, z: 10.1 },
        { id: "g7", x: 6, z: 13 }, { id: "g8", x: -4.5, z: 22.2 }, { id: "g9", x: 22.2, z: 18.4 },
        { id: "g10", x: 13.5, z: 42.5 },
        { id: "r1", x: -7.9, z: -34, high: "rim" }, { id: "d1", x: -10.4, z: -40.4, high: "deep" },
        { id: "r2", x: -15.3, z: -14.5, high: "rim" }, { id: "d2", x: -19.4, z: -9.5, high: "deep" },
        { id: "r3", x: 7.8, z: -1, high: "rim" }, { id: "d3", x: 14.6, z: -1.4, high: "deep" },
        { id: "r4", x: 3.8, z: 27.1, high: "rim" }, { id: "d4", x: -0.5, z: 32.4, high: "deep" },
      ],
      crews: ["ranger", "breaker", "antitank", "watcher"],
      waves: [
        { groups: [group({ vanguard: 6 })], bonus: 25 },
        { groups: [group({ vanguard: 8 }), group({ ranger: 3 }, "main", 1, 5)], bonus: 30 },
        { groups: [group({ vanguard: 12 }, "main", 0.55), group({ ranger: 4 }, "main", 1, 4)], bonus: 35 },
        { groups: [group({ ranger: 6 }, "main", 0.9), group({ breaker: 2 }, "main", 1.5, 6)], bonus: 40 },
        { groups: [group({ vanguard: 18 }, "main", 0.45), group({ kite: 2 }, "main", 1.5, 6)], bonus: 45 },
        { groups: [group({ vanguard: 8 }), group({ breaker: 3, ranger: 4 }, "main", 1.2, 5)], bonus: 50 },
        { groups: [group({ tank: 4 }, "main", 2.5, 0, 1.5), group({ vanguard: 8 }, "main", 0.5, 4), group({ balloon: 2 }, "main", 4, 6)], bonus: 55 },
        { groups: [group({ vanguard: 20 }, "main", 0.45), group({ ranger: 8 }, "main", 0.8, 6)], bonus: 60 },
        { groups: [group({ tank: 6, breaker: 4 }, "main", 2, 0, 1.5), group({ ranger: 6 }, "main", 0.8, 4), group({ kite: 2, balloon: 2 }, "main", 3, 8)], bonus: 65 },
        { groups: [group({ vanguard: 24 }, "main", 0.4), group({ tank: 6, breaker: 4 }, "main", 2, 6, 1.5), group({ ranger: 8 }, "main", 0.7, 10), group({ balloon: 3 }, "main", 4, 12)], bonus: 0 },
      ],
      camera: { x: -1, z: 0, zoom: 70, maxZoom: 96 },
    },
    objectives: [{ id: "hold", type: "waves", count: 10, text: "Hold the road for 10 waves" }],
    win: ["hold"],
    lose: [{ type: "lives" }],
    medals: { gold: { lives: 18 }, silver: { lives: 10 } },
    // tools/defence-check.mjs: the stars the defence bot must reach on each difficulty.
    check: { story: 3, standard: 2, veteran: 1 },
  },
  {
    id: "d-bridges",
    title: "Twin Bridges",
    map: "bridges",
    enemies: 1,
    speed: "normal",
    alliance: "ffa",
    // air (0.18.3): Kite spotters and Swift gliders in waves 4, 6, 8 and 10; Ranger, Anti-tank and Watcher crews hit them.
    rules: { ai: false, mode: "defence", rosters: true, air: true },
    factions: { 1: "sunward" },
    briefing: {
      place: "Twin Bridges, the Meridian river",
      text: "Sunward caravans cross by both bridges and the ford. Watch all three roads and hold for ten waves.",
      tip: "Wagons mend the units around them: bring them down first.",
    },
    defence: {
      lives: 20,
      alloy: { story: 440, standard: 380, veteran: 360 },
      firstWave: 30,
      gap: 16,
      lane: 2.4,
      // Columns march: waves walk at this share of their field speed.
      pace: 0.75,
      // Hull factor of every wave unit by difficulty (Sunward travels light).
      count: { story: 0.8, standard: 1, veteran: 1.15 },
      hp: { story: 0.75, standard: 0.8, veteran: 0.8 },
      routes: route("bridges"),
      exit: exitOf("bridges"),
      pads: [
        { id: "n1", x: -18, z: -33 }, { id: "n2", x: -4, z: -40 }, { id: "n3", x: -11, z: -7 },
        { id: "n4", x: 11, z: -7 }, { id: "n5", x: -30, z: -12 }, { id: "n6", x: 30, z: -12 },
        { id: "n7", x: 5, z: -19 }, { id: "n8", x: -10, z: -19 },
        { id: "s1", x: -30, z: 12 }, { id: "s2", x: -11, z: 9 }, { id: "s3", x: 11, z: 9 },
        { id: "s4", x: 30, z: 12 }, { id: "s5", x: -6, z: 26 }, { id: "s6", x: 14, z: 26 },
        { id: "s7", x: 0, z: 36 }, { id: "s8", x: 20, z: 34 },
      ],
      crews: ["ranger", "breaker", "antitank", "watcher"],
      waves: [
        { groups: [group({ vanguard: 4 }, "ford")], bonus: 40 },
        { groups: [group({ ranger: 2 }, "west", 0.9), group({ ranger: 2 }, "east", 0.9, 2)], bonus: 45 },
        { groups: [group({ vanguard: 5 }, "ford", 0.6), group({ ranger: 3 }, "west", 0.9, 4)], bonus: 50 },
        { groups: [group({ medic: 1, vanguard: 6 }, "east", 0.6), group({ kite: 1 }, "ford", 1, 4)], bonus: 55 },
        { groups: [group({ ranger: 4 }, "west", 0.7), group({ ranger: 4 }, "east", 0.7, 3)], bonus: 60 },
        { groups: [group({ vanguard: 8 }, "ford", 0.5), group({ breaker: 1 }, "ford", 2, 6), group({ glider: 2 }, "west", 1.5, 4)], bonus: 65 },
        { groups: [group({ tank: 3 }, "west", 3, 0, 1.4), group({ ranger: 5 }, "east", 0.7, 2)], bonus: 70 },
        { groups: [group({ medic: 1, vanguard: 9 }, "ford", 0.5), group({ ranger: 4 }, "west", 0.7, 5), group({ kite: 2, glider: 2 }, "east", 1.2, 3, 1.5)], bonus: 75 },
        { groups: [group({ tank: 4 }, "east", 2.5, 0, 1.4), group({ breaker: 2 }, "west", 2.5, 3), group({ ranger: 6 }, "ford", 0.7, 6)], bonus: 80 },
        { groups: [group({ vanguard: 10, medic: 2 }, "ford", 0.45), group({ ranger: 6 }, "west", 0.7, 3), group({ tank: 4, breaker: 1 }, "east", 2.5, 5, 1.4), group({ glider: 3 }, "ford", 1, 6, 1.8)], bonus: 0 },
      ],
      camera: { x: 0, z: 0, zoom: 78, maxZoom: 96 },
    },
    objectives: [{ id: "hold", type: "waves", count: 10, text: "Hold the crossings for 10 waves" }],
    win: ["hold"],
    lose: [{ type: "lives" }],
    medals: { gold: { lives: 18 }, silver: { lives: 10 } },
    check: { story: 3, standard: 2, veteran: 1 },
  },
];

export const defenceLevel = (id) => DEFENCE_LEVELS.find((level) => level.id === id) || null;
