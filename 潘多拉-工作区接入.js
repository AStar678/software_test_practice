"use strict";
/* 原型工作区适配：沿用原布局、选择器和弹层，写入由后端校验权限与版本。 */
(function () {
  const P = window.Pandora;
  if (!P) return;
  const version = row => '"' + row.rowVersion + '"';
  const endpoint = id => encodeURIComponent(id);
  let logSnapshot = null, notificationSnapshot = null, analysis = null;
  const homeVersions = new Map();
  const oldMap = renderMap;
  const oldLogForm = logFormView;
  const oldPersonalForm = personalItemFormView;
  const oldDeleteView = confirmDeleteView;
  const oldActions = runAction;
  const oldNotifications = openNotifications;

  function homeRow(kind, id) {
    const home = P.data.home || {};
    return (kind === "company" ? home.companyItems || [] : home.personalItems || []).find(row => row.id === id);
  }
  function rememberHome(kind, id) {
    if (!id) return;
    const row = homeRow(kind, id);
    if (row) homeVersions.set(kind + ":" + id, { epoch: P.epoch, etag: version(row) });
  }
  function homeVersion(kind, id) {
    const saved = homeVersions.get(kind + ":" + id);
    if (!saved || saved.epoch !== P.epoch) throw new Error("请重新打开这条信息后再操作。");
    return saved.etag;
  }
  function putLog(raw) {
    const value = { id: raw.id, authorId: raw.authorId, time: new Date(raw.createdAt), content: raw.body,
      taskId: raw.taskId || null, rowVersion: raw.rowVersion, editable: raw.editable, raw };
    const index = LOGS.findIndex(l => l.id === raw.id);
    if (index < 0) LOGS.push(value); else LOGS.splice(index, 1, value);
    P.logEtags.set(raw.id, version(raw));
    return value;
  }
  function button(action, label, id, extraClass) {
    return '<button type="button" class="btn ' + (extraClass || "") + '" data-action="' + action + '"' +
      (id ? ' data-id="' + esc(id) + '"' : '') + '>' + esc(label) + '</button>';
  }
  function timeText(value) {
    const date = new Date(value);
    return isNaN(date.getTime()) ? "—" : date.getFullYear() + "年" + fmtDateTime(date);
  }
  function approvals(filter) {
    const me = P.data.me || {};
    return (P.data.approvals || []).filter(r => filter === "reviews"
      ? r.status === "pending" && r.currentReviewerId === me.id : r.applicantId === me.id);
  }

  personalItemsFor = function (pid) {
    if (!P.data.me || P.data.me.id !== pid) return [];
    return ((P.data.home || {}).personalItems || []).map(row => ({ id: row.id, text: row.body || row.title, raw: row }));
  };
  renderMap = function () {
    oldMap();
    const home = P.data.home || {};
    const quads = document.querySelectorAll("#page-map .quad");
    if (quads[0]) {
      const items = home.companyItems || [];
      quads[0].innerHTML = '<div class="card-head"><h2 id="q1">公司统一信息</h2><span class="hint">统一发布</span></div>' +
        '<div class="q-body">' + (items.length ? items.map((item, index) =>
          '<div class="item-line"><div class="item-main"><span class="idx">' + (index + 1) + '</span><span class="txt">' +
          esc(item.body || item.title) + '</span></div></div>'
        ).join("") : '<div class="empty">暂无公司信息</div>') + '</div>';
    }
    if (quads[2]) quads[2].querySelector(".hint").textContent = (home.personalItems || []).length + "/10 · 本人维护";
    if (quads[3]) {
      quads[3].querySelector("h2").textContent = "近十天日志";
      quads[3].querySelector(".hint").textContent = "最近10条";
      const logs = home.recentLogs || [];
      quads[3].querySelector(".q-body").innerHTML = logs.length ? logs.map(l =>
        '<button type="button" class="log-line" data-log="' + esc(l.id) + '"><span class="lt">' + esc(l.businessDate) +
        '</span><span class="lc">' + esc(l.body) + '</span></button>'
      ).join("") : '<div class="empty">近十天暂无日志</div>';
    }
  };

  LOG_FILTER_LABEL.logs = "工作日志";
  function logAuthors() { return (P.data.logAuthors || {}).items || []; }
  function logTree() { return (P.data.logAuthors || {}).tree || []; }
  function logAuthorId() {
    if (state.logAll) return null;
    return state.logAuthorId || (P.data.me || {}).id || null;
  }
  function logScopeLabel(a) {
    if (state.logAll) return "权限内全部 · " + visibleLogs(a).length + " 条";
    const id = logAuthorId();
    if (id && id === (P.data.me || {}).id) return "本人日志 · " + visibleLogs(a).length + " 条";
    const person = logAuthors().find(row => row.id === id);
    return (person ? person.displayName : "所选人员") + " 的日志 · " + visibleLogs(a).length + " 条";
  }
  filteredLogs = function (a) {
    const authorId = logAuthorId();
    return visibleLogs(a)
      .filter(l => !authorId || l.authorId === authorId)
      .slice().sort((x, y) => y.time.getTime() - x.time.getTime());
  };
  function replaceLogs(items) {
    LOGS.splice(0, LOGS.length, ...items.map(l => ({
      id: l.id, authorId: l.authorId, time: new Date(l.createdAt), content: l.body,
      taskId: l.taskId || null, rowVersion: l.rowVersion, editable: l.editable, raw: l
    })));
    P.logEtags.clear();
    items.forEach(l => P.logEtags.set(l.id, version(l)));
  }
  async function loadLogs(path) {
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
  async function applyLogAuthor(id, all) {
    const me = (P.data.me || {}).id;
    const authorId = all ? null : id;
    const scope = all || authorId !== me ? "visible" : "self";
    const items = await loadLogs("/work-logs?scope=" + scope + (authorId ? "&authorId=" + endpoint(authorId) : ""));
    replaceLogs(items);
    state.logAll = !!all;
    state.logAuthorId = authorId || me;
    refreshLogResults();
  }
  function selectLogAuthor(id, all) {
    return P.busy(async function () {
      await applyLogAuthor(id, all);
      P.notice(state.logAll ? "已切换到权限内全部日志。" : "已切换到所选人员的日志。");
    });
  }
  P.openLogsFor = async function (id) {
    await applyLogAuthor(id, false);
    setPage("log");
  };
  function filterAuthorTree(nodes, query) {
    if (!query) return nodes;
    return nodes.map(node => {
      const children = filterAuthorTree(node.children || [], query);
      const match = String(node.displayName || "").toLowerCase().indexOf(query) !== -1;
      if (!match && !children.length) return null;
      return Object.assign({}, node, { children: children });
    }).filter(Boolean);
  }
  function authorTreeHTML(nodes) {
    if (!nodes.length) return '<div class="empty">没有符合当前查找条件的日志人员</div>';
    return '<ul class="log-author-tree">' + nodes.map(node => {
      const active = !state.logAll && node.id === logAuthorId();
      return '<li><button type="button" class="log-author" data-log-author="' + esc(node.id) +
        '" aria-pressed="' + active + '"><span class="log-author-name">' + esc(node.displayName) +
        '</span>' + (node.departmentName ? '<span class="tiny muted">' + esc(node.departmentName) + '</span>' : '') +
        '</button>' + ((node.children || []).length ? authorTreeHTML(node.children) : '') + '</li>';
    }).join("") + '</ul>';
  }
  function logFindingHTML(a) {
    const query = String(state.logAuthorQuery || "").trim().toLowerCase();
    const authors = logAuthors();
    const tree = filterAuthorTree(logTree(), query);
    return '<section class="card" id="logFindingCard"><div class="card-head"><h2>日志人员</h2>' +
      '<span class="hint">仅限日志权限范围</span></div>' +
      (authors.length > 1 ? '<button type="button" class="filter-chip" data-log-all="true" aria-pressed="' +
        String(!!state.logAll) + '">全部可见</button>' : '') +
      '<div class="field" style="margin-top:8px"><label for="logAuthorInput">按作者姓名查找</label>' +
        '<div class="row"><input id="logAuthorInput" type="search" autocomplete="off" placeholder="输入作者姓名片段" value="' +
          esc(state.logAuthorQuery || '') + '" />' +
          '<button type="button" class="btn tiny-btn" id="clearLogAuthor" data-action="clear-log-author"' +
          (state.logAuthorQuery ? '' : ' disabled') + ' aria-label="清除作者查找">清除</button></div></div>' +
      '<div id="logAuthorList">' + authorTreeHTML(tree) + '</div></section>';
  }
  renderLog = function () {
    const a = actor();
    document.getElementById("page-log").innerHTML =
      '<header class="p-log-header"><h2>工作记录</h2>' + button("new-log", "写日志", null, "primary") + '</header>' +
      logFindingHTML(a) +
      '<section class="card p-log-panel" id="p-log-panel"><div class="card-head"><h2>日志</h2>' +
        '<span class="hint" id="logResultsCount">' + esc(logScopeLabel(a)) + '</span></div>' +
        '<div id="logResults">' + logsListHTML(a) + '</div></section>';
  };
  refreshLogResults = function () {
    const a = actor();
    const results = document.getElementById("logResults");
    if (results) results.innerHTML = logsListHTML(a);
    const count = document.getElementById("logResultsCount");
    if (count) count.textContent = logScopeLabel(a);
    const list = document.getElementById("logAuthorList");
    if (list) list.innerHTML = authorTreeHTML(filterAuthorTree(logTree(), String(state.logAuthorQuery || "").trim().toLowerCase()));
    const all = document.querySelector("[data-log-all]");
    if (all) all.setAttribute("aria-pressed", String(!!state.logAll));
    const clear = document.getElementById("clearLogAuthor");
    if (clear) clear.disabled = !state.logAuthorQuery;
  };
  document.addEventListener("click", function (event) {
    if (!P.ready || state.page !== "log") return;
    const author = event.target.closest("[data-log-author]");
    if (author) {
      event.preventDefault();
      selectLogAuthor(author.dataset.logAuthor, false);
      return;
    }
    const all = event.target.closest("[data-log-all]");
    if (all) {
      event.preventDefault();
      selectLogAuthor(null, true);
    }
  });

  logDetailView = function (id) {
    const l = logById(id);
    if (!l) return null;
    const t = l.taskId ? taskById(l.taskId) : null;
    const name = l.raw.authorName || (personById(l.authorId) || {}).name || "相关人员";
    return { title: "日志详情", body: '<div class="kv"><span class="k">作者</span><span class="v">' + esc(name) +
      '</span><span class="k">记录日期</span><span class="v">' + esc(l.raw.businessDate) +
      '</span><span class="k">创建时间</span><span class="v">' + esc(timeText(l.raw.createdAt)) +
      '</span><span class="k">编辑权限</span><span class="v">' + (l.editable ? "本人可编辑" : "仅作者可编辑，当前为只读") +
      '</span></div><div class="divider"></div><p style="white-space:pre-wrap;overflow-wrap:anywhere">' + esc(l.content) + '</p>' +
      (t ? '<div class="divider"></div><button type="button" class="btn" data-task="' + esc(t.id) + '">关联：' + esc(t.title) + '</button>' : ''),
      foot: withBack((l.editable ? button("edit-log", "编辑日志", id, "primary") : "") + button("sheet-close", "关闭"), actor()) };
  };
  openLogDetail = function (id) {
    P.busy(async () => {
      const raw = await P.request("/work-logs/" + endpoint(id));
      putLog(raw); logSnapshot = { raw, epoch: P.epoch };
      openSheet(logDetailView(id));
    });
  };
  function logDraft(raw) {
    return { id: raw ? raw.id : null, content: raw ? raw.body : "", taskId: raw ? raw.taskId || null : null,
      originalTaskId: raw ? raw.taskId || null : null, relationshipChanged: false,
      hiddenTask: !!raw && !Object.prototype.hasOwnProperty.call(raw, "taskId"),
      etag: raw ? version(raw) : null, epoch: P.epoch, businessDate: raw ? raw.businessDate : null };
  }
  openLogForm = function (id) {
    P.busy(async () => {
      let raw = null;
      if (id) {
        raw = logSnapshot && logSnapshot.epoch === P.epoch && logSnapshot.raw.id === id && sheetTitleEl.textContent === "日志详情"
          ? logSnapshot.raw : await P.request("/work-logs/" + endpoint(id));
        if (!raw.editable) throw new Error("该日志已只读，不能再编辑。");
        putLog(raw);
      } else {
        // Writing always edits today's unique record instead of creating a second copy.
        const today = (P.data.home || {}).businessDate;
        const existing = await P.request("/work-logs?scope=self&from=" + encodeURIComponent(today) +
          "&to=" + encodeURIComponent(today) + "&limit=1");
        raw = (existing.items || [])[0] || null;
        if (raw) putLog(raw);
      }
      drafts.log = logDraft(raw);
      openSheet(logFormView());
    });
  };
  logFormView = function () {
    const view = oldLogForm();
    if (view) {
      view.body = view.body.replace('id="lf-content"', 'id="lf-content" maxlength="10000"');
      if (drafts.log.hiddenTask && !drafts.log.taskId && !drafts.log.relationshipChanged)
        view.body = view.body.replace("未关联任务", "关联任务当前不可见，保留原关系");
    }
    return view;
  };
  saveLog = function () {
    P.busy(async () => {
      syncLogDraft();
      const d = drafts.log;
      if (!d || d.epoch !== P.epoch) throw new Error("请重新打开日志后再保存。");
      const content = String(d.content || "").trim();
      if (!content) throw new Error("请填写日志内容。");
      const body = { body: content };
      if (!d.id || d.relationshipChanged || d.taskId !== d.originalTaskId) body.taskId = d.taskId || null;
      try {
        await P.mutation("work-log:" + (d.id || "new"), d.id ? "PATCH" : "POST",
          "/work-logs" + (d.id ? "/" + endpoint(d.id) : ""), body, d.etag);
      } catch (error) {
        if (!d.id && error.code === "WORK_LOG_EXISTS" && error.body && error.body.logId) {
          const raw = await P.request("/work-logs/" + endpoint(error.body.logId));
          putLog(raw);
          drafts.log = logDraft(raw);
          replaceTopSheet(logFormView());
          P.notice("今天已有日志，已打开已有记录继续编辑。");
          return;
        }
        if (error.code === "WORK_LOG_FROZEN") {
          await P.reload();
          closeSheet();
          P.notice("该日志已冻结，只能查看。");
          return;
        }
        throw error;
      }
      await P.reload(); closeSheet(); P.notice("日志已保存。");
    }, "lf-error");
  };

  companyItemFormView = () => null;
  personalItemFormView = function (id) {
    rememberHome("personal", id);
    const view = oldPersonalForm(id);
    if (view) view.body = view.body.replace('id="pi-text"', 'id="pi-text" maxlength="2000"')
      .replace("个人信息由本人维护，默认取自本人日志摘录，编辑个人信息不会改写原始日志。", "个人信息由本人维护，最多 10 条，独立保存，不会改写日志。");
    return view;
  };
  confirmDeleteView = function (kind, id) {
    if (kind === "company") return null;
    rememberHome(kind, id);
    const view = oldDeleteView(kind, id);
    if (view) view.body += '<div class="callout" id="home-delete-error" hidden></div>';
    return view;
  };
  function openHomeItem(kind, id, deleting) {
    if (kind === "company") { P.notice("公司统一信息由管理端统一发布。"); return; }
    P.busy(async () => {
      const raw = await P.request("/home/items/" + endpoint(id));
      const key = kind === "company" ? "companyItems" : "personalItems";
      const rows = P.data.home[key];
      const index = rows.findIndex(row => row.id === id);
      if (index < 0) rows.push(raw); else rows.splice(index, 1, raw);
      if (kind === "company") {
        const mapped = { id: raw.id, text: raw.body || raw.title, raw };
        const position = COMPANY_ITEMS.findIndex(row => row.id === id);
        if (position < 0) COMPANY_ITEMS.push(mapped); else COMPANY_ITEMS.splice(position, 1, mapped);
      } else PERSONAL_STATE[P.data.me.id] = { edited: true, items: personalItemsFor(P.data.me.id) };
      renderAll();
      const view = deleting ? confirmDeleteView(kind, id) : kind === "company" ? companyItemFormView(id) : personalItemFormView(id);
      if (view) openSheet(view);
    });
  }
  // Fetch the record when opening; submission retains this snapshot even if a later reload occurs.
  document.addEventListener("click", function (event) {
    const el = event.target.closest("[data-edit-company],[data-edit-personal],[data-delete-company],[data-delete-personal],[data-action='delete-company'],[data-action='delete-personal']");
    if (!el || !P.ready) return;
    event.preventDefault(); event.stopImmediatePropagation();
    if (el.dataset.editCompany || el.dataset.deleteCompany || el.dataset.action === "delete-company") {
      P.notice("公司统一信息由管理端统一发布。"); return;
    }
    if (el.dataset.editPersonal) openHomeItem("personal", el.dataset.editPersonal, false);
    else if (el.dataset.deletePersonal) openHomeItem("personal", el.dataset.deletePersonal, true);
    else openHomeItem(el.dataset.action === "delete-company" ? "company" : "personal", el.dataset.id, true);
  }, true);
  function saveHome(kind, id) {
    if (kind === "company") { P.notice("公司统一信息由管理端统一发布。"); return; }
    const prefix = kind === "company" ? "ci" : "pi";
    P.busy(async () => {
      const content = document.getElementById(prefix + "-text").value.trim();
      if (!content) throw new Error("内容不能为空。");
      const body = { body: content };
      if (!id) body.kind = kind;
      await P.mutation("home:" + kind + ":" + (id || "new"), id ? "PATCH" : "POST", "/home/items" + (id ? "/" + endpoint(id) : ""), body, id ? homeVersion(kind, id) : null);
      await P.reload(); closeSheet(); P.notice("信息已保存。");
    }, prefix + "-error");
  }
  saveCompanyItem = () => P.notice("公司统一信息由管理端统一发布。");
  savePersonalItem = id => saveHome("personal", id);
  deleteItem = function (kind, id) {
    if (kind === "company") { P.notice("公司统一信息由管理端统一发布。"); return; }
    P.busy(async () => {
      await P.mutation("home-delete:" + id, "DELETE", "/home/items/" + endpoint(id), null, homeVersion(kind, id));
      await P.reload(); closeSheet(); P.notice("信息已删除。");
    }, "home-delete-error");
  };

  const REQUEST_KIND = { create: "创建任务", change: "修改资料", progress: "更新进展", complete: "提交完成", reopen: "重开任务", handover: "交接" };
  const REQUEST_RESULT = { pending: "待审核", approved: "已通过", rejected: "已退回", withdrawn: "已撤销", direct: "已生效", expired: "已失效" };
  notificationsFor = () => NOTIFICATIONS.slice().sort((a, b) => b.time - a.time);
  unreadCount = () => NOTIFICATIONS.filter(n => !n.raw.readAt).length;
  notificationsView = function () {
    const list = notificationsFor();
    return { title: "通知", body: list.length ? list.map(n => {
      const raw = n.raw, title = raw.title || raw.summary || "通知";
      const state = raw.revoked ? "已撤回" : raw.relationLost ? "权限已变化" : raw.readAt ? "已读" : "未读";
      return '<button type="button" class="notif' + (raw.readAt ? ' is-read' : '') + (raw.revoked ? ' is-withdrawn' : '') +
        '" data-action="open-notif" data-id="' + esc(n.id) + '"><span class="ndot" aria-hidden="true"></span><span class="nbody"><span class="ntitle">' +
        esc(title) + '</span><span class="nmeta">' + esc(timeText(raw.createdAt)) + " · " + esc(state) + '</span></span></button>';
    }).join("") : '<div class="empty">暂无通知</div>' };
  };
  openNotifications = function () {
    P.busy(async () => { await P.reload(); openSheet(notificationsView()); });
  };
  function requestResultText(raw) {
    if (!raw.requestId) return "";
    const kind = REQUEST_KIND[raw.requestKind] || "任务申请";
    const result = REQUEST_RESULT[raw.requestStatus] || raw.requestStatus || "已处理";
    return kind + " · " + result + (raw.requestStatus === "pending" ? "" : "（已办结，不再提供审核按钮）");
  }
  function notificationView(raw) {
    const revoked = !!raw.revoked;
    let body = '<div class="kv"><span class="k">时间</span><span class="v">' + esc(timeText(raw.createdAt)) +
      '</span><span class="k">状态</span><span class="v">' + (revoked ? "已撤回" : raw.readAt ? "已读" : "未读") + '</span></div>';
    if (revoked) {
      body += '<div class="divider"></div><p>该通知已被撤回。</p>';
    } else {
      if (raw.title) body += '<div class="card-head"><h2>' + esc(raw.title) + '</h2></div>';
      body += '<p style="white-space:pre-wrap;overflow-wrap:anywhere">' + esc(raw.summary || "") + '</p>';
      if (raw.changeSummary && raw.changeSummary !== raw.summary) body += '<p class="tiny muted" style="white-space:pre-wrap">' + esc(raw.changeSummary) + '</p>';
      if (raw.requestId) body += '<div class="callout info">原申请：' + esc(requestResultText(raw)) + '</div>';
      if (raw.relationLost) body += '<div class="callout info">你已不再是该任务负责人；此消息仅保留只读摘要，不能用于修改或审核。</div>';
    }
    body += '<div class="callout" id="notification-error" hidden></div>';
    const buttons = [];
    if (!revoked && raw.requestId) buttons.push(button("p-open-approval", raw.canReview ? "审核此申请" : "查看原申请结果", raw.requestId, raw.canReview ? "primary" : ""));
    if (!revoked && raw.taskId) buttons.push(raw.relationLost || raw.readonly
      ? button("p-open-historical-task", "查看历史只读详情", raw.id)
      : button("p-open-notification-task", "查看相关任务", raw.id));
    if (!revoked && raw.canWithdraw) buttons.push(button("p-withdraw-notification", "撤回通知", raw.id));
    if (!revoked) buttons.push(button("p-hide-notification", "删除此消息", raw.id));
    buttons.push(button("sheet-close", "关闭"));
    return { title: "通知详情", body: body, foot: withBack(buttons.join(""), actor()) };
  }
  function historicalTaskView(raw) {
    const rows = [["标题", raw.title], ["说明", raw.description], ["完成标准", raw.acceptanceCriteria],
      ["紧急程度", ({ urgent: "紧急", high: "高", medium: "中", low: "低" })[raw.priority] || raw.priority],
      ["排期", raw.allDay ? (raw.startDate + " 至 " + raw.dueDate) : (timeText(raw.startAt) + " 至 " + timeText(raw.dueAt))],
      ["负责人", (raw.assignees || []).map(person => person.displayName).join("、")],
      ["执行状态", ({ todo: "待开始", doing: "进行中", done: "已完成" })[raw.executionState] || raw.executionState],
      ["当前进展", raw.progressNote || "暂无"]];
    return { title: "历史只读详情", body: '<div class="callout info">' + esc(raw.notice || "该页仅提供只读摘要。") + '</div>' +
      rows.map(([key, value]) => '<div class="profile-row"><span class="k">' + esc(key) + '</span><span class="v" style="min-width:0;overflow-wrap:anywhere">' + esc(value == null || value === "" ? "—" : value) + '</span></div>').join(""),
      foot: withBack(button("sheet-close", "关闭"), actor()) };
  }
  openNotif = function (id) {
    P.busy(async () => {
      await P.mutation("notification-open:" + id, "POST", "/notifications/" + endpoint(id) + "/open");
      await P.reload();
      const raw = NOTIFICATIONS.find(n => n.id === id);
      if (!raw) throw new Error("该通知已不可用。");
      notificationSnapshot = { raw: raw.raw, etag: version(raw.raw), epoch: P.epoch };
      openSheet(notificationView(raw.raw));
    }, "notification-error");
  };
  function deleteNotification(id) {
    P.busy(async () => {
      const snapshot = notificationSnapshot;
      if (!snapshot || snapshot.epoch !== P.epoch || snapshot.raw.id !== id) throw new Error("请重新打开通知后再操作。");
      await P.mutation("notification-delete:" + id, "PATCH", "/notifications/" + endpoint(id),
        { action: "delete" }, snapshot.etag);
      await P.reload(); closeSheet(); openSheet(notificationsView()); P.notice("通知已删除。");
    }, "notification-error");
  }
  function withdrawNotification(id) {
    P.busy(async () => {
      const snapshot = notificationSnapshot;
      if (!snapshot || snapshot.epoch !== P.epoch || snapshot.raw.id !== id) throw new Error("请重新打开通知后再操作。");
      await P.mutation("notification-withdraw:" + id, "POST", "/notifications/" + endpoint(id) + "/withdraw",
        { reason: "发起人撤回" });
      await P.reload(); closeSheet(); openSheet(notificationsView()); P.notice("通知已撤回，业务结果不变。");
    }, "notification-error");
  }
  function openNotificationTask(id) {
    const snapshot = notificationSnapshot;
    if (!snapshot || snapshot.raw.id !== id || !snapshot.raw.taskId) { P.notice("该消息没有可查看的任务。"); return; }
    openTaskDetail(snapshot.raw.taskId);
  }
  function openHistoricalTask(id) {
    P.busy(async () => {
      const raw = await P.request("/notifications/" + endpoint(id) + "/task");
      openSheet(historicalTaskView(raw));
    }, "notification-error");
  }
  document.getElementById("bellBtn").removeEventListener("click", oldNotifications);
  document.getElementById("bellBtn").addEventListener("click", openNotifications);

  renderAI = function () {
    const stat = P.data.analytics || {};
    const labels = [["任务总数","total"],["进行中","doing"],["待开始","todo"],["已完成","done"],["待审冻结","frozen"],["已逾期","overdue"]];
    const visibleIds = new Set(TASKS.map(task => task.id));
    if (analysis && (analysis.epoch !== P.epoch || analysis.sourceIds.some(id => !visibleIds.has(id)))) analysis = null;
    const result = analysis && analysis.epoch === P.epoch ? analysis.result : null;
    const suggestions = result ? result.suggestions || [] : [];
    const words = keywordStats(TASKS);
    const maxCount = words.length ? words[0].n : 1;
    const cloud = words.length ? words.map(w => '<span style="font-size:' + (12 + Math.round(w.n / maxCount * 8)) +
      'px;font-weight:' + (w.n > 1 ? 700 : 500) + ';color:' + (w.n > 1 ? '#1d4ed8' : '#4b5563') + '" title="' +
      esc(w.word + "：出现 " + w.n + " 次") + '">' + esc(w.word) + '</span>').join("") : '<span class="tiny muted">范围内暂无可提取的关键词</span>';
    document.getElementById("page-ai").innerHTML =
      '<section class="card"><div class="card-head"><h2>任务数据统计</h2><span class="hint">当前可见范围</span></div><div class="stat-grid">' +
      labels.map(([label,key]) => '<div class="stat"><div class="v">' + esc(stat[key] == null ? "—" : stat[key]) + '</div><div class="k">' + label + '</div></div>').join("") +
      '</div><p class="tiny muted">更新于 ' + esc(timeText(stat.generatedAt)) + '</p></section>' +
      '<section class="card"><div class="card-head"><h2>关键词词云</h2><span class="hint">当前可见任务</span></div><div class="wc">' + cloud + '</div></section>' +
      '<section class="card"><div class="card-head"><h2>AI 建议</h2><span class="hint">规则分析 · rule_based</span></div><p class="tiny muted">根据当前可见任务的截止时间生成提醒建议，未调用 AI 模型。分析不会修改任务。</p>' +
      '<div class="action-grid">' + button("p-generate-analysis", result ? "重新生成摘要" : "生成分析摘要", null, "primary") + button("p-refresh-workspace", "刷新数据") +
      '</div><div class="callout" id="analysis-error" hidden></div>' +
      (result ? '<p class="tiny muted">生成于 ' + esc(timeText(result.generatedAt)) + '</p><div class="advice">本次分析包含 ' + esc(result.summary.total) + ' 项任务，已完成 ' + esc(result.summary.done) + ' 项，待审冻结 ' + esc(result.summary.frozen) + ' 项。</div>' +
        (suggestions.length ? suggestions.map(s => '<div class="advice"><strong>' + esc(s.title) + '</strong><p>' + esc(s.message) + '</p>' +
          (taskById(s.taskId) ? '<button type="button" class="btn tiny-btn" data-task="' + esc(s.taskId) + '">查看任务</button>' : '') + '</div>').join("") : '<div class="empty">当前没有临期或逾期的可执行任务建议</div>')
        : '<div class="empty">点击“生成分析摘要”，查看基于真实任务的建议</div>') + '</section>';
  };
  function generateAnalysis() {
    P.busy(async () => {
      const sourceIds = TASKS.map(task => task.id);
      const job = await P.mutation("ai-job", "POST", "/ai-jobs", { scopeType: "visible" });
      const saved = await P.request("/ai-jobs/" + endpoint(job.jobId));
      analysis = { epoch: P.epoch, result: saved.result,
        sourceIds: Array.from(new Set(sourceIds.concat((saved.result.suggestions || []).map(s => s.taskId)))) };
      await P.reload();
      if (analysis && analysis.result === saved.result)
        analysis.sourceIds = Array.from(new Set(analysis.sourceIds.concat(TASKS.map(task => task.id))));
      P.notice("规则分析已生成并保存。");
    }, "analysis-error");
  }
  renderMe = function () {
    const me = P.data.me || {}, superior = personById(me.managerId);
    const rows = [["姓名",me.displayName],["账号",me.username],["部门",me.teamName || "未分配"],["角色",ROLE_LABEL[me.role] || me.role],["直属上级",superior ? superior.name : me.managerId ? "资料不在当前可见范围" : "无"]];
    document.getElementById("page-me").innerHTML = '<section class="card profile-card"><div class="profile-row"><div class="avatar">' +
      esc((me.displayName || "").slice(0,1)) + '</div><div><div class="v">' + esc(me.displayName) + '</div><div class="tiny muted">当前登录账号</div></div></div>' +
      rows.map(([key,value]) => '<div class="profile-row"><span class="k">' + key + '</span><span class="v">' + esc(value) + '</span></div>').join("") +
      '</section><section class="card"><div class="card-head"><h2>账号与数据</h2></div><div class="action-grid">' + button("p-refresh-workspace", "刷新数据", null, "primary") + button("p-logout", "退出登录") + '</div></section>';
  };

  runAction = function (el) {
    switch (el.dataset.action) {
      case "new-company": case "edit-company": case "save-company": case "delete-company":
        P.notice("公司统一信息由管理端统一发布。"); return;
      case "confirm-delete":
        if (el.dataset.kind === "company") { P.notice("公司统一信息由管理端统一发布。"); return; }
        oldActions(el); return;
      case "toggle-logs-mine": case "clear-log-author":
        clearLogSearch(); if (state.page === "log") renderLog(); return;
      case "clear-log-task":
        if (drafts.log) drafts.log.relationshipChanged = true;
        oldActions(el); return;
      case "picker-task-confirm":
        if (taskPicker.kind === "log" && drafts.log) drafts.log.relationshipChanged = true;
        oldActions(el); return;
      case "p-hide-notification": deleteNotification(el.dataset.id); return;
      case "p-withdraw-notification": withdrawNotification(el.dataset.id); return;
      case "p-open-notification-task": openNotificationTask(el.dataset.id); return;
      case "p-open-historical-task": openHistoricalTask(el.dataset.id); return;
      case "p-generate-analysis": generateAnalysis(); return;
      case "p-refresh-workspace": P.busy(async () => { analysis = null; await P.reload(); P.notice("已读取最新数据。"); }); return;
      case "p-logout": P.busy(() => P.logout()); return;
      case "new-consult": case "save-consult": case "reply-consult": case "save-reply":
        P.notice("请示功能尚未接入后端，未保存任何内容。"); return;
      default: oldActions(el);
    }
  };
  RENDER.map = renderMap; RENDER.log = renderLog; RENDER.ai = renderAI; RENDER.me = renderMe;
})();
