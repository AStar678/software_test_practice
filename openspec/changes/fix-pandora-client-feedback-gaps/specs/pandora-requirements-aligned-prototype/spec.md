## ADDED Requirements

### Requirement: Authorized task table page
系统 SHALL 从视图提供“任务表单”二级页面，使用一行一项任务、表头与网格对齐的表格展示本人当前全部授权正常任务。表格 SHALL 支持纵向及窄屏横向滚动，并使表头、任务名称、返回和分页操作可定位及操作。每项 SHALL 显示任务名称、本人关系、有序负责人、原创建者、创建时间、说明、完成标准、开始/截止日期时间、全天标记、执行状态、是否完成、紧急程度、进展备注、当前待审类型/冻结、逾期标记及有权查看的上级任务；长文本可预览并从详情查看全文，全天 SHALL 不伪造时刻，无权父任务 SHALL 不泄露标识或标题。

列表、搜索及计数 SHALL 只纳入当前有正常查看权且已有有效版本的任务，按任务标识去重。已生效任务待审 SHALL 展示旧有效版及待审标记，不泄露提议或专用 diff；待创建及其他未发布申请、仅有历史通知只读访问权的任务 SHALL 不纳入。任务操作 SHALL 进入原鉴权详情及审核流程，不提供单元格直接改写。返回日历 SHALL 保留此前模式和日期；关闭详情 SHALL 保留表单条件及当前位置。

#### Scenario: Browse the authorized spreadsheet on a narrow screen
- **WHEN** 用户从任一日历模式进入任务表单并滚动表格
- **THEN** 页面 SHALL 展示全部规定字段，表头和名称可定位、所有行可访问，底部仍只有五个主导航，返回 SHALL 恢复原模式和日期

#### Scenario: Inspect effective data while review is pending
- **WHEN** 当前范围中同时存在已生效修改待审、完成待审、待创建及仅历史通知可读任务
- **THEN** 表格 SHALL 仅展示前两类的有效资料和待审类型/冻结，后两类 SHALL 不进入列表、搜索及计数，普通查看者 SHALL 不获得提议或 diff

#### Scenario: Open detail and return without losing context
- **WHEN** 用户在表单筛选并翻页后打开任务详情，关闭或完成一次允许的业务操作
- **THEN** 系统 SHALL 保留条件及可用页码，普通关闭保持浏览位置，成功写入后按当前有效数据重算；受限父任务 SHALL 不因表格展示而泄露

### Requirement: Combined task table filters and search
任务表单 SHALL 提供“全部/我负责/我创建/仅可见”关系、“全部/未完成/已完成”完成、任务名称及可选起止日期条件，全部条件同时生效。本人为有效负责人即“我负责”，本人为原创建者即“我创建”（包括同时负责），两者均否才属“仅可见”；行 SHALL 可同时标记负责和创建但不重复。完成 SHALL 仅由有效执行状态判断，待完成审核仍属未完成。

名称搜索 SHALL 对整个当前授权正常任务集做去首尾空格、不区分大小写的包含匹配，最多 200 字符；日历 SHALL 不保留普通任务搜索。日期默认全部，不继承日历月份，支持只填一端，按公司时区任务首尾日期与所选闭合日期范围相交筛选；全天首尾日期均包含，定时任务用实际开始及截止所属公司日期。结束早于开始 SHALL 提示错误且不发布错误结果。人员、日志及编辑中的关联任务查找 SHALL 保持原有用途及权限。

#### Scenario: Find a task created and assigned to oneself
- **WHEN** 本人同时为一个任务的创建者和负责人，分别选择我负责、我创建或仅可见
- **THEN** 前两个筛选 SHALL 各包含该任务一次，仅可见 SHALL 排除该任务，关系标记 SHALL 可同时显示负责和创建

#### Scenario: Apply relation completion title and date together
- **WHEN** 用户选择我创建、未完成，输入名称片段并设置与任务排期相交的日期
- **THEN** 系统 SHALL 返回同时满足所有条件的完整授权结果，完成待审 SHALL 仍包含于未完成，已完成或任一条件不符的任务 SHALL 排除

#### Scenario: Search beyond the first API page
- **WHEN** 名称匹配任务位于 API 第二页之后或原日历所选月份之外
- **THEN** 默认全部日期的任务表单 SHALL 找到任务，不能仅搜索首 20 条或当前显示页

