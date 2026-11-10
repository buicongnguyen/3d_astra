// Story character portraits. There is no painted art yet, so each bust is an inline SVG drawn
// from the CAST and FACTIONS data: faction colour, and a silhouette, hair and headgear chosen
// by character id. Shapes are bold and flat so they stay crisp from 48 px to 160 px.
// Dropping a file at public/portraits/<id>.webp replaces the drawing for that character at the
// next build, with no code change.
import { CAST, FACTIONS } from "./story/world.js";

let ART = {};
try {
  ART = import.meta.glob("../public/portraits/*.webp", { eager: true, query: "?url", import: "default" });
} catch { /* Outside the bundler (unit tests) there is no painted art. */ }
const art = (id) => ART[`../public/portraits/${id}.webp`] || null;

const INK = "#071319";
const esc = (text) => String(text).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);

// Shared parts. The picture is 96 x 96.
const field = (hex) => `<rect width="96" height="96" fill="#0c2029"/><circle cx="48" cy="42" r="40" fill="${hex}" opacity=".26"/><circle cx="48" cy="40" r="27" fill="${hex}" opacity=".22"/><path d="M0 78 Q48 62 96 78 V96 H0Z" fill="${hex}" opacity=".16"/>`;
const shoulders = (coat) => `<path d="M8 97 C8 76 26 67 48 67 C70 67 88 76 88 97Z" fill="${coat}" stroke="${INK}" stroke-width="2"/>`;
const neck = (skin) => `<path d="M41 54 H55 V70 Q48 76 41 70Z" fill="${skin}" stroke="${INK}" stroke-width="2"/><path d="M41 60 Q48 65 55 60 V56 H41Z" fill="${INK}" opacity=".22"/>`;
const head = (skin) => `<ellipse cx="48" cy="40" rx="15" ry="18" fill="${skin}" stroke="${INK}" stroke-width="2"/>`;
const eyes = (y = 41) => `<ellipse cx="42" cy="${y}" rx="2" ry="2.4" fill="${INK}"/><ellipse cx="54" cy="${y}" rx="2" ry="2.4" fill="${INK}"/>`;
const mouth = (d) => `<path d="${d}" fill="none" stroke="${INK}" stroke-width="2" stroke-linecap="round"/>`;

