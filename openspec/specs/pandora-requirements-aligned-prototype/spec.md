# pandora-requirements-aligned-prototype Specification

## Purpose

本规格用于约束潘多拉移动端交互原型只呈现需求文档定义的任务协作、工作日志、分级权限与统计信息，并以可操作的示例流程验证关键业务规则。

## Requirements

### Requirement: Five-page navigation
原型 SHALL 提供且仅提供“导图”“视图”“日志”“AI地图”“我的”五个业务页面，并允许用户通过固定导航在五页之间切换且保持当前演示身份。

#### Scenario: Navigate across the prototype
- **WHEN** 用户依次点击五个导航项
- **THEN** 原型 SHALL 展示对应页面，并且导航中始终只有当前页面处于选中状态

### Requirement: Four-quadrant dashboard
导图页 SHALL 在应用头部与底部导航之间的可用高度内固定展示公司统一信息、本人被派发且尚未完成的前十项任务、最多十条个人信息以及本人今天和前一天的日志四个象限，导图页整体 SHALL NOT 纵向或横向滚动，每个象限的内容区 SHALL 独立纵向滚动，且页面 SHALL NOT 展示四象限之外的“说明”板块。被派发任务项 SHALL 完整展示其任务名称、状态、紧急程度、截止信息、进度和已有进度备注，不得裁切、遮挡或以单行省略隐藏这些信息。公司统一信息 SHALL 最多包含十条，并仅允许上层新增、编辑和删除；个人信息 SHALL 最多包含十条并允许本人新增、编辑和删除，在尚未发生人工修改时由本人的日志内容生成初始摘录；近期日志 SHALL 按时间倒序展示原始日志，从而与个人摘录形成明确差异。

#### Scenario: View the four dashboard quadrants
- **WHEN** 任一业务角色进入导图页
- **THEN** 页面 SHALL 在可用内容区内同时呈现四个语义清晰的象限，导图页整体不发生滚动，且底部不出现“说明”板块

#### Scenario: Scroll one dashboard quadrant
- **WHEN** 某一象限的内容超过该象限可用高度
- **THEN** 用户 SHALL 能仅滚动该象限的内容，其他象限、应用头部和底部导航保持原位

#### Scenario: Read an assigned task without clipping
- **WHEN** “我被派发未完成”象限展示包含较长名称、多个标签或进度备注的任务
- **THEN** 该任务格 SHALL 自适应内容高度并完整显示规定信息，且不得与相邻任务重叠

#### Scenario: Executive maintains company information
- **WHEN** 上层新增、编辑或删除一条公司统一信息
- **THEN** 原型 SHALL 更新所有身份可见的公司信息且总数不得超过十条，中层和下层 SHALL 不显示这些维护操作

#### Scenario: Reject company information above the limit
- **WHEN** 公司统一信息已有十条且上层尝试继续新增
- **THEN** 原型 SHALL 阻止新增并清楚提示十条上限

#### Scenario: Edit personal information
- **WHEN** 用户新增、编辑或删除本人的一条个人信息
- **THEN** 原型 SHALL 更新本人的个人信息且总数不得超过十条，并且不得改写任何原始日志

#### Scenario: Reject personal information above the limit
- **WHEN** 本人的个人信息已有十条且用户尝试继续新增
- **THEN** 原型 SHALL 阻止新增并清楚提示十条上限

### Requirement: Calendar task views
视图页 SHALL 提供无横向滚动的响应式月、周、日三种类甘特视图，并保留位于视图主体上方的当前时间范围、任务归属图例和排序说明板块。任务 SHALL 以从开始时间连续延伸至结束时间的条形呈现，在当前视图边界或紧凑状态下的月视图逐日容量边界处截断，并且任务条可见文本 SHALL 仅包含任务关系 emoji 标记和任务名称，不得显示任务描述、状态、截止日期或其他元数据；完整信息仍 SHALL 可从任务详情查看。任务的纵向排列 SHALL 先按时间跨度从长到短，其次按紧急程度从高到低，最后按截止日期从近到远。

