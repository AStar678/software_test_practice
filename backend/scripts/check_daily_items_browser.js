#!/usr/bin/env node
'use strict';
/* Real-browser acceptance for the three-section home page and the vertical daily-item calendar. */
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

    await require('./check_daily_items_refresh_browser')(b, fixture, check, evidence);
    let sessionRestored = await waitFor(b, `Pandora.ready&&Pandora.idle()&&Pandora.data.me&&Pandora.data.me.id===${js(ids['alpha-one-employee'].id)}`, 30000);
    if (!sessionRestored && await ev("!!document.getElementById('backend-login')")) {
      await ev(`document.getElementById('login-user').value=${js(ids['alpha-one-employee'].identifier)};document.getElementById('login-password').value='Fixture@123456';document.getElementById('backend-login').requestSubmit()`);
      sessionRestored = await waitFor(b, `Pandora.ready&&Pandora.idle()&&Pandora.data.me&&Pandora.data.me.id===${js(ids['alpha-one-employee'].id)}`, 30000);
    }
    check('the reloaded session is still the same real employee', sessionRestored);

    /* -------- vertical calendar structure: weekday row, seven columns, stacked months -------- */
    const structure = await ev(`(()=>{const scroller=document.getElementById('dailyScroller');
      const weekdays=Array.from(document.querySelectorAll('.daily-weekdays span')).map(e=>e.textContent);
      const blocks=Array.from(document.querySelectorAll('.daily-month'));
      const problems=[];
      blocks.forEach(block=>{const cells=Array.from(block.querySelectorAll('[data-daily-date]'));
        const dates=cells.map(c=>c.dataset.dailyDate);
        const [y,m]=block.dataset.month.split('-').map(Number);
        const lastDay=new Date(Date.UTC(y,m,0)).getUTCDate();
        const weeks=block.querySelectorAll('.daily-week').length;
        const gaps=block.querySelectorAll('.daily-gap').length;
        const own=dates.every(d=>d.startsWith(block.dataset.month));
        const consecutive=dates.every((d,i)=>!i||new Date(d+'T00:00:00Z')-new Date(dates[i-1]+'T00:00:00Z')===86400000);
        const unique=new Set(dates).size===dates.length;
        const rowsOk=Array.from(block.querySelectorAll('.daily-week')).every(w=>w.querySelector('.daily-days').children.length===7);
        if(!own||!consecutive||!unique||dates.length!==lastDay||dates[0]!==block.dataset.month+'-01'||
          dates[dates.length-1]!==block.dataset.month+'-'+String(lastDay).padStart(2,'0')||
          weeks<4||weeks>6||gaps!==weeks*7-lastDay||!rowsOk) problems.push({key:block.dataset.month,dates:dates.length,lastDay,weeks,gaps,own,consecutive,unique,rowsOk});
      });
      const all=Array.from(document.querySelectorAll('[data-daily-date]')).map(c=>c.dataset.dailyDate);
      const uniqueAll=new Set(all).size===all.length;
      const stacked=blocks.every((el,i)=>!i||el.getBoundingClientRect().top>=blocks[i-1].getBoundingClientRect().bottom-1);
      const today=document.querySelector('[data-daily-date="${fixture.today}"]');
      const todayBox=today?today.getBoundingClientRect():null, scrollerBox=scroller.getBoundingClientRect();
      const labels=Array.from(document.querySelectorAll('.daily-month-label')).map(e=>e.textContent);
      const labelOverflow=Array.from(document.querySelectorAll('.daily-month-label')).some(e=>e.scrollWidth>e.clientWidth+1);
      return {weekdayCount:weekdays.length,weekdays,cells:all.length,blocks:blocks.length,problems,uniqueAll,stacked,
        overflowY:getComputedStyle(scroller).overflowY,scrollHeight:scroller.scrollHeight,clientHeight:scroller.clientHeight,
        todayVisible:!!todayBox&&todayBox.top>=scrollerBox.top-1&&todayBox.bottom<=scrollerBox.bottom+1,
        labels,labelOverflow,lunar:document.body.textContent.includes('农历'),fab:!!document.querySelector('.daily-fab')}})()`);
    check('the daily calendar is a vertical Monday-to-Sunday week grid', structure.weekdayCount === 7 &&
      JSON.stringify(structure.weekdays) === JSON.stringify(['周一', '周二', '周三', '周四', '周五', '周六', '周日']) &&
      structure.overflowY === 'auto' && structure.scrollHeight > structure.clientHeight && !structure.lunar && !structure.fab, structure);
    check('every month block holds only its own consecutive real dates with seven interactive columns',
      structure.blocks >= 3 && !structure.problems.length && structure.uniqueAll && structure.stacked, structure);
    check('each stacked month heading shows its full year and month without overflow',
      structure.labels.length >= 3 && !structure.labelOverflow &&
      structure.labels.some(text => text === fixture.today.slice(0, 4) + '年' + Number(fixture.today.slice(5, 7)) + '月'), structure.labels);
    check('the company today is initially visible inside the vertical viewport', structure.todayVisible, structure);

    /* -------- ranged status bars instead of the retired count marker -------- */
    const bars = await ev(`(()=>{const all=Array.from(document.querySelectorAll('.daily-bar'));
      const today=document.querySelector('[data-daily-date="${fixture.today}"]');
      return {count:all.length,open:document.querySelectorAll('.daily-bar.is-open').length,
        completed:document.querySelectorAll('.daily-bar.is-completed').length,
        overdue:document.querySelectorAll('.daily-bar.is-overdue').length,
        names:[...document.querySelectorAll('.daily-bar .daily-bar-name')].map(e=>e.textContent).filter(Boolean).slice(0,8),
        todayAria:today?today.getAttribute('aria-label'):null}})()`);
    check('ranged bars are drawn with readable names and completed/open/overdue status',
      bars.count >= 3 && bars.open >= 1 && bars.completed >= 1 && bars.overdue >= 1 && bars.names.length >= 3, bars);
    check('date cells report complete open/completed/overdue counts to assistive technology',
      bars.todayAria && bars.todayAria.includes('未完成') && bars.todayAria.includes('已完成') && bars.todayAria.includes('逾期'), bars.todayAria);

    /* -------- vertical scrolling never opens a list; ordinary click does -------- */
    const before = await ev("document.getElementById('dailyScroller').scrollTop");
    await ev(`(()=>{const s=document.getElementById('dailyScroller');s.scrollTop=${before}+180;s.dispatchEvent(new Event('scroll'))})()`);
    await sleep(300);
    const afterScroll = await ev("({top:document.getElementById('dailyScroller').scrollTop,open:!document.getElementById('overlay').hidden})");
    check('ordinary vertical scrolling browses months without opening a day list', afterScroll.top > before && !afterScroll.open, { before, afterScroll });
    await ev("document.querySelector('[data-action=daily-today]').click()");
    await sleep(250);
    check('return to company today brings the real today cell back into view',
      await waitFor(b, `(()=>{const c=document.querySelector('[data-daily-date="${fixture.today}"]'),s=document.getElementById('dailyScroller'),r=c.getBoundingClientRect(),v=s.getBoundingClientRect();return r.top>=v.top-1&&r.bottom<=v.bottom+1})()`, 8000));

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
    const listState = await ev("({title:document.getElementById('sheetTitle').textContent,rows:document.querySelectorAll('#sheetBody .daily-row').length,foot:document.querySelectorAll('#sheetFoot button').length})");
    check('the day list shows that date, its real items and a create action', listState.title.includes('每日事项') && listState.rows >= 1 && listState.foot >= 1, listState);
    await b.screenshot(path.join(outputDir, 'daily-list-vertical.png'));
    await ev("document.getElementById('sheetClose').click()");
    await waitFor(b, "document.getElementById('overlay').hidden");

    /* -------- viewport fit at the four declared sizes -------- */
    for (const size of [{ width: 320, height: 740 }, { width: 390, height: 844 }, { width: 1440, height: 900 }, { width: 390, height: 600 }]) {
      await b.viewport({ ...size, mobile: size.width < 1000 });
      await sleep(250);
      const fit = await ev("({overflow:document.documentElement.scrollWidth>innerWidth+1,weekdays:document.querySelectorAll('.daily-weekdays span').length,scrollable:document.getElementById('dailyScroller').scrollHeight>document.getElementById('dailyScroller').clientHeight})");
      check(`the vertical calendar fits ${size.width}x${size.height} without horizontal overflow and remains scrollable`,
        !fit.overflow && fit.weekdays === 7 && fit.scrollable, fit);
      await b.screenshot(path.join(outputDir, 'daily-vertical-' + size.width + 'x' + size.height + '.png'));
    }
    await b.viewport({ width: 390, height: 844, mobile: true });
    await sleep(200);

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
      switched.account === switched.expected && switched.aria && switched.aria.includes('无事项'), switched);

    fs.writeFileSync(output, JSON.stringify(report, null, 2) + '\n');
    console.log('\n' + report.checks.length + ' browser checks passed');
  } finally {
    b.kill();
  }
}
main().catch(error => { console.error(error); process.exit(1); });
