"use strict";
/* =====================================================================
   潘多拉移动端交互原型
   单文件、无外部依赖、不使用浏览器本地存储。
   数据保存在内存中，刷新页面即恢复到种子数据。
   ===================================================================== */

/* ------------------------------ 时间工具 ------------------------------ */
const DAY = 24 * 60 * 60 * 1000;
const LOAD_AT = new Date();
const BASE_DAY = new Date(LOAD_AT.getFullYear(), LOAD_AT.getMonth(), LOAD_AT.getDate());

function at(dayOffset, hour, minute){
  return new Date(BASE_DAY.getFullYear(), BASE_DAY.getMonth(), BASE_DAY.getDate() + dayOffset, hour, minute || 0, 0, 0);
}
function pad2(n){ return n < 10 ? "0" + n : "" + n; }
function startOfDay(d){ return new Date(d.getFullYear(), d.getMonth(), d.getDate()); }
function sameDay(a, b){ return startOfDay(a).getTime() === startOfDay(b).getTime(); }
function dayDiff(a, b){ return Math.round((startOfDay(a) - startOfDay(b)) / DAY); }
function fmtDate(d){ return (d.getMonth() + 1) + "月" + d.getDate() + "日"; }
function fmtDateTime(d){ return fmtDate(d) + " " + pad2(d.getHours()) + ":" + pad2(d.getMinutes()); }
function fmtTime(d){ return pad2(d.getHours()) + ":" + pad2(d.getMinutes()); }
function relativeDayLabel(d){
  const diff = dayDiff(d, BASE_DAY);
  if (diff === 0) return "今天";
  if (diff === 1) return "明天";
  if (diff === -1) return "昨天";
  if (diff === 2) return "后天";
  return diff > 0 ? diff + "天后" : Math.abs(diff) + "天前";
}
function fmtDue(d){
  const diff = dayDiff(d, BASE_DAY);
  if (diff === 0) return "今天 " + fmtTime(d) + " 截止";
  if (diff === 1) return "明天 " + fmtTime(d) + " 截止";
  if (diff === -1) return "昨天 " + fmtTime(d) + " 截止";
  return fmtDate(d) + " " + fmtTime(d) + " 截止";
}
function isOverdue(t){
  return t.type === "normal" && t.status !== "done" && t.status !== "rejected" && t.due.getTime() < LOAD_AT.getTime();
}
function toDateInput(d){ return d.getFullYear() + "-" + pad2(d.getMonth() + 1) + "-" + pad2(d.getDate()); }
function toTimeInput(d){ return pad2(d.getHours()) + ":" + pad2(d.getMinutes()); }
function esc(s){
  return String(s == null ? "" : s).replace(/[&<>"']/g, function(c){
    return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
  });
}

/* ------------------------------ 种子数据 ------------------------------ */
const PEOPLE = [
  { id: "u1", name: "王海（总经理）",   role: "upper",  dept: "公司管理层", superiorId: null },
  { id: "m1", name: "李敏（产品经理）", role: "middle", dept: "产品部",     superiorId: "u1" },
  { id: "e1", name: "张涛",             role: "lower",  dept: "产品部",     superiorId: "m1" },
  { id: "e2", name: "赵蕾",             role: "lower",  dept: "产品部",     superiorId: "m1" },
  { id: "m2", name: "陈冲（市场经理）", role: "middle", dept: "市场部",     superiorId: "u1" },
  { id: "e3", name: "孙悦",             role: "lower",  dept: "市场部",     superiorId: "m2" }
];
const ROLE_LABEL = { upper: "上层", middle: "中层", lower: "下层" };
const ROLE_ACCOUNT = { upper: "u1", middle: "m1", lower: "e1" };

const URGENCY_ORDER = { "紧急": 0, "高": 1, "中": 2, "低": 3 };
const STATUS_LABEL = {
  "pending-create": "待创建审核",
  "todo": "待开始",
  "doing": "进行中",
  "pending-complete": "待完成审核",
  "done": "已完成",
  "rejected": "已拒绝"
};
const STATUS_CLASS = {
  "pending-create": "b-pending",
  "todo": "b-normal",
  "doing": "b-brand",
  "pending-complete": "b-pending",
  "done": "b-ok",
  "rejected": "b-reject"
};
function urgencyClass(u){
  return u === "紧急" ? "b-urgent" : u === "高" ? "b-high" : u === "低" ? "b-low" : "b-normal";
}

function mkTask(o){
  return Object.assign({
    id: "", type: "normal", parentId: null, title: "", desc: "",
    creatorId: "", assigneeIds: [], selfCreated: false,
    start: at(-3, 9, 0), due: at(7, 18, 0), urgency: "中",
    status: "todo", progress: 0, progressNote: "", reviewNote: ""
  }, o);
}

const TASKS = [
  mkTask({ id: "t1", type: "abstract", title: "尝试涉足新产品", desc: "抽象任务：需由若干普通任务组成，不可直接执行。",
    creatorId: "u1", assigneeIds: [], start: at(-12, 9, 0), due: at(45, 18, 0), urgency: "中", status: "doing" }),

  mkTask({ id: "t2", parentId: "t1", title: "开辟北交校徽产线", desc: "为校徽周边建立稳定产线并完成首批交付。",
    creatorId: "u1", assigneeIds: ["m1"], start: at(-10, 9, 0), due: at(30, 18, 0), urgency: "高",
    status: "doing", progress: 60, progressNote: "产线方案已定，等待模具确认。" }),

  mkTask({ id: "t3", parentId: "t1", title: "完成校徽样品打样", desc: "联系供应商完成两轮样品打样。",
    creatorId: "m1", assigneeIds: ["e1"], start: at(-5, 9, 0), due: at(1, 17, 0), urgency: "紧急",
    status: "doing", progress: 45, progressNote: "第一轮样品已回，颜色偏差待修。" }),

  mkTask({ id: "t4", title: "整理上周客户反馈", desc: "汇总客户反馈并给出改进建议。",
    creatorId: "m1", assigneeIds: ["e1"], start: at(-2, 9, 0), due: at(0, 20, 0), urgency: "高",
    status: "todo", progress: 0, progressNote: "" }),

  mkTask({ id: "t5", title: "提交第三季度产品总结", desc: "包含数据指标、问题与下季度计划。",
    creatorId: "u1", assigneeIds: ["m1", "e2"], start: at(-8, 9, 0), due: at(0, 15, 0), urgency: "中",
    status: "pending-complete", progress: 100, progressNote: "总结文档已完成，等待审核确认。" }),

  mkTask({ id: "t6", title: "自建任务：学习新版设计规范", desc: "自行发起，用于熟悉新版组件库。",
    creatorId: "e1", assigneeIds: ["e1"], selfCreated: true, start: at(-1, 9, 0), due: at(4, 18, 0),
    urgency: "中", status: "pending-create", progress: 0, progressNote: "" }),

  mkTask({ id: "t7", title: "自建任务：整理竞品资料库", desc: "自行发起，沉淀竞品资料。",
    creatorId: "e2", assigneeIds: ["e2"], selfCreated: true, start: at(-1, 14, 0), due: at(6, 18, 0),
    urgency: "低", status: "pending-create", progress: 0, progressNote: "" }),

  mkTask({ id: "t8", title: "确认九月排期", desc: "与各模块负责人确认交付排期。",
    creatorId: "m1", assigneeIds: ["e1"], start: at(-14, 9, 0), due: at(-3, 18, 0), urgency: "中",
    status: "done", progress: 100, progressNote: "排期已确认并同步全员。" }),

  mkTask({ id: "t9", title: "临时紧急：处理线上支付故障", desc: "临时紧急情况，需要立即响应并同步进展。",
    creatorId: "u1", assigneeIds: ["e1", "m1"], start: at(0, 8, 0), due: at(0, 22, 0), urgency: "紧急",
    status: "doing", progress: 30, progressNote: "已回滚版本，观察中。" }),

  mkTask({ id: "t10", title: "自建任务：梳理部门协作流程", desc: "中层自行发起并经上层审核通过。",
    creatorId: "m1", assigneeIds: ["m1"], selfCreated: true, start: at(-4, 9, 0), due: at(9, 18, 0),
    urgency: "中", status: "doing", progress: 20, progressNote: "已列出三个待优化环节。" }),

  mkTask({ id: "t11", title: "自建任务：申请外部培训", desc: "下层自行发起，被直属上级拒绝。",
    creatorId: "e2", assigneeIds: ["e2"], selfCreated: true, start: at(-6, 9, 0), due: at(12, 18, 0),
    urgency: "低", status: "rejected", progress: 0, progressNote: "", reviewNote: "本季度培训预算已排满，下季度再议。" }),

  mkTask({ id: "t12", title: "自建任务：制定第四季度公司目标", desc: "上层自建任务，无更高审核人，提交后直接完成。",
    creatorId: "u1", assigneeIds: ["u1"], selfCreated: true, start: at(-2, 9, 0), due: at(0, 18, 0),
    urgency: "高", status: "todo", progress: 0, progressNote: "" }),

  mkTask({ id: "t13", title: "市场部秋季活动策划", desc: "市场部内部任务，产品部无权查看。",
    creatorId: "m2", assigneeIds: ["e3"], start: at(-3, 9, 0), due: at(3, 18, 0), urgency: "中",
    status: "doing", progress: 35, progressNote: "场地已确认。" }),

  mkTask({ id: "t14", title: "准备周一晨会材料", desc: "汇总本周进度用于晨会汇报。",
    creatorId: "m2", assigneeIds: ["e3"], start: at(0, 9, 0), due: at(0, 20, 0), urgency: "高",
    status: "todo", progress: 0, progressNote: "" }),

  mkTask({ id: "t15", title: "输出校徽视觉规范", desc: "与打样并行推进的规范文档。",
    creatorId: "m1", assigneeIds: ["e2"], start: at(1, 9, 0), due: at(1, 20, 0), urgency: "中",
    status: "todo", progress: 0, progressNote: "" }),

  mkTask({ id: "t16", title: "核对供应商报价单", desc: "为打样做成本核算。",
    creatorId: "m1", assigneeIds: ["e1"], start: at(1, 9, 0), due: at(1, 20, 0), urgency: "低",
    status: "todo", progress: 0, progressNote: "" }),

  mkTask({ id: "t17", title: "自建任务：制定部门培训计划", desc: "中层自建任务，等待直属上层审核。",
    creatorId: "m1", assigneeIds: ["m1"], selfCreated: true, start: at(-1, 9, 0), due: at(8, 18, 0),
    urgency: "中", status: "pending-create", progress: 0, progressNote: "" }),

  mkTask({ id: "t18", title: "自建任务：更新产品说明书", desc: "下层自建任务，已提交完成等待直属中层审核。",
    creatorId: "e1", assigneeIds: ["e1"], selfCreated: true, start: at(-7, 9, 0), due: at(0, 12, 0),
    urgency: "中", status: "pending-complete", progress: 100, progressNote: "说明书已更新并自检完成，等待上级确认。" })
];

const LOGS = [
  { id: "l1", authorId: "e1", time: at(0, 9, 20), taskId: "t3",
    content: "上午与供应商确认第二轮打样时间，颜色偏差问题已反馈，预计明天给出新样。" },
  { id: "l2", authorId: "e1", time: at(-1, 18, 40), taskId: "t4",
    content: "整理客户反馈共 23 条，其中 6 条与交付速度相关，已分类待汇总。" },
  { id: "l3", authorId: "e1", time: at(-1, 10, 5), taskId: null,
    content: "参加产品周会，确认本周优先处理校徽项目。" },
  { id: "l4", authorId: "m1", time: at(0, 8, 30), taskId: "t5",
    content: "第三季度总结已提交上层确认，等待反馈。" },
  { id: "l5", authorId: "m1", time: at(-1, 17, 15), taskId: "t3",
    content: "跟进打样进度，要求本周内确定最终颜色方案。" },
  { id: "l6", authorId: "m1", time: at(-2, 9, 40), taskId: null,
    content: "与市场部对齐秋季活动排期，避免资源冲突。" },
  { id: "l7", authorId: "u1", time: at(0, 11, 10), taskId: "t1",
    content: "校徽产线作为新产品切入的第一条线，需要保证交付质量。" },
  { id: "l8", authorId: "u1", time: at(-1, 16, 0), taskId: null,
    content: "与两家外部合作方沟通，评估新产品方向的可行性。" },
  { id: "l9", authorId: "e2", time: at(0, 10, 15), taskId: "t5",
    content: "完成总结中的数据部分，等待合并。" },
  { id: "l10", authorId: "e2", time: at(-2, 14, 30), taskId: null,
    content: "整理竞品信息，计划沉淀为共享资料。" },
  { id: "l11", authorId: "e3", time: at(0, 9, 5), taskId: "t13",
    content: "秋季活动场地已确认，下一步确认物料清单。" },
  { id: "l12", authorId: "m2", time: at(-1, 15, 20), taskId: "t13",
    content: "活动预算已提交，等待财务反馈。" }
];

const NOTIFICATIONS = [
  { id: "n1", type: "create", taskId: "t9", recipients: ["u1", "e1", "m1"], time: at(0, 8, 0), read: [] },
  { id: "n2", type: "emergency", taskId: "t9", recipients: ["u1", "e1", "m1"], time: at(0, 8, 5), read: [] },
  { id: "n3", type: "due", taskId: "t3", recipients: ["m1", "e1"], time: at(0, 7, 30), read: [] },
  { id: "n4", type: "due", taskId: "t4", recipients: ["m1", "e1"], time: at(0, 7, 30), read: [] },
  { id: "n5", type: "create", taskId: "t4", recipients: ["m1", "e1"], time: at(-2, 9, 5), read: ["e1"] },
  { id: "n6", type: "create", taskId: "t13", recipients: ["m2", "e3"], time: at(-3, 9, 10), read: [] },
  { id: "n7", type: "due", taskId: "t14", recipients: ["m2", "e3"], time: at(0, 7, 30), read: [] },
  { id: "n8", type: "create", taskId: "t5", recipients: ["u1", "m1", "e2"], time: at(-8, 9, 5), read: ["u1", "m1", "e2"] },
  { id: "n9", type: "create", taskId: "t12", recipients: ["u1"], time: at(-2, 9, 5), read: [] }
];
const NOTIF_LABEL = { create: "任务创建", due: "临近截止", emergency: "临时紧急" };
const NOTIF_CLASS = { create: "b-brand", due: "b-high", emergency: "b-urgent" };

const CONSULTATIONS = [
  { id: "c1", fromId: "m1", toId: "u1", time: at(0, 9, 45), content: "老板，校徽项目的推进方式想请您确认下，是否按当前节奏继续？", status: "pending", reply: "" },
  { id: "c2", fromId: "m1", toId: "u1", time: at(-4, 14, 10), content: "关于第三季度总结的重点，是否需要增加竞品对比章节？", status: "replied", reply: "需要，重点放在两类竞品的差异上。", replyTime: at(-4, 16, 0) },
  { id: "c3", fromId: "m2", toId: "u1", time: at(-1, 11, 0), content: "秋季活动的预算上限能否提高到原计划的 1.2 倍？", status: "pending", reply: "" }
];

