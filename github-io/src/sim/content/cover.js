// H6 cover walls (HERO-COINS-PLAN.md): the match's cover pieces (src/sim/cover.js), made once and only in a match
// with a hero to fight from them. The pieces are static nav obstacles and stop the dodgeable shots aimed at the
// driven hero (sim/content/hero-mode.js); every normal RTS shot ignores them (navigation.js clearLine).
//
// Gating (measured 2026-11-28, docs/CHANGELOG.md 0.19.x "Cover walls"): pieces change the routes every unit walks,
// so a match without a hero must not have them (the golden pins and the AI benches move otherwise). They are
// placed when Skywing is called in (sim/content/skywing.js callSkywing) or Hero mode is first entered
// (setHeroMode), both logged commands or setup, so replays and saves rebuild the same pieces. The list is kept in
// the state (`sim.cover`), absent until then: a match that never has a hero saves and hashes exactly as before.
import { planCover, coverCircles, coverBlock } from "../cover.js";

export const cover = {
  id: "cover",
  mixin: {
    // Places the cover pieces (once a match). True when they were placed now.
    enableCover() {
      if (this.cover) return false;
      this.cover = planCover(this);
      this.applyCover();
      this.nav.rebuild(this.entities);
      this.events.push({ type: "cover", n: this.cover.length });
      return true;
    },
    // The nav grid's copy of the pieces (navigation is derived: a loaded save sets it again, snapshot.js).
    applyCover() {
      this.nav.cover = this.cover?.length ? coverCircles(this.cover) : null;
    },
    // The first piece a straight ground shot from a to b meets ({ t, x, z }), or null.
    coverShot(a, b) {
      return this.cover?.length ? coverBlock(this.cover, a.x, a.z, b.x, b.z) : null;
    },
  },
};
