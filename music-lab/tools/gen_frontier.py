"""Frontier Command game music (2026-11-13): copy of songs-pop-slow-1105/tools/gen_popslow_songs.py, changed to
instrumental=True (lyrics = section tags only, from plan.json), per-entry shift, per-entry duration, arms interleaved
seed by seed (as in songs-kpop-cute-1106/tools/gen_kpop.py) so a time cut still leaves matched seeds.

Usage: python gen_frontier.py <ace_repo> <plan.json> <out_dir> [id ...]      env NSEEDS=n limits seeds per entry
Text2music only, turbo DiT + 1.7B LM, 8 steps, use_cot_caption/metas/language OFF (caption is used as written).
Original music only: no prompt names or imitates an artist, song or album; no reference audio.
"""
import json, os, sys, time

ACE = os.path.abspath(sys.argv[1])
PLAN = json.load(open(sys.argv[2], encoding="utf-8"))
OUT = os.path.abspath(sys.argv[3])
ONLY = set(sys.argv[4:])
sys.path.insert(0, ACE)


def main():
    todo = [s for s in PLAN if not ONLY or s["id"] in ONLY]
    from acestep.handler import AceStepHandler
    from acestep.llm_inference import LLMHandler
    from acestep.inference import GenerationParams, GenerationConfig, generate_music
    os.makedirs(OUT, exist_ok=True)
    dit = AceStepHandler()
    msg, ok = dit.initialize_service(project_root=ACE, config_path="acestep-v15-turbo", device="cuda", offload_to_cpu=False)
    print("DiT:", ok, msg, flush=True)
    if not ok:
        sys.exit(1)
    llm = LLMHandler()
    msg, lm_ok = llm.initialize(checkpoint_dir=os.path.join(ACE, "checkpoints"), lm_model_path="acestep-5Hz-lm-1.7B",
                                backend="pt", device="cuda", offload_to_cpu=False)
    print("LM:", lm_ok, msg, flush=True)
    logp = os.path.join(OUT, "generation-log.json")
    log = json.load(open(logp, encoding="utf-8")) if os.path.exists(logp) else []
    done = {(e["id"], e["seed"]) for e in log if e.get("ok")}
    n = int(os.environ.get("NSEEDS", "99"))
    jobs = [(s, seed) for i in range(n) for s in todo for seed in s["seeds"][i:i + 1]]
    for s, seed in jobs:
        if (s["id"], seed) in done:
            continue
        t0 = time.time()
        lyrics = s.get("lyrics", "[Instrumental]")
        params = GenerationParams(task_type="text2music", caption=s["caption"], lyrics=lyrics, instrumental=True,
                                  vocal_language="unknown", bpm=s["bpm"], keyscale=s["key"], timesignature="4",
                                  duration=float(s["duration"]), inference_steps=int(os.environ.get("ACE_STEPS", "8")),
                                  seed=seed, shift=float(s.get("shift", 2.0)), thinking=lm_ok, use_cot_caption=False,
                                  use_cot_metas=False, use_cot_language=False)
        config = GenerationConfig(batch_size=1, use_random_seed=False, seeds=[seed], audio_format="wav")
        res = generate_music(dit, llm if lm_ok else None, params, config, save_dir=os.path.join(OUT, s["id"]))
        paths = [a.get("path") for a in (res.audios or [])] if res.success else []
        print(s["id"], seed, res.success, paths, res.error if not res.success else "", f"{time.time()-t0:.1f}s", flush=True)
        log.append(dict(id=s["id"], cue=s["cue"], arm=s["arm"], seed=seed, ok=res.success, paths=paths, caption=s["caption"],
                        lyrics=lyrics, instrumental=True, shift=float(s.get("shift", 2.0)), bpm=s["bpm"], key=s["key"],
                        duration=s["duration"], steps=params.inference_steps, dit="acestep-v15-turbo",
                        lm="acestep-5Hz-lm-1.7B" if lm_ok else None, cot=False, secs=round(time.time() - t0, 1),
                        error=None if res.success else str(res.error)))
        json.dump(log, open(logp, "w", encoding="utf-8"), indent=1, ensure_ascii=False)


if __name__ == "__main__":
    main()
