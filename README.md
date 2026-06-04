# VERDANT 🌿

A bright, low-poly **third-person open-world survival game** built on **Babylon.js**, with a
room-sharded **Node.js multiplayer server** (chat, PvP, co-op, leaderboards). Single file to
play solo; one command to host online.

> Originally mocked up in Claude Design and implemented into a runnable game. The original
> design bundle lives in [`project/`](project/) and the design conversation in [`chats/`](chats/).

- **31 JS modules** · **Babylon.js** engine (CDN, no build step)
- **Node + ws** server: rooms, group/party, 4 chat channels, **PvP (DM/TDM)**, **server-authoritative co-op waves**, **persistent leaderboards**
- **11 headless test suites · 127 passing assertions** covering all netcode + game logic

---

## 🚀 Quick start

### Play solo (no install, no build)
The game is plain HTML/JS using the Babylon.js CDN. Just serve the folder and open it:

```bash
# any static server works — pick one:
python3 -m http.server 8000
#   or:  npx serve .
```
Open **http://localhost:8000** → **Start Mission** → click the canvas to aim.

> Opening `index.html` via `file://` mostly works too, but a local server is recommended so the
> module scripts and fonts load cleanly.

### Play online (multiplayer + chat)
```bash
npm install          # installs 'ws' (the only dependency)
node server.js       # starts the relay on ws://localhost:8080
```
Then in the game: **Multiplayer** → set a **Room**, optional **Group**, pick a **Mode**
(Co-op / Deathmatch / Team) → **Connect** → **Back → Start Mission**.
Open the page in two browser tabs/devices, join the same room, and you'll see each other.

Server environment overrides:

| Var | Default | Purpose |
|-----|---------|---------|
| `PORT` | `8080` | WebSocket port |
| `FRAG_LIMIT` | `20` | Deathmatch win score |
| `RESPAWN_MS` | `3000` | PvP respawn delay |
| `COOP_CAP` | `14` | Max live co-op enemies/room |
| `LB_FILE` | `leaderboard.json` | Persistent leaderboard path |

---

## 🎮 Controls

| Keys | Action | | Keys | Action |
|------|--------|---|------|--------|
| `W A S D` | Move | | `M` | World map |
| `Mouse` | Aim (cursor = sights) | | `B` | Black Market shop |
| `L-Click` | Fire (auto-locks to target) | | `V` | Garage |
| `R-Click` | Aim down sights | | `K` | Contracts |
| `R` | Reload | | `J` | Mission log |
| `Shift` | Sprint | | `O` | Skill tree |
| `Space` | Jump · `C` Crouch | | `P` | Secret codes |
| `G` | Grenade | | `Enter` | Chat (`Tab` = channel) |
| `F` | Enter/exit vehicle | | `1`–`9` | Switch weapon |
| `E` | Pick up | | `Tab` | Inventory |
| `L` | Toggle mouselook | | `X` | **Bullet time** (slow-mo) |
| `Q` | **Melee / takedown** (crouch = silent) | | `F2` | **Photo mode** (free-fly cam) |

All action keys are **remappable** in **Settings → Controls**.

---

## 🏗️ Architecture

```
                         ┌──────────────────────── BROWSER (client) ────────────────────────┐
                         │                                                                    │
                         │   index.html  ──loads──►  Babylon.js (CDN)                         │
                         │       │                                                            │
                         │       ▼                                                            │
                         │   ┌─────────────────────── js/ modules (global fns) ───────────┐  │
                         │   │ core · world · props · entities · weapons · vehicles ·      │  │
                         │   │ city · traffic · wildlife · weather · wanted · policecars · │  │
                         │   │ economy · map · extras · features · progression · rpg ·     │  │
                         │   │ missions · codes · saves · keybinds · leaderboard · ui ·    │  │
                         │   │ audio · net · pvp · coop · chat ──────► game.js (boot/loop) │  │
                         │   └───────────────┬──────────────────────────────┬─────────────┘  │
                         │      localStorage │ (profile, slots, unlocks,     │ WebSocket       │
                         │   (offline saves) │  missions, stats, keybinds)   │                 │
                         └───────────────────┼──────────────────────────────┼─────────────────┘
                                             ▼                              ▼
                                       (per browser)            ┌─────────────────────────┐
                                                                │   server.js (Node+ws)   │
                                                                │  rooms → group → mode    │
                                                                │  • transform relay (15Hz)│
                                                                │  • chat routing          │
                                                                │  • PvP (authoritative)   │
                                                                │  • co-op enemy director  │
                                                                │  • leaderboards ──► disk │
                                                                └─────────────────────────┘
```

