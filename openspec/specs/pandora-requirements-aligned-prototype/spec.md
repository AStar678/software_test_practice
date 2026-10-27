# pandora-requirements-aligned-prototype Specification

## Purpose

本规格用于约束潘多拉移动端交互原型只呈现需求文档定义的任务协作、工作日志、分级权限与统计信息，并以可操作的示例流程验证关键业务规则。

## Requirements

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
日历 SHALL 仅有月、日两种模式，默认月模式，月模式按月、日模式按天前后导航；日模式可保留可点的一周日期行，但 SHALL 不新增周视图或整周滑动要求。所有月格、日轴、全天区、跨日任务及当日清单 SHALL 仅展示本人当前为有效负责人的正常任务，含已完成任务；本人仅创建、仅组织可见、待创建、未发布和历史通知只读例外 SHALL 不进入日历。日历 SHALL 移除下属日程切换，其他入口合法权限 SHALL 不被收窄。

顶部 SHALL 提供左侧展开、可点年月日期选择及明确“任务表单”入口，侧面板 SHALL 承载月/日切换和本人申请；右下悬浮加号 SHALL 打开原创建表单且不遮挡导航或关键内容。收起后 SHALL 以日历为主体，日模式可回今天，不增加普通名称搜索及统计区。表单返回 SHALL 保留日历模式和日期。

月视图 SHALL 周一至周日排列，保留可调整月格高度、键盘调整、本地保存及最多两行标题截断和时间辅助信息。容量不足 SHALL 显示真实隐藏数量并可打开完整当日清单；月格及清单 SHALL 本人置顶优先，同组开始升序、任务标识稳定排序。置顶 SHALL 不改紧急度、他人顺序或真实时段。跨日/跨周跨度 SHALL 可辨。

月模式任务瀑布流 SHALL 可上下连续浏览前后月份及跨年，按位置补充相邻月份并显示边界，不以月份选择器作为跨月唯一入口；年月选择、回今天及日期导航 SHALL 继续可用。补载 SHALL 保持滚动位置，不重复相邻月边界日内容、不遗漏跨月任务；失败 SHALL 可重试，不把部分数据标为完整。

日模式 SHALL 提供可竖滚的 00:00—24:00 完整时间轴及独立全天区，可保留辅助清单。非全天跨日任务 SHALL 逐日显示真实覆盖时段，午夜截止不生成次日副本，零时长任务可识别。重叠任务 SHALL 在当天宽度内全量横向分栏，全天任务 SHALL 全量逐项展示或滚动访问，不以五项上限或“+N”隐藏。短任务点击区域 SHALL 不遮挡其他任务或改写真正时段；置顶仅强调。任务背景 SHALL 使用唯一标签颜色，无标签统一使用色板外的默认粉色非白底，文字、非纯色关系提示及无障碍名称 SHALL 可读。

#### Scenario: Filter the calendar without revoking other access
- **WHEN** 管理层有下属任务查看权，本人有仅创建、待创建、历史访问和有效负责的任务
- **THEN** 所有日历区域 SHALL 仅显示本人有效负责的正常任务且无人员切换；其他入口按自身权限可访问，负责人变化生效后 SHALL 刷新日历投影

#### Scenario: Reach sidebar creation applications and task table
- **WHEN** 用户展开侧栏、选择日期、切月/日模式、进入表单或本人申请并返回
- **THEN** 对应入口 SHALL 可用，表单返回保留模式日期；悬浮创建可点且不遮挡导航，日模式可回今天，日历无普通名称搜索或统计区

#### Scenario: Scroll across month and year boundaries
- **WHEN** 从十二月末向下浏览一月再返回，或选择远处月份继续滚动
- **THEN** 月份边界 SHALL 明确，日程无漏项或重复日内容，跨月跨度和滚动位置稳定，加载失败可重试且当前内容保留

#### Scenario: Preserve adjustable cells and complete overflow access
- **WHEN** 用户用手柄、双指或键盘调整月格高度，查看超出容量的长标题任务
- **THEN** 密度和两行标题 SHALL 可用并持久化设置，真实隐藏数和完整清单始终可达；竖滚 SHALL 不误触调高、开任务或切日

#### Scenario: Show timed cross-day midnight and point tasks
- **WHEN** 某任务从前日 20:00 到次日 10:00，另有午夜截止和零时长任务
- **THEN** 日轴 SHALL 按当天实际覆盖时段竖向绘制，午夜截止无次日副本，零时长可点且不伪造工期，定时任务不进入全天区

#### Scenario: Show more than five overlapping and all-day tasks
- **WHEN** 同时段有超过五个定时任务且另有超过五项全天任务
- **THEN** 定时任务 SHALL 全量分栏逐个可点，全天任务可逐项滚动访问，日轴可滚至 24:00；日内不以聚合替代任务，月格仍可保留容量及溢出入口

#### Scenario: Pin and color without moving time
- **WHEN** 用户置顶有标签或无标签任务并切换月/日模式
- **THEN** 月格及清单 SHALL 本人置顶优先，时间轴保持真实时段，标签色或默认粉色跨页面一致，颜色 SHALL 不是关系的唯一提示

#### Scenario: Use the required calendar entry points
- **WHEN** 用户展开侧栏、选择日期、切月/日模式、进入表单或本人申请并返回
- **THEN** 对应入口 SHALL 可用，表单返回保留模式日期；悬浮创建可点且不遮挡导航，日模式可回今天，日历无普通名称搜索或统计区

#### Scenario: Read a month and open a complete day list
- **WHEN** 用户用手柄、双指或键盘调整月格高度，查看超出容量的长标题任务
- **THEN** 密度和两行标题 SHALL 可用并持久化设置，真实隐藏数和完整清单始终可达；竖滚 SHALL 不误触调高、开任务或切日

#### Scenario: Pin only one's own ordering
- **WHEN** 用户置顶有标签或无标签任务并切换月/日模式
- **THEN** 月格及清单 SHALL 本人置顶优先，时间轴保持真实时段，标签色或默认粉色跨页面一致，颜色 SHALL 不是关系的唯一提示

#### Scenario: Split a timed cross day task
- **WHEN** 某任务从前日 20:00 到次日 10:00，另有午夜截止和零时长任务
- **THEN** 日轴 SHALL 按当天实际覆盖时段竖向绘制，午夜截止无次日副本，零时长可点且不伪造工期，定时任务不进入全天区

#### Scenario: Display every overlapping and all day task
- **WHEN** 同时段有超过五个定时任务且另有超过五项全天任务
- **THEN** 定时任务 SHALL 全量分栏逐个可点，全天任务可逐项滚动访问，日轴可滚至 24:00；日内不以聚合替代任务，月格仍可保留容量及溢出入口

