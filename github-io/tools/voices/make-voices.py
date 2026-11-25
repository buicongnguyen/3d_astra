"""W3 voices: render every line of src/voice-lines.json into one MP3 sprite per pack.

Engine: Kokoro-82M (hexgrad, Apache-2.0 weights and code), stock voices only, run locally on the GPU.
No cloud TTS, no cloned voice. Only the processed MP3s ship (public/voices/); the engine never does.

Per line: Kokoro at the faction's pace -> trim -> the faction's chain (FX below: radio band, drive,
crackle, ring modulation, hush) -> unit replies get a radio key-up/down squelch -> loudness to
TARGET_LUFS -> peak limit. Lines are laid end to end with GAP seconds of silence and encoded once
(MP3, mono, 24 kHz, BITRATE). src/voice-packs.json gets each clip's [start, length] in seconds, already
widened by PAD on both sides so a decoder that keeps the MP3 priming (about 50 ms) still plays it whole.

Run (PowerShell, from github-io/), with a Python that has kokoro, soundfile, scipy, pyloudnorm and av,
for example the voice_sync venv:
    & C:/Users/n/source/repos/voice_sync/engines/venv/Scripts/python.exe -I -X utf8 tools/voices/make-voices.py [--qa] [--packs meridian,story-m01]
--qa runs a Whisper round trip (faster-whisper, local) on the processed clips and writes .tmp/voices/qa.json.
Processed WAVs for listening go to .tmp/voices/clips/<pack>/ and .tmp/voices/listen.html.
"""
import argparse, io, json, math, os, re, sys, time
from pathlib import Path
import numpy as np
from scipy import signal

GAME = Path(__file__).resolve().parents[2]
LINES = GAME / "src" / "voice-lines.json"
OUT_AUDIO = GAME / "public" / "voices"
OUT_INDEX = GAME / "src" / "voice-packs.json"
WORK = GAME / ".tmp" / "voices"
SR = 24000
GAP, PAD = 0.28, 0.07
TARGET_LUFS = {"ack": -17.0, "ann": -17.5, "story": -18.0}
BITRATE = 32000
FACTIONS = ["meridian", "ashfall", "sunward", "wardens", "veil"]


# ------------------------------------------------------------------ dsp helpers
def sos_filter(x, kind, hz, order=2):
    sos = signal.butter(order, hz, kind, fs=SR, output="sos")
    return signal.sosfiltfilt(sos, x).astype(np.float32)


def trim(x, thresh_db=-40.0, pad=0.03):
    peak = np.max(np.abs(x)) + 1e-9
    win = int(0.01 * SR)
    env = np.sqrt(np.convolve(x ** 2, np.ones(win) / win, mode="same"))
    idx = np.where(env > peak * 10 ** (thresh_db / 20))[0]
    if not len(idx):
        return x
    return x[max(0, idx[0] - int(pad * SR)): min(len(x), idx[-1] + int(pad * SR * 2))]


def envelope(x, ms=12):
    win = max(1, int(ms / 1000 * SR))
    return np.sqrt(np.convolve(x ** 2, np.ones(win) / win, mode="same") + 1e-12).astype(np.float32)


def resample_pitch(x, factor):
    """factor < 1 lowers pitch (and slows); a plain resample, no phase vocoder."""
    if abs(factor - 1) < 1e-3:
        return x
    n = int(round(len(x) / factor))
    return signal.resample(x, n).astype(np.float32)


def peaking(x, hz, db, q=1.0):
    a = 10 ** (db / 40)
    w0 = 2 * math.pi * hz / SR
    alpha = math.sin(w0) / (2 * q)
    b = [1 + alpha * a, -2 * math.cos(w0), 1 - alpha * a]
    den = [1 + alpha / a, -2 * math.cos(w0), 1 - alpha / a]
    return signal.lfilter(b, den, x).astype(np.float32)


def comb(x, delay_s, fb, mix):
    d = max(1, int(delay_s * SR))
    den = np.zeros(d + 1); den[0], den[d] = 1.0, -fb
    y = signal.lfilter([1.0], den, x).astype(np.float32)
    return ((1 - mix) * x + mix * y / (1 + fb)).astype(np.float32)


def room(x, rng, seconds=0.35, mix=0.16):
    n = int(seconds * SR)
    t = np.arange(n) / SR
    ir = rng.standard_normal(n).astype(np.float32) * np.exp(-t / (seconds / 4))
    ir = sos_filter(ir, "lowpass", 3500)
    ir[: int(0.008 * SR)] = 0
    out = np.pad(x, (0, n))
    wet = np.pad(signal.fftconvolve(x, ir), (0, n))[: len(out)]
    wet *= np.max(np.abs(out)) / (np.max(np.abs(wet)) + 1e-9)
    return (out + mix * wet).astype(np.float32)


