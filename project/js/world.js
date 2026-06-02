"use strict";
/* =====================================================================
   VERDANT — world.js
   Vibrant low-poly open world: displaced vertex-coloured terrain,
   three biomes (jungle / meadow / ruins), instanced trees, rocks,
   bushes, houses with PBR glass, stone ruins, water, and a full
   day/night lighting cycle.
   ===================================================================== */

const Pal = {
  jungleGrass:[0.15,0.42,0.18], jungleGrass2:[0.10,0.32,0.14],
  meadowGrass:[0.42,0.72,0.30], meadowGrass2:[0.55,0.78,0.34],
  ruinGround:[0.56,0.53,0.40],  sand:[0.84,0.74,0.48],
  rock:[0.46,0.47,0.50], rockHi:[0.78,0.80,0.84],
};

function flatMat(scene,name,r,g,b,opts={}){
  const m=new BABYLON.StandardMaterial(name,scene);
  m.diffuseColor=new BABYLON.Color3(r,g,b);
  m.specularColor=new BABYLON.Color3(opts.spec??0.03,opts.spec??0.03,opts.spec??0.03);
  if(opts.emissive) m.emissiveColor=new BABYLON.Color3(opts.emissive[0],opts.emissive[1],opts.emissive[2]);
  m.freeze && false;
  return m;
}

/* ------------------------- Terrain mesh ------------------------- */
function buildTerrain(scene){
  const subs = Game.settings.quality==='low'?72 : Game.settings.quality==='high'?140 : 104;
  const ground=BABYLON.MeshBuilder.CreateGround('ground',{width:WORLD*2,height:WORLD*2,subdivisions:subs},scene);
  const pos=ground.getVerticesData(BABYLON.VertexBuffer.PositionKind);
  const colors=[];
  for(let i=0;i<pos.length;i+=3){
    const x=pos[i], z=pos[i+2];
    const h=heightAt(x,z); pos[i+1]=h;
    const biome=biomeAt(x,z), slope=slopeAt(x,z);
    let c;
    if(biome===0) c = Math.random()<0.5?Pal.jungleGrass:Pal.jungleGrass2;
    else if(biome===1) c = Math.random()<0.5?Pal.meadowGrass:Pal.meadowGrass2;
    else c = Pal.ruinGround;
    // low / waterline → sand
    if(h < -2.2) c = Pal.sand;
    // steep slope → rock
    if(slope > 1.15) c = Pal.rock;
    // high peaks → light rock
    if(h > 16) c = Pal.rockHi;
    const j=(Math.random()-0.5)*0.06;  // facet variation
    colors.push(clamp(c[0]+j,0,1),clamp(c[1]+j,0,1),clamp(c[2]+j,0,1),1);
  }
  ground.updateVerticesData(BABYLON.VertexBuffer.PositionKind,pos);
  ground.setVerticesData(BABYLON.VertexBuffer.ColorKind,colors,true);
  const normals=[];
  BABYLON.VertexData.ComputeNormals(pos,ground.getIndices(),normals);
  ground.updateVerticesData(BABYLON.VertexBuffer.NormalKind,normals);
  const gmat=new BABYLON.StandardMaterial('gmat',scene);
  gmat.diffuseColor=new BABYLON.Color3(1,1,1);
  gmat.specularColor=new BABYLON.Color3(0,0,0);
  ground.material=gmat; ground.useVertexColors=true; ground.receiveShadows=true;
  ground.isPickable=true; ground.name='ground';
  Game.ground=ground;

  // water plane — fills the map's low basins into ponds/rivers
  const water=BABYLON.MeshBuilder.CreateGround('water',{width:WORLD*2,height:WORLD*2,subdivisions:1},scene);
  water.position.y=-3.2;
  const wm=new BABYLON.StandardMaterial('wm',scene);
  wm.diffuseColor=new BABYLON.Color3(0.16,0.45,0.62);
  wm.specularColor=new BABYLON.Color3(0.5,0.6,0.7); wm.specularPower=64;
  wm.alpha=0.78; wm.emissiveColor=new BABYLON.Color3(0.04,0.12,0.16);
  water.material=wm; water.isPickable=false; Game.water=water;
}