#### Scenario: Switch a whole week while preserving weekday
- **WHEN** 用户在日模式按前后日期导航或竖滚时间轴
- **THEN** 导航 SHALL 按天且竖滚不改日期，不再要求整周滑动或独立周视图；一周日期行可点选当天

#### Scenario: Count mutually exclusive relationships
- **WHEN** 管理层有下属任务查看权，本人有仅创建、待创建、历史访问和有效负责的任务
- **THEN** 所有日历区域 SHALL 仅显示本人有效负责的正常任务且无人员切换；其他入口按自身权限可访问，负责人变化生效后 SHALL 刷新日历投影

#### Scenario: Open the default month view
- **WHEN** 用户进入日历
- **THEN** 默认 SHALL 为月模式且仅可在月、日切换，侧栏及日期入口可用，任务仅本人有效负责

#### Scenario: Select a year and month
- **WHEN** 用户展开侧栏、选择日期、切月/日模式、进入表单或本人申请并返回
- **THEN** 对应入口 SHALL 可用，表单返回保留模式日期；悬浮创建可点且不遮挡导航，日模式可回今天，日历无普通名称搜索或统计区

#### Scenario: Drill from month to week
- **WHEN** 点击月视图日期格
- **THEN** 系统 SHALL 打开当天完整清单，点击独立任务条仅开详情，不下钻独立周视图

#### Scenario: Ignore blank month task space
- **WHEN** 点击月格内无任务条区域
- **THEN** 系统 SHALL 打开当天完整清单，不误创建任务，独立任务条点击只开该任务

#### Scenario: Drill from week to day
- **WHEN** 用户在保留的一周日期行选择某天
- **THEN** 系统 SHALL 定位该日，日期行不是独立周视图，任务点击不同时触发日期导航

#### Scenario: Ignore blank week task space
- **WHEN** 用户点击日轴空白或在任务区竖滚
- **THEN** 系统 SHALL 不误开任务、创建、切日或切模式，周视图和整周滑动不纳入本次

#### Scenario: Switch time granularity
- **WHEN** 用户展开侧栏、选择日期、切月/日模式、进入表单或本人申请并返回
- **THEN** 对应入口 SHALL 可用，表单返回保留模式日期；悬浮创建可点且不遮挡导航，日模式可回今天，日历无普通名称搜索或统计区

#### Scenario: Keep task clicks distinct from drill-down
- **WHEN** 用户点击日程任务或日期入口
- **THEN** 任务点击 SHALL 仅开详情，日期操作按月/日导航，不误触跨月加载或月格调高

#### Scenario: Navigate and return from a week
- **WHEN** 用户通过一周日期行选日后进入详情并返回
- **THEN** 系统 SHALL 保留所选日和日模式，不新增周模式，回今天及按天导航可用

#### Scenario: Navigate and return from a day
- **WHEN** 用户展开侧栏、选择日期、切月/日模式、进入表单或本人申请并返回
- **THEN** 对应入口 SHALL 可用，表单返回保留模式日期；悬浮创建可点且不遮挡导航，日模式可回今天，日历无普通名称搜索或统计区

#### Scenario: Render a spanning task bar
- **WHEN** 某任务从前日 20:00 到次日 10:00，另有午夜截止和零时长任务
- **THEN** 日轴 SHALL 按当天实际覆盖时段竖向绘制，午夜截止无次日副本，零时长可点且不伪造工期，定时任务不进入全天区

#### Scenario: Render an all-day task
- **WHEN** 同时段有超过五个定时任务且另有超过五项全天任务
- **THEN** 定时任务 SHALL 全量分栏逐个可点，全天任务可逐项滚动访问，日轴可滚至 24:00；日内不以聚合替代任务，月格仍可保留容量及溢出入口

#### Scenario: Distinguish visible tasks
- **WHEN** 用户置顶有标签或无标签任务并切换月/日模式
- **THEN** 月格及清单 SHALL 本人置顶优先，时间轴保持真实时段，标签色或默认粉色跨页面一致，颜色 SHALL 不是关系的唯一提示

#### Scenario: Identify the current user's task relationship
- **WHEN** 管理层有下属任务查看权，本人有仅创建、待创建、历史访问和有效负责的任务
- **THEN** 所有日历区域 SHALL 仅显示本人有效负责的正常任务且无人员切换；其他入口按自身权限可访问，负责人变化生效后 SHALL 刷新日历投影

#### Scenario: Show only task names in bars
- **WHEN** 日历绘制任务卡片
- **THEN** 卡片 SHALL 优先标题及必要关系提示，月格保留最多两行截断与时间辅助信息，不塞入正文进展，详情可读全文

#### Scenario: Order visible task lanes
- **WHEN** 用户置顶有标签或无标签任务并切换月/日模式
- **THEN** 月格及清单 SHALL 本人置顶优先，时间轴保持真实时段，标签色或默认粉色跨页面一致，颜色 SHALL 不是关系的唯一提示

#### Scenario: Fill five monthly task rows
- **WHEN** 用户用手柄、双指或键盘调整月格高度，查看超出容量的长标题任务
- **THEN** 密度和两行标题 SHALL 可用并持久化设置，真实隐藏数和完整清单始终可达；竖滚 SHALL 不误触调高、开任务或切日

#### Scenario: Handle crowded time slots
- **WHEN** 同时段有超过五个定时任务且另有超过五项全天任务
- **THEN** 定时任务 SHALL 全量分栏逐个可点，全天任务可逐项滚动访问，日轴可滚至 24:00；日内不以聚合替代任务，月格仍可保留容量及溢出入口

#### Scenario: Open overflow tasks for one date
- **WHEN** 用户用手柄、双指或键盘调整月格高度，查看超出容量的长标题任务
- **THEN** 密度和两行标题 SHALL 可用并持久化设置，真实隐藏数和完整清单始终可达；竖滚 SHALL 不误触调高、开任务或切日

#### Scenario: Preserve calendar navigation after table return
- **WHEN** 用户展开侧栏、选择日期、切月/日模式、进入表单或本人申请并返回
- **THEN** 对应入口 SHALL 可用，表单返回保留模式日期；悬浮创建可点且不遮挡导航，日模式可回今天，日历无普通名称搜索或统计区

### Requirement: Authorized task table page
系统 SHALL 从视图提供“任务表单”二级页面，使用一行一项任务、表头与网格对齐的表格展示本人当前全部授权正常任务。表格 SHALL 支持纵向及窄屏横向滚动，并使表头、任务名称、返回和分页操作可定位及操作。每项 SHALL 显示任务名称、本人关系、有序负责人、原创建者、创建时间、说明、历史任务已有的完成标准（新建无此字段）、开始/截止日期时间、全天标记、执行状态、是否完成、紧急程度、进展备注、当前待审类型/冻结、逾期标记及有权查看的上级任务；长文本可预览并从详情查看全文，全天 SHALL 不伪造时刻，无权父任务 SHALL 不泄露标识或标题。

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

