"use strict";
/* =====================================================================
   VERDANT — core.js
   Global state, math helpers, procedural noise terrain + biome sampling,
   and a lightweight circle-vs-circle collision system (far cheaper than
   Babylon mesh collisions — keeps us smooth on integrated GPUs).
   ===================================================================== */

const WORLD = 340;      // half-extent of the playable square (big, endless-feeling)
const ELEV  = 26;       // hill amplitude

// Downtown sits on a flattened plateau in the NE quadrant.
const CITY = { x:64, z:64, r:42, y:2.5 };
function inCity(x,z,pad){ return Math.hypot(x-CITY.x,z-CITY.z) < CITY.r-(pad||0); }
// Road network (centerlines). Each: {x1,z1,x2,z2,w}.
let ROADS = [];
function buildRoadNetwork(){
  ROADS=[];
  const cx=CITY.x, cz=CITY.z, g=16;          // city grid spacing
  for(let i=-2;i<=2;i++){
    ROADS.push({x1:cx+i*g,z1:cz-CITY.r,x2:cx+i*g,z2:cz+CITY.r,w:5});  // N-S streets
    ROADS.push({x1:cx-CITY.r,z1:cz+i*g,x2:cx+CITY.r,z2:cz+i*g,w:5});  // E-W streets
  }
  ROADS.push({x1:0,z1:0,x2:cx,z2:cz,w:7});   // avenue from spawn to downtown
}
function distToSeg(px,pz,x1,z1,x2,z2){
  const dx=x2-x1, dz=z2-z1, l2=dx*dx+dz*dz;
  let t = l2>0 ? ((px-x1)*dx+(pz-z1)*dz)/l2 : 0; t=clamp(t,0,1);
  return Math.hypot(px-(x1+dx*t), pz-(z1+dz*t));
}
function onRoad(x,z){ for(const r of ROADS){ if(distToSeg(x,z,r.x1,r.z1,r.x2,r.z2)<r.w*0.5) return true; } return false; }

const Game = {
  state: 'loading',
  settings: { quality:'med', shadows:true, cycle:true, sens:1.2, volume:0.55, fov:74*Math.PI/180, density:140, weatherMode:'auto', healthbars:true,
              difficulty:'normal', renderDist:0.55, invertY:false, autoSprint:false, fps:false },
  scene:null, engine:null, camera:null, sun:null, hemi:null, shadowGen:null,
  player:null, playerRoot:null, playerData:null, charIndex:0,
  enemies:[], items:[], projectiles:[], grenades:[], decals:[], houses:[], vehicles:[], villagers:[],
  inVehicle:null,
  colliders:[],                       // {x,z,r} static world collision
  yaw:0, pitch:0.45, vy:0, grounded:true, aiming:false, camDist:7,
  score:0, wave:0, waveActive:false, enemiesToSpawn:0, betweenWaves:false,
  weapons:null, currentWeapon:0, inventory:[], grenadeCount:3,
  keys:{}, mouseDown:false,
  time:0.32,                          // 0..1 day fraction (0.32 ≈ mid-morning)
  net:{ ws:null, connected:false, id:null, name:'Operator', peers:{}, mode:'coop' },
  walkPhase:0,
  combo:{ count:0, mult:1, timer:0 }, boss:null, crouching:false, resupplyT:0, onPad:false,
  traffic:[], police:[], wanted:0, wantedTimer:0, weather:'clear', weatherTimer:0,
  policeCars:[], roadblocks:[], money:250, mapOpen:false, shopOpen:false, interiors:[],
  cursorN:{x:0,y:0}, aimPx:null, aimPy:null,
  moneyDrops:[], garageOpen:false, contractsOpen:false, contract:null, contractOffers:[], custom:null, wantLock:false,
  rockets:[], killCount:0, windmills:[], xLamps:[], xFires:[], crystals:[], fireflies:[],
  chat:{ channel:'global', log:[], typing:false }, room:'lobby', group:'',
  cheats:{ god:false, infAmmo:false }, codesOpen:false, missionsOpen:false,
  missions:null, missionStats:{ kills:0, bosses:0, cashEarned:0, waves:0, drives:0, nadeKills:0 },
  xp:null, level:1, skillPoints:0, perks:{}, maxHP:100, achievements:null, skillsOpen:false,
  pvpDead:false, lbOpen:false, lbTab:'survival', lbGlobal:null, coopEnemies:{},
  savesOpen:false, photo:false, photoYaw:0, photoPitch:0.3,
};
const DIFF={ easy:{spawn:0.7, dmg:0.55, cap:7}, normal:{spawn:1, dmg:1, cap:9}, hard:{spawn:1.4, dmg:1.7, cap:13} };
function diff(){ return DIFF[Game.settings.difficulty]||DIFF.normal; }

