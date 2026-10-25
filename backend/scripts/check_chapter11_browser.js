#!/usr/bin/env node
"use strict";

/* Chapter 10/11 layout evidence against the packaged, served application.
 * Uses desktop Chrome/Edge device-metric emulation; this is not real-device evidence.
 */
/* Employees authenticate by phone number (chapter 2.1/2.3). */
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
  "/usr/bin/google-chrome", "/usr/bin/google-chrome-stable",
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
].find((candidate) => fs.existsSync(candidate));
const viewports = [[320, 740], [390, 844], [1440, 900]];
const checks = [];
function arg(name, fallback) { const i = process.argv.indexOf("--" + name); return i >= 0 ? process.argv[i + 1] : fallback; }
function check(viewport, name, pass, evidence) {
  checks.push({ viewport, check: name, pass: !!pass, evidence: evidence === undefined ? null : evidence });
  console.log((pass ? "PASS  " : "FAIL  ") + viewport + " " + name);
}
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function browser(url, width, height) {
  const port = 10200 + Math.floor(Math.random() * 400);
  const proc = spawn(CHROME, ["--headless", "--no-sandbox", "--disable-gpu", "--no-first-run",
    "--no-default-browser-check", "--disable-crash-reporter", "--force-device-scale-factor=1",
    "--remote-debugging-port=" + port,
    "--user-data-dir=" + path.join(os.tmpdir(), "pandora-cdp-" + crypto.randomBytes(4).toString("hex")), url], { stdio: "ignore" });
  let target;
  for (let i = 0; i < 100 && !target; i++) {
    try { target = (await (await fetch(`http://127.0.0.1:${port}/json/list`)).json()).find((x) => x.type === "page" && x.url.startsWith("http")); } catch {}
    if (!target) await sleep(200);
  }
  if (!target) throw new Error("no browser target");
  const ws = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => { ws.addEventListener("open", resolve); ws.addEventListener("error", reject); });
  let sequence = 0; const pending = new Map(); const errors = [];
  ws.addEventListener("message", (event) => {
    const message = JSON.parse(event.data);
    if (message.method === "Runtime.exceptionThrown") errors.push(message.params.exceptionDetails.text);
    if (message.method === "Network.loadingFailed" && message.params.errorText !== "net::ERR_ABORTED") errors.push(message.params.errorText);
    if (message.id && pending.has(message.id)) {
      const item = pending.get(message.id); pending.delete(message.id);
      message.error ? item.reject(new Error(JSON.stringify(message.error))) : item.resolve(message.result);
    }
  });
  const send = (method, params = {}) => new Promise((resolve, reject) => {
    const id = ++sequence; pending.set(id, { resolve, reject }); ws.send(JSON.stringify({ id, method, params }));
    setTimeout(() => { if (pending.delete(id)) reject(new Error("timeout " + method)); }, 20000);
  });
  await send("Runtime.enable"); await send("Page.enable"); await send("Network.enable");
  await send("Emulation.setDeviceMetricsOverride", { width, height, deviceScaleFactor: 1, mobile: true });
  const evaluate = async (expression) => {
    const value = await send("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true, userGesture: true });
    if (value.exceptionDetails) throw new Error(value.exceptionDetails.text);
    return value.result.value;
  };
  return { send, evaluate, errors, close() { try { ws.close(); } catch {} proc.kill("SIGKILL"); } };
}
async function waitFor(b, expression, timeout = 15000) {
  const end = Date.now() + timeout;
  while (Date.now() < end) { try { if (await b.evaluate(expression)) return true; } catch {} await sleep(150); }
  return false;
}
async function shot(b, filename) {
  const result = await b.send("Page.captureScreenshot", { format: "png", captureBeyondViewport: false });
  fs.writeFileSync(filename, Buffer.from(result.data, "base64"));
}
async function login(b, username, password) {
  await waitFor(b, "!!document.getElementById('backend-login')");
  await b.evaluate(`(() => { document.getElementById('login-user').value=${JSON.stringify(loginIdentity(username))}; document.getElementById('login-password').value=${JSON.stringify(password)}; document.getElementById('backend-login').requestSubmit(); })()`);
  return waitFor(b, "window.Pandora && window.Pandora.ready");
}

