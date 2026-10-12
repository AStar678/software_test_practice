"use strict";
/* 日程界面沿用后端有效任务与原任务弹层；日期选择只影响当前视图。 */
(function () {
  const P = window.Pandora;
  let HOUR_HEIGHT = 18;
  let DAY_HEIGHT = HOUR_HEIGHT * 24;
  const MIN_EVENT_HEIGHT = 20;
  const MONTH_ROWS = 4;
  let monthRows = 2, fitRequest = 0;
  let lunarFormatter;
  try { lunarFormatter = new Intl.DateTimeFormat('zh-CN-u-ca-chinese', { month:'long', day:'numeric' }); } catch (_) {}
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
  function scheduleText(t, d) {
    if (t.allDay) return '全天';
    const start = startOfDay(d), end = addDays(start, 1);
    const begins = t.start < start ? '前日延续' : fmtTime(t.start);
    const ends = t.due >= end ? '24:00' : fmtTime(t.due);
    return begins + ' – ' + ends + (t.due > end ? ' · 跨日' : '');
  }
  function sortedDay(d) {
    return dayTasks(d).sort((a, b) => Number(b.allDay) - Number(a.allDay) || +a.start - +b.start || URGENCY_ORDER[a.urgency] - URGENCY_ORDER[b.urgency] || a.id.localeCompare(b.id));
  }
  function taskButton(t, d, kind) {
    return '<button type="button" class="p-agenda-item ' + (kind || '') + '" data-task="' + esc(t.id) + '" style="' + taskColorVars(t) + '">' +
      '<span class="p-agenda-marker" aria-hidden="true"></span><span class="p-agenda-copy"><strong>' + esc(t.title) + '</strong><span>' + esc(scheduleText(t, d)) + '</span>' +
      '<span class="p-agenda-meta">' + statusBadge(t) + urgencyBadge(t.urgency) + '</span></span></button>';
  }
  function agenda(d, compact) {
    const tasks = sortedDay(d);
    return '<aside class="p-agenda' + (compact ? ' p-agenda-day' : '') + '" aria-label="所选日期日程">' +
      '<div class="p-agenda-heading"><div><span class="p-caption">' + weekday(d) + '</span><h2>' + dayLabel(d) + '</h2></div>' +
      (!compact ? '<button type="button" class="p-text-button" data-action="schedule-open-day" data-date="' + dateKey(d) + '">查看日程 ' + icons.right + '</button>' : '') + '</div>' +
      (tasks.length ? tasks.map(t => taskButton(t, d)).join('') : '<div class="p-calendar-empty">这一天还没有任务。<button type="button" class="p-text-button" data-action="schedule-create">创建任务</button></div>') + '</aside>';
  }
  function toolbar() {
    const d = state.viewAnchor;
    const label = d.getFullYear() + '年' + (d.getMonth() + 1) + '月';
    return '<header class="p-schedule-header"><div class="p-schedule-toolbar">' +
      '<button type="button" class="p-date-button" data-action="schedule-pick-date" aria-label="选择日期，当前' + label + '">' + label + icons.down + '</button>' +
      '<div class="p-schedule-navigation"><button type="button" class="p-icon-button" data-action="schedule-prev" aria-label="上一' + ({month:'月',week:'周',day:'天'})[state.viewMode] + '">' + icons.left + '</button>' +
      '<button type="button" class="p-today-button" data-action="schedule-today">今天</button><button type="button" class="p-icon-button" data-action="schedule-next" aria-label="下一' + ({month:'月',week:'周',day:'天'})[state.viewMode] + '">' + icons.right + '</button></div>' +
      '<div class="p-schedule-modes" role="group" aria-label="日历视图">' + [['month','月'],['week','周'],['day','日']].map(([mode,label]) =>
      '<button type="button" data-action="schedule-mode" data-mode="' + mode + '" aria-pressed="' + (state.viewMode === mode) + '">' + label + '</button>').join('') + '</div>' +
      '<button type="button" class="btn primary p-schedule-create" data-action="schedule-create">' + icons.plus + '<span>创建任务</span></button></div>' +
      (state.viewMode === 'day' ? dayStrip() : '') + '</header>';
  }
  function dayStrip() {
    const start = viewRange('week', state.viewAnchor).start, today = startOfDay(new Date());
    return '<div class="p-day-strip" aria-label="本周日期">' + Array.from({length:7}, (_,i) => {
      const d = addDays(start, i), selected = sameDay(d, state.viewAnchor);
      return '<button type="button" class="' + (selected ? 'is-selected ' : '') + (sameDay(d,today) ? 'is-today' : '') + '" data-action="schedule-date" data-date="' + dateKey(d) + '" aria-pressed="' + selected + '" aria-label="' + dayLabel(d) + ' ' + weekday(d) + '"><span>' + weekday(d).slice(-1) + '</span><strong>' + d.getDate() + '</strong></button>';
    }).join('') + '</div>';
  }
  function lunarLabel(d) {
    if (!lunarFormatter || lunarFormatter.resolvedOptions().calendar !== 'chinese') return '';
    const parts = lunarFormatter.formatToParts(d), day = Number(parts.find(p => p.type === 'day')?.value);
    const month = parts.find(p => p.type === 'month')?.value || '';
    const digits = ['一','二','三','四','五','六','七','八','九','十'];
    if (day === 1) return month;
    if (day <= 10) return '初' + digits[day-1];
    if (day < 20) return '十' + digits[day-11];
    if (day === 20) return '二十';
    if (day < 30) return '廿' + digits[day-21];
    return day === 30 ? '三十' : '';
  }
  /* Each task remains one continuous strip per week. Hidden counts come from
     the strips actually shown in each date, including any lane gaps. */
  function monthWeek(week, list, capacity = MONTH_ROWS) {
    const days = Array.from({length:7}, (_,i) => addDays(week.start,i));
    const occupied = [], segments = [];
    for (const task of viewSortTasks(list)) {
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
    return {days,shown,hidden};
  }
  function connectedTaskHTML(s, weekMode) {
    const t=s.task, classes=(s.before?' continues-before':'')+(s.after?' continues-after':'')+(t.status==='done'?' is-done':'')+(weekMode?' p-week-span-event':'');
    const detail=weekMode&&!t.allDay?'<small class="p-week-span-time">'+esc(fmtSchedule(t))+'</small>':'';
    return '<button type="button" class="p-month-event'+classes+'" data-task="'+esc(t.id)+'" data-start-column="'+s.start+'" data-end-column="'+s.end+'" data-lane="'+s.lane+'" data-span="'+(s.end-s.start)+
      '" style="grid-column:'+(s.start+1)+' / '+(s.end+1)+';grid-row:'+(s.lane+1)+';'+taskColorVars(t)+'" aria-label="'+esc(taskAriaLabel(t,actor()))+'" title="'+esc(t.title+' · '+fmtSchedule(t))+'"><span>'+esc(t.title)+'</span>'+detail+'</button>';
  }
  function monthHTML() {
    const grid = monthGrid(state.viewAnchor), today = startOfDay(new Date()), list = viewTasks(actor());
    const weeks = grid.weeks.map(week => {
      const data = monthWeek(week,list,monthRows);
      const dates = data.days.map(d => {
        const selected = sameDay(d,state.viewAnchor), current = sameDay(d,today), other = d.getMonth() !== state.viewAnchor.getMonth();
        return '<button type="button" class="p-month-date' + (selected?' is-selected':'') + (current?' is-today':'') + (other?' is-other-month':'') +
          '" data-action="schedule-month-date" data-date="'+dateKey(d)+'" aria-pressed="'+selected+'" aria-label="'+dayLabel(d)+' '+weekday(d)+'，查看日程"><span class="p-month-date-label"><strong>'+d.getDate()+'</strong><small>'+esc(lunarLabel(d))+'</small></span></button>';
      }).join('');
      const strips = data.shown.map(s => connectedTaskHTML(s,false)).join('');
      const more = data.hidden.map((tasks,col) => {
        if (!tasks.length) return '';
        const d=data.days[col], id=registerOverflow(dayLabel(d)+' 其余 '+tasks.length+' 项',tasks,dateKey(d));
        return '<button type="button" class="p-month-more" data-overflow="'+id+'" data-date="'+dateKey(d)+'" data-hidden-count="'+tasks.length+'" style="grid-column:'+(col+1)+'" aria-label="'+dayLabel(d)+'，还有'+tasks.length+'项任务">+'+tasks.length+(monthRows?' 项':'')+'</button>';
      }).join('');
      return '<div class="p-month-week" data-week-start="'+dateKey(week.start)+'"><div class="p-month-days">'+dates+'</div><div class="p-month-tracks">'+strips+'</div><div class="p-month-overflow">'+more+'</div></div>';
    }).join('');
    return '<section class="p-month-layout'+(monthRows?'':' is-summary')+'" style="--month-rows:'+monthRows+'" aria-label="月日历"><div class="p-weekday-row">'+WEEK_NAMES.map(w=>'<span>'+w+'</span>').join('')+'</div><div class="p-month-grid" style="--calendar-weeks:'+grid.weeks.length+'" aria-label="完整月日历">'+weeks+'</div></section>';
  }
  function minuteAt(date, day, isEnd) {
    const end = addDays(day, 1);
    if (date <= day) return 0;
    if (date >= end) return 1440;
    return date.getHours()*60 + date.getMinutes() + date.getSeconds()/60;
  }
  function isSharedWeekTask(t) {
    const r=taskRange(t);
    return t.allDay || r.end > addDays(startOfDay(r.start),1);
  }
  /* The minimum click target expands only the drawing, never stored start/due times. */
  function groupsFor(d, singleDayOnly) {
    const day = startOfDay(d);
    const events = dayTasks(day).filter(t => !t.allDay && (!singleDayOnly || !isSharedWeekTask(t))).map(t => {
      const start = minuteAt(t.start,day), end = minuteAt(t.due,day,true);
      const visualEnd = Math.min(1440, Math.max(end, start + MIN_EVENT_HEIGHT * 60 / HOUR_HEIGHT));
      return { task:t, start, end, visualEnd, drawStart:Math.min(start,1440-MIN_EVENT_HEIGHT*60/HOUR_HEIGHT), column:0 };
    }).sort((a,b) => a.start-b.start || b.end-a.end || URGENCY_ORDER[a.task.urgency]-URGENCY_ORDER[b.task.urgency] || a.task.id.localeCompare(b.task.id));
    const groups = [];
    for (const event of events) {
      let group = groups[groups.length-1];
      if (!group || event.drawStart >= group.end) { group={start:event.drawStart,end:event.visualEnd,events:[],ends:[]};groups.push(group); }
      const col = group.ends.findIndex(end => end <= event.drawStart);
      event.column = col < 0 ? group.ends.length : col;
      group.ends[event.column] = event.visualEnd;
      group.events.push(event);group.end=Math.max(group.end,event.visualEnd);
    }
    return groups;
  }
  function timedEvents(d, cap, singleDayOnly) {
    return groupsFor(d,singleDayOnly).map(group => {
      const cols = Math.min(group.ends.length, cap), aggregate = group.ends.length > cap;
      const shown = group.events.filter(e => !aggregate || e.column < cap-1);
      let html = shown.map(e => {
        const t=e.task, top=e.drawStart/60*HOUR_HEIGHT, height=Math.max(MIN_EVENT_HEIGHT,(e.visualEnd-e.drawStart)/60*HOUR_HEIGHT);
        const trueHeight=Math.max(2,(e.end-e.start)/60*HOUR_HEIGHT);
        return '<button type="button" class="p-time-event' + (height < 48 ? ' is-short' : '') + (t.status === 'done' ? ' is-done' : '') +
          '" data-task="' + esc(t.id) + '" data-start-minute="' + e.start + '" data-end-minute="' + e.end + '" style="top:' + top + 'px;height:' + height + 'px;left:calc(' + (e.column/cols*100) + '% + 2px);width:calc(' + (100/cols) + '% - 4px);--actual-height:' + trueHeight + 'px;--actual-offset:' + ((e.start-e.drawStart)/60*HOUR_HEIGHT) + 'px;' + taskColorVars(t) + '" aria-label="' + esc(taskAriaLabel(t,actor())) + '">' +
          '<span class="p-event-true-duration" aria-hidden="true"></span><strong>' + esc(t.title) + '</strong><span class="p-event-time">' + esc(scheduleText(t,d)) + '</span>' + (t.frozen ? '<span class="p-event-state">审核中</span>' : '') + '</button>';
      }).join('');
      if (aggregate) {
        const rest=group.events.filter(e=>e.column>=cap-1), tasks=rest.map(e=>e.task);
        const id=registerOverflow(dayLabel(d)+' 重叠日程',tasks);
        const top=Math.min(...rest.map(e=>e.drawStart))/60*HOUR_HEIGHT;
        const bottom=Math.max(...rest.map(e=>e.visualEnd))/60*HOUR_HEIGHT;
        const height=Math.min(DAY_HEIGHT-top,Math.max(MIN_EVENT_HEIGHT,bottom-top));
        html+='<button type="button" class="p-time-more'+(height<44?' is-short':'')+'" data-overflow="'+id+'" style="top:'+top+'px;height:'+height+'px;left:calc('+((cap-1)/cols*100)+'% + 2px);width:calc('+(100/cols)+'% - 4px)" aria-label="展开'+rest.length+'项日程"><strong>+'+rest.length+'</strong><span>展开</span></button>';
      }
      return html;
    }).join('');
  }
  function axis() {
    const step=HOUR_HEIGHT<12?4:HOUR_HEIGHT<22?2:1;
    return '<div class="p-time-axis" aria-hidden="true">' + Array.from({length:25},(_,h)=>h%step===0?'<span style="top:'+(h*HOUR_HEIGHT)+'px">'+pad2(h)+':00</span>':'').join('')+'</div>';
  }
  function nowLine(d) {
    const now=new Date();
    if (!sameDay(now,d)) return '';
    return '<div class="p-now-line" style="top:'+((now.getHours()+now.getMinutes()/60)*HOUR_HEIGHT)+'px" aria-label="当前时间 '+fmtTime(now)+'"><span></span></div>';
  }
  function allDayHTML(d) {
    const tasks=dayTasks(d).filter(t=>t.allDay);
    if (!tasks.length) return '<span class="p-all-day-empty">—</span>';
    const limit=1;
    const rest=tasks.slice(limit),id=rest.length?registerOverflow(dayLabel(d)+' 其余全天任务',rest,dateKey(d)):null;
    return tasks.slice(0,limit).map(t=>'<button type="button" class="p-all-day-event" data-task="'+esc(t.id)+'" style="'+taskColorVars(t)+'" aria-label="'+esc(taskAriaLabel(t,actor()))+'">'+esc(t.title)+'</button>').join('')+
      (rest.length?'<button type="button" class="p-month-more" data-overflow="'+id+'">+'+rest.length+' 项</button>':'');
  }
  function dayHTML() {
    const d=state.viewAnchor;
    return '<div class="p-day-layout"><section class="p-time-panel" aria-label="'+dayLabel(d)+'日程时间轴">'+
      '<div class="p-time-heading"><strong>'+dayLabel(d)+' <span>'+weekday(d)+'</span></strong><button type="button" class="p-text-button" data-action="schedule-day-list" data-date="'+dateKey(d)+'">日程清单</button></div>'+
      '<div class="p-day-allday"><span>全天</span><div>'+allDayHTML(d)+'</div></div>'+
      '<div class="p-timeline-scroll" tabindex="0" aria-label="从00:00至24:00的纵向时间轴"><div class="p-day-canvas" style="height:'+DAY_HEIGHT+'px;--hour-height:'+HOUR_HEIGHT+'px">'+axis()+
      '<div class="p-day-events">'+timedEvents(d,3)+nowLine(d)+'</div></div></div></section>'+agenda(d,true)+'</div>';
  }
  function weekSpans(start) {
    const data=monthWeek({start,end:addDays(start,7)},viewTasks(actor()).filter(isSharedWeekTask),2);
    const rows=Math.max(1,...data.shown.map(s=>s.lane+1));
    const bars=data.shown.map(s=>connectedTaskHTML(s,true)).join('') || Array.from({length:7},()=>'<span class="p-all-day-empty">—</span>').join('');
    const more=data.hidden.map((tasks,col)=>{
      if(!tasks.length)return '';
      const d=data.days[col],id=registerOverflow(dayLabel(d)+' 其余 '+tasks.length+' 项全天与跨日任务',tasks,dateKey(d));
      return '<button type="button" class="p-month-more" data-overflow="'+id+'" data-date="'+dateKey(d)+'" data-hidden-count="'+tasks.length+'" style="grid-column:'+(col+1)+'" aria-label="'+dayLabel(d)+'，还有'+tasks.length+'项全天与跨日任务">+'+tasks.length+' 项</button>';
    }).join('');
    return '<div class="p-week-spanning" data-week-start="'+dateKey(start)+'"><span class="p-week-gutter">全天<br>跨日</span><div class="p-week-span-content"><div class="p-week-span-tracks" style="--span-rows:'+rows+'">'+bars+'</div>'+(more?'<div class="p-week-span-overflow">'+more+'</div>':'')+'</div></div>';
  }
  function weekHTML() {
    const start=viewRange('week',state.viewAnchor).start, days=Array.from({length:7},(_,i)=>addDays(start,i)),today=new Date();
    return '<section class="p-week-panel" aria-label="周日程"><div class="p-week-scroll" aria-label="完整一周日程"><div class="p-week-canvas">'+
      '<div class="p-week-sticky"><div class="p-week-columns p-week-heading"><span class="p-week-gutter">时间</span>'+days.map(d=>'<button type="button" data-action="schedule-open-day" data-date="'+dateKey(d)+'" class="'+(sameDay(d,today)?'is-today':'')+'" aria-label="打开'+dayLabel(d)+'日视图"><span>'+weekday(d)+'</span><strong>'+d.getDate()+'</strong></button>').join('')+'</div>'+
      weekSpans(start)+'</div>'+
      '<div class="p-week-time" style="height:'+DAY_HEIGHT+'px;--hour-height:'+HOUR_HEIGHT+'px">'+axis()+'<div class="p-week-event-columns">'+days.map(d=>'<div class="p-week-event-day" data-date="'+dateKey(d)+'">'+timedEvents(d,1,true)+nowLine(d)+'</div>').join('')+'</div></div></div></div></section>';
  }
  function fitSchedule() {
    if (!P.ready || state.page!=='view') return;
    const content=document.querySelector('.p-schedule-content');
    if (!content || content.clientHeight<1) return;
    if (state.viewMode==='month') {
      const week=content.querySelector('.p-month-week'), layout=content.querySelector('.p-month-layout');
      if (!week || !layout) return;
      const css=getComputedStyle(layout), size=name=>parseFloat(css.getPropertyValue(name));
      const available=week.clientHeight-size('--month-date-height')-size('--month-more-height')-4;
      const next=Math.max(0,Math.min(MONTH_ROWS,Math.floor((available+size('--month-track-gap'))/(size('--month-track-height')+size('--month-track-gap')))));
      if(next!==monthRows){monthRows=next;resetOverflowGroups();content.innerHTML=monthHTML();}
    } else {
      const box=content.querySelector(state.viewMode==='day'?'.p-timeline-scroll':'.p-week-time');
      if (!box) return;
      const css=getComputedStyle(box);
      const available=box.clientHeight-parseFloat(css.paddingTop)-parseFloat(css.paddingBottom);
      if (available<MIN_EVENT_HEIGHT) return;
      const next=Math.floor(available/24*100)/100;
      if(Math.abs(next-HOUR_HEIGHT)>.015){
        HOUR_HEIGHT=next;DAY_HEIGHT=next*24;resetOverflowGroups();
        content.innerHTML=state.viewMode==='day'?dayHTML():weekHTML();
      }
    }
  }
  function renderSchedule() {
    resetOverflowGroups();
    const main=document.getElementById('appMain');main.classList.add('is-schedule');
    document.getElementById('page-view').innerHTML='<section class="card p-schedule-card">'+toolbar()+'<div class="p-schedule-content p-mode-'+state.viewMode+'">'+(state.viewMode==='month'?monthHTML():state.viewMode==='week'?weekHTML():dayHTML())+'</div></section>';
    fitSchedule();
  }
  new ResizeObserver(()=>{cancelAnimationFrame(fitRequest);fitRequest=requestAnimationFrame(fitSchedule);}).observe(document.getElementById('appMain'));
  renderView=renderSchedule;RENDER.view=renderSchedule;
  renderAll=function () {
    const schedule=P.ready&&state.page==='view';
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
    } else state.viewAnchor=addDays(d,direction*(state.viewMode==='week'?7:1));
    updateView();
  }
  function openList(value, onlyAllDay) {
    const d=parseDateInput(value);if(!d)return;
    const tasks=sortedDay(d).filter(t=>!onlyAllDay||t.allDay);
    openSheet({title:dayLabel(d)+' · '+(onlyAllDay?'全天任务':'日程清单'),body:tasks.length?'<div class="stack">'+tasks.map(t=>taskButton(t,d)).join('')+'</div>':'<div class="empty">这一天还没有任务</div>',foot:withBack('<button type="button" class="btn" data-action="schedule-open-day" data-date="'+dateKey(d)+'">日视图</button><button type="button" class="btn primary" data-action="schedule-create" data-date="'+dateKey(d)+'">创建任务</button>')});
  }
  function createTask(date) {
    openTaskForm('create');
    const d=date?parseDateInput(date):state.viewAnchor;
    if(drafts.task && d) {drafts.task.startDate=dateKey(d);drafts.task.endDate=dateKey(d);drafts.task.startTime='09:00';drafts.task.endTime='18:00';replaceTopSheet(taskFormView());}
  }
  runAction=function(el) {
    const action=el.dataset.action;
    if(action==='schedule-mode'){state.viewMode=el.dataset.mode;updateView();return;}
    if(action==='schedule-prev'||action==='schedule-next'){shift(action==='schedule-prev'?-1:1);return;}
    if(action==='schedule-today'){state.viewAnchor=startOfDay(new Date());updateView();return;}
    if(action==='schedule-month-date'){
      const d=parseDateInput(el.dataset.date);if(!d)return;
      const scroll=document.querySelector('.p-month-grid').scrollTop;
      const sameMonth=d.getMonth()===state.viewAnchor.getMonth()&&d.getFullYear()===state.viewAnchor.getFullYear();
      state.viewAnchor=d;updateView();
      if(sameMonth)document.querySelector('.p-month-grid').scrollTop=scroll;
      openList(dateKey(d),false);return;
    }
    if(action==='schedule-date'||action==='schedule-open-day'){
      const d=parseDateInput(el.dataset.date);if(d){state.viewAnchor=d;if(action==='schedule-open-day'){closeSheet();state.viewMode='day';}updateView();}return;
    }
    if(action==='schedule-day-list'){openList(el.dataset.date,el.dataset.allday==='true');return;}
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
  P.calendar={dayTasks,groupsFor,monthWeek};
})();