#### Scenario: Use company dates independently of device timezone
- **WHEN** 设备时区与公司时区不同，用户输入单端或双端日期，或输入结束早于开始的范围
- **THEN** 正常筛选 SHALL 使用公司日期、全天首尾均包含，非法范围 SHALL 显示校验错误并保留上次有效结果

### Requirement: Global task table sorting and counts
表单 SHALL 至少支持按名称、创建时间、开始、截止、紧急程度和执行状态的列头升降序排序并显示方向；默认开始升序，切换新列先升序，同列再次切换降序，同值始终按任务标识升序稳定排列。紧急程度升序 SHALL 为紧急/高/中/低，执行状态升序 SHALL 为待开始/进行中/已完成，个人置顶 SHALL 不影响表格排序。筛选和排序 SHALL 在整个结果集完成后再分页，每页默认 50 条，改变条件/排序回第一页。

表单 SHALL 展示完整组合筛选结果的总数、我负责、我创建、仅可见、待完成审核、已完成、逾期未完成数量，跨日及跨分页按任务标识去重，不随页大小或排序改变。负责和创建 SHALL 分别判断并允许重叠，关系数相加 SHALL 不作为总数。完成待审 SHALL 单列且不当作已完成；逾期未完成 SHALL 由当前时刻已超过有效截止且执行状态非已完成判断，可与未完成状态及待审重叠，全天使用真实有效截止时刻。

#### Scenario: Sort all filtered rows before paging
- **WHEN** 超过两页 API 的授权任务分布着不同开始时间、同名、不同紧急程度及状态，用户分别切换六列排序并翻表格页
- **THEN** 各页连起来 SHALL 等于完整筛选结果的全局排序，同值按任务标识稳定排序，方向可辨识，置顶 SHALL 不改变该序列

#### Scenario: Count overlapping relationships without duplicate totals
- **WHEN** 唯一筛选结果是一个跨日、本人创建且负责的任务
- **THEN** 总数 SHALL 为 1，我负责 SHALL 为 1，我创建 SHALL 为 1，仅可见 SHALL 为 0，不因跨日或关系重叠增加总行数

#### Scenario: Recompute counts after all filters
- **WHEN** 用户在超过一显示页的结果中叠加名称、关系、完成和日期条件，随后翻页或改排序
- **THEN** 所有计数 SHALL 基于同时满足条件的完整去重结果，翻页及排序 SHALL 不改变数量

#### Scenario: Separate pending completion done and overdue
- **WHEN** 范围包含完成待审且逾期、已完成但过截止、全天未到有效截止及全天已过截止的任务
- **THEN** 完成待审 SHALL 计未完成并单独计待完成审核，已完成 SHALL 不计逾期，全天逾期 SHALL 依有效截止时刻准确判断

### Requirement: Task table refresh and account isolation
进入表单、主动刷新、应用恢复及成功任务变更后的查询 SHALL 重新取得当前授权正常任务，返回日历 SHALL 按最新有效负责人重建投影；移除负责人但仍有其他权限的任务 SHALL 可留在表单而不留在日历。加载 SHALL 有明确状态，完整加载前不得显示部分结果为完整统计；失败 SHALL 显示错误与重试，无任务与无筛选结果 SHALL 有可区分空态并允许清空条件。

详情及写入 SHALL 使用当前后端权限，失权后的旧详情 SHALL 不能靠缓存继续访问。账号退出、失效或切换 SHALL 清除旧账号表单数据和状态，迟到响应 SHALL 不得覆盖当前会话。未送达/已删除/已撤回/到期消息及历史通知只读入口 SHALL 不向普通表单授予范围。

#### Scenario: Apply effective assignee changes
- **WHEN** 本人被移出已生效负责人但仍为创建者，随后进入表单或刷新并返回日历
- **THEN** 任务 SHALL 仍可在我创建范围找到，且从月/周/日、全天、跨日条及当日列表全部消失，未批准的负责人提议 SHALL 不提前改变结果

#### Scenario: Revoke all normal access
- **WHEN** 本人正常任务授权被收回但仍保有历史通知，随后刷新或打开旧详情
- **THEN** 普通表单、搜索和计数 SHALL 不含该任务，普通详情 SHALL 拒绝；通知专用只读详情 SHALL 不把任务重新加入列表