def chorus(x, base=0.011, depth=0.002, rate=0.8, mix=0.28):
    n = np.arange(len(x))
    delay = (base + depth * np.sin(2 * math.pi * rate * n / SR)) * SR
    idx = n - delay
    y = np.interp(idx, n, x, left=0.0).astype(np.float32)
    return ((1 - mix) * x + mix * y).astype(np.float32)


def squelch(rng, kind, length=0.05, level=0.18):
    """Radio key-up / key-down: a short band of noise (or a digital chirp for machines)."""
    n = int(length * SR)
    t = np.arange(n) / SR
    if kind == "machine":
        f = 1800 + 900 * (t / length)
        y = np.sign(np.sin(2 * math.pi * np.cumsum(f) / SR)) * 0.5
        return (y * np.exp(-t / (length / 2.5)) * level).astype(np.float32)
    y = sos_filter(rng.standard_normal(n).astype(np.float32), "bandpass", [1200, 5200])
    y /= np.max(np.abs(y)) + 1e-9
    return (y * np.exp(-t / (length / 3)) * level).astype(np.float32)


def crackle(x, rng, amount):
    env = envelope(x, 25)
    env /= env.max() + 1e-9
    hiss = sos_filter(rng.standard_normal(len(x)).astype(np.float32), "bandpass", [900, 4200]) * 0.02 * amount
    clicks = np.zeros(len(x), np.float32)
    for i in rng.integers(0, len(x), int(len(x) / SR * 18 * amount)):
        clicks[i: i + 6] += (rng.random() * 2 - 1) * 0.25 * amount
    return (x + (hiss + clicks) * (0.35 + env)).astype(np.float32)


# The faction sound: each chain gets the raw (trimmed) line at SR and returns the processed line.
def fx_chain(x, fx, rng, radio):
    if fx == "clean":
        y = sos_filter(x, "highpass", 140 if radio else 90)
        y = sos_filter(y, "lowpass", 5600 if radio else 9000, 4)
        y = peaking(y, 2600, 3.0, 0.8)
        y = np.tanh(1.4 * y / (np.max(np.abs(y)) + 1e-9)).astype(np.float32)
        if radio:
            y = crackle(y, rng, 0.25)
    elif fx == "gritty":
        y = resample_pitch(x, 0.955)
        y = sos_filter(y, "highpass", 320)
        y = sos_filter(y, "lowpass", 3300 if radio else 4800, 4)
        y = peaking(y, 1500, 4.5, 0.9)
        y = np.tanh(3.2 * y / (np.max(np.abs(y)) + 1e-9)).astype(np.float32)
        y = crackle(y, rng, 0.9 if radio else 0.45)
    elif fx == "warm":
        y = sos_filter(x, "highpass", 110)
        y = sos_filter(y, "lowpass", 6800 if radio else 9500, 4)
        y = peaking(y, 260, 2.5, 0.7)
        y = peaking(y, 3200, 1.5, 1.0)
        y = np.tanh(1.8 * y / (np.max(np.abs(y)) + 1e-9)).astype(np.float32)
        if radio:
            y = crackle(y, rng, 0.35)
    elif fx == "machine":
        t = np.arange(len(x)) / SR
        ring = x * np.sin(2 * math.pi * 52 * t)
        y = (0.68 * x + 0.32 * ring).astype(np.float32)
        y = comb(y, 0.0042, 0.55, 0.5)
        y = sos_filter(y, "highpass", 180)
        y = sos_filter(y, "lowpass", 6200, 4)
        y = np.tanh(1.6 * y / (np.max(np.abs(y)) + 1e-9)).astype(np.float32)
    elif fx == "hush":
        y = sos_filter(x, "highpass", 150)
        y = sos_filter(y, "lowpass", 7200, 4)
        env = envelope(y, 15)
        env /= env.max() + 1e-9
        breath = sos_filter(rng.standard_normal(len(y)).astype(np.float32), "bandpass", [2200, 7000]) * env * 0.06
        y = chorus(y + breath)
        y = room(y, rng, 0.4, 0.2)
    else:
        raise ValueError(fx)
    return y.astype(np.float32)


