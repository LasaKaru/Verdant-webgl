"use strict";
/* =====================================================================
   VERDANT — props.js
   A big batch of extra low-poly world detail: instanced scatter props
   (barrels, crates, hay, stumps, mushrooms, cacti, boulders, lamp posts,
   fences) plus a handful of composite landmarks (wells, signposts,
   campfires, tents, market stalls, windmills). Lamp/fire glow at night.
   ===================================================================== */

let _xpN=0;
function nextProp(p){ return p+(_xpN++); }

function makeExtraBases(scene){
  const B={};
  const barrel=BABYLON.MeshBuilder.CreateCylinder('barrelBase',{height:1.1,diameter:0.72,tessellation:8},scene);
  barrel.material=flatMat(scene,'barrelm',0.55,0.34,0.18); barrel.setEnabled(false); B.barrel=barrel;

  const crate=BABYLON.MeshBuilder.CreateBox('crateBase',{size:0.9},scene);
  crate.material=flatMat(scene,'cratem',0.62,0.45,0.24); crate.setEnabled(false); B.crate=crate;

  const hay=BABYLON.MeshBuilder.CreateCylinder('hayBase',{height:1.2,diameter:1.35,tessellation:10},scene);
  hay.material=flatMat(scene,'haym',0.82,0.70,0.30); hay.setEnabled(false); B.hay=hay;

  const stump=BABYLON.MeshBuilder.CreateCylinder('stumpBase',{height:0.6,diameterTop:0.62,diameterBottom:0.74,tessellation:8},scene);
  stump.material=flatMat(scene,'stumpm',0.40,0.27,0.15); stump.setEnabled(false); B.stump=stump;

  // mushroom — stem + cap merged
  const ms=BABYLON.MeshBuilder.CreateCylinder('ms',{height:0.5,diameter:0.18,tessellation:6},scene);
  const mc=BABYLON.MeshBuilder.CreateCylinder('mc',{height:0.34,diameterTop:0,diameterBottom:0.62,tessellation:8},scene);
  mc.position.y=0.42; const mush=BABYLON.Mesh.MergeMeshes([ms,mc],true,true);
  mush.material=flatMat(scene,'mushm',0.90,0.30,0.28,{emissive:[0.18,0.04,0.04]}); mush.setEnabled(false); B.mush=mush;

  // cactus — body + two arms merged
  const cb=BABYLON.MeshBuilder.CreateCylinder('cb',{height:2.2,diameter:0.6,tessellation:7},scene);
  const ca1=BABYLON.MeshBuilder.CreateCylinder('ca1',{height:0.9,diameter:0.34,tessellation:6},scene); ca1.position.set(0.42,0.4,0); ca1.rotation.z=-0.5;
  const ca2=BABYLON.MeshBuilder.CreateCylinder('ca2',{height:0.8,diameter:0.32,tessellation:6},scene); ca2.position.set(-0.4,0.7,0); ca2.rotation.z=0.5;
  const cac=BABYLON.Mesh.MergeMeshes([cb,ca1,ca2],true,true);
  cac.material=flatMat(scene,'cacm',0.28,0.5,0.26); cac.setEnabled(false); B.cactus=cac;

  const boulder=BABYLON.MeshBuilder.CreatePolyhedron('boulderBase',{type:2,size:1},scene);
  boulder.material=flatMat(scene,'boulderm',0.50,0.50,0.53); boulder.setEnabled(false); B.boulder=boulder;

  const fpost=BABYLON.MeshBuilder.CreateBox('fpostBase',{width:0.16,height:1.1,depth:0.16},scene);
  fpost.material=flatMat(scene,'fencem',0.50,0.36,0.20); fpost.setEnabled(false); B.fpost=fpost;
  const frail=BABYLON.MeshBuilder.CreateBox('frailBase',{width:0.10,height:0.14,depth:2.3},scene);
  frail.material=flatMat(scene,'fencem2',0.53,0.39,0.22); frail.setEnabled(false); B.frail=frail;

  // lamp post — pole + head merged; head material kept for night glow
  const pole=BABYLON.MeshBuilder.CreateCylinder('lp',{height:3.2,diameter:0.18,tessellation:6},scene);
  pole.material=flatMat(scene,'lampm',0.16,0.16,0.18); pole.setEnabled(false); B.lampPole=pole;
  const head=BABYLON.MeshBuilder.CreateBox('lh',{width:0.5,height:0.4,depth:0.5},scene);
  const headMat=flatMat(scene,'lampheadm',0.95,0.86,0.55,{emissive:[0.1,0.09,0.05]});
  head.material=headMat; head.setEnabled(false); B.lampHead=head; B.lampHeadMat=headMat;

  // pine — stacked narrow conifer cones (uses world.js trunk base for the stem)
  const pc=[]; for(let i=0;i<3;i++){ const c=BABYLON.MeshBuilder.CreateCylinder('pc',{height:1.8,diameterTop:0,diameterBottom:2.4-i*0.6,tessellation:6},scene); c.position.y=i*1.2; pc.push(c); }
  const pine=BABYLON.Mesh.MergeMeshes(pc,true,true); pine.material=flatMat(scene,'pinem',0.10,0.34,0.18); pine.setEnabled(false); B.pine=pine;

  // palm — radial fronds
  const fr=[]; for(let i=0;i<6;i++){ const f=BABYLON.MeshBuilder.CreateCylinder('pf',{height:2.2,diameterTop:0,diameterBottom:0.55,tessellation:4},scene);
    f.rotation.z=1.05; f.rotation.y=i/6*Math.PI*2; fr.push(f); }
  const palm=BABYLON.Mesh.MergeMeshes(fr,true,true); palm.material=flatMat(scene,'palmm',0.26,0.55,0.24); palm.setEnabled(false); B.palm=palm;

  // crystal — merged glowing prisms (shared emissive material pulses at night)
  const cr=[]; for(let i=0;i<3;i++){ const p=BABYLON.MeshBuilder.CreatePolyhedron('cr',{type:1,size:rand(0.5,1.0)},scene);
    p.scaling.y=rand(2,3.2); p.position.set(rand(-0.4,0.4),rand(0,0.5),rand(-0.4,0.4)); p.rotation.y=rand(0,3); cr.push(p); }
  const crystalMat=flatMat(scene,'crystalm',0.45,0.75,0.95,{emissive:[0.1,0.3,0.4]});
  const crystal=BABYLON.Mesh.MergeMeshes(cr,true,true); crystal.material=crystalMat; crystal.setEnabled(false); B.crystal=crystal; Game.crystalMat=crystalMat;

  Game.xbases=B; Game.xLamps=[]; Game.xFires=[];
  return B;
}

