"""Cut, crossfade, master and encode game-music takes. demucs-venv (pyloudnorm, scipy, imageio_ffmpeg).

python finalize.py <scores.json> <picks.json> <out_dir> [--work E:/...]
picks.json: {"<name>": {"key": "<id>:<seed>", "cue": "title"}, ...}   name = output file stem (title, campaign, ... or A1...)
Loop cues: loop = [start, end) from the score (whole bars on measured beats), seam refined by +-15 ms cross-correlation,
 60 ms equal-power crossfade of the loop tail into the audio that originally preceded the loop start, FFT-stretched
 by <= 0.02 % to whole 1024-sample AAC frames, mastered on a
 3x-tiled copy (so the limiter is periodic too), file layout = [last 7 frames of loop] + loop + [first 28 frames of loop]
 so the region around both loop points is periodic: an AAC priming error d shifts loopStart and loopEnd equally and still
 loops cleanly. Loop points are measured by aligning the decoded .m4a against the mastered wav.
Stings: best 5-8 s ending phrase from the score, + 0.6 s past the -30 dB end point, 8 ms fade-in, cosine fade-out (<= 1.2 s).
Master: -16 LUFS integrated, true peak <= -1.5 dBTP measured on the decoded AAC (pre-encode ceiling -2.3 dBTP).
"""
import json, os, subprocess, sys
import numpy as np, soundfile as sf, pyloudnorm
import imageio_ffmpeg
from scipy.signal import resample_poly, fftconvolve, resample, butter, sosfilt
from scipy.ndimage import minimum_filter1d

FF = imageio_ffmpeg.get_ffmpeg_exe()
SC = json.load(open(sys.argv[1], encoding="utf-8"))
PICKS = json.load(open(sys.argv[2], encoding="utf-8"))
OUT = sys.argv[3]
WORK = sys.argv[sys.argv.index("--work") + 1] if "--work" in sys.argv else os.path.join(OUT, "_work")
KBPS = os.environ.get("KBPS", "64k")
os.makedirs(OUT, exist_ok=True); os.makedirs(WORK, exist_ok=True)
TARGET, CEIL = -16.0, -2.3
XF = 0.060


def tp_env(x):
    """per-sample true-peak estimate (4x oversampled abs, max over channels)"""
    up = np.abs(resample_poly(x, 4, 1, axis=0)).max(1)
    n = len(x)
    return up[: n * 4].reshape(n, 4).max(1)


def true_peak_db(x):
    return float(20 * np.log10(tp_env(x).max() + 1e-12))


def gain_from_env(env, n, sr, ceil_db, la=7):
    """per-sample gain so that env * gain <= ceiling: block peaks, look-ahead min filter, 80 ms release"""
    B = 32
    nb = int(np.ceil(len(env) / B))
    env = np.pad(env, (0, nb * B - len(env)))
    bp = env.reshape(nb, B).max(1)
    c = 10 ** (ceil_db / 20)
    need = np.minimum(1.0, c / (bp + 1e-12))
    if need.min() >= 1.0:
        return None, 0.0
    req = minimum_filter1d(need, size=la)
    rel = 1 - np.exp(-B / (0.08 * sr))
    g = np.empty_like(req); prev = 1.0
    for i in range(nb):
        prev = min(req[i], prev + (1 - prev) * rel); g[i] = prev
    centers = np.arange(nb) * B + B / 2
    return np.interp(np.arange(n), centers, g), float(20 * np.log10(g.min()))


def limit(x, sr, ceil_db):
    gs, gr = gain_from_env(tp_env(x), len(x), sr, ceil_db)
    if gs is None:
        return x, 0.0
    return x * gs[:, None], gr


def master(y, sr, tile=False, ceil=CEIL):
    meter = pyloudnorm.Meter(sr)
    src = np.concatenate([y, y, y]) if tile else y
    gr = 0.0
    out = src
    for _ in range(3):
        lu = meter.integrated_loudness(out if not tile else out[len(y):2 * len(y)])
        out = out * 10 ** ((TARGET - lu) / 20)
        out, gr = limit(out, sr, ceil)
    if tile:
        out = out[len(y):2 * len(y)]
    return out.astype(np.float32), gr


def refine_end(m, s, e, sr):
    """nudge e by +-15 ms so the 1.5 s after e matches the 1.5 s after s best (keeps whole-bar length within 15 ms)"""
    W = int(1.5 * sr); R = int(0.015 * sr)
    a = m[s:s + W]
    best, bl = -2, 0
    for lag in range(-R, R + 1, 8):
        b = m[e + lag:e + lag + W]
        c = float(a @ b / (np.linalg.norm(a) * np.linalg.norm(b) + 1e-9))
        if c > best:
            best, bl = c, lag
    # fine pass
    for lag in range(bl - 8, bl + 9):
        b = m[e + lag:e + lag + W]
        c = float(a @ b / (np.linalg.norm(a) * np.linalg.norm(b) + 1e-9))
        if c > best:
            best, bl = c, lag
    return e + bl, best, bl


