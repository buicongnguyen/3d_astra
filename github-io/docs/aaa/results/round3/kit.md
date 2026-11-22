# Round 3: command console kit on every screen, one context panel on phones

Branch `r3/ui-kit` from tag `r3-wave-3` (b3cf478). Port 4232. No sim, pin or baseline changes.

## A. The kit everywhere
- `src/kit-skin.css` is loaded last (main.js). It points the older theme tokens at the kit and removes the R3-M corner brackets. Corners are chamfered: interactive controls paint a corner-cut background, so the 2 px #97F4FF focus ring outside the face is never clipped; passive panels use clip-path.
- **Buttons:** flat gold primary, secondary, ghost and danger. Hover 116 %, pressed 2 px down, disabled solid. Selected shows the cyan edge and a 2 px rail.
- **Covered:** selects, setup panel, mode cards, Quick battle, rank chip, campaign rows, Defence variants, Settings (kit switches, tabs), modals, help keys, mission briefing card, round speaker portraits, decision options with a rail, toasts with a status rail, objectives, tooltips, command tiles (cost line, lock glyph with the prerequisite, hotkey chip), results, MVP and rank cards, and the desktop top bar, chips, dock and minimap.
- **New SVG frames** in `src/art/ui/`: gold, danger, disabled, ghost, modal, panel-active, panel-gold and glyph-lock.
- **Screenshots** (1440x900, 390x844, 844x390, 320x568): `kit/before/` and `kit/after/`, taken with `tools/kit-shots.mjs`.

## B. Phones: one context panel
- The dock has two tabs, Selection and Map; Actions is gone. The Selection tab shows the header with stats, then the orders, then one action row (tiles, abilities, stance, level-up). Each is one tap. The row scrolls sideways inside the panel and fades at its right edge. The roster folds into the heading count while actions show.
- **Buildings:** the queue and Rally share one row. The building's Info & stats is the touch row's Info.
- **Code:** `dockTab("actions")` now opens Selection; callers updated in selection, orders, keyboard, defence input and the defence guide. The construction card fills the panel at 202 px. Help text and the Defence lines no longer say "Actions" (vi and ko added, old keys removed). Korean font re-cut: 796 characters.
- **Heights at 390x844**, r3-wave-3 → now:

| Selection | r3-wave-3 | Now |
|---|---|---|
| Group | 165 | 161 |
| One unit | 113, or 202 on the Actions tab | 161 |
| Harvester | 202 | 161 |
| Building | 202 | 161 |
| Construction | 202 | 202 |

  At 320 px a group is 214 → 210.

## C. Crop
`view.setCoverCrop`, measured each UI tick (`hud.js coverFollowsDock`), stops drawing under the open dock or the tab strip. The see-through top bar keeps the map under it.

Render budget (RTX 4080), r3-wave-3 → kit:

| Scenario | Draws | Pixel rows |
|---|---|---|
| battle-eco | 111 → 111 | |
| three-rivals-eco | 160 → 158 | |
| three-factions-eco | 198 → 196 | |
| new battle-dock-eco (dock open) | 171 → 169 | 221 of 844 not shaded |

Most of the phone HUD's extra draws come from the strip under the top bar, which the owner rule keeps. Limits lowered: three-rivals 161 and three-factions 199; battle-dock-eco is new at 172. The other f94c774 lines stay.

## Review
A fresh subagent scored the screen families from screenshots, before → after:

| Family | Before | After |
|---|---|---|
| Title | 6 | 7 |
| Campaign | 6 | 6.5 |
| Defence menu | 5 | 6 |
| Settings | 4 | 6.5 |
| Pause | 5 | 6.5 |
| Help | 4 | 5 |
| Field guide | 4 | 5 |
| Story | 5 | 7 |
| Toasts and objectives | 5 | 7 |
| Tooltip | 4 | 4.5 |
| Desktop HUD | 5 | 6.5 |
| Phone HUD | 3 | 5.5 |
| Results | 6 | 7.5 |
| Defence HUD | 4 | 5.5 |

The target of 8 was **not** reached.

## Tests
- `npm test`: 1083 pass, 0 fail.
- **Browser suites run and passed** on the final rerun: cover-ui (extended to the battle dock), ui-quality, status-layout, layout-f, mobile, mobile-controls, mobile-gestures, mobile-construction, phones, selection, hotkeys, tactics-ui, language (incl. ko), fullscreen, defence, defence-onboarding, defence-zones, missions, title, campaign, story, choices, chronicles, rank, quick-battle, readability, squad-orders, army-depth, improvements, offline, abilities, air, factions, progression, activity, defence-deck and browser.
- **Not re-run after the last CSS change** (the modal frame): the suites, and `--lang vi/ko` audits beyond the language suite.

## Open items
- **Modal frame:** it still draws as a thick segmented band (the reviewer's top fix). The cause is not found yet.
- **Phone action row:** it scrolls sideways. The reviewer prefers wrapping, but wrapping would grow the dock.
- **Captions and hotkey badges:** some are under 11 px (estimated). Help and field-guide palette. Tooltip layout. Settings tabs and switch On/Off text. Defence wave bar chips.
