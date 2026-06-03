/* =====================================================================
   VERDANT — server.js
   Room-sharded multiplayer + chat relay + authoritative PvP (Node + ws).

   Each client joins a ROOM (world shard), optional GROUP (party), with a
   MODE: 'coop' (default, friendly), 'dm' (free-for-all deathmatch) or
   'tdm' (team deathmatch). Transforms fan out PER ROOM; chat routes by
   channel (global/room/group/local).

   PvP is SERVER-AUTHORITATIVE: clients send 'hit' claims, the server owns
   every player's health, applies damage, ignores friendly fire, attributes
   frags, runs respawns, tracks scores, and ends the match at the frag
   limit. Health/score/team/alive ship inside the per-room peers snapshot.

   RUN:  npm install ws  &&  node server.js   →  ws://localhost:8080
   SCALING: see SCALING.md (shard rooms across processes via a pub/sub bus).
   ===================================================================== */

const { WebSocketServer } = require('ws');
const fs = require('fs');

const PORT = process.env.PORT || 8080;
const LB_FILE = process.env.LB_FILE || 'leaderboard.json';
const LB_MAX = 50;
const TICK = 1000 / 15;        // transform/state broadcast rate
const FRAG_LIMIT = +process.env.FRAG_LIMIT || 20;         // deathmatch win condition
const RESPAWN_MS = +process.env.RESPAWN_MS || 3000;
const MAX_HP = 100;

const wss = new WebSocketServer({ port: PORT });
let nextId = 1;
const players = new Map();      // id -> player
const rooms = new Map();        // roomId -> Set(id)
const roomMode = new Map();     // roomId -> 'coop' | 'dm' | 'tdm'

console.log(`[VERDANT] relay + PvP listening on ws://localhost:${PORT}`);

// ---- persistent global leaderboards ----
let boards = {};
try { boards = JSON.parse(fs.readFileSync(LB_FILE, 'utf8')) || {}; } catch { boards = {}; }
let lbDirty = false;
function lbSubmit(board, entry) {
  board = String(board || 'survival').slice(0, 20);
  const arr = boards[board] || (boards[board] = []);
  arr.push({ name: String(entry.name || 'Anon').slice(0, 24), value: Math.max(0, Math.floor(+entry.value || 0)), wave: entry.wave | 0, ts: Date.now() });
  arr.sort((a, b) => b.value - a.value);
  if (arr.length > LB_MAX) arr.length = LB_MAX;
  lbDirty = true;
  return arr;
}
function lbTop(board, n) { return (boards[String(board || 'survival')] || []).slice(0, n || 20); }
setInterval(() => { if (lbDirty) { lbDirty = false; try { fs.writeFileSync(LB_FILE, JSON.stringify(boards)); } catch {} } }, 2000);

function roomSet(room) { let s = rooms.get(room); if (!s) { s = new Set(); rooms.set(room, s); } return s; }
function joinRoom(id, room) {
  const p = players.get(id); if (!p) return;
  if (p.room) { const old = rooms.get(p.room); if (old) { old.delete(id); if (old.size === 0) { rooms.delete(p.room); roomMode.delete(p.room); } } }
  p.room = room; roomSet(room).add(id);
}
function assignTeam(room) {
  // balance: put the new player on the smaller team
  let red = 0, blue = 0;
  for (const pid of roomSet(room)) { const p = players.get(pid); if (!p) continue; if (p.team === 'red') red++; else if (p.team === 'blue') blue++; }
  return red <= blue ? 'red' : 'blue';
}
function now() { return Date.now(); }

