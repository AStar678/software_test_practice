## MODIFIED Requirements

### Requirement: Five-page navigation
App SHALL 仅提供“导图”“视图”“日志”“AI地图”“我的”五个主业务页面，固定导航切换时保持真实认证身份；通知中心承接审核而非第六个主页面，创建/派发与本人申请入口属于视图，日志只写看日志。演示身份选择 SHALL 经过实际认证且不得改变服务端权限。

#### Scenario: Navigate with an authenticated identity
- **WHEN** 用户依次切换五页或从通知进入审核
- **THEN** 系统 SHALL 保持真实账号及组织权限，五页导航仅选中当前页，通知 SHALL 不成为第六页

#### Scenario: Navigate across the prototype
- **WHEN** 用户依次切换五页或从通知进入审核
- **THEN** 系统 SHALL 保持真实账号及组织权限，五页导航仅选中当前页，通知 SHALL 不成为第六页

### Requirement: Four-quadrant dashboard
导图页 SHALL 固定展示四象限，各象限独立纵向滚动，整体不横向或纵向滚动，也不增加说明区。公司信息最多十条，按管理端设置顺序只读展示，包括上层无维护入口。本人被他人派发且未完成的正常任务 SHALL 按实际派发给本人的时间倒序取最多十项，条目仅标题和右对齐紧急程度，点击详情查看其他信息。个人信息最多十条且由本人手动维护，先只读详情再编辑删除，列表不外显操作，不从日志生成。近期日志 SHALL 为公司时区包含今天及此前九个自然日的本人原文，按日志日期倒序最多十篇；未发布任务及历史通知访问例外 SHALL 不进入正常任务区。

#### Scenario: Scroll independent quadrants
- **WHEN** 任一象限超出可用高度
- **THEN** 仅该象限 SHALL 滚动，其他象限、头部及底部导航保持原位

#### Scenario: Rank a newly assigned old task
- **WHEN** 旧任务今天新增本人为负责人，另一新任务昨天已派发给本人
- **THEN** 今日派发的旧任务 SHALL 排在前面，刷新后顺序与后端前十项一致，不能改用创建时间、截止或紧急度排序

#### Scenario: Show concise tasks and read only company information
- **WHEN** 上层或普通员工进入导图
- **THEN** 任务项 SHALL 仅展示标题和右侧紧急程度并可进入详情，公司信息 SHALL 无编辑删除入口

#### Scenario: Maintain personal items through detail
- **WHEN** 用户点击个人条目后编辑/删除或尝试新增第十一条
- **THEN** 系统 SHALL 先展示只读详情且仅在详情提供维护，拒绝第十一条，日志原文 SHALL 不被改写

#### Scenario: Use the ten day log window
- **WHEN** 本人有今天、九天前及十天前的日志
- **THEN** 首页 SHALL 包含今天与九天前而排除十天前，按业务日期倒序展示原文

#### Scenario: View the four dashboard quadrants
- **WHEN** 任一象限超出可用高度
- **THEN** 仅该象限 SHALL 滚动，其他象限、头部及底部导航保持原位

#### Scenario: Scroll one dashboard quadrant
- **WHEN** 任一象限超出可用高度
- **THEN** 仅该象限 SHALL 滚动，其他象限、头部及底部导航保持原位

#### Scenario: Read an assigned task without clipping
- **WHEN** 上层或普通员工进入导图
- **THEN** 任务项 SHALL 仅展示标题和右侧紧急程度并可进入详情，公司信息 SHALL 无编辑删除入口

#### Scenario: Executive maintains company information
- **WHEN** 上层或普通员工进入导图
- **THEN** 任务项 SHALL 仅展示标题和右侧紧急程度并可进入详情，公司信息 SHALL 无编辑删除入口

#### Scenario: Reject company information above the limit
- **WHEN** 公司信息已十条且管理员新增，包括并发新增
- **THEN** 系统 SHALL 拒绝第十一条且提示上限，App 上层也无公司信息维护权

#### Scenario: Edit personal information
- **WHEN** 用户点击个人条目后编辑/删除或尝试新增第十一条
- **THEN** 系统 SHALL 先展示只读详情且仅在详情提供维护，拒绝第十一条，日志原文 SHALL 不被改写

#### Scenario: Reject personal information above the limit
- **WHEN** 用户点击个人条目后编辑/删除或尝试新增第十一条
- **THEN** 系统 SHALL 先展示只读详情且仅在详情提供维护，拒绝第十一条，日志原文 SHALL 不被改写

### Requirement: Calendar task views
视图页 SHALL 提供月、周、日模式：顶部左侧展开、中央可点年月、右侧名称搜索；侧面板提供模式切换、当前范围三类互斥数量及独立本人申请入口，右下悬浮创建按钮不遮挡导航和任务。周/日偏离本周/今天时 SHALL 在搜索左侧提供返回快捷键，日期确认后 SHALL 定位相应月、周或日。搜索 SHALL 仅返回当前有权查看的正常任务。

月视图 SHALL 为默认模式，周一至周日排列、日期格固定、相邻月日期弱化但可读，跨日跨周跨度可辨；默认按开始时间升序，同时间按任务标识稳定排序。每格最多五条、空间不足可更少，超长标题直接裁切不追加省略号；有隐藏任务则显示实际隐藏数量，点击日期格 SHALL 打开当天全部正常任务列表。本人置顶 SHALL 持久化且仅改变本人月格及当日列表顺序，不改紧急程度；相同置顶状态仍按时间排序。

周/日 SHALL 有周一至周日日期行、全天区及可纵向滚动的 00:00—24:00 时间轴，不将一天压进首屏。全天按完整日期范围显示，非全天跨日逐日显示真实覆盖时段；重叠任务 SHALL 在当天按完整并发列数横向并列，全天及定时任务均逐项可见、可点，不用折叠或 +N 代替。标题可裁切但不得互相覆盖阻止点击，最小点击区域与置顶标识 SHALL 不改真实时间位置。

日期区域左右滑动 SHALL 每次切完整一周并对齐，日视图保持所选星期，任务区竖滚不误切周。每块 SHALL 有可见的非纯色关系标记与无障碍名称：本人负责优先“我负责”，创建但非负责为“我分配”，其余授权任务“仅可见”；保留稳定低饱和配色且颜色非唯一含义。范围数量 SHALL 按当前月/周/日相交排期对正常任务去重，待完成审核、已完成、逾期未完成分别统计，已完成不计逾期。时间轴置顶仅强调，不移动时段。

#### Scenario: Use the required calendar entry points
- **WHEN** 用户展开面板、选日期、搜索、打开本人申请或点右下加号
- **THEN** 系统 SHALL 分别提供模式/计数、相应日期定位、权限内正常任务搜索、隔离的本人申请及创建表单，收起后日历 SHALL 占主体

#### Scenario: Read a month and open a complete day list
- **WHEN** 跨月跨周任务与超过月格容量的任务同时存在
- **THEN** 系统 SHALL 绘制可辨跨度、固定格和真实隐藏数，最多显示五条，标题直接裁切；点日期格 SHALL 展示该日全部有权正常任务而非直接下钻周视图

#### Scenario: Pin only one's own ordering
- **WHEN** 用户置顶并刷新，而另一用户读取同一任务
- **THEN** 本人的月格及完整日列表 SHALL 置顶优先，同组时间升序；他人顺序、任务紧急程度及时间轴位置 SHALL 不变