const DRAW = {
  // No face: the ring-and-line emblem with one bright light above it.
  commander: (hex) => `${field(hex)}<path d="M20 97 V60 L48 46 L76 60 V97Z" fill="#12313c" stroke="${INK}" stroke-width="2"/>
    <circle cx="48" cy="66" r="15" fill="none" stroke="${hex}" stroke-width="5"/><path d="M48 40 V92" stroke="${hex}" stroke-width="5" stroke-linecap="round"/>
    <circle cx="48" cy="22" r="11" fill="#fff6c9" opacity=".3"/><circle cx="48" cy="22" r="5.5" fill="#fff6c9" stroke="${INK}" stroke-width="1.5"/>`,
  // Silver-streaked hair tied back, teal field coat with a mint collar, headset on one ear.
  vale: (hex) => `${field(hex)}<circle cx="65" cy="27" r="7" fill="#25232b" stroke="${INK}" stroke-width="2"/>
    ${shoulders("#1c6a70")}<path d="M34 70 L48 86 L62 70 L56 66 L48 76 L40 66Z" fill="${hex}" stroke="${INK}" stroke-width="2" stroke-linejoin="round"/>
    <circle cx="67" cy="82" r="3.5" fill="none" stroke="${hex}" stroke-width="2"/><path d="M67 77 V87" stroke="${hex}" stroke-width="2"/>
    ${neck("#7a4c31")}${head("#8f5c3c")}
    <path d="M32 42 C29 20 67 20 64 42 C61 31 55 28 48 28 C41 28 35 31 32 42Z" fill="#25232b" stroke="${INK}" stroke-width="2" stroke-linejoin="round"/>
    <path d="M40 24 C46 22 52 23 56 26" fill="none" stroke="#d5dde0" stroke-width="3" stroke-linecap="round"/>
    ${eyes()}${mouth("M43 50 Q49 53 54 49")}
    <rect x="28" y="36" width="7" height="11" rx="3" fill="${hex}" stroke="${INK}" stroke-width="2"/><path d="M31 47 Q32 56 42 55" fill="none" stroke="${hex}" stroke-width="2.5" stroke-linecap="round"/>`,
  // Short curly hair, goggles pushed up, mint vest over a cream shirt, wide grin.
  okoro: (hex) => `${field(hex)}${shoulders(hex)}<path d="M38 67 L48 92 L58 67Z" fill="#f6ead0" stroke="${INK}" stroke-width="2" stroke-linejoin="round"/>
    <path d="M70 70 q9 3 8 14" fill="none" stroke="#edc76f" stroke-width="4" stroke-linecap="round"/>
    ${neck("#96603a")}${head("#b0733f")}
    <g fill="#1c1410" stroke="${INK}" stroke-width="2"><circle cx="35" cy="29" r="6.5"/><circle cx="42" cy="23" r="6.5"/><circle cx="50" cy="21" r="6.5"/><circle cx="57" cy="24" r="6.5"/><circle cx="62" cy="30" r="6"/></g>
    <rect x="32" y="27" width="32" height="6" rx="3" fill="#3b2a1c" stroke="${INK}" stroke-width="1.5"/>
    <circle cx="41" cy="30" r="5.5" fill="#7fd6ee" stroke="#edc76f" stroke-width="2.5"/><circle cx="55" cy="30" r="5.5" fill="#7fd6ee" stroke="#edc76f" stroke-width="2.5"/>
    <path d="M38 37 l7 -1 M51 36 l7 1" stroke="${INK}" stroke-width="2" stroke-linecap="round"/>${eyes(42)}
    <path d="M41 48 Q48 57 55 48Z" fill="#fff" stroke="${INK}" stroke-width="2" stroke-linejoin="round"/>`,
  // Close grey beard, charcoal greatcoat with coral piping and a high collar.
  hale: (hex) => `${field(hex)}${shoulders("#2b3138")}<path d="M30 70 L48 97 M66 70 L48 97" stroke="${hex}" stroke-width="3"/>
    <path d="M33 62 L41 58 L44 72 L34 76Z M63 62 L55 58 L52 72 L62 76Z" fill="#3a424b" stroke="${INK}" stroke-width="2" stroke-linejoin="round"/>
    <circle cx="70" cy="84" r="4" fill="${hex}" stroke="${INK}" stroke-width="1.5"/>
    ${neck("#cfae95")}${head("#ecd0b8")}
    <path d="M33 40 C33 62 63 62 63 40 C61 49 56 51 48 51 C40 51 35 49 33 40Z" fill="#8d979c" stroke="${INK}" stroke-width="2" stroke-linejoin="round"/>
    <path d="M32 38 C30 19 66 19 64 38 C60 29 54 27 48 27 C42 27 36 29 32 38Z" fill="#a9b2b6" stroke="${INK}" stroke-width="2" stroke-linejoin="round"/>
    <path d="M38 37 l8 2 M58 37 l-8 2" stroke="${INK}" stroke-width="2.4" stroke-linecap="round"/>${eyes(42)}${mouth("M44 52 H52")}`,
  // Black braid over one shoulder, gold long coat, wide scarf, half-sun brooch.
  sol: (hex) => `${field(hex)}${shoulders("#c8892c")}
    ${neck("#b9834f")}<path d="M27 68 Q48 80 69 68 L71 78 Q48 91 25 78Z" fill="#f3b33f" stroke="${INK}" stroke-width="2" stroke-linejoin="round"/>
    <path d="M36 88 a7 7 0 0 1 14 0Z" fill="#fff0b0" stroke="${INK}" stroke-width="1.5"/>
    ${head("#d6a06c")}
    <path d="M32 43 C28 19 68 19 64 43 C62 33 57 27 48 29 C41 27 34 33 32 43Z" fill="#16141b" stroke="${INK}" stroke-width="2" stroke-linejoin="round"/>
    <g fill="#16141b" stroke="${INK}" stroke-width="2"><ellipse cx="65" cy="50" rx="5" ry="6"/><ellipse cx="67" cy="60" rx="5" ry="6"/><ellipse cx="68" cy="70" rx="4.6" ry="6"/><ellipse cx="68" cy="80" rx="4" ry="5.5"/></g>
    <path d="M38 37 l7 0 M51 35 l7 -1" stroke="${INK}" stroke-width="2" stroke-linecap="round"/>${eyes()}${mouth("M42 49 Q48 54 55 48")}`,
  // Violet hood with silver thread, short white hair, round glasses, pendant.
  maren: (hex) => `${field(hex)}<path d="M22 74 C16 22 80 22 74 74Z" fill="#5a3fa6" stroke="${INK}" stroke-width="2"/>
    ${shoulders("#6d51bd")}<path d="M48 70 V84" stroke="#d9dde6" stroke-width="2"/><circle cx="48" cy="87" r="4.5" fill="#1b1830" stroke="#d9dde6" stroke-width="2"/>
    ${neck("#b78a66")}<path d="M29 60 C24 30 72 30 67 60 C66 40 58 34 48 34 C38 34 30 40 29 60Z" fill="#3f2b7c" stroke="${INK}" stroke-width="2" stroke-linejoin="round"/>
    ${head("#cfa17c")}
    <path d="M34 34 C36 24 60 24 62 34 C56 29 40 29 34 34Z" fill="#f2f4f5" stroke="${INK}" stroke-width="2" stroke-linejoin="round"/>
    <path d="M38 35 l7 -2 M58 35 l-7 -2" stroke="${INK}" stroke-width="1.8" stroke-linecap="round"/>${eyes(42)}
    <circle cx="42" cy="42" r="5.5" fill="#fff" fill-opacity=".18" stroke="#e3e7ee" stroke-width="2"/><circle cx="54" cy="42" r="5.5" fill="#fff" fill-opacity=".18" stroke="#e3e7ee" stroke-width="2"/><path d="M47.5 42 h1" stroke="#e3e7ee" stroke-width="2"/>
    ${mouth("M44 52 Q48 50 52 52")}
    <path d="M24 62 C22 34 34 26 48 25" fill="none" stroke="#d9dde6" stroke-width="1.5" stroke-dasharray="3 3"/>`,
  // No human face: twelve soft lights around a pale lens over a dark relay stone.
  echo: (hex) => {
    let lights = "";
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2 - Math.PI / 2, bright = i === 11 || i === 1 || i === 6;
      const x = (48 + Math.cos(a) * 27).toFixed(1), y = (42 + Math.sin(a) * 27).toFixed(1);
      lights += bright ? `<circle cx="${x}" cy="${y}" r="7" fill="#dff0ff" opacity=".3"/><circle cx="${x}" cy="${y}" r="4.2" fill="#f2f9ff"/>` : `<circle cx="${x}" cy="${y}" r="3.2" fill="${hex}"/>`;
    }
    return `${field(hex)}<path d="M26 97 L32 78 H64 L70 97Z" fill="#101c2c" stroke="${INK}" stroke-width="2"/><path d="M36 84 H60" stroke="${hex}" stroke-width="2" opacity=".7"/>
      <circle cx="48" cy="42" r="27" fill="none" stroke="${hex}" stroke-width="1.5" opacity=".5"/>${lights}
      <circle cx="48" cy="42" r="13" fill="#cfe4ff" stroke="${INK}" stroke-width="2"/><circle cx="48" cy="42" r="7" fill="${hex}"/><circle cx="44.5" cy="38.5" r="3" fill="#fff"/>`;
  },
};

