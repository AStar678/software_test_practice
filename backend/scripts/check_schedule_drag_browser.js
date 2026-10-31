'use strict';
const fs=require('fs'),path=require('path');
const {openBrowser,waitFor,sleep}=require('./browser_fixture');
const fixture=JSON.parse(process.env.PANDORA_SCHEDULE_FIXTURE),js=JSON.stringify;
const out=path.resolve(__dirname,'../../output/task-schedule');
const report={checks:[]};
function check(name,value,evidence){report.checks.push({name,pass:!!value,evidence});console.log((value?'PASS ':'FAIL ')+name);if(!value)throw Error(name+' '+JSON.stringify(evidence));}
async function main(){
 const b=await openBrowser(fixture.base+'/'+encodeURIComponent('潘多拉-交互原型.html'),{width:1440,height:900,mobile:false}),ev=b.evaluate;
 async function login(who){
  check('login form '+who,await waitFor(b,"!!document.getElementById('backend-login')"));
  await ev(`document.getElementById('login-user').value=${js(fixture.identities[who].identifier)};document.getElementById('login-password').value='Fixture@123456';document.getElementById('backend-login').requestSubmit()`);
  check('authenticated '+who,await waitFor(b,'Pandora.ready&&Pandora.idle()',20000));
 }
 async function view(mode='day'){
  await ev(`closeSheet();Pandora.calendar.closeDaySheet();state.viewAnchor=parseDateInput(${js(fixture.day)});state.viewMode=${js(mode)};state.viewPage='calendar';Pandora.calendar.resetStream(state.viewAnchor);setPage('view');renderAll()`);
  await sleep(200);
 }
 async function raw(id){return ev(`Pandora.request('/tasks/'+${js(id)})`);}
 async function handle(id,edge,mode){
  const selector=`[data-resize-task="${id}"][data-resize="${edge}"][data-resize-mode="${mode}"]`;
  return ev(`(()=>{const h=document.querySelector(${js(selector)});if(!h)return null;h.scrollIntoView({block:'center',inline:'center'});const r=h.getBoundingClientRect(),bar=h.closest('.p-month-event,.p-horizontal-bar');return {x:r.x+r.width/2,y:r.y+r.height/2,unit:${js(mode)}==='month'?bar.closest('.p-month-week').getBoundingClientRect().width/7:bar.closest('.p-horizontal-axis').getBoundingClientRect().width/1440*15}})()`);
 }
 async function drag(id,edge,mode,steps,cancel){
  const h=await handle(id,edge,mode);check('handle reachable '+edge+' '+mode,!!h,h);
  await b.send('Input.dispatchMouseEvent',{type:'mouseMoved',x:h.x,y:h.y});
  await b.send('Input.dispatchMouseEvent',{type:'mousePressed',x:h.x,y:h.y,button:'left',clickCount:1});
  await b.send('Input.dispatchMouseEvent',{type:'mouseMoved',x:h.x+h.unit*steps,y:h.y,button:'left',buttons:1});
  check('drag preview visible',await ev("!!document.querySelector('.p-drag-preview')"));
  if(cancel==='escape')await b.send('Input.dispatchKeyEvent',{type:'keyDown',key:'Escape',code:'Escape',windowsVirtualKeyCode:27});
  if(cancel==='pointercancel')await ev(`document.querySelector(${js(`[data-resize-task="${id}"][data-resize="${edge}"][data-resize-mode="${mode}"]`)}).dispatchEvent(new PointerEvent('pointercancel',{pointerId:1,bubbles:true}))`);
  await b.send('Input.dispatchMouseEvent',{type:'mouseReleased',x:h.x+h.unit*steps,y:h.y,button:'left',clickCount:1});
  await sleep(150);
 }
 async function form(){check('drag opens confirmation form',await waitFor(b,"!!drafts.task&&!document.getElementById('overlay').hidden&&!document.getElementById('overlay').hidden&&Pandora.idle()"));}
 async function save(reason){await ev(`document.getElementById('tf-reason').value=${js(reason)};document.querySelector('[data-action=save-task]').click()`);check('schedule submitted',await waitFor(b,"Pandora.idle()&&document.getElementById('overlay').hidden",20000),await ev("document.getElementById('tf-error')?.textContent"));}
 try{
  await login('founder');await sleep(5100);await view();
  check('horizontal day is default',await ev("!!document.querySelector('.p-horizontal-axis')"));
  check('day contains every task once including full days and points',await ev(`document.querySelectorAll('.p-horizontal-task').length===4&&document.querySelectorAll('.p-horizontal-task[data-task="${fixture.full}"]').length===1`));
  const original=await raw(fixture.task);
  await drag(fixture.task,'end','day',2,'escape');
  check('escape leaves no form or changed version',await ev("!document.querySelector('.p-drag-preview')&&document.getElementById('overlay').hidden")&&(await raw(fixture.task)).rowVersion===original.rowVersion);
  await drag(fixture.task,'end','day',2,'pointercancel');
  check('pointercancel does not submit',await ev("document.getElementById('overlay').hidden")&&(await raw(fixture.task)).rowVersion===original.rowVersion);
  await drag(fixture.task,'end','day',2);await form();
  check('day end advances 30 minutes only',await ev("drafts.task.endTime==='18:30'&&drafts.task.startTime==='09:00'"));
  check('preview has not persisted', (await raw(fixture.task)).dueAt===original.dueAt);
  await save('横向调整截止');
  check('founder saved precise timed range', (await raw(fixture.task)).dueAt==='2030-12-31T10:30:00Z'&&!(await raw(fixture.task)).allDay);
  await view('month');await drag(fixture.task,'end','month',1);await form();
  check('month drag crosses year and preserves time',await ev("drafts.task.endDate==='2031-01-01'&&drafts.task.endTime==='18:30'&&drafts.task.startDate==='2030-12-31'"));
  await save('跨年截止');
  check('cross-year end persisted',(await raw(fixture.task)).dueAt==='2031-01-01T10:30:00Z');
  await view();
  check('clipped continuation has no false end handle',await ev(`!document.querySelector('[data-resize-task="${fixture.task}"][data-resize=end]')`));
  await drag(fixture.task,'start','day',-1);await form();
  check('start changes independently',await ev("drafts.task.startTime==='08:45'&&drafts.task.endTime==='18:30'&&drafts.task.endDate==='2031-01-01'"));
  await ev('closeSheet()');await view();
  await drag(fixture.point,'start','day',1);
  check('inverse point range rejected',await ev("document.getElementById('overlay').hidden")&&(await raw(fixture.point)).startAt===(await raw(fixture.point)).dueAt,await ev("({form:!document.getElementById('overlay').hidden,draft:drafts.task&&{id:drafts.task.id,start:drafts.task.startTime,end:drafts.task.endTime},preview:document.querySelector('.p-drag-preview')?.textContent})"));
  await drag(fixture.point,'end','day',1);await form();
  check('zero duration endpoint can expand',await ev("drafts.task.startTime==='12:00'&&drafts.task.endTime==='12:15'"));
  await ev('closeSheet()');await view();
  await handle(fixture.full,'end','day');
  await ev(`document.querySelector('[data-resize-task="${fixture.full}"][data-resize=end]').focus()`);
  await b.send('Input.dispatchKeyEvent',{type:'keyDown',key:'ArrowLeft',code:'ArrowLeft',windowsVirtualKeyCode:37});await form();
  check('keyboard midnight endpoint uses correct date',await ev("drafts.task.endDate==='2030-12-31'&&drafts.task.endTime==='23:45'"));
  await ev('closeSheet()');
  const legacy=await raw(fixture.legacy);
  await ev(`openTaskForm('edit',${js(fixture.legacy)})`);await form();
  check('legacy all-day edits preserve stored instants',await ev(`!drafts.task.allDay&&parseDateTime(drafts.task.startDate,drafts.task.startTime).toISOString()===new Date(${js(legacy.startAt)}).toISOString()&&parseDateTime(drafts.task.endDate,drafts.task.endTime).toISOString()===new Date(${js(legacy.dueAt)}).toISOString()`));
  await ev("document.querySelector('[data-action=p-schedule-full-day]').click()");
  check('shortcut converts inclusive end to following midnight',await ev("drafts.task.startTime==='00:00'&&drafts.task.endTime==='00:00'&&drafts.task.endDate==='2031-01-01'&&!document.getElementById('tf-allday')"));
  await ev("document.querySelector('[data-action=p-schedule-full-day]').click()");
  check('shortcut repeat stable',await ev("drafts.task.endDate==='2031-01-01'"));
  await sleep(5200);
  for(const width of [320,390,1440]){
   await b.viewport({width,height:width===1440?900:844,mobile:width!==1440});
   await ev("document.getElementById('tf-start-date').scrollIntoView({block:'center'})");
   const geometry=await ev("(()=>{const n=document.getElementById('sheetBody');return {w:n.clientWidth,scroll:n.scrollWidth}})()");
   check('explicit schedule fits '+width,geometry.scroll<=geometry.w+2,geometry);
   await b.screenshot(path.join(out,'form-'+width+'.png'));
  }
  await ev('closeSheet()');
  await sleep(5200);
  for(const width of [320,390,1440]){
   await b.viewport({width,height:width===1440?900:844,mobile:width!==1440});await view();
   check('horizontal axis stays inside viewport '+width,await ev("document.documentElement.scrollWidth<=innerWidth+1&&document.querySelector('.p-horizontal-scroll').scrollWidth>document.querySelector('.p-horizontal-scroll').clientWidth"));
   check('task captions remain visible while scrolled '+width,await ev("[...document.querySelectorAll('.p-horizontal-label')].every(n=>{const r=n.getBoundingClientRect();return r.left>=0&&r.right<=innerWidth&&n.querySelector('strong').clientWidth>25})"));
   await b.screenshot(path.join(out,'day-'+width+'.png'));
  }
  await b.viewport({width:390,height:844,mobile:true});await view();
  const touchHandle=await handle(fixture.task,'start','day');
  await b.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:touchHandle.x,y:touchHandle.y,id:0}]});
  await b.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:touchHandle.x-touchHandle.unit,y:touchHandle.y,id:0}]});
  await b.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await form();
  check('touch drag adjusts by 15 minutes',await ev("drafts.task.startTime==='08:45'"));
  await ev('closeSheet()');
  await b.viewport({width:1440,height:900,mobile:false});
  await view('month');await handle(fixture.task,'start','month');await b.screenshot(path.join(out,'month-1440.png'));
  const stale=await raw(fixture.task);
  await ev(`Pandora.mutation('stale-schedule-test','PATCH','/tasks/'+${js(fixture.task)},{command:'change',reason:'并发验证',description:'已由新版本更新'},'"'+${stale.rowVersion}+'"')`);
  await ev(`Pandora.openScheduleChange(${js(fixture.task)},new Date('2030-12-31T02:00:00Z'),new Date('2031-01-01T11:00:00Z'),${stale.rowVersion})`);
  check('stale drag reports conflict without overriding latest values',await ev("document.getElementById('tf-error').textContent.includes('已被更新')&&drafts.task.startTime==='09:00'"));
  await ev('closeSheet()');
  const completeRaw=await raw(fixture.legacy);
  await ev(`Pandora.mutation('complete-reopen-schedule','PATCH','/tasks/'+${js(fixture.legacy)},{command:'complete',completionNote:'重开表单验证'},'"'+${completeRaw.rowVersion}+'"')`);
  await ev('Pandora.reload()');
  await ev(`openTaskDetail(${js(fixture.legacy)})`);
  check('completed task can reopen',await waitFor(b,"Pandora.idle()&&!!document.querySelector('[data-action=p-reopen-task]')"));
  await ev("document.querySelector('[data-action=p-reopen-task]').click()");
  check('reopen uses explicit date/time controls',await waitFor(b,"Pandora.idle()&&!!document.getElementById('rp-start-date')&&!document.getElementById('rp-allday')&&!document.getElementById('rp-start-time-field').hidden"));
  await ev("document.querySelector('[data-action=p-schedule-full-day][data-prefix=rp]').click();document.querySelector('[data-action=p-schedule-full-day][data-prefix=rp]').click()");
  check('reopen shortcut next midnight and repeat stable',await ev("document.getElementById('rp-end-date').value==='2031-01-01'&&Pandora.readTimeControl('rp-start-time')==='00:00'&&Pandora.readTimeControl('rp-end-time')==='00:00'"));
  await ev("document.getElementById('reopen-reason').value='新排期重开';document.querySelector('[data-action=p-confirm-reopen]').click()");
  check('reopen shortcut saves explicit future instants',await waitFor(b,"Pandora.idle()&&document.getElementById('overlay').hidden",20000));
  const reopened=await raw(fixture.legacy);check('reopened range is timed through next midnight',!reopened.allDay&&reopened.dueAt==='2030-12-31T16:00:00Z');
  await ev('Pandora.logout()');await login('alpha-one-employee');await view();
  check('assignee without edit rights has no handles',await ev(`!!document.querySelector('.p-horizontal-task[data-task="${fixture.forbidden}"]')&&!document.querySelector('[data-resize-task="${fixture.forbidden}"]')`));
  const prior=await raw(fixture.employee);
  await drag(fixture.employee,'end','day',1);await form();
  check('drag review uses operator manager',await ev(`drafts.task.preview.requiresApproval&&drafts.task.preview.reviewerId===${js(fixture.identities['alpha-one-head'].id)}`));
  await save('员工调整排期需审核');
  const pending=await raw(fixture.employee);
  check('pending change keeps effective schedule and freezes',pending.dueAt===prior.dueAt&&pending.frozen);
  await view();check('frozen task has no handles',await ev(`!document.querySelector('[data-resize-task="${fixture.employee}"]')`));
  check('no browser exceptions',b.errors.length===0,b.errors);
 }finally{fs.writeFileSync(path.join(out,'browser-report.json'),JSON.stringify(report,null,2));await b.kill();}
}
main().catch(e=>{console.error(e);process.exitCode=1});