#### Scenario: Split a timed cross day task
- **WHEN** 非全天任务从周二 20:00 到周三 10:00
- **THEN** 周视图 SHALL 在周二 20:00—24:00 和周三 00:00—10:00 绘制对应时段，全天区 SHALL 无该任务；截止恰为午夜 SHALL 不增加次日零长度副本

#### Scenario: Display every overlapping and all day task
- **WHEN** 周/日某天有四个同时间任务及多项全天任务
- **THEN** 所有定时任务 SHALL 在当天各自分栏且逐个可点击，所有全天任务 SHALL 独立展示，时间轴可竖滚至 24:00，不能用 +4、+3 或全天 +N 隐藏任务

#### Scenario: Switch a whole week while preserving weekday
- **WHEN** 日视图选中周三，用户在日期区向前/后滑动一周或在时间轴竖滚
- **THEN** 切周 SHALL 选中前/后周三且对齐完整周，竖滚 SHALL 不改变日期；点日期可直接选择当天，点任务 SHALL 只打开详情

#### Scenario: Count mutually exclusive relationships
- **WHEN** 同任务兼有创建者/负责人身份并跨越多天，且有待创建及仅历史访问任务
- **THEN** 当前显示范围 SHALL 只计一次“我负责”，不重复计“我分配”，排除未发布及历史例外；三类 SHALL 有可见非纯色标记，待完成/已完成/逾期 SHALL 分开呈现

#### Scenario: Open the default month view
- **WHEN** 用户展开面板、选日期、搜索、打开本人申请或点右下加号
- **THEN** 系统 SHALL 分别提供模式/计数、相应日期定位、权限内正常任务搜索、隔离的本人申请及创建表单，收起后日历 SHALL 占主体

#### Scenario: Select a year and month
- **WHEN** 用户展开面板、选日期、搜索、打开本人申请或点右下加号
- **THEN** 系统 SHALL 分别提供模式/计数、相应日期定位、权限内正常任务搜索、隔离的本人申请及创建表单，收起后日历 SHALL 占主体

#### Scenario: Drill from month to week
- **WHEN** 用户点击月视图日期格
- **THEN** 系统 SHALL 按 V2 打开当天完整任务列表，替代旧下钻周视图；周模式从面板切换

#### Scenario: Ignore blank month task space
- **WHEN** 用户点击月视图日期格内无任务条的区域
- **THEN** 系统 SHALL 按 V2 打开当天完整列表；点击独立任务条仅开该任务详情

#### Scenario: Drill from week to day
- **WHEN** 用户选择周视图某日期的日程入口
- **THEN** 系统 SHALL 定位该日视图，任务点击不同时触发日期导航

#### Scenario: Ignore blank week task space
- **WHEN** 用户点击周时间轴空白或竖滚
- **THEN** 系统 SHALL 不误开任务或切换模式，日期区手势与任务区竖滚分别处理

#### Scenario: Switch time granularity
- **WHEN** 用户展开面板、选日期、搜索、打开本人申请或点右下加号
- **THEN** 系统 SHALL 分别提供模式/计数、相应日期定位、权限内正常任务搜索、隔离的本人申请及创建表单，收起后日历 SHALL 占主体

#### Scenario: Keep task clicks distinct from drill-down
- **WHEN** 日视图选中周三，用户在日期区向前/后滑动一周或在时间轴竖滚
- **THEN** 切周 SHALL 选中前/后周三且对齐完整周，竖滚 SHALL 不改变日期；点日期可直接选择当天，点任务 SHALL 只打开详情

#### Scenario: Navigate and return from a week
- **WHEN** 日视图选中周三，用户在日期区向前/后滑动一周或在时间轴竖滚
- **THEN** 切周 SHALL 选中前/后周三且对齐完整周，竖滚 SHALL 不改变日期；点日期可直接选择当天，点任务 SHALL 只打开详情

#### Scenario: Navigate and return from a day
- **WHEN** 日视图选中周三，用户在日期区向前/后滑动一周或在时间轴竖滚
- **THEN** 切周 SHALL 选中前/后周三且对齐完整周，竖滚 SHALL 不改变日期；点日期可直接选择当天，点任务 SHALL 只打开详情

#### Scenario: Render a spanning task bar
- **WHEN** 非全天任务从周二 20:00 到周三 10:00
- **THEN** 周视图 SHALL 在周二 20:00—24:00 和周三 00:00—10:00 绘制对应时段，全天区 SHALL 无该任务；截止恰为午夜 SHALL 不增加次日零长度副本

#### Scenario: Render an all-day task
- **WHEN** 周/日某天有四个同时间任务及多项全天任务
- **THEN** 所有定时任务 SHALL 在当天各自分栏且逐个可点击，所有全天任务 SHALL 独立展示，时间轴可竖滚至 24:00，不能用 +4、+3 或全天 +N 隐藏任务

#### Scenario: Distinguish visible tasks
- **WHEN** 同屏显示多个不同任务
- **THEN** 系统 SHALL 保持稳定低饱和任务色、尽量区分，色板耗尽可复用；关系 SHALL 有可见非纯色标记

#### Scenario: Identify the current user's task relationship
- **WHEN** 同任务兼有创建者/负责人身份并跨越多天，且有待创建及仅历史访问任务
- **THEN** 当前显示范围 SHALL 只计一次“我负责”，不重复计“我分配”，排除未发布及历史例外；三类 SHALL 有可见非纯色标记，待完成/已完成/逾期 SHALL 分开呈现

#### Scenario: Show only task names in bars
- **WHEN** 日历绘制任务块
- **THEN** 系统 SHALL 显示标题及必要关系标记，不塞入描述/进展等详情，裁切后仍可点击详情读全文

#### Scenario: Order visible task lanes
- **WHEN** 用户置顶并刷新，而另一用户读取同一任务
- **THEN** 本人的月格及完整日列表 SHALL 置顶优先，同组时间升序；他人顺序、任务紧急程度及时间轴位置 SHALL 不变

#### Scenario: Fill five monthly task rows
- **WHEN** 跨月跨周任务与超过月格容量的任务同时存在
- **THEN** 系统 SHALL 绘制可辨跨度、固定格和真实隐藏数，最多显示五条，标题直接裁切；点日期格 SHALL 展示该日全部有权正常任务而非直接下钻周视图

#### Scenario: Handle crowded time slots
- **WHEN** 跨月跨周任务与超过月格容量的任务同时存在
- **THEN** 系统 SHALL 绘制可辨跨度、固定格和真实隐藏数，最多显示五条，标题直接裁切；点日期格 SHALL 展示该日全部有权正常任务而非直接下钻周视图

#### Scenario: Open overflow tasks for one date
- **WHEN** 跨月跨周任务与超过月格容量的任务同时存在
- **THEN** 系统 SHALL 绘制可辨跨度、固定格和真实隐藏数，最多显示五条，标题直接裁切；点日期格 SHALL 展示该日全部有权正常任务而非直接下钻周视图

### Requirement: Role-scoped visibility
系统 SHALL 基于真实账号当前组织与配置授权分别检查任务、日志、分析和人员查询。上层按授权看公司任务，中层按负责人所属部门看本部门及涉及本部门的跨部门任务，下层看本人创建或负责的正常任务。日志 SHALL 上层本人及公司、中层本人及直属下属、下层本人；同团队或同任务不自动授予日志权。管理员不自动取得业务权限。列表、详情、搜索、关联、人员筛选、通知跳转及统计明细 SHALL 执行同类权限，待创建隔离优先；历史消息只读例外仅依独立要求生效。

