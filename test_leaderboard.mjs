import { spawn } from 'child_process';
import WebSocket from 'ws';
import fs from 'fs';

let pass=0, fail=0;
const ok=(c,m)=>{ if(c){pass++;console.log('  ✓',m);} else {fail++;console.log('  ✗ FAIL:',m);} };
const wait=ms=>new Promise(r=>setTimeout(r,ms));
const LB='test_lb.json';
try{ fs.unlinkSync(LB); }catch{}

function startServer(){ return spawn('node',['server.js'],{cwd:process.cwd(),stdio:['ignore','pipe','pipe'],
  env:{...process.env, LB_FILE:LB}}); }
function client(){
  const ws=new WebSocket('ws://localhost:8080');
  const c={ ws, lb:{} };
  ws.on('message',buf=>{ const m=JSON.parse(buf.toString()); if(m.t==='lb') c.lb[m.board]=m.list; });
  c.send=o=>ws.send(JSON.stringify(o));
  c.ready=new Promise(r=>ws.on('open',r));
  return c;
}

(async()=>{
  let srv=startServer(); await wait(700);
  console.log('\n=== TEST: persistent leaderboards ===\n');

  const A=client(); await A.ready;
  A.send({t:'join',name:'A',room:'lobby'});
  // submit survival scores out of order
  for(const [name,val,wave] of [['Zoe',1500,6],['Max',4200,12],['Ivy',3000,9],['Bo',900,4]])
    A.send({t:'score',board:'survival',name,value:val,wave});
  await wait(300);
  A.send({t:'lb',board:'survival'}); await wait(200);
  const surv=A.lb.survival||[];
  ok(surv.length===4, 'all 4 survival scores recorded');
  ok(surv[0].name==='Max' && surv[0].value===4200, 'leaderboard sorted descending (Max on top)');
  ok(surv[surv.length-1].name==='Bo', 'lowest score is last');
  ok(surv[0].wave===12, 'wave metadata preserved');

  // separate dm board
  A.send({t:'score',board:'dm',name:'A',value:18}); await wait(200);
  A.send({t:'lb',board:'dm'}); await wait(200);
  ok((A.lb.dm||[]).length===1 && A.lb.dm[0].value===18, 'deathmatch board is independent');
  ok((A.lb.survival||[]).length===4, 'survival board unaffected by dm submit');

  // persistence to disk
  await wait(2300); // wait past the 2s save debounce
  ok(fs.existsSync(LB), 'leaderboard.json written to disk');
  const onDisk=JSON.parse(fs.readFileSync(LB,'utf8'));
  ok(onDisk.survival && onDisk.survival[0].name==='Max', 'disk file has sorted survival data');

  // restart server, data should reload
  A.ws.close(); srv.kill('SIGTERM'); await wait(600);
  srv=startServer(); await wait(800);
  const B=client(); await B.ready;
  B.send({t:'join',name:'B',room:'lobby'});
  B.send({t:'lb',board:'survival'}); await wait(300);
  ok((B.lb.survival||[]).length===4 && B.lb.survival[0].name==='Max', 'scores persist across server restart');

  console.log(`\n=== RESULT: ${pass} passed, ${fail} failed ===\n`);
  B.ws.close(); srv.kill('SIGTERM'); await wait(200);
  try{ fs.unlinkSync(LB); }catch{}
  process.exit(fail?1:0);
})();
