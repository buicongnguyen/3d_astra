"""Write final/manifest.json from finalize.py's report and check the size budget. demucs-venv.
python make_manifest.py <finalize-report.json> <final_dir> <generation-log.json>"""
import json, os, sys

REP, FIN, LOG = sys.argv[1:4]
rep = json.load(open(REP, encoding="utf-8"))
log = json.load(open(LOG, encoding="utf-8"))
BUDGET = {"title": 650_000, "campaign": 550_000, "defence": 550_000, "victory": 80_000, "defeat": 80_000}
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
    tracks[name] = t
    total += t["bytes"]
    if t["bytes"] > BUDGET[name]:
        problems.append(f"{name} {t['bytes']} > {BUDGET[name]}")
    if r["true_peak_db"] > -1.5 or abs(r["lufs"] + 16) > 0.5:
        problems.append(f"{name} loudness {r['lufs']} LUFS / {r['true_peak_db']} dBTP")
man = {"generated": "2026-11-13", "model": "ACE-Step 1.5 (acestep-v15-turbo + acestep-5Hz-lm-1.7B), MIT",
       "notes": "loopStart/loopEnd are seconds in the decoded file (AAC priming already removed by the MP4 edit list, verified by "
                "aligning the ffmpeg-decoded file against the mastered wav: offset 0 samples). Files have a 0.15 s lead-in copied from "
                "the loop tail and a 0.6 s tail copied from the loop head, so a decoder that ignores the edit list (1024-sample "
                "priming) still loops cleanly - only both points shift by 1024/48000 s. Use AudioBufferSourceNode.loop with "
                "loopStart/loopEnd and start(0, loopStart).",
       "totalBytes": total, "tracks": tracks}
json.dump(man, open(os.path.join(FIN, "manifest.json"), "w", encoding="utf-8"), indent=1, ensure_ascii=False)
print("total", total, "bytes;", "problems:", problems or "none")
