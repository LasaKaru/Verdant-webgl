import { spawn } from 'child_process';
import WebSocket from 'ws';

const log = (...a) => console.log(...a);
let pass = 0, fail = 0;
const ok = (c, m) => { if (c) { pass++; log('  ✓', m); } else { fail++; log('  ✗ FAIL:', m); } };
const wait = ms => new Promise(r => setTimeout(r, ms));

// start the server
const srv = spawn('node', ['server.js'], { cwd: process.cwd(), stdio: ['ignore', 'pipe', 'pipe'] });
srv.stdout.on('data', d => process.stdout.write('  [srv] ' + d));
srv.stderr.on('data', d => process.stdout.write('  [srv-err] ' + d));

function client(name) {
  const ws = new WebSocket('ws://localhost:8080');
  const c = { ws, name, id: null, msgs: [], peers: [], chats: [], roominfo: [] };
  ws.on('message', buf => {
    const m = JSON.parse(buf.toString());
    c.msgs.push(m);
    if (m.t === 'welcome') c.id = m.id;
    else if (m.t === 'peers') c.peers = m.list;
    else if (m.t === 'chat') c.chats.push(m);
    else if (m.t === 'roominfo') c.roominfo.push(m);
  });
  c.send = o => ws.send(JSON.stringify(o));
  c.ready = new Promise(res => ws.on('open', res));
  return c;
}

(async () => {
  await wait(700); // let server boot
  log('\n=== TEST: room-sharded relay + chat ===\n');

  // A and B join room "alpha" (B in group G1); C joins room "beta"
  const A = client('A'), B = client('B'), C = client('C');
  await Promise.all([A.ready, B.ready, C.ready]);
  A.send({ t: 'join', name: 'Alice', c: 0, room: 'alpha', group: '' });
  B.send({ t: 'join', name: 'Bob',   c: 1, room: 'alpha', group: 'G1' });
  C.send({ t: 'join', name: 'Cara',  c: 2, room: 'beta',  group: '' });
  await wait(400);

  ok(A.id && B.id && C.id, 'all clients got welcome+id');

  // positions
  A.send({ t: 'state', x: 1, y: 0, z: 1, ry: 0 });
  B.send({ t: 'state', x: 2, y: 0, z: 2, ry: 0 });
  C.send({ t: 'state', x: 9, y: 0, z: 9, ry: 0 });
  await wait(300);

  // peers fan-out is per-room
  ok(A.peers.length === 2, `A sees 2 peers in room alpha (got ${A.peers.length})`);
  ok(C.peers.length === 1, `C sees only itself in room beta (got ${C.peers.length})`);
  ok(!A.peers.some(p => p.name === 'Cara'), 'A does NOT see Cara (different room)');

  // GLOBAL chat reaches everyone
  A.chats = B.chats = C.chats = [];
  A.send({ t: 'chat', ch: 'global', text: 'hello world', x: 1, z: 1 });
  await wait(250);
  ok(B.chats.some(m => m.text === 'hello world'), 'GLOBAL chat reaches same-room peer B');
  ok(C.chats.some(m => m.text === 'hello world'), 'GLOBAL chat reaches other-room peer C');

  // ROOM chat stays in the room
  B.chats = []; C.chats = [];
  A.send({ t: 'chat', ch: 'room', text: 'room only', x: 1, z: 1 });
  await wait(250);
  ok(B.chats.some(m => m.text === 'room only'), 'ROOM chat reaches B (same room)');
  ok(!C.chats.some(m => m.text === 'room only'), 'ROOM chat does NOT reach C (other room)');

  // GROUP chat only to matching group code
  A.chats = []; B.chats = [];
  B.send({ t: 'chat', ch: 'group', text: 'party time', x: 2, z: 2 });
  await wait(250);
  ok(!A.chats.some(m => m.text === 'party time'), 'GROUP chat does NOT reach A (no group code)');
  // B is in its own group; have A join the group and retry
  A.send({ t: 'join', name: 'Alice', c: 0, room: 'alpha', group: 'G1' });
  await wait(200);
  A.chats = [];
  B.send({ t: 'chat', ch: 'group', text: 'party two', x: 2, z: 2 });
  await wait(250);
  ok(A.chats.some(m => m.text === 'party two'), 'GROUP chat reaches A after joining group G1');

  // roominfo population
  ok(A.roominfo.some(r => r.room === 'alpha' && r.count === 2), 'roominfo reports 2 in room alpha');

  // leave handling
  B.ws.close();
  await wait(400);
  ok(A.peers.length === 1, `after B leaves, A sees 1 peer (got ${A.peers.length})`);

  log(`\n=== RESULT: ${pass} passed, ${fail} failed ===\n`);
  A.ws.close(); C.ws.close(); srv.kill('SIGTERM');
  await wait(200);
  process.exit(fail ? 1 : 0);
})();
