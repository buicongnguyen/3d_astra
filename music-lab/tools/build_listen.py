"""Blind, loudness-matched listen page (pattern of songs-kpop-cute-1106/tools/build_listen.py). demucs-venv.
python build_listen.py <listen_report.json> <shortlist.json> <final_manifest.json> <out_dir>
listen_report.json = finalize.py report for the shortlisted candidates (names "<cue>-<n>"), all mastered exactly like
the finals (-16 LUFS, <= -1.5 dBTP, 64 kbps AAC, seamless loop cut). shortlist.json: {"<cue>": [{"key","note"}...]}.
Writes <out>/index.html (blind labels, no seed/arm/caption on the page), <out>/audio.js (base64 audio so the Web Audio
loop test works from file://), <out>/key.json (label -> take, kept separate)."""
import base64, html, json, os, random, shutil, sys

REP, SL, MAN, OUT = sys.argv[1:5]
rep = json.load(open(REP, encoding="utf-8"))
sl = json.load(open(SL, encoding="utf-8"))
man = json.load(open(MAN, encoding="utf-8"))
FINAL = os.path.join(os.path.dirname(os.path.abspath(MAN)))
os.makedirs(os.path.join(OUT, "audio"), exist_ok=True)
esc = html.escape
CUES = [("title", "Title screen theme", "heroic but light; loops"), ("campaign", "Campaign map / briefing", "calm, curious, hopeful; loops"),
        ("defence", "Between defence waves", "steady, alert, room to breathe; loops"), ("victory", "Victory sting", "5-8 s, bright resolve"),
        ("defeat", "Defeat sting", "5-8 s, gentle fall")]
key, data, sections, loops = {}, {}, [], {}
PREFIX = {"title": "T", "campaign": "C", "defence": "D", "victory": "V", "defeat": "F"}


def card(lab, src, meta, note, loop, sid):
    btn = f"<button data-id='{sid}'>Play as game loop</button><button data-id='{sid}' data-seam=1>Hear the seam (5 s before)</button><button class=stop>Stop</button>" if loop else ""
    return (f"<section class=take><h3>{lab}</h3><audio controls preload=none src='{src}'></audio><div class=btns>{btn}</div>"
            f"<p class=meta>{meta}</p><p class=note>{esc(note)}</p>"
            f"<label>Your stars <select data-k='{sid}'><option>-</option><option>1</option><option>2</option><option>3</option><option>4</option><option>5</option></select></label></section>")


for cue, title, hint in CUES:
    cards = []
    # blind order: shuffled per cue (fixed seed) so label A is not always the proposed pick
    order = list(range(len(sl.get(cue, []))))
    random.Random(1113 + len(cue)).shuffle(order)
    for i, j in enumerate(order):
        t = sl[cue][j]
        lab = f"{PREFIX[cue]}{'ABCDEFG'[i]}"
        name = f"{cue}-{j + 1}"
        r = rep[name]
        src = f"audio/{lab}.m4a"
        shutil.copy(r["_m4a"], os.path.join(OUT, src))
        data[lab] = base64.b64encode(open(os.path.join(OUT, src), "rb").read()).decode()
        key[lab] = dict(take=t["key"], cue=cue, arm=r["arm"], seed=r["seed"], shift=r["shift"])
        isloop = "loopStart" in r
        if isloop:
            loops[lab] = [r["loopStart"], r["loopEnd"]]
            meta = (f"loop {r['loop_seconds']:.1f} s = {r['bars']} bars at {r['bpm_loop']:.1f} bpm &middot; seam match {r['seam_score']:.2f} "
                    f"&middot; seam smoothness {r['seam_jump_vs_median']:.2f}x the music around it &middot; {r['lufs']:.1f} LUFS, {r['true_peak_db']:.1f} dBTP &middot; {r['bytes'] / 1e6:.2f} MB")
        else:
            meta = f"{r['sting_seconds']:.1f} s &middot; {r['lufs']:.1f} LUFS, {r['true_peak_db']:.1f} dBTP &middot; {r['bytes'] / 1e3:.0f} kB"
        cards.append(card(f"Take {lab}", src, meta, t["note"], isloop, lab))
    # the chosen final (not blind: it is one of the takes above)
    m = man["tracks"][cue]
    fsrc = f"audio/final-{cue}.m4a"
    shutil.copy(os.path.join(FINAL, m["file"]), os.path.join(OUT, fsrc))
    fid = f"final-{cue}"
    data[fid] = base64.b64encode(open(os.path.join(OUT, fsrc), "rb").read()).decode()
    isloop = "loopStart" in m
    if isloop:
        loops[fid] = [m["loopStart"], m["loopEnd"]]
    fmeta = (f"loop {m['loopStart']:.3f}-{m['loopEnd']:.3f} s &middot; " if isloop else "") + f"{m['bpm']} bpm &middot; {m['lufs']} LUFS &middot; {m['bytes'] / 1e3:.0f} kB"
    final = card("Chosen final (file the game would use)", fsrc, fmeta, "The proposed pick by the numbers - your ears decide.", isloop, fid)
    sections.append(f"<h2>{esc(title)} <small>{esc(hint)}</small></h2>{''.join(cards)}<div class=final>{final}</div>")

