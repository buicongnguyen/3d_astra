const paths = {
  theme: '<path d="M12 3a9 9 0 1 0 0 18c1.7 0 2.4-1.1 2-2.3-.5-1.6.5-2.7 2-2.7h2.2c1.6 0 2.8-1.2 2.8-3C21 7 17 3 12 3Z"/><circle cx="7.5" cy="11" r="1"/><circle cx="10.5" cy="7.5" r="1"/><circle cx="15" cy="8" r="1"/>',
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
  // Troop carrier (Frontier Defence, 0.22): a covered truck, cab on the right.
  carrier: '<path d="M2 16V7a1 1 0 0 1 1-1h10v10M13 10h4l4 4v2M2 16h1m6 0h6m5 0h1"/><circle cx="6" cy="17" r="2.2"/><circle cx="17.5" cy="17" r="2.2"/><path d="M5 9h5"/>',
  hq: '<path class="pf" d="M12 1.8l2.3 4.7 5.2.7-3.8 3.6.9 5.1L12 13.5l-4.6 2.4.9-5.1-3.8-3.6 5.2-.7z"/><path d="M3 21.5h18M6 21.5v-3h12v3"/>',
  relay:
    '<path d="M12 3v18M6 21h12M8 7a6 6 0 0 1 8 0M4 3a12 12 0 0 1 16 0"/><circle cx="12" cy="10" r="2"/>',
  barracks: '<path class="pf" d="M4 15.5a8 8 0 0 1 16 0z"/><path d="M2 16h20M7.5 16v3.5a4.5 2 0 0 0 9 0V16M12 7.5v8"/>',
  foundry: '<path class="pf" d="M3 21V10l6 4V9l6 4V3h5v18z"/><path d="M6 17.5h1.5m3 0H12m3 0h1.5"/>',
  tower: '<path class="pf" d="M5 3h3v2h2.5V3h3v2H16V3h3v6.5h-3V21H8V9.5H5z"/><path d="M10.5 14.5h3"/>',
  bolt: '<path d="m14 2-9 12h7l-2 8 9-12h-7Z"/>',
  move: '<path d="M12 5v14M5 12h14"/><path class="pf" d="M12 1.5 15.5 6h-7zM12 22.5 8.5 18h7zM1.5 12 6 8.5v7zM22.5 12 18 15.5v-7z"/>',
  stop: '<rect class="pf" x="5" y="5" width="14" height="14" rx="1.5"/>',
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
  collapse: '<path d="M3 8h5V3m8 0v5h5M8 21v-5H3m18 0h-5v5"/>',
  info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 7.5v.5"/>',
  lock: '<rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/>',
  gear: '<circle cx="12" cy="12" r="3.2"/><path d="M12 2.5v2.6M12 18.9v2.6M4.5 12H2M22 12h-2.5M5.3 5.3l1.8 1.8M16.9 16.9l1.8 1.8M5.3 18.7l1.8-1.8M16.9 7.1l1.8-1.8"/><circle cx="12" cy="12" r="7"/>',
  globe: '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c2.8 3 2.8 15 0 18M12 3c-2.8 3-2.8 15 0 18"/>',
  patrol: '<path d="M4 9h11M20 15H9"/><path class="pf" d="M20 9l-5-4v8zM4 15l5 4v-8z"/>',
  attack: '<path class="pf" d="M21 3l-.6 4.6L10.5 17.5l-4-4L16.4 3.6z"/><path d="M5 12l7 7M3 21l4.5-4.5"/>',
  rapid: '<path d="M3 7h11l3 5-3 5H3M7 7l3 5-3 5M19 8l2 4-2 4"/>',
  barrage: '<circle cx="12" cy="15" r="6"/><path d="M12 2v9m-3-3 3 3 3-3M12 13v4m-2-2h4"/>',
  hold: '<path d="M12 7v14M5 14a7 7 0 0 0 14 0M3 14h4m10 0h4"/><circle class="pf" cx="12" cy="5" r="2.6"/>',
  // HUD contrast pass (2026-11-24): one meaning per symbol on phones. Box select (a dashed box with a pointer, not
  // Fullscreen's corners), Queue (a numbered list, not the Rally flag), Map (a folded map) and Objectives (a checklist).
  box: '<path d="M4 4h3M10 4h3M16 4h2v2M4 7v3M4 13v3M4 18v2h3M18 9v2" stroke-dasharray="0"/><path d="M12 12l8 3.2-3.4 1.2-1.2 3.4z"/>',
  queue: '<path d="M10 6h10M10 12h10M10 18h10"/><path d="M4 5l1.5-1V8M3.5 11.2c.4-.8 2.6-.9 2.6.4 0 1-2.6 1.6-2.6 2.9h2.8M3.6 17c.6-.6 2.5-.5 2.5.6 0 .7-.7.9-1.3.9.8 0 1.5.3 1.5 1.1 0 1.2-2.1 1.3-2.8.5"/>',
  map: '<path d="M3 6.5 9 4l6 2.5L21 4v13.5L15 20l-6-2.5L3 20z"/><path d="M9 4v13.5M15 6.5V20"/>',
  objectives: '<path d="M10 6h10M10 12h10M10 18h10"/><path d="m3.5 6 1.5 1.5L8 4.5M3.5 12l1.5 1.5L8 10.5M3.5 18l1.5 1.5L8 16.5"/>',
  // Phone readability pass (2026-11-24): one meaning per glyph, and bold role glyphs for units, which replace the
  // 22 px 3D portraits on phone train tiles (role-icons.js maps every unit type to one). Role glyphs are filled
  // silhouettes; parts with class "pf" fill on phones only (hud-contrast.css), so desktop keeps its line icons.
  knife: '<path fill="currentColor" d="M21.5 2.5 8.6 10.4l5 5z"/><path d="M6.8 9.6l7.6 7.6" stroke-width="2.6"/><path d="M10.4 13.6 5.2 18.8" stroke-width="3.6"/><circle cx="4.2" cy="19.8" r="2" fill="currentColor"/>',
  rifle: '<path fill="currentColor" d="M1.5 12h14.5v3H9.6L8 19H5.2l1.1-4H1.5z"/><path d="M16 13.5h6.5"/><rect x="5.5" y="7.6" width="8" height="2.6" rx="1.3" fill="currentColor" stroke="none"/><path d="M7.5 10.2V12m4-1.8V12"/>',
  rocket: '<path fill="currentColor" d="M1.5 9h14v5.5h-14z"/><path fill="currentColor" d="M16.8 9h1.8l4 2.75-4 2.75h-1.8z"/><path d="M6 14.5V18.5M10.5 14.5V17M4 9V6.5h3.5"/>',
  cross: '<path fill="currentColor" d="M8.5 2.5h7v6h6v7h-6v6h-7v-6h-6v-7h6z"/>',
  wrench: '<path d="M4.5 19.5 13 11" stroke-width="3.6"/><path fill="currentColor" d="M15.6 2.6a5.4 5.4 0 0 0-5 7.3l3.5 3.5a5.4 5.4 0 0 0 7.3-5L18.5 11l-3-.5-.5-3 2.8-2.9a5.4 5.4 0 0 0-2.2-2z"/>',
  pick: '<path fill="currentColor" d="M2.6 7.4C7.6 1.8 15.6 1 21.6 4.4l-.8 2.6C15.4 4.6 9.4 5.4 5 9.4z"/><path d="M12.6 5.6 6.4 21.2" stroke-width="3.6"/>',
  shell: '<path fill="currentColor" d="M12 1.8c2.6 2 3.7 4.8 3.7 8V13H8.3V9.8c0-3.2 1.1-6 3.7-8z"/><path fill="currentColor" d="M8.3 14.6h7.4V19H8.3z"/><path d="M6.5 21.5h11" stroke-width="2.6"/>',
  tankside: '<path fill="currentColor" d="M6.5 12.5 8 8.5h7l1.5 4z"/><path d="M14 10h8.5" stroke-width="2.2"/><path fill="currentColor" d="M1.5 12.5h21l-1.8 3H3.3z"/><rect x="2.5" y="16.5" width="19" height="5" rx="2.5"/><path d="M7 19h.1M12 19h.1M17 19h.1" stroke-width="2.4"/>',
  mg: '<path fill="currentColor" d="M2 7.5h9.5v5.5H2z"/><path fill="currentColor" d="M12.5 8.6h5.5v3.3h-5.5z"/><path d="M11 10.25h11.5M4 7.5V5.5h4.5M7 13l-4 8.5M7 13l4 8.5M7 13v8.5"/>',
  sniper: '<path fill="currentColor" d="M1.5 14h14.5v2.7H9.6L8 20.6H5.3l1-3.9H1.5z"/><path d="M16 15.35h6.5M8 7.5S10.6 3.5 15 3.5s7 4 7 4-2.6 4-7 4-7-4-7-4z"/><circle cx="15" cy="7.5" r="1.9" fill="currentColor"/>',
  kite: '<path fill="currentColor" d="M15 1.5 21.5 8 15 17.5 8.5 8z"/><path d="M15 17.5c-.5 2-2.5 1.5-3.5 2.8S9 21.5 5 22"/>',
  gunship: '<path d="M2.5 4h17M11 4v3.5"/><path fill="currentColor" d="M3 11.5c0-2.2 1.8-4 4-4h7c2.2 0 3.5 1.6 3.5 3.5V15H6.5C4.6 15 3 13.4 3 11.5z"/><path d="M17 11h5M22 8.5v5M5.5 19h10M8 15v4M13 15v4"/>',
  balloon: '<path fill="currentColor" d="M12 1.5a7.5 7.5 0 0 1 7.5 7.5c0 3.6-3.6 6.3-5.3 8.5H9.8C8.1 15.3 4.5 12.6 4.5 9A7.5 7.5 0 0 1 12 1.5z"/><path d="M9.8 17.5l.6 2.3M14.2 17.5l-.6 2.3"/><rect x="9.3" y="19.6" width="5.4" height="3" rx=".6" fill="currentColor" stroke="none"/>',
  glider: '<path fill="currentColor" d="M12 2.5c1 0 1.4 1.5 1.4 4v2.3l9.1 3.4v1.8l-9.1-1.2-.5 5.6 2.6 1.6v1.5H8.5V20l2.6-1.6-.5-5.6-9.1 1.2v-1.8l9.1-3.4V6.5c0-2.5.4-4 1.4-4z"/>',
  flak: '<path d="M8.5 13.5 17 3.5M11.5 15 20 5" stroke-width="2.4"/><path fill="currentColor" d="M4.5 12h8.5l2 4.2H2.5z"/><path d="M2 21h17M6 16.2V21M12 16.2V21"/>',
  wyrm: '<path d="M2.5 19.5c3 2.5 7 .5 6.5-3.5s2.5-6.5 6-5.5 4.5 3.5 7 1.5" stroke-width="3.2"/><circle cx="19" cy="6" r="3" fill="currentColor"/><path d="M21.5 4.5 23 3"/>',
  // Roster 2026-11-24: Lance buggy (a buggy with a raised harpoon), Bulwark (a tower shield on two legs),
  // Veil moth (wings), Halo interceptor (a ring round a core).
  harpoon: '<path d="M9 10.5 21 3.5" stroke-width="2.2"/><path fill="currentColor" d="M21.8 3 17.6 3.6l1.9 3.2z"/><path fill="currentColor" d="M2 13.5 4.5 10h9l2.5 3.5z"/><circle cx="5.5" cy="17.5" r="3"/><circle cx="16" cy="17.5" r="3"/><path d="M8.5 17.5h4.5"/>',
  ward: '<path fill="currentColor" d="M6 2.5h12v9c0 3.2-2.7 5.5-6 6.5-3.3-1-6-3.3-6-6.5z"/><path d="M9 17v4.5M15 17v4.5M7 21.5h4M13 21.5h4"/>',
  moth: '<path fill="currentColor" d="M11 6.5C8 2.5 2.5 2 1.5 4.5 1 7 4 11 10.5 12 4.5 13 3 17 4.5 19s5.5-1 6.5-5zM13 6.5c3-4 8.5-4.5 9.5-2 .5 2.5-2.5 6.5-9 7.5 6 1 7.5 5 6 7s-5.5-1-6.5-5z"/><path d="M12 5v15M10 2.5 12 5l2-2.5" stroke-width="1.8"/>',
  halo: '<ellipse cx="12" cy="12" rx="10" ry="5" stroke-width="2.2"/><circle cx="12" cy="12" r="3.2" fill="currentColor"/><path d="M12 15.2V21M8.5 21h7"/>',
  // Orders, stances and abilities with one meaning each.
  guard: '<path class="pf" d="M12 2a5 5 0 0 1 5 5c0 3.6-5 8.5-5 8.5S7 10.6 7 7a5 5 0 0 1 5-5z"/><circle cx="12" cy="7" r="1.6"/><ellipse cx="12" cy="18.5" rx="9" ry="3.2"/>',
  chase: '<circle cx="18.5" cy="5.5" r="3.4"/><path d="M3.5 20.5 13.5 10.5"/><path class="pf" d="M8.5 9h7v7z"/>',
  gauge: '<path d="M2.5 18a9.5 9.5 0 0 1 19 0M5.6 11.4l1.2 1M12 8.5v1.6M18.4 11.4l-1.2 1"/><path d="M12 18l4.8-5.6" stroke-width="2.4"/><circle class="pf" cx="12" cy="18" r="2.2"/>',
  star: '<path class="pf" d="M12 2c.9 5.2 2.8 8.1 10 10-7.2 1.9-9.1 4.8-10 10-.9-5.2-2.8-8.1-10-10 7.2-1.9 9.1-4.8 10-10z"/>',
  dash: '<path d="M4 5.5 10.5 12 4 18.5M12 5.5l6.5 6.5-6.5 6.5" stroke-width="2.6"/>',
  lockon: '<circle cx="12" cy="12" r="8.5"/><path class="pf" d="M12 7.5 16.5 12 12 16.5 7.5 12z"/><path d="M12 1v3M12 20v3M1 12h3M20 12h3"/>',
  bullseye: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle class="pf" cx="12" cy="12" r="1.8"/>',
  brace: '<circle class="pf" cx="12" cy="5" r="3"/><path d="M12 8v4M12 12l-6.5 8.5M12 12l6.5 8.5M2 21h20"/>',
  flame: '<path class="pf" d="M12 1.8c.8 4.4 6.5 6.6 6.5 12.6a6.5 6.5 0 0 1-13 0c0-3 1.8-5.3 3.2-6.5.1 2.2 1 3.4 2.2 3.6-.5-4 0-6.9 1.1-9.7z"/>',
  rally: '<circle class="pf" cx="12" cy="12" r="3.2"/><path d="M2.5 6l5 6-5 6M21.5 6l-5 6 5 6" stroke-width="2.4"/>',
  levelup: '<path d="M5 13l7-7 7 7M5 20l7-7 7 7" stroke-width="2.6"/>',
  dmgup: '<path class="pf" d="M7.5 2.5c2.2 1.6 3.2 3.7 3.2 6.5v12H4.3V9c0-2.8 1-4.9 3.2-6.5z"/><path d="M17.5 21V7.5M13.5 11.5l4-4 4 4"/>',
  armor: '<path class="pf" d="M2.5 5h9v4h-9zM2.5 11h9v4h-9z"/><path d="M2.5 18.5h9M17.5 21V7.5M13.5 11.5l4-4 4 4"/>',
  research: '<path d="M8.5 2.5h7M10 2.5v6.5l-5.2 9.3A2 2 0 0 0 6.6 21h10.8a2 2 0 0 0 1.8-2.7L14 9V2.5"/><path class="pf" d="M7.4 14h9.2l2 3.8a1.6 1.6 0 0 1-1.4 2.3H6.8a1.6 1.6 0 0 1-1.4-2.3z"/>',
  // Eye with a slash: hidden from below (selection card, tactics-view mark).
  hidden: '<path d="M2.5 12s3.5-6 9.5-6 9.5 6 9.5 6-3.5 6-9.5 6-9.5-6-9.5-6z"/><circle cx="12" cy="12" r="2.6"/><path d="M4 20 20 4"/>',
  // Faction signature abilities (2026-11-24): the wagon's Spur on (a horseshoe), the drone's Shield link
  // (two linked shields) and the Shade's Shadow strike (three claw slashes).
  horseshoe: '<path d="M6.5 20.5V11a5.5 5.5 0 0 1 11 0v9.5" stroke-width="3.2"/><path d="M4.5 20.5h4M15.5 20.5h4"/><circle class="pf" cx="8.4" cy="12" r="0.7"/><circle class="pf" cx="15.6" cy="12" r="0.7"/>',
  linkshield: '<path class="pf" d="M8 3.5l5 1.8v4.2c0 3.2-2 5.4-5 6.8-3-1.4-5-3.6-5-6.8V5.3z"/><path d="M16 8l5 1.8V14c0 3.2-2 5.4-5 6.8-3-1.4-5-3.6-5-6.8"/><path d="M11 12.5h6" stroke-width="2"/>',
  claw: '<path d="M5 20.5C8.5 15 11.5 9 13 3.5M10 21c3.2-5 5.8-10 7-15.5M15 21.2c2.4-3.8 4.2-7.6 5-11.7" stroke-width="2.3"/>',
  // Doctrines (2026-11-24): Energy grid (a battery), Reserves (an arrow coming back), Field rations (a
  // marching boot), Drill (rank chevrons), Tuned engines (a piston) and Repair crews (a spanner and a plus).
  battery: '<rect x="3" y="7" width="16" height="10" rx="1.6"/><path d="M21 10.5v3" stroke-width="2.4"/><path class="pf" d="M5.5 9.5h4v5h-4zM10.5 9.5h4v5h-4z"/>',
  refund: '<path d="M4 12a8 8 0 1 0 2.6-5.9"/><path d="M3.5 3.5v4.5H8"/><path class="pf" d="M12 7.5l3.2 4.5L12 16.5 8.8 12z"/>',
  boot: '<path class="pf" d="M7 3h5v8.5l6.8 2.6c1.3.5 2.2 1.7 2.2 3.1V19H3.5v-4.5L7 12z"/><path d="M3.5 21.5h17.5"/>',
  chevrons: '<path d="M5 10l7-5 7 5M5 15l7-5 7 5M5 20l7-5 7 5" stroke-width="2.3"/>',
  engine: '<rect x="7" y="2.5" width="10" height="9" rx="1.2"/><path d="M12 11.5V16"/><circle cx="12" cy="18.5" r="3"/><path d="M4 7h3M17 7h3M9.5 5.5v3M14.5 5.5v3"/>',
  crew: '<path d="M14.5 3.5a4.5 4.5 0 0 0-4.3 5.8L3.5 16a2.1 2.1 0 0 0 3 3l6.7-6.7a4.5 4.5 0 0 0 5.8-4.3l-2.6 2.6-2.8-.6-.6-2.8z"/><path d="M18.5 15v6M15.5 18h6" stroke-width="2.2"/>',
};
export function icon(name, cls = "") {
  return `<svg class="icon ${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths[name] || paths.logo}</svg>`;
}
