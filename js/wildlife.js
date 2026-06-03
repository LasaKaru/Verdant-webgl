"use strict";
/* =====================================================================
   VERDANT — wildlife.js
   Sky detail (drifting low-poly clouds + a night star dome) and living
   fauna: wandering deer that bolt when startled, and flocking birds.
   ===================================================================== */

/* ------------------------- clouds ------------------------- */
function buildClouds(scene){
  Game.clouds=[];
  const cloudMat=new BABYLON.StandardMaterial('cloudMat',scene);
  cloudMat.diffuseColor=new BABYLON.Color3(1,1,1); cloudMat.emissiveColor=new BABYLON.Color3(0.6,0.62,0.68);
  cloudMat.specularColor=new BABYLON.Color3(0,0,0); cloudMat.alpha=0.92;
  const n = Game.settings.quality==='low'?14:24;
  for(let i=0;i<n;i++){
    const puffs=[];
    const blobs=3+((Math.random()*3)|0);
    for(let b=0;b<blobs;b++){
      const s=BABYLON.MeshBuilder.CreateSphere('cp',{diameter:rand(8,16),segments:5},scene);
      s.position.set(rand(-9,9),rand(-2,2),rand(-6,6)); s.scaling.y=0.55; puffs.push(s);
    }
    const cloud=BABYLON.Mesh.MergeMeshes(puffs,true,true);
    cloud.material=cloudMat; cloud.isPickable=false; cloud.applyFog=false;
    cloud.position.set(rand(-WORLD,WORLD), rand(95,135), rand(-WORLD,WORLD));
    Game.clouds.push({mesh:cloud, sp:rand(1.5,4)});
  }
  Game.cloudMat=cloudMat;
}
function updateClouds(dt,sunH){
  for(const c of Game.clouds){
    c.mesh.position.x += c.sp*dt;
    if(c.mesh.position.x>WORLD+40) c.mesh.position.x=-WORLD-40;
  }
  if(Game.cloudMat){ const tint=clamp(sunH+0.4,0.18,1);
    Game.cloudMat.emissiveColor=new BABYLON.Color3(0.6*tint,0.62*tint,0.68*tint); }
}

/* ------------------------- star dome ------------------------- */
function buildStars(scene){
  const dome=BABYLON.MeshBuilder.CreateSphere('stars',{diameter:900,segments:16,sideOrientation:BABYLON.Mesh.BACKSIDE},scene);
  const t=new BABYLON.DynamicTexture('starTex',{width:1024,height:1024},scene,false);
  const c=t.getContext(); c.fillStyle='rgba(0,0,0,0)'; c.clearRect(0,0,1024,1024);
  for(let i=0;i<520;i++){ const x=Math.random()*1024,y=Math.random()*1024,r=Math.random()*1.6+0.4;
    c.fillStyle='rgba(255,255,255,'+(0.4+Math.random()*0.6)+')'; c.beginPath(); c.arc(x,y,r,0,7); c.fill(); }
  t.hasAlpha=true; t.update();
  const m=new BABYLON.StandardMaterial('starMat',scene);
  m.emissiveTexture=t; m.opacityTexture=t; m.disableLighting=true; m.backFaceCulling=false;
  m.diffuseColor=new BABYLON.Color3(0,0,0); m.specularColor=new BABYLON.Color3(0,0,0);
  dome.material=m; dome.isPickable=false; dome.applyFog=false; dome.infiniteDistance=true; dome.renderingGroupId=0;
  Game.starDome=dome; Game.starMat=m; m.alpha=0;
}
function updateStars(sunH){
  if(Game.starMat) Game.starMat.alpha=clamp(-sunH*1.4-0.05,0,0.95);
}