def encode(wav, m4a):
    subprocess.run([FF, "-y", "-loglevel", "error", "-i", wav, "-c:a", "aac", "-b:a", KBPS, "-ar", "48000", "-ac", "2",
                    "-movflags", "+faststart", "-metadata", "comment=AI-generated with ACE-Step 1.5 (instrumental, original)", m4a], check=True)


def decode(m4a, wav, raw=False):
    cmd = [FF, "-y", "-loglevel", "error"] + (["-ignore_editlist", "1"] if raw else []) + ["-i", m4a, "-c:a", "pcm_f32le", wav]
    subprocess.run(cmd, check=True)
    d, sr = sf.read(wav, dtype="float32", always_2d=True)
    return d


def align(ref, dec, maxlag=6000):
    a = ref[: 48000 * 2].mean(1); b = dec[: 48000 * 2 + maxlag].mean(1)
    c = fftconvolve(b, a[::-1], mode="full")
    zero = len(a) - 1
    win = c[zero - maxlag: zero + maxlag + 1]
    return int(np.argmax(win)) - maxlag  # dec[t + d] ~ ref[t]


def seam_check(dec, ls, le, sr):
    """jump at the wrap vs typical sample-to-sample steps; 10 ms RMS step around the seam vs the same measure at
    40 other points of the loop (ratio ~1 = the seam is as smooth as the music around it)"""
    L = dec[ls:le]
    loop2 = np.concatenate([L, L])
    j = len(L)
    step = np.abs(np.diff(loop2[j - 200:j + 200], axis=0)).max(1)
    typ = np.percentile(np.abs(np.diff(L, axis=0)).max(1), 99)
    w = int(0.01 * sr)
    rms = lambda z: float(np.sqrt(np.mean(z ** 2)) + 1e-9)
    jump = lambda c: float(np.abs(np.diff(20 * np.log10([rms(loop2[k:k + w]) for k in range(c - 10 * w, c + 10 * w, w)]))).max())
    seam = jump(j)
    others = [jump(c) for c in np.linspace(len(L) * 0.1 + 20 * w, len(L) * 0.9, 40).astype(int)]
    # click check: 1 ms energy above 6 kHz at the wrap vs the 99th percentile of the 2 s around it (< 0 = no outlier)
    y = np.concatenate([L[-sr:], L[:sr]]).mean(1)
    h = sosfilt(butter(4, 6000, btype="high", fs=sr, output="sos"), y)
    e = 10 * np.log10(np.array([np.mean(h[i:i + 48] ** 2) for i in range(0, len(h) - 48, 48)]) + 1e-14)
    wi = sr // 48
    click = float(e[wi - 3:wi + 3].max() - np.percentile(e, 99))
    return dict(hf_click_vs_p99_db=round(click, 1), wrap_step_vs_p99=round(float(step.max() / (typ + 1e-9)), 2), seam_rms_jump_db=round(seam, 2),
                seam_jump_vs_median=round(seam / (np.median(others) + 1e-9), 2))


