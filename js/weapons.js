"use strict";
/* =====================================================================
   VERDANT — weapons.js
   Four firearms (pistol / rifle / shotgun / sniper) with raycast hit
   detection (manual ray-vs-enemy — robust & cheap), throwable grenades
   with AoE, reloading, and the inventory model.
   ===================================================================== */

function defaultWeapons(){
  return [
    { id:'pistol', name:'PISTOL',  dmg:34, mag:12, ammo:12, reserve:60,  maxMag:12, rof:280, auto:false, spread:0.012, range:130, reloadMs:850,  pellets:1, sfx:'pistol',  owned:true },
    { id:'rifle',  name:'RIFLE',   dmg:22, mag:30, ammo:30, reserve:120, maxMag:30, rof:90,  auto:true,  spread:0.032, range:150, reloadMs:1300, pellets:1, sfx:'rifle',   owned:false },
    { id:'shotgun',name:'SHOTGUN', dmg:15, mag:6,  ammo:6,  reserve:30,  maxMag:6,  rof:620, auto:false, spread:0.10,  range:42,  reloadMs:1500, pellets:8, sfx:'shotgun', owned:false },
    { id:'sniper', name:'SNIPER',  dmg:150,mag:5,  ammo:5,  reserve:20,  maxMag:5,  rof:1100,auto:false, spread:0.002, range:320, reloadMs:1700, pellets:1, sfx:'sniper',  owned:false, zoom:true },
    { id:'minigun',name:'MINIGUN', dmg:13, mag:120,ammo:120,reserve:240, maxMag:120,rof:42,  auto:true,  spread:0.055, range:150, reloadMs:2700, pellets:1, sfx:'rifle',   owned:false },
    { id:'rocket', name:'RPG',     dmg:220,mag:1,  ammo:1,  reserve:8,   maxMag:1,  rof:1200,auto:false, spread:0.004, range:300, reloadMs:1900, pellets:1, sfx:'explode',  owned:false, rocket:true },
    // ---- secret guns (unlock via codes / missions) ----
    { id:'railgun',  name:'RAILGUN',     dmg:400, mag:4,  ammo:4,  reserve:16, maxMag:4,  rof:900, auto:false, spread:0.0,  range:380, reloadMs:1800, pellets:1, sfx:'sniper', owned:false, secret:true, zoom:true, tracer:[0.5,0.9,1] },
    { id:'flame',    name:'FLAMETHROWER',dmg:8,   mag:200,ammo:200,reserve:400,maxMag:200,rof:28,  auto:true,  spread:0.12, range:22,  reloadMs:2200, pellets:1, sfx:'rifle',  owned:false, secret:true, tracer:[1,0.5,0.1] },
    { id:'goldengun',name:'GOLDEN GUN',  dmg:9999,mag:8,  ammo:8,  reserve:64, maxMag:8,  rof:340, auto:false, spread:0.004,range:320, reloadMs:900,  pellets:1, sfx:'pistol', owned:false, secret:true, golden:true, tracer:[1,0.85,0.2] },
  ];
}

let lastShot=0, reloading=false;

function currentW(){ return Game.weapons[Game.currentWeapon]; }

function switchWeapon(i){
  if(i<0||i>=Game.weapons.length) return;
  if(!Game.weapons[i].owned){ toast('WEAPON NOT OWNED'); return; }
  Game.currentWeapon=i; reloading=false; sfx('click');
  refreshAmmoHUD(); renderInventory(); updateQuickSlots();
}

function tryShoot(now){
  const w=currentW();
  if(reloading || Game.pvpDead || Game.photo) return;
  if(now-lastShot < w.rof) return;
  if(Game.cheats.infAmmo){ w.ammo=w.maxMag; w.reserve=Math.max(w.reserve,w.maxMag); }
  if(w.ammo<=0){ if(w.reserve>0) reload(); else toast('OUT OF AMMO'); return; }
  lastShot=now; if(!Game.cheats.infAmmo) w.ammo--; refreshAmmoHUD(); sfx(w.sfx);

  // muzzle flash
  const fl=Game.playerRig.flash; if(fl){ fl.isVisible=true; setTimeout(()=>fl.isVisible=false,50); }
  // recoil kick on camera pitch
  Game.pitch=clamp(Game.pitch - w.spread*1.6, -0.25, 1.3);

  if(w.rocket){ fireRocket(w); return; }
  for(let p=0;p<w.pellets;p++) fireRay(w);
}

