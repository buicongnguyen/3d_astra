// The two campaign missions played under the Frontier Defence rules (release 0.19b): Hold the River
// (Act 1, after First Contact) and Hold the Valley (Act 2, after Copper Siege). Each is an ordinary
// campaign mission (briefing, lines, debrief, medals) with a `defence` block in the format of
// src/defence/levels.js (rules: src/sim/defence.js; docs/MISSIONS.md, "Frontier Defence levels").
// Shorter than the Defence-mode levels (7 and 8 waves), with story beats between the waves through
// the `wave` / `waveStart` trigger conditions. Medals go by lives left; `check` is the stars the
// DefenceBot must reach in `npm run check:missions` (tools/mission-check.mjs).
//
// The roads come from src/defence/maps.json, so they always match the painted route; the pads are
// this file's own (tests/missions-data.test.js checks them like tests/defence-data.test.js does).
import DEFENCE_MAPS from "../defence/maps.json" with { type: "json" };

const routes = (map) => Object.fromEntries(Object.entries(DEFENCE_MAPS[map].routes).map(([id, pts]) => [id, pts.map(([x, z]) => ({ x, z }))]));
const exitOf = (map, r = 4) => { const [x, z] = Object.values(DEFENCE_MAPS[map].routes)[0].at(-1); return { x, z, r }; };
const group = (units, route = "main", every = 0.7, delay = 0, hp) => ({ units, route, every, delay, ...(hp ? { hp } : {}) });

