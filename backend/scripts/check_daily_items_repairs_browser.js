'use strict';
const { waitFor, sleep } = require('./browser_fixture');

// Run inside the daily-items fixture, using its authenticated browser and real API rows.
module.exports = async function checkDailyItemRepairs(b, fixture, check) {
  const ev = b.evaluate, js = JSON.stringify;
  const key = async name => {
    await b.send('Input.dispatchKeyEvent', { type: 'rawKeyDown', key: name });
    await b.send('Input.dispatchKeyEvent', { type: 'keyUp', key: name });
  };
  async function locate(month) {
    await ev(`document.querySelector('[data-action=daily-locate]').click();document.getElementById('daily-locate').value=${js(month)};document.querySelector('[data-action=daily-locate-save]').click()`);
    await sleep(220);
  }
  const monthState = `(()=>{const s=document.getElementById('dailyScroller'),r=s.getBoundingClientRect();
    const cells=Array.from(s.querySelectorAll('[data-daily-date]'));
    const first=cells.find(c=>c.getBoundingClientRect().top>=r.top-1);
    const block=first?first.closest('.daily-month'):null;
    return {anchor:PandoraDaily.state.anchorDate,label:block?block.querySelector('.daily-month-label').textContent:null,
      visible:cells.filter(c=>{const x=c.getBoundingClientRect();return x.top>=r.top-1&&x.bottom<=r.bottom+1}).map(c=>c.dataset.dailyDate)}})()`;
  function correctMonth(state, month) {
    return (state.anchor || '').slice(0, 7) === month &&
      state.label === Number(month.slice(0, 4)) + '年' + Number(month.slice(5)) + '月' &&
      state.visible.some(day => day.startsWith(month));
  }
  for (let month = 1; month <= 12; month++) {
    const start = '2026-' + String(month).padStart(2, '0');
    await locate(start);
    for (const [action, delta] of [['daily-next', 1], ['daily-prev', -1]]) {
      await locate(start);
      await ev(`document.querySelector('[data-action=${action}]').click()`);
      await sleep(220);
      const date = new Date(Date.UTC(2026, month - 1 + delta, 1));
      const expected = date.toISOString().slice(0, 7), state = await ev(monthState);
      check(`V-001 ${start} ${action} moves exactly one month including year boundaries`, correctMonth(state, expected), state);
    }
  }
  await ev("document.getElementById('dailyScroller').scrollTop+=100;document.getElementById('dailyScroller').dispatchEvent(new Event('scroll'))");
  await sleep(250);
  const sequence = await ev(`(()=>{const blocks=Array.from(document.querySelectorAll('.daily-month'));
    const perBlock=blocks.map(b=>Array.from(b.querySelectorAll('[data-daily-date]')).map(c=>c.dataset.dailyDate));
    const all=perBlock.flat();
    return {unique:new Set(all).size===all.length,
      contiguous:perBlock.every(ds=>ds.every((d,i)=>!i||new Date(d+'T00:00:00Z')-new Date(ds[i-1]+'T00:00:00Z')===86400000)),
      ascending:perBlock.every((ds,i)=>!i||ds[0]>perBlock[i-1][perBlock[i-1].length-1]),
      ownMonth:perBlock.every(ds=>new Set(ds.map(d=>d.slice(0,7))).size<=1)}})()`);
  check('V-001 vertical browsing keeps every month internally continuous and in date order', sequence.unique && sequence.contiguous && sequence.ascending && sequence.ownMonth, sequence);
  await ev("document.querySelector('[data-action=daily-today]').click()");
  await sleep(220);
  const todayVisible = await ev(`(()=>{const c=document.querySelector('[data-daily-date="${fixture.today}"]'),s=document.getElementById('dailyScroller'),r=c.getBoundingClientRect(),v=s.getBoundingClientRect();return r.top>=v.top-1&&r.bottom<=v.bottom+1})()`);
  check('V-001 return to company today remains visible', todayVisible);

  const focusState = `(()=>{const c=document.activeElement,s=document.getElementById('dailyScroller'),r=c.getBoundingClientRect(),v=s.getBoundingClientRect();return {date:c.dataset.dailyDate,visible:!!c.dataset.dailyDate&&r.top>=v.top-1&&r.bottom<=v.bottom+1,pageOverflow:document.documentElement.scrollWidth>innerWidth+1,cellTop:Math.round(r.top),cellBottom:Math.round(r.bottom),viewTop:Math.round(v.top),viewBottom:Math.round(v.bottom),scrollTop:Math.round(s.scrollTop)}})()`;
  await locate('2026-12');
  await ev("document.getElementById('dailyScroller').focus();PandoraDaily.state.selected='2026-12-15'");
  for (const [direction, count] of [['ArrowDown', 18], ['ArrowUp', 40], ['ArrowRight', 8], ['ArrowLeft', 8]]) {
    const states = [];
    for (let i = 0; i < count; i++) {
      await key(direction);
      await sleep(25);
      states.push(await ev(focusState));
    }
    check(`V-003 ${direction} keeps every focused date visible across viewport and loaded-range boundaries`, states.every(s => s.visible && !s.pageOverflow), states);
  }
  await locate('2024-02');
  await ev("document.getElementById('dailyScroller').focus()");
  await key('Home');
  await sleep(220);
  let focused = await ev(focusState);
  check('V-003 Home mounts company today and keeps its focus visible', focused.date === fixture.today && focused.visible && !focused.pageOverflow, focused);
  for (const activation of ['Enter', ' ']) {
    await key(activation);
    check(`V-003 ${activation === ' ' ? 'Space' : activation} opens the visible focused day`, await waitFor(b, `sheetStack.at(-1)?.dailyDate===${js(fixture.today)}&&Pandora.idle()`));
    await key('Escape');
    focused = await ev(focusState);
    check('V-003 closing a keyboard-opened list restores visible date focus', focused.date === fixture.today && focused.visible && !focused.pageOverflow, focused);
  }

  async function openBulk() {
    await ev(`PandoraDaily.goToDate(${js(fixture.bulk)});PandoraDaily.openList(${js(fixture.bulk)},document.querySelector('[data-daily-date="${fixture.bulk}"]'))`);
    if (!await waitFor(b, "sheetStack.at(-1)?.dailyKind==='list'&&Pandora.idle()")) throw Error('bulk list not ready');
  }
  async function enterScrolledDetail() {
    return ev(`(()=>{sheetBodyEl.scrollTop=600;const box=sheetBodyEl.getBoundingClientRect();const row=Array.from(sheetBodyEl.querySelectorAll('[data-action=daily-open]')).find(e=>{const r=e.getBoundingClientRect();return r.top>=box.top&&r.bottom<=box.bottom});const s=document.getElementById('dailyScroller'),top=s.getBoundingClientRect().top;const first=Array.from(s.querySelectorAll('[data-daily-date]')).find(c=>c.getBoundingClientRect().top>=top-1);const saved={top:sheetBodyEl.scrollTop,id:row.dataset.id,anchor:first.dataset.dailyDate,offset:first.getBoundingClientRect().top-top};row.click();return saved})()`);
  }
  async function assertListRestored(saved, label) {
    await waitFor(b, "sheetStack.at(-1)?.dailyKind==='list'&&Pandora.idle()");
    const state = await ev("({top:sheetBodyEl.scrollTop,focus:document.activeElement.dataset.id,depth:sheetStack.length})");
    check(label, saved.top > 0 && Math.abs(state.top - saved.top) < 1 && state.focus === saved.id && state.depth === 1, { saved, state });
  }
  for (const size of [{ width: 320, height: 740 }, { width: 390, height: 844 }, { width: 1440, height: 900 }, { width: 390, height: 600 }]) {
    await b.viewport({ ...size, mobile: size.width < 600 });
    await locate('2026-12');
    await ev("document.querySelector('[data-action=daily-next]').click()");
    await sleep(220);
    const forward = await ev(monthState);
    await ev("document.querySelector('[data-action=daily-prev]').click()");
    await sleep(220);
    const backward = await ev(monthState);
    check(`V-001 ${size.width}x${size.height} month navigation aligns the target even in a wide viewport`, correctMonth(forward, '2027-01') && correctMonth(backward, '2026-12'), { forward, backward });
    await openBulk();
    const saved = await enterScrolledDetail();
    await waitFor(b, "sheetStack.at(-1)?.dailyKind==='detail'&&Pandora.idle()");
    const back = await ev(`(()=>{const e=document.querySelector('#sheetFoot [data-action=sheet-back]'),r=e?.getBoundingClientRect();return {visible:!!r&&r.width>0&&r.height>0&&r.top>=0&&r.bottom<=innerHeight}})()`);
    check(`V-002 ${size.width}x${size.height} first detail has a visible return button`, back.visible, back);
    await ev("document.querySelector('#sheetFoot [data-action=sheet-back]').click()");
    await assertListRestored(saved, `V-002 ${size.width}x${size.height} button return restores nonzero scroll and row focus`);
    await ev("document.getElementById('sheetClose').click()");
    const closed = await ev(`(()=>{const s=document.getElementById('dailyScroller'),top=s.getBoundingClientRect().top;const first=Array.from(s.querySelectorAll('[data-daily-date]')).find(c=>c.getBoundingClientRect().top>=top-1);return {hidden:overlayEl.hidden,anchor:first.dataset.dailyDate,offset:first.getBoundingClientRect().top-top,focus:document.activeElement.dataset.dailyDate}})()`);
    check(`V-002 ${size.width}x${size.height} closing list restores calendar position and focus`, closed.hidden && closed.anchor === saved.anchor && Math.abs(closed.offset - saved.offset) < 1 && closed.focus === fixture.bulk, { saved, closed });
  }
  await b.viewport({ width: 390, height: 844, mobile: true });

  const clearedState = `(()=>{const s=PandoraDaily.state;return {records:s.records.size,account:s.account,organization:s.organization,epoch:s.epoch,months:s.months.length,detail:s.detail,draft:drafts.daily,selected:s.selected,anchor:s.anchorDate,stack:sheetStack.length}})()`;
  function isCleared(s) {
    return !s.records && s.account === null && s.organization === null && s.epoch === -1 && !s.months && !s.detail && !s.draft && !s.selected && !s.anchor && !s.stack;
  }
  await openBulk();
  await ev("document.querySelector('#sheetBody [data-action=daily-open]').click()");
  await waitFor(b, "sheetStack.at(-1)?.dailyKind==='detail'&&Pandora.idle()");
  check('V-004 private daily caches exist before logout', await ev("PandoraDaily.state.records.size>0&&PandoraDaily.state.lists.size>0"));
  await ev('Pandora.logout()');
  const cleared = await ev(clearedState);
  check('V-004 logout immediately clears daily caches, selection, anchor and sheet stack', isCleared(cleared), cleared);
  await waitFor(b, "!!document.getElementById('backend-login')&&Pandora.idle()", 20000);
  await ev(`document.getElementById('login-user').value=${js(fixture.identities['alpha-one-employee'].identifier)};document.getElementById('login-password').value='Fixture@123456';document.getElementById('backend-login').requestSubmit()`);
  await waitFor(b, `Pandora.ready&&Pandora.idle()&&Pandora.data.me.id===${js(fixture.identities['alpha-one-employee'].id)}`, 20000);
};
