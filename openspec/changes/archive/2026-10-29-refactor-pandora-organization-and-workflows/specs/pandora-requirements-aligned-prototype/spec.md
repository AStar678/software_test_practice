## MODIFIED Requirements

### Requirement: Four-quadrant dashboard
导图页 SHALL 固定展示四象限，各象限独立纵向滚动，整体不横向或纵向滚动，也不增加说明区。公司信息最多十条，按管理端设置顺序只读展示，包括上层无维护入口。本人被他人派发且未完成的正常任务 SHALL 按实际派发给本人的时间倒序取最多十项，条目仅标题和右对齐紧急程度，点击详情查看其他信息。个人信息最多十条且由本人手动维护，先只读详情再编辑删除，列表不外显操作，不从日志生成。近期日志 SHALL 为公司时区包含今天及此前九个自然日的本人原文，按日志日期倒序最多十篇；未发布任务及历史通知访问例外 SHALL 不进入正常任务区。

工作台日期区域 SHALL 移除“新建任务”按钮及其空白占位，常规创建保留日程右下角加号。待办 SHALL 为纵向滚动条预留安全空间，长标题可截断但不得挤出或遮挡右侧优先级，手机窄屏及桌面覆盖式滚动条出现时仍完整可读。个人事项详情编辑、删除 SHALL 使用当前条目真实标识。

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

#### Scenario: Remove duplicate creation and protect priority
- **WHEN** 用户在手机窄屏或桌面滚动长标题待办，并从个人事项详情编辑或删除
- **THEN** 工作台 SHALL 无重复创建按钮或占位，优先级始终完整可见，四象限独立滚动；个人事项操作仅作用于所选真实条目

### Requirement: Calendar task views
日历 SHALL 仅有月、日两种模式，默认月模式，月模式按月、日模式按天前后导航；日模式可保留可点的一周日期行，但 SHALL 不新增周视图或整周滑动要求。所有月格、日轴、全天区、跨日任务及当日清单 SHALL 仅展示本人当前为有效负责人的正常任务，含已完成任务；本人仅创建、仅组织可见、待创建、未发布和历史通知只读例外 SHALL 不进入日历。日历 SHALL 移除下属日程切换，其他入口合法权限 SHALL 不被收窄。

顶部 SHALL 提供左侧展开、可点年月日期选择及明确“任务表单”入口，侧面板 SHALL 承载月/日切换和本人申请；右下悬浮加号 SHALL 打开原创建表单且不遮挡导航或关键内容。收起后 SHALL 以日历为主体，日模式可回今天，不增加普通名称搜索及统计区。表单返回 SHALL 保留日历模式和日期。

月视图 SHALL 周一至周日排列，保留可调整月格高度、键盘调整、本地保存及最多两行标题截断和时间辅助信息。容量不足 SHALL 显示真实隐藏数量并可打开完整当日清单；月格及清单 SHALL 本人置顶优先，同组开始升序、任务标识稳定排序。置顶 SHALL 不改紧急度、他人顺序或真实时段。跨日/跨周跨度 SHALL 可辨。

月模式任务瀑布流 SHALL 可上下连续浏览前后月份及跨年，按位置补充相邻月份并显示边界，不以月份选择器作为跨月唯一入口；年月选择、回今天及日期导航 SHALL 继续可用。补载 SHALL 保持滚动位置，不重复相邻月边界日内容、不遗漏跨月任务；失败 SHALL 可重试，不把部分数据标为完整。

日模式 SHALL 提供可竖滚的 00:00—24:00 完整时间轴及独立全天区，可保留辅助清单。非全天跨日任务 SHALL 按日真实覆盖分类，完整覆盖某业务日者仅进该天全天区，其余逐日在时间轴显示真实覆盖时段，午夜截止不生成次日副本，零时长任务可识别。重叠任务 SHALL 在当天宽度内全量横向分栏，全天任务 SHALL 全量逐项展示或滚动访问，不以五项上限或“+N”隐藏。短任务点击区域 SHALL 不遮挡其他任务或改写真正时段；置顶仅强调。任务背景 SHALL 使用唯一标签颜色，无标签统一使用色板外的默认粉色非白底，文字、非纯色关系提示及无障碍名称 SHALL 可读。

左上角 SHALL 打开从左侧进入、仅覆盖日程区域约 40%—45% 宽度的抽屉，不挤压或改变底层日历尺寸，窄屏仍在右侧保留明显日历；内容换行/纵向滚动，不自动全屏。抽屉 SHALL 提供月/日切换、“我的申请”和关闭入口，删除“日历只显示本人当前负责的正常任务，可使用任务表单查看其他授权任务。”；遮罩、返回、Esc 和关闭入口均可收起。打开期间 SHALL 阻止底层误点/误滚动，键盘焦点限制在可操作抽屉内，关闭恢复原日历位置及触发入口焦点，不把焦点留在隐藏内容。

月格日期数字、空白、任务条和 `+N` 的任意点击 SHALL 统一从底部打开当天完整任务清单，不直接进入详情或日模式；跨日条 SHALL 根据实际命中日期而非任务开始日或条首日定位，滚动、调高与双指手势不得触发点击。底部清单 SHALL 展示日期、“查看日视图”和关闭入口，按任务标识去重、含已完成任务，沿用本人置顶/开始时间/稳定标识顺序；空态可按该日期创建。仅清单内点任务打开原详情，关闭详情 SHALL 返回原清单及滚动位置；查看日视图进入该天。关闭清单 SHALL 恢复原月历日期、密度及滚动位置。手柄下拖或正文已在顶部继续下拉 SHALL 可关闭，普通正文滚动不误关；同时保留按钮、遮罩、返回及 Esc 关闭和正确焦点恢复。

原始全天任务以及起止区间完整覆盖当前公司业务日 `[00:00, 次日00:00)` 的定时任务 SHALL 紧凑展示在当天全天区，且不在该天时间轴重复。首尾不足整天的覆盖仍在时间轴；午夜截止无次日副本，零时长不得误判整天。此归类 SHALL 仅为显示，不更改原始 `allDay`、开始、截止、工期、提醒节点或详情排期，全天区全量可访问，剩余定时任务仍按真实覆盖及完整并发关系分栏。

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
- **THEN** 日轴 SHALL 按当天实际覆盖时段竖向绘制，午夜截止无次日副本，零时长可点且不伪造工期，完整覆盖该业务日的定时任务进入当天全天区，部分覆盖仍在时间轴

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
- **THEN** 日轴 SHALL 按当天实际覆盖时段竖向绘制，午夜截止无次日副本，零时长可点且不伪造工期，完整覆盖该业务日的定时任务进入当天全天区，部分覆盖仍在时间轴

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
- **THEN** 系统 SHALL 打开当天完整清单，点击独立任务条也打开其点击位置所属日期的当天清单，不下钻独立周视图

#### Scenario: Ignore blank month task space
- **WHEN** 点击月格内无任务条区域
- **THEN** 系统 SHALL 打开当天完整清单，不误创建任务，独立任务条也按点击位置所属日期打开清单

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
- **THEN** 月格任务点击 SHALL 打开点击位置所属日期的清单，清单内和日模式任务点击仅开详情，日期操作按月/日导航，不误触跨月加载或月格调高

#### Scenario: Navigate and return from a week
- **WHEN** 用户通过一周日期行选日后进入详情并返回
- **THEN** 系统 SHALL 保留所选日和日模式，不新增周模式，回今天及按天导航可用

#### Scenario: Navigate and return from a day
- **WHEN** 用户展开侧栏、选择日期、切月/日模式、进入表单或本人申请并返回
- **THEN** 对应入口 SHALL 可用，表单返回保留模式日期；悬浮创建可点且不遮挡导航，日模式可回今天，日历无普通名称搜索或统计区

#### Scenario: Render a spanning task bar
- **WHEN** 某任务从前日 20:00 到次日 10:00，另有午夜截止和零时长任务
- **THEN** 日轴 SHALL 按当天实际覆盖时段竖向绘制，午夜截止无次日副本，零时长可点且不伪造工期，完整覆盖该业务日的定时任务进入当天全天区，部分覆盖仍在时间轴

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

#### Scenario: Overlay a narrow accessible schedule drawer
- **WHEN** 用户在 320px、390px 或桌面打开抽屉并用键盘、遮罩、返回或 Esc 关闭
- **THEN** 抽屉 SHALL 从左侧覆盖日程小半宽，底层尺寸不变且不可误操作；关闭恢复位置和焦点，月/日与我的申请入口可用

#### Scenario: Open a sheet from every part of a monthly date
- **WHEN** 用户分别点日期数字、空白、任务条、+N 及跨日条的中间日期
- **THEN** 系统 SHALL 均只打开实际点击日期的底部完整清单，不直接开详情/日模式，跨日条不固定选开始日

#### Scenario: Return through nested detail and dismiss without losing context
- **WHEN** 用户滚动清单、打开详情再返回，随后普通滚动、在顶部下拉或用手柄关闭
- **THEN** 详情返回 SHALL 保留清单位置，普通滚动不误关；关闭恢复原月历日期、密度、滚动和焦点，查看日视图及空态按日创建可用

