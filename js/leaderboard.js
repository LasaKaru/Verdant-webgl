"use strict";
/* =====================================================================
   VERDANT — leaderboard.js   (Phase 7b)
   Global high-score boards (Survival score, Deathmatch frags) served by
   the relay and persisted server-side. Always keeps a LOCAL board in
   localStorage too, so scores work offline and merge in when connected.
   Submit happens automatically on game over / match end.
   ===================================================================== */

const LB_LOCAL_MAX=20;
function lbKey(board){ return 'verdant_lb_'+board; }
function lbLoadLocal(board){ try{ return JSON.parse(localStorage.getItem(lbKey(board)))||[]; }catch(e){ return []; } }
function lbSaveLocal(board,arr){ try{ localStorage.setItem(lbKey(board), JSON.stringify(arr.slice(0,LB_LOCAL_MAX))); }catch(e){} }

/* submit a score to local + (if connected) the global board */
function submitScore(board, value, wave){
  board = (board==='dm')?'dm':'survival';
  value = Math.max(0, Math.floor(value||0));
  const name = (Game.net.name||'Operator');
  const arr = lbLoadLocal(board);
  arr.push({ name, value, wave:wave|0, ts:Date.now() });
  arr.sort((a,b)=>b.value-a.value); lbSaveLocal(board, arr);
  if(Game.net.connected && Game.net.ws && Game.net.ws.readyState===1){
    Game.net.ws.send(JSON.stringify({ t:'score', board, name, value, wave:wave|0 }));
  }
}
function netRequestLB(board){
  if(Game.net.connected && Game.net.ws && Game.net.ws.readyState===1)
    Game.net.ws.send(JSON.stringify({ t:'lb', board }));
}
function leaderboardReceived(m){
  Game.lbGlobal=Game.lbGlobal||{}; Game.lbGlobal[m.board]=m.list||[];
  if(Game.lbOpen && Game.lbTab===m.board) renderLeaderboard();
}

/* ------------------------- panel ------------------------- */
function openLeaderboard(){
  Game.lbOpen=true; Game.lbTab=Game.lbTab||'survival';
  show('leaderboard'); document.exitPointerLock&&document.exitPointerLock();
  netRequestLB('survival'); netRequestLB('dm');
  renderLeaderboard();
}
function closeLeaderboard(){ Game.lbOpen=false; hide('leaderboard'); if(Game.state==='playing') lockPointer(); }
function toggleLeaderboard(){ Game.lbOpen?closeLeaderboard():openLeaderboard(); }
function setLbTab(b){ Game.lbTab=b; netRequestLB(b); renderLeaderboard(); }
function renderLeaderboard(){
  const board=Game.lbTab||'survival';
  // tabs
  document.querySelectorAll('#lbTabs button').forEach(b=>b.classList.toggle('active', b.dataset.b===board));
  const src=$('lbSource');
  const global=(Game.lbGlobal&&Game.lbGlobal[board])||null;
  const usingGlobal = Game.net.connected && global;
  const list = usingGlobal ? global : lbLoadLocal(board);
  if(src) src.textContent = usingGlobal ? '🌐 GLOBAL' : '💾 LOCAL (connect for global)';
  const g=$('lbList'); if(!g) return; g.innerHTML='';
  if(!list.length){ g.innerHTML='<div class="inv-hint" style="padding:24px 0;">No scores yet — go set one.</div>'; return; }
  list.slice(0,20).forEach((e,i)=>{
    const row=document.createElement('div'); row.className='lbrow'+(i<3?' top':'');
    const sub = board==='dm' ? (e.value+' frags') : ('score '+e.value.toLocaleString()+(e.wave?(' · wave '+e.wave):''));
    row.innerHTML=`<span class="lbrank">${i+1}</span><span class="lbname">${escLB(e.name)}</span><span class="lbval">${sub}</span>`;
    g.appendChild(row);
  });
}
function escLB(s){ return String(s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c])); }
function initLeaderboard(){
  document.querySelectorAll('#lbTabs button').forEach(b=>b.onclick=()=>setLbTab(b.dataset.b));
}
