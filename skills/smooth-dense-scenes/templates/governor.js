// light-details template: adaptive graphics quality (ported from Zoo Garden's graphics.ts).
//
// On phones the frame cost is dominated by the pixels drawn (resolution x antialiasing) and the
// shadow pass, not by triangles. So: start phones at a modest resolution, decide antialiasing
// when the context is created, and let the governor trade resolution first, shadows second,
// then recover when the frame rate allows. The choice is stored per device, never in a save.
// No three import: it works on any WebGLRenderer-like object.

export const QUALITY = {
  low: { label: "Battery saver", ratio: 0.85, shadow: 0, particles: 0.45 },
  medium: { label: "Balanced", ratio: 1.25, shadow: 1024, particles: 0.75 },
  high: { label: "Sharp", ratio: 2, shadow: 2048, particles: 1 },
};

export function detectDevice() {
  const coarse = typeof matchMedia === "function" && matchMedia("(pointer: coarse)").matches;
  const agent = typeof navigator === "undefined" ? "" : navigator.userAgent;
  return {
    mobile: coarse || /Android|iPhone|iPad|iPod/i.test(agent),
    dpr: typeof devicePixelRatio === "number" ? devicePixelRatio : 1,
  };
}

// WebGLRenderer options. Antialiasing cannot change after the context exists, so it is decided
// here: off on high-density phones (their pixels are already small, and MSAA multiplies fill).
// preserveDrawingBuffer stops tiled mobile GPUs from discarding the frame: only for QA readback.
export function rendererOptions(device, { qa = false } = {}) {
  return {
    antialias: !(device.mobile && device.dpr >= 2),
    powerPreference: "high-performance",
    preserveDrawingBuffer: qa,
  };
}

export class Governor {
  constructor(device, stored = null) {
    this.device = device;
    const valid = (s) => s === "auto" || s in QUALITY;
    this.setting = valid(stored?.setting) ? stored.setting : "auto";
    this.autoLevel = stored?.autoLevel in QUALITY ? stored.autoLevel : null;
    this.fps = 0;
    this.frames = 0;
    this.elapsed = 0;
    this.slow = 0;
    this.ratio = this.targetRatio();
  }

  get level() {
    if (this.setting !== "auto") return this.setting;
    return this.autoLevel ?? (this.device.mobile ? "medium" : "high");
  }
  get profile() {
    return QUALITY[this.level];
  }
  targetRatio() {
    return Math.min(this.device.dpr, this.profile.ratio);
  }
  choose(setting) {
    this.setting = setting;
    if (setting === "auto") this.autoLevel = null;
    this.ratio = this.targetRatio();
  }

  // Feed every frame's real duration. Once a second in auto mode: three slow seconds in a row
  // (under 36 fps) lower the resolution a quarter step down to 1x, then the level, then the
  // resolution again down to 0.7x; a fast second (over 57 fps) raises resolution toward the
  // level's target. Pass playing=false in menus, while hidden, or during loading, or the
  // governor punishes a shader-compile hitch. Returns "ratio", "level" or null.
  sample(dt, playing) {
    this.frames++;
    this.elapsed += dt;
    if (this.elapsed < 1) return null;
    const fps = this.frames / this.elapsed;
    this.fps = fps;
    this.frames = 0;
    this.elapsed = 0;
    if (!playing || this.setting !== "auto") return null;
    if (fps < 36) {
      if (++this.slow < 3) return null;
      this.slow = 0;
      if (this.ratio > 1) {
        this.ratio = Math.max(1, this.ratio - 0.25);
        return "ratio";
      }
      const lower = { high: "medium", medium: "low" }[this.level];
      if (lower) {
        this.autoLevel = lower;
        this.ratio = Math.min(this.ratio, this.targetRatio());
        return "level";
      }
      if (this.ratio > 0.7) {
        this.ratio = Math.max(0.7, this.ratio - 0.15);
        return "ratio";
      }
      return null;
    }
    this.slow = 0;
    const target = this.targetRatio();
    if (fps > 57 && this.ratio < target) {
      this.ratio = Math.min(target, this.ratio + 0.25);
      return "ratio";
    }
    return null;
  }

  toJSON() {
    return { setting: this.setting, autoLevel: this.autoLevel };
  }
}

// Apply the governor's choice. Turning shadows on or off changes every lit material's shader,
// so materials are flagged for recompilation; a new shadow-map size needs a fresh map.
export function applyQuality(renderer, scene, sun, governor, { resize } = {}) {
  renderer.setPixelRatio(governor.ratio);
  const size = governor.profile.shadow,
    on = size > 0,
    toggled = renderer.shadowMap.enabled !== on;
  renderer.shadowMap.enabled = on;
  if (sun) {
    sun.castShadow = on;
    if (on && sun.shadow.mapSize.x !== size) {
      sun.shadow.mapSize.set(size, size);
      sun.shadow.map?.dispose();
      sun.shadow.map = null;
    }
  }
  if (toggled)
    scene.traverse((o) => {
      if (!o.material) return;
      for (const m of Array.isArray(o.material) ? o.material : [o.material]) m.needsUpdate = true;
    });
  resize?.(); // renderer.setSize(...) again so the drawing buffer takes the new ratio
}

// Every project site on one GitHub Pages account (user.github.io/game-a, /game-b) shares ONE
// origin and therefore one localStorage: always pass a key that names the game.
export function loadGovernor(device = detectDevice(), key) {
  if (!key) throw new Error('loadGovernor: pass a storage key that names the game, e.g. "zoo-garden-graphics"');
  let stored = null;
  try {
    stored = JSON.parse(localStorage.getItem(key) ?? "null");
  } catch {
    // Private mode or blocked storage: defaults apply.
  }
  return new Governor(device, stored);
}
export function saveGovernor(governor, key) {
  if (!key) throw new Error('saveGovernor: pass the same game-specific key as loadGovernor');
  try {
    localStorage.setItem(key, JSON.stringify(governor));
  } catch {
    // The setting lasts for this session.
  }
}

// Usage sketch:
//   const device = detectDevice();
//   const renderer = new THREE.WebGLRenderer({ canvas, ...rendererOptions(device, { qa }) });
//   const governor = loadGovernor(device, 'my-game-graphics');
//   applyQuality(renderer, scene, sun, governor, { resize });
//   // each frame, with the real (unclamped) frame time:
//   const change = governor.sample(realDt, playing && !document.hidden);
//   if (change) { applyQuality(renderer, scene, sun, governor, { resize }); if (change === "level") saveGovernor(governor, 'my-game-graphics'); }
