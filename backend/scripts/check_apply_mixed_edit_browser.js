'use strict';
const fs=require('fs'),path=require('path');
const {openBrowser,waitFor}=require('./browser_fixture');
const f=JSON.parse(process.env.PANDORA_MIXED_FIXTURE),q=JSON.stringify;
const out=path.resolve(__dirname,'../../output/apply-mixed-edit');fs.mkdirSync(out,{recursive:true});
const report={checks:[]};
function check(name,pass,evidence){report.checks.push({name,pass:!!pass,evidence});console.log((pass?'PASS ':'FAIL ')+name);if(!pass)throw Error(name+' '+JSON.stringify(evidence));}
async function main(){
 if(!f.skipReview){
 const b=await openBrowser(f.base+'/'+encodeURIComponent('潘多拉-交互原型.html'),{width:390,height:844,mobile:true}),ev=b.evaluate;
 try{
  check('login form',await waitFor(b,"!!document.getElementById('backend-login')"));
  await ev(`document.getElementById('login-user').value=${q(f.reviewer)};document.getElementById('login-password').value='Fixture@123456';document.getElementById('backend-login').requestSubmit()`);
  check('reviewer authenticated',await waitFor(b,'Pandora.ready&&Pandora.idle()',20000));
  await ev(`Pandora.openApproval(${q(f.requestId)})`);
  check('approval detail ready',await waitFor(b,"Pandora.idle()&&!!document.querySelector('.p-review-diffs')",20000));
  check('title and progress have original above proposed',await ev("(()=>{const rows=[...document.querySelectorAll('.p-review-diff')];return rows.length>=2&&rows.every(row=>{const before=row.querySelector('.p-review-before'),after=row.querySelector('.p-review-after');return before&&after&&before.compareDocumentPosition(after)&Node.DOCUMENT_POSITION_FOLLOWING})&&rows.some(row=>row.textContent.includes('混合编辑原题')&&row.textContent.includes('混合编辑新题'))&&rows.some(row=>row.textContent.includes('完成首轮'))})()"));
  check('complete snapshots start collapsed',await ev("[...document.querySelectorAll('.p-review-snapshot')].every(x=>!x.open)"));
  for(const width of [320,390,1440]){
   await b.viewport({width,height:width===1440?900:844,mobile:width!==1440});
   check('review diff fits '+width,await ev("document.documentElement.scrollWidth<=innerWidth+1"));
   await b.screenshot(path.join(out,'review-'+width+'.png'));
  }
  check('review actions remain reachable',await ev("!!document.querySelector('[data-action=p-approve-request]')&&!!document.querySelector('[data-action=p-reject-request]')"));
  if(!!f.creationRequestId){
   await ev(`Pandora.openApproval(${q(f.creationRequestId)})`);
   check('creation request has no fabricated old value',await waitFor(b,"Pandora.idle()&&!!document.getElementById('sheetBody')&&!document.querySelector('.p-review-before')&&!document.getElementById('sheetBody').innerText.includes('原值')",20000));
  }
  check('no browser exceptions',b.errors.length===0,b.errors);
 }finally{await b.kill();}
 }
 if(!!f.owner&&!!f.ownerTask){
  const o=await openBrowser(f.base+'/'+encodeURIComponent('潘多拉-交互原型.html'),{width:390,height:844,mobile:true}),oe=o.evaluate;
  try{
   check('owner login form',await waitFor(o,"!!document.getElementById('backend-login')"));
   await oe(`document.getElementById('login-user').value=${q(f.owner)};document.getElementById('login-password').value='Fixture@123456';document.getElementById('backend-login').requestSubmit()`);
   check('owner authenticated',await waitFor(o,'Pandora.ready&&Pandora.idle()',20000));
   await oe(`Pandora.openTask(${q(f.ownerTask)})`);
   check('owner task detail ready',await waitFor(o,"Pandora.idle()&&!document.getElementById('overlay').hidden&&!!document.getElementById('sheetBody')",20000));
   const detail=await oe("(()=>{const text=document.getElementById('sheetBody').innerText;return {edits:document.querySelectorAll('[data-action=edit-task]').length,updates:document.querySelectorAll('[data-action=update-note]').length,adjust:document.querySelectorAll('[data-action=p-adjust-schedule]').length,internal:/当前业务责任方|审核人/.test(text)}})()");
   check('owner detail has one edit entry and no internal reviewer rows',detail.edits===1&&detail.updates===0&&detail.adjust===0&&!detail.internal,detail);
   await oe("document.querySelector('[data-action=edit-task]').click()");
   check('owner unified edit form opens',await waitFor(o,"!!document.getElementById('tf-title')&&Pandora.idle()",20000));
   const form=await oe("({title:!!document.getElementById('tf-title'),progress:!!document.getElementById('tf-progress'),tags:!!document.getElementById('tf-tags'),reason:!!document.getElementById('tf-reason'),assignees:!!document.querySelector('[data-action=pick-assignees]'),title_: (document.getElementById('tf-title')||{}).value,progress_: (document.getElementById('tf-progress')||{}).value})");
   check('owner form projects only allowed fields',form.title&&form.progress&&form.tags&&form.reason&&!form.assignees&&form.title_.length>0&&form.progress_==='',form);
   const originalEnd=await oe("document.getElementById('tf-end-date').value");
   await oe("document.getElementById('tf-title').value='浏览器混合标题';document.getElementById('tf-progress').value='浏览器进展';document.getElementById('tf-end-date').value='2000-01-01';document.querySelector('[data-action=save-task]').click()");
   check('invalid owner edit stays in the form',await waitFor(o,"!!document.getElementById('tf-error')&&!document.getElementById('tf-error').hidden&&Pandora.idle()",20000));
   const draft=await oe("({title:document.getElementById('tf-title').value,progress:document.getElementById('tf-progress').value,open:!document.getElementById('overlay').hidden})");
   check('owner draft survives the failed submission',draft.title==='浏览器混合标题'&&draft.progress==='浏览器进展'&&draft.open,draft);
   for(const width of [320,390,1440]){
    await o.viewport({width,height:width===1440?900:844,mobile:width!==1440});
    check('owner form layout fits '+width,(await oe("document.documentElement.scrollWidth<=innerWidth+1"))&&(await oe("!!document.getElementById('tf-title')&&!!document.getElementById('tf-reason')")));
    await o.screenshot(path.join(out,'owner-'+width+'.png'));
   }
   await oe(`document.getElementById('tf-reason').value='浏览器混合编辑原因';document.getElementById('tf-end-date').value=${q(originalEnd)};document.querySelector('[data-action=save-task]').click()`);
   check('owner mixed edit submits and closes the form',await waitFor(o,"document.getElementById('overlay').hidden&&Pandora.idle()",20000));
   const notice=await oe("document.getElementById('appNotice').textContent");
   check('owner submit shows the saved current reviewer',notice.includes('当前审核人')&&!notice.includes('业务责任方'),notice);
   check('owner browser has no exceptions',o.errors.length===0,o.errors);
  }finally{await o.kill();}
 }
 fs.writeFileSync(path.join(out,'browser-report.json'),JSON.stringify(report,null,2));
}
main().catch(error=>{console.error(error);process.exitCode=1});
