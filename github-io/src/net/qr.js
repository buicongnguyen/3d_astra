// W11 LAN play: a small QR code maker for the join address (byte mode, error correction level M,
// versions 1 to 10: up to 213 bytes, far more than "http://192.168.1.20:4570/?join"). It follows the
// QR Code Model 2 standard (ISO/IEC 18004), as Project Nayuki's reference implementation lays it out;
// written here so neither the page nor the host server needs a package. The mask is the one whose dark
// share is closest to half (any of the eight is valid for a reader).
//
//   qrMatrix(text) -> { size, dark(x, y) }      qrToSvg(text) -> an <svg> string      qrToTerminal(text)
const ECC_PER_BLOCK = [-1, 10, 16, 26, 18, 24, 16, 18, 22, 22, 26];
const BLOCKS = [-1, 1, 1, 1, 2, 2, 4, 4, 4, 5, 5];
const FORMAT_M = 0;

function rawModules(ver) {
  let n = (16 * ver + 128) * ver + 64;
  if (ver >= 2) {
    const align = Math.floor(ver / 7) + 2;
    n -= (25 * align - 10) * align - 55;
    if (ver >= 7) n -= 36;
  }
  return n;
}
const dataCodewords = (ver) => Math.floor(rawModules(ver) / 8) - ECC_PER_BLOCK[ver] * BLOCKS[ver];

// GF(256) with the QR polynomial 0x11D.
function mul(x, y) {
  let z = 0;
  for (let i = 7; i >= 0; i--) {
    z = (z << 1) ^ ((z >>> 7) * 0x11d);
    z ^= ((y >>> i) & 1) * x;
  }
  return z & 0xff;
}
function divisor(degree) {
  const result = new Array(degree).fill(0);
  result[degree - 1] = 1;
  let root = 1;
  for (let i = 0; i < degree; i++) {
    for (let j = 0; j < result.length; j++) {
      result[j] = mul(result[j], root);
      if (j + 1 < result.length) result[j] ^= result[j + 1];
    }
    root = mul(root, 0x02);
  }
  return result;
}
function remainder(data, div) {
  const result = div.map(() => 0);
  for (const b of data) {
    const factor = b ^ result.shift();
    result.push(0);
    div.forEach((coef, i) => { result[i] ^= mul(coef, factor); });
  }
  return result;
}

function alignmentPositions(ver, size) {
  if (ver === 1) return [];
  const count = Math.floor(ver / 7) + 2;
  const step = Math.ceil((ver * 4 + 4) / (count * 2 - 2)) * 2;
  const out = [6];
  for (let pos = size - 7; out.length < count; pos -= step) out.splice(1, 0, pos);
  return out;
}

const MASKS = [
  (x, y) => (x + y) % 2 === 0,
  (x, y) => y % 2 === 0,
  (x) => x % 3 === 0,
  (x, y) => (x + y) % 3 === 0,
  (x, y) => (Math.floor(x / 3) + Math.floor(y / 2)) % 2 === 0,
  (x, y) => ((x * y) % 2) + ((x * y) % 3) === 0,
  (x, y) => (((x * y) % 2) + ((x * y) % 3)) % 2 === 0,
  (x, y) => (((x + y) % 2) + ((x * y) % 3)) % 2 === 0,
];