#### Scenario: Read a task crossing departments
- **WHEN** 两部门人员共同负责一个已发布任务
- **THEN** 两部门获授权管理者 SHALL 可见，创建者部门 SHALL 不决定任务部门归属；查看权 SHALL 不自动授予派发、修改或审核权

#### Scenario: Separate direct reports from teammates
- **WHEN** 中层与甲同团队但无直属关系，乙为直属下属但不同团队
- **THEN** 日志列表、详情、组织树及姓名搜索 SHALL 排除甲并包含乙；任务权限 SHALL 按独立部门和授权规则计算

#### Scenario: Deny unauthorized detail and privacy leakage
- **WHEN** 无权用户直接访问任务、日志、关联、统计明细或他人资料
- **THEN** 系统 SHALL 拒绝或裁剪受限数据；手机号仅本人资料及具备当前资料查看权、组织层级更高的实际管理链上级所读人员详情 SHALL 可返回，其他 DTO SHALL 不含号码；知晓 ID 或前端角色按钮 SHALL 不授予权限

#### Scenario: Compare role visibility
- **WHEN** 两部门人员共同负责一个已发布任务
- **THEN** 两部门获授权管理者 SHALL 可见，创建者部门 SHALL 不决定任务部门归属；查看权 SHALL 不自动授予派发、修改或审核权

#### Scenario: Prevent unauthorized detail access
- **WHEN** 无权用户直接访问任务、日志、关联、统计明细或他人资料
- **THEN** 系统 SHALL 拒绝或裁剪受限数据；手机号仅本人资料及具备当前资料查看权、组织层级更高的实际管理链上级所读人员详情 SHALL 可返回，其他 DTO SHALL 不含号码；知晓 ID 或前端角色按钮 SHALL 不授予权限

### Requirement: Role-scoped task creation and assignment
系统 SHALL 根据独立派发授权生成负责人候选并在提交和批准时重新检查；上层可按授权派给自己、中下层，中层可按授权派给自己及本部门下属，下层仅本人。创建默认负责人 SHALL 包含本人，列表可在权限内调整并明确展示保存顺序。负责人选择 SHALL 支持按授权部门及姓名搜索、多选、跨部门保留、确认保存和取消还原。所有创建 SHALL 使用统一审核算法，不按“自建/派发”或角色免审；批准后进入待开始。

#### Scenario: Select and order authorized assignees
- **WHEN** 有跨部门派发权的用户打开创建并选人、换序、跨部门追加
- **THEN** 本人 SHALL 默认入选，表单及回读 SHALL 保留确认后的顺序；取消 SHALL 还原选择，无匹配 SHALL 有空状态且不暴露权限外人员

#### Scenario: Enforce dispatch independently from viewing
- **WHEN** 用户可见某部门任务但无该部门派发权，或员工尝试给同事创建任务
- **THEN** 候选 SHALL 不提供该人，直接提交及权限变更后的批准 SHALL 拒绝越权派发

#### Scenario: Isolate an unpublished creation
- **WHEN** 有审核人的创建提交后尚未批准、被拒绝、撤销或失效
- **THEN** 任务 SHALL 不在普通列表、日历、搜索、首页、计数和分析，仅创建者从视图独立申请入口跟踪及当前审核人从通知处理；批准后 SHALL 发布为待开始

#### Scenario: Executive selects assignees across departments
- **WHEN** 有跨部门派发权的用户打开创建并选人、换序、跨部门追加
- **THEN** 本人 SHALL 默认入选，表单及回读 SHALL 保留确认后的顺序；取消 SHALL 还原选择，无匹配 SHALL 有空状态且不暴露权限外人员

#### Scenario: Manager assigns a departmental task
- **WHEN** 用户可见某部门任务但无该部门派发权，或员工尝试给同事创建任务
- **THEN** 候选 SHALL 不提供该人，直接提交及权限变更后的批准 SHALL 拒绝越权派发

#### Scenario: Cancel assignee selection
- **WHEN** 有跨部门派发权的用户打开创建并选人、换序、跨部门追加
- **THEN** 本人 SHALL 默认入选，表单及回读 SHALL 保留确认后的顺序；取消 SHALL 还原选择，无匹配 SHALL 有空状态且不暴露权限外人员

#### Scenario: Search for an unavailable assignee
- **WHEN** 有跨部门派发权的用户打开创建并选人、换序、跨部门追加
- **THEN** 本人 SHALL 默认入选，表单及回读 SHALL 保留确认后的顺序；取消 SHALL 还原选择，无匹配 SHALL 有空状态且不暴露权限外人员

#### Scenario: Employee submits a self-created task
- **WHEN** 下层给自己创建任务
- **THEN** 本人 SHALL 默认负责并按统一算法提审，有审核人时隔离至批准，确实无审核人才留因直接生效

#### Scenario: Superior reviews a self-created task
- **WHEN** 指定审核人批准或拒绝创建
- **THEN** 批准 SHALL 发布为待开始，拒绝 SHALL 保留结果并允许创建者调整重提，不发布执行任务

### Requirement: Task structure and attributes
任务 SHALL 展示标题、说明、原创建者、独立创建时间、有序多负责人、起止排期、全天、紧急/高/中/低紧急程度、离散执行状态、文字进展、可选父任务、审核人及意见。系统 SHALL 不提供抽象任务类型、百分比进度或进度条；父子任务独立执行，父状态不由子任务自动改变或计算百分比。父任务搜索 SHALL 按名称在当前正常可见且无环候选中匹配、允许清空，并独立检查关联详情权限。定时任务 SHALL 使用精确时刻，全天只填写日期且首尾均包含，截止不得早于开始；转交、排期修改与重开 SHALL 不改变原创建者或创建时间。

任务表单的说明与完成标准输入区 SHALL 各具有至少 234px 的最小高度，并在窄屏内可滚动访问其他字段及提交操作。

#### Scenario: Edit task text in expanded fields
- **WHEN** 用户在构建后的实际页面创建或编辑任务
- **THEN** 说明与完成标准输入区 SHALL 各至少 234px 高，内容和原有校验 SHALL 保留，窄屏下其他字段及保存/提交操作 SHALL 可达

#### Scenario: Validate schedules and preserve provenance
- **WHEN** 用户提交定时或全天任务，之后交接、改排期或重开
- **THEN** 系统 SHALL 保存相应时间/日期并拒绝倒置范围，详情只读展示不变的原创建者和创建时间

#### Scenario: Search, clear or reject a parent relation
- **WHEN** 用户搜索父任务、清空或尝试关联自身/任意深度循环/无权任务
- **THEN** 搜索 SHALL 仅返回名称匹配的授权无环候选并提供空状态，清空 SHALL 去除关联，非法关联 SHALL 被拒绝且不可经其详情扩权

#### Scenario: Keep parents independently executable
- **WHEN** 子任务完成或用户打开父子详情
- **THEN** 父任务 SHALL 保持自身状态，可显示有权子任务状态数量但无百分比，任何父/子详情 SHALL 独立授权

#### Scenario: Create a timed task
- **WHEN** 用户提交定时或全天任务，之后交接、改排期或重开
- **THEN** 系统 SHALL 保存相应时间/日期并拒绝倒置范围，详情只读展示不变的原创建者和创建时间

#### Scenario: Create an all-day task
- **WHEN** 用户提交定时或全天任务，之后交接、改排期或重开
- **THEN** 系统 SHALL 保存相应时间/日期并拒绝倒置范围，详情只读展示不变的原创建者和创建时间

#### Scenario: Reject an inverted task range
- **WHEN** 用户提交定时或全天任务，之后交接、改排期或重开
- **THEN** 系统 SHALL 保存相应时间/日期并拒绝倒置范围，详情只读展示不变的原创建者和创建时间