#### Scenario: Fail a later page and retry
- **WHEN** 完整任务读取第二页失败，或首次读取结果为空，或条件过滤结果为空
- **THEN** 第二页失败 SHALL 显示可重试错误且不声明部分统计；后两种 SHALL 分别显示无任务和无筛选结果，清空条件 SHALL 可用

#### Scenario: Ignore stale account and refresh responses
- **WHEN** 旧账号或较早刷新尚未完成时切换账号或开始新刷新，旧响应随后返回
- **THEN** 系统 SHALL 只展示当前账号最新有效查询结果，旧行、条件、返回上下文及迟到响应 SHALL 不污染新会话

## MODIFIED Requirements

### Requirement: Five-page navigation
App SHALL 仅提供“导图”“视图”“日志”“AI地图”“我的”五个主业务页面，固定导航切换时保持真实认证身份；通知中心承接审核而非第六个主页面，创建/派发与本人申请入口属于视图，日志只写看日志。任务表单 SHALL 作为视图下的二级页面而非第六主导航，详情关闭后返回表单，表单返回保留日历模式与日期。演示身份选择 SHALL 经过实际认证且不得改变服务端权限。

#### Scenario: Navigate with an authenticated identity
- **WHEN** 用户依次切换五页或从通知进入审核
- **THEN** 系统 SHALL 保持真实账号及组织权限，五页导航仅选中当前页，通知 SHALL 不成为第六页

#### Scenario: Navigate across the prototype
- **WHEN** 用户依次切换五页或从通知进入审核
- **THEN** 系统 SHALL 保持真实账号及组织权限，五页导航仅选中当前页，通知 SHALL 不成为第六页

#### Scenario: Enter the task table as a secondary view
- **WHEN** 用户从日历打开任务表单、进入任务详情并依次返回
- **THEN** 主导航 SHALL 始终仅有五项并选中视图，详情返回表单，表单返回此前日历模式与日期


### Requirement: Calendar task views
视图页 SHALL 提供月、周、日模式，所有月格、周/日时间轴、全天区、跨日条及当日完整列表 SHALL 仅展示本人当前为有效负责人的正常任务，包含本人创建且负责及已完成任务；本人仅创建或仅凭组织授权可见但非负责的任务 SHALL 不进入日历。该展示限制 SHALL 不收窄任务表单、详情、导图、日志关联及 AI 的既有授权。顶部 SHALL 提供左侧展开、中央可点年月及任务表单入口；侧面板提供模式切换及独立本人申请入口，右下悬浮创建按钮不遮挡导航和任务。周/日偏离本周/今天时 SHALL 提供相应返回快捷键，日期确认后定位相应月、周或日。普通任务名称搜索及关系/状态统计 SHALL 迁到任务表单，日历不保留搜索框、按钮、结果或统计区；日期导航和月格真实隐藏数量 SHALL 保留。待创建及历史通知只读例外 SHALL 不进入任何日历区域。

月视图 SHALL 为默认模式，周一至周日排列、日期格固定、相邻月日期弱化但可读，跨日跨周跨度可辨；默认按开始时间升序，同时间按任务标识稳定排序。每格最多五条、空间不足可更少，超长标题直接裁切不追加省略号；有隐藏任务则显示实际隐藏数量，点击日期格 SHALL 打开当天全部本人负责的正常任务列表。本人置顶 SHALL 持久化且仅改变本人月格及当日列表顺序，不改紧急程度；相同置顶状态仍按时间排序。

周/日 SHALL 有周一至周日日期行、全天区及可纵向滚动的 00:00—24:00 时间轴，不将一天压进首屏。全天按完整日期范围显示，非全天跨日逐日显示真实覆盖时段；重叠任务 SHALL 在当天按完整并发列数横向并列，全天及定时任务均逐项可见、可点，不用折叠或 +N 代替。标题可裁切但不得互相覆盖阻止点击，最小点击区域与置顶标识 SHALL 不改真实时间位置。

日期区域左右滑动 SHALL 每次切完整一周并对齐，日视图保持所选星期，任务区竖滚不误切周。每块 SHALL 有“我负责”的可见非纯色关系标记与无障碍名称，保留稳定低饱和配色且颜色非唯一含义；多重关系与数量 SHALL 在任务表单按独立规则展示，日历不再按关系计数。时间轴置顶仅强调，不移动时段。

