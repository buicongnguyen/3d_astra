# Phone battle screen review

The before measurements and screenshots were taken on 3a065f5. The two subsequent CI commits through bc72711 changed only browser tests. The after measurements and screenshots were refreshed on the branch rebased onto bc72711. Measured the production Vite build using tools/phone-hud-audit.mjs on port 4240. Each value is the percentage of 800 viewport samples hitting the battlefield canvas in emulated Chromium. The selection states are settled. Opening notices, the expanded minimap and open objectives have different footprints. A dash means the audit found no eligible selection.

## Findings

- Both landscape baselines already exceeded 65% empty and 55% with one unit. The layout work there removes redundant Defence tabs and keeps the side dock within its original height.
- On 320 × 568 the selected-unit header shares its existing row with Map and Objectives, or the Defence minimap. Stats stack their labels above their values. Ability and stance labels fit within the 44 px action row.
- Defence displays the wave, the next-wave countdown or live enemy count, and labelled controls. The minimap supports pan, Home and direct enlargement.
- Short results use a scrollable record above a separate footer. The short setup puts Start after list content and reserves scroll clearance. Last-control and footer hit checks passed on 844 × 390, 740 × 360 and 320 × 568.

## English scene share

| Viewport / mode | Empty: before → after | One unit | Mixed | Building |
| --- | ---: | ---: | ---: | ---: |
| portrait390/skirmish | 84.6 → 84.6 | 69.0 → 69.0 | 69.0 → 69.0 | 69.0 → 69.0 |
| portrait390/mission | 84.4 → 84.4 | 68.8 → 68.8 | 68.8 → 68.8 | 68.8 → 68.8 |
| portrait390/defence | 86.5 → 88.0 | 71.0 → 72.8 | — | 76.0 → 77.8 |
| portrait360/skirmish | 82.3 → 82.3 | 64.1 → 64.1 | 64.1 → 64.1 | 64.1 → 64.1 |
| portrait360/mission | 82.0 → 82.0 | 63.9 → 63.9 | 63.9 → 63.9 | 63.9 → 63.9 |
| portrait360/defence | 85.5 → 86.9 | 67.8 → 69.3 | — | 70.5 → 71.9 |
| landscape844/skirmish | 81.6 → 81.6 | 68.3 → 68.3 | 63.9 → 63.9 | 68.3 → 68.3 |
| landscape844/mission | 81.6 → 81.6 | 68.3 → 68.3 | 63.9 → 63.9 | 71.3 → 71.3 |
| landscape844/defence | 84.9 → 88.1 | 71.0 → 75.3 | — | 71.0 → 75.3 |
| landscape740/skirmish | 79.6 → 79.6 | 65.0 → 65.0 | 60.4 → 60.4 | 63.4 → 63.4 |
| landscape740/mission | 79.6 → 79.6 | 65.0 → 65.0 | 60.4 → 60.4 | 68.3 → 68.3 |
| landscape740/defence | 79.6 → 84.1 | 67.6 → 70.9 | — | 67.6 → 70.9 |
| small320/skirmish | 76.5 → 76.5 | 49.8 → 59.6 | 42.1 → 49.8 | 49.8 → 49.8 |
| small320/mission | 76.1 → 76.1 | 49.4 → 59.3 | 41.8 → 49.4 | 49.4 → 49.4 |
| small320/defence | 81.3 → 81.1 | 49.3 → 57.5 | — | 61.4 → 63.6 |

## Localized scene share

Each cell lists empty / one unit / mixed / building.

| Viewport / mode | Vietnamese (%) | Korean (%) |
| --- | --- | --- |
| portrait390/skirmish | 84.6 / 69.0 / 69.0 / 69.0 | 84.6 / 69.0 / 69.0 / 69.0 |
| portrait390/mission | 84.4 / 68.8 / 68.8 / 68.8 | 84.4 / 68.8 / 68.8 / 68.8 |
| portrait390/defence | 88.3 / 72.8 / — / 77.8 | 88.0 / 72.8 / — / 77.8 |
| portrait360/skirmish | 82.3 / 64.1 / 64.1 / 64.1 | 82.3 / 64.1 / 64.1 / 64.1 |
| portrait360/mission | 82.0 / 63.9 / 63.9 / 63.9 | 82.0 / 63.9 / 63.9 / 63.9 |
| portrait360/defence | 87.5 / 67.5 / — / 72.5 | 86.9 / 69.3 / — / 71.9 |
| landscape844/skirmish | 81.6 / 68.3 / 63.9 / 68.3 | 81.6 / 68.3 / 63.9 / 68.3 |
| landscape844/mission | 81.6 / 68.3 / 63.9 / 71.3 | 81.6 / 68.3 / 63.9 / 71.3 |
| landscape844/defence | 88.1 / 75.3 / — / 75.3 | 88.1 / 75.3 / — / 75.3 |
| landscape740/skirmish | 79.6 / 65.0 / 60.4 / 63.4 | 79.6 / 65.0 / 60.4 / 63.4 |
| landscape740/mission | 79.6 / 65.0 / 60.4 / 68.3 | 79.6 / 65.0 / 60.4 / 68.3 |
| landscape740/defence | 84.1 / 70.9 / — / 70.9 | 84.1 / 70.9 / — / 70.9 |
| small320/skirmish | 76.5 / 59.6 / 49.8 / 49.8 | 76.5 / 59.6 / 49.8 / 49.8 |
| small320/mission | 76.1 / 59.3 / 49.4 / 49.4 | 76.1 / 59.3 / 49.4 / 49.4 |
| small320/defence | 81.1 / 57.5 / — / 61.3 | 81.1 / 57.5 / — / 63.6 |

## Verification

The three final audits reported zero sub-11 px text, undersized taps, clipped labels, sideways page scroll or page errors in the sampled states. No measured dock grew. The rectangle detector flags the Objectives button and Defence minimap inside the reserved right edge of the 320 px selection header. The header reserves that area for those controls.

Unit tests: 1,083 passed, 28 skipped, 0 failed. Browser suites: cover-ui, ui-quality, phones, mobile, mobile-controls, mobile-gestures, mobile-construction, selection, defence, defence-onboarding, defence-zones, status-layout, layout-f, language and fullscreen. All passed. Validation used emulated phones. Physical iOS Safari and Android touch testing remains open.

## Screenshots

For each viewport, compare the before and after files for the same selection. Result proofs show the end of the scroll area with the footer pinned.
- 390x844 skirmish · [Before](390x844-skirmish-one-before.jpg) / [After](390x844-skirmish-one-after.jpg)
- 390x844 defence · [Before](390x844-defence-one-before.jpg) / [After](390x844-defence-one-after.jpg)
- 844x390 skirmish · [Before](844x390-skirmish-one-before.jpg) / [After](844x390-skirmish-one-after.jpg)
- 844x390 defence · [Before](844x390-defence-one-before.jpg) / [After](844x390-defence-one-after.jpg)
- 320x568 skirmish · [Before](320x568-skirmish-one-before.jpg) / [After](320x568-skirmish-one-after.jpg)
- 320x568 defence · [Before](320x568-defence-one-before.jpg) / [After](320x568-defence-one-after.jpg)
- [Result at 320 × 568](result-320x568.jpg)
- [Result at 740 × 360](result-740x360.jpg)
- [Result at 844 × 390](result-844x390.jpg)
