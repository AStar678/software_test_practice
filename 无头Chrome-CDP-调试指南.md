# 无头 Chrome + CDP 调试指南（本机踩坑记录）

面向未来在此仓库做浏览器验证的 agent。目标：**不要在“CDP 被沙箱封了”这个错误结论上浪费一轮**。

---

## 0. TL;DR

**首选**：直接用第 6 节的最小客户端——它自己 spawn Chrome，不用你手动起进程。
下面这条命令只是“手动排查时 Chrome 该怎么起”的参考，**它是前台阻塞的**，
真要用请放到后台任务里，或按第 6 节由脚本 spawn：

```bash
CHROME="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
"$CHROME" --headless --no-sandbox --disable-gpu --no-first-run \
  --disable-crash-reporter --hide-scrollbars --force-device-scale-factor=1 \
  --remote-debugging-port=9333 --user-data-dir=/tmp/cdp-$RANDOM \
  "file:///绝对路径/页面.html"
```

- 然后用 **Node 24 自带的 `WebSocket`** 连 `http://127.0.0.1:9333/json/list` 里
  `type === "page"` 且 URL 以 `file:` 开头的目标。**不需要 npm 装任何东西**（沙箱里 `npm i` 会 EPERM）。
- 视口一律用 **`Emulation.setDeviceMetricsOverride`**，**不要用 `--window-size`**。

---

## 1. 最大的坑：把“Chrome 崩了”误判成“CDP 被禁”

我第一次尝试用 `--headless=new` 启动并连 CDP，看到：

```
WS OPEN
WS ERROR error
WS CLOSE 1006
```

于是得出“本环境禁止 CDP WebSocket”的结论，绕道去用 `--dump-dom` + 注入脚本，白白多花了一轮。

**真相**：`--headless=new` 在本沙箱下起不来，stderr 里是：

```
Failed to initialize sandbox: Operation not permitted
GPU process exited unexpectedly: exit_code=6
Trace/BPT trap: 5        # 进程退出码 133
```

浏览器进程自己死了，WebSocket 当然 1006。**1006 是症状，不是原因。**

**判断方法**：先确认浏览器还活着，再怀疑协议。

```bash
curl -s --max-time 3 http://127.0.0.1:9333/json/version   # 有 JSON = 进程健康
pgrep -fl "remote-debugging-port=9333"                    # 进程还在吗
```

**结论**：本机用 `--headless`（old headless）+ `--no-sandbox` 最稳。
`--headless=new` 若在你那边可用则优先用（它没有窗口尺寸钳制问题，见第 2 节）。
也不需要把 Chrome 提到沙箱外运行；沙箱内 `--no-sandbox` 就够。外部运行也可行，是备用方案。

---

## 2. 第二个坑：`--window-size` 在手机上不准

本机请求 `--window-size=375,812`，实际拿到的是 **`innerWidth=500, innerHeight=669`**：

| 请求 | 实际 innerWidth × innerHeight |
| --- | --- |
| 375×812 | **500** × 669 |
| 390×844 | **500** × 701 |
| 430×932 | **500** × 789 |
| 1280×1000 | 1280 × 857 |

窗口宽度被钳到最小 ~500px，高度还少了约 143px。
后果很严重：`@media (max-width:480px)` **根本没被匹配**，你测的是桌面分支，还会得出“导航在视口内”之类的错误结论。

**正确做法**——用 CDP 改 CSS 视口：

```js
await send("Emulation.setDeviceMetricsOverride", {
  width: 375, height: 812, deviceScaleFactor: 1, mobile: true
});
```

**必须断言**（否则你无法确认它生效了）：

```js
window.innerWidth === 375 && window.matchMedia("(max-width:480px)").matches
```

**不要**做的事：
- 不要注入“等价 CSS”去模拟 `@media` 分支——那样媒体查询条件本身没被验证，证据强度差一档。
- 不要用限定尺寸的 `iframe` 来伪造视口：file:// 下父页访问 `iframe.contentDocument` 会被拦
  （`--allow-file-access-from-files` 我试了也没救回来，返回 `MISSING`）。用 `Emulation` 就够了。

---

## 3. 第三个坑：测量被滚动位置污染

弹层开关会把焦点移回页面元素，浏览器可能顺手把文档滚下去。我因此测到
`phone=0..812 / nav=747..812`（看着正常），实际文档是 `scrollHeight=910`、被滚了 97px——
**差一点给出一个假 PASS**。

**测量前一律归零并如实记录：**

```js
window.scrollTo(0, 0);
// 同时输出 scrollY 与 scrollHeight - innerHeight，别只看 getBoundingClientRect
```

---

## 4. 第四个坑：自己的审计规则制造假失败

我写过一版布局审计，报了 1347 条“问题”，全是自己规则的问题：

| 假问题 | 原因 | 修法 |
| --- | --- | --- |
| `content below the scrollable area: tabbar / app / SVG` | 拿“相对 `#appMain` 的滚动位置”去套**不在** `#appMain` 里的元素 | 垂直可达性只检查 `#appMain` 的后代 |
| 象限里的条目“被裁切” | 没排除内层滚动容器（`.q-body`、横向时间轴 `.tl`） | `if (el.closest(".q-body") \|\| el.closest(".tl")) return;` |
| 非当前页元素“超出手机框” | `display:none` 的页面 `getBoundingClientRect()` 全 0 | 跳过 `width === 0 && height === 0` |
| “`localStorage` 出现在源码里” | 用 `outerHTML`/注入了测试脚本的副本来扫源码 | 扫**原始文件**，别扫运行中的 DOM |
| 导航“在视口内” | 只拿手机框当参照，没检查手机框自己是否超出浏览器视口 | 同时断言 `documentElement.scrollHeight <= innerHeight` |

