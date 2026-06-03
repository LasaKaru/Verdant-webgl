"use strict";
/* =====================================================================
   VERDANT — codes.js
   GTA-style secret cheat codes. Open the console with P (or the menu),
   type a code, hit enter. Weapon unlocks persist; combat cheats last for
   the session. Some are hinted; others are for you to discover.
   ===================================================================== */

const CODES={
  // ---- weapon unlocks (persist) ----
  'GOLDENGUN': { msg:'Golden Gun unlocked — one shot, one kill.', fn:()=>unlockWeapon('goldengun') },
  'RAILGUN':   { msg:'Railgun unlocked — piercing rounds.',       fn:()=>unlockWeapon('railgun') },
  'BURNBABY':  { msg:'Flamethrower unlocked — light it up.',      fn:()=>unlockWeapon('flame') },
  'ARSENAL':   { msg:'Every weapon unlocked.',                    fn:()=>{ ['rifle','shotgun','sniper','minigun','rocket','railgun','flame','goldengun'].forEach(id=>unlockWeapon(id,true)); applyUnlocks(); } },
  // ---- session cheats ----
  'GODMODE':   { msg:()=> (Game.cheats.god=!Game.cheats.god) ? 'God mode ON — invincible.' : 'God mode OFF.', fn:()=>{} },
  'RAMBO':     { msg:()=> (Game.cheats.infAmmo=!Game.cheats.infAmmo) ? 'Infinite ammo ON.' : 'Infinite ammo OFF.', fn:()=>{} },
  'RICHKID':   { msg:'+$10,000.', fn:()=>{ if(typeof addMoney==='function'){ addMoney(10000); } } },
  'FULLNADE':  { msg:'+50 grenades.', fn:()=>{ Game.grenadeCount+=50; if(typeof updateGrenadeHUD==='function') updateGrenadeHUD(); } },
  'PATCHUP':   { msg:'Health & armor restored.', fn:()=>{ if(Game.playerData){ Game.playerData.hp=Game.maxHP||100; Game.playerData.armor=100; refreshHP&&refreshHP(); refreshArmor&&refreshArmor(); } } },
  'SUNNYDAY':  { msg:'High noon.', fn:()=>{ Game.time=0.5; updateSky&&updateSky(); } },
  'MIDNIGHT':  { msg:'Nightfall.', fn:()=>{ Game.time=0.0; updateSky&&updateSky(); } },
};
const CODE_HINTS=['GOLDENGUN','RAILGUN','BURNBABY','GODMODE','RAMBO','RICHKID','…and more to discover'];

function initCodes(){
  const inp=$('codeInput');
  if(inp){ inp.addEventListener('keydown',e=>{ e.stopPropagation();
    if(e.key.toLowerCase()==='enter'){ e.preventDefault(); submitCode(); }
    else if(e.key.toLowerCase()==='escape'){ e.preventDefault(); closeCodes(); } }); }
  const hint=$('codeHints'); if(hint) hint.textContent='Try: '+CODE_HINTS.join(' · ');
}
function openCodes(){
  if($('codes').classList.contains('show')){ closeCodes(); return; }
  Game.codesOpen=true; renderCodeStatus(); show('codes');
  document.exitPointerLock&&document.exitPointerLock();
  const inp=$('codeInput'); if(inp){ inp.value=''; setTimeout(()=>inp.focus(),0); }
}
function closeCodes(){ Game.codesOpen=false; hide('codes'); const inp=$('codeInput'); if(inp) inp.blur();
  if(Game.state==='playing') lockPointer(); }
function submitCode(){
  const inp=$('codeInput'); if(!inp) return;
  const raw=inp.value.trim().toUpperCase().replace(/\s+/g,'');
  inp.value='';
  if(!raw) return;
  const c=CODES[raw];
  const out=$('codeResult');
  if(!c){ if(out){ out.textContent='✗ Unknown code: '+raw; out.style.color='var(--coral)'; } sfx&&sfx('click'); return; }
  c.fn();
  const msg = typeof c.msg==='function' ? c.msg() : c.msg;
  if(out){ out.textContent='✓ '+msg; out.style.color='var(--lime-d)'; }
  sfx&&sfx('pickup');
  renderCodeStatus();
}
function renderCodeStatus(){
  const el=$('codeStatus'); if(!el) return;
  const on=[]; if(Game.cheats.god) on.push('GOD'); if(Game.cheats.infAmmo) on.push('INF AMMO');
  const unlocked=(typeof loadUnlocks==='function')?loadUnlocks():[];
  el.innerHTML = (on.length?('<b>Active:</b> '+on.join(', ')+'<br>'):'')+
    (unlocked.length?('<b>Unlocked:</b> '+unlocked.map(s=>s.toUpperCase()).join(', ')):'<span style="opacity:.6">No weapons unlocked yet.</span>');
}
