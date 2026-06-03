"use strict";
/* =====================================================================
   VERDANT — features.js
   Floating damage numbers, kill-streak combo multiplier, boss waves +
   boss health bar, sniper scope overlay, and the spawn resupply pad.
   ===================================================================== */

/* ------------------------- world→screen projection ------------------------- */
function projectToScreen(v){
  const e=Game.engine, cam=Game.camera;
  const p=BABYLON.Vector3.Project(v, BABYLON.Matrix.Identity(), Game.scene.getTransformMatrix(),
    new BABYLON.Viewport(0,0,e.getRenderWidth(),e.getRenderHeight()));
  const canvas=$('renderCanvas');
  const sc=canvas.clientWidth/e.getRenderWidth();
  return { x:p.x*sc, y:p.y*sc, behind:p.z<0||p.z>1 };
}

/* ------------------------- floating damage numbers ------------------------- */
function showDamage(worldPos, amount, crit){
  const s=projectToScreen(worldPos); if(s.behind) return;
  const d=document.createElement('div');
  d.className='dmgnum'+(crit?' crit':'');
  d.textContent=(crit?'✦ ':'')+Math.round(amount);
  d.style.left=s.x+'px'; d.style.top=s.y+'px';
  $('floaters').appendChild(d);
  requestAnimationFrame(()=>{ d.style.transform='translate(-50%,-150%)'; d.style.opacity='0'; });
  setTimeout(()=>d.remove(),760);
}

/* ------------------------- kill combo ------------------------- */
function addKillCombo(){
  Game.combo.count++; Game.combo.timer=3.4;
  Game.combo.mult=Math.min(6, 1+Math.floor(Game.combo.count/2));
  updateComboHUD();
}
function updateCombo(dt){
  if(Game.combo.timer>0){ Game.combo.timer-=dt;
    if(Game.combo.timer<=0){ Game.combo.count=0; Game.combo.mult=1; updateComboHUD(); } }
}
function updateComboHUD(){
  const el=$('combo'); if(!el) return;
  if(Game.combo.mult>1){ el.style.opacity='1';
    el.querySelector('.cm').textContent='x'+Game.combo.mult;
    el.querySelector('.cc').textContent=Game.combo.count+' KILL STREAK'; }
  else el.style.opacity='0';
}
function resetCombo(){ Game.combo={count:0,mult:1,timer:0}; updateComboHUD(); }

/* ------------------------- boss ------------------------- */
const BOSS_NAMES=['THE WARLORD','CRIMSON BRUTE','THE BEHEMOTH','DREAD COLOSSUS','THE RAVAGER'];
function spawnBoss(){
  const a=rand(0,Math.PI*2), dist=48;
  let x=clamp(Game.player.position.x+Math.cos(a)*dist,-WORLD+6,WORLD-6);
  let z=clamp(Game.player.position.z+Math.sin(a)*dist,-WORLD+6,WORLD-6);
  const rig=buildHumanoid(Game.scene, ENEMY_KITS.brute, 2.5, Game.settings.shadows, false);
  rig.root.position.set(x,heightAt(x,z),z);
  rig.mats[1].emissiveColor=new BABYLON.Color3(0.4,0.05,0.05);
  const hp=1200+Game.wave*260;
  const e={ rig, type:'boss', boss:true, body:rig.root, hp, maxHp:hp,
    speed:2.0+Game.wave*0.05, atkCd:0, fireCd:0, phase:0, dmg:30+Game.wave, range:2.8 };
  Game.enemies.push(e); Game.boss=e;
  const bb=$('bossbar'); bb.classList.add('show');
  $('bossName').textContent=BOSS_NAMES[(Game.wave/5-1)%BOSS_NAMES.length|0]||'THE WARLORD';
  bigToast('⚠ BOSS INCOMING', $('bossName').textContent+' approaches'); sfx('explode');
}
function updateBossBar(){
  const bb=$('bossbar'); if(!bb) return;
  if(Game.boss && Game.enemies.includes(Game.boss) && !Game.boss.dead){
    bb.classList.add('show'); $('bossFill').style.width=Math.max(0,Game.boss.hp/Game.boss.maxHp*100)+'%';
  } else { bb.classList.remove('show'); }
}

/* ------------------------- sniper scope ------------------------- */
function updateScope(){
  const on = Game.state==='playing' && Game.aiming && currentW().zoom && !Game.inVehicle;
  const sc=$('scope'), ch=$('crosshair');
  if(sc) sc.style.display=on?'block':'none';
  if(ch) ch.style.visibility=on?'hidden':'visible';
}

/* ------------------------- resupply pad ------------------------- */
function updateResupply(dt){
  if(Game.state!=='playing'){ return; }
  const p=Game.player.position, d=Math.hypot(p.x,p.z), on=d<4.5 && !Game.inVehicle;
  if(Game.spawnPad){ Game.spawnPad.material.emissiveColor = on
    ? new BABYLON.Color3(0.25,0.95,0.6) : new BABYLON.Color3(0.1,0.5,0.4); }
  if(on && !Game._wasOnPad) toast('RESUPPLY ZONE — RESTOCKING');
  Game._wasOnPad=on;
  if(on){
    if(Game.playerData.hp<(Game.maxHP||100)){ Game.playerData.hp=Math.min(Game.maxHP||100,Game.playerData.hp+14*dt); refreshHP(); }
    Game.resupplyT+=dt;
    if(Game.resupplyT>0.55){ Game.resupplyT=0;
      const w=currentW(); w.reserve+=5; refreshAmmoHUD();
      if(Game.grenadeCount<3 && Math.random()<0.3){ Game.grenadeCount++; updateGrenadeHUD(); }
    }
  }
}
