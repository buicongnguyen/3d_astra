const paths = {
  medic: '<path d="M9 3h6v6h6v6h-6v6H9v-6H3V9h6z"/>',
  engineer: '<path d="M14 4a6 6 0 0 0-7 8L2 17a3 3 0 0 0 5 5l5-5a6 6 0 0 0 8-7l-4 4-4-4z"/>',
  logo: '<path d="M12 2 22 20H2Z"/><path d="m12 9 5 9H7Z"/>',
  alloy:
    '<path d="m12 2 7 6-2 11-7 3-6-8 2-8Z"/><path d="m6 6 6 5 7-3M12 11l-2 11M12 11l5 8"/>',
  energy: '<path d="m14 2-9 12h7l-2 8 9-12h-7Z"/>',
  people:
    '<circle cx="9" cy="7" r="3"/><path d="M3 21v-4a6 6 0 0 1 12 0v4M16 4a3 3 0 0 1 0 6M18 14a5 5 0 0 1 3 4v3"/>',
  worker:
    '<path d="m5 3 4 4-2 2-4-4a5 5 0 0 0 6 6l8 9 3-3-9-8a5 5 0 0 0-6-6Z"/>',
  shield:
    '<path d="m12 2 8 4v6c0 5-8 10-8 10S4 17 4 12V6Z"/><path d="m8 11 3 3 5-6"/>',
  crosshair:
    '<circle cx="12" cy="12" r="7"/><path d="M12 1v6m0 10v6M1 12h6m10 0h6"/><circle cx="12" cy="12" r="1"/>',
  tank: '<rect x="3" y="13" width="18" height="7" rx="3"/><path d="M7 13V8h8v5M15 9h7M7 17h1m3 0h1m3 0h1"/>',
  hq: '<path d="M3 21V8l9-5 9 5v13H3ZM8 21v-7h8v7M12 3V1M6 8h12"/>',
  relay:
    '<path d="M12 3v18M6 21h12M8 7a6 6 0 0 1 8 0M4 3a12 12 0 0 1 16 0"/><circle cx="12" cy="10" r="2"/>',
  barracks: '<path d="M3 21V9l9-6 9 6v12H3ZM7 21V11h10v10M7 15h10M7 18h10"/>',
  foundry: '<path d="M3 21V10l6 4V8l6 4V3h5v18H3ZM6 17h1m4 0h1m4 0h1"/>',
  tower: '<path d="M8 21V10h8v11M5 3v7h14V3M5 6h14M9 3v3m6-3v3M10 14h4"/>',
  bolt: '<path d="m14 2-9 12h7l-2 8 9-12h-7Z"/>',
  move: '<path d="M12 2v20M2 12h20M8 6l4-4 4 4M8 18l4 4 4-4M6 8l-4 4 4 4m12-8 4 4-4 4"/>',
  stop: '<rect x="5" y="5" width="14" height="14" rx="1"/>',
  pause: '<path d="M8 4v16M16 4v16"/>',
  play: '<path d="m7 3 14 9-14 9Z"/>',
  help: '<circle cx="12" cy="12" r="10"/><path d="M9 8a3 3 0 1 1 4 3c-1 1-1 1-1 3m0 3v1"/>',
  volume:
    '<path d="M3 9h4l5-4v14l-5-4H3ZM16 8a6 6 0 0 1 0 8m3-11a10 10 0 0 1 0 14"/>',
  muted: '<path d="M3 9h4l5-4v14l-5-4H3ZM16 9l6 6m0-6-6 6"/>',
  arrow: '<path d="M4 12h16m-6-6 6 6-6 6"/>',
  close: '<path d="m5 5 14 14M5 19 19 5"/>',
  flag: '<path d="M5 22V3h14l-3 5 3 5H5"/>',
  check: '<path d="m5 12 4 4L19 6"/>',
  expand: '<path d="M8 3H3v5m13-5h5v5M3 16v5h5m8 0h5v-5"/>',
};
export function icon(name, cls = "") {
  return `<svg class="icon ${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths[name] || paths.logo}</svg>`;
}