/* ------------------------- nature: pine / palm / crystal ------------------------- */
function placePine(scene,x,z,shadows){
  const y=heightAt(x,z); if(y<-2.4) return; const s=rand(0.9,1.7), h=rand(3,5)*s;
  const tr=Game.bases.trunk.createInstance(nextProp('pt')); tr.position.set(x,y+h/2,z); tr.scaling.set(s*0.8,h,s*0.8); tr.isPickable=false;
  const f=Game.xbases.pine.createInstance(nextProp('pinef')); f.position.set(x,y+h-0.6,z); f.scaling.setAll(s); f.isPickable=false;
  if(shadows&&Game.shadowGen){ Game.shadowGen.addShadowCaster(tr); Game.shadowGen.addShadowCaster(f); }
  addCollider(x,z,0.5*s);
}
function placePalm(scene,x,z,shadows){
  const y=heightAt(x,z); if(y<-2.6) return; const s=rand(0.9,1.4), h=rand(4,6)*s;
  const tr=Game.bases.trunk.createInstance(nextProp('plt')); tr.position.set(x,y+h/2,z); tr.scaling.set(s*0.55,h,s*0.55); tr.rotation.z=rand(-0.12,0.12); tr.isPickable=false;
  const top=Game.xbases.palm.createInstance(nextProp('plf')); top.position.set(x,y+h,z); top.scaling.setAll(s); top.isPickable=false;
  if(shadows&&Game.shadowGen) Game.shadowGen.addShadowCaster(tr);
  addCollider(x,z,0.4*s);
}
function placeCrystal(scene,x,z){
  const y=heightAt(x,z); if(y<-2.6) return; const s=rand(0.6,1.4);
  const inst=Game.xbases.crystal.createInstance(nextProp('cry')); inst.scaling.setAll(s);
  inst.position.set(x,y+0.2,z); inst.rotation.y=rand(0,3); inst.isPickable=false;
  Game.crystals.push(inst); addCollider(x,z,0.5*s);
}

