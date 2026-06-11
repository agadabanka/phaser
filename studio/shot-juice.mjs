import http from 'node:http'; import fs from 'node:fs'; import path from 'node:path';
import { fileURLToPath } from 'node:url'; import { chromium } from 'playwright';
const ROOT=path.dirname(fileURLToPath(import.meta.url))+'/games/roadwar', SRC=ROOT+'/src';
const MIME={'.html':'text/html','.js':'text/javascript','.png':'image/png','.jpg':'image/jpeg','.json':'application/json','.mp3':'audio/mpeg'};
const s=http.createServer((q,r)=>{let u=decodeURIComponent(q.url.split('?')[0]);if(u==='/')u='/index.html';const f=path.join(SRC,u);if(!f.startsWith(SRC)||!fs.existsSync(f)){r.writeHead(404);return r.end('nf');}r.writeHead(200,{'content-type':MIME[path.extname(f)]||'application/octet-stream'});fs.createReadStream(f).pipe(r);});
await new Promise(r=>s.listen(0,r)); const B=`http://127.0.0.1:${s.address().port}`;
const b=await chromium.launch({headless:true,args:['--no-sandbox','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist']});
const p=await b.newPage({viewport:{width:960,height:540}});
await p.goto(`${B}/?r=webgl`,{waitUntil:'load'}); await p.waitForFunction(()=>window.__ready===true,{timeout:20000});
// drive into the G4 climax (heavy combat) using render steps so particles draw
const info=await p.evaluate(async()=>{ window.__game.reset(); window.__game.autopilot(true); window.__rec.begin();
  let st=window.__game.snapshot(), g4=-1;
  for(let i=0;i<14000;i++){ window.__rec.step(1); st=window.__game.snapshot();
    if(st.level===3 && g4<0) g4=st.frame;
    if(g4>0 && st.frame-g4>1700) break; if(st.won) break; }
  return {level:st.level, units:st.units, depots:st.depots}; });
await p.screenshot({path:ROOT+'/out/juice.png'}); await b.close(); s.close();
console.log('juice.png', JSON.stringify(info));