wss.on('connection', (ws) => {
  const id = nextId++;
  players.set(id, { ws, name: 'Operator', x: 0, y: 0, z: 0, ry: 0, c: 0, room: null, group: '',
    mode: 'coop', team: '', hp: MAX_HP, score: 0, deaths: 0, alive: true, respawnAt: 0 });
  ws.send(JSON.stringify({ t: 'welcome', id }));
  console.log(`[+] socket ${id} connected (${players.size} online)`);

  ws.on('message', (buf) => {
    let m; try { m = JSON.parse(buf.toString()); } catch { return; }
    const p = players.get(id); if (!p) return;

    if (m.t === 'join') {
      p.name = String(m.name || 'Operator').slice(0, 24);
      p.c = m.c | 0;
      p.group = String(m.group || '').slice(0, 24);
      const room = String(m.room || 'lobby').slice(0, 32);
      const mode = ['coop', 'dm', 'tdm'].includes(m.mode) ? m.mode : 'coop';
      joinRoom(id, room);
      roomMode.set(room, mode);
      p.mode = mode;
      p.team = mode === 'tdm' ? assignTeam(room) : '';
      p.hp = MAX_HP; p.score = 0; p.deaths = 0; p.alive = true; p.respawnAt = 0;
      // align everyone in the room to the room's mode/teams
      for (const pid of roomSet(room)) { const q = players.get(pid); if (q) { q.mode = mode; if (mode !== 'tdm') q.team = ''; else if (!q.team) q.team = assignTeam(room); } }
      roomInfo(room, 'join', p.name);
    } else if (m.t === 'state') {
      p.x = +m.x || 0; p.y = +m.y || 0; p.z = +m.z || 0; p.ry = +m.ry || 0;
      if (m.c != null) p.c = m.c | 0;
    } else if (m.t === 'chat') {
      relayChat(id, p, m);
    } else if (m.t === 'hit') {
      handleHit(id, p, m);
    } else if (m.t === 'score') {
      const board = m.board === 'dm' ? 'dm' : 'survival';
      lbSubmit(board, { name: m.name || p.name, value: m.value, wave: m.wave });
      if (ws.readyState === ws.OPEN) ws.send(JSON.stringify({ t: 'lb', board, list: lbTop(board, 20) }));
    } else if (m.t === 'lb') {
      const board = m.board === 'dm' ? 'dm' : 'survival';
      if (ws.readyState === ws.OPEN) ws.send(JSON.stringify({ t: 'lb', board, list: lbTop(board, 20) }));
    } else if (m.t === 'coopjoin') {
      if (roomMode.get(p.room) === 'coop') coopDir(p.room);   // ensure a director exists for the room
    } else if (m.t === 'ehit') {
      handleEHit(id, p, m);
    }
  });

  ws.on('close', () => {
    const p = players.get(id);
    const room = p && p.room, name = p && p.name;
    if (room) { const s = rooms.get(room); if (s) { s.delete(id); if (s.size === 0) { rooms.delete(room); roomMode.delete(room); coop.delete(room); } } }
    players.delete(id);
    broadcastAll({ t: 'leave', id });
    if (room) roomInfo(room, 'leave', name);
    console.log(`[-] socket ${id} left (${players.size} online)`);
  });
  ws.on('error', () => {});
});

function broadcastAll(obj) { const d = JSON.stringify(obj); for (const p of players.values()) if (p.ws.readyState === p.ws.OPEN) p.ws.send(d); }
function broadcastRoom(room, obj) { const s = rooms.get(room); if (!s) return; const d = JSON.stringify(obj);
  for (const pid of s) { const p = players.get(pid); if (p && p.ws.readyState === p.ws.OPEN) p.ws.send(d); } }

function relayChat(senderId, sender, m) {
  const text = String(m.text || '').slice(0, 160); if (!text) return;
  const msg = { t: 'chat', ch: m.ch || 'room', name: sender.name, id: senderId, text, x: +m.x || 0, z: +m.z || 0 };
  if (m.ch === 'global') { broadcastAll(msg); return; }
  const s = rooms.get(sender.room); if (!s) return;
  for (const pid of s) {
    const p = players.get(pid); if (!p || p.ws.readyState !== p.ws.OPEN) continue;
    if (m.ch === 'group' && p.group !== sender.group) continue;
    p.ws.send(JSON.stringify(msg));
  }
}

