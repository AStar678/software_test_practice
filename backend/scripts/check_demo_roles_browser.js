'use strict';
const fs=require('fs'),path=require('path');
const {openBrowser,waitFor,sleep}=require('./browser_fixture');
const f=JSON.parse(process.env.PANDORA_DEMO_FIXTURE),js=JSON.stringify;
const out=path.resolve(__dirname,'../../output/task-creation-refinement');
fs.mkdirSync(out,{recursive:true});
const report={checks:[]};
function check(name,pass,evidence){report.checks.push({name,pass:!!pass,evidence});console.log((pass?'PASS ':'FAIL ')+name+(pass?'':' '+JSON.stringify(evidence)));if(!pass)throw Error(name+' '+JSON.stringify(evidence));}
async function main(){
 const b=await openBrowser(f.base+'/',{width:390,height:844,mobile:true}),ev=b.evaluate;
 async function idle(){return waitFor(b,'Pandora.ready&&Pandora.idle()',25000);}
 async function login(who){
  await waitFor(b,"!!document.getElementById('backend-login')",25000);
  await ev(`document.getElementById('login-user').value=${js(f.identities[who].identifier)};document.getElementById('login-password').value='111';document.getElementById('backend-login').requestSubmit()`);
  check('real demo login '+who,await idle());
 }
 async function logout(){await ev('Pandora.logout()');await waitFor(b,"!!document.getElementById('backend-login')&&Pandora.idle()",25000);}
 async function home(who){
  await ev("setPage('map')");await sleep(300);
  const state=await ev("({quads:document.querySelectorAll('#page-map .quad').length,company:!!document.querySelector('.company-quad'),tasks:!!document.querySelector('.tasks-quad'),daily:!!document.getElementById('dailyItemsSection'),dailyCells:document.querySelectorAll('[data-daily-date]').length})");
  check(who+' home shows the three modules with a real daily calendar',state.quads===3&&state.company&&state.tasks&&state.daily&&state.dailyCells>=20,state);
  const cards=await ev(`(()=>{const board=document.querySelector('.tasks-quad'),company=document.querySelector('.company-quad');
    const first=company.querySelector('.q-body .home-copy');
    return {companyRows:company.querySelectorAll('.q-body .item-line').length,
      boardRows:board.querySelectorAll('.q-body .home-task').length,
      previewOverdue:board.querySelectorAll('.q-body .home-task.is-overdue').length,
      clamped:!!first&&first.scrollHeight>first.clientHeight+1,
      hint:(company.querySelector('.card-head')?.textContent||'')+(board.querySelector('.card-head')?.textContent||''),
      companyCount:(Pandora.data.home.companyItems||[]).length,
      noTitle:(Pandora.data.home.companyItems||[]).every(i=>!('title' in i)),
      overdue:(Pandora.data.home.assignedTasks||[]).filter(r=>r.dueAt&&new Date(r.dueAt)<Date.now()&&r.executionState!=='done').length,
      daily:(()=>{const records=[...PandoraDaily.state.records.values()].flatMap(r=>[...((r&&r.items)||new Map()).values()]);
        const ranged=records.find(i=>i.body==='跟完《星尘》第一幕的分镜与合成交接。');
        return ranged?{ranged:true,days:(Date.parse(ranged.endDate)-Date.parse(ranged.startDate))/86400000+1}:{ranged:false,days:0}})()}})()`);
  check(who+' uses body-only company items, three preview rows and no retired badges',
    cards.companyCount===10&&cards.noTitle&&cards.companyRows===3&&cards.boardRows===3&&
    cards.clamped&&!/统一发布|\/10/.test(cards.hint),cards);
  check(who+' has 1–2 real overdue board tasks and the preview never tints them',
    cards.overdue>=1&&cards.overdue<=2&&cards.previewOverdue===0,cards);
  check(who+' has a real three-day daily item available for the drag demo',cards.daily.ranged&&cards.daily.days===3,cards.daily);
  await ev("document.querySelector('[data-home-list=tasks]').click()");
  await waitFor(b,"Pandora.idle()&&!!document.querySelector('.sheet-body .home-list .home-task')",15000);
  const boardList=await ev(`(()=>{const rows=[...document.querySelectorAll('.sheet-body .home-list .home-task')];return {count:rows.length,tinted:rows.filter(r=>r.classList.contains('is-overdue')).length,server:(Pandora.data.home.assignedTasks||[]).map(r=>r.taskId)}})()`);
  check(who+' board list keeps the server order and tints only the real overdue rows',
    boardList.count===boardList.server.length&&boardList.tinted===cards.overdue,boardList);
  await ev("document.getElementById('sheetClose').click()");
  await waitFor(b,"document.getElementById('overlay').hidden");
  await ev("document.querySelector('[data-home-list=company]').click()");
  await waitFor(b,"Pandora.idle()&&!!document.querySelector('.sheet-body .home-list .home-chronicle')",15000);
  const chronicle=await ev(`(()=>{const rows=[...document.querySelectorAll('.sheet-body .home-list .home-chronicle')];
    const long=rows.filter(r=>{const c=r.querySelector('.home-copy');return c&&c.scrollHeight>c.clientHeight+1}).length;
    rows[0].click();
    return {count:rows.length,long,expanded:rows[0].getAttribute('aria-expanded')==='true'&&getComputedStyle(rows[0].querySelector('.home-copy')).webkitLineClamp==='none'}})()`);
  check(who+' company chronicles clamp, expand independently and stay body-only',
    chronicle.count===10&&chronicle.long>=1&&chronicle.expanded,chronicle);
  await ev("document.getElementById('sheetClose').click()");
  await waitFor(b,"document.getElementById('overlay').hidden");
 }
 async function company(who){
  await ev("state.viewPage='calendar';setPage('view');renderAll()");
  check(who+' company page renders the real month calendar',await waitFor(b,"!!document.querySelector('.p-schedule-card')&&document.querySelectorAll('.p-month-event').length>=0",20000));
  const shortId=f.objects['task-'+who+'-1'].id,overdueId=f.objects['task-'+who+'-2'].id;
  await ev("state.viewMode='day';state.viewAnchor=parseDateInput(Pandora.data.home.businessDate);renderAll()");
  check(who+' own day axis has a usable short-task drag target',await waitFor(b,`!!document.querySelector('.p-day-layout [data-schedule-move="${shortId}"]')&&Pandora.idle()`,15000));
  await ev(`Pandora.openTask(${js(overdueId)})`);
  check(who+' can open normal overdue work in its real detail',await waitFor(b,`sheetStack[sheetStack.length-1]?.taskId===${js(overdueId)}&&Pandora.idle()`,15000)
        &&await ev(`Pandora.request('/tasks/'+${js(overdueId)}).then(t=>t.executionState!=='done'&&new Date(t.dueAt)<Pandora.companyDayStart(Pandora.data.home.businessDate))`));
  await ev('closeSheet()');
  await ev("document.querySelector('[data-action=task-table-open]').click()");
  check(who+' task form opens its server-paged table',await waitFor(b,"state.viewPage==='table'&&!!document.querySelector('[data-task-row]')&&Pandora.idle()",25000));
  const rows=await ev("document.querySelectorAll('[data-task-row]').length");
  const total=await ev("Pandora.taskForm.state.server&&Pandora.taskForm.state.server.total");
  check(who+' form table has real rows and a total',rows>0&&typeof total==='number'&&total>0,{rows,total});
  const pinned=await ev(`(()=>{const rows=[...document.querySelectorAll('[data-task-row]')];const row=rows.find(r=>r.classList.contains('is-table-pinned'));
    return {pinned:!!row,first:!!rows[0]&&rows[0].classList.contains('is-table-pinned'),
      cells:row?new Set([...row.children].map(c=>getComputedStyle(c).backgroundImage+'|'+getComputedStyle(c).backgroundColor)).size:0,
      label:document.getElementById('p-table-body').textContent.includes('表单置顶')}})()`);
  check(who+' table form pins the second real task as one tinted band without a label',
    pinned.pinned&&pinned.first&&pinned.cells===1&&!pinned.label,pinned);
  await ev("document.querySelector('[data-action=task-table-close]').click()");
  await waitFor(b,"state.viewPage==='calendar'");
 }
 async function logs(who){
  await ev("setPage('log')");
  check(who+' log page renders real authorized logs',await waitFor(b,"document.getElementById('page-log').textContent.length>20&&Pandora.idle()",25000));
 }
 async function notices(who){
  await ev('openNotifications()');
  const ready=await waitFor(b,"document.getElementById('sheetTitle').textContent==='通知'&&!!document.getElementById('p-notice-content')&&document.querySelectorAll('.p-notice-row').length>0",25000);
  const rows=await ev("document.querySelectorAll('.p-notice-row').length");
  check(who+' notification center opens with six types and real rows',ready&&rows>0&&await ev("document.querySelectorAll('.p-notice-tab').length===6"),{ready,rows});
  await ev('closeSheet()');
  await waitFor(b,"document.getElementById('overlay').hidden");
 }
 async function reports(who,target){
  await ev("setPage('me')");
  await ev("(()=>{const fold=document.querySelector('[data-profile-fold=reports]');if(fold)fold.open=true})()");
  await sleep(250);
  if(!target){
   check(who+' has the expected empty subordinate tree',await ev("document.querySelector('[data-profile-fold=reports]').textContent.includes('暂无下属')&&!document.querySelector('.staff-tree-person')"));
   return;
  }
  let visible=false;
  for(let depth=0;depth<5&&!visible;depth++){
   await ev("[...document.querySelectorAll('[data-action=p-report-toggle]')].forEach(b=>{if(b.getAttribute('aria-expanded')!=='true')b.click()})");
   await sleep(250);
   visible=await ev(`!!document.querySelector('[data-action=p-open-person][data-id=${js(f.identities[target].id)}]')`);
  }
  check(who+' subordinate tree exposes the actual management chain',visible);
  if(!visible)return;
  await ev(`document.querySelector('[data-action=p-open-person][data-id=${js(f.identities[target].id)}]').click()`);
  check(who+' opens the subordinate card',await waitFor(b,"Pandora.idle()&&!!document.querySelector('[data-action=p-staff-enter][data-tab=schedule]')",25000));
  await ev("document.querySelector('[data-action=p-staff-enter][data-tab=schedule]').click()");
  check(who+' opens the subordinate continuous schedule',await waitFor(b,"Pandora.idle()&&!!document.querySelector('.staff-person')&&!!document.querySelector('.staff-month-view')",25000));
  await ev("document.querySelector('[data-action=p-staff-tab][data-tab=logs]').click()");
  check(who+' can switch the subordinate work page to logs',await waitFor(b,"Pandora.idle()&&!!document.querySelector('.staff-log-card')",25000));
  await ev("closeSheet();if(!document.getElementById('overlay').hidden)closeSheet();");
  await waitFor(b,"document.getElementById('overlay').hidden");
 }
 try{
  const roles=[['upper','product-head-1'],['middle','product-head-1'],['product-head-1','employee'],['employee',null]];
  for(const [who,target] of roles){
   await login(who);
   await home(who);
   await company(who);
   await logs(who);
   await notices(who);
   await reports(who,target);
   await logout();
  }
  check('the four demo roles exercise every declared page without browser exceptions',b.errors.length===0,b.errors);
  /* Real demo drag: move the seeded three-day item by one weekday, confirm, then refresh. */
  await login('employee');
  await ev("(()=>{if(document.getElementById('test-no-smooth'))return;const style=document.createElement('style');style.id='test-no-smooth';style.textContent='*{scroll-behavior:auto!important}';document.head.appendChild(style)})()");
  await ev("setPage('map')");await sleep(300);
  await ev("PandoraDaily.goToDate(Pandora.data.home.businessDate)");
  await waitFor(b,"Pandora.ready&&Pandora.idle()",25000);
  const rangedItem=await ev(`(()=>{const key=Pandora.data.home.businessDate.slice(0,7);const rec=PandoraDaily.state.records.get(key);const items=rec&&rec.items?[...rec.items.values()]:[];const item=items.find(i=>i.body==='跟完《星尘》第一幕的分镜与合成交接。');return item?{id:item.id,startDate:item.startDate,endDate:item.endDate,completed:item.completed}:null})()`);
  check('the demo drag item is loaded from the real seed',!!rangedItem,rangedItem);
  const barSelector=`[data-daily-bar][data-id="${rangedItem.id}"]:not([hidden])`;
  await ev(`document.querySelector(${js(barSelector)}).scrollIntoView({block:'center',behavior:'instant'})`);
  let lastBarRect=null;
  for(let attempt=0;attempt<25;attempt++){
    const rect=await ev(`(()=>{const bar=document.querySelector(${js(barSelector)});if(!bar)return null;const r=bar.getBoundingClientRect();return {x:r.x,y:r.y}})()`);
    if(rect&&lastBarRect&&Math.abs(rect.x-lastBarRect.x)<0.5&&Math.abs(rect.y-lastBarRect.y)<0.5)break;
    lastBarRect=rect;await sleep(80);
  }
  const pressPoint=await ev(`(()=>{const bar=document.querySelector(${js(barSelector)});if(!bar)return null;const r=bar.getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2}})()`);
  check('the demo cross-day bar exposes a settable grab point',!!pressPoint,pressPoint);
  const at=(type,x,y)=>b.send('Input.dispatchMouseEvent',{type,x,y,...(type==='mousePressed'||type==='mouseReleased'?{button:'left',clickCount:1}:{})});
  await at('mouseMoved',pressPoint.x,pressPoint.y);
  await at('mousePressed',pressPoint.x,pressPoint.y);
  await sleep(700);
  check('the demo drag shows the whole-bar preview before saving',await ev("Pandora.dailyGesture().dragging===true&&!!document.querySelector('.p-daily-drag-ghost')"));
  /* Measure the target only after activation: the layout cannot have drifted under the pointer. */
  const targetPoint=await ev(`(()=>{const bar=document.querySelector(${js(barSelector)});if(!bar)return null;
    const week=bar.closest('.daily-week'),days=week.querySelector('.daily-days').getBoundingClientRect(),r=bar.getBoundingClientRect();
    const col=Math.floor((r.x+r.width/2-days.left)/(days.width/7));
    const start=Number(bar.dataset.startCol),end=Number(bar.dataset.endCol),grab=Math.max(start,Math.min(end-1,col));
    const targetCol=grab>=3?grab-1:grab+1;
    const target=toDateInput(addDays(parseDateInput(week.dataset.weekStart),targetCol));
    const cell=document.querySelector('[data-daily-date="'+target+'"]');if(!cell)return null;const cr=cell.getBoundingClientRect();
    return {x:cr.x+cr.width/2,y:cr.y+cr.height/2,target,delta:targetCol-grab}})()`);
  check('the demo drag has a real target date after activation',!!targetPoint,targetPoint);
  await at('mouseMoved',targetPoint.x,targetPoint.y);
  await sleep(250);
  await at('mouseReleased',targetPoint.x,targetPoint.y);
  await sleep(400);
  const moveDraft=await ev("Pandora.dailyGesture().move");
  check('releasing the demo drag asks for confirmation with both ranges',
    await waitFor(b,"!document.getElementById('overlay').hidden&&!!Pandora.dailyGesture().move&&document.getElementById('sheetBody').textContent.includes('调整后')",15000),moveDraft);
  await ev("document.querySelector('[data-action=daily-move-confirm]').click()");
  check('the demo drag saves and closes the confirmation',await waitFor(b,"Pandora.idle()&&document.getElementById('overlay').hidden",25000));
  const movedItem=await ev(`Pandora.request('/daily-items/'+${js(rangedItem.id)})`);
  const shiftKey=key=>new Date(Date.parse(key+'T00:00:00Z')+targetPoint.delta*86400000).toISOString().slice(0,10);
  check('the demo drag moved the complete range by the real day difference and kept its content',
    movedItem.startDate===shiftKey(rangedItem.startDate)&&movedItem.endDate===shiftKey(rangedItem.endDate)&&
    movedItem.completed===rangedItem.completed,{rangedItem,movedItem,targetPoint});
  await b.send('Page.reload',{ignoreCache:true});
  const persisted=await waitFor(b,"Pandora.ready&&Pandora.idle()",30000)&&
    await ev(`Pandora.request('/daily-items/'+${js(rangedItem.id)}).then(i=>i.startDate)`);
  check('the reloaded demo page keeps the moved dates',persisted===movedItem.startDate,{before:movedItem.startDate,after:persisted});
  await b.screenshot(path.join(out,'demo-drag-employee.png'));
  report.result='PASS';
 }catch(error){report.result='FAIL';report.error=error.message;throw error;}
 finally{fs.writeFileSync(path.join(out,'demo-roles-browser.json'),JSON.stringify(report,null,2));await b.kill();}
}
main().catch(error=>{console.error(error);process.exitCode=1});
