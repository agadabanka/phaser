import http from 'node:http'; import fs from 'node:fs'; import path from 'node:path';
import { fileURLToPath } from 'node:url'; import { chromium } from 'playwright';
const ROOT='/home/user/phaser/studio/games/roadwar', SRC=path.join(ROOT,'src');
const MIME={'.html':'text/html','.js':'text/javascript','.png':'image/png','.jpg':'image/jpeg','.json':'application/json','.mp3':'audio/mpeg'};
const server=http.createServer((q,r)=>{let u=decodeURIComponent(q.url.split('?')[0]);if(u==='/')u='/index.html';const f=path.join(SRC,u);if(!f.startsWith(SRC)||!fs.existsSync(f)){r.writeHead(404);return r.end('nf');}r.writeHead(200,{'content-type':MIME[path.extname(f)]||'application/octet-stream'});fs.createReadStream(f).pipe(r);});
await new Promise(r=>server.listen(0,r)); const BASE=`http://127.0.0.1:${server.address().port}`;
const b=await chromium.launch({headless:true,args:['--no-sandbox','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist']});
const p=await b.newPage({viewport:{width:960,height:540}});
await p.goto(`${BASE}/?r=webgl`,{waitUntil:'load'}); await p.waitForFunction(()=>window.__ready===true,{timeout:20000});
// drive the autopilot to G5, then ~35s in (the boss is at t32)
const info = await p.evaluate(async ()=>{
  window.__game.reset(); window.__game.autopilot(true); window.__rec.begin();
  let s=window.__game.snapshot(), g5start=-1;
  for(let i=0;i<14000;i++){ window.__rec.step(1); s=window.__game.snapshot();
    if(s.level===4 && g5start<0) g5start=s.frame;
    if(g5start>0 && s.frame-g5start>2050) break;
    if(s.won) break; }
  return { level:s.level, frame:s.frame, fortressHp:s.fortressHp };
});
await p.screenshot({ path: path.join(ROOT,'out','boss.png') });
await b.close(); server.close(); console.log('boss.png', JSON.stringify(info));
