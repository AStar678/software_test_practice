## ADDED Requirements

### Requirement: Flutter monthly calendar week expansion and drop feedback

本人和下属的 Flutter 月历 SHALL 仅在公司今天的日期数字所在行使用粉色底色，任务区域保持常规底色及原任务条颜色，整格点击范围不变。该高亮也适用于展开周。

每个月份的现有年月标题行 SHALL 提供有可访问名称的展开入口，按日期范围选择与该月相交的一周。选择后，周一至周日 SHALL 占满原月历内容区域；跨月、跨年的一周包含七个可点击的真实日期。网格不滚动、不可捏合调高，不新增周切换滑动，也不新增占用月历空间的工具栏。收起入口 SHALL 位于对应标题位置；普通月历的日期、任务点击区域及拖动不被展开入口遮挡或挤占。

展开周 SHALL 沿用月历权限、任务可见性、任务条样式和溢出规则，按可用高度显示任务条及真实 `+N`。日期格、任务条和 `+N` 仍按实际命中日期打开可滚动的完整当天清单。清单或日视图关闭 SHALL 返回来源的展开周，手动收起 SHALL 恢复展开前的月历浏览位置和密度。切换人员或账号不得继承对方的周展开状态。

本人在展开周长按可拖动任务条后 SHALL 保留实际抓取日期；指针开始拖动时收回月历，所选周仍可见，同一次手势继续整条移动。只长按后松手 SHALL 不收回、不打开当天清单、不发起改期；展开周不提供端点调整，普通月历的端点功能保持。下属的月、周、日视图 SHALL 均不提供拖动、端点或键盘改期，其他业务操作保持只读，有权限的评论仍可用。

本人在普通月历拖动整条或端点，或从展开周接续拖动时，SHALL 对当前有效的目标日期格显示同一种清晰高亮，与今天的日期行粉底可区分，且不改变网格尺寸或任务条颜色。划过月份标题、月外补位日期或视口外时 SHALL 清除高亮，不将这些位置视为有效落点。靠边滚动及切换视图后 SHALL 按可见月历重新判断目标。放开在有效目标 SHALL 沿用现有排期预览和确认，且目标日期与高亮一致；无位移、无效落点和取消不写入。普通月历既有向相邻月份自动滚动以及在目标月份的有效日期格落下的规则不变。

#### Scenario: Highlight today's header without tinting task lanes
- **WHEN** 本人或下属在月历或展开周查看有粉色任务条的公司今天
- **THEN** SHALL 只有日期数字所在行带有今天粉底，任务条和任务区域保持原样，点击仍进入当日清单

#### Scenario: Expand a boundary week without displacing the month calendar
- **WHEN** 本人或下属从月份标题选择跨月或跨年的一周，滑动网格，点击任务续接段或 `+N` 并浏览清单，再关闭清单和收起一周
- **THEN** SHALL 显示七个真实日期和授权任务，周网格填满原月历区域但不滚动；清单可滚动且日期按实际命中计算，关闭返回展开周，收起恢复原月历位置和密度

#### Scenario: Continue an eligible week drag in the month without releasing
- **WHEN** 本人在展开周长按一个可拖动的跨日任务条，在其非首日开始移动并指向月历另一有效日期后松手
- **THEN** SHALL 保留实际抓取日、让所选周仍可见并在同一手势中高亮有效目标；确认按抓取日与落点的日期差整体平移任务，未确认不写入

#### Scenario: Use the same drop feedback and reject placeholders
- **WHEN** 本人在普通月历整条或端点拖动，靠边滚到相邻月份并移过补位日期，再移到该月份的有效日期格
- **THEN** SHALL 只高亮当前有效落点，补位日期释放不进入确认；有效格释放按其实际日期进入现有确认，取消不写入

#### Scenario: Keep read-only browsing and a stationary hold non-mutating
- **WHEN** 本人长按展开周任务后不移动即松手，或在下属日程尝试长按、拖动或键盘改期
- **THEN** SHALL 不因这些手势改变浏览模式、弹出排期确认或写入，普通短按仍打开当天清单，授权评论仍可用

### Requirement: Flutter time pickers accept typing only

Flutter 所有选择时分的弹窗 SHALL 只允许使用键盘输入，不显示大表盘，也不提供切换到表盘的操作。新建、编辑（含重提）及重开任务的开始、截止时分均适用；日期选择、时间格式、初始值、确认取消、校验与保存语义不变。

#### Scenario: Type a start or due time in each task flow
- **WHEN** 用户在新建、编辑或重开任务选择开始或截止时分，尝试输入非法时分，并分别取消或确认有效时分
- **THEN** SHALL 只显示时分输入且没有切换表盘入口；非法输入按原规则阻止确认，取消不改原值，确认应用有效时分，日期选择器仍可用

## MODIFIED Requirements

