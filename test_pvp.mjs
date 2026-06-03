import { spawn } from 'child_process';
import WebSocket from 'ws';

let pass=0, fail=0;
const ok=(c,m)=>{ if(c){pass++;console.log('  ✓',m);} else {fail++;console.log('  ✗ FAIL:',m);} };
const wait=ms=>new Promise(r=>setTimeout(r,ms));

// fast match settings for the test
const srv = spawn('node', ['server.js'], { cwd: process.cwd(), stdio:['ignore','pipe','pipe'],
  env: { ...process.env, FRAG_LIMIT:'3', RESPAWN_MS:'300' } });
srv.stderr.on('data', d=>process.stdout.write('  [srv-err] '+d));

function client(){
  const ws=new WebSocket('ws://localhost:8080');
  const c={ ws, id:null, peers:[], frags:[], matchover:null, respawns:[], mode:null };
  ws.on('message', buf=>{ const m=JSON.parse(buf.toString());
    if(m.t==='welcome') c.id=m.id;
    else if(m.t==='peers'){ c.peers=m.list; c.mode=m.mode; }
    else if(m.t==='frag') c.frags.push(m);
    else if(m.t==='matchover') c.matchover=m;
    else if(m.t==='respawn') c.respawns.push(m.id);
  });
  c.send=o=>ws.send(JSON.stringify(o));
  c.ready=new Promise(r=>ws.on('open',r));
  c.peer=id=>c.peers.find(p=>p.id===id);
  return c;
}

(async()=>{
  await wait(700);
  console.log('\n=== TEST: authoritative PvP ===\n');

  // ---- Deathmatch ----
  const A=client(), B=client(); await Promise.all([A.ready,B.ready]);
  A.send({t:'join',name:'A',room:'arena',mode:'dm'});
  B.send({t:'join',name:'B',room:'arena',mode:'dm'});
  await wait(300);
  ok(A.mode==='dm', 'room reports deathmatch mode');
  ok(A.peer(B.id) && A.peer(B.id).hp===100 && A.peer(B.id).alive===true, 'peers snapshot carries hp + alive');

  // non-lethal hit
  A.send({t:'hit',target:B.id,dmg:60}); await wait(150);
  ok(A.peer(B.id).hp===40, 'hit applies server-side damage (100→40)');
  ok(A.peer(A.id).score===0, 'no frag for a non-lethal hit');

  // lethal hit -> frag + death
  A.send({t:'hit',target:B.id,dmg:60}); await wait(150);
  ok(A.peer(B.id).alive===false, 'lethal hit kills victim');
  ok(A.peer(A.id).score===1, 'killer score increments to 1');
  ok(A.frags.length===1 && A.frags[0].killer==='A' && A.frags[0].victim==='B', 'frag event broadcast with killer/victim');

  // dead players cannot be farmed
  const scoreNow=A.peer(A.id).score;
  A.send({t:'hit',target:B.id,dmg:60}); await wait(150);
  ok(A.peer(A.id).score===scoreNow, 'cannot score on an already-dead player');

  // respawn after RESPAWN_MS (300ms)
  await wait(500);
  ok(A.peer(B.id).alive===true && A.peer(B.id).hp===100, 'victim respawns at full HP');
  ok(B.respawns.includes(B.id), 'respawn event delivered');

  // frag limit -> match over (limit=3)
  for (let i=0;i<2;i++){ A.send({t:'hit',target:B.id,dmg:200}); await wait(120); await wait(350); } // 2 more kills (total 3)
  await wait(200);
  ok(A.matchover && A.matchover.winner==='A', 'reaching frag limit ends the match (winner A)');
  ok(A.peer(A.id).score===0, 'scores reset after match over');

  // ---- Team Deathmatch: friendly fire off ----
  const T1=client(), T2=client(), T3=client(); await Promise.all([T1.ready,T2.ready,T3.ready]);
  T1.send({t:'join',name:'T1',room:'tarena',mode:'tdm'});
  T2.send({t:'join',name:'T2',room:'tarena',mode:'tdm'});
  T3.send({t:'join',name:'T3',room:'tarena',mode:'tdm'});
  await wait(300);
  const t1=T1.peer(T1.id), t3=T1.peer(T3.id);
  ok(t1 && t1.team && t3 && t1.team===t3.team, 'team balancing puts 1st & 3rd joiner on the same team');
  const t3hpBefore=T1.peer(T3.id).hp;
  T1.send({t:'hit',target:T3.id,dmg:50}); await wait(150);          // same team
  ok(T1.peer(T3.id).hp===t3hpBefore, 'friendly fire deals NO damage (same team)');
  T2.send({t:'hit',target:T3.id,dmg:50}); await wait(150);          // enemy team
  ok(T1.peer(T3.id).hp===t3hpBefore-50, 'enemy fire DOES damage (different team)');

  // ---- Co-op: no PvP damage ----
  const C1=client(), C2=client(); await Promise.all([C1.ready,C2.ready]);
  C1.send({t:'join',name:'C1',room:'farm',mode:'coop'});
  C2.send({t:'join',name:'C2',room:'farm',mode:'coop'});
  await wait(300);
  C1.send({t:'hit',target:C2.id,dmg:80}); await wait(150);
  ok(C1.peer(C2.id).hp===100, 'co-op mode ignores player-vs-player damage');

  console.log(`\n=== RESULT: ${pass} passed, ${fail} failed ===\n`);
  [A,B,T1,T2,T3,C1,C2].forEach(c=>c.ws.close()); srv.kill('SIGTERM');
  await wait(200); process.exit(fail?1:0);
})();