#### Scenario: Classify full-day coverage without changing schedules
- **WHEN** 定时任务为周二20:00至周四10:00，另有午夜截止及零时长任务
- **THEN** 周二 SHALL 在轴上显示20:00—24:00、周三仅在全天区、周四在轴上00:00—10:00；午夜截止无次日副本、点任务不全天，原排期、allDay 和提醒不变

### Requirement: Authorized task table page
系统 SHALL 从视图提供“任务表单”二级页面，使用一行一项任务、表头与网格对齐的表格展示本人当前全部授权正常任务。表格 SHALL 支持纵向及窄屏横向滚动，并使表头、任务名称、返回和分页操作可定位及操作。每项 SHALL 显示任务名称、本人关系、有序负责人、原创建者、创建时间、说明、历史任务已有的完成标准（新建无此字段）、开始/截止日期时间、全天标记、执行状态、是否完成、紧急程度、进展备注、当前待审类型/冻结、逾期标记及有权查看的上级任务；长文本可预览并从详情查看全文，全天 SHALL 不伪造时刻，无权父任务 SHALL 不泄露标识或标题。

列表、搜索及计数 SHALL 只纳入当前有正常查看权且已有有效版本的任务，按任务标识去重。已生效任务待审 SHALL 展示旧有效版及待审标记，不泄露提议或专用 diff；待创建及其他未发布申请、仅有历史通知只读访问权的任务 SHALL 不纳入。任务操作 SHALL 进入原鉴权详情及审核流程，不提供单元格直接改写。返回日历 SHALL 保留此前模式和日期；关闭详情 SHALL 保留表单条件及当前位置。

任务表单 SHALL 删除可见的“当前授权正常任务”及“任务名称固定在左侧，列头可排序；点击任务名称打开原任务详情。”；删除分类统计栏不改变固定名称列、可排序列头、当前有效版字段、原详情入口及筛选/浏览位置恢复。

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

#### Scenario: Simplify visible copy while retaining spreadsheet operations
- **WHEN** 用户在窄屏打开任务表单、筛选排序翻页、进入详情并返回
- **THEN** 两句指定说明及分类统计 SHALL 不展示，名称列固定和列头排序仍可用，详情返回保留条件、页码和浏览位置

### Requirement: Global task table sorting and counts
表单 SHALL 至少支持按名称、创建时间、开始、截止、紧急程度和执行状态的列头升降序排序并显示方向；默认开始升序，切换新列先升序，同列再次切换降序，同值始终按任务标识升序稳定排列。紧急程度升序 SHALL 为紧急/高/中/低，执行状态升序 SHALL 为待开始/进行中/已完成，个人置顶 SHALL 不影响表格排序。筛选和排序 SHALL 在整个结果集完成后再分页，每页默认 50 条，改变条件/排序回第一页。

表单 SHALL 移除负责、创建、仅可见、待完成审核、已完成、逾期等分类统计展示及仅为该展示进行的无用计算；分页 SHALL 保留完整组合筛选结果总项数、当前页码及翻页操作。总数 SHALL 按任务标识跨日/跨分页去重，不随页大小和排序改变；完成待审仍属未完成，逐行逾期标记仍按当前时刻超过真实有效截止且未完成判断，不因移除统计改变过滤或任务状态。

#### Scenario: Sort all filtered rows before paging
- **WHEN** 超过两页 API 的授权任务分布着不同开始时间、同名、不同紧急程度及状态，用户分别切换六列排序并翻表格页
- **THEN** 各页连起来 SHALL 等于完整筛选结果的全局排序，同值按任务标识稳定排序，方向可辨识，置顶 SHALL 不改变该序列

#### Scenario: Count overlapping relationships without duplicate totals
- **WHEN** 唯一筛选结果是一个跨日、本人创建且负责的任务
- **THEN** 分页总数 SHALL 为1，行可保留负责与创建关系标记，不显示各分类统计，不因关系重叠或跨日重复计数

#### Scenario: Recompute counts after all filters
- **WHEN** 用户叠加名称、关系、完成和日期条件，随后翻页或改排序
- **THEN** 分页总数 SHALL 基于完整去重结果，翻页和排序不改变总项数，不展示或单独计算已移除分类统计

#### Scenario: Separate pending completion done and overdue
- **WHEN** 结果中有完成待审、已完成过截止和全天未到/已过有效截止任务
- **THEN** 完成待审 SHALL 仍属未完成，已完成不显示逾期，全天逐行逾期依有效截止判断；分类计数栏不再展示

### Requirement: Role-scoped visibility
系统 SHALL 仅按当前固定组织位置与对象关系检查任务、日志、分析和人员查询，不叠加手工业务角色、授权范围或职位名称。创始人可看公司全部正常任务；部门负责人看至少一位当前有效负责人在本部门的任务、以及本人创建或负责的正常任务；团队负责人按同样规则看本团队及本人创建或负责的正常任务；普通员工仅看本人创建或负责的正常任务。正式业务接管人按接管关系获得接管任务的必要访问/办理权，不冒充原创建者。日志 SHALL 创始人看公司，部门负责人看本人及本部门全部直接/间接下属，团队负责人看本人及本团队员工，普通员工仅本人；同团队或同任务不自动赋予普通员工他人日志权。管理员不自动取得业务权限。列表、详情、搜索、关联、人员筛选、通知跳转及统计明细 SHALL 执行同类权限，待创建隔离优先；历史消息只读例外仅依独立要求生效。

下属资料 SHALL 按实际管理链覆盖全部直接和间接下级，创始人覆盖全公司业务员工；任务选人目录仅提供姓名、部门、团队、职位等必要字段。查看权 SHALL 不自动赋予基础修改、审核或交接代办权。组织调整后所有列表、详情、搜索、关联、计数、分析、候选、审核预览/决定、旧页面提交及幂等重放 SHALL 重新鉴权；旧管理者不得保留旧范围。

#### Scenario: Read a task crossing departments
- **WHEN** 两部门人员共同负责一个已发布任务
- **THEN** 两部门获授权管理者 SHALL 可见，创建者部门 SHALL 不决定任务部门归属；查看权 SHALL 不自动授予派发、修改或审核权

#### Scenario: Separate direct reports from teammates
- **WHEN** 部门负责人查看团队负责人及其员工日志，团队负责人查看本团队日志，普通员工查看同团队同事独立日志
- **THEN** 部门负责人 SHALL 包含直接和间接下级，团队负责人包含本团队员工，普通员工只读本人；其他部门或团队不因共享任务扩权

#### Scenario: Deny unauthorized detail and privacy leakage
- **WHEN** 无权用户直接访问任务、日志、关联、统计明细或他人资料
- **THEN** 系统 SHALL 拒绝或裁剪受限数据；手机号仅本人资料及具备当前资料查看权、组织层级更高的实际管理链上级所读人员详情 SHALL 可返回，其他 DTO SHALL 不含号码；知晓 ID 或前端角色按钮 SHALL 不授予权限

#### Scenario: Compare role visibility
- **WHEN** 两部门人员共同负责一个已发布任务
- **THEN** 两部门获授权管理者 SHALL 可见，创建者部门 SHALL 不决定任务部门归属；查看权 SHALL 不自动授予派发、修改或审核权

#### Scenario: Prevent unauthorized detail access
- **WHEN** 无权用户直接访问任务、日志、关联、统计明细或他人资料
- **THEN** 系统 SHALL 拒绝或裁剪受限数据；手机号仅本人资料及具备当前资料查看权、组织层级更高的实际管理链上级所读人员详情 SHALL 可返回，其他 DTO SHALL 不含号码；知晓 ID 或前端角色按钮 SHALL 不授予权限

#### Scenario: Retain own cross-scope tasks and deny teammate access
- **WHEN** 部门/团队负责人创建任务但全部负责人在其他部门/团队，普通员工搜索同团队无关任务
- **THEN** 管理者 SHALL 仍可读本人创建的正常任务，普通员工无关任务不在列表、详情、计数和分析中

#### Scenario: Revoke management access after an atomic move
- **WHEN** 人员调岗后旧上级用缓存、旧请求、旧分析及相同幂等键访问
- **THEN** 所有入口 SHALL 按新组织拒绝旧范围，不返回旧数据或旧成功载荷，新的合法管理链可按当前矩阵访问

### Requirement: Role-scoped task creation and assignment
任何本公司有效员工创建、重提创建申请及后续合法修改负责人时 SHALL 可选择本公司全部有效员工，包括其他部门、直属上级和创始人；候选、提交及批准检查 SHALL 一致，不受旧角色、同团队或旧创建派发配置限制。独立管理员、失效及跨公司人员 SHALL 不作为员工候选。部门 SHALL 使用真实部门，选人 SHALL 支持部门和姓名搜索、有序多选、跨部门保留、确认及取消还原。

普通员工创建初始负责人 SHALL 为本人，创始人、部门负责人、团队负责人 SHALL 初始为空；用户可移除本人且不自动加回，提交仍至少一位有效负责人。创建审核 SHALL 按创建人及其直属上级规则，不按负责人管理链。需审创建批准前 SHALL 不发布，批准或有理由免审后 SHALL 发布为待开始。候选扩大 SHALL 不授予手机号、日志、全部任务或管理员查看权，不扩大专用交接等非创建权限。

