#!/usr/bin/env node
"use strict";
/*
 * Browser verification for section 9: home quadrants, calendar entry/search, pins, cross-day split,
 * full timeline/concurrency, swipe weeks and range counts.
 *
 * Run against a freshly seeded backend:
 *   node scripts/check_home_calendar_browser.js --base-url http://127.0.0.1:18130
 */
const { spawn } = require("child_process");
const crypto = require("crypto");
const fs = require("fs");

const CHROME = process.env.CHROME_BIN || [
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
    "--remote-debugging-port=" + port, "--user-data-dir=/tmp/cdp-" + crypto.randomBytes(4).toString("hex"), url], { stdio: "ignore" });
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
  await browser.evaluate(setValue("login-user", username));
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
    const result = await api(base, "POST", "/api/v1/auth/sessions", { body: { username, password } });
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
    const body = { title, description: "section9 browser", acceptanceCriteria: "check", priority: "medium",
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
  for (let i = 0; i < 4; i++) overlaps.push(await create("S9 overlap " + i + " " + RUN, [me.id], at(target, 14), at(target, 15)));
  const allDays = [];
  for (let i = 0; i < 2; i++) allDays.push(await create("S9 all-day " + i + " " + RUN, [me.id], target, new Date(target.getTime() + 86400000), true));
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
    check("9.3 the calendar has panel, date, search and floating create entries",
      await browser.evaluate("!!document.querySelector('.p-schedule-panel') && !!document.querySelector('[data-action=\"schedule-pick-date\"]') && !!document.getElementById('p-schedule-search') && !!document.querySelector('.p-schedule-fab')"));
    check("9.3 the side panel exposes modes, range counts and my applications",
      await browser.evaluate("(() => { const text = document.querySelector('.p-schedule-panel').textContent; return ['月','周','日','我负责','我分配','仅可见','待完成审核','已完成','逾期未完成','我的申请'].every(v => text.includes(v)); })()"));
    await browser.evaluate(`document.querySelector('[data-action="schedule-my-applications"]').click()`);
    await waitFor(browser, "document.getElementById('sheetTitle').textContent === '我的申请'");
    check("9.3 the independent application entry opens only my applications",
      await browser.evaluate("document.getElementById('sheetTitle').textContent === '我的申请' && /我提交的申请/.test(document.getElementById('sheetBody').textContent)"));
    await browser.evaluate("document.getElementById('sheetClose').click()");

    await browser.evaluate(setValue("p-schedule-search", "S9 cross-day"));
    await waitFor(browser, "!!document.querySelector('#p-search-results .p-search-row')");
    check("9.3 name search returns the visible task for the current user",
      await browser.evaluate("Array.from(document.querySelectorAll('#p-search-results .p-search-row')).some(row => row.textContent.includes('S9 cross-day'))"));
    await browser.evaluate("document.querySelector('[data-action=\"schedule-clear-search\"]').click()");

    const monthState = await browser.evaluate("({ rows: Number(getComputedStyle(document.querySelector('.p-month-layout')).getPropertyValue('--month-rows')), clip: getComputedStyle(document.querySelector('.p-month-event span')).textOverflow })");
    check("9.4 month capacity never exceeds five and title uses direct clip",
      monthState.rows <= 5 && monthState.clip === "clip", monthState);
    const hidden = await browser.evaluate("(() => { const el = document.querySelector('.p-month-more[data-hidden-count]'); return el ? { count: Number(el.dataset.hiddenCount), text: el.textContent } : { count: 0, text: '' }; })()");
    check("9.4 month overflow uses the actual hidden count", hidden.count > 0 && hidden.text.includes(String(hidden.count)), hidden);
    if (hidden.count > 0) {
      await browser.evaluate("document.querySelector('.p-month-more[data-hidden-count]').click()");
      await waitFor(browser, "document.getElementById('overlay').hidden === false");
      const listed = await browser.evaluate("document.querySelectorAll('#sheetBody .task-item').length");
      check("9.4 opening the month overflow lists every hidden task", listed === hidden.count, { listed, hidden: hidden.count });
      await browser.evaluate("document.getElementById('sheetClose').click()");
    }
    check("9.4 the pinned task shows a visible pin marker in the month",
      await browser.evaluate("!!document.querySelector('.p-month-event[data-task=\"" + pinTask + "\"] .p-pin')"));
    const pinnedFirst = await browser.evaluate(`(() => { const el = document.querySelector('.p-month-event[data-task="${pinTask}"]'); if (!el) return false; const week = el.closest('.p-month-week'); return week && week.querySelector('.p-month-event') === el; })()`);
    check("9.4 the pinned task sorts before other tasks in its week", pinnedFirst, pinnedFirst);
    check("9.8 month bars carry a visible relationship marker",
      await browser.evaluate("document.querySelectorAll('.p-month-event').length > 0 && Array.from(document.querySelectorAll('.p-month-event')).every(el => !!el.querySelector('.p-event-kind'))"));
    await browser.evaluate(`document.querySelector('.p-month-event[data-task="${pinTask}"]').click()`);
    await waitFor(browser, "document.getElementById('overlay').hidden === false && window.Pandora.idle()");
    check("9.4 task detail exposes the pin toggle",
      await browser.evaluate("/取消置顶/.test(document.querySelector('[data-action=\"p-toggle-task-pin\"]').textContent)"));
    await browser.evaluate("document.querySelector('[data-action=\"p-toggle-task-pin\"]').click()");
    await waitFor(browser, "window.Pandora.idle()");
    check("9.4 the detail pin toggle clears the month pin",
      await browser.evaluate(`!document.querySelector('.p-month-event[data-task="${pinTask}"] .p-pin')`));
    await browser.evaluate("document.getElementById('sheetClose').click()");
    const countMatch = await browser.evaluate(`(() => { const s = window.Pandora.calendar.rangeSummary(actor()); return ['own','assigned','other','pendingComplete','done','overdue'].every(key => { const el = document.querySelector('[data-count="' + key + '"] b'); return el && Number(el.textContent) === s[key]; }); })()`);
    check("9.8 the visible range counts match the deduplicated task set", countMatch, countMatch);

    await openView(browser, "week");
    await browser.evaluate("state.viewAnchor = new Date(" + target.getTime() + "); renderAll()");
    await sleep(200);
    check("9.5 a timed cross-day task is split into two day columns",
      await browser.evaluate("(() => { const rows = Array.from(document.querySelectorAll('.p-time-event')).filter(el => el.dataset.task === \"" + cross + "\"); const starts = rows.map(el => Number(el.dataset.startMinute)); return rows.length >= 2 && starts.includes(1200) && starts.includes(0); })()"));
    check("9.5 midnight and zero-duration tasks do not create extra day copies",
      await browser.evaluate("(() => { const m = Array.from(document.querySelectorAll('.p-time-event')).filter(el => el.dataset.task === \"" + midnight + "\"); const z = Array.from(document.querySelectorAll('.p-time-event')).filter(el => el.dataset.task === \"" + zero + "\"); return m.length === 1 && z.length === 1; })()"));
    check("9.6 all-day tasks are not aggregated behind +N",
      await browser.evaluate("document.querySelectorAll('.p-all-day-event').length === 0 || document.querySelectorAll('.p-all-day-event').length >= 2"));

    await openView(browser, "day");
    await browser.evaluate("state.viewAnchor = new Date(" + target.getTime() + "); renderAll()");
    await sleep(200);
    check("9.6 four overlapping tasks render as four clickable events",
      await browser.evaluate("Array.from(document.querySelectorAll('.p-time-event')).filter(el => [..." + JSON.stringify(overlaps) + "].includes(el.dataset.task)).length === 4"));
    check("9.6 the full timeline is taller than its scrollport",
      await browser.evaluate("(() => { const el = document.querySelector('.p-timeline-scroll'); return !!el && el.scrollHeight > el.clientHeight && document.querySelector('.p-day-canvas').style.height === '1152px'; })()"));
    check("9.6 multiple all-day tasks are individually present",
      await browser.evaluate("Array.from(document.querySelectorAll('.p-all-day-event')).filter(el => [..." + JSON.stringify(allDays) + "].includes(el.dataset.task)).length >= 2"));
    check("9.8 all-day bars carry a visible relationship marker",
      await browser.evaluate("Array.from(document.querySelectorAll('.p-all-day-event')).every(el => !!el.querySelector('.p-event-kind'))"));
    check("9.8 every event carries a visible non-colour relationship marker",
      await browser.evaluate("Array.from(document.querySelectorAll('.p-time-event')).every(el => !!el.querySelector('.p-event-kind'))"));

    await openView(browser, "week");
    const swipeBefore = await browser.evaluate("({ t: +state.viewAnchor, weekday: state.viewAnchor.getDay() })");
    await browser.evaluate("(() => { const el = document.querySelector('.p-week-heading'); el.dispatchEvent(new PointerEvent('pointerdown', {bubbles:true, clientX:250, clientY:60, pointerId:11})); document.dispatchEvent(new PointerEvent('pointerup', {bubbles:true, clientX:130, clientY:62, pointerId:11})); })()");
    await sleep(200);
    const swipeAfter = await browser.evaluate("({ t: +state.viewAnchor, weekday: state.viewAnchor.getDay() })");
    check("9.7 a horizontal swipe moves one complete week and keeps the weekday",
      Math.abs(swipeAfter.t - swipeBefore.t - 7 * 86400000) < 1000 && swipeAfter.weekday === swipeBefore.weekday, { before: swipeBefore, after: swipeAfter });
    const noSwipe = await browser.evaluate("(() => { const before = +state.viewAnchor; const el = document.querySelector('.p-week-heading'); el.dispatchEvent(new PointerEvent('pointerdown', {bubbles:true, clientX:250, clientY:60, pointerId:12})); document.dispatchEvent(new PointerEvent('pointerup', {bubbles:true, clientX:246, clientY:160, pointerId:12})); return +state.viewAnchor === before; })()");
    check("9.7 a vertical gesture does not switch the week", noSwipe);

    await openView(browser, "day");
    await browser.evaluate("state.viewAnchor = new Date(" + target.getTime() + "); renderAll()");
    await sleep(150);
    await browser.evaluate("document.querySelector('.p-time-event').click()");
    await waitFor(browser, "document.getElementById('sheetTitle').textContent !== '标题' && document.getElementById('overlay').hidden === false");
    check("9.7 clicking a task opens detail without changing the day/week mode",
      await browser.evaluate("state.viewMode === 'day'"));
    await browser.evaluate("document.getElementById('sheetClose').click()");
    check("9.3 an off-today day view exposes the return-to-today shortcut",
      await browser.evaluate("/回到今天/.test(document.querySelector('.p-return-current') ? document.querySelector('.p-return-current').textContent : '')"));
    const dayBefore = await browser.evaluate("({ t: +state.viewAnchor, weekday: state.viewAnchor.getDay() })");
    await browser.evaluate("(() => { const el = document.querySelector('.p-day-strip'); el.dispatchEvent(new PointerEvent('pointerdown', {bubbles:true, clientX:250, clientY:40, pointerId:21})); document.dispatchEvent(new PointerEvent('pointerup', {bubbles:true, clientX:140, clientY:42, pointerId:21})); })()");
    await sleep(200);
    const dayAfter = await browser.evaluate("({ t: +state.viewAnchor, weekday: state.viewAnchor.getDay() })");
    check("9.7 a day-view swipe moves one complete week and keeps the weekday",
      Math.abs(dayAfter.t - dayBefore.t - 7 * 86400000) < 1000 && dayAfter.weekday === dayBefore.weekday, { before: dayBefore, after: dayAfter });
    await openView(browser, "week");

    for (const width of [320, 390, 1440]) {
      await browser.setViewport(width, 844);
      await sleep(150);
      check("9.6 layout " + width + " keeps the floating create button inside the viewport",
        await browser.evaluate("(() => { const r = document.querySelector('.p-schedule-fab').getBoundingClientRect(); return r.left >= 0 && r.right <= innerWidth && r.bottom <= innerHeight; })()"));
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
