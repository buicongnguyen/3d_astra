# Stillnote Encore (Piano_tutor) phone pass: scene-scale lessons

A chase-camera rhythm road over a sea with floating islets. Measured at 390×844 DPR 2 on the
medium tier, with real draws from `render-probe.mjs`. The full write-up is in
`Piano_tutor/docs/PERFORMANCE.md` (commit 4318c6b).

| Measure | Before | After |
|---|---:|---:|
| Stage real draws (post passes included) | 355 | 130 |
| Map real draws | 235 | 104 |
| Frames over 33 ms at CPU ÷4 (of ~120) | 36 | 1 |
| Uncapped SwiftShader frame | ~133 ms | ~80 ms |

1. **Bake per island root, keyed by finish.** Merge meshes that differ only in colour into one
   mesh per finish bucket (gloss, satin, matte, metal from roughness/metalness), with colour
   (material colour × COLOR_0 AO) in vertex colours (`src/game/render/bake.ts`).
   - Islets went from 13–36 draws to 3–7, and the destination from 150 to 23.
   - Keep `/Glow|Light/`, transparent and pivot subtrees separate.
   - A mesh with children is hidden with `layers.disableAll()`, not removed.
   - Pixel-identical by eye side by side; scenes animate, so pixel-diff wasn't usable.
2. **One material per kind of mesh.** An instanced mesh must not share its baked material with
   plain meshes. Give the instanced clouds their own material map.
3. **Phone tiers: swap physically based materials at kit load, not after spawn.** Game code
   holds material references (lane glows, tints). Converting the GLB kits once, before any clone,
   keeps those references valid. Writes to roughness or envMapIntensity on the stand-ins are
   ignored harmlessly.
   - Measured on the SwiftShader phone: scene pass 81.5 → 40 ms with Lambert.
   - Use Phong for gloss and metal to keep a sun highlight.
   - Skip the PMREM build when nothing physically based is drawn.
4. **The post chain was about 38% of the weak-GPU frame.**
   - Fold the colour grade into OutputPass: append to its fragment shader after the sRGB step.
     That's one full-screen pass with no intermediate buffer.
   - UnrealBloomPass always halves the size `setSize` is given. For quarter-res bloom, wrap
     `setSize` to pass w/2, h/2.
   - With a composer, canvas MSAA only smooths full-screen quads. Turn it off at DPR ≥ 2 (context
     attribute at creation).
5. **CPU: look for per-frame rewrites of static patterns.**
   - A scrolling curb strip (~520 instances plus a colour hex parse each) was rewritten every
     frame. A pattern repeating every 7 units can be written once, sliding the mesh by
     `((t*v) % 7 + 7) % 7`.
   - Loops over all beats and notes from index 0 → cursor that only advances; rescan if time goes
     back.
   - `stage.update`: 2.6 → 0.37 ms at CPU ÷4.
6. **Measuring pitfalls.**
   - Per-pass `readPixels` syncs don't isolate passes on SwiftShader: the work is deferred to the
     final readback, so measure the post chain as frame minus scene-only.
   - The governor had lowered the old build's resolution, so compare uncapped costs at the same
     pixel ratio.
   - Give the governor a 2 s grace after `attach()`.
7. **Budget guard.** An e2e check fails if a phone stage exceeds 170 draws (renderer.info with
   `autoReset=false`, reset at frame start) or the map exceeds 130, if any physically based
   material is drawn on the phone tier, if MSAA comes back at DPR 2, or if an islet holds more
   than 30 meshes.
