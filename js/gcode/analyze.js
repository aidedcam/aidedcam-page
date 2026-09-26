// The whole pipeline: text → Result. Pure; used by ui.js and by the tests.
import { parseProgram } from './parse.js';
import { interpret } from './interpret.js';
import { computeTimes } from './time.js';
import { runChecks } from './checks.js';
import { withDefaults } from './settings.js';

export const MAX_LINES = 300000;

export function analyze(text, settingsIn) {
  const settings = withDefaults(settingsIn);
  const blocks = parseProgram(text);
  if (blocks.length > MAX_LINES) {
    return { tooLarge: true, lines: blocks.length, blocks: [], segments: [], events: [], cycles: [],
      toolChanges: [], tools: [], control: settings.control, units: 'mm',
      timing: { rows: [], total: 0, incomplete: false }, warnings: [], settings };
  }
  const run = interpret(blocks, settings);
  const timing = computeTimes(run, settings);
  const warnings = runChecks(run);
  return { tooLarge: false, lines: blocks.length, blocks, ...run, timing, warnings, settings };
}
