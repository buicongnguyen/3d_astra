// Recorded music: tracks in public/music/ listed by public/music/manifest.json. Nothing is fetched
// until the director asks for a cue, which happens only after the first user gesture (the audio
// engine itself loads then, see app/sound.js) and only under the "Recorded + adaptive" setting.
//
// A track is fetched, decoded with decodeAudioData and looped by an AudioBufferSourceNode at the
// manifest's exact loop points: a media element leaves a gap at the loop on iOS, and AAC adds
// priming silence at the start, so the points are measured and stored, never guessed. Every cue has
// its own gain into the music bus, so the volume sliders, mute and the bus ducks apply. Cues
// crossfade (MIX.recorded.crossfade); the victory and defeat stings play once.
//
// Memory: a 75 s stereo loop decodes to about 29 MB of floats, so only the loop that is playing
// (or about to) and the two short stings stay decoded. Encoded bytes (a few hundred KB each) stay
// in memory, so going back to a cue only re-decodes. The next likely cue is fetched while idle.
// Any failure (no manifest, a missing file, a decode error) marks the cue failed and the director
// falls back to the adaptive score without a sound or a message.
import { MIX } from "./audio-mix.js";
import { RECORDED_CUES, STINGS, loopPoints, recordedTrim } from "./audio-logic.js";

const pageBase = () => globalThis.document?.baseURI || globalThis.location?.href || "http://localhost/";

export class RecordedMusic {
  // `out` is the music bus. `base` is the folder holding manifest.json (relative to the page).
  constructor(context, out, { base = "music/", fetcher = (url, init) => fetch(url, init) } = {}) {
    this.context = context;
    this.out = out;
    this.manifestUrl = new URL("manifest.json", new URL(base, pageBase())).href;
    this.fetcher = fetcher;
    this.status = "idle"; // idle -> loading -> ready | failed
    this.manifest = null;
    this.bytes = new Map(); // cue -> encoded ArrayBuffer
    this.buffers = new Map(); // cue -> decoded AudioBuffer (current loop + stings)
    this.pending = new Map(); // cue -> decode promise
    this.failed = new Set();
    this.fetched = []; // every URL requested (observable in tests)
    this.voice = null; // { cue, source, gain }: the cue sounding now
    this.fading = new Set(); // voices fading out
    this.want = null; // the cue the director asked for last
    this.prefetching = false;
    this.generation = 0; // bumped by release(): late fetches and decodes from before are dropped
  }

  // The manifest, fetched once (network first: the service worker refreshes it, see sw.template.js).
  load() {
    if (this.status !== "idle") return this.loading;
    this.status = "loading";
    const generation = this.generation;
    this.fetched.push(this.manifestUrl);
    this.loading = this.fetcher(this.manifestUrl, { cache: "no-cache" })
      .then((response) => { if (!response.ok) throw new Error(`music manifest ${response.status}`); return response.json(); })
      .then((manifest) => {
        if (generation !== this.generation) return;
        const tracks = manifest && typeof manifest.tracks === "object" ? manifest.tracks : {};
        this.manifest = { tracks: Object.fromEntries(Object.entries(tracks).filter(([cue, t]) => RECORDED_CUES.includes(cue) && typeof t?.file === "string" && t.file)) };
        this.status = "ready";
      })
      .catch(() => { if (generation === this.generation) { this.status = "failed"; this.manifest = { tracks: {} }; } });
    return this.loading;
  }

  // Can this cue play? While the manifest is still on its way the answer is yes, so the director
  // waits quietly instead of starting the adaptive score and swapping a moment later.
  can(cue) {
    if (this.failed.has(cue)) return false;
    if (this.status === "idle" || this.status === "loading") return RECORDED_CUES.includes(cue);
    return !!this.manifest?.tracks[cue];
  }

  url(cue) {
    const track = this.manifest?.tracks[cue];
    if (!track) return null;
    const url = new URL(track.file, this.manifestUrl);
    // The byte count versions the URL, so a replaced file is never served from a stale cache.
    if (Number.isFinite(track.bytes)) url.searchParams.set("v", String(track.bytes));
    return url.href;
  }

  async fetchBytes(cue) {
    if (this.bytes.has(cue)) return this.bytes.get(cue);
    await this.load();
    const url = this.url(cue);
    if (!url) throw new Error(`no track for ${cue}`);
    this.fetched.push(url);
    const generation = this.generation, response = await this.fetcher(url);
    if (!response.ok) throw new Error(`music ${cue} ${response.status}`);
    const data = await response.arrayBuffer();
    if (generation !== this.generation) throw new Error("music released");
    this.bytes.set(cue, data);
    return data;
  }