#### Scenario: Assign across departments and upward
- **WHEN** 普通员工给同事、其他部门、直属上级或创始人创建任务
- **THEN** 候选与提交 SHALL 允许本公司有效员工并按创建人直属关系审核，跨公司和失效人员 SHALL 拒绝

#### Scenario: Remove the creator and preserve selection order
- **WHEN** 用户移除初始本人、仅选其他员工并换序或取消选择
- **THEN** 系统 SHALL 不强制加回本人，确认后回读保留顺序、取消还原；创始人、部门负责人、团队负责人初始为空，空列表提交 SHALL 拒绝

#### Scenario: Keep dispatch separate from unrelated access
- **WHEN** 用户选择公司任意员工后访问其手机号、日志、其他任务或提交交接
- **THEN** 系统 SHALL 继续按各对象权限裁决，不因候选可选扩权

#### Scenario: Isolate an unpublished creation
- **WHEN** 需审创建尚未通过、被拒绝、撤销或失效
- **THEN** 任务 SHALL 仅供原申请人跟踪及本次审核人处理，不进入正常列表、日历、首页、搜索、计数和分析；通过或合法免审后才发布

#### Scenario: Select and order authorized assignees
- **WHEN** 用户移除初始本人、仅选其他员工并换序或取消选择
- **THEN** 系统 SHALL 不强制加回本人，确认后回读保留顺序、取消还原；创始人、部门负责人、团队负责人初始为空，空列表提交 SHALL 拒绝

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
- **THEN** 系统 SHALL 不强制加回本人，确认后回读保留顺序、取消还原；创始人、部门负责人、团队负责人初始为空，空列表提交 SHALL 拒绝

#### Scenario: Search for an unavailable assignee
- **WHEN** 用户搜索不存在、失效或跨公司员工
- **THEN** 候选 SHALL 不提供该人员且有空态，直接提交也拒绝；本公司其他部门、上级及创始人不再因旧角色或范围被排除

#### Scenario: Employee submits a self-created task
- **WHEN** 下层为本人创建任务或移除本人另选他人
- **THEN** 初始 SHALL 选本人但允许移除，至少一位有效负责人；审核按创建人直属上级，仅固定创始人留因免审，其他员工缺直属上级阻断，待审不进入正常区域

#### Scenario: Superior reviews a self-created task
- **WHEN** 当前指定创建审核人批准或拒绝创建
- **THEN** 批准 SHALL 发布为待开始，拒绝保留结果并允许原申请人调整重提，不发布执行任务

#### Scenario: Select company members during a later owner change
- **WHEN** 创建者或正式业务接管人修改已发布任务负责人并选择其他部门或创始人
- **THEN** 候选、提交和生效校验 SHALL 允许公司全部有效业务员工，拒绝独立管理员、失效或跨公司人员，至少一位有效负责人且保持保存顺序

### Requirement: Task editing and completion review
仅任务当前创建者业务责任方（原创建者正常在任时为原创建者、正式接管后为接管人）SHALL 可修改基础信息/负责人及重开已完成任务；当前负责人仅可申请每次新增/修改文字进展与完成；专用交接仅依交接要求开放。需要他人审核的创建、修改、每次进展、完成、重开及交接 SHALL 先待审；申请人等于实际审核人时 SHALL 校验通过后直接生效并保留免审原因，不留本人待审。需要他人审核时 SHALL 同任务唯一待审并冻结其他任务业务变更（有当前正常访问权者的独立评论除外），只有申请人能撤销；仅停用前未发布创建申请可按专用管理处置撤销并留因，该例外不开放任意业务申请代撤。修改提议须先撤销再重提。普通区域 SHALL 保留原有效版本，申请人可看自己提交的内容/状态/结果，只有本次审核人可获得原版与提议的专用 diff，不能靠前端隐藏代替字段裁剪。

执行状态 SHALL 为待开始/进行中/已完成，与待审/通过/拒绝或退回/撤销/失效分开。首次进展审核通过或合法直接生效后待开始变进行中；完成通过变已完成、退回变进行中且须意见、撤销恢复提交前状态；当前创建者业务责任方重开可一并提出完整有效排期，通过回到进行中并增加轮次，拒绝/撤销保留已完成。普通修改或进展拒绝/撤销 SHALL 保留原版；待审到期按失效要求保留提交前状态并解冻。

#### Scenario: Freeze and cancel an application
- **WHEN** 多名负责人同时提交进展/完成，或非申请人尝试撤销
- **THEN** 系统 SHALL 最多产生一个待审并冻结其他任务业务变更（独立评论除外），只有申请人可撤销，原创建者或审核人 SHALL 不能替他撤销；仅未发布创建申请适用停用管理处置的受控例外

#### Scenario: Restrict comparison data to the reviewer
- **WHEN** 申请人、审核人及普通任务查看者分别读取同一变更
- **THEN** 审核人 SHALL 可看逐项 diff，申请人仅看提交内容及结果而无专用原版对比字段，普通人 SHALL 只见旧有效版和冻结；本人即审核人的合法操作 SHALL 已直接生效，不生成待本人决定的申请；历史对比仍仅授权审核身份

#### Scenario: Distinguish completion outcomes
- **WHEN** 负责人提交完成后分别发生通过、退回或撤销
- **THEN** 系统 SHALL 分别进入已完成、进行中或恢复提交前执行状态，退回 SHALL 要求意见，所有路径 SHALL 解除待审冻结并保留结果

#### Scenario: Reopen with a new schedule
- **WHEN** 当前创建者业务责任方对已完成任务提出重开及新排期且全部校验通过
- **THEN** 系统 SHALL 按本人直接生效规则同时发布新排期、进入进行中及下一轮次；任何失败保留原完成状态和排期，其他人无重开权

#### Scenario: Assignee updates progress
- **WHEN** 当前负责人每次新增或修改文字进展
- **THEN** 系统 SHALL 按创建者业务责任方审核；两者不同先待审冻结，相同直接生效并留因，首次进展生效才变进行中，负责人身份不授予基础修改权

#### Scenario: Show status without numeric progress
- **WHEN** 查看任务状态和进展
- **THEN** 系统 SHALL 展示独立执行/申请状态及文字备注，不提供百分比或进度条

#### Scenario: Creator approves completion
- **WHEN** 当前有效负责人提交完成
- **THEN** 当前创建者业务责任方 SHALL 为审核人；申请人与其相同时直接生效，否则仅当前审核人可批准，原创建者在正式接管后不再凭原身份决定

#### Scenario: Superior rejects completion
- **WHEN** 指定审核人填写意见退回完成申请
- **THEN** 系统 SHALL 进入进行中并保留意见，不能只因上层身份审核所有任务

#### Scenario: Render authorized field-by-field differences in saved order
- **WHEN** 本次审核人打开仅负责人换序或多字段变更申请
- **THEN** 页面 SHALL 使用后端授权逐项差异展示前后值及有序负责人，不把换序视为无变化；创建换序不描述为改变创建审核人，申请人及旁观者不因展示扩权

#### Scenario: Reopen an overdue completed task from the web form
- **WHEN** 当前创建者业务责任方对旧截止已过的已完成任务填写重开原因及全天/非全天完整未来排期
- **THEN** Web SHALL 一并提交排期并按当前创建者业务责任方及本人直接生效规则处理，通过则新排期、进行中和新轮次生效且提醒按新轮次排期去重，拒绝撤销失效保留原已完成状态及有效排期

#### Scenario: Resubmit an expired creation as a new request
- **WHEN** 失效创建的原申请人选择修改并重提并调整排期
- **THEN** 页面 SHALL 清楚展示失效及原提议，提交建立新申请并重算创建路线，旧申请保持失效；他人、重复并发重提及旧审核按钮不能复活旧申请或多次生效

#### Scenario: Validate a direct application as strictly as a reviewed change
- **WHEN** 当前创建者业务责任方修改资料或重开，或其作为负责人提交进展/完成
- **THEN** 操作 SHALL 仅在权限、版本、幂等、有效负责人、排期/截止、冻结、关联全部合法时一次生效，留历史和免审原因，不生成本人待审

### Requirement: Required notifications
系统 SHALL 由真实业务事件产生站内通知，覆盖审核提交/结果、创建生效、基础信息/紧急程度/进展/状态/完成/重开/交接生效、改派、临期、逾期及失效，不用静态样例代替。待创建及未发布结果 SHALL 仅向申请人和对应审核人；已发布任务申请提交 SHALL 只通知本次审核人，申请人可跟踪，不提前告知其他任务人员或提议负责人。已发布结果 SHALL 面向申请人、审核人及相关任务人员，生效通知 SHALL 向当前创建者业务责任方与当前全体负责人；负责人变更还 SHALL 包含新增及被移除人。提醒 SHALL 向当前创建者业务责任方与当前负责人。同次多字段更改 SHALL 一条消息汇总实际变化，保留任务标题、事件、时间及原申请绑定；同事件多身份去重且不排除本人；独立评论通知 SHALL 按评论专用矩阵去重并排除评论者本人。系统推送属于正式要求但本次延期，不得将站内投递声明为系统推送通过。

