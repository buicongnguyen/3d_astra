import config from './hotkeys.json';
import './hotkeys.css';
export const ACTION_KEYS = config.actionKeys;
export const HOTKEYS = config.commands;
export const HOTKEY_HELP = `<p>Context actions: <b>Q E R T Y</b> activate the matching construction or production tile. <b>B</b> selects a Harvester and opens construction. Select a building with H/J/K before training.</p><div class="controls-grid">${HOTKEYS.map(k=>`<span>${k.label}</span><kbd>${k.key}</kbd>`).join('')}<span>Assign / add to / recall group</span><kbd>Ctrl+1–9 / Shift+1–9 / 1–9</kbd><span>Focus recalled group</span><kbd>Press its number twice</kbd><span>Queue next order</span><kbd>Shift + click target</kbd><span>Camera pan / cancel mode</span><kbd>WASD, arrows / Esc</kbd></div>`;
export function physicalKey(event) {
  if (/^Key[A-Z]$/.test(event.code)) return event.code.slice(3).toLowerCase();
  if (/^Digit[0-9]$/.test(event.code)) return event.code.slice(5);
  return ({Space:' ',Backquote:'`',Period:'.',Slash:'?',Equal:'+',Minus:'-',NumpadAdd:'+',NumpadSubtract:'-'})[event.code] || event.key.toLowerCase();
}
