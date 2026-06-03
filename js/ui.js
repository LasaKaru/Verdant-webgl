"use strict";
/* =====================================================================
   VERDANT — ui.js
   HUD refresh, radar minimap + compass, inventory grid, quick-slots,
   toasts, character picker, and all menu / settings wiring.
   ===================================================================== */

/* ------------------------- Toasts ------------------------- */
let toastT=null;
function toast(msg){ const t=$('toast'); t.textContent=msg; t.classList.add('show');
  clearTimeout(toastT); toastT=setTimeout(()=>t.classList.remove('show'),1700); }
let bigT=null;
function bigToast(l1,l2){ $('bigL1').textContent=l1; $('bigL2').textContent=l2;
  const b=$('bigtoast'); b.classList.add('show'); clearTimeout(bigT);
  bigT=setTimeout(()=>b.classList.remove('show'),2200); }

/* ------------------------- Vitals / ammo ------------------------- */
function refreshHP(){ $('hpFill').style.width=Math.max(0,Game.playerData.hp/(Game.maxHP||100)*100)+'%'; }
function refreshSP(){ $('spFill').style.width=Math.max(0,Game.playerData.stamina)+'%'; }
function refreshArmor(){ $('arFill').style.width=Math.max(0,Game.playerData.armor)+'%'; }
function refreshAmmoHUD(){
  const w=currentW();
  $('wName').textContent=w.name; $('ammoMag').textContent=w.ammo; $('ammoRes').textContent=' / '+w.reserve;
  updateQuickSlots();
}
function updateGrenadeHUD(){ $('grenadeCount').textContent='✛ GRENADES '+Game.grenadeCount; }
function updateHUD(){ $('scoreLbl').textContent=Game.score; $('enemyCount').textContent=Game.enemies.length; }
function flashHitmark(head){ const h=$('hitmark'); h.style.opacity='1';
  h.style.filter=head?'drop-shadow(0 0 4px #ffd23f)':''; setTimeout(()=>h.style.opacity='0',90); }

/* ------------------------- Quick slots ------------------------- */
function updateQuickSlots(){
  const wrap=$('qslots'); wrap.innerHTML='';
  const icons={pistol:'🔫',rifle:'🪖',shotgun:'💥',sniper:'🎯',minigun:'⚙️',rocket:'🚀',railgun:'⚡',flame:'🔥',goldengun:'✨'};
  Game.weapons.forEach((w,i)=>{
    const d=document.createElement('div'); d.className='qslot'+(i===Game.currentWeapon?' on':'')+(w.owned?'':' dim');
    d.innerHTML=`<span class="qn">${i+1}</span><span class="qi">${icons[w.id]}</span><span class="ql">${w.name}</span>`;
    wrap.appendChild(d);
  });
}

/* ------------------------- Inventory ------------------------- */
function renderInventory(){
  const g=$('invGrid'); g.innerHTML='';
  for(let i=0;i<10;i++){
    const item=Game.inventory[i];
    const slot=document.createElement('div'); slot.className='slot';
    if(item){
      const def=ITEM_DEFS[item.key]||{ico:'?',nm:item.key};
      const equipped = item.weapon!==undefined && item.weapon===Game.currentWeapon;
      if(equipped) slot.classList.add('equipped');
      const qty = item.key==='grenade'?Game.grenadeCount:item.qty;
      slot.innerHTML=`<span class="nm">${def.nm}</span><span class="ico">${def.ico}</span>`+
        (qty>1?`<span class="qty">x${qty}</span>`:'');
      slot.onclick=()=>useInventory(item);
    }
    g.appendChild(slot);
  }
}

