import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

test('EXPANSION_STAGES does not tell players to reload for match setup', () => {
  const t = readFileSync(new URL('../docs/EXPANSION_STAGES.md', import.meta.url), 'utf8');
  assert.ok(!/reload the page to return/.test(t));
  assert.match(t, /New game \/ choose map/);
  assert.match(t, /united, see CAMPAIGN_AND_AI\.md/);
});
