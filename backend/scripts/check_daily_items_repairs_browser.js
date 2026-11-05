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
    await sleep(180);
  }
  /* The visible month heading is now the block's own label; there is no separate anchor subtitle. */
  const monthState = `(()=>{const s=document.getElementById('dailyScroller'),r=s.getBoundingClientRect();
    const cells=Array.from(s.querySelectorAll('[data-daily-date]'));
    const first=cells.find(c=>c.getBoundingClientRect().left>=r.left-1);
    const block=first?first.closest('.daily-month'):null;
    return {anchor:PandoraDaily.state.anchor,label:block?block.querySelector('.daily-month-label').textContent:null,
      visible:cells.filter(c=>{const x=c.getBoundingClientRect();return x.left>=r.left-1&&x.right<=r.right+1}).map(c=>c.dataset.dailyDate)}})()`;
  function correctMonth(state, month) {
    return state.anchor === month && state.label === Number(month.slice(0, 4)) + '年' + Number(month.slice(5)) + '月' && state.visible.some(day => day.startsWith(month));
  }
  for (let month = 1; month <= 12; month++) {
    const start = '2026-' + String(month).padStart(2, '0');
    await locate(start);
    for (const [action, delta] of [['daily-next', 1], ['daily-prev', -1]]) {
      await locate(start);
      await ev(`document.querySelector('[data-action=${action}]').click()`);
      await sleep(180);
      const date = new Date(Date.UTC(2026, month - 1 + delta, 1));
      const expected = date.toISOString().slice(0, 7), state = await ev(monthState);
      check(`V-001 ${start} ${action} moves exactly one month including year boundaries`, correctMonth(state, expected), state);
    }
  }
  await ev("document.getElementById('dailyScroller').scrollLeft+=100;document.getElementById('dailyScroller').dispatchEvent(new Event('scroll'))");
  await sleep(200);
  const sequence = await ev(`(()=>{const blocks=Array.from(document.querySelectorAll('.daily-month'));
    const perBlock=blocks.map(b=>Array.from(b.querySelectorAll('[data-daily-date]')).map(c=>c.dataset.dailyDate));
    const all=perBlock.flat();
    return {unique:new Set(all).size===all.length,
      contiguous:perBlock.every(ds=>ds.every((d,i)=>!i||new Date(d+'T00:00:00Z')-new Date(ds[i-1]+'T00:00:00Z')===86400000)),
      ascending:perBlock.every((ds,i)=>!i||ds[0]>perBlock[i-1][perBlock[i-1].length-1]),
      ownMonth:perBlock.every(ds=>new Set(ds.map(d=>d.slice(0,7))).size<=1)}})()`);
  check('V-001 horizontal browsing keeps every month internally continuous and in date order', sequence.unique && sequence.contiguous && sequence.ascending && sequence.ownMonth, sequence);
  await ev("document.querySelector('[data-action=daily-today]').click()");
  await sleep(200);
  const todayVisible = await ev(`(()=>{const c=document.querySelector('[data-daily-date="${fixture.today}"]'),s=document.getElementById('dailyScroller'),r=c.getBoundingClientRect(),v=s.getBoundingClientRect();return r.left>=v.left-1&&r.right<=v.right+1})()`);
  check('V-001 return to company today remains visible', todayVisible);

  const focusState = `(()=>{const c=document.activeElement,s=document.getElementById('dailyScroller'),r=c.getBoundingClientRect(),v=s.getBoundingClientRect();return {date:c.dataset.dailyDate,visible:!!c.dataset.dailyDate&&r.left>=v.left-1&&r.right<=v.right+1,pageOverflow:document.documentElement.scrollWidth>innerWidth+1}})()`;
  await locate('2026-12');
  await ev("document.getElementById('dailyScroller').focus();PandoraDaily.state.selected='2026-12-15'");
  for (const [direction, count] of [['ArrowDown', 18], ['ArrowUp', 40], ['ArrowRight', 8], ['ArrowLeft', 8]]) {
    const states = [];
    for (let i = 0; i < count; i++) {
      await key(direction);
      await sleep(20);
      states.push(await ev(focusState));
    }
    check(`V-003 ${direction} keeps every focused date visible across viewport and loaded-range boundaries`, states.every(s => s.visible && !s.pageOverflow), states);
  }
  await locate('2024-02');
  await ev("document.getElementById('dailyScroller').focus()");
  await key('Home');
  await sleep(200);
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
    return ev(`(()=>{sheetBodyEl.scrollTop=600;const box=sheetBodyEl.getBoundingClientRect();const row=Array.from(sheetBodyEl.querySelectorAll('[data-action=daily-open]')).find(e=>{const r=e.getBoundingClientRect();return r.top>=box.top&&r.bottom<=box.bottom});const s=document.getElementById('dailyScroller'),left=s.getBoundingClientRect().left;const first=Array.from(s.querySelectorAll('[data-daily-date]')).find(c=>c.getBoundingClientRect().left>=left-1);const saved={top:sheetBodyEl.scrollTop,id:row.dataset.id,anchor:first.dataset.dailyDate,offset:first.getBoundingClientRect().left-left};row.click();return saved})()`);
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
    await sleep(180);
    const forward = await ev(monthState);
    await ev("document.querySelector('[data-action=daily-prev]').click()");
    await sleep(180);
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
    const closed = await ev(`(()=>{const s=document.getElementById('dailyScroller'),left=s.getBoundingClientRect().left;const first=Array.from(s.querySelectorAll('[data-daily-date]')).find(c=>c.getBoundingClientRect().left>=left-1);return {hidden:overlayEl.hidden,anchor:first.dataset.dailyDate,offset:first.getBoundingClientRect().left-left,focus:document.activeElement.dataset.dailyDate}})()`);
    check(`V-002 ${size.width}x${size.height} closing list restores calendar position and focus`, closed.hidden && closed.anchor === saved.anchor && Math.abs(closed.offset - saved.offset) < 1 && closed.focus === fixture.bulk, { saved, closed });
  }
  await openBulk();
  let saved = await enterScrolledDetail();
  await waitFor(b, "sheetStack.at(-1)?.dailyKind==='detail'&&Pandora.idle()");
  await ev("document.querySelector('[data-action=daily-edit]').click();document.getElementById('daily-body').value='unsaved repair regression draft'");
  await key('Escape');
  check('V-002 cancel editing returns exactly one layer to detail and discards its draft', await ev("sheetStack.at(-1)?.dailyKind==='detail'&&sheetStack.length===2&&!drafts.daily"));
  await ev("document.querySelector('[data-action=daily-delete]').click();document.querySelector('#sheetFoot [data-action=sheet-back]').click()");
  check('V-002 cancel deletion returns to the same detail without writing', await ev(`sheetStack.at(-1)?.dailyKind==='detail'&&PandoraDaily.state.detail.raw.id===${js(saved.id)}`));
  await key('Escape');
  await assertListRestored(saved, 'V-002 Esc after edit/delete cancellation restores original list position and focus');
  const movedDate = new Date(fixture.bulk + 'T00:00:00Z');
  movedDate.setUTCDate(movedDate.getUTCDate() + 1);
  const movedKey = movedDate.toISOString().slice(0, 10);
  const countDays = `Promise.all([${js(fixture.bulk)},${js(movedKey)}].map(date=>Pandora.request('/daily-items/summary?from='+date+'&to='+date).then(r=>r.days.reduce((n,d)=>n+d.openCount+d.completedCount,0))))`;
  const countsBefore = await ev(countDays);
  saved = await enterScrolledDetail();
  await waitFor(b, "sheetStack.at(-1)?.dailyKind==='detail'&&Pandora.idle()");
  await ev(`document.querySelector('[data-action=daily-edit]').click();document.getElementById('daily-date').value=${js(movedKey)};document.querySelector('[data-action=daily-save]').click()`);
  await waitFor(b, "sheetStack.at(-1)?.dailyKind==='list'&&Pandora.idle()");
  const moved = await ev(`({date:sheetStack.at(-1)?.dailyDate,top:sheetBodyEl.scrollTop,stillListed:!!document.querySelector('[data-daily-row="${saved.id}"]'),focusVisible:!document.activeElement.closest('[hidden]')})`);
  const countsAfter = await ev(countDays);
  check('V-002 moving an item returns to the scrolled original list and refreshes both days', moved.date === fixture.bulk && moved.top === saved.top && !moved.stillListed && moved.focusVisible && countsAfter[0] === countsBefore[0] - 1 && countsAfter[1] === countsBefore[1] + 1, { moved, countsBefore, countsAfter });
  await ev("overlayEl.click()");
  check('V-002 clicking the backdrop closes the list and restores calendar focus', await ev(`overlayEl.hidden&&document.activeElement.dataset.dailyDate===${js(fixture.bulk)}`));

  async function login(identity) {
    await ev(`document.getElementById('login-user').value=${js(fixture.identities[identity].identifier)};document.getElementById('login-password').value='Fixture@123456';document.getElementById('backend-login').requestSubmit()`);
    if (!await waitFor(b, `Pandora.ready&&Pandora.idle()&&Pandora.data.me.id===${js(fixture.identities[identity].id)}`, 20000)) throw Error('login failed: ' + identity);
  }
  const clearedState = `(()=>{const s=PandoraDaily.state;return {lists:s.lists.size,summaries:s.summaries.size,account:s.account,organization:s.organization,epoch:s.epoch,blocks:s.blocks.length,detail:s.detail,draft:drafts.daily,selected:s.selected,anchor:s.anchor,stack:sheetStack.length}})()`;
  function isCleared(s) {
    return !s.lists && !s.summaries && s.account === null && s.organization === null && s.epoch === -1 && !s.blocks && !s.detail && !s.draft && !s.selected && !s.anchor && !s.stack;
  }
  for (const [mode, delayed] of [['logout', 'list'], ['401', 'detail'], ['switch-organization', 'summary']]) {
    await openBulk();
    await ev("document.querySelector('#sheetBody [data-action=daily-open]').click()");
    await waitFor(b, "sheetStack.at(-1)?.dailyKind==='detail'&&Pandora.idle()");
    await ev("document.querySelector('[data-action=daily-edit]').click()");
    check(`V-004 ${mode} starts with private caches and an edit draft`, await ev("PandoraDaily.state.lists.size>0&&PandoraDaily.state.summaries.size>0&&!!drafts.daily?.body"));
    // Hold genuine API responses after receipt so even an already-delivered callback
    // must pass the module's session guard when it is released after teardown.
    await ev(`window.repairHeld=[];window.repairRequest=Pandora.request;Pandora.request=async function(path,options){const result=await window.repairRequest(path,options);if(${delayed === 'list' ? "path.startsWith('/daily-items?')" : delayed === 'detail' ? "/^\\/daily-items\\/[^/?]+$/.test(path)&&!path.includes('summary')" : "path.startsWith('/daily-items/summary?')"})await new Promise(resolve=>window.repairHeld.push(resolve));return result}`);
    if (delayed === 'list') await ev(`PandoraDaily.openList('2035-07-11')`);
    else if (delayed === 'detail') await ev(`runAction(document.querySelector('#sheetFoot [data-action=sheet-back]'));runAction(document.querySelector('#sheetFoot [data-action=sheet-back]'));document.querySelector('#sheetBody [data-action=daily-open]').click()`);
    else await locate('2035-07');
    check(`V-004 a real ${delayed} response is held before ${mode}`, await waitFor(b, "window.repairHeld.length>0"));
    if (mode === 'logout') await ev('Pandora.logout()');
    else if (mode === '401') {
      const status = await ev(`(async()=>{await fetch('/api/v1/auth/sessions/current',{method:'DELETE',headers:{Authorization:'Bearer '+Pandora.token}});try{await Pandora.request('/auth/session')}catch(e){return e.status}})()`);
      check('V-004 a genuinely revoked server session triggers HTTP 401', status === 401, status);
    } else await ev('Pandora.reLogin()');
    let cleared = await ev(clearedState);
    check(`V-004 ${mode} immediately clears all daily caches, draft and account state`, isCleared(cleared), cleared);
    if (mode === 'switch-organization') {
      await ev('Pandora.request=window.repairRequest');
      await login('other-founder');
    }
    await ev('Pandora.request=window.repairRequest;window.repairHeld.splice(0).forEach(resolve=>resolve())');
    await sleep(250);
    if (mode === 'switch-organization') {
      const current = await ev(`(async()=>({account:PandoraDaily.state.account,organization:(await Pandora.request('/auth/session')).organizationId,lists:PandoraDaily.state.lists.size,counts:Array.from(PandoraDaily.state.summaries.values()).filter(e=>e.state==='ready').flatMap(e=>Array.from(e.days.values()))}))()`);
      check('V-004 delayed old summary cannot populate a different organization', current.account === fixture.identities['other-founder'].id && current.organization === fixture.identities['other-founder'].organizationId && !current.lists && current.counts.every(c => !c.open && !c.completed), current);
      await ev('Pandora.logout()');
    } else {
      cleared = await ev(clearedState);
      check(`V-004 delayed ${delayed} cannot revive logged-out private state`, isCleared(cleared), cleared);
    }
    await waitFor(b, "!!document.getElementById('backend-login')&&Pandora.idle()");
    await login('alpha-one-employee');
  }
};
