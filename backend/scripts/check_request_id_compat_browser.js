'use strict';
const fs=require('fs'),path=require('path');
const {openBrowser,waitFor,sleep}=require('./browser_fixture');
const f=JSON.parse(process.env.PANDORA_COMPAT_FIXTURE),out=path.resolve(__dirname,'../../output/request-id-compat'),js=JSON.stringify;
const report={mode:f.mode,checks:[]};
function check(name,pass,evidence){report.checks.push({name,pass:!!pass,evidence});console.log((pass?'PASS ':'FAIL ')+name);if(!pass)throw Error(name+' '+JSON.stringify(evidence));}
async function main(){
 const b=await openBrowser(f.httpBase+'/',{width:1440,height:900,mobile:false},{args:['--host-resolver-rules=MAP pandora-fixture.test 127.0.0.1','--no-proxy-server']}),ev=b.evaluate;
 try{
  check('non-localhost HTTP login ready',await waitFor(b,"!!document.getElementById('backend-login')"));
  const context=await ev("({secure:isSecureContext,native:typeof crypto.randomUUID,random:typeof crypto.getRandomValues,host:location.hostname})");
  check('real insecure context lacks randomUUID',!context.secure&&context.native==='undefined'&&context.random==='function'&&context.host==='pandora-fixture.test',context);
  await ev(`document.getElementById('login-user').value=${js(f.person.identifier)};document.getElementById('login-password').value='Fixture@123456';document.getElementById('backend-login').requestSubmit()`);
  check('insecure HTTP authentication succeeds',await waitFor(b,'Pandora.ready&&Pandora.idle()',20000));
  await ev(`openTaskForm('schedule',${js(f.task)})`);
  check('schedule form ready',await waitFor(b,"Pandora.idle()&&drafts.task?.mode==='schedule'&&!!document.getElementById('tf-start-date')"));
  await ev("document.getElementById('tf-end-time-hour').value='17';document.getElementById('tf-reason').value='HTTP排期兼容验证'");
  for(const width of [390,1440]){await b.viewport({width,height:width===1440?900:844,mobile:width!==1440});await ev("document.getElementById('tf-start-date').scrollIntoView({block:'center'})");check('schedule form fits '+width,await ev("document.getElementById('sheetBody').scrollWidth<=document.getElementById('sheetBody').clientWidth+1"));await b.screenshot(path.join(out,f.mode+'-form-'+width+'.png'));}
  await ev(`window.compatFetch=window.fetch;window.compatWrites=[];window.fetch=async function(url,opts){const target=String(url)==='/api/v1/tasks/'+${js(f.task)}&&opts?.method==='PATCH';if(target)window.compatWrites.push(new Headers(opts.headers).get('Idempotency-Key'));const response=await window.compatFetch(url,opts);if(target&&window.compatWrites.length===1)throw new TypeError('simulated response loss after server commit');return response;}`);
  await ev("document.querySelector('[data-action=save-task]').click()");
  check('first submit finishes',await waitFor(b,"Pandora.idle()&&!document.getElementById('tf-error').hidden",20000));
  if(f.mode==='before'){
   check('original user error reproduced before any request',await ev("document.getElementById('tf-error').textContent.includes('crypto.randomUUID is not a function')&&window.compatWrites.length===0"));
   await b.screenshot(path.join(out,'before-error.png'));return;
  }
  check('committed response loss leaves retryable form',await ev("window.compatWrites.length===1&&document.getElementById('tf-error').textContent.includes('无法连接后端')&&document.getElementById('tf-reason').value==='HTTP排期兼容验证'"));
  await ev("document.querySelector('[data-action=save-task]').click()");
  check('retry successfully submits on HTTP',await waitFor(b,"Pandora.idle()&&document.getElementById('overlay').hidden",20000));
  const keys=await ev('window.compatWrites');
  check('retry reuses an RFC4122 v4 request key',keys.length===2&&keys[0]===keys[1]&&/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(keys[0]));
  const saved=await ev(`Pandora.request('/tasks/'+${js(f.task)})`);
  check('pending schedule committed once with correct time',saved.frozen&&saved.pendingSchedule.dueAt==='2030-12-31T09:20:00Z'&&saved.dueAt==='2030-12-31T08:20:00Z');
  const properties=await ev(`(async()=>{const request=Pandora.request,random=Math.random,keys=[];try{Math.random=()=>{throw Error('weak random must not be used')};Pandora.request=async(p,o)=>{keys.push(o.headers['Idempotency-Key']);return {ok:true}};await Pandora.mutation('compat-retry','POST','/testing',{a:1});await Pandora.mutation('compat-retry','POST','/testing',{a:1});await Pandora.mutation('compat-retry','POST','/testing',{a:2});for(let i=0;i<256;i++)await Pandora.mutation('compat-'+i,'POST','/testing',{i});return {same:keys[0]===keys[1],changed:keys[1]!==keys[2],count:new Set(keys.slice(2)).size,valid:keys.every(k=>/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(k))}}finally{Pandora.request=request;Math.random=random}})()`);
  check('fallback uses strong randomness and preserves retry identity',properties.same&&properties.changed&&properties.count===257&&properties.valid,properties);
  await ev('window.fetch=window.compatFetch');
  await b.send('Page.navigate',{url:f.base+'/'});
  check('native context script ready',await waitFor(b,"location.hostname==='127.0.0.1'&&!!window.Pandora?.mutation"));
  const native=await ev(`(async()=>{const request=Pandora.request,uuid=crypto.randomUUID;let calls=0;try{crypto.randomUUID=function(){calls++;return uuid.call(crypto)};Pandora.request=async(p,o)=>o.headers['Idempotency-Key'];const key=await Pandora.mutation('native','POST','/testing',{});return {secure:isSecureContext,calls,valid:/^[0-9a-f-]{36}$/.test(key)}}finally{Pandora.request=request;crypto.randomUUID=uuid}})()`);
  check('native UUID path remains available',native.secure&&native.calls===1&&native.valid,native);
  check('no browser exceptions',b.errors.length===0,b.errors);
 }finally{fs.writeFileSync(path.join(out,f.mode+'.json'),JSON.stringify(report,null,2));await b.kill();}
}
main().catch(e=>{console.error(e);process.exitCode=1});