通知列表 SHALL 同时直接展示事件用途、对象名称和具体可读摘要，区分待审核与一般告知并说明本人待处理动作，手机长标题不遮掉用途。撤回、屏蔽或权限变化 SHALL 不从原始载荷恢复受限内容。

正式接管后 SHALL 以接管人为后续创建者业务责任接收方，原创建者只保留历史来源，不继续承担新的办理/审核责任。本人直接生效 SHALL 不生成待本人审核通知，仍生成真实生效事件和按去重矩阵适用的结果告知。改派与接管 SHALL 更新有效审核通知，旧审核按钮不得恢复失权责任。

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

#### Scenario: Notify the current business owner after takeover
- **WHEN** 管理员完成正式业务接管，后续有人提交进展或到达提醒节点
- **THEN** 待审核 SHALL 仅送当前接管审核人，生效和提醒使用当前业务责任方与有效负责人矩阵，旧创建者不再作为新审核人；自操作不产生本人待审消息

### Requirement: Personal work logs
日志 SHALL 归作者并按公司业务日期同人同日唯一，新建允许公司今天、昨天、前天，不允许更早或未来；已有所选日期未冻结日志 SHALL 打开编辑。日志创建后 SHALL 不改业务日期。冻结 SHALL 为真实首次创建时间加 24 小时，编辑不重置计时，服务端达到冻结点立即只读，跨零点不提前冻结。编辑和删除 SHALL 仅作者且共用该窗口，删除重建 SHALL 不重置首次创建时间或清除同人同日冻结约束。

前后端 SHALL 一致显示可编辑性、冻结时间和重复/到期反馈，旧页面到期提交及并发 SHALL 不绕过限制；存量日志保留真实创建时间，冻结和他人日志不显示正文编辑/删除。新建编辑 SHALL 保留全屏表单、伸展正文和可达保存/返回/关闭，离开恢复其他弹层布局。

日志 SHALL 可选关联一项作者当前正常可见任务，支持名称搜索、空结果和清空，关联详情独立鉴权。创始人看公司、部门负责人看本人及本部门全部直接/间接下属、团队负责人看本人及本团队员工、普通员工看本人，上级不能编辑正文，同团队/同任务不授予日志权；关联任务失权 SHALL 裁剪跳转但保留有权正文。标签 SHALL 同受日志编辑冻结规则，独立评论按评论要求处理。

日志日期转换 SHALL 使用日志模块可访问的统一公司业务日期方法，不依赖日程私有函数或偶然脚本加载顺序。详情“编辑日志” SHALL 传入真实日志标识，写日志及关闭保存入口操作和样式正确；从人员资料进入目标日志 SHALL 先清空旧部门、团队和搜索条件，再以目标人员和当前日志权限查询。

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
- **WHEN** 部门负责人读取间接下属或团队负责人读取团队员工日志
- **THEN** 系统 SHALL 按当前固定组织范围只读正文，上级无正文编辑/删除权，普通同团队成员无他人日志权，关联任务仍独立鉴权

#### Scenario: Regress actual log entry and the selected editor
- **WHEN** 用户在真实服务中写日志、补写、从详情编辑并保存/关闭，随后从人员资料进入某人日志
- **THEN** 系统 SHALL 无 dateKey 作用域异常，真实日志标识及日期正确，目标人员不被旧筛选隐藏；三天窗口、同日唯一、首次24小时冻结及删除重建约束仍生效

### Requirement: Log page single-content filtering and scroll return
日志功能的 Web 导航、标题、首页和相关入口 SHALL 统一称“日志”，不再以“记录”或“工作记录”指代该功能。日志页 SHALL 只写看日志，进入和切换账号默认本人，不混入任务创建、审核、申请或请示，回顶保留有效筛选。

作者筛选 SHALL 部门→团队→个人联动，每层可名称搜索，候选、结果、计数先受当前日志权限过滤。切换部门或团队 SHALL 清理不匹配下级选择，保留有效输入和空态；同名人员可用组织信息区分，无团队人员可查找。本人和范围内全部 SHALL 可选；可看他人不授予正文编辑，组织/账号变化重验条件，不复用旧账号数据。

从人员资料定向进入日志 SHALL 清空先前部门、团队、作者搜索条件，再设置目标人员并按当前日志范围查询；目标失权不得因旧筛选或缓存返回正文。部门/团队负责人选择范围内全部时 SHALL 包含固定组织矩阵允许的直接及间接下属，不能残留旧“仅直属”过滤。

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

#### Scenario: Reset old filters when opening logs from a person profile
- **WHEN** 先选其他团队并搜索后，再从有权限的下属资料打开该人员日志
- **THEN** 旧部门、团队和搜索 SHALL 清空，结果仅按目标人员和当前日志权，间接下级日志不被旧直属规则排除；失权时拒绝且不显示旧结果

### Requirement: Role-scoped AI map
AI 地图 SHALL 使用当前权限内的真实任务统计、关键词词云和规则建议。创始人公司统计/词云/建议，部门负责人本部门统计/词云及本人任务建议，团队负责人本团队统计/词云及本人任务建议，普通员工本人统计/词云/建议；管理员无默认业务分析权。统计 SHALL 包含任务总数、执行状态、独立待完成审核、逾期未完成及四档紧急程度分布，排除待创建及历史例外。词云 SHALL 从该范围任务标题/说明实际提取，不能固定词表或默认读取私人日志；建议 SHALL 包括与比例临期一致的临期/逾期、排期冲突及高紧急任务，进入或主动刷新 SHALL 更新并标明范围、方法和时间。明细及旧分析读取 SHALL 再检查当前权限。

#### Scenario: Generate personal and department results separately
- **WHEN** 中层进入或刷新 AI 地图，员工查看同页
- **THEN** 部门负责人 SHALL 得到本部门统计/词云与个人建议，团队负责人得到本团队统计/词云与个人建议，员工 SHALL 仅本人数据；均展示真实范围、生成方法及更新时间

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

#### Scenario: Scope team analytics independently from personal suggestions
- **WHEN** 团队负责人查看 AI 页面且其本人还创建/负责跨团队任务
- **THEN** 统计词云 SHALL 使用本团队正常授权任务范围，建议针对本人任务；跨团队本人关系不扩展团队聚合范围，私人日志不作为默认来源，撤权旧聚合及明细不得泄露

### Requirement: Minimal profile page
“我的” SHALL 展示本人公司、姓名、部门、职位、独立团队、直属上级和手机号，并展示由位置推导的四层身份，提供编辑本人头像/邮箱、修改密码、退出；姓名与手机号 SHALL 仅由管理员修改，本人字段不可借混合请求越权修改。组织及授权字段 SHALL 只能通过管理流程维护。管理层下属资料入口 SHALL 覆盖当前实际管理链全部直接和间接下级，不扩大资料范围或开放公司通讯录、资料卡派发按钮。人员详情 SHALL 按账户与联系方式规则独立检查手机号权限。日志 SHALL 继续独立鉴权，部门负责人含本部门全部下级、团队负责人含本团队员工，创始人含全公司。

页面 SHALL 移除员工团队管理入口，不展示员工用户名；创始人公司层、部门负责人部门层、团队负责人/普通员工部门与团队层 SHALL 分别按实际位置展示，不伪造缺失组织字段。手机号仅本人及实际管理链上级在授权详情中可读，邮箱仅本人；目录不得成为全公司联系方式目录。

#### Scenario: Read and edit the required profile
- **WHEN** 本人打开“我的”并修改联系方式
- **THEN** 系统 SHALL 显示独立公司/部门/职位/团队字段并保存允许的本人字段，组织/权限修改 SHALL 被拒绝，改密及退出 SHALL 可用

#### Scenario: Open a subordinate within both profile scope and the management chain
- **WHEN** 管理层从“我的”查看直属或间接下属资料和日志
- **THEN** 列表 SHALL 仅含当前资料权限与实际管理链同时允许的下属；详情 SHALL 重新检查资料权和手机号权，不提供派发按钮；间接下属日志 SHALL 按当前固定组织矩阵独立裁决，非管理链人员 SHALL 不出现在该入口

#### Scenario: View profile
- **WHEN** 本人打开“我的”并修改联系方式
- **THEN** 系统 SHALL 显示独立公司/部门/职位/团队字段并保存允许的本人字段，组织/权限修改 SHALL 被拒绝，改密及退出 SHALL 可用

#### Scenario: Keep identity fields read-only to employees
- **WHEN** 员工尝试从页面或直接 API 改姓名/手机号，同时打开头像、邮箱、改密入口
- **THEN** 姓名/手机号修改 SHALL 被拒绝，其余合法本人维护可用，无员工用户名和团队管理入口；职位改名不改变任何业务权限

