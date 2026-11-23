'use strict';
// Read-only current Web reference on the same local demo used by the emulator.
const fs=require('fs'),path=require('path');
const {openBrowser,waitFor,sleep}=require('../../backend/scripts/browser_fixture');
const out=path.resolve(__dirname,'../../output/flutter-client-2026-11-17/web-parity');
fs.mkdirSync(out,{recursive:true});
const report={updated:new Date().toISOString(),base:'http://127.0.0.1:8080',checks:[],samples:[]};
const check=(name,pass,evidence)=>{report.checks.push({name,pass:!!pass,evidence});if(!pass)throw Error(name);console.log('PASS '+name);};
(async()=>{
const b=await openBrowser(report.base+'/',{width:390,height:844,mobile:true}),ev=b.evaluate;
try{
check('login form',await waitFor(b,"!!document.getElementById('backend-login')"));
await ev(`document.getElementById('login-user').value='13800000001';document.getElementById('login-password').value=${JSON.stringify(process.env.PANDORA_DEMO_PASSWORD||'111')};document.getElementById('backend-login').requestSubmit()`);
check('same founder account as emulator',await waitFor(b,'Pandora.ready&&Pandora.idle()',25000));
for(const width of [320,390]){
await b.viewport({width,height:640,mobile:true});await ev("setPage('map')");await sleep(350);
const home=await ev(`(()=>{const h=Pandora.data.home;return {company:h.companyItems,board:h.assignedTasks,previews:document.querySelectorAll('.company-quad .item-line').length,redPreview:document.querySelectorAll('.tasks-quad .is-overdue').length,overflow:document.documentElement.scrollWidth>innerWidth+1,tracks:getComputedStyle(document.querySelector('.daily-tracks')).gridAutoRows}})()`);
report.samples.push({width,home});
check(width+' home three previews/body only/no red preview',home.previews===3&&home.company.every(x=>!('title'in x))&&home.redPreview===0&&!home.overflow,home);
await ev("document.querySelector('[data-home-list=company]').click()");
check(width+' chronicle list opens first',await waitFor(b,"!!document.querySelector('.home-chronicle')"));
check(width+' independent expansion preserves full source',await ev(`(()=>{const r=[...document.querySelectorAll('.home-chronicle')];r[0].click();return r.length===Pandora.data.home.companyItems.length&&r[0].getAttribute('aria-expanded')==='true'&&r[1].getAttribute('aria-expanded')==='false'&&r[0].querySelector('.home-copy').textContent===Pandora.data.home.companyItems[0].body})()`));
await b.screenshot(path.join(out,width+'-chronicle.png'));await ev('closeSheet()');
await ev("document.querySelector('[data-home-list=tasks]').click()");await waitFor(b,"!!document.querySelector('.home-list .home-task')");
check(width+' board IDs follow server and strict overdue',await ev(`(()=>{const r=[...document.querySelectorAll('.home-list .home-task')],s=Pandora.data.home.assignedTasks;return JSON.stringify(r.map(x=>x.dataset.task))===JSON.stringify(s.map(x=>x.taskId))&&r.every((x,i)=>x.classList.contains('is-overdue')===(s[i].executionState!=='done'&&Date.parse(s[i].dueAt)<Date.now()))})()`));
await b.screenshot(path.join(out,width+'-board.png'));await ev('closeSheet()');
await ev("state.viewPage='calendar';setPage('view');Pandora.taskForm.open()");
check(width+' table real server rows',await waitFor(b,"Pandora.taskForm.state.loaded&&!Pandora.taskForm.state.loading&&!!document.querySelector('[data-task-row]')",25000));
const table=await ev(`(()=>{const r=document.querySelector('.is-table-pinned');return {ids:[...document.querySelectorAll('[data-task-row]')].map(x=>x.dataset.taskRow),total:Pandora.taskForm.state.server.total,pinned:!!r,colors:r?[...r.children].map(x=>getComputedStyle(x).backgroundImage+'|'+getComputedStyle(x).backgroundColor):[]}})()`);
report.samples.push({width,table});check(width+' pinned whole row one color',table.pinned&&new Set(table.colors).size===1,table);
await b.screenshot(path.join(out,width+'-table.png'));await ev('Pandora.taskForm.close()');
await ev("setPage('me')");await sleep(200);await b.screenshot(path.join(out,width+'-profile.png'));
check(width+' profile no as-of suffix',await ev("!document.getElementById('page-me').textContent.includes('截至')"));
await ev("setPage('log')");check(width+' real logs',await waitFor(b,"Pandora.idle()&&document.getElementById('page-log').textContent.includes('日志')",15000));await b.screenshot(path.join(out,width+'-logs.png'));
await ev('openNotifications()');check(width+' six notification types/three read states',await waitFor(b,"Pandora.idle()&&document.querySelectorAll('.p-notice-tab').length===6&&document.querySelectorAll('.p-notice-read-btn').length===3",20000));
const frame=()=>ev("(()=>{const r=document.getElementById('sheet').getBoundingClientRect();return {top:r.top,height:r.height}})()");
const before=await frame();await ev("document.querySelector('[data-action=p-notice-mode]').click()");await sleep(150);const after=await frame();
check(width+' notification frame stable across mode',Math.abs(before.height-after.height)<1&&Math.abs(before.top-after.top)<1,{before,after});await b.screenshot(path.join(out,width+'-notifications.png'));await ev('closeSheet()');
}
if(process.env.PANDORA_PARITY_DAILY_ID){
 const id=process.env.PANDORA_PARITY_DAILY_ID;
 const item=await ev(`Pandora.request('/daily-items/'+${JSON.stringify(id)})`);
 check('native moved same ID is persisted in Web API',item.id===id&&item.startDate==='2026-11-18'&&item.endDate==='2026-11-20'&&item.body==='本地模拟器改期验收（完成后自动清理）',item);
 await ev("setPage('map');PandoraDaily.goToDate('2026-11-18')");
 check('native moved same ID renders in refreshed Web calendar',await waitFor(b,`!!document.querySelector('[data-daily-bar][data-id="${id}"]')&&Pandora.idle()`,15000));
 await b.screenshot(path.join(out,'native-move-web-readback.png'));
 report.nativeMovedItem=item;
}
check('no browser exceptions',b.errors.length===0,b.errors);report.result='PASS';
} catch(error){report.result='FAIL';report.error=error.message;process.exitCode=1;console.error(error.message);}
finally{fs.writeFileSync(path.join(out,'report.json'),JSON.stringify(report,null,2));b.kill();}
})();
