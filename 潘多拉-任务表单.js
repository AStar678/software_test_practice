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

  function defaultFilters() { return { relation: "all", completion: "all", query: "", from: "", to: "" }; }
  const T = {
    active: false, rows: [], loaded: false, loading: false, error: null,
    filters: defaultFilters(), sort: { key: "start", dir: "asc" },
    page: 0, queryTimer: 0, loadId: 0, result: null,
    returnContext: null, discarding: false, scrollMemory: null
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
  function summarizeTaskRows(rows, accountId, nowMs) {
    const counts = { total: rows.length, own: 0, created: 0, visible: 0, pendingComplete: 0, done: 0, overdue: 0 };
    rows.forEach(function (task) {
      const relation = relationOf(task, accountId);
      if (relation.assigned) counts.own += 1;
      if (relation.created) counts.created += 1;
      if (relation.visibleOnly) counts.visible += 1;
      if (task && task.pendingKind === "complete") counts.pendingComplete += 1;
      if (taskIsDone(task)) counts.done += 1;
      if (taskIsOverdue(task, nowMs)) counts.overdue += 1;
    });
    return counts;
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
    const counts = summarizeTaskRows(filtered, config.accountId, config.nowMs);
    const sort = config.sort || { key: "start", dir: "asc" };
    const sorted = sortTaskRows(filtered, sort.key, sort.dir);
    const paged = pageTaskRows(sorted, config.page, config.pageSize || PAGE_SIZE);
    return { rows: filtered, sorted: sorted, counts: counts, paged: paged };
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
  function rowHTML(task, zone) {
    const raw = taskRaw(task);
    const overdue = taskIsOverdue(task);
    return '<tr data-task-row="' + esc(task.id) + '">' +
      '<th scope="row" data-field="title"><button type="button" class="p-table-title" data-task="' + esc(task.id) + '">' + esc(task.title || "任务") + '</button></th>' +
      '<td data-field="relation">' + relationTags(task) + '</td>' +
      '<td data-field="assignees">' + esc(namesText(task.assigneeIds, raw)) + '</td>' +
      '<td data-field="creator">' + esc(personLabel(task.creatorId, raw)) + '</td>' +
      '<td data-field="createdAt">' + esc(companyDateTime(raw.createdAt, zone)) + '</td>' +
      previewCell(task.desc, "description") +
      previewCell(task.acceptanceCriteria || raw.acceptanceCriteria, "acceptance") +
      '<td data-field="start">' + esc(scheduleCell(task, zone, "start")) + '</td>' +
      '<td data-field="due">' + esc(scheduleCell(task, zone, "due")) + '</td>' +
      '<td data-field="allDay">' + (task.allDay ? "全天" : "定时") + '</td>' +
      '<td data-field="status">' + statusBadge(task) + '</td>' +
      '<td data-field="done">' + (taskIsDone(task) ? "是" : "否") + '</td>' +
      '<td data-field="urgency">' + urgencyBadge(task.urgency) + '</td>' +
      previewCell(task.progressNote, "progress") +
      pendingCell(task) +
      '<td data-field="overdue">' + (overdue ? '<span class="badge b-urgent">已逾期</span>' : "—") + '</td>' +
      parentCell(task) +
      '</tr>';
  }
  function sortHeader(key, zone) {
    const active = T.sort.key === key;
    const direction = active ? T.sort.dir : "none";
    const arrow = active ? (T.sort.dir === "asc" ? "▲" : "▼") : "↕";
    return '<th scope="col" aria-sort="' + (active ? (T.sort.dir === "asc" ? "ascending" : "descending") : "none") + '">' +
      '<button type="button" class="p-table-sort" data-action="task-table-sort" data-key="' + key + '" aria-label="按' + SORT_LABEL[key] + '排序' +
      (active ? '，当前' + (T.sort.dir === "asc" ? "升序" : "降序") : '') + '">' + SORT_LABEL[key] +
      '<span class="p-table-arrow" aria-hidden="true">' + arrow + '</span></button></th>';
  }
  function headHTML() {
    return '<tr>' + sortHeader("title") + '<th scope="col">本人关系</th><th scope="col">负责人</th><th scope="col">创建者</th>' +
      sortHeader("createdAt") + '<th scope="col">任务说明</th><th scope="col">完成标准</th>' +
      sortHeader("start") + sortHeader("due") + '<th scope="col">排期类型</th>' +
      sortHeader("status") + '<th scope="col">是否完成</th>' + sortHeader("urgency") +
      '<th scope="col">进展备注</th><th scope="col">待审/冻结</th><th scope="col">逾期</th><th scope="col">上级任务</th></tr>';
  }
  function countsHTML(result) {
    const counts = result ? result.counts : { total: 0, own: 0, created: 0, visible: 0, pendingComplete: 0, done: 0, overdue: 0 };
    const items = [["total", "总数", counts.total], ["own", "我负责", counts.own], ["created", "我创建", counts.created],
      ["visible", "仅可见", counts.visible], ["pendingComplete", "待完成审核", counts.pendingComplete],
      ["done", "已完成", counts.done], ["overdue", "逾期未完成", counts.overdue]];
    return items.map(function (item) {
      return '<span class="p-table-count" data-count="' + item[0] + '"><b>' + item[2] + '</b>' + item[1] + '</span>';
    }).join("");
  }
  function emptyRow(message, action) {
    return '<tr class="p-table-empty"><td colspan="17"><div class="p-table-empty-body">' + message + (action || "") + '</div></td></tr>';
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
      '<label class="p-table-field">关系<select id="p-filter-relation">' + Object.keys(RELATION_LABEL).map(function (key) {
        return '<option value="' + key + '"' + (T.filters.relation === key ? " selected" : "") + '>' + RELATION_LABEL[key] + '</option>';
      }).join("") + '</select></label>' +
      '<label class="p-table-field">完成<select id="p-filter-completion">' + Object.keys(COMPLETION_LABEL).map(function (key) {
        return '<option value="' + key + '"' + (T.filters.completion === key ? " selected" : "") + '>' + COMPLETION_LABEL[key] + '</option>';
      }).join("") + '</select></label>' +
      '<label class="p-table-field p-table-search">任务名称<input id="p-filter-query" type="search" autocomplete="off" maxlength="' + QUERY_MAX + '" placeholder="输入名称片段" value="' + esc(T.filters.query) + '"></label>' +
      '<label class="p-table-field">开始日期起<input id="p-filter-from" type="date" value="' + esc(T.filters.from) + '"></label>' +
      '<label class="p-table-field">截止日期止<input id="p-filter-to" type="date" value="' + esc(T.filters.to) + '"></label>' +
      '<button type="button" class="btn tiny-btn" data-action="task-table-clear-filters">清空筛选</button></div>' +
      '<div class="callout reject" id="p-table-filter-error" role="alert" hidden></div>';
  }
  function pageHTML() {
    return '<section class="card p-task-table-card" aria-label="任务表单">' +
      '<header class="p-table-header"><div class="p-table-heading">' +
        '<button type="button" class="p-table-back" data-action="task-table-close">返回日历</button>' +
        '<h2>任务表单</h2><span class="p-table-source">当前授权正常任务</span></div>' +
        '<div class="p-table-tools"><button type="button" class="btn tiny-btn primary" data-action="task-table-refresh">刷新任务</button></div></header>' +
      filterBarHTML() +
      '<div class="p-table-counts" id="p-table-counts" aria-live="polite"></div>' +
      '<div class="p-table-scroll" id="p-table-scroll" tabindex="0" role="region" aria-label="任务表，可纵向和横向滚动">' +
        '<table class="p-task-table"><caption>任务名称固定在左侧，列头可排序；点击任务名称打开原任务详情。</caption>' +
        '<thead id="p-table-head"></thead><tbody id="p-table-body"></tbody></table></div>' +
      '<nav class="p-table-pager" id="p-table-pager" aria-label="任务分页"></nav></section>';
  }
  function setTableError(message) {
    const box = document.getElementById("p-table-filter-error");
    if (!box) return;
    box.textContent = message || "";
    box.hidden = !message;
  }

  function paintResults() {
    if (!tableActive()) return;
    const head = document.getElementById("p-table-head");
    const body = document.getElementById("p-table-body");
    if (!head || !body) return;
    const scroller = document.getElementById("p-table-scroll");
    const keepScroll = T.scrollMemory != null ? T.scrollMemory : (scroller ? scroller.scrollTop : 0);
    T.scrollMemory = null;
    const countsEl = document.getElementById("p-table-counts");
    const pager = document.getElementById("p-table-pager");

    if (T.loading) {
      head.innerHTML = headHTML();
      body.innerHTML = emptyRow("正在加载当前授权任务…");
      if (countsEl) countsEl.innerHTML = '<span class="p-table-count is-muted">正在加载…</span>';
      if (pager) pager.innerHTML = "";
      return;
    }
    if (T.error) {
      head.innerHTML = headHTML();
      body.innerHTML = emptyRow("任务加载失败：" + esc(T.error), '<button type="button" class="btn tiny-btn primary" data-action="task-table-retry">重试</button>');
      if (countsEl) countsEl.innerHTML = '<span class="p-table-count is-muted">加载失败，未显示统计</span>';
      if (pager) pager.innerHTML = "";
      return;
    }
    if (!companyZone()) {
      head.innerHTML = headHTML();
      body.innerHTML = emptyRow("无法确定公司时区，任务日期不能按业务口径显示。", '<button type="button" class="btn tiny-btn primary" data-action="task-table-retry">重试</button>');
      if (countsEl) countsEl.innerHTML = '<span class="p-table-count is-muted">公司时区缺失</span>';
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
      if (countsEl) countsEl.innerHTML = countsHTML(result);
      if (pager) pager.innerHTML = "";
      return;
    }
    if (!result.paged.total) {
      body.innerHTML = emptyRow("没有符合筛选条件的任务。", '<button type="button" class="btn tiny-btn" data-action="task-table-clear-filters">清空筛选</button>');
    } else {
      body.innerHTML = result.paged.items.map(function (task) { return rowHTML(task, zone); }).join("");
    }
    if (countsEl) countsEl.innerHTML = countsHTML(result);
    if (pager) pager.innerHTML = pagerHTML(result);
    if (scroller) scroller.scrollTop = keepScroll;
  }

  function renderTaskTablePage() {
    const previous = document.getElementById("p-table-scroll");
    if (previous) T.scrollMemory = previous.scrollTop;
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
      T.returnContext = { mode: state.viewMode, anchor: new Date(state.viewAnchor) };
      resetFormState();
    }
    state.viewPage = "table";
    T.active = true; T.loaded = false; T.loading = true; T.error = null;
    renderAll();
    refreshTable();
  }
  function closeTable() {
    if (state.viewPage !== "table") return;
    state.viewPage = "calendar";
    T.active = false; T.loadId += 1;
    T.returnContext = null;
    resetFormState();
    T.rows = []; T.loaded = false; T.loading = false; T.error = null;
    renderAll();
    // Returning must rebuild the calendar projection from the latest effective owners.
    P.refreshTasks().then(function () {
      if (state.viewPage === "calendar" && state.page === "view") renderAll();
    }).catch(function (error) {
      if (error.name !== "AbortError") P.notice("刷新任务失败：" + error.message);
    });
  }

  /* ---------- actions and inputs ---------- */
  const previousAction = runAction;
  runAction = function (element) {
    const action = element.dataset.action;
    if (action === "task-table-open") { openTable(); return; }
    if (action === "task-table-close") { closeTable(); return; }
    if (action === "task-table-refresh" || action === "task-table-retry") { refreshTable(); return; }
    if (action === "task-table-sort") {
      const key = element.dataset.key;
      if (!SORT_LABEL[key]) return;
      if (T.sort.key === key) T.sort.dir = T.sort.dir === "asc" ? "desc" : "asc";
      else T.sort = { key: key, dir: "asc" };
      T.page = 0; paintResults(); return;
    }
    if (action === "task-table-prev") { T.page = Math.max(0, T.page - 1); paintResults(); return; }
    if (action === "task-table-next") { T.page = T.page + 1; paintResults(); return; }
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
      paintResults();
      if (query) query.focus();
      return;
    }
    return previousAction(element);
  };

  document.addEventListener("input", function (event) {
    if (!tableActive() || !event.target || event.target.id !== "p-filter-query") return;
    T.filters.query = String(event.target.value || "").slice(0, QUERY_MAX);
    T.page = 0;
    clearTimeout(T.queryTimer);
    T.queryTimer = setTimeout(function () { if (tableActive()) paintResults(); }, QUERY_DELAY);
  });
  document.addEventListener("change", function (event) {
    if (!tableActive() || !event.target) return;
    const id = event.target.id, value = event.target.value;
    if (id === "p-filter-relation" && RELATION_LABEL[value]) {
      T.filters.relation = value; T.page = 0; paintResults(); return;
    }
    if (id === "p-filter-completion" && COMPLETION_LABEL[value]) {
      T.filters.completion = value; T.page = 0; paintResults(); return;
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
      T.filters.from = start; T.filters.to = end; T.page = 0; paintResults();
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

  /* Test/automation surface: the same pure pipeline the page uses. */
  P.taskForm = {
    pageSize: PAGE_SIZE, queryMax: QUERY_MAX,
    state: T,
    open: openTable, close: closeTable, refresh: refreshTable, paint: paintResults,
    compute: computeTaskForm, matches: matchesTaskFilters, sort: sortTaskRows, summarize: summarizeTaskRows,
    page: pageTaskRows, relation: relationOf, isDone: taskIsDone, isOverdue: taskIsOverdue,
    businessDates: taskBusinessDates, companyDateKey: companyDateKey, companyDateTime: companyDateTime,
    companyZone: companyZone, current: filteredResult
  };
})();
