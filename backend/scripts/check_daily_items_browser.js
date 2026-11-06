#!/usr/bin/env node
'use strict';
/* Real-browser acceptance for the three-section home page and the independent daily-item calendar. */
const fs = require('fs');
const path = require('path');
const { openBrowser, waitFor, sleep } = require('./browser_fixture');
const fixture = JSON.parse(process.env.PANDORA_BROWSER_FIXTURE);
const ids = fixture.identities;
const outputDir = path.resolve(__dirname, '../../audit/refine-home-daily-items-layout-and-scrolling');
const output = path.join(outputDir, 'daily-items-browser.json');
const report = { updated: new Date().toISOString(), checks: [] };
fs.mkdirSync(outputDir, { recursive: true });
function evidence(name, rows) {
  fs.writeFileSync(path.join(outputDir, name + '.json'),
    JSON.stringify({ updated: new Date().toISOString(), viewports: rows }, null, 2) + '\n');
}
function check(name, pass, evidence) {
  report.checks.push({ check: name, pass: !!pass, evidence });
  console.log((pass ? 'PASS ' : 'FAIL ') + name);
  if (!pass) throw new Error(name + ' ' + JSON.stringify(evidence));
}
const js = value => JSON.stringify(value);
function dayKey(offset) {
  const date = new Date(fixture.today + 'T00:00:00Z');
  date.setUTCDate(date.getUTCDate() + offset);
  return date.toISOString().slice(0, 10);
}
async function main() {
  const b = await openBrowser(fixture.base + '/');
  const ev = b.evaluate;
  try {
    const ready = await waitFor(b, "!!document.getElementById('backend-login')&&Pandora.idle()");
    check('login form is ready', ready);
    await ev(`document.getElementById('login-user').value=${js(ids['alpha-one-employee'].identifier)};document.getElementById('login-password').value='Fixture@123456';document.getElementById('backend-login').requestSubmit()`);
    check('employee login loads the home page', await waitFor(b, `Pandora.ready&&Pandora.idle()&&Pandora.data.me.id===${js(ids['alpha-one-employee'].id)}`, 20000));

    /* -------- preserved session + page refresh + a direct gesture, before any month control -------- */
    await require('./check_daily_items_refresh_browser')(b, fixture, check, evidence);
    check('the reloaded session is still the same real employee',
      await waitFor(b, `Pandora.ready&&Pandora.idle()&&Pandora.data.me.id===${js(ids['alpha-one-employee'].id)}`, 20000));

    /* -------- navigation and three modules -------- */
    const nav = await ev(`(()=>{const tabs=Array.from(document.querySelectorAll('#tabbar button span')).map(e=>e.textContent);return {tabs,title:document.getElementById('pageTitle').textContent}})()`);
    check('navigation uses 首页 and 公司 while keeping five entries', JSON.stringify(nav.tabs) === JSON.stringify(['首页', '公司', '日志', '统计', '我的']) && nav.title === '首页', nav);
    const modules = await ev(`(()=>{const quads=Array.from(document.querySelectorAll('#page-map .quad'));return {count:quads.length,order:quads.map(q=>q.className),company:!!document.querySelector('#page-map .company-quad'),tasks:!!document.querySelector('#page-map .tasks-quad'),daily:!!document.querySelector('#page-map #dailyItemsSection'),logs:!!document.querySelector('#page-map .logs-quad'),personal:!!document.querySelector('#page-map .personal-quad'),newPersonal:!!document.querySelector('#page-map [data-action="new-personal"]'),dailyColumn:getComputedStyle(document.querySelector('#dailyItemsSection')).gridColumnStart,grid:getComputedStyle(document.querySelector('.map-grid')).gridTemplateColumns,priorities:Array.from(document.querySelectorAll('.tasks-quad .home-task-priority')).map(e=>({width:e.getBoundingClientRect().width,visible:e.getBoundingClientRect().right<=e.closest('.q-body').getBoundingClientRect().right+1}))}})()`);
    check('home has exactly 事件纪、任务看板、每日事项 and no old log/personal card',
      modules.count === 3 && modules.company && modules.tasks && modules.daily && !modules.logs && !modules.personal && !modules.newPersonal, modules);
    check('the daily section spans both columns below the two upper cards',
      await ev("getComputedStyle(document.querySelector('#dailyItemsSection')).gridColumnEnd==='-1'"), { columnStart: modules.dailyColumn });
    check('task items keep their title and a fully visible right-aligned priority',
      modules.priorities.length > 0 && modules.priorities.every(p => p.width > 10 && p.visible), modules.priorities);

    /* -------- compact header: title, mint glass add control, month tools on one row -------- */
    const header = await ev(`(()=>{const head=document.querySelector('.daily-quad .daily-head');
      const h2=head.querySelector('h2'),add=head.querySelector('.daily-add'),tools=head.querySelector('.daily-tools');
      const tool=tools.querySelector('.btn');
      const box=e=>{const r=e.getBoundingClientRect();return {top:Math.round(r.top),bottom:Math.round(r.bottom),left:Math.round(r.left),right:Math.round(r.right),width:r.width,height:r.height}};
      const style=getComputedStyle(add);
      const rgb=(style.backgroundColor.match(/[\\d.]+/g)||[]).map(Number);
      return {h2:box(h2),add:box(add),tools:box(tools),head:box(head),tool:box(tool),
        sameRow:Math.abs((box(h2).top+box(h2).bottom)/2-(box(add).top+box(add).bottom)/2)<=8,
        addAfterTitle:box(add).left>=box(h2).right-1,
        toolsAtRightEdge:Math.abs(box(tools).right-box(head).right)<=1,
        hint:!!head.querySelector('.hint'),anchorLabel:!!document.getElementById('dailyAnchorLabel'),
        fab:!!document.querySelector('.daily-fab'),
        background:style.backgroundImage,backgroundImage:style.backgroundImage!=='none',
        bgColor:style.backgroundColor,bgRgb:rgb,alpha:rgb.length>3?rgb[3]:1,
        color:style.color,radius:style.borderRadius,toolRadius:getComputedStyle(tool).borderRadius,
        label:add.getAttribute('aria-label'),action:add.dataset.action,
        bodyPad:getComputedStyle(document.querySelector('.daily-body')).paddingBottom}})()`);
    check('the daily header is one row with the add control immediately right of the title',
      header.sameRow && header.addAfterTitle && header.toolsAtRightEdge && header.add.left > header.h2.right - 1 && !header.hint && !header.anchorLabel, header);
    check('the floating add button and its dedicated bottom space are gone',
      !header.fab && (header.bodyPad === '0px' || header.bodyPad === '0px 0px'), header);
    check('the header add control is a non-white translucent mint glass button shaped like the month tools',
      header.action === 'daily-new' && header.label === '新增每日事项' && header.backgroundImage &&
      header.alpha < 0.95 && header.bgRgb[1] > header.bgRgb[0] && header.bgRgb[1] > 150 &&
      header.radius === header.toolRadius && header.add.width >= 32 && header.add.height >= 32,
      { action: header.action, label: header.label, bgColor: header.bgColor, background: header.background,
        radius: header.radius, toolRadius: header.toolRadius, box: header.add });
    await b.screenshot(path.join(outputDir, 'daily-header-390.png'));

    /* -------- calendar structure: fixed weekday rows, own-month blocks, aligned headings -------- */
    const calendar = await ev(`(()=>{const days=Array.from(document.querySelectorAll('.daily-weekdays span')).map(e=>e.textContent);const cells=Array.from(document.querySelectorAll('[data-daily-date]'));const today=document.querySelector('[data-daily-date="${fixture.today}"]');const week=document.querySelector('.daily-week');return {weekdayCount:document.querySelectorAll('.daily-weekdays span').length,weekdays:days.filter(Boolean),cells:cells.length,firstCellBox:week?week.querySelector('.daily-cell,.daily-gap').getBoundingClientRect().height:0,weekCells:week?week.children.length:0,todayLabel:today?today.getAttribute('aria-label'):null,lunar:document.body.textContent.includes('农历'),monthLabels:Array.from(document.querySelectorAll('.daily-month-label')).map(e=>e.textContent),scroller:!!document.getElementById('dailyScroller'),fab:!!document.querySelector('.daily-fab'),weekdayFixed:getComputedStyle(document.querySelector('.daily-weekdays')).position}})()`);
    check('calendar shows a fixed Monday-to-Sunday header and seven-row week columns',
      calendar.weekdayCount === 8 && JSON.stringify(calendar.weekdays) === JSON.stringify(['周一', '周二', '周三', '周四', '周五', '周六', '周日']) && calendar.weekCells === 7 && calendar.firstCellBox >= 44 && !calendar.lunar, calendar);
    check('the calendar exposes one month heading per month block and a horizontal scroller',
      calendar.scroller && calendar.monthLabels.length >= 3 && calendar.monthLabels.some(text => text === fixture.today.slice(0, 4) + '年' + Number(fixture.today.slice(5, 7)) + '月'), calendar);

    const monthsNow = await ev(`(()=>{const blocks=Array.from(document.querySelectorAll('.daily-month'));
      const dateProblems=[],alignProblems=[],labelProblems=[];
      blocks.forEach(m=>{const cells=Array.from(m.querySelectorAll('[data-daily-date]'));
        const dates=cells.map(c=>c.dataset.dailyDate);
        const parts=m.dataset.month.split('-');const y=Number(parts[0]),mo=Number(parts[1]);
        const lastDay=new Date(Date.UTC(y,mo,0)).getUTCDate();
        const weekCount=m.querySelectorAll('.daily-week').length;
        const head=m.querySelector('.daily-month-head').getBoundingClientRect();
        const firstCell=cells[0]?cells[0].getBoundingClientRect():null;
        const own=dates.every(d=>d.startsWith(m.dataset.month));
        const consecutive=dates.every((d,i)=>!i||new Date(d+'T00:00:00Z')-new Date(dates[i-1]+'T00:00:00Z')===86400000);
        const unique=new Set(dates).size===dates.length;
        const expectedLast=m.dataset.month+'-'+String(lastDay).padStart(2,'0');
        const gaps=m.querySelectorAll('.daily-gap').length;
        const rowsOk=Array.from(m.querySelectorAll('.daily-week')).every(w=>w.children.length===7);
        const base={key:m.dataset.month,days:dates.length,lastDay,weekCount,gaps,first:dates[0],last:dates[dates.length-1]};
        if(!own||!consecutive||!unique||dates.length!==lastDay||dates[0]!==m.dataset.month+'-01'||
          dates[dates.length-1]!==expectedLast||weekCount<4||weekCount>6||!rowsOk||gaps!==weekCount*7-lastDay||
          m.querySelector('.daily-month-tag')) dateProblems.push(Object.assign({own,consecutive,unique,rowsOk,tag:!!m.querySelector('.daily-month-tag')},base));
        if(!firstCell||Math.abs(head.left-firstCell.left)>1) alignProblems.push({key:m.dataset.month,headLeft:Math.round(head.left),firstLeft:firstCell?Math.round(firstCell.left):null});
        const label=m.querySelector('.daily-month-label');
        if(label&&(label.getBoundingClientRect().width>m.getBoundingClientRect().width+1||
          label.scrollWidth>label.clientWidth+1)) labelProblems.push({key:m.dataset.month,labelWidth:Math.round(label.getBoundingClientRect().width),blockWidth:Math.round(m.getBoundingClientRect().width)});
      });
      const all=Array.from(document.querySelectorAll('[data-daily-date]')).map(c=>c.dataset.dailyDate);
      const separated=blocks.every((el,i)=>!i||el.getBoundingClientRect().left-blocks[i-1].getBoundingClientRect().right>=8);
      const overlapping=blocks.some((el,i)=>{if(!i)return false;const a=el.querySelector('.daily-month-label'),b2=blocks[i+1]&&blocks[i+1].querySelector('.daily-month-label');
        return !!b2&&a.getBoundingClientRect().right>b2.getBoundingClientRect().left+1;});
      return {count:blocks.length,dateProblems:dateProblems,alignProblems:alignProblems,labelProblems:labelProblems,
        labelsOverlap:overlapping,uniqueAll:new Set(all).size===all.length,separated:separated,cells:all.length}})()`);
    check('every month block only holds its own real dates, from the 1st to the last day',
      monthsNow.count >= 3 && !monthsNow.dateProblems.length, monthsNow);
    check('each month heading starts above the column of its own 1st',
      monthsNow.count >= 3 && !monthsNow.alignProblems.length, { count: monthsNow.count, alignProblems: monthsNow.alignProblems });
    check('every month heading shows its full year and month without overlapping the next one',
      !monthsNow.labelProblems.length && !monthsNow.labelsOverlap, { labelProblems: monthsNow.labelProblems, labelsOverlap: monthsNow.labelsOverlap });
    check('no real date appears twice anywhere in the calendar', monthsNow.uniqueAll, monthsNow);
    check('month blocks are separated by visible space', monthsNow.separated, monthsNow);

    const continuity = await ev(`(()=>{const cells=Array.from(document.querySelectorAll('[data-daily-date]'));const dates=cells.map(c=>c.dataset.dailyDate);const scroller=document.getElementById('dailyScroller').getBoundingClientRect();const today=document.querySelector('[data-daily-date="${fixture.today}"]');const box=today?today.getBoundingClientRect():null;return {count:dates.length,todayVisible:!!box&&box.left>=scroller.left-1&&box.right<=scroller.right+1}})()`);
    check('the calendar loads several real months', continuity.count >= 25, continuity);
    check('the calendar initially positions the company today inside the viewport', continuity.todayVisible, continuity);

    /* -------- single marker: length from the total, colour from the open state -------- */
    const markerFacts = `(()=>{const c=document.querySelector('[data-daily-date="KEY"]');if(!c)return null;const marks=Array.from(c.querySelectorAll('.daily-mark'));
      return {aria:c.getAttribute('aria-label'),marks:marks.map(m=>({cls:m.className,width:Math.round(m.getBoundingClientRect().width*10)/10,height:m.getBoundingClientRect().height}))}})()`;
    const markerOf = key => ev(markerFacts.replace('KEY', key));
    const markerPlan = [
      [1, 0, 4, 'is-open'], [2, 0, 7, 'is-open'], [3, 0, 10, 'is-open'], [4, 0, 13, 'is-open'],
      [5, 0, 16, 'is-open'], [6, 0, 16, 'is-open'], [1, 4, 16, 'is-open'], [0, 5, 16, 'is-done'],
    ];
    for (const [offset, row] of markerPlan.entries()) {
      const [openCount, doneCount, width, state] = row;
      const key = dayKey(offset);
      const label = '未完成' + openCount + '条';
      await waitFor(b, `(()=>{const c=document.querySelector('[data-daily-date="${key}"]');return !!c&&c.getAttribute('aria-label').includes('${label}')&&c.getAttribute('aria-label').includes('已完成${doneCount}条')})()`, 12000);
      const marker = await markerOf(key);
      check(`day +${offset} (${openCount} open / ${doneCount} done) shows exactly one ${state} marker ${width}px wide`,
        marker && marker.marks.length === 1 && marker.marks[0].cls.includes(state) &&
        Math.abs(marker.marks[0].width - width) < 1 && marker.marks[0].height === 4 &&
        marker.aria.includes('未完成' + openCount + '条') && marker.aria.includes('已完成' + doneCount + '条'), marker);
    }
    await waitFor(b, `(()=>{const c=document.querySelector('[data-daily-date="${dayKey(8)}"]');return !!c&&c.getAttribute('aria-label').includes('未完成0条')})()`, 12000);
    const zeroMarker = await markerOf(dayKey(8));
    check('a day with no items keeps the layout slot but draws no marker',
      zeroMarker && zeroMarker.marks.length === 0 && zeroMarker.aria.includes('未完成0条') && zeroMarker.aria.includes('已完成0条'), zeroMarker);

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
    await ev("document.querySelector('[data-action=daily-today]').click()");
    await sleep(250);

    /* -------- keyboard activation -------- */
    await ev("document.getElementById('dailyScroller').focus()");
    await b.send('Input.dispatchKeyEvent', { type: 'rawKeyDown', key: 'ArrowRight', code: 'ArrowRight', windowsVirtualKeyCode: 39 });
    await b.send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'ArrowRight', code: 'ArrowRight', windowsVirtualKeyCode: 39 });
    const focused = await ev("document.activeElement&&document.activeElement.dataset?document.activeElement.dataset.dailyDate:null");
    check('arrow keys move focus onto a real date cell rather than a blank slot', !!focused, focused);
    await b.send('Input.dispatchKeyEvent', { type: 'rawKeyDown', key: 'Enter', code: 'Enter', windowsVirtualKeyCode: 13 });
    await b.send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Enter', code: 'Enter', windowsVirtualKeyCode: 13 });
    const opened = await waitFor(b, "!document.getElementById('overlay').hidden&&document.getElementById('sheetTitle').textContent.includes('每日事项')&&Pandora.idle()", 12000);
    check('Enter opens the day list for the keyboard-focused date', opened);
    const listState = await ev("({title:document.getElementById('sheetTitle').textContent,rows:document.querySelectorAll('#sheetBody .daily-row').length,empty:document.getElementById('sheetBody').textContent.includes('还没有每日事项'),foot:document.querySelectorAll('#sheetFoot button').length})");
    check('the day list shows that date, its items and a create action', listState.title.includes('每日事项') && listState.rows >= 1 && listState.foot >= 1, listState);
    await b.screenshot(path.join(outputDir, 'daily-list.png'));

    /* -------- header add control: default date, cancel and save round trip -------- */
    await ev("document.getElementById('sheetClose').click()");
    await waitFor(b, "document.getElementById('overlay').hidden");
    await ev(`document.querySelector('[data-daily-date="${fixture.today}"]').click()`);
    await waitFor(b, "!document.getElementById('overlay').hidden&&Pandora.idle()", 12000);
    await ev("document.getElementById('sheetClose').click()");
    await waitFor(b, "document.getElementById('overlay').hidden");
    await ev("document.querySelector('[data-action=daily-today]').click()");
    await sleep(200);
    await ev("document.querySelector('.daily-add').focus()");
    check('the header add control is reachable by keyboard focus',
      await waitFor(b, "document.activeElement&&document.activeElement.classList.contains('daily-add')", 4000),
      await ev("document.activeElement?document.activeElement.className:null"));
    await b.send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Enter', code: 'Enter', text: '\r', windowsVirtualKeyCode: 13, nativeVirtualKeyCode: 13 });
    await b.send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Enter', code: 'Enter', windowsVirtualKeyCode: 13, nativeVirtualKeyCode: 13 });
    await waitFor(b, "document.getElementById('sheetTitle').textContent==='新增每日事项'&&!!document.getElementById('daily-date')");
    const headerDefault = await ev("document.getElementById('daily-date').value");
    check('keyboard activation of the header add control opens the original create form with the selected day as default',
      headerDefault === fixture.today, { headerDefault, today: fixture.today });
    check('the header create form is the original daily-item form',
      await ev("!!document.getElementById('daily-date')&&!!document.getElementById('daily-body')&&document.querySelector('#sheetFoot [data-action=daily-save]')!==null"));
    await ev("document.getElementById('sheetClose').click()");
    await waitFor(b, "document.getElementById('overlay').hidden");
    check('cancelling the header form returns focus to the header add control',
      await waitFor(b, "document.activeElement&&document.activeElement.classList.contains('daily-add')", 4000));
    await b.screenshot(path.join(outputDir, 'daily-home-clean-390.png'));

    const headerBody = '从标题加号保存的事项';
    await ev("document.querySelector('.daily-add').click()");
    await waitFor(b, "document.getElementById('sheetTitle').textContent==='新增每日事项'&&!!document.getElementById('daily-body')");
    await ev(`document.getElementById('daily-body').value=${js(headerBody)};document.querySelector('#sheetFoot [data-action=daily-save]').click()`);
    const headerSaved = await waitFor(b, "document.getElementById('overlay').hidden&&Pandora.idle()", 15000);
    const headerItems = await ev(`Pandora.request('/daily-items?date=${fixture.today}').then(r=>r.items.filter(i=>i.body===${js(headerBody)}))`);
    check('saving from the header add control creates the item on the default day',
      headerSaved && headerItems.length === 1 && headerItems[0].date === fixture.today, { headerSaved, headerItems });
    check('the header-created item updates the calendar marker for today',
      await waitFor(b, `(()=>{const c=document.querySelector('[data-daily-date="${fixture.today}"]');return !!c&&c.getAttribute('aria-label').includes('未完成2条')})()`, 12000));
    await b.screenshot(path.join(outputDir, 'daily-header-created.png'));

    /* -------- empty day + create from the list -------- */
    const emptyKey = dayKey(20);
    await ev(`PandoraDaily.goToDate(${js(emptyKey)});document.querySelector('[data-daily-date="${emptyKey}"]').click()`);
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
    await b.screenshot(path.join(outputDir, 'daily-calendar.png'));

    /* -------- inline completion keeps the row in place, does not open the detail, keeps the width -------- */
    const widthBefore = await ev(`(()=>{const m=document.querySelector('[data-daily-date="${emptyKey}"] .daily-mark');return m?Math.round(m.getBoundingClientRect().width*10)/10:null})()`);
    await ev(`document.querySelector('[data-daily-date="${emptyKey}"]').click()`);
    await waitFor(b, "!document.getElementById('overlay').hidden&&Pandora.idle()", 12000);
    const rowOrder = await ev("Array.from(document.querySelectorAll('#sheetBody .daily-row')).map(r=>r.dataset.dailyRow)");
    await ev("document.querySelector('#sheetBody [data-action=daily-toggle]').click()");
    await waitFor(b, "Pandora.idle()", 15000);
    const inline = await ev("({title:document.getElementById('sheetTitle').textContent,rows:Array.from(document.querySelectorAll('#sheetBody .daily-row')).map(r=>r.dataset.dailyRow),checked:document.querySelector('#sheetBody .daily-check')?document.querySelector('#sheetBody .daily-check').getAttribute('aria-checked'):null,open:!document.getElementById('overlay').hidden})");
    check('the inline completion control never opens the detail and keeps the row in place',
      inline.open && inline.title.includes('每日事项') && inline.title !== '每日事项详情' && inline.checked === 'true' && JSON.stringify(inline.rows) === JSON.stringify(rowOrder), { rowOrder, inline });
    check('the inline completion updates the calendar marker to the completed colour',
      await waitFor(b, `(()=>{const c=document.querySelector('[data-daily-date="${emptyKey}"]');return !!c&&c.getAttribute('aria-label').includes('已完成1条')})()`, 12000));
    const widthAfter = await ev(`(()=>{const m=document.querySelector('[data-daily-date="${emptyKey}"] .daily-mark');return m?{width:Math.round(m.getBoundingClientRect().width*10)/10,cls:m.className,count:document.querySelectorAll('[data-daily-date="${emptyKey}"] .daily-mark').length}:null})()`);
    check('completing the only item keeps the marker length and only turns it grey',
      widthAfter && widthAfter.count === 1 && Math.abs(widthAfter.width - widthBefore) < 1 && widthAfter.cls.includes('is-done'), { widthBefore, widthAfter });
    await ev("document.querySelector('#sheetBody [data-action=daily-toggle]').click()");
    await waitFor(b, "Pandora.idle()", 15000);
    check('toggling back restores the inline unchecked state and the blue marker at the same length',
      await waitFor(b, `(()=>{const c=document.querySelector('#sheetBody .daily-check');const m=document.querySelector('[data-daily-date="${emptyKey}"] .daily-mark');return c&&c.getAttribute('aria-checked')==='false'&&m&&m.className.includes('is-open')&&Math.abs(m.getBoundingClientRect().width-${widthBefore})<1})()`, 12000));

    /* -------- detail is plain text and completion is reversible -------- */
    await ev(`document.querySelector('#sheetBody [data-action="daily-open"]').click()`);
    await waitFor(b, "document.getElementById('sheetTitle').textContent==='每日事项详情'&&Pandora.idle()", 12000);
    const detail = await ev("({text:document.getElementById('sheetBody').textContent,html:document.getElementById('sheetBody').innerHTML,date:document.querySelector('.daily-detail-date').textContent,actions:Array.from(document.querySelectorAll('#sheetFoot button')).map(b=>b.textContent)})");
    check('detail shows the date and the text literally without executing HTML',
      detail.date.includes('2026') && detail.text.includes('<b>不是标签</b>') && !detail.html.includes('<b>不是标签</b>') && detail.actions.some(t => t.includes('标记完成')) && detail.actions.some(t => t.includes('编辑')) && detail.actions.some(t => t.includes('删除')), detail);
    await b.screenshot(path.join(outputDir, 'daily-detail.png'));
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

    /* -------- a failed save keeps the draft and retries exactly once -------- */
    const retryKey = dayKey(1);
    await ev(`PandoraDaily.goToDate(${js(retryKey)});document.querySelector('[data-daily-date="${retryKey}"]').click()`);
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
      await ev(`PandoraDaily.goToDate(${js(bulkKey)});document.querySelector('[data-daily-date="${bulkKey}"]').click()`);
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
      await b.screenshot(path.join(outputDir, 'daily-list-paged.png'));
      await ev("document.getElementById('sheetClose').click()");
      await waitFor(b, "document.getElementById('overlay').hidden");
      const bulkMarker = await ev(`(()=>{const c=document.querySelector('[data-daily-date="${bulkKey}"]');const m=c?Array.from(c.querySelectorAll('.daily-mark')):[];return {aria:c?c.getAttribute('aria-label'):null,count:m.length,width:m[0]?Math.round(m[0].getBoundingClientRect().width*10)/10:null,cls:m[0]?m[0].className:null}})()`);
      check('a day with more than 100 items keeps one capped marker that counts every page',
        bulkMarker.count === 1 && bulkMarker.width === 16 && bulkMarker.cls.includes('is-open') &&
        bulkMarker.aria.includes('未完成105条') && bulkMarker.aria.includes('已完成0条'), bulkMarker);
    }

    /* -------- layout budget, header and month alignment at 320 / 390 / 1440 and a short screen -------- */
    const layoutRows = [];
    for (const size of [{ width: 320, height: 740 }, { width: 390, height: 844 }, { width: 1440, height: 900 }, { width: 390, height: 600 }]) {
      const width = size.width;
      await b.viewport({ ...size, mobile: width < 1000 });
      await sleep(250);
      await ev("document.getElementById('appMain').scrollTo({top:document.getElementById('appMain').scrollHeight,behavior:'instant'})");
      await sleep(250);
      const layout = await ev(`(()=>{const scroller=document.getElementById('dailyScroller');const cells=Array.from(document.querySelectorAll('[data-daily-date]'));const lastWeek=Array.from(document.querySelectorAll('.daily-week')).pop();const weekdays=Array.from(document.querySelectorAll('.daily-weekdays span')).slice(1);
        const nav=document.getElementById('tabbar').getBoundingClientRect();
        const rows=(sel,rowSel,shortTest)=>{const card=document.querySelector(sel);const body=card.querySelector('.q-body');const br=body.getBoundingClientRect();
          const all=Array.from(body.querySelectorAll(rowSel));const short=shortTest?all.filter(shortTest):all;
          const inside=r=>{const x=r.getBoundingClientRect();return x.top>=br.top-1&&x.bottom<=br.bottom+1};
          return {rows:all.length,short:short.length,fully:short.filter(inside).length,thirdFully:short[2]?inside(short[2]):false,
            bodyHeight:Math.round(br.height),scrollable:body.scrollHeight>body.clientHeight+1,overflow:getComputedStyle(body).overflowY,cardHeight:Math.round(card.getBoundingClientRect().height)}};
        const head=document.querySelector('.daily-quad .daily-head'),add=document.querySelector('.daily-add'),tools=document.querySelector('.daily-tools');
        const headBox=head.getBoundingClientRect(),addBox=add.getBoundingClientRect(),toolsBox=tools.getBoundingClientRect();
        const months=Array.from(document.querySelectorAll('.daily-month')).map(m=>{const c=m.querySelector('[data-daily-date]');return {key:m.dataset.month,headLeft:Math.round(m.querySelector('.daily-month-head').getBoundingClientRect().left),firstLeft:c?Math.round(c.getBoundingClientRect().left):null}});
        return {overflow:document.documentElement.scrollWidth>innerWidth+1,weekdayRows:weekdays.length,dayHeight:Math.min(...cells.map(c=>c.getBoundingClientRect().height)),dayWidth:Math.min(...cells.map(c=>c.getBoundingClientRect().width)),sevenRows:weekdays.every((span,i)=>span.getBoundingClientRect().top===weekdays[0].getBoundingClientRect().top+i*44),lastReachable:lastWeek?lastWeek.getBoundingClientRect().bottom<=nav.top+1:false,
          markersHeight:Array.from(document.querySelectorAll('.daily-mark')).every(m=>m.getBoundingClientRect().height===4),
          company:rows('#page-map .company-quad','.q-body > .item-line'),tasks:rows('#page-map .tasks-quad','.q-body > .home-task',r=>/^短任务/.test(r.textContent)),
          head:{sameRow:(addBox.top+addBox.bottom)/2>headBox.top-1&&(addBox.top+addBox.bottom)/2<headBox.bottom+1,addVisible:addBox.width>=32&&addBox.height>=32,addLeft:Math.round(addBox.left),titleRight:Math.round(head.querySelector('h2').getBoundingClientRect().right),toolsRight:Math.round(toolsBox.right),headRight:Math.round(headBox.right)},
          monthAligned:months.every(m=>m.firstLeft!=null&&Math.abs(m.headLeft-m.firstLeft)<=1),monthCount:months.length,
          scroll:{scrollWidth:scroller.scrollWidth,clientWidth:scroller.clientWidth,scrollLeft:Math.round(scroller.scrollLeft),
            maxLeft:Math.max(0,scroller.scrollWidth-scroller.clientWidth),anchor:PandoraDaily.state.anchorDate},
          reveal:(()=>{const main=document.getElementById('appMain');main.scrollTo({top:main.scrollHeight,behavior:'instant'});const daily=document.getElementById('dailyItemsSection').getBoundingClientRect();const nav=document.getElementById('tabbar').getBoundingClientRect();return {bottom:Math.round(daily.bottom),navTop:Math.round(nav.top),noOverflow:getComputedStyle(main).overflowY!=='hidden'}})()}})()`);
      layoutRows.push({ viewport: width + 'x' + size.height, layout });
      evidence('layout-' + width + 'x' + size.height, [layout]);
      check(`complete seven-row calendar at ${width} without horizontal page overflow`,
        !layout.overflow && layout.weekdayRows === 7 && layout.sevenRows && layout.dayHeight >= 44 && layout.dayWidth >= 44 && layout.markersHeight, layout);
      check(`both upper cards show at least three complete normal rows at ${width}`,
        layout.company.short >= 4 && layout.company.thirdFully && layout.company.fully >= 3 &&
        layout.tasks.short >= 4 && layout.tasks.thirdFully && layout.tasks.fully >= 3 &&
        layout.company.scrollable && layout.tasks.scrollable &&
        layout.company.overflow === 'auto' && layout.tasks.overflow === 'auto', layout);
      check(`the daily title, add control and month tools stay on one visible row at ${width}`,
        layout.head.sameRow && layout.head.addVisible && layout.head.addLeft >= layout.head.titleRight - 1 && layout.head.toolsRight <= layout.head.headRight + 1, layout.head);
      check(`every mounted month heading stays above its own 1st column at ${width}`, layout.monthAligned, { months: layout.monthCount });
      check(`the complete daily section is reachable above the navigation at ${width}`,
        layout.reveal.noOverflow && layout.reveal.bottom <= layout.reveal.navTop + 1, layout.reveal);
      check(`the calendar keeps scroll range in both directions after the viewport change at ${width}`,
        layout.scroll.maxLeft > 40 && layout.scroll.scrollLeft > 1 && layout.scroll.maxLeft - layout.scroll.scrollLeft > 1, layout.scroll);
      if (layoutRows.length > 1) {
        check(`the browsed anchor date survives the viewport change at ${width}`,
          layout.scroll.anchor === layoutRows[layoutRows.length - 2].layout.scroll.anchor,
          { before: layoutRows[layoutRows.length - 2].layout.scroll.anchor, after: layout.scroll.anchor });
      }
      await ev("document.getElementById('appMain').scrollTo({top:0,behavior:'instant'})");
      await sleep(120);
      await b.screenshot(path.join(outputDir, 'daily-home-' + width + 'x' + size.height + '.png'));
      if (width === 320) await b.screenshot(path.join(outputDir, 'daily-header-320.png'));
    }
    evidence('layout-summary', layoutRows);
    await b.viewport({ width: 390, height: 844, mobile: true });

    /* -------- month-specific week structures, leap February and the year boundary -------- */
    async function locate(month) {
      await ev("document.querySelector('[data-action=daily-locate]').click()");
      await waitFor(b, "document.getElementById('sheetTitle').textContent==='定位年月'&&!!document.getElementById('daily-locate')");
      await ev(`document.getElementById('daily-locate').value=${js(month)};document.querySelector('#sheetFoot [data-action=daily-locate-save]').click()`);
      await waitFor(b, "document.getElementById('overlay').hidden&&Pandora.idle()", 12000);
      await sleep(150);
    }
    const structureCases = [
      ['2024-02', 29, 5, 3],   // leap February starting Thursday
      ['2021-02', 28, 4, 0],   // February starting Monday: exactly four weeks
      ['2026-06', 30, 5, 0],   // June starting Monday
      ['2026-11', 30, 6, 6],   // November starting Sunday: six weeks
    ];
    for (const [month, days, weeks, leading] of structureCases) {
      await locate(month);
      const facts = await ev(`(()=>{const m=document.querySelector('.daily-month[data-month="${month}"]');if(!m)return null;
        const dates=Array.from(m.querySelectorAll('[data-daily-date]')).map(c=>c.dataset.dailyDate);
        const first=m.querySelector('.daily-week');
        let leading=0;for(const child of first.children){if(child.dataset.dailyDate)break;leading++;}
        const head=m.querySelector('.daily-month-head').getBoundingClientRect();
        const firstCell=m.querySelector('[data-daily-date]').getBoundingClientRect();
        return {weeks:m.querySelectorAll('.daily-week').length,days:dates.length,first:dates[0],last:dates[dates.length-1],
          leadingGaps:leading,
          gaps:m.querySelectorAll('.daily-gap').length,aligned:Math.abs(head.left-firstCell.left)<=1,
          unique:new Set(dates).size===dates.length,tag:!!m.querySelector('.daily-month-tag'),
          blankInteractive:Array.from(m.querySelectorAll('.daily-gap')).some(g=>g.tabIndex>=0||g.hasAttribute('data-daily-date'))}})()`);
      check(`${month} renders ${days} own dates in ${weeks} weeks with ${leading} leading blanks`,
        facts && facts.days === days && facts.weeks === weeks && facts.leadingGaps === leading &&
        facts.first === month + '-01' && facts.last === month + '-' + String(days).padStart(2, '0') &&
        facts.gaps === weeks * 7 - days && facts.aligned && facts.unique && !facts.tag && !facts.blankInteractive, facts);
    }
    const year = Number(fixture.today.slice(0, 4));
    await locate(year + '-12');
    const crossYear = await ev(`(()=>{const dates=Array.from(document.querySelectorAll('[data-daily-date]')).map(c=>c.dataset.dailyDate);
      const dec=document.querySelector('.daily-month[data-month="${year}-12"]'),jan=document.querySelector('.daily-month[data-month="${year + 1}-01"]');
      const decDates=dec?Array.from(dec.querySelectorAll('[data-daily-date]')).map(c=>c.dataset.dailyDate):[];
      const janDates=jan?Array.from(jan.querySelectorAll('[data-daily-date]')).map(c=>c.dataset.dailyDate):[];
      return {unique:new Set(dates).size===dates.length,dec:!!dec,jan:!!jan,decLast:decDates[decDates.length-1],janFirst:janDates[0],
        decDays:decDates.length,decExpected:new Date(Date.UTC(${year},12,0)).getUTCDate()}})()`);
    check('December to January keeps each month whole at the year boundary',
      crossYear.unique && crossYear.dec && crossYear.jan && crossYear.decLast === year + '-12-31' && crossYear.janFirst === (year + 1) + '-01-01' && crossYear.decDays === crossYear.decExpected, crossYear);

    /* -------- month navigation, today and page return -------- */
    await ev("document.querySelector('[data-action=daily-today]').click()");
    await sleep(300);
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

    /* -------- failed range retry keeps its own month range -------- */
    await b.send('Network.emulateNetworkConditions', { offline: true, latency: 0, downloadThroughput: 0, uploadThroughput: 0, connectionType: 'none' });
    await locate('2025-06');
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

    await require('./check_daily_items_form_browser')(b, fixture, check);
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
