"""Blind, loudness-matched listen page for the faction themes and stingers (Audio 6.5, 2026-11-26). demucs-venv or any
Python 3. Served over the LAN (python -m http.server from <out_dir>), so the audio stays as plain files (no base64).

python build_listen_factions.py <listen_report.json> <shortlist.json> <out_dir> <key_json>
listen_report.json = finalize.py report for the shortlisted candidates (names "<cue>-<n>", mastered exactly like the
finals: -16 LUFS, <= -1.5 dBTP, 64 kbps AAC, seamless loop cut). shortlist.json: {"<cue>": [{"key", "note"}, ...]}.
Writes <out>/index.html and <out>/audio/*.m4a (blind labels; no seed, arm or caption on the page). The label -> take key
goes to <key_json>, outside the served folder.
"""
import html, json, os, random, shutil, sys

REP, SL, OUT, KEY = sys.argv[1:5]
rep = json.load(open(REP, encoding="utf-8"))
sl = json.load(open(SL, encoding="utf-8"))
os.makedirs(os.path.join(OUT, "audio"), exist_ok=True)
esc = html.escape
FACTIONS = [
    ("meridian", "Meridian Expedition", "hopeful surveyors and engineers: guitar, horn, low strings, frame drums"),
    ("ashfall", "Ashfall Combine", "disciplined salvage fleet: low brass, cellos, taiko and anvil, march"),
    ("sunward", "Sunward Caravan", "proud desert traders: plucked lute, fiddle, goblet drum"),
    ("wardens", "The Wardens", "ancient guardian machines: synth pulse, deep strings, glass bells, taiko"),
    ("veil", "Veil Survey", "hidden scholars: breathy flute, harp, marimba, low drone"),
]
key, loops, sections = {}, {}, []


def card(lab, src, meta, note, sid, loop):
    btn = (f"<button data-id='{sid}'>Play as game loop</button><button data-id='{sid}' data-seam=1>Hear the seam</button>"
           f"<button class=stop>Stop</button>") if loop else ""
    return (f"<section class=take><h4>{lab}</h4><audio controls preload=none src='{src}'></audio><div class=btns>{btn}</div>"
            f"<p class=meta>{meta}</p><p class=note>{esc(note)}</p>"
            f"<label>Stars <select data-k='{sid}'><option>-</option><option>1</option><option>2</option><option>3</option>"
            f"<option>4</option><option>5</option></select></label></section>")


for fid, name, hint in FACTIONS:
    parts = []
    for kind, cue, title in (("T", f"theme-{fid}", "Battle theme (loops)"), ("S", f"sting-{fid}", "Stinger (match start, faction pick, victory)")):
        cards = []
        order = list(range(len(sl.get(cue, []))))
        random.Random(1126 + len(cue) * 7).shuffle(order)  # blind order, fixed seed: label A is not always the pick
        for i, j in enumerate(order):
            t = sl[cue][j]
            lab = f"{fid[:2].upper()}-{kind}{'ABCDEFG'[i]}"
            r = rep[f"{cue}-{j + 1}"]
            src = f"audio/{lab}.m4a"
            shutil.copy(r["_m4a"], os.path.join(OUT, src))
            key[lab] = dict(take=t["key"], cue=cue, arm=r["arm"], seed=r["seed"], shift=r["shift"], picked=bool(t.get("picked")))
            if "loopStart" in r:
                loops[lab] = [r["loopStart"], r["loopEnd"]]
                meta = (f"loop {r['loop_seconds']:.1f} s = {r['bars']} bars at {r['bpm_loop']:.1f} bpm &middot; seam smoothness "
                        f"{r['seam_jump_vs_median']:.2f}x the music around it &middot; {r['lufs']:.1f} LUFS, {r['true_peak_db']:.1f} dBTP "
                        f"&middot; {r['bytes'] / 1e3:.0f} kB")
            else:
                meta = f"{r['sting_seconds']:.1f} s &middot; {r['lufs']:.1f} LUFS, {r['true_peak_db']:.1f} dBTP &middot; {r['bytes'] / 1e3:.0f} kB"
            cards.append(card(lab, src, meta, t.get("note", ""), lab, "loopStart" in r))
        parts.append(f"<h3>{title}</h3><div class=grid>{''.join(cards)}</div>")
    sections.append(f"<section class=cue><h2>{esc(name)}</h2><p class=meta>{esc(hint)}</p>{''.join(parts)}</section>")

