'use strict';
const { waitFor, sleep } = require('./browser_fixture');

module.exports = async function checkDailyItemLifecycle(b, fixture, check) {
  const ev = b.evaluate, js = JSON.stringify;
  const date = fixture.bulk;
  const otherDate = '2034-06-17';
  const state = `(()=>{const s=PandoraDaily.state;return {hidden:overlayEl.hidden,kinds:sheetStack.map(v=>v.dailyKind),date:sheetStack.at(-1)?.dailyDate,page:state.page,focus:document.activeElement.dataset.dailyDate,account:s.account,cached:s.lists.size,anchor:s.anchorDate,offset:s.anchorOffset}})()`;
  async function ready(expression) {
    if (!await waitFor(b, expression, 12000)) throw Error('not ready: ' + expression);
  }
  async function openList() {
    await ev(`setPage('map');PandoraDaily.goToDate(${js(date)});PandoraDaily.openList(${js(date)},document.querySelector('[data-daily-date="${date}"]'))`);
    await ready("sheetStack.at(-1)?.dailyKind==='list'&&Pandora.idle()");
  }
  async function holdDetail() {
    await ev(`window.lifecycleHeld=[];window.lifecycleRequest=Pandora.request;Pandora.request=async function(path,options){const result=await window.lifecycleRequest(path,options);if(path.startsWith('/daily-items/')&&!path.includes('/summary'))await new Promise(resolve=>window.lifecycleHeld.push(resolve));return result};document.querySelector('#sheetBody [data-action=daily-open]').click()`);
    await ready('window.lifecycleHeld.length===1');
  }
  async function release() {
    await ev('Pandora.request=window.lifecycleRequest;window.lifecycleHeld.splice(0).forEach(resolve=>resolve())');
    await ready('Pandora.idle()');
    await sleep(50);
  }
  for (const exit of ['Escape', 'close-button', 'backdrop', 'back', 'switch-page', 'other-date', 'new-form']) {
    await openList();
    const before = await ev(state);
    await holdDetail();
    if (exit === 'Escape' || exit === 'switch-page' || exit === 'other-date') {
      await b.send('Input.dispatchKeyEvent', { type: 'rawKeyDown', key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27 });
      await b.send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27 });
    } else if (exit === 'close-button') await ev("document.getElementById('sheetClose').click()");
    else if (exit === 'backdrop') await ev('overlayEl.click()');
    else if (exit === 'back') await ev('backSheet()');
    else await ev("document.querySelector('#sheetFoot [data-action=daily-new]').click()");
    if (exit === 'switch-page') await ev("setPage('view');setPage('map')");
    // A cancelled read must release the command lock before its old result arrives.
    if (exit === 'other-date') {
      await ready('Pandora.idle()');
      await ev(`PandoraDaily.openList(${js(otherDate)})`);
      await ready(`sheetStack.at(-1)?.dailyDate===${js(otherDate)}&&Pandora.idle()`);
    }
    const dismissed = await ev(state);
    await release();
    const after = await ev(state);
    const correctLayer = exit === 'other-date' ? after.kinds.join() === 'list' && after.date === otherDate :
      exit === 'new-form' ? after.kinds.join() === 'list,form' && !after.hidden : after.hidden && !after.kinds.length;
    const calendarKept = exit === 'other-date' || (after.anchor === before.anchor && Math.abs(after.offset - before.offset) < 1);
    check(`V-005 ${exit} discards the old detail result and preserves the current layer`, correctLayer && after.account === before.account && after.cached >= before.cached && calendarKept, { before, dismissed, after });
    if (exit === 'Escape' || exit === 'close-button' || exit === 'backdrop') {
      check(`V-005 ${exit} restores the calendar date focus while detail is loading`, after.focus === date, after);
    }
    if (exit === 'new-form') {
      await ev("document.querySelector('#sheetFoot [data-action=sheet-back]').click()");
      check('V-005 returning from a replacement form keeps its source list', await ev(`sheetStack.at(-1)?.dailyDate===${js(date)}&&sheetStack.length===1`));
    }
    await ev('closeSheet()');
  }

  await ev(`setPage('map');window.lifecycleHeld=[];window.lifecycleRequest=Pandora.request;Pandora.request=async function(path,options){const result=await window.lifecycleRequest(path,options);if(path.startsWith('/daily-items?'))await new Promise(resolve=>window.lifecycleHeld.push(resolve));return result};PandoraDaily.openList('2036-07-19')`);
  await ready('window.lifecycleHeld.length===1');
  await ev('closeSheet()');
  await release();
  check('V-005 cancelling an initial list request cannot reopen the list', await ev('overlayEl.hidden&&sheetStack.length===0'));

  await ev(`window.lifecycleHeld=[];window.lifecycleListCalls=0;window.lifecycleRequest=Pandora.request;Pandora.request=async function(path,options){const result=await window.lifecycleRequest(path,options);if(path.startsWith('/daily-items?')&&++window.lifecycleListCalls===1)await new Promise(resolve=>window.lifecycleHeld.push(resolve));return result};PandoraDaily.openList('2038-08-21')`);
  await ready('window.lifecycleHeld.length===1');
  await ev("closeSheet();PandoraDaily.openList('2038-08-21')");
  await ready("sheetStack.at(-1)?.dailyDate==='2038-08-21'&&Pandora.idle()");
  await release();
  const reopened = await ev("({date:sheetStack.at(-1)?.dailyDate,calls:window.lifecycleListCalls,loading:sheetBodyEl.textContent.includes('正在加载'),depth:sheetStack.length})");
  check('V-005 reopening the same date owns a new read instead of retaining a cancelled loading state', reopened.date === '2038-08-21' && reopened.calls === 2 && !reopened.loading && reopened.depth === 1, reopened);
  await ev('closeSheet()');

  await openList();
  await ev("document.querySelector('#sheetBody [data-action=daily-open]').click()");
  await ready("sheetStack.at(-1)?.dailyKind==='detail'&&Pandora.idle()");
  await ev("document.querySelector('#sheetFoot [data-action=sheet-back]').click()");
  check('V-005 an uncancelled detail still opens and returns to its source list', await ev(`sheetStack.at(-1)?.dailyDate===${js(date)}&&sheetStack.length===1`));
  await ev('closeSheet()');
};
