// Real desktop decoders + a narrowly simulated pre-17.2 WebKit option enum.
// Sources: https://webkit.org/blog/14787/webkit-features-in-safari-17-2/#image-orientation
// https://github.com/WebKit/WebKit/commit/556e20c0b0053bc5c7f6d1a5635ad2467c6bade8
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const ts = require('typescript');
const sharp = require('/Users/crystalchang/Desktop/Fable Suite/nightingale/node_modules/sharp');
const { chromium, webkit } = require(process.env.PLAYWRIGHT_MODULE);
const compiled = ts.transpileModule(fs.readFileSync(path.join(__dirname, '../src/remote/photo.ts'), 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
}).outputText;
const colors = [[240, 20, 20], [20, 220, 20], [20, 20, 240], [230, 210, 20]];
async function fixture(width, height, orientation) {
  const raw = Buffer.alloc(width * height * 3);
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    const color = colors[(y >= height / 2 ? 2 : 0) + (x >= width / 2 ? 1 : 0)];
    const i = (y * width + x) * 3; raw[i] = color[0]; raw[i + 1] = color[1]; raw[i + 2] = color[2];
  }
  return { width, height, orientation, data: (await sharp(raw, { raw: { width, height, channels: 3 } })
    .jpeg({ quality: 95 }).withMetadata({ orientation }).toBuffer()).toString('base64') };
}
(async () => {
  const fixtures = await Promise.all([fixture(320, 160, 1), fixture(320, 160, 6), fixture(320, 160, 8), fixture(4032, 3024, 6)]);
  const results = [];
  for (const engine of ['webkit', 'chromium']) {
    const browser = await ({ chromium, webkit })[engine].launch({ headless: true,
      ...(engine === 'chromium' ? { executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' } : {}) });
    try {
      for (const legacyEnum of [false, true]) {
        const page = await browser.newPage(); const network = [];
        await page.route('**/*', r => { network.push(r.request().url()); return r.abort(); });
        if (legacyEnum) await page.evaluate(() => {
          const native = window.createImageBitmap.bind(window);
          window.createImageBitmap = (source, options) => {
            if (options?.imageOrientation !== undefined && !['none', 'flipY'].includes(options.imageOrientation)) throw new TypeError('Type error');
            return native(source, options);
          };
        });
        await page.addScriptTag({ content: `{const exports={};${compiled}\nwindow.photoUnderTest=exports;}` });
        for (const f of fixtures) {
          const r = await page.evaluate(async f => {
            try {
              const input = new Blob([Uint8Array.from(atob(f.data), x => x.charCodeAt(0))], { type: 'image/jpeg' });
              const output = await window.photoUnderTest.preparePhoto(input);
              const bytes = Uint8Array.from(atob(output.data), x => x.charCodeAt(0));
              const decoded = await createImageBitmap(new Blob([bytes], { type: 'image/jpeg' }));
              const c = document.createElement('canvas'); c.width = decoded.width; c.height = decoded.height;
              const ctx = c.getContext('2d'); ctx.drawImage(decoded, 0, 0); decoded.close();
              const corners = [[.25, .25], [.75, .25], [.25, .75], [.75, .75]].map(([x, y]) => [...ctx.getImageData(Math.floor(c.width * x), Math.floor(c.height * y), 1, 1).data].slice(0, 3));
              const result = { ok: true, width: c.width, height: c.height, corners, metadata: window.photoUnderTest.hasJpegMetadata(bytes) };
              c.width = 0; c.height = 0; return result;
            } catch (e) { return { ok: false, code: e.code, cause: e.causeName }; }
          }, f);
          results.push({ engine, version: browser.version(), legacyEnum, input: { width: f.width, height: f.height, orientation: f.orientation }, ...r });
        }
        assert.deepEqual(network, []); await page.close();
      }
    } finally { await browser.close(); }
  }
  const failures = [];
  for (const r of results) {
    try {
      assert.equal(r.ok, true, `${r.code}/${r.cause}`);
      const large = r.input.width === 4032;
      assert.deepEqual([r.width, r.height], large ? [960, 1280] : r.input.orientation === 1 ? [320, 160] : [160, 320]);
      const order = r.input.orientation === 6 ? [2, 0, 3, 1] : r.input.orientation === 8 ? [1, 3, 0, 2] : [0, 1, 2, 3];
      r.corners.forEach((actual, i) => actual.forEach((value, channel) => assert.ok(Math.abs(value - colors[order[i]][channel]) <= 15, 'rotation/pixel mismatch')));
      assert.equal(r.metadata, false);
    } catch (e) { failures.push({ engine: r.engine, legacyEnum: r.legacyEnum, input: r.input, error: e.message }); }
  }
  const receipt = { checkedAt: new Date().toISOString(), scope: 'Desktop engines with real JPEG/EXIF decoding and a simulated legacy enum rejection; not iPhone field acceptance', results, failures };
  if (process.env.NIGHTINGALE_ORIENTATION_RECEIPT) fs.writeFileSync(process.env.NIGHTINGALE_ORIENTATION_RECEIPT, JSON.stringify(receipt, null, 2) + '\n');
  console.log(JSON.stringify({ cases: results.length, failures }, null, 2));
  assert.equal(failures.length, 0);
})().catch(e => { console.error(e); process.exitCode = 1; });
