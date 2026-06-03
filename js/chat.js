"use strict";
/* =====================================================================
   VERDANT — chat.js
   In-game live chat with four channels:
     GLOBAL  — everyone online (across rooms)
     ROOM    — players in your current room/server
     GROUP   — your private party (group code)
     LOCAL   — proximity: only players physically near you
   Works offline too (local echo + system messages); networked when a
   multiplayer relay is connected. Open with ↵ / T, ⇥ cycles channel.
   ===================================================================== */

const CHAT_CHANNELS=['global','room','group','local'];
const CHAT_LABEL={ global:'GLOBAL', room:'ROOM', group:'GROUP', local:'LOCAL' };
const CHAT_MAXLINES=80;

function initChat(){
  Game.chat=Game.chat||{ channel:'global', log:[], typing:false };
  const inp=$('chatInput'), btn=$('chatChanBtn');
  if(btn) btn.onclick=()=>{ cycleChatChannel(); $('chatInput').focus(); };
  if(inp){
    inp.addEventListener('keydown',e=>{
      e.stopPropagation();
      const k=e.key.toLowerCase();
      if(k==='enter'){ e.preventDefault(); sendCurrentChat(); }
      else if(k==='escape'){ e.preventDefault(); closeChat(); }
      else if(k==='tab'){ e.preventDefault(); cycleChatChannel(); }
    });
  }
  refreshChatChanBtn();
  updateChatHint();
}
function refreshChatChanBtn(){
  const btn=$('chatChanBtn'); if(!btn) return;
  const ch=Game.chat.channel;
  btn.textContent=CHAT_LABEL[ch];
  btn.style.background = ch==='global'?'#4fd2e6' : ch==='room'?'#ffd23f' : ch==='group'?'#86e04a' : '#f3f7ee';
}
function cycleChatChannel(){
  const i=CHAT_CHANNELS.indexOf(Game.chat.channel);
  Game.chat.channel=CHAT_CHANNELS[(i+1)%CHAT_CHANNELS.length];
  refreshChatChanBtn();
}
function openChat(){
  if(Game.state!=='playing'||overlayOpen()) return;
  Game.chat.typing=true; Game.keys={}; Game.mouseDown=false;   // stop movement/fire while typing
  const bar=$('chatBar'); if(bar) bar.classList.add('show');
  const inp=$('chatInput'); if(inp){ inp.value=''; setTimeout(()=>inp.focus(),0); }
}
function closeChat(){
  Game.chat.typing=false;
  const bar=$('chatBar'); if(bar) bar.classList.remove('show');
  const inp=$('chatInput'); if(inp) inp.blur();
}
function sendCurrentChat(){
  const inp=$('chatInput'); if(!inp) return;
  const text=inp.value.trim();
  if(text){ chatSay(Game.chat.channel, text); }
  closeChat();
}

/* say on a channel: local echo + relay if connected */
function chatSay(channel, text){
  const name=Game.net.name||'You';
  addChatLine({ ch:channel, name, text, me:true });
  if(Game.net.connected){ if(typeof netChat==='function') netChat(channel, text); }
  else if(channel!=='local'){ addChatSystem('You are offline — connect via Multiplayer to reach other players.'); }
}

/* render a received/echoed message */
function chatReceive(m){
  if(m.ch==='local'){
    // proximity filter — only show senders physically near the player
    const p=Game.player&&Game.player.position;
    if(p && m.x!=null){ if(Math.hypot(m.x-p.x, m.z-p.z) > 34) return; }
  }
  addChatLine({ ch:m.ch, name:m.name||'Player', text:m.text||'', me:false });
}

function addChatSystem(text){ addChatLine({ ch:'system', text, system:true }); }
function addChatLine(o){
  const log=$('chatLog'); if(!log) return;
  const div=document.createElement('div');
  div.className='chatline '+(o.system?'system':('chat-'+(o.ch==='global'?'g':o.ch)));
  const tag = o.system?'' : `<span class="tag">[${(CHAT_LABEL[o.ch]||'').slice(0,1)}]</span>`;
  const who = o.system?'' : `<span class="who">${escapeChat(o.name)}${o.me?' (you)':''}:</span> `;
  div.innerHTML = tag + who + `<span class="msg">${escapeChat(o.text)}</span>`;
  log.appendChild(div);
  Game.chat.log.push(o);
  while(log.children.length>CHAT_MAXLINES) log.removeChild(log.firstChild);
  log.scrollTop=log.scrollHeight;
}
function escapeChat(s){ return String(s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c])); }

/* update the persistent hint with room + online counts */
function updateChatHint(info){
  const el=$('chatHint'); if(!el) return;
  if(Game.net.connected){
    const rc=info&&info.count!=null?info.count:'–', gc=info&&info.global!=null?info.global:'–';
    el.innerHTML=`↵ Chat · ⇥ Channel &nbsp;|&nbsp; ROOM <b>${escapeChat(Game.room)}</b> · ${rc} here · ${gc} online`;
  } else {
    el.innerHTML='↵ Chat · ⇥ Channel &nbsp;|&nbsp; <span style="opacity:.7">offline — connect in Multiplayer</span>';
  }
}
