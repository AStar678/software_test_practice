#!/usr/bin/env node
'use strict';
const fs=require('fs'),path=require('path');
const {openBrowser,waitFor}=require('./browser_fixture');
const fixture=JSON.parse(process.env.PANDORA_BROWSER_FIXTURE),ids=fixture.identities;
const output=path.resolve(__dirname,'../../audit/refactor-pandora-organization-and-workflows/employee-browser.json');
const report={updated:new Date().toISOString(),checks:[]};
function check(name,pass,evidence){report.checks.push({check:name,pass:!!pass,evidence});console.log((pass?'PASS ':'FAIL ')+name);if(!pass)throw new Error(name+' '+JSON.stringify(evidence));}
async function main(){
 const b=await openBrowser(fixture.base+'/');const ev=b.evaluate;
 async function login(key){
  check('login form ready '+key,await waitFor(b,"!!document.getElementById('backend-login')&&Pandora.idle()"));
  await ev(`document.getElementById('login-user').value=${JSON.stringify(ids[key].identifier)};document.getElementById('login-password').value='Fixture@123456';document.getElementById('backend-login').requestSubmit()`);
  const ready=await waitFor(b,`Pandora.ready&&Pandora.idle()&&Pandora.data.me.id===${JSON.stringify(ids[key].id)}`);
  check('phone login '+key,ready,ready?undefined:{errors:b.errors,page:await ev("({text:document.querySelector('#page-map').textContent.slice(-1200),busy:!Pandora.idle(),hasSession:!!Pandora.token})")});
 }
 try{
  await login('alpha-one-employee');
  for(const width of [320,390,1440]){
   await b.viewport({width,height:width===320?740:width===390?844:900,mobile:width<1000});
   const geometry=await ev(`(()=>{setPage('map');document.querySelector('.tasks-quad .q-body').scrollTop=90;return {quadrants:document.querySelectorAll('#page-map .quad').length,scroll:Array.from(document.querySelectorAll('#page-map .q-body')).every(e=>getComputedStyle(e).overflowY==='auto'),priorities:Array.from(document.querySelectorAll('.home-task-priority')).map(e=>({width:e.getBoundingClientRect().width,visible:e.getBoundingClientRect().right<=e.closest('.q-body').getBoundingClientRect().right+1})),duplicate:!!document.querySelector('#page-map .workday button'),longTitle:!!Array.from(document.querySelectorAll('.home-task-title')).find(e=>e.textContent.length>50)}})()`);
   check('dashboard priority and independent quadrants at '+width,geometry.quadrants===4&&geometry.scroll&&geometry.priorities.length>0&&geometry.priorities.every(p=>p.width>10&&p.visible)&&!geometry.duplicate&&geometry.longTitle,geometry);
   await b.screenshot(output.replace('employee-browser.json','dashboard-'+width+'.png'));
  }
  await b.viewport({width:390,height:844,mobile:true});
  await ev("setPage('view');Pandora.taskForm.open()");
  check('task form retains more than two pages and removes explanatory statistics',await waitFor(b,"Pandora.taskForm.state.loaded&&!Pandora.taskForm.state.loading&&document.querySelectorAll('[data-task-row]').length===50")&&await ev("Pandora.taskForm.current().paged.pages>=3&&!document.querySelector('.p-table-source,.p-task-table caption,.p-table-counts')&&document.getElementById('p-table-pager').textContent.includes('共')"));
  for(const key of ['title','createdAt','start','due','urgency','status']){
   await ev(`document.querySelector('[data-action="task-table-sort"][data-key="${key}"]').click()`);
   check('global task form sort '+key,await ev(`Pandora.taskForm.state.sort.key==='${key}'&&Pandora.taskForm.current().sorted.length===109&&document.querySelectorAll('[data-task-row]').length===50`));
  }
  await ev("document.querySelector('[data-action=task-table-next]').click();document.querySelector('[data-action=task-table-next]').click()");
  check('task form third page keeps unique rows',await ev("Pandora.taskForm.state.page===2&&document.querySelectorAll('[data-task-row]').length===9&&new Set(Pandora.taskForm.current().sorted.map(t=>t.id)).size===109"));
  await ev("document.getElementById('p-filter-query').value='Browser task 10';document.getElementById('p-filter-query').dispatchEvent(new Event('input',{bubbles:true}));document.getElementById('p-filter-relation').value='own';document.getElementById('p-filter-relation').dispatchEvent(new Event('change',{bubbles:true}))");
  check('combined task form filters recalculate total and page',await waitFor(b,"Pandora.taskForm.current().paged.total===5&&Pandora.taskForm.state.page===0"));
  await ev("Pandora.taskForm.close();setPage('me');document.querySelector('[data-action=p-open-settings]').click();document.querySelector('[data-action=p-edit-profile]').click()");
  check('profile has no employee identity or team management writers',await waitFor(b,"!!document.getElementById('profile-email')")&&await ev("!document.getElementById('profile-display-name')&&!document.getElementById('profile-phone')&&!document.getElementById('profile-username')&&!document.querySelector('[data-action=p-open-teams]')&&document.getElementById('sheetBody').textContent.includes('姓名和登录手机号由管理员维护')"));
  await ev("document.getElementById('profile-email').value='browser@example.test';document.querySelector('[data-action=p-select-avatar][data-avatar=cat]').click();document.querySelector('[data-action=p-save-profile]').click()");
  check('self email and avatar save against actual service',await waitFor(b,"Pandora.data.me.email==='browser@example.test'&&Pandora.data.me.avatar==='cat'&&Pandora.idle()"));
  await ev("document.querySelector('[data-action=p-open-settings]').click();document.querySelector('[data-action=p-change-password]').click()");
  check('employee password maintenance entry remains usable',await waitFor(b,"!!document.getElementById('cp-current')&&!!document.getElementById('cp-new')&&Pandora.idle()"));
  await ev('closeSheet()');
  await b.send('Emulation.setTimezoneOverride',{timezoneId:'America/Los_Angeles'});
  check('company day boundaries respect DST and skipped midnight',await ev("(()=>{const P=Pandora,z='America/New_York',hours=(a,c)=>(P.companyDayStart(c,z)-P.companyDayStart(a,z))/3600000;return hours('2026-03-08','2026-03-09')===23&&hours('2026-11-01','2026-11-02')===25&&P.companyParts(P.companyDayStart('2018-11-04','America/Sao_Paulo'),'America/Sao_Paulo').hour==='01'&&P.companyDateKey('2026-01-01T23:00:00Z','Asia/Shanghai')==='2026-01-02'})()"));
  const calendar=await ev(`(()=>{const P=Pandora,C=P.calendar,d=parseDateInput(${JSON.stringify(fixture.day)}),mid=addDays(d,1),last=addDays(d,2),special=${JSON.stringify(fixture.special)},task=k=>TASKS.find(t=>t.id===special[k]);return {cross:[C.dayCoverage(task('cross'),d),C.dayCoverage(task('cross'),mid),C.dayCoverage(task('cross'),last)],midnight:C.dayCoverage(task('midnight'),mid),point:[C.dayCoverage(task('point'),d),C.dayCoverage(task('point'),mid)],middleAll:C.allDayTasks(mid).map(t=>t.id),middleTimed:C.dayEvents(mid).map(e=>e.task.id),raw:JSON.stringify(P.data.rawTasks)}})()`);
  check('cross-day first middle last project timed full-day timed',calendar.cross[0].start===1200&&!calendar.cross[0].fullDay&&calendar.cross[1].fullDay&&!calendar.cross[2].fullDay&&calendar.cross[2].end===600,calendar.cross);
  check('midnight deadline exclusive and midnight point belongs to next day',calendar.midnight===null&&calendar.point[0]===null&&calendar.point[1].point&&calendar.point[1].start===0,calendar.point);
  check('projected all-day tasks appear once and leave timed axis',calendar.middleAll.includes(fixture.special.cross)&&calendar.middleAll.includes(fixture.special.allDay)&&!calendar.middleTimed.includes(fixture.special.cross)&&new Set(calendar.middleAll).size===calendar.middleAll.length);
  await ev(`setPage('view');state.viewMode='day';state.viewAnchor=addDays(parseDateInput(${JSON.stringify(fixture.day)}),1);renderAll()`);
  check('real day view renders projected full-day and midnight point',await waitFor(b,`!!document.querySelector('.p-all-day-event[data-task="${fixture.special.cross}"]')`)&&await ev(`!document.querySelector('.p-axis-event[data-task="${fixture.special.cross}"]')&&!!document.querySelector('.p-schedule-fab')`));
  check('dense all-day list and entire 24-hour axis stay scrollable',await ev("(()=>{const all=document.querySelector('.p-allday-scroll'),axis=document.querySelector('.p-timeline-scroll');all.scrollTop=all.scrollHeight;axis.scrollTop=axis.scrollHeight;return document.querySelectorAll('.p-all-day-event').length>5&&all.scrollTop>0&&axis.scrollTop>0&&!!document.querySelector('.p-axis-end')})()"));
  await ev("document.querySelector('.p-schedule-fab').click()");
  check('calendar plus still opens a creation form',await waitFor(b,"!!document.getElementById('tf-title')"));
  await ev('closeSheet()');
  check('calendar rendering never mutates raw schedules',await ev('JSON.stringify(Pandora.data.rawTasks)=== '+JSON.stringify(calendar.raw)));
  await b.screenshot(output.replace('employee-browser.json','day-projection.png'));
  await ev('Pandora.logout()');await login('beta-two-employee');
  await ev(`openTaskDetail(${JSON.stringify(fixture.completedTask)})`);
  check('takeover recipient sees reopen on original completed work',await waitFor(b,"!!document.querySelector('[data-action=p-reopen-task]')"));
  await ev("document.querySelector('[data-action=p-reopen-task]').click()");
  check('reopen exposes ordered active replacement assignees',await waitFor(b,"!!document.getElementById('rp-owner-add')")&&await ev(`!Array.from(document.getElementById('rp-owner-add').options).some(o=>o.value===${JSON.stringify(ids['alpha-two-employee'].id)})`));
  await ev(`document.querySelector('[data-action=rp-owner-remove]').click();document.getElementById('rp-owner-add').value=${JSON.stringify(ids['beta-one-employee'].id)};document.querySelector('[data-action=rp-owner-add]').click();document.getElementById('reopen-reason').value='Browser reopen with active replacement';document.querySelector('[data-action=p-confirm-reopen]').click()`);
  check('reopen saves new round and replacement without adding business owner',await waitFor(b,`Pandora.idle()&&TASKS.find(t=>t.id===${JSON.stringify(fixture.completedTask)}).status!=='done'`)&&await ev(`(()=>{const t=TASKS.find(t=>t.id===${JSON.stringify(fixture.completedTask)});return t.assigneeIds.length===1&&t.assigneeIds[0]===${JSON.stringify(ids['beta-one-employee'].id)}&&t.creatorId===${JSON.stringify(ids['alpha-two-employee'].id)}&&t.businessOwnerId===${JSON.stringify(ids['beta-two-employee'].id)}&&!t.frozen})()`));
  // The admin acceptance swapped the two team heads; alpha-two-head now manages alpha-one's employee.
  for(const [key,label,department,team] of [['founder','创始人',false,false],['alpha-head','部门负责人',true,false],['alpha-two-head','团队负责人',true,true]]){
   await ev('Pandora.logout()');await login(key);await ev("setPage('me')");
   const fields=await ev("Array.from(document.querySelectorAll('[data-profile-fold=organization] .profile-row .k')).map(e=>e.textContent)");
   check('fixed profile organization fields '+key,await ev(`document.querySelector('[data-profile-fold=organization]').textContent.includes(${JSON.stringify(label)})&&!document.querySelector('[data-action=p-open-teams]')`)&&fields.includes('部门')===department&&fields.includes('团队')===team,fields);
   check('fixed manager retains subordinate profile and logs '+key,await ev(`!!document.querySelector('[data-action=p-open-person][data-id="${ids['alpha-one-employee'].id}"]')`));
   await ev(`document.querySelector('[data-action=p-open-person][data-id="${ids['alpha-one-employee'].id}"]').click()`);
   check('actual descendant contact and log entry '+key,await waitFor(b,"!!document.querySelector('[data-action=p-open-person-logs]')&&Pandora.idle()")&&await ev("document.getElementById('sheetBody').textContent.includes('手机号')&&!document.getElementById('sheetBody').textContent.includes('邮箱')"));
   await ev('closeSheet()');
  }
  check('employee interactions have no browser exceptions',b.errors.length===0,b.errors);
  report.result='PASS';
 }finally{b.kill();fs.writeFileSync(output,JSON.stringify(report,null,2)+'\n');}
}
main().catch(error=>{report.result='FAIL';report.error=error.message;fs.writeFileSync(output,JSON.stringify(report,null,2)+'\n');console.error(error);process.exitCode=1;});
