// Enemy traits for Frontier Defence (AAA round 2, W1-F, idea D4): the chips on the wave strip and the
// "new enemy" card. Pure data and predicates, read by app/defence-ui.js; no DOM, no simulation state.
//
// APPEND-ONLY: new traits go at the end of TRAITS (W2-B adds elite affix chips there). The order of the
// list is the order the chips are drawn in.
//
// A trait is { id, label, hint, test(entry, D) }:
//   entry  a wave-preview unit ({ type, count, carry?, passengers?, elite? }; sim.wavePreview()), or
//          just { type } for a card
//   D      the unit definitions (src/data.js DEFINITIONS)
//   label  the 12 px chip text (English; Vietnamese is in src/locales/vi.json)
//   hint   one line for the chip's tooltip and the card
export const TRAITS = [
  { id: "armoured", label: "Armoured", hint: "A machine: it shrugs off small arms and shrapnel. Anti-tank and Tank posts hit it hardest.", test: (entry, D) => !!D[entry.type]?.mechanical },
  { id: "flying", label: "Flying", hint: "Only crews that hit air can shoot it: Rangers, Anti-tank and Watchers.", test: (entry, D) => !!D[entry.type]?.flying },
  { id: "cloaked", label: "Cloaked", hint: "Hidden until it is close or fires. A Watcher sees it from further away.", test: (entry, D) => !!D[entry.type]?.cloak },
  // The code says `support` (Medic, Engineer) or `heals` (Supply wagon): both mend the units around them.
  { id: "healer", label: "Healer", hint: "Mends the units around it. Shoot it first or burst the whole group.", test: (entry, D) => !!D[entry.type]?.heals || D[entry.type]?.support > 0 },
  { id: "carrier", label: "Carrier", hint: "A troop transport: it drops a squad at the end of its road. Destroy it for the squad's bounty.", test: (entry, D) => !!D[entry.type]?.carrier },
  { id: "shield", label: "Heavy shield", hint: "100 or more shield: weak shots are soaked up before the hull is hurt.", test: (entry, D) => (D[entry.type]?.shield || 0) >= 100 },
  { id: "elite", label: "Elite", hint: "A gold elite: much tougher, and worth more alloy.", test: (entry) => !!entry.elite },
  { id: "boss", label: "Boss", hint: "A boss: a huge hull and area attacks. Bring everything.", test: (entry, D) => !!D[entry.type]?.boss },
];

// Elite affix chips (AAA round 2, W2-B), kept apart from TRAITS (the order of TRAITS is pinned): one chip per
// affix on the wave strip, from entry.elite, drawn after the trait chips.
export const ELITE_TRAITS = [
  { id: "plated", label: "Plated", hint: "Elite: shield x2.5 that comes back 2 s after a hit. Pierce ranks and Anti-tank answer it.", test: (entry) => entry.elite === "plated" },
  { id: "swift", label: "Swift", hint: "Elite: 35% faster but frail. A Suppressor's slow answers it.", test: (entry) => entry.elite === "swift" },
  { id: "splitter", label: "Splitter", hint: "Elite: two more walk on from where it falls. Cluster splash answers it.", test: (entry) => entry.elite === "splitter" },
  { id: "volatile", label: "Volatile", hint: "Elite: explodes when it dies, hurting towers within 2.5 m. Range and Rim pads answer it.", test: (entry) => entry.elite === "volatile" },
  { id: "banner", label: "Banner", hint: "Elite: allies within 7 m take 20% less damage. Kill it first with a Marksman.", test: (entry) => entry.elite === "banner" },
  { id: "mender", label: "Mender", hint: "Elite: heals allies within 7 m every 6 s. A Barrage answers it.", test: (entry) => entry.elite === "mender" },
];
// The affix chips of a wave's units, in ELITE_TRAITS order, each once.
export function waveAffixes(units) {
  return ELITE_TRAITS.filter((t) => units.some((u) => t.test(u))).map((t) => t.id);
}

// The crews (garrisons.json ids) that answer a trait, best first, and what to bring against a plain
// walking unit. The card shows the first two that the level offers.
export const COUNTERS = {
  armoured: ["antitank", "tank"],
  flying: ["ranger", "antitank"],
  cloaked: ["watcher", "ranger"],
  healer: ["breaker", "ranger"],
  carrier: ["antitank", "tank"],
  shield: ["antitank", "tank"],
  elite: ["antitank", "ranger"],
  boss: ["antitank", "tank"],
  plated: ["antitank", "ranger"],
  swift: ["ranger", "breaker"],
  splitter: ["breaker", "scorcher"],
  volatile: ["ranger", "antitank"],
  banner: ["ranger", "antitank"],
  mender: ["breaker", "tank"],
};
// A unit with none of the traits above: the swarm answers by its combat class.
export const CLASS_COUNTERS = { melee: ["breaker", "scorcher"], ranged: ["breaker", "ranger"], siege: ["ranger", "tank"], antiarmor: ["ranger", "breaker"] };
const FALLBACK = ["ranger", "breaker"];
// The crews whose unit hits air (balance.json hits_air): the only answers to a flyer.
const AIR_CREWS = ["ranger", "antitank", "watcher"];

