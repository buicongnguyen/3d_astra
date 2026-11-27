import "./tactics-ui.css";
import { icon } from "./icons.js";
import { ABILITY_KEYS, STANCES, STANCE_INFO, abilityGroups, abilityStatus, shouldPulse, stanceState, stancesInUse, takesStance } from "./tactics-ui.js";

// Command-card controls for fighting units: one tile per distinct ability (name, glyph,
// cooldown sweep and seconds) and a three-way stance switch. The markup is rebuilt only when
// the selection changes; update() refreshes cooldowns and the pressed stance in place.

export const abilityLimit = () => 99; // every ability stays visible; only the first ones have a key letter

// Phones: short words for long ability names, and a symbol alone where the shape says it (the full name stays in aria-label).
// Only landscape tiles (53-62 px wide, `side`) use the short form; portrait tiles (66-72 px) give the full name two
// lines (re-score 2026-11-25b: "Lock-on" read "Lock"). Lock-on keeps its name everywhere: it fits.
// (src/locales vi.json / ko.json translate each one; tests/phone-hud.mjs checks every name fits in EN/VI/KO.)
export const PHONE_NAME = { "Rapid fire": "Rapid", "Triage pulse": "Heal", "Shield wall": "Shield", "Field repair": "Repair", "Shadow strike": "Strike", "Shield link": "Link",
  "Overdrive": "Boost", "Crossfire": "Cross", "Steady aim": "Aim", "Burn line": "Burn", "Spur on": "Spur",
  "Strafing run": "Strafe", "Signal flare": "Flare", "Bomb drop": "Bomb",
  // Campaign heroes (src/sim/content/campaign-heroes.js).
  "Hold the line": "Line", "Caravan volley": "Volley", "Iron hull": "Hull", "Damper pulse": "Damper" };
const PHONE_SYMBOL = new Set(["Shield wall", "Field repair"]);

export function tacticsCardHTML(sim, entities, { compact = false, side = false, keys = true } = {}) {
  const tiles = abilityGroups(sim, entities, abilityLimit(compact, side)).map((g, i) => {
    const key = keys ? ABILITY_KEYS[i] : null;
    return `<button class="ability-tile${compact && PHONE_SYMBOL.has(g.name) ? " symbol-only" : ""}" data-ability="${g.id}"${key ? ` data-hotkey="${key}"` : ""} aria-label="${g.name}" title="${key ? `${key} · ` : ""}${g.name} · ${g.description}">${key ? `<kbd class="action-key">${key}</kbd>` : ""}${icon(g.icon)}<span class="ability-name">${compact && side ? PHONE_NAME[g.name] || g.name : g.name}</span><small class="ability-status"></small><i class="ability-sweep" aria-hidden="true"></i></button>`;
  }).join("");
  const stance = entities.some(takesStance)
    ? `<div class="stance-control" role="group" aria-label="Stance">${STANCES.map((id) => {
        const s = STANCE_INFO[id];
        return `<button data-stance="${id}" aria-pressed="false" title="${s.title}${keys ? ` · ${s.key}` : ""}">${icon(s.icon)}<span>${compact && id === "aggressive" ? "Chase" : s.label}</span>${keys ? `<kbd>${s.key}</kbd>` : ""}</button>`;
      }).join("")}</div>`
    : "";
  return tiles + stance;
}

// The source text is remembered on the node: in Vietnamese the visible text differs from it.
const setText = (node, text) => { if (node && node.dataset.src !== text) { node.dataset.src = text; node.textContent = text; } };

// Ready abilities announce themselves: a tile pulses a few times (CSS `.ready-pulse`, three cycles)
// when its cooldown ends, then keeps a steady glow (`.is-ready`); the rule is shouldPulse in
// tactics-ui.js. When each ability last pulsed, so reselecting the same army does not keep flashing.
const pulsedAt = new Map();

// `aiming` is the id of the ability being aimed (its tile stays lit), or null.
export function updateTacticsCard(root, sim, entities, { compact = false, side = false, blocked = false, aiming = null, now = performance.now() } = {}) {
  const tiles = root.querySelectorAll("[data-ability]");
  if (tiles.length) {
    const groups = abilityGroups(sim, entities, abilityLimit(compact, side));
    for (const tile of tiles) {
      const g = groups.find((group) => group.id === tile.dataset.ability);
      tile.disabled = blocked || !g || !g.ready;
      tile.classList.toggle("cooling", !!g && !g.ready);
      tile.classList.toggle("active", aiming === tile.dataset.ability);
      const ready = !!g && g.ready > 0, state = ready ? "ready" : "cooling";
      if (tile.dataset.readyState !== state) {
        if (shouldPulse(tile.dataset.readyState, ready, now, pulsedAt.get(tile.dataset.ability))) {
          pulsedAt.set(tile.dataset.ability, now);
          tile.classList.add("ready-pulse");
        } else if (!ready) tile.classList.remove("ready-pulse");
        tile.classList.toggle("is-ready", ready);
        tile.dataset.readyState = state;
      }
      if (!g) continue;
      const sweep = g.fraction.toFixed(3);
      if (tile.dataset.cd !== sweep) { tile.dataset.cd = sweep; tile.style.setProperty("--cd", sweep); }
      const narrowGroup = groups.length >= 4 && g?.count > 1 && g.ready > 0;
      setText(tile.querySelector(".ability-status"), narrowGroup ? `${g.ready}/${g.count}` : abilityStatus(g, { compact }));
    }
  }
  const control = root.querySelector(".stance-control");
  if (!control) return;
  const state = stanceState(entities), used = stancesInUse(entities);
  if (control.dataset.state !== state) control.dataset.state = state ?? "";
  const label = state === "mixed" ? "Stance: mixed" : "Stance";
  if (control.getAttribute("aria-label") !== label && control.dataset.label !== label) { control.dataset.label = label; control.setAttribute("aria-label", label); }
  for (const button of control.querySelectorAll("[data-stance]")) {
    const pressed = state === "mixed" ? (used.has(button.dataset.stance) ? "mixed" : "false") : String(state === button.dataset.stance);
    if (button.getAttribute("aria-pressed") !== pressed) button.setAttribute("aria-pressed", pressed);
    button.disabled = blocked;
  }
}
