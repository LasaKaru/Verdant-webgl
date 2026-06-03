"use strict";
/* =====================================================================
   VERDANT — rpg.js   (Phase 1: meta-progression)
   XP + levels + a skill tree of perks, plus an achievements system, all
   saved to a persistent profile in localStorage. Perks apply live to HP,
   damage, reload, sprint, cash and XP gain. Skill tree opens with O.
   ===================================================================== */

/* ------------------------- perks ------------------------- */
const PERKS=[
  { id:'vitality',   name:'Vitality',    ico:'❤', max:5, desc:'+20 Max HP / level' },
  { id:'gunslinger', name:'Gunslinger',  ico:'🎯', max:5, desc:'+8% weapon damage / level' },
  { id:'quickhands', name:'Quick Hands', ico:'⏱', max:4, desc:'-10% reload time / level' },
  { id:'marathon',   name:'Marathon',    ico:'🏃', max:4, desc:'+12% sprint speed / level' },
  { id:'scavenger',  name:'Scavenger',   ico:'💰', max:5, desc:'+15% cash from kills / level' },
  { id:'fastlearner',name:'Fast Learner',ico:'📚', max:4, desc:'+15% XP gained / level' },
];
function perkLvl(id){ return (Game.perks&&Game.perks[id])||0; }
function perkMaxHP(){ return 100 + perkLvl('vitality')*20; }
function perkDamageMult(){ return 1 + perkLvl('gunslinger')*0.08; }
function perkReloadMult(){ return Math.max(0.2, 1 - perkLvl('quickhands')*0.10); }
function perkSprintMult(){ return 1 + perkLvl('marathon')*0.12; }
function perkCashMult(){ return 1 + perkLvl('scavenger')*0.15; }
function perkXpMult(){ return 1 + perkLvl('fastlearner')*0.15; }

/* ------------------------- profile persistence ------------------------- */
const PROFILE_KEY='verdant_profile';
function loadProfile(){ try{ return JSON.parse(localStorage.getItem(PROFILE_KEY))||{}; }catch(e){ return {}; } }
function saveProfile(){
  try{ localStorage.setItem(PROFILE_KEY, JSON.stringify({
    xp:Game.xp, level:Game.level, skillPoints:Game.skillPoints, perks:Game.perks,
    achievements:[...(Game.achievements||[])]
  })); }catch(e){}
}
function initRPG(){
  const p=loadProfile();
  Game.xp=p.xp||0; Game.level=p.level||1; Game.skillPoints=p.skillPoints||0;
  Game.perks=p.perks||{}; Game.achievements=new Set(p.achievements||[]);
  Game.maxHP=perkMaxHP(); updateLevelHUD();
}

/* ------------------------- XP & leveling ------------------------- */
function xpNeed(l){ return 80 + l*55; }                 // xp to go from level l → l+1
function addXP(n){
  if(Game.xp==null) initRPG();
  Game.xp += Math.round(n*perkXpMult());
  let leveled=false;
  while(Game.xp>=xpNeed(Game.level)){ Game.xp-=xpNeed(Game.level); Game.level++; Game.skillPoints++; leveled=true; }
  if(leveled){ Game.maxHP=perkMaxHP();
    if(typeof bigToast==='function') bigToast('LEVEL '+Game.level,'+1 Skill Point · press O to spend');
    if(typeof sfx==='function') sfx('kill');
    if(Game.skillsOpen) renderSkills();
    evaluateAchievements();
  }
  saveProfile(); updateLevelHUD();
}
function updateLevelHUD(){
  const lb=$('lvlNum'); if(lb) lb.textContent=Game.level;
  const xb=$('xpFill'); if(xb) xb.style.width=Math.min(100, (Game.xp/xpNeed(Game.level))*100)+'%';
  const sp=$('skillDot'); if(sp) sp.style.display=(Game.skillPoints>0)?'block':'none';
}

