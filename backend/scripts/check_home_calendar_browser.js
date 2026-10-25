#!/usr/bin/env node
"use strict";
/*
 * Browser verification for section 9: home quadrants, calendar entry/search, pins, cross-day split,
 * full timeline/concurrency, swipe weeks and range counts.
 *
 * Run against a freshly seeded backend:
 *   node scripts/check_home_calendar_browser.js --base-url http://127.0.0.1:18130
 */

/* Employees authenticate by phone number (chapter 2.1/2.3); demo accounts keep stable numbers. */
const DEMO_PHONE = { upper: "13800000001", middle: "13800000002", market: "13800000003",
  employee: "13800000004", colleague: "13800000005", marketing: "13800000006", admin: "admin" };
function loginIdentity(account) { return DEMO_PHONE[account] || account; }

const { spawn } = require("child_process");
const crypto = require("crypto");
const fs = require("fs");
const os = require("os");
const path = require("path");

const CHROME = process.env.CHROME_BIN || [
  "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
  "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
  "/usr/bin/google-chrome",
  "/usr/bin/google-chrome-stable",
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
].find((path) => fs.existsSync(path)) || "/usr/bin/google-chrome";
const results = [];
const RUN = crypto.randomBytes(3).toString("hex");

function check(name, condition, evidence) {
  results.push({ check: name, pass: !!condition, evidence: evidence === undefined ? null : evidence });
  console.log((condition ? "PASS  " : "FAIL  ") + name + (condition ? "" : "  -> " + JSON.stringify(evidence)));
}
function arg(name, fallback) {
  const index = process.argv.indexOf("--" + name);
  return index >= 0 ? process.argv[index + 1] : fallback;
}
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
async function api(base, method, route, { token, body, key, etag } = {}) {
  const headers = { "Content-Type": "application/json" };
  if (token) headers.Authorization = "Bearer " + token;
  if (key) headers["Idempotency-Key"] = key;
  if (etag) headers["If-Match"] = etag;
  const response = await fetch(base + route, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
  const text = await response.text();
  return { status: response.status, body: text ? JSON.parse(text) : {}, headers: Object.fromEntries(response.headers) };
}
const key = (prefix = "s9") => prefix + "-" + crypto.randomUUID();
const etag = (body, headers) => headers.etag || '"' + body.rowVersion + '"';
const iso = (date) => date.toISOString().replace("Z", "+00:00");

async function openBrowser(url) {
  const port = 9900 + Math.floor(Math.random() * 90);
  const proc = spawn(CHROME, ["--headless", "--no-sandbox", "--disable-gpu", "--no-first-run",
    "--no-default-browser-check", "--disable-crash-reporter", "--hide-scrollbars", "--force-device-scale-factor=1",
    "--remote-debugging-port=" + port, "--user-data-dir=" + path.join(os.tmpdir(), "pandora-cdp-" + crypto.randomBytes(4).toString("hex")), url], { stdio: "ignore" });
  let target = null;
  for (let i = 0; i < 100 && !target; i++) {
    try {
      const list = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json();
      target = list.find((row) => row.type === "page" && String(row.url).startsWith("http"));
    } catch {}
    if (!target) await sleep(200);
  }
  if (!target) { proc.kill("SIGKILL"); throw new Error("no page target"); }
  const ws = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => {
    ws.addEventListener("open", resolve);
    ws.addEventListener("error", () => reject(new Error("cdp failed")));
  });
  let seq = 0; const pending = new Map();
  ws.addEventListener("message", (event) => {
    const message = JSON.parse(event.data);
    if (message.id && pending.has(message.id)) {
      const { resolve, reject } = pending.get(message.id); pending.delete(message.id);
      message.error ? reject(new Error(JSON.stringify(message.error))) : resolve(message.result);
    }
  });
  const send = (method, params) => new Promise((resolve, reject) => {
    const id = ++seq; pending.set(id, { resolve, reject });
    ws.send(JSON.stringify({ id, method, params: params || {} }));
    setTimeout(() => { if (pending.delete(id)) reject(new Error("timeout: " + method)); }, 20000);
  });
  await send("Runtime.enable"); await send("Page.enable");
  const evaluate = async (expression) => {
    const result = await send("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true, userGesture: true });
    if (result.exceptionDetails) throw new Error(result.exceptionDetails.text + " in " + expression);
    return result.result.value;
  };
  const setViewport = (width, height) => send("Emulation.setDeviceMetricsOverride", { width, height, deviceScaleFactor: 1, mobile: true });
  await setViewport(390, 844);
  return { evaluate, send, setViewport, kill: () => { try { ws.close(); } catch {} proc.kill("SIGKILL"); } };
}
async function waitFor(browser, expression, timeout = 12000) {
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) {
    try { if (await browser.evaluate(expression)) return true; } catch {}
    await sleep(150);
  }
  return false;
}
const text = (selector) => `((document.querySelector(${JSON.stringify(selector)}) || {}).textContent || "")`;
const setValue = (id, value) => `(() => { const el = document.getElementById(${JSON.stringify(id)}); if (!el) return false; el.value = ${JSON.stringify(value)}; el.dispatchEvent(new Event("input", {bubbles:true})); return true; })()`;
const submit = (id) => `(() => { const el = document.getElementById(${JSON.stringify(id)}); if (!el) return false; el.requestSubmit(); return true; })()`;
const clickPage = (page) => `document.querySelector('[data-page="${page}"]').click()`;

