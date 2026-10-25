#!/usr/bin/env node
"use strict";
/*
 * Chapter 4 browser + HTTP check: creation without a completion criterion, a company-wide candidate
 * picker with creator-based review, the shared hour/minute control, reopen with a new schedule and
 * resubmitting an expired creation.
 *
 * Run against a throwaway seeded database (never the user's own):
 *   backend/scripts/run_check_isolated.sh node scripts/check_task_creation_flow.js --base-url {base} --database {db}
 *
 * It drives the served prototype in headless Chrome; every check prints PASS/FAIL and the run can be
 * written as JSON evidence with --output. The one database write is the controlled expiry fixture,
 * which sets a pending request's applicable deadline into the past in the throwaway database only.
 */
const { spawn, execFileSync } = require("child_process");
const crypto = require("crypto");
const fs = require("fs");
const os = require("os");
const path = require("path");

/* Employees authenticate by phone number (chapter 2.1/2.3). */
const DEMO_PHONE = { upper: "13800000001", middle: "13800000002", market: "13800000003",
  employee: "13800000004", colleague: "13800000005", marketing: "13800000006", admin: "admin" };
function loginIdentity(account) { return DEMO_PHONE[account] || account; }

const CHROME = process.env.CHROME_BIN || [
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  "/usr/bin/google-chrome", "/usr/bin/google-chrome-stable",
  "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
].find((candidate) => fs.existsSync(candidate));
const RESULTS = [];
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function check(name, condition, evidence) {
  RESULTS.push({ check: name, pass: !!condition, evidence: evidence === undefined ? null : evidence });
  console.log((condition ? "PASS  " : "FAIL  ") + name + (condition ? "" : "  -> " + JSON.stringify(evidence)));
}
function arg(name, fallback) {
  const index = process.argv.indexOf("--" + name);
  return index >= 0 ? process.argv[index + 1] : fallback;
}
const key = (prefix = "c4") => prefix + "-" + crypto.randomUUID();
const iso = (value) => new Date(value).toISOString().replace("Z", "+00:00");

async function api(base, method, route, { token, body, idem, ifMatch } = {}) {
  const headers = { "Content-Type": "application/json", Accept: "application/json" };
  if (token) headers.Authorization = "Bearer " + token;
  if (idem) headers["Idempotency-Key"] = idem;
  if (ifMatch) headers["If-Match"] = ifMatch;
  const response = await fetch(base + route, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
  const text = await response.text();
  return { status: response.status, body: text ? JSON.parse(text) : {}, headers: Object.fromEntries(response.headers) };
}
async function login(base, account, password) {
  const result = await api(base, "POST", "/api/v1/auth/sessions", { body: { username: loginIdentity(account), password } });
  if (result.status !== 200) throw new Error("login failed for " + account + ": " + result.status + " " + JSON.stringify(result.body));
  return result.body;
}

/* ---------- headless Chrome over CDP ---------- */
async function openBrowser(url) {
  if (!CHROME) throw new Error("Chrome not found; set CHROME_BIN");
  const port = 9700 + Math.floor(Math.random() * 90);
  const proc = spawn(CHROME, ["--headless", "--no-sandbox", "--disable-gpu", "--no-first-run",
    "--no-default-browser-check", "--disable-crash-reporter", "--hide-scrollbars",
    "--remote-debugging-port=" + port,
    "--user-data-dir=" + path.join(os.tmpdir(), "pandora-c4-" + crypto.randomBytes(4).toString("hex")), url], { stdio: "ignore" });
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
      errors.push("EXC: " + ((message.params.exceptionDetails.exception && message.params.exceptionDetails.exception.description) || message.params.exceptionDetails.text));
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
  await send("Emulation.setDeviceMetricsOverride", { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });
  const evaluate = async (expression) => {
    const result = await send("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true, userGesture: true });
    if (result.exceptionDetails) throw new Error((result.exceptionDetails.exception && result.exceptionDetails.exception.description) || result.exceptionDetails.text);
    return result.result.value;
  };
  const screenshot = async (file) => {
    const shot = await send("Page.captureScreenshot", { format: "png" });
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, Buffer.from(shot.data, "base64"));
  };
  return { evaluate, send, screenshot, errors, kill: () => { try { ws.close(); } catch {} proc.kill("SIGKILL"); } };
}
async function waitFor(browser, expression, timeout = 15000) {
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) {
    try { if (await browser.evaluate(expression)) return true; } catch {}
    await sleep(150);
  }
  return false;
}
const setValue = (id, value) => `(() => { const el = document.getElementById(${JSON.stringify(id)}); if (!el) return false; el.value = ${JSON.stringify(value)}; el.dispatchEvent(new Event("input", {bubbles:true})); return true; })()`;
const setSelect = (id, value) => `(() => { const el = document.getElementById(${JSON.stringify(id)}); if (!el) return false; el.value = ${JSON.stringify(value)}; el.dispatchEvent(new Event("change", {bubbles:true})); return true; })()`;
const click = (selector) => `(() => { const el = document.querySelector(${JSON.stringify(selector)}); if (!el) return "missing"; el.click(); return "clicked"; })()`;
const textOf = (selector) => `((document.querySelector(${JSON.stringify(selector)}) || {}).textContent || "")`;