/* 公司信息：由上层统一维护 */
const COMPANY_ITEMS = [
  { id: "co1", text: "年度目标：完成三条新产品线落地" },
  { id: "co2", text: "年度成就：校园文创产品覆盖 12 所高校" },
  { id: "co3", text: "质量红线：交付前必须完成两轮验收" },
  { id: "co4", text: "协作原则：跨部门需求需在周会同步" },
  { id: "co5", text: "客户承诺：紧急问题 2 小时内响应" },
  { id: "co6", text: "人才计划：每季度一次内部分享" },
  { id: "co7", text: "成本目标：物料成本同比下降 8%" },
  { id: "co8", text: "重点客户：北京交通大学文创中心" },
  { id: "co9", text: "技术方向：产线自动化改造一期" },
  { id: "co10", text: "合规要求：所有素材需完成版权确认" }
];

/* 个人信息：默认由本人日志生成，编辑后使用保存内容 */
const PERSONAL_STATE = {};   // personId -> { items, edited }
function ensurePersonal(pid){
  if (!PERSONAL_STATE[pid]) PERSONAL_STATE[pid] = { items: null, edited: false };
  return PERSONAL_STATE[pid];
}

/* 会话状态 */
const state = {
  actorId: ROLE_ACCOUNT.upper,
  page: "map",
  viewMode: "month",      // month | week | day
  viewAnchor: startOfDay(BASE_DAY),
  pickerOpen: false,      // 月视图年月选择面板
  logFilter: "logs",      // 日志页单选内容筛选
  logsMineOnly: false,    // 日志查找：只看自己
  logAuthorQuery: ""      // 日志查找：规范化（trim + 小写）的作者姓名片段
};

/* =====================================================================
   权限与业务规则：所有页面、详情与表单统一复用这里的派生函数。
   说明：这是交互原型中的演示规则，不构成真实客户端安全边界。
   ===================================================================== */
function personById(id){ return PEOPLE.find(function(p){ return p.id === id; }) || null; }
function actor(){ return personById(state.actorId); }
function deptOf(pid){ const p = personById(pid); return p ? p.dept : ""; }
function directSuperiorOf(pid){
  const p = personById(pid);
  return p && p.superiorId ? personById(p.superiorId) : null;
}
function taskById(id){ return TASKS.find(function(t){ return t.id === id; }) || null; }
function logById(id){ return LOGS.find(function(l){ return l.id === id; }) || null; }
function childrenOf(id){
  return TASKS.filter(function(t){ return t.parentId === id; });
}
function assigneesOf(t){ return t.assigneeIds.map(personById).filter(Boolean); }
function creatorOf(t){ return personById(t.creatorId); }

/* 任务是否落在某个部门范围内：创建者或任一负责人属于该部门 */
function taskInDept(t, dept){
  const ids = [t.creatorId].concat(t.assigneeIds);
  return ids.some(function(id){ return deptOf(id) === dept; });
}
function taskHasMember(t, pid){
  return t.creatorId === pid || t.assigneeIds.indexOf(pid) !== -1;
}

/* 角色可见范围 */
function visibleTasks(a){
  if (a.role === "upper") return TASKS.slice();
  if (a.role === "middle") return TASKS.filter(function(t){ return taskInDept(t, a.dept); });
  return TASKS.filter(function(t){ return taskHasMember(t, a.id); });
}
function visibleLogs(a){
  if (a.role === "upper") return LOGS.slice();
  if (a.role === "middle") return LOGS.filter(function(l){ return deptOf(l.authorId) === a.dept; });
  return LOGS.filter(function(l){ return l.authorId === a.id; });
}
/* 可派发/可选择的负责人范围 */
function assignablePeople(a){
  if (a.role === "upper") return PEOPLE.slice();
  if (a.role === "middle"){
    return PEOPLE.filter(function(p){ return p.id === a.id || (p.dept === a.dept && p.role === "lower"); });
  }
  return [a];
}
/* 可见的上级任务候选（仅普通任务，且在当前身份可见范围内） */
/* 可选上级任务：范围内任务均可作为上级，抽象任务也可作为普通子任务的上级。
   排除自身与其直接子任务，避免自引用和一层父子结构下的环。 */
function parentCandidates(a, forTask){
  return sortTasks(visibleTasks(a).filter(function(t){
    if (forTask && (t.id === forTask.id || t.parentId === forTask.id)) return false;
    return true;
  }));
}

/* 编辑 / 进度 / 审核规则 */
function canEditTask(a, t){ return !!t && t.creatorId === a.id && t.status !== "rejected"; }
function canUpdateProgress(a, t){
  if (!t || t.type !== "normal") return false;
  if (t.assigneeIds.indexOf(a.id) === -1) return false;
  /* 待审核任务尚未生效，不能更新进度或提交完成 */
  return t.status === "todo" || t.status === "doing";
}
/* 完成审核人：派发任务由创建者审核，自建任务由直属上级审核 */
function completionReviewer(t){
  if (t.selfCreated){
    const sup = directSuperiorOf(t.creatorId);
    return sup && sup.id !== t.creatorId ? sup : null;
  }
  return personById(t.creatorId);
}
/* 创建审核人：自建任务的直属上级；上层无上级则无需审核 */
function createReviewer(t){
  if (!t.selfCreated) return null;
  return directSuperiorOf(t.creatorId);
}
function isFinished(t){ return t.status === "done" || t.status === "rejected"; }
function pendingCreateFor(a){
  return sortTasks(visibleTasks(a).filter(function(t){
    if (t.status !== "pending-create") return false;
    const r = createReviewer(t);
    return !!r && r.id === a.id;
  }));
}
function pendingCompleteFor(a){
  return sortTasks(visibleTasks(a).filter(function(t){
    if (t.status !== "pending-complete") return false;
    const r = completionReviewer(t);
    return !!r && r.id === a.id;
  }));
}
function pendingReviewCount(a){ return pendingCreateFor(a).length + pendingCompleteFor(a).length; }

/* 抽象任务：由普通子任务汇总 */
function abstractStats(t){
  const kids = childrenOf(t.id);
  const total = kids.length;
  const done = kids.filter(function(k){ return k.status === "done"; }).length;
  return { kids: kids, total: total, done: done, pct: total ? Math.round(done / total * 100) : 0 };
}
function effectiveStatus(t){
  if (t.type !== "abstract") return t.status;
  const s = abstractStats(t);
  if (s.total && s.done === s.total) return "done";
  if (s.kids.some(function(k){ return k.status === "doing" || k.status === "pending-complete"; })) return "doing";
  return "todo";
}
function effectiveProgress(t){
  if (t.type !== "abstract") return t.progress;
  return abstractStats(t).pct;
}
/* 排序：紧急程度优先，其次距截止时间更近的优先 */
function sortTasks(list){
  return list.slice().sort(function(x, y){
    const ux = URGENCY_ORDER[x.urgency], uy = URGENCY_ORDER[y.urgency];
    if (ux !== uy) return ux - uy;
    return x.due.getTime() - y.due.getTime();
  });
}
/* 当前身份在某任务中的角色：own 我负责 / assigned 我分配 / other 仅可见
   互斥判定，且采用“负责人优先”：先看是否负责人，再看是否创建者，最后才是仅因权限可见。 */
function taskKind(t, a){
  if (t.assigneeIds.indexOf(a.id) !== -1) return "own";
  if (t.creatorId === a.id) return "assigned";
  return "other";
}
const KIND_LABEL = { own: "我负责", assigned: "我分配", other: "仅可见" };
const KIND_EMOJI = { own: "👤", assigned: "📤", other: "👁️" };

/* 通知与请示 */
function notificationsFor(a){
  return NOTIFICATIONS
    .filter(function(n){ return n.recipients.indexOf(a.id) !== -1 && taskById(n.taskId); })
    .sort(function(x, y){ return y.time.getTime() - x.time.getTime(); });
}
function unreadCount(a){
  return notificationsFor(a).filter(function(n){ return n.read.indexOf(a.id) === -1; }).length;
}
function inboxConsultations(a){
  return CONSULTATIONS.filter(function(c){ return c.toId === a.id; })
    .sort(function(x, y){ return y.time.getTime() - x.time.getTime(); });
}
function sentConsultations(a){
  return CONSULTATIONS.filter(function(c){ return c.fromId === a.id; })
    .sort(function(x, y){ return y.time.getTime() - x.time.getTime(); });
}

/* ------------------------------ 通用渲染片段 ------------------------------ */
function kindTag(t, a){
  const k = taskKind(t, a);
  return '<span class="kind ' + k + '"><span class="kind-emoji" aria-hidden="true">' + KIND_EMOJI[k] +
    "</span>" + KIND_LABEL[k] + "</span>";
}
function statusBadge(t){
  const st = effectiveStatus(t);
  return '<span class="badge ' + STATUS_CLASS[st] + '">' + STATUS_LABEL[st] + "</span>";
}
function urgencyBadge(u){
  return '<span class="badge ' + urgencyClass(u) + '">' + esc(u) + "</span>";
}
function typeBadge(t){
  return t.type === "abstract" ? '<span class="badge b-pending">抽象任务</span>' : "";
}
function taskItemHTML(t, a, opts){
  opts = opts || {};
  const k = taskKind(t, a);
  const cls = k === "own" ? "is-own" : k === "assigned" ? "is-assigned" : "";
  const overdue = isOverdue(t);
  const note = t.progressNote ? '<div class="t-note">进度备注：' + esc(t.progressNote) + "</div>" : "";
  const pct = effectiveProgress(t);
  return '<button type="button" class="task-item ' + cls + '" data-task="' + t.id + '">' +
      '<span class="t-title"><span>' + esc(t.title) + "</span></span>" +
      '<span class="task-meta">' + kindTag(t, a) + typeBadge(t) + statusBadge(t) + urgencyBadge(t.urgency) +
        '<span class="' + (overdue ? "is-overdue" : "") + '">' + esc(fmtDue(t.due)) + (overdue ? " · 已逾期" : "") + "</span>" +
        (opts.hideProgress ? "" : "<span>进度 " + pct + "%</span>") +
      "</span>" + note +
    "</button>";
}

/* ============================== 页面：导图 ============================== */
function personalItemsFor(pid){
  const st = ensurePersonal(pid);
  if (st.items && st.edited) return st.items;
  /* 默认由本人日志自动生成摘录 */
  const mine = LOGS.filter(function(l){ return l.authorId === pid; })
    .sort(function(x, y){ return y.time.getTime() - x.time.getTime(); })
    .slice(0, 10);
  return mine.map(function(l){
    const text = l.content.length > 34 ? l.content.slice(0, 34) + "…" : l.content;
    return { id: "pi-" + l.id, text: text, logId: l.id };
  });
}
function renderMap(){
  const a = actor();
  const el = document.getElementById("page-map");
  const assigned = sortTasks(visibleTasks(a).filter(function(t){
    return t.type === "normal" && t.assigneeIds.indexOf(a.id) !== -1 && t.creatorId !== a.id && !isFinished(t);
  })).slice(0, 10);
  const personal = personalItemsFor(a.id);
  const recentLogs = LOGS.filter(function(l){ return l.authorId === a.id; })
    .filter(function(l){ return dayDiff(l.time, BASE_DAY) >= -1 && dayDiff(l.time, BASE_DAY) <= 0; })
    .sort(function(x, y){ return y.time.getTime() - x.time.getTime(); });
  const personalEdited = ensurePersonal(a.id).edited;
  const canEditCompany = a.role === "upper";
  const companyAtLimit = COMPANY_ITEMS.length >= 10;
  const personalAtLimit = personal.length >= 10;

  function companyBody(){
    if (!COMPANY_ITEMS.length) return '<div class="empty">暂无公司信息</div>';
    return COMPANY_ITEMS.map(function(it, i){
      return '<div class="item-line"><div class="item-main"><span class="idx">' + (i + 1) + '</span><span class="txt">' + esc(it.text) + "</span></div>" +
        (canEditCompany
          ? '<div class="item-actions">' +
              '<button type="button" class="btn ghost tiny-btn" data-edit-company="' + it.id + '" aria-label="编辑公司信息第' + (i + 1) + '条">编辑</button>' +
              '<button type="button" class="btn ghost tiny-btn" data-delete-company="' + it.id + '" aria-label="删除公司信息第' + (i + 1) + '条">删除</button>' +
            "</div>"
          : "") +
        "</div>";
    }).join("");
  }
  function assignedBody(){
    if (!assigned.length) return '<div class="empty">暂无被派发的未完成任务</div>';
    return assigned.map(function(t){ return taskItemHTML(t, a, { hideProgress: false }); }).join("");
  }
  function personalBody(){
    if (!personal.length) return '<div class="empty">暂无个人信息，可手动添加</div>';
    return personal.map(function(it, i){
      return '<div class="item-line"><div class="item-main"><span class="idx">' + (i + 1) + '</span><span class="txt">' + esc(it.text) + "</span></div>" +
        '<div class="item-actions">' +
          '<button type="button" class="btn ghost tiny-btn" data-edit-personal="' + it.id + '" aria-label="编辑个人信息第' + (i + 1) + '条">编辑</button>' +
          '<button type="button" class="btn ghost tiny-btn" data-delete-personal="' + it.id + '" aria-label="删除个人信息第' + (i + 1) + '条">删除</button>' +
        "</div></div>";
    }).join("");
  }
  function logsBody(){
    if (!recentLogs.length) return '<div class="empty">今天与昨天暂无日志</div>';
    return recentLogs.map(function(l){
      const t = l.taskId ? taskById(l.taskId) : null;
      return '<button type="button" class="log-line" data-log="' + l.id + '">' +
        '<span class="lt">' + esc(relativeDayLabel(l.time)) + " " + esc(fmtTime(l.time)) +
          (t ? " · 关联：" + esc(t.title) : "") + "</span>" +
        '<span class="lc">' + esc(l.content) + "</span></button>";
    }).join("");
  }

  el.innerHTML =
    '<div class="map-grid">' +
      '<section class="quad" aria-labelledby="q1">' +
        '<div class="card-head' + (canEditCompany ? " has-actions" : "") + '"><h2 id="q1">公司统一信息</h2><span class="hint">' + COMPANY_ITEMS.length + "/10" +
          (canEditCompany && companyAtLimit ? " · 已达上限" : "") + "</span>" +
          (canEditCompany ? '<button type="button" class="btn tiny-btn" data-action="new-company"' + (companyAtLimit ? " disabled" : "") + ' aria-label="新增公司信息">新增</button>' : "") +
        "</div>" +
        '<div class="q-body">' + companyBody() + "</div>" +
      "</section>" +
      '<section class="quad" aria-labelledby="q2">' +
        '<div class="card-head"><h2 id="q2">我被派发未完成</h2><span class="hint">' + assigned.length + "/10</span></div>" +
        '<div class="q-body">' + assignedBody() + "</div>" +
      "</section>" +
      '<section class="quad" aria-labelledby="q3">' +
        '<div class="card-head has-actions"><h2 id="q3">个人信息</h2><span class="hint">' + personal.length + "/10 · " +
          (personalEdited ? "已编辑" : "来自日志") + (personalAtLimit ? " · 已达上限" : "") + "</span>" +
          '<button type="button" class="btn tiny-btn" data-action="new-personal"' + (personalAtLimit ? " disabled" : "") + ' aria-label="新增个人信息">新增</button>' +
        "</div>" +
        '<div class="q-body">' + personalBody() + "</div>" +
      "</section>" +
      '<section class="quad" aria-labelledby="q4">' +
        '<div class="card-head"><h2 id="q4">今天与昨天日志</h2><span class="hint">时间倒序</span></div>' +
        '<div class="q-body">' + logsBody() + "</div>" +
      "</section>" +
    "</div>";
}