#### Scenario: Use the required calendar entry points
- **WHEN** 用户展开面板、选日期、进入任务表单、打开本人申请或点右下加号
- **THEN** 系统 SHALL 分别提供模式切换、相应日期定位、任务表单二级页面、隔离的本人申请及创建表单，日历无普通名称搜索或统计区，收起后日历 SHALL 占主体

#### Scenario: Read a month and open a complete day list
- **WHEN** 跨月跨周任务与超过月格容量的任务同时存在
- **THEN** 系统 SHALL 绘制可辨跨度、固定格和真实隐藏数，最多显示五条，标题直接裁切；点日期格 SHALL 展示该日全部本人负责的正常任务而非直接下钻周视图

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
- **WHEN** 同任务兼有创建者/负责人身份并跨越多天，且有本人仅创建、仅组织可见、待创建及仅历史访问任务
- **THEN** 日历所有区域及当日列表 SHALL 只显示有效负责人含本人的正常任务并标记我负责，不显示统计区；原互斥计数 SHALL 由表单独立判断的负责/创建关系计数替代，本人仅创建、仅组织可见、未发布及历史例外任务 SHALL 不进入日历

#### Scenario: Open the default month view
- **WHEN** 用户展开面板、选日期、进入任务表单、打开本人申请或点右下加号
- **THEN** 系统 SHALL 分别提供模式切换、相应日期定位、任务表单二级页面、隔离的本人申请及创建表单，日历无普通名称搜索或统计区，收起后日历 SHALL 占主体

#### Scenario: Select a year and month
- **WHEN** 用户展开面板、选日期、进入任务表单、打开本人申请或点右下加号
- **THEN** 系统 SHALL 分别提供模式切换、相应日期定位、任务表单二级页面、隔离的本人申请及创建表单，日历无普通名称搜索或统计区，收起后日历 SHALL 占主体

#### Scenario: Drill from month to week
- **WHEN** 用户点击月视图日期格
- **THEN** 系统 SHALL 按 V3 打开当天完整任务列表，替代旧下钻周视图；周模式从面板切换

#### Scenario: Ignore blank month task space
- **WHEN** 用户点击月视图日期格内无任务条的区域
- **THEN** 系统 SHALL 按 V3 打开当天完整列表；点击独立任务条仅开该任务详情

#### Scenario: Drill from week to day
- **WHEN** 用户选择周视图某日期的日程入口
- **THEN** 系统 SHALL 定位该日视图，任务点击不同时触发日期导航

#### Scenario: Ignore blank week task space
- **WHEN** 用户点击周时间轴空白或竖滚
- **THEN** 系统 SHALL 不误开任务或切换模式，日期区手势与任务区竖滚分别处理

#### Scenario: Switch time granularity
- **WHEN** 用户展开面板、选日期、进入任务表单、打开本人申请或点右下加号
- **THEN** 系统 SHALL 分别提供模式切换、相应日期定位、任务表单二级页面、隔离的本人申请及创建表单，日历无普通名称搜索或统计区，收起后日历 SHALL 占主体

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
- **WHEN** 同任务兼有创建者/负责人身份并跨越多天，且有本人仅创建、仅组织可见、待创建及仅历史访问任务
- **THEN** 日历所有区域及当日列表 SHALL 只显示有效负责人含本人的正常任务并标记我负责，不显示统计区；本人仅创建、仅组织可见、未发布及历史例外任务 SHALL 不显示，完整关系及状态数量迁入任务表单

#### Scenario: Show only task names in bars
- **WHEN** 日历绘制任务块
- **THEN** 系统 SHALL 显示标题及必要关系标记，不塞入描述/进展等详情，裁切后仍可点击详情读全文

#### Scenario: Order visible task lanes
- **WHEN** 用户置顶并刷新，而另一用户读取同一任务
- **THEN** 本人的月格及完整日列表 SHALL 置顶优先，同组时间升序；他人顺序、任务紧急程度及时间轴位置 SHALL 不变

