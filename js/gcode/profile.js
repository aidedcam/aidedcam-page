// Finds the P…Q profile blocks of a canned cycle and replays them in a sandbox from the current
// state. Nothing leaks back into the main context. Spec §5.
import { cloneState, executeBlock } from './machine.js';

export function findBlockByN(blocks, n, from) {
  for (let i = Math.max(0, from); i < blocks.length; i++) if (blocks[i].n === n) return i;
  for (let i = 0; i < Math.min(from, blocks.length); i++) if (blocks[i].n === n) return i;
  return -1;
}

export function readProfile(ctx, p, q) {
  const { blocks } = ctx;
  const pIndex = findBlockByN(blocks, p, ctx.index + 1);
  if (pIndex < 0) return null;
  let qIndex = -1;
  for (let i = pIndex; i < blocks.length; i++) if (blocks[i].n === q) { qIndex = i; break; }
  if (qIndex < 0) return null;

  const child = { ...ctx, state: cloneState(ctx.state), segments: [], events: [], cycles: [],
    toolChanges: [], firstLines: {}, profileMode: true };
  let pCount = 0, pEnd = { ...ctx.state.pos };
  for (let i = pIndex; i <= qIndex; i++) {
    const b = blocks[i];
    if (b.skipped) continue;
    child.index = i;
    executeBlock(child, b);
    if (i === pIndex) { pCount = child.segments.length; pEnd = { ...child.state.pos }; }
  }
  return {
    pIndex, qIndex, pBlock: blocks[pIndex], qBlock: blocks[qIndex],
    first: child.segments.slice(0, pCount),
    body: child.segments.slice(pCount).filter(s => s.kind !== 'dwell'),
    pEnd, endState: child.state, events: child.events,
  };
}