/* ------------------------- Rocket projectile (RPG) ------------------------- */
function fireRocket(w){
  const cam=Game.camera;
  const ax=(Game.aimPx!=null?Game.aimPx:Game.engine.getRenderWidth()/2);
  const ay=(Game.aimPy!=null?Game.aimPy:Game.engine.getRenderHeight()/2);
  const ray=Game.scene.createPickingRay(ax,ay,BABYLON.Matrix.Identity(),cam);
  const d=ray.direction.clone().normalize();
  const muzzle=(Game.playerRig&&Game.playerRig.gun)?Game.playerRig.gun.getAbsolutePosition():ray.origin;
  const m=BABYLON.MeshBuilder.CreateCylinder('rkt',{height:0.9,diameter:0.28,tessellation:6},Game.scene);
  m.material=bmat(Game.scene,'rktm',[0.85,0.78,0.2],0.5);
  m.position.copyFrom(muzzle); m.isPickable=false;
  Game.rockets.push({ mesh:m, vx:d.x*70, vy:d.y*70, vz:d.z*70, life:4 });
}
function updateRockets(dt){
  for(const r of [...Game.rockets]){
    const m=r.mesh;
    m.position.x+=r.vx*dt; m.position.y+=r.vy*dt; m.position.z+=r.vz*dt;
    // orient along travel
    m.rotation.x=Math.atan2(Math.hypot(r.vx,r.vz), r.vy);
    m.rotation.y=Math.atan2(r.vx,r.vz);
    r.life-=dt;
    let hit=false;
    for(const e of Game.enemies){ if(e.dead) continue;
      if(BABYLON.Vector3.Distance(m.position,new BABYLON.Vector3(e.body.position.x,e.body.position.y+1.2,e.body.position.z))<1.6){ hit=true; break; } }
    if(!hit && m.position.y<=heightAt(m.position.x,m.position.z)+0.2) hit=true;
    if(hit || r.life<=0){ explodeAt(m.position.clone(), 9, 260);
      m.dispose(); Game.rockets=Game.rockets.filter(x=>x!==r); }
  }
}
function clearRockets(){ (Game.rockets||[]).forEach(r=>r.mesh.dispose()); Game.rockets=[]; }

/* shared AoE explosion — used by grenades and rockets */
function explodeAt(pos,R,dmg){
  sfx('explode');
  const fx=BABYLON.MeshBuilder.CreateSphere('boom',{diameter:1,segments:8},Game.scene);
  fx.position.copyFrom(pos);
  const fm=new BABYLON.StandardMaterial('boomm',Game.scene); fm.emissiveColor=new BABYLON.Color3(1,0.7,0.2); fm.disableLighting=true;
  fx.material=fm;
  let s=1; const grow=setInterval(()=>{ s+=1.5; fx.scaling.setAll(s*(R/7)); fm.alpha=Math.max(0,1-s/9);
    if(s>9){ clearInterval(grow); fx.dispose(); } },16);
  for(const e of [...Game.enemies]){
    if(e.dead) continue;
    const d=BABYLON.Vector3.Distance(pos,e.body.position);
    if(d<R){ damageEnemy(e, dmg*(1-d/R)); if(e.dead && typeof trackMission==='function') trackMission('nadeKills',1); }
  }
}

/* Screen-space target finder: returns the hostile whose body projects
   closest to the aim point (cursor / center). This is the "fire to the
   pointer, at enemies" assist that makes shooting reliable in 3rd person. */
