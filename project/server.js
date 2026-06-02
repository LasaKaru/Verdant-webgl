/* =====================================================================
   VERDANT — server.js
   Minimal authoritative-relay multiplayer server (Node.js + ws).
   It is a POSITION RELAY: each client streams its transform, the server
   fans state out to everyone ~15x/second. Good enough for co-op presence.

   RUN:
     npm install ws
     node server.js
   then in the game → Multiplayer → connect to  ws://localhost:8080

   PRODUCTION TODO (intentionally out of scope for the MVP):
     - server authority over health/score (never trust the client)
     - delta compression + interpolation/extrapolation on the client
     - rooms / lobbies / matchmaking
     - reconnection + heartbeat ping-pong (basic ping is included)
     - anti-cheat validation of movement deltas
   ===================================================================== */

const { WebSocketServer } = require('ws');

const PORT = process.env.PORT || 8080;
const TICK = 1000 / 15; // broadcast rate

const wss = new WebSocketServer({ port: PORT });
let nextId = 1;
const players = new Map(); // id -> { ws, name, x, y, z, ry, c, alive }

console.log(`[VERDANT] relay listening on ws://localhost:${PORT}`);

wss.on('connection', (ws) => {
  const id = nextId++;
  players.set(id, { ws, name: 'Operator', x: 0, y: 0, z: 0, ry: 0, c: 0, alive: true });
  ws.send(JSON.stringify({ t: 'welcome', id }));
  console.log(`[+] player ${id} connected (${players.size} online)`);

  ws.on('message', (buf) => {
    let m;
    try { m = JSON.parse(buf.toString()); } catch { return; }
    const p = players.get(id);
    if (!p) return;
    if (m.t === 'join') { p.name = String(m.name || 'Operator').slice(0, 24); p.c = m.c | 0; }
    else if (m.t === 'state') { p.x = +m.x || 0; p.y = +m.y || 0; p.z = +m.z || 0; p.ry = +m.ry || 0; if (m.c != null) p.c = m.c | 0; }
  });

  ws.on('close', () => {
    players.delete(id);
    broadcast({ t: 'leave', id });
    console.log(`[-] player ${id} left (${players.size} online)`);
  });
  ws.on('error', () => {});
});

function broadcast(obj) {
  const data = JSON.stringify(obj);
  for (const { ws } of players.values()) {
    if (ws.readyState === ws.OPEN) ws.send(data);
  }
}

// state fan-out
setInterval(() => {
  if (players.size === 0) return;
  const list = [];
  for (const [id, p] of players) list.push({ id, name: p.name, x: p.x, y: p.y, z: p.z, ry: p.ry, c: p.c });
  broadcast({ t: 'peers', list });
}, TICK);

// keepalive
setInterval(() => {
  for (const { ws } of players.values()) { if (ws.readyState === ws.OPEN) ws.ping(); }
}, 15000);
