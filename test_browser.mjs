import { spawn } from 'child_process';
import puppeteer from 'puppeteer';

const wait=ms=>new Promise(r=>setTimeout(r,ms));
const srv=spawn('python3',['-m','http.server','8077'],{cwd:process.cwd(),stdio:'ignore'});
await wait(1000);

const errors=[], logs=[];
const browser=await puppeteer.launch({
  headless:'new',
  args:['--no-sandbox','--disable-dev-shm-usage','--enable-unsafe-swiftshader',
        '--use-gl=angle','--use-angle=swiftshader','--ignore-gpu-blocklist','--enable-webgl']
});
const page=await browser.newPage();
const isNoise=t=>/CERT_AUTHORITY|ERR_|Failed to load resource|404|net::|favicon|fonts?\.googleapis|gstatic/i.test(t);
page.on('pageerror',e=>{ if(!isNoise(String(e))) errors.push(String(e)); });
page.on('console',m=>{ const t=m.text(); logs.push(t); if(m.type()==='error' && !isNoise(t)) errors.push('console.error: '+t); });

console.log('loading game…');
await page.goto('http://localhost:8077/index.html',{waitUntil:'load',timeout:60000});

// wait for boot to reach the menu
let booted=false;
for(let i=0;i<90;i++){ await wait(1000);
  const st=await page.evaluate(()=>typeof Game!=='undefined'&&Game.state);
  if(st==='menu'){ booted=true; break; }
  if(st==='loading' && i%5===0) process.stdout.write(' …loading('+(await page.evaluate(()=>document.getElementById('loadPct')?.textContent))+')');
}
console.log('\nbooted to menu:', booted);

let pass=0, fail=0;
const ok=(c,m)=>{ if(c){pass++;console.log('  ✓',m);} else {fail++;console.log('  ✗ FAIL:',m);} };

ok(booted, 'game boots to the main menu without hanging');
ok(errors.length===0, 'no JS errors during load'+(errors.length?(' → '+errors.slice(0,3).join(' | ')):''));

if(booted){
  // start a mission and let the loop run a few frames
  await page.evaluate(()=>{ typeof startMission==='function'&&startMission(); });
  await wait(1500);
  const state=await page.evaluate(()=>Game.state);
  ok(state==='playing', 'Start Mission enters playing state');

  // === THE FIRING TEST ===
  const result=await page.evaluate(async ()=>{
    // drop an enemy directly in front of the player, on screen
    const p=Game.player.position, yaw=Game.yaw;
    const fx=Math.sin(yaw), fz=Math.cos(yaw);
    const e=spawnEnemy(Game.scene,false);
    e.boss=false; e.type='grunt'; e.hp=75; e.maxHp=75;
    e.body.position.set(p.x+fx*9, heightAt(p.x+fx*9,p.z+fz*9), p.z+fz*9);
    // let the render loop position the camera & project
    await new Promise(r=>setTimeout(r,300));
    // aim at screen centre and fire like a real click
    Game.aimPx=Game.engine.getRenderWidth()/2;
    Game.aimPy=Game.engine.getRenderHeight()/2;
    const tgt=(typeof screenTarget==='function')?screenTarget(220):null;
    const before=Game.enemies.length;
    const ammoBefore=currentW().ammo;
    tryShoot(performance.now());
    await new Promise(r=>setTimeout(r,100));
    return { hadTarget:!!tgt, before, after:Game.enemies.length,
             ammoBefore, ammoAfter:currentW().ammo, enemyDead:e.dead===true };
  });
  console.log('  fire result:', JSON.stringify(result));
  ok(result.ammoAfter<result.ammoBefore, 'clicking consumes ammo (the gun fires)');
  ok(result.hadTarget, 'aim-assist finds the enemy under the crosshair');
  ok(result.enemyDead || result.after<result.before, 'the shot KILLS the targeted enemy');

  // also verify a real mouse click path kills one
  const clickKill=await page.evaluate(async ()=>{
    const p=Game.player.position, yaw=Game.yaw, fx=Math.sin(yaw), fz=Math.cos(yaw);
    const e=spawnEnemy(Game.scene,false); e.boss=false; e.type='grunt'; e.hp=75; e.maxHp=75;
    e.body.position.set(p.x+fx*8, heightAt(p.x+fx*8,p.z+fz*8), p.z+fz*8);
    await new Promise(r=>setTimeout(r,250));
    Game.aimPx=Game.engine.getRenderWidth()/2; Game.aimPy=Game.engine.getRenderHeight()/2;
    const before=Game.enemies.length;
    window.dispatchEvent(new MouseEvent('mousedown',{button:0}));
    await new Promise(r=>setTimeout(r,120));
    window.dispatchEvent(new MouseEvent('mouseup',{button:0}));
    return { before, after:Game.enemies.length, dead:e.dead===true };
  });
  console.log('  click result:', JSON.stringify(clickKill));
  ok(clickKill.dead || clickKill.after<clickKill.before, 'a real left-click kills the enemy in front');

  // OFF-CENTER auto-aim: enemy ~30° to the side, cursor dead-centre -> still dies
  const offCenter=await page.evaluate(async ()=>{
    const p=Game.player.position, a=Game.yaw+0.5, fx=Math.sin(a), fz=Math.cos(a);
    const e=spawnEnemy(Game.scene,false); e.boss=false; e.type='grunt'; e.hp=75; e.maxHp=75;
    e.body.position.set(p.x+fx*10, heightAt(p.x+fx*10,p.z+fz*10), p.z+fz*10);
    await new Promise(r=>setTimeout(r,250));
    Game.aimPx=Game.engine.getRenderWidth()/2; Game.aimPy=Game.engine.getRenderHeight()/2;
    tryShoot(performance.now());
    await new Promise(r=>setTimeout(r,100));
    return { dead:e.dead===true };
  });
  console.log('  off-center result:', JSON.stringify(offCenter));
  ok(offCenter.dead, 'auto-aim: a click kills an off-center on-screen enemy too');
}

console.log(`\n=== RESULT: ${pass} passed, ${fail} failed ===`);
if(errors.length){ console.log('\nJS errors captured:'); errors.slice(0,8).forEach(e=>console.log('  •',e)); }
await browser.close(); srv.kill('SIGTERM');
process.exit(fail?1:0);