/* ------------------------- DOM helpers ------------------------- */
const $ = id => document.getElementById(id);
const show = id => $(id).classList.add('show');
const hide = id => $(id).classList.remove('show');
function setState(s){
  Game.state = s;
  ['loader','menu','settings','mp','howto','pause','over','inv','shop','map','garage','contracts','customize','missions','codes','skills','leaderboard','saves'].forEach(hide);
  $('hud').classList.remove('show');
  if(s==='menu'){ show('menu'); if(typeof renderMenuStats==='function') renderMenuStats(); }
  else if(s==='settings') show('settings');
  else if(s==='mp') show('mp');
  else if(s==='howto') show('howto');
  else if(s==='customize') show('customize');
  else if(s==='paused') show('pause');
  else if(s==='over') show('over');
  else if(s==='playing'){ $('hud').classList.add('show'); }
}

/* ------------------------- Math ------------------------- */
function rand(a,b){ return a + Math.random()*(b-a); }
function clamp(v,a,b){ return v<a?a:v>b?b:v; }
function lerp(a,b,t){ return a+(b-a)*t; }
function smoothstep(e0,e1,x){ const t=clamp((x-e0)/(e1-e0),0,1); return t*t*(3-2*t); }

/* ------------------------- Value noise + fbm ------------------------- */
function fract(n){ return n-Math.floor(n); }
function hash2(x,z){ return fract(Math.sin(x*127.1+z*311.7)*43758.5453); }
function vnoise(x,z){
  const xi=Math.floor(x), zi=Math.floor(z), xf=x-xi, zf=z-zi;
  const u=xf*xf*(3-2*xf), v=zf*zf*(3-2*zf);
  const a=hash2(xi,zi), b=hash2(xi+1,zi), c=hash2(xi,zi+1), d=hash2(xi+1,zi+1);
  return a + (b-a)*u + (c-a)*v + (a-b-c+d)*u*v;
}
function fbm(x,z){
  let amp=1, freq=1, sum=0, norm=0;
  for(let o=0;o<4;o++){ sum+=amp*vnoise(x*freq,z*freq); norm+=amp; amp*=0.5; freq*=2; }
  return sum/norm;
}

/* ------------------------- Terrain ------------------------- */
// Continuous terrain height. Flattened near spawn so the player starts level.
function heightAt(x,z){
  const base   = fbm(x*0.011+13.5, z*0.011+7.2);          // rolling hills 0..1
  const detail = (fbm(x*0.05-4, z*0.05+9)-0.5)*0.18;       // bumps
  let h = (base-0.5)*ELEV + detail*ELEV;
  // endless mountain ranges — a low-frequency mask raises tall peaks
  // scattered across the whole map, so the big world stays grand everywhere.
  const mask = fbm(x*0.0042+100, z*0.0042+100);
  h += Math.max(0, mask-0.54) * 230;
  // ridge near the eastern edge for a backdrop
  h += smoothstep(70,120, x) * 14;
  // big mountains in the far corners (gaussian peaks)
  h += 60*Math.exp(-(((x+96)*(x+96))+((z+96)*(z+96)))/(2*44*44));   // NW massif
  h += 42*Math.exp(-(((x-94)*(x-94))+((z+90)*(z+90)))/(2*30*30));   // SE peak
  h += 30*Math.exp(-(((x+92)*(x+92))+((z-86)*(z-86)))/(2*26*26));   // NE peak
  // carved pits / craters (dry depressions)
  h -= 13*Math.exp(-(((x+54)*(x+54))+((z-44)*(z-44)))/(2*12*12));
  h -= 11*Math.exp(-(((x-36)*(x-36))+((z+58)*(z+58)))/(2*10*10));
  // flatten central spawn pad
  const d = Math.hypot(x,z);
  h *= smoothstep(6,30,d) * 0.85 + 0.15;
  // downtown plateau — blend terrain toward a flat city floor
  const cd = Math.hypot(x-CITY.x, z-CITY.z);
  if(cd < CITY.r+6){ const k=smoothstep(CITY.r+6, CITY.r-14, cd); h = lerp(h, CITY.y, k); }
  return h;
}
// Approx surface normal for slope-aware placement / lighting feel.
function slopeAt(x,z){
  const e=1.5;
  const hl=heightAt(x-e,z), hr=heightAt(x+e,z), hd=heightAt(x,z-e), hu=heightAt(x,z+e);
  return Math.hypot(hr-hl, hu-hd)/(2*e); // 0 flat .. larger = steeper
}

/* ------------------------- Biomes ------------------------- */
// 0 = jungle (dense), 1 = meadow/clearing, 2 = ruins/rocky
function biomeAt(x,z){
  const b = fbm(x*0.0075+50, z*0.0075+50);
  if(b < 0.42) return 0;
  if(b < 0.72) return 1;
  return 2;
}

/* ------------------------- Collision ------------------------- */
function addCollider(x,z,r){ Game.colliders.push({x,z,r}); }
// Push a 2D point (with radius) out of any overlapping static collider + world bounds.
function resolveCollision(pos, radius){
  for(const c of Game.colliders){
    const dx=pos.x-c.x, dz=pos.z-c.z;
    const dd=Math.hypot(dx,dz), min=radius+c.r;
    if(dd<min && dd>0.0001){ const push=min-dd; pos.x+=dx/dd*push; pos.z+=dz/dd*push; }
  }
  pos.x=clamp(pos.x,-WORLD+3,WORLD-3);
  pos.z=clamp(pos.z,-WORLD+3,WORLD-3);
}
