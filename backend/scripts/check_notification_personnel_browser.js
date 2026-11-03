'use strict';
const fs=require('fs'),path=require('path');
const {openBrowser,waitFor,sleep}=require('./browser_fixture');
const f=JSON.parse(process.env.PANDORA_NOTIFICATION_PERSONNEL_FIXTURE),out=path.resolve(__dirname,'../../output/notification-personnel'),js=JSON.stringify;
const report={checks:[]};
function check(name,pass,evidence){report.checks.push({name,pass:!!pass,evidence});console.log((pass?'PASS ':'FAIL ')+name);if(!pass)throw Error(name+' '+JSON.stringify(evidence));}
async function main(){const b=await openBrowser(f.base+'/',{width:390,height:844,mobile:true}),ev=b.evaluate;
async function ready(expr){return waitFor(b,'Pandora.idle()&&('+expr+')',20000);}
async function login(who){await waitFor(b,"!!document.getElementById('backend-login')");await ev(`document.getElementById('login-user').value=${js(f.identities[who].identifier)};document.getElementById('login-password').value='Fixture@123456';document.getElementById('backend-login').requestSubmit()`);check('real login '+who,await ready(`Pandora.ready&&Pandora.data.me.id===${js(f.identities[who].id)}`));}
async function openNotice(id){await ev(`closeSheet();openNotif(${js(id)})`);check('open notification '+id,await ready("document.getElementById('sheetTitle').textContent==='通知详情'"));}
async function staffReady(){return ready("!!document.querySelector('[data-staff-panel]')&&!document.querySelector('.staff-state[role=status]')");}
async function clickTask(){await ev(`document.querySelector('[data-task="${f.staffTask}"]').click()`);check('staff task opens detail',await ready(`sheetStack.at(-1)?.taskId===${js(f.staffTask)}`));}
try{
 await login('alpha-one-employee');
 await ev('openNotifications()');check('notification list ready',await ready("!!document.getElementById('pn-category')"));
 await ev("document.getElementById('pn-category').value='reminder';document.getElementById('pn-category').dispatchEvent(new Event('change',{bubbles:true}))");
 check('real reminder filter shows four items',await ev("document.querySelectorAll('.p-notice-row').length===4&&[...document.querySelectorAll('.npurpose')].every(n=>n.textContent==='提醒')"));
 await openNotice(f.notices['alpha-one-employee']);
 check('applicant result has correct bound request button',await ev(`document.querySelector('[data-action=p-open-approval]').dataset.id===${js(f.requestId)}&&document.getElementById('sheetBody').textContent.includes('已通过')`));
 await ev("document.querySelector('[data-action=p-open-approval]').click()");
 check('original completed request opens despite later pending request',await ready(`sheetStack.at(-1)?.approvalId===${js(f.requestId)}&&!document.querySelector('[data-action=p-approve-request],[data-action=p-reject-request],[data-action=p-withdraw-request]')&&document.getElementById('sheetBody').textContent.includes('第一份申请说明')&&!document.getElementById('sheetBody').textContent.includes('第二份申请仍待审')`));
 check('applicant comparison remains hidden',await ev("!document.getElementById('sheetBody').textContent.includes('查看申请前有效版本')"));
 await ev('closeSheet();Pandora.logout()');await login('alpha-one-head');
 await openNotice(f.notices['alpha-one-head']);await ev("document.querySelector('[data-action=p-open-approval]').click()");
 check('reviewer can inspect correct old result without action',await ready(`sheetStack.at(-1)?.approvalId===${js(f.requestId)}&&!document.querySelector('[data-action=p-approve-request],[data-action=p-reject-request]')`));
 await ev('closeSheet();Pandora.logout()');await login('alpha-two-employee');
 await openNotice(f.notices['alpha-two-employee']);
 check('ordinary recipient keeps result and no invalid request button',await ev("!document.querySelector('[data-action=p-open-approval]')&&document.getElementById('sheetBody').textContent.includes('已通过')&&!!document.querySelector('[data-action=p-open-notification-task]')"));
 check('task result has one task entry without duplicate object jump',await ev("!document.querySelector('[data-action=p-open-notification-object]')"));
 for(const width of [320,390,1440]){await b.viewport({width,height:width===1440?900:844,mobile:width!==1440});check('notification fits '+width,await ev("sheetBodyEl.scrollWidth<=sheetBodyEl.clientWidth+1"));await b.screenshot(path.join(out,'result-'+width+'.png'));}
 await openNotice(f.rejectedNotice);
 check('ordinary recipient can read original rejection opinion without an invalid entry',await ev("sheetBodyEl.textContent.includes('已退回')&&sheetBodyEl.textContent.includes('处理意见：请补充验收材料再提交')&&!document.querySelector('[data-action=p-open-approval]')"));
 await openNotice(f.lostNotice);
 check('lost relation has only historical task entry and no request',await ev("!!document.querySelector('[data-action=p-open-historical-task]')&&!document.querySelector('[data-action=p-open-approval],[data-action=p-open-notification-task]')"));
 await ev('closeSheet();Pandora.logout()');await login('founder');
 await openNotice(f.withdrawnNotice);check('withdrawn notice has no object or request controls',await ev("!document.querySelector('[data-action=p-open-approval],[data-action=p-open-notification-task],[data-action=p-open-notification-object]')"));
 await ev('closeSheet()');
 const cache=await ev(`(async()=>{const row=(await Pandora.request('/assignee-candidates?purpose=create')).items.find(p=>p.id===${js(f.identities['alpha-head'].id)});const p=personById(row.id);Object.assign(p,{role:'employee',dept:'',raw:{id:row.id,displayName:row.displayName}});const before=p;Pandora.rememberPeople([row]);const after=personById(row.id);Pandora.rememberPeople([{id:row.id,displayName:row.displayName}]);return {same:before===after,role:after.role,dept:after.dept,position:after.raw.positionName,summary:assigneeSummaryHTML([row.id])};})()`);
 check('complete candidate refreshes existing cached identity and department',cache.same&&cache.role==='department_head'&&cache.dept==='alpha'&&cache.position==='Display title',cache);
 check('later name-only summary preserves correct responsible person text',cache.summary.includes('部门负责人')&&cache.summary.includes('Display title')&&cache.summary.includes('alpha')&&!cache.summary.includes('员工')&&!cache.summary.includes('—'),cache.summary);
 await ev('openTaskForm("create")');check('creation form ready',await ready("!!document.getElementById('tf-title')"));
 await ev(`drafts.task.assigneeIds=[${js(f.identities['alpha-head'].id)}];replaceTopSheet(taskFormView())`);
 check('real task form uses current person metadata',await ev("document.querySelector('.chip-meta').textContent==='部门负责人 · Display title · alpha'"));
 check('creation rules are concise and reviewer preview remains',await ev("!sheetBodyEl.textContent.includes('本人可移除且不会自动加回')&&!sheetBodyEl.textContent.includes('负责人换序、更换或跨部门')&&sheetBodyEl.textContent.includes('直接生效')"));
 await ev('closeSheet();Pandora.reload()');
 await ev('openTaskForm("create")');check('candidate form reloads after workspace refresh',await ready("!!document.getElementById('tf-title')"));
 check('candidate cache uses refreshed directory objects',await ev(`assignablePeople(actor()).every(p=>p===personById(p.id))&&assignablePeople(actor()).find(p=>p.id===${js(f.identities['alpha-head'].id)}).role==='department_head'`));
 await ev('closeSheet();setPage("me")');
 check('own profile has no redundant company row',await ev("![...document.querySelectorAll('#page-me .profile-row .k')].some(n=>n.textContent==='公司')"));
 await ev(`runAction({dataset:{action:'p-open-person',id:${js(f.identities['alpha-one-employee'].id)}}})`);check('staff workspace ready',await staffReady());
 check('staff profile has no company field',await ev("![...document.querySelectorAll('.staff-person-info .profile-row .k')].some(n=>n.textContent==='公司')"));
 await ev(`document.getElementById('staff-calendar-date').value=${js(f.day)};document.getElementById('staff-calendar-date').dispatchEvent(new Event('change',{bubbles:true}))`);check('staff selected month ready',await staffReady());
 const scroll=await ev("(()=>{const n=document.querySelector('.staff-month-scroll');n.scrollTop=180;sheetBodyEl.scrollTop=80;return {month:n.scrollTop,body:sheetBodyEl.scrollTop};})()");
 await clickTask();
 await b.screenshot(path.join(out,'staff-task-detail.png'));
 check('staff detail header provides visible return and no personal pin',await ev("!document.getElementById('sheetBack').hidden&&document.getElementById('sheetClose').hidden&&!document.querySelector('[data-action=p-toggle-task-pin]')"));
 await ev("document.getElementById('sheetBack').click()");check('header return restores staff month date',await staffReady()&&await ev(`!!document.querySelector('.staff-month-view')&&document.getElementById('staff-calendar-date').value===${js(f.day)}`));
 await sleep(100);const restored=await ev("({month:document.querySelector('.staff-month-scroll').scrollTop,body:sheetBodyEl.scrollTop})");
 check('month and sheet scrolling restored',Math.abs(scroll.month-restored.month)<=1&&Math.abs(scroll.body-restored.body)<=1,{before:scroll,after:restored});
 await ev("document.querySelector('[data-action=p-staff-mode][data-mode=day]').click()");check('staff selected day ready',await staffReady());
 await ev("document.querySelector('.staff-axis-scroll').scrollTop=500");await clickTask();
 await b.send('Input.dispatchKeyEvent',{type:'keyDown',key:'Escape',code:'Escape',windowsVirtualKeyCode:27});
 check('escape restores same staff day',await staffReady()&&await ev(`!!document.querySelector('.staff-day-axis')&&document.getElementById('staff-calendar-date').value===${js(f.day)}`));
 await sleep(100);check('staff day axis scroll restored',await ev("Math.abs(document.querySelector('.staff-axis-scroll').scrollTop-500)<=1"));
 await clickTask();await ev(`openTaskDetail(${js(f.resultTask)})`);
 check('nested staff detail inherits return context',await ready(`sheetStack.at(-1)?.taskId===${js(f.resultTask)}&&sheetStack.at(-1).returnContext==='staff'`));
 await ev("document.getElementById('sheetBack').click()");check('nested return stops at first task',await ready(`sheetStack.at(-1)?.taskId===${js(f.staffTask)}`));
 await ev("document.getElementById('sheetClose').click()");check('even legacy head close returns to staff',await staffReady());
 for(const width of [320,390,1440]){await b.viewport({width,height:width===1440?900:844,mobile:width!==1440});check('staff detail layout fits '+width,await ev("sheetBodyEl.scrollWidth<=sheetBodyEl.clientWidth+1"));await b.screenshot(path.join(out,'staff-'+width+'.png'));}
 await ev(`openTaskDetail(${js(f.ownTask)})`);check('own responsible task retains pin',await ready("!!document.querySelector('[data-action=p-toggle-task-pin]')"));
 await ev("document.querySelector('[data-action=p-toggle-task-pin]').click()");check('own pin actually persists',await ready(`taskById(${js(f.ownTask)})?.pinned&&document.querySelector('[data-action=p-toggle-task-pin]').textContent==='取消置顶'`));
 await ev('closeSheet()');await sleep(5100);
 for(const [name,id,editable,frozen] of [['personal',f.personalLog,true,false],['frozen',f.frozenLog,false,true],['staff',f.staffLog,false,false]]){
  await ev(`openLogDetail(${js(id)})`);check(name+' log ready',await ready("document.getElementById('sheetTitle').textContent==='日志详情'&&!!document.querySelector('.p-log-reading')"));
  check(name+' comment composer has no development explanation',await ev("document.querySelector('.p-comment-label').textContent==='发表评论'"));
  check(name+' log permissions expressed by controls and freeze state',await ev(`!sheetBodyEl.textContent.includes('编辑权限')&&!!document.querySelector('[data-action=edit-log]')===${editable}&&${frozen?"sheetBodyEl.textContent.includes('冻结，只能查看')":"sheetBodyEl.textContent.includes('冻结')"}`));
  for(const width of [320,390,1440]){await b.viewport({width,height:width===1440?900:844,mobile:width!==1440});check(name+' log fits '+width,await ev("sheetBodyEl.scrollWidth<=sheetBodyEl.clientWidth+1"));await b.screenshot(path.join(out,name+'-log-'+width+'.png'));}
  await ev('closeSheet()');
 }
 await ev("setPage('ai')");check('analysis ready with concise source',await ready("document.getElementById('page-ai').textContent.includes('来源：当前有效任务')&&!document.getElementById('page-ai').textContent.includes('local_proportional_schedule_rules')&&!document.getElementById('page-ai').textContent.includes('不调用外部模型')"));
 for(const width of [320,390,1440]){await b.viewport({width,height:width===1440?900:844,mobile:width!==1440});check('analysis page fits '+width,await ev("document.documentElement.scrollWidth<=innerWidth+1"));await b.screenshot(path.join(out,'analysis-'+width+'.png'));}
 check('no browser exceptions',b.errors.length===0,b.errors);report.result='PASS';
}catch(error){report.result='FAIL';report.error=error.message;await b.screenshot(path.join(out,'failure.png'));throw error;}
finally{fs.writeFileSync(path.join(out,'browser-report.json'),JSON.stringify(report,null,2)+'\n');b.kill();}}
main().catch(error=>{console.error(error);process.exitCode=1});
