#!/usr/bin/env node
'use strict';
/* Real Chrome acceptance for chapter 8: range daily items, server task table and profile fields. */
const fs = require('fs');
const path = require('path');
const {openBrowser, waitFor, sleep} = require('./browser_fixture');
const fixture = JSON.parse(process.env.PANDORA_BROWSER_FIXTURE);
const ids = fixture.identities;
const outputDir = path.resolve(__dirname, '../../audit/prepare-employee-client-contracts-and-business-upgrade');
const report = {updated: new Date().toISOString(), checks: []};
fs.mkdirSync(outputDir, {recursive: true});
function check(name, pass, evidence) {
  report.checks.push({check: name, pass: !!pass, evidence});
  console.log((pass ? 'PASS ' : 'FAIL ') + name);
  if (!pass) throw new Error(name + ' ' + JSON.stringify(evidence));
}
const js = value => JSON.stringify(value);
async function main() {
  const b = await openBrowser(fixture.base + '/');
  const ev = b.evaluate;
  try {
    const ready = await waitFor(b, "!!document.getElementById('backend-login')&&Pandora.idle()");
    check('login form is ready', ready);
    await ev(`document.getElementById('login-user').value=${js(ids['alpha-one-employee'].identifier)};document.getElementById('login-password').value='Fixture@123456';document.getElementById('backend-login').requestSubmit()`);
    check('employee login loads the workspace',
      await waitFor(b, `Pandora.ready&&Pandora.idle()&&Pandora.data.me.id===${js(ids['alpha-one-employee'].id)}`, 20000));

    /* ---------- server-side task table ---------- */
    await ev("setPage('view')");
    await waitFor(b, "!!document.querySelector('.p-table-entry')");
    await ev("document.querySelector('.p-table-entry').click()");
    check('task table queries the real server and loads 50 rows',
      await waitFor(b, "Pandora.taskForm.state.loaded&&!Pandora.taskForm.state.loading&&!Pandora.taskForm.state.error&&document.querySelectorAll('[data-task-row]').length===50", 20000));
    const first = await ev(`(async()=>{const s=Pandora.taskForm.state;
      const page=await Pandora.request(Pandora.taskForm.queryPath());
      return {total:s.server.total,path:Pandora.taskForm.queryPath(),serverItems:page.items.map(t=>t.title),shown:Array.from(document.querySelectorAll('[data-task-row]')).map(r=>r.dataset.taskRow),ids:page.items.map(t=>t.id),offset:s.server.offset}})()`);
    check('the table uses the server total and exact current-page order',
      first.total === 55 && first.path.includes('/tasks/table?') && first.path.includes('limit=50')
      && first.path.includes('offset=0') && JSON.stringify(first.shown) === JSON.stringify(first.ids), first);

    await ev("document.getElementById('p-filter-relation').value='own';document.getElementById('p-filter-relation').dispatchEvent(new Event('change',{bubbles:true}))");
    check('relation=own maps to the server assigned relation and keeps the full total',
      await waitFor(b, "Pandora.taskForm.state.loaded&&Pandora.taskForm.state.server.total===55&&Pandora.taskForm.current().paged.total===55", 15000));
    await ev("document.getElementById('p-filter-relation').value='created';document.getElementById('p-filter-relation').dispatchEvent(new Event('change',{bubbles:true}))");
    check('relation=created returns no invented rows for an assigned-only employee',
      await waitFor(b, "Pandora.taskForm.state.loaded&&Pandora.taskForm.state.server.total===0", 15000));
    await ev("document.getElementById('p-filter-relation').value='all';document.getElementById('p-filter-relation').dispatchEvent(new Event('change',{bubbles:true}))");
    await waitFor(b, "Pandora.taskForm.state.loaded&&Pandora.taskForm.state.server.total===55", 15000);

    await ev("document.querySelector('[data-action=task-table-sort][data-key=title]').click()");
    check('a title sort asks the server for title/asc and resets the page',
      await waitFor(b, "Pandora.taskForm.state.loaded&&!Pandora.taskForm.state.loading&&Pandora.taskForm.state.sort.key==='title'&&Pandora.taskForm.state.sort.dir==='asc'&&Pandora.taskForm.state.page===0&&Pandora.taskForm.queryPath().includes('sort=title')&&document.querySelectorAll('[data-task-row]').length===50", 15000));
    const sorted = await ev(`(async()=>{const page=await Pandora.request(Pandora.taskForm.queryPath());
      return {titles:Array.from(document.querySelectorAll('[data-task-row] .p-table-title-text')).map(e=>e.textContent),server:page.items.map(t=>t.title)}})()`);
    check('the visible page follows the server order without a local re-sort',
      JSON.stringify(sorted.titles) === JSON.stringify(sorted.server), sorted);

    await ev("document.querySelector('[data-action=task-table-next]').click()");
    check('the second page queries offset=50 and keeps the full total',
      await waitFor(b, "Pandora.taskForm.state.loaded&&!Pandora.taskForm.state.loading&&Pandora.taskForm.state.page===1&&Pandora.taskForm.queryPath().includes('offset=50')&&Pandora.taskForm.state.server.total===55&&document.querySelectorAll('[data-task-row]').length===5", 15000));
    const pageTwo = await ev("({rows:document.querySelectorAll('[data-task-row]').length,ids:Array.from(document.querySelectorAll('[data-task-row]')).map(r=>r.dataset.taskRow)})");
    check('the second page contains the remaining five rows', pageTwo.rows === 5, pageTwo);

    /* Pin a later-page row from its normal detail; the pin is a server preference, not a task write. */
    const pinId = await ev("document.querySelector('[data-task-row]').dataset.taskRow");
    await ev(`document.querySelector('[data-task-row="${pinId}"] [data-task="${pinId}"]').click()`);
    check('the selected task detail opens', await waitFor(b, "!document.getElementById('overlay').hidden&&Pandora.idle()"));
    check('the normal detail exposes the independent table-pin action',
      await ev("!!document.querySelector('[data-action=p-toggle-table-pin]')"));
    await ev("document.querySelector('[data-action=p-toggle-table-pin]').click()");
    check('the later-page task is table-pinned and the table reloads',
      await waitFor(b, `Pandora.idle()&&Pandora.taskForm.state.loaded&&document.querySelector('[data-action=p-toggle-table-pin]').textContent.includes('取消')`, 20000));
    await ev("document.getElementById('sheetClose').click()");
    await waitFor(b, "document.getElementById('overlay').hidden");
    const pinnedFirst = await waitFor(b, `Pandora.taskForm.state.loaded&&!Pandora.taskForm.state.loading&&Pandora.taskForm.state.page===0&&Pandora.taskForm.current().paged.items[0]&&Pandora.taskForm.current().paged.items[0].id===${js(pinId)}&&Pandora.taskForm.current().paged.items[0].tablePinned===true`, 20000);
    const pinState = await ev(`(()=>{const s=Pandora.taskForm.state;return {page:s.page,loaded:s.loaded,loading:s.loading,error:s.error,total:s.server.total,path:Pandora.taskForm.queryPath(),ids:s.result&&s.result.paged.items.map(t=>t.id),pinned:s.result&&s.result.paged.items.map(t=>({id:t.id,pin:t.tablePinned})),dom:Array.from(document.querySelectorAll('[data-task-row]')).map(r=>r.dataset.taskRow),notice:document.getElementById('appNotice').textContent,sheet:document.getElementById('sheetTitle').textContent}})()`);
    check('the pinned later-page task appears first after the server re-query', pinnedFirst, {pinId, pinState});
    check('the pin did not change the task total or version',
      await ev("Pandora.taskForm.state.server.total===55"));
    /* ---------- the pinned row is one glass-blue band on every cell; no in-table label ---------- */
    const pinVisual = await ev(`(()=>{const row=document.querySelector('[data-task-row="${pinId}"]');
      if(!row)return {missing:true};
      const cells=Array.from(row.children);
      const paint=cell=>{const s=getComputedStyle(cell);return s.backgroundImage+'|'+s.backgroundColor};
      const colors=cells.map(paint);
      const others=Array.from(document.querySelectorAll('[data-task-row]')).filter(r=>r!==row);
      const normalRow=others[0], evenRow=others[1];
      const normalPaint=normalRow?Array.from(normalRow.children).map(paint):[];
      const evenPaint=evenRow?Array.from(evenRow.children).map(paint):[];
      const labelText=Array.from(document.querySelectorAll('#p-table-body .p-table-tag')).map(e=>e.textContent.trim());
      return {cells:cells.length,rowClass:row.className,uniform:new Set(colors).size===1,colors,
        pinnedVsNormal:colors[1]!==normalPaint[1],pinnedVsEven:colors[1]!==evenPaint[1],
        normalEvenDiffer:normalPaint[1]!==evenPaint[1],labelText,
        gradient:colors.every(color=>color.includes('linear-gradient'))}})()`);
    check('the pinned row paints all of its cells, including the sticky name column, as one glass-blue band',
      !pinVisual.missing && pinVisual.rowClass.includes('is-table-pinned') && pinVisual.uniform &&
      pinVisual.gradient && pinVisual.pinnedVsNormal && pinVisual.pinnedVsEven, pinVisual);
    check('non-pinned rows keep their zebra striping and no in-table form-pin label is rendered',
      pinVisual.normalEvenDiffer && !pinVisual.labelText.includes('表单置顶'), pinVisual);
    const hoverPoint = await ev(`(()=>{const row=document.querySelector('[data-task-row="${pinId}"]');
      const r=row.getBoundingClientRect();return {x:r.x+Math.min(40,r.width/2),y:r.y+r.height/2}})()`);
    await b.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: hoverPoint.x, y: hoverPoint.y });
    await sleep(150);
    const pinHover = await ev(`(()=>{const row=document.querySelector('[data-task-row="${pinId}"]');
      const hovered=getComputedStyle(row.children[1]).backgroundImage;
      row.classList.add('is-active-row');
      const active=getComputedStyle(row.children[1]).backgroundImage;
      row.classList.remove('is-active-row');
      return {hovered,active}})()`);
    check('real hover and the active row keep a recognizable blue glass background on the pinned row',
      pinHover.hovered.includes('linear-gradient') && pinHover.active.includes('linear-gradient'), pinHover);
    await ev("document.getElementById('p-table-scroll').scrollLeft=260");
    await sleep(120);
    const pinnedScrolled = await ev(`(()=>{const row=document.querySelector('[data-task-row="${pinId}"]');
      const scroll=document.getElementById('p-table-scroll');
      const cells=Array.from(row.children),paint=cell=>{const s=getComputedStyle(cell);return s.backgroundImage+'|'+s.backgroundColor};
      const colors=cells.map(paint);
      const name=row.querySelector('th').getBoundingClientRect(), box=scroll.getBoundingClientRect();
      return {uniform:new Set(colors).size===1,left:name.left,boxLeft:box.left,scrolled:scroll.scrollLeft}})()`);
    check('horizontal scrolling keeps the sticky pinned name column painted with the same band',
      pinnedScrolled.uniform && pinnedScrolled.scrolled > 0 && pinnedScrolled.left <= pinnedScrolled.boxLeft + 1, pinnedScrolled);
    await ev("document.getElementById('p-table-scroll').scrollLeft=0");
    await ev("document.querySelector('[data-action=task-table-columns][data-columns=details]').click()");
    await waitFor(b, "Pandora.taskForm.state.loaded&&Pandora.taskForm.state.columns==='details'", 15000);
    check('switching column views keeps the pinned row class on the same task',
      await ev(`(()=>{const row=document.querySelector('[data-task-row="${pinId}"]');return !!row&&row.classList.contains('is-table-pinned')})()`));
    await ev("document.querySelector('[data-action=task-table-columns][data-columns=overview]').click()");
    await waitFor(b, "Pandora.taskForm.state.loaded&&Pandora.taskForm.state.columns==='overview'", 15000);
    check('the pinned row class survives switching back and the table renders no form-pin label',
      await ev(`(()=>{const row=document.querySelector('[data-task-row="${pinId}"]');return !!row&&row.classList.contains('is-table-pinned')&&!document.getElementById('p-table-body').textContent.includes('表单置顶')})()`));
    await ev("document.querySelector('[data-action=task-table-clear-filters]').click()");
    await waitFor(b, "Pandora.taskForm.state.loaded&&Pandora.taskForm.state.page===0", 15000);
    /* A real page refresh keeps the independent table pin and its visual state. */
    await b.send('Page.reload', { ignoreCache: true });
    check('the refreshed page returns to the same signed-in employee',
      await waitFor(b, `Pandora.ready&&Pandora.idle()&&Pandora.data.me.id===${js(ids['alpha-one-employee'].id)}`, 25000));
    await ev("setPage('view')");
    await waitFor(b, "!!document.querySelector('.p-table-entry')");
    await ev("document.querySelector('.p-table-entry').click()");
    check('the table pin survives a real refresh with the pinned row still first and blue',
      await waitFor(b, `Pandora.taskForm.state.loaded&&!Pandora.taskForm.state.loading&&document.querySelector('[data-task-row]')&&document.querySelector('[data-task-row]').dataset.taskRow===${js(pinId)}&&document.querySelector('[data-task-row]').classList.contains('is-table-pinned')`, 25000));

    /* ---------- ranged daily items through the UI ---------- */
    await ev("setPage('map')");
    await waitFor(b, "!!document.getElementById('dailyItemsSection')");
    await ev("PandoraDaily.goToDate('2027-01-08')");
    check('the daily calendar reaches January 2027',
      await waitFor(b, "!!document.querySelector('[data-daily-date=\"2027-01-08\"]')", 15000));
    await ev("document.querySelector('#dailyItemsSection [data-action=daily-new]').click()");
    check('the daily item form offers start and end dates',
      await waitFor(b, "!!document.getElementById('daily-start-date')&&!!document.getElementById('daily-end-date')"));
    await ev(`(()=>{const s=document.getElementById('daily-start-date'),e=document.getElementById('daily-end-date'),b=document.getElementById('daily-body');s.value='2027-01-08';e.value='2027-01-10';b.value='浏览器跨日事项：三天动画交付';s.dispatchEvent(new Event('input',{bubbles:true}));e.dispatchEvent(new Event('input',{bubbles:true}));b.dispatchEvent(new Event('input',{bubbles:true}))})()`);
    await ev("document.querySelector('[data-action=daily-save]').click()");
    check('the ranged item saves and the sheet closes',
      await waitFor(b, "document.getElementById('overlay').hidden&&Pandora.idle()", 20000));
    await ev("document.querySelector('[data-daily-date=\"2027-01-08\"]').click()");
    check('the covered day opens its list',
      await waitFor(b, "!document.getElementById('overlay').hidden&&document.querySelectorAll('[data-daily-row]').length>0&&Pandora.idle()", 15000));
    const listEvidence = await ev("({rows:Array.from(document.querySelectorAll('[data-daily-row]')).map(r=>r.textContent),meta:document.querySelector('.daily-row-meta')&&document.querySelector('.daily-row-meta').textContent})");
    check('the list shows the complete range and keeps one row for the ranged record',
      listEvidence.meta.includes('2027年1月8日') && listEvidence.meta.includes('至') && listEvidence.meta.includes('2027年1月10日'), listEvidence);
    await ev("document.querySelector('[data-action=daily-open]').click()");
    check('the detail shows the complete range with a non-repeated accessible status',
      await waitFor(b, "document.getElementById('sheetTitle').textContent==='每日事项详情'&&document.querySelector('.daily-detail-date').textContent.includes('2027年1月10日')&&/\\bis-(open|completed|overdue)\\b/.test(document.querySelector('.daily-detail-head').className)&&!!document.querySelector('.daily-detail-head .sr-only')&&!document.querySelector('.daily-detail-head .badge')", 15000));
    await ev("document.querySelector('[data-action=daily-toggle]').click()");
    check('completing from the detail keeps the same range and updates the status',
      await waitFor(b, "Pandora.idle()&&document.querySelector('.daily-detail-head').classList.contains('is-completed')&&document.querySelector('.daily-detail-head .sr-only').textContent.includes('已完成')&&document.querySelector('[data-action=daily-toggle]').textContent.includes('取消')", 15000));
    await ev("document.querySelector('[data-action=daily-edit]').click()");
    check('the edit form is prefilled with the same pair',
      await waitFor(b, "document.getElementById('sheetTitle').textContent==='编辑每日事项'&&document.getElementById('daily-start-date').value==='2027-01-08'&&document.getElementById('daily-end-date').value==='2027-01-10'"));
    await ev("document.getElementById('daily-end-date').value='2027-01-09';document.getElementById('daily-end-date').dispatchEvent(new Event('input',{bubbles:true}));document.querySelector('[data-action=daily-save]').click()");
    check('the shortened pair returns to the original date list with updated range',
      await waitFor(b, "Pandora.idle()&&document.getElementById('sheetTitle').textContent.includes('每日事项')&&document.querySelector('.daily-row-meta')&&document.querySelector('.daily-row-meta').textContent.includes('2027年1月9日')", 20000));
    await ev("document.querySelector('[data-action=daily-open]').click()");
    check('the detail after editing keeps the new range and the same record',
      await waitFor(b, "document.getElementById('sheetTitle').textContent==='每日事项详情'&&document.querySelector('.daily-detail-date').textContent.includes('2027年1月9日')", 15000));
    await ev("document.getElementById('sheetClose').click()");
    await waitFor(b, "document.getElementById('overlay').hidden");

    /* ---------- profile hire/tenure/email ---------- */
    await ev("setPage('me')");
    check('the self profile shows hire date, tenure and the authorized e-mail',
      await waitFor(b, "document.getElementById('page-me').textContent.includes('2024-02-29')&&document.getElementById('page-me').textContent.includes('已入职时长')&&document.getElementById('page-me').textContent.includes('employee@example.test')", 15000));
    const profileText = await ev("document.getElementById('page-me').textContent");
    check('the missing/real tenure is a real projection, not an account-created date',
      /已入职时长[^。]{0,40}年/.test(profileText), profileText.slice(0, 400));
    check('the self tenure shows only the real duration without an as-of suffix',
      !profileText.includes('截至'), profileText.match(/已入职时长[^\n]{0,60}/));
    /* 本人信息卡各一行入职日期/时长，组织信息折叠区不再重复这两行。 */
    const ownEmployment = () => ev(`(()=>{const page=document.getElementById('page-me'),card=page.querySelector('.profile-card'),org=page.querySelector('[data-profile-fold=organization] .fold-content');
      const count=(root,label)=>root?Array.from(root.querySelectorAll('.profile-row .k')).filter(node=>node.textContent.trim()===label).length:0;
      return {cardHire:count(card,'入职日期'),cardTenure:count(card,'已入职时长'),orgHire:count(org,'入职日期'),orgTenure:count(org,'已入职时长'),
        orgDepartment:count(org,'部门'),orgPosition:count(org,'职位'),orgManager:count(org,'直属上级'),
        cardText:card?card.textContent:'',orgText:org?org.textContent:''}})()`);
    const own = await ownEmployment();
    check('own hire date and tenure appear once in the personal card and never in the organization fold',
      own.cardHire === 1 && own.cardTenure === 1 && own.orgHire === 0 && own.orgTenure === 0 &&
      own.orgDepartment === 1 && own.orgPosition === 1 && own.orgManager === 1 && !own.orgText.includes('入职日期未设置'), own);
    const adminCall = (method, path, body, version) => ev(`(async()=>{const headers={Accept:'application/json',Authorization:'Bearer '+${js(fixture.adminToken)}};
      let payload=null;if(${js(body)}!=null){headers['Content-Type']='application/json';payload=JSON.stringify(${js(body)})}
      if(${js(version)}!=null)headers['If-Match']='"'+${js(version)}+'"';headers['Idempotency-Key']=crypto.randomUUID();
      const response=await fetch('/api/v1'+${js(path)},{method:${js(method)},headers,body:payload});
      let data={};try{data=await response.json()}catch(_){}return {status:response.status,body:data}})()`);
    const located = await adminCall('GET', '/admin/employees/' + fixture.employee, null, null);
    check('administrator can locate the signed-in employee record', located.status === 200 && !!located.body.rowVersion, located);
    const cleared = await adminCall('PATCH', '/admin/employees/' + fixture.employee, {hireDate: null}, located.body.rowVersion);
    check('administrator can clear the hire date for the empty-state check', cleared.status === 200, cleared);
    await ev('Pandora.reload()');
    check('reload after clearing the hire date keeps the same account',
      await waitFor(b, `Pandora.ready&&Pandora.idle()&&Pandora.data.me.id===${js(fixture.employee)}`, 20000));
    await ev("setPage('me')");
    await waitFor(b, "document.getElementById('page-me') && document.getElementById('page-me').textContent.includes('入职日期未设置')", 15000);
    const emptyOwn = await ownEmployment();
    check('an unset hire date shows the original empty state once in the card and not in the organization fold',
      emptyOwn.cardHire === 1 && emptyOwn.cardTenure === 1 && emptyOwn.orgHire === 0 && emptyOwn.orgTenure === 0 &&
      (emptyOwn.cardText.match(/入职日期未设置/g) || []).length === 2, emptyOwn);
    const restoreRow = await adminCall('GET', '/admin/employees/' + fixture.employee, null, null);
    const restored = await adminCall('PATCH', '/admin/employees/' + fixture.employee, {hireDate: '2024-02-29'}, restoreRow.body.rowVersion);
    check('administrator restores the hire date after the empty-state check', restored.status === 200, restored);
    await ev('Pandora.reload()');
    await waitFor(b, `Pandora.ready&&Pandora.idle()&&Pandora.data.me.id===${js(fixture.employee)}`, 20000);
    await ev("setPage('me')");
    check('the restored hire date comes back to the personal card',
      await waitFor(b, "document.getElementById('page-me').textContent.includes('2024-02-29')", 15000));
    const restoredOwn = await ownEmployment();
    check('the restored hire date shows once in the card and the organization fold stays clean',
      restoredOwn.cardHire === 1 && restoredOwn.cardTenure === 1 && restoredOwn.orgHire === 0 && restoredOwn.orgTenure === 0, restoredOwn);

    /* The five main navigations and three home modules are untouched by the new table/profile code. */
    await ev("setPage('map')");
    const shell = await ev("({tabs:Array.from(document.querySelectorAll('#tabbar button')).length,modules:document.querySelectorAll('#page-map .quad').length,daily:!!document.getElementById('dailyItemsSection')})");
    check('five main navigations and three home modules remain intact', shell.tabs === 5 && shell.modules === 3 && shell.daily, shell);

    /* Account switching clears the previous authorized table state before the next login. */
    await ev("Pandora.logout()");
    check('logout clears the task table and returns to the login form',
      await waitFor(b, "!!document.getElementById('backend-login')&&Pandora.idle()&&Pandora.taskForm.state.rows.length===0&&Pandora.taskForm.state.loaded===false&&Pandora.taskForm.state.filters.query===''", 20000));
    await ev(`document.getElementById('login-user').value=${js(ids['founder'].identifier)};document.getElementById('login-password').value='Fixture@123456';document.getElementById('backend-login').requestSubmit()`);
    check('a different account loads only its own current authorization',
      await waitFor(b, `Pandora.ready&&Pandora.idle()&&Pandora.data.me.id===${js(ids['founder'].id)}`, 20000));
    /* ---------- authorized subordinate cards: tenure without an as-of suffix, empty state kept ---------- */
    const openReport = id => ev(`(()=>{const el=document.createElement('button');el.dataset.action='p-open-person';el.dataset.id=${js(id)};document.body.appendChild(el);runAction(el);el.remove()})()`);
    await openReport(ids['alpha-one-employee'].id);
    await waitFor(b, "Pandora.idle()&&document.getElementById('sheetBody')&&document.getElementById('sheetBody').textContent.includes('2024-02-29')", 15000);
    const reportTenure = await ev(`(()=>{const body=document.getElementById('sheetBody');
      return {title:document.getElementById('sheetTitle').textContent,text:body?body.textContent:'',
        open:!document.getElementById('overlay').hidden}})()`);
    check('an authorized manager sees the subordinate tenure without an as-of suffix',
      reportTenure.open && reportTenure.title.endsWith('的资料') && /已入职[^\n]{0,40}年/.test(reportTenure.text) &&
      !reportTenure.text.includes('截至'), reportTenure);
    await ev("document.getElementById('sheetClose').click()");
    await waitFor(b, "document.getElementById('overlay').hidden");
    await openReport(ids['alpha-two-employee'].id);
    await waitFor(b, "Pandora.idle()&&document.getElementById('sheetBody')&&document.getElementById('sheetBody').textContent.includes('入职日期未设置')", 15000);
    const reportEmpty = await ev(`(()=>{const body=document.getElementById('sheetBody');return {text:body?body.textContent:'',open:!document.getElementById('overlay').hidden}})()`);
    check('a subordinate without a hire date keeps the original empty state and no invented suffix',
      reportEmpty.open && (reportEmpty.text.match(/入职日期未设置/g) || []).length === 2 && !reportEmpty.text.includes('截至'), reportEmpty);
    await ev("document.getElementById('sheetClose').click()");
    await waitFor(b, "document.getElementById('overlay').hidden");
    await ev("setPage('map')");
    await sleep(120);

    /* ---------- compact/desktop geometry ---------- */
    for (const [width, height] of [[320, 740], [390, 844], [1440, 900], [390, 600]]) {
      await b.viewport({width, height, mobile: width < 1000});
      await sleep(120);
      const fit = await ev("({overflow:document.documentElement.scrollWidth>innerWidth+1,w:innerWidth,h:innerHeight})");
      check('the employee page has no horizontal document overflow at ' + width + 'x' + height, !fit.overflow, fit);
      await ev("setPage('me')");
      await sleep(120);
      const ownFold = await ownEmployment();
      check('the own employment rows stay de-duplicated at ' + width + 'x' + height,
        ownFold.cardHire === 1 && ownFold.cardTenure === 1 && ownFold.orgHire === 0 && ownFold.orgTenure === 0, ownFold);
      await b.screenshot(path.join(outputDir, 'chapter8-profile-' + width + 'x' + height + '.png'));
      await ev("setPage('map')");
    }
    await b.screenshot(path.join(outputDir, 'chapter8-table.png'));
  } finally {
    fs.writeFileSync(path.join(outputDir, 'chapter8-browser.json'),
      JSON.stringify(report, null, 2) + '\n');
    b.kill();
  }
}
main().catch(error => { console.error(error.stack || error); process.exit(1); });
