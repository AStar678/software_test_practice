'use strict';
const {openBrowser, waitFor, sleep} = require(require('path').resolve(__dirname,'../../../backend/scripts/browser_fixture'));
const fixture=JSON.parse(process.env.PANDORA_BROWSER_FIXTURE);
const ids=fixture.identities;
const js=v=>JSON.stringify(v);
const failures=[];
function check(name,pass,extra){console.log((pass?'PASS ':'FAIL ')+name+(extra?' '+JSON.stringify(extra):''));if(!pass)failures.push(name);}
async function login(b,who){
  await b.evaluate(`document.getElementById('login-user').value=${js(ids[who].identifier)};document.getElementById('login-password').value='Fixture@123456';document.getElementById('backend-login').requestSubmit()`);
  return waitFor(b,`Pandora.ready&&Pandora.idle()&&Pandora.data.me.id===${js(ids[who].id)}`,25000);
}
async function logout(b){
  await b.evaluate("Pandora.logout()");
  return waitFor(b,"!!document.getElementById('backend-login')&&Pandora.idle()",20000);
}
async function main(){
  const b=await openBrowser(fixture.base+'/');
  const ev=b.evaluate;
  try{
    check('login form ready', await waitFor(b,"!!document.getElementById('backend-login')&&Pandora.idle()",20000));
    check('employee login', await login(b,'alpha-one-employee'));
    await waitFor(b,"document.querySelectorAll('#page-map .quad').length===3&&Pandora.idle()",20000);
    const home=await ev(`(()=>{const qs=document.querySelectorAll('#page-map .quad');
      return {count:qs.length, company:!!document.querySelector('.company-quad'), tasks:!!document.querySelector('.tasks-quad'), daily:!!document.getElementById('dailyItemsSection'),
        previews:document.querySelectorAll('.tasks-quad .home-task').length, companyPreviews:document.querySelectorAll('.company-quad .item-line').length,
        qbodyOverflow:getComputedStyle(document.querySelector('.company-quad .q-body')).overflowY,
        cards:[...qs].map(q=>q.dataset.homeList||null)}})()`);
    check('three modules and clickable cards', home.count===3&&home.company&&home.tasks&&home.daily&&home.cards[0]==='company'&&home.cards[1]==='tasks', home);
    check('preview limited to three and no inner scroll', home.previews===3&&home.companyPreviews===3&&home.qbodyOverflow!=='auto'&&home.qbodyOverflow!=='scroll', home);
    await ev("document.querySelector('.company-quad').click()");
    check('company card opens list', await waitFor(b,"document.getElementById('sheetTitle').textContent==='事件纪'",6000));
    const compRows=await ev("document.querySelectorAll('#sheetBody .item-line').length");
    check('complete company list', compRows===4, compRows);
    await ev("document.querySelector('#sheetFoot [data-action=\"sheet-close\"]').click()");
    await waitFor(b,"document.getElementById('overlay').hidden",5000);
    const focusCard=await ev("document.activeElement&&document.activeElement.dataset.homeList||null");
    check('closing list returns focus to card', focusCard==='company', focusCard);
    await ev("document.querySelector('.tasks-quad').click()");
    check('task card opens list', await waitFor(b,"document.getElementById('sheetTitle').textContent==='任务看板'",6000));
    const taskRows=await ev("document.querySelectorAll('#sheetBody .home-task').length");
    check('complete task list', taskRows===7, taskRows);
    await ev("document.querySelector('#sheetBody .home-task').click()");
    check('list row opens task detail', await waitFor(b,"document.activeElement&&document.getElementById('sheetTitle').textContent!=='任务看板'",8000));
    const footActions=await ev("[...document.querySelectorAll('#sheetFoot button')].map(x=>x.dataset.action)");
    console.log('detail foot actions', JSON.stringify(footActions));
    await ev("(()=>{const back=document.querySelector('#sheetFoot [data-action=\"sheet-back\"]');if(back)back.click();else document.getElementById('sheetClose').click();})()");
    await sleep(500);
    console.log('title after back', await ev("document.getElementById('sheetTitle').textContent"));
    check('back to task list keeps scroll view', await waitFor(b,"document.getElementById('sheetTitle').textContent==='任务看板'",6000));
    await ev("document.getElementById('sheetClose').click()");
    await waitFor(b,"document.getElementById('overlay').hidden",5000);

    /* 每日事项：纵向连续月历 */
    const daily=await ev(`(()=>{const s=document.getElementById('dailyScroller');const today=document.querySelector('[data-daily-date="${fixture.today}"]');
      const bars=[...document.querySelectorAll('.daily-bar')];
      return {months:document.querySelectorAll('.daily-month').length, bars:bars.length, scroller:s?{overflowY:getComputedStyle(s).overflowY,top:s.scrollTop,height:s.clientHeight}:null,
        todayVisible:!!today&&today.getBoundingClientRect().top>=s.getBoundingClientRect().top-1&&today.getBoundingClientRect().bottom<=s.getBoundingClientRect().bottom+1,
        weekdays:[...document.querySelectorAll('.daily-weekdays span')].map(x=>x.textContent), barsStatus:bars.map(x=>x.className)}})()`);
    check('daily calendar is vertical with weekdays row and mounted months', daily.months>=2&&daily.weekdays.length===7&&daily.weekdays[0]==='周一'&&daily.scroller&&daily.scroller.overflowY==='auto', daily);
    check('today is visible initially', daily.todayVisible===true, daily);
    check('range items render as labelled bars', daily.bars>=2&&daily.barsStatus.some(c=>c.includes('is-overdue')), daily.barsStatus.slice(0,6));
    const rangeBar=await ev(`(()=>{const bar=[...document.querySelectorAll('.daily-bar')].find(x=>x.dataset.endCol-x.dataset.startCol>1)||document.querySelector('.daily-bar');
      if(!bar)return null;const w=bar.closest('.daily-week');const days=w.querySelector('.daily-days');const rect=days.getBoundingClientRect();
      const col=Math.min(Number(bar.dataset.endCol)-1, Number(bar.dataset.startCol)+1);
      const x=rect.left+(col+0.5)*(rect.width/7);
      return {x, y:bar.getBoundingClientRect().top+5, expected:new Date(Date.parse(w.dataset.weekStart+'T00:00:00Z')+col*86400000).toISOString().slice(0,10)}})()`);
    if(rangeBar){
      await ev(`(()=>{const bar=[...document.querySelectorAll('.daily-bar')].find(x=>x.dataset.endCol-x.dataset.startCol>1)||document.querySelector('.daily-bar');
        const el=bar;const w=el.closest('.daily-week');const days=w.querySelector('.daily-days');const rect=days.getBoundingClientRect();
        const col=Math.min(Number(el.dataset.endCol)-1, Number(el.dataset.startCol)+1);
        const x=rect.left+(col+0.5)*(rect.width/7);
        el.dispatchEvent(new PointerEvent('pointerdown',{bubbles:true,clientX:x,clientY:el.getBoundingClientRect().top+5}));
        el.dispatchEvent(new PointerEvent('pointerup',{bubbles:true,clientX:x,clientY:el.getBoundingClientRect().top+5}));
        el.dispatchEvent(new MouseEvent('click',{bubbles:true,cancelable:true,clientX:x,clientY:el.getBoundingClientRect().top+5}));})()`);
      const opened=await waitFor(b,"document.getElementById('sheetTitle').textContent.includes('每日事项')",6000);
      const list=await ev("({title:document.getElementById('sheetTitle').textContent, rows:document.querySelectorAll('#sheetBody .daily-row').length, meta:document.querySelector('#sheetBody .daily-list-meta')?.textContent||''})");
      const parts=rangeBar.expected.split('-');const expectedLabel=parts[0]+'年'+Number(parts[1])+'月'+Number(parts[2])+'日';
      check('continued bar opens the actual hit-date list', opened&&list.rows>=1&&list.meta.includes(expectedLabel), {opened,list,hit:rangeBar.expected});
      await ev("document.getElementById('sheetClose').click()");
      await waitFor(b,"document.getElementById('overlay').hidden",5000);
    }
    const scrollMoved=await ev(`(()=>{const s=document.getElementById('dailyScroller');const before=s.scrollTop;s.scrollTop=Math.min(s.scrollHeight-s.clientHeight, s.scrollTop+280);s.dispatchEvent(new Event('scroll'));return {before,after:s.scrollTop}})()`);
    await sleep(400);
    const afterScroll=await ev(`(()=>{const s=document.getElementById('dailyScroller');return {top:s.scrollTop,months:document.querySelectorAll('.daily-month').length}})()`);
    check('daily calendar scrolls vertically and loads adjacent months', afterScroll.top>0&&afterScroll.months>=2, {scrollMoved,afterScroll});
    const longBars=await ev("[...document.querySelectorAll('.daily-bar-name')].filter(x=>x.textContent.includes('长期镜头计划')).length");
    check('a range longer than a month draws bars in every intersecting mounted month', longBars>=1, longBars);
    const overflow=await ev("document.querySelectorAll('[data-daily-more]').length");
    check('overflow entries expose the complete hidden set', overflow>=1, overflow);
    await ev("document.getElementById('dailyScroller').scrollTop=document.getElementById('dailyScroller').scrollHeight");
    await sleep(500);
    const bulkParts=fixture.bulk.split('-');const bulkLabel=Number(bulkParts[1])+'月'+Number(bulkParts[2])+'日';
    const bulkClicked=await ev(`(()=>{const cell=document.querySelector('[data-daily-date="${fixture.bulk}"]');if(!cell)return false;cell.click();return true;})()`);
    const bulkOpened=await waitFor(b,`document.getElementById('overlay').hidden===false&&document.getElementById('sheetTitle').textContent.includes('${bulkLabel}')`,6000);
    const bulk=await ev("({rows:document.querySelectorAll('#sheetBody .daily-row').length,total:document.querySelector('#sheetBody .daily-list-meta')?.textContent||'',more:!!document.querySelector('#sheetBody [data-action=\"daily-more\"]')})");
    check('a day with more than one page lists all items page by page', bulkClicked&&bulkOpened&&bulk.total.includes('106')&&bulk.rows===50&&bulk.more, {bulkClicked,bulkOpened,bulk});
    await ev("document.querySelector('#sheetBody [data-action=\"daily-more\"]').click()");
    check('load more appends the next page without duplicates', await waitFor(b,"document.querySelectorAll('#sheetBody .daily-row').length===100",8000));
    await ev("document.getElementById('sheetClose').click()");
    await waitFor(b,"document.getElementById('overlay').hidden",5000);
    /* 从清单完成事项后清单与事项条同步，不因刷新变空。 */
    await ev(`document.querySelector('[data-daily-date="${fixture.today}"]').click()`);
    await waitFor(b,"document.getElementById('overlay').hidden===false&&document.querySelectorAll('#sheetBody .daily-row').length>0",8000);
    const rowsBefore=await ev("document.querySelectorAll('#sheetBody .daily-row').length");
    const completedBefore=await ev("document.querySelectorAll('.daily-bar.is-completed').length");
    await ev("document.querySelector('#sheetBody .daily-row .daily-check').click()");
    await waitFor(b,"document.querySelector('#sheetBody .daily-row .daily-check[aria-checked=\"true\"]')!==null",8000);
    const rowsAfter=await ev("document.querySelectorAll('#sheetBody .daily-row').length");
    const completedAfter=await ev("document.querySelectorAll('.daily-bar.is-completed').length");
    check('completing from the list keeps rows and updates covered bars', rowsAfter===rowsBefore&&completedAfter>completedBefore, {rowsBefore,rowsAfter,completedBefore,completedAfter});
    await ev("document.getElementById('sheetClose').click()");
    await waitFor(b,"document.getElementById('overlay').hidden",5000);

    /* 四种窗口 + 尺寸变化后的日期锚点 */
    console.log('pre-resize state', await ev("JSON.stringify({d:PandoraDaily.state.anchorDate,o:PandoraDaily.state.anchorOffset,top:document.getElementById('dailyScroller').scrollTop})"));
    const anchorBefore=await ev(`(()=>{const s=document.getElementById('dailyScroller');const top=s.getBoundingClientRect().top;let best=null,delta=Infinity;
      s.querySelectorAll('[data-daily-date]').forEach(c=>{const t=c.getBoundingClientRect().top;if(t>=top-1&&t-top<delta){delta=t-top;best=c}});
      return best?{date:best.dataset.dailyDate,off:Math.round(delta)}:null})()`);
    const viewports=[{width:320,height:740,mobile:true},{width:390,height:844,mobile:true},{width:1440,height:900,mobile:false},{width:390,height:600,mobile:true}];
    for(const vp of viewports){
      await b.viewport(vp);
      await sleep(350);
      const layout=await ev(`(()=>{const add=document.querySelector('.daily-add');const head=document.querySelector('.daily-head');const box=e=>{const r=e.getBoundingClientRect();return {l:Math.round(r.left),t:Math.round(r.top),r:Math.round(r.right),b:Math.round(r.bottom)}};
        return {overflowX:document.documentElement.scrollWidth>window.innerWidth+1,add:add?box(add):null,head:head?box(head):null,mainScroll:document.getElementById('appMain').scrollHeight>=document.getElementById('appMain').clientHeight}})()`);
      const addVisible=layout.add&&layout.add.l>=0&&layout.add.r<=vp.width&&layout.add.t>=0;
      check('home and header add remain usable at '+vp.width+'x'+vp.height, !layout.overflowX&&addVisible, layout);
      console.log('anchor at',vp.width+'x'+vp.height, await ev("JSON.stringify({d:PandoraDaily.state.anchorDate,o:PandoraDaily.state.anchorOffset,top:document.getElementById('dailyScroller').scrollTop,vh:PandoraDaily.state.viewportHeight})"));
    }
    await b.viewport({width:1440,height:900,mobile:false});
    await sleep(600);
    const wide=await ev(`(()=>{const s=document.getElementById('dailyScroller');return {scrollable:s.scrollHeight>s.clientHeight+10,months:document.querySelectorAll('.daily-month').length}})()`);
    check('wide viewport keeps the daily calendar browsable', wide.scrollable&&wide.months>=2, wide);
    await b.viewport({width:390,height:844,mobile:true});
    await sleep(600);
    const anchorAfter=await ev(`(()=>{const s=document.getElementById('dailyScroller');const top=s.getBoundingClientRect().top;let best=null,delta=Infinity;
      s.querySelectorAll('[data-daily-date]').forEach(c=>{const t=c.getBoundingClientRect().top;if(t>=top-1&&t-top<delta){delta=t-top;best=c}});
      return best?{date:best.dataset.dailyDate,off:Math.round(delta)}:null})()`);
    check('resize restores the same date anchor and pixel offset', !!anchorBefore&&!!anchorAfter&&anchorBefore.date===anchorAfter.date&&Math.abs(anchorBefore.off-anchorAfter.off)<=2, {anchorBefore,anchorAfter});

    /* 日志所属日期与填充 */
    await ev("document.querySelector('#tabbar [data-page=\"log\"]').click()");
    await waitFor(b,"document.getElementById('page-log').classList.contains('is-active')&&Pandora.idle()",8000);
    const logCard=await ev(`(()=>{const c=document.querySelector('[data-log-card]');return c?{text:c.querySelector('header').textContent,business:c.querySelector('.log-business-date')?.textContent||''}:null})()`);
    check('log card shows the full business date', !!logCard&&logCard.business.includes('年')&&logCard.business.includes('月')&&logCard.business.includes('日'), logCard);
    await ev("document.querySelector('[data-action=\"new-log\"]').click()");
    check('write log form opens with fill entry', await waitFor(b,"!!document.getElementById('lf-fill-button')&&Pandora.idle()",8000));
    await ev("document.getElementById('lf-fill-button').click()");
    check('fill appends daily item and task names', await waitFor(b,"document.getElementById('lf-content').value.includes('每日事项：')&&document.getElementById('lf-content').value.includes('任务：')",10000));
    const filled=await ev("document.getElementById('lf-content').value");
    check('fill keeps groups and names', filled.includes('昨日镜头备注')&&filled.includes('跨日镜头交接')&&filled.indexOf('每日事项：')<filled.indexOf('任务：'), filled.slice(0,200));
    /* 超过 10000 UTF-16 单位时原子失败，原正文保持不变 */
    await ev("document.getElementById('lf-content').value='x'.repeat(9990);document.getElementById('lf-fill-button').click()");
    await waitFor(b,"document.getElementById('lf-fill-status').classList.contains('is-error')",8000);
    const overflowFill=await ev("({len:document.getElementById('lf-content').value.length,status:document.getElementById('lf-fill-status').textContent})");
    check('overflowing append fails atomically and keeps the draft', overflowFill.len===9990&&overflowFill.status.includes('10000'), overflowFill);
    await ev("document.querySelector('#sheetFoot [data-action=\"sheet-back\"],#sheetFoot [data-action=\"sheet-close\"]')?.click()");
    await sleep(300);

    /* 资料：隐藏身份 */
    await ev("document.querySelector('#tabbar [data-page=\"me\"]').click()");
    await waitFor(b,"document.getElementById('page-me').classList.contains('is-active')",8000);
    const mePage=await ev(`(()=>{const t=document.getElementById('page-me').textContent;return {identity:t.includes('组织身份'),hasDept:t.includes('部门')}})()`);
    check('own profile hides organization identity', mePage.identity===false&&mePage.hasDept===true, mePage);

    /* 创始人：下属树、人员连续日程与返回 */
    check('logout employee', await logout(b));
    check('founder login', await login(b,'founder'));
    await waitFor(b,"document.querySelectorAll('#page-map .quad').length===3&&Pandora.idle()",20000);
    await ev("document.querySelector('#tabbar [data-page=\"me\"]').click()");
    await waitFor(b,"document.getElementById('page-me').classList.contains('is-active')",8000);
    const treePath=await ev("document.querySelector('.staff-tree-person small')?.textContent||''");
    check('subordinate tree uses true department ▸ team ▸ position path', treePath.includes(' ▸ ')&&!treePath.includes('员工 ·'), treePath);
    await ev("document.querySelector('.staff-tree-person').click()");
    check('subordinate card opens with contacts and tenure rows', await waitFor(b,"!!document.querySelector('#sheetBody .profile-details')&&Pandora.idle()",8000));
    const card=await ev("document.getElementById('sheetBody').textContent");
    check('subordinate card has phone email hire and tenure', card.includes('联系电话')&&card.includes('邮箱')&&card.includes('入职日期')&&card.includes('已入职'), card.slice(0,200));
    check('subordinate card has no organization identity', !card.includes('组织身份'), card.slice(0,120));
    await ev("document.querySelector('[data-action=\"p-staff-enter\"][data-tab=\"schedule\"]').click()");
    check('person schedule shows continuous months', await waitFor(b,"document.querySelectorAll('.staff-month-section').length>=2&&document.getElementById('staffMonthScroll')",10000));
    await waitFor(b,"document.querySelectorAll('.staff-month-event').length>0",10000);
    const staffMonth=await ev(`(()=>{const s=document.getElementById('staffMonthScroll');const bars=document.querySelectorAll('.staff-month-event');return {months:document.querySelectorAll('.staff-month-section').length,bars:bars.length,height:s.clientHeight,overflow:getComputedStyle(s).overflowY}})()`);
    check('person month stream has bars and vertical scroll', staffMonth.months>=2&&staffMonth.bars>=1&&staffMonth.overflow==='auto', staffMonth);
    await ev("(()=>{const b=document.querySelector('.staff-month-event');const r=b.getBoundingClientRect();b.dispatchEvent(new MouseEvent('click',{bubbles:true,cancelable:true,clientX:r.left+4,clientY:r.top+4}))})()");
    check('person date list opens as a fixed dialog', await waitFor(b,"!!document.getElementById('staffDayPopup')",8000));
    await waitFor(b,"document.querySelectorAll('#staffDayPopupBody .staff-work-item').length>0",10000);
    console.log('popup body', await ev("document.getElementById('staffDayPopupBody').textContent.slice(0,120)"));
    const popup=await ev(`(()=>{const p=document.getElementById('staffDayPopup');const head=p.querySelector('.staff-day-popup-head');const foot=p.querySelector('.staff-day-popup-foot');const body=p.querySelector('.staff-day-popup-body');const style=getComputedStyle(p);return {pos:style.position,headVisible:!!head&&head.getBoundingClientRect().height>0,footVisible:!!foot&&foot.getBoundingClientRect().height>0,bodyScroll:getComputedStyle(body).overflowY,items:body.querySelectorAll('.staff-work-item').length}})()`);
    check('date list keeps title and actions visible while content scrolls', popup.pos==='fixed'&&popup.headVisible&&popup.footVisible&&popup.bodyScroll==='auto'&&popup.items>=1, popup);
    /* 人员路径进入任务详情：浮层让位，返回后恢复同一人员、日期与清单。 */
    await ev("document.querySelector('#staffDayPopupBody .staff-work-item').click()");
    const detailOpen=await waitFor(b,"document.getElementById('overlay').hidden===false&&!!document.querySelector('#sheetFoot [data-action=\"sheet-back\"]')",10000);
    const popupHidden=await ev("getComputedStyle(document.getElementById('staffDayPopup')).display==='none'");
    check('person task detail covers the date list', detailOpen&&popupHidden, {detailOpen,popupHidden});
    await ev("document.querySelector('#sheetFoot [data-action=\"sheet-back\"]').click()");
    await sleep(400);
    const restored=await ev(`(()=>{const p=document.getElementById('staffDayPopup');return p?{display:getComputedStyle(p).display,items:p.querySelectorAll('.staff-work-item').length,title:document.getElementById('sheetTitle').textContent}:null})()`);
    check('returning restores the person date list', !!restored&&restored.display!=='none'&&restored.items>=1, restored);
    await ev("document.querySelector('#staffDayPopup [data-action=\"p-staff-day-close\"]').click()");
    check('closing date list removes dialog', await waitFor(b,"!document.getElementById('staffDayPopup')",5000));
    /* 月份读取失败保留已加载月份并可单独重试。 */
    const nextMonth=(()=>{const d=new Date(fixture.today+'T00:00:00Z');d.setUTCDate(1);d.setUTCMonth(d.getUTCMonth()+3);return d.toISOString().slice(0,7)})();
    await ev(`(()=>{const orig=Pandora.request;window.__origRequest=orig;Pandora.request=function(p,o){if(typeof p==='string'&&p.indexOf('/tasks?')===0&&p.indexOf('from=${nextMonth}-01')>=0)return Promise.reject(new Error('模拟网络失败'));return orig.call(Pandora,p,o)}})()`);
    for(let i=0;i<3;i++){await ev("document.querySelector('[data-action=\"p-staff-nav\"][data-step=\"1\"]').click()");await sleep(400);}
    const failed=await waitFor(b,`(()=>{const s=document.querySelector('[data-staff-month="${nextMonth}"]');return !!s&&s.classList.contains('is-error')})()`,10000);
    const failureText=await ev(`document.querySelector('[data-staff-month="${nextMonth}"] .staff-month-state')?.textContent||''`);
    check('a failed person month is explicit and retryable', failed&&failureText.includes('读取失败')&&(await ev(`!!document.querySelector('[data-staff-month="${nextMonth}"] [data-action="p-staff-month-retry"]')`)), {failed,failureText});
    await ev("if(window.__origRequest){Pandora.request=window.__origRequest;delete window.__origRequest}");
    await ev(`document.querySelector('[data-staff-month="${nextMonth}"] [data-action="p-staff-month-retry"]').click()`);
    check('retry loads the failed month without clearing others', await waitFor(b,`(()=>{const s=document.querySelector('[data-staff-month="${nextMonth}"]');return !!s&&s.classList.contains('is-ready')})()`,10000));
    await ev("document.getElementById('sheetClose').click()");
    await sleep(300);

    /* 公司日历节假日 */
    await ev("document.querySelector('#tabbar [data-page=\"view\"]').click()");
    await waitFor(b,"document.getElementById('page-view').classList.contains('is-active')&&Pandora.idle()",10000);
    check('holiday labels appear for the cached year', await waitFor(b,"document.querySelectorAll('.p-month-holiday').length>0",10000));
    const holiday=await ev(`(()=>{const labels=[...document.querySelectorAll('.p-month-holiday')].map(x=>x.textContent);const work=[...document.querySelectorAll('.p-month-holiday.is-work')].map(x=>x.textContent);return {labels,work}})()`);
    check('month grid shows festival name and rest/work markers', holiday.labels.some(x=>x.includes('测试节')&&x.includes('休'))&&holiday.work.some(x=>x.includes('测试调班')&&x.includes('班')), holiday);
    await waitFor(b,"document.querySelectorAll('.p-holiday-status').length>0",15000);
    const holidayStates=await ev("[...document.querySelectorAll('.p-holiday-status')].map(x=>x.textContent)");
    check('a year without cache is explicitly missing instead of fabricated', holidayStates.some(x=>x.includes('暂无节假日数据')), holidayStates);

    check('no runtime console errors', b.errors.length===0, b.errors.slice(0,6));
  } finally {
    b.kill();
  }
  if(failures.length){console.log('FAILURES: '+failures.join(' | '));process.exit(1);}
  console.log('ALL SMOKE CHECKS PASSED');
}
main().catch(error=>{console.error(error);process.exit(1);});