function screenTarget(maxRange){
  const e=Game.engine, vw=e.getRenderWidth(), vh=e.getRenderHeight();
  const ax=(Game.aimPx!=null?Game.aimPx:vw/2), ay=(Game.aimPy!=null?Game.aimPy:vh/2);
  const vp=new BABYLON.Viewport(0,0,vw,vh);
  const mat=Game.scene.getTransformMatrix();
  let best=null, bestKind=null, bestPx=Math.max(200, vw*0.20), headshot=false, aimPt=null;
  // fallback: the nearest on-screen hostile, regardless of cursor distance,
  // so ANY click reliably kills something when enemies are visible & in range.
  let fb=null, fbKind=null, fbDist=Infinity, fbPt=null;
  const consider=(list,kind)=>{
    for(const o of list){
      if(o.dead) continue;
      const s=o.rig.root.scaling.x;
      const wp=new BABYLON.Vector3(o.body.position.x, o.body.position.y+1.2*s, o.body.position.z);
      const distW=BABYLON.Vector3.Distance(Game.camera.position,wp);
      if(distW>(maxRange||9999)) continue;
      const p=BABYLON.Vector3.Project(wp, BABYLON.Matrix.Identity(), mat, vp);
      if(p.z<0||p.z>1) continue;                       // behind camera
      if(p.x<-vw*0.1||p.x>vw*1.1) continue;            // well off the sides
      if(distW<fbDist){ fbDist=distW; fb=o; fbKind=kind; fbPt=wp; }
      const d=Math.hypot(p.x-ax,p.y-ay);
      if(d<bestPx){ bestPx=d; best=o; bestKind=kind; aimPt=wp;
        // head projects ~ a bit above; mark headshot if aim is in the upper band
        const hp=BABYLON.Vector3.Project(new BABYLON.Vector3(o.body.position.x,o.body.position.y+1.85*s,o.body.position.z),BABYLON.Matrix.Identity(),mat,vp);
        headshot = Math.hypot(hp.x-ax,hp.y-ay) < 40;
      }
    }
  };
  consider(Game.enemies,'enemy');
  consider(Game.police,'police');
  if(best) return {target:best, kind:bestKind, headshot, aimPt};
  if(fb)   return {target:fb,   kind:fbKind, headshot:false, aimPt:fbPt};
  return null;
}

