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
 async function view(mode='day',display='horizontal',date=fixture.day){
  await ev(`closeSheet();Pandora.calendar.closeDaySheet();state.viewAnchor=parseDateInput(${js(date)});state.viewMode=${js(mode)};state.viewPage='calendar';Pandora.calendar.resetStream(state.viewAnchor);setPage('view');renderAll()`);
  if(mode==='day')await ev(`document.querySelector('[data-action=schedule-day-mode][data-day-mode="${display}"]').click()`);
  await sleep(200);
 }
 async function raw(id){return ev(`Pandora.request('/tasks/'+${js(id)})`);}
 async function handle(id,edge,mode){
  const selector=`[data-resize-task="${id}"][data-resize="${edge}"][data-resize-mode="${mode}"]`;
  return ev(`(()=>{const h=document.querySelector(${js(selector)});if(!h)return null;h.scrollIntoView({block:'center',inline:'center'});const r=h.getBoundingClientRect(),bar=h.closest('.p-month-event,.p-horizontal-bar,.p-axis-event,.p-all-day-event');if(!r.width||!r.height)return null;return {x:r.x+r.width/2,y:r.y+r.height/2,vertical:${js(mode)}==='vertical'||${js(mode)}==='allday',unit:${js(mode)}==='month'?bar.closest('.p-month-week').getBoundingClientRect().width/7:${js(mode)}==='vertical'?bar.closest('.p-axis-events').getBoundingClientRect().height/24:${js(mode)}==='allday'?(document.querySelector('.p-day-axis')?.getBoundingClientRect().height||1440)/24:bar.closest('.p-horizontal-axis').getBoundingClientRect().width/24}})()`);
 }
 async function drag(id,edge,mode,steps,cancel){
  const h=await handle(id,edge,mode);check('handle reachable '+edge+' '+mode,!!h,h);
  await b.send('Input.dispatchMouseEvent',{type:'mouseMoved',x:h.x,y:h.y});
  await b.send('Input.dispatchMouseEvent',{type:'mousePressed',x:h.x,y:h.y,button:'left',clickCount:1});
  await b.send('Input.dispatchMouseEvent',{type:'mouseMoved',x:h.x+(h.vertical?0:h.unit*steps),y:h.y+(h.vertical?h.unit*steps:0),button:'left',buttons:1});
  check('drag preview visible',await ev(`!!document.querySelector('.p-drag-preview')&&document.querySelector('.p-drag-ghost').textContent.includes(taskById(${js(id)}).title)`));
  if(cancel==='escape')await b.send('Input.dispatchKeyEvent',{type:'keyDown',key:'Escape',code:'Escape',windowsVirtualKeyCode:27});
  if(cancel==='pointercancel')await ev(`document.querySelector(${js(`[data-resize-task="${id}"][data-resize="${edge}"][data-resize-mode="${mode}"]`)}).dispatchEvent(new PointerEvent('pointercancel',{pointerId:1,bubbles:true}))`);
  await b.send('Input.dispatchMouseEvent',{type:'mouseReleased',x:h.x+(h.vertical?0:h.unit*steps),y:h.y+(h.vertical?h.unit*steps:0),button:'left',clickCount:1});
  await sleep(150);
 }
 async function moveDay(id,mode,steps){
  const data=await ev(`(()=>{const n=document.querySelector('${mode==='vertical'?'.p-axis-event':'.p-horizontal-bar'}[data-task="${id}"]'),f=${js(mode)}==='vertical'?n.querySelector('.p-axis-true'):n;f.scrollIntoView({block:'center',inline:'center'});const r=f.getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2,left:r.left,top:r.top,width:r.width,height:r.height}})()`);
  const vertical=mode==='vertical';
  await b.send('Input.dispatchMouseEvent',{type:'mousePressed',x:data.x,y:data.y,button:'left',clickCount:1});
  await b.send('Input.dispatchMouseEvent',{type:'mouseMoved',x:data.x+(vertical?0:steps*60),y:data.y+(vertical?steps*60:0),button:'left',buttons:1});
  const ghost=await ev("(()=>{const r=document.querySelector('.p-drag-ghost').getBoundingClientRect();return {left:r.left,top:r.top,width:r.width,height:r.height}})()");
  check('whole day move ghost shifts without resizing '+mode,Math.abs((vertical?ghost.top-data.top:ghost.left-data.left)-steps*60)<1&&Math.abs((vertical?ghost.height-data.height:ghost.width-data.width))<1,ghost);
  await b.send('Input.dispatchMouseEvent',{type:'mouseReleased',x:data.x+(vertical?0:steps*60),y:data.y+(vertical?steps*60:0),button:'left',clickCount:1});await form();
 }
 async function moveMonth(id,steps,cancel=false){   const p=await ev(`(()=>{const n=document.querySelector('.p-month-event[data-task="${id}"]');n.scrollIntoView({block:'center'});const r=n.querySelector('.p-month-duration').getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2,unit:n.closest('.p-month-week').getBoundingClientRect().width/7}})()`);
   await b.send('Input.dispatchMouseEvent',{type:'mousePressed',x:p.x,y:p.y,button:'left',clickCount:1});
   await b.send('Input.dispatchMouseEvent',{type:'mouseMoved',x:p.x+steps*p.unit,y:p.y,buttons:1,button:'left'});
   check('month whole task move shows preview',await ev("!!document.querySelector('.p-drag-preview')"));
   if(cancel)await b.send('Input.dispatchKeyEvent',{type:'keyDown',key:'Escape',code:'Escape',windowsVirtualKeyCode:27});
   await b.send('Input.dispatchMouseEvent',{type:'mouseReleased',x:p.x+steps*p.unit,y:p.y,button:'left',clickCount:1});
 }
 async function dragAllDay(id,edge,steps){
   const h=await handle(id,edge,'allday');check('all-day handle reachable '+edge,!!h,h);
   await b.send('Input.dispatchMouseEvent',{type:'mouseMoved',x:h.x,y:h.y});
   await b.send('Input.dispatchMouseEvent',{type:'mousePressed',x:h.x,y:h.y,button:'left',clickCount:1});
   await b.send('Input.dispatchMouseEvent',{type:'mouseMoved',x:h.x,y:h.y+h.unit*steps,button:'left',buttons:1});
   check('all-day drag preview visible',await ev("!!document.querySelector('.p-drag-preview')"));
   await b.send('Input.dispatchMouseEvent',{type:'mouseReleased',x:h.x,y:h.y+h.unit*steps,button:'left',clickCount:1});
   await sleep(150);
 }
 async function form(){check('drag opens confirmation form',await waitFor(b,"!!drafts.task&&!document.getElementById('overlay').hidden&&!document.getElementById('overlay').hidden&&Pandora.idle()"));}
 async function save(reason){await ev(`document.getElementById('tf-reason').value=${js(reason)};document.querySelector('[data-action=save-task]').click()`);check('schedule submitted',await waitFor(b,"Pandora.idle()&&document.getElementById('overlay').hidden",20000),await ev("document.getElementById('tf-error')?.textContent"));}
 try{
  await login('founder');await sleep(5100);await view();
  check('horizontal day is default',await ev("!!document.querySelector('.p-horizontal-axis')"));
  check('day contains every task once including full days and points',await ev(`document.querySelectorAll('.p-horizontal-task').length===4&&document.querySelectorAll('.p-horizontal-task[data-task="${fixture.full}"]').length===1`));
  const original=await raw(fixture.task);
  for(const width of [320,390,1440]){
   await b.viewport({width,height:width===1440?900:844,mobile:width!==1440});await view('month');
   const geometry=await ev(`(()=>{const n=document.querySelector('.p-month-event[data-task="${fixture.task}"]'),r=n.getBoundingClientRect(),d=n.querySelector('.p-month-duration').getBoundingClientRect();return {ratio:d.width/r.width,left:(d.left-r.left)/r.width}})()`);
   check('month paints the occupied company date rather than an hour slice '+width,Math.abs(geometry.ratio-1)<.004&&Math.abs(geometry.left)<.004,geometry);
   check('month text is inside real frame without labeled buttons '+width,await ev(`(()=>{const n=document.querySelector('.p-month-event[data-task="${fixture.task}"]'),f=n.querySelector('.p-month-duration'),c=n.querySelector('.p-month-caption'),r=f.getBoundingClientRect(),t=c.getBoundingClientRect();return t.left>=r.left-1&&t.right<=r.right+1&&t.top>=r.top-1&&t.bottom<=r.bottom+1&&!n.querySelector('button')&&!!f.querySelector('.p-month-event-title')})()`));
   await b.screenshot(path.join(out,'partial-month-'+width+'.png'));
  }
  check('three-hour and full-day tasks occupy the same single date cell',await ev(`(()=>{const box=id=>{const n=document.querySelector('.p-month-event[data-task="'+id+'"]'),r=n.getBoundingClientRect(),d=n.querySelector('.p-month-duration').getBoundingClientRect();return {w:r.width?d.width/r.width:null,l:r.width?(d.left-r.left)/r.width:null,span:Number(n.dataset.span)}};const a=box(${js(fixture.short)}),b=box(${js(fixture.shortFull)});return Math.abs(a.w-1)<.004&&Math.abs(a.l)<.004&&a.span===1&&Math.abs(b.w-a.w)<.004&&Math.abs(b.l-a.l)<.004})()`));
  check('midnight ending paints only its own company date',await ev(`(()=>{const n=document.querySelector('.p-month-event[data-task="${fixture.shortFull}"]');return !!n&&Number(n.dataset.endColumn)-Number(n.dataset.startColumn)===1&&Number(n.dataset.span)===1})()`));
  await b.viewport({width:1440,height:900,mobile:false});await view('month');
  const clickPoint=await ev(`(()=>{const n=document.querySelector('.p-month-event[data-task="${fixture.task}"]');n.scrollIntoView({block:'center'});const r=n.getBoundingClientRect();return {x:r.x+r.width*.25,y:r.y+8}})()`);
  await b.send('Input.dispatchMouseEvent',{type:'mousePressed',x:clickPoint.x,y:clickPoint.y,button:'left',clickCount:1});
  await b.send('Input.dispatchMouseEvent',{type:'mouseReleased',x:clickPoint.x,y:clickPoint.y,button:'left',clickCount:1});
  check('plain month click still opens day list',await waitFor(b,`Pandora.calendar.currentDaySheet()?.date===${js(fixture.day)}`));
  await ev('Pandora.calendar.closeDaySheet()');
  await b.viewport({width:390,height:844,mobile:true});await view('month');
  const scrollPoint=await ev(`(()=>{const n=document.querySelector('.p-month-event[data-task="${fixture.task}"]');n.scrollIntoView({block:'center'});const r=n.getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+8,scroll:document.querySelector('.p-month-scroll').scrollTop}})()`);
  await b.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:scrollPoint.x,y:scrollPoint.y,id:0}]});
  await b.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:scrollPoint.x,y:scrollPoint.y-65,id:0}]});
  await b.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await sleep(250);
  const touchScroll=await ev(`(()=>{const s=document.querySelector('.p-month-scroll');const hit=document.elementFromPoint(${scrollPoint.x},${scrollPoint.y});return {overlay:document.getElementById('overlay').hidden,preview:!!document.querySelector('.p-drag-preview'),scroll:s.scrollTop,before:${scrollPoint.scroll},max:s.scrollHeight-s.clientHeight,hit:hit&&hit.className,touch:hit&&getComputedStyle(hit).touchAction}})()`);
  check('month vertical touch scroll does not submit a move',touchScroll.overlay&&!touchScroll.preview&&Math.abs(touchScroll.scroll-touchScroll.before)>1,touchScroll);
  await b.viewport({width:1440,height:900,mobile:false});await view();
  const pointClick=await handle(fixture.point,'end','day');
  await b.send('Input.dispatchMouseEvent',{type:'mousePressed',x:pointClick.x,y:pointClick.y,button:'left',clickCount:1});
  await b.send('Input.dispatchMouseEvent',{type:'mouseReleased',x:pointClick.x,y:pointClick.y,button:'left',clickCount:1});
  check('point edge click without movement still opens task',await waitFor(b,"Pandora.idle()&&!document.getElementById('overlay').hidden&&document.getElementById('sheetBody').textContent.includes('零时长会议')&&!document.getElementById('tf-start-date')"));
  await ev('closeSheet()');await view();
  await moveDay(fixture.task,'day',1);
  check('horizontal frame moves both endpoints',await ev("drafts.task.startTime==='10:20'&&drafts.task.endTime==='19:20'"));
  await ev('closeSheet()');await view();
  await drag(fixture.task,'end','day',2,'escape');
  check('escape leaves no form or changed version',await ev("!document.querySelector('.p-drag-preview')&&document.getElementById('overlay').hidden")&&(await raw(fixture.task)).rowVersion===original.rowVersion);
  await drag(fixture.task,'end','day',2,'pointercancel');
  check('pointercancel does not submit',await ev("document.getElementById('overlay').hidden")&&(await raw(fixture.task)).rowVersion===original.rowVersion);
  await drag(fixture.task,'end','day',2);await form();
  check('day end advances two hours preserving minutes',await ev("drafts.task.endTime==='20:20'&&drafts.task.startTime==='09:20'"));
  check('preview has not persisted', (await raw(fixture.task)).dueAt===original.dueAt);
  await save('横向调整截止');
  check('founder saved precise timed range', (await raw(fixture.task)).dueAt==='2030-12-31T12:20:00Z'&&!(await raw(fixture.task)).allDay);
  await view('month');await drag(fixture.task,'end','month',1);await form();
  check('month end moves one company day and keeps the clock time',await ev("drafts.task.endDate==='2031-01-01'&&drafts.task.endTime==='20:20'"));
  await ev('closeSheet()');await view('month');await drag(fixture.task,'end','month',4);await form();
  check('month drag crosses year by days and preserves time',await ev("drafts.task.endDate==='2031-01-04'&&drafts.task.endTime==='20:20'&&drafts.task.startDate==='2030-12-31'"));
  await save('跨年截止');
  check('cross-year end persisted by days',(await raw(fixture.task)).dueAt==='2031-01-04T12:20:00Z');
  await view();
  await view('month');
  check('month continuation has no extra schedule button',await ev("!document.querySelector('.p-month-event [data-action=p-adjust-schedule]')"));
  await moveMonth(fixture.task,1);await form();
  check('whole month move shifts both dates and keeps time and duration',await ev("drafts.task.startDate==='2031-01-01'&&drafts.task.startTime==='09:20'&&drafts.task.endDate==='2031-01-05'&&drafts.task.endTime==='20:20'"));
  await ev('closeSheet()');await view('month');
  await drag(fixture.task,'start','month',1);await form();
  check('month start moves one day keeping the other endpoint',await ev("drafts.task.startDate==='2031-01-01'&&drafts.task.startTime==='09:20'&&drafts.task.endDate==='2031-01-04'&&drafts.task.endTime==='20:20'"));
  await ev('closeSheet()');await view();
  check('clipped continuation has no false end handle',await ev(`!document.querySelector('[data-resize-task="${fixture.task}"][data-resize=end]')`));
  await drag(fixture.task,'start','day',-1);await form();
  check('start changes independently',await ev("drafts.task.startTime==='08:20'&&drafts.task.endTime==='20:20'&&drafts.task.endDate==='2031-01-04'"));
  await ev('closeSheet()');await view();
  await drag(fixture.point,'start','day',1);
  check('inverse point range rejected',await ev("document.getElementById('overlay').hidden")&&(await raw(fixture.point)).startAt===(await raw(fixture.point)).dueAt,await ev("({form:!document.getElementById('overlay').hidden,draft:drafts.task&&{id:drafts.task.id,start:drafts.task.startTime,end:drafts.task.endTime},preview:document.querySelector('.p-drag-preview')?.textContent})"));
  await drag(fixture.point,'end','day',1);await form();
  check('zero duration endpoint can expand',await ev("drafts.task.startTime==='12:00'&&drafts.task.endTime==='13:00'"));
  await ev('closeSheet()');await view();
  await handle(fixture.full,'end','day');
  await ev(`document.querySelector('[data-resize-task="${fixture.full}"][data-resize=end]').focus()`);
  await b.send('Input.dispatchKeyEvent',{type:'keyDown',key:'ArrowLeft',code:'ArrowLeft',windowsVirtualKeyCode:37});await form();
  check('keyboard midnight endpoint uses correct date',await ev("drafts.task.endDate==='2030-12-31'&&drafts.task.endTime==='23:00'"));
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
   check('horizontal captions stay inside actual frames '+width,await ev("[...document.querySelectorAll('.p-horizontal-caption')].length>0&&[...document.querySelectorAll('.p-horizontal-caption')].every(n=>{const r=n.getBoundingClientRect(),f=n.closest('.p-horizontal-bar').getBoundingClientRect();return r.left>=f.left-1&&r.right<=f.right+1&&r.top>=f.top-1&&r.bottom<=f.bottom+1&&getComputedStyle(n.querySelector('strong')).visibility==='visible'})&&!document.querySelector('.p-horizontal-label')"));
   await b.screenshot(path.join(out,'day-'+width+'.png'));
  }
  await b.viewport({width:390,height:844,mobile:true});await view();
  const touchHandle=await handle(fixture.task,'start','day');
  await b.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:touchHandle.x,y:touchHandle.y,id:0}]});
  await b.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:touchHandle.x-touchHandle.unit,y:touchHandle.y,id:0}]});
  await b.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await form();
  check('touch drag adjusts by one hour',await ev("drafts.task.startTime==='08:20'"));
  await ev('closeSheet()');
  await b.viewport({width:1440,height:900,mobile:false});await view('day','timeline');
  check('vertical timeline has accessible endpoint handles',await ev(`!!document.querySelector('[data-resize-task="${fixture.task}"][data-resize-mode=vertical]')`));
  await moveDay(fixture.task,'vertical',1);
  check('vertical frame moves both complete endpoints',await ev("drafts.task.startTime==='10:20'&&drafts.task.endTime==='21:20'&&drafts.task.endDate==='2031-01-04'"));
  await ev('closeSheet()');await view('day','timeline');
  await drag(fixture.task,'start','vertical',-1);await form();
  check('vertical drag keeps minutes and other endpoint',await ev("drafts.task.startTime==='08:20'&&drafts.task.endTime==='20:20'&&drafts.task.endDate==='2031-01-04'"));
  await ev('closeSheet()');await view('day','timeline');
  await ev("window.savedPointerCapture=Element.prototype.setPointerCapture;Element.prototype.setPointerCapture=function(){throw new DOMException('simulated unsupported capture')}");
  await drag(fixture.point,'end','vertical',1);await form();
  check('document fallback completes drag when pointer capture fails',await ev("drafts.task.endTime==='13:00'"));
  await save('纵向小时调整并验证捕获回退');
  check('vertical proposal actually persists',(await raw(fixture.point)).dueAt==='2030-12-31T05:00:00Z');
  await ev('Element.prototype.setPointerCapture=window.savedPointerCapture');await view('day','timeline');
  await drag(fixture.task,'start','vertical',-1,'escape');
  check('vertical cancel leaves effective range unchanged',(await raw(fixture.task)).startAt===original.startAt&&await ev("document.getElementById('overlay').hidden"));
  for(const width of [320,390,1440]){await b.viewport({width,height:width===1440?900:844,mobile:width!==1440});await view('day','timeline');await handle(fixture.task,'start','vertical');await b.screenshot(path.join(out,'vertical-hour-'+width+'.png'));}
  await ev(`document.querySelector('.p-axis-event[data-task="${fixture.task}"]').focus()`);
  await b.send('Input.dispatchKeyEvent',{type:'keyDown',key:'Enter',code:'Enter',windowsVirtualKeyCode:13,text:'\r'});
  check('vertical task wrapper still opens detail with keyboard',await waitFor(b,"Pandora.idle()&&!document.getElementById('overlay').hidden&&document.getElementById('sheetBody').textContent.includes('横向排期验证')"));
  await ev('closeSheet()');
  await b.viewport({width:390,height:844,mobile:true});await view('day','timeline');
  const vTouch=await handle(fixture.task,'start','vertical');
  await b.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:vTouch.x,y:vTouch.y,id:0}]});
  await b.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:vTouch.x,y:vTouch.y-vTouch.unit,id:0}]});
  await b.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await form();
  check('vertical touch drag is not swallowed by scroll',await ev("drafts.task.startTime==='08:20'"));
  await ev('closeSheet()');
  // V-001: the vertical all-day section keeps hour interaction for historical all-day and timed full-day tasks.
  await b.viewport({width:1440,height:900,mobile:false});
  await view('day','timeline');
  check('all-day section exposes real endpoints and whole-bar move',await ev(`!!document.querySelector('.p-all-day-event[data-task="${fixture.full}"] [data-resize-mode=allday][data-resize=end]')&&!!document.querySelector('.p-all-day-event[data-task="${fixture.legacy}"] [data-schedule-move][data-resize-mode=allday]')`));
  const fullBefore=await raw(fixture.full);
  await dragAllDay(fixture.full,'end',1);await form();
  check('timed full-day task endpoint adds one hour',await ev("drafts.task.startDate==='2030-12-31'&&drafts.task.startTime==='00:00'&&drafts.task.endDate==='2031-01-01'&&drafts.task.endTime==='01:00'"));
  await save('全天区定时整日任务端点 +1 小时');
  const fullAfter=await raw(fixture.full);
  check('timed full-day endpoint persisted and start kept',new Date(fullAfter.dueAt).getTime()===new Date(fullBefore.dueAt).getTime()+3600000&&fullAfter.startAt===fullBefore.startAt,{fullBefore,fullAfter});
  await view('day','timeline');
  await dragAllDay(fixture.legacy,'start',1);await form();
  check('historical all-day start moves one hour keeping the other endpoint',await ev("drafts.task.startDate==='2030-12-31'&&drafts.task.startTime==='01:00'&&drafts.task.endDate==='2030-12-31'&&drafts.task.endTime==='18:00'"));
  await ev('closeSheet()');
  await view('day','timeline');
  const alldayMove=await ev(`(()=>{const n=document.querySelector('.p-all-day-event[data-task="${fixture.legacy}"] .p-allday-move');n.scrollIntoView({block:'center'});const r=n.getBoundingClientRect(),axis=document.querySelector('.p-day-axis');return {x:r.x+r.width/2,y:r.y+r.height/2,unit:(axis?axis.getBoundingClientRect().height:1440)/24}})()`);
  await b.send('Input.dispatchMouseEvent',{type:'mousePressed',x:alldayMove.x,y:alldayMove.y,button:'left',clickCount:1});
  await b.send('Input.dispatchMouseEvent',{type:'mouseMoved',x:alldayMove.x,y:alldayMove.y+alldayMove.unit,button:'left',buttons:1});
  check('all-day whole move shows preview',await ev("!!document.querySelector('.p-drag-preview')"));
  await b.send('Input.dispatchMouseEvent',{type:'mouseReleased',x:alldayMove.x,y:alldayMove.y+alldayMove.unit,button:'left',clickCount:1});
  await form();
  check('all-day whole move shifts both endpoint hours',await ev("drafts.task.startDate==='2030-12-31'&&drafts.task.startTime==='01:00'&&drafts.task.endDate==='2030-12-31'&&drafts.task.endTime==='19:00'"));
  await ev('closeSheet()');await view('day','timeline');
  await ev(`document.querySelector('[data-resize-task="${fixture.legacy}"][data-resize=start][data-resize-mode=allday]').focus()`);
  await b.send('Input.dispatchKeyEvent',{type:'keyDown',key:'ArrowDown',code:'ArrowDown',windowsVirtualKeyCode:40});await form();
  check('all-day keyboard endpoint uses the hour step',await ev("drafts.task.startTime==='01:00'&&drafts.task.endTime==='18:00'&&drafts.task.endDate==='2030-12-31'"));
  await ev('closeSheet()');
  await b.viewport({width:320,height:844,mobile:true});await view('day','timeline');
  check('all-day handles stay reachable at 320',await ev(`(()=>{const h=document.querySelector('[data-resize-task="${fixture.legacy}"][data-resize=start][data-resize-mode=allday]');if(!h)return false;const r=h.getBoundingClientRect();return r.width>0&&r.height>0&&document.documentElement.scrollWidth<=innerWidth+1})()`));
  await b.screenshot(path.join(out,'allday-handles-320.png'));
  await b.viewport({width:390,height:844,mobile:true});await view('day','timeline');
  await b.screenshot(path.join(out,'allday-handles-390.png'));
  await b.viewport({width:1440,height:900,mobile:false});
  for(const width of [320,390]){
   await b.viewport({width,height:844,mobile:true});await view('month');
   const before=await raw(fixture.full),mh=await handle(fixture.full,'end','month');
   check('month touch handle reachable '+width,!!mh,mh);
   await b.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:mh.x,y:mh.y,id:0}]});
   await b.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:mh.x+mh.unit,y:mh.y,id:0}]});
   await b.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await form();
   check('month touch adds one company day '+width,await ev(`parseDateTime(drafts.task.endDate,drafts.task.endTime).getTime()===${new Date(before.dueAt).getTime()+86400000}`));
   await save('小屏月历触摸调整 '+width);
   const after=await raw(fixture.full);
   check('month touch persists endpoint only '+width,new Date(after.dueAt).getTime()===new Date(before.dueAt).getTime()+86400000&&after.startAt===before.startAt);
   await ev('Pandora.reload()');await view('month');await handle(fixture.full,'end','month');
   check('month small screen has no overflow '+width,await ev('document.documentElement.scrollWidth<=innerWidth+1'));
   await b.screenshot(path.join(out,'month-touch-'+width+'.png'));
  }
  await b.viewport({width:1440,height:900,mobile:false});
  await view('month');await handle(fixture.task,'start','month');await b.screenshot(path.join(out,'month-1440.png'));
  const stale=await raw(fixture.task);
  await ev(`Pandora.mutation('stale-schedule-test','PATCH','/tasks/'+${js(fixture.task)},{command:'change',reason:'并发验证',description:'已由新版本更新'},'"'+${stale.rowVersion}+'"')`);
  await ev(`Pandora.openScheduleChange(${js(fixture.task)},new Date('2030-12-31T02:00:00Z'),new Date('2031-01-01T11:00:00Z'),${stale.rowVersion})`);
  check('stale drag reports conflict without overriding latest values',await ev("document.getElementById('tf-error').textContent.includes('已被更新')&&drafts.task.startTime==='09:20'"));
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
  check('visible assignee has schedule handles without metadata permission',await ev(`!!document.querySelector('[data-resize-task="${fixture.forbidden}"]')&&!canEditTask(actor(),taskById(${js(fixture.forbidden)}))`));
  await view('month');await moveMonth(fixture.forbidden,2,true);
  check('cancelled whole month movement preserves effective data',await ev("document.getElementById('overlay').hidden")&&(await raw(fixture.forbidden)).startAt==='2030-12-31T01:00:00Z');
  await view('month');await moveMonth(fixture.forbidden,1);await form();
  check('month moves both endpoints by one day preserving clock time',await ev("drafts.task.startDate==='2031-01-01'&&drafts.task.startTime==='09:00'&&drafts.task.endDate==='2031-01-01'&&drafts.task.endTime==='18:00'"));
  check('schedule-only form hides other task fields',await ev("drafts.task.mode==='schedule'&&!document.getElementById('tf-title')&&!document.getElementById('tf-assignees')&&!document.getElementById('tf-urgency')"));
 check('schedule form renders no canvas drag controls',await ev("!document.querySelector('#sheetBody [data-resize-task],#sheetBody [data-schedule-move],#sheetBody .p-month-event,#sheetBody .p-axis-event')"));
  check('non-owner schedule review follows operator manager',await ev(`drafts.task.preview.reviewerId===${js(fixture.identities['alpha-one-head'].id)}`));
  await save('本人可见任务月历直接移动');
  const viewerPending=await raw(fixture.forbidden);
  check('non-owner proposal leaves effective schedule pending',viewerPending.frozen&&viewerPending.pendingSchedule.startAt==='2031-01-01T01:00:00Z'&&viewerPending.startAt==='2030-12-31T01:00:00Z');
  await view();
  const prior=await raw(fixture.employee);
  await drag(fixture.employee,'end','day',1);await form();
  check('drag review uses operator manager',await ev(`drafts.task.preview.requiresApproval&&drafts.task.preview.reviewerId===${js(fixture.identities['alpha-one-head'].id)}`));
  await save('员工调整排期需审核');
  const pending=await raw(fixture.employee);
  check('pending change keeps effective schedule and freezes',pending.dueAt===prior.dueAt&&pending.frozen);
  await view();check('frozen task has no handles',await ev(`!document.querySelector('[data-resize-task="${fixture.employee}"]')`));
  check('pending API carries only schedule proposal',pending.pendingSchedule?.dueAt==='2030-12-31T11:00:00Z'&&Object.keys(pending.pendingSchedule).sort().join(',')==='allDay,dueAt,dueDate,startAt,startDate');
  check('calendar uses pending placement without changing effective TASKS',await ev(`viewTasks(actor()).find(t=>t.id===${js(fixture.employee)}).raw.dueAt==='2030-12-31T11:00:00Z'&&taskById(${js(fixture.employee)}).raw.dueAt===${js(prior.dueAt)}`));
  check('horizontal pending bar is dashed',await ev(`getComputedStyle(document.querySelector('.p-horizontal-bar[data-task="${fixture.employee}"]')).borderTopStyle==='dashed'&&document.querySelector('.p-horizontal-row:has([data-task="${fixture.employee}"])').textContent.includes('审核中')`));
  await view('day','timeline');
  check('vertical pending true range is dashed',await ev(`getComputedStyle(document.querySelector('.p-axis-event[data-task="${fixture.employee}"] .p-axis-true')).borderTopStyle==='dashed'`));
  await view('month');
  check('month pending bar is dashed',await ev(`getComputedStyle(document.querySelector('.p-month-event[data-task="${fixture.employee}"] .p-month-duration')).outlineStyle==='dashed'`));
  await ev('Pandora.logout()');await login('alpha-one-employee');await view();
  check('pending projection survives relogin',await ev(`document.querySelector('.p-horizontal-bar[data-task="${fixture.employee}"]').classList.contains('is-pending-review')&&viewTasks(actor()).find(t=>t.id===${js(fixture.employee)}).due.toISOString()==='2030-12-31T11:00:00.000Z'`));
  async function as(who,method,url,body,version){return ev(`(async()=>{
   const login=await fetch('/api/v1/auth/sessions',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(${js({accountType:fixture.identities[who].accountType,...(fixture.identities[who].accountType==='admin'?{accountName:fixture.identities[who].identifier}:{phone:fixture.identities[who].identifier}),password:'Fixture@123456'})})});const token=(await login.json()).token;
   const r=await fetch('/api/v1'+${js(url)},{method:${js(method)},headers:{'Content-Type':'application/json','Authorization':'Bearer '+token,'Idempotency-Key':crypto.randomUUID(),...(typeof ${js(version)}==='number'?{'If-Match':'"'+${js(version)}+'"'}:{})},...(${js(body)}===null?{}:{body:JSON.stringify(${js(body)})})});const data=await r.json();if(!r.ok)throw new Error(JSON.stringify(data));return data;
  })()`);}
  async function decide(decision){const task=await raw(fixture.employee),who=decision==='withdraw'?'alpha-one-employee':'alpha-one-head';const request=await as(who,'GET','/approval-requests/'+task.pendingRequestId,null);await as(who,'PATCH','/approval-requests/'+task.pendingRequestId,{decision,comment:decision==='reject'?'恢复原排期':undefined},request.rowVersion);await ev('Pandora.reload()');}
  async function propose(command,extra={}){const task=await raw(fixture.employee);await as('alpha-one-employee','PATCH','/tasks/'+fixture.employee,{command,...(['change','reopen'].includes(command)?{reason:'待审日程投影验证'}:{}),...extra},task.rowVersion);await ev('Pandora.reload()');}
  await decide('approve');await view();
  check('approval applies new time and removes dash',!(await raw(fixture.employee)).pendingSchedule&&(await raw(fixture.employee)).dueAt==='2030-12-31T11:00:00Z'&&await ev(`!document.querySelector('.p-horizontal-bar[data-task="${fixture.employee}"]').classList.contains('is-pending-review')`));
  await ev('Pandora.logout()');await login('founder');
  await ev(`setPage('me');runAction({dataset:{action:'p-open-person',id:${js(fixture.identities['alpha-one-employee'].id)}}})`);
  await waitFor(b,"Pandora.idle()&&!!document.querySelector('[data-staff-panel]')");
  await ev("document.getElementById('staff-calendar-date').value='2030-12-31';document.getElementById('staff-calendar-date').dispatchEvent(new Event('change',{bubbles:true}))");
  const approved=await waitFor(b,`(()=>{const n=document.querySelector('.staff-month-event[data-task="${fixture.employee}"]');return !!n&&!n.classList.contains('is-pending-review')&&n.textContent.includes('19:00')})()`,15000);
  const approvedStaff=await ev(`(()=>{const n=document.querySelector('.staff-month-event[data-task="${fixture.employee}"]');return {found:!!n,pending:n&&n.classList.contains('is-pending-review'),text:n&&n.textContent,anyPending:!!document.querySelector('.staff-panel .is-pending-review'),date:document.getElementById('staff-calendar-date')&&document.getElementById('staff-calendar-date').value}})()`);
  check('approved staff schedule shows the new effective day without a dash',approved&&approvedStaff.found&&!approvedStaff.pending&&approvedStaff.text.includes('19:00'),approvedStaff);
  await ev('closeSheet();Pandora.logout()');await login('alpha-one-employee');
  const janStart='2031-01-02T02:20:00Z',janEnd='2031-01-02T09:20:00Z';
  for(const decision of ['reject','withdraw']){
   await propose('change',{allDay:false,startAt:janStart,dueAt:janEnd});await view();
   check('old day does not retain duplicate '+decision,await ev(`!document.querySelector('.p-horizontal-bar[data-task="${fixture.employee}"]')`));
   await view('day','horizontal','2031-01-02');
   check('cross-month proposal shown once at new time '+decision,await ev(`document.querySelectorAll('.p-horizontal-bar[data-task="${fixture.employee}"]').length===1&&viewTasks(actor()).find(t=>t.id===${js(fixture.employee)}).start.toISOString()==='2031-01-02T02:20:00.000Z'`));
   const query='/tasks?assigneeId='+fixture.identities['alpha-one-employee'].id+'&from=2031-01-02&to=2031-01-02';
   const rows=await as('alpha-one-head','GET',query+'&calendarPreview=true',null),effective=await as('alpha-one-head','GET',query,null);
   check('authorized subordinate range follows proposal '+decision,rows.items.some(t=>t.id===fixture.employee)&&!effective.items.some(t=>t.id===fixture.employee));
   const outside=await as('beta-one-head','GET',query+'&calendarPreview=true',null);check('proposal range does not widen task authorization '+decision,!outside.items.some(t=>t.id===fixture.employee));
   await ev('Pandora.logout()');await login('founder');
    await ev(`setPage('me');runAction({dataset:{action:'p-open-person',id:${js(fixture.identities['alpha-one-employee'].id)}}})`);
    check('authorized staff workspace opens for pending task',await waitFor(b,"Pandora.idle()&&!!document.querySelector('[data-staff-panel]')&&!document.querySelector('.staff-state[role=status]')"));
    await ev("document.getElementById('staff-calendar-date').value='2031-01-02';document.getElementById('staff-calendar-date').dispatchEvent(new Event('change',{bubbles:true}))");
    check('staff month finds moved pending proposal',await waitFor(b,`!!document.querySelector('.staff-month-event.is-pending-review[data-task="${fixture.employee}"]')`));
    check('staff calendar exposes no drag handles or move sources',await ev(`!document.querySelector('.staff-panel [data-resize-task],.staff-panel [data-schedule-move]')`));
    check('staff month pending color keeps dashed border',await ev(`getComputedStyle(document.querySelector('.staff-month-event[data-task="${fixture.employee}"] .staff-month-duration')).outlineStyle==='dashed'`));
    await ev("document.querySelector('[data-action=p-staff-mode][data-mode=day]').click()");
    check('staff day uses proposed minute range',await waitFor(b,`!!document.querySelector('.staff-axis-event.is-pending-review[data-task="${fixture.employee}"][data-start-minute="620"][data-end-minute="1040"]')`));
    check('staff day axis also exposes no drag entry',await ev(`!document.querySelector('.staff-axis-event [data-resize-task],.staff-axis-event [data-schedule-move]')`));
    await b.screenshot(path.join(out,'pending-staff-day.png'));
    await ev("document.querySelector('[data-action=p-staff-format][data-format=list]').click()");
    check('staff pending list shows proposed date and dash',await ev(`getComputedStyle(document.querySelector('.staff-work-item[data-task="${fixture.employee}"]')).borderTopStyle==='dashed'&&document.querySelector('.staff-work-item[data-task="${fixture.employee}"]').textContent.includes('审核中')`));
    await ev('closeSheet();Pandora.logout()');await login('alpha-one-employee');
    for(const width of [320,390,1440]){
     await b.viewport({width,height:width===1440?900:844,mobile:width!==1440});await view('day','horizontal','2031-01-02');await b.screenshot(path.join(out,'pending-day-'+width+'.png'));
     await view('month','horizontal','2031-01-02');
     const frame=await ev(`(()=>{const n=document.querySelector('.p-month-event[data-task="${fixture.employee}"]'),o=n.getBoundingClientRect(),f=n.querySelector('.p-month-duration'),r=f.getBoundingClientRect(),c=f.querySelector('.p-month-caption').getBoundingClientRect();return {left:(r.left-o.left)/o.width,width:r.width/o.width,inside:c.left>=r.left-1&&c.right<=r.right+1&&c.top>=r.top-1&&c.bottom<=r.bottom+1,text:f.textContent,noButtons:!n.querySelector('button')}})()`);
     check('pending frame and its text match the proposed day '+width,Math.abs(frame.left)<.004&&Math.abs(frame.width-1)<.004&&frame.inside&&frame.text.includes('10:20')&&frame.text.includes('17:20')&&frame.noButtons,frame);
     await b.screenshot(path.join(out,'pending-month-'+width+'.png'));
    }
   await decide(decision);await view();
   check('resolved proposal restores effective position '+decision,!(await raw(fixture.employee)).pendingSchedule&&await ev(`!!document.querySelector('.p-horizontal-bar[data-task="${fixture.employee}"]:not(.is-pending-review)')`));
  }
  await propose('progress',{progressNote:'进展审核虚线'});await view();
  check('progress review also uses dashed style',await ev(`!!document.querySelector('.p-horizontal-bar.is-pending-review[data-task="${fixture.employee}"]')`));
  await decide('withdraw');
  await propose('complete',{completionNote:'完成审核虚线'});await view();
  check('completion review also uses dashed style',await ev(`!!document.querySelector('.p-horizontal-bar.is-pending-review[data-task="${fixture.employee}"]')`));
  await decide('approve');await propose('reopen',{allDay:false,startAt:janStart,dueAt:janEnd,assigneeIds:[fixture.identities['alpha-one-employee'].id]});await view('day','timeline','2031-01-02');
  check('reopen review uses proposed range and dash',await ev(`!!document.querySelector('.p-axis-event.is-pending-review[data-task="${fixture.employee}"]')`));
  await decide('approve');
  const handoverRaw=await raw(fixture.employee);
  await as('alpha-one-employee','POST','/tasks/'+fixture.employee+'/handover',{sourceUserId:fixture.identities['alpha-one-employee'].id,targetUserId:fixture.identities['alpha-one-head'].id,reason:'交接审核虚线'},handoverRaw.rowVersion);await ev('Pandora.reload()');await view('day','horizontal','2031-01-02');
  check('handover review is dashed without applying owners',await ev(`!!document.querySelector('.p-horizontal-bar.is-pending-review[data-task="${fixture.employee}"]')`)&&(await raw(fixture.employee)).assigneeIds.includes(fixture.identities['alpha-one-employee'].id));
  await decide('withdraw');
  await propose('change',{allDay:false,startAt:'2031-01-03T02:20:00Z',dueAt:'2031-01-03T09:20:00Z'});
  for(let i=0;i<4;i++)await as('admin','POST','/admin/clock/advance',{seconds:86400*400});
  await as('admin','POST','/admin/worker/run-once',{});await ev('Pandora.reload()');await view('day','horizontal','2031-01-02');
  const expired=await raw(fixture.employee);
  check('expired review removes proposal and restores effective placement',!expired.frozen&&!expired.pendingSchedule&&expired.startAt===janStart&&await ev(`!!document.querySelector('.p-horizontal-bar:not(.is-pending-review)[data-task="${fixture.employee}"]')`));
  check('no browser exceptions',b.errors.length===0,b.errors);
 }finally{fs.writeFileSync(path.join(out,'browser-report.json'),JSON.stringify(report,null,2));await b.kill();}
}
main().catch(e=>{console.error(e);process.exitCode=1});