/* ------------------------- Minimap + compass ------------------------- */
let _mmctx=null;
function drawMinimap(){
  const cv=$('minimap'); if(!cv) return;
  if(!_mmctx) _mmctx=cv.getContext('2d');
  const ctx=_mmctx, W=cv.width, H=cv.height, cx=W/2, cy=H/2;
  const range=72, scale=(W/2)/range;
  ctx.clearRect(0,0,W,H);
  // base disc
  ctx.fillStyle='#1d3326'; ctx.beginPath(); ctx.arc(cx,cy,W/2,0,7); ctx.fill();
  const p=Game.player.position, yaw=Game.yaw;
  const fX=Math.sin(yaw), fZ=Math.cos(yaw), rX=Math.cos(yaw), rZ=-Math.sin(yaw);
  const plot=(wx,wz)=>{ const dx=wx-p.x, dz=wz-p.z;
    const sx=(dx*rX+dz*rZ)*scale, sy=-(dx*fX+dz*fZ)*scale; return [cx+sx,cy+sy]; };
  // clip to circle
  ctx.save(); ctx.beginPath(); ctx.arc(cx,cy,W/2-2,0,7); ctx.clip();
  // roads
  ctx.strokeStyle='rgba(40,42,48,.95)'; ctx.lineWidth=3;
  (ROADS||[]).forEach(r=>{ const [ax,ay]=plot(r.x1,r.z1), [bx,by]=plot(r.x2,r.z2);
    ctx.beginPath(); ctx.moveTo(ax,ay); ctx.lineTo(bx,by); ctx.stroke(); });
  // city buildings
  ctx.fillStyle='#8d97a6';
  (Game.cityBuildings||[]).forEach(b=>{ const [x,y]=plot(b.x,b.z); ctx.fillRect(x-2,y-2,4,4); });
  // houses
  ctx.fillStyle='#6b7d70';
  (Game.houses||[]).forEach(h=>{ const [x,y]=plot(h.x,h.z); ctx.fillRect(x-2.5,y-2.5,5,5); });
  // people (villagers/pedestrians)
  ctx.fillStyle='#bfe0ff';
  (Game.villagers||[]).forEach(v=>{ const [x,y]=plot(v.rig.root.position.x,v.rig.root.position.z); ctx.fillRect(x-1,y-1,2,2); });
  // deer
  ctx.fillStyle='#c89a5b';
  (Game.deer||[]).forEach(d=>{ const [x,y]=plot(d.root.position.x,d.root.position.z); ctx.beginPath(); ctx.arc(x,y,1.8,0,7); ctx.fill(); });
  // traffic
  ctx.fillStyle='#dfe6ee';
  (Game.traffic||[]).forEach(c=>{ const [x,y]=plot(c.root.position.x,c.root.position.z); ctx.fillRect(x-1.5,y-1.5,3,3); });
  // police
  (Game.police||[]).forEach(c=>{ const [x,y]=plot(c.body.position.x,c.body.position.z);
    ctx.fillStyle='#3b6bff'; ctx.beginPath(); ctx.arc(x,y,3,0,7); ctx.fill(); });
  // items
  ctx.fillStyle='#ffd23f';
  Game.items.forEach(it=>{ const [x,y]=plot(it.mesh.position.x,it.mesh.position.z);
    ctx.beginPath(); ctx.arc(x,y,2.6,0,7); ctx.fill(); });
  // peers
  ctx.fillStyle='#3fb0c9';
  Object.values(Game.net.peers).forEach(pr=>{ const [x,y]=plot(pr.mesh.position.x,pr.mesh.position.z);
    ctx.beginPath(); ctx.arc(x,y,3,0,7); ctx.fill(); });
  // enemies
  Game.enemies.forEach(e=>{ const [x,y]=plot(e.body.position.x,e.body.position.z);
    ctx.fillStyle = e.type==='brute'?'#ff3b3b':e.type==='shooter'?'#ff8a3d':'#ff5a52';
    ctx.beginPath(); ctx.arc(x,y, e.type==='brute'?4.5:3.2 ,0,7); ctx.fill(); });
  ctx.restore();
  // player arrow (center)
  ctx.fillStyle='#ffffff'; ctx.beginPath();
  ctx.moveTo(cx,cy-7); ctx.lineTo(cx-5,cy+5); ctx.lineTo(cx+5,cy+5); ctx.closePath(); ctx.fill();
  // compass letter
  let deg=(yaw*180/Math.PI)%360; if(deg<0)deg+=360;
  const dirs=['N','NW','W','SW','S','SE','E','NE'];
  $('compass').textContent=dirs[Math.round(deg/45)%8];
}

