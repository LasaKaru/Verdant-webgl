"use strict";
/* =====================================================================
   VERDANT — gunsmith.js   (Phase 2: weapon attachments)
   Per-weapon attachment slots (optic / barrel / magazine / grip / laser)
   that modify effective stats. Loadouts persist in localStorage and are
   re-applied whenever weapons are (re)built. Tune in the Gunsmith panel.
   ===================================================================== */

const ATTACH={
  optic:[ {id:'none',name:'Iron Sights'},
          {id:'reddot',name:'Red Dot',   eff:{spread:0.80}},
          {id:'holo',  name:'Holo',      eff:{spread:0.70}},
          {id:'scope4x',name:'4× Scope', eff:{spread:0.55, zoom:true}} ],
  barrel:[{id:'none',name:'Standard'},
          {id:'supp',  name:'Suppressor',    eff:{dmg:0.90, spread:0.85, silent:true}},
          {id:'comp',  name:'Compensator',   eff:{spread:0.60}},
          {id:'long',  name:'Long Barrel',   eff:{range:1.40, dmg:1.10}} ],
  mag:[   {id:'none',name:'Standard'},
          {id:'ext',   name:'Extended Mag',  eff:{maxMag:1.5}},
          {id:'drum',  name:'Drum Mag',      eff:{maxMag:2.0, reloadMs:1.30}},
          {id:'fast',  name:'Fast Mag',      eff:{reloadMs:0.65}} ],
  grip:[  {id:'none',name:'None'},
          {id:'fore',  name:'Foregrip',      eff:{spread:0.75}},
          {id:'tac',   name:'Tac Grip',      eff:{spread:0.85}} ],
  laser:[ {id:'none',name:'None'},
          {id:'laser', name:'Laser Sight',   eff:{spread:0.70}} ],
};
const ATTACH_SLOTS=['optic','barrel','mag','grip','laser'];
const SLOT_LABEL={optic:'Optic',barrel:'Barrel',mag:'Magazine',grip:'Grip',laser:'Laser'};

function findAttach(slot,id){ return (ATTACH[slot]||[]).find(a=>a.id===id)||null; }
function loadAttachments(){ if(!Game.attachments){ try{ Game.attachments=JSON.parse(localStorage.getItem('verdant_attach'))||{}; }catch(e){ Game.attachments={}; } } return Game.attachments; }
function saveAttachments(){ try{ localStorage.setItem('verdant_attach', JSON.stringify(Game.attachments||{})); }catch(e){} }

function ensureBase(w){ if(!w.base) w.base={dmg:w.dmg,spread:w.spread,maxMag:w.maxMag,reloadMs:w.reloadMs,range:w.range,zoom:!!w.zoom}; }
function applyAttachments(w){
  ensureBase(w); const b=w.base; const cfg=loadAttachments()[w.id]||{};
  let dmg=b.dmg, spread=b.spread, mag=b.maxMag, reload=b.reloadMs, range=b.range, zoom=b.zoom, silent=false;
  for(const slot of ATTACH_SLOTS){
    const att=findAttach(slot,cfg[slot]); if(!att||!att.eff) continue; const e=att.eff;
    if(e.dmg) dmg*=e.dmg; if(e.spread) spread*=e.spread;
    if(e.maxMag) mag*=e.maxMag; if(e.reloadMs) reload*=e.reloadMs; if(e.range) range*=e.range;
    if(e.zoom) zoom=true; if(e.silent) silent=true;
  }
  w.dmg=Math.round(dmg*10)/10; w.spread=spread; w.maxMag=Math.round(mag);
  w.reloadMs=Math.round(reload); w.range=range; w.zoom=zoom; w.silent=silent;
  if(w.ammo>w.maxMag) w.ammo=w.maxMag;
}
function applyAllAttachments(){ if(!Game.weapons) return; loadAttachments(); Game.weapons.forEach(applyAttachments); if(typeof refreshAmmoHUD==='function') refreshAmmoHUD(); }
function equipAttachment(wid,slot,id){
  loadAttachments(); Game.attachments[wid]=Game.attachments[wid]||{}; Game.attachments[wid][slot]=id; saveAttachments();
  if(Game.weapons){ const w=Game.weapons.find(x=>x.id===wid); if(w) applyAttachments(w); }
  sfx&&sfx('click'); renderGunsmith();
}

