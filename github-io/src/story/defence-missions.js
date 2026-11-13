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
    hp: { story: 0.85, standard: 1, veteran: 1.05 },
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

// The third new mission of the plan, "Wings over Copper" (`m06b-wings-over-copper`, the first air
// raid, Act 2), was reserved here until the air units (release 0.18) merged; it now sits in
// MISSIONS (src/story/missions.js) after Copper Harvest. No id is reserved any more.
export const RESERVED_IDS = [];