// ---- authoritative PvP damage ----
function handleHit(attackerId, attacker, m) {
  const mode = roomMode.get(attacker.room);
  if (mode !== 'dm' && mode !== 'tdm') return;           // no PvP damage in co-op
  const victim = players.get(m.target | 0);
  if (!victim || victim.room !== attacker.room) return;  // must share the room
  if (!victim.alive || !attacker.alive) return;
  if (mode === 'tdm' && victim.team === attacker.team) return;  // friendly fire off
  const dmg = Math.max(1, Math.min(200, +m.dmg || 0));
  victim.hp -= dmg;
  if (victim.hp <= 0) {
    victim.hp = 0; victim.alive = false; victim.deaths++; victim.respawnAt = now() + RESPAWN_MS;
    attacker.score++;
    broadcastRoom(attacker.room, { t: 'frag', killer: attacker.name, kid: attackerId, victim: victim.name, vid: m.target | 0, weapon: String(m.weapon || '').slice(0, 16) });
    if (attacker.score >= FRAG_LIMIT) endMatch(attacker.room, attacker);
  }
}
function endMatch(room, winner) {
  broadcastRoom(room, { t: 'matchover', winner: winner.name, score: winner.score });
  for (const pid of roomSet(room)) { const p = players.get(pid); if (!p) continue; p.score = 0; p.deaths = 0; p.hp = MAX_HP; p.alive = true; p.respawnAt = 0; }
}

/* =====================================================================
   CO-OP SYNCED WAVES — server-authoritative shared enemy director.
   For 'coop' rooms: the server spawns enemies, chases the nearest player,
   deals melee damage, owns enemy health, attributes kills, advances waves,
   and broadcasts an enemy snapshot. Clients render it and send 'ehit'.
   ===================================================================== */
const COOP_CAP = +process.env.COOP_CAP || 14;
const MELEE_RANGE = 2.4;
const coop = new Map();           // room -> director
let lastCoop = Date.now();

function coopDir(room) { let d = coop.get(room); if (!d) { d = { wave: 0, toSpawn: 0, active: false, enemies: new Map(), nextEid: 1, score: 0, betweenUntil: 0, started: false }; coop.set(room, d); } return d; }
function roomPlayers(room) { const out = []; const s = rooms.get(room); if (s) for (const pid of s) { const p = players.get(pid); if (p) out.push([pid, p]); } return out; }
function startCoopWave(room, d) { d.wave++; d.toSpawn = Math.round(4 + d.wave * 2); d.active = true; broadcastRoom(room, { t: 'coopwave', n: d.wave, count: d.toSpawn }); }