视图页 SHALL 从低饱和色板按任务标识稳定分配填充色，在同屏可用颜色尚未耗尽时 SHALL 尽量不为不同任务重复用色，色板耗尽后 MAY 重复颜色。颜色 SHALL 仅用于区分不同任务，不得单独承担任务关系含义。每个任务条 SHALL 使用互斥的关系标记：当前用户是负责人时标记“我负责”，否则当前用户是创建者时标记“我分配”，两者皆非但任务可见时标记“仅可见”；三类关系 SHALL 分别使用带文字图例和无障碍名称的不同 emoji 前缀。

月视图 SHALL 为默认视图，并提供可直接选择年份和月份的选择器。月视图 SHALL 按完整自然周显示目标月所覆盖的全部日期，包括网格首尾属于相邻月份的日期及落在这些日期上的可见任务；相邻月份日期 SHALL 保持可读并与目标月日期有非颜色唯一的弱化差异。每个日期单元 SHALL 先显示独立、可操作的日期数字标题，其视觉高度约为一条任务行的 1.5 倍。紧凑状态下，标题下方 SHALL 提供五条等高任务行；某日期最多有五项任务时 SHALL 显示排序最靠前的至多五项，超过五项时 SHALL 在前四行显示任务，并在第五行显示可操作的 `+N`，其中 N 为该日期未直接显示的任务数。跨日任务在连续可展示日期上 SHALL 保持连续条形，在紧凑状态下因逐日容量溢出而隐藏的日期边界处 MAY 分段。

视图工具栏 SHALL 在月、周、日视图中统一提供“完全展开”与“收起”切换按钮，并清晰表达当前展开状态。本次会话初始 SHALL 为紧凑状态，月视图 SHALL 遵循五行及拥挤时四项加 `+N` 的规则，周视图 SHALL 最多直接展示四项任务，日视图 SHALL 最多直接展示六项任务。完全展开时，三种视图 SHALL 直接展示与当前时间范围相交且当前身份有权查看的全部任务，不得因数量上限截断或以 `+N` 聚合替代；月视图每个自然周块 SHALL 按实际任务需要增加等高任务行，周、日视图 SHALL 按任务数量增加内容高度，并允许纵向滚动查看全部内容。完全展开 SHALL NOT 改变任务权限、时间范围、排序、颜色、关系标记、任务条文本规则或任务详情行为；跨视图边界的任务仍 SHALL 只绘制与当前范围相交的部分。展开选择 SHALL 在本次会话的日期或月份切换、月周日粒度切换及离开视图页后返回时保留；点击“收起” SHALL 恢复当前视图的紧凑展示规则，且不改变当前日期范围。

月视图每个自然周块 SHALL 额外提供一条横跨该周七天的独立“查看本周”入口行，该行 SHALL NOT 占用日期标题下方的任务行，包括紧凑状态下的五行和完全展开时按需增加的任务行。用户点击该入口行 SHALL 进入对应自然周的周视图；点击任一日期标题 SHALL 直接进入对应日期的日视图，包括网格首尾属于相邻月份的日期。点击日期标题、周入口、任务条和 `+N` 之外的空白任务区域 SHALL NOT 切换视图。用户点击周视图某一天内不属于任务条或其他控件的区域 SHALL 进入对应日视图。周视图 SHALL 提供上一周、下一周和返回月视图操作；日视图 SHALL 提供前一天、后一天和返回周视图操作，即使用户从月视图直接进入日视图也 SHALL 保留逐级返回。点击任何视图中的任务条 SHALL 打开任务详情而不得触发视图下钻；点击月视图的 `+N` SHALL 仅打开对应日期的溢出任务列表。

#### Scenario: Open the default month view
- **WHEN** 用户进入视图页且尚未在本次会话中下钻
- **THEN** 原型 SHALL 展示当前月份覆盖的完整自然周网格及其上方说明板块，所有日期均带日期数字，且页面与视图主体均不存在横向滚动

#### Scenario: Select a year and month
- **WHEN** 用户打开年月选择器并选择目标年份和月份
- **THEN** 月视图 SHALL 直接切换到所选月份、更新范围标签，并展示该月网格包含的本月与相邻月份日期及任务

#### Scenario: Show a separate weekly entry row
- **WHEN** 月视图展示任一自然周块
- **THEN** 该周块 SHALL 包含横跨七天的独立“查看本周”入口行，且该入口 SHALL NOT 占用紧凑状态下的五条等高任务行或完全展开时按需增加的任务行

