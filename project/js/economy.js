"use strict";
/* =====================================================================
   VERDANT — economy.js
   Cash economy + an in-game shop. Earn money from kills and pickups;
   spend it on weapons, ammo, heals, armor and grenades. Open with B
   (safe any time — pauses the action).
   ===================================================================== */

function addMoney(n,worldPos){
  Game.money+=n; updateMoneyHUD();
  if(worldPos && n>0 && typeof showDamage==='function'){
    // reuse floater styling for a cash popup
    const s=projectToScreen(worldPos); if(!s.behind){
      const d=document.createElement('div'); d.className='cashpop'; d.textContent='+$'+n;
      d.style.left=s.x+'px'; d.style.top=s.y+'px'; $('floaters').appendChild(d);
      requestAnimationFrame(()=>{ d.style.transform='translate(-50%,-220%)'; d.style.opacity='0'; });
      setTimeout(()=>d.remove(),800);
    }
  }
}
function updateMoneyHUD(){ const el=$('moneyLbl'); if(el) el.textContent='$'+Game.money.toLocaleString(); }

const SHOP_ITEMS=[
  { id:'ammo',    name:'Ammo Box',     ico:'📦', price:120, desc:'+60 reserve (current gun)' },
  { id:'medkit',  name:'Medkit',       ico:'➕', price:180, desc:'Restore 40 HP' },
  { id:'armor',   name:'Body Armor',   ico:'🛡️', price:260, desc:'+50 armor plate' },
  { id:'grenade', name:'Grenade x2',   ico:'✛', price:200, desc:'Two frag grenades' },
  { id:'rifle',   name:'Assault Rifle',ico:'🪖', price:650, desc:'Full-auto · 30 rnd' },
  { id:'shotgun', name:'Shotgun',      ico:'💥', price:550, desc:'8-pellet spread' },
  { id:'sniper',  name:'Sniper Rifle', ico:'🎯', price:900, desc:'150 dmg · scoped' },
  { id:'bribe',   name:'Lose the Heat',ico:'🚔', price:400, desc:'Clear your wanted level' },
];

function openShop(){
  if(Game.state!=='playing') return;
  Game.shopOpen=true; renderShop();
  show('shop'); document.exitPointerLock&&document.exitPointerLock();
}
function closeShop(){ Game.shopOpen=false; hide('shop'); if(Game.state==='playing') lockPointer(); }
function toggleShop(){ Game.shopOpen?closeShop():openShop(); }

function renderShop(){
  updateMoneyHUD();
  $('shopMoney').textContent='$'+Game.money.toLocaleString();
  const g=$('shopGrid'); g.innerHTML='';
  SHOP_ITEMS.forEach(it=>{
    const owned = ['rifle','shotgun','sniper'].includes(it.id) && Game.weapons.find(w=>w.id===it.id)?.owned;
    const can = Game.money>=it.price && !owned;
    const card=document.createElement('div'); card.className='shopcard'+(can?'':' disabled');
    card.innerHTML=`<div class="si">${it.ico}</div><div class="sn">${it.name}</div>`+
      `<div class="sd">${owned?'OWNED':it.desc}</div>`+
      `<div class="sp">${owned?'—':'$'+it.price}</div>`;
    if(can) card.onclick=()=>buyItem(it);
    g.appendChild(card);
  });
}
function buyItem(it){
  if(Game.money<it.price) { toast('NOT ENOUGH CASH'); return; }
  if(it.id==='bribe'){ if(Game.wanted<=0){ toast('NO HEAT TO LOSE'); return; } }
  Game.money-=it.price; updateMoneyHUD(); sfx('pickup');
  switch(it.id){
    case 'ammo': currentW().reserve+=60; refreshAmmoHUD(); break;
    case 'medkit': Game.playerData.hp=Math.min(100,Game.playerData.hp+40); refreshHP(); break;
    case 'armor': Game.playerData.armor=Math.min(100,Game.playerData.armor+50); refreshArmor(); break;
    case 'grenade': Game.grenadeCount+=2; updateGrenadeHUD(); break;
    case 'rifle': case 'shotgun': case 'sniper': ownWeapon(it.id); break;
    case 'bribe': clearWanted(); break;
  }
  toast('PURCHASED '+it.name.toUpperCase());
  renderShop();
}
