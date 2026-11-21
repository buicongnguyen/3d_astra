# English, Vietnamese and Korean

Choose **Language / Ngôn ngữ** on the start screen (English, Tiếng Việt, 한국어), or open **Settings** during a paused game. English is the default. In Settings, **Apply settings / Áp dụng / 적용** saves the choice; **Cancel / Hủy / 취소** discards the draft.

The choice is saved independently in each game. Switching languages does not restart the match, spend resources, clear production queues, change saved campaign progress or remap keyboard shortcuts.

## Implementation

- Three.js uses github-io/src/i18n.js with two catalogs per language: the UI catalog (github-io/src/locales/vi.json, ko.json) and the campaign story (story-vi.json, story-ko.json). Each is its own lazily imported chunk, fetched the first time that language is shown, so English players never download them. Node (unit tests) loads every catalog up front.
- The presentation adapter preserves original English text and translates changed text nodes and accessible labels. It never changes HTML, element IDs, option values, game definitions or order types. Weak references track live text nodes; the translation cache is bounded (one per language). Numeric-only values are skipped, and the observer is disconnected in English. `<html lang>` follows the choice (`en`, `vi`, `ko`).
- Godot (frozen at 2026-10-01) uses its own copy at data/vi.json; it has no Korean. scripts/language_translation.gd provides a [Godot Translation resource](https://docs.godotengine.org/en/stable/classes/class_translation.html) for native controls; custom-drawn command captions use tr().
- The catalogs cover menus, command labels, object names/descriptions, training, objectives and gameplay feedback. Full-message patterns preserve numbers and translate embedded object names. Unknown text falls back to its English source.
- Compact labels such as **Thợ mỏ**, **Tiến đánh**, **Nhà máy** / **채굴기**, **공격 이동**, **공장** fit the command tiles. Descriptions and tooltips carry longer explanations.
- The Three.js start screen and Settings use one dropdown (`#language`, `[data-setting="language"]`) with all three languages; picking one applies it at once.

### Korean specifics

- **Font.** The game's faces (Baloo 2, the Inter / Segoe UI / Arial stacks) have no Hangul. `src/language.css` declares "Frontier KR" — Noto Sans KR (OFL, `src/fonts/NotoSansKR-OFL.txt`), variable weight 400–800, cut by `tools/subset-korean-font.py` to the ~800 syllables the Korean catalogs use (about 92 KB, one woff2). Its `unicode-range` is Hangul only, and it is named only in the font stacks under `:root[lang="ko"]`, so English and Vietnamese players never fetch it; Latin letters and digits keep the usual faces. No stack uses system-ui (CI is Linux).
- **New Korean text needs the font rebuilt:** `python tools/subset-korean-font.py <NotoSansKR[wght].ttf>` (source: google/fonts `ofl/notosanskr`). `tests/i18n-ko.test.js` fails while a catalog uses a syllable the font lacks.
- **Offline.** The Korean catalogs and font are not in the service-worker precache (they would cost every player ~360 KB); the worker keeps each in the shell cache on its first fetch (`LAZY` in `tools/sw.template.js`).
- **Particles.** Pattern targets write `{1}을(를)`, `이(가)`, `은(는)`, `와(과)`, `(으)로` where the filled-in word is unknown; `koreanParticles` in `i18n.js` keeps the form that fits the final syllable (digits read as Sino-Korean numbers).
- **Names.** Proper names alone (Meridian, Ashfall, Okoro, …) have no Vietnamese entry; the Korean story catalog carries them as extra name-only entries.

## Korean glossary

Use these forms everywhere (UI, story, patterns). Tone: concise labels like Korean RTS games; instructions in polite 해요/하세요; officers address the player as **사령관님**.

| Kind | English | Korean |
|---|---|---|
| Factions | Meridian / Meridian Expedition | 메리디언 / 메리디언 원정대 |
| | Ashfall / Ashfall Combine | 애시폴 / 애시폴 연합 |
| | Sunward / Sunward Caravan / the Caravan | 선워드 / 선워드 대상단 / 대상단 |
| | Veil / The Veil / Veil Survey | 장막 / 장막 / 장막 탐사단 (not 베일: that is Vale) |
| | Wardens / Warden-prime | 워든 / 워든 프라임 |
| | the Pact / The Verdant Pact | 협약군 / 초록 협약 |
| People | Mira Vale, Tobi Okoro, Corvin Hale, Tamsin Sol, Ilse Maren, ECHO | 미라 베일, 토비 오코로, 코빈 헤일, 탬신 솔, 일제 마렌, ECHO |
| | Commander / Director (Hale) / Captain (Sol) / Archivist / Surveyor / Foreman / Wagon-master | 사령관 / 총재 / 대장 / 기록관 / 탐사원 / 작업반장 / 마차대장 |
| World | Builders / Lattice / Keystone / relay / The Sovereign | 건설자 / 격자망 / 키스톤 / 중계소 / 소버린 |
| | siphon / damper / jammer / vault / crawler / sleepers | 사이펀 / 억제기 / 교란기 / 보관고 / 궤도차 / 동면자 |
| Places | Outpost Meridian / Meridian Riverlands / Ashen Frontier / The Ashen Line | 메리디언 전초기지 / 메리디언 강변 지대 / 잿빛 변경 / 잿빛 방어선 |
| | Amber Dunes / Copper Basin / Obsidian Highlands / Frontier Expanse / Twin Bridges / Gorge Road | 호박빛 사구 / 구리 분지 / 흑요석 고원 / 변경 대평원 / 쌍둥이 다리 / 협곡 도로 |
| | "day 4" in a place line | 4일차 |
| Resources, HUD | Alloy / Energy / Crystal / Population, Crew / Supply | 합금 / 에너지 / 크리스탈 / 인구 / 보급 |
| | HP / Shield / Armour, Plating / Damage / Range | 체력 / 보호막 / 장갑 / 피해 / 사거리 |
| Modes | Campaign / Skirmish / Frontier Defence / Training / Mission / Objective | 캠페인 / 교전 / 프런티어 방어전 (방어전) / 훈련 / 임무 / 목표 |
| | Wave / Lives / Stars / Endless / Daily / Heroic / Elite | 웨이브 / 생명 / 별 / 무한 / 일일 / 영웅 / 정예 |
| | Story / Standard / Veteran; Relaxed / Normal / Fast / Relentless | 스토리 / 표준 / 베테랑; 느긋함 / 보통 / 빠름 / 맹공 |
| Units | Harvester / Vanguard / Ranger / Breaker / Medic / Engineer | 채굴기 / 선봉대 / 레인저 / 브레이커 / 의무병 / 공병 |
| | Battle tank / Anti-tank soldier / Rocket battery | 전차 / 대전차병 / 로켓 포대 |
| | Scrapper / Scorcher / Rider / Supply wagon / Sentinel drone / Walker / Shade / Watcher | 스크래퍼 / 스코처 / 라이더 / 보급 마차 / 센티널 드론 / 워커 / 셰이드 / 감시자 |
| | Kite / Hawk gunship / flyers | 카이트 / 호크 건십 / 비행 유닛 |
| Buildings | Command core / HQ / Supply relay / Barracks / Foundry | 사령부 / HQ / 보급 중계소 / 병영 / 공장 |
| | Sentinel tower / Ranger nest / Breaker mortar / Anti-tank post / Watcher post | 센티널 타워 / 레인저 둥지 / 브레이커 박격포 / 대전차 초소 / 감시 초소 |
| | Salvage yard / Waystation / Shield pylon / Veil relay / Concrete wall | 고철 야적장 / 중간 기지 / 보호막 파일런 / 장막 중계소 / 콘크리트 벽 |
| Defence | Ground pad / Rim pad / Deep pad / Garrison | 지상 자리 / 가장자리 자리 / 깊은 자리 / 주둔지 |
| | Marksman / Suppressor / Cluster / Breacher | 명사수 / 제압형 / 집속탄 / 관통 |
| Orders | Move / Attack / Attack-move / Patrol / Stop / Hold / Repair / Heal / Rally / Gather / Build / Sell | 이동 / 공격 / 공격 이동 / 정찰 / 정지 / 위치 사수 / 수리 / 치료 / 집결 / 채굴 / 건설 / 판매 |
| | Guard / Aggressive (stances) | 경계 / 추격 |
| Abilities | Shield wall / Rapid fire / Barrage / Overdrive / Lock-on / Triage pulse / Field repair | 방패벽 / 속사 / 포격 / 오버드라이브 / 락온 / 응급 파동 / 야전 수리 |
| Screens | Selection / Actions / Map (phone dock) / battlefield map | 선택 / 행동 / 지도 / 맵 (New game / choose map = 새 게임 / 맵 선택) |

Rules: numbers, `{1}` placeholders, `·`, `—`, key names (Q, E, WASD, Shift…) and level marks (L2, II) stay as in English; decimals keep the point (0.3초); a number the English spells out stays a Korean word (열, 두 배). Command-tile names ≤ 6 syllables, status sub-lines (L2 필요) ≤ 6.

## Extending translations

Add exact English pairs to messages in **both** vi.json and ko.json (and the story catalogs for story text). Use an anchored regular expression in patterns for dynamic text and {1}, {2}, etc. for captured values; ko.json keeps the same patterns in the same order as vi.json. Put specific patterns before general ones; avoid matching a common word anywhere inside a sentence.

Keep shortcuts, entity IDs and simulation data unchanged. Do not translate resource/type keys before game logic compares them. For DOM text comparisons, compare the canonical source or its translated presentation explicitly. Text inside `translate="no"` is never translated: do not use it for names that Korean writes in Hangul.

## Checks

- Three.js: npm test (i18n-coverage checks vi and ko; i18n-ko checks key/pattern parity with vi, numbers, placeholders, names, Hangul and font coverage), npm run build, npm run test:language (Vietnamese and Korean, tests/language-ko.mjs).
- Godot: headless tests/language_test.gd, Web export, npm run test:language.
- Browser checks cover saved language, reverting Settings drafts, switching during active production, readable command labels, the Korean font loading, 11 px text, 44 px taps and no sideways scroll on desktop/phone layouts. The release workflows include the language checks.
- Mobile browser checks emulate touch; they are not physical Android performance measurements.
