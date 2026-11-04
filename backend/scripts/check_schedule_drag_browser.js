'use strict';
const fs=require('fs'),path=require('path');
const {openBrowser,waitFor,sleep}=require('./browser_fixture');
const f=JSON.parse(process.env.PANDORA_SCHEDULE_FIXTURE),q=JSON.stringify;
const out=path.resolve(__dirname,'../../output/task-schedule');
const report={checks:[]};
function check(name,pass,evidence){report.checks.push({name,pass:!!pass,evidence});console.log((pass?'PASS ':'FAIL ')+name);if(!pass)throw Error(name+' '+JSON.stringify(evidence));}
async function main(){
 const b=await openBrowser(f.base+'/'+encodeURIComponent('潘多拉-交互原型.html'),{width:1440,height:900,mobile:false}),ev=b.evaluate;
 async function login(who){
  check('login form',await waitFor(b,"!!document.getElementById('backend-login')"));
  await ev(`document.getElementById('login-user').value=${q(f.identities[who].identifier)};document.getElementById('login-password').value='Fixture@123456';document.getElementById('backend-login').requestSubmit()`);
  check('authenticated '+who,await waitFor(b,'Pandora.ready&&Pandora.idle()',20000));
 }
 async function view(mode='day',display='horizontal',day=f.day){
  await ev(`closeSheet();Pandora.calendar.closeDaySheet();state.viewAnchor=parseDateInput(${q(day)});state.viewMode=${q(mode)};state.viewPage='calendar';Pandora.calendar.resetStream(state.viewAnchor);setPage('view');renderAll()`);
  if(mode==='day')await ev(`document.querySelector('[data-action=schedule-day-mode][data-day-mode="${display}"]').click()`);
  await sleep(200);
 }
 async function raw(id){return ev(`Pandora.request('/tasks/'+${q(id)})`);}
 async function point(selector){return ev(`(()=>{const h=document.querySelector(${q(selector)});if(!h)return null;h.scrollIntoView({block:'center',inline:'center'});const r=h.getBoundingClientRect(),bar=h.closest('.p-month-event,.p-horizontal-bar,.p-axis-event');if(!bar||!r.width||!r.height)return null;const mode=h.dataset.resizeMode;return {x:r.x+r.width/2,y:r.y+r.height/2,unit:mode==='month'?bar.closest('.p-month-week').getBoundingClientRect().width/7:mode==='vertical'?bar.closest('.p-axis-events').getBoundingClientRect().height/24:bar.closest('.p-horizontal-axis').getBoundingClientRect().width/24,vertical:mode==='vertical'}})()`);}
 async function drag(selector,steps,cancel){
  const p=await point(selector);check('drag source exists '+selector,!!p,p);
  const x=p.x+(p.vertical?0:p.unit*steps),y=p.y+(p.vertical?p.unit*steps:0);
  await b.send('Input.dispatchMouseEvent',{type:'mouseMoved',x:p.x,y:p.y});
  await b.send('Input.dispatchMouseEvent',{type:'mousePressed',x:p.x,y:p.y,button:'left',clickCount:1});
  await b.send('Input.dispatchMouseEvent',{type:'mouseMoved',x,y,button:'left',buttons:1});
  check('drag preview',await ev("!!document.querySelector('.p-drag-preview')"));
  if(cancel==='escape')await b.send('Input.dispatchKeyEvent',{type:'keyDown',key:'Escape',code:'Escape',windowsVirtualKeyCode:27});
  if(cancel==='pointercancel')await ev(`document.querySelector(${q(selector)}).dispatchEvent(new PointerEvent('pointercancel',{pointerId:1,bubbles:true}))`);
  await b.send('Input.dispatchMouseEvent',{type:'mouseReleased',x,y,button:'left',clickCount:1});
  await sleep(180);
 }
 async function confirm(){const opened=await waitFor(b,"!!document.getElementById('sc-reason')&&!document.getElementById('overlay').hidden&&Pandora.idle()",20000);check('lightweight confirmation opens',opened,opened?null:await ev("({overlay:document.getElementById('overlay')?.hidden,reason:!!document.getElementById('sc-reason'),sheet:document.getElementById('sheetBody')?.textContent.slice(0,500),idle:Pandora.idle(),error:document.getElementById('sc-error')?.textContent,notice:document.querySelector('[role=status]')?.textContent})"));check('full task editor absent',await ev("!document.getElementById('tf-start-date')&&!document.getElementById('tf-title')"));}
 async function save(reason){await ev(`document.getElementById('sc-reason').value=${q(reason)};document.querySelector('[data-action=p-save-schedule]').click()`);check('schedule submitted',await waitFor(b,"Pandora.idle()&&document.getElementById('overlay').hidden",20000),await ev("document.getElementById('sc-error')?.textContent"));}
 try{
  await login('founder');await sleep(5100);await view();
  await ev("window.__scheduleCalls=[];const originalOpenScheduleChange=Pandora.openScheduleChange;Pandora.openScheduleChange=function(...args){window.__scheduleCalls.push(args.map(a=>a instanceof Date?a.toISOString():a));return originalOpenScheduleChange.apply(this,args)}");
  const original=await raw(f.task);
  check('day full and legacy have no hour drag entry',await ev(`!document.querySelector('[data-resize-task="${f.full}"],[data-schedule-move="${f.full}"],[data-resize-task="${f.legacy}"],[data-schedule-move="${f.legacy}"]')`));
  check('normal and point tasks retain hour handles',await ev(`!!document.querySelector('[data-resize-task="${f.task}"][data-resize=end]')&&!!document.querySelector('[data-resize-task="${f.point}"][data-resize=end]')`));
  await drag(`[data-resize-task="${f.task}"][data-resize=end][data-resize-mode=day]`,2,'escape');
  check('escape cancels unchanged',await ev("document.getElementById('overlay').hidden&&!document.querySelector('.p-drag-preview')")&&(await raw(f.task)).rowVersion===original.rowVersion);
  await drag(`[data-resize-task="${f.task}"][data-resize=end][data-resize-mode=day]`,2,'pointercancel');
  check('pointercancel cancels unchanged',await ev("document.getElementById('overlay').hidden")&&(await raw(f.task)).rowVersion===original.rowVersion);
  await drag(`[data-resize-task="${f.task}"][data-resize=end][data-resize-mode=day]`,2);check('drag calls confirmation',await ev('window.__scheduleCalls.length===1'),await ev('window.__scheduleCalls'));await confirm();
  check('confirmation shows old and exact new time',await ev("(()=>{const t=document.getElementById('sheetBody').textContent;return t.includes('18:20')&&t.includes('20:20')&&t.includes('原排期')&&t.includes('新排期')})()"));
  check('preview is uncommitted',(await raw(f.task)).dueAt===original.dueAt);
  await save('日轴调整截止');
  check('precise hour persisted',(await raw(f.task)).dueAt==='2030-12-31T12:20:00Z');
  await view('month');
  await drag(`[data-resize-task="${f.task}"][data-resize=end][data-resize-mode=month]`,4);await confirm();
  check('month drag crosses year and preserves minute',await ev("(()=>{const t=document.getElementById('sheetBody').textContent;return t.includes('2031-01-04')&&t.includes('20:20')})()"));
  await save('跨年调整截止');
  check('cross year persisted',(await raw(f.task)).dueAt==='2031-01-04T12:20:00Z');
  await view('day','horizontal',f.day);
  check('cross day continuation has no hour drag',await ev(`!document.querySelector('[data-resize-task="${f.task}"],[data-schedule-move="${f.task}"]')`));
  await view('month');
  await drag(`[data-schedule-move="${f.task}"][data-resize-mode=month]`,1);await confirm();
  check('whole month move preserves duration',await ev("(()=>{const t=document.getElementById('sheetBody').textContent;return t.includes('2031-01-01')&&t.includes('2031-01-05')&&t.includes('09:20')&&t.includes('20:20')})()"));
  await ev('closeSheet()');await view();
  await drag(`[data-resize-task="${f.point}"][data-resize=start][data-resize-mode=day]`,1);
  check('inverse point range rejected',await ev("document.getElementById('overlay').hidden")&&(await raw(f.point)).startAt===(await raw(f.point)).dueAt);
  await drag(`[data-resize-task="${f.point}"][data-resize=end][data-resize-mode=day]`,1);await confirm();
  check('point expands by an hour',await ev("document.getElementById('sheetBody').textContent.includes('13:00')"));
  await ev('closeSheet()');
  for(const width of [320,390,1440]){
   await b.viewport({width,height:width===1440?900:844,mobile:width!==1440});await view('day','horizontal',f.day);
   check('day axis fits viewport '+width,await ev("document.documentElement.scrollWidth<=innerWidth+1"));
   await b.screenshot(path.join(out,'apply-day-'+width+'.png'));
  }
  await b.viewport({width:1440,height:900,mobile:false});await view('day','timeline');
  check('vertical ordinary handles present',await ev(`!!document.querySelector('[data-resize-task="${f.point}"][data-resize-mode=vertical]')`));
  check('vertical full day handles absent',await ev(`!document.querySelector('[data-resize-task="${f.full}"],[data-schedule-move="${f.full}"]')`));
  check('no browser exceptions',b.errors.length===0,b.errors);
 }finally{fs.writeFileSync(path.join(out,'browser-report.json'),JSON.stringify(report,null,2));await b.kill();}
}
main().catch(e=>{console.error(e);process.exitCode=1});
