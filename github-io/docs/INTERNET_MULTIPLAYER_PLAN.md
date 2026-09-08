# Internet multiplayer implementation plan

Status: proposed for later implementation. No networking service, lobby or online multiplayer is included in this release.

## Goal and first release

Let two people play Frontier Command together from separate internet connections, using desktop Chrome or Android Chrome. Keep the existing single-player skirmish available. Start with private invite-only 1v1 games; extend to four participants with optional AI slots after the two-player release is stable. The current map selector and 1–3 AI opponents are local single-player features.

First-release flow: choose Online → create room or enter invite code → select map and army color → both players mark Ready → server starts the match → show result and offer rematch. Joining an existing match is limited to reconnecting participants. Public matchmaking, ranked ladders, chat, accounts, spectators and co-op alliances are later work.

## Hosting decision

Keep the Three.js client and Blender GLB assets on the existing GitHub Pages site. Run an authoritative Node.js game service separately, reachable through HTTPS and secure WebSocket (`wss://`). Pages is static hosting; it does not run the persistent simulation service. [GitHub Pages documentation](https://docs.github.com/en/pages/getting-started-with-github-pages/what-is-github-pages)

Use WebSocket for the initial transport. Browsers provide a client API for sending and receiving messages from a server. Bound message sizes and pending queues: this API does not provide automatic backpressure. [WebSocket API documentation](https://developer.mozilla.org/en-US/docs/Web/API/WebSocket)

Do not use browser-hosted peer-to-peer lockstep for the first release: an authoritative server makes resource validation, reconnects and fog-of-war filtering easier to enforce. This is a project design choice, not a claim that peer-to-peer RTS networking is impossible.

## Current code and required separation

The simulation already runs under Node in tests. Reuse `src/simulation.js`, `navigation.js`, `terrain.js`, `progression.js`, `balance.json` and `maps.json` without rendering dependencies. Extract these into a shared simulation package; keep Blender assets and `view.js` in the client.

`main.js` currently directly mutates simulation state and assumes the local player is team 0. Introduce a session adapter with `LocalSession` and `NetworkSession`: both expose a read-only render state plus command submission. Replace all UI mutations, including construction, production cancellation, research, upgrades, rally points, support, selection ownership and orders. Selection, camera and audio stay client-local. Replace player-0 assumptions with the server-assigned participant team ID.

The current `issue()` API is trusted local code, not an authorization boundary. The server must authenticate a participant and validate entity ownership before invoking it. Never accept client-provided money, health, damage, team assignment, fog state or elapsed time.

Proposed directories:

```text
packages/simulation/   shared rules, navigation and catalogs
packages/protocol/     versioned message schemas and validation
server/               rooms, sessions, authoritative ticking, snapshots
github-io/src/session/ local and network client adapters
tests/network/        multi-client, recovery and abuse tests
```

## Server simulation and protocol

1. One server-owned simulation per room, initially capped at two human slots. AI slots and four-player FFA are a later milestone. Preserve map ID, balance version, participant IDs, colors and configuration in the match record.
2. Start with the existing 20 Hz fixed simulation step (0.05 seconds). Send filtered state snapshots at an initial target of 10 Hz. Measure load before changing rates. Interpolate rendered positions over approximately 100–150 ms; show immediate command markers while awaiting acknowledgement. Do not predict damage or purchases.
3. Client commands contain protocol version, match ID, monotonically increasing sequence number, action, bounded entity ID list and target/coordinates. Server assigns the authoritative tick, deduplicates sequences, checks ownership and limits, validates rules and returns accepted/rejected acknowledgement with a player-readable reason.
4. Server messages include room state, match-start configuration, command acknowledgement, full snapshot, snapshot delta, relevant effects, heartbeat and match result. Deltas identify their baseline; missing baselines trigger a full resync. Treat the initial JSON schema as version 1; binary encoding is a measured optimization later.
5. Snapshot each client's own economy, queues, units and upgrades. Include only currently visible enemy entities and permitted public information. Preserve last-seen building information from the last visible snapshot; never send fresh positions, queues, HP, projectiles or resource depletion through fog. Maintain explored terrain per team. An entity leaving visibility is hidden, not falsely reported destroyed.
6. Validate finite coordinates, map bounds, entity IDs, action prerequisites, resource costs, population, queue limits, sequence numbers, payload lengths and command frequency. Reject cross-room commands, spoofed team IDs and replayed purchases. The server computes victory and records results.
7. Cap room count and per-connection queues. Coalesce stale snapshots and resync or disconnect slow clients instead of accumulating unbounded memory. Add per-room CPU and memory metrics; optimize unit spatial queries before increasing population or concurrency limits.

## Lobby, interruption and mobile rules

- Create private room IDs and server-issued reconnect tokens with secure randomness. Room invitations allow entry to an open slot; reconnect tokens prove ownership of an already assigned slot and must not be shared or logged. Use secure transport and expire tokens at match end.
- Room host changes map/slots only before ready lock. Reconfiguration clears readiness. The server starts only after every human is ready and has the required asset/catalog version. Failed loading returns the room to a usable state.
- Online Pause opens a local menu; the match continues. Make this visible. Restart requires a new server match and participant readiness; a client cannot reset everyone else's game.
- On disconnect, keep existing unit orders running and allow a proposed 60-second reconnect grace period. Reconnect with a complete filtered snapshot and last acknowledged command sequence. At timeout, mark the player surrendered and resolve all their forces consistently; never duplicate their slot. Both players disconnecting ends the room after the grace period.
- Android backgrounding, screen locking and Wi-Fi/mobile-data changes use the same reconnect flow. Show Connecting/Reconnecting and disable duplicate purchase submissions. Do not promise background execution on phones.
- Persist active room metadata and recovery state only after defining crash-recovery requirements. For the first small beta, a server restart may end active matches with a clear cancellation message; do not claim resumable matches until restoration is tested.

## Deployment and operating costs

Choose a server host later that supports long-running Node processes, TLS/WebSocket upgrades, health checks and logs. Begin with one region close to the first players and one process; keep rooms in memory. Use a bounded capacity and an explicit Room full response. Before purchasing, compare current pricing, idle behavior, outbound traffic costs, resource limits and WebSocket timeout rules; no paid provider or budget has been selected.

Keep server secrets in server environment settings. The client only receives a public endpoint URL and protocol/build versions. Validate the WebSocket Origin against allowed frontend origins (an Origin check is not authentication). Rate-limit room creation and joins, enforce frame limits, expire abandoned rooms, and avoid logging tokens or unnecessary personal information.

Release order: CI unit/protocol tests → staging server and client integration tests → backward-compatible server deploy → Pages client deploy → two-network smoke test. Provide a health endpoint and metrics for live rooms, connected players, command rejection rate, tick duration, snapshot bytes, reconnect failures and memory. Retain the prior server/client build for rollback; reject incompatible clients with a refresh message. Add spending and capacity alerts before a public beta.

## Godot and Blender follow-up

Blender assets need no networking behavior; reuse optimized GLB models in each renderer. After the Three.js beta, implement a Godot client adapter for the same message protocol and authoritative server. Godot supports `WebSocketPeer`; web exports can connect as clients but cannot act as WebSocket servers. [Godot WebSocket documentation](https://docs.godotengine.org/en/stable/tutorials/networking/websocket.html)

Cross-engine play is a separate acceptance milestone. Both clients must agree on entity IDs, coordinate conventions, map/catalog hashes, visibility and command semantics. Do not run the separate Godot simulation as a second authority. Verify native Godot and its web export against recorded protocol fixtures before advertising cross-play.

## Phases and acceptance gates

| Phase | Deliverable | Required evidence before continuing |
| --- | --- | --- |
| 1 | Simulation package, session interface, player-relative UI | Existing single-player suites pass; local player can occupy any slot; no direct UI mutations bypass the adapter |
| 2 | Local server, private 1v1 room, versioned commands | Two browser contexts command separate armies; spoofed ownership, overspending and duplicate commands are rejected |
| 3 | Filtered snapshots, interpolation, reconnects | Packet inspection shows no fog leaks; disconnection, slow receivers and stale baselines recover without duplicated units/orders |
| 4 | Staging internet beta | Desktop and physical Android Chrome on separate networks complete matches on all seven maps; HTTPS/WSS and invite flows work |
| 5 | Capacity and release hardening | Load, memory, long-match and abuse tests meet the targets below; rollback and room expiration verified |
| 6 | Four slots, AI fill and Godot adapter | Four-player FFA victory/surrender rules, AI isolation, and cross-engine protocol fixtures pass |

Initial performance targets to validate, not measured guarantees: server p95 tick below 25 ms at the supported population; less than 100 KB/s received per client in typical 1v1 play; at least 30 FPS on the chosen physical Android phone in Eco mode; no runaway backlog under 100–250 ms latency, jitter, brief packet interruption and a 60-second disconnect. Record actual bandwidth and device model. Keep the beta limited if these targets fail.

Test simultaneous builds/upgrades, contested deposits, support units, tank counters, multiple HQ destruction, surrender, duplicate invite joins, tab refresh, expired tokens, network loss during loading, 30-minute matches, server restart and client/server version mismatch. Multiplayer rollout is complete only after two humans finish a full match over separate internet connections, with results consistent on both clients and the server.

## Decisions to confirm when implementation begins

- Initial audience/region, monthly server budget and expected concurrent rooms.
- Invite-only 1v1 first, then four-player FFA; whether co-op/team alliances should take priority afterward.
- Whether accounts and saved match history are needed; neither is necessary for the initial invite beta.
- Which physical Android phone will be the minimum performance target.

No multiplayer code or hosting is being provisioned by this plan.
