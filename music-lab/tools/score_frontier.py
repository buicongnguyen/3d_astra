"""Score instrumental game-music takes (no vocals, so no Whisper). demucs-venv (librosa, pyloudnorm, scipy).

python score_frontier.py <takes_dir> <out_json> [id ...]
Per take: measured bpm + beat-grid regularity (librosa), loudness (LUFS, LRA-ish spread), clipping, harshness (2-6 kHz
share), spectral balance (low/mid/high shares), silence/dropouts, and for loop cues the best seamless loop of whole bars
(16/24/32 bars inside the cue's length window): seam similarity = chroma + log-mel + RMS match of the windows around the
loop start vs. around the loop end. Stings: best ending phrase (5-8 s) ending at the final resolve.
"""
import json, os, sys
import numpy as np, soundfile as sf, librosa, pyloudnorm
from scipy.signal import resample_poly

TAKES, OUTJ = sys.argv[1:3]
ONLY = set(sys.argv[3:])
LOG = json.load(open(os.path.join(TAKES, "generation-log.json"), encoding="utf-8"))
# loop length window per cue (seconds) - from the size budget at 64 kbps (8 kB/s) minus a little margin
LOOPWIN = {"title": (45, 78), "campaign": (40, 66), "defence": (40, 66)}
SR = 22050
HOP = 512


def true_peak_db(x, sr):
    up = resample_poly(x, 4, 1, axis=0)
    return 20 * np.log10(np.abs(up).max() + 1e-12)


def fit_period(bt):
    """beat period from a least-squares line through beat times vs beat index (index from the median gap, so a
    skipped/extra beat does not bend the fit) - much finer than the 23 ms frame grid of a median gap."""
    med = float(np.median(np.diff(bt)))
    idx = np.round((bt - bt[0]) / med)
    return float(np.polyfit(idx, bt, 1)[0])


def beat_measures(y, bpm_param):
    """beat tracker WITHOUT the requested bpm as prior (the model does not always follow the bpm param);
    bpm_prior = the tracker seeded with the requested bpm, for comparison."""
    oenv = librosa.onset.onset_strength(y=y, sr=SR, hop_length=HOP)
    tempo, beats = librosa.beat.beat_track(onset_envelope=oenv, sr=SR, hop_length=HOP, tightness=100)
    t2, b2 = librosa.beat.beat_track(onset_envelope=oenv, sr=SR, hop_length=HOP, start_bpm=bpm_param, tightness=200)
    bt = librosa.frames_to_time(beats, sr=SR, hop_length=HOP)
    bt2 = librosa.frames_to_time(b2, sr=SR, hop_length=HOP)
    bpm_prior = round(60.0 / fit_period(bt2), 2) if len(bt2) > 8 else None
    if len(bt) < 8:
        return dict(bpm=None, grid=0.0, ratio=None, bpm_prior=bpm_prior), bt, oenv
    ibi = np.diff(bt)
    med = float(np.median(ibi))
    grid = float(np.mean(np.abs(ibi - med) < 0.06 * med))  # share of beat gaps within 6 % of the median
    bpm = 60.0 / fit_period(bt)
    ratio = bpm / bpm_param
    # beat strength: mean onset strength on beats vs off-beat midpoints (pulse clarity)
    on = oenv[beats].mean()
    mids = librosa.time_to_frames((bt[:-1] + bt[1:]) / 2, sr=SR, hop_length=HOP)
    off = oenv[np.clip(mids, 0, len(oenv) - 1)].mean()
    return dict(bpm=round(bpm, 2), grid=round(grid, 3), ratio=round(ratio, 3), pulse=round(float(on / (off + 1e-9)), 2),
                bpm_prior=bpm_prior), bt, oenv


def spectral(y):
    S = np.abs(librosa.stft(y, n_fft=4096, hop_length=2048)) ** 2
    f = librosa.fft_frequencies(sr=SR, n_fft=4096)
    tot = S.sum() + 1e-12
    low = S[f < 250].sum() / tot
    mid = S[(f >= 250) & (f < 2000)].sum() / tot
    pres = S[(f >= 2000) & (f < 6000)].sum() / tot
    high = S[f >= 6000].sum() / tot
    cent = float(librosa.feature.spectral_centroid(S=np.sqrt(S), sr=SR).mean())
    return dict(low=round(float(low), 3), mid=round(float(mid), 3), harsh=round(float(pres), 4), air=round(float(high), 4),
                centroid=int(cent))


