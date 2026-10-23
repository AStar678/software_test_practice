"use strict";
/* 日程界面沿用后端有效任务与原任务弹层；日期选择只影响当前视图。 */
(function () {
  const P = window.Pandora;
  const BAND_MINUTES = 480, EVENT_HIT_WIDTH = 64, EVENT_LANE_HEIGHT = 52, VISIBLE_LANES = 5;
  const MONTH_ROWS = 5;
  const scheduleScroll = new Map();
  const MONTH_MIN_HEIGHT = 100, MONTH_MAX_HEIGHT = 340;

  let monthHeight = 220, suppressCalendarClickUntil = 0, dayDisplay = 'timeline';
  let timelineBands = [], timelineObserver = null, timelineFrame = 0, scheduleFrame = 0;
  try {
    const saved = Number(localStorage.getItem('pandora.calendar.cardRowHeight'));
    if (saved >= MONTH_MIN_HEIGHT && saved <= MONTH_MAX_HEIGHT) monthHeight = saved;
    else {
      const previous = Number(localStorage.getItem('pandora.calendar.rowHeight'));
      if (previous >= 56 && previous <= 180) monthHeight = 100 + (previous - 56) / 124 * 240;
    }
  } catch (_) {}
  /* 日历只投影当前选择人员有效负责的正常任务；全局授权数据（TASKS/visibleTasks）保持不变，
     人员选项仅来自本人及服务端返回的下属，任务内容仍使用服务端授权集。 */
  function calendarPeople() {
    const me = P.data?.me || actor();
    return [me, ...(P.data?.reports?.items || [])];
  }
  function calendarPersonId() {
    const people = calendarPeople();
    return people.some(person => person.id === state.calendarPersonId) ? state.calendarPersonId : actor().id;
  }
  const allNormalTasks = viewTasks;
  viewTasks = function (account) {
    return allNormalTasks(account).filter(function (task) {
      return (task.assigneeIds || []).indexOf(calendarPersonId()) !== -1;
    });
  };

  const previousAction = runAction;
  const previousRender = renderAll;
  const icons = {
    left: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m14 6-6 6 6 6"/></svg>',
    right: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m10 6 6 6-6 6"/></svg>',
    down: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m7 10 5 5 5-5"/></svg>',
    plus: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg>'
  };
  function dateKey(d) { return toDateInput(d); }
  function dayLabel(d) { return (d.getMonth() + 1) + '月' + d.getDate() + '日'; }
  function weekday(d) { return WEEK_NAMES[(d.getDay() + 6) % 7]; }
  function rangeHits(task, start, end) {
    const r = taskRange(task), s = r.start.getTime(), e = r.end.getTime();
    return e === s ? s >= +start && s < +end : e > +start && s < +end;
  }
  function dayTasks(d) {
    const start = startOfDay(d), end = addDays(start, 1);
    return viewTasks(actor()).filter(t => rangeHits(t, start, end));
  }
  function dayLogs(d) {
    const key = dateKey(d), self = calendarPersonId();
    return (P.data?.calendarLogs || []).filter(log => log.authorId === self && log.businessDate === key);
  }
  function scheduleText(t, d) {
    if (t.allDay) return '全天';
    const start = startOfDay(d), end = addDays(start, 1);
    const begins = t.start < start ? '前日延续' : fmtTime(t.start);
    const ends = t.due >= end ? '24:00' : fmtTime(t.due);
    return begins + ' – ' + ends + (t.due > end ? ' · 跨日' : '');
  }
  function sortedDay(d) {
    return dayListSort(dayTasks(d));
  }
  function monthSortTasks(list, account) {
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
      // Same rule as the month cell: pinned first, then the real start instant, then the stable id.
      // An all-day task keeps its own 00:00 start, so it no longer jumps ahead of a timed task that
      // began on an earlier day and continues into the selected one.
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
      (tasks.length ? '<p class="p-day-list-count">共 '+tasks.length+' 项日程</p>'+tasks.map(t => taskButton(t, d)).join('') : '<div class="p-calendar-empty"><strong>这一天还没有任务</strong><button type="button" class="p-text-button" data-action="schedule-create" data-date="'+dateKey(d)+'">创建任务</button></div>') + '</section>';
  }
  function calendarPeopleHTML() {
    const people = calendarPeople();
    if (people.length < 2) return '';
    return '<div class="p-calendar-person"><label for="calendarPersonSelect">查看日程</label><select id="calendarPersonSelect">' + people.map(person =>
      '<option value="'+esc(person.id)+'"'+(person.id===calendarPersonId()?' selected':'')+'>'+esc(person.id===actor().id ? '我的日程' : person.displayName + (person.departmentName ? ' · '+person.departmentName : ''))+'</option>').join('')+'</select></div>';
  }
  document.addEventListener('change', event => {
    if (event.target.id !== 'calendarPersonSelect' || !P.ready) return;
    if (!calendarPeople().some(person => person.id === event.target.value)) return;
    state.calendarPersonId = event.target.value;
    updateView();
    document.getElementById('calendarPersonSelect')?.focus({preventScroll:true});
  });
  function toolbar() {
    const d = state.viewAnchor;
    const label = d.getFullYear() + '年' + (d.getMonth() + 1) + '月';
    return '<header class="p-schedule-header"><div class="p-schedule-toolbar">' +
      '<button type="button" class="p-date-button" data-action="schedule-pick-date" aria-label="选择日期，当前' + label + '">' + label + icons.down + '</button>' +
      '<div class="p-schedule-navigation"><button type="button" class="p-icon-button" data-action="schedule-prev" aria-label="上一' + ({month:'月',day:'天'})[state.viewMode] + '">' + icons.left + '</button>' +
      '<button type="button" class="p-today-button" data-action="schedule-today">今天</button><button type="button" class="p-icon-button" data-action="schedule-next" aria-label="下一' + ({month:'月',day:'天'})[state.viewMode] + '">' + icons.right + '</button></div>' +
      '<div class="p-schedule-modes" role="group" aria-label="日历视图">' + [['month','月'],['day','日']].map(([mode,label]) =>
      '<button type="button" data-action="schedule-mode" data-mode="' + mode + '" aria-pressed="' + (state.viewMode === mode) + '">' + label + '</button>').join('') + '</div>' +
      '<button type="button" class="btn primary p-schedule-create" data-action="schedule-create" aria-label="创建任务">' + icons.plus + '<span>创建任务</span></button>' +
      '<div class="p-calendar-tools"><button type="button" class="p-text-button" data-action="schedule-my-applications">我的申请'+icons.right+'</button></div></div>' +
      calendarPeopleHTML() + (state.viewMode === 'day' ? dayStrip() : '') + '</header>';
  }
  function dayStrip() {
    const start = viewRange('week', state.viewAnchor).start, today = startOfDay(new Date());
    return '<div class="p-day-strip" aria-label="本周日期">' + Array.from({length:7}, (_,i) => {
      const d = addDays(start, i), selected = sameDay(d, state.viewAnchor);
      return '<button type="button" class="' + (selected ? 'is-selected ' : '') + (sameDay(d,today) ? 'is-today' : '') + '" data-action="schedule-date" data-date="' + dateKey(d) + '" aria-pressed="' + selected + '" aria-label="' + dayLabel(d) + ' ' + weekday(d) + '"><span>' + weekday(d).slice(-1) + '</span><strong>' + d.getDate() + '</strong></button>';
    }).join('') + '</div>';
  }
  /* Each task remains one continuous strip per week. Hidden counts come from
     the strips actually shown in each date, including any lane gaps. */
  function monthWeek(week, list, capacity = MONTH_ROWS) {
    const days = Array.from({length:7}, (_,i) => addDays(week.start,i));
    const occupied = [], segments = [];
    for (const task of monthSortTasks(list, actor())) {
      const cols = days.map((d,i) => rangeHits(task,d,addDays(d,1)) ? i : -1).filter(i => i >= 0);
      if (!cols.length) continue;
      const start = cols[0], end = cols[cols.length-1] + 1;
      const mask = ((1 << (end-start))-1) << start;
      let lane = occupied.findIndex(bits => !(bits & mask));
      if (lane < 0) lane = occupied.length;
      occupied[lane] = (occupied[lane] || 0) | mask;
      segments.push({task,start,end,lane,
        before:rangeHits(task,addDays(week.start,-1),week.start),
        after:rangeHits(task,week.end,addDays(week.end,1))});
    }
    const shown = segments.filter(s => s.lane < capacity);
    const hidden = days.map((d,col) => segments.filter(s => s.lane >= capacity && s.start <= col && s.end > col).map(s => s.task));
    return {days,shown,hidden,segments};
  }
  function connectedTaskHTML(s, hidden) {
    const t=s.task, classes=(s.before?' continues-before':'')+(s.after?' continues-after':'')+(t.status==='done'?' is-done':'');
    const detail='<small class="p-month-event-time">'+esc(t.allDay?'全天':s.before?'延续':fmtTime(t.start))+'</small>';
    return '<button type="button"'+(hidden?' hidden':'')+' class="p-month-event'+classes+'" data-task="'+esc(t.id)+'" data-start-column="'+s.start+'" data-end-column="'+s.end+'" data-lane="'+s.lane+'" data-span="'+(s.end-s.start)+
      '" style="grid-column:'+(s.start+1)+' / '+(s.end+1)+';grid-row:'+(s.lane+1)+';'+taskColorVars(t)+'" aria-label="'+esc(taskAriaLabel(t,actor()))+'" title="'+esc(t.title+' · '+fmtSchedule(t))+'"><span class="p-month-event-title">'+esc(t.title)+'</span>'+detail+'</button>';
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
  function monthHTML() {
    const grid = monthGrid(state.viewAnchor), today = startOfDay(new Date()), list = viewTasks(actor()), metrics=monthMetrics();
    const weeks = grid.weeks.map(week => {
      const data=monthWeek(week,list,metrics.capacity);
      const dates = data.days.map((d,col) => {
        const selected = sameDay(d,state.viewAnchor), current = sameDay(d,today), other = d.getMonth() !== state.viewAnchor.getMonth();
        const count = data.segments.filter(s=>s.start<=col&&s.end>col).length;
        return '<button type="button" class="p-month-date' + (selected?' is-selected':'') + (current?' is-today':'') + (other?' is-other-month':'') +
          '" data-action="schedule-month-date" data-date="'+dateKey(d)+'" aria-pressed="'+selected+'" aria-label="'+dayLabel(d)+' '+weekday(d)+'，'+(count ? count+'项任务' : '暂无任务')+'，查看日程"><span class="p-month-date-label"><strong>'+d.getDate()+'</strong>'+'</span></button>';
      }).join('');
      const indicators=data.days.map((d,col)=>{
        const tasks=data.segments.filter(s=>s.start<=col&&s.end>col).map(s=>s.task);
        if (!tasks.length) return '';
        const colors=Array.from(new Set(tasks.map(taskColorVars)));
        return '<span class="p-month-day-indicator" data-date="'+dateKey(d)+'" data-task-count="'+tasks.length+'" style="grid-column:'+(col+1)+'" aria-hidden="true">'+colors.map(color=>'<i style="'+color+'"></i>').join('')+'</span>';
      }).join('');
      return '<div class="p-month-week" data-week-start="'+dateKey(week.start)+'"><div class="p-month-days">'+dates+'</div><div class="p-month-tracks">'+data.segments.map(s=>connectedTaskHTML(s,s.lane>=metrics.capacity)).join('')+'</div><div class="p-month-indicators" aria-hidden="true">'+indicators+'</div><div class="p-month-overflow">'+data.hidden.map((tasks,col)=>monthOverflowButton(tasks,data.days[col],col)).join('')+'</div></div>';
    }).join('');
    return '<div class="p-month-view" data-density="'+metrics.mode+'" data-row-height="'+monthHeight+'" style="'+monthStyle(metrics)+'">'+
      '<div class="p-month-scroll" tabindex="0" aria-label="月日历，上下滚动浏览日期，双指上下拉合调整日程显示"><section class="p-month-layout" aria-label="月日历"><div class="p-weekday-row">'+WEEK_NAMES.map(w=>'<span>'+w.slice(-1)+'</span>').join('')+'</div><div class="p-month-grid" style="--calendar-weeks:'+grid.weeks.length+'" aria-label="完整月日历">'+weeks+'</div></section></div>'+
      '<div class="p-month-footer"><div class="p-month-resize-handle" role="slider" tabindex="0" aria-label="调整月历日程显示" aria-orientation="vertical" aria-valuemin="0" aria-valuemax="100" aria-valuenow="'+Math.round((monthHeight-MONTH_MIN_HEIGHT)/(MONTH_MAX_HEIGHT-MONTH_MIN_HEIGHT)*100)+'" aria-valuetext="'+metrics.capacity+'条叠放日程'+'" aria-describedby="p-month-resize-help"><span class="p-month-handle-bar" aria-hidden="true"></span><span id="p-month-resize-help">上下拖动展开日程</span></div></div></div>';
  }
  function saveMonthDensity() {
    try { localStorage.setItem('pandora.calendar.cardRowHeight',String(monthHeight)); } catch (_) {}
  }
  function calendarScale(element) {
    // Coordinates and bounds are both local to this document, including in a scaled iframe.
    return element.offsetHeight ? element.getBoundingClientRect().height/element.offsetHeight || 1 : 1;
  }
  function monthScrollAnchor(scroller, clientY) {
    const grid=scroller.querySelector('.p-month-grid'), bounds=scroller.getBoundingClientRect(), scale=calendarScale(scroller);
    const gridTop=(grid.getBoundingClientRect().top-bounds.top)/scale+scroller.scrollTop;
    const y=clientY===undefined?scroller.querySelector('.p-weekday-row').offsetHeight+2:(clientY-bounds.top)/scale;
    const viewportY=Math.max(0,Math.min(scroller.clientHeight,y));
    return {gridTop,viewportY,weekPosition:(scroller.scrollTop+viewportY-gridTop)/monthHeight};
  }
  function updateMonthHeight(value, anchor, persist) {
    const view=document.querySelector('.p-month-view');
    if (!view || state.viewMode!=='month') return;
    const scroller=view.querySelector('.p-month-scroll'), position=anchor||monthScrollAnchor(scroller);
    const focused=document.activeElement;
    monthHeight=Math.round(Math.max(MONTH_MIN_HEIGHT,Math.min(MONTH_MAX_HEIGHT,value))*10)/10;
    const metrics=monthMetrics(), percent=Math.round((monthHeight-MONTH_MIN_HEIGHT)/(MONTH_MAX_HEIGHT-MONTH_MIN_HEIGHT)*100);
    view.dataset.density=metrics.mode;
    view.dataset.rowHeight=String(monthHeight);
    view.style.cssText=monthStyle(metrics);
    view.querySelectorAll('[data-action="schedule-density"]').forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.density===metrics.mode)));
    const handle=view.querySelector('.p-month-resize-handle');
    handle.setAttribute('aria-valuenow',String(percent));
    handle.setAttribute('aria-valuetext',metrics.capacity+'条叠放日程'+'，展开 '+percent+'%');
    view.querySelectorAll('.p-month-week').forEach(week=>{
      const events=Array.from(week.querySelectorAll('.p-month-event'));
      events.forEach(event=>{event.hidden=Number(event.dataset.lane)>=metrics.capacity;});
      week.querySelectorAll('.p-month-overflow .p-month-more').forEach((button,col)=>{
        const count=events.filter(event=>event.hidden&&Number(event.dataset.startColumn)<=col&&Number(event.dataset.endColumn)>col).length;
        button.hidden=!count;
        button.dataset.hiddenCount=String(count);
        button.textContent='+'+count;
        const date=parseDateInput(button.dataset.date);
        button.setAttribute('aria-label',dayLabel(date)+'，还有'+count+'项日程，打开当日任务清单');
      });
    });
    scroller.scrollTop=position.gridTop+position.weekPosition*monthHeight-position.viewportY;
    if (focused && view.contains(focused) && focused.closest('[hidden]')) {
      const week=focused.closest('.p-month-week');
      const dates=week?Array.from(week.querySelectorAll('.p-month-date')):[];
      const date=focused.dataset.date?dates.find(button=>button.dataset.date===focused.dataset.date):dates[Number(focused.dataset.startColumn)];
      (date||handle).focus({preventScroll:true});
    }
    rememberScheduleScroll(scroller);
    if (persist) saveMonthDensity();
  }
  function bindMonthGestures() {
    const view=document.querySelector('.p-month-view');
    if (!view) return;
    const scroller=view.querySelector('.p-month-scroll'),handle=view.querySelector('.p-month-resize-handle');
    let drag=null,pinch=null,pinchLock=false;
    handle.addEventListener('pointerdown',event=>{
      if (!event.isPrimary || (event.pointerType==='mouse'&&event.button!==0)) return;
      event.preventDefault();
      handle.focus({preventScroll:true});
      drag={id:event.pointerId,y:event.clientY,height:monthHeight,scale:calendarScale(handle),anchor:monthScrollAnchor(scroller),moved:false};
      handle.setPointerCapture(event.pointerId);
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
      if (handle.hasPointerCapture(event.pointerId)) handle.releasePointerCapture(event.pointerId);
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
      pinch={ids:[a.identifier,b.identifier],span:Math.abs(a.clientY-b.clientY),height:monthHeight,scale:calendarScale(scroller),anchor:monthScrollAnchor(scroller,(a.clientY+b.clientY)/2)};
      pinchLock=true;
      suppressCalendarClickUntil=Date.now()+500;
      view.classList.add('is-adjusting');
    },{passive:false});
    scroller.addEventListener('touchmove',event=>{
      if (!pinchLock) return; // One finger retains native momentum scrolling.
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
  }
  document.addEventListener('click',event=>{
    if (Date.now()<suppressCalendarClickUntil && event.target.closest('.p-month-view') && event.target.closest('[data-task], [data-action="schedule-month-date"], [data-action="schedule-month-overflow"]')) {
      event.preventDefault();
      event.stopImmediatePropagation();
    }
  },true);
  function minuteAt(date, day) {
    const end = addDays(day, 1);
    if (date <= day) return 0;
    if (date >= end) return 1440;
    return date.getHours()*60 + date.getMinutes() + date.getSeconds()/60;
  }
  /* Split actual intervals before enlarging click targets. A point at 08:00 or
     16:00 belongs only to the following band; an end at midnight stays in its day. */
  function segmentsFor(d) {
    const day=startOfDay(d), tasks=dayTasks(day).filter(t=>!t.allDay);
    return Array.from({length:3},(_,index)=>{
      const start=index*BAND_MINUTES,end=start+BAND_MINUTES;
      const events=[];
      tasks.forEach(task=>{
        const range=taskRange(task), from=minuteAt(range.start,day), to=minuteAt(range.end,day);
        const point=+range.start===+range.end;
        if (point ? from<start||from>=end : to<=start||from>=end) return;
        events.push({task,start:Math.max(start,from),end:Math.min(end,to),
          before:range.start<day||from<start,after:range.end>addDays(day,1)||to>end});
      });
      return {index,start,end,events};
    });
  }
  /* Click boxes can extend beyond a short event, but never beyond their band.
     Lanes account for that hit area; the duration marker retains the real times. */
  function layoutSegments(band, width) {
    const span=band.end-band.start, minimum=Math.min(span,EVENT_HIT_WIDTH/Math.max(1,width)*span);
    const gap=4/Math.max(1,width)*span, ends=[];
    return band.events.map(event=>{
      const length=Math.max(minimum,event.end-event.start);
      const drawStart=Math.max(band.start,Math.min(event.start,band.end-length));
      return {...event,drawStart,drawEnd:drawStart+length};
    }).sort((a,b)=>a.drawStart-b.drawStart||a.start-b.start||b.end-a.end||URGENCY_ORDER[a.task.urgency]-URGENCY_ORDER[b.task.urgency]||a.task.id.localeCompare(b.task.id)).map(event=>{
      let lane=ends.findIndex(end=>end+gap<=event.drawStart);
      if (lane<0) lane=ends.length;
      ends[lane]=event.drawEnd;
      return {...event,lane};
    });
  }
  function minuteLabel(value) { return pad2(Math.floor(value/60))+':'+pad2(Math.floor(value%60)); }
  function bandRange(band) { return minuteLabel(band.start)+' – '+minuteLabel(band.end); }
  function bandEventHTML(event) {
    const task=event.task, time=(event.before?'← ':'')+minuteLabel(event.start)+(event.end===event.start?'':' – '+minuteLabel(event.end))+(event.after?' →':'');
    return '<button type="button" class="p-band-event'+(event.before?' continues-before':'')+(event.after?' continues-after':'')+(event.start===event.end?' is-point':'')+(task.status==='done'?' is-done':'')+'" data-task="'+esc(task.id)+'" data-start-minute="'+event.start+'" data-end-minute="'+event.end+'" style="'+taskColorVars(task)+'" aria-label="'+esc(taskAriaLabel(task,actor())+'，本段 '+time)+'" title="'+esc(task.title+' · '+fmtSchedule(task))+'">'+
      '<strong>'+esc(task.title)+'</strong><span class="p-band-event-time">'+esc(time)+'</span><span class="p-band-true-duration" aria-hidden="true"></span></button>';
  }
  function bandsHTML(d) {
    timelineBands=segmentsFor(d);
    const now=new Date(), current=sameDay(now,d)?minuteAt(now,startOfDay(d)):-1;
    return '<div class="p-day-bands">'+timelineBands.map(band=>{
      const hasNow=current>=band.start&&current<band.end;
      const ticks=Array.from({length:5},(_,index)=>'<span class="p-band-tick" data-minute="'+(band.start+index*120)+'" style="left:'+(index*25)+'%">'+minuteLabel(band.start+index*120)+'</span>').join('');
      const nowLine=hasNow?'<div class="p-band-now-line" data-minute="'+current+'" style="left:'+((current-band.start)/BAND_MINUTES*100)+'%" aria-label="当前时间 '+fmtTime(now)+'"><span></span></div>':'';
      return '<section class="p-time-band" data-band-start="'+band.start+'" data-band-end="'+band.end+'" aria-label="'+bandRange(band)+'日程">'+
        '<header class="p-band-heading"><h3 tabindex="-1">'+bandRange(band)+'</h3><span'+(hasNow?' class="p-band-current"':'')+'>'+(hasNow?'现在 '+fmtTime(now):band.events.length?band.events.length+' 项日程':'暂无日程')+'</span></header>'+
        '<div class="p-band-axis" aria-hidden="true">'+ticks+'</div><div class="p-band-grid">'+band.events.map(bandEventHTML).join('')+nowLine+
        '<button type="button" class="p-band-more" hidden data-hidden-count="0"></button>'+
        (!band.events.length?'<span class="p-band-empty">这个时段没有日程</span>':'')+'</div></section>';
    }).join('')+'</div>';
  }
  function bandOffset(band, scroller) {
    return (band.getBoundingClientRect().top-scroller.getBoundingClientRect().top)/calendarScale(scroller)+scroller.scrollTop;
  }
  function layoutTimeline(root, bands, preserveScroll) {
    const scroller=root.closest('.p-timeline-scroll'), elements=Array.from(root.querySelectorAll('.p-time-band'));
    if (!scroller.clientWidth) return;
    const focused=document.activeElement;
    const anchor=preserveScroll?elements.find(element=>bandOffset(element,scroller)+element.offsetHeight>scroller.scrollTop):null;
    const offset=anchor?scroller.scrollTop-bandOffset(anchor,scroller):0;
    elements.forEach((element,index)=>{
      const band=bands[index], grid=element.querySelector('.p-band-grid'), width=grid.clientWidth;
      const nodes=new Map(Array.from(grid.querySelectorAll('.p-band-event')).map(node=>[node.dataset.task,node]));
      const previouslyHidden=Array.from(nodes.values()).filter(node=>node.hidden);
      const events=layoutSegments(band,width), hidden=events.filter(event=>event.lane>=VISIBLE_LANES);
      events.forEach(event=>{
        const node=nodes.get(String(event.task.id)), drawLength=event.drawEnd-event.drawStart;
        node.hidden=event.lane>=VISIBLE_LANES;
        node.dataset.lane=String(event.lane);
        node.dataset.drawStartMinute=String(event.drawStart);
        node.dataset.drawEndMinute=String(event.drawEnd);
        node.style.left=((event.drawStart-band.start)/BAND_MINUTES*100)+'%';
        node.style.width=(drawLength/BAND_MINUTES*100)+'%';
        node.style.top=(event.lane*EVENT_LANE_HEIGHT)+'px';
        node.style.setProperty('--duration-offset',((event.start-event.drawStart)/drawLength*100)+'%');
        node.style.setProperty('--duration-width',((event.end-event.start)/drawLength*100)+'%');
      });
      const more=grid.querySelector('.p-band-more'), signature=JSON.stringify(hidden.map(event=>event.task.id));
      more.hidden=!hidden.length;
      more.dataset.hiddenCount=String(hidden.length);
      if (hidden.length && more.dataset.hiddenTasks!==signature) {
        more.dataset.overflow=registerOverflow(dayLabel(state.viewAnchor)+' '+bandRange(band)+' 其余日程',hidden.map(event=>event.task),dateKey(state.viewAnchor));
      }
      more.dataset.hiddenTasks=signature;
      more.style.top=(VISIBLE_LANES*EVENT_LANE_HEIGHT)+'px';
      more.textContent='+'+hidden.length+' 项日程 · 查看';
      more.setAttribute('aria-label',bandRange(band)+'，展开其余'+hidden.length+'项日程');
      const lanes=events.length?Math.min(VISIBLE_LANES,Math.max(...events.map(event=>event.lane))+1):1;
      grid.style.height=((hidden.length?VISIBLE_LANES+1:lanes)*EVENT_LANE_HEIGHT)+'px';
      if (focused && nodes.has(focused.dataset?.task) && grid.contains(focused) && focused.hidden) more.focus({preventScroll:true});
      if (focused===more && more.hidden) (previouslyHidden.find(node=>!node.hidden)||element.querySelector('.p-band-heading h3')).focus({preventScroll:true});
    });
    if (anchor) scroller.scrollTop=bandOffset(anchor,scroller)+offset;
    if (preserveScroll) rememberScheduleScroll(scroller);
  }
  function bindTimelineLayout() {
    const root=document.querySelector('.p-day-bands');
    if (!root) return;
    const bands=timelineBands;
    layoutTimeline(root,bands,false);
    let width=root.clientWidth;
    if (typeof ResizeObserver==='undefined') return;
    timelineObserver=new ResizeObserver(()=>{
      if (!root.isConnected||!root.clientWidth||Math.abs(root.clientWidth-width)<.5) return;
      width=root.clientWidth;
      cancelAnimationFrame(timelineFrame);
      timelineFrame=requestAnimationFrame(()=>{if(root.isConnected)layoutTimeline(root,bands,true);});
    });
    timelineObserver.observe(root);
  }
  function allDayHTML(d) {
    const tasks=dayTasks(d).filter(t=>t.allDay);
    if (!tasks.length) return '<span class="p-all-day-empty">—</span>';
    const limit=5;
    const rest=tasks.slice(limit),id=rest.length?registerOverflow(dayLabel(d)+' 其余全天任务',rest,dateKey(d)):null;
    return tasks.slice(0,limit).map(t=>'<button type="button" class="p-all-day-event" data-task="'+esc(t.id)+'" style="'+taskColorVars(t)+'" aria-label="'+esc(taskAriaLabel(t,actor()))+'">'+esc(t.title)+'</button>').join('')+
      (rest.length?'<button type="button" class="p-month-more" data-overflow="'+id+'">+'+rest.length+' 项</button>':'');
  }
  function dayHTML() {
    const d=state.viewAnchor;
    const heading='<header class="p-day-view-heading"><h2 tabindex="-1">'+dayLabel(d)+' <span>'+weekday(d)+'</span></h2><div class="p-day-display-modes" role="group" aria-label="当日日程显示方式">'+
      [['timeline','时间轴'],['list','任务清单']].map(([mode,label])=>'<button type="button" data-action="schedule-day-mode" data-day-mode="'+mode+'" aria-pressed="'+(dayDisplay===mode)+'" aria-controls="p-day-panel">'+label+'</button>').join('')+'</div></header>';
    const panel=dayDisplay==='list'?dayListHTML(d):'<section id="p-day-panel" class="p-time-panel" aria-label="'+dayLabel(d)+'日程时间轴">'+
      '<div class="p-day-allday"><span>全天</span><div>'+allDayHTML(d)+'</div></div>'+
      '<div class="p-timeline-scroll" tabindex="0" aria-label="横向时间轴，每8小时一行，上下滚动浏览全天">'+bandsHTML(d)+'</div></section>';
    return '<div class="p-day-layout" data-day-mode="'+dayDisplay+'">'+heading+panel+'</div>';
  }
  function normalizeViewMode() {
    if (state.viewMode!=='month' && state.viewMode!=='day') state.viewMode='month';
  }
  function scrollKey(mode=state.viewMode, date=state.viewAnchor, display=dayDisplay) {
    return state.actorId+':'+calendarPersonId()+':'+mode+(mode==='day'?':'+display:'')+':'+dateKey(viewRange(mode,date).start);
  }
  function rememberScheduleScroll(scroller) {
    if (!scroller?.isConnected || !scroller.clientHeight || !scroller.dataset.scheduleScrollKey) return;
    scheduleScroll.set(scroller.dataset.scheduleScrollKey,{top:scroller.scrollTop,left:scroller.scrollLeft});
    if (scheduleScroll.size>60) scheduleScroll.delete(scheduleScroll.keys().next().value);
  }
  function restoreScheduleScroll() {
    const scroller=document.querySelector('.p-month-scroll, .p-timeline-scroll, .p-day-list');
    if (!scroller) return;
    const range=viewRange(state.viewMode,state.viewAnchor);
    const key=scrollKey();
    scroller.dataset.scheduleScrollKey=key;
    const saved=scheduleScroll.get(key);
    if (saved) {
      scroller.scrollTop=saved.top;
      scroller.scrollLeft=saved.left;
    } else if (state.viewMode==='month') {
      const weeks=Array.from(scroller.querySelectorAll('.p-month-week'));
      const index=weeks.findIndex(week=>week.querySelector('.p-month-date.is-selected'));
      if (index>0) scroller.scrollTop=index*monthHeight;
    } else if (dayDisplay==='timeline') {
      const now=new Date(), includesToday=now>=range.start&&now<range.end;
      const firstTask=viewTasks(actor()).filter(t=>!t.allDay&&rangeHits(t,range.start,range.end)).sort((a,b)=>+a.start-+b.start)[0];
      const denseBand=segmentsFor(state.viewAnchor).find(band=>band.events.length>=VISIBLE_LANES);
      const minute=denseBand ? denseBand.start : includesToday?minuteAt(now,range.start):firstTask?Math.max(0,minuteAt(taskRange(firstTask).start,range.start)):0;
      const band=scroller.querySelector('[data-band-start="'+(Math.min(2,Math.floor(minute/BAND_MINUTES))*BAND_MINUTES)+'"]');
      if (band) scroller.scrollTop=Math.max(0,bandOffset(band,scroller)-8);
    }
    rememberScheduleScroll(scroller);
    scroller.addEventListener('scroll',()=>rememberScheduleScroll(scroller),{passive:true});
  }
  function renderSchedule() {
    timelineObserver?.disconnect();
    cancelAnimationFrame(timelineFrame);
    cancelAnimationFrame(scheduleFrame);
    normalizeViewMode();
    resetOverflowGroups();
    const main=document.getElementById('appMain');main.classList.add('is-schedule');
    document.getElementById('page-view').innerHTML='<section class="card p-schedule-card">'+toolbar()+'<div class="p-schedule-content p-mode-'+state.viewMode+'">'+(state.viewMode==='month'?monthHTML():dayHTML())+'</div></section>';
    bindTimelineLayout();
    // 主导航在页面渲染后才切换可见状态；等待布局完成再定位当前周。
    // 隐藏页面上的 scrollTop 会被浏览器归零，导致总是停在月初空白日期。
    scheduleFrame = requestAnimationFrame(() => {
      if (state.page === 'view' && state.viewPage !== 'table') restoreScheduleScroll();
    });
    if (state.viewMode==='month') bindMonthGestures();
  }
  renderView=renderSchedule;RENDER.view=renderSchedule;
  renderAll=function () {
    // Save the visible page before page classes or layout can reset its scroll position.
    const page=document.getElementById('page-view');
    if (page.classList.contains('is-active')) rememberScheduleScroll(page.querySelector('.p-month-scroll, .p-timeline-scroll, .p-day-list'));
    const schedule=P.ready&&state.page==='view'&&state.viewPage!=='table';
    document.querySelector('.phone').classList.toggle('is-schedule',schedule);
    document.getElementById('appMain').classList.toggle('is-schedule',schedule);
    previousRender();
  };
  function updateView() { state.pickerOpen=false;renderAll(); }
  function shift(direction) {
    const d=state.viewAnchor;
    if(state.viewMode==='month') {
      const target=new Date(d.getFullYear(),d.getMonth()+direction,1),last=new Date(target.getFullYear(),target.getMonth()+1,0).getDate();
      state.viewAnchor=new Date(target.getFullYear(),target.getMonth(),Math.min(d.getDate(),last));
    } else state.viewAnchor=addDays(d,direction);
    updateView();
  }
  function openDay(value, display) {
    const d=value?parseDateInput(value):state.viewAnchor;
    if (!d) return;
    state.viewAnchor=d;
    state.viewMode='day';
    dayDisplay=display==='list'?'list':'timeline';
    closeSheet();
    updateView();
    document.querySelector('.p-day-view-heading h2')?.focus({preventScroll:true});
  }
  function createTask(date) {
    openTaskForm('create');
    const d=date?parseDateInput(date):state.viewAnchor;
    if(drafts.task && d) {drafts.task.startDate=dateKey(d);drafts.task.endDate=dateKey(d);drafts.task.startTime='09:00';drafts.task.endTime='18:00';replaceTopSheet(taskFormView());}
  }
  runAction=function(el) {
    const action=el.dataset.action;
    if (action?.startsWith('schedule-')) normalizeViewMode();
    if(action==='schedule-my-applications'){if(P.openMyApplications)P.openMyApplications();else P.openApprovals('applicant');return;}
    if(action==='schedule-month-overflow'){openDay(el.dataset.date,'list');return;}
    if(action==='schedule-mode'){
      const focused=document.activeElement===el;
      state.viewMode=el.dataset.mode==='day'?'day':'month';updateView();
      if(focused)document.querySelector('[data-action="schedule-mode"][data-mode="'+state.viewMode+'"]')?.focus({preventScroll:true});
      return;
    }
    if(action==='schedule-day-mode'){
      const focused=document.activeElement===el;
      dayDisplay=el.dataset.dayMode==='list'?'list':'timeline';
      state.viewMode='day';updateView();
      if(focused)document.querySelector('[data-action="schedule-day-mode"][data-day-mode="'+dayDisplay+'"]')?.focus({preventScroll:true});
      return;
    }
    if(action==='schedule-prev'||action==='schedule-next'){
      const focused=document.activeElement===el;
      shift(action==='schedule-prev'?-1:1);
      if(focused)document.querySelector('[data-action="'+action+'"]')?.focus({preventScroll:true});
      return;
    }
    if(action==='schedule-today'){
      const focused=document.activeElement===el;
      const scroller=document.querySelector('.p-month-scroll, .p-timeline-scroll, .p-day-list');
      rememberScheduleScroll(scroller);
      if (scroller) delete scroller.dataset.scheduleScrollKey;
      state.viewAnchor=startOfDay(new Date());
      scheduleScroll.delete(scrollKey());
      if (state.viewMode==='day') {
        scheduleScroll.delete(scrollKey('day',state.viewAnchor,'timeline'));
        scheduleScroll.delete(scrollKey('day',state.viewAnchor,'list'));
      }
      updateView();
      if(focused)document.querySelector('[data-action="schedule-today"]')?.focus({preventScroll:true});
      return;
    }
    if(action==='schedule-month-date'||action==='schedule-open-day'){openDay(el.dataset.date,'timeline');return;}
    if(action==='schedule-date'){
      const focused=document.activeElement===el,d=parseDateInput(el.dataset.date);
      if(d){
        state.viewAnchor=d;state.viewMode='day';updateView();
        if(focused)document.querySelector('[data-action="schedule-date"][data-date="'+dateKey(d)+'"]')?.focus({preventScroll:true});
      }
      return;
    }
    if(action==='schedule-day-list'){openDay(el.dataset.date,'list');return;}
    if(action==='schedule-create'){createTask(el.dataset.date);return;}
    if(action==='schedule-pick-date'){
      openSheet({title:'跳转日期',body:'<div class="field"><label for="p-schedule-date">选择日期</label><input type="date" id="p-schedule-date" value="'+dateKey(state.viewAnchor)+'" data-autofocus></div><div class="callout" id="p-date-error" hidden></div>',foot:'<button type="button" class="btn primary" data-action="schedule-confirm-date">确定</button>'});return;
    }
    if(action==='schedule-confirm-date'){
      const d=parseDateInput(document.getElementById('p-schedule-date').value);
      if(!d){showError('p-date-error','请选择有效日期。');return;}state.viewAnchor=d;closeSheet();updateView();return;
    }
    previousAction(el);
  };
  P.sessionReset.push(function () {
    scheduleScroll.clear(); timelineBands=[]; dayDisplay='timeline'; state.calendarPersonId=null;
    timelineObserver?.disconnect(); cancelAnimationFrame(timelineFrame);
  });
  P.calendar={dayTasks,dayLogs,segmentsFor,layoutSegments,monthWeek,monthSortTasks,dayListSort,monthMetrics};
})();
