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

Phase 2, --story: the story lines (.tmp/voices-vi/story.json, tools/voices/story-lines-vi.mjs; raw takes from
synth-vi.py --story) go through the English story chain (the speaker's FX from src/voice-story.json, no radio,
loudness to TARGET_LUFS["story"]) and the same Whisper gate; QA cached in .tmp/voices-vi/qa-story.json, retries in
todo-story.json. One pack per English story pack (public/voices/vi/story-<id>.mp3, the same clip ids
"s.<storyHash(English text)>"), written into src/voice-packs-vi.json `story` / `packs` beside the faction packs.
Story lines name people and camps in English (Ashfall, Hale, ECHO...); Whisper spells such a name any way it
likes ("Ashford", "asphalt"), so for the CER a name of NAMES in the text matches any one or two heard words that
start with the same letter (the rest of the line is compared letter by letter as before), and the initial
consonants a Northern voice says alike (MERGE: tr/ch, s/x, r/d/gi) count as one. Digits Whisper writes with a
thousands dot (40.000) are read as one number.
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
FACTION_CAST = {f: v for f, v in CAST.items() if f in mv.FACTIONS}
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


# The English names the Vietnamese story text keeps (see --story above).
NAMES = ["Ashfall", "Meridian", "Hale", "Wardens", "Warden", "Sol", "Veil", "Hawk", "Sunward", "ECHO", "Okoro", "Teo",
         "Lind", "Vale", "Juno", "Astra", "Breaker", "Breakers", "Maren", "Rask", "Mira", "Tobi"]


def norm(s):
    from num2words import num2words
    s = unicodedata.normalize("NFC", s.lower())
    s = re.sub(r"(?<=\d)[.,](?=\d{3}\b)", "", s)  # Whisper writes 40.000 for "bốn mươi nghìn"
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


# Story QA only: initial consonants a Northern voice says alike (tr/ch, s/x, r/d/gi all one sound in Hanoi speech),
# so Whisper may write either; compared as one (like the English HEARD homophones). Tones and vowels still count.
MERGE = [("tr", "ch"), ("gi", "d"), ("r", "d"), ("s", "x")]


def merge_initials(s):
    out = []
    for w in s.split(" "):
        for a, b in MERGE:
            if w.startswith(a) and len(w) > len(a):
                w = b + w[len(a):]
                break
        out.append(w)
    return " ".join(out)


def story_cer(said, heard, names):
    ref, hyp = merge_initials(norm(said)), merge_initials(norm(heard))
    return round(lev_names(ref, hyp, {merge_initials(n) for n in names}) / max(1, len(ref)), 3)


def strip_marks(c):
    return unicodedata.normalize("NFD", c)[0].replace("đ", "d")


def lev_names(ref, hyp, names):
    """lev(ref, hyp), except that each word of `ref` in `names` (lower case) matches, at no cost, one or two whole
    words of `hyp` that start with the same letter (accents ignored). A name not heard costs its length."""
    toks, words = [], ref.split(" ")
    for wi, w in enumerate(words):
        if w in names:
            toks.append((strip_marks(w[0]), len(w)))
        else:
            toks.extend(w)
        if wi < len(words) - 1:
            toks.append(" ")
    m = len(hyp)
    # ends[j]: the starts a of hyp spans [a, j) made of one or two whole words.
    starts = [0] + [k + 1 for k, c in enumerate(hyp) if c == " "]
    stops = [k for k, c in enumerate(hyp) if c == " "] + [m]
    ends = {}
    for si, a in enumerate(starts):
        for take in (0, 1):
            if si + take < len(stops):
                ends.setdefault(stops[si + take], []).append(a)
    d = list(range(m + 1))
    for t in toks:
        prev = d
        if isinstance(t, tuple):
            first, size = t
            d = [prev[0] + size] + [0] * m
            for j in range(1, m + 1):
                best = min(prev[j] + size, d[j - 1] + 1)
                for a in ends.get(j, []):
                    if strip_marks(hyp[a]) == first:
                        best = min(best, prev[a])
                d[j] = best
        else:
            d = [prev[0] + 1] + [0] * m
            for j in range(1, m + 1):
                d[j] = min(prev[j] + 1, d[j - 1] + 1, prev[j - 1] + (t != hyp[j - 1]))
    return d[m]


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


def write_index(index):
    """voice-packs-vi.json: header keys one per line, one line per pack."""
    lines_out = ["{"] + [f" {json.dumps(k, ensure_ascii=False)}: {json.dumps(v, ensure_ascii=False, separators=(',', ':'))}," for k, v in index.items() if k != "packs"]
    lines_out.append(' "packs": {')
    items = list(index["packs"].items())
    for n, (k, v) in enumerate(items):
        lines_out.append(f"  {json.dumps(k)}: {json.dumps(v, separators=(',', ':'))}{',' if n < len(items) - 1 else ''}")
    lines_out += [" }", "}"]
    OUT_INDEX.write_text("\n".join(lines_out) + "\n", encoding="utf-8", newline="\n")


