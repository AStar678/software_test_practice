"use strict";
/* 后端适配层：沿用原型的渲染器和交互，仅替换数据来源与会话。 */
(function () {
  const SESSION_KEY = "pandora.backend.session";
  const P = window.Pandora = {
    epoch: 0, token: sessionStorage.getItem(SESSION_KEY) || "", ready: false,
    data: {}, taskEtags: new Map(), approvalEtags: new Map(),
    logEtags: new Map(), notificationEtags: new Map()
  };
  const retries = new Map();
  let working = false, reloadSequence = 0;
  const cancelled = () => Object.assign(new Error("账号已切换，请重新操作。"), { name: "AbortError" });
  const version = row => '"' + row.rowVersion + '"';
  const note = document.querySelector(".preview-note");
  note.setAttribute("role", "status");
  note.setAttribute("aria-live", "polite");
  P.notice = message => { note.textContent = message; };

  function clearData() {
    P.ready = false; P.data = {};
    [PEOPLE, TASKS, LOGS, NOTIFICATIONS, CONSULTATIONS, COMPANY_ITEMS].forEach(a => a.splice(0));
    Object.keys(PERSONAL_STATE).forEach(k => delete PERSONAL_STATE[k]);
    [P.taskEtags, P.approvalEtags, P.logEtags, P.notificationEtags].forEach(m => m.clear());
    retries.clear(); state.actorId = null;
    closeSheet();
    document.querySelectorAll(".page").forEach(el => { el.innerHTML = ""; });
    document.getElementById("bellDot").hidden = true;
    document.getElementById("whoami").textContent = "未登录";
  }
  function gate() {
    document.querySelectorAll("#tabbar button, #bellBtn").forEach(el => { el.disabled = !P.ready; });
    if (!P.ready) {
      document.querySelector(".phone").classList.remove("is-schedule");
      document.getElementById("appMain").classList.remove("is-schedule");
    }
  }
  function loginPage(username, message) {
    state.page = "map";
    document.querySelectorAll(".page").forEach(el => el.classList.toggle("is-active", el.id === "page-map"));
    document.getElementById("appMain").classList.remove("is-map");
    document.getElementById("pageTitle").textContent = "登录";
    document.querySelectorAll(".role-switch button").forEach(b => b.setAttribute("aria-pressed", "false"));
    document.getElementById("page-map").innerHTML = '<section class="card"><div class="card-head"><h2>登录潘多拉</h2></div>' +
      '<form id="backend-login"><div class="field"><label for="login-user">账号</label><input id="login-user" type="text" name="username" autocomplete="username" required value="' + esc(username || "upper") + '"></div>' +
      '<div class="field"><label for="login-password">密码</label><input id="login-password" name="password" type="password" autocomplete="current-password" required></div>' +
      '<p class="tiny muted">演示账号：upper / middle / employee<br>初始密码：Demo@123456</p>' +
      '<div class="callout" id="login-error"' + (message ? '' : ' hidden') + '>' + esc(message || "") + '</div>' +
      '<button type="submit" class="btn primary">登录</button></form></section>';
    gate();
    document.getElementById("backend-login").addEventListener("submit", event => {
      event.preventDefault();
      P.busy(async () => {
        const username = document.getElementById("login-user").value.trim();
        const password = document.getElementById("login-password").value;
        const result = await P.request("/auth/sessions", { method: "POST", body: { username, password } });
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
    document.getElementById("page-map").innerHTML = '<section class="card"><div class="card-head"><h2>首次登录必须修改密码</h2></div>' +
      '<p class="tiny muted">当前会话仅可修改密码或退出，业务数据在改密前不会加载。</p>' +
      '<form id="backend-password">' +
      '<div class="field"><label for="pw-current">当前密码</label><input id="pw-current" name="currentPassword" type="password" autocomplete="current-password" required></div>' +
      '<div class="field"><label for="pw-new">新密码</label><input id="pw-new" name="newPassword" type="password" autocomplete="new-password" required></div>' +
      '<div class="field"><label for="pw-confirm">确认新密码</label><input id="pw-confirm" type="password" autocomplete="new-password" required></div>' +
      '<p class="tiny muted">至少10个字符，须同时含字母和数字，UTF-8 长度不超过72字节。改密成功后所有会话失效，需重新登录。</p>' +
      '<div class="callout" id="password-error"' + (message ? '' : ' hidden') + '>' + esc(message || "") + '</div>' +
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
    document.getElementById("page-map").innerHTML = '<section class="card"><div class="callout">' + esc(error.message) +
      '</div><div class="row"><button class="btn primary" data-backend-retry>重新加载</button><button class="btn" data-backend-logout>切换账号</button></div></section>';
    P.notice("数据加载失败，请检查后端服务后重试。");
  }
  P.request = async function (path, options) {
    const epoch = P.epoch;
    const opts = Object.assign({}, options || {});
    const headers = new Headers(opts.headers || {});
    headers.set("Accept", "application/json");
    if (P.token) headers.set("Authorization", "Bearer " + P.token);
    if (opts.body != null && typeof opts.body !== "string") {
      headers.set("Content-Type", "application/json"); opts.body = JSON.stringify(opts.body);
    } else if (opts.body != null) headers.set("Content-Type", "application/json");
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 20000);
    let response;
    try { response = await fetch("/api/v1" + path, Object.assign(opts, { headers, signal: controller.signal, cache: "no-store" })); }
    catch (error) {
      if (epoch !== P.epoch) throw cancelled();
      throw new Error(error.name === "AbortError" ? "请求超时。请重试，已提交的操作不会重复保存。" : "无法连接本地后端，请确认服务已启动。");
    } finally { clearTimeout(timeout); }
    const result = await response.json().catch(() => ({}));
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
      throw Object.assign(new Error(message), { status: response.status, code: result.code });
    }
    return result;
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
  P.idle = function () { return !working; };
  P.busy = async function (fn, errorId) {
    if (working) return;
    working = true;
    document.querySelector(".app").setAttribute("aria-busy", "true");
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
    } finally { working = false; document.querySelector(".app").removeAttribute("aria-busy"); }
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
    return { id: u.id, name: u.displayName || "相关人员", role: u.role || "lower", dept: u.teamName || "", superiorId: u.managerId || null, raw: u };
  }
  P.mapTask = function (t) {
    return { id: t.id || t.taskId, parentId: t.parentTaskId || null, title: t.title || "", desc: t.description || "",
      creatorId: t.originalCreatorId, assigneeIds: (t.assigneeIds || []).slice(), selfCreated: (t.assigneeIds || []).length === 1 && t.assigneeIds[0] === t.originalCreatorId,
      createdAt: new Date(t.createdAt), allDay: !!t.allDay,
      start: t.allDay ? parseISO(t.startDate) : new Date(t.startAt), due: t.allDay ? parseISO(t.dueDate) : new Date(t.dueAt),
      urgency: ({ urgent: "紧急", high: "高", medium: "中", low: "低" })[t.priority] || "中",
      status: t.executionState || "todo", progressNote: t.progressNote || "", reviewNote: "",
      frozen: !!t.frozen || !!t.pending, rowVersion: t.rowVersion, acceptanceCriteria: t.acceptanceCriteria || "", raw: t };
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
  P.reload = async function () {
    const epoch = P.epoch, sequence = ++reloadSequence;
    const me = await P.request("/me");
    if (me.role === "admin") throw new Error("此页面供业务账号使用。管理员请使用 /debug.html 管理查询页。");
    const [users, tasks, logs, approvals, notifications, home, analytics] = await Promise.all([
      all("/users"), all("/tasks"), all("/work-logs?scope=visible"), all("/approval-requests?mine=all"),
      all("/notifications"), P.request("/home"), P.request("/analytics/task-summary?scope=visible")
    ]);
    if (epoch !== P.epoch || sequence !== reloadSequence) throw cancelled();
    P.data = { me, users, rawTasks: tasks, approvals, home, analytics };
    const people = new Map(users.map(u => [u.id, mapPerson(u)])); people.set(me.id, mapPerson(me));
    tasks.concat(approvals).forEach(t => (t.participants || []).forEach(u => { if (!people.has(u.id)) people.set(u.id, mapPerson(u)); }));
    logs.forEach(l => { if (!people.has(l.authorId)) people.set(l.authorId, mapPerson({ id: l.authorId, displayName: l.authorName })); });
    PEOPLE.splice(0, PEOPLE.length, ...people.values());
    state.actorId = me.id; ROLE_ACCOUNT[me.role] = me.id;
    TASKS.splice(0, TASKS.length, ...tasks.map(P.mapTask));
    LOGS.splice(0, LOGS.length, ...logs.map(l => ({ id: l.id, authorId: l.authorId, time: new Date(l.createdAt), content: l.body, taskId: l.taskId || null, rowVersion: l.rowVersion, editable: l.editable, raw: l })));
    NOTIFICATIONS.splice(0, NOTIFICATIONS.length, ...notifications.map(n => ({ id: n.id, time: new Date(n.createdAt), summary: n.summary, type: n.eventType, recipients: [me.id], read: n.readAt ? [me.id] : [], targetType: "task", targetId: n.taskId, raw: n })));
    COMPANY_ITEMS.splice(0, COMPANY_ITEMS.length, ...home.companyItems.map(i => ({ id: i.id, text: i.body || i.title, raw: i })));
    PERSONAL_STATE[me.id] = { edited: true, items: home.personalItems.map(i => ({ id: i.id, text: i.body || i.title, raw: i })) };
    [[tasks, P.taskEtags], [approvals, P.approvalEtags], [logs, P.logEtags], [notifications, P.notificationEtags]].forEach(([rows, map]) => { map.clear(); rows.forEach(row => map.set(row.id || row.taskId, version(row))); });
    retries.clear(); P.ready = true; gate(); renderAll();
    P.notice("已连接本地数据库 · " + me.displayName);
    return P.data;
  };
  P.logout = async function (username) {
    if (P.token) await P.request("/auth/sessions/current", { method: "DELETE" });
    P.epoch++; P.token = ""; sessionStorage.removeItem(SESSION_KEY);
    clearData(); state.logFilter = "logs"; state.logsMineOnly = false; state.logAuthorQuery = ""; state.pickerOpen = false;
    loginPage(typeof username === "string" ? username : "upper"); P.notice("请使用真实账号登录。");
  };
  visibleTasks = () => TASKS.slice();
  visibleLogs = () => LOGS.slice();
  assignablePeople = function (a) {
    return P.data.users.filter(u => u.id === a.id || a.role === "upper" || (a.role === "middle" && u.role === "lower" && u.teamId === P.data.me.teamId)).map(u => personById(u.id));
  };
  isOverdue = function (t) { return !isFinished(t) && (t.allDay ? new Date(t.raw.dueAt) : t.due) < new Date(); };
  const originalRender = renderAll;
  renderAll = function () { if (P.ready && actor()) originalRender(); };
  setRole = function (role) { P.busy(() => P.logout(({ upper: "upper", middle: "middle", lower: "employee" })[role])); };
  document.addEventListener("click", function (event) {
    if (working && event.target.closest("button,a,input[type=submit]")) { event.preventDefault(); event.stopImmediatePropagation(); return; }
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