/* ------------------------- skill tree panel ------------------------- */
function buyPerk(id){
  const def=PERKS.find(p=>p.id===id); if(!def) return;
  const cur=perkLvl(id);
  if(cur>=def.max){ toast('PERK MAXED'); return; }
  if(Game.skillPoints<=0){ toast('NO SKILL POINTS — LEVEL UP'); return; }
  Game.skillPoints--; Game.perks[id]=cur+1; Game.maxHP=perkMaxHP();
  if(id==='vitality' && Game.playerData){ Game.playerData.hp=Math.min(Game.maxHP,Game.playerData.hp+20); refreshHP&&refreshHP(); }
  saveProfile(); sfx&&sfx('pickup'); toast('PERK: '+def.name+' Lv'+(cur+1));
  updateLevelHUD(); renderSkills(); evaluateAchievements();
}
function openSkills(){ renderSkills(); show('skills'); Game.skillsOpen=true; document.exitPointerLock&&document.exitPointerLock(); }
function closeSkills(){ Game.skillsOpen=false; hide('skills'); if(Game.state==='playing') lockPointer(); }
function toggleSkills(){ Game.skillsOpen?closeSkills():openSkills(); }
function renderSkills(){
  const sp=$('skillPoints'); if(sp) sp.textContent=Game.skillPoints;
  const lv=$('skillLevel'); if(lv) lv.textContent=Game.level;
  const g=$('skillGrid'); if(g){ g.innerHTML='';
    PERKS.forEach(p=>{
      const cur=perkLvl(p.id), maxed=cur>=p.max, can=Game.skillPoints>0&&!maxed;
      const dots=Array.from({length:p.max},(_,i)=>`<span class="pdot${i<cur?' on':''}"></span>`).join('');
      const card=document.createElement('div'); card.className='perkcard'+(maxed?' maxed':'')+(can?'':' locked');
      card.innerHTML=`<div class="ptop"><span class="pico">${p.ico}</span><span class="pname">${p.name}</span></div>`+
        `<div class="pdesc">${p.desc}</div><div class="pdots">${dots}</div>`+
        `<div class="pbuy">${maxed?'MAXED':(can?'BUY ▸ (1 pt)':'Lv '+cur+'/'+p.max)}</div>`;
      if(can) card.onclick=()=>buyPerk(p.id);
      g.appendChild(card);
    });
  }
  renderAchievements();
}

/* ------------------------- achievements ------------------------- */
const ACHIEVEMENTS=[
  { id:'firstkill',  name:'First Down',   desc:'Get your first kill',          test:s=>s.kills>=1 },
  { id:'centurion',  name:'Centurion',    desc:'100 total kills',              test:s=>s.kills>=100 },
  { id:'reaper',     name:'Reaper',       desc:'500 total kills',              test:s=>s.kills>=500 },
  { id:'lvl5',       name:'Seasoned',     desc:'Reach level 5',                test:s=>Game.level>=5 },
  { id:'lvl10',      name:'Veteran',      desc:'Reach level 10',               test:s=>Game.level>=10 },
  { id:'bossslayer', name:'Boss Slayer',  desc:'Defeat 3 bosses',              test:s=>s.bosses>=3 },
  { id:'laststand',  name:'Last Stand',   desc:'Clear 10 waves',               test:s=>s.waves>=10 },
  { id:'highroller', name:'High Roller',  desc:'Earn $10,000 total',           test:s=>s.cashEarned>=10000 },
  { id:'gearhead',   name:'Gearhead',     desc:'Drive a vehicle 5 times',      test:s=>s.drives>=5 },
  { id:'demolisher', name:'Demolisher',   desc:'20 explosive kills',           test:s=>s.nadeKills>=20 },
  { id:'gunnut',     name:'Gun Nut',      desc:'Unlock all 3 secret guns',     test:s=>['railgun','flame','goldengun'].every(id=>typeof isWeaponUnlocked==='function'&&isWeaponUnlocked(id)) },
  { id:'specialist', name:'Specialist',   desc:'Max out any perk',             test:s=>PERKS.some(p=>perkLvl(p.id)>=p.max) },
];
function evaluateAchievements(){
  if(!Game.achievements) initRPG();
  const s=Game.missionStats||{ kills:0,bosses:0,cashEarned:0,waves:0,drives:0,nadeKills:0 };
  let any=false;
  for(const a of ACHIEVEMENTS){
    if(Game.achievements.has(a.id)) continue;
    let hit=false; try{ hit=a.test(s); }catch(e){}
    if(hit){ Game.achievements.add(a.id); achPopup(a); any=true; }
  }
  if(any){ saveProfile(); if(Game.skillsOpen) renderAchievements(); }
}
let _achQ=[], _achBusy=false;
function achPopup(a){ _achQ.push(a); if(!_achBusy) nextAchPopup(); }
function nextAchPopup(){
  const el=$('achPop'); if(!el||_achQ.length===0){ _achBusy=false; return; }
  _achBusy=true; const a=_achQ.shift();
  el.innerHTML=`<div class="al">🏆 ACHIEVEMENT</div><div class="an">${a.name}</div><div class="ad">${a.desc}</div>`;
  el.classList.add('show'); sfx&&sfx('pickup');
  setTimeout(()=>{ el.classList.remove('show'); setTimeout(nextAchPopup,400); },2600);
}
function renderAchievements(){
  const g=$('achGrid'); if(!g) return; g.innerHTML='';
  if(!Game.achievements) initRPG();
  const done=ACHIEVEMENTS.filter(a=>Game.achievements.has(a.id)).length;
  const c=$('achCount'); if(c) c.textContent=done+' / '+ACHIEVEMENTS.length;
  ACHIEVEMENTS.forEach(a=>{
    const got=Game.achievements.has(a.id);
    const card=document.createElement('div'); card.className='achcard'+(got?' got':'');
    card.innerHTML=`<div class="atrophy">${got?'🏆':'🔒'}</div><div class="aname">${a.name}</div><div class="adesc">${a.desc}</div>`;
    g.appendChild(card);
  });
}
