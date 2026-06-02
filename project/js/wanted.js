"use strict";
/* =====================================================================
   VERDANT — wanted.js
   A GTA-style wanted system. Crimes (gunning down or running over
   civilians) raise your star level; police officers then hunt you down,
   scaling with the heat. Lie low and the stars cool off.
   ===================================================================== */

const COP_KIT={ skin:[0.8,0.62,0.5], shirt:[0.18,0.26,0.5], pants:[0.12,0.14,0.22], hat:[0.1,0.12,0.2] };

function addWanted(n){
  const before=Game.wanted;
  Game.wanted=clamp(Game.wanted+n,0,5);
  Game.wantedTimer=16;
  if(Game.wanted>before){ updateWantedHUD(); if(Game.wanted===1) toast('⚠ WANTED — POLICE ALERTED');
    else toast('WANTED LEVEL '+Game.wanted); sfx('hurt'); }
}
function updateWantedHUD(){
  const el=$('wanted'); if(!el) return;
  if(Game.wanted<=0){ el.style.opacity='0'; return; }
  el.style.opacity='1';
  let s=''; for(let i=0;i<5;i++) s+='<span class="star'+(i<Game.wanted?' on':'')+'">★</span>';
  el.innerHTML=s;
}

let _copSpawnT=0;
function updateWanted(dt){
  if(Game.wanted>0){
    Game.wantedTimer-=dt;
    if(Game.wantedTimer<=0){ Game.wanted--; Game.wantedTimer=Game.wanted>0?12:0; updateWantedHUD();
      if(Game.wanted===0){ toast('HEAT COOLED OFF'); } }
    _copSpawnT-=dt;
    const target=Game.wanted*2;
    if(Game.police.length<target && _copSpawnT<=0){ spawnCop(); _copSpawnT=1.6; }
    // police cars at wanted >=2, roadblocks at wanted >=3
    if(typeof spawnPoliceCar==='function'){
      const carTarget=Math.max(0,Game.wanted-1);
      if(Game.policeCars.filter(c=>!c.parked).length<carTarget && _copSpawnT<=0){ spawnPoliceCar(); _copSpawnT=2.2; }
      if(Game.wanted>=3 && Game.roadblocks.length<Math.floor(Game.wanted/2) && Math.random()<0.01) spawnRoadblock();
    }
  } else if(Game.policeCars.length){ clearPoliceCars(); }
  updatePolice(dt);
  if(typeof updatePoliceCars==='function') updatePoliceCars(dt);
}

function spawnCop(){
  const a=rand(0,Math.PI*2), dist=rand(30,46);
  let x=clamp(Game.player.position.x+Math.cos(a)*dist,-WORLD+5,WORLD-5);
  let z=clamp(Game.player.position.z+Math.sin(a)*dist,-WORLD+5,WORLD-5);
  const rig=buildHumanoid(Game.scene, COP_KIT, 1.0, Game.settings.shadows, true);
  rig.root.position.set(x,heightAt(x,z),z);
  const hp=70+Game.wanted*18;
  Game.police.push({ rig, body:rig.root, hp, maxHp:hp, speed:3.2+Game.wanted*0.15,
    fireCd:rand(0.8,1.8), phase:rand(0,6), dmg:7+Game.wanted, range:16 });
}
function updatePolice(dt){
  const p=Game.player.position;
  for(const c of Game.police){
    const dx=p.x-c.body.position.x, dz=p.z-c.body.position.z, d=Math.hypot(dx,dz);
    const nx=dx/(d||1), nz=dz/(d||1);
    c.body.rotation.y=Math.atan2(nx,nz);
    let moved=false;
    if(d>c.range){ const bp=c.body.position; bp.x+=nx*c.speed*dt; bp.z+=nz*c.speed*dt; resolveCollision(bp,0.5); moved=true; }
    else { c.fireCd-=dt; if(c.fireCd<=0){ enemyFire(c); c.fireCd=rand(1.0,2.0); } }
    c.body.position.y=heightAt(c.body.position.x,c.body.position.z);
    c.phase+=dt*(moved?11:3);
    animateRig(c.rig, moved, 1, c.phase, true);
  }
}
function damageCop(c,dmg,crit){
  if(c.dead) return; c.hp-=dmg;
  showDamage(new BABYLON.Vector3(c.body.position.x,c.body.position.y+1.9,c.body.position.z),dmg,crit);
  c.rig.mats[1].emissiveColor=new BABYLON.Color3(0.5,0.3,0.1);
  setTimeout(()=>{ if(c.rig.mats[1]) c.rig.mats[1].emissiveColor=new BABYLON.Color3(0,0,0); },70);
  if(c.hp<=0) killCop(c);
}
function killCop(c){
  if(c.dead) return; c.dead=true;
  Game.score+=120; addKillCombo(); sfx('kill');
  if(typeof spawnCashDrop==='function') spawnCashDrop(c.body.position.x,c.body.position.z,40);
  else if(typeof addMoney==='function') addMoney(40);
  if(typeof trackContract==='function') trackContract('kill',1);
  addWanted(1);                       // killing police raises the heat
  Game.police=Game.police.filter(x=>x!==c);
  const root=c.rig.root; let t=0; const dir=Math.random()<0.5?1:-1;
  const iv=setInterval(()=>{ t+=0.04; root.rotation.z=lerp(root.rotation.z,dir*Math.PI/2,0.18);
    root.position.y=heightAt(root.position.x,root.position.z)+lerp(0,-0.6,Math.min(1,t*1.3));
    c.rig.mats.forEach(m=>{ if(m) m.alpha=Math.max(0,1-t*1.2); });
    if(t>=0.85){ clearInterval(iv); root.dispose(false,true); } },24);
}
function clearWanted(){
  Game.wanted=0; Game.wantedTimer=0; updateWantedHUD();
  Game.police.forEach(c=>c.rig.root.dispose(false,true)); Game.police=[];
  if(typeof clearPoliceCars==='function') clearPoliceCars();
}
