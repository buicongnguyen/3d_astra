import { DEFINITIONS as D, distance } from "../data.js";
import { MINERS_PER_DEPOSIT } from "./constants.js";

// How far from a Command core a deposit still counts as part of that camp's own field.
const HOME_FIELD = 32;
// A second core stands at least this far from every other core.
const MIN_SPACING = 22;
// Extra Harvesters each additional core is worth.
export const EXPAND_CREW = 4;

// The computer opponent's second Command core (normal pace and faster; Relaxed stays simple).
// It follows the same rules and prices as the player: a Harvester walks to the site, the site
// must be explored, and the core costs its normal alloy price.
export const expansion = {
  // Returns true while a core is due but not yet paid for, so the caller can save the alloy.
  aiExpand(team, own, workers, hq, pace) {
    if (!pace.expandAt || this.mission || this.time < pace.expandAt || !hq || !hq.complete || this.result || hq.level < 2) return false;
    const cores = own.filter((e) => e.type === "hq");
    if (cores.length >= 2 || own.some((e) => !e.complete)) return false;
    // Saturated: every alloy deposit at home already has its miners.
    const home = this.resources.filter((r) => r.type === "alloy" && r.amount > 0 && distance(hq, r) < HOME_FIELD).length;
    if (workers.length < Math.min(pace.workers, home * MINERS_PER_DEPOSIT)) return false;
    const cores_all = this.entities.filter((e) => e.type === "hq" && e.hp > 0);
    const field = this.resources
      .filter((r) => r.amount > 0 && r.type === "alloy" && cores_all.every((c) => distance(c, r) >= 30))
      .sort((a, b) => distance(hq, a) - distance(hq, b) || a.id - b.id);
    const deposit = field.find((r) => distance(hq, r) < 40 + this.terrain.size * 0.3);
    const builder = workers.filter((w) => !w.orders.some((o) => o.type === "build")).sort((a, b) => distance(a, hq) - distance(b, hq))[0];
    if (!deposit || !builder) return false;
    // A spot between the deposit and home, close enough for short hauls.
    const dx = hq.x - deposit.x, dz = hq.z - deposit.z, len = Math.hypot(dx, dz) || 1;
    const site = this.findPlacement("hq", team, deposit.x + (dx / len) * 9, deposit.z + (dz / len) * 9, 6);
    if (site && cores_all.every((c) => distance(c, site) >= MIN_SPACING)) {
      if (!this.canPay(team, D.hq.cost)) return true;
      this.build(builder.id, "hq", site.x, site.z);
      return false;
    }
    if (!site && distance(builder, deposit) > 14) {
      // Not visible yet: send the Harvester ahead so the ground is seen, then try again.
      this.issue([builder.id], { type: "move", x: deposit.x + (dx / len) * 9, z: deposit.z + (dz / len) * 9 });
    }
    return true;
  },
};
