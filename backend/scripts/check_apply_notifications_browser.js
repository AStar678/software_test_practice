'use strict';
const fs=require('fs'),path=require('path');
const {openBrowser,waitFor,sleep}=require('./browser_fixture');
const f=JSON.parse(process.env.PANDORA_NOTIFICATION_FIXTURE),q=JSON.stringify;
const out=path.resolve(__dirname,'../../output/apply-notifications');fs.mkdirSync(out,{recursive:true});
const report={checks:[]};
function check(name,pass,evidence){report.checks.push({name,pass:!!pass,evidence});console.log((pass?'PASS ':'FAIL ')+name);if(!pass)throw Error(name+' '+JSON.stringify(evidence));}
async function main(){
 const b=await openBrowser(f.base+'/'+encodeURIComponent('潘多拉-交互原型.html'),{width:390,height:844,mobile:true}),ev=b.evaluate;
 async function ready(){return waitFor(b,'Pandora.ready&&Pandora.idle()',20000);}
 async function list(){await ev('openNotifications()');return waitFor(b,"document.getElementById('sheetTitle').textContent==='通知'&&!!document.getElementById('p-notice-content')&&document.querySelectorAll('.p-notice-row').length>0",20000);}
 async function detail(id){
  const visible=await ev(`!!document.querySelector('[data-action=open-notif][data-id=${q(id)}]')`);
  if(visible)await ev(`document.querySelector('[data-action=open-notif][data-id=${q(id)}]').click()`);
  else await ev(`openNotif(${q(id)})`);
  return waitFor(b,"Pandora.idle()&&document.getElementById('sheetTitle').textContent==='通知详情'",20000);
 }
 async function more(){await ev("document.querySelector('.p-notice-more summary').click()");return waitFor(b,"!!document.querySelector('.p-notice-more[open]')");}
 try{
  check('login form',await waitFor(b,"!!document.getElementById('backend-login')"));
  await ev(`document.getElementById('login-user').value=${q(f.employee)};document.getElementById('login-password').value='Fixture@123456';document.getElementById('backend-login').requestSubmit()`);
  check('employee authenticated',await ready());
  check('notification list opens',await list());
  const compact=await ev("({filters:!!document.querySelector('.p-notice-filters'),sticky:getComputedStyle(document.querySelector('.p-notice-filters')).position,summaries:document.querySelectorAll('.p-notice-row .nsummary').length,rows:document.querySelectorAll('.p-notice-row').length,tabs:document.querySelectorAll('.p-notice-tab').length,reads:document.querySelectorAll('.p-notice-read-btn').length,mode:!!document.querySelector('[data-action=p-notice-mode]'),reset:!!document.querySelector('[data-action=p-notice-reset]')})");
  check('compact list keeps only name, type, read state and time',compact.filters&&compact.sticky==='sticky'&&compact.summaries===0&&compact.rows>0&&compact.tabs===6&&compact.reads===3&&compact.mode&&!compact.reset,compact);
  const beforeSwitch=await ev("document.querySelector('.p-notice-summary').innerText");
  await ev("document.querySelector('[data-action=p-notice-category][data-value=reminder]').click()");
  check('reminder filter shows the real reminder set',await waitFor(b,`document.querySelectorAll('[data-action=open-notif]').length===${f.reminderCount}`));
  check('switching the type does not change the independent global unread count',await ev("document.querySelector('.p-notice-summary').innerText.split('全部未读')[1]==="+q(beforeSwitch.split('全部未读')[1])));
  check('a non-default condition exposes reset',await ev("!!document.querySelector('[data-action=p-notice-reset]')"));
  await ev("document.querySelector('[data-action=p-notice-mode]').click()");
  check('full mode exposes summaries without changing the filter',await waitFor(b,"document.querySelectorAll('.p-notice-row .nsummary').length>0&&document.querySelector('[data-action=p-notice-category][data-value=reminder]').getAttribute('aria-selected')==='true'"));
  await ev("document.querySelector('[data-action=p-notice-reset]').click()");
  check('reset clears type and read conditions but keeps the display mode',await waitFor(b,"document.querySelector('[data-action=p-notice-category][data-value=all]').getAttribute('aria-selected')==='true'&&!document.querySelector('[data-action=p-notice-reset]')&&document.querySelectorAll('.p-notice-row .nsummary').length>0"));
  await ev("document.querySelector('[data-action=p-notice-mode]').click()");
  check('single icon toggles back to compact without re-reading',await waitFor(b,"document.querySelectorAll('.p-notice-row .nsummary').length===0"));
  /* 7.3 打开后才标读，未读集合退出已读消息，返回保留条件与有效位置。 */
  await ev("document.querySelector('[data-action=p-notice-read][data-value=unread]').click()");
  check('unread segment filters before paging',await waitFor(b,"document.querySelector('[data-action=p-notice-read][data-value=unread]').getAttribute('aria-pressed')==='true'&&document.querySelectorAll('.p-notice-row').length>0"));
  const unreadRow=await ev("(()=>{const row=document.querySelector('.p-notice-row');return {id:row.dataset.id,name:row.querySelector('.ntitle').textContent}})()");
  await ev(`document.querySelector('[data-action=open-notif][data-id=${q(unreadRow.id)}]').click()`);
  check('opening an unread row marks only that message read',await waitFor(b,"Pandora.idle()&&document.getElementById('sheetTitle').textContent==='通知详情'",20000));
  await ev("document.getElementById('sheetBack').click()");
  check('return keeps the unread condition and the opened row leaves the unread set',await waitFor(b,`document.getElementById('sheetTitle').textContent==='通知'&&document.querySelector('[data-action=p-notice-read][data-value=unread]').getAttribute('aria-pressed')==='true'&&!document.querySelector('[data-action=open-notif][data-id=${q(unreadRow.id)}]')`));
  {
    const api=await ev(`Pandora.request('/notifications?limit=1').then(r=>({unread:r.unreadCount}))`);
    check('the independent global unread count reflects the read action',(await ev("document.querySelector('.p-notice-summary').innerText")).includes('全部未读 '+api.unread+' 条'),api);
  }
  await ev("document.querySelector('[data-action=p-notice-reset]').click()");
  check('reset restores the full list after the unread check',await waitFor(b,"document.querySelector('[data-action=p-notice-category][data-value=all]').getAttribute('aria-selected')==='true'"));
  /* 7.4 快速切换条件时，迟到的旧页不得并入当前结果。 */
  await ev("closeSheet()");
  await ev("window.__noticeDelay=true;window.__noticeReal=Pandora.request;Pandora.request=function(path,opts){const real=window.__noticeReal;if(window.__noticeDelay&&String(path).startsWith('/notifications?')){window.__noticeDelay=false;return new Promise((resolve,reject)=>setTimeout(()=>real.call(Pandora,path,opts).then(resolve,reject),900));}return real.call(Pandora,path,opts);}");
  await ev("openNotifications()");
  await ev("document.querySelector('[data-action=p-notice-category][data-value=result]').click()");
  check('rapid switch keeps the newest query result only',await waitFor(b,"document.querySelector('[data-action=p-notice-category][data-value=result]').getAttribute('aria-selected')==='true'&&document.querySelectorAll('.p-notice-row').length>0",20000));
  await sleep(1200);
  check('a late first-page response does not mix into the result filter',await ev("document.querySelector('[data-action=p-notice-category][data-value=result]').getAttribute('aria-selected')==='true'&&[...document.querySelectorAll('.p-notice-row .npurpose')].every(node=>node.textContent==='结果告知')"));
  await ev("Pandora.request=window.__noticeReal;window.__noticeReal=null;");
  /* 7.4 失败可重试且不误改全局计数。 */
  await ev("closeSheet()");
  await ev("window.__noticeFail=true;window.__noticeReal2=Pandora.request;Pandora.request=function(path,opts){const real=window.__noticeReal2;if(window.__noticeFail&&String(path).startsWith('/notifications?')){window.__noticeFail=false;return Promise.reject(new Error('模拟通知读取失败'));}return real.call(Pandora,path,opts);}");
  await ev("openNotifications()");
  check('a failed notification query offers retry',await waitFor(b,"!!document.querySelector('[data-action=p-notice-retry]')",20000));
  const failedUnread=await ev("document.querySelector('.p-notice-summary').innerText");
  await ev("document.querySelector('[data-action=p-notice-retry]').click()");
  check('retry loads the list without corrupting the global unread count',await waitFor(b,"document.querySelectorAll('.p-notice-row').length>0",20000));
  check('failed query kept the previous independent unread count',(await ev("document.querySelector('.p-notice-summary').innerText")).split('全部未读')[1]===failedUnread.split('全部未读')[1]);
  await ev("Pandora.request=window.__noticeReal2;window.__noticeReal2=null;");
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
  check('applicant sees the authorized original-request action',initial.primaryText.includes('查看原申请'),initial.primaryText);
  await ev("document.querySelector('#sheetFoot [data-action=p-open-approval]').click()");
  check('original request opens from the notification',await waitFor(b,"document.getElementById('sheetTitle').textContent!=='通知详情'&&document.getElementById('sheetBody').innerText.includes('申请人')&&Pandora.idle()",20000));
  check('original request keeps the applicant projection without the reviewer diff',await ev("!document.querySelector('.p-review-diffs')&&document.getElementById('sheetBody').innerText.includes('申请人')"));
  await ev("document.getElementById('sheetBack').click()");
  check('returns to the same notification detail',await waitFor(b,"document.getElementById('sheetTitle').textContent==='通知详情'&&Pandora.idle()",20000));
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
  /* 7.4 切账号后旧会话通知数据被清除，新账号未读来自服务端。 */
  await ev("Pandora.logout()");
  check('logout returns to the login form',await waitFor(b,"!!document.getElementById('login-user')",20000));
  await ev(`document.getElementById('login-user').value=${q(f.head)};document.getElementById('login-password').value='Fixture@123456';document.getElementById('backend-login').requestSubmit()`);
  check('second account authenticated',await waitFor(b,'Pandora.ready&&Pandora.idle()',20000));
  await ev("openNotifications()");
  check('second account notification list loads from its own session',await waitFor(b,"document.querySelectorAll('.p-notice-row').length>0",20000));
  const headUnread=await ev("Pandora.request('/notifications?limit=1').then(r=>r.unreadCount)");
  check('second account unread count comes from the server instead of the previous session',(await ev("document.querySelector('.p-notice-summary').innerText")).includes('全部未读 '+headUnread+' 条'),headUnread);
  check('no browser exceptions',b.errors.length===0,b.errors);
  report.result='PASS';
 }catch(error){report.result='FAIL';report.error=error.message;throw error;}
 finally{fs.writeFileSync(path.join(out,'browser-report.json'),JSON.stringify(report,null,2));await b.kill();}
}
main().catch(error=>{console.error(error);process.exitCode=1});