#### Scenario: Prioritize mobile columns without changing the data pipeline
- **WHEN** 手机打开任务表单横向浏览，再筛选、排序、计数或分页
- **THEN** 首屏 SHALL 优先任务识别及主要处理信息，低优先级详情靠右仍完整可达，表头行对应、详情易点；筛选排序计数 SHALL 基于完整授权结果后再分页，本人创建且负责分别计数但行不重复

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
- **THEN** 任务 SHALL 仍可在我创建范围找到，且从月/日、全天、跨日条及当日列表全部消失，未批准的负责人提议 SHALL 不提前改变结果

#### Scenario: Revoke all normal access
- **WHEN** 本人正常任务授权被收回但仍保有历史通知，随后刷新或打开旧详情
- **THEN** 普通表单、搜索和计数 SHALL 不含该任务，普通详情 SHALL 拒绝；通知专用只读详情 SHALL 不把任务重新加入列表

#### Scenario: Fail a later page and retry
- **WHEN** 完整任务读取第二页失败，或首次读取结果为空，或条件过滤结果为空
- **THEN** 第二页失败 SHALL 显示可重试错误且不声明部分统计；后两种 SHALL 分别显示无任务和无筛选结果，清空条件 SHALL 可用

#### Scenario: Ignore stale account and refresh responses
- **WHEN** 旧账号或较早刷新尚未完成时切换账号或开始新刷新，旧响应随后返回
- **THEN** 系统 SHALL 只展示当前账号最新有效查询结果，旧行、条件、返回上下文及迟到响应 SHALL 不污染新会话

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
任何本公司有效员工创建及重提创建申请时 SHALL 可选择本公司全部有效员工，包括其他部门、直属上级和创始人；候选、提交及批准检查 SHALL 一致，不受旧角色、同团队或旧创建派发配置限制。独立管理员、失效及跨公司人员 SHALL 不作为员工候选。部门 SHALL 使用真实部门，选人 SHALL 支持部门和姓名搜索、有序多选、跨部门保留、确认及取消还原。

下层创建初始负责人 SHALL 为本人，中上层 SHALL 初始为空；用户可移除本人且不自动加回，提交仍至少一位有效负责人。创建审核 SHALL 按创建人及其直属上级规则，不按负责人管理链。需审创建批准前 SHALL 不发布，批准或有理由免审后 SHALL 发布为待开始。候选扩大 SHALL 不授予手机号、日志、全部任务或管理员查看权，不扩大专用交接等非创建权限。

#### Scenario: Assign across departments and upward
- **WHEN** 普通员工给同事、其他部门、直属上级或创始人创建任务
- **THEN** 候选与提交 SHALL 允许本公司有效员工并按创建人直属关系审核，跨公司和失效人员 SHALL 拒绝

#### Scenario: Remove the creator and preserve selection order
- **WHEN** 用户移除初始本人、仅选其他员工并换序或取消选择
- **THEN** 系统 SHALL 不强制加回本人，确认后回读保留顺序、取消还原；中上层初始为空，空列表提交 SHALL 拒绝

#### Scenario: Keep dispatch separate from unrelated access
- **WHEN** 用户选择公司任意员工后访问其手机号、日志、其他任务或提交交接
- **THEN** 系统 SHALL 继续按各对象权限裁决，不因候选可选扩权

#### Scenario: Isolate an unpublished creation
- **WHEN** 需审创建尚未通过、被拒绝、撤销或失效
- **THEN** 任务 SHALL 仅供原申请人跟踪及本次审核人处理，不进入正常列表、日历、首页、搜索、计数和分析；通过或合法免审后才发布

#### Scenario: Select and order authorized assignees
- **WHEN** 用户移除初始本人、仅选其他员工并换序或取消选择
- **THEN** 系统 SHALL 不强制加回本人，确认后回读保留顺序、取消还原；中上层初始为空，空列表提交 SHALL 拒绝

#### Scenario: Enforce dispatch independently from viewing
- **WHEN** 用户选择公司任意员工后访问其手机号、日志、其他任务或提交交接
- **THEN** 系统 SHALL 继续按各对象权限裁决，不因候选可选扩权

#### Scenario: Executive selects assignees across departments
- **WHEN** 普通员工给同事、其他部门、直属上级或创始人创建任务
- **THEN** 候选与提交 SHALL 允许本公司有效员工并按创建人直属关系审核，跨公司和失效人员 SHALL 拒绝

#### Scenario: Manager assigns a departmental task
- **WHEN** 普通员工给同事、其他部门、直属上级或创始人创建任务
- **THEN** 候选与提交 SHALL 允许本公司有效员工并按创建人直属关系审核，跨公司和失效人员 SHALL 拒绝

#### Scenario: Cancel assignee selection
- **WHEN** 用户移除初始本人、仅选其他员工并换序或取消选择
- **THEN** 系统 SHALL 不强制加回本人，确认后回读保留顺序、取消还原；中上层初始为空，空列表提交 SHALL 拒绝

#### Scenario: Search for an unavailable assignee
- **WHEN** 用户搜索不存在、失效或跨公司员工
- **THEN** 候选 SHALL 不提供该人员且有空态，直接提交也拒绝；本公司其他部门、上级及创始人不再因旧角色或范围被排除

#### Scenario: Employee submits a self-created task
- **WHEN** 下层为本人创建任务或移除本人另选他人
- **THEN** 初始 SHALL 选本人但允许移除，至少一位有效负责人；审核按创建人直属上级，无上级留因免审，待审不进入正常区域

#### Scenario: Superior reviews a self-created task
- **WHEN** 当前指定创建审核人批准或拒绝创建
- **THEN** 批准 SHALL 发布为待开始，拒绝保留结果并允许原申请人调整重提，不发布执行任务

### Requirement: Task structure and attributes
任务 SHALL 展示标题、说明、原创建者、独立创建时间、有序多负责人、起止排期、全天、紧急/高/中/低紧急程度、离散执行状态、文字进展、可选父任务、审核人及意见。系统 SHALL 不提供抽象任务类型、百分比进度或进度条；父子任务独立执行，父状态不由子任务自动改变或计算百分比。父任务搜索 SHALL 按名称在当前正常可见且无环候选中匹配、允许清空，并独立检查关联详情权限。定时任务 SHALL 使用精确时刻，全天只填写日期且首尾均包含，截止不得早于开始；转交、排期修改与重开 SHALL 不改变原创建者或创建时间。

创建和创建申请重提 SHALL 移除完成标准输入及必填校验，未提供该字段可正常提交；历史完成标准 SHALL 保留展示、合法编辑及审计，不因新建移除而清空。说明区及历史任务仍存在的完成标准编辑区 SHALL 保持至少 234px 最小高度，窄屏其他字段与提交可达。

