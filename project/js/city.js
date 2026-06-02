"use strict";
/* =====================================================================
   VERDANT — city.js
   A downtown district: asphalt road network with lane markings, real
   multi-storey buildings + skyscrapers with procedural window facades,
   and street lamps that glow at night.
   ===================================================================== */

/* ------------------------- window facade textures ------------------------- */
function makeWindowTexture(scene, base, lit){
  const sz=256, t=new BABYLON.DynamicTexture('win',{width:sz,height:sz},scene,false);
  const c=t.getContext();
  c.fillStyle=base; c.fillRect(0,0,sz,sz);
  const cols=6, rows=8, pad=8, gw=(sz-pad*2)/cols, gh=(sz-pad*2)/rows;
  for(let r=0;r<rows;r++)for(let col=0;col<cols;col++){
    const onLit = Math.random()<0.5;
    c.fillStyle = onLit ? lit : '#16202b';
    c.fillRect(pad+col*gw+2, pad+r*gh+2, gw-5, gh-6);
  }
  t.update();
  return t;
}
let _facades=null;
function cityMaterials(scene){
  if(_facades) return _facades;
  const defs=[['#3c4a5a','#ffe39a'],['#4a4438','#bfe0ff'],['#39424a','#ffd27a'],
              ['#56504a','#cfeaff'],['#2f3b46','#fff0b0']];
  _facades = defs.map(([b,l],i)=>{
    const m=new BABYLON.StandardMaterial('fac'+i,scene);
    m.diffuseTexture=makeWindowTexture(scene,b,l);
    m.emissiveTexture=m.diffuseTexture; m.emissiveColor=new BABYLON.Color3(0.0,0.0,0.0);
    m.specularColor=new BABYLON.Color3(0.05,0.05,0.06);
    m._litBase=l; return m;
  });
  return _facades;
}
// night emissive boost so windows glow after dark
function updateCityLights(sunH){
  if(!_facades) return;
  const glow = clamp(0.55-(sunH+0.1), 0, 0.85);
  _facades.forEach(m=>m.emissiveColor=new BABYLON.Color3(glow*0.9,glow*0.85,glow*0.6));
  if(Game.streetlamps){ const on=sunH<0.06;
    Game.streetlamps.forEach(l=>l.material.emissiveColor = on?new BABYLON.Color3(1,0.85,0.5):new BABYLON.Color3(0.3,0.28,0.2)); }
}

/* ------------------------- roads ------------------------- */
function buildRoads(scene){
  const roadMat=new BABYLON.StandardMaterial('roadMat',scene);
  roadMat.diffuseColor=new BABYLON.Color3(0.16,0.16,0.18); roadMat.specularColor=new BABYLON.Color3(0.02,0.02,0.02);
  const lineMat=new BABYLON.StandardMaterial('lineMat',scene);
  lineMat.diffuseColor=new BABYLON.Color3(0.9,0.85,0.4); lineMat.emissiveColor=new BABYLON.Color3(0.25,0.22,0.08);
  const sideMat=new BABYLON.StandardMaterial('sideMat',scene);
  sideMat.diffuseColor=new BABYLON.Color3(0.62,0.62,0.66); sideMat.specularColor=new BABYLON.Color3(0,0,0);

  for(const r of ROADS){
    const dx=r.x2-r.x1, dz=r.z2-r.z1, len=Math.hypot(dx,dz), ang=Math.atan2(dx,dz);
    const mx=(r.x1+r.x2)/2, mz=(r.z1+r.z2)/2;
    const y=heightAt(mx,mz);
    // sidewalk (slightly wider, raised)
    const side=BABYLON.MeshBuilder.CreateBox('side',{width:r.w+2.4,height:0.34,depth:len},scene);
    side.rotation.y=ang; side.position.set(mx,y+0.04,mz); side.material=sideMat; side.isPickable=false; side.receiveShadows=true;
    // asphalt
    const road=BABYLON.MeshBuilder.CreateBox('road',{width:r.w,height:0.4,depth:len},scene);
    road.rotation.y=ang; road.position.set(mx,y+0.1,mz); road.material=roadMat; road.isPickable=false; road.receiveShadows=true;
    // dashed center line
    const dashes=Math.floor(len/6);
    for(let i=0;i<dashes;i++){
      const tt=(i+0.5)/dashes; const lx=lerp(r.x1,r.x2,tt), lz=lerp(r.z1,r.z2,tt);
      const dash=BABYLON.MeshBuilder.CreateBox('dash',{width:0.35,height:0.05,depth:2.4},scene);
      dash.rotation.y=ang; dash.position.set(lx,heightAt(lx,lz)+0.31,lz); dash.material=lineMat; dash.isPickable=false;
    }
  }
}

