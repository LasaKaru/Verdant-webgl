"use strict";
/* =====================================================================
   VERDANT — audio.js
   Procedural WebAudio: one-shot SFX + a looping ambient bed (wind +
   filtered noise) so the world never feels silent. No asset files needed.
   ===================================================================== */

let _amb = null;

function initAudio(){
  try{ Game.audio = new (window.AudioContext||window.webkitAudioContext)(); }
  catch(e){ Game.audio=null; }
}

function masterGain(){ return Game.settings.volume; }

function sfx(type){
  const ac = Game.audio;
  if(!ac || masterGain()<=0) return;
  const t = ac.currentTime;
  const o = ac.createOscillator(), g = ac.createGain();
  o.connect(g); g.connect(ac.destination);
  let f=440, dur=.08, vol=masterGain()*0.22, slideTo=null;
  switch(type){
    case 'pistol':  f=340; dur=.10; o.type='square';   slideTo=120; break;
    case 'rifle':   f=260; dur=.06; o.type='sawtooth'; slideTo=110; break;
    case 'shotgun': f=150; dur=.18; o.type='sawtooth'; slideTo=60;  vol*=1.3; break;
    case 'sniper':  f=520; dur=.22; o.type='square';   slideTo=70;  vol*=1.2; break;
    case 'hit':     f=760; dur=.05; o.type='triangle'; break;
    case 'kill':    f=480; dur=.20; o.type='sine';     slideTo=900; break;
    case 'reload':  f=180; dur=.10; o.type='sine';     break;
    case 'pickup':  f=720; dur=.13; o.type='sine';     slideTo=1300; break;
    case 'hurt':    f=140; dur=.18; o.type='sawtooth'; slideTo=48; vol*=1.3; break;
    case 'jump':    f=300; dur=.10; o.type='sine';     slideTo=540; vol*=.7; break;
    case 'explode': f=90;  dur=.42; o.type='sawtooth'; slideTo=30; vol*=1.6; break;
    case 'wave':    f=300; dur=.5;  o.type='triangle'; slideTo=600; break;
    case 'throw':   f=400; dur=.12; o.type='sine';     slideTo=700; vol*=.6; break;
    case 'click':   f=600; dur=.04; o.type='square';   vol*=.5; break;
    case 'enemyfire':f=220;dur=.07; o.type='square';   slideTo=90; vol*=.6; break;
  }
  o.frequency.setValueAtTime(f,t);
  if(slideTo) o.frequency.exponentialRampToValueAtTime(slideTo,t+dur);
  g.gain.setValueAtTime(vol,t);
  g.gain.exponentialRampToValueAtTime(0.0001,t+dur);
  o.start(t); o.stop(t+dur);
  // shotgun / explosion noise burst
  if(type==='shotgun'||type==='explode'){
    const n=noiseBurst(dur*0.7, vol*0.8); if(n) n();
  }
}

function noiseBurst(dur, vol){
  const ac=Game.audio; if(!ac) return null;
  return ()=>{
    const t=ac.currentTime;
    const buf=ac.createBuffer(1, ac.sampleRate*dur, ac.sampleRate);
    const d=buf.getChannelData(0);
    for(let i=0;i<d.length;i++) d[i]=(Math.random()*2-1)*(1-i/d.length);
    const src=ac.createBufferSource(); src.buffer=buf;
    const g=ac.createGain(); g.gain.setValueAtTime(vol,t); g.gain.exponentialRampToValueAtTime(0.0001,t+dur);
    const lp=ac.createBiquadFilter(); lp.type='lowpass'; lp.frequency.value=1800;
    src.connect(lp); lp.connect(g); g.connect(ac.destination); src.start(t);
  };
}

function footstep(){
  const ac=Game.audio; if(!ac||masterGain()<=0) return;
  const t=ac.currentTime;
  const o=ac.createOscillator(), g=ac.createGain();
  o.type='sine'; o.frequency.setValueAtTime(90,t); o.frequency.exponentialRampToValueAtTime(55,t+.07);
  g.gain.setValueAtTime(masterGain()*0.10,t); g.gain.exponentialRampToValueAtTime(0.0001,t+.08);
  o.connect(g); g.connect(ac.destination); o.start(t); o.stop(t+.08);
}

/* ambient wind bed — looping filtered noise with a slow LFO on the filter */
function startAmbient(){
  const ac=Game.audio; if(!ac||_amb) return;
  const buf=ac.createBuffer(1, ac.sampleRate*4, ac.sampleRate);
  const d=buf.getChannelData(0);
  for(let i=0;i<d.length;i++) d[i]=Math.random()*2-1;
  const src=ac.createBufferSource(); src.buffer=buf; src.loop=true;
  const lp=ac.createBiquadFilter(); lp.type='lowpass'; lp.frequency.value=420; lp.Q.value=0.6;
  const g=ac.createGain(); g.gain.value=masterGain()*0.10;
  const lfo=ac.createOscillator(); lfo.frequency.value=0.08;
  const lfoG=ac.createGain(); lfoG.gain.value=180;
  lfo.connect(lfoG); lfoG.connect(lp.frequency);
  src.connect(lp); lp.connect(g); g.connect(ac.destination);
  src.start(); lfo.start();
  _amb={ g, lp };
}
function setAmbientVolume(){ if(_amb) _amb.g.gain.value = masterGain()*0.10; }

/* police siren — two-tone wail that loops while cruisers are active */
let _siren=null;
function startSiren(){
  const ac=Game.audio; if(!ac||_siren) return;
  const o=ac.createOscillator(), g=ac.createGain(), lfo=ac.createOscillator(), lfoG=ac.createGain();
  o.type='sawtooth'; o.frequency.value=700;
  lfo.type='sine'; lfo.frequency.value=1.4; lfoG.gain.value=260;
  lfo.connect(lfoG); lfoG.connect(o.frequency);
  g.gain.value=masterGain()*0.05;
  o.connect(g); g.connect(ac.destination); o.start(); lfo.start();
  _siren={o,g,lfo};
}
function stopSiren(){ if(_siren){ try{_siren.o.stop(); _siren.lfo.stop();}catch(e){} _siren=null; } }
function setSirenVolume(){ if(_siren) _siren.g.gain.value=masterGain()*0.05; }