#### Scenario: Preserve task creation time
- **WHEN** 用户提交定时或全天任务，之后交接、改排期或重开
- **THEN** 系统 SHALL 保存相应时间/日期并拒绝倒置范围，详情只读展示不变的原创建者和创建时间

#### Scenario: Search and select a parent task
- **WHEN** 用户搜索父任务、清空或尝试关联自身/任意深度循环/无权任务
- **THEN** 搜索 SHALL 仅返回名称匹配的授权无环候选并提供空状态，清空 SHALL 去除关联，非法关联 SHALL 被拒绝且不可经其详情扩权

#### Scenario: Show no matching parent tasks
- **WHEN** 用户搜索父任务、清空或尝试关联自身/任意深度循环/无权任务
- **THEN** 搜索 SHALL 仅返回名称匹配的授权无环候选并提供空状态，清空 SHALL 去除关联，非法关联 SHALL 被拒绝且不可经其详情扩权

#### Scenario: Inspect a child task
- **WHEN** 子任务完成或用户打开父子详情
- **THEN** 父任务 SHALL 保持自身状态，可显示有权子任务状态数量但无百分比，任何父/子详情 SHALL 独立授权

#### Scenario: Inspect a parent task
- **WHEN** 子任务完成或用户打开父子详情
- **THEN** 父任务 SHALL 保持自身状态，可显示有权子任务状态数量但无百分比，任何父/子详情 SHALL 独立授权

#### Scenario: Inspect an abstract task
- **WHEN** 用户检查任务创建及旧样例
- **THEN** 系统 SHALL 不提供抽象任务类型，旧样例如保留 SHALL 是普通独立可执行任务

### Requirement: Task editing and completion review
仅原创建者 SHALL 可申请修改基础信息及重开已完成任务；当前负责人仅可申请每次新增/修改文字进展与完成；专用交接仅依交接要求开放。有审核人的创建、修改、每次进展、完成、重开及交接 SHALL 先待审，同任务唯一待审并冻结其他业务操作，只有申请人能撤销；修改提议须先撤销再重提。普通区域 SHALL 保留原有效版本，申请人可看自己提交的内容/状态/结果，只有本次审核人可获得原版与提议的专用 diff，不能靠前端隐藏代替字段裁剪。

执行状态 SHALL 为待开始/进行中/已完成，与待审/通过/拒绝或退回/撤销/失效分开。首次进展批准后待开始变进行中；完成通过变已完成、退回变进行中且须意见、撤销恢复提交前状态；创建者重开可一并提出完整有效排期，通过回到进行中并增加轮次，拒绝/撤销保留已完成。普通修改或进展拒绝/撤销 SHALL 保留原版；待审到期按失效要求保留提交前状态并解冻。

#### Scenario: Freeze and cancel an application
- **WHEN** 多名负责人同时提交进展/完成，或非申请人尝试撤销
- **THEN** 系统 SHALL 最多产生一个待审并冻结其他操作，只有申请人可撤销，原创建者或审核人 SHALL 不能替他撤销

#### Scenario: Restrict comparison data to the reviewer
- **WHEN** 申请人、审核人及普通任务查看者分别读取同一变更
- **THEN** 审核人 SHALL 可看逐项 diff，申请人仅看提交内容及结果而无专用原版对比字段，普通人 SHALL 只见旧有效版和冻结；兼任审核人的申请人 SHALL 按审核身份可看 diff

#### Scenario: Distinguish completion outcomes
- **WHEN** 负责人提交完成后分别发生通过、退回或撤销
- **THEN** 系统 SHALL 分别进入已完成、进行中或恢复提交前执行状态，退回 SHALL 要求意见，所有路径 SHALL 解除待审冻结并保留结果

#### Scenario: Reopen with a new schedule
- **WHEN** 原创建者对已完成任务提出重开及新排期并得到批准
- **THEN** 系统 SHALL 同时发布新排期、进入进行中及下一轮次；拒绝/撤销 SHALL 保持原完成状态；其他人 SHALL 无重开权

#### Scenario: Assignee updates progress
- **WHEN** 负责人每次新增或修改文字进展
- **THEN** 系统 SHALL 提审且待审冻结，有审核人不直接生效；首次批准才从待开始变进行中，负责人无基础字段修改权

#### Scenario: Show status without numeric progress
- **WHEN** 查看任务状态和进展
- **THEN** 系统 SHALL 展示独立执行/申请状态及文字备注，不提供百分比或进度条

#### Scenario: Creator approves completion
- **WHEN** 创建者尝试批准完成
- **THEN** 系统 SHALL 只允许本次指定审核人处理，创建者身份不自动授予审核权；指定审核人批准才完成

#### Scenario: Superior rejects completion
- **WHEN** 指定审核人填写意见退回完成申请
- **THEN** 系统 SHALL 进入进行中并保留意见，不能只因上层身份审核所有任务

### Requirement: Required notifications
系统 SHALL 由真实业务事件产生站内通知，覆盖审核提交/结果、创建生效、基础信息/紧急程度/进展/状态/完成/重开/交接生效、改派、临期、逾期及失效，不用静态样例代替。待创建及未发布结果 SHALL 仅向申请人和对应审核人；已发布任务申请提交 SHALL 只通知本次审核人，申请人可跟踪，不提前告知其他任务人员或提议负责人。已发布结果 SHALL 面向申请人、审核人及相关任务人员，生效通知 SHALL 向创建者与当前全体负责人；负责人变更还 SHALL 包含新增及被移除人。提醒 SHALL 向创建者与当前负责人。同次多字段更改 SHALL 一条消息汇总实际变化，保留任务标题、事件、时间及原申请绑定；同事件多身份去重且不排除本人。系统推送属于正式要求但本次延期，不得将站内投递声明为系统推送通过。

#### Scenario: Deliver the submission and result matrix
- **WHEN** 分别提交待创建和已发布修改申请并处理结果
- **THEN** 未发布 SHALL 仅申请人与审核人收到，已发布提交 SHALL 仅本次审核人收到且申请人可跟踪，通过后才通知适用任务人员；他人 SHALL 不获提议内容

#### Scenario: Summarize multiple changes and preserve removed recipients
- **WHEN** 一次批准修改标题、紧急程度和负责人
- **THEN** 同接收人 SHALL 只收到该事件一条含任务标题及实际变动摘要的消息，新旧负责人 SHALL 按事件矩阵接收，被移除人 SHALL 按历史例外查看

#### Scenario: Use actual events without synthetic urgency
- **WHEN** 任务从普通改为紧急或首次发布并产生通知
- **THEN** 系统 SHALL 使用真实标题及实际事件，不添加“临时紧急”类型/标题前缀，站内事件去重 SHALL 不遗漏自通知

#### Scenario: Inspect task change notification coverage
- **WHEN** 分别提交待创建和已发布修改申请并处理结果
- **THEN** 未发布 SHALL 仅申请人与审核人收到，已发布提交 SHALL 仅本次审核人收到且申请人可跟踪，通过后才通知适用任务人员；他人 SHALL 不获提议内容

#### Scenario: Notify on task creation
- **WHEN** 分别提交待创建和已发布修改申请并处理结果
- **THEN** 未发布 SHALL 仅申请人与审核人收到，已发布提交 SHALL 仅本次审核人收到且申请人可跟踪，通过后才通知适用任务人员；他人 SHALL 不获提议内容

