import { spawn } from 'child_process';
import puppeteer from 'puppeteer';
const wait=ms=>new Promise(r=>setTimeout(r,ms));
const srv=spawn('python3',['-m','http.server','8077'],{cwd:process.cwd(),stdio:'ignore'});
await wait(800);
const browser=await puppeteer.launch({headless:'new',args:['--no-sandbox','--disable-dev-shm-usage','--enable-unsafe-swiftshader','--use-gl=angle','--use-angle=swiftshader','--ignore-gpu-blocklist','--enable-webgl']});
const page=await browser.newPage();
await page.goto('http://localhost:8077/index.html',{waitUntil:'load',timeout:60000});
for(let i=0;i<60;i++){ await wait(1000); if(await page.evaluate(()=>typeof Game!=='undefined'&&Game.state==='menu')) break; }
await page.evaluate(()=>startMission());
await wait(1500);

let pass=0,fail=0; const ok=(c,m)=>{ if(c){pass++;console.log('  ✓',m);} else{fail++;console.log('  ✗ FAIL:',m);} };
console.log('\n=== FAITHFUL fire test: real wave enemy + real mouse events ===\n');

// wait for a real wave enemy, face it, click with genuine DOM events
const r=await page.evaluate(async ()=>{
  // make sure a wave enemy exists (spawn a couple if the random spawner is slow)
  while(Game.enemies.length<2){ spawnEnemy(Game.scene,false); }
  const e=Game.enemies[0];
  // face the player toward that enemy so it is on screen
  Game.yaw=Math.atan2(e.body.position.x-Game.player.position.x, e.body.position.z-Game.player.position.z);
  await new Promise(r=>setTimeout(r,400));   // let the camera settle
  const before=Game.enemies.length;
  const ammo0=currentW().ammo;
  // genuine cursor move to centre, then a real left click (mousedown+up)
  const cv=document.getElementById('renderCanvas');
  const rect=cv.getBoundingClientRect();
  const cx=rect.left+rect.width/2, cy=rect.top+rect.height/2;
  document.dispatchEvent(new MouseEvent('mousemove',{clientX:cx,clientY:cy,bubbles:true}));
  window.dispatchEvent(new MouseEvent('mousedown',{button:0,clientX:cx,clientY:cy,bubbles:true}));
  await new Promise(r=>setTimeout(r,120));
  window.dispatchEvent(new MouseEvent('mouseup',{button:0,clientX:cx,clientY:cy,bubbles:true}));
  await new Promise(r=>setTimeout(r,150));
  return { before, after:Game.enemies.length, ammo0, ammo1:currentW().ammo, overlay:(typeof overlayOpen==='function'?overlayOpen():'n/a'), photo:Game.photo, pvpDead:Game.pvpDead, weapon:currentW().id };
});
console.log('  result:', JSON.stringify(r));
ok(r.ammo1<r.ammo0, 'a real left-click consumes ammo (handler fires)');
ok(r.after<r.before, 'a real left-click KILLS a real wave enemy');
ok(r.overlay===false && r.photo===false && r.pvpDead===false, 'no overlay/photo/pvp flags blocking input');

console.log(`\n=== RESULT: ${pass} passed, ${fail} failed ===`);
await browser.close(); srv.kill('SIGTERM'); process.exit(fail?1:0);