/* ------------------------- buildings ------------------------- */
function buildCity(scene){
  const facades=cityMaterials(scene);
  const roofMat=new BABYLON.StandardMaterial('croof',scene);
  roofMat.diffuseColor=new BABYLON.Color3(0.2,0.2,0.23); roofMat.specularColor=new BABYLON.Color3(0,0,0);
  Game.cityBuildings=[];
  const cx=CITY.x, cz=CITY.z, g=16, half=8;
  // place a building in each block quadrant offset from intersections
  for(let bi=-2;bi<=1;bi++) for(let bj=-2;bj<=1;bj++){
    const baseX=cx+bi*g+g/2, baseZ=cz+bj*g+g/2;
    // up to a couple lots per block
    for(let q=0;q<2;q++){
      const x=baseX+rand(-3,3), z=baseZ+rand(-3,3);
      if(!inCity(x,z,4)) continue;
      if(onRoad(x,z)) continue;
      const distToCore=Math.hypot(x-cx,z-cz);
      const tall = distToCore<18;                 // skyscrapers in the core
      const floors = tall ? Math.floor(rand(8,16)) : Math.floor(rand(2,6));
      const fh=2.6, h=floors*fh;
      const w=rand(6,9), d=rand(6,9);
      const y=heightAt(x,z);
      const b=BABYLON.MeshBuilder.CreateBox('bldg',{width:w,height:h,depth:d},scene);
      b.position.set(x,y+h/2,z);
      const fmat=facades[(Math.random()*facades.length)|0];
      b.material=fmat; b.isPickable=false; b.receiveShadows=true;
      // tile the window texture by floors
      if(fmat.diffuseTexture){ /* shared; per-mesh uv scale via instance not trivial — keep shared look */ }
      // rooftop cap
      const cap=BABYLON.MeshBuilder.CreateBox('cap',{width:w*0.96,height:0.6,depth:d*0.96},scene);
      cap.position.set(x,y+h+0.3,z); cap.material=roofMat; cap.isPickable=false;
      if(tall){ // antenna / water tank
        const ant=BABYLON.MeshBuilder.CreateCylinder('ant',{height:rand(2,5),diameter:0.3,tessellation:5},scene);
        ant.position.set(x+rand(-2,2),y+h+rand(1.5,3),z+rand(-2,2)); ant.material=roofMat; ant.isPickable=false;
      }
      if(Game.settings.shadows&&Game.shadowGen){ Game.shadowGen.addShadowCaster(b); }
      addCollider(x,z,Math.max(w,d)*0.62);
      Game.cityBuildings.push({x,z});
    }
  }
}

/* ------------------------- streetlights ------------------------- */
function buildStreetlights(scene){
  Game.streetlamps=[];
  const poleMat=new BABYLON.StandardMaterial('pole',scene); poleMat.diffuseColor=new BABYLON.Color3(0.2,0.2,0.22);
  const lampMat=new BABYLON.StandardMaterial('lamp',scene); lampMat.emissiveColor=new BABYLON.Color3(1,0.85,0.5); lampMat.disableLighting=true;
  for(const r of ROADS){
    const len=Math.hypot(r.x2-r.x1,r.z2-r.z1), n=Math.floor(len/14), ang=Math.atan2(r.x2-r.x1,r.z2-r.z1);
    const ox=Math.cos(ang)*(r.w*0.5+1.6), oz=-Math.sin(ang)*(r.w*0.5+1.6);
    for(let i=0;i<=n;i++){
      const tt=i/Math.max(1,n), lx=lerp(r.x1,r.x2,tt)+ox, lz=lerp(r.z1,r.z2,tt)+oz;
      if(!inCity(lx,lz,1) && distToSeg(lx,lz,0,0,CITY.x,CITY.z)>5) continue;
      const y=heightAt(lx,lz);
      const pole=BABYLON.MeshBuilder.CreateCylinder('lp',{height:5,diameter:0.25,tessellation:6},scene);
      pole.position.set(lx,y+2.5,lz); pole.material=poleMat; pole.isPickable=false;
      const head=BABYLON.MeshBuilder.CreateBox('lh',{width:0.5,height:0.3,depth:1.2},scene);
      head.position.set(lx,y+5,lz); head.material=lampMat; head.isPickable=false;
      Game.streetlamps.push(head);
    }
  }
}

function buildUrban(scene){
  buildRoadNetwork();
  buildRoads(scene);
  buildCity(scene);
  buildStreetlights(scene);
  buildEnterables(scene);
}