#### Scenario: Edit task text in expanded fields
- **WHEN** 用户在构建后的实际页面创建或编辑任务
- **THEN** 创建 SHALL 无完成标准输入及必填要求，说明区和历史任务仍存在的完成标准编辑区至少 234px 高，历史内容保留，窄屏其他字段和保存提交可达

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

#### Scenario: Choose time through a mobile web control
- **WHEN** 手机浏览器内创建、编辑、重开非全天任务，选时分、取消、弹出键盘或切换全天
- **THEN** Web SHALL 统一提供直观时分输入选择，不触发系统大表盘，取消保留草稿且不误提交，跨日、全天、校验和提交值正确；套壳资源同步、容器适配及实际 WebView 验收 SHALL 由接手人另行负责

### Requirement: Task editing and completion review
仅原创建者 SHALL 可申请修改基础信息及重开已完成任务；当前负责人仅可申请每次新增/修改文字进展与完成；专用交接仅依交接要求开放。有审核人的创建、修改、每次进展、完成、重开及交接 SHALL 先待审，同任务唯一待审并冻结其他任务业务变更（有当前正常访问权者的独立评论除外），只有申请人能撤销；修改提议须先撤销再重提。普通区域 SHALL 保留原有效版本，申请人可看自己提交的内容/状态/结果，只有本次审核人可获得原版与提议的专用 diff，不能靠前端隐藏代替字段裁剪。

执行状态 SHALL 为待开始/进行中/已完成，与待审/通过/拒绝或退回/撤销/失效分开。首次进展批准后待开始变进行中；完成通过变已完成、退回变进行中且须意见、撤销恢复提交前状态；创建者重开可一并提出完整有效排期，通过回到进行中并增加轮次，拒绝/撤销保留已完成。普通修改或进展拒绝/撤销 SHALL 保留原版；待审到期按失效要求保留提交前状态并解冻。

#### Scenario: Freeze and cancel an application
- **WHEN** 多名负责人同时提交进展/完成，或非申请人尝试撤销
- **THEN** 系统 SHALL 最多产生一个待审并冻结其他任务业务变更（独立评论除外），只有申请人可撤销，原创建者或审核人 SHALL 不能替他撤销

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

#### Scenario: Render authorized field-by-field differences in saved order
- **WHEN** 本次审核人打开仅负责人换序或多字段变更申请
- **THEN** 页面 SHALL 使用后端授权逐项差异展示前后值及有序负责人，不把换序视为无变化；创建换序不描述为改变创建审核人，申请人及旁观者不因展示扩权

#### Scenario: Reopen an overdue completed task from the web form
- **WHEN** 原创建者对旧截止已过的已完成任务填写重开原因及全天/非全天完整未来排期
- **THEN** Web SHALL 一并提交排期并按非创建路线审核，通过则新排期、进行中和新轮次生效且提醒按新轮次排期去重，拒绝撤销失效保留原已完成状态及有效排期

#### Scenario: Resubmit an expired creation as a new request
- **WHEN** 失效创建的原申请人选择修改并重提并调整排期
- **THEN** 页面 SHALL 清楚展示失效及原提议，提交建立新申请并重算创建路线，旧申请保持失效；他人、重复并发重提及旧审核按钮不能复活旧申请或多次生效

### Requirement: Required notifications
系统 SHALL 由真实业务事件产生站内通知，覆盖审核提交/结果、创建生效、基础信息/紧急程度/进展/状态/完成/重开/交接生效、改派、临期、逾期及失效，不用静态样例代替。待创建及未发布结果 SHALL 仅向申请人和对应审核人；已发布任务申请提交 SHALL 只通知本次审核人，申请人可跟踪，不提前告知其他任务人员或提议负责人。已发布结果 SHALL 面向申请人、审核人及相关任务人员，生效通知 SHALL 向创建者与当前全体负责人；负责人变更还 SHALL 包含新增及被移除人。提醒 SHALL 向创建者与当前负责人。同次多字段更改 SHALL 一条消息汇总实际变化，保留任务标题、事件、时间及原申请绑定；同事件多身份去重且不排除本人；独立评论通知 SHALL 按评论专用矩阵去重并排除评论者本人。系统推送属于正式要求但本次延期，不得将站内投递声明为系统推送通过。

通知列表 SHALL 同时直接展示事件用途、对象名称和具体可读摘要，区分待审核与一般告知并说明本人待处理动作，手机长标题不遮掉用途。撤回、屏蔽或权限变化 SHALL 不从原始载荷恢复受限内容。

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

#### Scenario: Understand the event without opening its detail
- **WHEN** 查看派发、待审核、进展、完成、退回或逾期通知
- **THEN** 列表 SHALL 同时说明用途、任务名及实际摘要，待审核动作可辨；受限内容按可见边界裁剪，不由前端重建

### Requirement: Personal work logs
日志 SHALL 归作者并按公司业务日期同人同日唯一，新建允许公司今天、昨天、前天，不允许更早或未来；已有所选日期未冻结日志 SHALL 打开编辑。日志创建后 SHALL 不改业务日期。冻结 SHALL 为真实首次创建时间加 24 小时，编辑不重置计时，服务端达到冻结点立即只读，跨零点不提前冻结。编辑和删除 SHALL 仅作者且共用该窗口，删除重建 SHALL 不重置首次创建时间或清除同人同日冻结约束。

前后端 SHALL 一致显示可编辑性、冻结时间和重复/到期反馈，旧页面到期提交及并发 SHALL 不绕过限制；存量日志保留真实创建时间，冻结和他人日志不显示正文编辑/删除。新建编辑 SHALL 保留全屏表单、伸展正文和可达保存/返回/关闭，离开恢复其他弹层布局。

日志 SHALL 可选关联一项作者当前正常可见任务，支持名称搜索、空结果和清空，关联详情独立鉴权。上层看公司、中层本人及直属下属、下层本人，上级不能编辑正文，同团队/同任务不授予日志权；关联任务失权 SHALL 裁剪跳转但保留有权正文。标签 SHALL 同受日志编辑冻结规则，独立评论按评论要求处理。

#### Scenario: Backfill three dates with a full window
- **WHEN** 今天创建昨天或前天日志且设备与公司时区不同
- **THEN** 日期范围 SHALL 按公司时区判断，日志从真实创建获得 24 小时窗口，三天之外和未来日期 SHALL 拒绝

#### Scenario: Freeze after twenty-four hours instead of midnight
- **WHEN** 昨晚创建日志跨零点但未满 24 小时，随后服务端到达冻结点
- **THEN** 作者前一时刻 SHALL 可编辑删除，到期立即只读且旧页面提交被拒，编辑 SHALL 不延后冻结

#### Scenario: Preserve the daily slot under concurrency and deletion
- **WHEN** 同人同日以不同幂等键并发新建，或窗口内删除重建后跨冻结点重试
- **THEN** 系统 SHALL 最多一篇活动日志且重复反馈明确，重建沿用首次创建时间，冻结后 SHALL 不能重建、编辑或删除绕过

