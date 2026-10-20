# 正式需求修复复验追踪表

> 生成日期：2026-10-20。本文是 apply 阶段的实现与证据索引，不是独立验证报告，也不把历史审计结论改写为 PASS。原始《正式需求审计清单》《正式需求偏差报告》《产品需求文档》均保持不变。

## 口径与当前证据

- 当前代码/证据基线：仓库当前工作树；构建测试为 Java 21、MySQL 9.7、Flyway V1—V12。
- HTTP/数据库脚本均使用隔离数据库；受控时钟套件会改变测试时间，因此不能在同一数据库上无条件串跑。
- 浏览器证据来自桌面版 headless Chrome 的 320×740、390×844、1440×900 视口模拟，不是真机证据。
- DEV-029（系统推送）与 A-25/相关真机部分经授权延期；这些项保持‘未验证/延期’，不计作完成。
- JSON 与截图证据位于本目录；详细命令、迁移结果、失败修复过程见 `implementation-notes.md`。

## DEV-001—035

| DEV | 历史偏差 | OpenSpec 任务 | 当前实现证据 | apply 状态 |
| --- | --- | --- | --- | --- |
| DEV-001 | P1 · 管理端缺少必要维护流程 | 1.2, 2.1, 2.4, 2.6, 2.7, 3.1, 7.4, 11.3, 11.5 | organization-admin.json；account-lifecycle.json；profile-phone.json | 已实现并有当前证据；待独立 e13 verify |
| DEV-002 | P1 · 部门、职位、团队与可配置授权模型不完整 | 1.1, 1.2, 2.2, 2.3, 3.5, 11.3, 11.5 | organization-admin.json；account-lifecycle.json；profile-phone.json | 已实现并有当前证据；待独立 e13 verify |
| DEV-003 | P1 · 初始密码与改密链路缺失 | 1.2, 3.2, 3.3, 3.4, 11.3, 11.5 | organization-admin.json；account-lifecycle.json；profile-phone.json | 已实现并有当前证据；待独立 e13 verify |
| DEV-004 | P1 · 转岗与专用交接缺失 | 1.3, 2.5, 4.6, 11.3, 11.5 | organization-admin.json；account-lifecycle.json；profile-phone.json | 已实现并有当前证据；待独立 e13 verify |
| DEV-005 | P1 · 中层日志权限误用同团队范围 | 8.3, 11.3, 11.5 | organization-admin.json；account-lifecycle.json；profile-phone.json | 已实现并有当前证据；待独立 e13 verify |
| DEV-006 | P1 · 负责人默认、顺序及同级审核路由不符 | 4.1, 4.2, 11.3, 11.5 | review-routing.json；smoke.json；chapter11-browser.json | 已实现并有当前证据；待独立 e13 verify |
| DEV-007 | P1 · 申请人等于审核人时仍自动免审 | 4.9, 11.3, 11.5 | review-routing.json；smoke.json；chapter11-browser.json | 已实现并有当前证据；待独立 e13 verify |
| DEV-008 | P1 · 负责人变更仍交旧路线批准 | 4.3, 11.3, 11.5 | review-routing.json；smoke.json；chapter11-browser.json | 已实现并有当前证据；待独立 e13 verify |
| DEV-009 | P1 · 确实无审核人时阻断而非留因生效 | 11.3, 11.5 | review-routing.json；smoke.json；chapter11-browser.json | 已实现并有当前证据；待独立 e13 verify |
| DEV-010 | P2 · 审核人预览与改派留痕缺失 | 4.4, 7.1, 11.3, 11.5 | review-routing.json；smoke.json；chapter11-browser.json | 已实现并有当前证据；待独立 e13 verify |
| DEV-011 | P2 · 申请人获得审核专用差异对比 | 4.5, 11.3, 11.5 | review-routing.json；smoke.json；chapter11-browser.json | 已实现并有当前证据；待独立 e13 verify |
| DEV-012 | P1 · 待审到期失效链路完全缺失 | 5.1, 5.2, 5.3, 5.4, 6.4, 11.3, 11.5 | deadline-reminder-notification.json；review-routing.json；database-event.json | 已实现并有当前证据；待独立 e13 verify |
| DEV-013 | P1 · 重开不允许一并调整排期 | 4.7, 11.3, 11.5 | deadline-reminder-notification.json；review-routing.json；database-event.json | 已实现并有当前证据；待独立 e13 verify |
| DEV-014 | P1 · 提醒仍是提前三天且按日重复 | 6.1, 6.2, 6.3, 11.3, 11.5 | deadline-reminder-notification.json；review-routing.json；database-event.json | 已实现并有当前证据；待独立 e13 verify |
| DEV-015 | P2 · 全天下班截止不能配置 | 11.3, 11.5 | deadline-reminder-notification.json；review-routing.json；database-event.json | 已实现并有当前证据；待独立 e13 verify |
| DEV-016 | P2 · 操作历史不足以直接说明具体变更 | 4.8, 7.8, 11.3, 11.5 | deadline-reminder-notification.json；review-routing.json；database-event.json | 已实现并有当前证据；待独立 e13 verify |
| DEV-017 | P2 · 首页任务没有按派发时间倒序 | 1.4, 9.1, 11.3, 11.4, 11.5 | home-calendar.json；home-calendar-three-viewports.json；chapter11-browser.json | 已实现并有当前证据；待独立 e13 verify |
| DEV-018 | P2 · 首页任务及个人条目操作不符 | 9.2, 11.3, 11.4, 11.5 | home-calendar.json；home-calendar-three-viewports.json；chapter11-browser.json | 已实现并有当前证据；待独立 e13 verify |
| DEV-019 | P2 · 日历通用导航、搜索和申请入口缺失 | 9.3, 11.3, 11.4, 11.5 | home-calendar.json；home-calendar-three-viewports.json；chapter11-browser.json | 已实现并有当前证据；待独立 e13 verify |
| DEV-020 | P2 · 月排序、置顶及标题裁切不符 | 9.4, 11.3, 11.4, 11.5 | home-calendar.json；home-calendar-three-viewports.json；chapter11-browser.json | 已实现并有当前证据；待独立 e13 verify |
| DEV-021 | P1 · 周视图把非全天跨日任务放入全天区 | 9.5, 11.3, 11.4, 11.5 | home-calendar.json；home-calendar-three-viewports.json；chapter11-browser.json | 已实现并有当前证据；待独立 e13 verify |
| DEV-022 | P1 · 时间轴压缩及聚合违背全量展示 | 9.6, 11.3, 11.4, 11.5 | home-calendar.json；home-calendar-three-viewports.json；chapter11-browser.json | 已实现并有当前证据；待独立 e13 verify |
| DEV-023 | P2 · 日期区未实现左右整周切换 | 9.7, 11.3, 11.4, 11.5 | home-calendar.json；home-calendar-three-viewports.json；chapter11-browser.json | 已实现并有当前证据；待独立 e13 verify |
| DEV-024 | P2 · 日历类别标记和范围统计没有呈现 | 9.8, 10.1, 11.3, 11.4, 11.5 | home-calendar.json；home-calendar-three-viewports.json；chapter11-browser.json | 已实现并有当前证据；待独立 e13 verify |
| DEV-025 | P1 · 同人同日可重复创建日志 | 1.5, 8.1, 11.3, 11.4, 11.5 | work-logs.json；logs-profile-*.json；chapter11-browser.json | 已实现并有当前证据；待独立 e13 verify |
| DEV-026 | P1 · 日志没有午夜冻结且可改日期、删除绕过 | 8.2, 11.3, 11.4, 11.5 | work-logs.json；logs-profile-*.json；chapter11-browser.json | 已实现并有当前证据；待独立 e13 verify |
| DEV-027 | P2 · 日志混入任务流程且默认和人员筛选不符 | 11.3, 11.4, 11.5 | work-logs.json；logs-profile-*.json；chapter11-browser.json | 已实现并有当前证据；待独立 e13 verify |
| DEV-028 | P2 · 个人资料缺规定字段和直属下属入口 | 8.4, 11.3, 11.4, 11.5, 11.7 | work-logs.json；logs-profile-*.json；chapter11-browser.json | 已实现并有当前证据；待独立 e13 verify |
| DEV-029 | P1 · 只有站内投递，没有系统推送渠道 | 11.5 | 无系统推送/真机证据（授权延期） | 授权延期：系统推送/真机未实现、未验证 |
| DEV-030 | P2 · 通知接收范围与变更摘要不完整 | 7.2, 11.5 | deadline-reminder-notification.json；notification-*.json；chapter11-browser.json | 已实现并有当前证据；待独立 e13 verify |
| DEV-031 | P2 · 消息不自动已读，审核消息未绑定原申请 | 7.3, 7.7, 11.5 | deadline-reminder-notification.json；notification-*.json；chapter11-browser.json | 已实现并有当前证据；待独立 e13 verify |
| DEV-032 | P2 · 通知撤回、三个月保留和后台管理缺失 | 7.5, 7.7, 11.5 | deadline-reminder-notification.json；notification-*.json；chapter11-browser.json | 已实现并有当前证据；待独立 e13 verify |
| DEV-033 | P1 · 权限移除后的历史通知被隐藏 | 7.6, 7.7, 11.5 | deadline-reminder-notification.json；notification-*.json；chapter11-browser.json | 已实现并有当前证据；待独立 e13 verify |
| DEV-034 | P2 · AI 统计、词云、建议范围和更新不满足正式规则 | 10.2, 10.3, 10.4, 11.5 | ai-analysis.json；chapter11-browser.json | 已实现并有当前证据；待独立 e13 verify |
| DEV-035 | P2 · 既有规格及测试仍固化过时规则 | 11.1, 11.2, 11.5, 11.6 | smoke.json；database.json；database-event.json；chapter11-browser.json | 已实现并有当前证据；待独立 e13 verify |

