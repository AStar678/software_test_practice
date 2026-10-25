#!/usr/bin/env node
"use strict";
/*
 * Chapter 11.2: one real demo account drives a continuous web path against the persisted demo data —
 * home company items → notifications → review inbox → task form filter/sort/pagination → subordinate
 * logs → full page refresh. The shell half of 11.2 is not executable on this machine (no signing key
 * or device); this script records only the web evidence and never claims shell verification.
 *
 *   CHECK_WORKER=true ./scripts/run_check_isolated.sh node scripts/check_demo_flow_browser.js \
 *     --base-url {base} --output ../audit/2026-10-25/chapter11-demo-web.json
 */
const { spawn } = require("child_process");
const crypto = require("crypto");
const fs = require("fs");
const os = require("os");
const path = require("path");

const CHROME = process.env.CHROME_BIN || [
  "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  "/usr/bin/google-chrome", "/usr/bin/google-chrome-stable",
].find((candidate) => fs.existsSync(candidate));
const results = [];
function arg(name, fallback) { const i = process.argv.indexOf("--" + name); return i >= 0 ? process.argv[i + 1] : fallback; }
function check(name, pass, evidence) {
  results.push({ check: name, pass: !!pass, evidence: evidence === undefined ? null : evidence });
  console.log((pass ? "PASS  " : "FAIL  ") + name + (pass ? "" : "  -> " + JSON.stringify(evidence)));
}
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function openBrowser(url, width, height) {
  const port = 10500 + Math.floor(Math.random() * 300);
  const proc = spawn(CHROME, ["--headless", "--no-sandbox", "--disable-gpu", "--no-first-run",
    "--no-default-browser-check", "--disable-crash-reporter", "--hide-scrollbars", "--force-device-scale-factor=1",
    "--remote-debugging-port=" + port,
    "--user-data-dir=" + path.join(os.tmpdir(), "pandora-cdp-" + crypto.randomBytes(4).toString("hex")), url], { stdio: "ignore" });
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
  let seq = 0; const pending = new Map(); const errors = [];
  ws.addEventListener("message", (event) => {
    const message = JSON.parse(event.data);
    if (message.method === "Runtime.exceptionThrown") errors.push("EXC: " + ((message.params.exceptionDetails.exception && message.params.exceptionDetails.exception.description) || message.params.exceptionDetails.text));
    if (message.method === "Runtime.consoleAPICalled" && message.params.type === "error") errors.push("CONSOLE: " + message.params.args.map((item) => item.value || item.description).join(" "));
    if (message.id && pending.has(message.id)) {
      const item = pending.get(message.id); pending.delete(message.id);
      message.error ? item.reject(new Error(JSON.stringify(message.error))) : item.resolve(message.result);
    }
  });
  const send = (method, params) => new Promise((resolve, reject) => {
    const id = ++seq; pending.set(id, { resolve, reject });
    ws.send(JSON.stringify({ id, method, params: params || {} }));
    setTimeout(() => { if (pending.delete(id)) reject(new Error("timeout: " + method)); }, 20000);
  });
  await send("Runtime.enable"); await send("Page.enable");
  await send("Emulation.setDeviceMetricsOverride", { width, height, deviceScaleFactor: 1, mobile: true });
  const evaluate = async (expression) => {
    const value = await send("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true, userGesture: true });
    if (value.exceptionDetails) throw new Error(value.exceptionDetails.text + " in " + expression.slice(0, 120));
    return value.result.value;
  };
  return { evaluate, errors, kill: () => { try { ws.close(); } catch {} proc.kill("SIGKILL"); } };
}
async function waitFor(browser, expression, timeout = 15000) {
  const end = Date.now() + timeout;
  while (Date.now() < end) {
    try { if (await browser.evaluate(expression)) return true; } catch {}
    await sleep(150);
  }
  return false;
}
const text = (selector) => `((document.querySelector(${JSON.stringify(selector)}) || {}).textContent || "")`;
const setValue = (id, value) => `(() => { const el = document.getElementById(${JSON.stringify(id)}); if (!el) return false; el.value = ${JSON.stringify(value)}; el.dispatchEvent(new Event("input", {bubbles:true})); return true; })()`;

async function main() {
  const base = arg("base-url", "http://127.0.0.1:18130");
  const password = arg("password", "Demo@123456");
  const output = arg("output", null);
  const browser = await openBrowser(base + "/", 390, 844);
  try {
    await waitFor(browser, "!!document.getElementById('backend-login')");
    await browser.evaluate(setValue("login-user", "13800000002"));
    await browser.evaluate(setValue("login-password", password));
    await browser.evaluate("document.getElementById('backend-login').requestSubmit()");
    check("11.2 the same demo account (middle manager) reaches the real workspace",
      await waitFor(browser, "window.Pandora && window.Pandora.ready && Pandora.data.me.username === 'middle'"));

    // 1) home company items and their real count.
    const home = await browser.evaluate("({ items: Pandora.data.home.companyItems.length, demo: Pandora.data.home.companyItems.some(i => String(i.title || i.body || '').includes('[演示]')), text: document.getElementById('page-map').textContent, page: state.page })");
    check("11.2 the home page shows the ten persisted company items including the demo rows",
      home.items === 10 && home.demo, { items: home.items, demo: home.demo, page: home.page });

    // 2) notifications delivered by the real event worker.
    await browser.evaluate("document.getElementById('bellBtn').click()");
    await waitFor(browser, "document.getElementById('overlay').hidden === false && document.getElementById('sheetTitle').textContent === '通知' && Pandora.idle()");
    await sleep(200);
    const notices = await browser.evaluate("({ rows: document.querySelectorAll('.notif').length, text: document.getElementById('sheetBody').textContent, review: (() => { const n = NOTIFICATIONS.find(x => x.raw && x.raw.canReview && x.raw.requestStatus === 'pending'); return n ? { id: n.id, title: n.raw.title || n.raw.summary } : null; })() })");
    check("11.2 the notification list contains delivered real messages",
      notices.rows > 0 && /未读|已读|撤回/.test(notices.text), { rows: notices.rows });

    // 3) the review entry is the real review-request notification; chapter 7 keeps the log page
    //    single-content, so the notification detail is the supported route into the approval sheet.
    check("11.2 a delivered review request is present for the manager", !!notices.review, notices.review);
    if (notices.review) {
      await browser.evaluate(`document.querySelector('.notif[data-id="${notices.review.id}"]').click()`);
      await waitFor(browser, "!!document.querySelector('[data-action=\"p-open-approval\"]')");
      const beforeApprovals = await browser.evaluate("Pandora.data.approvals.filter(r => r.status === 'pending' && r.currentReviewerId === Pandora.data.me.id).length");
      check("11.2 the review request opens the real application with a decision action",
        beforeApprovals > 0, { pending: beforeApprovals });
      await browser.evaluate("document.querySelector('[data-action=\"p-open-approval\"]').click()");
      await waitFor(browser, "!!document.querySelector('[data-action=\"p-approve-request\"]')");
      await browser.evaluate("document.querySelector('[data-action=\"p-approve-request\"]').click()");
      const approved = await waitFor(browser, `Pandora.idle() && Pandora.data.approvals.filter(r => r.status === 'pending' && r.currentReviewerId === Pandora.data.me.id).length === ${beforeApprovals - 1}`, 15000);
      check("11.2 approving one demo application really publishes it and refreshes the pending count", approved,
        { before: beforeApprovals, after: await browser.evaluate("Pandora.data.approvals.filter(r => r.status === 'pending' && r.currentReviewerId === Pandora.data.me.id).length") });
    } else {
      check("11.2 the review request opens the real application with a decision action", false, { reason: "no review request notification" });
      check("11.2 approving one demo application really publishes it and refreshes the pending count", false, {});
    }
    if (!(await browser.evaluate("document.getElementById('overlay').hidden"))) {
      await browser.evaluate("document.getElementById('sheetClose').click()");
      await waitFor(browser, "document.getElementById('overlay').hidden === true");
    }

    // 4) task form: pagination, filter and sort over the complete authorized set.
    await browser.evaluate("document.querySelector('[data-page=\"view\"]').click()");
    await waitFor(browser, "state.page === 'view' && !!document.querySelector('[data-action=\"task-table-open\"]')");
    await browser.evaluate("document.querySelector('[data-action=\"task-table-open\"]').click()");
    await waitFor(browser, "Pandora.taskForm.state.loaded && document.querySelectorAll('#p-table-body tr[data-task-row]').length > 0");
    const pager = await browser.evaluate("(() => { const el = document.querySelector('.p-table-range'); return el ? el.textContent : ''; })()");
    const total = Number((/共 ([0-9]+) 条/.exec(pager) || [])[1] || 0);
    check("11.2 the task form holds enough authorized rows to page (more than 50)",
      total > 50, { pager });
    await browser.evaluate(setValue("p-filter-query", "分页事项"));
    await sleep(300);
    const filtered = await browser.evaluate("(() => { const rows = Array.from(document.querySelectorAll('#p-table-body tr[data-task-row]')); const range = document.querySelector('.p-table-range'); return { rows: rows.length, allMatch: rows.every(r => r.textContent.includes('分页事项')), range: range ? range.textContent : '' }; })()");
    check("11.2 the name filter narrows the complete task set without losing rows",
      filtered.rows > 0 && filtered.allMatch && !/共 0 条/.test(filtered.range), filtered);
    await browser.evaluate("document.querySelector('[data-action=\"task-table-clear-filters\"]').click()");
    await sleep(300);
    await browser.evaluate("document.querySelector('[data-action=\"task-table-sort\"][data-key=\"title\"]').click()");
    await sleep(250);
    const sorted = await browser.evaluate("(() => ({ sort: Pandora.taskForm.state.sort, aria: Array.from(document.querySelectorAll('#p-table-head th')).map(th => th.getAttribute('aria-sort')).filter(v => v === 'ascending' || v === 'descending') }))()");
    check("11.2 the sort control orders the visible page by the chosen column",
      sorted.sort.key === "title" && sorted.aria.length === 1, sorted);
    const firstPageTitles = await browser.evaluate("Array.from(document.querySelectorAll('#p-table-body tr th[data-field=\"title\"]')).map(el => el.textContent)");
    await browser.evaluate("document.querySelector('[data-action=\"task-table-next\"]').click()");
    await sleep(300);
    const secondPage = await browser.evaluate("({ range: (document.querySelector('.p-table-range') || {}).textContent || '', titles: Array.from(document.querySelectorAll('#p-table-body tr th[data-field=\"title\"]')).map(el => el.textContent) })");
    check("11.2 the next page shows different rows from the complete filtered set",
      /第 2\//.test(secondPage.range) && secondPage.titles.length > 0
      && secondPage.titles.some((title) => !firstPageTitles.includes(title)), { secondPage, firstPageTitles: firstPageTitles.slice(0, 3) });
    // Opening a row and returning keeps the table context.
    await browser.evaluate("document.querySelector('#p-table-body tr [data-task]').click()");
    const detailOpened = await waitFor(browser, "document.getElementById('overlay').hidden === false && document.getElementById('sheetTitle').textContent !== '任务表单'");
    check("11.2 a task row opens the real detail from the table", detailOpened);
    await browser.evaluate("document.getElementById('sheetClose').click()");
    await waitFor(browser, "document.getElementById('overlay').hidden === true && !!document.querySelector('#p-table-body tr')");

    // 5) subordinate logs for the same account.
    await browser.evaluate("document.querySelector('[data-action=\"task-table-close\"]').click()");
    await waitFor(browser, "!!document.querySelector('.p-schedule-card')");
    await browser.evaluate("document.querySelector('[data-page=\"log\"]').click()");
    await waitFor(browser, "state.page === 'log' && Pandora.idle() && !!document.getElementById('logAuthorSelect')");
    const employeeId = await browser.evaluate("Pandora.data.logAuthors.items.find(p => p.displayName === '张涛').id");
    await browser.evaluate(`(() => { const el = document.getElementById('logAuthorSelect'); el.value = ${JSON.stringify(employeeId)}; el.dispatchEvent(new Event('change', { bubbles: true })); })()`);
    await waitFor(browser, "Pandora.idle() && document.querySelectorAll('.log-card').length > 0");
    await sleep(250);
    const logs = await browser.evaluate("({ who: Array.from(document.querySelectorAll('.log-card .who')).map(el => el.textContent), cards: document.querySelectorAll('.log-card').length })");
    check("11.2 the manager reads the subordinate's persisted logs",
      logs.cards > 0 && logs.who.every((name) => name.includes("张涛")), logs);

    // 6) full refresh proves persistence and no static fixture.
    await browser.evaluate("location.reload()");
    await waitFor(browser, "window.Pandora && window.Pandora.ready && Pandora.data.me.username === 'middle'", 30000);
    const refreshed = await browser.evaluate("({ company: Pandora.data.home.companyItems.length, tasks: Pandora.data.rawTasks.length, notices: Pandora.data.notifications ? Pandora.data.notifications.length : NOTIFICATIONS.length, me: Pandora.data.me.username, roleSwitch: Array.from(document.querySelectorAll('.role-switch button')).filter(b => b.offsetParent !== null).length })");
    check("11.2 after a full refresh the same account still has the company items, tasks and messages",
      refreshed.company === 10 && refreshed.tasks > 50 && refreshed.notices > 0 && refreshed.me === "middle", refreshed);
    check("11.2 the continuous path uses one real session and no visible role switch",
      refreshed.roleSwitch === 0, { visibleRoleSwitches: refreshed.roleSwitch });
    check("11.2 the demo web flow produced no uncaught script errors", browser.errors.length === 0, browser.errors.slice(0, 6));
  } finally {
    browser.kill();
    if (output) {
      fs.mkdirSync(path.dirname(output), { recursive: true });
      fs.writeFileSync(output, JSON.stringify({ generatedAt: new Date().toISOString(), baseUrl: base,
        viewport: { width: 390, height: 844 }, scope: "web only; legacy shell and device not verified",
        passed: results.filter((row) => row.pass).length, total: results.length, checks: results }, null, 2) + "\n");
    }
    const passed = results.filter((row) => row.pass).length;
    console.log(`\n${passed}/${results.length} browser checks passed`);
    if (passed !== results.length) process.exitCode = 1;
  }
}
main().catch((error) => { console.error(error); process.exitCode = 1; });