#### Scenario: Drill from month to week
- **WHEN** 用户点击月视图某个自然周块的“查看本周”入口行
- **THEN** 原型 SHALL 切换到该自然周的周视图，包括该周跨越相邻月份的情况

#### Scenario: Drill directly from month to day
- **WHEN** 用户点击月视图任一日期数字标题，包括相邻月份的日期
- **THEN** 原型 SHALL 直接切换到该日期的日视图，且日视图 SHALL 提供返回包含该日期的周视图操作

#### Scenario: Ignore blank month task space
- **WHEN** 用户点击月视图日期标题、周入口、任务条和 `+N` 之外的空白任务区域
- **THEN** 原型 SHALL 保持当前月视图且不打开其他内容

#### Scenario: Drill from week to day
- **WHEN** 用户点击周视图某一天内不属于任务条或其他控件的区域
- **THEN** 原型 SHALL 切换到该日期的日视图

#### Scenario: Switch time granularity
- **WHEN** 用户通过月视图的周入口或日期标题、周视图日期区域或逐级返回操作切换时间粒度
- **THEN** 原型 SHALL 按所选日期范围展示对应的月、周或日类甘特视图，且周、日视图包含时刻信息

#### Scenario: Keep task clicks distinct from drill-down
- **WHEN** 用户在月视图或周视图点击任务条
- **THEN** 原型 SHALL 打开该任务详情，且不得同时切换时间粒度

#### Scenario: Navigate and return from a week
- **WHEN** 用户在周视图选择上一周、下一周或返回月视图
- **THEN** 原型 SHALL 分别移动一个自然周或返回包含当前周锚点的月视图

#### Scenario: Navigate and return from a day
- **WHEN** 用户在日视图选择前一天、后一天或返回周视图
- **THEN** 原型 SHALL 分别移动一个自然日或返回包含当前日期的周视图

#### Scenario: Render a spanning task bar
- **WHEN** 可见任务的开始时间和结束时间与当前视图范围相交
- **THEN** 原型 SHALL 按可展示的相交范围绘制任务条、仅显示关系标记和可读任务名称，并将超出当前范围的部分截断；只有紧凑状态下 MAY 因月视图逐日容量截断任务条

#### Scenario: Distinguish visible tasks
- **WHEN** 当前视图显示多个不同任务且低饱和色板仍有未使用颜色
- **THEN** 原型 SHALL 为不同任务显示不同填充色，并在重新渲染同一任务时保持其颜色稳定

#### Scenario: Identify the current user's task relationship
- **WHEN** 当前视图同时包含本人负责、本人创建但不负责、以及仅因权限而可见的任务
- **THEN** 每个任务条 SHALL 分别显示“我负责”“我分配”或“仅可见”对应的 emoji，且图例与无障碍名称 SHALL 说明三者含义

#### Scenario: Show only task names in bars
- **WHEN** 任一任务条出现在月、周或日视图
- **THEN** 条内 SHALL NOT 显示任务描述或其他任务元数据，用户点击后 SHALL 能在详情中查看完整信息

#### Scenario: Order visible task lanes
- **WHEN** 当前时间范围内存在多个可见任务
- **THEN** 原型 SHALL 先展示时间跨度更长的任务，跨度相同时优先展示更紧急的任务，跨度和紧急程度均相同时优先展示截止日期更早的任务

#### Scenario: Fill five monthly task rows
- **WHEN** 紧凑状态下的月视图某日期包含五项或更少的可见任务
- **THEN** 该日期 SHALL 按规定顺序在日期标题下直接显示至多五项任务且不显示 `+N`

#### Scenario: Handle crowded time slots
- **WHEN** 紧凑状态下的月视图某日期包含六项或更多可见任务
- **THEN** 该日期 SHALL 在前四行显示排序最靠前的任务，并在第五行显示代表其余任务数量的可操作 `+N`

#### Scenario: Open overflow tasks for one date
- **WHEN** 用户点击某日期第五行的 `+N`
- **THEN** 原型 SHALL 展示该日期未直接显示且当前身份有权查看的任务列表，并允许从列表打开任务详情，且不得同时切换时间粒度

