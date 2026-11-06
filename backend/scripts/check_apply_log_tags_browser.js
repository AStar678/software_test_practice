'use strict';
/* Shared ordered tag picker in the real work-log create / edit forms. */
const fs=require('fs'),path=require('path');
const {openBrowser,waitFor,sleep}=require('./browser_fixture');
const f=JSON.parse(process.env.PANDORA_LOG_TAG_FIXTURE),q=JSON.stringify,js=JSON.stringify;
const out=path.resolve(__dirname,'../../output/apply-log-tags');fs.mkdirSync(out,{recursive:true});
const report={checks:[]};
function check(name,pass,evidence){report.checks.push({name,pass:!!pass,evidence});console.log((pass?'PASS ':'FAIL ')+name);if(!pass)throw Error(name+' '+JSON.stringify(evidence));}
async function main(){
 const b=await openBrowser(f.base+'/'+encodeURIComponent('潘多拉-交互原型.html'),{width:1440,height:900,mobile:false}),ev=b.evaluate;
 async function login(who){
  check('login form ready',await waitFor(b,"!!document.getElementById('login-user')"));
  await ev(`document.getElementById('login-user').value=${q(f.identities[who].identifier)};document.getElementById('login-password').value='Fixture@123456';document.getElementById('backend-login').requestSubmit()`);
  check('authenticated '+who,await waitFor(b,'Pandora.ready&&Pandora.idle()',20000));
 }
 async function pickerOrder(){
  return ev(`[...document.querySelectorAll('#lf-tags [data-action="p-task-tag"]')].map(b=>({id:b.dataset.id,pressed:b.getAttribute('aria-pressed'),deleted:b.dataset.deleted||'',disabled:b.disabled}))`);
 }
 try{
  await login('founder');
  await ev('openLogForm(null)');
  check('log create form exposes the shared tag picker',await waitFor(b,"!document.getElementById('overlay').hidden&&document.getElementById('sheetTitle').textContent==='写日志'&&!!document.getElementById('lf-tags')&&Pandora.idle()",20000));
  check('log create form keeps its own date field',await ev("!!document.getElementById('lf-date')&&document.getElementById('lf-date').tagName==='SELECT'&&!document.getElementById('lf-date').getAttribute('aria-readonly')"));
  const a=f.tags[0],second=f.tags[1],c=f.tags[2];
  await ev(`document.querySelector('#lf-tags [data-id="${a}"]').click();document.querySelector('#lf-tags [data-id="${second}"]').click();document.querySelector('#lf-tags [data-id="${a}"]').click();document.querySelector('#lf-tags [data-id="${c}"]').click();document.querySelector('#lf-tags [data-id="${a}"]').click()`);
  check('cancel then re-select appends at the new position',await ev(`JSON.stringify(drafts.log.tagIds)===${js(JSON.stringify([second,c,a]))}`),await ev('drafts.log.tagIds'));
  const pressedOrder=await pickerOrder();
  check('log picker keeps aria-pressed in sync',pressedOrder.filter(t=>t.pressed==='true').map(t=>t.id).sort().join(',')===[second,c,a].sort().join(','),pressedOrder);
  await ev(`document.querySelector('#lf-tags [data-id="${second}"]').focus()`);
  await b.send('Input.dispatchKeyEvent',{type:'keyDown',key:'Enter',code:'Enter',windowsVirtualKeyCode:13,nativeVirtualKeyCode:13,text:'\r'});
  await b.send('Input.dispatchKeyEvent',{type:'keyUp',key:'Enter',code:'Enter',windowsVirtualKeyCode:13});
  check('log tag keeps keyboard toggle state',await ev(`!drafts.log.tagIds.includes(${js(second)})&&document.querySelector('#lf-tags [data-id="${second}"]').getAttribute('aria-pressed')==='false'`),await ev('({tags:drafts.log.tagIds,focus:document.activeElement.dataset.id})'));
  await ev(`document.querySelector('#lf-tags [data-id="${second}"]').click()`);
  for(const width of [320,390,1440]){
   await b.viewport({width,height:width===1440?900:844,mobile:width!==1440});
   await ev("document.getElementById('lf-tags').scrollIntoView({block:'center'})");
   const geometry=await ev("(()=>{const body=document.getElementById('sheetBody');const tags=document.querySelector('#lf-tags');return {body:body.clientWidth,scroll:body.scrollWidth,tagsRight:tags.getBoundingClientRect().right,width:innerWidth}})()");
   check('log tag picker fits '+width,geometry.scroll<=geometry.body+1&&geometry.tagsRight<=geometry.width+1,geometry);
   await b.screenshot(path.join(out,'log-tags-'+width+'.png'));
  }
  await b.viewport({width:1440,height:900,mobile:false});
  await ev("document.getElementById('lf-content').value='嵌套返回草稿';document.querySelector('[data-action=pick-log-task]').click()");
  check('nested task picker opens over the log form',await waitFor(b,"document.getElementById('sheetTitle').textContent==='选择关联任务'&&Pandora.idle()"));
  await ev(`document.querySelector('[data-pick-task="${f.task}"]').click();document.querySelector('[data-action=picker-task-confirm]').click()`);
  check('nested return keeps the ordered tags and body draft',await waitFor(b,"document.getElementById('sheetTitle').textContent==='写日志'&&!!document.getElementById('lf-tags')")&&await ev(`JSON.stringify(drafts.log.tagIds)===${js(JSON.stringify([c,a,second]))}&&document.getElementById('lf-content').value==='嵌套返回草稿'&&drafts.log.taskId===${js(f.task)}`),await ev('({tags:drafts.log.tagIds,task:drafts.log.taskId,body:document.getElementById("lf-content").value})'));
  await ev("document.getElementById('lf-content').value='';document.querySelector('[data-action=save-log]').click()");
  check('failed save keeps the tag draft and the form',await waitFor(b,"Pandora.idle()&&!document.getElementById('lf-error').hidden",20000)&&await ev(`!document.getElementById('overlay').hidden&&JSON.stringify(drafts.log.tagIds)===${js(JSON.stringify([c,a,second]))}`),await ev("({title:document.getElementById('sheetTitle').textContent,error:document.getElementById('lf-error').textContent,tags:drafts.log.tagIds})"));
  await ev("document.getElementById('lf-content').value='日志多选保存';document.querySelector('[data-action=save-log]').click()");
  check('log saved with the selected order',await waitFor(b,"Pandora.idle()&&document.getElementById('overlay').hidden",20000));
  const listed=await ev("Pandora.request('/work-logs?scope=self&limit=5')");
  const saved=(listed.items||[]).find(item=>item.body==='日志多选保存');
  check('saved log reads back the ordered collection',!!saved&&JSON.stringify(saved.tagIds)===js([c,a,second]),saved&&saved.tagIds);
  await ev(`openLogDetail(${js(saved.id)})`);
  const expectedPills=[c,a,second].map(id=>f.tagNames[id]);
  check('log detail shows every selected tag in order',await waitFor(b,"!document.getElementById('overlay').hidden&&document.getElementById('sheetTitle').textContent==='日志详情'&&Pandora.idle()",20000)&&await ev(`JSON.stringify([...document.querySelectorAll('#sheetBody .p-tag-pill')].map(p=>p.textContent))===${js(JSON.stringify(expectedPills))}`),await ev("[...document.querySelectorAll('#sheetBody .p-tag-pill')].map(p=>p.textContent)"));
  await ev('closeSheet()');
  /* A deleted but retained reference must stay visible, removable and non-re-addable in the edit form. */
  await ev('Pandora.logout()');
  check('employee login form ready',await waitFor(b,"!!document.getElementById('login-user')"));
  await login('alpha-one-employee');
  await ev(`openLogDetail(${js(f.logId)})`);
  check('employee log detail keeps the deleted snapshot',await waitFor(b,"!document.getElementById('overlay').hidden&&Pandora.idle()",20000)&&await ev("!!document.querySelector('#sheetBody .p-tag-pill.is-deleted')&&document.getElementById('sheetBody').textContent.includes('（已删除）')"));
  await ev("document.querySelector('[data-action=edit-log]').click()");
  check('log edit form reuses the shared picker',await waitFor(b,"document.getElementById('sheetTitle').textContent==='编辑日志'&&!!document.getElementById('lf-tags')&&Pandora.idle()",20000));
  check('log edit keeps the date read-only beside the tags',await ev("document.getElementById('lf-date').getAttribute('aria-readonly')==='true'&&!!document.getElementById('lf-tags')"));
  check('retained deleted tag starts selected',await ev(`!!document.querySelector('#lf-tags [data-id="${f.deletedTag}"][aria-pressed="true"][data-deleted="true"]')`));
  await ev(`document.querySelector('#lf-tags [data-id="${f.deletedTag}"]').click()`);
  check('removing the deleted reference disables re-selection',await ev(`!drafts.log.tagIds.includes(${js(f.deletedTag)})&&document.querySelector('#lf-tags [data-id="${f.deletedTag}"]').disabled`));
  for(const width of [320,390]){
   await b.viewport({width,height:844,mobile:true});
   const fits=await ev("(()=>{const body=document.getElementById('sheetBody');return {body:body.clientWidth,scroll:body.scrollWidth}})()");
   check('log edit tag picker fits '+width,fits.scroll<=fits.body+1,fits);
   await b.screenshot(path.join(out,'log-edit-'+width+'.png'));
  }
  check('no browser exceptions',b.errors.length===0,b.errors);
 }finally{fs.writeFileSync(path.join(out,'browser-report.json'),JSON.stringify(report,null,2));await b.kill();}
}
main().then(()=>process.exit(0)).catch(e=>{console.error(e&&e.stack||e);process.exit(1)});