#### Scenario: Preserve full-screen editing and independent links
- **WHEN** 作者全屏写日志、查找清空关联任务、上级阅读或迁移存量数据
- **THEN** 正文和真实创建时间 SHALL 保留，无权关联不泄露信息，上级无正文写权，全屏及退出布局正常

#### Scenario: Write and edit a log in a full-screen sheet
- **WHEN** 作者全屏写日志、查找清空关联任务、上级阅读或迁移存量数据
- **THEN** 正文和真实创建时间 SHALL 保留，无权关联不泄露信息，上级无正文写权，全屏及退出布局正常

#### Scenario: Enforce one log under concurrent distinct keys
- **WHEN** 同人同日以不同幂等键并发新建，或窗口内删除重建后跨冻结点重试
- **THEN** 系统 SHALL 最多一篇活动日志且重复反馈明确，重建沿用首次创建时间，冻结后 SHALL 不能重建、编辑或删除绕过

#### Scenario: Freeze across the midnight boundary
- **WHEN** 昨晚创建日志跨零点但未满 24 小时，随后服务端到达冻结点
- **THEN** 作者前一时刻 SHALL 可编辑删除，到期立即只读且旧页面提交被拒，编辑 SHALL 不延后冻结

#### Scenario: Link, clear or redact tasks independently
- **WHEN** 作者全屏写日志、查找清空关联任务、上级阅读或迁移存量数据
- **THEN** 正文和真实创建时间 SHALL 保留，无权关联不泄露信息，上级无正文写权，全屏及退出布局正常

#### Scenario: Search and link a visible task
- **WHEN** 作者按名称查找日志关联任务
- **THEN** 系统 SHALL 仅返回当前正常有权任务，搜索空结果明确，关联详情独立鉴权

#### Scenario: Clear a linked task
- **WHEN** 未冻结作者清除日志关联
- **THEN** 系统 SHALL 允许无关联并保留正文，冻结后拒绝修改，清除不重置创建与冻结时间

#### Scenario: Show no matching linked tasks
- **WHEN** 日志关联任务搜索无匹配
- **THEN** 系统 SHALL 显示空态且允许不关联，不能泄露无权任务

#### Scenario: Write an unlinked log
- **WHEN** 作者在公司近三天某日新建不关联任务的日志
- **THEN** 系统 SHALL 保存唯一同日日志，不强制关联，自真实首次创建起 24 小时冻结

#### Scenario: Superior reads a subordinate log
- **WHEN** 中层查看直属下属日志
- **THEN** 系统 SHALL 允许按日志权限只读正文，不用同部门/同团队代替直属关系，关联任务独立鉴权；评论另按正常查看权开放

### Requirement: Log page single-content filtering and scroll return
日志功能的 Web 导航、标题、首页和相关入口 SHALL 统一称“日志”，不再以“记录”或“工作记录”指代该功能。日志页 SHALL 只写看日志，进入和切换账号默认本人，不混入任务创建、审核、申请或请示，回顶保留有效筛选。

作者筛选 SHALL 部门→团队→个人联动，每层可名称搜索，候选、结果、计数先受当前日志权限过滤。切换部门或团队 SHALL 清理不匹配下级选择，保留有效输入和空态；同名人员可用组织信息区分，无团队人员可查找。本人和范围内全部 SHALL 可选；可看他人不授予正文编辑，组织/账号变化重验条件，不复用旧账号数据。

#### Scenario: Search each hierarchy within authorization
- **WHEN** 用户依次搜索部门、团队、同名人员及无团队员工
- **THEN** 各层 SHALL 只返回日志授权范围，能准确选择，搜索与计数一致，选他人不获得正文编辑权

#### Scenario: Reset invalid children and restore self
- **WHEN** 选择个人后切部门/团队、回顶或换账号
- **THEN** 不匹配下级 SHALL 清理，回顶保留有效条件，换账号默认本人且无旧数据，并能选择范围内全部

#### Scenario: Use consistent names and the selected log date
- **WHEN** 用户从导航或首页写日志
- **THEN** 文案 SHALL 统一为日志，可选公司近三天并打开该日未冻结已有日志；任务申请和审核仍从视图与通知进入

#### Scenario: Enter with self and filter a direct report
- **WHEN** 用户依次搜索部门、团队、同名人员及无团队员工
- **THEN** 各层 SHALL 只返回日志授权范围，能准确选择，搜索与计数一致，选他人不获得正文编辑权

#### Scenario: Return to the top without mixing workflows
- **WHEN** 选择个人后切部门/团队、回顶或换账号
- **THEN** 不匹配下级 SHALL 清理，回顶保留有效条件，换账号默认本人且无旧数据，并能选择范围内全部

#### Scenario: Enter the log page
- **WHEN** 用户从导航或首页写日志
- **THEN** 文案 SHALL 统一为日志，可选公司近三天并打开该日未冻结已有日志；任务申请和审核仍从视图与通知进入

#### Scenario: Select pending reviews
- **WHEN** 用户寻找待我审核事项
- **THEN** 审核 SHALL 从通知中心进入，日志不混合待审标签

#### Scenario: Switch between role-specific content filters
- **WHEN** 用户依次搜索部门、团队、同名人员及无团队员工
- **THEN** 各层 SHALL 只返回日志授权范围，能准确选择，搜索与计数一致，选他人不获得正文编辑权

#### Scenario: Invoke a log-page command
- **WHEN** 用户从导航或首页写日志
- **THEN** 文案 SHALL 统一为日志，可选公司近三天并打开该日未冻结已有日志；任务申请和审核仍从视图与通知进入

#### Scenario: Toggle own logs
- **WHEN** 选择个人后切部门/团队、回顶或换账号
- **THEN** 不匹配下级 SHALL 清理，回顶保留有效条件，换账号默认本人且无旧数据，并能选择范围内全部

#### Scenario: Restore the visible log scope
- **WHEN** 选择个人后切部门/团队、回顶或换账号
- **THEN** 不匹配下级 SHALL 清理，回顶保留有效条件，换账号默认本人且无旧数据，并能选择范围内全部

#### Scenario: Search logs by author
- **WHEN** 用户依次搜索部门、团队、同名人员及无团队员工
- **THEN** 各层 SHALL 只返回日志授权范围，能准确选择，搜索与计数一致，选他人不获得正文编辑权

#### Scenario: Show no matching authors
- **WHEN** 逐层名称搜索没有授权匹配人员
- **THEN** 系统 SHALL 显示明确空态并保留有效输入，不用无权人员填充结果

#### Scenario: Keep log finding separate and scoped
- **WHEN** 用户回顶并寻找日志作者或任务操作
- **THEN** 回顶 SHALL 保留有效日志筛选，作者查找受日志权限限制，任务创建申请在视图、审核在通知