async function runViewport(base, password, outputDir, width, height) {
  const label = width + "x" + height;
  const b = await browser(base + "/", width, height);
  try {
    check(label, "login reaches real workspace", await login(b, "employee", password));

    await b.evaluate("document.querySelector('[data-page=\"view\"]').click()");
    await waitFor(b, "state.page === 'view' && !!document.querySelector('.p-schedule-fab')");
    await b.evaluate("document.querySelector('.p-schedule-fab').click()");
    await waitFor(b, "document.getElementById('sheetTitle').textContent === '创建任务' && window.Pandora.idle()");
    // Chapter 4.1 removed the completion criterion from creation; keep asserting the remaining
    // description field is usable and that the removed input has not come back.
    const fields = await b.evaluate("(() => { const d=document.getElementById('tf-desc'); return {desc:d ? d.getBoundingClientRect().height : 0, descMin:d ? getComputedStyle(d).minHeight : null, acceptance:!!document.getElementById('tf-acceptance')}; })()");
    check(label, "task description field is at least 234px and no completion criterion is required", fields.desc >= 234 && !fields.acceptance, fields);
    await shot(b, path.join(outputDir, "task-form-" + label + ".png"));
    // The task form guards an unsaved draft with a confirm dialog; accept it in headless automation.
    // Candidate loading may re-render the form once more after the sheet title appears; close until
    // the overlay really stays hidden.
    for (let attempt = 0; attempt < 6; attempt++) {
      if (await b.evaluate("document.getElementById('overlay').hidden === true")) break;
      await b.evaluate("window.confirm = () => true; window.closeSheet ? window.closeSheet() : document.getElementById('sheetClose').click()");
      await sleep(400);
    }
    await waitFor(b, "document.getElementById('overlay').hidden === true");

    await b.evaluate("document.querySelector('[data-page=\"log\"]').click()");
    await waitFor(b, "state.page === 'log' && window.Pandora.idle() && !!document.querySelector('[data-action=\"new-log\"]')");
    await waitFor(b, "window.Pandora.idle()");
    await b.evaluate("document.querySelector('[data-action=\"new-log\"]').click()");
    const logOpened = await waitFor(b, "document.getElementById('sheet').classList.contains('is-fullscreen') && !!document.getElementById('lf-content')");
    if (!logOpened) {
      const diagnostic = await b.evaluate("({ page: state.page, ready: window.Pandora.ready, title: document.getElementById('sheetTitle').textContent, overlay: document.getElementById('overlay').hidden, sheetClass: document.getElementById('sheet').className, lf: !!document.getElementById('lf-content'), body: (document.getElementById('sheetBody').textContent || '').slice(0, 120), error: (document.getElementById('lf-error') || {}).textContent || '', closeFn: typeof window.closeSheet, idle: window.Pandora.idle(), busy: document.querySelector('.app').getAttribute('aria-busy') })");
      console.log("LOGDIAG", JSON.stringify(diagnostic));
    }
    const logLayout = await b.evaluate("(() => { const r=document.getElementById('sheet').getBoundingClientRect(),o=document.getElementById('overlay').getBoundingClientRect(); return {fullscreen:document.getElementById('sheet').classList.contains('is-fullscreen'),width:r.width,height:r.height,overlayWidth:o.width,overlayHeight:o.height,viewport:[innerWidth,innerHeight],save:!!document.querySelector('[data-action=\"save-log\"]'),picker:!!document.querySelector('[data-action=\"pick-log-task\"]'),close:document.getElementById('sheetClose').tabIndex>=0}; })()");
    check(label, "log editor fills the application overlay with save, close and related-task controls", logLayout.fullscreen && Math.abs(logLayout.height-logLayout.overlayHeight) < 2 && Math.abs(logLayout.width-logLayout.overlayWidth) < 2 && logLayout.save && logLayout.picker && logLayout.close, logLayout);
    await b.evaluate("document.querySelector('[data-action=\"pick-log-task\"]').click()");
    check(label, "log related-task picker opens and exposes back navigation", await waitFor(b, "document.getElementById('sheetTitle').textContent === '选择关联任务' && !!document.querySelector('[data-action=\"sheet-back\"]')"));
    await b.evaluate("document.querySelector('[data-action=\"sheet-back\"]').click()");
    check(label, "back returns to the fullscreen log editor", await waitFor(b, "document.getElementById('sheet').classList.contains('is-fullscreen') && !!document.getElementById('lf-content')"));
    await shot(b, path.join(outputDir, "log-editor-" + label + ".png"));
    await b.evaluate("document.getElementById('sheetClose').click()");

    await b.evaluate("document.querySelector('[data-page=\"ai\"]').click()");
    const analyzed = await waitFor(b, "state.page === 'ai' && !/正在按当前权限重新计算/.test(document.getElementById('page-ai').textContent) && /生成于/.test(document.getElementById('page-ai').textContent)", 20000);
    const ai = await b.evaluate("(() => { const t=document.getElementById('page-ai').textContent; return {text:t,overflow:document.documentElement.scrollWidth>innerWidth,refresh:!!document.querySelector('[data-action=\"p-refresh-analysis\"]')}; })()");
    check(label, "AI auto-analysis shows scope, method, time and priority/pending counts", analyzed && /本人|部门|公司/.test(ai.text) && /本地规则分析/.test(ai.text) && /生成于/.test(ai.text) && /待完成审核/.test(ai.text) && /紧急程度分布/.test(ai.text) && ai.refresh, { analyzed, overflow: ai.overflow });
    check(label, "AI page has no horizontal viewport overflow", !ai.overflow, { overflow: ai.overflow });
    await shot(b, path.join(outputDir, "analysis-" + label + ".png"));
    check(label, "no uncaught script or network errors", b.errors.length === 0, b.errors);
  } finally { b.close(); }
}

