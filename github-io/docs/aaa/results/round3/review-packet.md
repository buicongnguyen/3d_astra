# AAA round 3: review packet (open owner decisions)

Tag `r3-final` on `feat/aaa-round3`. Nothing is pushed or deployed. Each row says what ships by default, so "no answer" is safe.

| # | Decision | Shipped by default | Where the evidence is |
|---|---|---|---|
| 1 | **Fast 1v2 accepted as harder?** After the south exits (L), Fast 1v2 loses more often (Field 7 to 3); Normal and Relentless 1v2 got easier. Four correction rounds did not move it beyond noise. | Accepted as it is. Alternative: shorten the exits for Fast. | `difficulty.md`, `i.md` |
| 2 | **AI veterans symmetric?** Barracks level 3 veteran intake is Expanded-only for the player; should the AI get exactly the same rule (it does today by the shared sim path) and the same Combined squad step? | Symmetric. | `c.md` |
| 3 | **Sunward and Wardens workshop units.** Their workshop hosts are wired but empty since round 2; the "1 workshop unit per faction" gate is n/a for them. | Not added (needs art and balance). Decide whether round 4 adds them. | `a.md` |
| 4 | **"Capped at 100" relay text.** The relay description and field guide say army capacity is capped at 100, true at the default but not at 150 / 200. | Left as existing entries. | `c.md` |
| 5 | **Ramp side-edge stall (sim bug).** A unit that reaches a plateau ramp from its side can stall on the ramp's side edge and drops the order after 6 s (seen on both Dunes ramps). Fixing it moves movement pins, so it needs an explicit pin move. | Not fixed; the terrain test now approaches from the front. | `wave-3.md` "Terrain suite" |
| 6 | **Daily orders vs real modifiers.** Daily orders are pledges judged after a win for bonus XP (Iron line, Swift, Lean, Hunter), not match modifiers. Should they become real rules? | Pledges only. | `r.md` |
| 7 | **Quick battle defaults.** Riverlands, Meridian vs Ashfall (or Meridian for an Ashfall player), scouts on. Right first match? | As written. | `q.md` |
| 8 | **Ceremony on Eco quality.** Eco alone keeps the ceremony (phones default to Eco); only reduced motion or "Animate combat effects" off skips it. | Keeps it. | `v.md` |
| 9 | **Render cost of the phone HUD.** The HUD frame adds about 2 draws on the busiest scenes (limits raised: three-rivals 161, three-factions 199, battle-dock-eco 172); the strip under the top bar is kept by owner rule. | Accepted. | `kit.md`, `wave-3.md` |
| 10 | **Kit open items.** Closed in the final polish: Defence landscape dock overlap, Start crowding Quick battle, 12 px desktop badges, results actions below the fold. Still open: command-card and hotkey badges and objectives text were re-measured at 11 px or more on the battle HUD but the Defence HUD dock still uses its own text tiles rather than the kit's. | Left. | `kit.md` |
| 11 | **Korean needs a native read.** Written by a model and checked mechanically; no native speaker has read it. | Ships as is, flagged. | `ko.md` |
| 12 | **Phone 320 px scene share.** The scene share at 320x568 rose from 57 / 43 / 27 % to 76 / 60 / 42 %, but a 320 px phone is still tight with an open dock. Is that enough? | Accepted. | `hud.md` |
| 13 | **Art "pending owner review (round 3)".** Every changed model is flagged in `public/models/manifest.json`. | Flagged. | `f.md`, `j.md`, `w.md` |
| 14 | **Deferred (O8):** S5 AI harassment, surprise events, the D14 night Gorge variant, the allied Vanguard boss. | Not built. | plan section 5 |

Release label: `0.26.0: AAA round 3` (proposed; `docs/CHANGELOG.md`).