export function qrMatrix(text) {
  const bytes = [...new TextEncoder().encode(String(text))];
  let ver = 1;
  const bitsFor = (v) => 4 + (v < 10 ? 8 : 16) + bytes.length * 8;
  while (ver <= 10 && bitsFor(ver) > dataCodewords(ver) * 8) ver++;
  if (ver > 10) throw new Error("QR: text too long");
  const capacity = dataCodewords(ver) * 8;
  // Data bits: mode (byte), length, the bytes, terminator, padding.
  const bits = [];
  const put = (value, n) => { for (let i = n - 1; i >= 0; i--) bits.push((value >>> i) & 1); };
  put(4, 4);
  put(bytes.length, ver < 10 ? 8 : 16);
  for (const b of bytes) put(b, 8);
  put(0, Math.min(4, capacity - bits.length));
  put(0, (8 - (bits.length % 8)) % 8);
  for (let pad = 0xec; bits.length < capacity; pad ^= 0xec ^ 0x11) put(pad, 8);
  const data = [];
  for (let i = 0; i < bits.length; i += 8) data.push(bits.slice(i, i + 8).reduce((a, b) => (a << 1) | b, 0));
  // Blocks with their error correction, interleaved.
  const blocks = BLOCKS[ver], ecc = ECC_PER_BLOCK[ver], raw = Math.floor(rawModules(ver) / 8);
  const shortBlocks = blocks - (raw % blocks), shortLen = Math.floor(raw / blocks);
  const div = divisor(ecc), list = [];
  for (let i = 0, k = 0; i < blocks; i++) {
    const dat = data.slice(k, k + shortLen - ecc + (i < shortBlocks ? 0 : 1));
    k += dat.length;
    const block = [...dat, ...remainder(dat, div)];
    if (i < shortBlocks) block.splice(shortLen - ecc, 0, 0);
    list.push(block);
  }
  const words = [];
  for (let i = 0; i < list[0].length; i++) list.forEach((block, j) => { if (i !== shortLen - ecc || j >= shortBlocks) words.push(block[i]); });
  // The grid: function patterns first.
  const size = ver * 4 + 17;
  const grid = Array.from({ length: size }, () => new Array(size).fill(false));
  const fixed = Array.from({ length: size }, () => new Array(size).fill(false));
  const set = (x, y, dark) => { grid[y][x] = dark; fixed[y][x] = true; };
  for (let i = 0; i < size; i++) { set(6, i, i % 2 === 0); set(i, 6, i % 2 === 0); }
  const finder = (cx, cy) => {
    for (let dy = -4; dy <= 4; dy++) for (let dx = -4; dx <= 4; dx++) {
      const d = Math.max(Math.abs(dx), Math.abs(dy)), x = cx + dx, y = cy + dy;
      if (x >= 0 && x < size && y >= 0 && y < size) set(x, y, d !== 2 && d !== 4);
    }
  };
  finder(3, 3); finder(size - 4, 3); finder(3, size - 4);
  const align = alignmentPositions(ver, size), last = align.length - 1;
  align.forEach((ax, i) => align.forEach((ay, j) => {
    if ((i === 0 && j === 0) || (i === 0 && j === last) || (i === last && j === 0)) return;
    for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) set(ax + dx, ay + dy, Math.max(Math.abs(dx), Math.abs(dy)) !== 1);
  }));
  const drawFormat = (mask) => {
    const value = (FORMAT_M << 3) | mask;
    let rem = value;
    for (let i = 0; i < 10; i++) rem = (rem << 1) ^ ((rem >>> 9) * 0x537);
    const f = ((value << 10) | rem) ^ 0x5412, bit = (i) => ((f >>> i) & 1) === 1;
    for (let i = 0; i <= 5; i++) set(8, i, bit(i));
    set(8, 7, bit(6)); set(8, 8, bit(7)); set(7, 8, bit(8));
    for (let i = 9; i < 15; i++) set(14 - i, 8, bit(i));
    for (let i = 0; i < 8; i++) set(size - 1 - i, 8, bit(i));
    for (let i = 8; i < 15; i++) set(8, size - 15 + i, bit(i));
    set(8, size - 8, true);
  };
  drawFormat(0);
  if (ver >= 7) {
    let rem = ver;
    for (let i = 0; i < 12; i++) rem = (rem << 1) ^ ((rem >>> 11) * 0x1f25);
    const v = (ver << 12) | rem;
    for (let i = 0; i < 18; i++) {
      const dark = ((v >>> i) & 1) === 1, a = size - 11 + (i % 3), b = Math.floor(i / 3);
      set(a, b, dark); set(b, a, dark);
    }
  }
  // The codewords in the zigzag.
  let i = 0;
  for (let right = size - 1; right >= 1; right -= 2) {
    if (right === 6) right = 5;
    for (let vert = 0; vert < size; vert++) for (let j = 0; j < 2; j++) {
      const x = right - j, up = ((right + 1) & 2) === 0, y = up ? size - 1 - vert : vert;
      if (!fixed[y][x] && i < words.length * 8) { grid[y][x] = ((words[i >>> 3] >>> (7 - (i & 7))) & 1) === 1; i++; }
    }
  }
  // The mask whose dark share is nearest one half.
  let best = 0, bestScore = Infinity;
  for (let m = 0; m < 8; m++) {
    let dark = 0;
    for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) if (grid[y][x] !== (!fixed[y][x] && MASKS[m](x, y))) dark++;
    const score = Math.abs(dark * 2 - size * size);
    if (score < bestScore) { bestScore = score; best = m; }
  }
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) if (!fixed[y][x] && MASKS[best](x, y)) grid[y][x] = !grid[y][x];
  drawFormat(best);
  return { size, version: ver, mask: best, dark: (x, y) => x >= 0 && y >= 0 && x < size && y < size && grid[y][x] };
}

// An <svg> of the code with a 4-module quiet zone (dark on white, as readers expect).
export function qrToSvg(text, { label = "QR code" } = {}) {
  const q = qrMatrix(text), n = q.size + 8;
  let path = "";
  for (let y = 0; y < q.size; y++) for (let x = 0; x < q.size; x++) if (q.dark(x, y)) path += `M${x + 4} ${y + 4}h1v1h-1z`;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${n} ${n}" shape-rendering="crispEdges" role="img" aria-label="${label}"><rect width="${n}" height="${n}" fill="#fff"/><path d="${path}" fill="#000"/></svg>`;
}

// The code for a terminal: two rows of modules per line in half blocks, black on a white background.
export function qrToTerminal(text) {
  const q = qrMatrix(text), lines = [];
  for (let y = -2; y < q.size + 2; y += 2) {
    let line = "\x1b[47m\x1b[30m";
    for (let x = -2; x < q.size + 2; x++) {
      const top = q.dark(x, y), bottom = q.dark(x, y + 1);
      line += top && bottom ? "█" : top ? "▀" : bottom ? "▄" : " ";
    }
    lines.push(line + "\x1b[0m");
  }
  return lines.join("\n");
}
