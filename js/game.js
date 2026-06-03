"use strict";
/* VERDANT — game.js (engine boot, input, loop, flow) */

const DAY_LENGTH = 150;   // seconds for a full 24h cycle

/* render distance — maps the 0..1 setting to camera far-plane + fog */
function applyRenderDist(){
  const v=Game.settings.renderDist;
  if(Game.camera) Game.camera.maxZ=lerp(420,1400,v);
  if(Game.scene) Game.scene.fogDensity=lerp(0.0085,0.0028,v);
}

/* ------------------------- Boot ------------------------- */
async function boot(){
  const canvas=$('renderCanvas');
  const engine=new BABYLON.Engine(canvas,true,{preserveDrawingBuffer:true,stencil:true});
  Game.engine=engine;
  const scene=new BABYLON.Scene(engine);
  Game.scene=scene;
  scene.clearColor=new BABYLON.Color4(0.49,0.78,1.0,1);
  scene.autoClear=true;

  const cam=new BABYLON.UniversalCamera('cam',new BABYLON.Vector3(0,8,-12),scene);
  cam.fov=Game.settings.fov; cam.minZ=0.15; cam.maxZ=1000;
  scene.activeCamera=cam; Game.camera=cam;

  const hemi=new BABYLON.HemisphericLight('hemi',new BABYLON.Vector3(0.2,1,0.1),scene);
  hemi.intensity=0.9; hemi.groundColor=new BABYLON.Color3(0.25,0.32,0.22); Game.hemi=hemi;
  const sun=new BABYLON.DirectionalLight('sun',new BABYLON.Vector3(-0.5,-1,-0.4),scene);
  sun.position=new BABYLON.Vector3(60,90,60); sun.intensity=1.2; Game.sun=sun;

  const steps=[
    ['INITIALIZING ENGINE', ()=>{}],
    ['CONFIGURING LIGHTING', ()=>{
      if(Game.settings.shadows){ const sg=new BABYLON.ShadowGenerator(1024,sun);
        sg.useBlurExponentialShadowMap=true; sg.blurScale=2; sg.depthScale=40; Game.shadowGen=sg; } }],
    ['SCULPTING TERRAIN', ()=>{ /* terrain inside buildWorld */ }],
    ['GROWING THE JUNGLE', ()=>{ buildWorld(scene,Game.settings.density,Game.settings.shadows); }],
    ['BUILDING DOWNTOWN', ()=>{ buildUrban(scene); }],
    ['SUMMONING TRAFFIC', ()=>{ spawnTraffic(scene); buildWeather(scene); }],
    ['RAISING VILLAGES & RUINS', ()=>{ spawnVehicles(scene); spawnVillagers(scene); }],
    ['BRINGING THE WORLD ALIVE', ()=>{ buildLife(scene); }],
    ['DETAILING THE WORLD', ()=>{ buildExtraProps(scene,Game.settings.shadows); }],
    ['OPENING THE GARAGE', ()=>{ initCustom(); buildGaragePad(scene); }],
    ['DEPLOYING OPERATOR', ()=>{ buildPlayer(scene); }],
    ['LOADING ARMORY', ()=>{ Game.weapons=defaultWeapons(); }],
    ['CALIBRATING SYSTEMS', ()=>{ initInventory(); updateSky(); }],
    ['FINALIZING', ()=>{}],
  ];
  let i=0;
  function nextStep(){
    if(i>=steps.length){ finishLoad(); return; }
    const [task,fn]=steps[i]; $('loadTask').textContent=task;
    try{ fn(); }catch(e){ console.error('Load step failed:',task,e); }
    i++; const pct=Math.round(i/steps.length*100);
    $('loadFill').style.width=pct+'%'; $('loadPct').textContent=pct+'%';
    setTimeout(nextStep, 230);
  }
  function finishLoad(){
    if(typeof initRPG==='function') initRPG();
    Game.playerData={hp:Game.maxHP||100,stamina:100,armor:0};
    if(typeof applyUnlocks==='function') applyUnlocks();
    if(typeof applyRenderDist==='function') applyRenderDist();
    renderInventory(); refreshHP(); refreshSP(); refreshArmor(); refreshAmmoHUD(); updateGrenadeHUD();
    updateMoneyHUD();
    setTimeout(()=>setState('menu'),450);
  }

  let last=performance.now();
  engine.runRenderLoop(()=>{
    const now=performance.now(); const dt=Math.min(0.05,(now-last)/1000); last=now;
    Game.camera.fov = Game.aiming ? Game.settings.fov*(currentW().zoom?0.45:0.8) : Game.settings.fov;
    if(Game.state==='playing'){ updateGame(dt,now); }
    if(Game.settings.cycle && (Game.state==='playing')) { Game.time=(Game.time+dt/DAY_LENGTH)%1; }
    updateSky();
    scene.render();
  });
  window.addEventListener('resize',()=>engine.resize());
  setTimeout(nextStep,400);
}