/* ------------------------- fireflies (night) ------------------------- */
function buildFireflies(scene){
  Game.fireflies=[];
  const ffMat=new BABYLON.StandardMaterial('ffm',scene); ffMat.emissiveColor=new BABYLON.Color3(1,0.95,0.5);
  ffMat.disableLighting=true; Game.ffMat=ffMat;
  const base=BABYLON.MeshBuilder.CreateSphere('ffBase',{diameter:0.18,segments:4},scene);
  base.material=ffMat; base.setEnabled(false); base.isPickable=false; base.applyFog=false;
  const n=Game.settings.quality==='low'?30:60;
  for(let i=0;i<n;i++){ const x=rand(-WORLD+10,WORLD-10), z=rand(-WORLD+10,WORLD-10); const y=heightAt(x,z);
    const f=base.createInstance('ff'+i); f.position.set(x,y+1.2,z); f.isPickable=false; f.setEnabled(false);
    Game.fireflies.push({mesh:f, ox:x, oz:z, baseY:y, phase:rand(0,6.28)}); }
}
function updateFireflies(dt,sunH){
  const night=clamp(0.4-sunH,0,1), on=night>0.15;
  for(const f of (Game.fireflies||[])){
    if(f.mesh.isEnabled()!==on) f.mesh.setEnabled(on);
    if(!on) continue;
    f.phase+=dt*1.4;
    f.mesh.position.x=f.ox+Math.sin(f.phase)*2;
    f.mesh.position.z=f.oz+Math.cos(f.phase*0.8)*2;
    f.mesh.position.y=f.baseY+1.2+Math.sin(f.phase*1.7)*0.6;
  }
  if(Game.ffMat) Game.ffMat.emissiveColor=new BABYLON.Color3(1,0.95,0.5*(0.5+night));
}

/* ------------------------- instanced scatter ------------------------- */
function placeInst(base,x,z,opts){
  opts=opts||{};
  const y=heightAt(x,z); if(y<(opts.minY!=null?opts.minY:-2.4)) return null;
  const inst=base.createInstance(nextProp(base.name));
  const s=opts.scale||1;
  inst.scaling.set(s,(opts.sy||s),s);
  inst.position.set(x, y+(opts.lift!=null?opts.lift:0)*s, z);
  inst.rotation.y=rand(0,Math.PI*2); inst.isPickable=false;
  if(opts.shadow&&Game.shadowGen) Game.shadowGen.addShadowCaster(inst);
  if(opts.col) addCollider(x,z,opts.col);
  return inst;
}
function clusterOK(x,z){ return !(Math.hypot(x,z)<14 || inCity(x,z,-4) || onRoad(x,z)); }

/* ------------------------- fences ------------------------- */
function placeFenceRun(x,z,shadows){
  const dir=rand(0,Math.PI*2), seg=4+((Math.random()*4)|0), step=2.3;
  let cx=x, cz=z;
  for(let i=0;i<seg;i++){
    if(!clusterOK(cx,cz)) break;
    const y=heightAt(cx,cz);
    const post=Game.xbases.fpost.createInstance(nextProp('fp')); post.position.set(cx,y+0.55,cz); post.isPickable=false;
    const rail=Game.xbases.frail.createInstance(nextProp('fr')); rail.position.set(cx+Math.sin(dir)*step/2,y+0.6,cz+Math.cos(dir)*step/2);
    rail.rotation.y=dir; rail.isPickable=false;
    if(shadows&&Game.shadowGen){ Game.shadowGen.addShadowCaster(post); }
    addCollider(cx,cz,0.2);
    cx+=Math.sin(dir)*step; cz+=Math.cos(dir)*step;
  }
}

