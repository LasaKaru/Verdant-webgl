import vm from 'vm';
import fs from 'fs';

let pass=0, fail=0;
const ok=(c,m)=>{ if(c){pass++;console.log('  ✓',m);} else {fail++;console.log('  ✗ FAIL:',m);} };
const store={};
const localStorage={ getItem:k=>(k in store?store[k]:null), setItem:(k,v)=>{store[k]=String(v);}, removeItem:k=>{delete store[k];} };
const el=()=>({textContent:'',innerHTML:'',value:'',style:{},onclick:null,classList:{add(){},remove(){},toggle(){},contains(){return false;}},appendChild(){},firstChild:{style:{}},querySelector(){return el();}});
const sandbox={ console,Math,JSON,Date,localStorage,setTimeout:()=>{},performance:{now:()=>0},
  document:{createElement:el,getElementById:el}, $:el, show:()=>{},hide:()=>{},lockPointer:()=>{},toast:()=>{} };
sandbox.window=sandbox;
const ctx=vm.createContext(sandbox);
vm.runInContext(`var Game={ state:'menu', weapons:null };`, ctx);
// stub re-init hooks so loadSlot() doesn't throw
vm.runInContext(`function initRPG(){} function initMissions(){} function applyUnlocks(){} function updateLevelHUD(){} function renderMenuStats(){}`, ctx);
vm.runInContext(fs.readFileSync('js/saves.js','utf8'), ctx, {filename:'js/saves.js'});

console.log('\n=== TEST: save slots ===\n');

// seed "current progress"
const setProfile=(level,ach)=>vm.runInContext(`localStorage.setItem('verdant_profile', JSON.stringify({level:${level}, achievements:${JSON.stringify(ach)} })); localStorage.setItem('verdant_unlocks', JSON.stringify(${JSON.stringify(ach)}));`, ctx);

setProfile(7, ['firstkill','lvl5']);
vm.runInContext('saveSlot(0,"Main");', ctx);
ok(vm.runInContext('!!slotMeta(0)', ctx), 'slot 0 has a save after saveSlot');
ok(vm.runInContext('slotMeta(0).level', ctx)===7, 'slot 0 meta shows level 7');
ok(vm.runInContext('slotMeta(0).ach', ctx)===2, 'slot 0 meta shows 2 achievements');

// change current progress, save to a different slot
setProfile(15, ['firstkill','lvl5','lvl10','reaper']);
vm.runInContext('saveSlot(1,"Alt");', ctx);
ok(vm.runInContext('slotMeta(1).level', ctx)===15, 'slot 1 captured the newer level 15');
ok(vm.runInContext('slotMeta(0).level', ctx)===7, 'slot 0 is unchanged (slot isolation)');

// current is level 15; load slot 0 -> current restored to level 7
vm.runInContext('loadSlot(0);', ctx);
ok(JSON.parse(vm.runInContext('localStorage.getItem("verdant_profile")', ctx)).level===7, 'loading slot 0 restores level 7 to current progress');

// load slot 1 -> level 15 back
vm.runInContext('loadSlot(1);', ctx);
ok(JSON.parse(vm.runInContext('localStorage.getItem("verdant_profile")', ctx)).level===15, 'loading slot 1 restores level 15');

// empty slot
ok(vm.runInContext('slotMeta(2)===null', ctx), 'unused slot 2 reports empty');
ok(vm.runInContext('loadSlot(2)===false', ctx), 'loading an empty slot is a no-op (returns false)');

// delete
vm.runInContext('deleteSlot(0);', ctx);
ok(vm.runInContext('slotMeta(0)===null', ctx), 'deleteSlot clears the slot');
ok(vm.runInContext('!!slotMeta(1)', ctx), 'deleting slot 0 leaves slot 1 intact');

console.log(`\n=== RESULT: ${pass} passed, ${fail} failed ===\n`);
process.exit(fail?1:0);
