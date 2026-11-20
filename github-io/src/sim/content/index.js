// Content modules (docs/CONTENT_SEAMS.md): new units, statuses, abilities, tower rules, commands,
// fight behaviours and AI rules, each as one plain object in its own file in this folder.
// APPEND-ONLY: one import and one entry per package, at the end of each list. Never reorder: the
// order here is the order every hook runs in (step hooks sort by their own `order`).
// A module must not use other sim exports at import time (src/sim/content.js reads this list while
// the sim files are still loading); inside its hooks it may use anything.
import { suppression } from "./suppression.js";
import { marksman } from "./marksman.js";
import { bossStatus } from "./boss-status.js";

import { workshops } from "./workshops.js";

export const CONTENT = [
  suppression,
  marksman,
  bossStatus,
  workshops,
];