json.dump(key, open(KEY, "w", encoding="utf-8"), indent=1)
page = f"""<!doctype html><html lang=en><meta charset=utf-8><meta name=viewport content="width=device-width,initial-scale=1">
<title>Faction music</title>
<style>:root{{--bg:#f6f4ef;--fg:#1d1d1b;--card:#fff;--mut:#6b6a66;--acc:#2a7a62}}
@media (prefers-color-scheme:dark){{:root{{--bg:#151614;--fg:#ecebe6;--card:#20221f;--mut:#a3a29c;--acc:#7fd6b4}}}}
body{{background:var(--bg);color:var(--fg);font:16px/1.45 system-ui,sans-serif;margin:0 auto;max-width:1100px;padding:16px}}
h1{{font-size:24px}}h2{{margin:1.6em 0 .1em}}h3{{margin:1em 0 .4em;font-size:17px}}h4{{margin:0 0 6px}}
.grid{{display:grid;grid-template-columns:repeat(auto-fill,minmax(300px,1fr));gap:12px}}
.take{{background:var(--card);border-radius:12px;padding:12px}}audio{{width:100%}}.meta{{color:var(--mut);font-size:13px;margin:.4em 0}}
.btns{{display:flex;flex-wrap:wrap;gap:8px;margin-top:6px}}
button,select{{font-size:15px;min-height:44px;padding:0 12px;border-radius:10px;border:1px solid var(--mut);background:var(--card);color:var(--fg)}}
button:hover{{border-color:var(--acc)}}</style>
<h1>Frontier Command: faction music candidates</h1>
<p>Each faction gets a battle theme (it loops while you play that faction) and a short stinger (it plays when you pick the
faction, when a match starts and when you win). All takes are original instrumentals made locally with ACE-Step 1.5 and
mastered the same way as the game files (-16 LUFS, 64 kbps AAC). Labels are blind; one theme and one stinger per faction
are already in the game build on branch claude/music, and you can swap any of them for another label here.</p>
<p class=meta>"Play as game loop" loops the file at its loop points exactly as the game does. "Hear the seam" starts 5 s
before the loop point. Listen for: does it sound like that faction, a click or jump at the wrap, harsh highs, and whether it
stays out of the way of unit voices.</p>
{''.join(sections)}
<script>
const LOOPS={json.dumps(loops)};let ctx,src,bufs={{}};
async function play(id,seam){{ctx=ctx||new AudioContext();stop();document.querySelectorAll('audio').forEach(a=>a.pause());
 if(!bufs[id])bufs[id]=await ctx.decodeAudioData(await (await fetch('audio/'+id+'.m4a')).arrayBuffer());const [ls,le]=LOOPS[id];
 src=ctx.createBufferSource();src.buffer=bufs[id];src.loop=true;src.loopStart=ls;src.loopEnd=le;src.connect(ctx.destination);
 src.start(0,seam?Math.max(ls,le-5):ls)}}
function stop(){{if(src){{try{{src.stop()}}catch(e){{}};src=null}}}}
document.querySelectorAll('button[data-id]').forEach(b=>b.onclick=()=>play(b.dataset.id,!!b.dataset.seam));
document.querySelectorAll('button.stop').forEach(b=>b.onclick=stop);
document.querySelectorAll('audio').forEach(a=>a.onplay=()=>{{stop();document.querySelectorAll('audio').forEach(o=>{{if(o!==a)o.pause()}})}});
document.querySelectorAll('select').forEach(s=>{{try{{s.value=localStorage.getItem('fcf-'+s.dataset.k)||'-'}}catch(e){{}};s.onchange=()=>{{try{{localStorage.setItem('fcf-'+s.dataset.k,s.value)}}catch(e){{}}}}}});
</script></html>"""
open(os.path.join(OUT, "index.html"), "w", encoding="utf-8").write(page)
print("labels:", len(key))
