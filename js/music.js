"use strict";
/* =====================================================================
   VERDANT — music.js   (Phase 3: dynamic music)
   A procedural WebAudio score with two intensity layers that crossfade
   based on combat: a calm exploration pad (slow chord drones) and a
   combat layer (driving bass pulse + arpeggio). No audio files needed.
   Intensity rises with nearby enemies / wanted level and falls when calm.
   ===================================================================== */

let _music=null, _musicIntensity=0;

const CHORDS=[ [130.81,164.81,196.00], [110.00,138.59,164.81],   // C-ish, A-ish
               [146.83,174.61,220.00], [98.00,123.47,146.83] ];  // D-ish, G-ish
let _chordIdx=0, _chordTimer=0, _arpTimer=0, _arpStep=0, _bassTimer=0;

function startMusic(){
  const ac=Game.audio; if(!ac||_music) return;
  const master=ac.createGain(); master.gain.value=0; master.connect(ac.destination);
  const calmGain=ac.createGain(); calmGain.gain.value=1; calmGain.connect(master);
  const combatGain=ac.createGain(); combatGain.gain.value=0; combatGain.connect(master);
  // calm pad: three detuned drones through a soft lowpass
  const lp=ac.createBiquadFilter(); lp.type='lowpass'; lp.frequency.value=900; lp.connect(calmGain);
  const drones=CHORDS[0].map(f=>{
    const o=ac.createOscillator(), g=ac.createGain();
    o.type='triangle'; o.frequency.value=f; g.gain.value=0.05;
    o.connect(g); g.connect(lp); o.start(); return {o,g};
  });
  _music={ master, calmGain, combatGain, drones, lp };
  setMusicVolume();
}
function setMusicVolume(){ if(_music) _music.master.gain.value=(Game.settings.volume||0)*(Game.settings.music===false?0:0.5); }
function stopMusic(){ if(_music){ try{ _music.drones.forEach(d=>d.o.stop()); }catch(e){} _music=null; } }

/* one-shot combat voices, scheduled from the update loop */
function _pluck(freq,vol,dur,type){
  const ac=Game.audio; if(!ac||!_music) return;
  const t=ac.currentTime, o=ac.createOscillator(), g=ac.createGain();
  o.type=type||'square'; o.frequency.value=freq;
  g.gain.setValueAtTime(vol,t); g.gain.exponentialRampToValueAtTime(0.0001,t+dur);
  o.connect(g); g.connect(_music.combatGain); o.start(t); o.stop(t+dur);
}

/* intensity 0..1 from game state */
function musicIntensityTarget(){
  if(Game.state!=='playing') return 0;
  let near=0;
  const p=Game.player&&Game.player.position; if(!p) return 0;
  for(const e of Game.enemies){ if(BABYLON.Vector3.Distance(p,e.body.position)<45) near++; }
  for(const id in (Game.coopEnemies||{})){ const m=Game.coopEnemies[id].mesh;
    if(BABYLON.Vector3.Distance(p,m.position)<45) near++; }
  let t=Math.min(1, near/4);
  if(Game.wanted>0) t=Math.max(t, Math.min(1,Game.wanted/3));
  if(Game.boss) t=1;
  return t;
}

function updateMusic(dt){
  if(!_music||!Game.audio) return;
  const target=musicIntensityTarget();
  _musicIntensity=lerp(_musicIntensity,target, Math.min(1,dt*(target>_musicIntensity?1.8:0.4)));
  const I=_musicIntensity;
  _music.calmGain.gain.value=0.9-(I*0.55);
  _music.combatGain.gain.value=I;
  _music.lp.frequency.value=900+I*2200;

  // slow chord changes on the pad
  _chordTimer-=dt;
  if(_chordTimer<=0){ _chordTimer=8+Math.random()*6;
    _chordIdx=(_chordIdx+1)%CHORDS.length;
    const ch=CHORDS[_chordIdx], ac=Game.audio;
    _music.drones.forEach((d,i)=>{ try{ d.o.frequency.linearRampToValueAtTime(ch[i%ch.length], ac.currentTime+2.5); }catch(e){} });
  }
  if(I>0.12){
    // bass pulse — tempo scales with intensity
    _bassTimer-=dt;
    if(_bassTimer<=0){ _bassTimer=lerp(0.62,0.31,I);
      _pluck(CHORDS[_chordIdx][0]/2, 0.12*I, 0.22, 'sawtooth'); }
    // sparse arpeggio on top at higher intensity
    if(I>0.5){ _arpTimer-=dt;
      if(_arpTimer<=0){ _arpTimer=lerp(0.5,0.18,I);
        const ch=CHORDS[_chordIdx]; _arpStep=(_arpStep+1)%4;
        const f=ch[_arpStep%ch.length]*(_arpStep===3?2:1);
        _pluck(f*2, 0.05*I, 0.14, 'square'); } }
  }
}