/* ============================== 页面：视图（响应式类甘特） ============================== */
const WEEK_NAMES = ["周一", "周二", "周三", "周四", "周五", "周六", "周日"];
const overflowGroups = {};
/* 每次视图渲染重建溢出分组，避免历史分组累积并让 +N 始终对应当前身份与当前日期 */
function resetOverflowGroups(){
  Object.keys(overflowGroups).forEach(function(k){ delete overflowGroups[k]; });
}
/* dateKey 为 ISO 日期（月视图逐日溢出）或分组说明；同一日期只会有一个溢出分组 */
function registerOverflow(title, tasks, dateKey){
  const id = "ov-" + (dateKey || "group") + "-" + (Object.keys(overflowGroups).length + 1);
  overflowGroups[id] = { title: title, ids: tasks.map(function(t){ return t.id; }), date: dateKey || null };
  return id;
}
/* 视口高度策略：周、日视图同一展示位置最多显示的泳道数，其余聚合为 +N（月视图用逐日容量模型） */
const LANE_CAPACITY = { week: 4, day: 6 };
/* 月视图固定五条任务行，逐日容量也是五（四项直显 + 一项 +N） */
const MONTH_LANES = 5;
const MONTH_DIRECT_LIMIT = 5;
const MONTH_OVERFLOW_KEEP = 4;

/* ---- 任务配色：低饱和多色相填充色板，按任务标识在插入顺序上稳定分配 ----
   颜色只用于区分不同任务，任务关系始终由 emoji 前缀、图例与无障碍名称表达。 */
const TASK_PALETTE = [
  { bg: "#e7ebf2", bd: "#7c8aa5" },
  { bg: "#e4ecf9", bd: "#6b8fc9" },
  { bg: "#e2f0ee", bd: "#5f9c95" },
  { bg: "#e6f0e4", bd: "#7aa06e" },
  { bg: "#eef0e0", bd: "#9aa15c" },
  { bg: "#f7eedd", bd: "#bf9a4e" },
  { bg: "#f7e8de", bd: "#c1875c" },
  { bg: "#f7e6e8", bd: "#bd7280" },
  { bg: "#f5e7ef", bd: "#b073a0" },
  { bg: "#ece6f6", bd: "#8b7cc0" },
  { bg: "#e7e9f8", bd: "#7b83c4" },
  { bg: "#e0eff5", bd: "#5c9ab3" },
  { bg: "#f0e9e2", bd: "#a08571" },
  { bg: "#ecf2e2", bd: "#8fa85f" }
];
const taskColorIndex = {};
let taskColorSeq = 0;
/* 任务标识 -> 色板下标；首次遇到时按插入顺序登记，动态创建的任务同样入册 */
function paletteIndexOf(t){
  const id = t && t.id ? t.id : "";
  if (!Object.prototype.hasOwnProperty.call(taskColorIndex, id)){
    taskColorIndex[id] = taskColorSeq % TASK_PALETTE.length;
    taskColorSeq += 1;
  }
  return taskColorIndex[id];
}
/* 任务填充色：以 CSS 变量形式落到任务条上，色板耗尽后按取模重复 */
function taskColorVars(t){
  const c = TASK_PALETTE[paletteIndexOf(t)];
  return "--tc-bg:" + c.bg + ";--tc-bd:" + c.bd + ";";
}
/* 种子任务先入册，保证会话内任何渲染顺序下颜色都稳定 */
TASKS.forEach(function(t){ paletteIndexOf(t); });

/* ---- 视图专用时间范围、截断、几何与排序逻辑 ---- */
function fx(n){ return Math.round(n * 1000) / 1000; }
function isoDate(d){ return toDateInput(d); }
function parseISO(s){
  const p = String(s).split("-").map(Number);
  return new Date(p[0], p[1] - 1, p[2], 0, 0, 0, 0);
}
function addDays(d, n){ return new Date(d.getFullYear(), d.getMonth(), d.getDate() + n, 0, 0, 0, 0); }
function spanOf(t){ return t.due.getTime() - t.start.getTime(); }

/* 排序：时间跨度降序 → 紧急程度降序 → 截止日期升序 → id 稳定 */
function viewSortTasks(list){
  return list.slice().sort(function(x, y){
    const sx = spanOf(x), sy = spanOf(y);
    if (sx !== sy) return sy - sx;
    const ux = URGENCY_ORDER[x.urgency], uy = URGENCY_ORDER[y.urgency];
    if (ux !== uy) return ux - uy;
    const dx = x.due.getTime(), dy = y.due.getTime();
    if (dx !== dy) return dx - dy;
    return x.id < y.id ? -1 : x.id > y.id ? 1 : 0;
  });
}
/* 视图范围：月 = 自然月，周 = 周一到下周一，日 = 当日 00:00 到次日 00:00 */
function viewRange(mode, anchor){
  if (mode === "month"){
    const y = anchor.getFullYear(), m = anchor.getMonth();
    return { start: new Date(y, m, 1, 0, 0, 0, 0), end: new Date(y, m + 1, 1, 0, 0, 0, 0) };
  }
  if (mode === "week"){
    const off = (anchor.getDay() + 6) % 7;
    const start = new Date(anchor.getFullYear(), anchor.getMonth(), anchor.getDate() - off, 0, 0, 0, 0);
    return { start: start, end: addDays(start, 7) };
  }
  const d = startOfDay(anchor);
  return { start: d, end: addDays(d, 1) };
}
/* 仅保留与范围有真实交集（> 边界）的任务 */
function tasksInRange(list, range){
  return list.filter(function(t){
    return t.due.getTime() > range.start.getTime() && t.start.getTime() < range.end.getTime();
  });
}
/* 截断到范围并换算为 0-100 的百分比几何 */
function pctGeometry(t, range){
  const rs = range.start.getTime(), re = range.end.getTime();
  const s = Math.max(t.start.getTime(), rs), e = Math.min(t.due.getTime(), re);
  const span = re - rs;
  return { left: (s - rs) / span * 100, width: Math.max(0, (e - s) / span * 100) };
}
/* 条形按钮的可点击盒、时长色带与文本起点：色带严格等于时间跨度 */
function barGeom(left, width){
  const s = Math.max(0, Math.min(100, left));
  const e = Math.max(s, Math.min(100, left + width));
  let box, dur, text;
  if (s <= 50){
    const span = 100 - s;
    box = "left:" + fx(s) + "%;right:0;";
    dur = "left:0;width:" + fx(span > 0 ? (e - s) / span * 100 : 0) + "%;";
    text = "left:" + fx(s) + "%;right:2px;justify-content:flex-start;";
  } else {
    const span = e;
    box = "left:0;width:" + fx(e) + "%;";
    dur = "left:" + fx(span > 0 ? s / span * 100 : 0) + "%;width:" + fx(span > 0 ? (e - s) / span * 100 : 0) + "%;";
    /* 右半段的条：文本靠右对齐到条尾，保持“文本 → 条”的阅读方向 */
    text = "left:0;right:" + fx(100 - e) + "%;justify-content:flex-end;";
  }
  return { box: box, dur: dur, text: text };
}
function taskAriaLabel(t, a){
  return t.title + "，" + KIND_LABEL[taskKind(t, a)] + "，" + STATUS_LABEL[effectiveStatus(t)] +
    "，紧急程度" + t.urgency + "，起 " + fmtDateTime(t.start) + " 止 " + fmtDateTime(t.due) +
    "，进度 " + effectiveProgress(t) + "%" + (t.desc ? "，说明：" + t.desc : "");
}
/* 任务条可见文本：仅关系 emoji 前缀（对辅助技术隐藏，语义由按钮名与图例给出）与任务名称。
   描述、状态、截止日期等元数据只出现在任务详情与按钮无障碍名称中。 */
function barInnerHTML(t, a){
  return '<span class="bar-kind" aria-hidden="true">' + KIND_EMOJI[taskKind(t, a)] + "</span>" +
    '<span class="bar-t">' + esc(t.title) + "</span>";
}
function barHTML(t, a, range){
  const k = taskKind(t, a);
  const cls = k === "own" ? "is-own" : k === "assigned" ? "is-assigned" : "";
  const geo = pctGeometry(t, range);
  const box = barGeom(geo.left, geo.width);
  const clip = (t.start.getTime() < range.start.getTime() ? " is-clip-start" : "") +
    (t.due.getTime() > range.end.getTime() ? " is-clip-end" : "");
  return '<div class="g-lane">' +
      '<button type="button" class="bar ' + cls + '" style="' + box.box + taskColorVars(t) + '" data-task="' + t.id + '" ' +
        'aria-label="' + esc(taskAriaLabel(t, a)) + '">' +
        '<i class="bar-dur' + clip + '" aria-hidden="true" style="' + box.dur + '"></i>' +
        '<span class="bar-text" style="' + box.text + '">' + barInnerHTML(t, a) + "</span>" +
      "</button></div>";
}
function lanesHTML(tasks, a, range, title){
  const cap = LANE_CAPACITY[state.viewMode];
  const shown = tasks.slice(0, cap), rest = tasks.slice(cap);
  let html = shown.map(function(t){ return barHTML(t, a, range); }).join("");
  if (rest.length){
    const gid = registerOverflow(title + " 其余 " + rest.length + " 项", rest);
    html += '<div class="g-lane is-expand"><button type="button" class="plusn" data-overflow="' + gid +
      '" aria-label="' + esc(title + "还有 " + rest.length + " 项任务，点击查看") + '">+' + rest.length + "</button></div>";
  }
  if (!tasks.length) html = '<div class="g-lane is-expand"><span class="tiny muted">无任务</span></div>';
  return html;
}
/* ---- 月视图：完整自然周网格 + 逐日容量 + 跨日连续段 ----
   展示范围从目标月首日所在周的周一，到最后一个展示周的周日（含相邻月份日期）。 */
function monthGrid(anchor){
  const y = anchor.getFullYear(), m = anchor.getMonth();
  const first = new Date(y, m, 1, 0, 0, 0, 0);
  const off = (first.getDay() + 6) % 7;
  const daysInMonth = new Date(y, m + 1, 0).getDate();
  const weekCount = Math.ceil((off + daysInMonth) / 7);
  const start = addDays(first, -off);
  const weeks = [];
  for (let i = 0; i < weekCount; i++){
    const s = addDays(start, i * 7);
    weeks.push({ start: s, end: addDays(s, 7) });
  }
  return { start: start, end: addDays(start, weekCount * 7), weeks: weeks };
}

/* 逐日选取：不超过五项时全部直显；超过五项时保留排序前四项，其余登记为该日期专属溢出。
   +N 因此恒为 当日可见任务数 - 4。 */
function dateOccurrences(list, date){
  const dayStart = startOfDay(date);
  const hits = viewSortTasks(tasksInRange(list, { start: dayStart, end: addDays(dayStart, 1) }));
  if (hits.length <= MONTH_DIRECT_LIMIT) return { shown: hits, overflow: [] };
  return { shown: hits.slice(0, MONTH_OVERFLOW_KEEP), overflow: hits.slice(MONTH_OVERFLOW_KEEP) };
}

/* 一行七列里的展示条目：同一任务在相邻日期上合并为一段，被挤出/中断处自然分段 */
function weekSegments(week, list){
  const byKey = {}, keyOrder = [];
  for (let i = 0; i < 7; i++){
    const date = addDays(week.start, i);
    const sel = dateOccurrences(list, date);
    sel.shown.forEach(function(t){
      if (!byKey[t.id]){ byKey[t.id] = { type: "task", task: t, cols: [] }; keyOrder.push(t.id); }
      byKey[t.id].cols.push(i);
    });
    if (sel.overflow.length){
      const iso = isoDate(date);
      const key = "ov:" + iso;
      const gid = registerOverflow(fmtDate(date) + " 其余 " + sel.overflow.length + " 项", sel.overflow, iso);
      byKey[key] = { type: "overflow", gid: gid, count: sel.overflow.length, cols: [i] };
      keyOrder.push(key);
    }
  }
  const segs = [];
  keyOrder.forEach(function(key){
    const g = byKey[key];
    g.cols.forEach(function(c){
      const last = segs.length ? segs[segs.length - 1] : null;
      if (last && last.key === key && last.end === c - 1){ last.end = c; return; }
      segs.push({ key: key, type: g.type, task: g.task, gid: g.gid, count: g.count, start: c, end: c, lane: 0 });
    });
  });
  return assignLanes(segs);
}

/* 贪心首适应分配泳道：每日最多 5 个条目，故至多用到 5 条泳道 */
function assignLanes(segs){
  const laneEnds = [];
  segs.forEach(function(s){
    let lane = 0;
    while (lane < MONTH_LANES && laneEnds[lane] !== undefined && laneEnds[lane] >= s.start) lane++;
    if (lane >= MONTH_LANES) lane = MONTH_LANES - 1;
    laneEnds[lane] = s.end;
    s.lane = lane;
  });
  return segs;
}

/* 相邻月份日期用可见的月份文字与类名区分，不只依赖颜色或透明度弱化 */
function monthDateAria(d, monthIndex){
  const base = fmtDate(d) + "，" + WEEK_NAMES[(d.getDay() + 6) % 7];
  return d.getMonth() === monthIndex ? base : base + "，相邻月份";
}
function monthSegHTML(s, a, weekStart){
  const geo = "left:" + fx(s.start / 7 * 100) + "%;width:" + fx((s.end - s.start + 1) / 7 * 100) + "%;";
  if (s.type === "overflow"){
    const date = addDays(weekStart, s.start);
    return '<button type="button" class="plusn" style="' + geo + '" data-overflow="' + s.gid +
      '" aria-label="' + esc(fmtDate(date) + "还有 " + s.count + " 项任务未直接显示，点击查看") + '">+' + s.count + "</button>";
  }
  const t = s.task;
  const clip = (t.start.getTime() < addDays(weekStart, s.start).getTime() ? " is-clip-start" : "") +
    (t.due.getTime() > addDays(weekStart, s.end + 1).getTime() ? " is-clip-end" : "");
  const k = taskKind(t, a);
  const cls = k === "own" ? "is-own" : k === "assigned" ? "is-assigned" : "";
  return '<button type="button" class="bar ' + cls + '" style="' + geo + taskColorVars(t) + '" data-task="' + t.id + '" ' +
      'aria-label="' + esc(taskAriaLabel(t, a)) + '">' +
      '<i class="bar-dur' + clip + '" aria-hidden="true" style="left:0;right:0"></i>' +
      '<span class="bar-text" style="left:0;right:0">' + barInnerHTML(t, a) + "</span>" +
    "</button>";
}