#### Scenario: Expand all monthly tasks
- **WHEN** 用户在月视图点击“完全展开”
- **THEN** 按钮 SHALL 切换为“收起”，每个自然周块 SHALL 按需增加任务行以直接展示全部可见任务，包括网格首尾相邻月份的任务，且不再显示 `+N` 聚合入口

#### Scenario: Expand all weekly and daily tasks
- **WHEN** 用户在周视图或日视图点击“完全展开”
- **THEN** 原型 SHALL 分别取消四项或六项的直接展示上限，展示与当前周或当前日相交的全部可见任务，且可通过纵向滚动访问超出屏幕高度的任务

#### Scenario: Keep expansion scoped and ordered
- **WHEN** 当前视图处于完全展开状态
- **THEN** 原型 SHALL 继续遵守当前身份的可见权限、时间范围、任务排序、稳定配色和关系标记规则，且点击任何新增显示的任务条 SHALL 打开其详情而不触发视图下钻

#### Scenario: Preserve expansion during navigation
- **WHEN** 用户完全展开后切换日期或月份、在月周日之间下钻或返回，或离开视图页后在同一会话内返回
- **THEN** 原型 SHALL 保持完全展开选择，并展示新日期范围或当前视图内的全部可见任务

#### Scenario: Restore compact display
- **WHEN** 用户在任一完全展开的视图中点击“收起”
- **THEN** 按钮 SHALL 恢复为“完全展开”，当前日期范围 SHALL 保持不变，月视图 SHALL 恢复五行及拥挤时四项加 `+N` 的规则，周视图 SHALL 恢复四项直接展示上限，日视图 SHALL 恢复六项直接展示上限

### Requirement: Role-scoped visibility
原型 SHALL 按角色限制业务数据：上层可查看全公司任务与日志；中层可查看本部门任务与日志；下层仅可查看本人负责的任务和本人日志。合法收到的历史通知快照 MAY 继续保留，但通知 SHALL NOT 授予关联对象的当前查看权限。管理员属于独立管理端角色，本次业务端原型 SHALL 不提供文档未定义的管理员操作。

#### Scenario: Compare role visibility
- **WHEN** 预览者通过原型外层身份控件分别选择上层、中层和下层示例身份
- **THEN** 五个业务页面中的任务、日志和汇总数据 SHALL 随角色切换到对应可见范围

#### Scenario: Prevent unauthorized detail access
- **WHEN** 当前身份尝试打开超出其可见范围的任务或日志
- **THEN** 原型 SHALL 不展示该记录的详情或修改入口

### Requirement: Role-scoped task creation and assignment
上层 SHALL 能给自己创建任务，并能向中层或下层派发任务；中层 SHALL 能向本部门下层派发任务，也能给自己创建任务；下层 SHALL 只能给自己创建任务。中层和下层的自建任务 SHALL 先进入待直属上级审核状态，审核通过后才成为执行中的任务；上层自建任务因没有更高审批角色而直接生效。

#### Scenario: Manager assigns a departmental task
- **WHEN** 中层创建任务并选择本部门下层为负责人
- **THEN** 任务 SHALL 直接发布给所选负责人，且不得出现其他部门或上层人员作为可选负责人

#### Scenario: Employee submits a self-created task
- **WHEN** 下层为自己提交任务
- **THEN** 任务 SHALL 进入待直属中层审核状态，并在审核前与已生效任务明确区分

#### Scenario: Superior reviews a self-created task
- **WHEN** 直属上级批准或拒绝一项自建任务
- **THEN** 批准时任务 SHALL 进入可执行状态，拒绝时 SHALL 保留拒绝结果且不进入执行任务列表

### Requirement: Task structure and attributes
每项普通任务 SHALL 展示名称、截止日期、紧急程度、完成情况、进度备注、创建者和一个或多个负责人。任务 SHALL 支持父子关系。抽象任务 SHALL 标明其不可直接执行，由一个或多个普通子任务组成，并通过子任务状态汇总进展而不提供直接更新进度或直接完成的操作。

