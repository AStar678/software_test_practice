#!/usr/bin/env node
'use strict';
const fs=require('fs'),path=require('path'),{execFileSync}=require('child_process');
const {openBrowser,waitFor,sleep}=require('./browser_fixture');
const fixture=JSON.parse(process.env.PANDORA_BROWSER_FIXTURE),ids=fixture.identities;
const output=path.resolve(__dirname,'../../audit/refactor-pandora-organization-and-workflows/employee-browser.json');
const mysqlOptions=path.resolve(__dirname,'../.runtime/mysql-admin.cnf');
const report={updated:new Date().toISOString(),checks:[]};
function check(name,pass,evidence){report.checks.push({check:name,pass:!!pass,evidence});console.log((pass?'PASS ':'FAIL ')+name);if(!pass)throw new Error(name+' '+JSON.stringify(evidence));}
function sqlQuote(value){return "'"+String(value).replace(/\\/g,'\\\\').replace(/'/g,"''")+"'";}
function sql(statement){
 const args=['--defaults-file='+mysqlOptions,'--batch','--raw','--skip-column-names','-h','127.0.0.1','-P','13306','--database='+fixture.database,'-e',statement];
 return execFileSync('mysql',args,{encoding:'utf8'}).trim();
}
function shiftDate(key,delta){const date=new Date(key+'T00:00:00Z');date.setUTCDate(date.getUTCDate()+delta);return date.toISOString().slice(0,10);}
const js=value=>JSON.stringify(value);
async function main(){
 const b=await openBrowser(fixture.base+'/');const ev=b.evaluate;
 async function login(key){
  const ready=await waitFor(b,"!!document.getElementById('backend-login')&&Pandora.idle()");
  check('login form ready '+key,ready);
  await ev(`document.getElementById('login-user').value=${js(ids[key].identifier)};document.getElementById('login-password').value='Fixture@123456';document.getElementById('backend-login').requestSubmit()`);
  const loaded=await waitFor(b,`Pandora.ready&&Pandora.idle()&&Pandora.data.me.id===${js(ids[key].id)}`,20000);
  check('phone login '+key,loaded,loaded?undefined:{errors:b.errors,page:await ev("({text:document.querySelector('#page-map').textContent.slice(-1200),busy:!Pandora.idle(),hasSession:!!Pandora.token})")});
 }
 async function logout(){await ev('Pandora.logout()');await waitFor(b,"!!document.getElementById('backend-login')&&Pandora.idle()");}
 async function api(method,requestPath,body,headers){return ev(`Pandora.request(${js(requestPath)},{method:${js(method)},body:${js(body===undefined?null:body)},headers:${js(headers||{})}})`);}
 async function apiError(method,requestPath,body,headers){return ev(`(async()=>{try{await Pandora.request(${js(requestPath)},{method:${js(method)},body:${js(body===undefined?null:body)},headers:${js(headers||{})}});return {ok:true}}catch(error){return {ok:false,status:error.status,code:error.code,message:error.message}}})()`);}
 async function setPage(page){await ev(`setPage(${js(page)})`);await waitFor(b,`state.page===${js(page)}&&Pandora.idle()`);}
 async function openLogDate(date){
  await setPage('log');
  await ev("document.querySelector('[data-action=new-log]').click()");
  await waitFor(b,"!document.getElementById('overlay').hidden&&!!document.getElementById('lf-content')&&document.getElementById('sheetTitle').textContent==='写日志'&&Pandora.idle()");
  if(date){
   await ev(`(()=>{const e=document.getElementById('lf-date');if(!Array.from(e.options).some(o=>o.value===${js(date)})){const o=document.createElement('option');o.value=${js(date)};o.textContent=${js(date)};e.appendChild(o)}e.value=${js(date)};e.dispatchEvent(new Event('change',{bubbles:true}))})()`);
   const ready=await waitFor(b,`!document.getElementById('overlay').hidden&&!!document.getElementById('lf-date')&&document.getElementById('lf-date').value===${js(date)}&&Pandora.idle()`);
   if(!ready)throw new Error('log date did not open: '+date);
  }
 }
 async function saveLogForm(content){
  await ev(`document.getElementById('lf-content').value=${js(content)};document.querySelector('#sheetFoot [data-action=save-log]').click()`);
  await sleep(120);
  await waitFor(b,"Pandora.idle()",20000);
 }
 async function selfLog(date){
  return ev(`Pandora.request('/work-logs?scope=self&from=${date}&to=${date}&limit=10').then(result=>result.items[0]||null)`);
 }
 async function openLogDetail(id){
  await ev(`document.querySelector('[data-action=p-open-log][data-id=${js(id)}]').click()`);
  return waitFor(b,`!document.getElementById('overlay').hidden&&document.getElementById('sheetTitle').textContent==='日志详情'&&Pandora.idle()`);
 }
 async function closeSheet(){await ev("document.getElementById('sheetClose').click()");await waitFor(b,"document.getElementById('overlay').hidden");}
 try{
  await login('alpha-one-employee');
  for(const width of [320,390,1440]){
   await b.viewport({width,height:width===320?740:width===390?844:900,mobile:width<1000});
   const geometry=await ev(`(()=>{setPage('map');document.querySelector('.tasks-quad .q-body').scrollTop=90;return {quadrants:document.querySelectorAll('#page-map .quad').length,scroll:Array.from(document.querySelectorAll('#page-map .q-body')).every(e=>getComputedStyle(e).overflowY==='auto'),priorities:Array.from(document.querySelectorAll('.home-task-priority')).map(e=>({width:e.getBoundingClientRect().width,visible:e.getBoundingClientRect().right<=e.closest('.q-body').getBoundingClientRect().right+1})),duplicate:!!document.querySelector('#page-map .workday button'),longTitle:!!Array.from(document.querySelectorAll('.home-task-title')).find(e=>e.textContent.length>50)}})()`);
   check('dashboard priority and independent quadrants at '+width,geometry.quadrants===4&&geometry.scroll&&geometry.priorities.length>0&&geometry.priorities.every(p=>p.width>10&&p.visible)&&!geometry.duplicate&&geometry.longTitle,geometry);
   await b.screenshot(output.replace('employee-browser.json','dashboard-'+width+'.png'));
  }
  await b.viewport({width:390,height:844,mobile:true});
  await b.send('Network.enable');
  await b.send('Network.emulateNetworkConditions',{offline:false,latency:700,downloadThroughput:-1,uploadThroughput:-1,connectionType:'cellular3g'});
  await ev("setPage('view');document.querySelector('.p-table-entry').click()");
  const loading=await ev("({loading:Pandora.taskForm.state.loading,loaded:Pandora.taskForm.state.loaded,error:Pandora.taskForm.state.error,text:document.getElementById('p-table-body').textContent,pager:document.getElementById('p-table-pager').textContent,rows:document.querySelectorAll('[data-task-row]').length})");
  check('task form opens with a real loading state instead of stale rows',loading.loading===true&&loading.loaded===false&&loading.error===null&&loading.text.includes('正在加载当前授权任务')&&loading.pager===''&&loading.rows===0,loading);
  await b.send('Network.emulateNetworkConditions',{offline:false,latency:0,downloadThroughput:-1,uploadThroughput:-1,connectionType:'wifi'});
  check('task form completes the full load with total/page controls',await waitFor(b,"Pandora.taskForm.state.loaded&&!Pandora.taskForm.state.loading&&!Pandora.taskForm.state.error&&document.querySelectorAll('[data-task-row]').length===50",20000));
  check('task form retains more than two pages and removes explanatory statistics',await ev("Pandora.taskForm.current().paged.pages>=3&&!document.querySelector('.p-table-source,.p-task-table caption,.p-table-counts')&&document.getElementById('p-table-pager').textContent.includes('共')"));
  await b.send('Network.emulateNetworkConditions',{offline:true,latency:0,downloadThroughput:0,uploadThroughput:0,connectionType:'none'});
  await ev("document.querySelector('[data-action=task-table-refresh]').click()");
  const failed=await waitFor(b,"Pandora.taskForm.state.error&&!Pandora.taskForm.state.loading&&!Pandora.taskForm.state.loaded",15000);
  const failure=await ev("({error:Pandora.taskForm.state.error,loaded:Pandora.taskForm.state.loaded,pager:document.getElementById('p-table-pager').textContent,rows:document.querySelectorAll('[data-task-row]').length,text:document.getElementById('p-table-body').textContent,retry:!!document.querySelector('[data-action=task-table-retry]')})");
  check('failed task load shows the error and an explicit retry without claiming partial completeness',failed&&failure.pager===''&&failure.rows===0&&failure.retry&&failure.text.includes('任务加载失败')&&failure.loaded===false,failure);
  await b.screenshot(output.replace('employee-browser.json','employee-task-error.png'));
  await b.send('Network.emulateNetworkConditions',{offline:false,latency:0,downloadThroughput:-1,uploadThroughput:-1,connectionType:'wifi'});
  await ev("document.querySelector('[data-action=task-table-retry]').click()");
  check('retry after a real network failure restores the complete result',await waitFor(b,"Pandora.taskForm.state.loaded&&!Pandora.taskForm.state.error&&Pandora.taskForm.current().paged.total===109&&document.querySelectorAll('[data-task-row]').length===50",20000));
  check('task form snapshot is complete and cross-day work is counted once',await ev(`(()=>{const rows=Pandora.taskForm.current().sorted;return rows.length===109&&new Set(rows.map(t=>t.id)).size===109&&rows.filter(t=>t.id===${js(fixture.special.cross)}).length===1})()`));
  const ranks={urgency:{'紧急':0,'高':1,'中':2,'低':3},status:{todo:0,doing:1,done:2}};
  const sortEvidence=async(key,dir)=>{
   return ev(`(()=>{const state=Pandora.taskForm.state,rows=state.result.sorted,collator=new Intl.Collator('zh-Hans-CN');
    const value=t=>{const raw=t.raw||{};if(${js(key)}==='title')return null;if(${js(key)}==='createdAt')return new Date(raw.createdAt||0).getTime()||0;if(${js(key)}==='start')return new Date(raw.startAt||0).getTime()||0;if(${js(key)}==='due')return new Date(raw.dueAt||0).getTime()||0;if(${js(key)}==='urgency')return (${js(ranks.urgency)})[t.urgency]??2;return (${js(ranks.status)})[raw.executionState||t.status]??0};
    const sign=${js(dir)}==='desc'?-1:1;
    for(let i=1;i<rows.length;i++){const a=rows[i-1],b=rows[i];const compare=${js(key)}==='title'?collator.compare(String(a.title||''),String(b.title||'')):value(a)-value(b);if(compare*sign>0)return {ok:false,index:i,left:a.title,right:b.title};if(compare===0&&!(a.id<b.id))return {ok:false,tie:i,left:a.id,right:b.id};}
    return {ok:true,key:state.sort.key,dir:state.sort.dir,total:rows.length,head:rows.slice(0,2).map(t=>t.title),tail:rows.slice(-2).map(t=>t.title)}})()`);
  };
  for(const key of ['title','createdAt','start','due','urgency','status']){
   await ev(`document.querySelector('[data-action="task-table-sort"][data-key="${key}"]').click()`);
   const ascending=await sortEvidence(key,'asc');
   check('global task form sort '+key+' ascending is stable over the whole result',ascending.ok&&await ev("Pandora.taskForm.state.sort.dir==='asc'&&Pandora.taskForm.state.page===0"),ascending);
   await ev("document.querySelector('[data-action=task-table-next]').click();document.querySelector('[data-action=task-table-next]').click()");
   const lastPage=await ev(`(()=>{const rows=Pandora.taskForm.state.result.sorted,shown=Array.from(document.querySelectorAll('[data-task-row]')).map(e=>e.dataset.taskRow);return {same:JSON.stringify(shown)===JSON.stringify(rows.slice(100).map(t=>t.id)),shown:shown.length,page:Pandora.taskForm.state.page}})()`);
   check('global task form sort '+key+' continues on the third page',lastPage.same&&lastPage.shown===9&&lastPage.page===2,lastPage);
   await ev(`document.querySelector('[data-action="task-table-sort"][data-key="${key}"]').click()`);
   const descending=await sortEvidence(key,'desc');
   check('global task form sort '+key+' descending is stable and resets paging',descending.ok&&await ev("Pandora.taskForm.state.sort.dir==='desc'&&Pandora.taskForm.state.page===0"),descending);
   await ev("document.querySelector('[data-action=task-table-next]').click();document.querySelector('[data-action=task-table-next]').click()");
   const reverseLast=await ev(`(()=>{const rows=Pandora.taskForm.state.result.sorted,shown=Array.from(document.querySelectorAll('[data-task-row]')).map(e=>e.dataset.taskRow);return JSON.stringify(shown)===JSON.stringify(rows.slice(100).map(t=>t.id))})()`);
   check('global task form sort '+key+' paging is continuous after direction change',reverseLast);
   await ev("document.querySelector('[data-action=task-table-prev]').click();document.querySelector('[data-action=task-table-prev]').click()");
  }
  const fixed=await ev(`(()=>{const scroller=document.getElementById('p-table-scroll'),cell=document.querySelector('[data-task-row] th'),head=document.querySelector('#p-table-head th:first-child');const before=cell.getBoundingClientRect().left;scroller.scrollLeft=280;const after=cell.getBoundingClientRect().left,left=scroller.getBoundingClientRect().left;const position=getComputedStyle(cell).position;scroller.scrollLeft=0;return {position,before,after,left,scrolled:after-left}})()`);
  check('task name column stays fixed while the table scrolls sideways',fixed.position==='sticky'&&Math.abs(fixed.after-fixed.left)<2&&fixed.before===fixed.after,fixed);
  await ev("document.querySelector('[data-action=task-table-clear-filters]').click()");
  await ev("document.getElementById('p-filter-query').value='Browser task 10';document.getElementById('p-filter-query').dispatchEvent(new Event('input',{bubbles:true}));document.getElementById('p-filter-relation').value='own';document.getElementById('p-filter-relation').dispatchEvent(new Event('change',{bubbles:true}))");
  check('combined task form filters recalculate total and page',await waitFor(b,"Pandora.taskForm.current().paged.total===5&&Pandora.taskForm.state.page===0"));
  await ev("document.querySelector('[data-action=task-table-clear-filters]').click();document.getElementById('p-filter-query').value='Calendar';document.getElementById('p-filter-query').dispatchEvent(new Event('input',{bubbles:true}));document.getElementById('p-filter-relation').value='own';document.getElementById('p-filter-relation').dispatchEvent(new Event('change',{bubbles:true}));document.getElementById('p-filter-from').value="+js(fixture.day)+";document.getElementById('p-filter-from').dispatchEvent(new Event('change',{bubbles:true}));document.getElementById('p-filter-to').value="+js(shiftDate(fixture.day,1))+";document.getElementById('p-filter-to').dispatchEvent(new Event('change',{bubbles:true}))");
  const dateFiltered=await waitFor(b,"Pandora.taskForm.current().paged.total===3&&Pandora.taskForm.current().sorted.filter(t=>t.id==="+js(fixture.special.cross)+").length===1");
  check('date/relation/name filters keep a cross-day task in its single matching row',dateFiltered);
  await ev("document.querySelector('[data-action=task-table-clear-filters]').click();document.getElementById('p-filter-query').value='Browser task 0';document.getElementById('p-filter-query').dispatchEvent(new Event('input',{bubbles:true}))");
  check('detail return setup uses the filtered second page',await waitFor(b,"Pandora.taskForm.current().paged.total===100&&Pandora.taskForm.state.page===0"));
  await ev("document.querySelector('[data-action=task-table-next]').click()");
  const beforeDetail=await ev(`(()=>{const scroller=document.getElementById('p-table-scroll');scroller.scrollTop=420;const row=document.querySelector('[data-task-row]');return {page:Pandora.taskForm.state.page,query:Pandora.taskForm.state.filters.query,scroll:scroller.scrollTop,ids:Array.from(document.querySelectorAll('[data-task-row]')).map(e=>e.dataset.taskRow),first:row&&row.dataset.taskRow}})()`);
  await ev(`document.querySelector('[data-task-row="${beforeDetail.first}"] [data-task="${beforeDetail.first}"]').click()`);
  check('task detail opens over the filtered table',await waitFor(b,"!document.getElementById('overlay').hidden&&Pandora.idle()&&document.getElementById('sheetTitle').textContent.length>0"));
  await closeSheet();
  const afterDetail=await ev(`(()=>{const scroller=document.getElementById('p-table-scroll');return {page:Pandora.taskForm.state.page,query:Pandora.taskForm.state.filters.query,queryInput:document.getElementById('p-filter-query').value,scroll:scroller.scrollTop,ids:Array.from(document.querySelectorAll('[data-task-row]')).map(e=>e.dataset.taskRow),loaded:Pandora.taskForm.state.loaded,error:Pandora.taskForm.state.error,total:Pandora.taskForm.current().paged.total}})()`);
  check('closing task detail preserves filters, page, scroll and the loaded rows',afterDetail.page===beforeDetail.page&&afterDetail.query===beforeDetail.query&&afterDetail.queryInput===beforeDetail.query&&afterDetail.scroll===beforeDetail.scroll&&JSON.stringify(afterDetail.ids)===JSON.stringify(beforeDetail.ids)&&afterDetail.loaded&&!afterDetail.error&&afterDetail.total===100,{beforeDetail,afterDetail});
  await ev("document.querySelector('[data-action=task-table-close]').click()");
  check('task form returns to the calendar',await waitFor(b,"Pandora.taskForm.state.active===false&&state.viewPage==='calendar'&&Pandora.idle()"));
  await ev("state.viewMode='day';state.viewAnchor=addDays(parseDateInput("+js(fixture.day)+"),1);renderAll()");
  await waitFor(b,"!!document.querySelector('.p-table-entry')");
  await ev("document.querySelector('.p-table-entry').click()");
  check('calendar context opens the task form',await waitFor(b,"Pandora.taskForm.state.loaded&&state.viewPage==='table'&&document.querySelectorAll('[data-task-row]').length===50",20000));
  const contextBefore=await ev("({mode:state.viewMode,anchor:state.viewAnchor.getTime()})");
  await ev("document.querySelector('[data-action=task-table-close]').click()");
  const contextRestored=await waitFor(b,"state.viewPage==='calendar'&&Pandora.idle()");
  const contextAfter=await ev("({mode:state.viewMode,anchor:state.viewAnchor.getTime(),day:!!document.querySelector('#p-schedule-main .p-day-list, .p-day-list')})");
  check('closing the task form restores the original calendar mode and date',contextRestored&&contextAfter.mode===contextBefore.mode&&contextAfter.anchor===contextBefore.anchor&&contextBefore.mode==='day',{contextBefore,contextAfter});
  await b.screenshot(output.replace('employee-browser.json','employee-task-table.png'));

  /* -------- 8.4: real log creation/backfill/detail/edit/save/close -------- */
  const today=await ev("Pandora.data.home.businessDate"),yesterday=shiftDate(today,-1),preday=shiftDate(today,-2);
  await openLogDate();
  const optionEvidence=await ev("Array.from(document.getElementById('lf-date').options).map(o=>o.value)");
  check('real log form offers only company today/yesterday/day-before',optionEvidence.length===3&&optionEvidence.includes(today)&&optionEvidence.includes(yesterday)&&optionEvidence.includes(preday),optionEvidence);
  await openLogDate(yesterday);
  const yesterdayForm=await ev("({date:document.getElementById('lf-date').value,disabled:document.getElementById('lf-date').disabled,draft:drafts.log&&drafts.log.businessDate,id:drafts.log&&drafts.log.id})");
  check('changing the date opens a real backfill form for yesterday',yesterdayForm.date===yesterday&&yesterdayForm.disabled===false&&yesterdayForm.draft===yesterday&&!yesterdayForm.id,yesterdayForm);
  await saveLogForm('Browser log yesterday backfill');
  const yesterdaySave=await ev("({overlay:document.getElementById('overlay').hidden,error:(document.getElementById('lf-error')||{}).textContent,errorHidden:(document.getElementById('lf-error')||{}).hidden,notice:document.getElementById('appNotice').textContent,draft:drafts.log&&drafts.log.businessDate,page:state.page})");
  const yesterdayLog=await selfLog(yesterday);
  const allSelf=await ev("Pandora.request('/work-logs?scope=self&limit=10').then(r=>r.items.map(l=>({id:l.id,date:l.businessDate,body:l.body})))");
  check('backfill creates a real yesterday log',!!yesterdayLog&&/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(yesterdayLog.id)&&yesterdayLog.businessDate===yesterday&&yesterdayLog.body==='Browser log yesterday backfill',{yesterdaySave,yesterdayLog,allSelf});
  await openLogDate(preday);
  await saveLogForm('Browser log day before backfill');
  const predayLog=await selfLog(preday);
  check('backfill creates a real day-before log with a distinct object id',!!predayLog&&predayLog.id!==yesterdayLog.id&&predayLog.businessDate===preday&&predayLog.body==='Browser log day before backfill'&&predayLog.editable===true,predayLog);
  const older=shiftDate(today,-3),future=shiftDate(today,1);
  await openLogDate(future);await saveLogForm('Browser future log must fail');
  check('the page rejects a future business date',await waitFor(b,"!document.getElementById('lf-error').hidden")&&await ev("document.getElementById('lf-error').textContent.includes('未来')"),await ev("document.getElementById('lf-error').textContent"));
  await closeSheet();
  await openLogDate(older);await saveLogForm('Browser fourth-day log must fail');
  check('the page rejects a business date outside the three-day window',await waitFor(b,"!document.getElementById('lf-error').hidden")&&await ev("document.getElementById('lf-error').textContent.includes('今天、昨天和前天')"),await ev("document.getElementById('lf-error').textContent"));
  await closeSheet();

  /* Delete/recreate keeps the first creation instant and the same real row. */
  await api('DELETE','/work-logs/'+predayLog.id,undefined,{'If-Match':'"'+predayLog.rowVersion+'"','Idempotency-Key':'del-preday-'+Date.now()});
  const restored=await api('POST','/work-logs',{body:'Browser log day before restored',businessDate:preday},{'Idempotency-Key':'restore-preday-'+Date.now()});
  const predayRestored=await selfLog(preday);
  check('deleting and recreating the day slot restores the same real id and first-creation instant',restored.restored===true&&restored.logId===predayLog.id&&predayRestored.id===predayLog.id&&predayRestored.createdAt===predayLog.createdAt&&predayRestored.body==='Browser log day before restored',{restored,predayRestored});
  await api('DELETE','/work-logs/'+predayRestored.id,undefined,{'If-Match':'"'+predayRestored.rowVersion+'"','Idempotency-Key':'del-preday-2-'+Date.now()});
  await openLogDate(preday);
  const race=await api('POST','/work-logs',{body:'Browser same-day race winner',businessDate:preday},{'Idempotency-Key':'race-preday-'+Date.now()});
  await saveLogForm('Browser same-day race loser');
  check('a same-day concurrent creation reopens the existing real record instead of duplicating it',await waitFor(b,"drafts.log&&drafts.log.id==="+js(race.logId))&&await ev(`document.getElementById('lf-content').value==='Browser same-day race winner'`),{race,notice:await ev("document.getElementById('appNotice').textContent"),form:await ev("({date:document.getElementById('lf-date').value,disabled:document.getElementById('lf-date').disabled})")});
  await closeSheet();
  const predayFinal=await selfLog(preday);
  check('same-day uniqueness keeps one live row for the company business date',predayFinal.id===predayLog.id&&predayFinal.createdAt===predayLog.createdAt,predayFinal);

  await openLogDate();
  await saveLogForm('Browser log today original');
  const todaySaveState=await ev("({overlay:document.getElementById('overlay').hidden,idle:Pandora.idle(),title:document.getElementById('sheetTitle').textContent,error:(document.getElementById('lf-error')||{}).textContent,errorHidden:(document.getElementById('lf-error')||{}).hidden,notice:document.getElementById('appNotice').textContent,page:state.page,draft:drafts.log&&drafts.log.businessDate})");
  check('new log for today closes the form and reloads the workspace',todaySaveState.overlay&&todaySaveState.idle&&todaySaveState.notice.includes('日志已保存'),todaySaveState);
  const todayLog=await selfLog(today);
  check('today log is a real record with the company business date',!!todayLog&&/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(todayLog.id)&&todayLog.businessDate===today&&todayLog.body==='Browser log today original'&&todayLog.editable===true,todayLog);
  check('today log appears once on the workspace and uses the same object id',await openLogDetail(todayLog.id)&&await ev(`document.body.textContent.includes('Browser log today original')&&!!document.querySelector('[data-log-card="${todayLog.id}"]')`));
  await ev("document.querySelector('#sheetFoot [data-action=edit-log]').click()");
  check('log detail edit opens the same record',await waitFor(b,"!document.getElementById('overlay').hidden&&document.getElementById('sheetTitle').textContent==='编辑日志'&&!!document.getElementById('lf-content')&&document.getElementById('lf-content').value==='Browser log today original'&&Pandora.idle()"));
  await saveLogForm('Browser log today edited');
  const todayEdited=await selfLog(today);
  check('log detail edit saves the same real id and keeps its business date',todayEdited.id===todayLog.id&&todayEdited.businessDate===today&&todayEdited.body==='Browser log today edited'&&todayEdited.createdAt===todayLog.createdAt,{before:todayLog,after:todayEdited});
  const detailOpened=await openLogDetail(todayLog.id);
  const detailVisible=await ev("({overlay:!document.getElementById('overlay').hidden,title:document.getElementById('sheetTitle').textContent,idle:Pandora.idle(),cards:document.querySelectorAll('[data-log-card]').length,notice:document.getElementById('appNotice').textContent})");
  await closeSheet();
  const detailClosed=await ev("document.getElementById('overlay').hidden");
  check('log detail closes without rewriting the log date',detailOpened&&detailVisible.overlay&&detailClosed,{detailOpened,detailVisible,detailClosed});
  await ev(`document.querySelector('#logResults [data-action=edit-log][data-id="${yesterdayLog.id}"]').click()`);
  check('reopening the same business day edits the existing record instead of a new one',await waitFor(b,"!document.getElementById('overlay').hidden&&document.getElementById('sheetTitle').textContent==='编辑日志'&&drafts.log&&drafts.log.id==="+js(yesterdayLog.id)+"&&Pandora.idle()")&&await ev("document.getElementById('lf-date').disabled&&document.getElementById('lf-content').value==='Browser log yesterday backfill'"));
  await closeSheet();

  /* A page already open before the real 24-hour freeze must be rejected by the server. */
  await openLogDetail(yesterdayLog.id);
  await ev("document.querySelector('#sheetFoot [data-action=edit-log]').click()");
  const editReady=await waitFor(b,"!document.getElementById('overlay').hidden&&document.getElementById('sheetTitle').textContent==='编辑日志'&&!!document.getElementById('lf-content')&&Pandora.idle()");
  sql(`UPDATE work_logs SET created_at=UTC_TIMESTAMP(6)-INTERVAL 25 HOUR WHERE id=${sqlQuote(yesterdayLog.id)}`);
  const createdAtAged=sql(`SELECT DATE_FORMAT(created_at,'%Y-%m-%d %H:%i:%s.%f') FROM work_logs WHERE id=${sqlQuote(yesterdayLog.id)}`);
  await ev(`(()=>{window.__origRequest=Pandora.request;window.__saveRequests=[];Pandora.request=async function(path,options){try{const result=await window.__origRequest.call(this,path,options);window.__saveRequests.push({path,method:options&&options.method,status:200});return result}catch(error){window.__saveRequests.push({path,method:options&&options.method,status:error.status,code:error.code,message:error.message});throw error}}})()`);
  await saveLogForm('Browser stale frozen page write');
  const frozen=await waitFor(b,"document.getElementById('overlay').hidden&&Pandora.idle()");
  const frozenPage=await ev("({requests:window.__saveRequests,notice:document.getElementById('appNotice').textContent,error:(document.getElementById('lf-error')||{}).textContent,errorHidden:(document.getElementById('lf-error')||{}).hidden,sheet:document.getElementById('sheetTitle').textContent,overlay:document.getElementById('overlay').hidden,draft:drafts.log&&drafts.log.id})");
  await ev("Pandora.request=window.__origRequest");
  const yesterdayFrozen=await selfLog(yesterday);
  const createdAtAfter=sql(`SELECT DATE_FORMAT(created_at,'%Y-%m-%d %H:%i:%s.%f') FROM work_logs WHERE id=${sqlQuote(yesterdayLog.id)}`);
  check('a stale page cannot write after the real 24-hour freeze',editReady&&frozen&&yesterdayFrozen.frozen===true&&yesterdayFrozen.editable===false&&yesterdayFrozen.body==='Browser log yesterday backfill'&&createdAtAfter===createdAtAged&&frozenPage.notice.includes('24小时'),{editReady,frozenPage,yesterdayFrozen,createdAtAged,createdAtAfter});
  check('the frozen log is visibly read-only in the real page',await ev(`document.getElementById('logResults').textContent.includes('已冻结')&&!document.querySelector('#logResults [data-action=edit-log][data-id="${yesterdayLog.id}"]')`));

  /* A deleted day slot whose original 24 hours have elapsed stays closed after recreation. */
  const todayBeforeDelete=await selfLog(today);
  await api('DELETE','/work-logs/'+todayLog.id,undefined,{'If-Match':'"'+todayBeforeDelete.rowVersion+'"','Idempotency-Key':'del-today-'+Date.now()});
  const todayRowBefore=sql(`SELECT id,business_date,IFNULL(deleted_at,'NULL'),DATE_FORMAT(created_at,'%Y-%m-%d %H:%i:%s.%f') FROM work_logs WHERE id=${sqlQuote(todayLog.id)}`);
  sql(`UPDATE work_logs SET created_at=UTC_TIMESTAMP(6)-INTERVAL 25 HOUR WHERE id=${sqlQuote(todayLog.id)}`);
  await openLogDate();
  await saveLogForm('Browser deleted slot must stay frozen');
  const deletedSlot=await waitFor(b,"document.getElementById('overlay').hidden&&Pandora.idle()");
  const todayRowAfter=sql(`SELECT id,business_date,IFNULL(deleted_at,'NULL'),DATE_FORMAT(created_at,'%Y-%m-%d %H:%i:%s.%f') FROM work_logs WHERE id=${sqlQuote(todayLog.id)}`);
  const liveToday=sql(`SELECT COUNT(*) FROM work_logs WHERE author_id=${sqlQuote(ids['alpha-one-employee'].id)} AND business_date=${sqlQuote(today)} AND deleted_at IS NULL`);
  check('recreating a deleted slot never resets the first-creation freeze window',deletedSlot&&todayRowAfter.split('\t')[0]===todayLog.id&&todayRowAfter.split('\t')[2]!=='NULL'&&liveToday==='0'&&(await ev("document.getElementById('appNotice').textContent")).includes('24小时'),{before:todayRowBefore,after:todayRowAfter,liveToday,notice:await ev("document.getElementById('appNotice').textContent")});

  /* -------- personal items: real id new/edit/delete, no list actions, tenth-item limit -------- */
  const logsBefore=await ev("JSON.stringify(Pandora.data.calendarLogs.map(l=>({id:l.id,body:l.body,businessDate:l.businessDate})))");
  await setPage('map');
  await ev("document.querySelector('[data-action=new-personal]').click()");
  await waitFor(b,"!!document.getElementById('pi-text')&&Pandora.idle()");
  check('personal item list exposes opening only, not edit/delete actions',await ev("!document.querySelector('.personal-quad [data-edit-personal],.personal-quad [data-delete-personal],.personal-quad [data-action=p-edit-home-personal],.personal-quad [data-action=p-delete-home-personal]')&&Array.from(document.querySelectorAll('.personal-quad .home-personal-item')).every(e=>e.dataset.action==='p-open-home-personal')"));
  await ev("document.getElementById('pi-text').value='Browser personal item v1';document.querySelector('[data-action=save-personal]').click()");
  await waitFor(b,"document.getElementById('overlay').hidden&&Pandora.idle()");
  const personal=await ev("Pandora.request('/home').then(h=>h.personalItems.find(i=>i.body==='Browser personal item v1')||null)");
  check('new personal item is saved with a real object id',!!personal&&/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(personal.id),personal);
  await ev(`document.querySelector('[data-action=p-open-home-personal][data-id="${personal.id}"]').click()`);
  check('workbench detail opens the same personal item with edit/delete',await waitFor(b,"document.getElementById('sheetTitle').textContent==='个人信息'&&Pandora.idle()")&&await ev(`document.getElementById('sheetBody').textContent.includes('Browser personal item v1')&&!!document.querySelector('[data-action=p-edit-home-personal][data-id="${personal.id}"]')&&!!document.querySelector('[data-action=p-delete-home-personal][data-id="${personal.id}"]')`));
  await ev(`document.querySelector('[data-action=p-edit-home-personal][data-id="${personal.id}"]').click()`);
  await waitFor(b,"!!document.getElementById('pi-text')&&Pandora.idle()");
  await ev("document.getElementById('pi-text').value='Browser personal item v2';document.querySelector('[data-action=save-personal]').click()");
  await waitFor(b,"document.getElementById('overlay').hidden&&Pandora.idle()");
  const personalEdited=await ev("Pandora.request('/home/items/"+personal.id+"')");
  check('personal item edit keeps the same id and does not rewrite the source log',personalEdited.id===personal.id&&personalEdited.body==='Browser personal item v2'&&await ev("JSON.stringify(Pandora.data.calendarLogs.map(l=>({id:l.id,body:l.body,businessDate:l.businessDate})))")===logsBefore,{personalEdited});
  await b.screenshot(output.replace('employee-browser.json','employee-personal.png'));
  await ev(`document.querySelector('[data-action=p-open-home-personal][data-id="${personal.id}"]').click()`);
  await waitFor(b,"document.getElementById('sheetTitle').textContent==='个人信息'&&Pandora.idle()");
  await ev(`document.querySelector('[data-action=p-delete-home-personal][data-id="${personal.id}"]').click()`);
  check('personal item delete asks for confirmation in the real page',await waitFor(b,"!!document.querySelector('[data-action=confirm-delete][data-id=\""+personal.id+"\"]')&&Pandora.idle()"));
  await ev("document.querySelector('[data-action=confirm-delete]').click()");
  await waitFor(b,"document.getElementById('overlay').hidden&&Pandora.idle()");
  check('personal item delete removes the real object and keeps logs untouched',await ev("Pandora.request('/home').then(h=>!h.personalItems.some(i=>i.id==="+js(personal.id)+"))")&&await ev("JSON.stringify(Pandora.data.calendarLogs.map(l=>({id:l.id,body:l.body,businessDate:l.businessDate})))")===logsBefore);
  for(let index=1;index<=10;index++)await api('POST','/home/items',{kind:'personal',body:'Browser limit item '+index},{'Idempotency-Key':'limit-'+index+'-'+Date.now()});
  await ev('Pandora.reload()');
  const limitState=await ev("({count:Pandora.data.home.personalItems.length,disabled:document.querySelector('[data-action=new-personal]').disabled,actions:Array.from(document.querySelectorAll('.personal-quad .home-personal-item')).every(e=>e.dataset.action==='p-open-home-personal')})");
  check('tenth personal item disables the visible create action',limitState.count===10&&limitState.disabled&&limitState.actions,limitState);
  const eleventh=await apiError('POST','/home/items',{kind:'personal',body:'Browser eleventh item'},{'Idempotency-Key':'limit-eleven-'+Date.now()});
  check('the eleventh personal item is rejected by the real service with a stable error',eleventh.ok===false&&eleventh.status===409&&eleventh.code==='HOME_ITEM_LIMIT',eleventh);

  /* -------- 8.2 effective-version isolation under a pending modification -------- */
  await logout();await login('alpha-one-head');
  await setPage('view');
  await ev("document.querySelector('.p-table-entry').click()");
  check('published task with a pending change is still in the task form',await waitFor(b,`Pandora.taskForm.state.loaded&&Pandora.taskForm.current().sorted.some(t=>t.id===${js(fixture.pendingTask)})`,20000));
  const pendingRow=await ev(`(()=>{const rows=Pandora.taskForm.current().sorted,task=rows.find(t=>t.id===${js(fixture.pendingTask)});return {title:task&&task.title,status:task&&task.status,proposed:rows.some(t=>t.title===${js(fixture.pendingProposedTitle)}),unpublished:rows.some(t=>t.title==='Unpublished departure creation'),pending:task&&task.pendingKind,row:!!document.querySelector('[data-task-row="${fixture.pendingTask}"]'),rowText:document.querySelector('[data-task-row="${fixture.pendingTask}"]')&&document.querySelector('[data-task-row="${fixture.pendingTask}"]').textContent}})()`);
  check('task form lists the effective state and excludes unpublished/proposed work',pendingRow.title===fixture.pendingOldTitle&&pendingRow.status!=='done'&&!pendingRow.proposed&&!pendingRow.unpublished&&pendingRow.pending==='complete'&&pendingRow.row&&pendingRow.rowText.includes('完成待审'),pendingRow);
  await ev(`document.querySelector('[data-task-row="${fixture.pendingTask}"] [data-task="${fixture.pendingTask}"]').click()`);
  check('pending-completion detail shows the effective version, not the proposal',await waitFor(b,"!document.getElementById('overlay').hidden&&Pandora.idle()")&&await ev(`document.getElementById('sheetTitle').textContent===${js(fixture.pendingOldTitle)}&&document.getElementById('sheetBody').textContent.includes('当前展示的是有效版本')&&!document.getElementById('sheetBody').textContent.includes(${js(fixture.pendingProposedTitle)})`));
  await closeSheet();
  await ev("document.querySelector('[data-action=task-table-close]').click()");
  await waitFor(b,"state.viewPage==='calendar'");

  await logout();await login('beta-two-employee');
  await ev(`openTaskDetail(${js(fixture.completedTask)})`);
  check('takeover recipient sees reopen on original completed work',await waitFor(b,"!!document.querySelector('[data-action=p-reopen-task]')"));
  await ev("document.querySelector('[data-action=p-reopen-task]').click()");
  check('reopen exposes ordered active replacement assignees',await waitFor(b,"!!document.getElementById('rp-owner-add')")&&await ev(`!Array.from(document.getElementById('rp-owner-add').options).some(o=>o.value===${js(ids['alpha-two-employee'].id)})`));
  await ev(`document.querySelector('[data-action=rp-owner-remove]').click();document.getElementById('rp-owner-add').value=${js(ids['beta-one-employee'].id)};document.querySelector('[data-action=rp-owner-add]').click();document.getElementById('reopen-reason').value='Browser reopen with active replacement';document.querySelector('[data-action=p-confirm-reopen]').click()`);
  check('reopen saves new round and replacement without adding business owner',await waitFor(b,`Pandora.idle()&&TASKS.find(t=>t.id===${js(fixture.completedTask)}).status!=='done'`)&&await ev(`(()=>{const t=TASKS.find(t=>t.id===${js(fixture.completedTask)});return t.assigneeIds.length===1&&t.assigneeIds[0]===${js(ids['beta-one-employee'].id)}&&t.creatorId===${js(ids['alpha-two-employee'].id)}&&t.businessOwnerId===${js(ids['beta-two-employee'].id)}&&!t.frozen})()`));
  // The admin acceptance swapped the two team heads; alpha-two-head now manages alpha-one's employee.
  for(const [key,label,department,team] of [['founder','创始人',false,false],['alpha-head','部门负责人',true,false],['alpha-two-head','团队负责人',true,true]]){
   await ev('Pandora.logout()');await login(key);await ev("setPage('me')");
   const fields=await ev("Array.from(document.querySelectorAll('[data-profile-fold=organization] .profile-row .k')).map(e=>e.textContent)");
   check('fixed profile organization fields '+key,await ev(`document.querySelector('[data-profile-fold=organization]').textContent.includes(${js(label)})&&!document.querySelector('[data-action=p-open-teams]')`)&&fields.includes('部门')===department&&fields.includes('团队')===team,fields);
   check('fixed manager retains subordinate profile and logs '+key,await ev(`!!document.querySelector('[data-action=p-open-person][data-id="${ids['alpha-one-employee'].id}"]')`));
   if(key==='alpha-head'){
    await ev(`state.logDepartmentId='fixture-company-beta';state.logTeamId='fixture-company-beta-one';state.logDepartmentQuery='beta';state.logTeamQuery='beta';state.logAuthorQuery='beta';state.logFilterOpen=true`);
    await ev(`document.querySelector('[data-action=p-open-person][data-id="${ids['alpha-one-employee'].id}"]').click()`);
    check('actual descendant contact and log entry '+key,await waitFor(b,"!!document.querySelector('[data-action=p-open-person-logs]')&&Pandora.idle()"));
    const indirect=await ev(`(()=>{const target=Pandora.data.reports.items.find(p=>p.id===${js(ids['alpha-one-employee'].id)});return {manager:target&&target.managerId,me:Pandora.data.me.id,isDirect:!!target&&target.managerId===Pandora.data.me.id,canRead:!!target&&target.canReadLogs}})()`);
    check('person log target is an indirect descendant, not only a direct report',indirect.manager&&indirect.manager!==indirect.me&&indirect.isDirect===false&&indirect.canRead,indirect);
    await ev("document.querySelector('[data-action=p-open-person-logs]').click()");
    const personLogs=await waitFor(b,`state.page==='log'&&Pandora.idle()&&state.logAuthorId===${js(ids['alpha-one-employee'].id)}&&document.querySelectorAll('[data-log-card]').length>0`);
    const logState=await ev(`(()=>{const logs=Pandora.taskForm?Pandora.data:[],cards=Array.from(document.querySelectorAll('[data-log-card]')).map(e=>e.dataset.logCard);return {page:state.page,author:state.logAuthorId,all:state.logAll,department:state.logDepartmentId,team:state.logTeamId,departmentQuery:state.logDepartmentQuery,teamQuery:state.logTeamQuery,authorQuery:state.logAuthorQuery,cards,filtered:filteredLogs().map(l=>({id:l.id,author:l.authorId}))}})()`);
    check('person log entry clears stale department/team/search filters',personLogs&&logState.all===false&&logState.author===ids['alpha-one-employee'].id&&logState.department==='__all__'&&logState.team==='__all__'&&logState.departmentQuery===''&&logState.teamQuery===''&&logState.authorQuery==='',logState);
    const expected=await ev(`Pandora.request('/work-logs?scope=visible&authorId=${ids['alpha-one-employee'].id}&limit=100').then(r=>r.items.map(l=>l.id))`);
    check('person log list contains only the target person records from current authority',logState.cards.length===expected.length&&logState.cards.every(id=>expected.includes(id))&&logState.filtered.every(row=>row.author===ids['alpha-one-employee'].id),{expected,cards:logState.cards,filtered:logState.filtered});
    await b.screenshot(output.replace('employee-browser.json','employee-person-logs.png'));
   }else{
    await ev(`document.querySelector('[data-action=p-open-person][data-id="${ids['alpha-one-employee'].id}"]').click()`);
    check('actual descendant contact and log entry '+key,await waitFor(b,"!!document.querySelector('[data-action=p-open-person-logs]')&&Pandora.idle()")&&await ev("document.getElementById('sheetBody').textContent.includes('手机号')&&!document.getElementById('sheetBody').textContent.includes('邮箱')"));
    await ev('closeSheet()');
   }
  }
  check('employee interactions have no browser exceptions',b.errors.length===0,b.errors);
  report.result='PASS';
 }finally{b.kill();fs.writeFileSync(output,JSON.stringify(report,null,2)+'\n');}
}
main().catch(error=>{report.result='FAIL';report.error=error.message;fs.writeFileSync(output,JSON.stringify(report,null,2)+'\n');console.error(error);process.exitCode=1;});