def spoken(text):
    """The words the voice says: the subtitle with vi-cast.json "spoken" respellings (synth-vi.py spoken)."""
    for a, b in CAST.get("spoken", {}).items():
        text = re.sub(rf"(?<!\w){re.escape(a)}(?!\w)", b, text)
    return text


def story_main(a):
    import soundfile as sf
    story = json.loads((GAME / "src/voice-story.json").read_text(encoding="utf-8"))
    L = json.loads((WORK / "story.json").read_text(encoding="utf-8"))
    en_idx = json.loads((GAME / "src/voice-packs.json").read_text(encoding="utf-8"))
    names = {norm(n) for n in NAMES}
    qp = WORK / "qa-story.json"
    qa = json.loads(qp.read_text(encoding="utf-8")) if qp.exists() else {}
    model = None
    for l in L:
        said = spoken(l["vi"])
        for raw in sorted((WORK / "raw" / l["pack"]).glob(f"{l['cid']}.*.wav")):
            att = raw.stem.rsplit(".", 1)[1]
            key = f"{l['pack']}/{l['cid']}#{att}"
            out = WORK / "clips" / l["pack"] / f"{l['cid']}.{att}.wav"
            if key in qa and out.exists():
                continue
            rng = np.random.default_rng(sum(map(ord, key)) * 7919)
            y = mv.fade(mv.loudness(mv.fx_chain(mv.trim(read48(raw)), story["fx"][l["who"]], rng, radio=False), mv.TARGET_LUFS["story"]))
            out.parent.mkdir(parents=True, exist_ok=True)
            sf.write(out, y, SR, subtype="PCM_16")
            if model is None:
                from faster_whisper import WhisperModel
                model = WhisperModel("large-v3", device="cuda", compute_type="float16")
            segs, _ = model.transcribe(str(out), language="vi", beam_size=5, condition_on_previous_text=False)
            heard = " ".join(s.text for s in segs).strip()
            ref, hyp = norm(said), norm(heard)
            en_len = en_idx["packs"][l["pack"]]["clips"][l["cid"]][1] - 2 * mv.PAD
            ratio = (len(y) / SR) / max(0.3, en_len)
            cer = story_cer(said, heard, names)
            qa[key] = {"vi": l["vi"], "said": said, "heard": heard, "cer": cer, "plainCer": round(lev(ref, hyp) / max(1, len(ref)), 3),
                       "seconds": round(len(y) / SR, 3), "ratio": round(ratio, 2), "pass": cer <= MAX_CER and RATIO[0] <= ratio <= RATIO[1]}
        qp.write_text(json.dumps(qa, ensure_ascii=False, indent=1), encoding="utf-8")
    # The gate is recomputed for every cached take (the rules above may have changed since it was heard).
    for v in qa.values():
        v["cer"] = story_cer(v["said"], v["heard"], names)
        v["pass"] = v["cer"] <= MAX_CER and RATIO[0] <= v["ratio"] <= RATIO[1]
    qp.write_text(json.dumps(qa, ensure_ascii=False, indent=1), encoding="utf-8")
    best, todo = {}, []
    for l in L:
        k0 = f"{l['pack']}/{l['cid']}"
        takes = sorted(((v, k) for k, v in qa.items() if k.split("#")[0] == k0), key=lambda t: (not t[0]["pass"], t[0]["cer"], int(t[1].split("#")[1])))
        if not takes:
            todo.append(k0)
            continue
        best[k0] = takes[0]
        if not takes[0][0]["pass"]:
            todo.append(k0)
    who = {f"{x['pack']}/{x['cid']}": x["who"] for x in L}
    (WORK / "todo-story.json").write_text(json.dumps(todo, ensure_ascii=False, indent=1), encoding="utf-8")
    (WORK / "best-story.json").write_text(json.dumps({k: {**v, "take": t, "who": who[k]} for k, (v, t) in best.items()}, ensure_ascii=False, indent=1), encoding="utf-8")
    c = [v[0]["cer"] for v in best.values()] or [0]
    print(f"story: {len(best)}/{len(L)} lines with a take, mean CER {np.mean(c) * 100:.2f}%, max {max(c) * 100:.1f}%, failing {len(todo)}")
    if a.no_build:
        return
    if len(best) < len(L):
        raise SystemExit("every story line needs a take before the packs are built")
    OUT_AUDIO.mkdir(parents=True, exist_ok=True)
    index = json.loads(OUT_INDEX.read_text(encoding="utf-8"))
    packs = {k: v for k, v in index["packs"].items() if not k.startswith("story-")}
    for old in OUT_AUDIO.glob("story-*.mp3"):
        old.unlink()
    for mid, m in story["missions"].items():
        for p in m["packs"]:
            name = p["name"]
            parts, clips, t = [np.zeros(int(mv.GAP * SR), np.float32)], {}, mv.GAP
            for l in [l for l in L if l["pack"] == name]:
                att = best[f"{name}/{l['cid']}"][1].split("#")[1]
                y, _ = sf.read(str(WORK / "clips" / name / f"{l['cid']}.{att}.wav"), dtype="float32")
                clips[l["cid"]] = [round(max(0.0, t - mv.PAD), 3), round(len(y) / SR + 2 * mv.PAD, 3)]
                parts += [y, np.zeros(int(mv.GAP * SR), np.float32)]
                t += len(y) / SR + mv.GAP
            x = np.concatenate(parts)
            mp3 = OUT_AUDIO / f"{name}.mp3"
            mv.encode_mp3(x, mp3)
            packs[name] = {"file": f"voices/vi/{name}.mp3", "bytes": mp3.stat().st_size, "seconds": round(len(x) / SR, 2), "clips": clips}
            print(f"{name}: {len(clips)} clips, {packs[name]['seconds']} s, {packs[name]['bytes']} bytes (EN {en_idx['packs'][name]['bytes']})", flush=True)
    index["about"] = ("Generated by tools/voices/make-voices-vi.py (after synth-vi.py): the Vietnamese faction packs and (--story) the story packs, "
                      "clip [start, length] in seconds inside public/voices/vi/<pack>.mp3 (already padded), the same clip ids as voice-packs.json; "
                      "`story` lists each mission's Vietnamese story packs (the English pack names). Do not edit by hand.")
    index["storyCast"] = {w: CAST["story"][w] for w in story["voices"] if w in CAST["story"]}
    index["story"] = {mid: [p["name"] for p in m["packs"]] for mid, m in story["missions"].items()}
    index["packs"] = packs
    index["totalBytes"] = sum(p["bytes"] for p in packs.values())
    index = {k: index[k] for k in ["about", "engine", "codec", "cast", "storyCast", "totalBytes", "story", "packs"]}
    write_index(index)
    sb = {k: v["bytes"] for k, v in packs.items() if k.startswith("story-")}
    eb = sum(v["bytes"] for k, v in en_idx["packs"].items() if k.startswith("story-"))
    print(f"story packs: {sum(sb.values())} bytes VI (EN {eb}), largest {max(sb.values())} ({max(sb, key=sb.get)})")


