"use strict";
/* 本人资料可编辑；下属资料由后端逐次检查查看权限和手机号权限。 */
(function () {
  const P = window.Pandora;
  if (!P) throw new Error("请先加载潘多拉后端接入核心。");
  const previousAction = runAction;
  let profileDraft = null;
  let sequence = 0;
  const folds = { organization: true, reports: false };
  const avatarPresets = { rabbit: "🐰", cat: "🐱", bear: "🐻", panda: "🐼" };
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
  P.staffOrgLine = function (user) {
    return user ? [user.departmentName || "公司层", user.teamName, user.positionName].filter(Boolean).join(" › ") : "";
  };
  function employmentRows(user) {
    if (!Object.hasOwn(user,"employmentStartDate")) return "";
    const date=user.employmentStartDate;
    const formatted=date ? date.slice(0,4)+"年"+date.slice(5,7)+"月"+date.slice(8,10)+"日" : "未登记";
    const days=user.employmentDays;
    return row("入职日期",formatted)+row("入职天数",days==null?"未登记":days===0?"尚未入职":days+" 天");
  }
  function readonlyRows(user) {
    return row("组织身份", identityLabel(user)) +
      row("部门", user.departmentName || "公司层") + row("职位", user.positionName) +
      (user.teamName ? row("团队", user.teamName) : "") + row("直属上级", superior(user));
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
  function shiftStaffDate(date,days){return toDateInput(addDays(parseDateInput(date),days));}
  function instantLabel(value){const p=P.companyParts(new Date(value));return p.month+'月'+p.day+'日 '+p.hour+':'+p.minute;}
  function taskRange(raw){
    if(raw.allDay)return {start:P.companyDayStart(raw.startDate),end:P.companyDayStart(shiftStaffDate(raw.dueDate,1))};
    return {start:new Date(raw.startAt),end:new Date(raw.dueAt)};
  }
  function staffTaskHTML(raw,selectedDate=staff.date){
    const id=raw.taskId||raw.id,range=taskRange(raw),start=P.companyDayStart(selectedDate),end=P.companyDayStart(shiftStaffDate(selectedDate,1));
    const time=raw.allDay?'全天':(+range.start===+range.end?'时点 · ':'')+(range.start<start?'前日延续':instantLabel(raw.startAt).split(' ')[1])+' — '+(range.end>=end?'24:00':instantLabel(raw.dueAt).split(' ')[1]);
    const tag=(raw.tags||[])[0]||raw.tag;
    return '<button type="button" class="staff-work-item'+(raw.frozen?' is-pending-review':'')+'" data-task="'+esc(id)+'" style="--staff-accent:'+esc(tag?.color||'#f5ccdE')+'"><span class="staff-work-time">'+esc(time)+'</span><strong>'+esc(raw.title)+'</strong><span class="staff-work-meta">'+esc(({todo:'待开始',doing:'进行中',done:'已完成'})[raw.executionState]||'待开始')+(raw.frozen?' · 审核中':'')+'</span><small>'+esc(instantLabel(raw.startAt)+' 至 '+instantLabel(raw.dueAt))+'</small></button>';
  }
  function staffLogMonthHTML(s,key) {
    const anchor=P.calendar.monthFromKey(key);
    const entry=s.months.logs.entries.get(key);
    const weeks=monthGrid(anchor).weeks.map(week=>{
      const cells=Array.from({length:7},(_,index)=>{
        const day=addDays(week.start,index), date=toDateInput(day);
        if (day.getMonth()!==anchor.getMonth()) return '<span class="p-month-date is-blank" aria-hidden="true"></span>';
        const log=entry?.logs.get(date);
        if (!log) return '<span class="p-month-date"><span class="p-month-date-label"><strong>'+day.getDate()+'</strong></span></span>';
        return P.calendar.monthDateHTML(day,'data-action="p-staff-log" data-date="'+date+'" data-id="'+esc(log.id)+'"',date+" 有日志，查看全文",
          date===s.logSelected,date===P.data.home.businessDate,'<span class="staff-log-dot" aria-hidden="true"></span>');
      });
      return P.calendar.monthWeekHTML(week,cells.join(""));
    });
    const status=entry?.error ? '<button type="button" class="btn tiny-btn" data-action="p-staff-log-retry" data-date="'+key+'">重试 '+key+'</button>' :
      !entry?.loaded ? '<span class="tiny muted" role="status">加载中</span>' :
      !entry.logs.size ? '<span class="tiny muted">本月暂无日志</span>' : '';
    return P.calendar.monthFrameHTML(anchor,weeks,status);
  }
  function staffLogCalendarHTML(s) {
    const date=s.logDate || P.data.home.businessDate;
    return '<div class="staff-date-nav staff-log-nav"><button type="button" data-action="p-staff-log-prev" aria-label="上一月">‹</button>'+
      '<input type="month" id="staff-log-month" aria-label="跳转日志月份" value="'+date.slice(0,7)+'">'+
      '<button type="button" data-action="p-staff-log-next" aria-label="下一月">›</button>'+
      '<button type="button" data-action="p-staff-log-today">今天</button></div>'+
      P.calendar.readMonthViewHTML("员工日志月历，上下滚动浏览月份",s.months.logs.keys.map(key=>staffLogMonthHTML(s,key)).join(""),s.months.logs.density,"staffLogScroll");
  }
  function staffMonthCurrent(s, tab, scroller) {
    return staff===s && s.epoch===P.epoch && s.tab===tab && scroller.isConnected;
  }
  function monthState() { return {keys:[],entries:new Map(),position:null,density:undefined}; }
  function resetStaffMonth(s, tab) {
    const model=s.months[tab];
    model.keys=[];
    model.position=null;
    model.entries.clear();
  }
  function prepareStaffMonths(model,date) {
    if (!model.keys.length) {
      const anchor=parseDateInput(date);
      model.keys=[-1,0,1].map(delta=>P.calendar.monthKey(P.calendar.shiftMonth(anchor,delta)));
    }
    model.entries.clear();
  }
  async function loadStaffLogMonth(s,key,scroller) {
    const entry={logs:new Map(),loaded:false};
    s.months.logs.entries.set(key,entry);
    const from=P.calendar.monthFromKey(key), to=toDateInput(addDays(P.calendar.shiftMonth(from,1),-1));
    try {
      for (let offset=0;;) {
        const response=await P.request('/work-logs?scope=visible&authorId='+encodeURIComponent(s.person.id)+
          '&from='+key+'-01&to='+to+'&limit=100&offset='+offset);
        if (!staffMonthCurrent(s,"logs",scroller) || s.months.logs.entries.get(key)!==entry) return;
        for (const log of response.items || []) entry.logs.set(log.businessDate,log);
        if (response.nextOffset==null) break;
        if (Number(response.nextOffset)<=offset) throw new Error("日志分页异常");
        offset=Number(response.nextOffset);
      }
      entry.loaded=true;
    } catch (error) {
      if (!staffMonthCurrent(s,"logs",scroller) || s.months.logs.entries.get(key)!==entry) return;
      if (error.status===403 || error.status===404 || error.code==="AUTHORIZATION_CHANGED") {
        s.months.logs.entries.clear();
        P.subordinateLogs.clear();
        delete s.person.phone; delete s.person.employmentStartDate; delete s.person.employmentDays;
        s.error="当前无权查看此人的日志。";
        replaceTopSheet(staffView());
        return;
      }
      entry.logs.clear();
      entry.error=true;
    }
    const section=scroller.querySelector('[data-month-key="'+key+'"]');
    if (!section || !staffMonthCurrent(s,"logs",scroller)) return;
    const position=P.calendar.monthAnchor(scroller);
    section.outerHTML=staffLogMonthHTML(s,key);
    if (position) P.calendar.placeMonthAnchor(scroller,position);
    if (s.restoreFocus) {
      const trigger=scroller.querySelector(s.restoreFocus);
      if (trigger) { trigger.focus({preventScroll:true}); s.restoreFocus=null; }
    }
  }
  function extendStaffMonths(scroller, model, renderMonth, loadMonth, direction) {
    const edge=direction<0?model.keys[0]:model.keys.at(-1);
    const key=P.calendar.monthKey(P.calendar.shiftMonth(P.calendar.monthFromKey(edge),direction));
    const holder=document.createElement("div");
    holder.innerHTML=renderMonth(key);
    const stream=scroller.querySelector(".p-month-stream");
    if (direction<0) model.keys.unshift(key);
    else model.keys.push(key);
    P.calendar.growMonthStream(scroller,stream,holder.firstElementChild,direction<0);
    if (model.keys.length>12) {
      const removed=direction>0?model.keys.shift():model.keys.pop();
      const height=scroller.scrollHeight;
      stream.querySelector('.p-month-section[data-month-key="'+removed+'"]').remove();
      if (direction>0) scroller.scrollTop-=height-scroller.scrollHeight;
      model.entries.delete(removed);
    }
    loadMonth(key,scroller);
  }
  function staffMonthAnchor(scroller) {
    const header=scroller.querySelector(".p-weekday-row");
    return P.calendar.monthAnchor(scroller,header?.getBoundingClientRect().height||0);
  }
  function bindStaffMonthCalendar(s) {
    const tab=s.tab, logs=tab==="logs", model=s.months[tab];
    const scroller=document.getElementById(logs?"staffLogScroll":"staffScheduleScroll");
    if (!scroller) return;
    const renderMonth=key=>logs?staffLogMonthHTML(s,key):staffScheduleMonthHTML(s,key);
    const loadMonth=(key,view)=>logs?loadStaffLogMonth(s,key,view):loadStaffScheduleMonth(s,key,view);
    if (logs) {
      const view=scroller.closest(".p-month-view");
      P.calendar.bindReadMonthDensity(view);
      view.addEventListener("monthdensity",()=>{model.density=Number(view.dataset.rowHeight);});
    }
    const date=logs?s.logDate:s.date;
    const target=scroller.querySelector('.p-month-section[data-month-key="'+date.slice(0,7)+'"]');
    if (model.position) P.calendar.placeMonthAnchor(scroller,model.position);
    else if (target) {
      const header=scroller.querySelector(".p-weekday-row");
      scroller.scrollTop+=target.getBoundingClientRect().top-scroller.getBoundingClientRect().top-header.getBoundingClientRect().height;
    }
    let frame;
    scroller.addEventListener("scroll",()=>{
      const position=staffMonthAnchor(scroller);
      if (!position) return;
      model.position=position;
      const picker=document.getElementById(logs?"staff-log-month":"staff-calendar-date");
      if (picker && document.activeElement!==picker) picker.value=logs?position.month:
        s.date.startsWith(position.month+"-")?s.date:position.month+"-01";
      cancelAnimationFrame(frame);
      frame=requestAnimationFrame(()=>{
        if (!staffMonthCurrent(s,tab,scroller) || !scroller.clientHeight) return;
        if (scroller.scrollTop<scroller.clientHeight*.75) extendStaffMonths(scroller,model,renderMonth,loadMonth,-1);
        else if (scroller.scrollHeight-scroller.scrollTop-scroller.clientHeight<scroller.clientHeight*.75) extendStaffMonths(scroller,model,renderMonth,loadMonth,1);
      });
    },{passive:true});
    for (const key of model.keys) loadMonth(key,scroller);
  }
  function jumpStaffLogs(date) {
    staff.logDate=date;
    resetStaffMonth(staff,"logs");
    return refreshStaff();
  }
  function staffRangeRows(rows,startDate,endDate) {
    const start=P.companyDayStart(startDate),end=P.companyDayStart(endDate);
    return rows.filter(raw=>{
      const range=taskRange(raw);
      return +range.start===+range.end?range.start>=start&&range.start<end:range.end>start&&range.start<end;
    });
  }
  async function readStaffSchedule(s,from,until,current) {
    const effective=[];
    for (let offset=0;;) {
      const result=await P.request('/tasks?assigneeId='+encodeURIComponent(s.person.id)+'&calendarPreview=true&from='+from+
        '&to='+shiftStaffDate(until,-1)+'&limit=100&offset='+offset);
      if (!current()) return null;
      effective.push(...(result.items||[]));
      const cursor=result.nextCursor??result.nextOffset;
      if (cursor==null) break;
      if (Number(cursor)<=offset) throw new Error('日程分页异常，请重新读取。');
      offset=Number(cursor);
    }
    const tasks=effective.map(P.mapTask);
    const rows=staffRangeRows(tasks.map(task=>P.calendarTask(task).raw),from,until)
      .sort((a,b)=>+taskRange(a).start-+taskRange(b).start||String(a.taskId||a.id).localeCompare(String(b.taskId||b.id)));
    return {rows,tasks};
  }
  async function loadStaffScheduleMonth(s,key,scroller) {
    const model=s.months.schedule, entry={rows:[],tasks:[]};
    model.entries.set(key,entry);
    const current=()=>staffMonthCurrent(s,"schedule",scroller)&&model.entries.get(key)===entry;
    const next=toDateInput(P.calendar.shiftMonth(P.calendar.monthFromKey(key),1));
    try {
      const directory=await P.request('/me/reports');
      if (!current()) return;
      if (!(directory.items||[]).some(person=>person.id===s.person.id)) {
        throw Object.assign(new Error("已无权查看该人员的日程。"),{status:403});
      }
      const result=await readStaffSchedule(s,key+"-01",next,current);
      if (!result || !current()) return;
      Object.assign(entry,result,{loaded:true});
    } catch (error) {
      if (!current()) return;
      if (error.status===403||error.status===404||error.code==="AUTHORIZATION_CHANGED") {
        model.entries.clear();
        P.subordinateTasks.clear();
        s.person={id:s.person.id,displayName:s.person.displayName};
        s.error="已无权查看该人员的日程。";
        s.daySheetDate=null;
        replaceTopSheet(staffView());
        return;
      }
      entry.error=true;
    }
    const section=scroller.querySelector('.p-month-section[data-month-key="'+key+'"]');
    if (!section || !current()) return;
    const anchor=staffMonthAnchor(scroller);
    section.outerHTML=staffScheduleMonthHTML(s,key);
    if (anchor) P.calendar.placeMonthAnchor(scroller,anchor);
    if (s.daySheetDate?.startsWith(key+"-")) syncStaffDaySheet(s);
    restoreStaffFocus(s);
  }
  function staffRawColor(raw){return (raw.tags||[])[0]?.color||raw.tag?.color||'#ffe1ea';}
  function staffScheduleMonthHTML(s,key){
    const anchor=P.calendar.monthFromKey(key),end=P.calendar.shiftMonth(anchor,1);
    const entry=s.months.schedule.entries.get(key), tasks=(entry?.rows||[]).map(P.mapTask);
    const weeks=monthGrid(anchor).weeks.map(gridWeek=>{
      const date=toDateInput(gridWeek.start);
      const week=P.calendar.monthWeek(gridWeek,tasks,3,{start:anchor,end});
      const dates=week.days.map(d=>toDateInput(d));
      const cells=dates.map(d=>!d.startsWith(key+"-")?'<span class="staff-month-date is-outside" aria-hidden="true"></span>':
        '<button type="button" class="staff-month-date" data-action="p-staff-date" data-date="'+d+'" aria-label="'+d+
        '，查看当日任务" aria-pressed="'+(d===s.date)+'"><span>'+Number(d.slice(-2))+'</span></button>').join('');
      const bars=week.shown.map(segment=>{const task=segment.task,raw=task.raw,done=raw.executionState==='done';
        const detail=(segment.before?'延续 · ':'')+instantLabel(raw.startAt)+' 至 '+instantLabel(raw.dueAt)+(done?' · 已完成':'')+(raw.frozen?' · 审核中':'');
        return '<div role="group" tabindex="0" class="staff-month-event'+(segment.point?' is-point':'')+(done?' is-done':'')+(raw.frozen?' is-pending-review':'')+(segment.before?' continues-before':'')+(segment.after?' continues-after':'')+'" data-task="'+esc(task.id)+'" data-col-start="'+segment.start+'" data-col-end="'+segment.end+'" style="grid-column:'+(segment.start+1)+' / '+(segment.end+1)+';grid-row:'+(segment.lane+1)+';--month-left:'+segment.left+'%;--month-width:'+segment.width+'%;--staff-accent:'+esc(staffRawColor(raw))+'" title="'+esc(raw.title+' · '+detail)+'"><span class="staff-month-duration"><span class="p-month-caption"><strong>'+esc(raw.title)+'</strong><small>'+esc(detail)+'</small></span></span></div>';
      }).join('');
      const more=week.hidden.map((rows,col)=>rows.length?'<button type="button" data-action="p-staff-date" data-date="'+dates[col]+'" class="staff-month-more" style="grid-column:'+(col+1)+'" aria-label="'+dates[col]+'，还有'+rows.length+'项，查看全天">+'+rows.length+'</button>':'').join('');
      return '<div class="p-month-week staff-month-week" data-week-start="'+date+'"><div class="staff-month-days">'+cells+
        '</div><div class="staff-month-tracks">'+bars+'</div><div class="staff-month-overflow">'+more+'</div></div>';
    });
    const status=entry?.error?'<button type="button" class="btn tiny-btn" data-action="p-staff-schedule-retry" data-date="'+key+'">重试 '+key+'</button>':
      !entry?.loaded?'<span class="tiny muted" role="status">加载中</span>':
      !entry.rows.length?'<span class="tiny muted">本月暂无日程</span>':'';
    return P.calendar.monthFrameHTML(anchor,weeks,status);
  }
  function staffScheduleCalendarHTML(s) {
    const weeks=['一','二','三','四','五','六','日'].map(day=>'<span>'+day+'</span>').join("");
    return '<div class="p-month-view staff-month-view staff-schedule-stream"><div class="p-month-scroll staff-month-scroll" id="staffScheduleScroll" tabindex="0" aria-label="员工日程月历，上下滚动浏览月份">'+
      '<div class="p-month-layout"><div class="p-weekday-row staff-month-weekdays">'+weeks+'</div><div class="p-month-stream">'+
      s.months.schedule.keys.map(key=>staffScheduleMonthHTML(s,key)).join("")+'</div></div></div></div>';
  }
  function staffDayHTML(){
    const s=staff,date=parseDateInput(s.date),all=[],timed=[];
    s.rows.forEach(raw=>{const task=P.mapTask(raw),coverage=P.calendar.dayCoverage(task,date);if(!coverage)return;if(task.allDay||coverage.fullDay)all.push(raw);else timed.push(Object.assign({task},coverage));});
    const modes='<div class="staff-day-formats" role="group" aria-label="日视图显示方式">'+[['axis','时间轴'],['list','任务清单']].map(([mode,label])=>'<button type="button" data-action="p-staff-format" data-format="'+mode+'" aria-pressed="'+(s.dayFormat===mode)+'">'+label+'</button>').join('')+'</div>';
    if(s.dayFormat==='list')return modes+(s.rows.length?s.rows.map(raw=>staffTaskHTML(raw)).join(''):'<div class="staff-state">这一天暂无负责的任务</div>');
    const events=P.calendar.layoutDayEvents(timed),hours=Array.from({length:25},(_,h)=>'<div class="staff-axis-hour" style="top:'+h*60+'px"><span>'+pad2(h)+':00</span></div>').join('');
    const bars=events.map(e=>{
      const task=e.task,raw=task.raw,range=taskRange(raw),start=P.companyDayStart(s.date),end=P.companyDayStart(shiftStaffDate(s.date,1)),done=raw.executionState==='done';
      return '<div role="group" tabindex="0" class="staff-axis-event'+(e.point?' is-point':'')+(done?' is-done':'')+(task.frozen?' is-pending-review':'')+'" data-task="'+esc(task.id)+'" data-start-minute="'+e.start+'" data-end-minute="'+e.end+'" data-columns="'+e.columns+'" style="top:'+e.drawStart+'px;height:'+(e.drawEnd-e.drawStart)+'px;left:'+(e.lane*100/e.columns)+'%;width:'+(100/e.columns)+'%;--staff-accent:'+esc(staffRawColor(raw))+';--true-top:'+(e.start-e.drawStart)+'px;--true-height:'+Math.max(2,e.end-e.start)+'px" aria-label="'+esc(task.title+'，'+instantLabel(raw.startAt)+' 至 '+instantLabel(raw.dueAt)+(done?'，已完成':''))+'" title="'+esc(task.title+' · '+instantLabel(raw.startAt)+' 至 '+instantLabel(raw.dueAt)+(done?' · 已完成':''))+'"><span class="staff-axis-true"><span class="p-axis-caption"><strong>'+esc(task.title)+'</strong><small>'+esc(instantLabel(raw.startAt).split(' ')[1]+(done?' · 已完成':'')+(task.frozen?' · 审核中':''))+'</small></span></span></div>';
    }).join('');
    return modes+(all.length?'<div class="staff-allday"><span>全天</span><div>'+all.map(raw=>{const done=raw.executionState==='done';return '<button type="button" class="'+(done?'is-done ':'')+(raw.frozen?'is-pending-review':'')+'" data-task="'+esc(raw.taskId||raw.id)+'" style="--staff-accent:'+esc(staffRawColor(raw))+'">'+esc(raw.title+(done?' · 已完成':'')+(raw.frozen?' · 审核中':''))+'</button>';}).join('')+'</div></div>':'')+'<div class="staff-axis-scroll" tabindex="0" aria-label="当天00:00至24:00时间轴，可上下滚动"><div class="staff-day-axis">'+hours+'<div class="staff-axis-events">'+bars+'</div></div></div>';
  }
  function staffCalendarNav(){
    const s=staff,dates=Array.from({length:7},(_,i)=>shiftStaffDate(s.date,i-3));
    return '<div class="staff-calendar-modes" role="group" aria-label="人员日程视图">'+[['month','月视图'],['day','日视图']].map(([mode,label])=>'<button type="button" data-action="p-staff-mode" data-mode="'+mode+'" aria-pressed="'+(s.mode===mode)+'">'+label+'</button>').join('')+'</div><div class="staff-date-nav"><button type="button" data-action="p-staff-nav" data-step="-1" aria-label="上一'+(s.mode==='month'?'月':'天')+'">‹</button><label class="staff-calendar-picker"><span class="sr-only">跳转日期</span><input type="date" id="staff-calendar-date" value="'+s.date+'" aria-label="跳转日期"></label><button type="button" data-action="p-staff-today">今天</button><button type="button" data-action="p-staff-nav" data-step="1" aria-label="下一'+(s.mode==='month'?'月':'天')+'">›</button></div>'+(s.mode==='day'?'<div class="staff-date-strip" role="group" aria-label="查看日期">'+dates.map(date=>'<button type="button" data-action="p-staff-date" data-date="'+date+'" aria-pressed="'+(date===s.date)+'"><small>'+['日','一','二','三','四','五','六'][parseDateInput(date).getDay()]+'</small><strong>'+Number(date.slice(-2))+'</strong></button>').join('')+'</div>':'');
  }
  function restoreStaffAxis(){requestAnimationFrame(()=>{const axis=document.querySelector('.staff-axis-scroll');if(!axis||!staff)return;const date=parseDateInput(staff.date),events=staff.rows.map(raw=>P.calendar.dayCoverage(P.mapTask(raw),date)).filter(e=>e&&!e.fullDay);axis.scrollTop=Math.max(0,(events[0]?.start??480)-60);});}
  function staffDaySheetHTML(s) {
    if (!s.daySheetDate || s.loading || s.error) return '';
    const date=s.daySheetDate, key=date.slice(0,7), entry=s.months.schedule.entries.get(key);
    const rows=entry?.loaded ? staffRangeRows(entry.rows,date,shiftStaffDate(date,1)) : [];
    const content=entry?.error ? '<button type="button" class="btn" data-action="p-staff-schedule-retry" data-date="'+key+'">重试日程</button>' :
      !entry?.loaded ? '<p class="tiny muted" role="status">正在读取日程…</p>' :
      rows.length ? rows.map(raw=>staffTaskHTML(raw,date)).join("") : '<p class="empty">这一天暂无负责的任务</p>';
    return '<section class="staff-day-popup" role="dialog" aria-label="'+date+'完整任务清单"><h3>'+date+' 日程</h3>'+content+
      '<div class="row"><button type="button" class="btn" data-action="p-staff-day-view">进入日视图</button><button type="button" class="btn" data-action="p-staff-day-close">关闭清单</button></div></section>';
  }
  function syncStaffDaySheet(s) {
    const host=document.getElementById("staff-day-popup-host");
    if (host) host.innerHTML=staffDaySheetHTML(s);
  }
  function restoreStaffFocus(s) {
    if (!s.restoreFocus) return;
    const scope=s.daySheetDate?document.getElementById("staff-day-popup-host"):sheetBodyEl;
    const node=scope?.querySelector(s.restoreFocus);
    if (node) {node.focus({preventScroll:true});s.restoreFocus=null;}
  }
  function staffView(){
    const s=staff,p=s.person;
    const dateBar=s.tab==='schedule'?staffCalendarNav():'';
    const content=s.loading?'<div class="staff-state" role="status">正在读取'+(s.tab==='schedule'?'日程':'日志')+'…</div>':s.error?'<div class="staff-state" role="alert">'+esc(s.error)+'<button type="button" class="btn" data-action="p-staff-retry">重新读取</button></div>':s.tab==='schedule'?(s.mode==='month'?staffScheduleCalendarHTML(s):staffDayHTML()):staffLogCalendarHTML(s);
    return {title:p.displayName+'的工作',fullscreen:true,subordinate:true,body:'<section class="staff-panel" data-staff-panel="'+esc(p.id)+'"><header class="staff-person"><span class="staff-avatar">'+esc(Array.from(p.displayName||'')[0]||'人')+'</span><div><h2>'+esc(p.displayName)+'</h2><p>'+esc(P.staffOrgLine(p))+'</p></div></header><div class="staff-tabs" role="group" aria-label="下属工作类型">'+[['schedule','日程'],['logs','日志']].map(([tab,label])=>'<button type="button" data-action="p-staff-tab" data-tab="'+tab+'" aria-pressed="'+(s.tab===tab)+'">'+label+'</button>').join('')+'</div>'+dateBar+'<div class="staff-content">'+content+'</div>'+'<div id="staff-day-popup-host">'+staffDaySheetHTML(s)+'</div></section>',foot:'',rebuild:function(){if(staff===s){s.loading=true;s.restoreScroll=this.savedScroll??0;s.restoreFocus=this.savedFocus||null;setTimeout(()=>refreshStaff(),0);}return staffView();}};
  }
  function staffCardView(){
    if(!staff)return null;
    const p=staff.person;
    return {title:p.displayName+'的资料',subordinate:true,body:'<div class="profile-details">'+row("职务",P.staffOrgLine(p))+row("直属上级",superior(p))+
      (p.phone?row("手机号",p.phone):"")+employmentRows(p)+'</div><div class="action-grid"><button type="button" class="btn primary" data-action="p-staff-enter" data-tab="schedule">查看日程</button><button type="button" class="btn" data-action="p-staff-enter" data-tab="logs">查看日志</button></div>',
      foot:withBack(button('sheet-close','关闭'))};
  }
  P.subordinateKey = function () { return staff && staff.epoch === P.epoch ? staff.person.id + ':' + P.epoch : null; };
  function staffCurrent(s,seq){return staff===s&&s.epoch===P.epoch&&seq===staffSequence&&!!document.querySelector('[data-staff-panel="'+s.person.id+'"]');}
  async function refreshStaff(){
    const s=staff;
    if(!s||s.epoch!==P.epoch)return;
    const seq=++staffSequence, current=()=>staffCurrent(s,seq);
    s.loading=true;
    s.error=null;
    s.rows=[];
    P.subordinateTasks.clear();
    P.subordinateLogs.clear();
    replaceTopSheet(staffView());
    try {
      const directory=await P.request('/me/reports');
      if (!current()) return;
      if (!(directory.items||[]).some(p=>p.id===s.person.id)) throw Error('已无权查看该人员，请关闭后刷新下属资料。');
      const person=await P.request('/users/'+encodeURIComponent(s.person.id));
      if (!current()) return;
      s.person=person;
      if (s.tab==="logs") {
        if (!person.canReadLogs) throw Error('当前无权查看此人的日志。');
        s.logDate=s.months.logs.position ? s.months.logs.position.month+"-01" : s.logDate || P.data.home.businessDate;
        prepareStaffMonths(s.months.logs,s.logDate);
      } else if (s.mode==="month") {
        prepareStaffMonths(s.months.schedule,s.date);
      } else {
        const result=await readStaffSchedule(s,s.date,shiftStaffDate(s.date,1),current);
        if (!result || !current()) return;
        s.rows=result.rows;
        result.tasks.forEach(task=>P.subordinateTasks.set(task.id,task));
      }
      s.loading=false;
      replaceTopSheet(staffView());
      if (s.tab==="logs"||s.mode==="month") bindStaffMonthCalendar(s);
      else restoreStaffAxis();
      if (s.restoreScroll!=null) {
        sheetBodyEl.scrollTop=s.restoreScroll;
        s.restoreScroll=null;
      }
      restoreStaffFocus(s);
    } catch(error) {
      if (!current()) return;
      P.subordinateTasks.clear();
      P.subordinateLogs.clear();
      s.rows=[];
      s.daySheetDate=null;
      s.person={id:s.person.id,displayName:s.person.displayName};
      s.months.logs.entries.clear();
      s.months.schedule.entries.clear();
      s.loading=false;
      s.error=error.message;
      replaceTopSheet(staffView());
    }
  }
  function openPerson(id){
    const person=reports().find(p=>p.id===id);
    if(!person){P.notice('当前下属资料中没有此人，请刷新后重试。');return;}
    staff={person,epoch:P.epoch,tab:'schedule',mode:'month',dayFormat:'axis',date:P.data.home.businessDate,rows:[],loading:false,error:null,daySheetDate:null,logDate:null,months:{logs:monthState(),schedule:monthState()}};
    P.subordinateTasks.clear();P.subordinateLogs.clear();
    openSheet(staffCardView());
    return P.busy(async()=>{const raw=await P.request('/users/'+encodeURIComponent(id));if(staff?.person.id!==id||staff.epoch!==P.epoch)return;staff.person=raw;replaceTopSheet(staffCardView());});
  }
  function openPersonLogs(id){openPerson(id);}
  function openStaffDaySheet(date,trigger){
    if (!staff) return;
    staff.date=date;
    staff.daySheetDate=date;
    staff.dayTrigger=trigger;
    staff.dayOuterScroll=sheetBodyEl.scrollTop;
    const scroller=document.getElementById("staffScheduleScroll");
    if (scroller) {
      staff.months.schedule.position=staffMonthAnchor(scroller);
      scroller.querySelectorAll('button.staff-month-date[aria-pressed="true"]').forEach(cell=>cell.setAttribute("aria-pressed","false"));
      scroller.querySelector('button.staff-month-date[data-date="'+date+'"]')?.setAttribute("aria-pressed","true");
    }
    const entry=staff.months.schedule.entries.get(date.slice(0,7));
    entry?.tasks.forEach(task=>P.subordinateTasks.set(task.id,task));
    syncStaffDaySheet(staff);
    document.querySelector('#staff-day-popup-host button')?.focus({preventScroll:true});
  }
  function changeStaffDate(date) {
    staff.date=date;
    resetStaffMonth(staff,"schedule");
    return refreshStaff();
  }

  renderMe = function () {
    const user = me();
    document.getElementById("page-me").innerHTML = '<section class="card profile-card"><div class="profile-hero"><div class="avatar">' +
      avatarHTML(user) + '</div><div class="profile-heading"><p class="eyebrow">MY WORKSPACE</p><h2>' + esc(user.displayName) + '</h2><p>' + esc(user.positionName || ROLE_LABEL[user.role] || "团队成员") + '</p></div>' +
      '<button type="button" class="profile-settings" data-action="p-open-settings" aria-label="个人设置">' + gear + '</button></div>' +
      '<div class="profile-details">' + row("联系电话", user.phone) + row("邮箱", user.email) + '</div></section>' +
      '<details class="card profile-fold" data-profile-fold="organization"' + (folds.organization ? ' open' : '') + '><summary><span>组织信息</span><span class="fold-hint">由管理员维护</span><span class="fold-chevron" aria-hidden="true">⌄</span></summary><div class="profile-details fold-content">' + readonlyRows(user) + '</div></details>' + reportsSection();
  };

  function openSettings() {
    const user = me();
    openSheet({ title: "个人设置", body: '<div class="settings-menu">' + button("p-edit-profile", "编辑资料与头像", "primary") +
      '<div class="settings-section"><h3>账号与安全</h3>' + row("登录手机号", user.phone) + row("身份", identityLabel(user)) +
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
  P.sessionReset.push(function () { profileDraft = null; staff=null; staffSequence++; expandedReports.clear(); folds.organization = true; folds.reports = false; });

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
    if(action==='p-staff-log' && staff) {
      staff.logSelected=element.dataset.date;
      return openLogDetail(element.dataset.id);
    }
    if(staff && action==='p-staff-log-retry') {
      const scroller=document.getElementById("staffLogScroll");
      if (scroller) return loadStaffLogMonth(staff,element.dataset.date,scroller);
    }
    if(staff && action==='p-staff-log-today')return jumpStaffLogs(P.data.home.businessDate);
    if(staff && (action==='p-staff-log-prev'||action==='p-staff-log-next')) {
      const date=staff.months.logs.position?.month ? staff.months.logs.position.month+"-01" : staff.logDate;
      return jumpStaffLogs(toDateInput(P.calendar.shiftMonth(parseDateInput(date),action.endsWith("prev")?-1:1)));
    }
    if(staff && action==='p-staff-schedule-retry') {
      const scroller=document.getElementById("staffScheduleScroll");
      if (scroller) return loadStaffScheduleMonth(staff,element.dataset.date,scroller);
    }
    if(action==='p-staff-enter'&&staff){staff.tab=element.dataset.tab==='logs'?'logs':'schedule';staff.daySheetDate=null;openSheet(staffView());return refreshStaff();}
    if(action==='p-staff-day-close'&&staff){
      const date=staff.daySheetDate, trigger=staff.dayTrigger;
      staff.daySheetDate=null;staff.dayTrigger=null;
      syncStaffDaySheet(staff);
      sheetBodyEl.scrollTop=staff.dayOuterScroll || 0;
      (trigger?.isConnected?trigger:document.querySelector('#staffScheduleScroll [data-date="'+date+'"]'))?.focus({preventScroll:true});
      return;
    }
    if(action==='p-staff-day-view'&&staff){staff.date=staff.daySheetDate;staff.daySheetDate=null;staff.mode='day';return refreshStaff();}
    if(action?.startsWith('p-staff-')&&staff){
      if(action==='p-staff-tab')staff.tab=element.dataset.tab==='logs'?'logs':'schedule';
      if(action==='p-staff-date'){if(staff.mode==='month')return openStaffDaySheet(element.dataset.date,element);return changeStaffDate(element.dataset.date);}
      if(action==='p-staff-mode')staff.mode=element.dataset.mode==='day'?'day':'month';
      staff.daySheetDate=null;
      if(action==='p-staff-format'){staff.dayFormat=element.dataset.format==='list'?'list':'axis';replaceTopSheet(staffView());restoreStaffAxis();return;}
      if(action==='p-staff-nav'){
        const step=Number(element.dataset.step);
        if (staff.mode==='day') return changeStaffDate(shiftStaffDate(staff.date,step));
        const month=staff.months.schedule.position?.month || staff.date.slice(0,7);
        return changeStaffDate(toDateInput(P.calendar.shiftMonth(P.calendar.monthFromKey(month),step)));
      }
      if(action==='p-staff-week')staff.date=shiftStaffDate(staff.date,Number(element.dataset.step));
      if(action==='p-staff-today')return changeStaffDate(P.data.home.businessDate);
      return refreshStaff();
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
        const week=event.target.closest('.staff-month-week');
        openStaffDaySheet(shiftStaffDate(week.dataset.weekStart,Number(event.target.dataset.colStart)),event.target);
      } else openTaskDetail(event.target.dataset.task);
    }
  });
  document.addEventListener('click',event=>{
    const bar=event.target.closest?.('.staff-month-event');
    if(!bar||!staff)return;
    const week=bar.closest('.staff-month-week'),track=week.querySelector('.staff-month-tracks');
    const rect=track.getBoundingClientRect(),column=Math.max(Number(bar.dataset.colStart),Math.min(Number(bar.dataset.colEnd)-1,Math.floor((event.clientX-rect.left)/(rect.width/7))));
    event.preventDefault();event.stopImmediatePropagation();openStaffDaySheet(shiftStaffDate(week.dataset.weekStart,column),bar);
  },true);
  document.addEventListener('change',function(event){if(event.target.id==='staff-log-month'&&staff&&parseDateInput(event.target.value+'-01'))return jumpStaffLogs(event.target.value+'-01');if(event.target.id==='staff-calendar-date'&&staff){const value=event.target.value,d=parseDateInput(value);if(d&&toDateInput(d)===value){changeStaffDate(value);}}});
  RENDER.me = renderMe;
})();
