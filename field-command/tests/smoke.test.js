// FC-003 smoke test: menu, one historical and one modern battle, 2D/3D switching, restart, turn progression.
const sane=()=>G.b.units.every(u=>Number.isFinite(u.x)&&Number.isFinite(u.y)&&Number.isFinite(u.facing)&&Number.isFinite(u.men)&&Number.isFinite(u.morale));
module.exports=async(page,{check,shot})=>{
  check(await page.evaluate(()=>!$('menu').hidden&&document.querySelectorAll('#cards .card').length>0),'menu shows battle cards');
  const gl=!process.env.FC_NO_WEBGL;
  check(await page.evaluate(()=>V3.ok)===gl,gl?'WebGL 3D view initialised':'no WebGL: 3D view disabled, 2D fallback in use');
  for(const id of ['cannae','ironbridge']){
    await page.evaluate(id=>start(id),id);await page.waitForTimeout(800);
    check(await page.evaluate(()=>G.mode==='deploy'&&!$('game').hidden&&G.b.units.length>0),`${id}: battle starts in deployment`);
    await shot(id+'_deploy_'+(gl?'3d':'nogl'));
    await page.evaluate(()=>setView('2d'));await page.waitForTimeout(300);
    check(await page.evaluate(()=>G.view==='2d'&&!cv.hidden&&cv3.hidden),`${id}: switch to 2D`);
    await shot(id+'_deploy_2d');
    await page.evaluate(()=>setView('3d'));await page.waitForTimeout(200);
    check(await page.evaluate(gl=>gl?G.view==='3d'&&cv.hidden&&!cv3.hidden:G.view==='2d'&&!cv.hidden,gl),gl?`${id}: switch back to 3D`:`${id}: 3D request stays on 2D without WebGL`);
    await page.evaluate(()=>{begin();G.speed=3});
    check(await page.evaluate(()=>G.mode==='plan'&&G.turn===1),`${id}: begin -> planning turn 1`);
    for(let t=0;t<2;t++){
      await page.evaluate(()=>{const b=G.b;for(const u of b.units){if(u.side!=='P'||u.gone||u.rout)continue;const foe=b.units.filter(e=>e.side==='E'&&!e.gone&&!e.rout).sort((a,c)=>dist(u,a)-dist(u,c))[0];if(foe)u.order={kind:'attack',target:foe.id}}execTurn();G.ff=true});
      await page.waitForFunction(()=>G.mode!=='exec',null,{timeout:90000});
    }
    check(await page.evaluate(()=>G.turn===3||G.mode==='over'||!!G.b.result),`${id}: two turns resolve`);
    check(await page.evaluate(sane),`${id}: unit state finite after combat`);
    await shot(id+'_turn3');
    await page.evaluate(()=>$('b-restart').click());await page.waitForTimeout(500);
    check(await page.evaluate(()=>G.mode==='deploy'&&G.turn===0||G.mode==='deploy'),`${id}: restart returns to deployment`);
  }
  await page.evaluate(()=>toMenu());
  check(await page.evaluate(()=>!$('menu').hidden&&$('game').hidden),'back to menu');
};
