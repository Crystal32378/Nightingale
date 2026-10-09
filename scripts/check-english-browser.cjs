const assert = require('node:assert/strict');
const fs = require('node:fs');
const { chromium, webkit } = require(process.env.PLAYWRIGHT_MODULE);
const base = process.env.NIGHTINGALE_UI_URL || 'http://127.0.0.1:4173';
(async () => {
  const results=[];
  for (const engine of ['chromium','webkit']) {
    const browser=await ({chromium,webkit})[engine].launch({headless:true,...(engine==='chromium'?{executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'}:{})});
    try {
      const page=await browser.newPage({viewport:{width:390,height:844}});page.setDefaultTimeout(4000);
      let cp='cp1', question=0, confirmations=0;const requests=[];const errors=[];
      page.on('pageerror',e=>errors.push(e.message));
      await page.addInitScript(()=>{
        navigator.geolocation.watchPosition=()=>0;
        window.__spoken=[];
        Object.defineProperty(window,'speechSynthesis',{value:{cancel(){},speak(u){window.__spoken.push({text:u.text,lang:u.lang})}}});
      });
      const result=(action,expects='evidence',state='AT_CHECKPOINT')=>({session:{routeId:'renai-001',state,checkpointId:cp,questionCount:question},action,expects});
      const reanchor=()=>result({type:'REANCHOR',checkpointId:cp,lookFor:cp==='cp2'?['大安路一段116巷','仁愛路三段123巷13弄']:['復康巴士']});
      await page.route('**/api/**',async route=>{
        const req=route.request(),url=new URL(req.url());
        const json=data=>route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(data)});
        if(req.method()==='OPTIONS')return route.fulfill({status:204,headers:{'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'*','Access-Control-Allow-Methods':'GET,POST'}});
        requests.push({path:url.pathname,body:req.postDataJSON()});
        if(url.pathname==='/api/routes')return json([{routeId:'renai-001',origin:{name:'捷運忠孝復興站 出口2'},destination:{name:'臺北市立聯合醫院仁愛院區'},zones:[]}]);
        if(url.pathname==='/api/sessions')return json({sessionId:'english-test',...result({type:'REANCHOR',checkpointId:'cp1',lookFor:[]},'walker')});
        const body=req.postDataJSON();
        if(body.confirmation){if(body.confirmation.answer==='confirm'){cp='cp3x';return json(result({type:'GUIDE',checkpointId:'cp3',instruction:'等綠燈，過仁愛路。'},'walker'));}return json(reanchor());}
        if(body.confirm==='done'){const old=cp;cp={cp1:'cp2',cp2x:'cp3',cp3x:'cp4'}[cp];return json(result({type:'GUIDE',checkpointId:old,instruction:'已確認的中文'}));}
        if(body.text==='YouBike station')return json(result({type:'ASK',checkpointId:cp,messageKey:'ask.youbike',question:'YouBike 旁邊的路牌寫什麼？'}));
        if(body.text==='Renai Fuxing intersection')return json(result({type:'ASK',checkpointId:'cp2',messageKey:'ask.crossing-history',question:'你已經過復興南路，現在安全站在仁愛路口的人行道上，而且還沒有過仁愛路，對嗎？',confirmation:{id:`q-${++confirmations}`,kind:'renai-before-second-crossing'}}));
        if(body.text==='Lane 116'){cp='cp2x';return json(result({type:'GUIDE',checkpointId:'cp2',instruction:'過復興南路'},'walker'));}
        if(body.text==='Renai Road'){cp='cp3x';return json(result({type:'GUIDE',checkpointId:'cp3',instruction:'過仁愛路'},'walker'));}
        if(body.text==='ER'&&cp==='cp4'){cp='cp5';return json(result({type:'GUIDE',checkpointId:'cp4',instruction:'大廳在前'}));}
        if(['ER','Daan','Canopy'].includes(body.text))return json(result({type:'RECOVER',checkpointId:'cp5',messageKey:{ER:'recover.er',Daan:'recover.daan',Canopy:'recover.canopy'}[body.text],instruction:'伺服器中文'},'evidence','RECOVERING'));
        if(body.text==='rehabilitation bus'){question++;return json(result(question===1?{type:'ASK',checkpointId:'cp5',messageKey:'ask.entrance',question:'急診？'}:{type:'CONFIRM_ARRIVAL',checkpointId:'cp5'},'evidence',question===1?'AMBIGUOUS':'ARRIVED'));}
        return json(reanchor());
      });
      await page.goto(base+'/?flow=last300m&photo=1&lang=en');
      await page.getByRole('button',{name:'Start',exact:true}).click();
      await page.getByRole('button',{name:'I am at Exit 2',exact:true}).click();
      const input=page.getByRole('textbox',{name:'What can you see?'});
      const send=async text=>{await input.fill(text);await page.getByRole('button',{name:'Send',exact:true}).click();};
      await page.getByRole('button',{name:'Say a sentence',exact:true}).waitFor();
      await send('YouBike station');await page.getByText('What does the street sign beside YouBike say?',{exact:true}).waitFor();
      assert.match(await page.locator('.l3-guidance').innerText(),/大安路一段116巷/);
      let count=requests.length;
      await page.getByLabel('Language / 語言').selectOption('zh-TW');await page.getByRole('button',{name:'傳送',exact:true}).waitFor();
      await page.getByLabel('Language / 語言').selectOption('en');await input.waitFor();assert.equal(requests.length,count);
      await page.getByRole('button',{name:'Help me ask',exact:true}).click();
      const dialog=page.getByRole('dialog');await dialog.waitFor();
      await dialog.getByRole('button',{name:'Say it again',exact:true}).waitFor();
      assert.equal(await dialog.getAttribute('lang'),'en');assert.equal(await page.evaluate(()=>window.__spoken.length),0);
      assert.equal(await dialog.getByRole('button',{name:'Quieter',exact:true}).count(),1);
      await page.keyboard.press('Escape');assert.equal(await page.getByRole('button',{name:'Help me ask',exact:true}).evaluate(el=>el===document.activeElement),true);
      await send('Renai Fuxing intersection');await page.getByRole('button',{name:'Yes, all of those are true',exact:true}).waitFor();
      assert.match(await page.locator('.l3-guidance').innerText(),/not crossed Renai Road yet/);
      count=requests.length;await page.getByLabel('Language / 語言').selectOption('zh-TW');await page.getByLabel('Language / 語言').selectOption('en');assert.equal(requests.length,count);
      await page.getByRole('button',{name:'No / not sure',exact:true}).click();await input.waitFor();
      await send('Lane 116');await page.getByRole('button',{name:'I have crossed',exact:true}).waitFor();
      assert.equal(await page.getByRole('button',{name:'Say a sentence',exact:true}).count(),0);
      await page.getByRole('button',{name:'I have crossed',exact:true}).click();await input.waitFor();
      await send('Renai Road');await page.getByRole('button',{name:'I have crossed',exact:true}).click();await input.waitFor();
      await send('ER');await input.waitFor();
      for(const [text,phrase]of[['ER','emergency driveway'],['Daan','turn around'],['Canopy','green-roofed corridor']]){await send(text);await page.waitForFunction(phrase=>document.querySelector('.l3-guidance').textContent.toLowerCase().includes(phrase),phrase);}
      await send('rehabilitation bus');await page.getByText(/Does the sign above the door show the Chinese characters for Emergency/).waitFor();
      await send('rehabilitation bus');await page.getByText('At the entrance',{exact:true}).waitFor();
      assert.equal(await page.getByRole('textbox').count(),0);assert.equal(await page.locator('html').getAttribute('lang'),'en');
      assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);assert.deepEqual(errors,[]);
      if(process.env.NIGHTINGALE_EN_SCREENSHOTS)await page.screenshot({path:`${process.env.NIGHTINGALE_EN_SCREENSHOTS}/${engine}-arrival.png`,fullPage:true});
      results.push({engine,version:browser.version(),status:'PASS',requests:requests.length,scope:'Desktop mocked API, actual React UI; language switch, full route, help focus and no device speech fallback, confirmation/cancel and recoveries'});
    }finally{await browser.close();}
  }
  if(process.env.NIGHTINGALE_EN_RECEIPT)fs.writeFileSync(process.env.NIGHTINGALE_EN_RECEIPT,JSON.stringify({checkedAt:new Date().toISOString(),results},null,2)+'\n');
  console.log(JSON.stringify(results,null,2));
})().catch(e=>{console.error(e);process.exitCode=1;});