function fireRay(w){
  const cam=Game.camera;
  const ax = (Game.aimPx!=null) ? Game.aimPx : Game.engine.getRenderWidth()/2;
  const ay = (Game.aimPy!=null) ? Game.aimPy : Game.engine.getRenderHeight()/2;
  const ray=Game.scene.createPickingRay(ax, ay, BABYLON.Matrix.Identity(), cam);
  const o=ray.origin;
  const muzzle = (Game.playerRig&&Game.playerRig.gun) ? Game.playerRig.gun.getAbsolutePosition() : o;
  const tcol = w.tracer || Game.tracerColor;

  // 0) PvP — shots target other players; the server validates the hit
  if(typeof isPvP==='function' && isPvP()){
    const pt=pvpTarget(w.range);
    if(pt){
      netHit(pt.id, Math.round(w.dmg*((typeof perkDamageMult==='function')?perkDamageMult():1)), w.id);
      const end=new BABYLON.Vector3(pt.pos.x,pt.pos.y+1.2,pt.pos.z);
      flashHitmark(false); sfx('hit'); impactSpark(end,true); spawnTracer(muzzle,end,tcol);
    } else {
      const dir=ray.direction;
      const gp=Game.scene.pickWithRay(new BABYLON.Ray(o,dir,w.range), me=>me===Game.ground);
      const end=(gp&&gp.hit)?gp.pickedPoint:new BABYLON.Vector3(o.x+dir.x*w.range,o.y+dir.y*w.range,o.z+dir.z*w.range);
      if(gp&&gp.hit) impactSpark(end,false); spawnTracer(muzzle,end,tcol);
    }
    return;
  }

  // 0b) CO-OP — shoot server-owned shared enemies (hit validated server-side)
  if(typeof isCoop==='function' && isCoop()){
    const ct=coopTarget(w.range);
    if(ct){
      netEHit(ct.id, Math.round(w.dmg*((typeof perkDamageMult==='function')?perkDamageMult():1)));
      const end=new BABYLON.Vector3(ct.pos.x,ct.pos.y+1.2*ct.scale,ct.pos.z);
      flashHitmark(false); sfx('hit'); impactSpark(end,true); spawnTracer(muzzle,end,tcol);
    } else {
      const dir=ray.direction;
      const gp=Game.scene.pickWithRay(new BABYLON.Ray(o,dir,w.range), me=>me===Game.ground);
      const end=(gp&&gp.hit)?gp.pickedPoint:new BABYLON.Vector3(o.x+dir.x*w.range,o.y+dir.y*w.range,o.z+dir.z*w.range);
      if(gp&&gp.hit) impactSpark(end,false); spawnTracer(muzzle,end,tcol);
    }
    return;
  }

  // 1) AIM ASSIST — lock onto the enemy nearest the pointer (reliable hits)
  const st=screenTarget(w.range);
  if(st){
    const e=st.target, hs=st.headshot, dmg=w.dmg*(hs?2:1)*((typeof perkDamageMult==='function')?perkDamageMult():1);
    const end=st.aimPt;
    if(st.kind==='enemy'){ damageEnemy(e,dmg,hs,true); if(hs&&typeof trackContract==='function') trackContract('head',1); }
    else { damageCop(e,dmg,hs); }
    flashHitmark(hs); sfx('hit'); impactSpark(end,true); spawnTracer(muzzle,end,tcol);
    return;
  }

  // 2) No enemy under the pointer — precise ray (civilians / ground / miss)
  const dir=ray.direction.clone();
  const spr = w.spread * (Game.crouching?0.5:1) * (Game.aiming?0.65:1);
  dir.x+=rand(-spr,spr); dir.y+=rand(-spr,spr); dir.z+=rand(-spr,spr);
  dir.normalize();
  let best=null, bestT=w.range;
  for(const v of (Game.villagers||[])){
    if(v.dead) continue;
    const b=v.rig.root.position, cx=b.x, cy=b.y+1.2, cz=b.z;
    const t=(cx-o.x)*dir.x+(cy-o.y)*dir.y+(cz-o.z)*dir.z;
    if(t<0||t>bestT) continue;
    const px=o.x+dir.x*t, py=o.y+dir.y*t, pz=o.z+dir.z*t;
    if(Math.hypot(cx-px,cy-py,cz-pz)<1.0){ best=v; bestT=t; }
  }
  let end;
  if(best){ end=new BABYLON.Vector3(o.x+dir.x*bestT,o.y+dir.y*bestT,o.z+dir.z*bestT);
    killVillager(best); flashHitmark(false); sfx('hit'); impactSpark(end,true); }
  else {
    const gp=Game.scene.pickWithRay(new BABYLON.Ray(o,dir,w.range), m=>m===Game.ground);
    if(gp&&gp.hit){ end=gp.pickedPoint; impactSpark(end,false); }
    else end=new BABYLON.Vector3(o.x+dir.x*w.range,o.y+dir.y*w.range,o.z+dir.z*w.range);
  }
  spawnTracer(muzzle, end, tcol);
}

/* visible bullet tracer + impact spark — so firing always reads clearly */
function spawnTracer(a,b,col){
  const line=BABYLON.MeshBuilder.CreateLines('tracer',{points:[a,b]},Game.scene);
  const tc=col||Game.tracerColor||[1,0.86,0.42];
  line.color=new BABYLON.Color3(tc[0],tc[1],tc[2]); line.isPickable=false; line.alpha=0.95;
  let al=0.95; const iv=setInterval(()=>{ al-=0.2; line.alpha=Math.max(0,al); if(al<=0){ clearInterval(iv); line.dispose(); } },16);
}
function impactSpark(p,onEnemy){
  const s=BABYLON.MeshBuilder.CreateSphere('spark',{diameter:0.3,segments:6},Game.scene);
  s.position.copyFrom(p); s.isPickable=false;
  const m=new BABYLON.StandardMaterial('sm',Game.scene); m.disableLighting=true;
  m.emissiveColor=onEnemy?new BABYLON.Color3(1,0.32,0.2):new BABYLON.Color3(0.92,0.82,0.55);
  s.material=m;
  let sc=1; const iv=setInterval(()=>{ sc+=0.7; s.scaling.setAll(sc); m.alpha=Math.max(0,1-sc/3.6); if(sc>3.6){ clearInterval(iv); s.dispose(); } },16);
}

