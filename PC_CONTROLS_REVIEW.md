# PC controls review — 13 September 2026

Both editions use the same core mouse conventions as StarCraft. The keyboard
layout remains specific to Frontier Command: WASD pans the camera, F activates
Attack-move, and X stops units. This is not a complete StarCraft control scheme;
Hold Position, arbitrary friendly-unit Follow and enemy inspection are separate
future features.

## Mouse contract

| Input | Behavior in both editions |
| --- | --- |
| Left-click friendly object | Select it without issuing an order |
| Left-drag on terrain | Select friendly units inside the box |
| Shift + left-click | Add/remove a unit; empty ground preserves selection |
| Ctrl-click or double-click unit | Select that type on the visible battlefield, excluding offscreen units |
| Shift + same-type selection | Add/remove that visible type from the group |
| Right-click ground | Move immediately, replacing combat orders so units can withdraw |
| Right-click enemy | Combat units attack; noncombat support units move to the destination |
| Right-click resource / construction | Harvesters gather / construct; other units move |
| Right-click friendly object | Compatible Medics/Engineers support; other selected units move |
| F, then left-click | Attack-move on ground; direct Attack on a visible enemy |
| Right-click or Esc during targeting / placement | Cancel targeting without replacing orders or spending resources |
| Shift while issuing an order | Append to the unit's queue, including minimap destinations |
| Minimap left-click | Pan camera, or confirm a pending destination order |
| Minimap right-click | Move units, or set a rally for selected production buildings |

## Corrections from code and logic review

- Godot no longer executes an order when right-click should cancel targeting.
- Minimap cancellation and destination commands follow the same rules as terrain.
- Godot production buildings can receive minimap rally points. Three.js no longer
  assigns rallies to nonproduction structures or incidentally with selected units.
- Same-type mouse selection works in both editions and excludes offscreen units.
- Shift-click on empty ground preserves Godot selection.
- Mixed groups dispatch worker, combat and support commands only to capable units.
- Attack-move targeting can focus a specific enemy instead of ignoring the target.
- Releasing a mouse drag over the HUD cannot issue an order through that panel.

The shared `tests/pc-controls.mjs` exercises actual browser mouse and keyboard
events against each exported game, with the simulation clock frozen for stable
order assertions. Both deployment workflows run this regression check.

## GitHub Actions runtime migration

Both workflows now use these official releases:

| Action | Release |
| --- | --- |
| checkout | v7.0.1 |
| setup-node | v7.0.0 |
| upload-artifact | v7.0.1 |
| download-artifact (Three.js) | v8.0.1 |
| configure-pages | v6.0.0 |
| upload-pages-artifact | v5.0.0 |
| deploy-pages | v5.0.1 |

The JavaScript actions declare Node.js 24 in their manifests. The Pages upload
composite uses the updated artifact uploader. Application builds still use
Node.js 22; changing that version alone would not fix the actions' runtime warning.
Warnings already recorded in historical workflow runs remain historical records.

## Reference behavior

- [Blizzard: Basic Unit Controls](https://news.blizzard.com/en-us/article/4552956/game-guide-basic-unit-controls)
- [Blizzard: StarCraft controls](https://classic.battle.net/scc/gs/control.shtml)
- [GitHub: Node.js 20 action-runtime deprecation](https://github.blog/changelog/2025-09-19-deprecation-of-node-20-on-github-actions-runners/)
