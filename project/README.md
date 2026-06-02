# VERDANT — Heleo2 Studio

A bright, vibrant **low-poly third-person open-world survival** MVP built entirely in the browser on **Babylon.js**. Explore a procedurally-generated valley of jungles, meadows and ruins; loot weapons and gear; and survive escalating waves of hostiles — under a live day/night sky.

> **Engine note.** This is built on **Babylon.js only** — *not* Babylon + three.js. They are competing engines; bundling both doubles the download for zero gain. Babylon already provides collisions, shadows, PBR glass and the asset pipeline we need. If you ever want three.js instead, only the *engine layer* (`world.js` mesh creation + `game.js` camera/render) changes — the game systems are engine-agnostic.

---

## Run it

Just open **`index.html`** in any modern browser. Click **Start Mission**, then click the canvas to lock the mouse.

No build step, no bundler — everything streams from CDNs and local modules.

### Multiplayer (optional)
True netplay needs a server — it can't live in a static file. A tiny relay is included:

```bash
npm install        # installs ws
node server.js     # serves ws://localhost:8080
```

Then in-game → **Multiplayer** → connect to `ws://localhost:8080`. Other connected players appear as live low-poly peers on your map and in the world. `server.js` is a position relay; its header lists what to add for production (authority, interpolation, rooms, anti-cheat).

---

## Controls

| Action | Key |
|---|---|
| Move | `W A S D` |
| Look / Aim | Mouse |
| Fire | Left-click |
| Aim down / zoom | Right-click |
| Reload | `R` |
| Sprint | `Shift` |
| Jump | `Space` |
| Throw grenade | `G` |
| Enter / exit vehicle | `F` |
| Crouch | `C` |
| Full-screen map | `M` |
| Open shop (Black Market) | `B` |
| Vehicle garage | `V` |
| Mission contracts | `K` |
| Switch weapon | `1` – `4` |
| Pick up | `E` |
| Inventory | `Tab` |
| Pause | `Esc` |
| Camera zoom | Mouse wheel |

---

## What's in the build

- **Loading splash** with an animated *Heleo2 Studio* mark → main menu → settings → gameplay.
- **Bright low-poly open world**: hilly **vertex-coloured terrain** (procedural value-noise heightmap), three **biomes** (jungle / meadow / ruins), instanced trees, rocks, bushes, flowers, **houses with real PBR transparent glass**, stone **ruins**, and **water** that pools in the valleys.
- **Downtown city district** — an asphalt **road network** (lane markings + sidewalks + street lamps) and **real multi-storey buildings & skyscrapers** with procedural window facades that **light up at night**.
- **Living world** — wandering **deer** that bolt when startled, **flocking birds** overhead, **pedestrians** strolling the streets, **AI traffic** cruising the roads, drifting **clouds**, and a **star field** that fades in after dusk.
- **Wanted system** — GTA-style. Mowing down or gunning civilians raises a 5-star **wanted level**; police officers swarm in, scaling with the heat, and cool off if you lie low.
- **Dynamic weather** — Clear / Rain / Auto. Rain brings a particle downpour, thicker fog, a darker sky, and lightning flashes.
- **Cash economy + Black Market** — earn money from kills, spend it (press `B`) on weapons, ammo, armor, heals, grenades, or bribe away your wanted level.
- **Police cars & roadblocks** — flashing-siren cruisers chase you and parked roadblocks form across the streets at high heat.
- **Enterable buildings** — walk through the glowing OPEN doorways into shop interiors stocked with loot.
- **Full-screen map** (`M`) — the whole world with roads, city, water, and live blips for hostiles, police, loot and wildlife.
- **Cursor aiming (COD-on-web)** — the crosshair follows your mouse and bullets fire through it; push the cursor to a screen edge to turn. Click to lock the pointer for classic FPS mouselook.
- **Cash drops** — downed enemies and police drop pickup-able money bundles.
- **Vehicle garage** (`V`, on the garage pad) — spawn a sedan, sports car, truck or taxi.
- **Mission contracts** (`K`) — accept paid jobs (kills, headshots, cash, survival) tracked live on the HUD.
- **Customization** (main menu) — pick your operator, weapon finish (tints bullets too), and starting weapon.
- **Day / night cycle** — the sun arcs across the sky, tinting light, fog and sky colour; a clock shows the in-world time.
- **Third-person controller** — over-the-shoulder orbit camera, camera-relative movement, sprint + stamina, jump, terrain following, and a **procedurally-animated blocky character** (4 selectable variants).
- **Five weapons**: Pistol, full-auto Rifle, spread Shotgun, high-damage Sniper (zoom), and throwable **Grenades** with AoE. Magazines, reserve ammo, reloading, spread, recoil, headshots, hitmarkers.
- **Three enemy archetypes**: melee **Grunts**, **Shooters** that keep their distance and fire projectiles, and heavy **Brutes** — all animated, with scaling wave difficulty, loot drops, and a death topple.
- **Drivable vehicles** — press `F` near a car to get in; arcade throttle/steer with terrain-following slope tilt, spinning wheels, and run-over damage.
- **Ambient NPC villagers** wander the meadows and villages and flee from danger, giving the world life.
- **Boss every 5th wave** — a giant brute with a dedicated health bar and big rewards.
- **Kill-streak combo multiplier** that scales your score, **floating damage numbers** (gold crits on headshots), **crouch** for accuracy, a **sniper scope overlay**, and a **resupply pad** at spawn that heals and restocks ammo.
- **Inventory** (`Tab`), **quick-slots**, **radar minimap + compass + clock**, HP / Stamina / Armor vitals.
- **Procedural WebAudio** — gunfire, impacts, pickups, explosions, footsteps, plus a looping ambient wind bed.
- **Live settings**: graphics quality, shadows, day/night toggle, sensitivity, volume, FOV, world density.