export const HOLD_THE_RIVER = {
  id: "m02b-hold-the-river",
  act: 1,
  title: "Hold the River",
  map: "bridges",
  enemies: 1, speed: "normal", alliance: "ffa",
  factions: { 1: "ashfall" },
  rules: { ai: false, mode: "defence", rosters: true },
  briefing: {
    place: "Twin Bridges, Meridian Riverlands, day 6",
    lines: [
      { who: "vale", text: "Hale has gathered new columns east of the river. He means to take the crossings back." },
      { who: "okoro", text: "I am tuning the river relay. It needs time, and quiet, and nobody marching over my cables." },
      { who: "vale", text: "No base today, Commander. Crew towers on the pads beside the roads and stop every column." },
    ],
    intel: [
      "Columns walk the roads over the west bridge, the ford and the east bridge. Each unit that gets through costs a life.",
      "Tap a pad to crew a tower: Rangers reach far, Breakers hit crowds, Anti-tank crews stop vehicles.",
      "The ford slows everything that wades it. A tower beside it gets more shots.",
      "Each kill pays a little alloy. Calling the next wave early pays a bonus.",
    ],
  },
  defence: {
    lives: 20,
    alloy: { story: 420, standard: 360, veteran: 340 },
    firstWave: 30,
    gap: 16,
    lane: 2.4,
    pace: 0.75,
    count: { story: 0.8, standard: 1, veteran: 1.2 },
    hp: { story: 0.75, standard: 1, veteran: 1.05 },
    routes: routes("bridges"),
    exit: exitOf("bridges"),
    pads: [
      { id: "n1", x: -18, z: -33 }, { id: "n2", x: -4, z: -40 }, { id: "n3", x: -11, z: -7 },
      { id: "n4", x: 11, z: -7 }, { id: "n5", x: -30, z: -12 }, { id: "n6", x: 30, z: -12 },
      { id: "n7", x: 5, z: -19 }, { id: "n8", x: -10, z: -19 },
      { id: "s1", x: -30, z: 12 }, { id: "s2", x: -11, z: 9 }, { id: "s3", x: 11, z: 9 },
      { id: "s4", x: 30, z: 12 }, { id: "s5", x: -6, z: 26 }, { id: "s6", x: 14, z: 26 },
      { id: "s7", x: 0, z: 36 }, { id: "s8", x: 20, z: 34 },
    ],
    crews: ["ranger", "breaker", "antitank"],
    waves: [
      { groups: [group({ vanguard: 5 }, "ford", 0.7)], bonus: 40 },
      { groups: [group({ vanguard: 4 }, "west", 0.7), group({ ranger: 2 }, "east", 0.9, 2)], bonus: 45 },
      { groups: [group({ vanguard: 6 }, "ford", 0.6), group({ ranger: 3 }, "west", 0.9, 4)], bonus: 50 },
      { groups: [group({ vanguard: 10 }, "east", 0.5)], bonus: 55 },
      { groups: [group({ ranger: 4 }, "west", 0.7), group({ ranger: 4 }, "east", 0.7, 3)], bonus: 60 },
      { groups: [group({ vanguard: 10 }, "ford", 0.45), group({ breaker: 2 }, "ford", 2, 6)], bonus: 65 },
      { groups: [group({ tank: 3 }, "west", 3, 0, 1.3), group({ vanguard: 12 }, "east", 0.4, 2), group({ ranger: 4 }, "ford", 0.7, 5)], bonus: 0 },
    ],
    camera: { x: 0, z: 0, zoom: 78, maxZoom: 96 },
  },
  objectives: [{ id: "hold", type: "waves", count: 7, text: "Hold the crossings for 7 waves" }],
  win: ["hold"],
  lose: [{ type: "lives" }],
  triggers: [
    { when: { time: 4 }, do: [{ say: { who: "vale", text: "Pads stand beside all three roads. Crew the ones near the crossings before the first column." } }] },
    { when: { time: 14 }, do: [{ say: { who: "okoro", text: "The relay needs seven quiet stretches to tune. Hold every crossing and I will get them." } }] },
    { when: { waveStart: 1 }, do: [{ say: { who: "hale", text: "Meridian camp. You hold a river that is not yours. My columns cross on the hour." } }, { music: "tense" }] },
    { when: { wave: 2 }, do: [{ say: { who: "okoro", text: "Two stretches done and the relay is warming. Wading slows them, Commander. Hit them in the ford." } }] },
    { when: { wave: 3 }, do: [{ say: { who: "vale", text: "Scrappers come in crowds. A Breaker crew hits the whole crowd at once." } }] },
    { when: { waveStart: 6 }, do: [{ say: { who: "hale", text: "The sixth column crosses now, with Scorchers. I would rather you stood aside." } }, { music: "battle" }] },
    { when: { wave: 6 }, do: [{ say: { who: "okoro", text: "One more stretch! The relay is almost in tune. I can hear it." } }] },
    { when: { waveStart: 7 }, do: [{ say: { who: "vale", text: "Last column, and it brings Battle tanks. Anti-tank crews on the bridges, Commander." } }] },
  ],
  debrief: {
    win: [
      { who: "vale", text: "The river held, Commander. Hale's columns have gone back to the ash plains." },
      { who: "okoro", text: "Tuned! And the relay's line points east, straight at Hale's siphons. I want to see them." },
    ],
    lose: [{ who: "vale", text: "They crossed. Okoro got clear with the tuning core. We regroup at camp and try again." }],
  },
  medals: { gold: { lives: 18 }, silver: { lives: 10 } },
  check: { story: 3, standard: 2, veteran: 1 },
  design: "Frontier Defence rules on Twin Bridges in Act 1, about 6 minutes: no base, 20 lives, crews of Rangers, Breakers and Anti-tank soldiers on 16 pads beside three roads (west bridge, ford, east bridge). Seven Ashfall waves from 5 Scrappers to a last column with 2 Battle tanks, 10 Scrappers and 4 Rangers. Intended: crew the pads that see the ford first (the ford slows the columns), add a Breaker crew for the Scrapper crowds by wave 3 and an Anti-tank crew on a bridge road before wave 7. Story beats between the waves: Okoro tunes the river relay; Hale keeps his schedule.",
};

