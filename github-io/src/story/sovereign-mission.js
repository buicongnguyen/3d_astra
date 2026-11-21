// "The Sovereign Walks" (AAA round 3, R3-H): the optional Act 3 boss mission. Plain mission data
// (docs/MISSIONS.md) in a file of its own, so the campaign list (src/story/missions.js) carries one
// import and one entry. The boss is `ironsovereign2` (balance.json `iron-sovereign-2`, boss engine III
// in src/sim/bosses.js): the Iron Sovereign refitted to walk. It marches on the player's Command core
// down the Expanse road (over the centre ford, then west along the south bank), stopping to fight
// whatever stands in its sights. Three Ashfall relays (tag `ward`) shield it: while one stands it
// takes 0.15x damage. At half health it plants itself for 4 s (phase 2: a rail sweep and a five-shell
// barrage, two Sentinel drones), the mission's music rises and Okoro and Hale speak.
//
// Tuning (tools/mission-check.mjs, objective bot): see docs/aaa/results/round3/h.md. The owner's rule
// for this round: winnable on every difficulty with a comfortable margin, Standard fair, never
// punishing. Hence the gentle setup: a "home" AI that never attacks on its own, one small escort with
// the Sovereign, two forward towers and a starting squad on the player's line, no time limit.
import { SCENES } from "./scenes.js";

// The Sovereign's entrance, a staged scene (format: src/story/scenes.js). It is registered here, next to
// the only mission that plays it; the integrator may move it into SCENES in src/story/scenes.js.
export const SOVEREIGN_SCENES = {
  "sovereign-walks": {
    letterbox: true,
    beats: [
      // Its gate in the north when the player has scouted it (a camera beat to an unexplored place is
      // skipped), then the line it walks on.
      { camera: { at: "gate", zoom: 0.9, seconds: 2.2 } },
      { fx: { flash: "alarm" } },
      { shake: 0.5 },
      { title: { text: "Iron Sovereign", sub: "It walks on Meridian's line" } },
      { say: { who: "okoro", text: "There it is, coming down from the Keystone. Hale gave the Sovereign legs that walk, not just legs that stand." } },
      { camera: { at: "line", zoom: 1.1, seconds: 1.8 } },
      { say: { who: "hale", text: "Meridian. My Sovereign walks to your camp, and my relays carry its shield. Nothing you own can stop it." } },
    ],
  },
};
Object.assign(SCENES, SOVEREIGN_SCENES);

