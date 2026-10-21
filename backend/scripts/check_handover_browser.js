#!/usr/bin/env node
"use strict";
/*
 * Real-browser verification for the dedicated handover preset and entry (V-010 / DEV-004).
 *
 * Employee: open 我的 -> 交接预设, save a target, then open the task from 视图 search and submit a
 * dedicated handover that uses the persisted preset. Direct manager: open a subordinate task from
 * 视图 search, save the preset from the task sheet and submit the handover. Both identities also
 * expose accessible buttons at the requested viewport.
 *
 *   node scripts/check_handover_browser.js --base-url http://127.0.0.1:18500 \
 *       --width 390 --height 844 --output handover-browser.json --screenshot-dir shots/
 */
const { spawn } = require("child_process");
const crypto = require("crypto");
const fs = require("fs");
const os = require("os");
const path = require("path");

const CHROME = process.env.CHROME_BIN || [
  "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
  "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
  "/usr/bin/google-chrome", "/usr/bin/google-chrome-stable",
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
].find((candidate) => fs.existsSync(candidate));
const results = [];
const RUN = crypto.randomBytes(3).toString("hex");
const PASSWORD = "Demo@123456";

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
  const port = 9900 + Math.floor(Math.random() * 200);
  const proc = spawn(CHROME, ["--headless", "--no-sandbox", "--disable-gpu", "--no-first-run",
    "--no-default-browser-check", "--disable-crash-reporter", "--hide-scrollbars", "--force-device-scale-factor=1",
    "--remote-debugging-port=" + port, "--user-data-dir=" + path.join(os.tmpdir(), "pandora-ho-" + crypto.randomBytes(4).toString("hex")), url], { stdio: "ignore" });
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
  await send("Emulation.setDeviceMetricsOverride", { width: Number(arg("width", "390")), height: Number(arg("height", "844")), deviceScaleFactor: 1, mobile: true });
  const evaluate = async (expression) => {
    const result = await send("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true, userGesture: true });
    if (result.exceptionDetails) throw new Error(result.exceptionDetails.text + " in " + expression);
    return result.result.value;
  };
  return { evaluate, send, kill: () => { try { ws.close(); } catch {} proc.kill("SIGKILL"); } };
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
const setSelect = (id, value) => `(() => { const el = document.getElementById(${JSON.stringify(id)}); if (!el) return false; el.value = ${JSON.stringify(value)}; el.dispatchEvent(new Event("change", {bubbles:true})); return true; })()`;
const submit = (id) => `(() => { const el = document.getElementById(${JSON.stringify(id)}); if (!el) return false; el.requestSubmit(); return true; })()`;
const clickText = (label) => `(() => { const el = Array.from(document.querySelectorAll("button")).find(b => (b.textContent || "").trim() === ${JSON.stringify(label)}); if (!el) return false; el.click(); return true; })()`;
const visible = (label) => `(() => { const el = Array.from(document.querySelectorAll("button")).find(b => (b.textContent || "").trim() === ${JSON.stringify(label)}); if (!el) return false; const r = el.getBoundingClientRect(); return r.width > 0 && r.height > 0 && r.right <= innerWidth + 1 && r.left >= -1 && r.top >= -1 && r.bottom <= innerHeight + 1; })()`;

async function loginPage(browser, username) {
  await waitFor(browser, "document.getElementById('backend-login')");
  await browser.evaluate(setValue("login-user", username));
  await browser.evaluate(setValue("login-password", PASSWORD));
  await browser.evaluate(submit("backend-login"));
  return waitFor(browser, "window.Pandora && window.Pandora.ready");
}

async function searchAndOpen(browser, title) {
  await browser.evaluate("document.querySelector('#tabbar button[data-page=\"view\"]').click()");
  const ready = await waitFor(browser, "!!document.getElementById('p-schedule-search')");
  if (!ready) return false;
  await browser.evaluate(setValue("p-schedule-search", title));
  const found = await waitFor(browser, `Array.from(document.querySelectorAll('.p-search-row')).some(b => (b.textContent || '').includes(${JSON.stringify(title)}))`);
  if (!found) return false;
  await browser.evaluate(`(() => { const b = Array.from(document.querySelectorAll('.p-search-row')).find(x => (x.textContent || '').includes(${JSON.stringify(title)})); if (!b) return false; b.click(); return true; })()`);
  return waitFor(browser, text("#sheetTitle") + " === " + JSON.stringify(title));
}

async function main() {
  const base = arg("base-url", "http://127.0.0.1:18500");
  const output = arg("output", null);
  const shotDir = arg("screenshot-dir", null);
  if (shotDir) fs.mkdirSync(shotDir, { recursive: true });

  const login = async (username) => (await api(base, "POST", "/api/v1/auth/sessions", { body: { username, password: PASSWORD } })).body.token;
  const admin = await login("admin");
  const middle = await login("middle");
  const employee = await login("employee");
  const colleague = await login("colleague");
  const upper = await login("upper");
  const me = async (token) => (await api(base, "GET", "/api/v1/me", { token })).body;
  const employeeMe = await me(employee), colleagueMe = await me(colleague), middleMe = await me(middle), upperMe = await me(upper);

  const now = new Date();
  const createApproved = async (title, assignees, creatorToken = middle, approverToken = middle) => {
    const response = await api(base, "POST", "/api/v1/tasks", { token: creatorToken, key: key(), body: {
      title, description: "交接界面核验", acceptanceCriteria: "可复核", priority: "medium", allDay: false,
      assigneeIds: assignees, startAt: iso(new Date(now.getTime() + 3600_000)), dueAt: iso(new Date(now.getTime() + 172800_000)) } });
    if (response.status !== 201) throw new Error("create failed " + title + " " + JSON.stringify(response.body));
    const current = await api(base, "GET", "/api/v1/approval-requests/" + response.body.requestId, { token: approverToken });
    const approved = await api(base, "PATCH", "/api/v1/approval-requests/" + response.body.requestId, { token: approverToken, key: key(),
      etag: etag(current.body, current.headers), body: { decision: "approve", comment: "浏览器核验" } });
    if (approved.status !== 200) throw new Error("approve failed " + JSON.stringify(approved.body));
    return response.body.taskId;
  };
  const employeeTask = await createApproved("交接UI员工任务 " + RUN, [employeeMe.id]);
  const managerTask = await createApproved("交接UI领导任务 " + RUN, [employeeMe.id], upper, middle);
  const managerTaskRow = await api(base, "GET", "/api/v1/tasks/" + managerTask, { token: middle });
  if (managerTaskRow.body.originalCreatorId !== upperMe.id) throw new Error("manager fixture creator mismatch");

  const browser = await openBrowser(base + "/");
  try {
    const employeeReady = await loginPage(browser, "employee");
    check("V-010 the served page loads the real employee workspace", employeeReady);

    await browser.evaluate("document.querySelector('#tabbar button[data-page=\"me\"]').click()");
    check("V-010 我的 exposes a handover preset entry",
      await waitFor(browser, `Array.from(document.querySelectorAll('#page-me button')).some(b => b.textContent.trim() === '交接预设')`));
    check("V-010 the preset entry is reachable at this viewport", await browser.evaluate(visible("交接预设")));
    await browser.evaluate(clickText("交接预设"));
    check("V-010 the preset sheet opens from 我的", await waitFor(browser, text("#sheetTitle") + " === '交接预设'"));
    await browser.evaluate(setValue("hp-target", colleagueMe.id));
    await browser.evaluate(clickText("保存预设"));
    await waitFor(browser, "window.Pandora.idle()");
    await sleep(300);
    let employeePreset = await api(base, "GET", "/api/v1/users/" + employeeMe.id + "/handover-preset", { token: employee });
    for (let i = 0; i < 10 && employeePreset.body.targetUserId !== colleagueMe.id; i++) {
      await sleep(200);
      employeePreset = await api(base, "GET", "/api/v1/users/" + employeeMe.id + "/handover-preset", { token: employee });
    }
    check("V-010 the employee saves the preset through the actual page",
      employeePreset.status === 200 && employeePreset.body.targetUserId === colleagueMe.id,
      employeePreset.body);
    if (shotDir) await browser.send("Page.captureScreenshot", { format: "png" }).then((r) => fs.writeFileSync(path.join(shotDir, "employee-preset-" + RUN + ".png"), Buffer.from(r.data, "base64")));

    await browser.evaluate("document.querySelector('#sheetClose').click()");
    await waitFor(browser, "document.getElementById('overlay').hidden === true");
    const opened = await searchAndOpen(browser, "交接UI员工任务 " + RUN);
    check("V-010 the employee opens the task from the served search", opened);
    check("V-010 the task detail exposes the dedicated handover entry",
      await waitFor(browser, `Array.from(document.querySelectorAll('#sheetFoot button')).some(b => b.textContent.trim() === '专用交接')`));
    check("V-010 the handover entry is reachable at this viewport", await browser.evaluate(visible("专用交接")));
    await browser.evaluate(clickText("专用交接"));
    check("V-010 the handover sheet opens", await waitFor(browser, text("#sheetTitle") + " === '专用交接'"));
    const presetSelected = await browser.evaluate(`(document.querySelector('[data-handover-target="${employeeMe.id}"]') || {}).value === ${JSON.stringify(colleagueMe.id)}`);
    check("V-010 the saved preset is preselected in the handover sheet", presetSelected);
    await waitFor(browser, `(document.getElementById('ho-preview-${employeeMe.id}') || {}).textContent.includes('审核人')`);
    const colleaguePreview = await browser.evaluate(`(document.getElementById('ho-preview-${employeeMe.id}') || {}).textContent || ""`);
    check("V-010 the form shows the actual new reviewer for the selected colleague", colleaguePreview.includes("李敏"),
      { preview: colleaguePreview });
    await browser.evaluate(setSelect("ho-target-" + employeeMe.id, middleMe.id));
    const upperPreview = await waitFor(browser, `(document.getElementById('ho-preview-${employeeMe.id}') || {}).textContent.includes('王海')`, 10000)
      ? await browser.evaluate(`(document.getElementById('ho-preview-${employeeMe.id}') || {}).textContent || ""`) : "";
    check("V-010 changing the target updates the proposed reviewer before submit", upperPreview.includes("王海"),
      { preview: upperPreview });
    await browser.evaluate(setSelect("ho-target-" + employeeMe.id, colleagueMe.id));
    await waitFor(browser, `(document.getElementById('ho-preview-${employeeMe.id}') || {}).textContent.includes('李敏')`, 10000);
    await browser.evaluate(clickText("发起专用交接"));
    const requestPending = await waitFor(browser, "document.getElementById('overlay').hidden === true");
    check("V-010 submitting the handover closes the sheet after the pending request", requestPending);
    const requests = await api(base, "GET", "/api/v1/approval-requests?mine=all&limit=100", { token: employee });
    const pendingHandover = (requests.body.items || []).find((row) => row.taskId === employeeTask && row.kind === "handover" && row.status === "pending");
    check("V-010 the page submission creates a pending handover", !!pendingHandover,
      pendingHandover || requests.body);
    check("V-010 the pre-submit reviewer matches the pending request reviewer",
      !!pendingHandover && pendingHandover.currentReviewerId === middleMe.id,
      pendingHandover && pendingHandover.currentReviewerId);
    if (pendingHandover) {
      const current = await api(base, "GET", "/api/v1/approval-requests/" + pendingHandover.id, { token: middle });
      await api(base, "PATCH", "/api/v1/approval-requests/" + pendingHandover.id, { token: middle, key: key(),
        etag: etag(current.body, current.headers), body: { decision: "approve", comment: "浏览器核验" } });
    }

    await browser.evaluate("window.Pandora.busy(() => window.Pandora.logout('middle'))");
    const middleReady = await loginPage(browser, "middle");
    check("V-010 the served page loads the real manager workspace", middleReady);
    const managerOpened = await searchAndOpen(browser, "交接UI领导任务 " + RUN);
    check("V-010 the direct manager opens the subordinate task from search", managerOpened);
    check("V-010 the manager sees the dedicated handover entry",
      await waitFor(browser, `Array.from(document.querySelectorAll('#sheetFoot button')).some(b => b.textContent.trim() === '专用交接')`));
    await browser.evaluate(clickText("专用交接"));
    check("V-010 the manager handover sheet opens", await waitFor(browser, text("#sheetTitle") + " === '专用交接'"));
    await browser.evaluate(setSelect("ho-target-" + employeeMe.id, middleMe.id));
    await waitFor(browser, `(document.getElementById('ho-preview-${employeeMe.id}') || {}).textContent.includes('王海')`, 10000);
    const managerPreview = await browser.evaluate(`(document.getElementById('ho-preview-${employeeMe.id}') || {}).textContent || ""`);
    check("V-010 the manager sees the actual new reviewer before submit", managerPreview.includes("王海"),
      { preview: managerPreview });
    await browser.evaluate(clickText("保存为预设"));
    await waitFor(browser, "window.Pandora.idle()");
    await sleep(300);
    let managerPreset = await api(base, "GET", "/api/v1/users/" + employeeMe.id + "/handover-preset", { token: middle });
    for (let i = 0; i < 10 && managerPreset.body.targetUserId !== middleMe.id; i++) {
      await sleep(200);
      managerPreset = await api(base, "GET", "/api/v1/users/" + employeeMe.id + "/handover-preset", { token: middle });
    }
    check("V-010 the manager saves the preset for the subordinate through the page",
      managerPreset.status === 200 && managerPreset.body.targetUserId === middleMe.id
      && managerPreset.body.setByUserId === middleMe.id, managerPreset.body);
    if (shotDir) await browser.send("Page.captureScreenshot", { format: "png" }).then((r) => fs.writeFileSync(path.join(shotDir, "manager-handover-" + RUN + ".png"), Buffer.from(r.data, "base64")));
    await browser.evaluate(clickText("发起专用交接"));
    await waitFor(browser, "document.getElementById('overlay').hidden === true");
    const managerRequests = await api(base, "GET", "/api/v1/approval-requests?mine=all&limit=100", { token: middle });
    const managerPending = (managerRequests.body.items || []).find((row) => row.taskId === managerTask && row.kind === "handover" && row.status === "pending");
    check("V-010 the manager submits a handover using the saved preset", !!managerPending, managerPending || managerRequests.body);
    if (managerPending) {
      const current = await api(base, "GET", "/api/v1/approval-requests/" + managerPending.id, { token: middle });
      await api(base, "PATCH", "/api/v1/approval-requests/" + managerPending.id, { token: middle, key: key(),
        etag: etag(current.body, current.headers), body: { decision: "approve", comment: "浏览器核验" } });
    }
  } finally {
    browser.kill();
  }

  const report = { success: results.every((row) => row.pass),
    viewport: { width: Number(arg("width", "390")), height: Number(arg("height", "844")) },
    checksPassed: results.filter((row) => row.pass).length,
    checksFailed: results.filter((row) => !row.pass).length, checks: results };
  if (output) {
    fs.mkdirSync(path.dirname(output), { recursive: true });
    fs.writeFileSync(output, JSON.stringify(report, null, 2) + "\n");
  }
  console.log((report.success ? "PASS" : "FAIL") + `: ${report.checksPassed} passed, ${report.checksFailed} failed`);
  return report.success ? 0 : 1;
}

main().then((code) => process.exit(code)).catch((error) => { console.error("FAIL", error); process.exit(1); });
