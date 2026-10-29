"use strict";
/* 后端适配层：沿用原型的渲染器和交互，仅替换数据来源与会话。 */
(function () {
  Object.assign(ROLE_LABEL,{founder:"创始人",department_head:"部门负责人",team_head:"团队负责人",employee:"员工"});
  const SESSION_KEY = "pandora.backend.session";
  const P = window.Pandora = {
    epoch: 0, token: sessionStorage.getItem(SESSION_KEY) || "", ready: false,
    data: {}, taskEtags: new Map(), approvalEtags: new Map(),
    logEtags: new Map(), notificationEtags: new Map()
  };
  const retries = new Map();
  let working = false, reloadSequence = 0, taskSequence = 0;
  /* Per-module session teardown hooks: pages that cache authorized data register here so logout,
     expiry and account switches invalidate their state together with the shared workspace. */
  P.sessionReset = [];
  const cancelled = () => Object.assign(new Error("账号已切换，请重新操作。"), { name: "AbortError" });
  const version = row => '"' + row.rowVersion + '"';
  const note = document.getElementById("appNotice");
  let noticeTimer;
  P.notice = message => {
    if (!note) return;
    clearTimeout(noticeTimer);
    note.textContent = message || "";
    note.hidden = !message;
    if (message) noticeTimer = setTimeout(() => { note.hidden = true; }, 5000);
  };

  /* Network feedback is separate from success/error notices. Every request owns its token, so a
     slow sibling or a stale session response cannot clear another operation's loading state. */
  const networkStatus = document.getElementById("networkStatus");
  const loading = new Map(), buttonHolds = new Map(), requests = new Set();
  let interactionTrigger = null, activeCommand = null, triggerTimer, slowTimer;
  function holdButton(button) {
    if (!button || !(button instanceof HTMLButtonElement || button instanceof HTMLInputElement)) return () => {};
    let hold = buttonHolds.get(button);
    if (!hold) {
      hold = { count: 0, disabled: button.getAttribute("aria-disabled"), busy: button.getAttribute("aria-busy") };
      buttonHolds.set(button, hold);
      // Keep the opener focusable while waiting: dialogs capture it after their request completes.
      // Capture-phase click/submit guards below provide the disabled behavior without losing focus.
      button.classList.add("is-network-busy"); button.setAttribute("aria-busy", "true"); button.setAttribute("aria-disabled", "true");
    }
    hold.count++;
    let released = false;
    return () => {
      if (released) return; released = true;
      if (buttonHolds.get(button) !== hold || --hold.count > 0) return;
      buttonHolds.delete(button); button.classList.remove("is-network-busy");
      if (hold.disabled == null) button.removeAttribute("aria-disabled"); else button.setAttribute("aria-disabled", hold.disabled);
      if (hold.busy == null) button.removeAttribute("aria-busy"); else button.setAttribute("aria-busy", hold.busy);
    };
  }
  function paintLoading() {
    clearTimeout(slowTimer);
    const current = [...loading.values()].filter(item => item.epoch === P.epoch);
    const app = document.querySelector(".app");
    if (working || current.length) app.setAttribute("aria-busy", "true"); else app.removeAttribute("aria-busy");
    if (!networkStatus) return;
    networkStatus.hidden = !current.length;
    networkStatus.dataset.pending = String(current.length);
    if (!current.length) return;
    const elapsed = Date.now() - Math.min(...current.map(item => item.started));
    const saving = current.some(item => item.saving);
    const label = elapsed >= 8000 ? (saving ? "仍在等待保存结果，请勿重复提交…" : "正在等待服务器响应，请稍候…")
      : saving ? "正在保存，请稍候…" : (current.find(item => item.label)?.label || "正在加载，请稍候…");
    const text = networkStatus.querySelector(".network-status-text");
    if (text.textContent !== label) text.textContent = label;
    if (elapsed < 8000) slowTimer = setTimeout(paintLoading, 8000 - elapsed);
  }
  function startLoading(label, saving) {
    if (activeCommand?.trigger && !activeCommand.releaseButton) activeCommand.releaseButton = holdButton(activeCommand.trigger);
    const id = Symbol("loading"), releaseButton = holdButton(interactionTrigger);
    loading.set(id, { epoch: P.epoch, started: Date.now(), label, saving: !!saving, releaseButton });
    paintLoading();
    return () => { const item = loading.get(id); if (!item) return; loading.delete(id); item.releaseButton(); paintLoading(); };
  }
  function resetLoading() {
    requests.forEach(controller => controller.abort()); requests.clear();
    loading.forEach(item => item.releaseButton()); loading.clear();
    if (activeCommand?.releaseButton) { activeCommand.releaseButton(); activeCommand.releaseButton = null; }
    interactionTrigger = null; clearTimeout(triggerTimer); paintLoading();
  }
  async function loadingGroup(label, fn) {
    const finish = startLoading(label, false);
    try { return await fn(); } finally { finish(); }
  }
  function rememberTrigger(button) {
    clearTimeout(triggerTimer); interactionTrigger = button;
    triggerTimer = setTimeout(() => { interactionTrigger = null; }, 0);
  }

  function clearData() {
    resetLoading();
    P.ready = false; P.data = {};
    reloadSequence++; taskSequence++;
    [PEOPLE, TASKS, LOGS, NOTIFICATIONS, CONSULTATIONS, COMPANY_ITEMS].forEach(a => a.splice(0));
    Object.keys(PERSONAL_STATE).forEach(k => delete PERSONAL_STATE[k]);
    [P.taskEtags, P.approvalEtags, P.logEtags, P.notificationEtags].forEach(m => m.clear());
    retries.clear(); state.actorId = null;
    closeSheet();
    document.querySelectorAll(".page").forEach(el => { el.innerHTML = ""; });
    document.getElementById("bellDot").hidden = true;
    document.getElementById("whoami").textContent = "未登录";
    P.sessionReset.forEach(fn => { try { fn(); } catch (_) { /* a page reset must never block logout */ } });
  }
  function gate() {
    document.querySelector(".app").classList.toggle("is-auth", !P.ready);
    document.querySelectorAll("#tabbar button, #bellBtn").forEach(el => { el.disabled = !P.ready; });
    if (!P.ready) {
      document.querySelector(".phone").classList.remove("is-schedule");
      document.getElementById("appMain").classList.remove("is-schedule");
    }
  }
  function loginPage(identifier, message) {
    state.page = "map";
    document.querySelectorAll(".page").forEach(el => el.classList.toggle("is-active", el.id === "page-map"));
    document.getElementById("appMain").classList.remove("is-map");
    document.getElementById("pageTitle").textContent = "登录";
    document.querySelectorAll(".role-switch button").forEach(b => b.setAttribute("aria-pressed", "false"));
    document.getElementById("page-map").innerHTML = '<section class="auth-card"><div class="auth-brand"><span class="auth-mark" aria-hidden="true"><img src="潘多拉-手账标记.svg" alt="" width="44" height="44"></span><span>潘多拉</span></div>' +
      '<div class="auth-copy"><p class="eyebrow">PANDORA WORKSPACE</p><h2>让每一天，<br>有序向前。</h2><p>登录你的工作台，查看任务与团队动态。</p></div>' +
      '<form id="backend-login"><div class="field"><label for="login-user">手机号</label><input id="login-user" type="text" name="phone" inputmode="tel" autocomplete="tel" autocapitalize="none" spellcheck="false" placeholder="请输入本人手机号" required value="' + esc(identifier || "") + '"></div>' +
      '<div class="field"><label for="login-password">密码</label><input id="login-password" name="password" type="password" autocomplete="current-password" placeholder="请输入密码" required></div>' +
      '<div class="callout" id="login-error" role="alert"' + (message ? '' : ' hidden') + '>' + esc(message || "") + '</div>' +
      '<button type="submit" class="btn primary auth-submit">登录工作台</button></form>' +
      '<p class="auth-help">员工使用本人手机号登录，初始密码由公司管理员提供；忘记密码请联系管理员。管理员请通过下方“进入管理后台”入口使用管理账号登录。</p>' +
      '<p class="auth-help auth-demo">演示员工手机号 13800000001—13800000006；管理员账号 admin。</p>' +
      '<a class="auth-admin" href="/admin.html">进入管理后台</a></section>';
    gate();
    document.getElementById("backend-login").addEventListener("submit", event => {
      event.preventDefault();
      P.busy(async () => {
        const phone = document.getElementById("login-user").value.trim();
        const password = document.getElementById("login-password").value;
        const result = await P.request("/auth/sessions", { method: "POST", body: { phone, password, accountType: "employee" } });
        P.epoch++;
        P.token = result.token; sessionStorage.setItem(SESSION_KEY, P.token);
        // A new account or a reset account must change its password before any business page loads.
        if (result.passwordChangeRequired) { passwordPage(password, ""); return; }
        try { await P.reload(); }
        catch (error) { if (P.token) loadFailure(error); throw error; }
      }, "login-error");
    });
  }
  /* 强制改密受限会话：只能改密或退出，业务接口在服务端一律拒绝。 */
  function passwordPage(currentPassword, message) {
    state.page = "map";
    document.querySelectorAll(".page").forEach(el => el.classList.toggle("is-active", el.id === "page-map"));
    document.getElementById("appMain").classList.remove("is-map");
    document.getElementById("pageTitle").textContent = "修改密码";
    document.querySelectorAll(".role-switch button").forEach(b => b.setAttribute("aria-pressed", "false"));
    document.getElementById("page-map").innerHTML = '<section class="auth-card"><div class="auth-brand"><span class="auth-mark" aria-hidden="true"><img src="潘多拉-手账标记.svg" alt="" width="44" height="44"></span><span>潘多拉</span></div><div class="auth-copy"><h2>设置你的新密码</h2>' +
      '<p>首次登录请先修改初始密码，完成后即可进入工作台。</p></div>' +
      '<form id="backend-password">' +
      '<div class="field"><label for="pw-current">当前密码</label><input id="pw-current" name="currentPassword" type="password" autocomplete="current-password" required></div>' +
      '<div class="field"><label for="pw-new">新密码</label><input id="pw-new" name="newPassword" type="password" autocomplete="new-password" required></div>' +
      '<div class="field"><label for="pw-confirm">确认新密码</label><input id="pw-confirm" type="password" autocomplete="new-password" required></div>' +
      '<p class="tiny muted">至少10个字符，须同时包含字母和数字，UTF-8 长度不超过72字节。修改成功后，请使用新密码重新登录。</p>' +
      '<div class="callout" id="password-error" role="alert"' + (message ? '' : ' hidden') + '>' + esc(message || "") + '</div>' +
      '<div class="row"><button type="submit" class="btn primary">修改密码</button>' +
      '<button type="button" class="btn" id="password-logout">退出登录</button></div></form></section>';
    gate();
    const currentField = document.getElementById("pw-current");
    if (currentPassword) currentField.value = currentPassword;
    document.getElementById("password-logout").addEventListener("click", () => P.busy(async () => { await P.logout(); }));
    document.getElementById("backend-password").addEventListener("submit", event => {
      event.preventDefault();
      P.busy(async () => {
        const current = document.getElementById("pw-current").value;
        const next = document.getElementById("pw-new").value;
        const confirm = document.getElementById("pw-confirm").value;
        const error = document.getElementById("password-error");
        if (next !== confirm) { error.textContent = "两次输入的新密码不一致。"; error.hidden = false; return; }
        await P.request("/auth/password", { method: "POST", body: { currentPassword: current, newPassword: next } });
        P.reLogin("密码已修改，请使用新密码重新登录。");
      }, "password-error");
    });
  }
  P.passwordPage = passwordPage;
  /* 改密成功后服务端撤销全部会话；客户端必须清空本地会话并回到登录页。 */
  P.reLogin = function (message) {
    P.epoch++; P.token = ""; sessionStorage.removeItem(SESSION_KEY);
    clearData(); loginPage("", message || "请重新登录。");
  };
  function expire() {
    P.epoch++; P.token = ""; sessionStorage.removeItem(SESSION_KEY);
    clearData(); loginPage("", "登录已过期，请重新登录。");
  }
  function loadFailure(error) {
    P.ready = false; gate();
    document.getElementById("appMain").classList.remove("is-map");
    document.querySelectorAll(".page").forEach(el => { el.classList.toggle("is-active", el.id === "page-map"); el.innerHTML = ""; });
    document.getElementById("pageTitle").textContent = "连接后端";
    document.getElementById("page-map").innerHTML = '<section class="auth-card"><div class="auth-brand"><span class="auth-mark" aria-hidden="true"><img src="潘多拉-手账标记.svg" alt="" width="44" height="44"></span><span>潘多拉</span></div>' +
      '<div class="auth-copy"><h2>暂时无法打开工作台</h2><p>请检查网络连接后重试。</p></div><div class="callout" role="alert">' + esc(error.message) +
      '</div><div class="action-grid"><button class="btn primary" data-backend-retry>重新加载</button><button class="btn" data-backend-logout>退出登录</button></div><a class="auth-admin" href="/admin.html">进入管理后台</a></section>';
    P.notice("数据加载失败，请检查后端服务后重试。");
  }
  /* ------------------------------------------------------------------ *
   * Web-owned hour/minute control (chapter 4.2)
   *
   * Native input[type=time] opens the operating system's large clock dial on
   * mobile. This control is two ordinary selects, so it never hands the choice
   * to a platform dialog, keeps its value in the form draft, and is shared by
   * creation, modification and reopen. Values are still "HH:MM".
   * ------------------------------------------------------------------ */
  function timeParts(value) {
    const match = /^(\d{2}):(\d{2})$/.exec(String(value || ""));
    return match ? { hour: match[1], minute: match[2] } : { hour: "09", minute: "00" };
  }
  function options(list, selected) {
    return list.map(function (item) {
      return '<option value="' + item + '"' + (item === selected ? " selected" : "") + ">" + item + "</option>";
    }).join("");
  }
  function pad2(n) { return (n < 10 ? "0" : "") + n; }
  const HOURS = Array.from({ length: 24 }, function (_, i) { return pad2(i); });
  const MINUTES = Array.from({ length: 60 }, function (_, i) { return pad2(i); });
  P.timeControl = function (prefix, value) {
    const parts = timeParts(value);
    return '<div class="p-time" role="group" aria-label="时刻">' +
      '<select id="' + esc(prefix) + '-hour" data-time-part="hour" aria-label="小时">' + options(HOURS, parts.hour) + "</select>" +
      '<span class="p-time-sep" aria-hidden="true">:</span>' +
      '<select id="' + esc(prefix) + '-minute" data-time-part="minute" aria-label="分钟">' + options(MINUTES, parts.minute) + "</select>" +
      "</div>";
  };
  P.readTimeControl = function (prefix) {
    const hour = document.getElementById(prefix + "-hour");
    const minute = document.getElementById(prefix + "-minute");
    if (!hour || !minute) return "";
    return hour.value + ":" + minute.value;
  };
  P.request = async function (path, options) {
    const epoch = P.epoch;
    const opts = Object.assign({}, options || {});
    const headers = new Headers(opts.headers || {});
    headers.set("Accept", "application/json");
    if (P.token) headers.set("Authorization", "Bearer " + P.token);
    if (opts.body != null && typeof opts.body !== "string") {
      headers.set("Content-Type", "application/json"); opts.body = JSON.stringify(opts.body);
    } else if (opts.body != null) headers.set("Content-Type", "application/json");
    const controller = new AbortController(), externalSignal = opts.signal;
    const method = String(opts.method || "GET").toUpperCase();
    const saving = !["GET", "HEAD"].includes(method) && !path.startsWith("/auth/") && path !== "/tasks/reviewer-preview";
    const label = path === "/auth/sessions" && method === "POST" ? "正在登录，请稍候…"
      : path === "/auth/sessions/current" ? "正在退出登录…" : "正在加载，请稍候…";
    const finish = startLoading(label, saving);
    requests.add(controller);
    let timedOut = false;
    const timeout = setTimeout(() => { timedOut = true; controller.abort(); }, 20000);
    const abort = () => controller.abort();
    if (externalSignal) {
      if (externalSignal.aborted) controller.abort(); else externalSignal.addEventListener("abort", abort, { once: true });
    }
    try {
      let response, result;
      try {
        response = await fetch("/api/v1" + path, Object.assign(opts, { headers, signal: controller.signal, cache: "no-store" }));
        // Keep feedback and the timeout active while the response body is still arriving.
        try { result = await response.json(); }
        catch (error) { if (error.name === "AbortError") throw error; result = {}; }
      } catch (error) {
        if (epoch !== P.epoch || externalSignal?.aborted || (controller.signal.aborted && !timedOut)) throw cancelled();
        throw new Error(timedOut ? "请求超时。请重试，已提交的操作不会重复保存。" : "无法连接后端，请检查网络后重试。");
      }
      if (epoch !== P.epoch) throw cancelled();
      if (!response.ok) {
        if (response.status === 401 && path !== "/auth/sessions") expire();
        // The forced-change gate is enforced by the server; react to it instead of showing business UI.
        if (response.status === 403 && result.code === "PASSWORD_CHANGE_REQUIRED" && path !== "/auth/password") {
          P.ready = false; gate(); clearData();
          passwordPage("", "请先修改初始密码，修改成功后再进入业务页面。");
        }
        let message = result.message || "请求失败，请稍后重试。";
        if (response.status === 412) message = "这条记录已被更新。请关闭后重新打开，再提交修改。";
        throw Object.assign(new Error(message), { status: response.status, code: result.code, body: result });
      }
      return result;
    } finally {
      clearTimeout(timeout); externalSignal?.removeEventListener("abort", abort);
      requests.delete(controller); finish();
    }
  };
  P.mutation = async function (slot, method, path, body, etag) {
    const signature = JSON.stringify([method, path, body, etag]);
    let retry = retries.get(slot);
    if (!retry || retry.signature !== signature) {
      retry = { signature, key: crypto.randomUUID() }; retries.set(slot, retry);
    }
    const headers = { "Idempotency-Key": retry.key };
    if (etag != null) headers["If-Match"] = etag;
    return P.request(path, { method, body, headers });
  };
  /* Test/UX helper: a page command is idle when no P.busy operation owns the UI. */
  P.idle = function () { return !working && ![...loading.values()].some(item => item.epoch === P.epoch); };
  P.busy = async function (fn, errorId) {
    if (working) return;
    working = true;
    const command = activeCommand = { trigger: interactionTrigger, releaseButton: null };
    paintLoading();
    const errorEl = errorId && document.getElementById(errorId);
    if (errorEl) errorEl.hidden = true;
    try { return await fn(); }
    catch (error) {
      if (error.name === "AbortError") return;
      const el = errorId && document.getElementById(errorId);
      if (el) { el.textContent = error.message; el.hidden = false; el.scrollIntoView({ block: "nearest" }); }
      else if (P.ready && !overlayEl.hidden) {
        const el = document.createElement("div"); el.className = "callout"; el.setAttribute("role", "alert");
        el.textContent = error.message; sheetBodyEl.prepend(el);
      }
      P.notice(error.message);
    } finally {
      command.releaseButton?.();
      if (activeCommand === command) activeCommand = null;
      working = false; paintLoading();
    }
  };
  async function all(path) {
    const items = [];
    let offset = 0;
    for (;;) {
      const result = await P.request(path + (path.includes("?") ? "&" : "?") + "limit=100&offset=" + offset);
      items.push.apply(items, result.items || []);
      const next = result.nextOffset == null ? result.nextCursor : result.nextOffset;
      if (next == null) return items;
      if (Number(next) <= offset) throw new Error("分页数据异常，请重新加载。");
      offset = Number(next);
    }
  }
  function mapPerson(u) {
    /* departmentName is the real department; teamName is an independent team and must never stand in
       for it (a candidate list grouped by team would hide cross-department choices). */
    return { id: u.id, name: u.displayName || "相关人员", role: u.placementType || u.role || "employee",
      dept: u.departmentName || u.department || (u.placementType === "founder" ? "公司" : "—"), superiorId: u.managerId || null, raw: u };
  }
  // One company-calendar conversion shared by calendar, log and table projections.
  const companyFormatters=new Map(),dayBoundaryCache=new Map();
  P.companyZone=function(){return P.data?.me?.organizationTimeZone||P.data?.home?.timeZone||null;};
  P.companyParts=function(value,zone=P.companyZone()){
    if(!zone)throw new Error("公司时区尚未加载");
    if(!companyFormatters.has(zone))companyFormatters.set(zone,new Intl.DateTimeFormat('en-US',{timeZone:zone,year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit',hourCycle:'h23'}));
    const parts=companyFormatters.get(zone).formatToParts(new Date(value)),out={};parts.forEach(p=>out[p.type]=p.value);return out;
  };
  P.companyDateKey=function(value,zone){const p=P.companyParts(value,zone);return p.year+'-'+p.month+'-'+p.day;};
  P.companyDayStart=function(key,zone=P.companyZone()){
    const cacheKey=zone+':'+key;if(dayBoundaryCache.has(cacheKey))return new Date(dayBoundaryCache.get(cacheKey));
    const nominal=Date.parse(key+'T00:00:00Z');if(!Number.isFinite(nominal))throw new Error("无效业务日期");
    // First instant of the company date, including zones whose DST transition skips midnight.
    let low=nominal-36*3600000,high=nominal+36*3600000;
    while(high-low>1){const mid=Math.floor((low+high)/2);if(P.companyDateKey(mid,zone)<key)low=mid;else high=mid;}
    if(P.companyDateKey(high,zone)!==key)throw new Error("公司日期不存在");
    dayBoundaryCache.set(cacheKey,high);return new Date(high);
  };
  P.mapTask = function (t) {
    return { id: t.id || t.taskId, parentId: t.parentTaskId || null, title: t.title || "", desc: t.description || "",
      creatorId: t.originalCreatorId, businessOwnerId: t.businessOwnerId || t.originalCreatorId, assigneeIds: (t.assigneeIds || []).slice(), selfCreated: (t.assigneeIds || []).length === 1 && t.assigneeIds[0] === t.originalCreatorId,
      createdAt: new Date(t.createdAt), allDay: !!t.allDay,
      start: t.allDay ? parseISO(t.startDate) : new Date(t.startAt), due: t.allDay ? parseISO(t.dueDate) : new Date(t.dueAt),
      urgency: ({ urgent: "紧急", high: "高", medium: "中", low: "低" })[t.priority] || "中",
      status: t.executionState || "todo", progressNote: t.progressNote || "", reviewNote: "",
      frozen: !!t.frozen || !!t.pending, pinned: !!t.pinned, assignedAt: t.assignedAt || null,
      pendingKind: t.pendingKind || null, tag: t.tag || null, tagId: t.tagId || null,
      rowVersion: t.rowVersion, acceptanceCriteria: t.acceptanceCriteria || "", raw: t };
  };
  P.rememberPeople = function (rows) {
    (rows || []).forEach(u => { if (!personById(u.id)) PEOPLE.push(mapPerson(u)); });
  };
  P.upsertTask = function (raw) {
    P.rememberPeople(raw.participants);
    const t = P.mapTask(raw), index = TASKS.findIndex(x => x.id === t.id);
    if (raw.published === false) return t;
    if (index < 0) TASKS.push(t); else TASKS.splice(index, 1, t);
    P.taskEtags.set(t.id, version(raw)); return t;
  };
  /* Complete authorized task snapshot. A page failure rejects the whole snapshot, so callers never
     publish a partial page set as "complete"; the counters and the table must not see half the data. */
  async function loadTaskRows() {
    const epoch = P.epoch, sequence = ++taskSequence;
    const rows = await all("/tasks");
    if (epoch !== P.epoch || sequence !== taskSequence) throw cancelled();
    return { epoch, sequence, rows };
  }
  function taskSnapshotIsCurrent(snapshot) {
    return snapshot.epoch === P.epoch && snapshot.sequence === taskSequence;
  }
  /* One atomic replacement of the shared task set: dedupe by task id, keep the complete raw rows,
     rebuild the mapped TASKS and task ETags, and only add safe participant summaries. */
  function commitTaskRows(rows) {
    const unique = new Map();
    rows.forEach(raw => { if (raw && (raw.id || raw.taskId)) unique.set(raw.id || raw.taskId, raw); });
    const list = Array.from(unique.values());
    P.data.rawTasks = list;
    TASKS.splice(0, TASKS.length, ...list.map(P.mapTask));
    P.taskEtags.clear();
    list.forEach(raw => {
      P.taskEtags.set(raw.id || raw.taskId, version(raw));
      P.rememberPeople(raw.participants);
    });
    return list;
  }
  /* Independent refresh for the task form and calendar re-queries. It shares the epoch and the task
     request sequence with the initial load, so an older response can never replace a newer one. */
  P.refreshTasks = function () {
    return loadingGroup("正在更新任务，请稍候…", async () => {
      const snapshot = await loadTaskRows();
      if (!taskSnapshotIsCurrent(snapshot)) throw cancelled();
      return commitTaskRows(snapshot.rows);
    });
  };
  P.reload = function () { return loadingGroup("正在加载工作台，请稍候…", async () => {
    const epoch = P.epoch, sequence = ++reloadSequence;
    const me = await P.request("/me");
    if (me.role === "admin") throw new Error("此页面供业务账号使用。管理员请使用 /admin.html 管理端。");
    const tasks = loadTaskRows();
    const [users, logs, logAuthors, reports, approvals, notifications, home, analytics, tags, snapshot] = await Promise.all([
      all("/users"), all("/work-logs?scope=self"), P.request("/work-log-authors"), P.request("/me/reports"),
      all("/approval-requests?mine=all"), all("/notifications"), P.request("/home"), P.request("/analytics/task-summary?scope=visible"),
      P.request("/tags"), tasks
    ]);
    if (epoch !== P.epoch || sequence !== reloadSequence) throw cancelled();
    if (!taskSnapshotIsCurrent(snapshot)) throw cancelled();
    P.data = { me, users, rawTasks: snapshot.rows, approvals, home, analytics, logAuthors, reports, tags,
      calendarLogs: logs.slice() };
    // A data reload starts the log page on the default self scope; the page itself preserves
    // the user's search text and author selection until the next explicit reload.
    state.logDepartmentId = "__all__";
    state.logTeamId = "__all__";
    state.logAll = false;
    state.logAuthorId = me.id;
    state.logDepartmentQuery = ""; state.logTeamQuery = ""; state.logAuthorQuery = "";
    const people = new Map(users.map(u => [u.id, mapPerson(u)])); people.set(me.id, mapPerson(me));
    approvals.forEach(t => (t.participants || []).forEach(u => { if (!people.has(u.id)) people.set(u.id, mapPerson(u)); }));
    logs.forEach(l => { if (!people.has(l.authorId)) people.set(l.authorId, mapPerson({ id: l.authorId, displayName: l.authorName })); });
    PEOPLE.splice(0, PEOPLE.length, ...people.values());
    state.actorId = me.id; ROLE_ACCOUNT[me.role] = me.id;
    commitTaskRows(snapshot.rows);
    LOGS.splice(0, LOGS.length, ...logs.map(l => ({ id: l.id, authorId: l.authorId, time: new Date(l.createdAt), content: l.body, taskId: l.taskId || null, rowVersion: l.rowVersion, editable: l.editable, raw: l })));
    NOTIFICATIONS.splice(0, NOTIFICATIONS.length, ...notifications.map(n => ({ id: n.id, time: new Date(n.createdAt), summary: n.summary, type: n.eventType, recipients: [me.id], read: n.readAt ? [me.id] : [], targetType: "task", targetId: n.taskId, raw: n })));
    COMPANY_ITEMS.splice(0, COMPANY_ITEMS.length, ...home.companyItems.map(i => ({ id: i.id, text: i.body || i.title, raw: i })));
    PERSONAL_STATE[me.id] = { edited: true, items: home.personalItems.map(i => ({ id: i.id, text: i.body || i.title, raw: i })) };
    [[approvals, P.approvalEtags], [logs, P.logEtags], [notifications, P.notificationEtags]].forEach(([rows, map]) => { map.clear(); rows.forEach(row => map.set(row.id || row.taskId, version(row))); });
    retries.clear(); P.ready = true; gate(); renderAll();
    return P.data;
  }); };
  P.logout = async function () {
    if (P.token) await P.request("/auth/sessions/current", { method: "DELETE" });
    P.epoch++; P.token = ""; sessionStorage.removeItem(SESSION_KEY);
    clearData(); state.logFilter = "logs"; state.logsMineOnly = false; state.logAuthorQuery = "";
    state.logDepartmentId = "__all__";
    state.logAll = false; state.logAuthorId = null; state.pickerOpen = false;
    loginPage(""); P.notice("请使用本人手机号登录。");
  };
  visibleTasks = () => TASKS.slice();
  visibleLogs = () => LOGS.slice();
  assignablePeople = function (a) {
    return P.data.users.filter(u => u.active !== false).map(u => personById(u.id));
  };
  isOverdue = function (t) { return !isFinished(t) && (t.allDay ? new Date(t.raw.dueAt) : t.due) < new Date(); };
  const originalRender = renderAll;
  renderAll = function () { if (P.ready && actor()) originalRender(); };
  setRole = function (role) { P.busy(() => P.logout(({ upper: "upper", middle: "middle", lower: "employee" })[role])); };
  document.addEventListener("submit", function (event) {
    const submitter = event.submitter || event.target.querySelector("button[type=submit],input[type=submit]");
    if (working || buttonHolds.has(submitter)) { event.preventDefault(); event.stopImmediatePropagation(); return; }
    rememberTrigger(submitter);
  }, true);
  document.addEventListener("click", function (event) {
    const button = event.target.closest("button,input[type=submit]");
    if ((working && event.target.closest("button,a,input[type=submit]")) || buttonHolds.has(button)) { event.preventDefault(); event.stopImmediatePropagation(); return; }
    rememberTrigger(button);
    if (event.target.closest("[data-backend-logout]")) { event.stopImmediatePropagation(); P.busy(() => P.logout()); }
    if (event.target.closest("[data-backend-retry]")) { event.stopImmediatePropagation(); P.busy(async () => { try { await P.reload(); } catch (e) { loadFailure(e); throw e; } }); }
  }, true);
  clearData(); gate();
  document.addEventListener("DOMContentLoaded", function () {
    if (!P.token) { loginPage(); P.notice("请使用真实账号登录。"); return; }
    P.busy(async () => {
      try {
        // Ask for the identity first: a restricted session must never load the workspace.
        const identity = await P.request("/auth/session");
        if (identity.mustChangePassword) { passwordPage("", ""); P.notice("请先修改初始密码。"); return; }
        await P.reload();
      } catch (error) { if (P.token) loadFailure(error); throw error; }
    });
  });
})();
