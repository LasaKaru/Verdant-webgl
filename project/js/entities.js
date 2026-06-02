"use strict";
/* =====================================================================
   VERDANT — entities.js
   Low-poly humanoid builder (player + enemies), procedural walk/idle
   animation, three enemy archetypes (grunt / shooter / brute) with
   simple AI, enemy projectiles, and world pickups (crates).
   ===================================================================== */

/* Character colour kits — selectable at the menu */
const CHAR_VARIANTS = [
  { name:'Scout',   skin:[0.85,0.66,0.5], shirt:[0.18,0.62,0.86], pants:[0.16,0.20,0.28], hat:[0.10,0.14,0.2] },
  { name:'Ranger',  skin:[0.78,0.58,0.42], shirt:[0.36,0.62,0.30], pants:[0.24,0.30,0.18], hat:[0.20,0.34,0.18] },
  { name:'Sun',     skin:[0.88,0.70,0.55], shirt:[0.98,0.62,0.20], pants:[0.30,0.22,0.16], hat:[0.85,0.45,0.12] },
  { name:'Vapor',   skin:[0.82,0.64,0.7],  shirt:[0.62,0.32,0.85], pants:[0.22,0.18,0.30], hat:[0.42,0.20,0.6] },
];

function bmat(scene,name,c,emit){
  const m=new BABYLON.StandardMaterial(name,scene);
  m.diffuseColor=new BABYLON.Color3(c[0],c[1],c[2]);
  m.specularColor=new BABYLON.Color3(0.04,0.04,0.04);
  if(emit) m.emissiveColor=new BABYLON.Color3(c[0]*emit,c[1]*emit,c[2]*emit);
  return m;
}

/* Build a blocky humanoid. Returns rig with animatable pivots. */
function buildHumanoid(scene, kit, scale, shadows, withGun){
  scale=scale||1;
  const root=new BABYLON.TransformNode('char',scene);
  const skinM=bmat(scene,'sk',kit.skin), shirtM=bmat(scene,'sh',kit.shirt),
        pantM=bmat(scene,'pa',kit.pants), hatM=bmat(scene,'ht',kit.hat);
  const cast=[];
  const mk=(w,h,d,mat,parent,x,y,z)=>{
    const m=BABYLON.MeshBuilder.CreateBox('p',{width:w,height:h,depth:d},scene);
    m.material=mat; m.parent=parent; m.position.set(x,y,z); m.isPickable=false; cast.push(m); return m;
  };
  const torso=mk(0.78,0.95,0.46,shirtM,root,0,1.18,0);
  const head=mk(0.5,0.5,0.5,skinM,root,0,1.85,0);
  mk(0.54,0.18,0.54,hatM,head,0,0.28,0);                       // cap
  // arms (shoulder pivots)
  const shoulderL=new BABYLON.TransformNode('shL',scene); shoulderL.parent=root; shoulderL.position.set(-0.5,1.5,0);
  const shoulderR=new BABYLON.TransformNode('shR',scene); shoulderR.parent=root; shoulderR.position.set(0.5,1.5,0);
  mk(0.22,0.8,0.22,shirtM,shoulderL,0,-0.4,0);
  mk(0.22,0.8,0.22,shirtM,shoulderR,0,-0.4,0);
  // legs (hip pivots)
  const hipL=new BABYLON.TransformNode('hpL',scene); hipL.parent=root; hipL.position.set(-0.2,0.72,0);
  const hipR=new BABYLON.TransformNode('hpR',scene); hipR.parent=root; hipR.position.set(0.2,0.72,0);
  mk(0.26,0.78,0.28,pantM,hipL,0,-0.4,0);
  mk(0.26,0.78,0.28,pantM,hipR,0,-0.4,0);
  let gun=null, flash=null;
  if(withGun){
    gun=mk(0.16,0.16,0.7,bmat(scene,'gn',[0.1,0.1,0.12]),shoulderR,0.0,-0.55,0.45);
    flash=BABYLON.MeshBuilder.CreatePlane('fl',{size:0.55},scene);
    const fm=new BABYLON.StandardMaterial('fm',scene); fm.emissiveColor=new BABYLON.Color3(1,0.8,0.3);
    fm.disableLighting=true; fm.useAlphaFromDiffuseTexture=false; flash.material=fm;
    flash.parent=shoulderR; flash.position.set(0.0,-0.55,0.85); flash.isVisible=false;
    flash.billboardMode=BABYLON.Mesh.BILLBOARDMODE_ALL;
  }
  root.scaling.set(scale,scale,scale);
  if(shadows&&Game.shadowGen) cast.forEach(m=>Game.shadowGen.addShadowCaster(m));
  return { root, torso, head, shoulderL, shoulderR, hipL, hipR, gun, flash, mats:[skinM,shirtM,pantM,hatM] };
}

