// FC-025: tactical AI roles (guns pull back, screens, flank rides, commitment) and an all-scenario regression run.
module.exports=async(page,{check})=>{
  const r=await page.evaluate(()=>{
    const out={};
    const find=(pred)=>{for(const id of Object.keys(SCEN)){const s=SCEN[id];if(s.endless||s.custom)continue;start(id);const b=G.b;const u=b.units.find(x=>x.side==='E'&&x.ai&&pred(x,b));if(u)return{id,b,u}}return null};
    const iso=(b,keep)=>{for(const o of b.units)if(!keep.includes(o)){o.x=o.side==='P'?980:20;o.y=o.side==='P'?630:10}b.fogOff=true;visDirty(b);tbContacts(b)};
    // guns threatened by a fast enemy pull back
    const gunCase=(pred,key)=>{const f=find(pred);if(!f)return;const {b,u}=f,th=b.units.find(x=>x.side==='P'&&FAST(x)&&!x.air);if(!th)return;u.ai.delay=0;u.ai.mode=u.ai.base||'advance';u.ai.wps=null;u.x=500;u.y=250;th.x=500;th.y=310;u.facing=Math.PI/2;th.facing=-Math.PI/2;iso(b,[u,th]);const d0=dist(u,th);tbEnemyPlan(b);
      const o=u.order;out[key]={id:f.id,type:u.type,threat:th.type,kind:o&&o.kind,target:o&&o.target===th.id,away:o&&o.kind==='move'?Math.hypot(o.x-th.x,o.y-th.y)>d0:false}};
    // guns that cannot hit a fast threat (inside their minimum range) pull back; guns that can, fire on it
    gunCase(x=>ROLE[x.type]==='guns'&&!x.naval&&!x.space&&TYPES[x.type].ranged&&TYPES[x.type].ranged.min>60,'guns');
    gunCase(x=>ROLE[x.type]==='guns'&&!x.naval&&!x.space&&TYPES[x.type].ranged&&!TYPES[x.type].ranged.min,'gunsFire');
    // cavalry swings round a target that is already fighting
    f=find(x=>ROLE[x.type]==='mounted'&&TYPES[x.type].charge&&!x.air);
    if(f){const {b,u}=f,t=b.units.find(x=>x.side==='P'&&!x.air&&ROLE[x.type]!=='mounted'&&x.type!=='gen'),e2=b.units.find(x=>x.side==='E'&&x!==u&&!x.air&&x.type!=='gen');
      if(t&&e2){u.ai.delay=0;u.ai.wps=null;u.ai.mode='advance';u.ai.pref=null;t.x=500;t.y=420;t.facing=-Math.PI/2;e2.x=500;e2.y=420-contactDist(t,e2)+2;u.x=500;u.y=160;iso(b,[u,t,e2]);
        tbEnemyPlan(b);const o=u.order;out.flank={id:f.id,kind:o&&o.kind,side:o&&o.kind==="move"?Math.abs(norm(Math.atan2(o.y-t.y,o.x-t.x)-t.facing)):null,contacts:t.contacts.length}}}
    // a committed shooter keeps its target when a marginally better one appears
    f=find(x=>TYPES[x.type].ranged&&!x.air&&!x.naval&&ROLE[x.type]!=='guns');
    if(f){const {b,u}=f,ps=b.units.filter(x=>x.side==='P'&&!x.air&&x.type!=='gen'&&WEAP[TYPES[u.type].ranged.w][x.armor]>0).slice(0,2);
      if(ps.length===2){u.ai.delay=0;u.ai.wps=null;u.ai.mode='advance';u.ai.pref=null;u.x=500;u.y=200;const R=TYPES[u.type].ranged.range;ps[0].x=470;ps[0].y=200+R*.6;ps[1].x=530;ps[1].y=200+R*.6;iso(b,[u,...ps]);
        tbEnemyPlan(b);const t1=u.order&&u.order.target;const other=ps.find(p=>p.id!==t1);if(other){other.y-=8;visDirty(b)}tbEnemyPlan(b);out.commit={first:t1,second:u.order&&u.order.target}}}
    // churn: over several synchronous rounds, how often do enemy units switch targets?
    start('austerlitz');const b=G.b;b.units.forEach(u=>{if(u.side==='P'){const foe=b.units.filter(e=>e.side==='E'&&!e.gone).sort((a,c)=>dist(u,a)-dist(u,c))[0];if(foe)u.order={kind:'attack',target:foe.id}}});
    tbEnemyPlan(b);let sw=0,n=0;const last={};
    for(let r=0;r<5&&!b.result;r++){for(const u of b.units)if(u.side==='E'&&u.order&&u.order.kind==='attack'){n++;if(last[u.id]!=null&&last[u.id]!==u.order.target&&byId(b,last[u.id])&&!byId(b,last[u.id]).gone&&!byId(b,last[u.id]).rout)sw++;last[u.id]=u.order.target}
      tbRoundSync(b);tbEnemyPlan(b)}
    out.churn={sw,n};
    // every scenario: three synchronous rounds with the AI on both sides of the plan, state stays finite
    const bad=[];let ran=0;
    for(const id of Object.keys(SCEN)){const s=SCEN[id];if(s.custom)continue;try{start(id);const bb=G.b;for(const u of bb.units)if(u.side==='P'){const foe=bb.units.filter(e=>e.side==='E'&&!e.gone).sort((a,c)=>dist(u,a)-dist(u,c))[0];if(foe)u.order={kind:'attack',target:foe.id}}
      tbEnemyPlan(bb);for(let r=0;r<3&&!bb.result;r++){tbRoundSync(bb);tbEnemyPlan(bb)}ran++;
      if(!bb.units.every(u=>Number.isFinite(u.x)&&Number.isFinite(u.y)&&Number.isFinite(u.men)&&Number.isFinite(u.morale)&&Number.isFinite(u.supp||0)))bad.push(id+': non-finite')}catch(e){bad.push(id+': '+e.message)}}
    out.all={ran,bad};
    return out});
  console.log(JSON.stringify(r));
  check(r.guns&&r.guns.kind==='move'&&r.guns.away,`guns that cannot engage a fast threat pull back (${r.guns&&r.guns.id}: ${r.guns&&r.guns.type} vs ${r.guns&&r.guns.threat})`);
  check(r.gunsFire&&r.gunsFire.kind==='attack'&&r.gunsFire.target,`guns that can engage a fast threat fire on it (${r.gunsFire&&r.gunsFire.id}: ${r.gunsFire&&r.gunsFire.type})`);
  check(r.flank&&r.flank.kind==='move'&&r.flank.side>0.9,`cavalry rides for the flank/rear of an engaged target (${r.flank&&r.flank.id})`);
  check(r.commit&&r.commit.first&&r.commit.first===r.commit.second,'a committed shooter keeps its target');
  check(r.churn.n>0&&r.churn.sw/r.churn.n<0.2,`enemy target churn is low (${r.churn.sw}/${r.churn.n} switches)`);
  check(r.all.ran>10&&r.all.bad.length===0,`all ${r.all.ran} scenarios run 3 rounds with finite state${r.all.bad.length?': '+r.all.bad.join('; '):''}`);
};