### Requirement: Calendar task views
日历 SHALL 仅有月、日两种模式，默认月模式，月模式按月、日模式按天前后导航；日模式可保留可点的一周日期行，但 SHALL 不新增独立周模式或整周滑动。Flutter 月模式内的单周展开按 Flutter monthly calendar week expansion and drop feedback 执行，不构成独立周模式。所有月格、日轴、全天区、跨日任务及当日清单 SHALL 仅展示本人当前为有效负责人的正常任务，含已完成任务；本人仅创建、仅组织可见、待创建、未发布和历史通知只读例外 SHALL 不进入日历。日历 SHALL 移除下属日程切换，其他入口合法权限 SHALL 不被收窄。

顶部 SHALL 提供左侧展开、可点年月日期选择及明确“任务表单”入口，侧面板 SHALL 承载月/日切换和本人申请；右下悬浮加号 SHALL 打开原创建表单且不遮挡导航或关键内容。收起后 SHALL 以日历为主体，日模式可回今天，不增加普通名称搜索及统计区。表单返回 SHALL 保留日历模式和日期。

月视图 SHALL 周一至周日排列，保留可调整月格高度、键盘调整、本地保存及最多两行标题截断和时间辅助信息。容量不足 SHALL 显示真实隐藏数量并可打开完整当日清单；月格及清单 SHALL 本人置顶优先，同组开始升序、任务标识稳定排序。置顶 SHALL 不改紧急度、他人顺序或真实时段。跨日/跨周跨度 SHALL 可辨。

月模式任务瀑布流 SHALL 可上下连续浏览前后月份及跨年，按位置补充相邻月份并显示边界，不以月份选择器作为跨月唯一入口；年月选择、回今天及日期导航 SHALL 继续可用。补载 SHALL 保持滚动位置，不重复相邻月边界日内容、不遗漏跨月任务；失败 SHALL 可重试，不把部分数据标为完整。

日模式默认 SHALL 提供可横滚的 00:00—24:00 横向排期轴，每个任务独立一行、整日覆盖也在该轴展示且不重复；同时保留纵向时间轴切换。纵向模式 SHALL 提供可竖滚的 00:00—24:00 完整时间轴及独立全天区，可保留辅助清单。非全天跨日任务 SHALL 按日真实覆盖分类，完整覆盖某业务日者仅进该天全天区，其余逐日在时间轴显示真实覆盖时段，午夜截止不生成次日副本，零时长任务可识别。重叠任务 SHALL 在当天宽度内全量横向分栏，全天任务 SHALL 全量逐项展示或滚动访问，不以五项上限或“+N”隐藏。短任务点击区域 SHALL 不遮挡其他任务或改写真正时段；置顶仅强调。任务背景 SHALL 仅使用有序共用标签集合中第一个标签颜色，不提供私人标签或颜色覆盖，无任何有效或保留标签时统一使用色板外的默认粉色非白底，文字、非纯色关系提示及无障碍名称 SHALL 可读。

左上角 SHALL 打开从左侧进入、仅覆盖日程区域约 40%—45% 宽度的抽屉，不挤压或改变底层日历尺寸，窄屏仍在右侧保留明显日历；内容换行/纵向滚动，不自动全屏。抽屉 SHALL 提供月/日切换、“我的申请”和关闭入口，删除“日历只显示本人当前负责的正常任务，可使用任务表单查看其他授权任务。”；遮罩、返回、Esc 和关闭入口均可收起。打开期间 SHALL 阻止底层误点/误滚动，键盘焦点限制在可操作抽屉内，关闭恢复原日历位置及触发入口焦点，不把焦点留在隐藏内容。

除已完成识别的整条/端点拖动及其键盘操作外，月格日期数字、空白、任务条和 `+N` 的普通点击 SHALL 统一从底部打开当天完整任务清单，不直接进入详情或日模式；跨日条 SHALL 根据实际命中日期而非任务开始日或条首日定位，滚动、调高与双指手势不得触发点击。底部清单 SHALL 展示日期、“查看日视图”和关闭入口，按任务标识去重、含已完成任务，沿用本人置顶/开始时间/稳定标识顺序；空态可按该日期创建。仅清单内点任务打开原详情，关闭详情 SHALL 返回原清单及滚动位置；查看日视图进入该天。关闭清单 SHALL 恢复原月历日期、密度及滚动位置。手柄下拖或正文已在顶部继续下拉 SHALL 可关闭，普通正文滚动不误关；同时保留按钮、遮罩、返回及 Esc 关闭和正确焦点恢复。

在纵向模式，原始全天任务以及起止区间完整覆盖当前公司业务日 `[00:00, 次日00:00)` 的定时任务 SHALL 紧凑展示在当天全天区，且不在该天时间轴重复。首尾不足整天的覆盖仍在时间轴；午夜截止无次日副本，零时长不得误判整天。此归类 SHALL 仅为显示，不更改原始 `allDay`、开始、截止、工期、提醒节点或详情排期，全天区全量可访问，剩余定时任务仍按真实覆盖及完整并发关系分栏。

