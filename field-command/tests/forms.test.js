// FC-023 regression: formations (geometry, preview = order, drill effects), mouse controls, fog of war, stall handling.
module.exports=async(page,{check,shot})=>{
  await page.evaluate(()=>start('cannae'));await page.waitForTimeout(600);
  // ---- formation geometry: measured in the group's own frame (along = facing, across = frontage)
  const geo=await page.evaluate(()=>{
    const b=G.b,sel=b.units.filter(u=>u.side==='P'&&u.type!=='gen'&&formsFor(u).includes('defend')).slice(0,6);
    G.sel=new Set(sel.map(u=>u.id));const out={n:sel.length},face=-Math.PI/2,p={x:500,y:420};
    for(const k of FORM_KEYS){for(const u of sel)u.gform=k;const m=planGroupMove(sel,p,face,null,k);
      const fx=Math.cos(face),fy=Math.sin(face),rx=Math.cos(face+Math.PI/2),ry=Math.sin(face+Math.PI/2);
      const al=m.map(s=>(s.x-p.x)*fx+(s.y-p.y)*fy),ac=m.map(s=>(s.x-p.x)*rx+(s.y-p.y)*ry);
      out[k]={across:Math.max(...ac)-Math.min(...ac),along:Math.max(...al)-Math.min(...al),lead:al.filter(v=>v>Math.max(...al)-1).length,rows:new Set(al.map(v=>Math.round(v))).size,face:m.every(s=>Math.abs(norm(s.face-face))<1e-6)}}
    for(const u of sel)u.gform=null;return out});
  console.log(JSON.stringify(geo));
  check(geo.n>=4,`enough infantry for a formation test (${geo.n})`);
  check(geo.line.across>geo.line.along*3&&geo.line.rows===1,'line: one wide row');
  check(geo.column.along>geo.column.across*3,'column: narrow and deep');
  check(geo.wedge.lead===1&&geo.wedge.rows>=3,'wedge: a single unit at the point, others echeloned back');
  check(geo.skirmish.across>geo.line.across*1.2,'skirmish: wider spacing than line');
  check(geo.defend.rows>=1&&geo.defend.across<geo.skirmish.across,'hold: compact');
  check(['line','column','wedge','skirmish','defend'].every(k=>geo[k].face),'every slot faces the group facing');
  // ---- drill effects feed the simulation
  const fx=await page.evaluate(()=>{const b=G.b,u=b.units.find(x=>x.side==='P'&&formsFor(x).includes('defend'));const r={};
    for(const k of FORM_KEYS){setForm(u,k,null);r[k]={mv:tbMoveRange(b,u),w:u.w,d:u.d}}setForm(u,'line',null);return r});
  check(fx.column.mv>fx.line.mv&&fx.defend.mv<fx.line.mv,'column marches faster than line, hold barely moves');
  check(fx.column.w<fx.line.w&&fx.column.d>fx.line.d&&fx.skirmish.w>fx.line.w,'unit footprint follows its drill');
  // ---- begin, then preview slots equal committed orders
  await page.evaluate(()=>{begin();G.speed=3});
  const pv=await page.evaluate(()=>{const b=G.b,sel=b.units.filter(u=>u.side==='P'&&u.type!=='gen'&&!u.rout).slice(0,5);G.sel=new Set(sel.map(u=>u.id));
    setGroupForm('wedge');const cx=sel.reduce((a,s)=>a+s.x,0)/5,cy=sel.reduce((a,s)=>a+s.y,0)/5,p={x:cx,y:cy-60};
    const prev=planGroupMove(sel,p,null,null,null);issue(p,null);
    let maxd=0,orders=0;for(const s of prev){const o=s.u.order;if(!o||o.kind!=='move')continue;orders++;maxd=Math.max(maxd,Math.hypot(o.x-s.x,o.y-s.y))}
    const grp=new Set(sel.map(u=>u.order&&u.order.grp));
    return{orders,maxd,grp:grp.size,form:sel.every(u=>u.gform==='wedge'),btn:document.querySelector('[data-form="wedge"]').classList.contains('on'),bar:getComputedStyle($('formbar')).display}});
  console.log(JSON.stringify(pv));
  check(pv.orders===5&&pv.maxd<14,`order lands on the previewed slot (max offset ${pv.maxd.toFixed(1)}; only openGround may nudge)`);
  check(pv.grp===1,'a formation move is one group (shared pace)');
  check(pv.form&&pv.btn&&pv.bar!=='none','formation bar is shown and marks the active drill');
  await page.evaluate(()=>setView('2d'));await page.waitForTimeout(300);
  await shot('forms_wedge_2d');
  // ---- mouse: left-click selects, right-click orders, left-click on ground never orders
  const m=await page.evaluate(()=>{const b=G.b;G.sel.clear();for(const u of b.units)if(u.side==='P'&&u.order&&u.order.kind==='move')u.order=null;updateCmds();
    const u=b.units.find(x=>x.side==='P'&&x.type!=='gen'&&!x.rout&&x._sx>40&&x._sy>40&&x._sx<G.cssW-40&&x._sy<G.cssH-200);const r=ov.getBoundingClientRect();
    return u?{id:u.id,x:r.left+u._sx,y:r.top+u._sy}:null});
  check(!!m,'a player unit is on screen');
  if(m){
    await page.waitForTimeout(400);
    await page.mouse.click(m.x,m.y);
    check(await page.evaluate(id=>G.sel.size===1&&G.sel.has(id),m.id),'left-click selects the unit');
    await page.waitForTimeout(400);
    await page.mouse.click(m.x+40,m.y-50);
    check(await page.evaluate(id=>{const u=byId(G.b,id);return !u.order&&G.sel.size===0},m.id),'left-click on empty ground deselects and gives no order');
    await page.mouse.click(m.x,m.y);await page.waitForTimeout(400);
    const want=await page.evaluate(([x,y])=>vToWorld({clientX:x,clientY:y}),[m.x+40,m.y-50]);
    await page.mouse.click(m.x+40,m.y-50,{button:'right'});
    const o=await page.evaluate(id=>{const u=byId(G.b,id);return u.order&&{k:u.order.kind,x:u.order.x,y:u.order.y}},m.id);
    check(o&&o.k==='move'&&Math.hypot(o.x-want.x,o.y-want.y)<10,'right-click orders a move to the clicked ground point');
    await page.keyboard.press('j');
    check(await page.evaluate(()=>G.amove===true),'J arms attack-move');
    await page.mouse.click(m.x+20,m.y-70,{button:'right'});
    check(await page.evaluate(id=>{const u=byId(G.b,id);return u.order&&u.order.amove===true&&!G.amove},m.id),'attack-move order is flagged and disarms');
  }
  // ---- fog of war: a far enemy is hidden and cannot be picked; a scout next to it reveals it
  const fog=await page.evaluate(()=>{const b=G.b,e=b.units.find(u=>u.side==='E'&&!u.gone&&u.type!=='gen');
    const sc0=new Map();for(const u of b.units){if(u.side==='P'){u.y=630;sc0.set(u,u.scout);u.scout=false}}e.x=500;e.y=20;e.revealed=null;b.known={};visDirty(b);
    const hidden=hiddenFromPlayer(e),sh=b.units.find(u=>u.side==='P'&&TYPES[u.type].ranged&&WEAP[TYPES[u.type].ranged.w][e.armor]>0),tip=sh?canEngage(b,sh,e):{why:'unseen'};
    const sc=b.units.find(u=>u.side==='P'&&!u.gone&&u.type!=='gen');sc.x=500;sc.y=90;visDirty(b);const seen=!hiddenFromPlayer(e);sc.y=630;for(const [u,v] of sc0)u.scout=v;visDirty(b);const kept=!hiddenFromPlayer(e);
    return{hidden,why:tip.why,seen,kept,rev:e.revealed,t:b.t,minD:Math.min(...b.units.filter(u=>u.side==="P"&&!u.gone).map(u=>dist(u,e)|0)),fogOff:!!b.fogOff}});
  console.log(JSON.stringify(fog));check(fog.hidden&&fog.why==='unseen','fog: an enemy nobody can see is hidden and refused as unseen');
  check(fog.seen,'fog: a friendly unit close by reveals it');
  check(fog.kept,'fog: once discovered, the enemy stays revealed after the scout leaves');
  // ---- fog toggle (deployment screen) and morale
  const tg=await page.evaluate(()=>{start('cannae');const off0=G.b.fogOff;setFogPref(false);const r={off0,off:G.b.fogOff,label:$('b-fog').textContent};start('cannae');r.offNext=G.b.fogOff;setFogPref(true);r.on=!G.b.fogOff;r.vis=$('b-fog').offsetParent!==null;start('cannae');begin();G.speed=3;return r});
  check(!tg.off0&&tg.off&&tg.offNext&&tg.on&&/OFF/.test(tg.label)&&tg.vis,'fog toggle: visible before battle; OFF disables fog, is remembered, turns back ON');
  const mo=await page.evaluate(()=>{const b=G.b,P=b.units.filter(u=>u.side==='P'&&u.type!=='gen'),a=P[0],c=b.units.find(u=>u.side==='E'&&u.type===a.type)||b.units.find(u=>u.side==='E');
    const fight=(ma,mc)=>{a.morale=ma;c.morale=mc;a.dmg=c.dmg=0;a.crowd=c.crowd=1;const keep=Math.random;Math.random=()=>.99;melee(b,a,c,1,5);Math.random=keep;return c.dmg};
    const hi=fight(100,50),lo=fight(30,50);
    const n=P[1],m0=(n.morale=80);a.x=n.x+40;a.y=n.y;a.dmg=a.men+1;a.mdmg=0;tbApply(b,[a]);const drop=m0-n.morale;
    const w=P[2];w.morale=5;w.hitThisRound=false;w.contacts=[];w.order=null;tbEndRound(b);return{hi,lo,drop,waver:!!(w.order&&w.order.kind==='move'&&w.order.y>w.y),st:status(w)}});
  console.log(JSON.stringify(mo));
  check(mo.hi>mo.lo*1.3,'morale: the steadier unit inflicts clearly more in an otherwise equal fight');
  check(mo.drop>4,`morale: a friendly unit destroyed nearby costs morale (${mo.drop.toFixed(1)})`);
  check(mo.waver&&mo.st==='Wavering','morale: a wavering unit falls back toward its own lines');
  // ---- stall: a unit that makes no progress for two rounds drops the order with a message
  const st=await page.evaluate(()=>{const b=G.b,u=b.units.find(x=>x.side==='P'&&!x.gone&&!x.rout&&x.type!=='gen');u.order={kind:'move',x:u.x+200,y:u.y};u._od=null;u._stall=0;
    const ox=u.x,oy=u.y;for(let i=0;i<3&&u.order;i++){u.x=ox;u.y=oy;tbEndRound(b)}return{dropped:!u.order,blocked:!!u._blocked,msg:b.msgs.some(m=>/cannot reach/.test(m.text))}});
  check(st.dropped&&st.blocked&&st.msg,'stalled move is dropped, marked and reported');
  // ---- suppression: fire builds it, cover and skirmish order reduce it, pinned units barely move, it decays
  const sp=await page.evaluate(()=>{const b=G.b,a=b.units.find(u=>u.side==='E'&&TYPES[u.type].ranged&&!u.gone)||b.units.find(u=>u.side==='E'&&!u.gone),c=b.units.find(u=>u.side==='P'&&!u.gone&&formsFor(u).includes('skirmish')&&u.type!=='gen');
    const R=TYPES[a.type].ranged||{w:'arrow'};c.x=500;c.y=400;c.facing=-Math.PI/2;a.x=500;a.y=300;a.facing=Math.PI/2;
    const gain=(form,flank)=>{setForm(c,form,null);if(flank){a.x=400;a.y=400}else{a.x=500;a.y=300}return suppGain(b,R.w,c,c.maxMen*.02,rangedFlank(a,c))};
    const r={line:gain('line'),skirm:gain('skirmish'),flank:gain('line',true),flankHold:rangedFlank(a,c)*FORM.defend.flank};setForm(c,'line',null);
    const mv0=tbMoveRange(b,c);c.supp=90;r.pinMv=tbMoveRange(b,c)/mv0;r.status=status(c);
    c.sdmg=0;c.hitThisRound=false;tbEndRound(b);r.after=c.supp;c.supp=0;
    // the strike preview must not leak suppression
    c.sdmg=0;if(TYPES[a.type].ranged){tbPreview(b,a,c)}r.leak=c.sdmg||0;return r});
  console.log(JSON.stringify(sp));
  check(sp.line>0&&sp.skirm<sp.line,'skirmish order takes less suppression than line');
  check(sp.flank>sp.line,'fire from the flank suppresses more');
  check(sp.flankHold===0,'an all-round defence has no flank to exploit');
  check(sp.pinMv<.3&&sp.status==='Pinned down','pinned units barely move and show it');
  check(sp.after<90,'suppression wears off when the fire stops');
  check(!sp.leak,'strike preview leaves suppression untouched');
  // ---- a full turn still resolves after all of this
  await page.evaluate(()=>{for(const u of G.b.units)if(u.side==='P'&&u.order&&u.order.kind==='move'&&!openGround(G.b,u,u.order.x,u.order.y))u.order=null;execTurn();G.ff=true});
  await page.waitForFunction(()=>G.mode!=='exec',null,{timeout:90000});
  check(await page.evaluate(()=>G.b.units.every(u=>Number.isFinite(u.x)&&Number.isFinite(u.y)&&Number.isFinite(u.men))),'turn resolves with finite state');
  await shot('forms_after_turn');
};