/* ------------------------- Base meshes for instancing ------------------------- */
function makeBases(scene){
  const B={};
  // trunk
  const trunk=BABYLON.MeshBuilder.CreateCylinder('trunkBase',{height:1,diameterTop:0.32,diameterBottom:0.5,tessellation:6},scene);
  trunk.material=flatMat(scene,'bark',0.42,0.28,0.16); trunk.setEnabled(false); B.trunk=trunk;
  // foliage variants (merged cone stacks)
  B.foliage=[];
  const leafCols=[[0.20,0.55,0.22],[0.30,0.66,0.26],[0.14,0.44,0.18]];
  leafCols.forEach((col,idx)=>{
    const cones=[];
    for(let i=0;i<3;i++){
      const c=BABYLON.MeshBuilder.CreateCylinder('c',{height:1.5,diameterTop:0,diameterBottom:3.0-i*0.7,tessellation:6},scene);
      c.position.y=i*1.0; cones.push(c);
    }
    const merged=BABYLON.Mesh.MergeMeshes(cones,true,true);
    merged.name='foliageBase'+idx; merged.material=flatMat(scene,'leaf'+idx,col[0],col[1],col[2]);
    merged.setEnabled(false); B.foliage.push(merged);
  });
  // palm-ish tall trunk for jungle
  // rock
  const rock=BABYLON.MeshBuilder.CreatePolyhedron('rockBase',{type:1,size:1},scene);
  rock.material=flatMat(scene,'rockmat',0.5,0.51,0.54); rock.setEnabled(false); B.rock=rock;
  // bush
  const bush=BABYLON.MeshBuilder.CreatePolyhedron('bushBase',{type:3,size:1},scene);
  bush.material=flatMat(scene,'bushmat',0.26,0.5,0.24); bush.setEnabled(false); B.bush=bush;
  // flower
  const flower=BABYLON.MeshBuilder.CreateCylinder('flowerBase',{height:0.5,diameter:0.32,tessellation:5},scene);
  flower.setEnabled(false); B.flower=flower;
  Game.bases=B;
  return B;
}

let _treeN=0,_rockN=0,_bushN=0,_flowerN=0;
function placeTree(scene,x,z,shadows,scale){
  const y=heightAt(x,z); if(y<-2.6) return;
  const s=scale||rand(0.8,1.5);
  const h=rand(3,5)*s;
  const tr=Game.bases.trunk.createInstance('t'+(_treeN));
  tr.position.set(x,y+h/2,z); tr.scaling.set(s,h,s); tr.isPickable=false;
  const fol=Game.bases.foliage[(_treeN++)%Game.bases.foliage.length].createInstance('f'+_treeN);
  fol.position.set(x,y+h-0.4,z); fol.scaling.set(s,s,s); fol.isPickable=false;
  if(shadows&&Game.shadowGen){ Game.shadowGen.addShadowCaster(tr); Game.shadowGen.addShadowCaster(fol); }
  addCollider(x,z,0.55*s);
}
function placeRock(scene,x,z,shadows){
  const y=heightAt(x,z); const r=rand(0.6,2.0);
  const rk=Game.bases.rock.createInstance('r'+(_rockN++));
  rk.position.set(x,y+r*0.4,z); rk.scaling.set(r,r*rand(0.6,1),r);
  rk.rotation.set(rand(0,3),rand(0,3),rand(0,3)); rk.isPickable=false;
  if(shadows&&Game.shadowGen) Game.shadowGen.addShadowCaster(rk);
  addCollider(x,z,r*0.7);
}
function placeBush(scene,x,z){
  const y=heightAt(x,z); if(y<-2.4) return; const r=rand(0.6,1.2);
  const b=Game.bases.bush.createInstance('b'+(_bushN++));
  b.position.set(x,y+r*0.35,z); b.scaling.set(r,r*0.7,r); b.isPickable=false;
  addCollider(x,z,r*0.5);
}
const flowerCols=[[0.95,0.35,0.4],[0.98,0.82,0.25],[0.7,0.45,0.95],[0.98,0.98,0.99]];
function placeFlower(scene,x,z){
  const y=heightAt(x,z); if(y<-1.5) return;
  const f=Game.bases.flower.createInstance('fl'+(_flowerN++));
  f.position.set(x,y+0.25,z); f.isPickable=false;
  if(!f._cm){ const c=flowerCols[(Math.random()*flowerCols.length)|0];
    f.instancedBuffers&&0; }
  // tint via material clone is costly; small flowers keep base, color comes from petals box
  const petal=BABYLON.MeshBuilder.CreateBox('pt',{size:0.34},scene);
  const c=flowerCols[(Math.random()*flowerCols.length)|0];
  petal.material=flatMat(scene,'fl',c[0],c[1],c[2],{emissive:[c[0]*0.2,c[1]*0.2,c[2]*0.2]});
  petal.position.set(x,y+0.55,z); petal.rotation.y=rand(0,3); petal.scaling.y=0.4; petal.isPickable=false;
}

