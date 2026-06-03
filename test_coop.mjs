import { spawn } from 'child_process';
import WebSocket from 'ws';

let pass=0, fail=0;
const ok=(c,m)=>{ if(c){pass++;console.log('  ✓',m);} else {fail++;console.log('  ✗ FAIL:',m);} };
const wait=ms=>new Promise(r=>setTimeout(r,ms));

const srv=spawn('node',['server.js'],{cwd:process.cwd(),stdio:['ignore','pipe','pipe'], env:{...process.env}});
srv.stderr.on('data',d=>process.stdout.write('  [srv-err] '+d));

function client(){
  const ws=new WebSocket('ws://localhost:8080');
  const c={ ws, id:null, enemies:[], waves:[], kills:[], edmg:0, score:0 };
  ws.on('message',buf=>{ const m=JSON.parse(buf.toString());
    if(m.t==='welcome') c.id=m.id;
    else if(m.t==='enemies'){ c.enemies=m.list; c.score=m.score; }
    else if(m.t==='coopwave') c.waves.push(m);
    else if(m.t==='ekill') c.kills.push(m);
    else if(m.t==='edmg') c.edmg+=m.dmg;
  });
  c.send=o=>ws.send(JSON.stringify(o));
  c.ready=new Promise(r=>ws.on('open',r));
  return c;
}

(async()=>{
  await wait(700);
  console.log('\n=== TEST: co-op synced waves (server director) ===\n');

  const A=client(), B=client(); await Promise.all([A.ready,B.ready]);
  A.send({t:'join',name:'A',room:'co',mode:'coop'});
  B.send({t:'join',name:'B',room:'co',mode:'coop'});
  await wait(150);
  A.send({t:'state',x:0,y:0,z:0,ry:0});
  B.send({t:'state',x:10,y:0,z:10,ry:0});
  A.send({t:'coopjoin'}); B.send({t:'coopjoin'});
  await wait(200);

  ok(A.waves.some(w=>w.n===1 && !w.cleared), 'wave 1 starts when players join co-op');

  // let enemies spawn
  await wait(1500);
  ok(A.enemies.length>0, 'server spawns shared enemies ('+A.enemies.length+')');
  ok(JSON.stringify(A.enemies.map(e=>e.id))===JSON.stringify(B.enemies.map(e=>e.id)), 'both clients see the SAME enemy set (synced)');

  // enemies chase: track one enemy's distance to player A over time
  const e0=A.enemies[0]; const d0=Math.hypot(e0.x-0,e0.z-0);
  A.send({t:'state',x:0,y:0,z:0,ry:0});  // A stays at origin
  await wait(1200);
  const e0b=A.enemies.find(e=>e.id===e0.id);
  ok(e0b && Math.hypot(e0b.x-0,e0b.z-0) < d0, 'enemies move toward the player (distance shrinks)');

  // kill an enemy via hit claim -> shared score + ekill
  const scoreBefore=A.score; const target=A.enemies[0];
  A.send({t:'ehit',eid:target.id,dmg:99999});
  await wait(250);
  ok(A.kills.some(k=>k.eid===target.id && k.by===A.id), 'ehit kills the enemy and attributes it to the shooter');
  ok(B.kills.some(k=>k.eid===target.id), 'the kill is broadcast to ALL co-op players');
  ok(A.score>scoreBefore, 'shared score increases on a kill ('+scoreBefore+'→'+A.score+')');
  ok(!A.enemies.some(e=>e.id===target.id), 'dead enemy removed from the shared snapshot');

  // melee: teleport B onto an enemy -> B should take edmg
  await wait(800);
  const near=A.enemies[0];
  if(near){ B.edmg=0; for(let i=0;i<8;i++){ B.send({t:'state',x:near.x,y:0,z:near.z,ry:0}); await wait(180); } }
  ok(B.edmg>0, 'a player standing on an enemy takes melee damage ('+B.edmg+')');

  console.log(`\n=== RESULT: ${pass} passed, ${fail} failed ===\n`);
  A.ws.close(); B.ws.close(); srv.kill('SIGTERM'); await wait(200);
  process.exit(fail?1:0);
})();
