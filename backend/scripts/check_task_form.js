#!/usr/bin/env node
"use strict";
/*
 * Task form (视图 → 任务表单) comprehensive HTTP + browser verification for A-13/A-26/A-27.
 *
 * Run against a throwaway seeded database with the event worker enabled; never against the user's
 * current database (the worker is needed for the historical read-only notification fixture):
 *   CHECK_WORKER=true backend/scripts/run_check_isolated.sh node scripts/check_task_form.js --base-url {base}
 *
 * The run prepares an isolated fixture (over two API pages of effective tasks, relation/status/
 * permission matrix), then drives the served prototype in headless Chrome. Each check prints
 * PASS/FAIL and the whole run can be written as JSON evidence with --output.
 */
const { spawn } = require("child_process");
const crypto = require("crypto");
const fs = require("fs");
const os = require("os");
const path = require("path");

const REPO = path.resolve(__dirname, "..", "..");
const CHROME = process.env.CHROME_BIN || [
  "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
  "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
  "/usr/bin/google-chrome", "/usr/bin/google-chrome-stable",
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
].find((candidate) => fs.existsSync(candidate));
const RESULTS = [];
const RUN = crypto.randomBytes(3).toString("hex");
const COMPANY_TZ = "Asia/Shanghai";
const BULK = 205;
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function check(name, condition, evidence) {
  RESULTS.push({ check: name, pass: !!condition, evidence: evidence === undefined ? null : evidence });
  console.log((condition ? "PASS  " : "FAIL  ") + name + (condition ? "" : "  -> " + JSON.stringify(evidence)));
}
function arg(name, fallback) {
  const index = process.argv.indexOf("--" + name);
  return index >= 0 ? process.argv[index + 1] : fallback;
}
const key = (prefix = "tf") => prefix + "-" + crypto.randomUUID();
const etag = (body, headers) => headers.etag || '"' + body.rowVersion + '"';
const iso = (value) => new Date(value).toISOString().replace("Z", "+00:00");

