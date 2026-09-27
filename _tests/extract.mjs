// Writes (or, with --check, compares) one whole-file block from a plan or task brief: the fenced
// code right after the line "<!-- file: <path> -->". Run from the repo root:
//   node _tests/extract.mjs <brief.md> <path>            write the file
//   node _tests/extract.mjs <brief.md> <path> --check    exit 1 if the file differs from the block
// The fence must open on the line right after the marker. The block ends at the first line that is
// exactly three backticks, as in Markdown, so a body can't contain such a line. Exit 2 = no usable block.
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';

const [brief, path, flag] = process.argv.slice(2);
const text = readFileSync(brief, 'utf8').replace(/\r\n/g, '\n') + '\n';
const marker = `<!-- file: ${path} -->\n`;
const at = text.indexOf(marker);
if (at < 0) { console.error(`no block for ${path} in ${brief}`); process.exit(2); }
const fence = at + marker.length;
if (!text.startsWith('```', fence)) { console.error(`no fence right after the marker for ${path} in ${brief}`); process.exit(2); }
const open = text.indexOf('\n', fence) + 1;
const close = text.indexOf('\n```\n', open - 1);
if (close < 0) { console.error(`unclosed block for ${path} in ${brief}`); process.exit(2); }
const body = text.slice(open, close + 1);

if (flag === '--check') {
  const cur = existsSync(path) ? readFileSync(path, 'utf8').replace(/\r\n/g, '\n') : null;
  if (cur !== body) { console.error(`${path} differs from the block in ${brief}`); process.exit(1); }
  console.log(`${path} matches`);
} else {
  mkdirSync(dirname(path) || '.', { recursive: true });
  writeFileSync(path, body);
  console.log(`wrote ${path} (${body.split('\n').length - 1} lines)`);
}
