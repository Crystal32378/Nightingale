// Local, synthetic images only. No server, camera, cloud calls or fixture uploads.
// PLAYWRIGHT_MODULE=/path/to/playwright node scripts/check-photo-browser.cjs
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const { chromium, webkit } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');

const source = fs.readFileSync(path.join(__dirname, '../src/remote/photo.ts'), 'utf8');
const compiled = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
}).outputText;

async function checkBrowser(name, engine, options = {}) {
  const browser = await engine.launch({ headless: true, ...options });
  try {
    const page = await browser.newPage();
    const requests = [];
    await page.route('**/*', (route) => {
      requests.push(route.request().url());
      return route.abort();
    });
    await page.addScriptTag({ content: `{ const exports = {}; ${compiled}\nwindow.photoUnderTest = exports; }` });
    const cases = await page.evaluate(async () => {
      const sentinel = 'NIGHTINGALE_SYNTHETIC_GPS_NOT_REAL_25.0000_121.0000';
      // Actual APP1 payload from the 2026-10-08 WebKit receipt, followed by test-only data.
      const webkitExif = '4578696600004d4d002a00000008000187690004000000010000001a000000000003a00100030000000100010000a00200040000000100000140a003000400000001000000f000000000';
      const payload = [
        ...webkitExif.match(/../g).map((value) => parseInt(value, 16)),
        ...new TextEncoder().encode(sentinel),
      ];
      const app1 = new Uint8Array([0xff, 0xe1, (payload.length + 2) >> 8, (payload.length + 2) & 255, ...payload]);
      const encode = (canvas, type) => new Promise((resolve) => canvas.toBlob(resolve, type, 0.8));
      // An independent header reader, only for the baseline sequential JPEGs browsers encode here.
      const headerMarkers = (bytes) => {
        if (bytes[0] !== 255 || bytes[1] !== 216) throw Error('not JPEG');
        const markers = [];
        for (let i = 2; i + 3 < bytes.length;) {
          if (bytes[i] !== 255) throw Error('invalid header');
          const marker = bytes[i + 1];
          if (marker === 0xda) return markers;
          const length = bytes[i + 2] * 256 + bytes[i + 3];
          if (length < 2 || i + 2 + length > bytes.length) throw Error('invalid segment');
          markers.push(marker);
          i += length + 2;
        }
        throw Error('missing scan');
      };
      const results = [];
      for (const spec of [
        { name: 'clean PNG', width: 320, height: 240 },
        { name: 'original JPEG with synthetic EXIF', width: 320, height: 240, exif: true },
        { name: 'large PNG resized', width: 1600, height: 1200 },
      ]) {
        const canvas = document.createElement('canvas');
        canvas.width = spec.width;
        canvas.height = spec.height;
        const ctx = canvas.getContext('2d');
        ctx.fillStyle = '#4499ab';
        ctx.fillRect(0, 0, spec.width, spec.height);
        const rawJpeg = new Uint8Array(await (await encode(canvas, 'image/jpeg')).arrayBuffer());
        const input = spec.exif
          ? new Blob([rawJpeg.subarray(0, 2), app1, rawJpeg.subarray(2)], { type: 'image/jpeg' })
          : await encode(canvas, 'image/png');
        const result = { name: spec.name, rawCanvasMarkers: headerMarkers(rawJpeg) };
        try {
          const prepared = await window.photoUnderTest.preparePhoto(input);
          const bytes = Uint8Array.from(atob(prepared.data), (value) => value.charCodeAt(0));
          const decoded = await createImageBitmap(new Blob([bytes], { type: prepared.mimeType }));
          const output = document.createElement('canvas');
          output.width = decoded.width;
          output.height = decoded.height;
          const outputCtx = output.getContext('2d');
          outputCtx.drawImage(decoded, 0, 0);
          Object.assign(result, {
            ok: true,
            mimeType: prepared.mimeType,
            bytes: bytes.length,
            markers: headerMarkers(bytes),
            metadataGuard: window.photoUnderTest.hasJpegMetadata(bytes),
            leakedOriginalMetadata: atob(prepared.data).includes(sentinel),
            dimensions: { width: decoded.width, height: decoded.height },
            centerPixel: [...outputCtx.getImageData(output.width / 2, output.height / 2, 1, 1).data],
          });
          decoded.close();
        } catch (error) {
          Object.assign(result, { ok: false, error: error.message });
        }
        results.push(result);
      }
      return results;
    });
    return { engine: name, version: browser.version(), requests, cases };
  } finally {
    await browser.close();
  }
}

(async () => {
  const results = [];
  // Keep both receipts even if one engine exposes a regression.
  for (const [name, engine, options] of [
    ['webkit', webkit, {}],
    ['chromium', chromium, { executablePath: process.env.CHROME_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' }],
  ]) results.push(await checkBrowser(name, engine, options));
  console.log(JSON.stringify({ scope: 'Desktop engines only; iPhone LINE acceptance pending', results }, null, 2));
  const failures = [];
  for (const result of results) {
    assert.deepEqual(result.requests, [], 'photo preparation must not send a network request');
    for (const item of result.cases) {
      try {
        assert.equal(item.ok, true, item.error);
        assert.equal(item.mimeType, 'image/jpeg');
        assert.equal(item.metadataGuard, false);
        assert.equal(item.leakedOriginalMetadata, false);
        assert.ok(item.markers.every((marker) => ![0xe1, 0xed, 0xfe].includes(marker)), 'metadata segment survived');
        assert.deepEqual(item.dimensions, item.name === 'large PNG resized' ? { width: 1280, height: 960 } : { width: 320, height: 240 });
        for (const [index, value] of [68, 153, 171, 255].entries()) {
          assert.ok(Math.abs(item.centerPixel[index] - value) <= 5, `decoded pixel differs at channel ${index}`);
        }
      } catch (error) {
        failures.push(`${result.engine}: ${item.name}: ${error.message}`);
      }
    }
  }
  if (failures.length) throw Error(failures.join('\n'));
  console.log('PASS: 6 photo preparation cases, decoded sizes/pixels, metadata privacy, no network requests');
})().catch((error) => { console.error(error); process.exitCode = 1; });