/* ------------------------- enterable buildings ------------------------- */
// add circle colliders along a wall segment, skipping an optional door gap
function wallColliders(x1,z1,x2,z2){
  const dx=x2-x1, dz=z2-z1, len=Math.hypot(dx,dz), n=Math.ceil(len/1.1);
  for(let i=0;i<=n;i++){ const t=i/n; addCollider(x1+dx*t, z1+dz*t, 0.65); }
}
function placeEnterable(scene,cx,cz){
  const y=heightAt(cx,cz);
  const w=rand(8,11), d=rand(8,11), h=3.4, doorW=2.2;
  const root=new BABYLON.TransformNode('shopB',scene); root.position.set(cx,y,cz);
  const wallCols=[[0.90,0.84,0.66],[0.86,0.70,0.58],[0.74,0.82,0.86]];
  const wc=wallCols[(Math.random()*wallCols.length)|0];
  const wallMat=flatMat(scene,'swall',wc[0],wc[1],wc[2]);
  const floorMat=flatMat(scene,'sfloor',0.32,0.30,0.28);
  const box=(ww,hh,dd,mat,px,py,pz)=>{ const m=BABYLON.MeshBuilder.CreateBox('w',{width:ww,height:hh,depth:dd},scene);
    m.material=mat; m.parent=root; m.position.set(px,py,pz); m.isPickable=false;
    if(Game.settings.shadows&&Game.shadowGen) Game.shadowGen.addShadowCaster(m); return m; };
  // floor + flat roof
  box(w,0.2,d,floorMat,0,0.1,0);
  box(w+0.4,0.4,d+0.4,wallMat,0,h+0.2,0);
  // back + sides (solid)
  box(w,h,0.3,wallMat,0,h/2,d/2);
  box(0.3,h,d,wallMat,-w/2,h/2,0);
  box(0.3,h,d,wallMat, w/2,h/2,0);
  // front wall with central door gap
  const seg=(w-doorW)/2;
  box(seg,h,0.3,wallMat, -(doorW/2+seg/2), h/2, -d/2);
  box(seg,h,0.3,wallMat,  (doorW/2+seg/2), h/2, -d/2);
  box(doorW+0.2,0.8,0.3,wallMat, 0, h-0.4, -d/2);               // lintel over door
  // interior ceiling lamp (glows)
  const lamp=box(1.4,0.18,1.4,flatMat(scene,'slamp',1,0.93,0.7,{emissive:[0.9,0.84,0.6]}),0,h-0.25,0);
  // glowing OPEN sign over the door
  const sign=BABYLON.MeshBuilder.CreatePlane('sign',{width:doorW+0.4,height:0.7},scene);
  const sm=new BABYLON.DynamicTexture('signT',{width:256,height:64},scene,false);
  sm.getContext().fillStyle='#0c1a10'; sm.getContext().fillRect(0,0,256,64);
  sm.drawText('★ OPEN ★',32,46,'bold 38px Oswald, sans-serif','#86e04a','transparent'); sm.update();
  const sgM=new BABYLON.StandardMaterial('sgM',scene); sgM.emissiveTexture=sm; sgM.opacityTexture=sm; sm.hasAlpha=true;
  sgM.disableLighting=true; sign.material=sgM; sign.parent=root; sign.position.set(0,h*0.62,-d/2-0.2); sign.isPickable=false;
  // colliders: 3 solid walls + 2 front segments (door gap stays open)
  const hw=w/2, hd=d/2;
  wallColliders(cx-hw,cz+hd,cx+hw,cz+hd);     // back
  wallColliders(cx-hw,cz-hd,cx-hw,cz+hd);     // left
  wallColliders(cx+hw,cz-hd,cx+hw,cz+hd);     // right
  wallColliders(cx-hw,cz-hd,cx-doorW/2,cz-hd);// front-left
  wallColliders(cx+doorW/2,cz-hd,cx+hw,cz-hd);// front-right
  Game.interiors.push({x:cx,z:cz});           // loot respawns here on reset
}
function buildEnterables(scene){
  Game.interiors=[];
  // line a few shops along the spawn avenue + city edge, doors facing the street (south)
  const spots=[ {x:CITY.x-26,z:CITY.z-30}, {x:CITY.x-10,z:CITY.z-34}, {x:CITY.x+12,z:CITY.z-28},
                {x:30,z:34}, {x:CITY.x-34,z:CITY.z-6} ];
  spots.forEach(s=>{ if(inCity(s.x,s.z,2)||Math.hypot(s.x-0,s.z-0)>20){ placeEnterable(scene,s.x,s.z); } });
}
function spawnInteriorLoot(){
  (Game.interiors||[]).forEach(s=>{
    const types=['medkit','ammo','armor','grenade'];
    spawnItem(Game.scene, types[(Math.random()*types.length)|0], s.x+rand(-2,2), s.z+rand(-1,2));
  });
}
