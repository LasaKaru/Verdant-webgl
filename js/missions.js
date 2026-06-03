"use strict";
/* =====================================================================
   VERDANT — missions.js
   A campaign of objective-based missions tracked across runs. Each one
   completes once and pays out cash (if you're in a run) plus, for some,
   permanently UNLOCKS a weapon. Progress + completion persist in
   localStorage. Open the Mission Log with J.
   ===================================================================== */

const MISSIONS=[
  { id:'firstblood', name:'First Blood',      desc:'Eliminate 10 hostiles',     stat:'kills',      goal:10,   cash:400  },
  { id:'survivor',   name:'Survivor',         desc:'Clear 5 waves',             stat:'waves',      goal:5,    cash:700  },
  { id:'roadwarrior',name:'Road Warrior',     desc:'Drive a vehicle 5 times',   stat:'drives',     goal:5,    cash:400, unlock:'shotgun' },
  { id:'biggame',    name:'Big Game Hunter',  desc:'Defeat a boss',             stat:'bosses',     goal:1,    cash:800, unlock:'rifle'   },
  { id:'tycoon',     name:'Tycoon',           desc:'Earn $5,000 total',         stat:'cashEarned', goal:5000, cash:500  },
  { id:'slayer',     name:'Slayer',           desc:'Eliminate 100 hostiles',    stat:'kills',      goal:100,  cash:1000,unlock:'minigun' },
  { id:'veteran',    name:'Veteran',          desc:'Clear 15 waves',            stat:'waves',      goal:15,   cash:1800,unlock:'rocket'  },
  { id:'warlord',    name:'Warlord Bane',     desc:'Defeat 3 bosses',           stat:'bosses',     goal:3,    cash:2000,unlock:'railgun' },
  { id:'demolition', name:'Demolition Expert',desc:'Score 20 explosive kills',  stat:'nadeKills',  goal:20,   cash:1500,unlock:'goldengun'},
];

const MSTAT_KEY='verdant_mstats', MDONE_KEY='verdant_mdone';
function loadMStats(){ try{ return JSON.parse(localStorage.getItem(MSTAT_KEY))||{}; }catch(e){ return {}; } }
function saveMStats(){ try{ localStorage.setItem(MSTAT_KEY, JSON.stringify(Game.missionStats)); }catch(e){} }
function loadMDone(){ try{ return JSON.parse(localStorage.getItem(MDONE_KEY))||[]; }catch(e){ return []; } }
function saveMDone(a){ try{ localStorage.setItem(MDONE_KEY, JSON.stringify([...new Set(a)])); }catch(e){} }

function initMissions(){
  const base={ kills:0, bosses:0, cashEarned:0, waves:0, drives:0, nadeKills:0 };
  Game.missionStats=Object.assign(base, loadMStats());
  Game.missions=new Set(loadMDone());
}

/* called from gameplay hooks — increments a stat and checks completions */
function trackMission(stat, amount){
  if(!Game.missionStats) initMissions();
  if(Game.missionStats[stat]==null) return;
  Game.missionStats[stat]+=(amount||1); saveMStats();
  let changed=false;
  for(const m of MISSIONS){
    if(m.stat!==stat || Game.missions.has(m.id)) continue;
    if(Game.missionStats[stat]>=m.goal){ completeMission(m); changed=true; }
  }
  if(changed && Game.missionsOpen) renderMissions();
}
function completeMission(m){
  Game.missions.add(m.id); saveMDone([...Game.missions]);
  if(Game.state==='playing' && typeof addMoney==='function'){ addMoney(m.cash); Game.score+=m.cash; }
  if(typeof addXP==='function') addXP(Math.round(m.cash/4));
  if(m.unlock && typeof unlockWeapon==='function') unlockWeapon(m.unlock, true);
  const extra = m.unlock ? (' · 🔓 '+m.unlock.toUpperCase()) : '';
  if(typeof bigToast==='function') bigToast('MISSION COMPLETE','+$'+m.cash+extra);
  else if(typeof toast==='function') toast('MISSION COMPLETE: '+m.name);
}

/* ------------------------- panel ------------------------- */
function openMissions(){
  renderMissions(); show('missions'); Game.missionsOpen=true; document.exitPointerLock&&document.exitPointerLock();
}
function closeMissions(){ Game.missionsOpen=false; hide('missions'); if(Game.state==='playing') lockPointer(); }
function toggleMissions(){ Game.missionsOpen?closeMissions():openMissions(); }
function renderMissions(){
  const g=$('missionGrid'); if(!g) return; g.innerHTML='';
  const done=MISSIONS.filter(m=>Game.missions.has(m.id)).length;
  const hdr=$('missionCount'); if(hdr) hdr.textContent=done+' / '+MISSIONS.length;
  MISSIONS.forEach(m=>{
    const complete=Game.missions.has(m.id);
    const prog=Math.min(Game.missionStats[m.stat]||0, m.goal);
    const pct=Math.round(prog/m.goal*100);
    const card=document.createElement('div'); card.className='missioncard'+(complete?' done':'');
    card.innerHTML=
      `<div class="mtop"><span class="mname">${m.name}</span>${complete?'<span class="mtick">✓</span>':''}</div>`+
      `<div class="mdesc">${m.desc}</div>`+
      `<div class="mbar"><i style="width:${pct}%"></i></div>`+
      `<div class="mfoot"><span class="mprog">${prog} / ${m.goal}</span>`+
      `<span class="mreward">$${m.cash}${m.unlock?' · 🔓 '+m.unlock.toUpperCase():''}</span></div>`;
    g.appendChild(card);
  });
}
