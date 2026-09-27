import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const css = readFileSync(new URL('../../css/tools.css', import.meta.url), 'utf8');
const PAPER = '#f4f3ee';                                  // --paper in css/editorial.css
const PANEL = '#ffffff';                                  // --panel in css/editorial.css
const NAMES = ['feed', 'rapid', 'pass', 'profile', 'hi'];

function luminance(hex) {
  const c = [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16) / 255)
    .map(v => (v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
}
function ratio(a, b) {
  const [hi, lo] = [luminance(a), luminance(b)].sort((p, q) => q - p);
  return (hi + 0.05) / (lo + 0.05);
}

test('drawing colours are at least 3:1 against both the paper and the panel background', () => {
  for (const name of NAMES) {
    const m = css.match(new RegExp(`--gv-${name}:\\s*(#[0-9a-fA-F]{6})`));
    assert.ok(m, `--gv-${name} must be a 6-digit hex colour`);
    for (const bg of [PAPER, PANEL]) {
      const r = ratio(m[1], bg);
      assert.ok(r >= 3, `--gv-${name} ${m[1]} has contrast ${r.toFixed(2)} against ${bg} (< 3)`);
    }
  }
});

// R5: the finished-profile layer must read lighter than the feed moves, not just pass 3:1 on its
// own — a grey exactly as dark as the green (the previous #6b6a60: 0.1428 vs feed's 0.1435) reads
// as equally heavy even though both hexes individually pass the contrast test above.
test('the finished-profile stroke reads lighter than the feed moves', () => {
  const feed = css.match(/--gv-feed:\s*(#[0-9a-fA-F]{6})/);
  const profile = css.match(/--gv-profile:\s*(#[0-9a-fA-F]{6})/);
  assert.ok(feed && profile, '--gv-feed and --gv-profile must be 6-digit hex colours');
  const feedLum = luminance(feed[1]), profileLum = luminance(profile[1]);
  assert.ok(profileLum > feedLum, `--gv-profile ${profile[1]} (${profileLum.toFixed(4)}) is not lighter than --gv-feed ${feed[1]} (${feedLum.toFixed(4)})`);
});

// An opacity below 1 blends the stroke toward the background and can silently fail the contrast
// check above without the raw hex value ever changing (item 18: this is exactly how the previous
// finished-profile layer failed — 0.35 opacity dropped it to ~1.6:1 while its hex passed on its own).
test('no .gv-<layer> drawing rule sets an opacity below 1', () => {
  for (const name of NAMES) {
    const m = css.match(new RegExp(`\\.gv-${name}\\s*\\{([^}]*)\\}`));
    assert.ok(m, `.gv-${name} rule must exist`);
    const op = m[1].match(/opacity:\s*([0-9.]+)/);
    assert.ok(!op || Number(op[1]) >= 1, `.gv-${name} sets opacity ${op && op[1]} (< 1)`);
  }
});

// Milling viewer (spec §8): the work-offset tints are shades of the feed colour and must pass too.
test('milling work-offset tints are at least 3:1 against both backgrounds', async () => {
  const { offsetTints } = await import('../../js/mill/scene.js');
  const feed = css.match(/--gv-feed:\s*(#[0-9a-fA-F]{6})/)[1];
  for (const tint of offsetTints(feed, 4)) {
    for (const bg of [PAPER, PANEL]) {
      const r = ratio(tint, bg);
      assert.ok(r >= 3, `tint ${tint} has contrast ${r.toFixed(2)} against ${bg} (< 3)`);
    }
  }
});
