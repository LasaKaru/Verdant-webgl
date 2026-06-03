"use strict";
/* =====================================================================
   VERDANT — pvp.js   (Phase 7: PvP client)
   Drives the player-vs-player arena on top of the authoritative relay:
   peer nametags + health bars, scoreboard, kill feed, server-driven
   damage/death/respawn, and shooting other players (hits are validated
   server-side). Modes: Deathmatch (dm) and Team Deathmatch (tdm).
   ===================================================================== */

const TEAM_COL={ red:'#ff5a52', blue:'#4f9fff', '':'#ffd23f' };
function isPvP(){ return Game.net.connected && (Game.net.mode==='dm'||Game.net.mode==='tdm'); }

/* called when a run starts in a PvP room */
function setupPvP(){
  Game.maxHP=100; Game.playerData={hp:100,stamina:100,armor:0}; refreshHP(); refreshArmor();
  Game.pvpDead=false; hideRespawn();
  $('objText').textContent = Game.net.mode==='tdm'?'TEAM DEATHMATCH':'DEATHMATCH';
  $('pvpBoard').style.display='block';
  toast(Game.net.mode==='tdm'?'TEAM DEATHMATCH — frag the enemy team':'DEATHMATCH — first to 20 frags');
}
function teardownPvP(){ const b=$('pvpBoard'); if(b) b.style.display='none'; $('peerTags').innerHTML=''; hideRespawn(); }

/* nearest alive peer to the crosshair — the PvP aim target */
function pvpTarget(maxRange){
  if(!isPvP()) return null;
  const e=Game.engine, vw=e.getRenderWidth(), vh=e.getRenderHeight();
  const ax=(Game.aimPx!=null?Game.aimPx:vw/2), ay=(Game.aimPy!=null?Game.aimPy:vh/2);
  const vp=new BABYLON.Viewport(0,0,vw,vh), mat=Game.scene.getTransformMatrix();
  let best=null,bestId=null,bestPx=Math.max(200,vw*0.20);
  for(const id in Game.net.peers){
    const pr=Game.net.peers[id]; if(!pr.alive) continue;
    const m=pr.mesh, wp=new BABYLON.Vector3(m.position.x,m.position.y+1.2,m.position.z);
    if(BABYLON.Vector3.Distance(Game.camera.position,wp)>(maxRange||9999)) continue;
    const p=BABYLON.Vector3.Project(wp,BABYLON.Matrix.Identity(),mat,vp);
    if(p.z<0||p.z>1) continue;
    const d=Math.hypot(p.x-ax,p.y-ay);
    if(d<bestPx){ bestPx=d; best=pr; bestId=+id; }
  }
  return best?{id:bestId,pos:best.mesh.position,peer:best}:null;
}

/* ------------------------- server-driven local state ------------------------- */
function applyOwnPvP(pr){                 // pr = my own entry in the peers snapshot
  if(!isPvP()) return;
  Game.maxHP=100; Game._myScore=pr.score||0; Game._myTeam=pr.team||'';
  Game.playerData.hp=pr.hp; refreshHP();
  if(!pr.alive && !Game.pvpDead) onLocalDeath();
}
function onLocalDeath(){
  Game.pvpDead=true; Game.mouseDown=false; Game.aiming=false;
  showRespawn('ELIMINATED', 'Respawning…');
  sfx('hurt');
}
function pvpRespawn(id){
  if(id!==Game.net.id) return;
  Game.pvpDead=false; hideRespawn();
  // drop in at a fresh spawn point
  const a=rand(0,Math.PI*2), r=rand(20,70);
  const x=clamp(Math.cos(a)*r,-WORLD+5,WORLD-5), z=clamp(Math.sin(a)*r,-WORLD+5,WORLD-5);
  Game.player.position.set(x,heightAt(x,z),z); Game.vy=0;
  Game.playerData.hp=Game.maxHP=100; refreshHP();
  toast('RESPAWNED');
}
function pvpFrag(m){
  addKillFeed(m.killer, m.victim, m.weapon);
  if(m.kid===Game.net.id){ Game.score=(Game.score||0); toast('✚ FRAGGED '+m.victim); sfx('kill'); }
  if(m.vid===Game.net.id) onLocalDeath();
}
function pvpMatchOver(m){
  bigToast('MATCH OVER', m.winner+' wins · '+m.score+' frags');
  showRespawn('MATCH OVER', m.winner+' wins');
  if(typeof submitScore==='function') submitScore('dm', Game._myScore||0);
  setTimeout(hideRespawn, 4000);
}

