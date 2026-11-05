#!/usr/bin/env node
'use strict';
/* Real-browser acceptance for the three-section home page and the independent daily-item calendar. */
const fs = require('fs');
const path = require('path');
const { openBrowser, waitFor, sleep } = require('./browser_fixture');
const fixture = JSON.parse(process.env.PANDORA_BROWSER_FIXTURE);
const ids = fixture.identities;
const output = path.resolve(__dirname, '../../audit/redesign-home-daily-items/daily-items-browser.json');
const report = { updated: new Date().toISOString(), checks: [] };
function check(name, pass, evidence) {
  report.checks.push({ check: name, pass: !!pass, evidence });
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
    check('employee login loads the home page', await waitFor(b, `Pandora.ready&&Pandora.idle()&&Pandora.data.me.id===${js(ids['alpha-one-employee'].id)}`, 20000));

    /* -------- navigation and three modules -------- */
    const nav = await ev(`(()=>{const tabs=Array.from(document.querySelectorAll('#tabbar button span')).map(e=>e.textContent);return {tabs,title:document.getElementById('pageTitle').textContent,heading:document.querySelector('#page-map h1')?true:true}})()`);
    check('navigation uses 首页 and 公司 while keeping five entries', JSON.stringify(nav.tabs) === JSON.stringify(['首页', '公司', '日志', '统计', '我的']) && nav.title === '首页', nav);
    const modules = await ev(`(()=>{const quads=Array.from(document.querySelectorAll('#page-map .quad'));return {count:quads.length,order:quads.map(q=>q.className),company:!!document.querySelector('#page-map .company-quad'),tasks:!!document.querySelector('#page-map .tasks-quad'),daily:!!document.querySelector('#page-map #dailyItemsSection'),logs:!!document.querySelector('#page-map .logs-quad'),personal:!!document.querySelector('#page-map .personal-quad'),newPersonal:!!document.querySelector('#page-map [data-action="new-personal"]'),dailyColumn:getComputedStyle(document.querySelector('#dailyItemsSection')).gridColumnStart,grid:getComputedStyle(document.querySelector('.map-grid')).gridTemplateColumns,priorities:Array.from(document.querySelectorAll('.tasks-quad .home-task-priority')).map(e=>({width:e.getBoundingClientRect().width,visible:e.getBoundingClientRect().right<=e.closest('.q-body').getBoundingClientRect().right+1}))}})()`);
    check('home has exactly 事件纪、任务看板、每日事项 and no old log/personal card',
      modules.count === 3 && modules.company && modules.tasks && modules.daily && !modules.logs && !modules.personal && !modules.newPersonal, modules);
    check('the daily section spans both columns below the two upper cards',
      await ev("getComputedStyle(document.querySelector('#dailyItemsSection')).gridColumnEnd==='-1'"), { columnStart: modules.dailyColumn });
    check('task items keep their title and a fully visible right-aligned priority',
      modules.priorities.length > 0 && modules.priorities.every(p => p.width > 10 && p.visible), modules.priorities);

    /* -------- calendar structure and markers -------- */
    const calendar = await ev(`(()=>{const days=Array.from(document.querySelectorAll('.daily-weekdays span')).map(e=>e.textContent);const cells=Array.from(document.querySelectorAll('[data-daily-date]'));const today=document.querySelector('[data-daily-date="${fixture.today}"]');const week=document.querySelector('.daily-week');return {weekdayCount:document.querySelectorAll('.daily-weekdays span').length,weekdays:days.filter(Boolean),cells:cells.length,firstCellBox:week?week.querySelector('.daily-cell').getBoundingClientRect().height:0,weekCells:week?week.querySelectorAll('.daily-cell').length:0,todayLabel:today?today.getAttribute('aria-label'):null,lunar:document.body.textContent.includes('农历'),monthLabels:Array.from(document.querySelectorAll('.daily-month-label')).map(e=>e.textContent),scroller:!!document.getElementById('dailyScroller'),fab:!!document.querySelector('.daily-fab'),weekdayFixed:getComputedStyle(document.querySelector('.daily-weekdays')).position}})()`);
    check('calendar shows a fixed Monday-to-Sunday header and seven-row week columns',
      calendar.weekdayCount === 8 && JSON.stringify(calendar.weekdays) === JSON.stringify(['周一', '周二', '周三', '周四', '周五', '周六', '周日']) && calendar.weekCells === 7 && calendar.firstCellBox >= 44 && !calendar.lunar, calendar);
    check('the calendar exposes real month labels, a horizontal scroller and a floating add action',
      calendar.scroller && calendar.fab && calendar.monthLabels.length >= 3 && calendar.monthLabels.some(text => text === fixture.today.slice(0, 4) + '年' + Number(fixture.today.slice(5, 7)) + '月'), calendar);

    const continuity = await ev(`(()=>{const cells=Array.from(document.querySelectorAll('[data-daily-date]'));const dates=cells.map(c=>c.dataset.dailyDate);const unique=new Set(dates).size===dates.length;let consecutive=true;for(let i=1;i<dates.length;i++){const a=new Date(dates[i-1]+'T00:00:00Z'),b=new Date(dates[i]+'T00:00:00Z');if(b-a!==86400000)consecutive=false;}const scroller=document.getElementById('dailyScroller').getBoundingClientRect();const today=document.querySelector('[data-daily-date="${fixture.today}"]');const box=today?today.getBoundingClientRect():null;return {unique,consecutive,count:dates.length,todayVisible:!!box&&box.left>=scroller.left-1&&box.right<=scroller.right+1}})()`);
    check('the loaded week sequence is consecutive with no duplicate date', continuity.unique && continuity.consecutive && continuity.count >= 21, continuity);
    check('the calendar initially positions the company today inside the viewport', continuity.todayVisible, continuity);

    const markerExpect = [[0, 1], [1, 2], [2, 3], [3, 4], [4, 5], [5, 6]];
    for (const [offset, count] of markerExpect) {
      const date = new Date(fixture.today + 'T00:00:00Z');
      date.setUTCDate(date.getUTCDate() + offset);
      const key = date.toISOString().slice(0, 10);
      const ready = await waitFor(b, `(()=>{const c=document.querySelector('[data-daily-date="${key}"]');return !!c&&c.getAttribute('aria-label').includes('未完成${count}条')})()`, 12000);
      const marker = await ev(`(()=>{const c=document.querySelector('[data-daily-date="${key}"]');return {aria:c?c.getAttribute('aria-label'):null,marks:Array.from(c?c.querySelectorAll('.daily-mark'):[]).map(m=>({cls:m.className,width:m.getBoundingClientRect().width,height:m.getBoundingClientRect().height}))}})()`);
      const expectedWidth = Math.min(count, 5) === count ? 4 + (count - 1) * 3 : 16;
      check(`day ${offset} renders ${count} open item(s) with the clamped marker width ${expectedWidth}`,
        ready && marker.marks.length === 1 && Math.abs(marker.marks[0].width - expectedWidth) < 1 && marker.marks[0].height === 4 && marker.aria.includes('未完成' + count + '条'), marker);
    }
    const mixedDate = new Date(fixture.today + 'T00:00:00Z');
    mixedDate.setUTCDate(mixedDate.getUTCDate() + 6);
    const mixedKey = mixedDate.toISOString().slice(0, 10);
    const mixed = await ev(`(()=>{const c=document.querySelector('[data-daily-date="${mixedKey}"]');return {aria:c?c.getAttribute('aria-label'):null,marks:Array.from(c?c.querySelectorAll('.daily-mark'):[]).map(m=>({cls:m.className,width:m.getBoundingClientRect().width,height:m.getBoundingClientRect().height}))}})()`);
    check('a mixed day shows blue and grey marks side by side with exact accessible counts',
      mixed.marks.length === 2 && mixed.marks[0].cls.includes('is-open') && mixed.marks[1].cls.includes('is-done') && mixed.aria.includes('未完成1条') && mixed.aria.includes('已完成1条'), mixed);

    /* -------- horizontal slide must not open a list -------- */
    const before = await ev("document.getElementById('dailyScroller').scrollLeft");
    const point = await ev(`(()=>{const c=document.querySelector('[data-daily-date="${fixture.today}"]');const r=c.getBoundingClientRect();return {x:r.left+r.width/2,y:r.top+r.height/2}})()`);
    await b.send('Input.dispatchMouseEvent', { type: 'mousePressed', x: point.x, y: point.y, button: 'left', clickCount: 1 });
    await b.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: point.x - 90, y: point.y, button: 'left' });
    await b.send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: point.x - 90, y: point.y, button: 'left', clickCount: 1 });
    await sleep(300);
    const afterSlide = await ev("({open:!document.getElementById('overlay').hidden,left:document.getElementById('dailyScroller').scrollLeft})");
    check('a horizontal drag does not open a day list', !afterSlide.open, { before, afterSlide });
    await ev("document.getElementById('dailyScroller').scrollLeft=" + (before + 120) + ";document.getElementById('dailyScroller').dispatchEvent(new Event('scroll'))");
    const scrolled = await ev("document.getElementById('dailyScroller').scrollLeft");
    check('the calendar scrolls horizontally within its own region', scrolled > before, { before, scrolled });
    await ev("document.getElementById('dailyScroller').scrollLeft=0;document.getElementById('dailyScroller').dispatchEvent(new Event('scroll'))");

    /* -------- keyboard activation -------- */
    await ev("document.getElementById('dailyScroller').focus()");
    await b.send('Input.dispatchKeyEvent', { type: 'rawKeyDown', key: 'ArrowRight', code: 'ArrowRight', windowsVirtualKeyCode: 39 });
    await b.send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'ArrowRight', code: 'ArrowRight', windowsVirtualKeyCode: 39 });
    const focused = await ev("document.activeElement&&document.activeElement.dataset?document.activeElement.dataset.dailyDate:null");
    check('arrow keys move focus between real date cells', !!focused, focused);
    await b.send('Input.dispatchKeyEvent', { type: 'rawKeyDown', key: 'Enter', code: 'Enter', windowsVirtualKeyCode: 13 });
    await b.send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Enter', code: 'Enter', windowsVirtualKeyCode: 13 });
    const opened = await waitFor(b, "!document.getElementById('overlay').hidden&&document.getElementById('sheetTitle').textContent.includes('每日事项')&&Pandora.idle()", 12000);
    check('Enter opens the day list for the keyboard-focused date', opened);
    const listState = await ev("({title:document.getElementById('sheetTitle').textContent,rows:document.querySelectorAll('#sheetBody .daily-row').length,empty:document.getElementById('sheetBody').textContent.includes('还没有每日事项'),foot:document.querySelectorAll('#sheetFoot button').length})");
    check('the day list shows that date, its items and a create action', listState.title.includes('每日事项') && listState.rows >= 1 && listState.foot >= 1, listState);
    await b.screenshot(output.replace('daily-items-browser.json', 'daily-list.png'));

    /* -------- empty day + create from the list -------- */
    const emptyDate = new Date(fixture.today + 'T00:00:00Z');
    emptyDate.setUTCDate(emptyDate.getUTCDate() + 20);
    const emptyKey = emptyDate.toISOString().slice(0, 10);
    await ev("document.getElementById('sheetClose').click()");
    await waitFor(b, "document.getElementById('overlay').hidden");
    await ev(`document.querySelector('[data-daily-date="${emptyKey}"]').click()`);
    await waitFor(b, "!document.getElementById('overlay').hidden&&Pandora.idle()", 12000);
    const emptyState = await ev("({empty:document.getElementById('sheetBody').textContent.includes('还没有每日事项'),create:!!document.querySelector('#sheetFoot [data-action=daily-new]')})");
    check('an empty day shows an empty state and a create action', emptyState.empty && emptyState.create, emptyState);

    /* -------- create with HTML-like text, long text and a real date -------- */
    const longText = '<b>不是标签</b>\n第二行 ' + '长文本'.repeat(20);
    await ev("document.querySelector('#sheetFoot [data-action=daily-new]').click()");
    await waitFor(b, "document.getElementById('sheetTitle').textContent==='新增每日事项'&&!!document.getElementById('daily-date')");
    const defaultDate = await ev("document.getElementById('daily-date').value");
    check('creating from a day uses that day as the default date', defaultDate === emptyKey, { defaultDate, emptyKey });
    await ev(`document.getElementById('daily-date').value=${js(emptyKey)};document.getElementById('daily-body').value=${js(longText)};document.querySelector('#sheetFoot [data-action=daily-save]').click()`);
    const saved = await waitFor(b, "document.getElementById('overlay').hidden&&Pandora.idle()", 15000);
    const created = await ev(`Pandora.request('/daily-items?date=${emptyKey}').then(r=>r.items[0]||null)`);
    check('saving creates a real item with the plain text preserved', saved && created && created.body === longText && /^[0-9a-f]{8}-/.test(created.id), { saved, created: created && { id: created.id, body: created.body } });
    check('the empty day now shows one open marker',
      await waitFor(b, `(()=>{const c=document.querySelector('[data-daily-date="${emptyKey}"]');return !!c&&c.getAttribute('aria-label').includes('未完成1条')})()`, 12000));
    await b.screenshot(output.replace('daily-items-browser.json', 'daily-calendar.png'));

    /* -------- inline completion keeps the row in place and does not open the detail -------- */
    await ev(`document.querySelector('[data-daily-date="${emptyKey}"]').click()`);
    await waitFor(b, "!document.getElementById('overlay').hidden&&Pandora.idle()", 12000);
    const rowOrder = await ev("Array.from(document.querySelectorAll('#sheetBody .daily-row')).map(r=>r.dataset.dailyRow)");
    await ev("document.querySelector('#sheetBody [data-action=daily-toggle]').click()");
    await waitFor(b, "Pandora.idle()", 15000);
    const inline = await ev("({title:document.getElementById('sheetTitle').textContent,rows:Array.from(document.querySelectorAll('#sheetBody .daily-row')).map(r=>r.dataset.dailyRow),checked:document.querySelector('#sheetBody .daily-check')?document.querySelector('#sheetBody .daily-check').getAttribute('aria-checked'):null,open:!document.getElementById('overlay').hidden})");
    check('the inline completion control never opens the detail and keeps the row in place',
      inline.open && inline.title.includes('每日事项') && inline.title !== '每日事项详情' && inline.checked === 'true' && JSON.stringify(inline.rows) === JSON.stringify(rowOrder), { rowOrder, inline });
    check('the inline completion updates the calendar marker',
      await waitFor(b, `(()=>{const c=document.querySelector('[data-daily-date="${emptyKey}"]');return !!c&&c.getAttribute('aria-label').includes('已完成1条')})()`, 12000));
    await ev("document.querySelector('#sheetBody [data-action=daily-toggle]').click()");
    await waitFor(b, "Pandora.idle()", 15000);
    check('toggling back restores the inline unchecked state',
      await waitFor(b, `(()=>{const c=document.querySelector('#sheetBody .daily-check');return c&&c.getAttribute('aria-checked')==='false'})()`, 12000));

    /* -------- detail is plain text and completion is reversible -------- */
    await ev(`document.querySelector('#sheetBody [data-action="daily-open"]').click()`);
    await waitFor(b, "document.getElementById('sheetTitle').textContent==='每日事项详情'&&Pandora.idle()", 12000);
    const detail = await ev("({text:document.getElementById('sheetBody').textContent,html:document.getElementById('sheetBody').innerHTML,date:document.querySelector('.daily-detail-date').textContent,actions:Array.from(document.querySelectorAll('#sheetFoot button')).map(b=>b.textContent)})");
    check('detail shows the date and the text literally without executing HTML',
      detail.date.includes('2026') && detail.text.includes('<b>不是标签</b>') && !detail.html.includes('<b>不是标签</b>') && detail.actions.some(t => t.includes('标记完成')) && detail.actions.some(t => t.includes('编辑')) && detail.actions.some(t => t.includes('删除')), detail);
    await b.screenshot(output.replace('daily-items-browser.json', 'daily-detail.png'));
    await ev("document.querySelector('#sheetFoot [data-action=daily-toggle]').click()");
    await waitFor(b, "Pandora.idle()", 15000);
    const completedDetail = await waitFor(b, "document.getElementById('sheetBody').textContent.includes('已完成')", 12000);
    check('detail exposes the explicit completed state and its reverse action', completedDetail);
    const completedMarker = await waitFor(b, `(()=>{const c=document.querySelector('[data-daily-date="${emptyKey}"]');return !!c&&c.getAttribute('aria-label').includes('已完成1条')})()`, 12000);
    check('the calendar marker follows a completion made in the detail', completedMarker);
    await ev("document.querySelector('#sheetFoot [data-action=daily-toggle]').click()");
    await waitFor(b, "Pandora.idle()", 15000);
    check('reopening the item restores the open count',
      await waitFor(b, `(()=>{const c=document.querySelector('[data-daily-date="${emptyKey}"]');return !!c&&c.getAttribute('aria-label').includes('未完成1条')})()`, 12000));

    /* -------- edit date and body, then return to the original day list -------- */
    const moveKey = emptyKey;
    await ev("document.querySelector('#sheetFoot [data-action=daily-edit]').click()");
    await waitFor(b, "document.getElementById('sheetTitle').textContent==='编辑每日事项'&&!!document.getElementById('daily-date')");
    await ev(`document.getElementById('daily-date').value=${js(fixture.today)};document.getElementById('daily-body').value='移日后的正文';document.querySelector('#sheetFoot [data-action=daily-save]').click()`);
    check('saving an edit returns to the original day list', await waitFor(b, `document.getElementById('sheetTitle').textContent.includes(${js(moveKey.slice(5, 7) + '月' + Number(moveKey.slice(8, 10)) + '日')})&&Pandora.idle()`, 15000));
    const movedCounts = await ev(`(async()=>{const oldDay=await Pandora.request('/daily-items/summary?from=${moveKey}&to=${moveKey}');const newDay=await Pandora.request('/daily-items/summary?from=${fixture.today}&to=${fixture.today}');return {old:oldDay.days,now:newDay.days}})()`);
    check('moving the item updates both real days', (movedCounts.old.length === 0 || movedCounts.old[0].openCount === 0) && movedCounts.now[0] && movedCounts.now[0].openCount >= 1, movedCounts);
    await ev("document.getElementById('sheetClose').click()");
    await waitFor(b, "document.getElementById('overlay').hidden");

    /* -------- deletion with confirmation -------- */
    await ev(`document.querySelector('[data-daily-date="${fixture.today}"]').click()`);
    await waitFor(b, "!document.getElementById('overlay').hidden&&Pandora.idle()", 12000);
    const target = await ev(`Pandora.request('/daily-items?date=${fixture.today}').then(r=>(r.items.find(i=>i.body==='移日后的正文')||null))`);
    await ev(`document.querySelector('#sheetBody [data-action="daily-open"][data-id="${target.id}"]').click()`);
    await waitFor(b, "document.getElementById('sheetTitle').textContent==='每日事项详情'&&Pandora.idle()", 12000);
    await ev("document.querySelector('#sheetFoot [data-action=daily-delete]').click()");
    await waitFor(b, "document.getElementById('sheetTitle').textContent==='删除每日事项'");
    await ev("document.querySelector('#sheetFoot [data-action=daily-confirm-delete]').click()");
    const deleteLabel = Number(fixture.today.slice(5, 7)) + '月' + Number(fixture.today.slice(8, 10)) + '日';
    check('confirming deletion returns to the original day list', await waitFor(b, `!document.getElementById('overlay').hidden&&document.getElementById('sheetTitle').textContent.includes(${js(deleteLabel)})&&Pandora.idle()`, 15000));
    const gone = await ev(`Pandora.request('/daily-items?date=${fixture.today}').then(r=>!r.items.some(i=>i.id===${js(target.id)}))`);
    check('the deleted item no longer exists on the server or in the open list', gone && await ev("Array.from(document.querySelectorAll('#sheetBody .daily-row')).every(r=>r.dataset.dailyRow!=='" + target.id + "')"));
    await ev("document.getElementById('sheetClose').click()");
    await waitFor(b, "document.getElementById('overlay').hidden");

    /* -------- more than one page in a day list -------- */
    /* -------- a failed save keeps the draft and retries exactly once -------- */
    const retryDate = new Date(fixture.today + 'T00:00:00Z');
    retryDate.setUTCDate(retryDate.getUTCDate() + 1);
    const retryKey = retryDate.toISOString().slice(0, 10);
    await ev(`document.querySelector('[data-daily-date="${retryKey}"]').click()`);
    await waitFor(b, "!document.getElementById('overlay').hidden&&Pandora.idle()", 12000);
    await ev("document.querySelector('#sheetBody [data-action=\"daily-open\"]').click()");
    await waitFor(b, "document.getElementById('sheetTitle').textContent==='每日事项详情'&&Pandora.idle()", 12000);
    await ev("document.querySelector('#sheetFoot [data-action=daily-edit]').click()");
    await waitFor(b, "document.getElementById('sheetTitle').textContent==='编辑每日事项'&&!!document.getElementById('daily-body')");
    await ev("document.getElementById('daily-body').value='离线重试后的正文'");
    await b.send('Network.enable');
    await b.send('Network.emulateNetworkConditions', { offline: true, latency: 0, downloadThroughput: 0, uploadThroughput: 0, connectionType: 'none' });
    await ev("document.querySelector('#sheetFoot [data-action=daily-save]').click()");
    await waitFor(b, "Pandora.idle()", 15000);
    const failedSave = await ev("({open:!document.getElementById('overlay').hidden,value:document.getElementById('daily-body')?document.getElementById('daily-body').value:null,error:(document.getElementById('daily-form-error')||{}).textContent,title:document.getElementById('sheetTitle').textContent})");
    check('a failed save keeps the form open with the draft and an explicit error',
      failedSave.open && failedSave.value === '离线重试后的正文' && (failedSave.error || '').length > 0 && failedSave.title === '编辑每日事项', failedSave);
    await b.send('Network.emulateNetworkConditions', { offline: false, latency: 0, downloadThroughput: -1, uploadThroughput: -1, connectionType: 'wifi' });
    await ev("document.querySelector('#sheetFoot [data-action=daily-save]').click()");
    await waitFor(b, "Pandora.idle()&&document.getElementById('sheetTitle').textContent.includes('每日事项')", 15000);
    const retried = await ev(`Pandora.request('/daily-items?date=${retryKey}').then(r=>r.items.filter(i=>i.body==='离线重试后的正文'))`);
    check('retrying the same draft after connectivity returns saves exactly one item', retried.length === 1, retried);
    await ev("document.getElementById('sheetClose').click()");
    await waitFor(b, "document.getElementById('overlay').hidden");

    const bulkKey = fixture.bulk || fixture.today;
    if (fixture.bulk) {
      await ev(`document.querySelector('[data-daily-date="${bulkKey}"]').click()`);
      await waitFor(b, "!document.getElementById('overlay').hidden&&Pandora.idle()", 12000);
      const firstPage = await ev("document.querySelectorAll('#sheetBody .daily-row').length");
      for (let index = 0; index < 2; index++) {
        const more = await ev("!!document.querySelector('#sheetBody [data-action=daily-more]')");
        if (!more) break;
        await ev("document.querySelector('#sheetBody [data-action=daily-more]').click()");
        await waitFor(b, "Pandora.idle()", 15000);
        await sleep(200);
      }
      const all = await ev("(()=>{const ids=Array.from(document.querySelectorAll('#sheetBody .daily-row')).map(r=>r.dataset.dailyRow);return {count:ids.length,unique:new Set(ids).size,more:!!document.querySelector('#sheetBody [data-action=daily-more]')}})()");
      check('a day with more than one page reaches every item without duplicates', firstPage === 50 && all.count === 105 && all.unique === 105 && !all.more, { firstPage, all });
      await b.screenshot(output.replace('daily-items-browser.json', 'daily-list-paged.png'));
      await ev("document.getElementById('sheetClose').click()");
      await waitFor(b, "document.getElementById('overlay').hidden");
    }

    /* -------- layout at 320 / 390 / 1440 and a short screen -------- */
    for (const width of [320, 390, 1440]) {
      await b.viewport({ width, height: width === 320 ? 740 : width === 390 ? 844 : 900, mobile: width < 1000 });
      await sleep(200);
      await ev("document.getElementById('appMain').scrollTop=document.getElementById('appMain').scrollHeight");
      await sleep(150);
      const layout = await ev(`(()=>{const scroller=document.getElementById('dailyScroller');const fab=document.querySelector('.daily-fab');const nav=document.getElementById('tabbar').getBoundingClientRect();const cells=Array.from(document.querySelectorAll('[data-daily-date]'));const lastWeek=Array.from(document.querySelectorAll('.daily-week')).pop();const weekdays=Array.from(document.querySelectorAll('.daily-weekdays span')).slice(1);return {overflow:document.documentElement.scrollWidth>innerWidth+1,days:weekdays.length,dayHeight:Math.min(...cells.map(c=>c.getBoundingClientRect().height)),dayWidth:Math.min(...cells.map(c=>c.getBoundingClientRect().width)),sevenRows:weekdays.every((span,i)=>span.getBoundingClientRect().top===weekdays[0].getBoundingClientRect().top+i*44),lastReachable:lastWeek?lastWeek.getBoundingClientRect().bottom<=nav.top+1:false,fabOverNav:fab.getBoundingClientRect().bottom>nav.top+1,fabRight:innerWidth-fab.getBoundingClientRect().right,scrollable:scroller.scrollWidth>scroller.clientWidth||width===1440,markersHeight:Array.from(document.querySelectorAll('.daily-mark')).every(m=>m.getBoundingClientRect().height===4)}})()`);
      check('complete seven-row calendar and safe floating add at ' + width,
        !layout.overflow && layout.days === 7 && layout.sevenRows && layout.dayHeight >= 44 && layout.dayWidth >= 44 && !layout.fabOverNav && layout.markersHeight, layout);
      const reachable = await ev("(()=>{const main=document.getElementById('appMain');main.scrollTop=main.scrollHeight;const daily=document.getElementById('dailyItemsSection').getBoundingClientRect();const nav=document.getElementById('tabbar').getBoundingClientRect();return {bottom:daily.bottom,navTop:nav.top,scrollTop:main.scrollTop,noOverflow:getComputedStyle(main).overflowY!=='hidden'}})()");
      check('the complete daily section is reachable without being covered by the navigation at ' + width,
        reachable.noOverflow && reachable.bottom <= reachable.navTop + 1, reachable);
      await ev("document.getElementById('appMain').scrollTop=0");
      await sleep(120);
      await b.screenshot(output.replace('daily-items-browser.json', 'daily-home-' + width + '.png'));
    }
    await b.viewport({ width: 390, height: 600, mobile: true });
    await sleep(200);
    await ev("document.getElementById('appMain').scrollTop=document.getElementById('appMain').scrollHeight");
    await sleep(250);
    const shortScreen = await ev("(()=>{const main=document.getElementById('appMain');const nav=document.getElementById('tabbar').getBoundingClientRect();const daily=document.getElementById('dailyItemsSection').getBoundingClientRect();const fab=document.querySelector('.daily-fab').getBoundingClientRect();return {overflow:getComputedStyle(main).overflowY,scrollTop:main.scrollTop,dailyBottom:daily.bottom,navTop:nav.top,fabBottom:fab.bottom,weekdayRows:document.querySelectorAll('.daily-weekdays span').length}})()");
    check('a short screen keeps the seven-row calendar and the add action above the navigation',
      shortScreen.overflow !== 'hidden' && shortScreen.weekdayRows === 8 && shortScreen.dailyBottom <= shortScreen.navTop + 1 && shortScreen.fabBottom <= shortScreen.navTop + 1, shortScreen);
    await b.screenshot(output.replace('daily-items-browser.json', 'daily-home-short.png'));

    /* -------- remote leap month and independent page state -------- */
    await ev("document.querySelector('[data-action=daily-locate]').click()");
    await waitFor(b, "document.getElementById('sheetTitle').textContent==='定位年月'&&!!document.getElementById('daily-locate')");
    await ev("document.getElementById('daily-locate').value='2024-02';document.querySelector('#sheetFoot [data-action=daily-locate-save]').click()");
    await waitFor(b, "document.getElementById('overlay').hidden&&Pandora.idle()", 12000);
    const leap = await ev(`(()=>{const block=document.querySelector('.daily-month[data-month="2024-02"]');const cells=block?Array.from(block.querySelectorAll('[data-daily-date]')):[];const dates=cells.map(c=>c.dataset.dailyDate);return {block:!!block,has29:dates.includes('2024-02-29'),unique:new Set(dates).size===dates.length,first:dates[0],firstDay:dates[0]?new Date(dates[0]+'T00:00:00Z').getUTCDay():null,last:dates[dates.length-1]}})()`);
    check('a remote leap February loads with a Monday first cell, February 29 and no duplicate dates',
      leap.block && leap.has29 && leap.unique && leap.firstDay === 1, leap);
    await ev("document.querySelector('[data-action=daily-today]').click()");
    await sleep(400);
    const backToday = await ev(`(()=>{const scroller=document.getElementById('dailyScroller').getBoundingClientRect();const today=document.querySelector('[data-daily-date="${fixture.today}"]');const box=today?today.getBoundingClientRect():null;return {visible:!!box&&box.left>=scroller.left-1&&box.right<=scroller.right+1}})()`);
    check('回到今天 returns to the company today month inside the viewport', backToday.visible, backToday);
    const scrollBefore = await ev("({left:document.getElementById('dailyScroller').scrollLeft,anchor:PandoraDaily.state.anchorDate})");
    await ev("setPage('view')");
    await waitFor(b, "state.page==='view'&&Pandora.idle()");
    await ev("setPage('map')");
    await waitFor(b, "state.page==='map'&&Pandora.idle()");
    await sleep(400);
    const scrollAfter = await ev("({left:document.getElementById('dailyScroller').scrollLeft,anchor:PandoraDaily.state.anchorDate})");
    check('switching to 公司 and back restores the daily horizontal position and anchor date',
      scrollAfter.anchor === scrollBefore.anchor && Math.abs(scrollAfter.left - scrollBefore.left) <= 2, { scrollBefore, scrollAfter });

    /* -------- year boundary, failed range retry, Escape and account switching -------- */
    const year = Number(fixture.today.slice(0, 4));
    await ev("document.querySelector('[data-action=daily-locate]').click()");
    await waitFor(b, "document.getElementById('sheetTitle').textContent==='定位年月'&&!!document.getElementById('daily-locate')");
    await ev(`document.getElementById('daily-locate').value='${year}-12';document.querySelector('#sheetFoot [data-action=daily-locate-save]').click()`);
    await waitFor(b, "document.getElementById('overlay').hidden&&Pandora.idle()", 12000);
    const crossYear = await ev(`(()=>{const dates=Array.from(document.querySelectorAll('[data-daily-date]')).map(c=>c.dataset.dailyDate);const index=dates.indexOf('${year}-12-31');return {has:index>=0,next:dates[index+1]||null,unique:new Set(dates).size===dates.length,jan:!!document.querySelector('.daily-month[data-month="${year + 1}-01"]'),dec:!!document.querySelector('.daily-month[data-month="${year}-12"]')}})()`);
    check('December to January stays one consecutive date sequence across the year boundary',
      crossYear.has && crossYear.next === (year + 1) + '-01-01' && crossYear.unique && crossYear.jan && crossYear.dec, crossYear);

    await b.send('Network.emulateNetworkConditions', { offline: true, latency: 0, downloadThroughput: 0, uploadThroughput: 0, connectionType: 'none' });
    await ev("document.querySelector('[data-action=daily-locate]').click()");
    await waitFor(b, "document.getElementById('sheetTitle').textContent==='定位年月'&&!!document.getElementById('daily-locate')");
    await ev("document.getElementById('daily-locate').value='2025-06';document.querySelector('#sheetFoot [data-action=daily-locate-save]').click()");
    await waitFor(b, "document.getElementById('overlay').hidden", 12000);
    const retryVisible = await waitFor(b, "(()=>{const m=document.querySelector('.daily-month[data-month=\"2025-06\"]');const r=m&&m.querySelector('[data-action=daily-retry]');return !!r&&!r.hidden})()", 15000);
    const failedRange = await ev("(()=>{const m=document.querySelector('.daily-month[data-month=\"2025-06\"]');const cell=m&&m.querySelector('[data-daily-date]');return {retry:!!m&&!m.querySelector('[data-action=daily-retry]').hidden,marks:cell?cell.querySelectorAll('.daily-mark').length:null,aria:cell?cell.getAttribute('aria-label'):null}})()");
    check('a failed range load keeps the calendar and offers a retry instead of a confirmed zero',
      retryVisible && failedRange.retry && failedRange.marks === 0 && failedRange.aria.includes('数量加载中'), failedRange);
    await b.send('Network.emulateNetworkConditions', { offline: false, latency: 0, downloadThroughput: -1, uploadThroughput: -1, connectionType: 'wifi' });
    await waitFor(b, "fetch('/health').then(r=>r.ok).catch(()=>false)", 10000);
    const loadedRange = "(()=>{const m=document.querySelector('.daily-month[data-month=\"2025-06\"]');const cell=m&&m.querySelector('[data-daily-date]');return !!cell&&!cell.getAttribute('aria-label').includes('数量加载中')})()";
    await ev("document.querySelector('[data-action=daily-retry][data-month=\"2025-06\"]').click()");
    let retriedRange = await waitFor(b, loadedRange, 15000);
    if (!retriedRange) {
      await ev("document.querySelector('[data-action=daily-retry][data-month=\"2025-06\"]').click()");
      retriedRange = await waitFor(b, loadedRange, 15000);
    }
    check('retrying the failed range loads its real counts', retriedRange);
    const zeroRange = await ev("(()=>{const m=document.querySelector('.daily-month[data-month=\"2025-06\"]');const cell=m&&m.querySelector('[data-daily-date]');return {aria:cell?cell.getAttribute('aria-label'):null,marks:cell?cell.querySelectorAll('.daily-mark').length:null}})()");
    check('a loaded range with no items reports confirmed zero counts without drawing marks',
      zeroRange.aria && zeroRange.aria.includes('未完成0条') && zeroRange.aria.includes('已完成0条') && zeroRange.marks === 0, zeroRange);

    await ev("document.querySelector('[data-action=daily-today]').click()");
    await waitFor(b, `!!document.querySelector('[data-daily-date="${fixture.today}"]')`, 12000);
    await ev(`document.querySelector('[data-daily-date="${fixture.today}"]').click()`);
    await waitFor(b, "!document.getElementById('overlay').hidden&&Pandora.idle()", 12000);
    await b.send('Input.dispatchKeyEvent', { type: 'rawKeyDown', key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27 });
    await b.send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27 });
    check('Escape closes the day list and returns focus to its date cell',
      await waitFor(b, "document.getElementById('overlay').hidden") &&
      await ev("document.activeElement&&document.activeElement.dataset&&document.activeElement.dataset.dailyDate==='" + fixture.today + "'"));

    await require('./check_daily_items_repairs_browser')(b, fixture, check);
    await require('./check_daily_items_lifecycle_browser')(b, fixture, check);
    await require('./check_daily_items_paging_browser')(b, fixture, check);

    await ev("Pandora.logout()");
    await waitFor(b, "!!document.getElementById('backend-login')&&Pandora.idle()", 20000);
    await ev(`document.getElementById('login-user').value=${js(ids['alpha-two-employee'].identifier)};document.getElementById('login-password').value='Fixture@123456';document.getElementById('backend-login').requestSubmit()`);
    check('a second account logs in after the first logs out', await waitFor(b, `Pandora.ready&&Pandora.data.me.id===${js(ids['alpha-two-employee'].id)}&&Pandora.idle()`, 20000));
    await sleep(1200);
    const switched = await ev(`({account:PandoraDaily.state.account,expected:${js(ids['alpha-two-employee'].id)},aria:document.querySelector('[data-daily-date="${fixture.today}"]')?.getAttribute('aria-label')})`);
    check('switching accounts clears the previous daily state and never shows its counts',
      switched.account === switched.expected && switched.aria && switched.aria.includes('未完成0条') && switched.aria.includes('已完成0条'), switched);

    fs.writeFileSync(output, JSON.stringify(report, null, 2) + '\n');
    console.log('\n' + report.checks.length + ' browser checks passed');
  } finally {
    b.kill();
  }
}
main().catch(error => { console.error(error); process.exit(1); });
