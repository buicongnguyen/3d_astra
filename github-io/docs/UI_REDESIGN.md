# Start screen, settings and mobile UI redesign

September 2026. The goal was neat buttons and readable text on the start screen, in Settings and in the phone HUD, at the art quality of the 3D models.

## Audit before the change

Chrome was driven through every menu state on five layouts: desktop 1440×900, tablet 768×1024, phone 390×844, small phone 320×568 and landscape 844×390. The script recorded controls smaller than 44 px on touch layouts, clipped or off-screen controls, page overflow, and any text under 11 px.

| Finding | Before |
|---|---|
| Text under 11 px (unique elements per layout) | 50–67, as small as 6 px |
| Start screen | Translucent card over the live HUD; resources, map title and Objectives showed through. On desktop, the HUD was visible behind the card. |
| Mode choice | Four uneven buttons: a two-line "Training · start here" and Settings alone on a second row |
| Language picker | Inside the story text |
| Start button | Flat, pale, same weight as the other buttons |
| Brand and art | Stroked SVG logo; no key art |
| Settings | Language row repeated on every tab; flat placeholder shields as army previews; ninth colour on its own row; tabs 42 px tall |
| Dialogs | Field guide in a different teal from pause, help and result; plain result screen |
| Phone dock | Command tiles text-only; empty production queue left a blank 44 px band |

## Evaluation: should Blender be used?

Yes for the art, no for the controls. That hybrid is what shipped.

- **Blender is the right tool for the pictures:** key art, the emblem, and unit and building portraits. They are rendered from the same GLB files the game loads, so they always match the models on the battlefield. A mask pass lets the page tint the portraits with the player's chosen army colour, so the art is not baked with one colour.
- **Blender is the wrong tool for buttons, text and panels.** These must stay HTML and CSS because:
  - they must stay sharp on every screen density;
  - they must reflow from 320 px phones to desktop;
  - they must be translatable (the Vietnamese pack translates DOM text);
  - they must follow the army colours and be readable by screen readers and keyboards;
  - they must stay a few kilobytes.

  Baked button images would fail all of these.

## What changed

**Design system** (`src/ui-theme.css`, loaded last):
- Colour tokens: ink panels, one gold primary action, teal secondary buttons and a gold focus ring.
- Display and interface type, with minimum sizes: 11 px for labels, 13–15 px for body text.
- Custom select chevrons.
- Consistent dialogs: pause, help, result, field guide and the training card.

**Start screen** (`src/start-screen.css`, `#briefing` in `src/main.js`):
- The HUD is hidden while the start screen is open (`.in-briefing`).
- Desktop: a key-art hero with the briefing on the left and setup on the right.
- Phones: one scrolling column with the hero first.
- Short landscape: two columns, and the setup column scrolls on its own.
- Three equal mode cards: Training, Skirmish and Campaign.
- Labelled fields.
- Numbered campaign stages with locks, and the list of training lessons.
- Start is a pinned gold button. A backing ring in the column colour hides fields that scroll under it.
- Settings and language sit in the top bar.

**Settings** (`src/settings.css`, `src/settings-ui.js`):
- Language moves into the header, so it is no longer repeated on every tab.
- Tabs follow the WAI-ARIA tab pattern: `role="tab"`, `aria-selected`, arrow keys, and Home/End.
- Portrait previews of your army and the enemy in the chosen colours.
- Colour chips: one row on wide panels, 5 + 4 on phones.
- Switches instead of bare checkboxes.
- The footer stays visible while the tab body scrolls.
- On phones it becomes a full-height sheet.

**Portraits in the HUD** (`src/portraits.js`, `src/portraits.css`):
- Rendered portraits appear on the command tiles (phones), the selection card, the unit roster, the field guide and the settings preview.
- On portrait phones the selection card uses the desktop layout: portrait beside the name, vitals and status. The fixed-height dock therefore does not grow, and the order buttons are never clipped. The narrow landscape dock keeps the portrait in the name row so the vitals keep their width.

**Phone dock:**
- A building with an idle queue shows its heading (PRODUCTION · 4 AVAILABLE) in the queue's slot. The tiles never move when a job starts.
- A relay or tower shows STRUCTURE · LEVEL n and its description.

**Performance:** on phones the start screen is opaque, so the hidden battlefield is redrawn only twice a second (enough to keep models and shaders warm for Start) instead of every frame.

## Code and logic review

A separate review pass read the whole change. Every finding below was reproduced and fixed.

