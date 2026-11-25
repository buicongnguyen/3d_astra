// Owner 2026-11-26: "AI sometimes builds Engineers and Medics even when it has no Breakers or soldiers".
// A computer side trains a support unit only with patients for it (sim/ai-census.js aiSupportUseful).
import test from "node:test";
import assert from "node:assert/strict";
import { Simulation } from "../src/simulation.js";

const unit = (type, mechanical = false, damage = 10) => ({ type, mechanical, damage, kind: "unit" });

test("aiSupportUseful: Medics need 3 infantry each, Engineers 2 vehicles each, the wagon 3 fighters", () => {
  const s = new Simulation({ map: "classic", aiSpeed: "normal" });
  assert.equal(s.aiSupportUseful(1, [], "medic"), false);
  assert.equal(s.aiSupportUseful(1, [], "engineer"), false);
  const inf = [unit("vanguard"), unit("ranger"), unit("ranger")];
  assert.equal(s.aiSupportUseful(1, inf, "medic"), true);
  assert.equal(s.aiSupportUseful(1, inf, "engineer"), false, "no vehicles to repair");
  assert.equal(s.aiSupportUseful(1, [...inf, unit("medic", false, 0)], "medic"), false, "a second Medic needs 6 infantry");
  const veh = [unit("breaker", true), unit("tank", true)];
  assert.equal(s.aiSupportUseful(1, veh, "engineer"), true);
  assert.equal(s.aiSupportUseful(1, veh, "medic"), false, "Medics do not heal vehicles");
  assert.equal(s.aiSupportUseful(1, [unit("vanguard"), ...veh], "wagon"), true);
});

test("computer sides queue a Medic or Engineer only with patients (Normal and Fast, both seats, 600 s)", () => {
  for (const aiSpeed of ["normal", "fast"]) {
    const s = new Simulation({ map: "classic", aiSpeed, aiPlayer: true });
    const enqueue = s.enqueue.bind(s);
    let checked = 0;
    s.enqueue = function (id, type, ...rest) {
      if (type === "medic" || type === "engineer") {
        const team = this.entities.find((e) => e.id === id).team;
        const army = this.entities.filter((e) => e.team === team && e.kind === "unit" && e.type !== "worker" && e.hp > 0 && e.damage > 0 && !e.flying);
        const n = army.filter((e) => (type === "engineer" ? e.mechanical : !e.mechanical)).length;
        assert.ok(n >= (type === "engineer" ? 2 : 3), `${aiSpeed} t=${this.time.toFixed(1)} team ${team}: ${type} queued with ${n} patients`);
        checked++;
      }
      return enqueue(id, type, ...rest);
    };
    for (let i = 0; i < 6000; i++) s.tick(0.1);
    assert.ok(checked > 0, `${aiSpeed}: support units still get trained once there are patients`);
  }
});