// The ids of the traits a unit has, in list order.
export function traitsOf(entry, D) {
  return TRAITS.filter((t) => t.test(entry, D)).map((t) => t.id);
}
// The union of the traits of a wave's units (a carrier's passengers count), in list order.
export function waveTraits(units, D) {
  const found = new Set();
  for (const u of units) {
    for (const id of traitsOf(u, D)) found.add(id);
    for (const type of u.passengers || []) for (const id of traitsOf({ type }, D)) found.add(id);
  }
  return TRAITS.filter((t) => found.has(t.id)).map((t) => t.id);
}
// Up to `n` crews that counter a unit, best first: from its traits in list order, then its class;
// only crews the level offers (`crews`, null for all of them).
export function counterCrews(entry, D, crews = null, n = 2) {
  const out = [], ids = traitsOf(entry, D), want = ids.flatMap((id) => COUNTERS[id] || []);
  const pool = [...want, ...(ids.length ? [] : CLASS_COUNTERS[D[entry.type]?.class] || []), ...FALLBACK];
  const air = !!D[entry.type]?.flying;
  for (const crew of pool) if (!out.includes(crew) && (!crews || crews.includes(crew)) && (!air || AIR_CREWS.includes(crew))) out.push(crew);
  return out.slice(0, n);
}
// The unit types of a wave (the real ones a group's slots resolve to, and a carrier's passengers),
// each once, in the order they come: [{ type, elite? }].
export function waveTypes(groups, resolve) {
  const out = [], seen = new Set();
  for (const g of groups || []) {
    for (const slot of [...Object.keys(g.units || {}), ...Object.keys(g.carry || {})]) {
      const type = resolve(g, slot);
      if (type && !seen.has(type)) { seen.add(type); out.push({ type }); }
    }
  }
  return out;
}

// ---------------------------------------------------------------- Wave kinds (W10, Defence 6.7)
// One chip per wave kind on the wave strip (entry.kind from sim.wavePreview(); src/defence/kinds.json), drawn
// after the affix chips, with the crews that answer it (best first) and the commander ability that does
// (`ability`: "barrage", "reinforce" or null when only crews answer it) with its one-line reason (`why`).
export const KIND_TRAITS = [
  { id: "shieldwall", label: "Shield wall", hint: "Shields turn single shots aside. Blasts break the wall: Mortars, Shrapnel and Barrage.", counters: ["breaker", "scorcher"], ability: "barrage", why: "Blasts break shield walls" },
  { id: "runner", label: "Runners", hint: "Fast and frail. Slow them with a Suppressor or block the road with Reinforce.", counters: ["ranger", "scorcher"], ability: "reinforce", why: "Block the road for runners" },
  { id: "crawler", label: "Crawler", hint: "Armoured and slow, and slows never hold it. Anti-tank and Tank posts bring it down.", counters: ["antitank", "tank"], ability: "reinforce", why: "Hold crawlers under your guns" },
  { id: "skyswarm", label: "Sky swarm", hint: "A cloud of light flyers. Only Rangers, Anti-tank and Watcher posts can hit them.", counters: ["ranger", "antitank"], ability: null, why: "" },
  { id: "surgeon", label: "Surgeon", hint: "Heals every unit within 6 m every 3 s. Shoot it first, or Barrage the group.", counters: ["ranger", "breaker"], ability: "barrage", why: "Shell the surgeon and its group" },
  { id: "brood", label: "Brood", hint: "Two broodlings walk on when it falls. Splash and flame finish them.", counters: ["breaker", "scorcher"], ability: "barrage", why: "Shell the brood as it splits" },
];
export const KIND_IDS = KIND_TRAITS.map((t) => t.id);
export const kindTrait = (id) => KIND_TRAITS.find((t) => t.id === id) || null;
// The kind chips of a wave's units, in KIND_TRAITS order, each once.
export function waveKinds(units) {
  return KIND_TRAITS.filter((t) => units.some((u) => u.kind === t.id)).map((t) => t.id);
}
// The commander ability that answers the coming wave best, for the hint tile on the wave strip:
// { ability: "barrage" | "reinforce", why } or null. A wave kind decides first (in KIND_TRAITS order),
// then the wave itself: healers or a crowd on foot call for Barrage, a column of machines for Reinforce.
export function waveAbility(units, D) {
  for (const id of waveKinds(units)) { const t = kindTrait(id); if (t.ability) return { ability: t.ability, why: t.why, kind: id }; }
  let foot = 0, mech = 0, heal = false;
  for (const u of units) {
    const d = D[u.type];
    if (!d || d.flying) continue;
    if (d.heals || d.support > 0) heal = true;
    if (d.mechanical) mech += u.count; else foot += u.count;
  }
  if (heal) return { ability: "barrage", why: "Shell the healers and their group" };
  if (foot >= 10) return { ability: "barrage", why: "Shell the crowd on the road" };
  if (mech >= 3) return { ability: "reinforce", why: "Hold the machines under your guns" };
  return null;
}
// Up to `n` crews that answer a wave kind, among those the level offers.
export function kindCrews(id, crews = null, n = 2) {
  return (kindTrait(id)?.counters || []).filter((c) => !crews || crews.includes(c)).slice(0, n);
}
