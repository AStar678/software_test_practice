#!/usr/bin/env node
"use strict";
/*
 * PC browser verification for chapter 9: the formal administration console's task-history and
 * notification-management tabs, and the restricted team-management entry in the employee "My" page.
 * Runs against a freshly seeded backend with a controllable clock and the event worker enabled.
 *
 *   CHECK_FIXED_TIME=2026-10-25T04:00:00Z CHECK_WORKER=true \
 *     ./scripts/run_check_isolated.sh node scripts/check_admin_console_browser.js --base-url {base}
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
  "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
  "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  "/usr/bin/google-chrome", "/usr/bin/google-chrome-stable",
].find((candidate) => fs.existsSync(candidate));
const RUN = crypto.randomBytes(3).toString("hex");
const results = [];
const checks = results;
function arg(name, fallback) { const i = process.argv.indexOf("--" + name); return i >= 0 ? process.argv[i + 1] : fallback; }
function check(name, pass, evidence) {
  results.push({ check: name, pass: !!pass, evidence: evidence === undefined ? null : evidence });
  console.log((pass ? "PASS  " : "FAIL  ") + name + (pass ? "" : "  -> " + JSON.stringify(evidence)));
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
const key = () => "ui9-" + crypto.randomUUID();
const etag = (body, headers) => headers.etag || '"' + body.rowVersion + '"';

async function openBrowser(url, width = 1440, height = 900) {
  const port = 10300 + Math.floor(Math.random() * 300);
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
  await send("Runtime.enable"); await send("Page.enable"); await send("Network.enable");
  await send("Emulation.setDeviceMetricsOverride", { width, height, deviceScaleFactor: 1, mobile: false });
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

async function prepareScenario(base, password) {
  const tokens = {};
  const logins = {};
  for (const who of ["admin", "middle", "upper", "employee", "colleague"]) {
    const result = await api(base, "POST", "/api/v1/auth/sessions", { body: { username: loginIdentity(who), password } });
    if (result.status !== 200) throw new Error("login failed " + who);
    tokens[who] = result.body.token;
    logins[who] = result.body.user.id;
  }
  const tokenFor = (id) => Object.entries(logins).find(([, userId]) => userId === id)?.[0];
  const employees = (await api(base, "GET", "/api/v1/admin/employees", { token: tokens.admin })).body.items;
  const ids = Object.fromEntries(employees.map((row) => [row.username, row.id]));
  const decide = async (requestId, viewer, decision, comment) => {
    const detail = await api(base, "GET", "/api/v1/approval-requests/" + requestId, { token: tokens[viewer] });
    if (detail.status !== 200) return detail;
    const reviewerName = tokenFor(detail.body.currentReviewerId || detail.body.reviewerId);
    return api(base, "PATCH", "/api/v1/approval-requests/" + requestId,
      { token: tokens[reviewerName] || tokens[viewer], body: { decision, comment }, key: key(), etag: etag(detail.body, detail.headers) });
  };
  const now = new Date();
  const ago = (days) => new Date(now.getTime() + days * 86400000).toISOString();
  const created = await api(base, "POST", "/api/v1/tasks", { token: tokens.middle, key: key(), body: {
    title: "浏览器历史-" + RUN, description: "管理端浏览器历史核验", priority: "medium", allDay: false,
    assigneeIds: [ids.employee], startAt: ago(1), dueAt: ago(3) } });
  if (created.status !== 201) throw new Error("scenario create failed " + JSON.stringify(created));
  const taskId = created.body.taskId;
  if (created.body.requestId) await decide(created.body.requestId, "middle", "approve", "浏览器创建审核-" + RUN);
  let detail = await api(base, "GET", "/api/v1/tasks/" + taskId, { token: tokens.middle });
  let changed = await api(base, "PATCH", "/api/v1/tasks/" + taskId, { token: tokens.middle, key: key(), etag: etag(detail.body, detail.headers),
    body: { command: "change", title: "浏览器历史-" + RUN + "-改序", assigneeIds: [ids.colleague, ids.employee], reason: "浏览器改序-" + RUN } });
  if (changed.body.requestId) await decide(changed.body.requestId, "middle", "approve", "浏览器改序审核-" + RUN);
  // Pending change, then take the reviewer's availability away to force a recorded reassignment.
  detail = await api(base, "GET", "/api/v1/tasks/" + taskId, { token: tokens.middle });
  const pendingChange = await api(base, "PATCH", "/api/v1/tasks/" + taskId, { token: tokens.middle, key: key(), etag: etag(detail.body, detail.headers),
    body: { command: "change", title: "浏览器历史-" + RUN + "-改派前", reason: "浏览器改派-" + RUN } });
  const middleDetail = await api(base, "GET", "/api/v1/admin/employees/" + ids.middle, { token: tokens.admin });
  await api(base, "PATCH", "/api/v1/admin/employees/" + ids.middle, { token: tokens.admin, key: key(), etag: middleDetail.headers.etag,
    body: { reviewerAvailable: false } });
  if (pendingChange.body.requestId) await decide(pendingChange.body.requestId, "middle", "reject", "浏览器改派后拒绝-" + RUN);
  const middleRestore = await api(base, "GET", "/api/v1/admin/employees/" + ids.middle, { token: tokens.admin });
  await api(base, "PATCH", "/api/v1/admin/employees/" + ids.middle, { token: tokens.admin, key: key(), etag: middleRestore.headers.etag,
    body: { reviewerAvailable: true } });
  // Handover one position to the manager, complete as the remaining owner, then reopen.
  detail = await api(base, "GET", "/api/v1/tasks/" + taskId, { token: tokens.middle });
  const handover = await api(base, "POST", "/api/v1/tasks/" + taskId + "/handover", { token: tokens.middle, key: key(), etag: etag(detail.body, detail.headers),
    body: { sourceUserId: ids.employee, targetUserId: ids.middle, reason: "浏览器交接-" + RUN } });
  if (handover.body.requestId) await decide(handover.body.requestId, "middle", "approve", "浏览器交接审核-" + RUN);
  detail = await api(base, "GET", "/api/v1/tasks/" + taskId, { token: tokens.colleague });
  const complete = await api(base, "PATCH", "/api/v1/tasks/" + taskId, { token: tokens.colleague, key: key(), etag: etag(detail.body, detail.headers),
    body: { command: "complete", completionNote: "浏览器完成-" + RUN } });
  if (complete.body.requestId) await decide(complete.body.requestId, "colleague", "approve", "浏览器完成审核-" + RUN);
  detail = await api(base, "GET", "/api/v1/tasks/" + taskId, { token: tokens.middle });
  const reopened = await api(base, "PATCH", "/api/v1/tasks/" + taskId, { token: tokens.middle, key: key(), etag: etag(detail.body, detail.headers),
    body: { command: "reopen", reason: "浏览器重开-" + RUN, allDay: false, startAt: ago(5), dueAt: ago(7) } });
  if (reopened.body.requestId) await decide(reopened.body.requestId, "middle", "approve", "浏览器重开审核-" + RUN);
  // A separate founder-created task keeps a genuine no-review reason in its history.
  const exempt = await api(base, "POST", "/api/v1/tasks", { token: tokens.upper, key: key(), body: {
    title: "浏览器免审-" + RUN, description: "免审历史核验", priority: "low", allDay: false,
    assigneeIds: [ids.employee], startAt: ago(2), dueAt: ago(4) } });
  await api(base, "POST", "/api/v1/admin/worker/run-once", { token: tokens.admin, key: key(), body: {} });
  return { tokens, ids, taskId, exemptTaskId: exempt.body.taskId };
}

async function runAdmin(base, password) {
  const browser = await openBrowser(base + "/admin.html", 1440, 900);
  try {
    await waitFor(browser, "!!document.getElementById('loginButton') && !!window.state");
    await browser.evaluate(`(() => { document.getElementById('username').value='admin'; document.getElementById('password').value=${JSON.stringify(password)}; document.getElementById('loginButton').click(); })()`);
    const loaded = await waitFor(browser, "document.getElementById('console').hidden === false && state.structure && document.querySelectorAll('#employeeRows tr').length > 0");
    check("9.2 the administrator console loads from the formal PC page", loaded);
    const tabs = await browser.evaluate("Array.from(document.querySelectorAll('#tabs button')).map((b) => b.textContent)");
    check("9.5 the formal console exposes the task-history and notification-management tabs",
      tabs.includes("任务历史") && tabs.includes("通知管理") && tabs.length === 9, { tabs });

    // ---------------- task history tab ----------------
    await browser.evaluate("Array.from(document.querySelectorAll('#tabs button')).find((b) => b.textContent === '任务历史').click()");
    await waitFor(browser, "document.getElementById('tab-history').classList.contains('active') && document.querySelectorAll('#historyRows tr').length > 0");
    check("9.2 the history tab lists real company tasks with their state and ordered assignees",
      await browser.evaluate("/共 [0-9]+ 条任务/.test(document.getElementById('historyHint').textContent) && document.querySelectorAll('#historyRows tr').length > 0"));
    await browser.evaluate(`(() => { const input = document.getElementById('historyQuery'); input.value = ${JSON.stringify("浏览器历史-" + RUN)}; document.getElementById('historySearch').click(); })()`);
    await waitFor(browser, `document.querySelectorAll('#historyRows tr').length === 1 && document.getElementById('historyRows').textContent.includes(${JSON.stringify("浏览器历史-" + RUN)})`);
    const filtered = await browser.evaluate("({ rows: document.querySelectorAll('#historyRows tr').length, text: document.getElementById('historyRows').textContent })");
    check("9.2 the name search locates the scenario task without the debug page", filtered.rows === 1 && filtered.text.includes("浏览器历史-" + RUN), filtered);
    await browser.evaluate("document.querySelector('#historyRows [data-history-task]').click()");
    await waitFor(browser, "document.getElementById('historyDetail').hidden === false && document.querySelectorAll('#historyDetail table').length >= 4");
    const detailText = await browser.evaluate("document.getElementById('historyDetail').textContent");
    check("9.2 the opened history shows time, actor, before/after values and ordered assignees",
      /版本与负责人顺序/.test(detailText) && /操作记录/.test(detailText) && /赵蕾 → 李敏/.test(detailText)
      && /负责人顺序/.test(detailText) && /张涛/.test(detailText),
      { head: detailText.slice(0, 400) });
    const historySections = await browser.evaluate("(() => { const root = document.getElementById('historyDetail'); return { text: root.textContent, tables: Array.from(root.querySelectorAll('table')).map(t => t.textContent) }; })()");
    const reassignTable = historySections.tables.find((row) => row.includes('原审核人')) || "";
    const handoverTable = historySections.tables.find((row) => row.includes('原负责人')) || "";
    check("9.2 the history shows the decision opinion",
      historySections.text.includes("浏览器改序审核-" + RUN), { found: historySections.text.includes("浏览器改序审核-" + RUN) });
    check("9.2 the history shows a recorded reassignment with both people",
      /李敏/.test(reassignTable) && /王海/.test(reassignTable) && /route_refresh|组织变化|按最高/.test(reassignTable),
      { table: reassignTable });
    check("9.2 the history shows the handover from the employee to the manager",
      /张涛/.test(handoverTable) && /李敏/.test(handoverTable), { table: handoverTable });
    check("9.2 the history shows the reopen round and its reason",
      /重开新轮次/.test(historySections.text) && /第 1 轮 → 第 2 轮/.test(historySections.text)
      && /浏览器重开审核-/.test(historySections.text),
      { text: historySections.text.slice(0, 1200) });
    check("9.2 the history shows the earlier field change with before and after values",
      /字段变更/.test(detailText) && /标题/.test(detailText) && detailText.includes("浏览器历史-" + RUN));
    await browser.evaluate(`(() => { const input = document.getElementById('historyQuery'); input.value = ${JSON.stringify("浏览器免审-" + RUN)}; document.getElementById('historySearch').click(); })()`);
    await waitFor(browser, `document.querySelectorAll('#historyRows tr').length === 1 && document.getElementById('historyRows').textContent.includes(${JSON.stringify("浏览器免审-" + RUN)})`);
    await browser.evaluate("document.querySelector('#historyRows [data-history-task]').click()");
    await waitFor(browser, "document.getElementById('historyDetail').hidden === false && /无需审核原因/.test(document.getElementById('historyDetail').textContent)");
    const exemptText = await browser.evaluate("document.getElementById('historyDetail').textContent");
    check("9.2 a genuinely exempt creation shows its recorded no-review reason",
      /无需审核原因/.test(exemptText) && /创始人/.test(exemptText), { text: exemptText.slice(0, 300) });
    await browser.evaluate("document.getElementById('historyClose').click()");

    // ---------------- notification management tab ----------------
    await browser.evaluate("Array.from(document.querySelectorAll('#tabs button')).find((b) => b.textContent === '通知管理').click()");
    await waitFor(browser, "document.getElementById('tab-notifications').classList.contains('active') && document.querySelectorAll('#notificationRows tr').length > 0");
    const notificationRows = await browser.evaluate("document.querySelectorAll('#notificationRows tr').length");
    const notificationText = await browser.evaluate("document.getElementById('notificationRows').textContent");
    check("9.3 the notification tab shows real receive, read and retention state",
      /已读|未读/.test(notificationText) && notificationRows > 0, { rows: notificationRows });
    check("9.3 the notification page states the 180-second and business-boundary rules",
      /180 秒/.test(await browser.evaluate(text("#tab-notifications"))));
    await browser.evaluate("window.prompt = () => '浏览器撤回测试'");
    const before = await browser.evaluate("document.querySelectorAll('#notificationRows [data-withdraw-event]').length");
    await browser.evaluate("document.querySelector('#notificationRows [data-withdraw-event]').click()");
    const withdrawn = await waitFor(browser, "document.getElementById('consoleOk').textContent.includes('通知已撤回')", 8000);
    check("9.3 an event inside 180 seconds is withdrawn from the console",
      withdrawn && before > 0, { before, ok: await browser.evaluate(text("#consoleOk")) });
    await waitFor(browser, "document.getElementById('notificationRows').textContent.includes('已撤回')");
    check("9.3 withdrawn copies show the retained placeholder state",
      await browser.evaluate("document.getElementById('notificationRows').textContent.includes('已撤回')"));
    // The clock is controllable: 181 seconds later a remaining event must be refused.
    await browser.evaluate(`fetch('/api/v1/admin/clock/advance', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + state.token }, body: JSON.stringify({ seconds: 181 }) })`);
    await browser.evaluate("document.getElementById('notificationRefresh').click()");
    await waitFor(browser, "document.querySelectorAll('#notificationRows [data-withdraw-event]').length > 0");
    await browser.evaluate("document.querySelector('#notificationRows [data-withdraw-event]').click()");
    const refused = await waitFor(browser, "document.getElementById('consoleError').textContent.length > 0", 8000);
    check("9.3 withdrawal at or after 180 seconds is refused with a clear message",
      refused && /180|撤回/.test(await browser.evaluate(text("#consoleError"))),
      { error: await browser.evaluate(text("#consoleError")) });
    check("9.3 the console keeps working after the refusal",
      await browser.evaluate("document.getElementById('console').hidden === false && state.user.username === 'admin'"));
    check("9.2/9.3 the console produced no uncaught script or network errors", browser.errors.length === 0, browser.errors.slice(0, 6));
  } finally { browser.kill(); }
}

async function runTeamEntry(base, password, scenario) {
  const browser = await openBrowser(base + "/", 1440, 900);
  try {
    await waitFor(browser, "!!document.getElementById('backend-login')");
    await browser.evaluate(`(() => { document.getElementById('login-user').value=${JSON.stringify(loginIdentity("middle"))}; document.getElementById('login-password').value=${JSON.stringify(password)}; document.getElementById('backend-login').requestSubmit(); })()`);
    check("9.4 the department lead reaches the employee web workspace", await waitFor(browser, "window.Pandora && window.Pandora.ready"));
    await browser.evaluate("document.querySelector('[data-page=\"me\"]').click()");
    await waitFor(browser, "window.Pandora.idle() && !!document.querySelector('[data-action=\"p-open-teams\"]')");
    check("9.4 the authorized department lead sees the restricted team entry in My",
      await browser.evaluate("!!document.querySelector('[data-action=\"p-open-teams\"]') && /团队管理/.test(document.getElementById('page-me').textContent)"));
    await browser.evaluate("document.querySelector('[data-action=\"p-open-teams\"]').click()");
    await waitFor(browser, "document.getElementById('overlay').hidden === false && /团队管理/.test(document.getElementById('sheetTitle').textContent) && !!document.getElementById('team-create-name')");
    const sheetText = await browser.evaluate("document.getElementById('sheetBody').textContent");
    check("9.4 the entry reads only the lead's own department and its teams",
      /产品部/.test(sheetText) && !/市场部/.test(sheetText) && /负责人/.test(sheetText), { text: sheetText.slice(0, 240) });

    const teamName = "浏览器团队-" + RUN;
    await browser.evaluate(`(() => { document.getElementById('team-create-name').value = ${JSON.stringify(teamName)}; document.querySelector('[data-action="p-create-team"]').click(); })()`);
    const created = await waitFor(browser, `document.getElementById('sheetBody').textContent.includes(${JSON.stringify(teamName)})`, 15000);
    check("9.4 creating a team from the restricted entry succeeds and refreshes the list", created);
    const team = (await api(base, "GET", "/api/v1/me/team-management", { token: scenario.tokens.middle })).body
      .teams.find((row) => row.name === teamName);
    check("9.4 the created team persists and the creator is the default lead",
      !!team && team.leadUserId === scenario.ids.middle, { team });
    if (team) {
      await browser.evaluate(`(() => { const select = document.getElementById('team-lead-' + ${JSON.stringify(team.id)}); select.value = ${JSON.stringify(scenario.ids.employee)}; select.dispatchEvent(new Event('change', { bubbles: true })); const card = select.closest('[data-team]'); card.querySelector('[data-action="p-transfer-team"]').click(); })()`);
      const transferred = await waitFor(browser, `document.getElementById('sheetBody').textContent.includes('负责人 张涛')`, 15000);
      const after = (await api(base, "GET", "/api/v1/me/team-management", { token: scenario.tokens.middle })).body
        .teams.find((row) => row.id === team.id);
      check("9.4 transferring the lead to a department member persists and refreshes the sheet",
        transferred && after && after.leadUserId === scenario.ids.employee, { transferred, lead: after && after.leadUserId });
      // A non-authorised account never sees the entry.
      await browser.evaluate("window.Pandora.busy(() => window.Pandora.logout('employee'))");
      await waitFor(browser, "!!document.getElementById('backend-login')");
      await browser.evaluate(`(() => { document.getElementById('login-user').value=${JSON.stringify(loginIdentity("employee"))}; document.getElementById('login-password').value=${JSON.stringify(password)}; document.getElementById('backend-login').requestSubmit(); })()`);
      await waitFor(browser, "window.Pandora && window.Pandora.ready");
      await browser.evaluate("document.querySelector('[data-page=\"me\"]').click()");
      await waitFor(browser, "window.Pandora.idle()");
      check("9.4 an ordinary employee sees no restricted team entry",
        await browser.evaluate("!document.querySelector('[data-action=\"p-open-teams\"]') && !/团队管理/.test(document.getElementById('page-me').textContent)"));
    }
    check("9.4 the employee team entry produced no uncaught script or network errors", browser.errors.length === 0, browser.errors.slice(0, 6));
  } finally { browser.kill(); }
}

async function runIsolation(base, password) {
  const browser = await openBrowser(base + "/admin.html", 1440, 900);
  try {
    await waitFor(browser, "!!document.getElementById('loginButton')");
    await browser.evaluate(`(() => { document.getElementById('username').value=${JSON.stringify(loginIdentity("employee"))}; document.getElementById('password').value=${JSON.stringify(password)}; document.getElementById('loginButton').click(); })()`);
    // The session endpoint accepts an employee, but the first management read is refused by the
    // server, so the console is torn down and never renders organization data.
    const tornDown = await waitFor(browser, "document.getElementById('console').hidden === true && state.token === null", 12000);
    const state = await browser.evaluate("({ consoleHidden: document.getElementById('console').hidden, token: state.token, employeeRows: document.querySelectorAll('#employeeRows tr').length, loginVisible: document.getElementById('login').hidden === false })");
    check("9.5 a business account cannot enter the formal console and is rejected by the server",
      tornDown && state.consoleHidden && state.token === null && state.employeeRows === 0 && state.loginVisible, state);
    check("9.5 the console page uses no debug console to answer the query",
      await browser.evaluate("!/debug\.html/.test(document.documentElement.innerHTML)"));
  } finally { browser.kill(); }
}

async function main() {
  const base = arg("base-url", "http://127.0.0.1:18130");
  const password = arg("password", "Demo@123456");
  const output = arg("output", null);
  const scenario = await prepareScenario(base, password);
  console.log("scenario task", scenario.taskId, "exempt task", scenario.exemptTaskId);
  await runAdmin(base, password);
  await runTeamEntry(base, password, scenario);
  await runIsolation(base, password);
  if (output) {
    fs.mkdirSync(path.dirname(output), { recursive: true });
    fs.writeFileSync(output, JSON.stringify({ generatedAt: new Date().toISOString(), baseUrl: base,
      viewport: { width: 1440, height: 900 }, scenario, passed: results.filter((row) => row.pass).length,
      total: results.length, checks: results }, null, 2) + "\n");
  }
  const passed = results.filter((row) => row.pass).length;
  console.log(`\n${passed}/${results.length} browser checks passed`);
  return passed === results.length ? 0 : 1;
}
main().then((code) => process.exit(code)).catch((error) => { console.error(error); process.exit(2); });
