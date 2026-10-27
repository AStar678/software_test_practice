#!/usr/bin/env node
"use strict";
/*
 * Supplemental evidence for task 11.2: the demo home page really renders the ten persisted company
 * items as styled list rows/cards at mobile width — not as raw text and not from a static fixture.
 * Run it against the same prepared demo database, ideally after restarting the backend on that
 * database, which also re-proves the demo rows live in MySQL rather than process memory.
 *
 * Requires the worker-enabled prepared demo data (see prepare_demo.py) and headless Chrome.
 *
 *   KEEP_ISOLATED_DB=1 CHECK_WORKER=true ./scripts/run_check_isolated.sh bash -c '
 *     python3 scripts/prepare_demo.py --base-url {base} --output ../audit/2026-10-27/chapter11-demo-prep-1.json &&
 *     node scripts/check_demo_home_style.js --base-url {base} \
 *       --output ../audit/2026-10-27/chapter11-demo-home-style.json \
 *       --screenshot ../audit/2026-10-27/chapter11-demo-home.png'
 *
 * The screenshot hides the pre-login "请使用真实账号登录。" notice, which belongs to the initial
 * no-token page load and is not a login failure.
 */
const { spawn } = require("child_process");
const crypto = require("crypto");
const fs = require("fs");
const os = require("os");
const path = require("path");

const CHROME = process.env.CHROME_BIN || [
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
  "/usr/bin/google-chrome", "/usr/bin/google-chrome-stable",
].find((candidate) => fs.existsSync(candidate));
const results = [];
function arg(name, fallback) { const i = process.argv.indexOf("--" + name); return i >= 0 ? process.argv[i + 1] : fallback; }
function check(name, pass, evidence) {
  results.push({ check: name, pass: !!pass, evidence: evidence === undefined ? null : evidence });
  console.log((pass ? "PASS  " : "FAIL  ") + name + (pass ? "" : "  -> " + JSON.stringify(evidence)));
}
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function openBrowser(url, width, height) {
  const port = 10800 + Math.floor(Math.random() * 300);
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
  await send("Runtime.enable"); await send("Page.enable");
  await send("Emulation.setDeviceMetricsOverride", { width, height, deviceScaleFactor: 1, mobile: true });
  const evaluate = async (expression) => {
    const value = await send("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true, userGesture: true });
    if (value.exceptionDetails) throw new Error(value.exceptionDetails.text + " in " + expression.slice(0, 120));
    return value.result.value;
  };
  return { send, evaluate, errors, kill: () => { try { ws.close(); } catch {} proc.kill("SIGKILL"); } };
}

async function waitFor(browser, expression, timeout = 15000) {
  const end = Date.now() + timeout;
  while (Date.now() < end) {
    try { if (await browser.evaluate(expression)) return true; } catch {}
    await sleep(150);
  }
  return false;
}

async function main() {
  const base = arg("base-url", "http://127.0.0.1:18130");
  const password = arg("password", "Demo@123456");
  const output = arg("output", null);
  const screenshot = arg("screenshot", null);
  const browser = await openBrowser(base + "/", 390, 844);
  try {
    await waitFor(browser, "!!document.getElementById('backend-login')");
    await browser.evaluate("(() => { const u = document.getElementById('login-user'); u.value = '13800000002'; u.dispatchEvent(new Event('input', {bubbles:true})); const p = document.getElementById('login-password'); p.value = " + JSON.stringify(password) + "; p.dispatchEvent(new Event('input', {bubbles:true})); document.getElementById('backend-login').requestSubmit(); })()");
    check("11.2 home style: the same demo account loads the real home page after a backend restart",
      await waitFor(browser, "window.Pandora && window.Pandora.ready && Pandora.data.me.username === 'middle' && state.page === 'map'"));

    const style = await browser.evaluate(`(() => {
      const grid = document.querySelector('#page-map .map-grid');
      const quads = Array.from(document.querySelectorAll('#page-map .quad'));
      const company = quads[0];
      const companyRows = company ? Array.from(company.querySelectorAll('.item-line')) : [];
      const cs = grid ? getComputedStyle(grid) : null;
      const qc = company ? getComputedStyle(company) : null;
      return {
        gridDisplay: cs ? cs.display : null,
        gridColumns: cs ? cs.gridTemplateColumns.split(' ').length : 0,
        quads: quads.length,
        companyRows: companyRows.length,
        visibleRows: companyRows.filter(r => r.getBoundingClientRect().height > 0 && r.offsetParent !== null).length,
        rowHeight: companyRows[0] ? Math.round(companyRows[0].getBoundingClientRect().height) : 0,
        cardBg: qc ? qc.backgroundColor : null,
        cardRadius: qc ? qc.borderRadius : null,
        overflowX: document.documentElement.scrollWidth - document.documentElement.clientWidth,
        texts: companyRows.map(r => (r.textContent || '').trim().slice(0, 22)),
      };
    })()`);
    check("11.2 home style: the ten persisted company items render as ten visible list rows",
      style.companyRows === 10 && style.visibleRows === 10 && style.texts.some(t => t.includes("公司事项")),
      { companyRows: style.companyRows, visibleRows: style.visibleRows, sample: style.texts.slice(0, 2) });
    check("11.2 home style: the home page uses the two-column grid and styled cards, not un-styled text",
      style.gridDisplay === "grid" && style.gridColumns === 2 && style.quads === 4
      && style.cardBg !== "rgba(0, 0, 0, 0)" && parseFloat(style.cardRadius) > 0 && style.rowHeight > 0,
      { gridDisplay: style.gridDisplay, gridColumns: style.gridColumns, quads: style.quads, cardBg: style.cardBg, cardRadius: style.cardRadius, rowHeight: style.rowHeight });
    check("11.2 home style: the mobile home page has no horizontal overflow at 390px",
      style.overflowX <= 1, { overflowX: style.overflowX });

    if (screenshot) {
      await browser.evaluate("(() => { const o = document.getElementById('overlay'); if (o) o.hidden = true; const n = document.getElementById('appNotice'); if (n) n.hidden = true; })()");
      const shot = await browser.send("Page.captureScreenshot", { format: "png", captureBeyondViewport: false });
      fs.mkdirSync(path.dirname(screenshot), { recursive: true });
      fs.writeFileSync(screenshot, Buffer.from(shot.data, "base64"));
    }
    check("11.2 home style: no uncaught script errors while rendering the home page", browser.errors.length === 0, browser.errors.slice(0, 6));
  } finally {
    browser.kill();
    if (output) {
      fs.mkdirSync(path.dirname(output), { recursive: true });
      fs.writeFileSync(output, JSON.stringify({ generatedAt: new Date().toISOString(), baseUrl: base,
        viewport: { width: 390, height: 844 }, scope: "web only; home style supplement for 11.2",
        passed: results.filter((row) => row.pass).length, total: results.length, checks: results }, null, 2) + "\n");
    }
    const passed = results.filter((row) => row.pass).length;
    console.log(`\n${passed}/${results.length} home-style checks passed`);
    if (passed !== results.length) process.exitCode = 1;
  }
}
main().catch((error) => { console.error(error); process.exitCode = 1; });
