// W9 side missions (campaign C6, 2026-11-26): four optional missions that bring the C6 set to eight (Gun Hill,
// Crown Hill, Mirror Lake and Canyon Run came first). Each one opens after the mission before it, never locks the
// next story mission and never counts toward an ending (`optional`, src/campaign.js), and each one has its own
// kind of objective: a quick collect (Loose Crystal), an air strike on tagged moorings (Hawk Wing), a night hold
// of two of three relays (The Long Night) and an escort of water wagons (The Water Road).
//
// Lands: every mission is fought on an existing map for now. `land` names the kind of ground the mission is
// written for, so a mission can move to a new land (snow, volcano, islands) when one exists without a rewrite of
// its story; only `map`, the regions and the spawn spots would change. Format: docs/MISSIONS.md.

// Act 1, after The Ashen Line: a short economy chapter (about four minutes) for a short sitting.
export const LOOSE_CRYSTAL = {
  id: "m03b-loose-crystal",
  act: 1,
  optional: true,
  title: "Loose Crystal",
  map: "classic",
  land: "ash plain",
  enemies: 1, speed: "relaxed", alliance: "ffa",
  factions: { 1: "ashfall" },
  rules: { ai: "home", playerBase: true, enemyBase: true, rosters: true },
  bonus: { alloy: 200, energy: 50, tower: true },
  briefing: {
    place: "Ashen Frontier, day 11",
    lines: [
      { who: "vale", text: "Hale's siphons are down. Their last crystal lies loose on the ash." },
      { who: "okoro", text: "Two siphon wrecks still glow. Stand in their circles and they pay alloy." },
      { who: "vale", text: "His salvage crews want it too. Bank the quota before they do." },
    ],
    intel: [
      "Bank 4500 alloy. Harvester deliveries and the two wreck circles both count.",
      "More Harvesters is the fast way. A Supply relay lets you field more of them.",
      "Hale sends two small salvage raids. Keep a guard by the Harvesters.",
    ],
  },
  regions: {
    wreckWest: { x: -34, z: -4, r: 7 },
    wreckSouth: { x: 0, z: 30, r: 7 },
    siphonStump: { x: -16, z: 14, r: 5 },
    eastRoad: { x: 14, z: -6, r: 6 },
  },
  setup: [
    { spawn: "worker", team: 0, at: { x: -30, z: 28 }, count: 3 },
    { capturePoint: "wreckWest", label: "West siphon wreck", gives: { alloy: 3 } },
    { capturePoint: "wreckSouth", label: "South siphon wreck", gives: { alloy: 3 } },
    // Ashfall salvage crews on the far wreck (a garrison: they guard their spot).
    { spawn: "vanguard", team: 1, at: { x: 4, z: 32 }, count: 2 },
  ],
  objectives: [
    { id: "quota", text: "Bank 4500 alloy", type: "collect", alloy: 4500 },
    { id: "wreck", text: "Hold the west siphon wreck for 45 seconds", type: "hold", points: ["wreckWest"], need: 1, seconds: 45, optional: true },
    { id: "fast", text: "Finish in under 6 minutes", type: "timeUnder", seconds: 360, optional: true },
  ],
  win: ["quota"],
  lose: [{ type: "coreLost" }, { type: "time", seconds: 720 }],
  triggers: [
    { when: { time: 4 }, do: [{ say: { who: "vale", text: "Harvesters first. Then claim the west wreck." } }, { ping: "wreckWest" }] },
    { when: { pointOwned: { point: "wreckWest", team: 0 } }, do: [{ say: { who: "okoro", text: "The wreck is paying! Loose crystal, still warm." } }] },
    { when: { time: 100 }, do: [
      { say: { who: "hale", text: "That crystal was cut by my crews. Return it." } },
      { wave: { team: 1, units: { vanguard: 3 }, from: "eastRoad", target: "wreckWest" } },
    ] },
    { when: { time: 190 }, do: [
      { say: { who: "vale", text: "Second salvage crew, heading for our Harvesters." } },
      { wave: { team: 1, units: { vanguard: 3, ranger: 2 }, from: "eastRoad", target: "playerBase" } },
    ] },
    { when: { objective: "quota", is: "done" }, do: [{ music: "calm" }, { scene: "grey-crystal" }] },
  ],
  debrief: {
    win: [
      { who: "okoro", text: "Grey crystal near a dead siphon, bright crystal near our relay. I will write that down." },
      { who: "vale", text: "The quota is in. Next, the dunes: Sunward wants the same water we do." },
    ],
    lose: [{ who: "vale", text: "The salvage crews got there first. There will be other wrecks, Commander." }],
  },
  medals: { gold: { seconds: 280 }, silver: { seconds: 400 } },
  design: "An optional Act 1 side mission (W9, campaign C6 'quick chapter'), about 4 to 5 minutes on the Ashen Frontier (objective bot 4:27) against a home-ruled Relaxed Ashfall AI. Collect: bank 4500 alloy (deliveries plus two capture points that pay 3 alloy a second). Two small salvage raids (3 Scrappers at 1:40 for the west wreck, 5 units at 3:10 for the camp). The quota triggers the end scene grey-crystal: crystal by the fallen siphon has gone grey (it foreshadows m06: a live relay grows crystal, a drained one does not).",
};

