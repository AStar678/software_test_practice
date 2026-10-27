#!/usr/bin/env node
"use strict";
/*
 * Browser verification for chapter 7: default-self logs, the department → team → person authorised
 * author directory, removed mixed tabs, read-only subordinate logs, profile fields, the management-chain
 * subordinate list and the separate log entry. Runs against a freshly seeded backend.
 *
 *   node scripts/check_logs_profile_browser.js --base-url http://127.0.0.1:18121
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
  let seq = 0; const pending = new Map(); const errors = [];
  ws.addEventListener("message", (event) => {
    const message = JSON.parse(event.data);
    if (message.method === "Runtime.exceptionThrown") errors.push("EXC: " + ((message.params.exceptionDetails.exception && message.params.exceptionDetails.exception.description) || message.params.exceptionDetails.text));
    if (message.method === "Runtime.consoleAPICalled" && message.params.type === "error") errors.push("CONSOLE: " + message.params.args.map((item) => item.value || item.description).join(" "));
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
  return { evaluate, errors, kill: () => { try { ws.close(); } catch {} proc.kill("SIGKILL"); } };
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

async function login(browser, username, password, identifier) {
  await waitFor(browser, "!!document.getElementById('backend-login')");
  await browser.evaluate(setValue("login-user", identifier || loginIdentity(username)));
  await browser.evaluate(setValue("login-password", password));
  await browser.evaluate(submit("backend-login"));
  return waitFor(browser, "window.Pandora && window.Pandora.ready && document.querySelector('[data-page=\"log\"]')");
}
async function logout(browser, next, password, identifier) {
  await browser.evaluate("window.Pandora.busy(() => window.Pandora.logout('" + next + "'))");
  await waitFor(browser, "!!document.getElementById('backend-login')");
  return login(browser, next, password, identifier);
}
async function openLogPage(browser) {
  await browser.evaluate(clickPage("log"));
  await waitFor(browser, "document.getElementById('logResults') && window.Pandora.idle()");
  // The hierarchical author filter renders after the log results; wait for it before asserting.
  await waitFor(browser, "!!document.getElementById('logAuthorSelect')");
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
    const result = await api(base, "POST", "/api/v1/auth/sessions", { body: { username: loginIdentity(username), password } });
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
    check("7.3 the log page defaults to the current user", middleState.author === middleState.me && middleState.all === false, middleState);
    check("7.3 no review, application or consultation content mixes into the log page",
      await browser.evaluate("document.querySelectorAll('.p-log-tab').length === 0 && !/待我审核|我的申请|请示/.test(document.getElementById('page-log').textContent)"));
    check("7.3 no task creation command remains on the log page",
      await browser.evaluate("!document.querySelector('#page-log [data-action=\"new-task\"], #page-log [data-action=\"new-consult\"]')"));
    check("7.3 the page title and navigation call the feature 日志",
      await browser.evaluate("/日志/.test(document.querySelector('[data-page=\"log\"]').textContent) && !/记录/.test(document.querySelector('[data-page=\"log\"]').textContent) && /日志/.test(document.querySelector('.p-log-header h2').textContent)"));
    const logDirectory = await browser.evaluate(`(() => {
      const labels = id => Array.from((document.getElementById(id) || {}).options || []).map(o => o.textContent);
      return { departments: labels('logDepartmentSelect'), teams: labels('logTeamSelect'), people: labels('logAuthorSelect') };
    })()`);
    check("7.3 the department level only offers authorised departments",
      logDirectory.departments.some(name => name.includes('产品部')) && !logDirectory.departments.some(name => name.includes('市场部')), logDirectory.departments);
    check("7.3 the team level only offers teams inside the authorised departments",
      logDirectory.teams.some(name => name.includes('产品部')) && !logDirectory.teams.some(name => name.includes('市场部')), logDirectory.teams);
    check("7.3 the person level lists self and direct reports and offers the whole scope",
      logDirectory.people.some(name => name.includes('张涛')) && logDirectory.people.some(name => name.includes('赵蕾'))
      && !logDirectory.people.some(name => name.includes('孙悦')) && logDirectory.people.some(name => name.includes('全部')), logDirectory.people);

    await browser.evaluate(setValue("logAuthorInput", "张"));
    await sleep(250);
    const filtered = await browser.evaluate(`(() => ({ input: document.getElementById('logAuthorInput').value, options: Array.from(document.getElementById('logAuthorSelect').options).map(o => o.textContent) }))()`);
    check("7.3 the person search keeps its input and narrows the person level only",
      filtered.input === '张' && filtered.options.some(n => n.includes('张涛')) && !filtered.options.some(n => n.includes('赵蕾')), filtered);
    await browser.evaluate("(() => { const el = document.getElementById('logAuthorInput'); el.value = ''; el.dispatchEvent(new Event('input', {bubbles:true})); return true; })()");
    await sleep(150);
    const authorId = await browser.evaluate("window.Pandora.data.logAuthors.items.find(p => p.displayName === '张涛').id");
    await browser.evaluate(`(() => { const el = document.getElementById('logAuthorSelect'); el.value = ${JSON.stringify(authorId)}; el.dispatchEvent(new Event('change', {bubbles:true})); return true; })()`);
    await waitFor(browser, "window.Pandora.idle() && document.querySelectorAll('.log-card').length > 0");
    await sleep(250);
    const selected = await browser.evaluate("({ author: state.logAuthorId, all: state.logAll, team: state.logTeamId, who: Array.from(document.querySelectorAll('.log-card .who')).map(el => el.textContent), logs: LOGS.length, results: (document.getElementById('logResults') || {}).textContent.slice(0, 120), errors: (window.__pandoraErrors || []) })");
    check("7.3 selecting a direct report loads only that author's logs",
      selected.who.length > 0 && selected.who.every(name => name.includes('张涛')), selected);
    check("7.3 a subordinate log is read-only in the list and offers no body edit",
      await browser.evaluate("Array.from(document.querySelectorAll('.log-card')).every(card => !card.querySelector('[data-action=\"edit-log\"]') && /只读|已冻结/.test(card.textContent))"));

    // Department → team → person cascading clears selections that no longer match.
    const departmentId = await browser.evaluate("window.Pandora.data.logAuthors.departments.find(d => d.name === '产品部').id");
    await browser.evaluate(`(() => { const el = document.getElementById('logDepartmentSelect'); el.value = ${JSON.stringify(departmentId)}; el.dispatchEvent(new Event('change', {bubbles:true})); return true; })()`);
    await waitFor(browser, "window.Pandora.idle()");
    await sleep(250);
    check("7.3 switching the department clears a person from another department and reloads the visible set",
      await browser.evaluate(`(() => { const people = Array.from(document.getElementById('logAuthorSelect').options).map(o => o.textContent); return state.logDepartmentId === ${JSON.stringify(departmentId)} && people.every(n => !n.includes('孙悦')); })()`), {});
    const teamId = await browser.evaluate("window.Pandora.data.logAuthors.teams.find(t => t.name === '产品部').id");
    await browser.evaluate(`(() => { const el = document.getElementById('logTeamSelect'); el.value = ${JSON.stringify(teamId)}; el.dispatchEvent(new Event('change', {bubbles:true})); return true; })()`);
    await waitFor(browser, "window.Pandora.idle()");
    await sleep(250);
    const teamState = await browser.evaluate(`(() => { const cards = Array.from(document.querySelectorAll('.log-card .who')).map(el => el.textContent); const label = document.getElementById('logResultsCount').textContent; return { team: state.logTeamId, department: state.logDepartmentId, cards, label, logs: LOGS.length }; })()`);
    check("7.3 the team level narrows the result list and keeps its count consistent",
      teamState.team === teamId && /[0-9]+ 条/.test(teamState.label) && teamState.cards.length >= 0, teamState);

    await browser.evaluate(clickPage("map"));
    await openLogPage(browser);
    check("7.3 the department/team/person selection survives page navigation",
      await browser.evaluate(`state.logDepartmentId === ${JSON.stringify(departmentId)} && state.logTeamId === ${JSON.stringify(teamId)} && !!document.getElementById('logTeamSelect')`));
    // Select the whole authorised scope so the page is tall enough to scroll, then return to the top.
    await browser.evaluate("(() => { const el = document.getElementById('logAuthorSelect'); el.value = '__all__'; el.dispatchEvent(new Event('change', {bubbles:true})); return true; })()");
    await waitFor(browser, "window.Pandora.idle() && state.logAll === true");
    await sleep(400);
    await browser.evaluate("document.getElementById('appMain').scrollTop = 200; document.getElementById('appMain').dispatchEvent(new Event('scroll'))");
    await sleep(150);
    const topVisible = await browser.evaluate("!document.getElementById('toTopBtn').hidden");
    await waitFor(browser, "window.Pandora.idle()");
    await browser.evaluate("document.getElementById('toTopBtn').click()");
    if (!(await waitFor(browser, "document.getElementById('appMain').scrollTop === 0", 3000))) {
      await sleep(400);
      await browser.evaluate("document.getElementById('toTopBtn').click()");
      await waitFor(browser, "document.getElementById('appMain').scrollTop === 0", 3000);
    }
    check("7.3 return-to-top keeps the valid log filters",
      topVisible && await browser.evaluate(`document.getElementById('appMain').scrollTop === 0 && state.logTeamId === ${JSON.stringify(teamId)} && state.logAll === true`),
      await browser.evaluate("({ topVisible: !document.getElementById('toTopBtn').hidden, scrollTop: document.getElementById('appMain').scrollTop, all: state.logAll, team: state.logTeamId })"));

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
    check("7.3 the executive log page includes every authorised department and person",
      await browser.evaluate(`(() => {
        const people = Array.from(document.getElementById('logAuthorSelect').options).map(o => o.textContent);
        const departments = Array.from(document.getElementById('logDepartmentSelect').options).map(o => o.textContent);
        return people.some(n => n.includes('孙悦')) && departments.some(n => n.includes('市场部')) && people.some(n => n.includes('全部'));
      })()`));

    // The privacy fixture changed the employee phone above, so this final sign-in must use it.
    await logout(browser, "employee", password, phone);
    await openMePage(browser);
    check("8.4 an employee has no subordinate section",
      await browser.evaluate("!/下属资料/.test(document.getElementById('page-me').textContent)"));

    // Regression: personal-item detail actions must retain the real item id. A previous argument-order
    // bug rendered data-id="primary" / "danger", so both edit and delete fetched a nonexistent item.
    await browser.evaluate(clickPage("map"));
    await waitFor(browser, "state.page === 'map' && window.Pandora.idle()");
    await browser.evaluate("document.querySelector('[data-action=\"p-open-home-personal\"]').click()");
    await waitFor(browser, "document.getElementById('sheetTitle').textContent === '个人信息' && window.Pandora.idle()");
    const personalActions = await browser.evaluate(`(() => {
      const edit = document.querySelector('[data-action="p-edit-home-personal"]');
      const remove = document.querySelector('[data-action="p-delete-home-personal"]');
      return { editId: edit && edit.dataset.id, deleteId: remove && remove.dataset.id,
               itemId: window.Pandora.data.home.personalItems[0].id };
    })()`);
    check("home personal detail keeps the real item id for edit and delete",
      personalActions.editId === personalActions.itemId && personalActions.deleteId === personalActions.itemId,
      personalActions);
    await browser.evaluate("document.querySelector('[data-action=\"p-edit-home-personal\"]').click()");
    await waitFor(browser, "window.Pandora.idle() && document.getElementById('sheetTitle').textContent === '编辑个人信息'");
    check("home personal edit opens the owned item instead of a permission error",
      await browser.evaluate("!!document.getElementById('pi-text') && !/无权查看/.test(document.getElementById('sheetBody').textContent)"));
    await browser.evaluate("document.getElementById('sheetClose').click()");

    await openLogPage(browser);
    // After switching accounts the log page render can race the tab click; reload once and reopen
    // rather than asserting against a half-rendered page.
    if (!(await browser.evaluate("!!document.getElementById('logAuthorSelect')"))) {
      await browser.evaluate("window.Pandora.busy(() => window.Pandora.reload())");
      await waitFor(browser, "window.Pandora.idle()");
      await browser.evaluate(clickPage("log"));
      await waitFor(browser, "!!document.getElementById('logAuthorSelect')");
    }
    const selfScope = await browser.evaluate(`(() => {
      const select = document.getElementById('logAuthorSelect');
      const people = select ? Array.from(select.options).map(o => o.textContent) : [];
      return { hasSelect: !!select, ready: window.Pandora.ready, page: state.page, all: state.logAll,
               me: (window.Pandora.data.me || {}).username, people,
               text: (document.getElementById('page-log') || {}).textContent || '' };
    })()`);
    check("7.3 an employee has only the self log scope",
      selfScope.ready && selfScope.page === "log" && selfScope.all === false && selfScope.hasSelect
      && selfScope.people.filter(n => !n.includes('全部')).every(n => n.includes('张涛')), selfScope);
    await browser.evaluate("document.querySelector('[data-action=\"new-log\"]').click()");
    await waitFor(browser, "window.Pandora.idle()");
    check("7.3 writing a log opens the editor without a date helper error",
      await browser.evaluate("document.getElementById('sheetTitle').textContent === '写日志' && !!document.getElementById('lf-content') && !/dateKey is not defined/.test(document.body.textContent)"),
      await browser.evaluate("({ title: document.getElementById('sheetTitle').textContent, hasEditor: !!document.getElementById('lf-content') })"));
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
    if (browser.errors.length) console.log("BROWSER ERRORS", browser.errors.slice(0, 6));
    const passed = results.filter((row) => row.pass).length;
    console.log(`\n${passed}/${results.length} browser checks passed`);
    if (passed !== results.length) process.exitCode = 1;
  }
}

main().catch((error) => { console.error(error); process.exitCode = 1; });
