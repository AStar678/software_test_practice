"use strict";
/* 任务表单：视图下的二级页面，用完整授权任务在本地完成组合筛选、排序、计数与分页。
   任何页面都不复制一套任务数据；本模块只持有会话内的表单条件与最近一次完整结果。 */
(function () {
  const P = window.Pandora;
  if (!P) return;
  const PAGE_SIZE = 50;
  const QUERY_MAX = 200;
  const QUERY_DELAY = 220;
  const RELATION_LABEL = { all: "全部", own: "我负责", created: "我创建", visible: "仅可见" };
  const COMPLETION_LABEL = { all: "全部", open: "未完成", done: "已完成" };
  const SORT_LABEL = { title: "任务名称", createdAt: "创建时间", start: "开始时间", due: "截止时间", urgency: "紧急程度", status: "执行状态" };
  const URGENCY_RANK = { "紧急": 0, "高": 1, "中": 2, "低": 3 };
  const STATUS_RANK = { todo: 0, doing: 1, done: 2 };
  const PENDING_LABEL = { create: "待创建审核", change: "修改资料待审", progress: "更新进展待审", complete: "完成待审", reopen: "重开待审", handover: "交接待审" };
  const COLUMN_VIEWS = {
    overview: { label: "概览", fields: ["title", "summary", "schedule", "assignees", "description"] },
    schedule: { label: "排期", fields: ["title", "start", "due", "urgency", "status", "allDay", "overdue"] },
    details: { label: "资料", fields: ["title", "assignees", "creator", "createdAt", "description", "acceptance", "progress", "parent"] },
    all: { label: "全部列", fields: ["title", "relation", "status", "pending", "due", "urgency", "assignees", "start", "creator", "createdAt", "description", "acceptance", "allDay", "done", "progress", "overdue", "parent"] }
  };
  const FIELD_LABEL = { title: "任务", relation: "本人关系", status: "执行状态", pending: "待审 / 冻结", due: "截止时间", urgency: "紧急程度", assignees: "负责人", start: "开始时间", creator: "创建者", createdAt: "创建时间", description: "任务说明", acceptance: "完成标准", allDay: "排期类型", done: "是否完成", progress: "进展备注", overdue: "逾期", parent: "上级任务", summary: "状态", schedule: "排期" };
  const FIELD_WIDTH = { title: "var(--p-title-width)", summary: "var(--p-summary-width)", schedule: "var(--p-schedule-width)", start: "136px", due: "136px", createdAt: "136px", assignees: "150px", creator: "150px", description: "220px", acceptance: "220px", progress: "220px", parent: "200px" };

  function defaultFilters() { return { relation: "all", completion: "all", query: "", from: "", to: "" }; }
  const T = {
    active: false, rows: [], loaded: false, loading: false, error: null,
    filters: defaultFilters(), sort: { key: "start", dir: "asc" },
    page: 0, queryTimer: 0, loadId: 0, result: null,
    returnContext: null, discarding: false, scrollMemory: null,
    columns: "overview", filtersOpen: false
  };

  /* ---------- 纯结果管线：不依赖会话状态，可由 node 检查脚本直接加载 ---------- */
  /* Company calendar date (YYYY-MM-DD) for an instant. Returns null for a missing or invalid zone
     instead of silently falling back to the device timezone. */
  function companyDateKey(value, timeZone) {
    if (value == null || value === "") return null;
    const date = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(date.getTime())) return null;
    try {
      const parts = new Intl.DateTimeFormat("en-US", { timeZone: timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(date);
      const part = type => (parts.find(row => row.type === type) || {}).value;
      const year = part("year"), month = part("month"), day = part("day");
      return year && month && day ? year + "-" + month + "-" + day : null;
    } catch (_) { return null; }
  }
  /* Company wall clock (YYYY-MM-DD HH:mm) for a timed instant. */
  function companyDateTime(value, timeZone) {
    if (value == null || value === "") return "—";
    const date = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(date.getTime())) return "—";
    try {
      const parts = new Intl.DateTimeFormat("en-US", { timeZone: timeZone, year: "numeric", month: "2-digit", day: "2-digit",
        hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(date);
      const part = type => (parts.find(row => row.type === type) || {}).value;
      const year = part("year"), month = part("month"), day = part("day"), hour = part("hour"), minute = part("minute");
      if (year && month && day && hour && minute) return year + "-" + month + "-" + day + " " + hour + ":" + minute;
    } catch (_) { return "—"; }
    return "—";
  }
  function taskRaw(task) { return task && task.raw ? task.raw : {}; }
  function taskBusinessDates(task, timeZone) {
    const raw = taskRaw(task);
    if (task && task.allDay) return { start: raw.startDate || null, due: raw.dueDate || null };
    return { start: companyDateKey(raw.startAt, timeZone), due: companyDateKey(raw.dueAt, timeZone) };
  }
  function taskIsDone(task) {
    const raw = taskRaw(task);
    const state = raw.executionState || (task && task.status);
    return state === "done";
  }
  function taskIsOverdue(task, nowMs) {
    if (!task || taskIsDone(task)) return false;
    const due = taskRaw(task).dueAt;
    if (!due) return false;
    const instant = new Date(due).getTime();
    return !Number.isNaN(instant) && instant < (nowMs == null ? Date.now() : nowMs);
  }
  function relationOf(task, accountId) {
    const assigned = ((task && task.assigneeIds) || []).indexOf(accountId) !== -1;
    const created = !!task && task.creatorId === accountId;
    return { assigned: assigned, created: created, visibleOnly: !assigned && !created };
  }
  function matchesTaskFilters(task, filters, accountId, timeZone) {
    const relation = relationOf(task, accountId);
    if (filters.relation === "own" && !relation.assigned) return false;
    if (filters.relation === "created" && !relation.created) return false;
    if (filters.relation === "visible" && !relation.visibleOnly) return false;
    const done = taskIsDone(task);
    if (filters.completion === "open" && done) return false;
    if (filters.completion === "done" && !done) return false;
    const query = String(filters.query || "").trim().toLowerCase();
    if (query && String(task && task.title || "").toLowerCase().indexOf(query) === -1) return false;
    if (filters.from || filters.to) {
      const dates = taskBusinessDates(task, timeZone);
      if (!dates.start || !dates.due) return false;
      /* Closed intersection: task start <= selected end, task due >= selected start. */
      if (filters.to && dates.start > filters.to) return false;
      if (filters.from && dates.due < filters.from) return false;
    }
    return true;
  }
  function taskSortValue(task, key) {
    const raw = taskRaw(task);
    if (key === "createdAt") return new Date(raw.createdAt || 0).getTime() || 0;
    if (key === "start") return new Date(raw.startAt || 0).getTime() || 0;
    if (key === "due") return new Date(raw.dueAt || 0).getTime() || 0;
    if (key === "urgency") {
      const rank = URGENCY_RANK[task && task.urgency];
      return rank == null ? 2 : rank;
    }
    if (key === "status") {
      const rank = STATUS_RANK[raw.executionState || (task && task.status)];
      return rank == null ? 0 : rank;
    }
    return 0;
  }
  function sortTaskRows(rows, key, direction) {
    const sign = direction === "desc" ? -1 : 1;
    let collator = null;
    try { collator = new Intl.Collator("zh-Hans-CN"); } catch (_) { collator = null; }
    return rows.slice().sort(function (left, right) {
      let value = 0;
      if (key === "title") {
        const a = String(left && left.title || ""), b = String(right && right.title || "");
        value = collator ? collator.compare(a, b) : a.localeCompare(b);
      } else {
        value = taskSortValue(left, key) - taskSortValue(right, key);
      }
      if (value !== 0) return value * sign;
      /* Ties always fall back to the ascending task id, in both directions. */
      return left.id < right.id ? -1 : left.id > right.id ? 1 : 0;
    });
  }
  function pageTaskRows(rows, page, pageSize) {
    const size = Math.max(1, Math.floor(pageSize || PAGE_SIZE));
    const pages = Math.max(1, Math.ceil(rows.length / size));
    const index = Math.min(Math.max(0, Math.floor(page || 0)), pages - 1);
    const begin = index * size;
    return { page: index, pages: pages, begin: begin, end: Math.min(begin + size, rows.length), total: rows.length, items: rows.slice(begin, begin + size) };
  }
  function computeTaskForm(rows, options) {
    const config = options || {};
    const filters = config.filters || defaultFilters();
    const filtered = (rows || []).filter(function (task) { return matchesTaskFilters(task, filters, config.accountId, config.timeZone); });
    const sort = config.sort || { key: "start", dir: "asc" };
    const sorted = sortTaskRows(filtered, sort.key, sort.dir);
    const paged = pageTaskRows(sorted, config.page, config.pageSize || PAGE_SIZE);
    return { rows: filtered, sorted: sorted, paged: paged };
  }

  /* ---------- session helpers ---------- */
  function tableActive() { return T.active && state.viewPage === "table" && state.page === "view"; }
  function accountId() { return (P.data && P.data.me && P.data.me.id) || null; }
  function companyZone() {
    const value = P.data && P.data.me && P.data.me.organizationTimeZone;
    if (typeof value !== "string" || !value) return null;
    try { new Intl.DateTimeFormat("en-US", { timeZone: value }).format(new Date()); return value; } catch (_) { return null; }
  }
  function rawRows() { return Array.isArray(T.rows) ? T.rows : []; }
  function filteredResult() {
    return computeTaskForm(rawRows(), {
      accountId: accountId(), timeZone: companyZone() || "UTC", filters: T.filters,
      sort: T.sort, page: T.page, pageSize: PAGE_SIZE, nowMs: Date.now()
    });
  }
  function resetFormState() {
    clearTimeout(T.queryTimer); T.queryTimer = 0;
    T.filters = defaultFilters();
    T.sort = { key: "start", dir: "asc" };
    T.page = 0; T.result = null;
  }
  function sessionReset() {
    T.loadId += 1;
    T.active = false; T.rows = []; T.loaded = false; T.loading = false; T.error = null;
    T.returnContext = null; T.discarding = false;
    T.columns = "overview"; T.filtersOpen = false; T.scrollMemory = null;
    resetFormState();
    state.viewPage = "calendar";
  }
  P.sessionReset.push(sessionReset);

  /* ---------- rendering ---------- */
  function relationTags(task) {
    const relation = relationOf(task, accountId());
    if (relation.visibleOnly) return '<span class="p-table-tag">仅可见</span>';
    return (relation.assigned ? '<span class="p-table-tag is-own">负责</span>' : '') +
      (relation.created ? '<span class="p-table-tag is-created">创建</span>' : '');
  }
  function personLabel(id, raw) {
    if (!id) return "—";
    const summaries = raw && raw.participants || [];
    const known = summaries.find(function (person) { return person.id === id; });
    if (known) return known.displayName || known.name || "相关成员";
    const person = typeof personById === "function" ? personById(id) : null;
    if (person) return person.name || person.displayName || "相关成员";
    const me = P.data && P.data.me;
    if (me && me.id === id) return me.displayName || me.name || "本人";
    return "相关成员";
  }
  function namesText(ids, raw) {
    const list = (ids || []).map(function (id) { return personLabel(id, raw); });
    return list.length ? list.join("、") : "—";
  }
  function preview(text) {
    const value = String(text == null ? "" : text);
    return value ? value : "—";
  }
  function previewCell(text, field) {
    const value = String(text == null ? "" : text);
    if (!value) return '<td data-field="' + field + '">—</td>';
    return '<td data-field="' + field + '" class="p-table-preview" title="' + esc(value) + '"><span>' + esc(value) + '</span></td>';
  }
  function scheduleCell(task, zone, key) {
    const raw = taskRaw(task);
    if (key === "start") {
      if (task.allDay) return raw.startDate ? raw.startDate + '（全天）' : "—";
      return companyDateTime(raw.startAt, zone);
    }
    if (task.allDay) return raw.dueDate ? raw.dueDate + '（全天）' : "—";
    return companyDateTime(raw.dueAt, zone);
  }
  function dateCell(task, zone, key) {
    const value = key === "createdAt" ? companyDateTime(taskRaw(task).createdAt, zone) : scheduleCell(task, zone, key);
    const match = /^(\d{4}-\d{2}-\d{2}) (\d{2}:\d{2})$/.exec(value);
    return '<td data-field="' + key + '"><span class="p-table-date">' + (match
      ? '<span>' + match[1] + '</span><strong>' + match[2] + '</strong>' : esc(value)) + '</span></td>';
  }
  function compactSchedule(task, zone, key) {
    const raw = taskRaw(task), value = scheduleCell(task, zone, key);
    if (value === "—") return value;
    const today = companyDateKey(new Date(), zone);
    const short = today && value.slice(0, 4) === today.slice(0, 4) ? value.slice(5).replace(/-/g, "/") : value;
    const parts = short.replace("（全天）", "").split(" ");
    return '<time datetime="' + esc(task.allDay ? raw[key === "start" ? "startDate" : "dueDate"] : raw[key === "start" ? "startAt" : "dueAt"]) + '" title="' + esc(value) + '" aria-label="' + esc(value) + '">' + parts.map(part => '<span>' + esc(part) + '</span>').join("") + '</time>';
  }
  function titleCell(task) {
    return '<th scope="row" data-field="title"><button type="button" class="p-table-title" data-task="' + esc(task.id) + '" title="' + esc(task.title || "任务") + '"><span class="p-table-title-text">' + esc(task.title || "任务") + '</span></button>' +
      (T.columns === "overview" ? '<div class="p-table-title-meta">' + relationTags(task) + '<span class="p-table-priority" data-priority="' + esc(task.urgency || "中") + '">' + esc(task.urgency || "中") + '</span></div>' : '') + '</th>';
  }
  function summaryCell(task) {
    const raw = taskRaw(task), kind = task.pendingKind || raw.pendingKind;
    return '<td data-field="summary"><div class="p-table-cell-stack">' + statusBadge(task) +
      (kind ? '<span class="p-table-pending">' + esc(PENDING_LABEL[kind] || "待审") + '</span>' : '') +
      (task.frozen || raw.frozen ? '<span class="p-table-frozen">冻结</span>' : '') +
      (taskIsOverdue(task) ? '<span class="p-table-overdue">已逾期</span>' : '') + '</div></td>';
  }
  function pendingCell(task) {
    const raw = taskRaw(task);
    const kind = task.pendingKind || raw.pendingKind;
    if (!kind) return '<td data-field="pending">—</td>';
    return '<td data-field="pending"><span class="p-table-tag is-pending">' + esc(PENDING_LABEL[kind] || "待审") + '</span>' +
      (task.frozen || raw.frozen ? '<span class="p-table-tag">冻结</span>' : '') + '</td>';
  }
  function parentCell(task) {
    const raw = taskRaw(task);
    if (!raw.parentTaskId) return '<td data-field="parent">—</td>';
    const parent = typeof taskById === "function" ? taskById(raw.parentTaskId) : null;
    if (!parent) return '<td data-field="parent">—</td>';
    return '<td data-field="parent"><button type="button" class="p-table-link" data-task="' + esc(parent.id) + '">' + esc(parent.title) + '</button></td>';
  }
  function cellHTML(task, zone, field) {
    const raw = taskRaw(task);
    if (field === "title") return titleCell(task);
    if (field === "summary") return summaryCell(task);
    if (field === "schedule") return '<td data-field="schedule"><div class="p-table-schedule-stack"><span><small>起</small>' + compactSchedule(task, zone, "start") + '</span><span><small>止</small>' + compactSchedule(task, zone, "due") + '</span>' + (task.allDay ? '<span class="p-table-schedule-kind">全天</span>' : raw.startAt === raw.dueAt ? '<span class="p-table-schedule-kind">时间点</span>' : '') + '</div></td>';
    if (["start", "due", "createdAt"].includes(field)) return dateCell(task, zone, field);
    if (field === "description") return previewCell(task.desc, field);
    if (field === "acceptance") return previewCell(task.acceptanceCriteria || raw.acceptanceCriteria, field);
    if (field === "progress") return previewCell(task.progressNote, field);
    if (field === "pending") return pendingCell(task);
    if (field === "parent") return parentCell(task);
    const values = {
      relation: relationTags(task), status: statusBadge(task), urgency: urgencyBadge(task.urgency),
      assignees: esc(namesText(task.assigneeIds, raw)), creator: esc(personLabel(task.creatorId, raw)),
      allDay: task.allDay ? "全天" : "定时", done: taskIsDone(task) ? "是" : "否",
      overdue: taskIsOverdue(task) ? '<span class="p-table-overdue">已逾期</span>' : "—"
    };
    return '<td data-field="' + field + '">' + values[field] + '</td>';
  }
  function fields() { return COLUMN_VIEWS[T.columns].fields; }
  function rowHTML(task, zone) {
    return '<tr data-task-row="' + esc(task.id) + '">' + fields().map(field => cellHTML(task, zone, field)).join("") + '</tr>';
  }
  function sortButton(key, label) {
    const active = T.sort.key === key;
    const arrow = active ? (T.sort.dir === "asc" ? "▲" : "▼") : "↕";
    return '<button type="button" class="p-table-sort' + (active ? ' is-sorted' : '') + '" data-action="task-table-sort" data-key="' + key + '" aria-label="按' + SORT_LABEL[key] + '排序' +
      (active ? '，当前' + (T.sort.dir === "asc" ? "升序" : "降序") : '') + '">' + (label || SORT_LABEL[key]) +
      '<span class="p-table-arrow" aria-hidden="true">' + arrow + '</span></button>';
  }
  function headHTML() {
    return '<tr>' + fields().map(function (field) {
      const key = field === "summary" ? "status" : field === "schedule" && ["start", "due"].includes(T.sort.key) ? T.sort.key : field;
      const active = key === T.sort.key;
      const label = field === "schedule" ? '<div class="p-table-schedule-sorts">' + sortButton("start", "开始") + sortButton("due", "截止") + '</div>'
        : SORT_LABEL[key] ? sortButton(key, FIELD_LABEL[field]) : FIELD_LABEL[field];
      return '<th scope="col" data-field="' + field + '"' + (SORT_LABEL[key] ? ' aria-sort="' + (active ? (T.sort.dir === "asc" ? "ascending" : "descending") : "none") + '"' : '') + '>' + label + '</th>';
    }).join("") + '</tr>';
  }
  function emptyRow(message, action) {
    return '<tr class="p-table-empty"><td colspan="' + fields().length + '"><div class="p-table-empty-body">' + message + (action || "") + '</div></td></tr>';
  }
  function pagerHTML(result) {
    if (!result || !T.loaded || T.error) return "";
    const paged = result.paged;
    const from = paged.total ? paged.begin + 1 : 0;
    return '<span class="p-table-range">第 ' + from + '–' + paged.end + ' 条，共 ' + paged.total + ' 条 · 第 ' + (paged.page + 1) + '/' + paged.pages + ' 页</span>' +
      '<span class="p-table-page-actions"><button type="button" class="btn tiny-btn" data-action="task-table-prev"' + (paged.page <= 0 ? " disabled" : "") + '>上一页</button>' +
      '<button type="button" class="btn tiny-btn" data-action="task-table-next"' + (paged.page >= paged.pages - 1 ? " disabled" : "") + '>下一页</button></span>';
  }
  function filterBarHTML() {
    return '<div class="p-table-filters" role="search" aria-label="任务表单筛选">' +
      '<div class="p-table-filter-top"><label class="p-table-field p-table-search"><span class="sr-only">任务名称</span><input id="p-filter-query" type="search" autocomplete="off" maxlength="' + QUERY_MAX + '" placeholder="搜索任务名称" value="' + esc(T.filters.query) + '"></label>' +
      '<button type="button" class="p-table-filter-toggle" id="p-table-filter-toggle" data-action="task-table-filters" aria-controls="p-table-filter-panel" aria-expanded="' + T.filtersOpen + '">筛选</button></div>' +
      '<div class="p-table-filter-summary" id="p-table-filter-summary" hidden></div>' +
      '<div class="p-table-filter-panel" id="p-table-filter-panel"' + (T.filtersOpen ? '' : ' hidden') + '>' +
      '<label class="p-table-field">关系<select id="p-filter-relation">' + Object.keys(RELATION_LABEL).map(function (key) {
        return '<option value="' + key + '"' + (T.filters.relation === key ? " selected" : "") + '>' + RELATION_LABEL[key] + '</option>';
      }).join("") + '</select></label>' +
      '<label class="p-table-field">完成<select id="p-filter-completion">' + Object.keys(COMPLETION_LABEL).map(function (key) {
        return '<option value="' + key + '"' + (T.filters.completion === key ? " selected" : "") + '>' + COMPLETION_LABEL[key] + '</option>';
      }).join("") + '</select></label>' +
      '<label class="p-table-field">日期从<input id="p-filter-from" type="date" value="' + esc(T.filters.from) + '"></label>' +
      '<label class="p-table-field">日期至<input id="p-filter-to" type="date" value="' + esc(T.filters.to) + '"></label>' +
      '<button type="button" class="btn tiny-btn" data-action="task-table-clear-filters">清空筛选</button></div></div>' +
      '<div class="callout reject" id="p-table-filter-error" role="alert" hidden></div>';
  }
  function pageHTML() {
    return '<section class="card p-task-table-card" aria-label="任务表单">' +
      '<header class="p-table-header"><div class="p-table-heading">' +
        '<button type="button" class="p-table-back" data-action="task-table-close">返回日历</button>' +
        '<h2>任务表单</h2></div>' +
        '<div class="p-table-tools"><button type="button" class="btn tiny-btn" data-action="task-table-refresh" aria-label="刷新任务">刷新</button></div></header>' +
      filterBarHTML() +
      '<div class="p-table-column-views" id="p-table-column-views" role="group" aria-label="查看任务列">' + Object.keys(COLUMN_VIEWS).map(function (key) {
        return '<button type="button" class="p-table-view-switch" data-action="task-table-columns" data-columns="' + key + '" aria-pressed="' + (T.columns === key) + '">' + COLUMN_VIEWS[key].label + '</button>';
      }).join('') + '</div>' +
      '<div class="p-table-column-nav"><span id="p-table-column-hint">左右滑动查看更多</span><div><button type="button" class="p-table-pan" data-action="task-table-pan" data-direction="-1" aria-label="向左查看任务列">‹</button><button type="button" class="p-table-pan" data-action="task-table-pan" data-direction="1" aria-label="向右查看更多任务列">›</button></div></div>' +
      '<div class="p-table-scroll" id="p-table-scroll" tabindex="0" role="region" aria-label="任务表，可纵向和横向滚动">' +
        '<table class="p-task-table"><colgroup id="p-table-cols"></colgroup>' +
        '<thead id="p-table-head"></thead><tbody id="p-table-body"></tbody></table></div>' +
      '<nav class="p-table-pager" id="p-table-pager" aria-label="任务分页"></nav></section>';
  }
  function setTableError(message) {
    const box = document.getElementById("p-table-filter-error");
    if (!box) return;
    box.textContent = message || "";
    box.hidden = !message;
  }

  function syncFilterControls() {
    const selected = [];
    if (T.filters.relation !== "all") selected.push(RELATION_LABEL[T.filters.relation]);
    if (T.filters.completion !== "all") selected.push(COMPLETION_LABEL[T.filters.completion]);
    if (T.filters.from || T.filters.to) selected.push((T.filters.from || "不限开始") + " 至 " + (T.filters.to || "不限结束"));
    const toggle = document.getElementById("p-table-filter-toggle"), panel = document.getElementById("p-table-filter-panel"), summary = document.getElementById("p-table-filter-summary");
    if (toggle) { toggle.textContent = (T.filtersOpen ? "收起筛选" : "筛选") + (selected.length ? " · " + selected.length : ""); toggle.setAttribute("aria-expanded", String(T.filtersOpen)); }
    if (panel) panel.hidden = !T.filtersOpen;
    if (summary) { summary.textContent = selected.join(" · "); summary.title = selected.join(" · "); summary.hidden = !selected.length || T.filtersOpen; }
    document.querySelectorAll(".p-table-view-switch").forEach(button => button.setAttribute("aria-pressed", String(button.dataset.columns === T.columns)));
  }
  function scrollPosition(scroller) {
    if (!scroller) return { top: 0, left: 0 };
    const top = scroller.scrollTop, left = scroller.scrollLeft;
    const edge = scroller.getBoundingClientRect().top + (document.getElementById("p-table-head")?.getBoundingClientRect().height || 0);
    const row = top > 0 && Array.from(scroller.querySelectorAll("[data-task-row]")).find(item => item.getBoundingClientRect().bottom > edge + 1);
    return { top, left, anchor: row ? row.dataset.taskRow : null, offset: row ? row.getBoundingClientRect().top - edge : 0 };
  }
  function restoreScroll(scroller, position) {
    if (!scroller || !position) return;
    scroller.scrollTop = position.top; scroller.scrollLeft = position.left;
    const row = position.anchor && Array.from(scroller.querySelectorAll("[data-task-row]")).find(item => item.dataset.taskRow === position.anchor);
    if (row) {
      const edge = scroller.getBoundingClientRect().top + document.getElementById("p-table-head").getBoundingClientRect().height;
      scroller.scrollTop += row.getBoundingClientRect().top - edge - position.offset;
    }
  }
  function syncPanControls() {
    const scroller = document.getElementById("p-table-scroll");
    if (!scroller || !tableActive()) return;
    const max = Math.max(0, scroller.scrollWidth - scroller.clientWidth), left = scroller.scrollLeft;
    const card = scroller.closest(".p-task-table-card");
    card.classList.toggle("is-panned", left > 1);
    card.style.setProperty("--p-table-viewport-width", scroller.clientWidth + "px");
    const prev = card.querySelector('[data-action="task-table-pan"][data-direction="-1"]'), next = card.querySelector('[data-action="task-table-pan"][data-direction="1"]');
    if (prev) prev.disabled = left < 1;
    if (next) next.disabled = max - left < 1;
    const hint = document.getElementById("p-table-column-hint");
    if (hint) hint.textContent = max < 2 ? "全部列已显示" : left < 1 ? "左右滑动查看更多" : max - left < 2 ? "已到最后一列" : "左右滑动，任务名称固定";
  }
  function layoutColumns() {
    const table = document.querySelector(".p-task-table"), cols = document.getElementById("p-table-cols");
    if (!table || !cols) return;
    const width = field => FIELD_WIDTH[field] || "112px";
    cols.innerHTML = fields().map(field => '<col data-field="' + field + '" style="width:' + width(field) + '">').join("");
    table.dataset.columns = T.columns;
    table.style.width = "calc(" + fields().map(width).join(" + ") + ")";
    syncFilterControls();
    requestAnimationFrame(syncPanControls);
  }
  function paintFromStart() {
    const scroller = document.getElementById("p-table-scroll");
    T.scrollMemory = { top: 0, left: scroller ? scroller.scrollLeft : 0 };
    paintResults();
  }

  function paintResults() {
    if (!tableActive()) return;
    // A synchronous filter, sort, page or column change already consumes the latest query.
    // Do not let its old debounce repaint reset the position after the reader has moved on.
    clearTimeout(T.queryTimer); T.queryTimer = 0;
    const head = document.getElementById("p-table-head");
    const body = document.getElementById("p-table-body");
    if (!head || !body) return;
    const scroller = document.getElementById("p-table-scroll");
    const keepScroll = T.scrollMemory != null ? T.scrollMemory : scrollPosition(scroller);
    T.scrollMemory = null;
    const pager = document.getElementById("p-table-pager");
    layoutColumns();

    if (T.loading) {
      head.innerHTML = headHTML();
      body.innerHTML = emptyRow("正在加载当前授权任务…");
      if (pager) pager.innerHTML = "";
      // Keep the reader's place across the masked refresh and restore it with the new rows.
      if (scroller) T.scrollMemory = keepScroll;
      return;
    }
    if (T.error) {
      head.innerHTML = headHTML();
      body.innerHTML = emptyRow("任务加载失败：" + esc(T.error), '<button type="button" class="btn tiny-btn primary" data-action="task-table-retry">重试</button>');
      if (pager) pager.innerHTML = "";
      if (scroller) T.scrollMemory = keepScroll;
      return;
    }
    if (!companyZone()) {
      head.innerHTML = headHTML();
      body.innerHTML = emptyRow("无法确定公司时区，任务日期不能按业务口径显示。", '<button type="button" class="btn tiny-btn primary" data-action="task-table-retry">重试</button>');
      if (pager) pager.innerHTML = "";
      return;
    }

    const zone = companyZone();
    const result = filteredResult();
    T.result = result;
    T.page = result.paged.page;
    head.innerHTML = headHTML();
    if (!rawRows().length) {
      body.innerHTML = emptyRow("当前没有可查看的任务。", '<button type="button" class="btn tiny-btn" data-action="task-table-refresh">重新加载</button>');
      if (pager) pager.innerHTML = "";
      return;
    }
    if (!result.paged.total) {
      body.innerHTML = emptyRow("没有符合筛选条件的任务。", '<button type="button" class="btn tiny-btn" data-action="task-table-clear-filters">清空筛选</button>');
    } else {
      body.innerHTML = result.paged.items.map(function (task) { return rowHTML(task, zone); }).join("");
    }
    if (pager) pager.innerHTML = pagerHTML(result);
    restoreScroll(scroller, keepScroll);
    syncPanControls();
  }

  function renderTaskTablePage() {
    const previous = document.getElementById("p-table-scroll");
    if (previous && !T.scrollMemory) T.scrollMemory = scrollPosition(previous);
    document.getElementById("page-view").innerHTML = pageHTML();
    paintResults();
  }

  /* ---------- loading and refresh ---------- */
  async function ensureCompanyZone(loadId) {
    if (companyZone()) return companyZone();
    try {
      const me = await P.request("/me");
      if (loadId !== T.loadId) return null;
      if (me && typeof me.organizationTimeZone === "string") P.data.me = Object.assign({}, P.data.me || {}, me);
    } catch (error) {
      if (error.name === "AbortError") return null;
      throw error;
    }
    return companyZone();
  }
  async function refreshTable() {
    if (!tableActive()) return;
    const loadId = ++T.loadId;
    T.loading = true; T.error = null;
    paintResults();
    try {
      const zone = await ensureCompanyZone(loadId);
      if (!tableActive() || loadId !== T.loadId) return;
      if (!zone) throw new Error("公司时区缺失或无效，已停止显示任务，以免按设备时区误算日期。");
      await P.refreshTasks();
      if (!tableActive() || loadId !== T.loadId) return;
      // The shared mapped task set is the single source for filters, sorting and the table cells.
      T.rows = TASKS.slice();
      T.loaded = true; T.loading = false; T.error = null;
      paintResults();
    } catch (error) {
      if (error.name === "AbortError" || loadId !== T.loadId) return;
      T.loading = false; T.loaded = false; T.error = error.message || "无法加载任务。";
      paintResults();
    }
  }
  function openTable() {
    if (!P.ready || state.page !== "view") return;
    if (state.viewPage !== "table") {
      // Save the calendar context, including the continuous-month anchor, so returning from the
      // table or a task detail reopens the same month stream and date (chapter 6.1).
      T.returnContext = { mode: state.viewMode, anchor: new Date(state.viewAnchor),
        stream: P.calendar && P.calendar.currentStream ? P.calendar.currentStream() : [],
        anchorKey: companyDateKey(state.viewAnchor, companyZone() || "UTC") };
      resetFormState();
      T.columns = "overview"; T.filtersOpen = false; T.scrollMemory = null;
    }
    state.viewPage = "table";
    T.active = true; T.loaded = false; T.loading = true; T.error = null;
    renderAll();
    refreshTable();
  }
  function closeTable() {
    if (state.viewPage !== "table") return;
    const context = T.returnContext;
    state.viewPage = "calendar";
    T.active = false; T.loadId += 1;
    T.returnContext = null;
    restoreCalendarContext(context);
    resetFormState();
    T.rows = []; T.loaded = false; T.loading = false; T.error = null;
    T.scrollMemory = null;
    renderAll();
    // Returning must rebuild the calendar projection from the latest effective owners.
    P.refreshTasks().then(function () {
      if (state.viewPage === "calendar" && state.page === "view") renderAll();
    }).catch(function (error) {
      if (error.name !== "AbortError") P.notice("刷新任务失败：" + error.message);
    });
  }

  /* 返回日历：模式与日期恢复，连续月份锚点在账号重置后按保存的月份序列重建。 */
  function restoreCalendarContext(context) {
    if (!context) return;
    if (context.mode === "day" || context.mode === "month") state.viewMode = context.mode;
    if (context.anchor instanceof Date && !Number.isNaN(context.anchor.getTime())) state.viewAnchor = new Date(context.anchor);
    if (!P.calendar || state.viewMode !== "month") return;
    const current = P.calendar.currentStream ? P.calendar.currentStream() : [];
    const saved = Array.isArray(context.stream) ? context.stream : [];
    if (saved.length && JSON.stringify(current) !== JSON.stringify(saved)) {
      if (P.calendar.restoreStream) P.calendar.restoreStream(saved);
      else P.calendar.resetStream(state.viewAnchor);
    }
  }

  /* ---------- actions and inputs ---------- */
  const previousAction = runAction;
  runAction = function (element) {
    const action = element.dataset.action;
    if (action === "task-table-open") { openTable(); return; }
    if (action === "task-table-close") { closeTable(); return; }
    if (action === "task-table-refresh" || action === "task-table-retry") { refreshTable(); return; }
    if (action === "task-table-columns") {
      if (!COLUMN_VIEWS[element.dataset.columns] || T.columns === element.dataset.columns) return;
      T.scrollMemory = T.scrollMemory || scrollPosition(document.getElementById("p-table-scroll"));
      T.scrollMemory.left = 0;
      T.columns = element.dataset.columns; paintResults(); return;
    }
    if (action === "task-table-filters") { T.filtersOpen = !T.filtersOpen; syncFilterControls(); requestAnimationFrame(syncPanControls); return; }
    if (action === "task-table-pan") {
      const scroller = document.getElementById("p-table-scroll"), title = document.querySelector('#p-table-head [data-field="title"]');
      if (scroller) scroller.scrollBy({ left: Number(element.dataset.direction) * Math.max(96, scroller.clientWidth - (title?.getBoundingClientRect().width || 136) - 12), behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
      return;
    }
    if (action === "task-table-sort") {
      const key = element.dataset.key;
      if (!SORT_LABEL[key]) return;
      if (T.sort.key === key) T.sort.dir = T.sort.dir === "asc" ? "desc" : "asc";
      else T.sort = { key: key, dir: "asc" };
      const restoreFocus = document.activeElement === element;
      T.page = 0; paintFromStart();
      if (restoreFocus) document.querySelector('.p-table-sort[data-key="' + key + '"]')?.focus({ preventScroll: true });
      return;
    }
    if (action === "task-table-prev") { T.page = Math.max(0, T.page - 1); paintFromStart(); return; }
    if (action === "task-table-next") { T.page = T.page + 1; paintFromStart(); return; }
    if (action === "task-table-clear-filters") {
      resetFormState();
      const relation = document.getElementById("p-filter-relation"), completion = document.getElementById("p-filter-completion");
      const query = document.getElementById("p-filter-query"), from = document.getElementById("p-filter-from"), to = document.getElementById("p-filter-to");
      if (relation) relation.value = "all";
      if (completion) completion.value = "all";
      if (query) query.value = "";
      if (from) from.value = "";
      if (to) to.value = "";
      setTableError("");
      paintFromStart();
      if (query) query.focus();
      return;
    }
    return previousAction(element);
  };

  document.addEventListener("scroll", function (event) { if (event.target?.id === "p-table-scroll") syncPanControls(); }, true);
  window.addEventListener("resize", syncPanControls);
  document.addEventListener("keydown", function (event) {
    if (event.key !== "Escape" || !tableActive() || !T.filtersOpen || !document.getElementById("overlay")?.hidden) return;
    event.preventDefault(); event.stopPropagation();
    T.filtersOpen = false; syncFilterControls();
    document.getElementById("p-table-filter-toggle")?.focus({ preventScroll: true });
  }, true);

  document.addEventListener("input", function (event) {
    if (!tableActive() || !event.target || event.target.id !== "p-filter-query") return;
    T.filters.query = String(event.target.value || "").slice(0, QUERY_MAX);
    T.page = 0;
    clearTimeout(T.queryTimer);
    T.queryTimer = setTimeout(function () { if (tableActive()) paintFromStart(); }, QUERY_DELAY);
  });
  document.addEventListener("change", function (event) {
    if (!tableActive() || !event.target) return;
    const id = event.target.id, value = event.target.value;
    if (id === "p-filter-relation" && RELATION_LABEL[value]) {
      T.filters.relation = value; T.page = 0; paintFromStart(); return;
    }
    if (id === "p-filter-completion" && COMPLETION_LABEL[value]) {
      T.filters.completion = value; T.page = 0; paintFromStart(); return;
    }
    if (id === "p-filter-from" || id === "p-filter-to") {
      const from = document.getElementById("p-filter-from"), to = document.getElementById("p-filter-to");
      const start = from ? from.value : "", end = to ? to.value : "";
      if (start && !/^\d{4}-\d{2}-\d{2}$/.test(start) || end && !/^\d{4}-\d{2}-\d{2}$/.test(end)) {
        setTableError("请选择有效的日期。"); return;
      }
      if (start && end && end < start) {
        /* Keep the last valid result instead of publishing an invalid range. */
        setTableError("结束日期不能早于开始日期，仍显示上一次有效结果。"); return;
      }
      setTableError("");
      T.filters.from = start; T.filters.to = end; T.page = 0; paintFromStart();
    }
  });

  /* 失权后的旧详情或写入不能靠缓存继续展示：403/404 时立即丢弃该行并重查授权集。 */
  const previousRequest = P.request;
  P.request = async function (path, options) {
    try { return await previousRequest(path, options); }
    catch (error) {
      const method = (options && options.method) || "GET";
      const target = String(path || "");
      if (tableActive() && (error.status === 403 || error.status === 404) &&
        (method === "GET" || method === "PATCH") && /^\/tasks\/[^/?]+$/.test(target)) {
        discardTask(target.slice("/tasks/".length));
      }
      throw error;
    }
  };
  function discardTask(rawId) {
    if (T.discarding) return;
    let id = rawId;
    try { id = decodeURIComponent(rawId); } catch (_) { /* keep the raw path segment */ }
    if (!id) return;
    T.discarding = true;
    T.rows = T.rows.filter(function (task) { return task.id !== id; });
    paintResults();
    refreshTable().catch(function () { /* the explicit error state already covers a failed re-query */ })
      .finally(function () { T.discarding = false; });
  }

  /* 业务写操作与审批成功后，任务集成层会调用 P.reload；表单用同一次完整结果重算。 */
  const previousReload = P.reload;
  P.reload = async function () {
    const data = await previousReload.apply(P, arguments);
    if (T.active) {
      T.rows = TASKS.slice();
      T.loaded = true; T.loading = false; T.error = null;
      if (tableActive()) paintResults();
    }
    return data;
  };

  document.addEventListener("visibilitychange", function () {
    if (!document.hidden && tableActive() && P.ready) refreshTable();
  });
  window.addEventListener("pageshow", function (event) {
    if (event.persisted && tableActive() && P.ready) refreshTable();
  });

  /* Render dispatch: the same page-view hosts calendar and table, and the five main navs stay fixed. */
  const previousRenderView = renderView;
  renderView = function () {
    if (state.viewPage === "table") { renderTaskTablePage(); return; }
    previousRenderView();
  };
  RENDER.view = renderView;
  const previousRenderAll = renderAll;
  renderAll = function () {
    const table = !!(P.ready && state.page === "view" && state.viewPage === "table");
    const phone = document.querySelector(".phone"), main = document.getElementById("appMain");
    if (phone) phone.classList.toggle("is-task-table", table);
    if (main) main.classList.toggle("is-task-table", table);
    previousRenderAll();
  };

  /* Main-navigation return into an already-open task table must re-query the full current
     authorization set. Only that transition triggers a load; internal paints, sorting, paging and
     ResizeObserver callbacks do not. Loading is set before the first render so retained rows and
     previous rows never appear as current results while the query is in flight. */
  const previousSetPage = setPage;
  setPage = function (page) {
    if (tableActive() && page !== "view") T.scrollMemory = scrollPosition(document.getElementById("p-table-scroll"));
    const returningToTable = page === "view" && state.page !== "view" && state.viewPage === "table" && !!P.ready;
    if (returningToTable) { T.loading = true; T.error = null; }
    previousSetPage(page);
    if (returningToTable) refreshTable();
  };

  /* Test/automation surface: the same pure pipeline the page uses. */
  P.taskForm = {
    pageSize: PAGE_SIZE, queryMax: QUERY_MAX,
    state: T,
    open: openTable, close: closeTable, refresh: refreshTable, paint: paintResults,
    compute: computeTaskForm, matches: matchesTaskFilters, sort: sortTaskRows,
    page: pageTaskRows, relation: relationOf, isDone: taskIsDone, isOverdue: taskIsOverdue,
    businessDates: taskBusinessDates, companyDateKey: companyDateKey, companyDateTime: companyDateTime,
    companyZone: companyZone, current: filteredResult
  };
})();
