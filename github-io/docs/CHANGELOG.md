# Changelog

## 0.2.0: rebuild phase 0

Rules
- Idle fighters guard the spot they were left on: they answer whoever shoots them, chase enemies they can see within a short leash, then walk back. Patrols answer fire too.
- The AI now fields vehicles and researches Overcharged weapons (its Barracks used to starve the Foundry of alloy).
- A team whose only Command core is still under construction has 90 seconds to finish it.
- Cancelling a damaged construction site refunds less; an unfinished site sees only its own footprint.
- Area weapons reach the edge of large buildings.
- One unarmed enemy building near an AI base no longer recalls its whole army.
- Relaxed AI attacks later (first wave at 210 s, then every 90 s).
- Attack waves raise an "incoming" warning for the defender.
- Harvesters can be sent to work in one call (`assignHarvesters`), used at match start.

## 0.3.0: rebuild phase A (rules core)

No visible change to play; this is groundwork for saves, missions and deeper combat.

- Every player action goes through one command door (`sim.command`) that checks ownership and logs the command with its tick.
- Matches can be saved and loaded (`sim.serialize()`, `Simulation.load()`), with a version number and a state hash.
- A match replays exactly from its options and command log.
- The rules step is about five times faster on the largest map with three AIs (average 7.0 ms to 1.3 ms; spikes of about 300 ms to under 30 ms): square-root distances, obstacle buckets, reused route buffers, six route searches per step, one AI thinking per step.
- The 1,400-line rules file is split into systems under `src/sim/` (vision, orders, movement, combat, economy, AI).

## 0.1.0

Everything up to 2 November 2026. See the dated review documents for the history.
