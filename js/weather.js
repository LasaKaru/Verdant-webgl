"use strict";
/* =====================================================================
   VERDANT — weather.js
   Dynamic weather: clear or rain. Rain drives a GPU particle downpour
   that follows the player, thickens the fog, darkens the sky, and throws
   occasional lightning flashes. Setting: Clear / Rain / Auto.
   ===================================================================== */

let _rainPS=null, _baseFog=0.0065, _lightningT=0;

function buildWeather(scene){
  // rain particle texture (a soft vertical streak)
  const t=new BABYLON.DynamicTexture('rainTex',{width:16,height:64},scene,false);
  const c=t.getContext();
  const grd=c.createLinearGradient(0,0,0,64); grd.addColorStop(0,'rgba(200,225,255,0)'); grd.addColorStop(1,'rgba(200,225,255,0.9)');
  c.fillStyle=grd; c.fillRect(6,0,4,64); t.hasAlpha=true; t.update();
  const ps=new BABYLON.ParticleSystem('rain',2200,scene);
  ps.particleTexture=t;
  ps.emitter=new BABYLON.Vector3(0,30,0);
  ps.minEmitBox=new BABYLON.Vector3(-34,0,-34); ps.maxEmitBox=new BABYLON.Vector3(34,4,34);
  ps.color1=new BABYLON.Color4(0.8,0.88,1,0.6); ps.color2=new BABYLON.Color4(0.7,0.8,1,0.5);
  ps.colorDead=new BABYLON.Color4(0.7,0.8,1,0);
  ps.minSize=0.12; ps.maxSize=0.28; ps.minScaleY=4; ps.maxScaleY=7;
  ps.minLifeTime=0.7; ps.maxLifeTime=1.0;
  ps.emitRate=0; ps.gravity=new BABYLON.Vector3(0,-1,0);
  ps.direction1=new BABYLON.Vector3(-1,-30,-1); ps.direction2=new BABYLON.Vector3(1,-34,1);
  ps.minEmitPower=1; ps.maxEmitPower=1.4; ps.updateSpeed=0.02;
  ps.start(); _rainPS=ps;
  _baseFog=scene.fogDensity;
}

function setWeather(mode){            // 'clear' | 'rain'
  Game.weather=mode;
  if(_rainPS) _rainPS.emitRate = mode==='rain' ? (Game.settings.quality==='low'?900:1800) : 0;
  if(Game.scene) Game.scene.fogDensity = mode==='rain' ? _baseFog*2.3 : _baseFog;
  if(mode==='rain') toast('☔ RAIN MOVING IN'); else toast('☀ SKIES CLEARING');
}

function updateWeather(dt){
  // follow player with the rain volume
  if(_rainPS && Game.player){ _rainPS.emitter.x=Game.player.position.x; _rainPS.emitter.z=Game.player.position.z;
    _rainPS.emitter.y=Game.player.position.y+30; }
  // Auto mode: drift between clear and rain
  if(Game.settings.weatherMode==='auto'){
    Game.weatherTimer-=dt;
    if(Game.weatherTimer<=0){ const next=Game.weather==='rain'?'clear':(Math.random()<0.45?'rain':'clear');
      if(next!==Game.weather) setWeather(next);
      Game.weatherTimer=rand(22,42); }
  }
  // lightning flashes during rain
  if(Game.weather==='rain'){
    _lightningT-=dt;
    if(_lightningT<=0 && Math.random()<0.012){
      _lightningT=rand(4,10);
      const f=$('hitflash'); if(f){ f.style.background='rgba(220,235,255,.7)'; f.style.opacity='1';
        setTimeout(()=>{ f.style.opacity='0'; setTimeout(()=>f.style.background='',200); },90); }
      sfx('explode');
    }
  }
}
// darken sky tint while raining (called from updateSky via hook)
function weatherSkyTint(sky){
  if(Game.weather!=='rain') return sky;
  return [sky[0]*0.6+0.12, sky[1]*0.6+0.13, sky[2]*0.6+0.16];
}