### Requirement: Strict prototype scope
本变更 SHALL 以《潘多拉 Web 与管理端更改指导》（`docs/reviews/更改指导.md`，2026-10-28 基线复核）及本轮用户确认为需求和验收依据；冲突的旧组织、角色授权、审核、账号、日历及统计规则 SHALL 由本增量完整替换，其他已确认行为保留，V3/旧清单仅用于不冲突行为追溯。旧 change 已归档，不作为本轮待完成前置。范围 SHALL 为员工 Web、独立 PC 管理端及必需的后端、数据和演示准备；Android 套壳资源同步、容器适配、安装包及设备交付 SHALL 由其他人员另行负责，不属于本 change 的实施及验收范围。

系统 SHALL 使用真实认证、持久化及事件调度验收，保留五个主页面、任务表单二级页、个人置顶、冲突建议和账户维护。旧 Android Web 套壳和安卓原生新版工程及其 UI/APK、系统推送、Android WebView/真机验收 SHALL 不纳入本次修改。时间选择业务控件 SHALL 使用 Web 实现并在移动浏览器验收；套壳未交付 SHALL 不作为本 change 完成或归档的前置阻塞，Web 证据 SHALL 不代表套壳或真机验证通过。员工停用及业务接管 SHALL 按本轮要求实施；请示回复、一人多团队、任务私人草稿、任务取消、公司草稿/定时发布、日志转待办、外部模型与 MBTI SHALL 继续不纳入本轮。

项目尚在开发且未交付，本轮 SHALL 直接统一新账号/API 契约并更新当前范围内使用方，不为旧员工 username 请求保留兼容入口。共用后端变更 SHALL 记录后续其他客户端需采用的契约，不能扩大为安卓实施任务。规划完成不等于代码、数据重建或整体验收通过，旧 PASS、已修复项和旧任务勾选不得代替新组织模型的独立验证。

#### Scenario: Validate against the selected checklist
- **WHEN** 实施者或验证者检查本变更
- **THEN** 验收 SHALL 使用更改指导和本增量规格，不能要求旧周视图、受限创建派发或午夜冻结，也不能宣称尚未发布的新 PRD 已通过；静态示例、旧报告及任务勾选 SHALL 不替代当前真实服务证据

#### Scenario: Keep native Android outside the change
- **WHEN** 检查修改文件和交付记录
- **THEN** `android/` 和 `android-shell/` SHALL 均不在修改范围，资源同步、容器/桥接适配、APK 构建签名、升级及设备验证 SHALL 交由其他人员另行负责；共用后端兼容影响 SHALL 如实记录，不将移出范围的事项标为已交付或已验证

#### Scenario: Validate the real service and declared scope
- **WHEN** 实施者或验证者检查本变更
- **THEN** 验收 SHALL 使用更改指导和本增量规格，不能要求旧周视图、受限创建派发或午夜冻结，也不能宣称尚未发布的新 PRD 已通过；静态示例、旧报告及任务勾选 SHALL 不替代当前真实服务证据

#### Scenario: Inspect available actions
- **WHEN** 实施者或验证者检查本变更
- **THEN** 验收 SHALL 使用更改指导和本增量规格，不能要求旧周视图、受限创建派发或午夜冻结，也不能宣称尚未发布的新 PRD 已通过；静态示例、旧报告及任务勾选 SHALL 不替代当前真实服务证据

#### Scenario: Open the split static prototype
- **WHEN** 从文件系统打开旧静态页面或直接读取未构建脚本
- **THEN** 验收 SHALL 使用真实服务、认证、持久化及事件路径，静态内容不视为通过，本次按更改指导及本增量规格判定

### Requirement: Organization and administration
系统 SHALL 提供独立 PC 浏览器 Web 管理端（`/admin.html`），仅独立管理员可维护员工、部门、团队、负责人、展示职位和人员位置，并查询完整任务历史、维护公司信息与通知。组织 SHALL 固定为一位 Founder → 每部门一位 Department Head → 每团队一位 Team Head → Employee；每人仅一个位置，不兼任、副职、联合负责人或多管理链，普通员工必须归团队、团队必须归部门。直属上级和层级 SHALL 从位置唯一推导，创始人身份有明确固定依据，不用任意无上级根节点猜测；普通管理流程不提供创始人交接、调任或停用。创始人为公司层、部门负责人为部门层、团队负责人及普通员工为部门团队层；所有业务员工职位必填且仅用于展示，不作为授权来源。每公司一位独立管理员，不占员工位置且无默认员工业务权。

员工 App SHALL 保持五个主导航且不嵌入完整管理员维护模块，管理员入口提示 SHALL 指向真实 PC 管理端。管理端能在窄屏打开不改变其 PC Web 交付定位；管理员身份 SHALL 不自动授予员工业务权限，业务账号直连管理 API SHALL 仍被拒绝。

创建部门/团队 SHALL 同时安排有效负责人，负责人可为首位且唯一成员；可在编辑草稿准备完整方案，正式保存不得出现无人负责单位。新员工 SHALL 同时提交合法位置与职位；调岗直接切换，更换负责人同时安排新旧负责人和下属，删除单位或停用负责人前处理全部去向、继任及业务责任。跨多人/单位调整 SHALL 校验完整最终结果后原子提交，失败保留原组织；并发版本与唯一性校验 SHALL 防止双负责人、无人负责、跨部门团队、环和悬空链，权限版本及待审刷新同事务完成，读取只观察合法旧/新状态。

系统 SHALL 删除“角色与授权”、自定义业务范围及员工团队管理入口，不以可编辑旧角色、能力、等级作为第二权限来源；固定四层标记仅可展示。员工直接调用旧团队/组织/授权写入口 SHALL 被后端拒绝。

#### Scenario: Maintain an employee through the administrator interface
- **WHEN** 管理员创建不同位置员工并设置合法组织与必填展示职位
- **THEN** 保存 SHALL 持久化唯一合法位置及推导上级，创始人不要求部门团队、部门负责人不要求团队；缺职位、普通员工无团队、第二创始人/管理员或非法引用拒绝

#### Scenario: Maintain teams independently of departments
- **WHEN** 管理员创建部门与团队并同时安排负责人，负责人是新单位首位成员
- **THEN** 系统 SHALL 允许无普通员工但有合法负责人单位，团队必属部门，每单位一负责人且每人一位置，正式保存无负责人拒绝

#### Scenario: Transfer updates independent scopes
- **WHEN** 管理员一次调岗或替换多位负责人且同时有并发旧版本保存
- **THEN** 仅合法完整结果 SHALL 原子提交并同步权限/待审，旧版本冲突不写入，所有读取和业务操作不得看到中间无上级或双负责人状态

#### Scenario: Maintain and reorder company information
- **WHEN** 管理员增改删公司信息或调整展示顺序
- **THEN** App SHALL 只读展示管理顺序，默认按创建时间排序；并发新增也 SHALL NOT 超过十条，业务账号的维护请求 SHALL 被拒绝

#### Scenario: Use the independent PC administration interface
- **WHEN** 管理员在电脑浏览器建号并完成组织、公司信息、交接、任务历史和通知管理，员工从 App 使用业务或直连管理 API
- **THEN** 管理端 SHALL 承接已授权管理流程，App SHALL 不出现完整管理模块，员工 SHALL 无法越权调用管理 API，管理员误入业务页提示 SHALL 指向 /admin.html

#### Scenario: Manage teams from a restricted employee web entry
- **WHEN** 员工以任意固定身份调用旧团队维护及角色授权写 API
- **THEN** 页面 SHALL 无该入口，后端拒绝写入；只有独立管理员可维护组织，无旧授权范围可扩大其业务权

#### Scenario: Manage notifications in the formal PC console
- **WHEN** 管理员在正式通知栏目查询接收、已读、撤回和保留期并执行撤回
- **THEN** 页面 SHALL 使用真实管理接口，严格少于 180 秒才可撤回，说明不撤销任务申请且不删历史；普通员工直连拒绝，受限上级原内容只读不恢复跳转审核

#### Scenario: Keep the founder fixed and positions independent of titles
- **WHEN** 管理员改职位名、试图转交/停用创始人或造出第二负责人
- **THEN** 职位改名 SHALL 仅影响展示；固定创始人管理操作和非法负责人结果拒绝，身份和业务权始终由合法位置推导

### Requirement: Account password lifecycle
账号 SHALL 由管理员手动创建，不开放自助注册；员工使用本人手机号登录，独立管理员使用独立管理员账号名和密码模型。手机号 SHALL 统一规范化并在认证可识别范围唯一，不得歧义登录；非演示升级迁移保留员工 ID、原凭据和业务历史，组织关系按显式合法位置映射转换；非演示不得以新建任意账号替代原身份，演示库可按受控流程重建。管理员建号和管理员合法改号 SHALL 同步登录标识，空号与重复号有明确处理反馈。系统 SHALL 生成随机初始密码并强制首次改密；管理员重置密码 SHALL 再次强制改密。新密码 SHALL 至少 10 个字符、含字母与数字且 UTF-8 长度不超过 72 字节。强制改密会话 SHALL 仅可办理本人改密及退出，不能读取或修改业务数据；日常改密 SHALL 校验旧密码，成功后撤销包括当前会话在内的全部会话并要求重新登录。管理员 SHALL 可录入/覆盖员工手机号，但不得通过管理响应、目录或审计回显他人手机号；本人仅可编辑头像、邮箱和密码，姓名与手机号仅管理员可改。

