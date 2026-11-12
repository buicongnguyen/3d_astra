// Priority for the notice line. Pure: no DOM, the time is passed in, so it is unit-tested
// (tests/message-queue.test.js); app/hud.js draws whatever `current` is.
//
// - An alert (under attack, attack incoming, a point lost) is never replaced by a routine notice:
//   it stays its full time and a routine notice that arrives meanwhile waits its turn.
// - The same text again (alert or routine) only refreshes the time it stays.
// - A new alert during another alert waits too, so each one is read in full.
// - An alert that interrupts a routine notice puts that notice back in the line, first of its kind.
// - A routine notice replaces another routine notice at once, as it always did.
export const ROUTINE = 1;
export const ALERT = 2;
export const SHOW_MS = 4500;
export const MAX_WAITING = 4;

export function createMessageQueue({ showMs = SHOW_MS, maxWaiting = MAX_WAITING } = {}) {
  let current = null; // { text, priority, until }
  let waiting = []; // [{ text, priority }], alerts first, then routine notices, each in arrival order

  function sortWaiting() {
    // Stable: equal priorities keep their order.
    waiting.sort((a, b) => b.priority - a.priority);
    // Too many: the oldest of the least important goes.
    while (waiting.length > maxWaiting) {
      const low = Math.min(...waiting.map((w) => w.priority));
      waiting.splice(waiting.findIndex((w) => w.priority === low), 1);
    }
  }
  function wait(message, front = false) {
    if (waiting.some((w) => w.text === message.text)) return;
    if (front) waiting.unshift(message);
    else waiting.push(message);
    sortWaiting();
  }

  // Moves on when the shown message's time is up; returns what should show now (or null).
  function update(now) {
    if (current && now >= current.until) current = null;
    if (!current && waiting.length) {
      const next = waiting.shift();
      current = { text: next.text, priority: next.priority, until: now + showMs };
    }
    return current;
  }

  function push(text, priority, now) {
    update(now);
    if (current && current.text === text) {
      current.priority = Math.max(current.priority, priority);
      current.until = now + showMs;
      waiting = waiting.filter((w) => w.text !== text);
      return current;
    }
    if (current && (current.priority > priority || (current.priority === ALERT && priority === ALERT))) {
      wait({ text, priority });
      return current;
    }
    if (current && priority > current.priority) wait({ text: current.text, priority: current.priority }, true);
    waiting = waiting.filter((w) => w.text !== text);
    current = { text, priority, until: now + showMs };
    return current;
  }

  // Successful work hides a routine notice at once (and the ones waiting); alerts are kept.
  function dismissRoutine(now) {
    waiting = waiting.filter((w) => w.priority >= ALERT);
    if (current && current.priority < ALERT) current = null;
    return update(now);
  }

  function clear() {
    current = null;
    waiting = [];
  }

  return {
    push,
    update,
    dismissRoutine,
    clear,
    get current() { return current; },
    get waiting() { return waiting.map((w) => ({ ...w })); },
  };
}
