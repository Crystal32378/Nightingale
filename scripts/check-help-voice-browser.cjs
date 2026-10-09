const assert = require('node:assert/strict');
const fs = require('node:fs');
const { chromium, webkit } = require(process.env.PLAYWRIGHT_MODULE);
const base = process.env.NIGHTINGALE_UI_URL || 'http://127.0.0.1:4318';
const engines = (process.env.NIGHTINGALE_ENGINES || 'chromium,webkit').split(',');
const reports = [];
const state = (cp='cp2', expects='evidence') => ({session:{routeId:'renai-001',state:'AT_CHECKPOINT',checkpointId:cp,questionCount:0},action:{type:'REANCHOR',checkpointId:cp,lookFor:['路牌']},expects});
(async()=>{
 for(const engine of engines){
  const browser=await ({chromium,webkit})[engine].launch({headless:true,...(engine==='chromium'?{executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'}:{})});
  try{
   const page=await browser.newPage({viewport:{width:390,height:844}});page.setDefaultTimeout(6000);
   const audio=[],posts=[],errors=[];
   await page.addInitScript(()=>{
    window.__helpTest={speech:0,starts:0,stops:0,gains:[]};
    const speak=speechSynthesis.speak.bind(speechSynthesis);speechSynthesis.speak=u=>{window.__helpTest.speech++;return speak(u)};
    const start=AudioBufferSourceNode.prototype.start,stop=AudioBufferSourceNode.prototype.stop,create=AudioContext.prototype.createGain;
    AudioBufferSourceNode.prototype.start=function(...args){window.__helpTest.starts++;return start.apply(this,args)};
    AudioBufferSourceNode.prototype.stop=function(...args){window.__helpTest.stops++;return stop.apply(this,args)};
    AudioContext.prototype.createGain=function(...args){const g=create.apply(this,args);window.__helpTest.gains.push(g);return g};
   });
   page.on('pageerror',e=>errors.push(e.message));
   page.on('request',r=>{if(r.url().includes('/audio/help/'))audio.push(r.url())});
   await page.route('**/api/**',async route=>{
    const req=route.request(),p=new URL(req.url()).pathname;
    if(req.method()==='OPTIONS')return route.fulfill({status:204,headers:{'Access-Control-Allow-Origin':'*','Access-Control-Allow-Methods':'GET,POST','Access-Control-Allow-Headers':'*'}});
    const json=body=>route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(body),headers:{'Access-Control-Allow-Origin':'*'}});
    if(req.method()==='POST')posts.push(p);
    if(p==='/api/routes')return json([{routeId:'renai-001',origin:{name:'忠孝復興站'},destination:{name:'仁愛院區'},zones:[]}]);
    if(p==='/api/sessions')return json({sessionId:'help-test',...state('cp1','walker')});
    if(p.endsWith('/observations'))return json(state());
    throw Error('Unexpected API '+p);
   });
   await page.goto(base+'/?flow=last300m&photo=1&lang=en');
   await page.getByRole('button',{name:'Start',exact:true}).click();await page.getByRole('button',{name:'I am at Exit 2',exact:true}).click();
   const count=posts.length;
   await page.getByRole('button',{name:'Help me ask',exact:true}).click();await page.getByRole('dialog').waitFor();await page.waitForTimeout(400);
   assert.equal(await page.evaluate(()=>window.__helpTest.speech),0,'Outdoor help must use the selected fixed voice, never device speech');
   await page.waitForFunction(()=>window.__helpTest.gains.length>0);
   assert.ok(audio.at(-1).endsWith('/audio/help/en/leda.wav'));
   assert.equal(posts.length,count,'Opening help must not send backend observations');
   let gain=await page.evaluate(()=>window.__helpTest.gains.at(-1).gain.value);assert.ok(Math.abs(gain-.4)<.01);
   await page.getByRole('button',{name:'Louder',exact:true}).click();await page.waitForTimeout(250);gain=await page.evaluate(()=>window.__helpTest.gains.at(-1).gain.value);assert.ok(Math.abs(gain-.625)<.01);
   const played=await page.evaluate(()=>window.__helpTest.starts);await page.getByRole('button',{name:'Say it again',exact:true}).click();await page.waitForFunction(n=>window.__helpTest.starts>n,played);gain=await page.evaluate(()=>window.__helpTest.gains.at(-1).gain.value);assert.ok(Math.abs(gain-1)<.01);
   const stopped=await page.evaluate(()=>window.__helpTest.stops);await page.keyboard.press('Escape');assert.ok(await page.evaluate(n=>window.__helpTest.stops>n,stopped));assert.equal(await page.getByRole('button',{name:'Help me ask',exact:true}).evaluate(e=>e===document.activeElement),true);
   for(const [locale,voice] of [['en','Puck'],['zh-TW','Leda'],['zh-TW','Puck']]){
    await page.locator('.l3-language select').selectOption(locale);await page.locator('.l3-voice select').selectOption(voice);
    const help=page.getByRole('button',{name:locale==='en'?'Help me ask':'幫我問',exact:true});await help.click();await page.waitForTimeout(350);assert.ok(audio.at(-1).endsWith(`/audio/help/${locale}/${voice.toLowerCase()}.wav`));await page.keyboard.press('Escape');
   }
   await page.locator('.l3-language select').selectOption('en');await page.locator('.l3-voice select').selectOption('quiet');const beforeQuiet=audio.length;await page.getByRole('button',{name:'Help me ask',exact:true}).click();await page.waitForTimeout(300);assert.equal(audio.length,beforeQuiet);assert.equal(await page.getByRole('button',{name:'Say it again',exact:true}).isDisabled(),true);await page.keyboard.press('Escape');
   await page.locator('.l3-voice select').selectOption('Leda');await page.route('**/audio/help/**',r=>r.fulfill({status:404,body:''}));const beforeMissing=await page.evaluate(()=>window.__helpTest.starts);await page.getByRole('button',{name:'Help me ask',exact:true}).click();await page.waitForTimeout(500);assert.equal(await page.evaluate(()=>window.__helpTest.starts),beforeMissing);assert.equal(await page.evaluate(()=>window.__helpTest.speech),0);assert.equal(await page.getByRole('dialog').isVisible(),true);await page.keyboard.press('Escape');await page.unroute('**/audio/help/**');
   let unblock;await page.route('**/audio/help/**',async r=>{await new Promise(resolve=>{unblock=resolve});await r.continue().catch(()=>{})});const beforeLate=await page.evaluate(()=>window.__helpTest.starts);await page.getByRole('button',{name:'Help me ask',exact:true}).click();await page.waitForTimeout(150);await page.keyboard.press('Escape');unblock();await page.waitForTimeout(500);assert.equal(await page.evaluate(()=>window.__helpTest.starts),beforeLate,'A closed help card must not start delayed audio');
   await page.unroute('**/audio/help/**');const beforeHide=await page.evaluate(()=>window.__helpTest.starts);await page.getByRole('button',{name:'Help me ask',exact:true}).click();await page.waitForFunction(n=>window.__helpTest.starts>n,beforeHide);const stopsBeforeHide=await page.evaluate(()=>window.__helpTest.stops);await page.evaluate(()=>window.dispatchEvent(new Event('pagehide')));assert.ok(await page.evaluate(n=>window.__helpTest.stops>n,stopsBeforeHide));
   assert.equal(posts.length,count);assert.deepEqual(errors,[]);reports.push({engine,status:'PASS',fourVoiceAssets:audio.slice(0,5),noDeviceSpeech:true,noBackendObservations:true,liveGainSteps:true,repeatLouder:true,closeCancels:true,quietAndMissingSilent:true,lateDownloadSilent:true,pageHideStops:true});
  }finally{await browser.close()}
 }
 if(process.env.NIGHTINGALE_RECEIPT)fs.writeFileSync(process.env.NIGHTINGALE_RECEIPT,JSON.stringify(reports,null,2)+'\n');console.log(JSON.stringify(reports));
})().catch(e=>{console.error(e);process.exitCode=1});
