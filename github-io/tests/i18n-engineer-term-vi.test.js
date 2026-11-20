import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const vi = JSON.parse(readFileSync(new URL('../src/locales/vi.json', import.meta.url), 'utf8'));

test('Engineer uses one Vietnamese term (Cong binh)', () => {
  const m = vi.messages;
  assert.equal(m['Engineer'], 'Công binh');
  for (const [k, v] of Object.entries(m)) {
    assert.ok(!v.includes('Kỹ sư'), `"${k}" still uses Kỹ sư`);
  }
});
