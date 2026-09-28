import { test } from 'node:test';
import assert from 'node:assert/strict';
import { visibleColor } from '../../js/dwg/view.js';

test('layer colours keep their hue but never vanish into the background', () => {
  assert.equal(visibleColor('#ff0000', '#ffffff', '#1a1a1a'), '#ff0000');            // red on white: kept
  assert.equal(visibleColor('#ffffff', '#ffffff', '#1a1a1a'), '#1a1a1a');            // white (ACI 7) on white: the ink
  assert.equal(visibleColor('#000000', '#1a1a1a', '#f0f0f0'), '#f0f0f0');            // black on a dark canvas: the ink
  const yellow = visibleColor('#ffff00', '#ffffff', '#1a1a1a');                      // yellow on white: darkened, still yellowish
  assert.notEqual(yellow, '#ffff00');
  const [r, g, b] = [1, 3, 5].map(i => parseInt(yellow.slice(i, i + 2), 16));
  assert.ok(r > b && g > b, yellow);
});
