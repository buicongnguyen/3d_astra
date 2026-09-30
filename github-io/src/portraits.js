import "./portraits.css";

// Cell order of src/art/portraits.webp and portrait-mask.webp (tools/blender/render_ui_art.py).
export const PORTRAIT_ORDER = ["worker", "vanguard", "ranger", "breaker", "medic", "engineer", "tank", "antitank",
  "hq", "relay", "barracks", "foundry", "tower"];

// A rendered Blender portrait. Team paint is white in the atlas; the mask layer tints it with
// the side's army colour (friendly by default), so portraits follow the player's palette.
export function portrait(type, side = "friendly", extra = "") {
  const index = PORTRAIT_ORDER.indexOf(type);
  if (index < 0) return "";
  const column = index % 4, row = Math.floor(index / 4);
  return `<i class="portrait-art ${side === "hostile" ? "hostile" : "friendly"}${extra ? ` ${extra}` : ""}" style="--px:${column};--py:${row}" aria-hidden="true"><i></i></i>`;
}
export const hasPortrait = (type) => PORTRAIT_ORDER.includes(type);