def main():
    man = {}
    for name, p in PICKS.items():
        r = SC[p["key"]]
        x, sr = sf.read(r["path"], dtype="float32", always_2d=True)
        if x.shape[1] == 1: x = np.repeat(x, 2, 1)
        m = x.mean(1)
        info = dict(name=name, take=p["key"], cue=r["cue"], arm=r["arm"], seed=r["seed"], shift=r["shift"], bpm=r["bpm"])
        if r.get("loop"):
            lp = r["loop"]
            s = int(round(lp["start"] * sr)); e0 = int(round(lp["end"] * sr))
            e, corr, lag = refine_end(m, s, e0, sr)
            F = int(XF * sr)
            L = x[s:e].copy()
            th = np.linspace(0, np.pi / 2, F, dtype=np.float32)[:, None]
            L[-F:] = x[e - F:e] * np.cos(th) + x[s - F:s] * np.sin(th)
            # AAC frame alignment: stretch the (periodic) loop by FFT resampling to a whole number of 1024-sample AAC
            # frames (change <= 512 samples, about 0.02 %: 0.3 cent, inaudible) and make the lead-in 7 frames, so both
            # loop points sit on the same AAC frame phase (measured: 2-3 dB closer decoded match at the wrap)
            n0 = len(L); n2 = int(round(n0 / 1024)) * 1024
            L = resample(L, n2, axis=0).astype(np.float32)
            info["frame_align_stretch_pct"] = round((n2 / n0 - 1) * 100, 4)
            P = 7 * 1024; Q = 28 * 1024
            def build(ceil):
                Lm, gr = master(L, sr, tile=True, ceil=ceil)
                return np.concatenate([Lm[-P:], Lm, Lm[:Q]]), gr, Lm
            info.update(bars=lp["bars"], seam_score=lp["seam"], end_refine_ms=round(lag / sr * 1000, 2), seam_corr=round(corr, 3))
        else:
            st = r["sting"]
            s = int(round(st["start"] * sr)); e = min(len(x), int(round((st["end"] + 0.6) * sr)))
            raw0 = x[max(0, s - int(0.01 * sr)):e].copy()
            fi = int(0.008 * sr); raw0[:fi] *= np.linspace(0, 1, fi)[:, None]
            fo = int(min(1.2, len(raw0) / sr * 0.2) * sr)
            raw0[-fo:] *= (0.5 + 0.5 * np.cos(np.linspace(0, np.pi, fo)))[:, None]
            P = 0
            def build(ceil):
                b, gr = master(raw0, sr, ceil=ceil)
                return b, gr, None
            info.update(phrase_start=st["start"], phrase_end=st["end"])
        # master once at the -2.3 dBTP ceiling, then encoder-aware passes: where the DECODED AAC overshoots -1.8 dBTP
        # (AAC at 64 kbps can add 2-4 dB on some transients), pull the gain down locally on the pre-encode signal
        # (for loops on the loop body, folding lead-in/tail back onto it so the file stays periodic) and re-encode.
        ceil = CEIL
        body, gr, Lm = build(ceil)
        extra = 0.0
        for it in range(6):
            wav = os.path.join(WORK, name + ".wav"); sf.write(wav, body, sr, subtype="FLOAT")
            m4a = os.path.join(OUT, name + ".m4a"); encode(wav, m4a)
            dec = decode(m4a, os.path.join(WORK, name + ".dec.wav"))
            tpd = true_peak_db(dec)
            if tpd <= -1.6:
                break
            env = tp_env(dec[:len(body)])
            g, egr = gain_from_env(env, len(body), sr, -2.0 - 0.3 * it, la=31)
            if g is None:
                break
            extra = min(extra, egr)
            if Lm is not None:
                n = len(Lm); gL = g[P:P + n].copy()
                gL[-P:] = np.minimum(gL[-P:], g[:P]); gL[:Q] = np.minimum(gL[:Q], g[P + n:P + n + Q])
                Lm = (Lm * gL[:, None]).astype(np.float32)
                body = np.concatenate([Lm[-P:], Lm, Lm[:Q]])
            else:
                body = (body * g[:, None]).astype(np.float32)
        info["ceiling_db"] = ceil; info["encoder_aware_extra_gr_db"] = round(extra, 2); info["encode_passes"] = it + 1
        info["pre_encode_tp_db"] = round(true_peak_db(body), 2)
        raw = decode(m4a, os.path.join(WORK, name + ".raw.wav"), raw=True)
        d = align(body, dec); draw = align(body, raw)
        meter = pyloudnorm.Meter(sr)
        info.update(_m4a=os.path.abspath(m4a), bytes=os.path.getsize(m4a), limiter_gr_db=round(gr, 2), decoded_offset_samples=d, raw_priming_samples=draw,
                    file_seconds=round(len(dec) / sr, 4))
        if r.get("loop"):
            ls = P + d; le = P + len(Lm) + d
            info.update(loopStart=round(ls / sr, 6), loopEnd=round(le / sr, 6), loopStartSample=ls, loopEndSample=le, sampleRate=sr,
                        loop_seconds=round(len(Lm) / sr, 4), bpm_loop=round(info["bars"] * 4 * 60 / (len(Lm) / sr), 3))
            region = dec[ls:le]
            info.update(lufs=round(meter.integrated_loudness(region), 2), true_peak_db=round(true_peak_db(dec), 2), **seam_check(dec, ls, le, sr))
        else:
            info.update(lufs=round(meter.integrated_loudness(dec), 2), true_peak_db=round(true_peak_db(dec), 2), sting_seconds=round(len(dec) / sr, 3))
        man[name] = info
        print(json.dumps(info), flush=True)
    json.dump(man, open(os.path.join(WORK, "finalize-report.json"), "w", encoding="utf-8"), indent=1)


if __name__ == "__main__":
    main()
