"use strict";
/* =====================================================================
   VERDANT — progression.js
   Two persistent / readability systems:
     1. Stats save  — best score, best wave, lifetime kills & run count,
                       persisted to localStorage and shown on menu + over.
     2. Health bars — floating bars above hostiles (toggle in Settings).
   ===================================================================== */

/* ===================================================================
   1 · STATS PERSISTENCE
   =================================================================== */
const STATS_KEY='verdant_stats';
function loadStats(){
  try{ return JSON.parse(localStorage.getItem(STATS_KEY)) || {}; }
  catch(e){ return {}; }
}
function saveStats(s){ try{ localStorage.setItem(STATS_KEY, JSON.stringify(s)); }catch(e){} }
function recordRun(){
  const s=loadStats();
  s.best     = Math.max(s.best||0,     Game.score);
  s.bestWave = Math.max(s.bestWave||0, Game.wave);
  s.totalKills = (s.totalKills||0) + (Game.killCount||0);
  s.games    = (s.games||0) + 1;
  saveStats(s);
  return s;
}
function renderMenuStats(){
  const el=$('menuStats'); if(!el) return;
  const s=loadStats();
  if(s.best){
    el.style.display='block';
    el.textContent=`BEST ${s.best.toLocaleString()}  ·  WAVE ${s.bestWave||1}  ·  ${(s.totalKills||0).toLocaleString()} KILLS  ·  ${s.games||0} RUNS`;
  } else el.style.display='none';
}

/* ===================================================================
   1b · WEAPON UNLOCKS (codes + missions, persisted)
   =================================================================== */
const UNLOCK_KEY='verdant_unlocks';
function loadUnlocks(){ try{ return JSON.parse(localStorage.getItem(UNLOCK_KEY))||[]; }catch(e){ return []; } }
function saveUnlocks(a){ try{ localStorage.setItem(UNLOCK_KEY, JSON.stringify([...new Set(a)])); }catch(e){} }
function isWeaponUnlocked(id){ return loadUnlocks().includes(id); }
function unlockWeapon(id,quiet){
  const a=loadUnlocks(); if(a.includes(id)) return false;
  a.push(id); saveUnlocks(a); applyUnlocks();
  if(!quiet){ const w=(Game.weapons||[]).find(x=>x.id===id); toast('🔓 UNLOCKED '+((w&&w.name)||id)); if(typeof sfx==='function') sfx('kill'); }
  return true;
}
// mark any unlocked weapons as owned in the live loadout
function applyUnlocks(){
  if(!Game.weapons) return;
  const a=loadUnlocks();
  Game.weapons.forEach(w=>{ if(a.includes(w.id)) w.owned=true; });
  if(typeof updateQuickSlots==='function') updateQuickSlots();
  if(typeof renderInventory==='function') renderInventory();
}

/* ===================================================================
   2 · ENEMY HEALTH BARS
   =================================================================== */
function clearHealthBars(){
  const wrap=$('healthbars'); if(wrap) wrap.innerHTML='';
  Game.enemies.forEach(e=>{ e.hpBar=null; });
}
function removeHealthBar(e){ if(e&&e.hpBar){ e.hpBar.remove(); e.hpBar=null; } }
function updateHealthBars(){
  const wrap=$('healthbars'); if(!wrap) return;
  const on=Game.settings.healthbars;
  for(const e of Game.enemies){
    if(e.boss || e.dead){ if(e.hpBar){ e.hpBar.style.display='none'; } continue; }   // boss uses the top bar
    if(!on){ if(e.hpBar){ e.hpBar.remove(); e.hpBar=null; } continue; }
    if(!e.hpBar){ const el=document.createElement('div'); el.className='ehp'; el.innerHTML='<i></i>'; wrap.appendChild(el); e.hpBar=el; }
    const s=e.rig.root.scaling.x;
    const head=new BABYLON.Vector3(e.body.position.x, e.body.position.y+2.35*s, e.body.position.z);
    const sp=projectToScreen(head);
    if(sp.behind){ e.hpBar.style.display='none'; continue; }
    const d=BABYLON.Vector3.Distance(Game.camera.position, e.body.position);
    if(d>90){ e.hpBar.style.display='none'; continue; }
    e.hpBar.style.display='block';
    e.hpBar.style.left=sp.x+'px'; e.hpBar.style.top=sp.y+'px';
    e.hpBar.firstChild.style.width=Math.max(0, e.hp/e.maxHp*100)+'%';
  }
}