// Act 2, after Gun Hill: the first mission with the player's own Hawks; Ashfall answers with Anti-tank crews.
export const HAWK_WING = {
  id: "m06d-hawk-wing",
  act: 2,
  optional: true,
  title: "Hawk Wing",
  map: "steppe",
  land: "open grassland",
  enemies: 1, speed: "relaxed", alliance: "ffa",
  factions: { 1: "ashfall" },
  rules: { ai: false, playerBase: false, enemyBase: true, rosters: true, air: true },
  briefing: {
    place: "Open Steppe, day 33",
    lines: [
      { who: "okoro", text: "I rebuilt three Hawk gunships from the balloons we shot down. They fly today." },
      { who: "vale", text: "Hale moors his Ember balloons on the steppe. Break the three moorings and the raids stop." },
      { who: "vale", text: "No base, Commander. What you have is what you bring home." },
    ],
    intel: [
      "Destroy the three balloon moorings. Hawks hit them hard from the air.",
      "Anti-tank crews guard every mooring, and they shoot flyers. Send ground troops at them first.",
      "Medics heal people, not Hawks. Pull a hurt Hawk back before it falls.",
    ],
  },
  regions: {
    start: { x: -48, z: 48, r: 7 },
    mooringWest: { x: -36, z: -20, r: 7 },
    mooringNorth: { x: 4, z: -44, r: 7 },
    mooringEast: { x: 40, z: 6, r: 7 },
  },
  setup: [
    { spawn: "hawk", team: 0, at: { x: -50, z: 50 }, count: 3, exact: true, tag: "wing" },
    { spawn: "vanguard", team: 0, at: { x: -46, z: 46 }, count: 6, tag: "squad" },
    { spawn: "ranger", team: 0, at: { x: -48, z: 44 }, count: 4, tag: "squad" },
    { spawn: "medic", team: 0, at: { x: -52, z: 46 }, count: 2, tag: "squad" },
    { spawn: "relay", team: 1, at: "mooringWest", tag: "mooring", name: "Balloon mooring", hp: 4000 },
    { spawn: "relay", team: 1, at: "mooringNorth", tag: "mooring", name: "Balloon mooring", hp: 4000 },
    { spawn: "relay", team: 1, at: "mooringEast", tag: "mooring", name: "Balloon mooring", hp: 4000 },
    { spawn: "antitank", team: 1, at: { x: -38, z: -14 }, count: 2, exact: true },
    { spawn: "vanguard", team: 1, at: { x: -30, z: -24 }, count: 2 },
    { spawn: "tower", team: 1, at: { x: -40, z: -26 } },
    { spawn: "antitank", team: 1, at: { x: 0, z: -40 }, count: 2, exact: true },
    { spawn: "ranger", team: 1, at: { x: 8, z: -40 }, count: 3 },
    { spawn: "tower", team: 1, at: { x: 0, z: -48 } },
    { spawn: "antitank", team: 1, at: { x: 38, z: 2 }, count: 2, exact: true },
    { spawn: "vanguard", team: 1, at: { x: 44, z: 2 }, count: 3 },
  ],
  objectives: [
    { id: "moorings", text: "Destroy the three balloon moorings", type: "destroyTag", tag: "mooring" },
    { id: "fast", text: "Finish in under 7 minutes", type: "timeUnder", seconds: 420, optional: true },
  ],
  win: ["moorings"],
  lose: [{ type: "armyLost" }, { type: "time", seconds: 900 }],
  triggers: [
    { when: { time: 2 }, do: [{ scene: "hawks-rise" }, { ping: "mooringWest" }, { music: "tense" }] },
    { when: { enter: "mooringWest", team: 0 }, do: [{ say: { who: "okoro", text: "Anti-tank crews! Keep the Hawks back a moment." } }] },
    { when: { time: 90 }, do: [
      { say: { who: "hale", text: "Gunships over my moorings. Crews, aim up." } },
      { wave: { team: 1, units: { antitank: 2, vanguard: 2 }, from: "enemyBase", target: "mooringWest" } },
    ] },
    // More crews every 80 s while a mooring stands (a wave from a fallen camp is refused).
    { when: { time: 170 }, repeat: 80, do: [{ wave: { team: 1, units: { antitank: 1, vanguard: 2 }, from: "enemyBase", target: "mooringNorth" } }] },
    { when: { time: 260 }, do: [
      { say: { who: "vale", text: "An Ember balloon is up. Hawks, take it." } },
      { wave: { team: 1, units: { balloon: 1 }, from: "enemyBase", target: "start" } },
    ] },
    { when: { tagHpBelow: { tag: "wing", percent: 40 } }, do: [{ say: { who: "okoro", text: "A Hawk is smoking! Pull it back!" } }] },
    { when: { objective: "moorings", is: "done" }, do: [{ music: "calm" }, { say: { who: "vale", text: "All three moorings down. The sky is ours today." } }] },
  ],
  debrief: {
    win: [
      { who: "okoro", text: "Three Hawks out, three Hawks home. Anti-tank crews hate them; Vanguards hate Anti-tank crews." },
      { who: "vale", text: "Hale's balloons are grounded. He will have to come at the basin by road." },
    ],
    lose: [{ who: "vale", text: "The crews shot the wing down. Next time the ground troops go in first." }],
  },
  medals: { gold: { seconds: 200 }, silver: { seconds: 290 } },
  design: "An optional Act 2 side mission (W9, campaign C6 'air mission'), about 3 to 5 minutes on Open Steppe with no base and no AI (objective bot 2:30-3:10). The player has 3 Hawk gunships, 6 Vanguards, 4 Rangers and 2 Medics; three balloon moorings (4000 HP relays, tag mooring) spread over the steppe are each guarded by 2 Anti-tank crews (they hit flyers) and 2 or 3 fighters, the west and north ones by a tower too. Lesson by play: close in with the cheap Vanguards on the Anti-tank crews, then let the Hawks break the moorings. Scripted: 2 Anti-tank and 2 Scrappers at 1:30, one Anti-tank and 2 Scrappers every 80 s from 2:50, one Ember balloon at 4:20. Opening scene hawks-rise.",
};

