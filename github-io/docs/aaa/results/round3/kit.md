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

## Second correction round (coordinator, 2026-11-22)

### What changed
- **Modal frame (root cause).** The frame SVGs had a viewBox but no intrinsic size. As a border-image, each SVG was scaled to the whole dialog, so its 1 px stroke drew several px thick and the 9 px slices cut it into segments.
  - Every `src/art/ui/frame-*.svg` now has `width="64" height="64"`, so the frame is a precise 1 px edge.
  - Dialogs use the panel frame (8 px chamfer).
- **Phone action row: every action is in view.**
  - The tiles share the row equally (44 px minimum). Each shows its glyph or portrait over one short line: cost, state, or stance name. The full name is in the tooltip and the accessible name.
  - A locked tile shows the lock glyph only.
  - At 390 px, six or seven tiles fit without scrolling.
  - In landscape:
    - the row wraps;
    - unit orders sit in one row of five;
    - a building's Rally sits beside its heading, with its queue on the row below.
  - Dock heights are unchanged from round 1 (161 px in portrait).
- **Small text.** A script measured title, settings, campaign, help, field guide and pause on all three viewports. Desktop menu text was raised to 12 px. What remains under 12 px on desktop is battle-HUD text at 11 px, which the rule allows. Phones have nothing under 11 px.
- **Kit restyle:**
  - Help: the group and shortcut buttons, and the key chips.
  - Field guide: glass surface, kit buttons, cyan headings.
  - Desktop tooltip: name on top, then role, then cost. In vi and ko it stays as one translated line.
  - Settings switches now say On or Off; added "On" to vi.json and ko.json.
  - Defence bar and chips: kit panel and chips.
  - Korean font re-cut (797 characters).
- **Merges and docs.** Merged `r3/ci-robust` (a1389b7). Added the CHANGELOG subsection.

### Checks
- **`npm test`:** 0 fail (the Korean font test fails until the font is re-cut).
- **Render budget, full run:** passes. battle-eco 111, three-rivals 158, three-factions 196, battle-dock-eco 169.
- **Phone HUD audit:** `tools/phone-hud-audit.mjs --lang vi` and `--lang ko` report 0 issues in every case.
  - **Cost:** at 320×568 the clear-scene share with one unit selected is 49.8%; the HUD pass measured 59.6%. The context panel adds its action row.
- **Browser suites:** all of these pass on the final build: cover-ui, ui-quality, status-layout, layout-f, mobile, mobile-controls, mobile-gestures, mobile-construction, phones, selection, hotkeys, tactics-ui, language, fullscreen, defence, defence-onboarding, defence-zones, missions, title, campaign, story, choices, chronicles, rank, quick-battle, readability, squad-orders, army-depth, improvements, offline, abilities, air, progression, activity, defence-deck, openings, ceremony and sovereign-walks.
  - The final CSS fixes (landscape layout, construction card) were re-run on the suites they affect.
- **Test changes for the icon tiles:**
  - Locked tiles may show only the glyph (status-layout).
  - Elements inside the action row are measured once they are scrolled into view.

### Fresh reviewer, final scores

The before column was re-scored by this reviewer and is calibrated differently from round 1.

| Family | Before | After |
|---|---|---|
| Title | 7 | 7.5 |
| Campaign | 7 | 7.5 |
| Defence menu | 7 | 7.5 |
| Settings | 7 | 8 |
| Pause | 7.5 | 8 |
| Help | 6.5 | 7 |
| Field guide | 6.5 | 7 |
| Story | 7 | 8 |
| Toasts and objectives | 7 | 7.5 |
| Tooltip | 6.5 | 7 |
| Desktop HUD | 6.5 | 7 |
| Phone HUD | 5.5 | 7.5 |
| Results | 7 | 7.5 |
| Defence HUD | 5.5 | 6 |

**Target of 7.5 on every family: not met** for Help, Field guide, Tooltip and Desktop HUD (7 each) and Defence HUD (6).

### Still open
- **Defence HUD dock:** it still uses its own text tiles; in landscape "Reinforce" and "Field commander" overlap.
- **Landscape menus:** on Title and the Defence menu, Start crowds the Quick battle tile.
- **Desktop small text:** command-card and hotkey badges, objectives, and the tooltip body (about 9–11 px).
- **Results in landscape and at 320 px:** the actions fall below the fold.
