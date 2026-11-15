'use strict';
/* Real-browser acceptance for the refined home interactions: two cards (event chronicle and task
   board), the two-line company clamp with independent expansion, the overdue board tint, the
   two-week daily-item density and the explicit +n weekday column. */
const { waitFor, sleep } = require('./browser_fixture');

const SIZES = [
  { width: 320, height: 740 },
  { width: 390, height: 844 },
  { width: 1440, height: 900 },
  { width: 390, height: 600 },
];

module.exports = async function checkDailyItemsHome(b, fixture, check, evidence) {
  const ev = b.evaluate;
  const weekdayColumn = key => { const d = new Date(key + 'T00:00:00Z'); return (d.getUTCDay() + 6) % 7; };

  async function openHomeCard(kind) {
    await ev(`document.querySelector('[data-home-list=${kind}]').click()`);
    return waitFor(b, "!document.getElementById('overlay').hidden&&Pandora.idle()&&!!document.querySelector('.sheet-body .home-list')", 12000);
  }
  async function closeSheet() {
    await ev("document.getElementById('sheetClose').click()");
    return waitFor(b, "document.getElementById('overlay').hidden");
  }

  /* ---------- two cards: three preview rows, no retired badges, shared typography ---------- */
  await b.viewport({ width: 390, height: 844, mobile: true });
  await ev("setPage('map')");
  await waitFor(b, "Pandora.ready&&Pandora.idle()&&!!document.querySelector('.company-quad')", 20000);
  const cards = await ev(`(()=>{const company=document.querySelector('.company-quad'),board=document.querySelector('.tasks-quad');
    const copy=Array.from(company.querySelectorAll('.q-body .home-copy'));
    const titles=Array.from(board.querySelectorAll('.q-body .home-task-title'));
    const style=e=>{const s=getComputedStyle(e);return {size:parseFloat(s.fontSize),weight:s.fontWeight,line:parseFloat(s.lineHeight),
      clamp:s.webkitLineClamp,orient:s.webkitBoxOrient,display:s.display,white:s.whiteSpace}};
    const long=copy[0];
    return {companyRows:company.querySelectorAll('.q-body .item-line').length,
      boardRows:board.querySelectorAll('.q-body .home-task').length,
      companyHint:!!company.querySelector('.card-head .hint'), boardHint:!!board.querySelector('.card-head .hint'),
      hintText:(company.querySelector('.card-head')?.textContent||'')+(board.querySelector('.card-head')?.textContent||''),
      previews:[...company.querySelectorAll('.q-body .item-line')].map(e=>e.textContent.trim()),
      overduePreview:board.querySelectorAll('.q-body .home-task.is-overdue').length,
      companyCopy:copy.length?style(copy[0]):null, boardCopy:titles.length?style(titles[0]):null,
      longClamped:!!long&&long.scrollHeight>long.clientHeight+1,
      text:long?long.textContent:null, expected:${JSON.stringify((JSON.parse(process.env.PANDORA_BROWSER_FIXTURE).companyBodies||[])[0]||'')}}})()`);
  check('both upper cards preview exactly three normal rows', cards.companyRows === 3 && cards.boardRows === 3, cards);
  check('the retired 统一发布 and n/10 badges are gone from the cards',
    !cards.companyHint && !cards.boardHint && !cards.hintText.includes('统一发布') && !/\d\s*\/\s*10/.test(cards.hintText), cards);
  check('the company preview clamps its long body to two lines without rewriting the text',
    cards.longClamped && cards.text === cards.expected, { clamped: cards.longClamped, text: cards.text, expected: cards.expected });
  check('event-chronicle and board body copy share one type scale in the cards',
    !!cards.companyCopy && !!cards.boardCopy && cards.companyCopy.size === cards.boardCopy.size &&
    cards.companyCopy.weight === cards.boardCopy.weight && cards.companyCopy.line === cards.boardCopy.line &&
    cards.companyCopy.orient === 'vertical' && cards.boardCopy.orient === 'vertical' &&
    cards.companyCopy.clamp === '2' && cards.boardCopy.clamp === '2', cards);
  check('the board preview never paints the overdue tint', cards.overduePreview === 0, cards.overduePreview);
  const previewOrder = await ev(`Pandora.data.home.assignedTasks.slice(0,3).map(row=>row.title)`);
  const previewTitles = await ev("Array.from(document.querySelectorAll('.tasks-quad .q-body .home-task-title')).map(e=>e.textContent)");
  check('the preview consumes the server order without re-sorting', JSON.stringify(previewTitles) === JSON.stringify(previewOrder),
    { previewTitles, previewOrder });

  /* ---------- board list: real sorting, overdue tint only in the list ---------- */
  check('clicking the board card opens the complete list first', await openHomeCard('tasks'));
  const board = await ev(`(()=>{const rows=Array.from(document.querySelectorAll('.sheet-body .home-list .home-task'));
    const overdue=rows.find(r=>r.dataset.task===${JSON.stringify(fixture.boardOverdue)});
    const normal=rows.find(r=>r!==overdue);
    const tint=e=>{const s=getComputedStyle(e);return s.backgroundImage+'|'+s.backgroundColor};
    return {count:rows.length, ids:rows.map(r=>r.dataset.task),
      overdueCount:rows.filter(r=>r.classList.contains('is-overdue')).length,
      overdueLabel:overdue?overdue.getAttribute('aria-label'):null,
      overdueTint:overdue?tint(overdue):null, normalTint:normal?tint(normal):null,
      normalIsOverdue:normal?normal.classList.contains('is-overdue'):null,
      server:Pandora.data.home.assignedTasks.map(r=>r.taskId),
      scrollTop:document.getElementById('sheetBody').scrollTop}})()`);
  check('the list shows the same globally sorted rows the server returned',
    board.count === board.server.length && board.count >= 3 && board.count <= 10 &&
    JSON.stringify(board.ids) === JSON.stringify(board.server), board);
  check('exactly the truly overdue list row carries the pale glass-red band and an accessible label',
    board.overdueCount === 1 && board.overdueLabel && board.overdueLabel.includes('已逾期') &&
    board.overdueTint !== board.normalTint && board.normalIsOverdue === false, board);
  const detailReturn = await ev(`(async()=>{const body=document.getElementById('sheetBody');
    body.scrollTop=30;
    const ids=()=>[...document.querySelectorAll('.sheet-body .home-list .home-task')].map(r=>r.dataset.task);
    const before={top:body.scrollTop, ids:ids()};
    document.querySelectorAll('.sheet-body .home-list .home-task')[2].click();
    await new Promise(r=>setTimeout(r,700));
    const detailTitle=document.getElementById('sheetTitle').textContent;
    const detailOpen=!document.getElementById('overlay').hidden;
    const back=document.querySelector('[data-action=sheet-back]');
    if (back) back.click(); else document.getElementById('sheetClose').click();
    await new Promise(r=>setTimeout(r,600));
    const afterBody=document.getElementById('sheetBody');
    return {before, detailTitle, detailOpen, listTitle:document.getElementById('sheetTitle').textContent,
      listOpen:!document.getElementById('overlay').hidden, after:{top:afterBody.scrollTop, ids:ids()}}})()`);
  check('a list row opens the original authorized task detail', !!detailReturn.detailTitle && detailReturn.detailOpen, detailReturn);
  check('returning from the detail restores the same sorted list and its scroll position',
    detailReturn.listOpen && detailReturn.listTitle === '任务看板' &&
    JSON.stringify(detailReturn.after.ids) === JSON.stringify(detailReturn.before.ids) &&
    Math.abs(detailReturn.after.top - detailReturn.before.top) <= 1, detailReturn);
  await closeSheet();
  await sleep(200);

  /* ---------- company chronicle list: clamped by default, independently expandable ---------- */
  check('clicking the chronicle card opens the complete list first', await openHomeCard('company'));
  const chronicle = await ev(`(()=>{const rows=Array.from(document.querySelectorAll('.sheet-body .home-list .home-chronicle'));
    const bodies=rows.map(r=>({expanded:r.getAttribute('aria-expanded'),expandable:!!r.querySelector('.home-copy'),
      clamped:r.querySelector('.home-copy')?r.querySelector('.home-copy').scrollHeight>r.querySelector('.home-copy').clientHeight+1:null,
      text:r.querySelector('.home-copy')?.textContent||'',
      display:getComputedStyle(r.querySelector('.home-copy')).display,
      clamp:getComputedStyle(r.querySelector('.home-copy')).webkitLineClamp,orient:getComputedStyle(r.querySelector('.home-copy')).webkitBoxOrient}));
    const body=document.getElementById('sheetBody');
    return {count:rows.length,bodies,scrollTop:body.scrollTop,bodyHeight:body.scrollHeight,clientHeight:body.clientHeight,
      server:Pandora.data.home.companyItems.map(i=>i.body)}})()`);
  check('every chronicle row starts collapsed with its full text preserved and two-line clamp',
    chronicle.count === 5 && chronicle.bodies.every((row) =>
      row.expanded === 'false' && row.expandable && row.clamp === '2' && row.orient === 'vertical') &&
    JSON.stringify(chronicle.bodies.map(r => r.text)) === JSON.stringify(chronicle.server), chronicle);
  check('both long chronicles really overflow two lines on a narrow screen',
    chronicle.bodies.filter(row => row.clamped).length >= 2, chronicle.bodies.map(row => row.clamped));
  const toggle = await ev(`(()=>{const rows=Array.from(document.querySelectorAll('.sheet-body .home-list .home-chronicle'));
    const body=document.getElementById('sheetBody');body.scrollTop=Math.max(0,body.scrollHeight-body.clientHeight-6);
    const before=body.scrollTop;
    rows[0].click();
    const expandedBody=rows[0].querySelector('.home-copy');
    const afterFirst={expanded:rows[0].getAttribute('aria-expanded'),clamp:getComputedStyle(expandedBody).webkitLineClamp,
      fullyVisible:expandedBody.scrollHeight<=expandedBody.clientHeight+1,
      other:rows[4].getAttribute('aria-expanded'),top:body.scrollTop};
    rows[4].click();
    const afterSecond={first:rows[0].getAttribute('aria-expanded'),second:rows[4].getAttribute('aria-expanded'),top:body.scrollTop};
    rows[0].click();
    const afterCollapse={first:rows[0].getAttribute('aria-expanded'),second:rows[4].getAttribute('aria-expanded'),
      clamp:getComputedStyle(rows[0].querySelector('.home-copy')).webkitLineClamp,top:body.scrollTop};
    return {before,afterFirst,afterSecond,afterCollapse}})()`);
  check('one click expands only that chronicle and reveals the complete body',
    toggle.afterFirst.expanded === 'true' && toggle.afterFirst.clamp === 'none' && toggle.afterFirst.fullyVisible &&
    toggle.afterFirst.other === 'false' && toggle.afterSecond.first === 'true' && toggle.afterSecond.second === 'true' &&
    toggle.afterCollapse.first === 'false' && toggle.afterCollapse.clamp === '2' && toggle.afterCollapse.second === 'true', toggle);
  check('expanding or collapsing a row does not reset the sheet scroll position',
    Math.abs(toggle.afterFirst.top - toggle.before) <= 1 && Math.abs(toggle.afterSecond.top - toggle.before) <= 1 &&
    Math.abs(toggle.afterCollapse.top - toggle.before) <= 1, toggle);
  // Keyboard: the row is a real button, so Enter toggles the same state.
  await ev("document.querySelectorAll('.sheet-body .home-list .home-chronicle')[1].focus()");
  const focusedRow = await ev("({expanded:document.activeElement.getAttribute('aria-expanded'),row:document.activeElement.classList.contains('home-chronicle')})");
  await b.send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Enter', code: 'Enter', windowsVirtualKeyCode: 13, nativeVirtualKeyCode: 13, text: '\r' });
  await b.send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Enter', code: 'Enter', windowsVirtualKeyCode: 13, nativeVirtualKeyCode: 13 });
  await sleep(200);
  check('keyboard Enter toggles the focused chronicle and exposes aria-expanded',
    focusedRow.row && focusedRow.expanded === 'false' &&
    await ev("document.activeElement.getAttribute('aria-expanded')==='true'&&document.activeElement.classList.contains('is-expanded')"),
    { focusedRow, after: await ev("({expanded:document.activeElement.getAttribute('aria-expanded'),row:document.activeElement.classList.contains('home-chronicle')})") });
  await closeSheet();
  check('reopening the chronicle list restores the default collapsed state', await openHomeCard('company') &&
    await ev("Array.from(document.querySelectorAll('.sheet-body .home-list .home-chronicle')).every(r=>r.getAttribute('aria-expanded')==='false')"));
  await closeSheet();

  /* ---------- two-week density and taller lanes across the four existing viewports ---------- */
  const density = [];
  for (const size of SIZES) {
    await b.viewport({ ...size, mobile: size.width < 1000 });
    await b.send('Page.reload', { ignoreCache: true });
    const ready = await waitFor(b, "Pandora.ready&&Pandora.idle()&&!!document.getElementById('dailyScroller')", 25000);
    await sleep(400);
    if (!ready) { density.push({ viewport: size.width + 'x' + size.height, ready: false }); continue; }
    density.push(await ev(`(()=>{const s=document.getElementById('dailyScroller'),box=s.getBoundingClientRect();
      const weeks=Array.from(s.querySelectorAll('.daily-week')).map(w=>w.getBoundingClientRect());
      const weekHeight=weeks.length?weeks[0].height:0;
      const visible=weeks.reduce((sum,r)=>sum+Math.max(0,Math.min(r.bottom,box.bottom)-Math.max(r.top,box.top)),0);
      const full=weeks.filter(r=>r.top>=box.top-1&&r.bottom<=box.bottom+1).length;
      const bars=Array.from(document.querySelectorAll('.daily-bar')).filter(b=>!b.hidden).map(b=>b.getBoundingClientRect().height);
      const cells=Array.from(document.querySelectorAll('.daily-cell')).map(c=>c.getBoundingClientRect().height);
      const add=document.querySelector('.daily-head .daily-add');
      const tracks=document.querySelector('.daily-tracks');
      const row=parseFloat(getComputedStyle(tracks).gridAutoRows)||0;
      const lanes=tracks?Math.round((tracks.getBoundingClientRect().height-2)/(row+2)):0;
      return {viewport:innerWidth+'x'+innerHeight,ready:true,clientHeight:s.clientHeight,weekHeight,
        fraction:+(visible/(weekHeight||1)).toFixed(2),full,row,barMin:Math.min(...bars),barMax:Math.max(...bars),
        cellMin:Math.min(...cells),add:add?add.getBoundingClientRect().height:0,
        rows:document.querySelectorAll('.daily-tracks').length,lanes,
        todayVisible:!!(()=>{const t=document.querySelector('[data-daily-date="${fixture.today}"]');if(!t)return null;const r=t.getBoundingClientRect();return r.top>=box.top-1&&r.bottom<=box.bottom+1})()}})()`));
  }
  evidence('home-density', density);
  check('the daily calendar keeps a two-week viewport instead of three complete weeks on every viewport',
    density.every(row => row.ready && row.fraction >= 2 && row.fraction < 3 && row.full <= 2),
    density);
  check('every visible lane bar is taller than the former 18px and keeps three lanes with a usable date row',
    density.every(row => row.ready && row.row >= 30 && row.barMin >= 30 && row.lanes === 3 &&
      row.cellMin >= 34 && row.add >= 30), density);

  /* ---------- +n keeps its real weekday column for sparse, Sunday and month-boundary overflow ---------- */
  const overflow = [];
  for (const [label, key] of Object.entries(fixture.overflow)) {
    await ev(`PandoraDaily.goToDate(${JSON.stringify(key)})`);
    await sleep(700);
    const row = await ev(`(()=>{const more=document.querySelector('[data-daily-more][data-date=${JSON.stringify(key)}]');
      const cell=document.querySelector('[data-daily-date=${JSON.stringify(key)}]');
      if(!more||!cell)return {missing:true,key:${JSON.stringify(key)}};
      const week=more.closest('.daily-week');
      const siblings=Array.from(week.querySelectorAll('[data-daily-more]')).map(b=>({date:b.dataset.date,col:getComputedStyle(b).gridColumnStart,text:b.textContent.trim()}));
      const moreBox=more.getBoundingClientRect(),cellBox=cell.getBoundingClientRect();
      return {key:${JSON.stringify(key)},text:more.textContent.trim(),col:getComputedStyle(more).gridColumnStart,
        aligned:Math.abs((moreBox.left+moreBox.width/2)-(cellBox.left+cellBox.width/2))<=2,
        siblings:week.querySelectorAll('[data-daily-more]').length,list:siblings}})()`);
    if (!row.missing) {
      const expectedColumn = String(weekdayColumn(key) + 1);
      check('the +n button for ' + label + ' sits in its real weekday column and counts the hidden rows',
        row.text === '+1' && row.col === expectedColumn && row.aligned,
        { ...row, expectedColumn });
    } else {
      check('the +n button for ' + label + ' is rendered', false, row);
    }
    overflow.push(row);
  }
  evidence('home-overflow', overflow);
  check('only Sunday overflows in its isolated week and sparse overflow keeps two distinct columns',
    overflow[0].siblings === 1 && overflow[0].col === '7' &&
    overflow[1].siblings === 2 && overflow[1].col === '1' && overflow[2].col === '5' &&
    overflow[3].col === String(weekdayColumn(fixture.overflow.month) + 1), overflow);
  // The +n still opens the real day list with all hidden rows.
  await ev(`document.querySelector('[data-daily-more][data-date=${JSON.stringify(fixture.overflow.sunday)}]').click()`);
  check('clicking the Sunday +n opens that day list with the complete collection',
    await waitFor(b, `Pandora.idle()&&!document.getElementById('overlay').hidden&&document.querySelectorAll('[data-daily-row]').length===4&&document.getElementById('sheetTitle').textContent.includes('每日事项')`, 12000));
  await ev("document.getElementById('sheetClose').click()");
  await waitFor(b, "document.getElementById('overlay').hidden");
  // Leave the suite in its default viewport with a freshly rendered calendar.
  await b.viewport({ width: 390, height: 844, mobile: true });
  await b.send('Page.reload', { ignoreCache: true });
  await waitFor(b, "Pandora.ready&&Pandora.idle()&&!!document.getElementById('dailyScroller')", 25000);
};
