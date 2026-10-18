// FC-021/022 regression: the shared engagement rule (canEngage) and the turn engine agree.
// Uses the Steel Corridor map (hills at 260,300 and 780,330; woods at 500,330).
module.exports=async(page,{check})=>{
  await page.evaluate(()=>start('steel'));await page.waitForTimeout(400);
  const r=await page.evaluate(()=>{
    const b=G.b,P=t=>b.units.find(u=>u.side==='P'&&u.type===t),E=t=>b.units.find(u=>u.side==='E'&&u.type===t);
    const at=(u,x,y)=>{u.x=x;u.y=y};const out={};
    const tank=P('tank'),foe=E('tank'),mlrs=P('mlrs'),recon=P('recon'),heli=E('heli'),eat=E('atgm');
    // park every other player unit in the far corner so they cannot observe
    for(const u of b.units)if(u.side==='P'&&u!==tank&&u!==mlrs)at(u,960,630);
    at(tank,600,560);at(foe,600,420);out.open=canEngage(b,tank,foe);
    at(foe,600,300);out.range=canEngage(b,tank,foe);
    at(tank,150,300);at(foe,360,300);out.hill=canEngage(b,tank,foe);
    at(eat,395,330);at(tank,605,330);out.woods=canEngage(b,eat,tank);
    at(mlrs,500,620);at(foe,500,520);out.min=canEngage(b,mlrs,foe);
    at(heli,600,500);at(tank,600,560);out.armor=canEngage(b,tank,heli);
    at(foe,300,120);out.noObs=canEngage(b,mlrs,foe);
    mlrs.order={kind:'attack',target:foe.id};const p1=tbPlan(b,mlrs);out.planNoObs={attack:p1.attack,moved:p1.pts.length>1,noObs:!!p1.noObs};
    at(recon,330,200);const ob=canEngage(b,mlrs,foe);out.obsBy=ob.obs&&ob.obs.name;out.obs={ok:ob.ok,why:ob.why};
    const p2=tbPlan(b,mlrs);out.planObs={attack:p2.attack};
    out.ring=TYPES.howz.ranged.range;
    // false-positive rate: random pairs on open, flat-ish ground should almost never be blocked
    let n=0,bl=0;for(const id of ['cannae','agincourt']){start(id);const bb=G.b,a=bb.units[0],c=bb.units[bb.units.length-1];
      for(let i=0;i<400;i++){const x=150+Math.random()*700,y=150+Math.random()*350,ang=Math.random()*6.28,d=40+Math.random()*150,x2=x+Math.cos(ang)*d,y2=y+Math.sin(ang)*d;
        if(terr(bb,x,y)||terr(bb,x2,y2))continue;a.x=x;a.y=y;c.x=x2;c.y=y2;n++;const l=losInfo(bb,a,c);if(!l.ok&&l.why==='hill')bl++}}
    out.fp={n,bl};
    return out});
  console.log(JSON.stringify(r));
  check(r.open.ok,'tank engages an enemy tank in range on open ground');
  check(!r.range.ok&&r.range.why==='range','out of range is refused with reason "range"');
  check(!r.hill.ok&&r.hill.why==='hill','a hill between the tanks blocks line of sight');
  check(!r.woods.ok&&r.woods.why==='woods','woods between AT team and tank block line of sight');
  check(!r.min.ok&&r.min.why==='min','rocket artillery refuses targets inside its minimum range');
  check(!r.armor.ok&&r.armor.why==='armor','tank gun cannot engage a helicopter');
  check(!r.noObs.ok&&r.noObs.why==='observer','indirect fire with nobody seeing the target is refused');
  check(r.planNoObs.attack===false&&!r.planNoObs.moved&&r.planNoObs.noObs,'turn engine: unobserved artillery holds still instead of advancing');
  check(r.obs.ok&&r.obsBy==='Recon squadron','a recon unit near the target acts as observer');
  check(r.planObs.attack===true,'turn engine: observed artillery fires');
  check(r.fp.n>200&&r.fp.bl/r.fp.n<0.05,`open flat ground rarely blocks LOS (${r.fp.bl}/${r.fp.n} blocked)`);
};