export const HOLD_THE_VALLEY = {
  id: "m07b-hold-the-valley",
  act: 2,
  title: "Hold the Valley",
  map: "gorge",
  enemies: 1, speed: "normal", alliance: "ffa",
  factions: { 1: "ashfall" },
  // Air since Wings over Copper (0.18.3): a Kite in wave 6 and Ember balloons in wave 8; Ranger and Anti-tank crews hit them.
  rules: { ai: false, mode: "defence", rosters: true, air: true },
  briefing: {
    place: "Gorge Road, below the highlands, day 36",
    lines: [
      { who: "okoro", text: "The circuit map says every line meets at one point. From the relay plateau above Gorge Road I can find it." },
      { who: "vale", text: "Hale knows it too. His columns are climbing the gorge to stop the survey. Hold the road for eight waves." },
      { who: "vale", text: "Crews on a plateau rim see far. Crews deep on top cannot be seen from the road at all." },
    ],
    intel: [
      "Ashfall columns climb the gorge road to the relay plateau. Each unit that reaches the top costs a life.",
      "Rim pads reach further, but the road can shoot back. Deep pads are hidden from below.",
      "Heavy machines cost two lives. Keep an Anti-tank crew on the upper road.",
      "Each kill pays a little alloy. Calling the next wave early pays a bonus.",
    ],
  },
  defence: {
    lives: 20,
    alloy: { story: 320, standard: 270, veteran: 250 },
    firstWave: 30,
    gap: 16,
    lane: 2.4,
    pace: 0.85,
    count: { story: 0.7, standard: 1, veteran: 1.3 },
    routes: routes("gorge"),
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
    crews: ["ranger", "breaker", "antitank"],
    waves: [
      { groups: [group({ vanguard: 6 })], bonus: 25 },
      { groups: [group({ vanguard: 8 }), group({ ranger: 3 }, "main", 1, 5)], bonus: 30 },
      { groups: [group({ vanguard: 12 }, "main", 0.55), group({ ranger: 4 }, "main", 1, 4)], bonus: 35 },
      { groups: [group({ ranger: 6 }, "main", 0.9), group({ breaker: 2 }, "main", 1.5, 6)], bonus: 40 },
      { groups: [group({ vanguard: 16 }, "main", 0.45)], bonus: 45 },
      { groups: [group({ vanguard: 8 }), group({ breaker: 4, ranger: 4 }, "main", 1.2, 5), group({ kite: 1 }, "main", 1, 8)], bonus: 50 },
      { groups: [group({ tank: 4 }, "main", 2.5, 0, 1.5), group({ vanguard: 8 }, "main", 0.5, 4)], bonus: 55 },
      { groups: [group({ vanguard: 18 }, "main", 0.45), group({ tank: 4, breaker: 2 }, "main", 2.2, 6, 1.5), group({ ranger: 6 }, "main", 0.8, 10), group({ balloon: 2 }, "main", 4, 12)], bonus: 0 },
    ],
    camera: { x: -1, z: 0, zoom: 70, maxZoom: 96 },
  },
  objectives: [{ id: "hold", type: "waves", count: 8, text: "Hold the gorge road for 8 waves" }],
  win: ["hold"],
  lose: [{ type: "lives" }],
  triggers: [
    { when: { time: 4 }, do: [{ say: { who: "vale", text: "Pads line the whole road, Commander. Crew the lower ones first. The column starts at the bottom." } }] },
    { when: { waveStart: 1 }, do: [{ say: { who: "hale", text: "Meridian. That plateau is not on your schedule. My columns will clear it by nightfall." } }, { music: "tense" }] },
    { when: { wave: 2 }, do: [{ say: { who: "okoro", text: "First reading! The lines bend south and west, toward the ash plains." } }] },
    { when: { wave: 4 }, do: [{ say: { who: "okoro", text: "Second reading. They cross under the old Ashfall camp. Something is buried there, Commander." } }] },
    { when: { waveStart: 5 }, do: [{ say: { who: "vale", text: "A long Scrapper column on the road. Breaker crews where the road bends, please." } }] },
    { when: { waveStart: 6 }, do: [{ say: { who: "vale", text: "A Kite over the gorge. Ranger and Anti-tank crews can shoot it down. Breaker crews cannot." } }] },
    { when: { wave: 6 }, do: [{ say: { who: "okoro", text: "Third reading. It is a Builder vault, and the Lattice keeps a key inside it." } }] },
    { when: { waveStart: 7 }, do: [{ say: { who: "hale", text: "I have counted your towers, Commander. I am sending a tank for each of them." } }, { music: "battle" }] },
    { when: { waveStart: 8 }, do: [{ say: { who: "vale", text: "Last column. Everything Hale has left on this road. Hold the top, Commander." } }] },
    { when: { waveStart: 8 }, do: [{ say: { who: "okoro", text: "Balloons behind the column, the same as over the basin! Keep a Ranger crew near the top." } }] },
  ],
  debrief: {
    win: [
      { who: "okoro", text: "The survey is done. The centre has a key, and the key was kept in a vault beside Hale's camp." },
      { who: "vale", text: "Then we go to the ash plains, quietly and at night. Rest the crews, Commander." },
    ],
    lose: [{ who: "vale", text: "They reached the plateau, and the survey with it. Okoro saved half the readings. We try again." }],
  },
  medals: { gold: { lives: 18 }, silver: { lives: 10 } },
  check: { story: 3, standard: 2, veteran: 1 },
  design: "Frontier Defence rules on Gorge Road in Act 2, about 7 minutes: no base, 20 lives, Ranger, Breaker and Anti-tank crews on 18 pads, four of them rim pads (seen from the road, more reach) and four deep pads (hidden from below). Eight Ashfall waves climb one road to the relay plateau, from 6 Scrappers to a last column of 18 Scrappers, 3 Battle tanks and 6 Rangers. Intended: crew the low road first, then rim pads at the bends, Breakers for the Scrapper columns (waves 3, 5, 8) and Anti-tank crews on the upper road before the tanks (waves 7, 8). Story beats: Okoro's three readings find the Builder vault, which sets up mission 8.",
};

