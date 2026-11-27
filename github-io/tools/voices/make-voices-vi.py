"""Vietnamese voices, step 2 of 2: the English post chain, a Whisper QA gate and the sprites.

Every raw VieNeu take in .tmp/voices-vi/raw (synth-vi.py) goes through the SAME chain as the English packs
(tools/voices/make-voices.py: trim -> faction FX -> squelch on unit replies -> loudness to TARGET_LUFS ->
fade), then a faster-whisper large-v3 round trip (language vi). A take passes when its CER against the
Vietnamese text is <= MAX_CER and its length is sane next to the English clip. The best take of each line
(passing, lowest CER, earliest attempt) goes into public/voices/vi/<faction>.mp3 (MP3 mono 24 kHz 32 kbps)
and src/voice-packs-vi.json (clip [start, length] in seconds, the same clip ids as voice-packs.json).
Lines that have no passing take yet are listed in .tmp/voices-vi/todo.json for synth-vi.py --only.

Run (from github-io/) with the voice_sync venv (numpy, scipy, pyloudnorm, av, faster_whisper, num2words):
    python -I -X utf8 tools/voices/make-voices-vi.py [--no-build]
QA results are cached per take in .tmp/voices-vi/qa.json (a rerun only listens to new takes).
"""
import argparse, importlib.util, json, re, unicodedata
from pathlib import Path
import numpy as np
from scipy import signal

HERE = Path(__file__).resolve().parent
spec = importlib.util.spec_from_file_location("mv", HERE / "make-voices.py")
mv = importlib.util.module_from_spec(spec); spec.loader.exec_module(mv)
GAME, SR = mv.GAME, mv.SR
WORK = GAME / ".tmp" / "voices-vi"
OUT_AUDIO = GAME / "public" / "voices" / "vi"
OUT_INDEX = GAME / "src" / "voice-packs-vi.json"
CAST = json.loads((HERE / "vi-cast.json").read_text(encoding="utf-8"))
MAX_CER = 0.05
# Vietnamese length next to the English clip (both processed): outside this, the take is garbled or cut.
RATIO = (0.5, 2.6)


def lines():
    vl = json.loads((GAME / "src/voice-lines.json").read_text(encoding="utf-8"))["factions"]
    vi = json.loads((GAME / "src/locales/vi.json").read_text(encoding="utf-8"))["messages"]
    out = []
    for f, d in vl.items():
        for group, who in (("ack", "unit"), ("ann", "announcer")):
            for kind, takes in d[group].items():
                for i, text in enumerate(takes):
                    out.append(dict(faction=f, cid=f"{group}.{kind}.{i}", en=text, vi=vi[text], kind=group, fx=d["fx"], voice=CAST[f][who]))
    return out


def norm(s):
    from num2words import num2words
    s = unicodedata.normalize("NFC", s.lower())
    s = re.sub(r"\d+", lambda m: " " + num2words(int(m.group()), lang="vi") + " ", s)
    s = re.sub(r"[^\w\s]", " ", s)
    return " ".join(s.split())


def lev(a, b):
    d = list(range(len(b) + 1))
    for i in range(1, len(a) + 1):
        prev, d[0] = d[0], i
        for j in range(1, len(b) + 1):
            cur = d[j]
            d[j] = min(d[j] + 1, d[j - 1] + 1, prev + (a[i - 1] != b[j - 1]))
            prev = cur
    return d[len(b)]


