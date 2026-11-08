const {chromium,devices}=require('playwright');const fs=require('fs');const path=require('path');
const DIR=__dirname;
const body=fs.readFileSync(path.join(DIR,'../dist/ciaociao.html'),'utf8');
const SK=`<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><style>:root{color-scheme:light;padding-top:env(safe-area-inset-top,0px);padding-bottom:env(safe-area-inset-bottom,0px)}body{margin:0;font:14px system-ui}img{max-width:100%}[hidden]{display:none!important}</style></head><body>`;
// TARGET=pages tests the GitHub Pages home-screen build (docs/index.html) as served, with no wrapper.
const PAGES=process.env.TARGET==='pages';
if(!PAGES)fs.writeFileSync(path.join(DIR,'_test.html'),SK+body+'</body></html>');
const URL_='file://'+(PAGES?path.join(DIR,'../docs/index.html'):path.join(DIR,'_test.html'));
let fails=[];const ok=(c,m)=>{if(!c){fails.push(m);console.log('  FAIL',m)}};
const run=process.argv[2]||'1';

(async()=>{
 const b=await chromium.launch({args:['--autoplay-policy=user-gesture-required','--use-fake-ui-for-media-stream','--use-fake-device-for-media-stream']});
 const ctx=await b.newContext({...devices['iPhone 13'],permissions:['microphone']});
 const p=await ctx.newPage();const errs=[];
 p.on('pageerror',e=>errs.push('pageerror: '+e.message));
 p.on('console',m=>{if(m.type()==='error'&&!/fonts\.g|ERR_TUNNEL|net::/.test(m.text()))errs.push('console: '+m.text())});
 await p.addInitScript(()=>{window.__plays=[];const orig=HTMLMediaElement.prototype.play;
   HTMLMediaElement.prototype.play=function(){const r={src:this.src,rate:this.playbackRate,last:null,ok:null};window.__plays.push(r);const pr=orig.call(this);
     pr.then(()=>{r.ok=true;r.last=this.dataset.last},e=>{r.ok=false;r.err=e.name});return pr}});
 // wait for a NEW play record (index>=before) to exist and settle (ok!==null), up to 2.5s
 const settle=async(before,ms=2500)=>{const t0=Date.now();let r=null;
   while(Date.now()-t0<ms){r=await p.evaluate(b=>{const a=__plays;return a.length>b?a[a.length-1]:null},before);if(r&&r.ok!==null)return r;await p.waitForTimeout(25)}
   return r||{ok:false,last:'',rate:0,err:'no play() call'}};
 const plays=()=>p.evaluate(()=>__plays.length);
 const archive=[];const reloadPage=async(w=400)=>{archive.push(...await p.evaluate(()=>__plays));await p.reload();await p.waitForTimeout(w)};
 // svg icon centred inside its button (tolerance 2px); returns offenders
 const offCentre=(sel)=>p.evaluate(sel=>[...document.querySelectorAll(sel)].filter(e=>e.offsetParent!==null).map(svg=>{const a=svg.getBoundingClientRect(),b=svg.parentElement.getBoundingClientRect();
   return{dx:Math.abs((a.left+a.width/2)-(b.left+b.width/2)),dy:Math.abs((a.top+a.height/2)-(b.top+b.height/2)),w:a.width}}).filter(o=>o.w>0&&(o.dx>2||o.dy>2)),sel);
 await p.goto(URL_);await p.waitForTimeout(400);

 // 1. welcome
 console.log('run',run,'— welcome');
 ok(await p.isVisible('#welcomeName'),'welcome screen shows first');
 ok(!(await p.content()).includes('Mark'),'no hard-coded Mark');
 ok(await p.isDisabled('#welcomeGo'),'start disabled with empty name');
 await p.fill('#welcomeName','   ');ok(await p.isDisabled('#welcomeGo'),'start disabled for whitespace-only name');
 await p.press('#welcomeName','Enter');await p.waitForTimeout(100);ok(await p.isVisible('#welcomeName'),'Enter with blank name does not advance');
 ok(await p.evaluate(()=>!S.name),'blank name not saved');
 // Enter key submits; step 2 is the "why" screen
 await p.fill('#welcomeName','Anna');await p.press('#welcomeName','Enter');await p.waitForTimeout(200);
 ok(!(await p.$('#welcomeName')),'Enter in name field leaves the name step');
 ok(await p.evaluate(()=>S.name==='Anna'&&!S.why),'name saved, why still empty');
 ok((await p.textContent('h1')).includes("Perch"),'why screen shows after name');
 ok((await p.$$('[data-why]')).length===4,'why screen has 4 options');
 ok(await p.isVisible('#whySkip'),'why screen has a skip link');
 ok(!(await p.$('.hero')),'map is not rendered until why is chosen');
 await reloadPage();ok((await p.$$('[data-why]')).length===4&&!(await p.$('.hero')),'why screen persists across reload (name saved, why missing)');
 const whys=await p.evaluate(()=>WHYS.map(w=>[w[0],w[1]]));
 ok(whys.map(w=>w[0]).join()==='business,travel,family,culture','why options are business, travel, family, culture');
 await p.click('[data-why="family"]');await p.waitForTimeout(150);
 ok(await p.evaluate(()=>S.why==='family'),'choosing family stores S.why');
 ok((await p.textContent('.hero h1')).includes('Anna'),'map greets Anna after why');
 ok((await p.textContent('.hero .why')).includes('Family & friends'),'hero shows the chosen why label');
 await reloadPage();ok((await p.textContent('.hero .why')).includes('Family & friends'),'chosen why persists after reload');
 // fresh profile: button path + skip
 await p.evaluate(()=>localStorage.clear());await reloadPage();
 ok(await p.isVisible('#welcomeName'),'welcome again after clearing storage');
 await p.fill('#welcomeName','Giulia');ok(await p.isEnabled('#welcomeGo'),'start enabled once name typed');await p.click('#welcomeGo');await p.waitForTimeout(200);
 ok(await p.isVisible('#whySkip'),'button path also reaches the why step');
 await p.click('#whySkip');await p.waitForTimeout(150);
 ok(await p.evaluate(()=>S.why==='skip'&&S.name==='Giulia'),'skip stores S.why="skip"');
 ok(!(await p.$('.hero .why')),'no why line on the hero when skipped');
 ok((await p.textContent('.hero h1')).includes('Giulia'),'greets entered name');
 ok(!(await p.textContent('.hero h1')).includes('Mark'),'greeting has no hard-coded Mark');
 await reloadPage();ok(!!(await p.$('.hero'))&&await p.evaluate(()=>S.why==='skip'),'skip persists: map shows after reload');

 // 1a. content wiring: phrases, scenes
 const wiring=await p.evaluate(()=>{const first=WORLDS[0].p.slice(0,5).map(x=>x[0]);const bad=[];let them=0,you=0;
   if(SCENES.length!==WORLDS.length)bad.push('scenes '+SCENES.length);
   SCENES.forEach((sc,wi)=>sc.turns.forEach(([w,it])=>{const id=BYIT[it];if(!id){bad.push('unresolved '+wi+': '+it);return}
     if(!AUD['f_'+id]||!AUD['m_'+id])bad.push('no audio '+id);if(w==='t')them++;else if(w==='y')you++;else bad.push('bad who '+w)}));
   return{first,bad,them,you,cards:CARDS.length,lv0:LV[0].ids.length}});
 ok(wiring.first.join('|')==="Parla italiano?|Sì, parlo italiano.|Non capisco.|Quanto costa?|Ce l'ha?",'world 1 starts with the five core phrases: '+wiring.first.join('|'));
 ok(!wiring.bad.length,'every SCENES turn resolves to a card with both voices '+JSON.stringify(wiring.bad.slice(0,5)));
 ok(wiring.them>=8&&wiring.you>=8&&wiring.cards===150,'scenes have partner and learner lines; 150 cards');
 // 1b. map worlds render with real height at iPhone size (flex-shrink collapse regression)
 const geo=await p.evaluate(()=>{const vw=innerWidth;return[...document.querySelectorAll('.world')].map(w=>{const r=w.getBoundingClientRect();const nodes=[...w.querySelectorAll('.node')].map(n=>n.getBoundingClientRect());
   return{h:r.height,w:r.width,nn:nodes.length,nodesOk:nodes.every(n=>n.width>=60&&n.height>=60&&n.left>=-1&&n.right<=vw+1),inside:nodes.every(n=>n.top>=r.top-1&&n.bottom<=r.bottom+1)}})});
 console.log('  worlds',geo.length,'min height',Math.min(...geo.map(g=>g.h)));
 ok(geo.length===await p.evaluate(()=>WORLDS.length),'one .world per WORLDS entry, got '+geo.length);
 ok(geo.every(g=>g.h>=300),'every world has substantial height (>=300px): '+JSON.stringify(geo.map(g=>Math.round(g.h)).slice(0,8)));
 ok(geo.every(g=>g.w>=300&&g.nn>=2&&g.nodesOk&&g.inside),'world nodes sized, on-screen and inside their world');
 ok(await p.evaluate(()=>{const s=document.getElementById('scroll');return s.scrollHeight>s.clientHeight*3}),'map scroll content is tall (worlds not collapsed)');

 ok(!(await offCentre('.node > svg')).length,'map node icons (lock/crown) centred: '+JSON.stringify(await offCentre('.node > svg')));
 ok(!(await offCentre('.icon-btn > svg')).length,'top-bar icon buttons centred: '+JSON.stringify(await offCentre('.icon-btn > svg')));

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
 let n0=await plays();await p.click('.hero [data-voice="m"]');
 let last=await settle(n0);
 ok(last&&last.ok&&/^m_/.test(last.last),'map Uomo toggle plays male clip '+JSON.stringify(last));
 n0=await plays();await p.click('.hero [data-voice="f"]');
 last=await settle(n0);
 ok(last&&last.ok&&/^f_/.test(last.last),'map Donna toggle plays female clip');

 // 4. play every level through
 const cov={them:0,you:0,huh:0,no:0,rec:0};
 let echoFull=false,recDone=false,iconsPlay=false,iconsListen=false;
 const playLevel=async(label,wrongRate)=>{
   let guard=0,wrongs=0,learns=0,audioChecks=0;
   while(guard++<250){
     if(await p.$('.result'))break;
     const t=await p.evaluate(()=>{const t=sess.tasks[sess.i];return{mode:t.mode,it:t.c.it,en:t.c.en,id:t.c.id,n:sess.tasks.length,att:t.att}});
     const wrong=t.mode!=='learn'&&Math.random()<wrongRate;
     const before=await p.evaluate(()=>__plays.length);
     if(t.mode==='learn'){
       learns++;
       let r=await settle(before-1);
       ok(r&&r.ok&&r.last&&r.last.endsWith(t.id)&&r.rate===1,label+' learn autoplay '+t.id+' '+JSON.stringify(r));
       let n;
       if(!iconsPlay){iconsPlay=true;const o=await offCentre('.echo-btn > svg');ok(!o.length,'echo button icon centred '+JSON.stringify(o))}
       if(!echoFull){echoFull=true;
         // one full echo round: clip ends -> "Your turn" gap -> a dot lights -> next round auto-plays
         n=await plays();
         try{await p.waitForSelector('.echo.turn',{timeout:8000})}catch(e){}
         ok(await p.isVisible('.echo.turn'),'echo: "Your turn" state appears after the clip ends');
         ok((await p.textContent('#echoMsg')).includes('Your turn'),'echo: message says Your turn');
         try{await p.waitForFunction(()=>document.querySelectorAll('.dots i.on').length>=1,null,{timeout:12000})}catch(e){}
         ok(await p.evaluate(()=>document.querySelectorAll('.dots i.on').length)>=1,'echo: a progress dot turns on after the gap');
         r=await settle(n);
         ok(r.ok&&r.last&&r.last.endsWith(t.id)&&r.rate===1,'echo: next round plays automatically '+JSON.stringify(r));
         ok(await p.evaluate(()=>document.querySelectorAll('.dots i').length)===3,'echo: three round dots');
         audioChecks+=2;
       }
       if(!recDone){recDone=true;cov.rec++;
         ok(await p.isVisible('#recBtn'),'record button is offered');
         await p.click('#recBtn');
         try{await p.waitForSelector('#recBtn.rec',{timeout:3000})}catch(e){}
         ok(await p.evaluate(()=>!!recState),'recording started (MediaRecorder active)');
         ok((await p.textContent('#recBtn')).includes('Stop'),'record button turns into Stop');
         await p.waitForTimeout(900);n=await plays();await p.click('#recBtn');
         r=await settle(n);
         ok(r.ok&&r.last==='rec','recording plays back right after stop, dataset.last=rec '+JSON.stringify(r));
         const voice=await p.evaluate(()=>S.set.voice);
         let got=true;try{await p.waitForFunction(({n,id,voice})=>__plays.slice(n).some(x=>x.ok&&x.last===voice+'_'+id),{n,id:t.id,voice},{timeout:12000})}catch(e){got=false}
         ok(got,'native clip plays after the recording ends (record-and-compare)');
         ok((await p.textContent('#recBtn')).includes('again'),'record button offers Record again');
         ok(await p.evaluate(()=>recState===null),'recorder released after stop');
         audioChecks+=2;
       }
       n=await plays();await p.click('.card [data-say]');
       r=await settle(n);
       ok(r.ok&&r.last.endsWith(t.id)&&r.rate===1,label+' Listen button plays '+t.id+' '+JSON.stringify(r));
       n=await plays();await p.click('.card [data-slow]');
       r=await settle(n);
       ok(r.ok&&r.last.endsWith(t.id+'_slow')&&Math.abs(r.rate-0.7)<.01,label+' Slow button plays slow '+t.id+' '+JSON.stringify(r));
       audioChecks+=3;
       await p.click('#next');
     }else if(t.mode==='them'){cov.them++;
       const vNow=await p.evaluate(()=>S.set.voice),pv=vNow==='f'?'m':'f';
       let r=await settle(before-1);
       ok(r&&r.ok&&r.last.startsWith(pv+'_')&&r.last.endsWith(t.id)&&r.rate===1,label+' partner line autoplays in the OPPOSITE voice ('+pv+' vs '+vNow+') '+JSON.stringify(r));
       ok(!(await p.isVisible('#themEn')),label+' English hidden until asked');
       const log0=await p.evaluate(()=>sess.log.length),c0=await p.evaluate(()=>S.coins);
       if(wrong){cov.huh++;const n=await plays();await p.click('#huh');r=await settle(n);
         ok(r.ok&&r.last.startsWith(pv+'_')&&r.last.endsWith(t.id+'_slow')&&Math.abs(r.rate-0.7)<.01,label+' Didn\'t catch it plays slow in partner voice '+JSON.stringify(r));
         ok(await p.isVisible('#themEn'),label+' English shown after Didn\'t catch it');wrongs++;audioChecks++}
       await p.click('#ok');
       const after=await p.evaluate(()=>({c:S.coins,l:sess?sess.log.length:-1,done:!sess}));
       if(!after.done)ok(after.l===log0+1,label+' partner line added to chat log');
       if(!wrong)ok(after.c-c0===5,label+' unhelped Capito gives +5 coins, got '+(after.c-c0));
       else ok(after.c===c0,label+' helped Capito gives no coins');
       audioChecks++;
     }else if(t.mode==='you'){cov.you++;
       const vNow=await p.evaluate(()=>S.set.voice);
       ok(!(await p.isVisible('#youIt')),label+' Italian hidden until reveal');
       ok((await p.textContent('#cue')).includes(t.en),label+' cue shows the English prompt');
       const log0=await p.evaluate(()=>sess.log.length);
       let n=await plays();await p.click('#reveal');let r=await settle(n);
       ok(r.ok&&r.last===vNow+'_'+t.id&&r.rate===1,label+' reveal plays the line in your voice '+JSON.stringify(r));
       ok(await p.isVisible('#youIt'),label+' Italian shown after reveal');audioChecks++;
       if(wrong){cov.no++;await p.click('#no');wrongs++;
         const st=await p.evaluate(()=>({same:sess.tasks[sess.i].c.id,mode:sess.tasks[sess.i].mode,att:sess.tasks[sess.i].att,len:sess.tasks.length,log:sess.log.length}));
         ok(st.same===t.id&&st.mode==='you'&&st.att===t.att+1,label+' #no re-asks the SAME line next '+JSON.stringify(st)+' want '+t.id);
         ok(st.len===t.n+1,label+' requeued exactly once');
         ok(st.log===log0,label+' missed line is not added to the chat log');
       }else{await p.click('#yes');
         const l=await p.evaluate(()=>sess?sess.log.length:-1);if(l!==-1)ok(l===log0+1,label+' successful line added to chat log');}
     }else if(t.mode==='choice'||t.mode==='listen'){
       if(t.mode==='listen'){
         if(!iconsListen){iconsListen=true;const o=await offCentre('.bigspk > svg');ok(!o.length,'big speaker icon centred '+JSON.stringify(o))}
         let r=await settle(before-1);ok(r&&r.ok&&r.last.endsWith(t.id),label+' listen autoplay '+JSON.stringify(r));
         let n=await plays();await p.click('.bigspk');r=await settle(n);ok(r.ok&&r.last.endsWith(t.id)&&r.rate===1,label+' listen big button '+JSON.stringify(r));
         n=await plays();await p.click('.slowspk');
         r=await settle(n);ok(r.ok&&r.last.endsWith(t.id+'_slow')&&Math.abs(r.rate-0.7)<.01,label+' listen SLOW button '+JSON.stringify(r));audioChecks+=3;
       }
       const want=t.mode==='choice'?t.it:t.en;
       const opts=await p.$$('.opt');ok(opts.length===4,label+' 4 options');
       const texts=await Promise.all(opts.map(o=>o.textContent()));
       ok(texts.filter(x=>x===want).length===1,label+' exactly one correct option');
       const idx=wrong?texts.findIndex(x=>x!==want):texts.indexOf(want);
       await opts[idx].click();await p.waitForSelector('.sheet #cont');
       ok(await p.isVisible(wrong?'.sheet.bad':'.sheet.good'),label+' feedback sheet '+(wrong?'bad':'good'));
       let n=await plays();await p.click('.sheet [data-say]');let r=await settle(n);ok(r.ok&&r.last.endsWith(t.id),label+' sheet replay '+JSON.stringify(r));
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
       await p.click('#flipBtn');
       ok(await p.$('.flip.flipped'),label+' card flips');
       let r=await settle(before);ok(r&&r.ok&&r.last.endsWith(t.id),label+' flip plays audio '+JSON.stringify(r));
       let n=await plays();await p.click('.face.back [data-slow]');r=await settle(n);ok(r.ok&&r.last.endsWith(t.id+'_slow'),label+' recall slow '+JSON.stringify(r));
       audioChecks+=2;
       await p.click(wrong?'#no':'#yes');
     }else{ok(false,label+' unknown task mode '+t.mode);break}
     if(wrong&&['choice','listen','build','recall'].includes(t.mode)){wrongs++;const n=await p.evaluate(()=>sess?sess.tasks.length:-1);ok(n===-1||n===t.n+1,label+' miss requeues card')}
     await p.waitForTimeout(15);
   }
   ok(await p.$('.result'),label+' reached result screen');
   const ow=await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1);ok(ow,label+' no horizontal overflow');
   return{wrongs,learns,audioChecks};
 };

 console.log('— playing all',await p.evaluate(()=>LV.length),'levels');
 const nLV=await p.evaluate(()=>LV.length);let totalAudio=0;
 let bossesCleared=0;
 for(let i=0;i<nLV;i++){
   const exp=await p.evaluate(()=>curIndex());ok(exp===i,'current level is '+i+' got '+exp);
   const lvInfo=await p.evaluate(i=>({type:LV[i].type,wi:LV[i].wi,key:LV[i].key,ids:LV[i].ids.length}),i);
   const isBoss=lvInfo.type==='boss';
   if(isBoss){ // alternate the learner's voice so both partner directions are exercised
     const want=lvInfo.wi%2?'m':'f';
     if(await p.evaluate(()=>S.set.voice)!==want){const n=await plays();await p.click(`.hero [data-voice="${want}"]`);await settle(n)}
   }
   if(i%2)await p.click('#btnGo');else{await p.click(`.node[data-i="${i}"]`)}
   const label='L'+i+(isBoss?'(boss)':'');
   const hasScene=await p.evaluate(()=>!!sess.scene);ok(hasScene===isBoss,label+' boss levels (and only they) are conversations');
   if(isBoss){ok(await p.isVisible('.chip:has-text("Conversation")'),label+' conversation chip shows');
     ok(await p.evaluate(()=>sess.tasks.every(t=>t.mode==='them'||t.mode==='you')),label+' boss tasks are only them/you')}
   else{const modes=await p.evaluate(()=>sess.tasks.map(t=>t.mode));
     const newBuild=await p.evaluate(()=>sess.tasks.filter(t=>t.mode==='build'&&LV[sess.li].ids.includes(t.c.id)).length);
     ok(newBuild===0,label+' no build task for the level\'s new cards');
     const lrn=await p.evaluate(()=>sess.tasks.filter(t=>t.mode==='learn').map(t=>t.c.id));
     ok(lrn.every(id=>true)&&modes.slice(0,1)[0]!=='recall','new-card levels do not open with recall')}
   const res=await playLevel(label,i%3===0?0:0.25);totalAudio+=res.audioChecks;
   const st=await p.evaluate(k=>S.levels[k],lvInfo.key);ok(st>=1&&st<=3,label+' stars saved '+st);
   if(res.wrongs===0)ok(st===3,label+' perfect gives 3 stars');
   if(i===nLV-1)ok(!(await p.$('#nx')),'no next after final level');
   // missions
   if(isBoss){
     bossesCleared++;
     ok(await p.isVisible('.result .mission [data-mission]'),label+' boss result shows the mission');
     ok(await p.isEnabled('.result [data-mission]'),label+' mission button enabled before completing');
     if(lvInfo.wi===0){
       const c0=await p.evaluate(()=>S.coins);await p.click('.result [data-mission]');
       let c1=await p.evaluate(()=>S.coins);ok(c1===c0+50,'mission gives +50 coins once, got '+(c1-c0));
       ok(await p.evaluate(()=>S.missions[0]===true),'mission stored');
       ok(await p.isDisabled('.result [data-mission]'),'mission button disables after completion');
       await p.evaluate(()=>document.querySelector('.result [data-mission]').click());
       ok(await p.evaluate(c=>S.coins===c,c1),'second mission click does not pay again');
       await p.click('#mp');await p.waitForTimeout(100);
       ok(await p.isDisabled('[data-mission="0"]'),'world card mission is complete/disabled on the map');
       await reloadPage();
       ok(await p.evaluate(c=>S.coins===c&&S.missions[0]===true,c1),'mission and +50 coins persist after reload');
       ok(await p.isDisabled('[data-mission="0"]'),'mission stays complete after reload');
       ok((await p.textContent('[data-mission="0"]')).includes('complete'),'mission button reads complete');
     }else if(lvInfo.wi===1){
       await p.click('#mp');await p.waitForTimeout(100);
       const c0=await p.evaluate(()=>S.coins);await p.click('.world .mission [data-mission="1"]');
       ok(await p.evaluate(c=>S.coins===c+50&&S.missions[1]===true,c0),'mission tapped from the map world card gives +50');
       ok(await p.isDisabled('[data-mission="1"]'),'map mission disables after tap');
     }else await p.click('#mp');
     await p.waitForTimeout(50);
     ok((await p.$$('.world .mission')).length===bossesCleared,'a mission card appears for each cleared boss ('+bossesCleared+')');
   }else{
     ok(!(await p.$('.result .mission')),label+' non-boss result has no mission');
     if(i===4&&await p.$('#nx')){await p.click('#nx');ok(await p.$('.play'),'Next level button starts level');await p.click('#btnQuit');await p.click('#leave')}
     else await p.click('#mp');
   }
   await p.waitForTimeout(30);
 }
 const learned=await p.evaluate(()=>seenCount());ok(learned===150,'all 150 phrases learned, got '+learned);
 console.log('  coverage',JSON.stringify(cov),'echoFull',echoFull,'bosses',bossesCleared);
 ok(cov.them>20&&cov.you>20&&cov.huh>0&&cov.no>0&&cov.rec===1&&echoFull,'scene/echo/record paths were all exercised '+JSON.stringify(cov));
 console.log('  audio checks',totalAudio,'learned',learned,'coins',await p.evaluate(()=>S.coins));

 // 5. review (make cards due)
 console.log('— review');
 await p.evaluate(()=>{Object.values(S.cards).slice(0,20).forEach(c=>c.d=0);save();renderMap()});
 ok((await p.textContent('#btnRev')).includes('Review'),'review button shows due count');
 await p.click('#btnRev');await playLevel('REV',0.2);await p.click('#mp');

 // 6. quit flow (also: leaving mid-recording must release the microphone and stop audio)
 await p.evaluate(()=>{LV[0].ids.forEach(id=>delete S.cards[id]);save()});
 await p.click('.node[data-i="0"]');ok(await p.isVisible('#recBtn'),'new-card level shows the echo drill with record button');
 await p.click('#recBtn');await p.waitForSelector('#recBtn.rec');
 await p.click('#btnQuit');ok(await p.isVisible('#stay'),'quit confirm shows');
 await p.click('#stay');ok(await p.$('.play'),'keep playing stays');ok(await p.evaluate(()=>!!recState),'keep playing does not interrupt recording');
 await p.click('#btnQuit');await p.click('#leave');ok(await p.$('.hero'),'leave returns to map');
 await p.waitForTimeout(300);
 ok(await p.evaluate(()=>recState===null),'leaving mid-recording stops the recorder (mic released)');
 ok(await p.evaluate(()=>getPlayer().paused),'leaving a level silences the player');

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
 await p.evaluate(()=>document.documentElement.setAttribute('data-theme','dark'));await p.click('[data-theme-set="light"]');ok(await bg()==='rgb(237, 241, 250)','light setting beats host dark attribute (phone dark)');
 await p.emulateMedia({colorScheme:'light'});ok(await bg()==='rgb(237, 241, 250)','light setting, phone light, host dark');
 await p.click('[data-theme-set="dark"]');ok(await bg()==='rgb(12, 15, 30)','dark setting beats light phone');
 await p.click('[data-theme-set="auto"]');await p.evaluate(()=>document.documentElement.removeAttribute('data-theme'));ok(await bg()==='rgb(237, 241, 250)','auto follows phone (light)');
 await p.emulateMedia({colorScheme:'dark'});ok(await bg()==='rgb(12, 15, 30)','auto follows phone live change to dark');
 ok(await p.evaluate(()=>[...document.querySelectorAll('[data-theme-set]')].map(b=>b.textContent+':'+b.getAttribute('aria-pressed')).join()==='Auto:true,Light:false,Dark:false'),'theme segmented control shows Auto/Light/Dark with Auto pressed');
 await p.click('[data-theme-set="dark"]');await p.evaluate(()=>document.documentElement.setAttribute('data-theme','light'));await p.click('[data-theme-set="dark"]');
 await p.evaluate(()=>document.documentElement.removeAttribute('data-theme'));
 n0=await plays();await p.click('.modal [data-voice="m"]');last=await settle(n0);ok(last.ok&&/^m_/.test(last.last),'settings voice toggle');
 await p.fill('#nameIn','Marco');
 await p.click('.sw[data-k="sfx"]');ok(await p.evaluate(()=>S.set.sfx===false),'sfx switch');
 await p.click('.sw[data-k="open"]');ok(await p.evaluate(()=>S.set.open===true),'open-all switch');
 await p.click('#reset');ok((await p.textContent('#reset')).includes('again'),'reset asks to confirm');
 await p.click('#reset');ok(await p.evaluate(()=>Object.keys(S.cards).length===0&&S.coins===0),'reset clears progress');
 await p.click('.modal [data-close]');
 ok((await p.textContent('.hero h1')).includes('Marco'),'name change shows on map');
 ok(await p.evaluate(()=>[...document.querySelectorAll('.node')].every(n=>!n.classList.contains('locked'))),'open-all unlocks every node');

 // 8. persistence
 await reloadPage(300);
 ok(!(await p.$('#welcomeName')),'no welcome after reload');
 ok((await p.textContent('.hero h1')).includes('Marco'),'name persists');
 ok(await bg()==='rgb(12, 15, 30)','theme persists');
 ok(await p.evaluate(()=>S.set.voice==='m'),'voice persists');

 // 9. every play() resolved
 const allPlays=archive.concat(await p.evaluate(()=>__plays));
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