/* ------------------------- Houses & ruins ------------------------- */
function placeHouse(scene,x,z,shadows){
  const y=heightAt(x,z); if(y<-2) return;
  const root=new BABYLON.TransformNode('house',scene); root.position.set(x,y,z); root.rotation.y=rand(0,Math.PI*2);
  const w=rand(5,8), d=rand(5,8), wallH=rand(3,4.2);
  const wallCols=[[0.93,0.80,0.55],[0.90,0.62,0.50],[0.72,0.85,0.78],[0.82,0.84,0.90]];
  const wc=wallCols[(Math.random()*wallCols.length)|0];
  const body=BABYLON.MeshBuilder.CreateBox('body',{width:w,depth:d,height:wallH},scene);
  body.position.y=wallH/2; body.parent=root; body.material=flatMat(scene,'wall',wc[0],wc[1],wc[2]); body.isPickable=false;
  const roofCols=[[0.80,0.34,0.26],[0.36,0.55,0.70],[0.45,0.40,0.38]];
  const rc=roofCols[(Math.random()*roofCols.length)|0];
  const roof=BABYLON.MeshBuilder.CreateCylinder('roof',{height:rand(1.8,2.8),diameterTop:0,diameterBottom:Math.max(w,d)*1.28,tessellation:4},scene);
  roof.position.y=wallH+0.9; roof.rotation.y=Math.PI/4; roof.parent=root; roof.material=flatMat(scene,'roof',rc[0],rc[1],rc[2]); roof.isPickable=false;
  // glass windows (PBR)
  for(let i=-1;i<=1;i+=2){
    const glass=BABYLON.MeshBuilder.CreateBox('glass',{width:1.3,height:1.5,depth:.1},scene);
    glass.position.set(i*w*0.27,wallH*0.55,d/2+0.02); glass.parent=root; glass.material=scene._matGlass; glass.isPickable=false;
  }
  const door=BABYLON.MeshBuilder.CreateBox('door',{width:1.2,height:2.1,depth:.14},scene);
  door.position.set(0,1.05,d/2+0.02); door.parent=root; door.material=flatMat(scene,'door',0.35,0.24,0.16); door.isPickable=false;
  if(shadows&&Game.shadowGen){ Game.shadowGen.addShadowCaster(body); Game.shadowGen.addShadowCaster(roof); }
  addCollider(x,z,Math.max(w,d)*0.6);
  (Game.houses=Game.houses||[]).push({x,z});
}
function placeRuin(scene,x,z,shadows){
  const y=heightAt(x,z);
  const mat=scene._matStone;
  const n=Math.floor(rand(2,5));
  for(let i=0;i<n;i++){
    const px=x+rand(-3,3), pz=z+rand(-3,3), py=heightAt(px,pz);
    const h=rand(1.5,4.5);
    const col=BABYLON.MeshBuilder.CreateBox('ruin',{width:rand(0.6,1.2),depth:rand(0.6,1.2),height:h},scene);
    col.position.set(px,py+h/2,pz); col.rotation.set(rand(-0.08,0.08),rand(0,3),rand(-0.08,0.08));
    col.material=mat; col.isPickable=false;
    if(shadows&&Game.shadowGen) Game.shadowGen.addShadowCaster(col);
    addCollider(px,pz,0.5);
  }
  // fallen lintel
  const lint=BABYLON.MeshBuilder.CreateBox('ruin',{width:rand(2,3.5),depth:0.7,height:0.6},scene);
  lint.position.set(x,y+0.3,z); lint.rotation.y=rand(0,3); lint.material=mat; lint.isPickable=false;
}

