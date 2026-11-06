'use strict';
const fs=require('fs'),path=require('path');
const {openBrowser,waitFor,sleep}=require('./browser_fixture');
const f=JSON.parse(process.env.PANDORA_COPY_FIXTURE),q=JSON.stringify;
const out=path.resolve(__dirname,'../../output/apply-copy-audit');fs.mkdirSync(out,{recursive:true});
const report={pages:[],checks:[]};
const FORBIDDEN=/原型|演示|组件复用|接口字段|实现限制|开发过程|种子数据|安全边界|尚未交付|仅写入|私人标签|私人 \/ 共用/;
const business=[f.taskTitle,f.taskDesc,f.logBody,f.commentBody];
function check(name,pass,evidence){report.checks.push({name,pass:!!pass,evidence});console.log((pass?'PASS ':'FAIL ')+name);if(!pass)throw Error(name+' '+JSON.stringify(evidence));}
function clean(value){let text=String(value||'');business.forEach(item=>{text=text.split(item).join('');});return text;}
function audit(label,text,detail){
 const matches=clean(text).match(FORBIDDEN);
 report.pages.push({label,pass:!matches,detail:matches?('发现：'+[...new Set(matches)].join('、')):(detail||'无开发解释/内部技术文案')});
 check(label+' copy audit',!matches,matches?[...new Set(matches)]:null);
}
async function main(){
 const b=await openBrowser(f.base+'/'+encodeURIComponent('潘多拉-交互原型.html'),{width:1440,height:900,mobile:false}),ev=b.evaluate;
 async function page(name){await ev(`closeSheet();setPage('${name}')`);await waitFor(b,'Pandora.idle()');await sleep(250);return ev("document.getElementById('appMain').innerText");}
 async function sheet(){return ev("(document.querySelector('#sheetBody')?.innerText||'')+'\\n'+(document.querySelector('#sheetFoot')?.innerText||'' )");}
 try{
  check('login form ready',await waitFor(b,"!!document.getElementById('backend-login')"));
  await ev(`document.getElementById('login-user').value=${q(f.identities.founder.identifier)};document.getElementById('login-password').value='Fixture@123456';document.getElementById('backend-login').requestSubmit()`);
  check('founder signed in',await waitFor(b,'Pandora.ready&&Pandora.idle()',20000));
  for(const [name,label,detail] of [['map','工作台','无开发解释；保留统计范围与操作入口'],['view','日程','无开发解释；保留日期导航与任务状态'],['log','日志','无开发解释；保留空态与筛选'],['ai','统计','保留统计范围、生成时间与来源'],['me','我的','保留资料字段、账号与下属入口']]){
   await page(name);
   /* 词云和建议直接引用真实任务标题/说明，属于业务原文，不作为界面文案扫描对象。 */
   const text=name==='ai'
     ? await ev("(()=>{const copy=document.getElementById('page-ai').cloneNode(true);copy.querySelectorAll('.wc,.advice,.empty').forEach(n=>n.remove());return copy.innerText})()")
     : await ev("document.getElementById('appMain').innerText");
   audit(label,text,detail);
  }
  await page('ai');
  check('analysis keeps concise provenance',await waitFor(b,"document.getElementById('page-ai').innerText.includes('统计方法')&&document.getElementById('page-ai').innerText.includes('更新于')",20000),await ev("document.getElementById('page-ai').innerText.slice(0,400)"));
  const meText=await page('me');
  check('profile keeps contact and account labels',(meText.includes('联系电话')||meText.includes('手机号'))&&meText.includes('邮箱'),meText.slice(0,300));
  /* Business text is never filtered: the task description, log body and comment stay verbatim. */
  await ev(`Pandora.openTask(${q(f.task)})`);
  check('task detail opens',await waitFor(b,"!document.getElementById('overlay').hidden&&Pandora.idle()",20000));
  const detailText=await sheet();
  check('task business text is preserved verbatim',detailText.includes(f.taskTitle)&&detailText.includes(f.taskDesc)&&detailText.includes(f.commentBody),detailText.slice(0,500));
  audit('任务详情',detailText,'保留说明、进展、申请状态与评论');
  await ev("document.querySelector('[data-action=edit-task]').click()");
  check('unified task edit form opens',await waitFor(b,"!!document.getElementById('tf-title')&&Pandora.idle()",20000));
  const editText=await sheet();
  check('task form keeps field labels and validation reason',editText.includes('任务说明（必填）')&&editText.includes('变更原因（必填'),editText.slice(0,500));
  audit('任务编辑',editText,'保留字段标签、变更原因与提交');
  for(const width of [320,390,1440]){await b.viewport({width,height:width===1440?900:844,mobile:width!==1440});check('task edit fits '+width,await ev("document.getElementById('sheetBody').scrollWidth<=document.getElementById('sheetBody').clientWidth+1"));await b.screenshot(path.join(out,'task-edit-'+width+'.png'));}
  await b.viewport({width:1440,height:900,mobile:false});await ev('closeSheet()');
  await page('log');
  await ev("document.querySelector('[data-action=new-log]').click()");
  check('log form keeps its fields',await waitFor(b,"!!document.getElementById('lf-content')&&!!document.getElementById('lf-date')&&Pandora.idle()",20000));
  const logText=await sheet();
  check('log form labels stay visible',logText.includes('日志日期')&&logText.includes('日志内容'),logText.slice(0,400));
  await ev("document.getElementById('lf-content').value='';document.querySelector('[data-action=save-log]').click()");
  check('log validation error stays concise',await waitFor(b,"Pandora.idle()&&!document.getElementById('lf-error').hidden&&document.getElementById('lf-error').textContent.includes('请填写日志内容')",20000));
  const logError=await ev("document.getElementById('lf-error').textContent");
  audit('日志表单',logText+'\n'+logError,'保留日期、正文、标签与简短校验');
  await ev('closeSheet()');
  /* Notifications: list filters and one detail keep result/state copy without dev explanations. */
  await ev('openNotifications()');
  check('notification list opens',await waitFor(b,"!document.getElementById('overlay').hidden&&Pandora.idle()&&document.getElementById('sheetTitle').textContent==='通知'",20000));
  const noticeText=await sheet();
  check('notification filters are visible',noticeText.includes('全部')&&noticeText.includes('未读'),noticeText.slice(0,400));
  audit('通知列表',noticeText,'保留全部/未读与分类筛选');
  const firstNotice=await ev("document.querySelector('[data-action=open-notif]')?.dataset.id||null");
  if(firstNotice){
   await ev(`document.querySelector('[data-action=open-notif][data-id="${firstNotice}"]').click()`);
   check('notification detail opens',await waitFor(b,"document.getElementById('sheetTitle').textContent==='通知详情'&&Pandora.idle()",20000));
   const noticeDetail=await sheet();
   check('more actions stay reachable',await ev("!!document.querySelector('.p-notice-more summary')"));
   audit('通知详情',noticeDetail,'保留结果、时间、主操作与更多');
   await ev('closeSheet()');
  } else { report.pages.push({label:'通知详情',pass:true,detail:'本次无通知，列表筛选已检查'}); }
  await ev('closeSheet()');
  /* Calendar drawer / my applications. */
  await page('view');
  await ev("document.querySelector('[data-action=schedule-side-toggle]').click()");
  check('calendar drawer opens',await waitFor(b,"!!document.querySelector('.p-schedule-drawer')"));
  await ev("document.querySelector('[data-action=schedule-my-applications]').click()");
  check('my applications opens',await waitFor(b,"Pandora.idle()&&!document.getElementById('overlay').hidden",20000));
  const applicationText=await sheet();
  audit('我的申请',applicationText,'保留申请状态与结果');
  await ev("document.querySelector('[data-action=sheet-close]')?.click();closeSheet()");
  /* Subordinate card and work entry. */
  await page('me');
  await ev("document.querySelector('[data-profile-fold=reports]')?.setAttribute('open','')");
  for(const who of ['alpha-head','alpha-one-head']) await ev(`document.querySelector('[data-action=p-report-toggle][data-id="${f.identities[who].id}"]')?.click()`);
  const personButton=await ev(`document.querySelector('[data-action=p-open-person][data-id="${f.employeeId}"]')`);
  check('subordinate entry is reachable',!!personButton);
  await ev(`document.querySelector('[data-action=p-open-person][data-id="${f.employeeId}"]').click()`);
  check('person card opens before work',await waitFor(b,"Pandora.idle()&&!!document.querySelector('[data-action=p-staff-enter][data-tab=schedule]')",20000));
  const cardText=await sheet();
  check('person card keeps schedule and log entries',cardText.includes('日程')&&cardText.includes('日志'),cardText.slice(0,400));
  audit('下属资料卡',cardText,'保留授权联系方式与工作入口');
  await ev("document.querySelector('[data-action=p-staff-enter][data-tab=schedule]').click()");
  check('subordinate work page opens',await waitFor(b,"Pandora.idle()&&!!document.querySelector('[data-staff-panel]')",20000));
  const staffText=await sheet();
  audit('下属工作页',staffText,'保留月/日浏览、状态与返回');
  for(const width of [320,390,1440]){await b.viewport({width,height:width===1440?900:844,mobile:width!==1440});check('subordinate work fits '+width,await ev("document.getElementById('sheetBody').scrollWidth<=document.getElementById('sheetBody').clientWidth+1"));await b.screenshot(path.join(out,'staff-'+width+'.png'));}
  await b.viewport({width:1440,height:900,mobile:false});await ev('closeSheet()');
  /* Administrator console copy. */
  await b.send('Page.navigate',{url:f.base+'/admin.html'});
  check('admin login ready',await waitFor(b,"!!document.getElementById('accountName')&&!!document.getElementById('loginButton')"));
  const adminLoginText=await ev("document.getElementById('login').innerText");
  audit('管理端登录',adminLoginText,'仅说明管理员账号登录');
  await ev(`document.getElementById('accountName').value=${q(f.admin.identifier)};document.getElementById('password').value='Fixture@123456';document.getElementById('loginButton').click()`);
  check('admin console opens',await waitFor(b,"!document.getElementById('console').hidden&&document.querySelectorAll('#employeeRows tr').length>0",20000));
  const adminText=await ev("document.getElementById('console').innerText");
  audit('管理端业务维护',adminText,'保留员工、组织、通知与历史操作说明');
  for(const width of [320,390,1440]){await b.viewport({width,height:width===1440?900:844,mobile:width!==1440});await b.screenshot(path.join(out,'admin-'+width+'.png'));}
  check('no browser exceptions',b.errors.length===0,b.errors);
 }finally{fs.writeFileSync(path.join(out,'browser-report.json'),JSON.stringify(report,null,2));await b.kill();}
}
main().then(()=>process.exit(0)).catch(e=>{console.error(e&&e.stack||e);process.exit(1)});
