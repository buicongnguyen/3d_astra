// Campaign heroes in the story (owner-approved 2026-11-27; rules in src/sim/content/campaign-heroes.js).
// Pure data and functions, like story/squad.js: settled from the campaign progress before a match, so a
// mission plays, saves and replays the same for the same progress.
//   def.heroes      [{ id, slot }] the heroes this mission fields (spawned after its setup);
//   def.heroCache   { alloy?, energy? } the war chest a finished commander pays here, once.
// Both are set only on missions that have one, and a mission already settled comes back unchanged.
// Heroes join every main and side story mission from their first one on, except the Frontier Defence
// missions (those field the Defence commander) and Faction Chronicles (not in MISSIONS).
import { MISSIONS } from "./missions.js";
import { ALLY_HEROES } from "../sim/content/campaign-heroes.js";

const index = (id) => MISSIONS.findIndex((m) => m.id === id);
// The answer the progress holds for a surrender decision, or the decision's default (as story/choices.js answerFor).
function answer(decision, decisions) {
  const m = MISSIONS.find((x) => x.decisions?.[decision]), d = m?.decisions?.[decision];
  if (!d) return null;
  const kept = decisions?.[decision];
  return d.options.some((o) => o.id === kept) ? kept : (d.options.find((o) => o.default) || d.options[0]).id;
}

// Which heroes and which war chest a story mission gets with this progress.
export function heroesFor(def, progress = null) {
  const at = def ? index(def.id) : -1;
  if (at < 0 || def.defence || def.noCarry) return { heroes: [], cache: null };
  const heroes = [];
  let cache = null;
  for (const h of Object.values(ALLY_HEROES)) {
    const said = h.decision ? answer(h.decision, progress?.decisions) : "accept";
    if (said === "accept" && at >= index(h.from)) heroes.push({ id: h.id, slot: heroes.length });
    if (h.decision && said === "finish" && def.id === h.cacheIn) {
      cache ||= {};
      for (const [k, v] of Object.entries(h.cache)) cache[k] = (cache[k] || 0) + v;
    }
  }
  return { heroes, cache };
}

// The mission with its heroes and war chest added (the very same object when it has neither, or is settled).
// Heroes belong to a player's campaign: a mission settled without a progress record (null: the tools'
// default runs, the golden pins) fields none, so those keep playing exactly as before; the game always
// passes the record it loaded (src/campaign.js loadProgress), even an empty one.
export function carryHeroes(def, progress) {
  if (!def || !progress || def.heroes || def.heroCache) return def;
  const { heroes, cache } = heroesFor(def, progress);
  if (!heroes.length && !cache) return def;
  return { ...def, ...(heroes.length ? { heroes } : null), ...(cache ? { heroCache: cache } : null) };
}
