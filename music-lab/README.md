# Music lab (Frontier Command recorded music, 0.16)

How the five recorded cues in `github-io/public/music/` were made and chosen. Not part of the game
build (Pages deploys `github-io/dist/` only). Moved here from `3D_claudeopus55/experiments/music-frontier-1113`
on 2026-11-14 so each project keeps its own work.

- `listen/index.html`: blind, loudness-matched listen page with the shortlisted takes per cue and the
  chosen final. Open it in a browser (the audio is inside `listen/audio.js`; no server needed).
  `listen/key.json` reveals which take is which.
- `plan.json`: the cues (title, campaign, defence, victory, defeat), captions, bpm and loop rules.
- `scores/`: generation log, per-take scores (loop seam, beat steadiness, voice-like sound), ranking,
  shortlist, your listen picks and the final report.
- `tools/`: the pipeline. Every script takes its paths as arguments:
  `gen_frontier.py` (ACE-Step 1.5 batches; run from PowerShell, Git Bash crashes ACE-Step),
  `score_frontier.py`, `rank.py`, `finalize.py` (master to -16 LUFS, <= -1.5 dBTP, 64 kbps AAC,
  seamless loop cut), `make_manifest.py`, `build_listen.py` (rebuilds `listen/`, including the
  `listen/audio/` copies left out of git because `audio.js` already holds them).

Swapping a track: pick another take on the listen page, run `finalize.py` for it, copy the `.m4a` into
`github-io/public/music/` and update `github-io/public/music/manifest.json` (`make_manifest.py`).
The chosen finals live only in `github-io/public/music/` (the copy that was here was identical).

Temporary files for this project belong inside this repo (for example `music-lab/_work/`, which is
ignored), never in another project's folder.