def main():
    import soundfile as sf
    ap = argparse.ArgumentParser()
    ap.add_argument("--no-build", action="store_true")
    ap.add_argument("--story", action="store_true")
    a = ap.parse_args()
    if a.story:
        return story_main(a)
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
    for f in FACTION_CAST:
        c = [best[k][0]["cer"] for k in best if k.startswith(f + "/")]
        print(f"{f}: {len(c)} lines, mean CER {np.mean(c) * 100:.2f}%, max {max(c) * 100:.1f}%, failing {sum(1 for t in todo if t.startswith(f + '/'))}")
    print(f"todo: {len(todo)}", todo)
    if a.no_build:
        return
    OUT_AUDIO.mkdir(parents=True, exist_ok=True)
    index = {"about": "Generated by tools/voices/make-voices-vi.py (after synth-vi.py): the Vietnamese faction packs, clip [start, length] in seconds inside public/voices/vi/<faction>.mp3 (already padded), the same clip ids as voice-packs.json. Do not edit by hand.",
             "engine": "VieNeu-TTS v3 Turbo (pnnbao-ump, Apache-2.0), preset voices, local",
             "codec": f"MP3 mono {SR} Hz {mv.BITRATE // 1000} kbps (libmp3lame)",
             "cast": FACTION_CAST, "totalBytes": 0, "packs": {}}
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
    # The story packs (--story) stay as they are.
    old = json.loads(OUT_INDEX.read_text(encoding="utf-8")) if OUT_INDEX.exists() else {}
    if old.get("story"):
        index["about"], index["storyCast"], index["story"] = old["about"], old["storyCast"], old["story"]
        index["packs"] |= {k: v for k, v in old["packs"].items() if k.startswith("story-")}
        index = {k: index[k] for k in ["about", "engine", "codec", "cast", "storyCast", "totalBytes", "story", "packs"]}
    index["totalBytes"] = sum(p["bytes"] for p in index["packs"].values())
    write_index(index)
    import pyloudnorm as pyln
    for f in index["cast"]:
        en, vi = mv.decode(GAME / "public/voices" / f"{f}.mp3"), mv.decode(OUT_AUDIO / f"{f}.mp3")
        m = pyln.Meter(SR)
        print(f"{f}: EN {en_idx[f]['bytes']} B {m.integrated_loudness(en):.1f} LUFS | VI {index['packs'][f]['bytes']} B {m.integrated_loudness(vi):.1f} LUFS")


if __name__ == "__main__":
    main()
