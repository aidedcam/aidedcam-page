// Runs the IFC floor plans' browser checks in headless Chrome, for when the Playwright MCP is unavailable.
// Needs the repo root served on http://127.0.0.1:8793/ and playwright-core somewhere on this machine:
//   node _tests/ifcplan/browser-check.cjs
// Set PW_CORE to a playwright-core folder, or it is looked for in the npx cache. Chrome is used from its default
// install path (or CHROME). SHOT=<folder> also saves a screenshot at 375 px. BIG=<an .ifc outside the repo> adds the
// large-file timing of the 3D view. Headless Chrome draws WebGL on the GPU; GL=swiftshader draws it in software
// instead (for a machine without a usable GPU).
const fs = require('node:fs'), path = require('node:path'), os = require('node:os');

function findCore() {
  if (process.env.PW_CORE) return process.env.PW_CORE;
  const npx = path.join(os.homedir(), 'AppData', 'Local', 'npm-cache', '_npx');
  for (const d of fs.existsSync(npx) ? fs.readdirSync(npx) : []) {
    const p = path.join(npx, d, 'node_modules', 'playwright-core');
    if (fs.existsSync(p)) return p;
  }
  throw new Error('playwright-core not found: set PW_CORE, or run `npx playwright --version` once');
}

(async () => {
  const { chromium } = require(findCore());
  const chrome = process.env.CHROME || 'C:/Program Files/Google/Chrome/Application/chrome.exe';
  const args = process.env.GL === 'swiftshader' ? ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] : [];
  const browser = await chromium.launch({ executablePath: chrome, headless: true, args });
  const context = await browser.newContext({ acceptDownloads: true });
  const page = await context.newPage();
  const r = await eval(fs.readFileSync(path.join(__dirname, 'browser-check.js'), 'utf8'))(page);
  for (const c of r.checks) console.log(`${c.ok ? 'PASS' : 'FAIL'}  ${c.name}${c.ok ? '' : '  ' + JSON.stringify(c.got)}`);
  console.log(`${r.pass} passed, ${r.fail} failed`);
  await browser.close();
  process.exit(r.fail ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