/* ------------------------- Main update ------------------------- */
let _stepT=0;
function updateGame(dt,now){
  const p=Game.player, k=Game.keys;

  if(!Game.inVehicle){
  /* movement input */
  const fwd={x:Math.sin(Game.yaw),z:Math.cos(Game.yaw)};
  const right={x:Math.cos(Game.yaw),z:-Math.sin(Game.yaw)};
  let mx=0,mz=0;
  if(k['w']){mx+=fwd.x;mz+=fwd.z;} if(k['s']){mx-=fwd.x;mz-=fwd.z;}
  if(k['d']){mx+=right.x;mz+=right.z;} if(k['a']){mx-=right.x;mz-=right.z;}
  const len=Math.hypot(mx,mz), moving=len>0.01;
  const wantSprint=Game.settings.autoSprint?moving:k['shift'];
  const sprinting=wantSprint&&Game.playerData.stamina>0&&moving&&!Game.crouching;
  let speed=6.2*(sprinting?1.7*((typeof perkSprintMult==='function')?perkSprintMult():1):1)*(Game.aiming?0.5:1)*(Game.crouching?0.5:1);
  if(moving){ mx/=len; mz/=len; }
  if(sprinting) Game.playerData.stamina=Math.max(0,Game.playerData.stamina-26*dt);
  else Game.playerData.stamina=Math.min(100,Game.playerData.stamina+18*dt);
  refreshSP();

  // horizontal move + collision
  const np=p.position.clone();
  np.x+=mx*speed*dt; np.z+=mz*speed*dt;
  resolveCollision(np,0.55);
  p.position.x=np.x; p.position.z=np.z;
  // vertical — glue to the terrain surface so the character never sinks
  // on slopes; gravity only applies while airborne (jumping / falling).
  Game.vy-=24*dt;
  if(Game.grounded && k[' ']){ Game.vy=9.2; Game.grounded=false; sfx('jump'); }
  p.position.y+=Game.vy*dt;
  const gy=heightAt(p.position.x,p.position.z);
  if(p.position.y<=gy+0.06){          // on or under the surface → stand on it
    p.position.y=gy; Game.vy=0; Game.grounded=true;
  } else {
    Game.grounded=false;
  }
  // when grounded and not rising, follow the surface exactly (downhill/uphill)
  if(Game.grounded && Game.vy<=0) p.position.y=gy;

  // facing — armed player always faces where the camera/crosshair points
  let targetA=Game.yaw;
  let da=targetA-p.rotation.y; while(da>Math.PI)da-=2*Math.PI; while(da<-Math.PI)da+=2*Math.PI;
  p.rotation.y+=da*Math.min(1,dt*16);

  // free-cursor turning: when not pointer-locked, pushing the cursor toward a
  // screen edge rotates the camera (COD-on-web feel). Center zone = pure aim.
  if(document.pointerLockElement!==$('renderCanvas') && !overlayOpen()){
    const dz=0.30, turn=2.6*Game.settings.sens;
    const tx=Game.cursorN.x, ty=Game.cursorN.y;
    if(Math.abs(tx)>dz) Game.yaw += (tx-Math.sign(tx)*dz)/(1-dz)*turn*dt;
    if(Math.abs(ty)>dz) Game.pitch = clamp(Game.pitch + (ty-Math.sign(ty)*dz)/(1-dz)*turn*0.6*dt, -0.35, 1.32);
  }

  // animation + footsteps
  Game.walkPhase += dt*(moving?(sprinting?16:11):4);
  animateRig(Game.playerRig, moving, sprinting?1.4:1, Game.walkPhase, Game.aiming);
  if(moving && Game.grounded){ _stepT-=dt*(sprinting?1.7:1); if(_stepT<=0){ footstep(); _stepT=0.34; } }

  /* camera */
  const aiming=Game.aiming;
  const radius=aiming?4.2:Game.camDist;
  const cosP=Math.cos(Game.pitch), sinP=Math.sin(Game.pitch);
  const off=aiming?1.25:0.95;
  const tx=p.position.x + right.x*off, ty=p.position.y+1.65-(Game.crouching?0.55:0), tz=p.position.z + right.z*off;
  let camX=tx - fwd.x*radius*cosP, camY=ty + radius*sinP + 0.4, camZ=tz - fwd.z*radius*cosP;
  // camera collision: march from the player out to the camera; if terrain
  // rises above the sight line, lift the camera so the character stays in
  // full view instead of being occluded by a hill (the "half-sunk" look).
  const STEPS=8;
  for(let i=1;i<=STEPS;i++){
    const t=i/STEPS;
    const sx=lerp(tx,camX,t), sz=lerp(tz,camZ,t);
    const need=heightAt(sx,sz)+0.9;          // clearance above ground
    const lineY=lerp(ty,camY,t);
    if(lineY<need) camY += (need-lineY);      // push the whole camera up
  }
  const camGy=heightAt(camX,camZ)+0.9; if(camY<camGy) camY=camGy;
  Game.camera.position.set(camX,camY,camZ);
  Game.camera.setTarget(new BABYLON.Vector3(tx,ty,tz));

  /* firing */
  if(Game.mouseDown && currentW().auto) tryShoot(now);
  } else { updateVehicle(dt,now); }
  updateVillagers(dt);

  /* enemies */
  for(const e of Game.enemies){
    const dx=p.position.x-e.body.position.x, dz=p.position.z-e.body.position.z;
    const d=Math.hypot(dx,dz); const nx=dx/(d||1), nz=dz/(d||1);
    e.body.rotation.y=Math.atan2(nx,nz);
    let emoved=false;
    if(e.type==='shooter'){
      if(d>e.range){ const ep=e.body.position; ep.x+=nx*e.speed*dt; ep.z+=nz*e.speed*dt; resolveCollision(ep,0.5); emoved=true; }
      else { e.fireCd-=dt; if(e.fireCd<=0){ enemyFire(e); e.fireCd=rand(1.4,2.6); } }
    } else {
      if(d>e.range){ const ep=e.body.position; ep.x+=nx*e.speed*dt; ep.z+=nz*e.speed*dt; resolveCollision(ep,0.5*e.rig.root.scaling.x); emoved=true; }
      else { e.atkCd-=dt; if(e.atkCd<=0){ e.atkCd=1.0; damagePlayer(e.dmg+Game.wave); } }
    }
    e.body.position.y=heightAt(e.body.position.x,e.body.position.z);
    e.phase+=dt*(emoved?10:3);
    animateRig(e.rig, emoved, 1, e.phase, e.type==='shooter');
  }

  updateProjectiles(dt);
  updateGrenades(dt);
  updateRockets(dt);
  updateHealthBars();
  updatePeers(dt);
  if(typeof updatePvP==='function') updatePvP();
  if(typeof updateCoop==='function') updateCoop(dt);
  updateCombo(dt); updateBossBar(); updateResupply(dt); updateScope();
  const sh=sunHeight();
  updateClouds(dt,sh); updateDeer(dt); updateBirds(dt,now);
  if(typeof updateFireflies==='function') updateFireflies(dt,sh);
  updateTraffic(dt); updateWanted(dt); updateWeather(dt);
  if(typeof updateWindmills==='function') updateWindmills(dt);
  updateExtras(dt,now);

  /* waves (suppressed in PvP arenas and co-op — server drives those) */
  const netMatch=(typeof isPvP==='function'&&isPvP())||(typeof isCoop==='function'&&isCoop());
  if(!netMatch && Game.waveActive){
    if(Game.enemiesToSpawn>0 && Game.enemies.length<diff().cap && Math.random()<0.05){ spawnEnemy(Game.scene,Game.settings.shadows); Game.enemiesToSpawn--; }
    if(Game.enemiesToSpawn<=0 && Game.enemies.length===0 && !Game.betweenWaves){
      Game.waveActive=false; Game.betweenWaves=true;
      bigToast('WAVE CLEARED','+'+(Game.wave*250)+' bonus · press B to shop'); Game.score+=Game.wave*250; updateHUD();
      if(typeof trackContract==='function') trackContract('survive',1);
      if(typeof trackMission==='function') trackMission('waves',1);
      if(typeof addXP==='function') addXP(60);
      if(typeof evaluateAchievements==='function') evaluateAchievements();
      $('objText').textContent='Regrouping…';
      setTimeout(()=>{ if(Game.state==='playing'){ Game.betweenWaves=false; startWave(); } },3500);
    }
  }

  /* items: bob, spin, pickup */
  for(const it of [...Game.items]){
    it.mesh.rotation.y+=dt*2; it.mesh.position.y=it.baseY+Math.sin(now*0.004)*0.12;
    const dd=BABYLON.Vector3.Distance(p.position,it.mesh.position);
    if(dd<2.4 && k['e']){
      const t=it.type;
      if(t==='armor'){ Game.playerData.armor=Math.min(100,Game.playerData.armor+50); refreshArmor(); }
      else addToInventory(t,1);
      sfx('pickup'); toast('PICKED UP '+(ITEM_DEFS[t]?.nm||t));
      it.mesh.dispose(); Game.items=Game.items.filter(x=>x!==it); renderInventory();
    }
  }

  drawMinimap(); updateHUD(); netSend();
  // crosshair turns red when an enemy is under the pointer (aim-assist locked)
  const ch=$('crosshair');
  if(ch){ let tgt=null;
    if(typeof isPvP==='function'&&isPvP()) tgt=(typeof pvpTarget==='function')&&pvpTarget(220);
    else if(typeof isCoop==='function'&&isCoop()) tgt=(typeof coopTarget==='function')&&coopTarget(220);
    else tgt=(typeof screenTarget==='function')?screenTarget(220):null;
    ch.classList.toggle('hot',!!tgt); }
}