#### Scenario: Inspect a child task
- **WHEN** 用户打开具有上级任务的普通任务
- **THEN** 详情 SHALL 展示其上级任务，并允许返回查看该上级任务及同级关系

#### Scenario: Inspect an abstract task
- **WHEN** 用户打开抽象任务
- **THEN** 详情 SHALL 展示其普通子任务与汇总进展，且不显示直接执行或直接完成入口

### Requirement: Task editing and completion review
任务创建者 SHALL 能修改任务信息。任务负责人 SHALL 只能更新进度备注和提交完成状态，不能修改任务定义字段。任一负责人提交完成后，任务 SHALL 进入待审核状态；派发任务由创建者审核，自建任务由直属上级审核。审核通过后任务才 SHALL 标记为已完成，审核退回后 SHALL 恢复为进行中。上层为自己创建且不存在审核人的任务提交完成后 SHALL 直接完成。

#### Scenario: Assignee updates progress
- **WHEN** 负责人保存进度和进度备注
- **THEN** 原型 SHALL 更新任务进展，但不得允许其改写名称、截止日期、紧急程度或负责人

#### Scenario: Creator approves completion
- **WHEN** 派发任务的任一负责人提交完成且创建者批准
- **THEN** 任务 SHALL 从待完成审核变为已完成

#### Scenario: Superior rejects completion
- **WHEN** 审核人退回完成申请
- **THEN** 任务 SHALL 恢复进行中并保留新的审核结果供负责人查看

### Requirement: Required notifications
原型 SHALL 为当前业务流程中成功生效的每次实际变动生成站内通知，包括任务、公司统一信息、个人信息、日志和请示的新增、修改、审核及已有删除操作，而不得只覆盖任务创建或紧急事件。通知 SHALL 仅发送给按下述规则确定的相关人员，收件人 SHALL 去重，相关操作者本人 SHALL 保留在收件人中；同一次业务操作即使涉及多个字段或同时影响父任务，同一人员 SHALL 仅收到一条完整的变动通知。原型 SHALL 保留任务临近截止提醒，但不得因重复渲染或重复查看同一提醒生成重复记录。通知仅为本次内存会话内的站内演示，SHALL NOT 增加外部消息发送、后台推送或真实持久化要求。

任务变动 SHALL 覆盖创建（包括等待自建审核）、名称、说明、日期时刻、紧急程度、负责人和父任务等定义信息修改、进度及进度备注修改、提交完成、直接完成、自建审核通过或拒绝、完成审核通过或退回。本次“重要度”或优先级调整 SHALL 使用现有紧急程度字段（紧急、高、中、低）表达并生成优先级变动通知，不新增独立的重要程度字段。任务通知的相关人 SHALL 包括创建者、变动前后的全部负责人，以及该次流程需要的审核人；同一人员兼任多个角色时 SHALL 去重。若子任务创建、状态或进度变化影响父任务汇总，或任务改换父任务，相关人 SHALL 同时包含受影响的原、新父任务创建者与负责人，通知摘要 SHALL 说明受影响的父子任务关系或汇总变化。改派任务 SHALL 同时告知原负责人和新负责人，不得因保存后负责人列表已改变而漏掉原负责人。

公司统一信息的新增、编辑、删除 SHALL 通知全体业务用户；个人信息的新增、编辑、删除 SHALL 仅通知本人。日志的创建与编辑，以及已有的删除操作，SHALL 通知作者、有权查看该日志的相关上级，以及有权查看该日志的关联任务创建者与负责人；日志改换或移除关联任务时 SHALL 合并修改前后的合法相关收件人。日志关联 SHALL NOT 使原本无权查看日志的人员收到其内容。请示提交与回复 SHALL 通知发起人和对应处理人，并明确本次为提交还是回复及其结果。

每条通知 SHALL 保存事件发生时的对象类型、标识与标题、操作者、发生时间和可读的变化摘要，不得只引用对象的当前标题或当前状态代替历史快照。关键字段修改 SHALL 能读出具体变动，负责人、紧急程度、排期、进度、状态和父任务变动 SHALL 展示修改前后的内容。每位收件人的未读状态 SHALL 独立维护，通知列表和入口计数 SHALL 仅反映当前身份的记录。用户 SHALL 能查看单条通知并标为已读，也 SHALL 能将本人的全部通知标为已读，且不得改变其他收件人的已读状态。

