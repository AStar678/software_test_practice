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
  if(cancel==='lostpointercapture')await ev(`document.querySelector(${q(selector)}).dispatchEvent(new PointerEvent('lostpointercapture',{pointerId:1,bubbles:true}))`);
  await b.send('Input.dispatchMouseEvent',{type:'mouseReleased',x,y,button:'left',clickCount:1});
  await sleep(180);
 }
 async function tap(selector){
  const p=await point(selector);check('handle exists '+selector,!!p,p);
  await b.send('Input.dispatchMouseEvent',{type:'mouseMoved',x:p.x,y:p.y});
  await b.send('Input.dispatchMouseEvent',{type:'mousePressed',x:p.x,y:p.y,button:'left',clickCount:1});
  await b.send('Input.dispatchMouseEvent',{type:'mouseReleased',x:p.x,y:p.y,button:'left',clickCount:1});
  await sleep(400);
 }
 async function confirm(){const opened=await waitFor(b,"!!document.getElementById('sc-reason')&&!document.getElementById('overlay').hidden&&Pandora.idle()",20000);check('lightweight confirmation opens',opened,opened?null:await ev("({overlay:document.getElementById('overlay')?.hidden,reason:!!document.getElementById('sc-reason'),sheet:document.getElementById('sheetBody')?.textContent.slice(0,500),idle:Pandora.idle(),error:document.getElementById('sc-error')?.textContent,notice:document.querySelector('[role=status]')?.textContent})"));check('full task editor absent',await ev("!document.getElementById('tf-start-date')&&!document.getElementById('tf-title')"));}
 async function save(reason){await ev(`document.getElementById('sc-reason').value=${q(reason)};document.querySelector('[data-action=p-save-schedule]').click()`);check('schedule submitted',await waitFor(b,"Pandora.idle()&&document.getElementById('overlay').hidden",20000),await ev("document.getElementById('sc-error')?.textContent"));}
 async function barState(taskId){
  return ev(`(()=>{const bars=Array.from(document.querySelectorAll('.p-month-event[data-task="${taskId}"]'));if(!bars.length)return {count:0};const bar=bars[0],week=bar.closest('.p-month-week');const start=toDateInput(addDays(parseDateInput(week.dataset.weekStart),Number(bar.dataset.startColumn)));return {count:bars.length,date:start,dashed:bar.classList.contains('is-pending-review'),text:bar.textContent,color:bar.style.getPropertyValue('--tc-bg').trim()}})()`);
 }
 async function api(method,path,body,version,token){
  return ev(`(async()=>{const headers={Accept:'application/json',Authorization:'Bearer '+${q(token)}};let payload=null;if(${q(body)}!=null){headers['Content-Type']='application/json';payload=JSON.stringify(${q(body)})}if(${q(version)}!=null)headers['If-Match']='"'+${q(version)}+'"';headers['Idempotency-Key']=(crypto.randomUUID?crypto.randomUUID():String(Date.now())+Math.random());const response=await fetch('/api/v1'+${q(path)},{method:${q(method)},headers,body:payload});let data={};try{data=await response.json()}catch(_){}return {status:response.status,body:data}})()`);
 }
 async function decide(requestId,decision,token){
  const request=await api('GET','/approval-requests/'+requestId,null,null,token);
  return api('PATCH','/approval-requests/'+requestId,{decision,comment:'排期投影验证'},request.body.rowVersion,token);
 }
 async function monthDrag(taskId,days,anchor){
  await view('month',undefined,anchor);
  await drag(`[data-schedule-move="${taskId}"][data-resize-mode=month]`,days);
  await confirm();
  await save('月历排期投影');
 }
 async function reloadMonth(anchor){await ev('Pandora.reload()');await view('month',undefined,anchor);}
 if(f.phase==='expire'){
  try{
   await login('alpha-one-employee');
   await view('month',undefined,f.expireDay);
   const pendingBar=await barState(f.expire);
   check('expired proposal still projects at its proposed date while pending',pendingBar.date==='2031-02-28'&&pendingBar.dashed,pendingBar);
   const handoff=JSON.parse(fs.readFileSync(path.join(out,'handoff.json'),'utf8'));
   const attempt=await decide(handoff.requestId,'approve',f.tokens.head);
   check('review after the applicable deadline expires the request',attempt.status===409&&attempt.body.code==='REQUEST_EXPIRED',attempt);
   await reloadMonth(f.expireDay);
   const restored=await barState(f.expire);
   check('expired proposal returns the calendar to the effective date',restored.date==='2031-02-26'&&!restored.dashed,restored);
   const rawExpire=await raw(f.expire);
   check('expired proposal is unpublished and the task is unfrozen',rawExpire.frozen===false&&rawExpire.dueAt==='2031-02-26T03:00:00Z'&&!rawExpire.pendingSchedule,rawExpire);
   check('no browser exceptions',b.errors.length===0,b.errors);
  }finally{fs.writeFileSync(path.join(out,'browser-expire-report.json'),JSON.stringify(report,null,2));await b.kill();}
  return;
 }
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
  /* 6.1 跨日任务的首段、整日覆盖中段和尾段在任何日轴呈现都不提供小时拖动或键盘调时。 */
  await view('day','horizontal','2031-02-09');
  check('cross-day first segment has no hour drag',await ev(`!document.querySelector('[data-schedule-move="${f.cross}"],[data-resize-task="${f.cross}"]')`));
  await view('day','horizontal',f.crossDay);
  check('cross-day covered middle day has no hour drag',await ev(`!document.querySelector('[data-schedule-move="${f.cross}"],[data-resize-task="${f.cross}"]')`));
  await view('day','horizontal','2031-02-11');
  check('cross-day tail segment has no hour drag',await ev(`!document.querySelector('[data-schedule-move="${f.cross}"],[data-resize-task="${f.cross}"]')`));
  await view('day','timeline','2031-02-09');
  check('vertical first segment has no move or endpoint handle',await ev(`!document.querySelector('[data-schedule-move="${f.cross}"],[data-resize-task="${f.cross}"]')`));
  const beforeCross=await raw(f.cross);
  await ev(`(()=>{const e=document.querySelector('.p-axis-event[data-task="${f.cross}"]');e.focus();e.dispatchEvent(new KeyboardEvent('keydown',{key:'ArrowRight',bubbles:true}))})()`);
  await sleep(200);
  check('cross-day segment arrow key opens no time edit',await ev("document.getElementById('overlay').hidden&&!document.querySelector('.p-drag-preview')")&&(await raw(f.cross)).startAt===beforeCross.startAt);
  await ev(`document.querySelector('.p-axis-event[data-task="${f.cross}"]').click()`);
  check('cross-day segment ordinary click still opens its detail',await waitFor(b,"!document.getElementById('overlay').hidden&&Pandora.idle()",20000));
  await ev('closeSheet()');
  await view('day','timeline',f.crossDay);
  check('cross-day full coverage stays in the all-day area without handles',await ev(`!!document.querySelector('.p-all-day-event[data-task="${f.cross}"]')&&!document.querySelector('[data-schedule-move="${f.cross}"],[data-resize-task="${f.cross}"]')`));
  await ev(`document.querySelector('.p-all-day-event[data-task="${f.cross}"]').click()`);
  check('all-day ordinary click still opens its detail',await waitFor(b,"!document.getElementById('overlay').hidden&&Pandora.idle()",20000));
  await ev('closeSheet()');
  /* 午夜截止是当日真实终点：当日只有一份，拖动端点进入次日真实时刻且不多出副本。 */
  await view('day','timeline',f.crossDay);
  check('midnight end renders once on its start day',await ev(`document.querySelectorAll('.p-axis-event[data-task="${f.midnight}"]').length===1`));
  await view('day','timeline','2031-02-11');
  check('midnight end creates no next-day duplicate',await ev(`!document.querySelector('[data-task="${f.midnight}"]')`));
  await view('day','horizontal',f.crossDay);
  await drag(`[data-resize-task="${f.midnight}"][data-resize=end][data-resize-mode=day]`,1);await confirm();
  check('midnight endpoint drag proposes the real next instant',await ev("(()=>{const t=document.getElementById('sheetBody').textContent;return t.includes('2031-02-11')&&t.includes('01:00')})()"));
  await ev('closeSheet()');
  /* 6.3 端点手柄上的无位移按下—松开只取消手势，不打开确认或详情。 */
  await view('day','horizontal',f.quiet);
  const callsBefore=await ev('(window.__scheduleCalls||[]).length');
  await tap(`[data-resize-task="${f.short}"][data-resize=end][data-resize-mode=day]`);
  const tapState=await ev("({overlay:document.getElementById('overlay').hidden,preview:!!document.querySelector('.p-drag-preview'),calls:(window.__scheduleCalls||[]).length})");
  check('endpoint press without movement opens no confirmation or detail',tapState.overlay&&!tapState.preview&&tapState.calls===callsBefore,tapState);
  await view('month',undefined,f.quiet);
  await tap(`[data-resize-task="${f.short}"][data-resize=end][data-resize-mode=month]`);
  check('month endpoint press without movement opens no day list or detail',await ev("document.getElementById('overlay').hidden&&!Pandora.calendar.currentDaySheet()"));
  await view('day','horizontal',f.quiet);
  const beforeCapture=await raw(f.short);
  await drag(`[data-resize-task="${f.short}"][data-resize=end][data-resize-mode=day]`,1,'lostpointercapture');
  check('lost pointer capture cancels unchanged',await ev("document.getElementById('overlay').hidden&&!document.querySelector('.p-drag-preview')")&&(await raw(f.short)).rowVersion===beforeCapture.rowVersion);
  /* 6.2 全天任务按月拖动仍只表达完整日期，不出现伪造的起止时刻。 */
  await view('month',undefined,f.day);
  await drag(`[data-schedule-move="${f.legacy}"][data-resize-mode=month]`,1);await confirm();
  check('all-day confirmation shows complete dates without invented times',await ev("(()=>{const t=document.getElementById('sheetBody').textContent;return t.includes('全天')&&t.includes('2030-12-31')&&t.includes('2031-01-01')&&!t.includes('00:00')})()"));
  await ev('closeSheet()');
  for(const width of [320,390,1440]){
   await b.viewport({width,height:width===1440?900:844,mobile:width!==1440});await view('day','horizontal',f.day);
   check('day axis fits viewport '+width,await ev("document.documentElement.scrollWidth<=innerWidth+1"));
   await b.screenshot(path.join(out,'apply-day-'+width+'.png'));
  }
  await b.viewport({width:1440,height:900,mobile:false});await view('day','timeline');
  check('vertical ordinary handles present',await ev(`!!document.querySelector('[data-resize-task="${f.point}"][data-resize-mode=vertical]')`));
  check('vertical full day handles absent',await ev(`!document.querySelector('[data-resize-task="${f.full}"],[data-schedule-move="${f.full}"]')`));
  /* 6.3 轻量确认响应丢失后，重试沿用同一幂等键，服务端只保存一个待审排期。
     申请人不是固定创始人，因此保存后进入待审而不是直接生效。 */
  await ev("Pandora.logout()");
  check('login form is ready for the applicant',await waitFor(b,"!!document.getElementById('login-user')"));
  await login('alpha-one-employee');
  await view('day','horizontal',f.retryDay);
  const beforeRetry=await raw(f.retry);
  check('retry task exposes an hour handle',await ev(`!!document.querySelector('[data-resize-task="${f.retry}"][data-resize=end]')`));
  await drag(`[data-resize-task="${f.retry}"][data-resize=end][data-resize-mode=day]`,2);await confirm();
  await ev(`window.__schedWrites=[];window.__schedFetch=window.fetch;window.fetch=async function(url,opts){const target=String(url)==='/api/v1/tasks/'+${q(f.retry)}&&opts?.method==='PATCH';if(target)window.__schedWrites.push(new Headers(opts.headers).get('Idempotency-Key'));const response=await window.__schedFetch(url,opts);if(target&&window.__schedWrites.length===1)throw new TypeError('simulated response loss after server commit');return response;}`);
  await ev(`document.getElementById('sc-reason').value='轻量确认响应丢失';document.querySelector('[data-action=p-save-schedule]').click()`);
  check('response loss keeps the lightweight draft and reason',await waitFor(b,"Pandora.idle()&&!document.getElementById('sc-error').hidden",20000)&&await ev("document.getElementById('sc-reason').value==='轻量确认响应丢失'&&!document.getElementById('overlay').hidden"));
  await ev("document.querySelector('[data-action=p-save-schedule]').click()");
  check('retry succeeds after the lost response',await waitFor(b,"Pandora.idle()&&document.getElementById('overlay').hidden",20000));
  const scheduleKeys=await ev('window.__schedWrites');
  check('retry reuses one idempotency key',scheduleKeys.length===2&&scheduleKeys[0]===scheduleKeys[1],scheduleKeys);
  const retried=await raw(f.retry);
  check('one pending schedule is saved without publishing it',retried.frozen&&retried.pendingSchedule.dueAt==='2031-02-12T05:00:00Z'&&retried.dueAt===beforeRetry.dueAt,retried);
  await ev('window.fetch=window.__schedFetch;');
  /* 6.4 轻量提交后的待审虚线位置、标题时刻、标签颜色、有效版详情和结果恢复。 */
  const employeeToken=await ev('Pandora.token');
  await monthDrag(f.proposal,2,f.proposalDay);
  const pendingBar=await barState(f.proposal);
  check('pending proposal is drawn once at the proposed date',pendingBar.count===1&&pendingBar.date==='2031-02-22'&&pendingBar.dashed,pendingBar);
  check('pending proposal keeps the exact proposed times',pendingBar.text.includes('2月22日 09:00')&&pendingBar.text.includes('11:00'),pendingBar);
  check('pending proposal keeps the shared first-tag colour',pendingBar.color===f.tag.color,pendingBar);
  const proposalRaw=await raw(f.proposal);
  check('effective task still holds its old schedule',proposalRaw.dueAt==='2031-02-20T03:00:00Z'&&proposalRaw.pendingSchedule.dueAt==='2031-02-22T03:00:00Z',proposalRaw);
  await ev(`Pandora.openTask(${q(f.proposal)})`);
  check('ordinary detail opens on the effective schedule',await waitFor(b,"!document.getElementById('overlay').hidden&&Pandora.idle()",20000)&&await ev("(()=>{const t=document.getElementById('sheetBody').textContent;return t.includes('2月20日')&&t.includes('09:00')&&!t.includes('2月22日')})()"));
  await ev('closeSheet()');
  const withdrawRequest=await api('GET','/approval-requests/'+proposalRaw.pendingRequestId,null,null,employeeToken);
  const withdrawn=await api('PATCH','/approval-requests/'+proposalRaw.pendingRequestId,{decision:'withdraw'},withdrawRequest.body.rowVersion,employeeToken);
  check('applicant withdraws the pending schedule proposal',withdrawn.status===200,withdrawn);
  await reloadMonth(f.proposalDay);
  const withdrawnBar=await barState(f.proposal);
  check('withdrawn proposal restores the effective calendar position',withdrawnBar.date==='2031-02-20'&&!withdrawnBar.dashed,withdrawnBar);
  await monthDrag(f.proposal,3,f.proposalDay);
  const rejectedBar=await barState(f.proposal);
  check('re-reviewed proposal is drawn at the new proposed date',rejectedBar.date==='2031-02-23'&&rejectedBar.dashed,rejectedBar);
  const rejectRaw=await raw(f.proposal);
  const rejected=await decide(rejectRaw.pendingRequestId,'reject',f.tokens.head);
  check('reviewer rejects the schedule proposal',rejected.status===200,rejected);
  await reloadMonth(f.proposalDay);
  const afterReject=await barState(f.proposal);
  check('rejection returns the calendar to the effective date',afterReject.date==='2031-02-20'&&!afterReject.dashed,afterReject);
  await monthDrag(f.proposal,4,f.proposalDay);
  const approvedBar=await barState(f.proposal);
  check('approved candidate projects as pending before the decision',approvedBar.date==='2031-02-24'&&approvedBar.dashed,approvedBar);
  const approveRaw=await raw(f.proposal);
  const approved=await decide(approveRaw.pendingRequestId,'approve',f.tokens.head);
  check('reviewer approves the schedule proposal',approved.status===200,approved);
  await reloadMonth(f.proposalDay);
  const afterApprove=await barState(f.proposal);
  check('approval publishes the proposed date without a dashed frame',afterApprove.date==='2031-02-24'&&!afterApprove.dashed,afterApprove);
  const approvedRaw=await raw(f.proposal);
  check('approval publishes the exact effective times',approvedRaw.dueAt==='2031-02-24T03:00:00Z'&&!approvedRaw.frozen,approvedRaw);
  /* Leave one proposal pending so the parent check can expire it and verify the calendar recovery. */
  await monthDrag(f.expire,2,f.expireDay);
  const expireBar=await barState(f.expire);
  check('expiry fixture is pending at its proposed date',expireBar.date==='2031-02-28'&&expireBar.dashed,expireBar);
  const expireRaw=await raw(f.expire);
  fs.writeFileSync(path.join(out,'handoff.json'),JSON.stringify({task:f.expire,requestId:expireRaw.pendingRequestId}));
  check('no browser exceptions',b.errors.length===0,b.errors);
 }finally{fs.writeFileSync(path.join(out,'browser-report.json'),JSON.stringify(report,null,2));await b.kill();}
}
main().catch(e=>{console.error(e);process.exitCode=1});
