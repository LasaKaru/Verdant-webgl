"use strict";
/* =====================================================================
   VERDANT — keybinds.js   (Phase 4: rebindable controls)
   Action→key bindings with localStorage overrides. Movement reads keys via
   held(action); the keydown dispatcher resolves actions via bind(action).
   A Controls panel lets you click an action and press a new key to rebind.
   ===================================================================== */

const DEFAULT_BINDS={
  forward:'w', back:'s', left:'a', right:'d', sprint:'shift', jump:' ', interact:'e',
  reload:'r', grenade:'g', vehicle:'f', crouch:'c', map:'m', shop:'b', garage:'v',
  contracts:'k', missions:'j', skills:'o', codes:'p', look:'l', inventory:'tab', bullettime:'x'
};
const BIND_LABELS={
  forward:'Move Forward', back:'Move Back', left:'Strafe Left', right:'Strafe Right',
  sprint:'Sprint', jump:'Jump', interact:'Pick Up', reload:'Reload', grenade:'Throw Grenade',
  vehicle:'Enter / Exit Vehicle', crouch:'Crouch', map:'World Map', shop:'Black Market',
  garage:'Garage', contracts:'Contracts', missions:'Missions', skills:'Skill Tree',
  codes:'Secret Codes', look:'Toggle Mouselook', inventory:'Inventory', bullettime:'Bullet Time'
};
let _binds=null;
function loadBinds(){ if(_binds) return _binds; let o={}; try{ o=JSON.parse(localStorage.getItem('verdant_keys'))||{}; }catch(e){}
  _binds=Object.assign({},DEFAULT_BINDS,o); return _binds; }
function saveBinds(){ try{ localStorage.setItem('verdant_keys', JSON.stringify(_binds)); }catch(e){} }
function bind(action){ return loadBinds()[action]; }
function held(action){ const k=bind(action); return !!(k && Game.keys[k]); }
function actionForKey(key){ const b=loadBinds(); for(const a in b){ if(b[a]===key) return a; } return null; }
function setBind(action,key){
  loadBinds();
  for(const a in _binds){ if(_binds[a]===key && a!==action) _binds[a]=''; }   // no duplicate keys
  _binds[action]=key; saveBinds();
}
function resetBinds(){ _binds=Object.assign({},DEFAULT_BINDS); saveBinds(); renderKeybinds(); toast('CONTROLS RESET'); }
function keyLabel(k){
  if(k===' ') return 'SPACE'; if(k==='') return '—';
  const map={tab:'TAB',shift:'SHIFT',control:'CTRL',escape:'ESC',enter:'ENTER',
    arrowup:'↑',arrowdown:'↓',arrowleft:'←',arrowright:'→'};
  return map[k] || k.toUpperCase();
}

/* ------------------------- panel ------------------------- */
function initKeybinds(){
  // capture-phase listener intercepts the next key while rebinding (before game input)
  window.addEventListener('keydown',e=>{
    if(!Game.rebinding) return;
    e.preventDefault(); e.stopPropagation();
    const k=e.key.toLowerCase();
    if(k!=='escape') setBind(Game.rebinding,k);
    Game.rebinding=null; renderKeybinds();
  }, true);
}
function openKeybinds(){ renderKeybinds(); show('keybinds'); Game.keybindsOpen=true; document.exitPointerLock&&document.exitPointerLock(); }
function closeKeybinds(){ Game.keybindsOpen=false; Game.rebinding=null; hide('keybinds'); if(Game.state==='playing') lockPointer(); }
function renderKeybinds(){
  const g=$('keybindGrid'); if(!g) return; g.innerHTML='';
  for(const action in DEFAULT_BINDS){
    const row=document.createElement('div'); row.className='kbrow';
    const rebinding=(Game.rebinding===action);
    row.innerHTML=`<span class="kblabel">${BIND_LABELS[action]||action}</span>`+
      `<button class="kbkey${rebinding?' wait':''}">${rebinding?'press a key…':keyLabel(bind(action))}</button>`;
    row.querySelector('.kbkey').onclick=()=>{ Game.rebinding=action; renderKeybinds(); };
    g.appendChild(row);
  }
}
