"use strict";
/* 日程界面：仅投影本人有效负责的正常任务；月模式连续滚动相邻月份，日模式使用纵向 00:00—24:00 日轴。
   全局授权任务集（TASKS / 任务表单）保持独立，日历过滤只在投影层发生。
   封面抽屉与当天清单都是覆盖在日程卡片上的独立层：不重排底层日历，关闭后日期/密度/滚动保持不变。 */
(function () {
  const P = window.Pandora;
  /* 日轴固定 1440px 高：一分钟对应一像素，真实时段不会被点击区改写。 */
  const AXIS_MINUTES = 1440, MIN_HIT_PX = 22;
  const MONTH_MIN_HEIGHT = 100, MONTH_MAX_HEIGHT = 340;
  const MAX_MOUNTED_MONTHS = 12;
  const scheduleScroll = new Map();

  let monthHeight = 220, suppressCalendarClickUntil = 0, dayDisplay = 'timeline', sideOpen = false;
  let monthStream = [], axisEvents = [];
  /* 当天清单：{date, scroll, scrollLeft, trigger, pendingFocus}；null 表示清单关闭。 */
  let daySheet = null, pendingDrawerFocus = false, streamError = null;
  try {
    const saved = Number(localStorage.getItem('pandora.calendar.cardRowHeight'));
    if (saved >= MONTH_MIN_HEIGHT && saved <= MONTH_MAX_HEIGHT) monthHeight = saved;
    else {
      const previous = Number(localStorage.getItem('pandora.calendar.rowHeight'));
      if (previous >= 56 && previous <= 180) monthHeight = 100 + (previous - 56) / 124 * 240;
    }
  } catch (_) {}

  /* ---- 本人投影：日历永不使用下属切换，也不从全局授权集中移除任何任务 ---- */
  function selfId() {
    const me = P.data && P.data.me;
    return (me && me.id) || (typeof actor === 'function' && actor() ? actor().id : null);
  }
  const allNormalTasks = viewTasks;
  viewTasks = function (account) {
    const me = selfId();
    return allNormalTasks(account).filter(function (task) {
      return me != null && (task.assigneeIds || []).indexOf(me) !== -1;
    });
  };

  const previousAction = runAction;
  const previousRender = renderAll;
  const icons = {
    left: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m14 6-6 6 6 6"/></svg>',
    right: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m10 6 6 6-6 6"/></svg>',
    down: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m7 10 5 5 5-5"/></svg>',
    menu: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 6h16M4 12h16M4 18h16"/></svg>',
    plus: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg>'
  };
  function dateKey(d) { return toDateInput(d); }
  function dayLabel(d) { return (d.getMonth() + 1) + '月' + d.getDate() + '日'; }
  function weekday(d) { return WEEK_NAMES[(d.getDay() + 6) % 7]; }
  function monthKey(d) { return d.getFullYear() + '-' + pad2(d.getMonth() + 1); }
  function monthFromKey(key) {
    const match = /^(\d{4})-(\d{2})$/.exec(String(key || ''));
    return match ? new Date(Number(match[1]), Number(match[2]) - 1, 1) : null;
  }
  function monthTitle(d) { return d.getFullYear() + '年' + (d.getMonth() + 1) + '月'; }
  function shiftMonth(d, amount) { return new Date(d.getFullYear(), d.getMonth() + amount, 1); }
  function businessBounds(d) {
    return {start:P.companyDayStart(dateKey(d)),end:P.companyDayStart(dateKey(addDays(d,1)))};
  }
  function calendarRange(task) {
    if(task.allDay){const from=task.raw?.startDate||dateKey(task.start),to=task.raw?.dueDate||dateKey(task.due);
      return {start:P.companyDayStart(from),end:P.companyDayStart(dateKey(addDays(parseDateInput(to),1)))};}
    return {start:new Date(task.raw?.startAt||task.start),end:new Date(task.raw?.dueAt||task.due)};
  }
  function rangeHits(task,start,end) {
    const range=calendarRange(task),from=P.companyDayStart(dateKey(start)),to=P.companyDayStart(dateKey(end));
    return +range.start===+range.end?range.start>=from&&range.start<to:range.end>from&&range.start<to;
  }
  function dayTasks(d) {
    const seen=new Set();return viewTasks(actor()).filter(t=>rangeHits(t,d,addDays(d,1))&&!seen.has(t.id)&&seen.add(t.id));
  }
  function dayLogs(d) {
    const key = dateKey(d), self = selfId();
    return (P.data?.calendarLogs || []).filter(log => log.authorId === self && log.businessDate === key);
  }
  function scheduleText(t,d) {
    if(t.allDay)return '全天';const bounds=businessBounds(d),range=calendarRange(t);
    const time=value=>{const p=P.companyParts(value);return p.hour+':'+p.minute;};
    return (range.start<bounds.start?'前日延续':time(range.start))+' – '+(range.end>=bounds.end?'24:00':time(range.end))+(range.end>bounds.end?' · 跨日':'');
  }
  function sortedDay(d) { return dayListSort(dayTasks(d)); }
  function allDayTasks(d) { return sortedDay(d).filter(t => t.allDay || dayCoverage(t,d)?.fullDay); }
  function monthSortTasks(list) {
    return list.slice().sort((a, b) => {
      const pa = a.pinned ? 1 : 0, pb = b.pinned ? 1 : 0;
      if (pa !== pb) return pb - pa;
      const ta = +a.start, tb = +b.start;
      if (ta !== tb) return ta - tb;
      return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
    });
  }
  function dayListSort(list) {
    return list.slice().sort((a, b) => {
      const pa = a.pinned ? 1 : 0, pb = b.pinned ? 1 : 0;
      if (pa !== pb) return pb - pa;
      const ta = +a.start, tb = +b.start;
      if (ta !== tb) return ta - tb;
      return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
    });
  }
  function taskButton(t, d, kind) {
    return '<button type="button" class="p-agenda-item ' + (kind || '') + '" data-task="' + esc(t.id) + '" style="' + taskColorVars(t) + '">' +
      '<span class="p-agenda-marker" aria-hidden="true"></span><span class="p-agenda-copy"><strong>' + esc(t.title) + '</strong><span>' + esc(scheduleText(t, d)) + '</span>' +
      '<span class="p-agenda-meta">' + statusBadge(t) + urgencyBadge(t.urgency) + '</span></span></button>';
  }
  function dayListHTML(d) {
    const tasks = sortedDay(d);
    return '<section id="p-day-panel" class="p-day-list p-agenda" tabindex="0" aria-label="'+dayLabel(d)+'完整任务清单">' +
      dayListBodyHTML(d) + '</section>';
  }
  /* 当天清单与日视图任务清单共用同一份内容：完整、去重、本人置顶优先。 */
  function dayListBodyHTML(d) {
    const tasks = sortedDay(d);
    return tasks.length ? '<p class="p-day-list-count">共 '+tasks.length+' 项日程</p>'+tasks.map(t => taskButton(t, d)).join('')
      : '<div class="p-calendar-empty"><strong>这一天还没有任务</strong><button type="button" class="p-text-button" data-action="schedule-create" data-date="'+dateKey(d)+'">创建任务</button></div>';
  }

  /* ---- 顶部工具、左侧覆盖抽屉与右下悬浮创建 ---- */
  function toolbar() {
    const d = state.viewAnchor;
    const label = state.viewMode === 'month' ? monthTitle(d) : d.getFullYear() + '年' + (d.getMonth() + 1) + '月';
    return '<header class="p-schedule-header"><div class="p-schedule-toolbar">' +
      '<button type="button" class="p-icon-button p-side-toggle" data-action="schedule-side-toggle" aria-expanded="' + sideOpen + '" aria-controls="p-schedule-side" aria-label="' + (sideOpen ? '收起日历面板' : '展开日历面板') + '">' + icons.menu + '</button>' +
      '<button type="button" class="p-date-button" data-action="schedule-pick-date" aria-label="选择年月，当前' + label + '">' + label + icons.down + '</button>' +
      '<div class="p-schedule-navigation"><button type="button" class="p-icon-button" data-action="schedule-prev" aria-label="上一' + ({month:'月',day:'天'})[state.viewMode] + '">' + icons.left + '</button>' +
      '<button type="button" class="p-today-button" data-action="schedule-today">今天</button><button type="button" class="p-icon-button" data-action="schedule-next" aria-label="下一' + ({month:'月',day:'天'})[state.viewMode] + '">' + icons.right + '</button></div>' +
      '<button type="button" class="p-table-entry" data-action="task-table-open">任务表单</button></div>' +
      (state.viewMode === 'day' ? dayStrip() : '') + '</header>';
  }
  /* 覆盖式抽屉：只占日程卡片左侧约 42%，底层日历尺寸不变，右侧始终保留可见日历。 */
  function drawerHTML() {
    return '<div class="p-schedule-layer" data-layer="drawer"><div class="p-schedule-scrim" data-action="schedule-side-close" aria-hidden="true"></div>' +
      '<aside id="p-schedule-side" class="p-schedule-side p-schedule-drawer" role="dialog" aria-modal="true" aria-label="日历面板">' +
      '<header class="p-drawer-head"><h2>日历</h2>' +
      '<button type="button" class="p-icon-button p-drawer-back" data-action="schedule-side-close" aria-label="返回" title="返回"><span aria-hidden="true">‹</span></button>' +
      '<button type="button" class="p-icon-button p-drawer-close" data-action="schedule-side-close" aria-label="关闭日历面板" title="关闭">✕</button></header>' +
      '<div class="p-drawer-body">' +
      '<div class="p-side-row"><span class="p-side-label">视图</span><div class="p-schedule-modes" role="group" aria-label="日历视图">' +
      [['month','月'],['day','日']].map(([mode,label]) => '<button type="button" data-action="schedule-mode" data-mode="' + mode + '" aria-pressed="' + (state.viewMode === mode) + '">' + label + '</button>').join('') + '</div></div>' +
      '<div class="p-side-row"><span class="p-side-label">我的</span><button type="button" class="p-text-button" data-action="schedule-my-applications">我的申请' + icons.right + '</button></div>' +
      '</div></aside></div>';
  }
  /* 当天清单：从底部覆盖在月历之上的独立层，不改变 state.viewMode。 */
  function daySheetHTML(date) {
    const d = parseDateInput(date);
    if (!d) return '';
    return '<div class="p-schedule-layer" data-layer="day"><div class="p-schedule-scrim" data-action="schedule-day-close" aria-hidden="true"></div>' +
      '<section id="p-day-sheet" class="p-day-sheet" role="dialog" aria-modal="true" aria-labelledby="p-day-sheet-title" tabindex="-1" data-date="' + dateKey(d) + '">' +
      '<div class="p-sheet-handle" data-sheet-handle aria-hidden="true"><span></span></div>' +
      '<header class="p-day-sheet-head"><h2 id="p-day-sheet-title">' + dayLabel(d) + ' <span>' + weekday(d) + '</span></h2>' +
      '<div class="p-day-sheet-tools"><button type="button" class="p-text-button" data-action="schedule-day-view">查看日视图' + icons.right + '</button>' +
      '<button type="button" class="p-icon-button" data-action="schedule-day-close" aria-label="关闭当天任务清单" title="关闭">✕</button></div></header>' +
      '<div class="p-day-sheet-body" id="p-day-sheet-body" tabindex="0" aria-label="' + dayLabel(d) + '完整任务清单">' + dayListBodyHTML(d) + '</div>' +
      '</section></div>';
  }
  function layerHTML() {
    return (sideOpen ? drawerHTML() : '') + (daySheet ? daySheetHTML(daySheet.date) : '');
  }
  function dayStrip() {
    const start = viewRange('week', state.viewAnchor).start, today = startOfDay(new Date());
    return '<div class="p-day-strip" aria-label="本周日期">' + Array.from({length:7}, (_,i) => {
      const d = addDays(start, i), selected = sameDay(d, state.viewAnchor);
      return '<button type="button" class="' + (selected ? 'is-selected ' : '') + (sameDay(d,today) ? 'is-today' : '') + '" data-action="schedule-date" data-date="' + dateKey(d) + '" aria-pressed="' + selected + '" aria-label="' + dayLabel(d) + ' ' + weekday(d) + '"><span>' + weekday(d).slice(-1) + '</span><strong>' + d.getDate() + '</strong></button>';
    }).join('') + '</div>';
  }
  function fabHTML() {
    return '<button type="button" class="p-schedule-fab" data-action="schedule-create" aria-label="创建任务">' + icons.plus + '</button>';
  }

  /* ---- 月视图：相邻月份连续挂载，业务日键稳定 ---- */
  function monthWeek(week, list, capacity = MONTH_ROWS, bounds = null) {
    const allDays = Array.from({length:7}, (_,i) => addDays(week.start,i));
    /* 每个业务日只属于一个月份区块：相邻月份的边界日在这里被裁掉，不重复渲染日内容。 */
    const inMonth = allDays.map(d => !bounds || (+d >= +bounds.start && +d < +bounds.end));
    const days = allDays;
    const occupied = [], segments = [];
    for (const task of monthSortTasks(list)) {
      const cols = days.map((d,i) => inMonth[i] && rangeHits(task,d,addDays(d,1)) ? i : -1).filter(i => i >= 0);
      if (!cols.length) continue;
      const start = cols[0], end = cols[cols.length-1] + 1;
      const mask = ((1 << (end-start))-1) << start;
      let lane = occupied.findIndex(bits => !(bits & mask));
      if (lane < 0) lane = occupied.length;
      occupied[lane] = (occupied[lane] || 0) | mask;
      const range = calendarRange(task);
      segments.push({task,start,end,lane,
        before: range.start < P.companyDayStart(dateKey(days[start])),
        after: range.end > P.companyDayStart(dateKey(addDays(days[end-1], 1)))});
    }
    const shown = segments.filter(s => s.lane < capacity);
    const hidden = days.map((d,col) => segments.filter(s => s.lane >= capacity && s.start <= col && s.end > col).map(s => s.task));
    return {days,shown,hidden,segments};
  }
  function connectedTaskHTML(s, hidden, key) {
    const t=s.task, classes=(s.before?' continues-before':'')+(s.after?' continues-after':'')+(t.status==='done'?' is-done':'');
    const detail='<small class="p-month-event-time">'+esc(t.allDay?'全天':s.before?'延续':fmtTime(t.start))+'</small>';
    return '<button type="button"'+(hidden?' hidden':'')+' class="p-month-event'+classes+'" data-task="'+esc(t.id)+'" data-month-key="'+esc(key)+'" data-start-column="'+s.start+'" data-end-column="'+s.end+'" data-lane="'+s.lane+'" data-span="'+(s.end-s.start)+
      '" style="grid-column:'+(s.start+1)+' / '+(s.end+1)+';grid-row:'+(s.lane+1)+';'+taskColorVars(t)+'" aria-label="'+esc(taskAriaLabel(t,actor()))+'" title="'+esc(t.title+' · '+fmtSchedule(t))+'">'+(t.pinned?'<span class="p-pin" aria-label="已置顶">★</span>':'')+'<span class="p-month-event-title">'+esc(t.title)+'</span>'+detail+'</button>';
  }
  function monthMetrics(height = monthHeight) {
    const track = 52, gap = 5;
    const capacity = Math.max(1, Math.min(8, Math.floor((height - 50 + gap) / (track + gap))));
    return {mode: 'stacked', track, gap, capacity};
  }
  function monthStyle(metrics) {
    return '--month-week-height:'+monthHeight+'px;--month-track-height:'+metrics.track+'px;--month-track-gap:'+metrics.gap+'px;--month-rows:'+Math.max(1,metrics.capacity);
  }
  function monthOverflowButton(tasks, date, column) {
    return '<button type="button" class="p-month-more"'+(tasks.length?'':' hidden')+' data-action="schedule-month-overflow" data-date="'+dateKey(date)+'" data-hidden-count="'+tasks.length+'" style="grid-column:'+(column+1)+'" aria-label="'+dayLabel(date)+'，还有'+tasks.length+'项日程，打开当日任务清单">+'+tasks.length+'</button>';
  }
  function monthSectionHTML(key) {
    const anchor = monthFromKey(key);
    if (!anchor) return '';
    const grid = monthGrid(anchor), today = startOfDay(new Date()), list = viewTasks(actor()), metrics = monthMetrics();
    const bounds = { start: anchor, end: new Date(anchor.getFullYear(), anchor.getMonth() + 1, 1) };
    const weeks = grid.weeks.map(week => {
      const data = monthWeek(week, list, metrics.capacity, bounds);
      const dates = data.days.map((d,col) => {
        if (d.getFullYear() !== anchor.getFullYear() || d.getMonth() !== anchor.getMonth())
          return '<span class="p-month-date is-blank" aria-hidden="true"></span>';
        const selected = sameDay(d,state.viewAnchor), current = sameDay(d,today), other = false;
        const count = data.segments.filter(s=>s.start<=col&&s.end>col).length;
        return '<button type="button" class="p-month-date' + (selected?' is-selected':'') + (current?' is-today':'') + (other?' is-other-month':'') +
          '" data-action="schedule-month-date" data-date="'+dateKey(d)+'" aria-pressed="'+selected+'" aria-label="'+dayLabel(d)+' '+weekday(d)+'，'+(count ? count+'项任务' : '暂无任务')+'，查看日程"><span class="p-month-date-label"><strong>'+d.getDate()+'</strong>'+'</span></button>';
      }).join('');
      const indicators = data.days.map((d,col)=>{
        if (d.getFullYear() !== anchor.getFullYear() || d.getMonth() !== anchor.getMonth()) return '';
        const tasks = data.segments.filter(s=>s.start<=col&&s.end>col).map(s=>s.task);
        if (!tasks.length) return '';
        const colors = Array.from(new Set(tasks.map(taskColorVars)));
        return '<span class="p-month-day-indicator" data-date="'+dateKey(d)+'" data-task-count="'+tasks.length+'" style="grid-column:'+(col+1)+'" aria-hidden="true">'+colors.map(color=>'<i style="'+color+'"></i>').join('')+'</span>';
      }).join('');
      return '<div class="p-month-week" data-week-start="'+dateKey(week.start)+'"><div class="p-month-days">'+dates+'</div><div class="p-month-tracks">'+data.segments.map(s=>connectedTaskHTML(s,s.lane>=metrics.capacity,key)).join('')+'</div><div class="p-month-indicators" aria-hidden="true">'+indicators+'</div><div class="p-month-overflow">'+data.hidden.map((tasks,col)=>monthOverflowButton(tasks,data.days[col],col)).join('')+'</div></div>';
    }).join('');
    return '<section class="p-month-section" data-month-key="'+esc(key)+'" data-month-start="'+dateKey(anchor)+'" aria-label="'+monthTitle(anchor)+'">' +
      '<header class="p-month-section-head"><h2>'+monthTitle(anchor)+'</h2><span class="p-month-section-range">'+esc(dateKey(bounds.start))+' — '+esc(dateKey(addDays(bounds.end,-1)))+'</span></header>' +
      '<div class="p-month-grid" style="--calendar-weeks:'+grid.weeks.length+'" aria-label="'+monthTitle(anchor)+'日历">'+weeks+'</div></section>';
  }
  function streamMonths() {
    const metrics = monthMetrics();
    return monthStream.map(key => monthSectionHTML(key)).join('');
  }
  function buildStream(anchor) {
    const base = new Date(anchor.getFullYear(), anchor.getMonth(), 1);
    monthStream = [-2,-1,0,1,2].map(offset => monthKey(shiftMonth(base, offset)));
    return monthStream;
  }
  function resetStream(anchor) { buildStream(anchor || state.viewAnchor); }
  function monthHTML() {
    const metrics = monthMetrics();
    if (!monthStream.length) resetStream(state.viewAnchor);
    return '<div class="p-month-view" data-density="'+metrics.mode+'" data-row-height="'+monthHeight+'" style="'+monthStyle(metrics)+'">'+
      '<div class="p-month-scroll" tabindex="0" aria-label="月日历，连续上下滚动浏览相邻月份，双指上下拉合调整日程显示"><section class="p-month-layout" aria-label="月日历"><div class="p-weekday-row">'+WEEK_NAMES.map(w=>'<span>'+w.slice(-1)+'</span>').join('')+'</div><div class="p-month-stream">'+streamMonths()+'</div></section></div>'+
      '<div class="p-month-footer"><div class="p-month-resize-handle" role="slider" tabindex="0" aria-label="调整月历日程显示" aria-orientation="vertical" aria-valuemin="0" aria-valuemax="100" aria-valuenow="'+Math.round((monthHeight-MONTH_MIN_HEIGHT)/(MONTH_MAX_HEIGHT-MONTH_MIN_HEIGHT)*100)+'" aria-valuetext="'+metrics.capacity+'条叠放日程" aria-describedby="p-month-resize-help"><span class="p-month-handle-bar" aria-hidden="true"></span><span id="p-month-resize-help">上下拖动展开日程</span></div></div></div>';
  }
  /* 补载一个相邻月份只追加已完整生成的节点：生成失败时 DOM 与月份序列都不变，并给出可重试的边界提示。 */
  function renderSection(key) {
    const render = (P.calendar && P.calendar.monthSection) || monthSectionHTML;
    return render(key);
  }
  function streamBoundaryHTML() {
    if (!streamError) return '';
    const anchor = monthFromKey(streamError.key);
    return '<div class="p-month-stream-error" data-stream-error="' + streamError.direction + '" role="alert">' +
      '<span>' + esc((anchor ? monthTitle(anchor) : '相邻月份') + '加载失败（' + streamError.message + '），当前只显示已加载的月份。') + '</span>' +
      '<button type="button" class="p-text-button" data-action="schedule-stream-retry" data-direction="' + streamError.direction + '">重试</button></div>';
  }
  function paintStreamBoundary() {
    const scroller = document.querySelector('.p-month-scroll');
    const stream = scroller && scroller.querySelector('.p-month-stream');
    if (!stream) return;
    stream.querySelectorAll('.p-month-stream-error').forEach(node => node.remove());
    if (!streamError) return;
    const notice = document.createElement('div');
    notice.innerHTML = streamBoundaryHTML();
    const node = notice.firstElementChild;
    if (streamError.direction === 'down') stream.appendChild(node); else stream.insertBefore(node, stream.firstChild);
  }
  function appendStreamMonth(direction) {
    const scroller = document.querySelector('.p-month-scroll');
    const stream = scroller && scroller.querySelector('.p-month-stream');
    if (!stream || !monthStream.length) return false;
    const first = monthFromKey(monthStream[0]), last = monthFromKey(monthStream[monthStream.length-1]);
    const key = monthKey(shiftMonth(direction === 'down' ? last : first, direction === 'down' ? 1 : -1));
    if (monthStream.includes(key)) return false;
    let node = null;
    try {
      const holder = document.createElement('div');
      holder.innerHTML = renderSection(key);
      node = holder.firstElementChild;
      if (!node) throw new Error('月份内容为空');
      const source = parseDateInput(node.dataset.monthStart || '');
      if (!source || monthKey(source) !== key) throw new Error('月份内容不完整');
    } catch (error) {
      streamError = { direction, key, message: (error && error.message) || '未知错误' };
      paintStreamBoundary();
      return false;
    }
    streamError = null;
    paintStreamBoundary();
    if (direction === 'down') {
      monthStream.push(key);
      stream.appendChild(node);
    } else {
      const height = scroller.scrollHeight;
      monthStream.unshift(key);
      stream.insertBefore(node, stream.firstChild);
      // Prepend keeps the reader in place: the inserted height is added to the scroll offset.
      scroller.scrollTop += scroller.scrollHeight - height;
    }
    trimStream(scroller);
    return true;
  }
  /* 远处月份用等高占位替换：卸载只改变 DOM 体积，不移动可视日期。 */
  function trimStream(scroller) {
    while (monthStream.length > MAX_MOUNTED_MONTHS) {
      const sections = Array.from(scroller.querySelectorAll('.p-month-section'));
      const first = sections[0], last = sections[sections.length-1];
      if (!first || !last) return;
      if (scroller.scrollTop > first.offsetHeight + scroller.clientHeight) {
        const removed = first.offsetHeight;
        monthStream.shift();
        first.remove();
        scroller.scrollTop -= removed;
        continue;
      }
      if (scroller.scrollHeight - scroller.scrollTop - scroller.clientHeight > last.offsetHeight + scroller.clientHeight) {
        monthStream.pop();
        last.remove();
        continue;
      }
      return;
    }
  }
  function mountMonthAround() {
    const scroller = document.querySelector('.p-month-scroll');
    if (!scroller || state.viewMode !== 'month') return;
    if (!streamError || streamError.direction !== 'up') {
      if (scroller.scrollTop < scroller.clientHeight * 0.75) appendStreamMonth('up');
    }
    if (!streamError || streamError.direction !== 'down') {
      if (scroller.scrollHeight - scroller.scrollTop - scroller.clientHeight < scroller.clientHeight * 0.75) appendStreamMonth('down');
    }
  }
  function saveMonthDensity() {
    try { localStorage.setItem('pandora.calendar.cardRowHeight',String(monthHeight)); } catch (_) {}
  }
  function calendarScale(element) {
    return element.offsetHeight ? element.getBoundingClientRect().height/element.offsetHeight || 1 : 1;
  }
  /* 可视日锚点：记录视口顶部所在周与其偏移，任何高度或月份挂载后都回到同一业务日。 */
  function captureMonthAnchor() {
    const scroller = document.querySelector('.p-month-scroll');
    if (!scroller) return null;
    const scale = calendarScale(scroller), top = scroller.getBoundingClientRect().top;
    const week = Array.from(scroller.querySelectorAll('.p-month-week'))
      .find(element => element.getBoundingClientRect().bottom > top + 1);
    if (!week) return null;
    return { key: week.dataset.weekStart, offset: (week.getBoundingClientRect().top - top) / scale };
  }
  function restoreMonthAnchor(anchor) {
    const scroller = document.querySelector('.p-month-scroll');
    if (!scroller || !anchor) return;
    const week = scroller.querySelector('[data-week-start="' + anchor.key + '"]');
    if (!week) return;
    const scale = calendarScale(scroller);
    const top = scroller.getBoundingClientRect().top;
    scroller.scrollTop += (week.getBoundingClientRect().top - top) / scale - anchor.offset;
  }
  function updateMonthHeight(value, anchor, persist) {
    const view = document.querySelector('.p-month-view');
    if (!view || state.viewMode!=='month') return;
    const scroller = view.querySelector('.p-month-scroll');
    const position = anchor || captureMonthAnchor();
    const focused = document.activeElement;
    monthHeight = Math.round(Math.max(MONTH_MIN_HEIGHT,Math.min(MONTH_MAX_HEIGHT,value))*10)/10;
    const metrics = monthMetrics(), percent = Math.round((monthHeight-MONTH_MIN_HEIGHT)/(MONTH_MAX_HEIGHT-MONTH_MIN_HEIGHT)*100);
    view.dataset.density = metrics.mode;
    view.dataset.rowHeight = String(monthHeight);
    view.style.cssText = monthStyle(metrics);
    const handle = view.querySelector('.p-month-resize-handle');
    handle.setAttribute('aria-valuenow',String(percent));
    handle.setAttribute('aria-valuetext',metrics.capacity+'条叠放日程'+'，展开 '+percent+'%');
    view.querySelectorAll('.p-month-week').forEach(week => {
      const events = Array.from(week.querySelectorAll('.p-month-event'));
      events.forEach(event => { event.hidden = Number(event.dataset.lane) >= metrics.capacity; });
      week.querySelectorAll('.p-month-overflow .p-month-more').forEach((button,col) => {
        const count = events.filter(event => event.hidden && Number(event.dataset.startColumn)<=col && Number(event.dataset.endColumn)>col).length;
        button.hidden = !count;
        button.dataset.hiddenCount = String(count);
        button.textContent = '+'+count;
        const date = parseDateInput(button.dataset.date);
        button.setAttribute('aria-label',dayLabel(date)+'，还有'+count+'项日程，打开当日任务清单');
      });
    });
    restoreMonthAnchor(position);
    if (focused && view.contains(focused) && focused.closest('[hidden]')) {
      const week = focused.closest('.p-month-week');
      const dates = week ? Array.from(week.querySelectorAll('.p-month-date')) : [];
      const date = focused.dataset.date ? dates.find(button => button.dataset.date === focused.dataset.date) : dates[Number(focused.dataset.startColumn)];
      (date || handle).focus({preventScroll:true});
    }
    rememberScheduleScroll(scroller);
    if (persist) saveMonthDensity();
  }
  function bindMonthGestures() {
    const view=document.querySelector('.p-month-view');
    if(!view) return;
    const scroller=view.querySelector('.p-month-scroll'),handle=view.querySelector('.p-month-resize-handle');
    let drag=null,pinch=null,pinchLock=false;
    handle.addEventListener('pointerdown',event=>{
      if (!event.isPrimary || (event.pointerType==='mouse'&&event.button!==0)) return;
      event.preventDefault();
      handle.focus({preventScroll:true});
      drag={id:event.pointerId,y:event.clientY,height:monthHeight,scale:calendarScale(handle),anchor:captureMonthAnchor(),moved:false};
      try { handle.setPointerCapture(event.pointerId); } catch (_) { /* synthetic pointer */ }
      view.classList.add('is-adjusting');
    });
    handle.addEventListener('pointermove',event=>{
      if (!drag||drag.id!==event.pointerId) return;
      event.preventDefault();
      const delta=(event.clientY-drag.y)/drag.scale;
      if (Math.abs(delta)>3) drag.moved=true;
      updateMonthHeight(drag.height+delta,drag.anchor,false);
    });
    const endDrag=event=>{
      if (!drag||drag.id!==event.pointerId) return;
      if (drag.moved) suppressCalendarClickUntil=Date.now()+500;
      drag=null;
      view.classList.remove('is-adjusting');
      try { if (handle.hasPointerCapture(event.pointerId)) handle.releasePointerCapture(event.pointerId); } catch (_) {}
      saveMonthDensity();
    };
    handle.addEventListener('pointerup',endDrag);
    handle.addEventListener('pointercancel',endDrag);
    handle.addEventListener('lostpointercapture',endDrag);
    handle.addEventListener('keydown',event=>{
      const changes={ArrowUp:8,ArrowRight:8,ArrowDown:-8,ArrowLeft:-8,PageUp:24,PageDown:-24};
      if (!(event.key in changes)&&event.key!=='Home'&&event.key!=='End') return;
      event.preventDefault();
      const height=event.key==='Home'?MONTH_MIN_HEIGHT:event.key==='End'?MONTH_MAX_HEIGHT:monthHeight+changes[event.key];
      updateMonthHeight(height,null,true);
    });
    scroller.addEventListener('touchstart',event=>{
      if (event.touches.length!==2) return;
      if (event.cancelable) event.preventDefault();
      const a=event.touches[0],b=event.touches[1];
      pinch={ids:[a.identifier,b.identifier],span:Math.abs(a.clientY-b.clientY),height:monthHeight,scale:calendarScale(scroller),anchor:captureMonthAnchor()};
      pinchLock=true;
      suppressCalendarClickUntil=Date.now()+500;
      view.classList.add('is-adjusting');
    },{passive:false});
    scroller.addEventListener('touchmove',event=>{
      if (!pinchLock) return; // 单指保留原生惯性滚动，不抢手势。
      if (event.cancelable) event.preventDefault();
      if (!pinch) return;
      const touches=Array.from(event.touches),a=touches.find(t=>t.identifier===pinch.ids[0]),b=touches.find(t=>t.identifier===pinch.ids[1]);
      if (a&&b) updateMonthHeight(pinch.height+(Math.abs(a.clientY-b.clientY)-pinch.span)/pinch.scale,pinch.anchor,false);
    },{passive:false});
    const endPinch=event=>{
      if (!pinchLock) return;
      if (event.touches.length<2) {
        pinch=null;
        view.classList.remove('is-adjusting');
        saveMonthDensity();
      }
      suppressCalendarClickUntil=Date.now()+500;
      if (!event.touches.length) pinchLock=false;
    };
    scroller.addEventListener('touchend',endPinch);
    scroller.addEventListener('touchcancel',endPinch);
    let frame=0;
    scroller.addEventListener('scroll',()=>{
      rememberScheduleScroll(scroller);
      cancelAnimationFrame(frame);
      frame=requestAnimationFrame(mountMonthAround);
    },{passive:true});
    /* 按住后移动属于滚动/调整手势，随后的点击不打开当天清单。 */
    let origin=null;
    scroller.addEventListener('pointerdown',event=>{
      if (!event.isPrimary) return;
      origin={id:event.pointerId,x:event.clientX,y:event.clientY};
    },{passive:true});
    scroller.addEventListener('pointermove',event=>{
      if (!origin||origin.id!==event.pointerId) return;
      if (!event.buttons) { origin=null; return; }
      if (Math.abs(event.clientX-origin.x)+Math.abs(event.clientY-origin.y)>8) suppressCalendarClickUntil=Date.now()+500;
    },{passive:true});
    const endPointer=event=>{ if (origin&&origin.id===event.pointerId) origin=null; };
    scroller.addEventListener('pointerup',endPointer,{passive:true});
    scroller.addEventListener('pointercancel',endPointer,{passive:true});
  }
  /* 月格几何命中：跨日条按点击位置所在列取日期，不固定开始日；键盘激活按当前选中列。 */
  function monthColumn(week,x) {
    const days=week.querySelector('.p-month-days');
    if(!days)return 0;
    const rect=days.getBoundingClientRect();
    if(!rect.width)return 0;
    return Math.max(0,Math.min(6,Math.floor((x-rect.left)/(rect.width/7))));
  }
  function monthHit(event,week) {
    const bar=event.target.closest('.p-month-event');
    if (bar) {
      const start=Number(bar.dataset.startColumn),end=Number(bar.dataset.endColumn);
      const keyboard=Number(bar.dataset.hitColumn);
      const column=event.detail===0&&Number.isFinite(keyboard)&&keyboard>=start&&keyboard<end
        ? keyboard : Math.max(start,Math.min(end-1,monthColumn(week,event.clientX)));
      const date=addDays(parseDateInput(week.dataset.weekStart),column);
      return {date,trigger:bar};
    }
    const cell=event.target.closest('.p-month-date[data-date]');
    if (cell) return {date:parseDateInput(cell.dataset.date),trigger:cell};
    const column=monthColumn(week,event.clientX);
    const date=addDays(parseDateInput(week.dataset.weekStart),column);
    return {date,trigger:week.querySelector('.p-month-date[data-date="'+dateKey(date)+'"]')||week};
  }
  document.addEventListener('click',event=>{
    const target=event.target;
    if (!target||typeof target.closest!=='function') return;
    const week=target.closest('.p-month-week');
    if (!week) return;
    if (Date.now()<suppressCalendarClickUntil) {
      event.preventDefault();
      event.stopImmediatePropagation();
      return;
    }
    const hit=monthHit(event,week);
    if (!hit||!hit.date) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    openDaySheet(hit.date,hit.trigger);
  },true);
  /* 跨日条的键盘日期选择：左右方向键在同一任务条的覆盖日内移动，回车/空格打开该日清单。 */
  document.addEventListener('keydown',event=>{
    const bar=event.target.closest&&event.target.closest('.p-month-event');
    if (!bar) return;
    if (event.key==='Enter'||event.key===' '||event.key==='Spacebar') {
      event.preventDefault();
      event.stopPropagation();
      if (Date.now()<suppressCalendarClickUntil) return;
      const hit=monthHit({target:bar,detail:0,clientX:0},bar.closest('.p-month-week'));
      if (hit&&hit.date) openDaySheet(hit.date,bar);
      return;
    }
    if (!['ArrowLeft','ArrowRight','Home','End'].includes(event.key)) return;
    const start=Number(bar.dataset.startColumn),end=Number(bar.dataset.endColumn);
    if (!(end>start)) return;
    event.preventDefault();
    const current=Number(bar.dataset.hitColumn);
    let column=Number.isFinite(current)&&current>=start&&current<end?current:start;
    if (event.key==='ArrowLeft') column=Math.max(start,column-1);
    else if (event.key==='ArrowRight') column=Math.min(end-1,column+1);
    else if (event.key==='Home') column=start;
    else column=end-1;
    bar.dataset.hitColumn=String(column);
    const date=addDays(parseDateInput(bar.closest('.p-month-week').dataset.weekStart),column);
    const task=typeof taskById==='function'?taskById(bar.dataset.task):null;
    if (task) bar.setAttribute('aria-label',taskAriaLabel(task,actor())+'，已选择'+dayLabel(date)+'，回车打开当日清单');
    bar.dataset.hitDate=dateKey(date);
  },true);

  /* ---- 日视图：纵向 00:00—24:00 轴，完整重叠分栏 ---- */
  function minuteAt(date,day) {
    const bounds=businessBounds(day);if(date<=bounds.start)return 0;if(date>=bounds.end)return 1440;
    const p=P.companyParts(date);return Number(p.hour)*60+Number(p.minute)+Number(p.second)/60;
  }
  // Projection only: true instants determine whether a positive interval covers the complete company day.
  function dayCoverage(task,d) {
    const bounds=businessBounds(d),range=calendarRange(task),point=+range.start===+range.end;
    if(point){if(range.start<bounds.start||range.start>=bounds.end)return null;const at=minuteAt(range.start,d);return {start:at,end:at,point:true,fullDay:false};}
    if(range.end<=bounds.start||range.start>=bounds.end)return null;
    const fullDay=range.start<=bounds.start&&range.end>=bounds.end;
    return {start:minuteAt(range.start,d),end:minuteAt(range.end,d),point:false,fullDay};
  }
  function dayEvents(d) {
    return dayTasks(d).filter(task=>!task.allDay).map(task=>{const coverage=dayCoverage(task,d);
      return coverage&&!coverage.fullDay?Object.assign({task},coverage):null;}).filter(Boolean);
  }
  /* 命中区可以放大到最小可点高度，但真实时段单独绘制；分栏按放大后的区间分组，
     因此放大永远不会让两个任务互相遮挡。 */
  function layoutDayEvents(events, axisHeight = AXIS_MINUTES) {
    const minimum = Math.min(AXIS_MINUTES, MIN_HIT_PX / Math.max(1, axisHeight) * AXIS_MINUTES);
    const items = events.map(event => {
      const length = Math.max(minimum, event.end - event.start);
      const drawStart = Math.max(0, Math.min(event.start, AXIS_MINUTES - length));
      return Object.assign({}, event, { drawStart, drawEnd: drawStart + length });
    }).sort((a, b) => a.drawStart - b.drawStart || a.start - b.start || b.end - a.end ||
      a.task.id.localeCompare(b.task.id));
    const clusters = [];
    let current = null;
    for (const item of items) {
      if (!current || item.drawStart >= current.end) {
        current = { end: item.drawEnd, items: [] };
        clusters.push(current);
      }
      current.items.push(item);
      current.end = Math.max(current.end, item.drawEnd);
    }
    for (const cluster of clusters) {
      const ends = [];
      for (const item of cluster.items) {
        let lane = ends.findIndex(end => end <= item.drawStart);
        if (lane < 0) lane = ends.length;
        ends[lane] = item.drawEnd;
        item.lane = lane;
      }
      const columns = Math.max(1, ends.length);
      for (const item of cluster.items) item.columns = columns;
    }
    return items;
  }
  function minuteLabel(value) { return pad2(Math.floor(value/60))+':'+pad2(Math.floor(value%60)); }
  function axisEventHTML(event) {
    const task = event.task;
    const time = (event.start===event.end ? minuteLabel(event.start) : minuteLabel(event.start)+' – '+minuteLabel(event.end)) +
      ' · ' + task.title;
    const width = 100 / event.columns;
    const top = event.drawStart;
    const height = event.drawEnd - event.drawStart;
    const trueTop = event.start - event.drawStart;
    const trueHeight = Math.max(2, event.end - event.start);
    return '<button type="button" class="p-axis-event' + (event.start===event.end?' is-point':'') + (event.point ? ' is-point':'') + (task.status==='done'?' is-done':'') +
      '" data-task="' + esc(task.id) + '" data-start-minute="' + event.start + '" data-end-minute="' + event.end +
      '" data-lane="' + event.lane + '" data-columns="' + event.columns + '" style="' + taskColorVars(task) +
      'top:' + top + 'px;height:' + height + 'px;left:' + (event.lane*width) + '%;width:' + width + '%;--axis-true-top:' + trueTop + 'px;--axis-true-height:' + trueHeight + 'px" aria-label="' +
      esc(taskAriaLabel(task,actor())+'，'+minuteLabel(event.start)+(event.start===event.end?'':' 至 '+minuteLabel(event.end)))+'" title="' + esc(task.title+' · '+fmtSchedule(task)) + '">' +
      '<span class="p-axis-true" aria-hidden="true"></span>' + (task.pinned ? '<span class="p-pin" aria-label="已置顶">★</span>' : '') + '<strong>' + esc(task.title) + '</strong><span class="p-axis-event-time">' + esc(event.start===event.end?minuteLabel(event.start):minuteLabel(event.start)+' – '+minuteLabel(event.end)) + '</span></button>';
  }
  function axisHTML(d) {
    axisEvents = layoutDayEvents(dayEvents(d));
    const now = new Date(), current = sameDay(now, d) ? minuteAt(now, startOfDay(d)) : -1;
    const hours = Array.from({length:24}, (_,hour) =>
      '<div class="p-axis-hour" data-hour="' + hour + '" style="top:' + (hour*60) + 'px"><span>' + pad2(hour) + ':00</span></div>').join('');
    const nowLine = current >= 0 ? '<div class="p-axis-now" data-minute="' + current + '" style="top:' + current + 'px" aria-label="当前时间 ' + fmtTime(now) + '"><span></span></div>' : '';
    return '<div class="p-day-axis" role="group" aria-label="00:00 至 24:00 完整时间轴">' + hours +
      '<div class="p-axis-events">' + axisEvents.map(axisEventHTML).join('') + '</div>' + nowLine +
      '<span class="p-axis-end" aria-hidden="true">24:00</span></div>';
  }
  function allDayHTML(d) {
    const tasks = allDayTasks(d);
    if (!tasks.length) return '<span class="p-all-day-empty">—</span>';
    return '<div class="p-allday-list">' + tasks.map(t =>
      '<button type="button" class="p-all-day-event" data-task="' + esc(t.id) + '" style="' + taskColorVars(t) + '" aria-label="' + esc(taskAriaLabel(t,actor())) + '">' + esc(t.title) + '</button>').join('') + '</div>';
  }
  function dayHTML() {
    const d = state.viewAnchor;
    const heading = '<header class="p-day-view-heading"><h2 tabindex="-1">' + dayLabel(d) + ' <span>' + weekday(d) + '</span></h2><div class="p-day-display-modes" role="group" aria-label="当日日程显示方式">' +
      [['timeline','时间轴'],['list','任务清单']].map(([mode,label]) => '<button type="button" data-action="schedule-day-mode" data-day-mode="' + mode + '" aria-pressed="' + (dayDisplay===mode) + '" aria-controls="p-day-panel">' + label + '</button>').join('') + '</div></header>';
    const panel = dayDisplay==='list' ? dayListHTML(d) : '<section id="p-day-panel" class="p-time-panel" aria-label="'+dayLabel(d)+'日程时间轴">' +
      '<div class="p-day-allday"><span class="p-allday-label">全天</span><div class="p-allday-scroll">' + allDayHTML(d) + '</div></div>' +
      '<div class="p-timeline-scroll" tabindex="0" aria-label="00:00 至 24:00 纵向时间轴，可上下滚动浏览全天">' + axisHTML(d) + '</div></section>';
    return '<div class="p-day-layout" data-day-mode="' + dayDisplay + '">' + heading + panel + '</div>';
  }
  function normalizeViewMode() {
    if (state.viewMode!=='month' && state.viewMode!=='day') state.viewMode='month';
  }
  function scrollKey(mode=state.viewMode, date=state.viewAnchor, display=dayDisplay) {
    return state.actorId + ':' + mode + (mode==='day'?':'+display:'') + ':' + dateKey(viewRange(mode,date).start);
  }
  function rememberScheduleScroll(scroller) {
    if (!scroller || !scroller.isConnected || !scroller.clientHeight || !scroller.dataset.scheduleScrollKey) return;
    scheduleScroll.set(scroller.dataset.scheduleScrollKey,{top:scroller.scrollTop,left:scroller.scrollLeft});
    if (scheduleScroll.size>60) scheduleScroll.delete(scheduleScroll.keys().next().value);
  }
  function restoreScheduleScroll() {
    const scroller = document.querySelector('.p-month-scroll, .p-timeline-scroll, .p-day-list');
    if (!scroller) return;
    scroller.dataset.scheduleScrollKey = scrollKey();
    const saved = scheduleScroll.get(scroller.dataset.scheduleScrollKey);
    if (saved) {
      scroller.scrollTop = saved.top;
      scroller.scrollLeft = saved.left;
    } else if (state.viewMode==='month') {
      const selected = scroller.querySelector('.p-month-date.is-selected');
      const week = selected && selected.closest('.p-month-week');
      if (week) {
        const scale = calendarScale(scroller);
        scroller.scrollTop += (week.getBoundingClientRect().top - scroller.getBoundingClientRect().top) / scale - 40;
      }
    } else if (dayDisplay==='timeline') {
      const now = new Date(), includesToday = sameDay(now, state.viewAnchor);
      const first = dayEvents(state.viewAnchor)[0]?.task;
      const coverage = first ? dayCoverage(first, state.viewAnchor) : null;
      const minute = includesToday ? minuteAt(now, startOfDay(now)) : coverage ? coverage.start : 480;
      scroller.scrollTop = Math.max(0, minute - 60);
    }
    rememberScheduleScroll(scroller);
  }
  /* ---- 覆盖层：抽屉与当天清单共用锁定/焦点/返回语义 ---- */
  function layerNodes() {
    return Array.from(document.querySelectorAll('.p-schedule-layer'));
  }
  function syncLayerLock() {
    const card = document.querySelector('.p-schedule-card');
    if (!card) return;
    const locked = sideOpen || !!daySheet;
    ['.p-schedule-toolbar', '.p-schedule-content', '.p-schedule-fab'].forEach(selector => {
      const element = card.querySelector(selector);
      if (!element) return;
      if (locked) element.setAttribute('inert', ''); else element.removeAttribute('inert');
    });
  }
  function focusables(container) {
    return Array.from(container.querySelectorAll('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'))
      .filter(element => !element.disabled && element.offsetParent !== null && !element.closest('[hidden]'));
  }
  function trapTab(event, container) {
    const items = focusables(container);
    if (!items.length) { event.preventDefault(); return; }
    const first = items[0], last = items[items.length - 1], active = document.activeElement;
    if (event.shiftKey) {
      if (active === first || !container.contains(active)) { event.preventDefault(); last.focus(); }
    } else if (active === last || !container.contains(active)) { event.preventDefault(); first.focus(); }
  }
  function focusLayerPrimary() {
    if (daySheet) { const sheet = document.getElementById('p-day-sheet'); if (sheet) sheet.focus({preventScroll:true}); return; }
    const drawer = document.getElementById('p-schedule-side');
    const target = drawer && (drawer.querySelector('[data-action="schedule-side-close"]') || focusables(drawer)[0]);
    if (target) target.focus({preventScroll:true});
  }
  /* 全量重绘会替换覆盖层节点：记住层内焦点，重绘后落在同一控件上，不停留在已隐藏内容。 */
  function captureLayerFocus() {
    const card = document.querySelector('.p-schedule-card');
    const active = document.activeElement;
    if (!card || !active || !card.contains(active)) return null;
    const layer = active.closest('.p-schedule-layer');
    if (!layer) return null;
    return { layer: layer.dataset.layer, action: active.dataset.action || null, mode: active.dataset.mode || null,
      date: active.dataset.date || null, task: active.dataset.task || null };
  }
  function restoreLayerFocus(focus) {
    const layer = document.querySelector('.p-schedule-layer[data-layer="' + focus.layer + '"]');
    if (!layer) return;
    let next = focus.task ? layer.querySelector('[data-task="' + focus.task + '"]') : null;
    if (!next && focus.action) {
      next = Array.from(layer.querySelectorAll('[data-action="' + focus.action + '"]')).find(element =>
        (!focus.mode || element.dataset.mode === focus.mode) && (!focus.date || element.dataset.date === focus.date)) || null;
    }
    if (!next) next = layer.querySelector('button, [tabindex]');
    if (next) next.focus({preventScroll:true});
  }
  function bindLayer() {
    layerNodes().forEach(layer => {
      if (layer.dataset.bound === '1') return;
      layer.dataset.bound = '1';
      const scrim = layer.querySelector('.p-schedule-scrim');
      if (scrim) {
        // 遮罩吞掉滚轮与触摸滚动：底层日历既不能被点到，也不能被滚动带走。
        scrim.addEventListener('wheel', event => event.preventDefault(), { passive: false });
        scrim.addEventListener('touchmove', event => { if (event.cancelable) event.preventDefault(); }, { passive: false });
      }
      if (layer.dataset.layer === 'day') bindSheetGestures(layer);
    });
  }
  function openDrawer() {
    if (sideOpen) return;
    sideOpen = true; pendingDrawerFocus = true;
    updateView();
    pendingDrawerFocus = false;
    focusLayerPrimary();
  }
  function closeDrawer() {
    if (!sideOpen) return;
    sideOpen = false;
    updateView();
    document.querySelector('[data-action="schedule-side-toggle"]')?.focus({preventScroll:true});
  }
  function openDaySheet(value, trigger) {
    const d = value instanceof Date ? value : parseDateInput(value);
    if (!d) return;
    const scroller = document.querySelector('.p-month-scroll');
    const focusTarget = trigger && trigger.isConnected ? trigger
      : scroller ? scroller.querySelector('.p-month-date[data-date="' + dateKey(d) + '"]') : null;
    daySheet = { date: dateKey(d), scroll: scroller ? scroller.scrollTop : 0, scrollLeft: scroller ? scroller.scrollLeft : 0,
      trigger: focusTarget || scroller || null, pendingFocus: true };
    ensureDaySheetDom();
  }
  function ensureDaySheetDom() {
    const card = document.querySelector('.p-schedule-card');
    if (!card) return;
    const existing = card.querySelector('.p-schedule-layer[data-layer="day"]');
    if (existing) existing.remove();
    if (daySheet) card.insertAdjacentHTML('beforeend', daySheetHTML(daySheet.date));
    syncLayerLock();
    bindLayer();
    if (daySheet && daySheet.pendingFocus) {
      daySheet.pendingFocus = false;
      document.getElementById('p-day-sheet')?.focus({preventScroll:true});
    }
  }
  function closeDaySheet() {
    if (!daySheet) return;
    const previous = daySheet; daySheet = null;
    document.querySelector('.p-schedule-layer[data-layer="day"]')?.remove();
    syncLayerLock();
    const scroller = document.querySelector('.p-month-scroll');
    if (scroller) {
      scroller.scrollTop = previous.scroll;
      scroller.scrollLeft = previous.scrollLeft;
      rememberScheduleScroll(scroller);
    }
    const target = previous.trigger && previous.trigger.isConnected ? previous.trigger : scroller;
    if (target && target.focus) target.focus({preventScroll:true});
  }
  /* 手势：顶部手柄下拖，或正文已在顶部继续下拉，都可关闭；普通滚动与取消手势不关闭。 */
  function bindSheetGestures(layer) {
    const sheet = layer.querySelector('.p-day-sheet');
    const handle = layer.querySelector('[data-sheet-handle]');
    const body = layer.querySelector('.p-day-sheet-body');
    if (!sheet || !handle || !body) return;
    const threshold = () => Math.max(64, Math.min(160, sheet.offsetHeight * 0.28));
    let drag = null;
    handle.addEventListener('pointerdown', event => {
      if (!event.isPrimary || (event.pointerType === 'mouse' && event.button !== 0)) return;
      event.preventDefault();
      drag = { id: event.pointerId, y: event.clientY, moved: 0 };
      try { handle.setPointerCapture(event.pointerId); } catch (_) { /* synthetic pointer */ }
      sheet.classList.add('is-dragging');
    });
    handle.addEventListener('pointermove', event => {
      if (!drag || drag.id !== event.pointerId) return;
      event.preventDefault();
      drag.moved = Math.max(0, event.clientY - drag.y);
      sheet.style.transform = 'translateY(' + drag.moved + 'px)';
    });
    const finishDrag = event => {
      if (!drag || drag.id !== event.pointerId) return;
      const moved = drag.moved, cancelled = event.type === 'pointercancel';
      drag = null;
      sheet.classList.remove('is-dragging');
      sheet.style.transform = '';
      try { if (handle.hasPointerCapture(event.pointerId)) handle.releasePointerCapture(event.pointerId); } catch (_) {}
      if (!cancelled && moved >= threshold()) closeDaySheet();
    };
    handle.addEventListener('pointerup', finishDrag);
    handle.addEventListener('pointercancel', finishDrag);
    handle.addEventListener('lostpointercapture', finishDrag);
    handle.addEventListener('touchstart', event => {
      // 多指出现即放弃本次拖动，恢复位置且不关闭。
      if (event.touches.length > 1 && drag) { drag = null; sheet.classList.remove('is-dragging'); sheet.style.transform = ''; }
    }, { passive: true });
    let pull = null;
    const resetPull = () => { pull = null; sheet.classList.remove('is-dragging'); sheet.style.transform = ''; };
    body.addEventListener('touchstart', event => {
      if (event.touches.length !== 1) { pull = null; return; }
      pull = { y: event.touches[0].clientY, moved: 0, active: false };
    }, { passive: true });
    body.addEventListener('touchmove', event => {
      if (!pull) return;
      if (event.touches.length !== 1) { resetPull(); return; }
      const delta = event.touches[0].clientY - pull.y;
      if (!pull.active) {
        // 只有正文已经在顶部并继续向下拉时接管；其他方向留给原生滚动。
        if (body.scrollTop > 0 || delta <= 0) { pull = null; return; }
        if (delta <= 8) return;
        pull.active = true;
        sheet.classList.add('is-dragging');
      }
      pull.moved = delta;
      if (event.cancelable) event.preventDefault();
      sheet.style.transform = 'translateY(' + Math.max(0, delta) + 'px)';
    }, { passive: false });
    body.addEventListener('touchend', () => {
      if (!pull) return;
      const moved = pull.moved, active = pull.active;
      resetPull();
      if (active && moved >= threshold()) closeDaySheet();
    });
    body.addEventListener('touchcancel', resetPull);
  }

  function renderSchedule() {
    normalizeViewMode();
    if (!monthStream.length) resetStream(state.viewAnchor);
    if (typeof resetOverflowGroups === 'function') resetOverflowGroups();
    const focus = captureLayerFocus();
    const main = document.getElementById('appMain'); main.classList.add('is-schedule');
    document.getElementById('page-view').innerHTML = '<section class="card p-schedule-card">' + toolbar() +
      '<div class="p-schedule-content p-mode-' + state.viewMode + '">' + (state.viewMode==='month' ? monthHTML() : dayHTML()) + '</div>' + fabHTML() + layerHTML() + '</section>';
    requestAnimationFrame(() => {
      if (state.page === 'view' && state.viewPage !== 'table') restoreScheduleScroll();
    });
    if (state.viewMode==='month') { bindMonthGestures(); paintStreamBoundary(); }
    syncLayerLock();
    bindLayer();
    if (focus) restoreLayerFocus(focus);
    if (pendingDrawerFocus) { pendingDrawerFocus = false; focusLayerPrimary(); }
  }
  renderView = renderSchedule; RENDER.view = renderSchedule;
  renderAll = function () {
    const page = document.getElementById('page-view');
    if (page.classList.contains('is-active')) rememberScheduleScroll(page.querySelector('.p-month-scroll, .p-timeline-scroll, .p-day-list'));
    const schedule = P.ready && state.page==='view' && state.viewPage!=='table';
    document.querySelector('.phone').classList.toggle('is-schedule', schedule);
    document.getElementById('appMain').classList.toggle('is-schedule', schedule);
    previousRender();
    // 任何全量重绘都会扔掉覆盖层节点；状态仍是打开时按最新数据重新挂载，避免停留在半旧清单。
    syncLayerLock();
    bindLayer();
  };
  function updateView() { state.pickerOpen=false; renderAll(); }
  /* 离开日程页时收起覆盖层：不把抽屉/清单的状态带到工作台或日志页。 */
  const previousSetPage = setPage;
  setPage = function (page) {
    if (page !== 'view' && (sideOpen || daySheet)) { sideOpen = false; daySheet = null; pendingDrawerFocus = false; }
    previousSetPage(page);
  };
  function jumpToMonth(date) {
    resetStream(date);
    updateView();
  }
  function shift(direction) {
    const d = state.viewAnchor;
    if (state.viewMode==='month') {
      const target = new Date(d.getFullYear(), d.getMonth()+direction, 1), last = new Date(target.getFullYear(), target.getMonth()+1, 0).getDate();
      state.viewAnchor = new Date(target.getFullYear(), target.getMonth(), Math.min(d.getDate(), last));
      resetStream(state.viewAnchor);
    } else {
      state.viewAnchor = addDays(d, direction);
      if (!monthStream.includes(monthKey(state.viewAnchor))) resetStream(state.viewAnchor);
    }
    updateView();
  }
  function openDay(value, display) {
    const d = value ? parseDateInput(value) : state.viewAnchor;
    if (!d) return;
    state.viewAnchor = d;
    state.viewMode = 'day';
    dayDisplay = display==='list'?'list':'timeline';
    closeSheet();
    updateView();
    document.querySelector('.p-day-view-heading h2')?.focus({preventScroll:true});
  }
  /* 从某一天创建时，等表单完成异步准备后再写入该业务日；不传日期时保留表单默认值。 */
  function createTask(date) {
    const d = date ? parseDateInput(date) : null;
    const applyDate = function () {
      if (!d || !drafts.task) return;
      drafts.task.startDate = dateKey(d); drafts.task.endDate = dateKey(d);
      drafts.task.startTime = '09:00'; drafts.task.endTime = '18:00';
      replaceTopSheet(taskFormView());
    };
    const pending = openTaskForm('create');
    if (pending && typeof pending.then === 'function') pending.then(applyDate, function () {});
    else applyDate();
  }
  function yearOptions(selected) {
    const now = new Date().getFullYear(), values = [];
    for (let year = now - 5; year <= now + 5; year++) values.push(year);
    if (values.indexOf(selected) === -1) values.push(selected);
    return values.sort((a,b)=>a-b).map(year => '<option value="' + year + '"' + (year===selected?' selected':'') + '>' + year + '年</option>').join('');
  }
  function pickerBody() {
    const d = state.viewAnchor;
    return '<div class="p-ym-picker"><div class="field"><label for="p-schedule-year">年份</label><select id="p-schedule-year">' + yearOptions(d.getFullYear()) + '</select></div>' +
      '<div class="field"><label for="p-schedule-month">月份</label><select id="p-schedule-month">' +
      Array.from({length:12},(_,i)=>'<option value="'+(i+1)+'"'+(d.getMonth()===i?' selected':'')+'>'+(i+1)+'月</option>').join('') + '</select></div></div>' +
      '<div class="field"><label for="p-schedule-date">具体日期（可选）</label><input type="date" id="p-schedule-date" value="' + dateKey(d) + '"><span class="tiny muted">只改年月时定位到该月第一天；也可直接选择某一天。</span></div>' +
      '<div class="callout" id="p-date-error" hidden></div>';
  }
  runAction = function (el) {
    const action = el.dataset.action;
    if (action?.startsWith('schedule-')) normalizeViewMode();
    if (action==='schedule-side-toggle') {
      if (sideOpen) closeDrawer(); else openDrawer();
      return;
    }
    if (action==='schedule-side-close') { closeDrawer(); return; }
    if (action==='schedule-day-close') { closeDaySheet(); return; }
    if (action==='schedule-day-view') {
      const date = daySheet ? daySheet.date : el.dataset.date;
      daySheet = null;
      openDay(date,'timeline');
      return;
    }
    if (action==='schedule-stream-retry') {
      const direction = el.dataset.direction==='up'?'up':'down';
      streamError = null;
      paintStreamBoundary();
      appendStreamMonth(direction);
      return;
    }
    if (action==='schedule-my-applications') { if (P.openMyApplications) P.openMyApplications(); else P.openApprovals('applicant'); return; }
    if (action==='schedule-month-overflow') { openDaySheet(el.dataset.date,el); return; }
    if (action==='schedule-mode') {
      const focused = document.activeElement === el;
      const next = el.dataset.mode==='day'?'day':'month';
      if (next === 'month' && !monthStream.includes(monthKey(state.viewAnchor))) resetStream(state.viewAnchor);
      state.viewMode = next;
      updateView();
      if (focused) document.querySelector('[data-action="schedule-mode"][data-mode="'+state.viewMode+'"]')?.focus({preventScroll:true});
      return;
    }
    if (action==='schedule-day-mode') {
      const focused = document.activeElement === el;
      dayDisplay = el.dataset.dayMode==='list'?'list':'timeline';
      state.viewMode = 'day';
      updateView();
      if (focused) document.querySelector('[data-action="schedule-day-mode"][data-day-mode="'+dayDisplay+'"]')?.focus({preventScroll:true});
      return;
    }
    if (action==='schedule-prev'||action==='schedule-next') {
      const focused = document.activeElement === el;
      shift(action==='schedule-prev'?-1:1);
      if (focused) document.querySelector('[data-action="'+action+'"]')?.focus({preventScroll:true});
      return;
    }
    if (action==='schedule-today') {
      const focused = document.activeElement === el;
      const scroller = document.querySelector('.p-month-scroll, .p-timeline-scroll, .p-day-list');
      rememberScheduleScroll(scroller);
      if (scroller) delete scroller.dataset.scheduleScrollKey;
      state.viewAnchor = startOfDay(new Date());
      resetStream(state.viewAnchor);
      scheduleScroll.delete(scrollKey());
      if (state.viewMode==='day') {
        scheduleScroll.delete(scrollKey('day',state.viewAnchor,'timeline'));
        scheduleScroll.delete(scrollKey('day',state.viewAnchor,'list'));
      }
      updateView();
      if (focused) document.querySelector('[data-action="schedule-today"]')?.focus({preventScroll:true});
      return;
    }
    if (action==='schedule-month-date'||action==='schedule-open-day') { openDaySheet(el.dataset.date,el); return; }
    if (action==='schedule-date') {
      const focused = document.activeElement === el, d = parseDateInput(el.dataset.date);
      if (d) {
        state.viewAnchor = d; state.viewMode = 'day'; updateView();
        if (focused) document.querySelector('[data-action="schedule-date"][data-date="'+dateKey(d)+'"]')?.focus({preventScroll:true});
      }
      return;
    }
    if (action==='schedule-day-list') { openDaySheet(el.dataset.date,el); return; }
    if (action==='schedule-create') { createTask(el.dataset.date); return; }
    if (action==='schedule-pick-date') {
      openSheet({title:'跳转年月',body:pickerBody(),foot:'<button type="button" class="btn primary" data-action="schedule-confirm-date">确定</button>'});
      return;
    }
    if (action==='schedule-confirm-date') {
      const year = Number(document.getElementById('p-schedule-year')?.value);
      const month = Number(document.getElementById('p-schedule-month')?.value);
      const raw = document.getElementById('p-schedule-date')?.value || '';
      let target = parseDateInput(raw);
      if (!target) {
        if (!year || !month) { showError('p-date-error','请选择有效的年月。'); return; }
        target = new Date(year, month-1, 1);
      }
      state.viewAnchor = target;
      resetStream(target);
      closeSheet();
      updateView();
      return;
    }
    previousAction(el);
  };
  P.sessionReset.push(function () {
    scheduleScroll.clear(); monthStream = []; axisEvents = []; dayDisplay = 'timeline'; sideOpen = false;
    daySheet = null; pendingDrawerFocus = false; streamError = null;
    document.querySelectorAll('.p-schedule-layer').forEach(node => node.remove());
    document.querySelectorAll('.p-schedule-card [inert]').forEach(node => node.removeAttribute('inert'));
  });
  document.addEventListener('keydown', function (event) {
    // 底层详情弹层打开时由共享弹层处理 Esc/返回，这里只处理日程自己的覆盖层。
    const overlay = document.getElementById('overlay');
    if (overlay && !overlay.hidden) return;
    const page = document.getElementById('page-view');
    if (!page || !page.classList.contains('is-active')) return;
    const sheet = document.querySelector('.p-schedule-layer[data-layer="day"] .p-day-sheet');
    const drawer = document.querySelector('.p-schedule-layer[data-layer="drawer"] .p-schedule-drawer');
    const container = sheet || drawer;
    if (!container) return;
    if (event.key === 'Escape') {
      event.preventDefault();
      if (sheet) closeDaySheet(); else closeDrawer();
      return;
    }
    if (event.key === 'Tab') trapTab(event, container);
  }, true);
  P.calendar = { dayTasks, dayLogs, dayEvents, dayCoverage, layoutDayEvents, monthWeek, monthSortTasks, dayListSort,
    sortedDay, allDayTasks, monthMetrics, monthKey, monthFromKey, shiftMonth, monthSection: monthSectionHTML,
    openDaySheet, closeDaySheet, appendStreamMonth, mountMonthAround,
    currentDaySheet: () => (daySheet ? { date: daySheet.date } : null),
    drawerOpen: () => sideOpen,
    suppression: () => ({ until: suppressCalendarClickUntil, now: Date.now() }),
    currentStream: () => monthStream.slice(), resetStream: anchor => { resetStream(anchor); return monthStream.slice(); },
    restoreStream: keys => { monthStream = Array.isArray(keys) && keys.length ? keys.slice() : monthStream; } };
})();
