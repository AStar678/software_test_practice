# Spec Delta

## ADDED Requirements

### Requirement: Consistent log reading typography
本人日志列表及日志详情正文 SHALL 与下属日志正文使用一致的15px字号和1.55行高，在320/390及桌面宽度可读、可换行且无横溢。正文不因卡片和详情容器不同退回旧字号；编辑输入、评论及元信息保留各自用途。

#### Scenario: Read self and subordinate logs
- **WHEN** 用户从本人或下属入口阅读日志并打开详情
- **THEN** 正文 SHALL 具有一致阅读字号与行高，无截断或横溢，详情阅读全文及评论行为保持

### Requirement: Calendar dragging by presentation
拖动 SHALL 仅在本人月/日视图对正常可见、已发布、未完成、非待审且有现有仅排期权限的任务提供。本人视图仍仅展示当前有效负责人任务；任务表单及下属日程 SHALL 不提供整条或端点拖动，也不提供画布上的独立调时按钮，但可进入正常鉴权任务详情，详情沿用当前用户原有操作权限。历史通知的受限只读详情不得因此取得操作权。

本人月历 SHALL 按公司日期以一天为步长：整条平移保留原日内起止时刻和工期；真实开始/截止端点分别按天调整对应日期、保留该端日内时刻与另一端不变，允许改变工期。跨周/月续接段不冒充真实端点，但可整体平移完整任务；按抓取日期和目标日期计算差量，不把续接片段误当原始开始。

本人横向/纵向日轴 SHALL 以一小时相对差量调整并保留原分钟；整条平移保持工期，端点调整保持另一端不变。纵向全天区的历史全天任务及定时整日覆盖任务 SHALL 同样有可触达的整条和真实端点操作，不得因显示归类丢失能力；仍在全天区展示，不重复进入时间轴。零时长任务两端 SHALL 可分别命中。

拖动 SHALL 实时显示完整起止日期时刻，松开进入仅排期确认，明确原因和实际操作者直属上级审核，固定创始人按原规则免审。月历键盘按天、日轴键盘按小时。取消、Esc、pointercancel、失去捕获、逆序或无位移 SHALL 不写入、不误开详情/日期清单，正常触摸滚动继续可用。提交 SHALL 重验权限、冻结、完成、期限、版本与幂等，未提交前保留有效位置。

#### Scenario: Move an entire month bar by dates
- **WHEN** 用户在本人月历将任务整条移动两个公司日期，包括跨周/月/年或抓取续接片段
- **THEN** 起止日期 SHALL 同步平移两天，日内时刻及工期保持；预览完整排期，确认后按原原因/审核流程提交，不能按小时抖动或误重设片段开始日

#### Scenario: Resize a month endpoint by days
- **WHEN** 用户拖动本人月历真实开始或截止端点一天，或用对应方向键调整
- **THEN** 该端日期 SHALL 改变一天且保留原日内时刻，另一端不变，工期相应变化；逆序拒绝，跨月/年与午夜正确

#### Scenario: Adjust day events and the all-day section by hours
- **WHEN** 用户在本人横向/纵向日视图操作普通定时、零时长、历史全天或完整覆盖当天的定时任务
- **THEN** 合法整条及真实端点 SHALL 可用指针或键盘按小时调整并确认保存，分钟保持；纵向全天区不能缺少操作入口，仍不在时间轴重复绘制

#### Scenario: Separate canvas interactions from task-detail permissions
- **WHEN** 同一任务从本人视图、任务表单或下属页面展示并进入详情
- **THEN** 只有本人月/日视图 SHALL 提供拖动；另外两种入口不触发拖动，但详情继续按当前用户已有权限提供基础编辑或其他专用操作，不因来源强制整体只读、不因可见扩大基础字段编辑权

#### Scenario: Preserve cancellation and stale-version boundaries
- **WHEN** 拖动取消、离屏释放、失去捕获、逆序，或任务失权/完成/待审/版本变化
- **THEN** 操作 SHALL 安全取消或明确拒绝，原业务数据不被覆盖；正常点击和滚动可用，旧页面不能通过重放写入

### Requirement: Pending review calendar projection
已发布任务进入任意后续审核 SHALL 显示虚线外包围线、淡底及可辨审核提示，并保留标签颜色。若申请包含新排期，本人和授权下属日程 SHALL 只在提议位置显示一次，按投影排期查询日期范围并同步框体及文字；无排期变化则在有效位置虚线显示。月历按日级跨度绘制，日轴按真实时段绘制。实际有效排期、提醒、任务详情、表单和其他业务权限 SHALL 不提前改变；未发布创建申请不进入日程。

待审期间 SHALL 冻结原有任务业务修改和拖动，独立评论仍依原权限。提交成功后刷新/重新登录保持提议位置；通过后按新有效排期显示实线，驳回/撤回/失效后恢复仍有效排期。固定创始人合法免审 SHALL 直接显示新有效实线，不伪造待审阶段。

