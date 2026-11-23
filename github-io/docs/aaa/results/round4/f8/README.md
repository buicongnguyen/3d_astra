# Dune Wyrm and Wyrmling art review

The prototype uses a cool teal back, dark segment bands and a cream jaw and belly. Both creatures have rounded muzzles, amber eyes with pupils, curved tusks and a fan with a faction-coloured edge. The nest guard has a shorter crest and no saddle. The generator uses 1.4 times the old body radius and 1.6 times the old head reference radius.

| Prototype model | Triangles | Budget | Materials | GLB size |
| --- | ---: | ---: | ---: | ---: |
| Dune Wyrm | 3,056 | 3,200 | 5 | 189,528 bytes |
| Wyrmling | 2,500 | 2,600 | 5 | 159,320 bytes |

The [biome sheet](biome-crops.png) shows a native 44 by 24 pixel game capture above each enlarged crop. The background is the actual terrain from Verdant Crossing or Amber Dunes. The adult wears Meridian paint and the young one wears its wild nest colour. The review camera frames each animal at 22 pixels tall, leaving a small margin, and hides the strategic icon for these crops.

The [390 by 844 phone capture](ambush-phone.png) shows the normal game interface at 250 ms. The [four-frame ambush strip](ambush-strip.png) follows the actual Ambush ability at 0, 100, 250 and 450 ms. A dark hollow opens before the creature rises. Ground-coloured dust and grains reach 35 percent opacity and settle within half a second. The reduced-motion setting retains the opening and skips the rising motion and sand spray.

Run `tools/review-wyrms.mjs` from the game directory with `TEST_URL` set to the local prototype. The fixture checks the projected silhouette height and the eight-particle Eco fountain. The art is pending owner review.
