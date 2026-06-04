"use strict";
/* =====================================================================
   VERDANT — melee.js   (Phase 2: melee + stealth takedowns)
   A quick knife attack (default Q) that hits the enemy in a frontal cone
   within reach. Crouching turns a kill into a SILENT TAKEDOWN — bonus
   score/XP and no extra noise. Works in single-player, co-op and PvP.
   ===================================================================== */

const MELEE_REACH=2.9, MELEE_CONE=0.2, MELEE_CD=520;
let _lastMelee=0;

/* pure: pick the closest enemy inside a frontal cone within reach */
function frontMeleeTarget(list, px, pz, yaw, reach, cone){
  reach=reach||MELEE_REACH; cone=(cone==null?MELEE_CONE:cone);
  const fx=Math.sin(yaw), fz=Math.cos(yaw);
  let best=null, bestD=reach;
  for(const e of (list||[])){
    if(e.dead) continue;
    const dx=e.body.position.x-px, dz=e.body.position.z-pz, d=Math.hypot(dx,dz);
    if(d>reach || d<0.0001) continue;
    if(((dx/d)*fx+(dz/d)*fz) < cone) continue;      // not in front
    if(d<bestD){ bestD=d; best=e; }
  }
  return best;
}

function meleeSwipeFX(pos){
  const muzzle=(Game.playerRig&&Game.playerRig.gun)?Game.playerRig.gun.getAbsolutePosition():Game.player.position;
  const end=new BABYLON.Vector3(pos.x,pos.y+1.1,pos.z);
  if(typeof spawnTracer==='function') spawnTracer(muzzle,end,[0.95,0.98,1]);
  if(typeof impactSpark==='function') impactSpark(end,true);
}

function meleeAttack(){
  if(Game.state!=='playing'||Game.photo||Game.pvpDead) return;
  const now=performance.now(); if(now-_lastMelee<MELEE_CD) return; _lastMelee=now;
  sfx('throw');   // swipe whoosh

  // PvP — knife another player at close range
  if(typeof isPvP==='function' && isPvP()){
    const t=pvpTarget(3.3); if(t){ netHit(t.id,150,'melee'); meleeSwipeFX(t.pos); sfx('hit'); }
    return;
  }
  // Co-op — knife a server enemy
  if(typeof isCoop==='function' && isCoop()){
    const t=coopTarget(3.3); if(t){ netEHit(t.id,9999); meleeSwipeFX(t.pos); sfx('hit'); }
    return;
  }
  // single-player PvE
  const p=Game.player.position;
  const tgt=frontMeleeTarget(Game.enemies, p.x, p.z, Game.yaw);
  if(!tgt){
    // try a villager in front (loud, raises heat via killVillager)
    const v=frontMeleeTarget((Game.villagers||[]).map(v=>({body:{position:v.rig.root.position},dead:v.dead,_v:v})), p.x,p.z,Game.yaw);
    if(v&&v._v){ meleeSwipeFX(v._v.rig.root.position); sfx('hit'); killVillager(v._v); }
    return;
  }
  meleeSwipeFX(tgt.body.position); sfx('hit');
  const stealth=Game.crouching && !tgt.boss;
  if(tgt.boss){ damageEnemy(tgt,200,false,false); toast('MELEE'); return; }
  damageEnemy(tgt, 99999, false, true);             // routes through killEnemy (score/cash/xp/missions)
  if(stealth){
    const bonus=150; Game.score+=bonus; if(typeof updateHUD==='function') updateHUD();
    if(typeof addXP==='function') addXP(20);
    toast('☠ SILENT TAKEDOWN +'+bonus);
  } else toast('MELEE KILL');
}
