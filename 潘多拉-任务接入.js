"use strict";
/* 真实任务/审批适配。原型只承担布局与临时表单；共享业务状态由后端确认。 */
(function () {
  const P = window.Pandora;
  if (!P) throw new Error("请先加载潘多拉后端接入核心。");
  const originalForm = taskFormView;
  const originalDraft = taskDraftFrom;
  const originalSync = syncTaskDraft;
  const originalPickerConfirm = confirmTaskPicker;
  const originalRunAction = runAction;
  const priorityCode = { "紧急": "urgent", "高": "high", "中": "medium", "低": "low" };
  const priorityName = { urgent: "紧急", high: "高", medium: "中", low: "低" };
  const kindName = { create: "创建任务", change: "修改资料", progress: "更新进展", complete: "提交完成", reopen: "重开任务" };
  const resultName = { pending: "待审核", approved: "已通过", rejected: "已退回", withdrawn: "已撤销", direct: "已生效（免审）", expired: "已失效" };
  const actionForms = new Map();
  const actionPreviews = new Map();
  const reviewContexts = new Map();
  let reopenDraft = null;
  let handoverContext = null;
  let handoverPresetContext = null;
  let formSequence = 0;
  let approvalFilter = "reviewer";

  function me() { return P.data && P.data.me; }
  function session() { return { epoch: P.epoch, user: me() && me().id }; }
  function stillHere(mark) { return mark.epoch === P.epoch && mark.user === (me() && me().id); }
  function newSlot(kind) { formSequence += 1; return "task-ui:" + P.epoch + ":" + kind + ":" + formSequence; }
  function etag(raw) { return '"' + raw.rowVersion + '"'; }
  function taskTag(raw) { const value = etag(raw); P.taskEtags.set(raw.taskId || raw.id, value); return value; }
  function reviewTag(raw) { const value = etag(raw); P.approvalEtags.set(raw.id || raw.requestId, value); return value; }
  function attr(value) { return esc(value); }
  function textField(id, label, value, max, autofocus) {
    return '<div class="field"><label for="' + id + '">' + label + '</label><textarea id="' + id + '" maxlength="' + max + '"' + (autofocus ? ' data-autofocus' : '') + '>' + esc(value || "") + '</textarea></div>';
  }
  function errorBox(id) { return '<div class="callout reject" id="' + id + '" role="alert" hidden></div>'; }
  function personName(id, context) {
    if (!id) return "暂未确定";
    const summaries = context && context.participants || [];
    const known = summaries.find(function (person) { return person.id === id; });
    if (known) return known.displayName || known.name || "相关成员";
    const person = personById(id);
    if (person) return person.name || person.displayName || "相关成员";
    if (me() && id === me().id) return me().displayName || me().name || "本人";
    return "相关成员";
  }
  function peopleText(ids, context) { return (ids || []).map(function (id) { return personName(id, context); }).join("、") || "暂无"; }
  function when(value) {
    if (!value) return "—";
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? "—" : date.getFullYear() + "年" + fmtDateTime(date);
  }
  function taskName(id) { const task = taskById(id); return task ? task.title : "关联任务不可查看"; }
  function requestRows() { return P.data && Array.isArray(P.data.approvals) ? P.data.approvals : []; }
  function filteredRequests(filter) {
    const id = me() && me().id;
    let rows = requestRows();
    if (["reviewer", "reviews", "reviewing"].indexOf(filter) !== -1) rows = rows.filter(function (r) { return r.currentReviewerId === id && r.status === "pending"; });
    else if (["applicant", "self", "submitted"].indexOf(filter) !== -1) rows = rows.filter(function (r) { return r.applicantId === id; });
    return rows.slice().sort(function (a, b) { return String(b.createdAt).localeCompare(String(a.createdAt)); });
  }
  function pendingForTask(id) {
    return requestRows().find(function (r) { return r.taskId === id && r.status === "pending"; });
  }
  function resultMessage(result) {
    return result.outcome === "pending" ? "申请已提交，审核通过后生效。" : result.outcome === "direct" ? "操作已生效。" : result.outcome === "approved" ? "申请已通过。" : result.outcome === "withdrawn" ? "申请已撤销。" : "申请已退回。";
  }
  async function finish(result, mark) {
    if (!stillHere(mark)) return;
    await P.reload();
    if (stillHere(mark)) { closeSheet(); P.notice(resultMessage(result)); }
  }
  function required(value, name, max) {
    const text = String(value == null ? "" : value).trim();
    if (!text || Array.from(text).length > max) throw new Error(name + "须为1至" + max + "字。");
    return text;
  }
  function inputValue(id) { const node = document.getElementById(id); return node ? node.value : ""; }
  function strictDate(value) {
    const date = parseDateInput(value);
    return date && toDateInput(date) === value ? date : null;
  }
  function timedValue(date, time) {
    if (!strictDate(date) || !parseTimeInput(time)) return null;
    const value = parseDateTime(date, time);
    return value && toDateInput(value) === date && toTimeInput(value) === time ? value : null;
  }
  function rawFormDraft(raw, mode, mark) {
    const mapped = P.mapTask(raw);
    const times = defaultTimedTimes(mapped);
    return {
      mode: mode, id: raw.taskId || raw.id, title: mapped.title, desc: mapped.desc,
      acceptanceCriteria: raw.acceptanceCriteria || "", reason: "", allDay: !!raw.allDay,
      startDate: raw.allDay ? raw.startDate : toDateInput(mapped.start), startTime: times.start,
      endDate: raw.allDay ? raw.dueDate : toDateInput(mapped.due), endTime: times.end,
      urgency: mapped.urgency, parentId: raw.parentTaskId || null,
      parentUnavailable: !!raw.parentUnavailable, parentTouched: false,
      assigneeIds: (raw.assigneeIds || []).slice(),
      tagId: Object.prototype.hasOwnProperty.call(raw, 'tagId') ? raw.tagId : null, tagTouched: false,
      etag: taskTag(raw),
      reviewerId: raw.reviewerId || null, mark: mark, slot: newSlot(mode)
    };
  }

  /* 权限只控制界面入口；服务端仍独立检查每次读写。负责人摘要不是派发候选。 */
  window.visibleTasks = function () { return TASKS.slice(); };

  /* Creation/modification candidates come from the server's real company directory (chapter 3.1):
     creation and modification both use every active business member. */
  const candidateCache = { epoch: null, create: null, edit: null };
  let activePickerPurpose = "create";
  function pickerPurpose() { return drafts.task && drafts.task.mode === "edit" ? "edit" : "create"; }
  async function loadCandidates(purpose) {
    const mode = purpose === "edit" ? "edit" : "create";
    if (candidateCache.epoch !== P.epoch) {
      candidateCache.epoch = P.epoch; candidateCache.create = null; candidateCache.edit = null;
    }
    if (!candidateCache[mode]) {
      const data = await P.request("/assignee-candidates?purpose=" + mode);
      P.rememberPeople(data.items || []);
      const people = (data.items || []).map(function (item) { return personById(item.id); }).filter(Boolean);
      if (candidateCache.epoch === P.epoch) candidateCache[mode] = people;
    }
    return candidateCache[mode] || [];
  }
  window.assignablePeople = function (account) {
    if (!account || !me() || account.id !== me().id || account.role === "admin") return [];
    return candidateCache[activePickerPurpose] || [];
  };
  window.assignableDepartments = function (account) {
    const out = [];
    assignablePeople(account).forEach(function (person) { if (out.indexOf(person.dept) === -1) out.push(person.dept); });
    return out;
  };
  window.peopleInDept = function (dept, account) {
    return assignablePeople(account).filter(function (person) { return person.dept === dept; });
  };
  window.openAssigneePicker = function () {
    const account = actor();
    if (!drafts.task) return;
    syncTaskDraft();
    const purpose = pickerPurpose();
    return P.busy(async function () {
      const mark = session();
      await loadCandidates(purpose);
      if (!stillHere(mark)) return;
      activePickerPurpose = purpose;
      const departments = assignableDepartments(account);
      const firstSelected = drafts.task.assigneeIds.map(personById).filter(Boolean)[0];
      assigneePicker.dept = firstSelected && departments.indexOf(firstSelected.dept) !== -1
        ? firstSelected.dept : (departments[0] || "");
      assigneePicker.query = "";
      /* The working copy starts from the draft: switching departments keeps it, cancel discards it. */
      assigneePicker.selected = drafts.task.assigneeIds.slice();
      openSheet(assigneePickerView());
    });
  };
  window.canEditTask = function (account, task) {
    return !!(account && task && account.role !== "admin" && task.businessOwnerId === account.id && !task.frozen && (task.status === "todo" || task.status === "doing"));
  };
  window.canUpdateTaskNote = function (account, task) {
    return !!(account && task && account.role !== "admin" && !task.frozen && task.assigneeIds.indexOf(account.id) !== -1 && (task.status === "todo" || task.status === "doing"));
  };
  function canReopen(task) { return !!(me() && task && task.businessOwnerId === me().id && !task.frozen && task.status === "done"); }
  window.completionReviewer = window.createReviewer = function (task) {
    const id = task && task.raw && task.raw.reviewerId;
    return id ? { id: id, name: personName(id, task.raw) } : null;
  };
  window.pendingReviewCount = function () { return filteredRequests("reviewer").length; };
  window.isOverdue = function (task) {
    return !!(task && task.status !== "done" && task.raw && task.raw.dueAt && new Date(task.raw.dueAt).getTime() < Date.now());
  };
  window.statusBadge = function (task) {
    return '<span class="badge ' + (STATUS_CLASS[task.status] || "b-normal") + '">' + esc(STATUS_LABEL[task.status] || "待开始") + '</span>' + (task.frozen ? '<span class="badge b-pending">审核中</span>' : '');
  };

  /* The fixed placement decides the one-time default of a brand-new draft: an ordinary
     employee starts with themselves as the only assignee, while founder, department head and
     team head start empty. It is only the initial value, so a later removal or cancelled
     selection stays a user decision instead of being corrected back (chapter 3.2). */
  function creationDefaultAssignees() {
    const account = me();
    return account && account.role === "employee" ? [account.id] : [];
  }
  window.taskDraftFrom = function (mode, id) {
    const value = originalDraft(mode, id);
    if (!value) return null;
    if (mode === "create") value.assigneeIds = creationDefaultAssignees();
    const task = id && taskById(id);
    value.acceptanceCriteria = task && task.raw ? task.raw.acceptanceCriteria || "" : "";
    value.reason = "";
    value.parentUnavailable = !!(task && task.raw && task.raw.parentUnavailable);
    value.parentTouched = false;
    value.etag = task && task.raw ? taskTag(task.raw) : null;
    value.reviewerId = task && task.raw && task.raw.reviewerId;
    value.tagId = task && task.raw && Object.prototype.hasOwnProperty.call(task.raw, 'tagId') ? task.raw.tagId : null;
    value.tagTouched = false;
    value.preview = null;
    value.mark = session();
    value.slot = newSlot(mode);
    return value;
  };
  window.syncTaskDraft = function () {
    originalSync();
    if (!drafts.task) return;
    [ ["tf-acceptance", "acceptanceCriteria"], ["tf-reason", "reason"] ].forEach(function (pair) {
      const node = document.getElementById(pair[0]);
      if (node) drafts.task[pair[1]] = node.value;
    });
    // Preserve cleared inputs instead of restoring an older date from the draft.
    [ ["tf-start-date", "startDate"], ["tf-end-date", "endDate"] ].forEach(function (pair) {
      const node = document.getElementById(pair[0]);
      if (node) drafts.task[pair[1]] = node.value;
    });
    // The hour/minute control is two selects, read through the shared helper.
    drafts.task.startTime = P.readTimeControl("tf-start-time") || drafts.task.startTime;
    drafts.task.endTime = P.readTimeControl("tf-end-time") || drafts.task.endTime;
    if (P.readTagSelect) { const tagId = P.readTagSelect("tf"); if (document.getElementById("tf-tag")) { drafts.task.tagId = tagId; drafts.task.tagTouched = true; } }
  };
  function previewHint(preview, kind) {
    if (!preview) return "正在确认本次审核路线…";
    if (preview.error) return "暂时无法确认审核路线：" + preview.error + "。仍可提交，提交时会重新校验。";
    if (preview.blocked) return "审核路线不可用：" + (preview.blockedReason || "请管理员修复组织关系") + "。修复前无法提交。";
    if (preview.requiresApproval) {
      const who = personName(preview.reviewerId, preview.route || {});
      return kind === "creation"
        ? "创建审核人：" + who + "（按创建人的直属上级审核；负责人换序、更换或跨部门都不改变审核人）。"
        : "本次审核人：" + who + "；提交后由该审核人处理。";
    }
    const reason = preview.exemptionReason || (preview.route && preview.route.reasonText) || "申请人即审核人";
    return kind === "creation"
      ? "无需审核：" + reason + "；提交后直接生效。"
      : "直接生效：" + reason + "；提交后记录原因直接生效。";
  }
  function creationMode(mode) { return mode === "create" || mode === "resubmit"; }
  /* Named distinctly: a local `taskFormView` declaration would shadow the captured base function
     (hoisting applies) and `originalForm()` would recurse into itself. */
  function adapterTaskFormView() {
    const draft = drafts.task;
    if (!draft) return null;
    const creation = creationMode(draft.mode);
    const view = originalForm();
    view.title = draft.mode === "create" ? "创建任务" : draft.mode === "resubmit" ? "修改并重新提交" : "编辑任务";
    view.body = view.body.replace('id="tf-title" type="text"', 'id="tf-title" type="text" maxlength="80"')
      .replace('<textarea id="tf-desc">', '<textarea id="tf-desc" maxlength="5000">')
      .replace('说明</label>', '任务说明（必填）</label>')
      .replace('创建时间在保存时单独记录，编辑排期不会改变创建时间。', '全天任务按截止日18:00（组织时区）截止；日历仍展示完整日期。');
    /* One shared single-select tag per task, chosen from the company catalogue (chapter 8.2). */
    if (P.tagSelectHTML) {
      view.body = view.body.replace('<div class="field"><label>紧急程度</label>',
        P.tagSelectHTML("tf", draft.tagId) + '<div class="field"><label>紧急程度</label>');
    }
    /* A creation (and its resubmission) has no completion criterion input. Only a historical task
       keeps the field, so its value can still be displayed, edited and audited (chapter 4.1). */
    if (!creation) {
      view.body = view.body.replace('<div class="field"><label>上级任务（可选）',
        textField("tf-acceptance", "完成标准（历史任务可编辑，最多2000字）", draft.acceptanceCriteria, 2000, false) +
        '<div class="field"><label>上级任务（可选）');
    }
    if (draft.parentUnavailable && !draft.parentTouched && !draft.parentId) {
      view.body = view.body.replace('未指定上级任务', '现有上级任务不可查看，将保留关系')
        .replace('选择上级任务</button>', '选择上级任务</button><button type="button" class="btn tiny-btn ghost" data-action="clear-parent">移除现有关系</button>');
    }
    let extra = draft.mode === "edit" ? textField("tf-reason", "变更原因（必填，最多500字）", draft.reason, 500, false) : "";
    extra += '<div class="callout info">' + esc(previewHint(draft.preview, creation ? "creation" : "non-creation")) + '</div>';
    view.body = view.body.replace('<div class="callout" id="tf-error" hidden></div>', extra + errorBox("tf-error"));
    view.foot = withBack('<button type="button" class="btn primary" data-action="save-task">' +
      (draft.mode === "create" ? '提交任务' : draft.mode === "resubmit" ? '重新提交' : '提交变更') + '</button>');
    view.rebuild = adapterTaskFormView;
    return view;
  }
  window.taskFormView = adapterTaskFormView;
  document.addEventListener('change', function (event) {
    if (!event.target || event.target.id !== 'tf-tag' || !drafts.task) return;
    drafts.task.tagId = event.target.value || null;
    drafts.task.tagTouched = true;
  });
  window.confirmTaskPicker = function () {
    if (taskPicker.kind === "parent" && drafts.task) drafts.task.parentTouched = true;
    originalPickerConfirm();
  };
  async function previewOperation(body) {
    try { return await P.request("/tasks/reviewer-preview", { method: "POST", body: body }); }
    catch (error) { return { error: error.message }; }
  }
  window.openTaskForm = function (mode, id) {
    if (!me() || me().role === "admin") return;
    if (mode === "create") {
      return P.busy(async function () {
        const mark = session();
        const draft = taskDraftFrom("create");
        await loadCandidates("create");
        draft.preview = await previewOperation({ operation: "create" });
        if (!stillHere(mark)) return;
        drafts.task = draft;
        openSheet(taskFormView());
      });
    }
    return P.busy(async function () {
      const mark = session();
      const raw = await P.request("/tasks/" + encodeURIComponent(id));
      if (!stillHere(mark)) return;
      if (!raw.currentVersionId) throw new Error("该任务尚未发布，请从申请详情修改重提。");
      P.upsertTask(raw);
      if (!canEditTask(actor(), taskById(id))) throw new Error(raw.frozen ? "任务正在审核，暂时不能编辑。" : "当前账号不能编辑此任务。");
      const draft = rawFormDraft(raw, "edit", mark);
      await loadCandidates("edit");
      draft.preview = await previewOperation({ operation: "change", taskId: id, assigneeIds: draft.assigneeIds });
      if (!stillHere(mark)) return;
      drafts.task = draft;
      openSheet(taskFormView());
    });
  };
  window.saveTask = function () {
    return P.busy(async function () {
      syncTaskDraft();
      const draft = drafts.task;
      if (!draft || !stillHere(draft.mark)) throw new Error("表单已失效，请重新打开。");
      const creation = creationMode(draft.mode);
      const body = {
        title: required(draft.title, "任务名称", 80), description: required(draft.desc, "任务说明", 5000),
        priority: priorityCode[draft.urgency], allDay: !!draft.allDay, assigneeIds: unique(draft.assigneeIds.slice())
      };
      if (!creation) body.acceptanceCriteria = String(draft.acceptanceCriteria == null ? "" : draft.acceptanceCriteria).trim();
      if (!body.priority) throw new Error("请选择紧急程度。");
      if (!body.assigneeIds.length) throw new Error("至少选择一位负责人。");
      const candidates = candidateCache[creation ? "create" : "edit"];
      if (candidates) {
        const eligible = candidates.map(function (person) { return person.id; });
        if (body.assigneeIds.some(function (id) { return eligible.indexOf(id) === -1; })) throw new Error("负责人已不在可选范围，请重新选择。");
      }
      draft.startTime = P.readTimeControl("tf-start-time") || draft.startTime;
      draft.endTime = P.readTimeControl("tf-end-time") || draft.endTime;
      const start = draft.allDay ? strictDate(draft.startDate) : timedValue(draft.startDate, draft.startTime);
      const due = draft.allDay ? strictDate(draft.endDate) : timedValue(draft.endDate, draft.endTime);
      if (!start || !due || due < start) throw new Error("请填写有效的起止日期和时刻，截止不得早于开始。");
      if (draft.allDay) { body.startDate = draft.startDate; body.dueDate = draft.endDate; }
      else { body.startAt = start.toISOString(); body.dueAt = due.toISOString(); }
      // The tag is part of the version snapshot; a cleared selection is submitted as null.
      body.tagId = draft.tagId || null;
      if (!draft.parentUnavailable || draft.parentTouched) body.parentTaskId = draft.parentId || null;
      if (body.parentTaskId && (body.parentTaskId === draft.id || isDescendant(body.parentTaskId, draft.id))) throw new Error("上级任务不能是自己或自己的子任务。");
      if (draft.mode === "edit") { body.command = "change"; body.reason = required(draft.reason, "变更原因", 500); }
      if (draft.mode === "resubmit") body.command = "create";
      const path = draft.mode === "create" ? "/tasks" : "/tasks/" + encodeURIComponent(draft.id);
      const result = await P.mutation(draft.slot, draft.mode === "create" ? "POST" : "PATCH", path, body, draft.etag);
      await finish(result, draft.mark);
    }, "tf-error");
  };

  function kv(label, value) { return '<span class="k">' + label + '</span><span class="v" style="white-space:pre-wrap">' + esc(value) + '</span>'; }
  function taskLink(id, title, status) {
    return '<button type="button" class="child-task" data-task="' + attr(id) + '"><span class="t-title">' + esc(title) + '</span>' + (status ? '<span class="task-meta">' + esc(STATUS_LABEL[status] || status) + '</span>' : '') + '</button>';
  }
  window.taskDetailView = function (id) {
    const task = taskById(id);
    if (!task || !me()) return null;
    const raw = task.raw || {};
    let body = '<div class="row wrap">' + statusBadge(task) + urgencyBadge(task.urgency) + allDayBadge(task) + kindTag(task, actor()) +
      (raw.tag && P.tagPillHTML ? P.tagPillHTML(raw.tag) : '') + (raw.personalTag && P.tagPillHTML ? P.tagPillHTML(raw.personalTag) : '') + '</div>';
    body += '<div class="kv">' + kv("任务名称", task.title) + kv("创建者", personName(task.creatorId, raw)) + kv("创建时间", when(raw.createdAt)) + kv("当前业务责任方",personName(task.businessOwnerId,raw)) +
      kv("任务排期", fmtSchedule(task)) + kv("截止", when(raw.dueAt) + (isOverdue(task) ? " · 已逾期" : "")) +
      kv("负责人", peopleText(task.assigneeIds, raw)) + kv("审核人", raw.reviewerId ? personName(raw.reviewerId, raw) : "待配置") +
      kv("任务说明", task.desc || "暂无") + (raw.acceptanceCriteria ? kv("完成标准", raw.acceptanceCriteria) : "") + kv("当前进展", task.progressNote || "暂无") + '</div>';
    if (P.personalTagHTML) body += P.personalTagHTML(raw);
    if (raw.parentUnavailable) body += '<div class="callout info">上级任务不可查看。关联关系不扩大访问权限。</div>';
    else if (task.parentId) body += '<div class="divider"></div><div class="card-head"><h2>上级任务</h2></div>' + taskLink(task.parentId, taskName(task.parentId));
    const children = Array.isArray(raw.children) ? raw.children : childrenOf(id).map(function (child) { return { id: child.id, title: child.title, executionState: child.status }; });
    if (children.length) body += '<div class="divider"></div><div class="card-head"><h2>子任务</h2></div><div class="stack">' + children.map(function (child) { return taskLink(child.id, child.title, child.executionState); }).join("") + '</div><p class="tiny muted">父子任务各自推进，完成状态不会自动联动。</p>';
    const siblings = task.parentId ? childrenOf(task.parentId).filter(function (other) { return other.id !== id; }) : [];
    if (siblings.length) body += '<div class="divider"></div><div class="card-head"><h2>同级任务</h2><span class="hint">同一上级任务下</span></div><div class="stack">' + siblings.map(function (other) { return taskLink(other.id, other.title, other.status); }).join("") + '</div>';
    if (Array.isArray(raw.records) && raw.records.length) body += '<div class="divider"></div><div class="card-head"><h2>有效进展与执行记录</h2></div><div class="stack">' + raw.records.map(function (record) {
      return '<article class="log-item"><div class="tiny muted">' + esc((kindName[record.kind] || (record.kind === "return" ? "完成退回" : "执行记录")) + " · " + personName(record.authorId, raw) + " · " + when(record.effectiveAt || record.createdAt)) + '</div><p style="white-space:pre-wrap;overflow-wrap:anywhere">' + esc(record.body) + '</p></article>';
    }).join("") + '</div>';
    const request = pendingForTask(id);
    const requestId = raw.pendingRequestId || request && request.id;
    if (task.frozen) body += '<div class="callout info">该任务有待审核申请。当前展示的是有效版本；审核结束前暂停资料修改、进展、完成及重开操作。</div>';
    const buttons = [];
    if (canEditTask(actor(), task)) buttons.push('<button type="button" class="btn primary" data-action="edit-task" data-id="' + attr(id) + '">编辑任务</button>');
    if (canUpdateTaskNote(actor(), task)) buttons.push('<button type="button" class="btn" data-action="update-note" data-id="' + attr(id) + '">更新进展</button><button type="button" class="btn ok" data-action="submit-complete" data-id="' + attr(id) + '">提交完成</button>');
    if (canReopen(task)) buttons.push('<button type="button" class="btn primary" data-action="p-reopen-task" data-id="' + attr(id) + '">重开任务</button>');
    if (raw.canHandover) buttons.push('<button type="button" class="btn" data-action="p-open-handover" data-id="' + attr(id) + '">专用交接</button>');
    buttons.push('<button type="button" class="btn" data-action="p-toggle-task-pin" data-id="' + attr(id) + '">' + (task.pinned ? '取消置顶' : '置顶到我的月视图') + '</button>');
    if (requestId) buttons.push('<button type="button" class="btn" data-action="p-open-approval" data-id="' + attr(requestId) + '">查看当前申请</button>');
    // Comments are an independent aggregate at the bottom of the detail (chapter 8.4).
    if (P.commentsHTML) body += '<div class="divider"></div>' + P.commentsHTML("task", id);
    if (!buttons.length) buttons.push('<button type="button" class="btn" data-action="sheet-close">关闭</button>');
    return { title: task.title, body: body, foot: withBack(buttons.join("")), taskId: id };
  };
  window.openTaskDetail = function (id) {
    return P.busy(async function () {
      const mark = session();
      const raw = await P.request("/tasks/" + encodeURIComponent(id));
      if (!stillHere(mark)) return;
      taskTag(raw);
      if (!raw.currentVersionId) {
        const requestId = raw.pendingRequestId || raw.latestRequestId;
        if (!requestId) throw new Error("该任务尚未发布。");
        await openApprovalNow(requestId, mark);
        return;
      }
      P.upsertTask(raw);
      const view = taskDetailView(id);
      if (view) openSheet(view);
    });
  };
  P.openTask = window.openTaskDetail;

  /* A reopen must propose a valid schedule. The completed task's old schedule is reused only when it
     is still in the future; otherwise the form starts from a future default (chapter 4.3). */
  function reopenSchedule(task) {
    const allDay = !!task.allDay;
    const startDate = toDateInput(task.start);
    const dueDate = toDateInput(task.due);
    const times = defaultTimedTimes(task);
    if (task.due && task.due.getTime() > Date.now()) {
      return { allDay: allDay, startDate: startDate, startTime: times.start, endDate: dueDate, endTime: times.end };
    }
    const now = new Date();
    const tomorrow = new Date(now.getTime() + 24 * 3600 * 1000);
    return { allDay: false, startDate: toDateInput(now), startTime: "09:00", endDate: toDateInput(tomorrow), endTime: "18:00" };
  }
  function reopenScheduleHTML() {
    const d = reopenDraft;
    return '<div class="field"><label class="checkline" for="rp-allday"><input type="checkbox" id="rp-allday"' + (d.allDay ? " checked" : "") +
      ' />全天（只填写起止日期，起止日期都包含在任务内）</label>' +
      '<div class="row" style="margin-top:6px"><div class="field" style="flex:1"><label for="rp-start-date">开始日期</label>' +
        '<input id="rp-start-date" type="date" value="' + esc(d.startDate) + '" /></div>' +
        '<div class="field" style="flex:1" id="rp-start-time-field"' + (d.allDay ? " hidden" : "") + '><label for="rp-start-time-hour">开始时刻</label>' +
        P.timeControl("rp-start-time", d.startTime) + "</div></div>" +
      '<div class="row" style="margin-top:6px"><div class="field" style="flex:1"><label for="rp-end-date">截止日期</label>' +
        '<input id="rp-end-date" type="date" value="' + esc(d.endDate) + '" /></div>' +
        '<div class="field" style="flex:1" id="rp-end-time-field"' + (d.allDay ? " hidden" : "") + '><label for="rp-end-time-hour">截止时刻</label>' +
        P.timeControl("rp-end-time", d.endTime) + "</div></div></div>";
  }
  function reopenOwnersHTML() {
    const selected=reopenDraft.assigneeIds;
    return '<div class="field"><label for="rp-owner-add">负责人（按添加顺序）</label><ol id="rp-owner-list">'+selected.map((id,index)=>'<li>'+esc(personName(id))+' <button type="button" class="btn tiny-btn" data-action="rp-owner-remove" data-index="'+index+'">移除</button></li>').join('')+'</ol><select id="rp-owner-add"><option value="">选择要添加的员工</option>'+(candidateCache.edit||[]).filter(p=>!selected.includes(p.id)).map(p=>'<option value="'+esc(p.id)+'">'+esc(p.name)+'</option>').join('')+'</select><button type="button" class="btn" data-action="rp-owner-add">添加负责人</button></div>';
  }
  function refreshReopenOwners() {
    const list=document.getElementById('rp-owner-list');if(list)list.closest('.field').outerHTML=reopenOwnersHTML();
  }
  function actionView(command, id) {
    const task = taskById(id);
    if (!task || (command === "reopen" ? !canReopen(task) : !canUpdateTaskNote(actor(), task))) return null;
    const context = { id: id, command: command, etag: taskTag(task.raw), mark: session(), slot: newSlot(command),
      preview: actionPreviews.get(command + ":" + id) || null };
    actionForms.set(command + ":" + id, context);
    const noteId = command === "progress" ? "pf-note" : "cf-note";
    const errorId = command === "progress" ? "pf-error" : command === "complete" ? "cf-error" : "reopen-error";
    const label = command === "progress" ? "本次进展（必填）" : "完成说明（必填）";
    const hint = command === "complete" ? "通过后任务标记为已完成，退回后继续执行；撤销申请保留提交前状态。"
      : "进展也需要审核。通过后更新有效进展，首条有效进展使任务进入进行中。";
    const buttonAction = command === "progress" ? "save-note" : command === "complete" ? "confirm-complete" : "p-confirm-reopen";
    let body;
    if (command === "reopen") {
      reopenDraft = Object.assign(reopenSchedule(task),{assigneeIds:task.assigneeIds.slice()});
      body = '<div class="callout info">当前业务责任方可重开，并同步安排新的有效负责人；保存后进入新执行轮次。</div>' +
        '<div class="callout info">' + esc(previewHint(context.preview, "non-creation")) + '</div>' +
        reopenScheduleHTML() + reopenOwnersHTML() + textField("reopen-reason", "重开原因（必填，最多500字）", "", 500, true) + errorBox(errorId);
    } else {
      body = '<div class="callout info">' + hint + '</div>' +
        '<div class="callout info">' + esc(previewHint(context.preview, "non-creation")) + '</div>' +
        textField(noteId, label, "", 2000, true) + errorBox(errorId);
    }
    return { title: kindName[command], body: body,
      foot: withBack('<button type="button" class="btn primary" data-action="' + buttonAction + '" data-id="' + attr(id) + '">提交</button>') };
  }
  window.noteFormView = function (id) { return actionView("progress", id); };
  window.submitCompleteView = function (id) { return actionView("complete", id); };
  function openAction(command, id) {
    return P.busy(async function () {
      const mark = session();
      const raw = await P.request("/tasks/" + encodeURIComponent(id));
      if (!stillHere(mark)) return;
      if (!raw.currentVersionId) throw new Error("任务尚未发布，不能执行该操作。");
      P.upsertTask(raw);
      if(command==="reopen")await loadCandidates("edit");
      actionPreviews.set(command + ":" + id, await previewOperation({ taskId: id, operation: command }));
      if (!stillHere(mark)) return;
      const view = actionView(command, id);
      if (!view) throw new Error(raw.frozen ? "任务正在审核，暂时不能操作。" : "当前账号不能执行此操作。");
      openSheet(view);
    });
  }
  function saveAction(command, id) {
    const field = command === "progress" ? "pf-note" : command === "complete" ? "cf-note" : "reopen-reason";
    const errorId = command === "progress" ? "pf-error" : command === "complete" ? "cf-error" : "reopen-error";
    return P.busy(async function () {
      const context = actionForms.get(command + ":" + id);
      if (!context || !stillHere(context.mark)) throw new Error("操作表单已失效，请重新打开。");
      const body = { command: command };
      if (command === "reopen") {
        body.reason = required(inputValue("reopen-reason"), "重开原因", 500);
        body.assigneeIds=reopenDraft.assigneeIds.slice();
        if(!body.assigneeIds.length)throw new Error("重开须选择至少一位有效负责人。");
        const draft = reopenDraft;
        if (!draft) throw new Error("重开表单已失效，请重新打开。");
        draft.allDay = !!(document.getElementById("rp-allday") || {}).checked;
        const startText = inputValue("rp-start-date");
        const dueText = inputValue("rp-end-date");
        const start = draft.allDay ? strictDate(startText) : timedValue(startText, P.readTimeControl("rp-start-time"));
        const due = draft.allDay ? strictDate(dueText) : timedValue(dueText, P.readTimeControl("rp-end-time"));
        if (!start || !due || due < start) throw new Error("请填写有效的重开起止日期和时刻，截止不得早于开始。");
        if (draft.allDay) { body.allDay = true; body.startDate = startText; body.dueDate = dueText; }
        else { body.allDay = false; body.startAt = start.toISOString(); body.dueAt = due.toISOString(); }
      } else {
        body[command === "progress" ? "progressNote" : "completionNote"] =
          required(inputValue(field), command === "complete" ? "完成说明" : "进展", 2000);
      }
      const result = await P.mutation(context.slot, "PATCH", "/tasks/" + encodeURIComponent(id), body, context.etag);
      await finish(result, context.mark);
      actionForms.delete(command + ":" + id);
    }, errorId);
  }
  window.saveNote = function (id) { return saveAction("progress", id); };
  window.confirmComplete = function (id) { return saveAction("complete", id); };

  P.renderApprovalsHTML = function (filter) {
    const rows = filteredRequests(filter);
    if (!rows.length) return '<div class="empty">' + (["reviewer", "reviews", "reviewing"].indexOf(filter) !== -1 ? '暂无待你审核的申请' : '暂无申请记录') + '</div>';
    return '<div class="stack">' + rows.map(function (request) {
      const pending = request.status === "pending";
      return '<button type="button" class="task-item" data-action="p-open-approval" data-id="' + attr(request.id || request.requestId) + '"><span class="t-title">' + esc(request.title || "任务申请") + '</span><span class="task-meta"><span class="badge ' + (pending ? 'b-pending' : request.status === "rejected" ? 'b-reject' : 'b-normal') + '">' + esc(resultName[request.status] || request.status) + '</span><span>' + esc(kindName[request.kind] || request.kind) + '</span><span>申请人：' + esc(personName(request.applicantId, request)) + '</span></span><span class="tiny muted">' + esc(when(request.createdAt)) + '</span></button>';
    }).join("") + '</div>';
  };
  function approvalsView(only) {
    const mine = filteredRequests("applicant").length;
    const waiting = filteredRequests("reviewer").length;
    if (only === "applicant") {
      return { title: "我的申请", body: '<div class="card-head"><h2>我提交的申请</h2><span class="hint">' + mine + ' 项</span></div>' + P.renderApprovalsHTML("applicant"), foot: withBack('<button type="button" class="btn" data-action="sheet-close">关闭</button>'), rebuild: function () { return approvalsView("applicant"); } };
    }
    return { title: "任务申请", body: '<div class="choice-row"><button type="button" class="choice" data-action="p-approval-filter" data-filter="reviewer" aria-pressed="' + (approvalFilter === "reviewer") + '">待我审核 ' + waiting + '</button><button type="button" class="choice" data-action="p-approval-filter" data-filter="applicant" aria-pressed="' + (approvalFilter === "applicant") + '">我提交的申请 ' + mine + '</button></div>' + P.renderApprovalsHTML(approvalFilter), foot: withBack('<button type="button" class="btn" data-action="sheet-close">关闭</button>'), rebuild: approvalsView };
  }
  P.openApprovals = function (filter) {
    if (filter === "applicant" || filter === "reviewer") approvalFilter = filter;
    openSheet(approvalsView(filter === "applicant" ? "applicant" : null));
  };
  P.openMyApplications = function () { P.openApprovals("applicant"); };

  function snapshotHTML(snapshot, request) {
    if (!snapshot) return '<div class="empty">尚无有效版本</div>';
    let schedule = snapshot.allDay ? snapshot.startDate + " 至 " + snapshot.dueDate + "（全天；截止日18:00）" : when(snapshot.startAt) + " → " + when(snapshot.dueAt);
    return '<div class="kv">' + kv("名称", snapshot.title) + kv("任务说明", snapshot.description) + kv("完成标准", snapshot.acceptanceCriteria) + kv("负责人", peopleText(snapshot.assigneeIds, request)) + kv("排期", schedule) + kv("紧急程度", priorityName[snapshot.priority] || snapshot.priority) + kv("执行状态", STATUS_LABEL[snapshot.executionState] || snapshot.executionState) + kv("进展", snapshot.progressNote || "暂无") + kv("上级任务", snapshot.parentUnavailable ? "关联任务不可查看" : snapshot.parentTaskId ? taskName(snapshot.parentTaskId) : "无") + '</div>';
  }
  const diffLabels = { title: "名称", description: "任务说明", acceptanceCriteria: "完成标准", assigneeIds: "负责人",
    allDay: "全天标记", startAt: "开始时间", dueAt: "截止时间", startDate: "开始日期", dueDate: "截止日期",
    priority: "紧急程度", executionState: "执行状态", progressNote: "进展", parentTaskId: "上级任务" };
  function diffText(field, value, request) {
    if (field === "assigneeIds") {
      const ids = String(value == null ? "" : value).split(",").map(function (v) { return v.trim(); }).filter(Boolean);
      return ids.length ? peopleText(ids, request) : "无";
    }
    if (field === "allDay") return String(value) === "true" || value === true ? "是" : "否";
    if (field === "priority") return priorityName[value] || String(value) || "空";
    if (field === "executionState") return STATUS_LABEL[value] || String(value) || "空";
    return value === null || value === undefined || value === "" ? "空" : String(value);
  }
  /* The reviewer comparison renders the backend's authorized per-field diff instead of recomputing it.
     A pure assignee reorder therefore stays visible, and a creation reorder is never described as a
     changed creation reviewer. Applicants and viewers receive no diff array at all (chapter 4.6). */
  function differenceHTML(request) {
    const changes = Array.isArray(request && request.diff) ? request.diff : [];
    if (!changes.length) {
      return request && request.baseVersionId ? '<div class="callout info">本次提交没有改变可比较的字段。</div>' : "";
    }
    return '<div class="card-head"><h2>本次授权差异</h2><span class="hint">仅本次审核人可见</span></div><div class="kv">' +
      changes.map(function (change) {
        const label = diffLabels[change.field] || change.field;
        return kv(label, diffText(change.field, change.before, request) + " → " + diffText(change.field, change.after, request));
      }).join("") + "</div>";
  }
  function approvalDetailView(request) {
    const id = request.id || request.requestId;
    const pending = request.status === "pending";
    let body = '<div class="row wrap"><span class="badge ' + (pending ? 'b-pending' : 'b-normal') + '">' + esc(resultName[request.status] || request.status) + '</span><span>' + esc(kindName[request.kind] || request.kind) + '</span></div>';
    body += '<div class="kv">' + kv("申请人", personName(request.applicantId, request)) + kv("当前审核人", request.currentReviewerId ? personName(request.currentReviewerId, request) : "待配置") + kv("申请时间", when(request.createdAt)) + (request.decidedAt ? kv("处理时间", when(request.decidedAt)) : '') + '</div>';
    if (request.exemptionReason) body += '<div class="callout info">免审原因：' + esc(request.exemptionReason) + '</div>';
    if (request.comment) body += '<div class="callout ' + (request.status === "rejected" ? 'reject' : 'info') + '" style="white-space:pre-wrap">处理意见：' + esc(request.comment) + '</div>';
    body += differenceHTML(request) + '<div class="card-head"><h2>' + (pending ? '申请快照' : '本次提交内容') + '</h2></div>' + snapshotHTML(request.proposedVersion, request);
    if (request.baseVersion) body += '<details style="margin-top:12px"><summary>查看申请前有效版本</summary>' + snapshotHTML(request.baseVersion, request) + '</details>';
    if (request.records && request.records.length) body += '<div class="divider"></div><div class="card-head"><h2>申请说明</h2></div>' + request.records.map(function (record) { return '<div class="callout" style="white-space:pre-wrap">' + esc(record.body) + '</div>'; }).join("");
    body += errorBox("approval-error");
    const buttons = [];
    if (pending && request.currentReviewerId === me().id) buttons.push('<button type="button" class="btn ok" data-action="p-approve-request" data-id="' + attr(id) + '">通过</button><button type="button" class="btn danger" data-action="p-reject-request" data-id="' + attr(id) + '">退回</button>');
    if (pending && request.applicantId === me().id) buttons.push('<button type="button" class="btn" data-action="p-withdraw-request" data-id="' + attr(id) + '">撤销申请</button>');
    if (!pending && request.kind === "create" && ["rejected", "withdrawn", "expired"].indexOf(request.status) !== -1 && request.applicantId === me().id) buttons.push('<button type="button" class="btn primary" data-action="p-resubmit-create" data-id="' + attr(id) + '">修改并重提</button>');
    if (!buttons.length) buttons.push('<button type="button" class="btn" data-action="sheet-close">关闭</button>');
    return { title: kindName[request.kind] + " · " + (request.proposedVersion.title || "申请详情"), body: body, foot: withBack(buttons.join("")), approvalId: id };
  }
  async function openApprovalNow(id, mark) {
    const request = await P.request("/approval-requests/" + encodeURIComponent(id));
    if (!stillHere(mark)) return;
    reviewContexts.set(id, { request: request, etag: reviewTag(request), mark: mark, slot: newSlot("review:" + id) });
    openSheet(approvalDetailView(request));
  }
  P.openApproval = function (id) { return P.busy(async function () { await openApprovalNow(id, session()); }); };
  function decisionForm(id, decision) {
    const context = reviewContexts.get(id);
    if (!context || !stillHere(context.mark)) throw new Error("审批详情已失效，请重新打开。");
    const request = context.request;
    if (request.status !== "pending") throw new Error("该申请已处理。");
    if (decision === "withdraw" ? request.applicantId !== me().id : request.currentReviewerId !== me().id) throw new Error("当前账号不能执行此操作。");
    const withdraw = decision === "withdraw";
    return { title: withdraw ? "撤销申请" : "退回申请", body: '<div class="callout info">' + (withdraw ? '撤销后本次申请不会生效，任务保持申请前的有效内容。' : request.kind === "complete" ? '退回完成申请后任务进入进行中，请说明仍需处理的事项。' : '退回后保留原有效内容；创建申请不会进入普通任务列表。') + '</div>' + (withdraw ? '' : textField("review-comment", "退回原因（必填）", "", 2000, true)) + errorBox("review-decision-error"), foot: withBack('<button type="button" class="btn danger" data-action="p-confirm-decision" data-decision="' + decision + '" data-id="' + attr(id) + '">' + (withdraw ? '确认撤销' : '确认退回') + '</button>') };
  }
  function decide(id, decision, suppliedComment) {
    return P.busy(async function () {
      const context = reviewContexts.get(id);
      if (!context || !stillHere(context.mark)) throw new Error("审批详情已失效，请重新打开。");
      const body = { decision: decision };
      if (decision === "reject") body.comment = required(suppliedComment == null ? inputValue("review-comment") : suppliedComment, "退回原因", 2000);
      const result = await P.mutation(context.slot + ":" + decision, "PATCH", "/approval-requests/" + encodeURIComponent(id), body, context.etag);
      await finish(result, context.mark);
      reviewContexts.delete(id);
    }, decision === "approve" ? "approval-error" : "review-decision-error");
  }
  function resubmitCreate(id) {
    return P.busy(async function () {
      const mark = session();
      const request = await P.request("/approval-requests/" + encodeURIComponent(id));
      if (!stillHere(mark)) return;
      if (request.applicantId !== me().id || request.kind !== "create" || ["rejected", "withdrawn", "expired"].indexOf(request.status) === -1) throw new Error("该申请不能修改重提。");
      const raw = await P.request("/tasks/" + encodeURIComponent(request.taskId));
      if (!stillHere(mark)) return;
      if (raw.currentVersionId) throw new Error("任务已发布，请从有效任务详情编辑。");
      if (raw.pending) throw new Error("该任务已有新的待审核申请。");
      const draftRaw = Object.assign({}, raw.proposedVersion || request.proposedVersion, { id: request.taskId, taskId: request.taskId, originalCreatorId: me().id, rowVersion: raw.rowVersion, reviewerId: request.currentReviewerId });
      const draft = rawFormDraft(draftRaw, "resubmit", mark);
      await loadCandidates("create");
      draft.preview = await previewOperation({ operation: "create", taskId: request.taskId });
      if (!stillHere(mark)) return;
      drafts.task = draft;
      openSheet(taskFormView());
    });
  }

  /* 旧入口全部转向请求级审核，不再修改原型数组。 */
  function legacyRequest(id, decision) {
    const request = requestRows().find(function (row) { return (row.taskId === id || row.id === id) && row.status === "pending"; });
    if (!request) { P.notice("没有可处理的待审核申请，请刷新申请列表。"); return; }
    return P.openApproval(request.id);
  }
  window.approveCreate = window.approveComplete = function (id) { return legacyRequest(id, "approve"); };
  window.rejectTask = function (_kind, id, reason) {
    const request = requestRows().find(function (row) { return (row.taskId === id || row.id === id) && row.status === "pending"; });
    if (!request || !reviewContexts.has(request.id)) return legacyRequest(id, "reject");
    return decide(request.id, "reject", reason);
  };
  window.rejectFormView = function (_kind, id) {
    const request = requestRows().find(function (row) { return (row.taskId === id || row.id === id) && row.status === "pending"; });
    if (request && reviewContexts.has(request.id)) return decisionForm(request.id, "reject");
    return { title: "查看审核申请", body: '<div class="callout info">请先打开申请快照后处理。</div>', foot: request ? '<button type="button" class="btn primary" data-action="p-open-approval" data-id="' + attr(request.id) + '">打开申请</button>' : '<button type="button" class="btn" data-action="sheet-close">关闭</button>' };
  };
  function togglePin(id) {
    const task = taskById(id);
    if (!task) return;
    const next = !task.pinned;
    return P.busy(async function () {
      await P.mutation("pin:" + id, next ? "PUT" : "DELETE", "/tasks/" + encodeURIComponent(id) + "/pin", null, null);
      await P.reload();
      const view = taskDetailView(id);
      if (view) replaceTopSheet(view);
      P.notice(next ? "已置顶到我的月视图。" : "已取消置顶。");
    });
  }

  function selectedHandoverTarget(source) {
    const node = document.querySelector('[data-handover-target="' + source + '"]');
    return node ? node.value : "";
  }
  function handoverOwners(raw, source, target) {
    const owners = (raw.assigneeIds || []).slice();
    const index = owners.indexOf(source);
    if (index >= 0) owners[index] = target;
    return owners;
  }
  function requestHandoverPreview(taskId, owners) {
    // A handover is not a business-owner edit: without the explicit operation the preview validates
    // the change rule and reports "applicant no longer allowed" for the owner who is only handing over.
    return P.request("/tasks/reviewer-preview", { method: "POST", body: { taskId: taskId, assigneeIds: owners, operation: "handover" } });
  }
  function handoverPreviewText(preview) {
    if (!preview) return "正在计算审核人…";
    if (preview.error) return "暂时无法计算审核人：" + preview.error;
    if (preview.requiresApproval) {
      return "审核人：" + personName(preview.reviewerId, preview.route || {}) + "（提交后由该审核人处理）";
    }
    const reason = preview.route && preview.route.reasonText ? preview.route.reasonText : "申请人即审核人";
    return "无需审核人：" + reason + "；提交后直接生效。";
  }
  function handoverPreviewFor(ctx, source) {
    const chosen = ctx.selected[source];
    const entry = ctx.previews[source];
    return entry && entry.target === chosen ? entry.data : null;
  }
  function refreshHandoverPreview(source) {
    const ctx = handoverContext;
    if (!ctx) return;
    const target = selectedHandoverTarget(source);
    ctx.selected[source] = target;
    const seq = (ctx.previewSeq[source] || 0) + 1;
    ctx.previewSeq[source] = seq;
    const current = function () {
      return handoverContext === ctx ? document.getElementById("ho-preview-" + source) : null;
    };
    const loading = current();
    if (!target) {
      ctx.previews[source] = { target: "", data: { error: "没有可用的交接对象" } };
      if (loading) loading.textContent = "没有可用的交接对象";
      return;
    }
    if (loading) loading.textContent = "正在计算审核人…";
    requestHandoverPreview(ctx.taskId, handoverOwners(ctx.raw, source, target)).then(function (preview) {
      if (handoverContext !== ctx || ctx.previewSeq[source] !== seq) return;
      ctx.previews[source] = { target: target, data: preview };
      // Re-read the live element: saving the preset re-renders the form while this request is in
      // flight, so updating the pre-save element would leave the visible form on the old reviewer.
      const live = current();
      if (live) live.textContent = handoverPreviewText(preview);
    }).catch(function (error) {
      if (handoverContext !== ctx || ctx.previewSeq[source] !== seq) return;
      const failed = { error: error.message };
      ctx.previews[source] = { target: target, data: failed };
      const live = current();
      if (live) live.textContent = handoverPreviewText(failed);
    });
  }
  function handoverFormView() {
    const ctx = handoverContext;
    if (!ctx) return null;
    const cards = ctx.sources.map(function (source) {
      const preset = ctx.presets[source];
      const chosen = ctx.selected[source] || preset;
      const targets = ctx.targets[source] || [];
      let options = targets.map(function (person) {
        return '<option value="' + attr(person.id) + '"' + (person.id === chosen ? ' selected' : '') + '>' +
          esc(person.displayName) + (person.departmentName ? ' · ' + esc(person.departmentName) : '') + '</option>';
      }).join("");
      if (!options) options = '<option value="">没有可用的交接对象</option>';
      return '<section class="card"><div class="card-head"><h2>' + esc(personName(source, ctx.raw)) + '</h2><span class="hint">' +
        (preset ? '已保存预设' : '专用交接') + '</span></div>' +
        '<div class="field"><label for="ho-target-' + attr(source) + '">交接对象</label><select id="ho-target-' + attr(source) +
        '" data-handover-target="' + attr(source) + '">' + options + '</select></div>' +
        '<div class="callout info" id="ho-preview-' + attr(source) + '" aria-live="polite">' +
        esc(handoverPreviewText(handoverPreviewFor(ctx, source))) + '</div>' +
        '<div class="row wrap"><button type="button" class="btn ghost" data-action="p-save-handover-preset" data-id="' + attr(source) + '">保存为预设</button>' +
        '<button type="button" class="btn primary" data-action="p-confirm-handover" data-id="' + attr(source) + '">发起专用交接</button></div></section>';
    }).join("");
    return {
      title: "专用交接",
      body: cards + textField("ho-reason", "交接原因（选填）", "", 500) +
        '<p class="tiny muted">交接只替换该负责人在有序列表中的位置，不改标题、排期或基础字段；新路线审核通过后生效。</p>' +
        errorBox("handover-error"),
      foot: withBack('<button type="button" class="btn" data-action="sheet-close">关闭</button>')
    };
  }
  function openHandoverSheet(taskId) {
    return P.busy(async function () {
      const mark = session();
      const raw = await P.request("/tasks/" + encodeURIComponent(taskId));
      if (!stillHere(mark)) return;
      const sources = (raw.handoverSources || []).slice();
      if (!sources.length) { P.notice("当前账号没有该任务的专用交接权限。"); return; }
      const targets = {}, selected = {}, previews = {};
      const presets = raw.handoverPresets || {};
      for (const source of sources) {
        const data = await P.request("/handover-targets?subjectId=" + encodeURIComponent(source));
        if (!stillHere(mark)) return;
        targets[source] = data.items || [];
        const preset = presets[source];
        selected[source] = targets[source].some(function (person) { return person.id === preset; })
          ? preset : (targets[source][0] ? targets[source][0].id : "");
        previews[source] = {
          target: selected[source],
          data: selected[source]
            ? await requestHandoverPreview(taskId, handoverOwners(raw, source, selected[source]))
            : { error: "没有可用的交接对象" }
        };
        if (!stillHere(mark)) return;
      }
      handoverContext = { taskId: taskId, raw: raw, etag: taskTag(raw), sources: sources,
        targets: targets, presets: presets, selected: selected, previews: previews, previewSeq: {}, mark: mark };
      openSheet(handoverFormView());
    });
  }
  function saveHandoverPresetForSource(source) {
    return P.busy(async function () {
      const ctx = handoverContext;
      if (!ctx || !stillHere(ctx.mark)) throw new Error("交接表单已失效，请重新打开。");
      const target = selectedHandoverTarget(source);
      if (!target) throw new Error("请选择交接对象。");
      await P.mutation("handover-preset:" + ctx.taskId + ":" + source, "PUT",
        "/users/" + encodeURIComponent(source) + "/handover-preset", { targetUserId: target }, null);
      ctx.presets[source] = target;
      ctx.selected[source] = target;
      replaceTopSheet(handoverFormView());
      P.notice("交接预设已保存。");
    }, "handover-error");
  }
  function confirmHandover(source) {
    return P.busy(async function () {
      const ctx = handoverContext;
      if (!ctx || !stillHere(ctx.mark)) throw new Error("交接表单已失效，请重新打开。");
      const target = selectedHandoverTarget(source);
      if (!target) throw new Error("请选择交接对象。");
      const reason = (inputValue("ho-reason") || "").trim();
      const result = await P.mutation("handover:" + ctx.taskId + ":" + source, "POST",
        "/tasks/" + encodeURIComponent(ctx.taskId) + "/handover",
        { sourceUserId: source, targetUserId: target, reason: reason || "专用交接" }, ctx.etag);
      await P.reload();
      if (!stillHere(ctx.mark)) return;
      handoverContext = null;
      closeSheet();
      P.notice(resultMessage(result));
    }, "handover-error");
  }
  function handoverPresetView() {
    const ctx = handoverPresetContext;
    if (!ctx) return null;
    const current = ctx.preset && ctx.preset.targetUserId;
    let options = ctx.targets.map(function (person) {
      return '<option value="' + attr(person.id) + '"' + (person.id === current ? ' selected' : '') + '>' +
        esc(person.displayName) + (person.departmentName ? ' · ' + esc(person.departmentName) : '') + '</option>';
    }).join("");
    if (!options) options = '<option value="">没有可用的交接对象</option>';
    const clear = current ? '<button type="button" class="btn danger" data-action="p-clear-handover-preset">清除预设</button>' : '';
    return {
      title: "交接预设",
      body: '<div class="callout info">预设仅用于专用交接申请；负责人变更仍按新路线审核后生效，不能修改标题、排期等基础字段。</div>' +
        '<div class="field"><label for="hp-target">预设交接对象（' + esc(ctx.subjectName) + '）</label><select id="hp-target">' + options + '</select></div>' +
        (current ? '<p class="tiny muted">当前预设：' + esc((ctx.preset.target && ctx.preset.target.displayName) || "已保存") + '</p>'
          : '<p class="tiny muted">尚未保存预设。</p>') + errorBox("handover-preset-error"),
      foot: withBack(clear + '<button type="button" class="btn primary" data-action="p-save-handover-preset-sheet">保存预设</button>' +
        '<button type="button" class="btn" data-action="sheet-close">关闭</button>')
    };
  }
  P.openHandoverPreset = function (subjectId, subjectNameArg) {
    return P.busy(async function () {
      const mark = session();
      const preset = await P.request("/users/" + encodeURIComponent(subjectId) + "/handover-preset");
      const data = await P.request("/handover-targets?subjectId=" + encodeURIComponent(subjectId));
      if (!stillHere(mark)) return;
      handoverPresetContext = { subjectId: subjectId,
        subjectName: subjectNameArg || (personById(subjectId) && personById(subjectId).name) || "该员工",
        preset: preset, targets: data.items || [], mark: mark };
      openSheet(handoverPresetView());
    });
  };
  function saveHandoverPresetSheet() {
    return P.busy(async function () {
      const ctx = handoverPresetContext;
      if (!ctx || !stillHere(ctx.mark)) throw new Error("交接预设表单已失效，请重新打开。");
      const target = (document.getElementById("hp-target") || {}).value;
      if (!target) throw new Error("请选择交接对象。");
      await P.mutation("handover-preset-sheet:" + ctx.subjectId, "PUT",
        "/users/" + encodeURIComponent(ctx.subjectId) + "/handover-preset", { targetUserId: target }, null);
      ctx.preset = await P.request("/users/" + encodeURIComponent(ctx.subjectId) + "/handover-preset");
      replaceTopSheet(handoverPresetView());
      P.notice("交接预设已保存。");
    }, "handover-preset-error");
  }
  function clearHandoverPresetSheet() {
    return P.busy(async function () {
      const ctx = handoverPresetContext;
      if (!ctx || !stillHere(ctx.mark)) throw new Error("交接预设表单已失效，请重新打开。");
      await P.mutation("handover-preset-clear:" + ctx.subjectId, "DELETE",
        "/users/" + encodeURIComponent(ctx.subjectId) + "/handover-preset", null, null);
      ctx.preset = { userId: ctx.subjectId, targetUserId: null, target: null, rowVersion: 0 };
      replaceTopSheet(handoverPresetView());
      P.notice("交接预设已清除。");
    }, "handover-preset-error");
  }

  window.runAction = function (element) {
    if(element.dataset.action==='rp-owner-add'&&reopenDraft){const id=inputValue('rp-owner-add');if(id&&!reopenDraft.assigneeIds.includes(id))reopenDraft.assigneeIds.push(id);refreshReopenOwners();return;}
    if(element.dataset.action==='rp-owner-remove'&&reopenDraft){reopenDraft.assigneeIds.splice(Number(element.dataset.index),1);refreshReopenOwners();return;}

    const action = element.dataset.action, id = element.dataset.id;
    if (action === "p-open-handover") return openHandoverSheet(id);
    if (action === "p-open-handover-preset") return P.openHandoverPreset(id, element.dataset.name);
    if (action === "p-confirm-handover") return confirmHandover(id);
    if (action === "p-save-handover-preset") return saveHandoverPresetForSource(id);
    if (action === "p-save-handover-preset-sheet") return saveHandoverPresetSheet();
    if (action === "p-clear-handover-preset") return clearHandoverPresetSheet();
    if (action === "clear-parent" && drafts.task) drafts.task.parentTouched = true;
    if (action === "p-open-approval") return P.openApproval(id);
    if (action === "p-open-approvals") return P.openApprovals();
    if (action === "p-approval-filter") { approvalFilter = element.dataset.filter === "applicant" ? "applicant" : "reviewer"; replaceTopSheet(approvalsView()); return; }
    if (action === "update-note") return openAction("progress", id);
    if (action === "submit-complete") return openAction("complete", id);
    if (action === "p-reopen-task") return openAction("reopen", id);
    if (action === "p-toggle-task-pin") return togglePin(id);
    if (action === "p-confirm-reopen") return saveAction("reopen", id);
    if (action === "p-approve-request") return decide(id, "approve");
    if (action === "p-reject-request" || action === "p-withdraw-request") {
      try { openSheet(decisionForm(id, action === "p-reject-request" ? "reject" : "withdraw")); }
      catch (error) { P.notice(error.message); }
      return;
    }
    if (action === "p-confirm-decision") return decide(id, element.dataset.decision);
    if (action === "p-resubmit-create") return resubmitCreate(id);
    return originalRunAction(element);
  };

  // Target changes must refresh the actual proposed reviewer before submission; the preview is only a
  // display, the submit transaction still recomputes the route.
  document.addEventListener("change", function (event) {
    const target = event.target;
    if (!target) return;
    /* The reopen all-day switch only changes which schedule inputs are visible; both values stay in
       the draft so toggling back never loses the entered time. */
    if (target.id === "rp-allday" && reopenDraft) {
      reopenDraft.allDay = !!target.checked;
      const startField = document.getElementById("rp-start-time-field");
      const endField = document.getElementById("rp-end-time-field");
      if (startField) startField.hidden = reopenDraft.allDay;
      if (endField) endField.hidden = reopenDraft.allDay;
      return;
    }
    if (typeof target.closest !== "function") return;
    const select = target.closest("[data-handover-target]");
    if (select) refreshHandoverPreview(select.dataset.handoverTarget);
  });
})();
