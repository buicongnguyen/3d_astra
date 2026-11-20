// Statuses of the boss engine (AAA round 2, W1-E; docs/CONTENT_SEAMS.md, docs/aaa/BOSSES.md).
// `stunned`: a building a boss stomps goes silent for the attack's `stun.seconds` (sim/bosses.js
// applies it through sim.applyStatus). It is a general status: a stunned unit cannot fire or cast
// either. It changes nothing for anything that is not stunned, so a match with no boss in it never
// gets `e.fx` (the status core creates it on the first application only).
export const bossStatus = {
  id: "boss-status",
  statuses: {
    stunned: { noFire: true, noCast: true, icon: "stun", label: "Stunned", tint: [1, 0.84, 0.35] },
  },
};
