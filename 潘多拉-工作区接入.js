"use strict";
/* 原型工作区适配：沿用原布局、选择器和弹层，写入由后端校验权限与版本。 */
(function () {
  const P = window.Pandora;
  if (!P) return;
  const version = row => '"' + row.rowVersion + '"';
  const endpoint = id => encodeURIComponent(id);
  let logSnapshot = null, notificationSnapshot = null, analysis = null, analysisLoading = false, analysisSequence = 0;
  const homeVersions = new Map();
  const oldMap = renderMap;
  const oldLogForm = logFormView;
  const oldPersonalForm = personalItemFormView;
  const oldDeleteView = confirmDeleteView;
  const oldActions = runAction;
  const oldNotifications = openNotifications;
  const oldReload = P.reload;
  const oldSetPage = setPage;

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

  personalItemsFor = function (pid) {
    if (!P.data.me || P.data.me.id !== pid) return [];
    return ((P.data.home || {}).personalItems || []).map(row => ({ id: row.id, text: row.body || row.title, raw: row }));
  };
  const HOME_PRIORITY = { urgent: "紧急", high: "高", medium: "中", low: "低" };
  function homeAssignedBody() {
    const items = (P.data.home || {}).assignedTasks || [];
    if (!items.length) return '<div class="empty">暂无被派发的未完成任务</div>';
    return items.map(item =>
      '<button type="button" class="home-task" data-task="' + esc(item.taskId) + '"><span class="home-task-title">' +
        esc(item.title) + '</span><span class="home-task-priority">' + esc(HOME_PRIORITY[item.priority] || "中") + '</span></button>'
    ).join("");
  }
  function homePersonalBody() {
    const items = (P.data.home || {}).personalItems || [];
    if (!items.length) return '<div class="empty">暂无个人信息，可手动添加</div>';
    return items.map((item, index) =>
      '<button type="button" class="item-line home-personal-item" data-action="p-open-home-personal" data-id="' + esc(item.id) +
        '"><span class="idx">' + (index + 1) + '</span><span class="txt">' + esc(item.body || item.title) + '</span></button>'
    ).join("");
  }
  function homeLogsBody() {
    const logs = (P.data.home || {}).recentLogs || [];
    if (!logs.length) return '<div class="empty">近十天暂无日志</div>';
    return logs.map(l =>
      '<button type="button" class="log-line" data-log="' + esc(l.id) + '"><span class="lt">' + esc(l.businessDate) +
      '</span><span class="lc">' + esc(l.body) + '</span></button>'
    ).join("");
  }
  renderMap = function () {
    const home = P.data.home || {};
    const company = home.companyItems || [];
    const personal = home.personalItems || [];
    const assigned = home.assignedTasks || [];
    const today = new Date();
    const weekday = ["星期日","星期一","星期二","星期三","星期四","星期五","星期六"][today.getDay()];
    document.getElementById("page-map").innerHTML =
      '<section class="workday"><div class="workday-copy"><h2>' + esc(fmtDate(today)) + '</h2><p>' + esc(weekday) + '</p></div>' +
      '</section>' +
      '<div class="map-grid">' +
        '<section class="quad company-quad" aria-labelledby="q1"><div class="card-head"><h2 id="q1">公司事项</h2><span class="hint">统一发布</span></div>' +
          '<div class="q-body" tabindex="0" role="region" aria-labelledby="q1">' + (company.length ? company.map((item, index) =>
            '<div class="item-line"><div class="item-main"><span class="idx">' + (index + 1) + '</span><span class="txt">' + esc(item.body || item.title) + '</span></div></div>'
          ).join("") : '<div class="empty">暂无公司信息</div>') + '</div></section>' +
        '<section class="quad tasks-quad" aria-labelledby="q2"><div class="card-head"><h2 id="q2">我的待办</h2><span class="hint">' +
          assigned.length + '/10</span></div><div class="q-body" tabindex="0" role="region" aria-labelledby="q2">' + homeAssignedBody() + '</div></section>' +
        '<section class="quad personal-quad" aria-labelledby="q3"><div class="card-head has-actions"><h2 id="q3">个人事项</h2><span class="hint">' +
          personal.length + '/10 · 本人维护</span><button type="button" class="btn tiny-btn" data-action="new-personal"' +
          (personal.length >= 10 ? ' disabled' : '') + ' aria-label="新增个人信息">新增</button></div>' +
          '<div class="q-body" tabindex="0" role="region" aria-labelledby="q3">' + homePersonalBody() + '</div></section>' +
        '<section class="quad logs-quad" aria-labelledby="q4"><div class="card-head"><h2 id="q4">日志</h2><span class="hint">最近10条</span></div>' +
          '<div class="q-body" tabindex="0" role="region" aria-labelledby="q4">' + homeLogsBody() + '</div></section>' +
      '</div>';
  };

  function openPersonalDetail(id) {
    return P.busy(async function () {
      const raw = await P.request("/home/items/" + endpoint(id));
      openSheet({ title: "个人信息", body: '<p style="white-space:pre-wrap;overflow-wrap:anywhere">' + esc(raw.body || raw.title) + '</p>',
        foot: withBack(button("p-edit-home-personal", "编辑", id, "primary") + button("p-delete-home-personal", "删除", id, "danger") + button("sheet-close", "关闭")) });
    });
  }

  LOG_FILTER_LABEL.logs = "日志";
/* ---------- 日志：本人 + 授权范围，部门 → 团队 → 人员逐层搜索（第七章 7.3） ---------- */
function logDirectory() { return P.data.logAuthors || {}; }
function logAuthors() { return logDirectory().items || []; }
function logDepartmentKey(person) { return person.departmentId || '__none__'; }
function logDepartment() { return state.logDepartmentId || '__all__'; }
function logTeam() { return state.logTeamId || '__all__'; }
function logPersonQuery() { return String(state.logAuthorQuery || '').trim().toLowerCase(); }
function logDepartmentQuery() { return String(state.logDepartmentQuery || '').trim().toLowerCase(); }
function logTeamQuery() { return String(state.logTeamQuery || '').trim().toLowerCase(); }
function visibleDepartmentAuthors() {
  return logAuthors()
    .filter(person => logDepartment() === '__all__' || logDepartmentKey(person) === logDepartment())
    .filter(person => logTeam() === '__all__' || person.teamId === logTeam());
}
function departmentOptions() {
  const query = logDepartmentQuery();
  return (logDirectory().departments || []).filter(row => !query || String(row.name || '').toLowerCase().includes(query));
}
function teamOptions() {
  const query = logTeamQuery();
  return (logDirectory().teams || [])
    .filter(row => logDepartment() === '__all__' || (row.departmentId || '__none__') === logDepartment())
    .filter(row => !query || String(row.name || '').toLowerCase().includes(query));
}
function personOptions() {
  const query = logPersonQuery();
  return visibleDepartmentAuthors().filter(person =>
    !query || String(person.displayName || '').toLowerCase().includes(query));
}
function logAuthorId() {
  if (state.logAll) return null;
  return state.logAuthorId || (P.data.me || {}).id || null;
}
function logScopeLabel() {
  const total = filteredLogs(actor()).length;
  if (state.logAll) {
    const parts = [];
    const department = (logDirectory().departments || []).find(row => row.id === logDepartment());
    const team = (logDirectory().teams || []).find(row => row.id === logTeam());
    if (department) parts.push(department.name);
    if (team) parts.push(team.name);
    return (parts.length ? parts.join(' · ') : '权限内全部') + ' · ' + total + ' 条';
  }
  const id = logAuthorId();
  if (id && id === (P.data.me || {}).id) return '本人日志 · ' + total + ' 条';
  const person = logAuthors().find(row => row.id === id);
  return (person ? person.displayName : '所选人员') + ' 的日志 · ' + total + ' 条';
}
filteredLogs = function () {
  const authorId = logAuthorId();
  const allowed = visibleDepartmentAuthors();
  return visibleLogs(actor())
    .filter(l => !authorId || l.authorId === authorId)
    .filter(l => allowed.some(person => person.id === l.authorId))
    .slice().sort((x, y) => y.time.getTime() - x.time.getTime());
};
function logOptionsHTML(rows, valueKey, label) {
  return rows.map(row => '<option value="' + esc(row[valueKey]) + '"' + (row.selected ? ' selected' : '') + '>' + esc(label(row)) + '</option>').join('');
}
function logFindingHTML() {
  const departments = departmentOptions();
  const teams = teamOptions();
  const people = personOptions();
  const allLabel = logDepartment() === '__all__' ? '权限内全部人员' : '该部门全部人员';
  return '<details class="card log-author-filter" id="logFindingCard"' + (state.logFilterOpen ? ' open' : '') + '><summary>人员筛选<span class="tiny muted">先选部门，再选团队和人员</span></summary>' +
    '<div class="log-filter-grid">' +
      '<div class="field"><label for="logDepartmentSearch">部门搜索</label><input id="logDepartmentSearch" type="search" autocomplete="off" placeholder="输入部门名称" value="' + esc(state.logDepartmentQuery || '') + '">' +
        '<label for="logDepartmentSelect">部门</label><select id="logDepartmentSelect"><option value="__all__"' + (logDepartment() === '__all__' ? ' selected' : '') + '>全部可见部门</option>' +
        logOptionsHTML(departments.map(row => Object.assign({ selected: row.id === logDepartment() }, row)), 'id', row => row.name + '（' + row.count + '人）') + '</select></div>' +
      '<div class="field"><label for="logTeamSearch">团队搜索</label><input id="logTeamSearch" type="search" autocomplete="off" placeholder="输入团队名称" value="' + esc(state.logTeamQuery || '') + '">' +
        '<label for="logTeamSelect">团队</label><select id="logTeamSelect"><option value="__all__"' + (logTeam() === '__all__' ? ' selected' : '') + '>全部团队（含无团队）</option>' +
        logOptionsHTML(teams.map(row => Object.assign({ selected: row.id === logTeam() }, row)), 'id', row => (row.name || '未命名团队') + '（' + row.count + '人）') + '</select></div>' +
      '<div class="field"><label for="logAuthorInput">人员搜索</label><input id="logAuthorInput" type="search" autocomplete="off" placeholder="输入姓名或登录名" value="' + esc(state.logAuthorQuery || '') + '">' +
        '<label for="logAuthorSelect">人员</label><select id="logAuthorSelect"><option value="__all__"' + (state.logAll ? ' selected' : '') + '>' + allLabel + '</option>' +
        logOptionsHTML(people.map(row => Object.assign({ selected: !state.logAll && row.id === logAuthorId(), me: row.id === (P.data.me || {}).id }, row)), 'id', row => (row.displayName || '相关成员') + (row.teamName ? ' · ' + row.teamName : ' · 无团队') + (row.self ? '（我）' : '')) + '</select></div>' +
    '</div>' +
    (departments.length || people.length ? '' : '<div class="empty">当前权限内没有匹配的部门或人员</div>') +
    '<p class="tiny muted">仅显示你有权限查看日志的部门和人员；切换部门或团队会清理不匹配的下级选择。</p></details>';
}
function refreshLogFindingOptions() {
  const card = document.getElementById('logFindingCard');
  if (!card) return;
  const departments = departmentOptions(), teams = teamOptions(), people = personOptions();
  const deptSelect = document.getElementById('logDepartmentSelect');
  if (deptSelect) deptSelect.innerHTML = '<option value="__all__"' + (logDepartment() === '__all__' ? ' selected' : '') + '>全部可见部门</option>' +
    logOptionsHTML(departments.map(row => Object.assign({ selected: row.id === logDepartment() }, row)), 'id', row => row.name + '（' + row.count + '人）');
  const teamSelect = document.getElementById('logTeamSelect');
  if (teamSelect) teamSelect.innerHTML = '<option value="__all__"' + (logTeam() === '__all__' ? ' selected' : '') + '>全部团队（含无团队）</option>' +
    logOptionsHTML(teams.map(row => Object.assign({ selected: row.id === logTeam() }, row)), 'id', row => (row.name || '未命名团队') + '（' + row.count + '人）');
  const authorSelect = document.getElementById('logAuthorSelect');
  if (authorSelect) {
    const allLabel = logDepartment() === '__all__' ? '权限内全部人员' : '该部门全部人员';
    authorSelect.innerHTML = '<option value="__all__"' + (state.logAll ? ' selected' : '') + '>' + allLabel + '</option>' +
      logOptionsHTML(people.map(row => Object.assign({ selected: !state.logAll && row.id === logAuthorId(), self: row.id === (P.data.me || {}).id }, row)), 'id', row => (row.displayName || '相关成员') + (row.teamName ? ' · ' + row.teamName : ' · 无团队') + (row.self ? '（我）' : ''));
  }
  const empty = card.querySelector('.empty');
  if (empty) empty.hidden = departments.length > 0 || people.length > 0;
}
document.addEventListener('toggle', event => {
  if (event.target.id === 'logFindingCard') state.logFilterOpen = event.target.open;
}, true);
renderLog = function () {
  document.getElementById("page-log").innerHTML =
    '<header class="p-log-header"><h2>日志</h2><div class="row">' + button("new-log", "写日志", null, "primary") +
      button("backfill-log", "补写") + '</div></header>' +
    logFindingHTML() +
    '<section class="card p-log-panel" id="p-log-panel"><div class="card-head"><h2>日志</h2>' +
      '<span class="hint" id="logResultsCount">' + esc(logScopeLabel()) + '</span></div>' +
      '<div id="logResults">' + logsListHTML(actor()) + '</div></section>';
};
refreshLogResults = function () {
  const results = document.getElementById("logResults");
  if (results) results.innerHTML = logsListHTML(actor());
  const count = document.getElementById("logResultsCount");
  if (count) count.textContent = logScopeLabel();
  const select = document.getElementById("logAuthorSelect");
  if (select) select.value = state.logAll ? "__all__" : (logAuthorId() || "__all__");
};
/* 候选列表只由已授权作者派生；切换上级条件立即清理不再匹配的下级选择。 */
function reconcileLogSelection() {
  const departmentIds = (logDirectory().departments || []).map(row => row.id);
  if (logDepartment() !== '__all__' && departmentIds.indexOf(logDepartment()) === -1) state.logDepartmentId = '__all__';
  const teamIds = (logDirectory().teams || []).map(row => row.id);
  if (logTeam() !== '__all__' && teamIds.indexOf(logTeam()) === -1) state.logTeamId = '__all__';
  const allowed = visibleDepartmentAuthors();
  if (!state.logAll && !allowed.some(person => person.id === logAuthorId())) {
    state.logAuthorId = (P.data.me || {}).id;
    state.logAll = !allowed.some(person => person.id === (P.data.me || {}).id);
  }
}
document.addEventListener('input', function (event) {
  if (!P.ready || state.page !== 'log' || !event.target) return;
  const id = event.target.id;
  if (id === 'logDepartmentSearch') { state.logDepartmentQuery = event.target.value; refreshLogFindingOptions(); }
  if (id === 'logTeamSearch') { state.logTeamQuery = event.target.value; refreshLogFindingOptions(); }
  if (id === 'logAuthorInput') { state.logAuthorQuery = event.target.value; refreshLogFindingOptions(); }
});
document.addEventListener("change", function (event) {
  if (!P.ready || state.page !== "log" || !event.target) return;
  const id = event.target.id;
  if (!['logAuthorSelect', 'logDepartmentSelect', 'logTeamSelect'].includes(id)) return;
  const value = event.target.value;
  const next = { department: logDepartment(), team: logTeam(), author: logAuthorId(), all: state.logAll };
  if (id === 'logDepartmentSelect') { next.department = value; next.team = '__all__'; }
  if (id === 'logTeamSelect') next.team = value;
  if (id === 'logAuthorSelect') { next.all = value === '__all__'; next.author = value === '__all__' ? null : value; }
  state.logDepartmentId = next.department;
  state.logTeamId = next.team;
  if (id === 'logAuthorSelect') {
    state.logAll = !!next.all;
    state.logAuthorId = next.author || (P.data.me || {}).id;
  }
  reconcileLogSelection();
  const all = state.logAll;
  const author = all ? null : logAuthorId();
  const scope = all || author !== (P.data.me || {}).id ? 'visible' : 'self';
  document.querySelectorAll('#logFindingCard select').forEach(select => { select.disabled = true; });
  P.busy(async () => {
    try {
      const items = await loadLogs("/work-logs?scope=" + scope + (author ? "&authorId=" + endpoint(author) : ""));
      replaceLogs(items);
      state.logAll = !!all;
      state.logAuthorId = author || (P.data.me || {}).id;
      state.logFilterOpen = true;
      if (state.page === 'log') renderLog();
    } catch (error) {
      state.logDepartmentId = next.department ? logDepartment() : '__all__';
      throw error;
    } finally {
      if (state.page === 'log') renderLog();
    }
  });
});

/* 日志卡片：显示标签与冻结状态（第七章/第八章 8.2）。 */
function logTagHTML(raw) {
  const tag = raw && raw.tag;
  if (!tag) return '';
  return '<span class="p-tag-pill' + (tag.deleted ? ' is-deleted' : '') + '" style="--tag-bg:' + esc(tag.color || '#ffe1ea') + ';--tag-bd:' + esc(tag.border || '#8a8f98') + '">' + esc(tag.name || '标签') + (tag.deleted ? '（已删除）' : '') + '</span>';
}
logCardHTML = function (l, a) {
  const t = l.taskId ? taskById(l.taskId) : null;
  const mine = l.authorId === a.id;
  const raw = l.raw || {};
  const frozen = raw.frozen === true || (raw.editable === false && mine);
  return '<article class="log-card" data-log-card="' + esc(l.id) + '">' +
    "<header><span class=\"who\">" + esc(personById(l.authorId) ? personById(l.authorId).name : (raw.authorName || '相关成员')) + "</span>" +
      "<span>" + esc(fmtDateTime(l.time)) + "</span>" +
      "<span>" + esc(relativeDayLabel(l.time)) + "</span>" +
      '<span class="spacer"></span>' +
      (mine && raw.editable !== false
        ? '<button type="button" class="btn tiny-btn" data-action="edit-log" data-id="' + esc(l.id) + '">编辑</button>'
        : '<span class="tiny muted">' + (frozen ? '已冻结' : '只读') + '</span>') +
    "</header>" +
    '<div class="row wrap">' + logTagHTML(raw) + '</div>' +
    "<p>" + esc(l.content) + "</p>" +
    (t ? '<button type="button" class="btn ghost tiny-btn log-link" data-task="' + esc(t.id) + '">关联任务：' + esc(t.title) + '</button>' : '<span class="tiny muted">未关联任务</span>') +
    '<div class="row"><button type="button" class="btn tiny-btn" data-action="p-open-log" data-id="' + esc(l.id) + '">查看与评论</button></div>' +
  "</article>";
};

/* ---------- 日志详情与全屏表单（7.4） ---------- */
function freezeText(raw) {
  if (!raw || !raw.frozenAt) return '';
  const at = new Date(raw.frozenAt);
  if (Number.isNaN(at.getTime())) return '';
  return (raw.frozen ? '已于 ' : '将于 ') + timeText(raw.frozenAt) + (raw.frozen ? ' 冻结，只能查看。' : ' 自动冻结（首次创建后 24 小时）。');
}
logDetailView = function (id) {
  const l = logById(id);
  if (!l) return null;
  const t = l.taskId ? taskById(l.taskId) : null;
  const raw = l.raw || {};
  const name = raw.authorName || (personById(l.authorId) || {}).name || "相关人员";
  return { title: "日志详情", body: '<div class="kv"><span class="k">作者</span><span class="v">' + esc(name) +
      '</span><span class="k">日志日期</span><span class="v">' + esc(raw.businessDate) +
      '</span><span class="k">创建时间</span><span class="v">' + esc(timeText(raw.createdAt)) +
      '</span><span class="k">编辑权限</span><span class="v">' + (raw.editable ? "本人可编辑" : "只读（" + (raw.frozen ? "已冻结" : "非作者") + "）") +
      '</span><span class="k">冻结</span><span class="v">' + esc(freezeText(raw) || "—") +
      '</span></div><div class="row wrap">' + logTagHTML(raw) + '</div><div class="divider"></div><p style="white-space:pre-wrap;overflow-wrap:anywhere">' + esc(l.content) + '</p>' +
      (t ? '<div class="divider"></div><button type="button" class="btn" data-task="' + esc(t.id) + '">关联：' + esc(t.title) + '</button>' : '') +
      '<div class="divider"></div>' + (P.commentsHTML ? P.commentsHTML("log", id) : ''),
    foot: withBack((raw.editable ? button("edit-log", "编辑日志", id, "primary") : "") + button("sheet-close", "关闭"), actor()) };
};
openLogDetail = function (id) {
  P.busy(async () => {
    const raw = await P.request("/work-logs/" + endpoint(id));
    putLog(raw); logSnapshot = { raw, epoch: P.epoch };
    openSheet(logDetailView(id));
  });
};
function logDraft(raw, businessDate) {
  return { id: raw ? raw.id : null, content: raw ? raw.body : "", taskId: raw ? raw.taskId || null : null,
    originalTaskId: raw ? raw.taskId || null : null, relationshipChanged: false,
    tagId: raw && Object.prototype.hasOwnProperty.call(raw, 'tagId') ? raw.tagId : null,
    originalTagId: raw && Object.prototype.hasOwnProperty.call(raw, 'tagId') ? raw.tagId : null,
    tagTouched: false,
    hiddenTask: !!raw && !Object.prototype.hasOwnProperty.call(raw, "taskId"),
    etag: raw ? version(raw) : null, epoch: P.epoch,
    businessDate: raw ? raw.businessDate : businessDate,
    frozen: !!(raw && raw.frozen), frozenAt: raw ? raw.frozenAt : null };
}
function companyBusinessDate() { return (P.data.home || {}).businessDate || toDateInput(new Date()); }
function logDateOptions() {
  const today = parseDateInput(companyBusinessDate()) || new Date();
  return [-2,-1,0].map(offset => {
    const date = addDays(today, offset);
    return { value: toDateInput(date), label: (offset === 0 ? '今天' : offset === -1 ? '昨天' : '前天') + ' · ' + (date.getMonth()+1) + '月' + date.getDate() + '日' };
  }).reverse();
}
function tagSelectHTML(kind, current) {
  const items = ((P.data.tags || {}).items || []).filter(tag => !tag.deleted || tag.id === current);
  return '<label class="p-tag-select"><span>标签（单选，可清除）</span><select id="' + kind + '-tag"><option value=""' + (!current ? ' selected' : '') + '>无标签</option>' +
    items.map(tag => '<option value="' + esc(tag.id) + '"' + (tag.id === current ? ' selected' : '') + '>' + esc(tag.name) + (tag.deleted ? '（已删除）' : '') + '</option>').join('') +
    '</select></label>';
}
/* 日志分页读取与整体替换：授权边界仍由服务端裁决，页面只替换已授权的完整结果。 */
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
/* 从人员资料进入某人的日志：清空先前的人员筛选，仍按日志权限重新查询。 */
P.openLogsFor = async function (id) {
  state.logDepartmentId = "__all__";
  state.logTeamId = "__all__";
  state.logDepartmentQuery = "";
  state.logTeamQuery = "";
  state.logAuthorQuery = "";
  await applyLogAuthor(id, false);
  setPage("log");
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
  P.busy(async () => {
    let raw = null;
    if (id) {
      raw = logSnapshot && logSnapshot.epoch === P.epoch && logSnapshot.raw.id === id && sheetTitleEl.textContent === "日志详情"
        ? logSnapshot.raw : await P.request("/work-logs/" + endpoint(id));
      if (!raw.editable) throw new Error("该日志已冻结或不是本人日志，不能再编辑。");
      putLog(raw);
    } else {
      const selected = date || companyBusinessDate();
      raw = await existingLogFor(selected);
      if (raw) {
        putLog(raw);
        if (!raw.editable) {
          // 已冻结的当日日志只读展示，不提供正文写入口。
          logSnapshot = { raw, epoch: P.epoch };
          openSheet(logDetailView(raw.id));
          P.notice("该日日志已冻结，只能查看。");
          return;
        }
      }
    }
    drafts.log = logDraft(raw, raw ? raw.businessDate : (date || companyBusinessDate()));
    openSheet(logFormView());
  });
};
async function openBackfillLog() {
  // A user who already wrote today still needs a page entry to backfill yesterday/the day before.
  for (const option of logDateOptions()) {
    if (!(await existingLogFor(option.value))) { openLogForm(null, option.value); return; }
  }
  P.notice("今天、昨天和前天都已有日志。");
}
document.addEventListener('click', function (event) {
  if (!P.ready || !event.target.closest) return;
  const trigger = event.target.closest('[data-action="backfill-log"]');
  if (!trigger) return;
  event.preventDefault(); event.stopImmediatePropagation();
  openBackfillLog().catch(error => P.notice(error.message));
}, true);
logFormView = function () {
  const d = drafts.log;
  if (!d) return null;
  const linked = d.taskId ? taskById(d.taskId) : null;
  const dates = logDateOptions();
  if (!dates.some(row => row.value === d.businessDate)) dates.push({ value: d.businessDate, label: d.businessDate });
  const body = '<div class="p-log-meta">' +
      '<div class="field"><label for="lf-date">日志日期（公司今天、昨天、前天）</label><select id="lf-date"' + (d.id ? ' disabled' : '') + '>' +
        dates.map(row => '<option value="' + esc(row.value) + '"' + (row.value === d.businessDate ? ' selected' : '') + '>' + esc(row.label) + '</option>').join('') +
      '</select></div>' + tagSelectHTML('lf', d.tagId) + '</div>' +
    '<div class="field log-content-field"><label for="lf-content">日志内容</label><textarea id="lf-content" maxlength="10000" data-autofocus>' + esc(d.content) + '</textarea></div>' +
    '<div class="field"><label>关联任务（可选）</label>' +
      '<div class="summary-line" id="lf-task-summary">' +
        (linked ? esc(linked.title) : (d.hiddenTask && !d.relationshipChanged ? '关联任务当前不可见，保留原关系' : '<span class="muted">未关联任务</span>')) + "</div>" +
      '<div class="row" style="margin-top:6px">' +
        '<button type="button" class="btn tiny-btn" data-action="pick-log-task">选择关联任务</button>' +
        (d.taskId ? '<button type="button" class="btn tiny-btn ghost" data-action="clear-log-task">清空关联</button>' : '') +
      "</div>" +
      '<span class="tiny muted">日志归属于本人，按日志权限只读分享给范围内的上级；只有本人可以编辑。</span></div>' +
    (d.frozenAt ? '<div class="callout info">' + esc(freezeText({ frozen: d.frozen, frozenAt: d.frozenAt }) || '') + '</div>' : '') +
    '<div class="callout" id="lf-error" hidden></div>';
  return { title: d.id ? "编辑日志" : "写日志", body: body,
    foot: withBack('<button type="button" class="btn primary" data-action="save-log">保存日志</button>', actor()),
    draftKind: "log", rebuild: logFormView, fullscreen: true };
};
syncLogDraft = function () {
  if (!drafts.log) return;
  const content = document.getElementById("lf-content");
  if (content) drafts.log.content = content.value;
  const date = document.getElementById("lf-date");
  if (date && !drafts.log.id) drafts.log.businessDate = date.value;
  const tag = document.getElementById("lf-tag");
  if (tag) drafts.log.tagId = tag.value || null;
};
document.addEventListener('change', function (event) {
  if (!P.ready || !event.target || !drafts.log) return;
  if (event.target.id === 'lf-tag') { drafts.log.tagId = event.target.value || null; drafts.log.tagTouched = true; return; }
  if (event.target.id !== 'lf-date' || drafts.log.id) return;
  syncLogDraft();
  if (drafts.log.content.trim()) {
    // 先保留已写内容：换日期只在空表单时自动切换，避免丢失草稿。
    drafts.log.businessDate = event.target.value;
    return;
  }
  openLogForm(null, event.target.value);
});
saveLog = function () {
  P.busy(async () => {
    syncLogDraft();
    const d = drafts.log;
    if (!d || d.epoch !== P.epoch) throw new Error("请重新打开日志后再保存。");
    const content = String(d.content || "").trim();
    if (!content) throw new Error("请填写日志内容。");
    const body = { body: content };
    if (!d.id) body.businessDate = d.businessDate;
    if (!d.id || d.relationshipChanged || d.taskId !== d.originalTaskId) body.taskId = d.taskId || null;
    if (!d.id || d.tagTouched) body.tagId = d.tagId || null;
    try {
      await P.mutation("work-log:" + (d.id || "new"), d.id ? "PATCH" : "POST",
        "/work-logs" + (d.id ? "/" + endpoint(d.id) : ""), body, d.etag);
    } catch (error) {
      if (!d.id && error.code === "WORK_LOG_EXISTS" && error.body && error.body.logId) {
        const raw = await P.request("/work-logs/" + endpoint(error.body.logId));
        putLog(raw);
        drafts.log = logDraft(raw, raw.businessDate);
        replaceTopSheet(logFormView());
        P.notice("该日期已有日志，已打开已有记录继续编辑。");
        return;
      }
      if (error.code === "WORK_LOG_FROZEN") {
        await P.reload();
        closeSheet();
        P.notice("该日志已满24小时，只能查看。");
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
  const PURPOSE_FALLBACK = { comment: "新评论", task: "任务通知", log: "日志" };
  function notificationPurpose(raw) {
    if (raw.purpose) return raw.purpose;
    const type = String(raw.eventType || "");
    if (type.startsWith("comment.")) return PURPOSE_FALLBACK.comment;
    return PURPOSE_FALLBACK.task;
  }
  /* 列表直接说明用途、对象名称和实际摘要；长标题只截断标题行，不会遮住用途。 */
  notificationsView = function () {
    const list = notificationsFor();
    return { title: "通知", notification: true, body: list.length ? list.map(n => {
      const raw = n.raw;
      const purpose = notificationPurpose(raw);
      const objectName = raw.objectName || raw.title || "";
      const summary = raw.summary || "";
      const state = raw.revoked ? "已撤回" : raw.relationLost ? "权限已变化" : raw.readAt ? "已读" : "未读";
      return '<button type="button" class="notif' + (raw.readAt ? ' is-read' : '') + (raw.revoked ? ' is-withdrawn' : '') +
        '" data-action="open-notif" data-id="' + esc(n.id) + '"><span class="ndot" aria-hidden="true"></span>' +
        '<span class="nbody"><span class="ntop"><span class="npurpose">' + esc(purpose) + '</span>' +
        (objectName ? '<span class="ntitle">' + esc(objectName) + '</span>' : '') + '</span>' +
        (summary && summary !== objectName ? '<span class="nsummary">' + esc(summary) + '</span>' : '') +
        '<span class="nmeta">' + esc(timeText(raw.createdAt)) + " · " + esc(state) + '</span></span></button>';
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
      '</span><span class="k">用途</span><span class="v">' + esc(notificationPurpose(raw)) +
      (raw.objectName ? '</span><span class="k">对象</span><span class="v">' + esc(raw.objectName) : '') +
      '</span><span class="k">状态</span><span class="v">' + (revoked ? "已撤回" : raw.readAt ? "已读" : "未读") + '</span></div>';
    if (revoked && !raw.canReadWithdrawnDetails) {
      body += '<div class="divider"></div><p>该通知已被撤回。</p>';
    } else {
      if (revoked) body += '<div class="callout info">该通知已撤回。你作为发起人的上级，可查看原通知内容；此页仅供只读查看。</div>';
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
    if (!revoked && raw.objectType && raw.objectId &&
        !(raw.objectType === "task" && (raw.relationLost || raw.readonly))) {
      buttons.push(button("p-open-notification-object", raw.focus === "comments" ? "定位到评论区" : "查看相关对象", raw.id));
    }
    if (!revoked) buttons.push(button("p-hide-notification", "删除此消息", raw.id));
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
      '<section class="card"><div class="card-head"><h2>规则建议</h2><span class="hint">' + esc(suggestionScope) + '</span></div><p class="tiny muted">本地规则分析：比例临期/逾期、排期冲突和高紧急程度；不调用外部模型，也不会修改任务。</p>' +
      '<div class="action-grid">' + button("p-refresh-analysis", analysisLoading ? "正在重算…" : "刷新并重算", null, "primary") +
      '</div><div class="callout" id="analysis-error" hidden></div>' +
      (analysisLoading ? '<div class="empty">正在按当前权限重新计算…</div>' : result ? '<p class="tiny muted">生成于 ' + esc(timeText(result.generatedAt)) + ' · ' + esc(result.method || "local_proportional_schedule_rules") + '</p>' +
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
      case "p-open-home-personal": openPersonalDetail(el.dataset.id); return;
      case "p-edit-home-personal": openHomeItem("personal", el.dataset.id, false); return;
      case "p-delete-home-personal": openHomeItem("personal", el.dataset.id, true); return;
      case "clear-log-task":
        if (drafts.log) drafts.log.relationshipChanged = true;
        oldActions(el); return;
      case "picker-task-confirm":
        if (taskPicker.kind === "log" && drafts.log) drafts.log.relationshipChanged = true;
        oldActions(el); return;
      case "p-open-log": openLogDetail(el.dataset.id); return;
      case "p-hide-notification": deleteNotification(el.dataset.id); return;
      case "p-withdraw-notification": withdrawNotification(el.dataset.id); return;
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