/* 每周：日期带（七天各一个真实按钮）+ 五条固定等高任务行；无周侧栏、无重复星期头 */
function monthGanttHTML(list, a){
  const grid = monthGrid(state.viewAnchor);
  const scoped = tasksInRange(list, grid);
  const monthIndex = state.viewAnchor.getMonth();
  let rows = "";
  grid.weeks.forEach(function(w){
    const segs = weekSegments(w, scoped);
    let band = "", cells = "";
    for (let i = 0; i < 7; i++){
      const d = addDays(w.start, i);
      const outside = d.getMonth() !== monthIndex;
      band += '<button type="button" class="g-date' + (outside ? " is-outside" : "") +
        (sameDay(d, BASE_DAY) ? " is-today" : "") + '" data-drill-week="' + isoDate(w.start) +
        '" aria-label="' + esc(monthDateAria(d, monthIndex)) + '">' +
        '<span class="g-day-num" aria-hidden="true">' + d.getDate() + "</span>" +
        (outside ? '<span class="g-day-mon" aria-hidden="true">' + (d.getMonth() + 1) + "月</span>" : "") +
        "</button>";
      cells += '<i class="' + (sameDay(d, BASE_DAY) ? "is-today" : "") + '"></i>';
    }
    let lanes = "";
    for (let l = 0; l < MONTH_LANES; l++){
      lanes += '<div class="g-lane">' + segs.filter(function(s){ return s.lane === l; })
        .map(function(s){ return monthSegHTML(s, a, w.start); }).join("") + "</div>";
    }
    rows += '<div class="g-week">' +
      '<div class="g-date-band" style="--cols:7">' + band + "</div>" +
      '<div class="g-weekbody" style="--cols:7">' +
        '<div class="g-grid">' + cells + "</div>" +
        '<div class="g-lanes">' + lanes + "</div>" +
      "</div></div>";
  });
  return '<div class="gantt g-month"><div class="g-weeks">' + rows + "</div></div>";
}

/* ---- 周视图：七天横轴，精确到时刻，点击日期空白进入日视图 ---- */
function weekGanttHTML(list, a){
  const range = viewRange("week", state.viewAnchor);
  const tasks = viewSortTasks(tasksInRange(list, range));
  let axis = "", grid = "", drills = "";
  for (let i = 0; i < 7; i++){
    const d = addDays(range.start, i);
    const today = sameDay(d, BASE_DAY);
    axis += '<span class="stack' + (today ? " is-today" : "") + '"><b>' + WEEK_NAMES[i] + "</b><i>" +
      (d.getMonth() + 1) + "/" + d.getDate() + "</i></span>";
    grid += '<i class="' + (today ? "is-today" : "") + '"></i>';
    drills += '<button type="button" data-drill-day="' + isoDate(d) + '" aria-label="' +
      esc("进入 " + fmtDate(d) + " 的日视图") + '"></button>';
  }
  return '<div class="gantt">' +
    '<div class="g-head"><div class="g-axis" style="--cols:7">' + axis + "</div></div>" +
    '<div class="g-body" style="--cols:7">' +
      '<div class="g-grid">' + grid + "</div>" +
      '<div class="g-drill">' + drills + "</div>" +
      '<div class="g-lanes">' + lanesHTML(tasks, a, range, fmtDate(range.start) + " 当周") + "</div>" +
    "</div></div>";
}

/* ---- 日视图：24 小时横轴，主刻度每 3 小时 ---- */
function dayGanttHTML(list, a){
  const range = viewRange("day", state.viewAnchor);
  const tasks = viewSortTasks(tasksInRange(list, range));
  let axis = "", grid = "";
  for (let i = 0; i < 8; i++){
    axis += "<span>" + pad2(i * 3) + ":00</span>";
    grid += "<i></i>";
  }
  return '<div class="gantt">' +
    '<div class="g-head"><div class="g-axis" style="--cols:8">' + axis + "</div></div>" +
    '<div class="g-body" style="--cols:8">' +
      '<div class="g-grid">' + grid + "</div>" +
      '<div class="g-lanes">' + lanesHTML(tasks, a, range, fmtDate(range.start) + " 全天") + "</div>" +
    "</div></div>";
}

/* ---- 年月选择面板（月视图）与前后 / 返回操作（周、日视图） ---- */
function pickerHTML(){
  const y = state.viewAnchor.getFullYear(), m = state.viewAnchor.getMonth();
  let grid = "";
  for (let i = 0; i < 12; i++){
    grid += '<button type="button" data-action="pick-month" data-month="' + i +
      '" aria-pressed="' + (i === m) + '" aria-label="' + (y + "年" + (i + 1) + "月") + '">' + (i + 1) + "月</button>";
  }
  return '<div class="picker"><div class="row">' +
      '<button type="button" class="btn tiny-btn" data-action="pick-year" data-delta="-1" aria-label="上一年">‹ 上一年</button>' +
      '<strong class="small" style="flex:1;text-align:center">' + y + " 年</strong>" +
      '<button type="button" class="btn tiny-btn" data-action="pick-year" data-delta="1" aria-label="下一年">下一年 ›</button>' +
    '</div><div class="picker-grid">' + grid + "</div></div>";
}
function viewToolbarHTML(){
  if (state.viewMode === "month"){
    const y = state.viewAnchor.getFullYear(), m = state.viewAnchor.getMonth();
    return '<div class="view-toolbar">' +
      '<button type="button" class="btn tiny-btn" data-action="toggle-month-picker" aria-expanded="' +
        String(state.pickerOpen) + '">选择年月（' + y + "年" + (m + 1) + "月）</button></div>" +
      (state.pickerOpen ? pickerHTML() : "");
  }
  if (state.viewMode === "week"){
    return '<div class="view-toolbar">' +
      '<button type="button" class="btn tiny-btn" data-action="view-prev">上一周</button>' +
      '<button type="button" class="btn tiny-btn" data-action="view-next">下一周</button>' +
      '<button type="button" class="btn tiny-btn" data-action="view-up">返回月视图</button></div>';
  }
  return '<div class="view-toolbar">' +
    '<button type="button" class="btn tiny-btn" data-action="view-prev">前一天</button>' +
    '<button type="button" class="btn tiny-btn" data-action="view-next">后一天</button>' +
    '<button type="button" class="btn tiny-btn" data-action="view-up">返回周视图</button></div>';
}

function viewTasks(a){
  return visibleTasks(a).filter(function(t){ return t.status !== "rejected"; });
}
function renderView(){
  const a = actor();
  const el = document.getElementById("page-view");
  const list = viewTasks(a);
  const mode = state.viewMode;
  const range = viewRange(mode, state.viewAnchor);
  resetOverflowGroups();
  let body, rangeLabel;
  if (mode === "month"){
    body = monthGanttHTML(list, a);
    rangeLabel = state.viewAnchor.getFullYear() + "年" + (state.viewAnchor.getMonth() + 1) + "月（精确到日期）";
  } else if (mode === "week"){
    body = weekGanttHTML(list, a);
    rangeLabel = fmtDate(range.start) + " - " + fmtDate(addDays(range.end, -1)) + "（精确到时刻）";
  } else {
    body = dayGanttHTML(list, a);
    rangeLabel = fmtDate(range.start) + " " + WEEK_NAMES[(range.start.getDay() + 6) % 7] + "（精确到时刻）";
  }
  const ownCount = list.filter(function(t){ return taskKind(t, a) === "own"; }).length;
  const assignedCount = list.filter(function(t){ return taskKind(t, a) === "assigned"; }).length;
  const otherCount = list.filter(function(t){ return taskKind(t, a) === "other"; }).length;
  function legendKind(k){
    return '<span class="kind ' + k + '"><span class="kind-emoji" aria-hidden="true">' + KIND_EMOJI[k] +
      "</span>" + KIND_LABEL[k] + "</span>";
  }

  el.innerHTML =
    '<section class="card"><div class="row wrap"><strong class="small">' + esc(rangeLabel) + "</strong>" +
      '<span class="spacer"></span><span class="tiny muted">' + ownCount + " 项我负责 · " + assignedCount + " 项我分配 · " +
        otherCount + " 项仅可见</span></div>" +
      '<div class="legend" style="margin-top:6px">' +
        legendKind("own") + legendKind("assigned") + legendKind("other") +
        "<span>排列：跨度长→短，其次更紧急，最后截止更近</span>" +
      "</div>" +
      viewToolbarHTML() +
    "</section>" + body;
}

/* ============================== 页面：日志 ============================== */
function logCardHTML(l, a){
  const t = l.taskId ? taskById(l.taskId) : null;
  const mine = l.authorId === a.id;
  return '<article class="log-card">' +
    "<header><span class=\"who\">" + esc(personById(l.authorId).name) + "</span>" +
      "<span>" + esc(fmtDateTime(l.time)) + "</span>" +
      "<span>" + esc(relativeDayLabel(l.time)) + "</span>" +
      '<span class="spacer"></span>' +
      (mine
        ? '<button type="button" class="btn tiny-btn" data-action="edit-log" data-id="' + l.id + '">编辑</button>'
        : '<span class="tiny muted">只读</span>') +
    "</header>" +
    "<p>" + esc(l.content) + "</p>" +
    (t ? '<button type="button" class="btn ghost tiny-btn log-link" data-task="' + t.id + '">关联任务：' + esc(t.title) + "</button>" : '<span class="tiny muted">未关联任务</span>') +
  "</article>";
}

