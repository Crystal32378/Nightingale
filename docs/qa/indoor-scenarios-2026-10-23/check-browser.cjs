// Run against the real local UI/proxy. No intercepted responses or mocked TTS.
// PLAYWRIGHT_MODULE points to an externally installed playwright-core package.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE);
const mode = process.argv[2];
assert(['nemotron', 'api-failure', 'mock'].includes(mode));
const base = process.env.NIGHTINGALE_UI_URL || 'http://127.0.0.1:5173';
assert(['127.0.0.1', 'localhost'].includes(new URL(base).hostname));
const result = {
  recordedAt: new Date().toISOString(),
  revision: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(),
  mode, viewport: { width: 390, height: 844 },
  browser: '', cases: [], pageErrors: [], consoleErrors: [],
  note: 'Headless desktop Edge at mobile width; not a physical phone or an audio-quality assessment.',
};
let browser;
async function scenario(id, input, expected) {
  const context = await browser.newContext({ viewport: result.viewport });
  const page = await context.newPage();
  page.setDefaultTimeout(15000);
  page.on('pageerror', error => result.pageErrors.push(error.message));
  page.on('console', message => {
    if (message.type() === 'error') result.consoleErrors.push(message.text());
  });
  const record = { id, input, expected, screenshots: [], assertions: [] };
  result.cases.push(record);
  try {
    await page.goto(base);
    const field = page.getByRole('textbox', { name: '想去哪裡', exact: true });
    await field.fill(input);
    const started = Date.now();
    const replyPromise = page.waitForResponse(response =>
      new URL(response.url()).pathname === '/indoor-api/destination');
    await page.getByRole('button', { name: '找路', exact: true }).click();
    const response = await replyPromise;
    record.proxyStatus = response.status();
    const body = await response.json().catch(() => null);
    record.proxyAnswer = body && { mode: body.mode, destination: body.destination };
    record.responseMs = Date.now() - started;
    if (mode !== 'mock') {
      assert.equal(response.status(), 200);
      assert.deepEqual(record.proxyAnswer, { mode: 'nemotron', destination: expected === 'place'
        ? { kind: 'place', placeId: 'PHARMACY' } : { kind: 'uncertain' } });
    } else {
      assert(response.status() >= 500, 'Stopped proxy must fail before client fallback');
    }
    await page.getByText(mode === 'mock' ? '模擬' : 'Nemotron', { exact: true }).waitFor();
    assert.equal(await page.evaluate(() => localStorage.getItem('nightingale.visit.v1')), null);
    record.assertions.push('No visit before destination confirmation');
    async function shot(suffix) {
      const filename = `${id}-${suffix}.png`;
      await page.screenshot({ path: path.join(__dirname, filename), fullPage: true, animations: 'disabled' });
      record.screenshots.push(filename);
    }
    if (expected === 'place') {
      await page.locator('.answer p').filter({ hasText: '要去藥局？' }).waitFor();
      assert.equal(await page.getByRole('button', { name: '開始示範行程', exact: true }).count(), 0);
      await shot('confirm');
      await page.getByRole('button', { name: '對', exact: true }).click();
      await page.getByText('路線進行中', { exact: true }).waitFor();
      const visit = await page.evaluate(() => JSON.parse(localStorage.getItem('nightingale.visit.v1')));
      assert.equal(visit.legIndex, 2);
      assert.equal(visit.lastObservation.nodeId, 'ENTRANCE');
      record.assertions.push('Confirmation starts pharmacy leg at entrance');
      await shot('walk');
    } else {
      await page.locator('.answer p').filter({ hasText: '我不確定。我陪你問。' }).waitFor();
      assert.equal(await page.getByRole('button', { name: '對', exact: true }).count(), 0);
      assert.equal(await page.getByRole('button', { name: '開始示範行程', exact: true }).count(), 0);
      assert.equal(await field.inputValue(), input);
      await shot('uncertain');
      await page.getByRole('button', { name: '幫我問', exact: true }).click();
      await page.getByRole('dialog', { name: '請問，可以幫我找路嗎？', exact: true }).waitFor();
      assert.equal(await page.evaluate(() => localStorage.getItem('nightingale.visit.v1')), null);
      await shot('help');
      await page.getByRole('button', { name: '好了', exact: true }).click();
      assert.equal(await field.inputValue(), input);
      assert.equal(await field.evaluate(element => element === document.activeElement), true);
      record.assertions.push('Uncertain offers generic help without starting a visit',
        'Closing help preserves input and restores focus');
    }
    record.passed = true;
  } finally {
    await context.close();
  }
}
(async () => {
  browser = await chromium.launch({ headless: true, executablePath:
    process.env.EDGE_PATH || 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe' });
  result.browser = browser.version();
  if (mode === 'nemotron') {
    await scenario('01-normal', '我要去領藥', 'place');
    await scenario('02-unrecognized', '今天天氣如何', 'uncertain');
  } else if (mode === 'api-failure') {
    await scenario('03-api-failure', '我要去領藥', 'uncertain');
  } else {
    await scenario('04-mock', '我要去藥局', 'place');
  }
  assert.deepEqual(result.pageErrors, []);
  result.passed = true;
})().catch(error => {
  result.passed = false;
  result.error = error.message;
  process.exitCode = 1;
}).finally(async () => {
  if (browser) await browser.close();
  fs.writeFileSync(path.join(__dirname, `${mode}-result.json`), JSON.stringify(result, null, 2) + '\n');
  console.log(JSON.stringify(result, null, 2));
});
