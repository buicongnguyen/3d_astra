// Heroic bot check (AAA round 2, W2-B): the --heroic rows of tools/defence-check.mjs, run by the CI matrix entry r2-w2b
// (not by the build job). The bot wins each Heroic variant with 2 or more lives left, a passive player loses by wave 3,
// single-crew play loses on at least 4 levels (5 before the 2026-11-24 reach change).
process.argv.push("--heroic");
await import("../tools/defence-check.mjs");