#### Scenario: Surface due and emergency notices
- **WHEN** 比例节点到点或紧急程度更改生效
- **THEN** 系统 SHALL 发真实比例临期或实际紧急变更通知，不使用三天重复或临时紧急业务类别

#### Scenario: Notify people affected by assignment changes
- **WHEN** 一次批准修改标题、紧急程度和负责人
- **THEN** 同接收人 SHALL 只收到该事件一条含任务标题及实际变动摘要的消息，新旧负责人 SHALL 按事件矩阵接收，被移除人 SHALL 按历史例外查看

#### Scenario: Surface review and consultation requests
- **WHEN** 产生审核提交或结果
- **THEN** 系统 SHALL 按本次审核人与结果矩阵通知；请示回复按 V2 暂缓，不新增其样例或入口

#### Scenario: Represent urgent work without a synthetic title
- **WHEN** 任务从普通改为紧急或首次发布并产生通知
- **THEN** 系统 SHALL 使用真实标题及实际事件，不添加“临时紧急”类型/标题前缀，站内事件去重 SHALL 不遗漏自通知

### Requirement: Personal work logs
日志 SHALL 归属于作者，按公司时区每人每天唯一，当天可反复修改；午夜及以后冻结，冻结后不得编辑、改日期、删除或重新创建旧日记录绕过。新建仅允许当天，已有今日记录 SHALL 打开编辑。日志可选关联一项作者当前有权正常查看的任务，支持名称搜索、无结果和清空；日志权限与关联任务分别检查，不因参与同任务取得他人日志权。上层可看公司，中层仅本人及直属下属，下层仅本人；上级读取 SHALL 只读，关联任务失权 SHALL 裁剪跳转但保留有权日志正文。

日志新建和编辑 SHALL 使用占满可用容器的全屏弹层，正文区伸展；保存、返回、关闭及关联任务操作 SHALL 可用，退出或切换其他弹层后 SHALL 恢复相应布局与页脚。

#### Scenario: Write and edit a log in a full-screen sheet
- **WHEN** 作者打开新建或编辑日志，关联/清空任务后保存，或返回其他弹层
- **THEN** 日志表单 SHALL 占满可用容器且正文可编辑，保存和关闭入口 SHALL 可达，返回后的非全屏弹层 SHALL 不残留全屏样式或错误页脚状态

#### Scenario: Enforce one log under concurrent distinct keys
- **WHEN** 同一作者同一公司自然日使用不同幂等键并发创建
- **THEN** 系统 SHALL 仅有一篇持久化日志，重复请求 SHALL 返回已有记录指引或明确冲突，不新增第二篇

#### Scenario: Freeze across the midnight boundary
- **WHEN** 日志日期当晚午夜到来，作者尝试改正文/日期、删除或补建该日记录
- **THEN** 读取 SHALL 标为冻结且所有绕过请求 SHALL 拒绝，不采信客户端时区/日期；午夜前合法当日编辑 SHALL 可用

#### Scenario: Link, clear or redact tasks independently
- **WHEN** 作者搜索关联任务、选择无关联，或读者可见日志但无其任务权限
- **THEN** 系统 SHALL 仅搜索正常可见任务并提供无匹配状态，允许无关联；读者 SHALL 可读有权正文但看不到无权任务跳转或明细

#### Scenario: Search and link a visible task
- **WHEN** 作者搜索关联任务、选择无关联，或读者可见日志但无其任务权限
- **THEN** 系统 SHALL 仅搜索正常可见任务并提供无匹配状态，允许无关联；读者 SHALL 可读有权正文但看不到无权任务跳转或明细

#### Scenario: Clear a linked task
- **WHEN** 作者搜索关联任务、选择无关联，或读者可见日志但无其任务权限
- **THEN** 系统 SHALL 仅搜索正常可见任务并提供无匹配状态，允许无关联；读者 SHALL 可读有权正文但看不到无权任务跳转或明细

#### Scenario: Show no matching linked tasks
- **WHEN** 作者搜索关联任务、选择无关联，或读者可见日志但无其任务权限
- **THEN** 系统 SHALL 仅搜索正常可见任务并提供无匹配状态，允许无关联；读者 SHALL 可读有权正文但看不到无权任务跳转或明细

#### Scenario: Write an unlinked log
- **WHEN** 作者当天填写日志而不关联任务
- **THEN** 系统 SHALL 保存唯一当日个人日志，不强制任务关联

#### Scenario: Superior reads a subordinate log
- **WHEN** 中层读取直属下属日志
- **THEN** 系统 SHALL 允许只读，不用同部门/团队代替直属关系，关联任务仍独立鉴权

### Requirement: Log page single-content filtering and scroll return
日志页 SHALL 只承担写日志和查看历史，进入及切换账号后默认本人；人员筛选 SHALL 结合权限过滤后的组织树与姓名包含搜索，保留当前输入并在明确变更时更新，不因重绘清空。上层可查公司，中层仅本人及直属下属，下层仅本人，不得混入任务创建、审核、申请或请示入口。内容离开顶部 SHALL 可一键回顶且保留筛选。

#### Scenario: Enter with self and filter a direct report
- **WHEN** 上层/中层首次进入日志，再选择组织树人员并搜索姓名
- **THEN** 默认 SHALL 仅本人，搜索及树 SHALL 同时受日志权限过滤，空结果明确提示并保留输入，选择人员 SHALL 不授予编辑权

#### Scenario: Return to the top without mixing workflows
- **WHEN** 用户滚动后回顶或寻找任务申请/审核
- **THEN** 回顶 SHALL 保留筛选，任务申请 SHALL 位于视图，审核 SHALL 位于通知，日志中 SHALL 无对应混合标签

#### Scenario: Enter the log page
- **WHEN** 上层/中层首次进入日志，再选择组织树人员并搜索姓名
- **THEN** 默认 SHALL 仅本人，搜索及树 SHALL 同时受日志权限过滤，空结果明确提示并保留输入，选择人员 SHALL 不授予编辑权

#### Scenario: Select pending reviews
- **WHEN** 用户寻找待我审核事项
- **THEN** 系统 SHALL 从通知中心提供审核，日志 SHALL 无待我审核混合标签

#### Scenario: Switch between role-specific content filters
- **WHEN** 上层/中层首次进入日志，再选择组织树人员并搜索姓名
- **THEN** 默认 SHALL 仅本人，搜索及树 SHALL 同时受日志权限过滤，空结果明确提示并保留输入，选择人员 SHALL 不授予编辑权

#### Scenario: Invoke a log-page command
- **WHEN** 用户在日志页选择写日志
- **THEN** 系统 SHALL 打开今日已有编辑或创建唯一当日记录，不提供任务创建/申请/审核/请示命令

#### Scenario: Toggle own logs
- **WHEN** 上层/中层首次进入日志，再选择组织树人员并搜索姓名
- **THEN** 默认 SHALL 仅本人，搜索及树 SHALL 同时受日志权限过滤，空结果明确提示并保留输入，选择人员 SHALL 不授予编辑权

#### Scenario: Restore the visible log scope
- **WHEN** 上层/中层首次进入日志，再选择组织树人员并搜索姓名
- **THEN** 默认 SHALL 仅本人，搜索及树 SHALL 同时受日志权限过滤，空结果明确提示并保留输入，选择人员 SHALL 不授予编辑权

#### Scenario: Search logs by author
- **WHEN** 上层/中层首次进入日志，再选择组织树人员并搜索姓名
- **THEN** 默认 SHALL 仅本人，搜索及树 SHALL 同时受日志权限过滤，空结果明确提示并保留输入，选择人员 SHALL 不授予编辑权