/* 日志页内容筛选：单选，按身份派生可用项 */
const LOG_FILTER_LABEL = {
  "logs": "日志",
  "reviews": "待我审核",
  "self": "我提交的自建任务",
  "consults": "我的请示",
  "pending-consults": "待处理请示"
};
function canReviewAnyone(a){
  return PEOPLE.some(function(p){
    const s = directSuperiorOf(p.id);
    return !!s && s.id === a.id;
  });
}
function mySelfCreated(a){
  return sortTasks(visibleTasks(a).filter(function(t){
    return t.selfCreated && t.creatorId === a.id && (t.status === "pending-create" || t.status === "rejected");
  }));
}
function pendingInboxFor(a){
  return inboxConsultations(a).filter(function(c){ return c.status === "pending"; });
}
function availableLogFilters(a){
  const ids = ["logs"];
  if (canReviewAnyone(a)) ids.push("reviews");
  ids.push("self");
  if (a.role === "middle") ids.push("consults");
  if (a.role === "upper") ids.push("pending-consults");
  return ids;
}
function logFilterCount(fid, a){
  if (fid === "logs") return visibleLogs(a).length;
  if (fid === "reviews") return pendingReviewCount(a);
  if (fid === "self") return mySelfCreated(a).length;
  if (fid === "consults") return sentConsultations(a).length;
  if (fid === "pending-consults") return pendingInboxFor(a).length;
  return 0;
}
function logFilterHint(fid, a){
  if (fid === "logs"){
    const scope = a.role === "upper" ? "全公司日志" : a.role === "middle" ? "本部门（" + a.dept + "）日志" : "本人日志";
    const total = visibleLogs(a).length;
    /* 内容筛选计数保持“权限内可见总数”；结果区标题报告查找命中的数量 */
    return logFindingActive()
      ? scope + " · 命中 " + filteredLogs(a).length + "/" + total + " 条"
      : scope + " · " + total + " 条";
  }
  if (fid === "reviews") return logFilterCount(fid, a) + " 项";
  if (fid === "self") return logFilterCount(fid, a) + " 项";
  if (fid === "consults") return "直属上层：" + (directSuperiorOf(a.id) ? directSuperiorOf(a.id).name : "无");
  return logFilterCount(fid, a) + " 条";
}
/* ---- 日志查找：权限过滤在前，只看自己与作者姓名条件在后 ---- */
function normalizeAuthorQuery(q){
  return String(q == null ? "" : q).trim().toLowerCase();
}
function logFindingActive(){
  return state.logsMineOnly || !!state.logAuthorQuery;
}
function canFindLogs(a){
  return a.role === "upper" || a.role === "middle";
}
/* 结果流水线：visibleLogs 是授权边界，任何查询都不能越过它 */
function filteredLogs(a){
  let list = visibleLogs(a);
  if (state.logsMineOnly){
    list = list.filter(function(l){ return l.authorId === a.id; });
  }
  const q = state.logAuthorQuery;
  if (q){
    list = list.filter(function(l){
      const p = personById(l.authorId);
      return !!p && p.name.toLowerCase().indexOf(q) !== -1;
    });
  }
  return list.slice().sort(function(x, y){ return y.time.getTime() - x.time.getTime(); });
}
function logFindingHTML(){
  const q = state.logAuthorQuery;
  return '<section class="card" id="logFindingCard">' +
    '<div class="card-head"><h2>日志查找</h2><span class="hint">不改变内容筛选</span></div>' +
    '<button type="button" class="filter-chip" id="mineOnlyBtn" data-action="toggle-logs-mine" aria-pressed="' +
      String(state.logsMineOnly) + '">只看自己</button>' +
    '<div class="field" style="margin-top:8px"><label for="logAuthorInput">按作者姓名查找</label>' +
      '<div class="row">' +
        '<input id="logAuthorInput" type="search" autocomplete="off" placeholder="输入作者姓名片段" value="' + esc(q) + '" />' +
        '<button type="button" class="btn tiny-btn" id="clearLogAuthor" data-action="clear-log-author"' +
          (q ? "" : " disabled") + ' aria-label="清除作者查找">清除</button>' +
      "</div>" +
      '<span class="tiny muted">不区分大小写，匹配作者姓名片段；与“只看自己”同时启用时取交集。</span>' +
    "</div></section>";
}
/* 各筛选对应的唯一内容块 */
function logsListHTML(a){
  const logs = filteredLogs(a);
  if (logs.length){
    return '<div class="stack log-list">' + logs.map(function(l){ return logCardHTML(l, a); }).join("") + "</div>";
  }
  /* 区分“权限内没有日志”和“查找条件没有命中” */
  return visibleLogs(a).length
    ? '<div class="empty">没有符合当前查找条件的日志，可调整或清除查找条件</div>'
    : '<div class="empty">暂无可见日志</div>';
}
function reviewItemsHTML(a){
  const created = pendingCreateFor(a), completed = pendingCompleteFor(a);
  const items = created.map(function(t){
    return '<div class="log-card"><header><span class="who">' + esc(creatorOf(t).name) + "</span><span>自建任务 · 待创建审核</span></header>" +
      "<p>" + esc(t.title) + "</p>" +
      '<div class="row wrap"><span class="badge b-pending">待创建审核</span>' + urgencyBadge(t.urgency) +
        '<span class="tiny muted">' + esc(fmtDue(t.due)) + "</span></div>" +
      '<div class="row"><button type="button" class="btn tiny-btn ok" data-action="approve-create" data-id="' + t.id + '">批准</button>' +
        '<button type="button" class="btn tiny-btn danger" data-action="reject-create" data-id="' + t.id + '">拒绝</button>' +
        '<button type="button" class="btn tiny-btn" data-task="' + t.id + '">查看详情</button></div></div>';
  }).concat(completed.map(function(t){
    return '<div class="log-card"><header><span class="who">' + esc(creatorOf(t).name) + "</span><span>完成申请 · 待完成审核</span></header>" +
      "<p>" + esc(t.title) + "</p>" +
      '<div class="row wrap"><span class="badge b-pending">待完成审核</span><span class="tiny muted">进度 ' + effectiveProgress(t) + "%</span></div>" +
      (t.progressNote ? '<p class="tiny muted" style="margin:0">进度备注：' + esc(t.progressNote) + "</p>" : "") +
      '<div class="row"><button type="button" class="btn tiny-btn ok" data-action="approve-complete" data-id="' + t.id + '">批准完成</button>' +
        '<button type="button" class="btn tiny-btn danger" data-action="reject-complete" data-id="' + t.id + '">退回</button>' +
        '<button type="button" class="btn tiny-btn" data-task="' + t.id + '">查看详情</button></div></div>';
  }));
  return items.length ? '<div class="stack">' + items.join("") + "</div>" : '<div class="empty">当前没有待你审核的事项</div>';
}
function selfItemsHTML(a){
  const mine = mySelfCreated(a);
  return mine.length
    ? '<div class="stack">' + mine.map(function(t){
        return '<div class="log-card"><header><span class="tname">' + esc(t.title) + "</span>" +
          '<span class="badge ' + STATUS_CLASS[t.status] + '">' + STATUS_LABEL[t.status] + "</span></header>" +
          '<div class="row wrap"><span class="tiny muted">提交于 ' + esc(fmtDateTime(t.start)) + "</span>" +
            '<span class="spacer"></span><button type="button" class="btn tiny-btn" data-task="' + t.id + '">查看详情</button></div>' +
          (t.reviewNote ? '<p class="tiny muted" style="margin:0">审核意见：' + esc(t.reviewNote) + "</p>" : "") + "</div>";
      }).join("") + "</div>"
    : '<div class="empty">暂无你提交的自建任务</div>';
}
function sentConsultsHTML(a){
  const list = sentConsultations(a);
  return list.length
    ? '<div class="stack">' + list.map(function(c){
        return '<div class="log-card"><header><span>提交于 ' + esc(fmtDateTime(c.time)) + "</span>" +
          '<span class="badge ' + (c.status === "pending" ? "b-pending" : "b-ok") + '">' + (c.status === "pending" ? "待回复" : "已回复") + "</span></header>" +
          "<p>" + esc(c.content) + "</p>" +
          (c.reply ? '<p class="tiny muted" style="margin:0">回复：' + esc(c.reply) + "</p>" : "") + "</div>";
      }).join("") + "</div>"
    : '<div class="empty">暂无请示记录</div>';
}
function inboxConsultsHTML(a){
  const list = pendingInboxFor(a);
  return list.length
    ? '<div class="stack">' + list.map(function(c){
        return '<div class="log-card"><header><span class="who">' + esc(personById(c.fromId).name) + "</span><span>" + esc(fmtDateTime(c.time)) + "</span></header>" +
          "<p>" + esc(c.content) + "</p>" +
          '<div class="row"><button type="button" class="btn tiny-btn primary" data-action="reply-consult" data-id="' + c.id + '">回复</button></div></div>';
      }).join("") + "</div>"
    : '<div class="empty">暂无待处理请示</div>';
}
function logContentHTML(fid, a){
  if (fid === "reviews") return reviewItemsHTML(a);
  if (fid === "self") return selfItemsHTML(a);
  if (fid === "consults") return sentConsultsHTML(a);
  if (fid === "pending-consults") return inboxConsultsHTML(a);
  return logsListHTML(a);
}
function renderLog(){
  const a = actor();
  const el = document.getElementById("page-log");
  const filters = availableLogFilters(a);
  if (filters.indexOf(state.logFilter) === -1) state.logFilter = "logs";
  const active = state.logFilter;

  const actionButtons = [
    '<button type="button" class="btn primary" data-action="new-log">写日志</button>',
    '<button type="button" class="btn" data-action="new-task">' + (a.role === "lower" ? "创建任务" : "创建 / 派发任务") + "</button>"
  ];
  if (a.role === "middle") actionButtons.push('<button type="button" class="btn" data-action="new-consult">发起请示</button>');

  const filterHTML = filters.map(function(fid){
    const on = fid === active;
    return '<button type="button" role="radio" aria-checked="' + on + '" class="filter-chip" data-log-filter="' + fid + '">' +
      "<span>" + esc(LOG_FILTER_LABEL[fid]) + '</span><span class="cnt">' + logFilterCount(fid, a) + "</span></button>";
  }).join("");

  const findingHTML = (active === "logs" && canFindLogs(a)) ? logFindingHTML() : "";

  el.innerHTML =
    '<section class="card"><div class="card-head"><h2>快捷操作</h2><span class="hint">即时命令</span></div>' +
      '<div class="action-grid">' + actionButtons.join("") + "</div></section>" +
    '<section class="card"><div class="card-head"><h2>内容筛选</h2><span class="hint">单选</span></div>' +
      '<div class="filter-group" role="radiogroup" aria-label="日志内容筛选">' + filterHTML + "</div></section>" +
    findingHTML +
    '<section class="card"><div class="card-head"><h2>' + esc(LOG_FILTER_LABEL[active]) + "</h2>" +
      '<span class="hint" id="logResultsCount">' + esc(logFilterHint(active, a)) + "</span></div>" +
      '<div id="logResults">' + logContentHTML(active, a) + "</div></section>";
}

/* 只重建结果区与计数：搜索输入框本身不参与重建，输入焦点与光标位置得以保留 */
function refreshLogResults(){
  const a = actor();
  const results = document.getElementById("logResults");
  if (!results) return;
  results.innerHTML = logContentHTML(state.logFilter, a);
  const count = document.getElementById("logResultsCount");
  if (count) count.textContent = logFilterHint(state.logFilter, a);
  const toggle = document.getElementById("mineOnlyBtn");
  if (toggle) toggle.setAttribute("aria-pressed", String(state.logsMineOnly));
  const clear = document.getElementById("clearLogAuthor");
  if (clear) clear.disabled = !state.logAuthorQuery;
}

/* ============================== 页面：AI地图 ============================== */
const KEYWORDS = ["校徽", "产线", "打样", "客户反馈", "总结", "排期", "支付故障", "设计规范", "竞品", "协作流程",
  "培训", "季度目标", "活动策划", "晨会", "视觉规范", "报价单", "新产品", "供应商", "预算", "物料", "样品种类", "验收"];
function keywordStats(list){
  const counts = KEYWORDS.map(function(k){
    let n = 0;
    list.forEach(function(t){ if (t.title.indexOf(k) !== -1 || (t.desc || "").indexOf(k) !== -1) n++; });
    return { word: k, n: n };
  }).filter(function(x){ return x.n > 0; });
  counts.sort(function(x, y){ return y.n - x.n || x.word.localeCompare(y.word, "zh"); });
  return counts.slice(0, 12);
}
function renderAI(){
  const a = actor();
  const el = document.getElementById("page-ai");
  const scoped = viewTasks(a);
  const deptTasks = TASKS.filter(function(t){ return taskInDept(t, a.dept); });
  const statBase = a.role === "upper" ? scoped : a.role === "middle" ? scoped : scoped;
  const cloudBase = a.role === "upper" ? TASKS.slice() : deptTasks;
  const done = statBase.filter(function(t){ return effectiveStatus(t) === "done"; }).length;
  const doing = statBase.filter(function(t){ return effectiveStatus(t) === "doing"; }).length;
  const open = statBase.filter(function(t){ return effectiveStatus(t) === "todo"; }).length;
  const review = statBase.filter(function(t){ return effectiveStatus(t) === "pending-complete" || effectiveStatus(t) === "pending-create"; }).length;
  const overdue = statBase.filter(function(t){ return isOverdue(t); }).length;
  const mine = scoped.filter(function(t){ return taskKind(t, a) === "own"; });

  const stats = [
    { k: "任务总数", v: statBase.length },
    { k: "进行中", v: doing },
    { k: "待开始", v: open },
    { k: "已完成", v: done },
    { k: "待审核", v: review },
    { k: "已逾期", v: overdue }
  ];

  const words = keywordStats(cloudBase);
  const maxN = words.length ? words[0].n : 1;
  const cloud = words.length
    ? words.map(function(w){
        const size = 12 + Math.round((w.n / maxN) * 8);
        const weight = w.n > 1 ? 700 : 500;
        const color = w.n > 1 ? "#1d4ed8" : "#4b5563";
        return '<span style="font-size:' + size + "px;font-weight:" + weight + ";color:" + color + '" title="' + esc(w.word + "：出现 " + w.n + " 次") + '">' + esc(w.word) + "</span>";
      }).join("")
    : '<span class="tiny muted">范围内暂无可提取的关键词</span>';

  const urgentMine = sortTasks(mine.filter(function(t){ return !isFinished(t); })).slice(0, 3);
  const advice = [];
  if (a.role === "upper"){
    advice.push("全公司当前共 " + statBase.length + " 项任务，其中进行中 " + doing + " 项、已完成 " + done + " 项、待审核 " + review + " 项。");
    advice.push(overdue ? "有 " + overdue + " 项任务已逾期，建议在周会上确认资源投入。" : "当前没有逾期任务，整体节奏可控。");
    advice.push("从公司词云看，校徽产线、打样与客户反馈是本周期的集中议题，建议优先保障产线交付质量。");
  } else {
    advice.push("你当前有 " + mine.length + " 项本人负责的任务，其中 " + mine.filter(function(t){ return !isFinished(t); }).length + " 项尚未完成。");
    if (urgentMine.length){
      advice.push("综合紧急程度与截止时间，" + urgentMine.map(function(t){ return "「" + t.title + "」"; }).join("、") + "最需要优先处理。");
    } else {
      advice.push("目前没有待推进的紧要任务，可关注后续派发的任务。");
    }
    advice.push("建议在日志中持续记录进度备注，便于" + (a.role === "middle" ? "你的直属上层" : "你的直属上级") + "了解进展。");
  }

  el.innerHTML =
    '<section class="card"><div class="card-head"><h2>任务数据统计</h2><span class="hint">' +
      (a.role === "upper" ? "全公司范围" : a.role === "middle" ? "本部门范围" : "本人范围") + "</span></div>" +
      '<div class="stat-grid">' + stats.map(function(s){
        return '<div class="stat"><div class="v">' + s.v + '</div><div class="k">' + s.k + "</div></div>";
      }).join("") + "</div></section>" +
    '<section class="card"><div class="card-head"><h2>关键词词云</h2><span class="hint">' +
      (a.role === "upper" ? "公司聚合" : "部门聚合（不含明细）") + "</span></div>" +
      '<div class="wc">' + cloud + "</div></section>" +
    '<section class="card"><div class="card-head"><h2>AI 建议</h2><span class="hint">' +
      (a.role === "upper" ? "公司级" : "个人向") + "</span></div>" +
      '<div>' + advice.map(function(x){ return '<div class="advice">' + esc(x) + "</div>"; }).join("") + "</div></section>";
}

/* ============================== 页面：我的 ============================== */
function renderMe(){
  const a = actor();
  document.getElementById("page-me").innerHTML =
    '<section class="card profile-card">' +
      '<div class="profile-row"><div class="avatar">' + esc(a.name.slice(0, 1)) + '</div><div><div class="v">' + esc(a.name) + '</div><div class="tiny muted">当前身份</div></div></div>' +
      '<div class="profile-row"><span class="k">姓名</span><span class="v">' + esc(a.name) + "</span></div>" +
      '<div class="profile-row"><span class="k">部门</span><span class="v">' + esc(a.dept) + "</span></div>" +
      '<div class="profile-row"><span class="k">角色</span><span class="v">' + esc(ROLE_LABEL[a.role]) + "</span></div>" +
    "</section>";
}

/* ============================== 弹层（详情与表单） ============================== */
const overlayEl = document.getElementById("overlay");
const sheetBodyEl = document.getElementById("sheetBody");
const sheetFootEl = document.getElementById("sheetFoot");
const sheetTitleEl = document.getElementById("sheetTitle");
let sheetStack = [];
let lastFocused = null;

function renderSheet(){
  if (!sheetStack.length){
    overlayEl.hidden = true;
    document.getElementById("sheetFoot").hidden = false;
    if (lastFocused && document.contains(lastFocused)) lastFocused.focus();
    lastFocused = null;
    return;
  }
  const view = sheetStack[sheetStack.length - 1];
  sheetTitleEl.textContent = view.title;
  sheetBodyEl.innerHTML = view.body;
  sheetFootEl.innerHTML = view.foot || "";
  sheetFootEl.hidden = !view.foot;
  overlayEl.hidden = false;
  sheetBodyEl.scrollTop = 0;
  const target = sheetBodyEl.querySelector("[data-autofocus]") ||
    sheetFootEl.querySelector("button") ||
    sheetBodyEl.querySelector("button, input, select, textarea");
  if (target) target.focus();
}
function openSheet(view){
  if (!lastFocused) lastFocused = document.activeElement;
  sheetStack.push(view);
  renderSheet();
}
function backSheet(){
  sheetStack.pop();
  renderSheet();
}
function closeSheet(){
  sheetStack = [];
  renderSheet();
}
function withBack(foot){
  const items = [];
  if (sheetStack.length > 1) items.push('<button type="button" class="btn" data-action="sheet-back">返回</button>');
  if (foot) items.push(foot);
  return items.join("");
}

