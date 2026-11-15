'use strict';
/* Real-browser acceptance for whole-range daily-item dragging: long-press threshold, two-dimensional
   day hit, Gregorian range shift, confirmation, idempotent retry, cancellation and account switching.
   The mouse path is a real CDP input gesture; the touch path is a synthetic touch gesture, which is
   recorded as such because this machine has no real touch device. */
const { waitFor, sleep } = require('./browser_fixture');

module.exports = async function checkDailyItemsDrag(b, fixture, check, evidence) {
  const ev = b.evaluate;
  const js = value => JSON.stringify(value);
  const PANEL = `[data-daily-bar][data-id=${js(fixture.drag)}]`;

  async function loginToken(identifier) {
    const response = await fetch(fixture.base + '/auth/sessions', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ accountType: 'employee', phone: identifier, password: 'Fixture@123456' }),
    });
    return (await response.json()).token;
  }
  await b.viewport({ width: 390, height: 844, mobile: true });
  await ev("setPage('map')");
  await sleep(300);
  const token = await loginToken(fixture.identities['alpha-one-employee'].identifier);
  async function raw(id) {
    const response = await fetch(fixture.base + '/daily-items/' + encodeURIComponent(id), { headers: { Authorization: 'Bearer ' + token } });
    return response.json();
  }
  function dayNumber(key) { return Math.floor(Date.parse(key + 'T00:00:00Z') / 86400000); }
  function shiftKey(key, days) { return new Date((dayNumber(key) + days) * 86400000).toISOString().slice(0, 10); }

  async function barPoint(selector) {
    return ev(`(()=>{const bar=document.querySelector(${js(selector)});if(!bar)return null;
      bar.scrollIntoView({block:'center'});const r=bar.getBoundingClientRect(),week=bar.closest('.daily-week'),days=week.querySelector('.daily-days').getBoundingClientRect();
      const start=Number(bar.dataset.startCol),end=Number(bar.dataset.endCol);
      const col=Math.max(start,Math.min(end-1,Math.floor((r.x+r.width/2-days.left)/(days.width/7))));
      return {x:r.x+r.width/2,y:r.y+r.height/2,weekStart:week.dataset.weekStart,col,
        grabKey:toDateInput(addDays(parseDateInput(week.dataset.weekStart),col)),unit:days.width/7}})()`);
  }
  async function cellPoint(key) {
    return ev(`(()=>{const cell=document.querySelector('[data-daily-date=${js(key)}]');if(!cell)return null;
      cell.scrollIntoView({block:'center'});const r=cell.getBoundingClientRect();
      return {x:r.x+r.width/2,y:r.y+r.height/2}})()`);
  }
  async function prepare() {
    await ev(`PandoraDaily.goToDate(${js(fixture.today)})`);
    await sleep(600);
    return waitFor(b, `!!document.querySelector(${js(PANEL)})`, 12000);
  }
  async function pressAt(point) {
    await b.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: point.x, y: point.y });
    await b.send('Input.dispatchMouseEvent', { type: 'mousePressed', x: point.x, y: point.y, button: 'left', clickCount: 1 });
  }
  async function moveAt(point) {
    await b.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: point.x, y: point.y, button: 'left', buttons: 1 });
  }
  async function releaseAt(point) {
    await b.send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: point.x, y: point.y, button: 'left', clickCount: 1 });
  }
  async function installFetchProbe() {
    await ev(`(()=>{window.__dragWrites=[];window.__dragFail=null;window.__dragFetch=window.__dragFetch||window.fetch;
      window.fetch=async function(url,opts){const target=String(url)==='/api/v1/daily-items/'+${js(fixture.drag)}&&opts&&String(opts.method).toUpperCase()==='PATCH';
        if(target)window.__dragWrites.push(new Headers(opts.headers).get('Idempotency-Key'));
        if(target&&window.__dragFail==='network')throw new TypeError('simulated network failure');
        const response=await window.__dragFetch(url,opts);
        if(target&&window.__dragFail==='after')throw new TypeError('simulated response loss after server commit');
        return response}})()`);
  }

  check('the ranged demo item is present in the calendar', await prepare());
  const original = await raw(fixture.drag);
  const span = dayNumber(original.endDate) - dayNumber(original.startDate);

  /* -------- ordinary short tap still opens the hit day list -------- */
  const tap = await barPoint(PANEL);
  await pressAt(tap);
  await sleep(120);
  await releaseAt(tap);
  await sleep(500);
  const tapState = await ev("({gesture:Pandora.dailyGesture(),overlay:document.getElementById('overlay').hidden,title:document.getElementById('sheetTitle').textContent,page:state.page,error:document.getElementById('daily-list-error')?.textContent||null,notice:document.getElementById('appNotice').textContent})");
  check('a short press still opens the hit day list instead of dragging',
    await waitFor(b, "Pandora.idle()&&!document.getElementById('overlay').hidden&&document.getElementById('sheetTitle').textContent.includes('每日事项')", 12000) &&
    !(await ev("Pandora.dailyGesture().dragging")), { tap, tapState });
  await ev("document.getElementById('sheetClose').click()");
  await waitFor(b, "document.getElementById('overlay').hidden");

  /* -------- long press threshold and zero-movement release -------- */
  await prepare();
  await installFetchProbe();
  const beforeZero = (await raw(fixture.drag)).rowVersion;
  const zeroPoint = await barPoint(PANEL);
  await pressAt(zeroPoint);
  await sleep(300);
  check('no drag ghost exists before the long-press threshold', !(await ev("!!document.querySelector('.p-daily-drag-ghost')")));
  await sleep(400);
  const activated = await ev("Pandora.dailyGesture()");
  check('holding the whole bar for about half a second activates the drag without an endpoint handle',
    activated.dragging === true, activated);
  check('the active drag paints a whole-bar ghost and a target day',
    await ev("!!document.querySelector('.p-daily-drag-ghost')&&!!document.querySelector('.daily-cell.is-drop-target')"));
  await releaseAt(zeroPoint);
  await sleep(400);
  const zero = await ev("({sheet:!document.getElementById('overlay').hidden,ghost:!!document.querySelector('.p-daily-drag-ghost'),move:Pandora.dailyGesture().move,writes:window.__dragWrites.length})");
  check('a zero-movement long press saves nothing and opens no confirmation',
    !zero.sheet && !zero.ghost && zero.move === null && zero.writes === 0 && (await raw(fixture.drag)).rowVersion === beforeZero, zero);

  /* -------- scrolling before the threshold stays ordinary scrolling -------- */
  await prepare();
  const scrollFrom = await barPoint(PANEL);
  const scrollBefore = await raw(fixture.drag);
  await pressAt(scrollFrom);
  await sleep(200);
  await ev(`(()=>{const s=document.getElementById('dailyScroller');s.scrollTop+=60;s.dispatchEvent(new Event('scroll'))})()`);
  await moveAt({ x: scrollFrom.x, y: scrollFrom.y + 14 });
  await sleep(150);
  const scrolled = await ev("({ghost:!!document.querySelector('.p-daily-drag-ghost'),dragging:Pandora.dailyGesture().dragging,top:document.getElementById('dailyScroller').scrollTop})");
  await releaseAt({ x: scrollFrom.x, y: scrollFrom.y + 14 });
  await sleep(400);
  check('moving or scrolling before the threshold never activates a drag or changes a date',
    !scrolled.ghost && scrolled.dragging === false && scrolled.top > 0 &&
    (await raw(fixture.drag)).rowVersion === scrollBefore.rowVersion, scrolled);
  await ev("document.getElementById('sheetClose')?.click()");
  await sleep(200);

  /* -------- real mouse drag from the middle segment, confirm, persist, refresh -------- */
  await prepare();
  const dragStart = await barPoint(PANEL);
  const targetColumn = dragStart.col >= 3 ? dragStart.col - 2 : dragStart.col + 2;
  const targetKey = shiftKey(dragStart.grabKey, targetColumn - dragStart.col);
  const targetPoint = await cellPoint(targetKey);
  check('a 3-day ranged item exposes a middle-segment grab and a same-week target', !!targetPoint, { dragStart, targetKey });
  const anchorBefore = await ev("Math.round(document.getElementById('dailyScroller').scrollTop)");
  await pressAt(dragStart);
  await sleep(650);
  await moveAt(targetPoint);
  await sleep(200);
  const moving = await ev("Pandora.dailyGesture()");
  check('the two-dimensional target is a real date and the whole range previews the shift',
    moving.dragging === true && moving.target === targetKey && moving.delta === targetColumn - dragStart.col &&
    await ev("!!document.querySelector('.daily-cell.is-drop-target')"), { moving, targetKey });
  await releaseAt(targetPoint);
  await sleep(400);
  const confirmation = await ev(`(()=>{const sheet=document.getElementById('overlay');
    return {open:!sheet.hidden,title:document.getElementById('sheetTitle').textContent,
      move:Pandora.dailyGesture().move,body:document.getElementById('sheetBody').textContent,
      writes:window.__dragWrites.length}})()`);
  check('releasing shows the old and new ranges and asks for confirmation before writing',
    confirmation.open && confirmation.move && confirmation.move.oldStart === original.startDate &&
    confirmation.move.oldEnd === original.endDate && confirmation.body.includes('调整后') && confirmation.writes === 0, confirmation);
  await ev("document.querySelector('[data-action=daily-move-confirm]').click()");
  check('confirming saves the shifted range and returns to the calendar',
    await waitFor(b, "Pandora.idle()&&document.getElementById('overlay').hidden", 20000));
  const moved = await raw(fixture.drag);
  const expectedDelta = targetColumn - dragStart.col;
  check('the complete range moves by the Gregorian day difference and keeps its span, body and completion',
    moved.startDate === shiftKey(original.startDate, expectedDelta) && moved.endDate === shiftKey(original.endDate, expectedDelta) &&
    dayNumber(moved.endDate) - dayNumber(moved.startDate) === span && moved.body === original.body && moved.completed === original.completed,
    { before: original, after: moved, expectedDelta });
  check('a successful drag keeps the browse anchor instead of jumping to the target day',
    Math.abs((await ev("Math.round(document.getElementById('dailyScroller').scrollTop)")) - anchorBefore) <= 2,
    { anchorBefore });
  await b.send('Page.reload', { ignoreCache: true });
  check('the reloaded page still shows the moved range', await waitFor(b, "Pandora.ready&&Pandora.idle()&&!!document.getElementById('dailyScroller')", 25000) &&
    (await raw(fixture.drag)).startDate === moved.startDate, moved);

  /* -------- cancel and Escape write nothing -------- */
  await prepare();
  const afterMove = await raw(fixture.drag);
  const cancelDragFrom = await barPoint(PANEL);
  const cancelTargetKey = shiftKey(cancelDragFrom.grabKey, cancelDragFrom.col >= 3 ? -1 : 1);
  const cancelTarget = await cellPoint(cancelTargetKey);
  await pressAt(cancelDragFrom);
  await sleep(650);
  await moveAt(cancelTarget);
  await sleep(150);
  await releaseAt(cancelTarget);
  await sleep(350);
  await ev("document.querySelector('[data-action=daily-move-cancel]').click()");
  await sleep(400);
  check('cancelling the confirmation restores the calendar without a write',
    await ev("document.getElementById('overlay').hidden") && (await raw(fixture.drag)).rowVersion === afterMove.rowVersion &&
    (await raw(fixture.drag)).startDate === afterMove.startDate, afterMove);
  const escapeFrom = await barPoint(PANEL);
  const escapeTarget = await cellPoint(shiftKey(escapeFrom.grabKey, escapeFrom.col >= 3 ? -1 : 1));
  await pressAt(escapeFrom);
  await sleep(650);
  await moveAt(escapeTarget);
  await sleep(150);
  await b.send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27 });
  await sleep(300);
  check('Escape cancels the temporary drag state with no ghost, confirmation or write',
    !(await ev("!!document.querySelector('.p-daily-drag-ghost')")) &&
    await ev("document.getElementById('overlay').hidden&&!Pandora.dailyGesture().dragging") &&
    (await raw(fixture.drag)).rowVersion === afterMove.rowVersion);
  await releaseAt(escapeTarget);
  await sleep(250);

  /* -------- network failure, retry with the same idempotency key -------- */
  await prepare();
  const beforeRetry = await raw(fixture.drag);
  const retryFrom = await barPoint(PANEL);
  const retryDelta = retryFrom.col >= 3 ? -1 : 1;
  const retryTarget = await cellPoint(shiftKey(retryFrom.grabKey, retryDelta));
  await ev("window.__dragFail='network'");
  await pressAt(retryFrom);
  await sleep(650);
  await moveAt(retryTarget);
  await sleep(150);
  await releaseAt(retryTarget);
  await sleep(350);
  await ev("document.querySelector('[data-action=daily-move-confirm]').click()");
  check('a network failure keeps the confirmation open with a visible retry message',
    await waitFor(b, "Pandora.idle()&&!document.getElementById('overlay').hidden&&!document.getElementById('daily-move-error').hidden", 20000), 
    await ev("document.getElementById('daily-move-error').textContent"));
  check('the failed attempt did not change the stored range', (await raw(fixture.drag)).rowVersion === beforeRetry.rowVersion);
  await ev("window.__dragFail=null;document.querySelector('[data-action=daily-move-confirm]').click()");
  check('retrying the same operation saves exactly one shift', await waitFor(b, "Pandora.idle()&&document.getElementById('overlay').hidden", 20000));
  const retried = await raw(fixture.drag);
  const retriedKeys = await ev("window.__dragWrites");
  check('the retry reused the same idempotency key and applied the target once',
    retriedKeys.length === 2 && retriedKeys[0] === retriedKeys[1] &&
    retried.startDate === shiftKey(beforeRetry.startDate, retryDelta) &&
    retried.endDate === shiftKey(beforeRetry.endDate, retryDelta) && retried.rowVersion === beforeRetry.rowVersion + 1,
    { retriedKeys, before: beforeRetry, after: retried });

  /* -------- response loss: the committed write is replayed, never shifted twice -------- */
  await prepare();
  const beforeLoss = await raw(fixture.drag);
  const lossFrom = await barPoint(PANEL);
  const lossDelta = lossFrom.col >= 3 ? -1 : 1;
  const lossTarget = await cellPoint(shiftKey(lossFrom.grabKey, lossDelta));
  await ev("window.__dragWrites=[];window.__dragFail='after'");
  await pressAt(lossFrom);
  await sleep(650);
  await moveAt(lossTarget);
  await sleep(150);
  await releaseAt(lossTarget);
  await sleep(350);
  await ev("document.querySelector('[data-action=daily-move-confirm]').click()");
  check('response loss shows the recoverable error instead of silently succeeding',
    await waitFor(b, "Pandora.idle()&&!document.getElementById('daily-move-error').hidden", 20000));
  const committed = await raw(fixture.drag);
  check('the server had already applied the move exactly once',
    committed.startDate === shiftKey(beforeLoss.startDate, lossDelta) && committed.rowVersion === beforeLoss.rowVersion + 1,
    { before: beforeLoss, committed });
  await ev("window.__dragFail=null;document.querySelector('[data-action=daily-move-confirm]').click()");
  check('retrying after response loss closes the sheet without a second shift',
    await waitFor(b, "Pandora.idle()&&document.getElementById('overlay').hidden", 20000));
  const replayed = await raw(fixture.drag);
  const lossKeys = await ev("window.__dragWrites");
  check('the replayed request kept the same key and the same absolute target range',
    lossKeys.length === 2 && lossKeys[0] === lossKeys[1] && replayed.startDate === committed.startDate &&
    replayed.endDate === committed.endDate && replayed.rowVersion === committed.rowVersion,
    { lossKeys, committed, replayed });

  /* -------- a stale version is reported and never overwritten -------- */
  await prepare();
  const staleFrom = await barPoint(PANEL);
  const staleTarget = await cellPoint(shiftKey(staleFrom.grabKey, staleFrom.col >= 3 ? -1 : 1));
  await pressAt(staleFrom);
  await sleep(650);
  await moveAt(staleTarget);
  await sleep(150);
  await releaseAt(staleTarget);
  await sleep(350);
  const beforeConflict = await raw(fixture.drag);
  const serverVersion = beforeConflict.rowVersion;
  const concurrent = await fetch(fixture.base + '/daily-items/' + encodeURIComponent(fixture.drag), {
    method: 'PATCH', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token,
      'Idempotency-Key': 'concurrent-' + Date.now() + '-' + Math.random().toString(16).slice(2), 'If-Match': '"' + serverVersion + '"' },
    body: JSON.stringify({ body: '并发修改后的正文' }) });
  check('a concurrent owner write is accepted by the real API', concurrent.status === 200, concurrent.status);
  await ev("document.querySelector('[data-action=daily-move-confirm]').click()");
  check('a version conflict is reported and the sheet keeps the draft visible',
    await waitFor(b, "Pandora.idle()&&!document.getElementById('overlay').hidden&&!document.getElementById('daily-move-error').hidden", 20000));
  const conflicted = await raw(fixture.drag);
  check('the conflict did not overwrite the newer version or shift the range',
    conflicted.body === '并发修改后的正文' && conflicted.rowVersion === serverVersion + 1 &&
    conflicted.startDate === beforeConflict.startDate && conflicted.endDate === beforeConflict.endDate,
    { beforeConflict, conflicted });
  await ev("document.querySelector('[data-action=daily-move-cancel]').click()");
  await waitFor(b, "document.getElementById('overlay').hidden");

  /* -------- synthetic touch path (no real touch device on this machine) -------- */
  await prepare();
  await b.send('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 5 });
  await sleep(250);
  const touchFrom = await barPoint(PANEL);
  const touchTarget = await cellPoint(shiftKey(touchFrom.grabKey, touchFrom.col >= 3 ? -1 : 1));
  const touchAt = (type, x, y) => b.send('Input.dispatchTouchEvent', { type, touchPoints: type === 'touchEnd' ? [] : [{ x, y, id: 0 }] });
  const beforeTouch = await raw(fixture.drag);
  await touchAt('touchStart', touchFrom.x, touchFrom.y);
  await sleep(700);
  await touchAt('touchMove', touchTarget.x, touchTarget.y);
  await sleep(200);
  check('a synthetic long touch activates the same whole-bar drag', await ev("Pandora.dailyGesture().dragging===true&&!!document.querySelector('.p-daily-drag-ghost')"));
  await touchAt('touchEnd', touchTarget.x, touchTarget.y);
  await sleep(350);
  check('the touch drag asks for the same confirmation without writing yet',
    await ev("!document.getElementById('overlay').hidden&&!!Pandora.dailyGesture().move") && (await raw(fixture.drag)).rowVersion === beforeTouch.rowVersion);
  await ev("document.querySelector('[data-action=daily-move-cancel]').click()");
  await waitFor(b, "document.getElementById('overlay').hidden");
  await b.send('Emulation.setTouchEmulationEnabled', { enabled: false });
  await sleep(200);

  /* -------- logging out cancels an active drag and keeps the new session clean -------- */
  await prepare();
  const logoutFrom = await barPoint(PANEL);
  await pressAt(logoutFrom);
  await sleep(650);
  await moveAt(await cellPoint(shiftKey(logoutFrom.grabKey, 1)));
  await sleep(150);
  check('a drag is active before the account switch', await ev("Pandora.dailyGesture().dragging===true"));
  await ev("Pandora.logout()");
  await sleep(600);
  check('logging out clears the temporary drag, ghost and confirmation without a write',
    !(await ev("!!document.querySelector('.p-daily-drag-ghost')")) &&
    await ev("!Pandora.dailyGesture().dragging&&Pandora.dailyGesture().move===null&&document.getElementById('overlay').hidden") &&
    (await raw(fixture.drag)).rowVersion === beforeTouch.rowVersion);
  await releaseAt(logoutFrom);
  await sleep(200);
  evidence('drag-states', { original, moved, retried, replayed, conflicted });
  /* Sign the same real employee back in so the surrounding suite keeps its session. */
  const loginReady = await waitFor(b, "!!document.getElementById('backend-login')", 20000);
  if (loginReady) {
    await ev(`document.getElementById('login-user').value=${js(fixture.identities['alpha-one-employee'].identifier)};document.getElementById('login-password').value='Fixture@123456';document.getElementById('backend-login').requestSubmit()`);
  }
  check('the same real employee can sign back in after the drag was cancelled',
    await waitFor(b, `Pandora.ready&&Pandora.idle()&&Pandora.data.me.id===${js(fixture.identities['alpha-one-employee'].id)}`, 25000));
  await ev("setPage('map')");
  await sleep(300);
};
