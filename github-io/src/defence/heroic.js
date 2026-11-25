// Heroic challenges for Frontier Defence (AAA round 2, W2-B, ideas D6 and D13). A Heroic variant is NEW
// content built from a designed level by defenceVariant(level, { variant: "heroic" }): the designed level
// itself gets no new field (plan 2.5), so everything Heroic lives here, keyed by level id.
//
// What a Heroic variant is:
//   - waves 5 to 10 of the designed level (indexes 4 to 9) at Standard scale, whatever the difficulty
//     setting: six waves, each of them harder than anything before wave 5;
//   - in each wave the two largest groups carry an elite affix from the level's table (sim/content/elites.js);
//     wave 6, the finale, is all-elite: every group except troop carriers carries one;
//   - 5 lives, a fixed starting alloy (the Standard alloy plus the spec's `alloy`), no early-call bonus;
//   - on the two Veil levels, from wave 2, one group a wave adds cloaked Stalkers (`stalkers`);
//   - an empty `finale` slot: round 3 puts a boss there with data only (a group of the boss's type that
//     joins the last wave), without touching this builder.
// The tuning knobs, per level: `alloy`, `every` (1 = the whole group is elite, 2 = every second unit, and
// so on; one number per wave),  (the same per affix, the wider of the two wins) and `stalkers` (the Stalker counts, one per wave from wave 2). Nothing else
// about the designed waves is touched.
export const HEROIC_FROM = 4, HEROIC_WAVES = 6, HEROIC_LIVES = 5;

// One spec per level. `stalkers: [w2, w3, w4, w5, w6]` are the group sizes at Standard scale: a size of
// 1 spawns 2 Stalkers and 2 spawns 3 (units of pop 2 round up at the Standard 1.3 scale).
export const HEROIC = {
  "d-gorge": { affixes: ["plated","swift"], alloy: 4400, every: [1, 1, 1, 1, 1, 1], everyOf: { plated: 3, swift: 3 }, stalkers: null, finale: null },
  "d-bridges": { affixes: ["swift","volatile"], alloy: 2600, every: [1, 1, 1, 1, 1, 1], everyOf: { swift: 2, volatile: 3 }, stalkers: null, finale: null },
  "d-switchback": { affixes: ["banner","mender"], alloy: 400, every: [1, 1, 1, 1, 1, 1], everyOf: {}, stalkers: null, finale: null },
  "d-fordwood": { affixes: ["splitter","swift"], alloy: 2600, every: [1, 1, 1, 1, 1, 1], everyOf: { splitter: 6, volatile: 3, plated: 2, swift: 2 }, stalkers: null, finale: null },
  "d-canyon": { affixes: ["plated","banner"], alloy: 2600, every: [1, 1, 1, 1, 1, 1], everyOf: { splitter: 6, volatile: 3, plated: 2, swift: 2 }, stalkers: [1, 1, 1, 2, 2], finale: null },
  "d-longcrossing": { affixes: ["volatile","splitter"], alloy: 2600, every: [1, 1, 1, 1, 1, 1], everyOf: { splitter: 6, volatile: 3, plated: 2, swift: 2 }, stalkers: [1, 1, 1, 2, 2], finale: null },
  "d-crossroads": { affixes: ["mender","plated","banner"], alloy: 2600, every: [1, 1, 1, 1, 1, 1], everyOf: { splitter: 6, volatile: 3, plated: 2, swift: 2 }, stalkers: null, finale: null },
  // W10: the three maps of Defence 6.7 (their waves carry wave kinds as well as the elite affixes).
  "d-fork": { affixes: ["plated","volatile"], alloy: 2600, every: [1, 1, 1, 1, 1, 1], everyOf: { splitter: 6, volatile: 3, plated: 2, swift: 2 }, stalkers: null, finale: null },
  "d-serpent": { affixes: ["swift","mender"], alloy: 2600, every: [1, 1, 1, 1, 1, 1], everyOf: { splitter: 6, volatile: 3, plated: 2, swift: 2 }, stalkers: null, finale: null },
  "d-kingfisher": { affixes: ["banner","plated"], alloy: 2600, every: [1, 1, 1, 1, 1, 1], everyOf: { splitter: 6, volatile: 3, plated: 2, swift: 2 }, stalkers: null, finale: null },
};