### Performance
Designed to run on laptops / integrated graphics: props are **GPU-instanced**, world collision uses a cheap **circle-vs-circle** system (no per-mesh physics), and the Graphics-Quality setting scales terrain detail + render resolution.

### File layout
```
index.html        DOM, styles, loads the modules below
js/core.js        state, math, noise terrain (heightAt), collision
js/audio.js       procedural SFX + ambient bed
js/world.js       terrain, biomes, instanced props, day/night
js/entities.js    humanoid builder, player, enemies, projectiles, items
js/weapons.js     firearms, grenades, combat, inventory model
js/ui.js          HUD, minimap, inventory, menus, settings
js/net.js         multiplayer client
js/vehicles.js    drivable arcade vehicles
js/city.js        roads, buildings, skyscrapers, streetlights
js/traffic.js     autonomous AI cars driving the roads
js/wildlife.js    clouds, stars, deer, birds, pedestrians
js/weather.js     rain particles, fog, lightning
js/wanted.js      wanted level + police
js/policecars.js  pursuit cruisers, sirens, roadblocks
js/economy.js     cash + Black Market shop
js/map.js         full-screen world map
js/extras.js      cash drops, garage, contracts, customization
js/features.js    damage numbers, combo, boss, scope, resupply
js/game.js        engine boot, input, main loop, game flow
server.js         Node + ws multiplayer relay
```

---

## Reusable master prompt

Paste this to regenerate or extend the build from scratch:

> Build **VERDANT**, a single-page **third-person low-poly open-world survival game** on **Babylon.js only** (no three.js — they're competing engines). Bright, vibrant "stylized GTA / Monument-Valley" art direction. Ship a playable `index.html` plus a Node `ws` `server.js` for optional multiplayer.
>
> **World:** procedurally generated with a value-noise heightmap (`heightAt(x,z)`), flattened near spawn. Vertex-coloured hilly terrain. Three biomes — jungle (dense trees), meadow (sparse, flowers), ruins (stone columns/lintels). GPU-instance trees/rocks/bushes for performance. Houses from boxes + pyramid roofs + **PBR transparent glass** windows. A water plane that fills low basins. A full **day/night cycle** driving sun direction, light intensity, sky and fog colour, with a sun/moon disc and an in-world clock.
>
> **Collision:** lightweight circle-vs-circle on the XZ plane (store `{x,z,r}` colliders) + terrain-height following — do NOT use per-mesh physics (keeps integrated GPUs smooth).
>
> **Player:** over-the-shoulder orbit camera (mouse-look, wheel zoom, right-click ADS), camera-relative WASD, sprint+stamina, jump, terrain follow. A blocky humanoid built from boxes with hip/shoulder pivots and **procedural walk/idle animation**; 4 colour variants pickable at the menu.
>
> **Combat:** five weapons — Pistol, auto Rifle, spread Shotgun (multi-pellet), zoom Sniper, throwable Grenades (arc + AoE). Manual ray-vs-enemy hit detection (cheap, robust), magazines/reserve, reload, spread, recoil, headshots, hitmarkers.
>
> **Enemies:** Grunt (melee chaser), Shooter (keeps distance, fires projectiles), Brute (heavy). Ring-spawned waves, scaling HP/speed, loot drops (ammo/medkit/grenade/armor/weapons), score.
>
> **UI:** loading splash with an animated "Powered by Heleo2 Studio" mark; main menu; live settings (quality, shadows, day/night, sensitivity, volume, FOV, density); inventory (`Tab`); quick-slots; HP/Stamina/Armor vitals; **radar minimap + compass + clock**; toasts. Oswald + Outfit + Share Tech Mono type; bright paper/lime/gold/coral palette.
>
> **Audio:** procedural WebAudio SFX (per-weapon gunfire, impacts, pickups, explosions, footsteps) + a looping ambient wind bed.
>
> **Multiplayer:** WebSocket client wired in; a separate Node `ws` `server.js` position relay (`join` / `state` → `welcome` / `peers` / `leave`) rendering remote players as low-poly peers. Note that production needs authority, interpolation, rooms and anti-cheat.
>
> Keep it modular (split JS into core/audio/world/entities/weapons/ui/net/game), commented, and runnable by just opening `index.html`.

### Good next steps
- Rigged glTF character + weapon models (swap the box humanoid in `entities.js`).
- Animated enemy attack/death states and ragdolls.
- Vehicles, NPC villagers, and quest objectives for a fuller open world.
- Server-authoritative health/score and client interpolation in `net.js` / `server.js`.

---

© Heleo2 Studio — Babylon.js WebGL Engine.
