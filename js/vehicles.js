"use strict";
/* =====================================================================
   VERDANT — vehicles.js
   Low-poly arcade vehicle: build, enter/exit, terrain-following drive
   with slope tilt, spinning/steering wheels, and run-over damage.
   ===================================================================== */

const CAR_COLORS=[[0.9,0.25,0.22],[0.2,0.5,0.85],[0.95,0.7,0.2],[0.3,0.7,0.45],[0.85,0.85,0.88]];

function buildVehicle(scene,x,z,col){
  col=col||CAR_COLORS[(Math.random()*CAR_COLORS.length)|0];
  const root=new BABYLON.TransformNode('veh',scene);
  const bodyMat=bmat(scene,'vb',col), darkMat=bmat(scene,'vd',[0.12,0.12,0.14]),
        glassMat=scene._matGlass||bmat(scene,'vg',[0.3,0.4,0.45]);
  const cast=[];
  const box=(w,h,d,mat,px,py,pz)=>{ const m=BABYLON.MeshBuilder.CreateBox('vp',{width:w,height:h,depth:d},scene);
    m.material=mat; m.parent=root; m.position.set(px,py,pz); m.isPickable=false; cast.push(m); return m; };
  box(2.0,0.55,3.9,bodyMat,0,0.55,0);                 // chassis
  box(1.7,0.5,1.9,bodyMat,0,1.05,-0.15);              // cabin
  box(1.55,0.42,1.7,glassMat,0,1.08,-0.15);           // windows (inset glass)
  box(2.02,0.18,1.0,darkMat,0,0.75,1.55);             // hood detail
  // headlights
  const lampMat=bmat(scene,'vl',[1,0.95,0.7],0.6);
  box(0.35,0.22,0.1,lampMat,-0.7,0.6,1.97); box(0.35,0.22,0.1,lampMat,0.7,0.6,1.97);
  // wheels (pivots so they spin + steer)
  const wheels=[];
  const wpos=[[-1.0,-1.3,true],[1.0,-1.3,true],[-1.0,1.3,false],[1.0,1.3,false]];
  wpos.forEach(([wx,wz,rear])=>{
    const piv=new BABYLON.TransformNode('wp',scene); piv.parent=root; piv.position.set(wx,0.45,wz);
    const w=BABYLON.MeshBuilder.CreateCylinder('wheel',{height:0.4,diameter:0.95,tessellation:10},scene);
    w.rotation.z=Math.PI/2; w.material=darkMat; w.parent=piv; w.isPickable=false; cast.push(w);
    wheels.push({piv, front:!rear});
  });
  root.position.set(x,heightAt(x,z)+0.45,z); root.rotation.y=rand(0,Math.PI*2);
  if(Game.settings.shadows&&Game.shadowGen) cast.forEach(m=>Game.shadowGen.addShadowCaster(m));
  const v={ root, wheels, speed:0, heading:root.rotation.y, steer:0 };
  Game.vehicles.push(v);
  return v;
}

function spawnVehicles(scene){
  buildVehicle(scene, 12, -10);
  buildVehicle(scene, -14, -4);
  (Game.houses||[]).slice(0,3).forEach(h=>{ if(Math.random()<0.7) buildVehicle(scene, h.x+rand(-7,7), h.z+rand(-7,7)); });
}

function toggleVehicle(){
  if(Game.inVehicle){
    const v=Game.inVehicle; const rx=Math.cos(v.heading), rz=-Math.sin(v.heading);
    const ex=v.root.position.x+rx*2.8, ez=v.root.position.z+rz*2.8;
    Game.player.position.set(ex,heightAt(ex,ez),ez);
    Game.playerRig.root.setEnabled(true); Game.inVehicle=null; sfx('click'); toast('EXIT VEHICLE');
  } else {
    let best=null,bd=5.0;
    for(const v of Game.vehicles){ const d=BABYLON.Vector3.Distance(v.root.position,Game.player.position); if(d<bd){bd=d;best=v;} }
    if(best){ Game.inVehicle=best; Game.playerRig.root.setEnabled(false); best.speed=0;
      Game.yaw=best.heading; sfx('pickup'); toast('DRIVE — W/S THROTTLE · A/D STEER · F EXIT');
      if(typeof trackMission==='function') trackMission('drives',1); }
    else toast('NO VEHICLE NEARBY');
  }
}