async function runAdminViewport(base, password, outputDir, width, height) {
  const label = width + "x" + height;
  const b = await browser(base + "/admin.html", width, height);
  try {
    await waitFor(b, "!!document.getElementById('loginButton')");
    await b.evaluate(`(() => { document.getElementById('username').value='admin'; document.getElementById('password').value=${JSON.stringify(password)}; document.getElementById('loginButton').click(); })()`);
    const loaded = await waitFor(b, "document.getElementById('console').hidden === false && state.structure && document.querySelectorAll('#employeeRows tr').length > 0");
    check(label, "administrator console loads real organization data", loaded);
    const tabs = await b.evaluate("(() => { const buttons=Array.from(document.querySelectorAll('#tabs button')); const result=[]; for (const button of buttons) { button.click(); const section=Array.from(document.querySelectorAll('section.active'))[0]; result.push({label:button.textContent,active:section&&section.id}); } return result; })()");
    check(label, "all management tabs including task history and notification management are clickable",
      tabs.length === 9 && tabs.every((row) => row.active)
      && tabs.some((row) => row.label === '任务历史' && row.active === 'tab-history')
      && tabs.some((row) => row.label === '通知管理' && row.active === 'tab-notifications'), tabs);
    await b.evaluate("Array.from(document.querySelectorAll('#tabs button')).find((x) => x.textContent === '员工').click()");
    await b.evaluate("Array.from(document.querySelectorAll('#tabs button')).find((x) => x.textContent === '员工').click(); document.getElementById('employeeNew').click()");
    const dialog = await waitFor(b, "document.getElementById('employeeDialog').open && !!document.getElementById('fDepartment').value && !!document.getElementById('fPosition').value");
    check(label, "new employee management dialog is operable without SQL", dialog);
    await b.evaluate("document.getElementById('employeeCancel').click()");
    await shot(b, path.join(outputDir, "admin-" + label + ".png"));
    check(label, "administrator console has no uncaught script or network errors", b.errors.length === 0, b.errors);
  } finally { b.close(); }
}

async function runFrozenViewport(base, password, outputDir, width, height, taskId, username) {
  const label = width + "x" + height;
  const b = await browser(base + "/", width, height);
  try {
    check(label, "frozen-task actor reaches the real workspace", await login(b, username, password));
    await b.evaluate(`window.openTaskDetail(${JSON.stringify(taskId)})`);
    const opened = await waitFor(b, "document.getElementById('overlay').hidden === false && /当前展示的是有效版本/.test(document.getElementById('sheetBody').textContent)");
    const state = await b.evaluate(`(() => { const task=taskById(${JSON.stringify(taskId)}); const text=document.getElementById('sheetBody').textContent; return {opened:${opened},frozen:task&&task.frozen,title:task&&task.title,titleShown:task&&document.getElementById('sheetTitle').textContent===task.title,callout:/当前展示的是有效版本/.test(text),blocked:!document.querySelector('[data-action="edit-task"],[data-action="update-note"],[data-action="submit-complete"],[data-action="p-reopen-task"]')}; })()`);
    check(label, "pending change shows the old effective frozen task and blocks business edits", opened && state.frozen && state.titleShown && state.callout && state.blocked, state);
    await shot(b, path.join(outputDir, "frozen-effective-" + label + ".png"));
    check(label, "frozen-task view has no uncaught script or network errors", b.errors.length === 0, b.errors);
  } finally { b.close(); }
}

async function main() {
  const base = arg("base-url", "http://127.0.0.1:8080");
  const password = arg("password", "Demo@123456");
  const output = arg("output", "chapter11-browser.json");
  const outputDir = arg("screenshot-dir", path.join(path.dirname(output), "screenshots"));
  const frozenTaskId = arg("frozen-task-id", null);
  const frozenUsername = arg("frozen-username", "middle");
  fs.mkdirSync(outputDir, { recursive: true });
  for (const [width, height] of viewports) {
    await runViewport(base, password, outputDir, width, height);
    await runAdminViewport(base, password, outputDir, width, height);
    if (frozenTaskId) await runFrozenViewport(base, password, outputDir, width, height, frozenTaskId, frozenUsername);
  }
  const report = { generatedAt: new Date().toISOString(), baseUrl: base, browser: CHROME,
    evidenceType: "headless desktop browser with CDP viewport emulation; not a real device", viewports, passed: checks.filter((x) => x.pass).length, total: checks.length, checks };
  fs.writeFileSync(output, JSON.stringify(report, null, 2) + "\n");
  console.log(`${report.passed}/${report.total} checks passed`);
  return report.passed === report.total ? 0 : 1;
}
main().then((code) => process.exit(code)).catch((error) => { console.error(error); process.exit(2); });