// Hold the Keystone Roads (AAA round 2, W2-F): the optional third Defence mission of the campaign, in
// Act 3 between Cut the Draw and Frontier's End. It is the story's first mission with build zones, armour
// squads and the commander's post, on the Three Roads map of the Defence mode (same roads, pads and
// zones), and the story debut of the Gunner: two squads lent by the Field workshop reach the keystone
// before wave 4, outside the Expanded roster rule (a `spawn` action; the model roster declares them
// from it). It carries `optional: true` (a mission opens when the nearest earlier non-optional
// mission is cleared; it counts for medals, never for endings) and `look: "dusk"` (read by W2-C's
// look table). The Rampart is not in this tree yet: round 3 adds an Ashfall Rampart column to wave 9
// with a re-pinned checksum.
const CROSSROADS_PADS = [
  { id: "c1", x: -3, z: -47 }, { id: "c2", x: 9, z: -45 }, { id: "m1", x: 2, z: -31 },
  { id: "w1", x: -41, z: -35 }, { id: "w2", x: -29, z: -17 }, { id: "w3", x: -41, z: 5 }, { id: "w4", x: -21, z: 11 },
  { id: "e1", x: 41, z: -35 }, { id: "e2", x: 45, z: -11 }, { id: "e3", x: 41, z: 5 }, { id: "e4", x: 21, z: 11 },
  { id: "s1", x: -19, z: 35 }, { id: "s2", x: -7, z: 47 }, { id: "s3", x: 7, z: 47 }, { id: "s4", x: 19, z: 35 },
];
// A group from another faction's roster, and troop carriers that drop their squad at route point `dropLeg`.
const allied = (faction, units, route, every, delay, hp) => ({ ...group(units, route, every, delay, hp), faction });
const carriers = (carry, route, dropLeg, delay = 0, n = 1, hp) => ({ ...group({ carrier: n }, route, 3, delay, hp), carry, dropLeg });

