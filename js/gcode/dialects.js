// Controller dialects. Everything downstream speaks Fanuc G-code system A.
// The B/C tables are checked in _docs/gcode-viewer/cycles/gcode-systems.md.
const B = { 77: 90, 78: 92, 79: 94, 94: 98, 95: 99, 92: 50, 98: 'RET', 99: 'RET' };
const C = {
  20: 90, 21: 92, 24: 94, 70: 20, 71: 21,
  72: 70, 73: 71, 74: 72, 75: 73, 76: 74, 77: 75, 78: 76,
  94: 98, 95: 99, 92: 50, 98: 'RET', 99: 'RET',
};

export function mapGCode(g, system) {
  if (system === 'B' || system === 'C') {
    if (g === 90) return 'ABS';
    if (g === 91) return 'INC';
    const table = system === 'B' ? B : C;
    return Object.prototype.hasOwnProperty.call(table, g) ? table[g] : g;
  }
  return g;
}

const has = (block, letter) => block.words.some(w => w.letter === letter);
const hasG = (block, codes) => block.words.some(w => w.letter === 'G' && codes.includes(Math.trunc(w.value)));

// G71/G72/G73 one-line form (older Fanuc 10T/15T, Haas): P, Q and D in the same block.
export function isOneLineRough(block) {
  return hasG(block, [71, 72, 73]) && has(block, 'P') && has(block, 'Q') && has(block, 'D');
}

// 'auto': Haas when any one-line rough block appears; otherwise Fanuc.
export function detectControl(blocks) {
  return blocks.some(b => !b.skipped && isOneLineRough(b)) ? 'haas' : 'fanuc';
}
