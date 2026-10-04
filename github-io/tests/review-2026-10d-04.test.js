import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

test('settings sheet keeps side safe-area insets in the compact layout', () => {
  const css = readFileSync(new URL('../src/settings.css', import.meta.url), 'utf8');
  const i = css.indexOf('@media (max-width: 600px), (max-height: 600px)');
  assert.ok(i >= 0);
  const block = css.slice(i, css.indexOf('@media (max-width: 380px)', i));
  const panel = block.match(/\.settings-panel\s*\{[^}]*\}/)[0];
  assert.match(panel, /padding-left:\s*env\(safe-area-inset-left/);
  assert.match(panel, /padding-right:\s*env\(safe-area-inset-right/);
});
