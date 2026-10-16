#!/usr/bin/env node
"use strict";
/*
 * Real-browser verification of the account flows (task 3.4).
 *
 * Spawns headless Chrome, drives the actual served prototype page and asserts the visible outcome of:
 * login, the forced first-login change, everyday change from 我的, and the administrator reset entry.
 * Uses Node 24's built-in WebSocket, so nothing needs to be installed.
 *
 *   node scripts/check_account_browser.js --base-url http://127.0.0.1:18092
 */
const { spawn } = require("child_process");
const crypto = require("crypto");
const fs = require("fs");
const path = require("path");

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

async function api(base, method, route, { token, body, key } = {}) {
  const headers = { "Content-Type": "application/json" };
  if (token) headers.Authorization = "Bearer " + token;
  if (key) headers["Idempotency-Key"] = key;
  const response = await fetch(base + route, {
    method, headers, body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await response.text();
  return { status: response.status, body: text ? JSON.parse(text) : {} };
}

async function openBrowser(url) {
  const port = 9500 + Math.floor(Math.random() * 300);
  const proc = spawn(CHROME, [
    "--headless", "--no-sandbox", "--disable-gpu", "--no-first-run",
    "--no-default-browser-check", "--disable-crash-reporter", "--hide-scrollbars",
    "--force-device-scale-factor=1",
    "--remote-debugging-port=" + port,
    "--user-data-dir=/tmp/cdp-" + crypto.randomBytes(4).toString("hex"),
    url,
  ], { stdio: "ignore" });

  let target = null;
  for (let i = 0; i < 80 && !target; i++) {
    try {
      const list = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json();
      target = list.find((t) => t.type === "page" && String(t.url).startsWith("http"));
    } catch {}
    if (!target) await new Promise((r) => setTimeout(r, 250));
  }
  if (!target) { proc.kill("SIGKILL"); throw new Error("no page target appeared"); }

  const ws = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => {
    ws.addEventListener("open", resolve);
    ws.addEventListener("error", () => reject(new Error("cdp websocket failed")));
  });
  let seq = 0;
  const pending = new Map();
  ws.addEventListener("message", (event) => {
    const message = JSON.parse(event.data);
    if (message.id && pending.has(message.id)) {
      const { resolve, reject } = pending.get(message.id);
      pending.delete(message.id);
      message.error ? reject(new Error(JSON.stringify(message.error))) : resolve(message.result);
    }
  });
  const send = (method, params) => new Promise((resolve, reject) => {
    const id = ++seq;
    pending.set(id, { resolve, reject });
    ws.send(JSON.stringify({ id, method, params: params || {} }));
    setTimeout(() => { if (pending.delete(id)) reject(new Error("timeout: " + method)); }, 20000);
  });

  await send("Runtime.enable");
  await send("Page.enable");
  await send("Emulation.setDeviceMetricsOverride", { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });

  const evaluate = async (expression) => {
    const result = await send("Runtime.evaluate",
      { expression, returnByValue: true, awaitPromise: true, userGesture: true });
    if (result.exceptionDetails) throw new Error(result.exceptionDetails.text + " in " + expression);
    return result.result.value;
  };
  return { evaluate, send, kill: () => { try { ws.close(); } catch {} proc.kill("SIGKILL"); } };
}

async function waitFor(browser, expression, timeout = 8000) {
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) {
    try { if (await browser.evaluate(expression)) return true; } catch {}
    await new Promise((r) => setTimeout(r, 150));
  }
  return false;
}

const setValue = (id, value) =>
  `(() => { const el = document.getElementById(${JSON.stringify(id)}); if (!el) return false; el.value = ${JSON.stringify(value)}; el.dispatchEvent(new Event("input", {bubbles:true})); return true; })()`;
const submit = (id) => `(() => { const el = document.getElementById(${JSON.stringify(id)}); if (!el) return false; el.requestSubmit(); return true; })()`;
const text = (selector) => `(document.querySelector(${JSON.stringify(selector)}) || {}).textContent || ""`;

