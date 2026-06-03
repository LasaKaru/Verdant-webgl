"use strict";
/* =====================================================================
   VERDANT — coop.js   (Phase 7c: co-op synced waves, client)
   In a 'coop' room the SERVER owns the enemies. This module renders the
   shared enemy snapshot, lets you shoot them (hits go to the server), takes
   melee damage from server events, mirrors the shared wave/score, and feeds
   co-op kills into your XP / missions. Local single-player PvE is untouched.
   ===================================================================== */

function isCoop(){ return Game.net.connected && Game.net.mode==='coop'; }

function setupCoop(){
  Game.coopEnemies=Game.coopEnemies||{};
  clearCoopEnemies();
  if(Game.net.ws && Game.net.ws.readyState===1) Game.net.ws.send(JSON.stringify({t:'coopjoin'}));
  $('objText').textContent='CO-OP SURVIVAL';
  toast('CO-OP — fight the shared horde together');
}
function clearCoopEnemies(){
  for(const id in (Game.coopEnemies||{})){ const e=Game.coopEnemies[id]; e.rig.root.dispose(false,true); if(e.bar) e.bar.remove(); }
  Game.coopEnemies={};
}

/* ------------------------- snapshot sync ------------------------- */
function syncCoopEnemies(m){
  if(!Game.scene) return;
  Game.coopEnemies=Game.coopEnemies||{};
  const seen={};
  for(const ne of m.list){
    seen[ne.id]=1;
    let e=Game.coopEnemies[ne.id];
    if(!e){
      const kit=ENEMY_KITS[ne.type]||ENEMY_KITS.grunt;
      const scale=ne.type==='brute'?1.5:ne.type==='shooter'?0.95:1.05;
      const rig=buildHumanoid(Game.scene,kit,scale,Game.settings.shadows, ne.type==='shooter');
      e={ rig, mesh:rig.root, tx:ne.x, tz:ne.z, hp:ne.hp, mhp:ne.mhp, type:ne.type, phase:rand(0,6), bar:null, scale };
      rig.root.position.set(ne.x,heightAt(ne.x,ne.z),ne.z);
      Game.coopEnemies[ne.id]=e;
    }
    e.tx=ne.x; e.tz=ne.z; e.hp=ne.hp; e.mhp=ne.mhp;
  }
  // remove enemies no longer present
  for(const id in Game.coopEnemies){ if(!seen[id]){ const e=Game.coopEnemies[id]; e.rig.root.dispose(false,true); if(e.bar) e.bar.remove(); delete Game.coopEnemies[id]; } }
  // mirror shared wave / score / count into the HUD
  if(m.wave!=null) $('waveLbl').textContent='WAVE '+String(m.wave).padStart(2,'0');
  if(m.score!=null){ Game.score=m.score; $('scoreLbl').textContent=m.score; }
  $('enemyCount').textContent=m.list.length+(m.toSpawn>0?('+'+m.toSpawn):'');
}
function updateCoop(dt){
  if(!isCoop()) { if(Game.coopEnemies && Object.keys(Game.coopEnemies).length) clearCoopEnemies(); return; }
  const p=Game.player.position, wrap=$('healthbars');
  for(const id in Game.coopEnemies){
    const e=Game.coopEnemies[id], m=e.mesh;
    m.position.x=lerp(m.position.x,e.tx,0.25); m.position.z=lerp(m.position.z,e.tz,0.25);
    m.position.y=heightAt(m.position.x,m.position.z);
    const moved=Math.hypot(e.tx-m.position.x,e.tz-m.position.z)>0.03;
    m.rotation.y=Math.atan2(p.x-m.position.x,p.z-m.position.z);
    e.phase+=dt*(moved?10:3); animateRig(e.rig,moved,1,e.phase,e.type==='shooter');
    // health bar
    if(wrap && Game.settings.healthbars){
      if(!e.bar){ const el=document.createElement('div'); el.className='ehp'; el.innerHTML='<i></i>'; wrap.appendChild(el); e.bar=el; }
      const s=projectToScreen(new BABYLON.Vector3(m.position.x,m.position.y+2.35*e.scale,m.position.z));
      if(s.behind){ e.bar.style.display='none'; }
      else { e.bar.style.display='block'; e.bar.style.left=s.x+'px'; e.bar.style.top=s.y+'px';
        e.bar.firstChild.style.width=Math.max(0,e.hp/e.mhp*100)+'%'; }
    } else if(e.bar){ e.bar.remove(); e.bar=null; }
  }
}

/* nearest co-op enemy to the crosshair (shooting target) */
function coopTarget(maxRange){
  if(!isCoop()) return null;
  const eng=Game.engine, vw=eng.getRenderWidth(), vh=eng.getRenderHeight();
  const ax=(Game.aimPx!=null?Game.aimPx:vw/2), ay=(Game.aimPy!=null?Game.aimPy:vh/2);
  const vp=new BABYLON.Viewport(0,0,vw,vh), mat=Game.scene.getTransformMatrix();
  let best=null,bestId=null,bestPx=Math.max(200,vw*0.20);
  for(const id in Game.coopEnemies){
    const e=Game.coopEnemies[id], m=e.mesh;
    const wp=new BABYLON.Vector3(m.position.x,m.position.y+1.2*e.scale,m.position.z);
    if(BABYLON.Vector3.Distance(Game.camera.position,wp)>(maxRange||9999)) continue;
    const pr=BABYLON.Vector3.Project(wp,BABYLON.Matrix.Identity(),mat,vp);
    if(pr.z<0||pr.z>1) continue;
    const d=Math.hypot(pr.x-ax,pr.y-ay);
    if(d<bestPx){ bestPx=d; best=e; bestId=+id; }
  }
  return best?{id:bestId,pos:best.mesh.position,scale:best.scale}:null;
}
function netEHit(eid,dmg){
  const n=Game.net; if(!n.connected||!n.ws||n.ws.readyState!==1) return;
  n.ws.send(JSON.stringify({t:'ehit',eid,dmg:Math.round(dmg)}));
}

/* ------------------------- server events ------------------------- */
function coopWave(m){
  if(m.cleared){ bigToast('WAVE CLEARED','+'+(m.n*250)+' · regroup'); $('objText').textContent='Regrouping…'; }
  else { bigToast('WAVE '+m.n, (m.count||'')+' hostiles inbound'); sfx('wave'); $('objText').textContent='CO-OP SURVIVAL'; }
}
function coopKill(m){
  if(m.score!=null){ Game.score=m.score; $('scoreLbl').textContent=m.score; }
  if(m.by===Game.net.id){
    const xp=m.etype==='brute'?30:m.etype==='shooter'?18:12;
    if(typeof addXP==='function') addXP(xp);
    if(typeof trackMission==='function') trackMission('kills',1);
    if(typeof evaluateAchievements==='function') evaluateAchievements();
    sfx('kill');
  }
}
function coopEdmg(dmg){ if(typeof damagePlayer==='function') damagePlayer(dmg); }
