"use strict";
/* =====================================================================
   VERDANT — map.js
   Full-screen world map (toggle M). Draws the whole terrain footprint:
   water, roads, city blocks, houses, plus live blips for the player,
   hostiles, police, loot, vehicles and wildlife. Includes a legend.
   ===================================================================== */

function toggleMap(){ Game.mapOpen?closeMap():openMap(); }
function openMap(){
  if(Game.state!=='playing') return;
  Game.mapOpen=true; show('map'); document.exitPointerLock&&document.exitPointerLock();
  drawWorldMap();
  Game._mapTimer=setInterval(drawWorldMap,200);
}
function closeMap(){ Game.mapOpen=false; hide('map'); clearInterval(Game._mapTimer);
  if(Game.state==='playing') lockPointer(); }

function drawWorldMap(){
  const cv=$('worldmap'); if(!cv) return;
  const ctx=cv.getContext('2d'), W=cv.width, H=cv.height;
  const S=W/(WORLD*2);                       // world units → px
  const wx=x=>(x+WORLD)*S, wz=z=>(z+WORLD)*S;
  // backdrop
  ctx.fillStyle='#23402b'; ctx.fillRect(0,0,W,H);
  // biome wash (coarse)
  const step=WORLD*2/56;
  for(let x=-WORLD;x<WORLD;x+=step) for(let z=-WORLD;z<WORLD;z+=step){
    const h=heightAt(x+step/2,z+step/2);
    let col;
    if(h<-2.4) col='#2a5a6e';                 // water
    else { const b=biomeAt(x,z); col = b===0?'#1f4a26' : b===1?'#3e7a36' : '#5a563f'; }
    if(inCity(x,z)) col='#3a3f47';
    ctx.fillStyle=col; ctx.fillRect(wx(x),wz(z),Math.ceil(step*S)+1,Math.ceil(step*S)+1);
  }
  // roads
  ctx.strokeStyle='#11131a'; ctx.lineWidth=Math.max(2,4*S);
  (ROADS||[]).forEach(r=>{ ctx.beginPath(); ctx.moveTo(wx(r.x1),wz(r.z1)); ctx.lineTo(wx(r.x2),wz(r.z2)); ctx.stroke(); });
  ctx.strokeStyle='#3a3f47'; ctx.lineWidth=1;
  // city buildings
  ctx.fillStyle='#9aa6b5';
  (Game.cityBuildings||[]).forEach(b=>{ ctx.fillRect(wx(b.x)-2,wz(b.z)-2,4,4); });
  ctx.fillStyle='#7a8c7e';
  (Game.houses||[]).forEach(h=>{ ctx.fillRect(wx(h.x)-2,wz(h.z)-2,4,4); });
  // blips
  const blip=(x,z,col,r)=>{ ctx.fillStyle=col; ctx.beginPath(); ctx.arc(wx(x),wz(z),r,0,7); ctx.fill(); };
  (Game.items||[]).forEach(it=>blip(it.mesh.position.x,it.mesh.position.z,'#ffd23f',3));
  (Game.vehicles||[]).forEach(v=>blip(v.root.position.x,v.root.position.z,'#dfe6ee',3));
  (Game.traffic||[]).forEach(v=>blip(v.root.position.x,v.root.position.z,'#aeb8c4',2.5));
  (Game.deer||[]).forEach(d=>blip(d.root.position.x,d.root.position.z,'#c89a5b',2.5));
  (Game.villagers||[]).forEach(v=>blip(v.rig.root.position.x,v.rig.root.position.z,'#bfe0ff',2));
  (Game.enemies||[]).forEach(e=>blip(e.body.position.x,e.body.position.z, e.boss?'#ff2b2b':'#ff5a52', e.boss?6:4));
  (Game.police||[]).forEach(c=>blip(c.body.position.x,c.body.position.z,'#3b6bff',4));
  (Game.policeCars||[]).forEach(c=>blip(c.root.position.x,c.root.position.z,'#3b6bff',4));
  // resupply pad
  blip(0,0,'#3bd6a0',5);
  // player arrow
  const px=wx(Game.player.position.x), pz=wz(Game.player.position.z), a=Game.yaw;
  ctx.save(); ctx.translate(px,pz); ctx.rotate(-a);
  ctx.fillStyle='#fff'; ctx.beginPath(); ctx.moveTo(0,-8); ctx.lineTo(-6,7); ctx.lineTo(6,7); ctx.closePath(); ctx.fill();
  ctx.restore();
}
