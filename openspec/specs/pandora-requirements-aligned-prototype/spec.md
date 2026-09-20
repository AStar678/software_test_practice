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
视图页 SHALL 提供无横向滚动的响应式月、周、日三种类甘特视图，并保留位于视图主体上方的当前时间范围、任务归属图例和排序说明板块。任务 SHALL 以从开始时间连续延伸至结束时间的条形呈现，在当前时间范围边界处截断，并在可用宽度内展示任务名称和描述信息；月视图精确到日期，周视图和日视图精确到时刻。页面 SHALL 对本人负责和本人派发的任务使用可辨识的视觉差异；任务的纵向排列 SHALL 先按时间跨度从长到短，其次按紧急程度从高到低，最后按截止日期从近到远，同一展示位置仍无法容纳的任务 SHALL 以可操作的“+N”表示。

月视图 SHALL 为默认视图，并提供可直接选择年份和月份的选择器；用户点击月视图某一周行内不属于任务条或其他控件的区域 SHALL 进入对应周视图。用户点击周视图某一天内不属于任务条或其他控件的区域 SHALL 进入对应日视图。周视图 SHALL 提供上一周、下一周和返回月视图操作；日视图 SHALL 提供前一天、后一天和返回周视图操作。点击任务条 SHALL 打开任务详情而不得触发视图下钻。

#### Scenario: Open the default month view
- **WHEN** 用户进入视图页且尚未在本次会话中下钻
- **THEN** 原型 SHALL 展示当前月份的月视图及其上方说明板块，且页面与视图主体均不存在横向滚动

#### Scenario: Select a year and month
- **WHEN** 用户打开年月选择器并选择目标年份和月份
- **THEN** 月视图 SHALL 直接切换到所选月份并更新范围标签与任务条

#### Scenario: Drill from month to week
- **WHEN** 用户点击月视图某一周行的非任务区域
- **THEN** 原型 SHALL 切换到以该行日期范围为锚点的周视图

#### Scenario: Drill from week to day
- **WHEN** 用户点击周视图某一天的非任务区域
- **THEN** 原型 SHALL 切换到该日期的日视图

#### Scenario: Switch time granularity
- **WHEN** 用户通过月视图周行、周视图日期区域或逐级返回操作切换时间粒度
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
- **THEN** 原型 SHALL 按相交范围连续绘制任务条、保留可读的任务名称和描述信息，并将超出当前范围的部分截断在视图边界

#### Scenario: Order visible task lanes
- **WHEN** 当前时间范围内存在多个可见任务
- **THEN** 原型 SHALL 先展示时间跨度更长的任务，跨度相同时优先展示更紧急的任务，跨度和紧急程度均相同时优先展示截止日期更早的任务

#### Scenario: Handle crowded time slots
- **WHEN** 同一展示位置的任务数量超过可展示容量
- **THEN** 原型 SHALL 按规定顺序展示可容纳的任务，并显示可操作的“+N”入口查看其余任务

### Requirement: Role-scoped visibility
原型 SHALL 按角色限制业务数据：上层可查看全公司任务与日志；中层可查看本部门任务与日志；下层仅可查看本人负责的任务和本人日志。管理员属于独立管理端角色，本次业务端原型 SHALL 不提供文档未定义的管理员操作。

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
原型 SHALL 提供最小化的站内通知列表，用于演示任务创建、任务临近截止和临时紧急情况三类通知。相关通知 SHALL 同时面向任务负责人和任务创建者，并可从通知记录进入对应任务。

#### Scenario: Notify on task creation
- **WHEN** 一项任务发布或自建任务审核通过
- **THEN** 原型 SHALL 为创建者与全部负责人生成任务创建通知

#### Scenario: Surface due and emergency notices
- **WHEN** 示例任务临近截止或被标记为临时紧急情况
- **THEN** 创建者与全部负责人 SHALL 在通知列表中看到对应类型、任务名称和时间信息

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

#### Scenario: Enter the log page
- **WHEN** 用户首次进入日志页或切换演示身份后进入日志页
- **THEN** “日志”筛选 SHALL 处于唯一选中状态，内容区 SHALL 只展示当前身份可见的日志列表

#### Scenario: Select pending reviews
- **WHEN** 具有审核权限的用户选择“待我审核”
- **THEN** “待我审核” SHALL 成为唯一选中项，内容区 SHALL 只展示待该用户审核的项目或明确的空状态

#### Scenario: Switch between role-specific content filters
- **WHEN** 用户选择当前身份可用的另一个内容筛选项
- **THEN** 原型 SHALL 取消先前筛选并仅展示新筛选对应的内容，不得同时堆叠两个筛选列表

#### Scenario: Invoke a log-page command
- **WHEN** 用户选择写日志、创建或派发任务、发起请示等即时命令
- **THEN** 原型 SHALL 打开相应操作界面，且不得将该命令作为可与内容筛选叠加的选中状态

#### Scenario: Return to the top of log content
- **WHEN** 用户在日志页向下滚动使内容区顶部离开视口并触发回到顶部操作
- **THEN** 原型 SHALL 将当前日志页内容区恢复到顶部，同时保留当前选中的内容筛选

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
业务界面 SHALL 不提供需求文档未提出的全局搜索、任务草稿、个人重点或排序、日志转待办、任务取消、任务关键字段变更申请、排期冲突检查、工作空间切换或账号启停功能。原型 SHALL 保持单文件、静态示例数据和适度可交互的验证用途，不要求真实后端持久化。

#### Scenario: Inspect available actions
- **WHEN** 预览者遍历五个页面、任务详情、日志详情和审核入口
- **THEN** 可见操作 SHALL 仅覆盖本规格定义的页面与业务流程
