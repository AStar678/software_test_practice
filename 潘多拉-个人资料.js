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
  function readonlyRows(user) {
    return row("公司", user.organizationName) + row("组织身份", identityLabel(user)) +
      (user.departmentName ? row("部门", user.departmentName) : "") + row("职位", user.positionName) +
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
      return '<li><div class="staff-tree-node">'+(has?'<button type="button" class="staff-tree-toggle" data-action="p-report-toggle" data-id="'+esc(person.id)+'" aria-expanded="'+open+'" aria-label="'+(open?'收起':'展开')+esc(person.displayName)+'的下属">'+(open?'−':'+')+'</button>':'<span class="staff-tree-spacer"></span>')+'<button type="button" class="staff-tree-person" data-action="p-open-person" data-id="'+esc(person.id)+'"><strong>'+esc(person.displayName)+'</strong><small>'+esc(identityLabel(person)+' · '+(person.positionName||person.teamName||person.departmentName||''))+'</small></button></div>'+(has&&open?'<ul>'+nodes(person.id)+'</ul>':'')+'</li>';
    }).join('');}
    return '<details class="card profile-fold" data-profile-fold="reports"'+(folds.reports?' open':'')+'><summary><span>下属资料</span><span class="fold-hint">'+list.length+' 人</span><span class="fold-chevron" aria-hidden="true">⌄</span></summary><div class="fold-content">'+(list.length?'<ul class="staff-tree" aria-label="下属组织层级">'+nodes(me().id)+'</ul>':'<p class="empty">暂无下属</p>')+'</div></details>';
  }
  function staffDate(d){return d.slice(5).replace('-','月')+'日';}
  function shiftStaffDate(date,days){return toDateInput(addDays(parseDateInput(date),days));}
  function instantLabel(value){const p=P.companyParts(new Date(value));return p.month+'月'+p.day+'日 '+p.hour+':'+p.minute;}
  function taskRange(raw){
    if(raw.allDay)return {start:P.companyDayStart(raw.startDate),end:P.companyDayStart(shiftStaffDate(raw.dueDate,1))};
    return {start:new Date(raw.startAt),end:new Date(raw.dueAt)};
  }
  function staffTaskHTML(raw){
    const id=raw.taskId||raw.id,range=taskRange(raw),start=P.companyDayStart(staff.date),end=P.companyDayStart(shiftStaffDate(staff.date,1));
    const time=raw.allDay?'全天':(+range.start===+range.end?'时点 · ':'')+(range.start<start?'前日延续':instantLabel(raw.startAt).split(' ')[1])+' — '+(range.end>=end?'24:00':instantLabel(raw.dueAt).split(' ')[1]);
    const tag=(raw.tags||[])[0]||raw.tag;
    return '<button type="button" class="staff-work-item" data-task="'+esc(id)+'" style="--staff-accent:'+esc(tag?.color||'#f5ccdE')+'"><span class="staff-work-time">'+esc(time)+'</span><strong>'+esc(raw.title)+'</strong><span class="staff-work-meta">'+esc(({todo:'待开始',doing:'进行中',done:'已完成'})[raw.executionState]||'待开始')+(raw.frozen?' · 审核中':'')+'</span><small>'+esc(instantLabel(raw.startAt)+' 至 '+instantLabel(raw.dueAt))+'</small></button>';
  }
  function staffLogHTML(raw){return '<button type="button" class="staff-log-card" data-action="p-staff-log" data-id="'+esc(raw.id)+'"><span class="staff-work-time">'+esc(raw.businessDate)+'</span><strong>'+esc(raw.body)+'</strong><small>'+esc(raw.tag?.name||'无标签')+' · 查看全文与评论 →</small></button>';}
  function staffMonthBounds(date){
    const d=parseDateInput(date),first=new Date(d.getFullYear(),d.getMonth(),1),last=new Date(d.getFullYear(),d.getMonth()+1,0);
    const start=addDays(first,-((first.getDay()+6)%7)),end=addDays(last,7-((last.getDay()+6)%7));
    return {start:toDateInput(start),end:toDateInput(end),first,last};
  }
  function staffQueryRange(s){if(s.mode==='month')return staffMonthBounds(s.date);return {start:s.date,end:shiftStaffDate(s.date,1)};}
  function staffRawColor(raw){return (raw.tags||[])[0]?.color||raw.tag?.color||'#ffe1ea';}
  function staffMonthHTML(){
    const s=staff,bounds=staffMonthBounds(s.date),tasks=s.rows.map(P.mapTask),weeks=[];
    for(let date=bounds.start;date<bounds.end;date=shiftStaffDate(date,7)){
      const week=P.calendar.monthWeek({start:parseDateInput(date)},tasks,3);
      const dates=week.days.map(d=>toDateInput(d));
      const cells=dates.map(d=>'<button type="button" class="staff-month-date'+(d.slice(0,7)!==s.date.slice(0,7)?' is-outside':'')+'" data-action="p-staff-date" data-date="'+d+'" aria-label="'+d+'，查看日视图" aria-pressed="'+(d===s.date)+'"><span>'+Number(d.slice(-2))+'</span></button>').join('');
      const bars=week.shown.map(segment=>{const task=segment.task,raw=task.raw;
        return '<button type="button" class="staff-month-event'+(segment.before?' continues-before':'')+(segment.after?' continues-after':'')+'" data-task="'+esc(task.id)+'" style="grid-column:'+(segment.start+1)+' / '+(segment.end+1)+';grid-row:'+(segment.lane+1)+';--staff-accent:'+esc(staffRawColor(raw))+'" title="'+esc(raw.title+' · '+instantLabel(raw.startAt)+' 至 '+instantLabel(raw.dueAt))+'"><strong>'+esc(raw.title)+'</strong><small>'+esc(raw.allDay?'全天':segment.before?'延续':instantLabel(raw.startAt).split(' ')[1])+'</small></button>';
      }).join('');
      const more=week.hidden.map((rows,col)=>rows.length?'<button type="button" data-action="p-staff-date" data-date="'+dates[col]+'" class="staff-month-more" style="grid-column:'+(col+1)+'" aria-label="'+dates[col]+'，还有'+rows.length+'项，查看全天">+'+rows.length+'</button>':'').join('');
      weeks.push('<div class="staff-month-week"><div class="staff-month-days">'+cells+'</div><div class="staff-month-tracks">'+bars+'</div><div class="staff-month-overflow">'+more+'</div></div>');
    }
    return '<div class="staff-month-view" aria-label="'+s.date.slice(0,7)+'月历"><div class="staff-month-weekdays">'+['一','二','三','四','五','六','日'].map(x=>'<span>'+x+'</span>').join('')+'</div><div class="staff-month-scroll">'+weeks.join('')+'</div></div>';
  }
  function staffDayHTML(){
    const s=staff,date=parseDateInput(s.date),all=[],timed=[];
    s.rows.forEach(raw=>{const task=P.mapTask(raw),coverage=P.calendar.dayCoverage(task,date);if(!coverage)return;if(task.allDay||coverage.fullDay)all.push(raw);else timed.push(Object.assign({task},coverage));});
    const modes='<div class="staff-day-formats" role="group" aria-label="日视图显示方式">'+[['axis','时间轴'],['list','任务清单']].map(([mode,label])=>'<button type="button" data-action="p-staff-format" data-format="'+mode+'" aria-pressed="'+(s.dayFormat===mode)+'">'+label+'</button>').join('')+'</div>';
    if(s.dayFormat==='list')return modes+(s.rows.length?s.rows.map(staffTaskHTML).join(''):'<div class="staff-state">这一天暂无负责的任务</div>');
    const events=P.calendar.layoutDayEvents(timed),hours=Array.from({length:25},(_,h)=>'<div class="staff-axis-hour" style="top:'+h*60+'px"><span>'+pad2(h)+':00</span></div>').join('');
    const bars=events.map(e=>'<button type="button" class="staff-axis-event" data-task="'+esc(e.task.id)+'" data-start-minute="'+e.start+'" data-end-minute="'+e.end+'" data-columns="'+e.columns+'" style="top:'+e.drawStart+'px;height:'+(e.drawEnd-e.drawStart)+'px;left:'+(e.lane*100/e.columns)+'%;width:'+(100/e.columns)+'%;--staff-accent:'+esc(staffRawColor(e.task.raw))+';--true-top:'+(e.start-e.drawStart)+'px;--true-height:'+Math.max(2,e.end-e.start)+'px" aria-label="'+esc(e.task.title+'，'+instantLabel(e.task.raw.startAt)+' 至 '+instantLabel(e.task.raw.dueAt))+'"><span class="staff-axis-true"></span><strong>'+esc(e.task.title)+'</strong><small>'+esc(instantLabel(e.task.raw.startAt).split(' ')[1])+'</small></button>').join('');
    return modes+(all.length?'<div class="staff-allday"><span>全天</span><div>'+all.map(raw=>'<button type="button" data-task="'+esc(raw.taskId||raw.id)+'" style="--staff-accent:'+esc(staffRawColor(raw))+'">'+esc(raw.title)+'</button>').join('')+'</div></div>':'')+'<div class="staff-axis-scroll" tabindex="0" aria-label="当天00:00至24:00时间轴，可上下滚动"><div class="staff-day-axis">'+hours+'<div class="staff-axis-events">'+bars+'</div></div></div>';
  }
  function staffCalendarNav(){
    const s=staff,dates=Array.from({length:7},(_,i)=>shiftStaffDate(s.date,i-3));
    return '<div class="staff-calendar-modes" role="group" aria-label="人员日程视图">'+[['month','月视图'],['day','日视图']].map(([mode,label])=>'<button type="button" data-action="p-staff-mode" data-mode="'+mode+'" aria-pressed="'+(s.mode===mode)+'">'+label+'</button>').join('')+'</div><div class="staff-date-nav"><button type="button" data-action="p-staff-nav" data-step="-1" aria-label="上一'+(s.mode==='month'?'月':'天')+'">‹</button><label class="staff-calendar-picker"><span class="sr-only">跳转日期</span><input type="date" id="staff-calendar-date" value="'+s.date+'" aria-label="跳转日期"></label><button type="button" data-action="p-staff-today">今天</button><button type="button" data-action="p-staff-nav" data-step="1" aria-label="下一'+(s.mode==='month'?'月':'天')+'">›</button></div>'+(s.mode==='day'?'<div class="staff-date-strip" role="group" aria-label="查看日期">'+dates.map(date=>'<button type="button" data-action="p-staff-date" data-date="'+date+'" aria-pressed="'+(date===s.date)+'"><small>'+['日','一','二','三','四','五','六'][parseDateInput(date).getDay()]+'</small><strong>'+Number(date.slice(-2))+'</strong></button>').join('')+'</div>':'');
  }
  function restoreStaffAxis(){requestAnimationFrame(()=>{const axis=document.querySelector('.staff-axis-scroll');if(!axis||!staff)return;const date=parseDateInput(staff.date),events=staff.rows.map(raw=>P.calendar.dayCoverage(P.mapTask(raw),date)).filter(e=>e&&!e.fullDay);axis.scrollTop=Math.max(0,(events[0]?.start??480)-60);});}
  function staffView(){
    const s=staff,p=s.person;
    const dateBar=s.tab==='schedule'?staffCalendarNav():'';
    const content=s.loading?'<div class="staff-state" role="status">正在读取'+(s.tab==='schedule'?'日程':'日志')+'…</div>':s.error?'<div class="staff-state" role="alert">'+esc(s.error)+'<button type="button" class="btn" data-action="p-staff-retry">重新读取</button></div>':s.tab==='schedule'?(s.mode==='month'?staffMonthHTML():staffDayHTML()):s.rows.length?s.rows.map(staffLogHTML).join(''):'<div class="staff-state">'+(s.tab==='schedule'?'这一天暂无负责的任务':'暂无可查看的日志')+'</div>';
    return {title:p.displayName+'的工作',fullscreen:true,body:'<section class="staff-panel" data-staff-panel="'+esc(p.id)+'"><header class="staff-person"><span class="staff-avatar">'+esc(Array.from(p.displayName||'')[0]||'人')+'</span><div><h2>'+esc(p.displayName)+'</h2><p>'+esc(identityLabel(p)+' · '+(p.positionName||''))+'</p><small>'+esc([p.departmentName,p.teamName].filter(Boolean).join(' / ')||'公司层')+'</small></div></header><details class="staff-person-info"><summary>人员资料</summary>'+readonlyRows(p)+(p.phone?row('手机号',p.phone):'')+(p.canSetHandoverPreset?'<button type="button" class="btn" data-action="p-open-handover-preset" data-id="'+esc(p.id)+'" data-name="'+esc(p.displayName)+'">设置交接预设</button>':'')+'</details><div class="staff-tabs" role="group" aria-label="下属工作类型">'+[['schedule','日程'],['logs','日志']].map(([tab,label])=>'<button type="button" data-action="p-staff-tab" data-tab="'+tab+'" aria-pressed="'+(s.tab===tab)+'">'+label+'</button>').join('')+'</div>'+dateBar+'<div class="staff-content">'+content+'</div>'+(!s.loading&&!s.error&&s.next!=null?'<button type="button" class="btn staff-more" data-action="p-staff-more">加载更早日志</button>':'')+'</section>',foot:'',rebuild:function(){if(staff===s){s.rows=[];s.loading=true;setTimeout(()=>refreshStaff(false),0);}return staffView();}};
  }
  function staffCurrent(s,seq){return staff===s&&s.epoch===P.epoch&&seq===staffSequence&&!!document.querySelector('[data-staff-panel="'+s.person.id+'"]');}
  async function refreshStaff(more){
    const s=staff;if(!s||s.epoch!==P.epoch)return;
    return (async()=>{
      const seq=++staffSequence, queryRange=staffQueryRange(s);s.loading=true;s.error=null;if(!more)s.rows=[];replaceTopSheet(staffView());
      try{
        const directory=await P.request('/me/reports');
        if(!(directory.items||[]).some(p=>p.id===s.person.id))throw Error('已无权查看该人员，请关闭后刷新下属资料。');
        const person=await P.request('/users/'+encodeURIComponent(s.person.id));
        let rows=[],next=null;
        if(s.tab==='logs'){
          if(!person.canReadLogs)throw Error('当前无权查看此人的日志。');
          const result=await P.request('/work-logs?scope=visible&authorId='+encodeURIComponent(person.id)+'&limit=10&offset='+(more?s.next:0));
          rows=result.items||[];next=result.nextOffset??null;
        }else{
          let offset=0;do{
            const result=await P.request('/tasks?assigneeId='+encodeURIComponent(person.id)+'&from='+queryRange.start+'&to='+shiftStaffDate(queryRange.end,-1)+'&limit=100&offset='+offset);
            rows.push(...(result.items||[]));const cursor=result.nextCursor??result.nextOffset;
            if(cursor==null)break;if(Number(cursor)<=offset)throw Error('日程分页异常，请重新读取。');offset=Number(cursor);
          }while(true);
          const start=P.companyDayStart(queryRange.start),end=P.companyDayStart(queryRange.end);
          rows=rows.filter(r=>{const range=taskRange(r);return +range.start===+range.end?range.start>=start&&range.start<end:range.end>start&&range.start<end;}).sort((a,b)=>+taskRange(a).start-+taskRange(b).start||String(a.taskId||a.id).localeCompare(String(b.taskId||b.id)));
        }
        if(!staffCurrent(s,seq))return;
        s.person=person;s.rows=more?s.rows.concat(rows):rows;s.next=next;s.loading=false;replaceTopSheet(staffView());restoreStaffAxis();
      }catch(error){if(!staffCurrent(s,seq))return;s.rows=[];s.next=null;s.person=Object.assign({},s.person,{canSetHandoverPreset:false});delete s.person.phone;s.loading=false;s.error=error.message;replaceTopSheet(staffView());}
    })();
  }
  function openPerson(id){
    const person=reports().find(p=>p.id===id);
    if(!person){P.notice('当前下属资料中没有此人，请刷新后重试。');return;}
    staff={person,epoch:P.epoch,tab:'schedule',mode:'month',dayFormat:'axis',date:P.data.home.businessDate,rows:[],next:null,loading:true,error:null};
    openSheet(staffView());return refreshStaff(false);
  }
  function openPersonLogs(id){openPerson(id);}

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
    if(action==='p-staff-log')return openLogDetail(element.dataset.id);
    if(action?.startsWith('p-staff-')&&staff){
      if(action==='p-staff-tab')staff.tab=element.dataset.tab==='logs'?'logs':'schedule';
      if(action==='p-staff-date'){staff.date=element.dataset.date;staff.mode='day';}
      if(action==='p-staff-mode')staff.mode=element.dataset.mode==='day'?'day':'month';
      if(action==='p-staff-format'){staff.dayFormat=element.dataset.format==='list'?'list':'axis';replaceTopSheet(staffView());restoreStaffAxis();return;}
      if(action==='p-staff-nav'){const d=parseDateInput(staff.date),step=Number(element.dataset.step);staff.date=staff.mode==='month'?toDateInput(new Date(d.getFullYear(),d.getMonth()+step,1)):shiftStaffDate(staff.date,step);}
      if(action==='p-staff-week')staff.date=shiftStaffDate(staff.date,Number(element.dataset.step));
      if(action==='p-staff-today')staff.date=P.data.home.businessDate;
      return refreshStaff(action==='p-staff-more');
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
  document.addEventListener('change',function(event){if(event.target.id==='staff-calendar-date'&&staff){const value=event.target.value,d=parseDateInput(value);if(d&&toDateInput(d)===value){staff.date=value;refreshStaff(false);}}});
  RENDER.me = renderMe;
})();
