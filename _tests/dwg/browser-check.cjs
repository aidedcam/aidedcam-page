// Runs the browser checks in headless Chrome, for when the Playwright MCP is unavailable. Needs the repo root
// served on http://127.0.0.1:8765/, and playwright-core somewhere on this machine:
//   node _tests/dwg/browser-check.cjs            the page checks in browser-check.js (plan Task 14)
//   node _tests/dwg/browser-check.cjs parity     only the desktop–browser parity page (plan Task 4)
//   node _tests/dwg/browser-check.cjs perf       the timing page at 10,000 and 50,000 entities (plan Task 4)
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
  const page = await (await browser.newContext({ acceptDownloads: true })).newPage();
  const mode = process.argv[2] || 'page';
  const BASE = 'http://127.0.0.1:8765/_tests/dwg/';
  const fns = {
    page: p => eval(fs.readFileSync(path.join(__dirname, 'browser-check.js'), 'utf8'))(p),   // arrives in Task 14
    async parity(p) {
      await p.goto(BASE + 'parity.html');
      await p.waitForFunction(() => window.__parity, null, { timeout: 120000 });
      const r = await p.evaluate(() => ({ parity: window.__parity, ms: window.__timings }));
      const ok = r.parity.files === 6 && r.parity.failed === 0;
      return { pass: ok ? 1 : 0, fail: ok ? 0 : 1, checks: [{ name: `parity ${JSON.stringify(r)}`, ok, got: r }] };
    },
    async perf(p) {
      const checks = [];
      for (const n of [10000, 50000]) {
        await p.goto(BASE + `perf.html?n=${n}`);
        await p.waitForFunction(() => window.__perf, null, { timeout: 180000 });
        const r = await p.evaluate(() => window.__perf);
        checks.push({ name: `perf ${JSON.stringify(r)}`, ok: !r.error && r.items === n, got: r });
      }
      return { pass: checks.filter(c => c.ok).length, fail: checks.filter(c => !c.ok).length, checks };
    },
  };
  if (!fns[mode]) throw new Error(`unknown mode ${mode}`);
  const r = await fns[mode](page);
  for (const c of r.checks) console.log(`${c.ok ? 'PASS' : 'FAIL'}  ${c.name}${c.ok ? '' : '  ' + JSON.stringify(c.got)}`);
  console.log(`${r.pass} passed, ${r.fail} failed`);
  await browser.close();
  process.exit(r.fail ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