// Act 2, after The Quiet Vault: a night hold (the plan's 'night mission'), seen by the glow of the relays.
export const LONG_NIGHT = {
  id: "m08b-the-long-night",
  act: 2,
  optional: true,
  title: "The Long Night",
  map: "heartland",
  land: "night grassland",
  look: "night",
  enemies: 1, speed: "relaxed", alliance: "ffa",
  factions: { 1: "ashfall" },
  rules: { ai: "home", playerBase: true, enemyBase: true, rosters: true },
  bonus: { alloy: 300, energy: 100, tower: true },
  briefing: {
    place: "Golden Heart, night 39",
    lines: [
      { who: "echo", text: "This one needs three relays lit tonight, to count the whole circuit." },
      { who: "vale", text: "Two will do if they stay lit. Hale's crews will come for the light." },
    ],
    intel: [
      "Hold two of the three relays for 2:30. Stand units in a circle to light it.",
      "At night a lit relay can be seen from far away. Expect raids on the circles.",
      "The middle relay has an Ashfall guard. The west and south ones are free.",
    ],
  },
  regions: {
    relayWest: { x: -40, z: 4, r: 7 },
    relaySouth: { x: -4, z: 40, r: 7 },
    relayMid: { x: -6, z: -6, r: 7 },
    eastRoad: { x: 30, z: -20, r: 7 },
  },
  setup: [
    { spawn: "worker", team: 0, at: { x: -48, z: 46 }, count: 2 },
    { resources: { alloy: 600, energy: 200 } },
    { capturePoint: "relayWest", label: "West relay", gives: { energy: 1 } },
    { capturePoint: "relaySouth", label: "South relay", gives: { energy: 1 } },
    { capturePoint: "relayMid", label: "Middle relay", gives: { energy: 1 } },
    { spawn: "vanguard", team: 1, at: { x: -2, z: -10 }, count: 3 },
    { spawn: "ranger", team: 1, at: { x: -8, z: -12 }, count: 2 },
  ],
  objectives: [
    { id: "lights", text: "Hold two relays for 2:30", type: "hold", points: ["relayWest", "relaySouth", "relayMid"], need: 2, seconds: 150 },
    { id: "all", text: "Light all three relays at once", type: "hold", points: ["relayWest", "relaySouth", "relayMid"], need: 3, seconds: 5, optional: true },
    { id: "fast", text: "Finish in under 9 minutes", type: "timeUnder", seconds: 540, optional: true },
  ],
  win: ["lights"],
  lose: [{ type: "coreLost" }, { type: "time", seconds: 1080 }],
  triggers: [
    { when: { time: 4 }, do: [{ say: { who: "vale", text: "West and south relays are close. Light them." } }, { ping: "relayWest" }, { ping: "relaySouth" }] },
    { when: { pointOwned: { point: "relayWest", team: 0 } }, do: [{ scene: "first-light-at-night" }] },
    { when: { pointOwned: { point: "relaySouth", team: 0 } }, do: [{ say: { who: "echo", text: "Two lights. The count is climbing." } }] },
    { when: { time: 150 }, do: [
      { music: "tense" },
      { wave: { team: 1, units: { vanguard: 3, ranger: 2 }, from: "eastRoad", target: "relaySouth" } },
    ] },
    { when: { time: 270 }, do: [
      { say: { who: "vale", text: "Raiders by the glow. Both circles, hold!" } },
      { wave: { team: 1, units: { vanguard: 4, ranger: 2, breaker: 1 }, from: "eastRoad", target: "relayWest" } },
    ] },
    { when: { time: 390 }, do: [{ wave: { team: 1, units: { vanguard: 3, ranger: 3 }, from: "eastRoad", target: "relaySouth" } }] },
    { when: { objective: "all", is: "done" }, do: [{ say: { who: "echo", text: "Three lights! Forty relays answer. This one sees far." } }] },
    { when: { objective: "lights", is: "done" }, do: [{ music: "calm" }, { say: { who: "echo", text: "Counted. Every line runs to the Keystone." } }] },
  ],
  debrief: {
    win: [
      { who: "echo", text: "One hundred and eight relays, and every line meets at the Keystone. Hale is already on his way." },
      { who: "vale", text: "Then so are we. Sol has left the Pact, Commander. She is asking for help." },
    ],
    lose: [{ who: "vale", text: "The lights went out before the count was done. ECHO says it will wait for the next night." }],
  },
  medals: { gold: { seconds: 340 }, silver: { seconds: 480 } },
  design: "An optional Act 2 side mission (W9, campaign C6 'night mission'), about 5 to 7 minutes on Golden Heart at night (look: night; objective bot 4:50-6:00). Hold two of three capture relays for 2:30 against a home-ruled Relaxed Ashfall AI whose scripted raids (5 at 2:30, 7 at 4:30, 6 at 6:30) go for the lit circles. The middle relay has a 5-unit garrison. Optional: light all three at once. Scene first-light-at-night when the west relay is first lit.",
};