通知快照 SHALL 在对象改派或删除后仍可由原收件人查看，但打开关联对象 SHALL 重新检查当前可见权限。当前身份已无查看权限时 SHALL 给出明确提示且不得展示对象当前详情；对象已删除时 SHALL 保留事件摘要并友好提示该对象已不存在。站内通知 SHALL NOT 扩大任务、日志或其他业务对象的查看及修改权限。

未通过校验、被权限阻止、取消的操作，以及未造成实际内容变化的保存 SHALL NOT 生成通知。页面切换、日期切换、展开收起、筛选、打开详情、读取通知、标记已读和示例数据初始化 SHALL NOT 作为业务变动重复产生通知。

#### Scenario: Notify on a published or pending task creation
- **WHEN** 用户成功创建一项直接生效任务或提交一项待直属上级审核的自建任务
- **THEN** 原型 SHALL 为创建者、全部负责人及本次需要的审核人生成去重的创建通知，明确任务当前为已生效或待审核；如果创建子任务影响父任务，父任务相关人 SHALL 同时获知

#### Scenario: Notify on definition and priority changes
- **WHEN** 创建者实际修改任务名称、说明、排期、紧急程度或其他可编辑定义字段并保存成功
- **THEN** 相关人员 SHALL 收到同一条包含操作者、发生时间及本次全部变动摘要的通知，紧急程度 SHALL 显示修改前后的值

#### Scenario: Notify both sides of a reassignment
- **WHEN** 创建者增加、移除或更换任务负责人
- **THEN** 创建者、修改前后的全部负责人及本次需要的审核人 SHALL 各收到一条通知，包括被移除的原负责人；通知 SHALL 说明负责人由谁变为谁

#### Scenario: Notify affected parent-task participants
- **WHEN** 子任务实际变动影响父任务汇总，或其父任务关联被新增、替换或移除
- **THEN** 相关收件人 SHALL 同时包含受影响的原、新父任务创建者和负责人，兼任子任务相关人的收件人不得收到重复通知，摘要 SHALL 说明关联或汇总变化

#### Scenario: Notify on progress and completion submission
- **WHEN** 负责人实际更新进度或进度备注、提交完成，或没有更高审核人的上层自建任务直接完成
- **THEN** 创建者、全部负责人、需要处理的审核人以及受影响的父任务相关人 SHALL 收到对应的进度更新、待完成审核或已完成通知

#### Scenario: Notify every review outcome
- **WHEN** 审核人通过或拒绝自建任务，或通过或退回完成申请
- **THEN** 相关人员 SHALL 收到明确区分审核结果的通知，包含任务状态变化和已填写的审核意见，不得将自建任务审核通过误记为第二次任务创建

#### Scenario: Surface due and emergency notices
- **WHEN** 示例任务临近截止或任务紧急程度实际提高
- **THEN** 创建者与全部负责人 SHALL 收到对应提醒或变动通知，看到任务名称与时间信息；重复渲染 SHALL NOT 重复生成同一次提醒

#### Scenario: Notify company and personal information changes
- **WHEN** 用户成功新增、编辑或删除公司统一信息或本人的个人信息
- **THEN** 公司信息变动 SHALL 通知全体业务用户，个人信息变动 SHALL 只通知本人，并在删除后仍保留当时的信息标题和删除摘要

#### Scenario: Notify legitimate log participants
- **WHEN** 作者成功创建或实际编辑日志，包括调整关联任务
- **THEN** 作者、具有该日志查看权限的相关上级及修改前后关联任务的合法相关成员 SHALL 收到去重通知，无权查看日志的任务成员 SHALL NOT 收到日志内容

#### Scenario: Notify consultation submission and reply
- **WHEN** 中层成功提交请示，或对应上层成功回复请示
- **THEN** 发起人和处理人 SHALL 各收到一条明确描述该次提交或回复的通知，并能在当前权限允许时进入对应请示

#### Scenario: Keep notification snapshots and permissions independent
- **WHEN** 原负责人查看改派通知后尝试打开已经不再有权查看的任务，或收件人打开已删除对象的通知
- **THEN** 原型 SHALL 保留并显示其合法收到的事件快照，分别提示当前无权查看或对象已删除，且不得泄露当前对象详情

