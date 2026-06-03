import vm from 'vm';
import fs from 'fs';

let pass=0, fail=0;
const ok=(c,m)=>{ if(c){pass++;console.log('  ✓',m);} else {fail++;console.log('  ✗ FAIL:',m);} };
const el=()=>({style:{},classList:{toggle(){},add(){},remove(){}}});
const sandbox={ console,Math, $:el, sfx:()=>{}, toast:()=>{}, document:{body:{classList:{toggle(){},remove(){}}}, getElementById:el} };
const ctx=vm.createContext(sandbox);
vm.runInContext(`var Game={ bulletTime:{active:false,meter:1} };`, ctx);
// extract just the bullet-time block from game.js (between its two markers)
const src=fs.readFileSync('js/game.js','utf8');
const block=src.slice(src.indexOf('const BT_DRAIN'), src.indexOf('/* ------------------------- photo mode'));
vm.runInContext(block, ctx);

console.log('\n=== TEST: bullet time ===\n');

ok(vm.runInContext('updateBulletTime(0.1)===1', ctx), 'inactive -> timescale 1.0');
ok(vm.runInContext('Game.bulletTime.meter<=1', ctx), 'meter caps at 1 when regenerating');

// drain a bit then activate
vm.runInContext('Game.bulletTime.meter=1; activateBulletTime();', ctx);
ok(vm.runInContext('Game.bulletTime.active===true', ctx), 'activates when meter is full');
ok(vm.runInContext('updateBulletTime(0.1) < 1', ctx), 'active -> slow-mo timescale (<1)');
ok(vm.runInContext('Game.bulletTime.meter < 1', ctx), 'meter drains while active');

// drain to empty -> auto deactivate (step until it flips off; ~3s at 1/3 per s)
vm.runInContext('Game.bulletTime.meter=1; Game.bulletTime.active=true; var steps=0; while(Game.bulletTime.active && steps<100){ updateBulletTime(0.1); steps++; } Game._btSteps=steps;', ctx);
ok(vm.runInContext('Game.bulletTime.active===false', ctx), 'auto-deactivates once the meter empties');
ok(vm.runInContext('Game._btSteps>=28 && Game._btSteps<=33', ctx), 'lasts ~3s of use before emptying');

// cannot activate on a (near-)empty meter (below the 0.2 threshold)
vm.runInContext('Game.bulletTime.meter=0.1; Game.bulletTime.active=false; activateBulletTime();', ctx);
ok(vm.runInContext('Game.bulletTime.active===false', ctx), 'cannot activate below the 0.2 threshold');

// regen over time, then it can be used again
vm.runInContext('for(let i=0;i<60;i++) updateBulletTime(0.1);', ctx);
ok(vm.runInContext('Game.bulletTime.meter>0.2', ctx), 'meter regenerates over time');
vm.runInContext('activateBulletTime();', ctx);
ok(vm.runInContext('Game.bulletTime.active===true', ctx), 'usable again after regen');
// toggle off manually
vm.runInContext('activateBulletTime();', ctx);
ok(vm.runInContext('Game.bulletTime.active===false', ctx), 'pressing again toggles it off');

console.log(`\n=== RESULT: ${pass} passed, ${fail} failed ===\n`);
process.exit(fail?1:0);
