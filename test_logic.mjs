import vm from 'vm';
import fs from 'fs';

let pass = 0, fail = 0;
const ok = (c, m) => { if (c) { pass++; console.log('  ✓', m); } else { fail++; console.log('  ✗ FAIL:', m); } };

// ---- in-memory localStorage ----
const store = {};
const localStorage = {
  getItem: k => (k in store ? store[k] : null),
  setItem: (k, v) => { store[k] = String(v); },
  removeItem: k => { delete store[k]; },
};
// ---- stub DOM ($ returns a reusable fake element) ----
const fakeEl = () => ({ textContent:'', innerHTML:'', value:'', style:{}, classList:{add(){},remove(){},contains(){return false;},toggle(){}},
  appendChild(){}, removeChild(){}, addEventListener(){}, focus(){}, blur(){}, firstChild:{style:{}}, children:[], querySelector(){return {textContent:'',style:{}};} });

// ---- sandbox globals ----
const sandbox = {
  console, Math, JSON, Date, localStorage, setTimeout:()=>{}, performance:{now:()=>0},
  $: fakeEl, show:()=>{}, hide:()=>{}, lockPointer:()=>{},
  toast:()=>{}, bigToast:()=>{}, sfx:()=>{},
  updateQuickSlots:()=>{}, renderInventory:()=>{}, updateGrenadeHUD:()=>{},
  refreshHP:()=>{}, refreshArmor:()=>{}, updateSky:()=>{}, updateMoneyHUD:()=>{},
};
sandbox.window = sandbox;
const ctx = vm.createContext(sandbox);

// minimal Game (instead of running core.js, which uses `const Game`)
vm.runInContext(`
  var Game = {
    state:'playing', weapons:null, cheats:{god:false,infAmmo:false},
    grenadeCount:3, money:100, score:0, time:0.3,
    playerData:{hp:50,armor:0}, missions:null, missionStats:null, missionsOpen:false,
  };
  function addMoney(n){ Game.money+=n; if(n>0 && typeof trackMission==='function') trackMission('cashEarned',n); }
`, ctx);

// load the real modules (function declarations attach to the shared global)
for (const f of ['js/weapons.js','js/progression.js','js/missions.js','js/codes.js']) {
  vm.runInContext(fs.readFileSync(f,'utf8'), ctx, { filename:f });
}

console.log('\n=== TEST: unlocks / missions / codes ===\n');

// init weapons + missions
vm.runInContext(`Game.weapons = defaultWeapons(); initMissions();`, ctx);

// weapon counts & secret guns present
ok(vm.runInContext('Game.weapons.length', ctx) === 9, 'defaultWeapons has 9 entries (6 base + 3 secret)');
ok(vm.runInContext("Game.weapons.some(w=>w.id==='goldengun'&&w.golden)", ctx), 'golden gun present with golden flag');

// --- unlocks persist + apply ---
vm.runInContext("unlockWeapon('railgun', true);", ctx);
ok(vm.runInContext("loadUnlocks().includes('railgun')", ctx), 'unlockWeapon persists railgun to storage');
vm.runInContext("Game.weapons = defaultWeapons(); applyUnlocks();", ctx);
ok(vm.runInContext("Game.weapons.find(w=>w.id==='railgun').owned===true", ctx), 'applyUnlocks re-owns railgun in a fresh loadout');
ok(vm.runInContext("Game.weapons.find(w=>w.id==='flame').owned===false", ctx), 'non-unlocked flame stays locked');

// --- secret code unlocks a weapon ---
vm.runInContext("$ = (id)=>({ '_id':id, value:'GOLDENGUN', textContent:'', innerHTML:'', style:{} });", ctx);
vm.runInContext("submitCode();", ctx);
ok(vm.runInContext("loadUnlocks().includes('goldengun')", ctx), 'code GOLDENGUN unlocks golden gun');

// --- cheat codes toggle session flags ---
vm.runInContext("$ = (id)=>({ value:'GODMODE', textContent:'', innerHTML:'', style:{} });", ctx);
vm.runInContext("submitCode();", ctx);
ok(vm.runInContext("Game.cheats.god===true", ctx), 'code GODMODE enables god mode');
vm.runInContext("$ = (id)=>({ value:'RICHKID', textContent:'', innerHTML:'', style:{} });", ctx);
vm.runInContext("Game.missions.add('tycoon');", ctx);   // isolate: don't let the cash-earned mission also pay out
const moneyBefore = vm.runInContext("Game.money", ctx);
vm.runInContext("submitCode();", ctx);
ok(vm.runInContext("Game.money", ctx) === moneyBefore + 10000, 'code RICHKID grants +$10,000');

// --- missions track + complete + reward + unlock ---
vm.runInContext("Game.money=0; Game.score=0;", ctx);
vm.runInContext("for(let i=0;i<10;i++) trackMission('kills',1);", ctx); // First Blood = 10 kills
ok(vm.runInContext("Game.missions.has('firstblood')", ctx), 'mission First Blood completes at 10 kills');
ok(vm.runInContext("Game.money===400", ctx), 'First Blood pays $400 reward');

// mission that unlocks a weapon (Big Game Hunter: 1 boss -> unlock rifle)
vm.runInContext("trackMission('bosses',1);", ctx);
ok(vm.runInContext("Game.missions.has('biggame') && loadUnlocks().includes('rifle')", ctx), 'Big Game Hunter unlocks rifle');

// mission progress persists across a reload (new Game, initMissions reads storage)
vm.runInContext("Game.missions=null; Game.missionStats=null; initMissions();", ctx);
ok(vm.runInContext("Game.missions.has('firstblood') && Game.missionStats.kills>=10", ctx), 'mission progress persists across runs');

console.log(`\n=== RESULT: ${pass} passed, ${fail} failed ===\n`);
process.exit(fail ? 1 : 0);
