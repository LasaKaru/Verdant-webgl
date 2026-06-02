"use strict";
/* =====================================================================
   VERDANT — traffic.js
   Autonomous AI cars that drive the road network. They follow road
   centrelines in the right-hand lane, pick a new connected street at
   each intersection, brake for the car ahead, and can be run into.
   ===================================================================== */

/* build adjacency of road endpoints so cars can turn at junctions */
let _roadNodes=null;
function roadGraph(){
  if(_roadNodes) return _roadNodes;
  _roadNodes=[];
  ROADS.forEach((r,i)=>{
    _roadNodes.push({seg:i,end:0,x:r.x1,z:r.z1});
    _roadNodes.push({seg:i,end:1,x:r.x2,z:r.z2});
  });
  return _roadNodes;
}
function connectionsAt(x,z,exceptSeg){
  const out=[];
  roadGraph().forEach(n=>{ if(n.seg===exceptSeg) return;
    if(Math.hypot(n.x-x,n.z-z)<7) out.push(n); });
  return out;
}

function spawnTraffic(scene){
  Game.traffic=[];
  const n = Game.settings.quality==='low'?5 : Game.settings.quality==='high'?12 : 8;
  for(let i=0;i<n;i++){
    const seg=(Math.random()*ROADS.length)|0;
    const veh=buildVehicle(scene, ROADS[seg].x1, ROADS[seg].z1);
    // strip its collider push? keep — traffic blocks too. Remove from drivable pool:
    Game.vehicles=Game.vehicles.filter(v=>v.root!==veh.root);
    Game.traffic.push({ root:veh.root, wheels:veh.wheels, seg, t:Math.random(), dir:Math.random()<0.5?1:-1,
      speed:rand(7,12), brake:0 });
  }
}

function updateTraffic(dt){
  for(const c of Game.traffic){
    const r=ROADS[c.seg]; const len=Math.hypot(r.x2-r.x1,r.z2-r.z1);
    // brake if a car (or the player) is just ahead
    const ax=c.root.position.x, az=c.root.position.z;
    let blocked=false;
    const fwdx=(r.x2-r.x1)/len*c.dir, fwdz=(r.z2-r.z1)/len*c.dir;
    const px=Game.player.position.x, pz=Game.player.position.z;
    const aheadP=( (px-ax)*fwdx + (pz-az)*fwdz );
    if(aheadP>0 && aheadP<7 && Math.hypot(px-ax,pz-az)<5) blocked=true;
    for(const o of Game.traffic){ if(o===c) continue;
      const d=(o.root.position.x-ax)*fwdx+(o.root.position.z-az)*fwdz;
      if(d>0 && d<8 && Math.hypot(o.root.position.x-ax,o.root.position.z-az)<6){ blocked=true; break; } }
    c.brake = blocked ? 1 : lerp(c.brake,0,0.1);
    const v=c.speed*(1-c.brake);
    c.t += (v*dt/len)*c.dir;
    // reached an end → hop to a connected street
    if(c.t>1 || c.t<0){
      const endX = c.t>1?r.x2:r.x1, endZ = c.t>1?r.z2:r.z1;
      const conns=connectionsAt(endX,endZ,c.seg);
      if(conns.length){ const n=conns[(Math.random()*conns.length)|0];
        c.seg=n.seg; c.t = n.end===0?0:1; c.dir = n.end===0?1:-1;
      } else { c.dir*=-1; c.t=clamp(c.t,0,1); }
      continue;
    }
    const rr=ROADS[c.seg], rl=Math.hypot(rr.x2-rr.x1,rr.z2-rr.z1);
    const cx=lerp(rr.x1,rr.x2,c.t), cz=lerp(rr.z1,rr.z2,c.t);
    const ang=Math.atan2(rr.x2-rr.x1, rr.z2-rr.z1)*1 + (c.dir<0?Math.PI:0);
    // right-lane offset
    const ox=Math.cos(ang)*1.3, oz=-Math.sin(ang)*1.3;
    const fx=cx+ox, fz=cz+oz, fy=heightAt(fx,fz)+0.45;
    c.root.position.set(fx, lerp(c.root.position.y,fy,0.3), fz);
    c.root.rotation.y=ang;
    c.wheels.forEach(w=>{ w.piv.rotation.x += v*dt*2.2; });
  }
}