function reload(){
  const w=currentW();
  if(reloading||w.ammo>=w.maxMag||w.reserve<=0) return;
  reloading=true; toast('RELOADING…'); sfx('reload');
  setTimeout(()=>{
    const need=w.maxMag-w.ammo, take=Math.min(need,w.reserve);
    w.ammo+=take; w.reserve-=take; reloading=false; refreshAmmoHUD();
  }, w.reloadMs*((typeof perkReloadMult==='function')?perkReloadMult():1));
}

/* ------------------------- Grenades ------------------------- */
function throwGrenade(){
  if(Game.grenadeCount<=0){ toast('NO GRENADES'); return; }
  Game.grenadeCount--; updateGrenadeHUD(); sfx('throw');
  const cam=Game.camera;
  const ray=Game.scene.createPickingRay((Game.aimPx!=null?Game.aimPx:Game.engine.getRenderWidth()/2),(Game.aimPy!=null?Game.aimPy:Game.engine.getRenderHeight()/2),BABYLON.Matrix.Identity(),cam);
  const d=ray.direction;
  const m=BABYLON.MeshBuilder.CreateSphere('nade',{diameter:0.4,segments:6},Game.scene);
  m.material=bmat(Game.scene,'nm',[0.25,0.5,0.22],0.2);
  const p=Game.player.position;
  m.position.set(p.x,p.y+1.4,p.z); m.isPickable=false;
  Game.grenades.push({ mesh:m, vx:d.x*24, vy:d.y*24+6, vz:d.z*24, fuse:1.5 });
}
function updateGrenades(dt){
  for(const g of [...Game.grenades]){
    g.vy-=26*dt;
    g.mesh.position.x+=g.vx*dt; g.mesh.position.y+=g.vy*dt; g.mesh.position.z+=g.vz*dt;
    const gy=heightAt(g.mesh.position.x,g.mesh.position.z)+0.2;
    if(g.mesh.position.y<gy){ g.mesh.position.y=gy; g.vy*=-0.4; g.vx*=0.6; g.vz*=0.6; }
    g.mesh.rotation.x+=dt*6; g.fuse-=dt;
    if(g.fuse<=0) explodeGrenade(g);
  }
}
function explodeGrenade(g){
  explodeAt(g.mesh.position.clone(), 7, 220);
  g.mesh.dispose(); Game.grenades=Game.grenades.filter(x=>x!==g);
}

/* ------------------------- Inventory model ------------------------- */
function initInventory(){
  Game.inventory=[
    {key:'pistol',weapon:0},
    {key:'ammo',qty:2},
    {key:'medkit',qty:2},
    {key:'grenade',qty:Game.grenadeCount},
  ];
}
function ownWeapon(id){
  const idx=Game.weapons.findIndex(w=>w.id===id); if(idx<0) return;
  const w=Game.weapons[idx];
  if(!w.owned){ w.owned=true; Game.inventory.push({key:id,weapon:idx}); toast('ACQUIRED '+w.name); }
  else { w.reserve+=w.maxMag; }
}
function addToInventory(key,qty){
  if(['rifle','shotgun','sniper','minigun','rocket'].includes(key)){ ownWeapon(key); return; }
  if(key==='grenade'){ Game.grenadeCount+=qty; updateGrenadeHUD(); }
  const ex=Game.inventory.find(i=>i.key===key && i.weapon===undefined);
  if(ex) ex.qty=(ex.qty||0)+qty; else Game.inventory.push({key,qty});
}
function useInventory(item){
  if(item.weapon!==undefined){ switchWeapon(item.weapon); }
  else if(item.key==='medkit' && item.qty>0){
    const cap=Game.maxHP||100;
    if(Game.playerData.hp>=cap){ toast('HP ALREADY FULL'); return; }
    Game.playerData.hp=Math.min(cap,Game.playerData.hp+40); item.qty--;
    if(item.qty<=0) Game.inventory=Game.inventory.filter(x=>x!==item);
    refreshHP(); renderInventory(); sfx('pickup'); toast('+40 HP');
  }
  else if(item.key==='ammo' && item.qty>0){
    currentW().reserve += 30; item.qty--;
    if(item.qty<=0) Game.inventory=Game.inventory.filter(x=>x!==item);
    refreshAmmoHUD(); renderInventory(); sfx('pickup'); toast('+30 AMMO');
  }
  else if(item.key==='grenade'){ toast('PRESS G TO THROW'); }
}