def loudness(x, target):
    import pyloudnorm as pyln
    pad = max(0, int(0.6 * SR) - len(x))
    v = pyln.Meter(SR).integrated_loudness(np.pad(x, (0, pad)))
    if np.isfinite(v):
        x = x * 10 ** ((target - v) / 20)
    peak = np.max(np.abs(signal.resample_poly(x, 4, 1)))
    ceil = 10 ** (-1.5 / 20)
    if peak > ceil:  # soft knee: a gentle tanh above the ceiling, then the exact guard
        x = np.where(np.abs(x) > 0.7 * ceil, np.sign(x) * (0.7 * ceil + 0.3 * ceil * np.tanh((np.abs(x) - 0.7 * ceil) / (0.3 * ceil))), x)
        peak = np.max(np.abs(signal.resample_poly(x, 4, 1)))
        if peak > ceil:
            x = x * ceil / peak
    return x.astype(np.float32)


def fade(x, a=0.006, b=0.03):
    x = x.copy()
    na, nb = int(a * SR), int(b * SR)
    if len(x) > na + nb:
        x[:na] *= np.linspace(0, 1, na)
        x[-nb:] *= np.linspace(1, 0, nb)
    return x


# ------------------------------------------------------------------ the packs
def pack_lines(data, name):
    """[(clip id, text, voice, fx, kind, speed)] for one pack."""
    if name in data["factions"]:
        f = data["factions"][name]
        out = []
        for kind, lines in f["ack"].items():
            for i, text in enumerate(lines):
                out.append((f"ack.{kind}.{i}", text, f["unitVoice"], f["fx"], "ack", f["speed"]))
        for kind, lines in f["ann"].items():
            for i, text in enumerate(lines):
                out.append((f"ann.{kind}.{i}", text, f["announcerVoice"], f["fx"], "ann", f["speed"]))
        return out
    s = data["story"]
    assert name == s["pack"], name
    return [(f"story.{i}", line["text"], s["voices"][line["who"]], s["fx"][line["who"]], "story", 1.0) for i, line in enumerate(s["lines"])]


_pipes = {}


def kokoro(text, voice, speed):
    from kokoro import KPipeline
    code = "b" if voice.startswith("b") else "a"
    if code not in _pipes:
        _pipes[code] = KPipeline(lang_code=code, repo_id="hexgrad/Kokoro-82M", device="cuda")
    parts = [np.asarray(a.cpu() if hasattr(a, "cpu") else a, dtype=np.float32) for _, _, a in _pipes[code](text, voice=voice, speed=speed, split_pattern=None)]
    return np.concatenate(parts)


def encode_mp3(x, path):
    import av
    pcm = np.clip(x * 32767, -32768, 32767).astype(np.int16)
    with av.open(str(path), "w", format="mp3") as out:
        st = out.add_stream("libmp3lame", rate=SR, layout="mono")
        st.bit_rate = BITRATE
        frame_n = 1152
        for i in range(0, len(pcm), frame_n):
            chunk = pcm[i:i + frame_n]
            frame = av.AudioFrame.from_ndarray(chunk.reshape(1, -1), format="s16", layout="mono")
            frame.sample_rate = SR
            frame.pts = i
            for p in st.encode(frame):
                out.mux(p)
        for p in st.encode(None):
            out.mux(p)


def decode(path):
    import av
    chunks = []
    with av.open(str(path)) as f:
        for fr in f.decode(audio=0):
            chunks.append(fr.to_ndarray().reshape(-1).astype(np.float32) / (32768.0 if fr.format.name.startswith("s16") else 1.0))
    return np.concatenate(chunks)


def build(name, data, rng, wav_dir):
    import soundfile as sf
    lines = pack_lines(data, name)
    t0 = time.time()
    parts, clips, t = [np.zeros(int(GAP * SR), np.float32)], {}, GAP
    texts = {}
    for cid, text, voice, fx, kind, speed in lines:
        raw = trim(kokoro(text, voice, speed))
        y = fx_chain(raw, fx, rng, radio=(kind == "ack"))
        if kind == "ack":
            y = np.concatenate([squelch(rng, fx, 0.04, 0.16), np.zeros(int(0.015 * SR), np.float32), y, np.zeros(int(0.02 * SR), np.float32), squelch(rng, fx, 0.07, 0.12)])
        y = fade(loudness(y, TARGET_LUFS[kind]))
        sf.write(wav_dir / f"{cid}.wav", y, SR, subtype="PCM_16")
        start, length = t, len(y) / SR
        clips[cid] = [round(max(0.0, start - PAD), 3), round(length + 2 * PAD, 3)]
        texts[cid] = text
        parts += [y, np.zeros(int(GAP * SR), np.float32)]
        t += length + GAP
    x = np.concatenate(parts)
    mp3 = OUT_AUDIO / f"{name}.mp3"
    encode_mp3(x, mp3)
    # Measure where the encoded clips actually sit (decoder priming): align the decoded file to the source.
    dec = decode(mp3)[: len(x) + SR]
    n = min(len(dec), len(x), SR * 6)
    corr = signal.correlate(dec[:n], x[:n], mode="full", method="fft")
    lag = int(np.argmax(corr) - (n - 1))
    return {"file": f"voices/{name}.mp3", "bytes": mp3.stat().st_size, "seconds": round(len(x) / SR, 2), "decoderLagMs": round(lag / SR * 1000, 1), "clips": clips}, texts, time.time() - t0