/* ------------------------- composite landmarks ------------------------- */
function placeWell(scene,x,z,shadows){
  const y=heightAt(x,z); if(y<-2) return;
  const ring=BABYLON.MeshBuilder.CreateCylinder('well',{height:1.0,diameter:2.0,tessellation:10},scene);
  ring.position.set(x,y+0.5,z); ring.material=scene._matStone||flatMat(scene,'wellm',0.6,0.58,0.53); ring.isPickable=false;
  for(let i=-1;i<=1;i+=2){ const p=BABYLON.MeshBuilder.CreateBox('wellp',{width:0.18,height:1.8,depth:0.18},scene);
    p.position.set(x+i*0.9,y+1.6,z); p.material=flatMat(scene,'wellw',0.42,0.28,0.16); p.isPickable=false; }
  const roof=BABYLON.MeshBuilder.CreateCylinder('wellr',{height:0.7,diameterTop:0,diameterBottom:2.6,tessellation:4},scene);
  roof.position.set(x,y+2.9,z); roof.rotation.y=Math.PI/4; roof.material=flatMat(scene,'wellrm',0.7,0.3,0.24); roof.isPickable=false;
  if(shadows&&Game.shadowGen) Game.shadowGen.addShadowCaster(ring);
  addCollider(x,z,1.1);
}
function placeSign(scene,x,z){
  const y=heightAt(x,z); if(y<-2) return;
  const post=BABYLON.MeshBuilder.CreateBox('signp',{width:0.14,height:2.0,depth:0.14},scene);
  post.position.set(x,y+1.0,z); post.material=flatMat(scene,'signpm',0.42,0.28,0.16); post.isPickable=false;
  const board=BABYLON.MeshBuilder.CreateBox('signb',{width:1.4,height:0.5,depth:0.08},scene);
  board.position.set(x,y+1.7,z); board.rotation.y=rand(0,Math.PI*2);
  board.material=flatMat(scene,'signbm',0.78,0.62,0.36); board.isPickable=false;
  addCollider(x,z,0.2);
}
function placeCampfire(scene,x,z){
  const y=heightAt(x,z); if(y<-2) return;
  for(let i=0;i<5;i++){ const a=i/5*Math.PI*2; const st=BABYLON.MeshBuilder.CreateBox('cfs',{width:0.12,height:0.6,depth:0.12},scene);
    st.position.set(x+Math.cos(a)*0.4,y+0.25,z+Math.sin(a)*0.4); st.rotation.z=0.6*Math.cos(a); st.rotation.x=0.6*Math.sin(a);
    st.material=flatMat(scene,'cfsm',0.36,0.24,0.14); st.isPickable=false; }
  const flame=BABYLON.MeshBuilder.CreateCylinder('cff',{height:0.8,diameterTop:0,diameterBottom:0.55,tessellation:6},scene);
  const fm=flatMat(scene,'cffm',1,0.55,0.15,{emissive:[0.9,0.4,0.08]}); fm.disableLighting=true; flame.material=fm;
  flame.position.set(x,y+0.6,z); flame.isPickable=false;
  Game.xFires.push({mesh:flame, mat:fm, baseY:y+0.6, phase:rand(0,6)});
  addCollider(x,z,0.5);
}
function placeTent(scene,x,z,shadows){
  const y=heightAt(x,z); if(y<-2) return;
  const cols=[[0.85,0.4,0.3],[0.4,0.6,0.75],[0.5,0.65,0.35],[0.8,0.7,0.4]];
  const c=cols[(Math.random()*cols.length)|0];
  const tent=BABYLON.MeshBuilder.CreateCylinder('tent',{height:2.4,diameterTop:0,diameterBottom:3.4,tessellation:4},scene);
  tent.position.set(x,y+1.2,z); tent.rotation.y=Math.PI/4; tent.material=flatMat(scene,'tentm',c[0],c[1],c[2]); tent.isPickable=false;
  if(shadows&&Game.shadowGen) Game.shadowGen.addShadowCaster(tent);
  addCollider(x,z,1.6);
}
function placeStall(scene,x,z,shadows){
  const y=heightAt(x,z); if(y<-2) return;
  const top=BABYLON.MeshBuilder.CreateBox('stallt',{width:3,height:0.2,depth:2},scene);
  top.position.set(x,y+2.2,z); const stripe=(Math.random()<0.5);
  top.material=flatMat(scene,'stallm',stripe?0.85:0.9,stripe?0.3:0.85,stripe?0.28:0.4); top.isPickable=false;
  for(const sx of [-1.3,1.3]) for(const sz of [-0.8,0.8]){ const leg=BABYLON.MeshBuilder.CreateBox('stalll',{width:0.12,height:2.2,depth:0.12},scene);
    leg.position.set(x+sx,y+1.1,z+sz); leg.material=flatMat(scene,'stalllm',0.4,0.28,0.16); leg.isPickable=false; }
  const counter=BABYLON.MeshBuilder.CreateBox('stallc',{width:3,height:0.9,depth:0.5},scene);
  counter.position.set(x,y+0.45,z-0.7); counter.material=flatMat(scene,'stallcm',0.55,0.4,0.22); counter.isPickable=false;
  if(shadows&&Game.shadowGen) Game.shadowGen.addShadowCaster(top);
  addCollider(x,z,1.6);
}
function placeWindmill(scene,x,z,shadows){
  const y=heightAt(x,z); if(y<-2) return;
  const tower=BABYLON.MeshBuilder.CreateCylinder('wmt',{height:9,diameterTop:1.6,diameterBottom:2.6,tessellation:8},scene);
  tower.position.set(x,y+4.5,z); tower.material=flatMat(scene,'wmtm',0.85,0.82,0.74); tower.isPickable=false;
  const cap=BABYLON.MeshBuilder.CreateCylinder('wmc',{height:1.6,diameterTop:0,diameterBottom:2.4,tessellation:8},scene);
  cap.position.set(x,y+9.6,z); cap.material=flatMat(scene,'wmcm',0.5,0.28,0.2); cap.isPickable=false;
  const hub=new BABYLON.TransformNode('wmhub',scene); hub.position.set(x,y+8.2,z+1.4);
  for(let i=0;i<4;i++){ const blade=BABYLON.MeshBuilder.CreateBox('wmb',{width:0.5,height:5.2,depth:0.12},scene);
    blade.parent=hub; blade.position.y=2.6; blade.rotation.z=i*Math.PI/2; blade.setPivotPoint(new BABYLON.Vector3(0,-2.6,0));
    blade.material=flatMat(scene,'wmbm',0.7,0.62,0.45); blade.isPickable=false; }
  if(shadows&&Game.shadowGen) Game.shadowGen.addShadowCaster(tower);
  Game.windmills=Game.windmills||[]; Game.windmills.push(hub);
  addCollider(x,z,2.2);
}
function placeLamp(scene,x,z,shadows){
  const y=heightAt(x,z); if(y<-2) return;
  const pole=Game.xbases.lampPole.createInstance(nextProp('lp')); pole.position.set(x,y+1.6,z); pole.isPickable=false;
  const head=Game.xbases.lampHead.createInstance(nextProp('lh')); head.position.set(x,y+3.2,z); head.isPickable=false;
  if(shadows&&Game.shadowGen) Game.shadowGen.addShadowCaster(pole);
  addCollider(x,z,0.2);
}

