import config from './hotkeys.json';
import './hotkeys.css';
export const ACTION_KEYS = config.actionKeys;
export const HOTKEYS = config.commands;
// Desktop help: every command is clickable, so no shortcut panel has to cover the battlefield.
export const HOTKEY_HELP = `<h3 class="help-heading">Control groups <small>Click recalls · Ctrl-click saves · Shift-click adds</small></h3><div class="control-group-buttons">${Array.from({length:9},(_,i)=>`<button data-group="${i+1}" title="Group ${i+1}: click to recall, Ctrl-click to save the selection, Shift-click to add it">${i+1}</button>`).join('')}</div><p class="group-help">Ctrl + number saves · Shift + number adds · number recalls · press twice to focus. Saved groups appear as tabs above the selection panel.</p><h3 class="help-heading">Commands <small>Click to run · or press the key</small></h3><div class="shortcut-list">${HOTKEYS.map(k=>`<button data-shortcut="${k.id}" title="${k.label} · ${k.key}"><span>${k.label}</span><kbd>${k.key}</kbd></button>`).join('')}</div><h3 class="help-heading">Mouse</h3><p>Left-click selects; drag selects a group. Ctrl-click or double-click selects the same unit type on screen. Shift adds or removes units. Right-click moves, attacks or assigns a worker job; Shift + right-click queues it. Right-click or Esc cancels pending targeting. The minimap accepts movement, targeting and production rally points. WASD, arrows and screen edges pan the camera.</p><p>Context actions: <b>Q E R T Y</b> activate the matching construction or production tile on the command card (bottom right). <b>B</b> selects a Harvester and opens construction. Select a building with H/J/K before training.</p>`;
export function physicalKey(event) {
  if (/^Key[A-Z]$/.test(event.code)) return event.code.slice(3).toLowerCase();
  if (/^Digit[0-9]$/.test(event.code)) return event.code.slice(5);
  return ({Space:' ',Backquote:'`',Period:'.',Slash:'?',Equal:'+',Minus:'-',NumpadAdd:'+',NumpadSubtract:'-'})[event.code] || event.key.toLowerCase();
}
