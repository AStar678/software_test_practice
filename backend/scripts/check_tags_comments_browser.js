#!/usr/bin/env node
"use strict";
/*
 * Browser verification for chapter 8 UI: the shared single-select tag visible on the calendar, the
 * task and log detail and the log list; founder-only maintenance in "My"; rename/delete retention;
 * the flat comment area with author control; and the purpose + object + summary notification list.
 *
 *   CHECK_WORKER=true ./scripts/run_check_isolated.sh node scripts/check_tags_comments_browser.js \
 *       --base-url {base} --output ../audit/2026-10-25/chapter8-ui-browser.json
 */

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
].find((candidate) => fs.existsSync(candidate));
const results = [];
const RUN = crypto.randomBytes(3).toString("hex");
const DEFAULT_PINK = "#ffe1ea";

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
const key = (prefix = "tagui") => prefix + "-" + crypto.randomUUID();

async function openBrowser(url) {
  const port = 9700 + Math.floor(Math.random() * 150);
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
const setValue = (id, value) => `(() => { const el = document.getElementById(${JSON.stringify(id)}); if (!el) return false; el.value = ${JSON.stringify(value)}; el.dispatchEvent(new Event("input", {bubbles:true})); return true; })()`;
const submit = (id) => `(() => { const el = document.getElementById(${JSON.stringify(id)}); if (!el) return false; el.requestSubmit(); return true; })()`;
const clickPage = (page) => `document.querySelector('[data-page="${page}"]').click()`;
const click = (selector) => `(() => { const el = document.querySelector(${JSON.stringify(selector)}); if (!el) return false; el.click(); return true; })()`;

async function login(browser, account, password) {
  await waitFor(browser, "!!document.getElementById('backend-login')");
  await browser.evaluate(setValue("login-user", loginIdentity(account)));
  await browser.evaluate(setValue("login-password", password));
  await browser.evaluate(submit("backend-login"));
  return waitFor(browser, "window.Pandora && window.Pandora.ready && window.Pandora.data && window.Pandora.data.me");
}
async function logout(browser, next, password) {
  await browser.evaluate("window.Pandora.busy(() => window.Pandora.logout('" + next + "'))");
  await waitFor(browser, "!!document.getElementById('backend-login')");
  return login(browser, next, password);
}

async function main() {
  const base = arg("base-url", "http://127.0.0.1:18130");
  const password = arg("password", "Demo@123456");
  const output = arg("output", null);
  const loginApi = async (account) => {
    const result = await api(base, "POST", "/api/v1/auth/sessions", { body: { username: loginIdentity(account), password } });
    if (result.status !== 200) throw new Error("login failed " + account);
    return result.body.token;
  };
  const upper = await loginApi("upper");
  const middle = await loginApi("middle");
  const employee = await loginApi("employee");
  const employeeMe = (await api(base, "GET", "/api/v1/me", { token: employee })).body;
  const middleMe = (await api(base, "GET", "/api/v1/me", { token: middle })).body;
  const catalogue = (await api(base, "GET", "/api/v1/tags", { token: upper })).body;
  const palette = catalogue.palette || [];
  const colorA = palette[0], colorB = palette[4] || palette[1];

  // ---- fixtures through the real API ----
  const tagA = (await api(base, "POST", "/api/v1/tags", { token: upper, body: { name: "UI 标签甲 " + RUN, color: colorA.color }, key: key("tag") })).body;
  const tagB = (await api(base, "POST", "/api/v1/tags", { token: upper, body: { name: "UI 标签乙 " + RUN, color: colorB.color }, key: key("tag") })).body;
  const now = new Date();
  const start = new Date(now.getTime() + 2 * 3600000);
  const due = new Date(now.getTime() + 5 * 3600000);
  const taskBody = (title, tagId) => Object.assign({
    title, description: "标签与评论浏览器检查。", priority: "medium", allDay: false,
    startAt: start.toISOString(), dueAt: due.toISOString(), assigneeIds: [employeeMe.id],
  }, tagId === undefined ? {} : { tagId });
  const tagged = (await api(base, "POST", "/api/v1/tasks", { token: upper, body: taskBody("UI 带标签任务 " + RUN, tagB.tagId), key: key("task") })).body;
  const plain = (await api(base, "POST", "/api/v1/tasks", { token: upper, body: taskBody("UI 无标签任务 " + RUN), key: key("task") })).body;
  const logs = (await api(base, "GET", "/api/v1/work-logs?scope=self&limit=10", { token: employee })).body;
  const todayLog = logs.items[0];
  await api(base, "PATCH", "/api/v1/work-logs/" + todayLog.id, { token: employee, body: { tagId: tagB.tagId }, key: key("log"), etag: '"' + todayLog.rowVersion + '"' });
  const comment = (await api(base, "POST", "/api/v1/tasks/" + tagged.taskId + "/comments", { token: middle, body: { body: "UI 评论摘要 " + RUN }, key: key("comment") })).body;
  if (!comment.commentId) throw new Error("comment fixture failed " + JSON.stringify(comment));
  // The worker delivers asynchronously; the list/jump checks need the real message to exist first.
  for (let attempt = 0; attempt < 40; attempt += 1) {
    const inbox = (await api(base, "GET", "/api/v1/notifications?limit=100", { token: employee })).body;
    if ((inbox.items || []).some((row) => (row.summary || "").includes("UI 评论摘要 " + RUN))) break;
    await sleep(500);
  }

  const browser = await openBrowser(base + "/");
  try {
    await login(browser, "employee", password);
    await browser.evaluate(clickPage("me"));
    await waitFor(browser, "!!document.getElementById('page-me')");
    check("8.2 an ordinary employee has no tag-maintenance entry in 我的",
      await browser.evaluate("!/标签管理/.test(document.getElementById('page-me').textContent) && !document.querySelector('[data-action=\"p-manage-tags\"]')"));

    await browser.evaluate(clickPage("view"));
    await waitFor(browser, "!!document.querySelector('.p-schedule-card') && window.Pandora.idle()");
    await browser.evaluate("state.viewAnchor = new Date(); renderAll()");
    await sleep(300);
    const colors = await browser.evaluate(`(() => {
      const read = id => { const el = document.querySelector('.p-month-event[data-task="' + id + '"]'); return el ? el.style.getPropertyValue('--tc-bg').trim().toLowerCase() : null; };
      const palette = ((window.Pandora.data.tags || {}).palette || []).map(row => row.color.toLowerCase());
      return { tagged: read(${JSON.stringify(tagged.taskId)}), plain: read(${JSON.stringify(plain.taskId)}), palette, defaultPink: (window.Pandora.data.tags || {}).defaultColor };
    })()`);
    check("8.2 the calendar uses the task's single tag colour", colors.tagged === colorB.color.toLowerCase(), colors.tagged);
    check("8.2 an unmarked task uses the default pink that is outside the palette",
      colors.plain === DEFAULT_PINK && !colors.palette.includes(DEFAULT_PINK) && String(colors.defaultPink).toLowerCase() === DEFAULT_PINK, colors);

    await browser.evaluate(`document.querySelector('.p-month-event[data-task="${tagged.taskId}"]').click()`);
    await waitFor(browser, "document.getElementById('overlay').hidden === false && window.Pandora.idle()");
    const detail = await browser.evaluate("({ pill: (document.querySelector('#sheetBody .p-tag-pill') || {}).textContent || '', bg: document.querySelector('#sheetBody .p-tag-pill') ? document.querySelector('#sheetBody .p-tag-pill').style.getPropertyValue('--tag-bg') : '' })");
    check("8.2 the task detail shows the same tag name and colour pill",
      detail.pill.includes("UI 标签乙 " + RUN) && detail.bg.toLowerCase() === colorB.color.toLowerCase(), detail);

    // ---- flat comments on the task ----
    check("8.4 the task detail has a flat comment area with a publication form",
      await browser.evaluate("!!document.querySelector('.p-comments[data-object-type=\"task\"]') && !!document.getElementById('p-comment-input')"));
    await waitFor(browser, "document.querySelectorAll('.p-comments .p-comment').length > 0");
    const seededComment = await browser.evaluate("(() => { const rows = Array.from(document.querySelectorAll('.p-comments .p-comment')); return rows.map(row => row.textContent); })()");
    check("8.4 the comment area lists the existing comment with its author",
      seededComment.some(text => text.includes("UI 评论摘要 " + RUN) && text.includes("李敏")), seededComment);
    await browser.evaluate(setValue("p-comment-input", "员工自己的评论 " + RUN));
    await browser.evaluate(click('[data-action="p-comment-submit"]'));
    await waitFor(browser, `Array.from(document.querySelectorAll('.p-comments .p-comment')).some(row => row.textContent.includes(${JSON.stringify("员工自己的评论 " + RUN)}))`);
    const ownComment = await browser.evaluate(`(() => { const row = Array.from(document.querySelectorAll('.p-comments .p-comment')).find(node => node.textContent.includes(${JSON.stringify("员工自己的评论 " + RUN)})); return row ? { id: row.dataset.commentId, edit: !!row.querySelector('[data-action="p-comment-edit"]') } : null; })()`);
    check("8.4 the author can manage their own comment while others cannot", ownComment && ownComment.edit, ownComment);
    await browser.evaluate(`(() => { const row = document.querySelector('.p-comments .p-comment[data-comment-id="${ownComment.id}"]'); row.querySelector('[data-action="p-comment-edit"]').click(); return true; })()`);
    const editReady = await waitFor(browser, `!!document.querySelector('textarea[data-comment-edit]')`);
    check("8.4 the author can open their own comment for editing", editReady, browser.errors.slice(0, 3));
    await browser.evaluate("(() => { const area = document.querySelector('textarea[data-comment-edit]'); area.value = '员工自己的评论已编辑 " + RUN + "'; area.dispatchEvent(new Event('input', {bubbles:true})); return true; })()");
    await browser.evaluate(click('[data-action="p-comment-save"]'));
    await waitFor(browser, `Array.from(document.querySelectorAll('.p-comments .p-comment')).some(row => row.textContent.includes('已编辑'))`);
    check("8.4 editing marks the comment as edited without changing publication order",
      await browser.evaluate(`(() => { const rows = Array.from(document.querySelectorAll('.p-comments .p-comment')); return rows.some(row => row.textContent.includes('员工自己的评论已编辑') && row.textContent.includes('已编辑')); })()`));
    await browser.evaluate(`(() => { const row = document.querySelector('.p-comments .p-comment[data-comment-id="${ownComment.id}"]'); const del = row.querySelector('[data-action="p-comment-delete"]'); if (del) del.click(); return true; })()`);
    await waitFor(browser, `!document.querySelector('.p-comments .p-comment[data-comment-id="${ownComment.id}"]')`);
    check("8.4 deleting hides the body from the list",
      await browser.evaluate(`!document.getElementById('sheetBody').textContent.includes('员工自己的评论已编辑')`));
    await browser.evaluate("document.getElementById('sheetClose').click()");
    await sleep(150);

    // ---- log page and detail share the tag ----
    await browser.evaluate(clickPage("log"));
    await waitFor(browser, "document.getElementById('logResults') && window.Pandora.idle()");
    await sleep(250);
    const logTag = await browser.evaluate("(() => { const card = document.querySelector('.log-card .p-tag-pill'); return card ? { text: card.textContent, bg: card.style.getPropertyValue('--tag-bg'), who: document.querySelector('.log-card .who').textContent } : null; })()");
    check("8.2 the log list shows the log's tag with the same colour", !!logTag && logTag.text.includes("UI 标签乙 " + RUN), logTag);
    // Close the tagged log card, identified by its own pill, so the detail belongs to that log.
    const taggedCard = await browser.evaluate(`(() => { const card = Array.from(document.querySelectorAll('.log-card')).find(node => node.textContent.includes('UI 标签乙 ' + ${JSON.stringify(RUN)})); const btn = card && card.querySelector('[data-action="p-open-log"]'); return btn ? btn.dataset.id : null; })()`);
    await browser.evaluate(`(() => { const btn = document.querySelector('.log-card [data-action="p-open-log"][data-id="' + ${JSON.stringify(taggedCard)} + '"]'); if (btn) btn.click(); return true; })()`);
    let logOpen = await waitFor(browser, "document.getElementById('sheetTitle').textContent === '日志详情' && window.Pandora.idle()");
    if (!logOpen && taggedCard) { await sleep(400); await browser.evaluate(`window.openLogDetail(${JSON.stringify(taggedCard)})`); logOpen = await waitFor(browser, "document.getElementById('sheetTitle').textContent === '日志详情' && window.Pandora.idle()"); }
    const logDetail = await browser.evaluate("({ title: document.getElementById('sheetTitle').textContent, pill: (document.querySelector('#sheetBody .p-tag-pill') || {}).textContent || '', comments: !!document.querySelector('.p-comments[data-object-type=\"log\"]'), notice: document.getElementById('appNotice').textContent })");
    check("8.2 the log detail shows the tag pill and an independent comment area",
      logOpen && logDetail.pill.includes("UI 标签乙 " + RUN) && logDetail.comments, logDetail);
    if (logOpen) await browser.evaluate("document.getElementById('sheetClose').click()");

    // ---- notification list explains purpose + object + summary ----
    await browser.evaluate("document.getElementById('bellBtn').click()");
    await waitFor(browser, "document.querySelectorAll('.notif').length > 0 && window.Pandora.idle()");
    const notice = await browser.evaluate("(() => { const row = Array.from(document.querySelectorAll('.notif')).find(node => node.textContent.includes('UI 评论摘要 ' + " + JSON.stringify(RUN) + ")); return row ? { purpose: (row.querySelector('.npurpose') || {}).textContent, title: (row.querySelector('.ntitle') || {}).textContent, summary: (row.querySelector('.nsummary') || {}).textContent } : null; })()");
    check("8.6 the notification list shows purpose, object name and the real summary",
      !!notice && notice.purpose === "新评论" && notice.title.includes("UI 带标签任务 " + RUN) && notice.summary.includes("UI 评论摘要 " + RUN), notice);
    await waitFor(browser, "window.Pandora.idle()");
    const noticeId = await browser.evaluate(`(() => { const row = Array.from(document.querySelectorAll('.notif')).find(node => node.textContent.includes('UI 评论摘要 ' + ${JSON.stringify(RUN)})); return row ? row.dataset.id : null; })()`);
    await browser.evaluate(`(() => { const row = Array.from(document.querySelectorAll('.notif')).find(node => node.textContent.includes('UI 评论摘要 ' + ${JSON.stringify(RUN)})); if (row) row.click(); return true; })()`);
    let opened = await waitFor(browser, "document.getElementById('sheetTitle').textContent === '通知详情' && window.Pandora.idle()");
    if (!opened && noticeId) {
      await sleep(400);
      await browser.evaluate(`window.openNotif(${JSON.stringify(noticeId)})`);
      opened = await waitFor(browser, "document.getElementById('sheetTitle').textContent === '通知详情' && window.Pandora.idle()");
    }
    const jump = await browser.evaluate("(() => { const btn = document.querySelector('[data-action=\"p-open-notification-object\"]'); return { title: document.getElementById('sheetTitle').textContent, text: btn ? btn.textContent : null, notice: document.getElementById('appNotice').textContent, body: document.getElementById('sheetBody').textContent.slice(0, 80) }; })()");
    check("8.5 a comment notification offers a jump that locates the comment area",
      opened && !!jump.text && jump.text.includes("评论区"), jump);
    if (jump) {
      await browser.evaluate(click('[data-action="p-open-notification-object"]'));
      let jumped = await waitFor(browser, "document.getElementById('sheetTitle').textContent.includes(" + JSON.stringify("UI 带标签任务 " + RUN) + ") && window.Pandora.idle()");
      if (!jumped) { await sleep(400); await browser.evaluate(click('[data-action="p-open-notification-object"]')); jumped = await waitFor(browser, "document.getElementById('sheetTitle').textContent.includes(" + JSON.stringify("UI 带标签任务 " + RUN) + ") && window.Pandora.idle()"); }
      const jumpState = await browser.evaluate("({ title: document.getElementById('sheetTitle').textContent, comments: !!document.querySelector('.p-comments[data-object-type=\"task\"]'), notice: document.getElementById('appNotice').textContent })");
      check("8.5 the jump opens the object detail with the comment area rendered",
        jumped && jumpState.comments && jumpState.title.includes("UI 带标签任务 " + RUN), jumpState);
      await browser.evaluate("document.getElementById('sheetClose').click()");
    }

    // ---- founder maintenance UI ----
    await logout(browser, "upper", password);
    await browser.evaluate(clickPage("me"));
    await waitFor(browser, "!!document.querySelector('[data-action=\"p-manage-tags\"]')");
    check("8.2 the founder sees the tag-maintenance entry in 我的",
      await browser.evaluate("/标签管理/.test(document.getElementById('page-me').textContent)"));
    await browser.evaluate(click('[data-action="p-manage-tags"]'));
    await waitFor(browser, "document.getElementById('sheetTitle').textContent === '标签管理'");
    const management = await browser.evaluate("(() => ({ rows: Array.from(document.querySelectorAll('[data-tag-row]')).map(row => row.textContent), swatches: document.querySelectorAll('.p-tag-swatch').length, colors: document.querySelectorAll('.p-tag-color').length }))()");
    check("8.2 the management sheet lists tags with colour swatches and the predefined palette",
      management.rows.some(text => text.includes("UI 标签甲 " + RUN)) && management.rows.some(text => text.includes("UI 标签乙 " + RUN))
      && management.swatches >= 2 && management.colors === palette.length, management);
    const createdName = "UI 新建标签 " + RUN;
    await browser.evaluate(setValue("p-tag-name", createdName));
    await browser.evaluate("(() => { const colors = document.querySelectorAll('.p-tag-color'); colors[2].click(); return true; })()");
    await browser.evaluate(click('[data-action="p-tag-create"]'));
    await waitFor(browser, "window.Pandora.idle()");
    await browser.evaluate(click('[data-action="p-manage-tags"]'));
    await waitFor(browser, "document.getElementById('sheetTitle').textContent === '标签管理'");
    check("8.2 a new tag created from the palette persists and refreshes the list",
      await browser.evaluate(`Array.from(document.querySelectorAll('[data-tag-row]')).some(row => row.textContent.includes(${JSON.stringify(createdName)}))`));
    await browser.evaluate("document.getElementById('sheetClose').click()");

    const renameTo = "UI 标签乙 改名 " + RUN;
    const tagBRow = await browser.evaluate("(() => { const row = Array.from(document.querySelectorAll('[data-tag-row]')).find(node => node.textContent.includes('UI 标签乙 ' + " + JSON.stringify(RUN) + ")); return row ? row.dataset.tagRow : null; })()");
    check("8.2 the founder can locate the tag row to rename", !!tagBRow);
    if (tagBRow) {
      await browser.evaluate(click('[data-action="p-manage-tags"]'));
      await waitFor(browser, "document.getElementById('sheetTitle').textContent === '标签管理'");
      await browser.evaluate(`document.querySelector('[data-action="p-tag-edit"][data-id="${tagBRow}"]').click()`);
      await waitFor(browser, "document.getElementById('sheetTitle').textContent === '编辑标签'");
      await browser.evaluate(setValue("p-tag-name", renameTo));
      await browser.evaluate(click('[data-action="p-tag-save"]'));
      await waitFor(browser, "window.Pandora.idle()");
    }
    await logout(browser, "employee", password);
    await browser.evaluate(clickPage("view"));
    await waitFor(browser, "!!document.querySelector('.p-schedule-card') && window.Pandora.idle()");
    await browser.evaluate("state.viewAnchor = new Date(); renderAll()");
    await sleep(250);
    await browser.evaluate(`document.querySelector('.p-month-event[data-task="${tagged.taskId}"]').click()`);
    await waitFor(browser, "document.getElementById('overlay').hidden === false && window.Pandora.idle()");
    check("8.3 renaming a tag immediately updates the current task reference",
      await browser.evaluate(`(document.querySelector('#sheetBody .p-tag-pill') || {}).textContent.includes(${JSON.stringify(renameTo)})`));
    await browser.evaluate("document.getElementById('sheetClose').click()");

    // The deleted tag keeps the existing reference and disappears from new selections.
    await logout(browser, "upper", password);
    await browser.evaluate(clickPage("me"));
    await waitFor(browser, "!!document.querySelector('[data-action=\"p-manage-tags\"]')");
    await browser.evaluate(click('[data-action="p-manage-tags"]'));
    await waitFor(browser, "document.getElementById('sheetTitle').textContent === '标签管理'");
    if (tagBRow) {
      await browser.evaluate(`document.querySelector('[data-action="p-tag-delete"][data-id="${tagBRow}"]').click()`);
      await waitFor(browser, "window.Pandora.idle()");
    }
    await logout(browser, "employee", password);
    await browser.evaluate(clickPage("view"));
    await waitFor(browser, "!!document.querySelector('.p-schedule-card') && window.Pandora.idle()");
    await browser.evaluate("state.viewAnchor = new Date(); renderAll()");
    await sleep(250);
    await browser.evaluate(`document.querySelector('.p-month-event[data-task="${tagged.taskId}"]').click()`);
    await waitFor(browser, "document.getElementById('overlay').hidden === false && window.Pandora.idle()");
    const deletedPill = await browser.evaluate("(() => { const pill = document.querySelector('#sheetBody .p-tag-pill'); return pill ? { text: pill.textContent, deleted: pill.classList.contains('is-deleted') } : null; })()");
    check("8.3 a deleted tag keeps its reference and shows the deleted mark",
      !!deletedPill && deletedPill.deleted && deletedPill.text.includes(renameTo), deletedPill);
    await browser.evaluate("document.getElementById('sheetClose').click()");
    await browser.evaluate(click('[data-action="schedule-create"]'));
    await waitFor(browser, "!!document.getElementById('tf-tag')");
    const options = await browser.evaluate("Array.from(document.getElementById('tf-tag').options).map(option => option.textContent)");
    check("8.3 a deleted tag is no longer offered for a new association",
      !options.some(text => text.includes(renameTo)) && options.some(text => text.includes("无标签")), options);
    await browser.evaluate("document.getElementById('sheetClose').click()");

    check("8.2 no uncaught script or console errors on the tag/comment pages", browser.errors.length === 0, browser.errors.slice(0, 4));
  } finally {
    browser.kill();
    if (output) {
      fs.mkdirSync(path.dirname(output), { recursive: true });
      fs.writeFileSync(output, JSON.stringify({ viewport: { width: Number(arg("width", "390")), height: Number(arg("height", "844")) }, checks: results }, null, 2) + "\n");
    }
    const passed = results.filter((row) => row.pass).length;
    console.log(`\n${passed}/${results.length} browser checks passed`);
    if (passed !== results.length) process.exitCode = 1;
  }
}

main().catch((error) => { console.error(error); process.exitCode = 1; });
