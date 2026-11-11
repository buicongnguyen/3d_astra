// Prints a win matrix from a faction-bench --json file: rows beat columns (wins / games).
import fs from 'node:fs';
const rows = JSON.parse(fs.readFileSync(process.argv[2], 'utf8')), ids = [...new Set(rows.flatMap((r) => [r.seat0, r.seat1]))];
console.log(['', ...ids].map((s) => s.padEnd(9)).join(''));
for (const a of ids) console.log([a, ...ids.map((b) => { if (a === b) return '-'; const g = rows.filter((r) => (r.seat0 === a && r.seat1 === b) || (r.seat0 === b && r.seat1 === a)); return `${g.filter((r) => r.winner === a).length}/${g.length}`; })].map((s) => s.padEnd(9)).join(''));
for (const speed of [...new Set(rows.map((r) => r.speed))]) console.log(speed, ids.map((f) => { const g = rows.filter((r) => r.speed === speed && (r.seat0 === f || r.seat1 === f)); return `${f} ${Math.round(100 * g.filter((r) => r.winner === f).length / g.length)}%`; }).join('  '));
const t = rows.map((r) => r.seconds).sort((a, b) => a - b);
console.log('median seconds', t[t.length >> 1], 'longest', t.at(-1), 'undecided', rows.filter((r) => !r.winner).length);
