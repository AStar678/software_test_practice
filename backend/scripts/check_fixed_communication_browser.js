#!/usr/bin/env node
'use strict';
const fs=require('fs'),path=require('path'),crypto=require('crypto');
const {openBrowser,waitFor}=require('./browser_fixture');
const fixture=JSON.parse(process.env.PANDORA_BROWSER_FIXTURE),ids=fixture.identities;
const output=path.resolve(__dirname,'../../audit/refactor-pandora-organization-and-workflows/communication-browser.json');
const report={updated:new Date().toISOString(),checks:[]};
const js=JSON.stringify;
function check(name,pass,evidence){report.checks.push({check:name,pass:!!pass,evidence});console.log((pass?'PASS ':'FAIL ')+name);if(!pass)throw new Error(name+' '+JSON.stringify(evidence));}
async function main(){
 const b=await openBrowser(fixture.base+'/'),ev=b.evaluate;
 async function login(key){
  check('login form ready '+key,await waitFor(b,"!!document.getElementById('backend-login')&&Pandora.idle()"));
  await ev(`document.getElementById('login-user').value=${js(ids[key].identifier)};document.getElementById('login-password').value='Fixture@123456';document.getElementById('backend-login').requestSubmit()`);
  check('real phone session '+key,await waitFor(b,`Pandora.ready&&Pandora.idle()&&Pandora.data.me.id===${js(ids[key].id)}`,20000));
 }
 async function close(){await ev("document.getElementById('sheetClose').click()");await waitFor(b,"document.getElementById('overlay').hidden");}
 async function api(method,p,body,version){return ev(`Pandora.request(${js(p)},{method:${js(method)},body:${js(body||null)},headers:${js({...(['GET'].includes(method)?{}:{'Idempotency-Key':crypto.randomUUID()}),...(version?{'If-Match':'"'+version+'"'}:{})})}})`);}
 async function founderApi(method,p,body,version){
  const session=await fetch(fixture.base+'/api/v1/auth/sessions',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({accountType:'employee',phone:ids.founder.identifier,password:'Fixture@123456'})}).then(r=>r.json());
  const response=await fetch(fixture.base+'/api/v1'+p,{method,headers:{'Content-Type':'application/json',Authorization:'Bearer '+session.token,'Idempotency-Key':crypto.randomUUID(),...(version?{'If-Match':'"'+version+'"'}:{})},...(body?{body:JSON.stringify(body)}:{})});
  if(!response.ok)throw new Error('fixture API '+p+' '+response.status);return response.json();
 }
 try{
  await login('founder');
  await ev("setPage('me');document.querySelector('[data-action=p-manage-tags]').click()");
  check('founder can open real catalogue management',await waitFor(b,"!!document.getElementById('p-tag-name')"));
  await ev("document.getElementById('p-tag-name').value='Browser shared tag';document.querySelectorAll('[data-action=p-tag-color]')[1].click();document.querySelector('[data-action=p-tag-create]').click()");
  check('tag create persists from UI',await waitFor(b,"Pandora.idle()&&Pandora.data.tags.items.some(t=>t.name==='Browser shared tag')"));
  const tag=await ev("Pandora.data.tags.items.find(t=>t.name==='Browser shared tag')");
  await ev(`Pandora.tagsUi.manage();document.querySelector('[data-action=p-tag-edit][data-id="${tag.id}"]').click();document.getElementById('p-tag-name').value='Browser renamed tag';document.querySelector('[data-action=p-tag-save]').click()`);
  check('tag rename and selected color persist',await waitFor(b,`Pandora.idle()&&Pandora.data.tags.items.some(t=>t.id===${js(tag.id)}&&t.name==='Browser renamed tag'&&t.color===${js(tag.color)})`));
  const task=await api('GET','/tasks/'+fixture.taskId);
  await api('PATCH','/tasks/'+fixture.taskId,{command:'change',tagId:tag.id,reason:'Browser tag reference'},task.rowVersion);
  await ev(`Pandora.tagsUi.manage();document.querySelector('[data-action=p-tag-delete][data-id="${tag.id}"]').click()`);
  check('logical delete removes selectable catalogue entry',await waitFor(b,`Pandora.idle()&&!Pandora.data.tags.items.some(t=>t.id===${js(tag.id)})`));
  await ev(`openTaskDetail(${js(fixture.taskId)})`);
  check('task detail retains deleted tag name and marker',await waitFor(b,"document.getElementById('sheetBody').textContent.includes('Browser renamed tag')&&document.getElementById('sheetBody').textContent.includes('已删除')&&!!document.getElementById('p-comment-input')"));
  await ev("document.getElementById('p-comment-input').value='Browser comment secret';document.querySelector('[data-action=p-comment-submit]').click()");
  check('real comment submit renders author controls',await waitFor(b,"Pandora.idle()&&!!document.querySelector('.p-comment [data-action=p-comment-edit]')&&document.querySelector('.p-comment-list').textContent.includes('Browser comment secret')"));
  const comment=await ev("document.querySelector('.p-comment').dataset.commentId");
  await ev("document.querySelector('[data-action=p-comment-edit]').click();document.querySelector('[data-comment-edit]').value='Browser edited secret';document.querySelector('[data-action=p-comment-save]').click()");
  check('comment edit preserves author controls and edited state',await waitFor(b,"Pandora.idle()&&document.querySelector('.p-comment-list').textContent.includes('Browser edited secret')&&document.querySelector('.p-comment-list').textContent.includes('已编辑')"));
  await b.screenshot(output.replace('.json','-author.png'));
  // A second comment exercises the actual delete control without deleting the revocation fixture.
  await ev("document.getElementById('p-comment-input').value='Delete this browser comment';document.querySelector('[data-action=p-comment-submit]').click()");
  check('second independent comment appears',await waitFor(b,"Pandora.idle()&&document.querySelectorAll('.p-comment').length===2"));
  await ev("document.querySelectorAll('[data-action=p-comment-delete]')[1].click()");
  check('comment delete removes its body from the actual detail',await waitFor(b,"Pandora.idle()&&document.querySelectorAll('.p-comment').length===1&&!document.querySelector('.p-comment-list').textContent.includes('Delete this browser comment')"));
  await close();await ev('Pandora.logout()');await login('alpha-one-employee');
  await ev("setPage('me')");check('ordinary employee has no catalogue management entry',await ev("!document.querySelector('[data-action=p-manage-tags]')"));
  await ev(`openTaskDetail(${js(fixture.taskId)})`);
  check('recipient can read but cannot edit another author comment',await waitFor(b,"document.querySelector('.p-comment-list')&&document.querySelector('.p-comment-list').textContent.includes('Browser edited secret')&&!document.querySelector('[data-action=p-comment-edit]')"));
  await close();
  // Drain deterministic delivery through the administrator API (not a browser UI action).
  const adminSession=await fetch(fixture.base+'/api/v1/auth/sessions',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({accountType:'admin',accountName:ids.admin.identifier,password:'Fixture@123456'})}).then(r=>r.json());
  await fetch(fixture.base+'/api/v1/admin/worker/run-once',{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+adminSession.token},body:'{}'});
  const notices=await api('GET','/notifications?limit=100');
  const notice=notices.items.find(n=>n.commentId===comment),ordinary=notices.items.find(n=>n.taskId===fixture.taskId&&n.eventType!=='comment.created');
  check('targeted comment and ordinary task notifications delivered',!!notice&&!!ordinary);
  await ev('openNotifications()');
  check('notification list uses header close without footer actions',await waitFor(b,"Pandora.idle()&&document.getElementById('sheetTitle').textContent==='通知'&&document.getElementById('sheetFoot').children.length===0"));
  await ev(`document.querySelector('[data-action=open-notif][data-id="${notice.id}"]').click()`);
  check('comment notification offers a live comment focus jump',await waitFor(b,"Pandora.idle()&&!!document.querySelector('[data-action=p-open-notification-object]')"));
  await ev("document.querySelector('[data-action=p-open-notification-object]').click()");
  check('notification jump opens the correct object comment section',await waitFor(b,`!!document.querySelector('.p-comments[data-object-id="${fixture.taskId}"]')&&document.querySelector('.p-comment-list').textContent.includes('Browser edited secret')`));
  await close();
  const current=await founderApi('GET','/tasks/'+fixture.taskId);
  await founderApi('PATCH','/tasks/'+fixture.taskId,{command:'change',assigneeIds:[ids['beta-one-employee'].id],reason:'Revoke browser relation'},current.rowVersion);
  await ev('openNotifications()');await waitFor(b,"Pandora.idle()&&document.getElementById('sheetTitle').textContent==='通知'");
  await ev(`document.querySelector('[data-action=open-notif][data-id="${notice.id}"]').click()`);
  check('revoked comment UI cannot recover excerpt or any task/comment jump',await waitFor(b,"Pandora.idle()&&document.getElementById('sheetTitle').textContent==='通知详情'&&!document.querySelector('[data-action=p-open-notification-object],[data-action=p-open-notification-task],[data-action=p-open-historical-task]')&&!document.getElementById('sheetBody').textContent.includes('Browser comment secret')&&!document.getElementById('sheetBody').textContent.includes('Browser edited secret')"));
  await b.screenshot(output.replace('.json','-redacted.png'));
  await close();await ev('openNotifications()');await waitFor(b,"Pandora.idle()&&document.getElementById('sheetTitle').textContent==='通知'");
  await ev(`document.querySelector('[data-action=open-notif][data-id="${ordinary.id}"]').click()`);
  check('ordinary task notification preserves historical-only button',await waitFor(b,"Pandora.idle()&&!!document.querySelector('[data-action=p-open-historical-task]')"));
  await ev("document.querySelector('[data-action=p-open-historical-task]').click()");
  check('historical task UI is read only without comment/approval/edit controls',await waitFor(b,"Pandora.idle()&&document.getElementById('sheetTitle').textContent==='历史只读详情'&&!document.querySelector('.p-comments,[data-action=p-open-approval],[data-action=edit-task]')"));
  await b.screenshot(output.replace('.json','-historical.png'));
  check('communication UI has no runtime exceptions',b.errors.length===0,b.errors);
  report.result='PASS';
 }catch(error){report.result='FAIL';report.error=error.message;throw error;}
 finally{fs.writeFileSync(output,JSON.stringify(report,null,2)+'\n');b.kill();}
}
main().catch(error=>{console.error(error);process.exitCode=1;});
