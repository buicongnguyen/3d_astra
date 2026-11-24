// Splits one long browser suite over several CI jobs without dropping a check.
// A matrix entry in .github/workflows/pages.yml may carry `shard: i/n`; the workflow and
// tests/ci-local.mjs pass it as TEST_SHARD. A suite that supports it runs only its units of work
// whose position p (0-based) has p % n === i - 1, so the n shards together run every unit once.
// With no TEST_SHARD the suite runs everything, as before.
export function parseShard(value = process.env.TEST_SHARD) {
  if (!value) return { index: 1, count: 1 };
  const m = String(value).trim().match(/^(\d+)\/(\d+)$/);
  if (!m || +m[2] < 1 || +m[1] < 1 || +m[1] > +m[2]) throw new Error(`TEST_SHARD must be "i/n" with 1 <= i <= n, got "${value}"`);
  return { index: +m[1], count: +m[2] };
}

const current = parseShard();

// True when unit of work number `position` belongs to this shard.
export function inShard(position, shard = current) {
  return position % shard.count === shard.index - 1;
}

// The items of `list` this shard runs; fails loudly when a shard would run nothing.
export function pickShard(list, shard = current) {
  const picked = list.filter((_, i) => inShard(i, shard));
  if (!picked.length) throw new Error(`shard ${shard.index}/${shard.count} has nothing to run (${list.length} units)`);
  return picked;
}

export const shardLabel = current.count > 1 ? ` [shard ${current.index}/${current.count}]` : "";
