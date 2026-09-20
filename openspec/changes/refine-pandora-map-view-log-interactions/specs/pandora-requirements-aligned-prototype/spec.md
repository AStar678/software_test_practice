## MODIFIED Requirements

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

## ADDED Requirements

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
