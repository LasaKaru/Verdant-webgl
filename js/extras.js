"use strict";
/* =====================================================================
   VERDANT — extras.js
   Four sandbox systems:
     1. Cash drops      — enemies/police drop pickup-able money bundles
     2. Vehicle garage  — a pad where you spawn rides from a menu (V)
     3. Mission boards  — paid contracts with live tracking (K)
     4. Customization    — character, weapon tint & starting loadout
   ===================================================================== */

/* ===================================================================
   1 · CASH DROPS
   =================================================================== */
function spawnCashDrop(x,z,val){
  const y=heightAt(x,z)+0.6;
  const m=BABYLON.MeshBuilder.CreateBox('cash',{width:0.6,height:0.28,depth:0.42},Game.scene);
  m.material=bmat(Game.scene,'cashm',[0.30,0.72,0.38],0.45);
  m.position.set(x,y,z); m.rotation.y=rand(0,6); m.isPickable=false;
  Game.moneyDrops.push({mesh:m,val,baseY:y});
}
function updateMoneyDrops(dt,now){
  const p=Game.player.position;
  for(const c of [...Game.moneyDrops]){
    c.mesh.rotation.y+=dt*2.5; c.mesh.position.y=c.baseY+Math.sin(now*0.005+c.baseY)*0.12;
    if(BABYLON.Vector3.Distance(p,c.mesh.position)<2.6){
      addMoney(c.val, c.mesh.position.clone()); sfx('pickup');
      trackContract('cash',c.val);
      c.mesh.dispose(); Game.moneyDrops=Game.moneyDrops.filter(x=>x!==c);
    }
  }
}
function clearMoneyDrops(){ (Game.moneyDrops||[]).forEach(c=>c.mesh.dispose()); Game.moneyDrops=[]; }

/* ===================================================================
   2 · VEHICLE GARAGE
   =================================================================== */
const GARAGE={x:-12,z:10};
const GARAGE_RIDES=[
  { id:'sedan',  name:'Civic Sedan',  col:[0.85,0.85,0.88], ico:'🚗', price:0   },
  { id:'sport',  name:'GT Sport',     col:[0.90,0.25,0.22], ico:'🏎️', price:300 },
  { id:'truck',  name:'Hauler Truck', col:[0.3,0.5,0.7],    ico:'🚙', price:200 },
  { id:'taxi',   name:'City Taxi',    col:[0.95,0.78,0.2],  ico:'🚕', price:150 },
];
function buildGaragePad(scene){
  const y=heightAt(GARAGE.x,GARAGE.z);
  const pad=BABYLON.MeshBuilder.CreateBox('garagePad',{width:9,height:0.2,depth:9},scene);
  pad.position.set(GARAGE.x,y+0.1,GARAGE.z);
  const pm=new BABYLON.StandardMaterial('garagePm',scene);
  pm.diffuseColor=new BABYLON.Color3(0.2,0.2,0.24); pm.emissiveColor=new BABYLON.Color3(0.18,0.18,0.22);
  pm.specularColor=new BABYLON.Color3(0,0,0); pad.material=pm; pad.isPickable=false;
  // chevron stripes
  for(let i=-1;i<=1;i++){ const s=BABYLON.MeshBuilder.CreateBox('gs',{width:7,height:0.04,depth:0.6},scene);
    s.position.set(GARAGE.x,y+0.22,GARAGE.z+i*2.4); s.material=bmat(scene,'gsm',[0.95,0.8,0.2],0.3); s.isPickable=false; }
  // floating sign
  const sign=BABYLON.MeshBuilder.CreatePlane('gsign',{width:4,height:1.1},scene);
  const t=new BABYLON.DynamicTexture('gsT',{width:320,height:88},scene,false);
  t.getContext().fillStyle='#0c1a10'; t.getContext().fillRect(0,0,320,88);
  t.drawText('🅖 GARAGE',26,58,'bold 44px Oswald, sans-serif','#ffd23f','transparent'); t.update();
  const sm=new BABYLON.StandardMaterial('gsM',scene); sm.emissiveTexture=t; sm.opacityTexture=t; t.hasAlpha=true;
  sm.disableLighting=true; sign.material=sm; sign.position.set(GARAGE.x,y+3.4,GARAGE.z);
  sign.billboardMode=BABYLON.Mesh.BILLBOARDMODE_Y; sign.isPickable=false;
}
function nearGarage(){ const p=Game.player.position; return Math.hypot(p.x-GARAGE.x,p.z-GARAGE.z)<5; }
function openGarage(){
  if(Game.state!=='playing') return;
  renderGarage(); show('garage'); Game.garageOpen=true; document.exitPointerLock&&document.exitPointerLock();
}
function closeGarage(){ Game.garageOpen=false; hide('garage'); if(Game.state==='playing') lockPointer(); }
function toggleGarage(){ Game.garageOpen?closeGarage():(nearGarage()?openGarage():toast('GO TO THE 🅖 GARAGE PAD')); }
function renderGarage(){
  $('garageMoney').textContent='$'+Game.money.toLocaleString();
  const g=$('garageGrid'); g.innerHTML='';
  GARAGE_RIDES.forEach(r=>{
    const can=Game.money>=r.price;
    const card=document.createElement('div'); card.className='shopcard'+(can?'':' disabled');
    card.innerHTML=`<div class="si">${r.ico}</div><div class="sn">${r.name}</div>`+
      `<div class="sd">${r.id==='sport'?'Fast':r.id==='truck'?'Tanky':r.id==='taxi'?'Balanced':'Reliable'}</div>`+
      `<div class="sp">${r.price?'$'+r.price:'FREE'}</div>`;
    if(can) card.onclick=()=>spawnRide(r);
    g.appendChild(card);
  });
}
function spawnRide(r){
  if(Game.money<r.price){ toast('NOT ENOUGH CASH'); return; }
  Game.money-=r.price; updateMoneyHUD();
  const p=Game.player.position;
  const v=buildVehicle(Game.scene, p.x+3, p.z+2, r.col);
  if(r.id==='sport') v.topSpeed=42; if(r.id==='truck') v.topSpeed=22;
  sfx('pickup'); toast(r.name.toUpperCase()+' READY — PRESS F'); closeGarage();
}

