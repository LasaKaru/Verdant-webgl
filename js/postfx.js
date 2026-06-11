"use strict";
/* =====================================================================
   VERDANT — postfx.js   (Phase 3: post-processing + game feel)
   1. DefaultRenderingPipeline: FXAA, bloom, vignette, slight contrast/
      saturation grading — toggleable in Settings (off for weak GPUs).
   2. Screen shake — small kicks on firing, big on explosions/damage.
   3. Hit-stop — a few ms of freeze on kills for punchy feedback.
   ===================================================================== */

function buildPostFX(scene,camera){
  try{
    const pp=new BABYLON.DefaultRenderingPipeline('verdantFX', true, scene, [camera]);
    pp.fxaaEnabled=true;
    pp.bloomEnabled=true; pp.bloomThreshold=0.75; pp.bloomWeight=0.25; pp.bloomKernel=48; pp.bloomScale=0.5;
    pp.imageProcessingEnabled=true;
    if(pp.imageProcessing){
      pp.imageProcessing.contrast=1.12;
      pp.imageProcessing.exposure=1.05;
      pp.imageProcessing.vignetteEnabled=true;
      pp.imageProcessing.vignetteWeight=1.6;
      pp.imageProcessing.vignetteColor=new BABYLON.Color4(0,0.05,0.02,0);
    }
    Game.postfx=pp;
    applyPostFX();
  }catch(e){ console.warn('PostFX unavailable:',e); Game.postfx=null; }
}
function applyPostFX(){
  const on=Game.settings.postfx!==false;
  if(Game.postfx){ Game.postfx.fxaaEnabled=on; Game.postfx.bloomEnabled=on;
    Game.postfx.imageProcessingEnabled=on; }
}

/* ------------------------- screen shake ------------------------- */
let _shake=0, _shakeT=0;
function addShake(amount){ _shake=Math.min(1.6,_shake+amount); }
/* called every frame AFTER the camera is positioned; offsets the camera slightly */
function updateShake(dt){
  if(_shake<=0.001){ _shake=0; return; }
  _shakeT+=dt*48;
  const cam=Game.camera, s=_shake*0.18;
  cam.position.x+=Math.sin(_shakeT*1.3)*s;
  cam.position.y+=Math.cos(_shakeT*1.7)*s*0.6;
  _shake*=Math.pow(0.0015,dt);  // fast decay
}

/* ------------------------- hit stop ------------------------- */
let _hitStopUntil=0;
function hitStop(ms){ _hitStopUntil=performance.now()+(ms||45); }
function hitStopActive(){ return performance.now()<_hitStopUntil; }
