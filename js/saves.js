"use strict";
/* =====================================================================
   VERDANT — saves.js   (Phase 4: save slots)
   Three manual save slots for your progression profile. A slot snapshots
   all persistent progress keys (level/XP/perks, achievements, missions,
   weapon unlocks, lifetime stats); loading one restores them and re-inits
   the live systems. Console-style: your current run keeps playing; slots
   are manual save/load points.
   ===================================================================== */

const SLOT_KEYS=['verdant_profile','verdant_mstats','verdant_mdone','verdant_unlocks','verdant_stats'];
const SLOT_COUNT=3;
function slotKey(n){ return 'verdant_slot_'+n; }

function snapshotProgress(){
  const o={};
  for(const k of SLOT_KEYS){ const v=localStorage.getItem(k); if(v!=null) o[k]=v; }
  return o;
}
function slotMeta(n){
  try{
    const blob=JSON.parse(localStorage.getItem(slotKey(n))); if(!blob) return null;
    let level=1, ach=0;
    try{ const p=JSON.parse(blob.keys['verdant_profile']||'{}'); level=p.level||1; ach=(p.achievements||[]).length; }catch(e){}
    return { name:blob.name||('Slot '+(n+1)), savedAt:blob.savedAt||0, level, ach };
  }catch(e){ return null; }
}
function saveSlot(n,name){
  const blob={ name:name||('Slot '+(n+1)), savedAt:Date.now(), keys:snapshotProgress() };
  try{ localStorage.setItem(slotKey(n), JSON.stringify(blob)); }catch(e){}
  toast('SAVED TO SLOT '+(n+1));
  renderSaves();
}
function loadSlot(n){
  let blob; try{ blob=JSON.parse(localStorage.getItem(slotKey(n))); }catch(e){}
  if(!blob){ toast('SLOT '+(n+1)+' IS EMPTY'); return false; }
  for(const k of SLOT_KEYS){ if(blob.keys[k]!=null) localStorage.setItem(k, blob.keys[k]); else localStorage.removeItem(k); }
  // re-init live systems from the restored data
  if(typeof initRPG==='function') initRPG();
  if(typeof initMissions==='function') initMissions();
  if(typeof applyUnlocks==='function' && Game.weapons) applyUnlocks();
  if(typeof updateLevelHUD==='function') updateLevelHUD();
  if(typeof renderMenuStats==='function') renderMenuStats();
  toast('LOADED SLOT '+(n+1));
  renderSaves();
  return true;
}
function deleteSlot(n){
  try{ localStorage.removeItem(slotKey(n)); }catch(e){}
  toast('CLEARED SLOT '+(n+1)); renderSaves();
}

/* ------------------------- panel ------------------------- */
function openSaves(){ renderSaves(); show('saves'); Game.savesOpen=true; document.exitPointerLock&&document.exitPointerLock(); }
function closeSaves(){ Game.savesOpen=false; hide('saves'); if(Game.state==='playing') lockPointer(); }
function toggleSaves(){ Game.savesOpen?closeSaves():openSaves(); }
function fmtDate(ts){ if(!ts) return ''; const d=new Date(ts);
  return d.toLocaleDateString(undefined,{month:'short',day:'numeric'})+' '+d.toLocaleTimeString(undefined,{hour:'2-digit',minute:'2-digit'}); }
function renderSaves(){
  const g=$('saveGrid'); if(!g) return; g.innerHTML='';
  for(let n=0;n<SLOT_COUNT;n++){
    const meta=slotMeta(n);
    const card=document.createElement('div'); card.className='savecard'+(meta?'':' empty');
    if(meta){
      card.innerHTML=`<div class="svtop"><span class="svname">Slot ${n+1}</span><span class="svdate">${fmtDate(meta.savedAt)}</span></div>`+
        `<div class="svinfo">Level <b>${meta.level}</b> · ${meta.ach} achievements</div>`+
        `<div class="svbtns"><button class="svb load">LOAD</button><button class="svb save">OVERWRITE</button><button class="svb del">CLEAR</button></div>`;
      card.querySelector('.load').onclick=()=>loadSlot(n);
      card.querySelector('.save').onclick=()=>saveSlot(n);
      card.querySelector('.del').onclick=()=>deleteSlot(n);
    } else {
      card.innerHTML=`<div class="svtop"><span class="svname">Slot ${n+1}</span><span class="svdate">empty</span></div>`+
        `<div class="svinfo" style="opacity:.6">No save data</div>`+
        `<div class="svbtns"><button class="svb save">SAVE HERE</button></div>`;
      card.querySelector('.save').onclick=()=>saveSlot(n);
    }
    g.appendChild(card);
  }
}