/* ------------------------- deer ------------------------- */
function buildDeer(scene,x,z){
  const root=new BABYLON.TransformNode('deer',scene);
  const tan=bmat(scene,'deerT',[0.55,0.36,0.2]), dark=bmat(scene,'deerD',[0.32,0.2,0.12]),
        light=bmat(scene,'deerL',[0.78,0.62,0.45]);
  const cast=[];
  const mk=(w,h,d,mat,parent,px,py,pz)=>{ const m=BABYLON.MeshBuilder.CreateBox('d',{width:w,height:h,depth:d},scene);
    m.material=mat; m.parent=parent; m.position.set(px,py,pz); m.isPickable=false; cast.push(m); return m; };
  mk(0.7,0.7,1.5,tan,root,0,1.0,0);            // body
  const neck=mk(0.4,0.6,0.4,tan,root,0,1.45,0.8); neck.rotation.x=-0.5;
  const head=mk(0.36,0.4,0.6,light,root,0,1.75,1.05);
  // antlers
  mk(0.07,0.5,0.07,dark,head,0.14,0.4,0); mk(0.07,0.5,0.07,dark,head,-0.14,0.4,0);
  // legs (pivots)
  const legs=[];
  [[-0.25,0.6],[0.25,0.6],[-0.25,-0.6],[0.25,-0.6]].forEach(([lx,lz])=>{
    const piv=new BABYLON.TransformNode('lp',scene); piv.parent=root; piv.position.set(lx,0.7,lz);
    mk(0.16,0.7,0.16,dark,piv,0,-0.35,0); legs.push(piv);
  });
  root.position.set(x,heightAt(x,z),z); root.rotation.y=rand(0,6);
  if(Game.settings.shadows&&Game.shadowGen) cast.forEach(m=>Game.shadowGen.addShadowCaster(m));
  return {root,legs,phase:rand(0,6),tx:x,tz:z,wait:rand(0,3),flee:false};
}
function spawnDeer(scene){
  Game.deer=[];
  const n=Game.settings.quality==='low'?5:9;
  for(let i=0;i<n;i++){ let x,z,g=0;
    do{ x=rand(-WORLD+12,WORLD-12); z=rand(-WORLD+12,WORLD-12); g++; }
    while((inCity(x,z)||biomeAt(x,z)===2||heightAt(x,z)<-1)&&g<20);
    Game.deer.push(buildDeer(scene,x,z));
  }
}
function updateDeer(dt){
  const p=Game.player.position;
  for(const d of Game.deer){
    const pos=d.root.position;
    const pd=Math.hypot(p.x-pos.x,p.z-pos.z);
    let threat=pd<16;
    for(const e of Game.enemies){ if(BABYLON.Vector3.Distance(pos,e.body.position)<18){threat=true;break;} }
    let tx,tz,sp;
    if(threat){ const dx=pos.x-p.x, dz=pos.z-p.z, dd=Math.hypot(dx,dz)||1; tx=pos.x+dx/dd*14; tz=pos.z+dz/dd*14; sp=9.5; }
    else { tx=d.tx; tz=d.tz; sp=2.6; }
    const dx=tx-pos.x, dz=tz-pos.z, dist=Math.hypot(dx,dz); let moved=false;
    if(dist>0.7){ const nx=dx/dist,nz=dz/dist; pos.x+=nx*sp*dt; pos.z+=nz*sp*dt;
      pos.x=clamp(pos.x,-WORLD+4,WORLD-4); pos.z=clamp(pos.z,-WORLD+4,WORLD-4);
      d.root.rotation.y=lerp(d.root.rotation.y, Math.atan2(nx,nz), 0.2); moved=true;
    } else if(!threat){ d.wait-=dt; if(d.wait<=0){ d.tx=pos.x+rand(-16,16); d.tz=pos.z+rand(-16,16); d.wait=rand(2,5); } }
    pos.y=heightAt(pos.x,pos.z);
    d.phase+=dt*(moved?(threat?20:9):0);
    const a=Math.sin(d.phase)*0.6;
    d.legs[0].rotation.x=a; d.legs[3].rotation.x=a; d.legs[1].rotation.x=-a; d.legs[2].rotation.x=-a;
  }
}

/* ------------------------- birds ------------------------- */
function buildBirds(scene){
  Game.flocks=[];
  const birdMat=bmat(scene,'bird',[0.15,0.15,0.18]); birdMat.emissiveColor=new BABYLON.Color3(0.05,0.05,0.06);
  const flocks=Game.settings.quality==='low'?2:3;
  for(let f=0;f<flocks;f++){
    const center={x:rand(-60,60),z:rand(-60,60)}, R=rand(20,40), y=rand(28,42), birds=[];
    for(let i=0;i<6+((Math.random()*5)|0);i++){
      const wing=[];
      const l=BABYLON.MeshBuilder.CreateBox('wg',{width:1.4,height:0.06,depth:0.4},scene);
      const piv=new BABYLON.TransformNode('bp',scene);
      l.parent=piv; l.material=birdMat; l.isPickable=false;
      birds.push({piv, off:rand(0,6), rad:R+rand(-6,6), yo:rand(-3,3)});
    }
    Game.flocks.push({center,y,birds,ang:rand(0,6),sp:rand(0.2,0.4)});
  }
}
function updateBirds(dt,t){
  for(const fl of Game.flocks){
    fl.ang+=fl.sp*dt;
    fl.birds.forEach((b,i)=>{
      const a=fl.ang+i*0.5;
      const x=fl.center.x+Math.cos(a)*b.rad, z=fl.center.z+Math.sin(a)*b.rad, y=fl.y+b.yo+Math.sin(t*0.001+i)*1.2;
      b.piv.position.set(x,y,z);
      b.piv.rotation.y=-a+Math.PI/2;
      const flap=Math.sin(t*0.012+b.off)*0.6; b.piv.rotation.z=flap;   // wing flap
    });
  }
}

/* ------------------------- city pedestrians ------------------------- */
function spawnPedestrians(scene){
  // populate downtown streets with wandering people (reuses villager AI)
  const n=Game.settings.quality==='low'?6:12;
  for(let i=0;i<n;i++){
    let x,z,g=0; do{ x=CITY.x+rand(-CITY.r+6,CITY.r-6); z=CITY.z+rand(-CITY.r+6,CITY.r-6); g++; }
    while(!inCity(x,z,4)&&g<20);
    spawnVillager(scene,x,z);
  }
}

function buildLife(scene){
  buildClouds(scene); buildStars(scene); spawnDeer(scene); buildBirds(scene); spawnPedestrians(scene);
}
