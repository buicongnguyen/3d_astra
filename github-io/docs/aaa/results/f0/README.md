# F0 · live weapon comparison

[390×844 phone](phone.webp) · [1440×900 desktop](desktop.webp)

Each row compares identical shots, positions, zoom and timestamps against the original production bundle at `9cc366b`. Vanguard represents the requested rifle infantry. Its three-round burst uses a different rendering path from the Ranger's rifle. The Tank row includes the shell in flight and its impact. The phone viewport uses Chrome touch emulation at DPR 2.

| Cue | Live | Hotfix |
| --- | --- | --- |
| Vanguard burst round | 1.6 m long, 0.12 m wide | 0.4 m long, 0.03 m wide |
| Ranger atlas streak at the 100 px size floor | 100 px cell before orientation | 25 px cell, with the same aspect ratio |
| Moving round and tracer glow | Original brightness | 25% additive contribution |
| Basic rifle hit dust | Ground puff at 0.45 scale | Ground puff at 0.1125 scale |
| Shell in flight | Original mesh, atlas head and halo | 25% length and width for mesh, head and halo |
| Weapon contacts | Ground ring, shield circle or rings in impact artwork | Sparks, scorch or a ring-free impact sheet |

The thin Ranger streak is especially subtle against the bright bridge on the phone. The shell still produces a conspicuous fireball. This hotfix targets the bullet in flight, contact dust and the ring. Projectile timing, support beams, targeting guides and selection controls retain their original behaviour. Dark marks that linger after a splash hit are scorch decals.

The production build passed. Automated checks cover the live size floor at two zoom levels, both tracer dimensions and glow, the burst rifle path and travel time, retained gun dust and absence of ring-bearing impact sheets.
