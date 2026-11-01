# Spec Delta

## ADDED Requirements

### Requirement: Consistent log reading typography
本人日志列表及日志详情正文 SHALL 与下属日志正文使用一致的15px字号和1.55行高，在320/390及桌面宽度可读、可换行且无横溢。正文不因卡片和详情容器不同退回旧字号；编辑输入、评论及元信息保留各自用途。

#### Scenario: Read self and subordinate logs
- **WHEN** 用户从本人或下属入口阅读日志并打开详情
- **THEN** 正文 SHALL 具有一致阅读字号与行高，无截断或横溢，详情阅读全文及评论行为保持

### Requirement: Hourly schedule endpoint dragging
月历、横向日轴和纵向日轴 SHALL 为所有可见的未完成且非待审有效任务提供可触达的透明边缘拖动区，以一小时相对增量调整并保留分钟及另一端点；不能强制按整日调整。真实跨周/日裁剪的续接端不冒充端点，但可拖动整个任务，详情保留完整排期精确修改入口；零时长任务两端可分别命中。

拖动 SHALL 实时显示完整起止日期时刻，松开进入现有确认流程并明确需要原因及审核，确认前原有效排期不变。取消、Esc、pointercancel、失去捕获或逆序不得写入或误开详情/日期清单；键盘对应方向提供同粒度调整。不可见任务、冻结或完成任务不获得排期操作权；可见性只扩展排期权限，不扩展资料编辑权，版本变化仍阻止旧提议覆盖。

#### Scenario: Adjust endpoints by hours in every calendar presentation
- **WHEN** 在月历、横向或纵向日轴拖动真实起止端点，或用方向键调整
- **THEN** 提议 SHALL 以一小时相对变化，跨日/跨年日期正确、原分钟和另一端保持，三种视图均可完成确认和保存

#### Scenario: Preserve interaction and approval boundaries
- **WHEN** 用户取消拖动、拖出视图释放、使用零时长任务，或任务失权/冻结/版本变化
- **THEN** 合法手势 SHALL 可完成或安全取消，不被滚动/点击吞掉，不越权保存；未提交前日历保持原有效排期，提交后的待审位置遵循待审日程投影要求


### Requirement: Pending review calendar projection
已创建成功的任务 SHALL 在任意后续审核期间以虚线、淡底和可辨别的审核中提示显示，保留标签颜色。若申请包含新排期，本人及授权下属日程 SHALL 仅在申请排期位置显示一次，范围筛选、月/日视图及时间文字一致；实际有效排期、提醒、任务详情和编辑权限不得提前改变。未发布创建申请不进入日程。

#### Scenario: Move a task while waiting for approval
- **WHEN** 有效任务调时申请成功提交且待审
- **THEN** 日程 SHALL 在新位置以虚线显示，刷新/重新登录保持该显示，原位置不残留副本，待审期间不可再次拖动

#### Scenario: Any subsequent review and its resolution
- **WHEN** 已发布任务提交修改、完成、重开或交接审核，随后通过、驳回、撤回或失效
- **THEN** 待审期间 SHALL 为虚线，通过后按新有效排期实线显示，其他终态按仍有效排期恢复；权限和标签颜色保持，跨日跨月及下属日期范围不得漏项


### Requirement: Reschedule every visible active task
任何可见的已发布、未完成、非待审任务 SHALL 可以提交仅排期修改，无论是否创建人、当前业务责任方或负责人。前后端 SHALL 保持资料、标签、负责人、进展及执行状态权限不变；审核仍按实际操作者直属上级，创始人按原规则免审。生效前重新校验可见性及仅排期差异，版本/冻结/完成限制保持。

#### Scenario: Viewer proposes schedule without editing other fields
- **WHEN** 当前用户能查看有效任务但不能编辑其资料，并从月/日或下属日程调整排期
- **THEN** SHALL 可提交日期/时刻与原因，待审新位置虚线显示；恶意携带其他字段、不可见/失权/完成/冻结或旧版本请求被拒绝

### Requirement: Partial day bars in the month calendar
月历 SHALL 按每天实际占用时间绘制时段条，例如09:00—12:00只占当天的3/24宽，位置从9/24处开始，跨日首尾按各日时段绘制。全天覆盖仍占整日，点任务使用最小可见标记而不虚增时长。标题和时间必须在真实时段框内，小屏可裁切并提供完整提示和详情；命中区不得虚增真实时长。

#### Scenario: Direct month schedule editing
- **WHEN** 用户在月历操作任务，包括跨周续接片段
- **THEN** SHALL 可直接平移任务、调整真实起止或打开仅排期的精确确认，按小时调整保留分钟；取消、触摸滚动、单击日期清单与审核虚线不回归，本人及下属月历真实时段比例一致


### Requirement: Write requests work on ordinary HTTP origins
公共写入入口 SHALL 在普通HTTP页面没有crypto.randomUUID时仍能使用安全随机请求标识提交。支持原生randomUUID的页面保持兼容；随机标识必须符合服务端幂等键要求，不改变权限/审核/ETag或请求载荷。

#### Scenario: Submit and retry from a non-localhost HTTP page
- **WHEN** 用户通过HTTP IP或域名提交排期，原生randomUUID不可用，且首次请求已提交但响应丢失
- **THEN** SHALL 正常生成标识并发送，同一内容重试复用标识且只产生一笔申请；修改内容或新操作生成新标识，不丢失失败后的表单


### Requirement: Pending frame and caption use the proposed time together
任务调整提交后的虚线框 SHALL 使用新申请起止时间决定位置与长度，标题和时间 SHALL 在框内并随框移动。不得留下旧位置框或框外独立标题。本人和下属月/日视图 SHALL 不显示“调时、起、止”按钮；授权有效任务仍能通过框体平移、透明边缘改时及详情精确修改。待审/完成权限、取消、滚动及键盘行为保持。

#### Scenario: Review a rescheduled task at its proposed position
- **WHEN** 跨日/跨月任务提交新排期并等待审核，随后刷新或切换视图
- **THEN** 新位置的虚线框 SHALL 与申请时间几何一致，框内文字显示新排期，不残留外部标题及可见调时/起止按钮，通过/驳回/撤回后按相应排期恢复
