#!/usr/bin/env node
'use strict';
const fs=require('fs'),path=require('path');
const {openBrowser,waitFor}=require('./browser_fixture');
const fixture=JSON.parse(process.env.PANDORA_BROWSER_FIXTURE),base=fixture.base,ids=fixture.identities;
const output=path.resolve(__dirname,'../../audit/refactor-pandora-organization-and-workflows/admin-browser.json');
const report={updated:new Date().toISOString(),checks:[]};
const contract=fixture.contract||null;
function check(name,condition,evidence){report.checks.push({check:name,pass:!!condition,evidence});console.log((condition?'PASS ':'FAIL ')+name);if(!condition)throw new Error(name+' '+JSON.stringify(evidence));}
function writeReport(){const text=JSON.stringify(report,null,2)+'\n';fs.writeFileSync(output,text);if(process.env.PANDORA_BROWSER_CONTRACT_REPORT)fs.writeFileSync(path.resolve(process.env.PANDORA_BROWSER_CONTRACT_REPORT),text);}
async function callApi(method,route,body,token){
 const headers={'Content-Type':'application/json'};if(token)headers.Authorization='Bearer '+token;
 const response=await fetch(base+'/api/v1'+route,{method,headers,body:body===undefined?undefined:JSON.stringify(body)});
 const text=await response.text();let payload={};try{payload=text?JSON.parse(text):{}}catch{}
 return {status:response.status,payload};
}
async function main(){
 const browser=await openBrowser(base+'/admin.html',{width:1440,height:900,mobile:false});
 const evaluate=browser.evaluate;
 try{
  await waitFor(browser,"typeof login==='function'");
  await evaluate(`$('accountName').value=${JSON.stringify(ids.admin.identifier)};$('password').value='Fixture@123456';$('loginButton').click()`);
  check('independent admin enters real management console',await waitFor(browser,"state.structure&&state.planDraft&&document.querySelectorAll('#employeeRows tr').length===11"));
  check('retired role and manual manager controls are removed',await evaluate("!document.getElementById('tab-roles')&&!document.getElementById('fManager')&&!document.getElementById('fLevel')&&!document.querySelector('#employeeRows').textContent.includes('用户名')"));
  if(contract){
   const clean=await evaluate(`(()=>{
    const navText=Array.from(document.querySelectorAll('nav button')).map(b=>b.textContent).join('|');
    const controls=Array.from(document.querySelectorAll('input,select,textarea')).map(c=>{
      const label=c.id?document.querySelector('label[for="'+c.id+'"]'):null;
      return ((c.id||'')+' '+(c.name||'')+' '+(label?label.textContent:'')+' '+(c.getAttribute('aria-label')||'')).toLowerCase();
    });
    return !navText.includes('角色与授权')&&!/角色|授权/.test(navText)&&!document.body.textContent.includes('手工上级')
      &&!document.getElementById('tab-roles')&&!document.getElementById('fManager')&&!document.getElementById('fLevel')
      &&!controls.some(t=>/role|scope|rank|角色|授权|范围|等级/.test(t));
   })()`);
   check('management console has no role/scope/rank/manual-manager editor',clean,{nav:await evaluate("document.querySelector('nav').textContent")});
   await evaluate("selectTab('positions',document.querySelector('[data-tab=positions]'))");
   check('position catalog is independent display metadata',await waitFor(browser,"$('positionRows').querySelectorAll('tr').length>=1")&&await evaluate("$('tab-positions').textContent.includes('职位只用于展示')&&!$('tab-positions').querySelector('select')"));
   const identity='beta-one-head',tokens=fixture.tokens||{},employeeToken=tokens[identity],adminToken=tokens.admin;
   const meBefore=await callApi('GET','/me',undefined,employeeToken);
   const previewBefore=await callApi('POST','/tasks/reviewer-preview',{operation:'create'},employeeToken);
   check('real employee identity is readable before the position rename',meBefore.status===200&&meBefore.payload.role===contract.legacy.expectedRole&&meBefore.payload.positionName===contract.position.oldName,{status:meBefore.status,role:meBefore.payload.role,positionName:meBefore.payload.positionName});
   await evaluate("$('positionName').value='Browser Catalog Analyst';$('positionCreate').click()");
   check('admin creates a display position independently',await waitFor(browser,"state.structure.positions.some(p=>p.name==='Browser Catalog Analyst')"));
   await evaluate(`(()=>{window.prompt=()=>${JSON.stringify(contract.position.newName)};const row=Array.from(document.querySelectorAll('#positionRows tr')).find(r=>r.textContent.includes(${JSON.stringify(contract.position.oldName)}));if(!row)throw new Error('position row missing');row.querySelector('[data-position]').click()})()`);
   check('admin renames a display position independently',await waitFor(browser,`state.structure.positions.some(p=>p.id===${JSON.stringify(contract.position.id)}&&p.name===${JSON.stringify(contract.position.newName)})`));
   check('renamed position is shown for assigned staff',await waitFor(browser,`$('employeeRows').textContent.includes(${JSON.stringify(contract.position.newName)})`));
   const meAfter=await callApi('GET','/me',undefined,employeeToken);
   const previewAfter=await callApi('POST','/tasks/reviewer-preview',{operation:'create'},employeeToken);
   const identityFields=['role','placementType','departmentId','teamId','positionId','managerId','positionName'];
   const pick=row=>Object.fromEntries(identityFields.map(key=>[key,row[key]]));
   const placementStable=identityFields.filter(key=>key!=='positionName').every(key=>meAfter.payload[key]===meBefore.payload[key]);
   check('position rename keeps role, placement, manager and position id',placementStable&&meAfter.payload.positionName===contract.position.newName,{before:pick(meBefore.payload),after:pick(meAfter.payload)});
   const routeStable=previewAfter.payload.reviewerId===previewBefore.payload.reviewerId
     &&previewAfter.payload.reviewerBasis===previewBefore.payload.reviewerBasis
     &&previewAfter.payload.requiresApproval===previewBefore.payload.requiresApproval
     &&previewAfter.payload.route?.basisAssigneeId===previewBefore.payload.route?.basisAssigneeId
     &&previewAfter.payload.route?.blocked===previewBefore.payload.route?.blocked
     &&previewAfter.payload.route?.reason===previewBefore.payload.route?.reason;
   check('position rename changes no creation route or reviewer',previewBefore.status===200&&previewAfter.status===200&&routeStable,{reviewerBefore:previewBefore.payload.reviewerId,reviewerAfter:previewAfter.payload.reviewerId,basisBefore:previewBefore.payload.route?.basisAssigneeId,basisAfter:previewAfter.payload.route?.basisAssigneeId});
   const legacyUsers=await callApi('GET','/admin/users',undefined,employeeToken);
   const legacyPositions=await callApi('POST','/admin/positions',{name:'Illegal Legacy Position'},employeeToken);
   check('legacy role data and the new position name do not grant admin access',legacyUsers.status===403&&legacyUsers.payload.code==='FORBIDDEN'&&legacyPositions.status===403&&meAfter.payload.role===contract.legacy.expectedRole,{usersStatus:legacyUsers.status,usersCode:legacyUsers.payload.code,positionStatus:legacyPositions.status,role:meAfter.payload.role});
   const employeeUsers=await callApi('GET','/admin/users',undefined,employeeToken);
   const employeePositions=await callApi('POST','/admin/positions',{name:'Illegal Employee Position'},employeeToken);
   const employeeNotifications=await callApi('GET','/admin/notifications',undefined,employeeToken);
   check('employee token is refused by GET /admin/users',employeeUsers.status===403&&employeeUsers.payload.code==='FORBIDDEN',{status:employeeUsers.status,code:employeeUsers.payload.code});
   check('employee token is refused by POST /admin/positions',employeePositions.status===403&&employeePositions.payload.code==='FORBIDDEN',{status:employeePositions.status,code:employeePositions.payload.code});
   check('employee token is refused by GET /admin/notifications',employeeNotifications.status===403&&employeeNotifications.payload.code==='FORBIDDEN',{status:employeeNotifications.status,code:employeeNotifications.payload.code});
   const adminUsers=await callApi('GET','/admin/users',undefined,adminToken);
   const adminNotifications=await callApi('GET','/admin/notifications',undefined,adminToken);
   check('administrator still calls management APIs normally',adminUsers.status===200&&adminNotifications.status===200,{usersStatus:adminUsers.status,notificationsStatus:adminNotifications.status});
   const employeeLogin=await callApi('POST','/auth/sessions',{accountType:'admin',accountName:ids[identity].identifier,password:'Fixture@123456'});
   check('employee credentials cannot enter the admin console',employeeLogin.status>=400,{status:employeeLogin.status,code:employeeLogin.payload.code});

   await evaluate("selectTab('company',document.querySelector('[data-tab=company]'))");
   check('company info shows exactly ten managed entries',await waitFor(browser,"$('companyRows').querySelectorAll('tr').length===10"));
   const adminCompany=await callApi('GET','/admin/company',undefined,adminToken);
   const homeBefore=await callApi('GET','/home',undefined,tokens.founder);
   const adminTitles=adminCompany.payload.items.map(item=>item.title);
   const browserTitles=await evaluate("(()=>Array.from(document.querySelectorAll('#companyRows tr')).map(r=>r.cells[1].querySelector('.cell-value')?.textContent.trim()))()");
   check('company info admin order matches the managed list',adminCompany.status===200&&adminTitles.length===10&&JSON.stringify(browserTitles)===JSON.stringify(adminTitles),{adminTitles,browserTitles});
   check('App reads company info in the same admin order',homeBefore.status===200&&JSON.stringify(homeBefore.payload.companyItems.map(item=>item.title))===JSON.stringify(adminTitles),{appTitles:homeBefore.payload.companyItems.map(item=>item.title)});
   const expectedTitles=[...adminTitles];[expectedTitles[8],expectedTitles[9]]=[expectedTitles[9],expectedTitles[8]];
   await evaluate("(()=>{const buttons=Array.from(document.querySelectorAll('[data-company-up]'));buttons[buttons.length-1].click()})()");
   check('admin reorders company info through the real console',await waitFor(browser,`(()=>{const got=Array.from(document.querySelectorAll('#companyRows tr')).map(r=>r.cells[1].querySelector('.cell-value')?.textContent.trim());return JSON.stringify(got)===${JSON.stringify(JSON.stringify(expectedTitles))}})()`),{expectedTitles});
   const adminCompanyAfter=await callApi('GET','/admin/company',undefined,adminToken);
   const homeAfter=await callApi('GET','/home',undefined,tokens.founder);
   check('admin and App read the reordered company info identically',JSON.stringify(adminCompanyAfter.payload.items.map(item=>item.title))===JSON.stringify(expectedTitles)&&JSON.stringify(homeAfter.payload.companyItems.map(item=>item.title))===JSON.stringify(expectedTitles),{adminTitles:adminCompanyAfter.payload.items.map(item=>item.title),appTitles:homeAfter.payload.companyItems.map(item=>item.title)});
   await evaluate("$('companyTitle').value='Company Notice 11';$('companyBody').value='Eleventh managed entry';$('companyCreate').click()");
   check('eleventh company entry is refused at the ten-item limit',await waitFor(browser,"$('consoleError').textContent.includes('最多10条')")&&await evaluate("$('companyRows').querySelectorAll('tr').length===10"),{error:await evaluate("$('consoleError').textContent")});

   await evaluate("selectTab('notifications',document.querySelector('[data-tab=notifications]'))");
   check('notification management loads real notification rows',await waitFor(browser,"$('notificationRows').querySelectorAll('tr').length>=3"));
   const initialStatus=await evaluate(`(()=>{const rows=Array.from(document.querySelectorAll('#notificationRows tr'));return {withdrawn:rows.filter(r=>r.textContent.includes('已撤回')).length,unread:rows.filter(r=>r.textContent.includes('未读')).length,edgeAction:!!document.querySelector('[data-withdraw-event=${JSON.stringify(contract.notifications.edge.eventId)}]'),closedAction:!!document.querySelector('[data-withdraw-event=${JSON.stringify(contract.notifications.closed.eventId)}]')}})()`);
   check('notification management shows real withdrawn and unread statuses',initialStatus.withdrawn>=1&&initialStatus.unread>=1&&!initialStatus.edgeAction&&initialStatus.closedAction,initialStatus);
   await evaluate(`(()=>{window.prompt=()=>'Browser withdrawal inside window';const row=Array.from(document.querySelectorAll('#notificationRows tr')).find(r=>r.textContent.includes(${JSON.stringify(contract.notifications.pass.title)}));if(!row)throw new Error('pass notification row missing');row.querySelector('[data-withdraw-event]').click()})()`);
   check('browser withdraws a real notification strictly under 180 seconds',await waitFor(browser,"$('consoleOk').textContent.includes('通知已撤回')"),{message:await evaluate("$('consoleOk').textContent")});
   check('withdrawn notification keeps a placeholder and removes its withdraw action',await waitFor(browser,`!document.querySelector('[data-withdraw-event=${JSON.stringify(contract.notifications.pass.eventId)}]')&&Array.from(document.querySelectorAll('#notificationRows tr')).filter(r=>r.textContent.includes('已撤回')).length>=2`));
   await evaluate(`(()=>{window.prompt=()=>'Browser withdrawal outside window';const row=Array.from(document.querySelectorAll('#notificationRows tr')).find(r=>r.textContent.includes(${JSON.stringify(contract.notifications.closed.title)}));if(!row)throw new Error('closed notification row missing');row.querySelector('[data-withdraw-event]').click()})()`);
   check('browser refuses notification withdrawal at or after 180 seconds',await waitFor(browser,"$('consoleError').textContent.includes('不能撤回')||$('consoleError').textContent.includes('已满3分钟')"),{error:await evaluate("$('consoleError').textContent")});
   const closedState=await evaluate(`(()=>{const row=Array.from(document.querySelectorAll('#notificationRows tr')).find(r=>r.textContent.includes(${JSON.stringify(contract.notifications.closed.title)}));return {text:row?row.textContent:'',withdraw:!!document.querySelector('[data-withdraw-event=${JSON.stringify(contract.notifications.closed.eventId)}]')}})()`);
   check('closed-window notification remains unread and withdrawable',closedState.withdraw&&closedState.text.includes('未读'),closedState);
   await evaluate("selectTab('history',document.querySelector('[data-tab=history]'))");
   check('admin task history lists real tasks',await waitFor(browser,"$('historyRows').querySelectorAll('tr').length>=1"),{hint:await evaluate("$('historyHint').textContent")});
   await evaluate("document.querySelector('[data-history-task]').click()");
   check('admin task history opens complete real operation history',await waitFor(browser,"!$('historyDetail').hidden&&$('historyDetail').textContent.includes('操作记录')&&$('historyDetail').textContent.includes('提交申请')"));
   await evaluate("$('historyClose')?.click()");
   await evaluate("(async()=>{state.planDraft=null;await reloadAll();return true})()");
  }
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
 }finally{browser.kill();writeReport();}
}
main().catch(error=>{report.result='FAIL';report.error=error.message;writeReport();console.error(error);process.exitCode=1;});