#### Scenario: Show no matching authors
- **WHEN** 上层/中层首次进入日志，再选择组织树人员并搜索姓名
- **THEN** 默认 SHALL 仅本人，搜索及树 SHALL 同时受日志权限过滤，空结果明确提示并保留输入，选择人员 SHALL 不授予编辑权

#### Scenario: Keep log finding separate and scoped
- **WHEN** 用户滚动后回顶或寻找任务申请/审核
- **THEN** 回顶 SHALL 保留筛选，任务申请 SHALL 位于视图，审核 SHALL 位于通知，日志中 SHALL 无对应混合标签

#### Scenario: Return to the top of log content
- **WHEN** 用户滚动后回顶或寻找任务申请/审核
- **THEN** 回顶 SHALL 保留筛选，任务申请 SHALL 位于视图，审核 SHALL 位于通知，日志中 SHALL 无对应混合标签

### Requirement: Role-scoped AI map
AI 地图 SHALL 使用当前权限内的真实任务统计、关键词词云和规则建议。上层公司统计/词云/建议，中层部门统计/词云但个人建议，下层本人统计/词云/建议；管理员无默认业务分析权。统计 SHALL 包含任务总数、执行状态、独立待完成审核、逾期未完成及四档紧急程度分布，排除待创建及历史例外。词云 SHALL 从该范围任务标题/说明实际提取，不能固定词表或默认读取私人日志；建议 SHALL 包括与比例临期一致的临期/逾期、排期冲突及高紧急任务，进入或主动刷新 SHALL 更新并标明范围、方法和时间。明细及旧分析读取 SHALL 再检查当前权限。

#### Scenario: Generate personal and department results separately
- **WHEN** 中层进入或刷新 AI 地图，员工查看同页
- **THEN** 中层 SHALL 得到部门统计/词云与个人建议，员工 SHALL 仅本人数据；均展示真实范围、生成方法及更新时间

#### Scenario: Extract new words and required metrics
- **WHEN** 权限内任务标题出现原固定字典不存在的中文文本，并有待完成、已完成、逾期及不同紧急程度任务
- **THEN** 词云 SHALL 反映真实文本，统计 SHALL 分开待完成与已完成，已完成不算逾期，并展示四档紧急程度分布，日志 SHALL 不作为默认来源

#### Scenario: Refresh suggestions and deny stale details
- **WHEN** 临期/冲突/高紧急任务变化或来源任务授权撤销
- **THEN** 进入或刷新 SHALL 重算相应规则，旧结果明细 SHALL 不泄露撤权任务，历史通知例外 SHALL 不加入分析

#### Scenario: View employee AI map
- **WHEN** 下层进入 AI 地图
- **THEN** 系统 SHALL 使用本人统计、本人词云与个人建议，不再提供部门聚合词云

#### Scenario: View executive AI map
- **WHEN** 上层进入 AI 地图
- **THEN** 系统 SHALL 从当前公司授权真实任务生成统计、词云及公司建议并标明范围/方法/时间

### Requirement: Minimal profile page
“我的” SHALL 展示本人公司、姓名、部门、职位、独立团队、直属上级和手机号，并提供编辑本人姓名/邮箱/手机号、修改密码、退出。组织及授权字段 SHALL 只能通过管理流程维护。管理层下属资料入口 SHALL 取当前资料可见人员与实际管理链下属的交集，可包含权限内间接下属，不扩大资料范围或开放公司通讯录、资料卡派发按钮。人员详情 SHALL 按账户与联系方式规则独立检查手机号权限。日志 SHALL 继续独立鉴权，中层仅本人及直属下属，上层公司日志仍从日志页查找。

#### Scenario: Read and edit the required profile
- **WHEN** 本人打开“我的”并修改联系方式
- **THEN** 系统 SHALL 显示独立公司/部门/职位/团队字段并保存允许的本人字段，组织/权限修改 SHALL 被拒绝，改密及退出 SHALL 可用

#### Scenario: Open a subordinate within both profile scope and the management chain
- **WHEN** 管理层从“我的”查看直属或间接下属资料和日志
- **THEN** 列表 SHALL 仅含当前资料权限与实际管理链同时允许的下属；详情 SHALL 重新检查资料权和手机号权，不提供派发按钮；间接下属资料可见 SHALL 不授予日志权，非管理链人员 SHALL 不出现在该入口

#### Scenario: View profile
- **WHEN** 本人打开“我的”并修改联系方式
- **THEN** 系统 SHALL 显示独立公司/部门/职位/团队字段并保存允许的本人字段，组织/权限修改 SHALL 被拒绝，改密及退出 SHALL 可用

### Requirement: Strict prototype scope
交付系统 SHALL 以 V2 正式版第 1—7 章及本次确认作为业务基线，实际服务入口 SHALL 使用真实认证、后端持久化及事件调度，不再以静态示例或直接打开文件替代验收。五页、管理端、名称搜索、个人置顶、审核申请、冲突建议与账户维护 SHALL 按本规格提供；请示回复、完整账号启停、一人多团队、任务私人草稿、任务取消、公司草稿/定时发布、日志转待办、外部模型与 MBTI SHALL 不纳入本轮。DEV-029 系统推送和 A-25 真机专项验收经用户授权延期，浏览器证据 SHALL 不冒充真机或全量正式验收。

#### Scenario: Validate the real service and declared scope
- **WHEN** 检查交付页面、API、测试与修复记录
- **THEN** 已纳入功能 SHALL 通过实际服务验证，不以演示数据或旧规则断言作为通过依据；延期推送和真机项 SHALL 单独标注且不计已修复

#### Scenario: Inspect available actions
- **WHEN** 检查交付页面、API、测试与修复记录
- **THEN** 已纳入功能 SHALL 通过实际服务验证，不以演示数据或旧规则断言作为通过依据；延期推送和真机项 SHALL 单独标注且不计已修复

#### Scenario: Open the split static prototype
- **WHEN** 从文件系统直接打开无后端会话的旧 HTML
- **THEN** 系统 SHALL 不将该方式作为业务验收通过；正式链路 SHALL 通过构建服务、真实认证、持久化及事件验证

## REMOVED Requirements

### Requirement: Manager consultation
**Reason**: V2 正式版 1.2 明确暂缓请示与回复，旧要求与本轮基线冲突。
**Migration**: 移除 App 中请示/回复入口及代表性通知要求，不删除留存历史；日志专用于日志，任务申请和审核分别迁移到视图与通知。

## ADDED Requirements

### Requirement: Organization and administration
系统 SHALL 提供真实管理端维护员工、部门、职位、团队、上下级、角色及分别配置的任务查看/派发权限，并查询全量任务操作历史、管理通知。员工部门和职位必填，一人一个主部门、至多一个团队、一位直属上级，组织顶层除外。部门与团队独立；获授权的部门负责人可创建团队，创建者默认负责且可转交。组织关系 SHALL 无环且不跨公司引用，组织位置不得由职位名称或负责人保存顺序推断。公司仅有一个管理员账号，管理员身份不自动取得员工派发、审核、日志或分析权。

#### Scenario: Maintain an employee through the administrator interface
- **WHEN** 管理员新增员工并设置部门、职位、团队、上级和授权
- **THEN** 系统 SHALL 持久化并在重新登录后展示对应资料与能力；缺部门/职位、第二管理员、跨组织引用或管理关系环 SHALL 被拒绝

#### Scenario: Maintain teams independently of departments
- **WHEN** 获授权的部门负责人在同部门创建两个团队并转交其中一个团队负责人
- **THEN** 系统 SHALL 保存独立团队及负责人，员工只归属至多一个团队，团队负责人身份 SHALL NOT 自动扩展业务权限

