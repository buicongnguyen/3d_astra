# Korean (한국어): results

Branch `r3/ko-korean` from `feat/aaa-round3`, worktree `C:\Users\n\source\repos\3d_astra-r3-ko`, port 4232.
Presentation only: no file under `src/sim/`, no balance, mission or golden pin was touched.

## What the player gets

| Item | What it does | Where |
|---|---|---|
| Language choice | 한국어 in the start-screen picker and in Settings, next to English and Tiếng Việt. One choice applies it; it is saved and survives a reload; `<html lang="ko">`. | `src/app/preferences.js`, `src/settings-ui.js`, `src/settings.js` |
| UI catalog | Every message (1,243) and pattern (204) of `vi.json`, in the same order. | `src/locales/ko.json` (lazy chunk `ko.js`) |
| Story catalog | Every entry of `story-vi.json` (826) plus 15 name-only entries (Korean writes the names in Hangul; Vietnamese keeps them in Latin, so vi has no entry). | `src/locales/story-ko.json` (lazy chunk `story-ko.js`) |
| Loader | One catalog set per language; `loadLocale(lang)` / `loadStory(lang)`; per-language translation cache; `koreanParticles` picks 을/를, 이/가, 은/는, 과/와, 으로/로 after a filled-in word or number. | `src/i18n.js` |
| Hangul font | "Frontier KR" = Noto Sans KR (OFL), variable 400–800, subset to the 795 characters the catalogs use, one woff2. Hangul-only `unicode-range`, named only in the `:root[lang="ko"]` stacks: English and Vietnamese players never fetch it. No system-ui. | `src/language.css`, `src/fonts/`, `tools/subset-korean-font.py` |
| Offline | The Korean chunks and font are not precached (that would cost every player ~360 KB); the worker keeps each in the shell cache on its first fetch. | `tools/sw.template.js` (`LAZY`), `vite.config.js` |
| Glossary | Factions, people, places, resources, units, buildings, orders, Defence terms. | `LOCALIZATION.md` |
| Side fixes | The Daily seed date ("21 Nov") is translated in vi and ko; chronicle cards and Defence level rows let faction and cast names translate (they were `translate="no"`; the card's CSS now keys on `.chron-side`). | `src/app/defence-entry.js`, `src/chronicles-ui.js`, 3 CSS files |

## Size

| File | Raw | gzip | Who downloads it |
|---|---|---|---|
| main JS (`index-*.js`) | +2.1 KB (976.5 → 978.6 KB) | +0.8 KB | everyone |
| main CSS (`index-*.css`) | +2.2 KB | +0.5 KB | everyone |
| `ko-*.js` | 122 KB | 43 KB | Korean players only |
| `story-ko-*.js` | 144 KB | 52 KB | Korean players only |
| `noto-sans-kr-subset-*.woff2` | 92 KB | (woff2) | Korean players only |
| service-worker precache | 42 entries before and after | | Korean files are `LAZY` |

## Checks

| Check | Result |
|---|---|
| `npm test` | 1,071 tests, 1,043 pass, 28 skipped, **0 fail** (golden pins unchanged) |
| `tests/i18n-ko.test.js` (new, 7 tests) | ko keys = vi keys; patterns same sources and groups; story-ko = story-vi + names; numbers, placeholders and names kept; every value Korean; every story string, unit, building and training step translated; built lines have no English left; the font covers every Hangul character |
| `tests/i18n-coverage.test.js` | now checks every rendered UI string for vi **and** ko |
| `tests/service-worker.test.js` | +1: Korean files not precached, cached on first fetch |
| `tests/css-layout.test.js` | +1: Korean font face Hangul-only, only in the ko stacks, no system-ui |
| `npm run test:language` | PASS: English/Vietnamese as before + Korean screens at 1440x900, 390x844, 844x390 (`tests/language-ko.mjs`): picker, saved choice, font loaded and fetched, title, Skirmish, Campaign (all mission titles Korean), Defence, Settings, HUD tiles of HQ / Harvester / Barracks (every tile label Korean and fits), results card — no text under 11 px, nothing cut off or off screen, no sideways scroll, 44 px taps on touch |
| `test:openings`, `test:chronicles`, `test:defence`, `test:campaign`, `test:offline`, `test:phones`, `test:ui-quality` | PASS |

Screenshots (JPEG, halved from 2× on phones): `docs/aaa/results/round3/ko/ko-<screen>-<size>.jpg` for title, skirmish, campaign, defence, settings, hud, results at the three sizes.

## Open items

- **Native-speaker check.** The text was written for the game by a model, checked mechanically (numbers, names, Hangul, glossary terms) and by reading the screens, not by a native speaker. Worth a read: story voices (Hale formal 하오체, ECHO "이 개체", Sol to Hale), joined fragments ("allied against you" → 연합하여 공격, "stars to spend" → 별 보유, "of 3" → / 3), and new coinages (perk and branch names: 천리안, 업화, 화염벽, 병참관; Kite = 카이트; Frontier Expanse = 변경 대평원).
- English number words stay Korean number words (열, 두 배, 십 분) because the checks keep digits identical to the English.
- Elements styled with Consolas/monospace (older HUD bits in `style.css`) show Hangul in the system's fallback font, not Frontier KR; on a Linux machine without any CJK font those few would show boxes. The main stacks (`--font-ui`, `--font-tile`, `--font-display`) and the floating counter-hit tags use Frontier KR.
- Vietnamese chunks are still precached for every player (unchanged); they could move to `LAZY` the same way.
- New Korean text needs `python tools/subset-korean-font.py <NotoSansKR[wght].ttf>`; the unit test names the command when a syllable is missing.