**Design notes**
- **No build step.** Every `js/*.js` file attaches plain global functions; `index.html` loads them
  in order and `game.js` boots on `DOMContentLoaded`. Easy to read, hack, and extend.
- **Deterministic world.** Terrain/biomes come from coordinate-hashed noise (`core.js heightAt`),
  so every client generates an identical world — peers and co-op enemies line up without syncing geometry.
- **Server is authoritative where it matters.** PvP health/frags and co-op enemies live on the
  server; clients send *claims* (`hit`, `ehit`) and render snapshots. See [`SCALING.md`](SCALING.md)
  for taking the single relay to a sharded, global deployment.

### Multiplayer protocol (JSON over WebSocket)
```
client → server                         server → client
  join   {name,room,group,mode,c}         welcome {id}
  state  {x,y,z,ry,c}        (~12/s)       peers   {list[], mode}     (15/s, per room)
  chat   {ch,text,x,z}                     chat    {ch,name,id,text}
  hit    {target,dmg,weapon}  (PvP)        frag/respawn/matchover     (PvP)
  ehit   {eid,dmg}            (co-op)       enemies {list[],wave,score} · ekill · edmg · coopwave
  score/lb {board,...}                     roominfo {count,global} · lb {board,list[]}
```
Chat channels: **global** (everyone) · **room** (shard) · **group** (party code) · **local** (proximity).
Modes: **coop** (shared waves) · **dm** (free-for-all) · **tdm** (red vs blue, friendly-fire off).

---

## 📁 Project structure

```
Verdant-webgl/
├── index.html              # game shell: HUD, menus, panels, all CSS, script includes
├── server.js               # Node+ws relay: rooms, chat, PvP, co-op director, leaderboards
├── package.json            # one dep: ws
├── SCALING.md              # how to take the relay to million-scale
├── js/
│  ├── core.js              # global state, math, noise terrain, biomes, collision
│  ├── world.js             # vertex-coloured terrain, water, props, day/night sky
│  ├── props.js             # extra low-poly props (barrels, fences, pines, crystals, fireflies…)
│  ├── entities.js          # humanoid rig + animation, enemies, villagers, pickups
│  ├── weapons.js           # 9 weapons, raycast/aim-assist, grenades, rockets, AoE
│  ├── vehicles.js          # drivable cars (arcade physics, chase cam)
│  ├── city.js · traffic.js # downtown district, roads, AI traffic
│  ├── wildlife.js          # clouds, stars, deer, birds
│  ├── weather.js           # rain / clear / auto
│  ├── wanted.js · policecars.js  # GTA-style heat + siren cruisers + roadblocks
│  ├── economy.js           # cash + Black Market shop
│  ├── map.js               # full-screen world map
│  ├── extras.js            # cash drops, garage, contracts, customization
│  ├── features.js          # damage numbers, combo, boss bar, scope, resupply pad
│  ├── progression.js       # stats, weapon-unlock persistence, enemy health bars
│  ├── rpg.js               # XP, levels, skill tree/perks, achievements (profile save)
│  ├── missions.js          # campaign objectives → cash + weapon unlocks
│  ├── codes.js             # secret cheat codes (unlock guns, god mode, etc.)
│  ├── saves.js             # 3 manual profile save/load slots
│  ├── keybinds.js          # rebindable controls
│  ├── leaderboard.js       # global (server) + local high-score boards
│  ├── audio.js             # procedural WebAudio SFX + ambient + siren
│  ├── ui.js                # HUD refresh, minimap, inventory, menus, settings wiring
│  ├── net.js               # multiplayer client (transforms, chat, PvP, co-op messages)
│  ├── pvp.js               # PvP client: nametags, scoreboard, kill feed, respawn
│  ├── coop.js              # co-op client: renders server enemies, shoots them, shared HUD
│  ├── chat.js              # in-game chat UI (4 channels)
│  └── game.js              # engine boot, input, main loop, flow, photo mode, FPS counter
├── test_*.mjs              # 8 headless test suites (Node)
├── project/                # original Claude Design HTML prototype + assets
└── chats/                  # the design conversation transcript
```

