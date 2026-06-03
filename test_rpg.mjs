import vm from 'vm';
import fs from 'fs';

let pass=0, fail=0;
const ok=(c,m)=>{ if(c){pass++;console.log('  ✓',m);} else {fail++;console.log('  ✗ FAIL:',m);} };
const store={};
const localStorage={ getItem:k=>(k in store?store[k]:null), setItem:(k,v)=>{store[k]=String(v);}, removeItem:k=>{delete store[k];} };

const el=()=>({textContent:'',innerHTML:'',value:'',style:{},onclick:null,classList:{add(){},remove(){},toggle(){},contains(){return false;}},appendChild(){},firstChild:{style:{}},querySelector(){return{textContent:'',style:{}};}});
const sandbox={ console,Math,JSON,Date,localStorage,setTimeout:()=>{},performance:{now:()=>0},
  document:{ createElement:el, getElementById:el },
  $:el, show:()=>{},hide:()=>{},lockPointer:()=>{},toast:()=>{},bigToast:()=>{},sfx:()=>{},refreshHP:()=>{} };
sandbox.window=sandbox;
const ctx=vm.createContext(sandbox);
vm.runInContext(`var Game={ state:'playing', playerData:{hp:50,armor:0}, missionStats:{kills:0,bosses:0,cashEarned:0,waves:0,drives:0,nadeKills:0},
  perks:{}, xp:null, level:1, skillPoints:0, achievements:null, skillsOpen:false, maxHP:100, weapons:[] };`, ctx);
for(const f of ['js/progression.js','js/rpg.js']) vm.runInContext(fs.readFileSync(f,'utf8'),ctx,{filename:f});

console.log('\n=== TEST: XP / perks / achievements / profile ===\n');

vm.runInContext('initRPG();', ctx);
ok(vm.runInContext('Game.level===1 && Game.skillPoints===0 && Game.xp===0', ctx), 'fresh profile starts at level 1');

// level up
vm.runInContext('addXP(xpNeed(1));', ctx);
ok(vm.runInContext('Game.level===2 && Game.skillPoints===1', ctx), 'gaining xpNeed(1) levels to 2 and grants a skill point');

// base perk getters
ok(vm.runInContext('perkMaxHP()===100', ctx), 'base max HP is 100');
ok(vm.runInContext('Math.abs(perkDamageMult()-1)<1e-9', ctx), 'base damage mult is 1.0');

// buy vitality
vm.runInContext('buyPerk("vitality");', ctx);
ok(vm.runInContext('perkLvl("vitality")===1 && Game.skillPoints===0', ctx), 'buying vitality spends the point');
ok(vm.runInContext('perkMaxHP()===120', ctx), 'vitality L1 -> max HP 120');
ok(vm.runInContext('Game.playerData.hp===70', ctx), 'buying vitality also tops up current HP (+20)');

// buy a second perk after more levels
vm.runInContext('addXP(xpNeed(2)+xpNeed(3));', ctx); // +2 levels -> +2 points
vm.runInContext('buyPerk("gunslinger");', ctx);
ok(vm.runInContext('Math.abs(perkDamageMult()-1.08)<1e-9', ctx), 'gunslinger L1 -> +8% damage');
ok(vm.runInContext('Math.abs(perkReloadMult()-1)<1e-9', ctx), 'reload mult still 1 (quickhands not bought)');

// achievements driven by stats + level
vm.runInContext('Game.missionStats.kills=1; evaluateAchievements();', ctx);
ok(vm.runInContext('Game.achievements.has("firstkill")', ctx), 'first kill unlocks "First Down" achievement');
ok(vm.runInContext('Game.achievements.has("lvl5")===false', ctx), 'level-5 achievement not yet earned');
vm.runInContext('Game.level=5; evaluateAchievements();', ctx);
ok(vm.runInContext('Game.achievements.has("lvl5")', ctx), 'reaching level 5 unlocks "Seasoned"');

// persistence: wipe live state, reload from storage
const lvl=vm.runInContext('Game.level', ctx);
vm.runInContext('Game.xp=null; Game.perks={}; Game.achievements=null; initRPG();', ctx);
ok(vm.runInContext(`perkLvl("vitality")===1 && perkLvl("gunslinger")===1`, ctx), 'perks persist across reload');
ok(vm.runInContext(`Game.level===${lvl} && Game.achievements.has("firstkill")`, ctx), 'level + achievements persist across reload');

console.log(`\n=== RESULT: ${pass} passed, ${fail} failed ===\n`);
process.exit(fail?1:0);