def qa(results, wav_root):
    from faster_whisper import WhisperModel
    model = WhisperModel("large-v3", device="cuda", compute_type="float16")
    norm = lambda s: re.sub(r"[^a-z0-9' ]", " ", s.lower().replace("recognised", "recognized").replace("neutralised", "neutralized")).split()
    report = {}
    for pack, (_, texts) in results.items():
        for cid, text in texts.items():
            segs, _ = model.transcribe(str(wav_root / pack / f"{cid}.wav"), language="en", beam_size=5)
            heard = " ".join(s.text for s in segs).strip()
            a, b = norm(text), norm(heard)
            # word error rate (Levenshtein over words)
            d = list(range(len(b) + 1))
            for i in range(1, len(a) + 1):
                prev, d[0] = d[0], i
                for j in range(1, len(b) + 1):
                    cur = d[j]
                    d[j] = min(d[j] + 1, d[j - 1] + 1, prev + (a[i - 1] != b[j - 1]))
                    prev = cur
            report[f"{pack}/{cid}"] = {"text": text, "heard": heard, "wer": round(d[len(b)] / max(1, len(a)), 3)}
    return report


def listen_page(results, data):
    rows = []
    for pack, (meta, texts) in results.items():
        rows.append(f"<h2>{pack} <small>{meta['bytes'] // 1024} KB, {meta['seconds']} s</small></h2><table>")
        for cid, text in texts.items():
            rows.append(f"<tr><td>{cid}</td><td>{text}</td><td><audio controls preload=none src='clips/{pack}/{cid}.wav'></audio></td></tr>")
        rows.append("</table>")
    html = "<!doctype html><meta charset=utf-8><title>Frontier voices</title><style>body{font:15px system-ui;margin:16px;background:#111;color:#eee}td{padding:4px 8px;border-bottom:1px solid #333}small{color:#999}</style><h1>Frontier Command voices (W3)</h1><p>Processed clips as shipped (before MP3). Packs in public/voices/.</p>" + "".join(rows)
    (WORK / "listen.html").write_text(html, encoding="utf-8")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--packs", default="")
    ap.add_argument("--qa", action="store_true")
    args = ap.parse_args()
    data = json.loads(LINES.read_text(encoding="utf-8"))
    names = FACTIONS + [data["story"]["pack"]]
    chosen = [p for p in args.packs.split(",") if p] or names
    OUT_AUDIO.mkdir(parents=True, exist_ok=True)
    index = json.loads(OUT_INDEX.read_text(encoding="utf-8")) if OUT_INDEX.exists() else {"packs": {}}
    results = {}
    for name in chosen:
        rng = np.random.default_rng(sum(map(ord, name)) * 7919)
        wav_dir = WORK / "clips" / name
        wav_dir.mkdir(parents=True, exist_ok=True)
        meta, texts, secs = build(name, data, rng, wav_dir)
        results[name] = (meta, texts)
        index["packs"][name] = meta
        print(f"{name}: {len(texts)} clips, {meta['seconds']} s, {meta['bytes']} bytes, lag {meta['decoderLagMs']} ms, {secs:.1f} s", flush=True)
    index["about"] = "Generated by tools/voices/make-voices.py from src/voice-lines.json: clip [start, length] in seconds inside each MP3 sprite (already padded). Do not edit by hand."
    index["engine"] = "Kokoro-82M (hexgrad, Apache-2.0), stock voices, local GPU"
    index["codec"] = f"MP3 mono {SR} Hz {BITRATE // 1000} kbps (libmp3lame)"
    index["packs"] = {k: index["packs"][k] for k in names if k in index["packs"]}
    index["totalBytes"] = sum(p["bytes"] for p in index["packs"].values())
    OUT_INDEX.write_text(json.dumps(index, indent=1) + "\n", encoding="utf-8", newline="\n")
    listen_page(results, data)
    if args.qa:
        rep = qa(results, WORK / "clips")
        (WORK / "qa.json").write_text(json.dumps(rep, indent=1, ensure_ascii=False), encoding="utf-8")
        bad = {k: v for k, v in rep.items() if v["wer"] > 0.34}
        print(f"QA: {len(rep)} clips, mean WER {np.mean([v['wer'] for v in rep.values()]):.3f}, flagged {len(bad)}")
        for k, v in bad.items():
            print("  ", k, v)


if __name__ == "__main__":
    main()
