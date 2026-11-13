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
  await ev(`document.getElementById('login-user').value=${js(f.identities[who].identifier)};document.getElementById('login-password').value='Demo@123456';document.getElementById('backend-login').requestSubmit()`);
  check('real demo login '+who,await idle());
 }
 async function logout(){await ev('Pandora.logout()');await waitFor(b,"!!document.getElementById('backend-login')&&Pandora.idle()",25000);}
 async function home(who){
  await ev("setPage('map')");await sleep(300);
  const state=await ev("({quads:document.querySelectorAll('#page-map .quad').length,company:!!document.querySelector('.company-quad'),tasks:!!document.querySelector('.tasks-quad'),daily:!!document.getElementById('dailyItemsSection'),dailyCells:document.querySelectorAll('[data-daily-date]').length})");
  check(who+' home shows the three modules with a real daily calendar',state.quads===3&&state.company&&state.tasks&&state.daily&&state.dailyCells>=20,state);
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
  report.result='PASS';
 }catch(error){report.result='FAIL';report.error=error.message;throw error;}
 finally{fs.writeFileSync(path.join(out,'demo-roles-browser.json'),JSON.stringify(report,null,2));await b.kill();}
}
main().catch(error=>{console.error(error);process.exitCode=1});
