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
export const RULE_OPTIONS = [
  {
    id: "roster",
    label: "Roster",
    help: "Expanded gives every faction a workshop for new signature units.",
    values: [{ id: "classic", label: "Classic" }, { id: "expanded", label: "Expanded" }],
    default: "classic",
    badge: "New",
  },
];