/* ------------------------- Waves ------------------------- */
function startWave(){
  Game.wave++; Game.waveActive=true;
  Game.enemiesToSpawn=Math.round((4+Game.wave*2)*diff().spawn);
  if(Game.wave%5===0) spawnBoss();
  $('waveLbl').textContent='WAVE '+String(Game.wave).padStart(2,'0');
  $('objText').textContent='Eliminate all hostiles';
  bigToast('WAVE '+Game.wave, Game.enemiesToSpawn+' hostiles inbound'); sfx('wave');
}

/* ------------------------- Flow ------------------------- */
function lockPointer(){ if(!Game.wantLock) return; const c=$('renderCanvas'); if(c.requestPointerLock){ const r=c.requestPointerLock(); if(r&&r.catch)r.catch(()=>{}); } }
function toggleLook(){ Game.wantLock=!Game.wantLock;
  if(Game.wantLock){ const c=$('renderCanvas'); c.requestPointerLock&&c.requestPointerLock(); toast('MOUSELOOK ON'); }
  else { document.exitPointerLock&&document.exitPointerLock(); toast('CURSOR AIM ON'); } }
function startMission(){
  initAudio(); if(Game.audio&&Game.audio.state==='suspended') Game.audio.resume(); startAmbient();
  // rebuild player if char changed
  if(Game.playerRig && CHAR_VARIANTS[Game.charIndex]){
    Game.playerRig.root.dispose(false,true); buildPlayer(Game.scene);
  }
  resetGame(); setState('playing'); lockPointer();
}
function resetGame(){
  Game.enemies.forEach(e=>e.rig.root.dispose(false,true));
  Game.items.forEach(it=>it.mesh.dispose());
  Game.projectiles.forEach(p=>p.mesh.dispose());
  Game.grenades.forEach(g=>g.mesh.dispose());
  Game.enemies=[]; Game.items=[]; Game.projectiles=[]; Game.grenades=[];
  if(typeof clearRockets==='function') clearRockets();
  if(typeof clearHealthBars==='function') clearHealthBars();
  Game.score=0; Game.wave=0; Game.killCount=0; Game.waveActive=false; Game.betweenWaves=false;
  Game.boss=null; $('bossbar').classList.remove('show'); Game.crouching=false; Game.onPad=false; Game._wasOnPad=false;
  resetCombo();
  clearWanted(); if(typeof setWeather==='function') setWeather('clear'); Game.weatherTimer=rand(20,40);
  Game.money=250; updateMoneyHUD(); if(Game.mapOpen) closeMap(); if(Game.shopOpen) closeShop();
  if(Game.garageOpen) closeGarage(); if(Game.contractsOpen) closeContracts();
  if(Game.missionsOpen) closeMissions(); if(Game.codesOpen) closeCodes(); if(Game.skillsOpen) closeSkills();
  clearMoneyDrops(); Game.contract=null; genContracts(); updateContractHUD();
  initCustom();
  if(Game.inVehicle){ Game.playerRig.root.setEnabled(true); Game.inVehicle=null; }
  Game.player.position.set(0,heightAt(0,0),0); Game.player.rotation.set(0,0,0); Game.vy=0;
  Game.weapons=defaultWeapons(); Game.currentWeapon=0; Game.grenadeCount=3;
  if(typeof applyUnlocks==='function') applyUnlocks();   // re-own code/mission unlocks
  Game.maxHP=(typeof perkMaxHP==='function')?perkMaxHP():100;
  Game.playerData={hp:Game.maxHP,stamina:100,armor:0};
  initInventory();
  // apply chosen starting weapon (after weapons reset so it sticks)
  if(Game.custom && Game.custom.startWeapon && Game.custom.startWeapon!=='pistol'){
    const wi=Game.weapons.findIndex(w=>w.id===Game.custom.startWeapon);
    if(wi>=0){ Game.weapons[wi].owned=true; Game.inventory.push({key:Game.custom.startWeapon,weapon:wi}); Game.currentWeapon=wi; }
  }
  applyGunTint();
  renderInventory(); refreshHP(); refreshSP(); refreshArmor(); refreshAmmoHUD(); updateGrenadeHUD(); updateQuickSlots();
  // starter weapon cache near spawn
  spawnItem(Game.scene,'rifle', 6,8); spawnItem(Game.scene,'shotgun',-7,7);
  spawnItem(Game.scene,'sniper',9,-6); spawnItem(Game.scene,'armor',-6,-7);
  spawnItem(Game.scene,'medkit',3,11); spawnItem(Game.scene,'ammo',-4,11);
  if(typeof spawnInteriorLoot==='function') spawnInteriorLoot();
  if(typeof clearCoopEnemies==='function') clearCoopEnemies();
  if(typeof isPvP==='function' && isPvP()) setupPvP();
  else if(typeof isCoop==='function' && isCoop()) setupCoop();
  else startWave();
}
function pauseGame(){ Game.aiming=false; Game.mouseDown=false; document.exitPointerLock&&document.exitPointerLock(); setState('paused'); }
function resumeGame(){ setState('playing'); lockPointer(); }
function gameOver(){ Game.aiming=false; Game.mouseDown=false; document.exitPointerLock&&document.exitPointerLock();
  let best=Game.score;
  if(typeof recordRun==='function'){ const s=recordRun(); best=s.best||Game.score; }
  $('finalScore').textContent=Game.score; $('finalWave').textContent='REACHED WAVE '+Game.wave;
  const bl=$('bestLine'); if(bl) bl.textContent='BEST '+best.toLocaleString()+(Game.score>=best&&Game.score>0?' — NEW RECORD!':'');
  if(typeof submitScore==='function' && !(typeof isPvP==='function'&&isPvP())) submitScore('survival', Game.score, Game.wave);
  setState('over'); }