## AUD 150 项

历史结论列仅用于追溯原审计，不代表本轮独立复验结论。

| AUD | 来源 | 判定要点（摘要） | 历史关联 DEV | 当前证据 | apply 状态 |
| --- | --- | --- | --- | --- | --- |
| AUD-SCP-001 | 1.1、1.2 | 移动端具备登录及导图、视图、日志、AI 地图、我的五个主页面；通知中心承接消息与审核，不成为第六个主导航页。 | 无 | chapter11-browser.json；smoke.json | 已实现并有当前证据；待独立 e13 verify |
| AUD-SCP-002 | 1.2、3 | 管理端实际承接员工建号及资料、部门、团队、上下级、角色授权、公司信息、任务历史及通知管理，不以只读调试页代替所要求的管理流程。 | DEV-001 | chapter11-browser.json；smoke.json | 已实现并有当前证据；待独立 e13 verify |
| AUD-SCP-003 | 1.2、5.2.6 | 正式验收不要求请示/回复、完整账号启停、公司信息草稿/定时发布、日志自动生成个人信息、一人多团队；不将参考 App 的三日视图、项目分类、会员、打卡、课程表纳入必交范围。若现有额外能力影响明确业务边界，按相应条目核验。 | 无 | chapter11-browser.json；smoke.json | 已实现并有当前证据；待独立 e13 verify |
| AUD-ORG-001 | 2.1、3.2 | 员工资料支持公司、姓名、手机号、部门、职位、直属上级及团队；部门和职位必填，直接请求也不能保存为空。 | DEV-001、DEV-002 | organization-admin.json；database.json；chapter11-browser.json | 已实现并有当前证据；待独立 e13 verify |
| AUD-ORG-002 | 2.1 | 一人一个主部门、至多一个团队、一位直属上级；无上级的组织顶层人员可例外，部门和团队是独立概念，一个部门可有多个团队。 | DEV-002 | organization-admin.json；database.json；chapter11-browser.json | 已实现并有当前证据；待独立 e13 verify |
| AUD-ORG-003 | 2.1、2.2 | 获授权的部门负责人能创建团队，创建者默认负责，团队负责人可转交；普通员工不能凭界面或直接请求取得这些维护权限。 | DEV-001、DEV-002 | organization-admin.json；database.json；chapter11-browser.json | 已实现并有当前证据；待独立 e13 verify |
| AUD-ORG-004 | 2.1、3.2 | 管理端能维护部门、职位、团队、直属上下级、角色及数据范围；加入团队时明确归属。 | DEV-001、DEV-002 | organization-admin.json；database.json；chapter11-browser.json | 已实现并有当前证据；待独立 e13 verify |
| AUD-ORG-005 | 2.1 | 管理员可配置业务能力、任务查看范围和派发权限；可见数据及候选负责人实际使用这些配置。 | DEV-002 | organization-admin.json；database.json；chapter11-browser.json | 已实现并有当前证据；待独立 e13 verify |
| AUD-ORG-006 | 2.1、3.1 | 权限不单凭职位名称、团队负责人身份、前端角色按钮或管理员身份推导；真实账号授权生效。 | DEV-002 | organization-admin.json；database.json；chapter11-browser.json | 已实现并有当前证据；待独立 e13 verify |
| AUD-ORG-007 | 2.1、4.3 | 组织关系能确定组织位置和管理链，负责人顺序仅用于同级最高层的选择，不能取代组织高低。 | DEV-006 | organization-admin.json；database.json；chapter11-browser.json | 已实现并有当前证据；待独立 e13 verify |
| AUD-ORG-008 | 3.2 | 转岗更新名片及组织关系，可选负责人和任务范围随之变化，日志范围独立重算。 | DEV-002、DEV-004 | organization-admin.json；database.json；chapter11-browser.json | 已实现并有当前证据；待独立 e13 verify |
| AUD-ORG-009 | 3.2、4.2 | 离职交接对象可由本人提前设置或直属领导设置；专用交接权限不能扩展为任意基础字段编辑权，实际负责人变更仍走审核。 | DEV-004 | organization-admin.json；database.json；chapter11-browser.json | 已实现并有当前证据；待独立 e13 verify |
| AUD-ORG-010 | 3.2、4.3、4.6 | 交接保留原创建者、创建时间及历史；审核人离职、调岗或无法承接时按管理链上溯，不能以完整启停流程暂缓为由省略。 | DEV-004、DEV-010 | organization-admin.json；database.json；chapter11-browser.json | 已实现并有当前证据；待独立 e13 verify |
| AUD-ACC-001 | 3.1 | 管理员能够手动新增员工并生成初始密码，不依赖种子数据；员工不能自行注册。 | DEV-001、DEV-003 | account-lifecycle.json；account-*.json；chapter11-browser.json | 已实现并有当前证据；待独立 e13 verify |
| AUD-ACC-002 | 3.1 | 员工首次登录必须修改密码，不能绕过强制步骤继续正常业务。 | DEV-003 | account-lifecycle.json；account-*.json；chapter11-browser.json | 已实现并有当前证据；待独立 e13 verify |
| AUD-ACC-003 | 3.1、5.5 | 登录、修改密码、退出登录流程可用；退出后不能继续以原登录态办理业务。登录账号决定真实组织与权限，演示选择不直接赋权。 | DEV-003 | account-lifecycle.json；account-*.json；chapter11-browser.json | 已实现并有当前证据；待独立 e13 verify |
| AUD-ACC-004 | 3.1 | 一个公司只有一个管理员账号，管理端与员工使用同一账号体系；管理员业务能力仍须另行员工授权。 | DEV-001、DEV-002 | account-lifecycle.json；account-*.json；chapter11-browser.json | 已实现并有当前证据；待独立 e13 verify |
| AUD-ACC-005 | 3.1、9 | 核查登录标识、密码校验和忘记密码的详细设计及实现依据；正式版未给出的细则不由审计者自行补成产品验收标准。缺少设计时记录缺口及影响。 | Q-01 | account-lifecycle.json；account-*.json；chapter11-browser.json | 已实现并有当前证据；待独立 e13 verify |
| AUD-PER-001 | 2.1、2.2 | 上层可看公司正常任务，中层可看负责人涉及本部门的正常任务，下层可看自己负责或创建的正常任务。 | DEV-002 | organization-admin.json；profile-phone.json；review-routing.json | 已实现并有当前证据；待独立 e13 verify |
| AUD-PER-002 | 2.1、2.2 | 多人跨部门任务对每个负责人所属部门的获授权管理者可见；不按创建者部门决定任务归属。 | DEV-002 | organization-admin.json；profile-phone.json；review-routing.json | 已实现并有当前证据；待独立 e13 verify |
| AUD-PER-003 | 2.2 | 上层按授权给自己及中下层派发，中层按授权给自己和本部门下属派发，下层仅给自己创建；可见任务不意味着可派发给其人员。 | DEV-002 | organization-admin.json；profile-phone.json；review-routing.json | 已实现并有当前证据；待独立 e13 verify |
| AUD-PER-004 | 2.2、4.2 | 仅原创建者可申请改基础信息，交接专用权限除外；仅当前负责人可申请进展和完成；查看权、管理身份及审核身份不自动授予这些操作。 | DEV-004 | organization-admin.json；profile-phone.json；review-routing.json | 已实现并有当前证据；待独立 e13 verify |
| AUD-PER-005 | 2.2、4.3 | 仅指定审核人可处理申请，公司范围管理者不能审核所有任务；待创建隔离优先于普通可见范围。 | 无 | organization-admin.json；profile-phone.json；review-routing.json | 已实现并有当前证据；待独立 e13 verify |
| AUD-PER-006 | 2.2、5.3 | 日志范围：上层本人及全公司，中层本人及直属下属，下层仅本人；同部门非直属及同任务参与者不因此取得日志访问权。 | DEV-005 | organization-admin.json；profile-phone.json；review-routing.json | 已实现并有当前证据；待独立 e13 verify |
| AUD-PER-007 | 2.2、5.3 | 本人写改日志，上级只读；管理员身份不自动取得业务日志查看权。 | 无 | organization-admin.json；profile-phone.json；review-routing.json | 已实现并有当前证据；待独立 e13 verify |
| AUD-PER-008 | 2.2、5.4 | 上层公司统计和公司建议，中层部门统计和个人建议，下层本人统计和个人建议；管理员身份不自动取得业务分析权限。 | DEV-002、DEV-034 | organization-admin.json；profile-phone.json；review-routing.json | 已实现并有当前证据；待独立 e13 verify |
| AUD-PER-009 | 2.2、5.5 | 手机号仅本人可见；他人资料卡、目录、任务人员摘要、日志筛选、通知和分析的页面及接口均不返回他人手机号，管理员录入不构成公开授权。 | 无 | organization-admin.json；profile-phone.json；review-routing.json | 已实现并有当前证据；待独立 e13 verify |
| AUD-PER-010 | 2.2 | 任务列表、详情、搜索、关联、人员筛选、通知跳转及统计明细均执行相应权限，直接访问和伪造对象标识也不能绕过。历史通知例外另按 AUD-NTH 核验。 | DEV-002、DEV-005 | organization-admin.json；profile-phone.json；review-routing.json | 已实现并有当前证据；待独立 e13 verify |
| AUD-PER-011 | 2.2、5.5 | “我的”的下属资料及日志入口仅覆盖直属下属，不扩成全公司通讯录；上层全公司日志通过日志页筛选。 | DEV-028 | organization-admin.json；profile-phone.json；review-routing.json | 已实现并有当前证据；待独立 e13 verify |
| AUD-ADM-001 | 3.3 | 管理员在管理端录入、更新、删除公司信息，最多十条；达到上限时不能通过直接请求或并发新增突破。 | DEV-001 | organization-admin.json；deadline-reminder-notification.json；chapter11-browser.json | 已实现并有当前证据；待独立 e13 verify |
| AUD-ADM-002 | 3.3、5.1 | 公司信息默认按创建时间排序，可人工调序，App 按后台顺序展示；刷新后顺序保留。 | DEV-001 | organization-admin.json；deadline-reminder-notification.json；chapter11-browser.json | 已实现并有当前证据；待独立 e13 verify |
| AUD-ADM-003 | 2.2、3.3 | 所有 App 业务账号包括上层仅可读公司信息，无编辑删除入口，直接写请求同样受限。 | 无 | organization-admin.json；deadline-reminder-notification.json；chapter11-browser.json | 已实现并有当前证据；待独立 e13 verify |
| AUD-ADM-004 | 3.3、4.6 | 管理端可查询全部任务操作历史并管理通知；通知删除、撤回、到期清理不删除历史或撤销业务结果。 | DEV-001、DEV-016、DEV-032 | organization-admin.json；deadline-reminder-notification.json；chapter11-browser.json | 已实现并有当前证据；待独立 e13 verify |
| AUD-TSK-001 | 4.1 | 任务具备标题、说明、创建者、创建时间、有序负责人、起止时间、全天、紧急程度、执行状态、文字进展、可选父任务、审核人和审核意见；按流程展示适用值。 | DEV-006 | review-routing.json；smoke.json；database-event.json | 已实现并有当前证据；待独立 e13 verify |
| AUD-TSK-002 | 4.1 | 创建者默认加入负责人，可在授权范围内调整；负责人可多选及选择本人，至少一人，越权候选不可提交。 | DEV-002、DEV-006 | review-routing.json；smoke.json；database-event.json | 已实现并有当前证据；待独立 e13 verify |
| AUD-TSK-003 | 4.1、4.3 | 负责人顺序在表单明确显示、保存并重新读取后不丢失；审核计算不改用姓名、内部 ID 或查询默认顺序。 | DEV-006 | review-routing.json；smoke.json；database-event.json | 已实现并有当前证据；待独立 e13 verify |
| AUD-TSK-004 | 4.1 | 转交、重开及排期修改均保留原创建者和创建时间。 | DEV-004、DEV-013 | review-routing.json；smoke.json；database-event.json | 已实现并有当前证据；待独立 e13 verify |
| AUD-TSK-005 | 4.1 | 紧急程度独立为紧急/高/中/低四档，不拼入标题；不展示百分比完成进度或进度条。 | 无 | review-routing.json；smoke.json；database-event.json | 已实现并有当前证据；待独立 e13 verify |
| AUD-TSK-006 | 4.1 | 非全天填写日期和时刻，全天填写日期，截止不得早于开始；全天日历包含首尾日期。覆盖相同起止值、跨日及跨月。 | 无，补边界证据 | review-routing.json；smoke.json；database-event.json | 已实现并有当前证据；待独立 e13 verify |
| AUD-TSK-007 | 4.1 | 父子任务各自可执行，独立负责人、排期、状态和审核人；子任务完成不自动完成父任务，不计算汇总百分比，子任务列表表达关系及状态。 | 无，补运行证据 | review-routing.json；smoke.json；database-event.json | 已实现并有当前证据；待独立 e13 verify |
| AUD-TSK-008 | 4.1 | 关联拒绝自引用及多层循环，不可新建指向权限外任务的关联，也不可经已有关系打开权限外任务。 | 无，补运行证据 | review-routing.json；smoke.json；database-event.json | 已实现并有当前证据；待独立 e13 verify |
| AUD-TSK-009 | 4.2 | 视图页提供统一创建/派发流程；自建与派发使用同一审核规则。 | DEV-007 | review-routing.json；smoke.json；database-event.json | 已实现并有当前证据；待独立 e13 verify |
| AUD-TSK-010 | 4.2、4.5 | 已完成任务仅原创建者可申请重开，可同时提出必要排期调整；通过后回到进行中并进入新执行轮次，拒绝/撤销仍已完成。 | DEV-013 | review-routing.json；smoke.json；database-event.json | 已实现并有当前证据；待独立 e13 verify |
| AUD-REV-001 | 4.3 | 先找组织位置最高层的负责人，同层多人取已保存顺序第一位，沿该人的管理链确定唯一审核人。覆盖低层负责人排首位、同级不同管理链及调整顺序。 | DEV-006 | review-routing.json；smoke.json；chapter11-browser.json | 已实现并有当前证据；待独立 e13 verify |
| AUD-REV-002 | 4.3 | 依据人的直属上级优先；离职、调岗或无法承接时沿该管理链上溯有效审核人，不采用抢审、多审核人任选或共同上级替代算法。 | DEV-006、DEV-010 | review-routing.json；smoke.json；chapter11-browser.json | 已实现并有当前证据；待独立 e13 verify |
| AUD-REV-003 | 4.3 | 无可用上级回退原创建者；原创建者也无法承接且确无审核人时记录原因并直接生效。 | DEV-009 | review-routing.json；smoke.json；chapter11-browser.json | 已实现并有当前证据；待独立 e13 verify |
| AUD-REV-004 | 4.3、4.5 | 有审核人就必须显式处理，即使申请人、创建者、审核人为同一人仍先待审；不自动免审。 | DEV-007 | review-routing.json；smoke.json；chapter11-browser.json | 已实现并有当前证据；待独立 e13 verify |
| AUD-REV-005 | 4.3 | 审核人兼任负责人时仍保留审核身份，其他负责人提交操作不因此更换审核人。 | DEV-006 | review-routing.json；smoke.json；chapter11-browser.json | 已实现并有当前证据；待独立 e13 verify |
| AUD-REV-006 | 4.3 | 创建按拟提交负责人；负责人变更和交接按变更后的负责人计算本次审核人，由新审核人批准，不额外要求旧审核人批准。 | DEV-004、DEV-008 | review-routing.json；smoke.json；chapter11-browser.json | 已实现并有当前证据；待独立 e13 verify |
| AUD-REV-007 | 4.3 | 负责人变更拒绝、撤销或失效均保留原有效负责人及审核路线；其他申请按当前有效负责人计算。 | DEV-012 | review-routing.json；smoke.json；chapter11-browser.json | 已实现并有当前证据；待独立 e13 verify |
| AUD-REV-008 | 4.3 | 组织变化使审核人不可用时继续上溯并记录改派；提交前及任务/申请详情展示审核人，变更待审区分当前与本次审核人，无需审核时显示原因。 | DEV-009、DEV-010 | review-routing.json；smoke.json；chapter11-browser.json | 已实现并有当前证据；待独立 e13 verify |
| AUD-FLW-001 | 4.4 | 有审核人时创建、基础信息修改、每次进展新增及修改、完成、重开、交接均提审；每类操作分别核验，不只验证首次进展。 | DEV-004、DEV-007 | review-routing.json；deadline-reminder-notification.json；chapter11-browser.json | 已实现并有当前证据；待独立 e13 verify |
| AUD-FLW-002 | 4.4 | 同一任务仅一条待处理申请；待审冻结其他业务操作，包含其他负责人进展/完成，重复或并发提交提示已有申请，不新增第二条。 | 无，补并发场景 | review-routing.json；deadline-reminder-notification.json；chapter11-browser.json | 已实现并有当前证据；待独立 e13 verify |
| AUD-FLW-003 | 4.4 | 仅申请人可撤销自己的待审，创建者、审核人及管理员身份不能代撤；改待审内容必须先撤销再重提。 | 无 | review-routing.json；deadline-reminder-notification.json；chapter11-browser.json | 已实现并有当前证据；待独立 e13 verify |
| AUD-FLW-004 | 4.4 | 待创建审核只允许审核人从通知中心查看、创建者从视图独立申请入口跟踪；公司范围权限不放开访问。 | DEV-019、DEV-027 | review-routing.json；deadline-reminder-notification.json；chapter11-browser.json | 已实现并有当前证据；待独立 e13 verify |
| AUD-FLW-005 | 4.4 | 待创建及未获准发布任务均不进入月/周/日、普通搜索、首页、正常任务计数和 AI 统计；分别检查各入口及接口。 | 无 | review-routing.json；deadline-reminder-notification.json；chapter11-browser.json | 已实现并有当前证据；待独立 e13 verify |
| AUD-FLW-006 | 4.4、4.5 | 创建拒绝、撤销、失效后不发布，保留内容和结果供调整重提；拒绝结果用通知呈现，无专门拒绝档案页，删除通知不删除后台记录。 | DEV-012、DEV-027 | review-routing.json；deadline-reminder-notification.json；chapter11-browser.json | 已实现并有当前证据；待独立 e13 verify |
| AUD-FLW-007 | 4.4 | 已生效任务待审时正常区域仍展示原有效版本及审核中标记，操作冻结；提议仅通过后生效。覆盖基础修改、进展、完成、重开。 | DEV-007 | review-routing.json；deadline-reminder-notification.json；chapter11-browser.json | 已实现并有当前证据；待独立 e13 verify |
| AUD-FLW-008 | 4.4 | 逐项差异对比仅本次审核人可见；申请人可看自己提交内容、状态及结果但不因申请人身份取得专用 diff；其他查看者只看旧版及冻结标记。 | DEV-011 | review-routing.json；deadline-reminder-notification.json；chapter11-browser.json | 已实现并有当前证据；待独立 e13 verify |
| AUD-FLW-009 | 4.5 | 执行状态待开始/进行中/已完成与申请状态待审/通过/拒绝退回/撤销/失效分别表达；待创建、待完成审核不冒充已生效结果。 | DEV-007、DEV-012 | review-routing.json；deadline-reminder-notification.json；chapter11-browser.json | 已实现并有当前证据；待独立 e13 verify |
| AUD-FLW-010 | 4.5 | 新任务有审核人先待创建，通过后待开始并正常展示；确无审核人记原因直接待开始；不能因已到开始时间擅自替代首次进展规则。 | DEV-007、DEV-009 | review-routing.json；deadline-reminder-notification.json；chapter11-browser.json | 已实现并有当前证据；待独立 e13 verify |
| AUD-FLW-011 | 4.5 | 首次进展备注生效使待开始进入进行中；待审进展不提前生效，修改/进展拒绝或撤销保留原版本及状态并解冻。 | DEV-007 | review-routing.json；deadline-reminder-notification.json；chapter11-browser.json | 已实现并有当前证据；待独立 e13 verify |
| AUD-FLW-012 | 4.5 | 任一当前负责人可从待开始/进行中提交完成；有审核人待完成审核，通过后已完成；确无审核人直接已完成。 | DEV-007、DEV-009 | review-routing.json；deadline-reminder-notification.json；chapter11-browser.json | 已实现并有当前证据；待独立 e13 verify |
| AUD-FLW-013 | 4.5 | 完成退回进入进行中并记录意见；申请人撤销完成则恢复提交前状态，分别覆盖原待开始和原进行中。 | 无 | review-routing.json；deadline-reminder-notification.json；chapter11-browser.json | 已实现并有当前证据；待独立 e13 verify |
| AUD-FLW-014 | 4.5 | 修改/进展通过只生效提议内容，负责人变更同时启用新路线；拒绝/撤销保留旧版本及执行状态并解冻。 | DEV-008、DEV-012 | review-routing.json；deadline-reminder-notification.json；chapter11-browser.json | 已实现并有当前证据；待独立 e13 verify |
| AUD-FLW-015 | 4.5、5.6.2 | 任何待审跨适用截止时失效并解冻，提议不生效；未发布仍不发布，已发布保留原有效版本和提交前状态。 | DEV-012 | review-routing.json；deadline-reminder-notification.json；chapter11-browser.json | 已实现并有当前证据；待独立 e13 verify |
| AUD-FLW-016 | 4.5 | 通知中心审核可通过、拒绝/退回；拒绝/退回必须填写意见，接口不能绕过。 | DEV-031 | review-routing.json；deadline-reminder-notification.json；chapter11-browser.json | 已实现并有当前证据；待独立 e13 verify |
| AUD-FLW-017 | 4.5、5.6.2 | 多人提交、审核、撤销、截止失效竞争仅一个最终结果；覆盖审批与审批、审批与撤销、审批与失效及旧页面重复操作，重试不再次生效。 | DEV-012 | review-routing.json；deadline-reminder-notification.json；chapter11-browser.json | 已实现并有当前证据；待独立 e13 verify |
| AUD-HIS-001 | 4.6 | 记录覆盖创建、基础信息、负责人及顺序、进展、申请提交/撤销/失效、审核决定/改派、完成、重开、交接及无需审核原因；逐类追踪。 | DEV-004、DEV-006、DEV-012、DEV-016 | review-routing.json；deadline-reminder-notification.json；database-event.json | 已实现并有当前证据；待独立 e13 verify |
| AUD-HIS-002 | 4.6 | 记录能说明操作者、时间、动作、具体变更、审核人及处理结果；管理端可查询，不能只记录当前快照。 | DEV-016 | review-routing.json；deadline-reminder-notification.json；database-event.json | 已实现并有当前证据；待独立 e13 verify |
| AUD-HIS-003 | 4.6 | App 显示当前资料、有效进展、审核人、本人相关申请和意见，不提供完整历史入口；交接、个人删消息、撤回及三个月清理不抹掉历史。 | DEV-004、DEV-032 | review-routing.json；deadline-reminder-notification.json；database-event.json | 已实现并有当前证据；待独立 e13 verify |
| AUD-HOM-001 | 5.1、7 | 四象限位置语义正确，整体固定，各块独立下滑；内容尽量完整，密集及长文本下不遮挡。 | 无，补真机 | home-calendar.json；home-calendar-three-viewports.json | 已实现并有当前证据；待独立 e13 verify |
| AUD-HOM-002 | 5.1 | 左上公司信息至多十条，按后台顺序且只读。 | DEV-001 | home-calendar.json；home-calendar-three-viewports.json | 已实现并有当前证据；待独立 e13 verify |
| AUD-HOM-003 | 5.1 | 右上仅本人被他人派发且未完成的正常任务，至多十项，按派发时间倒序；与创建时间、开始时间不混用。 | DEV-017 | home-calendar.json；home-calendar-three-viewports.json | 已实现并有当前证据；待独立 e13 verify |
| AUD-HOM-004 | 5.1 | 任务条目仅标题及右对齐紧急程度，点击详情；待创建、未发布、仅历史通知可访问任务不进入列表。 | DEV-018 | home-calendar.json；home-calendar-three-viewports.json | 已实现并有当前证据；待独立 e13 verify |
| AUD-HOM-005 | 5.1 | 左下本人手动增改删个人信息，至多十条，不从日志自动生成；编辑删除在详情内，列表不外显，不能改他人条目或突破上限。 | DEV-018 | home-calendar.json；home-calendar-three-viewports.json | 已实现并有当前证据；待独立 e13 verify |
| AUD-HOM-006 | 5.1 | 右下仅本人日志，含今天及此前九个自然日，至多十条，按日志日期倒序，点击原文；检查第十日/第十一日和跨月边界，不用任务派发时间排序。 | 无，补边界证据 | home-calendar.json；home-calendar-three-viewports.json | 已实现并有当前证据；待独立 e13 verify |
| AUD-CAL-001 | 5.2.1 | 顶栏左展开、中央年月日期选择器、右任务搜索；侧栏提供月周日切换、范围三类数量及本人独立申请入口；收起以日历为主体，无常驻大块说明。 | DEV-019、DEV-024 | home-calendar.json；home-calendar-three-viewports.json；chapter11-browser.json | 已实现并有当前证据；待独立 e13 verify |
| AUD-CAL-002 | 5.2.1 | 非本周周视图/非今天日视图，在搜索左侧有返回本周/今天操作；右下悬浮加号创建任务，不遮导航和关键内容。 | DEV-019 | home-calendar.json；home-calendar-three-viewports.json；chapter11-browser.json | 已实现并有当前证据；待独立 e13 verify |
| AUD-CAL-003 | 5.2.1 | 搜索页按名称搜本人有权查看的正常任务并可进详情；待创建审核从独立申请入口查找，不混入普通搜索。 | DEV-019 | home-calendar.json；home-calendar-three-viewports.json；chapter11-browser.json | 已实现并有当前证据；待独立 e13 verify |
| AUD-CAL-004 | 5.2.1 | 日期选择确认后月定位所在月、周定位所在周、日定位该日；左上功能展开与月格溢出入口用途不同。 | DEV-019 | home-calendar.json；home-calendar-three-viewports.json；chapter11-browser.json | 已实现并有当前证据；待独立 e13 verify |
| AUD-CAL-005 | 5.2.2、5.2.6 | 月视图按自然月、周一至周日、固定日期格；跨日跨度可辨，跨周继续展示。覆盖跨月及不同周数月份。 | 无，补日历样本 | home-calendar.json；home-calendar-three-viewports.json；chapter11-browser.json | 已实现并有当前证据；待独立 e13 verify |
| AUD-CAL-006 | 5.2.2 | 单日最多五条，空间不足可少于五条；长标题固定区域直接裁切，不追加省略号。不能按旧规格强制所有屏幕五行。 | DEV-020 | home-calendar.json；home-calendar-three-viewports.json；chapter11-browser.json | 已实现并有当前证据；待独立 e13 verify |
| AUD-CAL-007 | 5.2.2 | 隐藏任务有格内提示，点日期格打开当天完整任务列表，再点任务详情；完整列表按当前权限且不漏隐藏任务。 | 无，补完整列表证据 | home-calendar.json；home-calendar-three-viewports.json；chapter11-browser.json | 已实现并有当前证据；待独立 e13 verify |
| AUD-CAL-008 | 5.2.2、5.2.5 | 默认按时间排序，允许本人置顶，月格及当日列表体现置顶；不改变其他人排列或任务紧急程度。 | DEV-020 | home-calendar.json；home-calendar-three-viewports.json；chapter11-browser.json | 已实现并有当前证据；待独立 e13 verify |
| AUD-TMV-001 | 5.2.3 | 周顶栏周一至周日，下方七个对应日期列；日期行下、00:00 上有全天区，全天覆盖完整日期，不伪造时刻。 | DEV-021 | home-calendar-three-viewports.json；chapter11-browser.json；screenshots/ | 已实现并有当前证据；待独立 e13 verify |
| AUD-TMV-002 | 5.2.3 | 周时间轴纵向覆盖 00:00 至 24:00，按实际时间展示；非全天跨日任务逐日显示真实覆盖时段，不因跨日移入全天区。 | DEV-021 | home-calendar-three-viewports.json；chapter11-browser.json；screenshots/ | 已实现并有当前证据；待独立 e13 verify |
| AUD-TMV-003 | 5.2.3、5.2.4 | 周/日时间轴能纵向浏览完整一天，任务全量展示及访问，不以折叠、收起或溢出聚合代替，也不强制把一天缩进首屏。 | DEV-022 | home-calendar-three-viewports.json；chapter11-browser.json；screenshots/ | 已实现并有当前证据；待独立 e13 verify |
| AUD-TMV-004 | 5.2.3 | 周日期区域左右滑切整周，松手停在完整一周而非两周之间，任务点击进详情。 | DEV-023 | home-calendar-three-viewports.json；chapter11-browser.json；screenshots/ | 已实现并有当前证据；待独立 e13 verify |
| AUD-TMV-005 | 5.2.4 | 日视图保留周一至周日行及选中标记，点日期切当天；独立全天区及单日时间轴，非全天跨日显示当日真实时段。 | DEV-022 | home-calendar-three-viewports.json；chapter11-browser.json；screenshots/ | 已实现并有当前证据；待独立 e13 verify |
| AUD-TMV-006 | 5.2.4 | 日日期区域左右滑切整周且保持选中星期，例如周三切下一周仍周三；任务可点进详情。 | DEV-023 | home-calendar-three-viewports.json；chapter11-browser.json；screenshots/ | 已实现并有当前证据；待独立 e13 verify |
| AUD-TMV-007 | 5.2.5 | 周重叠任务在所属日期列内、日重叠任务在当天时间轴内横向分栏，按并发列数调整宽度；全部可见可点，不用“+N”隐藏其他任务。 | DEV-022 | home-calendar-three-viewports.json；chapter11-browser.json；screenshots/ | 已实现并有当前证据；待独立 e13 verify |
| AUD-TMV-008 | 5.2.5、6 A-16、7 | 置顶在时间轴只作强调，不移动真实时段；最小点击尺寸、分栏及长标题裁切不改变真实起止位置，块之间不覆盖导致无法点击。 | DEV-020、DEV-022 | home-calendar-three-viewports.json；chapter11-browser.json；screenshots/ | 已实现并有当前证据；待独立 e13 verify |
| AUD-TMV-009 | 5.2.5 | 分类互斥：负责人优先归我负责；创建者且非负责人归我分配；其余当前授权任务归仅可见；标记不只依赖颜色。 | DEV-024 | home-calendar-three-viewports.json；chapter11-browser.json；screenshots/ | 已实现并有当前证据；待独立 e13 verify |
| AUD-TMV-010 | 5.2.5 | 三类计数按当前月/周/日排期相交范围，同任务同类别一次；跨日不重复，待创建、未发布及历史通知访问例外不计。 | DEV-024 | home-calendar-three-viewports.json；chapter11-browser.json；screenshots/ | 已实现并有当前证据；待独立 e13 verify |
| AUD-TMV-011 | 5.2.5 | 待完成审核、已完成、逾期分别呈现；逾期可与未完成执行状态共存，已完成不算逾期未完成。 | DEV-024、DEV-034 | home-calendar-three-viewports.json；chapter11-browser.json；screenshots/ | 已实现并有当前证据；待独立 e13 verify |
| AUD-LOG-001 | 5.3 | 日志页仅写日志和看历史，默认本人，上级查看只读；不混入任务创建、审核、本人任务申请、请示或回复入口。 | DEV-027 | work-logs.json；logs-profile-*.json；chapter11-browser.json | 已实现并有当前证据；待独立 e13 verify |
| AUD-LOG-002 | 5.3 | 每人每天一篇，当日可反复修改；重复、重试或并发写入不生成第二篇。 | DEV-025 | work-logs.json；logs-profile-*.json；chapter11-browser.json | 已实现并有当前证据；待独立 e13 verify |
| AUD-LOG-003 | 5.3 | 按公司时区当日 24:00 后冻结，不能编辑或改日期绕过；覆盖午夜前后、其他时区客户端、直接请求。额外删除接口是否能绕过冻结也须检查。 | DEV-026 | work-logs.json；logs-profile-*.json；chapter11-browser.json | 已实现并有当前证据；待独立 e13 verify |
| AUD-LOG-004 | 5.3 | 日志可不关联任务或关联一项本人可见任务；不能多关联或伪造权限外任务。日志属于作者，不随任务参与者扩大可见性。 | DEV-005 | work-logs.json；logs-profile-*.json；chapter11-browser.json | 已实现并有当前证据；待独立 e13 verify |
| AUD-LOG-005 | 5.3 | 组织树和姓名搜索先按日志权限过滤，上层全公司、中层本人及直属下属、下层本人；树节点、搜索结果及详情一致，本人始终可看。 | DEV-005、DEV-027 | work-logs.json；logs-profile-*.json；chapter11-browser.json | 已实现并有当前证据；待独立 e13 verify |
| AUD-LOG-006 | 5.3 | 日志关联任务另行执行任务权限，能看日志不表示能看任务，也不能借返回字段泄露受限任务详情。 | 无 | work-logs.json；logs-profile-*.json；chapter11-browser.json | 已实现并有当前证据；待独立 e13 verify |
| AUD-LOG-007 | 5.3 | 若采用当前日志导航变加号的可选设计，点击进入今日写页；今日已有日志则编辑，不新建第二篇。不采用变加号本身不判缺陷。 | 无 | work-logs.json；logs-profile-*.json；chapter11-browser.json | 已实现并有当前证据；待独立 e13 verify |
| AUD-AIM-001 | 5.4 | 任务统计、关键词词云及建议三部分可用，基于实际任务规则分析，不依赖外部模型或 MBTI，不以固定词表/预写文案冒充实际分析。 | DEV-034 | ai-analysis.json；chapter11-browser.json | 已实现并有当前证据；待独立 e13 verify |
| AUD-AIM-002 | 5.4 | 统计含权限内任务数、执行状态、逾期、紧急程度分布；待完成审核与已完成分开，待创建不算执行任务。 | DEV-034 | ai-analysis.json；chapter11-browser.json | 已实现并有当前证据；待独立 e13 verify |
| AUD-AIM-003 | 5.4 | 上层公司统计/词云/建议，中层部门统计/词云及个人建议，下层本人统计/词云/建议。 | DEV-002、DEV-034 | ai-analysis.json；chapter11-browser.json | 已实现并有当前证据；待独立 e13 verify |
| AUD-AIM-004 | 5.4 | 词云从对应范围任务标题和说明提取，不默认分析完整私人日志；通过修改受控样本验证结果与实际数据有关。 | DEV-034 | ai-analysis.json；chapter11-browser.json | 已实现并有当前证据；待独立 e13 verify |
| AUD-AIM-005 | 5.4、5.6.2 | 建议覆盖临期/逾期、排期冲突及高紧急任务，临期采用剩余工期比例口径；进入或主动刷新时更新，并标明范围、生成方式及时间。 | DEV-014、DEV-034 | ai-analysis.json；chapter11-browser.json | 已实现并有当前证据；待独立 e13 verify |
| AUD-AIM-006 | 5.4 | 明细跳转、词云及建议无权限外信息；仅历史通知可读的任务不加入当前统计或分析。 | DEV-002 | ai-analysis.json；chapter11-browser.json | 已实现并有当前证据；待独立 e13 verify |
| AUD-ME-001 | 5.5 | 展示本人公司、姓名、部门、职位、团队、直属上级及手机号，提供修改本人手机号、改密和退出；组织及权限字段通过管理流程维护。 | DEV-002、DEV-003、DEV-028 | profile-phone.json；logs-profile-*.json；chapter11-browser.json | 已实现并有当前证据；待独立 e13 verify |
| AUD-ME-002 | 5.5 | 管理层直属下属列表可查看资料及权限内日志，不显示他人手机号，无资料卡派发按钮；不扩展上层为全公司资料列表。 | DEV-028 | profile-phone.json；logs-profile-*.json；chapter11-browser.json | 已实现并有当前证据；待独立 e13 verify |
| AUD-ME-003 | 3.2、8.2 | 姓名、邮箱等额外个人字段编辑范围依详细设计核对；现有能力不自动成为本版必交要求，但仍受权限和隐私边界约束。 | Q-02 | profile-phone.json；logs-profile-*.json；chapter11-browser.json | 已实现并有当前证据；待独立 e13 verify |
| AUD-NTF-001 | 5.6.1 | App 内消息及操作系统推送均实际可用，覆盖审核请求/结果、创建、基础信息及紧急程度、进展/状态、完成、重开、临期、逾期和失效；不能仅有站内事件或接口。 | DEV-004、DEV-012、DEV-029 | deadline-reminder-notification.json；notification-*.json；chapter11-browser.json | 部分已实现：站内链路有证据；系统推送延期，未验证 |
| AUD-NTF-002 | 5.6.1 | 创建申请提交、发布前拒绝/撤销/失效，仅申请人与对应审核人接收；其他负责人和公司管理者不提前收到或查看。 | DEV-012 | deadline-reminder-notification.json；notification-*.json；chapter11-browser.json | 已实现并有当前证据；待独立 e13 verify |
| AUD-NTF-003 | 5.6.1 | 已生效任务修改、进展、完成、重开、交接的申请提交通知本次审核人，申请人可跟踪；其他任务人员不提前看提议。 | DEV-004、DEV-030 | deadline-reminder-notification.json；notification-*.json；chapter11-browser.json | 已实现并有当前证据；待独立 e13 verify |
| AUD-NTF-004 | 5.6.1 | 已生效任务通过、拒绝/退回、撤销、失效结果发给申请人、审核人及相关任务人员；差异仅本次审核人可见。 | DEV-011、DEV-012 | deadline-reminder-notification.json；notification-*.json；chapter11-browser.json | 已实现并有当前证据；待独立 e13 verify |
| AUD-NTF-005 | 5.6.1 | 创建生效及基础信息/紧急程度/进展/状态变更生效通知创建者及当前全部负责人；创建通过后才通知全部负责人。 | 无，补事件矩阵 | deadline-reminder-notification.json；notification-*.json；chapter11-browser.json | 已实现并有当前证据；待独立 e13 verify |
| AUD-NTF-006 | 5.6.1 | 负责人变更生效通知创建者、当前全部负责人、新增及被移除人员，被移除者收到后按历史通知规则访问。 | DEV-030、DEV-033 | deadline-reminder-notification.json；notification-*.json；chapter11-browser.json | 已实现并有当前证据；待独立 e13 verify |
| AUD-NTF-007 | 5.6.1 | 临期/逾期通知创建者及当前全部负责人，待审失效另告申请人及审核人。 | DEV-012、DEV-014 | deadline-reminder-notification.json；notification-*.json；chapter11-browser.json | 已实现并有当前证据；待独立 e13 verify |
| AUD-NTF-008 | 5.6.1 | 每次任务状态变化均触发通知；申请提交与生效是不同事件，同次多字段变化汇总一条消息。 | DEV-004、DEV-012、DEV-030 | deadline-reminder-notification.json；notification-*.json；chapter11-browser.json | 已实现并有当前证据；待独立 e13 verify |
| AUD-NTF-009 | 5.6.1 | 同一事件多接收身份去重，自通知不排除；站内与系统推送是不同渠道，不被误作两条业务事件。 | DEV-029 | deadline-reminder-notification.json；notification-*.json；chapter11-browser.json | 部分已实现：站内链路有证据；系统推送延期，未验证 |
| AUD-TIM-001 | 5.6.2 | 公司时区下按自然经过时间算 T=D-S，不扣夜晚/周末/节假日；在 D-0.20T、D-0.10T、D-0.05T 各一次，十小时 09:00 至 19:00 样本应在 17:00、18:00、18:30。 | DEV-014 | deadline-reminder-notification.json；database-event.json | 已实现并有当前证据；待独立 e13 verify |
| AUD-TIM-002 | 5.6.2 | 全天 S 为开始日 00:00，D 为截止日下班时刻，默认 18:00 且管理员可设置；日历仍覆盖完整首尾日。 | DEV-015 | deadline-reminder-notification.json；database-event.json | 已实现并有当前证据；待独立 e13 verify |
| AUD-TIM-003 | 5.6.2 | 已完成及待审核期间不发常规临期/逾期；未完成超过截止只提醒一次，不沿用每日重复或提前 72 小时规则。 | DEV-014 | deadline-reminder-notification.json；database-event.json | 已实现并有当前证据；待独立 e13 verify |
| AUD-TIM-004 | 4.4、5.6.2 | 待审跨适用截止原申请失效、解冻，通知申请人与审核人调整重提；审批入口即使扫描未运行也不能通过到期申请。 | DEV-012 | deadline-reminder-notification.json；database-event.json | 已实现并有当前证据；待独立 e13 verify |
| AUD-TIM-005 | 5.6.2 | 创建及含排期变更的修改/重开用提议截止失效，其他申请用当前有效截止；覆盖提议截止早于/晚于旧值。 | DEV-012、DEV-013 | deadline-reminder-notification.json；database-event.json | 已实现并有当前证据；待独立 e13 verify |
| AUD-TIM-006 | 5.6.2 | 已过期排期不能继续提交等待旧申请通过；需调整重提，无基础编辑权的申请人由创建者调整后再发起自己的操作。 | DEV-012 | deadline-reminder-notification.json；database-event.json | 已实现并有当前证据；待独立 e13 verify |
| AUD-TIM-007 | 5.6.2 | 已生效未完成任务解冻后若已逾期，补一次逾期通知给创建者及当前负责人；与失效通知合并仍保留两种事件记录。 | DEV-012 | deadline-reminder-notification.json；database-event.json | 已实现并有当前证据；待独立 e13 verify |
| AUD-TIM-008 | 5.6.2 | 未发布创建申请只发失效/重提通知，不进普通提醒集合；申请失效不取消或自动完成任务，保持原有效内容及提交前状态。 | DEV-012 | deadline-reminder-notification.json；database-event.json | 已实现并有当前证据；待独立 e13 verify |
| AUD-TIM-009 | 5.6.2 | T=0 不发比例提醒，未完成超过截止仍一次逾期；区分零工期与非法倒置排期。 | DEV-014 | deadline-reminder-notification.json；database-event.json | 已实现并有当前证据；待独立 e13 verify |
| AUD-TIM-010 | 5.6.2 | 调度延迟、晚生效或解冻跨多个节点，只补最近一个已到临期节点，未来节点正常发送；已逾期只按逾期处理。 | DEV-014 | deadline-reminder-notification.json；database-event.json | 已实现并有当前证据；待独立 e13 verify |
| AUD-TIM-011 | 5.6.2 | 同任务/执行轮次/生效排期内，各比例节点及逾期分别去重；重开或排期变更生效后重新计算，拒绝/撤销的提议不当作已生效排期。 | DEV-014 | deadline-reminder-notification.json；database-event.json | 已实现并有当前证据；待独立 e13 verify |
| AUD-TIM-012 | 5.6.2、4.5 | 截止失效与人工审核/撤销竞争、调度重跑及旧请求重试不能产生多个最终结果、重复提醒或使过期申请复活。 | DEV-012 | deadline-reminder-notification.json；database-event.json | 已实现并有当前证据；待独立 e13 verify |
| AUD-MSG-001 | 5.6.3 | 打开消息即已读，入口未读数随之正确更新；不能打开后仍要求另一次手动标记才能读。 | DEV-031 | deadline-reminder-notification.json；notification-*.json；database-event.json | 已实现并有当前证据；待独立 e13 verify |
| AUD-MSG-002 | 5.6.3 | 已通过、拒绝/退回、撤销、失效的审核通知置灰显示结果，无有效审核按钮；已读、删除、撤回消息本身不处理申请。 | DEV-031 | deadline-reminder-notification.json；notification-*.json；database-event.json | 已实现并有当前证据；待独立 e13 verify |
| AUD-MSG-003 | 5.6.3 | 消息保存三个月并按期清理；本人只能删本人消息，不影响其他接收人或管理端历史；管理端具备通知管理。 | DEV-001、DEV-032、Q-03 | deadline-reminder-notification.json；notification-*.json；database-event.json | 已实现并有当前证据；待独立 e13 verify |
| AUD-MSG-004 | 5.6.3 | 发起人可撤回本操作通知，管理员在后台权限内管理，自动提醒由管理员管理；普通接收人仅删自己的消息，不能撤回整条业务通知。 | DEV-032 | deadline-reminder-notification.json；notification-*.json；database-event.json | 已实现并有当前证据；待独立 e13 verify |
| AUD-MSG-005 | 5.6.3 | 撤回仅限发送后三分钟内，超时无操作且接口拒绝；覆盖时限前后，精确边界若详细设计未定则单独记录，不自行解释。 | DEV-032、Q-03 | deadline-reminder-notification.json；notification-*.json；database-event.json | 已实现并有当前证据；待独立 e13 verify |
| AUD-MSG-006 | 5.6.3 | 撤回保留提示，移除正文和原跳转内容；本有权限者仍可从正常任务入口访问，任务结果、生效变更、审核申请及历史不被撤销。 | DEV-032 | deadline-reminder-notification.json；notification-*.json；database-event.json | 已实现并有当前证据；待独立 e13 verify |
| AUD-NTH-001 | 5.6.4 | 负责人被移除/授权收回后，原接收人已收到且仍在保存期的消息保留标题、变更摘要，可从原通知看任务详情；提示工作关系/授权撤销，不误称任务/申请取消。 | DEV-030、DEV-033 | deadline-reminder-notification.json；notification-*.json；database-event.json | 已实现并有当前证据；待独立 e13 verify |
| AUD-NTH-002 | 5.6.4 | 历史例外只读，不恢复修改、进展、完成、审核和重新关联权；其他人不能伪造通知标识借用。 | DEV-033 | deadline-reminder-notification.json；notification-*.json；database-event.json | 已实现并有当前证据；待独立 e13 verify |
| AUD-NTH-003 | 5.6.4 | 详情仅已生效内容，无待审提议、审核专用 diff、受限关联任务、他人手机号或日志；按字段及跳转逐项核验。 | DEV-033 | deadline-reminder-notification.json；notification-*.json；database-event.json | 已实现并有当前证据；待独立 e13 verify |
| AUD-NTH-004 | 5.6.4 | 历史查看不恢复普通列表、搜索、首页、任务计数或 AI 范围；通知入口之外直接访问是否授权须与只读例外实现一致，不能扩大成普通访问权。 | DEV-033 | deadline-reminder-notification.json；notification-*.json；database-event.json | 已实现并有当前证据；待独立 e13 verify |
| AUD-NTH-005 | 5.6.4 | 尚未送达消息不因预定接收人身份授予历史访问；待创建仍只向申请人与审核人开放。 | DEV-033 | deadline-reminder-notification.json；notification-*.json；database-event.json | 已实现并有当前证据；待独立 e13 verify |
| AUD-NTH-006 | 5.6.4 | 删除、撤回或超过保存期后，该消息不再提供历史查看入口；仍有正常权限者按正常规则访问。 | DEV-032、DEV-033 | deadline-reminder-notification.json；notification-*.json；database-event.json | 已实现并有当前证据；待独立 e13 verify |
| AUD-UX-001 | 7 | 简洁、层级清楚，密集任务可扫描、常用操作易触达；不为装饰挤占日历，无遮挡或无法读到的关键内容。记录可观察问题而非以审美偏好定缺陷。 | DEV-018、DEV-022 | chapter11-browser.json；home-calendar-three-viewports.json；screenshots/ | 浏览器视口证据已产出；真机部分延期，待独立核验 |
| AUD-UX-002 | 7、5.3 | 日志组织树和搜索适配移动交互；任务类别、紧急程度、状态有非纯色彩标记。 | DEV-024、DEV-027 | chapter11-browser.json；home-calendar-three-viewports.json；screenshots/ | 浏览器视口证据已产出；真机部分延期，待独立核验 |
| AUD-UX-003 | 7 | 时间轴可纵向浏览完整一天，左右切周主要在日期区，滚动不误触或切错日期；检查与页面及板块滚动的冲突。 | DEV-022、DEV-023 | chapter11-browser.json；home-calendar-three-viewports.json；screenshots/ | 浏览器视口证据已产出；真机部分延期，待独立核验 |
| AUD-UX-004 | 6 A-25、7 | 使用开发人员现有真机，记录机型、系统、测试环境和结论，覆盖板块滚动、切周、完整时间轴及大量重叠任务逐个点击；没有真机证据记未验证。 | 无，环境缺证 | chapter11-browser.json；home-calendar-three-viewports.json；screenshots/ | 延期：A-25 真机专项，未验证 |
| AUD-UX-005 | 5.2.5、7 | 真机体验需替代设计时记录并验证方案；布局参数可调整，但不自动放宽权限、审核及所有任务可访问要求，不用现有聚合方案替代正式并列要求。 | DEV-022 | chapter11-browser.json；home-calendar-three-viewports.json；screenshots/ | 浏览器视口证据已产出；真机部分延期，待独立核验 |

