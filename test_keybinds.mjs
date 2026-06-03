import vm from 'vm';
import fs from 'fs';

let pass=0, fail=0;
const ok=(c,m)=>{ if(c){pass++;console.log('  ✓',m);} else {fail++;console.log('  ✗ FAIL:',m);} };
const store={};
const localStorage={ getItem:k=>(k in store?store[k]:null), setItem:(k,v)=>{store[k]=String(v);}, removeItem:k=>{delete store[k];} };
const el=()=>({textContent:'',innerHTML:'',value:'',style:{},onclick:null,classList:{add(){},remove(){},toggle(){},contains(){return false;}},appendChild(){},querySelector(){return el();}});
const sandbox={ console,Math,JSON,localStorage, $:el, show:()=>{},hide:()=>{},lockPointer:()=>{},toast:()=>{},
  document:{createElement:el,getElementById:el}, window:{addEventListener:()=>{}} };
const ctx=vm.createContext(sandbox);
vm.runInContext(`var Game={ keys:{}, rebinding:null, state:'playing' };`, ctx);
vm.runInContext(fs.readFileSync('js/keybinds.js','utf8'), ctx, {filename:'js/keybinds.js'});

console.log('\n=== TEST: keybind remapping ===\n');

ok(vm.runInContext("bind('reload')==='r'", ctx), 'default reload binding is R');
ok(vm.runInContext("bind('forward')==='w'", ctx), 'default forward binding is W');

// held() reflects Game.keys against the binding
vm.runInContext("Game.keys={'w':true};", ctx);
ok(vm.runInContext("held('forward')===true", ctx), 'held(forward) true when W is down');
ok(vm.runInContext("held('back')===false", ctx), 'held(back) false when S is up');

// reverse lookup
ok(vm.runInContext("actionForKey('g')==='grenade'", ctx), "actionForKey('g') resolves to grenade");
ok(vm.runInContext("actionForKey('z')===null", ctx), 'unbound key resolves to null');

// rebind reload R -> H, persists, old key frees up
vm.runInContext("setBind('reload','h');", ctx);
ok(vm.runInContext("bind('reload')==='h'", ctx), 'reload rebound to H');
ok(vm.runInContext("actionForKey('h')==='reload'", ctx), 'reverse lookup follows the rebind');
ok(vm.runInContext("actionForKey('r')===null", ctx), 'old R key is now unbound');
ok(JSON.parse(store['verdant_keys']).reload==='h', 'rebind persisted to localStorage');

// rebinding to a key already used by another action steals it (no duplicates)
vm.runInContext("setBind('grenade','f');", ctx);   // f was 'vehicle'
ok(vm.runInContext("bind('grenade')==='f'", ctx), 'grenade rebound to F');
ok(vm.runInContext("bind('vehicle')===''", ctx), 'vehicle binding cleared to avoid a duplicate key');

// persistence across reload of the module
vm.runInContext("_binds=null;", ctx);  // force reload from storage
ok(vm.runInContext("bind('reload')==='h'", ctx), 'bindings reload from storage (reload=H)');

// reset to defaults
vm.runInContext("resetBinds();", ctx);
ok(vm.runInContext("bind('reload')==='r' && bind('vehicle')==='f' && bind('grenade')==='g'", ctx), 'resetBinds restores all defaults');

console.log(`\n=== RESULT: ${pass} passed, ${fail} failed ===\n`);
process.exit(fail?1:0);