/* ------------------------- World orchestration ------------------------- */
function buildWorld(scene,density,shadows){
  // shared special materials
  const glass=new BABYLON.PBRMaterial('glass',scene);
  glass.albedoColor=new BABYLON.Color3(0.4,0.6,0.68); glass.metallic=0.0; glass.roughness=0.06;
  glass.alpha=0.34; glass.environmentIntensity=0.7; glass.backFaceCulling=false; scene._matGlass=glass;
  scene._matStone=flatMat(scene,'stone',0.62,0.60,0.55);

  buildTerrain(scene);
  makeBases(scene);
  buildRoadNetwork();             // define road centerlines so props avoid them

  const D=density;
  // distribute by biome — sample random points, decide what to place
  const treeTarget=Math.floor(D), rockTarget=Math.floor(D*0.45),
        bushTarget=Math.floor(D*0.5), flowerTarget=Math.floor(D*0.6),
        houseTarget=Math.floor(D*0.05), ruinTarget=Math.floor(D*0.04);

  let placed=0, guard=0;
  while(placed<treeTarget && guard<treeTarget*4){
    guard++;
    const x=rand(-WORLD+6,WORLD-6), z=rand(-WORLD+6,WORLD-6);
    if(Math.hypot(x,z)<14) continue;           // keep spawn clear
    if(inCity(x,z,-4)||onRoad(x,z)) continue;  // leave downtown & streets clear
    const b=biomeAt(x,z);
    if(b===1 && Math.random()<0.7) continue;   // meadows are sparse
    if(b===2 && Math.random()<0.8) continue;   // ruins mostly bare
    placeTree(scene,x,z,shadows, b===0?rand(0.9,1.6):rand(0.7,1.1)); placed++;
  }
  for(let i=0;i<rockTarget;i++){ const x=rand(-WORLD+6,WORLD-6),z=rand(-WORLD+6,WORLD-6); if(Math.hypot(x,z)<12||inCity(x,z,-4)||onRoad(x,z))continue; placeRock(scene,x,z,shadows); }
  for(let i=0;i<bushTarget;i++){ const x=rand(-WORLD+6,WORLD-6),z=rand(-WORLD+6,WORLD-6); if(Math.hypot(x,z)<12||inCity(x,z)||onRoad(x,z))continue; placeBush(scene,x,z); }
  for(let i=0;i<flowerTarget;i++){ const x=rand(-WORLD+6,WORLD-6),z=rand(-WORLD+6,WORLD-6); if(inCity(x,z)||onRoad(x,z))continue; if(biomeAt(x,z)===1&&Math.hypot(x,z)>10) placeFlower(scene,x,z); }
  for(let i=0;i<houseTarget;i++){ const x=rand(-WORLD+14,WORLD-14),z=rand(-WORLD+14,WORLD-14); if(Math.hypot(x,z)<18||inCity(x,z)||onRoad(x,z))continue; placeHouse(scene,x,z,shadows); }
  for(let i=0;i<ruinTarget;i++){ const x=rand(-WORLD+12,WORLD-12),z=rand(-WORLD+12,WORLD-12); if(inCity(x,z)||onRoad(x,z))continue; if(biomeAt(x,z)===2&&Math.hypot(x,z)>16) placeRuin(scene,x,z,shadows); }

  // resupply pad at spawn
  const pad=BABYLON.MeshBuilder.CreateCylinder('pad',{height:0.18,diameter:9,tessellation:28},scene);
  pad.position.set(0,heightAt(0,0)+0.09,0);
  const pm=new BABYLON.StandardMaterial('pm',scene);
  pm.diffuseColor=new BABYLON.Color3(0.1,0.3,0.3); pm.emissiveColor=new BABYLON.Color3(0.1,0.5,0.4);
  pm.specularColor=new BABYLON.Color3(0,0,0); pm.alpha=0.9;
  pad.material=pm; pad.isPickable=false; Game.spawnPad=pad;
  const ring=BABYLON.MeshBuilder.CreateTorus('padring',{diameter:9,thickness:0.4,tessellation:28},scene);
  ring.position.set(0,heightAt(0,0)+0.2,0);
  const rm=new BABYLON.StandardMaterial('rm',scene); rm.emissiveColor=new BABYLON.Color3(0.3,0.95,0.7); rm.disableLighting=true;
  ring.material=rm; ring.isPickable=false;

  // sun/moon disc
  const disc=BABYLON.MeshBuilder.CreateSphere('sundisc',{diameter:18,segments:8},scene);
  const dm=new BABYLON.StandardMaterial('dm',scene); dm.emissiveColor=new BABYLON.Color3(1,0.92,0.7);
  dm.disableLighting=true; disc.material=dm; disc.isPickable=false; Game.sunDisc=disc;

  scene.fogMode=BABYLON.Scene.FOGMODE_EXP2;
  scene.fogDensity=0.0065;
}