---

## 🧩 Feature highlights

- **World** — hilly biomes + endless procedural mountains, downtown city with roads/traffic,
  drivable cars + garage, day/night with stars & glowing windows, weather, deer/birds/pedestrians,
  hundreds of instanced low-poly props.
- **Combat** — 9 weapons (pistol→RPG, plus 3 secret guns), grenades, aim-assist, headshots,
  ranged/melee/brute enemies, **boss every 5th wave**, combo multiplier, floating damage numbers,
  **gunsmithing attachments** (optics/barrels/mags/grips/lasers), a **bullet-time** slow-mo ability,
  and a **knife melee** with crouching **silent takedowns**.
- **Progression** — XP + levels + a **skill tree** (6 perks), **12 achievements**, **missions**
  that unlock weapons, **secret codes**, **3 save slots**.
- **GTA systems** — cash economy + Black Market, wanted level + police + roadblocks, contracts,
  full-screen map + minimap/compass.
- **Multiplayer** — rooms, party groups, 4 chat channels, **PvP Deathmatch/Team**, **co-op synced
  waves**, **persistent global leaderboards**.

### Secret codes (open with `P`)
`GOLDENGUN` · `RAILGUN` · `BURNBABY` · `ARSENAL` · `GODMODE` · `RAMBO` (infinite ammo) ·
`RICHKID` · `FULLNADE` · `PATCHUP` · `SUNNYDAY` · `MIDNIGHT`

---

## 🧪 Testing

The WebGL client can't run headlessly, but **all netcode and game logic are covered** by Node test
suites (in-memory `localStorage`/DOM stubs for client logic; real `ws` clients against a live
`server.js` for netcode):

```bash
npm install                  # need 'ws' for the server-side suites
for t in test_*.mjs; do node "$t"; done
```

| Suite | Covers | Assertions |
|-------|--------|-----------:|
| `test_server.mjs` | rooms, 4 chat channels, presence | 12 |
| `test_pvp.mjs` | authoritative damage, frags, respawn, teams | 16 |
| `test_coop.mjs` | shared spawns, chase AI, kills, melee | 9 |
| `test_leaderboard.mjs` | submit/sort/cap + disk persistence | 9 |
| `test_rpg.mjs` | XP, level-up, perks, achievements, profile | 14 |
| `test_logic.mjs` | weapon unlocks, missions, codes | 12 |
| `test_saves.mjs` | save slots: snapshot/isolation/restore | 11 |
| `test_keybinds.mjs` | rebind, persistence, reverse lookup | 14 |
| `test_gunsmith.mjs` | attachment stat math + persistence | 11 |
| `test_bullettime.mjs` | slow-mo meter: drain/regen/activation | 11 |
| `test_melee.mjs` | melee cone/reach/facing target selection | 8 |
| **Total** | | **127** |

Every JS module also passes `node --check`.

---

## 🛠️ Tech stack
- **Babylon.js** (WebGL) via CDN — rendering, cameras, shadows, PBR glass, instancing
- **Vanilla JS / HTML / CSS** — no framework, no bundler
- **Node.js + ws** — multiplayer relay & authoritative match logic
- **localStorage** (client) + **JSON file** (server) — persistence

## 📈 Scaling to a global app
The relay is **room-sharded** (bandwidth scales with room size, not total players) and stateless
about gameplay, so it's the right shape to scale out. The path to millions — load-balanced relay
pods + a shared pub/sub bus (Redis/NATS), a presence tier, auth & moderation, interest management —
is documented in **[SCALING.md](SCALING.md)**. The client already speaks the room/group/channel
protocol, so that work is transport-layer only.

---

_Built with Claude Code. © Heleo2 Studio — Babylon.js WebGL engine._