/* ------------------------- HUD: respawn banner ------------------------- */
function showRespawn(l1,l2){ const b=$('respawnBanner'); if(!b) return;
  b.querySelector('.rl1').textContent=l1; b.querySelector('.rl2').textContent=l2; b.classList.add('show'); }
function hideRespawn(){ const b=$('respawnBanner'); if(b) b.classList.remove('show'); }

/* ------------------------- kill feed ------------------------- */
function addKillFeed(killer,victim,weapon){
  const kf=$('killfeed'); if(!kf) return;
  const d=document.createElement('div'); d.className='kfline';
  d.innerHTML=`<span class="kfk">${esc(killer)}</span> <span class="kfw">▸</span> <span class="kfv">${esc(victim)}</span>`;
  kf.appendChild(d);
  while(kf.children.length>6) kf.removeChild(kf.firstChild);
  setTimeout(()=>{ d.style.opacity='0'; setTimeout(()=>d.remove(),400); }, 5000);
}
function esc(s){ return String(s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c])); }

/* ------------------------- per-frame: tags + board ------------------------- */
function updatePvP(){
  if(!isPvP()){ const b=$('pvpBoard'); if(b&&b.style.display!=='none') teardownPvP(); return; }
  const wrap=$('peerTags'); if(!wrap) return;
  // nametags + health bars over peers
  for(const id in Game.net.peers){
    const pr=Game.net.peers[id];
    if(!pr.tag){ const t=document.createElement('div'); t.className='ptag';
      t.innerHTML=`<span class="pnm"></span><span class="phb"><i></i></span>`; wrap.appendChild(t); pr.tag=t; }
    const head=new BABYLON.Vector3(pr.mesh.position.x, pr.mesh.position.y+2.3, pr.mesh.position.z);
    const s=projectToScreen(head);
    if(s.behind || !pr.alive){ pr.tag.style.display='none'; }
    else { pr.tag.style.display='block'; pr.tag.style.left=s.x+'px'; pr.tag.style.top=s.y+'px';
      const nm=pr.tag.querySelector('.pnm'); nm.textContent=pr.name||'Player'; nm.style.color=TEAM_COL[pr.team||''];
      pr.tag.querySelector('.phb>i').style.width=Math.max(0,(pr.hp||0))+'%';
    }
  }
  renderScoreboard();
}
function renderScoreboard(){
  const el=$('pvpBoard'); if(!el) return;
  const rows=[{ id:Game.net.id, name:(Game.net.name||'You')+' (you)', team:myTeam(), score:myScore(), me:true }];
  for(const id in Game.net.peers){ const pr=Game.net.peers[id]; rows.push({ id:+id, name:pr.name||'Player', team:pr.team||'', score:pr.score||0 }); }
  rows.sort((a,b)=>b.score-a.score);
  if(Game.net.mode==='tdm'){
    const red=rows.filter(r=>r.team==='red').reduce((s,r)=>s+r.score,0);
    const blue=rows.filter(r=>r.team==='blue').reduce((s,r)=>s+r.score,0);
    el.innerHTML=`<div class="sbteam"><span style="color:${TEAM_COL.red}">RED ${red}</span> · <span style="color:${TEAM_COL.blue}">BLUE ${blue}</span></div>`+
      rows.slice(0,8).map(r=>sbRow(r)).join('');
  } else {
    el.innerHTML=`<div class="sbteam">DEATHMATCH · first to 20</div>`+rows.slice(0,8).map(r=>sbRow(r)).join('');
  }
}
function sbRow(r){ return `<div class="sbrow${r.me?' me':''}"><span class="sbn" style="color:${TEAM_COL[r.team||'']}">${esc(r.name)}</span><span class="sbs">${r.score}</span></div>`; }
function myTeam(){ return Game._myTeam||''; }
function myScore(){ return Game._myScore||0; }
