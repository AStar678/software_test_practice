'use strict';
const fs=require('fs'),path=require('path');
const {openBrowser,waitFor}=require('./browser_fixture');
const f=JSON.parse(process.env.PANDORA_NOTIFICATION_FIXTURE),q=JSON.stringify;
const out=path.resolve(__dirname,'../../output/apply-notifications');fs.mkdirSync(out,{recursive:true});
const report={checks:[]};
function check(name,pass,evidence){report.checks.push({name,pass:!!pass,evidence});console.log((pass?'PASS ':'FAIL ')+name);if(!pass)throw Error(name+' '+JSON.stringify(evidence));}
async function main(){
 const b=await openBrowser(f.base+'/'+encodeURIComponent('潘多拉-交互原型.html'),{width:390,height:844,mobile:true}),ev=b.evaluate;
 async function ready(){return waitFor(b,'Pandora.ready&&Pandora.idle()',20000);}
 async function list(){await ev('openNotifications()');return waitFor(b,"Pandora.idle()&&document.getElementById('sheetTitle').textContent==='通知'",20000);}
 async function detail(id){await ev(`document.querySelector('[data-action=open-notif][data-id=${q(id)}]').click()`);return waitFor(b,"Pandora.idle()&&document.getElementById('sheetTitle').textContent==='通知详情'",20000);}
 async function more(){await ev("document.querySelector('.p-notice-more summary').click()");return waitFor(b,"!!document.querySelector('.p-notice-more[open]')");}
 try{
  check('login form',await waitFor(b,"!!document.getElementById('backend-login')"));
  await ev(`document.getElementById('login-user').value=${q(f.employee)};document.getElementById('login-password').value='Fixture@123456';document.getElementById('backend-login').requestSubmit()`);
  check('employee authenticated',await ready());
  check('notification list opens',await list());
  const compact=await ev("({filters:!!document.querySelector('.p-notice-filters'),summaries:document.querySelectorAll('.p-notice-row .nsummary').length,rows:document.querySelectorAll('.p-notice-row').length})");
  check('compact list keeps only name, type, read state and time',compact.filters&&compact.summaries===0&&compact.rows>0,compact);
  await ev("document.getElementById('pn-category').value='reminder';document.getElementById('pn-category').dispatchEvent(new Event('change',{bubbles:true}))");
  check('reminder filter shows the real reminder set',await waitFor(b,`document.querySelectorAll('[data-action=open-notif]').length===${f.reminderCount}`));
  await ev("document.getElementById('pn-mode').value='full';document.getElementById('pn-mode').dispatchEvent(new Event('change',{bubbles:true}))");
  check('full mode exposes summaries without changing the filter',await waitFor(b,"document.querySelectorAll('.p-notice-row .nsummary').length>0&&document.getElementById('pn-category').value==='reminder'"));
  await ev("document.getElementById('pn-category').value='all';document.getElementById('pn-category').dispatchEvent(new Event('change',{bubbles:true}))");
  check('result notification detail opens',await detail(f.resultNoticeId));
  const initial=await ev("(()=>{const body=document.getElementById('sheetBody');const text=body.innerText;const primary=document.querySelectorAll('#sheetFoot .btn.primary');return {heading:body.querySelector('h2')?.textContent,changes:body.querySelectorAll('.p-notice-changes>div').length,titleCount:text.split("+q(f.resultTitle)+").length-1,timeCount:text.split('通知时间').length-1,primary:primary.length,primaryText:primary[0]?.textContent,more:!!body.querySelector('.p-notice-more'),moreFocusable:body.querySelector('.p-notice-more summary')?.tagName==='SUMMARY'&&body.querySelector('.p-notice-more summary').tabIndex>=0}})()");
  check('result first and changes are in the main detail area',initial.heading==='已通过并生效'&&initial.changes>=2,initial);
  check('object name and notification time appear once',initial.titleCount===1&&initial.timeCount===1,initial);
  check('one primary action is present',initial.primary===1&&!!initial.primaryText,initial);
  check('more menu is present and keyboard focusable',initial.more&&initial.moreFocusable,initial);
  check('more menu opens',await more());
  check('more menu exposes message deletion',await ev("!!document.querySelector('[data-action=p-hide-notification]')"));
  for(const width of [320,390,1440]){
   await b.viewport({width,height:width===1440?900:844,mobile:width!==1440});
   check('detail fits '+width,await ev("document.documentElement.scrollWidth<=innerWidth+1&&!!document.querySelector('.p-notice-changes')&&!!document.querySelector('#sheetFoot .btn.primary')"));
   await b.screenshot(path.join(out,'detail-'+width+'.png'));
  }
  await ev("document.getElementById('sheetBack').click()");await waitFor(b,"document.getElementById('sheetTitle').textContent==='通知'");
  check('reminder detail opens for deletion',await detail(f.reminderNoticeId));
  check('reminder deletion more menu opens',await more());
  await ev("window.confirm=()=>true;document.querySelector('[data-action=p-hide-notification]').click()");
  check('deleting a message returns to the filtered list',await waitFor(b,"document.getElementById('sheetTitle').textContent==='通知'&&Pandora.idle()",20000));
  check('deleted reminder is absent from the list',await ev(`!document.querySelector('[data-action=open-notif][data-id=${q(f.reminderNoticeId)}]')`));
  check('withdrawable notification opens',await detail(f.withdrawNoticeId));
  check('notification withdrawal menu opens',await more());
  check('more menu exposes notification withdrawal for its initiator',await ev("!!document.querySelector('[data-action=p-withdraw-notification]')"));
  await ev("window.confirm=()=>true;document.querySelector('[data-action=p-withdraw-notification]').click()");
  check('withdrawn notification returns to the list',await waitFor(b,"document.getElementById('sheetTitle').textContent==='通知'&&Pandora.idle()",20000));
  const withdrawn=await ev(`Pandora.request(${q('/notifications/'+f.withdrawNoticeId)})`);
  check('withdrawn notification detail is read-only and has no result',withdrawn.revoked===true&&withdrawn.eventResult===null,withdrawn);
  check('pending creation notification opens',await detail(f.pendingNoticeId));
  check('pending applicant notification shows the request withdrawal action',await more());
  check('request withdrawal action is distinct from notification withdrawal',await ev("!!document.querySelector('[data-action=p-withdraw-notification-request]')&&!!document.querySelector('[data-action=p-withdraw-notification]')&&document.querySelector('[data-action=p-withdraw-notification-request]').textContent.includes('撤销本人申请')"));
  await ev("window.confirm=()=>true;document.querySelector('[data-action=p-withdraw-notification-request]').click()");
  check('request withdrawal returns to the list',await waitFor(b,"document.getElementById('sheetTitle').textContent==='通知'&&Pandora.idle()",20000));
  const request=await ev(`Pandora.request(${q('/approval-requests/'+f.pendingRequestId)})`);
  check('request withdrawal changed the business request status',request.status==='withdrawn',request);
  check('no browser exceptions',b.errors.length===0,b.errors);
  report.result='PASS';
 }catch(error){report.result='FAIL';report.error=error.message;throw error;}
 finally{fs.writeFileSync(path.join(out,'browser-report.json'),JSON.stringify(report,null,2));await b.kill();}
}
main().catch(error=>{console.error(error);process.exitCode=1});