**另一条更重要的教训**：DOM 度量查不出 CJK 文本被挤成一字一行
（CJK 会换行，`scrollWidth > clientWidth` 永远不触发）。这类问题**只有看截图**才能发现。
视觉检查不能省。

---

## 5. 其它小坑

- **`/json/list` 有多个 target**：本机会同时出现扩展的 `background_page`、`browser_ui`（omnibox）。
  必须按 `type === "page"` **且** URL 以 `file:` 开头筛选，否则会连错目标。
- **`--dump-dom` 在 load 时就快照**：任何 `setTimeout(...)` 之后才写入的结果都拿不到。
  要么在 load 里同步产出，要么改用 CDP 的 `Runtime.evaluate`（推荐）。
- **粘性 profile 会导致挂死**：重复使用同一 `--user-data-dir` 或残留进程会让 Chrome 卡住。
  每次用唯一目录 + 硬超时 `SIGKILL` + 重试。
- **功能回归套件必须在全新加载上跑**：否则前面探测步骤改过的内存状态会污染断言，产生假失败。
  用 `Page.reload` 后等 `document.readyState === "complete"` 再跑。
- **`--force-device-scale-factor=1`**：避免 dpr 影响像素级几何断言。

---

## 6. 可复用的最小客户端

```js
const { spawn } = require("child_process");
const crypto = require("crypto");
const CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";

async function open(url, { width = 390, height = 844, mobile = true } = {}) {
  const port = 9400 + Math.floor(Math.random() * 200);
  const proc = spawn(CHROME, [
    "--headless", "--no-sandbox", "--disable-gpu", "--no-first-run",
    "--no-default-browser-check", "--disable-crash-reporter", "--hide-scrollbars",
    "--force-device-scale-factor=1",
    "--remote-debugging-port=" + port,
    "--user-data-dir=/tmp/cdp-" + crypto.randomBytes(4).toString("hex"),
    url
  ], { stdio: "ignore" });

  // 1) 等目标出现，按 type + file: 筛选
  let target = null;
  for (let i = 0; i < 80 && !target; i++) {
    try {
      const list = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json();
      target = list.find(t => t.type === "page" && String(t.url).startsWith("file:"));
    } catch {}
    if (!target) await new Promise(r => setTimeout(r, 250));
  }
  if (!target) { proc.kill("SIGKILL"); throw new Error("no file: page target"); }

  // 2) 建 WS + 请求/响应配对
  const ws = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((res, rej) => {
    ws.addEventListener("open", res);
    ws.addEventListener("error", () => rej(new Error("ws failed")));
  });
  let seq = 0; const pending = new Map();
  ws.addEventListener("message", e => {
    const m = JSON.parse(e.data);
    if (m.id && pending.has(m.id)) {
      const { resolve, reject } = pending.get(m.id); pending.delete(m.id);
      m.error ? reject(new Error(JSON.stringify(m.error))) : resolve(m.result);
    }
  });
  const send = (method, params) => new Promise((resolve, reject) => {
    const id = ++seq; pending.set(id, { resolve, reject });
    ws.send(JSON.stringify({ id, method, params: params || {} }));
    setTimeout(() => { if (pending.delete(id)) reject(new Error("timeout: " + method)); }, 20000);
  });

  await send("Runtime.enable");
  await send("Page.enable");

  // 3) 真实视口 + 立刻断言
  await send("Emulation.setDeviceMetricsOverride",
    { width, height, deviceScaleFactor: 1, mobile });

  const evalIn = async (expr) => {
    const r = await send("Runtime.evaluate",
      { expression: expr, returnByValue: true, awaitPromise: true, userGesture: true });
    if (r.exceptionDetails) throw new Error(r.exceptionDetails.text);
    return r.result.value;
  };
  const got = await evalIn(`[window.innerWidth, window.innerHeight]`);
  if (got[0] !== width) throw new Error(`viewport not applied: ${got[0]} != ${width}`);

  return { send, evalIn, kill: () => { try { ws.close(); } catch {} proc.kill("SIGKILL"); } };
}
```

用法：

```js
const cdp = await open("file://" + encodeURI("/绝对路径/页面.html"), { width: 375, height: 812 });
await cdp.evalIn(`window.scrollTo(0,0); document.documentElement.scrollHeight`);
cdp.kill();
```

---

## 7. 症状 → 病因 → 处方

| 症状 | 真实病因 | 处方 |
| --- | --- | --- |
| WS `1006` / `Runtime.enable` 超时 | Chrome 进程已崩（常因 `--headless=new` + 沙箱） | 换 `--headless --no-sandbox`；先 `curl /json/version` 确认进程活着 |
| `innerWidth` 不是你要的值 | `--window-size` 被钳制 | `Emulation.setDeviceMetricsOverride` |
| 手机宽度下媒体查询没生效 | 视口其实是 500px | 断言 `matchMedia("(max-width:480px)").matches` |
| 几何结论时好时坏 | 文档被滚动 / 状态被前面步骤污染 | `window.scrollTo(0,0)` + `Page.reload` 后再跑 |
| 几百条布局“问题” | 审计规则没排除内层滚动容器 / 隐藏元素 / 非滚动容器后代 | 见第 4 节对照表 |
| `--dump-dom` 里没有结果 | 快照发生在 load，晚于 `setTimeout` | 改同步产出，或改用 CDP `Runtime.evaluate` |
| 连上了但不是原型页 | `/json/list` 里的扩展页 / omnibox 目标 | 按 `type === "page"` 且 `file:` 前缀筛选 |
