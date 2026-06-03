import vm from 'vm';
import fs from 'fs';

let pass=0, fail=0;
const ok=(c,m)=>{ if(c){pass++;console.log('  ✓',m);} else {fail++;console.log('  ✗ FAIL:',m);} };
const store={};
const localStorage={ getItem:k=>(k in store?store[k]:null), setItem:(k,v)=>{store[k]=String(v);}, removeItem:k=>{delete store[k];} };
const el=()=>({textContent:'',innerHTML:'',value:'',style:{},onclick:null,onchange:null,classList:{add(){},remove(){},toggle(){},contains(){return false;}},appendChild(){},querySelector(){return el();}});
const sandbox={ console,Math,JSON,localStorage, $:el, show:()=>{},hide:()=>{},lockPointer:()=>{},toast:()=>{},sfx:()=>{},refreshAmmoHUD:()=>{},
  document:{createElement:el,getElementById:el} };
const ctx=vm.createContext(sandbox);
vm.runInContext(`var Game={ weapons:null, attachments:null };
  function defaultWeapons(){ return [
    {id:'rifle', dmg:22, spread:0.032, maxMag:30, ammo:30, reserve:120, reloadMs:1300, range:150},
    {id:'sniper',dmg:150,spread:0.002, maxMag:5,  ammo:5,  reserve:20,  reloadMs:1700, range:320, zoom:true} ]; }`, ctx);
vm.runInContext(fs.readFileSync('js/gunsmith.js','utf8'), ctx, {filename:'js/gunsmith.js'});

console.log('\n=== TEST: gunsmithing attachments ===\n');

vm.runInContext('Game.weapons=defaultWeapons();', ctx);
// no attachments -> stats unchanged (base captured)
vm.runInContext('applyAllAttachments();', ctx);
ok(vm.runInContext("Game.weapons.find(w=>w.id==='rifle').maxMag", ctx)===30, 'no attachments: rifle mag stays 30');

// extended mag -> 1.5x
vm.runInContext("equipAttachment('rifle','mag','ext');", ctx);
ok(vm.runInContext("Game.weapons.find(w=>w.id==='rifle').maxMag", ctx)===45, 'Extended Mag: 30 -> 45');

// suppressor -> dmg*0.9, spread*0.85, silent
vm.runInContext("equipAttachment('rifle','barrel','supp');", ctx);
const r=()=>vm.runInContext("(()=>{const w=Game.weapons.find(w=>w.id==='rifle'); return {dmg:w.dmg,spread:w.spread,silent:w.silent};})()", ctx);
let st=r();
ok(Math.abs(st.dmg-19.8)<0.05, 'Suppressor: rifle dmg 22 -> 19.8 (×0.9)');
ok(st.silent===true, 'Suppressor sets the silent flag');

// long barrel range 1.4x stacks with suppressor accuracy
vm.runInContext("equipAttachment('rifle','optic','holo');", ctx);  // spread *0.7
ok(vm.runInContext("Math.abs(Game.weapons.find(w=>w.id==='rifle').spread - 0.032*0.85*0.7) < 1e-6", ctx), 'optic + barrel spread multipliers stack');

// persistence
ok(!!JSON.parse(store['verdant_attach']).rifle.mag, 'loadout persisted to localStorage');
ok(JSON.parse(store['verdant_attach']).rifle.barrel==='supp', 'persisted barrel = suppressor');

// fresh weapons + reload from storage re-applies the loadout
vm.runInContext('Game.weapons=defaultWeapons(); Game.attachments=null; applyAllAttachments();', ctx);
ok(vm.runInContext("Game.weapons.find(w=>w.id==='rifle').maxMag", ctx)===45, 'loadout re-applies to freshly built weapons');

// 4x scope grants zoom to a non-zoom gun
vm.runInContext("equipAttachment('rifle','optic','scope4x');", ctx);
ok(vm.runInContext("Game.weapons.find(w=>w.id==='rifle').zoom===true", ctx), '4× Scope grants zoom to the rifle');

// removing an attachment (set to none) reverts that effect
vm.runInContext("equipAttachment('rifle','mag','none');", ctx);
ok(vm.runInContext("Game.weapons.find(w=>w.id==='rifle').maxMag", ctx)===30, 'setting mag back to none reverts to base 30');

// gunEffective preview matches without needing live weapons
vm.runInContext("Game.weapons=null;", ctx);
ok(vm.runInContext("gunEffective('sniper').dmg", ctx)===150, 'gunEffective works for a weapon with no attachments (sniper 150)');

console.log(`\n=== RESULT: ${pass} passed, ${fail} failed ===\n`);
process.exit(fail?1:0);