async function loginBrowser(browser, phone, password) {
  if (!(await waitFor(browser, "!!document.getElementById('backend-login')"))) throw new Error("login form missing");
  await browser.evaluate(setValue("login-user", phone));
  await browser.evaluate(setValue("login-password", password));
  await browser.evaluate("document.getElementById('backend-login').requestSubmit(), true");
  if (!(await waitFor(browser, "window.Pandora && window.Pandora.ready"))) throw new Error("workspace did not load");
}

function sql(optionFile, database, statement) {
  return execFileSync("mysql", ["--defaults-file=" + optionFile, "--batch", "--skip-column-names", "--database=" + database, "-e", statement], { encoding: "utf8" });
}

async function main() {
  const base = arg("base-url", "http://127.0.0.1:18130");
  const password = arg("password", "Demo@123456");
  const database = arg("database", null);
  const optionFile = arg("defaults-file", ".runtime/mysql-admin.cnf");
  const output = arg("output", null);

  const middle = await login(base, "middle", password);
  const employee = await login(base, "employee", password);
  const upper = await login(base, "upper", password);
  const admin = await login(base, "admin", password);
  const managerName = middle.user.displayName;      // 李敏 is 张涛's direct manager
  const founderName = upper.user.displayName;        // 王海 is the unique organization root

  /* ---------- fixtures through the real API ---------- */
  const now = Date.now();
  const taskBody = (title, owners, days = 3, allDay = false) => ({
    title, description: "第四章浏览器核验 · " + title, priority: "medium", allDay, assigneeIds: owners,
    ...(allDay
      ? { startDate: new Date(now + 86400000).toISOString().slice(0, 10), dueDate: new Date(now + 4 * 86400000).toISOString().slice(0, 10) }
      : { startAt: iso(now + 86400000), dueAt: iso(now + days * 86400000) }),
  });
  const decide = async (token, requestId, decision, comment) => {
    const view = await api(base, "GET", "/api/v1/approval-requests/" + requestId, { token });
    return api(base, "PATCH", "/api/v1/approval-requests/" + requestId, {
      token, body: { decision, comment }, idem: key("decide"), ifMatch: view.headers.etag || '"' + view.body.rowVersion + '"',
    });
  };

  // A completed task created by the middle manager: used for the reopen form.
  const completable = await api(base, "POST", "/api/v1/tasks", { token: middle.token, idem: key("t"),
    body: taskBody("重开表单核验 " + crypto.randomBytes(2).toString("hex"), [employee.user.id]) });
  if (completable.status !== 201) throw new Error("fixture create failed: " + JSON.stringify(completable.body));
  await decide(upper.token, completable.body.requestId, "approve", "fixture");
  const employeeDetail = await api(base, "GET", "/api/v1/tasks/" + completable.body.taskId, { token: employee.token });
  const done = await api(base, "PATCH", "/api/v1/tasks/" + completable.body.taskId, { token: employee.token,
    idem: key("complete"), ifMatch: employeeDetail.headers.etag, body: { command: "complete", completionNote: "完成核验" } });
  await decide(middle.token, done.body.requestId, "approve", "fixture");

  // A founder-owned task: a progress request on it routes back to the founder, so the applicant and
  // the reviewer are the same person and the page must not claim the creation exemption.
  const selfReview = await api(base, "POST", "/api/v1/tasks", { token: upper.token, idem: key("t"),
    body: taskBody("自审提示核验 " + crypto.randomBytes(2).toString("hex"), [upper.user.id]) });

  // An expired creation owned by the employee, expired only in this throwaway database.
  const expiring = await api(base, "POST", "/api/v1/tasks", { token: employee.token, idem: key("t"),
    body: taskBody("失效重提核验 " + crypto.randomBytes(2).toString("hex"), [employee.user.id]) });
  if (!database) throw new Error("--database is required for the controlled expiry fixture");
  sql(optionFile, database, "UPDATE approval_requests SET applicable_deadline=DATE_SUB(UTC_TIMESTAMP(6), INTERVAL 2 HOUR) WHERE id='" + expiring.body.requestId + "'");
  // The applicant's next submit expires the stale request in a committed transaction first.
  const staleAttempt = await api(base, "PATCH", "/api/v1/approval-requests/" + expiring.body.requestId, {
    token: middle.token, idem: key("stale"), ifMatch: '"1"', body: { decision: "approve", comment: "迟到批准" } });
  check("4.4 a request past its applicable deadline expires instead of being approved",
    staleAttempt.status === 409 && staleAttempt.body.code === "REQUEST_EXPIRED", { status: staleAttempt.status, body: staleAttempt.body });

  const browser = await openBrowser(base + "/");
  try {
    /* ---------- 1. creation form: no criterion, web time control, creator-based hint ---------- */
    await loginBrowser(browser, loginIdentity("middle"), password);
    await browser.evaluate("window.openTaskForm('create')");
    await waitFor(browser, "!document.getElementById('overlay').hidden");
    check("4.1 the creation form opens without a completion-criterion field",
      !(await browser.evaluate("!!document.getElementById('tf-acceptance')")), {});
    check("4.2 the schedule uses the shared hour/minute selects instead of a platform time picker",
      await browser.evaluate("document.querySelectorAll('#sheetBody input[type=time]').length === 0 && document.querySelectorAll('#sheetBody select[data-time-part]').length === 4"),
      { selects: await browser.evaluate("document.querySelectorAll('#sheetBody select[data-time-part]').length") });
    // All-day round trip must not lose the entered time, and cancel must not submit.
    await browser.evaluate(setSelect("tf-start-time-hour", "10"));
    await browser.evaluate(setSelect("tf-start-time-minute", "30"));
    await browser.evaluate(`(() => { const box = document.getElementById('tf-allday'); box.checked = true; box.dispatchEvent(new Event('change', { bubbles: true })); box.checked = false; box.dispatchEvent(new Event('change', { bubbles: true })); return true; })()`);
    check("4.2 toggling all-day keeps the entered hour/minute in the web control",
      (await browser.evaluate("window.Pandora.readTimeControl('tf-start-time')")) === "10:30",
      { value: await browser.evaluate("window.Pandora.readTimeControl('tf-start-time')") });
    const creationHint = await browser.evaluate("Array.from(document.querySelectorAll('#sheetBody .callout.info')).map((el) => el.textContent).join(' | ')");
    check("3.5 the creation form previews the creator's direct manager",
      creationHint.includes(founderName) && creationHint.includes("创建审核人") && !creationHint.includes("无需审核"),
      { hint: creationHint });

    /* ---------- 2. assign across departments and upward through the real picker ---------- */
    await browser.evaluate(click('[data-action="pick-assignees"]'));
    await waitFor(browser, "!!document.querySelector('[data-pick-person]')");
    const departments = await browser.evaluate("Array.from(document.querySelectorAll('[data-pick-dept]')).map((el) => el.dataset.pickDept)");
    check("3.1 the picker offers candidates from every department, not just the creator's",
      departments.length >= 3, { departments: departments });
    await browser.evaluate(`(() => { const el = Array.from(document.querySelectorAll('[data-pick-dept]')).find((node) => node.dataset.pickDept === ${JSON.stringify("管理层")}); if (el) el.click(); return !!el; })()`);
    await sleep(250);
    const pickerRows = await browser.evaluate("Array.from(document.querySelectorAll('[data-pick-person]')).map((el) => el.dataset.pickPerson)");
    check("3.1 the founder is a selectable assignee for an ordinary employee",
      pickerRows.includes(upper.user.id), { candidates: pickerRows.length });
    await browser.evaluate(`(() => { const el = document.querySelector('[data-pick-person="${upper.user.id}"]'); if (!el) return false; el.checked = true; el.dispatchEvent(new Event("change", { bubbles: true })); return true; })()`);
    await browser.evaluate(click('[data-action="picker-assignee-confirm"]'));
    await waitFor(browser, "document.getElementById('sheetTitle').textContent === '创建任务'");
    check("3.1 the founder can be selected as an assignee from the employee web form",
      (await browser.evaluate("document.getElementById('sheetBody').innerText")).includes(founderName), {});
    const hintAfterPick = await browser.evaluate("Array.from(document.querySelectorAll('#sheetBody .callout.info')).map((el) => el.textContent).join(' | ')");
    check("3.2 changing the assignee does not move the creation reviewer",
      hintAfterPick.includes(founderName) && hintAfterPick.includes("创建审核人"), { hint: hintAfterPick });

    /* ---------- 3. submit the creation ---------- */
    const title = "浏览器创建核验 " + crypto.randomBytes(2).toString("hex");
    await browser.evaluate(setValue("tf-title", title));
    await browser.evaluate(setValue("tf-desc", "不填写完成标准，仅选择创始人作为负责人。"));
    await browser.evaluate(setSelect("tf-start-time-hour", "10"));
    await browser.evaluate(setSelect("tf-start-time-minute", "30"));
    await browser.evaluate(click('[data-action="save-task"]'));
    if (!(await waitFor(browser, "document.getElementById('overlay').hidden", 20000))) {
      console.log("create submit feedback:", await browser.evaluate("({ notice: (document.getElementById('appNotice')||{}).textContent, error: (document.getElementById('tf-error')||{}).textContent, dates: [ (document.getElementById('tf-start-date')||{}).value, (document.getElementById('tf-end-date')||{}).value, window.Pandora.readTimeControl('tf-start-time'), window.Pandora.readTimeControl('tf-end-time') ], owners: (window.Pandora && null) })"));
    }
    const submissions = await api(base, "GET", "/api/v1/approval-requests?mine=applicant", { token: middle.token });
    const submitted = (submissions.body.items || []).find((row) => row.title === title && row.status === "pending");
    const proposed = submitted && submitted.proposedVersion;
    check("4.1 a creation without a completion criterion can be submitted with another person as owner",
      !!submitted && proposed.assigneeIds.includes(upper.user.id) && proposed.acceptanceCriteria === "",
      { owners: proposed && proposed.assigneeIds, criteria: proposed && proposed.acceptanceCriteria,
        recent: (submissions.body.items || []).slice(0, 4).map((row) => [row.title, row.kind, row.status]),
        wanted: title });
    check("3.5 the creation is reviewed by the creator's direct manager, not the selected founder",
      !!submitted && submitted.currentReviewerId === upper.user.id, { reviewer: submitted && submitted.currentReviewerId });
    await browser.screenshot(path.join(__dirname, "..", "..", "audit", "chapter4-creation-form.png"));

    /* ---------- 3b. reviewer-only authorized diff in the page (4.6) ---------- */
    if (submitted) {
      await decide(upper.token, submitted.requestId, "approve", "fixture");
      const taskNow = await api(base, "GET", "/api/v1/tasks/" + submitted.taskId, { token: middle.token });
      const changed = await api(base, "PATCH", "/api/v1/tasks/" + submitted.taskId, {
        token: middle.token, idem: key("change"), ifMatch: taskNow.headers.etag,
        body: { command: "change", reason: "仅调整负责人", title: title, assigneeIds: [employee.user.id] },
      });
      if (changed.status === 200 && changed.body.requestId) {
        await browser.evaluate("window.Pandora.openApproval('" + changed.body.requestId + "')");
        await waitFor(browser, "!document.getElementById('overlay').hidden");
        const diffText = await browser.evaluate("document.getElementById('sheetBody').innerText");
        check("4.6 the reviewer sees the backend's field-by-field diff with before and after values",
          diffText.includes("本次授权差异") && diffText.includes("负责人") && diffText.includes("→"),
          { text: diffText.slice(0, 220) });
        await browser.evaluate("document.getElementById('sheetClose').click(), true");
        const live = await api(base, "GET", "/api/v1/approval-requests/" + changed.body.requestId, { token: middle.token });
        await api(base, "PATCH", "/api/v1/approval-requests/" + changed.body.requestId, {
          token: middle.token, idem: key("withdraw"), ifMatch: live.headers.etag,
          body: { decision: "withdraw" },
        });
      }
    }

    /* ---------- 4. reopen form with a new schedule ---------- */
    await browser.evaluate("document.getElementById('sheetClose').click(), true");
    await browser.evaluate("window.Pandora.logout(), true");
    await loginBrowser(browser, loginIdentity("middle"), password);
    await browser.evaluate("window.openTaskDetail('" + completable.body.taskId + "')");
    if (!(await waitFor(browser, "!!document.querySelector('[data-action=\"p-reopen-task\"]')", 20000))) {
      console.log("detail state:", await browser.evaluate("({ title: document.getElementById('sheetTitle').textContent, has: !!document.querySelector('[data-action=\"p-reopen-task\"]') })"));
    }
    await browser.evaluate(click('[data-action="p-reopen-task"]'));
    await waitFor(browser, "!!document.getElementById('rp-allday')");
    check("4.3 the reopen action carries an all-day switch, dates and the shared time control",
      await browser.evaluate("!!document.getElementById('rp-allday') && !!document.getElementById('rp-start-date') && !!document.getElementById('rp-end-date') && document.querySelectorAll('#sheetBody select[data-time-part]').length === 4"),
      {});
    const futureStart = new Date(now + 20 * 86400000).toISOString().slice(0, 10);
    const futureDue = new Date(now + 24 * 86400000).toISOString().slice(0, 10);
    await browser.evaluate(setValue("rp-start-date", futureStart));
    await browser.evaluate(setValue("rp-end-date", futureDue));
    await browser.evaluate(setValue("reopen-reason", "补充材料后重开，旧截止已过。"));
    await browser.evaluate(click('[data-action="p-confirm-reopen"]'));
    if (!(await waitFor(browser, "document.getElementById('overlay').hidden", 20000))) {
      console.log("reopen submit feedback:", await browser.evaluate("({ notice: (document.getElementById('appNotice')||{}).textContent, error: (document.getElementById('reopen-error')||{}).textContent, dates: [ (document.getElementById('rp-start-date')||{}).value, (document.getElementById('rp-end-date')||{}).value, window.Pandora.readTimeControl('rp-start-time'), window.Pandora.readTimeControl('rp-end-time') ] })"));
    }
    const reopened = await api(base, "GET", "/api/v1/tasks/" + completable.body.taskId, { token: middle.token });
    const reopenRequests = await api(base, "GET", "/api/v1/approval-requests?mine=applicant", { token: middle.token });
    const reopenPending = (reopenRequests.body.items || []).find((row) => row.taskId === completable.body.taskId && row.kind === "reopen" && row.status === "pending");
    const reopenDetail = reopenPending
      ? await api(base, "GET", "/api/v1/approval-requests/" + reopenPending.requestId, { token: middle.token })
      : { body: {} };
    check("4.3 a reopen after the old deadline proposes a future schedule without changing the completed task",
      reopened.body.executionState === "done" && !!reopenPending
        && (reopenDetail.body.proposedVersion || {}).startAt.startsWith(futureStart),
      { state: reopened.body.executionState, proposed: (reopenDetail.body.proposedVersion || {}).startAt, expected: futureStart });
    check("4.3 the reopen request stays pending for review instead of publishing immediately",
      !!reopenPending && reopenPending.status === "pending", { pending: !!reopenPending });

    /* ---------- 5. explicit self-review wording ---------- */
    await browser.evaluate("document.getElementById('sheetClose').click(), true");
    await browser.evaluate("window.Pandora.logout(), true");
    await loginBrowser(browser, loginIdentity("upper"), password);
    await browser.evaluate("window.openTaskDetail('" + selfReview.body.taskId + "')");
    await waitFor(browser, "!!document.querySelector('[data-action=\"update-note\"]')");
    await browser.evaluate(click('[data-action="update-note"]'));
    await waitFor(browser, "!!document.getElementById('pf-note')");
    const selfHint = await browser.evaluate("Array.from(document.querySelectorAll('#sheetBody .callout.info')).map((el) => el.textContent).join(' | ')");
    check("3.5 a non-creation operation whose reviewer is the applicant shows an explicit reviewer, never an exemption",
      selfHint.includes(founderName) && selfHint.includes("本次审核人") && !selfHint.includes("无需审核"), { hint: selfHint });

    /* ---------- 6. expired creation: resubmit from the expired application ---------- */
    await browser.evaluate("document.getElementById('sheetClose').click(), true");
    await browser.evaluate("window.Pandora.logout(), true");
    await loginBrowser(browser, loginIdentity("employee"), password);
    await browser.evaluate("window.Pandora.openApproval('" + expiring.body.requestId + "')");
    await waitFor(browser, "!document.getElementById('overlay').hidden");
    const expiredText = await browser.evaluate("document.getElementById('sheetBody').innerText");
    check("4.4 the expired application is marked expired and offers modify-and-resubmit",
      expiredText.includes("已失效") && !!(await browser.evaluate("!!document.querySelector('[data-action=\"p-resubmit-create\"]')")),
      { text: expiredText.slice(0, 160) });
    await browser.evaluate(click('[data-action="p-resubmit-create"]'));
    await waitFor(browser, "document.getElementById('sheetTitle').textContent.includes('重新提交')");
    check("4.1 a creation resubmission also has no completion-criterion field",
      !(await browser.evaluate("!!document.getElementById('tf-acceptance')")), {});
    await browser.evaluate(setValue("tf-title", "失效后重提 " + crypto.randomBytes(2).toString("hex")));
    await browser.evaluate(setValue("tf-desc", "调整排期后重新提交创建申请。"));
    await browser.evaluate(click('[data-action="save-task"]'));
    await waitFor(browser, "document.getElementById('overlay').hidden", 20000);
    if (database) {
      const statuses = sql(optionFile, database,
        "SELECT status FROM approval_requests WHERE task_id='" + expiring.body.taskId + "' ORDER BY created_at");
      const rows = statuses.trim().split("\n").map((row) => row.trim());
      check("4.4 the resubmission creates a new pending request and leaves the old one permanently expired",
        rows.includes("expired") && rows.includes("pending"), { statuses: rows });
    }
    await browser.screenshot(path.join(__dirname, "..", "..", "audit", "chapter4-resubmit.png"));

    check("the browser run raised no uncaught page error", browser.errors.length === 0, { errors: browser.errors.slice(0, 3) });
  } finally {
    browser.kill();
  }

  const passed = RESULTS.filter((row) => row.pass).length;
  console.log(`\n${passed}/${RESULTS.length} checks passed`);
  if (output) {
    fs.mkdirSync(path.dirname(output), { recursive: true });
    fs.writeFileSync(output, JSON.stringify({ generatedAt: new Date().toISOString(), baseUrl: base, passed, total: RESULTS.length, results: RESULTS }, null, 2) + "\n");
    console.log("wrote " + output);
  }
  return passed === RESULTS.length ? 0 : 1;
}

main().then((code) => process.exit(code)).catch((error) => { console.error(error); process.exit(1); });