/* ---------- 任务详情 ---------- */
function taskDetailView(id){
  const a = actor();
  const t = taskById(id);
  if (!t) return null;
  if (visibleTasks(a).indexOf(t) === -1) return null;   /* 范围外记录不展示详情 */

  const kind = taskKind(t, a);
  const allowed = visibleTasks(a);
  /* 关联任务同样受角色可见范围约束：不可见的上级/子任务/同级任务不得泄露标识信息 */
  const rawParent = t.parentId ? taskById(t.parentId) : null;
  const parent = rawParent && allowed.indexOf(rawParent) !== -1 ? rawParent : null;
  const hiddenParent = !!rawParent && !parent;
  const kids = childrenOf(t.id).filter(function(k){ return allowed.indexOf(k) !== -1; });
  /* 同级任务按真实上级关系推导，但只列出当前身份可见的同级任务 */
  const siblings = rawParent
    ? childrenOf(rawParent.id).filter(function(x){ return x.id !== t.id && allowed.indexOf(x) !== -1; })
    : [];
  const reviewer = t.status === "pending-create" ? createReviewer(t)
    : t.status === "pending-complete" ? completionReviewer(t) : null;

  let body = '<div class="row wrap">' + typeBadge(t) + statusBadge(t) + urgencyBadge(t.urgency) +
      '<span class="kind ' + kind + '"><span class="kind-emoji" aria-hidden="true">' + KIND_EMOJI[kind] +
      "</span>" + KIND_LABEL[kind] + "</span></div>";

  if (t.type === "abstract"){
    body += '<div class="callout">抽象任务不可直接执行，进展由普通子任务汇总得出，不提供进度录入与直接完成入口。</div>';
  }

  body += '<div class="kv">' +
      '<span class="k">名称</span><span class="v">' + esc(t.title) + "</span>" +
      '<span class="k">紧急程度</span><span class="v">' + urgencyBadge(t.urgency) + "</span>" +
      '<span class="k">创建者</span><span class="v">' + esc(creatorOf(t).name) + "</span>" +
      '<span class="k">负责人</span><span class="v">' +
        (t.type === "abstract"
          ? (kids.length ? esc(kids.map(function(k){ return assigneesOf(k).map(function(p){ return p.name; }).join("、"); }).filter(Boolean).join("、") || "由子任务决定") : "由子任务决定")
          : esc(assigneesOf(t).map(function(p){ return p.name; }).join("、") || "未指定")) + "</span>" +
      '<span class="k">截止日期</span><span class="v">' + esc(fmtDue(t.due)) + (isOverdue(t) ? ' <span class="is-overdue">已逾期</span>' : "") + "</span>" +
      '<span class="k">起止时间</span><span class="v">' + esc(fmtDateTime(t.start)) + " → " + esc(fmtDateTime(t.due)) + "</span>" +
      '<span class="k">完成情况</span><span class="v">' + esc(STATUS_LABEL[effectiveStatus(t)]) + "（" + effectiveProgress(t) + "%）</span>" +
      '<span class="k">进度备注</span><span class="v">' + (t.progressNote ? esc(t.progressNote) : "暂无") + "</span>" +
      (t.desc ? '<span class="k">说明</span><span class="v">' + esc(t.desc) + "</span>" : "") +
    "</div>";

  body += '<div class="progress-track" role="img" aria-label="完成进度 ' + effectiveProgress(t) + '%"><i style="width:' + effectiveProgress(t) + '%"></i></div>';

  if (parent){
    body += '<div class="divider"></div><div class="card-head"><h2>上级任务</h2></div>' +
      '<button type="button" class="child-task" data-task="' + parent.id + '">' +
        '<span class="t-title"><span>' + esc(parent.title) + "</span>" + typeBadge(parent) + "</span>" +
        '<span class="task-meta">' + statusBadge(parent) + urgencyBadge(parent.urgency) + "<span>" + esc(fmtDue(parent.due)) + "</span></span></button>";
  } else if (hiddenParent){
    /* 只说明存在上下级关系，不暴露范围外任务的名称、状态或时间 */
    body += '<div class="divider"></div><div class="card-head"><h2>上级任务</h2></div>' +
      '<div class="callout info">该任务属于一个上级任务，但上级任务超出当前身份的可见范围。</div>';
  }
  if (kids.length){
    const kidDone = kids.filter(function(k){ return effectiveStatus(k) === "done"; }).length;
    body += '<div class="divider"></div><div class="card-head"><h2>子任务</h2><span class="hint">' + kidDone + "/" + kids.length + ' 已完成</span></div><div class="stack">' +
      kids.map(function(k){
        return '<button type="button" class="child-task" data-task="' + k.id + '">' +
          '<span class="t-title"><span>' + esc(k.title) + "</span></span>" +
          '<span class="task-meta">' + kindTag(k, a) + statusBadge(k) + urgencyBadge(k.urgency) +
            "<span>" + esc(fmtDue(k.due)) + "</span><span>进度 " + effectiveProgress(k) + "%</span></span></button>";
      }).join("") + "</div>";
  }
  if (siblings.length){
    body += '<div class="divider"></div><div class="card-head"><h2>同级任务</h2><span class="hint">同一上级任务下</span></div><div class="stack">' +
      siblings.map(function(s){
        return '<button type="button" class="child-task" data-task="' + s.id + '">' +
          '<span class="t-title"><span>' + esc(s.title) + "</span></span>" +
          '<span class="task-meta">' + statusBadge(s) + urgencyBadge(s.urgency) + "<span>" + esc(fmtDue(s.due)) + "</span></span></button>";
      }).join("") + "</div>";
  }
  if (t.reviewNote){
    body += '<div class="callout reject">审核意见：' + esc(t.reviewNote) + "</div>";
  }
  if (reviewer){
    body += '<div class="callout info">当前审核人：' + esc(reviewer.name) +
      (t.status === "pending-create" ? "（创建审核）" : "（完成审核）") + "</div>";
  } else if (t.status === "pending-complete" && !completionReviewer(t)){
    body += '<div class="callout info">该任务没有更高的审核人，提交完成后将直接标记为已完成。</div>';
  }

  const foot = [];
  if (canEditTask(a, t)) foot.push('<button type="button" class="btn primary" data-action="edit-task" data-id="' + t.id + '">编辑任务</button>');
  if (canUpdateProgress(a, t)) foot.push('<button type="button" class="btn" data-action="update-progress" data-id="' + t.id + '">更新进度</button>');
  if (canUpdateProgress(a, t)) foot.push('<button type="button" class="btn ok" data-action="submit-complete" data-id="' + t.id + '">提交完成</button>');
  if (t.status === "pending-create" && createReviewer(t) && createReviewer(t).id === a.id){
    foot.push('<button type="button" class="btn ok" data-action="approve-create" data-id="' + t.id + '">批准创建</button>');
    foot.push('<button type="button" class="btn danger" data-action="reject-create" data-id="' + t.id + '">拒绝</button>');
  }
  if (t.status === "pending-complete" && completionReviewer(t) && completionReviewer(t).id === a.id){
    foot.push('<button type="button" class="btn ok" data-action="approve-complete" data-id="' + t.id + '">批准完成</button>');
    foot.push('<button type="button" class="btn danger" data-action="reject-complete" data-id="' + t.id + '">退回</button>');
  }
  if (!foot.length) foot.push('<button type="button" class="btn" data-action="sheet-close">关闭</button>');

  return { title: t.title, body: body, foot: withBack(foot.join(""), a) };
}

/* ---------- 日志详情 ---------- */
function logDetailView(id){
  const a = actor();
  const l = logById(id);
  if (!l || visibleLogs(a).indexOf(l) === -1) return null;
  const t = l.taskId ? taskById(l.taskId) : null;
  const mine = l.authorId === a.id;
  const body = '<div class="kv">' +
      '<span class="k">作者</span><span class="v">' + esc(personById(l.authorId).name) + "</span>" +
      '<span class="k">时间</span><span class="v">' + esc(fmtDateTime(l.time)) + "</span>" +
      '<span class="k">关联任务</span><span class="v">' + (t ? esc(t.title) : "未关联") + "</span>" +
      '<span class="k">编辑权限</span><span class="v">' + (mine ? "本人可编辑" : "仅作者可编辑，当前为只读") + "</span>" +
    "</div><div class=\"divider\"></div><p style=\"margin:0;font-size:13px;white-space:pre-wrap\">" + esc(l.content) + "</p>" +
    (t ? '<div class="divider"></div><button type="button" class="btn" data-task="' + t.id + '">查看关联任务</button>' : "");
  const foot = [];
  if (mine) foot.push('<button type="button" class="btn primary" data-action="edit-log" data-id="' + l.id + '">编辑日志</button>');
  foot.push('<button type="button" class="btn" data-action="sheet-close">关闭</button>');
  return { title: "日志详情", body: body, foot: withBack(foot.join(""), a) };
}

/* ---------- 溢出任务列表 ---------- */
function overflowView(gid){
  const g = overflowGroups[gid];
  const a = actor();
  if (!g) return null;
  const allowed = visibleTasks(a);
  const items = g.ids.map(taskById).filter(function(t){ return t && allowed.indexOf(t) !== -1; });
  return {
    title: g.title,
    body: '<div class="stack">' + items.map(function(t){ return taskItemHTML(t, a); }).join("") + "</div>",
    foot: '<button type="button" class="btn" data-action="sheet-close">关闭</button>'
  };
}

/* ---------- 通知列表 ---------- */
function notificationsView(){
  const a = actor();
  const items = notificationsFor(a);
  const body = items.length
    ? items.map(function(n){
        const t = taskById(n.taskId);
        const isRead = n.read.indexOf(a.id) !== -1;
        return '<button type="button" class="notif' + (isRead ? " is-read" : "") + '" data-action="open-notif" data-id="' + n.id + '">' +
          '<span class="ndot" aria-hidden="true"></span>' +
          '<span class="nbody"><span class="ntitle">' + esc(t.title) + "</span>" +
            '<span class="nmeta"><span class="badge ' + NOTIF_CLASS[n.type] + '">' + NOTIF_LABEL[n.type] + "</span> " +
              esc(fmtDateTime(n.time)) + (isRead ? "" : " · 未读") + "</span></span></button>";
      }).join("")
    : '<div class="empty">暂无通知</div>';
  return { title: "通知", body: body, foot: '<button type="button" class="btn" data-action="sheet-close">关闭</button>' };
}

/* ---------- 表单：创建 / 编辑任务 ---------- */
function taskFormView(mode, id){
  const a = actor();
  const t = mode === "edit" ? taskById(id) : null;
  if (mode === "edit" && (!t || !canEditTask(a, t))) return null;
  const isAbstract = t ? t.type === "abstract" : false;
  const people = assignablePeople(a);
  const parents = parentCandidates(a, t);
  const currentParentId = t && t.parentId ? t.parentId : null;
  const currentParentVisible = !!currentParentId && parents.some(function(p){ return p.id === currentParentId; });
  const due = t ? t.due : at(3, 18, 0);
  const assigneeIds = t ? t.assigneeIds : (a.role === "lower" ? [a.id] : []);
  const urgency = t ? t.urgency : "中";

  let body = '<div class="field"><label for="tf-title">任务名称</label>' +
    '<input id="tf-title" type="text" value="' + esc(t ? t.title : "") + '" data-autofocus /></div>';
  body += '<div class="field"><label for="tf-desc">说明</label><textarea id="tf-desc">' + esc(t ? t.desc : "") + "</textarea></div>";

  if (mode === "create"){
    body += '<div class="field"><label>任务类型</label><div class="choice-row" id="tf-type">' +
      '<button type="button" class="choice" data-type="normal" aria-pressed="true">普通任务</button>' +
      '<button type="button" class="choice" data-type="abstract" aria-pressed="false">抽象任务</button>' +
      "</div></div>";
  } else {
    body += '<div class="field"><label>任务类型</label><div class="tiny muted">' + (isAbstract ? "抽象任务（由子任务汇总）" : "普通任务") + "</div></div>";
  }

  body += '<div class="field"><label for="tf-parent">上级任务（可选）</label><select id="tf-parent"><option value="">无</option>' +
    parents.map(function(p){
      return '<option value="' + p.id + '"' + (currentParentId === p.id ? " selected" : "") + ">" + esc(p.title) +
        (p.type === "abstract" ? "（抽象任务）" : "") + "</option>";
    }).join("") +
    (currentParentId && !currentParentVisible
      ? '<option value="' + currentParentId + '" selected>保留现有上级任务（超出可见范围）</option>'
      : "") +
    "</select></div>";

  body += '<div class="row"><div class="field" style="flex:1"><label for="tf-due-date">截止日期</label>' +
    '<input id="tf-due-date" type="date" value="' + toDateInput(due) + '" /></div>' +
    '<div class="field" style="flex:1"><label for="tf-due-time">截止时刻</label>' +
    '<input id="tf-due-time" type="time" value="' + toTimeInput(due) + '" /></div></div>';

  body += '<div class="field"><label>紧急程度</label><div class="choice-row" id="tf-urgency">' +
    ["紧急", "高", "中", "低"].map(function(u){
      return '<button type="button" class="choice" data-urgency="' + u + '" aria-pressed="' + (urgency === u) + '">' + u + "</button>";
    }).join("") + "</div></div>";

  body += '<div class="field" id="tf-assignee-field"' + (isAbstract ? ' hidden' : "") + '><label>负责人（可多选）</label><div class="stack">' +
    people.map(function(p){
      return '<label class="checkline"><input type="checkbox" data-assignee="' + p.id + '"' +
        (assigneeIds.indexOf(p.id) !== -1 ? " checked" : "") + " />" + esc(p.name) +
        '<span class="meta">' + esc(ROLE_LABEL[p.role]) + " · " + esc(p.dept) + "</span></label>";
    }).join("") + "</div>" +
    (a.role === "lower" ? '<div class="tiny muted">下层只能给自己创建任务，需直属上级审核后生效。</div>' : "") +
    (a.role === "middle" ? '<div class="tiny muted">中层只能派发给本部门下层或自己。</div>' : "") +
    "</div>";

  if (!isAbstract) body += '<div class="field" id="tf-progress-field"><label for="tf-progress">初始进度</label>' +
    '<input id="tf-progress" type="number" min="0" max="100" value="' + (t ? t.progress : 0) + '" /></div>';

  body += '<div class="callout" id="tf-error" hidden></div>';
  if (a.role === "lower" || a.role === "middle"){
    body += '<div class="callout info">' + (a.role === "lower" ? "下层" : "中层") + "自建任务需经直属上级审核通过后才进入执行状态。</div>";
  }

  const foot = withBack('<button type="button" class="btn primary" data-action="save-task" data-mode="' + mode + '"' +
    (t ? ' data-id="' + t.id + '"' : "") + ">保存</button>", a);
  return { title: mode === "create" ? "创建任务" : "编辑任务", body: body, foot: foot };
}

