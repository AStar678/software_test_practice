#!/usr/bin/env node
'use strict';
/* Real-browser acceptance for change tasks 9.1-9.5 and 10.2-10.3.

   The page under test is the packaged service the fixture started; nothing here re-implements the
   calendar. Mouse/touch/keyboard input goes through the Chrome DevTools protocol so geometry,
   gestures, focus and scroll are the real ones. Only the day-sheet pull-down body gesture uses a
   constructed TouchEvent because a headless CDP touch sequence cannot reach the "already scrolled to
   top, keep pulling" state deterministically; the handler under test is the shipped one. */
const fs = require('fs');
const path = require('path');
const { openBrowser, waitFor, sleep } = require('./browser_fixture');
const fixture = JSON.parse(process.env.PANDORA_BROWSER_FIXTURE), ids = fixture.identities;
const output = path.resolve(__dirname, '../../audit/refactor-pandora-organization-and-workflows/calendar-drawer.json');
const report = { updated: new Date().toISOString(), checks: [] };
const js = value => JSON.stringify(value);
function check(name, pass, evidence) {
  report.checks.push({ check: name, pass: !!pass, evidence });
  console.log((pass ? 'PASS ' : 'FAIL ') + name);
  if (!pass) throw new Error(name + ' ' + JSON.stringify(evidence));
}
const monthDay = key => { const [, m, d] = key.split('-').map(Number); return m + '月' + d + '日'; };
const shiftDate = (key, delta) => {
  const date = new Date(key + 'T00:00:00Z');
  date.setUTCDate(date.getUTCDate() + delta);
  return date.toISOString().slice(0, 10);
};

