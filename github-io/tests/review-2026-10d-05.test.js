import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const css = readFileSync(new URL('../src/start-screen.css', import.meta.url), 'utf8');
const block = css.slice(css.indexOf('@media (orientation: landscape) and (max-height: 520px)'));

test('landscape briefing respects left/right safe-area insets', () => {
  assert.match(block, /\.briefing-copy\s*\{[^}]*safe-area-inset-left/);
  assert.match(block, /\.briefing-setup\s*\{[^}]*safe-area-inset-right/);
});
