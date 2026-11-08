const {chromium,devices}=require('playwright');const fs=require('fs');const path=require('path');
const DIR=__dirname;
const body=fs.readFileSync(path.join(DIR,'../dist/ciaociao.html'),'utf8');
const SK=`<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><style>:root{color-scheme:light;padding-top:env(safe-area-inset-top,0px);padding-bottom:env(safe-area-inset-bottom,0px)}body{margin:0;font:14px system-ui}img{max-width:100%}[hidden]{display:none!important}</style></head><body>`;
fs.writeFileSync(path.join(DIR,'_test.html'),SK+body+'</body></html>');
const URL_='file://'+path.join(DIR,'_test.html');
let fails=[];const ok=(c,m)=>{if(!c){fails.push(m);console.log('  FAIL',m)}};
const run=process.argv[2]||'1';

(async()=>{
 const b=await chromium.launch({args:['--autoplay-policy=user-gesture-required']});
 const ctx=await b.newContext({...devices['iPhone 13']});
 const p=await ctx.newPage();const errs=[];
 p.on('pageerror',e=>errs.push('pageerror: '+e.message));
 p.on('console',m=>{if(m.type()==='error'&&!/fonts\.g|ERR_TUNNEL|net::/.test(m.text()))errs.push('console: '+m.text())});
 await p.addInitScript(()=>{window.__plays=[];const orig=HTMLMediaElement.prototype.play;
   HTMLMediaElement.prototype.play=function(){const r={src:this.src,rate:this.playbackRate,last:null,ok:null};window.__plays.push(r);const pr=orig.call(this);
     pr.then(()=>{r.ok=true;r.last=this.dataset.last},e=>{r.ok=false;r.err=e.name});return pr}});
 await p.goto(URL_);await p.waitForTimeout(400);

 // 1. welcome
 console.log('run',run,'— welcome');
 ok(await p.isVisible('#welcomeName'),'welcome screen shows first');
 ok(!(await p.content()).includes('Mark'),'no hard-coded Mark');
 ok(await p.isDisabled('#welcomeGo'),'start disabled with empty name');
 await p.fill('#welcomeName','Giulia');await p.click('#welcomeGo');await p.waitForTimeout(200);
 ok((await p.textContent('.hero h1')).includes('Giulia'),'greets entered name');

 // 2. every audio clip decodes
 console.log('— audio clips');
 const clip=await p.evaluate(async()=>{const keys=Object.keys(AUD);const bad=[];let tot=0;
   for(const k of keys){const [g,...r]=k.split('_');const u=clipURL(r.join('_'),g);const a=new Audio();a.src=u;
     const d=await new Promise(res=>{a.onloadedmetadata=()=>res(a.duration);a.onerror=()=>res(-1);setTimeout(()=>res(-2),4000)});
     tot+=d;if(!(d>0.3&&d<9))bad.push(k+':'+d)}
   return{n:keys.length,bad,avg:tot/keys.length,missing:CARDS.filter(c=>!AUD['f_'+c.id]||!AUD['m_'+c.id]).map(c=>c.id)}});
 console.log('  clips',clip.n,'avg',clip.avg.toFixed(2)+'s','bad',clip.bad.length,'missing',clip.missing.length);
 ok(clip.n===300&&!clip.bad.length&&!clip.missing.length,'all 300 clips valid '+JSON.stringify(clip.bad.slice(0,5)));

 // 3. voice toggle on map plays sample in chosen voice
 await p.click('.hero [data-voice="m"]');await p.waitForTimeout(300);
 let last=await p.evaluate(()=>__plays[__plays.length-1]);
 ok(last&&last.ok&&/^m_/.test(last.last),'map Uomo toggle plays male clip '+JSON.stringify(last));
 await p.click('.hero [data-voice="f"]');await p.waitForTimeout(300);
 last=await p.evaluate(()=>__plays[__plays.length-1]);
 ok(last&&last.ok&&/^f_/.test(last.last),'map Donna toggle plays female clip');

 // 4. play every level through
 const playLevel=async(label,wrongRate)=>{
   let guard=0,wrongs=0,learns=0,audioChecks=0;
   while(guard++<200){
     if(await p.$('.result'))break;
     const t=await p.evaluate(()=>{const t=sess.tasks[sess.i];return{mode:t.mode,it:t.c.it,en:t.c.en,id:t.c.id,n:sess.tasks.length}});
     const wrong=t.mode!=='learn'&&Math.random()<wrongRate;
     const before=await p.evaluate(()=>__plays.length);
     if(t.mode==='learn'){
       learns++;
       let r=await p.evaluate(()=>__plays[__plays.length-1]);
       ok(r&&r.ok&&r.last&&r.last.endsWith(t.id),label+' learn autoplay '+t.id);
       await p.click('.card [data-say]');await p.waitForTimeout(60);
       r=await p.evaluate(()=>__plays[__plays.length-1]);
       ok(r.ok&&r.last.endsWith(t.id)&&r.rate===1,label+' Listen button plays '+t.id+' '+JSON.stringify(r));
       await p.click('.card [data-slow]');await p.waitForTimeout(60);
       r=await p.evaluate(()=>__plays[__plays.length-1]);
       ok(r.ok&&r.last.endsWith(t.id+'_slow')&&Math.abs(r.rate-0.7)<.01,label+' Slow button plays slow '+t.id+' '+JSON.stringify(r));
       audioChecks+=3;
       await p.click('#next');
     }else if(t.mode==='choice'||t.mode==='listen'){
       if(t.mode==='listen'){
         let r=await p.evaluate(()=>__plays[__plays.length-1]);ok(r&&r.ok&&r.last.endsWith(t.id),label+' listen autoplay');
         await p.click('.bigspk');await p.waitForTimeout(40);await p.click('.slowspk');await p.waitForTimeout(40);
         r=await p.evaluate(()=>__plays[__plays.length-1]);ok(r.ok&&r.last.endsWith(t.id+'_slow'),label+' listen SLOW button');audioChecks+=3;
       }
       const want=t.mode==='choice'?t.it:t.en;
       const opts=await p.$$('.opt');ok(opts.length===4,label+' 4 options');
       const texts=await Promise.all(opts.map(o=>o.textContent()));
       ok(texts.filter(x=>x===want).length===1,label+' exactly one correct option');
       const idx=wrong?texts.findIndex(x=>x!==want):texts.indexOf(want);
       await opts[idx].click();await p.waitForSelector('.sheet #cont');
       ok(await p.isVisible(wrong?'.sheet.bad':'.sheet.good'),label+' feedback sheet '+(wrong?'bad':'good'));
       await p.click('.sheet [data-say]');let r=await p.evaluate(()=>__plays[__plays.length-1]);ok(r.ok&&r.last.endsWith(t.id),label+' sheet replay');
       await p.click('#cont');
     }else if(t.mode==='build'){
       const words=t.it.split(/\s+/).map(w=>w.replace(/[.,!?…;:]/g,''));
       const order=wrong?[...words].reverse():words;
       if(wrong&&words.join()===order.join())order.pop();
       for(const w of order){const tiles=await p.$$('#bank .tile:not(.used)');let hit=null;for(const tl of tiles){if((await tl.textContent())===w){hit=tl;break}}
         ok(!!hit,label+' tile exists '+w);if(hit)await hit.click()}
       // tap-to-remove works
       const placed=await p.$$('#ans .tile');if(placed.length){await placed[placed.length-1].click();ok((await p.$$('#ans .tile')).length===placed.length-1,label+' tile removal');
         const w=order[order.length-1];const tiles=await p.$$('#bank .tile:not(.used)');for(const tl of tiles){if((await tl.textContent())===w){await tl.click();break}}}
       await p.click('#check');await p.waitForSelector('.sheet #cont');
       ok(await p.isVisible(wrong?'.sheet.bad':'.sheet.good'),label+' build verdict '+(wrong?'bad':'good')+' '+t.it);
       await p.click('#cont');
     }else if(t.mode==='recall'){
       await p.click('#flipBtn');await p.waitForTimeout(80);
       ok(await p.$('.flip.flipped'),label+' card flips');
       let r=await p.evaluate(()=>__plays[__plays.length-1]);ok(r&&r.ok&&r.last.endsWith(t.id),label+' flip plays audio');
       await p.click('.face.back [data-slow]');r=await p.evaluate(()=>__plays[__plays.length-1]);ok(r.ok&&r.last.endsWith(t.id+'_slow'),label+' recall slow');
       audioChecks+=2;
       await p.click(wrong?'#no':'#yes');
     }
     if(wrong){wrongs++;const n=await p.evaluate(()=>sess?sess.tasks.length:-1);ok(n===-1||n===t.n+1,label+' miss requeues card')}
     await p.waitForTimeout(15);
   }
   ok(await p.$('.result'),label+' reached result screen');
   const ow=await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1);ok(ow,label+' no horizontal overflow');
   return{wrongs,learns,audioChecks};
 };

 console.log('— playing all',await p.evaluate(()=>LV.length),'levels');
 const nLV=await p.evaluate(()=>LV.length);let totalAudio=0;
 for(let i=0;i<nLV;i++){
   const exp=await p.evaluate(()=>curIndex());ok(exp===i,'current level is '+i+' got '+exp);
   if(i%2)await p.click('#btnGo');else{await p.click(`.node[data-i="${i}"]`)}
   const label='L'+i;const res=await playLevel(label,i%3===0?0:0.25);totalAudio+=res.audioChecks;
   const st=await p.evaluate(k=>S.levels[k],await p.evaluate(i=>LV[i].key,i));ok(st>=1&&st<=3,label+' stars saved '+st);
   if(res.wrongs===0)ok(st===3,label+' perfect gives 3 stars');
   if(i===nLV-1)ok(!(await p.$('#nx')),'no next after final level');
   if(i===4&&await p.$('#nx')){await p.click('#nx');ok(await p.$('.play'),'Next level button starts level');await p.click('#btnQuit');await p.click('#leave')}
   else await p.click('#mp');
   await p.waitForTimeout(30);
 }
 const learned=await p.evaluate(()=>seenCount());ok(learned===150,'all 150 phrases learned, got '+learned);
 console.log('  audio checks',totalAudio,'learned',learned,'coins',await p.evaluate(()=>S.coins));

 // 5. review (make cards due)
 console.log('— review');
 await p.evaluate(()=>{Object.values(S.cards).slice(0,20).forEach(c=>c.d=0);save();renderMap()});
 ok((await p.textContent('#btnRev')).includes('Review'),'review button shows due count');
 await p.click('#btnRev');await playLevel('REV',0.2);await p.click('#mp');

 // 6. quit flow
 await p.click('.node[data-i="0"]');await p.click('#btnQuit');ok(await p.isVisible('#stay'),'quit confirm shows');
 await p.click('#stay');ok(await p.$('.play'),'keep playing stays');await p.click('#btnQuit');await p.click('#leave');ok(await p.$('.hero'),'leave returns to map');

 // 7. settings: theme, voice, switches, name, reset
 console.log('— settings');
 const bg=()=>p.evaluate(()=>getComputedStyle(document.body).backgroundColor);
 await p.emulateMedia({colorScheme:'light'});
 await p.click('#btnSet');
 await p.click('[data-theme-set="dark"]');ok(await bg()==='rgb(12, 15, 30)','dark theme applies');
 await p.click('[data-theme-set="light"]');ok(await bg()==='rgb(237, 241, 250)','light theme applies');
 await p.emulateMedia({colorScheme:'dark'});ok(await bg()==='rgb(237, 241, 250)','light setting beats dark phone');
 await p.click('[data-theme-set="auto"]');ok(await bg()==='rgb(12, 15, 30)','auto follows phone (dark)');
 await p.evaluate(()=>document.documentElement.setAttribute('data-theme','light'));await p.click('[data-theme-set="dark"]');ok(await bg()==='rgb(12, 15, 30)','dark setting beats host light attribute');
 await p.evaluate(()=>document.documentElement.removeAttribute('data-theme'));
 await p.click('.modal [data-voice="m"]');last=await p.evaluate(()=>__plays[__plays.length-1]);ok(last.ok&&/^m_/.test(last.last),'settings voice toggle');
 await p.fill('#nameIn','Marco');
 await p.click('.sw[data-k="sfx"]');ok(await p.evaluate(()=>S.set.sfx===false),'sfx switch');
 await p.click('.sw[data-k="open"]');ok(await p.evaluate(()=>S.set.open===true),'open-all switch');
 await p.click('#reset');ok((await p.textContent('#reset')).includes('again'),'reset asks to confirm');
 await p.click('#reset');ok(await p.evaluate(()=>Object.keys(S.cards).length===0&&S.coins===0),'reset clears progress');
 await p.click('.modal [data-close]');
 ok((await p.textContent('.hero h1')).includes('Marco'),'name change shows on map');
 ok(await p.evaluate(()=>[...document.querySelectorAll('.node')].every(n=>!n.classList.contains('locked'))),'open-all unlocks every node');

 // 8. persistence
 await p.reload();await p.waitForTimeout(300);
 ok(!(await p.$('#welcomeName')),'no welcome after reload');
 ok((await p.textContent('.hero h1')).includes('Marco'),'name persists');
 ok(await bg()==='rgb(12, 15, 30)','theme persists');
 ok(await p.evaluate(()=>S.set.voice==='m'),'voice persists');

 // 9. every play() resolved
 const allPlays=await p.evaluate(()=>__plays);
 const failedPlays=allPlays.filter(x=>x.ok===false);
 console.log('  total play() calls',allPlays.length,'failed',failedPlays.length);
 ok(!failedPlays.length,'no rejected play() '+JSON.stringify(failedPlays.slice(0,3)));
 ok(!errs.length,'no page errors '+errs.slice(0,5).join(' | '));
 // real playback advances
 await p.click('.node[data-i="0"]');await p.waitForTimeout(900);
 const ct=await p.evaluate(()=>document.getElementById('voice-player').currentTime);ok(ct>0.2,'audio actually playing, t='+ct);
 await b.close();
 console.log(`RUN ${run}: ${fails.length?fails.length+' FAILURES':'ALL PASSED'}`);
 process.exit(fails.length?1:0);
})().catch(e=>{console.error('CRASH',e);process.exit(2)});