async function login(browser, username, password) {
  await waitFor(browser, "!!document.getElementById('backend-login')");
  await browser.evaluate(setValue("login-user", loginIdentity(username)));
  await browser.evaluate(setValue("login-password", password));
  await browser.evaluate(submit("backend-login"));
  return waitFor(browser, "window.Pandora && window.Pandora.ready");
}
async function openView(browser, mode) {
  await browser.evaluate(clickPage("view"));
  await waitFor(browser, "!!document.querySelector('.p-schedule-card') && window.Pandora.idle()");
  if (mode) {
    const current = await browser.evaluate("state.viewMode");
    if (current !== mode) {
      await browser.evaluate(`document.querySelector('[data-action="schedule-mode"][data-mode="${mode}"]').click()`);
      await waitFor(browser, `state.viewMode === "${mode}" && window.Pandora.idle()`);
    }
  }
  await sleep(150);
}

async function main() {
  const base = arg("base-url", "http://127.0.0.1:18130");
  const password = arg("password", "Demo@123456");
  const output = arg("output", null);
  const loginApi = async (username) => {
    const result = await api(base, "POST", "/api/v1/auth/sessions", { body: { username: loginIdentity(username), password } });
    if (result.status !== 200) throw new Error("login failed " + username);
    return result.body.token;
  };
  const upper = await loginApi("upper");
  const middle = await loginApi("middle");
  const employee = await loginApi("employee");
  const me = (await api(base, "GET", "/api/v1/me", { token: employee })).body;
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const target = new Date(today.getTime() + 86400000);
  const at = (day, hours, minutes) => new Date(day.getFullYear(), day.getMonth(), day.getDate(), hours, minutes || 0);
  const create = async (title, owners, start, due, allDay = false) => {
    const body = { title, description: "section9 browser", priority: "medium",
      allDay, assigneeIds: owners };
    if (allDay) { body.startDate = start.toISOString().slice(0, 10); body.dueDate = due.toISOString().slice(0, 10); }
    else { body.startAt = iso(start); body.dueAt = iso(due); }
    const result = await api(base, "POST", "/api/v1/tasks", { token: upper, body, key: key("create") });
    if (result.status !== 201) throw new Error("create failed " + JSON.stringify(result.body));
    if (result.body.requestId) {
      const request = await api(base, "GET", "/api/v1/approval-requests/" + result.body.requestId, { token: middle });
      if (request.status === 200 && request.body.status === "pending") {
        await api(base, "PATCH", "/api/v1/approval-requests/" + result.body.requestId, { token: middle,
          body: { decision: "approve", comment: "section9 fixture" }, key: key("approve"), etag: etag(request.body, request.headers) });
      }
    }
    return result.body.taskId;
  };

  const cross = await create("S9 cross-day " + RUN, [me.id], at(target, 20), at(new Date(target.getTime() + 86400000), 10));
  const midnight = await create("S9 midnight " + RUN, [me.id], at(target, 22), at(new Date(target.getTime() + 86400000), 0));
  const zero = await create("S9 zero " + RUN, [me.id], at(target, 16), at(target, 16));
  const overlaps = [];
  for (let i = 0; i < 6; i++) overlaps.push(await create("S9 overlap " + i + " " + RUN, [me.id], at(target, 14), at(target, 15)));
  const allDays = [];
  for (let i = 0; i < 8; i++) allDays.push(await create("S9 all-day " + i + " " + RUN, [me.id], target, new Date(target.getTime() + 86400000), true));
  // Tasks in the following months prove that the continuous stream mounts the real neighbourhood.
  const nextMonth = new Date(today.getFullYear(), today.getMonth() + 1, 20, 10, 0);
  const nextMonthTask = await create("S9 next-month " + RUN, [me.id], nextMonth, new Date(nextMonth.getTime() + 3600000));
  const farMonth = new Date(today.getFullYear(), today.getMonth() + 2, 15, 10, 0);
  const farMonthTask = await create("S9 far-month " + RUN, [me.id], farMonth, new Date(farMonth.getTime() + 3600000));
  const pinTask = cross;
  await api(base, "PUT", "/api/v1/tasks/" + pinTask + "/pin", { token: employee, key: key("pin") });

  const browser = await openBrowser(base + "/");
  try {
    await login(browser, "employee", password);
    check("9.2 the home has four independent quadrants",
      await browser.evaluate("document.querySelectorAll('#page-map .quad').length === 4 && Array.from(document.querySelectorAll('#page-map .q-body')).every(el => getComputedStyle(el).overflowY === 'auto')"));
    check("9.2 assigned tasks are title + priority rows",
      await browser.evaluate("document.querySelectorAll('.home-task').length > 0 && Array.from(document.querySelectorAll('.home-task')).every(el => el.querySelector('.home-task-title') && el.querySelector('.home-task-priority') && !el.querySelector('.task-meta'))"));
    check("9.2 personal items do not expose edit/delete in the list",
      await browser.evaluate("document.querySelectorAll('.home-personal-item').length > 0 && Array.from(document.querySelectorAll('.home-personal-item')).every(el => !el.querySelector('[data-edit-personal],[data-delete-personal]'))"));
    await browser.evaluate("document.querySelector('.home-personal-item').click()");
    await waitFor(browser, "document.getElementById('sheetTitle').textContent === '个人信息'");
    check("9.2 personal detail has edit and delete commands",
      await browser.evaluate("!!document.querySelector('[data-action=\"p-edit-home-personal\"]') && !!document.querySelector('[data-action=\"p-delete-home-personal\"]')"));
    await browser.evaluate("document.getElementById('sheetClose').click()");

    await openView(browser, "month");
    check("9.3 the calendar exposes a side toggle, a year-month picker, the task table and a floating create",
      await browser.evaluate("!!document.querySelector('[data-action=\"schedule-side-toggle\"]') && !!document.querySelector('[data-action=\"schedule-pick-date\"]') && !!document.querySelector('[data-action=\"task-table-open\"]') && !!document.querySelector('.p-schedule-fab')"));
    check("9.3 the calendar has no person switch, no week mode, no ordinary search and no statistics",
      await browser.evaluate("!document.getElementById('calendarPersonSelect') && !document.querySelector('[data-action=\"schedule-mode\"][data-mode=\"week\"]') && !document.getElementById('p-schedule-search') && !document.querySelector('.p-range-counts') && !document.querySelector('.p-kind-legend')"));
    check("9.3 the side panel starts collapsed", await browser.evaluate("document.getElementById('p-schedule-side').hidden === true"));

    await browser.evaluate("document.querySelector('[data-action=\"schedule-side-toggle\"]').focus()");
    await browser.evaluate("document.querySelector('[data-action=\"schedule-side-toggle\"]').click()");
    await sleep(150);
    check("9.3 opening the side panel exposes month/day and my applications",
      await browser.evaluate("(() => { const panel = document.getElementById('p-schedule-side'); if (panel.hidden) return false; const text = panel.textContent; return text.includes('月') && text.includes('日') && text.includes('我的申请') && document.querySelector('[data-action=\"schedule-side-toggle\"]').getAttribute('aria-expanded') === 'true'; })()"));
    await browser.evaluate("document.querySelector('[data-action=\"schedule-my-applications\"]').click()");
    await waitFor(browser, "document.getElementById('sheetTitle').textContent === '我的申请'");
    check("9.3 my applications opens only my submitted requests",
      await browser.evaluate("document.getElementById('overlay').hidden === false && /我提交的申请/.test(document.getElementById('sheetBody').textContent)"));
    await browser.evaluate("document.getElementById('sheetClose').click()");
    await browser.evaluate("document.querySelector('[data-action=\"schedule-side-toggle\"]').click()");
    await sleep(100);
    check("9.3 closing the side panel returns the calendar as the main body",
      await browser.evaluate("document.getElementById('p-schedule-side').hidden === true && !!document.querySelector('.p-month-view')"));

    const sections = await browser.evaluate("({ keys: Array.from(document.querySelectorAll('.p-month-section')).map(el => el.dataset.monthKey), count: document.querySelectorAll('.p-month-section').length })");
    check("9.3 the month stream mounts adjacent months around the anchor",
      sections.count >= 3 && sections.keys.every((key, index) => index === 0 || key > sections.keys[index - 1]), sections);
    const uniqueDays = await browser.evaluate(`(() => {
      const dates = Array.from(document.querySelectorAll('.p-month-date[data-date]')).map(el => el.dataset.date);
      return { total: dates.length, unique: new Set(dates).size };
    })()`);
    check("9.3 every business day appears exactly once across the mounted months (no duplicated boundary content)",
      uniqueDays.total === uniqueDays.unique && uniqueDays.total > 28, uniqueDays);

    const pinnedFirst = await browser.evaluate(`(() => {
      const el = document.querySelector('.p-month-event[data-task="${pinTask}"]');
      if (!el) return { found: false };
      const week = el.closest('.p-month-week');
      return { found: true, first: week && week.querySelector('.p-month-event') === el, marker: !!el.querySelector('.p-pin') };
    })()`);
    check("9.4 the pinned task sorts first in its week and only gets an emphasis marker",
      pinnedFirst.found && pinnedFirst.first && pinnedFirst.marker, pinnedFirst);
    const hidden = await browser.evaluate("(() => { const el = Array.from(document.querySelectorAll('.p-month-more[data-hidden-count]')).find(node => !node.hidden && Number(node.dataset.hiddenCount) > 0); return el ? { count: Number(el.dataset.hiddenCount), text: el.textContent, date: el.dataset.date } : { count: 0, text: '', date: null }; })()");
    check("9.4 month overflow shows the real hidden count and not an aggregate substitute", hidden.count > 0 && hidden.text.includes(String(hidden.count)), hidden);
    if (hidden.count > 0) {
      const totalOnDay = await browser.evaluate(`(() => { const el = Array.from(document.querySelectorAll('.p-month-more[data-hidden-count]')).find(node => !node.hidden && Number(node.dataset.hiddenCount) > 0); return window.Pandora.calendar.dayTasks(parseDateInput(el.dataset.date)).length; })()`);
      await browser.evaluate("Array.from(document.querySelectorAll('.p-month-more[data-hidden-count]')).find(node => !node.hidden && Number(node.dataset.hiddenCount) > 0).click()");
      await waitFor(browser, "document.getElementById('overlay').hidden === false");
      const listed = await browser.evaluate("({ mode: state.viewMode, items: document.querySelectorAll('#page-view .p-day-list .p-agenda-item').length, detail: document.getElementById('sheetTitle').textContent })");
      check("9.4 opening the month overflow lists the complete day list",
        listed.mode === "day" && listed.items === totalOnDay, { listed, totalOnDay });
      await openView(browser, "month");
    }

    const beforeScroll = await browser.evaluate("({ top: document.querySelector('.p-month-scroll').scrollTop, stream: window.Pandora.calendar.currentStream().length })");
    await browser.evaluate("(() => { const el = document.querySelector('.p-month-scroll'); el.scrollTop = el.scrollHeight; el.dispatchEvent(new Event('scroll')); return true; })()");
    await waitFor(browser, `window.Pandora.calendar.currentStream().length > ${beforeScroll.stream}`);
    await sleep(250);
    const afterScroll = await browser.evaluate("({ top: document.querySelector('.p-month-scroll').scrollTop, stream: window.Pandora.calendar.currentStream().length, lastMonth: document.querySelectorAll('.p-month-section').length })");
    check("9.3 scrolling down mounts the next months without jumping the reader",
      afterScroll.stream > beforeScroll.stream && afterScroll.top > 0, { before: beforeScroll, after: afterScroll });

    const farKey = `${farMonth.getFullYear()}-${String(farMonth.getMonth() + 1).padStart(2, "0")}`;
    await browser.evaluate("document.querySelector('[data-action=\"schedule-pick-date\"]').click()");
    await waitFor(browser, "!!document.getElementById('p-schedule-year')");
    await browser.evaluate(`(() => { document.getElementById('p-schedule-year').value = '${farMonth.getFullYear()}'; document.getElementById('p-schedule-month').value = '${farMonth.getMonth() + 1}'; document.getElementById('p-schedule-date').value = ''; document.querySelector('[data-action="schedule-confirm-date"]').click(); return true; })()`);
    await sleep(400);
    check("9.3 a far year/month can be selected from the picker and is mounted",
      await browser.evaluate(`state.viewAnchor.getFullYear() === ${farMonth.getFullYear()} && state.viewAnchor.getMonth() === ${farMonth.getMonth()} && !!document.querySelector('.p-month-section[data-month-key="${farKey}"]')`));
    check("9.3 the far month contains the real task created for it",
      await browser.evaluate(`(() => { const section = document.querySelector('.p-month-section[data-month-key="${farKey}"]'); return !!section && !!section.querySelector('.p-month-event[data-task="${farMonthTask}"]'); })()`));
    await browser.evaluate("document.querySelector('[data-action=\"schedule-today\"]').click()");
    await sleep(300);
    check("9.3 returning today rebuilds the stream around the current month",
      await browser.evaluate(`(() => { const now = new Date(); const key = now.getFullYear() + '-' + String(now.getMonth() + 1).padStart(2, '0'); return window.Pandora.calendar.currentStream().includes(key) && toDateInput(state.viewAnchor) === toDateInput(now); })()`));

    await browser.evaluate("state.viewAnchor = new Date(" + target.getTime() + "); renderAll()");
    await sleep(200);
    const anchorBefore = await browser.evaluate(`(() => { const scroller = document.querySelector('.p-month-scroll'); const top = scroller.getBoundingClientRect().top; const week = Array.from(scroller.querySelectorAll('.p-month-week')).find(el => el.getBoundingClientRect().bottom > top + 1); return { height: Number(document.querySelector('.p-month-view').dataset.rowHeight), week: week && week.dataset.weekStart }; })()`);
    await browser.evaluate("(() => { const handle = document.querySelector('.p-month-resize-handle'); handle.focus(); handle.dispatchEvent(new KeyboardEvent('keydown', {key: 'ArrowUp', bubbles: true})); return true; })()");
    await sleep(200);
    const anchorAfterKey = await browser.evaluate(`(() => { const scroller = document.querySelector('.p-month-scroll'); const top = scroller.getBoundingClientRect().top; const week = Array.from(scroller.querySelectorAll('.p-month-week')).find(el => el.getBoundingClientRect().bottom > top + 1); return { height: Number(document.querySelector('.p-month-view').dataset.rowHeight), week: week && week.dataset.weekStart }; })()`);
    check("9.4 the keyboard raises the month density while keeping the visible business-day anchor",
      anchorAfterKey.height > anchorBefore.height && anchorAfterKey.week === anchorBefore.week, { before: anchorBefore, after: anchorAfterKey });
    await browser.evaluate(`(() => { const handle = document.querySelector('.p-month-resize-handle'); const rect = handle.getBoundingClientRect(); const y = rect.top + rect.height / 2; handle.dispatchEvent(new PointerEvent('pointerdown', {bubbles: true, cancelable: true, pointerId: 71, pointerType: 'mouse', isPrimary: true, clientY: y, clientX: rect.left + rect.width / 2, button: 0})); handle.dispatchEvent(new PointerEvent('pointermove', {bubbles: true, cancelable: true, pointerId: 71, pointerType: 'mouse', isPrimary: true, clientY: y + 40, clientX: rect.left + rect.width / 2})); handle.dispatchEvent(new PointerEvent('pointerup', {bubbles: true, pointerId: 71, pointerType: 'mouse', isPrimary: true, clientY: y + 40, button: 0})); return true; })()`);
    await sleep(200);
    const afterDrag = await browser.evaluate("Number(document.querySelector('.p-month-view').dataset.rowHeight)");
    check("9.4 dragging the handle raises the month density", afterDrag > anchorAfterKey.height, { before: anchorAfterKey.height, after: afterDrag });

    await browser.evaluate(`document.querySelector('.p-month-event[data-task="${pinTask}"]').click()`);
    await waitFor(browser, "document.getElementById('overlay').hidden === false && window.Pandora.idle()");
    check("9.4 tapping a month bar opens the task detail and keeps the month mode",
      await browser.evaluate("state.viewMode === 'month' && document.getElementById('sheetTitle').textContent.length > 0"));
    await browser.evaluate("document.getElementById('sheetClose').click()");
    await sleep(150);

    await openView(browser, "day");
    // The month overflow opens the day list on purpose; the axis check needs the timeline display.
    if ((await browser.evaluate("(document.querySelector('.p-day-layout') || {}).dataset && document.querySelector('.p-day-layout').dataset.dayMode")) === "list") {
      await browser.evaluate("document.querySelector('[data-action=\"schedule-day-mode\"][data-day-mode=\"timeline\"]').click()");
      await waitFor(browser, "window.Pandora.idle() && !!document.querySelector('.p-timeline-scroll')");
    }
    await browser.evaluate("state.viewAnchor = new Date(" + target.getTime() + "); renderAll()");
    await sleep(250);
    const axis = await browser.evaluate("(() => { const el = document.querySelector('.p-day-axis'); const layout = document.querySelector('.p-day-layout'); return { exists: !!el, height: el ? (el.style.height || getComputedStyle(el).height) : null, hours: document.querySelectorAll('.p-axis-hour').length, labels: Array.from(document.querySelectorAll('.p-axis-hour span')).map(e => e.textContent), mode: state.viewMode, page: state.page, viewPage: state.viewPage, card: !!document.querySelector('.p-schedule-card'), overlay: document.getElementById('overlay').hidden, dayMode: layout ? layout.dataset.dayMode : null, timeline: !!document.querySelector('.p-timeline-scroll'), dayList: !!document.querySelector('.p-day-list'), snippet: (document.querySelector('#page-view') || {}).innerHTML.slice(0, 180) }; })()");
    check("9.5 the day view is a vertical 00:00—24:00 axis",
      axis.exists && axis.hours === 24 && axis.labels[0] === '00:00' && axis.labels[23] === '23:00' && /1440px/.test(axis.height), axis);
    check("9.5 the axis can scroll to the end of the day",
      await browser.evaluate("(() => { const el = document.querySelector('.p-timeline-scroll'); el.scrollTop = el.scrollHeight; return el.scrollTop + el.clientHeight >= el.scrollHeight - 2; })()"));
    const crossEvents = await browser.evaluate(`(() => { const rows = Array.from(document.querySelectorAll('.p-axis-event')).filter(el => el.dataset.task === "${cross}"); return rows.map(el => ({ start: Number(el.dataset.startMinute), end: Number(el.dataset.endMinute) })); })()`);
    check("9.5 a timed cross-day task is drawn with its real coverage per day",
      crossEvents.length === 1 && crossEvents[0].start === 1200 && crossEvents[0].end === 1440, crossEvents);
    const midnightEvents = await browser.evaluate(`(() => Array.from(document.querySelectorAll('.p-axis-event')).filter(el => el.dataset.task === "${midnight}").map(el => ({ start: Number(el.dataset.startMinute), end: Number(el.dataset.endMinute) })))()`);
    const zeroEvents = await browser.evaluate(`(() => Array.from(document.querySelectorAll('.p-axis-event')).filter(el => el.dataset.task === "${zero}").map(el => ({ start: Number(el.dataset.startMinute), end: Number(el.dataset.endMinute) })))()`);
    check("9.5 a midnight deadline and a zero-duration task stay single points",
      midnightEvents.length === 1 && midnightEvents[0].end === 1440 && zeroEvents.length === 1 && zeroEvents[0].start === zeroEvents[0].end, { midnightEvents, zeroEvents });
    const overlapColumns = await browser.evaluate(`(() => { const rows = Array.from(document.querySelectorAll('.p-axis-event')).filter(el => [...${JSON.stringify(overlaps)}].includes(el.dataset.task)); return { count: rows.length, columns: rows.map(el => Number(el.dataset.columns)), lanes: rows.map(el => Number(el.dataset.lane)) }; })()`);
    check("9.5 six timed overlaps are fully split into six clickable columns",
      overlapColumns.count === 6 && new Set(overlapColumns.lanes).size === 6 && overlapColumns.columns.every(value => value >= 6), overlapColumns);
    const allDay = await browser.evaluate(`(() => { const rows = Array.from(document.querySelectorAll('.p-all-day-event')); const list = document.querySelector('.p-allday-scroll'); return { count: rows.length, ids: rows.map(el => el.dataset.task), aggregate: !!document.querySelector('.p-allday-scroll .p-month-more'), scrolls: !!list && list.scrollHeight > list.clientHeight }; })()`);
    check("9.6 all eight all-day tasks are individually reachable without a +N aggregate",
      allDay.count >= 8 && allDay.ids.filter(id => allDays.includes(id)).length === 8 && !allDay.aggregate && allDay.scrolls, allDay);
    await browser.evaluate("document.querySelector('.p-axis-event').click()");
    await waitFor(browser, "document.getElementById('overlay').hidden === false && window.Pandora.idle()");
    check("9.5 tapping an axis bar opens the detail and keeps the day mode",
      await browser.evaluate("state.viewMode === 'day'"));
    await browser.evaluate("document.getElementById('sheetClose').click()");

    const returnState = await browser.evaluate("({ mode: state.viewMode, anchor: toDateInput(state.viewAnchor), stream: window.Pandora.calendar.currentStream().join(','), pages: document.querySelectorAll('#tabbar button').length })");
    await browser.evaluate("document.querySelector('[data-action=\"task-table-open\"]').click()");
    await waitFor(browser, "!!document.querySelector('.p-task-table-card') && window.Pandora.taskForm && window.Pandora.taskForm.state.loaded");
    check("9.3 the task table opens under the unchanged five main navigation entries",
      await browser.evaluate("state.viewPage === 'table' && document.querySelectorAll('#tabbar button').length === 5"));
    await browser.evaluate("document.querySelector('[data-action=\"task-table-close\"]').click()");
    await waitFor(browser, "!!document.querySelector('.p-schedule-card')");
    await sleep(200);
    const afterReturn = await browser.evaluate("({ mode: state.viewMode, anchor: toDateInput(state.viewAnchor), stream: window.Pandora.calendar.currentStream().join(',') })");
    check("9.3 returning from the task table keeps the mode, date and continuous-month anchor",
      afterReturn.mode === returnState.mode && afterReturn.anchor === returnState.anchor, { before: returnState, after: afterReturn });

    for (const [width, height] of [[320, 740], [390, 844], [1440, 900]]) {
      await browser.setViewport(width, height);
      await sleep(150);
      const fab = await browser.evaluate("(() => { const fab = document.querySelector('.p-schedule-fab').getBoundingClientRect(); const nav = document.querySelector('#tabbar').getBoundingClientRect(); return { left: fab.left, right: fab.right, bottom: fab.bottom, navTop: nav.top, innerHeight }; })()");
      check("9.3 layout " + width + "x" + height + " keeps the floating create visible above the navigation",
        fab.left >= 0 && fab.right <= width && fab.bottom <= fab.navTop + 1, fab);
    }
  } finally {
    try { await api(base, "DELETE", "/api/v1/tasks/" + pinTask + "/pin", { token: employee, key: key("unpin") }); } catch {}
    browser.kill();
    if (output) {
      fs.mkdirSync(require("path").dirname(output), { recursive: true });
      fs.writeFileSync(output, JSON.stringify({ checks: results }, null, 2) + "\n");
    }
    const passed = results.filter((row) => row.pass).length;
    console.log(`\n${passed}/${results.length} browser checks passed`);
    if (passed !== results.length) process.exitCode = 1;
  }
}

main().catch((error) => { console.error(error); process.exitCode = 1; });