按 2026-10-19 调整，手机号 SHALL 仅本人及实际管理链上的上级可见；他人读取 SHALL 同时满足当前资料查看权、同组织有效人员关系及更高组织层级，且仅通过鉴权人员详情返回。邮箱 SHALL 仍仅本人可见。同级、下属、其他管理链、仅有管理员身份或仅有公司/部门资料范围 SHALL 不因此取得手机号权。目录、任务人员摘要、日志筛选、通知、分析、审计、outbox 及普通人员缓存 SHALL 不含号码；历史通知只读例外 SHALL 不授予手机号权。

员工 SHALL 用明确手机号字段登录，以姓名展示、稳定内部标识关联任务/日志/组织/通知，最终员工结构、索引、当前接口字段/解析、生成器、搜索、展示、准备脚本及当前测试不再依赖员工用户名。历史已应用迁移和历史文档不机械删改，但通过新迁移清除最终结构中的用户名及映射残留；不得用手机号充当公开用户名。手机号建号必填、不可清空、规范化且在无租户选择的员工认证范围唯一；管理员改号同步登录键且员工 ID 不变。

管理员凭据 SHALL 独立于员工用户名存储，每公司一个账号，在“管理员账号”区域维护，不出现在员工名单、组织树、任务候选、日志目录或业务审核，不要求员工部门/团队/职位。登录 SHALL 显式区分 employee/admin，不跨类型回退；缺失类型或旧员工 username 载荷返回明确契约错误且不创建会话，拒绝歧义身份及重复员工手机号，保留显式管理员修复入口。改号 SHALL 撤销该员工既有会话，管理员凭据更新也撤销其原会话；首登和密码策略、重置、日常改密规则继续生效。

#### Scenario: Initial login cannot enter business pages
- **WHEN** 新员工用生成的初始密码登录并尝试直接访问业务接口
- **THEN** 系统 SHALL 提示必须改密并拒绝业务访问，改密成功后旧会话失效，使用新密码重新登录后方可进入

#### Scenario: Password validation and reset
- **WHEN** 本人提交错误旧密码、少于 10 字符、缺字母/数字或超过 72 UTF-8 字节的新密码
- **THEN** 系统 SHALL 拒绝修改；管理员重置后 SHALL 生成新初始密码、撤销旧会话并恢复首次改密门禁

#### Scenario: Edit contacts without exposing another employee phone
- **WHEN** 管理员录入员工号码或其他用户读取目录、人员摘要、日志筛选、通知及分析
- **THEN** 系统 SHALL 允许管理员授权写入并仅回执成功状态，上述读取结果 SHALL 不含号码；本人资料接口 SHALL 可读取自己姓名/手机号并编辑邮箱、头像，姓名和手机号由管理员维护

#### Scenario: Read phones only through authorized person details
- **WHEN** 本人、直属上级、间接上级、同级、下属、其他管理链上级及管理员读取人员详情
- **THEN** 本人 SHALL 可读自己的手机号；直属或间接上级 SHALL 仅在具有当前资料权且组织层级更高时可读下属号码；其余人 SHALL 不获得号码，资料权不足 SHALL 拒绝整个详情，任何他人详情 SHALL 不返回邮箱

#### Scenario: Recheck the management chain after an organization change
- **WHEN** 员工转岗、管理关系变化、链上中间账号失效，或管理链出现环/跨公司引用
- **THEN** 后续人员详情请求 SHALL 按当前有效关系鉴权，旧上级及无法证明有效上级关系者 SHALL 不再获得号码；旧页面或缓存 SHALL 不构成继续读取的凭据

#### Scenario: Authenticate the original employee by phone after migration
- **WHEN** 存量员工以手机号及原密码登录，之后合法改号
- **THEN** 登录 SHALL 始终对应原员工 ID 和业务关系，新手机号可登录，旧手机号不再作为其员工登录标识，重复手机号被拒；独立管理员以新独立账号模型和明确身份契约可登录

#### Scenario: Do not publish phone identifiers as usernames
- **WHEN** 读取普通目录、创建候选、日志筛选或通知
- **THEN** 手机号 SHALL 不因成为登录标识而作为公开用户名泄露，手机号邮箱继续遵守资料详情隐私规则

#### Scenario: Use the new phone contract and isolate administrator credentials
- **WHEN** 员工以 phone/密码及 employee 类型登录，管理员以独立账号名/密码及 admin 类型登录；再交换类型或传旧员工 username
- **THEN** 各自合法凭据 SHALL 只建立指定身份会话；错误类型无回退，旧载荷或缺类型明确拒绝，标识/密码跨类型相同不静默选身份

#### Scenario: Reject duplicate phones and preserve administrator repair access
- **WHEN** 导入数据出现重复有效员工手机号且数字管理员账号名与之相同
- **THEN** 员工登录 SHALL 拒绝歧义，显式管理员登录仍只查独立管理员凭据用于修复，不因重复员工号码被阻断或降级到员工

#### Scenario: Remove employee username without breaking internal references
- **WHEN** 新结构生成、当前接口/搜索/脚本执行及存量升级完成后检查员工数据
- **THEN** 员工用户名字段/索引和当前运行依赖 SHALL 不存在，稳定员工 ID、任务日志及操作来源可追溯，目录和审计不泄露手机号

#### Scenario: Let only administrators change employee identity
- **WHEN** 员工提交姓名/手机号修改或管理员合法改号并重置密码
- **THEN** 员工越权修改 SHALL 被拒，管理员改号后新号可登录、旧号失效且 ID 不变，旧会话撤销；重置后重新强制改密

### Requirement: Ordered reviewer routing and reassignment
创建及未发布创建申请重提 SHALL 按原创建者路由：固定创始人创建记录原因免审，其他员工由其唯一当前直属上级审核。创始人 SHALL 使用明确固定身份依据，独立管理员、任意无上级账号或损坏组织不能自动成为创始人；创始人之外无直属上级的员工 SHALL 阻断，不存在无上级免审。已配置上级不存在、失效、不可审核、跨公司或关系有环 SHALL 阻断并提示修复或恢复可用，不跨级、不走负责人路线、不解释为无上级免审。

创建负责人换序、更换或跨部门 SHALL 不改变创建审核依据；各操作预览、提交、详情、通知及审核入口 SHALL 展示实际审核人或免审原因。提交和决定 SHALL 重验当前组织关系，不能复用旧预览当权限。创建待审的直属关系变化 SHALL 重算创建人当前直属上级并留痕，旧审核人失权；已配置上级不可用时 SHALL 保持阻断，不自动上溯。

非创建的基础/负责人修改、进展、完成、重开和交接 SHALL 统一由任务当前创建者业务责任方审核：未接管为正常在任原创建者，正式接管后仅为接管人。申请人即实际审核人 SHALL 经全部操作权、排期、截止、版本、冻结、负责人及关联校验后直接生效，保留原因和历史，不生成待本人批准记录。系统 SHALL 删除最高负责人、同层保存顺序选人、负责人链上溯、创建者兜底及无审核人免审路线；负责人顺序仍保存展示，但换序/跨部门/层级/改负责人均不改变当前业务责任审核人。审核人缺失、停用、不可用或关系损坏 SHALL 阻断，不能解释为本人或无审核人免审。

预览、提交、详情、通知、待审刷新与实际决定 SHALL 使用同一审核规则并校验当前关系。组织/接管变化 SHALL 重算仍有效待审并记录前后人、原因和时间、更新通知，旧审核人不能凭旧页面/通知决定。若重算使申请人等于审核人，系统 SHALL 在统一事务中重新校验操作资格、有效版和截止后直接生效并留因；已失效、拒绝、撤销或过期申请不得复活。

#### Scenario: Preview all creator-based routes
- **WHEN** 固定创始人或其他三层员工向公司任意有效业务员工创建/重提创建
- **THEN** 创始人 SHALL 显示并记录免审，其余一律创建者直属上级，缺上级阻断，负责人排列与部门不改变路线

#### Scenario: Block an unavailable configured manager
- **WHEN** 已配置直属上级失效、不可审核、缺失、跨公司或关系损坏
- **THEN** 创建或决定 SHALL 返回可识别阻断及修复提示，不跨级、不自审、不免审

#### Scenario: Revalidate after an organization change
- **WHEN** 预览后或待审期间创建人的直属关系变化
- **THEN** 系统 SHALL 按当前创建关系裁决、同步详情和通知并留存路由原因，旧审核人不能凭旧页面决定

#### Scenario: Preserve ordered non-creation routes
- **WHEN** 任意非创建操作调整负责人保存顺序、最高层人选或跨部门
- **THEN** 实际审核人 SHALL 始终为当前创建者业务责任方，顺序仅保存展示，不恢复旧负责人路线

#### Scenario: Require explicit non-creation self-review
- **WHEN** 进展、完成、重开、修改或交接的实际审核人与申请人相同
- **THEN** 系统 SHALL 直接生效并保留原因和历史，不生成本人待审或要求本人再点击批准

