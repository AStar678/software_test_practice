"use strict";
/* =====================================================================
   每日事项：独立纵向连续月历、跨日事项条、按命中日清单、详情与表单。
   该模块只使用每日事项接口和自身状态，不复用公司页任务月历的日期、
   拖动或密度状态；月份按完整相交范围读取并全部翻页，所有写入使用真实
   事项 ID 与读取版本。浏览锚点是“日期 + 像素偏移”，与公司日历互不影响。
   ===================================================================== */
(function () {
  const P = window.Pandora;
  if (!P) return;
  const WEEKDAY = ["周一", "周二", "周三", "周四", "周五", "周六", "周日"];
  const MAX_MONTHS = 12;
  const PAGE = 50;
  /* 每周固定三条事项条位置；超出部分进入该日完整清单。轨道高度固定，
     因此月份从加载中变为就绪时不会改变滚动高度。 */
  const LANES = 3;
  const ROW = 18;
  const S = {
    epoch: -1, account: null, organization: null,
    companyToday: null, selected: null,
    months: [], records: new Map(), lists: new Map(),
    anchorDate: null, anchorOffset: 8, restoring: false, viewportHeight: 0,
    layoutTimer: null, layoutRetryTimer: null, layoutVersion: 0, resizeObserver: null,
    detail: null, listScroll: null, closeFocus: null, closePosition: null,
    formOrigin: "calendar", sessionSeq: 0, generation: 0
  };
  let pendingSheetQuery = null;
  let press = null;

  /* ------------------------------------------------------------ 日期工具 */
  function pad(n) { return n < 10 ? "0" + n : "" + n; }
  function dateKey(d) { return d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate()); }
  function parseKey(value) {
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(value == null ? "" : value));
    if (!match) return null;
    const d = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
    return !isNaN(d.getTime()) && dateKey(d) === value ? d : null;
  }
  function shift(d, days) { return new Date(d.getFullYear(), d.getMonth(), d.getDate() + days); }
  function mondayOf(d) { return shift(d, -((d.getDay() + 6) % 7)); }
  function monthStart(year, month) { return new Date(year, month - 1, 1); }
  function companyToday() {
    const raw = (P.data && P.data.home && P.data.home.businessDate) || "";
    return parseKey(raw) || new Date(new Date().getFullYear(), new Date().getMonth(), new Date().getDate());
  }
  function longDate(key) {
    const d = parseKey(key); if (!d) return key;
    return d.getFullYear() + "年" + (d.getMonth() + 1) + "月" + d.getDate() + "日";
  }
  function shortDate(key) {
    const d = parseKey(key); if (!d) return key;
    return (d.getMonth() + 1) + "月" + d.getDate() + "日";
  }
  /* A ranged item is one record: every covered date is affected by a completion, edit or delete. */
  function eachDate(start, end) {
    const first = parseKey(start), last = parseKey(end);
    if (!first || !last || last < first) return [];
    const result = [], cursor = new Date(first.getFullYear(), first.getMonth(), first.getDate());
    for (let guard = 0; guard < 3660 && cursor <= last; guard++) {
      result.push(dateKey(cursor)); cursor.setDate(cursor.getDate() + 1);
    }
    return result;
  }
  function rangeLabel(start, end) {
    if (!start) return "—";
    return !end || start === end ? longDate(start) : longDate(start) + " 至 " + longDate(end);
  }
  function itemRange(item) {
    const start = item && (item.startDate || item.date);
    const end = item && (item.endDate || start);
    return { start: start, end: end };
  }
  function firstLine(text) { return String(text || "").split("\n")[0].slice(0, 40); }
  const STATUS_TEXT = { completed: "已完成", open: "未完成", overdue: "已逾期" };
  /* 完成优先；未完成且公司今天超过含首尾的结束日才逾期。 */
  function statusOf(item) {
    if (!item) return "open";
    if (item.completed || String(item.status) === "completed") return "completed";
    const range = itemRange(item);
    if (S.companyToday && range.end && S.companyToday > range.end) return "overdue";
    return "open";
  }
  function covers(item, key) {
    const range = itemRange(item);
    return !!range.start && !!range.end && key >= range.start && key <= range.end;
  }
  function statusMark(status) {
    return status === "completed" ? "✓" : status === "overdue" ? "!" : "○";
  }

  /* ------------------------------------------------------------ 月份窗口 */
  /* 每个月拥有从 1 号所在周到月末所在周的全部星期行；属于相邻月份的位置只是
     非交互空位，所以同一真实日期只存在一个可交互日期格，月份标题不会与别的
     月份共享星期行。 */
  function blockForMonth(year, monthIndex) {
    const normalized = new Date(year, monthIndex, 1);
    return monthBlock(normalized.getFullYear(), normalized.getMonth() + 1);
  }
  function monthBlock(year, month) {
    const first = monthStart(year, month), last = new Date(year, month, 0);
    const weeks = [];
    for (let cursor = mondayOf(first), guard = 0; cursor <= mondayOf(last) && guard < 8; cursor = shift(cursor, 7), guard++) weeks.push(dateKey(cursor));
    return { key: year + "-" + pad(month), year: year, month: month, weeks: weeks,
      from: dateKey(first), to: dateKey(last) };
  }
  function monthKeyOf(date) { return date.getFullYear() + "-" + pad(date.getMonth() + 1); }
  function blockOf(key) { return S.months.find(block => block.key === key) || null; }
  function blockForDate(key) { return blockOf(String(key || "").slice(0, 7)); }

  function clearSession() {
    cancelSheetQuery();
    S.generation++;
    cancelLayout();
    if (S.resizeObserver) { S.resizeObserver.disconnect(); S.resizeObserver = null; }
    S.epoch = -1; S.account = null; S.organization = null;
    S.months = []; S.records.clear(); S.lists.clear();
    S.anchorDate = null; S.anchorOffset = 8; S.viewportHeight = 0;
    S.companyToday = null; S.selected = null;
    S.detail = null; S.listScroll = null; S.closeFocus = null; S.closePosition = null;
    S.formOrigin = "calendar";
    drafts.daily = null;
    press = null;
  }
  P.sessionReset.push(clearSession);
  function resetForSession() {
    const me = (P.data && P.data.me) || {};
    // A transient reload may momentarily have no profile; never wipe the same account's position.
    if (!me.id) return false;
    const changed = S.epoch !== P.epoch || S.account !== me.id || S.organization !== (me.organizationId || null);
    if (!changed) return false;
    clearSession();
    S.epoch = P.epoch; S.account = me.id || null; S.organization = me.organizationId || null;
    S.companyToday = dateKey(companyToday());
    return true;
  }
  function sameSession(generation) {
    const me = (P.data && P.data.me) || {};
    return (generation == null || generation === S.generation) && S.account != null &&
      S.epoch === P.epoch && S.account === (me.id || null) && S.organization === (me.organizationId || null);
  }
  function recordOf(key) { return S.records.get(key) || null; }
  /* 刷新失败时保留上次成功加载的记录：状态标记为可重试，但不把已显示的月份清空。 */
  function recordItems(key) {
    const record = recordOf(key);
    return record && record.items ? Array.from(record.items.values()) : [];
  }
  function recordLoaded(record) {
    return !!record && (record.state !== "loading" || (record.items && record.items.size > 0));
  }

  /* ------------------------------------------------------------ 日历渲染 */
  function initialMonths(today) {
    S.months = [blockForMonth(today.getFullYear(), today.getMonth() - 1),
      blockForMonth(today.getFullYear(), today.getMonth()),
      blockForMonth(today.getFullYear(), today.getMonth() + 1)];
  }
  function dayCounts(items, key) {
    const counts = { open: 0, completed: 0, overdue: 0 };
    items.forEach(item => { if (covers(item, key)) counts[statusOf(item)]++; });
    return counts;
  }
  function cellAria(key, items, loaded) {
    if (!loaded) return longDate(key) + "，事项加载中";
    const counts = dayCounts(items, key);
    const total = counts.open + counts.completed + counts.overdue;
    if (!total) return longDate(key) + "，无事项";
    return longDate(key) + "，未完成" + counts.open + "条，已完成" + counts.completed + "条，逾期" + counts.overdue + "条";
  }
  function cellHTML(block, date, items) {
    const key = dateKey(date);
    const classes = ["daily-cell"];
    if (key === S.companyToday) classes.push("is-today");
    if (key === S.selected) classes.push("is-selected");
    return '<button type="button" class="' + classes.join(" ") + '" data-daily-date="' + key + '" tabindex="-1" aria-label="' + esc(cellAria(key, items || [], !!items)) + '">' +
      '<span class="daily-num">' + date.getDate() + "</span></button>";
  }
  /* Padding for a date that belongs to a neighbouring month: no button, no focus target. */
  function gapHTML() { return '<span class="daily-gap" aria-hidden="true"></span>'; }
  function weekSegments(block, weekStart, items) {
    const monday = parseKey(weekStart);
    const days = Array.from({ length: 7 }, (_, i) => dateKey(shift(monday, i)));
    const own = days.map(key => String(key).slice(0, 7) === block.key);
    const segments = [], lanes = [];
    const sorted = items.slice().sort((a, b) => {
      const ra = itemRange(a), rb = itemRange(b);
      return String(ra.start).localeCompare(String(rb.start)) || String(a.id).localeCompare(String(b.id));
    });
    for (const item of sorted) {
      const range = itemRange(item);
      if (!range.start || !range.end) continue;
      const cols = days.map((key, i) => own[i] && key >= range.start && key <= range.end ? i : -1).filter(i => i >= 0);
      if (!cols.length) continue;
      const startCol = cols[0], endCol = cols[cols.length - 1] + 1;
      const mask = ((1 << (endCol - startCol)) - 1) << startCol;
      let lane = lanes.findIndex(bits => (bits & mask) === 0);
      if (lane < 0) { lane = lanes.length; lanes.push(0); }
      lanes[lane] |= mask;
      segments.push({ item: item, startCol: startCol, endCol: endCol, lane: lane, status: statusOf(item),
        before: range.start < days[startCol], after: range.end > days[endCol - 1] });
    }
    return { days: days, own: own, segments: segments };
  }
  function barHTML(segment, block) {
    const range = itemRange(segment.item);
    const name = firstLine(segment.item.body);
    const visible = segment.lane < LANES;
    const classes = ["daily-bar", "is-" + segment.status];
    if (segment.before) classes.push("continues-before");
    if (segment.after) classes.push("continues-after");
    const label = name + "，" + rangeLabel(range.start, range.end) + "，" + STATUS_TEXT[segment.status] +
      "，点击查看对应日期清单";
    return '<button type="button" class="' + classes.join(" ") + '" data-daily-bar data-id="' + esc(segment.item.id) + '"' +
      ' data-start-col="' + segment.startCol + '" data-end-col="' + segment.endCol + '"' +
      (visible ? "" : " hidden") +
      ' style="grid-column:' + (segment.startCol + 1) + " / " + (segment.endCol + 1) + ";grid-row:" + (segment.lane + 1) + '"' +
      ' aria-label="' + esc(label) + '" title="' + esc(label) + '">' +
      '<span class="daily-bar-mark" aria-hidden="true">' + statusMark(segment.status) + "</span>" +
      '<span class="daily-bar-name">' + esc(name) + "</span></button>";
  }
  function overflowHTML(data, block) {
    return data.days.map((key, col) => {
      if (!data.own[col]) return "";
      const hidden = data.segments.filter(segment => segment.lane >= LANES && segment.startCol <= col && segment.endCol > col).length;
      return hidden ? '<button type="button" class="daily-more" data-daily-more data-date="' + key + '" aria-label="' + esc(longDate(key) + "还有" + hidden + "项事项，查看完整清单") + '">+' + hidden + "</button>" : "";
    }).join("");
  }
  function weekHTML(block, weekStart) {
    const monday = parseKey(weekStart);
    const record = recordOf(block.key);
    const items = recordItems(block.key);
    const data = weekSegments(block, weekStart, items);
    const cells = [];
    for (let i = 0; i < 7; i++) {
      const date = shift(monday, i);
      const own = date.getFullYear() === block.year && date.getMonth() + 1 === block.month;
      if (!own) { cells.push(gapHTML()); continue; }
      cells.push(cellHTML(block, date, recordLoaded(record) ? items : null));
    }
    return '<div class="daily-week" data-week-start="' + weekStart + '">' +
      '<div class="daily-days">' + cells.join("") + "</div>" +
      '<div class="daily-tracks" style="--daily-lanes:' + LANES + ";--daily-row:" + ROW + 'px" aria-hidden="false">' +
        data.segments.map(segment => barHTML(segment, block)).join("") + "</div>" +
      '<div class="daily-overflow">' + overflowHTML(data, block) + "</div></div>";
  }
  function monthHTML(block) {
    const record = recordOf(block.key);
    const state = !record ? "loading" : record.state;
    const stateText = state === "loading" ? "正在加载…" : state === "error" ? "加载失败" : "";
    return '<section class="daily-month is-' + state + '" data-month="' + block.key + '" aria-label="' + block.year + "年" + block.month + "月日历" + '">' +
      '<div class="daily-month-head"><span class="daily-month-label">' + block.year + "年" + block.month + "月</span>" +
        '<span class="daily-month-state" role="status">' + stateText + "</span>" +
        '<button type="button" class="btn tiny-btn daily-retry" data-action="daily-retry" data-month="' + block.key + '" hidden aria-label="重试加载' + block.year + "年" + block.month + '月事项">重试</button>' +
      "</div>" +
      '<div class="daily-weeks">' + block.weeks.map(week => weekHTML(block, week)).join("") + "</div></section>";
  }
  function calendarHTML() {
    return '<div class="card-head daily-head"><h2 id="q3">每日事项</h2>' +
      '<button type="button" class="btn tiny-btn daily-add" data-action="daily-new" aria-label="新增每日事项">+</button>' +
      '<div class="daily-tools">' +
        '<button type="button" class="btn tiny-btn" data-action="daily-prev" aria-label="上一月">‹</button>' +
        '<button type="button" class="btn tiny-btn" data-action="daily-next" aria-label="下一月">›</button>' +
        '<button type="button" class="btn tiny-btn" data-action="daily-locate" aria-label="按年月定位">年月</button>' +
        '<button type="button" class="btn tiny-btn" data-action="daily-today" aria-label="回到公司今天">今天</button>' +
      "</div></div>" +
      '<div class="daily-body">' +
        '<div class="daily-scroller" id="dailyScroller" tabindex="0" role="group" aria-label="每日事项月历：上下滚动浏览连续月份，方向键移动日期，回车打开当天清单">' +
          '<div class="daily-weekdays" aria-hidden="true">' + WEEKDAY.map(name => "<span>" + name + "</span>").join("") + "</div>" +
          '<div class="daily-track" id="dailyTrack">' + S.months.map(monthHTML).join("") + "</div></div>" +
      "</div>" +
      '<div class="callout" id="dailyError" role="alert" hidden></div>';
  }
  function render() {
    const host = document.getElementById("dailyItemsSection");
    if (!host) return;
    resetForSession();
    const today = companyToday();
    S.companyToday = dateKey(today);
    if (!S.months.length) {
      initialMonths(today);
      S.anchorDate = S.companyToday;
      S.anchorOffset = 8;
    }
    if (!S.selected) S.selected = S.companyToday;
    // Keep the current date anchor before the card is replaced; a hidden page keeps its last one.
    const scroller = document.getElementById("dailyScroller");
    if (scroller && scroller.clientHeight) anchorFromDom(scroller);
    cancelLayout();
    host.innerHTML = calendarHTML();
    bindCalendar();
    S.months.forEach(loadMonth);
    layoutPosition({ date: S.anchorDate || S.companyToday, offset: S.anchorOffset });
  }
  function bindCalendar() {
    const scroller = document.getElementById("dailyScroller");
    if (!scroller) return;
    scroller.addEventListener("scroll", onScroll, { passive: true });
    scroller.addEventListener("keydown", onCalendarKey);
    scroller.addEventListener("pointerdown", onPointerDown, { passive: true });
    scroller.addEventListener("pointermove", onPointerMove, { passive: true });
    scroller.addEventListener("click", onScrollerClick);
    observeSize(scroller);
  }

  /* 浏览锚点是一个日期加上它相对滚动视口顶端的像素偏移。尺寸变化会先夹紧
     scrollTop，那一瞬间不能被当成新的锚点；只有同一尺寸下的滚动才替换锚点。 */
  function anchorFromDom(scroller) {
    if (!scroller || !scroller.clientHeight) return;
    const top = scroller.getBoundingClientRect().top;
    let best = null, bestTop = Infinity;
    scroller.querySelectorAll("[data-daily-date]").forEach(cell => {
      const cellTop = cell.getBoundingClientRect().top;
      if (cellTop >= top - 1 && cellTop < bestTop) { bestTop = cellTop; best = cell; }
    });
    if (best) {
      S.anchorDate = best.dataset.dailyDate;
      S.anchorOffset = Math.max(0, Math.round(bestTop - top));
      /* 清单打开期间的补载/布局若改变了日历锚点，关闭时应回到当前可见位置，而不是旧快照。 */
      if (S.closePosition && typeof openListDate === 'function' && openListDate())
        S.closePosition = { date: S.anchorDate, offset: S.anchorOffset };
    }
  }

  /* ------------------------------------------------------- 定位与月份补足 */
  function cancelLayout() {
    S.layoutVersion++;
    clearTimeout(S.layoutTimer);
    clearTimeout(S.layoutRetryTimer);
    S.layoutTimer = S.layoutRetryTimer = null;
  }
  function currentLayout(scroller, generation, version) {
    return sameSession(generation) && version === S.layoutVersion &&
      scroller === document.getElementById("dailyScroller");
  }
  function cellTopInTrack(scroller, key) {
    const cell = scroller.querySelector('[data-daily-date="' + key + '"]');
    if (!cell) return null;
    return cell.getBoundingClientRect().top - scroller.getBoundingClientRect().top + scroller.scrollTop;
  }
  function ensureMonth(key) {
    let guard = 0;
    while (!blockOf(key) && guard++ < MAX_MONTHS) {
      const first = S.months[0], last = S.months[S.months.length - 1];
      if (!first || !last) return false;
      if (key < first.key) prependMonth();
      else if (key > last.key) appendMonth();
      else return false;
    }
    return !!blockOf(key);
  }
  /* 宽屏初始内容可能不足一屏：持续补足下方月份，使月历总可继续浏览，
     同时保留 12 个月的有界 DOM。 */
  function padMonths() {
    const scroller = document.getElementById("dailyScroller");
    if (!scroller || !scroller.clientHeight) return;
    for (let guard = 0; guard < MAX_MONTHS; guard++) {
      if (S.months.length >= MAX_MONTHS) return;
      if (scroller.scrollHeight - scroller.scrollTop - scroller.clientHeight >= scroller.clientHeight * 0.5) return;
      appendMonth();
    }
  }
  function place(scroller, key, offset) {
    const top = cellTopInTrack(scroller, key);
    if (top == null) return false;
    scroller.scrollTop = Math.max(0, top - (offset == null ? 8 : offset));
    return true;
  }
  /* 首次渲染、页面刷新、月份跳转、定位/今天、尺寸变化共用这一个入口：
     先挂载目标月份并补足可浏览月份，再把目标日期放到保存的像素偏移处。 */
  function layoutPosition(target) {
    cancelLayout();
    const opts = target || {};
    const generation = S.generation;
    const version = S.layoutVersion;
    const scroller = document.getElementById("dailyScroller");
    const key = parseKey(opts.date) ? opts.date : S.companyToday;
    if (!key) return false;
    const placeAt = (tries) => {
      if (!scroller || !currentLayout(scroller, generation, version) || !S.months.length) return false;
      if (!scroller.clientHeight) {
        if (tries > 0) S.layoutRetryTimer = setTimeout(() => {
          S.layoutRetryTimer = null;
          placeAt(tries - 1);
        }, 32);
        return false;
      }
      S.restoring = true;
      ensureMonth(key.slice(0, 7));
      if (!blockOf(key.slice(0, 7))) { S.restoring = false; return false; }
      place(scroller, key, opts.offset);
      // 补足可浏览月份后再放一次，避免底部夹紧丢掉刚保存的像素偏移。
      padMonths();
      place(scroller, key, opts.offset);
      S.restoring = false;
      S.viewportHeight = scroller.clientHeight;
      anchorFromDom(scroller);
      S.anchorDate = key;
      S.anchorOffset = opts.offset == null ? 8 : opts.offset;
      return true;
    };
    return placeAt(16);
  }
  function observeSize(scroller) {
    if (S.resizeObserver) { S.resizeObserver.disconnect(); S.resizeObserver = null; }
    if (!scroller || typeof ResizeObserver !== "function") return;
    const generation = S.generation;
    S.resizeObserver = new ResizeObserver(() => {
      if (!sameSession(generation) || scroller !== document.getElementById("dailyScroller")) return;
      scheduleLayout();
    });
    S.resizeObserver.observe(scroller);
  }
  function scheduleLayout() {
    if (S.layoutTimer) return;
    const scroller = document.getElementById("dailyScroller");
    const generation = S.generation, version = S.layoutVersion;
    S.layoutTimer = setTimeout(() => {
      S.layoutTimer = null;
      if (!currentLayout(scroller, generation, version)) return;
      layoutPosition({ date: S.anchorDate || S.companyToday, offset: S.anchorOffset });
    }, 60);
  }

  /* ------------------------------------------------------------ 范围读取 */
  /* 每个月只读取与该月完整日范围相交的记录，窗口不超过 31 天；之后逐页读完，
     按真实 ID 合并。失败保留该月已加载的记录，只标记可重试，不把首屏当全量。 */
  async function loadMonth(block, force) {
    if (!block) return;
    const cached = recordOf(block.key);
    if (cached && !force && (cached.state === "ready" || cached.state === "loading")) return;
    const token = ++S.sessionSeq;
    const previous = cached && cached.items ? cached.items : new Map();
    const entry = { state: "loading", items: previous, token: token, epoch: S.epoch, account: S.account };
    S.records.set(block.key, entry);
    if (S.months.some(item => item.key === block.key)) paintMonth(block.key);
    const readAll = async () => {
      const items = new Map();
      let total = null, offset = 0;
      for (let guard = 0; guard < 60; guard++) {
        const page = await P.request("/daily-items?from=" + block.from + "&to=" + block.to + "&limit=100&offset=" + offset);
        if (!sameSession() || (recordOf(block.key) || {}).token !== token) return null;
        const rows = page.items || [];
        const pageTotal = Number(page.total);
        if (total != null && pageTotal !== total) throw new Error("事项数量正在变化，请重试。");
        total = pageTotal;
        rows.forEach(item => { if (item && item.id) items.set(item.id, item); });
        const next = page.nextOffset == null ? null : Number(page.nextOffset);
        if (next == null) break;
        if (next <= offset) throw new Error("事项分页异常，请重试。");
        offset = next;
      }
      if (total != null && items.size !== total) throw new Error("事项正在其他会话中变化，请重试加载。");
      return items;
    };
    try {
      let items = null, failure = null;
      for (let attempt = 0; attempt < 2; attempt++) {
        try { items = await readAll(); break; }
        catch (error) { failure = error; if (error.name === "AbortError") return; }
      }
      if (!sameSession() || (recordOf(block.key) || {}).token !== token) return;
      if (!items) throw failure || new Error("事项加载失败，请重试。");
      S.records.set(block.key, { state: "ready", items: items, token: token, epoch: S.epoch, account: S.account });
    } catch (error) {
      if (error.name === "AbortError") return;
      if (!sameSession() || (recordOf(block.key) || {}).token !== token) return;
      S.records.set(block.key, { state: "error", items: previous, token: token, epoch: S.epoch, account: S.account, error: error });
    }
    paintMonth(block.key);
  }
  function paintMonth(key) {
    const block = blockOf(key);
    const root = document.querySelector('.daily-month[data-month="' + key + '"]');
    if (!root || !block) return;
    const record = recordOf(key);
    const state = !record ? "loading" : record.state;
    root.classList.toggle("is-ready", state === "ready");
    root.classList.toggle("is-loading", state === "loading");
    root.classList.toggle("is-error", state === "error");
    root.classList.toggle("is-stale", state === "error" && record.items.size > 0);
    const retry = root.querySelector("[data-action='daily-retry']");
    if (retry) retry.hidden = state !== "error";
    const stateEl = root.querySelector(".daily-month-state");
    if (stateEl) stateEl.textContent = state === "loading" ? "正在加载…" : state === "error" ? (record.items.size ? "使用上次加载的事项" : "加载失败") : "";
    block.weeks.forEach(weekStart => {
      const week = root.querySelector('.daily-week[data-week-start="' + weekStart + '"]');
      if (!week) return;
      const items = recordItems(key);
      const data = weekSegments(block, weekStart, items);
      const tracks = week.querySelector(".daily-tracks");
      const overflow = week.querySelector(".daily-overflow");
      if (tracks) tracks.innerHTML = data.segments.map(segment => barHTML(segment, block)).join("");
      if (overflow) overflow.innerHTML = overflowHTML(data, block);
      week.querySelectorAll("[data-daily-date]").forEach(cell => {
        cell.setAttribute("aria-label", cellAria(cell.dataset.dailyDate, items, recordLoaded(record)));
      });
    });
  }
  /* ------------------------------------------------------------ 滚动补载 */
  function onScroll() {
    const scroller = document.getElementById("dailyScroller");
    if (!scroller || !scroller.clientHeight) return;
    // 尺寸变化会先夹紧 scrollTop：这一瞬间不能被当成新的日期锚点。
    if (scroller.clientHeight !== S.viewportHeight) { scheduleLayout(); return; }
    if (!S.restoring) anchorFromDom(scroller);
    if (S.layoutTimer) return;
    const generation = S.generation, version = S.layoutVersion;
    S.layoutTimer = setTimeout(() => {
      S.layoutTimer = null;
      if (!currentLayout(scroller, generation, version) || !scroller.clientHeight) return;
      const top = scroller.scrollTop;
      const bottom = scroller.scrollHeight - scroller.clientHeight - top;
      if (top < 80) prependMonth();
      else if (bottom < 80) appendMonth();
      padMonths();
      if (!S.restoring) anchorFromDom(scroller);
    }, 120);
  }
  function appendMonth() {
    const last = S.months[S.months.length - 1];
    const track = document.getElementById("dailyTrack");
    if (!last || !track) return false;
    const next = blockForMonth(last.year, last.month);
    if (S.months.some(block => block.key === next.key)) return false;
    S.months.push(next);
    track.insertAdjacentHTML("beforeend", monthHTML(next));
    loadMonth(next);
    trimMonths();
    return true;
  }
  function prependMonth() {
    const first = S.months[0];
    const track = document.getElementById("dailyTrack");
    const scroller = document.getElementById("dailyScroller");
    if (!first || !track || !scroller) return false;
    const next = blockForMonth(first.year, first.month - 2);
    if (S.months.some(block => block.key === next.key)) return false;
    const heightBefore = scroller.scrollHeight;
    S.months.unshift(next);
    track.insertAdjacentHTML("afterbegin", monthHTML(next));
    loadMonth(next);
    scroller.scrollTop += scroller.scrollHeight - heightBefore;
    trimMonths();
    return true;
  }
  function removeMonth(block) {
    const track = document.getElementById("dailyTrack");
    const scroller = document.getElementById("dailyScroller");
    const element = track && track.querySelector('.daily-month[data-month="' + block.key + '"]');
    if (!scroller) return;
    const index = S.months.indexOf(block);
    if (index < 0) return;
    const above = element ? element.getBoundingClientRect().top < scroller.getBoundingClientRect().top : false;
    const heightBefore = scroller.scrollHeight;
    if (element) element.remove();
    S.months.splice(index, 1);
    S.records.delete(block.key);
    if (above) scroller.scrollTop = Math.max(0, scroller.scrollTop - (heightBefore - scroller.scrollHeight));
  }
  /* 超出上限时从离锚点较远的一侧卸载，保留当前浏览位置。 */
  function trimMonths() {
    while (S.months.length > MAX_MONTHS) {
      const anchorKey = String(S.anchorDate || S.companyToday || "").slice(0, 7);
      const anchorIndex = S.months.findIndex(block => block.key === anchorKey);
      const removeFirst = anchorIndex > S.months.length / 2 || anchorIndex < 0;
      removeMonth(removeFirst ? S.months[0] : S.months[S.months.length - 1]);
    }
  }
  function jumpToMonth(year, month) {
    const target = new Date(year, month - 1, 1);
    if (isNaN(target.getTime())) return;
    S.months = [blockForMonth(target.getFullYear(), target.getMonth() - 1),
      blockForMonth(target.getFullYear(), target.getMonth()),
      blockForMonth(target.getFullYear(), target.getMonth() + 1)];
    const track = document.getElementById("dailyTrack");
    if (!track) return;
    track.innerHTML = S.months.map(monthHTML).join("");
    S.months.forEach(loadMonth);
    S.anchorDate = dateKey(target);
    S.anchorOffset = 8;
    layoutPosition({ date: S.anchorDate, offset: 8 });
  }
  function goToDate(key) {
    const date = parseKey(key);
    if (!date) return;
    const month = monthKeyOf(date);
    if (!blockOf(month)) {
      const anchorMonth = String((S.anchorDate || S.companyToday || "").slice(0, 7));
      const distance = Math.abs((date.getFullYear() - Number(anchorMonth.slice(0, 4))) * 12 + (date.getMonth() + 1 - Number(anchorMonth.slice(5, 7))));
      if (distance > 3) { jumpToMonth(date.getFullYear(), date.getMonth() + 1); return; }
      ensureMonth(month);
    }
    S.anchorDate = key;
    S.anchorOffset = 8;
    layoutPosition({ date: key, offset: 8 });
  }
  function stepMonth(delta) {
    const anchor = parseKey((S.anchorDate || S.companyToday) + "") || companyToday();
    const moved = new Date(anchor.getFullYear(), anchor.getMonth() + delta, 1);
    jumpToMonth(moved.getFullYear(), moved.getMonth() + 1);
  }

  /* ------------------------------------------------- 滚动与点击隔离、键盘 */
  function onPointerDown(event) {
    press = { x: event.clientX, y: event.clientY, top: (document.getElementById("dailyScroller") || {}).scrollTop || 0 };
  }
  function onPointerMove(event) {
    if (!press) return;
    const scroller = document.getElementById("dailyScroller");
    if (Math.abs(event.clientX - press.x) > 6 || Math.abs(event.clientY - press.y) > 6 ||
      (scroller && Math.abs(scroller.scrollTop - press.top) > 2)) press.moved = true;
  }
  function hitDateForBar(bar, clientX) {
    const week = bar.closest(".daily-week"), days = week && week.querySelector(".daily-days");
    if (!week || !days) return null;
    const start = parseKey(week.dataset.weekStart);
    if (!start) return null;
    const rect = days.getBoundingClientRect();
    let col = Math.floor((clientX - rect.left) / (rect.width / 7));
    col = Math.max(Number(bar.dataset.startCol), Math.min(Number(bar.dataset.endCol) - 1, col));
    if (!Number.isFinite(col) || col < 0) return null;
    return dateKey(shift(start, col));
  }
  /* 日期数字、空白、事项条与溢出统一先打开实际命中日期的完整清单；
     续接条按点击所在的列取日期，不固定使用开始日。 */
  function onScrollerClick(event) {
    const moved = press && press.moved;
    press = null;
    if (moved) return;
    const bar = event.target.closest("[data-daily-bar]");
    if (bar) {
      event.preventDefault(); event.stopPropagation();
      const key = hitDateForBar(bar, event.clientX);
      if (key) openList(key, bar);
      return;
    }
    const more = event.target.closest("[data-daily-more]");
    if (more) {
      event.preventDefault(); event.stopPropagation();
      openList(more.dataset.date, more);
      return;
    }
    const cell = event.target.closest("[data-daily-date]");
    if (cell) {
      event.preventDefault(); event.stopPropagation();
      openList(cell.dataset.dailyDate, cell);
    }
  }
  document.addEventListener("pointerup", () => { setTimeout(() => { press = null; }, 0); }, true);

  function focusCell(key) {
    const cell = document.querySelector('[data-daily-date="' + key + '"]');
    const scroller = document.getElementById("dailyScroller");
    if (cell && scroller && scroller.clientHeight) {
      /* 取消上一次滚动排队的锚点恢复，避免它在键盘定位之后把滚动位置拉回去。 */
      cancelLayout();
      const box = cell.getBoundingClientRect(), viewport = scroller.getBoundingClientRect();
      if (box.top < viewport.top) scroller.scrollTop -= viewport.top - box.top;
      else if (box.bottom > viewport.bottom) scroller.scrollTop += box.bottom - viewport.bottom;
      /* 键盘定位产生的滚动不能被 onScroll 误判为视口尺寸变化并回退到旧锚点。 */
      S.viewportHeight = scroller.clientHeight;
      if (!S.restoring) anchorFromDom(scroller);
      cell.focus({ preventScroll: true });
      return true;
    }
    return false;
  }
  function onCalendarKey(event) {
    const active = document.activeElement && document.activeElement.closest && document.activeElement.closest("[data-daily-date]");
    const current = active ? active.dataset.dailyDate : (S.selected || S.companyToday);
    let next = null;
    if (event.key === "ArrowLeft") next = dateKey(shift(parseKey(current), -1));
    else if (event.key === "ArrowRight") next = dateKey(shift(parseKey(current), 1));
    else if (event.key === "ArrowUp") next = dateKey(shift(parseKey(current), -7));
    else if (event.key === "ArrowDown") next = dateKey(shift(parseKey(current), 7));
    else if (event.key === "Home") next = S.companyToday;
    else if ((event.key === "Enter" || event.key === " ") && active) {
      event.preventDefault();
      openList(active.dataset.dailyDate, active);
      return;
    } else return;
    event.preventDefault();
    if (!next) return;
    S.selected = next;
    if (!document.querySelector('[data-daily-date="' + next + '"]')) goToDate(next);
    const place = () => {
      document.querySelectorAll(".daily-cell.is-selected").forEach(cell => cell.classList.remove("is-selected"));
      focusCell(next);
      const target = document.querySelector('[data-daily-date="' + next + '"]');
      if (target) {
        target.classList.add("is-selected");
        /* 补载/重绘后的月份高度可能晚一帧才稳定；nearest 只滚动最近的日历容器，
           不把整页带走，也不会在无法再滚动时把焦点留在视口外。 */
        target.scrollIntoView({ block: "nearest", inline: "nearest" });
      }
    };
    /* 跨月补载的月份节点在同一任务内插入，布局测量可能尚未反映新高度；
       下一帧再定位一次，保证方向键焦点日期始终留在可视区。 */
    place();
    requestAnimationFrame(place);
  }

  /* ------------------------------------------------------------ 日清单 */
  function cancelSheetQuery() {
    pendingSheetQuery = null;
  }
  function queryForSheet(read, apply, errorId) {
    cancelSheetQuery();
    const query = { source: sheetStack[sheetStack.length - 1], page: state.page, generation: S.generation };
    const current = () => pendingSheetQuery === query && sameSession(query.generation) &&
      state.page === query.page && sheetStack[sheetStack.length - 1] === query.source;
    pendingSheetQuery = query;
    (async () => {
      try {
        const result = await read();
        if (current()) apply(result);
      } catch (error) {
        if (current() && error.name !== "AbortError") {
          showSheetError(errorId, error.message);
          P.notice(error.message);
        }
      } finally {
        if (pendingSheetQuery === query) pendingSheetQuery = null;
      }
    })();
  }
  function listEntry(date) {
    let entry = S.lists.get(date);
    if (!entry) { entry = { items: [], total: 0, next: null, loading: false, error: null, token: 0 }; S.lists.set(date, entry); }
    return entry;
  }
  async function loadList(date, offset, limit) {
    const generation = S.generation;
    const entry = listEntry(date);
    const token = ++entry.token;
    entry.loading = true; entry.error = null;
    try {
      // Offset belongs to an old snapshot. Re-read the visible prefix plus one
      // page so deletions remove stale rows and cannot shift an unseen row past us.
      const wanted = offset ? entry.items.length + (limit || PAGE) : (limit || PAGE);
      let previous = null, result = null;
      for (let attempt = 0; attempt < 4; attempt++) {
        const items = [], seen = new Set();
        let total = null, next = 0, valid = true, requests = 0;
        do {
          const page = await P.request("/daily-items?date=" + encodeURIComponent(date) + "&limit=" + Math.min(100, wanted - items.length) + "&offset=" + next);
          if (entry.token !== token || !sameSession(generation)) return entry;
          requests++;
          if (total != null && total !== Number(page.total)) valid = false;
          total = Number(page.total);
          for (const item of page.items || []) {
            if (seen.has(item.id)) valid = false;
            else { seen.add(item.id); items.push(item); }
          }
          const following = page.nextOffset == null ? null : Number(page.nextOffset);
          if (following != null && following <= next) { valid = false; break; }
          next = following;
        } while (next != null && items.length < wanted);
        if (items.length !== Math.min(wanted, total)) valid = false;
        const snapshot = { items: items, total: total, next: items.length < total ? items.length : null };
        const signature = JSON.stringify(snapshot);
        // One API response is transactional. Multiple responses need a matching
        // second read, including IDs/versions, even when a delete+create kept total.
        if (valid && (requests === 1 || signature === previous)) { result = snapshot; break; }
        previous = valid ? signature : null;
      }
      if (!result) throw new Error("事项正在其他会话中变化，请重试加载。");
      entry.items = result.items;
      entry.total = result.total;
      entry.next = result.next;
      entry.loading = false;
      return entry;
    } catch (error) {
      if (entry.token === token && sameSession(generation)) { entry.loading = false; entry.error = error; }
      throw error;
    }
  }
  function rowHTML(item, hitDate) {
    const range = itemRange(item), status = statusOf(item);
    const date = hitDate || range.start || item.date;
    /* 三态统一走 is-open/is-completed/is-overdue；可见区域只保留正文和实际日期，
       真实状态通过 aria-label 与完成控件的 aria-checked 继续对辅助技术可读。 */
    return '<div class="daily-row is-' + status + '" data-daily-row="' + esc(item.id) + '">' +
      '<button type="button" class="daily-check" role="checkbox" aria-checked="' + (item.completed ? "true" : "false") + '"' +
        ' aria-label="' + esc((item.completed ? "取消完成：" : "标记完成：") + firstLine(item.body) + "（当前状态：" + (STATUS_TEXT[status] || status) + "）") + '"' +
        ' data-action="daily-toggle" data-id="' + esc(item.id) + '" data-date="' + esc(date) + '"><span aria-hidden="true">' + (item.completed ? "✓" : "") + "</span></button>" +
      '<button type="button" class="daily-text" data-action="daily-open" data-id="' + esc(item.id) + '"' +
        ' aria-label="' + esc(firstLine(item.body) + "，" + rangeLabel(range.start, range.end) + "，" + (STATUS_TEXT[status] || status) + "，打开事项详情") + '"' +
        ' title="' + esc(rangeLabel(range.start, range.end)) + '">' +
        '<span>' + esc(item.body) + "</span>" +
        '<small class="daily-row-meta">' + esc(rangeLabel(range.start, range.end)) + "</small></button>" +
      "</div>";
  }
  function listView(date) {
    const entry = S.lists.get(date) || { items: [], total: 0, next: null, loading: false, error: null };
    const body = '<div class="daily-list-meta"><span>' + esc(longDate(date)) + '</span><span class="tiny muted">' + (entry.total || entry.items.length) + " 条</span></div>" +
      (entry.items.length ? '<div class="daily-rows">' + entry.items.map(item => rowHTML(item, date)).join("") + "</div>" : '<div class="empty">这一天还没有每日事项</div>') +
      (entry.next != null ? '<div class="row"><button type="button" class="btn tiny-btn" data-action="daily-more" data-date="' + esc(date) + '">加载更多</button></div>' : "") +
      (entry.loading ? '<div class="tiny muted" role="status">正在加载…</div>' : "") +
      (entry.error ? '<div class="callout" role="alert">加载失败，请重试。</div><div class="row"><button type="button" class="btn tiny-btn" data-action="daily-reload" data-date="' + esc(date) + '">重试</button></div>' : "") +
      '<div class="callout" id="daily-list-error" role="alert" hidden></div>';
    return { title: shortDate(date) + " · 每日事项", body: body,
      foot: withBack('<button type="button" class="btn primary" data-action="daily-new" data-date="' + esc(date) + '">新增这一天的事项</button>'),
      rebuild: () => listView(date), dailyKind: "list", dailyDate: date };
  }
  function openList(date, trigger) {
    S.selected = date;
    queryForSheet(async () => {
      const entry = S.lists.get(date);
      if (!entry || !entry.items.length) await loadList(date, 0);
    }, () => {
      S.listScroll = { date: date, top: 0 };
      S.closeFocus = trigger || null;
      S.closePosition = { date: S.anchorDate, offset: S.anchorOffset };
      openSheet(listView(date));
    }, "daily-list-error");
  }
  function openListFromCache(date) {
    if (!S.lists.has(date)) return false;
    S.selected = date;
    openSheet(listView(date));
    return true;
  }
  function openListDate() {
    for (let i = sheetStack.length - 1; i >= 0; i--) if (sheetStack[i].dailyKind === "list") return sheetStack[i].dailyDate;
    return null;
  }
  function rerenderOpenList(date, top) {
    if (openListDate() !== date) return;
    const index = sheetStack.length - 1;
    if (!sheetStack[index] || sheetStack[index].dailyKind !== "list") return;
    replaceTopSheet(listView(date));
    sheetBodyEl.scrollTop = top == null ? (S.listScroll && S.listScroll.date === date ? S.listScroll.top : 0) : top;
  }
  function returnToList() {
    const index = sheetStack.map(view => view.dailyKind).lastIndexOf("list");
    drafts.daily = null;
    if (index < 0) { closeSheet(); return; }
    const date = sheetStack[index].dailyDate;
    sheetStack.length = index;
    sheetStack.push(listView(date));
    renderSheet();
    restoreListPosition();
  }
  function restoreListPosition() {
    const saved = S.listScroll;
    if (!saved || topKind() !== "list" || openListDate() !== saved.date) return;
    sheetBodyEl.scrollTop = saved.top;
    const row = saved.focus && sheetBodyEl.querySelector('[data-action="daily-open"][data-id="' + saved.focus + '"]');
    if (row) row.focus({ preventScroll: true });
  }
  function dailyWithBack(foot) {
    return (sheetStack.length ? '<button type="button" class="btn" data-action="sheet-back">返回</button>' : "") + foot;
  }

  /* ------------------------------------------------------------ 详情 */
  function detailView(raw) {
    const range = itemRange(raw), status = statusOf(raw);
    const hit = (S.detail && S.detail.hitDate) || range.start;
    return { title: "每日事项详情", dailyKind: "detail", rebuild: () => detailView(S.detail ? S.detail.raw : raw),
      body: '<div class="daily-detail-head is-' + status + '"><span class="daily-detail-date">' + esc(rangeLabel(range.start, range.end)) + "</span>" +
        '<span class="sr-only">当前状态：' + esc(STATUS_TEXT[status] || status) + "</span></div>" +
        '<p class="daily-detail-body">' + esc(raw.body) + "</p>" +
        '<div class="callout" id="daily-detail-error" role="alert" hidden></div>',
      foot: dailyWithBack('<button type="button" class="btn ' + (raw.completed ? "" : "ok") + '" data-action="daily-toggle" data-id="' + esc(raw.id) + '" data-date="' + esc(hit) + '" data-target="' + (raw.completed ? "false" : "true") + '">' + (raw.completed ? "取消完成" : "标记完成") + "</button>" +
        '<button type="button" class="btn" data-action="daily-edit" data-id="' + esc(raw.id) + '">编辑</button>' +
        '<button type="button" class="btn danger" data-action="daily-delete" data-id="' + esc(raw.id) + '">删除</button>') };
  }
  function openDetail(id) {
    if (topKind() === "list") S.listScroll = { date: openListDate(), top: sheetBodyEl.scrollTop, focus: id };
    const hit = openListDate();
    queryForSheet(() => P.request("/daily-items/" + encodeURIComponent(id)), raw => {
      S.detail = { raw: raw, etag: '"' + raw.rowVersion + '"', hitDate: hit || itemRange(raw).start };
      openSheet(detailView(raw));
    }, "daily-list-error");
  }

  /* ------------------------------------------------------------ 表单 */
  function newSlot() { try { return (crypto.randomUUID ? crypto.randomUUID() : String(Date.now()) + Math.random().toString(16).slice(2)); } catch (error) { return String(Date.now()) + Math.random().toString(16).slice(2); } }
  function formView() {
    const d = drafts.daily;
    if (!d) return null;
    return { title: d.mode === "edit" ? "编辑每日事项" : "新增每日事项", draftKind: "daily", dailyKind: "form",
      rebuild: formView,
      body: '<div class="field"><label for="daily-start-date">开始日期</label><input id="daily-start-date" type="date" value="' + esc(d.startDate) + '" data-autofocus /></div>' +
        '<div class="field"><label for="daily-end-date">结束日期</label><input id="daily-end-date" type="date" value="' + esc(d.endDate) + '" /></div>' +
        '<div class="field daily-body-field"><label for="daily-body">内容</label><textarea id="daily-body" maxlength="2000" placeholder="写下今天要记住的事">' + esc(d.body) + "</textarea></div>" +
        '<div class="callout" id="daily-form-error" role="alert" hidden></div>',
      foot: dailyWithBack('<button type="button" class="btn primary" data-action="daily-save">保存</button>') };
  }
  function openForm(mode, options) {
    const opts = options || {};
    if (mode === "edit") {
      S.formOrigin = "detail";
      const start = opts.startDate || opts.date, end = opts.endDate || start;
      drafts.daily = { mode: "edit", id: opts.id, originalStart: start, originalEnd: end, startDate: start, endDate: end,
        originalDate: start, date: start, body: opts.body, etag: opts.etag, epoch: P.epoch, slot: newSlot() };
    } else {
      S.formOrigin = opts.origin || "calendar";
      if (S.formOrigin === "list" && S.lists.has(opts.date)) S.listScroll = { date: opts.date, top: sheetBodyEl.scrollTop };
      const date = opts.date || S.selected || S.companyToday;
      drafts.daily = { mode: "create", id: null, originalStart: null, originalEnd: null, startDate: date, endDate: date,
        originalDate: null, date: date, body: "", etag: null, epoch: P.epoch, slot: newSlot() };
    }
    openSheet(formView());
  }
  function syncDraft() {
    const d = drafts.daily;
    if (!d) return;
    const start = document.getElementById("daily-start-date");
    const end = document.getElementById("daily-end-date");
    const body = document.getElementById("daily-body");
    if (start) d.startDate = start.value;
    if (end) d.endDate = end.value;
    if (body) d.body = body.value;
  }
  function saveDraft() {
    P.busy(async () => {
      syncDraft();
      const d = drafts.daily;
      if (!d || d.epoch !== P.epoch) throw new Error("请重新打开后再保存。");
      const start = String(d.startDate || "").trim();
      const end = String(d.endDate || "").trim();
      const body = String(d.body || "").trim();
      if (!parseKey(start) || !parseKey(end)) throw new Error("请填写有效的公历起止日期。");
      if (end < start) throw new Error("结束日期不能早于开始日期。");
      if (!body) throw new Error("请填写内容。");
      if (body.length > 2000) throw new Error("内容不得超过 2000 字。");
      const oldDates = d.mode === "edit" ? eachDate(d.originalStart, d.originalEnd) : [];
      await P.mutation("daily-item:" + d.slot, d.mode === "edit" ? "PATCH" : "POST",
        "/daily-items" + (d.id ? "/" + encodeURIComponent(d.id) : ""), { startDate: start, endDate: end, body: body }, d.etag);
      d.epoch = -1;
      S.detail = null;
      await refreshDates(oldDates.concat(eachDate(start, end)));
      if (S.formOrigin === "list" || S.formOrigin === "detail") returnToList(); else closeSheet();
      P.notice(d.mode === "edit" ? "修改已保存。" : "每日事项已新增。");
    }, "daily-form-error");
  }
  function openDelete(id) {
    const raw = S.detail && S.detail.raw && S.detail.raw.id === id ? S.detail.raw : null;
    if (!raw) { P.notice("请重新打开后再删除。"); return; }
    openSheet({ title: "删除每日事项", dailyKind: "confirm",
      body: '<div class="callout reject">删除后无法恢复，请确认是否删除以下内容。</div>' +
        '<p class="daily-detail-body" style="margin:0">' + esc(raw.body) + "</p>" +
        '<div class="callout" id="daily-confirm-error" role="alert" hidden></div>',
      foot: dailyWithBack('<button type="button" class="btn danger" data-action="daily-confirm-delete" data-id="' + esc(id) + '">确认删除</button>') });
  }
  function confirmDelete(id) {
    const detail = S.detail;
    if (!detail || detail.raw.id !== id) { P.notice("请重新打开后再删除。"); return; }
    P.busy(async () => {
      const range = itemRange(detail.raw);
      await P.mutation("daily-item:delete:" + id, "DELETE", "/daily-items/" + encodeURIComponent(id), null, detail.etag);
      S.detail = null;
      await refreshDates(eachDate(range.start, range.end));
      returnToList();
      P.notice("每日事项已删除。");
    }, "daily-confirm-error");
  }
  function topKind() {
    const top = sheetStack[sheetStack.length - 1];
    return top ? top.dailyKind || null : null;
  }
  function currentCompleted(id, date) {
    if (topKind() === "detail" && S.detail && S.detail.raw.id === id) return !!S.detail.raw.completed;
    const entry = S.lists.get(date);
    const row = entry && entry.items.find(item => item.id === id);
    return !!(row && row.completed);
  }
  function toggleItem(id, date, target) {
    const detail = topKind() === "detail" && S.detail && S.detail.raw.id === id ? S.detail : null;
    const entry = S.lists.get(date);
    const row = entry && entry.items.find(item => item.id === id);
    const etag = detail ? detail.etag : row ? '"' + row.rowVersion + '"' : null;
    if (!etag) { P.notice("请重新打开后再操作。"); return; }
    const range = itemRange(detail ? detail.raw : row);
    P.busy(async () => {
      await P.mutation("daily-item:complete:" + id, "PATCH", "/daily-items/" + encodeURIComponent(id), { completed: true === target }, etag);
      await refreshDates(eachDate(range.start, range.end), true);
      const raw = await P.request("/daily-items/" + encodeURIComponent(id));
      if (!sameSession()) return;
      if (detail) {
        S.detail = { raw: raw, etag: '"' + raw.rowVersion + '"', hitDate: detail.hitDate };
        replaceTopSheet(detailView(raw));
      }
      /* 同一条记录会出现在它覆盖的每个日期清单缓存里：完成/取消后逐份同步，
         切换日期时不会读到旧的完成状态；份数很少且只在写后回读时执行。 */
      S.lists.forEach(entry => {
        if (!entry || !entry.items) return;
        const cached = entry.items.find(item => item.id === raw.id);
        if (!cached) return;
        cached.completed = raw.completed; cached.status = raw.status; cached.rowVersion = raw.rowVersion;
        cached.startDate = raw.startDate; cached.endDate = raw.endDate;
      });
      if (row) { row.completed = raw.completed; row.status = raw.status; row.rowVersion = raw.rowVersion; row.startDate = raw.startDate; row.endDate = raw.endDate; }
      if (openListDate() === date && !detail) rerenderOpenList(date, sheetBodyEl.scrollTop);
      P.notice(raw.completed ? "已标记完成。" : "已取消完成。");
    }, detail ? "daily-detail-error" : "daily-list-error");
  }

  /* ------------------------------------------------------------ 写后回读 */
  function calendarError(message) {
    const element = document.getElementById("dailyError");
    if (!element) return;
    element.hidden = false;
    element.innerHTML = esc(message) + ' <button type="button" class="btn tiny-btn" data-action="daily-refresh">刷新</button>';
  }
  function clearCalendarError() {
    const element = document.getElementById("dailyError");
    if (element) { element.hidden = true; element.textContent = ""; }
  }
  /* 完成/编辑/删除或改期后，按旧范围与新范围的并集失效所有受影响月份，
     既刷新开始日也刷新中间与结束日的事项条和清单。 */
  async function refreshDates(dates, skipList) {
    const unique = Array.from(new Set(dates.filter(Boolean)));
    const months = Array.from(new Set(unique.map(date => String(date).slice(0, 7))));
    months.forEach(key => {
      const block = blockOf(key);
      if (block) loadMonth(block, true);
    });
    // 已打开的清单保留条目缓存并按原长度重读，完成/编辑后不因重新挂载变空。
    if (skipList) { clearCalendarError(); return; }
    const jobs = unique.filter(date => S.lists.has(date)).map(date => reloadList(date));
    const results = await Promise.allSettled(jobs);
    if (results.some(result => result.status === "rejected")) calendarError("已保存，但刷新事项失败，请重试。");
    else clearCalendarError();
  }
  async function reloadList(date) {
    const entry = listEntry(date);
    const wanted = Math.max(PAGE, entry.items.length);
    await loadList(date, 0, wanted);
    rerenderOpenList(date, null);
  }

  /* ------------------------------------------------------------ 动作入口 */
  function action(element) {
    const actionName = element.dataset.action;
    if (!actionName || actionName.indexOf("daily-") !== 0) return false;
    const date = element.dataset.date || S.selected || S.companyToday;
    switch (actionName) {
      case "daily-prev": stepMonth(-1); return true;
      case "daily-next": stepMonth(1); return true;
      case "daily-today": S.selected = S.companyToday; goToDate(S.companyToday); return true;
      case "daily-locate": openLocate(); return true;
      case "daily-locate-save": locateFromForm(); return true;
      case "daily-retry": {
        const key = element.dataset.month;
        if (key) { const block = blockOf(key); if (block) loadMonth(block, true); }
        return true;
      }
      case "daily-new": openForm("create", { origin: element.closest("#sheetBody") ? "list" : "calendar", date: date }); return true;
      case "daily-more": loadMore(date); return true;
      case "daily-reload": reloadOpenList(date); return true;
      case "daily-open": openDetail(element.dataset.id); return true;
      case "daily-toggle": toggleItem(element.dataset.id, date, element.dataset.target ? element.dataset.target === "true" : !currentCompleted(element.dataset.id, date)); return true;
      case "daily-edit": {
        if (!S.detail || S.detail.raw.id !== element.dataset.id) { P.notice("请重新打开后再编辑。"); return true; }
        const range = itemRange(S.detail.raw);
        openForm("edit", { id: element.dataset.id, startDate: range.start, endDate: range.end, date: range.start, body: S.detail.raw.body, etag: S.detail.etag }); return true;
      }
      case "daily-delete": openDelete(element.dataset.id); return true;
      case "daily-confirm-delete": confirmDelete(element.dataset.id); return true;
      case "daily-save": saveDraft(); return true;
      case "daily-refresh": S.months.forEach(block => loadMonth(block, true)); clearCalendarError(); return true;
      default: return false;
    }
  }
  function loadMore(date) {
    const entry = S.lists.get(date);
    if (!entry || entry.next == null) return;
    const top = sheetBodyEl.scrollTop;
    const active = document.activeElement;
    const focusId = active && active.dataset.id;
    const focusAction = active && active.dataset.action;
    const previousIds = entry.items.map(item => item.id);
    queryForSheet(async () => {
      await loadList(date, entry.next);
    }, () => {
      rerenderOpenList(date, top);
      const target = focusAction && sheetBodyEl.querySelector('[data-action="' + focusAction + '"]' + (focusId ? '[data-id="' + focusId + '"]' : ""));
      const fallbackId = previousIds.reverse().find(id => entry.items.some(item => item.id === id));
      const fallback = sheetBodyEl.querySelector('[data-action="daily-open"]' + (fallbackId ? '[data-id="' + fallbackId + '"]' : ""));
      if (target || fallback) (target || fallback).focus({ preventScroll: true });
    }, "daily-list-error");
  }
  function reloadOpenList(date) {
    const top = sheetBodyEl.scrollTop;
    P.busy(async () => {
      S.lists.delete(date);
      await loadList(date, 0);
      rerenderOpenList(date, top);
    }, "daily-list-error");
  }
  function openLocate() {
    const anchor = parseKey((String(S.anchorDate || S.companyToday).slice(0, 7)) + "-01") || companyToday();
    openSheet({ title: "定位年月", dailyKind: "locate",
      body: '<div class="field"><label for="daily-locate">年月</label><input id="daily-locate" type="month" value="' + anchor.getFullYear() + "-" + pad(anchor.getMonth() + 1) + '" data-autofocus /></div>' +
        '<div class="tiny muted">连续的上下滚动始终可用；这里用于直接到达较远的年月。</div>' +
        '<div class="callout" id="daily-locate-error" role="alert" hidden></div>',
      foot: withBack('<button type="button" class="btn primary" data-action="daily-locate-save">定位</button>') });
  }
  function locateFromForm() {
    const input = document.getElementById("daily-locate");
    const match = /^(\d{4})-(\d{2})$/.exec(input ? input.value : "");
    if (!match) { showSheetError("daily-locate-error", "请选择有效的年月。"); return; }
    const year = Number(match[1]), month = Number(match[2]);
    if (month < 1 || month > 12) { showSheetError("daily-locate-error", "请选择有效的年月。"); return; }
    closeSheet();
    jumpToMonth(year, month);
  }

  function showSheetError(id, message) {
    const element = document.getElementById(id);
    if (element) { element.hidden = false; element.textContent = message; }
  }

  /* 重新渲染后恢复清单滚动位置和触发元素焦点。 */
  const baseOpenSheet = openSheet;
  openSheet = function (view) {
    cancelSheetQuery();
    return baseOpenSheet(view);
  };
  const baseReplaceTopSheet = replaceTopSheet;
  replaceTopSheet = function (view) {
    cancelSheetQuery();
    return baseReplaceTopSheet(view);
  };
  const baseBackSheet = backSheet;
  backSheet = function () {
    cancelSheetQuery();
    baseBackSheet();
    if (topKind() !== "detail") S.detail = null;
    restoreListPosition();
  };
  const baseCloseSheet = closeSheet;
  closeSheet = function () {
    cancelSheetQuery();
    const focus = S.closeFocus;
    const position = S.closePosition;
    S.closeFocus = null; S.closePosition = null;
    S.detail = null; S.listScroll = null; drafts.daily = null;
    baseCloseSheet();
    if (focus && document.contains(focus)) focus.focus({ preventScroll: true });
    else if (focus && S.selected && document.querySelector('[data-daily-date="' + S.selected + '"]')) focusCell(S.selected);
    if (position) {
      cancelLayout();
      S.anchorDate = position.date || S.anchorDate;
      S.anchorOffset = position.offset == null ? S.anchorOffset : position.offset;
      layoutPosition({ date: S.anchorDate, offset: S.anchorOffset });
      /* 恢复的是关闭清单前的浏览锚点；焦点回到触发日期不应改写这个日期+偏移。 */
      S.anchorDate = position.date || S.anchorDate;
      S.anchorOffset = position.offset == null ? S.anchorOffset : position.offset;
      const scroller = document.getElementById("dailyScroller");
      if (scroller) S.viewportHeight = scroller.clientHeight;
    }
  };
  const baseSetPage = setPage;
  setPage = function (page) {
    if (page !== state.page) cancelSheetQuery();
    return baseSetPage(page);
  };

  /* 选择器统一在动作分发之前拦截，避免被旧个人事项处理器吞掉。 */
  const baseRunAction = runAction;
  runAction = function (element) {
    if (action(element)) return;
    baseRunAction(element);
  };

  window.PandoraDaily = { render: render, state: S, action: action, openList: openList, goToDate: goToDate,
    currentMonthKeys: () => S.months.map(block => block.key) };
})();
