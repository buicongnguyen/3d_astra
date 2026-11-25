"""Write final/manifest.json from finalize.py's report and check the size budget. demucs-venv.
python make_manifest.py <finalize-report.json> <final_dir> <generation-log.json>
An existing <final_dir>/manifest.json is merged: tracks not in the report stay as they are (2026-11-26: the faction
themes and stingers were added to the 2026-11-13 set this way)."""
import json, os, sys

REP, FIN, LOG = sys.argv[1:4]
rep = json.load(open(REP, encoding="utf-8"))
log = json.load(open(LOG, encoding="utf-8"))
BUDGET = {"title": 650_000, "campaign": 550_000, "defence": 550_000, "victory": 80_000, "defeat": 80_000}
budget = lambda name: BUDGET.get(name) or (500_000 if name.startswith("theme-") else 50_000 if name.startswith("stinger-") else 0)
old_path = os.path.join(FIN, "manifest.json")
old = json.load(open(old_path, encoding="utf-8")) if os.path.exists(old_path) else None
tracks, total, problems = {}, 0, []
for name, r in rep.items():
    e = next(x for x in log if f'{x["id"]}:{x["seed"]}' == r["take"] and x["ok"])
    t = {"file": f"{name}.m4a", "bytes": os.path.getsize(os.path.join(FIN, f"{name}.m4a")), "lufs": r["lufs"], "truePeakDb": r["true_peak_db"],
         "seconds": r["file_seconds"], "sampleRate": 48000, "channels": 2, "codec": "AAC-LC 64 kbps"}
    if "loopStart" in r:
        t.update(loopStart=r["loopStart"], loopEnd=r["loopEnd"], loopStartSample=r["loopStartSample"], loopEndSample=r["loopEndSample"],
                 bpm=r["bpm_loop"], bars=r["bars"], loop=True)
    else:
        t.update(bpm=e["bpm"], loop=False)
    t["source"] = dict(seed=e["seed"], shift=e["shift"], caption=e["caption"], sections=e["lyrics"], requestedBpm=e["bpm"], key=e["key"],
                       duration=e["duration"], steps=e["steps"], dit=e["dit"], lm=e["lm"], cot=False, instrumental=True)
    if old:
        t["generated"] = os.environ.get("GENERATED", "2026-11-26")
    tracks[name] = t
    total += t["bytes"]
    if t["bytes"] > budget(name):
        problems.append(f"{name} {t['bytes']} > {budget(name)}")
    if r["true_peak_db"] > -1.5 or abs(r["lufs"] + 16) > 0.5:
        problems.append(f"{name} loudness {r['lufs']} LUFS / {r['true_peak_db']} dBTP")
if old:
    for name, t in old["tracks"].items():
        if name not in tracks:
            tracks[name] = t
            total += t["bytes"]
    tracks = dict(sorted(tracks.items(), key=lambda kv: (list(old["tracks"]).index(kv[0]) if kv[0] in old["tracks"] else len(old["tracks"]))))
man = {"generated": "2026-11-13", "model": "ACE-Step 1.5 (acestep-v15-turbo + acestep-5Hz-lm-1.7B), MIT",
       "notes": "loopStart/loopEnd are seconds in the decoded file (AAC priming already removed by the MP4 edit list, verified by "
                "aligning the ffmpeg-decoded file against the mastered wav: offset 0 samples). Files have a 0.15 s lead-in copied from "
                "the loop tail and a 0.6 s tail copied from the loop head, so a decoder that ignores the edit list (1024-sample "
                "priming) still loops cleanly - only both points shift by 1024/48000 s. Use AudioBufferSourceNode.loop with "
                "loopStart/loopEnd and start(0, loopStart).",
       "totalBytes": total, "tracks": tracks}
if old:
    man["model"] = old["model"] + "; faction themes and stingers (2026-11-26): acestep-v15-xl-turbo + acestep-5Hz-lm-1.7B, MIT (see each track's source)"
json.dump(man, open(os.path.join(FIN, "manifest.json"), "w", encoding="utf-8"), indent=1, ensure_ascii=False)
print("total", total, "bytes;", "problems:", problems or "none")