/* ---------- 表单：更新进度 / 提交完成 / 日志 / 请示 / 信息条目 ---------- */
function progressFormView(id){
  const a = actor();
  const t = taskById(id);
  if (!t || !canUpdateProgress(a, t)) return null;
  const body = '<div class="callout info">负责人只能更新进度与进度备注，不能修改名称、截止日期、紧急程度或负责人。</div>' +
    '<div class="field"><label for="pf-progress">当前进度（%）</label><input id="pf-progress" type="number" min="0" max="100" value="' + t.progress + '" data-autofocus /></div>' +
    '<div class="field"><label for="pf-note">进度备注</label><textarea id="pf-note">' + esc(t.progressNote) + "</textarea></div>" +
    '<div class="callout" id="pf-error" hidden></div>';
  return { title: "更新进度", body: body,
    foot: withBack('<button type="button" class="btn primary" data-action="save-progress" data-id="' + t.id + '">保存进度</button>', a) };
}
function submitCompleteView(id){
  const a = actor();
  const t = taskById(id);
  if (!t || !canUpdateProgress(a, t)) return null;
  const reviewer = completionReviewer(t);
  const body = reviewer
    ? '<div class="callout info">提交后任务进入待完成审核，审核人：' + esc(reviewer.name) + "。批准后任务标记为已完成，退回则恢复进行中。</div>"
    : '<div class="callout info">该任务没有更高的审核人（上层自建任务），提交后直接标记为已完成。</div>' +
      '<div class="field"><label for="cf-note">完成说明</label><textarea id="cf-note">' + esc(t.progressNote) + "</textarea></div>";
  return { title: "提交完成", body: body,
    foot: withBack('<button type="button" class="btn ok" data-action="confirm-complete" data-id="' + t.id + '">确认提交</button>', a) };
}
function logFormView(id){
  const a = actor();
  const l = id ? logById(id) : null;
  if (id && (!l || l.authorId !== a.id)) return null;
  const choices = visibleTasks(a).filter(function(t){ return t.type === "normal"; });
  const body = '<div class="field"><label for="lf-content">日志内容</label><textarea id="lf-content" data-autofocus>' + esc(l ? l.content : "") + "</textarea></div>" +
    '<div class="field"><label for="lf-task">关联任务（可选）</label><select id="lf-task"><option value="">不关联任务</option>' +
      choices.map(function(t){
        return '<option value="' + t.id + '"' + (l && l.taskId === t.id ? " selected" : "") + ">" + esc(t.title) + "</option>";
      }).join("") + "</select>" +
      '<span class="tiny muted">日志归属于本人，可被范围内的上级查看，但只有本人可以编辑。</span></div>' +
    '<div class="callout" id="lf-error" hidden></div>';
  return { title: l ? "编辑日志" : "写日志", body: body,
    foot: withBack('<button type="button" class="btn primary" data-action="save-log"' + (l ? ' data-id="' + l.id + '"' : "") + ">保存日志</button>", a) };
}
function consultFormView(){
  const a = actor();
  if (a.role !== "middle") return null;
  const sup = directSuperiorOf(a.id);
  const body = '<div class="callout info">请示发送给直属上层：' + esc(sup ? sup.name : "无") + "。仅用于上下级沟通，不用于修改任务字段。</div>" +
    '<div class="field"><label for="qk-content">请示内容</label><textarea id="qk-content" data-autofocus></textarea></div>' +
    '<div class="callout" id="qk-error" hidden></div>';
  return { title: "发起请示", body: body,
    foot: withBack('<button type="button" class="btn primary" data-action="save-consult">提交请示</button>', a) };
}
function replyConsultView(id){
  const a = actor();
  const c = CONSULTATIONS.find(function(x){ return x.id === id; });
  if (!c || c.toId !== a.id) return null;
  const body = '<div class="callout info">来自 ' + esc(personById(c.fromId).name) + " 于 " + esc(fmtDateTime(c.time)) + "</div>" +
    '<p style="margin:0;font-size:13px">' + esc(c.content) + "</p>" +
    '<div class="field"><label for="rp-content">回复内容</label><textarea id="rp-content" data-autofocus></textarea></div>' +
    '<div class="callout" id="rp-error" hidden></div>';
  return { title: "回复请示", body: body,
    foot: withBack('<button type="button" class="btn primary" data-action="save-reply" data-id="' + c.id + '">发送回复</button>', a) };
}
function rejectFormView(kind, id){
  const a = actor();
  const t = taskById(id);
  if (!t) return null;
  const isCreate = kind === "create";
  const reviewer = isCreate ? createReviewer(t) : completionReviewer(t);
  if (!reviewer || reviewer.id !== a.id) return null;
  const body = '<div class="callout info">' + (isCreate ? "拒绝后该自建任务不会进入执行任务列表。" : "退回后任务恢复为进行中，审核结果会保留给负责人查看。") + "</div>" +
    '<div class="field"><label for="rj-reason">' + (isCreate ? "拒绝原因" : "退回原因") + '</label><textarea id="rj-reason" data-autofocus></textarea></div>' +
    '<div class="callout" id="rj-error" hidden></div>';
  return { title: isCreate ? "拒绝创建" : "退回完成申请", body: body,
    foot: withBack('<button type="button" class="btn danger" data-action="confirm-reject" data-kind="' + kind + '" data-id="' + t.id + '">确认</button>', a) };
}
function companyItemFormView(id){
  const a = actor();
  if (a.role !== "upper") return null;
  const it = id ? COMPANY_ITEMS.find(function(x){ return x.id === id; }) : null;
  if (id && !it) return null;
  return { title: it ? "编辑公司信息" : "添加公司信息",
    body: '<div class="field"><label for="ci-text">内容</label><input id="ci-text" type="text" value="' + esc(it ? it.text : "") + '" data-autofocus /></div>' +
      '<div class="tiny muted">公司统一信息对所有身份可见，最多 10 条。</div>' +
      '<div class="callout" id="ci-error" hidden></div>',
    foot: withBack('<button type="button" class="btn primary" data-action="save-company"' + (it ? ' data-id="' + it.id + '"' : "") + ">保存</button>", a) };
}
/* 删除确认：公司与个人信息共用 */
function confirmDeleteView(kind, id){
  const a = actor();
  const isCompany = kind === "company";
  let text = "";
  if (isCompany){
    if (a.role !== "upper") return null;
    const it = COMPANY_ITEMS.find(function(x){ return x.id === id; });
    if (!it) return null;
    text = it.text;
  } else {
    const it = personalItemsFor(a.id).find(function(x){ return x.id === id; });
    if (!it) return null;
    text = it.text;
  }
  return { title: isCompany ? "删除公司信息" : "删除个人信息",
    body: '<div class="callout reject">删除后无法恢复，请确认是否删除以下内容。</div>' +
      '<p style="margin:0;font-size:13px;overflow-wrap:anywhere">' + esc(text) + "</p>",
    foot: withBack('<button type="button" class="btn danger" data-action="confirm-delete" data-kind="' + kind +
      '" data-id="' + id + '">确认删除</button>', a) };
}
function personalItemFormView(id){
  const a = actor();
  const items = personalItemsFor(a.id);
  const it = id ? items.find(function(x){ return x.id === id; }) : null;
  if (id && !it) return null;
  return { title: it ? "编辑个人信息" : "添加个人信息",
    body: '<div class="field"><label for="pi-text">内容</label><input id="pi-text" type="text" value="' + esc(it ? it.text : "") + '" data-autofocus /></div>' +
      '<div class="tiny muted">个人信息由本人维护，默认取自本人日志摘录，编辑个人信息不会改写原始日志。</div>' +
      '<div class="callout" id="pi-error" hidden></div>',
    foot: withBack('<button type="button" class="btn primary" data-action="save-personal"' + (it ? ' data-id="' + it.id + '"' : "") + ">保存</button>", a) };
}

/* ============================== 操作与状态变更 ============================== */
let SEQ = 100;
function nextId(prefix){ SEQ += 1; return prefix + SEQ; }
function showError(elId, msg){
  const el = document.getElementById(elId);
  if (el){ el.hidden = false; el.textContent = msg; }
}
function unique(list){
  return list.filter(function(x, i){ return x && list.indexOf(x) === i; });
}
/* 任务创建通知：面向创建者与全部负责人 */
function notifyTaskCreated(t){
  const recipients = unique([t.creatorId].concat(t.assigneeIds));
  NOTIFICATIONS.push({
    id: nextId("n"), type: "create", taskId: t.id, recipients: recipients,
    time: new Date(), read: []
  });
}

function saveTask(mode, id){
  const a = actor();
  const titleEl = document.getElementById("tf-title");
  const title = titleEl ? titleEl.value.trim() : "";
  if (!title) return showError("tf-error", "请填写任务名称。");
  const dateEl = document.getElementById("tf-due-date");
  const timeEl = document.getElementById("tf-due-time");
  if (!dateEl.value || !timeEl.value) return showError("tf-error", "请填写截止日期与时刻。");
  const parts = dateEl.value.split("-").map(Number);
  const hm = timeEl.value.split(":").map(Number);
  const due = new Date(parts[0], parts[1] - 1, parts[2], hm[0], hm[1], 0, 0);
  if (isNaN(due.getTime())) return showError("tf-error", "截止时间无效。");

  const urgencyEl = document.querySelector('#tf-urgency [aria-pressed="true"]');
  const urgency = urgencyEl ? urgencyEl.dataset.urgency : "中";
  const desc = document.getElementById("tf-desc").value.trim();
  const parentSel = document.getElementById("tf-parent");
  const parentId = parentSel && parentSel.value ? parentSel.value : null;

  const existing = mode === "edit" ? taskById(id) : null;
  const type = existing ? existing.type : (document.querySelector('#tf-type [aria-pressed="true"]').dataset.type);
  let assigneeIds = [];
  if (type === "normal"){
    assigneeIds = Array.prototype.slice.call(document.querySelectorAll("[data-assignee]"))
      .filter(function(cb){ return cb.checked; })
      .map(function(cb){ return cb.dataset.assignee; });
    if (!assigneeIds.length) return showError("tf-error", "普通任务至少需要一名负责人。");
  }
  const allowed = assignablePeople(a).map(function(p){ return p.id; });
  if (assigneeIds.some(function(x){ return allowed.indexOf(x) === -1; })){
    return showError("tf-error", "存在超出当前身份范围的负责人。");
  }
  if (parentId && !taskById(parentId)){
    return showError("tf-error", "上级任务不存在。");
  }
  /* 只有当前已建立且不可见的上级关系可以被保留；重新指定必须落在可见范围内 */
  const isKeptExistingParent = !!(existing && existing.parentId === parentId);
  if (parentId && !isKeptExistingParent && visibleTasks(a).indexOf(taskById(parentId)) === -1){
    return showError("tf-error", "上级任务不在当前可见范围内。");
  }
  if (parentId && existing && parentId === existing.id){
    return showError("tf-error", "任务不能以自己作为上级任务。");
  }
  if (parentId && existing && taskById(parentId).parentId === existing.id){
    return showError("tf-error", "任务不能以自己的一级子任务作为上级任务。");
  }

  if (mode === "edit"){
    /* 提交处理同样复用编辑权限规则，而不只是隐藏入口 */
    if (!canEditTask(a, existing)) return showError("tf-error", "只有任务创建者可以修改任务信息。");
    existing.title = title;
    existing.desc = desc;
    existing.due = due;
    existing.urgency = urgency;
    existing.parentId = parentId;
    if (existing.type === "normal"){
      existing.assigneeIds = assigneeIds;
      existing.selfCreated = assigneeIds.indexOf(existing.creatorId) !== -1;
      const p = document.getElementById("tf-progress");
      if (p){ existing.progress = Math.max(0, Math.min(100, Number(p.value) || 0)); }
    }
    renderAll();
    closeSheet();
    return;
  }

  const selfCreated = type === "abstract" ? a.role !== "upper" : assigneeIds.indexOf(a.id) !== -1;
  const t = mkTask({
    id: nextId("t"), type: type, title: title, desc: desc, parentId: parentId,
    creatorId: a.id, assigneeIds: assigneeIds, selfCreated: selfCreated,
    start: new Date(), due: due, urgency: urgency, status: "todo", progress: 0, progressNote: ""
  });
  const progressEl = document.getElementById("tf-progress");
  if (progressEl && type === "normal"){
    t.progress = Math.max(0, Math.min(100, Number(progressEl.value) || 0));
    if (t.progress > 0) t.status = "doing";
  }
  const reviewer = createReviewer(t);
  if (selfCreated && reviewer){
    t.status = "pending-create";
    t.progress = 0;
  }
  TASKS.push(t);
  if (t.status !== "pending-create") notifyTaskCreated(t);
  renderAll();
  closeSheet();
}

function saveProgress(id){
  const a = actor();
  const t = taskById(id);
  if (!t || !canUpdateProgress(a, t)) return;
  const p = Number(document.getElementById("pf-progress").value);
  if (isNaN(p) || p < 0 || p > 100) return showError("pf-error", "进度需为 0 到 100 之间的数字。");
  t.progress = Math.round(p);
  t.progressNote = document.getElementById("pf-note").value.trim();
  if (t.progress > 0 && t.status === "todo") t.status = "doing";
  renderAll();
  closeSheet();
}
function confirmComplete(id){
  const a = actor();
  const t = taskById(id);
  if (!t || !canUpdateProgress(a, t)) return;
  const noteEl = document.getElementById("cf-note");
  if (noteEl && noteEl.value.trim()) t.progressNote = noteEl.value.trim();
  t.progress = 100;
  const reviewer = completionReviewer(t);
  t.status = reviewer ? "pending-complete" : "done";
  t.reviewNote = "";
  renderAll();
  closeSheet();
}
function approveCreate(id){
  const a = actor();
  const t = taskById(id);
  if (!t || t.status !== "pending-create") return;
  const r = createReviewer(t);
  if (!r || r.id !== a.id) return;
  t.status = "todo";
  t.reviewNote = "";
  notifyTaskCreated(t);
  afterReviewAction();
}
function rejectTask(kind, id, reason){
  const a = actor();
  const t = taskById(id);
  if (!t) return;
  if (kind === "create"){
    const r = createReviewer(t);
    if (!r || r.id !== a.id || t.status !== "pending-create") return;
    t.status = "rejected";
    t.reviewNote = reason;
  } else {
    const r = completionReviewer(t);
    if (!r || r.id !== a.id || t.status !== "pending-complete") return;
    t.status = "doing";
    t.reviewNote = reason;
  }
  afterReviewAction();
}
function approveComplete(id){
  const a = actor();
  const t = taskById(id);
  if (!t || t.status !== "pending-complete") return;
  const r = completionReviewer(t);
  if (!r || r.id !== a.id) return;
  t.status = "done";
  t.progress = 100;
  t.reviewNote = "";
  afterReviewAction();
}
/* 审核后：刷新日志页当前筛选的列表与计数，并关闭可能打开的任务详情弹层 */
function afterReviewAction(){
  renderAll();
  closeSheet();
}