/* ------------------------- orchestration ------------------------- */
function buildExtraProps(scene,shadows){
  makeExtraBases(scene);
  const D=Game.settings.density, AREA=(WORLD/130)*(WORLD/130);
  const scatter=(base,n,opts)=>{ let i=0,guard=0; while(i<n&&guard<n*5){ guard++;
    const x=rand(-WORLD+6,WORLD-6), z=rand(-WORLD+6,WORLD-6); if(!clusterOK(x,z)) continue;
    if(opts.biome!=null && biomeAt(x,z)!==opts.biome) continue;
    placeInst(base,x,z,Object.assign({shadow:shadows},opts)); i++; } };

  scatter(Game.xbases.barrel, Math.min(150,Math.floor(D*AREA*0.12)), {scale:1,lift:0.55,col:0.4});
  scatter(Game.xbases.crate,  Math.min(150,Math.floor(D*AREA*0.12)), {scale:1,lift:0.45,col:0.5});
  scatter(Game.xbases.hay,    Math.min(90, Math.floor(D*AREA*0.07)), {scale:1,lift:0.6,col:0.7,biome:1});
  scatter(Game.xbases.stump,  Math.min(160,Math.floor(D*AREA*0.14)), {scale:rand(0.8,1.3),lift:0.3});
  scatter(Game.xbases.mush,   Math.min(220,Math.floor(D*AREA*0.18)), {scale:rand(0.7,1.4),lift:0,biome:0});
  scatter(Game.xbases.cactus, Math.min(120,Math.floor(D*AREA*0.10)), {scale:rand(0.7,1.2),lift:1.1,col:0.5,biome:2});
  scatter(Game.xbases.boulder,Math.min(180,Math.floor(D*AREA*0.15)), {scale:rand(1.2,3.0),sy:rand(0.8,1.4),lift:0.3,col:1.0});

  // fence runs, lamp posts, and landmarks scale gently with area
  const k=Math.min(6,AREA);
  for(let i=0;i<Math.floor(10*k);i++){ const x=rand(-WORLD+10,WORLD-10),z=rand(-WORLD+10,WORLD-10); if(clusterOK(x,z)&&biomeAt(x,z)===1) placeFenceRun(x,z,shadows); }
  for(let i=0;i<Math.floor(14*k);i++){ const x=rand(-WORLD+8,WORLD-8),z=rand(-WORLD+8,WORLD-8); if(clusterOK(x,z)) placeLamp(scene,x,z,shadows); }
  for(let i=0;i<Math.floor(2.5*k);i++){ const x=rand(-WORLD+16,WORLD-16),z=rand(-WORLD+16,WORLD-16); if(clusterOK(x,z)) placeWell(scene,x,z,shadows); }
  for(let i=0;i<Math.floor(4*k);i++){ const x=rand(-WORLD+10,WORLD-10),z=rand(-WORLD+10,WORLD-10); if(clusterOK(x,z)) placeSign(scene,x,z); }
  for(let i=0;i<Math.floor(3.5*k);i++){ const x=rand(-WORLD+12,WORLD-12),z=rand(-WORLD+12,WORLD-12); if(clusterOK(x,z)) placeCampfire(scene,x,z); }
  for(let i=0;i<Math.floor(3*k);i++){ const x=rand(-WORLD+12,WORLD-12),z=rand(-WORLD+12,WORLD-12); if(clusterOK(x,z)) placeTent(scene,x,z,shadows); }
  for(let i=0;i<Math.floor(2.5*k);i++){ const x=rand(-WORLD+12,WORLD-12),z=rand(-WORLD+12,WORLD-12); if(clusterOK(x,z)&&biomeAt(x,z)===1) placeStall(scene,x,z,shadows); }
  for(let i=0;i<Math.floor(1.2*k);i++){ const x=rand(-WORLD+20,WORLD-20),z=rand(-WORLD+20,WORLD-20); if(clusterOK(x,z)&&biomeAt(x,z)===1) placeWindmill(scene,x,z,shadows); }

  // extra nature: pines, palms (low/coastal ground), glowing crystals (ruins)
  for(let i=0;i<Math.min(280,Math.floor(D*AREA*0.24));i++){ const x=rand(-WORLD+6,WORLD-6),z=rand(-WORLD+6,WORLD-6); if(clusterOK(x,z)&&biomeAt(x,z)!==1) placePine(scene,x,z,shadows); }
  for(let i=0;i<Math.min(120,Math.floor(D*AREA*0.08));i++){ const x=rand(-WORLD+6,WORLD-6),z=rand(-WORLD+6,WORLD-6); if(clusterOK(x,z)&&heightAt(x,z)<1.5&&heightAt(x,z)>-2.3) placePalm(scene,x,z,shadows); }
  for(let i=0;i<Math.min(150,Math.floor(D*AREA*0.11));i++){ const x=rand(-WORLD+6,WORLD-6),z=rand(-WORLD+6,WORLD-6); if(clusterOK(x,z)&&biomeAt(x,z)===2) placeCrystal(scene,x,z); }

  buildFireflies(scene);
}

/* night glow for lamp heads + flicker for campfires, driven from updateSky */
function updateExtraLights(sunH){
  const night=clamp(0.5-sunH,0,1);
  if(Game.xbases&&Game.xbases.lampHeadMat){
    const g=0.05+night*0.95; Game.xbases.lampHeadMat.emissiveColor=new BABYLON.Color3(g,g*0.9,g*0.55);
  }
  const t=performance.now()*0.012;
  for(const f of (Game.xFires||[])){
    const fl=0.8+Math.sin(t+f.phase)*0.2;
    f.mesh.position.y=f.baseY+Math.sin(t*1.7+f.phase)*0.05;
    f.mesh.scaling.y=fl; f.mat.emissiveColor=new BABYLON.Color3(1,0.45+0.1*fl,0.08);
  }
  // crystals glow, brightest at night with a slow pulse
  if(Game.crystalMat){ const g=0.15+night*0.6+Math.sin(performance.now()*0.0018)*0.08;
    Game.crystalMat.emissiveColor=new BABYLON.Color3(g*0.4,g*0.8,g); }
}
function updateWindmills(dt){ for(const h of (Game.windmills||[])) h.rotation.z+=dt*0.7; }