/* ===================================================================
   3 · MISSION CONTRACTS
   =================================================================== */
function genContracts(){
  const pool=[
    ()=>({type:'kill', goal:5+Game.wave, prog:0, reward:300+Game.wave*40, desc:'Eliminate {g} hostiles'}),
    ()=>({type:'kill', goal:3, prog:0, reward:250, desc:'Eliminate {g} hostiles'}),
    ()=>({type:'cash', goal:300, prog:0, reward:200, desc:'Collect ${g} in cash'}),
    ()=>({type:'survive', goal:1, prog:0, reward:400, desc:'Survive & clear a wave'}),
    ()=>({type:'head', goal:3, prog:0, reward:350, desc:'Land {g} headshots'}),
  ];
  Game.contractOffers=[];
  const idx=[...pool.keys()].sort(()=>Math.random()-0.5).slice(0,3);
  idx.forEach(i=>Game.contractOffers.push(pool[i]()));
}
function openContracts(){
  if(Game.state!=='playing') return;
  if(!Game.contractOffers||!Game.contractOffers.length) genContracts();
  renderContracts(); show('contracts'); Game.contractsOpen=true; document.exitPointerLock&&document.exitPointerLock();
}
function closeContracts(){ Game.contractsOpen=false; hide('contracts'); if(Game.state==='playing') lockPointer(); }
function toggleContracts(){ Game.contractsOpen?closeContracts():openContracts(); }
function cDesc(c){ return c.desc.replace('{g}',c.goal); }
function renderContracts(){
  const g=$('contractGrid'); g.innerHTML='';
  if(Game.contract){
    const c=Game.contract; const card=document.createElement('div'); card.className='contractcard active';
    card.innerHTML=`<div class="ct">ACTIVE CONTRACT</div><div class="cdesc">${cDesc(c)}</div>`+
      `<div class="cprog">${Math.min(c.prog,c.goal)} / ${c.goal}</div>`+
      `<div class="creward">REWARD $${c.reward}</div>`;
    g.appendChild(card);
    const hint=document.createElement('div'); hint.className='inv-hint'; hint.style.gridColumn='1/-1';
    hint.textContent='Complete your active contract to take another.'; g.appendChild(hint);
    return;
  }
  Game.contractOffers.forEach(c=>{
    const card=document.createElement('div'); card.className='contractcard';
    card.innerHTML=`<div class="ct">${c.type.toUpperCase()} JOB</div><div class="cdesc">${cDesc(c)}</div>`+
      `<div class="creward">REWARD $${c.reward}</div><div class="caccept">ACCEPT ▸</div>`;
    card.onclick=()=>{ Game.contract={...c}; sfx('click'); toast('CONTRACT ACCEPTED'); updateContractHUD(); renderContracts(); };
    g.appendChild(card);
  });
}
function trackContract(type,amount){
  const c=Game.contract; if(!c) return;
  if(c.type===type){ c.prog+=(amount||1); updateContractHUD();
    if(c.prog>=c.goal) completeContract(); }
}
function completeContract(){
  const c=Game.contract; if(!c) return;
  addMoney(c.reward); Game.score+=c.reward;
  bigToast('CONTRACT DONE','+$'+c.reward+' paid'); sfx('kill');
  Game.contract=null; genContracts(); updateContractHUD();
}
function updateContractHUD(){
  const el=$('contractHud'); if(!el) return;
  if(Game.contract){ el.style.display='block';
    el.querySelector('.chd').textContent=cDesc(Game.contract);
    el.querySelector('.chp').textContent=Math.min(Game.contract.prog,Game.contract.goal)+' / '+Game.contract.goal;
  } else el.style.display='none';
}

