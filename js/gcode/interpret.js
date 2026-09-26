// Main interpretation loop: blocks → segments, events, cycle records, tool list. Pure.
import { newContext, executeBlock, pushEvent } from './machine.js';
import { runCycle } from './cycles/index.js';
import { detectControl } from './dialects.js';
import { withDefaults } from './settings.js';

export function interpret(blocks, settingsIn) {
  const settings = withDefaults(settingsIn);
  const ctx = newContext(blocks, settings);
  ctx.control = settings.control === 'auto' ? detectControl(blocks) : settings.control;
  let units = 'mm';
  for (ctx.index = 0; ctx.index < blocks.length; ctx.index++) {
    if (ctx.state.ended) break;
    const b = blocks[ctx.index];
    if (b.skipped) {
      if (b.skipped !== 'blank') { ctx.block = b; pushEvent(ctx, 'skipped', { reason: b.skipped }); }
      continue;
    }
    const { cycle } = executeBlock(ctx, b);
    if (ctx.state.units === 'inch') units = 'inch';
    if (cycle !== null) runCycle(ctx, cycle, b);
  }
  return {
    segments: ctx.segments, events: ctx.events, cycles: ctx.cycles, toolChanges: ctx.toolChanges,
    tools: labelTools(blocks, ctx.toolChanges), control: ctx.control, units,
  };
}

const clean = c => c.replace(/^[\s\-=*_]+|[\s\-=*_]+$/g, '').trim();

// Where a label search stops: another T call, or the O-number / % line (a program name is no label).
const ends = b => b.o !== null || /^\s*%/.test(b.raw) || b.words.some(w => w.letter === 'T');

// A tool's label (spec §2): the comment on its first T line; otherwise the last comment before it
// (within 8 lines, e.g. a section banner); otherwise the first comment after it (within 4 lines).
// Neither search crosses another T call or the O/% line. Tools are listed once, in order of first use.
export function labelTools(blocks, changes) {
  const seen = new Map();
  for (const c of changes) {
    if (seen.has(c.tool)) continue;
    const own = blocks[c.index] && blocks[c.index].comment;
    let label = own ? clean(own) : '';
    for (let i = c.index - 1; i >= Math.max(0, c.index - 8) && !label && !ends(blocks[i]); i--) {
      if (blocks[i].comment) label = clean(blocks[i].comment);
    }
    for (let i = c.index + 1; i <= Math.min(blocks.length - 1, c.index + 4) && !label && !ends(blocks[i]); i++) {
      if (blocks[i].comment) label = clean(blocks[i].comment);
    }
    seen.set(c.tool, { tool: c.tool, label, firstLine: c.line });
  }
  return [...seen.values()];
}