#### Scenario: Move a task while waiting for approval
- **WHEN** 已发布任务通过拖动或详情提交新排期且需要他人审核
- **THEN** 本人/下属日程 SHALL 在提议位置显示唯一虚线任务，原位置无副本，框体/文字一致，刷新重登保持；普通详情/表单/提醒仍有效版且待审不可再次拖动

#### Scenario: Any subsequent review and its resolution
- **WHEN** 已发布任务提交修改、进展、完成、重开或交接申请，随后通过、驳回、撤回或失效
- **THEN** 日程 SHALL 在待审期间显示虚线及审核提示，没有新排期时位置不变；终态按仍有效或新有效排期恢复实线，跨日跨月、下属范围、标签颜色与完成状态正确

#### Scenario: Keep unpublished tasks out and apply founder changes directly
- **WHEN** 创建申请尚未发布，或固定创始人合法免审调整已发布任务
- **THEN** 前者 SHALL 不进入正常日程，后者直接显示新有效实线；不能为展示虚线而制造未发布任务或自审待办

### Requirement: Reschedule every visible active task
拥有正常查看权的已发布、未完成、非待审任务 SHALL 继续允许提交既有仅排期修改，无论是否创建人、当前业务责任方或负责人。服务端仅排期资格 SHALL 与页面是否提供拖动分开；不能因为本人视图仅列负责人任务而将接口收紧为仅负责人。基础资料、标签、负责人、进展及执行状态权限 SHALL 保持原规则，不扩展为可见即可编辑基础字段。

正常任务详情 SHALL 按现有权限保留精确排期操作，表单及下属入口不强制详情只读。审核仍按实际操作者直属上级，创始人按原规则免审；生效前重验正常可见性及仅排期差异，版本/冻结/完成限制保持。历史通知只读例外不是正常查看权，不能用于提交。

#### Scenario: Propose a schedule from an authorized detail without editing other fields
- **WHEN** 用户能正常查看有效任务但不能编辑其资料，从表单或下属页面进入普通任务详情，并按既有仅排期权限提交
- **THEN** SHALL 可提交日期/时刻与原因，待审新位置虚线显示；页面本身无拖动，夹带资料/负责人/标签、失权/完成/冻结/旧版本或仅有历史只读权的请求拒绝

### Requirement: Day-scale bars in the month calendar
本人及下属月历 SHALL 按公司日期中任务实际占用的日期绘制日级任务条，不按日内小时缩窄或偏移。例如09:00—12:00占当天一个日期格，跨日任务连续覆盖占用日期；截止恰好00:00不多占截止日，零时长在所属日明确标识且不改变真实工期。具体起止时刻可从日视图或详情查看，日级绘图不得改写业务排期、全天属性、提醒或有效版本。

月历标题及显示的日期信息 SHALL 位于日级框内，窄屏可裁切并提供完整提示与详情；跨周/月续接可辨、溢出数量及完整日清单正确。本人框体/真实边缘提供按天操作，下属同样绘图但不提供拖动。日视图仍按真实时段展示，不因共用月历算法扩大成全天。

#### Scenario: Draw short tasks and midnight endings by dates
- **WHEN** 本人或下属月历展示09:00—12:00、跨日且午夜截止、跨周任务及零时长任务
- **THEN** 短任务 SHALL 占当天日格而非3/24宽，跨日覆盖正确且午夜无次日副本，点任务工期仍为零；320/390/桌面标题可达，详情及日轴保留精确时刻

### Requirement: Write requests work on ordinary HTTP origins
公共写入入口 SHALL 在普通HTTP页面没有crypto.randomUUID时仍能使用安全随机请求标识提交。支持原生randomUUID的页面保持兼容；随机标识必须符合服务端幂等键要求，不改变权限/审核/ETag或请求载荷。

#### Scenario: Submit and retry from a non-localhost HTTP page
- **WHEN** 用户通过HTTP IP或域名提交排期，原生randomUUID不可用，且首次请求已提交但响应丢失
- **THEN** SHALL 正常生成标识并发送，同一内容重试复用标识且只产生一笔申请；修改内容或新操作生成新标识，不丢失失败后的表单

### Requirement: Pending frame and caption use the proposed time together
任务排期调整提交后的虚线框 SHALL 使用提议起止确定展示位置和跨度，标题及日期/时刻信息位于框内并随框移动；月历采用日级框，日轴采用真实时段框，不残留旧框或框外独立标题。本人及下属日程画布 SHALL 不显示独立“调时、起、止”按钮；仅本人视图的合法任务提供框体平移及透明边缘操作，普通详情保留现有精确排期操作。

#### Scenario: Review a rescheduled task at its proposed position
- **WHEN** 跨日/月任务提交新排期并待审，随后刷新或切换本人/下属视图
- **THEN** 框体与文字 SHALL 一致取提议排期，月历按日期跨度、日轴按实际时段，不显示旧位置或外部标题；待审不提供拖动，下属无论是否待审均无画布调时，通过/驳回/撤回后按有效排期恢复
