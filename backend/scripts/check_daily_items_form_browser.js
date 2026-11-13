'use strict';
const { waitFor, sleep } = require('./browser_fixture');

// V-002: removing product-explanation copy must preserve the shared create/edit form contract.
module.exports = async function checkDailyItemForm(b, fixture, check) {
  const ev = b.evaluate, js = JSON.stringify;
  const hint = '每日事项仅本人可见，可填写过去、今天或未来的日期，最多 2000 字。';
  const cleanForm = () => ev(`(()=>{const body=document.getElementById('sheetBody');
    return !body.textContent.includes(${js(hint)})&&!!body.querySelector('#daily-start-date')&&!!body.querySelector('#daily-end-date')&&
      body.querySelector('#daily-body')?.maxLength===2000&&!!document.querySelector('[data-action=daily-save]')})()`);
  const close = () => ev("document.getElementById('sheetClose').click()");
  const save = () => ev("document.querySelector('[data-action=daily-save]').click()");
  const idle = () => waitFor(b, 'Pandora.idle()');
  const usable = () => ev(`(()=>{const save=document.querySelector('[data-action=daily-save]'),
    close=document.getElementById('sheetClose'),body=document.getElementById('daily-body');
    return [save,close].every(e=>{const r=e.getBoundingClientRect();return r.width>0&&r.height>0&&r.top>=0&&r.bottom<=innerHeight})&&
      body.getBoundingClientRect().width>0&&document.documentElement.scrollWidth<=innerWidth+1})()`);
  for (const width of [320, 390, 1440]) {
    await b.viewport({ width, height: width === 1440 ? 900 : 844, mobile: width < 1000 });
    await sleep(200);
    const date = `2042-08-${width === 320 ? '17' : width === 390 ? '18' : '19'}`;
    const body = 'form repair ' + width;
    await ev("document.querySelector('.daily-add').focus();document.querySelector('.daily-add').click()");
    check(`header create at ${width}px has only the necessary form controls and no explanation`, await cleanForm() && await usable());
    await close();
    check(`header create cancellation at ${width}px restores the add control focus`,
      await ev("overlayEl.hidden&&document.activeElement.classList.contains('daily-add')"));
    await ev("document.querySelector('.daily-add').click()");
    if (width === 390) {
      for (const [label, input, text, expected] of [
        ['blank content', fixture.today, '   ', '请填写内容'],
        ['invalid date', '2023-02-29', 'draft', '有效的公历起止日期'],
        ['overlong content', fixture.today, '字'.repeat(2001), '2000'],
      ]) {
        await ev(`document.getElementById('daily-start-date').value=${js(input)};document.getElementById('daily-end-date').value=${js(input)};document.getElementById('daily-body').value=${js(text)}`);
        await save();
        check(`${label} still produces the original error without discarding the form`,
          await waitFor(b, `!document.getElementById('daily-form-error').hidden&&
            document.getElementById('daily-form-error').textContent.includes(${js(expected)})&&Pandora.idle()`) &&
          await ev(`document.getElementById('daily-body').value===${js(text)}&&!overlayEl.hidden`));
      }
    }
    await ev(`document.getElementById('daily-start-date').value=${js(date)};document.getElementById('daily-end-date').value=${js(date)};document.getElementById('daily-body').value=${js(body)}`);
    await save();
    check(`header create saves at ${width}px and restores focus`,
      await waitFor(b, "overlayEl.hidden&&Pandora.idle()") &&
      await ev("document.activeElement.classList.contains('daily-add')"));
    const item = await ev(`Pandora.request('/daily-items?date=${date}').then(r=>r.items.find(i=>i.body===${js(body)}))`);
    check(`header create at ${width}px persisted the selected date and content`, item?.startDate === date && item?.endDate === date, item);

    // A separate empty date checks the other create entry without affecting the suite's seed days.
    const empty = date.slice(0, 8) + String(Number(date.slice(8)) + 10);
    await ev(`PandoraDaily.goToDate(${js(empty)});document.querySelector('[data-daily-date="${empty}"]').focus();
      document.querySelector('[data-daily-date="${empty}"]').click()`);
    check(`empty date list at ${width}px is ready`, await waitFor(b, "sheetStack.at(-1)?.dailyKind==='list'&&Pandora.idle()"));
    await ev("document.querySelector('#sheetFoot [data-action=daily-new]').click()");
    check(`empty-day create at ${width}px omits the explanation and keeps the date`,
      await cleanForm() && await usable() && await ev(`document.getElementById('daily-start-date').value===${js(empty)}&&document.getElementById('daily-end-date').value===${js(empty)}`));
    await close();
    check(`empty-day create cancellation at ${width}px restores visible date focus`,
      await ev(`overlayEl.hidden&&document.activeElement.dataset.dailyDate===${js(empty)}`));

    await ev(`PandoraDaily.goToDate(${js(date)});document.querySelector('[data-daily-date="${date}"]').click()`);
    await waitFor(b, "sheetStack.at(-1)?.dailyKind==='list'&&Pandora.idle()");
    await ev(`document.querySelector('[data-action=daily-open][data-id="${item.id}"]').click()`);
    await waitFor(b, "sheetStack.at(-1)?.dailyKind==='detail'&&Pandora.idle()");
    await ev("document.querySelector('[data-action=daily-edit]').click()");
    check(`edit at ${width}px also omits the explanation and keeps usable controls`, await cleanForm() && await usable());
    await ev("document.querySelector('#sheetFoot [data-action=sheet-back]').click()");
    check(`edit cancellation at ${width}px returns to detail`, await ev("sheetStack.at(-1)?.dailyKind==='detail'&&!drafts.daily"));
    await ev(`document.querySelector('[data-action=daily-edit]').click();document.getElementById('daily-body').value=${js(body + ' edited')}`);
    await save();
    check(`edit saves at ${width}px and returns to the list with visible focus`,
      await waitFor(b, "sheetStack.at(-1)?.dailyKind==='list'&&Pandora.idle()") &&
      await ev(`Pandora.request('/daily-items/${item.id}').then(i=>i.body===${js(body + ' edited')})`) &&
      await ev("!document.activeElement.closest('[hidden]')"));
    await close();
    await idle();
  }
  await b.viewport({ width: 390, height: 844, mobile: true });
  await ev("document.querySelector('[data-action=daily-today]').click()");
};