/* ===================================================================
   4 · CUSTOMIZATION
   =================================================================== */
const GUN_TINTS=[
  {name:'Gunmetal', col:[0.10,0.10,0.12], tracer:[1,0.86,0.42]},
  {name:'Toxic',    col:[0.30,0.65,0.20], tracer:[0.6,1,0.3]},
  {name:'Gold',     col:[0.75,0.58,0.15], tracer:[1,0.85,0.3]},
  {name:'Coral',    col:[0.75,0.25,0.22], tracer:[1,0.5,0.4]},
  {name:'Ice',      col:[0.45,0.6,0.75],  tracer:[0.6,0.85,1]},
];
const START_WEAPONS=[
  {id:'pistol', name:'Pistol'}, {id:'rifle', name:'Rifle'}, {id:'shotgun', name:'Shotgun'},
];
function initCustom(){
  if(!Game.custom) Game.custom={ gunTint:0, startWeapon:'pistol' };
}
function applyGunTint(){
  initCustom();
  const t=GUN_TINTS[Game.custom.gunTint];
  Game.tracerColor=t.tracer;
  if(Game.playerRig&&Game.playerRig.gun&&Game.playerRig.gun.material){
    Game.playerRig.gun.material.diffuseColor=new BABYLON.Color3(t.col[0],t.col[1],t.col[2]);
  }
}
function buildCustomPanel(){
  initCustom();
  // character chips
  const cc=$('custChars'); cc.innerHTML='';
  CHAR_VARIANTS.forEach((c,i)=>{
    const chip=document.createElement('div'); chip.className='char-chip'+(i===Game.charIndex?' sel':'');
    const sh=`rgb(${c.shirt.map(v=>Math.round(v*255)).join(',')})`, sk=`rgb(${c.skin.map(v=>Math.round(v*255)).join(',')})`;
    chip.style.background=`linear-gradient(160deg, ${sk} 0 38%, ${sh} 38% 100%)`; chip.title=c.name;
    chip.onclick=()=>{ Game.charIndex=i; buildCustomPanel(); buildCharPicker&&buildCharPicker(); };
    cc.appendChild(chip);
  });
  // gun tints
  const gt=$('custTints'); gt.innerHTML='';
  GUN_TINTS.forEach((t,i)=>{
    const chip=document.createElement('div'); chip.className='tint-chip'+(i===Game.custom.gunTint?' sel':'');
    chip.style.background=`rgb(${t.col.map(v=>Math.round(v*255)).join(',')})`; chip.title=t.name;
    chip.onclick=()=>{ Game.custom.gunTint=i; buildCustomPanel(); };
    gt.appendChild(chip);
  });
  // start weapon
  const sw=$('custStart'); sw.querySelectorAll('button').forEach(b=>{
    b.classList.toggle('active', b.dataset.w===Game.custom.startWeapon);
    b.onclick=()=>{ Game.custom.startWeapon=b.dataset.w; buildCustomPanel(); };
  });
}

/* per-frame zone prompts (garage) */
function updateExtras(dt,now){
  updateMoneyDrops(dt,now);
  const pr=$('garagePrompt');
  if(pr) pr.style.display = (nearGarage()&&!Game.inVehicle) ? 'block':'none';
}