function coopTick(room, d, dt) {
  const ps = roomPlayers(room);
  if (ps.length === 0) return;
  if (!d.started) { d.started = true; startCoopWave(room, d); }
  // spawn
  if (d.active && d.toSpawn > 0 && d.enemies.size < COOP_CAP && Math.random() < 0.07) {
    const [, tp] = ps[(Math.random() * ps.length) | 0];
    const a = Math.random() * Math.PI * 2, dist = 30 + Math.random() * 20;
    const r = Math.random();
    const type = (d.wave >= 4 && r > 0.86) ? 'brute' : (d.wave >= 2 && r < 0.3 ? 'shooter' : 'grunt');
    const hp = (type === 'brute' ? 180 : type === 'shooter' ? 55 : 75) + d.wave * 10;
    const eid = d.nextEid++;
    d.enemies.set(eid, { id: eid, x: tp.x + Math.cos(a) * dist, z: tp.z + Math.sin(a) * dist, hp, mhp: hp, type,
      speed: (type === 'brute' ? 1.8 : type === 'shooter' ? 2.4 : 3.0) + d.wave * 0.1, dmg: (type === 'brute' ? 22 : 9) + d.wave, atk: Math.random() });
    d.toSpawn--;
  }
  // move toward nearest player + melee
  for (const e of d.enemies.values()) {
    let best = null, bd = Infinity;
    for (const [, p] of ps) { const dx = p.x - e.x, dz = p.z - e.z, dd = dx * dx + dz * dz; if (dd < bd) { bd = dd; best = p; } }
    if (!best) continue;
    const dlen = Math.sqrt(bd) || 1, nx = (best.x - e.x) / dlen, nz = (best.z - e.z) / dlen;
    if (dlen > MELEE_RANGE) { e.x += nx * e.speed * dt; e.z += nz * e.speed * dt; }
    else { e.atk -= dt; if (e.atk <= 0) { e.atk = 1.0; if (best.ws.readyState === best.ws.OPEN) best.ws.send(JSON.stringify({ t: 'edmg', dmg: e.dmg })); } }
  }
  // wave clear -> short break -> next wave
  if (d.active && d.toSpawn <= 0 && d.enemies.size === 0) { d.active = false; d.score += d.wave * 250; d.betweenUntil = Date.now() + 4000; broadcastRoom(room, { t: 'coopwave', n: d.wave, cleared: true, score: d.score }); }
  if (!d.active && d.betweenUntil && Date.now() >= d.betweenUntil) { d.betweenUntil = 0; startCoopWave(room, d); }
  // snapshot
  const list = [];
  for (const e of d.enemies.values()) list.push({ id: e.id, x: e.x, z: e.z, hp: e.hp, mhp: e.mhp, type: e.type });
  broadcastRoom(room, { t: 'enemies', list, wave: d.wave, toSpawn: d.toSpawn, score: d.score });
}
function handleEHit(id, p, m) {
  const d = coop.get(p.room); if (!d) return;
  const e = d.enemies.get(m.eid | 0); if (!e) return;
  e.hp -= Math.max(1, Math.min(99999, +m.dmg || 0));
  if (e.hp <= 0) { d.enemies.delete(e.id);
    d.score += e.type === 'brute' ? 300 : e.type === 'shooter' ? 150 : 100;
    broadcastRoom(p.room, { t: 'ekill', eid: e.id, by: id, name: p.name, etype: e.type, score: d.score }); }
}

function roomInfo(room, event, who) {
  const s = rooms.get(room); const count = s ? s.size : 0;
  broadcastRoom(room, { t: 'roominfo', room, mode: roomMode.get(room) || 'coop', count, global: players.size, event, who });
}

// per-room state fan-out (transforms + PvP health/score/team/alive)
setInterval(() => {
  const t = now();
  // co-op enemy director
  const dt = Math.min(0.25, (t - lastCoop) / 1000); lastCoop = t;
  for (const [room, d] of coop) {
    if (!rooms.get(room)) { coop.delete(room); continue; }
    if (roomMode.get(room) === 'coop') coopTick(room, d, dt);
  }
  // respawns
  for (const p of players.values()) {
    if (!p.alive && p.respawnAt && t >= p.respawnAt) { p.alive = true; p.hp = MAX_HP; p.respawnAt = 0;
      broadcastRoom(p.room, { t: 'respawn', id: idOf(p) }); }
  }
  for (const [room, s] of rooms) {
    if (s.size === 0) continue;
    const mode = roomMode.get(room) || 'coop';
    const list = [];
    for (const pid of s) { const p = players.get(pid); if (p) list.push({ id: pid, name: p.name, x: p.x, y: p.y, z: p.z, ry: p.ry, c: p.c, hp: p.hp, score: p.score, deaths: p.deaths, team: p.team, alive: p.alive }); }
    broadcastRoom(room, { t: 'peers', list, mode });
  }
}, TICK);

function idOf(player) { for (const [id, p] of players) if (p === player) return id; return -1; }

// keepalive
setInterval(() => { for (const p of players.values()) if (p.ws.readyState === p.ws.OPEN) p.ws.ping(); }, 15000);
