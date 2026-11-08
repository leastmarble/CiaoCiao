// Pulls the phrase list out of src/app.html so audio generation always matches the app.
const fs=require('fs'),path=require('path');const s=fs.readFileSync(path.join(__dirname,'../src/app.html'),'utf8');
const a=s.indexOf('const WORLDS=');const b=s.indexOf('/* ---------- model');
eval(s.slice(a,b).replace('const WORLDS','global.WORLDS'));const out=[];
WORLDS.forEach((w,wi)=>w.p.forEach((p,pi)=>out.push({id:wi+'-'+pi,it:p[0]})));
fs.writeFileSync(path.join(__dirname,'../audio/phrases.json'),JSON.stringify(out,null,1));console.log(out.length,'phrases');
