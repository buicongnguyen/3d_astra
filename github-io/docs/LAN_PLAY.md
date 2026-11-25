# LAN play (W11)

Two people on the same Wi-Fi or home network play one battle together, on PCs and phones, without the
internet: **1v1** (host against guest) or **Co-op vs AI** (both people, allies, against one or two computer
sides). One PC runs a small host server that serves the game and passes the players' orders between them.

## How to play

On the PC that hosts (needs Node.js 22 or newer and this repository):

```sh
cd github-io
npm install        # once
npm run lan        # builds the game, then starts the host server on port 4570
```

It prints something like:

```
  On this PC open:   http://localhost:4570/?lan   and press Host.
  Other players (same Wi-Fi or network) open:
      http://192.168.1.20:4570/?lan=join    (Wi-Fi)
  Scan to join on a phone (http://192.168.1.20:4570/?lan=join):
  <QR code>
```

1. On the host PC open `http://localhost:4570/?lan`. The LAN screen opens by itself (it is also the
   **LAN play** tile on the title). Type a name and press **Host a battle**. Pick the mode, map and the
   factions (in co-op also the computer's faction, speed and one or two rivals). The screen shows the join
   address and the same QR code.
2. On the other phone or PC (same Wi-Fi) open the printed address `http://<host-ip>:4570/?lan=join`, or scan
   the QR code. The page finds the host and joins by itself. Press **Ready**.
3. The host presses **Start battle**. Both screens load the battle and it starts when both are ready.

Other options: `npm run lan:serve` starts the server without building again; `--port 4580` uses another
port (`npm run lan:serve -- --port 4580`); `--no-qr` leaves the QR code out.

### Windows firewall, phones, networks

- The first time, Windows asks whether **Node.js** may use the network. Allow it on **Private networks**
  (home Wi-Fi). If you pressed Cancel: Windows Security > Firewall > Allow an app > Node.js > Private.
- Phones must be on the **same Wi-Fi** as the host PC (not mobile data, not a guest network that isolates
  devices). Some routers block devices from seeing each other ("AP isolation" / "client isolation"); turn
  it off or use the main network.
- The host prints every network address of the PC; the first is usually the right one. Addresses of
  virtual adapters (WSL, Hyper-V, VirtualBox) are listed last and do not work from a phone.
- The page must be opened from the host's address (`http://...:4570`), not from the GitHub Pages site:
  a secure https page may not talk to a plain local server. On the Pages site the LAN screen explains how
  to host instead.

## In the battle

- A strip at the top names both players with their colours and shows the ping (round trip in ms). On a
  phone it sits in the free part of the top bar with the other player's name.
- Speed is fixed at x1. Any menu one player opens (pause, settings, help, field guide) or switching away from
  the game pauses the battle for both; the other screen says who paused.
- If a player's game stops answering, the other screen shows **Waiting for a player** with a countdown; after
  30 seconds the battle ends and says why.
- Every 5 seconds both screens compare a fingerprint of the whole battle. If they ever differ, both stop and
  say **The two battles went out of step**; **Continue from the host's battle** sends the host's battle to the
  guest and both play on from there.
- A player leaving (Leave battle, the pause menu's New game, closing the page): in 1v1 the other wins by
  forfeit; in co-op the other plays on and the ally's army holds its ground.
- The end screen offers **Back to the LAN lobby** (same players, pick the next battle) or **Main menu**.
- Nothing of a LAN battle is saved, recorded, replayed or counted for achievements and rank.

## How it works

- **Host server** (`tools/lan-server.mjs`, no packages): an HTTP server for `dist/` on `0.0.0.0` plus a
  WebSocket endpoint (`/lan/ws`, a minimal RFC 6455 implementation in `tools/lan-ws.mjs`) and `/lan/info`
  (addresses, version). It keeps one room (host plus one guest), checks the lobby (ready, full, started) and
  relays match messages, stamping each with the sender's seat so no page can speak for another. QR codes:
  `src/net/qr.js` (byte mode, level M; checked module for module against a reference encoder).
- **Lockstep** (`src/net/lockstep.js`, `src/net/session.js`): both pages run the same deterministic
  simulation. A turn is 3 ticks (150 ms); an order given on a page runs 2 turns later (input delay, 225 ms on
  average) on both pages, together with the other page's orders for that turn: lowest seat first, each in
  the order given, always for the sender's own team. A turn runs only when every page's bundle for it has
  arrived (an empty bundle counts). Every 100 ticks each page sends its state hash (`sim.hash()`).
- **Commands**: the interface's own command door (`sim.command`) is replaced on a LAN page by one that checks
  the order (`commandAllowed`, `src/commands.js`) and queues it for its turn. A build and its builder's
  follow-up order travel as one command so the site's id is known when it runs.
- **Which team is "me"**: the interface treats team 0 as the player. The guest's page shows the battle from
  its own side by swapping the team labels of the state between team 0 and its team, and swapping them back
  before every tick, hash and save (`src/net/perspective.js`; the swap is an involution, so the shared state
  is never changed by it).
- **Rules** (`src/sim/lan.js`): the option `lan: { humans, sides }` makes the people's teams human (no
  computer turn, their prices and autocast switch) and sides decide who is at war and who shares sight.
  Without the option nothing changes: every golden pin is the same.
- **Desync recovery**: the host sends its save (`sim.serialize()`), the guest loads it (`Simulation.load`) and
  replays the turns it already has from that tick on.
- The LAN code is its own lazy chunk (`lan-ui`, about 35 kB); single player only loads the title tile.

Measured on localhost (`tests/lan-integration.test.js`): about 205 bytes a second per player during play
(empty turns included), a few ms round trip, every hash check equal over 3 minutes of 1v1 and 2.5 minutes of
co-op with orders on both sides.

## Tests

- `tests/lan-lockstep.test.js` (in `npm test`): turn assembly and input delay, ordering ties, late and repeat
  bundles, rewind, desync detection, stall overlay and timeout, pause holds, message decoding, the perspective
  swap, LAN rules, build pairs, QR codes.
- `tests/lan-integration.test.js` (in `npm test`): the real server on port 4573 (`LAN_TEST_PORT`) and two
  headless players over Node's WebSocket: 1v1 3 minutes, co-op 2.5 minutes, a forced desync and its recovery,
  a guest leaving.
- `npm run test:lan-play` (CI group `w11`): the server on port 4574 (`LAN_BROWSER_PORT`) serving `dist/`, a
  desktop host and a phone guest (`LAN_GUEST_VIEWPORT=landscape` for the other phone shape): lobby, a 1v1 with
  orders on both pages and agreeing hashes, the waiting card, pause, forfeit and back to the lobby.

## Later: internet play

LAN play uses the host PC as a relay. Playing over the internet needs either a reachable relay (the same
server on a small host with HTTPS/WSS) or **WebRTC data channels**: the pages exchange an offer and answer
(through a short code, a QR code, or a tiny signalling worker), then talk directly. The lockstep session does
not care how messages travel: a `send(message)` and a `handle(message)` are all it needs, so a WebRTC
transport can replace `LanClient` without touching the rules. Open points for that: NAT traversal (STUN, and
TURN for strict networks), iOS Safari's data channel quirks, reconnecting after a dropped connection (the
desync resync already carries everything a rejoining page needs), and more than two people (the scheduler and
the server already handle any number of seats; the lobby and sides would need a seat picker).
See also [INTERNET_MULTIPLAYER_PLAN.md](INTERNET_MULTIPLAYER_PLAN.md).