/* ------------------------- Day / night ------------------------- */
const SkyKeys = {
  // sunHeight -1..1 → [skyR,skyG,skyB, hemiI, sunI, fogR,fogG,fogB]
  night:[0.05,0.07,0.14, 0.30, 0.05, 0.04,0.05,0.10],
  dusk: [0.85,0.45,0.30, 0.55, 0.55, 0.55,0.35,0.30],
  day:  [0.49,0.78,1.00, 0.95, 1.25, 0.62,0.80,0.95],
};
function mix3(a,b,t,o){ return [lerp(a[o],b[o],t),lerp(a[o+1],b[o+1],t),lerp(a[o+2],b[o+2],t)]; }
function updateSky(){
  const t=Game.time;                               // 0..1
  const ang=(t-0.25)*Math.PI*2;                    // .25 sunrise
  const sunH=Math.sin(ang);                         // -1..1
  // sun direction (points FROM sun TO scene)
  if(Game.sun){
    const az=ang;
    Game.sun.direction=new BABYLON.Vector3(-Math.cos(az),-Math.max(0.18,sunH*1.1+0.25),-Math.sin(az)*0.6-0.4).normalize();
  }
  if(Game.sunDisc){
    const az=ang, R=180, hh=Math.max(-0.3,sunH);
    Game.sunDisc.position.set(Math.cos(az)*R, 40+hh*150, Math.sin(az)*R+ (Game.player?Game.player.position.z:0));
    if(Game.player) Game.sunDisc.position.x += Game.player.position.x;
    const dm=Game.sunDisc.material;
    dm.emissiveColor = sunH>0.05 ? new BABYLON.Color3(1,0.93,0.72) : new BABYLON.Color3(0.8,0.85,1.0);
  }
  // colour blend
  let sky,hemiI,sunI,fog;
  if(sunH>0.15){ const k=smoothstep(0.15,0.6,sunH);
    sky=mix3(SkyKeys.dusk,SkyKeys.day,k,0); hemiI=lerp(SkyKeys.dusk[3],SkyKeys.day[3],k);
    sunI=lerp(SkyKeys.dusk[4],SkyKeys.day[4],k); fog=mix3(SkyKeys.dusk,SkyKeys.day,k,5);
  } else if(sunH>-0.2){ const k=smoothstep(-0.2,0.15,sunH);
    sky=mix3(SkyKeys.night,SkyKeys.dusk,k,0); hemiI=lerp(SkyKeys.night[3],SkyKeys.dusk[3],k);
    sunI=lerp(SkyKeys.night[4],SkyKeys.dusk[4],k); fog=mix3(SkyKeys.night,SkyKeys.dusk,k,5);
  } else { sky=SkyKeys.night.slice(0,3); hemiI=SkyKeys.night[3]; sunI=SkyKeys.night[4]; fog=SkyKeys.night.slice(5,8); }
  if(Game.scene){ if(typeof weatherSkyTint==='function') sky=weatherSkyTint(sky);
    Game.scene.clearColor=new BABYLON.Color4(sky[0],sky[1],sky[2],1);
    Game.scene.fogColor=new BABYLON.Color3(fog[0],fog[1],fog[2]); }
  if(Game.hemi){ Game.hemi.intensity=hemiI;
    Game.hemi.diffuse=new BABYLON.Color3(lerp(0.5,0.95,smoothstep(-0.2,0.4,sunH)),0.95,0.9); }
  if(Game.sun){ Game.sun.intensity=sunI;
    Game.sun.diffuse = sunH<0.1 ? new BABYLON.Color3(0.6,0.65,0.95) : new BABYLON.Color3(1,0.96,0.86); }
  // clock label
  const mins=Math.floor(t*24*60), hh=String(Math.floor(mins/60)).padStart(2,'0'), mm=String(mins%60).padStart(2,'0');
  const cl=$('clock'); if(cl) cl.textContent=hh+':'+mm;
  // city + sky extras driven by sun height
  if(typeof updateCityLights==='function') updateCityLights(sunH);
  if(typeof updateStars==='function') updateStars(sunH);
}
function sunHeight(){ return Math.sin((Game.time-0.25)*Math.PI*2); }