#### Scenario: Return to the top of log content
- **WHEN** 选择个人后切部门/团队、回顶或换账号
- **THEN** 不匹配下级 SHALL 清理，回顶保留有效条件，换账号默认本人且无旧数据，并能选择范围内全部

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
本变更 SHALL 以《潘多拉 Web 与管理端代码修改清单》（2026-10-25）及本轮用户范围确认为需求和验收依据；新 PRD 尚未发布，V3 章节号 SHALL 仅用于追溯，冲突处 SHALL 按清单执行。未覆盖的已确认行为 SHALL 保留，非创建审核 SHALL 按本规格明确保留的规则执行。范围 SHALL 为员工 Web、独立 PC 管理端及必需的后端、数据和演示准备；Android 套壳资源同步、容器适配、安装包及设备交付 SHALL 由其他人员另行负责，不属于本 change 的实施及验收范围。

系统 SHALL 使用真实认证、持久化及事件调度验收，保留五个主页面、任务表单二级页、个人置顶、冲突建议和账户维护。旧 Android Web 套壳和安卓原生新版工程及其 UI/APK、系统推送、Android WebView/真机验收 SHALL 不纳入本次修改。时间选择业务控件 SHALL 使用 Web 实现并在移动浏览器验收；套壳未交付 SHALL 不作为本 change 完成或归档的前置阻塞，Web 证据 SHALL 不代表套壳或真机验证通过。请示回复、完整账号启停、一人多团队、任务私人草稿、任务取消、公司草稿/定时发布、日志转待办、外部模型与 MBTI SHALL 继续不纳入本轮。

#### Scenario: Validate against the selected checklist
- **WHEN** 实施者或验证者检查本变更
- **THEN** 验收 SHALL 使用清单和本增量规格，不能要求旧周视图、受限创建派发或午夜冻结，也不能宣称尚未发布的新 PRD 已通过；静态示例、旧报告及任务勾选 SHALL 不替代当前真实服务证据

#### Scenario: Keep native Android outside the change
- **WHEN** 检查修改文件和交付记录
- **THEN** `android/` 和 `android-shell/` SHALL 均不在修改范围，资源同步、容器/桥接适配、APK 构建签名、升级及设备验证 SHALL 交由其他人员另行负责；共用后端兼容影响 SHALL 如实记录，不将移出范围的事项标为已交付或已验证

#### Scenario: Validate the real service and declared scope
- **WHEN** 实施者或验证者检查本变更
- **THEN** 验收 SHALL 使用清单和本增量规格，不能要求旧周视图、受限创建派发或午夜冻结，也不能宣称尚未发布的新 PRD 已通过；静态示例、旧报告及任务勾选 SHALL 不替代当前真实服务证据

#### Scenario: Inspect available actions
- **WHEN** 实施者或验证者检查本变更
- **THEN** 验收 SHALL 使用清单和本增量规格，不能要求旧周视图、受限创建派发或午夜冻结，也不能宣称尚未发布的新 PRD 已通过；静态示例、旧报告及任务勾选 SHALL 不替代当前真实服务证据

#### Scenario: Open the split static prototype
- **WHEN** 从文件系统打开旧静态页面或直接读取未构建脚本
- **THEN** 验收 SHALL 使用真实服务、认证、持久化及事件路径，静态内容不视为通过，本次按清单而非未发布 PRD 判定

### Requirement: Organization and administration
系统 SHALL 提供独立 PC 浏览器 Web 管理端（`/admin.html`）维护员工、部门、职位、团队、上下级、角色及独立任务查看权限和非创建操作所需授权（创建候选按全公司有效员工规则），并查询全量任务操作历史、管理通知。员工部门和职位必填，一人一个主部门、至多一个团队、一位直属上级，组织顶层除外。部门与团队独立；获授权的部门负责人可创建团队，创建者默认负责且可转交。组织关系 SHALL 无环且不跨公司引用，组织位置不得由职位名称或负责人保存顺序推断。公司仅有一个管理员账号，管理员身份不自动取得员工派发、审核、日志或分析权。

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

#### Scenario: Manage teams from a restricted employee web entry
- **WHEN** 获授权部门负责人在员工 Web 创建团队或转交负责人
- **THEN** 页面 SHALL 不依赖读取完整管理员组织数据或登录 PC 控制台，创建者默认负责，转交限授权部门；无授权及越权接口请求被拒，团队负责人不自动扩业务权限

#### Scenario: Manage notifications in the formal PC console
- **WHEN** 管理员在正式通知栏目查询接收、已读、撤回和保留期并执行撤回
- **THEN** 页面 SHALL 使用真实管理接口，严格少于 180 秒才可撤回，说明不撤销任务申请且不删历史；普通员工直连拒绝，受限上级原内容只读不恢复跳转审核

### Requirement: Account password lifecycle
账号 SHALL 由管理员手动创建，不开放自助注册；员工使用本人手机号登录，独立管理员保留原登录方式。手机号 SHALL 统一规范化并在认证可识别范围唯一，不得歧义登录；迁移保留员工 ID、原凭据、任务日志及组织关系，不以新建任意账号替代。管理员建号和本人/管理员合法改号 SHALL 同步登录标识，空号与重复号有明确处理反馈。系统 SHALL 生成随机初始密码并强制首次改密；管理员重置密码 SHALL 再次强制改密。新密码 SHALL 至少 10 个字符、含字母与数字且 UTF-8 长度不超过 72 字节。强制改密会话 SHALL 仅可办理本人改密及退出，不能读取或修改业务数据；日常改密 SHALL 校验旧密码，成功后撤销包括当前会话在内的全部会话并要求重新登录。管理员 SHALL 可录入/覆盖员工手机号，但不得通过管理响应、目录或审计回显他人手机号；本人继续可编辑姓名、邮箱、手机号。

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

#### Scenario: Authenticate the original employee by phone after migration
- **WHEN** 存量员工以手机号及原密码登录，之后合法改号
- **THEN** 登录 SHALL 始终对应原员工 ID 和业务关系，新手机号可登录，旧手机号不再作为其员工登录标识，重复手机号被拒；独立管理员原登录方式仍可用

#### Scenario: Do not publish phone identifiers as usernames
- **WHEN** 读取普通目录、创建候选、日志筛选或通知
- **THEN** 手机号 SHALL 不因成为登录标识而作为公开用户名泄露，手机号邮箱继续遵守资料详情隐私规则

### Requirement: Ordered reviewer routing and reassignment
创建及创建申请重提 SHALL 按原创建人路由：创始人创建免审，其他员工有直属上级由该上级审核，确实无直属上级则记录原因直接生效，不强制自审。创始人 SHALL 按本公司员工组织树唯一根节点判定，独立管理员、其他 upper 身份或组织数据缺失的孤立人员 SHALL 不自动成为创始人。已配置上级不存在、失效、不可审核、跨公司或关系有环 SHALL 阻断并提示修复或恢复可用，不跨级、不走负责人路线、不解释为无上级免审。

