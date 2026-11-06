'use strict';
const fs=require('fs'),path=require('path');
const {openBrowser,waitFor}=require('./browser_fixture');
const checkAssigneeRefresh=require('./check_assignee_refresh_browser');
const f=JSON.parse(process.env.PANDORA_PROFILE_FIXTURE),q=JSON.stringify;
const out=path.resolve(__dirname,'../../output/apply-profile-pin-history');fs.mkdirSync(out,{recursive:true});
const report={checks:[]};
function check(name,pass,evidence){report.checks.push({name,pass:!!pass,evidence});console.log((pass?'PASS ':'FAIL ')+name);if(!pass)throw Error(name+' '+JSON.stringify(evidence));}
async function main(){
 const b=await openBrowser(f.base+'/'+encodeURIComponent('潘多拉-交互原型.html'),{width:390,height:844,mobile:true}),ev=b.evaluate;
 async function login(phone){await waitFor(b,"!!document.getElementById('backend-login')");await ev(`document.getElementById('login-user').value=${q(phone)};document.getElementById('login-password').value='Fixture@123456';document.getElementById('backend-login').requestSubmit()`);check('authenticated',await waitFor(b,'Pandora.ready&&Pandora.idle()',20000));}
 async function idle(){return waitFor(b,'Pandora.idle()',20000);}
 try{
  await login(f.founder);
  await checkAssigneeRefresh(b,f,check,login);
  const cache=await ev(`(()=>{
    const id=${q(f.employeeId)},before=personById(id).raw;
    const full={id,displayName:'缓存完整姓名',placementType:'team_head',departmentName:'缓存部门',teamName:'缓存团队',positionName:'缓存职位',phone:'13900009999',email:'cache@example.com'};
    Pandora.rememberPeople([{id,displayName:'缓存摘要姓名'}]);
    const summary=personById(id).raw;
    Pandora.rememberPeople([full]);
    const updated=personById(id).raw;
    const canonical=Pandora.data.users.find(row=>row.id===id);
    canonical.departmentName='旧目录部门';canonical.teamName='旧目录团队';
    Pandora.rememberPeople([{id,displayName:'完整更新',placementType:'employee',departmentName:'新部门',teamName:'新团队',positionName:'新职位'}]);
    const newest=personById(id).raw;
    Pandora.rememberPeople([{id,displayName:'摘要后姓名'}]);
    const summaryAfter=personById(id).raw;
    Pandora.rememberPeople([{id,displayName:'清除部门',departmentName:null,teamName:null}]);
    const cleared=personById(id).raw;
    return {before,summary,updated,newest,summaryAfter,cleared,line:Pandora.staffOrgLine({placementType:'employee',positionName:'部门负责人',departmentName:'alpha',teamName:'one'})};
  })()`);
  check('name-only summary keeps existing organization fields',cache.summary.displayName==='缓存摘要姓名'&&cache.summary.departmentName===cache.before.departmentName&&cache.summary.teamName===cache.before.teamName,cache);
  check('complete person data updates known identity, department, team and position',cache.updated.displayName==='缓存完整姓名'&&cache.updated.placementType==='team_head'&&cache.updated.departmentName==='缓存部门'&&cache.updated.teamName==='缓存团队'&&cache.updated.positionName==='缓存职位',cache.updated);
  check('general person cache never keeps phone or email',!('phone' in cache.updated)&&!('email' in cache.updated),cache.updated);
  check('later summary does not roll back a complete organization update',cache.summaryAfter.departmentName==='新部门'&&cache.summaryAfter.teamName==='新团队'&&cache.summaryAfter.displayName==='摘要后姓名',cache.summaryAfter);
  check('explicit null clears revoked organization fields',cache.cleared.departmentName===null&&cache.cleared.teamName===null,cache.cleared);
  check('position names never determine the identity label',cache.line==='员工 · 部门负责人 · alpha · one',cache.line);
  await ev('Pandora.reload()');await idle();await ev("setPage('me')");await idle();
  const profile=await ev("(()=>{const fold=document.querySelector('[data-profile-fold=organization]');return {text:fold.textContent,labels:Array.from(fold.querySelectorAll('.profile-row .k')).map(x=>x.textContent),hasCompany:Array.from(fold.querySelectorAll('.profile-row .k')).some(x=>x.textContent==='公司')}})()");
  check('own profile has no company data row',profile.labels.includes('部门')&&!profile.hasCompany,profile);
  await ev("document.querySelector('[data-profile-fold=reports]').open=true");
  const reports=await ev("(()=>{const tree=document.querySelector('.staff-tree');return {exists:!!tree,companyLine:!!tree&&Array.from(tree.querySelectorAll('.staff-tree-person small')).some(x=>x.textContent.includes('公司'))}})()");
  check('subordinate tree does not fabricate a company row',reports.exists&&!reports.companyLine,reports);
  await ev('Pandora.logout()');
  check('logout clears the general person cache',await ev('PEOPLE.length===0'));
  await login(f.employee);
  check('owner pin task opens',await (async()=>{await ev(`Pandora.openTask(${q(f.pinTask)})`);return waitFor(b,"Pandora.idle()&&!!document.querySelector('[data-action=p-toggle-task-pin]')",20000);})());
  check('completed owner task keeps the pin action',await (async()=>{await ev("document.getElementById('sheetClose').click()");await waitFor(b,"document.getElementById('overlay').hidden");await ev(`Pandora.openTask(${q(f.completedTask)})`);return waitFor(b,"Pandora.idle()&&!!document.querySelector('[data-action=p-toggle-task-pin]')",20000);})());
  await ev("document.getElementById('sheetClose').click()");await waitFor(b,"document.getElementById('overlay').hidden");
  await ev(`Pandora.openTask(${q(f.historyTask)})`);
  const history=await waitFor(b,`Pandora.idle()&&document.getElementById('sheetBody').textContent.includes(${q(f.historyText)})`,20000);
  const historyText=await ev("document.getElementById('sheetBody').textContent");
  check('employee detail shows current progress without a history timeline',history&&!historyText.includes('执行记录')&&!historyText.includes('历次进展')&&!historyText.includes('records'),historyText.slice(-800));
  check('no browser exceptions',b.errors.length===0,b.errors);
  report.result='PASS';
 }catch(error){report.result='FAIL';report.error=error.message;throw error;}
 finally{fs.writeFileSync(path.join(out,'browser-report.json'),JSON.stringify(report,null,2));await b.kill();}
}
main().catch(error=>{console.error(error);process.exitCode=1});
