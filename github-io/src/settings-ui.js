import { PRESETS, defaults, normalize } from "./settings.js";
import { portrait } from "./portraits.js";
import { icon } from "./icons.js";

const TABS = { army: "Army", graphics: "Graphics", audio: "Audio" };
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
      const tab = e.target.closest?.("[role=tab]");
      if (tab && ["ArrowLeft", "ArrowRight", "Home", "End"].includes(e.key)) {
        e.preventDefault();
        const names = Object.keys(TABS), at = names.indexOf(this.tab);
        this.tab = e.key === "Home" ? names[0] : e.key === "End" ? names.at(-1)
          : names[(at + (e.key === "ArrowRight" ? 1 : names.length - 1)) % names.length];
        this.paint();
        return;
      }
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
      `<fieldset><legend>${team === "playerColor" ? "Your army" : "Enemy army"}</legend><div class="swatches" style="--count:${Object.keys(PRESETS).length}">${Object.entries(
        PRESETS,
      )
        .map(
          ([id, color]) =>
            `<button data-team="${team}" data-color="${id}" aria-label="${team === "playerColor" ? "Your" : "Enemy"} ${id}" aria-pressed="false" style="--swatch:${color}"><i></i><span>${id}</span></button>`,
        )
        .join("")}</div></fieldset>`;
    // Checkboxes stay real inputs (keyboard, forms, tests); CSS draws them as switches.
    const toggle = (key, label) =>
      `<label class="setting-row">${label}<input type="checkbox" role="switch" data-setting="${key}" ${this.draft[key] ? "checked" : ""}></label>`;
    const army = `<div class="army-preview"><div class="preview-unit player">${portrait("tank", "friendly", "preview-art")}<b>● YOUR FORCE</b></div><div class="preview-unit enemy">${portrait("tank", "hostile", "preview-art")}<b>◆ ENEMY FORCE</b></div></div><p class="settings-note">Paint preview · neutral armor stays unchanged. Team symbols remain distinct.</p><button data-do="contrast" class="contrast-button">${icon("shield")}<span>High contrast · Gold / Violet</span></button>${swatches("playerColor")}${swatches("enemyColor")}`;
    const graphics = `<label class="setting-row">Graphics quality<select data-setting="quality"><option value="eco" ${this.draft.quality === "eco" ? "selected" : ""}>Eco</option><option value="high" ${this.draft.quality === "high" ? "selected" : ""}>High</option></select></label>${toggle("detail", "Decorative vegetation")}${toggle("waterMotion", "Animate water")}${toggle("combatMotion", "Animate combat effects")}<p class="settings-note">Eco limits pixel density and shadow cost. Bridges, water and terrain obstacles remain visible at every setting. Reduced motion is respected.</p>`;
    const audio = `${toggle("muted", "Mute all sound")}<label class="setting-row">Master volume<input aria-label="Master volume" type="range" min="0" max="1" step=".05" data-setting="masterVolume" value="${this.draft.masterVolume}"></label>${toggle("ambient", "River and wind ambience")}<p class="settings-note">Ambience is quietest away from water. Sound pauses with the match.</p>`;
    this.root.innerHTML = `<section class="settings-panel panel" role="dialog" aria-modal="true" aria-labelledby="settings-title"><header><div class="settings-heading"><span class="eyebrow">COMMANDER PREFERENCES</span><h2 id="settings-title">Make it yours.</h2></div><label class="language-choice" title="Language / Ngôn ngữ">${icon("globe")}<span class="visually-hidden" translate="no">Language / Ngôn ngữ</span><select data-setting="language" aria-label="Language / Ngôn ngữ" translate="no"><option value="en">English</option><option value="vi">Tiếng Việt</option></select></label><button data-do="cancel" class="settings-close" aria-label="Close settings">${icon("close")}</button></header><nav role="tablist" aria-label="Settings tabs">${Object.entries(TABS).map(([t, label]) => `<button role="tab" id="settings-tab-${t}" data-tab="${t}" aria-selected="${t === this.tab}" aria-controls="settings-body" tabindex="${t === this.tab ? 0 : -1}">${label}</button>`).join("")}</nav><div class="settings-body" id="settings-body" role="tabpanel" aria-labelledby="settings-tab-${this.tab}">${this.tab === "army" ? army : this.tab === "graphics" ? graphics : audio}</div><p id="palette-warning" role="status"></p><footer><button data-do="reset" class="ghost">Defaults</button><button data-do="cancel" class="secondary">Cancel</button><button data-do="apply" class="primary">Apply settings</button></footer></section>`;
    this.root.querySelector('[data-setting="language"]').value = this.draft.language;
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
