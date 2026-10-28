"use strict";
const {spawn}=require('child_process');const fs=require('fs');const os=require('os');const path=require('path');const crypto=require('crypto');
const CHROME=process.env.CHROME_BIN||'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
function arg(name,fallback){return fallback;}
async function openBrowser(url,metrics={width:390,height:844,mobile:true}) {
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
  await send("Emulation.setDeviceMetricsOverride", { width:metrics.width,height:metrics.height,deviceScaleFactor:1,mobile:!!metrics.mobile });
  const evaluate = async (expression) => {
    const result = await send("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true, userGesture: true });
    if (result.exceptionDetails) throw new Error(result.exceptionDetails.text + " in " + expression);
    return result.result.value;
  };
  return { evaluate, errors, send, screenshot:async filename=>{const result=await send('Page.captureScreenshot',{format:'png'});fs.writeFileSync(filename,Buffer.from(result.data,'base64'));}, viewport:async metrics=>send('Emulation.setDeviceMetricsOverride',{...metrics,deviceScaleFactor:1}), kill: () => { try { ws.close(); } catch {} proc.kill("SIGKILL"); } };
}
async function waitFor(browser, expression, timeout = 12000) {
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) {
    try { if (await browser.evaluate(expression)) return true; } catch {}
    await sleep(150);
  }
  return false;
}
module.exports={openBrowser,waitFor,sleep};
