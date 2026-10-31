#!/usr/bin/env node
'use strict';
const fs = require('fs');
const path = require('path');
const { openBrowser, waitFor, sleep } = require('./browser_fixture');
const fixture = JSON.parse(process.env.PANDORA_BROWSER_FIXTURE);
const ids = fixture.identities;
const output = path.resolve(__dirname, '../../audit/refactor-pandora-organization-and-workflows/log-backfill-entry.json');
const screenshots=path.resolve(__dirname,'../../output/entry-refinement');fs.mkdirSync(screenshots,{recursive:true});
const report = { updated: new Date().toISOString(), checks: [] };
function check(name, condition, evidence) {
  report.checks.push({ check: name, pass: !!condition, evidence });
  console.log((condition ? 'PASS ' : 'FAIL ') + name);
  if (!condition) throw new Error(name + ' ' + JSON.stringify(evidence));
}
const shift = (date, days) => {
  const parsed = new Date(date + 'T00:00:00Z');
  parsed.setUTCDate(parsed.getUTCDate() + days);
  return parsed.toISOString().slice(0, 10);
};
async function main() {
  const browser = await openBrowser(fixture.base + '/', { width: 390, height: 844, mobile: true });
  const ev = browser.evaluate;
  try {
    await waitFor(browser, "!!document.getElementById('backend-login')");
    await ev(`document.getElementById('login-user').value=${JSON.stringify(ids['alpha-head'].identifier)};document.getElementById('login-password').value='Fixture@123456';document.getElementById('backend-login').requestSubmit()`);
    check('employee session is ready', await waitFor(browser, `Pandora.ready&&Pandora.idle()&&Pandora.data.me.id===${JSON.stringify(ids['alpha-head'].id)}`));
    await ev("setPage('log')");
    await waitFor(browser, "state.page==='log'&&Pandora.idle()&&!!document.getElementById('logResults')");
    const today = await ev('Pandora.data.home.businessDate');
    const yesterday = shift(today, -1), preday = shift(today, -2);
    async function open(action) {
      await ev(`document.querySelector('[data-action=${action}]').click()`);
      return waitFor(browser, "!document.getElementById('overlay').hidden&&!!document.getElementById('lf-content')&&Pandora.idle()");
    }
    async function logGeometry(kind){
      for(const width of [320,390,1440]){
        await browser.viewport({width,height:width===1440?900:844,mobile:width!==1440});
        await ev("document.getElementById('lf-date').scrollIntoView({block:'center'})");
        const g=await ev("(()=>{const a=document.getElementById('lf-date').getBoundingClientRect(),b=document.getElementById('lf-tag').getBoundingClientRect(),body=document.getElementById('sheetBody');return {a:{x:a.x,y:a.y,w:a.width,h:a.height,right:a.right},b:{x:b.x,y:b.y,w:b.width,h:b.height,right:b.right},overflow:body.scrollWidth>body.clientWidth+1}})()");
        check(kind+' metadata aligned '+width,!g.overflow&&Math.abs(g.a.h-g.b.h)<1&&g.a.x>=0&&g.b.right<=width+1&&(Math.abs(g.a.x-g.b.x)<1||Math.abs(g.a.y-g.b.y)<1),g);
        await browser.screenshot(path.join(screenshots,kind+'-aligned-'+width+'.png'));
      }
      await browser.viewport({width:390,height:844,mobile:true});
    }
    async function save(content) {
      await ev(`document.getElementById('lf-content').value=${JSON.stringify(content)};document.querySelector('#sheetFoot [data-action=save-log]').click()`);
      await waitFor(browser, "document.getElementById('overlay').hidden&&Pandora.idle()", 20000);
    }
    check('no separate backfill entry',await ev("!document.querySelector('[data-action=backfill-log]')"));
    await ev("setPage('view');Pandora.taskForm.open()");
    check('personal task table loaded',await waitFor(browser,"Pandora.taskForm.state.loaded&&Pandora.idle()"));
    const rows=await ev("Pandora.taskForm.current().sorted.map(t=>t.id)");
    check('table includes created and assigned only',rows.length===2&&fixture.personalTasks.every(id=>rows.includes(id)),rows);
    for(const width of [390,1440]){await browser.viewport({width,height:width===1440?900:844,mobile:width===390});await browser.screenshot(path.join(screenshots,'table-'+width+'.png'));}
    await browser.viewport({width:390,height:844,mobile:true});
    check('subordinate is globally authorized but absent from table',await ev(`TASKS.some(t=>t.id===${JSON.stringify(fixture.subordinateTask)})&&!Pandora.taskForm.current().sorted.some(t=>t.id===${JSON.stringify(fixture.subordinateTask)})`));
    await ev(`document.getElementById('p-filter-query').value='下属专属';document.getElementById('p-filter-query').dispatchEvent(new Event('input',{bubbles:true}))`);
    check('search cannot recover subordinate rows',await waitFor(browser,"Pandora.taskForm.current().paged.total===0"));
    await ev('Pandora.reload()');
    check('table refresh keeps personal scope',await ev("Pandora.taskForm.current().paged.total===0&&!document.querySelector('#p-filter-relation option[value=visible]')"));
    await ev("Pandora.taskForm.close();state.viewPage='calendar';setPage('view');renderAll()");
    check('calendar tag row removed',await ev("!document.querySelector('.p-schedule-tags')&&!document.querySelector('.p-calendar-tag-legend')"));
    await browser.screenshot(path.join(screenshots,'calendar-390.png'));
    check('calendar task color retained',await ev(`taskColorVars(taskById(${JSON.stringify(fixture.colorTask)})).includes('#D8EAF4')`));
    await ev("setPage('me')");
    check('non-founder has no tag maintenance entry',await ev("!document.querySelector('#page-me [data-action=p-manage-tags]')"));
    await ev('Pandora.tagsUi.manage()');
    check('manual manager invocation cannot open tag maintenance',await ev("document.getElementById('overlay').hidden"));
    await ev("setPage('log')");
    check('today log entry opens for the first write', await open('new-log') && await ev(`document.getElementById('lf-date').value===${JSON.stringify(today)}`));
    check('initial date options include all missing days',await ev("document.querySelectorAll('#lf-date option').length===3&&!drafts.log.id"));
    await logGeometry('create');
    await browser.screenshot(path.join(screenshots,'create-log-390.png'));
    await ev(`drafts.log.taskId=${JSON.stringify(fixture.colorTask)};drafts.log.relationshipChanged=true`);
    await save('Backfill entry today');
    check('today log is persisted before backfilling', await ev(`Pandora.request('/work-logs?scope=self&from=${today}&to=${today}&limit=1').then(r=>r.items.length===1)`));
    check('backfill entry opens yesterday instead of today\'s edit', await open('new-log')
      && await ev(`document.getElementById('lf-date').value===${JSON.stringify(yesterday)}&&!document.getElementById('lf-date').disabled&&document.getElementById('sheetTitle').textContent==='写日志'&&document.getElementById('lf-content').value===''`));
    check('existing day absent from creation options',await ev("document.querySelectorAll('#lf-date option').length===2&&!drafts.log.id"));
    await save('Backfill entry yesterday');
    check('backfill entry then opens the day before', await open('new-log')
      && await ev(`document.getElementById('lf-date').value===${JSON.stringify(preday)}&&!document.getElementById('lf-date').disabled&&document.getElementById('sheetTitle').textContent==='写日志'`));
    check('only missing day remains',await ev("document.querySelectorAll('#lf-date option').length===1&&!drafts.log.id"));
    await save('Backfill entry day before');
    const all = await ev(`Pandora.request('/work-logs?scope=self&limit=10').then(r=>r.items.map(l=>l.businessDate))`);
    check('all three business days hold one real log each', [today, yesterday, preday].every(day => all.includes(day)) && new Set(all).size === 3, all);
    await ev("document.querySelector('[data-action=new-log]').click()");
    check('backfill entry reports that all three days are already written',
      await waitFor(browser, "document.getElementById('appNotice').textContent.includes('都已有日志')") && await ev("document.getElementById('overlay').hidden"));
    const existingId=await ev(`Pandora.request('/work-logs?scope=self&from=${today}&to=${today}&limit=1').then(r=>r.items[0].id)`);
    await ev(`openLogForm(null,${JSON.stringify(today)})`);
    check('creation does not reopen existing log for editing',await waitFor(browser,"Pandora.idle()&&document.getElementById('overlay').hidden"));
    check('log page has no person filters or extra detail buttons',await ev("!document.getElementById('logFindingCard')&&!document.getElementById('logAuthorSelect')&&!document.querySelector('#logResults [data-action=p-open-log]')"));
    await ev(`state.logAll=true;state.logAuthorId=${JSON.stringify(fixture.foreignAuthor)};renderLog()`);
    check('legacy filter state cannot change personal results',await ev("document.querySelectorAll('#logResults [data-log-card]').length===3"));
    await ev(`document.querySelector('[data-log-card="${existingId}"] [data-task]').click()`);
    check('nested task link opens only task detail',await waitFor(browser,"Pandora.idle()&&!document.getElementById('overlay').hidden&&document.getElementById('sheetTitle').textContent!=='日志详情'&&document.getElementById('sheetBody').textContent.includes('本人负责但不创建')"));
    await ev('closeSheet()');
    await ev(`document.querySelector('[data-log-card="${existingId}"] p').click()`);
    check('clicking log opens detail and comments',await waitFor(browser,"Pandora.idle()&&document.getElementById('sheetTitle').textContent==='日志详情'&&!!document.getElementById('p-comment-input')"));
    await ev("document.getElementById('p-comment-input').value='直接点击后的评论';document.querySelector('[data-action=p-comment-submit]').click()");
    check('comment submits from direct log detail',await waitFor(browser,"Pandora.idle()&&document.querySelector('[data-comment-list]').textContent.includes('直接点击后的评论')"));
    await ev('closeSheet()');
    await ev(`document.querySelector('[data-log-card="${existingId}"]').focus()`);
    await browser.send('Input.dispatchKeyEvent',{type:'keyDown',key:'Enter',code:'Enter',windowsVirtualKeyCode:13,text:'\r'});
    check('keyboard card activation opens detail',await waitFor(browser,"Pandora.idle()&&!document.getElementById('overlay').hidden&&document.getElementById('sheetTitle').textContent==='日志详情'"));
    await ev('closeSheet()');
    await ev(`document.querySelector('[data-log-card="${existingId}"] [data-action=edit-log]').click()`);

    check('explicit edit remains available',await waitFor(browser,"Pandora.idle()&&document.getElementById('sheetTitle').textContent==='编辑日志'&&document.getElementById('lf-date').disabled"));
    await logGeometry('edit');
    await save('Edited from explicit log entry');
    check('explicit edit updates original log',await ev(`Pandora.request('/work-logs/'+${JSON.stringify(existingId)}).then(r=>r.body==='Edited from explicit log entry')`));
    await ev(`Pandora.openLogsFor(${JSON.stringify(fixture.foreignAuthor)})`);
    check('authorized person logs open separately',await waitFor(browser,`document.getElementById('sheetTitle').textContent==='人员日志'&&!!document.querySelector('#sheetBody [data-log-card="${fixture.foreignLog}"]')`));
    await ev(`document.querySelector('#sheetBody [data-log-card="${fixture.foreignLog}"] p').click()`);
    check('person log detail remains authorized',await waitFor(browser,"Pandora.idle()&&document.getElementById('sheetTitle').textContent==='日志详情'"));
    await ev("closeSheet();setPage('log');renderLog()");
    check('reading person log cannot mix it into personal list',await ev(`document.querySelectorAll('#logResults [data-log-card]').length===3&&!document.querySelector('#logResults [data-log-card="${fixture.foreignLog}"]')`));
    await ev('Pandora.reload()');
    check('reload still contains only personal logs',await ev("document.querySelectorAll('#logResults [data-log-card]').length===3&&filteredLogs(actor()).every(l=>l.authorId===Pandora.data.me.id)"));
    await browser.screenshot(path.join(screenshots,'personal-log-page-390.png'));
    await ev('Pandora.logout()');
    await waitFor(browser,"!!document.getElementById('backend-login')");
    await ev(`document.getElementById('login-user').value=${JSON.stringify(ids['alpha-one-employee'].identifier)};document.getElementById('login-password').value='Fixture@123456';document.getElementById('backend-login').requestSubmit()`);
    check('ordinary employee authenticates',await waitFor(browser,'Pandora.ready&&Pandora.idle()'));
    await ev("setPage('log')");
    await open('new-log');
    check('ordinary employee can choose existing log tag',await ev(`!!document.querySelector('#lf-tag option[value="${fixture.tagId}"]')`));
    await ev(`Pandora.mutation('concurrent-log-create','POST','/work-logs',{businessDate:${JSON.stringify(today)},body:'Created from another session'})`);
    await ev("document.getElementById('lf-content').value='Unsaved draft must not replace existing';document.querySelector('[data-action=save-log]').click()");
    check('duplicate create retains draft without entering edit',await waitFor(browser,"Pandora.idle()&&!drafts.log.id&&document.getElementById('sheetTitle').textContent==='写日志'&&document.getElementById('lf-error').textContent.includes('已有日志')"));
    check('concurrent original log is preserved',await ev(`Pandora.request('/work-logs?scope=self&from=${today}&to=${today}&limit=1').then(r=>r.items[0].body==='Created from another session')`));
    await ev('closeSheet();Pandora.logout()');
    await waitFor(browser,"!!document.getElementById('backend-login')");
    await ev(`document.getElementById('login-user').value=${JSON.stringify(ids.founder.identifier)};document.getElementById('login-password').value='Fixture@123456';document.getElementById('backend-login').requestSubmit()`);
    check('founder authenticates',await waitFor(browser,'Pandora.ready&&Pandora.idle()'));
    await ev("setPage('me')");
    check('founder retains tag management',await ev("!!document.querySelector('#page-me [data-action=p-manage-tags]')"));
    await ev("document.querySelector('#page-me [data-action=p-manage-tags]').click()");
    check('founder management opens',await waitFor(browser,"!!document.getElementById('p-tag-name')&&!document.getElementById('overlay').hidden"));
    check('backfill entry has no browser exceptions' , browser.errors.length === 0, browser.errors);
    report.result = 'PASS';
  } finally {
    browser.kill();
    fs.writeFileSync(output, JSON.stringify(report, null, 2) + '\n');
  }
}
main().catch((error) => {
  report.result = 'FAIL'; report.error = error.message;
  fs.writeFileSync(output, JSON.stringify(report, null, 2) + '\n');
  console.error(error); process.exitCode = 1;
});
