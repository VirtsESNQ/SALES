// Headless browser harness for Field Command.
// Serves the game folder on a local port, opens it in Playwright Chromium (SwiftShader WebGL),
// blocks all external network (fonts, PeerJS), and runs a test module against the page.
// Usage: node tests/harness.js tests/<name>.test.js [screenshotDir]
const http=require('http'),fs=require('fs'),path=require('path');
let chromium;
try{({chromium}=require('playwright'))}catch(e){({chromium}=require('/opt/node22/lib/node_modules/playwright'))}
const dir=path.resolve(__dirname,'..'),test=require(path.resolve(process.argv[2])),out=path.resolve(process.argv[3]||path.join(dir,'tests','out'));
fs.mkdirSync(out,{recursive:true});
const MIME={'.html':'text/html','.js':'text/javascript','.css':'text/css','.svg':'image/svg+xml','.json':'application/json'};
const srv=http.createServer((q,r)=>{let p=decodeURIComponent(q.url.split('?')[0]);if(p==='/')p='/index.html';const f=path.join(dir,p);
  if(!f.startsWith(dir)||!fs.existsSync(f)||fs.statSync(f).isDirectory()){r.writeHead(404);r.end();return}
  r.writeHead(200,{'content-type':MIME[path.extname(f)]||'application/octet-stream'});fs.createReadStream(f).pipe(r)});
let failed=0;
const check=(ok,msg)=>{console.log((ok?'PASS ':'FAIL ')+msg);if(!ok)failed++};
srv.listen(0,'127.0.0.1',async()=>{const port=srv.address().port;
  // FC_NO_WEBGL=1 launches without WebGL to exercise the 2D fallback
  const args=process.env.FC_NO_WEBGL?['--disable-webgl','--disable-3d-apis']:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist'];
  const browser=await chromium.launch({args});
  const page=await browser.newPage({viewport:{width:1400,height:860}});
  const errors=[];
  page.on('pageerror',e=>errors.push('pageerror: '+e.message));
  page.on('console',m=>{if(m.type()==='error')errors.push('console.error: '+m.text())});
  await page.route(/^https?:\/\/(?!127\.0\.0\.1)/,r=>r.abort());
  try{await page.goto(`http://127.0.0.1:${port}/`,{waitUntil:'load'});await page.waitForTimeout(300);
    await test(page,{check,shot:n=>page.screenshot({path:path.join(out,n+'.png')})});}
  catch(e){errors.push('harness: '+(e.stack||e))}
  // external resources (fonts/PeerJS) are blocked on purpose; ignore those load failures
  const real=errors.filter(e=>!/ERR_FAILED|net::|Failed to load resource/.test(e)&&!(process.env.FC_NO_WEBGL&&/Error creating WebGL context/.test(e)));
  check(real.length===0,'no page errors'+(real.length?':\n  '+real.join('\n  '):''));
  await browser.close();srv.close();
  console.log(failed?`${failed} check(s) FAILED`:'ALL CHECKS PASSED');process.exit(failed?1:0)});
