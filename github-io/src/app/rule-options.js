// Skirmish battle rules (AAA round 2): the choices of the "Battle rules" row on the setup screen.
// Each one becomes a key of the Simulation's `rules` option when it differs from its default
// (src/main.js createSim passes only those, for a skirmish only; the sim reads them with
// sim.ruleOn(id), src/sim/content.js), so a match with every rule at its default is exactly the
// match it was before the rule existed.
//
// { id, label, help, values: [{ id, label }], default, badge? }
// `help` is one short line under the segmented control; `badge` ("New") marks a rule the player has
// not seen yet. Every label and help line needs its Vietnamese in src/locales/vi.json.
// APPEND-ONLY: add new rules at the end, never edit or reorder the ones above.
// To change a default for new setups (the owner's decision O1 for the roster), change the
// `default` here: the sim's own default and every bench stay Classic.
import BALANCE from "../balance.json" with { type: "json" };

export const RULE_OPTIONS = [
  {
    id: "roster",
    label: "Roster",
    help: "Expanded gives every faction a workshop for new signature units.",
    values: [{ id: "classic", label: "Classic" }, { id: "expanded", label: "Expanded" }],
    default: "classic",
    badge: "New",
  },
  {
    id: "aiPlan",
    label: "AI plan",
    help: "Field command fields tanks and flyers and defends every core.",
    values: [{ id: "classic", label: "Classic" }, { id: "field", label: "Field command" }],
    default: "classic",
    badge: "New",
  },
  // Army size (AAA round 3, R3-C; owner decision O2): 100 stays the default (no rule key), 150 for
  // any device, 200 for desktop only (`desktop: true` hides the button on touch devices, app/briefing.js).
  {
    id: "pop",
    label: "Army size",
    help: "The supply cap for every side. 200 is for desktop only.",
    values: [{ id: "100", label: "100" }, { id: "150", label: "150" }, { id: "200", label: "200", desktop: true }],
    default: "100",
    badge: "New",
  },
  // Wild frontier (AAA round 4, P1 desert test): a Weather Spire and a Dune Wyrm nest. Off is the default
  // (no rule key, so every pin stays); the sim only plays it on a Wild land (P1: Amber Dunes,
  // balance.json `wild_frontier.lands`), and `maps` greys the row out on any other battlefield.
  {
    id: "wild",
    label: "Wild frontier",
    help: "Dry lands: hold the Weather Spire for a Sandstorm; tame the Dune Wyrm.",
    values: [{ id: "off", label: "Off" }, { id: "on", label: "On" }],
    default: "off",
    badge: "New",
    // Every Wild land (roster 2026-11-24: Amber Dunes, Dry Reach, Golden Heart and Copper Basin).
    maps: Object.keys(BALANCE.wild_frontier.lands),
  },
];
