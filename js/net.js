"use strict";
/* =====================================================================
   VERDANT — net.js
   WebSocket multiplayer client. Pairs with the bundled server.js relay.
   Protocol (JSON):
     →  {t:'join', name}
     →  {t:'state', x,y,z,ry,c}        (~12/s; c = character index)
     ←  {t:'welcome', id}
     ←  {t:'peers', list:[{id,name,x,y,z,ry,c}]}
     ←  {t:'leave', id}
   ===================================================================== */

function netConnect(url,name,room,group,mode){
  if(!url){ toast('ENTER A SERVER URL'); return; }
  try{ Game.net.ws=new WebSocket(url); }
  catch(e){ toast('BAD URL'); return; }
  Game.net.name=name;
  Game.room=(room&&room.trim())||'lobby';
  Game.group=(group&&group.trim())||'';
  Game.net.mode=['coop','dm','tdm'].includes(mode)?mode:'coop';
  const ws=Game.net.ws;
  ws.onopen=()=>{ Game.net.connected=true;
    ws.send(JSON.stringify({t:'join',name,c:Game.charIndex,room:Game.room,group:Game.group,mode:Game.net.mode}));
    setNetUI(true); toast('CONNECTED · ROOM '+Game.room+(Game.net.mode!=='coop'?(' · '+Game.net.mode.toUpperCase()):''));
    if(typeof addChatSystem==='function') addChatSystem('Connected to '+Game.room+(Game.group?(' · group '+Game.group):'')+'.');
    if(typeof updateChatHint==='function') updateChatHint();
  };
  ws.onclose=()=>{ Game.net.connected=false; setNetUI(false); clearPeers();
    if(typeof addChatSystem==='function') addChatSystem('Disconnected from server.');
    if(typeof updateChatHint==='function') updateChatHint(); };
  ws.onerror=()=>{ toast('CONNECTION FAILED — IS server.js RUNNING?'); };
  ws.onmessage=ev=>{
    let m; try{ m=JSON.parse(ev.data); }catch{ return; }
    if(m.t==='welcome'){ Game.net.id=m.id; }
    else if(m.t==='peers'){ if(m.mode) Game.net.mode=m.mode; syncPeers(m.list); }
    else if(m.t==='leave'){ removePeer(m.id); }
    else if(m.t==='frag'){ if(typeof pvpFrag==='function') pvpFrag(m); }
    else if(m.t==='respawn'){ if(typeof pvpRespawn==='function') pvpRespawn(m.id); }
    else if(m.t==='matchover'){ if(typeof pvpMatchOver==='function') pvpMatchOver(m); }
    else if(m.t==='lb'){ if(typeof leaderboardReceived==='function') leaderboardReceived(m); }
    else if(m.t==='enemies'){ if(typeof syncCoopEnemies==='function') syncCoopEnemies(m); }
    else if(m.t==='coopwave'){ if(typeof coopWave==='function') coopWave(m); }
    else if(m.t==='ekill'){ if(typeof coopKill==='function') coopKill(m); }
    else if(m.t==='edmg'){ if(typeof coopEdmg==='function') coopEdmg(m.dmg); }
    else if(m.t==='chat'){ if(m.id!==Game.net.id && typeof chatReceive==='function') chatReceive(m); }
    else if(m.t==='roominfo'){ if(typeof updateChatHint==='function') updateChatHint(m);
      if(m.event==='join'&&typeof addChatSystem==='function') addChatSystem((m.who||'A player')+' joined the room.');
      if(m.event==='leave'&&typeof addChatSystem==='function') addChatSystem((m.who||'A player')+' left the room.'); }
  };
}
function netChat(channel,text){
  const n=Game.net; if(!n.connected||!n.ws||n.ws.readyState!==1) return;
  const p=Game.player?Game.player.position:{x:0,z:0};
  n.ws.send(JSON.stringify({t:'chat',ch:channel,text:String(text).slice(0,160),x:p.x,z:p.z}));
}
let lastNet=0;
function netSend(){
  const n=Game.net; if(!n.connected||!n.ws||n.ws.readyState!==1) return;
  const now=performance.now(); if(now-lastNet<80) return; lastNet=now;
  const p=Game.player;
  n.ws.send(JSON.stringify({t:'state',x:p.position.x,y:p.position.y,z:p.position.z,ry:Game.yaw,c:Game.charIndex}));
}
function syncPeers(list){
  if(!Game.scene) return;
  for(const pr of list){
    if(pr.id===Game.net.id){ if(typeof applyOwnPvP==='function') applyOwnPvP(pr); continue; }
    let peer=Game.net.peers[pr.id];
    if(!peer){
      const rig=buildHumanoid(Game.scene, CHAR_VARIANTS[(pr.c||0)%CHAR_VARIANTS.length], 1.0, false, false);
      peer={ rig, mesh:rig.root, tx:pr.x, tz:pr.z, ty:pr.y, ry:pr.ry, phase:0, tag:null };
      Game.net.peers[pr.id]=peer;
    }
    peer.tx=pr.x; peer.ty=pr.y; peer.tz=pr.z; peer.ry=pr.ry;
    peer.hp=(pr.hp!=null?pr.hp:100); peer.team=pr.team||''; peer.alive=(pr.alive!==false);
    peer.name=pr.name; peer.score=pr.score||0;
  }
}
/* send a hit claim — the server validates & attributes the frag */
function netHit(targetId, dmg, weapon){
  const n=Game.net; if(!n.connected||!n.ws||n.ws.readyState!==1) return;
  n.ws.send(JSON.stringify({t:'hit',target:targetId,dmg:Math.round(dmg),weapon:weapon||''}));
}
function updatePeers(dt){
  for(const id in Game.net.peers){
    const pr=Game.net.peers[id];
    const m=pr.mesh;
    const moved=Math.hypot(pr.tx-m.position.x,pr.tz-m.position.z)>0.02;
    m.position.x=lerp(m.position.x,pr.tx,0.2);
    m.position.y=lerp(m.position.y,pr.ty,0.2);
    m.position.z=lerp(m.position.z,pr.tz,0.2);
    m.rotation.y=lerp(m.rotation.y,pr.ry,0.2);
    pr.phase+=dt*9;
    animateRig(pr.rig, moved, 1, pr.phase, false);
  }
}
function removePeer(id){ const p=Game.net.peers[id]; if(p){ p.rig.root.dispose(false,true); if(p.tag) p.tag.remove(); delete Game.net.peers[id]; } }
function clearPeers(){ Object.keys(Game.net.peers).forEach(removePeer); }
function setNetUI(on){
  ['netDot','hudNet'].forEach(id=>$(id)&&$(id).classList.toggle('on',on));
  const ns=$('netStat'); if(ns) ns.textContent = on?('Connected as '+Game.net.name):'Offline — single player';
  const ht=$('hudNetTxt'); if(ht) ht.textContent = on?'ONLINE':'SOLO';
}
