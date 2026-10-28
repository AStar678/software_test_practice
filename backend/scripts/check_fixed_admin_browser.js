#!/usr/bin/env node
'use strict';
const fs=require('fs'),path=require('path');
const {openBrowser,waitFor}=require('./browser_fixture');
const fixture=JSON.parse(process.env.PANDORA_BROWSER_FIXTURE),base=fixture.base,ids=fixture.identities;
const output=path.resolve(__dirname,'../../audit/refactor-pandora-organization-and-workflows/admin-browser.json');
const report={updated:new Date().toISOString(),checks:[]};
function check(name,condition,evidence){report.checks.push({check:name,pass:!!condition,evidence});console.log((condition?'PASS ':'FAIL ')+name);if(!condition)throw new Error(name+' '+JSON.stringify(evidence));}
async function main(){
 const browser=await openBrowser(base+'/admin.html',{width:1440,height:900,mobile:false});
 const evaluate=browser.evaluate;
 try{
  await waitFor(browser,"typeof login==='function'");
  await evaluate(`$('accountName').value=${JSON.stringify(ids.admin.identifier)};$('password').value='Fixture@123456';$('loginButton').click()`);
  check('independent admin enters real management console',await waitFor(browser,"state.structure&&state.planDraft&&document.querySelectorAll('#employeeRows tr').length===11"));
  check('retired role and manual manager controls are removed',await evaluate("!document.getElementById('tab-roles')&&!document.getElementById('fManager')&&!document.getElementById('fLevel')&&!document.querySelector('#employeeRows').textContent.includes('用户名')"));
  await evaluate("selectTab('organization',document.querySelector('[data-tab=organization]'))");
  const before=await evaluate("JSON.stringify(state.structure.placements)");
  await evaluate("state.planDraft.placements[0].positionId=null;renderPlan();$('planReason').value='Illegal draft stays editable';return savePlan()".replace('return savePlan()','savePlan()'));
  check('invalid final draft stays open with server error and no write',await waitFor(browser,"$('planError').textContent.length>0")&&await evaluate("state.planDraft.placements[0].positionId===null&&JSON.stringify(state.structure.placements)==="+JSON.stringify(before)));
  await evaluate("resetPlan()");
  check('cancel local draft restores saved positions',await evaluate("JSON.stringify(state.planDraft.placements)==="+JSON.stringify(before)));
  const headA=ids['alpha-one-head'].id,headB=ids['alpha-two-head'].id;
  await evaluate(`(()=>{const a=state.planDraft.placements.find(p=>p.employeeId===${JSON.stringify(headA)}),b=state.planDraft.placements.find(p=>p.employeeId===${JSON.stringify(headB)});[a.teamId,b.teamId]=[b.teamId,a.teamId];renderPlan();$('planReason').value='Browser atomic head swap';$('planSave').click()})()`);
  check('browser saves full head swap with derived managers',await waitFor(browser,`state.structure.employees.find(e=>e.id===${JSON.stringify(headA)}).teamId==='fixture-company-alpha-two'`));
  await evaluate("openEmployee(null);$('fDisplayName').value='Browser new employee';$('fPhone').value='13999999001';$('employeeSave').click()");
  check('new employee is a local draft before final save',await waitFor(browser,"state.planDraft.newEmployees.length===1")&&await evaluate("!state.employees.some(e=>e.displayName==='Browser new employee')"));
  await evaluate("(()=>{const p=state.planDraft.placements.at(-1);p.departmentId='fixture-company-beta';p.teamId='fixture-company-beta-one';p.positionId='fixture-company-title';renderPlan();$('planReason').value='Browser new employee with full placement';$('planSave').click()})()");
  check('new employee full plan returns one-time initial credential',await waitFor(browser,"state.employees.some(e=>e.displayName==='Browser new employee')&&$('employeeSecret').textContent.includes('初始密码仅显示一次')"));
  await evaluate("location.reload()");
  check('organization persists across browser reload without redisplaying credential',await waitFor(browser,"state.structure&&state.employees.some(e=>e.displayName==='Browser new employee')&&$('employeeSecret').textContent===''") );
  await evaluate(`selectTab('takeover',document.querySelector('[data-tab=takeover]'));$('inventoryEmployee').value=${JSON.stringify(ids.founder.id)};$('inventoryLoad').click()`);
  check('founder inventory offers no deactivation control',await waitFor(browser,"state.inventory&&document.getElementById('stageTakeover')")&&await evaluate("!document.getElementById('stageDeactivate')"));
  await evaluate(`$('inventoryEmployee').value=${JSON.stringify(ids['alpha-two-employee'].id)};$('inventoryLoad').click()`);
  check('departure inventory includes completed work and pending unpublished creation',await waitFor(browser,`state.inventory.employeeId===${JSON.stringify(ids['alpha-two-employee'].id)}&&document.querySelector('[data-takeover-task]')&&document.querySelector('[data-cancel-request]')`));
  await evaluate(`document.querySelectorAll('[data-takeover-task]').forEach(s=>s.value=${JSON.stringify(ids['beta-two-employee'].id)});document.querySelectorAll('[data-cancel-request]').forEach(i=>i.checked=true);$('takeoverReason').value='Browser prepared departure';$('stageDeactivate').click();$('planReason').value='Browser final complete departure';$('planSave').click()`);
  check('browser commits completed responsibility takeover and employee deactivation',await waitFor(browser,`!state.employees.find(e=>e.id===${JSON.stringify(ids['alpha-two-employee'].id)}).active`));
  await evaluate("selectTab('account',document.querySelector('[data-tab=account]'))");
  check('admin account has independent account fields',await waitFor(browser,"state.adminAccount&&$('adminAccountName').value==='fixture-company-admin'"));
  await evaluate("$('adminAccountName').value='browser-renamed-admin';$('adminAccountSave').click()");
  check('admin account save revokes console and requires new login',await waitFor(browser,"!state.token&&!$('login').hidden"));
  await evaluate("$('accountName').value='browser-renamed-admin';$('password').value='Fixture@123456';$('loginButton').click()");
  check('renamed administrator logs in with same principal',await waitFor(browser,"state.user&&state.structure&&state.user.accountType==='admin'")&&await evaluate("state.user.id==="+JSON.stringify(ids.admin.id)));
  await browser.screenshot(output.replace('admin-browser.json','admin-console.png'));
  check('real admin interactions have no browser exceptions',browser.errors.length===0,browser.errors);
  report.result='PASS';
 }finally{browser.kill();fs.writeFileSync(output,JSON.stringify(report,null,2)+'\n');}
}
main().catch(error=>{report.result='FAIL';report.error=error.message;fs.writeFileSync(output,JSON.stringify(report,null,2)+'\n');console.error(error);process.exitCode=1;});
