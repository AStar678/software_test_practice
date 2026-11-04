"use strict";
/* =====================================================================
   每日事项：独立的横向连续日历、按日清单、事项详情与创建编辑表单。
   该模块只使用每日事项接口和自身状态，不复用公司页任务月历的日期、
   跨度、拖动或密度状态；所有写入使用真实事项 ID 与读取版本。
   ===================================================================== */
(function () {
  const P = window.Pandora;
  if (!P) return;
  const WEEKDAY = ["周一", "周二", "周三", "周四", "周五", "周六", "周日"];
  const MAX_MONTHS = 12;
  const PAGE = 50;
  const S = {
    epoch: -1, account: null, organization: null,
    companyToday: null, selected: null, anchor: null,
    blocks: [], summaries: new Map(), lists: new Map(),
    scrollLeft: 0, scrollToken: 0, pendingScroll: null, scrollTimer: null, anchorDate: null, anchorOffset: 0, restoring: false,
    detail: null, listScroll: null, closeFocus: null, closePosition: null,
    formOrigin: "calendar", sessionSeq: 0, generation: 0
  };

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

  /* ------------------------------------------------------------ 月份窗口 */
  /* A month block owns every week from the week of its 1st to the week of its last day.
     The week containing the previous month's last day stays in the previous block, so the
     week sequence is contiguous and one real date never appears twice. */
  function blockForMonth(year, monthIndex) {
    const normalized = new Date(year, monthIndex, 1);
    return monthBlock(normalized.getFullYear(), normalized.getMonth() + 1);
  }
  function monthBlock(year, month) {
    const first = monthStart(year, month), last = new Date(year, month, 0);
    let start = mondayOf(first);
    const previousLast = new Date(year, month - 1, 0);
    if (mondayOf(previousLast).getTime() === start.getTime()) start = shift(start, 7);
    const lastWeek = mondayOf(last);
    const weeks = [];
    for (let cursor = start, guard = 0; cursor <= lastWeek && guard < 8; cursor = shift(cursor, 7), guard++) weeks.push(dateKey(cursor));
    return { key: year + "-" + pad(month), year: year, month: month, weeks: weeks,
      from: weeks[0], to: dateKey(shift(parseKey(weeks[weeks.length - 1]), 6)) };
  }
  function monthKeyOf(date) { return date.getFullYear() + "-" + pad(date.getMonth() + 1); }
  function blockContaining(key) { return S.blocks.find(block => key >= block.from && key <= block.to) || null; }
  function blockIndex(key) { return S.blocks.findIndex(block => block.key === key); }

  function clearSession() {
    S.generation++;
    clearTimeout(S.scrollTimer);
    S.scrollTimer = null;
    S.epoch = -1; S.account = null; S.organization = null;
    S.blocks = []; S.summaries.clear(); S.lists.clear();
    S.scrollLeft = 0; S.pendingScroll = null; S.anchorDate = null; S.anchorOffset = 0;
    S.scrollToken++; S.restoring = false;
    S.companyToday = null; S.selected = null; S.anchor = null;
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

  /* ------------------------------------------------------------ 日历渲染 */
  function initialBlocks(today) {
    S.blocks = [blockForMonth(today.getFullYear(), today.getMonth() - 1),
      blockForMonth(today.getFullYear(), today.getMonth()),
      blockForMonth(today.getFullYear(), today.getMonth() + 1)];
    S.anchor = monthKeyOf(today);
  }
  function markWidth(count) { return 4 + (Math.min(count, 5) - 1) * 3; }
  function marksHTML(counts) {
    if (!counts) return '<span class="daily-marks"></span>';
    const open = counts.open > 0 ? '<i class="daily-mark is-open" style="width:' + markWidth(counts.open) + 'px"></i>' : '';
    const done = counts.completed > 0 ? '<i class="daily-mark is-done" style="width:' + markWidth(counts.completed) + 'px"></i>' : '';
    return '<span class="daily-marks">' + open + done + '</span>';
  }
  function cellAria(date, counts) {
    const countText = counts == null
      ? "数量加载中"
      : "未完成" + (counts.open || 0) + "条，已完成" + (counts.completed || 0) + "条";
    return longDate(dateKey(date)) + "，" + countText;
  }
  function cellHTML(block, date) {
    const key = dateKey(date), summary = S.summaries.get(block.key);
    const counts = summary && summary.state === "ready" ? (summary.days.get(key) || { open: 0, completed: 0 }) : null;
    const classes = ["daily-cell"];
    if (date.getMonth() + 1 !== block.month) classes.push("is-adjacent");
    if (key === S.companyToday) classes.push("is-today");
    if (key === S.selected) classes.push("is-selected");
    if (summary && summary.state === "error") classes.push("is-unknown");
    const tag = date.getDate() === 1 ? '<span class="daily-month-tag">' + (date.getMonth() + 1 === 1 ? date.getFullYear() + "年" : "") + (date.getMonth() + 1) + "月</span>" : "";
    return '<button type="button" class="' + classes.join(" ") + '" data-daily-date="' + key + '" tabindex="-1" aria-label="' + esc(cellAria(date, counts)) + '">' +
      '<span class="daily-num">' + date.getDate() + "</span>" + tag + marksHTML(counts) + "</button>";
  }
  function blockHTML(block) {
    const weeks = block.weeks.map(start => {
      const cells = [];
      for (let i = 0; i < 7; i++) cells.push(cellHTML(block, shift(parseKey(start), i)));
      return '<div class="daily-week">' + cells.join("") + "</div>";
    }).join("");
    return '<div class="daily-month" data-month="' + block.key + '" aria-label="' + block.year + "年" + block.month + "月日历" + '">' +
      '<div class="daily-month-head"><span class="daily-month-label">' + block.year + "年" + block.month + "月</span>" +
        '<button type="button" class="btn tiny-btn daily-retry" data-action="daily-retry" data-month="' + block.key + '" hidden aria-label="重试加载' + block.year + "年" + block.month + '月数量">重试</button>' +
      "</div>" +
      '<div class="daily-weeks">' + weeks + "</div></div>";
  }
  function anchorLabelText() {
    const block = S.blocks[blockIndex(S.anchor)] || S.blocks[0];
    return block ? block.year + "年" + block.month + "月" : "";
  }
  function calendarHTML() {
    return '<div class="card-head daily-head"><h2 id="q3">每日事项</h2><span class="hint" id="dailyAnchorLabel">' + anchorLabelText() + "</span>" +
      '<div class="daily-tools">' +
        '<button type="button" class="btn tiny-btn" data-action="daily-prev" aria-label="上一月">‹</button>' +
        '<button type="button" class="btn tiny-btn" data-action="daily-next" aria-label="下一月">›</button>' +
        '<button type="button" class="btn tiny-btn" data-action="daily-locate" aria-label="按年月定位">年月</button>' +
        '<button type="button" class="btn tiny-btn" data-action="daily-today" aria-label="回到公司今天">今天</button>' +
      "</div></div>" +
      '<div class="daily-body">' +
        '<div class="daily-weekdays" aria-hidden="true"><span class="daily-corner"></span>' +
          WEEKDAY.map(name => "<span>" + name + "</span>").join("") + "</div>" +
        '<div class="daily-scroller" id="dailyScroller" tabindex="0" role="group" aria-label="每日事项日历：左右滚动浏览月份，方向键移动日期，回车打开当天清单">' +
          '<div class="daily-track" id="dailyTrack">' + S.blocks.map(blockHTML).join("") + "</div></div>" +
        '<button type="button" class="daily-fab" data-action="daily-new" aria-label="新增每日事项">+</button>' +
      "</div>" +
      '<div class="callout" id="dailyError" role="alert" hidden></div>';
  }
  function render() {
    const host = document.getElementById("dailyItemsSection");
    if (!host) return;
    resetForSession();
    const today = companyToday();
    S.companyToday = dateKey(today);
    if (!S.blocks.length) initialBlocks(today);
    if (!S.selected) S.selected = S.companyToday;
    host.innerHTML = calendarHTML();
    const scroller = document.getElementById("dailyScroller");
    if (scroller) {
      scroller.addEventListener("scroll", onScroll, { passive: true });
      scroller.addEventListener("keydown", onCalendarKey);
      scroller.addEventListener("pointerdown", onPointerDown, { passive: true });
      scroller.addEventListener("pointermove", onPointerMove, { passive: true });
    }
    S.blocks.forEach(loadBlock);
    restoreScroll();
    setAnchorFromScroll();
  }

  function anchorFromDom(scroller) {
    if (!scroller) return;
    const left = scroller.getBoundingClientRect().left;
    let best = null, bestLeft = Infinity;
    scroller.querySelectorAll("[data-daily-date]").forEach(cell => {
      const cellLeft = cell.getBoundingClientRect().left;
      if (cellLeft >= left - 1 && cellLeft < bestLeft) { bestLeft = cellLeft; best = cell; }
    });
    if (best) { S.anchorDate = best.dataset.dailyDate; S.anchorOffset = bestLeft - left; }
  }
  /* A hidden page discards scroll offsets, and a just-inserted track may not be laid out yet.
     Restore from the saved leftmost date plus its pixel offset, retrying across layout frames
     without letting clamped intermediate values overwrite the anchor. */
  function restoreScroll() {
    const scroller = document.getElementById("dailyScroller");
    if (!scroller) return;
    const savedAnchor = S.anchorDate, savedOffset = S.anchorOffset || 0;
    const generation = S.generation;
    const fallback = S.pendingScroll != null ? S.pendingScroll : S.scrollLeft;
    S.pendingScroll = null;
    S.restoring = true;
    const place = () => {
      if (!sameSession(generation)) return true;
      const current = document.getElementById("dailyScroller");
      if (!current) { S.restoring = false; return true; }
      current.scrollTop = 0;
      let value = null;
      if (savedAnchor) {
        const cell = current.querySelector('[data-daily-date="' + savedAnchor + '"]');
        if (cell) {
          const left = cell.getBoundingClientRect().left - current.getBoundingClientRect().left + current.scrollLeft;
          value = Math.max(0, left - savedOffset);
        }
      }
      if (value == null && fallback) value = fallback;
      if (value == null) { scrollToDate(S.companyToday); S.restoring = false; return true; }
      current.scrollLeft = value;
      current.scrollTop = 0;
      if (Math.abs(current.scrollLeft - value) <= 1) {
        S.scrollLeft = current.scrollLeft;
        S.restoring = false;
        anchorFromDom(current);
        return true;
      }
      return false;
    };
    const settle = (tries) => {
      if (place()) return;
      if (tries <= 0) { S.restoring = false; return; }
      setTimeout(() => settle(tries - 1), 16);
    };
    settle(10);
  }

  /* ------------------------------------------------------------ 数量加载 */
  function loadBlock(block) {
    if (!block) return;
    const cached = S.summaries.get(block.key);
    if (cached && (cached.state === "ready" || cached.state === "loading")) return;
    const token = ++S.sessionSeq;
    const entry = { state: "loading", days: new Map(), token: token, epoch: S.epoch, account: S.account };
    S.summaries.set(block.key, entry);
    P.request("/daily-items/summary?from=" + block.from + "&to=" + block.to).then(result => {
      const current = S.summaries.get(block.key);
      if (!current || current.token !== token || !sameSession()) return;
      const days = new Map();
      (result.days || []).forEach(day => days.set(day.date, { open: Number(day.openCount || 0), completed: Number(day.completedCount || 0) }));
      S.summaries.set(block.key, { state: "ready", days: days, token: token, epoch: S.epoch, account: S.account });
      paintMonth(block.key);
    }).catch(() => {
      const current = S.summaries.get(block.key);
      if (!current || current.token !== token || !sameSession()) return;
      // A failed or aborted range stays explicitly retryable and never claims a confirmed zero.
      S.summaries.set(block.key, { state: "error", days: new Map(), token: token, epoch: S.epoch, account: S.account });
      paintMonth(block.key);
    });
  }
  function paintMonth(key) {
    const block = S.blocks.find(item => item.key === key);
    const root = document.querySelector('.daily-month[data-month="' + key + '"]');
    const summary = S.summaries.get(key);
    if (!root || !block || !summary) return;
    root.classList.toggle("is-error", summary.state === "error");
    root.classList.toggle("is-loading", summary.state === "loading");
    const retry = root.querySelector("[data-action='daily-retry']");
    if (retry) retry.hidden = summary.state !== "error";
    root.querySelectorAll("[data-daily-date]").forEach(cell => {
      const date = parseKey(cell.dataset.dailyDate);
      const counts = summary.state === "ready" ? (summary.days.get(cell.dataset.dailyDate) || { open: 0, completed: 0 }) : null;
      const marks = cell.querySelector(".daily-marks");
      if (marks) marks.outerHTML = marksHTML(counts);
      cell.classList.toggle("is-unknown", summary.state === "error");
      cell.setAttribute("aria-label", cellAria(date, counts));
    });
  }
  function invalidateDate(key) {
    S.blocks.forEach(block => {
      if (key >= block.from && key <= block.to) {
        const summary = S.summaries.get(block.key);
        if (summary && summary.state === "ready") {
          summary.days.delete(key);
        }
        S.summaries.delete(block.key);
        paintMonth(block.key);
        loadBlock(block);
      }
    });
  }

  /* ------------------------------------------------------------ 滚动补载 */
  function onScroll() {
    const scroller = document.getElementById("dailyScroller");
    // Hiding the map page resets its scroll position; that synthetic event must not replace the
    // saved anchor or position for the same account.
    if (!scroller || !scroller.clientWidth) return;
    S.scrollLeft = scroller.scrollLeft;
    if (!S.restoring) anchorFromDom(scroller);
    setAnchorFromScroll();
    if (S.scrollTimer) return;
    S.scrollTimer = setTimeout(() => {
      S.scrollTimer = null;
      const right = scroller.scrollWidth - scroller.clientWidth;
      if (scroller.scrollLeft < 80) extend(-1);
      if (right - scroller.scrollLeft < 80) extend(1);
    }, 120);
  }
  function extend(direction) {
    const anchor = direction < 0 ? S.blocks[0] : S.blocks[S.blocks.length - 1];
    if (!anchor) return;
    const next = blockForMonth(anchor.year, anchor.month - 1 + direction);
    if (S.blocks.some(block => block.key === next.key)) return;
    const scroller = document.getElementById("dailyScroller");
    const track = document.getElementById("dailyTrack");
    if (!scroller || !track) return;
    const widthBefore = scroller.scrollWidth, left = scroller.scrollLeft;
    if (direction < 0) {
      S.blocks.unshift(next);
      track.insertAdjacentHTML("afterbegin", blockHTML(next));
    } else {
      S.blocks.push(next);
      track.insertAdjacentHTML("beforeend", blockHTML(next));
    }
    loadBlock(next);
    if (direction < 0) scroller.scrollLeft = left + (scroller.scrollWidth - widthBefore);
    while (S.blocks.length > MAX_MONTHS) {
      const removed = direction > 0 ? S.blocks.shift() : S.blocks.pop();
      const element = track.querySelector('.daily-month[data-month="' + removed.key + '"]');
      if (!element) break;
      const head = direction > 0;
      const width = scroller.scrollWidth;
      element.remove();
      if (head) scroller.scrollLeft = Math.max(0, scroller.scrollLeft - (width - scroller.scrollWidth));
    }
    S.scrollLeft = scroller.scrollLeft;
    setAnchorFromScroll();
  }
  function scrollToDate(key) {
    const scroller = document.getElementById("dailyScroller");
    let guard = 0;
    while (!blockContaining(key) && guard++ < 36) {
      const first = S.blocks[0], last = S.blocks[S.blocks.length - 1];
      if (key < first.from) extend(-1); else if (key > last.to) extend(1); else break;
    }
    const cell = scroller && scroller.querySelector('[data-daily-date="' + key + '"]');
    if (!cell || !scroller) return false;
    const left = cell.getBoundingClientRect().left - scroller.getBoundingClientRect().left + scroller.scrollLeft;
    scroller.scrollLeft = Math.max(0, left - 46 * 2);
    S.scrollLeft = scroller.scrollLeft;
    anchorFromDom(scroller);
    setAnchorFromScroll();
    return true;
  }
  function setAnchorFromScroll() {
    const scroller = document.getElementById("dailyScroller");
    const label = document.getElementById("dailyAnchorLabel");
    if (!scroller || !label || !scroller.clientWidth) return;
    const left = scroller.getBoundingClientRect().left;
    let best = null, bestDelta = Infinity;
    scroller.querySelectorAll(".daily-month").forEach(element => {
      const delta = Math.abs(element.getBoundingClientRect().left - left);
      if (delta < bestDelta) { bestDelta = delta; best = element; }
    });
    if (best) {
      S.anchor = best.dataset.month;
      const block = S.blocks.find(item => item.key === S.anchor);
      label.textContent = block ? block.year + "年" + block.month + "月" : best.textContent.trim();
    }
  }
  function jumpToMonth(year, month) {
    const scrollToken = ++S.scrollToken;
    const target = new Date(year, month - 1, 1);
    S.blocks = [blockForMonth(target.getFullYear(), target.getMonth() - 1),
      blockForMonth(target.getFullYear(), target.getMonth()),
      blockForMonth(target.getFullYear(), target.getMonth() + 1)];
    S.summaries.clear();
    S.anchor = monthKeyOf(target);
    const track = document.getElementById("dailyTrack");
    if (track) {
      track.innerHTML = S.blocks.map(blockHTML).join("");
      S.blocks.forEach(loadBlock);
      S.pendingScroll = null;
      const scroller = document.getElementById("dailyScroller");
      const block = track.querySelector('[data-month="' + monthKeyOf(target) + '"]');
      if (scroller && block) {
        // Align the month's own week block, including months whose first day is
        // in the preceding block. Leading context must not change the target month.
        const left = block.getBoundingClientRect().left - scroller.getBoundingClientRect().left + scroller.scrollLeft;
        // Wide screens need enough following weeks to put the target at the left
        // edge; otherwise the browser clamps the position to the preceding month.
        for (let guard = 0; scroller.scrollWidth - scroller.clientWidth < left && guard < MAX_MONTHS; guard++) extend(1);
        scroller.scrollLeft = Math.max(0, left);
        S.scrollLeft = scroller.scrollLeft;
        anchorFromDom(scroller);
        const generation = S.generation;
        requestAnimationFrame(() => {
          if (!sameSession(generation) || !block.isConnected || scrollToken !== S.scrollToken) return;
          const current = document.getElementById("dailyScroller");
          if (!current) return;
          current.scrollLeft = Math.max(0, left);
          S.scrollLeft = current.scrollLeft;
          anchorFromDom(current);
        });
      }
      setAnchorFromScroll();
    }
  }
  function goToDate(key) {
    const date = parseKey(key);
    if (!date) return;
    if (!blockContaining(key)) {
      const month = monthKeyOf(date);
      const anchorMonth = S.anchor || S.companyToday;
      const distance = Math.abs((date.getFullYear() - Number(anchorMonth.slice(0, 4))) * 12 + (date.getMonth() + 1 - Number(anchorMonth.slice(5, 7))));
      if (distance > 3) { jumpToMonth(date.getFullYear(), date.getMonth() + 1); return; }
    }
    if (!scrollToDate(key)) jumpToMonth(date.getFullYear(), date.getMonth() + 1);
  }

  /* ------------------------------------------------- 横滑与点击隔离、键盘 */
  let press = null;
  function onPointerDown(event) { press = { x: event.clientX, y: event.clientY, left: document.getElementById("dailyScroller").scrollLeft }; }
  function onPointerMove(event) {
    if (!press) return;
    const scroller = document.getElementById("dailyScroller");
    if (Math.abs(event.clientX - press.x) > 6 || Math.abs(event.clientY - press.y) > 6 ||
      Math.abs(scroller.scrollLeft - press.left) > 2) press.moved = true;
  }
  document.addEventListener("click", event => {
    const cell = event.target.closest && event.target.closest("[data-daily-date]");
    if (!cell) return;
    const moved = press && press.moved;
    press = null;
    if (moved) { event.preventDefault(); event.stopPropagation(); return; }
    event.preventDefault();
    event.stopPropagation();
    openList(cell.dataset.dailyDate, cell);
  }, true);
  document.addEventListener("pointerup", () => { setTimeout(() => { press = null; }, 0); }, true);

  function focusCell(key) {
    const cell = document.querySelector('[data-daily-date="' + key + '"]');
    const scroller = document.getElementById("dailyScroller");
    if (cell && scroller && scroller.clientWidth) {
      S.scrollToken++;
      const box = cell.getBoundingClientRect(), viewport = scroller.getBoundingClientRect();
      if (box.left < viewport.left) scroller.scrollLeft -= viewport.left - box.left;
      else if (box.right > viewport.right) scroller.scrollLeft += box.right - viewport.right;
      S.scrollLeft = scroller.scrollLeft;
      anchorFromDom(scroller);
      setAnchorFromScroll();
      cell.focus({ preventScroll: true });
      return true;
    }
    return false;
  }
  function onCalendarKey(event) {
    const cells = Array.from(document.querySelectorAll("[data-daily-date]"));
    if (!cells.length) return;
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
    document.querySelectorAll(".daily-cell.is-selected").forEach(cell => cell.classList.remove("is-selected"));
    focusCell(next);
    const cell = document.querySelector('[data-daily-date="' + next + '"]');
    if (cell) cell.classList.add("is-selected");
  }

  /* ------------------------------------------------------------ 日清单 */
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
      const result = await P.request("/daily-items?date=" + encodeURIComponent(date) + "&limit=" + (limit || PAGE) + "&offset=" + offset);
      if (entry.token !== token || !sameSession(generation)) return entry;
      const seen = new Set(offset ? entry.items.map(item => item.id) : []);
      (result.items || []).forEach(item => { if (!seen.has(item.id)) { seen.add(item.id); entry.items.push(item); } });
      if (!offset) entry.items = (result.items || []).slice();
      entry.total = Number(result.total || 0);
      entry.next = result.nextOffset == null ? null : Number(result.nextOffset);
      entry.loading = false;
      return entry;
    } catch (error) {
      if (entry.token === token && sameSession(generation)) { entry.loading = false; entry.error = error; }
      throw error;
    }
  }
  function firstLine(text) { return String(text || "").split("\n")[0].slice(0, 40); }
  function rowHTML(item) {
    return '<div class="daily-row' + (item.completed ? " is-done" : "") + '" data-daily-row="' + esc(item.id) + '">' +
      '<button type="button" class="daily-check" role="checkbox" aria-checked="' + (item.completed ? "true" : "false") + '"' +
        ' aria-label="' + esc((item.completed ? "取消完成：" : "标记完成：") + firstLine(item.body)) + '"' +
        ' data-action="daily-toggle" data-id="' + esc(item.id) + '" data-date="' + esc(item.date) + '"><span aria-hidden="true">' + (item.completed ? "✓" : "") + "</span></button>" +
      '<button type="button" class="daily-text" data-action="daily-open" data-id="' + esc(item.id) + '"><span>' + esc(item.body) + "</span></button>" +
      "</div>";
  }
  function listView(date) {
    const entry = S.lists.get(date) || { items: [], total: 0, next: null, loading: false, error: null };
    const body = '<div class="daily-list-meta"><span>' + esc(longDate(date)) + '</span><span class="tiny muted">' + (entry.total || entry.items.length) + " 条</span></div>" +
      (entry.items.length ? '<div class="daily-rows">' + entry.items.map(rowHTML).join("") + "</div>" : '<div class="empty">这一天还没有每日事项</div>') +
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
    const generation = S.generation;
    P.busy(async () => {
      const entry = S.lists.get(date);
      if (!entry || (!entry.items.length && !entry.loading)) await loadList(date, 0);
      if (!sameSession(generation)) return;
      S.listScroll = { date: date, top: 0 };
      S.closeFocus = trigger || null;
      const scroller = document.getElementById("dailyScroller");
      if (scroller) {
        S.scrollToken++;
        anchorFromDom(scroller);
        S.closePosition = { date: S.anchorDate, offset: S.anchorOffset, left: scroller.scrollLeft };
      }
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
    return { title: "每日事项详情", dailyKind: "detail", rebuild: () => detailView(S.detail ? S.detail.raw : raw),
      body: '<div class="daily-detail-head"><span class="daily-detail-date">' + esc(longDate(raw.date)) + "</span>" +
        '<span class="badge ' + (raw.completed ? "b-ok" : "b-normal") + '">' + (raw.completed ? "已完成" : "未完成") + "</span></div>" +
        '<p class="daily-detail-body">' + esc(raw.body) + "</p>" +
        '<div class="callout" id="daily-detail-error" role="alert" hidden></div>',
      foot: dailyWithBack('<button type="button" class="btn ' + (raw.completed ? "" : "ok") + '" data-action="daily-toggle" data-id="' + esc(raw.id) + '" data-date="' + esc(raw.date) + '" data-target="' + (raw.completed ? "false" : "true") + '">' + (raw.completed ? "取消完成" : "标记完成") + "</button>" +
        '<button type="button" class="btn" data-action="daily-edit" data-id="' + esc(raw.id) + '">编辑</button>' +
        '<button type="button" class="btn danger" data-action="daily-delete" data-id="' + esc(raw.id) + '">删除</button>') };
  }
  function openDetail(id) {
    const generation = S.generation;
    if (topKind() === "list") S.listScroll = { date: openListDate(), top: sheetBodyEl.scrollTop, focus: id };
    P.busy(async () => {
      const raw = await P.request("/daily-items/" + encodeURIComponent(id));
      if (!sameSession(generation)) return;
      S.detail = { raw: raw, etag: '"' + raw.rowVersion + '"' };
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
      body: '<div class="field"><label for="daily-date">日期</label><input id="daily-date" type="date" value="' + esc(d.date) + '" data-autofocus /></div>' +
        '<div class="field daily-body-field"><label for="daily-body">内容</label><textarea id="daily-body" maxlength="2000" placeholder="写下今天要记住的事">' + esc(d.body) + "</textarea></div>" +
        '<div class="tiny muted">每日事项仅本人可见，可填写过去、今天或未来的日期，最多 2000 字。</div>' +
        '<div class="callout" id="daily-form-error" role="alert" hidden></div>',
      foot: dailyWithBack('<button type="button" class="btn primary" data-action="daily-save">保存</button>') };
  }
  function openForm(mode, options) {
    const opts = options || {};
    if (mode === "edit") {
      S.formOrigin = "detail";
      S.listScroll = S.listScroll || null;
      drafts.daily = { mode: "edit", id: opts.id, originalDate: opts.date, date: opts.date, body: opts.body, etag: opts.etag, epoch: P.epoch, slot: newSlot() };
    } else {
      S.formOrigin = opts.origin || "calendar";
      if (S.formOrigin === "list" && S.lists.has(opts.date)) S.listScroll = { date: opts.date, top: sheetBodyEl.scrollTop };
      drafts.daily = { mode: "create", id: null, originalDate: null, date: opts.date || S.selected || S.companyToday, body: "", etag: null, epoch: P.epoch, slot: newSlot() };
    }
    openSheet(formView());
  }
  function syncDraft() {
    const d = drafts.daily;
    if (!d) return;
    const date = document.getElementById("daily-date");
    const body = document.getElementById("daily-body");
    if (date) d.date = date.value;
    if (body) d.body = body.value;
  }
  function saveDraft() {
    P.busy(async () => {
      syncDraft();
      const d = drafts.daily;
      if (!d || d.epoch !== P.epoch) throw new Error("请重新打开后再保存。");
      const date = String(d.date || "").trim();
      const body = String(d.body || "").trim();
      if (!parseKey(date)) throw new Error("请填写有效的公历日期。");
      if (!body) throw new Error("请填写内容。");
      if (body.length > 2000) throw new Error("内容不得超过 2000 字。");
      const oldDate = d.originalDate || date;
      await P.mutation("daily-item:" + d.slot, d.mode === "edit" ? "PATCH" : "POST",
        "/daily-items" + (d.id ? "/" + encodeURIComponent(d.id) : ""), { date: date, body: body }, d.etag);
      d.epoch = -1;
      S.detail = null;
      await refreshDates([oldDate, date]);
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
      const date = detail.raw.date;
      await P.mutation("daily-item:delete:" + id, "DELETE", "/daily-items/" + encodeURIComponent(id), null, detail.etag);
      S.detail = null;
      await refreshDates([date]);
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
    P.busy(async () => {
      await P.mutation("daily-item:complete:" + id, "PATCH", "/daily-items/" + encodeURIComponent(id), { completed: true === target }, etag);
      await refreshDates([date], true);
      const raw = await P.request("/daily-items/" + encodeURIComponent(id));
      if (!sameSession()) return;
      if (detail) {
        S.detail = { raw: raw, etag: '"' + raw.rowVersion + '"' };
        replaceTopSheet(detailView(raw));
      }
      if (row) { row.completed = raw.completed; row.rowVersion = raw.rowVersion; }
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
  async function refreshDates(dates, skipList) {
    const unique = Array.from(new Set(dates.filter(Boolean)));
    unique.forEach(date => invalidateDate(date));
    if (skipList) { clearCalendarError(); return; }
    const jobs = unique.filter(date => S.lists.has(date)).map(date => reloadList(date));
    const results = await Promise.allSettled(jobs);
    if (results.some(result => result.status === "rejected")) calendarError("已保存，但刷新数量失败，请重试。");
    else clearCalendarError();
  }
  async function reloadList(date) {
    const entry = listEntry(date);
    const wanted = Math.min(100, Math.max(PAGE, entry.items.length));
    entry.items = []; entry.next = null; entry.total = 0; entry.token++;
    await loadList(date, 0, wanted);
    rerenderOpenList(date, null);
  }

  /* ------------------------------------------------------------ 动作入口 */
  function action(element) {
    const actionName = element.dataset.action;
    if (!actionName || actionName.indexOf("daily-") !== 0) return false;
    const date = element.dataset.date || S.selected || S.companyToday;
    switch (actionName) {
      case "daily-prev": { const d = parseKey((S.anchor || S.companyToday) + "-01") || companyToday(); jumpToMonth(d.getFullYear(), d.getMonth()); return true; }
      case "daily-next": { const d = parseKey((S.anchor || S.companyToday) + "-01") || companyToday(); jumpToMonth(d.getFullYear(), d.getMonth() + 2); return true; }
      case "daily-today": goToDate(S.companyToday); S.selected = S.companyToday; return true;
      case "daily-locate": openLocate(); return true;
      case "daily-locate-save": locateFromForm(); return true;
      case "daily-retry": { const block = S.blocks.find(item => item.key === element.dataset.month); if (block) { S.summaries.delete(block.key); loadBlock(block); } return true; }
      case "daily-new": openForm("create", { origin: element.closest("#sheetBody") ? "list" : "calendar", date: date }); return true;
      case "daily-more": loadMore(date); return true;
      case "daily-reload": reloadOpenList(date); return true;
      case "daily-open": openDetail(element.dataset.id); return true;
      case "daily-toggle": toggleItem(element.dataset.id, date, element.dataset.target ? element.dataset.target === "true" : !currentCompleted(element.dataset.id, date)); return true;
      case "daily-edit": {
        if (!S.detail || S.detail.raw.id !== element.dataset.id) { P.notice("请重新打开后再编辑。"); return true; }
        openForm("edit", { id: element.dataset.id, date: S.detail.raw.date, body: S.detail.raw.body, etag: S.detail.etag }); return true;
      }
      case "daily-delete": openDelete(element.dataset.id); return true;
      case "daily-confirm-delete": confirmDelete(element.dataset.id); return true;
      case "daily-save": saveDraft(); return true;
      case "daily-refresh": S.blocks.forEach(block => S.summaries.delete(block.key)); S.blocks.forEach(loadBlock); clearCalendarError(); return true;
      default: return false;
    }
  }
  function loadMore(date) {
    const entry = S.lists.get(date);
    if (!entry || entry.next == null) return;
    const top = sheetBodyEl.scrollTop;
    P.busy(async () => {
      await loadList(date, entry.next);
      rerenderOpenList(date, top);
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
    const anchor = parseKey((S.anchor || S.companyToday) + "-01") || companyToday();
    openSheet({ title: "定位年月", dailyKind: "locate",
      body: '<div class="field"><label for="daily-locate">年月</label><input id="daily-locate" type="month" value="' + anchor.getFullYear() + "-" + pad(anchor.getMonth() + 1) + '" data-autofocus /></div>' +
        '<div class="tiny muted">连续的左右滑动始终可用；这里用于直接到达较远的年月。</div>' +
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

  /* 把重新渲染后的清单滚动位置和焦点恢复到离开前的位置。 */
  const baseBackSheet = backSheet;
  backSheet = function () {
    baseBackSheet();
    if (topKind() !== "detail") S.detail = null;
    restoreListPosition();
  };
  const baseCloseSheet = closeSheet;
  closeSheet = function () {
    const focus = S.closeFocus;
    const position = S.closePosition;
    S.closeFocus = null; S.closePosition = null;
    S.detail = null; S.listScroll = null; drafts.daily = null;
    baseCloseSheet();
    if (focus && document.contains(focus)) focus.focus({ preventScroll: true });
    else if (S.selected && document.querySelector('[data-daily-date="' + S.selected + '"]')) focusCell(S.selected);
    const scroller = document.getElementById("dailyScroller");
    if (scroller) {
      // The shared sheet's lastFocused.focus() can scroll the background. Restore
      // the calendar after it runs, using a date anchor if its window was extended.
      if (position) {
        const cell = scroller.querySelector('[data-daily-date="' + position.date + '"]');
        scroller.scrollLeft = cell ? scroller.scrollLeft + cell.getBoundingClientRect().left -
          scroller.getBoundingClientRect().left - position.offset : position.left;
        S.scrollLeft = scroller.scrollLeft;
        anchorFromDom(scroller);
        setAnchorFromScroll();
      }
      scroller.scrollTop = 0;
    }
  };

  /* 选择器统一在动作分发之前拦截，避免被旧个人事项处理器吞掉。 */
  const baseRunAction = runAction;
  runAction = function (element) {
    if (action(element)) return;
    baseRunAction(element);
  };

  window.PandoraDaily = { render: render, state: S, action: action, openList: openList, goToDate: goToDate };
})();