#### Scenario: Maintain per-person unread state
- **WHEN** 一位收件人打开通知或将自己的全部通知标为已读，再切换到另一位收件人
- **THEN** 前者的未读数 SHALL 相应减少，后者的同一事件通知 SHALL 保持其独立的未读状态

#### Scenario: Ignore unsuccessful and unchanged operations
- **WHEN** 用户保存未改变任何字段的表单、提交无效数据、尝试无权限操作或取消操作
- **THEN** 通知数量与所有收件人的未读计数 SHALL 保持不变

### Requirement: Personal work logs
日志 SHALL 归属于唯一作者；作者 SHALL 能创建和编辑自己的日志，并可选择是否关联其可见任务。上层 SHALL 能查看全公司日志，中层 SHALL 能查看本部门日志，下层 SHALL 只能查看自己的日志；查看权限不得赋予非作者编辑权。

#### Scenario: Write an unlinked log
- **WHEN** 用户填写日志内容但不选择所属任务并保存
- **THEN** 原型 SHALL 保存个人日志，且不强制建立任务关联

#### Scenario: Superior reads a subordinate log
- **WHEN** 中层打开本部门下层的日志
- **THEN** 原型 SHALL 展示日志内容，但不显示编辑操作

### Requirement: Manager consultation
中层 SHALL 能向直属上层发起请示并查看示例处理结果；下层 SHALL 不显示发起请示的入口。请示仅演示需求中明确的上下级沟通，不扩展为通用审批或任务字段变更系统。

#### Scenario: Manager submits a consultation
- **WHEN** 中层填写请示内容并提交给直属上层
- **THEN** 原型 SHALL 显示该请示处于待回复状态，并向对应上层展示待处理记录

#### Scenario: Employee cannot submit a consultation
- **WHEN** 当前身份为下层
- **THEN** 日志页及任务详情 SHALL 不显示发起请示入口

### Requirement: Log page single-content filtering and scroll return
日志页 SHALL 将写日志、创建或派发任务、发起请示等即时命令与内容筛选明确区分。页面 SHALL 提供当前身份可用的“日志”“待我审核”“我提交的自建任务”“我的请示”或“待处理请示”等内容筛选项，筛选状态 SHALL 为单选；首次进入日志页以及切换演示身份后 SHALL 默认选中“日志”，内容区 SHALL 只展示当前筛选对应的列表而不依次堆叠其他列表。日志页 SHALL 在内容区离开顶部后提供一键回到顶部的操作。

当上层或中层选择“日志”内容时，页面 SHALL 在快捷操作、内容筛选和日志结果之外提供独立的“日志查找”板块，其中包含可重复点击以开启或关闭的“只看自己”按钮，以及按作者姓名进行不区分大小写、包含匹配的搜索输入。两个条件同时启用时 SHALL 取交集，空搜索 SHALL 不限制作者；筛选结果 SHALL 始终受当前身份的日志查看权限约束。日志查找条件 SHALL NOT 影响其他内容筛选的列表，并 SHALL 在切换演示身份时重置。下层因只能查看本人日志 SHALL NOT 显示该冗余板块。

#### Scenario: Enter the log page
- **WHEN** 用户首次进入日志页或切换演示身份后进入日志页
- **THEN** “日志”筛选 SHALL 处于唯一选中状态，内容区 SHALL 只展示当前身份可见的日志列表，且上层和中层的日志查找条件均处于未启用状态

#### Scenario: Select pending reviews
- **WHEN** 具有审核权限的用户选择“待我审核”
- **THEN** “待我审核” SHALL 成为唯一选中项，内容区 SHALL 只展示待该用户审核的项目或明确的空状态

#### Scenario: Switch between role-specific content filters
- **WHEN** 用户选择当前身份可用的另一个内容筛选项
- **THEN** 原型 SHALL 取消先前筛选并仅展示新筛选对应的内容，不得同时堆叠两个筛选列表

#### Scenario: Invoke a log-page command
- **WHEN** 用户选择写日志、创建或派发任务、发起请示等即时命令
- **THEN** 原型 SHALL 打开相应操作界面，且不得将该命令作为可与内容筛选叠加的选中状态