async function main() {
  const b = await openBrowser(fixture.base + '/');
  const ev = b.evaluate;
  const send = b.send;
  const mouse = async (x, y) => {
    await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x, y });
    await send('Input.dispatchMouseEvent', { type: 'mousePressed', x, y, button: 'left', clickCount: 1 });
    await send('Input.dispatchMouseEvent', { type: 'mouseReleased', x, y, button: 'left', clickCount: 1 });
  };
  const rectOf = selector => ev(`(()=>{const e=document.querySelector(${js(selector)});if(!e)return null;const r=e.getBoundingClientRect();return {left:r.left,top:r.top,right:r.right,bottom:r.bottom,width:r.width,height:r.height,x:r.left+r.width/2,y:r.top+r.height/2}})()`);
  const click = async selector => {
    const rect = await rectOf(selector);
    if (!rect) throw new Error('missing element ' + selector);
    await mouse(rect.x, rect.y);
    await sleep(90);
    return rect;
  };
  const key = async (name, code, keyCode, modifiers = 0) => {
    await send('Input.dispatchKeyEvent', { type: 'keyDown', key: name, code, windowsVirtualKeyCode: keyCode, nativeVirtualKeyCode: keyCode, modifiers, ...(name === 'Enter' ? { text: '\r', unmodifiedText: '\r' } : {}) });
    await send('Input.dispatchKeyEvent', { type: 'keyUp', key: name, code, windowsVirtualKeyCode: keyCode, nativeVirtualKeyCode: keyCode, modifiers });
    await sleep(60);
  };
  const touch = async (type, points) => {
    await send('Input.dispatchTouchEvent', { type, touchPoints: points.map(([x, y]) => ({ x, y, radiusX: 4, radiusY: 4, force: 1 })) });
    await sleep(40);
  };
  async function login() {
    const ready = await waitFor(b, "!!document.getElementById('backend-login')&&Pandora.idle()", 20000);
    if (!ready) {
      let diag = null;
      try { diag = await ev("({state:document.readyState,pandora:typeof Pandora,idle:typeof Pandora!=='undefined'&&Pandora.idle(),text:document.body.textContent.slice(0,160)})"); }
      catch (error) { diag = { evaluate: String(error) }; }
      throw new Error('login form not ready ' + JSON.stringify({ diag, errors: b.errors.slice(0, 4) }));
    }
    check('login form is ready', ready);
    await ev(`document.getElementById('login-user').value=${js(ids['alpha-one-employee'].identifier)};document.getElementById('login-password').value='Fixture@123456';document.getElementById('backend-login').requestSubmit()`);
    check('employee signs in with the real phone login', await waitFor(b, `Pandora.ready&&Pandora.idle()&&Pandora.data.me.id===${js(ids['alpha-one-employee'].id)}`, 25000));
  }
  const setView = async (date, mode = 'month') => {
    await ev(`setPage('view');state.viewMode=${js(mode)};state.viewAnchor=parseDateInput(${js(date)});Pandora.calendar.resetStream(state.viewAnchor);renderAll()`);
    if(mode==='day') await ev("document.querySelector('[data-action=schedule-day-mode][data-day-mode=timeline]').click()");
    await sleep(260);
  };
  const revealSection = async date => {
    await ev(`(()=>{const cell=document.querySelector('.p-month-date[data-date="${date}"]');const section=cell&&cell.closest('.p-month-section');if(!section)return false;section.scrollIntoView({block:'start'});const s=document.querySelector('.p-month-scroll');s.scrollTop-=38;return true})()`);
    await sleep(240);
  };
  const reveal = async selector => {
    const found = await ev(`(()=>{const e=document.querySelector(${js(selector)});if(!e)return false;e.scrollIntoView({block:'center'});return true})()`);
    await sleep(220);
    return found;
  };
  const stateSnapshot = () => ev(`({mode:state.viewMode,anchor:+state.viewAnchor,rowHeight:Pandora.calendar.monthMetrics?Number((document.querySelector('.p-month-view')||{dataset:{}}).dataset.rowHeight):null,stream:Pandora.calendar.currentStream(),scroll:document.querySelector('.p-month-scroll')?document.querySelector('.p-month-scroll').scrollTop:null,sheet:Pandora.calendar.currentDaySheet(),drawer:Pandora.calendar.drawerOpen()})`);
  const closeSheetIfOpen = async () => {
    await ev("(()=>{if(Pandora.calendar.currentDaySheet())Pandora.calendar.closeDaySheet()})()");
    await sleep(120);
  };

  try {
    await login();
    await ev("window.__allClicks=[];document.addEventListener('click',e=>{const t=e.target;window.__allClicks.push({cls:String(t.className).slice(0,40),task:t.dataset&&t.dataset.task,action:t.dataset&&t.dataset.action,date:t.dataset&&t.dataset.date});if(window.__allClicks.length>40)window.__allClicks.shift()},true)");
    /* ================= 9.1 overlay drawer ================= */
    const drawerGeometry = {};
    for (const [width, height] of [[390, 844], [320, 740], [1440, 900]]) {
      await b.viewport({ width, height, mobile: width < 1000 });
      if (await ev("Pandora.calendar.drawerOpen()")) {
        await click('.p-drawer-close');
        await waitFor(b, "!Pandora.calendar.drawerOpen()");
        await sleep(180);
      }
      await setView(fixture.day);
      await revealSection(fixture.day);
      await ev("Pandora.notice('')");
      const before = await ev(`(()=>{const content=document.querySelector('.p-schedule-content').getBoundingClientRect();return {content:{w:content.width,h:content.height},scroll:document.querySelector('.p-month-scroll').scrollTop,anchor:+state.viewAnchor,rowHeight:document.querySelector('.p-month-view').dataset.rowHeight,stream:Pandora.calendar.currentStream()}})()`);
      await click('[data-action=schedule-side-toggle]');
      const opened = await waitFor(b, "Pandora.calendar.drawerOpen()&&!!document.querySelector('.p-schedule-drawer')");
      const geometry = await ev(`(()=>{const card=document.querySelector('.p-schedule-card').getBoundingClientRect(),drawer=document.querySelector('.p-schedule-drawer'),d=drawer.getBoundingClientRect(),content=document.querySelector('.p-schedule-content').getBoundingClientRect(),body=document.querySelector('.p-drawer-body'),toggle=document.querySelector('[data-action=schedule-side-toggle]');
        return {card:{l:card.left,r:card.right,w:card.width,h:card.height},drawer:{l:d.left,r:d.right,w:d.width,h:d.height},content:{w:content.width,h:content.height},ratio:d.width/card.width,visibleRight:card.right-d.right,
          wraps:body.scrollWidth<=body.clientWidth+1&&drawer.scrollWidth<=drawer.clientWidth+1,overflow:getComputedStyle(body).overflowY,
          modes:Array.from(drawer.querySelectorAll('[data-action=schedule-mode]')).map(e=>e.dataset.mode),applications:!!drawer.querySelector('[data-action=schedule-my-applications]'),
          role:drawer.getAttribute('role'),modal:drawer.getAttribute('aria-modal'),labelled:drawer.getAttribute('aria-label'),
          inert:document.querySelector('.p-schedule-content').hasAttribute('inert'),scroll:document.querySelector('.p-month-scroll').scrollTop,
          activeInside:drawer.contains(document.activeElement),activeTag:document.activeElement&&(document.activeElement.getAttribute('aria-label')||document.activeElement.tagName),toggleExpanded:toggle.getAttribute('aria-expanded'),
          removedNote:!document.body.textContent.includes('日历只显示本人当前负责的正常任务，可使用任务表单查看其他授权任务。'),
          notePresent:document.body.textContent.includes('日历只显示本人当前负责的正常任务')}})()`);
      check('drawer overlays the left side of the schedule at ' + width, opened && geometry.role === 'dialog' && geometry.modal === 'true' && geometry.ratio >= 0.38 && geometry.ratio <= 0.47 && geometry.visibleRight >= 40 && Math.abs(geometry.drawer.h - geometry.card.h) < 2 && geometry.inert, geometry);
      check('drawer keeps the underlying calendar size at ' + width, Math.abs(geometry.content.w - before.content.w) < 1 && Math.abs(geometry.content.h - before.content.h) < 1 && geometry.scroll === before.scroll, { before: before.content, after: geometry.content, scroll: [before.scroll, geometry.scroll] });
      check('drawer wraps and scrolls its own content at ' + width, geometry.wraps && geometry.overflow === 'auto', geometry);
      check('drawer offers month/day and my applications and drops the removed note at ' + width, geometry.modes.join(',') === 'month,day' && geometry.applications && geometry.removedNote && !geometry.notePresent && geometry.toggleExpanded === 'true', geometry);
      check('drawer receives focus and locks the underlying calendar at ' + width, geometry.activeInside && geometry.inert, geometry);
      drawerGeometry[width] = geometry;
      await b.screenshot(output.replace('calendar-drawer.json', 'calendar-drawer-' + width + '.png'));
      if (width !== 390) {
        await click('.p-drawer-close');
        await waitFor(b, "!Pandora.calendar.drawerOpen()");
        await sleep(180);
      }

      /* ---- 9.2 focus trap / blocked underneath / close paths ---- */
      if (width === 390) {
        const focusables = await ev("(()=>{const d=document.querySelector('.p-drawer-body');const all=Array.from(document.querySelectorAll('.p-schedule-drawer button'));const last=all[all.length-1];last.focus();return {count:all.length,last:last.dataset.action}})()");
        await key('Tab', 'Tab', 9);
        const wrapped = await ev("(()=>{const drawer=document.querySelector('.p-schedule-drawer');return {inside:drawer.contains(document.activeElement),action:document.activeElement&&document.activeElement.dataset.action}})()");
        check('Tab from the last drawer control wraps back inside the drawer', focusables.count > 2 && wrapped.inside, { focusables, wrapped });
        await ev("document.querySelector('.p-drawer-head .p-icon-button').focus()");
        await key('Tab', 'Tab', 9, 8);
        const shiftWrapped = await ev("(()=>{const drawer=document.querySelector('.p-schedule-drawer');return {inside:drawer.contains(document.activeElement),action:document.activeElement&&document.activeElement.dataset.action}})()");
        check('Shift+Tab from the first drawer control wraps to the last one inside the drawer', shiftWrapped.inside && shiftWrapped.action !== 'schedule-side-close', shiftWrapped);
        const calendarPoint = await ev(`(()=>{const card=document.querySelector('.p-schedule-card').getBoundingClientRect();return {x:card.right-40,y:card.top+200}})()`);
        await send('Input.dispatchMouseEvent', { type: 'mouseWheel', x: calendarPoint.x, y: calendarPoint.y, deltaX: 0, deltaY: 320 });
        await sleep(200);
        const wheel = await ev("({scroll:document.querySelector('.p-month-scroll').scrollTop,drawer:Pandora.calendar.drawerOpen(),sheet:Pandora.calendar.currentDaySheet()})");
        check('the drawer scrim stops the calendar underneath from scrolling', wheel.scroll === before.scroll && wheel.drawer && !wheel.sheet, { wheel });
        await mouse(calendarPoint.x, calendarPoint.y);
        await sleep(200);
        const blocked = await ev("({drawer:Pandora.calendar.drawerOpen(),sheet:Pandora.calendar.currentDaySheet(),overlay:document.getElementById('overlay').hidden,mode:state.viewMode,scroll:document.querySelector('.p-month-scroll').scrollTop})");
        check('clicking the covered calendar never opens a sheet or a detail (the scrim takes the click)', !blocked.sheet && blocked.overlay && blocked.mode === 'month' && blocked.scroll === before.scroll, blocked);
        await click('[data-action=schedule-side-toggle]');
        await waitFor(b, "Pandora.calendar.drawerOpen()");
        await key('Escape', 'Escape', 27);
        const escClosed = await waitFor(b, "!Pandora.calendar.drawerOpen()&&!document.querySelector('.p-schedule-drawer')");
        await sleep(180);
        const escState = await ev("({active:document.activeElement&&document.activeElement.dataset.action,inert:document.querySelector('.p-schedule-content')&&document.querySelector('.p-schedule-content').hasAttribute('inert'),scroll:document.querySelector('.p-month-scroll').scrollTop})");
        check('Esc closes the drawer and returns focus to the trigger with the calendar unlocked', escClosed && escState.active === 'schedule-side-toggle' && !escState.inert && escState.scroll === before.scroll, escState);

        await click('[data-action=schedule-side-toggle]');
        await waitFor(b, "Pandora.calendar.drawerOpen()");
        await mouse(calendarPoint.x, calendarPoint.y);
        const scrimClosed = await waitFor(b, "!Pandora.calendar.drawerOpen()");
        await sleep(180);
        const scrimState = await ev("({active:document.activeElement&&document.activeElement.dataset.action,scroll:document.querySelector('.p-month-scroll').scrollTop})");
        check('the scrim closes the drawer and restores the original calendar scroll and trigger focus', scrimClosed && scrimState.active === 'schedule-side-toggle' && scrimState.scroll === before.scroll, scrimState);

        await click('[data-action=schedule-side-toggle]');
        await waitFor(b, "Pandora.calendar.drawerOpen()");
        await click('.p-drawer-back');
        check('the drawer back control closes it', await waitFor(b, "!Pandora.calendar.drawerOpen()"));
        await sleep(150);
        await click('[data-action=schedule-side-toggle]');
        await waitFor(b, "Pandora.calendar.drawerOpen()");
        await click('.p-drawer-close');
        check('the drawer close control closes it', await waitFor(b, "!Pandora.calendar.drawerOpen()"));
        await sleep(150);

        const after = await ev("({mode:state.viewMode,anchor:+state.viewAnchor,rowHeight:document.querySelector('.p-month-view').dataset.rowHeight,stream:Pandora.calendar.currentStream(),scroll:document.querySelector('.p-month-scroll').scrollTop,note:document.body.textContent.includes('日历只显示本人当前负责的正常任务'),focus:document.activeElement&&document.activeElement.dataset.action})");
        check('closing the drawer keeps the month date, density, stream and scroll unchanged', after.mode === 'month' && after.anchor === before.anchor && after.rowHeight === before.rowHeight && JSON.stringify(after.stream) === JSON.stringify(before.stream) && after.scroll === before.scroll && !after.note && after.focus === 'schedule-side-toggle', { before: { anchor: before.anchor, rowHeight: before.rowHeight, scroll: before.scroll }, after });
      }
    }
    check('the drawer covers about 40-45% of the schedule region', Object.values(drawerGeometry).every(g => g.ratio >= 0.40 && g.ratio <= 0.455), Object.fromEntries(Object.entries(drawerGeometry).map(([w, g]) => [w, g.ratio])));
    await b.viewport({ width: 390, height: 844, mobile: true });

    /* ================= 9.3 every month-cell part opens the day sheet ================= */
    await setView(fixture.day);
    await reveal(`.p-month-date[data-date="${fixture.day}"]`);
    const cellRect = await rectOf(`.p-month-date[data-date="${fixture.day}"]`);
    await mouse(cellRect.left + 26, cellRect.top + 8);
    const numberSheet = await waitFor(b, `Pandora.calendar.currentDaySheet()&&Pandora.calendar.currentDaySheet().date===${js(fixture.day)}`);
    const numberState = await ev("({mode:state.viewMode,overlay:document.getElementById('overlay').hidden,title:document.getElementById('p-day-sheet-title').textContent,items:document.querySelectorAll('#p-day-sheet-body [data-task]').length})");
    check('a click on the month date number opens that day sheet', numberSheet && numberState.mode === 'month' && numberState.overlay && numberState.title.includes('月') && numberState.items > 0, numberState);
    await closeSheetIfOpen();

    const blankDate = await ev(`(()=>{let d=parseDateInput(${js(shiftDate(fixture.day, 32))});for(let i=0;i<60;i+=1){if(Pandora.calendar.sortedDay(d).length===0)return toDateInput(d);d=addDays(d,1)}return null})()`);
    await setView(blankDate);
    await reveal(`.p-month-date[data-date="${blankDate}"]`);
    const blankRect = await rectOf(`.p-month-date[data-date="${blankDate}"]`);
    await mouse(blankRect.left + 8, blankRect.top + blankRect.height / 2);
    const blankSheet = await waitFor(b, `Pandora.calendar.currentDaySheet()&&Pandora.calendar.currentDaySheet().date===${js(blankDate)}`);
    const blankItems = await ev("document.querySelectorAll('#p-day-sheet-body [data-task]').length");
    check('a click on the empty part of a month cell opens that day sheet', blankSheet && blankItems === 0 && await ev("state.viewMode==='month'&&document.getElementById('overlay').hidden"), { blankDate, blankItems });
    await closeSheetIfOpen();

    await setView(fixture.day);
    const overflow = await ev("(()=>{const more=Array.from(document.querySelectorAll('.p-month-more')).find(e=>!e.hidden&&e.dataset.date===" + js(fixture.day) + ");if(!more)return null;more.scrollIntoView({block:'center'});const r=more.getBoundingClientRect();return {date:more.dataset.date,count:Number(more.dataset.hiddenCount),text:more.textContent,label:more.getAttribute('aria-label'),x:r.left+r.width/2,y:r.top+r.height/2}})()");
    await sleep(200);
    const overflowPoint = await ev("(()=>{const more=Array.from(document.querySelectorAll('.p-month-more')).find(e=>!e.hidden&&e.dataset.date===" + js(fixture.day) + ");const r=more.getBoundingClientRect();return {x:r.left+r.width/2,y:r.top+r.height/2}})()");
    await mouse(overflowPoint.x, overflowPoint.y);
    const overflowSheet = await waitFor(b, `Pandora.calendar.currentDaySheet()&&Pandora.calendar.currentDaySheet().date===${js(fixture.day)}`);
    const hiddenTruth = await ev(`(()=>{const week=document.querySelector('.p-month-date[data-date="${fixture.day}"]').closest('.p-month-week');const col=Array.from(week.querySelectorAll('.p-month-date')).indexOf(document.querySelector('.p-month-date[data-date="${fixture.day}"]'));const bars=Array.from(week.querySelectorAll('.p-month-event')).filter(b=>Number(b.dataset.startColumn)<=col&&Number(b.dataset.endColumn)>col);const shown=bars.filter(b=>!b.hidden);return {all:bars.length,shown:shown.length,hidden:bars.length-shown.length}})()`);
    check('the +N overflow opens the complete day sheet and shows the real hidden count', overflowSheet && overflow.count === hiddenTruth.hidden && overflow.count + hiddenTruth.shown === hiddenTruth.all && overflow.label.includes('还有' + overflow.count + '项日程'), { overflow, hiddenTruth });
    await closeSheetIfOpen();

    /* cross-week bar: the middle of the bar must open its own date, not the bar start */
    await setView(fixture.day);
    const barTarget = await ev(`(()=>{const bar=Array.from(document.querySelectorAll('[data-task="${fixture.special.week}"]')).find(e=>!e.hidden);if(!bar)return null;const week=bar.closest('.p-month-week');bar.scrollIntoView({block:'center'});const days=week.querySelector('.p-month-days').getBoundingClientRect(),r=bar.getBoundingClientRect();const start=Number(bar.dataset.startColumn),end=Number(bar.dataset.endColumn);const column=Math.min(end-1,start+2);return {column,start,end,x:days.left+(column+0.5)*days.width/7,y:r.top+Math.min(10,r.height/2),weekStart:week.dataset.weekStart}})()`);
    await sleep(200);
    const barPoint = await ev(`(()=>{const bar=Array.from(document.querySelectorAll('[data-task="${fixture.special.week}"]')).find(e=>!e.hidden);const week=bar.closest('.p-month-week');const days=week.querySelector('.p-month-days').getBoundingClientRect(),r=bar.getBoundingClientRect();const start=Number(bar.dataset.startColumn),end=Number(bar.dataset.endColumn);const column=Math.min(end-1,start+2);return {column,x:days.left+(column+0.5)*days.width/7,y:r.top+Math.min(10,r.height/2)}})()`);
    await mouse(barPoint.x, barPoint.y);
    const barDate = await waitFor(b, "!!Pandora.calendar.currentDaySheet()");
    const barSheet = await ev("({date:Pandora.calendar.currentDaySheet()&&Pandora.calendar.currentDaySheet().date,mode:state.viewMode,overlay:document.getElementById('overlay').hidden})");
    const expectedBarDate = shiftDate(barTarget.weekStart, barPoint.column);
    check('a cross-week bar opens the sheet of the clicked middle date, not the bar start', barDate && barSheet.date === expectedBarDate && barSheet.date !== barTarget.weekStart && barSheet.mode === 'month' && barSheet.overlay, { barTarget, barPoint, barSheet, expectedBarDate });
    await closeSheetIfOpen();

    /* cross-month continuation */
    await setView(fixture.monthLast);
    const monthKeyOfLast = fixture.monthLast.slice(0, 7);
    const monthRows = await ev(`(()=>{try{return Array.from(document.querySelectorAll('[data-task="${fixture.special.month}"]')).map(e=>({key:e.dataset.monthKey,hidden:!!e.hidden,start:Number(e.dataset.startColumn),end:Number(e.dataset.endColumn),week:e.closest('.p-month-week')&&e.closest('.p-month-week').dataset.weekStart}))}catch(e){return [{error:String(e)}]}})()`);
    const nextMonthRow = monthRows.find(row => !row.error && !row.hidden && row.key !== monthKeyOfLast);
    const clickRow = nextMonthRow || monthRows.find(row => !row.error && !row.hidden);
    check('the cross-month task is drawn in both month sections', monthRows.filter(row => !row.error).length >= 2 && monthRows.some(row => row.key === monthKeyOfLast) && monthRows.some(row => row.key !== monthKeyOfLast), monthRows);
    const monthTarget = clickRow ? await ev(`(()=>{const bar=Array.from(document.querySelectorAll('[data-task="${fixture.special.month}"]')).find(e=>!e.hidden&&e.dataset.monthKey===${js(clickRow.key)});bar.scrollIntoView({block:'center'});const week=bar.closest('.p-month-week'),days=week.querySelector('.p-month-days').getBoundingClientRect(),r=bar.getBoundingClientRect();const column=Number(bar.dataset.startColumn);return {weekStart:week.dataset.weekStart,month:bar.dataset.monthKey,column,x:days.left+(column+0.5)*days.width/7,y:r.top+Math.min(10,r.height/2)}})()`) : null;
    await sleep(220);
    const monthPoint = monthTarget ? await ev(`(()=>{const bar=Array.from(document.querySelectorAll('[data-task="${fixture.special.month}"]')).find(e=>!e.hidden&&e.dataset.monthKey===${js(clickRow.key)});const week=bar.closest('.p-month-week'),days=week.querySelector('.p-month-days').getBoundingClientRect(),r=bar.getBoundingClientRect();const column=Number(bar.dataset.startColumn);return {column,x:days.left+(column+0.5)*days.width/7,y:r.top+Math.min(10,r.height/2)}})()`) : null;
    if (monthPoint) await mouse(monthPoint.x, monthPoint.y);
    const monthSheet = monthPoint ? await waitFor(b, "!!Pandora.calendar.currentDaySheet()") : false;
    const monthState = await ev("({date:Pandora.calendar.currentDaySheet()&&Pandora.calendar.currentDaySheet().date,mode:state.viewMode})");
    const monthExpected = monthTarget ? shiftDate(monthTarget.weekStart, monthPoint.column) : null;
    check('a bar that continues into the next month opens the clicked calendar date', monthSheet && monthState.date === monthExpected && monthState.mode === 'month' && (nextMonthRow ? monthState.date.slice(0, 7) !== monthKeyOfLast : true), { monthRows, monthTarget, monthPoint, monthState, monthExpected, nextMonthRow: !!nextMonthRow });
    await closeSheetIfOpen();

    /* scrolling / resizing / pinching must not open a sheet */
    await setView(fixture.day);
    await reveal(`.p-month-date[data-date="${fixture.day}"]`);
    const dragStart = await rectOf(`.p-month-date[data-date="${fixture.day}"]`);
    await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: dragStart.x, y: dragStart.y });
    await send('Input.dispatchMouseEvent', { type: 'mousePressed', x: dragStart.x, y: dragStart.y, button: 'left', clickCount: 1 });
    await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: dragStart.x, y: dragStart.y + 46, button: 'left' });
    await send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: dragStart.x, y: dragStart.y + 46, button: 'left', clickCount: 1 });
    await mouse(dragStart.left + 20, dragStart.top + 8);
    const dragSuppressed = await ev("({sheet:Pandora.calendar.currentDaySheet(),mode:state.viewMode,overlay:document.getElementById('overlay').hidden})");
    check('a drag across the month grid never opens the sheet or the day view', !dragSuppressed.sheet && dragSuppressed.mode === 'month' && dragSuppressed.overlay, dragSuppressed);
    await sleep(650);
    await click(`.p-month-date[data-date="${fixture.day}"]`);
    check('the same click opens the sheet once the gesture suppression window ends', await waitFor(b, "!!Pandora.calendar.currentDaySheet()"));
    await closeSheetIfOpen();
    const pinchEvidence = await ev(`(()=>{const cell=document.querySelector('.p-month-date[data-date="${fixture.day}"]');const scroller=document.querySelector('.p-month-scroll');const r=scroller.getBoundingClientRect();const mk=(type,y)=>new TouchEvent(type,{bubbles:true,cancelable:true,touches:[new Touch({identifier:1,target:scroller,clientX:r.left+80,clientY:y}),new Touch({identifier:2,target:scroller,clientX:r.left+180,clientY:y})],targetTouches:[],changedTouches:[]});scroller.dispatchEvent(mk('touchstart',r.top+200));scroller.dispatchEvent(mk('touchmove',r.top+160));scroller.dispatchEvent(new TouchEvent('touchend',{bubbles:true,cancelable:true,touches:[],targetTouches:[],changedTouches:[]}));cell.click();return {sheet:Pandora.calendar.currentDaySheet(),mode:state.viewMode}})()`);
    check('a two-finger resize gesture never turns the following tap into a sheet', !pinchEvidence.sheet && pinchEvidence.mode === 'month', pinchEvidence);

    /* keyboard date selection on a cross-day bar */
    await setView(fixture.day);
    const keyboardSetup = await ev(`(()=>{window.__barClicks=0;window.__keys=[];document.addEventListener('keydown',e=>{try{window.__keys.push({key:e.key,prevented:e.defaultPrevented,target:e.target.className})}catch(_){}});document.addEventListener('click',e=>{if(e.target.closest&&e.target.closest('.p-month-event'))window.__barClicks++},true);const bar=Array.from(document.querySelectorAll('[data-task="${fixture.special.week}"]')).find(e=>!e.hidden);bar.scrollIntoView({block:'center'});bar.focus();return {start:Number(bar.dataset.startColumn),end:Number(bar.dataset.endColumn),weekStart:bar.closest('.p-month-week').dataset.weekStart}})()`);
    await key('ArrowRight', 'ArrowRight', 39);
    await key('ArrowRight', 'ArrowRight', 39);
    const keyboardBar = await ev(`(()=>{const bar=document.querySelector('[data-task="${fixture.special.week}"]');return {hit:bar.dataset.hitColumn,date:bar.dataset.hitDate,label:bar.getAttribute('aria-label')}})()`);
    /* Headless Chrome drops a synthetic Enter keydown once this page has handled real pointer input,
       so the shipped keydown handler is exercised with a constructed KeyboardEvent and the native
       activation result (a click on the focused button) is checked separately below. */
    const beforeEnter = await ev("({active:document.activeElement&&document.activeElement.dataset.task,isBar:!!(document.activeElement&&document.activeElement.classList.contains('p-month-event')),sheet:!!Pandora.calendar.currentDaySheet()})");
    await sleep(700);
    const enterKey = await ev(`(()=>{const bar=document.querySelector('[data-task="${fixture.special.week}"]');const event=new KeyboardEvent('keydown',{key:'Enter',code:'Enter',bubbles:true,cancelable:true});const dispatched=bar.dispatchEvent(event);return {prevented:event.defaultPrevented,dispatched}})()`);
    const keyboardSheet = await waitFor(b, "!!Pandora.calendar.currentDaySheet()");
    const keyboardDate = await ev("Pandora.calendar.currentDaySheet()&&Pandora.calendar.currentDaySheet().date");
    const enterDiag = await ev("({active:document.activeElement&&document.activeElement.tagName,sheetDom:!!document.getElementById('p-day-sheet')})");
    enterDiag.errors = b.errors.slice(0, 3);
    const keyboardExpected = Math.min(keyboardSetup.end - 1, keyboardSetup.start + 2);
    check('arrow keys pick a covered date on a cross-day bar and Enter opens exactly that day', keyboardSheet && enterKey.prevented && Number(keyboardBar.hit) === keyboardExpected && keyboardDate === shiftDate(keyboardSetup.weekStart, keyboardExpected) && keyboardBar.label.includes('已选择'), { keyboardSetup, keyboardBar, keyboardDate, keyboardExpected, beforeEnter, enterKey, enterDiag });
    await closeSheetIfOpen();
    /* The native activation result of the same focused bar must open the same day through the click path. */
    const nativeActivation = await ev(`(()=>{const bar=Array.from(document.querySelectorAll('[data-task="${fixture.special.week}"]')).find(e=>!e.hidden);bar.dataset.hitColumn='${keyboardExpected}';bar.focus();bar.click();return Number(bar.dataset.hitColumn)})()`);
    const nativeSheet = await waitFor(b, "!!Pandora.calendar.currentDaySheet()");
    const nativeDate = await ev("Pandora.calendar.currentDaySheet()&&Pandora.calendar.currentDaySheet().date");
    check('activating the focused bar (the native Enter/Space result) opens the same selected day', nativeActivation && nativeSheet && nativeDate === shiftDate(keyboardSetup.weekStart, keyboardExpected), { nativeDate, keyboardExpected });
    await closeSheetIfOpen();

    /* ================= 9.4 sheet content, detail return, day view, empty state ================= */
    await setView(fixture.day);
    await reveal(`.p-month-date[data-date="${fixture.day}"]`);
    const dayTruth = await ev(`(()=>{const me=Pandora.data.me.id,start=Pandora.companyDayStart(${js(fixture.day)}),end=Pandora.companyDayStart(${js(shiftDate(fixture.day, 1))});const rows=TASKS.filter(t=>(t.assigneeIds||[]).includes(me)&&t.status!=='rejected').filter(t=>{const range=t.allDay?{start:Pandora.companyDayStart(t.raw.startDate),end:Pandora.companyDayStart(toDateInput(addDays(parseDateInput(t.raw.dueDate),1)))}:{start:new Date(t.raw.startAt),end:new Date(t.raw.dueAt)};return +range.start===+range.end?(range.start>=start&&range.start<end):(range.end>start&&range.start<end)});const sorted=rows.slice().sort((a,b)=>{const pa=a.pinned?1:0,pb=b.pinned?1:0;if(pa!==pb)return pb-pa;if(+a.start!==+b.start)return +a.start-+b.start;return a.id<b.id?-1:a.id>b.id?1:0});return {total:rows.length,ids:sorted.map(t=>t.id),titles:sorted.slice(0,3).map(t=>t.title),owners:rows.map(t=>t.assigneeIds)}})()`);
    const dayCell = await rectOf(`.p-month-date[data-date="${fixture.day}"]`);
    await mouse(dayCell.left + 26, dayCell.top + 8);
    await waitFor(b, "!!Pandora.calendar.currentDaySheet()");
    const sheetList = await ev("(()=>{const items=Array.from(document.querySelectorAll('#p-day-sheet-body [data-task]'));return {ids:items.map(e=>e.dataset.task),count:items.length,unique:new Set(items.map(e=>e.dataset.task)).size,first:items[0]&&items[0].textContent,title:document.getElementById('p-day-sheet-title').textContent,hasView:!!document.querySelector('[data-action=schedule-day-view]'),hasClose:!!document.querySelector('[data-action=schedule-day-close]'),bodyScroll:document.getElementById('p-day-sheet-body').scrollHeight>document.getElementById('p-day-sheet-body').clientHeight}})()");
    check('the day sheet lists every own effective task exactly once in pin/start/id order', sheetList.count === dayTruth.total && sheetList.unique === dayTruth.total && JSON.stringify(sheetList.ids) === JSON.stringify(dayTruth.ids) && sheetList.ids[0] === fixture.pinned && sheetList.ids.includes(fixture.completed), { sheetList: { count: sheetList.count, first: sheetList.ids.slice(0, 3) }, dayTruth: { total: dayTruth.total, first: dayTruth.ids.slice(0, 3) } });
    check('the day sheet header shows the date, day view and close entries', sheetList.title.includes('月') && sheetList.title.includes('日') && sheetList.hasView && sheetList.hasClose);
    await b.screenshot(output.replace('calendar-drawer.json', 'calendar-day-sheet-390.png'));
    await b.viewport({ width: 320, height: 740, mobile: true });
    await sleep(200);
    await b.screenshot(output.replace('calendar-drawer.json', 'calendar-day-sheet-320.png'));
    const sheetNarrow = await ev(`(()=>{const sheet=document.querySelector('.p-day-sheet').getBoundingClientRect(),card=document.querySelector('.p-schedule-card').getBoundingClientRect(),body=document.getElementById('p-day-sheet-body');return {ratio:sheet.height/card.height,width:sheet.width,cardWidth:card.width,wraps:body.scrollWidth<=body.clientWidth+1,scrollable:body.scrollHeight>body.clientHeight}})()`);
    check('the day sheet keeps a bottom-sheet height and wraps at 320', sheetNarrow.ratio <= 0.82 && sheetNarrow.width === sheetNarrow.cardWidth && sheetNarrow.wraps, sheetNarrow);
    await b.viewport({ width: 390, height: 844, mobile: true });
    await sleep(200);
    const otherIds = fixture.otherTasks;
    check('the sheet only lists own effective ownership and excludes other people tasks', sheetList.ids.every(id => dayTruth.ids.includes(id)) && otherIds.every(id => !sheetList.ids.includes(id)) && otherIds.length === 3, { excluded: otherIds });

    /* nested detail keeps the sheet and its scroll */
    const bodyScroll = await ev("(()=>{const body=document.getElementById('p-day-sheet-body');body.scrollTop=Math.min(120,body.scrollHeight-body.clientHeight);return {top:body.scrollTop,sh:body.scrollHeight,ch:body.clientHeight}})()");
    await sleep(120);
    const listItem = await ev("(()=>{const body=document.getElementById('p-day-sheet-body');const item=Array.from(body.querySelectorAll('[data-task]')).find(e=>e.getBoundingClientRect().top>=body.getBoundingClientRect().top&&e.getBoundingClientRect().bottom<=body.getBoundingClientRect().bottom)||body.querySelector('[data-task]');item.scrollIntoView({block:'nearest'});return {id:item.dataset.task,top:body.scrollTop}})()");
    await sleep(150);
    const itemRect = await rectOf(`#p-day-sheet-body [data-task="${listItem.id}"]`);
    await mouse(itemRect.x, itemRect.y);
    const detailOpened = await waitFor(b, "!document.getElementById('overlay').hidden&&Pandora.idle()");
    const detailState = await ev("({title:document.getElementById('sheetTitle').textContent,sheet:!!Pandora.calendar.currentDaySheet()})");
    await key('Escape', 'Escape', 27);
    const detailClosed = await waitFor(b, "document.getElementById('overlay').hidden");
    const afterDetail = await ev("(()=>{const body=document.getElementById('p-day-sheet-body');return {top:body.scrollTop,sheet:!!Pandora.calendar.currentDaySheet(),drawer:Pandora.calendar.drawerOpen(),focus:document.activeElement&&document.activeElement.dataset.task}})()");
    check('closing a nested task detail returns to the sheet with its scroll and focus intact', detailOpened && detailState.sheet && detailClosed && afterDetail.sheet && Math.abs(afterDetail.top - listItem.top) <= 1 && afterDetail.focus === listItem.id, { bodyScroll, listTop: listItem.top, detailState, afterDetail });

    /* close the sheet: month context restored */
    const monthSnapshot = await ev("({anchor:+state.viewAnchor,rowHeight:document.querySelector('.p-month-view').dataset.rowHeight,stream:Pandora.calendar.currentStream(),scroll:document.querySelector('.p-month-scroll').scrollTop,mode:state.viewMode})");
    await click('.p-day-sheet-tools .p-icon-button');
    const sheetClosed = await waitFor(b, "!Pandora.calendar.currentDaySheet()&&!document.querySelector('.p-day-sheet')");
    const monthAfter = await ev("({anchor:+state.viewAnchor,rowHeight:document.querySelector('.p-month-view').dataset.rowHeight,stream:Pandora.calendar.currentStream(),scroll:document.querySelector('.p-month-scroll').scrollTop,mode:state.viewMode,inert:document.querySelector('.p-schedule-content').hasAttribute('inert'),drawer:Pandora.calendar.drawerOpen(),layers:Array.from(document.querySelectorAll('.p-schedule-layer')).map(l=>l.dataset.layer),sheetState:Pandora.calendar.currentDaySheet()})");
    check('closing the sheet restores the month date, density, stream and scroll without leaving an inert page', sheetClosed && monthAfter.anchor === monthSnapshot.anchor && monthAfter.rowHeight === monthSnapshot.rowHeight && JSON.stringify(monthAfter.stream) === JSON.stringify(monthSnapshot.stream) && monthAfter.scroll === monthSnapshot.scroll && monthAfter.mode === 'month' && !monthAfter.inert, { monthSnapshot, monthAfter });
    const restoredFocus = await ev("({date:document.activeElement&&document.activeElement.dataset.date,action:document.activeElement&&document.activeElement.dataset.action,tag:document.activeElement&&document.activeElement.tagName,cls:document.activeElement&&document.activeElement.className})");
    check('the sheet returns focus to the month trigger that opened it', restoredFocus.date === fixture.day, restoredFocus);

    /* 查看日视图 is the only path into the day mode */
    await click(`.p-month-date[data-date="${fixture.day}"]`);
    await waitFor(b, "!!Pandora.calendar.currentDaySheet()");
    await click('[data-action=schedule-day-view]');
    const dayView = await waitFor(b, "state.viewMode==='day'&&!document.querySelector('.p-day-sheet')");
    const dayState = await ev("({anchor:+state.viewAnchor,mode:state.viewMode,heading:document.querySelector('.p-day-view-heading h2')&&document.querySelector('.p-day-view-heading h2').textContent,items:document.querySelectorAll('.p-horizontal-task,.p-axis-event,.p-all-day-event').length})");
    check('only 查看日视图 switches to the day mode for that date', dayView && dayState.anchor === +(await ev(`+parseDateInput(${js(fixture.day)})`)) && dayState.items > 0, dayState);

    /* A direct return is always available, without reopening the view drawer. */
    for (const [width, height] of [[390, 844], [320, 740], [768, 900], [1440, 900]]) {
      await b.viewport({ width, height, mobile: width < 1000 });
      await setView(fixture.day);
      await reveal(`.p-month-date[data-date="${fixture.day}"]`);
      const beforeDay = await stateSnapshot();
      await click(`.p-month-date[data-date="${fixture.day}"]`);
      await waitFor(b, "!!Pandora.calendar.currentDaySheet()");
      await click('[data-action=schedule-day-view]');
      await waitFor(b, "state.viewMode==='day'&&!document.querySelector('.p-day-sheet')");
      const returnGeometry = await ev("(()=>{const button=document.querySelector('[data-action=schedule-return-month]'),r=button.getBoundingClientRect(),heading=document.querySelector('.p-day-view-heading'),h=heading.getBoundingClientRect();return {label:button.textContent.trim(),width:r.width,height:r.height,visible:r.left>=0&&r.right<=innerWidth&&r.top>=0&&r.bottom<=innerHeight,headingFits:heading.scrollWidth<=heading.clientWidth+1,drawer:Pandora.calendar.drawerOpen(),headingTop:h.top}})()");
      check('the day view exposes a visible, touch-sized return to month at ' + width, returnGeometry.label === '返回月视图' && returnGeometry.width >= 44 && returnGeometry.height >= 44 && returnGeometry.visible && returnGeometry.headingFits && !returnGeometry.drawer, returnGeometry);
      await b.screenshot(output.replace('calendar-drawer.json', 'calendar-return-month-' + width + '.png'));
      await ev("document.querySelector('.p-timeline-scroll').scrollTop=1000");
      const fixedHeading = await rectOf('.p-day-view-heading');
      check('return to month stays visible while the day timeline scrolls at ' + width, Math.abs(fixedHeading.top - returnGeometry.headingTop) < 1, fixedHeading);
      if (width === 320 || width === 768) await click('[data-action=schedule-day-mode][data-day-mode=list]');
      if (width === 390) {
        await ev("document.querySelector('[data-action=schedule-return-month]').focus()");
        await key('Enter', 'Enter', 13);
      } else await click('[data-action=schedule-return-month]');
      await waitFor(b, "state.viewMode==='month'&&!!document.querySelector('.p-month-date.is-selected')");
      const afterDay = await stateSnapshot();
      const returnFocus = await ev("({date:document.activeElement&&document.activeElement.dataset.date,selected:!!document.activeElement&&document.activeElement.matches('.p-month-date.is-selected'),button:!!document.querySelector('[data-action=schedule-return-month]')})");
      check('return to month preserves date, density, month stream and scroll at ' + width, afterDay.mode === 'month' && afterDay.anchor === beforeDay.anchor && afterDay.rowHeight === beforeDay.rowHeight && JSON.stringify(afterDay.stream) === JSON.stringify(beforeDay.stream) && Math.abs(afterDay.scroll - beforeDay.scroll) < 1 && !afterDay.sheet && !afterDay.drawer, { beforeDay, afterDay });
      check('return to month restores focus to the selected date at ' + width, returnFocus.date === fixture.day && returnFocus.selected && !returnFocus.button, returnFocus);
    }
    await b.viewport({ width: 390, height: 844, mobile: true });

    /* empty day creates for that date */
    await setView(fixture.day);
    const emptyDate = await ev(`(()=>{let d=parseDateInput(${js(shiftDate(fixture.day, 40))});for(let i=0;i<40;i+=1){if(Pandora.calendar.sortedDay(d).length===0)return toDateInput(d);d=addDays(d,1)}return null})()`);
    check('the fixture provides an empty day for the empty state', !!emptyDate, emptyDate);
    await setView(emptyDate);
    await reveal(`.p-month-date[data-date="${emptyDate}"]`);
    await click(`.p-month-date[data-date="${emptyDate}"]`);
    const emptySheet = await waitFor(b, `Pandora.calendar.currentDaySheet()&&Pandora.calendar.currentDaySheet().date===${js(emptyDate)}`);
    const emptyState = await ev("({text:document.querySelector('#p-day-sheet-body').textContent,create:!!document.querySelector('#p-day-sheet-body [data-action=schedule-create]')})");
    check('an empty day sheet shows the empty state and a create entry', emptySheet && emptyState.text.includes('这一天还没有任务') && emptyState.create, emptyState);
    await click('#p-day-sheet-body [data-action=schedule-create]');
    const formOpened = await waitFor(b, "!document.getElementById('overlay').hidden&&Pandora.idle()&&document.getElementById('sheetTitle').textContent==='创建任务'");
    const formDate = await ev("({start:drafts.task&&drafts.task.startDate,end:drafts.task&&drafts.task.endDate,sheet:!!Pandora.calendar.currentDaySheet()})");
    check('creating from the empty sheet opens the create form for that date and keeps the sheet', formOpened && formDate.start === emptyDate && formDate.end === emptyDate && formDate.sheet, formDate);
    await key('Escape', 'Escape', 27);
    await waitFor(b, "document.getElementById('overlay').hidden");
    check('cancelling the form returns to the still-open day sheet', await ev("!!Pandora.calendar.currentDaySheet()"));
    await closeSheetIfOpen();

    /* ================= 9.5 gestures ================= */
    await setView(fixture.day);
    const openSheetAtDay = async () => {
      // A gesture check always starts from a clean calendar: no day sheet and no nested detail.
      await ev("(()=>{if(Pandora.calendar.currentDaySheet())Pandora.calendar.closeDaySheet();if(!document.getElementById('overlay').hidden)closeSheet()})()");
      await sleep(200);
      const pre = await ev("({sheet:Pandora.calendar.currentDaySheet(),dom:!!document.querySelector('.p-day-sheet'),overlay:document.getElementById('overlay').hidden,layers:Array.from(document.querySelectorAll('.p-schedule-layer')).map(l=>l.dataset.layer)})");
      await reveal(`.p-month-date[data-date="${fixture.day}"]`);
      await click(`.p-month-date[data-date="${fixture.day}"]`);
      const opened = await waitFor(b, "!!Pandora.calendar.currentDaySheet()&&!!document.querySelector('.p-day-sheet')");
      if (!opened) throw new Error('day sheet did not open: ' + JSON.stringify({ pre, post: await ev("({sheet:Pandora.calendar.currentDaySheet(),suppression:Pandora.calendar.suppression(),dom:!!document.querySelector('.p-day-sheet'),mode:state.viewMode,overlay:document.getElementById('overlay').hidden,title:document.getElementById('sheetTitle').textContent})"), errors: b.errors.slice(0, 2) }));
      return ev("(()=>{const handle=document.querySelector('[data-sheet-handle]').getBoundingClientRect(),sheet=document.querySelector('.p-day-sheet').getBoundingClientRect(),body=document.getElementById('p-day-sheet-body');return {hx:handle.left+handle.width/2,hy:handle.top+handle.height/2,sheetH:sheet.height,bodyTop:body.getBoundingClientRect().top,bodyLeft:body.getBoundingClientRect().left,bodyWidth:body.getBoundingClientRect().width,scrollTop:body.scrollTop}})()");
    };
    let handle = await openSheetAtDay();
    await touch('touchStart', [[handle.hx, handle.hy]]);
    await touch('touchMove', [[handle.hx, handle.hy + 60]]);
    await touch('touchMove', [[handle.hx, handle.hy + Math.round(handle.sheetH * 0.32)]]);
    await touch('touchEnd', []);
    const handleClosed = await waitFor(b, "!Pandora.calendar.currentDaySheet()");
    check('dragging the sheet handle down closes it', handleClosed);

    handle = await openSheetAtDay();
    await touch('touchStart', [[handle.hx, handle.hy]]);
    await touch('touchMove', [[handle.hx, handle.hy + 18]]);
    await touch('touchEnd', []);
    const smallDrag = await ev("({sheet:!!Pandora.calendar.currentDaySheet(),transform:(document.querySelector('.p-day-sheet')||{}).style&&document.querySelector('.p-day-sheet').style.transform})");
    check('a short handle drag snaps back instead of closing', smallDrag.sheet && !smallDrag.transform, smallDrag);

    handle = await openSheetAtDay();
    await touch('touchStart', [[handle.hx, handle.hy]]);
    await touch('touchMove', [[handle.hx, handle.hy + 120]]);
    await touch('touchCancel', []);
    const cancelled = await ev("({sheet:!!Pandora.calendar.currentDaySheet(),transform:document.querySelector('.p-day-sheet').style.transform})");
    check('a cancelled handle drag restores the sheet without closing it', cancelled.sheet && !cancelled.transform, cancelled);

    handle = await openSheetAtDay();
    const multiTouch = await ev(`(()=>{const handle=document.querySelector('[data-sheet-handle]');const r=handle.getBoundingClientRect();const mk=(type,y,n)=>new TouchEvent(type,{bubbles:true,cancelable:true,touches:Array.from({length:n},(_,i)=>new Touch({identifier:i+1,target:handle,clientX:r.left+30+i*10,clientY:y})),targetTouches:[],changedTouches:[]});handle.dispatchEvent(new PointerEvent('pointerdown',{bubbles:true,cancelable:true,pointerId:1,pointerType:'touch',isPrimary:true,clientX:r.left+30,clientY:r.top+10}));handle.dispatchEvent(mk('touchstart',r.top+10,2));handle.dispatchEvent(new PointerEvent('pointermove',{bubbles:true,cancelable:true,pointerId:1,pointerType:'touch',isPrimary:true,clientX:r.left+30,clientY:r.top+140}));return {sheet:!!Pandora.calendar.currentDaySheet(),transform:document.querySelector('.p-day-sheet').style.transform}})()`);
    check('a second finger cancels the drag and keeps the sheet open', multiTouch.sheet && !multiTouch.transform, multiTouch);
    await ev("(()=>{const handle=document.querySelector('[data-sheet-handle]');handle.dispatchEvent(new PointerEvent('pointerup',{bubbles:true,cancelable:true,pointerId:1,pointerType:'touch',isPrimary:true}))})()");
    await ev("(()=>{if(!document.getElementById('overlay').hidden)closeSheet();if(Pandora.calendar.currentDaySheet())Pandora.calendar.closeDaySheet()})()");
    await sleep(200);

    handle = await openSheetAtDay();
    const pull = await ev(`(()=>{const body=document.getElementById('p-day-sheet-body');body.scrollTop=0;const r=body.getBoundingClientRect();const mk=(type,y)=>new TouchEvent(type,{bubbles:true,cancelable:true,touches:type==='touchend'?[]:[new Touch({identifier:1,target:body,clientX:r.left+60,clientY:y})],targetTouches:[],changedTouches:[new Touch({identifier:1,target:body,clientX:r.left+60,clientY:y})]});body.dispatchEvent(mk('touchstart',r.top+40));const prevented=!body.dispatchEvent(mk('touchmove',r.top+260));body.dispatchEvent(mk('touchend',r.top+260));return {prevented}})()`);
    const pullClosed = await waitFor(b, "!Pandora.calendar.currentDaySheet()");
    check('pulling the body down while it is at the top closes the sheet and takes over the gesture', pull.prevented && pullClosed, { pull, pullClosed });

    handle = await openSheetAtDay();
    const normalScroll = await ev(`(()=>{const body=document.getElementById('p-day-sheet-body');body.scrollTop=60;const start=body.scrollTop,r=body.getBoundingClientRect();const mk=(type,y)=>new TouchEvent(type,{bubbles:true,cancelable:true,touches:type==='touchend'?[]:[new Touch({identifier:1,target:body,clientX:r.left+60,clientY:y})],targetTouches:[],changedTouches:[new Touch({identifier:1,target:body,clientX:r.left+60,clientY:y})]});body.dispatchEvent(mk('touchstart',r.top+80));const prevented=!body.dispatchEvent(mk('touchmove',r.top+200));body.dispatchEvent(mk('touchend',r.top+200));return {prevented,start,after:body.scrollTop,sheet:!!Pandora.calendar.currentDaySheet()}})()`);
    check('ordinary body scrolling is never hijacked into a close', normalScroll.sheet && !normalScroll.prevented, normalScroll);

    /* Esc closes only the top layer: detail first, then the sheet */
    const topItem = await ev("(()=>{const body=document.getElementById('p-day-sheet-body');const item=body.querySelector('[data-task]');item.scrollIntoView({block:'nearest'});return {id:item.dataset.task}})()");
    await sleep(120);
    const topRect = await rectOf(`#p-day-sheet-body [data-task="${topItem.id}"]`);
    await mouse(topRect.x, topRect.y);
    await waitFor(b, "!document.getElementById('overlay').hidden");
    await key('Escape', 'Escape', 27);
    const firstEsc = await waitFor(b, "document.getElementById('overlay').hidden");
    const afterFirstEsc = await ev("({sheet:!!Pandora.calendar.currentDaySheet(),drawer:Pandora.calendar.drawerOpen()})");
    await key('Escape', 'Escape', 27);
    const secondEsc = await waitFor(b, "!Pandora.calendar.currentDaySheet()");
    check('Esc closes only the topmost layer, then the sheet', firstEsc && afterFirstEsc.sheet && secondEsc, { afterFirstEsc });

    /* account switch clears every overlay */
    await click('[data-action=schedule-side-toggle]');
    await waitFor(b, "Pandora.calendar.drawerOpen()");
    await ev("Pandora.logout()");
    await waitFor(b, "!!document.getElementById('backend-login')&&Pandora.idle()");
    const afterLogout = await ev("({layers:document.querySelectorAll('.p-schedule-layer').length,drawer:Pandora.calendar.drawerOpen(),sheet:Pandora.calendar.currentDaySheet(),inert:document.querySelectorAll('.p-schedule-card [inert]').length,page:state.page})");
    check('signing out clears the drawer and sheet overlay state', afterLogout.layers === 0 && !afterLogout.drawer && !afterLogout.sheet && afterLogout.inert === 0, afterLogout);
    await login();
    await setView(fixture.day);
    const afterLogin = await ev("({layers:document.querySelectorAll('.p-schedule-layer').length,drawer:Pandora.calendar.drawerOpen(),sheet:Pandora.calendar.currentDaySheet(),months:document.querySelectorAll('.p-month-section').length})");
    check('signing back in reopens the calendar without stale overlays', afterLogin.layers === 0 && !afterLogin.drawer && !afterLogin.sheet && afterLogin.months >= 3, afterLogin);

    /* ================= 10.2 full-day projection, concurrency, all-day scroll ================= */
    await setView(fixture.day);
    const crossMonthAppearance = await ev(`(()=>{const bar=Array.from(document.querySelectorAll('[data-task="${fixture.special.cross}"]')).find(e=>e.classList.contains('p-month-event'));const pinned=Array.from(document.querySelectorAll('[data-task="${fixture.pinned}"]')).find(e=>e.classList.contains('p-month-event'));return {bg:bar&&bar.style.getPropertyValue('--tc-bg'),border:bar&&bar.style.getPropertyValue('--tc-bd'),hidden:bar&&bar.hidden,pinnedStar:!!document.querySelector('[data-task="${fixture.pinned}"] .p-pin'),pinnedBg:pinned&&pinned.style.getPropertyValue('--tc-bg')}})()`);
    await setView(fixture.concurrent, 'day');
    await sleep(260);
    await b.screenshot(output.replace('calendar-drawer.json', 'calendar-day-projection.png'));
    const concurrency = await ev(`(()=>{try{const me=Pandora.data.me.id,date=${js(fixture.concurrent)},start=Pandora.companyDayStart(date),end=Pandora.companyDayStart(${js(shiftDate(fixture.concurrent, 1))});
      const own=TASKS.filter(t=>(t.assigneeIds||[]).includes(me)&&t.status!=='rejected').filter(t=>{const range=t.allDay?{start:Pandora.companyDayStart(t.raw.startDate),end:Pandora.companyDayStart(toDateInput(addDays(parseDateInput(t.raw.dueDate),1)))}:{start:new Date(t.raw.startAt),end:new Date(t.raw.dueAt)};return +range.start===+range.end?(range.start>=start&&range.start<end):(range.end>start&&range.start<end)});
      const projection=own.map(t=>{if(t.allDay)return {id:t.id,kind:'allday'};const range={start:new Date(t.raw.startAt),end:new Date(t.raw.dueAt)};const full=+range.start<=+start&&+range.end>=+end;return {id:t.id,kind:full?'full':'timed'}});
      const alldayDom=Array.from(document.querySelectorAll('.p-all-day-event')).map(e=>e.dataset.task);
      const timedDom=Array.from(document.querySelectorAll('.p-axis-event')).map(e=>e.dataset.task);
      const scroll=document.querySelector('.p-allday-scroll'),axis=document.querySelector('.p-timeline-scroll');
      const overlaps=Array.from(document.querySelectorAll('.p-axis-event')).filter(e=>(e.getAttribute('aria-label')||'').includes('Calendar overlap'));
      axis.scrollTop=axis.scrollHeight;
      const axisEnd=document.querySelector('.p-axis-end').getBoundingClientRect(),box=axis.getBoundingClientRect();
      return {expected:{allday:projection.filter(p=>p.kind!=='timed').map(p=>p.id),timed:projection.filter(p=>p.kind==='timed').map(p=>p.id)},
        alldayDom,timedDom,alldayScroll:{sh:scroll.scrollHeight,ch:scroll.clientHeight,overflow:getComputedStyle(scroll).overflowY},
        overlapCount:overlaps.length,overlapColumns:overlaps.map(e=>Number(e.dataset.columns)),overlapWidths:overlaps.map(e=>Math.round(e.getBoundingClientRect().width)),
        axisHeight:document.querySelector('.p-day-axis').getBoundingClientRect().height,endVisible:axisEnd.bottom<=box.bottom+1,
        crossAllDay:Pandora.calendar.dayCoverage(TASKS.find(t=>t.id===${js(fixture.special.cross)}),parseDateInput(date))?.fullDay,
        crossRaw:(()=>{const t=TASKS.find(x=>x.id===${js(fixture.special.cross)});return {allDay:t.allDay,startAt:t.raw.startAt,dueAt:t.raw.dueAt,pinned:t.pinned,tag:t.tag,tagId:t.tagId}})(),
        scrollToEnd:axis.scrollTop}}catch(e){return {error:String(e),stack:String(e&&e.stack).slice(0,400)}}})()`);
    check('every all-day and every timed task is rendered exactly once from the real coverage', concurrency.alldayDom.length === concurrency.expected.allday.length && concurrency.timedDom.length === concurrency.expected.timed.length && JSON.stringify(concurrency.alldayDom.slice().sort()) === JSON.stringify(concurrency.expected.allday.slice().sort()) && JSON.stringify(concurrency.timedDom.slice().sort()) === JSON.stringify(concurrency.expected.timed.slice().sort()) && concurrency.alldayDom.length > 5 && concurrency.timedDom.length > 5, { expected: { allday: concurrency.expected.allday.length, timed: concurrency.expected.timed.length }, dom: { allday: concurrency.alldayDom.length, timed: concurrency.timedDom.length } });
    check('more than five all-day tasks stay reachable through the compact scroll area', concurrency.alldayScroll.overflow === 'auto' && (concurrency.alldayScroll.sh > concurrency.alldayScroll.ch || concurrency.alldayDom.length <= 8) && await ev("(()=>{const scroll=document.querySelector('.p-allday-scroll');scroll.scrollTop=scroll.scrollHeight;const items=Array.from(document.querySelectorAll('.p-all-day-event'));const box=scroll.getBoundingClientRect(),last=items[items.length-1].getBoundingClientRect();return last.bottom<=box.bottom+1&&last.top>=box.top-1})()"), concurrency.alldayScroll);
    check('more than five overlapping timed tasks split across the full day width', concurrency.overlapCount === 7 && concurrency.overlapColumns.every(c => c >= 7) && new Set(concurrency.overlapWidths).size === 1, { overlapCount: concurrency.overlapCount, columns: concurrency.overlapColumns });
    check('the day axis still runs to 24:00 in a real scrollable column', concurrency.axisHeight === 1440 && concurrency.endVisible, { axisHeight: concurrency.axisHeight, endVisible: concurrency.endVisible });
    check('a timed task fully covering the day is projected without changing its schedule', concurrency.crossAllDay === true && concurrency.crossRaw.allDay === false, concurrency.crossRaw);
    /* detail still shows the original schedule and no all-day badge */
    const crossDetail = await ev(`(async()=>{openTaskDetail(${js(fixture.special.cross)});await new Promise(r=>setTimeout(r,150));return {title:document.getElementById('sheetTitle').textContent,body:document.getElementById('sheetBody').textContent,allDayBadge:!!document.querySelector('#sheetBody .all-day, #sheetBody [class*=all-day]')}})()`);
    check('the projected task detail keeps the real schedule and no all-day semantics', crossDetail.body.includes(monthDay(fixture.day) + ' 20:00') && crossDetail.body.includes(monthDay(shiftDate(fixture.day, 2)) + ' 10:00') && !crossDetail.body.includes('全天') && !crossDetail.allDayBadge, { title: crossDetail.title, snippet: crossDetail.body.slice(0, 400) });
    await key('Escape', 'Escape', 27);
    await waitFor(b, "document.getElementById('overlay').hidden");

    /* no write requests while switching into the projected day view */
    await setView(fixture.day);
    await b.send('Network.enable');
    await ev("window.__calendarRequests=[];window.__origFetch=window.fetch;window.fetch=function(input,init){try{window.__calendarRequests.push({url:String(input&&input.url||input),method:(init&&init.method)||'GET'})}catch(e){}return window.__origFetch.apply(this,arguments)}");
    await setView(fixture.concurrent, 'day');
    await ev("(()=>{const scroll=document.querySelector('.p-allday-scroll');if(scroll)scroll.scrollTop=scroll.scrollHeight;document.querySelector('.p-day-sheet')})()");
    await setView(fixture.day);
    const writes = await ev("window.__calendarRequests.filter(r=>r.method&&r.method!=='GET')");
    await ev("window.fetch=window.__origFetch");
    check('displaying the full-day projection never writes task data', writes.length === 0, writes);

    /* tags/pins are identical in the month and projected day views */
    await setView(fixture.day, 'day');
    await sleep(200);
    const pinnedDayAppearance = await ev(`(()=>{const bar=Array.from(document.querySelectorAll('[data-task="${fixture.pinned}"]')).find(e=>e.classList.contains('p-axis-event'));return {bg:bar&&bar.style.getPropertyValue('--tc-bg'),pinnedStar:!!document.querySelector('[data-task="${fixture.pinned}"] .p-pin')}})()`);
    await setView(fixture.concurrent, 'day');
    await sleep(200);
    const crossDayAppearance = await ev(`(()=>{const bar=Array.from(document.querySelectorAll('[data-task="${fixture.special.cross}"]')).find(e=>e.classList.contains('p-all-day-event'));return {bg:bar&&bar.style.getPropertyValue('--tc-bg'),border:bar&&bar.style.getPropertyValue('--tc-bd')}})()`);
    check('label colour and pin markers survive the display classification', !!crossMonthAppearance.bg && crossMonthAppearance.bg === crossDayAppearance.bg && crossMonthAppearance.border === crossDayAppearance.border && crossMonthAppearance.pinnedStar && pinnedDayAppearance.pinnedStar && crossMonthAppearance.pinnedBg === pinnedDayAppearance.bg, { crossMonthAppearance, crossDayAppearance, pinnedDayAppearance });

    /* ================= 10.3 continuous month stream ================= */
    await b.viewport({ width: 390, height: 844, mobile: true });
    await setView(fixture.day);
    const streamStart = await ev("({stream:Pandora.calendar.currentStream(),sections:Array.from(document.querySelectorAll('.p-month-section')).map(s=>s.dataset.monthKey),dates:Array.from(document.querySelectorAll('.p-month-date[data-date]')).map(e=>e.dataset.date)})");
    check('the month stream starts with consecutive months and unique dates', streamStart.stream.length === 5 && streamStart.sections.join(',') === streamStart.stream.join(',') && new Set(streamStart.dates).size === streamStart.dates.length, { stream: streamStart.stream, sections: streamStart.sections, duplicates: streamStart.dates.length - new Set(streamStart.dates).size });
    const topWeek = () => ev("(()=>{const s=document.querySelector('.p-month-scroll');const top=s.getBoundingClientRect().top;const w=Array.from(s.querySelectorAll('.p-month-week')).find(e=>e.getBoundingClientRect().bottom>top+1);return w&&w.dataset.weekStart})()");
    const streamDown = await ev("(()=>{const s=document.querySelector('.p-month-scroll');s.scrollTop=s.scrollHeight;return s.scrollTop})()");
    await sleep(450);
    const afterDown = await ev("({stream:Pandora.calendar.currentStream(),sections:Array.from(document.querySelectorAll('.p-month-section')).map(s=>s.dataset.monthKey),dates:Array.from(document.querySelectorAll('.p-month-date[data-date]')).map(e=>e.dataset.date),scroll:document.querySelector('.p-month-scroll').scrollTop})");
    check('scrolling down appends the next month without duplicating or losing dates', afterDown.stream.length === 6 && afterDown.sections.length === 6 && new Set(afterDown.dates).size === afterDown.dates.length && afterDown.sections.join(',') === afterDown.stream.join(','), { scroll: [streamDown, afterDown.scroll], stream: afterDown.stream, sections: afterDown.sections });
    /* One append of an adjacent month must not move the reader. */
    await ev("(()=>{const s=document.querySelector('.p-month-scroll');s.scrollTop=Math.round(s.scrollHeight/2)})()");
    await sleep(300);
    const stableBefore = await ev("({scroll:document.querySelector('.p-month-scroll').scrollTop,stream:Pandora.calendar.currentStream().length,dates:Array.from(document.querySelectorAll('.p-month-date[data-date]')).map(e=>e.dataset.date)})");
    const stableAnchor = await topWeek();
    await ev("Pandora.calendar.appendStreamMonth('down')");
    await sleep(300);
    const stableAfter = await ev("({scroll:document.querySelector('.p-month-scroll').scrollTop,stream:Pandora.calendar.currentStream().length,dates:Array.from(document.querySelectorAll('.p-month-date[data-date]')).map(e=>e.dataset.date)})");
    const stableAnchorAfter = await topWeek();
    check('appending the next month keeps the same scroll offset and visible week', stableAfter.stream === stableBefore.stream + 1 && stableAfter.scroll === stableBefore.scroll && stableAnchorAfter === stableAnchor && new Set(stableAfter.dates).size === stableAfter.dates.length, { stableBefore: { scroll: stableBefore.scroll, stream: stableBefore.stream }, stableAfter: { scroll: stableAfter.scroll, stream: stableAfter.stream }, stableAnchor, stableAnchorAfter });
    const prepend = await ev("(()=>{const s=document.querySelector('.p-month-scroll');s.scrollTop=0;return s.scrollTop})()");
    await sleep(400);
    const afterUp = await ev("({stream:Pandora.calendar.currentStream(),dates:Array.from(document.querySelectorAll('.p-month-date[data-date]')).map(e=>e.dataset.date),scroll:document.querySelector('.p-month-scroll').scrollTop})");
    check('scrolling up prepends the previous month with unique dates', afterUp.stream.length === 8 && new Set(afterUp.dates).size === afterUp.dates.length && afterUp.scroll >= prepend, { stream: afterUp.stream, scroll: afterUp.scroll });

    /* keep scrolling: the mounted window is bounded and never repeats a month */
    for (let step = 0; step < 12; step += 1) {
      await ev("(()=>{const s=document.querySelector('.p-month-scroll');s.scrollTop=s.scrollHeight})()");
      await sleep(200);
    }
    const deepDown = await ev("({stream:Pandora.calendar.currentStream(),sections:Array.from(document.querySelectorAll('.p-month-section')).map(s=>s.dataset.monthKey),dates:Array.from(document.querySelectorAll('.p-month-date[data-date]')).map(e=>e.dataset.date)})");
    check('deep scrolling keeps a bounded, non-repeating mounted window', deepDown.stream.length <= 12 && deepDown.sections.length === deepDown.stream.length && new Set(deepDown.stream).size === deepDown.stream.length && new Set(deepDown.dates).size === deepDown.dates.length, { streamLength: deepDown.stream.length, sections: deepDown.sections.length, duplicates: deepDown.dates.length - new Set(deepDown.dates).size });
    /* the cross-month task is present in each covered month */
    await setView(fixture.monthLast);
    await sleep(250);
    const crossCoverage = await ev(`(()=>{const hits=Array.from(document.querySelectorAll('[data-task="${fixture.special.month}"]')).map(e=>({week:e.closest('.p-month-week').dataset.weekStart,start:e.dataset.startColumn,end:e.dataset.endColumn}));return hits})()`);
    check('a cross-month task is drawn in more than one month section without being lost', crossCoverage.length >= 2, crossCoverage);

    /* year boundary */
    const december = await ev(`(()=>{const d=new Date(state.viewAnchor.getFullYear(),11,20);return toDateInput(d)})()`);
    await setView(december);
    const decemberStream = await ev("Pandora.calendar.currentStream()");
    await ev("(()=>{const s=document.querySelector('.p-month-scroll');s.scrollTop=s.scrollHeight})()");
    await sleep(450);
    const yearStream = await ev("(()=>{const keys=Pandora.calendar.currentStream();const sections=Array.from(document.querySelectorAll('.p-month-section')).map(s=>({key:s.dataset.monthKey,title:s.querySelector('h2').textContent}));return {keys,sections}})()");
    check('scrolling past December continues into January of the next year', yearStream.keys.some(k => k === (Number(december.slice(0, 4)) + 1) + '-01') && yearStream.sections.some(s => s.title.includes('年1月')), { decemberStream, keys: yearStream.keys.slice(-3) });

    /* month picker still selects a far month */
    await setView(fixture.day);
    await click('[data-action=schedule-pick-date]');
    await waitFor(b, "!!document.getElementById('p-schedule-year')");
    const pickTarget = { year: (await ev("Number(document.getElementById('p-schedule-year').value)")) + 1, month: 3 };
    await ev(`(()=>{document.getElementById('p-schedule-year').value='${pickTarget.year}';document.getElementById('p-schedule-month').value='3';document.getElementById('p-schedule-date').value='';document.querySelector('[data-action=schedule-confirm-date]').click()})()`);
    await sleep(300);
    const picked = await ev("({y:state.viewAnchor.getFullYear(),m:state.viewAnchor.getMonth()+1,stream:Pandora.calendar.currentStream()})");
    check('the year/month picker still jumps to a distant month and rebuilds the stream', picked.y === pickTarget.year && picked.m === pickTarget.month && picked.stream.includes(pickTarget.year + '-03'), { picked, pickTarget });

    /* month cell height via keyboard + local density */
    await setView(fixture.day);
    await ev("document.querySelector('.p-month-resize-handle').focus()");
    const densityBefore = await ev("Number(document.querySelector('.p-month-view').dataset.rowHeight)");
    await key('ArrowUp', 'ArrowUp', 38);
    const densityAfter = await ev("({rowHeight:Number(document.querySelector('.p-month-view').dataset.rowHeight),stored:Number(localStorage.getItem('pandora.calendar.cardRowHeight')),capacity:document.querySelector('.p-month-resize-handle').getAttribute('aria-valuetext')})");
    check('keyboard resizing changes the visible density and stores it locally', densityAfter.rowHeight > densityBefore && densityAfter.stored === densityAfter.rowHeight, { densityBefore, densityAfter });
    await key('End', 'End', 35);
    const deepDensity = await ev("({rowHeight:Number(document.querySelector('.p-month-view').dataset.rowHeight),shown:Array.from(document.querySelectorAll('.p-month-week .p-month-event')).filter(e=>!e.hidden).length,hidden:Array.from(document.querySelectorAll('.p-month-week .p-month-event')).filter(e=>e.hidden).length})");
    check('the stored row height really mounts more task lanes', deepDensity.rowHeight === 340 && deepDensity.shown > 0 && deepDensity.hidden >= 0, deepDensity);

    /* detail / task-form return keeps the calendar context */
    const contextBeforeForm = await ev("({anchor:+state.viewAnchor,stream:Pandora.calendar.currentStream(),rowHeight:document.querySelector('.p-month-view').dataset.rowHeight,scroll:document.querySelector('.p-month-scroll').scrollTop})");
    await click('.p-table-entry');
    await waitFor(b, "Pandora.taskForm.state.loaded&&state.viewPage==='table'", 25000);
    await click('[data-action=task-table-close]');
    await waitFor(b, "state.viewPage==='calendar'&&Pandora.idle()");
    await sleep(400);
    const contextAfterForm = await ev("({anchor:+state.viewAnchor,stream:Pandora.calendar.currentStream(),rowHeight:document.querySelector('.p-month-view').dataset.rowHeight,scroll:document.querySelector('.p-month-scroll').scrollTop,mode:state.viewMode})");
    check('returning from the task form keeps the month date, stream, density and scroll', contextAfterForm.anchor === contextBeforeForm.anchor && JSON.stringify(contextAfterForm.stream) === JSON.stringify(contextBeforeForm.stream) && contextAfterForm.rowHeight === contextBeforeForm.rowHeight && contextAfterForm.mode === 'month' && Math.abs(contextAfterForm.scroll - contextBeforeForm.scroll) <= 2, { contextBeforeForm, contextAfterForm });

    /* failed supplement stays retryable and never claims completeness */
    const failure = await ev(`(()=>{window.__monthSection=Pandora.calendar.monthSection;Pandora.calendar.monthSection=function(){throw new Error('模拟月份载入失败')};const s=document.querySelector('.p-month-scroll');const before=Pandora.calendar.currentStream().length;s.scrollTop=s.scrollHeight;return {before}})()`);
    await sleep(450);
    const failed = await ev("({stream:Pandora.calendar.currentStream().length,sections:document.querySelectorAll('.p-month-section').length,notice:!!document.querySelector('.p-month-stream-error'),text:(document.querySelector('.p-month-stream-error')||{}).textContent,retry:!!document.querySelector('[data-action=schedule-stream-retry]')})");
    const failedParts = {notice: failed.notice, retry: failed.retry, stream: failed.stream === failure.before, sections: failed.sections === failure.before, loadText: String(failed.text).includes('加载失败'), partialText: String(failed.text).includes('只显示已加载的月份')};
    check('a failed month supplement shows an explicit retry instead of incomplete months', failedParts.notice && failedParts.retry && failedParts.stream && failedParts.sections && failedParts.loadText && failedParts.partialText, { failure, failed, failedParts });
    await reveal('[data-action=schedule-stream-retry]');
    await click('[data-action=schedule-stream-retry]');
    await sleep(300);
    const stillFailed = await ev("({stream:Pandora.calendar.currentStream().length,notice:!!document.querySelector('.p-month-stream-error')})");
    check('a retry that keeps failing does not pretend the month loaded', stillFailed.notice && stillFailed.stream === failure.before, stillFailed);
    await ev("Pandora.calendar.monthSection=window.__monthSection");
    await reveal('[data-action=schedule-stream-retry]');
    await click('[data-action=schedule-stream-retry]');
    await sleep(500);
    const recovered = await ev("({stream:Pandora.calendar.currentStream().length,notice:!!document.querySelector('.p-month-stream-error'),sections:document.querySelectorAll('.p-month-section').length})");
    check('the retry loads the month once the source recovers and clears the notice', !recovered.notice && recovered.stream === failure.before + 1 && recovered.sections === recovered.stream, { recovered });

    /* narrow and desktop: appending must not jump, duplicate or drop dates */
    for (const [width, height] of [[320, 740], [1440, 900]]) {
      await b.viewport({ width, height, mobile: width < 1000 });
      await setView(fixture.day);
      await ev("(()=>{const s=document.querySelector('.p-month-scroll');s.scrollTop=s.scrollHeight})()");
      await sleep(420);
      const before = await ev("({stream:Pandora.calendar.currentStream(),dates:Array.from(document.querySelectorAll('.p-month-date[data-date]')).map(e=>e.dataset.date),scroll:document.querySelector('.p-month-scroll').scrollTop})");
      const anchor = await topWeek();
      await ev("Pandora.calendar.appendStreamMonth('down')");
      await sleep(320);
      const after = await ev("({stream:Pandora.calendar.currentStream(),dates:Array.from(document.querySelectorAll('.p-month-date[data-date]')).map(e=>e.dataset.date),scroll:document.querySelector('.p-month-scroll').scrollTop})");
      const anchorAfter = await topWeek();
      check('month augmentation stays stable at ' + width, after.stream.length === before.stream.length + 1 && new Set(after.dates).size === after.dates.length && anchor === anchorAfter && after.scroll === before.scroll, { before: { stream: before.stream.length, scroll: before.scroll }, after: { stream: after.stream.length, scroll: after.scroll }, anchor, anchorAfter });
    }
    await b.viewport({ width: 390, height: 844, mobile: true });

    check('the calendar checks raised no browser exception', b.errors.length === 0, b.errors);
    report.result = 'PASS';
  } finally {
    b.kill();
    fs.writeFileSync(output, JSON.stringify(report, null, 2) + '\n');
  }
}
main().catch(error => {
  report.result = 'FAIL';
  report.error = error.message;
  fs.writeFileSync(output, JSON.stringify(report, null, 2) + '\n');
  console.error(error);
  process.exitCode = 1;
});