  // Decoded buffer for a cue, or null when it cannot play (the cue is then marked failed).
  decode(cue) {
    if (this.buffers.has(cue)) return Promise.resolve(this.buffers.get(cue));
    if (this.pending.has(cue)) return this.pending.get(cue);
    const generation = this.generation;
    const job = (async () => {
      try {
        const data = await this.fetchBytes(cue);
        // decodeAudioData detaches the buffer it is given: decode a copy, keep the bytes.
        const buffer = await this.context.decodeAudioData(data.slice(0));
        if (generation !== this.generation) return null;
        if (STINGS.has(cue) || cue === this.want) this.buffers.set(cue, buffer);
        return buffer;
      } catch {
        if (generation === this.generation) this.failed.add(cue);
        return null;
      } finally {
        if (this.pending.get(cue) === job) this.pending.delete(cue);
      }
    })();
    this.pending.set(cue, job);
    return job;
  }

  // Ask for a cue (null = silence). Called every frame by the director, so a repeat is free. The
  // current cue fades out while the new one fades in once it is decoded.
  play(cue) {
    if (cue === this.want) return;
    this.want = cue;
    if (this.voice && this.voice.cue !== cue) this.fadeOut(this.voice, MIX.recorded.crossfade);
    this.trim();
    if (!cue) return;
    if (this.status === "idle") this.load();
    this.decode(cue).then((buffer) => {
      if (buffer && this.want === cue && this.voice?.cue !== cue) this.start(cue, buffer);
    });
  }

  start(cue, buffer) {
    const ctx = this.context, now = ctx.currentTime, track = this.manifest?.tracks[cue] || {};
    const source = ctx.createBufferSource(), gain = ctx.createGain();
    source.buffer = buffer;
    if (!STINGS.has(cue)) {
      const { loopStart, loopEnd } = loopPoints(track, buffer.duration);
      source.loop = true; source.loopStart = loopStart; source.loopEnd = loopEnd;
    }
    const level = recordedTrim(track.lufs), fade = STINGS.has(cue) ? MIX.recorded.stingFade : MIX.recorded.crossfade;
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(level, now + fade);
    source.connect(gain); gain.connect(this.out);
    const voice = { cue, source, gain, level, startedAt: now };
    source.onended = () => {
      try { gain.disconnect(); } catch { /* already disconnected */ }
      this.fading.delete(voice);
      if (this.voice === voice) this.voice = null;
    };
    source.start(now);
    this.voice = voice;
    this.trim();
  }

  fadeOut(voice, seconds) {
    const g = voice.gain.gain, now = this.context.currentTime;
    g.cancelScheduledValues(now);
    g.setValueAtTime(g.value, now);
    g.linearRampToValueAtTime(0, now + seconds);
    try { voice.source.stop(now + seconds + 0.05); } catch { /* already stopped */ }
    if (this.voice === voice) this.voice = null;
    this.fading.add(voice);
  }

  // Only the wanted loop and the stings stay decoded; a fading voice keeps its own buffer alive
  // until it stops.
  trim() {
    for (const cue of [...this.buffers.keys()]) if (!STINGS.has(cue) && cue !== this.want) this.buffers.delete(cue);
  }

  // Fetch (and for stings, decode) the next likely cues while the page is idle.
  prefetch(cues) {
    if (this.prefetching || this.status !== "ready" || !cues?.length) return;
    const todo = cues.filter((cue) => this.manifest.tracks[cue] && !this.failed.has(cue) && (STINGS.has(cue) ? !this.buffers.has(cue) : !this.bytes.has(cue)));
    if (!todo.length) return;
    this.prefetching = true;
    const generation = this.generation;
    const run = async () => {
      for (const cue of todo) {
        if (this.status !== "ready" || generation !== this.generation) break;
        try { if (STINGS.has(cue)) await this.decode(cue); else await this.fetchBytes(cue); } catch { /* the cue is tried again when it is asked for */ }
      }
      this.prefetching = false;
    };
    const idle = globalThis.requestIdleCallback;
    if (idle) idle(() => run(), { timeout: 4000 }); else setTimeout(run, 1500);
  }

  // Music set to "Adaptive only" or "Off": stop and forget every track (fetched again if it comes back).
  release() {
    if (this.status === "idle" && !this.voice && !this.bytes.size) return;
    this.want = null; this.generation++;
    if (this.voice) this.fadeOut(this.voice, 0.3);
    this.buffers.clear(); this.bytes.clear(); this.pending.clear(); this.failed.clear();
    this.status = "idle"; this.manifest = null; this.loading = null;
  }

  // Test and debug view (window.__frontier.music.state()).
  state() {
    return {
      status: this.status,
      want: this.want,
      cue: this.voice?.cue ?? null,
      playing: !!this.voice && this.context.state === "running",
      gain: this.voice ? this.voice.gain.gain.value : 0,
      loop: this.voice ? { loop: this.voice.source.loop, loopStart: this.voice.source.loopStart, loopEnd: this.voice.source.loopEnd } : null,
      fading: this.fading.size,
      decoded: [...this.buffers.keys()],
      encoded: [...this.bytes.keys()],
      failed: [...this.failed],
      fetched: [...this.fetched],
      context: this.context.state,
    };
  }
}