async function main() {
  const base = arg("base-url", "http://127.0.0.1:18092");
  const password = arg("password", "Demo@123456");
  const output = arg("output", null);

  const admin = await api(base, "POST", "/api/v1/auth/sessions", { body: { username: "admin", password } });
  if (admin.status !== 200) throw new Error("admin login failed: " + JSON.stringify(admin.body));
  const adminToken = admin.body.token;
  const structure = (await api(base, "GET", "/api/v1/admin/organization", { token: adminToken })).body;
  const department = structure.departments[0].id;
  const position = structure.positions[0].id;

  const username = "brw-" + RUN;
  const created = await api(base, "POST", "/api/v1/admin/employees", {
    token: adminToken, key: "browser-" + crypto.randomUUID(),
    body: { username, displayName: "浏览器验证", departmentId: department, positionId: position, level: 3, roleCodes: ["employee"] },
  });
  if (created.status !== 201) throw new Error("employee create failed: " + JSON.stringify(created.body));
  const initialPassword = created.body.initialPassword;
  const userId = created.body.userId;

  const browser = await openBrowser(base + "/");
  try {
    check("3.4 the served page renders a login form",
      await waitFor(browser, `!!document.getElementById("backend-login")`),
      { url: await browser.evaluate("location.pathname") });
    check("3.4 the login form offers no self-registration",
      !(await browser.evaluate(`/注册/.test(document.getElementById("page-map").textContent)`)));

    // First login with the generated password must land on the forced-change screen.
    await browser.evaluate(setValue("login-user", username));
    await browser.evaluate(setValue("login-password", initialPassword));
    await browser.evaluate(submit("backend-login"));
    check("3.4 a first login opens the forced password change screen",
      await waitFor(browser, `!!document.getElementById("backend-password")`),
      { heading: await browser.evaluate(text("#pageTitle")) });
    check("3.4 the workspace is not rendered before the password change",
      (await browser.evaluate(`(document.getElementById("whoami").textContent||"")`)) === "未登录",
      { whoami: await browser.evaluate(text("#whoami")) });

    // Mismatched confirmation is caught locally.
    await browser.evaluate(setValue("pw-current", initialPassword));
    await browser.evaluate(setValue("pw-new", "Abcdefghi1"));
    await browser.evaluate(setValue("pw-confirm", "Abcdefghi2"));
    await browser.evaluate(submit("backend-password"));
    check("3.4 a mismatched confirmation shows an inline error",
      await waitFor(browser, `!document.getElementById("password-error").hidden && /不一致/.test(${text("#password-error")})`),
      { message: await browser.evaluate(text("#password-error")) });

    // A policy violation is rejected by the server and surfaced in the page.
    await browser.evaluate(setValue("pw-confirm", "short1"));
    await browser.evaluate(setValue("pw-new", "short1"));
    await browser.evaluate(submit("backend-password"));
    check("3.4 a policy violation is rejected in the page",
      await waitFor(browser, `/至少10个字符|字母和数字/.test(${text("#password-error")})`),
      { message: await browser.evaluate(text("#password-error")) });

    // A valid change returns to the login screen.
    const newPassword = "Zx9" + crypto.randomBytes(5).toString("hex");
    await browser.evaluate(setValue("pw-current", initialPassword));
    await browser.evaluate(setValue("pw-new", newPassword));
    await browser.evaluate(setValue("pw-confirm", newPassword));
    await browser.evaluate(submit("backend-password"));
    check("3.4 a successful change returns to the login screen",
      await waitFor(browser, `!!document.getElementById("backend-login") && /重新登录/.test(${text("#login-error")})`),
      { message: await browser.evaluate(text("#login-error")) });

    // The old password no longer works, the new one does.
    await browser.evaluate(setValue("login-user", username));
    await browser.evaluate(setValue("login-password", initialPassword));
    await browser.evaluate(submit("backend-login"));
    check("3.4 the old password is refused after the change",
      await waitFor(browser, `/不正确/.test(${text("#login-error")})`),
      { message: await browser.evaluate(text("#login-error")) });

    await browser.evaluate(setValue("login-password", newPassword));
    await browser.evaluate(submit("backend-login"));
    const workspaceLoaded = await waitFor(browser,
      `document.getElementById("whoami").textContent !== "未登录" && !document.querySelector("#tabbar button[data-page=\\"map\\"]").disabled`, 15000);
    check("3.4 the new password loads the workspace with the real identity", workspaceLoaded,
      { whoami: await browser.evaluate(text("#whoami")) });

    // Everyday change from 我的.
    await browser.evaluate(`(() => { const b = document.querySelector('#tabbar button[data-page="me"]'); if (b) b.click(); return !!b; })()`);
    const onProfile = await waitFor(browser, `!!document.querySelector('#page-me [data-action="p-change-password"]')`);
    check("3.4 the profile page offers a password change", onProfile, {});
    await browser.evaluate(`document.querySelector('#page-me [data-action="p-change-password"]').click()`);
    await waitFor(browser, `!!document.getElementById("cp-current")`);
    await browser.evaluate(setValue("cp-current", "definitely-wrong"));
    await browser.evaluate(setValue("cp-new", "Abcdefghi1"));
    await browser.evaluate(setValue("cp-confirm", "Abcdefghi1"));
    await browser.evaluate(`document.querySelector('[data-action="p-save-password"]').click()`);
    check("3.4 a wrong current password is refused from the profile page",
      await waitFor(browser, `/当前密码不正确/.test(${text("#password-error")})`),
      { message: await browser.evaluate(text("#password-error")) });

    const everydayPassword = "Qw8" + crypto.randomBytes(5).toString("hex");
    await browser.evaluate(setValue("cp-current", newPassword));
    await browser.evaluate(setValue("cp-new", everydayPassword));
    await browser.evaluate(setValue("cp-confirm", everydayPassword));
    await browser.evaluate(`document.querySelector('[data-action="p-save-password"]').click()`);
    check("3.4 an everyday change returns to the login screen",
      await waitFor(browser, `!!document.getElementById("backend-login") && /重新登录/.test(${text("#login-error")})`, 12000),
      { message: await browser.evaluate(text("#login-error")) });

    await browser.evaluate(setValue("login-user", username));
    await browser.evaluate(setValue("login-password", everydayPassword));
    await browser.evaluate(submit("backend-login"));
    check("3.4 the everyday password is the active one",
      await waitFor(browser, `document.getElementById("whoami").textContent !== "未登录"`, 15000),
      { whoami: await browser.evaluate(text("#whoami")) });

    // The administrator console exposes reset for this account.
    const reset = await api(base, "POST", `/api/v1/admin/employees/${userId}/password-reset`,
      { token: adminToken, key: "browser-reset-" + crypto.randomUUID() });
    check("3.4 the administrator can reset and receives a new one-time password",
      reset.status === 200 && !!reset.body.initialPassword && reset.body.sessionsRevoked >= 1,
      { status: reset.status, sessionsRevoked: reset.body.sessionsRevoked });

    // Reloading with the now-revoked token must fall back to the login screen.
    await browser.send("Page.reload");
    check("3.4 the reset invalidates the browser session in place",
      await waitFor(browser, `!!document.getElementById("backend-login")`, 15000),
      { path: await browser.evaluate("location.pathname") });
  } finally {
    browser.kill();
  }

  const passed = results.filter((r) => r.pass).length;
  console.log(`\n${passed}/${results.length} browser checks passed`);
  if (output) {
    fs.mkdirSync(path.dirname(output), { recursive: true });
    fs.writeFileSync(output, JSON.stringify({
      generatedAt: new Date().toISOString(), baseUrl: base, passed, total: results.length, results,
    }, null, 2) + "\n");
    console.log("wrote " + output);
  }
  return passed === results.length ? 0 : 1;
}

main().then((code) => process.exit(code)).catch((error) => { console.error(error); process.exit(2); });