def dropouts(y, head=4.0, tail=6.0):
    rms = librosa.feature.rms(y=y, frame_length=2048, hop_length=HOP)[0]
    db = 20 * np.log10(rms + 1e-9)
    t = librosa.frames_to_time(np.arange(len(db)), sr=SR, hop_length=HOP)
    body = (t > head) & (t < t[-1] - tail)  # ignore intro / ending
    ref = np.percentile(db[body], 60) if body.any() else db.max()
    # running median over ~1 s, a dropout = 0.25 s+ more than 15 dB under the take's typical level
    low = (db < ref - 15) & body
    runs, cur = 0, 0
    longest = 0
    for v in low:
        cur = cur + 1 if v else 0
        if cur == int(0.25 * SR / HOP):
            runs += 1
        longest = max(longest, cur)
    return dict(dropouts=runs, longest_dropout_s=round(longest * HOP / SR, 2), quiet_share=round(float(low.sum() / max(1, body.sum())), 3))


def feats(y):
    chroma = librosa.feature.chroma_cqt(y=y, sr=SR, hop_length=HOP)
    mel = librosa.power_to_db(librosa.feature.melspectrogram(y=y, sr=SR, hop_length=HOP, n_mels=48), ref=np.max)
    rms = librosa.feature.rms(y=y, hop_length=HOP)[0]
    return chroma, mel, rms


def cos(a, b):
    a = a.ravel(); b = b.ravel()
    return float(a @ b / (np.linalg.norm(a) * np.linalg.norm(b) + 1e-9))