创建负责人换序、更换或跨部门 SHALL 不改变创建审核依据；各操作预览、提交、详情、通知及审核入口 SHALL 展示实际审核人或免审原因。提交和决定 SHALL 重验当前组织关系，不能复用旧预览当权限。创建待审的直属关系变化 SHALL 重算创建人当前直属上级并留痕，旧审核人失权；已配置上级不可用时 SHALL 保持阻断，不自动上溯。

非创建的基础修改、进展、完成、重开、交接 SHALL 保留有序负责人路由：选组织位置最高者、同层保存顺序首位，沿唯一管理链找有效直属审核人，不可承接继续上溯，无可用上级以可承接原创建者兜底，确无审核人才留因生效；损坏链 SHALL 阻断。负责人修改与交接 SHALL 按提议负责人，其余非创建按有效负责人。有审核人 SHALL 明确决定，即使申请人与审核人为同一人。组织变化后非创建改派 SHALL 按原规则重算，记录前后审核人、原因与时间并更新通知。

#### Scenario: Preview all creator-based routes
- **WHEN** 创始人、确无上级员工及有上级普通员工创建，普通员工分别给本人、同事、直属上级或创始人派发
- **THEN** 前两类 SHALL 显示并记录对应免审原因，后四种一律由创建人直属上级审核；负责人换序 SHALL 不改变创建路线

#### Scenario: Block an unavailable configured manager
- **WHEN** 已配置直属上级失效、不可审核、缺失、跨公司或关系损坏
- **THEN** 创建或决定 SHALL 返回可识别阻断及修复提示，不跨级、不自审、不免审

#### Scenario: Revalidate after an organization change
- **WHEN** 预览后或待审期间创建人的直属关系变化
- **THEN** 系统 SHALL 按当前创建关系裁决、同步详情和通知并留存路由原因，旧审核人不能凭旧页面决定

#### Scenario: Preserve ordered non-creation routes
- **WHEN** 非创建操作中同层最高负责人换序、修改负责人或交接
- **THEN** 系统 SHALL 按有效/提议负责人及同层保存顺序计算，保留上溯、创建者兜底与改派，换序影响 SHALL 正确展示

#### Scenario: Require explicit non-creation self-review
- **WHEN** 进展、完成、重开或修改的实际审核人恰为申请人或创建者
- **THEN** 系统 SHALL 产生唯一待审并等明确决定，页面不显示创建免审的误导提示

#### Scenario: Persist order and route the first highest peer
- **WHEN** 非创建操作中同层最高负责人换序、修改负责人或交接
- **THEN** 系统 SHALL 按有效/提议负责人及同层保存顺序计算，保留上溯、创建者兜底与改派，换序影响 SHALL 正确展示

#### Scenario: Review one's own application explicitly
- **WHEN** 进展、完成、重开或修改的实际审核人恰为申请人或创建者
- **THEN** 系统 SHALL 产生唯一待审并等明确决定，页面不显示创建免审的误导提示

#### Scenario: Change assignees using the proposed route
- **WHEN** 非创建负责人修改或交接提议从甲链换至乙链
- **THEN** 预览提交详情通知决定 SHALL 按提议有序负责人指定乙链审核人，甲链不能批准，未通过保留原版；创建审核仍按创建人而非乙链

#### Scenario: Fall back or apply with a documented reason
- **WHEN** 非创建依据人管理链无有效上级，或创建人确无直属上级
- **THEN** 非创建 SHALL 保留可承接原创建者兜底及有审核人显式决定，确无审核人留因生效；创建按无直属上级免审，不把已配置不可用上级视为无上级

#### Scenario: Reassign after organization changes
- **WHEN** 待审期间组织关系变化导致审核人变化或不可用
- **THEN** 创建 SHALL 只按创建人当前直属上级重算，不可用阻断；非创建按原链上溯/兜底重算，两者均留痕更新通知且旧审核人失权

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
通知 SHALL 绑定自己的事件和业务对象，任务业务通知还须绑定任务及适用原申请，评论通知绑定其任务或日志和评论；打开即已读并同步未读数；原申请办结 SHALL 置灰展示其结果且无有效审核按钮，不得转向同任务后续申请。本人删除仅影响本人副本。通知 SHALL 自事件产生时刻起保留三个公司时区日历月，月末截到目标月最后一天，到期时不再可用。业务发起人及有通知管理权的管理员 SHALL 仅在事件产生后严格少于 180 秒时撤回，自动提醒仅管理员可管理；撤回保留提示并移除跳转，普通接收人移除正文，不改变业务、申请或审计；下述受限上级原内容只读例外 SHALL 独立适用。

已送达、未删除、未撤回且未到期通知的原接收人，在失去当前任务权限后 SHALL 仍可读取保留标题/摘要并从该通知进入当前已生效任务的专用只读详情，展示关系/授权撤销提示。此例外 SHALL 不开放提议、diff、受限关联、手机号、他人日志或任何业务操作，不加入正常列表、搜索、计数、首页或分析。未送达消息 SHALL 不因候选接收人记录而授予例外。

通知列表 SHALL 不显示底部刷新/关闭操作栏，并保留头部关闭入口；键盘 Tab 焦点范围 SHALL 包含头部关闭按钮，空列表也 SHALL 可关闭。此列表布局 SHALL 不改变消息详情的业务操作及自动已读要求。

原消息接收人若为业务发起人当前实际管理链上级，且其副本送达时未屏蔽、未个人删除、未过期，撤回后 SHALL 可只读原标题、摘要及变更摘要并显示原因；其他上层、同级、其他管理链或仅管理员身份不因此获员工通知原文。该例外 SHALL 不开放任务/申请跳转、审核、完整载荷、受限提议或手机号，也不得补回送达屏蔽内容。

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
- **THEN** 删除 SHALL 不影响他人副本；撤回 SHALL 对普通接收人移除正文、所有副本移除跳转并保留提示，受限上级仅按专用例外只读原内容；两者 SHALL 不修改任务结果、申请状态及管理历史

#### Scenario: Retain access solely through a delivered notification
- **WHEN** 原接收人被移出负责人/收回授权但仍保有送达消息
- **THEN** 消息标题及实际变更摘要 SHALL 保留，专用入口 SHALL 仅展示有效任务且提示只读；普通详情及所有当前范围查询 SHALL 继续拒绝或排除该任务

#### Scenario: End the exception and block undelivered access
- **WHEN** 消息被个人删除、全事件撤回或到期，或普通事件的任务授权在通知送达前已被撤销
- **THEN** 系统 SHALL 拒绝通过该消息取得历史详情，不因知晓消息/任务/事件 ID 扩权，也不阻止拥有正常权限者从正常入口查看

