# Mobile usability and performance audit

## Delivered

- Selection details scroll independently; Info, Support, Move, Attack-move and Stop remain in a fixed action bar.
- Training/build tiles fit the compact dock, with building upgrade controls in a fixed footer.
- Briefing text scrolls while battlefield selection, Settings and Deploy remain visible.
- Touch instructions explain tapping and the Selection tab.
- Existing Eco mode caps rendering at device pixel ratio 1 and disables shadows.

## Verification

`npm run test:mobile-controls` checks 320×568, 390×844, 667×375, 844×390 and 768×1024. It inspects control bounds and browser hit testing, then uses raw touch coordinates without automatic scrolling. Worker construction, headquarters/barracks production, upgrades, Medic support, field-guide closure, toolbar controls, tabs and briefing actions are covered. This test also runs before GitHub Pages deployment.

The 42 simulation tests, production build, desktop, mobile gesture, settings/improvement, progression and WebKit suites passed locally. WebKit on Windows is an emulation check, not certification of iOS Safari.

## Performance sample

Chrome 152, RTX 4080 SUPER desktop GPU, 390×844 viewport, DPR 3, Eco mode, 4× CPU throttling. Sampled 129 animation-frame intervals after warm-up. AI disabled, stationary friendly army; this does not measure a sustained battle or phone thermals.

| Friendly units | Median frame | 95th percentile | Draw calls |
|---|---:|---:|---:|
| 7 | 16.7 ms | 16.8 ms | 146 |
| 100 | 16.7 ms | 16.9 ms | 970 |

The sample is consistent with roughly 60 FPS on this proxy. Physical Android/iPhone performance, browser chrome, notches and long-session thermal throttling still require real-device testing. A useful next check is a 15-minute 50–100-unit battle on a midrange Android device and iPhone, with orientation changes and background/resume.