| Finding | Fix |
|---|---|
| Help (?) on the start screen opened behind it: modal z-index 20 vs start screen 30. Pressing Start then ran the match under the Help window. | The modal layer is 40: above the start screen and the training card, below Settings. |
| The focus ring was a `box-shadow`, so pressed mode cards, the current stage, the selected tab and every switch replaced it with their own shadow. Keyboard users saw no focus. | Focus is a 3 px gold `outline`. Tiles in edge-to-edge scrollers draw it inside. |
| The logo link reloaded the page mid-match, silently abandoning the battle. | Mid-match it opens the pause menu, where New game lives. |
| The portrait was a `<span>` inside command tiles. Tests and CSS rules treat the tile's `span` as its label, so `tests/language.mjs` failed. | Portraits are `<i>` elements; `span` stays the label. |
| The phone selection card grew by 14 px with the larger portrait and clipped the order buttons in the fixed-height dock. The narrow landscape dock then overflowed "2200/2200". | Portrait phones place the portrait beside name, vitals and status (the dock is no taller). Landscape keeps it in the name row. |
| A relay description showed when several buildings were selected. | Only for a single structure. |
| Old desktop brand rules squeezed the 38 px emblem into 26 px and indented COMMAND. | Removed; the emblem is 32 px on desktop. |
| The Start button's upward fade darkened the last field. | A flat ring in the column colour only. |
| Settings tabs were 42 px tall; resource and objective labels 9–10 px. | 44 px tabs; 11 px labels. |
| The field guide listed stale Sentinel tower upgrade costs. A global phone rule forced every pressed button gold, including menu cards. | Costs match `levelCost` (75/25, 150/50). The pressed rule is scoped to HUD toggles. |
| Result dialogs did not focus their primary action. "7 stages" was hard-coded. Colour buttons had English-only screen-reader labels. | Focus the primary; `STAGES.length` with a Vietnamese pattern; `Your/Enemy <colour>` patterns. |
| Dead code: superseded `language.css` rules, icon-era brand and result-emblem rules, a flex rule on the grid mode switch, a duplicate import. The Blender script treated `-- portraits` as an output folder. | Removed. Part names and the output folder can be given in any order. |

## Blender art pipeline

`tools/blender/render_ui_art.py` renders every image headless from `public/models/*.glb`:

```sh
blender --background --factory-startup --python tools/blender/render_ui_art.py -- [out_dir] [keyart] [portraits] [emblem]
```

The default `out_dir` is `src/art`. Vite fingerprints these files at build time.

| File | Size | Used for |
|---|---|---|
| `keyart.webp` | 94 KB | Start-screen hero, 1600×900 |
| `keyart-960.webp` | 47 KB | Hero on screens up to 720 px wide (via `<picture>`) |
| `portraits.webp` | 62 KB | 4×4 atlas of 13 portraits, 192 px cells, team paint white |
| `portrait-mask.webp` | 18 KB | Same atlas; alpha marks team paint, so CSS multiplies in the army colour |
| `emblem.webp` | 12 KB | Brand mark and result emblem |

Total: 233 KB, of which phones download 139 KB. The atlas order is part of the page contract; see `PORTRAITS` in the script and `PORTRAIT_ORDER` in `src/portraits.js`. The script uses EEVEE with the Standard view transform, which keeps the palette vivid; AgX desaturates it. Text is never baked into images.

## Verification

- `npm run test:ui-quality` (`tests/ui-quality.mjs`) runs in CI as the `interface` group. On desktop, phone, small phone and landscape it checks that:
  - the key art and emblem decode;
  - the HUD is hidden on the start screen and the page does not overflow;
  - start-screen and settings text is at least 11 px;
  - touch targets are at least 44 px and not covered;
  - each mode card shows only its own section;
  - Settings fits the screen, its tabs work with the arrow keys, and Escape returns focus to the gear button;
  - Help opens above the start screen, and keyboard focus is visible on the pressed mode card;
  - the portrait atlas is applied;
  - phone docks do not clip their order, upgrade or queue buttons;
  - an idle queue's heading keeps the tiles in place;
  - the logo pauses a match instead of leaving it.
- All earlier browser suites pass against `vite preview`, including `language`, `mobile-controls`, `campaign`, `improvements` and `status-layout`.
- Performance against the previous release (the live site), same Chrome, three runs each. Main-thread time is script, style and layout per second:

  | Scenario | Before | After |
  |---|---|---|
  | Desktop start screen: frame / main thread | 16.6 ms / 147 ms/s | 16.6 ms / 150 ms/s |
  | Desktop match with a 17-unit portrait roster | 16.8 ms / 228 ms/s | 16.6 ms / 231 ms/s |
  | Phone start screen: main thread / 3D frames per 3 s | 184 ms/s / 172 | 32 ms/s / 6 |
  | Phone match with a 17-unit portrait roster: frame p95 | 33 ms | 17 ms |

  Desktop is unchanged within noise; portraits cost nothing measurable. The phone start screen no longer draws the hidden battlefield every frame. The phone match also measured faster, but the cause was not isolated, so read it as "no regression" rather than a gain.
- The five-layout survey after the change showed no clipped or off-screen controls and no page overflow. Unique text elements under 11 px fell from 50–67 per layout to 0–4. They are:
  - the letter-spaced brand subtitle (10 px);
  - the desktop order labels, which are visually hidden and exist for screen readers;
  - the phone toolbar labels below 360 px wide (10 px), where seven buttons share the row.

  The survey measures "Focus base" on the map tab as 28 px tall; its hit area is extended to 44 px with a pseudo-element, which the survey cannot see.

## Known limits

- The Godot edition's copy of `vi.json` (see `LOCALIZATION.md`) does not have the new strings yet.
- Checked in desktop Chrome and Chrome device emulation, not on physical phones.
