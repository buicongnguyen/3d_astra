# Frontier Command

An original stylized 3D RTS inspired by economic base-building and tactical unit combat.

Now includes customizable army colors, saved settings, and the Riverlands battlefield with bridges, a ford, varied ground and Blender scenery. [Evaluation and release review](github-io/EVALUATION_AND_RELEASE.md).

[Play on desktop, phone, or tablet](https://buicongnguyen.github.io/3d_astra/). Touch controls include tap commands, drag pan, pinch zoom, and portrait/landscape layouts.

Desktop players can use **B** for construction, **Q E R T Y** for the displayed build/train actions, **F2** for army selection, and **H/J/K** for production buildings. Open **PC commands & selection** in the game or read the [full shortcut reference](github-io/docs/PC_SHORTCUTS.md).

[Read and copy the complete game-building prompt](https://buicongnguyen.github.io/3d_astra/prompt/), [download it as Markdown](https://buicongnguyen.github.io/3d_astra/RECREATE_GAME_PROMPT.md), or [read the source in this repository](RECREATE_GAME_PROMPT.md). The website publishes this source file during each build.

![Frontier Command preview](github-io/docs/preview.png)

- **Active project:** [`github-io/`](github-io/) — Three.js browser game with Blender-generated assets, built for GitHub Pages.
- **Browser implementation plan:** [`github-io/PLAN.md`](github-io/PLAN.md).
- **Logic and code review:** [`github-io/CODE_REVIEW.md`](github-io/CODE_REVIEW.md).
- **Deferred project:** [`GODOT_BLENDER_PLAN.md`](GODOT_BLENDER_PLAN.md) — Godot + Blender implementation to undertake later.
- **Original design:** [`RTS_GAME_PLAN.md`](RTS_GAME_PLAN.md).

## Run the browser game

```sh
cd github-io
npm ci
npm run dev
```

Open the local address printed by Vite. `npm run build` creates the static site in `github-io/dist/`. No server, API keys, accounts, or external asset services are needed by the deployed game.

See the browser project's README for controls, assets, tests, and deployment.