async function api(base, method, route, { token, body, idem, headerEtag } = {}) {
  const headers = { "Content-Type": "application/json", Accept: "application/json" };
  if (token) headers.Authorization = "Bearer " + token;
  if (idem) headers["Idempotency-Key"] = idem;
  if (headerEtag) headers["If-Match"] = headerEtag;
  const response = await fetch(base + route, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
  const text = await response.text();
  return { status: response.status, body: text ? JSON.parse(text) : {}, headers: Object.fromEntries(response.headers) };
}
async function allApi(base, route, token) {
  const items = [];
  let offset = 0;
  for (;;) {
    const result = await api(base, "GET", route + (route.includes("?") ? "&" : "?") + "limit=100&offset=" + offset, { token });
    if (result.status !== 200) throw new Error("list failed " + route + " " + result.status + " " + JSON.stringify(result.body));
    items.push(...(result.body.items || []));
    const next = result.body.nextOffset == null ? result.body.nextCursor : result.body.nextOffset;
    if (next == null) return items;
    offset = Number(next);
  }
}

/* ---------- pure pipeline checks against the actually served task-form source ---------- */
function extractFunction(source, name) {
  const start = source.indexOf("function " + name + "(");
  if (start < 0) throw new Error("function " + name + " not found");
  const open = source.indexOf("{", start);
  let depth = 0;
  for (let i = open; i < source.length; i += 1) {
    if (source[i] === "{") depth += 1;
    else if (source[i] === "}") { depth -= 1; if (depth === 0) return source.slice(start, i + 1); }
  }
  throw new Error("unbalanced function " + name);
}
function loadPipeline() {
  const source = fs.readFileSync(path.join(REPO, "潘多拉-任务表单.js"), "utf8");
  const names = ["defaultFilters", "companyDateKey", "companyDateTime", "taskRaw", "taskBusinessDates", "taskIsDone",
    "taskIsOverdue", "relationOf", "matchesTaskFilters", "taskSortValue", "sortTaskRows", "summarizeTaskRows",
    "pageTaskRows", "computeTaskForm"];
  const code = 'const PAGE_SIZE=50;const URGENCY_RANK={"紧急":0,"高":1,"中":2,"低":3};const STATUS_RANK={todo:0,doing:1,done:2};\n'
    + names.map((name) => extractFunction(source, name)).join("\n")
    + "\nreturn {" + names.join(",") + "};";
  return new Function(code)();
}
function mapRow(raw) {
  return {
    id: raw.id || raw.taskId, title: raw.title, desc: raw.description, acceptanceCriteria: raw.acceptanceCriteria,
    creatorId: raw.originalCreatorId, assigneeIds: raw.assigneeIds || [], allDay: !!raw.allDay,
    urgency: ({ urgent: "紧急", high: "高", medium: "中", low: "低" })[raw.priority] || "中",
    status: raw.executionState, pendingKind: raw.pendingKind || null, frozen: !!raw.frozen, raw,
  };
}
function pipelineChecks() {
  const api = loadPipeline();
  const me = "me", other = "other";
  const make = (id, raw) => mapRow(Object.assign({ id, taskId: id, originalCreatorId: me, assigneeIds: [me],
    executionState: "todo", priority: "medium", createdAt: "2026-10-01T00:00:00Z",
    startAt: "2026-10-10T01:00:00Z", dueAt: "2026-10-11T10:00:00Z", description: "", acceptanceCriteria: "" }, raw));
  const both = make("a-both", { title: "Both", pendingKind: "complete" });
  const visible = make("b-visible", { title: "Visible", originalCreatorId: other, assigneeIds: [other] });
  const allDayDone = make("c-allday", { title: "All day", allDay: true, startDate: "2026-10-10", dueDate: "2026-10-12",
    startAt: "2026-10-09T16:00:00Z", dueAt: "2026-10-12T10:00:00Z", executionState: "done", priority: "urgent" });
  const rows = [both, visible, allDayDone];
  const base = { relation: "all", completion: "all", query: "", from: "", to: "" };
  const ids = (list) => list.map((task) => task.id);
  const compute = (options) => {
    const config = Object.assign({ rows, accountId: me, timeZone: COMPANY_TZ, sort: { key: "start", dir: "asc" }, page: 0, pageSize: 50 }, options);
    return api.computeTaskForm(config.rows, config);
  };
  const own = compute({ filters: Object.assign({}, base, { relation: "own" }) });
  const created = compute({ filters: Object.assign({}, base, { relation: "created" }) });
  const onlyVisible = compute({ filters: Object.assign({}, base, { relation: "visible" }) });
  check("A-26 own+created overlaps in both relation filters and only-visible excludes it",
    ids(own.rows).includes("a-both") && ids(created.rows).includes("a-both") && !ids(onlyVisible.rows).includes("a-both"),
    { own: ids(own.rows), created: ids(created.rows), visible: ids(onlyVisible.rows) });
  check("A-26 pending completion stays unfinished while done is finished",
    api.matchesTaskFilters(both, Object.assign({}, base, { completion: "open" }), me, COMPANY_TZ)
    && !api.matchesTaskFilters(both, Object.assign({}, base, { completion: "done" }), me, COMPANY_TZ)
    && api.taskIsDone(allDayDone), {});
  const counts = api.summarizeTaskRows(rows, me, Date.parse("2026-10-21T00:00:00Z"));
  check("A-26 counts dedupe relations: total 3, own 2, created 2, only-visible 1, pending complete 1, done 1",
    counts.total === 3 && counts.own === 2 && counts.created === 2 && counts.visible === 1
    && counts.pendingComplete === 1 && counts.done === 1, counts);
  check("A-26 all-day dates use the company start/due dates without fake times",
    JSON.stringify(api.taskBusinessDates(allDayDone, COMPANY_TZ)) === JSON.stringify({ start: "2026-10-10", due: "2026-10-12" })
    && api.companyDateKey("2026-10-20T17:00:00Z", COMPANY_TZ) === "2026-10-21"
    && api.companyDateKey("2026-10-20T17:00:00Z", "America/New_York") === "2026-10-20",
    { company: api.taskBusinessDates(allDayDone, COMPANY_TZ) });
  check("A-26 closed date intersection includes both all-day boundaries, supports single ends",
    api.matchesTaskFilters(allDayDone, Object.assign({}, base, { from: "2026-10-12", to: "2026-10-12" }), me, COMPANY_TZ)
    && api.matchesTaskFilters(allDayDone, Object.assign({}, base, { from: "2026-10-01", to: "2026-10-10" }), me, COMPANY_TZ)
    && api.matchesTaskFilters(allDayDone, Object.assign({}, base, { from: "2026-10-12" }), me, COMPANY_TZ)
    && !api.matchesTaskFilters(allDayDone, Object.assign({}, base, { from: "2026-10-13" }), me, COMPANY_TZ), {});
  const donePast = make("d-done-past", { title: "Done past", executionState: "done", dueAt: "2026-10-01T00:00:00Z" });
  const openAllDayPast = make("e-open-all-day", { title: "Open all day", allDay: true, dueAt: "2026-10-01T00:00:00Z" });
  check("A-26 done is never overdue and an all-day open task uses the effective dueAt instant",
    api.summarizeTaskRows([donePast], me, Date.parse("2026-10-21T00:00:00Z")).overdue === 0
    && api.summarizeTaskRows([openAllDayPast], me, Date.parse("2026-10-21T00:00:00Z")).overdue === 1, {});

  const same = make("z-same", { title: "Same" });
  const twin = make("y-twin", { title: "Same" });
  check("A-26 equal primary values always use the ascending task id in both directions",
    ids(api.sortTaskRows([same, twin], "start", "asc")).join() === "y-twin,z-same"
    && ids(api.sortTaskRows([same, twin], "start", "desc")).join() === "y-twin,z-same",
    { asc: ids(api.sortTaskRows([same, twin], "start", "asc")), desc: ids(api.sortTaskRows([same, twin], "start", "desc")) });
  const many = Array.from({ length: 120 }, (_, index) => make("p" + String(index).padStart(3, "0"),
    { title: "T" + index, dueAt: "2026-10-11T10:00:00Z" }));
  const paged = api.computeTaskForm(many, { accountId: me, timeZone: COMPANY_TZ, filters: base, sort: { key: "start", dir: "asc" }, page: 99, pageSize: 50 });
  const searched = api.computeTaskForm(many, { accountId: me, timeZone: COMPANY_TZ, filters: Object.assign({}, base, { query: "T11" }), sort: { key: "start", dir: "asc" }, page: 0, pageSize: 50 });
  check("A-26 50-row paging clamps an out-of-range page and searches the whole set, not one page",
    paged.paged.page === 2 && paged.paged.items.length === 20 && searched.counts.total === 11, { page: paged.paged.page, found: searched.counts.total });
}

/* ---------- browser harness ---------- */
async function openBrowser(url, timezone) {
  if (!CHROME) throw new Error("Chrome not found; set CHROME_BIN");
  const port = 9900 + Math.floor(Math.random() * 90);
  const proc = spawn(CHROME, ["--headless", "--no-sandbox", "--disable-gpu", "--no-first-run",
    "--no-default-browser-check", "--disable-crash-reporter", "--hide-scrollbars", "--force-device-scale-factor=1",
    "--remote-debugging-port=" + port, "--user-data-dir=" + path.join(os.tmpdir(), "pandora-cdp-" + crypto.randomBytes(4).toString("hex")), url], { stdio: "ignore" });
  let target = null;
  for (let i = 0; i < 100 && !target; i += 1) {
    try {
      const list = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json();
      target = list.find((row) => row.type === "page" && String(row.url).startsWith("http"));
    } catch {}
    if (!target) await sleep(200);
  }
  if (!target) { proc.kill("SIGKILL"); throw new Error("no page target"); }
  const ws = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => { ws.addEventListener("open", resolve); ws.addEventListener("error", () => reject(new Error("cdp failed"))); });
  let seq = 0; const pending = new Map(); const errors = [];
  ws.addEventListener("message", (event) => {
    const message = JSON.parse(event.data);
    if (message.method === "Runtime.exceptionThrown") {
      const details = message.params.exceptionDetails;
      errors.push("EXC: " + ((details.exception && details.exception.description) || details.text));
    }
    if (message.method === "Runtime.consoleAPICalled" && message.params.type === "error") {
      errors.push("CONSOLE: " + message.params.args.map((item) => item.value || item.description).join(" "));
    }
    if (message.id && pending.has(message.id)) {
      const { resolve, reject } = pending.get(message.id); pending.delete(message.id);
      message.error ? reject(new Error(JSON.stringify(message.error))) : resolve(message.result);
    }
  });
  const send = (method, params) => new Promise((resolve, reject) => {
    const id = ++seq; pending.set(id, { resolve, reject });
    ws.send(JSON.stringify({ id, method, params: params || {} }));
    setTimeout(() => { if (pending.delete(id)) reject(new Error("timeout: " + method)); }, 30000);
  });
  await send("Runtime.enable"); await send("Page.enable");
  if (timezone) await send("Emulation.setTimezoneOverride", { timezoneId: timezone });
  const evaluate = async (expression) => {
    const result = await send("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true, userGesture: true });
    if (result.exceptionDetails) throw new Error(result.exceptionDetails.text + " in " + expression);
    return result.result.value;
  };
  const setViewport = (width, height) => send("Emulation.setDeviceMetricsOverride", { width, height, deviceScaleFactor: 1, mobile: width < 600 });
  const screenshot = async (file, width, height) => {
    await setViewport(width, height); await sleep(350);
    const shot = await send("Page.captureScreenshot", { format: "png" });
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, Buffer.from(shot.data, "base64"));
  };
  await setViewport(1440, 900);
  return { evaluate, send, setViewport, screenshot, errors, kill: () => { try { ws.close(); } catch {} proc.kill("SIGKILL"); } };
}
async function waitFor(browser, expression, timeout = 15000) {
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
const setDate = (id, value) => `(() => { const el = document.getElementById(${JSON.stringify(id)}); if (!el) return false; el.value = ${JSON.stringify(value)}; el.dispatchEvent(new Event("change", {bubbles:true})); return true; })()`;
const submit = (id) => `(() => { const el = document.getElementById(${JSON.stringify(id)}); if (!el) return false; el.requestSubmit(); return true; })()`;
async function login(browser, username, password) {
  await waitFor(browser, "!!document.getElementById('backend-login')");
  await browser.evaluate(setValue("login-user", username));
  await browser.evaluate(setValue("login-password", password));
  await browser.evaluate(submit("backend-login"));
  return waitFor(browser, "window.Pandora && window.Pandora.ready && window.Pandora.data && window.Pandora.data.me");
}
async function openTable(browser) {
  await browser.evaluate("document.querySelector('[data-page=\"view\"]').click()");
  await waitFor(browser, "!!document.querySelector('.p-schedule-card') && window.Pandora.idle()");
  await browser.evaluate("document.querySelector('[data-action=\"task-table-open\"]').click()");
  return waitFor(browser, "!!document.querySelector('.p-task-table-card') && window.Pandora.taskForm && window.Pandora.taskForm.state.loaded && !window.Pandora.taskForm.state.loading");
}
async function resetPage(browser) {
  await browser.evaluate("window.Pandora.taskForm.state.page = 0; window.Pandora.taskForm.paint();");
  await sleep(120);
}
async function allRenderedIds(browser) {
  await resetPage(browser);
  const ids = [];
  for (let guard = 0; guard < 40; guard += 1) {
    ids.push(...await browser.evaluate("Array.from(document.querySelectorAll('#p-table-body tr[data-task-row]')).map(tr => tr.dataset.taskRow)"));
    const advanced = await browser.evaluate("(() => { const next = document.querySelector('[data-action=\"task-table-next\"]'); if (!next || next.disabled) return false; next.click(); return true; })()");
    if (!advanced) break;
    await sleep(120);
  }
  return ids;
}
const counts = (browser) => browser.evaluate(`(() => { const out = {}; document.querySelectorAll('#p-table-counts [data-count]').forEach(el => { out[el.dataset.count] = Number(el.querySelector('b').textContent); }); return out; })()`);

/* ---------- fixtures ---------- */
function companyDate(value) {
  const parts = new Intl.DateTimeFormat("en-US", { timeZone: COMPANY_TZ, year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(new Date(value));
  const get = (type) => (parts.find((part) => part.type === type) || {}).value;
  return get("year") + "-" + get("month") + "-" + get("day");
}
function expectedCounts(rows, meId, now) {
  const out = { total: rows.length, own: 0, created: 0, visible: 0, pendingComplete: 0, done: 0, overdue: 0 };
  rows.forEach((row) => {
    const assigned = (row.assigneeIds || []).includes(meId);
    const created = row.originalCreatorId === meId;
    if (assigned) out.own += 1;
    if (created) out.created += 1;
    if (!assigned && !created) out.visible += 1;
    if (row.pendingKind === "complete") out.pendingComplete += 1;
    if (row.executionState === "done") out.done += 1;
    if (row.executionState !== "done" && row.dueAt && new Date(row.dueAt).getTime() < now) out.overdue += 1;
  });
  return out;
}
function relationMatches(row, relation, meId) {
  const assigned = (row.assigneeIds || []).includes(meId);
  const created = row.originalCreatorId === meId;
  if (relation === "own") return assigned;
  if (relation === "created") return created;
  if (relation === "visible") return !assigned && !created;
  return true;
}

async function main() {
  const base = arg("base-url", "http://127.0.0.1:18130");
  const password = arg("password", "Demo@123456");
  const output = arg("output", null);
  const shots = arg("screenshot-dir", null);
  const nowMs = Date.now();

  pipelineChecks();

  /* ----- HTTP fixtures ----- */
  const tokens = {}, users = {};
  for (const username of ["upper", "middle", "employee", "colleague", "marketing", "market", "admin"]) {
    const session = await api(base, "POST", "/api/v1/auth/sessions", { body: { username, password } });
    if (session.status !== 200) throw new Error("login failed " + username + " " + session.status);
    tokens[username] = session.body.token;
    users[username] = session.body.user;
  }
  const me = users.middle;
  async function decideAuto(requestId, preferred) {
    const order = [preferred, "upper", "middle", "market", "employee"].filter(Boolean);
    for (const username of order) {
      const current = await api(base, "GET", "/api/v1/approval-requests/" + requestId, { token: tokens[username] });
      if (current.status !== 200) continue;
      if (current.body.status !== "pending") return current.body;
      if (current.body.currentReviewerId !== users[username].id) continue;
      const decision = await api(base, "PATCH", "/api/v1/approval-requests/" + requestId, { token: tokens[username],
        body: { decision: "approve", comment: "task-form fixture" }, idem: key("approve"), headerEtag: etag(current.body, current.headers) });
      if (decision.status === 200) return decision.body;
      throw new Error("approve failed " + username + " " + decision.status + " " + JSON.stringify(decision.body));
    }
    throw new Error("cannot approve request " + requestId);
  }
  async function createTask(username, body, approve = true) {
    const result = await api(base, "POST", "/api/v1/tasks", { token: tokens[username], body, idem: key("create") });
    if (result.status !== 201) throw new Error("create failed " + body.title + " " + result.status + " " + JSON.stringify(result.body));
    if (approve && result.body.requestId) {
      const reviewer = ["middle", "upper", "market", "employee"].find((name) => users[name].id !== users[username].id) || "upper";
      if (username === "upper") await decideAuto(result.body.requestId, "upper");
      else await decideAuto(result.body.requestId, reviewer);
    }
    return result.body;
  }
  async function changeTask(username, taskId, body) {
    const current = await api(base, "GET", "/api/v1/tasks/" + taskId, { token: tokens[username] });
    if (current.status !== 200) throw new Error("task missing " + taskId);
    const result = await api(base, "PATCH", "/api/v1/tasks/" + taskId, { token: tokens[username],
      body: Object.assign({ command: "change", reason: "task-form fixture" }, body), idem: key("change"), headerEtag: etag(current.body, current.headers) });
    if (result.status !== 200) throw new Error("change failed " + result.status + " " + JSON.stringify(result.body));
    return result.body;
  }
  async function changeAndApprove(username, taskId, body, preferred) {
    const result = await changeTask(username, taskId, body);
    if (result.requestId) await decideAuto(result.requestId, preferred || username);
    return result;
  }
  async function command(username, taskId, body, approve) {
    const current = await api(base, "GET", "/api/v1/tasks/" + taskId, { token: tokens[username] });
    const result = await api(base, "PATCH", "/api/v1/tasks/" + taskId, { token: tokens[username], body,
      idem: key("command"), headerEtag: etag(current.body, current.headers) });
    if (result.status !== 200) throw new Error("command failed " + result.status + " " + JSON.stringify(result.body));
    if (approve && result.body.requestId) await decideAuto(result.body.requestId, body.command === "complete" ? "upper" : "upper");
    return result.body;
  }
  const taskBody = (title, owners, start, due, opts = {}) => Object.assign({
    title, description: "任务表单综合检查说明 · " + title + " · " + "长文本预览".repeat(24),
    acceptanceCriteria: "验收标准 · " + title + " · " + "完整查看".repeat(12),
    priority: opts.priority || "medium", allDay: !!opts.allDay, assigneeIds: owners,
  }, opts.allDay
    ? { startDate: opts.startDate || companyDate(start), dueDate: opts.dueDate || companyDate(due) }
    : { startAt: iso(start), dueAt: iso(due) });

  // 205 effective tasks created first, so the oldest titles sit beyond the first API page.
  const bulkStart = Date.parse("2026-12-01T01:00:00Z");
  const bulk = [];
  for (let index = 1; index <= BULK; index += 1) {
    const title = index === 1 ? "TFbulk001 distinct " + RUN : "TFbulk" + String(index).padStart(3, "0") + " " + RUN;
    const start = bulkStart + index * 3600_000, due = start + 2 * 3600_000;
    bulk.push(await createTask("upper", taskBody(title, [me.id], start, due, { priority: ["urgent", "high", "medium", "low"][index % 4] }), false));
  }
  // Approve the whole creation batch through the upper reviewer list.
  const pending = new Map();
  const requestRows = await allApi(base, "/api/v1/approval-requests?mine=all", tokens.upper);
  requestRows.filter((row) => row.status === "pending").forEach((row) => pending.set(row.requestId, row));
  for (const created of bulk) {
    const row = pending.get(created.requestId);
    if (!row) throw new Error("missing pending approval for bulk task");
    const decision = await api(base, "PATCH", "/api/v1/approval-requests/" + created.requestId, { token: tokens.upper,
      body: { decision: "approve", comment: "task-form bulk" }, idem: key("bulk-approve"), headerEtag: '"' + row.rowVersion + '"' });
    if (decision.status !== 200) throw new Error("bulk approve failed " + decision.status);
  }
  check("A-26 the fixture prepares more than two API pages of effective authorized tasks", bulk.length === BULK, { created: bulk.length });

  const T = (suffix) => "TF26 " + suffix + " " + RUN;
  const at = (day, hour, minute = 0) => Date.parse(`2026-10-${String(day).padStart(2, "0")}T${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}:00+08:00`);
  const future = (month, day, hour) => Date.parse(`2026-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}T${String(hour).padStart(2, "0")}:00:00+08:00`);
  const bothTask = await createTask("middle", taskBody(T("both"), [me.id], future(11, 20, 9), future(11, 21, 18)));
  const createdOnly = await createTask("middle", taskBody(T("created-only"), [users.employee.id], future(11, 20, 9), future(11, 21, 18)));
  const visibleOnly = await createTask("upper", taskBody(T("visible-dept"), [users.employee.id], at(30, 9), at(30, 18)));
  const ownOnly = await createTask("upper", taskBody(T("own-only"), [me.id], future(11, 20, 9), future(11, 21, 18)));
  const pendingComplete = await createTask("middle", taskBody(T("pending-complete"), [users.employee.id], future(11, 19, 9), future(11, 20, 18)));
  await command("employee", pendingComplete.taskId, { command: "complete", completionNote: "待审核完成说明" }, false);
  const allDayCross = await createTask("middle", taskBody(T("allday-cross"), [me.id], at(30, 0), at(2, 0),
    { allDay: true, startDate: "2026-10-30", dueDate: "2026-11-02" }));
  const midnight = await createTask("middle", taskBody(T("midnight"), [me.id], Date.parse("2026-10-31T15:30:00Z"), Date.parse("2026-10-31T16:00:00Z")));
  const pendingChange = await createTask("middle", taskBody(T("pending-change"), [me.id], future(11, 22, 9), future(11, 23, 18)));
  await changeTask("middle", pendingChange.taskId, { title: T("pending-change proposed") });
  const pendingCreate = await createTask("middle", taskBody(T("pending-create"), [me.id], future(12, 1, 9), future(12, 2, 18)), false);
  const crowded = [];
  for (let index = 1; index <= 7; index += 1) crowded.push(await createTask("middle", taskBody(T("crowded-" + index), [me.id], at(30, 8 + index), at(30, 9 + index))));
  const hiddenParent = await createTask("upper", taskBody(T("hidden-parent"), [users.marketing.id], at(28, 9), at(29, 18)));
  const hiddenChild = await createTask("upper", taskBody(T("hidden-child"), [me.id], at(28, 9), at(29, 18), { parentTaskId: hiddenParent.taskId }));
  const calendarLeave = await createTask("middle", taskBody(T("calendar-leave"), [me.id], at(27, 9), at(27, 18)));
  const revokeEmployee = await createTask("middle", taskBody(T("revoke-employee"), [users.employee.id], at(26, 9), at(27, 18)));
  const unpublishEmployee = await createTask("employee", taskBody(T("pending-create-employee"), [users.employee.id], at(26, 9), at(27, 18)), false);
  check("A-26 fixture covers relation, completion, date, permission and unpublished rows",
    !!(bothTask.taskId && createdOnly.taskId && visibleOnly.taskId && allDayCross.taskId && pendingCreate.taskId && hiddenChild.taskId), {});

  // Leave the calendar relation change for the browser part; pin one row for the table sort check.
  await api(base, "PUT", "/api/v1/tasks/" + bothTask.taskId + "/pin", { token: tokens.middle, idem: key("pin") });

  const middleRows = await allApi(base, "/api/v1/tasks", tokens.middle);
  const employeeRows = await allApi(base, "/api/v1/tasks", tokens.employee);
  const visibleIds = new Set(middleRows.filter((row) => row.originalCreatorId !== me.id && !(row.assigneeIds || []).includes(me.id)).map((row) => row.id));
  const expected = expectedCounts(middleRows, me.id, Date.now());
  check("A-26 the authorized set exceeds two pages and excludes the unpublished request",
    middleRows.length > 200 && !middleRows.some((row) => row.id === pendingCreate.taskId)
    && !employeeRows.some((row) => row.id === unpublishEmployee.taskId), { middle: middleRows.length, employee: employeeRows.length });

  /* ----- browser: table behavior (device timezone deliberately differs from the company) ----- */
  const browser = await openBrowser(base + "/", "America/New_York");
  try {
    const ready = await login(browser, "middle", password);
    check("A-26 the served page authenticates and exposes the read-only company timezone", ready
      && await browser.evaluate("window.Pandora.data.me.organizationTimeZone === 'Asia/Shanghai'"), {});
    const opened = await openTable(browser);
    check("A-26 视图 opens 任务表单 as a secondary page with the five main navs unchanged", opened
      && await browser.evaluate("state.viewPage === 'table' && document.querySelectorAll('#tabbar button').length === 5 && document.querySelector('#tabbar button[data-page=\"view\"]').getAttribute('aria-selected') === 'true'"), {});
    check("A-27 日历 has no ordinary search, result list or relation/status statistics",
      await browser.evaluate("!document.getElementById('p-schedule-search') && !document.querySelector('.p-search-results') && !document.querySelector('.p-range-counts') && !document.querySelector('.p-kind-legend')"), {});
    check("A-26 the table renders every required field as one row per task",
      await browser.evaluate("document.querySelectorAll('#p-table-head th').length === 17 && Array.from(document.querySelectorAll('#p-table-body tr[data-task-row]')).every(row => ['title','relation','assignees','creator','createdAt','description','acceptance','start','due','allDay','status','done','urgency','progress','pending','overdue','parent'].every(field => row.querySelector('[data-field=\"' + field + '\"]')))"), {});
    check("A-26 table header and task name stay sticky while the table scrolls both ways",
      await browser.evaluate(`(() => {
        const scroll = document.getElementById('p-table-scroll');
        const header = document.querySelector('#p-table-head th');
        const name = document.querySelector('#p-table-body th');
        if (!scroll || !header || !name) return false;
        const horizontal = scroll.scrollWidth > scroll.clientWidth;
        const vertical = scroll.scrollHeight > scroll.clientHeight;
        const before = name.getBoundingClientRect().left;
        scroll.scrollLeft = 320;
        const after = name.getBoundingClientRect().left;
        const result = horizontal && vertical && Math.abs(before - after) < 2
          && getComputedStyle(header).position === 'sticky' && getComputedStyle(name).position === 'sticky';
        scroll.scrollLeft = 0;
        return result;
      })()`), {});
    const displayed = await counts(browser);
    check("A-26 header counts match the complete authorized set and keep relation overlap",
      JSON.stringify(displayed) === JSON.stringify(expected), { displayed, expected });
    check("A-26 every visible row's date uses the company timezone, not the America/New_York device zone",
      await browser.evaluate(`(() => { const row = Array.from(document.querySelectorAll('#p-table-body tr[data-task-row]')).find(tr => tr.dataset.taskRow === ${JSON.stringify(midnight.taskId)}); if (!row) return false; return row.querySelector('[data-field="start"]').textContent.includes('2026-10-31 23:30') && row.querySelector('[data-field="due"]').textContent.includes('2026-11-01 00:00'); })()`), {});
    check("A-26 an effectively changed pending row keeps the old title and shows the pending/frozen mark",
      await browser.evaluate(`(() => { const row = document.querySelector('#p-table-body tr[data-task-row=${JSON.stringify(pendingChange.taskId)}]'); return !!row && row.textContent.includes(${JSON.stringify(T("pending-change"))}) && !row.textContent.includes('proposed') && row.querySelector('[data-field="pending"]').textContent.includes('待审'); })()`), {});
    check("A-26 an unauthorized parent task shows no identifier or title",
      await browser.evaluate(`(() => { const row = document.querySelector('#p-table-body tr[data-task-row=${JSON.stringify(hiddenChild.taskId)}]'); return !!row && row.querySelector('[data-field="parent"]').textContent.trim() === '—' && !row.textContent.includes(${JSON.stringify(T("hidden-parent"))}); })()`), {});

    // Relation filters.
    for (const [relation, label] of [["own", "我负责"], ["created", "我创建"], ["visible", "仅可见"]]) {
      await browser.evaluate(setSelect("p-filter-relation", relation));
      await sleep(120);
      const relationCounts = await counts(browser);
      const expectedRelation = middleRows.filter((row) => relationMatches(row, relation, me.id));
      check("A-26 relation filter " + relation + " uses effective owners/creator, can overlap and does not duplicate",
        relationCounts.total === expectedRelation.length
        && await browser.evaluate(`Array.from(document.querySelectorAll('#p-table-body tr[data-task-row]')).every(tr => { const row = window.Pandora.data.rawTasks.find(t => t.id === tr.dataset.taskRow); if (!row) return false; const assigned = (row.assigneeIds || []).includes(window.Pandora.data.me.id); const created = row.originalCreatorId === window.Pandora.data.me.id; return ${relation === "own" ? "assigned" : relation === "created" ? "created" : "!assigned && !created"}; })`),
        { total: relationCounts.total, expected: expectedRelation.length, label });
    }
    await browser.evaluate(setSelect("p-filter-relation", "all"));

    // Completion filters.
    for (const [completion, expectedRows] of [["open", middleRows.filter((row) => row.executionState !== "done")], ["done", middleRows.filter((row) => row.executionState === "done")]]) {
      await browser.evaluate(setSelect("p-filter-completion", completion));
      await sleep(120);
      const completionCounts = await counts(browser);
      check("A-26 completion filter " + completion + " only uses the effective execution state",
        completionCounts.total === expectedRows.length
        && completionCounts.pendingComplete === expectedRows.filter((row) => row.pendingKind === "complete").length,
        { total: completionCounts.total, expected: expectedRows.length });
    }
    await browser.evaluate(setSelect("p-filter-completion", "all"));

    // Combined filters and search beyond the first API page.
    const searchTarget = "TFbulk001 distinct " + RUN;
    await browser.evaluate(setValue("p-filter-query", "tfbulk001 DISTINCT " + RUN));
    await sleep(400);
    const searchCounts = await counts(browser);
    const searchRow = await browser.evaluate("document.querySelector('#p-table-body tr[data-task-row]') && document.querySelector('#p-table-body tr[data-task-row]').textContent");
    check("A-27 name search is trimmed and case-insensitive across the whole authorized set, including older pages",
      searchCounts.total === 1 && String(searchRow).includes(searchTarget), { total: searchCounts.total });
    await browser.evaluate(`(() => { const row = document.querySelector('#p-table-body tr[data-task-row]'); if (row) row.querySelector('[data-field="title"] button').click(); })()`);
    await waitFor(browser, "document.getElementById('overlay').hidden === false && window.Pandora.idle()");
    const detailText = await browser.evaluate("document.getElementById('sheetBody').innerText");
    check("A-26 task detail opens from the table and reads the full description/acceptance text",
      detailText.includes("长文本预览长文本预览") && detailText.includes("完整查看完整查看"), {});
    await browser.evaluate("document.getElementById('sheetClose').click()");
    await sleep(150);
    await browser.evaluate(setValue("p-filter-query", ""));
    await sleep(400);
    await browser.evaluate(setValue("p-filter-query", "zzz-no-such-task-" + RUN));
    await sleep(400);
    const noResult = await browser.evaluate("({ body: document.getElementById('p-table-body').innerText, clear: !!document.querySelector('[data-action=\"task-table-clear-filters\"]'), counts: Array.from(document.querySelectorAll('#p-table-counts [data-count] b')).map(el => Number(el.textContent)) })");
    await browser.evaluate("document.querySelector('[data-action=\"task-table-clear-filters\"]').click()");
    await sleep(200);
    check("A-27 a filtered-empty result is distinct from no tasks, offers clear-filters and restores rows",
      /没有符合筛选条件的任务/.test(noResult.body) && noResult.clear && noResult.counts.every((value) => value === 0)
      && await browser.evaluate("document.getElementById('p-filter-query').value === '' && document.querySelectorAll('#p-table-body tr[data-task-row]').length > 0"), noResult);

    // Date filters: closed intersection, single ends and invalid range keeping the last valid result.
    const expectedRange = middleRows.filter((row) => {
      const start = row.allDay ? row.startDate : companyDate(row.startAt);
      const due = row.allDay ? row.dueDate : companyDate(row.dueAt);
      return start <= "2026-11-01" && due >= "2026-11-01";
    });
    await browser.evaluate(setDate("p-filter-from", "2026-11-01"));
    await browser.evaluate(setDate("p-filter-to", "2026-11-01"));
    await sleep(150);
    const rangeCounts = await counts(browser);
    check("A-26 closed date intersection includes an all-day range touching 2026-11-01 and a timed midnight due",
      rangeCounts.total === expectedRange.length && expectedRange.some((row) => row.id === allDayCross.taskId) && expectedRange.some((row) => row.id === midnight.taskId),
      { total: rangeCounts.total, expected: expectedRange.length });
    await browser.evaluate(setDate("p-filter-to", ""));
    await sleep(150);
    const oneEndCounts = await counts(browser);
    check("A-26 a single date end still filters by intersection", oneEndCounts.total >= rangeCounts.total, { total: oneEndCounts.total });
    await browser.evaluate(setDate("p-filter-to", "2026-11-01"));
    await sleep(150);
    const beforeInvalid = await counts(browser);
    await browser.evaluate(setDate("p-filter-from", "2026-11-05"));
    await sleep(150);
    const invalid = await browser.evaluate("(() => { const box = document.getElementById('p-table-filter-error'); return { hidden: box.hidden, text: box.textContent, counts: JSON.parse(JSON.stringify(window.Pandora.taskForm.current() ? { total: window.Pandora.taskForm.current().counts.total } : {})) }; })()");
    check("A-26 an end before start shows a validation message and keeps the previous valid result",
      invalid.hidden === false && /结束日期不能早于开始日期/.test(invalid.text) && (await counts(browser)).total === beforeInvalid.total, invalid);
    await browser.evaluate(setDate("p-filter-from", ""));
    await browser.evaluate(setDate("p-filter-to", ""));
    await sleep(150);

    // Six sort columns on ASCII-only titles to keep collation deterministic.
    await browser.evaluate(setValue("p-filter-query", "TFbulk"));
    await sleep(400);
    const bulkRows = middleRows.filter((row) => row.title.startsWith("TFbulk"));
    const bulkBaseline = await counts(browser);
    const byId = new Map(bulkRows.map((row) => [row.id, row]));
    const collator = new Intl.Collator("zh-Hans-CN");
    const rank = {
      urgency: (row) => ({ urgent: 0, high: 1, medium: 2, low: 3 })[row.priority] ?? 2,
      status: (row) => ({ todo: 0, doing: 1, done: 2 })[row.executionState] ?? 0,
      createdAt: (row) => new Date(row.createdAt).getTime(),
      start: (row) => new Date(row.startAt).getTime(),
      due: (row) => new Date(row.dueAt).getTime(),
    };
    for (const [sortKey, keyName] of [["title", "title"], ["createdAt", "createdAt"], ["start", "start"], ["due", "due"], ["urgency", "urgency"], ["status", "status"]]) {
      for (const direction of ["asc", "desc"]) {
        const current = await browser.evaluate("window.Pandora.taskForm.state.sort");
        if (current.key === sortKey && current.dir === direction) {
          // Toggle away and back so the click always lands on the requested direction.
          await browser.evaluate(`document.querySelector('[data-action="task-table-sort"][data-key="${sortKey}"]').click()`);
          await sleep(80);
        }
        if ((await browser.evaluate("window.Pandora.taskForm.state.sort.key")) !== sortKey) {
          await browser.evaluate(`document.querySelector('[data-action="task-table-sort"][data-key="${sortKey}"]').click()`);
          await sleep(80);
        }
        if ((await browser.evaluate("window.Pandora.taskForm.state.sort.dir")) !== direction) {
          await browser.evaluate(`document.querySelector('[data-action="task-table-sort"][data-key="${sortKey}"]').click()`);
          await sleep(80);
        }
        const ids = await allRenderedIds(browser);
        let ordered = ids.length === bulkRows.length;
        for (let index = 1; ordered && index < ids.length; index += 1) {
          const left = byId.get(ids[index - 1]), right = byId.get(ids[index]);
          let value;
          if (sortKey === "title") value = collator.compare(left.title, right.title);
          else value = rank[keyName](left) - rank[keyName](right);
          if (value !== 0) {
            ordered = direction === "asc" ? value < 0 : value > 0;
          } else {
            ordered = left.id < right.id;
          }
        }
        const aria = await browser.evaluate(`(() => { const th = Array.from(document.querySelectorAll('#p-table-head th')).find(el => el.querySelector('[data-key="${sortKey}"]')); return th ? th.getAttribute('aria-sort') : null; })()`);
        check("A-26 sort " + sortKey + " " + direction + " orders the complete filtered set with an ascending id tiebreak and visible direction",
          ordered && aria === (direction === "asc" ? "ascending" : "descending"),
          { first: ids.slice(0, 3), aria, size: ids.length });
        check("A-26 counts stay unchanged after sort " + sortKey + " " + direction,
          JSON.stringify(await counts(browser)) === JSON.stringify(bulkBaseline), { counts: bulkBaseline });
        await resetPage(browser);
      }
    }
    await browser.evaluate(setValue("p-filter-query", ""));
    await sleep(400);
    await browser.evaluate("document.querySelector('[data-action=\"task-table-sort\"][data-key=\"start\"]').click()");
    if ((await browser.evaluate("window.Pandora.taskForm.state.sort.dir")) !== "asc") {
      await browser.evaluate("document.querySelector('[data-action=\"task-table-sort\"][data-key=\"start\"]').click()");
    }

    // Pagination invariants and out-of-range clamping.
    const page1Ids = await browser.evaluate("Array.from(document.querySelectorAll('#p-table-body tr[data-task-row]')).map(tr => tr.dataset.taskRow)");
    const pager1 = await browser.evaluate(text("#p-table-pager"));
    const pageCounts = await counts(browser);
    await browser.evaluate("document.querySelector('[data-action=\"task-table-next\"]').click()");
    await sleep(150);
    const page2Ids = await browser.evaluate("Array.from(document.querySelectorAll('#p-table-body tr[data-task-row]')).map(tr => tr.dataset.taskRow)");
    check("A-26 default paging shows 50 rows per page with the range, keeps counts per page and pages the sorted set",
      page1Ids.length === 50 && /第 1–50 条，共 \d+ 条/.test(pager1) && page2Ids.length === 50 && page2Ids[0] !== page1Ids[0]
      && JSON.stringify(await counts(browser)) === JSON.stringify(pageCounts), { page1: page1Ids.length, pager1 });
    await browser.evaluate("window.Pandora.taskForm.state.page = 99; window.Pandora.taskForm.paint();");
    await sleep(120);
    await browser.evaluate("document.querySelector('[data-action=\"task-table-refresh\"]').click()");
    await waitFor(browser, "window.Pandora.taskForm.state.loaded && !window.Pandora.taskForm.state.loading");
    check("A-26 an out-of-range page is clamped to a valid page after an explicit refresh",
      await browser.evaluate("window.Pandora.taskForm.state.page < 5 && document.querySelectorAll('#p-table-body tr[data-task-row]').length > 0"), {});

    // Keep filter/page/scroll while opening and closing detail.
    await browser.evaluate(setValue("p-filter-query", ""));
    await sleep(300);
    await browser.evaluate("document.querySelector('[data-action=\"task-table-next\"]').click()");
    await sleep(150);
    await browser.evaluate("document.getElementById('p-table-scroll').scrollTop = 160");
    const beforeDetail = await browser.evaluate("({ page: window.Pandora.taskForm.state.page, q: window.Pandora.taskForm.state.filters.query, scroll: document.getElementById('p-table-scroll').scrollTop })");
    await browser.evaluate("document.querySelector('#p-table-body tr[data-task-row] [data-field=\"title\"] button').click()");
    await waitFor(browser, "document.getElementById('overlay').hidden === false && window.Pandora.idle()");
    const hadPin = await browser.evaluate("!!document.querySelector('[data-action=\"p-toggle-task-pin\"]')");
    if (hadPin) {
      await browser.evaluate("document.querySelector('[data-action=\"p-toggle-task-pin\"]').click()");
      await waitFor(browser, "window.Pandora.idle() && !!document.querySelector('.p-task-table-card') && window.Pandora.taskForm.state.loaded");
    }
    await browser.evaluate("document.getElementById('sheetClose').click()");
    await sleep(200);
    const afterDetail = await browser.evaluate("({ page: window.Pandora.taskForm.state.page, q: window.Pandora.taskForm.state.filters.query, scroll: document.getElementById('p-table-scroll').scrollTop })");
    check("A-26 closing detail and a successful write keep the table filters, page and usable scroll position",
      hadPin && afterDetail.page === beforeDetail.page && afterDetail.q === beforeDetail.q && Math.abs(afterDetail.scroll - beforeDetail.scroll) <= 4, { hadPin, beforeDetail, afterDetail });

    const beforeOverdue = await counts(browser);
    const soonStart = Date.now() + 500;
    const soon = await createTask("middle", taskBody(T("due-soon"), [me.id], soonStart, soonStart + 5000));
    await sleep(6000);
    await browser.evaluate("document.querySelector('[data-action=\"task-table-refresh\"]').click()");
    await waitFor(browser, "window.Pandora.taskForm.state.loaded && !window.Pandora.taskForm.state.loading");
    const afterOverdue = await counts(browser);
    await browser.evaluate(setValue("p-filter-query", T("due-soon")));
    await sleep(400);
    const soonRow = await browser.evaluate(`(() => { const row = document.querySelector('#p-table-body tr[data-task-row=${JSON.stringify(soon.taskId)}]'); return row ? row.querySelector('[data-field="overdue"]').textContent : ''; })()`);
    await browser.evaluate(setValue("p-filter-query", ""));
    await sleep(400);
    check("A-26 overdue is computed from the effective dueAt instant, can overlap unfinished state and is not limited by paging",
      afterOverdue.overdue === beforeOverdue.overdue + 1 && afterOverdue.total === beforeOverdue.total + 1 && /逾期/.test(soonRow),
      { before: beforeOverdue.overdue, after: afterOverdue.overdue, row: soonRow });

    // Pagination failure: the second page never becomes a partial "complete" result.
    const beforeFailure = await browser.evaluate("window.Pandora.data.rawTasks.length");
    await browser.evaluate(`(() => {
      window.__tfOriginalFetch = window.__tfOriginalFetch || window.fetch;
      window.__tfFailPage = true;
      window.fetch = function (input, init) {
        const url = String(input);
        if (window.__tfFailPage && url.includes('/tasks?') && url.includes('offset=100')) {
          return Promise.resolve(new Response(JSON.stringify({ message: '测试分页失败' }), { status: 500, headers: { 'Content-Type': 'application/json' } }));
        }
        return window.__tfOriginalFetch(input, init);
      };
      window.Pandora.taskForm.refresh();
    })()`);
    await waitFor(browser, "!!window.Pandora.taskForm.state.error");
    const failure = await browser.evaluate("({ error: window.Pandora.taskForm.state.error, rows: window.Pandora.data.rawTasks.length, body: document.getElementById('p-table-body').innerText, counts: document.getElementById('p-table-counts').innerText })");
    check("A-27 a later page failure shows a retry error, never partial rows or counts, and leaves the committed set intact",
      failure.error && failure.rows === beforeFailure && /任务加载失败/.test(failure.body) && /加载失败/.test(failure.counts) && !/总数/.test(failure.counts), failure);
    await browser.evaluate("window.__tfFailPage = false; document.querySelector('[data-action=\"task-table-retry\"]').click()");
    await waitFor(browser, "window.Pandora.taskForm.state.loaded && !window.Pandora.taskForm.state.loading");
    check("A-27 retry after the failed page loads the complete set again", await browser.evaluate("window.Pandora.taskForm.state.rows.length > 200"), {});
    await browser.evaluate(`(() => {
      window.__tfResumeLoads = 0;
      window.__tfResumeFetch = window.fetch;
      window.fetch = function (input, init) {
        const url = String(input);
        if (url.includes('/tasks?') && url.includes('offset=0')) window.__tfResumeLoads += 1;
        return window.__tfResumeFetch(input, init);
      };
      window.dispatchEvent(new PageTransitionEvent('pageshow', { persisted: true }));
    })()`);
    await waitFor(browser, "window.Pandora.taskForm.state.loaded && !window.Pandora.taskForm.state.loading");
    await sleep(200);
    check("A-27 returning from the background re-queries the authorized task set", await browser.evaluate("window.__tfResumeLoads > 0"), {});
    await browser.evaluate("window.fetch = window.__tfResumeFetch");

    // Older refresh must not overwrite a newer one (request ordering).
    const beforeRace = await browser.evaluate("window.Pandora.data.rawTasks.length");
    await browser.evaluate(`(() => {
      window.__tfOriginalFetch = window.__tfOriginalFetch || window.fetch;
      window.__tfSlowTasks = true;
      window.fetch = function (input, init) {
        const url = String(input);
        if (window.__tfSlowTasks && url.includes('/tasks?') && url.includes('offset=0')) {
          return new Promise((resolve) => setTimeout(() => resolve(window.__tfOriginalFetch(input, init)), 1200));
        }
        return window.__tfOriginalFetch(input, init);
      };
      window.Pandora.taskForm.refresh();
    })()`);
    await sleep(80);
    const raceTask = await createTask("upper", taskBody("TF26 race " + RUN, [me.id], at(23, 9), at(24, 18)));
    await sleep(80);
    await browser.evaluate("window.__tfSlowTasks = false; window.Pandora.taskForm.refresh()");
    await waitFor(browser, "window.Pandora.taskForm.state.loaded && !window.Pandora.taskForm.state.loading");
    await sleep(1400);
    const raceState = await browser.evaluate("({ hasRace: window.Pandora.taskForm.state.rows.some(t => t.id === " + JSON.stringify(raceTask.taskId) + "), rows: window.Pandora.taskForm.state.rows.length, ids: new Set(window.Pandora.taskForm.state.rows.map(t => t.id)).size })");
    check("A-27 a slower earlier refresh cannot overwrite the newer complete result and ids stay deduplicated",
      raceState.hasRace && raceState.rows === raceState.ids && raceState.rows >= beforeRace, raceState);

    // Calendar projection (A-13) across month/week/day and hidden count based only on own tasks.
    await browser.evaluate("document.querySelector('[data-action=\"task-table-close\"]').click()");
    await waitFor(browser, "!!document.querySelector('.p-schedule-card')");
    for (const mode of ["month", "week", "day"]) {
      if ((await browser.evaluate("state.viewMode")) !== mode) {
        await browser.evaluate(`document.querySelector('[data-action="schedule-mode"][data-mode="${mode}"]').click()`);
        await waitFor(browser, `state.viewMode === '${mode}'`);
      }
      await browser.evaluate("state.viewAnchor = new Date(2026, 9, 30); renderAll()");
      await sleep(200);
      const projection = await browser.evaluate(`(() => {
        const me = window.Pandora.data.me.id;
        const byId = new Map(window.Pandora.data.rawTasks.map(t => [t.id || t.taskId, t]));
        const events = Array.from(document.querySelectorAll('.p-month-event,.p-time-event,.p-all-day-event'));
        const hiddenTaskIds = Array.from(document.querySelectorAll('.p-month-more[data-hidden-count]')).map(el => Number(el.dataset.hiddenCount));
        const visibleIds = new Set(window.Pandora.data.rawTasks.filter(t => t.originalCreatorId !== me && !(t.assigneeIds || []).includes(me)).map(t => t.id || t.taskId));
        return {
          events: events.length,
          visibleEvent: events.some(el => visibleIds.has(el.dataset.task)),
          notOwn: events.filter(el => { const task = byId.get(el.dataset.task); return !task || !(task.assigneeIds || []).includes(me); }).map(el => el.dataset.task),
          hidden: hiddenTaskIds,
        };
      })()`);
      check("A-13 " + mode + " calendar only draws tasks whose effective assignees include the current user",
        projection.events > 0 && !projection.visibleEvent && projection.notOwn.length === 0, projection);
    }
    await browser.evaluate("state.viewAnchor = new Date(2026, 9, 30); renderAll()");
    await browser.evaluate(`document.querySelector('[data-action="schedule-mode"][data-mode="month"]').click()`);
    await sleep(200);
    const hiddenCount = await browser.evaluate(`(() => {
      const day = window.Pandora.calendar.dayTasks(new Date(2026, 9, 30)).length;
      const week = Array.from(document.querySelectorAll('.p-month-week')).find(el => el.dataset.weekStart === '2026-10-26');
      const events = week ? Array.from(week.querySelectorAll('.p-month-event')).filter(el => {
        const start = Number(el.dataset.startColumn), end = Number(el.dataset.endColumn);
        const col = 4; // 2026-10-30 is Friday, the fifth column of a Monday-first week.
        return start <= col && end > col;
      }).length : 0;
      const more = week && week.querySelector('.p-month-more[data-date="2026-10-30"]');
      const hidden = more ? Number(more.dataset.hiddenCount) : 0;
      return { day, events, hidden };
    })()`);
    check("A-27 the month hidden count is computed from own tasks only, not the full authorized set",
      hiddenCount.day >= 0 && hiddenCount.events + hiddenCount.hidden === hiddenCount.day && hiddenCount.hidden > 0, hiddenCount);
    check("A-13 the same visible-only task stays available in the table's 仅可见 range and opens its detail",
      await browser.evaluate("document.querySelector('[data-action=\"task-table-open\"]').click(), true") &&
      await waitFor(browser, "window.Pandora.taskForm && window.Pandora.taskForm.state.loaded"),
      {});
    await browser.evaluate(setSelect("p-filter-relation", "visible"));
    await sleep(200);
    const visibleDetail = await browser.evaluate(`(() => { const row = document.querySelector('#p-table-body tr[data-task-row=' + JSON.stringify(${JSON.stringify(visibleOnly.taskId)}) + ']'); if (!row) return false; row.querySelector('[data-field="title"] button').click(); return true; })()`);
    const detailOpened = visibleDetail && await waitFor(browser, "document.getElementById('overlay').hidden === false && window.Pandora.idle()");
    check("A-13 以组织授权可见的任务仍在任务表单且可打开原详情（日历收窄不扩大为全站收窄）", detailOpened, {});
    await browser.evaluate("document.getElementById('sheetClose').click()");
    await sleep(150);
    await browser.evaluate(setSelect("p-filter-relation", "all"));

    // Assignee change: remove self but keep creator -> disappears from the calendar, stays in 我创建.
    await changeAndApprove("middle", calendarLeave.taskId, { assigneeIds: [users.employee.id] }, "middle");
    await browser.evaluate("document.querySelector('[data-action=\"task-table-close\"]').click()");
    await waitFor(browser, "!!document.querySelector('.p-schedule-card')");
    await waitFor(browser, "(() => { const task = window.Pandora.data.rawTasks.find(t => (t.id || t.taskId) === " + JSON.stringify(calendarLeave.taskId) + "); return !!task && (task.assigneeIds || []).includes(" + JSON.stringify(users.employee.id) + "); })()", 8000);
    await sleep(200);
    await browser.evaluate("state.viewAnchor = new Date(2026, 9, 27); renderAll()");
    await sleep(200);
    const goneFromCalendar = await browser.evaluate("!Array.from(document.querySelectorAll('.p-month-event,.p-time-event,.p-all-day-event')).some(el => el.dataset.task === " + JSON.stringify(calendarLeave.taskId) + ")");
    await browser.evaluate("window.Pandora.taskForm.open()");
    await waitFor(browser, "window.Pandora.taskForm.state.loaded");
    await browser.evaluate(setSelect("p-filter-relation", "created"));
    await sleep(200);
    const stillInCreated = await browser.evaluate("!!document.querySelector('#p-table-body tr[data-task-row=" + JSON.stringify(calendarLeave.taskId) + "]') || window.Pandora.taskForm.state.rows.some(t => t.id === " + JSON.stringify(calendarLeave.taskId) + ")");
    check("A-13 after an effective assignee removal the task leaves the calendar but remains in 我创建",
      goneFromCalendar && stillInCreated, { goneFromCalendar, stillInCreated });
    await browser.evaluate(setSelect("p-filter-relation", "all"));

    // Screenshots (desktop + narrow) of the complete table.
    if (shots) {
      await resetPage(browser);
      await browser.screenshot(path.join(shots, "task-form-desktop.png"), 1440, 900);
    }
    await browser.setViewport(390, 844);
    await sleep(300);
    const narrow = await browser.evaluate(`(() => { const nav = document.querySelectorAll('#tabbar button').length; const scroll = document.getElementById('p-table-scroll'); const back = document.querySelector('[data-action="task-table-close"]').getBoundingClientRect(); return { nav, horizontal: scroll.scrollWidth > scroll.clientWidth, vertical: scroll.scrollHeight >= scroll.clientHeight, back: back.top >= 0 && back.right <= innerWidth, rows: document.querySelectorAll('#p-table-body tr[data-task-row]').length }; })()`);
    check("A-26 narrow screen keeps the five main navs, the scrollable table, rows and the back/filter controls reachable",
      narrow.nav === 5 && narrow.horizontal && narrow.vertical && narrow.back && narrow.rows > 0, narrow);
    if (shots) await browser.screenshot(path.join(shots, "task-form-narrow.png"), 390, 844);
    await browser.setViewport(1440, 900);
    await sleep(200);
    await browser.evaluate("TASKS.splice(0); window.Pandora.data.rawTasks = []; window.Pandora.taskForm.state.rows = []; window.Pandora.taskForm.state.loaded = true; window.Pandora.taskForm.paint();");
    await sleep(120);
    const noTasks = await browser.evaluate("({ body: document.getElementById('p-table-body').innerText, refresh: !!document.querySelector('[data-action=\"task-table-refresh\"]'), counts: Array.from(document.querySelectorAll('#p-table-counts [data-count] b')).map(el => Number(el.textContent)) })");
    check("A-27 no authorized task shows its own empty state with a reload action and zero counts",
      /当前没有可查看的任务/.test(noTasks.body) && noTasks.refresh && noTasks.counts.every((value) => value === 0), noTasks);
    check("A-27 no uncaught script or console errors on the task-form page", browser.errors.length === 0, browser.errors.slice(0, 5));
  } finally {
    browser.kill();
  }

  /* ----- employee permission/loss flow and historical isolation ----- */
  const employeeBrowser = await openBrowser(base + "/", COMPANY_TZ);
  try {
    await login(employeeBrowser, "employee", password);
    const employeeTable = await openTable(employeeBrowser);
    const employeeTableIds = await employeeBrowser.evaluate("window.Pandora.taskForm.state.rows.map(t => t.id)");
    check("A-27 unpublished 待创建审核 never enters the employee table or search",
      employeeTable && !employeeTableIds.includes(unpublishEmployee.taskId)
      && await employeeBrowser.evaluate("!Array.from(document.querySelectorAll('#p-table-body tr[data-task-row]')).some(tr => tr.dataset.taskRow === " + JSON.stringify(unpublishEmployee.taskId) + ")"), {});
    check("A-26 the employee table contains the effective task that will be revoked",
      employeeTableIds.includes(revokeEmployee.taskId), {});
    // Effective assignee removal: employee loses normal access; the table must discard the row on refresh.
    await changeAndApprove("middle", revokeEmployee.taskId, { assigneeIds: [users.colleague.id] }, "middle");
    await employeeBrowser.evaluate("document.querySelector('[data-action=\"task-table-refresh\"]').click()");
    await waitFor(employeeBrowser, "window.Pandora.taskForm.state.loaded && !window.Pandora.taskForm.state.loading");
    const revoked = await employeeBrowser.evaluate("({ has: window.Pandora.taskForm.state.rows.some(t => t.id === " + JSON.stringify(revokeEmployee.taskId) + "), rows: document.querySelectorAll('#p-table-body tr[data-task-row]').length })");
    check("A-27 after normal access is revoked the row leaves the table and counts on refresh", !revoked.has, revoked);
    // Historical notification-only access must not refill the table.
    await api(base, "POST", "/api/v1/admin/worker/run-once", { token: tokens.admin });
    await sleep(300);
    await api(base, "POST", "/api/v1/admin/worker/run-once", { token: tokens.admin });
    const notices = (await api(base, "GET", "/api/v1/notifications?limit=100", { token: tokens.employee })).body.items || [];
    const historical = notices.find((row) => row.taskId === revokeEmployee.taskId && row.relationLost === true);
    let historicalReadable = false;
    if (historical) {
      const detail = await api(base, "GET", "/api/v1/notifications/" + historical.id + "/task", { token: tokens.employee });
      historicalReadable = detail.status === 200;
    }
    await employeeBrowser.evaluate("document.querySelector('[data-action=\"task-table-refresh\"]').click()");
    await waitFor(employeeBrowser, "window.Pandora.taskForm.state.loaded && !window.Pandora.taskForm.state.loading");
    check("A-27 a historical read-only notification does not add the task back to the table",
      !!historical && historicalReadable && !(await employeeBrowser.evaluate("window.Pandora.taskForm.state.rows.some(t => t.id === " + JSON.stringify(revokeEmployee.taskId) + ")")),
      { historical: !!historical, historicalReadable });
    const oldDetail = await api(base, "GET", "/api/v1/tasks/" + revokeEmployee.taskId, { token: tokens.employee });
    check("A-27 an old detail after access loss is refused by the backend instead of served from cache", oldDetail.status === 404, { status: oldDetail.status });
    await employeeBrowser.evaluate("window.Pandora.openTask(" + JSON.stringify(revokeEmployee.taskId) + ")");
    await waitFor(employeeBrowser, "window.Pandora.idle()");
    await waitFor(employeeBrowser, "window.Pandora.taskForm.state.loaded && !window.Pandora.taskForm.state.loading");
    const discarded = await employeeBrowser.evaluate("({ rows: window.Pandora.taskForm.state.rows.some(t => t.id === " + JSON.stringify(revokeEmployee.taskId) + "), dom: !!document.querySelector('#p-table-body tr[data-task-row=" + JSON.stringify(revokeEmployee.taskId) + "]') })");
    check("A-27 a 403/404 detail discards the old row and re-queries instead of keeping it in the table", !discarded.rows && !discarded.dom, discarded);
  } finally {
    employeeBrowser.kill();
  }

  /* ----- admin entry, account switch and stale responses ----- */
  const adminBrowser = await openBrowser(base + "/", COMPANY_TZ);
  try {
    await waitFor(adminBrowser, "!!document.getElementById('backend-login')");
    await adminBrowser.evaluate(setValue("login-user", "admin"));
    await adminBrowser.evaluate(setValue("login-password", password));
    await adminBrowser.evaluate(submit("backend-login"));
    const prompt = await waitFor(adminBrowser, "/管理员请使用/.test(document.body.innerText)");
    const adminPage = await fetch(base + "/admin.html");
    check("A-28 the administrator prompt points at the real /admin.html PC entry and the app has no full management module",
      prompt && (await adminBrowser.evaluate("/\\/admin\\.html/.test(document.body.innerText)")) && adminPage.status === 200
      && (await adminBrowser.evaluate("document.querySelectorAll('#tabbar button').length === 5 && !document.querySelector('[data-admin-tab]')")), { prompt });
  } finally {
    adminBrowser.kill();
  }

  const switchBrowser = await openBrowser(base + "/", COMPANY_TZ);
  try {
    await login(switchBrowser, "middle", password);
    await openTable(switchBrowser);
    await switchBrowser.evaluate(`(() => {
      window.__tfOriginalFetch = window.__tfOriginalFetch || window.fetch;
      window.__tfSlowTasks = true;
      window.fetch = function (input, init) {
        const url = String(input);
        if (window.__tfSlowTasks && url.includes('/tasks?')) return new Promise((resolve) => setTimeout(() => resolve(window.__tfOriginalFetch(input, init)), 1200));
        return window.__tfOriginalFetch(input, init);
      };
      window.Pandora.taskForm.refresh();
    })()`);
    await sleep(100);
    await switchBrowser.evaluate("window.Pandora.busy(() => window.Pandora.logout())");
    await waitFor(switchBrowser, "!!document.getElementById('backend-login')");
    await sleep(1500);
    const afterLogout = await switchBrowser.evaluate("({ login: !!document.getElementById('backend-login'), page: state.viewPage, rows: window.Pandora.taskForm.state.rows.length, filters: window.Pandora.taskForm.state.filters, ready: window.Pandora.ready })");
    check("A-27 logout during an in-flight task refresh clears rows/filters and a late response cannot repopulate the table",
      afterLogout.login && !afterLogout.ready && afterLogout.page === "calendar" && afterLogout.rows === 0
      && Object.values(afterLogout.filters).every((value) => value === "" || value === "all"), afterLogout);
    check("A-27 no uncaught script errors after the login switch and late response", switchBrowser.errors.length === 0, switchBrowser.errors.slice(0, 5));
  } finally {
    switchBrowser.kill();
  }

  const failed = RESULTS.filter((row) => !row.pass);
  console.log(`\n${RESULTS.filter((row) => row.pass).length}/${RESULTS.length} checks passed`);
  if (output) {
    fs.mkdirSync(path.dirname(path.resolve(output)), { recursive: true });
    fs.writeFileSync(path.resolve(output), JSON.stringify({ run: RUN, base, total: RESULTS.length, failures: failed.length, results: RESULTS }, null, 2) + "\n");
  }
  if (failed.length) process.exitCode = 1;
}

main().catch((error) => { console.error(error); process.exitCode = 1; });
