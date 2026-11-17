'use strict';
const fs=require('fs'),path=require('path');
const {openBrowser,waitFor,sleep}=require('./browser_fixture');
const f=JSON.parse(process.env.PANDORA_DRAG_FIXTURE),q=JSON.stringify;
const out=path.resolve(__dirname,'../../output/web-alignment-drag');
fs.mkdirSync(out,{recursive:true});
const report={checks:[]};
function check(name,pass,evidence){report.checks.push({name,pass:!!pass,evidence});console.log((pass?'PASS ':'FAIL ')+name+(pass?'':' '+JSON.stringify(evidence)));if(!pass)throw Error(name+' '+JSON.stringify(evidence));}
async function main(){
 const b=await openBrowser(f.base+'/'+encodeURIComponent('潘多拉-交互原型.html'),{width:390,height:844,mobile:true}),ev=b.evaluate;
 await b.send('Emulation.setTouchEmulationEnabled',{enabled:true,maxTouchPoints:5});
 async function raw(id){return ev(`Pandora.request('/tasks/'+${q(id)})`);}
 async function view(mode='month',day=f.monthDay){
  await ev(`closeSheet();Pandora.calendar.closeDaySheet();state.viewAnchor=parseDateInput(${q(day)});state.viewMode=${q(mode)};state.viewPage='calendar';Pandora.calendar.resetStream(state.viewAnchor);setPage('view');renderAll()`);
  if(mode==='day'){
   await ev("document.querySelector('[data-action=schedule-day-mode][data-day-mode=timeline]').click()");
  }
  await sleep(250);
 }
 async function point(selector){
  return ev(`(()=>{const h=document.querySelector(${q(selector)});if(!h)return null;h.scrollIntoView({block:'center',inline:'center'});const r=h.getBoundingClientRect();if(!r.width||!r.height)return null;const mode=h.dataset.resizeMode;const bar=h.closest('.p-month-event,.p-horizontal-bar,.p-axis-event');return {x:r.x+r.width/2,y:r.y+r.height/2,mode,unit:mode==='month'?bar.closest('.p-month-week').getBoundingClientRect().width/7:mode==='vertical'?bar.closest('.p-axis-events').getBoundingClientRect().height/24:bar.closest('.p-horizontal-axis').getBoundingClientRect().width/24,vertical:mode==='vertical'}})()`);
 }
 async function datePoint(day,scroll=true){
  return ev(`(()=>{const cell=document.querySelector('.p-month-date[data-date=${q(day)}]');if(!cell)return null;${scroll?"cell.scrollIntoView({block:'center'});":""}const r=cell.getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2}})()`);
 }
 async function mouseDown(p){
  await b.send('Input.dispatchMouseEvent',{type:'mouseMoved',x:p.x,y:p.y});
  await b.send('Input.dispatchMouseEvent',{type:'mousePressed',x:p.x,y:p.y,button:'left',clickCount:1});
  if(p.mode==='month'){
   await sleep(320);
   const pending=await ev("({gesture:Pandora.scheduleGesture(),preview:!!document.querySelector('.p-drag-preview'),ghost:!!document.querySelector('.p-drag-ghost')})");
   check('month mouse press waits without a drag preview before the threshold',pending.gesture.pressing&&!pending.gesture.dragging&&!pending.preview&&!pending.ghost,pending);
   await sleep(420);
   const active=await ev("({gesture:Pandora.scheduleGesture(),preview:!!document.querySelector('.p-drag-preview'),ghost:!!document.querySelector('.p-drag-ghost')})");
   check('month mouse long press activates before movement',!active.gesture.pressing&&active.gesture.dragging&&active.preview&&active.ghost,active);
  }else{
   check('day-axis mouse drag activates immediately',await ev("Pandora.scheduleGesture().dragging&&!!document.querySelector('.p-drag-preview')"));
  }
 }
 async function mouseDragToDate(selector,day,cancel){
  const p=await point(selector);check('drag source exists '+selector,!!p,p);
  await sleep(150);
  const target=await datePoint(day,false);check('target date cell is visible for the mouse drop',!!target,target);
  await mouseDown(p);
  await b.send('Input.dispatchMouseEvent',{type:'mouseMoved',x:target.x,y:target.y,button:'left',buttons:1});
  check('drag preview follows the pointer',await ev("!!document.querySelector('.p-drag-preview')"));
  if(cancel==='escape')await b.send('Input.dispatchKeyEvent',{type:'keyDown',key:'Escape',code:'Escape',windowsVirtualKeyCode:27});
  await b.send('Input.dispatchMouseEvent',{type:'mouseReleased',x:target.x,y:target.y,button:'left',clickCount:1});
  await sleep(220);
 }
 async function mouseDrag(selector,target,cancel){
  const p=await point(selector);check('drag source exists '+selector,!!p,p);
  await mouseDown(p);
  await b.send('Input.dispatchMouseEvent',{type:'mouseMoved',x:target.x,y:target.y,button:'left',buttons:1});
  check('drag preview follows the pointer',await ev("!!document.querySelector('.p-drag-preview')"));
  if(cancel==='escape')await b.send('Input.dispatchKeyEvent',{type:'keyDown',key:'Escape',code:'Escape',windowsVirtualKeyCode:27});
  await b.send('Input.dispatchMouseEvent',{type:'mouseReleased',x:target.x,y:target.y,button:'left',clickCount:1});
  await sleep(220);
 }
 async function touchDown(selector){
  const p=await point(selector);check('touch source exists '+selector,!!p,p);
  await sleep(200);
  await b.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:p.x,y:p.y,id:1,radiusX:2,radiusY:2,force:1}]});
  return p;
 }
 async function touchMove(x,y){await b.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x,y,id:1,radiusX:2,radiusY:2,force:1}]});}
 async function touchUp(){await b.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});}
 async function noConfirmation(){return ev("document.getElementById('overlay').hidden")}
 async function noticeText(){return ev("document.getElementById('appNotice').textContent||''");}
 try{
  check('login form',await waitFor(b,"!!document.getElementById('backend-login')",20000));
  await ev(`document.getElementById('login-user').value=${q(f.identities.founder.identifier)};document.getElementById('login-password').value='Fixture@123456';document.getElementById('backend-login').requestSubmit()`);
  check('founder authenticated',await waitFor(b,'Pandora.ready&&Pandora.idle()',20000));
  await view('month');
  check('long-press capability is reported',await ev("!!Pandora.dragSupport&&Pandora.dragSupport.longPressMs===500"),await ev('Pandora.dragSupport'));

  /* 8.1 激活前移动超过容差：撤销候选，不激活、不写入、不误开。 */
  const beforeMonth=await raw(f.month);
  const press=await touchDown(`[data-schedule-move="${f.month}"][data-resize-mode=month]`);
  await touchMove(press.x+30,press.y+12);
  check('movement beyond tolerance cancels the press candidate',await ev("!document.querySelector('.p-drag-preview')"));
  await touchUp();
  await sleep(150);
  check('cancelled candidate writes nothing and opens nothing',await noConfirmation()&&(await raw(f.month)).rowVersion===beforeMonth.rowVersion&&!await ev("!!Pandora.calendar.currentDaySheet()"));
  /* 8.1 滚动取消候选。 */
  await touchDown(`[data-schedule-move="${f.month}"][data-resize-mode=month]`);
  await ev("window.dispatchEvent(new Event('scroll'))");
  await sleep(650);
  check('a scroll before activation keeps ordinary scrolling',await ev("!document.querySelector('.p-drag-preview')"));
  await touchUp();
  await ev("closeSheet();Pandora.calendar.closeDaySheet()");
  await sleep(150);

  /* 8.1/8.2 长按约半秒激活：浮起、目标反馈、一次短震动。 */
  const hold=await touchDown(`[data-schedule-move="${f.month}"][data-resize-mode=month]`);
  const hitDebug=await ev(`(()=>{const h=document.querySelector('[data-schedule-move="${f.month}"][data-resize-mode=month]');const r=h.getBoundingClientRect();const el=document.elementFromPoint(${hold.x},${hold.y});return {inside:!!el&&!!el.closest('[data-schedule-move="${f.month}"]'),tag:el?el.tagName+'.'+el.className:null,rect:{x:r.x,y:r.y,w:r.width,h:r.height},touchAction:getComputedStyle(h).touchAction,gesture:Pandora.scheduleGesture()}})()`);
  console.log('hit debug',JSON.stringify(hitDebug));
  const pressing=await ev("({gesture:Pandora.scheduleGesture(),idle:Pandora.idle(),pressing:!!document.querySelector('.p-month-event')})");
  await sleep(700);
  const activated=await ev("({gesture:Pandora.scheduleGesture(),idle:Pandora.idle(),preview:!!document.querySelector('.p-drag-preview'),ghost:!!document.querySelector('.p-drag-ghost'),dragging:document.body.classList.contains('is-schedule-dragging'),source:!!document.querySelector('.p-month-event.is-dragging'),haptic:Pandora.dragSupport.haptic})");
  console.log('press state',JSON.stringify(pressing),'activated',JSON.stringify(activated));
  check('a long press activates the floating drag state',activated.preview&&activated.ghost&&activated.dragging&&activated.source,activated);
  check('haptic support result is recorded honestly',['called','unavailable','rejected'].includes(activated.haptic),activated.haptic);
  await touchUp();
  await sleep(200);
  check('long press without movement writes nothing and opens nothing',await noConfirmation()&&(await raw(f.month)).rowVersion===beforeMonth.rowVersion);

  /* 8.2/8.3 长按后移动到另一周的日期格：按抓取日差量移动完整任务。 */
  const hold2=await touchDown(`[data-schedule-move="${f.month}"][data-resize-mode=month]`);
  await sleep(650);
  const target=await datePoint(f.targetDay,false);
  check('target date cell exists in view for the touch drop',!!target,target);
  await touchMove(target.x,target.y);
  await sleep(200);
  const moveDebug=await ev(`({gesture:Pandora.scheduleGesture(),tip:document.querySelector('.p-drag-preview')?.textContent||'',target:${JSON.stringify(target)}})`);
  console.log('after move',JSON.stringify(moveDebug));
  const tip=await ev("document.querySelector('.p-drag-preview')?.textContent||''");
  check('the floating preview names the actual target date and kept times',tip.includes(f.targetDay)&&tip.includes('09:00')&&tip.includes('11:00'),tip);
  await touchUp();
  check('long-press drop opens the lightweight confirmation',await waitFor(b,"!!document.getElementById('sc-reason')&&!document.getElementById('overlay').hidden&&Pandora.idle()",20000));
  check('confirmation shows the 2D target date and original duration',await ev(`(()=>{const t=document.getElementById('sheetBody').textContent;return t.includes(${q(f.targetDay)})&&t.includes('09:00')&&t.includes('11:00')&&t.includes('原排期')&&t.includes('新排期')})()`));
  await ev('closeSheet()');

  /* 8.3 桌面鼠标同样按二维日期命中，不依赖横向距离。 */
  await mouseDragToDate(`[data-schedule-move="${f.month}"][data-resize-mode=month]`,f.targetDay);
  check('mouse 2D drop opens confirmation at the target date',await waitFor(b,"!!document.getElementById('sc-reason')&&Pandora.idle()",20000));
  check('mouse confirmation keeps the cross-week target',await ev(`document.getElementById('sheetBody').textContent.includes(${q(f.targetDay)})`));
  await ev('closeSheet()');

  /* 8.3 续接段整体平移：抓取日差量移动完整任务，续接段不冒充真实端点。 */
  await view('month',f.monthDay);
  const continuation=await ev(`(()=>{const bars=[...document.querySelectorAll('.p-month-event[data-task="${f.span}"]')];
    const bar=bars.find(node=>node.classList.contains('continues-before')&&node.classList.contains('continues-after'))||bars[0];
    if(!bar)return null;const week=bar.closest('.p-month-week'),next=week.nextElementSibling;
    const h=bar.querySelector('[data-schedule-move]'),r=bar.getBoundingClientRect(),nr=next?next.querySelector('.p-month-days').getBoundingClientRect():null;
    return {x:r.x+r.width/2,y:r.y+r.height/2,tx:nr?nr.x+nr.width/2:r.x+40,ty:nr?nr.y+nr.height/3:r.y+40,
      handles:bar.querySelectorAll('[data-resize-task]').length,text:bar.textContent,classes:bar.className}})()`);
  check('a continued month segment exposes whole-task movement but no fake endpoint',!!continuation&&continuation.handles===0&&continuation.classes.includes('continues-before')&&continuation.classes.includes('continues-after'),continuation);
  if(continuation){
    await mouseDown({...continuation,mode:'month'});
    await b.send('Input.dispatchMouseEvent',{type:'mouseMoved',x:continuation.tx,y:continuation.ty,button:'left',buttons:1});
    await b.send('Input.dispatchMouseEvent',{type:'mouseReleased',x:continuation.tx,y:continuation.ty,button:'left',clickCount:1});
    check('dragging a continued segment opens the lightweight confirmation',await waitFor(b,"!!document.getElementById('sc-reason')&&Pandora.idle()",20000));
    check('the continued segment moves the full task by the grabbed-day delta with times kept',await ev("(()=>{const t=document.getElementById('sheetBody').textContent;return t.includes('04-12')&&t.includes('05-03')&&t.includes('09:00')&&t.includes('11:00')})()"));
    await ev('closeSheet()');
  }

  /* 8.4 上下边缘自动滚动并补载月份；来源捕获不丢任务，取消不提交。 */
  await view('month',f.monthDay);
  const edgeBefore=await ev("({top:document.querySelector('.p-month-scroll').scrollTop,months:Pandora.calendar.currentStream().length})");
  const scrollRect=await ev("(()=>{const r=document.querySelector('.p-month-scroll').getBoundingClientRect();return {bottom:r.bottom,left:r.left,width:r.width}})()");
  const edgePoint=await point(`[data-schedule-move="${f.edge}"][data-resize-mode=month]`);
  await mouseDown(edgePoint);
  await b.send('Input.dispatchMouseEvent',{type:'mouseMoved',x:scrollRect.left+scrollRect.width/2,y:scrollRect.bottom-6,button:'left',buttons:1});
  await sleep(1200);
  const edgeAfter=await ev("({top:document.querySelector('.p-month-scroll').scrollTop,months:Pandora.calendar.currentStream().length,preview:!!document.querySelector('.p-drag-preview')})");
  check('holding the bottom edge auto-scrolls and can append a month',edgeAfter.top>edgeBefore.top||edgeAfter.months>edgeBefore.months,{edgeBefore,edgeAfter});
  await b.send('Input.dispatchKeyEvent',{type:'keyDown',key:'Escape',code:'Escape',windowsVirtualKeyCode:27});
  const afterEscape=await ev("({gesture:Pandora.scheduleGesture(),overlay:document.getElementById('overlay').hidden,sc:!!document.querySelector('#sc-reason'),preview:!!document.querySelector('.p-drag-preview')})");
  await b.send('Input.dispatchMouseEvent',{type:'mouseReleased',x:scrollRect.left+scrollRect.width/2,y:scrollRect.bottom-6,button:'left',clickCount:1});
  await sleep(250);
  const edgeCancel=await ev("({gesture:Pandora.scheduleGesture(),overlay:document.getElementById('overlay').hidden,sc:!!document.querySelector('#sc-reason'),preview:!!document.querySelector('.p-drag-preview'),notice:document.getElementById('appNotice').textContent})");
  check('cancelling an edge drag keeps the task and opens no confirmation',afterEscape.gesture.dragging===false&&edgeCancel.overlay&&!edgeCancel.preview,{afterEscape,edgeCancel});

  /* 8.5 日轴来源业务日边界：22:30–23:30 移动一小时被拒，24:00 截止可用。 */
  await view('day',f.lateDay);
  const lateBefore=await raw(f.late);
  const latePoint=await point(`[data-resize-task="${f.late}"][data-resize=end][data-resize-mode=vertical]`);
  check('late task exposes its end handle',!!latePoint,latePoint);
  await mouseDrag(`[data-resize-task="${f.late}"][data-resize=end][data-resize-mode=vertical]`,{x:latePoint.x,y:latePoint.y+latePoint.unit});
  check('a day-axis move past midnight opens no confirmation',await noConfirmation());
  check('the rejected move keeps the saved schedule',(await raw(f.late)).rowVersion===lateBefore.rowVersion);
  check('the rejection explains the day boundary',(await noticeText()).includes('00:00–24:00'),await noticeText());
  await ev(`document.querySelector('[data-resize-task="${f.late}"][data-resize=end][data-resize-mode=vertical]').focus()`);
  await b.send('Input.dispatchKeyEvent',{type:'keyDown',key:'ArrowRight',code:'ArrowRight',windowsVirtualKeyCode:39});
  await sleep(250);
  check('the day-axis keyboard also rejects the boundary',await noConfirmation()&&(await raw(f.late)).rowVersion===lateBefore.rowVersion);
  const pointMove=await point(`[data-schedule-move="${f.late}"][data-resize-mode=vertical]`);
  await mouseDrag(`[data-schedule-move="${f.late}"][data-resize-mode=vertical]`,{x:pointMove.x,y:pointMove.y+pointMove.unit});
  check('moving the whole task into the next day is rejected',await noConfirmation()&&(await raw(f.late)).rowVersion===lateBefore.rowVersion);

  await view('day',f.lateDay);
  await ev("document.querySelector('[data-action=schedule-day-mode][data-day-mode=horizontal]').click()");
  await sleep(200);
  const midnightPoint=await point(`[data-schedule-move="${f.midnight}"][data-resize-mode=day]`);
  check('midnight-due task exposes a whole-task handle',!!midnightPoint,midnightPoint);
  await mouseDrag(`[data-schedule-move="${f.midnight}"][data-resize-mode=day]`,{x:midnightPoint.x-midnightPoint.unit,y:midnightPoint.y});
  check('a legal earlier move with a 24:00 deadline still opens confirmation',await waitFor(b,"!!document.getElementById('sc-reason')&&Pandora.idle()",20000));
  check('the legal move keeps duration and the 24:00 deadline mapping',await ev(`(()=>{const t=document.getElementById('sheetBody').textContent;return t.includes('21:00')&&t.includes('23:00')})()`));
  await ev('closeSheet()');

  check('no browser exceptions',b.errors.length===0,b.errors);
  report.result='PASS';
 }catch(error){report.result='FAIL';report.error=error.message;throw error;}
 finally{fs.writeFileSync(path.join(out,'browser-report.json'),JSON.stringify(report,null,2));await b.kill();}
}
main().catch(error=>{console.error(error);process.exitCode=1});