#### Scenario: Transfer updates independent scopes
- **WHEN** 管理员通过转岗流程更改员工部门、团队、上级或授权
- **THEN** 资料、任务范围、派发候选与日志范围 SHALL 按各自规则重新计算，旧页面及旧幂等请求 SHALL NOT 绕过新权限

#### Scenario: Maintain and reorder company information
- **WHEN** 管理员增改删公司信息或调整展示顺序
- **THEN** App SHALL 只读展示管理顺序，默认按创建时间排序；并发新增也 SHALL NOT 超过十条，业务账号的维护请求 SHALL 被拒绝

### Requirement: Account password lifecycle
账号 SHALL 由管理员手动创建，沿用用户名登录，不开放自助注册。系统 SHALL 生成随机初始密码并强制首次改密；管理员重置密码 SHALL 再次强制改密。新密码 SHALL 至少 10 个字符、含字母与数字且 UTF-8 长度不超过 72 字节。强制改密会话 SHALL 仅可办理本人改密及退出，不能读取或修改业务数据；日常改密 SHALL 校验旧密码，成功后撤销包括当前会话在内的全部会话并要求重新登录。管理员 SHALL 可录入/覆盖员工手机号，但不得通过管理响应、目录或审计回显他人手机号；本人继续可编辑姓名、邮箱、手机号。

按 2026-10-19 调整，手机号 SHALL 仅本人及实际管理链上的上级可见；他人读取 SHALL 同时满足当前资料查看权、同组织有效人员关系及更高组织层级，且仅通过鉴权人员详情返回。邮箱 SHALL 仍仅本人可见。同级、下属、其他管理链、仅有管理员身份或仅有公司/部门资料范围 SHALL 不因此取得手机号权。目录、任务人员摘要、日志筛选、通知、分析、审计、outbox 及普通人员缓存 SHALL 不含号码；历史通知只读例外 SHALL 不授予手机号权。

#### Scenario: Initial login cannot enter business pages
- **WHEN** 新员工用生成的初始密码登录并尝试直接访问业务接口
- **THEN** 系统 SHALL 提示必须改密并拒绝业务访问，改密成功后旧会话失效，使用新密码重新登录后方可进入

#### Scenario: Password validation and reset
- **WHEN** 本人提交错误旧密码、少于 10 字符、缺字母/数字或超过 72 UTF-8 字节的新密码
- **THEN** 系统 SHALL 拒绝修改；管理员重置后 SHALL 生成新初始密码、撤销旧会话并恢复首次改密门禁

#### Scenario: Edit contacts without exposing another employee phone
- **WHEN** 管理员录入员工号码或其他用户读取目录、人员摘要、日志筛选、通知及分析
- **THEN** 系统 SHALL 允许授权的写入并仅回执成功状态，上述读取结果 SHALL 不含号码；本人资料接口 SHALL 可读取及编辑自己的姓名、邮箱、手机号

#### Scenario: Read phones only through authorized person details
- **WHEN** 本人、直属上级、间接上级、同级、下属、其他管理链上级及管理员读取人员详情
- **THEN** 本人 SHALL 可读自己的手机号；直属或间接上级 SHALL 仅在具有当前资料权且组织层级更高时可读下属号码；其余人 SHALL 不获得号码，资料权不足 SHALL 拒绝整个详情，任何他人详情 SHALL 不返回邮箱

#### Scenario: Recheck the management chain after an organization change
- **WHEN** 员工转岗、管理关系变化、链上中间账号失效，或管理链出现环/跨公司引用
- **THEN** 后续人员详情请求 SHALL 按当前有效关系鉴权，旧上级及无法证明有效上级关系者 SHALL 不再获得号码；旧页面或缓存 SHALL 不构成继续读取的凭据

### Requirement: Ordered reviewer routing and reassignment
系统 SHALL 从有序负责人中选组织位置最高层，同层取保存顺序第一位作为依据人，并沿其唯一管理链寻找有效直属上级；不可承接者继续上溯。无可用上级时以可承接的原创建者兜底，确实无审核人时记录原因直接生效；组织循环等损坏数据 SHALL 阻断，不得解释为免审。有审核人 SHALL 一律产生待审，即使申请人、创建者及审核人相同。创建、负责人变更及交接 SHALL 按提议负责人计算，其余申请按有效负责人计算。提交前及详情 SHALL 展示实际审核人；组织变化引发的改派 SHALL 可追溯，旧审核人失去决定权并更新通知。

#### Scenario: Persist order and route the first highest peer
- **WHEN** 两名同级最高负责人分属不同管理链，保存后交换其顺序
- **THEN** 回读顺序 SHALL 与提交一致，本次审核人 SHALL 分别沿交换前后首位最高者的管理链计算；较低层人员排在首位 SHALL 不越过最高组织层级

#### Scenario: Review one's own application explicitly
- **WHEN** 申请人恰为审核人，提交创建、修改、进展、完成或重开
- **THEN** 系统 SHALL 产生唯一待审，直到本人在审核入口明确决定才生效

#### Scenario: Change assignees using the proposed route
- **WHEN** 当前负责人属于甲链，提议负责人属于乙链
- **THEN** 预览、提交、详情、通知与决定 SHALL 一致指定乙链审核人；甲链审核人不得批准；拒绝、撤销或失效 SHALL 保持原负责人及其路线

#### Scenario: Fall back or apply with a documented reason
- **WHEN** 依据人管理链无有效审核人
- **THEN** 可承接的原创建者 SHALL 成为审核人并须显式审核；原创建者也不可承接时 SHALL 留存无需审核原因后直接生效；组织关系损坏 SHALL 返回可识别错误

#### Scenario: Reassign after organization changes
- **WHEN** 待审审核人离职、调岗或不可承接
- **THEN** 系统 SHALL 按同一依据链继续上溯，记录前后审核人、原因和时间，更新对应审核通知；原页面 SHALL 不能使用旧权限决定

### Requirement: Dedicated task handover
本人或其直属领导 SHALL 可预设交接对象并为其当前负责的任务发起专用交接申请；该权限 SHALL 仅改变负责人及其有序列表，不得用于修改任意基础字段。交接 SHALL 按新负责人路由，审核通过后生效，保留原创建者、创建时间、交接来源和全部历史。

#### Scenario: A direct manager hands over a subordinate task
- **WHEN** 非原创建者的直属领导为下属的有效任务提交交接
- **THEN** 系统 SHALL 接受负责人交接并交给新路线审核，夹带标题、排期等字段 SHALL 被拒绝；非直属领导 SHALL 无此专用权限

#### Scenario: Handover approval preserves provenance
- **WHEN** 新路线审核人批准交接
- **THEN** 系统 SHALL 切换负责人及权限并通知新旧相关人员，原创建者、创建时间及交接来源 SHALL 保留；未通过时 SHALL 保持原有效版本

### Requirement: Deadline expiration of pending applications
系统 SHALL 在提交、决定及定时扫描入口检查适用截止。创建及含排期变更的修改/重开使用提议截止，其他申请使用有效截止；服务端当前时刻达到或超过适用截止 SHALL 不再允许旧申请生效，也不得提交已到期排期。待审跨截止 SHALL 原子地变为已失效、解除冻结、保留原有效内容及提交前状态；未发布任务仍不发布，已完成任务的重开失效仍保持已完成。失效 SHALL 通知申请人与审核人调整后重提；已生效且未完成任务解冻时若超过有效截止 SHALL 补一次逾期提醒。失效、人工决定、撤销与重试 SHALL 只能产生一个终态。