open(os.path.join(OUT, "audio.js"), "w", encoding="utf-8").write("window.AUDIO=" + json.dumps(data) + ";")
json.dump(key, open(os.path.join(OUT, "key.json"), "w", encoding="utf-8"), indent=1)
page = f"""<!doctype html><html lang=en><meta charset=utf-8><meta name=viewport content="width=device-width,initial-scale=1"><title>Frontier Command Music</title>
<style>:root{{--bg:#f7f1e6;--fg:#2b2117;--mut:#75644f;--card:#fffaf2;--acc:#b5562b;--fin:#e9f1e4}}
@media (prefers-color-scheme:dark){{:root:not([data-theme=light]){{--bg:#17130f;--fg:#f3e9dc;--mut:#b8a68e;--card:#221c16;--acc:#f08a50;--fin:#1d2619}}}}
:root[data-theme=dark]{{--bg:#17130f;--fg:#f3e9dc;--mut:#b8a68e;--card:#221c16;--acc:#f08a50;--fin:#1d2619}}
body{{background:var(--bg);color:var(--fg);font:16px/1.5 system-ui,sans-serif;margin:0 auto;padding:16px;max-width:780px}}
h1{{color:var(--acc);margin-bottom:0}}h2{{margin-top:1.6em;border-bottom:2px solid var(--acc)}}h2 small{{font-weight:400;color:var(--mut);font-size:14px}}
.take{{background:var(--card);border-radius:14px;padding:12px 16px;margin:14px 0;box-shadow:0 1px 4px #0002}}.final .take{{background:var(--fin)}}
audio{{width:100%}}.meta{{color:var(--mut);font-size:13px;margin:.4em 0}}.note{{margin:.3em 0}}
.btns{{display:flex;flex-wrap:wrap;gap:8px;margin-top:6px}}button,select{{font-size:15px;min-height:44px;padding:0 12px;border-radius:10px;border:1px solid var(--mut);background:var(--card);color:var(--fg)}}
button:hover{{border-color:var(--acc)}}</style>
<h1>Frontier Command - music candidates</h1>
<p>Original instrumental cues made locally with ACE-Step 1.5. Labels are blind (settings hidden); every file is mastered the same way (-16 LUFS, peak at most -1.5 dBTP, 64 kbps AAC - the size the game would ship). Nothing is installed in the game.</p>
<p class=meta>"Play as game loop" plays the file with Web Audio loopStart/loopEnd exactly as the game would. "Hear the seam" starts 5 s before the loop point so you can hear the wrap quickly. Listen for: a click or a jump at the wrap, a tempo hitch, harsh highs, and whether the mood fits (hopeful, brave, a little tense, never grim).</p>
{''.join(sections)}
<script src="audio.js"></script>
<script>
const LOOPS={json.dumps(loops)};let ctx,src,bufs={{}};
function b64(s){{const b=atob(s),u=new Uint8Array(b.length);for(let i=0;i<b.length;i++)u[i]=b.charCodeAt(i);return u.buffer}}
async function play(id,seam){{ctx=ctx||new AudioContext();stop();document.querySelectorAll('audio').forEach(a=>a.pause());
 if(!bufs[id])bufs[id]=await ctx.decodeAudioData(b64(window.AUDIO[id]));const [ls,le]=LOOPS[id];
 src=ctx.createBufferSource();src.buffer=bufs[id];src.loop=true;src.loopStart=ls;src.loopEnd=le;src.connect(ctx.destination);
 src.start(0,seam?Math.max(ls,le-5):0)}}
function stop(){{if(src){{try{{src.stop()}}catch(e){{}};src=null}}}}
document.querySelectorAll('button[data-id]').forEach(b=>b.onclick=()=>play(b.dataset.id,!!b.dataset.seam));
document.querySelectorAll('button.stop').forEach(b=>b.onclick=stop);
document.querySelectorAll('audio').forEach(a=>a.onplay=stop);
document.querySelectorAll('select').forEach(s=>{{try{{s.value=localStorage.getItem('fc-'+s.dataset.k)||'-'}}catch(e){{}};s.onchange=()=>{{try{{localStorage.setItem('fc-'+s.dataset.k,s.value)}}catch(e){{}}}}}});
</script></html>"""
open(os.path.join(OUT, "index.html"), "w", encoding="utf-8").write(page)
print("labels:", json.dumps(key, indent=1))