function damagePlayer(d){
  if(Game.state!=='playing') return;
  if(Game.cheats.god) return;                 // GODMODE cheat
  let dmg=d*diff().dmg;
  if(Game.playerData.armor>0){ const ab=Math.min(Game.playerData.armor,dmg*0.6); Game.playerData.armor-=ab; dmg-=ab; refreshArmor(); }
  Game.playerData.hp-=dmg; refreshHP(); sfx('hurt');
  $('hitflash').style.opacity='1'; setTimeout(()=>$('hitflash').style.opacity='0',120);
  $('dmgvig').style.boxShadow='inset 0 0 120px rgba(255,40,40,'+Math.min(0.6,(100-Game.playerData.hp)/130)+')';
  if(Game.playerData.hp<=0) gameOver();
}
function toggleInventory(){
  if($('inv').classList.contains('show')){ hide('inv'); if(Game.state==='playing')lockPointer(); }
  else { renderInventory(); show('inv'); document.exitPointerLock&&document.exitPointerLock(); }
}

/* ------------------------- Input ------------------------- */
function bindInput(){
  const canvas=$('renderCanvas');
  window.addEventListener('keydown',e=>{
    const key=e.key.toLowerCase();
    if(Game.chat&&Game.chat.typing) return;          // typing in chat → ignore game input
    Game.keys[key]=true;
    if(Game.state==='playing'){
      if(key==='enter'||key==='t'){ e.preventDefault(); if(typeof openChat==='function') openChat(); return; }
      if(key>='1'&&key<='9'){ switchWeapon(+key-1); }
      if(key==='r') reload();
      if(key==='g') throwGrenade();
      if(key==='f') toggleVehicle();
      if(key==='c'){ Game.crouching=!Game.crouching; toast(Game.crouching?'CROUCHED':'STANDING'); }
      if(key==='m'){ e.preventDefault(); toggleMap(); }
      if(key==='b'){ toggleShop(); }
      if(key==='v'){ toggleGarage(); }
      if(key==='k'){ toggleContracts(); }
      if(key==='j'){ toggleMissions(); }
      if(key==='o'){ toggleSkills(); }
      if(key==='p'){ openCodes(); }
      if(key==='l'){ toggleLook(); }
      if(key==='tab'){ e.preventDefault(); toggleInventory(); }
      if(key==='escape'){ if(Game.mapOpen){ closeMap(); } else if(Game.shopOpen){ closeShop(); } else if(Game.garageOpen){ closeGarage(); } else if(Game.contractsOpen){ closeContracts(); } else if(Game.missionsOpen){ closeMissions(); } else if(Game.codesOpen){ closeCodes(); } else if(Game.skillsOpen){ closeSkills(); } else pauseGame(); }
    } else if(Game.state==='paused'&&key==='escape') resumeGame();
    if(key===' '||key==='tab') e.preventDefault();
  });
  window.addEventListener('keyup',e=>{ Game.keys[e.key.toLowerCase()]=false; });

  canvas.addEventListener('click',()=>{});
  // Fire on left-press anywhere on the play view; right-press = aim.
  // We do NOT auto-grab pointer lock (it hid the cursor and ate clicks).
  // Press L to toggle classic locked mouselook if you want it.
  window.addEventListener('mousedown',e=>{
    if(Game.state!=='playing'||overlayOpen()) return;
    if(e.button===0){ Game.mouseDown=true; if(!Game.inVehicle && !currentW().auto) tryShoot(performance.now()); }
    if(e.button===2){ Game.aiming=true; }
  });
  window.addEventListener('mouseup',e=>{ if(e.button===0)Game.mouseDown=false; if(e.button===2)Game.aiming=false; });
  window.addEventListener('contextmenu',e=>{ if(Game.state==='playing')e.preventDefault(); });
  window.addEventListener('wheel',e=>{ if(Game.state==='playing'){ Game.camDist=clamp(Game.camDist+Math.sign(e.deltaY)*0.6,4,12); } },{passive:true});
  document.addEventListener('mousemove',e=>{
    if(Game.state!=='playing'||overlayOpen()) return;
    const canvas=$('renderCanvas');
    if(document.pointerLockElement===canvas){
      // Pointer locked → classic FPS mouselook, crosshair stays centered.
      const s=Game.settings.sens*0.0016, iv=Game.settings.invertY?-1:1;
      Game.yaw+=e.movementX*s;
      Game.pitch=clamp(Game.pitch+e.movementY*s*iv,-0.35,1.32);
      Game.cursorN.x=0; Game.cursorN.y=0;
      Game.aimPx=Game.engine.getRenderWidth()/2; Game.aimPy=Game.engine.getRenderHeight()/2;
      centerCrosshair();
    } else {
      // Not locked → free cursor aim (COD-on-web style). Crosshair + bullets
      // follow the real cursor; pushing toward the screen edges turns the view.
      const rect=canvas.getBoundingClientRect();
      const cx=clamp(e.clientX-rect.left,0,rect.width), cy=clamp(e.clientY-rect.top,0,rect.height);
      Game.aimPx=cx*(Game.engine.getRenderWidth()/rect.width);
      Game.aimPy=cy*(Game.engine.getRenderHeight()/rect.height);
      Game.cursorN.x=(cx/rect.width)*2-1;
      Game.cursorN.y=(cy/rect.height)*2-1;
      moveCrosshair(cx,cy);
    }
  });
}
function overlayOpen(){
  return Game.mapOpen||Game.shopOpen||Game.garageOpen||Game.contractsOpen||Game.missionsOpen||Game.codesOpen||Game.skillsOpen||$('inv').classList.contains('show');
}
function moveCrosshair(x,y){
  const c=$('crosshair'); if(c){ c.style.left=x+'px'; c.style.top=y+'px'; }
  const h=$('hitmark'); if(h){ h.style.left=x+'px'; h.style.top=y+'px'; }
}
function centerCrosshair(){
  const c=$('crosshair'); if(c){ c.style.left='50%'; c.style.top='50%'; }
  const h=$('hitmark'); if(h){ h.style.left='50%'; h.style.top='50%'; }
}

window.addEventListener('DOMContentLoaded',()=>{ bindUI(); bindInput(); boot(); });
