import test from 'node:test';
import assert from 'node:assert/strict';
import { Simulation } from '../src/simulation.js';
import { ROCKS } from '../src/data.js';

test('concrete walls replace the boulders, block movement, and fall to sustained ordered fire', () => {
  const s = new Simulation({ ai: false });
  const walls = s.entities.filter((e) => e.kind === 'wall');
  assert.equal(walls.length, ROCKS.length);
  const wall = walls[0], [cx, cz] = s.nav.cellAt(wall.x, wall.z);
  assert.equal(s.nav.free(cx, cz), false, 'a wall blocks its ground');
  assert.notEqual(s.placement('relay', 0, wall.x, wall.z), '', 'nothing can be built on a wall');
  // Nothing fires at a wall on its own: idle units, towers and the AI ignore it.
  const tank = s.spawn('tank', 0, wall.x + wall.radius + 5, wall.z);
  s.visible[0].fill(1); s.updateVision = () => {};
  for (let i = 0; i < 100; i++) s.tick(0.05);
  assert.equal(wall.hp, wall.maxHp, 'walls are never auto-targeted');
  // An explicit order breaks it with repeated shots, then the ground opens.
  s.issue([tank.id], { type: 'attack', target: wall.id });
  let shots = 0;
  for (let i = 0; i < 4000 && wall.hp > 0; i++) { s.tick(0.05); shots += s.events.filter((e) => e.type === 'shot' && e.source === tank.id).length; s.events.length = 0; }
  assert.ok(wall.hp <= 0, 'sustained fire destroys the wall');
  assert.ok(shots >= 5, `it takes many shots (${shots})`);
  assert.equal(s.nav.free(cx, cz), true, 'its ground is passable afterwards');
  assert.equal(s.players[0].kills, 0, 'walls do not count as kills');
});