#### Scenario: Persist order and route the first highest peer
- **WHEN** 同层负责人换序并保存
- **THEN** 顺序 SHALL 完整持久化并可回读，审核人不按首位或层级选择而按当前创建者业务责任方

#### Scenario: Review one's own application explicitly
- **WHEN** 本人就是当前实际审核人且全部提交校验通过
- **THEN** 系统 SHALL 直接生效，无残留本人待审及可重复决定按钮

#### Scenario: Change assignees using the proposed route
- **WHEN** 基础修改或专用交接提议将负责人从甲链改到乙链
- **THEN** 预览/提交/详情/通知/决定 SHALL 均按当前创建者业务责任方，甲乙管理链和保存顺序不选审核人；需他人审核时批准前仍保留原有效负责人

#### Scenario: Fall back or apply with a documented reason
- **WHEN** 非创建业务责任方不可用，或非创始人员工缺直属上级
- **THEN** 系统 SHALL 阻断并要求修复/正式接管，不上溯、不兜底、不以缺人免审；仅固定创始人创建及合法本人即审核人操作记录免审原因

#### Scenario: Reassign after organization changes
- **WHEN** 待审期间组织或正式接管使实际审核人变化，或申请已到截止
- **THEN** 仍有效申请 SHALL 按新统一路线重算留痕并更新通知，旧审核人失权；若变成本人审核仅在重新校验合法后直接生效，已截止/终结申请不得重新生效

### Requirement: Dedicated task handover
本人或其直属领导 SHALL 可预设交接对象并为其当前负责的任务发起专用交接申请；该权限 SHALL 仅改变负责人及其有序列表，不得用于修改任意基础字段。交接 SHALL 由当前创建者业务责任方审核，申请人为实际审核人时直接生效，否则审核通过生效，保留原创建者、创建时间、交接来源和全部历史。

专用交接 SHALL 仅允许被交接人本人或其直属上级发起，间接上级不自动代办；预设和接收候选 SHALL 以被交接人的工作关系圈为准：同部门、直属上级、直属下属，固定创始人可选公司全部有效业务员工。独立管理员、跨公司和无效人员不可作为接收人。普通负责人修改可全公司选人 SHALL 不扩大专用交接接收范围。

#### Scenario: A direct manager hands over a subordinate task
- **WHEN** 非原创建者的直属领导为下属的有效任务提交交接
- **THEN** 系统 SHALL 接受负责人交接并按当前创建者业务责任方及本人直接生效规则办理，夹带标题、排期等字段 SHALL 被拒绝；非直属领导 SHALL 无此专用权限

#### Scenario: Handover approval preserves provenance
- **WHEN** 当前创建者业务责任方批准交接或合法本人直接生效
- **THEN** 系统 SHALL 切换负责人及权限并通知新旧相关人员，原创建者、创建时间及交接来源 SHALL 保留；未通过时 SHALL 保持原有效版本

#### Scenario: Distinguish direct manager handover from indirect management
- **WHEN** 间接上级和直属上级分别为同一下属发起交接，并尝试选择工作圈之外人员
- **THEN** 间接上级 SHALL 被拒，直属上级仅可选被交接人合法关系圈；管理员不代办业务，合法交接也不得夹带标题/排期修改

### Requirement: Complete task operation history
管理端 SHALL 可按任务追溯具体字段前后值、有序负责人变化、申请/版本、申请人与审核人、决定意见、改派、失效、交接、完成、重开和无需审核原因。App SHALL 仅展示当前有效资料、有效进展、相关申请及审核意见，不开放完整历史。通知删除/撤回/清理 SHALL 不删除业务历史，历史 SHALL 不包含密码或他人手机号。

历史 SHALL 独立保存固定组织调整、正式业务接管对象/前后责任方、时间、管理员办理人和原因，以及本人直接生效的真实操作者和免审原因；原创建者及创建时间不覆盖，接管任务不标成接管人原始创建。管理员来源 SHALL 可追溯但不伪装成业务申请人或审核人。

#### Scenario: Inspect an ordered assignee change and reassignment
- **WHEN** 管理员查询一个发生负责人换序、改派、失效和交接的任务
- **THEN** 系统 SHALL 展示每次实际变动、前后人选、时间、原因及结果，而非仅事件类型和 ID；App 用户 SHALL 不能查询完整历史

#### Scenario: Retain history after message removal
- **WHEN** 关联消息删除、撤回或到期清理
- **THEN** 全部任务操作记录 SHALL 继续可查，已生效状态 SHALL 保持

#### Scenario: Locate a task in the formal PC history interface
- **WHEN** 管理员从正式任务历史栏目查找或定位任务，不借助调试页
- **THEN** 页面 SHALL 完整展示时间、操作人、字段前后值、有序负责人、申请决定意见、改派、失效、交接、重开和免审原因；普通员工接口访问被拒

#### Scenario: Trace takeover and direct application without rewriting provenance
- **WHEN** 任务创建后发生业务接管、本人直接生效和通知清理
- **THEN** 管理历史 SHALL 保留原创建者/时间、接管前后责任方/对象/办理人/原因及免审记录，通知清理不删除历史，员工仍无完整历史接口权

### Requirement: Shared single-select tags for tasks and logs
任务和日志 SHALL 共用本公司标签目录，每对象可不选或只选一个，选新替换旧，前后端拒绝多标签及跨公司引用。只有具备公司明确固定创始人身份的业务员工 SHALL 从员工 Web“我的→标签管理”创建、改名、从预定义色板选色和删除，不要求管理员身份；其他员工只能在有对象编辑权时选择清除，其他上层和仅管理员不得维护。任务标签 SHALL 随当前创建者业务责任方审核/本人直接生效及有效版规则，日志标签随原编辑及冻结规则。

日志列表 SHALL 显示标签，任务/日志详情显示“背景色＋内容”药丸，日程直接用唯一标签背景；无标签任务统一默认粉色非白底，该粉色不入标签色板，文字可读。改名改色 SHALL 更新当前引用但不重写既有审计。删除 SHALL 逻辑删除、禁止新引用，已有引用保留删除时名称颜色并标“已删除”，有权编辑可清除替换，不级联删除任务、日志或历史。

#### Scenario: Enforce root-only maintenance and single selection
- **WHEN** 创始人及其他员工或管理员维护标签，或一次提交多个标签
- **THEN** 仅固定创始人 SHALL 有维护入口与接口权限，任意无上级账号不因此获得权限，多标签和越权维护拒绝，合法单选刷新后持久且任务日志共用

#### Scenario: Rename recolor and delete a referenced tag
- **WHEN** 标签改名改色后删除且仍被业务引用
- **THEN** 当前引用 SHALL 随更新，删除后保留删除时值及标记，候选移除且新关联拒绝，历史和业务对象不被清除

#### Scenario: Respect review freezing and calendar color
- **WHEN** 用户改需审任务标签、改冻结/他人日志标签或查看无标签任务
- **THEN** 需他人审核的任务标签 SHALL 批准后才生效，本人即审核人时合法直接生效，冻结/越权日志拒绝，无标签粉色与色板区分，跨页面颜色及名称一致

### Requirement: Notification lifecycle and historical access
通知 SHALL 绑定自己的事件和业务对象，任务业务通知还须绑定任务及适用原申请，评论通知绑定其任务或日志和评论；打开即已读并同步未读数；原申请办结 SHALL 置灰展示其结果且无有效审核按钮，不得转向同任务后续申请。本人删除仅影响本人副本。通知 SHALL 自事件产生时刻起保留三个公司时区日历月，月末截到目标月最后一天，到期时不再可用。业务发起人及有通知管理权的管理员 SHALL 仅在事件产生后严格少于 180 秒时撤回，自动提醒仅管理员可管理；撤回保留提示并移除跳转，普通接收人移除正文，不改变业务、申请或审计；下述受限上级原内容只读例外 SHALL 独立适用。

已送达、未删除、未撤回且未到期的普通任务业务通知（不含评论通知）的原接收人，在失去当前任务权限后 SHALL 仍可读取保留标题/摘要并从该通知进入当前已生效任务的专用只读详情，展示关系/授权撤销提示。此例外 SHALL 不开放提议、diff、受限关联、手机号、他人日志或任何业务操作，不加入正常列表、搜索、计数、首页或分析。未送达消息 SHALL 不因候选接收人记录而授予例外。

通知列表 SHALL 不显示底部刷新/关闭操作栏，并保留头部关闭入口；键盘 Tab 焦点范围 SHALL 包含头部关闭按钮，空列表也 SHALL 可关闭。此列表布局 SHALL 不改变消息详情的业务操作及自动已读要求。

原消息接收人若为业务发起人当前实际管理链上级，且其副本送达时未屏蔽、未个人删除、未过期，撤回后 SHALL 可只读原标题、摘要及变更摘要并显示原因；其他上层、同级、其他管理链或仅管理员身份不因此获员工通知原文。该例外 SHALL 不开放任务/申请跳转、审核、完整载荷、受限提议或手机号，也不得补回送达屏蔽内容。