## A-01—25

| A | 正式验收要点 | AUD 覆盖 | 当前证据/状态 |
| --- | --- | --- | --- |
| A-01 | 管理员建号、生成初始密码、首次强制改密、登录/改密/退出可用；员工不能自行注册，管理员身份不能直接办理员工业务。 | AUD-ACC-001 至 004；AUD-ORG-006 | 对应实现与当前证据已建立；待独立 e13 verify |
| A-02 | 部门、职位必填，部门与团队分别维护，一人至多一个团队；团队创建者默认负责且可转交。管理员可配置角色、查看范围及派发权限。 | AUD-ORG-001 至 005 | 对应实现与当前证据已建立；待独立 e13 verify |
| A-03 | 跨部门任务对每个负责人所属部门的获授权管理者可见；派发候选受权限限制，不因任务可见而可派发或修改。 | AUD-PER-001 至 004、010 | 对应实现与当前证据已建立；待独立 e13 verify |
| A-04 | 上层看全公司日志，中层仅本人及直属下属，下层仅本人；同任务参与者不因此获得彼此日志权限。手机号仅本人及实际管理链上的上级可见，非上级不能通过资料范围或管理员身份获得号码，人员目录及业务摘要不返回手机号。 | AUD-PER-006、007、009；AUD-LOG-004 至 006 | 对应实现与当前证据已建立；待独立 e13 verify |
| A-05 | 公司信息仅管理端维护，最多十条且可调序，App 只读；个人信息由本人手动维护，最多十条，详情内编辑/删除。 | AUD-ADM-001 至 003；AUD-HOM-005 | 对应实现与当前证据已建立；待独立 e13 verify |
| A-06 | 审核依据先比较组织位置，同级最高负责人取已保存顺序第一位；跨管理链、上溯、创建者兜底和确实无审核人的结果可复现且有说明。 | AUD-ORG-007；AUD-TSK-003；AUD-REV-001 至 003、008 | 对应实现与当前证据已建立；待独立 e13 verify |
| A-07 | 申请人等于审核人时仍产生待审并明确审核，不自动免审；审核人兼负责人时不变更审核身份。负责人变更/交接由变更后算法得到的审核人处理。 | AUD-REV-004 至 007 | 对应实现与当前证据已建立；待独立 e13 verify |
| A-08 | 创建、基础资料、每次进展、完成、重开和交接纳入审核；同任务唯一待审并冻结其他操作，仅申请人可撤销自己的申请，编辑须先撤销。 | AUD-PER-004；AUD-FLW-001 至 003、017；AUD-ORG-009 | 对应实现与当前证据已建立；待独立 e13 verify |
| A-09 | 待创建审核在所有普通日历、搜索、首页、计数和 AI 统计隔离，仅创建者独立申请入口和对应审核入口可见；通过后再通知全部负责人。 | AUD-FLW-004 至 006；AUD-NTF-002、005 | 对应实现与当前证据已建立；待独立 e13 verify |
| A-10 | 修改待审保留原有效版；仅审核人可见差异对比，申请人可跟踪提交内容；拒绝/撤销保留原版。完成退回为进行中，撤销恢复提交前状态；仅创建者可重开，生效回到进行中。 | AUD-TSK-010；AUD-FLW-007 至 014 | 对应实现与当前证据已建立；待独立 e13 verify |
| A-11 | 所有任务操作可在管理端追溯，交接、通知删除/撤回/清理不抹掉记录；App 不开放完整历史。 | AUD-ADM-004；AUD-HIS-001 至 003 | 对应实现与当前证据已建立；待独立 e13 verify |
| A-12 | 首页四板块分别滚动；任务仅标题及右侧紧急程度、按派发时间倒序；日志为包含今天的最近十个自然日，最多十篇，按日志日期倒序。 | AUD-HOM-001 至 006 | 对应实现与当前证据已建立；待独立 e13 verify |
| A-13 | 视图具有年月、侧边展开、搜索、日期选择、右下加号及本人申请入口；当前范围三类互斥计数正确，跨日任务仅计一次。 | AUD-CAL-001 至 004；AUD-TMV-009、010 | 对应实现与当前证据已建立；待独立 e13 verify |
| A-14 | 月格固定、最多五条、超长标题直接裁切，溢出可打开当日完整列表；跨日、跨周跨度可识别，个人置顶不改写紧急程度。 | AUD-CAL-005 至 008 | 对应实现与当前证据已建立；待独立 e13 verify |
| A-15 | 周/日有全天区及可纵向滚动的完整时间轴；非全天跨日任务逐日对应真实时段；所有重叠任务在当天横向分栏可见、可点，不用聚合隐藏其余任务。 | AUD-TMV-001 至 003、005、007、008 | 对应实现与当前证据已建立；待独立 e13 verify |
| A-16 | 日期区域左右滑动按整周切换，日视图保持选中星期；任务真实时段不因置顶、最小点击尺寸或分栏改变。 | AUD-TMV-004、006、008 | 对应实现与当前证据已建立；待独立 e13 verify |
| A-17 | 每人每天一篇日志，当天可改，24:00 后冻结；默认本人，组织树及姓名搜索受日志权限过滤；日志页不混入任务申请或审核。 | AUD-PER-006、007；AUD-LOG-001 至 007 | 对应实现与当前证据已建立；待独立 e13 verify |
| A-18 | “我的”展示规定资料，可改本人手机号；管理层可从下属资料入口查看管理链内下属手机号，无资料卡派发按钮，上层全公司日志由日志页查看。 | AUD-ME-001、002；AUD-PER-009、011 | 对应实现与当前证据已建立；待独立 e13 verify |
| A-19 | 通知实际覆盖审核、任务变化及提醒，站内与系统推送均可用；同事件接收身份去重，打开即已读，办结置灰并禁止重复审核。 | AUD-NTF-001 至 009；AUD-MSG-001、002；AUD-FLW-017 | 站内通知有当前证据；系统推送（DEV-029）延期，未验证 |
| A-20 | 以总工期剩余 20%、10%、5% 各提醒一次，逾期一次；全天默认 18:00 且可设置；覆盖零工期、调度跨节点、排期调整及重开去重，完成和待审期间不发常规提醒。 | AUD-TIM-001 至 003、009 至 011 | 对应实现与当前证据已建立；待独立 e13 verify |
| A-21 | 待审跨过适用截止时间后原申请失效、解除冻结并要求调整重提；已生效未完成任务补一次逾期提醒；旧审核按钮、并发决定和重试均不能使失效申请再次生效。 | AUD-FLW-015、017；AUD-TIM-004 至 008、012 | 对应实现与当前证据已建立；待独立 e13 verify |
| A-22 | 通知保存三个月，可个人删除；有权者仅在发送后三分钟内撤回，撤回不影响业务结果及审计，普通接收人不能代发起人撤回整条通知。 | AUD-MSG-003 至 006；AUD-ADM-004；AUD-HIS-003 | 对应实现与当前证据已建立；待独立 e13 verify |
| A-23 | 负责人移除/授权收回后，原接收人仍可从保留的历史通知看标题、摘要及只读任务详情，并见授权撤销提示；不恢复当前列表、操作或其他数据权限。 | AUD-NTH-001 至 006 | 对应实现与当前证据已建立；待独立 e13 verify |
| A-24 | AI 地图使用当前权限内实际任务数据，统计、紧急程度分布、词云和规则建议可用，待完成审核与已完成分开；不以静态样例冒充分析。 | AUD-AIM-001 至 006；AUD-PER-008；AUD-TMV-011 | 对应实现与当前证据已建立；待独立 e13 verify |
| A-25 | 用开发人员现有真机验证板块滚动、日期切周、时间轴浏览和大量重叠任务点击，记录机型及结论；体验问题需验证替代设计。 | AUD-UX-001 至 005；AUD-TMV-007 | 授权延期：只有多视口浏览器证据，没有真机证据，未验证 |

## 独立验证边界

独立 verify 应重新执行 `implementation-notes.md` 中的命令并检查当前工作树，不应仅依据本表判定通过。尤其要保留以下边界：

- DEV-029、A-25、AUD-UX-004：延期/未验证。
- A-19 及涉及系统推送的 AUD：只能将站内通知部分纳入当前证据，不能声称系统推送通过。
- AUD-UX-001/002/003/005：浏览器视口行为可核验，真机体验部分仍延期。
- V4 历史快照迁移仍有数据映射阻断；新空库 V1—V12 成功不能替代历史快照清障。
- 本文不修改 `verification.md`，也不授权归档。