#### Scenario: Fill five monthly task rows
- **WHEN** 跨月跨周任务与超过月格容量的任务同时存在
- **THEN** 系统 SHALL 绘制可辨跨度、固定格和真实隐藏数，最多显示五条，标题直接裁切；点日期格 SHALL 展示该日全部本人负责的正常任务而非直接下钻周视图

#### Scenario: Handle crowded time slots
- **WHEN** 跨月跨周任务与超过月格容量的任务同时存在
- **THEN** 系统 SHALL 绘制可辨跨度、固定格和真实隐藏数，最多显示五条，标题直接裁切；点日期格 SHALL 展示该日全部本人负责的正常任务而非直接下钻周视图

#### Scenario: Open overflow tasks for one date
- **WHEN** 跨月跨周任务与超过月格容量的任务同时存在
- **THEN** 系统 SHALL 绘制可辨跨度、固定格和真实隐藏数，最多显示五条，标题直接裁切；点日期格 SHALL 展示该日全部本人负责的正常任务而非直接下钻周视图

#### Scenario: Preserve calendar navigation after table return
- **WHEN** 用户从非本周或非今天的日历进入表单再返回
- **THEN** 系统 SHALL 恢复原模式和日期，并保留回到本周/今天、日期选择、创建和独立本人申请入口，月格隐藏数 SHALL 仅由本人负责任务计算


### Requirement: Strict prototype scope
交付系统 SHALL 以 V3 修订版第 1—7 章及本次确认作为业务基线（版本名不改变产品 V1 交付范围），实际服务入口 SHALL 使用真实认证、后端持久化及事件调度，不再以静态示例或直接打开文件替代验收。五页、任务表单二级页、独立 PC Web 管理端、表单名称搜索、个人置顶、审核申请、冲突建议与账户维护 SHALL 按本规格提供；请示回复、完整账号启停、一人多团队、任务私人草稿、任务取消、公司草稿/定时发布、日志转待办、外部模型与 MBTI SHALL 不纳入本轮。DEV-029 系统推送和 A-25 真机专项验收经用户授权延期，浏览器证据 SHALL 不冒充真机或全量正式验收。

#### Scenario: Validate the real service and declared scope
- **WHEN** 检查交付页面、API、测试与修复记录
- **THEN** 已纳入功能 SHALL 通过实际服务验证，不以演示数据或旧规则断言作为通过依据；延期推送和真机项 SHALL 单独标注且不计已修复

#### Scenario: Inspect available actions
- **WHEN** 检查交付页面、API、测试与修复记录
- **THEN** 已纳入功能 SHALL 通过实际服务验证，不以演示数据或旧规则断言作为通过依据；延期推送和真机项 SHALL 单独标注且不计已修复

#### Scenario: Open the split static prototype
- **WHEN** 从文件系统直接打开无后端会话的旧 HTML
- **THEN** 系统 SHALL 不将该方式作为业务验收通过；正式链路 SHALL 通过构建服务、真实认证、持久化及事件验证

### Requirement: Organization and administration
系统 SHALL 提供独立 PC 浏览器 Web 管理端（`/admin.html`）维护员工、部门、职位、团队、上下级、角色及分别配置的任务查看/派发权限，并查询全量任务操作历史、管理通知。员工部门和职位必填，一人一个主部门、至多一个团队、一位直属上级，组织顶层除外。部门与团队独立；获授权的部门负责人可创建团队，创建者默认负责且可转交。组织关系 SHALL 无环且不跨公司引用，组织位置不得由职位名称或负责人保存顺序推断。公司仅有一个管理员账号，管理员身份不自动取得员工派发、审核、日志或分析权。

员工 App SHALL 保持五个主导航且不嵌入完整管理员维护模块，管理员入口提示 SHALL 指向真实 PC 管理端。管理端能在窄屏打开不改变其 PC Web 交付定位；管理员身份 SHALL 不自动授予员工业务权限，业务账号直连管理 API SHALL 仍被拒绝。

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

#### Scenario: Use the independent PC administration interface
- **WHEN** 管理员在电脑浏览器建号并完成组织、公司信息、交接、任务历史和通知管理，员工从 App 使用业务或直连管理 API
- **THEN** 管理端 SHALL 承接已授权管理流程，App SHALL 不出现完整管理模块，员工 SHALL 无法越权调用管理 API，管理员误入业务页提示 SHALL 指向 /admin.html