#### Scenario: Toggle own logs
- **WHEN** 上层或中层在“日志”内容中首次点击“只看自己”
- **THEN** 按钮 SHALL 显示启用状态，日志结果 SHALL 仅保留当前用户作为作者且同时满足作者搜索的可见日志

#### Scenario: Restore the visible log scope
- **WHEN** 上层或中层再次点击已启用的“只看自己”
- **THEN** 按钮 SHALL 恢复未启用状态，日志结果 SHALL 恢复为当前权限范围内满足作者搜索的日志

#### Scenario: Search logs by author
- **WHEN** 上层或中层在作者搜索中输入姓名片段
- **THEN** 日志结果 SHALL 仅显示当前权限范围内作者姓名包含该片段且同时满足“只看自己”状态的日志

#### Scenario: Show no matching authors
- **WHEN** 启用的日志查找条件在当前权限范围内没有匹配日志
- **THEN** 日志结果区 SHALL 展示清楚的无匹配状态且保留当前查找条件以供修改

#### Scenario: Keep log finding separate and scoped
- **WHEN** 上层或中层切换到“待我审核”或其他非日志内容筛选
- **THEN** 日志查找控件 SHALL 不与该内容列表混排，其条件 SHALL NOT 改变该列表的项目或计数

#### Scenario: Return to the top of log content
- **WHEN** 用户在日志页向下滚动使内容区顶部离开视口并触发回到顶部操作
- **THEN** 原型 SHALL 将当前日志页内容区恢复到顶部，同时保留当前选中的内容筛选和当前身份下的日志查找条件

### Requirement: Role-scoped AI map
AI地图页 SHALL 集成任务数据统计、关键词词云和 AI 建议。下层的任务统计和 AI 建议 SHALL 仅基于本人数据；中层的任务统计 SHALL 基于本部门数据且 AI 建议仅面向本人；上层的任务统计和 AI 建议 SHALL 基于全公司数据。词云范围 SHALL 为上层查看公司、中层查看部门、下层查看所在部门的聚合词云，且不得暴露无权查看的单条任务或日志。

#### Scenario: View employee AI map
- **WHEN** 下层进入 AI地图页
- **THEN** 页面 SHALL 展示本人的任务统计与个人建议，以及不包含个人明细的部门聚合词云

#### Scenario: View executive AI map
- **WHEN** 上层进入 AI地图页
- **THEN** 页面 SHALL 展示全公司的任务统计、公司词云和公司级建议

### Requirement: Minimal profile page
我的页面 SHALL 仅展示当前用户的常规个人身份信息，包括姓名、部门和角色。角色切换 SHALL 仅存在于包裹原型的预览控件中，不得伪装为正式产品设置。

#### Scenario: View profile
- **WHEN** 用户进入我的页面
- **THEN** 页面 SHALL 展示姓名、部门和角色，且不显示资料编辑、通知偏好、账号管理、指南或数据重置功能

### Requirement: Strict prototype scope
业务界面 SHALL 不提供需求文档未提出的全局搜索、任务草稿、个人重点或排序、日志转待办、任务取消、任务关键字段变更申请、排期冲突检查、工作空间切换或账号启停功能。按作者查找 SHALL 仅存在于日志页并仅筛选当前身份有权查看的日志，不得扩展为全局搜索。原型 SHALL 保持由一个 HTML 入口及其同目录 CSS、JavaScript 资源组成的静态示例、支持直接打开和适度可交互的验证用途，不要求构建步骤、第三方运行时、网络请求或真实后端持久化。

#### Scenario: Inspect available actions
- **WHEN** 预览者遍历五个页面、任务详情、日志详情、日志查找和审核入口
- **THEN** 可见操作 SHALL 仅覆盖本规格定义的页面与业务流程，作者查找 SHALL NOT 返回权限范围外的日志或其他类型数据

#### Scenario: Open the split static prototype
- **WHEN** 预览者从文件系统直接打开 HTML 入口且同目录样式和脚本资源存在
- **THEN** 原型 SHALL 正常加载样式、示例数据和交互，无需构建、安装依赖、启动服务器或发起网络请求