/* ------------------------- panel ------------------------- */
const GUN_LIST=['pistol','rifle','shotgun','sniper','minigun','rocket','railgun','flame','goldengun'];
const GUN_ICON={pistol:'🔫',rifle:'🪖',shotgun:'💥',sniper:'🎯',minigun:'⚙️',rocket:'🚀',railgun:'⚡',flame:'🔥',goldengun:'✨'};
function openGunsmith(){ Game.gunsmithSel=Game.gunsmithSel||'pistol'; renderGunsmith(); show('gunsmith'); Game.gunsmithOpen=true; document.exitPointerLock&&document.exitPointerLock(); }
function closeGunsmith(){ Game.gunsmithOpen=false; hide('gunsmith'); if(Game.state==='playing') lockPointer(); }
function toggleGunsmith(){ Game.gunsmithOpen?closeGunsmith():openGunsmith(); }
function gunBase(id){
  // a base-stat reference even when Game.weapons isn't built yet
  if(Game.weapons){ const w=Game.weapons.find(x=>x.id===id); if(w){ ensureBase(w); return w.base; } }
  const def=defaultWeapons().find(x=>x.id===id) || {dmg:0,spread:0.05,maxMag:1,reloadMs:1000,range:100};
  return {dmg:def.dmg,spread:def.spread,maxMag:def.maxMag,reloadMs:def.reloadMs,range:def.range,zoom:!!def.zoom};
}
function gunEffective(id){
  const b=gunBase(id), cfg=loadAttachments()[id]||{};
  let dmg=b.dmg,spread=b.spread,mag=b.maxMag,reload=b.reloadMs,range=b.range;
  for(const slot of ATTACH_SLOTS){ const a=findAttach(slot,cfg[slot]); if(!a||!a.eff)continue; const e=a.eff;
    if(e.dmg)dmg*=e.dmg; if(e.spread)spread*=e.spread; if(e.maxMag)mag*=e.maxMag; if(e.reloadMs)reload*=e.reloadMs; if(e.range)range*=e.range; }
  return {dmg:Math.round(dmg*10)/10,spread,mag:Math.round(mag),reload:Math.round(reload),range:Math.round(range)};
}
function renderGunsmith(){
  loadAttachments();
  const sel=Game.gunsmithSel||'pistol';
  // weapon tabs
  const tabs=$('gunTabs'); if(tabs){ tabs.innerHTML='';
    GUN_LIST.forEach(id=>{ const b=document.createElement('button'); b.className='guntab'+(id===sel?' active':'');
      b.innerHTML=GUN_ICON[id]; b.title=id; b.onclick=()=>{ Game.gunsmithSel=id; renderGunsmith(); }; tabs.appendChild(b); }); }
  // slots
  const g=$('gunSlots'); if(g){ g.innerHTML='';
    const cfg=Game.attachments[sel]||{};
    ATTACH_SLOTS.forEach(slot=>{
      const row=document.createElement('div'); row.className='gsrow';
      const cur=cfg[slot]||'none';
      const opts=ATTACH[slot].map(a=>`<option value="${a.id}"${a.id===cur?' selected':''}>${a.name}</option>`).join('');
      row.innerHTML=`<span class="gslabel">${SLOT_LABEL[slot]}</span><select class="gssel">${opts}</select>`;
      row.querySelector('select').onchange=e=>equipAttachment(sel,slot,e.target.value);
      g.appendChild(row);
    });
  }
  // stat preview
  const s=$('gunStats'); if(s){ const b=gunBase(sel), e=gunEffective(sel);
    const bar=(label,val,max,base)=>{ const pct=Math.min(100,val/max*100), bp=Math.min(100,base/max*100);
      const diff=val>base?'up':val<base?'down':'';
      return `<div class="gstat"><span class="gsl">${label}</span><div class="gstrack"><i style="width:${pct}%"></i><b style="left:${bp}%"></b></div><span class="gsv ${diff}">${val}</span></div>`; };
    const acc=v=>Math.round((1-v)*1000)/10; // higher = tighter
    s.innerHTML=
      bar('DMG', e.dmg, 250, b.dmg)+
      bar('ACCURACY', acc(e.spread), acc(0.002), acc(b.spread))+
      bar('MAG', e.mag, Math.max(30,b.maxMag*2), b.maxMag)+
      bar('RANGE', e.range, 400, b.range)+
      bar('RELOAD ms', e.reload, 2700, b.reloadMs);
  }
}
