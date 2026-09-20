## MODIFIED Requirements

### Requirement: Calendar task views
视图页 SHALL 提供无横向滚动的响应式月、周、日三种类甘特视图，并保留位于视图主体上方的当前时间范围、任务归属图例和排序说明板块。任务 SHALL 以从开始时间连续延伸至结束时间的条形呈现，在当前视图边界或月视图逐日容量边界处截断，并且任务条可见文本 SHALL 仅包含任务关系 emoji 标记和任务名称，不得显示任务描述、状态、截止日期或其他元数据；完整信息仍 SHALL 可从任务详情查看。任务的纵向排列 SHALL 先按时间跨度从长到短，其次按紧急程度从高到低，最后按截止日期从近到远。

视图页 SHALL 从低饱和色板按任务标识稳定分配填充色，在同屏可用颜色尚未耗尽时 SHALL 尽量不为不同任务重复用色，色板耗尽后 MAY 重复颜色。颜色 SHALL 仅用于区分不同任务，不得单独承担任务关系含义。每个任务条 SHALL 使用互斥的关系标记：当前用户是负责人时标记“我负责”，否则当前用户是创建者时标记“我分配”，两者皆非但任务可见时标记“仅可见”；三类关系 SHALL 分别使用带文字图例和无障碍名称的不同 emoji 前缀。

月视图 SHALL 为默认视图，并提供可直接选择年份和月份的选择器。月视图 SHALL 按完整自然周显示目标月所覆盖的全部日期，包括网格首尾属于相邻月份的日期及落在这些日期上的可见任务；相邻月份日期 SHALL 保持可读并与目标月日期有非颜色唯一的弱化差异。每个日期单元 SHALL 先显示独立、可操作的日期数字标题，其视觉高度约为一条任务行的 1.5 倍，标题下方 SHALL 提供五条等高任务行。某日期最多有五项任务时 SHALL 显示排序最靠前的至多五项；超过五项时 SHALL 在前四行显示任务，并在第五行显示可操作的 `+N`，其中 N 为该日期未直接显示的任务数。跨日任务在连续可展示日期上 SHALL 保持连续条形，在因逐日容量溢出而隐藏的日期边界处 MAY 分段。

用户点击月视图任一日期标题 SHALL 进入包含该日期的周视图；点击日期标题之外的空白任务区域 SHALL NOT 切换视图。用户点击周视图某一天内不属于任务条或其他控件的区域 SHALL 进入对应日视图。周视图 SHALL 提供上一周、下一周和返回月视图操作；日视图 SHALL 提供前一天、后一天和返回周视图操作。点击任何视图中的任务条 SHALL 打开任务详情而不得触发视图下钻。

#### Scenario: Open the default month view
- **WHEN** 用户进入视图页且尚未在本次会话中下钻
- **THEN** 原型 SHALL 展示当前月份覆盖的完整自然周网格及其上方说明板块，所有日期均带日期数字，且页面与视图主体均不存在横向滚动

#### Scenario: Select a year and month
- **WHEN** 用户打开年月选择器并选择目标年份和月份
- **THEN** 月视图 SHALL 直接切换到所选月份、更新范围标签，并展示该月网格包含的本月与相邻月份日期及任务

#### Scenario: Drill from month to week
- **WHEN** 用户点击月视图某个日期数字标题
- **THEN** 原型 SHALL 切换到包含该日期的周视图

#### Scenario: Ignore blank month task space
- **WHEN** 用户点击月视图日期标题、任务条和 `+N` 之外的空白任务区域
- **THEN** 原型 SHALL 保持当前月视图且不打开其他内容

#### Scenario: Drill from week to day
- **WHEN** 用户点击周视图某一天内不属于任务条或其他控件的区域
- **THEN** 原型 SHALL 切换到该日期的日视图

#### Scenario: Switch time granularity
- **WHEN** 用户通过月视图日期标题、周视图日期区域或逐级返回操作切换时间粒度
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
- **THEN** 原型 SHALL 按可展示的相交范围绘制任务条、仅显示关系标记和可读任务名称，并将超出当前范围或逐日容量的部分截断

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
- **WHEN** 月视图某日期包含五项或更少的可见任务
- **THEN** 该日期 SHALL 按规定顺序在日期标题下直接显示至多五项任务且不显示 `+N`

#### Scenario: Handle crowded time slots
- **WHEN** 月视图某日期包含六项或更多可见任务
- **THEN** 该日期 SHALL 在前四行显示排序最靠前的任务，并在第五行显示代表其余任务数量的可操作 `+N`

#### Scenario: Open overflow tasks for one date
- **WHEN** 用户点击某日期第五行的 `+N`
- **THEN** 原型 SHALL 展示该日期未直接显示且当前身份有权查看的任务列表，并允许从列表打开任务详情

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

### Requirement: Strict prototype scope
业务界面 SHALL 不提供需求文档未提出的全局搜索、任务草稿、个人重点或排序、日志转待办、任务取消、任务关键字段变更申请、排期冲突检查、工作空间切换或账号启停功能。按作者查找 SHALL 仅存在于日志页并仅筛选当前身份有权查看的日志，不得扩展为全局搜索。原型 SHALL 保持由一个 HTML 入口及其同目录 CSS、JavaScript 资源组成的静态示例、支持直接打开和适度可交互的验证用途，不要求构建步骤、第三方运行时、网络请求或真实后端持久化。

#### Scenario: Inspect available actions
- **WHEN** 预览者遍历五个页面、任务详情、日志详情、日志查找和审核入口
- **THEN** 可见操作 SHALL 仅覆盖本规格定义的页面与业务流程，作者查找 SHALL NOT 返回权限范围外的日志或其他类型数据

#### Scenario: Open the split static prototype
- **WHEN** 预览者从文件系统直接打开 HTML 入口且同目录样式和脚本资源存在
- **THEN** 原型 SHALL 正常加载样式、示例数据和交互，无需构建、安装依赖、启动服务器或发起网络请求