export const SOVEREIGN_WALKS = {
  id: "m11d-the-sovereign-walks",
  act: 3,
  optional: true,
  title: "The Sovereign Walks",
  map: "expanse",
  enemies: 1, speed: "relaxed", alliance: "ffa",
  factions: { 1: "ashfall" },
  rules: { ai: "home", playerBase: true, enemyBase: true, rosters: true },
  briefing: {
    place: "Frontier Expanse, Meridian's forward line, day 54",
    lines: [
      { who: "okoro", text: "Commander, I have read the Keystone's traffic. Hale has refitted the Iron Sovereign, and this time it walks." },
      { who: "okoro", text: "Three Ashfall relays feed it a shield. While one of them stands, our shells barely scratch it." },
      { who: "okoro", text: "Break the relays, then break the machine. And when it is hurt, watch it. Builder machines change when they are hurt." },
    ],
    intel: [
      "The Iron Sovereign marches on your Command core. It stops to fight anything it sees on the way.",
      "Three Ashfall relays shield it: two north of the river, one south of it. Break all three first.",
      "Your forward towers slow it down: it stops to stomp them. Rebuild them if you can.",
      "At half health it changes its attacks. The ground still turns red first, so step out and keep firing.",
    ],
  },
  regions: {
    gate: { x: 21, z: -37, r: 6 },
    ford: { x: -2, z: 6, r: 7 },
    line: { x: -22, z: 18, r: 8 },
    relayWest: { x: -24, z: -30, r: 7 },
    relayEast: { x: 30, z: -12, r: 7 },
    relaySouth: { x: 10, z: 22, r: 7 },
  },
  setup: [
    // The relay crews stand at their posts from the start; the relays themselves come up with the Sovereign.
    { spawn: "vanguard", team: 1, at: { x: -21, z: -27 }, count: 3 },
    { spawn: "ranger", team: 1, at: { x: -27, z: -33 }, count: 2 },
    { spawn: "vanguard", team: 1, at: { x: 27, z: -9 }, count: 3 },
    { spawn: "ranger", team: 1, at: { x: 33, z: -15 }, count: 2 },
    { spawn: "vanguard", team: 1, at: { x: 13, z: 19 }, count: 2 },
    { spawn: "tower", team: 0, at: { x: -18, z: 24 } },
    { spawn: "tower", team: 0, at: { x: -28, z: 24 } },
    { spawn: "ranger", team: 0, at: { x: -30, z: 32 }, count: 4 },
    { spawn: "vanguard", team: 0, at: { x: -26, z: 30 }, count: 4 },
    { spawn: "antitank", team: 0, at: { x: -34, z: 34 }, count: 2 },
    { resources: { alloy: 900, energy: 350 } },
  ],
  objectives: [
    { id: "relays", text: "Break the three Ashfall relays that shield the Sovereign", type: "destroyTag", tag: "ward", hidden: true },
    { id: "sovereign", text: "Destroy the Iron Sovereign", type: "destroyTag", tag: "sovereign", hidden: true },
    { id: "towers", text: "Build two more Sentinel towers for the line", type: "build", building: "tower", count: 4, optional: true },
    { id: "fast", text: "Finish in under 16 minutes", type: "timeUnder", seconds: 960, optional: true },
  ],
  win: ["relays", "sovereign"],
  lose: [{ type: "coreLost" }],
  triggers: [
    { when: { time: 5 }, do: [{ say: { who: "vale", text: "Two towers on the line and a squad behind them, Commander. Build up while it is still far away." } }] },
    { when: { time: 90 }, do: [{ say: { who: "okoro", text: "Ashfall crews are standing at three old relay posts. Whatever they wait for, it is coming from the north." } }] },
    // A small probe at 1:40, so the line has something to do before the big walk.
    { when: { time: 100 }, do: [{ wave: { team: 1, units: { vanguard: 3, ranger: 2 }, from: "gate", target: "line" } }] },
    // At 4:40 Okoro's Kite goes up over the north road (after the probe), so the player sees the Sovereign
    // come out of its gate in the entrance scene.
    { when: { time: 280 }, do: [
      { spawn: "kite", team: 0, at: { x: 10, z: -26 }, name: "Okoro's Kite", exact: true },
      { say: { who: "okoro", text: "My Kite is over the north road. Whatever comes down it, we will see it first." } },
    ] },
    // At 5:00 the relays wake and the Sovereign comes out of the north with a small escort, and walks at once.
    { when: { time: 300 }, do: [
      { spawn: "relay", team: 1, at: "relayWest", tag: "ward", name: "Ashfall relay", hp: 4000, hpByDifficulty: { story: 3000 } },
      { spawn: "relay", team: 1, at: "relayEast", tag: "ward", name: "Ashfall relay", hp: 4000, hpByDifficulty: { story: 3000 } },
      { spawn: "relay", team: 1, at: "relaySouth", tag: "ward", name: "Ashfall relay", hp: 4000, hpByDifficulty: { story: 3000 } },
      { reveal: "relays" },
      { spawn: "ironsovereign2", team: 1, at: "gate", tag: "sovereign", exact: true, hpByDifficulty: { story: 34000, veteran: 40000 } },
      { wave: { team: 1, units: { vanguard: 4, ranger: 2 }, from: "gate", target: "line" } },
      { ping: "gate" },
      { music: "tense" },
    ] },
    { when: { time: 310 }, do: [{ say: { who: "okoro", text: "The relays woke with it. One sits south of the river, by the old pump: that one is the easy one." } }, { ping: "relaySouth" }] },
    { when: { event: "bossWake" }, do: [{ scene: "sovereign-walks" }] },
    { when: { tagHpBelow: { tag: "ward", percent: 50 } }, do: [{ say: { who: "okoro", text: "That relay is failing. When the last one goes dark, its shield goes with it." } }] },
    { when: { objective: "relays", is: "done" }, do: [
      { reveal: "sovereign" },
      { say: { who: "okoro", text: "Last relay down! Its shield is gone. Everything on the Sovereign now, Commander." } },
      { say: { who: "hale", text: "Then it walks without a shield. It has walked through worse than you." } },
    ] },
    // Phase 2 (boss engine III): at half health it plants itself, sheds two drones and changes its attacks.
    { when: { bossStage: 2 }, do: [
      { music: "battle" },
      { say: { who: "okoro", text: "It has stopped! The core is running hot. New guns, Commander: a long rail and a ring of shells." } },
      { say: { who: "vale", text: "Same rule as before. Watch the red, step out, and keep shooting." } },
      { say: { who: "hale", text: "Half a Sovereign is still a Sovereign, Commander." } },
    ] },
    { when: { tagDead: "sovereign" }, do: [
      { music: "calm" },
      { say: { who: "okoro", text: "It is down, and it will not walk again. I am sorry, old machine." } },
      { say: { who: "hale", text: "My last walker. Very well, Commander. The Keystone will decide the rest." } },
    ] },
  ],
  debrief: {
    win: [
      { who: "okoro", text: "The Sovereign fell short of our line. Its core is still warm, and I would like to keep it." },
      { who: "vale", text: "Hale has nothing that big left to send. One road left, Commander, and it ends at the Keystone." },
    ],
    lose: [{ who: "vale", text: "It walked through the camp. We pull back to the river and try again before it turns." }],
  },
  // Objective bot: Story 410 s, Standard 531 s, Veteran 547 s, all gold (docs/aaa/results/round3/h.md).
  medals: { gold: { seconds: 600 }, silver: { seconds: 840 } },
  design: "An optional Act 3 boss mission on the Frontier Expanse, about 8 to 10 minutes against one Relaxed AI that never attacks on its own (rules.ai \"home\"). The player starts with 900 alloy, two forward towers on the line west of the ford and 10 units; a 5-unit probe comes at 1:40. At 4:40 Okoro's Kite goes up over the north road, and at 5:00 the Iron Sovereign (ironsovereign2, 44000 HP, Story 34000, Veteran 40000; boss engine III: march, ward, phases) comes out of the north with a 6-unit escort and walks on the player's Command core over the centre ford, stopping to fight anything it sees (the forward towers hold it a while). With it three Ashfall relays wake (4000 HP, 3000 on Story; two north of the river with 5-unit crews, one south of it with 2) and shield it: while any stands it takes 0.15x damage. Once they fall the boss objective appears. At half health it plants itself for 4 s, drops two Sentinel drones and switches from the stomp and the three-shell spread to a rail sweep (a 24 m line) and a five-shell barrage; warnings follow the walk-out rule as always. Intended: take the south relay early, cross the ford for the other two while the towers hold the Sovereign, then fight it near the line. Optional: it opens when Cut the Draw is cleared and counts for medals, never for endings.",
};