#### Scenario: Preserve restricted manager access to withdrawn summaries
- **WHEN** 发起人当前管理链上级作为未屏蔽原接收人查看未删除未过期的撤回消息
- **THEN** 页面 SHALL 说明已撤回及只读原因，仅展示允许原标题摘要变更摘要，无任务申请跳转或审核；失去当前管理链资格、送达已屏蔽或消息删除过期不能恢复原文

### Requirement: Complete task operation history
管理端 SHALL 可按任务追溯具体字段前后值、有序负责人变化、申请/版本、申请人与审核人、决定意见、改派、失效、交接、完成、重开和无需审核原因。App SHALL 仅展示当前有效资料、有效进展、相关申请及审核意见，不开放完整历史。通知删除/撤回/清理 SHALL 不删除业务历史，历史 SHALL 不包含密码或他人手机号。

#### Scenario: Inspect an ordered assignee change and reassignment
- **WHEN** 管理员查询一个发生负责人换序、改派、失效和交接的任务
- **THEN** 系统 SHALL 展示每次实际变动、前后人选、时间、原因及结果，而非仅事件类型和 ID；App 用户 SHALL 不能查询完整历史

#### Scenario: Retain history after message removal
- **WHEN** 关联消息删除、撤回或到期清理
- **THEN** 全部任务操作记录 SHALL 继续可查，已生效状态 SHALL 保持

#### Scenario: Locate a task in the formal PC history interface
- **WHEN** 管理员从正式任务历史栏目查找或定位任务，不借助调试页
- **THEN** 页面 SHALL 完整展示时间、操作人、字段前后值、有序负责人、申请决定意见、改派、失效、交接、重开和免审原因；普通员工接口访问被拒

### Requirement: Shared single-select tags for tasks and logs
任务和日志 SHALL 共用本公司标签目录，每对象可不选或只选一个，选新替换旧，前后端拒绝多标签及跨公司引用。只有公司员工组织树唯一根节点创始人 SHALL 从员工 Web“我的→标签管理”创建、改名、从预定义色板选色和删除，不要求管理员身份；其他员工只能在有对象编辑权时选择清除，其他上层和仅管理员不得维护。任务标签 SHALL 随原审核及有效版规则，日志标签随原编辑及冻结规则。

日志列表 SHALL 显示标签，任务/日志详情显示“背景色＋内容”药丸，日程直接用唯一标签背景；无标签任务统一默认粉色非白底，该粉色不入标签色板，文字可读。改名改色 SHALL 更新当前引用但不重写既有审计。删除 SHALL 逻辑删除、禁止新引用，已有引用保留删除时名称颜色并标“已删除”，有权编辑可清除替换，不级联删除任务、日志或历史。

#### Scenario: Enforce root-only maintenance and single selection
- **WHEN** 创始人及其他员工或管理员维护标签，或一次提交多个标签
- **THEN** 仅唯一组织根节点 SHALL 有维护入口与接口权限，多标签和越权维护拒绝，合法单选刷新后持久且任务日志共用

#### Scenario: Rename recolor and delete a referenced tag
- **WHEN** 标签改名改色后删除且仍被业务引用
- **THEN** 当前引用 SHALL 随更新，删除后保留删除时值及标记，候选移除且新关联拒绝，历史和业务对象不被清除

#### Scenario: Respect review freezing and calendar color
- **WHEN** 用户改需审任务标签、改冻结/他人日志标签或查看无标签任务
- **THEN** 任务标签 SHALL 批准后才生效，冻结/越权日志拒绝，无标签粉色与色板区分，跨页面颜色及名称一致

### Requirement: Flat comments with author control and targeted notifications
有对象当前正常查看权者 SHALL 可在任务和日志详情底部读取、发表平铺评论，显示作者、发表时间和正文，按发表时间顺序稳定分页；评论直接属于对象，不支持楼中楼、子评论或回复层级。作者在仍有对象正常访问权时 SHALL 随时编辑删除自己的评论，不受日志 24 小时、任务完成、业务待审限制，无需任务审核；其他人包括任务负责人或日志作者不能管理他人评论。修改 SHALL 标已编辑，删除不再展示正文。

所有读写 SHALL 后端检查当前对象权限及适用作者身份，历史通知只读例外和失权旧页面 SHALL 不取得正常评论读写权。评论不改变进展、任务状态、正文、冻结时间或待审版本。

新评论 SHALL 仅通知任务当前有效全体负责人或日志作者，接收人去重并排除评论者，不额外通知任务创建人、审核人、其他评论者或全体可见人。通知 SHALL 含对象名称和评论用途并定位详情评论区，送达及打开重验对象权限；编辑删除不发新通知，已删除评论的通知 SHALL 不再展示正文摘要。

#### Scenario: Comment while business fields are read-only
- **WHEN** 可看他人日志或非负责人但有任务正常查看权的人发表评论，对象已冻结、完成或待审
- **THEN** 评论 SHALL 独立持久化且不改业务字段/冻结点，历史例外或已失权者不得借此访问

#### Scenario: Manage only one's own flat comments
- **WHEN** 作者在 24 小时后修改删除，其他人尝试管理同条评论或创建层级回复
- **THEN** 仍有对象访问权的作者 SHALL 可操作并显示已编辑或隐藏删除正文，非作者和层级请求拒绝

#### Scenario: Deliver only the targeted new-comment notification
- **WHEN** 评论发表、重试、编辑、删除或接收人失权
- **THEN** 每位有效负责人或日志作者 SHALL 至多获一条且排除评论者，其他角色不额外收到；编辑删除不另发，删除正文不再出现在旧消息摘要，失权者无法借消息取得对象或评论

#### Scenario: Page comments in stable publication order
- **WHEN** 多页评论有同一发表时间且加载时发生编辑删除
- **THEN** 评论 SHALL 按发表时间及稳定标识排序、无重复或越权正文，编辑不改发表顺序，删除正文不再出现

### Requirement: Persistent demonstration data for web and administration
系统 SHALL 准备手机号登录的员工演示账号及后端持久数据，保留原员工身份与组织关系；十大公司重要事项为十条并能展示列表和卡片等样式，业务数据覆盖通知、待审核、任务表单、部门团队及下属日志任务，足以展示筛选、排序、分页及布局。同一账号 SHALL 按真实权限连续展示表单与下属日志任务，刷新仍可用，不用前端静态假数据替代，不按记录日期推算新演示日期。

#### Scenario: Run a continuous demo after refresh
- **WHEN** 选定手机号账号登录后展示首页、通知、审核、表单和下属日志任务并刷新
- **THEN** 同一账号 SHALL 有对应合法数据权限，十条公司事项及业务数据仍在，可实际筛选排序分页，不需伪造身份
