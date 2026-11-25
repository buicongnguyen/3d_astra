// Wave kinds for Frontier Defence (W10, Defence 6.7; docs/MISSIONS.md "Wave kinds"). A wave group may carry
// `kind: "<id>"` (src/defence/kinds.json): startWave copies it onto every spawn of the group and spawnQueued
// calls sim.applyWaveKind(e, q) on the new unit. Each kind has one readable counter:
//
//   shieldwall  shield-bearers: single shots x0.45, blasts (Mortar, Shrapnel, Cluster) x1.3. Splash or Barrage.
//   runner      fast and frail (x1.6 speed, x0.55 health). A Suppressor's slow or Reinforce on the road.
//   crawler     armoured, slow, and slows never hold it. Anti-tank and Tank posts, not Suppressors.
//   skyswarm    a cloud of light flyers. Only crews that hit air (Rangers, Anti-tank, Watchers).
//   surgeon     a tough healer that mends everyone within 6 m every 3 s. Focus it (Marksman) or Barrage it.
//   brood       on death, two broodlings (the group's vanguard slot, frail and quick) walk on. Splash or flame.
//
// State: `e.waveKind` (and `e.brood` / `e.healAt`) on the unit only, `defence.kinds` (the count) once the
// first one has spawned, `defence.broods` while broodlings wait for the next tick. A match without a kind
// never reads any of it: every hook answers at once when the target has no `waveKind`, so no pin moves.
import KINDS from "../../defence/kinds.json" with { type: "json" };

export const WAVE_KINDS = KINDS;
const FOE = 1;
const dist = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);

export const waveKinds = {
  id: "waveKinds",
  mixin: {
    // A freshly spawned wave unit becomes its kind. `q` is the queued spawn ({ kind, brood? }).
    applyWaveKind(e, q) {
      const k = KINDS[q.kind];
      if (!k || q.kind === "about") return false;
      e.waveKind = q.kind;
      if (k.hp && k.hp !== 1) { e.maxHp = Math.max(1, Math.round(e.maxHp * k.hp)); e.hp = e.maxHp; this.setBaseHp(e); }
      if (k.speed) e.speed *= k.speed;
      if (q.kind === "brood") e.brood = q.brood || "vanguard";
      if (q.kind === "surgeon") e.healAt = this.time + k.every;
      this.defence.kinds = (this.defence.kinds || 0) + 1;
      return true;
    },
    // Once a tick from stepDefence, only while a kind has spawned: broodlings step onto the road of the
    // fallen brood (after the tick's deaths), surgeons heal, and crawlers shake off any slow.
    stepWaveKinds() {
      const d = this.defence;
      if (d.broods?.length) {
        const k = KINDS.brood, list = d.broods;
        delete d.broods;
        for (const s of list) {
          for (let i = 0; i < k.count; i++) {
            const side = i - (k.count - 1) / 2;
            const kid = this.spawnOnRoute(s.type, FOE, s.route, s.leg, { x: s.x + side * k.spread * 2, z: s.z + side * k.spread });
            kid.maxHp = Math.max(1, Math.round(kid.maxHp * k.childHp));
            kid.hp = kid.maxHp;
            this.setBaseHp(kid);
            kid.speed *= k.childSpeed;
            kid.bounty_x = k.childBounty;
            kid.waveKind = "broodling";
            if (s.wave !== undefined) kid.wave = s.wave;
          }
        }
      }
      const heal = KINDS.surgeon;
      for (const e of this.entities) {
        if (!e.waveKind || e.hp <= 0) continue;
        if (e.waveKind === "crawler" && e.slowUntil !== undefined) { delete e.slowUntil; delete e.slowBy; }
        if (e.waveKind !== "surgeon" || this.time < e.healAt - 1e-9) continue;
        e.healAt = this.time + heal.every;
        for (const o of this.entities) {
          if (o === e || o.team !== FOE || o.kind !== "unit" || o.hp <= 0 || o.hp >= o.maxHp || dist(o, e) > heal.radius) continue;
          o.hp = Math.min(o.maxHp, o.hp + heal.heal);
          this.events.push({ type: "support", weapon: "medic", x: e.x, z: e.z, tx: o.x, tz: o.z, team: e.team });
        }
      }
    },
  },
  // Shield wall: single shots glance off, blasts break the wall.
  hitScale(sim, e, t) {
    if (t.waveKind !== "shieldwall") return undefined;
    const k = KINDS.shieldwall;
    return e.splash_radius ? k.blast : k.single;
  },
  onDeath(sim, t) {
    if (t.waveKind !== "brood" || !sim.defence?.kinds) return;
    const o = t.orders?.[0];
    if (o?.type !== "route") return;
    (sim.defence.broods ||= []).push({ type: t.brood, route: o.route, leg: o.leg, x: t.x, z: t.z, wave: t.wave });
  },
};
