"use strict";
/* 原型工作区适配：沿用原布局、选择器和弹层，写入由后端校验权限与版本。 */
(function () {
  const P = window.Pandora;
  if (!P) return;
  const version = row => '"' + row.rowVersion + '"';
  const endpoint = id => encodeURIComponent(id);
  let logSnapshot = null, notificationSnapshot = null, analysis = null, analysisLoading = false, analysisSequence = 0;
  const oldLogForm = logFormView;
  const oldActions = runAction;
  const oldNotifications = openNotifications;
  const oldReload = P.reload;
  const oldSetPage = setPage;

  function putLog(raw) {
    if (raw.authorId === (P.data.me || {}).id) {
      const own = P.data.calendarLogs || (P.data.calendarLogs = []);
      const saved = own.findIndex(log => log.id === raw.id);
      if (saved < 0) own.push(raw); else own.splice(saved, 1, raw);
    }
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
  function companyBusinessDate() { return (P.data.home || {}).businessDate || toDateInput(new Date()); }

  const HOME_PRIORITY = { urgent: "紧急", high: "高", medium: "中", low: "低" };
  /* 上方两卡只保留约三条普通预览；完整内容进入独立二级清单，卡片不再内部滚动，
     因此手指在卡片上纵向滑动滚动的是整个首页。 */
  const HOME_PREVIEW = 3;
  function homeCompanyItems() { return (P.data.home || {}).companyItems || []; }
  function homeAssignedItems() { return (P.data.home || {}).assignedTasks || []; }
  function homeCompanyPreview() {
    const items = homeCompanyItems();
    if (!items.length) return '<div class="empty">暂无公司信息</div>';
    return items.slice(0, HOME_PREVIEW).map((item, index) =>
      '<div class="item-line"><div class="item-main"><span class="idx">' + (index + 1) + '</span><span class="txt">' +
        esc(item.body || item.title) + '</span></div></div>').join("");
  }
  function homeTaskPreview() {
    const items = homeAssignedItems();
    if (!items.length) return '<div class="empty">暂无本人负责的未完成任务</div>';
    return items.slice(0, HOME_PREVIEW).map(item =>
      '<div class="home-task"><span class="home-task-title">' + esc(item.title) +
        '</span><span class="home-task-priority">' + esc(HOME_PRIORITY[item.priority] || "中") + '</span></div>').join("");
  }
  function homeListHTML(kind) {
    if (kind === "company") {
      const items = homeCompanyItems();
      return items.length ? '<div class="home-list" aria-label="事件纪完整清单">' + items.map((item, index) =>
        '<div class="item-line"><div class="item-main"><span class="idx">' + (index + 1) + '</span><span class="txt">' +
          esc(item.body || item.title) + '</span></div></div>').join("") + "</div>"
        : '<div class="empty">暂无公司信息</div>';
    }
    const items = homeAssignedItems();
    return items.length ? '<div class="home-list" aria-label="任务看板完整清单">' + items.map(item =>
      '<button type="button" class="home-task" data-task="' + esc(item.taskId) + '"><span class="home-task-title">' +
        esc(item.title) + '</span><span class="home-task-priority">' + esc(HOME_PRIORITY[item.priority] || "中") + '</span></button>').join("") + "</div>"
      : '<div class="empty">暂无本人负责的未完成任务</div>';
  }
  function homeListView(kind) {
    const title = kind === "company" ? "事件纪" : "任务看板";
    return { title: title, body: homeListHTML(kind), foot: withBack(button("sheet-close", "关闭")),
      rebuild: () => homeListView(kind) };
  }
  function openHomeList(kind, trigger) {
    if (trigger) trigger.focus({ preventScroll: true });
    openSheet(homeListView(kind));
  }
  /* 点击卡片（含预览内容）先打开完整清单；清单里的任务再进入原鉴权详情，返回恢复清单位置。 */
  document.addEventListener("click", function (event) {
    const card = event.target.closest && event.target.closest("[data-home-list]");
    if (!card || !P.ready) return;
    if (event.target.closest("button,a,input,select,textarea,[data-action],[data-task]")) return;
    event.preventDefault(); event.stopImmediatePropagation();
    openHomeList(card.dataset.homeList, card);
  }, true);
  document.addEventListener("keydown", function (event) {
    const card = event.target.closest && event.target.closest("[data-home-list]");
    if (!card || (event.key !== "Enter" && event.key !== " ")) return;
    event.preventDefault(); event.stopPropagation();
    openHomeList(card.dataset.homeList, card);
  });
  /* 首页固定三个模块：事件纪、任务看板保持上方左右位置，每日事项通栏位于下方。
     日志卡片、旧个人事项列表与第四块空占位已移除；日志仍在日志页按原权限维护。 */
  renderMap = function () {
    const home = P.data.home || {};
    const assigned = home.assignedTasks || [];
    const today = parseDateInput(companyBusinessDate()) || new Date();
    const weekday = ["星期日","星期一","星期二","星期三","星期四","星期五","星期六"][today.getDay()];
    document.getElementById("page-map").innerHTML =
      '<section class="workday"><div class="workday-copy"><h2>' + esc(fmtDate(today)) + '</h2><p>' + esc(weekday) + '</p></div>' +
      '</section>' +
      '<div class="map-grid">' +
        '<section class="quad company-quad" aria-labelledby="q1" data-home-list="company" role="button" tabindex="0" aria-label="事件纪，查看完整清单">' +
          '<div class="card-head"><h2 id="q1">事件纪</h2><span class="hint">统一发布</span></div>' +
          '<div class="q-body">' + homeCompanyPreview() + '</div></section>' +
        '<section class="quad tasks-quad" aria-labelledby="q2" data-home-list="tasks" role="button" tabindex="0" aria-label="任务看板，查看完整清单">' +
          '<div class="card-head"><h2 id="q2">任务看板</h2><span class="hint">' + assigned.length + '/10</span></div>' +
          '<div class="q-body">' + homeTaskPreview() + '</div></section>' +
        '<section class="quad daily-quad" id="dailyItemsSection" aria-labelledby="q3"><div class="card-head"><h2 id="q3">每日事项</h2><span class="hint">本人维护</span></div></section>' +
      '</div>';
    if (window.PandoraDaily) window.PandoraDaily.render();
  };

  LOG_FILTER_LABEL.logs = "日志";
/* ---------- 日志页固定展示本人；人员资料中的授权阅读独立打开。 ---------- */
function logAuthorId() { return (P.data.me || {}).id || null; }
function logScopeLabel() { return '本人日志 · ' + filteredLogs(actor()).length + ' 条'; }
/* 日志按所属业务日期从新到旧，同日按真实创建时间倒序、ID 稳定排序；
   补写旧日志不会因为创建较晚而排到今天日志前面。 */
function logBusinessDate(log) {
  return String((log && log.raw && log.raw.businessDate) || "");
}
filteredLogs = function () {
  return LOGS.filter(log => log.authorId === logAuthorId())
    .slice().sort((x, y) => {
      const bx = logBusinessDate(x), by = logBusinessDate(y);
      if (bx !== by) return by < bx ? -1 : 1;
      const tx = x.time.getTime(), ty = y.time.getTime();
      if (tx !== ty) return ty - tx;
      return String(x.id) < String(y.id) ? -1 : String(x.id) > String(y.id) ? 1 : 0;
    });
};
logsListHTML = function (account) {
  const logs=filteredLogs(account);
  return logs.length?'<div class="stack log-list">'+logs.map(log=>logCardHTML(log,account)).join('')+'</div>':'<div class="empty">暂无个人日志</div>';
};
renderLog = function () {
  document.getElementById("page-log").innerHTML =
    '<header class="p-log-header"><h2>日志</h2><div class="row">' + button("new-log", "写日志", null, "primary") + '</div></header>' +
    '<section class="card p-log-panel" id="p-log-panel"><div class="card-head"><h2>我的日志</h2><span class="hint" id="logResultsCount">'+esc(logScopeLabel())+'</span></div><div id="logResults">'+logsListHTML(actor())+'</div></section>';
};
refreshLogResults = function () {
  const results=document.getElementById('logResults'), count=document.getElementById('logResultsCount');
  if(results) results.innerHTML=logsListHTML(actor());
  if(count) count.textContent=logScopeLabel();
};
// Card activation leaves nested edit and task controls to their own handlers.
document.addEventListener('click',event=>{
  const card=event.target.closest?.('[data-log-card]');
  if(!card||event.target.closest('button,a,input,select,textarea'))return;
  event.preventDefault();event.stopImmediatePropagation();openLogDetail(card.dataset.logCard);
},true);
document.addEventListener('keydown',event=>{
  if(!event.target.matches?.('[data-log-card]')||!['Enter',' '].includes(event.key))return;
  event.preventDefault();event.stopPropagation();openLogDetail(event.target.dataset.logCard);
});

/* 日志卡片：显示标签与冻结状态（第七章/第八章 8.2）。 */
function logTagHTML(raw) {
  return ((raw && raw.tags) || []).map(tag => P.tagPillHTML ? P.tagPillHTML(tag) : '').join('');
}
/* 卡片日期取日志所属日（businessDate），相对日同样按公司今天比较；
   详情仍展示真实创建时间，首次 24 小时冻结规则不变。 */
function businessDateText(raw) {
  const d = parseDateInput(raw && raw.businessDate);
  return d ? d.getFullYear() + "年" + (d.getMonth() + 1) + "月" + d.getDate() + "日" : "—";
}
function businessRelativeDay(raw) {
  const d = parseDateInput(raw && raw.businessDate);
  const today = parseDateInput(companyBusinessDate());
  if (!d || !today) return "";
  const diff = Math.round((+addDays(d, 0) - +addDays(today, 0)) / 86400000);
  return diff === 0 ? "今天" : diff === -1 ? "昨天" : diff === -2 ? "前天" : "";
}
logCardHTML = function (l, a) {
  const t = l.taskId ? taskById(l.taskId) : null;
  const mine = l.authorId === a.id;
  const raw = l.raw || {};
  const frozen = raw.frozen === true || (raw.editable === false && mine);
  const relative = businessRelativeDay(raw);
  return '<article class="log-card" role="link" tabindex="0" aria-label="查看日志详情与评论" data-log-card="' + esc(l.id) + '">' +
    "<header><span class=\"who\">" + esc(personById(l.authorId) ? personById(l.authorId).name : (raw.authorName || '相关成员')) + "</span>" +
      "<span class=\"log-business-date\">" + esc(businessDateText(raw)) + "</span>" +
      (relative ? "<span>" + esc(relative) + "</span>" : "") +
      '<span class="spacer"></span>' +
      (mine && raw.editable !== false
        ? '<button type="button" class="btn tiny-btn" data-action="edit-log" data-id="' + esc(l.id) + '">编辑</button>'
        : '<span class="tiny muted">' + (frozen ? '已冻结' : '只读') + '</span>') +
    "</header>" +
    '<div class="row wrap">' + logTagHTML(raw) + '</div>' +
    '<p class="p-log-reading">' + esc(l.content) + "</p>" +
    (t ? '<button type="button" class="btn ghost tiny-btn log-link" data-task="' + esc(t.id) + '">关联任务：' + esc(t.title) + '</button>' : '<span class="tiny muted">未关联任务</span>') +
  "</article>";
};

/* ---------- 日志详情与全屏表单（7.4） ---------- */
function freezeText(raw) {
  if (!raw || !raw.frozenAt) return '';
  const at = new Date(raw.frozenAt);
  if (Number.isNaN(at.getTime())) return '';
  return raw.frozen ? '已冻结' : '可编辑至 ' + timeText(raw.frozenAt);
}
logDetailView = function (id) {
  const l = P.subordinateMode() ? (P.subordinateLogs.get(id) || logById(id)) : logById(id);
  if (!l) return null;
  const t = l.taskId ? taskById(l.taskId) : null;
  const raw = l.raw || {};
  const name = raw.authorName || (personById(l.authorId) || {}).name || "相关人员";
  return { title: "日志详情", body: '<div class="kv"><span class="k">作者</span><span class="v">' + esc(name) +
      '</span><span class="k">日志日期</span><span class="v">' + esc(raw.businessDate) +
      '</span><span class="k">创建时间</span><span class="v">' + esc(timeText(raw.createdAt)) +
      '</span><span class="k">冻结</span><span class="v">' + esc(freezeText(raw) || "—") +
      '</span></div><div class="row wrap">' + logTagHTML(raw) + '</div><div class="divider"></div><p class="p-log-reading" style="white-space:pre-wrap;overflow-wrap:anywhere">' + esc(l.content) + '</p>' +
      (t ? '<div class="divider"></div><button type="button" class="btn" data-task="' + esc(t.id) + '">关联：' + esc(t.title) + '</button>' : '') +
      '<div class="divider"></div>' + (P.commentsHTML ? P.commentsHTML("log", id) : ''),
    foot: withBack((raw.editable && !P.subordinateMode() ? button("edit-log", "编辑日志", id, "primary") : "") + button("sheet-close", "关闭"), actor()) };
};
openLogDetail = function (id) {
  P.busy(async () => {
    const source = P.subordinateMode() ? P.subordinateKey?.() : null;
    const raw = await P.request("/work-logs/" + endpoint(id));
    if (source !== (P.subordinateMode() ? P.subordinateKey?.() : null)) return;
    if (P.subordinateMode()) P.subordinateLogs.set(id,{id:raw.id,authorId:raw.authorId,time:new Date(raw.createdAt),content:raw.body,taskId:raw.taskId,raw});
    else putLog(raw);
    logSnapshot = { raw, epoch: P.epoch };
    openSheet(logDetailView(id));
  });
};
function logDraft(raw, businessDate) {
  return { id: raw ? raw.id : null, content: raw ? raw.body : "", taskId: raw ? raw.taskId || null : null,
    originalTaskId: raw ? raw.taskId || null : null, relationshipChanged: false,
    tagIds: raw ? (raw.tagIds || []).slice() : [], tagSnapshots: raw ? (raw.tags || []).slice() : [],
    tagTouched: false,
    hiddenTask: !!raw && !Object.prototype.hasOwnProperty.call(raw, "taskId"),
    fillSeq: 0, fillPending: false,
    etag: raw ? version(raw) : null, epoch: P.epoch,
    businessDate: raw ? raw.businessDate : businessDate,
    editable: !raw || raw.editable === true, frozen: !!(raw && raw.frozen), frozenAt: raw ? raw.frozenAt : null };
}
function logDateOptions() {
  const today = parseDateInput(companyBusinessDate()) || new Date();
  return [-2,-1,0].map(offset => {
    const date = addDays(today, offset);
    return { value: toDateInput(date), label: (offset === 0 ? '今天' : offset === -1 ? '昨天' : '前天') + ' · ' + (date.getMonth()+1) + '月' + date.getDate() + '日' };
  }).reverse();
}
/* 日志分页读取与整体替换：授权边界仍由服务端裁决，页面只替换已授权的完整结果。 */
async function applyLogAuthor() {
  const items=await loadLogs('/work-logs?scope=self');
  replaceLogs(items);state.logAll=false;state.logAuthorId=logAuthorId();refreshLogResults();
}
P.openLogsFor = async function (id) {
  if(!id || id===logAuthorId()) { await applyLogAuthor(); setPage('log'); return; }
  const items=await loadLogs('/work-logs?scope=visible&authorId='+endpoint(id));
  openSheet({title:'人员日志',body:items.length?items.map(raw=>logCardHTML({id:raw.id,authorId:raw.authorId,time:new Date(raw.createdAt),content:raw.body,taskId:raw.taskId,raw},actor())).join(''):'<div class="empty">暂无日志</div>',foot:withBack(button('sheet-close','关闭'))});
};
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
function replaceLogs(items) {
  LOGS.splice(0, LOGS.length, ...items.map(l => ({
    id: l.id, authorId: l.authorId, time: new Date(l.createdAt), content: l.body,
    taskId: l.taskId || null, rowVersion: l.rowVersion, editable: l.editable, raw: l
  })));
  P.logEtags.clear();
  items.forEach(l => P.logEtags.set(l.id, version(l)));
}
async function existingLogFor(date) {
  if (!date) return null;
  const result = await P.request("/work-logs?scope=self&from=" + encodeURIComponent(date) + "&to=" + encodeURIComponent(date) + "&limit=1");
  return (result.items || [])[0] || null;
}
openLogForm = function (id, date) {
  if (P.subordinateMode()) {P.notice('下属浏览仅可评论。');return;}
  return P.busy(async () => {
    if (id) {
      const raw = logSnapshot && logSnapshot.epoch === P.epoch && logSnapshot.raw.id === id && sheetTitleEl.textContent === "日志详情"
        ? logSnapshot.raw : await P.request("/work-logs/" + endpoint(id));
      if (!raw.editable) throw new Error("该日志已冻结或不是本人日志，不能再编辑。");
      putLog(raw);
      drafts.log = logDraft(raw, raw.businessDate);
      drafts.log.mode = "edit";
      openSheet(logEditView());
      return;
    }
    const options = logDateOptions();
    const existing = await Promise.all(options.map(option => existingLogFor(option.value)));
    const availableDates = options.filter((option, index) => !existing[index]);
    if (!availableDates.length) { P.notice("今天、昨天和前天都已有日志，请从日志详情进入编辑。"); return; }
    if (date && !availableDates.some(option => option.value === date)) {
      P.notice("该日期不可创建或已有日志，请从日志详情进入编辑。"); return;
    }
    drafts.log = logDraft(null, date || availableDates[0].value);
    drafts.log.mode = "create";
    drafts.log.availableDates = availableDates;
    openSheet(logCreateView());
  });
};
/* 创建与编辑只共享字段组件：日期候选、操作模式与提交目标各自决定，不由同一模板改属性。 */
function logDateCreateHTML(d) {
  return '<div class="field"><label for="lf-date">日志日期</label><select id="lf-date">' +
    (d.availableDates || []).map(row => '<option value="' + esc(row.value) + '"' + (row.value === d.businessDate ? ' selected' : '') + '>' + esc(row.label) + '</option>').join('') +
    '</select></div>';
}
function logDateEditHTML(d) {
  return '<div class="field"><label>日志日期</label><div class="p-log-date-readonly" id="lf-date" role="textbox" aria-readonly="true" aria-label="日志日期，不可修改">' + esc(d.businessDate) + '</div></div>';
}
function logFieldsHTML(d, dateHTML) {
  const linked = d.taskId ? taskById(d.taskId) : null;
  if (d.frozenAt && logFillAllowed(d)) {
    clearTimeout(d.freezeTimer);
    d.freezeTimer = setTimeout(() => { if (drafts.log === d && d.epoch === P.epoch) freezeLogDraft(d); },
      Math.max(0, new Date(d.frozenAt).getTime() - Date.now()));
  }
  return '<div class="p-log-meta">' + dateHTML + (P.tagCollectionHTML ? P.tagCollectionHTML('lf', d.tagIds, d.tagSnapshots) : '') + '</div>' +
    '<div class="field log-content-field"><div class="log-content-head"><label for="lf-content">日志内容</label>' +
      '<button type="button" class="btn tiny-btn" id="lf-fill-button" data-action="fill-log-source" aria-label="填入当日事项与任务名称"' + (logFillAllowed(d) ? '' : ' disabled aria-disabled="true"') + '>填入当日事项与任务</button></div>' +
      '<textarea id="lf-content" maxlength="10000" data-autofocus' + (logFillAllowed(d) ? '' : ' readonly') + '>' + esc(d.content) + '</textarea>' +
      '<p class="tiny muted" id="lf-fill-status" role="status" aria-live="polite"></p></div>' +
    '<div class="field"><label>关联任务（可选）</label>' +
      '<div class="summary-line" id="lf-task-summary">' +
        (linked ? esc(linked.title) : (d.hiddenTask && !d.relationshipChanged ? '关联任务当前不可见，保留原关系' : '<span class="muted">未关联任务</span>')) + "</div>" +
      '<div class="row" style="margin-top:6px">' +
        '<button type="button" class="btn tiny-btn" data-action="pick-log-task">选择关联任务</button>' +
        (d.taskId ? '<button type="button" class="btn tiny-btn ghost" data-action="clear-log-task">清空关联</button>' : '') +
      "</div></div>" +
    (d.frozenAt ? '<div class="callout info">' + esc(freezeText({ frozen: d.frozen, frozenAt: d.frozenAt }) || '') + '</div>' : '') +
    '<div class="callout" id="lf-error" hidden></div>';
}
const logCreateView = function () {
  const d = drafts.log;
  if (!d || d.mode !== "create") return null;
  return { title: "写日志", body: logFieldsHTML(d, logDateCreateHTML(d)),
    foot: withBack('<button type="button" class="btn primary" data-action="save-log">保存日志</button>', actor()),
    draftKind: "log", rebuild: logCreateView, fullscreen: true };
};
const logEditView = function () {
  const d = drafts.log;
  if (!d || d.mode !== "edit" || !d.id) return null;
  return { title: "编辑日志", body: logFieldsHTML(d, logDateEditHTML(d)),
    foot: withBack('<button type="button" class="btn primary" data-action="save-log">保存日志</button>', actor()),
    draftKind: "log", rebuild: logEditView, fullscreen: true };
};
logFormView = function () {
  const d = drafts.log;
  if (!d) return null;
  return d.mode === "edit" ? logEditView() : logCreateView();
};
syncLogDraft = function () {
  if (!drafts.log) return;
  const content = document.getElementById("lf-content");
  if (content) drafts.log.content = content.value;
  if (drafts.log.mode === "create") {
    const date = document.getElementById("lf-date");
    if (date && date.value) drafts.log.businessDate = date.value;
  }
};
document.addEventListener('change', function (event) {
  if (!P.ready || !event.target || !drafts.log) return;
  if (drafts.log.mode !== 'create' || event.target.id !== 'lf-date') return;
  syncLogDraft();
  if (drafts.log.content.trim()) {
    // 先保留已写内容：换日期只在空表单时自动切换，避免丢失草稿。
    drafts.log.businessDate = event.target.value;
    return;
  }
  openLogForm(null, event.target.value);
});
saveLog = function () {
  if (P.subordinateMode()) {P.notice('下属浏览仅可评论。');return;}
  P.busy(async () => {
    syncLogDraft();
    const d = drafts.log;
    if (!d || d.epoch !== P.epoch) throw new Error("请重新打开日志后再保存。");
    if (d.mode === "edit" && !d.id) throw new Error("请重新打开日志后再保存。");
    const content = String(d.content || "").trim();
    if (!content) throw new Error("请填写日志内容。");
    const body = { body: content };
    if (!d.id) body.businessDate = d.businessDate;
    if (!d.id || d.relationshipChanged || d.taskId !== d.originalTaskId) body.taskId = d.taskId || null;
    if (!d.id || d.tagTouched) body.tagIds = (d.tagIds || []).slice();
    try {
      await P.mutation("work-log:" + (d.id || "new"), d.id ? "PATCH" : "POST",
        "/work-logs" + (d.id ? "/" + endpoint(d.id) : ""), body, d.etag);
    } catch (error) {
      if (!d.id && error.code === "WORK_LOG_EXISTS" && error.body && error.body.logId) {
        P.notice("该日期刚刚已有日志，请关闭创建页，从日志详情进入编辑。");
        showError("lf-error", "该日期已有日志，未覆盖原内容；请从日志详情进入编辑。");
        return;
      }
      if (error.code === "WORK_LOG_FROZEN") {
        // 冻结只拒绝这次写入：保留当前模式的日期/标签/正文/关联草稿与可复制文字，不关闭界面。
        freezeLogDraft(d);
        try { await P.reload(); } catch (reloadError) { if (reloadError.name === "AbortError") return; /* 列表刷新失败也不能吞掉用户尚未保存的内容 */ }
        // 身份切换或表单已被关闭时草稿已作废，不能再重建界面。
        if (drafts.log !== d || d.epoch !== P.epoch) return;
        replaceTopSheet(d.mode === "edit" ? logEditView() : logCreateView());
        const message = d.mode === "edit"
          ? "该日志已满24小时，只能查看；未保存的内容仍保留在页面上，可复制后关闭。"
          : "该日期此前的日志已满24小时，不能重建；未保存的内容仍保留在页面上，可复制后换个日期。";
        showError("lf-error", message);
        P.notice(message);
        return;
      }
      throw error;
    }
    await P.reload(); closeSheet(); P.notice("日志已保存。");
  }, "lf-error");
};

  /* ---------- 按日志所属日主动追加当日事项与任务名称 ----------
     只读取当前 draft 的 businessDate；追加到请求返回时的最新正文，绝不覆盖
     等待期间的输入。请求进行中再次点击被忽略，之后主动点击视为新的追加。
     空结果、失败或完整追加超过 10000 UTF-16 单位时保持原文不变。 */
  function fillNames(rows) {
    const seen = new Set(), names = [];
    (rows || []).forEach(row => {
      if (!row || !row.id || seen.has(row.id)) return;
      seen.add(row.id);
      const name = String(row.name == null ? "" : row.name);
      if (name.trim()) names.push(name);
    });
    return names;
  }
  function fillBlockHTML(items, tasks) {
    const lines = [];
    if (items.length) { lines.push("每日事项："); items.forEach(name => lines.push("· " + name)); }
    if (tasks.length) { lines.push("任务："); tasks.forEach(name => lines.push("· " + name)); }
    return lines.join("\n");
  }
  function setFillStatus(message, isError) {
    const status = document.getElementById("lf-fill-status");
    if (!status) return;
    status.textContent = message || "";
    status.classList.toggle("is-error", !!isError);
  }
  function logFillAllowed(d) {
    return !!d && !d.frozen && d.editable !== false &&
      (!d.frozenAt || Date.now() < new Date(d.frozenAt).getTime());
  }
  function freezeLogDraft(d) {
    d.frozen = true; d.editable = false; d.fillSeq++; d.fillPending = false;
    if (drafts.log !== d || d.epoch !== P.epoch) return;
    syncLogDraft();
    const button = document.getElementById('lf-fill-button');
    if (button) { button.disabled = true; button.setAttribute('aria-disabled', 'true'); button.removeAttribute('aria-busy'); }
    const textarea = document.getElementById('lf-content');
    if (textarea) textarea.readOnly = true;
    setFillStatus('该日志已只读，未保存的内容保留供复制；未追加任何内容。', true);
  }
  async function checkLogFillAccess(d) {
    if (!logFillAllowed(d)) { freezeLogDraft(d); return false; }
    if (d.mode !== 'edit') return true;
    // 服务裁决真实冻结点；开始及落地前均回读，以覆盖旧页和请求途中到期。
    const raw = await P.request('/work-logs/' + endpoint(d.id));
    if (drafts.log !== d || d.epoch !== P.epoch) return false;
    if (!raw.editable || raw.frozen) { freezeLogDraft(d); return false; }
    d.frozenAt = raw.frozenAt;
    if (!logFillAllowed(d)) { freezeLogDraft(d); return false; }
    return true;
  }
  function fillLogSource(button) {
    const d = drafts.log;
    if (!d || d.epoch !== P.epoch) { P.notice("请重新打开日志后再填充。"); return; }
    if (d.mode === "edit" && !d.id) { P.notice("请重新打开日志后再填充。"); return; }
    syncLogDraft();
    if (!logFillAllowed(d)) { freezeLogDraft(d); return; }
    if (d.fillPending) return;
    const sequence = (d.fillSeq || 0) + 1;
    d.fillSeq = sequence;
    d.fillPending = true;
    const businessDate = d.businessDate;
    if (button) { button.setAttribute("aria-busy", "true"); button.setAttribute("aria-disabled", "true"); }
    setFillStatus("正在读取 " + businessDate + " 的每日事项与任务…");
    Promise.resolve().then(async () => {
      if (!await checkLogFillAccess(d) || drafts.log !== d || d.fillSeq !== sequence || d.businessDate !== businessDate) return null;
      return P.request("/work-logs/fill-source?businessDate=" + encodeURIComponent(businessDate));
    }).then(async result => {
      if (!result) return;
      if (drafts.log !== d || d.epoch !== P.epoch || d.fillSeq !== sequence) return;
      if (d.businessDate !== businessDate) { setFillStatus("日志日期已变化，未写入。"); return; }
      if (!await checkLogFillAccess(d) || drafts.log !== d || d.fillSeq !== sequence || d.businessDate !== businessDate) return;
      const textarea = document.getElementById("lf-content");
      if (!textarea) return;
      const items = fillNames(result.dailyItems), tasks = fillNames(result.tasks);
      if (!items.length && !tasks.length) { setFillStatus("当日没有可填入的每日事项或任务。"); return; }
      const block = fillBlockHTML(items, tasks);
      const current = textarea.value;
      const next = current.trim() ? current.replace(/\s+$/, "") + "\n\n" + block : block;
      if (next.length > 10000) {
        setFillStatus("追加后超过 10000 字上限，未写入任何内容；请手动精简后重试。", true);
        return;
      }
      d.content = next;
      textarea.value = next;
      textarea.focus({ preventScroll: true });
      textarea.setSelectionRange(next.length, next.length);
      setFillStatus("已追加 " + items.length + " 项每日事项、" + tasks.length + " 项任务；可继续编辑。");
    }).catch(error => {
      if (drafts.log !== d || d.epoch !== P.epoch || d.fillSeq !== sequence) return;
      if (error.name === "AbortError") return;
      setFillStatus(error.message || "读取失败，正文保持原样。", true);
    }).finally(() => {
      if (drafts.log !== d) return;
      d.fillPending = false;
      const current = document.getElementById("lf-fill-button");
      if (current === button || (current && current.dataset.action === "fill-log-source")) {
        const target = current || button;
        if (target) { target.removeAttribute("aria-busy"); if (logFillAllowed(d)) target.removeAttribute("aria-disabled"); }
      }
    });
  }
  companyItemFormView = () => null;
  /* 个人事项已迁移为每日事项；旧入口只提示，不再读写 home_items personal。 */
  function companyNotice() { P.notice("公司统一信息由管理端统一发布。"); }
  function personalRetired() { P.notice("个人事项已改为每日事项，请在首页每日事项中维护。"); }
  // Fetch the record when opening; submission retains this snapshot even if a later reload occurs.
  document.addEventListener("click", function (event) {
    const el = event.target.closest("[data-edit-company],[data-delete-company],[data-edit-personal],[data-delete-personal],[data-action='delete-company'],[data-action='delete-personal']");
    if (!el || !P.ready) return;
    event.preventDefault(); event.stopImmediatePropagation();
    if (el.dataset.editPersonal || el.dataset.deletePersonal || el.dataset.action === "delete-personal") { personalRetired(); return; }
    companyNotice();
  }, true);
  saveCompanyItem = () => companyNotice();
  savePersonalItem = () => personalRetired();
  deleteItem = function (kind) { if (kind === "company") companyNotice(); else personalRetired(); };

  const REQUEST_KIND = { create: "创建任务", change: "修改资料", progress: "更新进展", complete: "提交完成", reopen: "重开任务", handover: "交接" };
  const REQUEST_RESULT = { pending: "待审核", approved: "已通过", rejected: "已退回", withdrawn: "已撤销", direct: "已生效", expired: "已失效" };
  let noticeQuery = null;
  notificationsFor = () => (noticeQuery ? noticeQuery.items.slice() : []);
  unreadCount = () => Number((P.data && P.data.notificationUnreadCount) || 0);
  const PURPOSE_FALLBACK = { comment: "新评论", task: "任务通知", log: "日志" };
  function notificationPurpose(raw) {
    if (raw.purpose) return raw.purpose;
    const type = String(raw.eventType || "");
    if (type.startsWith("comment.")) return PURPOSE_FALLBACK.comment;
    return PURPOSE_FALLBACK.task;
  }
  function notificationSummary(raw, changes) {
    let text = String(raw.summary || "");
    if (changes && changes.length) text = text.split("本次变化：")[0];
    const name = raw.objectName;
    if (name && text) {
      for (const prefix of ["任务《" + name + "》的", "任务《" + name + "》", "《" + name + "》", name]) {
        if (text.startsWith(prefix)) { text = text.slice(prefix.length); break; }
      }
    }
    return text.trim();
  }
  /* 通知列表委托服务端组合筛选与分页：六类型标签、已读三段、单图标精简/完整切换。
     过滤后的 total 与独立全局 unreadCount 都取自服务端，切换条件/模式不标读。 */
  const NOTICE_CATEGORIES = { all: '全部', review: '需我审核', result: '结果告知', reminder: '提醒', comment: '评论', other: '其他' };
  const NOTICE_READ = { all: '全部', unread: '未读', read: '已读' };
  const NOTICE_PAGE = 20;
  const NOTICE_ICON = {
    compact: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5 4 19h16z"/></svg>',
    full: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 10h18M8 5v5M8 15h5"/></svg>'
  };
  function noticeAccount() { return ((P.data && P.data.me) || {}).id || null; }
  function noticeEnsure() {
    if (!noticeQuery || noticeQuery.epoch !== P.epoch || noticeQuery.account !== noticeAccount()) {
      noticeQuery = { category: 'all', read: 'all', mode: 'compact', items: [], total: 0,
        unreadCount: Number((P.data && P.data.notificationUnreadCount) || 0),
        nextOffset: 0, loading: false, error: null, lastMode: 'first', epoch: P.epoch, account: noticeAccount(), seq: 0 };
    }
    return noticeQuery;
  }
  P.sessionReset.push(function () { noticeQuery = null; });
  function renderBell() {
    const dot = document.getElementById('bellDot'), bell = document.getElementById('bellBtn');
    if (!dot || !bell) return;
    const n = Number((P.data && P.data.notificationUnreadCount) || 0);
    dot.hidden = n === 0;
    dot.textContent = n > 9 ? '9+' : String(n);
    bell.setAttribute('aria-label', n ? '通知，' + n + ' 条未读' : '通知，无未读');
  }
  P.renderBell = renderBell;
  function noticeParams(q, offset, limit) {
    const params = new URLSearchParams();
    params.set('limit', String(limit));
    params.set('offset', String(offset));
    if (q.category !== 'all') params.set('category', q.category);
    if (q.read !== 'all') params.set('readStatus', q.read);
    return '/notifications?' + params.toString();
  }
  function noticeFiltersActive(q) { return q.category !== 'all' || q.read !== 'all'; }
  function noticeFiltersHTML(q) {
    return '<div class="p-notice-filters" role="group" aria-label="通知筛选">' +
      '<div class="p-notice-tabs" role="tablist" aria-label="通知类型">' +
        Object.entries(NOTICE_CATEGORIES).map(([key, label]) =>
          '<button type="button" role="tab" class="p-notice-tab" data-action="p-notice-category" data-value="' + key +
          '" aria-selected="' + (q.category === key) + '" tabindex="' + (q.category === key ? 0 : -1) + '">' + label + '</button>').join('') +
      '</div>' +
      '<div class="p-notice-controls">' +
        '<div class="p-notice-read" role="group" aria-label="已读状态">' +
          Object.entries(NOTICE_READ).map(([key, label]) =>
            '<button type="button" class="p-notice-read-btn" data-action="p-notice-read" data-value="' + key +
            '" aria-pressed="' + (q.read === key) + '">' + label + '</button>').join('') +
        '</div>' +
        '<button type="button" class="p-notice-mode" data-action="p-notice-mode" aria-pressed="' + (q.mode === 'full') +
          '" aria-label="' + (q.mode === 'full' ? '切换到精简显示' : '切换到完整显示') + '" title="' +
          (q.mode === 'full' ? '当前完整模式，切换到精简显示' : '当前精简模式，切换到完整显示') + '">' +
          NOTICE_ICON[q.mode] + '</button>' +
        (noticeFiltersActive(q) ? '<button type="button" class="p-text-button p-notice-reset" data-action="p-notice-reset">重置</button>' : '') +
      '</div></div>';
  }
  function noticeSummaryHTML(q) {
    return '<p id="p-notice-summary" class="p-notice-summary" role="status">已显示 <strong>' + q.items.length + '</strong> / ' +
      q.total + ' 条' + (noticeFiltersActive(q) ? '（当前条件）' : '') + ' · 全部未读 <strong>' + q.unreadCount + '</strong> 条</p>';
  }
  function noticeRowHTML(raw, mode) {
    const read = !!raw.readAt, category = NOTICE_CATEGORIES[raw.category] || '其他';
    const name = raw.objectName || raw.title || (raw.taskId ? '关联任务不可查看' : '无关联任务');
    const purpose = notificationPurpose(raw), summary = notificationSummary(raw, []);
    return '<button type="button" class="notif p-notice-row' + (read ? ' is-read' : '') + (mode === 'full' ? ' is-full' : '') +
      '" data-action="open-notif" data-id="' + esc(raw.id) + '"><span class="ndot" aria-hidden="true"></span>' +
      '<span class="nbody"><span class="ntop"><span class="ntitle">' + esc(name) + '</span><span class="npurpose">' + esc(category) + '</span></span>' +
      (mode === 'full' ? '<span class="nsummary">' + esc(purpose) + ' · ' + esc(summary) + '</span>' : '') +
      '<span class="nmeta"><time datetime="' + esc(raw.createdAt || '') + '">' + esc(timeText(raw.createdAt)) + '</time>' +
      '<span>' + (read ? '已读' : '未读') + '</span></span></span></button>';
  }
  function noticeRowsHTML(q) {
    if (q.error && !q.items.length) return '<div class="empty">通知加载失败：' + esc(q.error) + '</div>';
    if (q.loading && !q.items.length) return '<div class="empty">正在加载通知…</div>';
    if (!q.items.length) return '<div class="empty">' + (noticeFiltersActive(q) ? '没有符合筛选条件的通知' : '暂无通知') + '</div>';
    return q.items.map(raw => noticeRowHTML(raw, q.mode)).join('');
  }
  function noticeFootHTML(q) {
    if (q.loading) return '<span class="tiny muted">正在加载…</span>';
    if (q.error) return '<span class="callout reject" role="alert">' + esc(q.error) + '</span>' +
      '<button type="button" class="btn tiny-btn" data-action="p-notice-retry">重试</button>';
    if (q.nextOffset != null) return '<button type="button" class="btn tiny-btn" data-action="p-notice-more">加载更多（已显示 ' + q.items.length + ' / ' + q.total + '）</button>';
    return q.items.length ? '<span class="tiny muted">已显示全部 ' + q.items.length + ' 条</span>' : '';
  }
  function noticeContentHTML(q) {
    return noticeFiltersHTML(q) + noticeSummaryHTML(q) +
      '<div id="p-notice-rows" class="p-notice-list" aria-live="polite">' + noticeRowsHTML(q) + '</div>' +
      '<div id="p-notice-foot" class="p-notice-foot">' + noticeFootHTML(q) + '</div>';
  }
  function noticeListIsTop() {
    const top = sheetStack[sheetStack.length - 1];
    return !!(top && top.noticeList);
  }
  function noticePaint() {
    const content = document.getElementById('p-notice-content');
    if (!content) return;
    content.innerHTML = noticeContentHTML(noticeEnsure());
  }
  function noticeAppendPaint(added) {
    const rows = document.getElementById('p-notice-rows');
    if (!rows) return noticePaint();
    const q = noticeEnsure();
    rows.insertAdjacentHTML('beforeend', added.map(raw => noticeRowHTML(raw, q.mode)).join(''));
    const summary = document.getElementById('p-notice-summary'), foot = document.getElementById('p-notice-foot');
    if (summary) summary.outerHTML = noticeSummaryHTML(q);
    if (foot) foot.innerHTML = noticeFootHTML(q);
  }
  /* 先请求后绘制：序号、账号与查询对象三者任一变化都丢弃迟到结果，旧页不会并入当前筛选。 */
  async function noticeFetch(mode) {
    const q = noticeEnsure(), seq = ++q.seq, epoch = P.epoch, account = q.account;
    q.error = null;
    q.lastMode = mode;
    const offset = mode === 'more' && q.nextOffset != null ? q.nextOffset : 0;
    const wanted = mode === 'refresh' ? Math.max(NOTICE_PAGE, q.items.length) : NOTICE_PAGE;
    // 刷新分批读回原加载范围，所有页成功后再替换；失败保留仍有效列表。
    q.loading = true;
    if (noticeListIsTop()) { if (mode === 'more') { const foot = document.getElementById('p-notice-foot'); if (foot) foot.innerHTML = noticeFootHTML(q); } else noticePaint(); }
    try {
      const current = () => epoch === P.epoch && seq === q.seq && q === noticeQuery && account === noticeAccount();
      const rows = new Map();
      let cursor = offset, result;
      do {
        result = await P.request(noticeParams(q, cursor, Math.min(100, wanted - rows.size)));
        if (!current()) return false;
        (Array.isArray(result.items) ? result.items : []).forEach(item => rows.set(item.id, item));
        const next = result.nextOffset == null ? null : Number(result.nextOffset);
        if (next != null && next <= cursor) throw new Error('通知分页异常，请重试。');
        cursor = next;
      } while (mode === 'refresh' && rows.size < wanted && cursor != null);
      const items = Array.from(rows.values());
      q.total = Number(result.total || 0);
      q.unreadCount = Number(result.unreadCount || 0);
      P.data.notificationUnreadCount = q.unreadCount;
      renderBell();
      if (mode === 'more') q.items = q.items.concat(items.filter(item => !q.items.some(existing => existing.id === item.id)));
      else q.items = items;
      q.nextOffset = cursor;
      q.loading = false;
      if (noticeListIsTop()) { if (mode === 'more') noticeAppendPaint(items); else noticePaint(); }
      return true;
    } catch (error) {
      if (epoch !== P.epoch || seq !== q.seq || q !== noticeQuery || account !== noticeAccount()) return false;
      q.loading = false;
      q.error = error.message || '通知加载失败';
      if (noticeListIsTop()) noticePaint();
      return false;
    }
  }
  function noticeLoadFirst() {
    const q = noticeEnsure();
    q.items = []; q.total = 0; q.nextOffset = 0; q.error = null;
    return noticeFetch('first');
  }
  function noticeApplyFilter(field, value) {
    const q = noticeEnsure();
    if (q[field] === value && !q.error) return;
    q[field] = value;
    q.items = []; q.total = 0; q.nextOffset = 0; q.error = null; q.loading = true;
    replaceTopSheet(notificationsView());
    const selector = (field === 'category' ? '[data-action="p-notice-category"]' : '[data-action="p-notice-read"]') +
      '[data-value="' + value + '"]';
    const target = document.querySelector(selector);
    if (target) target.focus({ preventScroll: true });
    noticeFetch('first');
  }
  function noticeResetFilters() {
    const q = noticeEnsure();
    q.category = 'all'; q.read = 'all';
    q.items = []; q.total = 0; q.nextOffset = 0; q.error = null; q.loading = true;
    replaceTopSheet(notificationsView());
    const target = document.querySelector('[data-action="p-notice-category"][data-value="all"]');
    if (target) target.focus({ preventScroll: true });
    noticeFetch('first');
  }
  function noticeToggleMode() {
    const q = noticeEnsure();
    q.mode = q.mode === 'full' ? 'compact' : 'full';
    replaceTopSheet(notificationsView());
    const target = document.querySelector('[data-action="p-notice-mode"]');
    if (target) target.focus({ preventScroll: true });
  }
  notificationsView = function () {
    const q = noticeEnsure();
    return { title: '通知', notification: true, noticeList: true,
      body: '<div id="p-notice-content" class="p-notice-content">' + noticeContentHTML(q) + '</div>', rebuild: notificationsView };
  };
  openNotifications = function () {
    /* 异步加载前先落焦点，关闭头部后才会回到铃铛入口而不是页面正文。 */
    const bell = document.getElementById("bellBtn");
    if (bell) bell.focus();
    const q = noticeEnsure();
    q.items = []; q.total = 0; q.nextOffset = 0; q.error = null; q.loading = true;
    openSheet(notificationsView());
    noticeLoadFirst();
  };
  function requestResultText(raw) {
    if (!raw.requestStatus) return "";
    const kind = REQUEST_KIND[raw.requestKind] || "任务申请";
    const result = REQUEST_RESULT[raw.requestStatus] || raw.requestStatus || "已处理";
    return kind + " · " + result;
  }
  function notificationView(raw) {
    const revoked = !!raw.revoked;
    const changes = Array.isArray(raw.changes) ? raw.changes : [];
    let body = '<div class="card-head"><h2>' + esc(raw.eventResult || notificationPurpose(raw)) + '</h2></div>' +
      '<div class="kv">' + (raw.objectName ? '<span class="k">对象</span><span class="v">'+esc(raw.objectName)+'</span>' : '') +
      '<span class="k">通知时间</span><span class="v">' + esc(timeText(raw.createdAt)) + '</span></div>';
    if (revoked && !raw.canReadWithdrawnDetails) {
      body += '<div class="divider"></div><p>该通知已被撤回。</p>';
    } else {
      if (revoked) body += '<div class="callout info">该通知已撤回，仅供只读查看。</div>';
      const summary = notificationSummary(raw, changes);
      const changeSummary = notificationSummary({ ...raw, summary: raw.changeSummary }, []);
      if (!changes.length && summary) body += '<p style="white-space:pre-wrap;overflow-wrap:anywhere">' + esc(summary) + '</p>';
      if (changes.length) body += '<div class="p-notice-changes" aria-label="本次变化">' + changes.map(change =>
        '<div><strong>' + esc(change.label || change.field) + '</strong><span>' + esc(change.before || '空') + '</span><span aria-hidden="true">→</span><span>' + esc(change.after || '空') + '</span></div>').join('') + '</div>';
      if (!changes.length && changeSummary && changeSummary !== summary) body += '<p class="tiny muted" style="white-space:pre-wrap">' + esc(changeSummary) + '</p>';
      if (raw.requestStatus) body += '<div class="callout info">申请：' + esc(requestResultText(raw)) + '</div>';
      if (raw.requestUnavailable) body += '<p class="tiny muted">原申请不可查看。</p>';
      if (raw.relationLost) body += '<div class="callout info">你已不再是该任务负责人，此消息仅供只读查看。</div>';
    }
    body += '<div class="callout" id="notification-error" hidden></div>';
    const buttons = [];
    if (!revoked && raw.canReadRequest && raw.requestId) buttons.push(button("p-open-approval", raw.canReview ? "审核此申请" : "查看原申请", raw.requestId, "primary"));
    /* 同一对象只保留一个跳转：任务消息合并为“查看任务”，评论消息定位评论区，日志消息使用“查看日志”。 */
    const historical = !!(raw.taskId && (raw.relationLost || raw.readonly));
    const objectLabel = raw.focus === "comments" ? "查看评论" : raw.objectType === "log" ? "查看日志" : raw.objectType === "task" ? "查看任务" : "查看相关对象";
    if (!revoked && historical) {
      buttons.push(button("p-open-historical-task", "查看历史只读详情", raw.id));
      if (raw.objectType === "log" && raw.objectId) buttons.push(button("p-open-notification-object", objectLabel, raw.id));
    } else if (!revoked && raw.objectType && raw.objectId) {
      buttons.push(button("p-open-notification-object", objectLabel, raw.id));
    } else if (!revoked && raw.taskId) {
      buttons.push(button("p-open-notification-task", "查看任务", raw.id));
    }
    const more=[];
    if (!revoked && raw.canWithdrawRequest && raw.requestId) more.push('<button type="button" class="btn" data-action="p-withdraw-notification-request" data-id="'+esc(raw.requestId)+'">撤销本人申请</button>');
    if (!revoked && raw.canWithdraw) more.push(button("p-withdraw-notification", "撤回通知", raw.id));
    if (!revoked) more.push(button("p-hide-notification", "删除此消息", raw.id));
    if (more.length) body += '<details class="p-notice-more"><summary>更多操作</summary><div class="row wrap" role="group" aria-label="更多通知操作">'+more.join('')+'</div></details>';
    if (buttons.length && !buttons.some(item=>item.includes('class="btn primary'))) buttons[0]=buttons[0].replace('class="btn ','class="btn primary ');
    return { title: "通知详情", notification: true, body: body, foot: buttons.join("") };
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
      const open = await P.mutation("notification-open:" + id, "POST", "/notifications/" + endpoint(id) + "/open");
      const raw = await P.request("/notifications/" + endpoint(id));
      const q = noticeEnsure();
      /* 打开才标读：先更新当前查询中的这一条与独立全局未读，再进入详情。
         详情返回时重建列表会按当前类型/已读条件反映已读变化。 */
      const index = q.items.findIndex(item => item.id === id);
      if (index >= 0) q.items.splice(index, 1, raw);
      if (index >= 0 && q.read === 'unread') { q.items.splice(index, 1); q.total = Math.max(0, q.total - 1); }
      if (open && open.unreadCount != null) { q.unreadCount = Number(open.unreadCount); P.data.notificationUnreadCount = q.unreadCount; }
      renderBell();
      notificationSnapshot = { raw: raw, etag: version(raw), epoch: P.epoch, account: noticeAccount() };
      openSheet(notificationView(raw));
      /* 后台按当前条件刷新首屏，结果受序号/账号保护；详情返回时直接使用已更新的查询结果。 */
      noticeFetch('refresh');
    }, "notification-error");
  };
  async function reopenNoticeList(message) {
    await P.reload();
    const q = noticeEnsure();
    q.items = []; q.total = 0; q.nextOffset = 0; q.error = null; q.loading = true;
    closeSheet(); openSheet(notificationsView()); noticeFetch('first');
    if (message) P.notice(message);
  }
  function deleteNotification(id) {
    if (!confirm('仅从自己的通知列表删除此消息？')) return;
    P.busy(async () => {
      const snapshot = notificationSnapshot;
      if (!snapshot || snapshot.epoch !== P.epoch || snapshot.raw.id !== id) throw new Error("请重新打开通知后再操作。");
      await P.mutation("notification-delete:" + id, "PATCH", "/notifications/" + endpoint(id),
        { action: "delete" }, snapshot.etag);
      await reopenNoticeList("通知已删除。");
    }, "notification-error");
  }
  function withdrawNotification(id) {
    if (!confirm('撤回此通知？撤回通知不会撤销业务申请或结果。')) return;
    P.busy(async () => {
      const snapshot = notificationSnapshot;
      if (!snapshot || snapshot.epoch !== P.epoch || snapshot.raw.id !== id) throw new Error("请重新打开通知后再操作。");
      await P.mutation("notification-withdraw:" + id, "POST", "/notifications/" + endpoint(id) + "/withdraw",
        { reason: "发起人撤回" });
      await reopenNoticeList("通知已撤回，业务结果不变。");
    }, "notification-error");
  }
  function withdrawRequestFromNotification(requestId) {
    const snapshot = notificationSnapshot;
    if (!snapshot || snapshot.epoch !== P.epoch || snapshot.raw.requestId !== requestId) throw new Error("请重新打开通知后再操作。");
    if (!confirm('撤销本人申请？任务将保持申请前的有效内容。')) return;
    P.busy(async () => {
      const request = await P.request("/approval-requests/" + encodeURIComponent(requestId));
      await P.mutation("notification-withdraw-request:" + requestId, "PATCH",
        "/approval-requests/" + encodeURIComponent(requestId), { decision: "withdraw" }, '"' + request.rowVersion + '"');
      await reopenNoticeList("本人申请已撤销，任务保持申请前内容。");
    }, "notification-error");
  }
  function openNotificationTask(id) {
    const snapshot = notificationSnapshot;
    if (!snapshot || snapshot.raw.id !== id || !snapshot.raw.taskId) { P.notice("该消息没有可查看的任务。"); return; }
    openTaskDetail(snapshot.raw.taskId);
  }
  /* 评论通知定位到对象详情底部评论区；任务和日志分别走各自已鉴权的详情入口。 */
  function openNotificationObject(id) {
    const snapshot = notificationSnapshot;
    if (!snapshot || snapshot.raw.id !== id) { P.notice("请重新打开该通知。"); return; }
    const raw = snapshot.raw;
    if (!raw.objectType || !raw.objectId) { P.notice("该消息没有可定位的对象。"); return; }
    P.commentFocus = raw.focus === "comments" ? raw.objectId : null;
    if (raw.objectType === "task") openTaskDetail(raw.objectId);
    else if (raw.objectType === "log") openLogDetail(raw.objectId);
    else P.notice("该消息的对象暂不支持打开。");
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
    if (analysis && analysis.epoch !== P.epoch) analysis = null;
    const result = analysis ? analysis.result : null;
    const stat = result ? result.summary || {} : P.data.analytics || {};
    const labels = [["任务总数","total"],["进行中","doing"],["待开始","todo"],["已完成","done"],["待完成审核","pendingComplete"],["全部待审冻结","frozen"],["逾期未完成","overdue"]];
    const priority = stat.priority || {};
    const priorities = [["紧急","urgent"],["高","high"],["中","medium"],["低","low"]];
    const suggestions = result ? result.suggestions || [] : [];
    const words = stat.keywords || [];
    const maxCount = words.length ? Number(words[0].count || 1) : 1;
    const cloud = words.length ? words.map(w => {
      const count = Number(w.count || 0);
      return '<span style="font-size:' + (12 + Math.round(count / maxCount * 8)) + 'px;font-weight:' + (count > 1 ? 700 : 500) +
        ';color:' + (count > 1 ? '#1d4ed8' : '#4b5563') + '" title="' + esc(w.word + "：出现 " + count + " 次") + '">' + esc(w.word) + '</span>';
    }).join("") : '<span class="tiny muted">范围内暂无可提取的关键词</span>';
    const scope = result ? result.statisticsScopeLabel : stat.scopeLabel;
    const suggestionScope = result ? result.suggestionScopeLabel : "按当前授权自动确定";
    const generatedAt = result ? result.generatedAt : stat.generatedAt;
    const ruleNames = { overdue: "已逾期", remaining_20_percent: "剩余工期 20%", remaining_10_percent: "剩余工期 10%",
      remaining_5_percent: "剩余工期 5%", schedule_conflict: "排期冲突", high_priority: "高紧急程度" };
    const methodNames = { local_proportional_schedule_rules: "本地规则统计", current_effective_tasks: "当前有效任务" };
    const methodLabel = method => methodNames[method] || "本地规则统计";
    function suggestionHTML(item){
      const sourceIds = Array.from(new Set(item.sourceTaskIds || (item.taskId ? [item.taskId] : [])));
      const links = sourceIds.filter(id => taskById(id)).map(id => '<button type="button" class="btn tiny-btn" data-task="' + esc(id) + '">查看「' + esc(taskById(id).title) + '」</button>').join("");
      return '<div class="advice"><div class="row"><strong>' + esc(ruleNames[item.rule] || item.rule) + '</strong><span class="tiny muted">' +
        esc(item.title || "规则建议") + '</span></div><p>' + esc(item.message) + '</p>' + (links ? '<div class="action-grid">' + links + '</div>' : '') + '</div>';
    }
    document.getElementById("page-ai").innerHTML =
      '<section class="card"><div class="card-head"><h2>任务数据统计</h2><span class="hint">' + esc(scope || "当前授权范围") + '</span></div><div class="stat-grid">' +
      labels.map(([label,key]) => '<div class="stat"><div class="v">' + esc(stat[key] == null ? "—" : stat[key]) + '</div><div class="k">' + label + '</div></div>').join("") +
      '</div><h3>紧急程度分布</h3><div class="stat-grid">' + priorities.map(([label,key]) => '<div class="stat"><div class="v">' + esc(priority[key] == null ? "—" : priority[key]) + '</div><div class="k">' + label + '</div></div>').join("") +
      '</div><p class="tiny muted">统计方法：当前有效任务 · 更新于 ' + esc(timeText(generatedAt)) + '</p></section>' +
      '<section class="card"><div class="card-head"><h2>关键词词云</h2><span class="hint">' + esc(scope || "当前授权范围") + '</span></div><div class="wc">' + cloud + '</div><p class="tiny muted">从授权范围内任务的标题和说明实时提取，不读取工作日志。</p></section>' +
      '<section class="card"><div class="card-head"><h2>规则建议</h2><span class="hint">' + esc(suggestionScope) + '</span></div><p class="tiny muted">本地规则计算：比例临期、逾期、排期冲突和高紧急程度；不调用外部模型，不修改任务。</p>' +
      '<div class="action-grid">' + button("p-refresh-analysis", analysisLoading ? "正在重算…" : "刷新并重算", null, "primary") +
      '</div><div class="callout" id="analysis-error" hidden></div>' +
      (analysisLoading ? '<div class="empty">正在按当前权限重新计算…</div>' : result ? '<p class="tiny muted">生成于 ' + esc(timeText(result.generatedAt)) + ' · ' + esc(methodLabel(result.method)) + '</p>' +
        (suggestions.length ? suggestions.map(suggestionHTML).join("") : '<div class="empty">当前没有触发比例临期、逾期、排期冲突或高紧急规则</div>')
        : '<div class="empty">进入本页后将自动按当前权限生成分析</div>') + '</section>';
    const refresh = document.querySelector('[data-action="p-refresh-analysis"]');
    if (refresh) refresh.disabled = analysisLoading;
  };
  async function createAnalysis(silent) {
    analysisLoading = true;
    if (state.page === "ai") renderAI();
    try {
      const job = await P.mutation("ai-job:" + P.epoch + ":" + (++analysisSequence), "POST", "/ai-jobs", { scopeType: "auto" });
      const saved = await P.request("/ai-jobs/" + endpoint(job.jobId));
      analysis = { epoch: P.epoch, jobId: job.jobId, result: saved.result };
      P.data.analytics = saved.result.summary;
      if (!silent) P.notice("已按当前权限刷新规则分析。");
      return saved.result;
    } finally {
      analysisLoading = false;
      if (state.page === "ai") renderAI();
    }
  }
  function generateAnalysis(silent) {
    return P.busy(() => createAnalysis(!!silent), "analysis-error");
  }
  renderMe = function () {
    const me = P.data.me || {}, superior = personById(me.managerId);
    const rows = [["姓名",me.displayName],["部门",me.departmentName || "公司层"],["团队",me.teamName || "无"],["身份",ROLE_LABEL[me.role] || me.role],["直属上级",superior ? superior.name : me.managerId ? "资料不在当前可见范围" : "无"]];
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
      case "clear-log-author":
        state.logAuthorQuery = "";
        { const input = document.getElementById("logAuthorInput"); if (input) { input.value = ""; input.focus(); } }
        refreshLogResults();
        return;
      case "toggle-logs-mine":
        return;
      case "clear-log-task":
        if (drafts.log) drafts.log.relationshipChanged = true;
        oldActions(el); return;
      case "fill-log-source": fillLogSource(el); return;
      case "picker-task-confirm":
        if (taskPicker.kind === "log" && drafts.log) drafts.log.relationshipChanged = true;
        oldActions(el); return;
      case "p-open-log": openLogDetail(el.dataset.id); return;
      case "p-notice-category": noticeApplyFilter('category', el.dataset.value); return;
      case "p-notice-read": noticeApplyFilter('read', el.dataset.value); return;
      case "p-notice-reset": noticeResetFilters(); return;
      case "p-notice-mode": noticeToggleMode(); return;
      case "p-notice-more": { const q = noticeEnsure(); if (!q.loading && q.nextOffset != null) noticeFetch('more'); return; }
      case "p-notice-retry": { const q = noticeEnsure(); noticeFetch(q.lastMode || 'first'); return; }
      case "p-hide-notification": deleteNotification(el.dataset.id); return;
      case "p-withdraw-notification": withdrawNotification(el.dataset.id); return;
      case "p-withdraw-notification-request": withdrawRequestFromNotification(el.dataset.id); return;
      case "p-open-notification-task": openNotificationTask(el.dataset.id); return;
      case "p-open-notification-object": openNotificationObject(el.dataset.id); return;
      case "p-open-historical-task": openHistoricalTask(el.dataset.id); return;
      case "p-generate-analysis": case "p-refresh-analysis":
        P.busy(async () => { analysis = null; await P.reload(); P.notice("已读取最新数据并重新计算分析。"); }, "analysis-error"); return;
      case "p-refresh-workspace": P.busy(async () => { analysis = null; await P.reload(); P.notice("已读取最新数据。"); }); return;
      case "p-logout": P.busy(() => P.logout()); return;
      case "new-consult": case "save-consult": case "reply-consult": case "save-reply":
        P.notice("请示功能尚未接入后端，未保存任何内容。"); return;
      default: oldActions(el);
    }
  };
  P.reload = async function () {
    analysis = null;
    const data = await oldReload.apply(P, arguments);
    if (state.page === "ai") await createAnalysis(true);
    return data;
  };
  setPage = function (page) {
    if (page === "ai") analysis = null;
    oldSetPage(page);
    if (page === "ai") generateAnalysis(true);
  };
  RENDER.map = renderMap; RENDER.log = renderLog; RENDER.ai = renderAI; RENDER.me = renderMe;
})();
