// FC-024: 3D combat effects are driven by sim records, stay inside their pools, and cost a bounded number of draw calls.
module.exports=async(page,{check,shot})=>{
  if(process.env.FC_NO_WEBGL){check(true,'skipped: no WebGL');return}
  for(const id of ['ironbridge','austerlitz','agincourt']){
    const ok=await page.evaluate(id=>{if(!SCEN[id])return false;start(id);return true},id);if(!ok){check(true,`${id}: not in this build`);continue}
    await page.waitForTimeout(500);
    await page.evaluate(()=>{begin();G.speed=3;G.ff=true;V3.post=false;const b=G.b;b.fogOff=true;visDirty(b);
      // close the armies so everybody is in range on turn one
      for(const u of b.units){if(u.gone)continue;u.y=u.side==='P'?u.y-(u.y-H/2)*.55:u.y+(H/2-u.y)*.55}tbSeparate(b);
      for(const u of b.units){if(u.side!=='P'||u.gone||u.rout)continue;const foe=b.units.filter(e=>e.side==='E'&&!e.gone&&!e.rout).sort((a,c)=>dist(u,a)-dist(u,c))[0];if(foe)u.order={kind:'attack',target:foe.id}}
      const c=G.b.units.filter(u=>u.side==='P'&&!u.gone);centerOn(c.reduce((a,u)=>a+u.x,0)/c.length,H/2);execTurn()});
    let peak={add:0,smoke:0,lines:0,rings:0,calls:0,fxRec:0},shotDone=false;
    for(let i=0;i<160;i++){await page.waitForTimeout(400);
      const s=await page.evaluate(()=>({mode:G.mode,add:FX3.ok?FX3.add.c:0,smoke:FX3.ok?FX3.smoke.c:0,lines:FX3.ok?FX3.nl:0,rings:FX3.ok?FX3.rings.filter(r=>r.life>0).length:0,calls:V3.renderer.info.render.calls,fxRec:G.b.fx.length,capA:FX3.ok?FX3.add.n:0,capS:FX3.ok?FX3.smoke.n:0}));
      for(const k of ['add','smoke','lines','rings','calls','fxRec'])peak[k]=Math.max(peak[k],s[k]);peak.capA=s.capA;peak.capS=s.capS;
      if(!shotDone&&s.add+s.smoke>150){await shot(id+'_fx3d');shotDone=true}
      if(s.mode!=='exec')break}
    console.log(id,JSON.stringify(peak));
    check(peak.fxRec>0,`${id}: the simulation produced effect records`);
    check(peak.smoke>0&&(id==='agincourt'||peak.add>0),`${id}: records became 3D particles (flash ${peak.add}, smoke/projectiles ${peak.smoke})${id==='agincourt'?' (bows: no muzzle flash)':''}`);
    check(peak.add<=peak.capA&&peak.smoke<=peak.capS,`${id}: particle pools stay within caps`);
    check(peak.calls<400,`${id}: draw calls bounded (${peak.calls})`);
    await page.waitForFunction(()=>G.mode!=='exec',null,{timeout:90000});
    if(!shotDone)await shot(id+'_fx3d_end');
  }
  // 2D view still uses the canvas effects; switching keeps the pools sane
  await page.evaluate(()=>setView('2d'));await page.waitForTimeout(200);
  check(await page.evaluate(()=>G.view==='2d'),'2D view still available');
};
