# web-ifc 0.0.78 (vendored)

The IFC reader of the IFC floor-plans tool (`ifc-plans.html`). Pinned: it is a 0.0.x library whose API changes between
versions, so it is never updated in place without re-running every test of the tool.

- Package: `web-ifc` 0.0.78 on npm (https://www.npmjs.com/package/web-ifc/v/0.0.78), by ThatOpen Company.
- Upstream source: https://github.com/ThatOpen/engine_web-ifc
- Licence: Mozilla Public License 2.0, in `LICENSE` (the package's `LICENSE.md`, unchanged).
- Files taken unchanged from the package: `web-ifc-api.js` (the browser ES-module build) and `web-ifc.wasm` (the
  single-threaded engine). The multi-threaded `web-ifc-mt.wasm` is left out: the tool forces single-threaded mode, so a
  static host needs no cross-origin isolation headers.
- SHA-256:
  - `web-ifc-api.js` 1edb1dd8e8dba63757932f62001f1b2ee812d86594b6ffc5e1e8beebe1f16690
  - `web-ifc.wasm` 1fbd30bd5515ff6ad15268e87aa26e41d57b29411c8461618b63bee92735d349

To reproduce: `npm pack web-ifc@0.0.78`, unpack the tarball, and copy `package/web-ifc-api.js`, `package/web-ifc.wasm`
and `package/LICENSE.md` (as `LICENSE`). `_tests/ifcplan/vendor.test.js` checks the hashes.
