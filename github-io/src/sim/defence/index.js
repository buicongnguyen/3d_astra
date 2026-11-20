
// Frontier Defence (release 0.17, completed in 0.21): enemy waves walk fixed routes while the
// player crews towers on fixed pads. Everything this mode keeps is in `this.defence`, created
// only when the mission definition has a `defence` block, so every other match serializes (and
// hashes) exactly as before. Mixed into Simulation (see simulation.js); split into src/sim/defence/* in AAA round 2 (CW-A).
// Format: docs/MISSIONS.md ("Frontier Defence levels").
//
// 0.21 adds, each only when the defence block asks for it (older blocks play exactly as before):
//  - tier-3 branches (`padBranch`), stored on the tower as `branch`;
//  - the commander (`commander: {x, z}`): one hero unit with Barrage and Reinforce, respawning;
//  - bridge demolition (`bridges: true`): `this.crossings`, created lazily, re-applied on load;
//    `bridger` groups build a pontoon over a blown crossing; waves reroute by `crossings`;
//  - mixed-faction waves: a group's `faction` resolves its slots with that faction's roster;
//  - endless waves (`endless: {seed}`), generated forever from the seed (endlessWave in ./waves.js);
//  - perks (`perks: [...]`, set only by the Defence menu, never by a campaign mission).
import GARRISONS from "../../defence/garrisons.json" with { type: "json" };
import { towers } from "./towers.js";
import { waves } from "./waves.js";
import { route } from "./route.js";
import { commander } from "./commander.js";
import { armour } from "./armour.js";
import { crossings } from "./crossings.js";

export { GARRISONS };
export { seeded, seedOf, endlessWave } from "./waves.js";
export { starsFor } from "./common.js";
// The Defence mixin, built in the original key order of the single-file version (towers, waves,
// route, commander, armour, crossings and the result): where two methods share a name the later
// one wins, so the order is pinned by tests/mixins.test.js.
export const defence = { ...towers, ...waves, ...route, ...commander, ...armour, ...crossings };
