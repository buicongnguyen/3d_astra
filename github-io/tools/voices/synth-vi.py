"""Vietnamese voices, step 1 of 2: render the raw VieNeu-TTS takes of every faction line.

Engine: VieNeu-TTS v3 Turbo (pnnbao-ump, Apache-2.0 code, weights and preset voices; generated audio may be
used commercially, model card "Usage Rights & Licensing FAQ"), preset voices only, no cloning, run locally.
The words are the Vietnamese subtitles of the same lines (src/locales/vi.json), so voice and caption match.

Run with a Python that has `vieneu` (for example the VI test venv), from github-io/:
    python -I -X utf8 tools/voices/synth-vi.py [--attempt N] [--only .tmp/voices-vi/todo.json]
Attempt 0 renders every line; a later attempt renders only the clip ids listed in --only (the lines that did
not pass QA in make-voices-vi.py) with another seed (and from attempt 3 a cooler temperature).
Writes .tmp/voices-vi/raw/<faction>/<clip id>.<attempt>.wav (48 kHz mono).
"""
import argparse, json, random, wave
from pathlib import Path
import numpy as np

GAME = Path(__file__).resolve().parents[2]
WORK = GAME / ".tmp" / "voices-vi"
CAST = json.loads((Path(__file__).with_name("vi-cast.json")).read_text(encoding="utf-8"))


def lines():
    """[(faction, clip id, vietnamese text, voice)] for every unit reply and announcer line."""
    vl = json.loads((GAME / "src/voice-lines.json").read_text(encoding="utf-8"))["factions"]
    vi = json.loads((GAME / "src/locales/vi.json").read_text(encoding="utf-8"))["messages"]
    out = []
    for f, d in vl.items():
        for group, who in (("ack", "unit"), ("ann", "announcer")):
            for kind, takes in d[group].items():
                for i, text in enumerate(takes):
                    out.append((f, f"{group}.{kind}.{i}", vi[text], CAST[f][who]))
    return out


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--attempt", type=int, default=0)
    ap.add_argument("--only", default="")
    a = ap.parse_args()
    only = set(json.loads(Path(a.only).read_text(encoding="utf-8"))) if a.only else None
    from vieneu import Vieneu
    import torch
    tts = Vieneu()
    n = 0
    for f, cid, text, voice in lines():
        if only is not None and f"{f}/{cid}" not in only:
            continue
        seed = (sum(map(ord, f + cid)) * 7919 + a.attempt * 104729) % 2**31
        torch.manual_seed(seed); np.random.seed(seed); random.seed(seed)
        x = tts.infer(text, voice=voice, temperature=0.8 if a.attempt < 3 else 0.6)
        p = WORK / "raw" / f / f"{cid}.{a.attempt}.wav"
        p.parent.mkdir(parents=True, exist_ok=True)
        pcm = np.clip(np.asarray(x, np.float32) * 32767, -32768, 32767).astype(np.int16)
        with wave.open(str(p), "wb") as w:
            w.setnchannels(1); w.setsampwidth(2); w.setframerate(48000); w.writeframes(pcm.tobytes())
        n += 1
    print(f"attempt {a.attempt}: {n} takes", flush=True)


if __name__ == "__main__":
    main()