/* Procedural locomotion. moving 0/1, sp = stride speed factor */
function animateRig(rig, moving, sp, phase, aiming){
  const armed = !!rig.gun;                  // armed characters keep a weapon-ready pose
  const gunPose = aiming ? -1.55 : -1.4;     // right arm raised, gun pointing forward
  if(moving){
    const a=Math.sin(phase)*0.7*sp, b=Math.sin(phase+Math.PI)*0.7*sp;
    rig.hipL.rotation.x=a; rig.hipR.rotation.x=b;
    rig.shoulderL.rotation.x = armed ? -0.55 + b*0.15 : b*0.7;
    rig.shoulderR.rotation.x = armed ? gunPose : a*0.7;
    rig.torso.rotation.z=Math.sin(phase)*0.03;
  } else {
    const idle=Math.sin(performance.now()*0.002)*0.04;
    rig.hipL.rotation.x*=0.8; rig.hipR.rotation.x*=0.8;
    rig.shoulderL.rotation.x = armed ? -0.55 : idle;
    rig.shoulderR.rotation.x = armed ? gunPose : idle;
    rig.torso.rotation.z=0;
  }
}

/* ------------------------- Player ------------------------- */
function buildPlayer(scene){
  const rig=buildHumanoid(scene, CHAR_VARIANTS[Game.charIndex], 1.0, Game.settings.shadows, true);
  rig.root.position.set(0, heightAt(0,0), 0);
  Game.playerRig=rig;
  Game.player=rig.root;       // movement node (at feet)
  return rig.root;
}

/* ------------------------- Enemies ------------------------- */
const ENEMY_KITS={
  grunt:  { skin:[0.55,0.20,0.18], shirt:[0.6,0.14,0.12], pants:[0.25,0.08,0.08], hat:[0.4,0.1,0.1] },
  shooter:{ skin:[0.5,0.3,0.5],    shirt:[0.55,0.2,0.6],  pants:[0.2,0.1,0.25],   hat:[0.4,0.12,0.5] },
  brute:  { skin:[0.45,0.22,0.12], shirt:[0.5,0.25,0.1],  pants:[0.28,0.14,0.06], hat:[0.35,0.16,0.06] },
};
function spawnEnemy(scene,shadows){
  const a=rand(0,Math.PI*2), dist=rand(34,60);
  let x=clamp(Game.player.position.x+Math.cos(a)*dist,-WORLD+5,WORLD-5);
  let z=clamp(Game.player.position.z+Math.sin(a)*dist,-WORLD+5,WORLD-5);
  // type weighting by wave
  let type='grunt'; const r=Math.random();
  if(Game.wave>=2 && r<0.32) type='shooter';
  if(Game.wave>=4 && r>0.86) type='brute';
  const kit=ENEMY_KITS[type];
  const scale= type==='brute'?1.5 : type==='shooter'?0.95 : 1.05;
  const rig=buildHumanoid(scene,kit,scale,shadows, type==='shooter');
  rig.root.position.set(x,heightAt(x,z),z);
  const base = type==='brute'?180 : type==='shooter'?55 : 75;
  const e={ rig, type, body:rig.root,
    hp:base+Game.wave*10, maxHp:base+Game.wave*10,
    speed:(type==='brute'?1.8:type==='shooter'?2.4:3.0)+Game.wave*0.12,
    atkCd:0, fireCd:rand(1,2.5), phase:rand(0,6),
    dmg: type==='brute'?22:type==='shooter'?9:9,
    range: type==='shooter'?15:1.9 };
  Game.enemies.push(e);
  return e;
}
function damageEnemy(e,dmg,crit){
  if(e.dead) return;
  e.hp-=dmg;
  showDamage(new BABYLON.Vector3(e.body.position.x, e.body.position.y+ (e.boss?3.2:1.9), e.body.position.z), dmg, crit);
  const hi = e.boss?new BABYLON.Color3(0.9,0.3,0.1):new BABYLON.Color3(0.6,0.4,0.1);
  e.rig.mats[1].emissiveColor=hi;
  setTimeout(()=>{ if(e.rig.mats[1]) e.rig.mats[1].emissiveColor=e.boss?new BABYLON.Color3(0.4,0.05,0.05):new BABYLON.Color3(0,0,0); },70);
  if(e.hp<=0) killEnemy(e);
}
function killEnemy(e){
  if(e.dead) return; e.dead=true;
  const base = e.boss?2500 : e.type==='brute'?300 : e.type==='shooter'?150 : 100;
  Game.score += Math.round(base*Game.combo.mult); addKillCombo();
  const cash = e.boss?600 : e.type==='brute'?80 : e.type==='shooter'?50 : 25;
  if(typeof spawnCashDrop==='function') spawnCashDrop(e.body.position.x,e.body.position.z,cash);
  else if(typeof addMoney==='function') addMoney(cash);
  if(typeof trackContract==='function') trackContract('kill',1);
  sfx('kill');
  if(e.boss){
    Game.boss=null; updateBossBar(); bigToast('BOSS DOWN','+'+(base*Game.combo.mult)+' · territory secured');
    for(let i=0;i<3;i++) spawnItem(Game.scene, ['medkit','armor','grenade'][i], e.body.position.x+rand(-2,2), e.body.position.z+rand(-2,2));
  } else if(Math.random()<0.4){
    const roll=Math.random();
    const type = roll<0.4?'ammo' : roll<0.7?'medkit' : roll<0.85?'grenade' : roll<0.93?'armor':'shotgun';
    spawnItem(Game.scene,type,e.body.position.x,e.body.position.z);
  }
  Game.enemies=Game.enemies.filter(x=>x!==e);
  updateHUD();
  // topple + sink, then dispose
  const root=e.rig.root; let t=0; const dir=Math.random()<0.5?1:-1;
  const iv=setInterval(()=>{
    t+=0.04;
    root.rotation.z=lerp(root.rotation.z, dir*Math.PI/2, 0.18);
    root.position.y=heightAt(root.position.x,root.position.z)+lerp(0,-0.6,Math.min(1,t*1.3));
    e.rig.mats.forEach(m=>{ if(m){ m.alpha=Math.max(0,1-t*1.2); } });
    if(t>=0.85){ clearInterval(iv); root.dispose(false,true); }
  },24);
}