// Anyone without a drawing gets their initials on the faction colour.
function initials(c, hex) {
  const letters = (c?.name || "?").split(/\s+/).map((w) => w[0]).join("").slice(0, 2).toUpperCase();
  return `${field(hex)}<circle cx="48" cy="48" r="30" fill="${hex}" stroke="${INK}" stroke-width="2"/><text x="48" y="59" text-anchor="middle" font-family="Arial, sans-serif" font-weight="800" font-size="30" fill="${INK}">${esc(letters)}</text>`;
}

export const hasCast = (who) => Object.hasOwn(CAST, who);
export const castName = (who) => CAST[who]?.name || "Command";
export const castRole = (who) => CAST[who]?.role || "";
export const factionHex = (who) => FACTIONS[CAST[who]?.faction]?.hex || "#92ebc5";

// The portrait as an HTML string: a square frame in the faction colour sized by the CSS
// variable --size (see .cast-portrait in mission-ui.css).
export function castPortrait(who, extra = "") {
  const c = CAST[who], hex = factionHex(who), image = c ? art(c.id) : null;
  const inner = image
    ? `<img src="${esc(image)}" alt="" decoding="async">`
    : `<svg viewBox="0 0 96 96" aria-hidden="true" focusable="false">${(DRAW[c?.id] || ((h) => initials(c, h)))(hex)}</svg>`;
  return `<span class="cast-portrait${extra ? ` ${esc(extra)}` : ""}" data-who="${esc(c?.id || "unknown")}" style="--faction:${hex}" translate="no" aria-hidden="true">${inner}</span>`;
}
