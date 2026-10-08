// Local API only. Verify diagnostic failure paths without sending image/diagnostic data.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { chromium, webkit } = require(process.env.PLAYWRIGHT_MODULE);
const sharp = require('/Users/crystalchang/Desktop/Fable Suite/nightingale/node_modules/sharp');
const frontend = 'http://127.0.0.1:5179';
const api = 'http://127.0.0.1:8791';
const out = process.env.NIGHTINGALE_DIAGNOSTIC_RECEIPT;
assert.ok(out, 'Set a local receipt path');
(async () => {
  const input = await sharp({ create: { width: 320, height: 240, channels: 3, background: '#7799aa' } }).png().toBuffer();
  const results = [];
  for (const engine of ['chromium', 'webkit']) {
    const browser = await ({ chromium, webkit })[engine].launch({ headless: true,
      ...(engine === 'chromium' ? { executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' } : {}) });
    try {
      for (const test of [
        { name: 'decode diagnostics', diagnostic: true, failure: 'decode', code: 'P-DECODE' },
        { name: 'JPEG framing diagnostics', diagnostic: true, failure: 'jpeg', code: 'P-JPEG' },
        { name: 'normal notice unchanged', diagnostic: false, failure: 'decode' },
        { name: 'successful upload unchanged', diagnostic: true, failure: null },
      ]) {
        const context = await browser.newContext({ viewport: { width: 390, height: 844 }, permissions: [] });
        const unexpected = [], errors = [], observations = [];
        await context.route('**/*', route => {
          const u = new URL(route.request().url());
          if ([frontend, api].includes(u.origin)) return route.continue();
          unexpected.push(u.origin); return route.abort();
        });
        if (test.failure) await context.addInitScript(failure => {
          if (failure === 'decode') window.createImageBitmap = async () => { throw new DOMException('PRIVATE_EXCEPTION_MESSAGE', 'InvalidStateError'); };
          if (failure === 'jpeg') HTMLCanvasElement.prototype.toBlob = function (callback) { callback(new Blob([new Uint8Array([255, 216, 255])], { type: 'image/jpeg' })); };
        }, test.failure);
        const page = await context.newPage(); page.setDefaultTimeout(15000);
        page.on('pageerror', error => errors.push(String(error)));
        await page.goto(frontend + '/?flow=last300m&photo=1' + (test.diagnostic ? '&photoCheck=1' : ''));
        await page.getByRole('button', { name: '開始', exact: true }).click();
        await page.getByRole('button', { name: '我到出口2了', exact: true }).click();
        await page.getByPlaceholder('跟我說你看到什麼').waitFor();
        page.on('request', request => {
          if (request.method() === 'POST' && request.url().endsWith('/observations')) observations.push(JSON.parse(request.postData()));
        });
        await page.getByRole('button', { name: '拍招牌', exact: true }).click();
        const delivered = test.failure ? null : page.waitForResponse(r => r.url().endsWith('/observations') && r.request().method() === 'POST');
        await page.locator('input[type=file]').setInputFiles({ name: 'PRIVATE_ORIGINAL_NAME.png', mimeType: 'image/png', buffer: input });
        let notice = null;
        if (test.failure) {
          await page.getByText(/這張照片我打不開/).waitFor();
          notice = await page.locator('.l3-notice').innerText();
          assert.equal(observations.length, 0, 'failed photo must not send any observation or diagnostic');
          assert.ok(!/PRIVATE|EXCEPTION_MESSAGE|ORIGINAL_NAME/.test(notice));
          if (test.diagnostic) { assert.ok(notice.includes(test.code)); assert.ok(notice.includes('PNG')); }
          else assert.equal(notice, '這張照片我打不開。用文字跟我說也可以。');
          await page.getByPlaceholder('跟我說你看到什麼').fill('youbike站');
          await page.getByRole('button', { name: '傳送', exact: true }).click();
          await page.getByText(/YouBike 旁邊的路牌/).waitFor();
          assert.deepEqual(observations, [{ text: 'youbike站' }]);
        } else {
          const response = await delivered; assert.equal(response.status(), 200);
          assert.equal(observations.length, 1);
          assert.deepEqual(Object.keys(observations[0]), ['photo']);
          assert.deepEqual(Object.keys(observations[0].photo).sort(), ['data', 'mimeType']);
          assert.equal(observations[0].photo.mimeType, 'image/jpeg');
        }
        assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
        assert.deepEqual(errors, []); assert.deepEqual(unexpected, []);
        results.push({ engine, version: browser.version(), test: test.name, status: 'PASS', notice,
          photoDiagnosticNetworkRequests: 0, noFilenameOrMessageLeak: true, textFallbackUsable: !!test.failure });
        await context.close();
      }
    } finally { await browser.close(); }
  }
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, JSON.stringify({ checkedAt: new Date().toISOString(), scope: 'Local injected failures only; no real iPhone error diagnosis yet', results }, null, 2) + '\n');
  console.log(JSON.stringify({ status: 'PASS', cases: results.length }));
})().catch(e => { console.error(e); process.exitCode = 1; });
