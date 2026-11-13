"""Rank scored takes per cue. python rank.py <scores.json> <rank.json>
Loop cues: score = 0.35 rep (4/16 s smoothed repetition at the loop lag) + 0.20 seam (2 s windows each side) +
 0.15 inner beat grid + 0.10 whole-take grid + 0.05 if measured tempo follows the requested bpm (or 1/2, 2x; 0.03 for a triplet x4/3 reading)
 - 0.12 if a quiet gap >= 0.5 s inside the loop (0.03 for 4+ short gaps) - harshness over 0.025 x4 - 0.1 clipping - 0.05 odd low-end balance.
Stings: 0.35 final triad share (lands on the home chord) + 0.15 tonic is the top pitch class + 0.2 phrase found +
 0.15 not cut off by the duration + 0.15 ending holds (final_hold_db >= -12) - harsh/clip penalties.
Weak flags are listed, never hidden."""
import json, sys
from collections import defaultdict

S = json.load(open(sys.argv[1], encoding="utf-8"))
out = defaultdict(list)
for k, r in S.items():
    flags = []
    harsh_p = max(0.0, r["harsh"] - 0.025) * 4
    clip_p = 0.1 if r["clip_share"] > 1e-4 else 0.0
    if r["harsh"] > 0.03: flags.append(f"harsh {r['harsh']:.3f}")
    if clip_p: flags.append("clipping")
    # power share under 250 Hz: 0.75-0.9 is normal for taiko/low strings/bass; flag only the extremes
    if r["low"] < 0.05 or r["low"] > 0.93: flags.append(f"low-end share {r['low']:.2f}")
    bal_p = 0.05 if (r["low"] < 0.05 or r["low"] > 0.93) else 0.0
    ratio = r.get("ratio") or 0
    follows = any(abs(ratio - m) < 0.04 * m for m in (0.5, 1.0, 2.0))
    # the tracker often locks onto a triplet pulse (x4/3, x2/3...); the loop still repeats at whole 4/4 bars of the requested bpm
    triplet = any(abs(ratio - m) < 0.04 * m for m in (4 / 3, 2 / 3, 3 / 4, 3 / 2, 8 / 3))
    if r.get("loop") is not None or r["cue"] in ("title", "campaign", "defence"):
        lp = r.get("loop")
        if not lp:
            out[r["cue"]].append(dict(key=k, score=0, flags=["no loop found"], **{x: r[x] for x in ("id", "arm", "seed", "shift")}))
            continue
        d = lp.get("dropouts_loop", 0)
        longd = lp.get("longest_dropout_s_loop", 0)
        drop_p = 0.12 if longd >= 0.5 else (0.03 if d >= 4 else 0.0)  # short gaps between plucks are normal in sparse cues
        sc = 0.35 * lp["rep"] + 0.20 * lp["seam"] + 0.15 * lp["inner_grid"] + 0.10 * r["grid"] \
            + (0.05 if follows else 0.03 if triplet else 0) - drop_p - harsh_p - clip_p - bal_p
        if lp["rep"] < 0.85: flags.append(f"weak repetition at seam {lp['rep']:.2f}")
        if lp["seam"] < 0.8: flags.append(f"seam mismatch {lp['seam']:.2f}")
        if lp["inner_grid"] < 0.9: flags.append(f"loose beat grid in loop {lp['inner_grid']:.2f}")
        if longd >= 0.5: flags.append(f"{d} quiet gap(s) in loop (longest {longd} s)")
        elif d >= 4: flags.append(f"{d} short quiet gaps in loop (sparse)")
        if triplet and not follows: flags.append(f"tracker reads a triplet pulse ({r['bpm']} bpm, x{ratio})")
        elif not follows: flags.append(f"tempo {r['bpm']} vs requested (x{ratio})")
        if lp["level_d_db"] > 2: flags.append(f"level step at seam {lp['level_d_db']} dB")
        row = dict(key=k, id=r["id"], arm=r["arm"], seed=r["seed"], shift=r["shift"], score=round(sc, 4), bpm=r["bpm"],
                   loop_bpm=lp["loop_bpm"], grid=r["grid"], rep=lp["rep"], seam=lp["seam"], inner_grid=lp["inner_grid"],
                   bars=lp["bars"], length=lp["length"], start=lp["start"], end=lp["end"], lufs=r["lufs"], harsh=r["harsh"],
                   low=r["low"], centroid=r["centroid"], dropouts_loop=d, level_spread_db=r["level_spread_db"], flags=flags)
    else:
        st = r["sting"]
        has = "start" in st
        sc = 0.35 * min(1.0, st["final_triad_share"] / 0.5) + (0.15 if st["final_top_pc_is_tonic"] else 0) + (0.2 if has else 0) \
            + (0.15 if not st["cut_by_duration"] else 0) + (0.15 if has and st.get("final_hold_db", -99) >= -12 else 0) - harsh_p - clip_p
        if not has: flags.append("no 5-8 s ending phrase found")
        if st["cut_by_duration"]: flags.append("audio cut by the duration (no natural ending)")
        if not st["final_top_pc_is_tonic"]: flags.append("final chord top note is not the tonic")
        if st["final_triad_share"] < 0.35: flags.append(f"weak home-chord landing {st['final_triad_share']:.2f}")
        if has and st.get("final_hold_db", 0) < -12: flags.append(f"ending fades early ({st['final_hold_db']} dB)")
        row = dict(key=k, id=r["id"], arm=r["arm"], seed=r["seed"], shift=r["shift"], score=round(sc, 4), bpm=r["bpm"],
                   lufs=r["lufs"], harsh=r["harsh"], low=r["low"], centroid=r["centroid"], flags=flags, phrase_score=st.get("score"), **{a: b for a, b in st.items() if a != "score"})
    out[r["cue"]].append(row)
for c in out:
    out[c].sort(key=lambda x: -x["score"])
json.dump(out, open(sys.argv[2], "w", encoding="utf-8"), indent=1)
for c, rows in out.items():
    print(f"== {c}")
    for x in rows:
        extra = f"rep {x.get('rep')} seam {x.get('seam')} bars {x.get('bars')} len {x.get('length')}" if "rep" in x else \
            f"phrase {x.get('start')}-{x.get('end')} triad {x.get('final_triad_share')} hold {x.get('final_hold_db')}"
        print(f"  {x['score']:.3f} {x['id']:12s} {x['seed']} bpm {x['bpm']} {extra} | {'; '.join(x['flags'])}")
