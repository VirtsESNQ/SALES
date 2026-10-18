// SIM-START
const K={speed:1.6,melee:0.012,ranged:0.012,mor:150,flank:1,cascade:8};
const eff=m=>m/(1+m/4000);
const W=1000,H=640,UP=-Math.PI/2,DOWN=Math.PI/2,RANGE=185;
const TYPES={
  inf:{label:'Infantry',speed:20,melee:1,def:1,w:66,d:20,armor:'foot'},
  heavy:{label:'Heavy infantry',speed:17,melee:1.2,def:1.2,w:66,d:22,armor:'armored'},
  shield:{label:'Shield wall',speed:14,melee:0.95,def:1.8,w:80,d:20,armor:'shield'},
  cav:{label:'Cavalry',speed:54,melee:1.1,def:0.9,w:54,d:18,armor:'horse'},
  arc:{label:'Archers',speed:20,melee:0.35,def:0.6,w:62,d:14,armor:'foot',ranged:{w:'arrow',range:200,dmg:1.35}},
  gen:{label:'General',speed:48,melee:1.6,def:1.8,w:30,d:16,armor:'horse'},
  line:{label:'Line infantry',speed:17,melee:0.85,def:1,w:72,d:16,armor:'foot',ranged:{w:'musket',range:75,dmg:0.95},charge:true},
  art:{label:'Artillery',speed:8,melee:0.2,def:0.55,w:46,d:16,armor:'gun',ranged:{w:'cannon',range:420,min:20,dmg:1.25,splash:42},per:50,unit:'guns'},
  tank:{label:'Tanks',speed:34,melee:0.7,def:2.4,w:62,d:22,armor:'heavy',ranged:{w:'tankgun',range:480,dmg:2,move:true},per:80,unit:'tanks'},
  ifv:{label:'Infantry fighting vehicles',speed:40,melee:0.6,def:1.5,w:60,d:20,armor:'light',ranged:{w:'autocannon',range:320,dmg:1.5,move:true},per:100,unit:'IFVs'},
  minf:{label:'Rifle infantry',speed:8,melee:0.9,def:1,w:62,d:18,armor:'foot',ranged:{w:'rifle',range:90,dmg:1.15},per:10,unit:'soldiers',charge:true},
  atgm:{label:'Anti-tank team',speed:7,melee:0.5,def:0.9,w:46,d:14,armor:'foot',ranged:{w:'atgm',range:560,dmg:2.3},per:10,unit:'soldiers'},
  howz:{label:'Artillery',speed:20,melee:0.2,def:0.8,w:50,d:18,armor:'light',ranged:{w:'shell',range:1400,min:100,dmg:0.9,splash:50},per:130,unit:'guns'},
  drone:{label:'Drones',speed:95,melee:0,def:0.6,w:38,d:26,armor:'air',ranged:{w:'missile',range:70,dmg:1.7,move:true},per:50,unit:'drones',air:true},
  heli:{label:'Attack helicopters',speed:150,melee:0,def:1.1,w:46,d:30,armor:'air',ranged:{w:'hellfire',range:900,dmg:1.8,move:true},per:125,unit:'helicopters',air:true},
  sam:{label:'Air defence',speed:26,melee:0.2,def:1.2,w:46,d:20,armor:'light',ranged:{w:'sam',range:1300,dmg:2.6},per:100,unit:'launchers'},
  ew:{label:'EW jammer',speed:32,melee:0.1,def:1.1,w:40,d:18,armor:'light',per:100,unit:'vehicles',jam:170},
  lm:{label:'Loitering munitions',speed:140,melee:0,def:0.4,w:34,d:24,armor:'air',ranged:{w:'kamikaze',range:45,dmg:3.2,move:true},per:25,unit:'munitions',air:true},
};
const WEAP={
  arrow:{foot:1,armored:.45,shield:.32,horse:1.4,gun:.6,light:.1,heavy:0,air:.2},
  musket:{foot:1,armored:.85,shield:.8,horse:1.25,gun:.8,light:.1,heavy:0,air:.2},
  cannon:{foot:1.3,armored:1.3,shield:1.2,horse:1.2,gun:1,light:.5,heavy:.2,air:0},
  rifle:{foot:1,armored:1,shield:1,horse:1.2,gun:.6,light:.08,heavy:.02,air:.15},
  autocannon:{foot:1.2,armored:1.2,shield:1.2,horse:1.3,gun:1,light:1,heavy:.08,air:1.5},
  tankgun:{foot:.6,armored:.6,shield:.6,horse:.8,gun:1.2,light:1.6,heavy:1.1,air:0},
  atgm:{foot:.25,armored:.25,shield:.25,horse:.4,gun:1,light:1.5,heavy:1.8,air:0},
  shell:{foot:1.4,armored:1.4,shield:1.4,horse:1.4,gun:1,light:.6,heavy:.2,air:0},
  missile:{foot:.6,armored:.6,shield:.6,horse:.6,gun:1,light:1,heavy:1.1,air:0},
  hellfire:{foot:.8,armored:.8,shield:.8,horse:.8,gun:1.1,light:1.3,heavy:1.7,air:0},
  sam:{foot:0,armored:0,shield:0,horse:0,gun:0,light:0,heavy:0,air:3},
  kamikaze:{foot:.7,armored:.7,shield:.7,horse:.7,gun:1.2,light:1.3,heavy:1.6,air:0},
};
const JAMMED=new Set(['shell','missile','kamikaze','hellfire']);
function jammedAt(b,side,x,y){for(const u of b.units){if(u.side!==side||u.gone||u.rout||!TYPES[u.type].jam)continue;if(Math.hypot(u.x-x,u.y-y)<TYPES[u.type].jam)return true}return false}
/* real-world scale per era: metres per map unit, and how close you must be to see a unit hidden in woods or buildings */
const MSCALE={modern:5,napoleon:2};const mPer=era=>MSCALE[era]||1;
const SPOT={modern:110,napoleon:90};const spotR=era=>SPOT[era]||70;
const VEH=new Set(['tank','ifv','howz','sam','ew']);
function norm(a){while(a>Math.PI)a-=2*Math.PI;while(a<-Math.PI)a+=2*Math.PI;return a}
function rng(seed){return function(){seed|=0;seed=seed+0x6D2B79F5|0;let t=Math.imul(seed^seed>>>15,1|seed);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296}}
function inEll(x,y,e){const dx=(x-e.cx)/e.rx,dy=(y-e.cy)/e.ry;return dx*dx+dy*dy<=1}
const riverX=y=>58+16*Math.sin(y/80)+8*Math.sin(y/31);
const AG={L:{cx:105,cy:330,rx:150,ry:235},R:{cx:895,cy:330,rx:150,ry:235},M:{cx:500,cy:352,rx:300,ry:135}};
const HILL={cx:500,cy:650,rx:570,ry:262};
const AUS={prat:{cx:520,cy:225,rx:235,ry:112},santon:{cx:150,cy:430,rx:48,ry:40},zuran:{cx:520,cy:612,rx:60,ry:40},pond:{cx:935,cy:565,rx:75,ry:48},tel:{cx:760,cy:605,rx:34,ry:26},sok:{cx:700,cy:505,rx:34,ry:26}};
const goldX=y=>640+0.35*(y-330)+22*Math.sin(y/60);
const riverY=x=>326+14*Math.sin(x/90)+6*Math.sin(x/37);
const IB={town:{x0:360,x1:640,y0:430,y1:560},wl:{cx:150,cy:480,rx:110,ry:70},wr:{cx:870,cy:525,rx:110,ry:60},wn:{cx:200,cy:170,rx:130,ry:62}};


const SCEN={
  cannae:{
    foe:'The Roman army',
    name:'Cannae',year:'216 BC',place:'Apulia, southern Italy',you:'Hannibal Barca',sides:['Carthage','Rome'],diff:'Hard',
    teaser:'Outnumbered almost two to one by the largest army Rome ever fielded. Let the centre bend, then close the trap.',
    objective:'Rout the Roman army',
    brief:['Your Gallic and Iberian centre will lose a straight fight. Let it give ground and draw the legions in.','Keep the Libyan veterans back until the legions are deep in the crescent, then hit their flanks.','Hasdrubal’s horse outnumbers the Roman cavalry by the river. Break it, then ride round to the Roman rear.','Units hit from the side or rear lose morale fast, and a broken unit can panic its neighbours.'],
    deploy:350,
    terrain(x,y){return x<riverX(y)+18?'river':null},
    player:[
      {resolve:0.7,name:'Gallic foot',type:'inf',x:385,y:405,men:5000,f:UP-0.25},
      {resolve:0.75,name:'Iberian foot',type:'inf',x:462,y:388,men:5000},
      {resolve:0.75,name:'Iberian foot II',type:'inf',x:538,y:388,men:5000},
      {resolve:0.75,name:'Gallic foot II',type:'inf',x:615,y:405,men:5000,f:UP+0.25},
      {resolve:0.6,name:'Libyan veterans (L)',type:'heavy',x:280,y:462,men:5000},
      {resolve:0.6,name:'Libyan veterans (R)',type:'heavy',x:720,y:462,men:5000},
      {name:'Hasdrubal’s horse',type:'cav',x:150,y:440,men:6500},
      {name:'Numidian horse',type:'cav',x:860,y:440,men:3500,melee:0.85,speed:62},
      {name:'Hannibal',type:'gen',x:500,y:472,men:400},
    ],
    enemy:[
      {name:'Legion I',type:'inf',x:385,y:245,men:6500,resolve:1.2,ai:{mode:'advance',delay:1}},
      {name:'Legion II',type:'inf',x:462,y:245,men:6500,resolve:1.2,ai:{mode:'advance',delay:1}},
      {name:'Legion III',type:'inf',x:538,y:245,men:6500,resolve:1.2,ai:{mode:'advance',delay:1}},
      {name:'Legion IV',type:'inf',x:615,y:245,men:6500,resolve:1.2,ai:{mode:'advance',delay:1}},
      {name:'Allied legion I',type:'inf',x:385,y:188,men:5500,resolve:1.2,ai:{mode:'advance',delay:4}},
      {name:'Allied legion II',type:'inf',x:462,y:188,men:5500,resolve:1.2,ai:{mode:'advance',delay:4}},
      {name:'Allied legion III',type:'inf',x:538,y:188,men:5500,resolve:1.2,ai:{mode:'advance',delay:4}},
      {name:'Allied legion IV',type:'inf',x:615,y:188,men:5500,resolve:1.2,ai:{mode:'advance',delay:4}},
      {name:'Roman horse',type:'cav',x:150,y:245,men:2400,ai:{mode:'advance',delay:1,pref:'cav'}},
      {name:'Allied horse',type:'cav',x:860,y:245,men:3600,ai:{mode:'advance',delay:1,pref:'cav'}},
      {name:'Consul Varro',type:'gen',x:500,y:128,men:500,ai:{mode:'general',delay:0}},
    ],
    events:[
      {t:1,msg:'The legions advance in deep, packed ranks.'},
      {t:22,msg:'The Roman weight is falling on your centre.'},
    ],
    history:'On 2 August 216 BC Hannibal’s centre bowed back exactly as planned. His African veterans turned in on the Roman flanks while Hasdrubal’s cavalry routed the Roman horse and struck the legions from behind. Packed too tightly to fight, the Roman army was surrounded and destroyed. Ancient sources put Roman dead at 50,000 or more, one of the bloodiest single days in history.',
  },
  agincourt:{
    foe:'The French army',
    name:'Agincourt',year:'1415',place:'Artois, northern France',you:'Henry V',sides:['England','France'],diff:'Moderate',
    teaser:'A sick, hungry English army is cornered. The ground between two woods is a ploughed field soaked by a night of rain.',
    objective:'Break the French battles',
    brief:['Your archers stand behind sharpened stakes. Horsemen that charge them will be impaled.','The ploughed field is deep mud. Anyone crossing it slows to a crawl and arrives exhausted.','Arrows do the most harm to horses and to men stuck in the mud. Plate armour shrugs off a lot of them.','Your men-at-arms are few. Hold the line at the edge of the field rather than wading in.'],
    deploy:470,
    terrain(x,y){if(inEll(x,y,AG.L)||inEll(x,y,AG.R))return 'woods';if(inEll(x,y,AG.M))return 'mud';return null},
    player:[
      {name:'Left archers',type:'arc',x:266,y:494,men:1400,stakes:true,resolve:0.85,f:UP+0.2},
      {name:'York’s men-at-arms',type:'heavy',x:344,y:505,men:600},
      {name:'Centre-left archers',type:'arc',x:422,y:505,men:1100,stakes:true,resolve:0.85},
      {name:'Henry’s battle',type:'heavy',x:500,y:507,men:700},
      {name:'Centre-right archers',type:'arc',x:578,y:505,men:1100,stakes:true,resolve:0.85},
      {name:'Camoys’ men-at-arms',type:'heavy',x:656,y:505,men:600},
      {name:'Right archers',type:'arc',x:734,y:494,men:1400,stakes:true,resolve:0.85,f:UP-0.2},
      {name:'King Henry V',type:'gen',x:500,y:565,men:200},
    ],
    enemy:[
      {name:'Mounted lances (L)',type:'cav',x:270,y:185,men:600,ai:{mode:'advance',delay:2,pref:'arc'}},
      {name:'Mounted lances (R)',type:'cav',x:730,y:185,men:600,ai:{mode:'advance',delay:2,pref:'arc'}},
      {name:'Constable’s vanguard',type:'heavy',x:380,y:175,men:2600,ai:{mode:'advance',delay:5}},
      {name:'Boucicaut’s vanguard',type:'heavy',x:467,y:175,men:2600,ai:{mode:'advance',delay:5}},
      {name:'Orléans’ division',type:'heavy',x:553,y:175,men:2600,ai:{mode:'advance',delay:5}},
      {name:'Bourbon’s division',type:'heavy',x:640,y:175,men:2600,ai:{mode:'advance',delay:5}},
      {name:'Alençon’s main battle',type:'heavy',x:420,y:95,men:2000,ai:{mode:'advance',delay:38}},
      {name:'Bar’s main battle',type:'heavy',x:500,y:95,men:2000,ai:{mode:'advance',delay:38}},
      {name:'Rear of the main battle',type:'heavy',x:580,y:95,men:2000,ai:{mode:'advance',delay:38}},
      {name:'Constable d\u2019Albret',type:'gen',x:500,y:40,men:300,ai:{mode:'general',delay:0}},
    ],
    events:[
      {t:2,msg:'The French horse charge straight for your archers.'},
      {t:8,msg:'The French vanguard trudges into the mud.'},
      {t:38,msg:'The second French battle advances.'},
    ],
    history:'On 25 October 1415 the French attacked across a narrow, rain-sodden field between the woods of Agincourt and Tramecourt. Their mounted charges broke on the archers’ stakes, and the dismounted men-at-arms who followed arrived exhausted and so tightly packed they could barely lift their weapons. English archers joined the melee with mallets and daggers. France lost thousands of nobles; English losses were a few hundred at most.',
  },
  hastings:{
    foe:'The Norman army',
    name:'Hastings',year:'1066',place:'Sussex, England',you:'Harold Godwinson',sides:['England','Normandy'],diff:'Hard',
    teaser:'Your shield wall holds the ridge. William needs a breakthrough before nightfall. Can you deny him one?',
    objective:'Hold the ridge until dusk',
    brief:['The ridge is your fortress: attackers climbing it hit far softer. Units that leave it lose that protection.','Shields stop most arrows, until the Norman archers start shooting high.','Beaten Norman units fall back to regroup and come again. Chasing them down the slope is exactly what William wants.','Your housecarls are the only reserve. Commit them carefully.'],
    deploy:420,
    terrain(x,y){return inEll(x,y,HILL)?'hill':null},
    timer:{t:170,label:'Dusk',win:'Dusk falls with your line unbroken. William has to withdraw.'},dusk:true,
    player:[
      {name:'Fyrd (west)',resolve:0.8,type:'shield',x:300,y:458,men:1400,w:96},
      {name:'Thegns of Wessex',resolve:0.8,type:'shield',x:400,y:458,men:1400,w:96},
      {name:'Harold’s standard',resolve:0.8,type:'shield',x:500,y:458,men:1400,w:96},
      {name:'Thegns of Kent',resolve:0.8,type:'shield',x:600,y:458,men:1400,w:96},
      {name:'Fyrd (east)',resolve:0.8,type:'shield',x:700,y:458,men:1400,w:96},
      {resolve:0.6,name:'Housecarls (reserve)',type:'heavy',x:500,y:518,men:900},
      {name:'King Harold',type:'gen',x:410,y:525,men:250},
    ],
    enemy:[
      {name:'Norman archers (W)',type:'arc',x:400,y:230,men:700,ai:{mode:'skirmish',delay:2}},
      {name:'Norman archers (E)',type:'arc',x:600,y:230,men:700,ai:{mode:'skirmish',delay:2}},
      {name:'Breton foot',type:'inf',x:320,y:170,men:2200,melee:1.1,ai:{mode:'advance',delay:14,regroup:true}},
      {name:'Norman foot',type:'inf',x:500,y:160,men:2200,melee:1.1,ai:{mode:'advance',delay:14,regroup:true}},
      {name:'Flemish foot',type:'inf',x:680,y:170,men:2200,melee:1.1,ai:{mode:'advance',delay:14,regroup:true}},
      {name:'Breton knights',type:'cav',x:300,y:95,men:1000,melee:1.25,ai:{mode:'advance',delay:28,regroup:true}},
      {name:'William’s knights',type:'cav',x:500,y:95,men:1000,melee:1.25,ai:{mode:'advance',delay:28,regroup:true}},
      {name:'Flemish knights',type:'cav',x:700,y:95,men:1000,melee:1.25,ai:{mode:'advance',delay:28,regroup:true}},
      {name:'Duke William',type:'gen',x:500,y:40,men:300,ai:{mode:'general',delay:0}},
    ],
    events:[
      {t:2,msg:'Norman archers move up to loose on the shield wall.'},
      {t:14,msg:'The Norman infantry starts up the slope.'},
      {t:28,msg:'William’s knights ride up to charge.'},
      {t:75,msg:'The Norman line is falling back. A rout, or a trap?',fn(b){for(const u of b.units){if(u.side==='E'&&u.ai&&u.type!=='arc'&&u.type!=='gen'&&!u.rout&&!u.gone){u.ai.mode='feint';u.ai.until=b.t+14;u.order=null}}}},
      {t:90,msg:'The knights wheel round, hunting anyone off the ridge.',fn(b){for(const u of b.units){if(u.side==='E'&&u.type==='cav'&&u.ai)u.ai.pref='offhill'}}},
      {t:120,msg:'The archers now shoot high, over the shields.',fn(b){b.plunge=true}},
      {t:150,msg:'The light is fading. Twenty seconds until dusk.'},
    ],
    history:'On 14 October 1066 Harold’s shield wall held Senlac Ridge for most of the day against archers, infantry and cavalry. Norman chroniclers describe feigned retreats that drew parts of the English line down the slope, where they were cut off. Late in the afternoon the wall thinned, Harold was killed, and the English army broke. William’s victory began the Norman conquest of England.',
  },
  austerlitz:{
    foe:'The Allied army',
    name:'Austerlitz',year:'1805',place:'Moravia, Austrian Empire',you:'Napoleon Bonaparte',sides:['France','Allied army'],diff:'Hard',era:'napoleon',
    teaser:'The Russian and Austrian emperors think your right flank is weak. Let them strike it, then break their centre on the Pratzen Heights.',
    objective:'Break the Allied army',
    brief:['Your right is thin on purpose. Davout and Legrand must hold the villages on the Goldbach stream while the Allies pour south.','Once the Allied columns leave the Pratzen Heights, send Soult’s divisions up the slope and split their army in two.','Line infantry fires volleys when it stands still in range. Order Charge to go in with the bayonet once the enemy wavers.','Artillery shoots far and hits dense columns hard, but it is helpless if cavalry reaches it.'],
    deploy:385,fog:22,pmod:{q:1.4,resolve:0.8},emod:{q:0.85,resolve:1.12},
    terrain(x,y){if(inEll(x,y,AUS.pond))return 'water';if(inEll(x,y,AUS.tel)||inEll(x,y,AUS.sok))return 'town';if(y>300&&Math.abs(x-goldX(y))<11)return 'stream';if(inEll(x,y,AUS.prat)||inEll(x,y,AUS.santon)||inEll(x,y,AUS.zuran))return 'hill';return null},
    player:[
      {name:'Napoleon',type:'gen',x:520,y:600,men:500},
      {name:'Lannes: Suchet',type:'line',x:230,y:432,men:6000},
      {name:'Lannes: Caffarelli',type:'line',x:310,y:470,men:5500},
      {name:'Soult: Vandamme',type:'line',x:440,y:445,men:7000,resolve:0.85},
      {name:'Soult: Saint-Hilaire',type:'line',x:575,y:445,men:6500,resolve:0.85},
      {name:'Legrand at Sokolnitz',type:'line',x:700,y:505,men:4500,resolve:0.8},
      {name:'Davout: Friant',type:'line',x:760,y:600,men:4000,resolve:0.7},
      {name:'Oudinot’s grenadiers',type:'line',x:410,y:545,men:5500,melee:1.05},
      {name:'Imperial Guard',type:'line',x:560,y:550,men:5500,melee:1.25,resolve:0.5},
      {name:'Murat: cuirassiers',type:'cav',x:150,y:510,men:4000,melee:1.4},
      {name:'Guard cavalry',type:'cav',x:650,y:590,men:1200,melee:1.35},
      {name:'Santon battery',type:'art',x:150,y:432,men:900},
      {name:'Grand battery',type:'art',x:480,y:500,men:1200},
    ],
    enemy:[
      {name:'Kutuzov',type:'gen',x:540,y:150,men:500,ai:{mode:'general',delay:0}},
      {name:'Bagration',type:'line',x:200,y:215,men:9000,ai:{mode:'advance',delay:18}},
      {name:'Liechtenstein’s cavalry',type:'cav',x:330,y:215,men:4600,ai:{mode:'advance',delay:8,pref:'cav'}},
      {name:'Kollowrat (Pratzen)',type:'line',x:470,y:230,men:9000,ai:{mode:'advance',delay:30}},
      {name:'Miloradovich (Pratzen)',type:'line',x:590,y:240,men:8000,ai:{mode:'advance',delay:26}},
      {name:'Przybyszewski’s column',type:'line',x:690,y:185,men:8000,ai:{mode:'advance',delay:4,wps:[{x:690,y:330},{x:705,y:440}]}},
      {name:'Langeron’s column',type:'line',x:780,y:210,men:9000,ai:{mode:'advance',delay:2,wps:[{x:780,y:360},{x:760,y:500}]}},
      {name:'Dokhturov’s column',type:'line',x:870,y:240,men:9000,ai:{mode:'advance',delay:1,wps:[{x:860,y:400},{x:800,y:560}]}},
      {name:'Russian Imperial Guard',type:'line',x:470,y:95,men:7000,melee:1.2,resolve:0.7,ai:{mode:'advance',delay:45}},
      {name:'Guard cavalry (Constantine)',type:'cav',x:600,y:95,men:2500,melee:1.3,ai:{mode:'advance',delay:48}},
      {name:'Allied batteries',type:'art',x:530,y:300,men:1000,ai:{mode:'skirmish',delay:3}},
    ],
    events:[
      {t:1,msg:'Morning fog fills the valley. Allied columns march south against your right.'},
      {t:22,msg:'The sun of Austerlitz breaks through the fog.'},
      {t:26,msg:'The Allied centre on the Pratzen is moving off the heights.'},
      {t:45,msg:'The Russian Imperial Guard advances to retake the heights.'},
    ],
    history:'On 2 December 1805, a year to the day after his coronation, Napoleon deliberately weakened his right to tempt the Allies. As Russian and Austrian columns streamed south against Davout’s thin line along the Goldbach, Soult’s divisions climbed out of the fog onto the Pratzen Heights and cut the Allied army in two. A desperate charge by the Russian Imperial Guard was thrown back, and the Allied left was driven against the frozen ponds. Austria made peace within weeks.',
  },
  ironbridge:{
    foe:'The Vostrian assault',
    name:'Ironbridge',year:'21st c.',place:'Fictional scenario',you:'Col. Mara Lind',sides:['Westmark','Vostrian Army'],diff:'Hard',era:'modern',
    teaser:'A fictional modern battle. Your thin brigade must hold a river crossing against an armoured assault until reinforcements arrive.',
    objective:'Hold the crossing until reinforcements arrive',
    brief:['The enemy can only cross at the bridge and the shallow ford. Kill them where they bunch up.','Tanks beat tanks and vehicles. Anti-tank teams beat tanks. Infantry is only safe in the town, where it gets cover.','Your artillery reaches across the whole map but cannot fire at targets right next to it.','Drones hunt your tanks. IFV autocannons and riflemen can shoot them down.'],
    river:{y:x=>riverY(x),cross:[{x0:478,x1:528},{x0:795,x1:855}]},
    deploy:360,leth:0.42,pmod:{q:1.3},timer:{t:180,label:'Reinforcements',win:'Reinforcements arrive with the crossing still in your hands. The assault has failed.'},
    terrain(x,y){if(Math.abs(y-riverY(x))<18){if(x>478&&x<528)return 'bridge';if(x>795&&x<855)return 'ford';return 'river'}
      if(x>IB.town.x0&&x<IB.town.x1&&y>IB.town.y0&&y<IB.town.y1)return 'town';if(inEll(x,y,IB.wl)||inEll(x,y,IB.wr)||inEll(x,y,IB.wn))return 'woods';return null},
    player:[
      {name:'Brigade HQ',type:'gen',x:500,y:605,men:200,armor:'light'},
      {name:'Tank company A',type:'tank',x:420,y:405,men:900},
      {name:'Tank company B',type:'tank',x:640,y:405,men:900},
      {name:'Mech company',type:'ifv',x:290,y:430,men:800},
      {name:'1st Rifle company',type:'minf',x:450,y:470,men:1200},
      {name:'2nd Rifle company',type:'minf',x:560,y:475,men:1200},
      {name:'Anti-tank platoon',type:'atgm',x:780,y:420,men:500},
      {name:'Artillery battery',type:'howz',x:700,y:610,men:800},
      {name:'Drone section',type:'drone',x:300,y:600,men:400},
    ],
    enemy:[
      {name:'Vostrian HQ',type:'gen',x:500,y:40,men:300,armor:'light',ai:{mode:'general',delay:0}},
      {name:'1st Tank battalion',type:'tank',x:400,y:150,men:1400,ai:{mode:'advance',delay:3,wps:[{x:503,y:270},{x:503,y:380}]}},
      {name:'2nd Tank battalion',type:'tank',x:640,y:150,men:1400,ai:{mode:'advance',delay:6,wps:[{x:825,y:270},{x:825,y:385}]}},
      {name:'1st Motor rifles',type:'ifv',x:300,y:205,men:1300,ai:{mode:'advance',delay:9,wps:[{x:503,y:270},{x:503,y:380}]}},
      {name:'2nd Motor rifles',type:'ifv',x:720,y:205,men:1300,ai:{mode:'advance',delay:11,wps:[{x:825,y:270},{x:825,y:385}]}},
      {name:'Assault infantry',type:'minf',x:500,y:215,men:1500,ai:{mode:'advance',delay:14,wps:[{x:503,y:270},{x:503,y:385}]}},
      {name:'Recon company',type:'ifv',x:880,y:230,men:700,ai:{mode:'advance',delay:2,wps:[{x:825,y:275},{x:825,y:390}]}},
      {name:'Artillery group',type:'howz',x:420,y:60,men:1000,ai:{mode:'skirmish',delay:6}},
      {name:'Rocket battery',type:'howz',x:620,y:55,men:800,ai:{mode:'skirmish',delay:20}},
      {name:'Drone swarm',type:'drone',x:500,y:100,men:500,ai:{mode:'advance',delay:55,pref:'tank'}},
      {name:'Second echelon',type:'tank',x:500,y:70,men:1400,ai:{mode:'advance',delay:75,wps:[{x:503,y:270},{x:503,y:385}]}},
    ],
    events:[
      {t:1,msg:'Enemy armour is moving on the bridge and the ford.'},
      {t:6,msg:'Incoming artillery!'},
      {t:55,msg:'Enemy drones overhead, hunting your tanks.'},
      {t:75,msg:'A second enemy echelon is moving up to the bridge.'},
      {t:150,msg:'Reinforcements are thirty seconds out. Hold!'},
    ],
    history:'Ironbridge is a fictional battle. It shows the logic of modern combined arms: a defender behind a river can force an attacker into a few crossing points, where tanks, anti-tank missiles and artillery concentrate fire. Infantry survives by using buildings for cover, drones scout and strike from above, and air defence decides who keeps them. No single weapon wins on its own; the side that combines them better usually holds the ground.',
  },
};

function sideMen(b,side){let m=0;for(const u of b.units)if(u.side===side&&!u.gone&&!u.rout)m+=u.men;return m}
function makeBattle(id,diff){
  const s=SCEN[id];let n=1;const units=[];
  const add=(side,u)=>{const T=TYPES[u.type];units.push({id:n++,side,name:u.name,type:u.type,x:u.x,y:u.y,facing:u.f??(side==='P'?UP:DOWN),men:u.men,maxMen:u.maxMen||u.men,ci:u.ci,morale:100,speed:u.speed||T.speed,melee:u.melee||T.melee,def:u.def||T.def,w:u.w||T.w,d:T.d,dd:T.d,stakes:!!u.stakes,resolve:u.resolve||((side==='P'?s.pmod:s.emod)||{}).resolve||1,q:u.q||((side==='P'?s.pmod:s.emod)||{}).q||1,stillT:0,stance:'hold',fire:true,armor:u.armor||T.armor,air:!!T.air,aura:u.type==='gen'?150:0,rallyCd:0,wantFace:null,inspired:false,ai:u.ai?{...u.ai,base:u.ai.mode,wi:0}:null,order:null,rout:false,gone:false,contacts:[],prevC:0,contactSince:-1,chargeT:0,vel:0,fatigue:0,quiet:0,underFire:0,dmg:0,mdmg:0,killed:0,fled:0,firing:null,fxT:0,moving:false})};
  s.player.forEach(u=>add('P',u));s.enemy.forEach(u=>add('E',u));
  const b={id,s,units,t:0,result:null,fx:[],msgs:[],evDone:new Set(),plunge:false,aiT:0,genDown:{}};
  if(diff==='normal'&&!s.mirror)for(const u of units)if(u.side==='P'){u.q*=1.2;u.resolve*=0.85}
  b.diff=diff||'historical';
  b.init={P:sideMen(b,'P'),E:sideMen(b,'E')};
  return b;
}
const terr=(b,x,y)=>b.s.terrain(x,y);
function radTo(u,a){const l=a-u.facing,c=Math.cos(l),s=Math.sin(l),dd=u.dd/2,ww=u.w/2;return 1/Math.sqrt((c/dd)**2+(s/ww)**2)}
function byId(b,id){return b.units.find(u=>u.id===id)}
function dist(a,c){return Math.hypot(a.x-c.x,a.y-c.y)}
function nearest(u,list){let best=null,bd=1e9;for(const c of list){const d=dist(u,c);if(d<bd){bd=d;best=c}}return best}
function setOrd(b,u,o){o.t=b.t;u.order=o}
function turnTo(u,target,rate,dt){const df=norm(target-u.facing);const m=rate*dt;u.facing=norm(u.facing+(Math.abs(df)<m?df:Math.sign(df)*m))}

function chooseTarget(b,u,foes,pref){
  let c=foes;
  if(pref==='offhill'){const off=foes.filter(f=>terr(b,f.x,f.y)!=='hill');if(off.length)c=off}
  else if(pref){const p=foes.filter(f=>f.type===pref&&dist(u,f)<520);if(p.length)c=p}
  return nearest(u,c);
}
function rally(b,g){
  if(!g||g.rallyCd>0||g.rout||g.gone)return -1;let n=0;
  for(const o of b.units){if(o.side!==g.side||o.gone||dist(o,g)>=g.aura)continue;
    if(o.rout&&o.men>o.maxMen*0.2){o.rout=false;o.morale=35;o.order=null;o.wantFace=null;n++}
    else if(!o.rout)o.morale=Math.min(100,o.morale+15)}
  g.rallyCd=45;
  b.msgs.push({text:`${g.name} rallies the troops${n?`: ${n} unit${n>1?'s':''} turn back to fight`:''}.`,kind:g.side==='P'?'good':'bad'});
  return n;
}
function aiTick(b,L){
  for(const u of L){if(u.side!=='P'||u.rout||u.stance!=='aggr'||u.order||u.contacts.length||u.type==='gen')continue;
    let t=null,bd=130;for(const c of L){if(c.side==='P'||c.rout)continue;const d=dist(u,c);if(d<bd){bd=d;t=c}}
    if(t)setOrd(b,u,{kind:'attack',target:t.id});}
  const foes=L.filter(u=>u.side==='P'&&!u.rout);
  for(const u of L){
    if(u.side!=='E'||u.rout||!u.ai)continue;const ai=u.ai;
    if(b.t<ai.delay)continue;
    if(ai.mode==='general'){
      if(u.rallyCd<=0&&L.some(o=>o.side==='E'&&o.rout&&!o.gone&&o.men>o.maxMen*0.2&&dist(o,u)<u.aura))rally(b,u);
      if(u.contacts.length)continue;
      const own=L.filter(o=>o.side==='E'&&!o.rout&&o!==u);if(!own.length)continue;
      let cx=0,cy=0;for(const o of own){cx+=o.x;cy+=o.y}cx/=own.length;cy/=own.length;const ty=Math.max(40,cy-110);
      if(Math.hypot(cx-u.x,ty-u.y)>30)setOrd(b,u,{kind:'move',x:cx,y:ty});continue;
    }
    if(ai.mode==='escort'){if(u.contacts.length)continue;const own=L.filter(o=>o.side==='E'&&!o.rout&&o!==u&&!o.air&&o.type!=='gen');if(!own.length)continue;
      let cx=0,cy=0;for(const o of own){cx+=o.x;cy+=o.y}cx/=own.length;cy/=own.length;const ty=Math.max(30,cy-60);if(Math.hypot(cx-u.x,ty-u.y)>30)setOrd(b,u,{kind:'move',x:cx,y:ty});continue}
    if(ai.regroup&&ai.mode!=='regroup'&&ai.mode!=='feint'&&u.morale<38){ai.mode='regroup';setOrd(b,u,{kind:'move',x:u.x,y:Math.max(110,u.y-170)});continue}
    if(ai.mode==='regroup'){if(u.morale>80)ai.mode=ai.base;else continue}
    if(ai.mode==='feint'){if(b.t>ai.until){ai.mode=ai.base}else{if(!u.order)setOrd(b,u,{kind:'move',x:u.x,y:140});continue}}
    if(u.contacts.length||!foes.length)continue;
    const RG=(TYPES[u.type].ranged||{range:RANGE}).range;
    if(ai.mode==='skirmish'){const t=nearest(u,foes.filter(f=>!TYPES[u.type].ranged||WEAP[TYPES[u.type].ranged.w][f.armor]>0))||nearest(u,foes),d=dist(u,t);
      if(d>RG*0.92){const k=(d-RG*0.8)/d;setOrd(b,u,{kind:'move',x:u.x+(t.x-u.x)*k,y:u.y+(t.y-u.y)*k})}
      else if(u.order&&d<RG*0.85)u.order=null;continue}
    if(ai.wps&&ai.wi<ai.wps.length){const nr=nearest(u,foes);
      if(!nr||dist(u,nr)>175){const w=ai.wps[ai.wi];if(Math.hypot(w.x-u.x,w.y-u.y)<24)ai.wi++;else if(!u.order||u.order.kind!=='move'||u.order.x!==w.x)setOrd(b,u,{kind:'move',x:w.x,y:w.y});continue}
      ai.wi=ai.wps.length}
    const T=TYPES[u.type],RR=T.ranged;
    const t=chooseTarget(b,u,RR?foes.filter(f=>WEAP[RR.w][f.armor]>0).concat([]):foes,ai.pref)||chooseTarget(b,u,foes,ai.pref);
    const chg=T.charge&&t.morale<45&&dist(u,t)<RR.range*1.1;
    if(!u.order||u.order.kind!=='attack'||u.order.target!==t.id||(chg&&!u.order.charge))setOrd(b,u,{kind:'attack',target:t.id,charge:chg});
  }
}
function melee(b,a,c,share,dt){
  let mult=1,mor=0;
  if(c.rout)mult=2.5;
  else{const df=Math.abs(norm(Math.atan2(a.y-c.y,a.x-c.x)-c.facing));if(df>2.1){mult=2.2;mor=12}else if(df>1.05){mult=1.5;mor=3.5}}
  if(a.chargeT>0&&(a.type==='cav'||a.type==='gen')&&c.type!=='shield'&&!c.stakes)mult*=2.4;
  else if(a.chargeT>0)mult*=1.5;
  if(a.type==='cav'&&c.type==='shield')mult*=0.5;
  if(a.type==='cav'&&c.stakes)mult*=0.4;
  if(c.type==='cav'&&a.type==='shield')mult*=1.8;
  if(c.type==='cav'&&a.stakes)mult*=2.5;
  const ta=terr(b,a.x,a.y),tc=terr(b,c.x,c.y);
  if(ta==='mud')mult*=0.55;
  if(ta==='stream'||ta==='ford')mult*=0.6;
  mult*=1-0.5*a.fatigue;
  if(tc==='mud')mult*=1.25;
  if(tc==='hill'&&ta!=='hill')mult*=0.5;
  if(tc==='town')mult*=0.7;
  mult*=a.crowd;
  const loss=eff(a.men)*K.melee*a.melee*share*mult*a.q/c.def*dt;
  c.dmg+=loss;c.mdmg+=loss/c.maxMen*K.mor+mor*K.flank*dt;
  if(Math.random()<dt*5*share)b.fx.push({k:'dust',x:(a.x+c.x)/2+(Math.random()-.5)*20,y:(a.y+c.y)/2+(Math.random()-.5)*14,life:.7,max:.7});
}
function routUnit(b,u,L){
  u.rout=true;u.order=null;u.morale=0;
  b.msgs.push({text:`${u.name} breaks and flees.`,kind:u.side==='P'?'bad':'good'});
  for(const o of L)if(o!==u&&o.side===u.side&&!o.rout&&dist(o,u)<170)o.morale-=K.cascade;
  if(u.type==='gen'&&!b.genDown[u.side]){b.genDown[u.side]=true;b.msgs.push({text:`${u.name} has fallen! The whole army wavers.`,kind:u.side==='P'?'bad':'good'});for(const o of L)if(o.side===u.side&&!o.rout)o.morale-=20}
}
function shotFx(b,a,c,RW){
  const rnd=Math.random,jx=s=>(rnd()-.5)*s;
  const P=(n,o)=>{for(let k=0;k<n;k++)b.fx.push(Object.assign({x0:a.x+jx(a.w*.7),y0:a.y+jx(8),x1:c.x+jx(c.w*.7),y1:c.y+jx(10),side:a.side,delay:rnd()*.25},o))};
  switch(RW.w){
    case 'arrow':a.fxT=0.45;P(5,{k:'arrow',life:.55,max:.55});break;
    case 'musket':a.fxT=0.9;P(1,{k:'volley',life:1.6,max:1.6,delay:0,n:a.w});P(3,{k:'hit',life:.4,max:.4});break;
    case 'cannon':a.fxT=1.1;P(1,{k:'cannon',life:.7,max:.7,delay:0});P(1,{k:'boom',life:.9,max:.9,delay:.6});break;
    case 'rifle':a.fxT=0.35;P(3,{k:'tracer',life:.25,max:.25});break;
    case 'autocannon':a.fxT=0.3;P(3,{k:'tracer',life:.22,max:.22,big:1});break;
    case 'tankgun':a.fxT=1.3;P(1,{k:'tracer',life:.18,max:.18,big:2,delay:0});P(1,{k:'boom',life:.8,max:.8,delay:.15});P(1,{k:'muzzle',life:.4,max:.4,delay:0});break;
    case 'atgm':a.fxT=1.8;P(1,{k:'missile',life:1.1,max:1.1,delay:0});P(1,{k:'boom',life:.9,max:.9,delay:1});break;
    case 'shell':a.fxT=1.6;P(1,{k:'shell',life:1.6,max:1.6,delay:0});P(2,{k:'boom',life:1,max:1,delay:1.5});break;
    case 'hellfire':a.fxT=1.5;P(1,{k:'missile',life:.9,max:.9,delay:0});P(1,{k:'boom',life:.9,max:.9,delay:.8});break;
    case 'sam':a.fxT=1.6;P(1,{k:'missile',life:.8,max:.8,delay:0,up:1});P(1,{k:'boom',life:.6,max:.6,delay:.75,air:1});break;
    case 'kamikaze':a.fxT=.9;P(1,{k:'boom',life:.9,max:.9,delay:0});break;
    case 'missile':a.fxT=1.4;P(1,{k:'tracer',life:.35,max:.35,big:1,delay:0});P(1,{k:'boom',life:.8,max:.8,delay:.3});break;
  }
}
function riverInfo(b){const s=b.s;if(s._ri!==undefined)return s._ri;
  if(s.gen&&s.gen.river)return s._ri={y:x=>gRiverY(s.gen,x),cross:s.gen.river.cross};
  if(s.river)return s._ri=s.river;return s._ri=null}
function blocked(b,u,x,y){if(u.air)return false;const t=terr(b,x,y);return t==='river'||t==='water'}
function step(b,dt){
  if(b.result)return;
  b.t+=dt;
  const L=b.units.filter(u=>!u.gone);
  b.s.events.forEach((e,i)=>{if(b.evDone.has(i))return;if(b.t>=e.t){b.evDone.add(i);if(e.fn)e.fn(b);b.msgs.push({text:e.msg,kind:'event'})}});
  b.aiT-=dt;if(b.aiT<=0){b.aiT=0.3;aiTick(b,L)}
  for(const u of L){u.prevC=u.contacts.length;u.contacts=[];u.underFire=Math.max(0,u.underFire-dt);u.dmg=0;u.mdmg=0}
  for(let i=0;i<L.length;i++)for(let j=i+1;j<L.length;j++){
    const a=L[i],c=L[j];if(a.side===c.side||a.air||c.air)continue;
    const dx=c.x-a.x,dy=c.y-a.y,d=Math.hypot(dx,dy);if(d>140)continue;
    const an=Math.atan2(dy,dx);if(d<radTo(a,an)+radTo(c,an+Math.PI)+6){a.contacts.push(c);c.contacts.push(a)}
  }
  for(const u of L){
    if(u.contacts.length&&u.prevC===0){u.contactSince=b.t;
      if((u.type==='cav'||u.type==='gen')&&!u.rout&&u.vel>u.speed*0.5&&b.t-(u.lastCharge||-99)>8){u.chargeT=2;u.lastCharge=b.t;for(const c of u.contacts)if(c.type!=='shield'&&!c.stakes)c.mdmg+=14}
      else if(u.order&&u.order.charge&&u.type!=='arc'&&!u.rout){u.chargeT=1.5;for(const c of u.contacts)c.mdmg+=8}}
    if(!u.contacts.length)u.contactSince=-1;
    u.chargeT=Math.max(0,u.chargeT-dt);u.rallyCd=Math.max(0,u.rallyCd-dt);
  }
  for(const a of L){let n=0;for(const o of L)if(o!==a&&o.side===a.side&&!o.rout&&dist(o,a)<75)n++;a.crowd=n>=2?0.7:n===1?0.88:1}
  for(const a of L){if(a.rout||!a.contacts.length)continue;const sh=1/a.contacts.length;for(const c of a.contacts)melee(b,a,c,sh,dt)}
  for(const a of L){
    const RW=TYPES[a.type].ranged;
    if(!RW||a.rout||!a.fire||a.contacts.length||(a.moving&&!RW.move)){a.firing=null;continue}
    const WT=WEAP[RW.w];let best=null,bs=1e9;
    for(const c of L){if(c.side===a.side)continue;const em=WT[c.armor];if(!em)continue;const d=dist(a,c);if(d>RW.range||d<(RW.min||0))continue;const sc=d*(c.rout?2.5:1)/(0.4+em);if(sc<bs){bs=sc;best=c}}
    if(a.order&&a.order.kind==='attack'){const ft=byId(b,a.order.target);if(ft&&!ft.gone&&WT[ft.armor]&&dist(a,ft)<=RW.range&&dist(a,ft)>=(RW.min||0))best=ft}
    if(a.firing!==best)a.fireT=0;a.firing=best;if(!best)continue;const c=best;a.fireT=(a.fireT||0)+dt;
    let m=WT[c.armor];
    if(RW.w==='arrow'&&c.armor==='shield'&&b.plunge&&a.side==='E')m=0.9;
    if(a.moving)m*=0.5;
    const tc=terr(b,c.x,c.y),ta=terr(b,a.x,a.y);
    if(tc==='mud')m*=1.5;if(tc==='woods')m*=0.5;if(tc==='hill'&&ta!=='hill')m*=0.85;if(tc==='town')m*=c.armor==='heavy'?0.7:0.45;
    if(c.stillT>4&&!c.air)m*=0.75;
    if(JAMMED.has(RW.w)&&jammedAt(b,c.side,c.x,c.y))m*=0.45;
    const loss=eff(a.men)*K.ranged*RW.dmg*m*a.q*(b.s.leth||1)*dt;
    const flat=(c.armor==='horse'?0.8:0.2)+(tc==='mud'?1.2:0);
    c.dmg+=loss;c.mdmg+=loss/c.maxMen*200+flat*dt;c.underFire=1;
    if(RW.splash)for(const o of L){if(o===c||o.side===a.side||o.air)continue;const dd=dist(o,c);if(dd<RW.splash){const k=0.4*(1-dd/RW.splash)*(WT[o.armor]||0);o.dmg+=loss*k;o.mdmg+=loss*k/o.maxMen*200;o.underFire=1}}
    if(RW.w==='kamikaze')a.men=Math.max(0,a.men-a.maxMen*0.045*dt);
    a.fxT-=dt;if(a.fxT<=0){shotFx(b,a,c,RW)}
  }
  const gens=L.filter(g=>g.type==='gen'&&!g.rout&&!g.gone);
  for(const u of L){
    u.inspired=gens.some(g=>g!==u&&g.side===u.side&&dist(g,u)<g.aura);
    if(u.dmg){const k=Math.min(u.men,u.dmg);u.men-=k;u.killed+=k}
    u.morale-=u.mdmg*u.resolve*(u.inspired?0.75:1);
    if(u.contacts.length&&!u.rout)u.morale-=0.3*dt;
    if(!u.contacts.length&&!u.underFire)u.quiet+=dt;else u.quiet=0;
    if(u.quiet>2&&!u.rout)u.morale=Math.min(100,u.morale+((u.ai&&u.ai.mode==='regroup'?3.5:2)+(u.inspired?1.5:0))*dt);
    const tt=terr(b,u.x,u.y);
    if(tt==='mud'&&u.moving)u.fatigue=Math.min(0.85,u.fatigue+0.05*K.speed*dt);else if(tt!=='mud')u.fatigue=Math.max(0,u.fatigue-0.01*dt);
    u.dd=Math.max(7,u.d*(0.4+0.6*Math.sqrt(Math.max(0,u.men)/u.maxMen)));
    if(!u.rout&&(u.morale<=0||u.men<u.maxMen*0.18))routUnit(b,u,L);
    if(u.men<1){u.gone=true;u.men=0}
  }
  for(const u of L){
    if(u.gone)continue;u.moving=false;
    let tx,ty,spd=u.speed*K.speed;
    if(u.rout){tx=u.x;ty=u.side==='P'?H+80:-80;spd*=1.2}
    else if(u.order){
      const o=u.order;
      if(u.contacts.length&&o.t<u.contactSince)u.order=null;
      else{
        if(o.kind==='attack'){const tg=byId(b,o.target);const RW=TYPES[u.type].ranged;if(!tg||tg.gone)u.order=null;else if(u.contacts.includes(tg))turnTo(u,Math.atan2(tg.y-u.y,tg.x-u.x),0.6,dt);else if(RW&&!o.charge&&dist(u,tg)<=RW.range*0.88&&dist(u,tg)>=(RW.min||0)&&WEAP[RW.w][tg.armor]>0){if(!u.air)turnTo(u,Math.atan2(tg.y-u.y,tg.x-u.x),1.5,dt)}else{tx=tg.x;ty=tg.y}}
        else{if(Math.hypot(o.x-u.x,o.y-u.y)<3){u.order=null;if(o.face!=null)u.wantFace=o.face}else{tx=o.x;ty=o.y}}
        if(o.charge)spd*=(u.type==='cav'||u.type==='gen')?1.15:1.35;
        if(o.keepFace)spd*=0.6;
        if(u.contacts.length&&tx!==undefined)spd*=0.45;
      }
    }
    const RI=riverInfo(b);
    if(RI&&!u.air&&tx!==undefined){const ry=RI.y(u.x),sy=Math.sign(u.y-ry)||1,ty2=Math.sign(ty-RI.y(tx))||1;
      if(sy!==ty2){const inC=RI.cross.find(c=>u.x>c.x0+5&&u.x<c.x1-5);
        if(inC){const cx=(inC.x0+inC.x1)/2;tx=cx;ty=RI.y(cx)-sy*34}
        else{let best=null,bd=1e9;for(const c of RI.cross){const cx=(c.x0+c.x1)/2,d=Math.abs(cx-u.x)+Math.abs(cx-tx)*0.6;if(d<bd){bd=d;best=cx}}if(best!=null){tx=best;ty=RI.y(best)+sy*30}}}}
    const ox=u.x,oy=u.y;
    if(tx!==undefined){
      const dx=tx-u.x,dy=ty-u.y,d=Math.hypot(dx,dy);
      if(d>0.5){
        const t=u.air?null:terr(b,u.x,u.y);let f=1,veh=VEH.has(u.type);
        if(t==='mud')f=0.3;else if(t==='woods')f=u.type==='cav'?0.25:veh?0.35:0.45;else if(t==='hill')f=0.85;else if(t==='ford')f=0.35;else if(t==='stream')f=0.5;else if(t==='bridge')f=0.85;else if(t==='town')f=veh?0.6:0.8;
        if(u.air&&(u.type==='drone'||u.type==='lm')&&jammedAt(b,u.side==='P'?'E':'P',u.x,u.y))f*=0.55;
        const st=Math.min(d,spd*f*dt),nx=u.x+dx/d*st,ny=u.y+dy/d*st;
        if(!blocked(b,u,nx,ny)){u.x=nx;u.y=ny}else if(!blocked(b,u,nx,u.y))u.x=nx;else if(!blocked(b,u,u.x,ny))u.y=ny;
        u.moving=true;
        if(u.rout||!(u.contacts.length||(u.order&&u.order.keepFace)))turnTo(u,Math.atan2(dy,dx),(u.type==='cav'||u.type==='gen'||u.air)?6:VEH.has(u.type)?2.6:3.3,dt);
      }
    } else if(u.contacts.length&&!u.rout){
      const live=u.contacts.filter(c=>!c.rout);
      const front=live.some(c=>Math.abs(norm(Math.atan2(c.y-u.y,c.x-u.x)-u.facing))<1.05);
      const p=live.sort((x,y)=>y.men-x.men)[0];
      if(p&&!front)turnTo(u,Math.atan2(p.y-u.y,p.x-u.x),u.type==='cav'?1.2:u.type==='shield'?0.35:0.5,dt);
    } else if(u.wantFace!=null){turnTo(u,u.wantFace,1.8,dt);if(Math.abs(norm(u.wantFace-u.facing))<0.02)u.wantFace=null}
    else if(u.firing){turnTo(u,Math.atan2(u.firing.y-u.y,u.firing.x-u.x),1,dt)}
    u.vel=Math.hypot(u.x-ox,u.y-oy)/dt;u.stillT=u.vel>1?0:u.stillT+dt;
  }
  for(let i=0;i<L.length;i++)for(let j=i+1;j<L.length;j++){
    const a=L[i],c=L[j];if(a.gone||c.gone||a.air!==c.air)continue;
    const dx=c.x-a.x,dy=c.y-a.y,d=Math.hypot(dx,dy);if(d>140||d<0.01)continue;
    const an=Math.atan2(dy,dx);let min=radTo(a,an)+radTo(c,an+Math.PI);
    if(a.side===c.side)min*=0.92;if(a.rout||c.rout)min*=0.5;
    if(d<min){const wa=a.moving||a.rout?1:0.15,wc=c.moving||c.rout?1:0.15,p=(min-d),ux=dx/d,uy=dy/d,pa=p*wa/(wa+wc),pc=p*wc/(wa+wc);
      const ax=a.x-ux*pa,ay=a.y-uy*pa,cx=c.x+ux*pc,cy=c.y+uy*pc;
      if(!blocked(b,a,ax,ay)){a.x=ax;a.y=ay}if(!blocked(b,c,cx,cy)){c.x=cx;c.y=cy}}
  }
  for(const u of L){
    if(u.gone)continue;
    u.x=Math.max(8,Math.min(W-8,u.x));
    if(u.rout){if(u.y<-40||u.y>H+40){u.gone=true;u.fled=u.men}}
    else u.y=Math.max(8,Math.min(H-8,u.y));
  }
  const pm=sideMen(b,'P'),em=sideMen(b,'E');
  const pb=pm<b.init.P*0.22,eb=em<b.init.E*0.22;
  if(b.s.timer&&b.t>=b.s.timer.t&&!pb)b.result={win:true,reason:b.s.timer.win};
  else if(eb&&pb)b.result=pm/b.init.P>=em/b.init.E?{win:true,reason:'Both armies are spent, but the enemy breaks first.'}:{win:false,reason:'Both armies are spent, but yours breaks first.'};
  else if(eb)b.result={win:true,reason:`${b.s.foe} has broken and flees the field.`};
  else if(pb)b.result={win:false,reason:`Your army has broken. ${b.s.foe} holds the field.`};
}
// SIM-END

/* ---------- terrain: decor, heights, painted map ---------- */
function smoothstep(t){t=Math.max(0,Math.min(1,t));return t*t*(3-2*t)}
function ellH(x,y,e,h,sx){const d=Math.sqrt(((x-e.cx)/(e.rx*(sx||1)))**2+((y-e.cy)/(e.ry*(sx||1)))**2);return h*smoothstep(1-d)}
function undul(x,y,a){return a*(Math.sin(x/97)*Math.cos(y/83)+0.5*Math.sin(x/41+y/53)+1.5)}
const HEIGHT={
  cannae(x,y){const rx=riverX(y)+18;return undul(x,y,3)-(x<rx+10?8*smoothstep((rx+10-x)/16):0)},
  agincourt(x,y){return undul(x,y,2.5)-(inEll(x,y,AG.M)?1:0)},
  hastings(x,y){return undul(x,y,2)+ellH(x,y,HILL,58,1.08)+ellH(x,y,{cx:500,cy:-20,rx:330,ry:150},26)},
  austerlitz(x,y){let h=undul(x,y,2.5)+ellH(x,y,AUS.prat,46,1.35)+ellH(x,y,AUS.santon,26,1.3)+ellH(x,y,AUS.zuran,22,1.3);
    if(y>300&&Math.abs(x-goldX(y))<16)h-=4*smoothstep(1-Math.abs(x-goldX(y))/16);if(inEll(x,y,AUS.pond))h=-5;return h},
  ironbridge(x,y){let h=undul(x,y,3);const d=Math.abs(y-riverY(x));if(d<30&&!(x>478&&x<528))h-=11*smoothstep(1-d/30);return h},
};
const heightBase=(id,x,y)=>HEIGHT[id]?HEIGHT[id](x,y):(SCEN[id]&&SCEN[id].gen?genHeight(SCEN[id].gen,x,y):0);
/* real relief: hills rise properly out of the plain, valleys cut deeper, and the ground gets natural unevenness */
function hnoise(x,y){return Math.sin(x*.031+Math.sin(y*.017)*2.1)*Math.cos(y*.027-x*.011)+.5*Math.sin(x*.067+y*.049+1.3)*Math.cos(y*.071-.4)+.25*Math.sin(x*.13-y*.11+2.1)}
const RELIEF={};function reliefOf(id){if(RELIEF[id]!=null)return RELIEF[id];const s=SCEN[id],th=s&&s.gen?s.gen.theatre:'land';return RELIEF[id]=(th==='sea'||th==='space'||th==='city')?0:1}
const heightAt=(id,x,y)=>{const h=heightBase(id,x,y);if(!reliefOf(id))return h;const up=h>6?7.5+(h-6)*2.2:h>0?h*1.25:h*1.5,hill=Math.max(0,Math.min(1,(h-5)/22));return up+hnoise(x,y)*(1.1+hill*4.5)};
let PAINT3D=false;
const decorCache={};
function decor(id){
  if(decorCache[id])return decorCache[id];
  const R=rng(id.length*313+17),D={trees:[],houses:[],tents:[],camps:[],labels:[]};
  const wood=(e,n,r0,r1)=>{for(let i=0;i<n;i++){const a=R()*7,r=Math.sqrt(R())*0.95,x=e.cx+Math.cos(a)*e.rx*r,y=e.cy+Math.sin(a)*e.ry*r;if(x>-6&&x<W+6&&y>-6&&y<H+6)D.trees.push([x,y,r0+R()*(r1-r0)])}};
  const village=(cx,cy,n,sp)=>{for(let i=0;i<n;i++)D.houses.push([cx+(R()-.5)*sp,cy+(R()-.5)*sp*.6,7+R()*5,5+R()*3,(R()-.5)*.6])};
  const camp=(x,y,w,h)=>{D.camps.push([x,y,w,h]);for(let i=x-w/2+8;i<x+w/2-4;i+=11)for(let j=y-h/2+7;j<y+h/2-3;j+=10)if(R()>.15)D.tents.push([i+3,j+2.5])};
  if(id==='cannae'){for(let i=0;i<14;i++)D.trees.push([920+R()*70,380+R()*100,4+R()*3])}
  if(id==='agincourt'){wood(AG.L,260,6,13);wood(AG.R,260,6,13)}
  if(id==='hastings'){for(let i=0;i<70;i++)D.trees.push([R()*170,40+R()*200,6+R()*6]);for(let i=0;i<70;i++)D.trees.push([830+R()*170,40+R()*200,6+R()*6]);for(let i=0;i<30;i++)D.trees.push([R()*120,560+R()*80,6+R()*6]);
  }
  if(id==='austerlitz'){village(AUS.tel.cx,AUS.tel.cy,10,52);village(AUS.sok.cx,AUS.sok.cy,10,52);
    wood({cx:60,cy:150,rx:80,ry:90},90,6,11);wood({cx:960,cy:330,rx:60,ry:70},50,5,9);for(let i=0;i<30;i++)D.trees.push([360+R()*40,560+R()*60,4+R()*4]);
    D.labels.push(['Telnitz',AUS.tel.cx,AUS.tel.cy+40],['Sokolnitz',AUS.sok.cx-56,AUS.sok.cy],['Pratzen',560,355],['Satschan ponds',AUS.pond.cx,AUS.pond.cy-56])}
  if(id==='ironbridge'){wood(IB.wl,150,5,10);wood(IB.wr,140,5,10);wood(IB.wn,160,5,10);
    for(let x=IB.town.x0+14;x<IB.town.x1-8;x+=26)for(let y=IB.town.y0+12;y<IB.town.y1-6;y+=24){if(Math.abs(x-503)<16||R()<.12)continue;D.houses.push([x+(R()-.5)*4,y+(R()-.5)*4,12+R()*6,10+R()*5,0,'block'])}
    D.labels.push(['Ironbridge',IB.town.x0+30,IB.town.y1+18],['Kessel River',140,riverY(140)-26])}
  if(SCEN[id]&&SCEN[id].gen)genDecor(SCEN[id].gen,R,D);
  return decorCache[id]=D;
}

function valueNoise(seed){
  const R=rng(seed),N=64,g=new Float32Array(N*N);for(let i=0;i<N*N;i++)g[i]=R();
  const f=(x,y)=>{const xi=Math.floor(x),yi=Math.floor(y),xf=x-xi,yf=y-yi,
    a=g[(yi&63)*N+(xi&63)],b=g[(yi&63)*N+((xi+1)&63)],c=g[((yi+1)&63)*N+(xi&63)],d=g[((yi+1)&63)*N+((xi+1)&63)],
    u=xf*xf*(3-2*xf),v=yf*yf*(3-2*yf);return a+(b-a)*u+(c-a)*v+(a-b-c+d)*u*v};
  return (x,y)=>f(x,y)*.55+f(x*2.3,y*2.3)*.3+f(x*5.1,y*5.1)*.15;
}
const PAL={cannae:{a:[46,66,30],b:[112,132,62]},agincourt:{a:[34,48,32],b:[74,88,52]},hastings:{a:[40,56,34],b:[86,98,56]},austerlitz:{a:[140,148,160],b:[206,212,222]},ironbridge:{a:[50,62,40],b:[108,116,72]}};
const PAL_ERA={ancient:{a:[46,66,30],b:[112,132,62]},medieval:{a:[40,56,34],b:[86,98,56]},napoleon:{a:[48,62,38],b:[104,112,66]},modern:{a:[50,62,40],b:[108,116,72]}};
const texCache={};
function groundTex(id){
  if(texCache[id])return texCache[id];
  const cw=260,ch=166,c=document.createElement('canvas');c.width=cw;c.height=ch;
  const x=c.getContext('2d'),img=x.createImageData(cw,ch),n=valueNoise(id.length*31+7),p=PAL[id]||PAL_ERA[(SCEN[id]&&(SCEN[id].eraKey||SCEN[id].era))||'ancient']||PAL.cannae;
  for(let j=0;j<ch;j++)for(let i=0;i<cw;i++){const v=Math.min(1,Math.max(0,(n(i/26,j/26)-.2)*1.5)),k=(j*cw+i)*4;
    for(let q=0;q<3;q++)img.data[k+q]=p.a[q]+(p.b[q]-p.a[q])*v;img.data[k+3]=255}
  x.putImageData(img,0,0);return texCache[id]=c;
}
function lbl(t,txt,x,y,rot,col,size,align,italic){t.save();t.translate(x,y);t.rotate(rot||0);t.font=`${italic?'italic ':''}600 ${size}px "Saira Condensed","Arial Narrow",sans-serif`;t.textAlign=align||'center';t.lineWidth=3;t.strokeStyle='rgba(10,14,10,.55)';t.strokeText(txt,0,0);t.fillStyle=col;t.fillText(txt,0,0);t.restore()}
function tree2d(t,x,y,r){
  t.fillStyle='rgba(0,0,0,.28)';t.beginPath();t.ellipse(x+r*.35,y+r*.45,r,r*.85,0,0,7);t.fill();
  const g=t.createRadialGradient(x-r*.35,y-r*.4,r*.1,x,y,r);g.addColorStop(0,'#5E7F44');g.addColorStop(.6,'#2F4A2A');g.addColorStop(1,'#1A2B19');
  t.fillStyle=g;t.beginPath();t.arc(x,y,r,0,7);t.fill();
}
function house2d(t,x,y,w,h,a,block){
  t.save();t.translate(x,y);t.rotate(a);
  t.fillStyle='rgba(0,0,0,.3)';t.fillRect(-w/2+2,-h/2+2,w,h);
  if(block){t.fillStyle='#8C8A84';t.fillRect(-w/2,-h/2,w,h);t.fillStyle='#6E6C68';t.fillRect(-w/2+2,-h/2+2,w-4,h-4)}
  else{t.fillStyle='#8B5B3B';t.fillRect(-w/2,-h/2,w,h/2);t.fillStyle='#6A4128';t.fillRect(-w/2,0,w,h/2)}
  t.strokeStyle='rgba(30,20,10,.6)';t.lineWidth=.6;t.strokeRect(-w/2,-h/2,w,h);t.restore();
}
/* mode '2d' paints trees, houses and tents; '3d' paints only the ground, since those become meshes */
function drawScene(t,k,id,mode){
  const R=rng(id.length*101+3),D=decor(id),flat=mode!=='3d';PAINT3D=!flat;
  t.setTransform(k,0,0,k,0,0);t.imageSmoothingEnabled=true;t.imageSmoothingQuality='high';
  t.drawImage(groundTex(id),0,0,W,H);
  for(let i=0;i<7;i++){const x=R()*W,y=R()*H,w=120+R()*180,h=60+R()*90,a=(R()-.5)*.5;t.save();t.translate(x,y);t.rotate(a);
    t.fillStyle=id==='austerlitz'?'rgba(230,232,236,0.10)':`rgba(${id==='cannae'?'190,170,100':'150,160,100'},0.07)`;t.fillRect(-w/2,-h/2,w,h);
    t.strokeStyle='rgba(220,210,160,0.06)';t.lineWidth=1;for(let s=-h/2;s<h/2;s+=5){t.beginPath();t.moveTo(-w/2,s);t.lineTo(w/2,s);t.stroke()}t.restore()}
  for(let i=0;i<1800;i++){const x=R()*W,y=R()*H;t.strokeStyle=id==='austerlitz'?`rgba(235,238,242,${0.05+R()*0.08})`:`rgba(${190+R()*40|0},${200+R()*30|0},140,${0.05+R()*0.07})`;t.lineWidth=.7;t.beginPath();t.moveTo(x,y);t.lineTo(x+(R()-.5)*3,y-2-R()*3);t.stroke()}
  if(id==='cannae'){
    t.beginPath();t.moveTo(0,0);for(let y=0;y<=H;y+=5)t.lineTo(riverX(y)+18,y);t.lineTo(0,H);t.closePath();
    const wg=t.createLinearGradient(0,0,90,0);wg.addColorStop(0,'#173444');wg.addColorStop(1,'#2C5568');t.fillStyle=wg;t.fill();
    t.strokeStyle='rgba(205,190,140,.6)';t.lineWidth=5;t.beginPath();for(let y=0;y<=H;y+=5){const x=riverX(y)+20;y?t.lineTo(x,y):t.moveTo(x,y)}t.stroke();
    t.strokeStyle='rgba(180,220,235,.25)';t.lineWidth=1;for(let i=0;i<70;i++){const y=R()*H,x=R()*(riverX(y)+4);t.beginPath();t.moveTo(x,y);t.quadraticCurveTo(x+3,y+5,x+1,y+10);t.stroke()}
    t.strokeStyle='rgba(110,130,70,.8)';t.lineWidth=.8;for(let i=0;i<180;i++){const y=R()*H,x=riverX(y)+22+R()*8;t.beginPath();t.moveTo(x,y);t.lineTo(x+(R()-.5)*3,y-4-R()*4);t.stroke()}
    lbl(t,'AUFIDUS',34,320,-Math.PI/2,'rgba(190,225,240,.8)',14,'center',true);
  }
  if(id==='agincourt'){
    t.strokeStyle='rgba(170,140,95,.25)';t.lineWidth=7;t.beginPath();t.moveTo(500,H);t.bezierCurveTo(470,450,540,250,500,0);t.stroke();
    t.save();t.beginPath();t.ellipse(AG.M.cx,AG.M.cy,AG.M.rx,AG.M.ry,0,0,7);
    const mg=t.createRadialGradient(500,352,30,500,352,300);mg.addColorStop(0,'rgba(78,58,36,.88)');mg.addColorStop(1,'rgba(70,56,36,.38)');t.fillStyle=mg;t.fill();t.clip();
    t.strokeStyle='rgba(150,115,72,.34)';t.lineWidth=1.3;for(let y=AG.M.cy-AG.M.ry;y<AG.M.cy+AG.M.ry;y+=6){t.beginPath();for(let x=180;x<=820;x+=20){const yy=y+1.6*Math.sin(x/37+y);x>180?t.lineTo(x,yy):t.moveTo(x,yy)}t.stroke()}
    t.strokeStyle='rgba(30,20,10,.35)';t.lineWidth=.8;for(let y=AG.M.cy-AG.M.ry+3;y<AG.M.cy+AG.M.ry;y+=6){t.beginPath();t.moveTo(180,y);t.lineTo(820,y);t.stroke()}
    for(let i=0;i<34;i++){const x=260+R()*480,y=240+R()*230,rx=4+R()*12;const pg=t.createLinearGradient(x,y-4,x,y+4);pg.addColorStop(0,'rgba(150,170,180,.45)');pg.addColorStop(1,'rgba(60,70,80,.35)');t.fillStyle=pg;t.beginPath();t.ellipse(x,y,rx,rx*.35,0,0,7);t.fill()}
    t.restore();
    for(const e of [AG.L,AG.R]){t.fillStyle='rgba(20,34,20,.8)';t.beginPath();t.ellipse(e.cx,e.cy,e.rx*.95,e.ry*.96,0,0,7);t.fill()}
    lbl(t,'Ploughed field, soaked by rain',500,232,0,'rgba(220,180,130,.75)',12,'center',true);
  }
  if(id==='hastings'){
    if(!PAINT3D)for(let i=0;i<7;i++){const s=1-i*0.12;t.beginPath();t.ellipse(HILL.cx,HILL.cy,HILL.rx*s,HILL.ry*s,0,0,7);t.fillStyle=`rgba(230,215,160,${0.025+i*0.006})`;t.fill();t.strokeStyle=`rgba(235,225,195,${i?0.08:0.2})`;t.lineWidth=i?1:1.6;t.stroke()}
    t.strokeStyle='rgba(70,110,125,.6)';t.lineWidth=3;t.beginPath();t.moveTo(0,330);t.bezierCurveTo(180,300,300,345,480,318);t.bezierCurveTo(640,295,800,340,W,310);t.stroke();
    lbl(t,'SENLAC RIDGE',500,622,0,'rgba(240,230,200,.65)',14,'center',true);
  }
  if(id==='austerlitz'){
    t.strokeStyle='rgba(150,140,120,.35)';t.lineWidth=6;t.beginPath();t.moveTo(0,470);t.bezierCurveTo(200,420,300,380,520,340);t.bezierCurveTo(700,310,850,300,W,280);t.stroke();
    t.strokeStyle='rgba(80,110,130,.85)';t.lineWidth=5;t.beginPath();for(let y=300;y<=H;y+=5){const x=goldX(y);y>300?t.lineTo(x,y):t.moveTo(x,y)}t.stroke();
    t.strokeStyle='rgba(200,220,235,.5)';t.lineWidth=1.2;t.stroke();
    t.save();t.beginPath();t.ellipse(AUS.pond.cx,AUS.pond.cy,AUS.pond.rx,AUS.pond.ry,0,0,7);const ig=t.createLinearGradient(860,520,1000,610);ig.addColorStop(0,'#B9CCD6');ig.addColorStop(1,'#7E99A8');t.fillStyle=ig;t.fill();t.clip();
    t.strokeStyle='rgba(255,255,255,.55)';t.lineWidth=.8;for(let i=0;i<14;i++){const x=870+R()*130,y=525+R()*80;t.beginPath();t.moveTo(x,y);t.lineTo(x+(R()-.5)*30,y+(R()-.5)*16);t.lineTo(x+(R()-.5)*40,y+(R()-.5)*20);t.stroke()}t.restore();
    lbl(t,'Goldbach',goldX(420)+26,420,1.2,'rgba(200,225,240,.8)',12,'center',true);
    lbl(t,'PRATZEN HEIGHTS',520,200,0,'rgba(245,240,225,.7)',15,'center',true);
    lbl(t,'Santon',150,392,0,'rgba(245,240,225,.65)',12);lbl(t,'Zuran (HQ)',520,650,0,'rgba(245,240,225,.6)',11);
  }
  if(id==='ironbridge'){
    for(let i=0;i<9;i++){const x=R()*W,y=R()<.5?R()*250:400+R()*230,w=100+R()*140,h=60+R()*80;t.save();t.translate(x,y);t.rotate((R()-.5)*.3);t.fillStyle=R()<.5?'rgba(150,140,70,.16)':'rgba(70,90,40,.18)';t.fillRect(-w/2,-h/2,w,h);t.strokeStyle='rgba(30,40,20,.18)';for(let s=-h/2;s<h/2;s+=4){t.beginPath();t.moveTo(-w/2,s);t.lineTo(w/2,s);t.stroke()}t.restore()}
    for(const e of [IB.wl,IB.wr,IB.wn]){t.fillStyle='rgba(22,36,20,.8)';t.beginPath();t.ellipse(e.cx,e.cy,e.rx*.95,e.ry*.96,0,0,7);t.fill()}
    // river
    t.beginPath();for(let x=0;x<=W;x+=6)t.lineTo(x,riverY(x)-18);for(let x=W;x>=0;x-=6)t.lineTo(x,riverY(x)+18);t.closePath();
    const rg=t.createLinearGradient(0,300,0,350);rg.addColorStop(0,'#1F3E4C');rg.addColorStop(.5,'#2E5A6C');rg.addColorStop(1,'#1F3E4C');t.fillStyle=rg;t.fill();
    t.strokeStyle='rgba(190,175,130,.55)';t.lineWidth=3;t.beginPath();for(let x=0;x<=W;x+=6)t.lineTo(x,riverY(x)-19);t.stroke();t.beginPath();for(let x=0;x<=W;x+=6)t.lineTo(x,riverY(x)+19);t.stroke();
    t.fillStyle='rgba(190,170,120,.55)';t.beginPath();t.ellipse(825,riverY(825),30,17,0,0,7);t.fill();
    // roads
    t.strokeStyle='#3B3D3A';t.lineWidth=12;t.beginPath();t.moveTo(503,0);t.lineTo(503,H);t.stroke();
    t.beginPath();t.moveTo(0,500);t.lineTo(W,500);t.stroke();t.beginPath();t.moveTo(825,0);t.bezierCurveTo(820,200,830,420,700,640);t.lineWidth=6;t.strokeStyle='rgba(130,115,85,.6)';t.stroke();
    t.strokeStyle='rgba(230,225,200,.5)';t.lineWidth=1;t.setLineDash([8,8]);t.beginPath();t.moveTo(503,0);t.lineTo(503,H);t.moveTo(0,500);t.lineTo(W,500);t.stroke();t.setLineDash([]);
    t.fillStyle='#6E706C';t.fillRect(480,riverY(503)-26,46,52);t.strokeStyle='#2B2C2A';t.lineWidth=2;t.strokeRect(480,riverY(503)-26,46,52);
    t.fillStyle='rgba(120,118,110,.25)';t.fillRect(IB.town.x0,IB.town.y0,IB.town.x1-IB.town.x0,IB.town.y1-IB.town.y0);
    lbl(t,'Ford',870,riverY(870)+4,0,'rgba(230,220,190,.75)',12,'left',true);
  }
  if(SCEN[id]&&SCEN[id].gen)genPaint(t,SCEN[id].gen,R);
  if(flat){
    for(const c of D.camps){const [x,y,w,h]=c;t.fillStyle='rgba(120,100,70,.18)';t.fillRect(x-w/2,y-h/2,w,h);t.strokeStyle='rgba(140,110,70,.75)';t.lineWidth=2;t.setLineDash([3,2]);t.strokeRect(x-w/2,y-h/2,w,h);t.setLineDash([])}
    for(const [x,y] of D.tents){t.fillStyle='rgba(0,0,0,.25)';t.fillRect(x-2,y-1.5,6,5);t.fillStyle='#D3C8AC';t.fillRect(x-3,y-2.5,6,5)}
    for(const h of D.houses)house2d(t,h[0],h[1],h[2],h[3],h[4],h[5]==='block');
    [...D.trees].sort((a,b)=>a[1]-b[1]).forEach(([x,y,r])=>tree2d(t,x,y,r));
  }else{
    for(const c of D.camps){const [x,y,w,h]=c;t.fillStyle='rgba(110,95,70,.28)';t.fillRect(x-w/2,y-h/2,w,h)}
    t.fillStyle='rgba(15,25,15,.45)';for(const [x,y,r] of D.trees){t.beginPath();t.arc(x,y,r*1.05,0,7);t.fill()}
  }
  for(const [s,x,y] of D.labels)lbl(t,s,x,y,0,'rgba(240,230,200,.72)',12);
  // vignette, compass, scale
  t.setTransform(k,0,0,k,0,0);
  const vg=t.createRadialGradient(W/2,H/2,H*.35,W/2,H/2,H*.95);vg.addColorStop(0,'rgba(0,0,0,0)');vg.addColorStop(1,flat?'rgba(0,0,0,.5)':'rgba(0,0,0,.22)');t.fillStyle=vg;t.fillRect(0,0,W,H);
  if(flat){
    t.fillStyle='rgba(240,230,200,.6)';t.beginPath();t.moveTo(W-30,16);t.lineTo(W-37,36);t.lineTo(W-30,31);t.lineTo(W-23,36);t.closePath();t.fill();lbl(t,'N',W-30,52,0,'rgba(240,230,200,.6)',11);
    t.strokeStyle='rgba(240,230,200,.5)';t.lineWidth=1.5;t.beginPath();t.moveTo(W-130,H-18);t.lineTo(W-30,H-18);[-130,-80,-30].forEach(o=>{t.moveTo(W+o,H-22);t.lineTo(W+o,H-14)});t.stroke();
    lbl(t,'0',W-130,H-26,0,'rgba(240,230,200,.5)',10);lbl(t,'500 m',W-30,H-26,0,'rgba(240,230,200,.5)',10);
  }
}

/* ---------- 2D unit figures and type icons ---------- */
const HORSE=['#6B4A2F','#4E3423','#8A6640','#3A2A20','#9B7B58'];
const ERA_COL={
  ancient:{P:{tunic:'#3D74B8',hi:'#86B6EC',shield:'#B4D2F2',head:'#CDB894',metal:'#B8C0C6',body:'#3D74B8'},E:{tunic:'#A9362C',hi:'#EC8274',shield:'#F2B9AE',head:'#CDB894',metal:'#B8C0C6',body:'#A9362C'}},
  napoleon:{P:{tunic:'#28479A',hi:'#ECE9DF',shield:'#C9A445',head:'#1C1C20',metal:'#C8CCD0',body:'#28479A'},E:{tunic:'#2F5A34',hi:'#DCD6C2',shield:'#9C2D2D',head:'#1C1C20',metal:'#C8CCD0',body:'#2F5A34'}},
  modern:{P:{tunic:'#3E5F92',hi:'#7FA3D6',shield:'#8CC2FF',head:'#34507A',metal:'#5C7AA6',body:'#4A6994'},E:{tunic:'#93412F',hi:'#D88A70',shield:'#FF9C82',head:'#6E3226',metal:'#A0614A',body:'#8E4D3A'}},
};
const SIDE={
  P:{ring:'#7FB3EC',label:'#D6E8FB',tint:'rgba(90,150,225,0.16)'},
  E:{ring:'#F08A3C',label:'#FFE7D3',tint:'rgba(240,138,60,0.18)'},
};
const TYPE_NOTE={heli:'Gunships. Fly over everything and kill armour from range.',sam:'Air defence. Shoots down drones and helicopters, nothing else.',ew:'Electronic warfare. Jams enemy drones, missiles and artillery within 170 m.',lm:'Kamikaze drones. Dive onto vehicles and are used up doing it.',
  inf:'Line infantry. Solid all-rounders.',heavy:'Armoured foot. Hits hard, holds well.',shield:'Shield wall. Stops arrows and horses.',
  cav:'Horsemen. Fast, deadly in the flank.',arc:'Archers. Shoot from range, weak in melee.',
  gen:'Your commander. Steadies troops nearby and can rally the broken.',
  line:'Musket infantry. Volleys when halted in range, then the bayonet.',art:'Cannon. Long range, shatters dense columns, helpless up close.',
  tank:'Main battle tanks. Heavy armour, fire on the move.',ifv:'Infantry fighting vehicles. Autocannon shreds infantry, light vehicles and drones.',
  minf:'Rifle infantry. Weak in the open, strong in buildings and woods.',atgm:'Anti-tank missiles. Long-range tank killers.',
  howz:'Howitzers. Hit anything on the map, but not up close.',drone:'Strike drones. Fly over terrain and hunt vehicles.',
};
const SPACING={heli:[16,15],sam:[13,12],ew:[13,12],lm:[9,9],inf:[3.9,3.6],heavy:[4,3.8],shield:[4,3.7],cav:[6.4,6.6],arc:[5,4.4],gen:[8.5,9],line:[3.6,3.5],art:[12,11],tank:[11,13],ifv:[11,12],minf:[4.8,4.6],atgm:[8,7],howz:[13,14],drone:[11,11]};
function rr(c,x,y,w,h,r){c.beginPath();c.moveTo(x+r,y);c.arcTo(x+w,y,x+w,y+h,r);c.arcTo(x+w,y+h,x,y+h,r);c.arcTo(x,y+h,x,y,r);c.arcTo(x,y,x+w,y,r);c.closePath()}
function jitter(u){if(u._j)return u._j;const R=rng(u.id*977+13),a=[];for(let i=0;i<260;i++)a.push({x:(R()-.5),y:(R()-.5),p:R()*6.28,h:(R()*HORSE.length)|0});return u._j=a}
function unitLayout(u){
  const [sx,sy]=SPACING[u.type],w=u.w,d=Math.max(u.dd,7);
  const cols=Math.max(1,Math.floor((w-2)/sx)),rows=Math.max(1,Math.round(d/sy));
  return {sx,sy,cols,rows,ox:-(cols-1)*sx/2,oy:-(rows-1)*sy/2};
}
function figure(c,T,x,y,S,front,j){
  const line=(x0,y0,x1,y1,col,w)=>{c.strokeStyle=col;c.lineWidth=w;c.beginPath();c.moveTo(x0,y0);c.lineTo(x1,y1);c.stroke()};
  if(T==='cav'||T==='gen'){
    c.fillStyle=HORSE[j.h];c.beginPath();c.ellipse(x,y,1.8,3.6,0,0,7);c.fill();c.beginPath();c.ellipse(x,y-3.8,.95,1.5,0,0,7);c.fill();
    c.fillStyle=S.tunic;c.beginPath();c.ellipse(x,y+.3,2,1.35,0,0,7);c.fill();c.fillStyle=S.hi;c.beginPath();c.ellipse(x-.5,y,1,.6,0,0,7);c.fill();
    c.fillStyle=S.metal;c.beginPath();c.arc(x,y+.2,.85,0,7);c.fill();line(x+1.3,y+2,x+1.3,y-6.5,'rgba(70,52,32,.95)',.45);return;
  }
  if(T==='art'){c.fillStyle='#2A2622';c.fillRect(x-3.2,y-1,1.2,3);c.fillRect(x+2,y-1,1.2,3);c.fillStyle='#3B3530';c.fillRect(x-1,y-6,2,7);c.fillStyle='#6B5B44';c.fillRect(x-1.5,y+1,3,4);
    for(const dx of [-2.5,2.5]){c.fillStyle=S.tunic;c.beginPath();c.ellipse(x+dx,y+6,1.6,1.1,0,0,7);c.fill()}return}
  if(T==='tank'||T==='ifv'||T==='howz'){
    const L=T==='tank'?8:T==='ifv'?7.5:8,Wd=T==='tank'?5:4.4;
    c.fillStyle='rgba(0,0,0,.3)';c.fillRect(x-Wd/2+.8,y-L/2+1,Wd,L);
    c.fillStyle=S.body;rr(c,x-Wd/2,y-L/2,Wd,L,.8);c.fill();c.strokeStyle='rgba(20,22,16,.7)';c.lineWidth=.4;c.stroke();
    c.fillStyle='rgba(20,20,16,.55)';c.fillRect(x-Wd/2,y-L/2,.8,L);c.fillRect(x+Wd/2-.8,y-L/2,.8,L);
    if(T==='tank'){c.fillStyle=S.metal;c.beginPath();c.arc(x,y+.4,1.9,0,7);c.fill();line(x,y-1,x,y-8.5,'#2A2C22',.8)}
    else if(T==='ifv'){c.fillStyle=S.metal;c.fillRect(x-1.1,y-1.6,2.2,2.2);line(x,y-1.6,x,y-6,'#2A2C22',.45)}
    else{line(x,y,x,y-10,'#2A2C22',1)}
    c.fillStyle=S.shield;c.fillRect(x-1,y+L/2-2,2,1.2);return;
  }
  if(T==='heli'){c.fillStyle=S.body;c.beginPath();c.ellipse(x,y,1.8,4,0,0,7);c.fill();c.fillRect(x-.4,y+3,.8,4.5);c.strokeStyle='rgba(20,20,20,.6)';c.lineWidth=.4;c.beginPath();c.arc(x,y,5.5,0,7);c.stroke();c.fillStyle=S.shield;c.fillRect(x-.8,y-1,1.6,1.4);return}
  if(T==='lm'){c.fillStyle='#2a2a2a';c.beginPath();c.moveTo(x,y-3);c.lineTo(x+2.6,y+2.4);c.lineTo(x-2.6,y+2.4);c.closePath();c.fill();c.fillStyle=S.shield;c.fillRect(x-.6,y,1.2,1.2);return}
  if(T==='sam'||T==='ew'){c.fillStyle=S.body;rr(c,x-2.2,y-3.6,4.4,7.2,.8);c.fill();c.strokeStyle='rgba(20,22,16,.7)';c.lineWidth=.4;c.stroke();
    if(T==='sam'){c.fillStyle=S.metal;c.fillRect(x-1.6,y-2.6,1.2,3.4);c.fillRect(x+.4,y-2.6,1.2,3.4)}else{c.strokeStyle='#2a2c22';c.lineWidth=.5;c.beginPath();c.moveTo(x,y);c.lineTo(x,y-5);c.stroke();c.beginPath();c.arc(x,y-5,1.4,0,7);c.stroke()}
    c.fillStyle=S.shield;c.fillRect(x-1,y+2.2,2,1);return}
  if(T==='drone'){c.strokeStyle='#222';c.lineWidth=.6;c.beginPath();c.moveTo(x-3,y-3);c.lineTo(x+3,y+3);c.moveTo(x+3,y-3);c.lineTo(x-3,y+3);c.stroke();
    c.strokeStyle=S.shield;c.lineWidth=.5;for(const [dx,dy] of [[-3,-3],[3,3],[3,-3],[-3,3]]){c.beginPath();c.arc(x+dx,y+dy,1.5,0,7);c.stroke()}return}
  c.fillStyle=S.tunic;c.beginPath();c.ellipse(x,y,2.05,1.35,0,0,7);c.fill();
  c.fillStyle=S.hi;c.beginPath();c.ellipse(x-.55,y-.35,1,.55,0,0,7);c.fill();
  c.fillStyle=(T==='heavy'||T==='shield')?S.metal:S.head;c.beginPath();c.arc(x,y,.95,0,7);c.fill();
  if(T==='arc'){c.strokeStyle='#9A7748';c.lineWidth=.55;c.beginPath();c.arc(x,y+.8,2.5,Math.PI*1.18,Math.PI*1.82);c.stroke()}
  else if(T==='shield'&&front){c.fillStyle=S.shield;c.beginPath();c.arc(x,y-2,2.55,0,7);c.fill();c.strokeStyle='rgba(25,22,18,.7)';c.lineWidth=.45;c.stroke();c.fillStyle='#857A66';c.beginPath();c.arc(x,y-2,.7,0,7);c.fill()}
  else if(T==='line'){line(x+1.4,y+1,x+1.4,y-5.6,'#3A2E22',.5);line(x+1.4,y-5.6,x+1.4,y-6.8,'#D8DCE0',.3)}
  else if(T==='atgm'){line(x-1.6,y+1.6,x+1.6,y-4,'#2B2E22',1)}
  else if(T==='minf'){line(x+1.3,y+.6,x+1.3,y-3.6,'#1E2018',.5)}
  else{line(x+1.55,y+1,x+1.55,y-(T==='heavy'?4.6:5.2),'rgba(78,60,38,.9)',.42);if(T==='heavy'){c.fillStyle=S.shield;c.fillRect(x-2.2,y-2.5,3.6,1.15)}}
}
function drawUnit(c,u,sel,now,era){
  const S=ERA_COL[era||'ancient'][u.side],T=u.type,j=jitter(u),L=unitLayout(u);
  c.save();c.translate(u.x,u.y);c.rotate(u.facing+Math.PI/2);
  const w=u.w,d=Math.max(u.dd,7);
  if(!u.rout&&!u.air){c.fillStyle='rgba(0,0,0,.2)';rr(c,-w/2+2,-d/2+3,w,d,3);c.fill();c.fillStyle=SIDE[u.side].tint;rr(c,-w/2,-d/2,w,d,3);c.fill()}
  const engaged=u.contacts&&u.contacts.length>0,mv=u.moving,veh=VEH.has(T);
  c.globalAlpha=u.rout?0.6:1;
  for(let r=L.rows-1;r>=0;r--)for(let i=0;i<L.cols;i++){
    const q=j[(r*L.cols+i)%j.length];
    let x=L.ox+i*L.sx+q.x*(T==='arc'||T==='minf'?2.6:T==='cav'||veh?1.6:0.9),y=L.oy+r*L.sy+q.y*(T==='arc'?2:1);
    if(u.rout){x*=1.7;y=y*1.9+q.y*6}
    else if(engaged&&r<2&&!veh){x+=Math.sin(now*.03+q.p*3)*.7;y+=Math.cos(now*.027+q.p*2)*.7}
    else if(mv&&!veh){y+=Math.sin(now*.016+q.p)*.55}
    figure(c,T,x,y,S,r===0,q);
  }
  c.globalAlpha=1;
  if(T==='gen'&&!u.rout){c.strokeStyle='#2E2216';c.lineWidth=.9;c.beginPath();c.moveTo(0,3);c.lineTo(0,-11);c.stroke();c.fillStyle='#D6A63A';c.fillRect(0,-11,9,5.5);c.fillStyle=S.tunic;c.fillRect(0,-9,9,1.6)}
  if(u.stakes&&!u.rout){c.strokeStyle='#8E6E44';c.lineWidth=.9;for(let i=-w/2+2;i<w/2;i+=4.5){c.beginPath();c.moveTo(i,-d/2-2);c.lineTo(i+1.5,-d/2-6.5);c.stroke()}}
  if(sel){c.strokeStyle='rgba(255,255,255,.9)';c.lineWidth=1.2;c.setLineDash([4,3]);rr(c,-w/2-5,-d/2-7,w+10,d+12,4);c.stroke();c.setLineDash([])}
  c.restore();
}
function glyph(c,type,x,y,s,col){
  c.save();c.translate(x,y);c.strokeStyle=c.fillStyle=col||'#F2EEE2';c.lineCap='round';c.lineJoin='round';c.lineWidth=Math.max(1.2,s*.2);
  const P=(pts,fill)=>{c.beginPath();pts.forEach(([a,b],i)=>i?c.lineTo(a*s,b*s):c.moveTo(a*s,b*s));c.closePath();fill?c.fill():c.stroke()};
  switch(type){
    case 'inf':for(const g of [1,-1]){c.beginPath();c.moveTo(-.55*s*g,.55*s);c.lineTo(.55*s*g,-.6*s);c.stroke();c.beginPath();c.moveTo(-.51*s*g,.1*s);c.lineTo(-.15*s*g,.46*s);c.stroke()}break;
    case 'heavy':c.beginPath();c.moveTo(-.5*s,-.6*s);c.lineTo(.5*s,-.6*s);c.lineTo(.5*s,0);c.quadraticCurveTo(.48*s,.45*s,0,.7*s);c.quadraticCurveTo(-.48*s,.45*s,-.5*s,0);c.closePath();c.fill();break;
    case 'shield':c.beginPath();c.arc(0,0,.6*s,0,7);c.stroke();c.beginPath();c.arc(0,0,.2*s,0,7);c.fill();break;
    case 'cav':c.lineWidth=s*.3;c.lineCap='butt';c.beginPath();c.arc(0,-.05*s,.45*s,Math.PI*.78,Math.PI*.22);c.stroke();break;
    case 'arc':{c.lineWidth=Math.max(1.1,s*.16);c.beginPath();c.arc(-.4*s,0,.72*s,-1.05,1.05);c.stroke();const ex=-.4*s+Math.cos(1.05)*.72*s,ey=Math.sin(1.05)*.72*s;c.lineWidth=.8;c.beginPath();c.moveTo(ex,-ey);c.lineTo(ex,ey);c.stroke();c.lineWidth=Math.max(1.1,s*.14);c.beginPath();c.moveTo(-.65*s,0);c.lineTo(.62*s,0);c.stroke();P([[.62,0],[.38,-.2],[.38,.2]],1);break}
    case 'gen':c.beginPath();for(let i=0;i<10;i++){const r=i%2?.32*s:.75*s,a=-Math.PI/2+i*Math.PI/5;i?c.lineTo(Math.cos(a)*r,Math.sin(a)*r):c.moveTo(Math.cos(a)*r,Math.sin(a)*r)}c.closePath();c.fill();break;
    case 'line':c.beginPath();c.moveTo(-.6*s,.6*s);c.lineTo(.45*s,-.45*s);c.stroke();P([[.4,-.4],[.72,-.72],[.52,-.32]],1);c.fillRect(-.72*s,.38*s,.34*s,.34*s);break;
    case 'art':c.beginPath();c.arc(-.15*s,.25*s,.38*s,0,7);c.stroke();c.save();c.rotate(-.45);c.fillRect(-.1*s,-.18*s,.85*s,.36*s);c.restore();break;
    case 'tank':rr(c,-.7*s,-.2*s,1.4*s,.65*s,.12*s);c.fill();c.beginPath();c.arc(-.1*s,-.3*s,.32*s,0,7);c.fill();c.lineWidth=Math.max(1,s*.14);c.beginPath();c.moveTo(.1*s,-.35*s);c.lineTo(.8*s,-.5*s);c.stroke();break;
    case 'ifv':rr(c,-.68*s,-.25*s,1.36*s,.7*s,.15*s);c.stroke();c.beginPath();c.moveTo(0,-.25*s);c.lineTo(.6*s,-.55*s);c.stroke();break;
    case 'minf':c.beginPath();c.arc(0,.1*s,.48*s,Math.PI,0);c.closePath();c.fill();c.beginPath();c.moveTo(-.65*s,.38*s);c.lineTo(.7*s,.38*s);c.stroke();break;
    case 'atgm':P([[-.7,.45],[.55,-.5],[.72,-.68],[.6,-.35],[-.5,.62]],1);break;
    case 'howz':c.fillRect(-.6*s,.2*s,1.2*s,.4*s);c.lineWidth=Math.max(1.2,s*.18);c.beginPath();c.moveTo(-.1*s,.2*s);c.lineTo(.62*s,-.65*s);c.stroke();break;
    case 'heli':c.beginPath();c.ellipse(-.1*s,.05*s,.38*s,.22*s,0,0,7);c.fill();c.lineWidth=Math.max(1,s*.12);c.beginPath();c.moveTo(.2*s,.05*s);c.lineTo(.75*s,-.05*s);c.moveTo(-.75*s,-.38*s);c.lineTo(.6*s,-.38*s);c.moveTo(-.1*s,-.38*s);c.lineTo(-.1*s,-.15*s);c.stroke();break;
    case 'sam':c.fillRect(-.6*s,.25*s,1.2*s,.35*s);c.lineWidth=Math.max(1.2,s*.16);c.beginPath();c.moveTo(-.25*s,.25*s);c.lineTo(.25*s,-.6*s);c.moveTo(.1*s,.25*s);c.lineTo(.55*s,-.45*s);c.stroke();break;
    case 'ew':c.lineWidth=Math.max(1,s*.12);c.beginPath();c.moveTo(0,.65*s);c.lineTo(0,-.1*s);c.stroke();c.beginPath();c.arc(0,-.1*s,.12*s,0,7);c.fill();for(const r of [.35,.6]){c.beginPath();c.arc(0,-.1*s,r*s,-2.4,-.74);c.stroke()}break;
    case 'lm':P([[0,-.7],[.55,.5],[0,.25],[-.55,.5]],1);break;
    case 'drone':c.beginPath();c.moveTo(-.5*s,-.5*s);c.lineTo(.5*s,.5*s);c.moveTo(.5*s,-.5*s);c.lineTo(-.5*s,.5*s);c.stroke();c.lineWidth=1;for(const [a,b2] of [[-.5,-.5],[.5,.5],[.5,-.5],[-.5,.5]]){c.beginPath();c.arc(a*s,b2*s,.24*s,0,7);c.stroke()}break;
  }
  c.restore();
}

/* ---------- roles, role frames and matchups ---------- */
const ENEMY='#F08A3C',ALLY='#4C8EE6';
const ROLE={heli:'air',lm:'air',sam:'support',ew:'support',inf:'melee',heavy:'melee',shield:'melee',arc:'ranged',line:'ranged',minf:'ranged',atgm:'ranged',cav:'mounted',tank:'armour',ifv:'armour',art:'guns',howz:'guns',drone:'air',gen:'command'};
const ROLE_NAME={support:'Support',melee:'Melee foot',ranged:'Ranged',mounted:'Mounted',armour:'Armour',guns:'Guns',air:'Air',command:'Command'};
const FRAME={
  melee:'M4 20a16 16 0 1 0 32 0a16 16 0 1 0 -32 0Z',
  ranged:'M8 4h24a4 4 0 0 1 4 4v24a4 4 0 0 1 -4 4H8a4 4 0 0 1 -4 -4V8a4 4 0 0 1 4 -4Z',
  mounted:'M20 2L38 20L20 38L2 20Z',
  armour:'M11 4h18l9 16l-9 16H11L2 20Z',
  guns:'M20 3L38 35H2Z',
  air:'M20 4L36 14V36L20 28L4 36V14Z',
  command:'M20 2l5 11l12 1l-9 8l3 12l-11 -6l-11 6l3 -12l-9 -8l12 -1Z',
  support:'M20 3L37 15L31 36H9L3 15Z',
};
/* chess piece per role, so every troop reads at a glance */
const CHESS={command:'♚︎',armour:'♛︎',guns:'♜︎',ranged:'♝︎',support:'♝︎',mounted:'♞︎',air:'♞︎',melee:'♟︎'};
const CHESS_NAME={command:'King',armour:'Queen',guns:'Rook',ranged:'Bishop',support:'Bishop',mounted:'Knight',air:'Knight',melee:'Pawn'};
const CHESS_WHY={command:'lose it and the army falters',armour:'your strongest piece',guns:'long-range firepower, slow',ranged:'strikes from a distance',support:'covers others from range',mounted:'fast, hits flanks and rear',air:'flies over everything',melee:'the line that holds'};
const CHESS_FONT='"Segoe UI Symbol","Apple Symbols","Noto Sans Symbols 2","Noto Sans Symbols","DejaVu Sans",serif';
const chessOf=t=>CHESS[ROLE[t]||'melee'];
/* the job colour behind the chess piece: same job, same colour, every era */
const ROLE_COL={melee:'#ECE6D2',ranged:'#7FD18A',mounted:'#5EC8F0',armour:'#B48CFF',guns:'#FF8A55',air:'#FFD45E',support:'#7FD1C4',command:'#FFC53D'};
const ROLE_WORD={melee:'Line',ranged:'Ranged',mounted:'Fast',armour:'Armour',guns:'Guns',air:'Air',support:'Support',command:'Command'};
function chessChip(c,x,y,r,type,side){
  const role=ROLE[type]||'melee';
  c.save();c.fillStyle='rgba(0,0,0,.45)';c.beginPath();c.arc(x+.6,y+1,r,0,7);c.fill();
  c.fillStyle=ROLE_COL[role]||'#F4ECD6';c.beginPath();c.arc(x,y,r,0,7);c.fill();
  c.strokeStyle='#111317';c.lineWidth=Math.max(1,r*.14);c.stroke();c.beginPath();c.arc(x,y,r+Math.max(1.2,r*.16),0,7);c.strokeStyle=type==='gen'?'#D6A63A':side==='E'?ENEMY:ALLY;c.lineWidth=Math.max(1.6,r*.24);c.stroke();
  c.fillStyle='#16130E';c.font=`${Math.round(r*1.55)}px ${CHESS_FONT}`;c.textAlign='center';c.textBaseline='middle';c.fillText(CHESS[role],x,y+r*.08);
  c.restore();
}
const FRAME2D={};
function framePath(role){return FRAME2D[role]||(FRAME2D[role]=new Path2D(FRAME[role]))}
/* role badge: frame shape (role) + glyph (type) + colour (side); enemies get target brackets */
function roleBadge(c,x,y,r,type,side,opt){
  opt=opt||{};const role=ROLE[type]||'melee',col=opt.ring||(side==='E'?ENEMY:ALLY);
  c.save();c.translate(x-r,y-r);c.scale(r/20,r/20);
  c.fillStyle=side==='E'?'#3A2412':'#1B2A3A';c.strokeStyle=col;c.lineWidth=opt.thick?3.4:2.4;c.lineJoin='round';
  const p=framePath(role);c.fill(p);c.stroke(p);
  if(side==='E'&&!opt.noBrackets){c.lineWidth=2.2;c.beginPath();c.moveTo(-1,8);c.lineTo(-1,-1);c.lineTo(8,-1);c.moveTo(32,-1);c.lineTo(41,-1);c.lineTo(41,8);c.moveTo(41,32);c.lineTo(41,41);c.lineTo(32,41);c.moveTo(8,41);c.lineTo(-1,41);c.lineTo(-1,32);c.stroke()}
  c.restore();
  glyph(c,type,x,y+(role==='guns'?r*.18:0),r*(role==='guns'?.62:.74),type==='gen'?'#D6A63A':side==='E'?'#FFE7D3':'#EAF2FC');
  if(!opt.noChess)chessChip(c,x+r*1.15,y+r*.55,Math.max(9,r*.98),type,side);
}
/* matchup table: how well the row type fights the column type */
const MCODES={S:{sym:'▲▲',label:'Strong',bg:'#D6A63A',fg:'#17130A',v:4},G:{sym:'▲',label:'Good',bg:'#7A6128',fg:'#F7EDD2',v:3},E:{sym:'•',label:'Even',bg:'#2A3530',fg:'#C9CFC4',v:2},P:{sym:'▼',label:'Poor',bg:'#1A201D',fg:'#F7B987',v:1},U:{sym:'✕',label:'No effect',bg:'#101412',fg:'#9AA59B',v:0}};
const MT={};
function defM(types,rows){types.forEach((a,i)=>{MT[a]=MT[a]||{};types.forEach((d,j)=>{MT[a][d]=rows[i][j]})})}
defM(['inf','heavy','shield','cav','arc'],['EPPES','GEEGS','EPESG','GEUES','GEPSE']);
defM(['line','art','cav'],['EGG','SEG','GSE']);
defM(['tank','ifv','minf','atgm','howz','drone','heli','sam','ew','lm'],['ESGGSUUSSU','PESSGSGGGS','UPEEPPPPPP','SSPPGUUSSU','PGSSEUUGGU','SSGGSUUGGU','SSGGSUUGSU','UUUUUSSUUS','UUUUUUUUUU','SSGGSUUSSU']);
function matchCode(a,d){const A=a==='gen'?'cav':a,D=d==='gen'?'cav':d;return (MT[A]&&MT[A][D])||'E'}
const WNAME={hellfire:'Guided missiles',sam:'Surface-to-air missiles',kamikaze:'Diving warhead',arrow:'Arrows',musket:'Musket volleys',cannon:'Cannon fire',rifle:'Rifle fire',autocannon:'Autocannon',tankgun:'Tank gun',atgm:'Anti-tank missile',shell:'Artillery shells',missile:'Drone missile'};
const ANAME={foot:'infantry',armored:'armoured foot',shield:'a shield wall',horse:'horsemen',gun:'guns',light:'light armour',heavy:'heavy armour',air:'aircraft'};
function matchWhy(a,d){
  const c=matchCode(a.type,d.type),R=TYPES[a.type].ranged;
  if(d.air&&!(R&&WEAP[R.w].air))return 'Cannot hit aircraft';
  if(a.type==='cav'&&(d.type==='shield'||d.stakes))return d.stakes?'Stakes impale charging horses':'Shield walls stop horses cold';
  if(a.type==='ew')return 'No weapons: jams enemy drones and artillery nearby';
  if(R)return `${WNAME[R.w]} vs ${ANAME[d.armor]||'them'}`;
  if(a.type==='cav'&&ROLE[d.type]==='ranged')return 'Rides down troops that cannot fight back';
  if(c==='S'||c==='G')return 'Wins the melee';if(c==='P'||c==='U')return 'Loses the melee';return 'Even fight';
}
const BEATS={heli:'Tanks, IFVs, guns',sam:'Drones, helicopters, munitions',ew:'Jams drones, missiles and artillery around it',lm:'Tanks, air defence, guns',inf:'Archers in melee',heavy:'Infantry, archers',shield:'Cavalry, arrows',cav:'Archers, guns, any flank',arc:'Cavalry, troops in mud',gen:'Morale of units nearby',line:'Cavalry, infantry',art:'Dense columns, guns',tank:'IFVs, tanks, howitzers',ifv:'Infantry, drones, AT teams',minf:'Infantry, holds buildings',atgm:'Tanks, IFVs',howz:'Infantry, AT teams',drone:'Tanks, IFVs, howitzers'};
const FEARS={heli:'Air defence, autocannon',sam:'Everything on the ground',ew:'Anything that reaches it',lm:'Air defence, jammers, autocannon',inf:'Heavy infantry, flank charges',heavy:'Being flanked, mud',shield:'Plunging fire, leaving the hill',cav:'Shield walls, stakes, volleys',arc:'Shields, any melee',gen:'Being caught alone',line:'Cannon, flank charges',art:'Cavalry, close assault',tank:'AT teams, drones',ifv:'Tanks, AT teams',minf:'Autocannon, artillery in the open',atgm:'Infantry, autocannon',howz:'Drones, anything up close',drone:'IFV autocannon, rifles'};

/* ---------- procedural battlefields ---------- */
function genMap(era,seed){
  const R=rng(seed),g={era,seed,hills:[],woods:[],towns:[],river:null,hillNames:[]};
  const nh=1+Math.floor(R()*3);for(let i=0;i<nh;i++){g.hills.push({cx:120+R()*760,cy:100+R()*440,rx:90+R()*140,ry:60+R()*80,h:22+R()*28});g.hillNames.push('Hill '+(100+Math.floor(R()*180)))}
  const nw=2+Math.floor(R()*3);for(let i=0;i<nw;i++)g.woods.push({cx:60+R()*880,cy:80+R()*480,rx:50+R()*80,ry:35+R()*55});
  if(R()<(era==='modern'?0.65:0.4)){const y0=285+R()*60,cross=[],nc=1+Math.floor(R()*2);
    for(let i=0;i<nc;i++){const x=170+R()*660;cross.push({x0:x-27,x1:x+27,kind:era==='modern'&&i===0?'bridge':'ford'})}
    g.river={y0,A:7+R()*12,f:60+R()*60,ph:R()*6,cross}}
  const nt=era==='modern'?1+Math.floor(R()*2):1+Math.floor(R()*2);
  for(let i=0;i<nt;i++){const cx=170+R()*660,cy=R()<.5?110+R()*110:450+R()*110;g.towns.push(era==='modern'?{x0:cx-85,x1:cx+85,y0:cy-50,y1:cy+50,block:true}:{x0:cx-42,x1:cx+42,y0:cy-28,y1:cy+28})}
  return g;
}
const gRiverY=(g,x)=>g.river.y0+g.river.A*Math.sin(x/g.river.f+g.river.ph);
function genTerrain(g,x,y){
  if(g.river&&Math.abs(y-gRiverY(g,x))<16){for(const c of g.river.cross)if(x>c.x0&&x<c.x1)return c.kind;return 'river'}
  for(const t of g.towns)if(x>t.x0&&x<t.x1&&y>t.y0&&y<t.y1)return 'town';
  for(const w of g.woods)if(inEll(x,y,w))return 'woods';
  for(const h of g.hills)if(inEll(x,y,h))return 'hill';
  return null;
}
function genHeight(g,x,y){
  let h=undul(x,y,2.5);for(const k of g.hills)h+=ellH(x,y,k,k.h,1.3);
  if(g.river){const d=Math.abs(y-gRiverY(g,x));const br=g.river.cross.some(c=>c.kind==='bridge'&&x>c.x0&&x<c.x1);if(d<28&&!br)h-=10*smoothstep(1-d/28)}
  return h;
}
function genDecor(g,R,D){
  for(const w of g.woods){const n=Math.round(w.rx*w.ry/55);for(let i=0;i<n;i++){const a=R()*7,r=Math.sqrt(R())*.95,x=w.cx+Math.cos(a)*w.rx*r,y=w.cy+Math.sin(a)*w.ry*r;if(x>-6&&x<W+6&&y>-6&&y<H+6&&genTerrain(g,x,y)==='woods')D.trees.push([x,y,5+R()*6])}}
  for(const t of g.towns){if(t.block){for(let x=t.x0+14;x<t.x1-8;x+=26)for(let y=t.y0+12;y<t.y1-6;y+=24){if(R()<.14)continue;D.houses.push([x+(R()-.5)*4,y+(R()-.5)*4,12+R()*6,10+R()*5,0,'block'])}}
    else for(let i=0;i<9;i++)D.houses.push([(t.x0+t.x1)/2+(R()-.5)*(t.x1-t.x0),(t.y0+t.y1)/2+(R()-.5)*(t.y1-t.y0),7+R()*5,5+R()*3,(R()-.5)*.6])}
  g.hills.forEach((h,i)=>D.labels.push([g.hillNames[i],h.cx,h.cy-h.ry*.55]));
}
function genPaint(t,g,R){
  const modern=g.era==='modern';
  if(!PAINT3D)for(const k of g.hills)for(let i=0;i<6;i++){const s=1-i*.15;t.beginPath();t.ellipse(k.cx,k.cy,k.rx*1.25*s,k.ry*1.25*s,0,0,7);t.fillStyle=`rgba(230,215,160,${0.025+i*.006})`;t.fill();t.strokeStyle=`rgba(235,225,195,${i?0.08:0.18})`;t.lineWidth=i?1:1.4;t.stroke()}
  for(const w of g.woods){t.fillStyle='rgba(20,34,20,.78)';t.beginPath();t.ellipse(w.cx,w.cy,w.rx*.97,w.ry*.97,0,0,7);t.fill()}
  // road through the field and over the crossing
  const rx=g.river?(g.river.cross[0].x0+g.river.cross[0].x1)/2:500+((g.seed%7)-3)*30;
  t.strokeStyle=modern?'#3B3D3A':'rgba(170,140,95,.32)';t.lineWidth=modern?11:7;t.beginPath();t.moveTo(rx-40,H);t.bezierCurveTo(rx-20,470,rx+20,200,rx+30,0);t.stroke();
  if(modern){t.strokeStyle='rgba(230,225,200,.45)';t.lineWidth=1;t.setLineDash([8,8]);t.stroke();t.setLineDash([])}
  if(g.river){t.beginPath();for(let x=0;x<=W;x+=6)t.lineTo(x,gRiverY(g,x)-16);for(let x=W;x>=0;x-=6)t.lineTo(x,gRiverY(g,x)+16);t.closePath();
    const rg=t.createLinearGradient(0,g.river.y0-20,0,g.river.y0+20);rg.addColorStop(0,'#1F3E4C');rg.addColorStop(.5,'#2E5A6C');rg.addColorStop(1,'#1F3E4C');t.fillStyle=rg;t.fill();
    t.strokeStyle='rgba(190,175,130,.55)';t.lineWidth=3;t.beginPath();for(let x=0;x<=W;x+=6)t.lineTo(x,gRiverY(g,x)-17);t.stroke();t.beginPath();for(let x=0;x<=W;x+=6)t.lineTo(x,gRiverY(g,x)+17);t.stroke();
    for(const c of g.river.cross){const cx=(c.x0+c.x1)/2,cy=gRiverY(g,cx);if(c.kind==='bridge'){t.fillStyle='#6E706C';t.fillRect(c.x0+2,cy-24,c.x1-c.x0-4,48);t.strokeStyle='#2B2C2A';t.lineWidth=2;t.strokeRect(c.x0+2,cy-24,c.x1-c.x0-4,48)}
      else{t.fillStyle='rgba(190,170,120,.6)';t.beginPath();t.ellipse(cx,cy,30,16,0,0,7);t.fill();lbl(t,'Ford',cx+34,cy+4,0,'rgba(230,220,190,.75)',12,'left',true)}}}
  for(const tw of g.towns){t.fillStyle=tw.block?'rgba(120,118,110,.28)':'rgba(140,115,80,.22)';t.fillRect(tw.x0,tw.y0,tw.x1-tw.x0,tw.y1-tw.y0)}
}

/* ---------- Glass Sky: a fictional drone-war battle on a fixed map ---------- */
const GLASS_GEN={era:'modern',seed:7,hills:[{cx:820,cy:545,rx:140,ry:78,h:30},{cx:220,cy:175,rx:160,ry:88,h:34}],hillNames:['Hill 214','Hill 187'],woods:[{cx:115,cy:470,rx:90,ry:60},{cx:905,cy:255,rx:80,ry:70},{cx:575,cy:205,rx:70,ry:45}],towns:[{x0:390,x1:620,y0:430,y1:560,block:true}],river:null};
SCEN.glasssky={
  foe:'The drone offensive',name:'Glass Sky',year:'21st c.',place:'Fictional scenario',you:'Maj. Ilka Varn',sides:['Westmark','Vostrian Army'],diff:'Hard',era:'modern',gen:GLASS_GEN,
  teaser:'A fictional drone war. Swarms, kamikaze drones and gunships come first; the tanks follow. Keep your air defence alive.',
  objective:'Hold the town until air cover arrives',
  brief:['Air defence is the only thing that reliably kills drones and gunships. The enemy knows it and will hunt it first.','Your EW jammer blinds enemy drones, guided missiles and artillery within 170 m. Keep your key units under its umbrella.','Loitering munitions dive onto vehicles and are spent doing it. Use them on tanks and air defence.','Infantry in the town takes far less fire. The open ground belongs to whoever owns the sky.'],
  deploy:395,leth:0.42,pmod:{q:1.3},timer:{t:200,label:'Air cover',win:'Friendly air cover arrives over the town. The drone offensive has failed.'},
  terrain(x,y){return genTerrain(GLASS_GEN,x,y)},
  player:[
    {name:'Battalion HQ',type:'gen',x:505,y:605,men:200,armor:'light'},
    {name:'Air defence battery',type:'sam',x:560,y:585,men:600},
    {name:'EW detachment',type:'ew',x:445,y:590,men:350},
    {name:'Tank platoon',type:'tank',x:360,y:410,men:600},
    {name:'Mech company',type:'ifv',x:280,y:465,men:800},
    {name:'Rifle company A',type:'minf',x:450,y:480,men:1100},
    {name:'Rifle company B',type:'minf',x:565,y:490,men:1100},
    {name:'Anti-tank platoon',type:'atgm',x:700,y:450,men:500},
    {name:'Loitering munitions',type:'lm',x:660,y:610,men:400},
    {name:'Artillery battery',type:'howz',x:200,y:610,men:700},
  ],
  enemy:[
    {name:'Vostrian HQ',type:'gen',x:500,y:30,men:300,armor:'light',ai:{mode:'general',delay:0}},
    {name:'Drone swarm I',type:'drone',x:300,y:80,men:600,ai:{mode:'advance',delay:3,pref:'tank'}},
    {name:'Kamikaze wave',type:'lm',x:500,y:60,men:500,ai:{mode:'advance',delay:12,pref:'sam'}},
    {name:'Drone swarm II',type:'drone',x:700,y:80,men:600,ai:{mode:'advance',delay:28,pref:'sam'}},
    {name:'Rocket artillery',type:'howz',x:500,y:40,men:900,ai:{mode:'skirmish',delay:8}},
    {name:'Enemy jammer',type:'ew',x:520,y:125,men:350,ai:{mode:'escort',delay:15}},
    {name:'1st Tank battalion',type:'tank',x:400,y:150,men:1500,ai:{mode:'advance',delay:20}},
    {name:'2nd Tank battalion',type:'tank',x:250,y:130,men:1300,ai:{mode:'advance',delay:60}},
    {name:'Assault infantry',type:'minf',x:480,y:110,men:1400,ai:{mode:'advance',delay:35}},
    {name:'Motor rifles',type:'ifv',x:600,y:160,men:1200,ai:{mode:'advance',delay:24}},
    {name:'Gunship flight I',type:'heli',x:250,y:40,men:600,ai:{mode:'advance',delay:35,pref:'tank'}},
    {name:'Motor rifles II',type:'ifv',x:800,y:170,men:1000,ai:{mode:'advance',delay:32}},
    {name:'Gunship flight II',type:'heli',x:750,y:40,men:600,ai:{mode:'advance',delay:90,pref:'ifv'}},
  ],
  events:[
    {t:2,msg:'Drone swarm inbound from the north.'},
    {t:12,msg:'Kamikaze drones are hunting your air defence!'},
    {t:20,msg:'Enemy armour is rolling behind the drones.'},
    {t:45,msg:'Gunships on the horizon.'},
    {t:170,msg:'Air cover is thirty seconds out. Hold!'},
  ],
  history:'Glass Sky is a fictional battle. It shows how drones changed the modern battlefield: cheap swarms and loitering munitions scout and strike, gunships hit armour from beyond its reach, and whoever loses the air loses the ground. The answer is layered: air defence to kill what flies, electronic warfare to blind it, and infantry dug into buildings where nothing overhead can easily find them.',
};

/* ---------- Endless War: rosters ---------- */
const ROSTER={
  ancient:{label:'Antiquity',render:'ancient',units:[
    {key:'inf',type:'inf',name:'Legion',men:5000,cost:100},
    {key:'heavy',type:'heavy',name:'Veteran infantry',men:5000,cost:150},
    {key:'shield',type:'shield',name:'Phalanx',men:4000,cost:140},
    {key:'cav',type:'cav',name:'Horse',men:2500,cost:130},
    {key:'arc',type:'arc',name:'Archers',men:2000,cost:100}]},
  medieval:{label:'Middle Ages',render:'ancient',units:[
    {key:'inf',type:'inf',name:'Levy',men:2500,cost:70},
    {key:'heavy',type:'heavy',name:'Men-at-arms',men:1500,cost:130},
    {key:'shield',type:'shield',name:'Shield wall',men:1500,cost:110},
    {key:'cav',type:'cav',name:'Knights',men:1000,cost:150,melee:1.25},
    {key:'arc',type:'arc',name:'Longbowmen',men:1500,cost:110}]},
  napoleon:{label:'Napoleonic',render:'napoleon',units:[
    {key:'line',type:'line',name:'Line regiment',men:5000,cost:110},
    {key:'grd',type:'line',name:'Grenadiers',men:4000,cost:165,melee:1.2,resolve:0.7},
    {key:'hus',type:'cav',name:'Hussars',men:2500,cost:110},
    {key:'cui',type:'cav',name:'Cuirassiers',men:2500,cost:170,melee:1.45},
    {key:'art',type:'art',name:'Battery',men:1000,cost:140}]},
  modern:{label:'21st century',render:'modern',units:[
    {key:'tank',type:'tank',name:'Tank company',men:900,cost:190},
    {key:'ifv',type:'ifv',name:'Mech company',men:900,cost:140},
    {key:'minf',type:'minf',name:'Rifle company',men:1200,cost:80},
    {key:'atgm',type:'atgm',name:'Anti-tank team',men:500,cost:110},
    {key:'howz',type:'howz',name:'Artillery battery',men:800,cost:160},
    {key:'drone',type:'drone',name:'Drone team',men:400,cost:100},
    {key:'lm',type:'lm',name:'Loitering munitions',men:400,cost:130},
    {key:'heli',type:'heli',name:'Gunship flight',men:500,cost:210},
    {key:'sam',type:'sam',name:'Air defence',men:500,cost:120},
    {key:'ew',type:'ew',name:'EW jammer',men:300,cost:110}]},
};
const ORD=n=>n+(n%10===1&&n%100!==11?'st':n%10===2&&n%100!==12?'nd':n%10===3&&n%100!==13?'rd':'th');
const MAXARMY=10,START_POINTS=1000;
function rosterEntry(era,key){return ROSTER[era].units.find(r=>r.key===key)}
function campStars(v){return v?' '+'★'.repeat(v):''}
function armyValue(list,era){return list.reduce((a,s)=>a+(rosterEntry(era,s.key).cost*(s.men/s.maxMen)),0)}
function genEnemy(camp){
  const R=rng(Date.now()%100000+camp.round*7),era=camp.era,ros=ROSTER[era].units,budget=900+290*(camp.round-1);
  const counts={};camp.army.forEach(s=>{counts[s.type]=(counts[s.type]||0)+1});
  const top=Object.keys(counts).sort((a,c)=>counts[c]-counts[a])[0];
  const out=[],num={};let left=budget;
  while(out.length<MAXARMY){
    const afford=ros.filter(r=>r.cost<=left);if(!afford.length)break;
    let pick;
    if(top&&R()<.38){const counters=afford.filter(r=>MCODES[matchCode(r.type,top)].v>=3);pick=counters.length?counters[Math.floor(R()*counters.length)]:null}
    if(!pick){const front=afford.filter(r=>['melee','ranged','armour'].includes(ROLE[r.type]));pick=(out.length<3&&front.length?front:afford)[Math.floor(R()*(out.length<3&&front.length?front.length:afford.length))]}
    num[pick.key]=(num[pick.key]||0)+1;
    out.push({key:pick.key,type:pick.type,name:`${ORD(num[pick.key])} ${pick.name}`,men:Math.round(pick.men*(1+.04*(camp.round-1))),melee:pick.melee,resolve:pick.resolve});left-=pick.cost;
  }
  return out;
}
function layoutArmy(specs,side,g){
  const front=[],second=[],flank=[],rear=[],P=side==='P';
  for(const s of specs){const r=ROLE[s.type];
    if(s.type==='gen'){rear.unshift(s);continue}
    if(r==='mounted'||r==='air')flank.push(s);else if(r==='guns'||r==='support')rear.push(s);
    else if(s.type==='arc'||s.type==='atgm')second.push(s);else front.push(s)}
  const out=[],Y=d=>P?470+d:170-d;
  const row=(list,yy)=>{const tw=list.reduce((a,s)=>a+TYPES[s.type].w+14,0);let x=500-tw/2;for(const s of list){const w=TYPES[s.type].w;out.push(Object.assign({},s,{x:Math.max(40,Math.min(960,x+w/2)),y:yy}));x+=w+14}};
  row(front,Y(0));row(second,Y(55));row(rear,Y(118));
  flank.forEach((s,i)=>{const L=i%2===0,k=Math.floor(i/2);out.push(Object.assign({},s,{x:L?80+k*68:920-k*68,y:Y(25)}))});
  for(const o of out){let n=0;while(g&&['river','water'].includes(genTerrain(g,o.x,o.y))&&n++<20)o.y+=P?8:-8}
  return out;
}
function buildEndlessScenario(camp){
  const era=camp.era,render=ROSTER[era].render,seed=Math.floor(Math.random()*1e6),g=genMap(era==='medieval'?'ancient':era,seed);g.era=render==='modern'?'modern':'old';
  const id='endless_'+camp.round+'_'+seed;
  const pSpecs=camp.army.map((s,i)=>({name:s.name+campStars(s.vet),type:s.type,men:s.men,maxMen:s.maxMen,q:1+0.1*s.vet,melee:s.melee,resolve:s.resolve,ci:i}));
  pSpecs.push({name:'Your commander',type:'gen',men:300,armor:render==='modern'?'light':undefined,ci:-1});
  const eSpecs=camp.enemyPlan.map(s=>Object.assign({},s));eSpecs.push({name:'Enemy commander',type:'gen',men:300,armor:render==='modern'?'light':undefined});
  const P=layoutArmy(pSpecs,'P',g),E=layoutArmy(eSpecs,'E',g).map(s=>{const r=ROLE[s.type],R2=Math.random;
    return Object.assign(s,{ai:s.type==='gen'?{mode:'general',delay:0}:s.type==='ew'?{mode:'escort',delay:6}:(r==='guns'||s.type==='sam')?{mode:'skirmish',delay:2+R2()*4}:{mode:'advance',delay:1+R2()*8}})});
  const types=[...new Set(eSpecs.filter(s=>s.type!=='gen').map(s=>s.type))];
  SCEN[id]={endless:true,foe:'The enemy army',name:'Battle '+camp.round,year:ROSTER[era].label,place:'Endless War',you:'You',sides:['Your army','Enemy'],diff:'',era:render,eraKey:era,gen:g,
    teaser:'',objective:'Break the enemy army',deploy:395,leth:render==='modern'?0.62:render==='napoleon'?1.2:1,
    brief:[`The enemy fields ${eSpecs.length-1} units: ${types.map(t=>TYPES[t].label).join(', ')}.`,'Point at an enemy with units selected to see how the matchup goes before you commit.','Units that survive gain a veteran star and fight better next battle. Units that are destroyed are gone for good.','Break their army to win points for reinforcements and new units.'],
    terrain:(x,y)=>genTerrain(g,x,y),player:P,enemy:E,events:[{t:1,msg:'The enemy advances.'}],history:''};
  return id;
}

/* ---------- 1 v 1: both sides get the same army on a mirrored field ---------- */
const MIRROR={
  ancient:['inf','inf','inf','heavy','shield','cav','cav','arc','arc'],
  medieval:['inf','inf','heavy','heavy','shield','cav','cav','arc','arc'],
  napoleon:['line','line','line','grd','hus','cui','art','art'],
  modern:['tank','tank','ifv','minf','minf','atgm','howz','drone','sam'],
};
function mirrorMap(era,seed){
  const R=rng(seed),g={era,seed,hills:[],woods:[],towns:[],river:null,hillNames:[]};
  const pair=(o,mx)=>[o,mx(o)];
  const nh=1+Math.floor(R()*2);for(let i=0;i<nh;i++){const h={cx:150+R()*700,cy:220+R()*70,rx:90+R()*100,ry:55+R()*45,h:22+R()*22};g.hills.push(h,Object.assign({},h,{cx:1000-h.cx,cy:640-h.cy}));const nm='Hill '+(100+Math.floor(R()*180));g.hillNames.push(nm,'Hill '+(100+Math.floor(R()*180)))}
  const nw=1+Math.floor(R()*2);for(let i=0;i<nw;i++){const w={cx:60+R()*880,cy:150+R()*130,rx:50+R()*60,ry:35+R()*40};g.woods.push(w,Object.assign({},w,{cx:1000-w.cx,cy:640-w.cy}))}
  if(R()<(era==='modern'?0.5:0.35)){const x=200+R()*200,cross=[{x0:x-27,x1:x+27,kind:era==='modern'?'bridge':'ford'},{x0:1000-x-27,x1:1000-x+27,kind:era==='modern'?'bridge':'ford'}];g.river={y0:320,A:0,f:80,ph:0,cross}}
  if(R()<.7){const cx=200+R()*600,cy=180+R()*60;const t=era==='modern'?{x0:cx-70,x1:cx+70,y0:cy-40,y1:cy+40,block:true}:{x0:cx-40,x1:cx+40,y0:cy-26,y1:cy+26};g.towns.push(t,{x0:1000-t.x1,x1:1000-t.x0,y0:640-t.y1,y1:640-t.y0,block:t.block})}
  return g;
}
function buildMirrorScenario(era,seedIn){
  const render=ROSTER[era].render,seed=seedIn!=null?seedIn:Math.floor(Math.random()*1e6),g=mirrorMap(render==='modern'?'modern':'ancient',seed);g.era=render==='modern'?'modern':'old';
  const id='mirror_'+era+'_'+seed,num={};
  const specs=MIRROR[era].map(k=>{const r=rosterEntry(era,k);num[k]=(num[k]||0)+1;return{key:k,type:r.type,name:`${ORD(num[k])} ${r.name}`,men:r.men,melee:r.melee,resolve:r.resolve}});
  const gen={name:'Commander',type:'gen',men:300,armor:render==='modern'?'light':undefined};
  const P=layoutArmy(specs.map(s=>Object.assign({},s)).concat([Object.assign({},gen,{name:'Your commander'})]),'P',g);
  const E=P.map(u=>{const r=ROLE[u.type],R2=Math.random;return Object.assign({},u,{name:u.name.replace('Your commander','Enemy commander'),x:1000-u.x,y:640-u.y,
    ai:u.type==='gen'?{mode:'general',delay:0}:u.type==='ew'?{mode:'escort',delay:6}:(r==='guns'||u.type==='sam')?{mode:'skirmish',delay:2+R2()*4}:{mode:'advance',delay:1+R2()*6}})});
  SCEN[id]={mirror:true,foe:'The enemy army',name:'1 v 1',year:ROSTER[era].label,place:'Equal armies',you:'You',sides:['Your army','Enemy'],diff:'',era:render,eraKey:era,gen:g,
    teaser:'',objective:'Break the enemy army',deploy:395,leth:render==='modern'?0.62:render==='napoleon'?1.2:1,
    brief:['Both armies are identical, on a mirrored field. Only your command decides it.','Point at an enemy with units selected to see how the matchup goes before you commit.','Use the ground: hills, woods and towns are placed the same way for both sides.'],
    terrain:(x,y)=>genTerrain(g,x,y),player:P,enemy:E,events:[{t:1,msg:'The enemy advances.'}],history:'An even fight: same troops, same ground. The better commander wins.'};
  return id;
}

/* ---------- Endless War: campaign flow and muster screen ---------- */
function bestRecord(era){try{return +localStorage.getItem('fc-best-'+era)||0}catch(e){return 0}}
function setBest(era,n){try{if(n>bestRecord(era))localStorage.setItem('fc-best-'+era,n)}catch(e){}}
function newCampaign(era){G.camp={era,round:1,points:START_POINTS,army:[],enemyPlan:null,wins:0};openMuster()}
function openMuster(){
  const c=G.camp;if(!c)return;if(!c.enemyPlan)c.enemyPlan=genEnemy(c);
  G.mode='menu';$('menu').hidden=true;$('game').hidden=true;$('muster').hidden=false;renderMuster();window.scrollTo({top:0});
}
function renderMuster(){
  const c=G.camp,ros=ROSTER[c.era],box=$('muster');
  const groups={};c.enemyPlan.forEach(s=>{groups[s.key]=(groups[s.key]||0)+1});
  const ev=Math.round(c.enemyPlan.reduce((a,s)=>a+rosterEntry(c.era,s.key).cost,0)),mv=Math.round(armyValue(c.army,c.era));
  const shop=ros.units.map(r=>{const can=c.points>=r.cost&&c.army.length<MAXARMY;const T=TYPES[r.type];
    return `<div class="shopcard"><div class="sh-top"><span class="ubadge" data-type="${r.type}" data-side="P" data-size="40"></span><div><b>${r.name}</b><small>${ROLE_NAME[ROLE[r.type]]} · ${T.per?Math.round(r.men/T.per)+' '+T.unit:fmt(r.men)+' men'}</small></div><span class="cost">${r.cost}</span></div>
      <div class="sh-m"><em>Beats</em> ${BEATS[r.type]}</div><div class="sh-m f"><em>Fears</em> ${FEARS[r.type]}</div>
      <button type="button" class="primary sm" data-buy="${r.key}" ${can?'':'disabled'}>Recruit</button></div>`}).join('');
  const army=c.army.map((s,i)=>{const r=rosterEntry(c.era,s.key),miss=1-s.men/s.maxMen,rc=Math.ceil(r.cost*miss*0.8),T=TYPES[s.type],str=T.per?`${Math.ceil(s.men/T.per)}/${Math.round(s.maxMen/T.per)} ${T.unit}`:`${fmt(s.men)}/${fmt(s.maxMen)}`;
    return `<div class="armyrow"><span class="ubadge" data-type="${s.type}" data-side="P" data-size="34"></span><div class="ar-n"><b>${s.name}<span class="stars">${'★'.repeat(s.vet)}</span></b><span class="ar-bar"><i style="width:${s.men/s.maxMen*100}%"></i></span><small>${str}</small></div>
      ${miss>0.01?`<button type="button" class="sm" data-rf="${i}" ${c.points>=rc?'':'disabled'}>Reinforce ${rc}</button>`:''}<button type="button" class="sm ghost" data-dis="${i}" aria-label="Disband ${s.name}">Disband</button></div>`}).join('')||'<div class="empty">No units yet. Recruit from the left.</div>';
  const scout=Object.keys(groups).map(k=>{const r=rosterEntry(c.era,k);return `<span class="sc"><span class="ubadge" data-type="${r.type}" data-side="E" data-size="30"></span><b>${groups[k]}×</b> ${r.name}</span>`}).join('');
  box.innerHTML=`<div class="mu-head"><div><div class="eyebrow">Endless War · ${ros.label}</div><h1>Battle ${c.round}</h1><p>${c.wins?`${c.wins} victor${c.wins>1?'ies':'y'} so far. `:''}Best run in this era: ${bestRecord(c.era)} victories.</p></div>
    <div class="mu-pts"><span>War chest</span><b>${c.points}</b><small>points</small></div></div>
    <div class="scout"><div class="eyebrow">Scouts report · next enemy ≈ ${ev} points · your army ≈ ${mv}</div><div class="sc-list">${scout}</div></div>
    <div class="mu-grid"><div><h2>Recruit</h2><div class="shop">${shop}</div></div>
      <div><h2>Your army <small>${c.army.length}/${MAXARMY} units · commander included</small></h2><div class="armylist">${army}</div>
        <div class="mu-go"><button type="button" class="primary big" id="mu-fight" ${c.army.length?'':'disabled'}>To battle</button><button type="button" id="mu-quit">Abandon campaign</button></div></div></div>`;
  paintBadges(box);
  box.querySelectorAll('[data-buy]').forEach(b=>b.onclick=()=>{const r=rosterEntry(c.era,b.dataset.buy);if(c.points<r.cost||c.army.length>=MAXARMY)return;c.points-=r.cost;const n=c.army.filter(s=>s.key===r.key).length+1;
    c.army.push({key:r.key,type:r.type,name:`${ORD(n)} ${r.name}`,men:r.men,maxMen:r.men,vet:0,melee:r.melee,resolve:r.resolve,paid:r.cost,fresh:true});snd('thud');renderMuster()});
  box.querySelectorAll('[data-rf]').forEach(b=>b.onclick=()=>{const s=c.army[+b.dataset.rf],r=rosterEntry(c.era,s.key),rc=Math.ceil(r.cost*(1-s.men/s.maxMen)*0.8);if(c.points<rc)return;c.points-=rc;s.men=s.maxMen;snd('thud');renderMuster()});
  box.querySelectorAll('[data-dis]').forEach(b=>b.onclick=()=>{const s=c.army[+b.dataset.dis],r=rosterEntry(c.era,s.key);c.points+=s.fresh?r.cost:Math.floor(r.cost*0.4*s.men/s.maxMen);c.army.splice(+b.dataset.dis,1);snd('tok');renderMuster()});
  $('mu-fight').onclick=()=>{c.army.forEach(s=>s.fresh=false);$('muster').hidden=true;start(buildEndlessScenario(c))};
  $('mu-quit').onclick=()=>{G.camp=null;$('muster').hidden=true;toMenu()};
}
function endlessResult(b){
  const c=G.camp;if(!c)return null;const r=b.result;
  const P=b.units.filter(u=>u.side==='P'&&u.type!=='gen');
  if(r.win){
    const next=[];P.forEach(u=>{const s=c.army[u.ci];if(!s)return;const men=u.gone?(u.fled||0):u.men;if(men<s.maxMen*0.08)return;s.men=Math.round(men);s.vet=Math.min(3,s.vet+1);next.push(s)});
    const lost=c.army.length-next.length;c.army=next;c.wins++;c.round++;
    const eLoss=Math.round((1-sideMen(b,'E')/b.init.E)*100),reward=300+60*c.round+Math.round(eLoss*1.5);c.points+=reward;c.enemyPlan=null;setBest(c.era,c.wins);
    return {title:'Victory',reason:`Battle won. +${reward} points for the war chest${lost?`, ${lost} unit${lost>1?'s':''} lost for good`:''}. Survivors gain a veteran star.`,again:`Muster for battle ${c.round}`,hist:'Each victory makes the next enemy army larger. Reinforce your veterans, counter what the scouts report, and see how far you get.'};
  }
  setBest(c.era,c.wins);const n=c.wins,best=bestRecord(c.era);G.camp=null;
  return {title:'Defeat',reason:`Your campaign ends after ${n} victor${n===1?'y':'ies'}. Best run in this era: ${best}.`,again:'New campaign',hist:'Try another mix: read the scouts report, recruit the units that beat what they bring, and keep your commander close to the line.',era:c.era};
}

/* ---------- turn-based engine: move, then attack, then the enemy moves ---------- */
const TB={MOVE:4.6,EQ:5,ROUND:8};
const tbLive=b=>b.units.filter(u=>!u.gone);
function tbMoveRange(b,u){
  let r=TYPES[u.type].speed*TB.MOVE;if(u.rout)r*=1.2;
  if(!u.air){const t=terr(b,u.x,u.y);if(t==='mud')r*=.45;else if(t==='woods')r*=u.type==='cav'?.35:.6;else if(t==='ford'||t==='stream')r*=.55;else if(t==='hill')r*=.85;else if(t==='town')r*=VEH.has(u.type)?.65:.85}
  if(u.contacts&&u.contacts.some(c=>!c.rout)&&!u.rout)r*=.5;
  return r*(1-.4*(u.fatigue||0));
}
function contactDist(a,c){const an=Math.atan2(c.y-a.y,c.x-a.x);return radTo(a,an)+radTo(c,an+Math.PI)+3}
function tbPath(b,u,x,y){
  const pts=[[u.x,u.y]],RI=riverInfo(b);
  if(RI&&!u.air){const sy=Math.sign(u.y-RI.y(u.x))||1,ty=Math.sign(y-RI.y(x))||1;
    if(sy!==ty){let best=null,bd=1e9;for(const c of RI.cross){const cx=(c.x0+c.x1)/2,d=Math.hypot(cx-u.x,RI.y(cx)-u.y)+Math.hypot(x-cx,y-RI.y(cx));if(d<bd){bd=d;best=cx}}
      if(best!=null){pts.push([best,RI.y(best)+sy*30]);pts.push([best,RI.y(best)-sy*30])}}}
  pts.push([x,y]);return pts;
}
const pathLen=p=>{let s=0;for(let i=1;i<p.length;i++)s+=Math.hypot(p[i][0]-p[i-1][0],p[i][1]-p[i-1][1]);return s};
function tbTruncate(pts,maxD){
  const out=[pts[0]];let left=maxD;
  for(let i=1;i<pts.length;i++){const [x0,y0]=out[out.length-1],[x1,y1]=pts[i],d=Math.hypot(x1-x0,y1-y0);if(d<=left){out.push([x1,y1]);left-=d}else{const k=left/Math.max(d,1e-6);out.push([x0+(x1-x0)*k,y0+(y1-y0)*k]);left=0;break}}
  return {pts:out,used:maxD-left};
}
/* line of sight in cities: direct fire cannot pass through more than a few metres of buildings. Artillery, mortars, bombs and anything in the air ignore it. */
const INDIRECT=new Set(['shell','rocket','mortar','siege','airwing','bomb','zbomb','fireball','breath','swarm','vls','cannon']);
function tbLOS(b,a,c){if(!b.s.city||a.air||c.air)return true;const R=TYPES[a.type].ranged;if(R&&(INDIRECT.has(R.w)||R.min))return true;
  const d=dist(a,c),n=Math.ceil(d/5);let blk=0;for(let k=1;k<n;k++){const t=k/n,dd=t*d;if(dd<18||d-dd<18)continue;if(terr(b,a.x+(c.x-a.x)*t,a.y+(c.y-a.y)*t)==='town'){blk+=d/n;if(blk>14)return false}}return true}
/* what an order turns into this turn: where the unit ends up, and whether it gets to strike */
function tbPlan(b,u){
  const o=u.order;if(!o||u.rout||u.gone)return null;const range=tbMoveRange(b,u);
  if(o.kind==='move'){const p=tbPath(b,u,o.x,o.y),tr=tbTruncate(p,range);return{pts:tr.pts,used:tr.used,face:o.face,clamped:pathLen(p)>range+1}}
  const t=byId(b,o.target);if(!t||t.gone)return null;
  const R=TYPES[u.type].ranged,d=dist(u,t);
  if(u.contacts&&u.contacts.includes(t))return{pts:[[u.x,u.y]],used:0,attack:true,melee:true,t};
  if(R&&!o.charge&&WEAP[R.w][t.armor]>0){
    if(d<=R.range&&d>=(R.min||0)){if(tbLOS(b,u,t))return{pts:[[u.x,u.y]],used:0,attack:true,ranged:true,t};const p=tbPath(b,u,t.x,t.y),tr=tbTruncate(p,Math.min(range,d*.6));return{pts:tr.pts,used:tr.used,attack:false,ranged:true,moved:true,t,noLos:true}}
    if(d<(R.min||0)){const k=((R.min||0)+10-d)/d,p=tbPath(b,u,u.x-(t.x-u.x)*k,u.y-(t.y-u.y)*k),tr=tbTruncate(p,range);return{pts:tr.pts,used:tr.used,attack:false,t,ranged:true}}
    const need=d-R.range*0.9,gx=u.x+(t.x-u.x)/d*need,gy=u.y+(t.y-u.y)/d*need,p=tbPath(b,u,gx,gy),L=pathLen(p),tr=tbTruncate(p,range);
    return{pts:tr.pts,used:tr.used,attack:L<=range+1&&!!R.move,ranged:true,moved:true,t,short:L>range+1}
  }
  if(TYPES[u.type].melee<=0)return{pts:[[u.x,u.y]],used:0,attack:false,t};
  const cd=contactDist(u,t),gx=t.x+(u.x-t.x)/d*(cd-2),gy=t.y+(u.y-t.y)/d*(cd-2),p=tbPath(b,u,gx,gy),L=pathLen(p),tr=tbTruncate(p,range);
  return{pts:tr.pts,used:tr.used,attack:L<=range+1,melee:true,t,charge:tr.used>=range*.4||!!o.charge,short:L>range+1}
}
function tbContacts(b){
  const L=tbLive(b);for(const u of L)u.contacts=[];
  for(let i=0;i<L.length;i++)for(let j=i+1;j<L.length;j++){const a=L[i],c=L[j];if(a.side===c.side||a.air||c.air)continue;if(dist(a,c)<contactDist(a,c)+8){a.contacts.push(c);c.contacts.push(a)}}
}
function tbSeparate(b){
  const L=tbLive(b);
  for(let it=0;it<6;it++)for(let i=0;i<L.length;i++)for(let j=i+1;j<L.length;j++){const a=L[i],c=L[j];if(a.air!==c.air)continue;
    const dx=c.x-a.x,dy=c.y-a.y,d=Math.hypot(dx,dy);if(d>140||d<.01)continue;const an=Math.atan2(dy,dx);let mn=radTo(a,an)+radTo(c,an+Math.PI);if(a.side===c.side)mn*=.92;
    if(d<mn){const p=(mn-d)/2,ux=dx/d,uy=dy/d;if(!blocked(b,a,a.x-ux*p,a.y-uy*p)){a.x-=ux*p;a.y-=uy*p}if(!blocked(b,c,c.x+ux*p,c.y+uy*p)){c.x+=ux*p;c.y+=uy*p}}}
  for(const u of L){u.x=Math.max(8,Math.min(W-8,u.x));if(!u.rout)u.y=Math.max(8,Math.min(H-8,u.y))}
}
/* damage helpers built on the real-time formulas, scaled to one turn of fighting */
/* concealment: a unit in woods or buildings can only be hit properly if someone on the shooter's side is close enough to see it, or it gave itself away by firing */
function tbConcealed(b,c){if(c.struck)return false;if(c.stealth)return true;if(c.air)return false;const t=terr(b,c.x,c.y);return t==='woods'||t==='town'||t==='nebula'}
function tbSpotted(b,side,c){if(!tbConcealed(b,c))return true;const R=spotR(b.s.era)*(c.type==='sub'?.8:1);for(const o of b.units){if(o.side!==side||o.gone||o.rout)continue;if(Math.hypot(o.x-c.x,o.y-c.y)<(o.type==='drone'||o.type==='swarm'?R*2.2:o.scout?R*2.6:R))return true}return false}
function tbRangedHit(b,a,c,moved){
  const RW=TYPES[a.type].ranged,WT=WEAP[RW.w];let m=WT[c.armor];if(!m)return 0;
  if(RW.w==='arrow'&&c.armor==='shield'&&b.plunge&&a.side==='E')m=0.9;
  if(moved)m*=.5;
  const tc=terr(b,c.x,c.y),ta=terr(b,a.x,a.y);
  if(tc==='mud')m*=1.5;if(tc==='woods')m*=.5;if(tc==='asteroid')m*=.55;if(tc==='shoal'&&c.naval)m*=.9;if(tc==='hill'&&ta!=='hill')m*=.85;if(tc==='town')m*=c.armor==='heavy'?.7:.45;
  if(c.dugIn&&!c.air)m*=(RW.w==='shell'||RW.w==='cannon')?.5:.75;
  if(!tbSpotted(b,a.side,c))m*=.2;if(JAMMED.has(RW.w)&&jammedAt(b,c.side,c.x,c.y))m*=.45;
  const dt=TB.EQ,loss=eff(a.men)*K.ranged*RW.dmg*m*a.q*(b.s.leth||1)*dt;
  c.dmg+=loss;c.mdmg+=loss/c.maxMen*200+((c.armor==='horse'?.8:.2)+(tc==='mud'?1.2:0))*dt;
  if(RW.splash)for(const o of tbLive(b)){if(o===c||o.side===a.side||o.air)continue;const dd=dist(o,c);if(dd<RW.splash){const k=.4*(1-dd/RW.splash)*(WT[o.armor]||0);o.dmg+=loss*k;o.mdmg+=loss*k/o.maxMen*200}}
  if(RW.w==='kamikaze')a.men=Math.max(0,a.men-a.maxMen*.22);
  if(RW.w==='fire')a.men=Math.max(0,a.men-a.maxMen*.45);
  return loss;
}
function tbMeleeHit(b,a,c,charge){
  a.crowd=1;c.crowd=1;
  if(charge){a.chargeT=1;if((a.type==='cav'||a.type==='gen')&&c.type!=='shield'&&!c.stakes)c.mdmg+=14;else if(a.type!=='cav')c.mdmg+=8}
  const before=c.dmg;melee(b,a,c,1,TB.EQ);a.chargeT=0;
  if(!c.rout&&TYPES[c.type].melee>0)melee(b,c,a,1,TB.EQ*.75);
  return c.dmg-before;
}
function tbApply(b,list){
  const L=tbLive(b),gens=L.filter(g=>g.type==='gen'&&!g.rout),out=[];
  for(const u of list){if(u.gone)continue;
    u.inspired=gens.some(g=>g!==u&&g.side===u.side&&dist(g,u)<g.aura);
    const k=Math.min(u.men,u.dmg),mb=u.morale;u.men-=k;u.killed+=k;u.morale-=u.mdmg*u.resolve*(u.inspired?.75:1);u.dmg=0;u.mdmg=0;
    if(k>0||u.morale<mb)out.push({u,lost:k,dm:Math.round(u.morale-mb)});u.hitThisRound=true;
    u.dd=Math.max(7,u.d*(0.4+0.6*Math.sqrt(Math.max(0,u.men)/u.maxMen)));
    if(!u.rout&&(u.morale<=0||u.men<u.maxMen*.18))routUnit(b,u,L);
    if(u.men<1){u.gone=true;u.men=0}
  }
  return out;
}
/* preview of a strike without applying it */
function tbPreview(b,a,t){
  const plan=tbPlan(b,Object.assign({},a,{order:{kind:'attack',target:t.id}}));
  const save=b.units.map(u=>[u.dmg,u.mdmg,u.men]),fxn=b.fx.length,msgs=b.msgs.length;
  const ox=a.x,oy=a.y;let res=null;
  if(plan&&plan.attack){const e=plan.pts[plan.pts.length-1];a.x=e[0];a.y=e[1];
    for(const u of b.units){u.dmg=0;u.mdmg=0}
    if(plan.ranged)tbRangedHit(b,a,t,plan.moved);else tbMeleeHit(b,a,t,plan.charge);
    res={theyLose:t.dmg,theyMorale:t.mdmg*t.resolve,youLose:a.dmg,youMorale:a.mdmg*a.resolve,reach:true};}
  else res={reach:false,plan};
  a.x=ox;a.y=oy;b.units.forEach((u,i)=>{u.dmg=save[i][0];u.mdmg=save[i][1];u.men=save[i][2]});b.fx.length=fxn;b.msgs.length=msgs;
  return res;
}
/* enemy decisions, made at the start of the round so you can see what they intend */
function tbEnemyPlan(b){
  const L=tbLive(b),foes=L.filter(u=>u.side==='P'&&!u.rout);
  for(const u of L){
    if(u.side!=='E'||u.rout||!u.ai)continue;const ai=u.ai;u.order=null;
    if(b.t<ai.delay)continue;
    const mv=(x,y)=>{u.order={kind:'move',x,y}};
    if(ai.mode==='general'){const own=L.filter(o=>o.side==='E'&&!o.rout&&o!==u);if(own.length){let cx=0,cy=0;for(const o of own){cx+=o.x;cy+=o.y}cx/=own.length;cy/=own.length;if(Math.hypot(cx-u.x,cy-110-u.y)>30)mv(cx,Math.max(40,cy-110))}continue}
    if(ai.mode==='escort'){const own=L.filter(o=>o.side==='E'&&!o.rout&&o!==u&&!o.air&&o.type!=='gen');if(own.length){let cx=0,cy=0;for(const o of own){cx+=o.x;cy+=o.y}mv(cx/own.length,Math.max(30,cy/own.length-60))}continue}
    if(ai.regroup&&ai.mode!=='regroup'&&ai.mode!=='feint'&&u.morale<38){ai.mode='regroup';mv(u.x,Math.max(110,u.y-170));continue}
    if(ai.mode==='regroup'){if(u.morale>80)ai.mode=ai.base;else{if(u.y>150)mv(u.x,Math.max(110,u.y-150));continue}}
    if(ai.mode==='feint'){if(b.t>ai.until)ai.mode=ai.base;else{mv(u.x,140);continue}}
    const live=u.contacts.filter(c=>!c.rout);if(live.length){u.order={kind:'attack',target:live[0].id};continue}
    if(!foes.length)continue;
    if(ai.wps&&ai.wi<ai.wps.length){const nr=nearest(u,foes);if(!nr||dist(u,nr)>175){const w=ai.wps[ai.wi];if(Math.hypot(w.x-u.x,w.y-u.y)<30)ai.wi++;mv(ai.wps[Math.min(ai.wi,ai.wps.length-1)].x,ai.wps[Math.min(ai.wi,ai.wps.length-1)].y);continue}ai.wi=ai.wps.length}
    const T=TYPES[u.type],R=T.ranged;let c=R?foes.filter(f=>WEAP[R.w][f.armor]>0):foes.filter(f=>!f.air);if(!c.length)c=foes.filter(f=>!f.air);if(!c.length)continue;
    const t=chooseTarget(b,u,c,ai.pref);if(!t)continue;
    u.order={kind:'attack',target:t.id,charge:!!(T.charge&&t.morale<45)};
  }
  for(const u of L)if(u.side==='P'&&!u.rout&&!u.order&&u.stance==='aggr'&&u.type!=='gen'){let best=null,bs=-1;for(const o of L){if(o.side==='P'||o.rout)continue;const pl=tbPlan(b,Object.assign({},u,{order:{kind:'attack',target:o.id}}));if(pl&&pl.attack){const s=MCODES[matchCode(u.type,o.type)].v*1000-dist(u,o);if(s>bs){bs=s;best=o}}}if(best)u.order={kind:'attack',target:best.id,auto:true}}
}
/* a side's phase: everyone moves at once, then strikes one by one */
function tbPhase(b,side){
  const q=[],L=tbLive(b);
  const movers=[];
  for(const u of L){if(u.side!==side)continue;
    if(u.rout){const r=tbMoveRange(b,u)*1.2,ty=side==='P'?H+90:-90;movers.push({u,pts:[[u.x,u.y],[u.x,u.y+(ty>u.y?1:-1)*r]],face:side==='P'?Math.PI/2:-Math.PI/2,flee:true});continue}
    const pl=tbPlan(b,u);u._plan=pl;if(!pl||pl.pts.length<2||pl.used<2)continue;
    movers.push({u,pts:pl.pts,face:pl.face,used:pl.used});
  }
  if(movers.length)q.push({kind:'move',movers,dur:1.05});
  const strikers=L.filter(u=>u.side===side&&!u.rout&&u._plan&&u._plan.t&&u._plan.attack!==false);
  strikers.sort((a,c)=>(a._plan.ranged?0:1)-(c._plan.ranged?0:1));
  for(const u of strikers)q.push({kind:'attack',u,dur:.34});
  q.push({kind:'settle',side,dur:.15});
  return q;
}
function tbBuildRound(b){
  const q=[{kind:'banner',text:'Your army moves',dur:.35}];
  q.push(...tbPhase(b,'P'));
  q.push({kind:'enemyplan',dur:0},{kind:'banner',text:'The enemy moves',dur:.45},{kind:'enemyphase',dur:0});
  q.push({kind:'overwatch',dur:0},{kind:'melee',dur:.4},{kind:'endround',dur:.1});
  return q;
}
function tbRunItem(b,it,p){
  if(it.kind==='move'){
    for(const m of it.movers){const u=m.u;if(u.gone)continue;if(!m.len)m.len=pathLen(m.pts);
      /* units wheel to face where they go before they set off, and turn into their final facing as they arrive */
      if(m.f0==null){m.f0=u.facing;m.lp=0;const [ax,ay]=m.pts[0],[bx,by]=m.pts[1]||m.pts[0];m.d0=Math.hypot(bx-ax,by-ay)>.5?Math.atan2(by-ay,bx-ax):u.facing;
        m.back=m.face!=null&&Math.abs(norm(m.face-m.d0))>2.2&&m.len<140;m.turnF=m.back||m.flee||m.len<4||u.air||u.naval?0:Math.min(.32,Math.abs(norm(m.d0-m.f0))/Math.PI*.42)}
      const pm=p<1?Math.max(0,(p-m.turnF)/(1-m.turnF)):1,k=Math.min(1,pm<1?(1-Math.pow(1-pm,2)):1),dd=m.len*k;let want=null;
      let acc=0;for(let i=1;i<m.pts.length;i++){const [x0,y0]=m.pts[i-1],[x1,y1]=m.pts[i],s=Math.hypot(x1-x0,y1-y0);if(acc+s>=dd||i===m.pts.length-1){const f=s>0?Math.min(1,(dd-acc)/s):1;const nx=x0+(x1-x0)*f,ny=y0+(y1-y0)*f;if(!blocked(b,u,nx,ny)){u.x=nx;u.y=ny}if(s>0.5)want=Math.atan2(y1-y0,x1-x0);break}acc+=s}
      if(m.back)want=m.face;else if(m.face!=null&&pm>.82)want=m.face;
      if(want!=null&&p<1){const st=Math.min(1,(p-m.lp)*(u.naval?5:9));u.facing=norm(u.facing+norm(want-u.facing)*st)}else if(want!=null&&p>=1&&m.face==null)u.facing=want;m.lp=p;
      u.moving=p<1;
      if(p>=1){u.moving=false;if(m.face!=null)u.facing=m.face;if(m.flee&&(u.y<-40||u.y>H+40)){u.gone=true;u.fled=u.men}
        if(!m.flee&&m.used){if(terr(b,u.x,u.y)==='mud'||m.pts.some(([x,y])=>terr(b,x,y)==='mud'))u.fatigue=Math.min(.85,(u.fatigue||0)+m.used/400);u.movedThisRound=true}}}
    if(p>=1){tbSeparate(b);tbContacts(b)}
  }
}
function tbStrike(b,it){
  const u=it.u;if(u.gone||u.rout)return null;
  if(it.ow){const t=it.ow;if(t.gone||u.struck)return null;u.facing=Math.atan2(t.y-u.y,t.x-u.x);tbRangedHit(b,u,t,false);shotFx(b,u,t,TYPES[u.type].ranged);u.struck=true;return tbApply(b,[t,u])}
  const pl=tbPlan(b,u);if(!pl||!pl.attack||!pl.t||pl.t.gone)return null;const t=pl.t;
  if(pl.melee&&!(u.contacts||[]).includes(t)&&dist(u,t)>contactDist(u,t)+10)return null;
  u.facing=Math.atan2(t.y-u.y,t.x-u.x);
  if(pl.ranged){tbRangedHit(b,u,t,u.movedThisRound);shotFx(b,u,t,TYPES[u.type].ranged)}
  else{tbMeleeHit(b,u,t,pl.charge&&u.movedThisRound);for(let k=0;k<8;k++)b.fx.push({k:'dust',x:(u.x+t.x)/2+(Math.random()-.5)*28,y:(u.y+t.y)/2+(Math.random()-.5)*18,life:.7,max:.7,delay:Math.random()*.25})}
  u.struck=true;
  return tbApply(b,[t,u]);
}
/* units that held still and did not shoot fire at whatever stepped into range */
function tbOverwatch(b){
  const L=tbLive(b),q=[];
  for(const u of L){const R=TYPES[u.type].ranged;if(!R||u.rout||u.struck||u.movedThisRound||u.type==='ew'||u.fire===false)continue;if((u.contacts||[]).some(c=>!c.rout))continue;
    let best=null,bd=1e9;for(const o of L){if(o.side===u.side||o.rout||!(WEAP[R.w][o.armor]>0))continue;const d=dist(u,o);if(d<=R.range&&d>=(R.min||0)&&d<bd&&tbLOS(b,u,o)){bd=d;best=o}}
    if(best)q.push({kind:'attack',u,dur:.24,ow:best})}
  return q;
}
function tbMeleeAll(b){
  const done=new Set(),hit=[];tbContacts(b);
  for(const u of tbLive(b)){if(u.rout||u.struck)continue;for(const c of u.contacts){if(c.rout)continue;const k=Math.min(u.id,c.id)+'-'+Math.max(u.id,c.id);if(done.has(k))continue;done.add(k);
    if(c.struck)continue;tbMeleeHit(b,u,c,false);hit.push(u,c);for(let i=0;i<5;i++)b.fx.push({k:'dust',x:(u.x+c.x)/2+(Math.random()-.5)*24,y:(u.y+c.y)/2+(Math.random()-.5)*16,life:.7,max:.7,delay:Math.random()*.3})}}
  return tbApply(b,[...new Set(hit)]);
}
function tbEndRound(b){
  b.t+=TB.ROUND;
  b.s.events.forEach((e,i)=>{if(b.evDone.has(i))return;if(b.t>=e.t){b.evDone.add(i);if(e.fn)e.fn(b);b.msgs.push({text:e.msg,kind:'event'})}});
  for(const u of tbLive(b)){
    if(!u.rout&&!u.hitThisRound&&!(u.contacts&&u.contacts.length))u.morale=Math.min(100,u.morale+8+(u.inspired?6:0));
    u.dugIn=!u.movedThisRound&&!u.rout;if(!u.movedThisRound)u.fatigue=Math.max(0,(u.fatigue||0)-.08);
    u.stillT=u.dugIn?10:0;u.rallyCd=Math.max(0,u.rallyCd-TB.ROUND);
    u.hitThisRound=false;u.movedThisRound=false;u.struck=false;u._plan=null;
    if(u.order&&u.order.kind==='move'&&Math.hypot(u.order.x-u.x,u.order.y-u.y)<6){if(u.order.face!=null)u.facing=u.order.face;u.order=null}
    if(u.order&&u.order.kind==='attack'){const t=byId(b,u.order.target);if(!t||t.gone||t.rout)u.order=null}
    if(u.side==='E')u.order=null;
  }
  tbContacts(b);
  const pm=sideMen(b,'P'),em=sideMen(b,'E'),pb=pm<b.init.P*.22,eb=em<b.init.E*.22;
  if(b.s.timer&&b.t>=b.s.timer.t&&!pb)b.result={win:true,reason:b.s.timer.win};
  else if(eb&&pb)b.result=pm/b.init.P>=em/b.init.E?{win:true,reason:'Both armies are spent, but the enemy breaks first.'}:{win:false,reason:'Both armies are spent, but yours breaks first.'};
  else if(eb)b.result={win:true,reason:`${b.s.foe} has broken and flees the field.`};
  else if(pb)b.result={win:false,reason:`Your army has broken. ${b.s.foe} holds the field.`};
}
function tbEnemyReplan(b){
  const keep=new Map();for(const u of b.units)if(u.side==='E'&&u.order){const t=u.order.kind==='attack'?byId(b,u.order.target):null;if(u.order.kind==='move'||(t&&!t.gone&&!t.rout))keep.set(u.id,u.order)}
  const pOrders=new Map(b.units.filter(u=>u.side==='P').map(u=>[u.id,u.order]));
  tbEnemyPlan(b);
  for(const u of b.units){if(u.side==='E'&&keep.has(u.id))u.order=keep.get(u.id);if(u.side==='P')u.order=pOrders.get(u.id)}
}
/* synchronous round, for tests and headless balance checks */
function tbRoundSync(b){
  const q=tbBuildRound(b);
  for(let i=0;i<q.length;i++){const it=q[i];
    if(it.kind==='move')tbRunItem(b,it,1);else if(it.kind==='attack')tbStrike(b,it);else if(it.kind==='settle')tbContacts(b);
    else if(it.kind==='enemyplan')tbEnemyReplan(b);else if(it.kind==='enemyphase')q.splice(i+1,0,...tbPhase(b,'E'));else if(it.kind==='overwatch')q.splice(i+1,0,...tbOverwatch(b));
    else if(it.kind==='melee')tbMeleeAll(b);else if(it.kind==='endround')tbEndRound(b)}
}

/* =====================================================================
   THEATRES: sea (galleys, sail, dreadnoughts, modern navy), space, city, steampunk, magic,
   plus the expanded 21st-century arsenal. Data first, then map generators,
   then movement rules (blocking, pathfinding), then scenarios.
   ===================================================================== */

/* ---------- unit types ---------- */
Object.assign(TYPES,{
  // modern additions
  recon:{label:'Recon vehicles',speed:48,melee:0.3,def:0.8,w:44,d:16,armor:'light',ranged:{w:'hmg',range:120,dmg:0.8,move:true},per:50,unit:'vehicles',scout:true},
  mlrs:{label:'Rocket artillery',speed:28,melee:0.1,def:0.7,w:50,d:18,armor:'light',ranged:{w:'rocket',range:1600,min:200,dmg:1.5,splash:70},per:120,unit:'launchers'},
  mortar:{label:'Mortar section',speed:7,melee:0.4,def:0.8,w:44,d:14,armor:'foot',ranged:{w:'mortar',range:260,min:20,dmg:1.1,splash:36},per:8,unit:'tubes'},
  manpads:{label:'MANPADS team',speed:7,melee:0.4,def:0.8,w:40,d:12,armor:'foot',ranged:{w:'manpads',range:240,dmg:2.6},per:6,unit:'teams'},
  sniper:{label:'Sniper teams',speed:7,melee:0.3,def:0.7,w:34,d:10,armor:'foot',ranged:{w:'sniper',range:200,dmg:0.7},per:2,unit:'snipers',stealth:true},
  jet:{label:'Strike jets',speed:280,melee:0,def:0.8,w:44,d:30,armor:'air',ranged:{w:'bomb',range:70,dmg:2.4,splash:40,move:true},per:250,unit:'jets',air:true},
  // galleys and sail
  galley:{label:'War galleys',speed:40,melee:1.3,def:1,w:44,d:22,armor:'wood',per:150,unit:'galleys',naval:true,charge:true},
  hgalley:{label:'Heavy galleys',speed:26,melee:1.6,def:1.6,w:54,d:24,armor:'wood',per:300,unit:'heavy galleys',naval:true,charge:true},
  sotl:{label:'Ships of the line',speed:20,melee:0.7,def:2.4,w:64,d:26,armor:'wood',ranged:{w:'broadside',range:170,dmg:1.7},per:700,unit:'ships',naval:true},
  frigate:{label:'Frigates',speed:32,melee:0.6,def:1.3,w:52,d:22,armor:'wood',ranged:{w:'broadside',range:150,dmg:1.1},per:280,unit:'frigates',naval:true},
  fireship:{label:'Fireships',speed:36,melee:0,def:0.5,w:34,d:18,armor:'wood',ranged:{w:'fire',range:30,dmg:3.6,move:true},per:60,unit:'fireships',naval:true},
  // modern navy
  ddg:{label:'Destroyers',speed:32,melee:0,def:2,w:56,d:22,armor:'hull',ranged:{w:'vls',range:700,dmg:1.4},per:300,unit:'destroyers',naval:true},
  ffg:{label:'ASW frigates',speed:30,melee:0,def:1.5,w:48,d:20,armor:'hull',ranged:{w:'asw',range:300,dmg:1.3},per:200,unit:'frigates',naval:true,scout:true},
  sub:{label:'Attack submarines',speed:20,melee:0,def:1.3,w:40,d:16,armor:'sub',ranged:{w:'torpedo',range:200,dmg:3},per:130,unit:'submarines',naval:true,stealth:true},
  carrier:{label:'Carrier group',speed:22,melee:0,def:3,w:80,d:32,armor:'hull',ranged:{w:'airwing',range:1100,dmg:1.3},per:3000,unit:'carriers',naval:true},
  fac:{label:'Missile boats',speed:60,melee:0,def:0.6,w:40,d:16,armor:'hull',ranged:{w:'ssm',range:320,dmg:1.6,move:true},per:30,unit:'boats',naval:true},
  // space
  fighter:{label:'Starfighters',speed:130,melee:0,def:0.55,w:42,d:28,armor:'craft',ranged:{w:'laser',range:90,dmg:1.5,move:true},per:20,unit:'fighters',air:true,space:true},
  bomber:{label:'Torpedo bombers',speed:95,melee:0,def:0.7,w:44,d:28,armor:'craft',ranged:{w:'torp',range:80,dmg:2.8,move:true},per:30,unit:'bombers',air:true,space:true},
  corvette:{label:'Flak corvettes',speed:75,melee:0,def:1.1,w:40,d:20,armor:'craft',ranged:{w:'flak',range:200,dmg:1.6,move:true},per:120,unit:'corvettes',air:true,space:true},
  sdd:{label:'Star destroyers',speed:45,melee:0,def:1.9,w:56,d:24,armor:'capital',ranged:{w:'rail',range:460,dmg:1.6,move:true},per:600,unit:'destroyers',air:true,space:true},
  bship:{label:'Battleships',speed:26,melee:0,def:3,w:70,d:30,armor:'capital',ranged:{w:'lance',range:620,dmg:2.3},per:3000,unit:'battleships',air:true,space:true},
  scarrier:{label:'Strike carriers',speed:24,melee:0,def:2.6,w:70,d:32,armor:'capital',ranged:{w:'swarm',range:520,dmg:1.3},per:2500,unit:'carriers',air:true,space:true},
  // steampunk (1888, another history)
  brawler:{label:'Piston brawlers',speed:22,melee:1.6,def:1.1,w:44,d:14,armor:'armored',per:1,unit:'brawlers',charge:true},
  fusil:{label:'Aether fusiliers',speed:16,melee:.6,def:1,w:50,d:14,armor:'foot',ranged:{w:'airgun',range:120,dmg:1.15},per:1,unit:'fusiliers'},
  tesla:{label:'Tesla engineers',speed:15,melee:.3,def:.8,w:38,d:12,armor:'foot',ranged:{w:'tesla',range:70,dmg:1.5},per:1,unit:'engineers'},
  clock:{label:'Clockwork grenadiers',speed:12,melee:1.9,def:2.1,w:44,d:16,armor:'mech',per:1,unit:'automatons'},
  walker:{label:'Steam walkers',speed:20,melee:.9,def:2.4,w:40,d:22,armor:'mech',ranged:{w:'steamgun',range:180,dmg:1.6},per:4,unit:'walkers'},
  iclad:{label:'Land ironclads',speed:10,melee:.4,def:3,w:46,d:26,armor:'mech',ranged:{w:'siege',range:420,min:30,dmg:1.5,splash:34},per:30,unit:'ironclads'},
  zep:{label:'Dirigible gunships',speed:40,melee:0,def:1.3,w:48,d:30,armor:'air',ranged:{w:'zbomb',range:60,dmg:1.9,splash:30,move:true},per:40,unit:'dirigibles',air:true},
  orni:{label:'Ornithopters',speed:90,melee:0,def:.5,w:40,d:26,armor:'air',ranged:{w:'ornigun',range:70,dmg:1.3,move:true},per:2,unit:'ornithopters',air:true,scout:true},
  // dreadnoughts (1906 to 1918)
  dread:{label:'Dreadnoughts',speed:21,melee:0,def:2.8,w:66,d:24,armor:'hull',ranged:{w:'bigguns',range:750,dmg:1.6},per:1100,unit:'battleships',naval:true},
  bcr:{label:'Battlecruisers',speed:28,melee:0,def:1.8,w:64,d:22,armor:'hull',ranged:{w:'bigguns',range:740,dmg:1.35},per:1100,unit:'battlecruisers',naval:true},
  lcr:{label:'Light cruisers',speed:30,melee:0,def:1.2,w:50,d:18,armor:'hull',ranged:{w:'qf',range:500,dmg:1.05},per:450,unit:'cruisers',naval:true,scout:true},
  tbd:{label:'Destroyers',speed:36,melee:0,def:.7,w:42,d:16,armor:'hull',ranged:{w:'torpedo',range:300,dmg:2.2,move:true},per:90,unit:'destroyers',naval:true},
  uboat:{label:'U-boats',speed:12,melee:0,def:.9,w:36,d:14,armor:'sub',ranged:{w:'torpedo',range:150,dmg:2.8},per:35,unit:'U-boats',naval:true,stealth:true},
  // magic
  mage:{label:'Battle mages',speed:18,melee:0.3,def:0.7,w:44,d:14,armor:'foot',ranged:{w:'fireball',range:230,dmg:1.6,splash:40},per:1,unit:'mages'},
  elf:{label:'Elven archers',speed:24,melee:0.5,def:0.7,w:56,d:14,armor:'foot',ranged:{w:'elfbow',range:270,dmg:1.45}},
  dragon:{label:'Dragons',speed:110,melee:0,def:2.6,w:50,d:40,armor:'beast',ranged:{w:'breath',range:90,dmg:3,splash:36,move:true},per:400,unit:'dragons',air:true},
  golem:{label:'Stone golems',speed:12,melee:2.4,def:3.2,w:50,d:22,armor:'golem',per:250,unit:'golems'},
  undead:{label:'Undead horde',speed:16,melee:0.85,def:0.75,w:70,d:22,armor:'undead'},
  griffin:{label:'Griffin riders',speed:80,melee:1.4,def:1.1,w:50,d:20,armor:'beast',per:2,unit:'riders',charge:true},
});
Object.assign(WEAP,{
  hmg:{foot:1,armored:.9,light:.5,heavy:.02,air:.4,gun:.7},
  rocket:{foot:1.5,armored:1.5,light:1.2,heavy:.4,gun:1.2,air:0},
  mortar:{foot:1.3,armored:1.2,light:.4,heavy:.05,gun:.9,air:0},
  manpads:{air:2.6},
  sniper:{foot:1,armored:.8,light:.05,gun:.5},
  bomb:{foot:1.2,armored:1.2,shield:1.2,horse:1.2,gun:1.3,light:1.4,heavy:1.2,hull:1.2,wood:1.4,sub:.2,air:0},
  broadside:{wood:1,hull:.2,foot:1,horse:1},
  fire:{wood:2.4,hull:.4},
  vls:{hull:1.2,wood:1.5,air:2.2,sub:0},
  asw:{sub:2.4,hull:.6,wood:.8,air:.5},
  torpedo:{hull:2,wood:2,sub:1},
  airwing:{hull:1.2,wood:1.4,sub:.3,air:.6,light:1.2,heavy:1,foot:.8},
  ssm:{hull:1.3,wood:1.5},
  laser:{craft:1.6,capital:.2},
  torp:{capital:2.2,craft:.1},
  flak:{craft:2,capital:.35},
  rail:{capital:1.4,craft:.35},
  lance:{capital:1.7,craft:.15},
  swarm:{craft:1.3,capital:1},
  airgun:{foot:1,armored:.75,mech:.12,air:.45,light:.4},
  tesla:{mech:2.2,armored:1.3,air:1.7,foot:.4,light:1.5},
  steamgun:{foot:1.15,armored:1.15,mech:1,air:.25,light:1.2},
  siege:{foot:1.2,armored:1.2,mech:1.25,light:1.3,air:0},
  zbomb:{foot:1.3,armored:1.1,mech:1,light:1.2,air:0},
  ornigun:{foot:.9,armored:.5,mech:.2,air:1.7,light:.6},
  bigguns:{hull:1.25,sub:0,wood:1.6},
  qf:{hull:.9,sub:.25,wood:1.2},
  fireball:{foot:1.2,armored:1,horse:1.25,shield:.9,beast:.8,golem:.35,undead:1.7,air:.7},
  elfbow:{foot:1,armored:.5,horse:1.3,shield:.35,beast:.9,golem:.05,undead:.45,air:1.3},
  breath:{foot:1.6,armored:1.3,horse:1.5,shield:1.2,beast:.7,golem:.6,undead:1.3,air:.6},
});
// old weapons against the new kinds of target
Object.assign(WEAP.arrow,{beast:.7,golem:.05,undead:.5});
Object.assign(WEAP.sam,{air:3});
Object.assign(WEAP.autocannon,{hull:.3});
const JAM2=['rocket','bomb'];JAM2.forEach(w=>JAMMED.add(w));
['recon','mlrs','walker','iclad'].forEach(t=>VEH.add(t));
Object.assign(ROLE,{recon:'mounted',mlrs:'guns',mortar:'guns',manpads:'support',sniper:'ranged',jet:'air',
  galley:'mounted',hgalley:'melee',sotl:'armour',frigate:'ranged',fireship:'support',
  ddg:'armour',ffg:'ranged',sub:'mounted',carrier:'guns',fac:'mounted',
  fighter:'air',bomber:'air',corvette:'support',sdd:'armour',bship:'guns',scarrier:'support',
  brawler:'melee',fusil:'ranged',tesla:'support',clock:'melee',walker:'armour',iclad:'guns',zep:'air',orni:'air',
  dread:'armour',bcr:'mounted',lcr:'ranged',tbd:'mounted',uboat:'support',
  mage:'guns',elf:'ranged',dragon:'air',golem:'armour',undead:'melee',griffin:'mounted'});
Object.assign(SPACING,{recon:[14,12],mlrs:[16,14],mortar:[8,7],manpads:[9,8],sniper:[11,9],jet:[18,16],
  galley:[20,16],hgalley:[25,18],sotl:[30,20],frigate:[24,16],fireship:[17,14],
  ddg:[26,18],ffg:[22,16],sub:[18,14],carrier:[80,30],fac:[13,10],
  fighter:[9,9],bomber:[11,10],corvette:[19,14],sdd:[26,20],bship:[70,28],scarrier:[70,30],
  brawler:[4.6,4.4],fusil:[4.2,4],tesla:[6,5],clock:[6,5.5],walker:[13,12],iclad:[22,20],zep:[36,30],orni:[9,9],
  dread:[70,26],bcr:[66,24],lcr:[30,18],tbd:[16,12],uboat:[18,14],
  mage:[6,5],elf:[4.6,4.2],dragon:[25,22],golem:[12,11],undead:[3.6,3.4],griffin:[9,9]});
Object.assign(TYPE_NOTE,{recon:'Recon vehicles. Fast, see into woods and buildings from far away.',mlrs:'Rocket artillery. Saturates a huge area from far behind the line.',mortar:'Mortars. Indirect fire for infantry, short reach.',manpads:'Shoulder-fired air defence. Kills helicopters, drones and jets.',sniper:'Snipers. Hidden until they shoot; break enemy morale.',jet:'Strike jets. Cross the map in one turn and bomb anything on the ground.',
  galley:'Oared war galleys. Fast and agile: ram from the side.',hgalley:'Heavy galleys. Packed with marines for boarding.',sotl:'Ships of the line. Floating fortresses with heavy broadsides.',frigate:'Frigates. Faster and lighter, good at picking off damaged ships.',fireship:'Fireships. Sailed into the enemy and set ablaze.',
  ddg:'Destroyers. Missiles against ships and aircraft alike.',ffg:'Frigates. Hunt submarines with sonar and torpedoes.',sub:'Submarines. Invisible until they fire; torpedoes break ships.',carrier:'Carrier group. Its air wing strikes anything on the map.',fac:'Missile boats. Cheap, fast, dangerous in numbers.',
  fighter:'Starfighters. Hunt bombers and other small craft.',bomber:'Torpedo bombers. Small, but their torpedoes break capital ships.',corvette:'Flak corvettes. Shred fighters and bombers.',sdd:'Destroyers. Railguns at long range against big ships.',bship:'Battleships. The heaviest beams in the fleet, slow.',scarrier:'Carriers. Launch strike craft against anything.',
  brawler:'Piston brawlers. Steam fists that smash a firing line on contact.',fusil:'Aether fusiliers. Air rifles fed from brass tanks: the steady line.',tesla:'Tesla engineers. Arc lances that seize clockwork and cook boilers.',clock:'Clockwork grenadiers. Never panic, shrug off rifles, stop dead under Tesla arcs.',walker:'Steam walkers. Two legs and a field gun; too big for buildings.',iclad:'Land ironclads. Naval guns on wheels: the heaviest fire, the slowest thing.',zep:'Dirigible gunships. Bombs from above; ornithopters tear them open.',orni:'Ornithopters. Fast flapping scouts that hunt dirigibles.',
  dread:'Dreadnoughts. All-big-gun battleships: the battle line.',bcr:'Battlecruisers. Battleship guns, cruiser armour, high speed.',lcr:'Light cruisers. The fleet\'s eyes; chase off destroyers.',tbd:'Destroyers. Dash in under the big guns with torpedoes.',uboat:'U-boats. Invisible until they fire; torpedoes cripple battleships.',
  mage:'Battle mages. Fireballs hit a whole area; fragile up close.',elf:'Elven archers. The longest bows on the field.',dragon:'Dragons. Fly over everything and burn what is below.',golem:'Stone golems. Almost unbreakable, painfully slow.',undead:'The undead. Never panic, never stop.',griffin:'Griffin riders. Fast shock cavalry.'});
Object.assign(BEATS,{recon:'Spotting, light vehicles',mlrs:'Everything in the open',mortar:'Infantry in the open',manpads:'Helicopters, drones, jets',sniper:'Infantry morale',jet:'Anything on the ground',
  galley:'Ships hit in the side',hgalley:'Boarding fights',sotl:'Every wooden ship',frigate:'Damaged ships, galleys',fireship:'Packed wooden fleets',
  ddg:'Ships and aircraft',ffg:'Submarines',sub:'Surface ships',carrier:'Everything, from far away',fac:'Big ships, in numbers',
  fighter:'Bombers, small craft',bomber:'Capital ships',corvette:'Fighters, bombers',sdd:'Capital ships at range',bship:'Capital ships',scarrier:'Everything at range',
  brawler:'Fusiliers in melee',fusil:'Brawlers, engineers, crews',tesla:'Walkers, automatons, dirigibles',clock:'Any infantry line',walker:'Infantry, brawlers',iclad:'Everything on the ground',zep:'Packed infantry, walkers',orni:'Dirigibles, engineers',
  dread:'Every surface ship',bcr:'Cruisers, chasing',lcr:'Destroyers, scouting',tbd:'Battleships, at close range',uboat:'Battleships',
  mage:'Undead, packed infantry',elf:'Cavalry, griffins, dragons',dragon:'Infantry, horses',golem:'Any melee',undead:'Wearing down infantry',griffin:'Archers, mages'});
Object.assign(FEARS,{recon:'Anything heavier',mlrs:'Counter-battery, being found',mortar:'Assault, artillery',manpads:'Anything on the ground',sniper:'Recon, area fire',jet:'Air defence',
  galley:'Broadsides',hgalley:'Fireships, rams',sotl:'Fireships, being outnumbered',frigate:'Ships of the line',fireship:'Gunfire before it arrives',
  ddg:'Submarines',ffg:'Missile boats, air strikes',sub:'ASW frigates',carrier:'Submarines, getting caught close',fac:'Destroyers, aircraft',
  fighter:'Flak corvettes',bomber:'Fighters, flak',corvette:'Capital guns',sdd:'Bombers',bship:'Bomber swarms',scarrier:'Bombers up close',
  brawler:'Walkers, being shot on the way in',fusil:'Automatons, walkers',tesla:'Fusiliers, brawlers',clock:'Tesla engineers',walker:'Tesla engineers, ironclad guns',iclad:'Tesla teams up close, dirigibles',zep:'Ornithopters, Tesla arcs',orni:'Fusilier volleys',
  dread:'Torpedoes, U-boats',bcr:'Dreadnoughts',lcr:'Battleship guns',tbd:'Light cruisers',uboat:'Destroyers',
  mage:'Cavalry, griffins',elf:'Golems, melee',dragon:'Elven archers, mages',golem:'Mages',undead:'Mages, fire',griffin:'Elven archers'});
defM(['tank','ifv','minf','atgm','howz','drone','heli','sam','recon','mlrs','mortar','manpads','sniper','jet'],
  ['ESGGSUUSGSSUGU','PESSGSGGGGSUSG','UPEEPPPPPPGPEU','SSPPGUUSSSGUPU','PGSSEUUGGSSGSU','SSGGSUUGGSSUGU','SSGGSUUGSSSUGU','UUUUUSSUUUUSUS','PGGPGUUGEGGGGU','PGSSGUUGGESGSU','UGGGGUUGGGEGGU','UUUUUSSUUUUEUS','UPGGPUUPPPPPEU','SSSSSUUSSSSPSE']);
defM(['galley','hgalley','sotl','frigate','fireship'],['EPPGS','GEEGS','SGEGG','GPPES','SSSSE']);
defM(['ddg','ffg','sub','carrier','fac','jet'],['EGPGSS','PESGGG','SSEGSU','GGPESG','GGUGEU','GGUGSE']);
defM(['fighter','bomber','corvette','sdd','bship','scarrier'],['EGPPPP','PESSSS','SSEPPP','GPGEPE','GPGGEG','GGGEPE']);
defM(['brawler','fusil','tesla','clock','walker','iclad','zep','orni'],['ESSEPPUU','PEGPPPGG','PPESSGSG','SSEEEPUU','SSPGEPPU','GGGGGEUU','GGGGGPEP','PGGUUUSE']);
defM(['dread','bcr','lcr','tbd','uboat'],['ESSGP','PESGP','PPEGG','GGPES','SSGPE']);
defM(['inf','cav','elf','mage','dragon','golem','undead','griffin','heavy','arc'],['EPGGUPGPPG','GEGSUPGEGS','GSEPGPPGGE','GPGESPSGGG','SSSSEGSSSS','GGSSUEGGGS','EPGPUPEPPG','GEGSUPGEGS','GPGGUPGPEG','GPEPUPGPPE']);
const _matchWhy=matchWhy;matchWhy=function(a,d){const R=TYPES[a.type].ranged;if(d.air&&!(R&&WEAP[R.w][d.armor]>0))return 'Cannot hit it';if(d.stealth&&!d.struck)return 'Hidden: needs to be found first';return _matchWhy(a,d)};
Object.assign(WNAME,{hmg:'Heavy machine guns',rocket:'Rocket salvo',mortar:'Mortar bombs',manpads:'Shoulder-fired missiles',sniper:'Sniper fire',bomb:'Guided bombs',broadside:'Broadsides',fire:'Fire',vls:'Ship missiles',asw:'Sonar and torpedoes',torpedo:'Torpedoes',airwing:'Air strikes',ssm:'Anti-ship missiles',laser:'Lasers',torp:'Proton torpedoes',flak:'Flak',rail:'Railguns',lance:'Heavy beams',swarm:'Strike craft',smart:'Smartgun fire',hack:'Hacking',mechgun:'Mech cannons',minigun:'Miniguns',taser:'Shock darts',fireball:'Fireballs',elfbow:'Elven arrows',breath:'Dragon fire'});
Object.assign(ANAME,{wood:'wooden ships',hull:'warships',sub:'submarines',craft:'small craft',capital:'capital ships',mech:'machines',beast:'beasts',golem:'golems',undead:'the undead'});

Object.assign(WNAME,{airgun:'Air rifles',tesla:'Arc lances',steamgun:'Steam cannon',siege:'Naval gun',zbomb:'Dropped bombs',ornigun:'Light gun',bigguns:'12-inch guns',qf:'Quick-firing guns'});
/* ---------- colours per era (P = you, E = enemy) ---------- */
Object.assign(ERA_COL,{
  sail:{P:{tunic:'#2A4C8C',hi:'#F2EEE2',shield:'#ECE6D4',head:'#5B3A22',metal:'#2B2B2B',body:'#2A4C8C'},E:{tunic:'#9C2E24',hi:'#F2EEE2',shield:'#ECE6D4',head:'#5B3A22',metal:'#2B2B2B',body:'#9C2E24'}},
  navy:{P:{tunic:'#6E7E92',hi:'#A8B8CC',shield:'#4E8FE0',head:'#3A4656',metal:'#8A98AA',body:'#7A8A9E'},E:{tunic:'#8E7A6E',hi:'#C8B8AC',shield:'#F08A3C',head:'#564038',metal:'#A08A7C',body:'#8E7E72'}},
  space:{P:{tunic:'#C8D6EA',hi:'#7FB6FF',shield:'#4E8FE0',head:'#556274',metal:'#9AAAC0',body:'#B8C6DA'},E:{tunic:'#3A2E36',hi:'#FF7A5A',shield:'#F08A3C',head:'#2A2226',metal:'#6A5A62',body:'#4A3A42'}},
  steam:{P:{tunic:'#24406E',hi:'#C89B3C',shield:'#C89B3C',head:'#E0B88E',metal:'#C89B3C',body:'#24406E'},E:{tunic:'#7A2E22',hi:'#B8733A',shield:'#B8733A',head:'#E0B88E',metal:'#3A3330',body:'#6A2A20'}},
  dread:{P:{tunic:'#8A96A3',hi:'#E6EAEE',shield:'#2F63C8',head:'#4C555E',metal:'#6F7C89',body:'#8A96A3'},E:{tunic:'#5E6670',hi:'#C8CDD2',shield:'#B8322A',head:'#3A4048',metal:'#4C555E',body:'#5E6670'}},
  magic:{P:{tunic:'#2F5FB0',hi:'#A8C8FF',shield:'#D8E4F8',head:'#E2C4A0',metal:'#C8D0DA',body:'#2F5FB0'},E:{tunic:'#5A1E5A',hi:'#C870D8',shield:'#2A1430',head:'#B8B0A0',metal:'#5A505A',body:'#5A1E5A'}},
});
Object.assign(MSCALE,{sail:2,navy:20,space:50,steam:2,dread:20,magic:1});
Object.assign(SPOT,{navy:160,space:150,steam:80,dread:170,sail:120,magic:70});
Object.assign(PAL_ERA,{sail:{a:[16,40,62],b:[30,70,98]},navy:{a:[12,30,48],b:[24,52,76]},space:{a:[4,5,10],b:[16,14,30]},steam:{a:[58,46,36],b:[104,88,66]},dread:{a:[16,30,40],b:[40,58,70]},magic:{a:[34,50,40],b:[92,104,74]},city:{a:[52,54,56],b:[86,88,88]}});

/* ---------- theatre lookup ---------- */
const THEATRE_OF={sail:'sea',galley:'sea',navy:'sea',dread:'sea',space:'space',steam:'city'};
function theatreOf(s){return (s&&s.gen&&s.gen.theatre)||'land'}

/* ---------- map generators ---------- */
function seaMap(seed,opt){opt=opt||{};const R=rng(seed),g={theatre:'sea',era:opt.era||'navy',seed,islands:[],names:[],hills:[],woods:[],towns:[],river:null,hillNames:[]};
  const n=opt.n!=null?opt.n:2+Math.floor(R()*3);
  for(let i=0;i<n;i++){const is={cx:80+R()*840,cy:260+R()*120,rx:40+R()*90,ry:26+R()*50};g.islands.push(is);if(opt.sym)g.islands.push({cx:W-is.cx,cy:H-is.cy,rx:is.rx,ry:is.ry})}
  if(opt.coast)g.islands.push(...opt.coast);
  return g}
function spaceMap(seed,opt){opt=opt||{};const R=rng(seed),g={theatre:'space',era:'space',seed,fields:[],nebulas:[],hills:[],woods:[],towns:[],river:null,hillNames:[],planet:{x:R()<.5?140:860,y:R()<.5?110:530,r:80+R()*60,hue:R()}};
  const nf=2+Math.floor(R()*2);for(let i=0;i<nf;i++){const f={cx:100+R()*800,cy:230+R()*180,rx:60+R()*90,ry:30+R()*40};g.fields.push(f);if(opt.sym)g.fields.push({cx:W-f.cx,cy:H-f.cy,rx:f.rx,ry:f.ry})}
  const nn=1+Math.floor(R()*2);for(let i=0;i<nn;i++){const f={cx:100+R()*800,cy:200+R()*240,rx:80+R()*80,ry:50+R()*50,hue:R()};g.nebulas.push(f);if(opt.sym)g.nebulas.push(Object.assign({},f,{cx:W-f.cx,cy:H-f.cy}))}
  return g}
function cityMap(seed,opt){opt=opt||{};const R=rng(seed),g={theatre:'city',era:opt.steam?'steam':'modern',steam:!!opt.steam,seed,blocks:[],parks:[],hills:[],woods:[],towns:[],river:opt.river||null,hillNames:[]};
  const xs=[0],ys=[0];let x=0;while(x<W-60){x+=95+R()*45;xs.push(Math.min(W,x))}xs[xs.length-1]=W;let y=0;while(y<H-60){y+=85+R()*40;ys.push(Math.min(H,y))}ys[ys.length-1]=H;
  const st=opt.street||30;
  for(let i=0;i<xs.length-1;i++)for(let j=0;j<ys.length-1;j++){
    const b={x0:xs[i]+(i?st/2:6),x1:xs[i+1]-(i<xs.length-2?st/2:6),y0:ys[j]+(j?st/2:6),y1:ys[j+1]-(j<ys.length-2?st/2:6)};
    if(b.x1-b.x0<30||b.y1-b.y0<30)continue;
    const r=R();if(opt.sym&&(b.x0+b.x1)/2>W/2+1)continue;
    if(r<.12)g.parks.push(b);else if(r<.2)continue;else g.blocks.push(b);
  }
  if(opt.sym){const mir=a=>a.map(b=>({x0:W-b.x1,x1:W-b.x0,y0:H-b.y1,y1:H-b.y0}));g.blocks=g.blocks.concat(mir(g.blocks));g.parks=g.parks.concat(mir(g.parks))}
  // keep both deployment strips readable: thin out blocks along the edges
  if(!opt.sym)g.blocks=g.blocks.filter(b=>!(b.y0>H-70||b.y1<70)||R()<.5);
  return g}
function magicMap(seed,opt){const g=opt&&opt.sym?mirrorMap('ancient',seed):genMap('ancient',seed);g.theatre='magic';g.era='magic';const R=rng(seed+9);g.marsh=[];if(R()<.7){const m={cx:200+R()*600,cy:300+R()*40,rx:70+R()*60,ry:30+R()*25};g.marsh.push(m);if(opt&&opt.sym)g.marsh.push({cx:W-m.cx,cy:H-m.cy,rx:m.rx,ry:m.ry})}
  g.crystals=[];for(let i=0;i<14;i++){const c=[60+R()*880,60+R()*520,3+R()*5];g.crystals.push(c);if(opt&&opt.sym)g.crystals.push([W-c[0],H-c[1],c[2]])}return g}

/* ---------- terrain, height, decor, paint per theatre ---------- */
const _genTerrain=genTerrain,_genHeight=genHeight,_genDecor=genDecor,_genPaint=genPaint;
genTerrain=function(g,x,y){
  const th=g.theatre;
  if(th==='sea'){for(const i of g.islands){if(inEll(x,y,i))return 'island';}for(const i of g.islands){if(inEll(x,y,{cx:i.cx,cy:i.cy,rx:i.rx+22,ry:i.ry+22}))return 'shoal'}return 'sea'}
  if(th==='space'){for(const f of g.fields)if(inEll(x,y,f))return 'asteroid';for(const n of g.nebulas)if(inEll(x,y,n))return 'nebula';return null}
  if(th==='city'){if(g.river&&Math.abs(y-gRiverY(g,x))<16){for(const c of g.river.cross)if(x>c.x0&&x<c.x1)return c.kind;return 'river'}
    for(const b of g.blocks)if(x>b.x0&&x<b.x1&&y>b.y0&&y<b.y1)return 'town';for(const p of g.parks)if(x>p.x0&&x<p.x1&&y>p.y0&&y<p.y1)return 'woods';return null}
  if(g.marsh)for(const m of g.marsh)if(inEll(x,y,m))return 'mud';
  return _genTerrain(g,x,y);
};
genHeight=function(g,x,y){
  const th=g.theatre;
  if(th==='sea'){let h=-9;for(const i of g.islands){const d=Math.hypot((x-i.cx)/i.rx,(y-i.cy)/i.ry);if(d<1.25)h=Math.max(h,-9+(17+i.rx*.08)*smoothstep((1.25-d)/0.9))}return h}
  if(th==='space')return 0;
  if(th==='city'){let h=undul(x,y,.6);if(g.river){const d=Math.abs(y-gRiverY(g,x));const br=g.river.cross.some(c=>c.kind==='bridge'&&x>c.x0&&x<c.x1);if(d<26&&!br)h-=10*smoothstep(1-d/26)}return h}
  let h=_genHeight(g,x,y);if(g.marsh)for(const m of g.marsh)if(inEll(x,y,m))h-=1.5;return h;
};
genDecor=function(g,R,D){
  const th=g.theatre;
  if(th==='sea'){for(const i of g.islands){const n=Math.round(i.rx*i.ry/120);for(let k=0;k<n;k++){const a=R()*7,r=Math.sqrt(R())*.7,x=i.cx+Math.cos(a)*i.rx*r,y=i.cy+Math.sin(a)*i.ry*r;D.trees.push([x,y,4+R()*5])}}return}
  if(th==='space'){D.rocks=[];for(const f of g.fields){const n=Math.round(f.rx*f.ry/110);for(let k=0;k<n;k++){const a=R()*7,r=Math.sqrt(R()),x=f.cx+Math.cos(a)*f.rx*r,y=f.cy+Math.sin(a)*f.ry*r;D.rocks.push([x,y,2+R()*R()*12,R()*6])}}return}
  if(th==='city'){for(const b of g.blocks){const cw=b.x1-b.x0,ch=b.y1-b.y0,nx=Math.max(1,Math.round(cw/34)),ny=Math.max(1,Math.round(ch/30));
      for(let i=0;i<nx;i++)for(let j=0;j<ny;j++){const w=cw/nx,d=ch/ny;if(R()<.08)continue;const tall=g.steam?7+R()*R()*14:7+R()*R()*22;D.houses.push([b.x0+w*(i+.5),b.y0+d*(j+.5),w-3,d-3,0,'block',tall])}}
    for(const p of g.parks){const n=Math.round((p.x1-p.x0)*(p.y1-p.y0)/220);for(let k=0;k<n;k++)D.trees.push([p.x0+R()*(p.x1-p.x0),p.y0+R()*(p.y1-p.y0),3+R()*4])}return}
  _genDecor(g,R,D);
  if(g.crystals)D.crystals=g.crystals.slice();
};
genPaint=function(t,g,R){
  const th=g.theatre;
  if(th==='sea'){
    const sg=t.createLinearGradient(0,0,0,H);sg.addColorStop(0,'#0E2A44');sg.addColorStop(.5,'#163E5E');sg.addColorStop(1,'#0E2A44');t.fillStyle=sg;t.fillRect(0,0,W,H);
    for(let i=0;i<900;i++){const x=R()*W,y=R()*H;t.strokeStyle=`rgba(190,225,245,${.04+R()*.08})`;t.lineWidth=.8;t.beginPath();t.moveTo(x,y);t.quadraticCurveTo(x+4,y-2,x+9,y);t.stroke()}
    for(const i of g.islands){t.fillStyle='rgba(120,200,210,.28)';t.beginPath();t.ellipse(i.cx,i.cy,i.rx+22,i.ry+22,0,0,7);t.fill();
      t.fillStyle='#CDBB86';t.beginPath();t.ellipse(i.cx,i.cy,i.rx+3,i.ry+3,0,0,7);t.fill();
      const ig=t.createRadialGradient(i.cx,i.cy,2,i.cx,i.cy,Math.max(i.rx,i.ry));ig.addColorStop(0,'#6C8A48');ig.addColorStop(1,'#4A6A36');t.fillStyle=ig;t.beginPath();t.ellipse(i.cx,i.cy,i.rx*.9,i.ry*.86,0,0,7);t.fill()}
    return}
  if(th==='space'){
    t.fillStyle='#04050A';t.fillRect(0,0,W,H);
    for(const n of g.nebulas){const c=n.hue<.33?[120,60,200]:n.hue<.66?[40,120,200]:[200,60,120];for(let k=0;k<5;k++){const ng=t.createRadialGradient(n.cx+(R()-.5)*n.rx,n.cy+(R()-.5)*n.ry,4,n.cx,n.cy,Math.max(n.rx,n.ry)*(1-k*.12));ng.addColorStop(0,`rgba(${c},.22)`);ng.addColorStop(1,`rgba(${c},0)`);t.fillStyle=ng;t.beginPath();t.ellipse(n.cx,n.cy,n.rx*1.2,n.ry*1.2,0,0,7);t.fill()}}
    for(let i=0;i<1600;i++){const x=R()*W,y=R()*H,s=R()<.04?1.3:.5;t.fillStyle=`rgba(${220+R()*35|0},${220+R()*35|0},255,${.25+R()*.7})`;t.fillRect(x,y,s,s)}
    const p=g.planet;const pg=t.createRadialGradient(p.x-p.r*.35,p.y-p.r*.35,p.r*.1,p.x,p.y,p.r);const pc=p.hue<.5?['#7AA6D8','#284A7A','#0A1424']:['#E0A070','#8A4A2A','#1A0A06'];pg.addColorStop(0,pc[0]);pg.addColorStop(.6,pc[1]);pg.addColorStop(1,pc[2]);t.fillStyle=pg;t.beginPath();t.arc(p.x,p.y,p.r,0,7);t.fill();
    t.strokeStyle='rgba(160,200,255,.12)';t.lineWidth=.6;for(let x=0;x<=W;x+=50){t.beginPath();t.moveTo(x,0);t.lineTo(x,H);t.stroke()}for(let y=0;y<=H;y+=50){t.beginPath();t.moveTo(0,y);t.lineTo(W,y);t.stroke()}
    for(const f of g.fields){t.fillStyle='rgba(120,110,100,.12)';t.beginPath();t.ellipse(f.cx,f.cy,f.rx,f.ry,0,0,7);t.fill()}
    return}
  if(th==='city'){
    t.fillStyle=g.steam?'#4A4038':'#45474A';t.fillRect(0,0,W,H);
    for(let i=0;i<500;i++){const x=R()*W,y=R()*H;t.fillStyle=`rgba(${g.steam?'30,22,16':'20,20,20'},${.08+R()*.12})`;t.fillRect(x,y,1+R()*3,1+R()*2)}
    for(const b of g.blocks){t.fillStyle=g.steam?'#3A2A22':'#5E5C58';t.fillRect(b.x0-3,b.y0-3,b.x1-b.x0+6,b.y1-b.y0+6);t.fillStyle=g.steam?'#6A4232':'#77746E';t.fillRect(b.x0,b.y0,b.x1-b.x0,b.y1-b.y0)}
    for(const p of g.parks){t.fillStyle=g.steam?'#4A5634':'#4E6A3A';t.fillRect(p.x0,p.y0,p.x1-p.x0,p.y1-p.y0)}
    // lane markings (tram rails in steam cities)
    t.setLineDash([6,8]);t.lineWidth=1;t.strokeStyle=g.steam?'rgba(200,170,110,.4)':'rgba(230,225,200,.35)';
    const xs=[...new Set(g.blocks.map(b=>Math.round(b.x0)))].sort((a,c)=>a-c);for(const x of xs){t.beginPath();t.moveTo(x-15,0);t.lineTo(x-15,H);t.stroke()}
    const ys=[...new Set(g.blocks.map(b=>Math.round(b.y0)))].sort((a,c)=>a-c);for(const y of ys){t.beginPath();t.moveTo(0,y-15);t.lineTo(W,y-15);t.stroke()}t.setLineDash([]);
    if(g.steam)for(let i=0;i<70;i++){const b=g.blocks[Math.floor(R()*g.blocks.length)];if(!b)break;const x=b.x0+R()*(b.x1-b.x0),y=R()<.5?b.y0-6:b.y1+6;const ng=t.createRadialGradient(x,y,1,x,y,14);ng.addColorStop(0,'rgba(255,190,90,.38)');ng.addColorStop(1,'rgba(255,190,90,0)');t.fillStyle=ng;t.fillRect(x-14,y-14,28,28)}
    if(g.river){t.beginPath();for(let x=0;x<=W;x+=6)t.lineTo(x,gRiverY(g,x)-16);for(let x=W;x>=0;x-=6)t.lineTo(x,gRiverY(g,x)+16);t.closePath();t.fillStyle='#1F3E4C';t.fill()}
    return}
  _genPaint(t,g,R);
  if(g.marsh)for(const m of g.marsh){t.fillStyle='rgba(60,70,40,.6)';t.beginPath();t.ellipse(m.cx,m.cy,m.rx,m.ry,0,0,7);t.fill();for(let i=0;i<30;i++){const a=R()*7,r=Math.sqrt(R()),x=m.cx+Math.cos(a)*m.rx*r*.9,y=m.cy+Math.sin(a)*m.ry*r*.9;t.fillStyle='rgba(90,120,110,.5)';t.beginPath();t.ellipse(x,y,3+R()*6,1.5+R()*2,0,0,7);t.fill()}}
  if(g.crystals)for(const [x,y,r] of g.crystals){const cg=t.createRadialGradient(x,y,1,x,y,r*4);cg.addColorStop(0,'rgba(190,120,255,.5)');cg.addColorStop(1,'rgba(190,120,255,0)');t.fillStyle=cg;t.beginPath();t.arc(x,y,r*4,0,7);t.fill()}
};

/* ---------- battles carry their theatre's flags onto units ---------- */
const _makeBattle=makeBattle;
/* the commander: strong in every theatre, never a one-ship army. At sea and in space it is a flagship with real guns. */
const FLAG_GUN={dread:{w:'bigguns',range:800,dmg:1.35},sail:{w:'broadside',range:180,dmg:1.5},navy:{w:'vls',range:650,dmg:1.15},space:{w:'lance',range:560,dmg:1.6}};
makeBattle=function(id,diff){const s0=SCEN[id],th0=theatreOf(s0),key=th0==='sea'?(s0.theme==='galley'?'galley':s0.era):th0==='space'?'space':null;
  if(key&&FLAG_GUN[key])TYPES.gen.ranged=FLAG_GUN[key];else delete TYPES.gen.ranged;
  const b=_makeBattle(id,diff),th=th0;
  for(const u of b.units){const T=TYPES[u.type];u.naval=!!T.naval;u.stealth=!!T.stealth;u.scout=!!T.scout;
    if(th!=='sea'&&th!=='space'&&!u.air){u.w=Math.round(u.w*(b.s.city?.7:.85));u.d=Math.round(u.d*(b.s.city?.85:1));u.dd=u.d}
    if(T.space)u.space=true;
    if(u.type==='gen'){const own=b.units.filter(o=>o.side===u.side&&o.type!=='gen'),avg=own.length?own.reduce((a,o)=>a+o.maxMen,0)/own.length:400;
      if(th==='sea'||th==='space'){u.men=u.maxMen=Math.round(Math.max(u.men,avg*1.6));u.def=2.6;u.melee=th==='sea'&&key==='galley'?1.8:.6;u.w=th==='space'?60:56;u.speed=th==='space'?30:24;u.aura=200}
      else{u.men=u.maxMen=Math.round(Math.max(u.men,Math.min(avg*.35,1200)));u.def=1.8}
      if(th==='sea'){u.naval=true;u.armor=b.s.era==='navy'||b.s.era==='dread'?'hull':'wood'}if(th==='space'){u.air=true;u.space=true;u.armor='capital'}}}
  b.init={P:sideMen(b,'P'),E:sideMen(b,'E')};
  if(b.s.mirror||b.s.endless)b.s.city=b.s.city||th==='city';
  return b};

/* ---------- movement rules ---------- */
blocked=function(b,u,x,y){if(u.air)return false;const t=terr(b,x,y);
  if(u.naval)return !(t==='sea'||t==='shoal');
  if(t==='river'||t==='water'||t==='sea'||t==='island'&&false)return true;
  if(t==='town'&&b.s.city&&VEH.has(u.type))return true;
  return false};
const _tbMoveRange=tbMoveRange;
tbMoveRange=function(b,u){let r=_tbMoveRange(b,u);if(u.air)return r;const t=terr(b,u.x,u.y);if(u.naval&&t==='shoal')r*=.55;if(t==='asteroid')r*=.7;if(b.s.city&&t==='town')r*=.75;return r};

/* grid pathfinding for maps with obstacles: ships around islands, vehicles along streets */
const NAV_C=10,NAV_W=Math.ceil(W/NAV_C),NAV_H=Math.ceil(H/NAV_C);
function navNeeded(b){return !!(b.s.nav||b.s.city||theatreOf(b.s)==='sea')}
function navClass(u){return u.air?'air':u.naval?'naval':VEH.has(u.type)?'veh':'foot'}
function navGrid(b,cls){b._nav=b._nav||{};if(b._nav[cls])return b._nav[cls];const probe={air:false,naval:cls==='naval',type:cls==='veh'?'tank':'inf'},g=new Uint8Array(NAV_W*NAV_H);
  for(let j=0;j<NAV_H;j++)for(let i=0;i<NAV_W;i++){const x=i*NAV_C+NAV_C/2,y=j*NAV_C+NAV_C/2;let ok=!blocked(b,probe,x,y);
    if(ok&&cls!=='foot'){for(const [dx,dy] of [[-6,0],[6,0],[0,-6],[0,6]])if(blocked(b,probe,x+dx,y+dy)){ok=false;break}}g[j*NAV_W+i]=ok?1:0}
  return b._nav[cls]=g}
function navLine(b,u,x0,y0,x1,y1){const d=Math.hypot(x1-x0,y1-y0),n=Math.ceil(d/5);for(let k=1;k<=n;k++){const t=k/n;if(blocked(b,u,x0+(x1-x0)*t,y0+(y1-y0)*t))return false}return true}
function navAstar(b,u,sx,sy,gx,gy){
  const cls=navClass(u),G0=navGrid(b,cls),ci=(x,y)=>Math.max(0,Math.min(NAV_W-1,Math.floor(x/NAV_C))),cj=(x,y)=>Math.max(0,Math.min(NAV_H-1,Math.floor(y/NAV_C)));
  const s=cj(sx,sy)*NAV_W+ci(sx,sy);let goal=cj(gx,gy)*NAV_W+ci(gx,gy);
  if(!G0[goal]){let best=-1,bd=1e9;const gi=goal%NAV_W,gj=(goal/NAV_W)|0;for(let r=1;r<14&&best<0;r++)for(let dj=-r;dj<=r;dj++)for(let di=-r;di<=r;di++){const i=gi+di,j=gj+dj;if(i<0||j<0||i>=NAV_W||j>=NAV_H)continue;const k=j*NAV_W+i;if(G0[k]){const d=di*di+dj*dj;if(d<bd){bd=d;best=k}}}if(best<0)return null;goal=best}
  const key=cls+'|'+s+'|'+goal;b._pc=b._pc||new Map();if(b._pc.has(key))return b._pc.get(key);
  const N=NAV_W*NAV_H,gs=new Float32Array(N).fill(1e9),from=new Int32Array(N).fill(-1),closed=new Uint8Array(N),heap=[];
  const hx=k=>{const i=k%NAV_W,j=(k/NAV_W)|0,gi=goal%NAV_W,gj=(goal/NAV_W)|0,dx=Math.abs(i-gi),dy=Math.abs(j-gj);return (dx+dy)+(1.414-2)*Math.min(dx,dy)};
  const push=(k,f)=>{heap.push([f,k]);let i=heap.length-1;while(i>0){const p=(i-1)>>1;if(heap[p][0]<=heap[i][0])break;[heap[p],heap[i]]=[heap[i],heap[p]];i=p}};
  const pop=()=>{const top=heap[0],last=heap.pop();if(heap.length){heap[0]=last;let i=0;for(;;){const l=2*i+1,r=l+1;let m=i;if(l<heap.length&&heap[l][0]<heap[m][0])m=l;if(r<heap.length&&heap[r][0]<heap[m][0])m=r;if(m===i)break;[heap[m],heap[i]]=[heap[i],heap[m]];i=m}}return top};
  gs[s]=0;push(s,hx(s));let found=false,it=0;
  while(heap.length&&it++<N*2){const [,k]=pop();if(closed[k])continue;closed[k]=1;if(k===goal){found=true;break}
    const i=k%NAV_W,j=(k/NAV_W)|0;
    for(let dj=-1;dj<=1;dj++)for(let di=-1;di<=1;di++){if(!di&&!dj)continue;const ni=i+di,nj=j+dj;if(ni<0||nj<0||ni>=NAV_W||nj>=NAV_H)continue;const nk=nj*NAV_W+ni;if(closed[nk]||(!G0[nk]&&nk!==goal))continue;
      if(di&&dj&&(!G0[j*NAV_W+ni]||!G0[nj*NAV_W+i]))continue;
      const ng=gs[k]+(di&&dj?1.414:1);if(ng<gs[nk]){gs[nk]=ng;from[nk]=k;push(nk,ng+hx(nk))}}}
  let out=null;if(found){const cells=[];for(let k=goal;k!==-1;k=from[k]){cells.push(k);if(k===s)break}cells.reverse();out=cells.map(k=>[(k%NAV_W)*NAV_C+NAV_C/2,((k/NAV_W)|0)*NAV_C+NAV_C/2])}
  if(b._pc.size>600)b._pc.clear();b._pc.set(key,out);return out}
const _tbPath=tbPath;
tbPath=function(b,u,x,y){
  if(u.air||!navNeeded(b))return _tbPath(b,u,x,y);
  if(navLine(b,u,u.x,u.y,x,y))return [[u.x,u.y],[x,y]];
  const cells=navAstar(b,u,u.x,u.y,x,y);if(!cells||cells.length<2)return [[u.x,u.y],[u.x,u.y]];
  const raw=[[u.x,u.y],...cells.slice(1,-1)];const end=blocked(b,u,x,y)?cells[cells.length-1]:[x,y];raw.push(end);
  const out=[raw[0]];let i=0;while(i<raw.length-1){let j=raw.length-1;while(j>i+1&&!navLine(b,u,raw[i][0],raw[i][1],raw[j][0],raw[j][1]))j--;out.push(raw[j]);i=j}
  return out};

/* ---------- shot effects for the new weapons ---------- */
const _shotFx=shotFx;
shotFx=function(b,a,c,RW){
  const rnd=Math.random,jx=s=>(rnd()-.5)*s,P=(n,o)=>{for(let k=0;k<n;k++)b.fx.push(Object.assign({x0:a.x+jx(a.w*.7),y0:a.y+jx(8),x1:c.x+jx(c.w*.7),y1:c.y+jx(10),side:a.side,delay:rnd()*.25},o))};
  const side=a.side==='P'?'P':'E';
  switch(RW.w){
    case 'hmg':case 'smart':case 'sniper':a.fxT=.3;P(RW.w==='sniper'?1:3,{k:'tracer',life:.22,max:.22});return;
    case 'minigun':case 'flak':a.fxT=.3;P(5,{k:'tracer',life:.2,max:.2});return;
    case 'mechgun':a.fxT=.6;P(2,{k:'tracer',life:.2,max:.2,big:2});P(1,{k:'boom',life:.7,max:.7,delay:.2});return;
    case 'rocket':a.fxT=1.6;P(5,{k:'shell',life:1.4,max:1.4});P(5,{k:'boom',life:1,max:1,delay:1.3});return;
    case 'mortar':a.fxT=1.2;P(2,{k:'shell',life:1,max:1});P(2,{k:'boom',life:.8,max:.8,delay:.95});return;
    case 'manpads':case 'vls':case 'ssm':case 'asw':case 'torp':a.fxT=1.4;P(RW.w==='vls'?2:1,{k:'missile',life:.9,max:.9,up:c.air?1:0});P(1,{k:'boom',life:.8,max:.8,delay:.85,air:c.air?1:0});return;
    case 'airwing':a.fxT=1.6;P(3,{k:'missile',life:1.2,max:1.2});P(3,{k:'boom',life:.9,max:.9,delay:1.1});return;
    case 'bomb':a.fxT=1;P(3,{k:'boom',life:1,max:1});return;
    case 'broadside':a.fxT=1.2;P(4,{k:'cannon',life:.7,max:.7});P(2,{k:'boom',life:.8,max:.8,delay:.6});return;
    case 'fire':a.fxT=1;P(3,{k:'orb',life:.8,max:.8,col:'255,140,40',r:5});P(2,{k:'boom',life:1.2,max:1.2,delay:.4});return;
    case 'torpedo':a.fxT=1.6;P(2,{k:'wake',life:1.4,max:1.4});P(2,{k:'boom',life:1,max:1,delay:1.35});return;
    case 'laser':a.fxT=.4;P(3,{k:'beam',life:.25,max:.25,col:side==='P'?'90,200,255':'255,80,80',w:1.2});return;
    case 'rail':a.fxT=.8;P(1,{k:'beam',life:.35,max:.35,col:'220,235,255',w:2});P(1,{k:'boom',life:.7,max:.7,delay:.1});return;
    case 'lance':a.fxT=1.2;P(1,{k:'beam',life:.7,max:.7,col:side==='P'?'120,190,255':'255,120,90',w:5,delay:0});P(2,{k:'boom',life:1,max:1,delay:.3});return;
    case 'airgun':a.fxT=.35;P(4,{k:'tracer',life:.2,max:.2});return;
    case 'tesla':a.fxT=.7;P(2,{k:'beam',life:.45,max:.45,col:'190,230,255',w:1.6,dash:1,delay:0});return;
    case 'steamgun':a.fxT=.9;P(2,{k:'cannon',life:.5,max:.5});P(2,{k:'boom',life:.7,max:.7,delay:.45});return;
    case 'siege':a.fxT=1.4;P(2,{k:'shell',life:1.1,max:1.1});P(3,{k:'boom',life:1,max:1,delay:1.05});return;
    case 'zbomb':a.fxT=1.1;P(4,{k:'boom',life:1,max:1});return;
    case 'ornigun':a.fxT=.3;P(3,{k:'tracer',life:.2,max:.2});return;
    case 'bigguns':a.fxT=1.6;P(4,{k:'shell',life:1.2,max:1.2});P(4,{k:'boom',life:1,max:1,delay:1.15});return;
    case 'qf':a.fxT=.8;P(4,{k:'cannon',life:.45,max:.45});P(2,{k:'boom',life:.6,max:.6,delay:.4});return;
    case 'swarm':a.fxT=1;P(6,{k:'tracer',life:.4,max:.4});P(3,{k:'boom',life:.7,max:.7,delay:.4});return;
    case 'hack':a.fxT=.8;P(1,{k:'beam',life:.6,max:.6,col:side==='P'?'34,228,240':'255,62,165',w:1.4,dash:1,delay:0});return;
    case 'taser':a.fxT=.4;P(4,{k:'beam',life:.25,max:.25,col:'150,200,255',w:1});return;
    case 'fireball':a.fxT=1.2;P(1,{k:'orb',life:1,max:1,col:'255,130,40',r:6,arc:40,delay:0});P(2,{k:'boom',life:1,max:1,delay:.95});return;
    case 'breath':a.fxT=1;P(6,{k:'orb',life:.6,max:.6,col:'255,110,30',r:4});P(3,{k:'boom',life:1,max:1,delay:.45});return;
    case 'elfbow':a.fxT=.45;P(5,{k:'arrow',life:.6,max:.6});return;
  }
  return _shotFx(b,a,c,RW);
};

/* ---------- badge glyphs for the new types ---------- */
const NEWG={
  recon:(c,s)=>{for(const dx of [-.32,.32]){c.beginPath();c.arc(dx*s,.1*s,.26*s,0,7);c.stroke()}c.beginPath();c.moveTo(-.06*s,.1*s);c.lineTo(.06*s,.1*s);c.stroke()},
  mlrs:(c,s)=>{c.fillRect(-.65*s,.3*s,1.3*s,.3*s);for(const dx of [-.3,0,.3]){c.beginPath();c.moveTo(dx*s,.3*s);c.lineTo((dx+.35)*s,-.6*s);c.stroke()}},
  mortar:(c,s)=>{c.beginPath();c.moveTo(-.3*s,.55*s);c.lineTo(.35*s,-.6*s);c.stroke();c.beginPath();c.moveTo(-.6*s,.6*s);c.lineTo(.3*s,.6*s);c.stroke()},
  manpads:(c,s)=>{c.save();c.rotate(-.8);c.fillRect(-.12*s,-.7*s,.24*s,1.2*s);c.restore();c.beginPath();c.moveTo(.35*s,-.55*s);c.lineTo(.62*s,-.7*s);c.stroke()},
  sniper:(c,s)=>{c.beginPath();c.arc(0,0,.5*s,0,7);c.stroke();c.beginPath();c.moveTo(-.75*s,0);c.lineTo(.75*s,0);c.moveTo(0,-.75*s);c.lineTo(0,.75*s);c.stroke()},
  jet:(c,s)=>{c.beginPath();c.moveTo(0,-.75*s);c.lineTo(.6*s,.45*s);c.lineTo(0,.2*s);c.lineTo(-.6*s,.45*s);c.closePath();c.fill()},
  galley:(c,s)=>{c.beginPath();c.moveTo(-.7*s,0);c.quadraticCurveTo(0,.45*s,.75*s,-.05*s);c.stroke();for(const dx of [-.4,-.1,.2,.45]){c.beginPath();c.moveTo(dx*s,.15*s);c.lineTo((dx-.15)*s,.6*s);c.stroke()}},
  hgalley:(c,s)=>{c.beginPath();c.moveTo(-.7*s,.1*s);c.quadraticCurveTo(0,.6*s,.75*s,.05*s);c.closePath();c.fill();c.beginPath();c.arc(0,-.25*s,.28*s,0,7);c.stroke()},
  sotl:(c,s)=>{c.fillRect(-.7*s,.3*s,1.4*s,.3*s);for(const dx of [-.4,0,.4]){c.fillRect((dx-.18)*s,-.6*s,.36*s,.7*s)}},
  frigate:(c,s)=>{c.fillRect(-.6*s,.3*s,1.2*s,.25*s);for(const dx of [-.22,.25]){c.fillRect((dx-.17)*s,-.55*s,.34*s,.65*s)}},
  fireship:(c,s)=>{c.beginPath();c.moveTo(0,-.7*s);c.quadraticCurveTo(.55*s,-.05*s,.3*s,.5*s);c.quadraticCurveTo(0,.25*s,-.3*s,.5*s);c.quadraticCurveTo(-.55*s,-.05*s,0,-.7*s);c.fill()},
  ddg:(c,s)=>{c.beginPath();c.moveTo(-.75*s,.25*s);c.lineTo(.75*s,.25*s);c.lineTo(.55*s,.5*s);c.lineTo(-.6*s,.5*s);c.closePath();c.fill();c.fillRect(-.2*s,-.15*s,.4*s,.4*s);c.beginPath();c.moveTo(.35*s,.1*s);c.lineTo(.6*s,-.6*s);c.stroke()},
  ffg:(c,s)=>{c.beginPath();c.moveTo(-.7*s,.2*s);c.lineTo(.7*s,.2*s);c.lineTo(.5*s,.45*s);c.lineTo(-.55*s,.45*s);c.closePath();c.fill();for(const r of [.25,.5]){c.beginPath();c.arc(0,-.15*s,r*s,-2.5,-.64);c.stroke()}},
  sub:(c,s)=>{c.beginPath();c.ellipse(0,.25*s,.75*s,.22*s,0,0,7);c.fill();c.fillRect(-.12*s,-.3*s,.26*s,.4*s);c.beginPath();c.moveTo(.02*s,-.3*s);c.lineTo(.02*s,-.6*s);c.lineTo(.25*s,-.6*s);c.stroke()},
  carrier:(c,s)=>{c.fillRect(-.75*s,.05*s,1.5*s,.35*s);c.fillRect(.25*s,-.4*s,.25*s,.45*s)},
  fac:(c,s)=>{c.beginPath();c.moveTo(-.4*s,.1*s);c.lineTo(.6*s,.1*s);c.lineTo(.4*s,.35*s);c.lineTo(-.4*s,.35*s);c.closePath();c.fill();for(const dy of [-.25,0,.25]){c.beginPath();c.moveTo(-.75*s,(dy+.1)*s);c.lineTo(-.5*s,(dy+.1)*s);c.stroke()}},
  fighter:(c,s)=>{c.beginPath();c.moveTo(0,-.7*s);c.lineTo(.12*s,.4*s);c.lineTo(-.12*s,.4*s);c.closePath();c.fill();c.beginPath();c.moveTo(-.65*s,-.2*s);c.lineTo(.65*s,.5*s);c.moveTo(.65*s,-.2*s);c.lineTo(-.65*s,.5*s);c.stroke()},
  bomber:(c,s)=>{c.beginPath();c.moveTo(0,-.6*s);c.lineTo(.7*s,.45*s);c.lineTo(-.7*s,.45*s);c.closePath();c.fill()},
  corvette:(c,s)=>{c.beginPath();c.moveTo(0,-.7*s);c.lineTo(.5*s,0);c.lineTo(0,.7*s);c.lineTo(-.5*s,0);c.closePath();c.stroke();c.beginPath();c.arc(0,0,.15*s,0,7);c.fill()},
  sdd:(c,s)=>{c.beginPath();c.moveTo(0,-.75*s);c.lineTo(.45*s,.6*s);c.lineTo(-.45*s,.6*s);c.closePath();c.fill()},
  bship:(c,s)=>{c.beginPath();c.moveTo(0,-.75*s);c.lineTo(.6*s,.2*s);c.lineTo(.6*s,.6*s);c.lineTo(-.6*s,.6*s);c.lineTo(-.6*s,.2*s);c.closePath();c.fill()},
  scarrier:(c,s)=>{c.strokeRect(-.65*s,-.45*s,1.3*s,.9*s);for(const dx of [-.3,0,.3])c.fillRect((dx-.06)*s,-.06*s,.12*s,.12*s)},
  brawler:(c,s)=>{c.fillRect(-.55*s,-.3*s,.8*s,.6*s);c.fillRect(.25*s,-.15*s,.45*s,.3*s);c.beginPath();c.moveTo(-.45*s,-.3*s);c.lineTo(-.45*s,-.75*s);c.stroke()},
  fusil:(c,s)=>{c.beginPath();c.moveTo(-.7*s,.5*s);c.lineTo(.7*s,-.5*s);c.stroke();c.beginPath();c.arc(-.35*s,.05*s,.2*s,0,7);c.fill()},
  tesla:(c,s)=>{c.beginPath();c.moveTo(.2*s,-.75*s);c.lineTo(-.3*s,0);c.lineTo(.15*s,0);c.lineTo(-.2*s,.75*s);c.stroke()},
  clock:(c,s)=>{c.beginPath();for(let i=0;i<12;i++){const a=i*Math.PI/6,r=i%2?.45*s:.65*s;i?c.lineTo(Math.cos(a)*r,Math.sin(a)*r):c.moveTo(r,0)}c.closePath();c.fill();c.save();c.fillStyle='#1B2A3A';c.beginPath();c.arc(0,0,.2*s,0,7);c.fill();c.restore()},
  walker:(c,s)=>{c.fillRect(-.45*s,-.6*s,.9*s,.55*s);c.beginPath();c.moveTo(-.3*s,-.05*s);c.lineTo(-.55*s,.65*s);c.moveTo(.3*s,-.05*s);c.lineTo(.55*s,.65*s);c.stroke()},
  iclad:(c,s)=>{c.fillRect(-.7*s,-.2*s,1.4*s,.5*s);for(const dx of [-.45,0,.45]){c.beginPath();c.arc(dx*s,.45*s,.17*s,0,7);c.fill()}c.fillRect(-.2*s,-.55*s,.4*s,.35*s)},
  zep:(c,s)=>{c.beginPath();c.ellipse(0,-.1*s,.75*s,.35*s,0,0,7);c.fill();c.fillRect(-.2*s,.3*s,.4*s,.22*s)},
  orni:(c,s)=>{c.beginPath();c.moveTo(0,0);c.quadraticCurveTo(-.4*s,-.7*s,-.75*s,-.3*s);c.moveTo(0,0);c.quadraticCurveTo(.4*s,-.7*s,.75*s,-.3*s);c.stroke();c.fillRect(-.1*s,-.1*s,.2*s,.6*s)},
  dread:(c,s)=>{c.fillRect(-.75*s,.2*s,1.5*s,.3*s);for(const dx of [-.5,-.2,.25,.55])c.fillRect((dx-.08)*s,0,.16*s,.2*s);c.fillRect(-.1*s,-.45*s,.2*s,.45*s);c.beginPath();c.moveTo(0,-.45*s);c.lineTo(0,-.75*s);c.stroke()},
  bcr:(c,s)=>{c.beginPath();c.moveTo(-.75*s,.25*s);c.lineTo(.75*s,.15*s);c.lineTo(.6*s,.5*s);c.lineTo(-.7*s,.5*s);c.closePath();c.fill();for(const dx of [-.25,0,.25])c.fillRect((dx-.06)*s,-.25*s,.12*s,.45*s)},
  lcr:(c,s)=>{c.fillRect(-.6*s,.25*s,1.2*s,.22*s);for(const dx of [-.3,-.1,.1,.3])c.fillRect((dx-.04)*s,-.2*s,.08*s,.45*s)},
  tbd:(c,s)=>{c.beginPath();c.moveTo(-.7*s,.3*s);c.lineTo(.75*s,.2*s);c.lineTo(-.7*s,.5*s);c.closePath();c.fill();c.beginPath();c.moveTo(-.2*s,-.15*s);c.lineTo(.5*s,-.15*s);c.stroke();c.beginPath();c.moveTo(.5*s,-.15*s);c.lineTo(.35*s,-.3*s);c.moveTo(.5*s,-.15*s);c.lineTo(.35*s,0);c.stroke()},
  uboat:(c,s)=>{c.beginPath();c.ellipse(0,.3*s,.75*s,.18*s,0,0,7);c.fill();c.fillRect(-.12*s,-.1*s,.24*s,.35*s);c.beginPath();c.moveTo(0,-.1*s);c.lineTo(0,-.55*s);c.lineTo(.2*s,-.55*s);c.stroke()},
  mage:(c,s)=>{c.beginPath();for(let i=0;i<8;i++){const r=i%2?.2*s:.72*s,a=-Math.PI/2+i*Math.PI/4;i?c.lineTo(Math.cos(a)*r,Math.sin(a)*r):c.moveTo(Math.cos(a)*r,Math.sin(a)*r)}c.closePath();c.fill()},
  elf:(c,s)=>{c.beginPath();c.moveTo(0,-.7*s);c.quadraticCurveTo(.6*s,0,0,.7*s);c.quadraticCurveTo(-.6*s,0,0,-.7*s);c.fill()},
  dragon:(c,s)=>{c.beginPath();c.moveTo(0,-.3*s);c.lineTo(.75*s,-.5*s);c.lineTo(.45*s,.2*s);c.lineTo(0,.6*s);c.lineTo(-.45*s,.2*s);c.lineTo(-.75*s,-.5*s);c.closePath();c.fill()},
  golem:(c,s)=>{c.fillRect(-.5*s,-.5*s,1*s,1*s)},
  undead:(c,s)=>{c.beginPath();c.arc(0,-.1*s,.5*s,0,7);c.fill();c.save();c.fillStyle='#1B2A3A';c.beginPath();c.arc(-.2*s,-.15*s,.12*s,0,7);c.arc(.2*s,-.15*s,.12*s,0,7);c.fill();c.restore();c.fillRect(-.25*s,.3*s,.5*s,.25*s)},
  griffin:(c,s)=>{c.beginPath();c.moveTo(-.7*s,.3*s);c.quadraticCurveTo(-.2*s,-.7*s,.7*s,-.45*s);c.quadraticCurveTo(0,-.1*s,-.7*s,.3*s);c.fill()},
};
const _glyph=glyph;
glyph=function(c,type,x,y,s,col){const f=NEWG[type];if(!f)return _glyph(c,type,x,y,s,col);c.save();c.translate(x,y);c.strokeStyle=c.fillStyle=col||'#F2EEE2';c.lineCap='round';c.lineJoin='round';c.lineWidth=Math.max(1.2,s*.2);f(c,s);c.restore()};

/* ---------- 2D figures for the new types ---------- */
const FIG_AS={brawler:'inf',fusil:'line',tesla:'minf',clock:'heavy',iclad:'tank',walker:'ifv',mage:'minf',elf:'arc',undead:'inf',sniper:'minf',mortar:'atgm',manpads:'atgm',golem:'heavy',griffin:'cav',recon:'ifv',mlrs:'howz'};
const _figure=figure;
figure=function(c,T,x,y,S,front,j){
  const t=TYPES[T];
  if(t&&t.naval||T==='gen'&&G.b&&theatreOf(G.b.s)==='sea'){const L=T==='carrier'?28:T==='dread'||T==='bcr'?26:T==='lcr'?18:T==='tbd'?12:T==='uboat'?12:T==='sotl'||T==='gen'?24:T==='fac'?9:T==='sub'?16:19,Wd=T==='carrier'?8:T==='sotl'?7:T==='fac'?3:4.6;
    c.fillStyle='rgba(255,255,255,.18)';c.beginPath();c.ellipse(x,y+L*.55,Wd*.7,L*.25,0,0,7);c.fill();
    c.fillStyle=t&&t.armor==='wood'?'#5A3A20':T==='sub'?'#1E2226':'#7A8698';c.beginPath();c.moveTo(x,y-L/2);c.quadraticCurveTo(x+Wd/2,y-L/4,x+Wd/2,y+L/2);c.lineTo(x-Wd/2,y+L/2);c.quadraticCurveTo(x-Wd/2,y-L/4,x,y-L/2);c.fill();
    if(t&&t.armor==='wood'&&T!=='galley'&&T!=='hgalley'){c.fillStyle=S.hi;for(const k of [-.25,.05,.3]){c.fillRect(x-Wd*.75,y+L*k-1.6,Wd*1.5,3.2)}}
    else if(T==='galley'||T==='hgalley'){c.strokeStyle='#3A2412';c.lineWidth=.5;for(let k=-3;k<=3;k++){c.beginPath();c.moveTo(x-Wd/2,y+k*2);c.lineTo(x-Wd/2-3,y+k*2+1);c.moveTo(x+Wd/2,y+k*2);c.lineTo(x+Wd/2+3,y+k*2+1);c.stroke()}c.fillStyle=S.tunic;c.fillRect(x-Wd*.6,y-2,Wd*1.2,3)}
    else{c.fillStyle=S.metal;c.fillRect(x-Wd*.25,y-L*.1,Wd*.5,L*.25)}
    c.fillStyle=S.shield;c.fillRect(x-1,y+L/2-3,2,2);return}
  if(t&&t.space||T==='gen'&&G.b&&theatreOf(G.b.s)==='space'){const L=T==='bship'||T==='gen'?26:T==='scarrier'?24:T==='sdd'?20:T==='corvette'?12:7,Wd=L*.42;
    c.fillStyle=S.body;c.beginPath();c.moveTo(x,y-L/2);c.lineTo(x+Wd/2,y+L/2);c.lineTo(x-Wd/2,y+L/2);c.closePath();c.fill();
    c.fillStyle=`rgba(${S===ERA_COL.space.P?'110,190,255':'255,120,90'},.9)`;c.fillRect(x-Wd*.3,y+L/2,Wd*.6,1.4);return}
  if(T==='dragon'){c.fillStyle=S.tunic;c.beginPath();c.ellipse(x,y,3,9,0,0,7);c.fill();c.beginPath();c.moveTo(x,y-2);c.lineTo(x+12,y-6);c.lineTo(x+3,y+4);c.closePath();c.fill();c.beginPath();c.moveTo(x,y-2);c.lineTo(x-12,y-6);c.lineTo(x-3,y+4);c.closePath();c.fill();return}
  if(T==='zep'){c.fillStyle='#E2D6BC';c.beginPath();c.ellipse(x,y,4,10,0,0,7);c.fill();c.fillStyle=S.tunic;c.fillRect(x-1.5,y-2,3,5);return}
  if(T==='orni'||T==='jet'){if(T==='jet'){c.fillStyle=S.body;c.beginPath();c.moveTo(x,y-7);c.lineTo(x+6,y+4);c.lineTo(x-6,y+4);c.closePath();c.fill();return}return _figure(c,'drone',x,y,S,front,j)}
  return _figure(c,FIG_AS[T]||T,x,y,S,front,j);
};

/* single-figure commanders at sea, in space and in the city */
const _unitLayout=unitLayout;
unitLayout=function(u){if(u.type==='gen'&&(u.naval||u.space||(G.b&&G.b.s.era==='steam')))return{sx:1,sy:1,cols:1,rows:1,ox:0,oy:0};if(TYPES[u.type]&&(TYPES[u.type].naval||TYPES[u.type].space)&&V3.low===undefined){}return _unitLayout(u)};

/* ---------- placing armies on maps with obstacles ---------- */
function passableSpec(g,sp,city){const t=genTerrain(g,sp.x,sp.y),T=TYPES[sp.type]||{};
  if(T.air||T.space)return true;const naval=T.naval||(sp.type==='gen'&&g.theatre==='sea');
  if(naval)return t==='sea'||t==='shoal';if(t==='sea'||t==='river'||t==='water'||t==='island'&&g.theatre==='sea')return false;
  if(city&&t==='town'&&VEH.has(sp.type))return false;return true}
function settleSpecs(list,g,city){for(const sp of list){if(passableSpec(g,sp,city))continue;let done=false;
  for(let r=8;r<200&&!done;r+=8)for(let a=0;a<6.28&&!done;a+=.5){const x=sp.x+Math.cos(a)*r,y=sp.y+Math.sin(a)*r;if(x<20||x>W-20||y<20||y>H-20)continue;if(passableSpec(g,Object.assign({},sp,{x,y}),city)){sp.x=x;sp.y=y;done=true}}}return list}

/* ---------- rosters for the new eras (Endless War and 1 v 1) ---------- */
ROSTER.modern.units.push(
  {key:'recon',type:'recon',name:'Recon troop',men:500,cost:90},
  {key:'mlrs',type:'mlrs',name:'Rocket battery',men:600,cost:170},
  {key:'mortar',type:'mortar',name:'Mortar section',men:300,cost:80},
  {key:'manpads',type:'manpads',name:'MANPADS team',men:200,cost:80},
  {key:'sniper',type:'sniper',name:'Sniper team',men:60,cost:70},
  {key:'jet',type:'jet',name:'Strike pair',men:500,cost:220});
Object.assign(ROSTER,{
  galley:{label:'Galley wars',render:'sail',theatre:'sea',units:[
    {key:'galley',type:'galley',name:'Triremes',men:1500,cost:100},{key:'hgalley',type:'hgalley',name:'Quinqueremes',men:1800,cost:150},{key:'fireship',type:'fireship',name:'Fireships',men:240,cost:90}]},
  sail:{label:'Age of Sail',render:'sail',theatre:'sea',units:[
    {key:'sotl',type:'sotl',name:'Ships of the line',men:1400,cost:180},{key:'frigate',type:'frigate',name:'Frigates',men:840,cost:110},{key:'fireship',type:'fireship',name:'Fireships',men:180,cost:80}]},
  navy:{label:'Modern navy',render:'navy',theatre:'sea',units:[
    {key:'ddg',type:'ddg',name:'Destroyer pair',men:600,cost:170},{key:'ffg',type:'ffg',name:'ASW frigates',men:400,cost:120},{key:'sub',type:'sub',name:'Attack submarines',men:260,cost:150},
    {key:'carrier',type:'carrier',name:'Carrier group',men:3000,cost:260},{key:'fac',type:'fac',name:'Missile boats',men:120,cost:70},{key:'jet',type:'jet',name:'Strike pair',men:500,cost:200}]},
  space:{label:'Deep space',render:'space',theatre:'space',units:[
    {key:'fighter',type:'fighter',name:'Fighter wing',men:240,cost:80},{key:'bomber',type:'bomber',name:'Bomber wing',men:240,cost:110},{key:'corvette',type:'corvette',name:'Flak corvettes',men:360,cost:90},
    {key:'sdd',type:'sdd',name:'Destroyers',men:1200,cost:160},{key:'bship',type:'bship',name:'Battleship',men:3000,cost:250},{key:'scarrier',type:'scarrier',name:'Strike carrier',men:2500,cost:220}]},
  steam:{label:'Steampunk',render:'steam',theatre:'steam',units:[
    {key:'fusil',type:'fusil',name:'Fusilier company',men:120,cost:90},{key:'brawler',type:'brawler',name:'Brawler gang',men:80,cost:100},{key:'tesla',type:'tesla',name:'Tesla section',men:40,cost:110},
    {key:'clock',type:'clock',name:'Automaton squad',men:40,cost:130},{key:'walker',type:'walker',name:'Walker troop',men:24,cost:160},{key:'iclad',type:'iclad',name:'Land ironclad',men:60,cost:200},
    {key:'zep',type:'zep',name:'Dirigible',men:80,cost:180},{key:'orni',type:'orni',name:'Ornithopter flight',men:16,cost:90}]},
  dread:{label:'Dreadnoughts',render:'dread',theatre:'sea',units:[
    {key:'dread',type:'dread',name:'Battle squadron',men:4400,cost:240},{key:'bcr',type:'bcr',name:'Battlecruisers',men:2200,cost:200},{key:'lcr',type:'lcr',name:'Light cruisers',men:900,cost:110},
    {key:'tbd',type:'tbd',name:'Destroyer flotilla',men:540,cost:100},{key:'uboat',type:'uboat',name:'U-boat flotilla',men:140,cost:120}]},
  magic:{label:'Fantasy',render:'magic',theatre:'magic',units:[
    {key:'inf',type:'inf',name:'Swordsmen',men:2500,cost:90},{key:'cav',type:'cav',name:'Knights',men:1000,cost:140,melee:1.35},{key:'elf',type:'elf',name:'Elven archers',men:1500,cost:120},
    {key:'mage',type:'mage',name:'Battle mages',men:120,cost:150},{key:'dragon',type:'dragon',name:'Dragon',men:800,cost:250},{key:'golem',type:'golem',name:'Golems',men:750,cost:180},
    {key:'undead',type:'undead',name:'Undead legion',men:4000,cost:110,resolve:.35},{key:'griffin',type:'griffin',name:'Griffin riders',men:300,cost:150}]},
});
MIRROR.modern=['tank','tank','ifv','minf','minf','atgm','recon','mortar','howz','manpads','drone'];
Object.assign(MIRROR,{galley:['galley','galley','galley','hgalley','hgalley','fireship'],sail:['sotl','sotl','sotl','frigate','frigate','fireship'],navy:['ddg','ddg','ffg','sub','sub','carrier','fac','fac','jet'],
  space:['fighter','fighter','bomber','corvette','sdd','sdd','bship','scarrier'],steam:['fusil','fusil','fusil','brawler','tesla','clock','walker','iclad','zep','orni'],dread:['dread','dread','dread','bcr','bcr','lcr','tbd','tbd','uboat'],magic:['inf','inf','elf','mage','cav','dragon','golem','undead']});
const THEME_OF={ancient:'ancient',medieval:'medieval',napoleon:'napoleon',modern:'modern',galley:'galley',sail:'sail',navy:'navy',space:'space',steam:'steam',dread:'dread',magic:'magic'};
const LETH={navy:.6,dread:.55,space:.75,steam:.95,sail:1,magic:1};
function theatreMap(era,seed,sym){const r=ROSTER[era],th=r.theatre;
  if(th==='sea')return seaMap(seed,{sym,era:r.render});if(th==='space')return spaceMap(seed,{sym});if(th==='city')return cityMap(seed,{sym});if(th==='steam'){if(rng(seed+3)()<.5)return cityMap(seed,{sym,steam:true});const g=sym?mirrorMap('napoleon',seed):genMap('napoleon',seed);g.era='steam';g.theatre='land';g.towns=[];return g}if(th==='magic')return magicMap(seed,{sym});
  if(era==='modern'&&rng(seed)()<.4)return cityMap(seed,{sym});return null}
const CMDR={sea:'Flagship',space:'Flagship',city:'Command team'};const CMDR_ERA={steam:'Command walker'};
const _bms=buildMirrorScenario;
buildMirrorScenario=function(era,seedIn){
  const seed=seedIn!=null?seedIn:Math.floor(Math.random()*1e6),g=theatreMap(era,seed,true);
  const id=_bms(era,seed),s=SCEN[id];s.theme=THEME_OF[era];
  if(!g)return id;
  const r=ROSTER[era],render=r.render;
  s.gen=g;s.terrain=(x,y)=>genTerrain(g,x,y);s.era=render;s.leth=LETH[render]||s.leth;s.city=g.theatre==='city';
  const cm=CMDR_ERA[era]||CMDR[g.theatre];if(cm){s.player.forEach(u=>{if(u.type==='gen')u.name='Your '+cm.toLowerCase()});s.enemy.forEach(u=>{if(u.type==='gen')u.name='Enemy '+cm.toLowerCase()})}
  settleSpecs(s.player,g,s.city);s.enemy.forEach((u,i)=>{const p=s.player[i];if(p){u.x=W-p.x;u.y=H-p.y}});
  return id};
const _bes=buildEndlessScenario;
buildEndlessScenario=function(camp){const id=_bes(camp),s=SCEN[id],r=ROSTER[camp.era];s.theme=THEME_OF[camp.era];if(!r.theatre)return id;
  const g=theatreMap(camp.era,Math.floor(Math.random()*1e6),false);if(!g)return id;s.gen=g;s.terrain=(x,y)=>genTerrain(g,x,y);s.era=r.render;s.leth=LETH[r.render]||1;s.city=g.theatre==='city';
  settleSpecs(s.player,g,s.city);settleSpecs(s.enemy,g,s.city);return id};

/* =====================================================================
   NEW SCENARIOS
   ===================================================================== */
const A=(mode,delay,extra)=>Object.assign({mode,delay:delay||0},extra||{});
function addScen(id,def){const g=def.gen;def.terrain=def.terrain||((x,y)=>genTerrain(g,x,y));def.events=def.events||[];def.city=def.city||(g&&g.theatre==='city');
  if(g){settleSpecs(def.player,g,def.city);settleSpecs(def.enemy,g,def.city)}SCEN[id]=def}
PAL_ERA.desert={a:[150,124,84],b:[204,178,128]};PAL_ERA.highland={a:[44,62,40],b:[98,112,70]};

/* ---- Bannockburn 1314 ---- */
const BANN={theatre:'land',era:'old',seed:1314,hills:[{cx:420,cy:600,rx:380,ry:120,h:24}],hillNames:['Coxet Hill'],woods:[{cx:120,cy:470,rx:120,ry:110},{cx:900,cy:560,rx:90,ry:60}],towns:[{x0:620,x1:700,y0:600,y1:636}],
  river:{y0:330,A:12,f:70,ph:1.1,cross:[{x0:180,x1:240,kind:'ford'},{x0:470,x1:530,kind:'ford'},{x0:760,x1:820,kind:'ford'}]},marsh:[{cx:700,cy:250,rx:150,ry:60},{cx:300,cy:255,rx:90,ry:40}]};
addScen('bannockburn',{group:'medieval',theme:'medieval',eraKey:'highland',foe:'Edward II',name:'Bannockburn',year:'1314',place:'Stirling, Scotland',you:'Robert the Bruce',sides:['Scotland','England'],diff:'Hard',era:'ancient',gen:BANN,
  teaser:'Spear rings against armoured knights. The English must cross the burn and the bog to reach you.',objective:'Break the English army',deploy:360,leth:1,pmod:{resolve:.85},
  brief:['Your schiltrons are dense rings of spearmen: horses break on them. Keep them together and let the knights come.','The Bannock Burn can only be crossed at the fords, and the carse beyond it is bog. Knights caught in the mud are slow and tired.','English longbows can shred a schiltron from range. Your light horse should ride them down early.'],
  player:[{name:'Robert the Bruce',type:'gen',x:500,y:590,men:500},
    {name:'Moray’s schiltron',type:'shield',x:300,y:450,men:2400,melee:1.15},{name:'Edward Bruce’s schiltron',type:'shield',x:420,y:470,men:2400,melee:1.15},{name:'Douglas’s schiltron',type:'shield',x:560,y:470,men:2200,melee:1.15},{name:'The King’s schiltron',type:'shield',x:690,y:460,men:2600,melee:1.15},
    {name:'Keith’s light horse',type:'cav',x:850,y:470,men:500},{name:'Scottish archers',type:'arc',x:200,y:520,men:500},{name:'Highland foot',type:'inf',x:520,y:540,men:1500}],
  enemy:[{name:'Edward II',type:'gen',x:500,y:40,men:400,ai:A('general')},
    {name:'Vanguard knights',type:'cav',x:500,y:130,men:1500,melee:1.3,ai:A('advance',0)},{name:'Gloucester’s knights',type:'cav',x:330,y:110,men:1200,melee:1.3,ai:A('advance',1)},{name:'Hereford’s knights',type:'cav',x:680,y:110,men:1200,melee:1.3,ai:A('advance',2)},
    {name:'English longbows',type:'arc',x:820,y:170,men:2000,ai:A('skirmish',3)},{name:'Welsh archers',type:'arc',x:170,y:170,men:1500,ai:A('skirmish',4)},
    {name:'Foot levies',type:'inf',x:420,y:60,men:3500,ai:A('advance',6)},{name:'Foot levies II',type:'inf',x:600,y:60,men:3500,ai:A('advance',8)},{name:'Men-at-arms',type:'heavy',x:500,y:200,men:1500,ai:A('advance',4)}],
  events:[{t:1,msg:'The English knights spur toward the burn.'},{t:40,msg:'English archers are moving onto your flank!'}],
  history:'On 23–24 June 1314 Robert the Bruce faced a much larger English army near Stirling Castle. The English crossed the Bannock Burn and camped on the boggy carse; at dawn the Scottish schiltrons advanced and pinned the cramped English cavalry against the streams. Their archers were ridden down by Scottish horse, and the English army collapsed, Edward II barely escaping. It secured Scottish independence for a generation.'});

/* ---- Salamis 480 BC ---- */
const SALA={theatre:'sea',era:'sail',seed:480,islands:[{cx:260,cy:690,rx:420,ry:120},{cx:780,cy:-40,rx:420,ry:130},{cx:880,cy:330,rx:40,ry:24},{cx:60,cy:120,rx:140,ry:90}],hills:[],woods:[],towns:[],river:null,hillNames:[]};
addScen('salamis',{group:'naval',theme:'galley',eraKey:'sail',foe:'The Persian fleet',name:'Salamis',year:'480 BC',place:'Strait of Salamis, Greece',you:'Themistocles',sides:['Greek allies','Persia'],diff:'Medium',era:'sail',gen:SALA,
  teaser:'Lure a bigger fleet into a narrow strait, then ram it from the side.',objective:'Break the Persian fleet',deploy:380,leth:1,pmod:{q:1.1},
  brief:['Triremes fight by ramming. A galley that hits an enemy in the side or rear does far more damage.','The strait is narrow: the Persians cannot use their numbers. Hold the line and let them crowd.','Your heavy quinqueremes carry marines. Board ships that are already damaged.'],
  player:[{name:'Themistocles',type:'gen',x:500,y:560,men:300},
    {name:'Athenian squadron I',type:'galley',x:300,y:470,men:1500},{name:'Athenian squadron II',type:'galley',x:420,y:470,men:1500},{name:'Athenian squadron III',type:'galley',x:540,y:470,men:1500},{name:'Aeginetan squadron',type:'galley',x:660,y:470,men:1500},
    {name:'Corinthian ships',type:'hgalley',x:360,y:540,men:1800},{name:'Spartan ships',type:'hgalley',x:620,y:540,men:1800}],
  enemy:[{name:'Xerxes’ admiral',type:'gen',x:520,y:110,men:300,ai:A('general')},
    {name:'Phoenician squadron I',type:'galley',x:300,y:190,men:1600,ai:A('advance',0)},{name:'Phoenician squadron II',type:'galley',x:420,y:190,men:1600,ai:A('advance',0)},{name:'Ionian squadron',type:'galley',x:540,y:190,men:1600,ai:A('advance',1)},
    {name:'Egyptian squadron',type:'galley',x:660,y:200,men:1600,ai:A('advance',2)},{name:'Cypriot squadron',type:'galley',x:400,y:120,men:1500,ai:A('advance',4)},{name:'Carian squadron',type:'hgalley',x:600,y:130,men:1800,ai:A('advance',5)},
    {name:'Cilician squadron',type:'hgalley',x:250,y:120,men:1800,ai:A('advance',7)},{name:'Persian reserve',type:'galley',x:520,y:60,men:1600,ai:A('advance',10)}],
  events:[{t:1,msg:'The Persian fleet rows into the strait.'}],
  history:'In September 480 BC the Greek fleet under Themistocles lured the much larger Persian navy into the narrow strait between Salamis and the mainland. Packed together, the Persian ships could not manoeuvre, and the heavier Greek triremes rammed them in the flanks. Xerxes watched from the shore as his fleet broke. The defeat ended the Persian invasion by sea.'});

/* ---- Trafalgar 1805 ---- */
const TRAF={theatre:'sea',era:'sail',seed:1805,islands:[{cx:1060,cy:90,rx:120,ry:80}],hills:[],woods:[],towns:[],river:null,hillNames:[]};
addScen('trafalgar',{group:'naval',theme:'sail',eraKey:'sail',foe:'Villeneuve',name:'Trafalgar',year:'1805',place:'Cape Trafalgar, Spain',you:'Admiral Nelson',sides:['Britain','France & Spain'],diff:'Medium',era:'sail',gen:TRAF,
  teaser:'Two columns cut straight through the enemy line. Break it, then destroy it piece by piece.',objective:'Break the combined fleet',deploy:380,leth:1,pmod:{q:1.25,resolve:.85},
  brief:['Your ships of the line hit hard but turn slowly. Aim each column at a gap in the enemy line.','Ships that break through can pound the enemy from both sides. A ship under fire from two sides breaks fast.','Frigates are too light for the line: use them to finish damaged ships.'],
  player:[{name:'HMS Victory (Nelson)',type:'gen',x:400,y:600,men:850},
    {name:'Weather column: Temeraire',type:'sotl',x:400,y:520,men:1400},{name:'Weather column: Neptune',type:'sotl',x:400,y:450,men:1400},{name:'Weather column: Britannia',type:'sotl',x:330,y:560,men:1400},
    {name:'Lee column: Royal Sovereign',type:'sotl',x:640,y:440,men:1400},{name:'Lee column: Belleisle',type:'sotl',x:640,y:510,men:1400},{name:'Lee column: Mars',type:'sotl',x:640,y:580,men:1400},
    {name:'Frigate Euryalus',type:'frigate',x:200,y:520,men:840},{name:'Frigate Naiad',type:'frigate',x:820,y:540,men:840}],
  enemy:[{name:'Bucentaure (Villeneuve)',type:'gen',x:470,y:210,men:850,ai:A('general')},
    {name:'Santísima Trinidad',type:'sotl',x:380,y:210,men:1800,ai:A('advance',2)},{name:'Redoutable',type:'sotl',x:560,y:220,men:1400,ai:A('advance',2)},{name:'Neptune (Fr.)',type:'sotl',x:650,y:230,men:1400,ai:A('advance',3)},
    {name:'Santa Ana',type:'sotl',x:760,y:240,men:1600,ai:A('advance',3)},{name:'Fougueux',type:'sotl',x:850,y:250,men:1400,ai:A('advance',4)},{name:'Héros',type:'sotl',x:290,y:200,men:1400,ai:A('advance',4)},
    {name:'San Agustín',type:'sotl',x:200,y:190,men:1400,ai:A('advance',5)},{name:'Intrépide',type:'sotl',x:110,y:180,men:1400,ai:A('advance',6)},{name:'French frigates',type:'frigate',x:500,y:110,men:840,ai:A('skirmish',2)}],
  events:[{t:1,msg:'England expects that every man will do his duty.'}],
  history:'On 21 October 1805 Nelson attacked the Franco-Spanish fleet off Cape Trafalgar in two columns, cutting the enemy line instead of fighting alongside it. The broken line was overwhelmed ship by ship: 22 allied ships were lost, none British. Nelson was killed by a sharpshooter on the Redoutable, but the battle secured British command of the sea for a century.'});

/* ---- Strait of Kestrel (fictional modern naval) ---- */
const KEST={theatre:'sea',era:'navy',seed:2031,islands:[{cx:230,cy:320,rx:120,ry:55},{cx:600,cy:300,rx:70,ry:40},{cx:860,cy:350,rx:110,ry:50},{cx:420,cy:400,rx:36,ry:22}],hills:[],woods:[],towns:[],river:null,hillNames:[]};
addScen('kestrel',{group:'naval',theme:'navy',eraKey:'navy',foe:'The Northern Fleet',name:'Strait of Kestrel',year:'21st c.',place:'Fictional scenario',you:'Rear Adm. Sona Reyes',sides:['Coalition','Northern Fleet'],diff:'Hard',era:'navy',gen:KEST,
  teaser:'Missiles, submarines and an island chain. Find the enemy before it finds you.',objective:'Break the Northern Fleet',deploy:420,leth:.6,pmod:{q:1.1},
  brief:['Submarines are invisible until they fire. Your ASW frigates find them; keep the carrier behind the frigates.','Destroyers fire missiles at ships and aircraft alike. Missile boats are cheap and fast: do not let a pack reach your carrier.','The carrier’s air wing can hit anything on the map. Protect it and it wins the battle for you.'],
  player:[{name:'Task force command',type:'gen',x:500,y:600,men:500},{name:'Carrier Meridian',type:'carrier',x:500,y:560,men:3000},
    {name:'Destroyer Halyard',type:'ddg',x:360,y:500,men:600},{name:'Destroyer Keel',type:'ddg',x:640,y:500,men:600},{name:'Frigate Wren',type:'ffg',x:250,y:470,men:400},{name:'Frigate Plover',type:'ffg',x:760,y:470,men:400},
    {name:'Submarine Nautilus',type:'sub',x:520,y:440,men:260},{name:'Strike pair Viper',type:'jet',x:500,y:620,men:500}],
  enemy:[{name:'Northern flagship',type:'gen',x:500,y:40,men:500,ai:A('general')},{name:'Cruiser Volk',type:'ddg',x:420,y:110,men:700,ai:A('advance',2)},{name:'Destroyer Sever',type:'ddg',x:600,y:110,men:600,ai:A('advance',3)},{name:'Destroyer Burya',type:'ddg',x:760,y:130,men:600,ai:A('advance',5)},
    {name:'Submarine Kalina',type:'sub',x:300,y:200,men:260,ai:A('advance',1,{pref:'carrier'})},{name:'Submarine Lada',type:'sub',x:700,y:210,men:260,ai:A('advance',2,{pref:'carrier'})},
    {name:'Missile boats I',type:'fac',x:150,y:150,men:150,ai:A('advance',0)},{name:'Missile boats II',type:'fac',x:850,y:160,men:150,ai:A('advance',0)},{name:'Naval strike jets',type:'jet',x:500,y:20,men:500,ai:A('advance',4,{pref:'carrier'})}],
  events:[{t:2,msg:'Sonar contact lost. Submarines are somewhere in the strait.'},{t:30,msg:'Enemy strike aircraft inbound.'}],
  history:'Strait of Kestrel is a fictional battle. Modern sea combat is about detection: whoever is found first is usually sunk first. Submarines hide below the surface, carriers strike from beyond the horizon, and destroyers carry missiles against both ships and aircraft. Islands break up radar and sonar and give cover to small, fast missile boats.'});

/* ---- 73 Easting 1991 ---- */
const EAST={theatre:'land',era:'modern',seed:1991,hills:[{cx:500,cy:300,rx:500,ry:40,h:8}],hillNames:['73 Easting ridge'],woods:[],towns:[{x0:780,x1:880,y0:120,y1:180,block:true}],river:null};
addScen('easting',{group:'modern',theme:'modern',eraKey:'desert',foe:'Tawakalna Division',name:'73 Easting',year:'1991',place:'Southern Iraq',you:'Capt. H.R. McMaster',sides:['2nd ACR','Republican Guard'],diff:'Medium',era:'modern',gen:EAST,
  teaser:'A sandstorm hides a dug-in tank division. Your thermal sights see through it; theirs do not.',objective:'Break the Tawakalna Division',deploy:380,leth:.62,pmod:{q:1.5},emod:{q:.8},fog:6,
  brief:['The enemy is dug in behind a low rise you cannot see over. Recon finds them; tanks kill them.','Your tanks and Bradleys fire on the move. Keep moving and keep the line together.','Enemy artillery is still dangerous. Spread out.'],
  player:[{name:'Eagle Troop HQ',type:'gen',x:500,y:610,men:200,armor:'light'},{name:'Eagle tanks',type:'tank',x:400,y:470,men:720},{name:'Ghost tanks',type:'tank',x:600,y:470,men:720},
    {name:'Bradleys I',type:'ifv',x:280,y:500,men:800},{name:'Bradleys II',type:'ifv',x:720,y:500,men:800},{name:'Scout platoon',type:'recon',x:500,y:430,men:500},{name:'Mortar section',type:'mortar',x:500,y:560,men:300},{name:'Howitzer battery',type:'howz',x:500,y:620,men:800}],
  enemy:[{name:'Tawakalna command',type:'gen',x:500,y:40,men:300,armor:'light',ai:A('general')},
    {name:'Dug-in T-72s I',type:'tank',x:300,y:240,men:1000,ai:A('advance',8)},{name:'Dug-in T-72s II',type:'tank',x:500,y:250,men:1000,ai:A('advance',8)},{name:'Dug-in T-72s III',type:'tank',x:700,y:240,men:1000,ai:A('advance',10)},
    {name:'BMP company',type:'ifv',x:400,y:170,men:900,ai:A('advance',4)},{name:'BMP company II',type:'ifv',x:620,y:170,men:900,ai:A('advance',5)},{name:'Infantry battalion',type:'minf',x:500,y:130,men:1200,ai:A('advance',12)},
    {name:'Anti-tank company',type:'atgm',x:830,y:200,men:500,ai:A('skirmish',2)},{name:'Artillery group',type:'howz',x:500,y:60,men:900,ai:A('skirmish',3)},{name:'Reserve tanks',type:'tank',x:200,y:80,men:900,ai:A('advance',18)}],
  events:[{t:1,msg:'Sandstorm. Visibility is close to zero.'},{t:50,msg:'The storm is lifting.'}],
  history:'On 26 February 1991, in a sandstorm, a cavalry troop of nine M1 tanks and twelve Bradleys crested a rise and found an entire Iraqi Republican Guard brigade dug in on the other side. Thermal sights let them fire through the storm; within minutes dozens of Iraqi tanks were burning. It became the textbook example of how training, sensors and initiative can beat numbers.'});

/* ---- Grey Blocks: hold a city ---- */
const GREY=cityMap(4401,{river:{y0:300,A:6,f:80,ph:.5,cross:[{x0:260,x1:300,kind:'bridge'},{x0:690,x1:730,kind:'bridge'}]}});
addScen('greyblocks',{group:'modern',theme:'modern',eraKey:'city',foe:'The 3rd Guards Brigade',name:'Grey Blocks',year:'21st c.',place:'Fictional scenario',you:'Lt. Col. Mara Ivo',sides:['City garrison','3rd Guards'],diff:'Hard',era:'modern',gen:GREY,city:true,
  teaser:'Urban defence. Vehicles are stuck to the streets; your infantry owns the buildings.',objective:'Hold the city until relief arrives',deploy:330,leth:.62,pmod:{q:1.25},timer:{t:150,label:'Relief',win:'The relief column reaches the city. The assault has failed.'},
  brief:['Buildings protect infantry and hide it until the enemy is close. Tanks and IFVs cannot enter them and must use the streets.','Put anti-tank teams where streets meet: armour that turns a corner into them dies.','Snipers and mortars wear down infantry that crosses open ground. MANPADS keep the gunships off you.'],
  player:[{name:'Garrison HQ',type:'gen',x:500,y:600,men:200,armor:'light'},{name:'Rifle company A',type:'minf',x:300,y:420,men:1100},{name:'Rifle company B',type:'minf',x:520,y:430,men:1100},{name:'Rifle company C',type:'minf',x:720,y:420,men:1100},
    {name:'AT platoon North',type:'atgm',x:420,y:380,men:500},{name:'AT platoon East',type:'atgm',x:640,y:380,men:500},{name:'Sniper team',type:'sniper',x:250,y:360,men:60},{name:'Sniper team II',type:'sniper',x:800,y:370,men:60},
    {name:'Mortar section',type:'mortar',x:500,y:560,men:300},{name:'MANPADS team',type:'manpads',x:600,y:520,men:200},{name:'Tank platoon',type:'tank',x:400,y:520,men:400}],
  enemy:[{name:'Brigade HQ',type:'gen',x:500,y:30,men:300,armor:'light',ai:A('general')},{name:'Tank battalion',type:'tank',x:300,y:120,men:1400,ai:A('advance',4)},{name:'Tank battalion II',type:'tank',x:700,y:120,men:1300,ai:A('advance',8)},
    {name:'Motor rifles I',type:'ifv',x:400,y:160,men:1100,ai:A('advance',2)},{name:'Motor rifles II',type:'ifv',x:600,y:160,men:1100,ai:A('advance',3)},{name:'Assault infantry',type:'minf',x:500,y:200,men:1400,ai:A('advance',0)},
    {name:'Assault infantry II',type:'minf',x:250,y:200,men:1300,ai:A('advance',5)},{name:'Recon drones',type:'drone',x:500,y:80,men:400,ai:A('advance',2)},{name:'Rocket battery',type:'mlrs',x:500,y:40,men:700,ai:A('skirmish',4)},{name:'Gunships',type:'heli',x:800,y:50,men:500,ai:A('advance',20)}],
  events:[{t:2,msg:'Enemy armour is rolling toward the bridges.'},{t:40,msg:'Gunships spotted.'},{t:130,msg:'The relief column is close. Hold!'}],
  history:'Grey Blocks is a fictional battle. Cities swallow armies: buildings hide and protect infantry, streets turn vehicles into targets, and every corner is a possible ambush. Attackers usually need far more troops than defenders, and the fighting moves block by block.'});

/* ---- Harbor Road: take a city ---- */
const HARB=cityMap(8812,{});
addScen('harbor',{group:'modern',theme:'modern',eraKey:'city',foe:'The harbour garrison',name:'Harbor Road',year:'21st c.',place:'Fictional scenario',you:'Maj. Ben Arlo',sides:['Assault group','Garrison'],diff:'Hard',era:'modern',gen:HARB,city:true,
  teaser:'Urban attack. Clear dug-in infantry from the buildings without losing your armour in the streets.',objective:'Break the garrison',deploy:420,leth:.62,pmod:{q:1.3},
  brief:['The garrison sits hidden in buildings. Recon and drones reveal them; then tanks and mortars can hit them properly.','Do not drive tanks blind down a street. Lead with infantry and recon.','The strike pair can flatten any block once, from anywhere.'],
  player:[{name:'Assault HQ',type:'gen',x:500,y:610,men:200,armor:'light'},{name:'Tank company',type:'tank',x:380,y:560,men:720},{name:'Mech company',type:'ifv',x:620,y:560,men:900},{name:'Assault infantry A',type:'minf',x:300,y:500,men:1200},
    {name:'Assault infantry B',type:'minf',x:500,y:500,men:1200},{name:'Assault infantry C',type:'minf',x:700,y:500,men:1200},{name:'Recon troop',type:'recon',x:500,y:580,men:500},{name:'Recon drones',type:'drone',x:450,y:600,men:400},{name:'Mortar section',type:'mortar',x:560,y:610,men:300},{name:'Strike pair',type:'jet',x:500,y:630,men:500}],
  enemy:[{name:'Garrison command',type:'gen',x:500,y:60,men:300,armor:'light',ai:A('general',999)},{name:'Defenders A',type:'minf',x:250,y:230,men:1200,ai:A('advance',40)},{name:'Defenders B',type:'minf',x:500,y:240,men:1200,ai:A('advance',60)},
    {name:'Defenders C',type:'minf',x:750,y:230,men:1200,ai:A('advance',50)},{name:'AT nest',type:'atgm',x:400,y:300,men:500,ai:A('skirmish',999)},{name:'AT nest II',type:'atgm',x:640,y:300,men:500,ai:A('skirmish',999)},
    {name:'Sniper team',type:'sniper',x:300,y:320,men:60,ai:A('skirmish',999)},{name:'Sniper team II',type:'sniper',x:700,y:320,men:60,ai:A('skirmish',999)},{name:'MANPADS team',type:'manpads',x:520,y:160,men:200,ai:A('skirmish',999)},{name:'Mortar pit',type:'mortar',x:500,y:120,men:300,ai:A('skirmish',999)},{name:'Tank reserve',type:'tank',x:500,y:80,men:500,ai:A('advance',30)}],
  events:[{t:1,msg:'The garrison is somewhere in those buildings.'}],
  history:'Harbor Road is a fictional battle. Attacking a defended city is one of the hardest jobs in war: the defender sees you coming and you cannot see him. Modern assaults lead with reconnaissance and drones, suppress with mortars and artillery, and use tanks as close support for infantry instead of sending them alone.'});

/* ---- Steel Corridor: open combined arms ---- */
const STEEL={theatre:'land',era:'modern',seed:3317,hills:[{cx:260,cy:300,rx:150,ry:70,h:26},{cx:780,cy:330,rx:150,ry:70,h:26}],hillNames:['Hill 220','Hill 241'],woods:[{cx:500,cy:330,rx:80,ry:50},{cx:120,cy:520,rx:90,ry:60},{cx:880,cy:140,rx:90,ry:60}],towns:[{x0:440,x1:560,y0:140,y1:200,block:true}],river:null};
addScen('steel',{group:'modern',theme:'modern',eraKey:'modern',foe:'The Red Corps',name:'Steel Corridor',year:'21st c.',place:'Fictional scenario',you:'Col. Anya Kohl',sides:['Westmark','Red Corps'],diff:'Medium',era:'modern',gen:STEEL,
  teaser:'A full combined-arms clash: recon, rocket artillery, jets, drones and armour on open ground.',objective:'Break the Red Corps',deploy:390,leth:.62,pmod:{q:1.25},
  brief:['Recon sees into woods and towns from far away. Without it, your guns shoot blind at hidden units.','Rocket artillery covers the whole map but is fragile. Keep it back, keep MANPADS near it.','Jets reach anything in one turn, but enemy air defence kills them fast. Kill the air defence first.'],
  player:[{name:'Corps HQ',type:'gen',x:500,y:610,men:200,armor:'light'},{name:'Tank battalion',type:'tank',x:380,y:470,men:900},{name:'Tank battalion II',type:'tank',x:620,y:470,men:900},{name:'Mech infantry',type:'ifv',x:260,y:500,men:900},
    {name:'Mech infantry II',type:'ifv',x:740,y:500,men:900},{name:'Recon squadron',type:'recon',x:500,y:430,men:500},{name:'Rocket battery',type:'mlrs',x:500,y:620,men:600},{name:'Air defence',type:'sam',x:600,y:590,men:500},{name:'MANPADS',type:'manpads',x:420,y:570,men:200},{name:'Strike pair',type:'jet',x:500,y:630,men:500},{name:'Attack drones',type:'drone',x:380,y:600,men:400}],
  enemy:[{name:'Corps HQ',type:'gen',x:500,y:30,men:300,armor:'light',ai:A('general')},{name:'Tank brigade',type:'tank',x:350,y:150,men:1300,ai:A('advance',2)},{name:'Tank brigade II',type:'tank',x:650,y:150,men:1300,ai:A('advance',4)},
    {name:'Motor rifles',type:'ifv',x:200,y:180,men:1000,ai:A('advance',1)},{name:'Motor rifles II',type:'ifv',x:800,y:180,men:1000,ai:A('advance',3)},{name:'Rifle battalion',type:'minf',x:500,y:170,men:1200,ai:A('advance',6)},{name:'Anti-tank group',type:'atgm',x:500,y:230,men:500,ai:A('skirmish',2)},
    {name:'Rocket artillery',type:'mlrs',x:500,y:40,men:700,ai:A('skirmish',2)},{name:'Air defence',type:'sam',x:420,y:60,men:500,ai:A('escort',4)},{name:'Gunships',type:'heli',x:150,y:40,men:500,ai:A('advance',14,{pref:'tank'})},{name:'Kamikaze drones',type:'lm',x:850,y:50,men:400,ai:A('advance',8,{pref:'mlrs'})}],
  events:[{t:2,msg:'Enemy rocket artillery is ranging the field.'},{t:30,msg:'Enemy gunships are moving in.'}],
  history:'Steel Corridor is a fictional battle. Modern combined arms means no weapon works alone: reconnaissance finds the enemy, artillery and rockets strike it from far away, armour and infantry take the ground, and air defence keeps the sky clear for your own drones and jets while denying it to the enemy.'});

/* ---- Space: Kepler Gate ---- */
const KEP=spaceMap(1601,{});
addScen('kepler',{group:'scifi',theme:'space',eraKey:'space',foe:'The Ashen Armada',name:'Kepler Gate',year:'2471',place:'Kepler-62 jump gate',you:'Fleet Adm. Iona Vance',sides:['Concord Fleet','Ashen Armada'],diff:'Medium',era:'space',gen:KEP,
  teaser:'Capital ships trade beams across the void while bombers and fighters fight for the space between.',objective:'Break the Ashen Armada',deploy:390,leth:.75,pmod:{q:1.15},
  brief:['Bombers kill capital ships. Fighters kill bombers. Flak corvettes kill both. Keep your screen in front.','Battleships have the longest guns but turn slowly. Do not let enemy bombers reach them unescorted.','Asteroid fields give cover. Nebulas hide whatever is inside them.'],
  player:[{name:'Flagship Resolute',type:'gen',x:500,y:600,men:1200},{name:'Battleship Aurora',type:'bship',x:420,y:560,men:3000},{name:'Carrier Halcyon',type:'scarrier',x:600,y:570,men:2500},
    {name:'Destroyer Lance',type:'sdd',x:320,y:500,men:1200},{name:'Destroyer Pike',type:'sdd',x:680,y:500,men:1200},{name:'Corvette screen',type:'corvette',x:500,y:470,men:360},
    {name:'Fighter wing Blue',type:'fighter',x:380,y:440,men:240},{name:'Fighter wing Gold',type:'fighter',x:620,y:440,men:240},{name:'Bomber wing',type:'bomber',x:500,y:420,men:240}],
  enemy:[{name:'Ashen flagship',type:'gen',x:500,y:40,men:1200,ai:A('general')},{name:'Dreadnought Pyre',type:'bship',x:380,y:90,men:3200,ai:A('advance',3)},{name:'Dreadnought Cinder',type:'bship',x:620,y:90,men:3200,ai:A('advance',4)},
    {name:'Destroyer squadron I',type:'sdd',x:250,y:150,men:1200,ai:A('advance',1)},{name:'Destroyer squadron II',type:'sdd',x:750,y:150,men:1200,ai:A('advance',1)},{name:'Destroyer squadron III',type:'sdd',x:500,y:140,men:1200,ai:A('advance',2)},
    {name:'Flak picket',type:'corvette',x:500,y:200,men:360,ai:A('advance',0)},{name:'Interceptors I',type:'fighter',x:350,y:220,men:240,ai:A('advance',0)},{name:'Interceptors II',type:'fighter',x:650,y:220,men:240,ai:A('advance',0)},{name:'Interceptors III',type:'fighter',x:500,y:240,men:240,ai:A('advance',0)},
    {name:'Bomber strike',type:'bomber',x:200,y:230,men:240,ai:A('advance',2,{pref:'bship'})},{name:'Bomber strike II',type:'bomber',x:800,y:230,men:240,ai:A('advance',3,{pref:'scarrier'})}],
  events:[{t:1,msg:'The Armada drops out of the gate. All batteries, open fire.'}],
  history:'Kepler Gate is a fictional battle. Its logic borrows from carrier warfare at sea: the biggest guns matter less than who controls the space between the fleets. Small craft kill capital ships, screens kill small craft, and a fleet that loses its escort loses its battleships next.'});

/* ---- Space: Titan Ring ---- */
const TITAN=spaceMap(9920,{});TITAN.fields=[{cx:200,cy:330,rx:160,ry:60},{cx:520,cy:300,rx:150,ry:55},{cx:840,cy:340,rx:150,ry:60},{cx:360,cy:430,rx:90,ry:35}];
addScen('titan',{group:'scifi',theme:'space',eraKey:'space',foe:'The Ashen raiders',name:'Titan Ring',year:'2471',place:'Saturn, the outer ring',you:'Cmdr. Tomas Rhee',sides:['Ring Patrol','Raiders'],diff:'Hard',era:'space',gen:TITAN,
  teaser:'A small patrol hides in the ring against a raider fleet. Hold until the home fleet arrives.',objective:'Hold until the home fleet arrives',deploy:380,leth:.75,pmod:{q:1.3},timer:{t:140,label:'Home fleet',win:'The home fleet jumps in. The raiders scatter.'},
  brief:['Ships inside the asteroid ring take far less fire. Fight from the rocks.','Your bombers are your only way to hurt their capital ships. Escort them.','You do not have to win. You have to still be here when the home fleet arrives.'],
  player:[{name:'Patrol command',type:'gen',x:500,y:560,men:1000},{name:'Destroyer Vigil',type:'sdd',x:360,y:440,men:1200},{name:'Destroyer Warden',type:'sdd',x:640,y:440,men:1200},{name:'Corvettes',type:'corvette',x:500,y:420,men:360},
    {name:'Fighter wing',type:'fighter',x:420,y:480,men:240},{name:'Bomber wing',type:'bomber',x:580,y:480,men:240}],
  enemy:[{name:'Raider flagship',type:'gen',x:500,y:40,men:1200,ai:A('general')},{name:'Raider battleship',type:'bship',x:500,y:90,men:3000,ai:A('advance',2)},{name:'Raider carrier',type:'scarrier',x:300,y:80,men:2500,ai:A('advance',3)},
    {name:'Raider destroyers',type:'sdd',x:700,y:130,men:1200,ai:A('advance',1)},{name:'Raider destroyers II',type:'sdd',x:250,y:140,men:1200,ai:A('advance',2)},{name:'Raider fighters',type:'fighter',x:500,y:180,men:240,ai:A('advance',0)},{name:'Raider bombers',type:'bomber',x:650,y:190,men:240,ai:A('advance',1)}],
  events:[{t:1,msg:'Raiders inbound. The home fleet is 140 seconds out.'},{t:120,msg:'Gate signature detected. Hold on!'}],
  history:'Titan Ring is a fictional battle. A weaker force with good cover and a clear goal can hold against a much stronger one: the defenders only need to survive, the attackers need to win.'});

/* ---- Steampunk: Ironhaven Streets ---- */
const IRON=cityMap(1888,{steam:true});
addScen('ironhaven',{group:'steam',theme:'steam',eraKey:'steam',foe:'The Iron Syndicate',name:'Ironhaven Streets',year:'1888',place:'Ironhaven, the brass quarter',you:'Captain Ada Whitlock',sides:['Brass Crown','Iron Syndicate'],diff:'Medium',era:'steam',gen:IRON,city:true,
  teaser:'Syndicate walkers and an ironclad push into the brick streets. Hold the quarter with rifles, arcs and fists.',objective:'Break the Syndicate assault',deploy:380,leth:.95,
  brief:['Walkers and ironclads cannot enter buildings. Put your fusiliers inside the blocks: they get cover and stay hidden until they fire.','Tesla engineers are the only thing that stops a walker or an automaton cold. Keep them close behind the line.','Brawlers smash fusilier lines in the street. Strike from an alley when the enemy is busy.'],
  player:[{name:'Captain Whitlock',type:'gen',x:500,y:600,men:30},{name:'1st Fusiliers',type:'fusil',x:320,y:470,men:120},{name:'2nd Fusiliers',type:'fusil',x:500,y:470,men:120},{name:'3rd Fusiliers',type:'fusil',x:680,y:470,men:120},
    {name:'Dockside brawlers',type:'brawler',x:400,y:520,men:80},{name:'Arc section Volta',type:'tesla',x:450,y:560,men:40},{name:'Arc section Faraday',type:'tesla',x:580,y:560,men:40},{name:'Walker Bulwark',type:'walker',x:820,y:560,men:24},{name:'Ornithopter flight',type:'orni',x:200,y:590,men:16}],
  enemy:[{name:'Overseer Kragg',type:'gen',x:500,y:40,men:40,ai:A('general')},{name:'Syndicate walkers',type:'walker',x:330,y:120,men:24,ai:A('advance',1)},{name:'Syndicate walkers II',type:'walker',x:670,y:120,men:24,ai:A('advance',2)},{name:'Ironclad Leviathan',type:'iclad',x:500,y:70,men:60,ai:A('skirmish',2)},
    {name:'Automaton squad',type:'clock',x:420,y:180,men:40,ai:A('advance',0)},{name:'Automaton squad II',type:'clock',x:580,y:180,men:40,ai:A('advance',1)},{name:'Syndicate rifles',type:'fusil',x:250,y:200,men:120,ai:A('advance',3)},{name:'Syndicate rifles II',type:'fusil',x:750,y:200,men:120,ai:A('advance',3)},
    {name:'Furnace brawlers',type:'brawler',x:500,y:220,men:80,ai:A('advance',4)},{name:'Dirigible Black Gull',type:'zep',x:800,y:50,men:80,ai:A('advance',5)}],
  events:[{t:1,msg:'Boots and pistons on the cobbles. The Syndicate is coming.'},{t:40,msg:'A dirigible is over the rooftops!'}],
  history:'Ironhaven Streets is a fictional battle in a steam-powered 1888 that never happened. The tactics are real: in a city, vehicles are tied to the streets, infantry inside buildings is hard to find and hard to hurt, and the defender who knows the blocks can fight far above its numbers.'});

/* ---- Steampunk: Blackmoor ---- */
const BLKM={theatre:'land',era:'steam',seed:1889,hills:[{cx:300,cy:520,rx:220,ry:90,h:30},{cx:760,cy:150,rx:200,ry:80,h:26}],hillNames:['Brassridge','Cinder Tor'],woods:[{cx:880,cy:470,rx:110,ry:80},{cx:120,cy:230,rx:100,ry:90}],towns:[],river:{y0:330,A:14,f:90,ph:.6,cross:[{x0:200,x1:260,kind:'ford'},{x0:480,x1:540,kind:'bridge'},{x0:780,x1:840,kind:'ford'}]},marsh:[{cx:560,cy:250,rx:110,ry:40}]};
addScen('blackmoor',{group:'steam',theme:'steam',eraKey:'steam',foe:'Baron Vexmoor',name:'Battle of Blackmoor',year:'1889',place:'Blackmoor, the northern fens',you:'Lord Marshal Ashcombe',sides:['Brass Crown','Iron Syndicate'],diff:'Hard',era:'steam',gen:BLKM,
  teaser:'Open moor, a river and two dirigibles. The Syndicate brings three ironclads; you bring walkers and nerve.',objective:'Break the Syndicate army',deploy:360,leth:.95,
  brief:['Ironclads outgun everything you have at range. Close fast or hit them with Tesla arcs; their guns cannot fire point-blank.','Two dirigibles will bomb your lines. Your ornithopters are the answer: send them early.','The river can only be crossed at the fords and the bridge. Hold Brassridge and make them come to you.'],
  player:[{name:'Lord Marshal Ashcombe',type:'gen',x:500,y:600,men:40},{name:'Grenadier Fusiliers',type:'fusil',x:330,y:450,men:120},{name:'Highland Fusiliers',type:'fusil',x:500,y:460,men:120},{name:'Rifle Brigade',type:'fusil',x:670,y:450,men:120},
    {name:'Walker troop Anvil',type:'walker',x:260,y:520,men:24},{name:'Walker troop Hammer',type:'walker',x:740,y:520,men:24},{name:'Arc section',type:'tesla',x:420,y:520,men:40},{name:'Arc section II',type:'tesla',x:580,y:520,men:40},
    {name:'Royal Ornithopter Corps',type:'orni',x:150,y:580,men:16},{name:'Ornithopter flight II',type:'orni',x:850,y:580,men:16}],
  enemy:[{name:'Baron Vexmoor',type:'gen',x:500,y:40,men:40,ai:A('general')},{name:'Ironclad Grimward',type:'iclad',x:300,y:60,men:60,ai:A('skirmish',0)},{name:'Ironclad Cinderjaw',type:'iclad',x:500,y:70,men:60,ai:A('skirmish',1)},{name:'Ironclad Maw',type:'iclad',x:700,y:60,men:60,ai:A('skirmish',2)},
    {name:'Automaton column',type:'clock',x:400,y:160,men:40,ai:A('advance',0)},{name:'Automaton column II',type:'clock',x:600,y:160,men:40,ai:A('advance',1)},{name:'Syndicate walkers',type:'walker',x:220,y:150,men:24,ai:A('advance',2)},{name:'Syndicate walkers II',type:'walker',x:780,y:150,men:24,ai:A('advance',3)},
    {name:'Coal-pit brawlers',type:'brawler',x:500,y:200,men:80,ai:A('advance',4)},{name:'Dirigible Smog Queen',type:'zep',x:250,y:30,men:80,ai:A('advance',3)},{name:'Dirigible Ashfall',type:'zep',x:750,y:30,men:80,ai:A('advance',6)}],
  events:[{t:1,msg:'Smoke on the horizon: three ironclads.'},{t:24,msg:'Dirigibles sighted over Cinder Tor!'}],
  history:'Blackmoor is a fictional battle. Like the real wars of the 1880s it turns on firepower against mobility: the side with the heavy guns wants distance, the side without wants to close, and air power changes who gets to choose.'});

/* ---- Dreadnoughts: Jutland 1916 ---- */
const JUTL={theatre:'sea',era:'dread',seed:1916,islands:[],hills:[],woods:[],towns:[],river:null,hillNames:[]};
addScen('jutland',{group:'naval',theme:'dread',eraKey:'dread',foe:'Reinhard Scheer',name:'Jutland',year:'1916',place:'North Sea, off Denmark',you:'John Jellicoe',sides:['Grand Fleet','High Seas Fleet'],diff:'Moderate',era:'dread',gen:JUTL,
  teaser:'The largest clash of battleships in history. Cross the German T, keep your battlecruisers alive and watch for torpedoes.',objective:'Break the High Seas Fleet',deploy:380,leth:.55,
  brief:['Your battle squadrons outgun Scheer’s. Keep them in a line and let the big guns work at long range.','Battlecruisers are fast but thinly armoured. Use them to scout and chase, not to slug it out with dreadnoughts.','German torpedo boats will rush your line. Light cruisers and your own destroyers break them up. Watch for U-boats.'],
  player:[{name:'HMS Iron Duke (Jellicoe)',type:'gen',x:500,y:590,men:1100},{name:'2nd Battle Squadron',type:'dread',x:300,y:500,men:4400},{name:'4th Battle Squadron',type:'dread',x:500,y:510,men:4400},{name:'1st Battle Squadron',type:'dread',x:700,y:500,men:4400},{name:'5th Battle Squadron',type:'dread',x:860,y:440,men:4000},
    {name:'Beatty’s battlecruisers',type:'bcr',x:760,y:380,men:4400},{name:'3rd Battlecruiser Squadron',type:'bcr',x:180,y:400,men:3300},{name:'2nd Light Cruiser Squadron',type:'lcr',x:620,y:420,men:1800},{name:'4th Light Cruiser Squadron',type:'lcr',x:380,y:420,men:1800},
    {name:'4th Destroyer Flotilla',type:'tbd',x:250,y:560,men:900},{name:'12th Destroyer Flotilla',type:'tbd',x:750,y:560,men:900}],
  enemy:[{name:'SMS Friedrich der Grosse (Scheer)',type:'gen',x:500,y:40,men:1100,ai:A('general')},{name:'III Battle Squadron',type:'dread',x:400,y:100,men:7000,ai:A('advance',0)},{name:'I Battle Squadron',type:'dread',x:600,y:90,men:7000,ai:A('advance',1)},{name:'II Squadron (pre-dreadnoughts)',type:'dread',x:500,y:50,men:4500,def:1.6,ai:A('advance',3)},
    {name:'Hipper’s battlecruisers',type:'bcr',x:700,y:180,men:5500,ai:A('advance',0)},{name:'II Scouting Group',type:'lcr',x:300,y:180,men:1800,ai:A('advance',0)},{name:'Torpedo boat flotillas',type:'tbd',x:420,y:200,men:1400,ai:A('advance',2)},{name:'Torpedo boat flotillas II',type:'tbd',x:600,y:210,men:1400,ai:A('advance',4)},
    {name:'U-boat screen',type:'uboat',x:520,y:300,men:140,ai:A('skirmish',0)}],
  events:[{t:1,msg:'Beatty’s battlecruisers have found Hipper. The whole High Seas Fleet is behind him.'},{t:48,msg:'Scheer orders a turn away under a torpedo attack!'}],
  history:'On 31 May and 1 June 1916 the British Grand Fleet under John Jellicoe met the German High Seas Fleet under Reinhard Scheer off Jutland: about 250 ships, the largest battleship action ever fought. Beatty’s battlecruisers lost three of their number to magazine explosions; twice Jellicoe crossed the German T and twice Scheer escaped by turning away under torpedo attacks and smoke. Britain lost more ships and men, about 6,000 against 2,500, but the High Seas Fleet never again seriously challenged British control of the North Sea.'});

/* ---- Dreadnoughts: Dogger Bank 1915 ---- */
const DOGG={theatre:'sea',era:'dread',seed:1915,islands:[],hills:[],woods:[],towns:[],river:null,hillNames:[]};
addScen('doggerbank',{group:'naval',theme:'dread',eraKey:'dread',foe:'David Beatty',name:'Dogger Bank',year:'1915',place:'Dogger Bank, North Sea',you:'Franz von Hipper',sides:['I Scouting Group','Battlecruiser Fleet'],diff:'Hard',era:'dread',gen:DOGG,
  teaser:'Five British battlecruisers run you down. Get your squadron home before the faster ships catch you.',objective:'Survive until you reach the German minefields',deploy:340,leth:.55,timer:{t:120,label:'The minefields',win:'Your squadron reaches the minefields off Heligoland. Beatty has to turn back.'},
  brief:['You are outgunned and slower. You do not have to win: keep your ships afloat until the timer runs out.','Blücher is the slowest and weakest ship. Protecting her costs time; losing her costs less than losing a battlecruiser.','Your torpedo boats can force the British to turn away. Use them when they close in.'],
  player:[{name:'SMS Seydlitz (Hipper)',type:'gen',x:500,y:560,men:1100},{name:'SMS Derfflinger',type:'bcr',x:380,y:500,men:1100},{name:'SMS Moltke',type:'bcr',x:620,y:500,men:1100},{name:'SMS Blücher',type:'bcr',x:500,y:430,men:1000,def:1.2},
    {name:'II Scouting Group',type:'lcr',x:260,y:560,men:1300},{name:'Torpedo boats',type:'tbd',x:740,y:560,men:900}],
  enemy:[{name:'HMS Lion (Beatty)',type:'gen',x:500,y:40,men:1100,ai:A('general')},{name:'Lion and Tiger',type:'bcr',x:400,y:80,men:2200,ai:A('advance',0)},{name:'Princess Royal',type:'bcr',x:600,y:80,men:1100,ai:A('advance',0)},{name:'New Zealand and Indomitable',type:'bcr',x:500,y:130,men:1600,ai:A('advance',1)},
    {name:'1st Light Cruiser Squadron',type:'lcr',x:250,y:150,men:1600,ai:A('advance',0)},{name:'Harwich Force destroyers',type:'tbd',x:750,y:160,men:1200,ai:A('advance',1)}],
  events:[{t:1,msg:'Smoke astern: Beatty’s battlecruisers are closing at 28 knots.'},{t:96,msg:'The minefields are close. Hold on!'}],
  history:'On 24 January 1915 Franz von Hipper’s battlecruisers were caught by David Beatty’s faster squadron off the Dogger Bank. The old armoured cruiser Blücher fell behind and was sunk; Seydlitz survived only because her crew flooded the magazines after a turret fire, a lesson the Germans learned and the British did not. A signalling mix-up let the rest of Hipper’s force escape home.'});

/* ---- Magic: Dragonfall Pass ---- */
const DRAG=magicMap(666,{});DRAG.hills=[{cx:120,cy:320,rx:160,ry:160,h:60},{cx:880,cy:320,rx:160,ry:160,h:60}];DRAG.hillNames=['Ashpeak','Frostspire'];DRAG.woods=[{cx:500,cy:560,rx:120,ry:50}];DRAG.towns=[{x0:460,x1:540,y0:590,y1:630}];DRAG.river=null;
addScen('dragonfall',{group:'fantasy',theme:'magic',eraKey:'magic',foe:'The Ashen King',name:'Dragonfall Pass',year:'Age of Embers',place:'The pass below Ashpeak',you:'Queen Aelis',sides:['The Free Realms','The Ashen Host'],diff:'Medium',era:'magic',gen:DRAG,
  teaser:'Hold the mountain pass against an undead horde, golems and a dragon.',objective:'Break the Ashen Host',deploy:380,leth:1,pmod:{q:1.15},
  brief:['Mages burn the undead faster than anything else. Keep them behind your swordsmen.','Elven archers are your answer to the dragon. Nothing else reaches it.','Golems are almost unbreakable in melee. Do not trade blows with them: burn them or go around.'],
  player:[{name:'Queen Aelis',type:'gen',x:500,y:600,men:400},{name:'Royal swordsmen',type:'inf',x:400,y:450,men:2500},{name:'Royal swordsmen II',type:'inf',x:600,y:450,men:2500},{name:'Shield guard',type:'heavy',x:500,y:470,men:2000},
    {name:'Silverleaf archers',type:'elf',x:350,y:520,men:1500},{name:'Silverleaf archers II',type:'elf',x:650,y:520,men:1500},{name:'Circle of Embers',type:'mage',x:450,y:550,men:120},{name:'Circle of Frost',type:'mage',x:550,y:550,men:120},
    {name:'Knights of the Dawn',type:'cav',x:250,y:480,men:1000,melee:1.35},{name:'Griffin riders',type:'griffin',x:780,y:480,men:300}],
  enemy:[{name:'The Ashen King',type:'gen',x:500,y:40,men:400,ai:A('general')},{name:'Bone legion I',type:'undead',x:350,y:170,men:4000,resolve:.35,ai:A('advance',0)},{name:'Bone legion II',type:'undead',x:500,y:180,men:4000,resolve:.35,ai:A('advance',0)},{name:'Bone legion III',type:'undead',x:650,y:170,men:4000,resolve:.35,ai:A('advance',1)},
    {name:'Bone legion IV',type:'undead',x:500,y:110,men:4000,resolve:.35,ai:A('advance',5)},{name:'Ironroot golems',type:'golem',x:400,y:230,men:750,ai:A('advance',2)},{name:'Ironroot golems II',type:'golem',x:600,y:230,men:750,ai:A('advance',3)},
    {name:'Ashwing the dragon',type:'dragon',x:500,y:60,men:800,ai:A('advance',4,{pref:'mage'})},{name:'Dark adepts',type:'mage',x:500,y:140,men:150,ai:A('skirmish',2)}],
  events:[{t:1,msg:'The dead march up the pass.'},{t:30,msg:'A shadow over the mountains. The dragon is coming!'}],
  history:'Dragonfall Pass is a fantasy battle. Its rules follow real military logic: a narrow pass cancels numbers, missile troops decide whether an enemy reaches the line at all, and the right counter beats raw strength: fire against the dead, arrows against what flies.'});

/* ---- Magic: Siege of Ember Keep ---- */
const EMB=magicMap(1234,{});EMB.hills=[{cx:500,cy:560,rx:260,ry:110,h:40}];EMB.hillNames=['Ember Keep'];EMB.towns=[{x0:430,x1:570,y0:540,y1:610}];EMB.river={y0:330,A:10,f:70,ph:2,cross:[{x0:220,x1:280,kind:'ford'},{x0:470,x1:530,kind:'bridge'},{x0:720,x1:780,kind:'ford'}]};
addScen('emberkeep',{group:'fantasy',theme:'magic',eraKey:'magic',foe:'Morvath the Undying',name:'Siege of Ember Keep',year:'Age of Embers',place:'Ember Keep',you:'Lord Harren',sides:['Ember Keep','The Undying'],diff:'Hard',era:'magic',gen:EMB,
  teaser:'Two dragons and an endless horde. Hold the river until the elven host arrives.',objective:'Hold the keep until the elves arrive',deploy:360,leth:1,pmod:{q:1.1},timer:{t:160,label:'The elven host',win:'Elven horns on the ridge. The Undying fall back into the dark.'},
  brief:['The river can only be crossed at the fords and the bridge. Hold them.','Two dragons will come for your mages and archers. Keep elves close to whatever you cannot lose.','Your golems can hold a ford alone. Put them where the dead will come thickest.'],
  player:[{name:'Lord Harren',type:'gen',x:500,y:590,men:400},{name:'Keep golems',type:'golem',x:500,y:380,men:750},{name:'Ford guard',type:'heavy',x:250,y:390,men:2000},{name:'Ford guard II',type:'heavy',x:750,y:390,men:2000},
    {name:'Keep archers',type:'elf',x:380,y:460,men:1500},{name:'Keep archers II',type:'elf',x:620,y:460,men:1500},{name:'Tower mages',type:'mage',x:470,y:520,men:120},{name:'Tower mages II',type:'mage',x:530,y:520,men:120},
    {name:'Griffin wing',type:'griffin',x:820,y:520,men:300},{name:'Keep knights',type:'cav',x:180,y:520,men:1000,melee:1.3}],
  enemy:[{name:'Morvath',type:'gen',x:500,y:40,men:400,ai:A('general')},{name:'The drowned host',type:'undead',x:250,y:170,men:4500,resolve:.35,ai:A('advance',0)},{name:'The hollow host',type:'undead',x:500,y:180,men:4500,resolve:.35,ai:A('advance',1)},
    {name:'The ash host',type:'undead',x:750,y:170,men:4500,resolve:.35,ai:A('advance',2)},{name:'Grave knights',type:'cav',x:350,y:110,men:1200,ai:A('advance',6)},{name:'Grave knights II',type:'cav',x:650,y:110,men:1200,ai:A('advance',8)},
    {name:'Dragon Vyrm',type:'dragon',x:300,y:60,men:800,ai:A('advance',4,{pref:'elf'})},{name:'Dragon Sorrow',type:'dragon',x:700,y:60,men:800,ai:A('advance',14,{pref:'mage'})},{name:'Necromancers',type:'mage',x:500,y:110,men:150,ai:A('skirmish',3)}],
  events:[{t:1,msg:'The Undying reach the river.'},{t:140,msg:'Horns in the west! The elves are close.'}],
  history:'Siege of Ember Keep is a fantasy battle. Like most real sieges it is won by time: the defender does not need to win, only to hold the crossings until help arrives.'});

/* smarter targeting for the enemy: prefer what its weapons actually hurt */
const _chooseTarget=chooseTarget;
chooseTarget=function(b,u,foes,pref){if(pref)return _chooseTarget(b,u,foes,pref);
  const R=TYPES[u.type].ranged;let best=null,bs=-1e9;
  for(const f of foes){const eff=R?(WEAP[R.w][f.armor]||0):(f.air?0:1);if(R&&eff<=0)continue;const d=dist(u,f);
    const sc=(MCODES[matchCode(u.type,f.type)].v*70)+(R?eff*90:0)-d*(R&&d<=R.range?.2:1)+(f.morale<40?40:0);if(sc>bs){bs=sc;best=f}}
  return best||_chooseTarget(b,u,foes,pref)};

/* ---------- starships: two factions, six classes, built from primitives with vertex colours ----------
   Concord (player): white ceramic, gold ribs, blue light. Long, calm, cathedral-like.
   Ashen Armada (enemy): black forged iron, rust, ember glow. Asymmetric, spiked, furnace-hearted.
   Forward is -z. Units are metres-ish in map scale. */
const SHIP_COL={
  concord:{hull:'#E8EBEE',panel:'#C3CAD3',gold:'#C9A45C',dark:'#2B3542',glass:'#1D3B6B',glow:'#7FD4FF',glow2:'#C8F0FF'},
  ashen:{hull:'#2A2624',panel:'#3B3431',iron:'#504843',rust:'#6E3A26',dark:'#151211',glow:'#FF6A2A',glow2:'#FFC060'},
};
function SM(x,y,z,rx,ry,rz,sx,sy,sz){return new THREE.Matrix4().compose(new THREE.Vector3(x||0,y||0,z||0),new THREE.Quaternion().setFromEuler(new THREE.Euler(rx||0,ry||0,rz||0)),new THREE.Vector3(sx==null?1:sx,sy==null?1:sy,sz==null?1:sz))}
/* primitive makers, all oriented along z where it matters */
const SHG={
  box:(w,h,d)=>new THREE.BoxGeometry(w,h,d),
  cylZ:(r0,r1,len,seg)=>{const g=new THREE.CylinderGeometry(r0,r1,len,seg||10);g.rotateX(-Math.PI/2);return g}, // r0 at -z (front), r1 at +z
  coneZ:(r,len,seg)=>{const g=new THREE.ConeGeometry(r,len,seg||10);g.rotateX(-Math.PI/2);return g},           // tip toward -z
  sph:(r,ws,hs)=>new THREE.SphereGeometry(r,ws||12,hs||8),
  torZ:(R,r,seg,arc)=>{const g=new THREE.TorusGeometry(R,r,6,seg||28,arc||Math.PI*2);return g},                 // ring in the xy plane: around the z axis
  ico:(r,d)=>new THREE.IcosahedronGeometry(r,d||0),
  dod:(r)=>new THREE.DodecahedronGeometry(r,0),
  oct:(r)=>new THREE.OctahedronGeometry(r,0),
  wedge:(w,h,d,taper)=>{const g=new THREE.BoxGeometry(w,h,d);const p=g.attributes.position;for(let i=0;i<p.count;i++){if(p.getZ(i)<0){p.setX(i,p.getX(i)*(taper==null?.25:taper));p.setY(i,p.getY(i)*(taper==null?.6:Math.max(taper,.4)))}}g.computeVertexNormals();return g},
  blade:(w,h,d)=>{const g=new THREE.BoxGeometry(w,h,d);const p=g.attributes.position;for(let i=0;i<p.count;i++){if(p.getZ(i)<0)p.setY(i,p.getY(i)*.15)}g.computeVertexNormals();return g},
};
function shipDef(fac,kind){
  const C=SHIP_COL[fac],S=[],L=[],add=(g,m,c)=>S.push([g,m,c]),lit=(g,m,c)=>L.push([g,m,c]);
  const R=(n)=>{let s=n*9301+49297;return()=>{s=(s*9301+49297)%233280;return s/233280}};
  if(fac==='concord'){
    if(kind==='fighter'){ // "Kestrel": a needle with forward-swept blades
      add(SHG.cylZ(.32,.42,5.2,10),SM(0,0,.2),C.hull);add(SHG.coneZ(.32,1.8,10),SM(0,0,-3.3),C.hull);
      add(SHG.sph(.42,10,8),SM(0,.26,-1.3,0,0,0,.8,.7,1.9),C.glass);
      for(const s of [-1,1]){add(SHG.blade(2.8,.12,1.3),SM(s*1.5,-.05,.9,0,s*.42,s*-.06),C.hull);add(SHG.box(.12,.14,1.4),SM(s*2.85,-.05,.35,0,s*.42),C.gold);
        add(SHG.blade(.1,1.1,1.2),SM(s*.55,.55,2,s*.35,0,s*-.35),C.panel)}
      add(SHG.cylZ(.42,.5,.6,10),SM(0,0,3),C.dark);lit(SHG.cylZ(.36,.36,.25,10),SM(0,0,3.35),C.glow);
    }
    if(kind==='bomber'){ // "Albatross": a white flying wing carrying one gold torpedo
      add(SHG.wedge(7,.7,4.6,.12),SM(0,0,.4),C.hull);add(SHG.box(7.2,.18,.5),SM(0,-.05,2.6),C.gold);
      add(SHG.sph(.6,10,8),SM(0,.42,-.6,0,0,0,1,.6,1.6),C.glass);
      add(SHG.cylZ(.42,.42,4,12),SM(0,-.75,0),C.gold);add(SHG.coneZ(.42,1.1,12),SM(0,-.75,-2.5),C.gold);
      for(const s of [-1,1]){add(SHG.cylZ(.4,.5,2.4,10),SM(s*3.2,0,1.4),C.panel);lit(SHG.cylZ(.34,.34,.2,10),SM(s*3.2,0,2.7),C.glow);add(SHG.blade(.1,1.2,1.4),SM(s*3.2,.6,1.6),C.hull)}
    }
    if(kind==='corvette'){ // "Lantern": a spine with a halo ring and four flak arms
      add(SHG.cylZ(.7,1,11,10),SM(0,0,0),C.hull);add(SHG.coneZ(.7,2.4,10),SM(0,0,-6.7),C.hull);
      add(SHG.torZ(3.2,.28,40),SM(0,0,-.6),C.gold);add(SHG.torZ(3.2,.14,40),SM(0,0,.2),C.panel);
      for(let k=0;k<4;k++){const a=k*Math.PI/2+Math.PI/4,x=Math.cos(a)*3.2,y=Math.sin(a)*3.2;add(SHG.box(.35,.35,3.2),SM(x*.55,y*.55,-.2,0,0,a),C.panel);add(SHG.sph(.55,8,6),SM(x,y,-.3),C.hull);add(SHG.cylZ(.12,.12,1.6,6),SM(x,y,-1.3),C.dark);lit(SHG.sph(.18,6,4),SM(x,y,-2.1),C.glow)}
      add(SHG.cylZ(.9,1.1,1.2,10),SM(0,0,5.6),C.dark);lit(SHG.cylZ(.8,.8,.2,10),SM(0,0,6.3),C.glow);
    }
    if(kind==='sdd'){ // "Halberd": a spear whose railgun runs past its own prow
      add(SHG.wedge(5.6,3,18,.2),SM(0,0,1),C.hull);add(SHG.box(5.8,.3,12),SM(0,-1.45,3),C.dark);add(SHG.blade(.35,4.2,9),SM(0,3.4,4.4),C.hull);add(SHG.box(.45,.25,8),SM(0,5.4,5),C.gold);
      for(const s of [-1,1]){add(SHG.wedge(1.6,1.6,8,.3),SM(s*3.4,-.4,4),C.panel);for(let k=0;k<5;k++)lit(SHG.box(.08,.2,.7),SM(s*2.55,.3,-2+k*1.6),C.glow)}
      for(const s of [-1,1]){add(SHG.box(.35,.35,16),SM(s*.55,.5,-9),C.dark);add(SHG.box(.5,.6,1.2),SM(s*.55,.5,-1.5),C.gold)}
      lit(SHG.box(.25,.25,13),SM(0,.5,-9.5),C.glow2);
      add(SHG.box(2,1.6,4),SM(0,1.6,5),C.panel);add(SHG.box(1.2,.9,1.6),SM(0,2.7,4.6),C.hull);lit(SHG.box(1.3,.18,.3),SM(0,2.75,3.8),C.glow);
      for(let k=0;k<4;k++)add(SHG.box(4.7,.12,.35),SM(0,.0,-1+k*2.6),C.gold);
      for(const x of [-1.4,0,1.4]){add(SHG.cylZ(.55,.75,1.4,10),SM(x,0,10.6),C.dark);lit(SHG.cylZ(.55,.55,.2,10),SM(x,0,11.4),C.glow)}
    }
    if(kind==='bship'){ // "Cathedral": tiered hull, a spire, twin spinning habitat rings, a beam lens in the prow
      add(SHG.wedge(9,4,26,.35),SM(0,0,0),C.hull);add(SHG.wedge(6.5,2.2,20,.3),SM(0,2.8,1.5),C.panel);add(SHG.wedge(4,1.6,13,.3),SM(0,4.4,3),C.hull);
      add(SHG.box(1.4,6,2.2),SM(0,7.5,5),C.hull);add(SHG.coneZ(.8,3,6),SM(0,10.6,5,Math.PI/2),C.gold);lit(SHG.box(1.5,.25,.4),SM(0,8.8,3.8),C.glow);
      for(let k=0;k<6;k++)add(SHG.box(9.3,.2,.45),SM(0,0,-8+k*3.6),C.gold);
      for(const s of [-1,1]){add(SHG.blade(.4,5,10),SM(s*2.6,5.2,6,0,0,s*.35),C.hull);add(SHG.box(.5,.3,9),SM(s*3.4,7.4,6.6,0,0,s*.35),C.gold);for(let k=0;k<8;k++)lit(SHG.box(.1,.22,.9),SM(s*4.3,.6,-9+k*2.6),C.glow)}
      add(SHG.box(9.4,.6,24),SM(0,-2.3,0),C.dark);
      for(const s of [-1,1]){add(SHG.cylZ(1.4,1.6,14,12),SM(s*7,0,4),C.panel);add(SHG.box(3,.6,1.6),SM(s*5,0,0),C.dark);add(SHG.box(3,.6,1.6),SM(s*5,0,8),C.dark);
        add(SHG.torZ(3,.35,36),SM(s*7,0,1),C.hull);add(SHG.torZ(3,.35,36),SM(s*7,0,6),C.hull);for(let k=0;k<6;k++){const a=k*Math.PI/3;add(SHG.box(.2,.2,2.8),SM(s*7+Math.cos(a)*1.5,Math.sin(a)*1.5,1,0,0,a).multiply(SM(0,0,0,0,Math.PI/2,0)),C.gold)}
        lit(SHG.cylZ(1.3,1.3,.25,12),SM(s*7,0,11.2),C.glow)}
      lit(SHG.cylZ(1.5,1.5,.3,16),SM(0,0,-13.2),C.glow2);add(SHG.torZ(1.9,.3,24),SM(0,0,-13),C.gold);
      for(const [x,y] of [[-2.6,-.6],[0,-.6],[2.6,-.6],[-1.3,1.4],[1.3,1.4]]){add(SHG.cylZ(.9,1.1,1.6,10),SM(x,y,13.5),C.dark);lit(SHG.cylZ(.85,.85,.25,10),SM(x,y,14.4),C.glow)}
    }
    if(kind==='scarrier'){ // "Halcyon": two pontoons held by golden arches over an open, lit flight lane
      for(const s of [-1,1]){add(SHG.wedge(3.6,3,28,.3),SM(s*5,0,0),C.hull);add(SHG.box(3.8,.25,24),SM(s*5,1.6,1),C.panel);
        for(let k=0;k<5;k++)lit(SHG.box(.35,.2,1.2),SM(s*3.15,1.2,-8+k*4.6),C.glow);
        add(SHG.cylZ(.9,1.1,1.4,10),SM(s*5,0,14.4),C.dark);lit(SHG.cylZ(.85,.85,.25,10),SM(s*5,0,15.2),C.glow)}
      for(let k=0;k<4;k++)add(SHG.torZ(5,.4,24,Math.PI),SM(0,1,-9+k*6,0,0,0),C.gold);
      add(SHG.box(6.4,.3,26),SM(0,-1.1,1),C.dark);lit(SHG.box(.25,.1,24),SM(-1.2,-.9,1),C.glow2);lit(SHG.box(.25,.1,24),SM(1.2,-.9,1),C.glow2);
      add(SHG.box(2,4,3.6),SM(5,3.6,6),C.hull);add(SHG.box(2.4,1,4),SM(5,5.8,6),C.panel);lit(SHG.box(2.1,.25,.3),SM(5,4.9,4.1),C.glow);
      add(SHG.box(13.6,1.2,4),SM(0,6.4,-4),C.hull);add(SHG.sph(2,12,8),SM(0,7.2,-4,0,0,0,1.4,.7,1),C.glass);add(SHG.box(13.8,.25,.6),SM(0,7,-6),C.gold);
      for(const s of [-1,1])for(let k=0;k<7;k++)lit(SHG.box(.08,.25,.9),SM(s*6.85,.4,-11+k*3.4),C.glow);
    }
  } else {
    const r=R(kind.length*7);
    if(kind==='fighter'){ // "Wasp": a hammer head on a spine, two raked blades and a sting
      add(SHG.box(2.6,1,1.3),SM(0,0,-2.5),C.iron);add(SHG.box(2.8,.25,1.5),SM(0,.55,-2.5),C.rust);lit(SHG.box(2,.18,.12),SM(0,.05,-3.17),C.glow);
      add(SHG.cylZ(.32,.5,5.4,6),SM(0,0,.6),C.hull);
      for(const s of [-1,1]){add(SHG.blade(3.4,.14,2.2),SM(s*1.7,-.2,1.6,0,s*-.55,s*.25),C.rust);add(SHG.coneZ(.18,1.6,4),SM(s*3.1,-.6,2.6,0,s*-.55,0),C.iron)}
      add(SHG.coneZ(.2,2.4,4),SM(0,.9,2.4,2.5,0,0),C.rust);
      add(SHG.cylZ(.55,.4,.8,6),SM(0,0,3.6),C.dark);lit(SHG.cylZ(.36,.36,.2,6),SM(0,0,4.05),C.glow);
    }
    if(kind==='bomber'){ // "Anvil": a slab of armour pushing a huge torpedo like a ram
      add(SHG.box(3.6,1.8,4.4),SM(0,0,.8),C.hull);for(let k=0;k<4;k++)add(SHG.box(3.9,.25,.4),SM(0,.4-k*.35,.2+k*.9),C.iron);
      add(SHG.cylZ(.7,.7,5.6,8),SM(0,-.3,-3.2),C.rust);add(SHG.coneZ(.7,1.6,8),SM(0,-.3,-6.8),C.iron);lit(SHG.box(.2,.2,4.4),SM(0,.42,-3.2),C.glow);
      for(const s of [-1,1]){add(SHG.box(1,1,2.6),SM(s*2.3,-.2,1.6),C.dark);lit(SHG.box(.7,.7,.2),SM(s*2.3,-.2,2.95),C.glow)}
    }
    if(kind==='corvette'){ // "Thorn": an iron urchin bristling with flak spikes
      add(SHG.ico(2.6,0),SM(0,0,0,.3,.5,0,1,.9,1.3),C.hull);add(SHG.ico(1.8,0),SM(0,.4,-1,.1,.2,0),C.iron);
      const dirs=[[1,0,0],[-1,0,0],[0,1,0],[0,-1,0],[.7,.7,-.3],[-.7,.7,-.3],[.7,-.7,.3],[-.7,-.7,.3],[0,0,-1],[.5,.2,-.85],[-.5,.2,-.85]];
      for(const [x,y,z] of dirs){const v=new THREE.Vector3(x,y,z).normalize(),q=new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0,0,-1),v),len=2.4+r()*1.8;
        const m=new THREE.Matrix4().compose(v.clone().multiplyScalar(2.2+len/2),q,new THREE.Vector3(1,1,1));add(SHG.coneZ(.32,len,5),m,C.rust);
        lit(SHG.sph(.2,6,4),new THREE.Matrix4().makeTranslation(v.x*(2.4+len),v.y*(2.4+len),v.z*(2.4+len)),C.glow)}
      lit(SHG.ico(1.1,0),SM(0,0,2.6),C.glow2);add(SHG.cylZ(1.1,1.4,1.4,6),SM(0,0,3.4),C.dark);
    }
    if(kind==='sdd'){ // "Cleaver": a tall blade of iron with an offset bridge and ember vents
      add(SHG.blade(1.6,7,20),SM(0,0,.5),C.hull);add(SHG.box(1.9,1.2,18),SM(0,-3,1.5),C.iron);add(SHG.coneZ(.9,4,4),SM(0,-3,-9.4),C.rust);
      add(SHG.box(2.6,2.4,4),SM(1.6,3.2,4.6,0,0,.15),C.iron);lit(SHG.box(.15,.4,3),SM(2.95,3.6,4.4),C.glow);
      for(let k=0;k<7;k++)lit(SHG.box(1.7,.16,.5),SM(0,-1.6+((k%3)-1)*.9,-5+k*2.4),C.glow);
      add(SHG.box(2.2,2.2,2.6),SM(0,-1,11.6),C.dark);lit(SHG.box(1.8,1.6,.2),SM(0,-1,13),C.glow);
      add(SHG.coneZ(.35,3,4),SM(0,4.2,-1,1.1,0,0),C.rust);add(SHG.coneZ(.35,2.4,4),SM(0,4,3.2,1.3,0,0),C.rust);
    }
    if(kind==='bship'){ // "Pyre": a hammerhead dreadnought; its ribs open onto a burning core
      add(SHG.box(16,4.6,5),SM(0,0,-13),C.iron);add(SHG.box(16.6,1.4,5.4),SM(0,2.6,-13),C.rust);for(const s of [-1,1])add(SHG.coneZ(1.2,5,4),SM(s*7.6,0,-17),C.rust);
      lit(SHG.box(9,1,.4),SM(0,0,-15.6),C.glow);
      lit(SHG.cylZ(2.6,2.6,22,10),SM(0,0,2),C.glow);
      for(let k=0;k<9;k++){const z=-8+k*2.6;add(SHG.torZ(4.2,.75,6),SM(0,0,z,0,0,k*.35),C.hull);add(SHG.box(1.4,9.2,.9),SM(0,0,z,0,0,k*.35+.4),C.iron)}
      add(SHG.box(3,1.2,24),SM(0,4.6,2),C.hull);for(let k=0;k<6;k++)add(SHG.coneZ(.45,2.6+(k%2)*1.4,4),SM(0,5.6+((k%2)?.6:0),-6+k*3.4,1.35,0,0),C.rust);
      add(SHG.box(7.5,6,4),SM(0,0,14.6),C.hull);for(const [x,y] of [[-2.4,-1.4],[0,-1.4],[2.4,-1.4],[-2.4,1.4],[0,1.4],[2.4,1.4]])lit(SHG.box(1.6,1.6,.25),SM(x,y,16.7),C.glow);
    }
    if(kind==='scarrier'){ // "Hive": a hollowed asteroid strapped with engines; its hangar maws glow
      add(SHG.dod(8),SM(0,0,0,.2,.4,.1,1.1,.75,1.6),C.panel);add(SHG.dod(5),SM(3,2.6,4,.5,.1,.3),C.hull);add(SHG.dod(4),SM(-4,-1.6,6,.1,.6,.2),C.hull);
      for(const s of [-1,1])lit(SHG.box(3.6,1.4,.6),SM(s*3.6,-.5,-11.2,0,s*.25,0),C.glow);lit(SHG.box(4,1.2,.6),SM(0,2.4,-10.4),C.glow2);
      for(let k=0;k<3;k++){add(SHG.box(.8,.8,14),SM(-6+k*6,-4.6,2),C.iron)}
      for(const x of [-4,0,4]){add(SHG.box(2.6,2.6,4),SM(x,-1,13),C.iron);lit(SHG.box(2,2,.2),SM(x,-1,15.1),C.glow)}
      for(const [x,y,z] of [[5,4,-4],[-6,3,-2],[7,-2,3]])add(SHG.coneZ(.5,4,4),SM(x,y,z,-.6,.5,0),C.rust);
    }
  }
  return {S,L};
}
function shipMerge(parts){
  const pos=[],col=[],c=new THREE.Color();
  for(const [g,m,hex] of parts){const n=g.index?g.toNonIndexed():g.clone();n.applyMatrix4(m);const p=n.attributes.position.array;c.set(hex).convertSRGBToLinear();
    for(let i=0;i<p.length;i++)pos.push(p[i]);for(let i=0;i<p.length/3;i++)col.push(c.r,c.g,c.b)}
  const out=new THREE.BufferGeometry();out.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));out.setAttribute('color',new THREE.Float32BufferAttribute(col,3));out.computeVertexNormals();return out;
}
const SHIP_CACHE={};
function shipGeos(fac,kind){const k=fac+'|'+kind;if(SHIP_CACHE[k])return SHIP_CACHE[k];const d=shipDef(fac,kind);return SHIP_CACHE[k]={solid:shipMerge(d.S),glow:d.L.length?shipMerge(d.L):null}}
const SHIP_KINDS=['fighter','bomber','corvette','sdd','bship','scarrier'];

/* ---------- warships through the ages ----------
   era: 'galley' (antiquity), 'sail' (age of sail), 'dread' (1906 to 1918), 'navy' (modern). side colours mark sails, flags and stripes. */
const NAV_SIDE={P:{main:'#2F63C8',hi:'#8CB4FF'},E:{main:'#B8322A',hi:'#FF8A78'}};
function navalDef(era,kind,side){
  const S=[],L=[],add=(g,m,c)=>S.push([g,m,c]),lit=(g,m,c)=>L.push([g,m,c]),SC=NAV_SIDE[side||'P'];
  const wood='#6B4526',dark='#3A2414',bronze='#B08D57',canvas='#EDE3CC',tar='#1C1714',ochre='#C9A04A';
  const sail=(x,y,z,w,h,c,stripe)=>{add(SHG.box(w,h,.25),SM(x,y,z),c||canvas);if(stripe){add(SHG.box(w+.02,h*.18,.27),SM(x,y+h*.18,z),stripe);add(SHG.box(w+.02,h*.18,.27),SM(x,y-h*.22,z),stripe)}};
  const oars=(n,len,x0,y,z0,z1,w)=>{for(let k=0;k<n;k++){const z=z0+(z1-z0)*k/(n-1);for(const s of [-1,1])add(SHG.box(len,.12,.18),SM(s*(x0+len/2*.9),y-len*.25,z,0,0,s*-.5),wood)}};
  const oculus=(x,y,z)=>{for(const s of [-1,1]){add(SHG.sph(.36,8,6),SM(s*x,y,z,0,0,0,.4,1,1),'#F2EEE2');add(SHG.sph(.18,6,4),SM(s*(x+.08),y,z,0,0,0,.4,1,1),'#111')}};
  if(era==='galley'){
    if(kind==='galley'){ // trireme
      add(SHG.wedge(3,2,20,.35),SM(0,0,0),wood);add(SHG.box(3.9,.4,15),SM(0,.95,1),dark);add(SHG.coneZ(.45,2.6,6),SM(0,-.7,-11.2),bronze);
      add(SHG.coneZ(.5,3.4,6),SM(0,2,10.8,2.2,0,0),wood);oculus(1.05,.3,-8.2);oars(12,4.6,1.9,.9,-6,7);
      add(SHG.box(.3,9,.3),SM(0,5.3,-1),dark);sail(0,6.6,-1.1,6.4,4.6,canvas,SC.main);
      for(let k=0;k<7;k++)for(const s of [-1,1])add(SHG.cylZ(.55,.55,.12,10),SM(s*1.95,1.4,-5+k*1.7,0,s*Math.PI/2,0),k%2?SC.main:canvas);
    }
    if(kind==='hgalley'){ // quinquereme with a boarding tower and corvus
      add(SHG.wedge(5,2.8,28,.35),SM(0,0,0),wood);add(SHG.box(6.2,.5,21),SM(0,1.4,1),dark);add(SHG.coneZ(.7,3.4,6),SM(0,-1,-15.6),bronze);
      add(SHG.coneZ(.7,4.4,6),SM(0,2.6,15,2.2,0,0),wood);oculus(1.7,.4,-11.6);oars(16,6,2.9,1.2,-9,10);oars(16,5,2.9,.4,-8.6,9.6);
      add(SHG.box(4,3.2,4),SM(0,3.4,3),dark);for(const [x,z] of [[-1.6,1.2],[1.6,1.2],[-1.6,4.8],[1.6,4.8]])add(SHG.box(.8,.8,.8),SM(x,5.4,z),dark);
      add(SHG.box(.5,.5,8),SM(0,4.6,-9,-.6,0,0),wood);add(SHG.box(1.6,.2,4),SM(0,6.3,-11.6,-.6,0,0),wood);add(SHG.box(.3,7,.3),SM(0,4.6,-7.5),dark);
      add(SHG.box(.35,12,.35),SM(0,7,-3),dark);sail(0,9,-3.15,8.6,6.2,canvas,SC.main);
      for(let k=0;k<10;k++)for(const s of [-1,1])add(SHG.cylZ(.6,.6,.12,10),SM(s*3.05,2,-8+k*1.8,0,s*Math.PI/2,0),k%2?SC.main:canvas);
      lit(SHG.box(.2,.2,.2),SM(0,8.6,4.5),SC.hi);
    }
    if(kind==='fireship'){ // a fire raft of pitch barrels and brushwood
      add(SHG.wedge(2.6,1.4,12,.4),SM(0,0,0),dark);for(let k=0;k<6;k++)add(SHG.cylZ(.5,.5,1,8),SM((k%2-.5)*1.2,1.2,-4+k*1.5,Math.PI/2,0,0),'#3a2a1c');
      add(SHG.box(.25,6,.25),SM(0,3.6,0),dark);sail(0,4.6,-.1,3.4,2.6,'#5a4a38');
      for(let k=0;k<5;k++)lit(SHG.coneZ(.7,2.4,5),SM((k%2-.5)*1.1,2.4+k%2*.6,-3+k*1.6,Math.PI/2,0,0),k%2?'#FF7A20':'#FFC040');
    }
    if(kind==='gen'){ // Leviathan: a twin-hulled giant with two towers and catapults
      for(const s of [-1,1]){add(SHG.wedge(5,3.4,40,.35),SM(s*5.5,0,0),wood);add(SHG.coneZ(.8,4,6),SM(s*5.5,-1.2,-21.8),bronze);add(SHG.coneZ(.8,5.2,6),SM(s*5.5,3.2,20.8,2.2,0,0),wood);oculus(1.7,.5,-16)}
      add(SHG.box(16,1,32),SM(0,1.9,1),dark);for(const s of [-1,1]){for(let k=0;k<20;k++){const z=-14+k*1.6;add(SHG.box(6,.14,.2),SM(s*(8+2.7),1.2-1.5,z,0,0,s*-.5),wood)}}
      for(const z of [-6,8]){add(SHG.box(6,7,6),SM(0,5.8,z),dark);for(const [x,zz] of [[-2.4,-2.4],[2.4,-2.4],[-2.4,2.4],[2.4,2.4]])add(SHG.box(1,1,1),SM(x,9.8,z+zz),dark);add(SHG.box(.6,.6,5),SM(0,10.2,z-1,-.7,0,0),wood);add(SHG.box(3,.8,3),SM(0,9.4,z),wood)}
      for(const z of [-13,1]){add(SHG.box(.45,16,.45),SM(0,10,z),dark);sail(0,13,z-.15,12,8,canvas,SC.main)}
      for(let k=0;k<16;k++)for(const s of [-1,1])add(SHG.cylZ(.7,.7,.14,10),SM(s*8.05,2.6,-14+k*1.9,0,s*Math.PI/2,0),k%2?SC.main:canvas);
      lit(SHG.box(2.6,1.6,.2),SM(0,18.6,-13),SC.hi);lit(SHG.box(.6,.6,.6),SM(0,10.4,-6),'#FFB040');lit(SHG.box(.6,.6,.6),SM(0,10.4,8),'#FFB040');
    }
  }
  if(era==='sail'){
    const ship=(len,w,decks,masts,mh,flag)=>{
      add(SHG.wedge(w,4+decks*1.2,len,.45),SM(0,0,0),tar);
      for(let d=0;d<decks;d++){const y=-1+d*1.6;add(SHG.box(w+.06,.6,len*.78),SM(0,y,1),ochre);for(let k=0;k<Math.floor(len*.78/1.6);k++)for(const s of [-1,1])add(SHG.box(.1,.38,.5),SM(s*(w/2+.04),y,-len*.39+1+k*1.6+.8),tar)}
      add(SHG.box(w*.9,decks*1.6+1,4),SM(0,decks*1.2,len*.4),tar);for(let k=0;k<Math.ceil(w*.8/1);k++)lit(SHG.box(.6,.5,.1),SM(-w*.4+.5+k,decks*1.2+.3,len*.4+2.05),'#FFD27A');
      add(SHG.box(.3,.3,len*.35),SM(0,1.8+decks*.6,-len*.62,-.35,0,0),dark);add(SHG.sph(.6,6,4),SM(0,.8+decks*.4,-len*.5),'#D6A63A');
      masts.forEach((z,i)=>{const h=mh*(i===1?1:.86);add(SHG.box(.45,h,.45),SM(0,h/2+2,z),dark);const sw=w*(i===1?2.1:1.8);sail(0,h*.38+2,z,sw,h*.24);sail(0,h*.62+2,z,sw*.82,h*.18);sail(0,h*.82+2,z,sw*.6,h*.12);add(SHG.box(sw+.3,.25,.25),SM(0,h*.5+2,z),dark);
        add(SHG.box(.1,1.2,2.4),SM(0,h+2.4,z+1.2),flag)});
      add(SHG.blade(.1,len*.18,len*.22),SM(0,6+decks,-len*.62,0,Math.PI,0),canvas);
      add(SHG.box(.2,4,.2),SM(0,4+decks*1.2,len*.5),dark);add(SHG.box(.12,2.2,3.4),SM(0,5.4+decks*1.2,len*.5+1.7),flag);};
    if(kind==='frigate')ship(22,4.4,1,[-6,0,6],17,SC.main);
    if(kind==='sotl')ship(28,6,2,[-8,0,8],22,SC.main);
    if(kind==='gen'){ship(34,7.4,3,[-10,0,10],27,SC.main);add(SHG.box(.14,3.6,5.4),SM(0,32,1.6),SC.main);lit(SHG.box(.2,.6,.6),SM(0,31,0),'#FFE6A0')}
    if(kind==='fireship'){add(SHG.wedge(3.6,3,15,.45),SM(0,0,0),tar);for(const z of [-3,3]){add(SHG.box(.3,11,.3),SM(0,7,z),dark);sail(0,7,z,5,4,'#5a4a38')}
      for(let k=0;k<6;k++)lit(SHG.coneZ(.9,3,5),SM((k%2-.5)*1.4,2.6+k%3*.8,-5+k*2,Math.PI/2,0,0),k%2?'#FF7A20':'#FFC040')}
  }
  if(era==='dread'){ // 1906 to 1918: grey steel, tripod masts, twin turrets, coal smoke
    const G1=side==='E'?'#68707A':'#8A96A3',G2=side==='E'?'#565E68':'#75828F',deck='#8A7A62',fun=side==='E'?'#454B53':'#4C555E',boot='#5A2A22';
    const cylV=(r,h,seg)=>new THREE.CylinderGeometry(r,r,h,seg||10);
    const hull=(len,w,hg)=>{add(SHG.wedge(w,hg,len,.18),SM(0,0,0),G1);add(SHG.box(w*.94,.12,len*.84),SM(0,hg/2+.04,.6),deck);add(SHG.box(w*1.01,.45,len*.9),SM(0,-hg*.3,.2),boot)};
    const turret=(z,y,w,dir,one)=>{add(SHG.box(w,1.2,w*1.1),SM(0,y,z),G2);add(SHG.cylZ(w*.5,w*.5,.3,12),SM(0,y-.5,z,Math.PI/2,0,0),G2);
      for(const sx of one?[0]:[-1,1])add(SHG.cylZ(.15,.2,w*1.6,8),SM(sx*w*.2,y+.1,z+dir*w*1.2),'#2C3035')};
    const funnel=(z,h,r,base)=>{add(cylV(r,h,10),SM(0,base+h/2,z,0,0,0,1,1,1.35),fun);add(cylV(r*1.04,.35,10),SM(0,base+h-.4,z,0,0,0,1,1,1.35),'#1E2024')};
    const tripod=(z,h,base)=>{add(SHG.box(.45,h,.45),SM(0,base+h/2,z),'#59636D');for(const sx of [-1,1])add(SHG.box(.3,h*.96,.3),SM(sx*.95,base+h/2,z+1.2,-.12,0,sx*.12),'#59636D');add(SHG.box(2.6,1.1,2.6),SM(0,base+h,z),'#59636D')};
    const ensign=(len,hg,big)=>{add(SHG.box(.14,3.4,.14),SM(0,hg/2+1.7,len*.46),'#2A2C30');add(SHG.box(.08,big?1.6:1.2,big?2.6:2),SM(0,hg/2+3,len*.46+1),SC.main);add(SHG.box(w0(),.1,1.2),SM(0,hg/2+.12,-len*.36),SC.main)};
    let W0=5;const w0=()=>W0;
    if(kind==='dread'||kind==='gen'){const big=kind==='gen',len=big?48:40,w=big?7.4:6.4,hg=3.2;W0=w*.9;hull(len,w,hg);
      turret(-len*.36,2.4,2.2,-1);turret(-len*.24,3.6,2.2,-1);turret(len*.22,3.6,2.2,1);turret(len*.34,2.4,2.2,1);if(big){turret(len*.04,2.6,2.1,1);for(const sx of [-1,1])add(SHG.box(.8,.7,len*.4),SM(sx*w*.47,1.1,0),G2)}
      add(SHG.box(w*.6,3,5),SM(0,3.4,-len*.12),G2);add(SHG.box(w*.45,1.2,3.2),SM(0,5.4,-len*.12),G2);tripod(-len*.1,big?16:13,2);
      funnel(-len*.01,6.4,1,2);funnel(len*.08,6,1,2);add(SHG.box(.35,9,.35),SM(0,6.5,len*.16),'#59636D');ensign(len,hg,big);
      if(big){add(SHG.box(.1,2.2,3.6),SM(0,2+16+2.2,-len*.1+1.8),SC.main);lit(SHG.box(.35,.35,.35),SM(0,2+16+.8,-len*.1-1.2),'#FFE6A0')}}
    if(kind==='bcr'){const len=44,w=5.6,hg=3;W0=w*.9;hull(len,w,hg);turret(-len*.36,2.3,2,-1);turret(-len*.25,3.4,2,-1);turret(len*.2,2.4,2,1);turret(len*.34,2.3,2,1);
      add(SHG.box(w*.55,2.6,4.4),SM(0,3.2,-len*.15),G2);tripod(-len*.13,12,2);funnel(-len*.04,6,.9,2);funnel(len*.03,6,.9,2);funnel(len*.1,5.6,.9,2);ensign(len,hg)}
    if(kind==='lcr'){const len=28,w=3.6,hg=2.4;W0=w*.9;hull(len,w,hg);for(const [z,d] of [[-.38,-1],[-.24,-1],[.3,1],[.4,1]])turret(len*z,1.9,1.1,d,true);
      add(SHG.box(w*.6,2,3),SM(0,2.4,-len*.16),G2);add(SHG.box(.3,10,.3),SM(0,6,-len*.18),'#59636D');for(const z of [-.04,.04,.12,.2])funnel(len*z,4.6,.5,1.6);ensign(len,hg)}
    if(kind==='tbd'){const len=18,w=2.2,hg=1.8;W0=w*.9;hull(len,w,hg);add(SHG.box(1.4,1.4,2),SM(0,1.8,-len*.26),G2);turret(-len*.38,1.5,.8,-1,true);turret(len*.36,1.5,.8,1,true);
      for(const z of [-.06,.04,.14])funnel(len*z,3,.38,1.2);for(const z of [.24,.3])add(SHG.cylZ(.22,.22,3.4,8),SM(0,1.3,len*z,0,Math.PI/2.3,0),'#3E464E');add(SHG.box(.2,6,.2),SM(0,3.5,-len*.2),'#59636D');ensign(len,hg)}
    if(kind==='uboat'){add(SHG.cylZ(.95,.75,16,12),SM(0,0,0),'#4C555E');add(SHG.coneZ(.95,2.6,12),SM(0,0,-9.3),'#4C555E');add(SHG.box(2.6,.25,12),SM(0,.85,0),'#3E464E');
      add(SHG.box(1.2,1.8,2.6),SM(0,1.8,-.6),'#565E68');add(SHG.box(.12,2.4,.12),SM(0,3.8,-.4),'#2A2C30');add(SHG.box(.5,.5,1),SM(0,1.3,-3.6),'#3E464E');add(SHG.cylZ(.1,.1,1.4,6),SM(0,1.4,-4.6),'#2A2C30');
      add(SHG.box(.08,.6,1.2),SM(.62,2.2,-.6),SC.main)}
  }
  if(era==='navy'){
    const G1=side==='E'?'#7C7F72':'#6F7B88',G2=side==='E'?'#5E6157':'#56616E',deck='#3E4248';
    const vls=(x,z,nx,nz)=>{add(SHG.box(nx*.7+.2,.2,nz*.7+.2),SM(x,0,z),'#2E3136');for(let i=0;i<nx;i++)for(let j=0;j<nz;j++)add(SHG.box(.5,.25,.5),SM(x-(nx-1)*.35+i*.7,.05,z-(nz-1)*.35+j*.7),'#1E2024')};
    const gun=(z,y,big)=>{add(SHG.box(big?2.2:1.6,1,big?2.6:2),SM(0,y,z),G1);add(SHG.cylZ(.18,.18,big?4:3,8),SM(0,y+.2,z-(big?2.8:2.2)),'#2a2c30')};
    const panel=(x,y,z,ry,s)=>add(SHG.box(s,s,.2),SM(x,y,z,0,ry,0),'#2C3440');
    if(kind==='fac'){add(SHG.wedge(2.8,1.8,11,.25),SM(0,0,0),G1);add(SHG.wedge(2,1.4,4,.6),SM(0,1.5,.6),G2);add(SHG.coneZ(.5,1.6,4),SM(0,2.8,.4,Math.PI/2,0,0),G2);
      for(const s of [-1,1])add(SHG.box(.6,.6,2.6),SM(s*.75,1.1,3.6,-.25,0,0),'#3a3d42');add(SHG.box(2.9,.08,1.2),SM(0,.92,-3.4),SC.main)}
    if(kind==='ffg'){add(SHG.wedge(4.4,2.4,24,.2),SM(0,0,0),G1);add(SHG.box(4.4,.1,22),SM(0,1.22,.6),deck);add(SHG.wedge(3.4,3.2,8,.75),SM(0,2.6,-.6),G2);add(SHG.coneZ(1.2,4,4),SM(0,5.4,-1.2,Math.PI/2,Math.PI/4,0),G2);
      add(SHG.box(3.6,2.4,4.6),SM(0,2.4,5.4),G2);add(SHG.torZ(1.1,.06,20),SM(0,1.3,9.6,Math.PI/2,0,0),'#E8E8E0');gun(-6.6,1.7,false);vls(0,-3.8,2,2);add(SHG.box(4.5,.1,1.4),SM(0,1.25,-9),SC.main);
      lit(SHG.box(.3,.3,.3),SM(0,7.2,-1.2),SC.hi)}
    if(kind==='ddg'||kind==='gen'){const big=kind==='gen',len=big?40:28,w=big?7.4:5.2;
      add(SHG.wedge(w,3,len,.2),SM(0,0,0),G1);add(SHG.box(w,.1,len*.9),SM(0,1.52,.8),deck);
      add(SHG.wedge(w*.78,4.4,len*.32,.72),SM(0,3.6,-len*.04),G2);for(const [x,ry] of [[-1,-.45],[1,.45]])panel(x*w*.34,4.6,-len*.12,ry,big?2.6:1.9);
      add(SHG.coneZ(big?1.2:.9,big?6:4.6,4),SM(0,big?8.6:7.4,-len*.02,Math.PI/2,Math.PI/4,0),G2);
      if(big){add(SHG.wedge(w*.7,4,len*.2,.7),SM(0,3.4,len*.2),G2);for(const [x,ry] of [[-1,-.45],[1,.45]])panel(x*w*.3,4.2,len*.2+1.2,ry+Math.PI,2.2);add(SHG.coneZ(1,5,4),SM(0,7.4,len*.22,Math.PI/2,Math.PI/4,0),G2)}
      gun(-len*.36,2.1,big);if(big)gun(len*.38,2.1,true);vls(0,-len*.24,big?4:2,big?4:3);vls(0,len*.3,big?4:2,big?3:3);if(big){vls(-w*.3,-len*.04,1,6);vls(w*.3,-len*.04,1,6)}
      add(SHG.torZ(1.2,.06,20),SM(0,1.62,len*.44,Math.PI/2,0,0),'#E8E8E0');add(SHG.box(w+.05,.12,1.6),SM(0,1.6,-len*.43),SC.main);if(big)add(SHG.box(w+.05,1.2,len*.5),SM(0,.2,0),SC.main);
      lit(SHG.box(.35,.35,.35),SM(0,big?11.8:9.9,-len*.02),SC.hi)}
    if(kind==='sub'){add(SHG.cylZ(1.4,1.2,22,14),SM(0,0,0),'#16181B');add(SHG.sph(1.4,14,10),SM(0,0,-11,0,0,0,1,1,1.4),'#16181B');add(SHG.coneZ(1.2,4,14),SM(0,0,13,Math.PI,0,0),'#16181B');
      add(SHG.wedge(1.2,3,4,.6),SM(0,2.6,-4),'#1B1E22');for(const s of [-1,1])add(SHG.box(3,.15,1.2),SM(s*1.2,3,-4.4),'#1B1E22');for(const r of [0,Math.PI/2])add(SHG.box(4.6,.15,1.4),SM(0,0,14,0,0,r),'#1B1E22');
      add(SHG.box(.06,.6,1.2),SM(.62,3.2,-4),SC.main)}
    if(kind==='carrier'){add(SHG.wedge(9,5,48,.4),SM(0,0,0),G1);add(SHG.box(15,.5,52),SM(0,2.8,-1,0,-.05,0),deck);add(SHG.box(4,.52,30),SM(-2.4,2.82,-8,0,.14,0),'#4A4E54');
      for(let k=0;k<7;k++)add(SHG.box(.12,.53,2),SM(-3+k*.1,2.84,-24+k*4.6,0,.14,0),'#F2D060');add(SHG.box(.18,.54,48),SM(4.6,2.84,0,0,-.05,0),'#E8E8E0');
      add(SHG.box(2.6,6,7),SM(6.4,6,6),G2);add(SHG.box(2,3,4),SM(6.4,10.5,5.4),G2);panel(5.2,8.4,4,-Math.PI/2,1.6);add(SHG.box(.3,4,.3),SM(6.4,13.6,5.4),'#2a2c30');
      for(let k=0;k<6;k++){const x=2+(k%2)*2.8,z=12+Math.floor(k/2)*3.6;add(SHG.box(.9,.5,4),SM(x,3.3,z),'#8A949E');add(SHG.box(3.6,.15,1.2),SM(x,3.3,z+.4),'#8A949E')}
      add(SHG.box(15.1,.1,1.6),SM(0,2.9,-25),SC.main);lit(SHG.box(.4,.4,.4),SM(6.4,15.8,5.4),SC.hi)}
  }
  return {S,L};
}
function navalGeos(era,kind,side){const k='nav|'+era+'|'+kind+'|'+side;if(SHIP_CACHE[k])return SHIP_CACHE[k];const d=navalDef(era,kind,side);return SHIP_CACHE[k]={solid:shipMerge(d.S),glow:d.L.length?shipMerge(d.L):null}}

/* ---------- 3D battlefield (three.js) ---------- */
const V3={ok:false,built:null};
const DMIN=150,DMAX=1500;
function v3init(canvas){
  if(!window.THREE)return false;
  try{
    const LOW=V3.low=(window.matchMedia&&matchMedia('(pointer:coarse)').matches)||Math.min(innerWidth,innerHeight)<500;
    const r=new THREE.WebGLRenderer({canvas,antialias:!LOW,powerPreference:'high-performance'});
    r.setPixelRatio(LOW?1:Math.max(1,Math.floor(Math.min(2,window.devicePixelRatio||1))));r.shadowMap.enabled=true;r.shadowMap.type=LOW?THREE.PCFShadowMap:THREE.PCFSoftShadowMap;if(LOW)V3.post=false;
    r.outputEncoding=THREE.sRGBEncoding;r.toneMapping=THREE.ACESFilmicToneMapping;r.toneMappingExposure=1.12;
    V3.renderer=r;V3.scene=new THREE.Scene();V3.scene.background=new THREE.Color(0x0b0f0d);
    V3.camera=new THREE.PerspectiveCamera(36,W/H,12,7000);
    V3.hemi=new THREE.HemisphereLight(0xe8eef4,0x4a4030,0.78);V3.scene.add(V3.hemi);
    const s=new THREE.DirectionalLight(0xfff0d8,0.95);s.position.set(-640,520,-380);s.castShadow=true;
    s.shadow.mapSize.set(LOW?1024:4096,LOW?1024:4096);s.shadow.radius=3;Object.assign(s.shadow.camera,{left:-640,right:640,top:460,bottom:-460,near:10,far:2400});s.shadow.bias=-0.0006;
    V3.sun=s;V3.scene.add(s);V3.scene.add(s.target);
    V3.ray=new THREE.Raycaster();V3.cam={tx:0,tz:0,dist:1000,yaw:0,yawT:0};
    V3.tmp={m:new THREE.Matrix4(),q:new THREE.Quaternion(),q2:new THREE.Quaternion(),p:new THREE.Vector3(),s:new THREE.Vector3(),v:new THREE.Vector3(),up:new THREE.Vector3(0,1,0),ax:new THREE.Vector3(1,0,0),col:new THREE.Color()};
    V3.colors={};V3.ok=true;return true;
  }catch(e){console.warn('WebGL unavailable',e);return false}
}
/* merge simple parts into one low-poly mesh with faceted normals */
function mergeParts(parts){
  const pos=[];for(const [g,m] of parts){const n=g.index?g.toNonIndexed():g.clone();n.applyMatrix4(m);const p=n.attributes.position.array;for(let i=0;i<p.length;i++)pos.push(p[i])}
  const out=new THREE.BufferGeometry();out.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));out.computeVertexNormals();return out;
}
const M4=(x,y,z,rx,ry,rz,sx,sy,sz)=>new THREE.Matrix4().compose(new THREE.Vector3(x||0,y||0,z||0),new THREE.Quaternion().setFromEuler(new THREE.Euler(rx||0,ry||0,rz||0)),new THREE.Vector3(sx||1,sy||1,sz||1));
const B=(w,h,d)=>new THREE.BoxGeometry(w,h,d),CY=(rt,rb,h,s)=>new THREE.CylinderGeometry(rt,rb,h,s||6);
function soldierGeos(){
  return {
    legs:mergeParts([[B(.62,1.5,.66),M4(-.36,0,0)],[B(.62,1.5,.66),M4(.36,0,0,.12)],[B(.66,.28,.9),M4(-.36,-.66,-.12)],[B(.66,.28,.9),M4(.36,-.66,-.08)]]),
    body:mergeParts([[CY(.98,.78,2.1,6),M4(0,.05,0)],[B(.46,1.7,.5),M4(-1.12,.05,-.15,.35,0,.12)],[B(.46,1.7,.5),M4(1.12,.05,-.3,.55,0,-.12)],[CY(.86,.98,.34,6),M4(0,-.7,0)]]),
    head:mergeParts([[new THREE.IcosahedronGeometry(.62,0),M4(0,0,0)]]),
    hat:mergeParts([[CY(.62,.66,1.2,7),M4(0,.15,0)],[B(1.1,.12,.5),M4(0,-.4,-.55)]]),
    helm:mergeParts([[new THREE.SphereGeometry(.74,7,4,0,Math.PI*2,0,Math.PI/2),M4(0,0,0)],[B(1.8,.12,1.8),M4(0,0,0,0,0,0,.95,1,.95)]]),
    shield:mergeParts([[CY(1.32,1.32,.26,10),M4(0,0,0,Math.PI/2)],[CY(.34,.34,.34,8),M4(0,0,-.16,Math.PI/2)]]),
    horse:mergeParts([[CY(.92,.92,3.5,7),M4(0,0,0,Math.PI/2)],[B(.62,1.5,.78),M4(0,.95,-1.7,-.55)],[B(.56,.62,1.3),M4(0,1.55,-2.55,.25)],
      [B(.34,1.8,.34),M4(-.52,-1.45,-1.25)],[B(.34,1.8,.34),M4(.52,-1.45,-1.25,.25)],[B(.34,1.8,.34),M4(-.52,-1.45,1.25,-.25)],[B(.34,1.8,.34),M4(.52,-1.45,1.25)],[B(.22,1.3,.3),M4(0,-.2,2.05,-.45)]]),
  };
}
function v3post(){
  const r=V3.renderer,sz=r.getDrawingBufferSize(new THREE.Vector2());
  if(!V3.rt||V3.rt.width!==sz.x||V3.rt.height!==sz.y){
    if(V3.rt)V3.rt.dispose();
    const RT=r.capabilities.isWebGL2&&THREE.WebGLMultisampleRenderTarget?THREE.WebGLMultisampleRenderTarget:THREE.WebGLRenderTarget;
    V3.rt=new RT(sz.x,sz.y,{type:THREE.HalfFloatType,format:THREE.RGBAFormat,depthBuffer:true});if(V3.rt.depthTexture===undefined)V3.rt.depthTexture=null;
    if(!V3.quad){V3.qcam=new THREE.OrthographicCamera(-1,1,1,-1,0,1);V3.qscene=new THREE.Scene();
      V3.qmat=new THREE.ShaderMaterial({uniforms:{t:{value:null},px:{value:new THREE.Vector2()},blur:{value:1}},depthTest:false,depthWrite:false,toneMapped:false,
        vertexShader:'varying vec2 vUv;void main(){vUv=uv;gl_Position=vec4(position.xy,0.,1.);}',
        fragmentShader:`uniform sampler2D t;uniform vec2 px;uniform float blur;varying vec2 vUv;
          vec3 aces(vec3 x){return clamp((x*(2.51*x+.03))/(x*(2.43*x+.59)+.14),0.,1.);}
          void main(){float d=abs(vUv.y-.52);float b=smoothstep(.16,.5,d)*blur*7.;vec3 c=vec3(0.);float w=0.;
            for(int i=-4;i<=4;i++){for(int j=-1;j<=1;j++){vec2 o=vec2(float(j)*.8,float(i))*px*b*.55;float k=1.-abs(float(i))/5.;c+=texture2D(t,vUv+o).rgb*k;w+=k;}}
            c/=w;c*=1.02;c=aces(c);c=pow(c,vec3(1./2.2));
            float v=smoothstep(.95,.35,length((vUv-.5)*vec2(1.,1.25)));c*=mix(.78,1.,v);c=mix(c,c*vec3(1.02,1.,.96),.5);
            gl_FragColor=vec4(c,1.);}`});
      V3.quad=new THREE.Mesh(new THREE.PlaneGeometry(2,2),V3.qmat);V3.qscene.add(V3.quad)}
  }
  V3.qmat.uniforms.t.value=V3.rt.texture;V3.qmat.uniforms.px.value.set(1/sz.x,1/sz.y);
  const zoom=Math.max(0,Math.min(1,(V3.cam.dist-DMIN)/(1120-DMIN)));V3.qmat.uniforms.blur.value=.18+.9*(1-zoom)*(1-zoom);
  r.setRenderTarget(V3.rt);r.render(V3.scene,V3.camera);r.setRenderTarget(null);r.render(V3.qscene,V3.qcam);
}
const hx=c=>V3.colors[c]||(V3.colors[c]=new THREE.Color(c).convertSRGBToLinear());
function v3clearBattle(){
  if(!V3.group)return;V3.scene.remove(V3.group);
  V3.group.traverse(o=>{if(o.geometry)o.geometry.dispose();if(o.material){(Array.isArray(o.material)?o.material:[o.material]).forEach(m=>{if(m.map)m.map.dispose();m.dispose()})}});
  V3.group=null;
}
function v3build(id){
  v3clearBattle();const g=new THREE.Group();V3.group=g;V3.scene.add(g);V3.built=id;const TH=V3.theatre=theatreOf(SCEN[id]),STEAM=!!(SCEN[id].gen&&SCEN[id].gen.steam)||SCEN[id].era==='steam';V3.steam=STEAM;V3.steamCity=!!(SCEN[id].gen&&SCEN[id].gen.steam);
  V3.scene.background=new THREE.Color(TH==='space'?0x020308:STEAM?0x1a130e:0x0b0f0d);
  // painted map texture
  const mc=document.createElement('canvas');mc.width=2048;mc.height=Math.round(2048*H/W);V3.mapCanvas=mc;
  drawScene(mc.getContext('2d'),mc.width/W,id,'3d');
  const tex=new THREE.CanvasTexture(mc);tex.anisotropy=V3.renderer.capabilities.getMaxAnisotropy();tex.encoding=THREE.sRGBEncoding;V3.mapTex=tex;
  // terrain
  const SX=V3.low?130:220,SY=V3.low?84:140,geo=new THREE.PlaneGeometry(W,H,SX,SY);geo.rotateX(-Math.PI/2);
  const pos=geo.attributes.position;
  for(let i=0;i<pos.count;i++){const X=pos.getX(i),Z=pos.getZ(i);pos.setY(i,heightAt(id,X+W/2,Z+H/2))}
  geo.computeVertexNormals();
  {const nr=geo.attributes.normal,cols=new Float32Array(pos.count*3),snow=id==='austerlitz';for(let i=0;i<pos.count;i++){const sl=1-nr.getY(i),y=pos.getY(i),top=Math.max(0,Math.min(1,(y-14)/50));
    let r=1-sl*3.4,g=1-sl*3.6,b=1-sl*3.9;r=Math.max(.55,r)+top*.1;g=Math.max(.52,g)+top*.09;b=Math.max(.48,b)+(snow?top*.12:top*.02);if(y<-3){r*=.86;g*=.86;b*=.84}cols[i*3]=r;cols[i*3+1]=g;cols[i*3+2]=b}
    geo.setAttribute('color',new THREE.Float32BufferAttribute(cols,3))}
  const terr=new THREE.Mesh(geo,new THREE.MeshLambertMaterial({map:tex,vertexColors:true}));terr.receiveShadow=true;terr.castShadow=TH!=='sea'&&TH!=='space';g.add(terr);V3.terrain=terr;
  // diorama skirt
  const sk=[],sideY=-46;const edge=(n,f)=>{for(let i=0;i<n;i++){const [x0,y0]=f(i/n),[x1,y1]=f((i+1)/n),h0=heightAt(id,x0,y0),h1=heightAt(id,x1,y1),X0=x0-W/2,Z0=y0-H/2,X1=x1-W/2,Z1=y1-H/2;
    sk.push(X0,h0,Z0, X1,h1,Z1, X1,sideY,Z1, X0,h0,Z0, X1,sideY,Z1, X0,sideY,Z0)}};
  edge(120,t=>[t*W,H]);edge(120,t=>[W-t*W,0]);edge(80,t=>[0,t*H]);edge(80,t=>[W,H-t*H]);
  const sg=new THREE.BufferGeometry();sg.setAttribute('position',new THREE.Float32BufferAttribute(sk,3));sg.computeVertexNormals();
  const skirt=new THREE.Mesh(sg,new THREE.MeshLambertMaterial({color:TH==='sea'?0x10283c:0x3a2c1f,side:THREE.DoubleSide}));if(TH!=='space')g.add(skirt);
  const base=new THREE.Mesh(new THREE.PlaneGeometry(W,H),new THREE.MeshBasicMaterial({color:0x1a140e}));base.rotation.x=Math.PI/2;base.position.y=sideY;if(TH!=='space')g.add(base);
  const wood=document.createElement('canvas');wood.width=512;wood.height=512;{const t=wood.getContext('2d'),R=rng(3);t.fillStyle='#3a2716';t.fillRect(0,0,512,512);
    for(let i=0;i<220;i++){const y=R()*512,a=.05+R()*.12;t.strokeStyle=R()<.5?`rgba(20,12,6,${a})`:`rgba(120,80,45,${a})`;t.lineWidth=.6+R()*2.4;t.beginPath();for(let x=0;x<=512;x+=16){const yy=y+Math.sin(x/70+i)*4+Math.sin(x/23+i*3)*1.5;x?t.lineTo(x,yy):t.moveTo(x,yy)}t.stroke()}
    for(let i=0;i<10;i++){const x=R()*512,y=R()*512;t.strokeStyle='rgba(20,12,6,.25)';for(let r=3;r<18;r+=3){t.beginPath();t.ellipse(x,y,r*2.4,r,0,0,7);t.stroke()}}}
  const wt=new THREE.CanvasTexture(wood);wt.wrapS=wt.wrapT=THREE.RepeatWrapping;wt.repeat.set(10,10);wt.encoding=THREE.sRGBEncoding;
  const table=new THREE.Mesh(new THREE.PlaneGeometry(6000,6000),new THREE.MeshLambertMaterial({map:wt}));table.rotation.x=-Math.PI/2;table.position.y=sideY-.5;table.receiveShadow=true;if(TH!=='space')g.add(table);
  v3env(g,id,TH,STEAM);
  // water
  const GEN=SCEN[id]&&SCEN[id].gen;
  if(GEN&&GEN.river)for(const c of GEN.river.cross.filter(c=>c.kind==='bridge')){const cx=(c.x0+c.x1)/2,cy=gRiverY(GEN,cx);const deck=new THREE.Mesh(new THREE.BoxGeometry(c.x1-c.x0-4,2.4,52),new THREE.MeshLambertMaterial({color:0x76776f}));deck.position.set(cx-W/2,1.6,cy-H/2);deck.castShadow=deck.receiveShadow=true;g.add(deck)}
  if(TH==='sea'){const dr=SCEN[id].era==='dread';const w=new THREE.Mesh(new THREE.PlaneGeometry(W,H),new THREE.MeshPhongMaterial({color:dr?0x0e1e28:0x08223a,specular:dr?0x46525a:0x3a5a78,shininess:70,transparent:true,opacity:.9}));w.rotation.x=-Math.PI/2;w.position.y=-2.4;g.add(w);V3.water=w}
  if(id==='cannae'||id==='austerlitz'||id==='ironbridge'||(GEN&&GEN.river)){
    const wm=new THREE.MeshLambertMaterial({color:id==='austerlitz'?0xc6d6de:0x2a5566,transparent:true,opacity:id==='austerlitz'?.92:.86});
    const w=new THREE.Mesh(new THREE.PlaneGeometry(W,H),wm);w.rotation.x=-Math.PI/2;w.position.y=id==='austerlitz'?-2.4:-2.4;g.add(w)}
  // bridge
  if(id==='ironbridge'){const by=riverY(503);const deck=new THREE.Mesh(new THREE.BoxGeometry(46,2.4,58),new THREE.MeshLambertMaterial({color:0x76776f}));deck.position.set(503-W/2,1.6,by-H/2);deck.castShadow=deck.receiveShadow=true;g.add(deck);
    for(const dx of [-22,22]){const rail=new THREE.Mesh(new THREE.BoxGeometry(1.4,2.4,58),new THREE.MeshLambertMaterial({color:0x3a3b38}));rail.position.set(503-W/2+dx,3.6,by-H/2);g.add(rail)}}
  // trees, houses, tents
  const D=decor(id),tm=V3.tmp;
  if(D.trees.length){
    const trunk=new THREE.InstancedMesh(new THREE.CylinderGeometry(.5,.8,1,5),new THREE.MeshLambertMaterial({color:0x4a3524}),D.trees.length);
    const can=new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1,0),new THREE.MeshLambertMaterial({color:0xffffff}),D.trees.length);
    const R=rng(5),winter=id==='austerlitz';
    D.trees.forEach(([x,y,r],i)=>{const h=heightAt(id,x,y),cr=r*.72,th=r*.55;
      tm.p.set(x-W/2,h+th/2,y-H/2);tm.q.identity();tm.s.set(1,th,1);tm.m.compose(tm.p,tm.q,tm.s);trunk.setMatrixAt(i,tm.m);
      tm.p.set(x-W/2,h+th+cr*.75,y-H/2);tm.q.setFromAxisAngle(tm.up,R()*6);tm.s.set(cr,cr*(1+R()*.35),cr);tm.m.compose(tm.p,tm.q,tm.s);can.setMatrixAt(i,tm.m);
      const k=R();can.setColorAt(i,tm.col.setHSL(winter?0.3:0.24+k*.08,winter?0.12:0.32+k*.15,winter?0.34+k*.12:0.2+k*.12).convertSRGBToLinear())});
    can.instanceColor.needsUpdate=true;trunk.castShadow=can.castShadow=true;can.receiveShadow=true;g.add(trunk,can);
  }
  V3.roof=null;
  if(D.houses.length){
    const walls=new THREE.InstancedMesh(new THREE.BoxGeometry(1,1,1),new THREE.MeshLambertMaterial({color:0xffffff}),D.houses.length);
    const roof=new THREE.InstancedMesh(new THREE.ConeGeometry(.74,1,4),new THREE.MeshLambertMaterial({color:0xffffff}),D.houses.length);
    const R=rng(9);let nr=0;
    D.houses.forEach(([x,y,w,d,a,kind,hh],i)=>{const h=heightAt(id,x,y),blk=kind==='block',wh=hh||(blk?8+R()*9:5);
      tm.p.set(x-W/2,h+wh/2-1,y-H/2);tm.q.setFromAxisAngle(tm.up,-a);tm.s.set(w,wh+2,d);tm.m.compose(tm.p,tm.q,tm.s);walls.setMatrixAt(i,tm.m);
      walls.setColorAt(i,(V3.steamCity?tm.col.setHSL(.04+R()*.03,.22+R()*.1,.24+R()*.12):blk?tm.col.setHSL(.1,.04,.42+R()*.15):tm.col.setHSL(.09,.25,.62+R()*.1)).convertSRGBToLinear());
      if(!blk){tm.p.set(x-W/2,h+wh+1.6,y-H/2);tm.q2.setFromAxisAngle(tm.up,-a+Math.PI/4);tm.s.set(w*.98,3.6,d*.98*1.0);tm.m.compose(tm.p,tm.q2,tm.s);
        tm.m.compose(tm.p,tm.q2,new THREE.Vector3(Math.hypot(w,d)*.72,3.6,Math.hypot(w,d)*.72));roof.setMatrixAt(nr,tm.m);roof.setColorAt(nr,tm.col.setHSL(.03,.45,.3+R()*.08).convertSRGBToLinear());nr++}});
    if(SCEN[id].city){const C=4,nx=Math.ceil(W/C),ny=Math.ceil(H/C),gr=new Float32Array(nx*ny);
      D.houses.forEach(([x,y,w,d,a,kind,hh])=>{if(kind!=='block')return;const top=hh||10;for(let i=Math.max(0,Math.floor((x-w/2)/C));i<=Math.min(nx-1,Math.floor((x+w/2)/C));i++)for(let j=Math.max(0,Math.floor((y-d/2)/C));j<=Math.min(ny-1,Math.floor((y+d/2)/C));j++)gr[j*nx+i]=Math.max(gr[j*nx+i],top)});
      V3.roof={C,nx,ny,gr}}
    roof.count=nr;walls.instanceColor.needsUpdate=true;if(nr)roof.instanceColor.needsUpdate=true;walls.castShadow=roof.castShadow=walls.receiveShadow=true;g.add(walls,roof);
  }
  if(D.tents.length){const tn=new THREE.InstancedMesh(new THREE.ConeGeometry(2.6,3.6,4),new THREE.MeshLambertMaterial({color:0xd6cdb4}),D.tents.length);
    D.tents.forEach(([x,y],i)=>{tm.p.set(x-W/2,heightAt(id,x,y)+1.8,y-H/2);tm.q.setFromAxisAngle(tm.up,Math.PI/4);tm.s.set(1,1,1);tm.m.compose(tm.p,tm.q,tm.s);tn.setMatrixAt(i,tm.m)});tn.castShadow=true;g.add(tn)}
  // unit parts (instanced)
  const P={};const mk=(name,geo,max)=>{const m=new THREE.InstancedMesh(geo,new THREE.MeshLambertMaterial({color:0xffffff}),max);m.setColorAt(0,hx('#ffffff'));m.castShadow=true;m.frustumCulled=false;m.count=0;g.add(m);P[name]=m;};
  const SG=soldierGeos();mk('legs',SG.legs,16000);mk('body',SG.body,16000);mk('head',SG.head,16000);mk('helm',SG.helm,16000);
  mk('hat',SG.hat,9000);mk('pole',new THREE.BoxGeometry(.24,1,.24),16000);mk('shield',SG.shield,6000);
  mk('horse',SG.horse,2500);mk('hhead',new THREE.BoxGeometry(.18,.5,1.4),2500);
  mk('barrel',new THREE.CylinderGeometry(.42,.55,1,8),600);mk('wheel',new THREE.CylinderGeometry(1.25,1.25,.4,10),800);
  mk('hull',new THREE.BoxGeometry(1,1,1),500);mk('turret',new THREE.BoxGeometry(1,1,1),500);mk('marker',new THREE.BoxGeometry(1,1,1),600);
  mk('flag',new THREE.BoxGeometry(1,1,1),40);
  mk('sail',new THREE.BoxGeometry(1,1,1),1200);{const cg=new THREE.ConeGeometry(1,1,6);cg.rotateX(-Math.PI/2);mk('cone',cg,1500)}mk('wing',new THREE.BoxGeometry(1,1,1),1500);
  {const gm=(name,geo,max)=>{const m=new THREE.InstancedMesh(geo,new THREE.MeshBasicMaterial({color:0xffffff,toneMapped:false}),max);m.setColorAt(0,hx('#ffffff'));m.frustumCulled=false;m.count=0;g.add(m);P[name]=m};gm('glow',new THREE.BoxGeometry(1,1,1),3000);gm('orb',new THREE.IcosahedronGeometry(1,1),800)}
  V3.P=P;
  // hand-built ship models: one instanced mesh per hull design and side
  V3.shipKeys={};const SB=SCEN[id];
  const addShip=(key,geos)=>{const m=new THREE.InstancedMesh(geos.solid,new THREE.MeshLambertMaterial({vertexColors:true}),80);m.setColorAt(0,hx('#ffffff'));m.castShadow=true;m.frustumCulled=false;m.count=0;g.add(m);P['S:'+key]=m;
    if(geos.glow){const gm=new THREE.InstancedMesh(geos.glow,new THREE.MeshBasicMaterial({vertexColors:true,toneMapped:false}),80);gm.setColorAt(0,hx('#ffffff'));gm.frustumCulled=false;gm.count=0;g.add(gm);P['G:'+key]=gm}V3.shipKeys[key]=1};
  if(TH==='space'){for(const k of SHIP_KINDS)for(const fac of ['concord','ashen'])addShip(fac+'|'+k,shipGeos(fac,k))}
  if(TH==='sea'){const kinds=new Set(SB.player.concat(SB.enemy).map(u=>u.type));kinds.add('gen');
    for(const k of kinds){const era=v3navEra(k,SB);if(!era)continue;for(const side of ['P','E'])addShip('nav|'+era+'|'+k+'|'+side,navalGeos(era,k,side))}}
  // dusk/fog defaults
  V3.scene.fog=null;V3.dirty=false;v3fit();
}
function v3fit(){const el=V3.renderer?V3.renderer.domElement:null,w=el&&el.clientWidth||W,h=el&&el.clientHeight||H;const top=h<540?46:64,bot=h<540?96:(w<=700?190:150),he=Math.max(140,h-top-bot),a=w/he;
  V3.cam.tx=0;V3.cam.dist=Math.min(DMAX,Math.max(700,540/Math.tan(18*Math.PI/180)/Math.max(1,Math.min(a,1.9))*0.82+330));if(h<540&&w>h)V3.cam.dist=Math.max(640,V3.cam.dist*.7);V3.cam.tz=30+(bot-top)/h*V3.cam.dist*(w<h?.12:.42);V3.cam.yaw=V3.cam.yawT=0}
function v3clamp(){const c=V3.cam;c.dist=Math.max(DMIN,Math.min(DMAX,c.dist));c.tx=Math.max(-W/2,Math.min(W/2,c.tx));c.tz=Math.max(-H/2,Math.min(H/2,c.tz))}
function v3placeCamera(){
  const c=V3.cam;c.yaw+=(c.yawT-c.yaw)*0.18;
  const t=Math.min(1,(c.dist-DMIN)/(1120-DMIN)),pitch=0.52+t*0.72,cam=V3.camera,ty=G.b?heightAt(G.b.id,c.tx+W/2,c.tz+H/2)*0.8:0;
  cam.position.set(c.tx+Math.sin(c.yaw)*Math.cos(pitch)*c.dist,ty+Math.sin(pitch)*c.dist,c.tz+Math.cos(c.yaw)*Math.cos(pitch)*c.dist);
  const sk=(G.shake||0)*c.dist/900;cam.position.x+=(Math.random()-.5)*sk;cam.position.y+=(Math.random()-.5)*sk;cam.lookAt(c.tx,ty,c.tz);cam.updateMatrixWorld();
}
function v3resize(w,h){if(!V3.ok)return;V3.renderer.setSize(w,h,false);V3.camera.aspect=w/h;V3.camera.updateProjectionMatrix()}
function v3ground(clientX,clientY){
  const el=V3.renderer.domElement,r=el.getBoundingClientRect();
  const ndc=new THREE.Vector2((clientX-r.left)/r.width*2-1,-(clientY-r.top)/r.height*2+1);
  V3.ray.setFromCamera(ndc,V3.camera);const hit=V3.ray.intersectObject(V3.terrain,false)[0];
  if(hit)return{x:hit.point.x+W/2,y:hit.point.z+H/2};
  const o=V3.ray.ray.origin,d=V3.ray.ray.direction;if(Math.abs(d.y)<1e-6)return null;const k=-o.y/d.y;if(k<0)return null;
  return{x:o.x+d.x*k+W/2,y:o.z+d.z*k+H/2};
}
function v3project(x,y,hOff,cw,ch){
  const v=V3.tmp.v.set(x-W/2,heightAt(G.b.id,x,y)+(hOff||0),y-H/2);
  const cam=V3.camera;const vc=v.clone().applyMatrix4(cam.matrixWorldInverse);const depth=-vc.z;
  v.project(cam);
  return{x:(v.x+1)/2*cw,y:(1-v.y)/2*ch,s:(ch/2)/(Math.tan(cam.fov*Math.PI/360)*Math.max(1,depth)),vis:depth>1&&v.z<1};
}
/* figure parts per unit type: [part, x, y, z, sx, sy, sz, colorKey, rotX] in figure-local space (front = -z) */
function v3unitFigures(u,now,era){
  const T=u.type,S=ERA_COL[era][u.side],L=unitLayout(u),j=jitter(u),out=[];
  const engaged=u.contacts&&u.contacts.length>0,veh=VEH.has(T);
  const thin=V3.low&&L.cols*L.rows>14;
  for(let r=L.rows-1;r>=0;r--)for(let i=0;i<L.cols;i++){
    if(thin&&(r+i)%2)continue;
    const q=j[(r*L.cols+i)%j.length];
    let x=L.ox+i*L.sx+q.x*(T==='arc'||T==='minf'?2.6:T==='cav'||veh?1.6:0.9),y=L.oy+r*L.sy+q.y*(T==='arc'?2:1),bob=0;
    if(u.rout){x*=1.7;y=y*1.9+q.y*6}
    else if(engaged&&r<2&&!veh){x+=Math.sin(now*.03+q.p*3)*.6;y+=Math.cos(now*.027+q.p*2)*.6}
    else if(u.moving&&!veh)bob=Math.abs(Math.sin(now*.012+q.p))*.5;
    out.push({x,y,bob,front:r===0,q});
  }
  return out;
}
function v3render(now){
  const b=G.b,P=V3.P,tm=V3.tmp,era=b.s.era||'ancient';if(!P)return;
  for(const k in P)P[k].count=0;
  const put=(name,X,Y,Z,quat,sx,sy,sz,col)=>{const m=P[name];if(m.count>=m.instanceMatrix.count)return;tm.p.set(X,Y,Z);tm.s.set(sx,sy,sz);tm.m.compose(tm.p,quat,tm.s);m.setMatrixAt(m.count,tm.m);m.setColorAt(m.count,hx(col));m.count++};
  const fogHide=b.s.fog&&b.t<b.s.fog;
  const local=new THREE.Vector3(),qf=new THREE.Quaternion(),qt=new THREE.Quaternion(),qb=new THREE.Quaternion(),qx=new THREE.Quaternion();
  for(const u of b.units){
    if(u.gone)continue;
    const S=ERA_COL[era][u.side],T=u.type,th=-(u.facing+Math.PI/2);qf.setFromAxisAngle(tm.up,th);
    let tth=th;if((T==='tank'||T==='ifv'||T==='howz'||T==='sam')&&u.firing){tth=-(Math.atan2(u.firing.y-u.y,u.firing.x-u.x)+Math.PI/2)}qt.setFromAxisAngle(tm.up,tth);
    const figs=v3unitFigures(u,now,era),ca=Math.cos(u.facing+Math.PI/2),sa=Math.sin(u.facing+Math.PI/2);
    const side=u.side==='P'?'#4E8FE0':'#F08A3C';
    for(const f of figs){
      const wx=u.x+f.x*ca-f.y*sa,wy=u.y+f.x*sa+f.y*ca;if(wx<0||wx>W||wy<0||wy>H)continue;
      const h=(u.naval?0:heightAt(b.id,wx,wy))+(V3.roof&&!u.air&&!VEH.has(T)?roofAt(wx,wy):0)+(u.air?(T==='heli'?38:T==='lm'?20:T==='jet'?70:T==='dragon'?44:u.space?(T==='bship'||T==='scarrier'||T==='gen'?18:T==='sdd'?24:30):26)+Math.sin(now*.004+f.q.p)*2:0)+(T==='griffin'?14+Math.sin(now*.006+f.q.p)*2:0)+f.bob+(u.naval?(T==='sub'||T==='uboat'?-1.2:-.4)+Math.sin(now*.002+f.q.p+wx*.05)*.35:0),X=wx-W/2,Z=wy-H/2;
      const at=(lx,ly,lz,quat)=>{local.set(lx,ly,lz).applyQuaternion(quat||qf);return[X+local.x,h+local.y,Z+local.z]};
      if(v3extra(u,T,f,at,put,qf,qt,S,side,h,X,Z,now,era))continue;
      if(T==='cav'||T==='gen'){
        const hc=HORSE[f.q.h];put('horse',...at(0,2.7,0),qf,1,1,1,hc);put('hhead',...at(0,4.6,-2.4),qf,1,1,1,'#2a1d12');
        put('legs',...at(0,3.75,.2),qf,1.25,.6,1,S.tunic);put('body',...at(0,4.85,.2),qf,1,.82,1,S.tunic);put('head',...at(0,5.95,.2),qf,1,1,1,'#D9B48F');put('helm',...at(0,6.15,.2),qf,1,1,1,S.metal);
        if(T==='cav')put('pole',...at(1.1,5.2,-.6),qf,1,8,1,'#5a4630');
        continue;
      }
      if(T==='art'){qx.setFromAxisAngle(tm.ax,-Math.PI/2+0.12);qb.copy(qf).multiply(qx);
        put('barrel',...at(0,1.8,-1.4),qb,1,5.6,1,'#2c2a28');put('wheel',...at(-1.5,1.25,0),qf.clone().multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0,0,1),Math.PI/2)),1,1,1,'#4a3a28');
        put('wheel',...at(1.5,1.25,0),qf.clone().multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0,0,1),Math.PI/2)),1,1,1,'#4a3a28');
        for(const dx of [-2,2]){put('legs',...at(dx,.75,3.4),qf,1,1,1,'#2b2b2b');put('body',...at(dx,2.2,3.4),qf,1,1,1,S.tunic);put('head',...at(dx,3.7,3.4),qf,1,1,1,'#1c1c20')}
        continue;}
      if(T==='tank'||T==='ifv'||T==='howz'){
        const hl=T==='tank'?[5,1.9,8.2]:T==='ifv'?[4.4,2.3,7.2]:[4.6,2.1,7.6];
        put('hull',...at(0,hl[1]/2+.2,0),qf,hl[0],hl[1],hl[2],S.body);
        put('marker',...at(0,hl[1]+.45,hl[2]/2-1),qf,1.4,.35,1.2,side);
        if(T==='tank'){put('turret',...at(0,hl[1]+.9,.3,qt),qt,3.4,1.3,3.6,S.metal);qx.setFromAxisAngle(tm.ax,-Math.PI/2);qb.copy(qt).multiply(qx);local.set(0,0,-4.2).applyQuaternion(qt);put('barrel',X+local.x,h+hl[1]+1,Z+local.z,qb,.5,6.5,.5,'#24261f')}
        else if(T==='ifv'){put('turret',...at(0,hl[1]+.6,-.6,qt),qt,2,1,2.2,S.metal);qx.setFromAxisAngle(tm.ax,-Math.PI/2);qb.copy(qt).multiply(qx);local.set(0,0,-2.8).applyQuaternion(qt);put('barrel',X+local.x,h+hl[1]+.7,Z+local.z,qb,.25,3.6,.25,'#24261f')}
        else{qx.setFromAxisAngle(tm.ax,-Math.PI/2+0.6);qb.copy(qt).multiply(qx);local.set(0,0,-3.4).applyQuaternion(qt);put('barrel',X+local.x,h+hl[1]+2.6,Z+local.z,qb,.55,10,.55,'#2a2c25')}
        continue;}
      if(T==='heli'){const hh=h;put('hull',...at(0,0,0),qf,2.6,2.2,6,S.body);put('turret',...at(0,.4,4.6),qf,.6,.6,5,S.body);const qr=qf.clone().multiply(new THREE.Quaternion().setFromAxisAngle(tm.up,now*.03+f.q.p));put('turret',...at(0,1.5,0),qr,13,.15,.6,'#1a1a1a');put('marker',...at(0,1.25,-1),qf,1,.3,1,side);continue}
      if(T==='lm'){put('hull',...at(0,0,0),qf,1.8,.5,2.4,'#2a2a2a');put('marker',...at(0,.35,0),qf,.6,.2,.6,side);continue}
      if(T==='sam'||T==='ew'){put('hull',...at(0,1.2,0),qf,4.4,2,7,S.body);put('marker',...at(0,2.5,2.6),qf,1.4,.35,1.2,side);
        if(T==='sam'){qx.setFromAxisAngle(tm.ax,-0.75);qb.copy(qt).multiply(qx);put('turret',...at(0,3.4,-.5,qt),qb,3,1.6,4.6,S.metal)}
        else{put('pole',...at(0,5.5,.8),qf,1.2,7,1.2,'#2a2c22');put('turret',...at(0,9.2,.8),qf,2.6,1.6,.5,S.metal)}
        continue}
      if(T==='drone'){put('hull',...at(0,0,0),qf,1.4,.7,1.4,side);const qa=qf.clone().multiply(new THREE.Quaternion().setFromAxisAngle(tm.up,Math.PI/4)),qc=qf.clone().multiply(new THREE.Quaternion().setFromAxisAngle(tm.up,-Math.PI/4));
        put('turret',...at(0,0,0),qa,6,.35,.5,'#202020');put('turret',...at(0,0,0),qc,6,.35,.5,'#202020');continue}
      // foot soldier
      put('legs',...at(0,.75,0),qf,1,1,1,era==='modern'?S.head:'#2b2b2b');
      put('body',...at(0,2.15,0),qf,1,1,1,S.tunic);
      put('head',...at(0,3.75,0),qf,1,1,1,'#D9B48F');
      if(era!=='napoleon')put('helm',...at(0,3.95,0),qf,1,1,1,era==='modern'?S.head:(T==='arc'?'#7A5A36':S.metal));
      if(T==='line'){put('hat',...at(0,4.55,0),qf,1,1,1,'#18181c');put('pole',...at(.9,3.2,-.3),qf,1,6.2,1,'#3a2c20');put('legs',...at(0,2.3,-.62),qf,.9,.9,.12,S.hi)}
      else if(T==='arc'){put('pole',...at(.9,2.8,-.4),qf,1,4,1,'#8a6a3a')}
      else if(T==='minf'){put('pole',...at(.8,2.6,-.6),qf,.8,2.6,.8,'#1c1e18')}
      else if(T==='atgm'){qx.setFromAxisAngle(tm.ax,-Math.PI/2);qb.copy(qf).multiply(qx);put('barrel',...at(.7,3,-.4),qb,.55,3.4,.55,'#2b2e22')}
      else if(T==='shield'){if(f.front)put('shield',...at(0,2.3,-1.2),qf,1,1,1,S.shield);put('pole',...at(.9,3.4,-.3),qf,1,6.5,1,'#5a4630')}
      else{put('pole',...at(.9,3.4,-.3),qf,1,6.5,1,'#5a4630');if(T==='heavy')put('shield',...at(0,2.1,-1),qf,.8,.85,1,S.shield)}
    }
    if(T==='gen'&&!u.rout){const h=heightAt(b.id,u.x,u.y);put('flag',u.x-W/2,h+8,u.y-H/2,qf,.35,15,.35,'#2a2016');put('flag',u.x-W/2+2.6,h+13.5,u.y-H/2,qf,5,3.2,.25,'#D6A63A')}
  }
  for(const k in P){P[k].instanceMatrix.needsUpdate=true;if(P[k].instanceColor)P[k].instanceColor.needsUpdate=true}
  // light & atmosphere
  if(b.s.dusk&&b.s.timer){const t=Math.max(0,Math.min(1,(b.t/b.s.timer.t-.55)/.45));V3.sun.color.setRGB(1,.94-.3*t,.85-.5*t);V3.sun.intensity=.95-.45*t;V3.hemi.intensity=.78-.35*t}
  else{const pr=Math.max(0,Math.min(1,(G.turn||1)/20)),K=[[0,[1,.86,.7],.9],[.3,[1,.96,.88],1],[.7,[1,.84,.62],.92],[1,[1,.66,.58],.72]];
    let i=0;while(i<K.length-2&&pr>K[i+1][0])i++;const a0=K[i],a1=K[i+1],f=(pr-a0[0])/(a1[0]-a0[0]);
    V3.sun.color.setRGB(a0[1][0]+(a1[1][0]-a0[1][0])*f,a0[1][1]+(a1[1][1]-a0[1][1])*f,a0[1][2]+(a1[1][2]-a0[1][2])*f);V3.sun.intensity=a0[2]+(a1[2]-a0[2])*f;V3.hemi.intensity=.8-.22*pr}
  if(V3.theatre==='space'){V3.sun.color.setRGB(1,.97,.92);V3.sun.intensity=1.15;V3.hemi.intensity=.35}
  else if(V3.steam){V3.sun.color.setRGB(1,.78,.55);V3.sun.intensity=.82;V3.hemi.intensity=.62;V3.hemi.color.setRGB(1,.9,.78)}
  else if(era==='dread'){V3.sun.color.setRGB(.86,.9,.95);V3.sun.intensity=.72;V3.hemi.intensity=.7;V3.hemi.color.setRGB(.82,.88,.95)}
  else if(era==='magic'){V3.sun.color.setRGB(1,.82,.95);V3.hemi.color.setRGB(.85,.8,1)}
  if(b.s.fog){const k=Math.max(0,Math.min(1,(b.t-b.s.fog+4)/8));V3.scene.fog=new THREE.Fog(0xc9d0d4,1300+k*3000,3600+k*6000)}else V3.scene.fog=V3.steam?(V3.sfog||(V3.sfog=new THREE.Fog(0x5a4a3a,1500,4600))):era==='dread'?(V3.dfog||(V3.dfog=new THREE.Fog(0x8a96a0,1700,5200))):null;
  if(V3.stars)V3.stars.rotation.y=now*.000006;if(V3.water)V3.water.position.y=-2.4+Math.sin(now*.0012)*.25;
  if(V3.dirty){V3.mapTex.needsUpdate=true;V3.dirty=false}
  v3placeCamera();if(V3.post!==false){try{v3post()}catch(e){console.warn('post fx off',e);V3.post=false;V3.renderer.setRenderTarget(null);V3.renderer.render(V3.scene,V3.camera)}}else V3.renderer.render(V3.scene,V3.camera);
}
function roofAt(x,y){const R=V3.roof,i=Math.floor(x/R.C),j=Math.floor(y/R.C);if(i<0||j<0||i>=R.nx||j>=R.ny)return 0;return R.gr[j*R.nx+i]}
function v3decal(x,y,kind){
  const t=V3.mapCanvas&&V3.mapCanvas.getContext('2d');if(!t)return;const k=V3.mapCanvas.width/W;t.setTransform(k,0,0,k,0,0);
  if(kind==='crater'){t.fillStyle='rgba(30,26,22,.55)';t.beginPath();t.arc(x,y,2.5+Math.random()*2.5,0,7);t.fill();t.fillStyle='rgba(90,80,70,.25)';t.beginPath();t.arc(x,y,5+Math.random()*3,0,7);t.fill()}
  else{t.fillStyle=Math.random()<.5?'rgba(70,22,16,.5)':'rgba(40,34,28,.45)';t.beginPath();t.ellipse(x,y,1+Math.random()*1.4,.7+Math.random(),Math.random()*3,0,7);t.fill()}
  V3.dirty=true;
}

/* ---------- theatre environments ---------- */
function v3env(g,id,TH,STEAM){
  V3.stars=null;V3.water=null;const D=decor(id),tm=V3.tmp;
  if(TH==='space'){
    const n=3000,pos=new Float32Array(n*3),R=rng(77);for(let i=0;i<n;i++){const u=R()*2-1,a=R()*Math.PI*2,r=3200,k=Math.sqrt(1-u*u);pos[i*3]=Math.cos(a)*k*r;pos[i*3+1]=u*r;pos[i*3+2]=Math.sin(a)*k*r}
    const sg=new THREE.BufferGeometry();sg.setAttribute('position',new THREE.BufferAttribute(pos,3));const st=new THREE.Points(sg,new THREE.PointsMaterial({color:0xffffff,size:3,sizeAttenuation:false,toneMapped:false}));g.add(st);V3.stars=st;
    const gen=SCEN[id].gen,p=gen&&gen.planet;if(p){const pl=new THREE.Mesh(new THREE.SphereGeometry(520,48,32),new THREE.MeshLambertMaterial({color:p.hue<.5?0x3a6aa8:0xb0683a}));pl.position.set((p.x<500?-1:1)*1500,-700,-1700);g.add(pl);
      const at=new THREE.Mesh(new THREE.SphereGeometry(545,48,32),new THREE.MeshBasicMaterial({color:p.hue<.5?0x6fb0ff:0xffa060,transparent:true,opacity:.15,side:THREE.BackSide,toneMapped:false}));at.position.copy(pl.position);g.add(at)}
    if(D.rocks&&D.rocks.length){const rk=new THREE.InstancedMesh(new THREE.DodecahedronGeometry(1,0),new THREE.MeshLambertMaterial({color:0x8a8078}),D.rocks.length);
      D.rocks.forEach(([x,y,r,rot],i)=>{tm.p.set(x-W/2,8+Math.sin(rot*3)*10,y-H/2);tm.q.setFromEuler(new THREE.Euler(rot,rot*1.7,rot*.6));tm.s.set(r,r*.8,r*1.1);tm.m.compose(tm.p,tm.q,tm.s);rk.setMatrixAt(i,tm.m)});rk.castShadow=true;g.add(rk)}
  }
  if(D.crystals&&D.crystals.length){const cr=new THREE.InstancedMesh(new THREE.ConeGeometry(1,1,5),new THREE.MeshBasicMaterial({color:0xc68cff,toneMapped:false}),D.crystals.length);
    D.crystals.forEach(([x,y,r],i)=>{tm.p.set(x-W/2,heightAt(id,x,y)+r*1.3,y-H/2);tm.q.setFromEuler(new THREE.Euler(.15,i,.1));tm.s.set(r*.6,r*2.8,r*.6);tm.m.compose(tm.p,tm.q,tm.s);cr.setMatrixAt(i,tm.m)});g.add(cr)}
  if(STEAM&&V3.steamCity){const hs=D.houses.filter(h=>h[5]==='block');const R=rng(41);
    const ch=new THREE.InstancedMesh(new THREE.BoxGeometry(1,1,1),new THREE.MeshLambertMaterial({color:0x3a2a22}),hs.length*2);let k=0;
    const lamp=new THREE.InstancedMesh(new THREE.BoxGeometry(1,1,1),new THREE.MeshBasicMaterial({color:0xffc070,toneMapped:false}),hs.length*2);let n=0;
    for(const [x,y,w,d,a,kind,hh] of hs){const h=heightAt(id,x,y),wh=hh||10;
      for(let c=0;c<2;c++){if(R()<.4)continue;tm.p.set(x-W/2+(R()-.5)*w*.6,h+wh+2.4,y-H/2+(R()-.5)*d*.6);tm.q.identity();tm.s.set(1.4,4.4,1.4);tm.m.compose(tm.p,tm.q,tm.s);ch.setMatrixAt(k++,tm.m)}
      for(let c=0;c<2;c++){if(R()<.5)continue;const sd=R()<.5;tm.p.set(x-W/2+(sd?(R()-.5)*w*.7:(R()<.5?-1:1)*(w/2+.3)),h+wh*(.35+R()*.4),y-H/2+(sd?(R()<.5?-1:1)*(d/2+.3):(R()-.5)*d*.7));tm.q.identity();tm.s.set(sd?1.4:.3,1.6,sd?.3:1.4);tm.m.compose(tm.p,tm.q,tm.s);lamp.setMatrixAt(n++,tm.m)}}
    ch.count=k;lamp.count=n;ch.castShadow=true;g.add(ch,lamp)}
}
/* ---------- models for the new troop types ---------- */
const V3SEAGEN={sail:'sotl',galley:'hgalley',navy:'ddg',dread:'dread'};
function v3navEra(k,s){if(['dread','bcr','lcr','tbd','uboat'].includes(k))return 'dread';if(k==='gen'&&s.era==='dread')return 'dread';if(['galley','hgalley'].includes(k))return 'galley';if(['sotl','frigate'].includes(k))return 'sail';if(['ddg','ffg','sub','carrier','fac'].includes(k))return 'navy';if(k==='fireship'||k==='gen')return s.theme==='galley'?'galley':s.era==='navy'?'navy':'sail';return null}
function v3ship(u,T,put,qf,X,h,Z){
  const P=V3.P;let key;
  if(V3.theatre==='space'){const k=T==='gen'?'bship':T;key=(u.side==='P'?'concord':'ashen')+'|'+k}
  else if(V3.theatre==='sea'){const era=v3navEra(T,G.b.s);if(!era)return false;key='nav|'+era+'|'+T+'|'+u.side}
  if(!key||!P['S:'+key])return false;const sc=T==='gen'&&V3.theatre==='space'?1.45:1;
  put('S:'+key,X,h,Z,qf,sc,sc,sc,'#ffffff');if(P['G:'+key])put('G:'+key,X,h,Z,qf,sc,sc,sc,'#ffffff');return true}
function v3extra(u,T,f,at,put,qf,qt,S,side,h,X,Z,now,era){
  const th=V3.theatre;let M=T;
  if((th==='space'||th==='sea')&&v3ship(u,T,put,qf,X,h,Z))return true;
  if(T==='gen'){if(th==='sea')M=V3SEAGEN[era]||'sotl';else if(th==='space')M='bship';else if(era==='steam')M='cwalker';else return false}
  const t=TYPES[M]||(M==='cwalker'?{}:null);if(!t)return false;
  const sold=(sc,body,legs,head,helm,hat)=>{put('legs',...at(0,.75*sc,0),qf,sc,sc,sc,legs);put('body',...at(0,2.15*sc,0),qf,sc,sc,sc,body);put('head',...at(0,3.75*sc,0),qf,sc,sc,sc,head);if(helm)put('helm',...at(0,3.95*sc,0),qf,sc,sc,sc,helm);if(hat)put('cone',...at(0,4.6*sc,0),qf.clone().multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1,0,0),Math.PI/2)),.75*sc,.75*sc,2.2*sc,hat)};
  const upq=q=>q.clone().multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1,0,0),-Math.PI/2));
  // ---- wooden ships ----
  if(t.armor==='wood'){const len={galley:18,hgalley:22,sotl:26,frigate:21,fireship:14}[M],wid={galley:3.6,hgalley:4.6,sotl:6.4,frigate:5,fireship:3.4}[M];
    put('hull',...at(0,.9,0),qf,wid,2.4,len,'#5A3A20');put('hull',...at(0,2.15,0),qf,wid+.1,.6,len*.92,S.tunic);put('cone',...at(0,.9,-len/2-1.6),qf,wid*.5,1.2,3.4,'#4a3018');
    const masts=M==='sotl'?[-7,0,7]:M==='frigate'?[-4.5,4.5]:[0];const mh=M==='sotl'?20:M==='frigate'?16:M==='fireship'?9:11;
    for(const z of masts){put('pole',...at(0,mh/2+2,z),qf,1.4,mh,1.4,'#3a2a1a');put('sail',...at(0,mh*.5+2.5,z),qf,wid*1.9,mh*.42,.3,M==='galley'||M==='hgalley'?S.tunic:'#EDE6D2');if(mh>12)put('sail',...at(0,mh*.85+2.5,z),qf,wid*1.4,mh*.25,.3,'#EDE6D2')}
    put('sail',...at(1.6,mh+3.5,masts[0]),qf,3.2,1.6,.2,side);
    if(M==='galley'||M==='hgalley')for(let k=-3;k<=3;k++)for(const sd of [-1,1])put('wing',...at(sd*(wid/2+2),.7,k*len/8),qf,4,.25,.35,'#4a3018');
    if(M==='hgalley')for(let k=-2;k<=2;k++)put('shield',...at(wid/2+.2,2.6,k*3.2),qf.clone().multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0,1,0),Math.PI/2)),.7,.7,.7,S.shield);
    if(M==='fireship'&&!u.rout)for(let k=0;k<4;k++)put('glow',...at(Math.sin(now*.01+k)*1.2,3+k*1.6+Math.sin(now*.02+k)*.6,(k-1.5)*2.5),qf,1.6,2.4,1.6,k%2?'#FF8A20':'#FFD040');
    return true}
  // ---- modern warships ----
  if(t.armor==='hull'||t.armor==='sub'){
    if(M==='sub'){put('hull',...at(0,0,0),qf,2.8,2.2,22,'#1E2226');put('cone',...at(0,0,-12.5),qf,1.4,1.1,3,'#1E2226');put('hull',...at(0,2,-3),qf,1.3,2.6,3.6,'#23282c');put('glow',...at(0,3.4,-3),qf,1.4,.25,1.4,side);return true}
    if(M==='carrier'){put('hull',...at(0,1.4,0),qf,11,3,40,S.body);put('hull',...at(0,3.1,0),qf,13,.4,42,'#4a4e54');put('hull',...at(4.8,6,4),qf,2.4,5.6,7,S.metal);put('glow',...at(0,3.35,-6),qf,.3,.05,26,'#e8e8e0');
      for(let k=0;k<5;k++)put('wing',...at(-2.5+((k*3)%5),3.7,8+k*3.2),qf,4,.25,2,'#7a8290');put('glow',...at(4.8,9,4),qf,1.6,.4,1.6,side);return true}
    const len={ddg:26,ffg:21,fac:9}[M],wid={ddg:4.6,ffg:4,fac:2.4}[M];
    put('hull',...at(0,1.1,0),qf,wid,2.4,len,S.body);put('cone',...at(0,1.1,-len/2-2),qf,wid*.5,1.2,4,S.body);
    put('hull',...at(0,3.3,len*.08),qf,wid*.75,2.4,len*.28,S.metal);put('pole',...at(0,6.5,len*.08),qf,.5,5,.5,'#2a2c30');
    if(M!=='fac'){qt;put('turret',...at(0,2.8,-len*.32),qf,1.6,1,1.8,S.metal);put('barrel',...at(0,3,-len*.32-2),upq(qf),.35,3,.35,'#2a2c30')}
    if(M==='ddg'){put('hull',...at(0,2.5,-len*.18),qf,2.4,.3,2.4,'#3a3e44')}
    put('glow',...at(0,4.7,len*.08),qf,1.2,.3,1.2,side);return true}
  // ---- spacecraft ----
  if(t.space){const len={fighter:6,bomber:8,corvette:13,sdd:26,bship:36,scarrier:34}[M],wid={fighter:1.4,bomber:2.4,corvette:3.2,sdd:6,bship:9,scarrier:12}[M];
    const eng=side==='#4E8FE0'?'#7FC4FF':'#FF6A3A';
    put('hull',...at(0,0,len*.1),qf,wid,wid*.55,len*.8,S.body);put('cone',...at(0,0,-len*.45),qf,wid*.55,wid*.3,len*.35,S.body);
    if(M==='fighter'||M==='bomber'){put('wing',...at(0,0,len*.15),qf,wid*3.4,.18,len*.35,S.metal);put('glow',...at(0,0,len*.52),qf,wid*.6,wid*.3,.4,eng)}
    else{put('hull',...at(0,wid*.4,len*.15),qf,wid*.55,wid*.4,len*.35,S.metal);
      for(const sx of [-1,1])put('glow',...at(sx*wid*.25,0,len*.5+.3),qf,wid*.3,wid*.3,.6,eng);
      if(M==='sdd'||M==='bship'){for(const z of [-.2,.05,.3])put('turret',...at(0,wid*.38,len*z),qf,wid*.3,wid*.15,wid*.3,S.metal)}
      if(M==='scarrier')put('glow',...at(wid*.51,0,0),qf,.1,wid*.18,len*.5,'#FFD27A');
      put('glow',...at(0,wid*.62,len*.15),qf,wid*.15,.1,wid*.15,side)}
    return true}
  // ---- jets ----
  if(M==='jet'){put('hull',...at(0,0,0),qf,1.4,1.1,9,S.body);put('cone',...at(0,0,-5.6),qf,.7,.55,2.2,S.body);put('wing',...at(0,0,1),qf,10,.22,3,S.metal);put('wing',...at(0,1,4),qf,.22,2,1.6,S.metal);put('glow',...at(0,0,4.6),qf,.8,.6,.3,'#FFB060');return true}
  // ---- steampunk ----
  const rx=(q,a)=>q.clone().multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1,0,0),a));
  const brass='#C89B3C',soot='#3A3330';
  if(M==='fusil'){sold(1,S.tunic,'#2a2522','#E0B88E',null);put('hat',...at(0,4.55,0),qf,1,1.15,1,'#1D1F22');put('barrel',...at(0,2.5,.95),qf,.75,1.9,.75,brass);put('pole',...at(.85,3.1,-.7),rx(qf,-.35),.28,4.6,.28,'#5A3A20');put('pole',...at(.85,5.1,-1.45),rx(qf,-.35),.18,1.2,.18,brass);return true}
  if(M==='brawler'){sold(1.1,S.tunic,'#2a2522','#E0B88E','#3A3330');put('hull',...at(1.45,2.5,-.9),qf,1.2,1.2,2.4,brass);put('hull',...at(1.45,2.5,-2.2),qf,1.5,1.5,.9,'#8A6A26');put('barrel',...at(-.5,4.9,1),qf,.35,2.6,.35,soot);if(u.moving||u.firing)put('glow',...at(-.5,6.5,1),qf,.5,.5,.5,'#E8E0D0');return true}
  if(M==='tesla'){sold(1,S.tunic,'#2a2522','#E0B88E','#2A2D33');put('barrel',...at(0,3.1,1),qf,.7,2.8,.7,'#B8733A');put('orb',...at(0,4.9,1),qf,.38,.38,.38,'#BFE6FF');put('pole',...at(.85,2.8,-1.1),rx(qf,-.9),.24,3.4,.24,soot);put('glow',...at(.85,3.9,-2.6),qf,.4,.4,.4,u.firing?'#E8F6FF':'#9FD3FF');return true}
  if(M==='clock'){sold(1.35,brass,'#8A6A26','#A8822E',null);put('glow',...at(0,3.75*1.35,-.62),qf,.9,.15,.1,'#FFD27A');put('wing',...at(0,3*1.35,1.15),qf,1.6,.25,.25,'#8A6A26');put('wing',...at(0,3*1.35,1.15),qf,.25,1.6,.25,'#8A6A26');return true}
  if(M==='walker'||M==='cwalker'){const big=M==='cwalker',k=big?1.35:1,st=Math.sin(now*.01+f.q.p)*(u.moving?.7:0);
    const legs=big?[[-1.6,1.1],[1.6,1.1],[0,-1.6]]:[[-1.4,0],[1.4,0]];legs.forEach(([lx,lz],i)=>{const o=i%2?-st:st;put('hull',...at(lx*k,2.6*k+o,lz*k),qf,.9*k,5.2*k,.9*k,soot);put('hull',...at(lx*k,.3,lz*k-.4),qf,1.6*k,.6,2.2*k,'#2A2522')});
    put('hull',...at(0,6.6*k,0),qf,4.6*k,3.2*k,4.4*k,S.body);put('hull',...at(0,7.2*k,0),qf,4.7*k,.5*k,4.5*k,brass);put('barrel',...at(-1.1*k,9.4*k,1.2*k),qf,.55*k,2.6*k,.55*k,soot);
    put('glow',...at(-1.2*k,6.6*k,-2.25*k),qf,.9*k,.9*k,.1,'#FFCF73');put('barrel',...at(1.4*k,6.4*k,-2.6*k),rx(qt,-Math.PI/2),.5*k,4.4*k,.5*k,soot);
    if(big){put('helm',...at(0,8.4*k,0),qf,2.2,1.6,2.2,brass);put('pole',...at(2.4*k,11*k,1.6*k),qf,.3,9,.3,'#5A3A20');put('sail',...at(3.6*k,14*k,1.6*k),qf,2.6,2,.2,S.tunic);put('barrel',...at(-1.4*k,6.4*k,-2.6*k),rx(qt,-Math.PI/2),.5*k,4.4*k,.5*k,soot)}
    return true}
  if(M==='iclad'){put('hull',...at(0,3,0),qf,6.4,3.4,11,S.body);put('hull',...at(0,4.8,0),qf,6.6,.4,11.2,brass);put('cone',...at(0,2.6,-6.4),qf,2.6,1.6,2.4,S.body);
    const wq=qf.clone().multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0,0,1),Math.PI/2));for(const z of [-3.6,-1.2,1.2,3.6])for(const sx of [-1,1])put('wheel',...at(sx*3.5,1.6,z),wq,1.3,1.2,1.3,'#2A2522');
    put('turret',...at(0,6,-1,qt),qt,3.6,1.8,3.8,'#1D3358');    {const p=new THREE.Vector3(0,0,-5.6).applyQuaternion(qt);put('barrel',X+p.x,h+6.2,Z+p.z,rx(qt,-Math.PI/2),.6,7.4,.6,soot)}
    put('barrel',...at(-1.6,7.4,3.6),qf,.6,4.4,.6,soot);put('barrel',...at(-.2,7,4),qf,.6,3.8,.6,soot);if(u.moving||u.firing)put('glow',...at(-1.6,9.8,3.6),qf,.8,.6,.8,'#E8E0D0');return true}
  if(M==='zep'){const bob=Math.sin(now*.002+f.q.p)*.6;put('head',...at(0,6+bob,0),qf,5.2,5.2,17,'#E2D6BC');put('hull',...at(0,6+bob,0),qf,6.6,.5,18,S.tunic);
    for(const [a,b2] of [[1,0],[0,1]])put('wing',...at(0,6+bob,8.8),qf,a?6:.25,b2?6:.25,2.6,S.tunic);
    put('hull',...at(0,1.2+bob,-.5),qf,2.2,1.6,6,'#6A5640');put('glow',...at(1.12,1.3+bob,-.5),qf,.1,.6,4.4,'#FFCF73');put('glow',...at(-1.12,1.3+bob,-.5),qf,.1,.6,4.4,'#FFCF73');
    const pq=qf.clone().multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0,0,1),now*.02));put('wing',...at(0,1.2+bob,3),pq,3,.2,.2,'#2A2522');return true}
  if(M==='orni'){const fl=Math.sin(now*.03+f.q.p)*.8;put('hull',...at(0,0,0),qf,1.1,1,4.6,S.tunic);put('cone',...at(0,0,2.8),rx(qf,Math.PI),.5,.5,1.6,S.tunic);put('head',...at(0,.9,-.8),qf,1,1,1,'#E0B88E');
    for(const sx of [-1,1]){const qw=qf.clone().multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0,0,1),sx*fl));const lp=at(sx*3.2,.6,0);put('wing',lp[0],lp[1],lp[2],qw,6,.15,2.4,'#E2D6BC')}
    put('glow',...at(0,.2,-2.4),qf,.3,.3,.3,brass);return true}
  // ---- modern support ----
  if(M==='recon'){put('hull',...at(0,1.1,0),qf,3.6,1.8,5.6,S.body);put('turret',...at(0,2.4,.4),qf,1.2,.7,1.2,S.metal);put('pole',...at(0,4.2,1.6),qf,.25,3.4,.25,'#222');put('marker',...at(0,2.1,2.2),qf,1,.3,.8,side);return true}
  if(M==='mlrs'){put('hull',...at(0,1.1,0),qf,3.8,2,7,S.body);put('hull',...at(0,2.6,-2.6),qf,3.4,1.6,1.8,S.metal);const ql=qt.clone().multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1,0,0),.45));put('turret',...at(0,3.6,1.4),ql,3.2,1.8,4.2,'#3a3e34');put('marker',...at(0,2.2,3),qf,1,.3,.8,side);return true}
  if(M==='mortar'||M==='manpads'||M==='sniper'){sold(1,S.tunic,S.head,'#D9B48F',S.head);
    if(M==='mortar')put('barrel',...at(.4,1.4,-1.2),qf.clone().multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1,0,0),-.5)),.45,2.6,.45,'#24261f');
    else if(M==='manpads')put('barrel',...at(.8,3.6,0),qf.clone().multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1,0,0),-1.1)),.4,3.2,.4,'#2b2e22');
    else put('barrel',...at(.6,2.4,-1.4),upq(qf),.18,3.4,.18,'#1a1a1a');return true}
  // ---- magic ----
  if(M==='mage'){put('body',...at(0,1.4,0),qf,1.15,1.6,1.15,S.tunic);put('body',...at(0,2.7,0),qf,.9,.8,.9,S.tunic);put('head',...at(0,3.9,0),qf,1,1,1,S.head);put('cone',...at(0,4.9,0),qf.clone().multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1,0,0),Math.PI/2)),.8,.8,2.6,S.tunic);
    put('pole',...at(1,3,-.4),qf,.3,6,.3,'#5a4630');put('orb',...at(1,6.3,-.4),qf,.55+Math.sin(now*.008+f.q.p)*.12,.55,.55,side==='#4E8FE0'?'#8FD0FF':'#E070FF');return true}
  if(M==='elf'){sold(.95,'#2E5A34','#2a3a22','#E8D2B0',null,'#3a6a3a');put('pole',...at(.9,2.8,-.4),qf,.6,4.6,.6,'#c8b080');put('glow',...at(-.9,2.4,0),qf,.12,.9,.12,S.hi);return true}
  if(M==='undead'){sold(1,'#C8C2B0','#9a9488','#DCD6C4',null);if(f.front)put('pole',...at(.9,3.2,-.3),qf,.8,5.5,.8,'#4a4238');put('glow',...at(0,3.8,-.6),qf,.7,.12,.1,'#7CFFB0');return true}
  if(M==='golem'){sold(2.3,'#7A7670','#5E5A54','#8E8A82',null);put('glow',...at(0,3.75*2.3,-1.3),qf,1.6,.25,.1,side==='#4E8FE0'?'#7FC4FF':'#FF8A3A');return true}
  if(M==='dragon'){const fl=Math.sin(now*.008+f.q.p)*.6,body=u.side==='P'?'#3E6AB0':'#8E2A22',wing=u.side==='P'?'#2A4A80':'#5E1A14';
    put('hull',...at(0,0,0),qf,3.6,3.2,11,body);put('cone',...at(0,1.4,-8),qf,1.6,1.6,5,body);put('hull',...at(0,2.2,-10.6),qf,1.8,1.6,3,body);put('cone',...at(0,.4,9),qf.clone().multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0,1,0),Math.PI)),1.2,1,8,body);
    for(const sx of [-1,1]){const qw=qf.clone().multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0,0,1),sx*fl));const lp=at(sx*5.5*Math.cos(fl),1+Math.abs(Math.sin(fl))*4,-1);put('wing',lp[0],lp[1],lp[2],qw,11,.3,7,wing)}
    if(u.firing)put('glow',...at(0,1.6,-14),qf,1.6,1.6,4,'#FF9A30');return true}
  if(M==='griffin'){const fl=Math.sin(now*.012+f.q.p)*.7;put('horse',...at(0,2.7,0),qf,1,1,1,'#C8A060');put('body',...at(0,4.85,.2),qf,1,.82,1,S.tunic);put('head',...at(0,5.95,.2),qf,1,1,1,'#D9B48F');put('helm',...at(0,6.15,.2),qf,1,1,1,S.metal);
    for(const sx of [-1,1]){const qw=qf.clone().multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0,0,1),sx*fl));const lp=at(sx*3.6,4.4,0);put('wing',lp[0],lp[1],lp[2],qw,6.5,.25,3.4,'#E8E0C8')}return true}
  return false;
}

/* ---------- game: flow, overlay, input, orders ---------- */
const $=id=>document.getElementById(id);
const css=getComputedStyle(document.documentElement);
const tok=(n,f)=>css.getPropertyValue(n).trim()||f;
const C={blue:tok('--blue','#6FA8E6'),red:tok('--red','#E25A4A'),brass:tok('--brass','#D6A63A'),good:'#86C47E'};
const ERA_NAME={glasssky:'21st century',cannae:'Antiquity',agincourt:'Middle Ages',hastings:'Middle Ages',austerlitz:'Napoleonic',ironbridge:'21st century'};
const cv=$('cv'),ctx=cv.getContext('2d'),cv3=$('cv3'),ov=$('ov'),oc=ov.getContext('2d');
const terrainCv=document.createElement('canvas'),decalCv=document.createElement('canvas');
const TURNS=[4,6,9],TURN_NAME={4:'Short',6:'Normal',9:'Long'},PLAYBACK=2.6;
const G={pop:{},shake:0,turnLen:6,turn:0,turnLeft:0,cam:{x:0,y:0,z:1},view:'3d',floats:[],hits:[],q:null,ptrs:new Map(),pan:null,pinch:null,space:false,b:null,id:null,mode:'menu',speed:1,sel:new Set(),inspect:null,acc:0,last:performance.now(),hover:null,drag:null,pings:[],cssW:0,cssH:0,toastEls:[],diff:'normal'};
try{G.turnLen=+localStorage.getItem('fc-turn');if(!TURNS.includes(G.turnLen))G.turnLen=6;G.diff=localStorage.getItem('fc-diff')||'normal';G.view=localStorage.getItem('fc-view')||'3d'}catch(e){}
const fmt=n=>n>=1000?(n/1000).toFixed(n>=10000?0:1)+'k':String(Math.round(n));
const fmtFull=n=>Math.round(n).toLocaleString('en-US');
const strength=u=>{const T=TYPES[u.type];return T.per?`${Math.max(0,Math.ceil(u.men/T.per))} ${T.unit}`:fmtFull(u.men)};
const T0=u=>{const T=TYPES[u.type];return T.per?`${Math.ceil(u.maxMen/T.per)} ${T.unit}`:fmtFull(u.maxMen)};
const strengthShort=u=>{const T=TYPES[u.type];return T.per?`${Math.max(0,Math.ceil(u.men/T.per))}`:fmt(u.men)};
const era=()=>G.b?(G.b.s.era||'ancient'):'ancient';
const has3d=()=>V3.ok;
/* real distance: map units times the era's scale */
const mtr=v=>{const m=v*mPer(G.b?G.b.s.era:'');return m>=1000?(m/1000).toFixed(m>=10000?0:1)+' km':Math.round(m/(m>=200?10:1))*(m>=200?10:1)+' m'};

/* ----- sound ----- */
const SND={ctx:null,on:true,last:{}};
try{SND.on=localStorage.getItem('fc-sound')!=='off'}catch(e){}
function sndInit(){if(SND.ctx)return;try{const A=window.AudioContext||window.webkitAudioContext;if(!A)return;const c=new A(),len=c.sampleRate;const buf=c.createBuffer(1,len,c.sampleRate),d=buf.getChannelData(0);for(let i=0;i<len;i++)d[i]=Math.random()*2-1;SND.ctx=c;SND.noise=buf;SND.master=c.createGain();SND.master.gain.value=.45;SND.master.connect(c.destination)}catch(e){}}
const SRATE={click:.02,tok:.03,thud:.05,stamp:.2,bell:.5,volley:.18,boom:.22,arrow:.25,rifle:.09,clash:.28,order:.08,horn:1,tank:.3};
function snd(kind,vol){
  const c=SND.ctx;if(!SND.on||!c||c.state!=='running')return;const now=c.currentTime;if(SND.last[kind]&&now-SND.last[kind]<SRATE[kind])return;SND.last[kind]=now;vol=vol==null?1:vol;
  const burst=(t0,dur,type,freq,q,peak)=>{const s=c.createBufferSource();s.buffer=SND.noise;const f=c.createBiquadFilter();f.type=type;f.frequency.value=freq;f.Q.value=q;const g=c.createGain();g.gain.setValueAtTime(0,t0);g.gain.linearRampToValueAtTime(peak*vol,t0+.006);g.gain.exponentialRampToValueAtTime(.0008,t0+dur);s.connect(f).connect(g).connect(SND.master);s.start(t0,Math.random()*.5);s.stop(t0+dur+.05)};
  const tone=(t0,dur,f0,f1,type,peak)=>{const o=c.createOscillator();o.type=type;o.frequency.setValueAtTime(f0,t0);o.frequency.exponentialRampToValueAtTime(f1,t0+dur);const g=c.createGain();g.gain.setValueAtTime(peak*vol,t0);g.gain.exponentialRampToValueAtTime(.0008,t0+dur);o.connect(g).connect(SND.master);o.start(t0);o.stop(t0+dur+.05)};
  switch(kind){
    case 'volley':for(let i=0;i<6;i++)burst(now+Math.random()*.25,.28,'bandpass',1400+Math.random()*900,.8,.22);break;
    case 'boom':burst(now,1.3,'lowpass',220,.7,.9);tone(now,.6,70,32,'sine',.5);break;
    case 'tank':burst(now,.7,'lowpass',500,.7,.8);tone(now,.4,90,40,'sine',.35);break;
    case 'arrow':burst(now,.35,'highpass',2600,.5,.07);break;
    case 'rifle':for(let i=0;i<3;i++)burst(now+Math.random()*.15,.07,'bandpass',2600,1.2,.18);break;
    case 'clash':for(let i=0;i<3;i++)burst(now+Math.random()*.2,.12,'bandpass',3600+Math.random()*1200,9,.12);break;
    case 'order':tone(now,.09,180,120,'triangle',.18);break;
    case 'click':burst(now,.025,'highpass',2400,.9,.35*vol);tone(now,.05,190,90,'square',.07*vol);burst(now+.045,.02,'bandpass',3200,2,.12*vol);break;
    case 'tok':tone(now,.06,1100,700,'sine',.16);burst(now,.03,'highpass',3000,.7,.08);break;
    case 'thud':tone(now,.2,120,55,'sine',.5);burst(now,.12,'lowpass',400,.7,.35);break;
    case 'stamp':burst(now,.3,'lowpass',260,.8,.7);tone(now,.25,90,45,'sine',.5);for(let i=0;i<4;i++)tone(now+.06+i*.07,.08,140,90,'triangle',.14);break;
    case 'bell':tone(now,1.4,880,870,'sine',.12);tone(now,1.1,1320,1310,'sine',.06);tone(now,.9,1760,1750,'sine',.03);break;
    case 'horn':tone(now,.5,220,330,'sawtooth',.08);tone(now+.45,.6,330,330,'sawtooth',.07);break;
  }
}

/* ----- menu: tabs, age filters, compact battle cards ----- */
const MENU_GRP=[['ancient','Antiquity'],['medieval','Middle Ages'],['gunpowder','Gunpowder'],['naval','At sea'],['modern','Modern'],['steam','Steampunk'],['scifi','Sci-fi'],['fantasy','Fantasy']];
function setTab(t){document.querySelectorAll('.mtabs [data-tab]').forEach(b=>b.setAttribute('aria-selected',b.dataset.tab===t?'true':'false'));document.querySelectorAll('.mpanel').forEach(p=>p.hidden=p.dataset.panel!==t);try{localStorage.setItem('fc-tab',t)}catch(e){}if(t==='battles')drawThumbs();if(t==='editor'&&typeof edMenuNote==='function')edMenuNote()}
function setFilter(f){G.filter=f;document.querySelectorAll('#filters button').forEach(b=>b.setAttribute('aria-pressed',b.dataset.f===f?'true':'false'));
  document.querySelectorAll('#cards .card').forEach(el=>el.hidden=f!=='all'&&el.dataset.group!==f);document.querySelectorAll('#cards .grp').forEach(el=>el.hidden=f!=='all');try{localStorage.setItem('fc-filter',f)}catch(e){}drawThumbs()}
function buildMenu(){
  const box=$('cards');box.innerHTML='';
  const DEF={cannae:'ancient',agincourt:'medieval',hastings:'medieval',austerlitz:'gunpowder',ironbridge:'modern',glasssky:'modern'};
  const ids=Object.keys(SCEN).filter(id=>!SCEN[id].endless&&!SCEN[id].mirror&&!SCEN[id].custom);ids.forEach(id=>{SCEN[id].group=SCEN[id].group||DEF[id]||'modern'});
  const fb=$('filters');fb.innerHTML='';const mk=(f,label,n)=>{const b=document.createElement('button');b.type='button';b.className='fchip';b.dataset.f=f;b.innerHTML=`${label} <small>${n}</small>`;b.onclick=()=>setFilter(f);fb.appendChild(b)};
  mk('all','All',ids.length);
  for(const [g,label] of MENU_GRP){const list=ids.filter(id=>SCEN[id].group===g);if(!list.length)continue;mk(g,label,list.length);
    for(const id of list){const s=SCEN[id],p=s.player.reduce((a,u)=>a+u.men,0),e=s.enemy.reduce((a,u)=>a+u.men,0);
      const el=document.createElement('article');el.className='card';el.dataset.group=g;el.title=s.teaser||'';
      el.innerHTML=`<span class="etag">${label}</span><canvas class="thumb" data-id="${id}" aria-hidden="true"></canvas><div class="cardtop"><span class="yr">${s.year}</span><span class="chip">${s.diff||''}</span></div><h2>${s.name}</h2><div class="meta">${s.sides[0]} <i>vs</i> ${s.sides[1]}</div><p class="teaser">${s.teaser||''}</p>
        <div class="odds"><div class="bar"><i style="width:${p/(p+e)*100}%;background:var(--blue)"></i><i style="flex:1;background:var(--red)"></i></div><span class="you">You: ${s.you}</span></div>
        <div class="foot"><button class="primary" type="button">Take command</button></div>`;
      el.querySelector('button').onclick=e2=>{e2.stopPropagation();start(id)};el.onclick=()=>{if(!el.classList.contains('locked'))start(id)};
      box.appendChild(el)}}
  document.querySelectorAll('[data-diff]').forEach(b=>{b.classList.toggle('on',b.dataset.diff===G.diff);b.onclick=()=>{G.diff=b.dataset.diff;try{localStorage.setItem('fc-diff',G.diff)}catch(e){}document.querySelectorAll('[data-diff]').forEach(x=>x.classList.toggle('on',x.dataset.diff===G.diff))}});
  document.querySelectorAll('.mtabs [data-tab]').forEach(b=>b.onclick=()=>setTab(b.dataset.tab));
  let f='all',t='battles';try{f=localStorage.getItem('fc-filter')||'all';t=localStorage.getItem('fc-tab')||'battles'}catch(e){}
  if(f!=='all'&&!ids.some(id=>SCEN[id].group===f))f='all';setFilter(f);setTab(t);
}
function drawThumbs(){
  document.querySelectorAll('canvas.thumb').forEach(c=>{
    const w=c.clientWidth;if(!w||c.dataset.drawn==w)return;c.dataset.drawn=w;const dpr=Math.min(2,window.devicePixelRatio||1);
    c.width=Math.round(w*dpr);c.height=Math.round(w*H/W*dpr);
    const t=c.getContext('2d'),k=c.width/W,id=c.dataset.id;drawScene(t,k,id,'2d');
    t.setTransform(k,0,0,k,0,0);const b=makeBattle(id);for(const u of b.units)drawUnit(t,u,false,0,SCEN[id].era||'ancient');
  });
}
function buildLegend(types){
  const box=$('legend');box.innerHTML='';
  for(const t of types){
    const row=document.createElement('div');row.className='lg';
    const tx=document.createElement('div');tx.innerHTML=`<b>${TYPES[t].label}<i>${chessOf(t)} ${CHESS_NAME[ROLE[t]]} · ${ROLE_NAME[ROLE[t]]}</i></b><span class="ch">${CHESS_NAME[ROLE[t]]}: ${CHESS_WHY[ROLE[t]]}</span><span class="bt"><em>Beats</em> ${BEATS[t]}</span><span class="ft"><em>Fears</em> ${FEARS[t]}</span>`;
    row.append(badgeCanvas(t,null,30,'P'),tx);box.appendChild(row);
  }
}

/* ----- flow ----- */
const ACK={move:'Forward!',attack:'Engage!',charge:'Charge!'};
const myGeneral=()=>G.b&&G.b.units.find(u=>u.side==='P'&&u.type==='gen'&&!u.gone);
const selUnits=()=>[...G.sel].map(id=>byId(G.b,id)).filter(u=>u&&!u.gone&&!u.rout);
function ack(u,text){G.floats=G.floats.filter(f=>f.id!==u.id);G.floats.push({id:u.id,text,life:1.6})}
function themeOf(s,id){return s.theme||{cannae:'ancient',agincourt:'medieval',hastings:'medieval',austerlitz:'napoleon',ironbridge:'modern',glasssky:'modern'}[id]||({ancient:'ancient',napoleon:'napoleon',modern:'modern'})[s.era]||'modern'}
function start(id){if(!G.netKeep)G.net=null;document.body.className=document.body.className.replace(/\bth-\S+/g,'').trim();document.body.classList.add('th-'+themeOf(SCEN[id],id));if(!String(id).startsWith('mirror_'))G.daily=false;$('stamp').hidden=true;document.body.classList.add('ingame');
  sndInit();
  G.id=id;G.b=makeBattle(id,G.diff);applyMini();G.q=null;G.hits=[];G.ff=false;G.casE=0;G.casP=0;{const s0=G.b.s,nm=s0.mirror||s0.endless||!['cannae','agincourt','hastings','austerlitz','bannockburn','salamis','trafalgar'].includes(id)?s0.name:'Battle of '+s0.name;$('plate').innerHTML=`${nm.replace(/[<>&]/g,'')}<span>${s0.year}</span>`;$('cas-l').textContent=`${s0.sides[1]} losses vs ${s0.sides[0]} losses`;$('caption').hidden=true}G.mode='deploy';G.turn=0;G.snap=null;G.stats=newStats();G.undo=[];G.pwLast=null;G.tscale=1;G.roundRouts=0;$('report').hidden=true;G.sel.clear();G.inspect=null;G.acc=0;G.pings=[];G.floats=[];G.cam={x:0,y:0,z:1};G.flankT={};
  $('toasts').innerHTML='';G.toastEls=[];
  const s=G.b.s;
  $('g-name').textContent=s.name;$('g-year').textContent=s.year+' · '+s.place+(G.diff==='normal'?'':' · Historical');
  $('g-pside').textContent=s.sides[0];$('g-eside').textContent=s.sides[1];
  $('p-obj').textContent=s.objective+(s.timer?` (${Math.floor(s.timer.t/60)}:${String(s.timer.t%60).padStart(2,'0')})`:'');
  $('p-brief').innerHTML=s.brief.map(t=>`<li>${t}</li>`).join('');
  const types=[...new Set(G.b.units.map(u=>u.type))];buildLegend(types.sort((a,c)=>(a==='gen'?-1:0)-(c==='gen'?-1:0)));
  document.querySelector('[data-cmd="rally"] span').textContent=s.era==='modern'?'Steady':'Rally';
  document.querySelector('[data-cmd="charge"] span').textContent=s.era==='modern'?'Assault':'Charge';
  $('menu').hidden=true;$('muster').hidden=true;$('game').hidden=false;$('ov-end').hidden=true;$('ov-deploy').hidden=false;$('stage').classList.remove('paused');
  $('b-pause').textContent='Pause';
  if(has3d()){v3build(id)}
  setView(has3d()?G.view:'2d');
  buildRoster();labelGroups();resize();updateHud();updatePanel();updateCmds();updateTurnUI();
  window.scrollTo({top:0});
}
function toMenu(){document.body.className=document.body.className.replace(/\bth-\S+/g,'').trim();document.body.classList.remove('ingame');document.body.classList.remove('show-info');G.mode='menu';G.daily=false;$('game').hidden=true;$('muster').hidden=true;$('menu').hidden=false;buildEndlessMenu();drawThumbs();refreshMeta();window.scrollTo({top:0})}
function buildMirrorMenu(){
  const box=$('mirror-eras');if(!box)return;box.innerHTML='';
  for(const k of Object.keys(MIRROR)){const r=ROSTER[k],b=document.createElement('button');b.type='button';b.className='eracard';
    const types=[...new Set(MIRROR[k].map(key=>rosterEntry(k,key).type))];
    b.innerHTML=`<span class="er-n">${r.label}</span><span class="er-b"></span><span class="er-r">${MIRROR[k].length} units each side</span>`;
    const row=b.querySelector('.er-b');types.slice(0,7).forEach(t=>row.appendChild(badgeCanvas(t,null,26,'P')));
    b.onclick=()=>{sndInit();snd('stamp');G.daily=false;start(buildMirrorScenario(k))};box.appendChild(b)}
  const row=$('net-row');if(row){row.innerHTML='<span class="nl">Play a friend online</span>';for(const k of Object.keys(MIRROR)){const bt=document.createElement('button');bt.type='button';bt.textContent=ROSTER[k].label;bt.onclick=()=>{sndInit();netHost(k)};row.appendChild(bt)}}
}
function buildEndlessMenu(){buildMirrorMenu();
  const box=$('eras');box.innerHTML='';
  for(const k of Object.keys(ROSTER)){const r=ROSTER[k],b=document.createElement('button');b.type='button';b.className='eracard';
    const types=[...new Set(r.units.map(u=>u.type))];
    b.innerHTML=`<span class="er-n">${r.label}</span><span class="er-b"></span><span class="er-r">Best run: ${bestRecord(k)} victor${bestRecord(k)===1?'y':'ies'}</span>`;
    const row=b.querySelector('.er-b');types.slice(0,6).forEach(t=>row.appendChild(badgeCanvas(t,null,26,'P')));
    b.onclick=()=>{sndInit();snd('stamp');newCampaign(k)};box.appendChild(b)}
  $('continue-camp').hidden=!G.camp;$('continue-camp').onclick=()=>openMuster();
}
function setView(v){
  if(v==='3d'&&!has3d())v='2d';G.view=v;try{localStorage.setItem('fc-view',v)}catch(e){}
  cv.hidden=v!=='2d';cv3.hidden=v!=='3d';$('v-toggle').textContent=v==='3d'?'2D':'3D';if(G.b)fitView();
  document.querySelectorAll('.rot').forEach(b=>b.hidden=v!=='3d');
}
function resize(){if(G.b&&$('mini'))setTimeout(applyMini,0);
  const st=$('stage'),r=st.getBoundingClientRect(),w=Math.max(200,r.width),h=Math.max(160,r.height||w*H/W),dpr=Math.min(V3.low?1.5:2,window.devicePixelRatio||1);G.cssW=w;G.cssH=h;
  for(const c of [cv,ov]){c.width=Math.round(w*dpr);c.height=Math.round(h*dpr)}
  const tw=Math.min(3200,Math.max(cv.width,cv.height*W/H)*1.6);terrainCv.width=Math.round(tw);terrainCv.height=Math.round(tw*H/W);if(!decalCv.width||Math.abs(decalCv.width-Math.round(tw/1.6))>40){decalCv.width=Math.round(tw/1.6);decalCv.height=Math.round(tw/1.6*H/W)}
  if(G.b){drawScene(terrainCv.getContext('2d'),terrainCv.width/W,G.b.id,'2d')}
  if(has3d())v3resize(w,h);
  clamp2d();
}

/* ----- view abstraction (2D map or 3D) ----- */
const base2d=()=>Math.min(G.cssW/W,G.cssH/H)*0.94;
const view2d=()=>{const s=base2d()*G.cam.z;return{w:G.cssW/s,h:G.cssH/s}};
function clamp2d(){const c=G.cam;c.z=Math.max(1,Math.min(4,c.z));const v=view2d();c.x=v.w>=W?(W-v.w)/2:Math.max(0,Math.min(W-v.w,c.x));c.y=v.h>=H?(H-v.h)/2-v.h*.02:Math.max(0,Math.min(H-v.h,c.y))}
function vToWorld(e){
  if(G.view==='3d')return v3ground(e.clientX,e.clientY);
  const r=ov.getBoundingClientRect(),s=base2d()*G.cam.z;return{x:G.cam.x+(e.clientX-r.left)/s,y:G.cam.y+(e.clientY-r.top)/s};
}
function P(x,y,h){
  if(G.view==='3d')return v3project(x,y,h,G.cssW,G.cssH);
  const s=base2d()*G.cam.z;return{x:(x-G.cam.x)*s,y:(y-G.cam.y)*s-(h||0)*s*.45,s,vis:true};
}
function zoomBy(f,X,Y){
  if(G.view==='3d'){const r=ov.getBoundingClientRect(),cx=r.left+X,cy=r.top+Y,a=v3ground(cx,cy);V3.cam.dist*=1/f;v3clamp();v3placeCamera();const b2=v3ground(cx,cy);if(a&&b2){V3.cam.tx+=a.x-b2.x;V3.cam.tz+=a.y-b2.y;v3clamp()}return}
  const c=G.cam,s0=base2d()*c.z,wx=c.x+X/s0,wy=c.y+Y/s0;c.z=Math.max(1,Math.min(3,c.z*f));const s1=base2d()*c.z;c.x=wx-X/s1;c.y=wy-Y/s1;clamp2d();
}
function panBy(dx,dy){
  if(G.view==='3d'){const c=V3.cam,p=v3project(c.tx+W/2,c.tz+H/2,0,G.cssW,G.cssH),k=1/Math.max(.05,p.s);
    const rx=Math.cos(c.yaw),rz=-Math.sin(c.yaw),fx=-Math.sin(c.yaw),fz=-Math.cos(c.yaw);
    c.tx+=-dx*k*rx+dy*k*fx;c.tz+=-dx*k*rz+dy*k*fz;v3clamp();return}
  const s=base2d()*G.cam.z;G.cam.x-=dx/s;G.cam.y-=dy/s;clamp2d();
}
/* minimap: the whole field, units as bars in side colours, the camera as a white frame */
function miniBg(){const id=G.id;if(G.miniId===id&&G.miniC)return G.miniC;const c=document.createElement('canvas'),w=420,h=Math.round(420*H/W);c.width=w;c.height=h;try{drawScene(c.getContext('2d'),w/W,id,'2d')}catch(e){}G.miniId=id;G.miniC=c;return c}
function miniOn(){let v=null;try{v=localStorage.getItem('fc-mini')}catch(e){}return v==null?!(G.cssW<760||G.cssH<540):v==='1'}
function setMini(on){try{localStorage.setItem('fc-mini',on?'1':'0')}catch(e){}applyMini()}
function applyMini(){const on=!!G.b&&miniOn();$('mini').hidden=!on;document.body.classList.toggle('has-mini',on);$('m-toggle').setAttribute('aria-pressed',on?'true':'false')}
function miniGround(x,y,ov){for(let k=0;k<40;k++){const p=v3ground(x,y);if(p)return p;y+=(ov.bottom-ov.top)/40}return null}
function drawMini(){const el=$('mini'),b=G.b;if(!el||el.hidden||!b)return;const r=el.getBoundingClientRect();if(!r.width)return;const dpr=Math.min(2,window.devicePixelRatio||1),w=Math.round(r.width*dpr),h=Math.round(r.height*dpr);if(el.width!==w||el.height!==h){el.width=w;el.height=h}
  const c=el.getContext('2d'),k=w/W,ky=h/H;c.setTransform(1,0,0,1,0,0);c.drawImage(miniBg(),0,0,w,h);c.fillStyle='rgba(8,10,12,.22)';c.fillRect(0,0,w,h);const now=performance.now();
  for(const u of b.units){if(u.gone)continue;if(u.side==='E'&&!tbSpotted(b,'P',u))continue;const col=u.type==='gen'?'#FFC53D':u.side==='P'?'#6FA8FF':'#FF6A5A';
    c.save();c.translate(u.x*k,u.y*ky);c.globalAlpha=u.rout?.4:1;if(u.hitThisRound&&G.mode==='exec'&&Math.sin(now*.02)>0){c.globalAlpha=1;c.shadowColor='#fff';c.shadowBlur=6*dpr}c.fillStyle=col;
    if(u.type==='gen'){c.beginPath();c.arc(0,0,3.4*dpr,0,7);c.fill();c.strokeStyle='#111';c.lineWidth=dpr;c.stroke()}
    else{c.rotate(u.facing+Math.PI/2);const ww=Math.max(3.4*dpr,u.w*k),dd=Math.max(2.2*dpr,(u.dd||u.d)*k*.8);c.fillRect(-ww/2,-dd/2,ww,dd);if(G.sel.has(u.id)){c.strokeStyle='#fff';c.lineWidth=1.4*dpr;c.strokeRect(-ww/2-1.5*dpr,-dd/2-1.5*dpr,ww+3*dpr,dd+3*dpr)}}c.restore()}
  let pts=null;if(G.view==='3d'&&V3.ok){const o=$('ov').getBoundingClientRect();const tl=miniGround(o.left,o.top,o),tr=miniGround(o.right,o.top,o),br=v3ground(o.right,o.bottom-2),bl=v3ground(o.left,o.bottom-2);if(tl&&tr&&br&&bl)pts=[tl,tr,br,bl]}
  else if(G.cam){const v=view2d();pts=[{x:G.cam.x,y:G.cam.y},{x:G.cam.x+v.w,y:G.cam.y},{x:G.cam.x+v.w,y:G.cam.y+v.h},{x:G.cam.x,y:G.cam.y+v.h}]}
  if(pts){c.beginPath();pts.forEach((p,i)=>{const X=Math.max(-40,Math.min(W+40,p.x))*k,Y=Math.max(-40,Math.min(H+40,p.y))*ky;i?c.lineTo(X,Y):c.moveTo(X,Y)});c.closePath();c.fillStyle='rgba(255,255,255,.07)';c.fill();c.strokeStyle='rgba(255,255,255,.92)';c.lineWidth=1.5*dpr;c.stroke()}}
function miniJump(e){const r=$('mini').getBoundingClientRect(),x=(e.clientX-r.left)/r.width*W,y=(e.clientY-r.top)/r.height*H;
  if(G.view==='3d'){V3.cam.tx=x-W/2;V3.cam.tz=y-H/2;v3clamp()}else{const v=view2d();G.cam.x=x-v.w/2;G.cam.y=y-v.h/2;clamp2d()}}
function centerOn(x,y){if(G.view==='3d'){V3.cam.tx=x-W/2;V3.cam.tz=y-H/2;V3.cam.dist=Math.min(V3.cam.dist,420);v3clamp()}else{const c=G.cam;c.z=Math.max(c.z,1.8);const v=view2d();c.x=x-v.w/2;c.y=y-v.h/2;clamp2d()}}
function fitView(){if(G.view==='3d')v3fit();else{G.cam={x:0,y:0,z:1};clamp2d()}}
function render2d(now){
  const b=G.b,cam=G.cam,dpr=cv.width/G.cssW,k=base2d()*cam.z*dpr;
  ctx.setTransform(1,0,0,1,0,0);ctx.fillStyle='#0E0D0A';ctx.fillRect(0,0,cv.width,cv.height);
  ctx.setTransform(k,0,0,k,-cam.x*k,-cam.y*k);ctx.shadowColor='rgba(0,0,0,.7)';ctx.shadowBlur=30*dpr;ctx.drawImage(terrainCv,0,0,W,H);ctx.shadowBlur=0;ctx.drawImage(decalCv,0,0,W,H);
  const sh=G.shake*(cv.width/G.cssW);ctx.setTransform(k,0,0,k,-cam.x*k+(Math.random()-.5)*sh,-cam.y*k+(Math.random()-.5)*sh);
  const fogHide=b.s.fog&&b.t<b.s.fog;
  [...b.units].filter(u=>!u.gone).sort((a,c)=>(a.air?1:0)-(c.air?1:0)||a.y-c.y).forEach(u=>drawUnit(ctx,u,false,now,era()));
  if(fogHide){ctx.setTransform(1,0,0,1,0,0);const gg=ctx.createLinearGradient(0,0,0,cv.height*.65);gg.addColorStop(0,'rgba(205,212,216,.35)');gg.addColorStop(1,'rgba(205,212,216,0)');ctx.fillStyle=gg;ctx.fillRect(0,0,cv.width,cv.height*.65)}
  if(b.s.dusk&&b.s.timer){const t=b.t/b.s.timer.t,a=Math.min(.38,Math.max(0,t-.55)*.85);if(a>0){ctx.setTransform(1,0,0,1,0,0);ctx.fillStyle=`rgba(25,12,40,${a})`;ctx.fillRect(0,0,cv.width,cv.height)}}
}
function stampDecals(){
  const b=G.b,t=decalCv.getContext('2d'),k=decalCv.width/W;t.setTransform(k,0,0,k,0,0);
  for(const u of b.units){
    const st=u.maxMen/45;if(u._dk==null)u._dk=u.killed;
    while(u.killed-u._dk>st){u._dk+=st;
      for(let i=0;i<3;i++){const lx=(Math.random()-.5)*u.w,ly=(Math.random()-.5)*u.d,a=u.facing+Math.PI/2,x=u.x+lx*Math.cos(a)-ly*Math.sin(a),y=u.y+lx*Math.sin(a)+ly*Math.cos(a);
        const kind=era()==='modern'||(i===0&&era()==='napoleon'&&Math.random()<.3)?'crater':'blood';
        t.fillStyle=kind==='crater'?'rgba(30,26,22,.5)':Math.random()<.5?'rgba(70,22,16,.45)':'rgba(40,34,28,.4)';t.beginPath();t.ellipse(x,y,1+Math.random()*1.4,.7+Math.random(),Math.random()*3,0,7);t.fill();
        if(has3d())v3decal(x,y,kind)}}
  }
}

/* ----- orders ----- */
function inDeploy(x,y){return y>=G.b.s.deploy&&!blocked(G.b,{},x,y)}
function place(u,x,y,face){
  x=Math.max(8,Math.min(W-8,x));y=Math.max(G.b.s.deploy,Math.min(H-8,y));
  if(blocked(G.b,u,x,y))return;u.x=x;u.y=y;if(face!=null)u.facing=face;u.order=null;u.wantFace=null;
}
function issue(p,target){
  const b=G.b,sel=selUnits();if(!sel.length||G.mode==='wait')return;if(!(target&&target.side==='E'&&G.mode==='deploy'))pushUndo(sel);
  if(target&&target.side==='E'){
    if(G.mode==='deploy'){toast({text:'Begin the battle before attacking.',kind:'event'});return}
    for(const s of sel){setOrd(b,s,{kind:'attack',target:target.id});s.wantFace=null;ack(s,TYPES[s.type].ranged?'Open fire!':ACK.attack)}
    G.pings.push({x:target.x,y:target.y,life:.8,atk:true});snd('thud');vib(12);G.lastOrderT=Date.now();return;
  }
  const cx=sel.reduce((a,s)=>a+s.x,0)/sel.length,cy=sel.reduce((a,s)=>a+s.y,0)/sel.length;
  for(const s of sel){
    const x=Math.max(10,Math.min(W-10,p.x+(sel.length>1?s.x-cx:0))),y=Math.max(10,Math.min(H-10,p.y+(sel.length>1?s.y-cy:0)));
    if(G.mode==='deploy')place(s,x,y);else{setOrd(b,s,{kind:'move',x,y,face:sel.length>1?s.facing:null});s.wantFace=null;ack(s,ACK.move)}
  }
  G.pings.push({x:p.x,y:p.y,life:.8});snd('thud');vib(12);for(const s2 of sel)G.pop[s2.id]=performance.now();G.lastOrderT=Date.now();
}
function formationSlots(a,b2,units){
  const dx=b2.x-a.x,dy=b2.y-a.y,len=Math.hypot(dx,dy);if(len<1)return null;
  const ux=dx/len,uy=dy/len,face=Math.atan2(uy,ux)-Math.PI/2;
  const us=[...units].sort((p,q)=>(p.x*ux+p.y*uy)-(q.x*ux+q.y*uy));
  const gap=8,total=us.reduce((s,u)=>s+u.w,0)+gap*(us.length-1);
  const extra=total<len?(len-total)/Math.max(1,us.length-1):0;
  let cur=total<len?0:(len-total)/2;const out=[];
  for(const u of us){const c=cur+u.w/2;out.push({u,x:a.x+ux*c,y:a.y+uy*c});cur+=u.w+gap+(us.length>1?extra:0)}
  if(us.length===1){out[0].x=(a.x+b2.x)/2;out[0].y=(a.y+b2.y)/2}
  return {slots:out,face};
}
function applyFormation(a,b2){
  const sel=selUnits();if(!sel.length||G.mode==='wait')return;const f=formationSlots(a,b2,sel);if(!f)return;pushUndo(sel);
  for(const s of f.slots){if(G.mode==='deploy')place(s.u,s.x,s.y,f.face);else{setOrd(G.b,s.u,{kind:'move',x:s.x,y:s.y,face:f.face});s.u.wantFace=null;ack(s.u,'Form line!')}}
  G.pings.push({x:(a.x+b2.x)/2,y:(a.y+b2.y)/2,life:.8});snd('thud');vib(12);for(const s2 of sel)G.pop[s2.id]=performance.now();
}
const CMDS={
  advance(){if(G.mode==='deploy')return;for(const u of selUnits()){const x=u.x+Math.cos(u.facing)*110,y=u.y+Math.sin(u.facing)*110;setOrd(G.b,u,{kind:'move',x:Math.max(10,Math.min(W-10,x)),y:Math.max(10,Math.min(H-10,y)),face:u.facing});ack(u,'Advance!')}snd('order')},
  charge(){const b=G.b;if(G.mode==='deploy')return toast({text:'Begin the battle first.',kind:'event'});
    for(const u of selUnits()){if(!TYPES[u.type].charge&&TYPES[u.type].ranged&&u.type!=='tank'&&u.type!=='ifv'){ack(u,'We hold and shoot');continue}
      let t=u.order&&u.order.kind==='attack'?byId(b,u.order.target):null;
      if(!t||t.gone||t.rout){let bs=1e9;for(const c of b.units){if(c.side==='P'||c.gone||c.rout||c.air)continue;const d=dist(u,c);if(d>320)continue;const off=Math.abs(norm(Math.atan2(c.y-u.y,c.x-u.x)-u.facing));const s=d*(1+off);if(s<bs){bs=s;t=c}}}
      if(t){setOrd(b,u,{kind:'attack',target:t.id,charge:true});u.wantFace=null;ack(u,b.s.era==='modern'?'Assault!':'Charge!')}else ack(u,'No enemy in reach');}
    snd('horn')},
  halt(){for(const u of selUnits()){u.order=null;u.wantFace=null;ack(u,'Halt!')}snd('order')},
  back(){if(G.mode==='deploy')return;for(const u of selUnits()){const x=u.x-Math.cos(u.facing)*90,y=u.y-Math.sin(u.facing)*90;setOrd(G.b,u,{kind:'move',x:Math.max(10,Math.min(W-10,x)),y:Math.max(10,Math.min(H-10,y)),keepFace:true,face:u.facing});ack(u,'Fall back!')}snd('order')},
  stance(){const us=selUnits().filter(u=>u.type!=='gen');if(!us.length)return;const to=us.some(u=>u.stance==='aggr')?'hold':'aggr';for(const u of us){u.stance=to;ack(u,to==='aggr'?'Engage at will!':'Hold the line!')}snd('order')},
  fire(){const us=selUnits().filter(u=>TYPES[u.type].ranged);if(!us.length)return;const to=!us.every(u=>u.fire);for(const u of us){u.fire=to;ack(u,to?'Fire at will!':'Hold fire!')}snd('order')},
  rally(){const g=myGeneral();if(!g||g.rout)return toast({text:'Your commander is gone. No one is left to rally the troops.',kind:'bad'});
    if(G.mode!=='plan')return;
    if(g.rallyCd>0)return toast({text:`${g.name} can rally again in ${Math.ceil(g.rallyCd/TB.ROUND)} turn(s).`,kind:'event'});
    rally(G.b,g);if(G.net)G.netRally=true;g.rallyCd=TB.ROUND*3;ack(g,G.b.s.era==='modern'?'Steady! Hold!':'Rally to me!');snd('horn');while(G.b.msgs.length)toast(G.b.msgs.shift())},
};
/* Bannerlord-style groups: by troop kind, not by position */
const GROUP_OF=t=>{if(['arc','atgm','elf','fusil','sniper','frigate','ffg','corvette','lcr'].includes(t))return 'C';const r=ROLE[t];if(['line','minf','brawler','clock','undead','hgalley','dread'].includes(t)||r==='melee')return 'L';if(r==='mounted'||r==='armour')return 'R';if(r==='ranged')return 'C';return 'M'};
function wings(){
  const o={L:[],C:[],R:[],M:[]};if(!G.b)return o;
  for(const u of G.b.units)if(u.side==='P'&&!u.gone&&!u.rout&&u.type!=='gen')o[GROUP_OF(u.type)].push(u.id);
  return o;
}
function labelGroups(){if(!G.b)return;const e=G.b.s.era,md=e==='modern',w=wings(),nm=e==='dread'?{L:'Battle line',C:'Cruisers',R:'Fast wing',M:'Flotillas'}:e==='sail'||e==='navy'?{L:'Boarders',C:'Escorts',R:'Battle line',M:'Support'}:e==='space'?{L:'Line',C:'Escorts',R:'Capital ships',M:'Strike craft'}:e==='steam'?{L:'Infantry',C:'Fusiliers',R:'Walkers',M:'Engines & air'}:e==='magic'?{L:'Infantry',C:'Archers',R:'Cavalry',M:'Magic & beasts'}:{L:'Infantry',C:md?'Anti-tank':'Ranged',R:md?'Armour':'Cavalry',M:md?'Support':'Artillery'};
  ['L','C','R','M'].forEach((k,i)=>{const el=document.querySelector(`[data-wing="${k}"]`);if(!el)return;el.innerHTML=`<kbd>${'QWEX'[i]}</kbd>${i+1} ${nm[k]} <small>${w[k].length}</small>`;el.hidden=!w[k].length})}
function pickWing(k){if(!G.b)return;const w=wings();if(!w[k].length)return;selectOnly(w[k])}
function updateCmds(){
  const us=G.b?selUnits():[],dep=G.mode==='deploy',g=myGeneral();
  const set=(id,en,on,lab)=>{const e=document.querySelector(`[data-cmd="${id}"]`);if(!e)return;e.disabled=!en;e.classList.toggle('on',!!on);if(lab)e.querySelector('span').textContent=lab};
  set('advance',us.length&&!dep);set('charge',us.length&&!dep);set('halt',us.length&&!dep);set('back',us.length&&!dep);
  const st=us.filter(u=>u.type!=='gen');set('stance',st.length,st.some(u=>u.stance==='aggr'),st.some(u=>u.stance==='aggr')?'Engage at will':'Hold the line');
  const ar=us.filter(u=>TYPES[u.type].ranged);set('fire',ar.length,ar.length&&ar.every(u=>!u.fire),ar.length&&ar.every(u=>!u.fire)?'Hold fire':'Fire at will');
  const rl=G.b&&G.b.s.era==='modern'?'Steady':'Rally';
  set('rally',g&&!g.rout&&!dep&&!(g.rallyCd>0),false,g&&g.rallyCd>0?`${rl} (${Math.ceil(g.rallyCd/TB.ROUND)})`:rl);
  if(G.b){const w=wings();for(const k of ['L','C','R','M']){const e=document.querySelector(`[data-wing="${k}"] small`);if(e)e.textContent=w[k].length}}
  const idle=G.b&&G.mode==='plan'?G.b.units.filter(u=>u.side==='P'&&!u.gone&&!u.rout&&!u.order&&!(u.contacts&&u.contacts.length)).length:0;
  $('dock').classList.toggle('has-sel',!!us.length&&G.mode==='plan');
  $('w-undo').disabled=!(G.undo&&G.undo.length)||!(G.mode==='plan'||G.mode==='deploy');
  $('w-next').classList.toggle('pulse',idle>0);$('w-next').disabled=G.mode!=='plan'&&G.mode!=='deploy';
  $('b-exec').classList.toggle('ready',G.mode==='plan'&&idle===0);
}
/* undo: every order can be taken back until the turn is ended */
function snapSel(list){return list.map(u=>({id:u.id,order:u.order?Object.assign({},u.order):null,x:u.x,y:u.y,facing:u.facing,wantFace:u.wantFace,stance:u.stance,fire:u.fire}))}
function pushUndo(list){if(!list.length)return;G.undo=G.undo||[];G.undo.push(snapSel(list));if(G.undo.length>40)G.undo.shift()}
function undo(){if(!G.b||!G.undo||!G.undo.length||!(G.mode==='plan'||G.mode==='deploy'))return;const snap=G.undo.pop();
  for(const s of snap){const u=byId(G.b,s.id);if(!u)continue;u.order=s.order;u.wantFace=s.wantFace;u.stance=s.stance;u.fire=s.fire;if(G.mode==='deploy'){u.x=s.x;u.y=s.y;u.facing=s.facing}G.pop[u.id]=performance.now()}
  G.floats=G.floats.filter(f=>!snap.some(s=>s.id===f.id));snd('tok');vib(8);toast({text:'Order taken back.',kind:'event'});updateRoster();updateCmds();updateTurnUI()}

/* ----- roster ----- */
function badgeCanvas(type,ring,size,side){const cnv=document.createElement('canvas'),sz=size||26;cnv.width=sz*2;cnv.height=sz*2;cnv.style.width=sz+'px';cnv.style.height=sz+'px';const c=cnv.getContext('2d');c.scale(2,2);roleBadge(c,sz*.4,sz*.42,sz*.34,type,side||'P',{noBrackets:sz<30,ring:type==='gen'?'#D6A63A':undefined});return cnv}
function buildRoster(){
  const box=$('roster');box.innerHTML='';
  G.b.units.filter(u=>u.side==='P').sort((a,c)=>(a.type==='gen'?-1:0)-(c.type==='gen'?-1:0)||a.x-c.x).forEach((u,i)=>{
    const el=document.createElement('button');el.type='button';el.className='rcard'+(u.type==='gen'?' gen':'');el.dataset.id=u.id;el.title=u.name;
    const role=ROLE[u.type]||'melee',tl=u.type==='gen'?(u.naval||u.space?'Flagship':'Commander'):TYPES[u.type].label;
    el.innerHTML=`<span class="rtop"><span class="rchess" style="--rc:${ROLE_COL[role]}" aria-hidden="true">${CHESS[role]}</span><span class="rjob"><b>${ROLE_WORD[role]}</b><small>${tl}</small></span></span><span class="rk">${i<9?i+1:''}</span><span class="rv"></span><span class="rn">${u.name}</span><span class="rm"></span><span class="rh"><i></i></span><span class="rb"><i></i></span><span class="ro"></span><span class="rs"></span>`;
    el.title=`${u.name} · ${ROLE_WORD[role]} (${CHESS_NAME[role]}) · ${tl}`;
    el.addEventListener('click',e=>{sndInit();if(u.gone)return;if(e.shiftKey||e.ctrlKey||e.metaKey){G.sel.has(u.id)?G.sel.delete(u.id):G.sel.add(u.id)}else{const again=G.sel.size===1&&G.sel.has(u.id);G.sel.clear();G.sel.add(u.id);if(again)centerOn(u.x,u.y)}G.pop[u.id]=performance.now();G.inspect=null;snd('tok');updatePanel();updateRoster();updateCmds()});
    el.addEventListener('dblclick',()=>centerOn(u.x,u.y));
    box.appendChild(el);
  });
  updateRoster();
}
function orderText(u){
  if(u.gone)return{t:'—',c:''};if(u.rout)return{t:'Routing',c:'bad'};
  const o=u.order;if(!o)return{t:u.stance==='aggr'?'Engage at will':(u.wantFace!=null?'Turning':'Hold position'),c:'hold'};
  if(o.kind==='move')return{t:o.keepFace?'Fall back':'March'+(o.face!=null?' & form line':''),c:'move'};
  const t=byId(G.b,o.target);if(!t)return{t:'Hold position',c:'hold'};const m=MCODES[matchCode(u.type,t.type)];
  return{t:`${o.charge?'Charge':'Attack'} ${t.name} ${m.sym}`,c:m.v>=3?'atk good':m.v<=1?'atk bad':'atk'};
}
function status(u){return u.gone?(u.fled?'Fled':'Destroyed'):u.rout?'Routing':u._flanked?'FLANKED':u.contacts.length?'Engaged':u.firing?(TYPES[u.type].ranged?'Firing':'Engaged'):u.underFire?'Under fire':u.moving?'Moving':u.stillT>4?'Dug in':'Holding'}
function updateRoster(){
  if(!G.b)return;
  document.querySelectorAll('.rcard').forEach(el=>{
    const u=byId(G.b,+el.dataset.id);if(!u)return;const st=status(u);
    el.querySelector('.rm').textContent=u.gone?'—':strength(u);
    const m=Math.max(0,Math.min(100,u.morale)),bar=el.querySelector('.rb i');bar.style.width=(u.gone||u.rout?0:m)+'%';bar.style.background=m>60?'#E8C25A':m>30?'#E08A2C':C.red;
    el.querySelector('.rh i').style.width=(u.gone?0:Math.max(0,u.men/u.maxMen*100))+'%';el.querySelector('.rv').textContent=u.vet?'▲'.repeat(u.vet):'';
    el.classList.toggle('idle',G.mode==='plan'&&!u.gone&&!u.rout&&!u.order&&!(u.contacts&&u.contacts.length));
    el.querySelector('.rs').textContent=st+(u.inspired&&!u.rout?' · ★':'');const oe=el.querySelector('.ro');if(oe){const o=orderText(u);oe.textContent=o.t;oe.className='ro '+o.c}
    el.classList.toggle('sel',G.sel.has(u.id));el.classList.toggle('eng',st==='Engaged'||st==='FLANKED');el.classList.toggle('out',u.gone||u.rout);el.classList.toggle('warn',st==='FLANKED');
  });
}

/* ----- overlay (shared by 2D and 3D) ----- */
function topH(u){return u.air?32:u.type==='cav'||u.type==='gen'?7:VEH.has(u.type)?5:u.type==='art'?4:5.5}
function groundLine(c,pts,h){let first=true;c.beginPath();for(const [x,y] of pts){const p=P(x,y,h);if(!p.vis)continue;first?c.moveTo(p.x,p.y):c.lineTo(p.x,p.y);first=false}}
function rectPts(x,y,w,d,face){const a=face+Math.PI/2,ca=Math.cos(a),sa=Math.sin(a);return[[-w/2,-d/2],[w/2,-d/2],[w/2,d/2],[-w/2,d/2]].map(([lx,ly])=>[x+lx*ca-ly*sa,y+lx*sa+ly*ca])}
function ghost(c,x,y,w,d,face,col){
  const pts=rectPts(x,y,w,d,face);c.save();c.strokeStyle=col;c.fillStyle='rgba(214,166,58,.14)';c.lineWidth=1.4;c.setLineDash([4,3]);groundLine(c,[...pts,pts[0]],1.5);c.fill();c.stroke();c.setLineDash([]);
  const fx=x+Math.cos(face)*(d/2+7),fy=y+Math.sin(face)*(d/2+7),p=P(fx,fy,1.5),q=P(x+Math.cos(face)*(d/2+1),y+Math.sin(face)*(d/2+1),1.5);
  if(p.vis&&q.vis){c.fillStyle=col;const ang=Math.atan2(p.y-q.y,p.x-q.x);c.beginPath();c.moveTo(p.x,p.y);c.lineTo(q.x+Math.cos(ang+1.6)*5,q.y+Math.sin(ang+1.6)*5);c.lineTo(q.x+Math.cos(ang-1.6)*5,q.y+Math.sin(ang-1.6)*5);c.closePath();c.fill()}
  c.restore();
}
function groundArrow(c,x0,y0,x1,y1,col,alpha,wd){
  const d=Math.hypot(x1-x0,y1-y0);if(d<20)return;const n=Math.max(2,Math.ceil(d/12)),pts=[];
  for(let i=0;i<=n;i++){const t=i/n;pts.push(P(x0+(x1-x0)*t,y0+(y1-y0)*t,1.2))}
  const vis=pts.filter(p=>p.vis);if(vis.length<2)return;const end=vis[vis.length-1],pre=vis[Math.max(0,vis.length-3)],s=end.s;
  c.save();c.globalAlpha=alpha;c.strokeStyle=col;c.lineCap='round';c.lineJoin='round';c.lineWidth=Math.min(13,Math.max(2,wd*s));
  const g=c.createLinearGradient(vis[0].x,vis[0].y,end.x,end.y);g.addColorStop(0,'rgba(0,0,0,0)');g.addColorStop(.3,col);g.addColorStop(1,col);c.strokeStyle=g;
  c.beginPath();vis.slice(0,-2).forEach((p,i)=>i?c.lineTo(p.x,p.y):c.moveTo(p.x,p.y));c.lineTo(pre.x,pre.y);c.stroke();
  const ang=Math.atan2(end.y-pre.y,end.x-pre.x),hl=Math.min(30,Math.max(10,wd*2.6*s)),hw=Math.min(22,Math.max(8,wd*1.9*s));
  c.fillStyle=col;c.beginPath();c.moveTo(end.x,end.y);c.lineTo(end.x-Math.cos(ang)*hl+Math.cos(ang+Math.PI/2)*hw,end.y-Math.sin(ang)*hl+Math.sin(ang+Math.PI/2)*hw);c.lineTo(end.x-Math.cos(ang)*hl-Math.cos(ang+Math.PI/2)*hw,end.y-Math.sin(ang)*hl-Math.sin(ang+Math.PI/2)*hw);c.closePath();c.fill();
  c.restore();
}
function circleOnGround(c,x,y,r,stroke,fill,dash){const pts=[];for(let i=0;i<=64;i++){const a=i/64*Math.PI*2;pts.push([x+Math.cos(a)*r,y+Math.sin(a)*r])}c.save();c.setLineDash(dash||[]);c.strokeStyle=stroke;c.fillStyle=fill;c.lineWidth=1.2;groundLine(c,pts,1);if(fill)c.fill();c.stroke();c.restore()}
function swords(c,x,y,s,col){c.save();c.translate(x,y);c.strokeStyle=col;c.lineWidth=2;c.lineCap='round';c.beginPath();c.moveTo(-s,-s);c.lineTo(s,s);c.moveTo(s,-s);c.lineTo(-s,s);c.stroke();c.restore()}
function drawFx(c,f){
  if(f.delay>0)return;const q=Math.min(1,1-f.life/f.max),id=G.b.id;
  const lerp=(t,h)=>{const x=f.x0+(f.x1-f.x0)*t,y=f.y0+(f.y1-f.y0)*t;return P(x,y,h)};
  switch(f.k){
    case 'dust':{const p=P(f.x,f.y,2+q*4);if(!p.vis)return;c.fillStyle=`rgba(225,215,190,${(1-q)*.5})`;c.beginPath();c.arc(p.x,p.y,(1.5+q*6)*p.s,0,7);c.fill();break}
    case 'arrow':{const p=lerp(q,Math.sin(q*Math.PI)*34+3),p2=lerp(Math.max(0,q-.07),Math.sin(Math.max(0,q-.07)*Math.PI)*34+3);if(!p.vis)return;c.strokeStyle=f.side==='P'?'rgba(225,238,252,.85)':'rgba(255,222,214,.85)';c.lineWidth=1;c.beginPath();c.moveTo(p2.x,p2.y);c.lineTo(p.x,p.y);c.stroke();break}
    case 'volley':{for(let i=0;i<6;i++){const ox=Math.sin(i*2.1+f.x0)*f.n*.35,oy=Math.cos(i*1.7+f.y0)*4;const p=P(f.x0+ox,f.y0+oy,3+q*6);if(!p.vis)continue;
        if(q<.08){c.fillStyle='rgba(255,220,140,.9)';c.beginPath();c.arc(p.x,p.y,1.6*p.s,0,7);c.fill()}
        c.fillStyle=`rgba(230,230,225,${(1-q)*.55})`;c.beginPath();c.arc(p.x,p.y,(2+q*7)*p.s,0,7);c.fill()}break}
    case 'hit':{const p=P(f.x1,f.y1,1.5);if(!p.vis)return;c.fillStyle=`rgba(200,180,150,${(1-q)*.6})`;c.beginPath();c.arc(p.x,p.y,(1+q*3)*p.s,0,7);c.fill();break}
    case 'cannon':{const s0=P(f.x0,f.y0,4+q*8);if(s0.vis){c.fillStyle=`rgba(225,225,220,${(1-q)*.6})`;c.beginPath();c.arc(s0.x,s0.y,(4+q*10)*s0.s,0,7);c.fill();if(q<.12){c.fillStyle='rgba(255,200,110,.95)';c.beginPath();c.arc(s0.x,s0.y,3*s0.s,0,7);c.fill()}}
      const p=lerp(q,Math.sin(q*Math.PI)*25+3);if(p.vis){c.fillStyle='#1a1a1a';c.beginPath();c.arc(p.x,p.y,Math.max(1.5,1*p.s),0,7);c.fill()}break}
    case 'boom':{const p=P(f.x1,f.y1,2+q*10);if(!p.vis)return;if(q<.25){c.fillStyle=`rgba(255,${180-q*300|0},80,${1-q*3})`;c.beginPath();c.arc(p.x,p.y,(3+q*18)*p.s,0,7);c.fill()}
      c.fillStyle=`rgba(60,55,50,${(1-q)*.55})`;c.beginPath();c.arc(p.x,p.y,Math.min(60,(4+q*14)*p.s),0,7);c.fill();break}
    case 'tracer':{const a=lerp(q,3),b2=lerp(Math.max(0,q-.3),3);if(!a.vis||!b2.vis)return;c.strokeStyle=f.side==='P'?'rgba(255,240,170,.95)':'rgba(255,160,120,.95)';c.lineWidth=f.big===2?2.4:f.big?1.6:1;c.beginPath();c.moveTo(b2.x,b2.y);c.lineTo(a.x,a.y);c.stroke();break}
    case 'muzzle':{const p=P(f.x0,f.y0,4+q*6);if(!p.vis)return;c.fillStyle=`rgba(210,205,195,${(1-q)*.5})`;c.beginPath();c.arc(p.x,p.y,(3+q*8)*p.s,0,7);c.fill();break}
    case 'missile':{const p=lerp(q,6+Math.sin(q*Math.PI)*12);if(!p.vis)return;for(let i=1;i<6;i++){const t=Math.max(0,q-i*.03),pp=lerp(t,6+Math.sin(t*Math.PI)*12);c.fillStyle=`rgba(220,220,215,${.35-i*.05})`;c.beginPath();c.arc(pp.x,pp.y,(1+i*.6)*pp.s,0,7);c.fill()}
      c.fillStyle='#ffdf8a';c.beginPath();c.arc(p.x,p.y,Math.max(1.6,1*p.s),0,7);c.fill();break}
    case 'beam':{const a=P(f.x0,f.y0,6),b2=P(f.x1,f.y1,6);if(!a.vis||!b2.vis)return;const al=1-q;c.save();if(f.dash)c.setLineDash([6,5]);c.strokeStyle=`rgba(${f.col},${al*.35})`;c.lineWidth=(f.w||1)*4;c.beginPath();c.moveTo(a.x,a.y);c.lineTo(b2.x,b2.y);c.stroke();c.strokeStyle=`rgba(255,255,255,${al*.9})`;c.lineWidth=f.w||1;c.stroke();c.restore();break}
    case 'orb':{const p=lerp(q,6+Math.sin(q*Math.PI)*(f.arc||10));if(!p.vis)return;const r=Math.max(2,(f.r||4)*p.s);const g=c.createRadialGradient(p.x,p.y,0,p.x,p.y,r*2.2);g.addColorStop(0,'rgba(255,250,220,.95)');g.addColorStop(.35,`rgba(${f.col},.85)`);g.addColorStop(1,`rgba(${f.col},0)`);c.fillStyle=g;c.beginPath();c.arc(p.x,p.y,r*2.2,0,7);c.fill();break}
    case 'wake':{const p=lerp(q,0),p0=lerp(Math.max(0,q-.25),0);if(!p.vis)return;c.strokeStyle='rgba(220,240,255,.7)';c.lineWidth=1.4;c.beginPath();c.moveTo(p0.x,p0.y);c.lineTo(p.x,p.y);c.stroke();break}
    case 'shell':{const p=lerp(q,Math.sin(q*Math.PI)*140+4);if(!p.vis)return;c.fillStyle='rgba(30,30,30,.9)';c.beginPath();c.arc(p.x,p.y,Math.max(1.4,.9*p.s),0,7);c.fill();break}
  }
}
function drawOverlay(now){
  const b=G.b,c=oc,dpr=ov.width/G.cssW;c.setTransform(dpr,0,0,dpr,0,0);c.clearRect(0,0,G.cssW,G.cssH);
  const hidden=u=>false;
  const live=b.units.filter(u=>!u.gone&&!hidden(u));
  if(G.mode==='deploy'){const y0=b.s.deploy,pts=[];for(let x=0;x<=W;x+=25)pts.push([x,y0]);for(let y=y0;y<=H;y+=25)pts.push([W,y]);for(let x=W;x>=0;x-=25)pts.push([x,H]);for(let y=H;y>=y0;y-=25)pts.push([0,y]);
    c.fillStyle='rgba(111,168,230,.13)';groundLine(c,pts,1);c.fill();c.strokeStyle='rgba(140,190,240,.85)';c.lineWidth=2;c.setLineDash([8,6]);groundLine(c,pts.slice(0,41),1);c.stroke();c.setLineDash([]);
    const p=P(30,y0+14,1);if(p.vis){c.font='600 13px "Saira Condensed","Arial Narrow",sans-serif';c.fillStyle='rgba(200,225,250,.95)';c.textAlign='left';c.fillText('DEPLOYMENT ZONE',p.x,p.y)}}
  const g=myGeneral();if(g&&!g.rout)circleOnGround(c,g.x,g.y,g.aura,'rgba(214,166,58,.45)','rgba(214,166,58,.05)',[3,5]);
  if(G.mode==='plan')for(const id of G.sel){const u=byId(b,id);if(u&&!u.gone&&!u.rout&&u.side==='P'){const mr=tbMoveRange(b,u);circleOnGround(c,u.x,u.y,mr,'rgba(120,180,245,.85)','rgba(76,142,230,.10)');
    const lp=P(u.x,u.y-mr,2);if(lp.vis&&G.sel.size<=3){c.font='600 11px "IBM Plex Mono",monospace';c.textAlign='center';c.lineWidth=3;c.strokeStyle='rgba(8,10,9,.85)';c.strokeText('move '+mtr(mr),lp.x,lp.y-4);c.fillStyle='#BFDBFA';c.fillText('move '+mtr(mr),lp.x,lp.y-4)}}}
  for(const id of G.sel){const u=byId(b,id);if(u&&TYPES[u.type].ranged&&!u.gone){const R=TYPES[u.type].ranged;circleOnGround(c,u.x,u.y,Math.min(R.range,900),'rgba(214,166,58,.5)','rgba(214,166,58,.04)',[6,5])}}
  // who is shooting whom
  for(const u of live){if(!u.firing||u.rout||u.firing.gone||hidden(u.firing))continue;if(u.side!=='P'&&u.firing.side!=='P')continue;
    const a=P(u.x,u.y,3),t=P(u.firing.x,u.firing.y,3);if(!a.vis||!t.vis)continue;c.strokeStyle=u.side==='P'?'rgba(111,168,230,.5)':'rgba(240,138,60,.5)';c.lineWidth=1;c.setLineDash([2,4]);c.beginPath();c.moveTo(a.x,a.y);c.lineTo(t.x,t.y);c.stroke();c.setLineDash([])}
  for(const u of live){if(u.rout)continue;let t=null;if(u.order){t=u.order.kind==='move'?u.order:byId(b,u.order.target);if(t&&t.gone)t=null}if(!t)continue;
    const s=u.side==='P',sl=G.sel.has(u.id);if(!s&&hidden(u))continue;
    if(G.mode==='exec')continue;
    const pl=G.mode==='plan'?tbPlan(b,u):null,col=s?C.blue:ENEMY,al=s?(sl?0.9:0.62):0.55;
    if(pl){const pts=pl.pts,e=pts[pts.length-1];
      if(pts.length>1&&pl.used>2){if(pts.length>2){c.strokeStyle=s?'rgba(76,142,230,'+al+')':'rgba(240,138,60,'+al+')';c.lineWidth=s?4:3;groundLine(c,pts.slice(0,-1),1.5);c.stroke()}
        const a=pts[pts.length-2];groundArrow(c,a[0],a[1],e[0],e[1],col,al,s?8:6)}
      if(pl.short||pl.clamped){c.save();c.setLineDash([4,6]);c.strokeStyle=s?'rgba(150,195,245,.55)':'rgba(240,160,100,.5)';c.lineWidth=1.6;groundLine(c,[e,[t.x,t.y]],1.5);c.stroke();c.restore();
        const ep=P(e[0],e[1],2);if(ep.vis&&(sl||!s)){c.fillStyle=s?'#BFDBFA':'#FFC08A';c.beginPath();c.arc(ep.x,ep.y,3,0,7);c.fill();if(sl){c.font='600 11px "IBM Plex Mono",monospace';c.textAlign='center';c.lineWidth=3;c.strokeStyle='rgba(8,10,9,.85)';const nt=Math.ceil(pathLen(tbPath(b,u,t.x,t.y))/Math.max(1,tbMoveRange(b,u)));const tx=pl.attack===false||pl.short?`reaches in ${nt} turns`:'continues next turn';c.strokeText(tx,ep.x,ep.y+14);c.fillText(tx,ep.x,ep.y+14)}}}
      if(pl.attack&&pl.t){const tp=P(t.x,t.y,3);if(tp.vis){if(pl.ranged){c.save();c.setLineDash([2,4]);c.strokeStyle=s?'rgba(214,166,58,.8)':'rgba(240,138,60,.75)';c.lineWidth=1.4;const ep=P(e[0],e[1],3);if(ep.vis){c.beginPath();c.moveTo(ep.x,ep.y);c.lineTo(tp.x,tp.y);c.stroke()}c.restore()}
        c.strokeStyle=s?'#D6A63A':ENEMY;c.lineWidth=2;c.beginPath();c.arc(tp.x,tp.y,11,0,7);c.stroke();c.beginPath();c.moveTo(tp.x-16,tp.y);c.lineTo(tp.x-7,tp.y);c.moveTo(tp.x+7,tp.y);c.lineTo(tp.x+16,tp.y);c.moveTo(tp.x,tp.y-16);c.lineTo(tp.x,tp.y-7);c.moveTo(tp.x,tp.y+7);c.lineTo(tp.x,tp.y+16);c.stroke()}}}
    else groundArrow(c,u.x,u.y,t.x,t.y,col,s?(sl?0.85:0.55):0.38,s?7:6);
    if(s&&u.order.kind==='attack'&&G.mode!=='exec'){const m=MCODES[matchCode(u.type,t.type)],mp=P((u.x+t.x)/2,(u.y+t.y)/2,3);if(mp.vis){c.font='800 13px "Saira Condensed",sans-serif';const tw=c.measureText(m.sym).width+12;c.fillStyle=m.bg;c.fillRect(mp.x-tw/2,mp.y-10,tw,20);c.strokeStyle='rgba(0,0,0,.6)';c.lineWidth=1;c.strokeRect(mp.x-tw/2,mp.y-10,tw,20);c.fillStyle=m.fg;c.textAlign='center';c.textBaseline='middle';c.fillText(m.sym,mp.x,mp.y+1);c.textBaseline='alphabetic'}}
    if(s&&sl&&u.order.kind==='move'&&u.order.face!=null)ghost(c,u.order.x,u.order.y,u.w,u.d,u.order.face,'rgba(214,166,58,.8)')}
  for(const u of live)if(u.rout)groundArrow(c,u.x,u.y,u.x,u.y+(u.side==='P'?70:-70),u.side==='P'?C.blue:ENEMY,0.3,5);
  // selection outlines
  for(const u of live){const sel=G.sel.has(u.id)||G.inspect===u.id||G.hover===u.id;if(!sel)continue;const pts=rectPts(u.x,u.y,u.w+10,Math.max(u.dd,7)+12,u.facing);
    c.strokeStyle=G.sel.has(u.id)?'rgba(255,255,255,.95)':'rgba(255,255,255,.5)';c.lineWidth=1.6;c.setLineDash([6,4]);c.lineDashOffset=-now*.02;groundLine(c,[...pts,pts[0]],u.air?28:1.5);c.stroke();c.setLineDash([])}
  for(const u of live)if(u._flanked&&!u.rout){const r=Math.max(u.w,u.dd)*.8,pulse=1+Math.sin(now*.006)*.06;circleOnGround(c,u.x,u.y,r*pulse,'rgba(255,255,255,.9)',null,[7,6])}
  // clashes
  const seen=new Set();for(const u of live){for(const o of u.contacts){if(o.rout||u.rout)continue;const k=Math.min(u.id,o.id)+'-'+Math.max(u.id,o.id);if(seen.has(k))continue;seen.add(k);
    const p=P((u.x+o.x)/2,(u.y+o.y)/2,8);if(!p.vis)continue;const pulse=1+Math.sin(now*.012)*.15;c.fillStyle='rgba(10,12,11,.7)';c.beginPath();c.arc(p.x,p.y,9*pulse,0,7);c.fill();swords(c,p.x,p.y,4.5*pulse,'#F2D58A')}}
  for(const f of b.fx)drawFx(c,f);
  for(const p of G.pings){const a=p.life/0.8,k=1-a,land=Math.max(0,1-k*2.2);const col=p.atk?'240,138,60':'214,166,58';
    circleOnGround(c,p.x,p.y,6+land*30,`rgba(${col},${Math.min(1,a*1.4)})`,`rgba(${col},${.12*a})`);if(k>.45)circleOnGround(c,p.x,p.y,8+(k-.45)*40,`rgba(${col},${a*.8})`,null)}
  if(G.mode==='plan'||G.mode==='deploy')for(const u of live){if(u.side!=='P'||u.rout||!u.order||u.order.kind!=='move')continue;const o=u.order,b0=P(o.x,o.y,0),t0=P(o.x,o.y,16);if(!b0.vis||!t0.vis)continue;
    c.strokeStyle='rgba(20,20,18,.9)';c.lineWidth=2;c.beginPath();c.moveTo(b0.x,b0.y);c.lineTo(t0.x,t0.y);c.stroke();c.fillStyle=G.sel.has(u.id)?'#F3E2B0':ALLY;c.beginPath();c.moveTo(t0.x,t0.y);c.lineTo(t0.x+12,t0.y+4);c.lineTo(t0.x,t0.y+8);c.closePath();c.fill();
    c.fillStyle='rgba(0,0,0,.35)';c.beginPath();c.ellipse(b0.x,b0.y,4,2,0,0,7);c.fill()}
  const d=G.drag;
  if(d&&d.mode==='pull'&&d.unit){const u0=d.unit,t=d.target,tx=t?t.x:d.x1,ty=t?t.y:d.y1;
    for(const u of selUnits()){const ox=u.x-u0.x,oy=u.y-u0.y,ex=t?tx:tx+(G.sel.size>1?ox:0),ey=t?ty:ty+(G.sel.size>1?oy:0);
      groundArrow(c,u.x,u.y,ex,ey,t?'#FF6B4A':'#6FB0FF',.95,t?11:10);
      if(!t){const pl=tbPlan(b,Object.assign({},u,{order:{kind:'move',x:ex,y:ey}}));if(pl){const e2=pl.pts[pl.pts.length-1];circleOnGround(c,e2[0],e2[1],7,'rgba(255,255,255,.95)','rgba(111,176,255,.55)');
        if(pl.clamped&&u===u0){const n=Math.ceil(pathLen(tbPath(b,u,ex,ey))/Math.max(1,tbMoveRange(b,u))),lp=P(ex,ey,6);if(lp.vis){c.font='700 13px "Share Tech Mono",monospace';c.textAlign='center';c.lineWidth=4;c.strokeStyle='rgba(8,8,8,.9)';c.strokeText(n+' turns',lp.x,lp.y-14);c.fillStyle='#FFE2A6';c.fillText(n+' turns',lp.x,lp.y-14)}}}}}
    if(t){const tp=P(t.x,t.y,4);if(tp.vis){c.strokeStyle='#FF6B4A';c.lineWidth=3;c.beginPath();c.arc(tp.x,tp.y,22+Math.sin(now*.012)*3,0,7);c.stroke()}}}
  if(d&&d.mode==='form'){const f=formationSlots({x:d.x0,y:d.y0},{x:d.x1,y:d.y1},selUnits());c.strokeStyle='rgba(240,200,110,.95)';c.lineWidth=2.5;groundLine(c,[[d.x0,d.y0],[d.x1,d.y1]],1.5);c.stroke();
    if(f)for(const s of f.slots)ghost(c,s.x,s.y,s.u.w,s.u.d,f.face,'rgba(240,200,110,.95)')}
  if(d&&d.mode==='box'){const r=ov.getBoundingClientRect(),x=Math.min(d.sx,d.cx)-r.left,y=Math.min(d.sy,d.cy)-r.top;c.strokeStyle='rgba(214,166,58,.95)';c.fillStyle='rgba(214,166,58,.1)';c.lineWidth=1.2;c.setLineDash([5,4]);c.fillRect(x,y,Math.abs(d.cx-d.sx),Math.abs(d.cy-d.sy));c.strokeRect(x,y,Math.abs(d.cx-d.sx),Math.abs(d.cy-d.sy));c.setLineDash([])}
  // badges, labels, morale
  const close=G.view==='3d'?(V3.cam&&V3.cam.dist<560):G.cam.z>=1.7,br=(G.cssW>=720?11:V3.low?11:9.5)*(close?1.25:1)*(V3.low?1.12:1);
  c.font='600 12px "Saira Condensed","Arial Narrow",sans-serif';c.textBaseline='middle';
  for(const u of b.units){u._bx=null;if(u.gone||hidden(u))continue;
    const ctr=P(u.x,u.y,topH(u)*.5);u._sx=ctr.x;u._sy=ctr.y;u._sr=Math.max(u.w,u.dd)/2*ctr.s+8;if(!ctr.vis)continue;
    if(u.rout)continue;
    const S=SIDE[u.side],tp=P(u.x,u.y,topH(u)+2);if(!tp.vis)continue;
    const by=tp.y-br-6,bx=tp.x,ring=u.type==='gen'?C.brass:(u._flanked?'#FF5A4A':u.inspired&&u.side==='P'?'#E9C76A':u.side==='E'?ENEMY:ALLY);u._bx=bx;u._by=by;
    const show=G.sel.has(u.id)||G.hover===u.id||G.inspect===u.id;
    c.textAlign='left';
    if(show){const txt=u.name+'  '+strengthShort(u),tw=c.measureText(txt).width,pw=tw+br*2.6+12,px=bx-pw/2;
      c.fillStyle='rgba(10,14,12,.88)';rr(c,px,by-br,pw,br*2,br);c.fill();c.strokeStyle=ring;c.lineWidth=1.3;c.stroke();
      c.fillStyle=S.label;c.fillText(txt,px+br*2.6+6,by+1);roleBadge(c,px+br,by,br*.92,u.type,u.side,{ring,noBrackets:true})}
    else{const pt=G.pop[u.id],kk=pt?Math.min(1,(now-pt)/320):1,pop=1+Math.sin(kk*Math.PI)*.35;roleBadge(c,bx,by,br*1.05*pop,u.type,u.side,{ring,thick:u._flanked})}
    if(close&&!show){const lab=(ROLE_WORD[ROLE[u.type]||'melee']+' · '+(u.type==='gen'?(u.naval||u.space?'Flagship':'Commander'):TYPES[u.type].label)).toUpperCase()+(u.vet?' '+'▲'.repeat(u.vet):''),fs=10.5;c.font=`700 ${fs}px "JetBrains Mono","IBM Plex Mono",monospace`;const tw=c.measureText(lab).width,ly=by+br*1.25+9;
      c.fillStyle=u.side==='E'?'rgba(70,22,12,.9)':'rgba(14,30,60,.9)';rr(c,bx-tw/2-6,ly-8,tw+12,16,8);c.fill();c.strokeStyle=ring;c.lineWidth=1;c.stroke();c.fillStyle='#fff';c.textAlign='center';c.fillText(lab,bx,ly+.5);c.textAlign='left';c.font='600 12px "Saira Condensed","Arial Narrow",sans-serif'}
    if(G.mode==='plan'&&u.side==='P'&&!u.order&&!(u.contacts&&u.contacts.length)){const pa=.55+.45*Math.sin(now*.008+u.id);c.fillStyle=`rgba(255,177,59,${pa})`;c.beginPath();c.arc(bx+br+5,by-br+1,4.2,0,7);c.fill();c.strokeStyle='rgba(8,8,8,.8)';c.lineWidth=1.2;c.stroke()}
    const mw=28,m=Math.max(0,Math.min(100,u.morale))/100;c.fillStyle='rgba(8,12,10,.8)';c.fillRect(bx-mw/2-1,by+br+3,mw+2,5);c.fillStyle=m>.6?C.good:m>.3?C.brass:C.red;c.fillRect(bx-mw/2,by+br+4,mw*m,3);
    if(G.mode==='plan'&&u._delta&&u._delta.lost>u.maxMen*(u.side==='P'?0.03:0.04)){c.font='600 11px "IBM Plex Mono",monospace';c.textAlign='center';c.lineWidth=3;c.strokeStyle='rgba(8,10,9,.9)';const t='−'+(TYPES[u.type].per?Math.max(1,Math.round(u._delta.lost/TYPES[u.type].per)):fmt(u._delta.lost))+(u._delta.dm<0?` · ${u._delta.dm}%`:'');c.strokeText(t,bx,by+br+(u._flanked?26:15));c.fillStyle=u.side==='P'?'#FF8A7A':'#FFC08A';c.fillText(t,bx,by+br+(u._flanked?26:15));c.font='600 12px "Saira Condensed","Arial Narrow",sans-serif'}
    if(u._flanked&&u.side==='P'){c.font='700 10px "IBM Plex Mono",monospace';c.textAlign='center';c.fillStyle='#ff6a5a';c.fillText('FLANKED',bx,by+br+15);c.font='600 12px "Saira Condensed","Arial Narrow",sans-serif'}
  }
  c.font='700 14px "Saira Condensed","Arial Narrow",sans-serif';c.textAlign='center';
  for(const f of G.floats){const u=byId(b,f.id);if(!u||u.gone||u._bx==null)continue;const a=Math.min(1,f.life/0.6),y=u._by-18-(1.6-f.life)*12;
    c.globalAlpha=a;c.lineWidth=3;c.strokeStyle='rgba(8,10,9,.9)';c.strokeText(f.text,u._bx,y);c.fillStyle='#F3E2B0';c.fillText(f.text,u._bx,y);c.globalAlpha=1}
  c.font='800 16px "Saira Condensed","Arial Narrow",sans-serif';
  for(const h of G.hits){const u=byId(b,h.id),x=u&&u._bx!=null?u._bx:null;let px,py;if(x!=null){px=x;py=u._by}else{const p=P(h.x,h.y,10);if(!p.vis)continue;px=p.x;py=p.y}
    const L0=h.max||1.9,k=L0-h.life,a=Math.min(1,h.life/0.5),y=py-30-Math.min(k,.4)*20-(h.stack||0)*22,sc=1+Math.max(0,.18-k)*2;
    c.save();c.globalAlpha=a;c.translate(px,y);c.scale(sc,sc);
    pill(c,0,0,h.text,h.dot||(h.side==='P'?'#FF6B5A':'#F5C543'));
    if(h.rout)pill(c,0,21,h.side==='P'?'BROKEN':'ROUTING',h.side==='P'?'#FF6B5A':'#86C47E');
    c.restore()}
  c.textBaseline='alphabetic';
  // enemies outside the view: pointers at the edge
  const off=[];for(const u of b.units){if(u.side!=='E'||u.gone||u.rout)continue;const p=P(u.x,u.y,3);const inside=p.vis&&p.x>=0&&p.x<=G.cssW&&p.y>=0&&p.y<=G.cssH;if(!inside)off.push([u,p])}
  c.font='600 12px "Saira Condensed","Arial Narrow",sans-serif';c.textBaseline='middle';
  for(const [u,p] of off.slice(0,8)){
    let x=p.x,y=p.y;if(!p.vis){const q=P(u.x,u.y,3);x=G.cssW-q.x;y=G.cssH-8}
    const cx=G.cssW/2,cy=G.cssH/2,dx=x-cx,dy=y-cy,k=Math.min((G.cssW/2-26)/Math.max(1,Math.abs(dx)),(G.cssH/2-22)/Math.max(1,Math.abs(dy)));
    const ex=cx+dx*Math.min(1,k),ey=cy+dy*Math.min(1,k),ang=Math.atan2(dy,dx);
    c.save();c.translate(ex,ey);c.rotate(ang);c.fillStyle=ENEMY;c.beginPath();c.moveTo(12,0);c.lineTo(-4,-8);c.lineTo(-4,8);c.closePath();c.fill();c.restore();
    const txt=u.name+' · '+strength(u),tw=c.measureText(txt).width,lx=Math.max(6,Math.min(G.cssW-tw-14,ex-tw/2-4)),ly=Math.max(14,Math.min(G.cssH-14,ey+(dy>0?-18:18)));
    c.fillStyle='rgba(10,14,12,.86)';c.fillRect(lx,ly-9,tw+8,18);c.strokeStyle=ENEMY;c.lineWidth=1;c.strokeRect(lx,ly-9,tw+8,18);c.fillStyle='#FFE7D3';c.textAlign='left';c.fillText(txt,lx+4,ly+1);
  }
  c.textBaseline='alphabetic';
  const ne=b.units.filter(u=>u.side==='E'&&!u.gone&&!u.rout).length;$('vis-tag').textContent=`All ${ne} enemy units visible`+(off.length?` · ${off.length} outside view`:'');
}
function casualties(b,side){return b.units.filter(u=>u.side===side).reduce((a,u)=>a+Math.max(0,u.maxMen-u.men),0)}
function updateCounter(dt){
  const b=G.b;if(!b)return;const tE=casualties(b,'E'),tP=casualties(b,'P');G.casE=G.casE||0;G.casP=G.casP||0;
  const k=Math.min(1,dt*3.5);G.casE+=(tE-G.casE)*k;G.casP+=(tP-G.casP)*k;if(Math.abs(tE-G.casE)<1)G.casE=tE;if(Math.abs(tP-G.casP)<1)G.casP=tP;
  const a=fmtFull(G.casE),z=fmtFull(G.casP);if($('g-pk').textContent!==a)$('g-pk').textContent=a;if($('g-ek').textContent!==z)$('g-ek').textContent=z;
}
function updateHud(){
  const b=G.b;if(!b)return;const pm=sideMen(b,'P'),em=sideMen(b,'E');
  $('g-pmen').textContent=Math.round(pm/b.init.P*100)+'%';$('g-emen').textContent=Math.round(em/b.init.E*100)+'%';
  const pr=pm/b.init.P,er=em/b.init.E,share=Math.max(3,Math.min(97,pr/Math.max(1e-6,pr+er)*100));
  $('pw-p').style.flexBasis=share+'%';$('pw-mark').style.left=share+'%';
  if(G.pwLast!=null&&Math.abs(share-G.pwLast)>2.5){const bar=$('pw-p').parentNode;bar.classList.remove('swing');void bar.offsetWidth;bar.classList.add('swing')}G.pwLast=share;
  const tc=String(Math.max(1,G.turn));if($('g-clock').textContent!==tc)$('g-clock').textContent=tc;
}
function unitCard(u,enemy){
  const b=G.b,tt=terr(b,u.x,u.y),st=status(u);
  const ter={hill:'High ground',mud:'In the mud',woods:'In the woods',river:'River',town:'In buildings (cover)',stream:'Crossing a stream',ford:'In the ford',bridge:'On the bridge'}[tt]||'Open ground';
  const mc=u.morale>60?C.good:u.morale>30?C.brass:C.red,R=TYPES[u.type].ranged,extra=[];
  extra.push(`<span>Move</span><b>${mtr(tbMoveRange(b,u))} per turn</b>`);
  if(R)extra.push(`<span>Weapon</span><b>${({arrow:'Bows',musket:'Smoothbore muskets',cannon:'Field guns, round shot and canister',rifle:'Rifles and machine guns',autocannon:'30 mm autocannon',tankgun:'120 mm main gun',atgm:'Guided anti-tank missiles',shell:'155 mm howitzers',missile:'Attack drones',hellfire:'Anti-tank missiles',sam:'Surface-to-air missiles',kamikaze:'Loitering munitions'})[R.w]||R.w}</b>`);
  if(R)extra.push(`<span>Range</span><b>${mtr(R.range)}${R.min?` (min ${mtr(R.min)})`:''}</b>`);
  extra.push(`<span>Strength</span><b>${strength(u)} of ${T0(u)}</b>`);
  if(!enemy&&u.type!=='gen')extra.push(`<span>Orders</span><b>${u.stance==='aggr'?'Engage at will':'Hold the line'}${R?(u.fire?' · fire at will':' · hold fire'):''}</b>`);
  if(u.inspired)extra.push(`<span>Command</span><b style="color:${C.brass}">Inspired by the commander</b>`);
  if(u.type==='gen')extra.push(`<span>${b.s.era==='modern'?'Steady':'Rally'}</span><b>${u.rallyCd>0?'Ready in '+Math.ceil(u.rallyCd/TB.ROUND)+' turn(s)':'Ready'}</b>`);
  const foes=[...new Set(b.units.filter(o=>o.side!==u.side&&!o.gone&&!o.rout).map(o=>o.type))];
  const rows=(list,cls)=>list.map(t=>{const m=MCODES[enemy?matchCode(t,u.type):matchCode(u.type,t)];return `<div class="mrow ${cls}"><span class="msym" style="background:${m.bg};color:${m.fg}">${m.sym}</span><span class="ubadge" data-type="${t}" data-side="${enemy?'P':'E'}" data-size="26"></span><span class="mname">${TYPES[t].label}</span></div>`}).join('');
  const v=t=>MCODES[enemy?matchCode(t,u.type):matchCode(u.type,t)].v;
  const good=foes.filter(t=>v(t)>=3).sort((a,c)=>v(c)-v(a)),bad=foes.filter(t=>v(t)<=1).sort((a,c)=>v(a)-v(c));
  let best='';if(!enemy&&u.type!=='gen'){let bt=null,bs=-1;for(const o of b.units){if(o.side===u.side||o.gone||o.rout)continue;const d=dist(u,o),rg=R?R.range:140;if(d>rg*1.15)continue;const sc=MCODES[matchCode(u.type,o.type)].v*1000-d;if(sc>bs){bs=sc;bt=o}}
    if(bt)best=`<button type="button" class="besttgt" data-target="${bt.id}"><em>Best target in reach</em><b>${bt.name}</b><span>${MCODES[matchCode(u.type,bt.type)].label} · ${mtr(dist(u,bt))} · click here to attack</span></button>`}
  const mblock=enemy?`${good.length?`<div class="mhead">Dangerous to your</div>${rows(good,'g')}`:''}${bad.length?`<div class="mhead weak">Vulnerable to your</div>${rows(bad,'b')}`:''}`
    :`${good.length?`<div class="mhead">Good against</div>${rows(good,'g')}`:''}${bad.length?`<div class="mhead weak">Avoid</div>${rows(bad,'b')}`:''}${best}`;
  return `<div class="uhead"><span class="ubadge ${enemy?'e':'p'}" data-type="${u.type}"></span><div><div class="nm">${u.name}</div><div class="ut">${enemy?'Enemy · ':''}${TYPES[u.type].label} · <span class="chs">${chessOf(u.type)}</span> ${CHESS_NAME[ROLE[u.type]]}${u.stakes?' + stakes':''}</div></div></div>
  <div class="kv"><span>Strength</span><b>${strength(u)}</b><span>Morale</span><b style="color:${mc}">${Math.max(0,Math.round(u.morale))}%</b><span>Status</span><b style="${st==='FLANKED'?'color:'+C.red:''}">${st}</b><span>Ground</span><b>${ter}</b>${u.fatigue>0.1?`<span>Fatigue</span><b>${Math.round(u.fatigue*100)}%</b>`:''}${extra.join('')}</div><div class="note">${TYPE_NOTE[u.type]}</div><div class="mblock">${mblock}</div>`;
}
function paintBadges(root){root.querySelectorAll('.ubadge').forEach(el=>el.replaceWith(badgeCanvas(el.dataset.type,null,+(el.dataset.size||34),el.dataset.side||(el.classList.contains('e')?'E':'P'))))}
function updatePanel(){
  const b=G.b,box=$('p-unit');if(!b)return;
  const sel=[...G.sel].map(id=>byId(b,id)).filter(u=>u&&!u.gone);
  if(!sel.length){const e=G.inspect&&byId(b,G.inspect);
    if(e&&!e.gone){box.innerHTML=unitCard(e,true);paintBadges(box);return}
    box.innerHTML='<div class="empty"><b>Left click</b> selects: a unit, a unit card or a wing button. Drag a box to select several, Shift adds.<br><b>Right click</b> orders: the ground to march, an enemy to attack. Right-drag draws a battle line.</div>';return}
  if(sel.length>1){const mor=sel.reduce((a,u)=>a+u.morale,0)/sel.length;
    box.innerHTML=`<div class="nm">${sel.length} units</div><div class="kv"><span>Avg. morale</span><b>${Math.max(0,Math.round(mor))}%</b><span>Engaged</span><b>${sel.filter(u=>u.contacts.length||u.firing).length}</b></div><div class="note">Right-drag on the ground to draw their battle line. Right-click an enemy to attack together.</div>`;return}
  box.innerHTML=unitCard(sel[0],false);paintBadges(box);
}
function toast(m){
  const el=document.createElement('div');el.className='toast'+(m.kind==='good'?' good':m.kind==='bad'?' bad':'');el.textContent=m.text;
  $('toasts').appendChild(el);G.toastEls.push({el,life:5.5});while(G.toastEls.length>4)G.toastEls.shift().el.remove();
}
function showEnd(){
  const b=G.b,r=b.result;G.mode='over';
  const loss=side=>b.units.filter(u=>u.side===side).reduce((a,u)=>a+u.maxMen-u.men+u.fled+(u.rout&&!u.gone?u.men:0),0);
  const pct=side=>Math.round(loss(side)/b.init[side]*100)+'%';
  $('e-title').textContent=r.win?'Victory':'Defeat';$('e-title').className=r.win?'win':'loss';
  $('e-reason').textContent=r.reason;
  $('e-pl').textContent=b.s.sides[0]+' losses';$('e-el').textContent=b.s.sides[1]+' losses';
  $('e-pv').textContent=pct('P');$('e-ev').textContent=pct('E');
  $('e-hh').textContent=b.s.year==='21st c.'?'About this scenario':'What happened in '+b.s.year;$('e-hist').textContent=b.s.history;
  $('e-again').textContent='Fight again';$('e-menu').textContent='Choose battle';G.endAction=null;
  if(b.s.endless){const er=endlessResult(b);if(er){$('e-title').textContent=er.title;$('e-reason').textContent=er.reason;$('e-hh').textContent='Endless War';$('e-hist').textContent=er.hist;$('e-again').textContent=er.again;$('e-menu').textContent='Main menu';G.endAction=r.win?'muster':'newcamp';G.endEra=er.era}}
  $('e-again').hidden=!!G.net;if(G.net){$('e-hh').textContent='Online battle';$('e-hist').textContent=r.win?'You out-commanded your opponent.':'Your opponent out-commanded you. Challenge them again from the menu.';$('e-menu').textContent='Main menu'}
  $('e-rt').textContent=(G.stats?G.stats.routs:0)+' / '+b.units.filter(u=>u.side==='E').length;
  try{renderEnd(metaEnd(b))}catch(err){console.error(err)}
  $('ov-end').hidden=false;$('report').hidden=true;G.sel.clear();updateCmds();updateTurnUI();snd('horn');
}
function scanFlanks(){
  const b=G.b;for(const u of b.units){u._flanked=false;if(u.gone||u.rout||u.side!=='P')continue;
    for(const o of u.contacts){if(o.rout)continue;const df=Math.abs(norm(Math.atan2(o.y-u.y,o.x-u.x)-u.facing));if(df>1.05){u._flanked=true;break}}
    if(u._flanked&&(!G.flankT[u.id]||b.t-G.flankT[u.id]>14)){G.flankT[u.id]=b.t;tagUnit(u,'FLANKED','#FF6B5A',2.6);toast({text:`${u.name} is being attacked from the ${Math.abs(norm(Math.atan2(u.contacts[0].y-u.y,u.contacts[0].x-u.x)-u.facing))>2.1?'rear':'flank'}!`,kind:'bad'})}}
}
const keysDown=new Set();
function loop(now){
  const dt=Math.min(0.1,(now-G.last)/1000);G.last=now;const b=G.b;
  if(b&&G.mode!=='menu'){let px=0,py=0;if(keysDown.has('ArrowLeft'))px++;if(keysDown.has('ArrowRight'))px--;if(keysDown.has('ArrowUp'))py++;if(keysDown.has('ArrowDown'))py--;if(px||py)panBy(px*500*dt,py*500*dt)}
  if(b&&G.mode==='exec'){
    const sp=dt*G.speed*(G.ff?3:1)*(G.tscale||1);G.tscale=Math.min(1,(G.tscale||1)+dt*1.6);tbTick(b,sp);
    const fdt=sp*1.6;for(const f of b.fx){if(f.delay>0)f.delay-=fdt;else f.life-=fdt;
      if(!f._s&&!(f.delay>0)){f._s=1;if(f.k==='boom'||f.k==='cannon')G.shake=Math.min(5,G.shake+(f.k==='boom'?1.6:1));if(f.k==='volley')snd('volley');else if(f.k==='cannon'||(f.k==='boom'&&b.s.era!=='modern'))snd('boom',.8);else if(f.k==='boom')snd('tank',.7);else if(f.k==='arrow')snd('arrow');else if(f.k==='tracer')snd('rifle',.6)}}
    b.fx=b.fx.filter(f=>f.life>0);if(b.fx.length>700)b.fx.splice(0,b.fx.length-700);
    stampDecals();
    while(b.msgs.length)toast(b.msgs.shift());
    G.flT=(G.flT||0)-dt;if(G.flT<=0){G.flT=.4;scanFlanks()}
    for(const id of [...G.sel]){const u=byId(b,id);if(!u||u.gone||u.rout)G.sel.delete(id)}
    if(G.mode==='exec'&&!G.q){if(G.net)netRoundDone();else if(b.result)showEnd();else{tbEnemyPlan(b);endTurn()}}
  }
  for(const h of G.hits)h.life-=dt;G.hits=G.hits.filter(h=>h.life>0);
  if(b&&G.mode!=='menu')updateCounter(dt);
  for(const p of G.pings)p.life-=dt;G.pings=G.pings.filter(p=>p.life>0);
  for(const f of G.floats)f.life-=dt;G.floats=G.floats.filter(f=>f.life>0);
  for(const t of G.toastEls){t.life-=dt;if(t.life<1)t.el.style.opacity=Math.max(0,t.life)}
  G.toastEls=G.toastEls.filter(t=>{if(t.life<=0){t.el.remove();return false}return true});
  G.shake*=Math.pow(0.04,dt);
  if(b&&G.mode!=='menu'){
    if(G.view==='3d')v3render(now);else render2d(now);
    drawOverlay(now);
    G.miniT=(G.miniT||0)-dt;if(G.miniT<=0){G.miniT=.08;drawMini()}
    G.hudT=(G.hudT||0)-dt;if(G.hudT<=0){G.hudT=0.25;updateHud();updatePanel();updateRoster();updateCmds()}}
  requestAnimationFrame(loop);
}

/* ----- matchup tooltip ----- */
function showTip(u,e){
  const tip=$('mtip'),sel=selUnits().filter(s=>s.type!=='gen');
  if(!u||u.side!=='E'||u.gone||!sel.length||G.mode==='over'){tip.hidden=true;return}
  const rows=sel.slice(0,4).map(a=>{const m=MCODES[matchCode(a.type,u.type)],back=MCODES[matchCode(u.type,a.type)],R=TYPES[a.type].ranged,d=dist(a,u);
    const rng=R?(d<=R.range?`In range · ${mtr(d)} of ${mtr(R.range)}`:`Out of range · ${mtr(d)}, reach ${mtr(R.range)}`)+(tbSpotted(G.b,a.side,u)?'':' · hidden in cover, fire is blind until you get close'):`Melee · ${mtr(d)} away`;
    let ex='';if(G.mode==='plan'){const pv=tbPreview(G.b,a,u);
      if(pv.reach)ex=`<span class="tx">This turn: they lose <b>~${lossTxt(u,pv.theyLose).trim()}</b> and ${Math.round(pv.theyMorale)}% morale${pv.youLose>=.5?` · you lose ~${lossTxt(a,pv.youLose).trim()}`:' · no losses for you'}</span>`;
      else{const n=Math.ceil(pathLen(tbPath(G.b,a,u.x,u.y))/Math.max(1,tbMoveRange(G.b,a)));ex=`<span class="tx far">Out of reach this turn · closes in ${Math.max(1,n-(TYPES[a.type].ranged?1:0))} turn(s)</span>`}}
    const fa=Math.abs(norm(Math.atan2(a.y-u.y,a.x-u.x)-u.facing)),fl=fa>2.1?' · hits their rear ×2.2':fa>1.05?' · hits their flank ×1.5':'';
    return `<div class="trow"><span class="msym big" style="background:${m.bg};color:${m.fg}">${m.sym}</span><div><b class="tn">${a.name}</b><span class="tl" style="color:${m.v>=3?'#D6A63A':m.v<=1?'#F7B987':'#C9CFC4'}">${m.label}</span><span class="tw">${matchWhy(a,u)}${fl}</span><span class="tr">${rng} · their reply ${back.sym} ${back.label}</span>${ex}</div></div>`}).join('');
  tip.innerHTML=`<div class="th">${G.drag&&G.drag.mode==='pull'?'Release to attack':'Tap or drag onto'} <b>${u.name}</b> · ${strength(u)}</div>${rows}${sel.length>4?`<div class="tw">+${sel.length-4} more units</div>`:''}`;
  tip.hidden=false;const r=$('stage').getBoundingClientRect();let x=e.clientX-r.left+18,y=e.clientY-r.top+14;
  const tw=tip.offsetWidth,th=tip.offsetHeight;if(x+tw>r.width-8)x=e.clientX-r.left-tw-18;if(y+th>r.height-8)y=Math.max(8,r.height-th-8);tip.style.left=x+'px';tip.style.top=y+'px';
}
/* ----- input ----- */
function unitAtScreen(cx,cy,prefer){
  const r=ov.getBoundingClientRect(),X=cx-r.left,Y=cy-r.top;let best=null,bd=1e9;
  if(prefer){let pb=null,pd=1e9;for(const u of G.b.units){if(u.gone||u.side!==prefer||u.rout)continue;for(const [x,y,rad] of [[u._bx,u._by,20],[u._sx,u._sy,Math.max(22,(u._sr||12)+12)]]){if(x==null)continue;const d=Math.hypot(X-x,Y-y);if(d<rad&&d<pd){pd=d;pb=u}}}if(pb)return pb}
  for(const u of G.b.units){if(u.gone)continue;
    if(u._bx!=null){const d=Math.hypot(X-u._bx,Y-u._by);if(d<12&&d<bd){bd=d;best=u;continue}}
    if(u._sx==null)continue;const d=Math.hypot(X-u._sx,Y-u._sy),rad=Math.max(12,u._sr||12);if(d<rad&&d/rad*20<bd){bd=d/rad*20;best=u}}
  return best;
}
/* pick the unit closest to the finger, own or enemy, so a tap near an enemy never grabs your own unit by accident */
function pickUnit(cx,cy,touch,only){
  const r=ov.getBoundingClientRect(),X=cx-r.left,Y=cy-r.top;let best=null,bs=1e9;
  for(const u of G.b.units){if(u.gone||(only&&u.side!==only))continue;if(u.rout&&u.side==='P')continue;if(u.side==='E'&&typeof hidden==='function'&&hidden(u))continue;
    for(const [x,y,rad] of [[u._bx,u._by,touch?20:15],[u._sx,u._sy,Math.max(touch?18:16,(u._sr||12)+(touch?4:2))]]){if(x==null)continue;const d=Math.hypot(X-x,Y-y);if(d<rad&&d/rad<bs){bs=d/rad;best=u}}}
  return best;
}
function releaseSel(){if(G.mode==='deploy')return;G.sel.clear();G.inspect=null;updatePanel();updateRoster();updateCmds()}
function vib(ms){try{if(navigator.vibrate)navigator.vibrate(ms)}catch(e){}}
function selectOnly(ids,add){if(!add)G.sel.clear();ids.forEach(i=>{G.sel.add(i);G.pop[i]=performance.now()});if(ids.length){snd('tok');vib(6)}G.inspect=null;updatePanel();updateRoster();updateCmds()}
ov.addEventListener('contextmenu',e=>e.preventDefault());
ov.addEventListener('wheel',e=>{if(!G.b)return;e.preventDefault();const r=ov.getBoundingClientRect();zoomBy(Math.exp(-e.deltaY*0.0013),e.clientX-r.left,e.clientY-r.top)},{passive:false});
ov.addEventListener('pointerdown',e=>{
  if(!G.b||G.mode==='over')return;sndInit();if(SND.ctx&&SND.ctx.state==='suspended')SND.ctx.resume();ov.focus({preventScroll:true});
  G.ptrs.set(e.pointerId,{x:e.clientX,y:e.clientY});ov.setPointerCapture(e.pointerId);
  if(G.ptrs.size===2){const [a,b2]=[...G.ptrs.values()];G.drag=null;G.pinch={d:Math.hypot(a.x-b2.x,a.y-b2.y),cx:(a.x+b2.x)/2,cy:(a.y+b2.y)/2};return}
  if(e.button===1||(e.button===0&&(G.space||e.altKey))){G.pan={x:e.clientX,y:e.clientY};if(G.space)G.spaceUsed=true;return}
  const isMac=/Mac/.test(navigator.platform||''),btn=(e.button===0&&e.ctrlKey&&isMac)?2:e.button;
  const u=pickUnit(e.clientX,e.clientY,e.pointerType!=='mouse'),p=vToWorld(e);
  G.drag={btn,mode:'press',touch:e.pointerType!=='mouse',w0:p,x0:p&&p.x,y0:p&&p.y,x1:p&&p.x,y1:p&&p.y,sx:e.clientX,sy:e.clientY,cx:e.clientX,cy:e.clientY,shift:e.shiftKey||e.metaKey||(e.ctrlKey&&btn!==2),unit:u};
});
ov.addEventListener('pointermove',e=>{
  if(!G.b)return;
  if(G.ptrs.has(e.pointerId))G.ptrs.set(e.pointerId,{x:e.clientX,y:e.clientY});
  if(G.pinch&&G.ptrs.size===2){const [a,b2]=[...G.ptrs.values()],d=Math.hypot(a.x-b2.x,a.y-b2.y),cx=(a.x+b2.x)/2,cy=(a.y+b2.y)/2,r=ov.getBoundingClientRect();
    zoomBy(d/G.pinch.d,cx-r.left,cy-r.top);panBy(cx-G.pinch.cx,cy-G.pinch.cy);G.pinch={d,cx,cy};return}
  if(G.pan){panBy(e.clientX-G.pan.x,e.clientY-G.pan.y);G.pan={x:e.clientX,y:e.clientY};return}
  const d=G.drag;
  if(d){d.cx=e.clientX;d.cy=e.clientY;const p=vToWorld(e);if(p){d.x1=p.x;d.y1=p.y}
    if(d.mode==='press'&&Math.hypot(e.clientX-d.sx,e.clientY-d.sy)>(d.touch?10:8)){
      const own=d.unit&&d.unit.side==='P'&&!d.unit.rout&&(G.mode==='plan'||G.mode==='deploy');
      if(d.btn===2&&d.w0)d.mode='form';
      else if(d.btn===0&&own){d.mode='pull';if(!G.sel.has(d.unit.id))selectOnly([d.unit.id]);snd('tok');vib(10);ov.style.cursor='grabbing'}
      else if(d.touch&&!d.shift){d.mode='pan';G.pan={x:e.clientX,y:e.clientY};G.drag=null}
      else d.mode='box';}
    if(d&&d.mode==='pull'){const t=pickUnit(e.clientX,e.clientY,d.touch,'E');d.target=t&&!t.gone&&!t.rout?t:null;showTip(d.target,e)}}
  else if(e.pointerType==='mouse'){const u=pickUnit(e.clientX,e.clientY,false);G.hover=u?u.id:null;showTip(u,e);ov.style.cursor=u&&u.side==='P'?'grab':(G.sel.size&&G.mode==='plan'?'crosshair':'default')}
});
function nextIdle(){
  const b=G.b;if(!b)return;const idle=b.units.filter(u=>u.side==='P'&&!u.gone&&!u.rout&&!u.order&&!(u.contacts&&u.contacts.length)).sort((a,c)=>a.x-c.x);
  if(!idle.length){toast({text:'Every unit has its orders. End the turn when ready.',kind:'good'});return}
  const cur=[...G.sel][0],i=idle.findIndex(u=>u.id===cur),u=idle[(i+1)%idle.length];selectOnly([u.id]);centerOn(u.x,u.y);
}
function endPointer(e){
  G.ptrs.delete(e.pointerId);
  if(G.pinch){if(G.ptrs.size<2)G.pinch=null;G.drag=null;return}
  if(G.pan){G.pan=null;return}
  const d=G.drag;G.drag=null;if(!d||!G.b||e.type==='pointercancel')return;
  ov.style.cursor='default';
  if(d.mode==='form'){if(d.w0)applyFormation({x:d.x0,y:d.y0},{x:d.x1,y:d.y1});return}
  if(d.mode==='pull'){$('mtip').hidden=true;
    if(d.target){issue(d.target,d.target);if(G.mode!=='deploy')releaseSel()}
    else if(Math.hypot(d.cx-d.sx,d.cy-d.sy)>(d.touch?18:16)){issue({x:d.x1,y:d.y1},null);releaseSel()}
    return}
  if(d.mode==='box'){const r=ov.getBoundingClientRect(),x0=Math.min(d.sx,d.cx)-r.left,x1=Math.max(d.sx,d.cx)-r.left,y0=Math.min(d.sy,d.cy)-r.top,y1=Math.max(d.sy,d.cy)-r.top;
    selectOnly(G.b.units.filter(u=>u.side==='P'&&!u.gone&&!u.rout&&u._sx!=null&&u._sx>=x0&&u._sx<=x1&&u._sy>=y0&&u._sy<=y1).map(u=>u.id),d.shift);return}
  const u=d.unit,p=d.w0,canOrder=G.mode==='plan'||G.mode==='deploy';
  // right click: order (power users)
  if(d.btn===2){if(!G.sel.size){toast({text:'Tap one of your units first, or drag from it to where it should go.',kind:'event'});return}if(p||u)issue(u&&u.side==='E'?u:p,u&&u.side==='E'?u:null);return}
  if(Date.now()-(G.lastOrderT||0)<350)return;
  // tap own unit: select / toggle
  if(u&&u.side==='P'&&!u.rout){
    if(d.shift){if(G.sel.has(u.id)){G.sel.delete(u.id);updatePanel();updateRoster();updateCmds()}else selectOnly([u.id],true);return}
    if(G.sel.size===1&&G.sel.has(u.id)){G.sel.clear();updatePanel();updateRoster();updateCmds();snd('tok');return}
    selectOnly([u.id]);return}
  // tap the enemy or the ground with units selected: that is the order
  const tgt=u&&u.side==='E'&&!u.gone&&!u.rout?u:null;
  if(G.sel.size&&canOrder){if(tgt){if(G.mode==='deploy'){G.inspect=tgt.id;updatePanel();return}issue(tgt,tgt)}else if(p)issue(p,null);releaseSel();return}
  if(tgt){G.inspect=tgt.id;updatePanel();return}
  if(!d.shift){G.sel.clear();G.inspect=null;updatePanel();updateRoster();updateCmds()}
}
ov.addEventListener('pointerup',endPointer);ov.addEventListener('pointercancel',endPointer);
ov.addEventListener('pointerleave',()=>{G.hover=null;$('mtip').hidden=true});

document.addEventListener('keydown',e=>{
  if(!G.b||G.mode==='menu'||e.target.closest('input,textarea'))return;
  if(e.key.startsWith('Arrow')){keysDown.add(e.key);e.preventDefault();return}
  if(e.code==='Space'){e.preventDefault();if(!e.repeat){G.space=true;G.spaceUsed=false}return}
  if(e.key==='Enter'){e.preventDefault();if(G.mode==='deploy')begin();else if(G.mode==='plan')execTurn();return}
  const k=e.key.toLowerCase();
  if(k==='z'){e.preventDefault();undo();return}
  if(k==='escape'){G.sel.clear();G.inspect=null;updatePanel();updateRoster();updateCmds()}
  else if(k==='a'){e.preventDefault();selectOnly(G.b.units.filter(u=>u.side==='P'&&!u.gone&&!u.rout).map(u=>u.id))}
  else if(/^[1-9]$/.test(k)){const el=document.querySelectorAll('.rcard')[+k-1];if(el)el.click()}
  else if(k==='q')pickWing('L');else if(k==='w')pickWing('C');else if(k==='e')pickWing('R');else if(k==='x')pickWing('M');
  else if(k==='v')CMDS.advance();else if(k==='c')CMDS.charge();else if(k==='s'||k==='h')CMDS.halt();else if(k==='b')CMDS.back();
  else if(k==='g')CMDS.stance();else if(k==='f')CMDS.fire();else if(k==='r')CMDS.rally();
  else if(k==='p')togglePause();
  else if(k==='n'||e.key==='Tab'){e.preventDefault();nextIdle()}
  else if(k==='+'||k==='=')zoomBy(1.25,G.cssW/2,G.cssH/2);else if(k==='-')zoomBy(1/1.25,G.cssW/2,G.cssH/2);
  else if(k===','&&G.view==='3d')V3.cam.yawT-=Math.PI/8;else if(k==='.'&&G.view==='3d')V3.cam.yawT+=Math.PI/8;
  else if(k==='t'&&has3d())setView(G.view==='3d'?'2d':'3d');
  else if(k==='m')setMini(!miniOn());
  updateCmds();
});
document.addEventListener('keyup',e=>{keysDown.delete(e.key);if(e.code==='Space'){G.space=false;if(!G.spaceUsed&&G.b&&G.mode!=='menu')togglePause()}});
function togglePause(){
  if(G.mode==='deploy'){begin();return}
  if(G.mode==='plan')execTurn();else if(G.mode==='exec')G.ff=true;
}
function introTags(){const b=G.b;for(const [side,i,col] of [['P',0,'#6FA8E6'],['E',1,'#F08A3C']]){const all=b.units.filter(u=>u.side===side&&!u.gone),us=all.filter(u=>u.type!=='gen').length?all.filter(u=>u.type!=='gen'):all;if(!us.length)continue;const cx=us.reduce((a,u)=>a+u.x,0)/us.length,cy=us.reduce((a,u)=>a+u.y,0)/us.length;let best=us[0],bd=1e9;for(const u of us){const d=Math.hypot(u.x-cx,u.y-cy);if(d<bd){bd=d;best=u}}
  const men=all.reduce((a,u)=>a+u.men,0);tagUnit(best,`${b.s.sides[i]}: ${b.s.era==='modern'?all.length+' units':fmt(men)+' men'}`,col,5)}}
function begin(){introTags();sndInit();if(SND.ctx&&SND.ctx.state==='suspended')SND.ctx.resume();$('ov-deploy').hidden=true;G.turn=1;G.mode='plan';tbContacts(G.b);if(!G.net)tbEnemyPlan(G.b);G.report=null;updateTurnUI();updateCmds();snd('horn');toast({text:`Drag from a unit to where it should go, or onto an enemy to attack. Amber dots mark units without orders. Then End turn.`,kind:'event'})}
function snapUnits(){const m={};for(const u of G.b.units)m[u.id]={men:u.men,morale:u.morale,rout:u.rout,gone:u.gone,order:u.order?Object.assign({},u.order):null,tgt:u.order&&u.order.kind==='attack'?u.order.target:null};return m}
function execTurn(){
  if(G.net&&!G.netGo&&G.mode==='plan'){netSubmit();return}
  if(G.mode!=='plan')return;sndInit();if(SND.ctx&&SND.ctx.state==='suspended')SND.ctx.resume();
  G.snap=snapUnits();G.ff=false;G.roundRouts=0;G.undo=[];$('mtip').hidden=true;tbContacts(G.b);G.q=tbBuildRound(G.b);G.mode='exec';snd('stamp');vib(25);$('report').hidden=true;for(const u of G.b.units)u._delta=null;updateTurnUI();updateCmds();snd('horn');
}
/* ----- turn-based round playback ----- */
function lossTxt(u,n){const T=TYPES[u.type];return T.per?Math.max(1,Math.round(n/T.per))+' '+(T.unit||''):fmt(n)}
function pill(c,x,y,text,dot){
  c.font='600 11.5px "IBM Plex Mono",monospace';c.textBaseline='middle';c.textAlign='left';
  const t=String(text).toUpperCase(),tw=c.measureText(t).width,w=tw+24,h=19;
  c.fillStyle='rgba(8,8,8,.88)';rr(c,x-w/2,y-h/2,w,h,h/2);c.fill();
  c.fillStyle=dot;c.beginPath();c.arc(x-w/2+10,y,3.4,0,7);c.fill();
  c.fillStyle='#fff';c.fillText(t,x-w/2+17,y+.5);
}
function tagUnit(u,text,dot,life){G.hits=G.hits.filter(h=>!(h.id===u.id&&h.tag));G.hits.push({id:u.id,x:u.x,y:u.y,text,dot,tag:true,side:u.side,life:life||2.4,max:life||2.4,stack:1})}
function caption(text,hi){const el=$('caption');const safe=t=>t.replace(/[&<>]/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;'}[m]));
  el.innerHTML=safe(text).split(' ').map(w=>hi&&w.replace(/[^A-Za-z'’,]/g,'').toUpperCase()===hi.toUpperCase()?`<em>${w}</em>`:w).join(' ');
  el.hidden=true;void el.offsetWidth;el.hidden=false;clearTimeout(el._t);el._t=setTimeout(()=>el.hidden=true,1700)}
function hitFloats(list){if(!list)return 0;let n=0;for(const r of list){if(r.lost<.5&&r.dm>-3)continue;n++;
  const stack=G.hits.filter(h=>h.id===r.u.id&&h.life>1.2&&!h.tag).length;G.hits.push({stack,id:r.u.id,x:r.u.x,y:r.u.y,text:(r.lost>=.5?'−'+lossTxt(r.u,r.lost).trim():'')+(r.dm<=-3?(r.lost>=.5?' · ':'')+r.dm+'%':''),side:r.u.side,life:1.9,rout:r.u.rout||r.u.gone});
    if((r.u.rout||r.u.gone)&&!r.u._routSeen){r.u._routSeen=1;onRout(r.u)}}
  return n}
/* ---------- the feel of the fight: kills, chevrons, routs, combos, slow motion ---------- */
function newStats(){return{routs:0,maxCombo:0,chargeRouts:0,flankRouts:0,genKilled:false,lostUnits:0,vetMax:0,promos:0,impacts:0}}
function stamp(text,sub,bad){const el=$('stamp');el.innerHTML=text.replace(/[<>&]/g,'')+(sub?`<small>${sub.replace(/[<>&]/g,'')}</small>`:'');el.className='stamp'+(bad?' bad':'');el.hidden=false;void el.offsetWidth;el.classList.add('go');clearTimeout(el._t);el._t=setTimeout(()=>{el.hidden=true;el.classList.remove('go')},1500)}
function credit(att,lost,vic){if(!att||!(lost>0))return;att.kills=(att.kills||0)+lost;
  const lv=att.kills>=att.maxMen*1.0?3:att.kills>=att.maxMen*.5?2:att.kills>=att.maxMen*.2?1:0;
  if(lv>(att.vet||0)&&att.type!=='gen'){att.q=(att.q||1)*Math.pow(1.07,lv-(att.vet||0));att.vet=lv;
    if(att.side==='P'){G.stats.vetMax=Math.max(G.stats.vetMax,lv);G.stats.promos++;tagUnit(att,'PROMOTED '+'▲'.repeat(lv),'#FFD45E',2.4);toast({text:`${att.name} earns ${['','its first','a second','a third'][lv]} chevron (+7% fighting)`,kind:'good'});snd('bell')}}}
function creditList(list,att){if(!list)return;for(const r of list){if(r.u.side===att.side)continue;credit(att,r.lost,r.u)}}
function creditMelee(list){if(!list)return;for(const r of list){const foes=(r.u.contacts||[]).filter(c=>c.side!==r.u.side&&!c.gone);if(!foes.length)continue;for(const f of foes)credit(f,r.lost/foes.length,r.u)}}
const COMBO=['','','Double rout','Triple rout','Massacre','Annihilation'];
function onRout(u){
  const b=G.b,nm=u.name.length>22?TYPES[u.type].label:u.name;
  if(u.side==='E'){G.stats.routs++;G.roundRouts=(G.roundRouts||0)+1;G.stats.maxCombo=Math.max(G.stats.maxCombo,G.roundRouts);
    const P=(u.contacts||[]).filter(c=>c.side==='P'&&!c.rout);if(P.length>=2||u._flanked||(u.contacts||[]).some(c=>c.side==='P'&&Math.abs(norm(Math.atan2(c.y-u.y,c.x-u.x)-u.facing))>1.05))G.stats.flankRouts++;
    if(G.curCharge)G.stats.chargeRouts++;
    if(u.type==='gen'){G.stats.genKilled=true;stamp(b.s.era==='modern'?'Command post destroyed':'General slain',nm)}
    else if(G.roundRouts>=2)stamp(COMBO[Math.min(5,G.roundRouts)],nm+' breaks');
    else stamp('Enemy breaks',nm);
    G.tscale=.22;G.shake=Math.min(6,G.shake+2.2);snd('stamp');vib([20,40,30]);
  }else{G.stats.lostUnits++;caption(`${nm} breaks`,'breaks');G.shake=Math.min(5,G.shake+1);if(u.type==='gen'){stamp('Your general falls',nm,true);G.tscale=.3}}
}
function banner(t){$('pausetag').innerHTML=t}
function tbTick(b,dt){
  const q=G.q;if(!q)return;
  let guard=0;
  while(q.length&&guard++<40){const it=q[0];
    if(!it._st){it._st=1;it.p=0;tbBegin(b,it)}
    if(b.result&&it.kind!=='endround'){q.length=0;break}
    it.p+=it.dur>0?dt/it.dur:1;dt=0;
    if(it.kind==='move')tbRunItem(b,it,Math.min(1,it.p));
    if(it.p<1)break;
    q.shift();
  }
  if(!q.length)G.q=null;
}
function tbBegin(b,it){
  const q=G.q;
  switch(it.kind){
    case 'banner':banner(`<b>Turn ${G.turn}</b> · ${it.text}`);snd(it.text.includes('enemy')?'stamp':'tok');if(it.text.includes('enemy'))caption(`${(b.s.sides[1]||'The enemy')} advances`,'advances');else caption(`${(b.s.sides[0]||'Your army')} moves`,'moves');break;
    case 'move':if(it.movers.some(m=>VEH.has(m.u.type)))snd('tank',.5);else snd('thud',.6);
      if(it.movers.some(m=>m.u.side==='E'))banner(`<b>Turn ${G.turn}</b> · The enemy moves`);break;
    case 'attack':{const pl0=it.u._plan,chg=pl0&&pl0.melee&&pl0.charge&&it.u.movedThisRound;G.curCharge=!!chg&&it.u.side==='P';const r=tbStrike(b,it);if(!r){it.dur=0;G.curCharge=false;break}creditList(r,it.u);
      if(chg){G.tscale=.35;G.shake=Math.min(6,G.shake+2.4);snd('boom',.7);vib(30);if(it.u.side==='P')G.stats.impacts++}
      if(chg){tagUnit(it.u,b.s.era==='modern'?'ASSAULT':'CHARGE','#F5C543',1.8);caption(`${it.u.name.length>22?TYPES[it.u.type].label:it.u.name} ${b.s.era==='modern'?'assaults':'charges'}`,b.s.era==='modern'?'assaults':'charges')}
      if(!TYPES[it.u.type].ranged||(it.u.contacts||[]).length&&!it.ow){snd('clash',.9);G.shake=Math.min(4,G.shake+1)}
      hitFloats(r);G.curCharge=false;for(const x of r)if(x.u.gone||x.u.rout)snd('boom',.5);
      if(it.ow){banner(`<b>Turn ${G.turn}</b> · Defensive fire`);caption(b.s.era==='ancient'||b.s.era==='medieval'?'The arrows fall':'Volley fire',b.s.era==='ancient'||b.s.era==='medieval'?'arrows':'volley')}break}
    case 'settle':tbContacts(b);it.dur=.05;break;
    case 'enemyplan':if(!G.net)tbEnemyReplan(b);break;
    case 'enemyphase':q.splice(1,0,...tbPhase(b,'E'));break;
    case 'overwatch':q.splice(1,0,...tbOverwatch(b));break;
    case 'melee':{const r=tbMeleeAll(b);if(!r.length){it.dur=0;break}creditMelee(r);banner(`<b>Turn ${G.turn}</b> · Close combat`);caption('The lines clash','clash');snd('clash');G.shake=Math.min(4,G.shake+1.2);hitFloats(r);it.dur=.7;break}
    case 'endround':tbEndRound(b);if(G.net&&G.net.role==='guest')b.result=null;while(b.msgs.length)toast(b.msgs.shift());break;
  }
}
const lossStr=(u,n)=>{const T=TYPES[u.type];return T.per?`${Math.max(1,Math.round(n/T.per))} ${T.unit}`:fmtFull(n)+' men'};
function endTurn(early){
  const b=G.b;G.mode='plan';if(!G.snap){updateTurnUI();return}
  const lines=[];
  for(const u of b.units){const s=G.snap[u.id];if(!s||s.gone)continue;
    const lost=Math.max(0,s.men-u.men),dm=Math.round(u.morale-s.morale);u._delta={lost,dm};
    const own=u.side==='P';
    if(!s.rout&&(u.rout||u.gone)){lines.push({own,pri:5,cls:own?'bad':'good',text:`${u.name} ${u.gone&&!u.rout?'was destroyed':'broke and is fleeing'}`});continue}
    if(own&&s.order&&!u.order&&u.contacts.length&&s.order.kind==='move'){const by=u.contacts.find(c=>!c.rout);lines.push({own,pri:3,cls:'warn',text:`${u.name} ran into ${by?by.name:'the enemy'} and stopped to fight`})}
    if(own&&s.tgt){const t=byId(b,s.tgt);if(t&&(t.gone||t.rout))lines.push({own,pri:3,cls:'good',text:`${u.name}: target ${t.name} ${t.gone?'destroyed':'routed'} · awaiting orders`})}
    if(own&&lost>u.maxMen*0.03)lines.push({own,pri:dm<-20||u._flanked?4:2,cls:dm<-20||u._flanked?'bad':'',text:`${u.name}: lost ${lossStr(u,lost)}, morale ${Math.max(0,Math.round(u.morale))}%${u._flanked?' · being flanked!':''}`});
    else if(!own&&lost>u.maxMen*0.04)lines.push({own,pri:2,cls:'good',text:`${u.name}: lost ${lossStr(u,lost)}, morale ${Math.max(0,Math.round(u.morale))}%`});
  }
  lines.sort((a,c)=>c.pri-a.pri);
  const pm=Math.round(sideMen(b,'P')/b.init.P*100),em=Math.round(sideMen(b,'E')/b.init.E*100);
  $('report').innerHTML=`<div class="rh"><b>Turn ${G.turn} report</b><span>Your army ${pm}% · ${b.s.sides[1]} ${em}%</span><button type="button" id="rep-x" aria-label="Close report">×</button></div>`+(lines.length?lines.slice(0,8).map(l=>`<div class="rl ${l.cls}">${l.text}</div>`).join(''):`<div class="rl">No contact this turn. The armies are closing in.</div>`);
  $('report').hidden=true;
  for(const t of G.toastEls)t.el.remove();G.toastEls=[];
  G.turn++;G.snap=null;updateTurnUI();updateCmds();snd('bell');
}
function updateTurnUI(){
  const pl=G.mode==='plan',ex=G.mode==='exec',dep=G.mode==='deploy',wt=G.mode==='wait';
  if(wt){$('stage').classList.add('paused');$('stage').classList.remove('executing');$('pausetag').innerHTML=`<b>Turn ${G.turn}</b> · Orders sent. Waiting for your opponent…`;$('b-exec').disabled=true;$('b-exec').innerHTML='<span>Waiting…</span>';$('b-pause').textContent='Waiting';return}
  $('stage').classList.toggle('paused',pl);$('stage').classList.toggle('executing',ex);
  if(pl){const left=G.b&&G.b.s.timer?Math.max(0,Math.ceil((G.b.s.timer.t-G.b.t)/TB.ROUND)):0;
    $('pausetag').innerHTML=`<b>Turn ${G.turn}</b> · Your orders. The blue ring is how far a unit gets this turn${left?` · <b>${G.b.s.timer.label}</b> in ${left} turn${left>1?'s':''}`:''}`}
  else if(!ex)$('pausetag').innerHTML='';
  $('b-exec').disabled=!(pl||dep);$('b-exec').innerHTML=dep?'<span>Begin battle</span><kbd>Enter</kbd>':ex?'<span>Resolving…</span><kbd>Space</kbd>':`<span>End turn ${G.turn}</span>${(()=>{const n=G.b?G.b.units.filter(u=>u.side==='P'&&!u.gone&&!u.rout&&!u.order&&!(u.contacts&&u.contacts.length)).length:0;return n?`<small class="idle">${n} idle</small>`:'<kbd>Enter</kbd>'})()}`;
  $('b-pause').textContent=ex?'Skip ahead':pl?'End turn':'Begin';
}
$('p-unit').addEventListener('pointerdown',e=>{const t=e.target.closest('.besttgt');if(!t||!G.b)return;const tg=byId(G.b,+t.dataset.target);if(tg)issue(tg,tg)});
$('b-begin').onclick=begin;$('b-pause').onclick=togglePause;$('b-exec').onclick=()=>{if(G.mode==='deploy')begin();else execTurn()};
$('b-speed').onclick=()=>{G.speed=G.speed===1?2:G.speed===2?3:G.speed===3?0.5:1;$('b-speed').textContent=(G.speed===0.5?'½':G.speed)+'×'};
$('b-restart').onclick=()=>{if(G.net)return toast({text:'Online battles cannot be restarted. Leave via Battles and send a new link.',kind:'event'});start(G.id)};$('b-menu').onclick=toMenu;
$('b-sound').onclick=()=>{SND.on=!SND.on;sndInit();try{localStorage.setItem('fc-sound',SND.on?'on':'off')}catch(e){}$('b-sound').textContent=SND.on?'♪':'✕';$('b-sound').title=SND.on?'Sound on':'Sound off'};$('b-sound').textContent=SND.on?'♪':'✕';
$('e-again').onclick=()=>{if(G.endAction==='muster')openMuster();else if(G.endAction==='newcamp')newCampaign(G.endEra);else start(G.id)};$('e-menu').onclick=toMenu;
for(const k of Object.keys(CMDS)){const f=CMDS[k];CMDS[k]=function(){if(G.b&&(G.mode==='plan'||G.mode==='deploy'))pushUndo(k==='rally'?[]:selUnits());return f.apply(this,arguments)}}
document.querySelectorAll('[data-cmd]').forEach(el=>el.addEventListener('click',()=>{CMDS[el.dataset.cmd]();updateCmds();updateRoster();updateTurnUI()}));
$('w-undo').onclick=()=>undo();
$('b-portrait').onclick=()=>{document.body.classList.add('portrait-ok');try{localStorage.setItem('fc-portrait','1')}catch(e){}setTimeout(resize,50)};
try{if(localStorage.getItem('fc-portrait'))document.body.classList.add('portrait-ok')}catch(e){}
window.addEventListener('orientationchange',()=>setTimeout(()=>{if(G.b&&G.mode!=='menu'){resize();fitView()}},300));
$('p-sound').onclick=()=>{$('b-sound').click();$('p-sound').textContent=SND.on?'Sound on':'Sound off'};$('p-sound').textContent=SND.on?'Sound on':'Sound off';
$('p-restart').onclick=()=>$('b-restart').click();$('p-speed').onclick=()=>{$('b-speed').click();$('p-speed').textContent='Anim '+$('b-speed').textContent};
document.querySelectorAll('[data-wing]').forEach(el=>el.addEventListener('click',()=>pickWing(el.dataset.wing)));
$('w-next').onclick=()=>nextIdle();
$('w-all').onclick=()=>{if(G.b)selectOnly(G.b.units.filter(u=>u.side==='P'&&!u.gone&&!u.rout).map(u=>u.id))};
$('z-in').onclick=()=>zoomBy(1.35,G.cssW/2,G.cssH/2);$('z-out').onclick=()=>zoomBy(1/1.35,G.cssW/2,G.cssH/2);$('z-fit').onclick=fitView;
$('r-l').onclick=()=>{V3.cam.yawT-=Math.PI/8};$('r-r').onclick=()=>{V3.cam.yawT+=Math.PI/8};
$('v-toggle').onclick=()=>setView(G.view==='3d'?'2d':'3d');
$('m-toggle').onclick=()=>setMini(!miniOn());
{const mm=$('mini');mm.addEventListener('pointerdown',e=>{e.preventDefault();e.stopPropagation();mm.setPointerCapture(e.pointerId);G.miniDrag=true;miniJump(e)});mm.addEventListener('pointermove',e=>{if(G.miniDrag)miniJump(e)});const up=()=>{G.miniDrag=false};mm.addEventListener('pointerup',up);mm.addEventListener('pointercancel',up)}
let rzT;window.addEventListener('resize',()=>{clearTimeout(rzT);rzT=setTimeout(()=>{if(G.mode==='menu')drawThumbs();else if(G.b)resize()},120)});
v3init(cv3);if(!has3d())$('v-toggle').hidden=true;
buildMenu();buildEndlessMenu();
setTimeout(refreshMeta,0);
if(document.fonts&&document.fonts.ready)document.fonts.ready.then(()=>{if(G.mode==='menu')drawThumbs()});
requestAnimationFrame(loop);

/* mechanical key feel: every key clicks and can be held down */
document.addEventListener('pointerdown',e=>{const b=e.target.closest&&e.target.closest('button:not(:disabled)');if(!b)return;sndInit();if(SND.ctx&&SND.ctx.state==='suspended')SND.ctx.resume();snd('click',1);vib(8)},true);
document.addEventListener('keydown',e=>{if(G.mode==='menu'||e.repeat)return;const map={v:'advance',c:'charge',s:'halt',b:'back',g:'stance',f:'fire',r:'rally'},k=map[e.key&&e.key.toLowerCase()];const el=k?document.querySelector(`[data-cmd="${k}"]`):e.key==='Enter'?$('b-exec'):null;if(el&&!el.disabled){el.classList.add('pressed');snd('click',1);setTimeout(()=>el.classList.remove('pressed'),120)}},true);

/* info drawer: help & unit details on demand, so the battle fits one screen */
function setInfo(on){document.body.classList.toggle('show-info',on);$('b-info').setAttribute('aria-expanded',on?'true':'false');$('b-info').classList.toggle('on',on);setTimeout(()=>{if(G.b)resize()},30)}
$('b-info').onclick=()=>setInfo(!document.body.classList.contains('show-info'));
$('b-panel-x').onclick=()=>setInfo(false);
window.addEventListener('resize',()=>{if(G.b&&G.mode!=='menu')clearTimeout(window._fitT),window._fitT=setTimeout(resize,150)});

/* ---------- meta: victory grades, stars, commander rank, medals, daily battle, unlocks ---------- */
const RANKS=['Recruit','Private','Corporal','Sergeant','Lieutenant','Captain','Major','Colonel','Brigadier','General','Marshal','Warlord'];
const RANK_XP=[0,250,650,1200,1900,2800,3900,5200,6800,8700,11000,14000];
function rankOf(xp){let i=0;while(i+1<RANK_XP.length&&xp>=RANK_XP[i+1])i++;
  if(i===RANK_XP.length-1){const extra=Math.floor((xp-RANK_XP[i])/4000);const base=RANK_XP[i]+extra*4000;return{i,name:RANKS[i]+(extra?' '+['','II','III','IV','V','VI','VII','VIII','IX','X'][Math.min(9,extra)]:''),lo:base,hi:base+4000}}
  return{i,name:RANKS[i],lo:RANK_XP[i],hi:RANK_XP[i+1]}}
const MEDALS=[
  {id:'first',n:'First blood',d:'Win a battle'},
  {id:'heroic',n:'Heroic',d:'Win a Heroic victory (3 stars)'},
  {id:'untouch',n:'Untouchable',d:'Win without a single unit breaking'},
  {id:'combo',n:'Massacre',d:'Break 3 enemy units in one turn'},
  {id:'charge',n:'Thunder charge',d:'Break an enemy with a charge'},
  {id:'anvil',n:'Hammer and anvil',d:'Break a unit caught in the flank'},
  {id:'vet',n:'Old guard',d:'Raise a unit to three chevrons'},
  {id:'king',n:'Kingslayer',d:'Bring down the enemy general'},
  {id:'last',n:'Last stand',d:'Win after losing two thirds of your army'},
  {id:'daily',n:'Daily duty',d:'Win a daily battle'},
  {id:'streak',n:'On fire',d:'Win the daily battle 3 days in a row'},
  {id:'stars15',n:'Collector',d:'Earn 15 stars'},
  {id:'hist',n:'Historian',d:'Win every historical battle'},
  {id:'ages',n:'Master of ages',d:'Win equal armies in every era'},
  {id:'duel',n:'Duelist',d:'Beat a friend online'},
];
function loadProg(){let p=null;try{p=JSON.parse(localStorage.getItem('fc-prog')||'null')}catch(e){}
  p=p||{};p.xp=p.xp||0;p.stars=p.stars||{};p.medals=p.medals||{};p.daily=p.daily||{last:'',streak:0,best:0};p.wins=p.wins||0;p.battles=p.battles||0;return p}
function saveProg(p){try{localStorage.setItem('fc-prog',JSON.stringify(p))}catch(e){}}
let PROG=loadProg();
const totalStars=()=>Object.values(PROG.stars).reduce((a,v)=>a+v,0);
const HIST=()=>Object.keys(SCEN).filter(id=>!SCEN[id].endless&&!SCEN[id].mirror);
function needStars(id){return 0}
function unlocked(id){return true}
const dayKey=d=>{const z=d||new Date();return z.getFullYear()+'-'+String(z.getMonth()+1).padStart(2,'0')+'-'+String(z.getDate()).padStart(2,'0')};
const dayNum=()=>Math.floor((Date.now()-new Date().getTimezoneOffset()*6e4)/864e5);
function dailyEra(){const ks=Object.keys(MIRROR);return ks[dayNum()%ks.length]}
function startDaily(){sndInit();snd('stamp');G.daily=true;start(buildMirrorScenario(dailyEra(),dayNum()*7919%1000003))}
function battleKey(b){const s=b.s;if(s.endless)return null;if(G.net)return null;if(G.daily)return null;if(s.mirror)return 'mirror-'+(s.eraKey||s.era);return G.id}

function gradeOf(b,win){
  const lossOf=side=>b.units.filter(u=>u.side===side).reduce((a,u)=>a+u.maxMen-u.men+u.fled+(u.rout&&!u.gone?u.men:0),0);
  const lp=lossOf('P')/b.init.P,le=lossOf('E')/b.init.E;
  if(win){if(lp<=.3)return{stars:3,name:'Heroic victory',lp,le};if(lp<=.55)return{stars:2,name:'Decisive victory',lp,le};return{stars:1,name:lp>.75?'Pyrrhic victory':'Close victory',lp,le}}
  return{stars:0,name:le>=.5?'Valiant defeat':'Crushing defeat',lp,le}
}
/* called once when a battle ends: returns what to show */
function metaEnd(b){
  const win=!!b.result.win,g=gradeOf(b,win),st=G.stats||newStats(),key=battleKey(b),before=PROG.xp,rank0=rankOf(before),lines=[];let xp=0;
  xp+=win?100:35;lines.push([win?'Victory':'Battle fought',win?100:35]);
  if(st.routs){xp+=st.routs*15;lines.push([st.routs+' units broken',st.routs*15])}
  if(g.stars){xp+=g.stars*50;lines.push([g.name,g.stars*50])}
  if(st.promos){xp+=st.promos*20;lines.push([st.promos+' promotions',st.promos*20])}
  let newStars=0;if(key&&g.stars>(PROG.stars[key]||0)){newStars=g.stars-(PROG.stars[key]||0);PROG.stars[key]=g.stars;xp+=newStars*60;lines.push(['New best',newStars*60])}
  let dailyMsg='';
  if(G.daily&&win){const today=dayKey(),y=new Date();y.setDate(y.getDate()-1);
    if(PROG.daily.last!==today){PROG.daily.streak=PROG.daily.last===dayKey(y)?PROG.daily.streak+1:1;PROG.daily.last=today;PROG.daily.best=Math.max(PROG.daily.best,PROG.daily.streak);const bonus=150+Math.min(6,PROG.daily.streak-1)*50;xp+=bonus;lines.push([`Daily battle · day ${PROG.daily.streak} streak`,bonus]);dailyMsg=`Daily streak: ${PROG.daily.streak} day${PROG.daily.streak>1?'s':''}`}}
  if(G.net&&win){xp+=120;lines.push(['Online win',120])}
  PROG.xp+=xp;PROG.battles++;if(win)PROG.wins++;
  // medals
  const got=[],give=id=>{if(!PROG.medals[id]){PROG.medals[id]=dayKey();got.push(MEDALS.find(m=>m.id===id))}};
  if(win)give('first');if(win&&g.stars===3)give('heroic');if(win&&!st.lostUnits)give('untouch');if(st.maxCombo>=3)give('combo');if(st.chargeRouts)give('charge');
  if(st.flankRouts)give('anvil');if(st.vetMax>=3)give('vet');if(st.genKilled)give('king');if(win&&g.lp>=.66)give('last');if(G.daily&&win)give('daily');if(PROG.daily.streak>=3)give('streak');
  if(totalStars()>=15)give('stars15');if(HIST().every(id=>PROG.stars[id]>0))give('hist');if(Object.keys(MIRROR).every(k=>PROG.stars['mirror-'+k]>0))give('ages');if(G.net&&win)give('duel');
  for(const m of got){PROG.xp+=75;xp+=75}if(got.length)lines.push([got.length+' medal'+(got.length>1?'s':''),got.length*75]);
  saveProg(PROG);
  const rank1=rankOf(PROG.xp),prevBest=key?(PROG.stars[key]||0):0;
  // why you missed the next star: the near-miss that makes you go again
  let next='';if(win&&g.stars<3)next=g.stars===2?`Lose under 30% for ★★★ · you lost ${Math.round(g.lp*100)}%`:`Lose under 55% for ★★ · you lost ${Math.round(g.lp*100)}%`;
  if(!win)next='Break the enemy before your army breaks to earn stars';
  return{win,g,xp,lines,before,after:PROG.xp,rank0,rank1,medals:got,key,newStars,next,dailyMsg,prevBest};
}
function nextBattle(){const s=G.b&&G.b.s;
  if(s&&s.mirror&&!G.daily&&!G.net){const ks=Object.keys(MIRROR),i=ks.indexOf(s.eraKey);const k=ks[(i+1)%ks.length];return{label:'Next era ›',go:()=>{sndInit();start(buildMirrorScenario(k))}}}
  const list=HIST().filter(id=>unlocked(id)&&id!==G.id);const pick=list.find(id=>!PROG.stars[id])||list.find(id=>(PROG.stars[id]||0)<3);
  if(pick)return{label:(PROG.stars[pick]?'Improve ':'Next: ')+SCEN[pick].name+' ›',go:()=>start(pick)};return null}

function renderEnd(m){
  $('e-grade').textContent=m.g.name;
  const st=$('e-stars');st.innerHTML='<i>★</i><i>★</i><i>★</i>';const is=[...st.children];
  is.forEach((el,i)=>setTimeout(()=>{el.classList.add('in');if(i<m.g.stars){el.classList.add('lit');snd(i===2?'bell':'thud',.8);vib(15)}},350+i*380));
  st.hidden=!!(G.b.s.endless);
  const pct=x=>Math.max(0,Math.min(100,x))+'%',r0=m.rank0,r1=m.rank1,up=r1.i>r0.i||r1.name!==r0.name;
  $('e-xp').innerHTML=`<div class="xprow"><b id="xp-rank">${r0.name}</b><span id="xp-num">${m.before.toLocaleString('en-US')} XP</span></div><div class="xpbar"><i id="xp-fill" style="width:${pct((m.before-r0.lo)/(r0.hi-r0.lo)*100)}"></i></div>
    <div class="xplines">${m.lines.map(l=>`<span>${l[0]} <em>+${l[1]}</em></span>`).join('')}</div>${m.next?`<div class="xplines"><span>${m.next}</span></div>`:''}${m.dailyMsg?`<div class="xplines"><span><em>${m.dailyMsg}</em></span></div>`:''}`;
  const t0=performance.now(),dur=1300;
  const tick=now=>{const k=Math.min(1,(now-t0-500)/dur);if(k<0){requestAnimationFrame(tick);return}const e=1-Math.pow(1-k,3),v=Math.round(m.before+(m.after-m.before)*e),r=rankOf(v);
    const n=$('xp-num');if(!n)return;n.textContent=v.toLocaleString('en-US')+' XP';$('xp-rank').textContent=r.name;$('xp-fill').style.transition='none';$('xp-fill').style.width=pct((v-r.lo)/(r.hi-r.lo)*100);
    if(k<1)requestAnimationFrame(tick);else if(up){const d=document.createElement('div');d.className='rankup';d.textContent='Promoted to '+r1.name;$('e-xp').prepend(d);snd('horn');vib([30,60,30])}};
  requestAnimationFrame(tick);
  $('e-medals').innerHTML=m.medals.map((md,i)=>`<span class="medal" style="animation-delay:${1.6+i*.25}s"><i>✦</i>${md.n}</span>`).join('');
  const nb=G.b.s.endless?null:nextBattle();$('e-next').hidden=!nb||!!G.net||(!m.win&&!G.b.s.mirror);if(nb){$('e-next').textContent=nb.label;$('e-next').onclick=nb.go}
  $('e-again').classList.toggle('primary',!m.win||$('e-next').hidden);
}

/* ---------- menu: commander strip, daily battle, stars and locks on the cards ---------- */
function buildCommander(){
  let box=$('cmdr');if(!box){box=document.createElement('div');box.id='cmdr';box.className='cmdr';$('cmdr-slot').appendChild(box)}
  const r=rankOf(PROG.xp),ms=Object.keys(PROG.medals).length,today=PROG.daily.last===dayKey(),era=ROSTER[dailyEra()].label;
  box.innerHTML=`<div class="cm-rank"><span class="cm-ins">${'▲'.repeat(Math.min(3,1+Math.floor(r.i/4)))}</span><div><small>Commander rank</small><b>${r.name}</b><div class="xpbar"><i style="width:${Math.max(2,Math.min(100,(PROG.xp-r.lo)/(r.hi-r.lo)*100))}%"></i></div><small>${PROG.xp.toLocaleString('en-US')} / ${r.hi.toLocaleString('en-US')} XP</small></div></div>
    <div class="cm-stat"><b>${totalStars()}</b><small>Stars</small></div><div class="cm-stat"><button type="button" class="ghost" id="cm-med"><b>${ms}/${MEDALS.length}</b><small>Medals</small></button></div><div class="cm-stat"><b>${PROG.wins}</b><small>Wins</small></div>
    <button type="button" class="cm-daily${today?' done':''}" id="cm-daily"><small>Daily battle · ${era}</small><b>${today?'Won today ✓':'Fight today’s battle'}</b><span>${PROG.daily.streak?`Streak ${PROG.daily.streak} day${PROG.daily.streak>1?'s':''}${today?'':' · keep it alive'}`:'Win daily to build a streak'}</span></button>
    <div class="cm-medals" id="cm-medals" hidden>${MEDALS.map(m=>`<span class="medal${PROG.medals[m.id]?'':' off'}" title="${m.d}"><i>✦</i>${m.n}<em>${m.d}</em></span>`).join('')}</div>`;
  $('cm-daily').onclick=startDaily;$('cm-med').onclick=()=>{$('cm-medals').hidden=!$('cm-medals').hidden};
}
function decorateCards(){
  document.querySelectorAll('#cards .card').forEach(el=>{const c=el.querySelector('canvas.thumb'),id=c&&c.dataset.id;if(!id)return;
    const n=PROG.stars[id]||0;let sr=el.querySelector('.cstars');if(!sr){sr=document.createElement('div');sr.className='cstars';el.querySelector('.cardtop').appendChild(sr)}
    sr.innerHTML='★★★'.split('').map((s,i)=>`<i class="${i<n?'lit':''}">★</i>`).join('');
    const ok=unlocked(id),btn=el.querySelector('.foot button');el.classList.toggle('locked',!ok);btn.disabled=!ok;btn.textContent=ok?(n?'Fight again':'Take command'):`Locked · ${needStars(id)} ★ needed`;});
  document.querySelectorAll('#mirror-eras .eracard').forEach((el,i)=>{const k=Object.keys(MIRROR)[i],n=PROG.stars['mirror-'+k]||0;let sr=el.querySelector('.cstars');if(!sr){sr=document.createElement('span');sr.className='cstars';el.appendChild(sr)}sr.innerHTML='★★★'.split('').map((s,j)=>`<i class="${j<n?'lit':''}">★</i>`).join('')});
}
function refreshMeta(){PROG=loadProg();buildCommander();decorateCards()}

/* =====================================================================
   MAP EDITOR
   A paused director view over the real map renderer. The editor never
   touches built-in battles: it works on a versioned draft document,
   kept on this device, that can be exported, imported and played.
   lifecycle: built-in generator -> editor document -> local draft -> validated export / play
   ===================================================================== */
const ED_SCHEMA='field-command-map',ED_VERSION=1,ED_WORLD='fc-1000x640',ED_KEY='fc-map-draft';
const ED_ERAS=[['ancient','Antiquity'],['medieval','Middle Ages'],['napoleon','Gunpowder age'],['modern','21st century'],['steam','Steampunk'],['magic','Fantasy']];
const ED_KINDS={hill:{label:'Hills',one:'Hill',col:'#E8D9A0'},wood:{label:'Woods',one:'Wood',col:'#5FA35A'},town:{label:'Towns',one:'Town',col:'#C9B49A'},marsh:{label:'Marsh',one:'Marsh',col:'#7AA58E'},crossing:{label:'Crossings',one:'Crossing',col:'#9FD3FF'},unit:{label:'Units',one:'Unit',col:'#FFFFFF'}};
const ED_LIM={ents:220,units:30,bytes:200000,name:48};
const ED={doc:null,hist:[],fut:[],sel:null,view:{x:0,y:0,z:1},snap:10,tool:null,side:'P',layers:{hill:1,wood:1,town:1,marsh:1,crossing:1,unit:1},q:'',bgKey:'',bg:null,drag:null,status:'',open:false,n:0,resetArm:0};

/* ---------- document ---------- */
const edId=()=>'e'+Date.now().toString(36)+(ED.n++).toString(36);
function edTypes(era){const r=ROSTER[era];return r?[...new Set(r.units.map(u=>u.type))]:[]}
function edRender(era){return ROSTER[era]?ROSTER[era].render:'ancient'}
function edUnitName(era,type,side,n){if(type==='gen')return side==='P'?'Your commander':'Enemy commander';const r=ROSTER[era],u=r&&r.units.find(x=>x.type===type);return (side==='E'?'Enemy ':'')+(u?u.name:TYPES[type].label)+(n>1?' '+['','','II','III','IV','V','VI'][Math.min(6,n)]:'')}
function edDefaultMen(era,type){if(type==='gen'){const r=ROSTER[era];return r&&r.units[0].men<200?40:400}const r=ROSTER[era],u=r&&r.units.find(x=>x.type===type);return u?u.men:1000}
function edNew(era,random){
  const seed=Math.floor(Math.random()*1e6),ents=[];
  if(random){const g=mirrorMap(era==='modern'?'modern':'ancient',seed);
    g.hills.forEach(h=>ents.push({id:edId(),kind:'hill',label:'Hill',x:h.cx,y:h.cy,rx:h.rx,ry:h.ry,h:Math.round(h.h)}));
    g.woods.forEach(w=>ents.push({id:edId(),kind:'wood',label:'Wood',x:w.cx,y:w.cy,rx:w.rx,ry:w.ry}));
    g.towns.forEach(t=>ents.push({id:edId(),kind:'town',label:'Town',x:(t.x0+t.x1)/2,y:(t.y0+t.y1)/2,w:t.x1-t.x0,d:t.y1-t.y0}));
    var river=g.river?{y0:g.river.y0,A:g.river.A,f:g.river.f,ph:g.river.ph}:null;
    if(g.river)g.river.cross.forEach(c=>ents.push({id:edId(),kind:'crossing',label:c.kind==='bridge'?'Bridge':'Ford',x:(c.x0+c.x1)/2,y:gRiverY(g,(c.x0+c.x1)/2),w:c.x1-c.x0,ctype:c.kind}))}
  const types=(MIRROR[era]||edTypes(era)).slice(0,8),cnt={};
  const add=(side,type,x,y)=>{const k=side+type;cnt[k]=(cnt[k]||0)+1;ents.push({id:edId(),kind:'unit',label:edUnitName(era,type,side,cnt[k]),x,y,side,type,men:edDefaultMen(era,type),facing:side==='P'?-90:90})};
  add('P','gen',500,600);add('E','gen',500,40);
  types.forEach((t,i)=>{const x=Math.round(130+i*(740/Math.max(1,types.length-1)));add('P',t,x,500);add('E',t,1000-x,140)});
  return {schema:ED_SCHEMA,version:ED_VERSION,world:ED_WORLD,savedAt:new Date().toISOString(),name:'My battlefield',era,river:random?river:null,ents};
}
function edValidate(doc){
  const bad=m=>({ok:false,err:m}),fin=v=>typeof v==='number'&&isFinite(v);
  if(!doc||typeof doc!=='object')return bad('Not a map file.');
  if(doc.schema!==ED_SCHEMA)return bad('This is not a Field Command map.');
  if(doc.version!==ED_VERSION)return bad('Unsupported map version '+doc.version+'.');
  if(doc.world!==ED_WORLD)return bad('This map was made for a different field size.');
  if(!ED_ERAS.some(e=>e[0]===doc.era))return bad('Unknown era “'+String(doc.era).slice(0,20)+'”.');
  if(typeof doc.name!=='string'||doc.name.length>ED_LIM.name)return bad('The map name is missing or too long.');
  if(!Array.isArray(doc.ents)||doc.ents.length>ED_LIM.ents)return bad('Too many objects (limit '+ED_LIM.ents+').');
  if(doc.river!=null){const r=doc.river;if(!fin(r.y0)||!fin(r.A)||!fin(r.f)||!fin(r.ph)||r.y0<60||r.y0>H-60||Math.abs(r.A)>40||r.f<30||r.f>300)return bad('The river settings are out of range.')}
  const ids=new Set(),types=edTypes(doc.era).concat(['gen']),side={P:{gen:0,n:0},E:{gen:0,n:0}};
  for(const e of doc.ents){
    if(!e||typeof e.id!=='string'||!e.id||e.id.length>40)return bad('An object has no valid id.');
    if(ids.has(e.id))return bad('Two objects share the id '+e.id+'.');ids.add(e.id);
    if(!ED_KINDS[e.kind])return bad('Unknown object kind “'+String(e.kind).slice(0,20)+'”.');
    if(!fin(e.x)||!fin(e.y)||e.x<0||e.x>W||e.y<0||e.y>H)return bad(e.label+' is off the map.');
    if(typeof e.label!=='string'||e.label.length>ED_LIM.name)return bad('An object name is missing or too long.');
    if(e.kind==='hill'&&!(fin(e.rx)&&fin(e.ry)&&fin(e.h)&&e.rx>=20&&e.rx<=400&&e.ry>=20&&e.ry<=300&&e.h>=4&&e.h<=70))return bad(e.label+': size or height out of range.');
    if((e.kind==='wood'||e.kind==='marsh')&&!(fin(e.rx)&&fin(e.ry)&&e.rx>=15&&e.rx<=300&&e.ry>=15&&e.ry<=250))return bad(e.label+': size out of range.');
    if(e.kind==='town'&&!(fin(e.w)&&fin(e.d)&&e.w>=30&&e.w<=260&&e.d>=24&&e.d<=200))return bad(e.label+': size out of range.');
    if(e.kind==='crossing'){if(!doc.river)return bad('A crossing needs a river.');if(!(fin(e.w)&&e.w>=30&&e.w<=120&&(e.ctype==='ford'||e.ctype==='bridge')))return bad(e.label+': crossing settings out of range.')}
    if(e.kind==='unit'){if(e.side!=='P'&&e.side!=='E')return bad(e.label+': unknown side.');if(!types.includes(e.type))return bad(e.label+': '+e.type+' does not belong to this era.');
      if(!(fin(e.men)&&e.men>=1&&e.men<=20000)||!fin(e.facing))return bad(e.label+': strength or facing out of range.');if(e.type==='gen')side[e.side].gen++;else side[e.side].n++}}
  for(const s of ['P','E']){const nm=s==='P'?'Your army':'The enemy';if(side[s].gen!==1)return bad(nm+' needs exactly one commander.');if(side[s].n<1)return bad(nm+' needs at least one unit besides the commander.');if(side[s].n+1>ED_LIM.units)return bad(nm+' has more than '+ED_LIM.units+' units.')}
  return {ok:true};
}
/* the document as the game's own map format */
function edGen(doc){
  const E=doc.ents,render=edRender(doc.era),block=render==='modern'||render==='steam';
  const g={theatre:doc.era==='magic'?'magic':'land',era:render,seed:7,hills:[],hillNames:[],woods:[],towns:[],river:null,marsh:[]};
  for(const e of E){if(e.kind==='hill'){g.hills.push({cx:e.x,cy:e.y,rx:e.rx,ry:e.ry,h:e.h});g.hillNames.push(e.label)}
    else if(e.kind==='wood')g.woods.push({cx:e.x,cy:e.y,rx:e.rx,ry:e.ry});else if(e.kind==='marsh')g.marsh.push({cx:e.x,cy:e.y,rx:e.rx,ry:e.ry});
    else if(e.kind==='town')g.towns.push({x0:e.x-e.w/2,x1:e.x+e.w/2,y0:e.y-e.d/2,y1:e.y+e.d/2,block})}
  if(doc.river){g.river=Object.assign({},doc.river,{cross:E.filter(e=>e.kind==='crossing').map(e=>({x0:e.x-e.w/2,x1:e.x+e.w/2,kind:e.ctype}))})}
  if(!g.marsh.length)delete g.marsh;
  return g}
function edScenario(doc,id){
  const g=edGen(doc),render=edRender(doc.era),U=doc.ents.filter(e=>e.kind==='unit');let k=0;
  const sp=(e)=>{const o={name:e.label,type:e.type,x:e.x,y:e.y,men:Math.round(e.men),f:e.facing*Math.PI/180};if(e.side==='E')o.ai=e.type==='gen'?A('general'):A(k%5===4?'skirmish':'advance',(k++)%4);return o};
  const P=U.filter(e=>e.side==='P').map(sp),En=U.filter(e=>e.side==='E').map(sp);
  const dep=Math.max(250,Math.min(H-80,Math.min(...P.map(u=>u.y))-30));
  delete decorCache[id];delete RELIEF[id];
  addScen(id,{custom:true,group:'custom',theme:THEME_OF[doc.era]||'modern',name:doc.name||'Custom battle',year:'Custom',place:'Your own map',you:'You',sides:['Your army','The enemy'],diff:'Custom',era:render,gen:g,
    teaser:'A battlefield you made in the map editor.',objective:'Break the enemy army',deploy:dep,leth:LETH[doc.era]||1,
    brief:['This is your own map. Use the ground you placed: hills for the high ground, woods to hide, towns for cover.'],
    player:P,enemy:En,events:[{t:1,msg:'The enemy advances.'}],history:'A custom battle made in the Field Command map editor.'});
  return id}

/* ---------- history and draft ---------- */
function edCommit(note){ED.hist.push(JSON.stringify(ED.doc));if(ED.hist.length>80)ED.hist.shift();ED.fut=[];ED.doc.savedAt=new Date().toISOString();edSave();edDirty();if(note)edStatus(note)}
function edPre(){return JSON.stringify(ED.doc)}
function edPush(prev){ED.hist.push(prev);if(ED.hist.length>80)ED.hist.shift();ED.fut=[];ED.doc.savedAt=new Date().toISOString();edSave();edDirty()}
function edUndo(){if(!ED.hist.length)return;ED.fut.push(JSON.stringify(ED.doc));ED.doc=JSON.parse(ED.hist.pop());edSave();edDirty();edStatus('Undone')}
function edRedo(){if(!ED.fut.length)return;ED.hist.push(JSON.stringify(ED.doc));ED.doc=JSON.parse(ED.fut.pop());edSave();edDirty();edStatus('Redone')}
function edSave(){try{localStorage.setItem(ED_KEY,JSON.stringify(ED.doc))}catch(e){}}
function edLoadDraft(){try{const t=localStorage.getItem(ED_KEY);if(!t||t.length>ED_LIM.bytes)return null;const d=JSON.parse(t);return edValidate(d).ok?d:null}catch(e){return null}}
function edStatus(t){ED.status=t;const el=$('ed-status');if(el)el.textContent=edStatusText()}
function edStatusText(){const t=ED.doc&&ED.doc.savedAt?new Date(ED.doc.savedAt).toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'}):'';return 'Draft only · on this device'+(t?' · saved '+t:'')+(ED.status?' · '+ED.status:'')}
function edDirty(){ED.bgKey='';if(ED.sel&&!ED.doc.ents.some(e=>e.id===ED.sel))ED.sel=null;edOutliner();edInspector();edBar();edDraw()}
function edMenuNote(){const d=edLoadDraft(),n=$('ed-note'),p=$('ed-play-draft');if(!n)return;if(d){n.textContent=`Draft “${d.name}” · ${ED_ERAS.find(e=>e[0]===d.era)[1]} · ${d.ents.length} objects`;p.hidden=false}else{n.textContent='No draft yet. The editor starts you on a random field.';p.hidden=true}}

/* ---------- open / close ---------- */
function edOpen(){
  sndInit&&sndInit();if(!ED.built)edBuild();
  const d=edLoadDraft();if(d){ED.doc=d;ED.status='Draft restored'}else{ED.doc=edNew('ancient',true);ED.status='New random field';edSave()}
  ED.hist=[];ED.fut=[];ED.sel=null;ED.tool=null;
  $('menu').hidden=true;document.querySelector('.mast').hidden=true;$('editor').hidden=false;document.body.classList.add('editing');ED.open=true;
  edResize();edFit();edDirty();
}
function edClose(){ED.open=false;$('editor').hidden=true;document.body.classList.remove('editing');$('menu').hidden=false;document.querySelector('.mast').hidden=false;edMenuNote()}
function edPlay(){const v=edValidate(ED.doc);if(!v.ok){edStatus(v.err);edFlash(v.err);return}
  const id='custom_'+Date.now().toString(36);edScenario(ED.doc,id);ED.open=false;$('editor').hidden=true;document.body.classList.remove('editing');document.querySelector('.mast').hidden=false;start(id)}

/* ---------- UI ---------- */
function edBuild(){
  ED.built=true;const box=$('editor');
  box.innerHTML=`<div class="ed">
  <header class="ed-bar">
    <button type="button" id="ed-back" aria-label="Back to menu">‹ Menu</button>
    <label class="ed-name"><span class="sr">Map name</span><input id="ed-title" maxlength="${ED_LIM.name}" spellcheck="false"></label>
    <label class="ed-sel"><span>Era</span><select id="ed-era">${ED_ERAS.map(e=>`<option value="${e[0]}">${e[1]}</option>`).join('')}</select></label>
    <span class="ed-grp"><button type="button" id="ed-undo" aria-label="Undo" title="Undo (Ctrl+Z)">↶</button><button type="button" id="ed-redo" aria-label="Redo" title="Redo (Ctrl+Y)">↷</button></span>
    <label class="ed-sel"><span>Snap</span><select id="ed-snap"><option value="0">Off</option><option value="5">5</option><option value="10" selected>10</option><option value="25">25</option></select></label>
    <button type="button" id="ed-fit" title="Frame the map (F)">Fit</button>
    <span class="ed-grp"><button type="button" id="ed-new">New field</button><button type="button" id="ed-import">Import</button><button type="button" id="ed-export">Export</button><button type="button" id="ed-reset">Reset</button></span>
    <input type="file" id="ed-file" accept="application/json,.json" hidden>
    <span class="ed-status" id="ed-status" role="status"></span>
    <button type="button" class="primary" id="ed-play">Play this map ▶</button>
  </header>
  <aside class="ed-out" aria-label="Outliner">
    <div class="ed-add"><span class="ed-h">Add</span>
      <div class="ed-tools">${['hill','wood','town','marsh'].map(k=>`<button type="button" data-tool="${k}">${ED_KINDS[k].one}</button>`).join('')}<button type="button" data-tool="river">River</button><button type="button" data-tool="crossing">Crossing</button></div>
      <div class="ed-tools ed-units"><span class="ed-side"><button type="button" data-side="P" aria-pressed="true">Yours</button><button type="button" data-side="E" aria-pressed="false">Enemy</button></span><select id="ed-utype" aria-label="Unit type"></select><button type="button" data-tool="unit">Place unit</button></div>
      <p class="ed-tip" id="ed-tip">Pick a tool, then click the map.</p></div>
    <div class="ed-layers"><span class="ed-h">Layers</span><div id="ed-layers"></div></div>
    <label class="ed-search"><span class="sr">Search</span><input id="ed-q" placeholder="Search objects" spellcheck="false"></label>
    <div class="ed-list" id="ed-list" role="listbox" aria-label="Objects"></div>
  </aside>
  <div class="ed-view"><canvas id="ed-cv" tabindex="0" aria-label="Map editor view"></canvas>
    <div class="ed-legend"><span><i style="background:#6FA8FF"></i>Your army</span><span><i style="background:#FF6A5A"></i>Enemy</span><span><i class="dash"></i>Your deploy line</span><span>Wheel zoom · right-drag or Space-drag pan · F frame · R turn · Del remove</span></div>
    <div class="ed-flash" id="ed-flash" hidden></div></div>
  <aside class="ed-insp" id="ed-insp" aria-label="Inspector"></aside>
</div>`;
  $('ed-back').onclick=edClose;$('ed-undo').onclick=edUndo;$('ed-redo').onclick=edRedo;$('ed-fit').onclick=()=>{edFit();edDraw()};$('ed-play').onclick=edPlay;
  $('ed-title').onchange=e=>{const p=edPre();ED.doc.name=e.target.value.trim().slice(0,ED_LIM.name)||'My battlefield';edPush(p)};
  $('ed-era').onchange=e=>{const era=e.target.value,p=edPre(),ok=edTypes(era).concat(['gen']);let dropped=0;
    ED.doc.ents.forEach(u=>{if(u.kind!=='unit'||ok.includes(u.type))return;const t=edTypes(era)[0];u.type=t;u.men=edDefaultMen(era,t);u.label=edUnitName(era,t,u.side,1);dropped++});
    ED.doc.era=era;edPush(p);edStatus(dropped?dropped+' units changed to fit the era':'Era changed')};
  $('ed-snap').onchange=e=>{ED.snap=+e.target.value};
  $('ed-new').onclick=()=>{const p=edPre();ED.doc=edNew(ED.doc.era,true);ED.sel=null;edPush(p);edFit();edStatus('New random field (undo to go back)')};
  $('ed-export').onclick=edExport;$('ed-import').onclick=()=>$('ed-file').click();$('ed-file').onchange=edImport;
  $('ed-reset').onclick=()=>{const b=$('ed-reset');if(Date.now()-ED.resetArm<3000){const p=edPre();ED.doc=edNew(ED.doc.era,false);ED.sel=null;edPush(p);b.textContent='Reset';edStatus('Reset to an empty field (undo to go back)');ED.resetArm=0;return}ED.resetArm=Date.now();b.textContent='Sure? Reset';setTimeout(()=>{b.textContent='Reset'},3000)};
  $('ed-q').oninput=e=>{ED.q=e.target.value.toLowerCase();edOutliner()};
  box.querySelectorAll('[data-tool]').forEach(b=>b.onclick=()=>{ED.tool=ED.tool===b.dataset.tool?null:b.dataset.tool;if(ED.tool==='river'){ED.tool=null;edToggleRiver();return}edBar()});
  box.querySelectorAll('[data-side]').forEach(b=>b.onclick=()=>{ED.side=b.dataset.side;edBar()});
  const cv=$('ed-cv');cv.addEventListener('pointerdown',edDown);cv.addEventListener('pointermove',edMove);cv.addEventListener('pointerup',edUp);cv.addEventListener('pointercancel',edUp);
  cv.addEventListener('wheel',e=>{e.preventDefault();const r=cv.getBoundingClientRect();edZoom(e.deltaY<0?1.15:1/1.15,e.clientX-r.left,e.clientY-r.top)},{passive:false});
  cv.addEventListener('contextmenu',e=>e.preventDefault());
  window.addEventListener('resize',()=>{if(ED.open){edResize();edDraw()}});
  document.addEventListener('keydown',edKey);document.addEventListener('keyup',e=>{if(e.code==='Space')ED.space=false});
}
function edBar(){if(!ED.built)return;$('ed-title').value=ED.doc.name;$('ed-era').value=ED.doc.era;$('ed-undo').disabled=!ED.hist.length;$('ed-redo').disabled=!ED.fut.length;$('ed-status').textContent=edStatusText();
  document.querySelectorAll('[data-tool]').forEach(b=>b.setAttribute('aria-pressed',b.dataset.tool===ED.tool||(b.dataset.tool==='river'&&!!ED.doc.river)?'true':'false'));
  document.querySelectorAll('[data-side]').forEach(b=>b.setAttribute('aria-pressed',b.dataset.side===ED.side?'true':'false'));
  const sel=$('ed-utype'),cur=sel.value,ts=['gen'].concat(edTypes(ED.doc.era));sel.innerHTML=ts.map(t=>`<option value="${t}">${t==='gen'?'Commander':TYPES[t].label}</option>`).join('');if(ts.includes(cur))sel.value=cur;else sel.value=ts[1]||'gen';
  $('ed-tip').textContent=ED.tool?(ED.tool==='crossing'&&!ED.doc.river?'Add a river first.':`Click the map to place ${ED.tool==='unit'?'the unit':'a '+ED_KINDS[ED.tool].one.toLowerCase()}. Esc to stop.`):'Pick a tool, then click the map.'}
function edToggleRiver(){const p=edPre();if(ED.doc.river){ED.doc.river=null;ED.doc.ents=ED.doc.ents.filter(e=>e.kind!=='crossing');edPush(p);edStatus('River removed')}else{ED.doc.river={y0:320,A:10,f:80,ph:0};edPush(p);edStatus('River added: drag it in the inspector, then add crossings')}ED.sel=null;edInspector()}
function edVisible(e){return ED.layers[e.kind]}
function edOutliner(){if(!ED.built)return;
  const L=$('ed-layers');L.innerHTML='';for(const k of Object.keys(ED_KINDS)){const n=ED.doc.ents.filter(e=>e.kind===k).length;const lb=document.createElement('label');lb.className='ed-layer';lb.innerHTML=`<input type="checkbox" ${ED.layers[k]?'checked':''}><i style="background:${ED_KINDS[k].col}"></i>${ED_KINDS[k].label}<small>${n}</small>`;lb.querySelector('input').onchange=e=>{ED.layers[k]=e.target.checked?1:0;edOutliner();edDraw()};L.appendChild(lb)}
  const list=$('ed-list');list.innerHTML='';const q=ED.q;
  const ents=ED.doc.ents.filter(e=>edVisible(e)&&(!q||(e.label+' '+e.kind+' '+(e.type||'')+' '+(e.side==='E'?'enemy':e.side==='P'?'yours':'')).toLowerCase().includes(q)));
  for(const e of ents){const b=document.createElement('button');b.type='button';b.className='ed-item'+(e.id===ED.sel?' on':'');b.setAttribute('role','option');b.setAttribute('aria-selected',e.id===ED.sel?'true':'false');
    const dot=e.kind==='unit'?(e.side==='P'?'#6FA8FF':'#FF6A5A'):ED_KINDS[e.kind].col;b.innerHTML=`<i style="background:${dot}"></i><span>${e.label}</span><small>${e.kind==='unit'?(e.type==='gen'?'Commander':TYPES[e.type].label):ED_KINDS[e.kind].one}</small>`;
    b.onclick=()=>{ED.sel=e.id;edFocus(e);edOutliner();edInspector();edDraw()};list.appendChild(b)}
  if(!ents.length)list.innerHTML='<p class="ed-empty">Nothing matches.</p>'}
function edField(label,key,val,opt){opt=opt||{};const id='ef-'+key;
  if(opt.select)return `<label class="ed-f"><span>${label}</span><select data-k="${key}" id="${id}">${opt.select.map(o=>`<option value="${o[0]}"${String(o[0])===String(val)?' selected':''}>${o[1]}</option>`).join('')}</select></label>`;
  return `<label class="ed-f"><span>${label}</span><input data-k="${key}" id="${id}" ${opt.text?'type="text" maxlength="'+ED_LIM.name+'"':`type="number" step="${opt.step||1}" min="${opt.min}" max="${opt.max}"`} value="${opt.text?String(val).replace(/"/g,'&quot;'):Math.round(val*10)/10}">${opt.unit?`<em>${opt.unit}</em>`:''}</label>`}
function edInspector(){if(!ED.built)return;const box=$('ed-insp'),e=ED.doc.ents.find(x=>x.id===ED.sel),mp=mPer(edRender(ED.doc.era));
  if(!e){const r=ED.doc.river;box.innerHTML=`<div class="ed-h">Map</div><p class="ed-help">${ED.doc.ents.length} objects. Select something on the map or in the list to edit it.</p>
    ${r?`<div class="ed-h">River</div>${edField('Position (north to south)','r.y0',r.y0,{min:60,max:H-60,unit:'map units'})}${edField('Bends','r.A',r.A,{min:0,max:40})}${edField('Bend length','r.f',r.f,{min:30,max:300})}${edField('Bend offset','r.ph',r.ph,{min:0,max:6.3,step:.1})}<p class="ed-help">The river blocks movement except at crossings.</p>`:'<p class="ed-help">No river. Use Add › River.</p>'}
    <div class="ed-h">What the ground does</div><ul class="ed-rules"><li><b>Hills</b> give high ground: units on them hit harder and take less fire.</li><li><b>Woods</b> hide units and slow cavalry and vehicles.</li><li><b>Towns</b> give cover against fire.</li><li><b>Marsh</b> slows and tires everyone.</li><li><b>Rivers</b> can only be crossed at fords and bridges.</li></ul>`;edWire(box,null);return}
  let h=`<div class="ed-h">${e.kind==='unit'?(e.side==='P'?'Your unit':'Enemy unit'):ED_KINDS[e.kind].one}</div>`+edField('Name','label',e.label,{text:true})+edField('X','x',e.x,{min:0,max:W,unit:Math.round(e.x*mp)+' m'})+edField('Y','y',e.y,{min:0,max:H,unit:Math.round(e.y*mp)+' m'});
  if(e.kind==='hill')h+=edField('Width','rx',e.rx,{min:20,max:400})+edField('Depth','ry',e.ry,{min:20,max:300})+edField('Height','h',e.h,{min:4,max:70});
  if(e.kind==='wood'||e.kind==='marsh')h+=edField('Width','rx',e.rx,{min:15,max:300})+edField('Depth','ry',e.ry,{min:15,max:250});
  if(e.kind==='town')h+=edField('Width','w',e.w,{min:30,max:260})+edField('Depth','d',e.d,{min:24,max:200});
  if(e.kind==='crossing')h+=edField('Type','ctype',e.ctype,{select:[['ford','Ford (slow)'],['bridge','Bridge']]})+edField('Width','w',e.w,{min:30,max:120});
  if(e.kind==='unit'){const T=TYPES[e.type],R=T.ranged;h+=edField('Side','side',e.side,{select:[['P','Your army'],['E','Enemy']]})+edField('Type','type',e.type,{select:[['gen','Commander']].concat(edTypes(ED.doc.era).map(t=>[t,TYPES[t].label]))})+edField('Strength','men',e.men,{min:1,max:20000,unit:T.unit||'men'})+edField('Facing','facing',e.facing,{min:-180,max:180,unit:'°'});
    const role=ROLE[e.type]||'melee';h+=`<div class="ed-unitinfo"><span class="ed-chess" style="background:${ROLE_COL[role]}">${CHESS[role]}</span><div><b>${ROLE_WORD[role]} · ${CHESS_NAME[role]}</b><small>${TYPE_NOTE[e.type]||''}</small>${R?`<small>Range ${Math.round(R.range*mp)} m · ${WNAME[R.w]||R.w}</small>`:''}<small>Moves about ${Math.round(T.speed*TB.MOVE*mp)} m a turn</small></div></div>`}
  h+=`<div class="ed-acts"><button type="button" id="ed-dup">Duplicate</button><button type="button" id="ed-del">Remove</button></div><p class="ed-help ed-src">id ${e.id}</p>`;
  box.innerHTML=h;edWire(box,e);
  $('ed-del').onclick=()=>{const p=edPre();ED.doc.ents=ED.doc.ents.filter(x=>x!==e);ED.sel=null;edPush(p);edStatus('Removed '+e.label)};
  $('ed-dup').onclick=()=>{const p=edPre(),c=Object.assign({},e,{id:edId(),label:(e.label+' copy').slice(0,ED_LIM.name),x:Math.min(W-10,e.x+30),y:Math.min(H-10,e.y+20)});ED.doc.ents.push(c);ED.sel=c.id;edPush(p);edStatus('Duplicated')}}
function edWire(box,e){box.querySelectorAll('[data-k]').forEach(inp=>inp.onchange=()=>{const k=inp.dataset.k,p=edPre();let v=inp.type==='number'?+inp.value:inp.value;
  if(k.startsWith('r.')){const kk=k.slice(2),lim={y0:[60,H-60],A:[0,40],f:[30,300],ph:[0,6.3]}[kk];if(!isFinite(v))return edInspector();ED.doc.river[kk]=Math.max(lim[0],Math.min(lim[1],v));edSnapCross();edPush(p);return}
  if(inp.type==='number'){if(!isFinite(v))return edInspector();const mn=+inp.min,mx=+inp.max;v=Math.max(mn,Math.min(mx,v))}
  if(k==='label'){v=String(v).trim().slice(0,ED_LIM.name)||ED_KINDS[e.kind].one}
  if(k==='type'){e.men=edDefaultMen(ED.doc.era,v);if(v==='gen'){const other=ED.doc.ents.find(x=>x!==e&&x.kind==='unit'&&x.side===e.side&&x.type==='gen');if(other){edFlash('That side already has a commander.');return edInspector()}}}
  if(k==='side'&&e.type==='gen'){const other=ED.doc.ents.find(x=>x!==e&&x.kind==='unit'&&x.side===v&&x.type==='gen');if(other){edFlash('That side already has a commander.');return edInspector()}}
  e[k]=v;if(e.kind==='crossing')edSnapCross();edPush(p)})}
function edSnapCross(){if(!ED.doc.river)return;const g={river:ED.doc.river};for(const c of ED.doc.ents)if(c.kind==='crossing')c.y=gRiverY(g,c.x)}
function edFlash(t){const f=$('ed-flash');if(!f)return;f.textContent=t;f.hidden=false;clearTimeout(ED.ft);ED.ft=setTimeout(()=>{f.hidden=true},2600)}

/* ---------- view ---------- */
function edResize(){const cv=$('ed-cv'),r=cv.parentElement.getBoundingClientRect(),dpr=Math.min(2,window.devicePixelRatio||1);cv.width=Math.max(10,Math.round(r.width*dpr));cv.height=Math.max(10,Math.round(r.height*dpr));ED.dpr=dpr;ED.cw=r.width;ED.ch=r.height}
function edBase(){return Math.min(ED.cw/W,ED.ch/H)*.94}
function edScale(){return edBase()*ED.view.z}
function edFit(){ED.view.z=1;const s=edScale();ED.view.x=W/2-ED.cw/2/s;ED.view.y=H/2-ED.ch/2/s}
function edW2S(x,y){const s=edScale();return[(x-ED.view.x)*s,(y-ED.view.y)*s]}
function edS2W(x,y){const s=edScale();return[x/s+ED.view.x,y/s+ED.view.y]}
function edZoom(f,sx,sy){const [wx,wy]=edS2W(sx,sy);ED.view.z=Math.max(.8,Math.min(6,ED.view.z*f));const s=edScale();ED.view.x=wx-sx/s;ED.view.y=wy-sy/s;edDraw()}
function edFocus(e){const s0=edScale(),z=Math.max(ED.view.z,2.2);const fromX=ED.view.x,fromY=ED.view.y,fromZ=ED.view.z;ED.view.z=z;const s=edScale();const tx=e.x-ED.cw/2/s,ty=e.y-ED.ch/2/s;
  if(window.matchMedia&&matchMedia('(prefers-reduced-motion:reduce)').matches){ED.view.x=tx;ED.view.y=ty;return}
  ED.view.z=fromZ;const t0=performance.now();cancelAnimationFrame(ED.anim);const step=now=>{const k=Math.min(1,(now-t0)/260),q=1-Math.pow(1-k,3);ED.view.z=fromZ+(z-fromZ)*q;const ss=edScale();
    const cx=(fromX+ED.cw/2/s0)+(e.x-(fromX+ED.cw/2/s0))*q,cy=(fromY+ED.ch/2/s0)+(e.y-(fromY+ED.ch/2/s0))*q;ED.view.x=cx-ED.cw/2/ss;ED.view.y=cy-ED.ch/2/ss;edDraw();if(k<1)ED.anim=requestAnimationFrame(step)};ED.anim=requestAnimationFrame(step)}
function edBg(){const key=JSON.stringify([ED.doc.era,ED.doc.river,ED.doc.ents.filter(e=>e.kind!=='unit'&&edVisible(e))]);if(key===ED.bgKey&&ED.bg)return ED.bg;
  const id='_edit';const g=edGen(ED.doc);if(!ED.layers.hill)g.hills=[];if(!ED.layers.wood)g.woods=[];if(!ED.layers.town)g.towns=[];if(!ED.layers.marsh)delete g.marsh;
  SCEN[id]={gen:g,era:g.era,player:[],enemy:[],events:[],terrain:(x,y)=>genTerrain(g,x,y),hidden:true};delete decorCache[id];
  const c=ED.bg||document.createElement('canvas');c.width=1500;c.height=Math.round(1500*H/W);const t=c.getContext('2d');t.setTransform(1,0,0,1,0,0);t.clearRect(0,0,c.width,c.height);try{drawScene(t,c.width/W,id,'2d')}catch(err){t.fillStyle='#3d5230';t.fillRect(0,0,c.width,c.height)}
  delete SCEN[id];ED.bg=c;ED.bgKey=key;return c}
function edDraw(){if(!ED.open)return;const cv=$('ed-cv'),c=cv.getContext('2d'),dpr=ED.dpr||1,s=edScale();c.setTransform(dpr,0,0,dpr,0,0);c.fillStyle='#121417';c.fillRect(0,0,ED.cw,ED.ch);
  const [ox,oy]=edW2S(0,0);c.save();c.shadowColor='rgba(0,0,0,.6)';c.shadowBlur=24;c.drawImage(edBg(),ox,oy,W*s,H*s);c.restore();
  // deploy line
  const P=ED.doc.ents.filter(e=>e.kind==='unit'&&e.side==='P');if(P.length){const dep=Math.max(250,Math.min(H-80,Math.min(...P.map(u=>u.y))-30)),[ax,ay]=edW2S(0,dep),[bx]=edW2S(W,dep);c.setLineDash([8,6]);c.strokeStyle='rgba(111,168,255,.8)';c.lineWidth=1.5;c.beginPath();c.moveTo(ax,ay);c.lineTo(bx,ay);c.stroke();c.setLineDash([])}
  // terrain handles
  for(const e of ED.doc.ents){if(e.kind==='unit'||!edVisible(e))continue;const [x,y]=edW2S(e.x,e.y),on=e.id===ED.sel;c.strokeStyle=on?'#FF6A2B':'rgba(255,255,255,.35)';c.lineWidth=on?2.5:1;c.setLineDash(on?[]:[4,4]);c.beginPath();
    if(e.kind==='town'||e.kind==='crossing'){const w=e.w*s,d=(e.kind==='crossing'?34:e.d)*s;c.rect(x-w/2,y-d/2,w,d)}else c.ellipse(x,y,e.rx*s,e.ry*s,0,0,7);c.stroke();c.setLineDash([]);
    c.fillStyle=on?'#FF6A2B':ED_KINDS[e.kind].col;c.beginPath();c.arc(x,y,on?6:4,0,7);c.fill();c.strokeStyle='#111';c.lineWidth=1.2;c.stroke();
    if(on||ED.view.z>1.6){c.font='600 12px "Space Grotesk",sans-serif';c.textAlign='center';c.lineWidth=3;c.strokeStyle='rgba(0,0,0,.75)';c.strokeText(e.label,x,y-10);c.fillStyle='#fff';c.fillText(e.label,x,y-10)}}
  // units
  if(ED.layers.unit)for(const e of ED.doc.ents){if(e.kind!=='unit')continue;const T=TYPES[e.type],[x,y]=edW2S(e.x,e.y),on=e.id===ED.sel,col=e.side==='P'?'#6FA8FF':'#FF6A5A',a=e.facing*Math.PI/180;
    c.save();c.translate(x,y);c.rotate(a+Math.PI/2);const w=(e.type==='gen'?24:T.w)*s,d=Math.max(6,(e.type==='gen'?14:T.d)*s);c.fillStyle=col+'aa';c.strokeStyle=on?'#FF6A2B':'#111';c.lineWidth=on?2.5:1.2;c.fillRect(-w/2,-d/2,w,d);c.strokeRect(-w/2,-d/2,w,d);
    c.fillStyle='#fff';c.beginPath();c.moveTo(0,-d/2-8);c.lineTo(5,-d/2-1);c.lineTo(-5,-d/2-1);c.closePath();c.fill();c.restore();
    roleBadge(c,x,y-d/2-16,Math.max(9,Math.min(14,8*ED.view.z)),e.type,e.side,{noBrackets:true});
    if(on||ED.view.z>1.4){c.font='600 11.5px "Space Grotesk",sans-serif';c.textAlign='center';c.lineWidth=3;c.strokeStyle='rgba(0,0,0,.8)';const ly=y+d/2+14;c.strokeText(e.label,x,ly);c.fillStyle='#fff';c.fillText(e.label,x,ly)}}
  // placement ghost
  if(ED.tool&&ED.hover){const [x,y]=edW2S(ED.hover[0],ED.hover[1]);c.strokeStyle='#FF6A2B';c.lineWidth=1.5;c.setLineDash([4,3]);c.beginPath();c.arc(x,y,12,0,7);c.stroke();c.setLineDash([])}}

/* ---------- pointer ---------- */
function edPick(wx,wy){const s=edScale(),tol=10/s;let best=null,bd=1e9;
  if(ED.layers.unit)for(const e of ED.doc.ents){if(e.kind!=='unit')continue;const d=Math.hypot(e.x-wx,e.y-wy)-Math.max(6,(TYPES[e.type].w||20)/2);if(d<tol&&d<bd){bd=d;best=e}}if(best)return best;
  for(const e of ED.doc.ents){if(e.kind==='unit'||!edVisible(e))continue;if(Math.hypot(e.x-wx,e.y-wy)<tol*1.2)return e}
  let area=1e12;for(const e of ED.doc.ents){if(e.kind==='unit'||!edVisible(e))continue;let inside=false,ar=0;
    if(e.kind==='town'||e.kind==='crossing'){const d=e.kind==='crossing'?34:e.d;inside=Math.abs(wx-e.x)<e.w/2&&Math.abs(wy-e.y)<d/2;ar=e.w*d}else{inside=inEll(wx,wy,{cx:e.x,cy:e.y,rx:e.rx,ry:e.ry});ar=e.rx*e.ry*3.14}
    if(inside&&ar<area){area=ar;best=e}}return best}
const edSnapV=v=>ED.snap?Math.round(v/ED.snap)*ED.snap:v;
function edDown(e){const cv=$('ed-cv'),r=cv.getBoundingClientRect(),sx=e.clientX-r.left,sy=e.clientY-r.top,[wx,wy]=edS2W(sx,sy);cv.focus();cancelAnimationFrame(ED.anim);
  if(e.button===1||e.button===2||ED.space){cv.setPointerCapture(e.pointerId);ED.drag={pan:true,sx,sy,vx:ED.view.x,vy:ED.view.y};return}
  if(ED.tool){if(wx<0||wy<0||wx>W||wy>H)return;edPlace(ED.tool,edSnapV(wx),edSnapV(wy));return}
  const hit=edPick(wx,wy);cv.setPointerCapture(e.pointerId);
  if(hit){ED.sel=hit.id;ED.drag={id:hit.id,ox:hit.x-wx,oy:hit.y-wy,sx,sy,moved:false,prev:edPre()};edOutliner();edInspector();edDraw()}
  else{ED.drag={pan:true,sx,sy,vx:ED.view.x,vy:ED.view.y,click:true};if(ED.sel){ED.sel=null;edOutliner();edInspector();edDraw()}}}
function edMove(e){const cv=$('ed-cv'),r=cv.getBoundingClientRect(),sx=e.clientX-r.left,sy=e.clientY-r.top;ED.hover=edS2W(sx,sy);const d=ED.drag;
  if(!d){if(ED.tool)edDraw();return}
  if(d.pan){const s=edScale();ED.view.x=d.vx-(sx-d.sx)/s;ED.view.y=d.vy-(sy-d.sy)/s;edDraw();return}
  if(!d.moved&&Math.hypot(sx-d.sx,sy-d.sy)<4)return;d.moved=true;const ent=ED.doc.ents.find(x=>x.id===d.id);if(!ent)return;const [wx,wy]=edS2W(sx,sy);
  ent.x=Math.max(0,Math.min(W,edSnapV(wx+d.ox)));ent.y=Math.max(0,Math.min(H,edSnapV(wy+d.oy)));if(ent.kind==='crossing')edSnapCross();if(ent.kind!=='unit')ED.bgKey='live';edDraw()}
function edUp(e){const d=ED.drag;ED.drag=null;if(!d)return;if(d.id&&d.moved){edPush(d.prev);edStatus('Moved')}else if(d.id){const ent=ED.doc.ents.find(x=>x.id===d.id);if(ent)edInspector()}
  if(ED.bgKey==='live'){ED.bgKey='';edDraw()}}
function edPlace(kind,x,y){const p=edPre();let e;
  if(kind==='hill')e={kind,label:'Hill '+(100+Math.floor(Math.random()*180)),rx:110,ry:65,h:28};
  else if(kind==='wood')e={kind,label:'Wood',rx:70,ry:45};else if(kind==='marsh')e={kind,label:'Marsh',rx:80,ry:35};else if(kind==='town')e={kind,label:'Town',w:90,d:60};
  else if(kind==='crossing'){if(!ED.doc.river){edFlash('Add a river first.');return}e={kind,label:'Ford',w:56,ctype:'ford'}}
  else if(kind==='unit'){const t=$('ed-utype').value,side=ED.side;if(t==='gen'&&ED.doc.ents.some(u=>u.kind==='unit'&&u.side===side&&u.type==='gen')){edFlash('That side already has a commander.');return}
    const n=ED.doc.ents.filter(u=>u.kind==='unit'&&u.side===side&&u.type!=='gen').length;if(t!=='gen'&&n+1>=ED_LIM.units){edFlash('That side is full ('+ED_LIM.units+' units).');return}
    const same=ED.doc.ents.filter(u=>u.kind==='unit'&&u.side===side&&u.type===t).length;e={kind,label:edUnitName(ED.doc.era,t,side,same+1),side,type:t,men:edDefaultMen(ED.doc.era,t),facing:side==='P'?-90:90}}
  if(ED.doc.ents.length>=ED_LIM.ents){edFlash('The map is full.');return}
  e=Object.assign({id:edId(),x,y},e);if(kind==='crossing')e.y=gRiverY({river:ED.doc.river},x);ED.doc.ents.push(e);ED.sel=e.id;edPush(p);edStatus('Added '+e.label)}
function edKey(e){if(!ED.open||e.target.closest('input,select,textarea'))return;const k=e.key.toLowerCase();
  if((e.ctrlKey||e.metaKey)&&k==='z'){e.preventDefault();e.shiftKey?edRedo():edUndo();return}if((e.ctrlKey||e.metaKey)&&k==='y'){e.preventDefault();edRedo();return}
  if(e.code==='Space'){ED.space=true;e.preventDefault();return}
  if(k==='f'){edFit();edDraw()}else if(k==='escape'){ED.tool=null;ED.sel=null;edBar();edOutliner();edInspector();edDraw()}
  else if((k==='delete'||k==='backspace')&&ED.sel){e.preventDefault();const ent=ED.doc.ents.find(x=>x.id===ED.sel);if(ent){const p=edPre();ED.doc.ents=ED.doc.ents.filter(x=>x!==ent);ED.sel=null;edPush(p);edStatus('Removed '+ent.label)}}
  else if(k==='r'&&ED.sel){const ent=ED.doc.ents.find(x=>x.id===ED.sel);if(ent&&ent.kind==='unit'){const p=edPre();ent.facing=((ent.facing+45+180)%360+360)%360-180;edPush(p)}}}

/* ---------- import / export ---------- */
function edExport(){const v=edValidate(ED.doc);if(!v.ok){edFlash('Cannot export yet: '+v.err);return}ED.doc.savedAt=new Date().toISOString();edSave();
  const blob=new Blob([JSON.stringify(ED.doc,null,1)],{type:'application/json'}),a=document.createElement('a'),nm=(ED.doc.name||'map').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'')||'map';
  a.href=URL.createObjectURL(blob);a.download='field-command-'+nm+'.json';document.body.appendChild(a);a.click();setTimeout(()=>{URL.revokeObjectURL(a.href);a.remove()},500);edStatus('Exported')}
function edImport(ev){const f=ev.target.files&&ev.target.files[0];ev.target.value='';if(!f)return;if(f.size>ED_LIM.bytes){edFlash('That file is too big for a map.');return}
  const rd=new FileReader();rd.onerror=()=>edFlash('Could not read that file.');rd.onload=()=>{let d;try{d=JSON.parse(rd.result)}catch(e){edFlash('That file is not valid JSON.');return}
    const v=edValidate(d);if(!v.ok){edFlash('Import rejected: '+v.err);return}const p=edPre();ED.doc=d;ED.sel=null;edPush(p);edFit();edStatus('Imported “'+d.name+'”')};rd.readAsText(f)}

/* ---------- menu hooks ---------- */
(function(){const o=$('ed-open');if(o)o.onclick=edOpen;const pd=$('ed-play-draft');if(pd)pd.onclick=()=>{const d=edLoadDraft();if(!d)return;const v=edValidate(d);if(!v.ok){$('ed-note').textContent=v.err;return}start(edScenario(d,'custom_'+Date.now().toString(36)))};edMenuNote()})();

/* ---------- online 1 v 1 over a shared link (PeerJS / WebRTC) ----------
   The host runs the authoritative battle. Both players plan at the same time;
   when both have sent orders the round plays on both screens, then the host
   sends the resulting state. The guest sees the same battle rotated 180°. */
const NET={peer:null,conn:null};
function netEsc(s){return String(s).replace(/[&<>"]/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[m]))}
function netModal(html){$('netbox').hidden=false;$('net-body').innerHTML=html}
function netClose(){$('netbox').hidden=true;try{if(NET.conn&&!G.net)NET.conn.close()}catch(e){}try{if(NET.peer&&!G.net){NET.peer.destroy();NET.peer=null}}catch(e){}}
$('net-cancel').onclick=netClose;
function netLink(id,era,seed){const u=new URL(location.href);u.search='';u.hash='';u.searchParams.set('vs',id);u.searchParams.set('era',era);u.searchParams.set('seed',seed);return u.toString()}
function netNoLib(){netModal('<p>Online play needs an internet connection to the matchmaking service, and it could not be loaded here.</p><p class="muted">Open the game from your Netlify site and try again.</p>')}
function netErr(e){netModal(`<p>The connection failed (${netEsc(e&&e.type||e)}).</p><p class="muted">Check your internet connection, or ask your friend for a fresh link.</p>`)}
function netHost(era){
  if(!window.Peer)return netNoLib();
  netClose();const seed=Math.floor(Math.random()*1e6);
  netModal('<p>Setting up the battlefield…</p>');
  const peer=new Peer();NET.peer=peer;NET.conn=null;
  peer.on('open',id=>{
    const link=netLink(id,era,seed);
    netModal(`<p>Send this link to your friend. The battle starts as soon as they open it. Keep this tab open.</p><div class="netlink"><input id="net-url" readonly value="${netEsc(link)}"><button type="button" class="primary" id="net-copy">Copy link</button></div><p class="muted">${netEsc(ROSTER[era].label)} · equal armies · waiting for your opponent…</p>`);
    $('net-url').onclick=e=>e.target.select();
    $('net-copy').onclick=async()=>{try{await navigator.clipboard.writeText(link);$('net-copy').textContent='Copied'}catch(e){$('net-url').select();$('net-copy').textContent='Press Ctrl+C'}};
  });
  peer.on('connection',conn=>{conn.on('open',()=>{if(NET.conn){try{conn.send({t:'full'});conn.close()}catch(e){}return}NET.conn=conn;netStart('host',era,seed,conn)})});
  peer.on('error',netErr);
}
function netJoin(id,era,seed){
  if(!window.Peer)return netNoLib();
  netModal('<p>Joining your friend’s battle…</p>');
  const peer=new Peer();NET.peer=peer;
  peer.on('open',()=>{const conn=peer.connect(id,{reliable:true});NET.conn=conn;
    conn.on('open',()=>netStart('guest',era,seed,conn));
    conn.on('data',m=>{if(m&&m.t==='full')netModal('<p>That battle already has two commanders.</p>')});
    setTimeout(()=>{if(!G.net&&!$('netbox').hidden)netModal('<p>Could not reach your friend.</p><p class="muted">The link only works while their game tab is open. Ask them for a new link.</p>')},15000)});
  peer.on('error',netErr);
}
function netStart(role,era,seed,conn){
  $('netbox').hidden=true;
  try{history.replaceState(null,'',location.pathname)}catch(e){}
  const id=buildMirrorScenario(ROSTER[era]?era:'ancient',seed);
  start(id);
  G.net={role,conn,n:G.b.units.filter(u=>u.side==='P').length,mine:null,theirs:null,state:null,waitState:false,dead:false};
  conn.on('data',netData);
  conn.on('close',()=>{if(!G.net)return;G.net.dead=true;toast({text:'Your opponent has left the battle.',kind:'bad'})});
  begin();
  toast({text:role==='host'?'Your friend has joined. Give your orders: the turn plays once you both press End turn.':'Connected. Give your orders: the turn plays once you both press End turn.',kind:'good'});
  snd('horn');
}
const netMap=id=>id<=G.net.n?id+G.net.n:id-G.net.n;
function netMir(o){if(!o)return null;if(o.kind==='move')return Object.assign({},o,{x:1000-o.x,y:640-o.y,face:o.face!=null?o.face+Math.PI:o.face});if(o.kind==='attack')return Object.assign({},o,{target:netMap(o.target)});return Object.assign({},o)}
function netMine(){return G.b.units.filter(u=>u.side==='P').map(u=>({id:u.id,order:u.order?Object.assign({},u.order):null,stance:u.stance,fire:u.fire,wantFace:u.wantFace}))}
function netApply(list){for(const o of list){const u=byId(G.b,netMap(o.id));if(!u||u.gone)continue;u.order=netMir(o.order);u.stance=o.stance;u.fire=o.fire;u.wantFace=o.wantFace!=null?o.wantFace+Math.PI:null}}
function netRallyFoe(){const g=G.b.units.find(u=>u.side==='E'&&u.type==='gen'&&!u.gone);if(g){g.rallyCd=0;rally(G.b,g);G.b.msgs.length=0}}
function netSubmit(){
  const N=G.net;if(N.dead){toast({text:'Your opponent has left. Start a new online battle from the menu.',kind:'bad'});return}
  N.mine={turn:G.turn,list:netMine(),rally:!!G.netRally};G.netRally=false;
  try{N.conn.send(Object.assign({t:'orders'},N.mine))}catch(e){toast({text:'Could not send your orders.',kind:'bad'});return}
  G.mode='wait';snd('stamp');updateTurnUI();updateCmds();netMaybeGo();
}
function netData(m){
  const N=G.net;if(!N||!m)return;
  if(m.t==='orders'){N.theirs=m;netMaybeGo()}
  else if(m.t==='go'&&N.role==='guest'){netApply(m.host.list);if(m.host.rally)netRallyFoe();N.mine=null;N.theirs=null;netGo()}
  else if(m.t==='state'&&N.role==='guest'){N.state=m;if(N.waitState)netApplyState()}
}
function netMaybeGo(){
  const N=G.net;if(N.role!=='host'||!N.mine||!N.theirs||G.mode!=='wait')return;
  netApply(N.theirs.list);if(N.theirs.rally)netRallyFoe();
  N.conn.send({t:'go',host:N.mine});N.mine=null;N.theirs=null;netGo();
}
function netGo(){G.mode='plan';G.netGo=true;execTurn();G.netGo=false}
function netSnap(){const b=G.b;return{t:b.t,units:b.units.map(u=>({id:u.id,x:u.x,y:u.y,facing:u.facing,men:u.men,morale:u.morale,rout:u.rout,gone:u.gone,fled:u.fled,fatigue:u.fatigue||0,dugIn:u.dugIn,stillT:u.stillT,rallyCd:u.rallyCd,dd:u.dd,killed:u.killed,order:u.order?Object.assign({},u.order):null}))}}
function netRoundDone(){
  const N=G.net,b=G.b;
  if(N.role==='host'){try{N.conn.send({t:'state',snap:netSnap(),result:b.result})}catch(e){}if(b.result)showEnd();else endTurn()}
  else{G.mode='wait';N.waitState=true;updateTurnUI();if(N.state)netApplyState()}
}
function netApplyState(){
  const N=G.net,b=G.b,m=N.state;N.state=null;N.waitState=false;
  b.t=m.snap.t;
  for(const s of m.snap.units){const u=byId(b,netMap(s.id));if(!u)continue;
    Object.assign(u,{x:1000-s.x,y:640-s.y,facing:s.facing+Math.PI,men:s.men,morale:s.morale,rout:s.rout,gone:s.gone,fled:s.fled,fatigue:s.fatigue,dugIn:s.dugIn,stillT:s.stillT,rallyCd:s.rallyCd,dd:s.dd,killed:s.killed});u.order=netMir(s.order)}
  tbContacts(b);
  if(m.result)b.result={win:!m.result.win,reason:m.result.win?'Your army has broken. Your opponent holds the field.':'The enemy army has broken. The field is yours.'};
  G.mode='exec';
  if(b.result)showEnd();else endTurn();
}
(function(){try{const p=new URLSearchParams(location.search),vs=p.get('vs');if(vs)setTimeout(()=>netJoin(vs,p.get('era')||'ancient',+p.get('seed')||1),400)}catch(e){}})();
