#!/usr/bin/env node
"use strict";
/*
 * Real-browser verification for notification lifecycle UI (tasks 7.3, 7.7) and the subordinate
 * profile entry (task 3.5/8.4): automatic read, original result, withdrawal placeholder, historical
 * read-only detail, no footer actions, header close and the person-detail phone boundary.
 *
 *   node scripts/check_notification_browser.js --base-url http://127.0.0.1:18102
 */
const { spawn } = require("child_process");
const crypto = require("crypto");
const fs = require("fs");

const CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
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
async function api(base, method, route, { token, body, key, etag } = {}) {
  const headers = { "Content-Type": "application/json" };
  if (token) headers.Authorization = "Bearer " + token;
  if (key) headers["Idempotency-Key"] = key;
  if (etag) headers["If-Match"] = etag;
  const response = await fetch(base + route, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
  const text = await response.text();
  return { status: response.status, body: text ? JSON.parse(text) : {}, headers: Object.fromEntries(response.headers) };
}
const key = () => "ui-" + crypto.randomUUID();
const etag = (body, headers) => headers.etag || '"' + body.rowVersion + '"';
const iso = (date) => date.toISOString().replace("Z", "+00:00");
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function openBrowser(url) {
  const port = 9700 + Math.floor(Math.random() * 200);
  const proc = spawn(CHROME, ["--headless", "--no-sandbox", "--disable-gpu", "--no-first-run",
    "--no-default-browser-check", "--disable-crash-reporter", "--hide-scrollbars", "--force-device-scale-factor=1",
    "--remote-debugging-port=" + port, "--user-data-dir=/tmp/cdp-" + crypto.randomBytes(4).toString("hex"), url], { stdio: "ignore" });
  let target = null;
  for (let i = 0; i < 80 && !target; i++) {
    try {
      const list = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json();
      target = list.find((t) => t.type === "page" && String(t.url).startsWith("http"));
    } catch {}
    if (!target) await sleep(250);
  }
  if (!target) { proc.kill("SIGKILL"); throw new Error("no page target"); }
  const ws = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => { ws.addEventListener("open", resolve); ws.addEventListener("error", () => reject(new Error("cdp failed"))); });
  let seq = 0; const pending = new Map(); const network = [];
  ws.addEventListener("message", (event) => {
    const message = JSON.parse(event.data);
    if (message.method === "Network.requestWillBeSent" && String(message.params.request.url).includes("/api/v1/")) {
      network.push({ kind: "request", method: message.params.request.method, url: message.params.request.url, requestId: message.params.requestId });
    }
    if (message.method === "Network.responseReceived" && String(message.params.response.url).includes("/api/v1/")) {
      network.push({ kind: "response", status: message.params.response.status, url: message.params.response.url, requestId: message.params.requestId });
    }
    if (message.method === "Network.loadingFailed") {
      network.push({ kind: "failed", error: message.params.errorText, requestId: message.params.requestId });
    }
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
  await send("Runtime.enable"); await send("Page.enable"); await send("Network.enable");
  await send("Emulation.setDeviceMetricsOverride", { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });
  const evaluate = async (expression) => {
    const result = await send("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true, userGesture: true });
    if (result.exceptionDetails) throw new Error(result.exceptionDetails.text + " in " + expression);
    return result.result.value;
  };
  return { evaluate, send, network, kill: () => { try { ws.close(); } catch {} proc.kill("SIGKILL"); } };
}
async function waitFor(browser, expression, timeout = 10000) {
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
const openList = async (browser) => {
  await browser.evaluate("document.getElementById('bellBtn').click()");
  await waitFor(browser, "document.getElementById('overlay').hidden === false && document.getElementById('sheetTitle').textContent === '通知'");
  await waitFor(browser, "window.Pandora.idle()");
  await sleep(150);
  return waitFor(browser, "document.querySelectorAll('.notif').length > 0");
};

async function main() {
  const base = arg("base-url", "http://127.0.0.1:18102");
  const password = arg("password", "Demo@123456");
  const output = arg("output", null);

  const login = async (username) => {
    const result = await api(base, "POST", "/api/v1/auth/sessions", { body: { username, password } });
    if (result.status !== 200) throw new Error("login failed " + username);
    return result.body.token;
  };
  const admin = await login("admin");
  const middle = await login("middle");
  const employee = await login("employee");
  const colleague = await login("colleague");
  const me = async (token) => (await api(base, "GET", "/api/v1/me", { token })).body;
  const middleMe = await me(middle), employeeMe = await me(employee), colleagueMe = await me(colleague);

  // Set a phone so the person-detail boundary has an observable value.
  const profile = await api(base, "GET", "/api/v1/me/profile", { token: employee });
  await api(base, "PATCH", "/api/v1/me/profile", { token: employee, body: { phone: "13900002222" }, key: key(), etag: etag(profile.body, profile.headers) });

  const now = new Date();
  const create = async (token, title, assignees) => {
    const response = await api(base, "POST", "/api/v1/tasks", { token, key: key(), body: {
      title, description: "浏览器核验", acceptanceCriteria: "可复核", priority: "medium", allDay: false,
      assigneeIds: assignees, startAt: iso(new Date(now.getTime() + 3600_000)), dueAt: iso(new Date(now.getTime() + 172800_000)) } });
    if (response.status !== 201) throw new Error("create failed " + title + " " + JSON.stringify(response.body));
    return response.body;
  };
  const decide = async (token, requestId, decision = "approve") => {
    const current = await api(base, "GET", "/api/v1/approval-requests/" + requestId, { token });
    return api(base, "PATCH", "/api/v1/approval-requests/" + requestId, { token, key: key(), etag: etag(current.body, current.headers),
      body: { decision, comment: "浏览器核验" } });
  };
  const change = async (token, taskId, body) => {
    const current = await api(base, "GET", "/api/v1/tasks/" + taskId, { token });
    return api(base, "PATCH", "/api/v1/tasks/" + taskId, { token, key: key(), etag: etag(current.body, current.headers),
      body: Object.assign({ command: "change", reason: "浏览器核验" }, body) });
  };

  const approvedTask = await create(middle, "通知UI已办结 " + RUN, [employeeMe.id]);
  await decide(middle, approvedTask.requestId, "approve");
  const selfTask = await create(employee, "通知UI待审自建 " + RUN, [employeeMe.id]);
  const sharedTask = await create(middle, "通知UI移除负责人 " + RUN, [employeeMe.id, colleagueMe.id]);
  await decide(middle, sharedTask.requestId, "approve");
  const removal = await change(middle, sharedTask.taskId, { assigneeIds: [employeeMe.id] });
  await decide(middle, removal.body.requestId, "approve");
  await api(base, "POST", "/api/v1/admin/worker/run-once", { token: admin });
  await sleep(300);
  await api(base, "POST", "/api/v1/admin/worker/run-once", { token: admin });
  const employeeNotices = (await api(base, "GET", "/api/v1/notifications?limit=100", { token: employee })).body.items;
  const resolvedNotice = employeeNotices.find((row) => row.title === "通知UI已办结 " + RUN && row.eventType === "task.create.approved");
  const withdrawableNotice = employeeNotices.find((row) => row.title === "通知UI待审自建 " + RUN && row.eventType === "task.create.submitted");
  const colleagueNotices = (await api(base, "GET", "/api/v1/notifications?limit=100", { token: colleague })).body.items;
  const historicalNotice = colleagueNotices.find((row) => row.title === "通知UI移除负责人 " + RUN && row.relationLost === true);
  if (!resolvedNotice || !withdrawableNotice || !historicalNotice) {
    throw new Error("browser notification fixtures missing: " + JSON.stringify({resolved: !!resolvedNotice, withdrawable: !!withdrawableNotice, historical: !!historicalNotice}));
  }

  const browser = await openBrowser(base + "/");
  try {
    // Employee login.
    await waitFor(browser, "document.getElementById('backend-login')");
    await browser.evaluate(setValue("login-user", "employee"));
    await browser.evaluate(setValue("login-password", password));
    await browser.evaluate(submit("backend-login"));
    const ready = await waitFor(browser, "window.Pandora && window.Pandora.ready");
    check("7.7 the served page loads the real employee workspace", ready);

    const listReady = await openList(browser);
    check("7.7 the notification list opens from the bell", listReady);
    check("7.7 the list has no footer action bar", await browser.evaluate("document.getElementById('sheetFoot').hidden === true"));
    check("7.7 the header close button exists in the focus order",
      await browser.evaluate("!!document.getElementById('sheetClose') && document.getElementById('sheetClose').tabIndex >= 0"));
    check("7.3 the list shows real event titles", await browser.evaluate(text("#sheetBody") + ".includes(" + JSON.stringify("通知UI已办结 " + RUN) + ")"));

    // Open the resolved notification: auto-read, original result, no approve button.
    const clickId = (id) => `(() => { const b = document.querySelector('.notif[data-id="${id}"]'); if (!b) return false; b.click(); return true; })()`;
    await waitFor(browser, "window.Pandora.idle()");
    const clickedResolved = await browser.evaluate(clickId(resolvedNotice.id));
    const detailReady = clickedResolved && await waitFor(browser, text("#sheetTitle") + " === '通知详情'");
    check("7.3/7.7 opening a message shows its detail", detailReady);
    check("7.3 opening automatically marks the message read", await waitFor(browser, text("#sheetBody") + ".includes('已读')"));
    check("7.3 no manual read button remains", await browser.evaluate("!Array.from(document.querySelectorAll('button')).some(b => b.textContent === '标为已读')"));
    const resolvedEvidence = await browser.evaluate("JSON.stringify({body: document.getElementById('sheetBody').innerText.slice(0, 300), buttons: Array.from(document.querySelectorAll('button')).map(b => b.textContent)})");
    check("7.3 an old resolved request shows the result and no approve button",
      await browser.evaluate(text("#sheetBody") + ".includes('已办结') && !Array.from(document.querySelectorAll('#sheetBody button, #sheetFoot button')).some(b => b.textContent.includes('审核')) && Array.from(document.querySelectorAll('#sheetBody button, #sheetFoot button')).some(b => b.textContent.includes('查看原申请结果'))"),
      resolvedEvidence);
    let readBack = await api(base, "GET", "/api/v1/notifications/" + resolvedNotice.id, { token: employee });
    for (let i = 0; i < 10 && !readBack.body.readAt; i++) { await sleep(200); readBack = await api(base, "GET", "/api/v1/notifications/" + resolvedNotice.id, { token: employee }); }
    check("7.3 the read state is persisted and the unread count refreshes",
      readBack.status === 200 && !!readBack.body.readAt, readBack.body.readAt);

    // Withdraw the employee's own submitted event and inspect the placeholder.
    await browser.evaluate("document.getElementById('sheetClose').click()");
    await waitFor(browser, "document.getElementById('overlay').hidden === true");
    await openList(browser);
    await waitFor(browser, "window.Pandora.idle()");
    const withdrawClicked = await browser.evaluate(clickId(withdrawableNotice.id));
    const withdrawDetail = await waitFor(browser, text("#sheetTitle") + " === '通知详情'");
    const canWithdraw = withdrawClicked && withdrawDetail && await browser.evaluate("Array.from(document.querySelectorAll('button')).some(b => b.textContent === '撤回通知')");
    check("7.7 the business initiator sees the withdrawal action", canWithdraw);
    if (canWithdraw) {
      await browser.evaluate("Array.from(document.querySelectorAll('button')).find(b => b.textContent === '撤回通知').click()");
      await waitFor(browser, "document.querySelectorAll('.notif').length > 0 && window.Pandora.idle()");
      check("7.7 the withdrawn message is listed as withdrawn", await browser.evaluate(text("#sheetBody") + ".includes('已撤回')"));
      await browser.evaluate(clickId(withdrawableNotice.id));
      await waitFor(browser, text("#sheetTitle") + " === '通知详情'");
      check("7.7 withdrawal keeps a placeholder without a jump",
        await browser.evaluate(text("#sheetBody") + ".includes('该通知已被撤回。') && !Array.from(document.querySelectorAll('button')).some(b => b.textContent.includes('查看相关任务'))"));
    }
    await browser.evaluate("document.getElementById('sheetClose').click()");

    // Middle manager: subordinate entry and phone detail, no dispatch button.
    await browser.evaluate("window.Pandora.busy(() => window.Pandora.logout('middle'))");
    await waitFor(browser, "document.getElementById('backend-login')");
    await browser.evaluate(setValue("login-user", "middle"));
    await browser.evaluate(setValue("login-password", password));
    await browser.evaluate(submit("backend-login"));
    await waitFor(browser, "window.Pandora && window.Pandora.ready");
    await browser.evaluate("document.querySelector('#tabbar button[data-page=\"me\"]').click()");
    check("3.5 the 我的 page lists management-chain subordinates",
      await waitFor(browser, text("#page-me") + ".includes('下属资料')"));
    await browser.evaluate(`(() => { const b = Array.from(document.querySelectorAll('#page-me button')).find(x => x.textContent.includes('张涛') || x.textContent.includes('员工')); if (b) b.click(); return !!b; })()`);
    check("3.5 the subordinate detail opens from 我的", await waitFor(browser, text("#sheetTitle") + " === '人员资料'"));
    check("3.5 the actual superior reads the phone in the served page", await browser.evaluate(text("#sheetBody") + ".includes('13900002222')"));
    check("3.5 the profile card has no dispatch button", await browser.evaluate("!Array.from(document.querySelectorAll('button')).some(b => b.textContent.includes('派发'))"));

    // Colleague: historical read-only detail from the delivered removal message.
    await browser.evaluate("document.getElementById('sheetClose').click()");
    await browser.evaluate("window.Pandora.busy(() => window.Pandora.logout('colleague'))");
    await waitFor(browser, "document.getElementById('backend-login')");
    await browser.evaluate(setValue("login-user", "colleague"));
    await browser.evaluate(setValue("login-password", password));
    await browser.evaluate(submit("backend-login"));
    await waitFor(browser, "window.Pandora && window.Pandora.ready");
    await openList(browser);
    await waitFor(browser, "window.Pandora.idle()");
    const historyClicked = await browser.evaluate(clickId(historicalNotice.id));
    const historyDetail = historyClicked && await waitFor(browser, text("#sheetTitle") + " === '通知详情'");
    check("7.6 a removed recipient sees the read-only historical entry", historyClicked && historyDetail
      && await browser.evaluate("Array.from(document.querySelectorAll('button')).some(b => b.textContent.includes('查看历史只读详情'))"));
    await browser.evaluate("Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('查看历史只读详情')).click()");
    check("7.6 the historical read-only page opens", await waitFor(browser, text("#sheetTitle") + " === '历史只读详情'"));
    check("7.6 the historical page explains the lost current authority", await browser.evaluate(text("#sheetBody") + ".includes('不再具有该任务的当前权限')"));
    check("7.6 the historical page has no business action", await browser.evaluate("!Array.from(document.querySelectorAll('#sheetFoot button')).some(b => /审核|编辑|完成|重开|派发/.test(b.textContent))"));
  } finally {
    browser.kill();
  }

  const report = { success: results.every((row) => row.pass), checksPassed: results.filter((row) => row.pass).length,
    checksFailed: results.filter((row) => !row.pass).length, checks: results };
  if (output) {
    fs.mkdirSync(require("path").dirname(output), { recursive: true });
    fs.writeFileSync(output, JSON.stringify(report, null, 2) + "\n");
  }
  console.log((report.success ? "PASS" : "FAIL") + `: ${report.checksPassed} passed, ${report.checksFailed} failed`);
  return report.success ? 0 : 1;
}

main().then((code) => process.exit(code)).catch((error) => { console.error("FAIL", error); process.exit(1); });