export const hasHeroic = (id) => Object.hasOwn(HEROIC, id);
const total = (g) => Object.values(g.units).reduce((a, b) => a + b, 0);
const standard = (table) => (table && typeof table === "object" ? table.standard : table);
// A per-difficulty table that says the Standard value for every difficulty (Heroic ignores the setting).
const flat = (table) => (table && typeof table === "object" ? { story: table.standard, standard: table.standard, veteran: table.standard } : table);
const flying = (g) => Object.keys(g.units).every((slot) => ["kite", "balloon", "glider"].includes(slot));

// The wave of the designed level at index HEROIC_FROM + k with its elites and its Stalker group.
function buildWave(level, spec, k) {
  const source = level.defence.waves[HEROIC_FROM + k], affixes = spec.affixes, every = spec.every?.[k] ?? 1;
  const groups = source.groups.map((g) => ({ ...g, units: { ...g.units }, ...(g.carry ? { carry: { ...g.carry } } : {}) }));
  const pick = (affix, g) => (affix === "splitter" && flying(g) ? affixes.find((a) => a !== "splitter") : affix);
  if (k === HEROIC_WAVES - 1) {
    // The finale: every group but the troop carriers.
    let n = 0;
    for (const g of groups) if (!g.carry) g.mods = { elite: pick(affixes[n++ % affixes.length], g) };
  } else {
    // The two largest groups (ties: the earlier group), each with its own affix; they take turns down the table.
    const order = groups.map((g, i) => ({ g, i })).filter(({ g }) => !g.carry).sort((a, b) => total(b.g) - total(a.g) || a.i - b.i).slice(0, 2);
    order.forEach(({ g }, rank) => { g.mods = { elite: pick(affixes[(k + rank) % affixes.length], g) }; });
  }
  // A group carries its own spacing: the wave's, or the affix's own when that is wider (a Splitter on a swarm).
  for (const g of groups) if (g.mods) { const n = Math.max(every, spec.everyOf?.[g.mods.elite] ?? 1); if (n > 1) g.mods.every = n; }
  // Veil levels: cloaked Stalkers walk with the column from wave 2 (k = 1).
  const stalkers = spec.stalkers?.[k - 1];
  if (stalkers) {
    const routes = Object.keys(level.defence.routes), route = routes[(k - 1) % routes.length];
    groups.push({ units: { stalker: stalkers }, route, every: 1.4, delay: 3 });
  }
  // Round 3: the finale slot. A boss group (spec.finale) joins the last wave.
  if (k === HEROIC_WAVES - 1 && spec.finale) groups.push({ ...spec.finale });
  return { groups, bonus: source.bonus };
}

// The Heroic variant of `level`: new content, so it may carry new fields (`variant`, `look`, `heroic`).
// `extra` is what defenceVariant adds to every variant (the perks owned).
export function heroicLevel(level, extra = {}) {
  const spec = HEROIC[level.id], d = level.defence;
  const waves = Array.from({ length: HEROIC_WAVES }, (_, k) => buildWave(level, spec, k));
  return {
    ...level,
    variant: "heroic",
    look: "dusk",
    briefing: {
      place: level.briefing.place,
      text: "Heroic: six hard waves. Gold-ringed elites carry an affix, and the last wave is all elite. Five lives and a fixed stock of alloy.",
      tip: "Read the chip on the wave strip: each affix has a crew that answers it.",
    },
    defence: {
      ...d,
      ...extra,
      lives: HEROIC_LIVES,
      alloy: standard(d.alloy) + spec.alloy,
      count: flat(d.count),
      ...(d.hp ? { hp: flat(d.hp) } : {}),
      noCallBonus: true,
      waves,
      heroic: { affixes: [...spec.affixes], from: HEROIC_FROM + 1, finale: spec.finale },
    },
    objectives: [{ id: "hold", type: "waves", count: HEROIC_WAVES, text: `Hold the Heroic ${HEROIC_WAVES} waves` }],
    medals: {},
  };
}
