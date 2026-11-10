// Tuning constants shared by the simulation systems.
export const NEUTRAL = -1;
// The slimmest unit body: the radius used to push a larger unit through a gap it cannot otherwise leave.
export const SQUEEZE = 0.55;
// How far beyond its sight an idle fighter follows an enemy from the spot it guards.
export const LEASH = 4;
// Seconds a team with only an unfinished Command core has to complete it.
export const CORE_GRACE = 90;
// Route searches per 50 ms tick; each costs up to a few milliseconds on the largest maps.
export const ROUTES_PER_TICK = 6;
// Harvesters that can work one deposit at a time; more must wait or use another deposit.
export const MINERS_PER_DEPOSIT = 3;
// Sentinel towers each Command core or Supply relay can support.
export const TOWERS_PER_SUPPORT = 2;
// Contested middle-lane deposits on every map: [type, x, z, amount], mirrored for the rival.
export const MIDFIELD_DEPOSITS = [
  ["alloy", 14, 27, 2500],
  ["alloy", 18, 27, 2500],
  ["energy", 16, 32, 2000],
  ["alloy", -42, 9, 2500],
  ["energy", -38, 12, 2000],
];