日历排期交互 SHALL 遵循按视图区分的拖动规则：月历按日绘制并按天调整，日轴按小时，拖动仅在本人视图提供。已发布任务在后续审核中 SHALL 使用独立日历展示投影并显示虚线；申请含新排期时只在提议位置显示，普通详情、任务表单及提醒仍使用有效版，不提前发布提议。

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
- **THEN** 纵向日轴 SHALL 按当天实际覆盖时段竖向绘制，午夜截止无次日副本，零时长可点且不伪造工期，完整覆盖该业务日的定时任务进入当天全天区，部分覆盖仍在时间轴

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
- **THEN** 纵向日轴 SHALL 按当天实际覆盖时段竖向绘制，午夜截止无次日副本，零时长可点且不伪造工期，完整覆盖该业务日的定时任务进入当天全天区，部分覆盖仍在时间轴

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
- **THEN** 系统 SHALL 不误开任务、创建、切日或切模式，日视图不新增独立周模式或整周滑动

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
- **THEN** 纵向日轴 SHALL 按当天实际覆盖时段竖向绘制，午夜截止无次日副本，零时长可点且不伪造工期，完整覆盖该业务日的定时任务进入当天全天区，部分覆盖仍在时间轴

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
- **THEN** 纵向模式下周二 SHALL 在轴上显示20:00—24:00、周三仅在全天区、周四在轴上00:00—10:00；午夜截止无次日副本、点任务不全天，原排期、allDay 和提醒不变

### Requirement: Flutter calendar day entrances and anchored return

本人和下属日程 SHALL 共用两条日视图路径。月历时顶栏「今天」左侧的模式按钮（图标和无障碍名称随当前动作变化）SHALL 直接进入公司今天的日视图，不取滚动锚点或此前选中的日期；即使当前月历未加载今天所在月份，也 SHALL 正确加载当天授权任务，不把未加载或加载失败显示成无任务。日视图时该按钮返回来源日历；月历的「今天」按钮仍用于定位回公司今天。月格、普通短按任务条或 `+N` 仍按实际命中日先开当天清单；清单中的视图按钮显示「日视图」，切入后同一位置显示「清单」，往返切换为同一日期。直接进入日视图也能通过该按钮看同日清单。清单关闭或从日视图返回 SHALL 恢复原日历状态、日期和滚动位置，打开详情再返回恢复来源显示方式、人员、日期及清单位置。本人、各下属和不同登录账号的状态互不影响。

清单与日视图标题 SHALL 通过既有年度接口显示该日已有官方节假日名称与「休／班」；没有记录时不显示任何标记或占位，也不把普通周末推断为官方调休。下属入口仍只可浏览及在有权时评论，不增日历或业务写权限。

#### Scenario: Use both day entrances and return without jumping
- **WHEN** 在本人和下属的跨月滚动位置分别从顶栏进入日视图、从非今天的月格进入清单再切日视图，并打开任务详情后逐级返回
- **THEN** 顶栏入口 SHALL 展示公司今天及其任务，月格入口使用实际点击日期；日视图可切同日清单，维持同一人的状态及正确返回层级，返回日历恢复原日期、滚动和触发入口，不跳到月首或今天

#### Scenario: Show optional real holiday marks across a year boundary
- **WHEN** 查看跨年日期中的官方休假、调班、普通日期及没有可用年度记录的日期
- **THEN** 同一天清单与日视图 SHALL 使用相同节日名称与休班值；缺少具体记录时不显示标记，不阻断任务读取，不改变排期

### Requirement: Flutter log filtering previews and post-save freshness

本人和下属日志列表 SHALL 用同一个「筛选」入口管理现有业务日期起止条件，支持应用、取消及清除；取消不提交新条件，不改变人员范围或既有分页口径。列表正文最多三行，仍有未展示正文时第三行 SHALL 明确显示省略号，即使第三行刚好填满或仅因原文换行隐藏了后续一行；完整正文未截断则不添省略号。详情保留完整原文。

本人日志保存成功后 SHALL 无需手动刷新，返回详情和列表均展示已保存版本，同时保留日期筛选与原浏览位置；失败、取消或旧响应不得伪装成功、覆盖已保存内容或污染另一账号/下属。实际冻结日志在本人和下属的列表及详情 SHALL 只使用「已不能编辑」状态标记；下属权限只读但尚未冻结的日志不冒充冻结，不出现编辑入口，合法评论不受影响。

#### Scenario: Distinguish an exact preview fit from a hidden fourth line
- **WHEN** 本人和下属列表中分别有恰好三行、第三行只因换行隐藏第四行及窄屏自动折行的日志
- **THEN** 只有未显示完整的正文 SHALL 有省略号，最多三行，详情显示全文；两处筛选都按业务日期且不混用人员状态

#### Scenario: Return from a real save without manual refresh
- **WHEN** 用户从有筛选且已滚动的本人日志列表进入详情、编辑并保存，返回详情再返回列表
- **THEN** 两处 SHALL 自动显示同一已保存版本，保留筛选和滚动位置，不让旧读取覆盖；冻结日志或下属日志不出现本人编辑入口

#### Scenario: Read the same shorter badge in both personal and subordinate logs
- **WHEN** 用户查看本人和下属的冻结日志，并对比尚未冻结的下属日志列表和详情
- **THEN** 冻结项在列表和详情 SHALL 显示「已不能编辑」，仅因下属路径只读的记录不显示此标记，原编辑限制和评论权限不变
