"use strict";
const assert = require("node:assert/strict");
const { openBrowser, waitFor, sleep } = require("./browser_fixture");

const base = process.argv[2];
const password = process.env.PANDORA_DEMO_PASSWORD || "Demo@123456";
async function run(width, height, phone) {
  const browser = await openBrowser(base, { width, height, mobile: width < 600 });
  const evaluate = source => browser.evaluate(source);
  const exists = selector => "document.querySelector(" + JSON.stringify(selector) + ")";
  const wait = async source => assert(await waitFor(browser, source, 25000), source);
  const click = async selector => {
    await wait("Pandora.idle() && !!" + exists(selector));
    await evaluate(exists(selector) + ".focus({preventScroll:true});" + exists(selector) + ".click()");
  };
  try {
    await wait("!!document.getElementById('backend-login')");
    await evaluate(`document.getElementById('login-user').value=${JSON.stringify(phone)};
      document.getElementById('login-password').value=${JSON.stringify(password)};
      document.getElementById('backend-login').requestSubmit()`);
    await wait("Pandora.ready && !!document.querySelector('#dailyScroller .daily-mark')");
    assert(await evaluate(`(() => {
      const calendar=document.querySelector('#dailyScroller');
      return calendar.scrollHeight>calendar.clientHeight && calendar.scrollWidth<=calendar.clientWidth &&
        calendar.querySelector('.p-weekday-row').children.length===7 &&
        document.querySelector('.workday-tenure').textContent.includes('天');
    })()`));
    if (process.env.PANDORA_SCREENSHOTS) await browser.screenshot(process.env.PANDORA_SCREENSHOTS + "/home-" + width + ".png");
    await click('#dailyScroller [data-daily-date].is-today');
    await wait("document.getElementById('sheetTitle').textContent.includes('每日事项')");
    await click("#sheetClose");
    const firstMonth = await evaluate("document.querySelector('#dailyScroller [data-month-key]').dataset.monthKey");
    await evaluate("document.querySelector('#dailyScroller').scrollTop=0");
    await wait("document.querySelector('#dailyScroller [data-month-key]').dataset.monthKey<" + JSON.stringify(firstMonth));
    const position = await evaluate("Pandora.calendar.monthAnchor(document.querySelector('#dailyScroller')).key");
    await click('#page-map [data-action="p-home-event"]');
    await wait("document.querySelector('#sheet.is-fullscreen .home-event-body')?.textContent.includes('试点客户')");
    assert(await evaluate("document.querySelector('.home-event-meta').textContent.includes('发布于')"));
    if (process.env.PANDORA_SCREENSHOTS) await browser.screenshot(process.env.PANDORA_SCREENSHOTS + "/event-" + width + ".png");
    await click('.home-event-related [data-action="p-home-event"]');
    await wait("document.getElementById('sheetTitle').textContent==='上线验收口径'");
    assert(await evaluate("sheetStack.length===1 && document.querySelector('.home-event-body').textContent.includes('关键路径')"));
    await click("#sheetClose");
    assert.equal(await evaluate("Pandora.calendar.monthAnchor(document.querySelector('#dailyScroller')).key"), position);
    await click('#page-map .home-task');
    await wait("document.querySelector('#sheet.is-fullscreen .home-task-overview')?.textContent.includes('最近更新')");
    assert(await evaluate("document.querySelector('.home-task-overview').textContent.includes('派发给我的时间') && document.getElementById('sheetBody').textContent.includes('任务说明')"));
    if (process.env.PANDORA_SCREENSHOTS) await browser.screenshot(process.env.PANDORA_SCREENSHOTS + "/task-" + width + ".png");
    await click("#sheetClose");
    await click('[data-page="view"]');
    await wait("!!document.querySelector('#page-view .p-month-view')");
    const businessDate = await evaluate("Pandora.data.home.businessDate");
    await evaluate("Pandora.calendar.resetStream(parseDateInput('2027-01-01'));state.viewAnchor=parseDateInput('2027-01-01');renderAll()");
    await wait("!!document.querySelector('#page-view [data-date=\"2027-01-01\"] .is-holiday')");
    assert(await evaluate("document.querySelector('#page-view [data-date=\"2027-01-01\"] .is-holiday').textContent.includes('元旦')"));
    assert(await evaluate("!!document.querySelector('#page-view [data-date=\"2027-01-31\"] .is-workday')"));
    await evaluate("state.viewAnchor=parseDateInput('2027-01-31');state.viewMode='day';renderAll()");
    await wait("document.querySelector('.p-day-view-heading .is-workday')?.textContent.includes('春节')");
    await evaluate("state.viewMode='month'");
    await evaluate("state.viewAnchor=parseDateInput(" + JSON.stringify(businessDate) + ");Pandora.calendar.resetStream(state.viewAnchor);renderAll()");
    if (width===390 && phone.endsWith("04")) {
      await browser.send("Emulation.setTouchEmulationEnabled", {enabled:true,maxTouchPoints:2});
      const origin = await evaluate(`(() => {
        const selector='#page-view .p-month-event:not([hidden]) [data-schedule-move]';
        const handle=[...document.querySelectorAll(selector)].find(node=>node.closest('.p-month-event').title.includes('验证客户开通'));
        handle.scrollIntoView({block:'center',inline:'nearest'});
        const r=handle.getBoundingClientRect(), scroller=handle.closest('.p-month-scroll'), box=scroller.getBoundingClientRect();
        window.hapticCount=0;
        Object.defineProperty(navigator,'vibrate',{configurable:true,value:()=>{window.hapticCount++;return true;}});
        return {x:Math.round((r.left+r.right)/2),y:Math.round((r.top+r.bottom)/2),bottom:Math.round(box.bottom),scroll:scroller.scrollTop, month:handle.closest(".p-month-section").dataset.monthKey};
      })()`);
      const touch = (type, points) => browser.send("Input.dispatchTouchEvent", {type,touchPoints:points});
      await touch("touchStart", [{x:origin.x,y:origin.y}]);
      await wait("!!document.querySelector('.p-drag-ghost') && window.hapticCount===1");
      await touch("touchMove", [{x:origin.x,y:origin.bottom-10}]);
      await wait("document.querySelector('#page-view .p-month-scroll').scrollTop>"+(origin.scroll+12));
      await wait(`(() => {
        const week=document.elementFromPoint(${origin.x},${origin.bottom-10})?.closest('.p-month-week');
        return !!week && week.closest('.p-month-section').dataset.monthKey>${JSON.stringify(origin.month)};
      })()`);
      await touch("touchCancel", []);
      await wait("!document.querySelector('.p-drag-ghost') && overlayEl.hidden");
      await evaluate("Object.defineProperty(navigator,'vibrate',{configurable:true,value:undefined})");
      const point=await evaluate(`(() => {
        const handle=[...document.querySelectorAll('#page-view .p-month-event:not([hidden]) [data-schedule-move]')].find(node=>node.closest('.p-month-event').title.includes('验证客户开通'));
        handle.scrollIntoView({block:'center',inline:'nearest'});
        const r=handle.getBoundingClientRect();
        return {x:Math.round((r.left+r.right)/2),y:Math.round((r.top+r.bottom)/2)};
      })()`);
      await touch("touchStart",[point]);
      await wait("!!document.querySelector('.p-drag-ghost') && window.hapticCount===1");
      await touch("touchMove",[{x:point.x-47,y:point.y}]);
      await touch("touchEnd",[]);
      await wait("document.getElementById('sheetTitle').textContent==='确认排期调整'");
      await click("#sheetClose");
    }
    await click('[data-page="map"]');
    assert.equal(await evaluate("Pandora.calendar.monthAnchor(document.querySelector('#dailyScroller')).key"), position);
    await click('[data-action="daily-locate"]');
    await evaluate("document.getElementById('daily-locate').value='2027-01'");
    await click('[data-action="daily-locate-save"]');
    await wait("!!document.querySelector('#dailyScroller [data-daily-date=\"2027-01-01\"] .is-holiday')");
    assert(await evaluate(`(() => {
      const makeup=document.querySelector('#dailyScroller [data-daily-date="2027-01-31"]');
      return makeup.querySelector('.is-workday') && makeup.getAttribute('aria-label').includes('调休上班') && makeup.querySelector('.daily-marks');
    })()`));
    await click('#dailyScroller [data-daily-date="2027-01-01"]');
    await wait("document.getElementById('sheetTitle').textContent.includes('每日事项')");
    await click("#sheetClose");
    if (width===1440) {
      await click('[data-action="daily-locate"]');
      await evaluate("document.getElementById('daily-locate').value='2035-01'");
      await click('[data-action="daily-locate-save"]');
      await wait("document.querySelector('#dailyScroller [data-daily-date=\"2035-01-02\"] .is-holiday')?.textContent.includes('接口验收节日')");
      await evaluate(`(() => {
        const scroller=document.querySelector('#dailyScroller');
        const date=scroller.querySelector('[data-daily-date="2035-01-02"]');
        date.focus({preventScroll:true});
        window.holidayRefreshPosition=scroller.scrollTop;
        const request=Pandora.request, now=Date.now;
        Pandora.request=(path,...args)=>path==='/holidays/2035'
          ? Promise.resolve({status:'available',days:[{date:'2035-01-02',name:'更新后节日',work:true}]})
          : request(path,...args);
        Date.now=()=>now()+301000;
        document.dispatchEvent(new Event('visibilitychange'));
        Date.now=now;
        Pandora.request=request;
      })()`);
      await wait(`(() => {
        const date=document.querySelector('#dailyScroller [data-daily-date="2035-01-02"]');
        const label=date.getAttribute('aria-label');
        return date.querySelector('.is-workday')?.textContent.includes('更新后节日') &&
          label.includes('更新后节日调休上班') && !label.includes('接口验收节日') &&
          document.activeElement===date && document.querySelector('#dailyScroller').scrollTop===window.holidayRefreshPosition;
      })()`);
    }
    await click("#bellBtn");
    await click('[data-action="p-notice-quick"][data-id="unread"]');
    await click('[data-action="p-notice-filters"]');
    await evaluate(`const category=document.getElementById('pn-category');
      category.value='review';category.dispatchEvent(new Event('change',{bubbles:true}));`);
    assert(await evaluate(`document.querySelector('[data-action="p-notice-quick"][data-id="unread"]').getAttribute('aria-pressed')==='true' &&
      document.querySelector('[data-action="p-notice-quick"][data-id="review"]').getAttribute('aria-pressed')==='true' &&
      document.getElementById('sheetBody').scrollWidth<=document.getElementById('sheetBody').clientWidth`));
    if (process.env.PANDORA_SCREENSHOTS) await browser.screenshot(process.env.PANDORA_SCREENSHOTS + "/notifications-" + width + ".png");
    await click("#sheetBack");

    if (phone.endsWith("01")) {
      await click('[data-page="me"]');
      await evaluate(`document.querySelector('[data-profile-fold="reports"]').open=true;
        for (let index=0;index<3;index++) {
          for (const node of [...document.querySelectorAll('[data-action="p-report-toggle"][aria-expanded="false"]')]) {
            document.querySelector('[data-action="p-report-toggle"][data-id="'+node.dataset.id+'"]')?.click();
          }
        }`);
      await evaluate(`[...document.querySelectorAll('[data-action="p-open-person"]')].find(node=>node.textContent.includes('张涛')).click()`);
      await wait("document.getElementById('sheetBody').textContent.includes('2024年02月29日')");
      assert(await evaluate("!document.getElementById('sheetBody').textContent.includes('组织身份')"));
      await click('[data-action="p-staff-enter"][data-tab="schedule"]');
      await wait("!!document.querySelector('#staffScheduleScroll .staff-month-event')");
      const first=await evaluate("document.querySelector('#staffScheduleScroll .p-month-section').dataset.monthKey");
      const last=await evaluate("[...document.querySelectorAll('#staffScheduleScroll .p-month-section')].at(-1).dataset.monthKey");
      await evaluate(`window.staffScheduleRequest=Pandora.request;
        let failOnce=true;
        Pandora.request=(path,...args)=>{
          if (failOnce && path.startsWith('/tasks?assigneeId=')) {
            failOnce=false;
            return Promise.reject(new Error('验收模拟读取失败'));
          }
          return window.staffScheduleRequest.call(Pandora,path,...args);
        };
        document.getElementById('staffScheduleScroll').scrollTop=0;`);
      await wait("document.querySelector('#staffScheduleScroll .p-month-section').dataset.monthKey<"+JSON.stringify(first));
      await wait("!!document.querySelector('#staffScheduleScroll [data-action=p-staff-schedule-retry]')");
      assert(await evaluate("!!document.querySelector('#staffScheduleScroll .staff-month-event')"));
      await click('#staffScheduleScroll [data-action="p-staff-schedule-retry"]');
      await wait("!document.querySelector('#staffScheduleScroll [data-action=p-staff-schedule-retry]')");
      await evaluate("Pandora.request=window.staffScheduleRequest");
      await evaluate("const staffScroller=document.getElementById('staffScheduleScroll');staffScroller.scrollTop=staffScroller.scrollHeight");
      await wait("[...document.querySelectorAll('#staffScheduleScroll .p-month-section')].at(-1).dataset.monthKey>"+JSON.stringify(last));
      assert(await evaluate(`(() => {
        const dates=[...document.querySelectorAll('#staffScheduleScroll button.staff-month-date')].map(node=>node.dataset.date);
        return new Set(dates).size===dates.length && !document.querySelector('#staffScheduleScroll [data-resize]');
      })()`));
      await click('[data-action="p-staff-today"]');
      await wait("!!document.querySelector('#staffScheduleScroll .staff-month-event')");
      const today=await evaluate("Pandora.data.home.businessDate");
      const todayCell='#staffScheduleScroll [data-action="p-staff-date"][data-date="'+today+'"]';
      await click(todayCell);
      await wait("!!document.querySelector('.staff-day-popup .staff-work-item')");
      const schedulePosition=await evaluate("Pandora.calendar.monthAnchor(document.getElementById('staffScheduleScroll')).key");
      await click('.staff-day-popup .staff-work-item');
      await wait("document.getElementById('sheetBody').textContent.includes('任务说明')");
      assert(await evaluate("!document.querySelector('#sheetFoot [data-action=edit-task]')"));
      await click("#sheetClose");
      await wait("!!document.querySelector('.staff-day-popup .staff-work-item')");
      assert.equal(await evaluate("Pandora.calendar.monthAnchor(document.getElementById('staffScheduleScroll')).key"),schedulePosition);
      await click('[data-action="p-staff-day-view"]');
      await wait("!!document.querySelector('.staff-axis-scroll')");
      await click('[data-action="p-staff-mode"][data-mode="month"]');
      await wait("!!document.querySelector('#staffScheduleScroll .staff-month-event')");
      if (process.env.PANDORA_SCREENSHOTS) await browser.screenshot(process.env.PANDORA_SCREENSHOTS + "/staff-schedule-" + width + ".png");
      await click('[data-action="p-staff-tab"][data-tab="logs"]');
      await wait("!!document.querySelector('#staffLogScroll [data-action=\"p-staff-log\"]')");
      const logMonth = await evaluate("document.querySelector('#staffLogScroll [data-month-key]').dataset.monthKey");
      await evaluate("document.querySelector('#staffLogScroll').scrollTop=0");
      await wait("document.querySelector('#staffLogScroll [data-month-key]').dataset.monthKey<" + JSON.stringify(logMonth));
      await click('[data-action="p-staff-log"]');
      await wait("document.getElementById('sheetTitle').textContent==='日志详情'");
      assert(await evaluate("!document.getElementById('sheetBody').textContent.includes('每日事项')"));
      await click("#sheetClose");
      await wait("!!document.querySelector('#staffLogScroll [data-action=\"p-staff-log\"]')");
    } else {
      await click('[data-page="view"]');
      await click('[data-action="task-table-open"]');
      await click('[data-action="task-table-next"]');
      await wait("document.querySelector('.p-table-range')?.textContent.includes('第 2/')");
      const candidate=await evaluate("document.querySelector('[data-action=\"task-table-pin\"]').dataset.id");
      await click('[data-action="task-table-pin"]');
      await wait("document.querySelector('[data-action=\"task-table-pin\"]')?.getAttribute('aria-pressed')==='true'");
      assert.equal(await evaluate("document.querySelector('[data-action=\"task-table-pin\"]').dataset.id"),candidate);
      await click('[data-action="task-table-sort"][data-key="title"]');
      assert.equal(await evaluate("document.querySelector('[data-action=\"task-table-pin\"]').dataset.id"),candidate);
      await click('[data-action="task-table-pin"]');
      await wait("document.querySelector('[data-action=\"task-table-pin\"]')?.getAttribute('aria-pressed')==='false'");
      await click('[data-action="task-table-close"]');
      await click('[data-page="log"]');
      await wait("!!document.querySelector('#page-log .log-card time')");
      if (width===390) {
        await click('[data-action="new-log"]');
        await wait("!!document.querySelector('#lf-references h3')");
        await evaluate(`const input=document.getElementById('lf-content');
          input.value='浏览器验收：试点校验和反馈';input.dispatchEvent(new Event('input',{bubbles:true}));`);
        const businessDate=await evaluate("document.getElementById('lf-date').value");
        await click('[data-action="save-log"]');
        await wait("overlayEl.hidden && [...document.querySelectorAll('#page-log .log-card')].some(card=>card.textContent.includes('浏览器验收'))");
        assert.equal(await evaluate("[...document.querySelectorAll('#page-log .log-card')].find(card=>card.textContent.includes('浏览器验收')).querySelector('time').textContent"),businessDate);
      }
      const displayed = await evaluate("[...document.querySelectorAll('#page-log .log-card time')].map(t=>t.textContent)");
      assert(displayed.length >= 3 && displayed.every(date => /^\d{4}-\d{2}-\d{2}$/.test(date)));
    }
    await sleep(120);
    assert.deepEqual(browser.errors.filter(message => message.startsWith("EXC:")), []);
    process.stdout.write("PASS browser " + width + "×" + height + "\n");
  } catch (error) {
    console.error("Browser state", await evaluate("({title:document.getElementById('sheetTitle')?.textContent,alert:document.querySelector('#sheetBody [role=alert]')?.textContent, idle:Pandora.idle()})"), browser.errors);
    if (process.env.PANDORA_SCREENSHOTS) await browser.screenshot(process.env.PANDORA_SCREENSHOTS + "/failure-" + width + ".png");
    throw error;
  } finally {
    browser.kill();
  }
}
(async () => {
  await run(390, 844, "13800000004");
  await run(1440, 900, "13800000001");
  await run(390, 844, "13800000001");
  await run(320, 740, "13800000004");
})().then(() => process.exit(0), error => { console.error(error); process.exit(1); });
