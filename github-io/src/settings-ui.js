import { PRESETS, defaults, normalize } from "./settings.js";
export class SettingsUI {
  constructor({ get, apply, enter, leave }) {
    Object.assign(this, { get, apply, enter, leave });
    this.root = document.createElement("div");
    this.root.className = "settings-backdrop";
    this.root.hidden = true;
    document.body.append(this.root);
    this.root.addEventListener("click", (e) => {
      const button = e.target.closest("button");
      if (!button) return;
      if (button.dataset.tab) {
        this.tab = button.dataset.tab;
        this.paint();
      }
      if (button.dataset.color) {
        this.draft[button.dataset.team] = button.dataset.color;
        this.preview();
      }
      if (button.dataset.do === "cancel") this.close(false);
      if (
        button.dataset.do === "apply" &&
        this.draft.playerColor !== this.draft.enemyColor
      )
        this.close(true);
      if (button.dataset.do === "reset") {
        this.draft = defaults(matchMedia("(pointer:coarse)").matches);
        this.paint();
      }
      if (button.dataset.do === "contrast") {
        this.draft.playerColor = "gold";
        this.draft.enemyColor = "violet";
        this.preview();
      }
    });
    this.root.addEventListener("input", (e) => {
      const key = e.target.dataset.setting;
      if (!key) return;
      this.draft[key] =
        e.target.type === "checkbox"
          ? e.target.checked
          : e.target.type === "range"
            ? Number(e.target.value)
            : e.target.value;
      this.preview();
    });
    this.root.addEventListener("keydown", (e) => {
      e.stopPropagation();
      if (e.key === "Escape") {
        e.preventDefault();
        this.close(false);
      }
      if (e.key === "Tab") {
        const nodes = [
          ...this.root.querySelectorAll("button:not(:disabled),input,select"),
        ].filter((n) => n.offsetParent !== null);
        const first = nodes[0],
          last = nodes.at(-1);
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    });
  }
  get active() {
    return !this.root.hidden;
  }
  open() {
    if (this.active) return;
    this.focus = document.activeElement;
    this.state = this.enter();
    this.draft = { ...this.get() };
    this.tab = "army";
    this.root.hidden = false;
    document.querySelector("#app").inert = true;
    this.paint();
  }
  paint() {
    const swatches = (team) =>
      `<fieldset><legend>${team === "playerColor" ? "Your army" : "Enemy army"}</legend><div class="swatches">${Object.entries(
        PRESETS,
      )
        .map(
          ([id, color]) =>
            `<button data-team="${team}" data-color="${id}" aria-label="${team === "playerColor" ? "Your" : "Enemy"} ${id}" aria-pressed="false" style="--swatch:${color}"><i></i><span>${id}</span></button>`,
        )
        .join("")}</div></fieldset>`;
    const toggle = (key, label) =>
      `<label class="setting-row">${label}<input type="checkbox" data-setting="${key}" ${this.draft[key] ? "checked" : ""}></label>`;
    this.root.innerHTML = `<section class="settings-panel panel" role="dialog" aria-modal="true" aria-labelledby="settings-title"><header><div><span class="eyebrow">COMMANDER PREFERENCES</span><h2 id="settings-title">Make it yours.</h2></div><button data-do="cancel" aria-label="Close settings">×</button></header><nav aria-label="Settings tabs">${["army", "graphics", "audio"].map((t) => `<button data-tab="${t}" aria-pressed="${t === this.tab}">${t}</button>`).join("")}</nav><div class="settings-body">${this.tab === "army" ? `<div class="army-preview"><div class="preview-unit player"><i></i><b>● YOUR FORCE</b></div><div class="preview-unit enemy"><i></i><b>◆ ENEMY FORCE</b></div></div><p class="settings-note">Paint preview · neutral armor stays unchanged. Team symbols remain distinct.</p><button data-do="contrast">High contrast · Gold / Violet</button>${swatches("playerColor")}${swatches("enemyColor")}` : this.tab === "graphics" ? `<label class="setting-row">Graphics quality<select data-setting="quality"><option value="eco" ${this.draft.quality === "eco" ? "selected" : ""}>Eco</option><option value="high" ${this.draft.quality === "high" ? "selected" : ""}>High</option></select></label>${toggle("detail", "Decorative vegetation")}${toggle("waterMotion", "Animate water and effects")}<p class="settings-note">Eco limits pixel density and shadow cost. Bridges, water and terrain obstacles remain visible at every setting. Reduced motion is respected.</p>` : `${toggle("muted", "Mute all sound")}<label class="setting-row">Master volume<input aria-label="Master volume" type="range" min="0" max="1" step=".05" data-setting="masterVolume" value="${this.draft.masterVolume}"></label>${toggle("ambient", "River and wind ambience")}<p class="settings-note">Ambience is quietest away from water. Sound pauses with the match.</p>`}</div><p id="palette-warning" role="status"></p><footer><button data-do="reset">Defaults</button><button data-do="cancel">Cancel</button><button data-do="apply" class="primary">Apply settings</button></footer></section>`;
    this.preview();
    this.root.querySelector(`[data-tab="${this.tab}"]`).focus();
  }
  preview() {
    this.root.style.setProperty(
      "--preview-player",
      PRESETS[this.draft.playerColor],
    );
    this.root.style.setProperty(
      "--preview-enemy",
      PRESETS[this.draft.enemyColor],
    );
    for (const b of this.root.querySelectorAll("[data-color]"))
      b.setAttribute(
        "aria-pressed",
        String(this.draft[b.dataset.team] === b.dataset.color),
      );
    const same = this.draft.playerColor === this.draft.enemyColor;
    this.root.querySelector('[data-do="apply"]').disabled = same;
    this.root.querySelector("#palette-warning").textContent = same
      ? "Choose different colors for your army and the enemy."
      : "Preferences are saved on this browser when you apply.";
  }
  close(commit) {
    if (!this.active) return;
    if (commit) this.apply(normalize(this.draft));
    this.root.hidden = true;
    document.querySelector("#app").inert = false;
    this.leave(this.state);
    this.focus?.focus();
  }
}