// returns true if it handled movement this frame
function updateVehicle(dt,now){
  const v=Game.inVehicle; if(!v) return false;
  const k=Game.keys;
  let accel=0;
  if(k['w']) accel=26; if(k['s']) accel=-18;
  v.speed += accel*dt; v.speed *= 0.97;
  v.speed = clamp(v.speed,-13,30);
  if(Math.abs(v.speed)<0.05 && !accel) v.speed=0;
  // steering scales with speed
  let steerInput=0; if(k['a']) steerInput=-1; if(k['d']) steerInput=1;
  v.steer = lerp(v.steer, steerInput*0.5, 0.2);
  v.heading += steerInput * dt * 1.7 * clamp(Math.abs(v.speed)/6,0,1) * (v.speed>=0?1:-1);
  const fx=Math.sin(v.heading), fz=Math.cos(v.heading);
  const np={ x:v.root.position.x+fx*v.speed*dt, z:v.root.position.z+fz*v.speed*dt };
  resolveCollision(np,1.9);
  v.root.position.x=np.x; v.root.position.z=np.z;
  const gy=heightAt(np.x,np.z)+0.45;
  v.root.position.y=lerp(v.root.position.y,gy,0.25);
  // slope tilt
  const hf=heightAt(np.x+fx*1.6,np.z+fz*1.6), hb=heightAt(np.x-fx*1.6,np.z-fz*1.6);
  const rx=Math.cos(v.heading), rz=-Math.sin(v.heading);
  const hl=heightAt(np.x+rx*1.0,np.z+rz*1.0), hr=heightAt(np.x-rx*1.0,np.z-rz*1.0);
  v.root.rotation.set(Math.atan2(hf-hb,3.2)*0.6, v.heading, Math.atan2(hl-hr,2)*0.5);
  // wheels spin + steer
  v.wheels.forEach(w=>{ w.piv.rotation.x += v.speed*dt*2.2; if(w.front) w.piv.rotation.y=v.steer; });
  // run-over
  if(Math.abs(v.speed)>7){
    for(const e of [...Game.enemies]){ if(BABYLON.Vector3.Distance(v.root.position,e.body.position)<2.4){ damageEnemy(e,90); } }
    for(const c of [...Game.police]){ if(BABYLON.Vector3.Distance(v.root.position,c.body.position)<2.4){ damageCop(c,90); } }
    for(const vv of [...(Game.villagers||[])]){ if(BABYLON.Vector3.Distance(v.root.position,vv.rig.root.position)<2.2){ killVillager(vv); } }
  }
  // keep player logical position on the car (for AI targeting, minimap, net)
  Game.player.position.copyFrom(v.root.position);
  // camera chase (trail behind heading)
  Game.yaw = lerp(Game.yaw, v.heading, 0.12);
  const radius=Math.max(9, Game.camDist+3.5), cosP=Math.cos(Game.pitch), sinP=Math.sin(Game.pitch);
  const tx=v.root.position.x, ty=v.root.position.y+1.5, tz=v.root.position.z;
  let camX=tx-Math.sin(Game.yaw)*radius*cosP, camY=ty+radius*sinP+0.8, camZ=tz-Math.cos(Game.yaw)*radius*cosP;
  const cgy=heightAt(camX,camZ)+0.8; if(camY<cgy) camY=cgy;
  Game.camera.position.set(camX,camY,camZ); Game.camera.setTarget(new BABYLON.Vector3(tx,ty,tz));
  return true;
}
