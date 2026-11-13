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

    /* -------- 三态同一映射：待做蓝/完成灰/逾期红，且不再重复可见状态文字 -------- */
    const channels = value => String(value || '').replace(/[^0-9.,]/g, '').split(',').slice(0, 3).map(Number);
    const classifyEdge = value => {
      const [r, g, b] = channels(value);
      if (![r, g, b].every(Number.isFinite)) return 'unreadable';
      if (Math.abs(r - g) < 14 && Math.abs(g - b) < 14) return 'grey';
      if (r > g + 40 && r > b + 40) return 'red';
      if (b > r + 40 && b > g + 20) return 'blue';
      return 'other';
    };
    const palette = await ev(`(()=>{const read=selector=>{const node=document.querySelector(selector);if(!node)return null;
        const style=getComputedStyle(node);return {border:style.borderLeftColor,background:style.backgroundColor}};
      return {open:read('.daily-bar.is-open'),completed:read('.daily-bar.is-completed'),overdue:read('.daily-bar.is-overdue'),
        stale:document.querySelectorAll('.daily-bar.is-done,.daily-row.is-done').length,
        legend:document.querySelectorAll('.daily-status-legend').length}})()`);
    check('待做/完成/逾期三种事项条共用一套类名并分别呈现蓝、灰、红边线',
      !!palette.open && !!palette.completed && !!palette.overdue && palette.stale === 0 &&
      classifyEdge(palette.open.border) === 'blue' && classifyEdge(palette.completed.border) === 'grey' &&
      classifyEdge(palette.overdue.border) === 'red', palette);
    check('月份标题不再显示重复的状态颜色图例', palette.legend === 0, palette);

    async function openDay(key) {
      await ev(`PandoraDaily.openList(${js(key)}, document.querySelector('[data-daily-date="' + ${js(key)} + '"]'))`);
      await waitFor(b, "sheetStack.at(-1)?.dailyKind==='list'&&Pandora.idle()", 12000);
    }
    await openDay(fixture.today);
    const rows = await ev(`(()=>{const list=Array.from(document.querySelectorAll('[data-daily-row]'));
      return {states:list.map(row=>(row.className.match(/is-(open|completed|overdue)/)||[])[1]||null),
        metaStatusWords:list.map(row=>/未完成|已完成|已逾期/.test(row.querySelector('.daily-row-meta')?.textContent||'')),
        toggleLabels:list.map(row=>row.querySelector('[data-action=daily-toggle]')?.getAttribute('aria-label')||''),
        openLabels:list.map(row=>row.querySelector('[data-action=daily-open]')?.getAttribute('aria-label')||''),
        bodies:list.map(row=>row.querySelector('.daily-text span')?.textContent||'')}})()`);
    check('日期清单按同一映射标记三态且不重复可见状态文字',
      rows.states.length >= 2 && rows.states.every(state => ['open', 'completed', 'overdue'].includes(state)) &&
      rows.metaStatusWords.every(flag => flag === false), rows);
    check('清单正文不被改写且仍以辅助技术可读名称暴露真实状态',
      rows.bodies.some(body => body === '跨日已完成：正文里的同词不应被改写') &&
      rows.toggleLabels.every(label => /当前状态：(未完成|已完成|已逾期)/.test(label)) &&
      rows.openLabels.every(label => /(未完成|已完成|已逾期)/.test(label)), rows);

    await ev("closeSheet()");
    await waitFor(b, "document.getElementById('overlay').hidden", 12000);
    await openDay(fixture.mixed);
    const mixed = await ev(`(()=>{const list=Array.from(document.querySelectorAll('[data-daily-row]'));
      const completed=list.find(row=>row.classList.contains('is-completed'));
      return {total:list.length,completed:!!completed,
        text:completed?completed.querySelector('.daily-text span').textContent:null,
        strike:completed?getComputedStyle(completed.querySelector('.daily-text span')).textDecorationLine:null,
        meta:list.map(row=>row.querySelector('.daily-row-meta')?.textContent||'')}})()`);
    check('完成项在清单中呈现完成灰与删除线，日期仍完整可读',
      mixed.total >= 2 && mixed.completed && mixed.strike.includes('line-through') &&
      mixed.meta.every(text => /\d{4}年\d{1,2}月\d{1,2}日/.test(text) && !/未完成|已完成|已逾期/.test(text)), mixed);
    await ev("document.querySelector('#sheetBody [data-action=daily-open]').click()");
    await waitFor(b, "sheetStack.at(-1)?.dailyKind==='detail'&&Pandora.idle()", 12000);
    const detail = await ev(`(()=>{const head=document.querySelector('.daily-detail-head');
      return {classes:head?head.className:null,badges:document.querySelectorAll('.daily-detail-head .badge').length,
        hidden:document.querySelector('.daily-detail-head .sr-only')?.textContent||'',
        date:document.querySelector('.daily-detail-date')?.textContent||'',
        toggle:document.querySelector('#sheetFoot [data-action=daily-toggle]')?.textContent||''}})()`);
    check('详情不重复状态徽标，改用三态配色和隐藏文字表达状态',
      !!detail.classes && /\bis-(open|completed|overdue)\b/.test(detail.classes) && detail.badges === 0 &&
      /当前状态：(未完成|已完成|已逾期)/.test(detail.hidden) &&
      /\d{4}年\d{1,2}月\d{1,2}日/.test(detail.date) && detail.toggle.length > 0, detail);
    await ev("document.querySelector('[data-action=daily-edit]').click()");
    await waitFor(b, "sheetStack.at(-1)?.dailyKind==='form'&&Pandora.idle()", 12000);
    const form = await ev(`(()=>{const body=document.getElementById('sheetBody');
      return {text:body.innerText,start:!!document.getElementById('daily-start-date'),
        end:!!document.getElementById('daily-end-date'),field:!!document.getElementById('daily-body')}})()`);
    check('表单保留实际起止日期和正文，不再显示跨日解释',
      form.start && form.end && form.field && !form.text.includes('起止日均包含') && !form.text.includes('跨日仍是同一条事项'), form);
    await ev("document.getElementById('sheetClose').click()");
    await waitFor(b, "document.getElementById('overlay').hidden", 12000);

    /* 2.1 跨日事项：条跨越全部覆盖日，任一覆盖日完成/取消后清单与刷新保持一致。 */
    const rangedBars = () => ev(`(()=>{const bars=Array.from(document.querySelectorAll('.daily-bar[data-id="${fixture.ranged}"]'));return {count:bars.length,bars:bars.map(bar=>{const week=bar.closest('.daily-week'),start=Number(bar.dataset.startCol),end=Number(bar.dataset.endCol),weekStart=week.dataset.weekStart;return {state:(bar.className.match(/is-(open|completed|overdue)/)||[])[1]||null,edge:getComputedStyle(bar).borderLeftColor,name:bar.querySelector('.daily-bar-name')?.textContent||'',first:toDateInput(addDays(parseDateInput(weekStart),start)),last:toDateInput(addDays(parseDateInput(weekStart),end-1))}})}})()`);
    const rangedRow = async date => {
      await openDay(date);
      const row = await ev(`(()=>{const node=Array.from(document.querySelectorAll('[data-daily-row]')).find(item=>item.dataset.dailyRow==='${fixture.ranged}');if(!node)return null;const toggle=node.querySelector('[data-action=daily-toggle]');return {completed:node.classList.contains('is-completed'),checked:toggle.getAttribute('aria-checked'),label:toggle.getAttribute('aria-label'),meta:node.querySelector('.daily-row-meta')?.textContent||'',text:node.querySelector('.daily-text span')?.textContent||''}})()`);
      return row;
    };
    const toggleAt = async date => {
      await ev(`(()=>{const node=Array.from(document.querySelectorAll('[data-daily-row]')).find(item=>item.dataset.dailyRow==='${fixture.ranged}');node.querySelector('[data-action=daily-toggle]').click()})()`);
      await waitFor(b, "Pandora.idle()", 15000);
      await sleep(200);
      return rangedRow(date);
    };
    const closeAll = async () => { await ev("closeSheet()"); await waitFor(b, "document.getElementById('overlay').hidden", 12000); };
    const covered = [fixture.rangedStart, fixture.today, fixture.rangedEnd];
    await openDay(fixture.today);
    const completedAt = await toggleAt(fixture.today);
    check('从覆盖日清单完成跨日事项后该行立即变为完成灰', !!completedAt && completedAt.completed &&
      completedAt.checked === 'true' && completedAt.label.includes('取消完成') &&
      completedAt.meta.includes('至') && completedAt.text === '跨日三色同步事项', completedAt);
    await closeAll();
    const completedBars = await rangedBars();
    check('完成的跨日事项条覆盖全部已加载覆盖日并统一变灰',
      completedBars.count === 1 && completedBars.bars[0].state === 'completed' &&
      classifyEdge(completedBars.bars[0].edge) === 'grey' &&
      completedBars.bars[0].first === fixture.rangedStart && completedBars.bars[0].last === fixture.rangedEnd,
      completedBars);
    for (const date of covered) {
      const row = await rangedRow(date);
      check('完成状态同步到覆盖日 ' + date + ' 的清单', !!row && row.completed && row.checked === 'true' && row.meta.includes('至'), row);
      await closeAll();
    }
    await openDay(fixture.rangedStart);
    const reopenedAt = await toggleAt(fixture.rangedStart);
    check('从另一覆盖日取消完成后该行恢复未完成', !!reopenedAt && !reopenedAt.completed && reopenedAt.checked === 'false' && reopenedAt.label.includes('标记完成'), reopenedAt);
    await closeAll();
    const reopenedBars = await rangedBars();
    check('取消完成后跨日事项条恢复待做蓝且仍覆盖同一范围',
      reopenedBars.count === 1 && reopenedBars.bars[0].state === 'open' &&
      classifyEdge(reopenedBars.bars[0].edge) === 'blue' &&
      reopenedBars.bars[0].first === fixture.rangedStart && reopenedBars.bars[0].last === fixture.rangedEnd,
      reopenedBars);
    for (const date of covered) {
      const row = await rangedRow(date);
      check('取消完成同步到覆盖日 ' + date + ' 的清单', !!row && !row.completed && row.checked === 'false', row);
      await closeAll();
    }
    await openDay(fixture.rangedEnd);
    await toggleAt(fixture.rangedEnd);
    await closeAll();
    await ev("Pandora.reload()");
    await waitFor(b, "Pandora.ready&&Pandora.idle()", 20000);
    await ev(`PandoraDaily.goToDate('${fixture.today}')`);
    await sleep(500);
    const reloadedBars = await rangedBars();
    check('刷新后跨日事项的完成色与覆盖范围保持一致',
      reloadedBars.count === 1 && reloadedBars.bars[0].state === 'completed' &&
      classifyEdge(reloadedBars.bars[0].edge) === 'grey' &&
      reloadedBars.bars[0].first === fixture.rangedStart && reloadedBars.bars[0].last === fixture.rangedEnd,
      reloadedBars);
    const reloadedRow = await rangedRow(fixture.today);
    check('刷新后覆盖日清单仍读取同一条完成记录', !!reloadedRow && reloadedRow.completed && reloadedRow.text === '跨日三色同步事项', reloadedRow);
    await closeAll();
    await ev("document.querySelector('[data-action=daily-today]').click()");
    await sleep(220);

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