export const HOLD_THE_ROADS = {
  id: "m11c-hold-the-keystone-roads",
  act: 3,
  optional: true,
  look: "dusk",
  title: "Hold the Keystone Roads",
  map: "crossroads",
  enemies: 1, speed: "normal", alliance: "ffa",
  factions: { 1: "ashfall" },
  rules: { ai: false, mode: "defence", rosters: true },
  briefing: {
    place: "Three Roads Basin, below the southern relays, day 54",
    lines: [
      { who: "vale", text: "Hale's last columns come down the three roads to the keystone, and Warden machines walk with them." },
      { who: "okoro", text: "Echo needs the southern relays quiet for ten waves. Nothing may cross the basin until it is tuned." },
      { who: "vale", text: "You have a commander's post this time, Commander. Take the field, and keep your armour on the road that needs it." },
    ],
    intel: [
      "Ashfall columns and Warden machines come down three roads at once; the north road forks round the basin.",
      "Build crews anywhere inside the marked fields. Armour squads wait at the commander's post: tap one, then tap a road.",
      "Heavy machines cost two lives. Anti-tank crews and armour stop them.",
      "Meridian's Field workshop lends two Gunner teams before wave 4. They pin a crowd so your crews finish it.",
    ],
  },
  defence: {
    lives: 20,
    alloy: { story: 420, standard: 330, veteran: 290 },
    firstWave: 35,
    gap: 18,
    lane: 2.4,
    pace: 0.8,
    count: { story: 0.9, standard: 1.35, veteran: 1.5 },
    hp: { story: 0.85, standard: 0.95, veteran: 1 },
    routes: routes("crossroads"),
    roads: { west: "West road", midwest: "North road, west fork", mideast: "North road, east fork", east: "East road" },
    exit: exitOf("crossroads"),
    pads: CROSSROADS_PADS,
    zones: [
      { id: "basin", x: 0, z: 4, w: 32, d: 44, max: 6 },
      { id: "westfield", x: -51, z: 0, w: 18, d: 40, max: 3 },
      { id: "eastfield", x: 51, z: 0, w: 18, d: 40, max: 3 },
      { id: "southfield", x: 28, z: 47, w: 24, d: 20, max: 3 },
    ],
    armour: { cap: 2 },
    crews: ["ranger", "breaker", "antitank", "watcher", "tank", "scorcher"],
    commander: { x: -20, z: 52 },
    waves: [
      { groups: [group({ vanguard: 6 }, "west"), group({ vanguard: 6 }, "east", 0.7, 4)], bonus: 40 },
      { groups: [group({ vanguard: 8 }, "midwest", 0.6), group({ ranger: 4 }, "mideast", 0.9, 3)], bonus: 45 },
      { groups: [group({ vanguard: 10 }, "west", 0.55), carriers({ vanguard: 5 }, "east", 3, 4)], bonus: 50 },
      { groups: [allied("wardens", { ranger: 6 }, "midwest", 0.8), group({ vanguard: 10 }, "mideast", 0.5, 3)], bonus: 55 },
      { groups: [group({ tank: 2 }, "west", 3, 0, 1.2), group({ vanguard: 12 }, "east", 0.5, 2), carriers({ vanguard: 5 }, "midwest", 3, 6)], bonus: 60 },
      { groups: [group({ breaker: 3 }, "mideast", 1.6), group({ vanguard: 14 }, "west", 0.45, 2), allied("wardens", { ranger: 5 }, "east", 0.8, 5)], bonus: 65 },
      { groups: [carriers({ vanguard: 6 }, "west", 4, 0, 2), group({ ranger: 6 }, "east", 0.7, 2), group({ tank: 3 }, "midwest", 2.5, 5, 1.2)], bonus: 70 },
      // Wave 8: the Wardens' Walkers lead the column.
      { groups: [allied("wardens", { tank: 3 }, "midwest", 3, 0, 1.2), group({ vanguard: 16 }, "mideast", 0.45, 3), group({ vanguard: 12 }, "west", 0.5, 5)], bonus: 75 },
      { groups: [group({ tank: 4 }, "east", 2.5, 0, 1.2), group({ breaker: 3 }, "west", 1.6, 3), carriers({ vanguard: 6 }, "midwest", 4, 5, 2), allied("wardens", { ranger: 8 }, "mideast", 0.7, 4)], bonus: 80 },
      { groups: [group({ vanguard: 20 }, "west", 0.4), group({ vanguard: 20 }, "east", 0.4, 2), allied("wardens", { tank: 2 }, "midwest", 2.5, 4, 1.2), carriers({ vanguard: 6 }, "mideast", 4, 6, 2), group({ tank: 4 }, "west", 2.5, 8, 1.2)], bonus: 0 },
    ],
    camera: { x: 0, z: 0, zoom: 92, maxZoom: 124 },
  },
  objectives: [{ id: "hold", type: "waves", count: 10, text: "Hold the keystone roads for 10 waves" }],
  win: ["hold"],
  lose: [{ type: "lives" }],
  triggers: [
    { when: { time: 4 }, do: [{ say: { who: "vale", text: "Pads and fields on all three roads, Commander. Crew the basin first, and send armour where the line is thin." } }] },
    { when: { time: 16 }, do: [{ say: { who: "okoro", text: "Echo counts the quiet in waves. Ten of them, and the southern relays are tuned for good." } }] },
    { when: { waveStart: 1 }, do: [{ say: { who: "hale", text: "Meridian. Every road to the keystone is mine until my fleet is fed. Stand aside." } }, { music: "tense" }] },
    { when: { wave: 2 }, do: [{ say: { who: "okoro", text: "Two waves down and the relays hum. Keep the roads shut, Commander." } }] },
    { when: { waveStart: 4 }, do: [
      { say: { who: "vale", text: "Two Gunner teams from the Field workshop, Commander. Put them where the Scrappers bunch up." } },
      { spawn: "gunner", team: 0, at: { x: 0, z: 36 }, count: 2, exact: true },
    ] },
    { when: { waveStart: 4 }, do: [{ say: { who: "sol", text: "Warden Rangers on the north road. Gunners pin them in the open, and your crews do the rest." } }] },
    { when: { wave: 5 }, do: [{ say: { who: "okoro", text: "Halfway. A Gunner holds a whole column in place while it is shot. Nobody enjoys being pinned." } }] },
    { when: { waveStart: 8 }, do: [{ say: { who: "hale", text: "Walkers from the Wardens' yards lead this column. Bought, not borrowed. See how you like them." } }, { music: "battle" }] },
    { when: { waveStart: 8 }, do: [{ say: { who: "vale", text: "Walkers outrange a Battle tank. Anti-tank crews, and flank them with armour." } }] },
    { when: { wave: 8 }, do: [{ say: { who: "echo", text: "Eight in tune. The Lattice is tired, but it is listening. Two more." } }] },
    { when: { waveStart: 10 }, do: [{ say: { who: "vale", text: "Last wave, and everything Hale has left. Hold the basin, Commander." } }] },
  ],
  debrief: {
    win: [
      { who: "echo", text: "Ten waves, and the southern relays are in tune. The way to the keystone is open." },
      { who: "vale", text: "Hale has pulled back to the Expanse. One road left, Commander, and it is the last." },
    ],
    lose: [{ who: "vale", text: "They crossed the basin. Echo kept half of the tuning. We regroup and hold the roads again." }],
  },
  medals: { gold: { lives: 18 }, silver: { lives: 10 } },
  check: { story: 3, standard: 2, veteran: 1 },
  design: "An optional Act 3 mission under the Frontier Defence rules on Three Roads Basin, about 14 minutes: build zones, an armour cap of 2 and the commander's post (the first in the story), 20 lives, ten waves of Ashfall and Warden columns on four roads (the north road forks round the basin), troop carriers from wave 3 and a Walker-led column in wave 8. Before wave 4 two Gunner teams are lent from Meridian's Field workshop (the Gunner's story debut, outside the Expanded roster rule; they stand on Guard at the south of the basin). Intended: crews in the basin and the fields, armour on the road that needs it, the Gunners where the roads join. The mission is optional: it opens when Cut the Draw is cleared, never locks Frontier's End and counts for medals, not for endings.",
};

// The third new mission of the plan, "Wings over Copper" (`m06b-wings-over-copper`, the first air
// raid, Act 2), was reserved here until the air units (release 0.18) merged; it now sits in
// MISSIONS (src/story/missions.js) after Copper Harvest. No id is reserved any more.
export const RESERVED_IDS = [];