function saveLog(id){
  const a = actor();
  const content = document.getElementById("lf-content").value.trim();
  if (!content) return showError("lf-error", "请填写日志内容。");
  const taskSel = document.getElementById("lf-task");
  const taskId = taskSel && taskSel.value ? taskSel.value : null;
  if (id){
    const l = logById(id);
    if (!l || l.authorId !== a.id) return;
    l.content = content;
    l.taskId = taskId;
  } else {
    LOGS.push({ id: nextId("l"), authorId: a.id, time: new Date(), taskId: taskId, content: content });
  }
  renderAll();
  closeSheet();
}
function saveConsult(){
  const a = actor();
  if (a.role !== "middle") return;
  const sup = directSuperiorOf(a.id);
  if (!sup) return showError("qk-error", "当前身份没有直属上层。");
  const content = document.getElementById("qk-content").value.trim();
  if (!content) return showError("qk-error", "请填写请示内容。");
  CONSULTATIONS.push({ id: nextId("c"), fromId: a.id, toId: sup.id, time: new Date(), content: content, status: "pending", reply: "" });
  renderAll();
  closeSheet();
}
function saveReply(id){
  const a = actor();
  const c = CONSULTATIONS.find(function(x){ return x.id === id; });
  if (!c || c.toId !== a.id) return;
  const content = document.getElementById("rp-content").value.trim();
  if (!content) return showError("rp-error", "请填写回复内容。");
  c.reply = content;
  c.status = "replied";
  c.replyTime = new Date();
  renderAll();
  closeSheet();
}
function saveCompanyItem(id){
  const a = actor();
  if (a.role !== "upper") return;
  const textEl = document.getElementById("ci-text");
  const text = textEl ? textEl.value.trim() : "";
  if (!text) return showError("ci-error", "内容不能为空。");
  if (id){
    const it = COMPANY_ITEMS.find(function(x){ return x.id === id; });
    if (!it) return;
    it.text = text;
  } else {
    /* 保存处理同样执行上限校验，不只依赖界面禁用 */
    if (COMPANY_ITEMS.length >= 10) return showError("ci-error", "公司统一信息最多 10 条，请先删除后再新增。");
    COMPANY_ITEMS.push({ id: nextId("co"), text: text });
  }
  renderAll();
  closeSheet();
}
/* 删除公司与个人信息：个人信息在首次变更前先物化日志摘录 */
function deleteItem(kind, id){
  const a = actor();
  if (kind === "company"){
    if (a.role !== "upper") return;
    const i = COMPANY_ITEMS.findIndex(function(x){ return x.id === id; });
    if (i === -1) return;
    COMPANY_ITEMS.splice(i, 1);
  } else {
    const st = materializePersonal(a.id);
    const i = st.items.findIndex(function(x){ return x.id === id; });
    if (i === -1) return;
    st.items.splice(i, 1);
  }
  renderAll();
  closeSheet();
}
function materializePersonal(pid){
  const st = ensurePersonal(pid);
  if (!st.edited){
    st.items = personalItemsFor(pid).map(function(x){ return { id: x.id, text: x.text, logId: x.logId }; });
    st.edited = true;
  }
  return st;
}
function savePersonalItem(id){
  const a = actor();
  const st = materializePersonal(a.id);
  const textEl = document.getElementById("pi-text");
  const text = textEl ? textEl.value.trim() : "";
  if (!text) return showError("pi-error", "内容不能为空。");
  if (id){
    const it = st.items.find(function(x){ return x.id === id; });
    if (!it) return;
    it.text = text;
  } else {
    if (st.items.length >= 10) return showError("pi-error", "个人信息最多 10 条，请先删除后再新增。");
    st.items.push({ id: nextId("pi"), text: text, logId: null });
  }
  renderAll();
  closeSheet();
}

/* ============================== 弹层导航 ============================== */
function openTaskDetail(id){
  const v = taskDetailView(id);
  if (!v){ backSheet(); return; }
  openSheet(v);
}
function openLogDetail(id){
  const v = logDetailView(id);
  if (!v) return;
  openSheet(v);
}
function openNotifications(){
  openSheet(notificationsView());
}

/* ============================== 事件与渲染调度 ============================== */
const PAGE_TITLE = { map: "导图", view: "视图", log: "日志", ai: "AI地图", me: "我的" };
const RENDER = { map: renderMap, view: renderView, log: renderLog, ai: renderAI, me: renderMe };

function updateToTop(){
  const main = document.getElementById("appMain");
  const btn = document.getElementById("toTopBtn");
  if (!main || !btn) return;
  btn.hidden = !(state.page === "log" && main.scrollTop > 40);
}
function renderAll(){
  const a = actor();
  document.getElementById("whoami").textContent = a.name.replace(/（.*$/, "") + " · " + ROLE_LABEL[a.role];
  document.getElementById("pageTitle").textContent = PAGE_TITLE[state.page];
  document.querySelectorAll("#tabbar button").forEach(function(b){
    b.setAttribute("aria-selected", String(b.dataset.page === state.page));
  });
  document.querySelectorAll(".page").forEach(function(p){
    p.classList.toggle("is-active", p.id === "page-" + state.page);
  });
  /* 导图页锁定主内容区滚动，其他页恢复滚动 */
  document.getElementById("appMain").classList.toggle("is-map", state.page === "map");
  RENDER[state.page]();
  const n = unreadCount(a);
  const dot = document.getElementById("bellDot");
  dot.hidden = n === 0;
  dot.textContent = n > 9 ? "9+" : String(n);
  document.getElementById("bellBtn").setAttribute("aria-label", n ? "通知，" + n + " 条未读" : "通知，无未读");
  document.querySelectorAll(".role-switch button").forEach(function(b){
    b.setAttribute("aria-pressed", String(ROLE_ACCOUNT[b.dataset.role] === a.id));
  });
  updateToTop();
}
function setRole(role){
  state.actorId = ROLE_ACCOUNT[role];
  state.logFilter = "logs";   /* 切换身份后日志筛选回到默认“日志” */
  state.logsMineOnly = false; /* 日志查找条件随身份重置 */
  state.logAuthorQuery = "";
  state.pickerOpen = false;
  closeSheet();
  renderAll();
}
function setPage(page){
  state.page = page;
  if (page !== "view") state.pickerOpen = false;
  renderAll();
  document.getElementById("appMain").scrollTop = 0;
  updateToTop();
}

/* 弹层内的临时选择状态 */
const formChoice = { type: "normal", urgency: "中" };
function syncChoiceRow(selector, attr, value){
  document.querySelectorAll(selector + " [" + attr + "]").forEach(function(b){
    b.setAttribute("aria-pressed", String(b.dataset[attr.replace("data-", "")] === value));
  });
}

function runAction(el){
  const action = el.dataset.action;
  const id = el.dataset.id;
  switch (action){
    case "sheet-close": closeSheet(); return;
    case "sheet-back": backSheet(); return;
    case "new-log": openSheet(logFormView()); return;
    case "edit-log": openSheet(logFormView(id)); return;
    case "new-task":
      formChoice.type = "normal"; formChoice.urgency = "中";
      openSheet(taskFormView("create")); return;
    case "edit-task": openSheet(taskFormView("edit", id)); return;
    case "update-progress": openSheet(progressFormView(id)); return;
    case "submit-complete": openSheet(submitCompleteView(id)); return;
    case "save-task": saveTask(el.dataset.mode, id); return;
    case "save-log": saveLog(id); return;
    case "toggle-logs-mine":
      state.logsMineOnly = !state.logsMineOnly;
      refreshLogResults();
      return;
    case "clear-log-author": {
      state.logAuthorQuery = "";
      const input = document.getElementById("logAuthorInput");
      if (input){ input.value = ""; input.focus(); }
      refreshLogResults();
      return;
    }
    case "save-progress": saveProgress(id); return;
    case "confirm-complete": confirmComplete(id); return;
    case "approve-create": approveCreate(id); return;
    case "approve-complete": approveComplete(id); return;
    case "reject-create": openSheet(rejectFormView("create", id)); return;
    case "reject-complete": openSheet(rejectFormView("complete", id)); return;
    case "confirm-reject":
      const reason = document.getElementById("rj-reason").value.trim();
      if (!reason) return showError("rj-error", "请填写原因。");
      rejectTask(el.dataset.kind, id, reason);
      return;
    case "new-consult": openSheet(consultFormView()); return;
    case "save-consult": saveConsult(); return;
    case "reply-consult": openSheet(replyConsultView(id)); return;
    case "save-reply": saveReply(id); return;
    case "open-notif":
      const n = NOTIFICATIONS.find(function(x){ return x.id === id; });
      if (n){
        if (n.read.indexOf(actor().id) === -1) n.read.push(actor().id);
        const tv = taskDetailView(n.taskId);
        sheetStack = [];
        renderAll();
        if (tv) openSheet(tv);
      }
      return;
    case "save-company": saveCompanyItem(id); return;
    case "save-personal": savePersonalItem(id); return;
    case "new-company": openSheet(companyItemFormView(null)); return;
    case "new-personal": openSheet(personalItemFormView(null)); return;
    case "delete-company": { const v = confirmDeleteView("company", id); if (v) openSheet(v); return; }
    case "delete-personal": { const v = confirmDeleteView("personal", id); if (v) openSheet(v); return; }
    case "confirm-delete": deleteItem(el.dataset.kind, id); return;
    case "toggle-month-picker":
      state.pickerOpen = !state.pickerOpen;
      renderAll();
      updateToTop();
      return;
    case "pick-year":
      state.viewAnchor = new Date(state.viewAnchor.getFullYear() + Number(el.dataset.delta), state.viewAnchor.getMonth(), 1);
      renderAll();
      return;
    case "pick-month":
      state.viewAnchor = new Date(state.viewAnchor.getFullYear(), Number(el.dataset.month), 1);
      state.pickerOpen = false;
      renderAll();
      return;
    case "view-prev":
      state.viewAnchor = addDays(state.viewAnchor, state.viewMode === "week" ? -7 : -1);
      renderAll();
      return;
    case "view-next":
      state.viewAnchor = addDays(state.viewAnchor, state.viewMode === "week" ? 7 : 1);
      renderAll();
      return;
    case "view-up":
      state.viewMode = state.viewMode === "day" ? "week" : "month";
      state.pickerOpen = false;
      renderAll();
      return;
    default: return;
  }
}

/* 日志作者查找：委托 input 事件，只刷新结果区与计数，不重建输入框本身 */
document.addEventListener("input", function(ev){
  const target = ev.target;
  if (!target || typeof target.closest !== "function") return;
  if (!target.closest("#logAuthorInput")) return;
  state.logAuthorQuery = normalizeAuthorQuery(target.value);
  refreshLogResults();
});

document.addEventListener("click", function(ev){
  const roleEl = ev.target.closest("[data-role]");  if (roleEl){ setRole(roleEl.dataset.role); return; }
  const pageEl = ev.target.closest("[data-page]");
  if (pageEl){ setPage(pageEl.dataset.page); return; }
  const filterEl = ev.target.closest("[data-log-filter]");
  if (filterEl){
    const fid = filterEl.dataset.logFilter;
    if (fid !== state.logFilter){
      state.logFilter = fid;
      renderAll();
      document.getElementById("appMain").scrollTop = 0;   /* 切换筛选时复位滚动位置 */
      updateToTop();
    }
    return;
  }
  const ovEl = ev.target.closest("[data-overflow]");
  if (ovEl){
    const v = overflowView(ovEl.dataset.overflow);
    if (v) openSheet(v);
    return;
  }
  const taskEl = ev.target.closest("[data-task]");
  if (taskEl){ openTaskDetail(taskEl.dataset.task); return; }
  const logEl = ev.target.closest("[data-log]");
  if (logEl){ openLogDetail(logEl.dataset.log); return; }
  /* 下钻只在非任务条、非 +N 的空白命中区生效 */
  const weekEl = ev.target.closest("[data-drill-week]");
  if (weekEl){
    state.viewMode = "week";
    state.viewAnchor = parseISO(weekEl.dataset.drillWeek);
    state.pickerOpen = false;
    renderAll();
    document.getElementById("appMain").scrollTop = 0;
    return;
  }
  const dayEl = ev.target.closest("[data-drill-day]");
  if (dayEl){
    state.viewMode = "day";
    state.viewAnchor = parseISO(dayEl.dataset.drillDay);
    state.pickerOpen = false;
    renderAll();
    document.getElementById("appMain").scrollTop = 0;
    return;
  }
  const compEl = ev.target.closest("[data-edit-company]");
  if (compEl){ const v = companyItemFormView(compEl.dataset.editCompany); if (v) openSheet(v); return; }
  const persEl = ev.target.closest("[data-edit-personal]");
  if (persEl){ const v = personalItemFormView(persEl.dataset.editPersonal); if (v) openSheet(v); return; }
  const delCompEl = ev.target.closest("[data-delete-company]");
  if (delCompEl){ const v = confirmDeleteView("company", delCompEl.dataset.deleteCompany); if (v) openSheet(v); return; }
  const delPersEl = ev.target.closest("[data-delete-personal]");
  if (delPersEl){ const v = confirmDeleteView("personal", delPersEl.dataset.deletePersonal); if (v) openSheet(v); return; }
  const typeEl = ev.target.closest("[data-type]");
  if (typeEl){
    formChoice.type = typeEl.dataset.type;
    syncChoiceRow("#tf-type", "data-type", formChoice.type);
    const field = document.getElementById("tf-assignee-field");
    const prog = document.getElementById("tf-progress-field");
    if (field) field.hidden = formChoice.type === "abstract";
    if (prog) prog.hidden = formChoice.type === "abstract";
    return;
  }
  const urgencyEl = ev.target.closest("[data-urgency]");
  if (urgencyEl){
    formChoice.urgency = urgencyEl.dataset.urgency;
    syncChoiceRow("#tf-urgency", "data-urgency", formChoice.urgency);
    return;
  }
  const actionEl = ev.target.closest("[data-action]");
  if (actionEl){ runAction(actionEl); return; }
  if (ev.target === overlayEl) closeSheet();
});

document.getElementById("bellBtn").addEventListener("click", openNotifications);
document.getElementById("sheetClose").addEventListener("click", closeSheet);

/* 日志页回到顶部：仅在内容区离开顶部后出现 */
document.getElementById("appMain").addEventListener("scroll", updateToTop);
document.getElementById("toTopBtn").addEventListener("click", function(){
  document.getElementById("appMain").scrollTop = 0;
  updateToTop();
});

document.addEventListener("keydown", function(ev){
  if (overlayEl.hidden) return;
  if (ev.key === "Escape"){
    ev.preventDefault();
    if (sheetStack.length > 1) backSheet(); else closeSheet();
    return;
  }
  if (ev.key === "Tab"){
    const focusables = sheetBodyEl.querySelectorAll("button, input, select, textarea, [href]");
    const footFocusables = sheetFootEl.querySelectorAll("button");
    const list = Array.prototype.slice.call(focusables).concat(Array.prototype.slice.call(footFocusables))
      .filter(function(el){ return !el.disabled && el.offsetParent !== null; });
    if (!list.length) return;
    const first = list[0], last = list[list.length - 1];
    if (ev.shiftKey && document.activeElement === first){ ev.preventDefault(); last.focus(); }
    else if (!ev.shiftKey && document.activeElement === last){ ev.preventDefault(); first.focus(); }
  }
});

renderAll();