评论通知 SHALL 始终重验评论存在、未删除且接收人具有所属对象当前正常查看权；任一条件失败，列表/详情 SHALL 隐藏评论正文并移除任务、对象、申请/审核跳转，通知历史任务入口拒绝访问。此约束 SHALL 同样适用于撤回后当前上级只读例外，不能以历史通知或管理链恢复受限评论；不改变普通任务通知独立历史只读例外。

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

#### Scenario: Never revive inaccessible comments through old notifications
- **WHEN** 评论被删除、缺失或对象失权后，原接收人或符合撤回上级例外者打开旧通知/历史任务入口
- **THEN** 系统 SHALL 隐藏正文和所有任务/对象/审核跳转并拒绝历史任务入口；普通非评论任务通知仍依其历史只读规则办理

### Requirement: Flat comments with author control and targeted notifications
有对象当前正常查看权者 SHALL 可在任务和日志详情底部读取、发表平铺评论，显示作者、发表时间和正文，按发表时间顺序稳定分页；评论直接属于对象，不支持楼中楼、子评论或回复层级。作者在仍有对象正常访问权时 SHALL 随时编辑删除自己的评论，不受日志 24 小时、任务完成、业务待审限制，无需任务审核；其他人包括任务负责人或日志作者不能管理他人评论。修改 SHALL 标已编辑，删除不再展示正文。

所有读写 SHALL 后端检查当前对象权限及适用作者身份，历史通知只读例外和失权旧页面 SHALL 不取得正常评论读写权。评论不改变进展、任务状态、正文、冻结时间或待审版本。

新评论 SHALL 仅通知任务当前有效全体负责人或日志作者，接收人去重并排除评论者，不额外通知任务创建人、审核人、其他评论者或全体可见人。通知 SHALL 含对象名称和评论用途并定位详情评论区，送达及打开重验对象权限；编辑删除不发新通知，已删除评论的通知 SHALL 不再展示正文摘要。

评论被删除、缺失或对象正常查看权撤销后，其旧通知 SHALL 隐藏正文、任务/对象/审核跳转并拒绝通知历史任务入口；撤回后上级只读例外亦不得恢复受限评论内容。不得将普通任务通知的历史只读例外扩展至评论。

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

#### Scenario: Preserve comment redaction under new organization scopes
- **WHEN** 组织调整或业务接管后原评论接收人失去对象正常权，或评论删除/缺失
- **THEN** 评论读写及旧通知 SHALL 按当前对象权拒绝或裁剪，撤回后的上级资格不恢复正文/跳转，当前有正常访问权且评论有效者仍可正常读取

### Requirement: Persistent demonstration data for web and administration
系统 SHALL 准备手机号登录的员工演示账号及后端持久数据，按新固定组织重建演示身份与组织关系，业务使用稳定内部标识；十大公司重要事项为十条并能展示列表和卡片等样式，业务数据覆盖通知、待审核、任务表单、部门团队及下属日志任务，足以展示筛选、排序、分页及布局。同一账号 SHALL 按真实权限连续展示表单与下属日志任务，刷新仍可用，不用前端静态假数据替代，不按记录日期推算新演示日期。

演示组织 SHALL 含固定创始人、至少两个部门且每部门多个团队、完整单负责人/普通员工及必填职位/有效手机号，独立管理员不占员工位置。任务 SHALL 覆盖跨部门多负责人、仅创建不负责、专用交接及正式接管；审核覆盖创建直属上级、非创建业务责任方、本人直接生效、拒绝、撤销、失效、完成/重开。

排期 SHALL 覆盖跨月/跨年/跨日、午夜截止、零时长、整日覆盖及超过五项重叠；表单超过两页以验全结果筛选排序分页。日志 SHALL 覆盖部门/团队直接及间接下属、近三天、冻结/删除重建；标签/评论/通知含撤权边界。准备流程 SHALL 显式指定目标演示库，可重复执行而无重复/非法组织，不在应用启动时清空任意数据库；刷新及重启后数据持久。演示重构可替换旧数据，但不是结构约束或升级验证的替代。

#### Scenario: Run a continuous demo after refresh
- **WHEN** 选定手机号账号登录后展示首页、通知、审核、表单和下属日志任务并刷新
- **THEN** 同一账号 SHALL 有对应合法数据权限，十条公司事项及业务数据仍在，可实际筛选排序分页，不需伪造身份

#### Scenario: Prepare a complete repeatable new-model demonstration
- **WHEN** 在显式指定的演示库连续准备两次并重启，使用四层账号及独立管理员展示
- **THEN** 系统 SHALL 不重复插入，所有规定组织、审核、接管、日历和超过两页表单用例可实际操作，标签/评论/通知/日志及十条公司事项持久，无前端伪造身份或静态结果

## ADDED Requirements

### Requirement: Atomic employee deactivation and formal business takeover
管理员 SHALL 在停用员工前一次安排完整业务结果：未完成任务负责人交接、负责人岗位继任和下属位置、未发布创建申请办结或撤销、待办审核承接，以及已发布任务后续修改/重开/审核责任的正式接管。创始人不允许普通停用。接管人 SHALL 为公司有效业务员工，独立管理员不可接管或担任业务审核人。

正式业务接管 SHALL 独立记录对象、前后责任方、办理人、时间和原因，不覆盖原创建者/创建时间/历史来源；同任务任意时刻只允许一个当前创建者业务责任方。接管人 SHALL 按接管关系获得必要的正常任务访问、基础修改/负责人修改/重开及审核权，原创建者停用后不再承担后续责任，不能把接管任务计成接管人原始创建。

完整结果 SHALL 校验待审状态、截止、任务及组织版本和有效接收/接管人并原子提交，失败保留原组织及业务；必要交接申请在需他人审核时 SHALL 先办结，正式停用不得跳过既定任务审核。未发布创建申请的原申请人不被改写，无法在停用前办结者 SHALL 由原申请人或专用停用命令中的管理员撤销并留因，此管理例外仅限未发布创建申请，不转造接管人创建。业务接管 SHALL 同步重算仍有效待审与通知、更新权限版本及撤销停用人员会话，不产生停用审核人、双重责任或旧申请复活。

#### Scenario: Reopen taken-over completed work with active assignees
- **WHEN** 已完成任务的原负责人已停用，当前业务接管人重开任务并同步提交新的有效负责人及完整未来排期
- **THEN** 系统 SHALL 允许按全公司有效业务员工范围选择有序非空负责人并与重开原子直接生效，保留原创建来源并增加执行轮次；缺有效负责人、排期或版本冲突 SHALL 拒绝整次重开，不自动将接管人添加为负责人

#### Scenario: Deactivate an employee only after all responsibilities are arranged
- **WHEN** 管理员停用同时是单位负责人、任务负责人、创建者及待审参与人的员工
- **THEN** 系统 SHALL 要求完整继任/交接/未发布申请处理/业务接管方案，未办结的必要审批或任何非法/过期/版本冲突均拒绝整次停用，成功后不存在无人负责岗位、无有效负责人任务或停用审核人

#### Scenario: Take over published work without impersonating its creator
- **WHEN** 管理员指定合法业务接管人接管已发布任务并停用原创建者
- **THEN** 接管人 SHALL 获必要访问及后续办理/审核权，原创建者和创建时间仍显示为原始来源，我创建筛选不把任务归给接管人，历史显示接管人/办理人/对象/时间/原因；管理员不获得业务权

#### Scenario: Refresh valid reviews and revoke old authority atomically
- **WHEN** 接管、组织调整、旧审核决定、截止扫描及相同请求重放发生竞争
- **THEN** 系统 SHALL 仅提交一个合法最终结果，旧审核人/停用会话无办理权，当前有效申请按新责任方刷新并留痕，过期或终态不复活，本人即审核人只在全校验后直接生效

### Requirement: Convergent organization and identity schema upgrades
系统 SHALL 通过新增数据库迁移达到固定创始人/组织位置、必填展示职位、独立管理员、员工用户名清理及业务接管目标结构；不修改已应用历史迁移。新建库与从当前结构升级的库 SHALL 获得一致最终结构与约束，不要求必须重建演示库才能运行。

非演示升级 SHALL 保留稳定员工和业务历史标识，以显式映射处理旧组织；无法证明的创始人、负责人、位置、管理员或重复手机号 SHALL 报告并阻断相关正式业务，不任意猜测、不赋予免审或旧授权。迁移准备/修复不依赖员工用户名生成或残留旧授权。最终结构 SHALL 以外键、唯一性、位置约束和完整结果事务防止非法关系，账号拆分后管理操作来源仍可追溯。

#### Scenario: Compare fresh installation with an upgraded database
- **WHEN** 分别在隔离空库执行完整迁移、在当前版本结构及映射数据上执行新增迁移
- **THEN** 最终组织/身份/接管结构和约束 SHALL 一致，无员工用户名字段/索引和旧授权运行依赖，升级保留业务内部标识、原始创建来源及管理员审计

#### Scenario: Block an unresolvable mapping without fabricating identity
- **WHEN** 升级发现缺失负责人、孤立根节点、重复手机号或管理员与员工来源不能合法拆分
- **THEN** 系统 SHALL 报告具体映射阻断并提供受控管理员修复，未解决前相关正式业务不开放，不猜测创始人/上级、跳过外键或以无人审核直接生效