def read48(p):
    import soundfile as sf
    x, sr = sf.read(str(p), dtype="float32")
    from math import gcd
    g = gcd(sr, SR)
    return signal.resample_poly(x, SR // g, sr // g).astype(np.float32) if sr != SR else x


def process(raw, l, rng):
    y = mv.fx_chain(mv.trim(raw), l["fx"], rng, radio=(l["kind"] == "ack"))
    if l["kind"] == "ack":
        y = np.concatenate([mv.squelch(rng, l["fx"], 0.04, 0.16), np.zeros(int(0.015 * SR), np.float32), y,
                            np.zeros(int(0.02 * SR), np.float32), mv.squelch(rng, l["fx"], 0.07, 0.12)])
    return mv.fade(mv.loudness(y, mv.TARGET_LUFS[l["kind"]]))


def main():
    import soundfile as sf
    ap = argparse.ArgumentParser()
    ap.add_argument("--no-build", action="store_true")
    a = ap.parse_args()
    L = lines()
    en_idx = json.loads((GAME / "src/voice-packs.json").read_text(encoding="utf-8"))["packs"]
    qp = WORK / "qa.json"
    qa = json.loads(qp.read_text(encoding="utf-8")) if qp.exists() else {}
    model = None
    for l in L:
        for raw in sorted((WORK / "raw" / l["faction"]).glob(f"{l['cid']}.*.wav")):
            att = raw.stem.rsplit(".", 1)[1]
            key = f"{l['faction']}/{l['cid']}#{att}"
            out = WORK / "clips" / l["faction"] / f"{l['cid']}.{att}.wav"
            if key in qa and out.exists():
                continue
            rng = np.random.default_rng(sum(map(ord, key)) * 7919)
            y = process(read48(raw), l, rng)
            out.parent.mkdir(parents=True, exist_ok=True)
            sf.write(out, y, SR, subtype="PCM_16")
            if model is None:
                from faster_whisper import WhisperModel
                model = WhisperModel("large-v3", device="cuda", compute_type="float16")
            segs, _ = model.transcribe(str(out), language="vi", beam_size=5, condition_on_previous_text=False)
            heard = " ".join(s.text for s in segs).strip()
            ref, hyp = norm(l["vi"]), norm(heard)
            ratio = (len(y) / SR) / max(0.3, en_idx[l["faction"]]["clips"][l["cid"]][1] - 2 * mv.PAD)
            cer = round(lev(ref, hyp) / max(1, len(ref)), 3)
            qa[key] = {"vi": l["vi"], "heard": heard, "cer": cer, "seconds": round(len(y) / SR, 3), "ratio": round(ratio, 2),
                       "pass": cer <= MAX_CER and RATIO[0] <= ratio <= RATIO[1]}
            qp.write_text(json.dumps(qa, ensure_ascii=False, indent=1), encoding="utf-8")
    # The best take per line.
    best, todo = {}, []
    for l in L:
        takes = sorted(((v, k) for k, v in qa.items() if k.split("#")[0] == f"{l['faction']}/{l['cid']}"),
                       key=lambda t: (not t[0]["pass"], t[0]["cer"], int(t[1].split("#")[1])))
        if not takes:
            todo.append(f"{l['faction']}/{l['cid']}"); continue
        best[f"{l['faction']}/{l['cid']}"] = takes[0]
        if not takes[0][0]["pass"]:
            todo.append(f"{l['faction']}/{l['cid']}")
    (WORK / "todo.json").write_text(json.dumps(todo, ensure_ascii=False, indent=1), encoding="utf-8")
    (WORK / "best.json").write_text(json.dumps({k: {**v, "take": t} for k, (v, t) in best.items()}, ensure_ascii=False, indent=1), encoding="utf-8")
    for f in CAST:
        if f == "about":
            continue
        c = [best[k][0]["cer"] for k in best if k.startswith(f + "/")]
        print(f"{f}: {len(c)} lines, mean CER {np.mean(c) * 100:.2f}%, max {max(c) * 100:.1f}%, failing {sum(1 for t in todo if t.startswith(f + '/'))}")
    print(f"todo: {len(todo)}", todo)
    if a.no_build:
        return
    OUT_AUDIO.mkdir(parents=True, exist_ok=True)
    index = {"about": "Generated by tools/voices/make-voices-vi.py (after synth-vi.py): the Vietnamese faction packs, clip [start, length] in seconds inside public/voices/vi/<faction>.mp3 (already padded), the same clip ids as voice-packs.json. Do not edit by hand.",
             "engine": "VieNeu-TTS v3 Turbo (pnnbao-ump, Apache-2.0), preset voices, local",
             "codec": f"MP3 mono {SR} Hz {mv.BITRATE // 1000} kbps (libmp3lame)",
             "cast": {f: v for f, v in CAST.items() if f != "about"}, "totalBytes": 0, "packs": {}}
    for f in index["cast"]:
        parts, clips, t = [np.zeros(int(mv.GAP * SR), np.float32)], {}, mv.GAP
        for l in [l for l in L if l["faction"] == f]:
            att = best[f"{f}/{l['cid']}"][1].split("#")[1]
            y, _ = sf.read(str(WORK / "clips" / f / f"{l['cid']}.{att}.wav"), dtype="float32")
            clips[l["cid"]] = [round(max(0.0, t - mv.PAD), 3), round(len(y) / SR + 2 * mv.PAD, 3)]
            parts += [y, np.zeros(int(mv.GAP * SR), np.float32)]
            t += len(y) / SR + mv.GAP
        x = np.concatenate(parts)
        mp3 = OUT_AUDIO / f"{f}.mp3"
        mv.encode_mp3(x, mp3)
        index["packs"][f] = {"file": f"voices/vi/{f}.mp3", "bytes": mp3.stat().st_size, "seconds": round(len(x) / SR, 2), "clips": clips}
    index["totalBytes"] = sum(p["bytes"] for p in index["packs"].values())
    lines_out = ["{"] + [f" {json.dumps(k, ensure_ascii=False)}: {json.dumps(v, ensure_ascii=False, separators=(',', ':'))}," for k, v in index.items() if k != "packs"]
    lines_out.append(' "packs": {')
    items = list(index["packs"].items())
    for n, (k, v) in enumerate(items):
        lines_out.append(f"  {json.dumps(k)}: {json.dumps(v, separators=(',', ':'))}{',' if n < len(items) - 1 else ''}")
    lines_out += [" }", "}"]
    OUT_INDEX.write_text("\n".join(lines_out) + "\n", encoding="utf-8", newline="\n")
    import pyloudnorm as pyln
    for f in index["cast"]:
        en, vi = mv.decode(GAME / "public/voices" / f"{f}.mp3"), mv.decode(OUT_AUDIO / f"{f}.mp3")
        m = pyln.Meter(SR)
        print(f"{f}: EN {en_idx[f]['bytes']} B {m.integrated_loudness(en):.1f} LUFS | VI {index['packs'][f]['bytes']} B {m.integrated_loudness(vi):.1f} LUFS")


if __name__ == "__main__":
    main()
