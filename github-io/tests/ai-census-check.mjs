// CI entry (matrix r3-a) for the Field command census check, tools/ai-census-check.mjs (AAA round 3, R3-A).
// It needs no browser: 5 factions at 600 s and 5 Highlands Field-against-Field matches, 2 processes by default.
if (!process.argv.includes("--jobs")) process.argv.push("--jobs", "2");
const { main } = await import("../tools/ai-census-check.mjs");
await main();
