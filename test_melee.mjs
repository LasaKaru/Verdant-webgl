import vm from 'vm';
import fs from 'fs';

let pass=0, fail=0;
const ok=(c,m)=>{ if(c){pass++;console.log('  ✓',m);} else {fail++;console.log('  ✗ FAIL:',m);} };
const sandbox={ console, Math };
const ctx=vm.createContext(sandbox);
vm.runInContext(`var Game={}; var BABYLON={Vector3:function(){}}; function spawnTracer(){} function impactSpark(){} function sfx(){} function toast(){}`, ctx);
// load only the pure helper (frontMeleeTarget) + constants
const src=fs.readFileSync('js/melee.js','utf8');
const block=src.slice(src.indexOf('const MELEE_REACH'), src.indexOf('function meleeSwipeFX'));
vm.runInContext(block, ctx);

console.log('\n=== TEST: melee target selection ===\n');

const e=(x,z,extra={})=>({ body:{position:{x,z}}, dead:false, ...extra });
// player at origin facing +Z (yaw 0 -> forward = (sin0,cos0)=(0,1))
const yaw=0;

// enemy directly in front, in reach
ok(vm.runInContext(`frontMeleeTarget([${JSON.stringify(e(0,2))}],0,0,0)!==null`, ctx), 'enemy 2m directly in front is hit');

// enemy behind -> ignored
ok(vm.runInContext(`frontMeleeTarget([${JSON.stringify(e(0,-2))}],0,0,0)===null`, ctx), 'enemy behind is NOT hit');

// enemy out of reach -> ignored
ok(vm.runInContext(`frontMeleeTarget([${JSON.stringify(e(0,5))}],0,0,0)===null`, ctx), 'enemy 5m away (beyond reach) is NOT hit');

// nearest of several in front is chosen
const many=`[${JSON.stringify(e(0,2.5))},${JSON.stringify(e(0,1.2))},${JSON.stringify(e(0.5,2))}]`;
ok(vm.runInContext(`(()=>{const t=frontMeleeTarget(${many},0,0,0); return t.body.position.z===1.2;})()`, ctx), 'closest enemy in the cone is selected');

// to the side (outside cone) -> ignored
ok(vm.runInContext(`frontMeleeTarget([${JSON.stringify(e(2,0.1))}],0,0,0)===null`, ctx), 'enemy ~90° to the side is outside the cone');

// dead enemy skipped
ok(vm.runInContext(`frontMeleeTarget([${JSON.stringify(e(0,2,{dead:true}))}],0,0,0)===null`, ctx), 'dead enemy is skipped');

// facing +X (yaw=PI/2 -> forward=(1,0)): enemy at +X hit, at +Z ignored
ok(vm.runInContext(`frontMeleeTarget([${JSON.stringify(e(2,0))}],0,0,Math.PI/2)!==null`, ctx), 'respects facing: enemy ahead when facing +X is hit');
ok(vm.runInContext(`frontMeleeTarget([${JSON.stringify(e(0,2))}],0,0,Math.PI/2)===null`, ctx), 'respects facing: enemy to the side when facing +X is missed');

console.log(`\n=== RESULT: ${pass} passed, ${fail} failed ===\n`);
process.exit(fail?1:0);
