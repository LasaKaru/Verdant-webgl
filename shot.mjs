import { spawn } from 'child_process';
import puppeteer from 'puppeteer';
const wait=ms=>new Promise(r=>setTimeout(r,ms));
const srv=spawn('python3',['-m','http.server','8077'],{cwd:process.cwd(),stdio:'ignore'});
await wait(800);
const browser=await puppeteer.launch({headless:'new',args:['--no-sandbox','--disable-dev-shm-usage','--enable-unsafe-swiftshader','--use-gl=angle','--use-angle=swiftshader','--ignore-gpu-blocklist','--enable-webgl','--window-size=1280,720']});
const page=await browser.newPage();
await page.setViewport({width:1280,height:720});
await page.goto('http://localhost:8077/index.html',{waitUntil:'load',timeout:60000});
for(let i=0;i<60;i++){ await wait(1000); if(await page.evaluate(()=>typeof Game!=='undefined'&&Game.state==='menu')) break; }
await page.evaluate(()=>startMission());
await wait(2000);
await page.evaluate(async()=>{
  while(Game.enemies.length<3) spawnEnemy(Game.scene,false);
  const e=Game.enemies[0];
  e.body.position.set(Game.player.position.x+6, heightAt(Game.player.position.x+6,Game.player.position.z+8), Game.player.position.z+8);
  Game.yaw=Math.atan2(e.body.position.x-Game.player.position.x, e.body.position.z-Game.player.position.z);
  Game.time=0.45; // bright daylight
});
await wait(1200);
await page.screenshot({path:'screenshot_v4.png'});
console.log('saved screenshot_v4.png');
await browser.close(); srv.kill('SIGTERM');
