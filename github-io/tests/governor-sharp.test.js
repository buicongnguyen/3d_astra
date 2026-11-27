// Governor sharpness (re-score 2026-11-28, gap 4): phones start at the Eco pixel ratio 1 and the governor steps it up
// only while frames stay smooth with main-thread room, takes a step back at once when frames slip, and backs off.
import test from 'node:test';
import assert from 'node:assert/strict';
import { Governor, LEVELS, SHARP } from '../src/governor.js';

function governed(steps = 4) {
  const state = { extra: 0, sharps: [], levels: [] };
  const governor = new Governor({
    sharpSteps: () => steps,
    onSharp: (extra) => { state.extra = extra; state.sharps.push(extra); },
    onChange: (level, index) => state.levels.push(index),
  });
  return { governor, state };
}
// `seconds` of frames; frame(extra) gives [intervalSeconds, workMs] for the current extra pixel ratio.
function run(governor, seconds, frame, state) {
  for (let t = 0; t < seconds;) {
    const [interval, work] = frame(state.extra);
    governor.sample(interval, work, true);
    t += interval;
  }
}

test('smooth 60 Hz frames with room step the pixel ratio up to the allowed top, one step at a time', () => {
  const { governor, state } = governed(4);
  run(governor, 3 + SHARP.upAfter - 0.5, () => [1 / 60, 3], state);
  assert.deepEqual(state.sharps, [], 'nothing inside the grace and the first smooth seconds');
  run(governor, 30, () => [1 / 60, 3], state);
  assert.deepEqual(state.sharps, [0.25, 0.5, 0.75, 1], 'one step per smooth stretch, never past sharpSteps');
  assert.equal(governor.current.name, 'full');
  assert.deepEqual(state.levels, []);
});

test('a GPU that cannot afford more pixels steps back at once and waits longer before each retry', () => {
  const { governor, state } = governed(4);
  // Up to +0.5 the frame holds 60 Hz; past it every frame misses vsync.
  const frame = (extra) => [extra > 0.5 ? 1 / 30 : 1 / 60, 3];
  run(governor, 120, frame, state);
  assert.ok(Math.max(...state.sharps) <= 0.75, `never past one step over the line: ${state.sharps}`);
  assert.equal(state.extra, 0.5, 'settles on the highest ratio that holds');
  const tries = state.sharps.filter((x) => x === 0.75).length;
  assert.ok(tries >= 2 && tries <= 3, `backs off (20 s, then 40 s, ...): ${tries} tries in 120 s`);
  assert.deepEqual(state.levels, [], 'sharpness goes before any cosmetic step');
});

test('no sharpness at a 30 Hz cap, with a busy main thread, or where the screen allows no step', () => {
  for (const [frame, steps] of [[() => [1 / 30, 3], 4], [() => [1 / 60, 12], 4], [() => [1 / 60, 3], 0]]) {
    const { governor, state } = governed(steps);
    run(governor, 40, frame, state);
    assert.deepEqual(state.sharps, []);
  }
});

test('slow frames shed sharpness first, then cosmetics; a loading hitch re-arms the grace', () => {
  const { governor, state } = governed(2);
  run(governor, 20, () => [1 / 60, 3], state);
  assert.equal(state.extra, 0.5);
  run(governor, 1.5, () => [0.05, 20], state);
  assert.equal(state.extra, 0.25, 'the first slow second costs one sharpness step');
  assert.deepEqual(state.levels, []);
  run(governor, 6, () => [0.05, 20], state);
  assert.equal(state.extra, 0);
  assert.ok(governor.level < LEVELS.length - 1, 'then cosmetics step down');
  // A hitch (a model loading) and then a short stall: ignored inside the re-armed grace.
  const fresh = governed(2);
  run(fresh.governor, 4, () => [1 / 60, 3], fresh.state);
  fresh.governor.sample(0.6, 200, true);
  run(fresh.governor, 0.9, () => [0.05, 20], fresh.state);
  assert.deepEqual(fresh.state.levels, []);
  assert.deepEqual(fresh.state.sharps, []);
});

test('one second with a few missed frames is a hitch, two in a row take a step back', () => {
  const { governor, state } = governed(2);
  run(governor, 20, () => [1 / 60, 3], state);
  assert.equal(state.extra, 0.5);
  // 80% of frames on time, 20% missed: median 16.7 ms, p90 33 ms.
  let n = 0;
  const choppy = () => [++n % 5 === 0 ? 1 / 30 : 1 / 60, 3];
  run(governor, 1.05, choppy, state);
  assert.equal(state.extra, 0.5, 'one choppy second is ignored');
  run(governor, 1.05, choppy, state);
  assert.equal(state.extra, 0.25, 'the second one in a row costs a step');
});