// Act 3, after A Debt in the Dunes: Sol's water wagons across Dry Reach, with the Wardens on the road.
export const WATER_ROAD = {
  id: "m09b-the-water-road",
  act: 3,
  optional: true,
  title: "The Water Road",
  map: "dryreach",
  land: "desert",
  enemies: 1, speed: "relaxed", alliance: "ffa",
  factions: { 1: "wardens" },
  rules: { ai: false, playerBase: false, enemyBase: true, rosters: true },
  briefing: {
    place: "Dry Reach, day 43",
    lines: [
      { who: "sol", text: "My east wells ran dry the week Hale took the Keystone key. I have three wagons of water for them." },
      { who: "vale", text: "Hale's Wardens watch the south road. We ride with the wagons, Commander. No base today." },
    ],
    intel: [
      "Bring the water wagons to the south cistern, then on to the east wells. If every wagon is lost, the mission fails.",
      "Warden drones and a tower hold the road. Clear each post before the wagons roll up.",
      "Medics heal the wagon drivers. Wagons cannot fight.",
    ],
  },
  regions: {
    start: { x: -64, z: 60, r: 7 },
    westPost: { x: -30, z: 56, r: 7 },
    midPost: { x: 2, z: 54, r: 7 },
    cistern: { x: 8, z: 68, r: 7 },
    eastPost: { x: 40, z: 34, r: 7 },
    wells: { x: 62, z: 8, r: 8 },
  },
  setup: [
    { spawn: "wagon", team: 0, at: "start", count: 3, tag: "water", name: "Water wagon", hp: 900, hpByDifficulty: { story: 1200 }, speed: 1.1, exact: true },
    { spawn: "rider", team: 0, at: { x: -58, z: 56 }, count: 4, tag: "sunward", exact: true },
    { spawn: "vanguard", team: 0, at: { x: -60, z: 54 }, count: 4, tag: "squad" },
    { spawn: "ranger", team: 0, at: { x: -64, z: 54 }, count: 3, tag: "squad" },
    { spawn: "medic", team: 0, at: { x: -66, z: 56 }, count: 2, tag: "squad" },
    { spawn: "breaker", team: 0, at: { x: -68, z: 60 }, count: 1, tag: "squad" },
    { spawn: "drone", team: 1, at: "westPost", count: 3, exact: true },
    { spawn: "tower", team: 1, at: { x: 4, z: 58 } },
    { spawn: "vanguard", team: 1, at: "midPost", count: 3 },
    { spawn: "drone", team: 1, at: { x: -2, z: 52 }, count: 2, exact: true },
    { spawn: "vanguard", team: 1, at: "eastPost", count: 3 },
    { spawn: "ranger", team: 1, at: { x: 42, z: 30 }, count: 2 },
    { spawn: "tower", team: 1, at: { x: 46, z: 30 } },
    { spawn: "drone", team: 1, at: "wells", count: 2, exact: true },
  ],
  objectives: [
    { id: "cistern", text: "Bring the water wagons to the south cistern", type: "escort", tag: "water", to: "cistern" },
    { id: "water", text: "Bring the water wagons on to the east wells", type: "escort", tag: "water", to: "wells", hidden: true },
    { id: "fast", text: "Finish in under 8 minutes", type: "timeUnder", seconds: 480, optional: true },
  ],
  win: ["cistern", "water"],
  lose: [{ type: "armyLost" }, { type: "tagLost", tag: "water" }, { type: "time", seconds: 1080 }],
  triggers: [
    { when: { time: 4 }, do: [{ say: { who: "sol", text: "Three wagons, one road. Clear it ahead of us." } }, { ping: "westPost" }, { music: "tense" }] },
    { when: { enter: "midPost", team: 0 }, do: [
      { say: { who: "hale", text: "Wardens, hold the road. No water passes." } },
      { wave: { team: 1, units: { vanguard: 3, drone: 2 }, from: "enemyBase", target: "midPost" } },
    ] },
    { when: { time: 200 }, do: [
      { say: { who: "vale", text: "A Warden patrol from the north. Guard the wagons." } },
      { wave: { team: 1, units: { vanguard: 2, drone: 2 }, from: "enemyBase", target: "eastPost" } },
    ] },
    { when: { time: 300 }, repeat: 90, do: [{ wave: { team: 1, units: { vanguard: 2, drone: 1 }, from: "enemyBase", target: "wells" } }] },
    { when: { objective: "cistern", is: "done" }, do: [
      { say: { who: "sol", text: "The cistern is full. Now the east wells!" } },
      { reveal: "water" }, { ping: "wells" },
      { wave: { team: 1, units: { vanguard: 3, drone: 2 }, from: "enemyBase", target: "eastPost" } },
    ] },
    { when: { tagHpBelow: { tag: "water", percent: 50 } }, do: [{ say: { who: "sol", text: "A wagon is leaking! Medics, please!" } }] },
    { when: { enter: "eastPost", team: 0 }, do: [{ say: { who: "sol", text: "I can see the well towers. Almost home." } }] },
    { when: { objective: "water", is: "done" }, do: [{ music: "calm" }, { scene: "water-road" }] },
  ],
  debrief: {
    win: [
      { who: "sol", text: "Three wagons in, and the east gardens drink tonight. The Caravan will remember this road, Commander." },
      { who: "vale", text: "The Wardens fall back to the highlands. That is where Hale is going too." },
    ],
    lose: [{ who: "sol", text: "The water is in the sand. We will try again at night, when the drones sleep." }],
  },
  medals: { gold: { seconds: 200 }, silver: { seconds: 290 } },
  design: "An optional Act 3 side mission (W9, campaign C6 'escort'), about 3 to 5 minutes on Dry Reach with no base and no AI (objective bot 2:55). Three Sunward water wagons (900 HP, Story 1200, slow) cross the south road from the west to the south cistern, then turn north-east to the east wells. Three Warden posts hold the road (3 Drones; a tower, 3 Wardens and 2 Drones; 3 Wardens and 2 Drones); a 5-unit counter comes when the squad reaches the middle post, a 4-unit patrol at 3:20, 5 more when the cistern is full and 3 every 90 s from 5:00. The player has 4 Sunward Riders, 4 Vanguards, 3 Rangers, 2 Medics and a Breaker. End scene water-road.",
};
