"use strict";
/* =====================================================================
   VERDANT — policecars.js
   Pursuit vehicles with flashing red/blue light bars and a wailing
   siren, plus street roadblocks (parked cruisers + officers) that form
   at high wanted levels.
   ===================================================================== */

function buildCopCar(scene,x,z){
  const veh=buildVehicle(scene,x,z,[0.93,0.95,0.98]);     // white cruiser
  Game.vehicles=Game.vehicles.filter(v=>v.root!==veh.root); // not player-drivable
  // light bar
  const barR=BABYLON.MeshBuilder.CreateBox('lb',{width:0.5,height:0.22,depth:0.5},scene);
  const barB=BABYLON.MeshBuilder.CreateBox('lb',{width:0.5,height:0.22,depth:0.5},scene);
  const mr=new BABYLON.StandardMaterial('mr',scene); mr.emissiveColor=new BABYLON.Color3(1,0.1,0.1); mr.disableLighting=true;
  const mb=new BABYLON.StandardMaterial('mb',scene); mb.emissiveColor=new BABYLON.Color3(0.1,0.2,1); mb.disableLighting=true;
  barR.material=mr; barB.material=mb; barR.parent=veh.root; barB.parent=veh.root;
  barR.position.set(-0.3,1.35,-0.1); barB.position.set(0.3,1.35,-0.1); barR.isPickable=barB.isPickable=false;
  // door decals (blue stripe)
  return { root:veh.root, wheels:veh.wheels, mr, mb, heading:veh.root.rotation.y, speed:0, lightT:0, parked:false };
}

function spawnPoliceCar(){
  const a=rand(0,Math.PI*2), dist=rand(40,60);
  const x=clamp(Game.player.position.x+Math.cos(a)*dist,-WORLD+6,WORLD-6);
  const z=clamp(Game.player.position.z+Math.sin(a)*dist,-WORLD+6,WORLD-6);
  Game.policeCars.push(buildCopCar(Game.scene,x,z));
  startSiren();
}

function updatePoliceCars(dt){
  if(Game.policeCars.length===0){ stopSiren(); return; }
  const p=Game.player.position;
  for(const c of Game.policeCars){
    // flashing lights
    c.lightT+=dt; const on=Math.sin(c.lightT*9)>0;
    c.mr.emissiveColor=new BABYLON.Color3(on?1:0.15,0.05,0.05);
    c.mb.emissiveColor=new BABYLON.Color3(0.05,0.05,on?0.2:1);
    if(c.parked) continue;
    // steer toward player
    const dx=p.x-c.root.position.x, dz=p.z-c.root.position.z, d=Math.hypot(dx,dz);
    const want=Math.atan2(dx,dz);
    let da=want-c.heading; while(da>Math.PI)da-=2*Math.PI; while(da<-Math.PI)da+=2*Math.PI;
    c.heading+=clamp(da,-2*dt,2*dt);
    c.speed=lerp(c.speed, d>6?16:0, 0.05);
    const fx=Math.sin(c.heading), fz=Math.cos(c.heading);
    const np={x:c.root.position.x+fx*c.speed*dt, z:c.root.position.z+fz*c.speed*dt};
    resolveCollision(np,1.9);
    c.root.position.x=np.x; c.root.position.z=np.z;
    c.root.position.y=lerp(c.root.position.y, heightAt(np.x,np.z)+0.45, 0.25);
    c.root.rotation.set(0,c.heading,0);
    c.wheels.forEach(w=>{ w.piv.rotation.x+=c.speed*dt*2.2; });
    // ram damage
    if(c.speed>6 && d<3.0) damagePlayer(10);
  }
}

function spawnRoadblock(){
  // find a road point ahead of the player and park two cruisers across it
  let best=null, bd=1e9;
  for(const r of ROADS){ for(let t=0.15;t<=0.85;t+=0.18){
    const x=lerp(r.x1,r.x2,t), z=lerp(r.z1,r.z2,t);
    const d=Math.hypot(x-Game.player.position.x,z-Game.player.position.z);
    if(d>16 && d<46 && d<bd){ bd=d; best={x,z,r}; }
  }}
  if(!best) return;
  const ang=Math.atan2(best.r.x2-best.r.x1,best.r.z2-best.r.z1)+Math.PI/2;
  const px=Math.cos(ang), pz=-Math.sin(ang);
  for(let i=-1;i<=1;i+=2){
    const cx=best.x+px*i*1.6, cz=best.z+pz*i*1.6;
    const car=buildCopCar(Game.scene,cx,cz); car.parked=true; car.heading=ang; car.root.rotation.y=ang;
    Game.policeCars.push(car);
  }
  // two officers behind the block
  const old=Game.player.position;
  for(let i=0;i<2;i++){ spawnCopAt(best.x+px*(i?-2:2), best.z+pz*(i?-2:2)); }
  Game.roadblocks.push(best); startSiren();
  toast('🚧 ROADBLOCK AHEAD');
}
function spawnCopAt(x,z){
  const rig=buildHumanoid(Game.scene, COP_KIT, 1.0, Game.settings.shadows, true);
  rig.root.position.set(x,heightAt(x,z),z);
  const hp=70+Game.wanted*18;
  Game.police.push({ rig, body:rig.root, hp, maxHp:hp, speed:3.2+Game.wanted*0.15,
    fireCd:rand(0.8,1.8), phase:rand(0,6), dmg:7+Game.wanted, range:16 });
}
function clearPoliceCars(){
  Game.policeCars.forEach(c=>c.root.dispose(false,true)); Game.policeCars=[];
  Game.roadblocks=[]; stopSiren();
}