/* ------------------------- Character picker ------------------------- */
function buildCharPicker(){
  const wrap=$('charPick'); wrap.innerHTML='';
  CHAR_VARIANTS.forEach((c,i)=>{
    const chip=document.createElement('div'); chip.className='char-chip'+(i===Game.charIndex?' sel':'');
    const sh=`rgb(${c.shirt.map(v=>Math.round(v*255)).join(',')})`;
    const sk=`rgb(${c.skin.map(v=>Math.round(v*255)).join(',')})`;
    chip.style.background=`linear-gradient(160deg, ${sk} 0 38%, ${sh} 38% 100%)`;
    chip.title=c.name;
    chip.onclick=()=>{ Game.charIndex=i; buildCharPicker(); sfx&&Game.audio&&sfx('click'); };
    wrap.appendChild(chip);
  });
}

/* ------------------------- Menus + settings ------------------------- */
function bindUI(){
  buildCharPicker();
  document.querySelectorAll('#menu .mbtn').forEach(b=>b.onclick=()=>{
    const a=b.dataset.act;
    if(a==='play') startMission();
    else if(a==='settings') setState('settings');
    else if(a==='customize'){ buildCustomPanel(); setState('customize'); }
    else if(a==='missions'){ if(typeof initMissions==='function'&&!Game.missions) initMissions(); openMissions(); }
    else if(a==='skills'){ if(typeof initRPG==='function'&&Game.xp==null) initRPG(); openSkills(); }
    else if(a==='gunsmith'){ openGunsmith(); }
    else if(a==='codes'){ openCodes(); }
    else if(a==='leaderboard'){ openLeaderboard(); }
    else if(a==='saves'){ openSaves(); }
    else if(a==='multiplayer') setState('mp');
    else if(a==='howto') setState('howto');
  });
  const cb=$('custBack'); if(cb) cb.onclick=()=> setState('menu');
  $('setBack').onclick=()=> setState(Game.prevMenu==='pause'?'paused':'menu');
  $('howBack').onclick=()=> setState('menu');
  $('mpBack').onclick=()=> setState('menu');
  $('resume').onclick=resumeGame;
  $('pauseSettings').onclick=()=>{ Game.prevMenu='pause'; setState('settings'); };
  $('quit').onclick=()=>{ document.exitPointerLock&&document.exitPointerLock(); setState('menu'); };
  $('retry').onclick=()=> startMission();
  const ob=$('overBoard'); if(ob) ob.onclick=()=> openLeaderboard();
  $('toMenu').onclick=()=> setState('menu');

  // segmented controls
  const seg=(id,attr,fn)=>$(id).querySelectorAll('button').forEach(b=>b.onclick=()=>{
    $(id).querySelectorAll('button').forEach(x=>x.classList.remove('active')); b.classList.add('active'); fn(b.dataset[attr]); });
  seg('segQuality','q',q=>{ Game.settings.quality=q;
    const scale= q==='low'?1.6 : q==='high'?0.8 : 1.1; Game.engine&&Game.engine.setHardwareScalingLevel(scale); });
  seg('segShadow','s',s=>{ Game.settings.shadows=(s==='on');
    if(Game.sun){ if(Game.settings.shadows && !Game.shadowGen){ Game.shadowGen=new BABYLON.ShadowGenerator(1024,Game.sun); Game.shadowGen.useBlurExponentialShadowMap=true; Game.shadowGen.blurScale=2; }
      else if(!Game.settings.shadows && Game.shadowGen){ Game.shadowGen.dispose(); Game.shadowGen=null; } } });
  seg('segCycle','c',c=>{ Game.settings.cycle=(c==='on'); });
  seg('segHealth','h',h=>{ Game.settings.healthbars=(h==='on'); });
  seg('segWeather','w',w=>{ Game.settings.weatherMode=w;
    if(w==='auto'){ Game.weatherTimer=rand(10,20); } else if(typeof setWeather==='function'){ setWeather(w); } });
  seg('segDiff','d',d=>{ Game.settings.difficulty=d; });
  seg('segInvY','i',i=>{ Game.settings.invertY=(i==='on'); });
  seg('segAuto','a',a=>{ Game.settings.autoSprint=(a==='on'); });
  seg('segMode','m',m=>{ Game.net.mode=m; });
  seg('segFps','f',f=>{ Game.settings.fps=(f==='on'); });

  const sl=(id,fmt,set)=>{ const el=$(id); el.oninput=()=>{ const v=+el.value; set(v); $(id+'Val').textContent=fmt(v); }; };
  sl('sens', v=>(v/100).toFixed(2), v=>Game.settings.sens=v/100);
  sl('vol',  v=>String(v),          v=>{ Game.settings.volume=v/100; setAmbientVolume(); });
  sl('fov',  v=>String(v),          v=>Game.settings.fov=v*Math.PI/180);
  sl('density', v=>String(v),       v=>Game.settings.density=v);
  sl('rdist',   v=>String(v),       v=>{ Game.settings.renderDist=v/100; if(typeof applyRenderDist==='function') applyRenderDist(); });

  $('mpConnect').onclick=()=> netConnect($('mpUrl').value.trim(), $('mpName').value.trim()||'Operator',
    $('mpRoom').value.trim()||'lobby', $('mpGroup').value.trim(), Game.net.mode);
  const gg=$('mpGroupGen'); if(gg) gg.onclick=()=>{ const code=Math.random().toString(36).slice(2,7).toUpperCase();
    $('mpGroup').value=code; toast('GROUP CODE '+code); };
  if(typeof initChat==='function') initChat();
  if(typeof initMissions==='function') initMissions();
  if(typeof initRPG==='function') initRPG();
  if(typeof initCodes==='function') initCodes();
  if(typeof initLeaderboard==='function') initLeaderboard();
  if(typeof initKeybinds==='function') initKeybinds();
  const setCtl=$('setControls'); if(setCtl) setCtl.onclick=openKeybinds;
  const kbClose=$('kbClose'); if(kbClose) kbClose.onclick=closeKeybinds;
  const kbReset=$('kbReset'); if(kbReset) kbReset.onclick=resetBinds;
  const kbl=$('keybinds'); if(kbl) kbl.addEventListener('click',e=>{ if(e.target.id==='keybinds') closeKeybinds(); });
  const lbc=$('lbClose'); if(lbc) lbc.onclick=closeLeaderboard;
  const svc=$('savesClose'); if(svc) svc.onclick=closeSaves;
  const gsc=$('gunClose'); if(gsc) gsc.onclick=closeGunsmith;
  const gsl=$('gunsmith'); if(gsl) gsl.addEventListener('click',e=>{ if(e.target.id==='gunsmith') closeGunsmith(); });
  const sk=$('skills'); if(sk) sk.addEventListener('click',e=>{ if(e.target.id==='skills') closeSkills(); });
  const lbl=$('leaderboard'); if(lbl) lbl.addEventListener('click',e=>{ if(e.target.id==='leaderboard') closeLeaderboard(); });
  const sv=$('saves'); if(sv) sv.addEventListener('click',e=>{ if(e.target.id==='saves') closeSaves(); });
  const cs=$('codeSubmit'); if(cs) cs.onclick=submitCode;
  const cClose=$('codeClose'); if(cClose) cClose.onclick=closeCodes;
  $('inv').addEventListener('click',e=>{ if(e.target.id==='inv') toggleInventory(); });
}
