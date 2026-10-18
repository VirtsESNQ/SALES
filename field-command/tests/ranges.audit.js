// FC-020 audit: dumps the live TYPES table (after every runtime override) as a markdown table.
// Movement per turn = TYPES.speed * TB.MOVE (tbMoveRange, before terrain/fatigue). Map width = W world units.
module.exports=async(page,{check})=>{
  const rows=await page.evaluate(()=>{
    const eraOf={};for(const [k,r] of Object.entries(ROSTER))for(const u of r.units)(eraOf[u.type]=eraOf[u.type]||new Set()).add(r.render||k);
    return Object.entries(TYPES).map(([k,T])=>{const R=T.ranged||{},mv=T.speed*TB.MOVE,eras=[...(eraOf[k]||[])];const m=mPer(eras[0]||'');
      return {k,label:T.label,eras:eras.join('/')||'-',speed:T.speed,move:Math.round(mv),w:R.w||'-',range:R.range||0,min:R.min||0,fireMove:!!R.move,ind:R.w?INDIRECT.has(R.w):false,
        pctMap:R.range?Math.round(R.range/W*100):0,turnsToClose:R.range&&mv?+(R.range/mv).toFixed(1):0,metres:R.range?Math.round(R.range*m):0,armor:T.armor}})});
  const map=await page.evaluate(()=>({W,H,MSCALE,SPOT,TB}));
  console.log('MAP',JSON.stringify(map));
  console.log('| type | label | eras | speed | move/turn | weapon | range | min | fire on move | indirect | range % map W | own turns to cross range | metres | armour |');
  console.log('|---|---|---|---|---|---|---|---|---|---|---|---|---|---|');
  for(const r of rows)console.log(`| ${r.k} | ${r.label} | ${r.eras} | ${r.speed} | ${r.move} | ${r.w} | ${r.range} | ${r.min} | ${r.fireMove?'yes':''} | ${r.ind?'yes':''} | ${r.pctMap||''} | ${r.turnsToClose||''} | ${r.metres||''} | ${r.armor} |`);
  check(rows.length>40,'audit dumped '+rows.length+' unit types');
};
