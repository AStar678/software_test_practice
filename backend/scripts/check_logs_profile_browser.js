#!/usr/bin/env node
"use strict";
/*
 * Browser verification for tasks 8.3/8.4: default-self logs, permission-scoped author tree/search,
 * removed mixed tabs, read-only subordinate logs, profile fields, management-chain subordinate list
 * and the separate log entry. Runs against a freshly seeded backend.
 *
 *   node scripts/check_logs_profile_browser.js --base-url http://127.0.0.1:18121
 */
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
const key = () => "ui-" + crypto.randomUUID();
const etag = (body, headers) => headers.etag || '"' + body.rowVersion + '"';

async function openBrowser(url) {
  const port = 9800 + Math.floor(Math.random() * 150);
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
  await send("Emulation.setDeviceMetricsOverride", { width: Number(arg("width", "390")), height: Number(arg("height", "844")), deviceScaleFactor: 1, mobile: true });
  const evaluate = async (expression) => {
    const result = await send("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true, userGesture: true });
    if (result.exceptionDetails) throw new Error(result.exceptionDetails.text + " in " + expression);
    return result.result.value;
  };
  return { evaluate, kill: () => { try { ws.close(); } catch {} proc.kill("SIGKILL"); } };
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
  return waitFor(browser, "window.Pandora && window.Pandora.ready && document.querySelector('[data-page=\"log\"]')");
}
async function logout(browser, next, password) {
  await browser.evaluate("window.Pandora.busy(() => window.Pandora.logout('" + next + "'))");
  await waitFor(browser, "!!document.getElementById('backend-login')");
  return login(browser, next, password);
}
async function openLogPage(browser) {
  await browser.evaluate(clickPage("log"));
  await waitFor(browser, "document.getElementById('logResults') && window.Pandora.idle()");
  await sleep(200);
}
async function openMePage(browser) {
  await browser.evaluate(clickPage("me"));
  await waitFor(browser, "document.getElementById('page-me') && window.Pandora.idle()");
  await sleep(150);
}

async function main() {
  const base = arg("base-url", "http://127.0.0.1:18121");
  const password = arg("password", "Demo@123456");
  const output = arg("output", null);
  const loginApi = async (username) => {
    const result = await api(base, "POST", "/api/v1/auth/sessions", { body: { username, password } });
    if (result.status !== 200) throw new Error("login failed " + username);
    return result.body.token;
  };
  const employee = await loginApi("employee");
  const profile = await api(base, "GET", "/api/v1/me/profile", { token: employee });
  const phone = "13900003333";
  await api(base, "PATCH", "/api/v1/me/profile", { token: employee, body: { phone }, key: key(), etag: etag(profile.body, profile.headers) });

  const browser = await openBrowser(base + "/");
  try {
    check("8.3 the browser reaches the login screen", await waitFor(browser, "!!document.getElementById('backend-login')"));
    await login(browser, "middle", password);
    await openLogPage(browser);

    const middleState = await browser.evaluate("({ me: window.Pandora.data.me.id, author: state.logAuthorId, all: state.logAll })");
    check("8.3 the log page defaults to the current user", middleState.author === middleState.me && middleState.all === false, middleState);
    check("8.3 no review or application tabs remain",
      await browser.evaluate("document.querySelectorAll('.p-log-tab').length === 0 && !/待我审核|我的申请|请示/.test(document.getElementById('page-log').textContent)"));
    check("8.3 no task creation or consultation command remains",
      await browser.evaluate("!document.querySelector('#page-log [data-action=\"new-task\"], #page-log [data-action=\"new-consult\"]')"));
    check("8.3 the author tree is permission scoped",
      await browser.evaluate("(() => { const names = Array.from(document.querySelectorAll('[data-log-author]')).map(b => b.textContent); return names.some(n => n.includes('张涛')) && names.some(n => n.includes('赵蕾')) && !names.some(n => n.includes('孙悦')); })()"));
    check("8.3 the manager can choose all visible logs", await browser.evaluate("!!document.querySelector('[data-log-all]')"));

    await browser.evaluate(setValue("logAuthorInput", "张"));
    await sleep(250);
    check("8.3 the author search keeps its input and filters the tree",
      await browser.evaluate("document.getElementById('logAuthorInput').value === '张' && Array.from(document.querySelectorAll('[data-log-author]')).some(b => b.textContent.includes('张涛')) && !Array.from(document.querySelectorAll('[data-log-author]')).some(b => b.textContent.includes('孙悦'))"));
    await browser.evaluate("Array.from(document.querySelectorAll('[data-log-author]')).find(b => b.textContent.includes('张涛')).click()");
    await waitFor(browser, "window.Pandora.idle() && document.querySelectorAll('.log-card').length > 0");
    await sleep(200);
    check("8.3 selecting a direct report loads only that author's logs",
      await browser.evaluate("Array.from(document.querySelectorAll('.log-card .who')).every(el => el.textContent.includes('张涛'))"));
    check("8.3 a subordinate log is read-only in the list",
      await browser.evaluate("Array.from(document.querySelectorAll('.log-card')).every(card => !card.querySelector('[data-action=\"edit-log\"]') && /只读/.test(card.textContent))"));

    await browser.evaluate(clickPage("map"));
    await openLogPage(browser);
    check("8.3 the search text and author survive page navigation",
      await browser.evaluate("document.getElementById('logAuthorInput').value === '张' && Array.from(document.querySelectorAll('[data-log-author][aria-pressed=\"true\"]')).some(b => b.textContent.includes('张涛'))"));

    await browser.evaluate("document.getElementById('appMain').scrollTop = 120; document.getElementById('appMain').dispatchEvent(new Event('scroll'))");
    await sleep(100);
    const topVisible = await browser.evaluate("!document.getElementById('toTopBtn').hidden");
    await browser.evaluate("document.getElementById('toTopBtn').click()");
    check("8.3 return-to-top keeps the author search",
      topVisible && await browser.evaluate("document.getElementById('appMain').scrollTop === 0 && document.getElementById('logAuthorInput').value === '张'"));

    await openMePage(browser);
    const meText = await browser.evaluate(text("#page-me"));
    check("8.4 the profile shows company, department, position, team and manager",
      ["公司", "部门", "职位", "独立团队", "直属上级"].every(label => meText.includes(label)), meText.slice(0, 240));
    check("8.4 the direct manager sees only direct reports",
      await browser.evaluate("(() => { const text = document.getElementById('page-me').textContent; return text.includes('张涛') && text.includes('赵蕾') && !text.includes('孙悦') && !text.includes('陈冲'); })()"));
    check("8.4 the subordinate card has no dispatch button",
      await browser.evaluate("!/派发/.test(document.getElementById('page-me').textContent)"));
    await browser.evaluate("Array.from(document.querySelectorAll('[data-action=\"p-open-person\"]')).find(b => b.textContent.includes('张涛')).click()");
    await waitFor(browser, "document.getElementById('overlay').hidden === false && /人员资料/.test(document.getElementById('sheetTitle').textContent)");
    check("8.4 the subordinate detail shows the authorized phone",
      await browser.evaluate("document.getElementById('sheetBody').textContent.includes('13900003333')"));
    check("8.4 the subordinate detail offers a separate log entry",
      await browser.evaluate("!!document.querySelector('[data-action=\"p-open-person-logs\"]')"));
    await browser.evaluate("document.querySelector('[data-action=\"p-open-person-logs\"]').click()");
    await waitFor(browser, "state.page === 'log' && window.Pandora.idle()");
    await sleep(200);
    check("8.4 the log entry opens the selected person's scope",
      await browser.evaluate("state.logAuthorId === window.Pandora.data.users.find(u => u.username === 'employee').id"));
    check("8.4 the selected person's logs are shown",
      await browser.evaluate("Array.from(document.querySelectorAll('.log-card .who')).every(el => el.textContent.includes('张涛'))"));

    await logout(browser, "upper", password);
    await openMePage(browser);
    check("8.4 the executive sees indirect subordinates",
      await browser.evaluate("(() => { const text = document.getElementById('page-me').textContent; return text.includes('张涛') && text.includes('孙悦') && !text.includes('派发'); })()"));
    await openLogPage(browser);
    check("8.4 the executive log page includes the company tree and all-visible scope",
      await browser.evaluate("!!document.querySelector('[data-log-all]') && Array.from(document.querySelectorAll('[data-log-author]')).some(b => b.textContent.includes('孙悦'))"));

    await logout(browser, "employee", password);
    await openMePage(browser);
    check("8.4 an employee has no subordinate section",
      await browser.evaluate("!/下属资料/.test(document.getElementById('page-me').textContent)"));
    await openLogPage(browser);
    check("8.4 an employee has only the self log scope",
      await browser.evaluate("!document.querySelector('[data-log-all]') && Array.from(document.querySelectorAll('[data-log-author]')).every(b => b.textContent.includes('张涛'))"));
  } finally {
    try {
      const current = await api(base, "GET", "/api/v1/me/profile", { token: employee });
      await api(base, "PATCH", "/api/v1/me/profile", { token: employee, body: { phone: profile.body.phone }, key: key(), etag: etag(current.body, current.headers) });
    } catch {}
    browser.kill();
    if (output) {
      fs.mkdirSync(require("path").dirname(output), { recursive: true });
      fs.writeFileSync(output, JSON.stringify({ viewport: { width: Number(arg("width", "390")), height: Number(arg("height", "844")) }, checks: results }, null, 2) + "\n");
    }
    const passed = results.filter((row) => row.pass).length;
    console.log(`\n${passed}/${results.length} browser checks passed`);
    if (passed !== results.length) process.exitCode = 1;
  }
}

main().catch((error) => { console.error(error); process.exitCode = 1; });