/* ------------------------- Enemy projectiles ------------------------- */
function enemyFire(e){
  const p=Game.player.position, b=e.body.position;
  const dx=p.x-b.x, dy=(p.y+1.3)-(b.y+1.4), dz=p.z-b.z;
  const d=Math.hypot(dx,dy,dz); if(d<0.1) return;
  const sp=22;
  const m=BABYLON.MeshBuilder.CreateSphere('proj',{diameter:0.35,segments:6},Game.scene);
  m.material=scene_proj(); m.position.set(b.x,b.y+1.4,b.z); m.isPickable=false;
  Game.projectiles.push({ mesh:m, vx:dx/d*sp, vy:dy/d*sp, vz:dz/d*sp, life:3, dmg:e.dmg });
  sfx('enemyfire');
}
let _projMat=null;
function scene_proj(){ if(!_projMat){ _projMat=new BABYLON.StandardMaterial('pm',Game.scene);
  _projMat.emissiveColor=new BABYLON.Color3(1,0.4,0.2); _projMat.disableLighting=true; } return _projMat; }
function updateProjectiles(dt){
  for(const pr of [...Game.projectiles]){
    pr.mesh.position.x+=pr.vx*dt; pr.mesh.position.y+=pr.vy*dt; pr.mesh.position.z+=pr.vz*dt;
    pr.life-=dt;
    const d=BABYLON.Vector3.Distance(pr.mesh.position, new BABYLON.Vector3(Game.player.position.x,Game.player.position.y+1.2,Game.player.position.z));
    if(d<1.0){ damagePlayer(pr.dmg); pr.mesh.dispose(); Game.projectiles=Game.projectiles.filter(x=>x!==pr); continue; }
    if(pr.life<=0 || pr.mesh.position.y<heightAt(pr.mesh.position.x,pr.mesh.position.z)){
      pr.mesh.dispose(); Game.projectiles=Game.projectiles.filter(x=>x!==pr);
    }
  }
}

/* ------------------------- Items / pickups ------------------------- */
const ITEM_DEFS={
  pistol:{ico:'🔫',nm:'PISTOL'}, rifle:{ico:'🪖',nm:'RIFLE'}, shotgun:{ico:'💥',nm:'SHOTGUN'},
  sniper:{ico:'🎯',nm:'SNIPER'}, ammo:{ico:'📦',nm:'AMMO'}, medkit:{ico:'➕',nm:'MEDKIT'},
  grenade:{ico:'✛',nm:'GRENADE'}, armor:{ico:'🛡️',nm:'ARMOR'},
};
function spawnItem(scene,type,x,z){
  const y=heightAt(x,z);
  const box=BABYLON.MeshBuilder.CreateBox('item',{size:0.7},scene);
  box.position.set(x,y+0.7,z);
  const colors={ ammo:[0.95,0.72,0.2], medkit:[0.9,0.2,0.2], rifle:[0.4,0.4,0.45],
    shotgun:[0.7,0.45,0.2], sniper:[0.3,0.5,0.6], grenade:[0.3,0.55,0.25], armor:[0.5,0.7,0.95] };
  const c=colors[type]||[0.6,0.6,0.6];
  box.material=bmat(scene,'it',c,0.35);
  box.isPickable=false;
  Game.items.push({ mesh:box, type, baseY:y+0.7 });
}