def seam_score(F, f0, f1, w):
    """Compare the windows around frame f0 (loop start) and f1 (loop end): what plays after the seam
    (start..start+w) vs what originally followed the end (end..end+w), and before (end-w..end vs start-w..start)."""
    chroma, mel, rms = F
    n = chroma.shape[1]
    if f0 - w < 0 or f1 + w > n:
        return -1, {}
    a_post, b_post = slice(f0, f0 + w), slice(f1, f1 + w)
    a_pre, b_pre = slice(f0 - w, f0), slice(f1 - w, f1)
    ch = 0.5 * (cos(chroma[:, a_post], chroma[:, b_post]) + cos(chroma[:, a_pre], chroma[:, b_pre]))
    m0 = mel[:, a_post] - mel[:, a_post].mean(); m1 = mel[:, b_post] - mel[:, b_post].mean()
    me = cos(m0, m1)
    # timbre / level: mean mel spectra close, rms in dB close
    spec_d = float(np.mean(np.abs(mel[:, a_post].mean(1) - mel[:, b_post].mean(1))))
    r0 = 20 * np.log10(rms[f0 - w // 4:f0 + w // 4].mean() + 1e-9); r1 = 20 * np.log10(rms[f1 - w // 4:f1 + w // 4].mean() + 1e-9)
    lvl_d = abs(r0 - r1)
    s = 0.45 * ch + 0.25 * me + 0.15 * max(0, 1 - spec_d / 8) + 0.15 * max(0, 1 - lvl_d / 4)
    return s, dict(chroma=round(ch, 3), melshape=round(me, 3), spec_d_db=round(spec_d, 2), level_d_db=round(lvl_d, 2))


def best_loop(y, bt, cue, dur, bpm, bpm_prior, bpm_param):
    """Repetition-lag loop finder: for every lag L in the cue's length window, frame similarity of t vs t+L
    (chroma 0.55 + mel shape 0.30 + level 0.15), smoothed over 4 s around the seam (0.7) and 16 s (0.3, favours a
    real musical period over a lucky match). Best (L, start); start snapped to the nearest tracked beat if that costs
    < 0.01. Bars = L / (4 beats) at the measured tempo (and at the bpm-prior tempo) - whole bars expected."""
    from scipy.ndimage import uniform_filter1d
    lo, hi = LOOPWIN[cue]
    F = feats(y)
    chroma, mel, rms = F
    C = chroma / (np.linalg.norm(chroma, axis=0, keepdims=True) + 1e-9)
    M = mel - mel.mean(0, keepdims=True); M = M / (np.linalg.norm(M, axis=0, keepdims=True) + 1e-9)
    rdb = 20 * np.log10(rms + 1e-9)
    n = C.shape[1]
    fr = lambda s: int(round(s * SR / HOP))
    w = fr(2.0)
    f_lo = fr(6.0)
    best = None
    # candidate lags = whole bars (multiples of 4 bars) at each tempo hypothesis, searched +-0.35 % around the nominal
    cands = set()
    for h, b in (("bpm", bpm), ("bpm_prior", bpm_prior), ("param", bpm_param)):
        if not b:
            continue
        bar = 4 * 60.0 / b
        for N in range(8, 41, 4):
            L0 = N * bar
            if lo <= L0 <= hi:
                for L in range(fr(L0 * 0.9965), fr(L0 * 1.0035) + 1):  # +-0.35 % = under a quarter beat for 16+ bars
                    cands.add((L, h, N))
    for L, h, N in sorted(cands):
        n2 = n - L
        s = 0.55 * (C[:, :n2] * C[:, L:]).sum(0) + 0.30 * (M[:, :n2] * M[:, L:]).sum(0) + 0.15 * np.clip(1 - np.abs(rdb[:n2] - rdb[L:]) / 6, 0, 1)
        ss = 0.7 * uniform_filter1d(s, 2 * w + 1) + 0.3 * uniform_filter1d(s, 8 * w + 1)
        f_hi = n - L - w - fr(4.0)
        if f_hi <= f_lo:
            continue
        bonus = 0.01 if N in (16, 32) else 0.0
        i = int(np.argmax(ss[f_lo:f_hi])) + f_lo
        tot = float(ss[i]) + bonus
        if best is None or tot > best[0]:
            best = (tot, L, i, ss[f_lo:f_hi].copy(), f_lo, h, N)
    if best is None:
        return None
    tot, L, i, curve, off, hyp, nbars = best
    # snap start to the nearest beat if it costs < 0.01 of the smoothed score
    tf = librosa.time_to_frames(bt, sr=SR, hop_length=HOP)
    cand = [f for f in tf if abs(f - i) <= fr(0.3) and off <= f < off + len(curve)]
    if cand:
        fb = min(cand, key=lambda f: abs(f - i))
        if curve[fb - off] >= curve[i - off] - 0.01:
            i = fb
    t0 = i * HOP / SR; Ls = L * HOP / SR
    sres, d = seam_score(F, i, i + L, w)
    inb = bt[(bt >= t0) & (bt <= t0 + Ls)]
    ibi = np.diff(inb); med = np.median(ibi) if len(ibi) else 1
    reg = float(np.mean(np.abs(ibi - med) < 0.06 * med)) if len(ibi) else 0
    out = dict(score=round(tot, 4), seam=round(float(sres), 4), rep=round(float(curve[i - off]), 4), start=round(t0, 4),
               end=round(t0 + Ls, 4), length=round(Ls, 3), inner_grid=round(reg, 3), bars=nbars, tempo_hyp=hyp,
               loop_bpm=round(nbars * 4 * 60.0 / Ls, 2), **d)
    return out


def sting_phrase(y, oenv, bt, key):
    rms = librosa.feature.rms(y=y, hop_length=HOP)[0]
    db = 20 * np.log10(rms + 1e-9)
    t = librosa.frames_to_time(np.arange(len(db)), sr=SR, hop_length=HOP)
    peak = np.percentile(db, 98)
    alive = np.where(db > peak - 30)[0]
    end_f = alive[-1] if len(alive) else len(db) - 1
    end_t = float(t[end_f])
    # the final note: last strong onset in the final 6 s, how long it rings
    best = None
    on = librosa.onset.onset_detect(onset_envelope=oenv, sr=SR, hop_length=HOP, units="time")
    for st in on:
        L = end_t - st
        if not (5.0 <= L <= 7.4):  # + up to 0.6 s ring-out in finalize = 8 s max
            continue
        f = librosa.time_to_frames(st, sr=SR, hop_length=HOP)
        strength = oenv[max(0, f - 2):f + 3].max() / (oenv.mean() + 1e-9)
        pre = db[max(0, f - 20):max(1, f - 2)].mean()  # quieter just before = a phrase start
        s = strength + 0.05 * (db[f:f + 20].mean() - pre)
        if best is None or s > best["score"]:
            best = dict(score=round(float(s), 3), start=round(float(st), 3), end=round(end_t, 3), length=round(L, 3))
    # how the ending lands: level of the last 1.5 s relative to the phrase, and tail decay
    if best:
        f0 = librosa.time_to_frames(best["start"], sr=SR, hop_length=HOP)
        best["final_hold_db"] = round(float(db[max(0, end_f - 65):end_f].mean() - db[f0:end_f].mean()), 2)
    # does it land on the home chord? chroma share of the key's tonic triad over the last 1.5 s before the end
    root = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"].index(key.split()[0])
    triad = [root, (root + (3 if "minor" in key else 4)) % 12, (root + 7) % 12]
    ch = librosa.feature.chroma_cqt(y=y[max(0, int((end_t - 1.5) * SR)):int(end_t * SR)], sr=SR, hop_length=HOP).mean(1)
    tri = dict(final_triad_share=round(float(ch[triad].sum() / ch.sum()), 3), final_top_pc_is_tonic=bool(int(np.argmax(ch)) == root),
               cut_by_duration=bool(end_t > len(y) / SR - 0.4))
    if best:
        best.update(tri)
    else:
        best = dict(none=True, **tri)
    return best, end_t


def main():
    out = json.load(open(OUTJ, encoding="utf-8")) if os.path.exists(OUTJ) else {}
    for e in LOG:
        if not e.get("ok") or (ONLY and e["id"] not in ONLY):
            continue
        k = f'{e["id"]}:{e["seed"]}'
        if k in out:
            continue
        p = e["paths"][0]
        x, sr = sf.read(p, dtype="float32", always_2d=True)
        mono = x.mean(1)
        lu = pyloudnorm.Meter(sr).integrated_loudness(x)
        clip = float(np.mean(np.abs(x) > 0.99))
        tp = true_peak_db(x[: sr * 60], sr)
        y = librosa.resample(mono, orig_sr=sr, target_sr=SR)
        dur = len(y) / SR
        bm, bt, oenv = beat_measures(y, e["bpm"])
        r = dict(id=e["id"], cue=e["cue"], arm=e["arm"], seed=e["seed"], shift=e["shift"], path=p, dur=round(dur, 2),
                 lufs=round(lu, 2), true_peak_db=round(tp, 2), clip_share=round(clip, 5), **bm, **spectral(y), **dropouts(y))
        # short-term loudness spread (LRA-like, 3 s windows): low = flat, very high = big swells/silences
        w3 = int(3 * SR)
        st = [20 * np.log10(np.sqrt(np.mean(y[i:i + w3] ** 2)) + 1e-9) for i in range(0, len(y) - w3, SR)]
        r["level_spread_db"] = round(float(np.percentile(st, 95) - np.percentile(st, 10)), 2)
        if e["cue"] in LOOPWIN:
            r["loop"] = best_loop(y, bt, e["cue"], dur, bm.get("bpm"), bm.get("bpm_prior"), e["bpm"])
            if r["loop"]:
                lp = r["loop"]
                r["loop"].update({k + "_loop": v for k, v in dropouts(y[int(lp["start"] * SR):int(lp["end"] * SR)], 0.0, 0.0).items()})
        else:
            r["sting"], r["end_t"] = sting_phrase(y, oenv, bt, e["key"])
        out[k] = r
        print(k, json.dumps({kk: r.get(kk) for kk in ("bpm", "bpm_prior", "grid", "pulse", "lufs", "harsh", "dropouts")}, default=float), json.dumps(r.get("loop") or r.get("sting"), default=float), flush=True)
        json.dump(out, open(OUTJ, "w", encoding="utf-8"), indent=1, default=float)


if __name__ == "__main__":
    main()
