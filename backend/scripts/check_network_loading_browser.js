#!/usr/bin/env node
"use strict";
// All HTTP traffic is fulfilled from this checkout or an in-memory fixture. No database is used.
// Run with an installed Playwright, or set PLAYWRIGHT_MODULE to its absolute package path.
const fs = require("node:fs"), path = require("node:path"), assert = require("node:assert/strict");
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || "playwright");
const root = path.resolve(__dirname, "../.."), origin = "http://127.0.0.1:18889";
const output = path.resolve(process.env.PANDORA_BROWSER_OUTPUT || path.join(root, "backend/.runtime/network-loading-check"));
const checks = [], errors = [], requests = [], holds = new Map();
const me = { id: "loading-fixture-user", displayName: "模拟员工", role: "employee", placementType: "employee", organizationTimeZone: "Asia/Shanghai" };
const fixture = {
  "/auth/sessions": { token: "isolated-browser-fixture", passwordChangeRequired: false },
  "/me": me, "/me/profile": { ...me, rowVersion: 1 }, "/users": { items: [me] }, "/tasks": { items: [] },
  "/work-logs": { items: [] }, "/work-log-authors": { items: [me], departments: [], teams: [] },
  "/me/reports": { items: [] }, "/approval-requests": { items: [] }, "/notifications": { items: [] },
  "/home": { companyItems: [], personalItems: [], assignedTasks: [], recentLogs: [], businessDate: "2026-10-30", timeZone: "Asia/Shanghai" },
  "/analytics/task-summary": {}, "/tags": { items: [], palette: [] }
};
function hold(endpoint) {
  let release, arrived;
  const gate = new Promise(resolve => { release = resolve; });
  const seen = new Promise(resolve => { arrived = resolve; });
  const item = { gate, arrived };
  if (!holds.has(endpoint)) holds.set(endpoint, []);
  holds.get(endpoint).push(item);
  return { get seen() {
    let timer;
    return Promise.race([seen, new Promise((_, reject) => { timer = setTimeout(() => reject(new Error("Expected request was not made: " + endpoint)), 10000); })]).finally(() => clearTimeout(timer));
  }, release: (body = {}, status = 200) => release({ body, status }) };
}
async function check(name, condition, evidence) {
  const pass = !!(await condition);
  checks.push({ name, pass, evidence });
  console.log((pass ? "PASS " : "FAIL ") + name);
  assert.ok(pass, name + (evidence ? ": " + JSON.stringify(evidence) : ""));
}
async function main() {
  fs.mkdirSync(output, { recursive: true });
  const launch = { headless: true };
  if (process.env.CHROME_BIN) launch.executablePath = process.env.CHROME_BIN;
  const browser = await chromium.launch(launch);
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, timezoneId: "Asia/Shanghai", serviceWorkers: "block" });
  const page = await context.newPage();
  page.on("pageerror", error => errors.push(error.message));
  await context.route("**/*", async route => {
    const url = new URL(route.request().url());
    assert.equal(url.origin, origin, "No real service may be contacted by this test");
    const name = decodeURIComponent(url.pathname);
    if (name.startsWith("/api/v1/")) {
      const endpoint = name.slice("/api/v1".length);
      requests.push({ endpoint, method: route.request().method() });
      const queued = holds.get(endpoint)?.shift();
      if (queued) queued.arrived();
      const result = queued ? await queued.gate : { body: fixture[endpoint] || {}, status: 200 };
      // A deliberately aborted request may no longer have a live route.
      await route.fulfill({ status: result.status, contentType: "application/json", body: JSON.stringify(result.body) }).catch(() => {});
      return;
    }
    const file = name === "/" ? "潘多拉-交互原型.html" : name.slice(1);
    assert.ok(!file.includes("/") && /\.(html|css|js|svg)$/.test(file), "Fixture asset whitelist: " + file);
    await route.fulfill({ path: path.join(root, file) });
  });
  const status = () => page.evaluate(() => {
    const n = document.getElementById("networkStatus");
    return { visible: !n.hidden, text: n.textContent, count: Number(n.dataset.pending || 0), idle: Pandora.idle() };
  });
  const idle = () => page.waitForFunction(() => Pandora.idle() && document.getElementById("networkStatus").hidden);
  try {
    await page.goto(origin + "/");
    await page.locator("#backend-login").waitFor();
    await check("No artificial network loading on the idle login screen", (await status()).idle);
    await page.locator("#login-user").fill("13800000001");
    await page.locator("#login-password").fill("BrowserFixture123");
    const login = page.locator("#backend-login button[type=submit]");
    const before = await login.boundingBox(), rejectedLogin = hold("/auth/sessions");
    await login.click(); await rejectedLogin.seen;
    await check("Login immediately shows a visible status and a disabled spinning button", await page.evaluate(() => {
      const b = document.querySelector("#backend-login button[type=submit]");
      return b.getAttribute("aria-disabled") === "true" && b.classList.contains("is-network-busy") && b.getAttribute("aria-busy") === "true" && !networkStatus.hidden && networkStatus.textContent.includes("正在登录");
    }));
    await check("Busy state keeps the initiating button focused", await login.evaluate(button => document.activeElement === button));
    const during = await login.boundingBox();
    await check("Button dimensions stay unchanged while loading", before.width === during.width && before.height === during.height, { before, during });
    await page.evaluate(() => { document.getElementById("backend-login").requestSubmit(); document.querySelector("#backend-login button").click(); });
    await check("Repeated submit and click do not create a second login request", requests.filter(r => r.endpoint === "/auth/sessions").length === 1);
    await page.screenshot({ path: path.join(output, "desktop-login-loading.png") });
    await page.setViewportSize({ width: 390, height: 844 });
    await login.scrollIntoViewIfNeeded();
    await page.screenshot({ path: path.join(output, "mobile-login-loading.png") });
    await check("Mobile loading status fits the viewport without horizontal overflow", await page.evaluate(() => {
      const r = networkStatus.getBoundingClientRect();
      return r.left >= 0 && r.right <= innerWidth && document.documentElement.scrollWidth <= innerWidth;
    }));
    rejectedLogin.release({ message: "账号或密码不正确", code: "INVALID_CREDENTIALS" }, 401);
    await idle();
    await check("Failed login restores the button and retains the actual error", await page.evaluate(() => {
      const b = document.querySelector("#backend-login button[type=submit]");
      return !b.disabled && !b.hasAttribute("aria-disabled") && !b.classList.contains("is-network-busy") && !b.hasAttribute("aria-busy") && !document.getElementById("login-error").hidden && document.getElementById("login-error").textContent.includes("账号或密码不正确");
    }));
    await page.screenshot({ path: path.join(output, "mobile-login-error.png") });

    const successfulLogin = hold("/auth/sessions"), workspace = hold("/me");
    await login.click(); await successfulLogin.seen;
    successfulLogin.release(fixture["/auth/sessions"]); await workspace.seen;
    await check("Login button stays busy through the following workspace reload", await login.isDisabled() && (await login.getAttribute("class")).includes("is-network-busy") && (await status()).visible);
    workspace.release(me); await page.waitForFunction(() => Pandora.ready && Pandora.idle());
    await check("Successful login and all workspace requests clear loading", !(await status()).visible);

    await page.locator('#tabbar [data-page="me"]').click();
    await page.locator('[data-action="p-open-settings"]').click();
    await check("Opening a local settings dialog does not start network loading", !(await status()).visible);
    const refresh = hold("/me");
    await page.locator('[data-action="p-refresh-workspace"]').click(); await refresh.seen;
    await check("Workspace refresh button responds before the server responds", await page.locator('[data-action="p-refresh-workspace"]').isDisabled() && (await status()).text.includes("正在加载工作台"));
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.screenshot({ path: path.join(output, "desktop-workspace-loading.png") });
    refresh.release(me); await idle();

    await page.locator('[data-action="p-edit-profile"]').click(); await idle();
    await page.locator("#profile-email").fill("fixture@example.invalid");
    const save = hold("/me/profile");
    await page.locator('[data-action="p-save-profile"]').click(); await save.seen;
    await check("Saving a real form instantly disables the submit button and shows saving", await page.locator('[data-action="p-save-profile"]').isDisabled() && (await status()).text.includes("正在保存"));
    await page.setViewportSize({ width: 390, height: 844 });
    await page.screenshot({ path: path.join(output, "mobile-form-saving.png") });
    save.release({ message: "模拟保存失败，请重试。" }, 503); await idle();
    await check("Save failure retains the draft and restores an actionable button", await page.locator("#profile-email").inputValue() === "fixture@example.invalid" && !(await page.locator('[data-action="p-save-profile"]').isDisabled()) && (await page.locator("#profile-error").textContent()).includes("模拟保存失败"));
    const saved = hold("/me/profile"), reloadAfterSave = hold("/me");
    await page.locator('[data-action="p-save-profile"]').click(); await saved.seen;
    saved.release(me); await reloadAfterSave.seen;
    await check("Save button stays busy until the following reload completes", await page.locator('[data-action="p-save-profile"]').isDisabled() && (await status()).visible);
    reloadAfterSave.release(me); await idle();
    await check("Successful retry closes the form and restores the interface", await page.locator("#overlay").isHidden());

    await page.evaluate(() => {
      const button = document.createElement("button"); button.type = "button"; button.id = "fixture-detail";
      button.innerHTML = "<span>加载详情测试</span>";
      button.addEventListener("click", () => Pandora.busy(async () => {
        await Pandora.request("/probe-detail");
        openSheet({ title: "异步详情", body: "<p>测试详情内容</p>", foot: '<button type="button" data-action="sheet-close">关闭</button>' });
      }));
      document.getElementById("page-me").append(button);
    });
    const detail = hold("/probe-detail");
    await page.locator("#fixture-detail").click(); await detail.seen;
    await check("Async detail preserves its opener focus while waiting", await page.locator("#fixture-detail").evaluate(button => document.activeElement === button));
    await check("A busy button with child markup retains its accessible name", await page.getByRole("button", { name: "加载详情测试", exact: true }).count() === 1);
    detail.release(); await idle(); await page.keyboard.press("Escape");
    await check("Closing async detail restores focus to its original trigger", await page.locator("#fixture-detail").evaluate(button => document.activeElement === button));

    await page.evaluate(() => {
      const button = document.createElement("button"); button.type = "button"; button.id = "fixture-direct"; button.textContent = "读取测试";
      window.directClicks = 0;
      button.addEventListener("click", async () => { directClicks++; await Pandora.request("/probe-direct"); });
      document.getElementById("page-me").append(button);
    });
    const direct = hold("/probe-direct");
    await page.locator("#fixture-direct").click(); await direct.seen;
    await page.locator("#fixture-direct").evaluate(button => { button.click(); button.click(); });
    await check("Direct requests also suppress duplicate clicks without a busy command", await page.evaluate(() => directClicks) === 1);
    direct.release(); await idle();

    const first = hold("/probe-first"), second = hold("/probe-second");
    await page.evaluate(() => { window.firstRead = Pandora.request("/probe-first"); window.secondRead = Pandora.request("/probe-second"); });
    await Promise.all([first.seen, second.seen]);
    await check("Concurrent requests are tracked independently", (await status()).count === 2);
    first.release({ ok: true }); await page.evaluate(() => window.firstRead);
    await check("Finishing one concurrent request keeps the other loading", (await status()).visible && (await status()).count === 1);
    second.release({ ok: true }); await page.evaluate(() => window.secondRead); await idle();

    const cancelled = hold("/probe-cancel");
    await page.evaluate(() => {
      window.cancelRead = new AbortController();
      window.cancelResult = Pandora.request("/probe-cancel", { signal: cancelRead.signal }).catch(error => error.name);
    });
    await cancelled.seen; await page.evaluate(() => cancelRead.abort());
    await check("Caller cancellation propagates and releases loading", await page.evaluate(() => cancelResult) === "AbortError");
    await idle(); cancelled.release();

    // The response headers can arrive before the JSON body; feedback must cover both phases.
    await page.evaluate(() => {
      window.nativeFetch = window.fetch;
      window.fetch = (url, options) => String(url).endsWith("/probe-body") ? Promise.resolve(new Response(new ReadableStream({
        start(controller) {
          window.bodyStream = controller;
          options.signal.addEventListener("abort", () => controller.error(new DOMException("Aborted", "AbortError")), { once: true });
        }
      }), { headers: { "Content-Type": "application/json" } })) : nativeFetch(url, options);
      window.bodyRead = Pandora.request("/probe-body");
    });
    await check("Response-body download remains visibly loading after headers arrive", (await status()).visible && !(await status()).idle);
    await page.evaluate(() => { bodyStream.enqueue(new TextEncoder().encode('{"ok":true}')); bodyStream.close(); });
    await check("Completed response body releases loading", (await page.evaluate(() => bodyRead)).ok);
    await idle(); await page.evaluate(() => { window.fetch = nativeFetch; });

    const oldSession = hold("/probe-old-session"), newSession = hold("/probe-new-session");
    await page.evaluate(() => { window.oldRead = Pandora.request("/probe-old-session").catch(error => error.name); });
    await oldSession.seen;
    await page.evaluate(() => { Pandora.reLogin("测试切换账号"); window.newRead = Pandora.request("/probe-new-session"); });
    await newSession.seen;
    await check("Session reset cancels outstanding old requests", await page.evaluate(() => oldRead) === "AbortError");
    oldSession.release({ obsolete: true });
    await check("A cancelled old session cannot clear the next session's indicator", (await status()).visible && (await status()).count === 1);
    newSession.release({ ok: true }); await page.evaluate(() => newRead); await idle();

    await page.clock.install();
    const slow = hold("/probe-save");
    await page.evaluate(() => { window.slowResult = Pandora.request("/probe-save", { method: "POST", body: { test: true } }).catch(error => error.message); });
    await slow.seen;
    await check("Write requests show saving feedback", (await status()).text.includes("正在保存"));
    await page.clock.fastForward(8100);
    await check("Slow writes explicitly ask the user to wait instead of submit again", (await status()).text.includes("请勿重复提交"));
    await page.setViewportSize({ width: 390, height: 844 });
    await page.screenshot({ path: path.join(output, "mobile-slow-save.png") });
    await page.clock.fastForward(12000);
    await check("Network timeout clears the spinner and returns a useful error", (await page.evaluate(() => slowResult)).includes("请求超时"));
    await idle(); slow.release();

    await page.evaluate(() => { window.localCommand = Pandora.busy(async () => {}); });
    await page.evaluate(() => localCommand);
    await check("A local-only command does not display network loading", !(await status()).visible && (await status()).idle);
    await check("No uncaught browser errors", errors.length === 0, errors);
    console.log("Screenshots: " + output);
  } finally {
    fs.writeFileSync(path.join(output, "report.json"), JSON.stringify({ updated: new Date().toISOString(), checks, errors, requests, mockedOnly: true }, null, 2));
    await browser.close();
  }
}
main().catch(error => { console.error(error.stack); process.exitCode = 1; });
