// Runs the coverage pre-check's browser checks in headless Chrome, for when the Playwright MCP is unavailable.
// Needs the repo root served on http://127.0.0.1:8765/, and playwright-core somewhere on this machine:
//   node _tests/coverage/browser-check.cjs          the page checks in browser-check.js
//   node _tests/coverage/browser-check.cjs union    only the engine's union parity page (union.html)
// Set PW_CORE to a playwright-core folder, or it is looked for in the npx cache. Chrome is used from its
// default install path (or CHROME).
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
  const browser = await chromium.launch({ executablePath: chrome, headless: true });
  const context = await browser.newContext({ acceptDownloads: true });
  await context.grantPermissions(['clipboard-read', 'clipboard-write'], { origin: 'http://127.0.0.1:8765' });
  const page = await context.newPage();
  const mode = process.argv[2] || 'page';
  const fns = {
    page: p => eval(fs.readFileSync(path.join(__dirname, 'browser-check.js'), 'utf8'))(p),
    async union(p) {
      await p.goto('http://127.0.0.1:8765/_tests/coverage/union.html');
      await p.waitForFunction(() => window.__union, null, { timeout: 120000 });
      const r = await p.evaluate(() => ({ union: window.__union, ms: window.__timings }));
      const ok = r.union.cases === 6 && r.union.failed === 0;
      return { pass: ok ? 1 : 0, fail: ok ? 0 : 1, checks: [{ name: `union ${JSON.stringify(r)}`, ok, got: r }] };
    },
  };
  if (!fns[mode]) throw new Error(`unknown mode ${mode}`);
  const r = await fns[mode](page);
  for (const c of r.checks) console.log(`${c.ok ? 'PASS' : 'FAIL'}  ${c.name}${c.ok ? '' : '  ' + JSON.stringify(c.got)}`);
  console.log(`${r.pass} passed, ${r.fail} failed`);
  await browser.close();
  process.exit(r.fail ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
