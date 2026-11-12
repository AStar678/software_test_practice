"use strict";
/* 本人资料可编辑；下属资料由后端逐次检查查看权限和手机号权限。
   下属工作页的日程是各人员独立的纵向连续月份流，按月份完整分页读取授权任务；
   月份缓存、日期锚点与像素偏移、日期清单和日视图状态只属于当前人员/账号。 */
(function () {
  const P = window.Pandora;
  if (!P) throw new Error("请先加载潘多拉后端接入核心。");
  const previousAction = runAction;
  let profileDraft = null;
  let sequence = 0;
  const folds = { organization: true, reports: false };
  const avatarPresets = { rabbit: "🐰", cat: "🐱", bear: "🐻", panda: "🐼" };
  /* 人员月历：每周固定三条事项条位置；轨道高度固定，加载完成不改变月份高度。 */
  const STAFF_LANES = 3;
  const STAFF_ROW = 18;
  const STAFF_MAX_MONTHS = 12;
  function avatarHTML(user) {
    if (avatarPresets[user.avatar]) return '<span class="avatar-emoji" aria-hidden="true">' + avatarPresets[user.avatar] + '</span>';
    if (/^data:image\/(png|jpeg);base64,[A-Za-z0-9+/=]+$/.test(user.avatar || "")) return '<img src="' + esc(user.avatar) + '" alt="' + esc(user.displayName || "本人") + '的头像">';
    return esc(Array.from(user.displayName || "")[0] || "我");
  }
  const gear = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m9 3-.5 2-2 1.2-2-.6-2 3.5 1.5 1.5v2.8L2.5 15l2 3.5 2-.6 2 1.1.5 2h4l.5-2 2-1.1 2 .6 2-3.5-1.5-1.6v-2.8L20.5 9l-2-3.5-2 .6-2-1.2L14 3Z"/><circle cx="11.5" cy="12" r="3"/></svg>';

  function me() { return P.data.me || {}; }
  function current(draft) { return draft && draft.epoch === P.epoch && draft.userId === me().id; }
  function row(label, value) {
    return '<div class="profile-row"><span class="k">' + label + '</span><span class="v" style="min-width:0;overflow-wrap:anywhere">' + esc(value == null || value === "" ? "未填写" : value) + '</span></div>';
  }
  function button(action, label, style, id) { return '<button type="button" class="btn ' + (style || "") + '" data-action="' + action + '"' + (id ? ' data-id="' + esc(id) + '"' : '') + '>' + esc(label) + '</button>'; }
  function superior(user) {
    if (user.managerName) return user.managerName;
    const person = user.managerId && personById(user.managerId);
    return person ? person.name : user.managerId ? "已分配直属上级" : "无";
  }
  function identityLabel(user) { return ({founder:"创始人",department_head:"部门负责人",team_head:"团队负责人",employee:"员工"})[user.placementType || user.role] || "员工"; }
  /* 员工资料不再显示与职位混淆的组织身份，统一改用真实“部门 ▸ 团队 ▸ 职位”路径；
     缺层省略，不伪造公司层占位，末端为实际职位名。内部身份仍用于授权。 */
  function orgPart(value) { return String(value == null ? "" : value).trim(); }
  P.staffOrgLine = function (user) {
    if (!user) return "";
    return [user.departmentName, user.teamName, user.positionName].map(orgPart).filter(Boolean).join(" ▸ ");
  };
  function readonlyRows(user) {
    return row("部门", user.departmentName || "公司层") + row("职位", user.positionName) +
      (user.teamName ? row("团队", user.teamName) : "") + row("直属上级", superior(user)) +
      row("入职日期", user.hireDate || "入职日期未设置") +
      row("已入职时长", tenureText(user.tenure));
  }
  function tenureText(tenure) {
    if (!tenure || tenure.years == null) return "入职日期未设置";
    const parts = [];
    if (Number(tenure.years)) parts.push(Number(tenure.years) + "年");
    if (Number(tenure.months)) parts.push(Number(tenure.months) + "个月");
    if (Number(tenure.days) || !parts.length) parts.push(Number(tenure.days || 0) + "天");
    return parts.join("") + (tenure.asOfDate ? "（截至 " + tenure.asOfDate + "）" : "");
  }
  function field(id, type, label, value, max, autocomplete, required) {
    return '<div class="field"><label for="' + id + '">' + label + '</label><input id="' + id + '" type="' + type + '" value="' + esc(value || "") + '" maxlength="' + max + '" autocomplete="' + autocomplete + '"' + (required ? ' required data-autofocus' : '') + ' /></div>';
  }

  function reports() {
    return ((P.data.reports || {}).items || []);
  }

  const expandedReports = new Set();
  let staff = null, staffSequence = 0;
  function reportsSection() {
    const list=reports(), known=new Set(list.map(p=>p.id)), children=new Map();
    list.forEach(p=>{const parent=known.has(p.managerId)?p.managerId:me().id;if(!children.has(parent))children.set(parent,[]);children.get(parent).push(p);});
    const seen=new Set();
    function nodes(parent){return (children.get(parent)||[]).map(person=>{
      if(seen.has(person.id))return '';seen.add(person.id);
      const has=(children.get(person.id)||[]).length>0, open=expandedReports.has(person.id);
      return '<li><div class="staff-tree-node">'+(has?'<button type="button" class="staff-tree-toggle" data-action="p-report-toggle" data-id="'+esc(person.id)+'" aria-expanded="'+open+'" aria-label="'+(open?'收起':'展开')+esc(person.displayName)+'的下属">'+(open?'−':'+')+'</button>':'<span class="staff-tree-spacer"></span>')+'<button type="button" class="staff-tree-person" data-action="p-open-person" data-id="'+esc(person.id)+'"><strong>'+esc(person.displayName)+'</strong><small>'+esc(P.staffOrgLine(person))+'</small></button></div>'+(has&&open?'<ul>'+nodes(person.id)+'</ul>':'')+'</li>';
    }).join('');}
    return '<details class="card profile-fold" data-profile-fold="reports"'+(folds.reports?' open':'')+'><summary><span>下属资料</span><span class="fold-hint">'+list.length+' 人</span><span class="fold-chevron" aria-hidden="true">⌄</span></summary><div class="fold-content">'+(list.length?'<ul class="staff-tree" aria-label="下属组织层级">'+nodes(me().id)+'</ul>':'<p class="empty">暂无下属</p>')+'</div></details>';
  }
  function staffDate(d){return d.slice(5).replace('-','月')+'日';}
  function shiftStaffDate(date,days){return toDateInput(addDays(parseDateInput(date),days));}
  function staffDayKey(date){return toDateInput(date);}
  function staffParse(key){return parseDateInput(key);}
  function staffMonday(date){return addDays(date, -((date.getDay()+6)%7));}
  function staffLongDate(key){const d=staffParse(key);return d?d.getFullYear()+'年'+(d.getMonth()+1)+'月'+d.getDate()+'日':key;}
  function instantLabel(value){const p=P.companyParts(new Date(value));return p.month+'月'+p.day+'日 '+p.hour+':'+p.minute;}
  function taskRange(raw){
    if(raw.allDay)return {start:P.companyDayStart(raw.startDate),end:P.companyDayStart(shiftStaffDate(raw.dueDate,1))};
    return {start:new Date(raw.startAt),end:new Date(raw.dueAt)};
  }
  function staffRawColor(raw){return (raw.tags||[])[0]?.color||raw.tag?.color||'#ffe1ea';}

  /* ---------------- 人员日程：纵向连续月份流 ---------------- */
  function staffMonthBlock(year, month) {
    const first = new Date(year, month - 1, 1);
    const year2 = first.getFullYear(), month2 = first.getMonth() + 1;
    const last = new Date(year2, month2, 0);
    const weeks = [];
    for (let cursor = staffMonday(first), guard = 0; cursor <= staffMonday(last) && guard < 8; cursor = addDays(cursor, 7), guard++) weeks.push(staffDayKey(cursor));
    return { key: year2 + '-' + pad2(month2), year: year2, month: month2, weeks: weeks,
      from: staffDayKey(first), to: staffDayKey(last) };
  }
  function staffBlockOf(s, key) { return s.months.find(block => block.key === key) || null; }
  function staffInitMonths(s, date) {
    const d = staffParse(date) || staffParse(P.data.home.businessDate) || new Date();
    const month = d.getMonth() + 1;
    s.months = [staffMonthBlock(d.getFullYear(), month), staffMonthBlock(d.getFullYear(), month + 1), staffMonthBlock(d.getFullYear(), month + 2)];
    s.anchorDate = staffDayKey(d);
    s.anchorOffset = 8;
  }
  /* 一个任务按公司业务日覆盖目标日期；午夜截止不多占次日，零时长属于开始日。 */
  function staffTaskModel(raw) {
    const task = P.calendarTask(P.mapTask(raw));
    const rawTask = task.raw || raw;
    const range = taskRange(rawTask);
    const start = range.start, end = range.end;
    return { id: task.id, raw: rawTask, task: task, start: start, end: end, title: task.title || "",
      done: task.status === 'done', frozen: !!task.frozen,
      color: staffRawColor(rawTask) };
  }
  function staffCovers(model, key) {
    if (!model) return false;
    const dayStart = P.companyDayStart(key), dayEnd = P.companyDayStart(shiftStaffDate(key, 1));
    return +model.start === +model.end ? model.start >= dayStart && model.start < dayEnd
      : model.end > dayStart && model.start < dayEnd;
  }
  function staffRangeLabel(model) {
    const raw = model.raw;
    if (raw.allDay) return raw.startDate === raw.dueDate ? raw.startDate : raw.startDate + ' 至 ' + raw.dueDate;
    return instantLabel(raw.startAt) + ' 至 ' + instantLabel(raw.dueAt);
  }
  function staffModels(key) {
    const record = staff && staff.records.get(key);
    return record && record.items ? Array.from(record.items.values()).map(staffTaskModel) : [];
  }
  function staffWeekSegments(block, weekStart, models) {
    const days = Array.from({ length: 7 }, (_, i) => shiftStaffDate(weekStart, i));
    const own = days.map(key => String(key).slice(0, 7) === block.key);
    const lanes = [], segments = [];
    models.slice().sort((a, b) => +a.start - +b.start || String(a.id).localeCompare(String(b.id))).forEach(model => {
      const cols = days.map((key, i) => own[i] && staffCovers(model, key) ? i : -1).filter(i => i >= 0);
      if (!cols.length) return;
      const startCol = cols[0], endCol = cols[cols.length - 1] + 1;
      const mask = ((1 << (endCol - startCol)) - 1) << startCol;
      let lane = lanes.findIndex(bits => (bits & mask) === 0);
      if (lane < 0) { lane = lanes.length; lanes.push(0); }
      lanes[lane] |= mask;
      segments.push({ model: model, startCol: startCol, endCol: endCol, lane: lane,
        before: model.start < P.companyDayStart(days[startCol]),
        after: model.end > P.companyDayStart(shiftStaffDate(days[endCol - 1], 1)) });
    });
    return { days: days, own: own, segments: segments };
  }
  function staffBarHTML(segment) {
    const model = segment.model;
    const classes = ["staff-month-event"];
    if (model.done) classes.push("is-done");
    if (model.frozen) classes.push("is-pending-review");
    if (segment.before) classes.push("continues-before");
    if (segment.after) classes.push("continues-after");
    if (segment.lane >= STAFF_LANES) classes.push("is-hidden");
    const label = model.title + "，" + staffRangeLabel(model) + (model.done ? "，已完成" : "") + (model.frozen ? "，审核中" : "") + "，点击查看当天清单";
    return '<button type="button" class="' + classes.join(" ") + '" data-staff-bar data-id="' + esc(model.id) + '"' +
      ' data-start-col="' + segment.startCol + '" data-end-col="' + segment.endCol + '"' +
      ' style="grid-column:' + (segment.startCol + 1) + ' / ' + (segment.endCol + 1) + ';grid-row:' + (segment.lane + 1) + ';--staff-accent:' + esc(model.color) + '"' +
      ' aria-label="' + esc(label) + '" title="' + esc(label) + '">' +
      '<span class="staff-month-caption"><strong>' + esc(model.title) + '</strong><small>' + esc(staffRangeLabel(model) + (model.done ? ' · 已完成' : '') + (model.frozen ? ' · 审核中' : '')) + '</small></span></button>';
  }
  function staffOverflowHTML(data) {
    return data.days.map((key, col) => {
      if (!data.own[col]) return "";
      const hidden = data.segments.filter(segment => segment.lane >= STAFF_LANES && segment.startCol <= col && segment.endCol > col).length;
      return hidden ? '<button type="button" data-action="p-staff-date" data-date="' + key + '" class="staff-month-more" aria-label="' + esc(staffLongDate(key) + '还有' + hidden + '项任务，查看完整清单') + '">+' + hidden + '</button>' : "";
    }).join("");
  }
  function staffWeekHTML(block, weekStart) {
    const monday = staffParse(weekStart);
    const models = staffModels(block.key);
    const data = staffWeekSegments(block, weekStart, models);
    const cells = Array.from({ length: 7 }, (_, i) => {
      const date = addDays(monday, i), key = staffDayKey(date);
      const own = date.getFullYear() === block.year && date.getMonth() + 1 === block.month;
      if (!own) return '<span class="staff-month-date is-blank" aria-hidden="true"></span>';
      const count = models.filter(model => staffCovers(model, key)).length;
      return '<button type="button" class="staff-month-date' + (key === (staff && staff.date) ? ' is-selected' : '') + '" data-action="p-staff-date" data-date="' + key + '" aria-label="' + esc(staffLongDate(key) + '，' + (count ? count + '项任务' : '暂无任务') + '，查看当天清单') + '"><span>' + date.getDate() + '</span></button>';
    }).join("");
    return '<div class="staff-month-week" data-week-start="' + weekStart + '">' +
      '<div class="staff-month-days">' + cells + '</div>' +
      '<div class="staff-month-tracks" style="--staff-lanes:' + STAFF_LANES + ';--staff-row:' + STAFF_ROW + 'px">' +
        data.segments.map(staffBarHTML).join("") + '</div>' +
      '<div class="staff-month-overflow">' + staffOverflowHTML(data) + '</div></div>';
  }
  function staffMonthSection(block) {
    const record = staff && staff.records.get(block.key);
    const state = !record ? 'loading' : record.state;
    const text = state === 'loading' ? '正在读取…' : state === 'error' ? (record.items && record.items.size ? '使用上次读取的任务' : '读取失败') : '';
    return '<section class="staff-month-section is-' + state + '" data-staff-month="' + block.key + '" aria-label="' + block.year + '年' + block.month + '月日程">' +
      '<header class="staff-month-head"><h2>' + block.year + '年' + block.month + '月</h2><span class="staff-month-state" role="status">' + text + '</span>' +
        '<button type="button" class="btn tiny-btn" data-action="p-staff-month-retry" data-month="' + block.key + '"' + (state === 'error' ? '' : ' hidden') + '>重试</button></header>' +
      '<div class="staff-month-weeks">' + block.weeks.map(week => staffWeekHTML(block, week)).join('') + '</div></section>';
  }
  function staffMonthViewHTML(s) {
    if (!s.months.length) return '<div class="staff-state">正在准备月历…</div>';
    return '<div class="staff-month-view" aria-label="人员日程月历">' +
      '<div class="staff-month-weekdays"><span>一</span><span>二</span><span>三</span><span>四</span><span>五</span><span>六</span><span>日</span></div>' +
      '<div class="staff-month-scroll" id="staffMonthScroll" tabindex="0" aria-label="人员日程月历：上下滚动浏览连续月份，补载保持日期位置">' +
        '<div class="staff-month-stream" id="staffMonthStream">' + s.months.map(staffMonthSection).join('') + '</div></div></div>';
  }
  function staffMonthCellTop(scroller, key) {
    const cell = scroller.querySelector('[data-action="p-staff-date"][data-date="' + key + '"]');
    if (!cell) return null;
    return cell.getBoundingClientRect().top - scroller.getBoundingClientRect().top + scroller.scrollTop;
  }
  function staffAnchorFromDom(scroller) {
    if (!staff || !scroller || !scroller.clientHeight) return;
    const top = scroller.getBoundingClientRect().top;
    let best = null, bestTop = Infinity;
    scroller.querySelectorAll('[data-action="p-staff-date"][data-date]').forEach(cell => {
      const cellTop = cell.getBoundingClientRect().top;
      if (cellTop >= top - 1 && cellTop < bestTop) { bestTop = cellTop; best = cell; }
    });
    if (best) { staff.anchorDate = best.dataset.date; staff.anchorOffset = Math.max(0, Math.round(bestTop - top)); }
  }
  function staffLayoutMonths(target) {
    const s = staff;
    if (!s) return;
    const opts = target || {};
    const key = staffParse(opts.date) ? opts.date : s.date;
    const month = String(key).slice(0, 7);
    staffEnsureMonth(s, month);
    const scroller = document.getElementById('staffMonthScroll');
    if (!scroller || !scroller.clientHeight) return;
    const top = staffMonthCellTop(scroller, key);
    if (top != null) scroller.scrollTop = Math.max(0, top - (opts.offset == null ? 8 : opts.offset));
    staffPadMonths(s);
    s.anchorDate = key;
    s.anchorOffset = opts.offset == null ? 8 : opts.offset;
  }
  function scheduleStaffLayout() {
    const s = staff;
    if (!s) return;
    setTimeout(() => { if (staff === s) staffLayoutMonths({ date: s.anchorDate || s.date, offset: s.anchorOffset }); }, 0);
  }
  function staffEnsureMonth(s, key) {
    let guard = 0;
    while (!staffBlockOf(s, key) && guard++ < STAFF_MAX_MONTHS) {
      const first = s.months[0], last = s.months[s.months.length - 1];
      if (!first || !last) return false;
      if (key < first.key) staffPrependMonth(s); else if (key > last.key) staffAppendMonth(s); else return false;
    }
    return !!staffBlockOf(s, key);
  }
  function staffPadMonths(s) {
    const scroller = document.getElementById('staffMonthScroll');
    if (!scroller || !scroller.clientHeight) return;
    for (let guard = 0; guard < STAFF_MAX_MONTHS; guard++) {
      if (s.months.length >= STAFF_MAX_MONTHS) return;
      if (scroller.scrollHeight - scroller.scrollTop - scroller.clientHeight >= scroller.clientHeight * 0.5) return;
      staffAppendMonth(s);
    }
  }
  function staffAppendMonth(s) {
    const last = s.months[s.months.length - 1];
    const stream = document.getElementById('staffMonthStream');
    if (!last || !stream) return false;
    const next = staffMonthBlock(last.year, last.month + 1);
    if (s.months.some(block => block.key === next.key)) return false;
    s.months.push(next);
    stream.insertAdjacentHTML('beforeend', staffMonthSection(next));
    staffLoadMonth(s, next);
    staffTrimMonths(s);
    return true;
  }
  function staffPrependMonth(s) {
    const first = s.months[0];
    const stream = document.getElementById('staffMonthStream');
    const scroller = document.getElementById('staffMonthScroll');
    if (!first || !stream || !scroller) return false;
    const next = staffMonthBlock(first.year, first.month - 2);
    if (s.months.some(block => block.key === next.key)) return false;
    const height = scroller.scrollHeight;
    s.months.unshift(next);
    stream.insertAdjacentHTML('afterbegin', staffMonthSection(next));
    staffLoadMonth(s, next);
    scroller.scrollTop += scroller.scrollHeight - height;
    staffTrimMonths(s);
    return true;
  }
  function staffTrimMonths(s) {
    while (s.months.length > STAFF_MAX_MONTHS) {
      const anchorKey = String(s.anchorDate || s.date).slice(0, 7);
      const index = s.months.findIndex(block => block.key === anchorKey);
      const removeFirst = index > s.months.length / 2 || index < 0;
      const block = removeFirst ? s.months[0] : s.months[s.months.length - 1];
      const node = document.querySelector('[data-staff-month="' + block.key + '"]');
      const scroller = document.getElementById('staffMonthScroll');
      const above = node && scroller && node.getBoundingClientRect().top < scroller.getBoundingClientRect().top;
      const height = scroller ? scroller.scrollHeight : 0;
      if (node) node.remove();
      s.months.splice(s.months.indexOf(block), 1);
      s.records.delete(block.key);
      if (above && scroller) scroller.scrollTop = Math.max(0, scroller.scrollTop - (height - scroller.scrollHeight));
    }
  }
  /* 逐月完整分页读取该人员当前负责且查看者有权的正常已发布任务；失败保留已加载月份。 */
  async function staffLoadMonth(s, block, force) {
    if (!s || s !== staff) return;
    const cached = s.records.get(block.key);
    if (cached && !force && (cached.state === 'ready' || cached.state === 'loading')) return;
    const token = ++s.monthSeq;
    const stillCurrent = () => staff === s && ((s.records.get(block.key) || {}).token === token);
    const previous = cached && cached.items ? cached.items : new Map();
    s.records.set(block.key, { state: 'loading', items: previous, token: token });
    paintStaffMonth(s, block.key);
    const readAll = async () => {
      const items = new Map();
      let offset = 0;
      for (let guard = 0; guard < 60; guard++) {
        const url = '/tasks?assigneeId=' + encodeURIComponent(s.person.id) + '&calendarPreview=true&from=' + block.from + '&to=' + block.to + '&limit=100&offset=' + offset;
        const result = await P.request(url);
        if (!stillCurrent()) return null;
        (result.items || []).forEach(raw => { if (raw && (raw.taskId || raw.id)) items.set(raw.taskId || raw.id, raw); });
        const next = result.nextCursor != null ? result.nextCursor : result.nextOffset;
        if (next == null) break;
        if (Number(next) <= offset) throw new Error('日程分页异常，请重新读取。');
        offset = Number(next);
      }
      return items;
    };
    try {
      let items = null, failure = null;
      for (let attempt = 0; attempt < 2; attempt++) {
        try { items = await readAll(); break; } catch (error) { failure = error; if (error.name === 'AbortError') return; }
      }
      if (!stillCurrent()) return;
      if (!items) throw failure || new Error('读取失败，请重试。');
      s.records.set(block.key, { state: 'ready', items: items, token: token });
      if (s.person && s.person.id) items.forEach(raw => { if (raw) P.subordinateTasks.set(raw.taskId || raw.id, P.mapTask(raw)); });
    } catch (error) {
      if (error.name === 'AbortError') return;
      if (!stillCurrent()) return;
      s.records.set(block.key, { state: 'error', items: previous, token: token, error: error });
    }
    paintStaffMonth(s, block.key);
  }
  function paintStaffMonth(s, key) {
    if (!s || s !== staff) return;
    const block = staffBlockOf(s, key);
    const root = document.querySelector('[data-staff-month="' + key + '"]');
    if (!block || !root) return;
    const record = s.records.get(key);
    const state = !record ? 'loading' : record.state;
    root.classList.toggle('is-ready', state === 'ready');
    root.classList.toggle('is-loading', state === 'loading');
    root.classList.toggle('is-error', state === 'error');
    const stateEl = root.querySelector('.staff-month-state');
    if (stateEl) stateEl.textContent = state === 'loading' ? '正在读取…' : state === 'error' ? (record.items && record.items.size ? '使用上次读取的任务' : '读取失败') : '';
    const retry = root.querySelector('[data-action="p-staff-month-retry"]');
    if (retry) retry.hidden = state !== 'error';
    const models = record && record.items ? Array.from(record.items.values()).map(staffTaskModel) : [];
    block.weeks.forEach(weekStart => {
      const week = root.querySelector('.staff-month-week[data-week-start="' + weekStart + '"]');
      if (!week) return;
      const data = staffWeekSegments(block, weekStart, models);
      const tracks = week.querySelector('.staff-month-tracks');
      const overflow = week.querySelector('.staff-month-overflow');
      if (tracks) tracks.innerHTML = data.segments.map(staffBarHTML).join('');
      if (overflow) overflow.innerHTML = staffOverflowHTML(data);
      week.querySelectorAll('[data-action="p-staff-date"][data-date]').forEach(cell => {
        const key2 = cell.dataset.date;
        const count = models.filter(model => staffCovers(model, key2)).length;
        cell.setAttribute('aria-label', staffLongDate(key2) + '，' + (count ? count + '项任务' : '暂无任务') + '，查看当天清单');
      });
    });
  }
  function staffScrollHandler() {
    const s = staff;
    if (!s) return;
    const scroller = document.getElementById('staffMonthScroll');
    if (!scroller || !scroller.clientHeight) return;
    staffAnchorFromDom(scroller);
    if (s.scrollTimer) return;
    s.scrollTimer = setTimeout(() => {
      s.scrollTimer = null;
      if (staff !== s) return;
      const view = document.getElementById('staffMonthScroll');
      if (!view || !view.clientHeight) return;
      const top = view.scrollTop, bottom = view.scrollHeight - view.clientHeight - top;
      if (top < 80) staffPrependMonth(s); else if (bottom < 80) staffAppendMonth(s);
      staffPadMonths(s);
      staffAnchorFromDom(view);
    }, 120);
  }
  function staffHitDate(bar, clientX) {
    const week = bar.closest('.staff-month-week'), days = week && week.querySelector('.staff-month-days');
    if (!week || !days) return null;
    const rect = days.getBoundingClientRect();
    let col = Math.floor((clientX - rect.left) / (rect.width / 7));
    col = Math.max(Number(bar.dataset.startCol), Math.min(Number(bar.dataset.endCol) - 1, col));
    if (!Number.isFinite(col) || col < 0) return null;
    return shiftStaffDate(week.dataset.weekStart, col);
  }
  document.addEventListener('click', function (event) {
    const bar = event.target.closest && event.target.closest('[data-staff-bar]');
    if (!bar || !staff) return;
    const key = staffHitDate(bar, event.clientX);
    if (!key) return;
    event.preventDefault(); event.stopImmediatePropagation();
    openStaffDaySheet(key, bar);
  }, true);

  /* ---------------- 当天清单：固定标题/操作，仅内容滚动 ---------------- */
  function staffLongWeekday(key) { return ['星期日','星期一','星期二','星期三','星期四','星期五','星期六'][staffParse(key).getDay()]; }
  function staffDayRowsHTML(s) {
    const list = s.list;
    if (!list) return "";
    if (list.loading) return '<div class="staff-state" role="status">正在读取当天日程…</div>';
    if (list.error) return '<div class="staff-state" role="alert">' + esc(list.error) + '<button type="button" class="btn" data-action="p-staff-day-retry">重新读取</button></div>';
    if (!list.rows.length) return '<div class="staff-state">这一天暂无负责的任务</div>';
    return list.rows.map(raw => staffTaskHTML(raw, list.date)).join('');
  }
  function renderStaffPopup() {
    const s = staff;
    if (!s || !s.list) return;
    const date = s.list.date;
    let el = document.getElementById('staffDayPopup');
    if (!el) {
      el = document.createElement('section');
      el.id = 'staffDayPopup';
      el.className = 'staff-day-popup';
      el.setAttribute('role', 'dialog');
      el.setAttribute('aria-modal', 'false');
      el.setAttribute('aria-labelledby', 'staffDayPopupTitle');
      document.body.appendChild(el);
    }
    el.dataset.date = date;
    el.innerHTML = '<header class="staff-day-popup-head"><h3 id="staffDayPopupTitle">' + esc(staffLongDate(date)) + ' <span>' + esc(staffLongWeekday(date)) + '</span> 日程</h3>' +
      '<button type="button" class="btn tiny-btn" data-action="p-staff-day-close" aria-label="关闭当天清单">✕</button></header>' +
      '<div class="staff-day-popup-body" id="staffDayPopupBody" tabindex="0" aria-label="' + esc(staffLongDate(date)) + '完整任务清单">' + staffDayRowsHTML(s) + '</div>' +
      '<div class="staff-day-popup-foot"><button type="button" class="btn primary" data-action="p-staff-day-view" data-date="' + date + '">进入日视图</button>' +
        '<button type="button" class="btn" data-action="p-staff-day-close">关闭</button></div>';
    if (!s.list.focusDone) {
      s.list.focusDone = true;
      const head = el.querySelector('.staff-day-popup-head button');
      if (head) head.focus({ preventScroll: true });
    }
  }
  function removeStaffPopup() {
    const el = document.getElementById('staffDayPopup');
    if (el) el.remove();
    if (staff) staff.list = null;
  }
  function openStaffDaySheet(date, trigger) {
    const s = staff;
    if (!s) return;
    const token = ++s.listSeq;
    s.list = { date: date, rows: [], loading: true, error: null, token: token, focusDone: false, trigger: trigger || null };
    renderStaffPopup();
    (async () => {
      try {
        const items = new Map();
        let offset = 0;
        for (let guard = 0; guard < 60; guard++) {
          const result = await P.request('/tasks?assigneeId=' + encodeURIComponent(s.person.id) + '&calendarPreview=true&from=' + date + '&to=' + date + '&limit=100&offset=' + offset);
          if (staff !== s || s.listSeq !== token) return;
          (result.items || []).forEach(raw => { if (raw && (raw.taskId || raw.id)) items.set(raw.taskId || raw.id, raw); });
          const next = result.nextCursor != null ? result.nextCursor : result.nextOffset;
          if (next == null) break;
          if (Number(next) <= offset) throw new Error('日程分页异常，请重新读取。');
          offset = Number(next);
        }
        const rows = Array.from(items.values()).filter(raw => staffCovers(staffTaskModel(raw), date))
          .sort((a, b) => +taskRange(a).start - +taskRange(b).start || String(a.taskId || a.id).localeCompare(String(b.taskId || b.id)));
        if (staff !== s || !s.list || s.list.token !== token) return;
        s.list.rows = rows; s.list.loading = false;
        renderStaffPopup();
      } catch (error) {
        if (error.name === 'AbortError' || staff !== s || !s.list || s.list.token !== token) return;
        s.list.loading = false; s.list.error = error.message || '读取失败，请重试。';
        renderStaffPopup();
      }
    })();
  }
  function closeStaffDaySheet(restoreFocus) {
    const s = staff, trigger = s && s.list ? s.list.trigger : null;
    removeStaffPopup();
    if (restoreFocus && trigger && document.contains(trigger)) trigger.focus({ preventScroll: true });
  }

  /* ---------------- 日视图：沿用本人日轴/清单口径 ---------------- */
  function staffTaskHTML(raw,selectedDate=staff.date){
    const id=raw.taskId||raw.id,range=taskRange(raw),start=P.companyDayStart(selectedDate),end=P.companyDayStart(shiftStaffDate(selectedDate,1));
    const time=raw.allDay?'全天':(+range.start===+range.end?'时点 · ':'')+(range.start<start?'前日延续':instantLabel(raw.startAt).split(' ')[1])+' — '+(range.end>=end?'24:00':instantLabel(raw.dueAt).split(' ')[1]);
    const tag=(raw.tags||[])[0]||raw.tag;
    return '<button type="button" class="staff-work-item'+(raw.frozen?' is-pending-review':'')+'" data-task="'+esc(id)+'" style="--staff-accent:'+esc(tag?.color||'#f5ccdE')+'"><span class="staff-work-time">'+esc(time)+'</span><strong>'+esc(raw.title)+'</strong><span class="staff-work-meta">'+esc(({todo:'待开始',doing:'进行中',done:'已完成'})[raw.executionState]||'待开始')+(raw.frozen?' · 审核中':'')+'</span><small>'+esc(instantLabel(raw.startAt)+' 至 '+instantLabel(raw.dueAt))+'</small></button>';
  }
  /* 人员阅读入口复用同一所属日期口径：完整年月日 + 按公司今天判断的相对日。 */
  function staffDateText(raw){const d=parseDateInput(raw&&raw.businessDate);return d?d.getFullYear()+'年'+(d.getMonth()+1)+'月'+d.getDate()+'日':'—';}
  function staffRelative(raw){const d=parseDateInput(raw&&raw.businessDate);const today=parseDateInput(P.data?.home?.businessDate);if(!d||!today)return '';const diff=Math.round((+d-+today)/86400000);return diff===0?'今天':diff===-1?'昨天':diff===-2?'前天':'';}
  function staffLogHTML(raw){const rel=staffRelative(raw);return '<button type="button" class="staff-log-card" data-action="p-staff-log" data-id="'+esc(raw.id)+'"><span class="staff-work-time">'+esc(staffDateText(raw))+(rel?' · '+esc(rel):'')+'</span><strong>'+esc(raw.body)+'</strong><small>'+esc((raw.tags||[]).map(t=>t.name).join('、')||'无标签')+' · 查看全文与评论 →</small></button>';}
  function staffDayHTML(){
    const s=staff,date=s.date,all=[],timed=[];
    (s.dayRows||[]).forEach(raw=>{const task=P.mapTask(raw),coverage=P.calendar.dayCoverage(task,parseDateInput(date));if(!coverage)return;if(task.allDay||coverage.fullDay)all.push(raw);else timed.push(Object.assign({task},coverage));});
    const modes='<div class="staff-day-formats" role="group" aria-label="日视图显示方式">'+[['axis','时间轴'],['list','任务清单']].map(([mode,label])=>'<button type="button" data-action="p-staff-format" data-format="'+mode+'" aria-pressed="'+(s.dayFormat===mode)+'">'+label+'</button>').join('')+'</div>';
    if(s.dayFormat==='list')return modes+((s.dayRows||[]).length?s.dayRows.map(raw=>staffTaskHTML(raw)).join(''):'<div class="staff-state">这一天暂无负责的任务</div>');
    const events=P.calendar.layoutDayEvents(timed),hours=Array.from({length:25},(_,h)=>'<div class="staff-axis-hour" style="top:'+h*60+'px"><span>'+pad2(h)+':00</span></div>').join('');
    const bars=events.map(e=>{
      const task=e.task,raw=task.raw,range=taskRange(raw),start=P.companyDayStart(date),end=P.companyDayStart(shiftStaffDate(date,1)),done=raw.executionState==='done';
      return '<div role="group" tabindex="0" class="staff-axis-event'+(e.point?' is-point':'')+(done?' is-done':'')+(task.frozen?' is-pending-review':'')+'" data-task="'+esc(task.id)+'" data-start-minute="'+e.start+'" data-end-minute="'+e.end+'" data-columns="'+e.columns+'" style="top:'+e.drawStart+'px;height:'+(e.drawEnd-e.drawStart)+'px;left:'+(e.lane*100/e.columns)+'%;width:'+(100/e.columns)+'%;--staff-accent:'+esc(staffRawColor(raw))+';--true-top:'+(e.start-e.drawStart)+'px;--true-height:'+Math.max(2,e.end-e.start)+'px" aria-label="'+esc(task.title+'，'+instantLabel(raw.startAt)+' 至 '+instantLabel(raw.dueAt)+(done?'，已完成':''))+'" title="'+esc(task.title+' · '+instantLabel(raw.startAt)+' 至 '+instantLabel(raw.dueAt)+(done?' · 已完成':''))+'"><span class="staff-axis-true"><span class="p-axis-caption"><strong>'+esc(task.title)+'</strong><small>'+esc(instantLabel(raw.startAt).split(' ')[1]+(done?' · 已完成':'')+(task.frozen?' · 审核中':''))+'</small></span></span></div>';
    }).join('');
    return modes+(all.length?'<div class="staff-allday"><span>全天</span><div>'+all.map(raw=>{const done=raw.executionState==='done';return '<button type="button" class="'+(done?'is-done ':'')+(raw.frozen?'is-pending-review':'')+'" data-task="'+esc(raw.taskId||raw.id)+'" style="--staff-accent:'+esc(staffRawColor(raw))+'">'+esc(raw.title+(done?' · 已完成':'')+(raw.frozen?' · 审核中':''))+'</button>';}).join('')+'</div></div>':'')+'<div class="staff-axis-scroll" tabindex="0" aria-label="当天00:00至24:00时间轴，可上下滚动"><div class="staff-day-axis">'+hours+'<div class="staff-axis-events">'+bars+'</div></div></div>';
  }
  function staffCalendarNav(){
    const s=staff,dates=Array.from({length:7},(_,i)=>shiftStaffDate(s.date,i-3));
    return '<div class="staff-calendar-modes" role="group" aria-label="人员日程视图">'+[['month','月视图'],['day','日视图']].map(([mode,label])=>'<button type="button" data-action="p-staff-mode" data-mode="'+mode+'" aria-pressed="'+(s.mode===mode)+'">'+label+'</button>').join('')+'</div><div class="staff-date-nav"><button type="button" data-action="p-staff-nav" data-step="-1" aria-label="上一'+(s.mode==='month'?'月':'天')+'">‹</button><label class="staff-calendar-picker"><span class="sr-only">跳转日期</span><input type="date" id="staff-calendar-date" value="'+s.date+'" aria-label="跳转日期"></label><button type="button" data-action="p-staff-today">今天</button><button type="button" data-action="p-staff-nav" data-step="1" aria-label="下一'+(s.mode==='month'?'月':'天')+'">›</button></div>'+(s.mode==='day'?'<div class="staff-date-strip" role="group" aria-label="查看日期">'+dates.map(date=>'<button type="button" data-action="p-staff-date" data-date="'+date+'" aria-pressed="'+(date===s.date)+'"><small>'+['日','一','二','三','四','五','六'][parseDateInput(date).getDay()]+'</small><strong>'+Number(date.slice(-2))+'</strong></button>').join('')+'</div>':'');
  }
  function restoreStaffAxis(){requestAnimationFrame(()=>{const axis=document.querySelector('.staff-axis-scroll');if(!axis||!staff)return;const date=parseDateInput(staff.date),events=(staff.dayRows||[]).map(raw=>P.calendar.dayCoverage(P.mapTask(raw),date)).filter(e=>e&&!e.fullDay);axis.scrollTop=Math.max(0,(events[0]?.start??480)-60);});}
  /* 日程模式下的可见内容：月份流或日视图；日志页签仍为日志列表。 */
  function staffScheduleHTML(s) {
    if (s.mode === 'month') return staffMonthViewHTML(s);
    if (s.dayLoading) return '<div class="staff-state" role="status">正在读取日视图…</div>';
    if (s.dayError) return '<div class="staff-state" role="alert">' + esc(s.dayError) + '<button type="button" class="btn" data-action="p-staff-day-reload">重新读取</button></div>';
    return staffDayHTML();
  }
  function staffView(){
    const s=staff;if(!s)return null;
    const p=s.person;
    const dateBar=s.tab==='schedule'?staffCalendarNav():'';
    const content=s.tab==='schedule'?staffScheduleHTML(s):(s.logLoading?'<div class="staff-state" role="status">正在读取日志…</div>':s.logError?'<div class="staff-state" role="alert">'+esc(s.logError)+'<button type="button" class="btn" data-action="p-staff-retry">重新读取</button></div>':(s.logRows.length?s.logRows.map(staffLogHTML).join(''):'<div class="staff-state">暂无可查看的日志</div>'));
    return {title:p.displayName+'的工作',fullscreen:true,subordinate:true,staffWork:true,body:'<section class="staff-panel" data-staff-panel="'+esc(p.id)+'"><header class="staff-person"><span class="staff-avatar">'+esc(Array.from(p.displayName||'')[0]||'人')+'</span><div><h2>'+esc(p.displayName)+'</h2><p class="staff-org-path">'+esc(P.staffOrgLine(p)||'职务未设置')+'</p></div></header><div class="staff-tabs" role="group" aria-label="下属工作类型">'+[['schedule','日程'],['logs','日志']].map(([tab,label])=>'<button type="button" data-action="p-staff-tab" data-tab="'+tab+'" aria-pressed="'+(s.tab===tab)+'">'+label+'</button>').join('')+'</div>'+dateBar+'<div class="staff-content">'+content+'</div>'+(!s.logLoading&&!s.logError&&s.tab==='logs'&&s.logNext!=null?'<button type="button" class="btn staff-more" data-action="p-staff-more">加载更早日志</button>':'')+'</section>',foot:'',rebuild:function(){setTimeout(()=>{if(staff===s)staffAfterRender(s);},0);return staffView();}};
  }
  /* 渲染后的定位：月视图恢复日期锚点，日视图恢复时间轴起点。 */
  function staffAfterRender(s) {
    if (staff !== s) return;
    if (s.tab === 'schedule' && s.mode === 'month') {
      const scroller = document.getElementById('staffMonthScroll');
      if (!scroller) return;
      staffLayoutMonths({ date: s.anchorDate || s.date, offset: s.anchorOffset });
      scroller.addEventListener('scroll', staffScrollHandler, { passive: true });
      return;
    }
    if (s.tab === 'schedule') restoreStaffAxis();
  }
  function paintStaff(preserveScroll) {
    const s = staff;
    if (!s) return;
    const top = preserveScroll ? sheetBodyEl.scrollTop : 0;
    replaceTopSheet(staffView());
    sheetBodyEl.scrollTop = top;
    setTimeout(() => { if (staff === s) staffAfterRender(s); }, 0);
  }
  function staffCardView(){
    if(!staff)return null;
    const p=staff.person;
    const path=P.staffOrgLine(p);
    return {title:p.displayName+'的资料',subordinate:true,body:'<div class="profile-details">'+
      row('组织职务',path||'未填写')+row('直属上级',superior(p))+
      row('联系电话',p.phone)+row('邮箱',p.email)+
      row('入职日期',p.hireDate||'入职日期未设置')+row('已入职',tenureText(p.tenure))+'</div>'+
      '<div class="action-grid"><button type="button" class="btn primary" data-action="p-staff-enter" data-tab="schedule">查看日程</button><button type="button" class="btn" data-action="p-staff-enter" data-tab="logs">查看日志</button></div>',
      foot:withBack(button('sheet-close','关闭'))};
  }
  P.subordinateKey = function () { return staff && staff.epoch === P.epoch ? staff.person.id + ':' + P.epoch : null; };

  async function loadStaffLogs(s, more) {
    const seq = ++s.logSeq;
    s.logLoading = true; s.logError = null;
    paintStaff(false);
    try {
      const directory = await P.request('/me/reports');
      if (staff !== s) return;
      if (!(directory.items || []).some(p => p.id === s.person.id)) throw Error('已无权查看该人员，请关闭后刷新下属资料。');
      const person = await P.request('/users/' + encodeURIComponent(s.person.id));
      if (staff !== s || s.logSeq !== seq) return;
      if (!person.canReadLogs) throw Error('当前无权查看此人的日志。');
      const result = await P.request('/work-logs?scope=visible&authorId=' + encodeURIComponent(person.id) + '&limit=10&offset=' + (more ? (s.logNext || 0) : 0));
      if (staff !== s || s.logSeq !== seq) return;
      s.person = person;
      const rows = (result.items || []).slice().sort((a, b) => String(b.businessDate || '').localeCompare(String(a.businessDate || '')) ||
        new Date(b.createdAt) - new Date(a.createdAt) || String(a.id).localeCompare(String(b.id)));
      s.logRows = more ? (s.logRows || []).concat(rows) : rows;
      s.logNext = result.nextOffset ?? null;
      s.logLoading = false;
      paintStaff(false);
    } catch (error) {
      if (staff !== s || s.logSeq !== seq || error.name === 'AbortError') return;
      s.logLoading = false; s.logError = error.message;
      loseStaffAccess(s);
    }
  }
  function loseStaffAccess(s) {
    if (!s) return;
    s.records.clear(); s.dayRows = []; s.logRows = []; s.logNext = null; s.list = null;
    P.subordinateTasks.clear(); P.subordinateLogs.clear();
    removeStaffPopup();
    s.person = Object.assign({}, s.person, { canSetHandoverPreset: false });
    delete s.person.phone; delete s.person.email; delete s.person.tenure; delete s.person.hireDate;
    paintStaff(false);
  }
  async function loadStaffDay(s, date) {
    const token = ++s.daySeq;
    s.dayLoading = true; s.dayError = null;
    if (s.mode === 'day' && s.tab === 'schedule') paintStaff(false);
    try {
      const items = new Map();
      let offset = 0;
      for (let guard = 0; guard < 60; guard++) {
        const result = await P.request('/tasks?assigneeId=' + encodeURIComponent(s.person.id) + '&calendarPreview=true&from=' + date + '&to=' + date + '&limit=100&offset=' + offset);
        if (staff !== s || s.daySeq !== token) return;
        (result.items || []).forEach(raw => { if (raw && (raw.taskId || raw.id)) items.set(raw.taskId || raw.id, raw); });
        const next = result.nextCursor != null ? result.nextCursor : result.nextOffset;
        if (next == null) break;
        if (Number(next) <= offset) throw new Error('日程分页异常，请重新读取。');
        offset = Number(next);
      }
      const rows = Array.from(items.values()).filter(raw => staffCovers(staffTaskModel(raw), date));
      if (staff !== s || s.daySeq !== token) return;
      s.dayRows = rows; s.dayLoading = false;
      if (s.mode === 'day' && s.tab === 'schedule') paintStaff(false);
    } catch (error) {
      if (error.name === 'AbortError' || staff !== s || s.daySeq !== token) return;
      s.dayLoading = false; s.dayError = error.message; s.dayRows = [];
      if (s.mode === 'day' && s.tab === 'schedule') paintStaff(false);
    }
  }
  function openPerson(id){
    const person=reports().find(p=>p.id===id);
    if(!person){P.notice('当前下属资料中没有此人，请刷新后重试。');return;}
    removeStaffPopup();
    const s = { person: person, epoch: P.epoch, tab: 'schedule', mode: 'month', dayFormat: 'axis', date: P.data.home.businessDate,
      months: [], records: new Map(), anchorDate: null, anchorOffset: 8, monthSeq: 0,
      dayRows: [], dayLoading: false, dayError: null, daySeq: 0,
      logRows: [], logNext: null, logLoading: false, logError: null, logSeq: 0,
      list: null, listSeq: 0, restoreScroll: null };
    staff = s;
    staffInitMonths(s, s.date);
    P.subordinateTasks.clear(); P.subordinateLogs.clear();
    s.months.forEach(block => staffLoadMonth(s, block));
    openSheet(staffCardView());
    setTimeout(() => { if (staff === s && s.tab === 'schedule' && s.mode === 'month') staffAfterRender(s); }, 0);
    return P.busy(async()=>{const raw=await P.request('/users/'+encodeURIComponent(id));if(staff!==s||s.epoch!==P.epoch)return;s.person=raw;replaceTopSheet(staffCardView());});
  }
  function openPersonLogs(id){openPerson(id);}
  function enterStaffWork(s, tab, mode) {
    if (tab) s.tab = tab === 'logs' ? 'logs' : 'schedule';
    if (mode) s.mode = mode === 'day' ? 'day' : 'month';
    removeStaffPopup();
    openSheet(staffView());
    setTimeout(() => { if (staff === s) staffAfterRender(s); }, 0);
    if (s.tab === 'logs') { loadStaffLogs(s, false); return; }
    if (s.mode === 'day') { loadStaffDay(s, s.date); return; }
    s.months.forEach(block => staffLoadMonth(s, block));
  }

  renderMe = function () {
    const user = me();
    document.getElementById("page-me").innerHTML = '<section class="card profile-card"><div class="profile-hero"><div class="avatar">' +
      avatarHTML(user) + '</div><div class="profile-heading"><p class="eyebrow">MY WORKSPACE</p><h2>' + esc(user.displayName) + '</h2><p>' + esc(user.positionName || "职位未设置") + '</p></div>' +
      '<button type="button" class="profile-settings" data-action="p-open-settings" aria-label="个人设置">' + gear + '</button></div>' +
      '<div class="profile-details">' + row("联系电话", user.phone) + row("邮箱", user.email) + row("入职日期", user.hireDate || "入职日期未设置") + row("已入职时长", tenureText(user.tenure)) + '</div></section>' +
      '<details class="card profile-fold" data-profile-fold="organization"' + (folds.organization ? ' open' : '') + '><summary><span>组织信息</span><span class="fold-hint">由管理员维护</span><span class="fold-chevron" aria-hidden="true">⌄</span></summary><div class="profile-details fold-content">' + readonlyRows(user) + '</div></details>' + reportsSection();
  };

  function openSettings() {
    const user = me();
    openSheet({ title: "个人设置", body: '<div class="settings-menu">' + button("p-edit-profile", "编辑资料与头像", "primary") +
      '<div class="settings-section"><h3>账号与安全</h3>' + row("登录手机号", user.phone) +
      '<div class="action-grid">' + button("p-change-password", "修改密码") + button("p-refresh-workspace", "刷新数据") +
      '<button type="button" class="btn" data-action="p-open-handover-preset" data-id="' + esc(user.id) + '" data-name="' + esc(user.displayName) + '">交接预设</button></div></div>' +
      button("p-logout", "退出登录", "danger") + '</div>' });
  }

  function formView(draft) {
    const raw = draft.raw;
    return {
      title: "编辑个人资料",
      body: '<section class="avatar-editor" aria-label="修改头像"><div class="avatar avatar-preview">' + avatarHTML(raw) + '</div><div><h3>个人头像</h3><p class="tiny muted">选择一个头像，或上传自己的照片</p></div></section>' +
        '<div class="avatar-options" role="group" aria-label="选择头像">' +
        '<button type="button" class="avatar-option" data-action="p-select-avatar" data-avatar="" aria-label="使用姓名头像" aria-pressed="' + !raw.avatar + '">' + esc(Array.from(raw.displayName || "我")[0]) + '</button>' +
        Object.keys(avatarPresets).map(key => '<button type="button" class="avatar-option" data-action="p-select-avatar" data-avatar="' + key + '" aria-label="' + ({rabbit:'兔子',cat:'小猫',bear:'小熊',panda:'熊猫'})[key] + '头像" aria-pressed="' + (raw.avatar === key) + '">' + avatarPresets[key] + '</button>').join('') + '</div>' +
        '<div class="field avatar-upload"><label for="profile-avatar-file">上传照片（PNG / JPG，最大10MB）</label><input id="profile-avatar-file" type="file" accept="image/png,image/jpeg"><p class="tiny muted" id="avatar-upload-status" role="status">' + (/^data:image\//.test(raw.avatar || "") ? '照片已选好，保存资料后生效。' : '照片会自动裁成方形，保存资料后生效。') + '</p></div>' +
        row("姓名", raw.displayName) + row("登录手机号", raw.phone) +
        field("profile-email", "email", "邮箱（选填）", raw.email, 254, "email", false) +
        '<p class="tiny muted">姓名和登录手机号由管理员维护。邮箱仅本人可见，可留空清除。</p><div class="divider"></div>' + readonlyRows(raw) +
        '<p class="tiny muted">账号、部门、身份和直属上级由管理员维护。</p><div class="callout reject" id="profile-error" role="alert" hidden></div>',
      foot: button("sheet-back", "返回设置") + button("p-save-profile", "保存资料", "primary")
    };
  }

  function openProfile() {
    return P.busy(async function () {
      const epoch = P.epoch, userId = me().id;
      const raw = await P.request("/me/profile");
      if (epoch !== P.epoch || userId !== me().id) return;
      sequence += 1;
      profileDraft = { raw: raw, originalAvatar: raw.avatar || null, epoch: epoch, userId: userId, etag: '"' + raw.rowVersion + '"', slot: "profile:" + epoch + ":" + sequence };
      openSheet(formView(profileDraft));
    });
  }

  function saveProfile() {
    return P.busy(async function () {
      const draft = profileDraft;
      if (!current(draft)) throw new Error("资料表单已失效，请重新打开。");
      const email = document.getElementById("profile-email");
      if (!email) throw new Error("请重新打开个人资料表单。");
      if (email.value.trim() && !email.checkValidity()) { email.focus(); throw new Error("请输入有效的邮箱地址。"); }
      const body = { email: email.value.trim() };
      if (draft.avatarLoading) throw new Error("头像正在处理，请稍候再保存。");
      if ((draft.raw.avatar || null) !== draft.originalAvatar) body.avatar = draft.raw.avatar || null;
      await P.mutation(draft.slot, "PATCH", "/me/profile", body, draft.etag);
      // Keep both the form and its retry key if the write succeeds but refreshing fails.
      await P.reload();
      if (!current(draft)) return;
      profileDraft = null;
      closeSheet();
      P.notice("个人资料已保存。");
    }, "profile-error");
  }

  function syncProfileDraft() {
    if (!current(profileDraft)) return;
    for (const [field, id] of [["email", "profile-email"]]) {
      const input = document.getElementById(id);
      if (input) profileDraft.raw[field] = input.value;
    }
  }
  function selectAvatar(value) {
    if (!current(profileDraft) || profileDraft.avatarLoading || (value && !avatarPresets[value])) return;
    syncProfileDraft(); profileDraft.raw.avatar = value || null;
    replaceTopSheet(formView(profileDraft));
  }
  document.addEventListener("change", async function (event) {
    if (event.target.id !== "profile-avatar-file" || !current(profileDraft)) return;
    const draft = profileDraft, file = event.target.files[0];
    if (!file) return;
    const status = document.getElementById("avatar-upload-status");
    try {
      if (!["image/png", "image/jpeg"].includes(file.type) || file.size > 10 * 1024 * 1024) throw new Error("请选择10MB以内的 PNG 或 JPG 照片。");
      draft.avatarLoading = true; status.textContent = "正在处理头像…";
      const data = await new Promise((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(reader.result); reader.onerror = () => reject(new Error("照片读取失败，请重新选择。")); reader.readAsDataURL(file); });
      const image = await new Promise((resolve, reject) => { const img = new Image(); img.onload = () => resolve(img); img.onerror = () => reject(new Error("照片无法打开，请重新选择。")); img.src = data; });
      if (!current(draft) || profileDraft !== draft || !document.getElementById("profile-email")) return;
      const canvas = document.createElement("canvas"); canvas.width = canvas.height = 256;
      const context = canvas.getContext("2d"); context.fillStyle = "#fff9fc"; context.fillRect(0, 0, 256, 256);
      const size = Math.min(image.width, image.height);
      context.drawImage(image, (image.width - size) / 2, (image.height - size) / 2, size, size, 0, 0, 256, 256);
      syncProfileDraft(); draft.raw.avatar = canvas.toDataURL("image/jpeg", .9);
      replaceTopSheet(formView(draft));
    } catch (error) { if (status.isConnected) status.textContent = error.message; }
    finally { draft.avatarLoading = false; }
  });
  document.addEventListener("toggle", function (event) {
    if (event.target.matches?.("[data-profile-fold]")) folds[event.target.dataset.profileFold] = event.target.open;
  }, true);
  P.sessionReset.push(function () { profileDraft = null; staff=null; staffSequence++; expandedReports.clear(); folds.organization = true; folds.reports = false; removeStaffPopup(); P.subordinateTasks.clear(); P.subordinateLogs.clear(); });

  function passwordView() {
    return {
      title: "修改密码",
      body: '<div class="field"><label for="cp-current">当前密码</label><input id="cp-current" type="password" autocomplete="current-password" required data-autofocus></div>' +
        '<div class="field"><label for="cp-new">新密码</label><input id="cp-new" type="password" autocomplete="new-password" required></div>' +
        '<div class="field"><label for="cp-confirm">确认新密码</label><input id="cp-confirm" type="password" autocomplete="new-password" required></div>' +
        '<p class="tiny muted">至少10个字符，须同时包含字母和数字，UTF-8 长度不超过72字节。修改成功后包括当前会话在内的全部会话失效，需重新登录。</p>' +
        '<div class="callout reject" id="password-error" role="alert" hidden></div>',
      foot: button("sheet-back", "返回设置") + button("p-save-password", "修改密码", "primary")
    };
  }

  function openPassword() { return P.busy(async function () { openSheet(passwordView()); }); }

  function savePassword() {
    return P.busy(async function () {
      const current = document.getElementById("cp-current");
      const next = document.getElementById("cp-new");
      const confirm = document.getElementById("cp-confirm");
      if (!current || !next || !confirm) throw new Error("请重新打开修改密码表单。");
      const reject = message => {
        const el = document.getElementById("password-error");
        el.textContent = message; el.hidden = false; el.scrollIntoView({ block: "nearest" });
      };
      if (next.value !== confirm.value) return reject("两次输入的新密码不一致。");
      await P.request("/auth/password", { method: "POST", body: { currentPassword: current.value, newPassword: next.value } });
      closeSheet();
      P.reLogin("密码已修改，请使用新密码重新登录。");
    }, "password-error");
  }

  runAction = function (element) {
    const action=element.dataset.action;
    if(action==='p-report-toggle') {const id=element.dataset.id;if(expandedReports.has(id))expandedReports.delete(id);else expandedReports.add(id);renderMe();document.querySelector('[data-action="p-report-toggle"][data-id="'+id+'"]')?.focus();return;}
    if(action==='p-staff-log')return openLogDetail(element.dataset.id);
    if(action==='p-staff-enter'&&staff){enterStaffWork(staff, element.dataset.tab);return;}
    if(action==='p-staff-day-close'){closeStaffDaySheet(true);return;}
    if(action==='p-staff-day-view'&&staff){const date=element.dataset.date||(staff.list&&staff.list.date);closeStaffDaySheet(false);staff.date=date;staff.mode='day';staff.tab='schedule';loadStaffDay(staff,date);return;}
    if(action==='p-staff-day-retry'&&staff){openStaffDaySheet(staff.list&&staff.list.date||staff.date, staff.list&&staff.list.trigger);return;}
    if(action==='p-staff-day-reload'&&staff){loadStaffDay(staff,staff.date);return;}
    if(action==='p-staff-month-retry'&&staff){const key=element.dataset.month;if(key){const block=staffBlockOf(staff,key);if(block)staffLoadMonth(staff,block,true);}return;}
    if(action?.startsWith('p-staff-')&&staff){
      if(action==='p-staff-tab'){
        staff.tab=element.dataset.tab==='logs'?'logs':'schedule';
        paintStaff(false);
        if(staff.tab==='logs')loadStaffLogs(staff,false);
        else if(staff.mode==='day')loadStaffDay(staff,staff.date);
        else staff.months.forEach(block=>staffLoadMonth(staff,block));
        return;
      }
      if(action==='p-staff-date'){
        if(staff.mode==='day'){staff.date=element.dataset.date;loadStaffDay(staff,staff.date);return;}
        openStaffDaySheet(element.dataset.date,element);return;
      }
      if(action==='p-staff-format'){staff.dayFormat=element.dataset.format==='list'?'list':'axis';paintStaff(true);return;}
      if(action==='p-staff-more'){loadStaffLogs(staff,true);return;}
      if(action==='p-staff-retry'){loadStaffLogs(staff,false);return;}
      if(action==='p-staff-today')staff.date=P.data.home.businessDate;
      if(action==='p-staff-mode')staff.mode=element.dataset.mode==='day'?'day':'month';
      if(action==='p-staff-nav'){
        const d=parseDateInput(staff.date),step=Number(element.dataset.step);
        staff.date=staff.mode==='month'?toDateInput(new Date(d.getFullYear(),d.getMonth()+step,1)):shiftStaffDate(staff.date,step);
      }
      if(staff.tab==='logs'){paintStaff(false);return;}
      if(staff.mode==='day'){loadStaffDay(staff,staff.date);return;}
      /* 月视图：目标月未挂载时重设连续窗口，否则保留已加载月份并恢复日期锚点。 */
      const month=String(staff.date).slice(0,7);
      if(!staffBlockOf(staff,month)){
        const d=parseDateInput(staff.date)||new Date();
        staff.months=[staffMonthBlock(d.getFullYear(),d.getMonth()+1),staffMonthBlock(d.getFullYear(),d.getMonth()+2),staffMonthBlock(d.getFullYear(),d.getMonth()+3)];
        staff.months.forEach(block=>staffLoadMonth(staff,block));
      }
      staff.anchorDate=staff.date;staff.anchorOffset=8;
      paintStaff(false);
      staff.months.forEach(block=>staffLoadMonth(staff,block));
      return;
    }
    if (element.dataset.action === "p-open-settings") return openSettings();
    if (element.dataset.action === "p-select-avatar") return selectAvatar(element.dataset.avatar);
    if (element.dataset.action === "p-open-person") return openPerson(element.dataset.id);
    if (element.dataset.action === "p-open-person-logs") return openPersonLogs(element.dataset.id);
    if (element.dataset.action === "p-edit-profile") return openProfile();
    if (element.dataset.action === "p-save-profile") return saveProfile();
    if (element.dataset.action === "p-change-password") return openPassword();
    if (element.dataset.action === "p-save-password") return savePassword();
    return previousAction(element);
  };
  document.addEventListener('keydown',event=>{
    if(event.target.matches?.('.staff-month-event,.staff-axis-event')&&['Enter',' '].includes(event.key)){
      event.preventDefault();event.stopPropagation();
      if(event.target.matches('.staff-month-event')){
        const key=staffHitDate(event.target, event.target.getBoundingClientRect().left+2);
        if(key)openStaffDaySheet(key,event.target);
      } else openTaskDetail(event.target.dataset.task);
    }
  });
  document.addEventListener('change',function(event){if(event.target.id==='staff-calendar-date'&&staff){const value=event.target.value,d=parseDateInput(value);if(d&&toDateInput(d)===value){staff.date=value;if(staff.mode==='day'){loadStaffDay(staff,value);}else{paintStaff(false);}}}});
  /* 当天清单是固定浮层：被任务/日志详情覆盖时先隐藏，返回人员工作页后恢复；
     若已离开人员工作中则直接移除。 */
  function hideStaffPopupForCover() {
    const el = document.getElementById('staffDayPopup');
    if (!el || !staff) return;
    const top = sheetStack[sheetStack.length - 1];
    if (top && !top.staffWork) el.style.display = 'none';
  }
  function showStaffPopupIfNeeded() {
    const el = document.getElementById('staffDayPopup');
    if (!el || !staff || !staff.list) return;
    const top = sheetStack[sheetStack.length - 1];
    if (top && top.staffWork) el.style.display = '';
  }
  const baseOpenSheetStaff = openSheet;
  openSheet = function (view) {
    const result = baseOpenSheetStaff(view);
    hideStaffPopupForCover();
    return result;
  };
  /* 人员工作页被覆盖/返回时，若已不在人员工作中则关闭当天清单浮层。 */
  const baseCloseSheetStaff = closeSheet;
  closeSheet = function () { removeStaffPopup(); return baseCloseSheetStaff(); };
  const baseBackSheetStaff = backSheet;
  backSheet = function () {
    baseBackSheetStaff();
    if (!sheetStack.some(view => view.staffWork)) removeStaffPopup();
    else showStaffPopupIfNeeded();
  };
  RENDER.me = renderMe;
})();