#### Scenario: Reject expired submission and approval before the scan
- **WHEN** 用户提交已到期排期，或在截止后、扫描前批准待审
- **THEN** 系统 SHALL 拒绝过期提交，旧待审 SHALL 失效且不能批准；该终态和解冻 SHALL 持久化，不因错误响应回滚

#### Scenario: Use the applicable deadline and preserve the effective version
- **WHEN** 修改/重开提议更晚截止，或无排期变更的进展申请跨过有效截止
- **THEN** 系统 SHALL 分别使用提议/有效截止，不以原来更早截止提前使改期申请失效；失效 SHALL 不发布提议，保留原版及状态

#### Scenario: Expire and backfill overdue once
- **WHEN** 已发布未完成任务的申请失效且原有效任务已逾期，随后扫描重复执行
- **THEN** 系统 SHALL 分别留存失效与逾期事件，逾期每轮次/排期仅一次；未发布创建 SHALL 仅有失效及重提通知

#### Scenario: Resolve the deadline race once
- **WHEN** 批准、撤销与截止扫描并发处理同一待审
- **THEN** 系统 SHALL 按事务实际检查的服务端时刻只提交一个终态，截止后批准 SHALL 永不生效，旧页面和同键重试 SHALL 不再次改变业务

### Requirement: Proportional schedule reminders
系统 SHALL 按公司时区的计划开始 S、截止 D 和自然经过总工期 T=D-S，在剩余 20%、10%、5% 时各提醒一次，逾期一次；T=0 不发比例提醒，D<S 拒绝。全天开始为开始日 00:00，截止为公司可配置下班时刻，默认 18:00，日历仍含完整首尾日期。完成或待审期间 SHALL 不发常规提醒；生效较晚、解冻或晚扫描跨多个节点 SHALL 只补最近一个已到节点并跳过更早节点，后续节点正常发送；逾期只按逾期处理。去重 SHALL 区分任务、接收人、执行轮次和生效排期，改变开始或截止、全天语义及重开 SHALL 重新计算。公司下班时刻设置 SHALL 用于之后的新排期或排期修订，既有/在审排期沿用提交时快照，设置页 SHALL 明示该生效范围。

#### Scenario: Remind a ten hour task
- **WHEN** 09:00—19:00 的任务持续有效、未完成且无待审
- **THEN** 系统 SHALL 分别在 17:00、18:00、18:30 到点后通知创建者和当前负责人各一次，不在剩余 90% 时发临期提醒

#### Scenario: Skip stale nodes after a late scan
- **WHEN** 首次扫描该十小时任务发生于 18:10，随后 18:20 再扫描并于 18:30 扫描
- **THEN** 系统 SHALL 只补 10% 节点，不在第二次补 20%，并于 18:30 发送 5% 节点

#### Scenario: Reset the schedule identity and handle zero duration
- **WHEN** 仅开始时间调整生效、重开生效，或任务起止相等
- **THEN** 新轮次/排期 SHALL 独立去重；零工期 SHALL 仅在超过截止且未完成时发一次逾期；全天截止配置 SHALL 生效并保持日历完整日期

### Requirement: Notification lifecycle and historical access
通知 SHALL 绑定自己的事件、任务及原申请，打开即已读并同步未读数；原申请办结 SHALL 置灰展示其结果且无有效审核按钮，不得转向同任务后续申请。本人删除仅影响本人副本。通知 SHALL 自事件产生时刻起保留三个公司时区日历月，月末截到目标月最后一天，到期时不再可用。业务发起人及有通知管理权的管理员 SHALL 仅在事件产生后严格少于 180 秒时撤回，自动提醒仅管理员可管理；撤回保留提示但移除正文与跳转，不改变业务、申请或审计。

已送达、未删除、未撤回且未到期通知的原接收人，在失去当前任务权限后 SHALL 仍可读取保留标题/摘要并从该通知进入当前已生效任务的专用只读详情，展示关系/授权撤销提示。此例外 SHALL 不开放提议、diff、受限关联、手机号、他人日志或任何业务操作，不加入正常列表、搜索、计数、首页或分析。未送达消息 SHALL 不因候选接收人记录而授予例外。

通知列表 SHALL 不显示底部刷新/关闭操作栏，并保留头部关闭入口；键盘 Tab 焦点范围 SHALL 包含头部关闭按钮，空列表也 SHALL 可关闭。此列表布局 SHALL 不改变消息详情的业务操作及自动已读要求。

#### Scenario: Close a notification list without footer actions
- **WHEN** 用户打开有消息或空状态的通知列表，并用鼠标或键盘退出
- **THEN** 列表 SHALL 无底部刷新/关闭按钮且无空白操作栏，头部关闭按钮 SHALL 可聚焦及触发，之后其他弹层的页脚 SHALL 正常恢复

#### Scenario: Open an old review notification
- **WHEN** 原申请已完成而同任务产生新的待审，用户打开原消息
- **THEN** 消息 SHALL 标为已读、未读数减少，展示原申请结果并置灰，不能借旧消息办理新申请

#### Scenario: Enforce withdrawal and calendar month boundaries
- **WHEN** 发起人在 179.999 秒或 180 秒撤回，或接收人访问已过三个月期限的消息
- **THEN** 前者 SHALL 可撤回，180 秒及以后 SHALL 拒绝；10 月 31 日产生的消息 SHALL 于次年 1 月 31 日同一公司本地时刻到期，1 月 31 日加三个月 SHALL 截到 4 月 30 日

#### Scenario: Distinguish hide and withdraw
- **WHEN** 接收人删除自己的副本，或发起人在时限内撤回该事件通知
- **THEN** 删除 SHALL 不影响他人副本；撤回 SHALL 对所有副本移除正文和跳转并保留提示；两者 SHALL 不修改任务结果、申请状态及管理历史

#### Scenario: Retain access solely through a delivered notification
- **WHEN** 原接收人被移出负责人/收回授权但仍保有送达消息
- **THEN** 消息标题及实际变更摘要 SHALL 保留，专用入口 SHALL 仅展示有效任务且提示只读；普通详情及所有当前范围查询 SHALL 继续拒绝或排除该任务

#### Scenario: End the exception and block undelivered access
- **WHEN** 消息被个人删除、全事件撤回或到期，或普通事件的任务授权在通知送达前已被撤销
- **THEN** 系统 SHALL 拒绝通过该消息取得历史详情，不因知晓消息/任务/事件 ID 扩权，也不阻止拥有正常权限者从正常入口查看

### Requirement: Complete task operation history
管理端 SHALL 可按任务追溯具体字段前后值、有序负责人变化、申请/版本、申请人与审核人、决定意见、改派、失效、交接、完成、重开和无需审核原因。App SHALL 仅展示当前有效资料、有效进展、相关申请及审核意见，不开放完整历史。通知删除/撤回/清理 SHALL 不删除业务历史，历史 SHALL 不包含密码或他人手机号。

#### Scenario: Inspect an ordered assignee change and reassignment
- **WHEN** 管理员查询一个发生负责人换序、改派、失效和交接的任务
- **THEN** 系统 SHALL 展示每次实际变动、前后人选、时间、原因及结果，而非仅事件类型和 ID；App 用户 SHALL 不能查询完整历史

#### Scenario: Retain history after message removal
- **WHEN** 关联消息删除、撤回或到期清理
- **THEN** 全部任务操作记录 SHALL 继续可查，已生效状态 SHALL 保持
