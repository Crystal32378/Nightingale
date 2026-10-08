const assert = require('node:assert/strict');
const fs = require('node:fs');
const { chromium, webkit } = require(process.env.PLAYWRIGHT_MODULE);
const base = process.env.NIGHTINGALE_UI_URL || 'http://127.0.0.1:4173';
const receipts = [];
const state = (cp = 'cp2', expects = 'evidence') => ({
  session: { routeId: 'renai-001', state: 'AT_CHECKPOINT', checkpointId: cp, questionCount: 0 },
  action: { type: 'REANCHOR', checkpointId: cp, lookFor: ['路牌'] }, expects,
});
(async () => {
  for (const engine of ['chromium', 'webkit']) {
    const browser = await ({ chromium, webkit })[engine].launch({ headless: true,
      ...(engine === 'chromium' ? { executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' } : {}) });
    try {
      const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
      page.setDefaultTimeout(6000);
      const observations = []; const audioRequests = []; const errors = [];
      page.on('pageerror', e => errors.push(e.message));
      await page.addInitScript(engine => {
        window.__voice = { acquired: 0, stopped: 0, streams: [], playback: 0 };
        const nativeFetch = window.fetch.bind(window);
        window.fetch = async (url, init) => {
          if (String(url).endsWith('/transcriptions') && init?.body instanceof Blob) window.__voice.lastUpload = [...new Uint8Array(await init.body.arrayBuffer())];
          return nativeFetch(url, init);
        };
        navigator.geolocation.watchPosition = () => 0;
        HTMLMediaElement.prototype.play = function () { window.__voice.playback++; return Promise.resolve(); };
        const syntheticGetUserMedia = async () => {
          const context = new AudioContext(); const oscillator = context.createOscillator();
          const output = context.createMediaStreamDestination(); oscillator.connect(output); oscillator.start();
          await context.resume(); window.__voice.acquired++; window.__voice.streams.push(output.stream);
          for (const track of output.stream.getTracks()) {
            const stop = track.stop.bind(track); track.stop = () => { window.__voice.stopped++; stop(); oscillator.stop(); void context.close(); };
          }
          return output.stream;
        };
        Object.defineProperty(navigator, 'mediaDevices', { configurable: true, value: { getUserMedia: syntheticGetUserMedia } });
        if (engine === 'webkit') {
          const nativeSupport = MediaRecorder.isTypeSupported.bind(MediaRecorder);
          MediaRecorder.isTypeSupported = mime => mime.startsWith('audio/mp4') && nativeSupport(mime);
        }
      }, engine);
      let continuation = 0;
      await page.route('**/api/**', async route => {
        const req = route.request(), path = new URL(req.url()).pathname;
        const json = body => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body), headers: { 'Access-Control-Allow-Origin': '*' } });
        if (req.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'POST,GET', 'Access-Control-Allow-Headers': '*' } });
        if (path === '/api/routes') return json([{ routeId: 'renai-001', origin: { name: '忠孝復興站' }, destination: { name: '仁愛院區' }, zones: [] }]);
        if (path === '/api/sessions') return json({ sessionId: 'voice-test', ...state('cp1', 'walker') });
        if (path.endsWith('/transcriptions')) {
          const bytes = req.postDataBuffer() || Buffer.from(await page.evaluate(() => window.__voice.lastUpload)); audioRequests.push({ mime: req.headers()['content-type'], bytes: bytes.length });
          if (process.env.NIGHTINGALE_AUDIO_FIXTURES) fs.writeFileSync(`${process.env.NIGHTINGALE_AUDIO_FIXTURES}/${engine}.audio`, bytes);
          return json({ text: 'I see a YouBike station' });
        }
        if (path.endsWith('/observations')) {
          const body = req.postDataJSON(); observations.push(body);
          if (body.confirm === 'done') return json(state());
          if (body.text === 'first crossing test') return json(state('cp2x', 'walker'));
          if (body.text === 'second crossing test') return json(state('cp3x', 'walker'));
          if (body.text === 'Renai Fuxing intersection') return json({ ...state(), action: { type: 'ASK', checkpointId: 'cp2', question: '你已經過復興南路，現在安全站在仁愛路口，而且還沒過仁愛路，對嗎？', confirmation: { id: `question-${++continuation}`, kind: 'renai-before-second-crossing' } } });
          if (body.confirmation) return json(state());
          return json(state());
        }
        throw Error(`Unexpected API ${path}`);
      });
      await page.goto(`${base}/?flow=last300m&photo=1&lang=en`);
      await page.getByRole('button', { name: 'Start', exact: true }).click();
      await page.getByRole('button', { name: 'I am at Exit 2', exact: true }).waitFor();
      assert.equal(await page.getByRole('button', { name: 'Say a sentence', exact: true }).count(), 0);
      await page.getByRole('button', { name: 'I am at Exit 2', exact: true }).click();
      const speak = page.getByRole('button', { name: 'Say a sentence', exact: true });
      await speak.waitFor({ timeout: 2000 });
      assert.equal(await page.evaluate(() => window.__voice.acquired), 0);
      await speak.click(); await page.getByRole('button', { name: 'Finished speaking', exact: true }).waitFor().catch(async e => { console.error(engine, await page.locator('body').innerText(), await page.evaluate(() => ({ ...window.__voice, streams: undefined, api: !!navigator.mediaDevices, mp4: MediaRecorder.isTypeSupported('audio/mp4'), webm: MediaRecorder.isTypeSupported('audio/webm;codecs=opus') }))); throw e; });
      assert.equal(await page.getByRole('button', { name: 'Send', exact: true }).isDisabled(), true);
      await page.waitForTimeout(600);
      const playback = await page.evaluate(() => window.__voice.playback);
      await page.getByRole('button', { name: 'Finished speaking', exact: true }).click();
      await page.waitForFunction(() => document.querySelector('.l3-input')?.value === 'I see a YouBike station');
      assert.equal(observations.length, 1); assert.equal(audioRequests.length, 1);
      assert.equal(await page.evaluate(() => window.__voice.playback), playback);
      assert.equal(await page.evaluate(() => window.__voice.streams.every(s => s.getTracks().every(t => t.readyState === 'ended'))), true);
      const input = page.getByRole('textbox', { name: 'What can you see?' });
      await input.fill('I see a street sign'); await page.getByRole('button', { name: 'Send', exact: true }).dblclick();
      await page.waitForTimeout(150); assert.deepEqual(observations.slice(1), [{ text: 'I see a street sign' }]);
      await input.fill('existing draft'); await speak.click(); await page.getByRole('button', { name: 'Finished speaking', exact: true }).waitFor();
      await page.getByRole('button', { name: 'Cancel recording', exact: true }).click();
      assert.equal(await input.inputValue(), 'existing draft'); assert.equal(audioRequests.length, 1);
      await speak.click(); await page.getByRole('button', { name: 'Finished speaking', exact: true }).waitFor();
      await page.getByRole('button', { name: 'Help me ask', exact: true }).click();
      assert.equal(await page.evaluate(() => window.__voice.streams.every(s => s.getTracks().every(t => t.readyState === 'ended'))), true);
      await page.keyboard.press('Escape');
      await speak.click(); await page.getByRole('button', { name: 'Finished speaking', exact: true }).waitFor();
      await page.evaluate(() => window.dispatchEvent(new Event('pagehide')));
      await speak.waitFor(); assert.equal(audioRequests.length, 1);
      for (const text of ['first crossing test', 'second crossing test']) {
        await input.fill(text); await page.getByRole('button', { name: 'Send', exact: true }).click();
        await page.getByRole('button', { name: 'I have crossed', exact: true }).waitFor(); assert.equal(await speak.count(), 0);
        await page.getByRole('button', { name: 'I have crossed', exact: true }).click(); await speak.waitFor();
      }
      await input.fill('Renai Fuxing intersection'); await page.getByRole('button', { name: 'Send', exact: true }).click();
      await page.getByRole('button', { name: 'No / not sure', exact: true }).waitFor(); assert.equal(await speak.count(), 0);
      await page.getByRole('button', { name: 'No / not sure', exact: true }).click(); await speak.waitFor();
      await page.evaluate(() => { navigator.mediaDevices.getUserMedia = async () => { throw new DOMException('denied', 'NotAllowedError'); }; });
      await speak.click(); await page.getByText(/The microphone is not enabled/).waitFor();
      assert.equal(await input.isEnabled(), true);
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
      assert.deepEqual(errors, []);
      if (process.env.NIGHTINGALE_VOICE_SCREENSHOT) await page.screenshot({ path: `${process.env.NIGHTINGALE_VOICE_SCREENSHOT}/${engine}.png`, fullPage: true });
      receipts.push({ engine, version: browser.version(), audioRequests, assertions: 'editable transcript without auto-send; one explicit send; no capture before click; cancel/help/pagehide release tracks; both crossings and confirmation hide input; no JS errors or overflow', scope: 'Desktop engines and synthetic oscillator with intercepted API; WebKit negotiates native MP4 under a restricted MIME capability list. Not iPhone LINE or real model speech acceptance' });
    } finally { await browser.close(); }
  }
  if (process.env.NIGHTINGALE_VOICE_RECEIPT) fs.writeFileSync(process.env.NIGHTINGALE_VOICE_RECEIPT, JSON.stringify({ checkedAt: new Date().toISOString(), receipts }, null, 2) + '\n');
  console.log(JSON.stringify(receipts, null, 2));
})().catch(error => { console.error(error); process.exitCode = 1; });