/* ------------------------- Ambient villagers ------------------------- */
const VILLAGER_KITS=[
  { skin:[0.85,0.66,0.5], shirt:[0.85,0.85,0.88], pants:[0.4,0.4,0.45], hat:[0.6,0.4,0.3] },
  { skin:[0.78,0.58,0.42], shirt:[0.55,0.75,0.85], pants:[0.3,0.3,0.4], hat:[0.4,0.5,0.6] },
  { skin:[0.88,0.7,0.55], shirt:[0.9,0.8,0.5], pants:[0.45,0.35,0.25], hat:[0.7,0.6,0.4] },
];
function spawnVillager(scene,x,z){
  const kit=VILLAGER_KITS[(Math.random()*VILLAGER_KITS.length)|0];
  const rig=buildHumanoid(scene,kit,rand(0.9,1.05),Game.settings.shadows,false);
  rig.root.position.set(x,heightAt(x,z),z);
  Game.villagers.push({ rig, home:{x,z}, tx:x, tz:z, phase:rand(0,6), wait:rand(0,2), fleeing:false, dead:false });
}
function killVillager(v){
  if(!v||v.dead) return; v.dead=true;
  if(typeof addWanted==='function') addWanted(2);     // civilian casualty = serious heat
  Game.villagers=Game.villagers.filter(x=>x!==v);
  const root=v.rig.root; let t=0; const dir=Math.random()<0.5?1:-1;
  const iv=setInterval(()=>{ t+=0.05; root.rotation.z=lerp(root.rotation.z,dir*Math.PI/2,0.2);
    root.position.y=heightAt(root.position.x,root.position.z)+lerp(0,-0.6,Math.min(1,t*1.4));
    v.rig.mats.forEach(m=>{ if(m) m.alpha=Math.max(0,1-t*1.3); });
    if(t>=0.8){ clearInterval(iv); root.dispose(false,true); } },28);
}
function spawnVillagers(scene){
  let n=0;
  (Game.houses||[]).forEach(h=>{ if(n>=10) return; const c=1+(Math.random()<0.5?1:0);
    for(let i=0;i<c&&n<10;i++){ spawnVillager(scene, h.x+rand(-6,6), h.z+rand(-6,6)); n++; } });
  while(n<6){ const x=rand(-WORLD+10,WORLD-10), z=rand(-WORLD+10,WORLD-10);
    if(biomeAt(x,z)===1){ spawnVillager(scene,x,z); n++; } }
}
function updateVillagers(dt){
  const p=Game.player.position;
  for(const v of Game.villagers){
    const pos=v.rig.root.position;
    // detect threat: nearest enemy, or armed player nearby
    let threat=null, td=13;
    for(const e of Game.enemies){ const d=BABYLON.Vector3.Distance(pos,e.body.position); if(d<td){td=d;threat=e.body.position;} }
    for(const c of Game.police){ const d=BABYLON.Vector3.Distance(pos,c.body.position); if(d<td){td=d;threat=c.body.position;} }
    if(Game.wanted>0){ const d=BABYLON.Vector3.Distance(pos,Game.player.position); if(d<td){td=d;threat=Game.player.position;} }
    let tx,tz,sp; v.fleeing=!!threat;
    if(threat){
      const dx=pos.x-threat.x, dz=pos.z-threat.z, d=Math.hypot(dx,dz)||1;
      tx=pos.x+dx/d*8; tz=pos.z+dz/d*8; sp=4.6;
    } else {
      tx=v.tx; tz=v.tz; sp=1.6;
    }
    const dx=tx-pos.x, dz=tz-pos.z, dist=Math.hypot(dx,dz);
    let moved=false;
    if(dist>0.6){
      const nx=dx/dist, nz=dz/dist; const np={x:pos.x+nx*sp*dt, z:pos.z+nz*sp*dt};
      resolveCollision(np,0.45); pos.x=np.x; pos.z=np.z;
      v.rig.root.rotation.y=Math.atan2(nx,nz); moved=true;
    } else if(!threat){
      v.wait-=dt;
      if(v.wait<=0){ v.tx=v.home.x+rand(-10,10); v.tz=v.home.z+rand(-10,10); v.wait=rand(1.5,4); }
    }
    pos.y=heightAt(pos.x,pos.z);
    v.phase+=dt*(moved?(threat?13:8):3);
    animateRig(v.rig, moved, threat?1.4:1, v.phase, false);
  }
}
