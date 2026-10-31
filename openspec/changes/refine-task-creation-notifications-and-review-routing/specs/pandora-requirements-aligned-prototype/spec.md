# Spec Delta

## MODIFIED Requirements

### Requirement: Calendar task views
日历 SHALL 仅有月、日两种模式，默认月模式，月模式按月、日模式按天前后导航；日模式可保留可点的一周日期行，但 SHALL 不新增周视图或整周滑动要求。所有月格、日轴、全天区、跨日任务及当日清单 SHALL 仅展示本人当前为有效负责人的正常任务，含已完成任务；本人仅创建、仅组织可见、待创建、未发布和历史通知只读例外 SHALL 不进入日历。日历 SHALL 移除下属日程切换，其他入口合法权限 SHALL 不被收窄。

顶部 SHALL 提供左侧展开、可点年月日期选择及明确“任务表单”入口，侧面板 SHALL 承载月/日切换和本人申请；右下悬浮加号 SHALL 打开原创建表单且不遮挡导航或关键内容。收起后 SHALL 以日历为主体，日模式可回今天，不增加普通名称搜索及统计区。表单返回 SHALL 保留日历模式和日期。

月视图 SHALL 周一至周日排列，保留可调整月格高度、键盘调整、本地保存及最多两行标题截断和时间辅助信息。容量不足 SHALL 显示真实隐藏数量并可打开完整当日清单；月格及清单 SHALL 本人置顶优先，同组开始升序、任务标识稳定排序。置顶 SHALL 不改紧急度、他人顺序或真实时段。跨日/跨周跨度 SHALL 可辨。

月模式任务瀑布流 SHALL 可上下连续浏览前后月份及跨年，按位置补充相邻月份并显示边界，不以月份选择器作为跨月唯一入口；年月选择、回今天及日期导航 SHALL 继续可用。补载 SHALL 保持滚动位置，不重复相邻月边界日内容、不遗漏跨月任务；失败 SHALL 可重试，不把部分数据标为完整。

日模式默认 SHALL 提供可横滚的 00:00—24:00 横向排期轴，每个任务独立一行、整日覆盖也在该轴展示且不重复；同时保留纵向时间轴切换。纵向模式 SHALL 提供可竖滚的 00:00—24:00 完整时间轴及独立全天区，可保留辅助清单。非全天跨日任务 SHALL 按日真实覆盖分类，完整覆盖某业务日者仅进该天全天区，其余逐日在时间轴显示真实覆盖时段，午夜截止不生成次日副本，零时长任务可识别。重叠任务 SHALL 在当天宽度内全量横向分栏，全天任务 SHALL 全量逐项展示或滚动访问，不以五项上限或“+N”隐藏。短任务点击区域 SHALL 不遮挡其他任务或改写真正时段；置顶仅强调。任务背景 SHALL 使用个人标签颜色（有私人覆盖时），否则使用有序共用标签集合中第一个标签颜色，无任何有效或保留标签时统一使用色板外的默认粉色非白底，文字、非纯色关系提示及无障碍名称 SHALL 可读。

左上角 SHALL 打开从左侧进入、仅覆盖日程区域约 40%—45% 宽度的抽屉，不挤压或改变底层日历尺寸，窄屏仍在右侧保留明显日历；内容换行/纵向滚动，不自动全屏。抽屉 SHALL 提供月/日切换、“我的申请”和关闭入口，删除“日历只显示本人当前负责的正常任务，可使用任务表单查看其他授权任务。”；遮罩、返回、Esc 和关闭入口均可收起。打开期间 SHALL 阻止底层误点/误滚动，键盘焦点限制在可操作抽屉内，关闭恢复原日历位置及触发入口焦点，不把焦点留在隐藏内容。

除独立起止调整手柄外，月格日期数字、空白、任务条和 `+N` 的任意点击 SHALL 统一从底部打开当天完整任务清单，不直接进入详情或日模式；跨日条 SHALL 根据实际命中日期而非任务开始日或条首日定位，滚动、调高与双指手势不得触发点击。底部清单 SHALL 展示日期、“查看日视图”和关闭入口，按任务标识去重、含已完成任务，沿用本人置顶/开始时间/稳定标识顺序；空态可按该日期创建。仅清单内点任务打开原详情，关闭详情 SHALL 返回原清单及滚动位置；查看日视图进入该天。关闭清单 SHALL 恢复原月历日期、密度及滚动位置。手柄下拖或正文已在顶部继续下拉 SHALL 可关闭，普通正文滚动不误关；同时保留按钮、遮罩、返回及 Esc 关闭和正确焦点恢复。

在纵向模式，原始全天任务以及起止区间完整覆盖当前公司业务日 `[00:00, 次日00:00)` 的定时任务 SHALL 紧凑展示在当天全天区，且不在该天时间轴重复。首尾不足整天的覆盖仍在时间轴；午夜截止无次日副本，零时长不得误判整天。此归类 SHALL 仅为显示，不更改原始 `allDay`、开始、截止、工期、提醒节点或详情排期，全天区全量可访问，剩余定时任务仍按真实覆盖及完整并发关系分栏。

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

### Requirement: Role-scoped task creation and assignment
任何本公司有效员工创建、重提创建申请及后续合法修改负责人时 SHALL 可选择本公司全部有效员工，包括其他部门、直属上级和创始人；候选、提交及批准检查 SHALL 一致，不受旧角色、同团队或旧创建派发配置限制。独立管理员、失效及跨公司人员 SHALL 不作为员工候选。部门 SHALL 使用真实部门，选人 SHALL 按创始人、部门负责人、团队负责人、普通员工的实际直属关系构成可展开树，并支持部门和姓名搜索、有序多选、跨部门保留、确认及取消还原。展开节点不自动选择该人员或其下属，勾选人员不改变展开状态；搜索展示命中人员及必要祖先路径，隐藏或折叠不清空已选人员。

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

#### Scenario: Expand and select a real hierarchy
- **WHEN** 用户展开多个部门/团队、选择管理人员和员工、折叠祖先后确认或取消
- **THEN** 系统 SHALL 逐层展示真实下级、保留跨分支已选和顺序，确认回写草稿，取消还原；同名人以部门/职位区分，无下级节点不显示展开按钮，目录不包含电话邮箱

### Requirement: Task editing and completion review
仅任务当前创建者业务责任方（原创建者正常在任时为原创建者、正式接管后为接管人）SHALL 可修改基础信息/负责人及重开已完成任务；当前负责人仅可申请每次新增/修改文字进展与完成；专用交接仅依交接要求开放。需要他人审核的创建、修改、每次进展、完成、重开及交接 SHALL 先待审；申请人为固定创始人时 SHALL 校验通过后直接生效并保留免审原因，不留本人待审。需要他人审核时 SHALL 同任务唯一待审并冻结其他任务业务变更（有当前正常访问权者的独立评论除外），只有申请人能撤销；仅停用前未发布创建申请可按专用管理处置撤销并留因，该例外不开放任意业务申请代撤。修改提议须先撤销再重提。普通区域 SHALL 保留原有效版本，申请人可看自己提交的内容/状态/结果，只有本次审核人可获得原版与提议的专用 diff，不能靠前端隐藏代替字段裁剪。

执行状态 SHALL 为待开始/进行中/已完成，与待审/通过/拒绝或退回/撤销/失效分开。首次进展审核通过或合法直接生效后待开始变进行中；完成通过变已完成、退回变进行中且须意见、撤销恢复提交前状态；当前创建者业务责任方重开可一并提出完整有效排期，通过回到进行中并增加轮次，拒绝/撤销保留已完成。普通修改或进展拒绝/撤销 SHALL 保留原版；待审到期按失效要求保留提交前状态并解冻。

#### Scenario: Freeze and cancel an application
- **WHEN** 多名负责人同时提交进展/完成，或非申请人尝试撤销
- **THEN** 系统 SHALL 最多产生一个待审并冻结其他任务业务变更（独立评论除外），只有申请人可撤销，原创建者或审核人 SHALL 不能替他撤销；仅未发布创建申请适用停用管理处置的受控例外

#### Scenario: Restrict comparison data to the reviewer
- **WHEN** 申请人、审核人及普通任务查看者分别读取同一变更
- **THEN** 审核人 SHALL 可看逐项 diff，申请人仅看提交内容及结果而无专用原版对比字段，普通人 SHALL 只见旧有效版和冻结；固定创始人免审的合法操作 SHALL 已直接生效，不生成待本人决定的申请；历史对比仍仅授权审核身份

#### Scenario: Distinguish completion outcomes
- **WHEN** 负责人提交完成后分别发生通过、退回或撤销
- **THEN** 系统 SHALL 分别进入已完成、进行中或恢复提交前执行状态，退回 SHALL 要求意见，所有路径 SHALL 解除待审冻结并保留结果

#### Scenario: Reopen with a new schedule
- **WHEN** 当前创建者业务责任方对已完成任务提出重开及新排期且全部校验通过
- **THEN** 系统 SHALL 在操作者直属上级批准或固定创始人合法免审后同时发布新排期、进入进行中及下一轮次；任何失败保留原完成状态和排期，其他人无重开权

#### Scenario: Assignee updates progress
- **WHEN** 当前负责人每次新增或修改文字进展
- **THEN** 系统 SHALL 按本次操作者当前直属上级审核；非创始人先待审冻结，固定创始人直接生效并留因，首次进展生效才变进行中，负责人身份不授予基础修改权

#### Scenario: Show status without numeric progress
- **WHEN** 查看任务状态和进展
- **THEN** 系统 SHALL 展示独立执行/申请状态及文字备注，不提供百分比或进度条

#### Scenario: Creator approves completion
- **WHEN** 当前有效负责人提交完成
- **THEN** 本次操作者的当前直属上级 SHALL 为审核人；操作者为固定创始人时直接生效，否则仅当前审核人可批准，原创建者在正式接管后不再凭原身份决定

#### Scenario: Superior rejects completion
- **WHEN** 指定审核人填写意见退回完成申请
- **THEN** 系统 SHALL 进入进行中并保留意见，不能只因上层身份审核所有任务

#### Scenario: Render authorized field-by-field differences in saved order
- **WHEN** 本次审核人打开仅负责人换序或多字段变更申请
- **THEN** 页面 SHALL 使用后端授权逐项差异展示前后值及有序负责人，不把换序视为无变化；创建换序不描述为改变创建审核人，申请人及旁观者不因展示扩权

#### Scenario: Reopen an overdue completed task from the web form
- **WHEN** 当前创建者业务责任方对旧截止已过的已完成任务填写重开原因及明确到日期时刻的完整未来排期
- **THEN** Web SHALL 一并提交排期并按操作者直属上级审核及固定创始人免审规则处理，通过则新排期、进行中和新轮次生效且提醒按新轮次排期去重，拒绝撤销失效保留原已完成状态及有效排期

#### Scenario: Resubmit an expired creation as a new request
- **WHEN** 失效创建的原申请人选择修改并重提并调整排期
- **THEN** 页面 SHALL 清楚展示失效及原提议，提交建立新申请并重算创建路线，旧申请保持失效；他人、重复并发重提及旧审核按钮不能复活旧申请或多次生效

#### Scenario: Validate a direct application as strictly as a reviewed change
- **WHEN** 当前创建者业务责任方修改资料或重开，或其作为负责人提交进展/完成
- **THEN** 操作 SHALL 在权限、版本、幂等、有效负责人、排期/截止、冻结、关联全部合法后，由操作者直属上级审核生效；仅固定创始人合法免审时一次生效并留历史和免审原因

### Requirement: Required notifications
系统 SHALL 由真实业务事件产生站内通知，覆盖审核提交/结果、创建生效、基础信息/紧急程度/进展/状态/完成/重开/交接生效、改派、临期、逾期及失效，不用静态样例代替。待创建及未发布结果 SHALL 仅向申请人和对应审核人；已发布任务申请提交 SHALL 只通知本次审核人，申请人可跟踪，不提前告知其他任务人员或提议负责人。已发布结果 SHALL 面向申请人、审核人及相关任务人员，生效通知 SHALL 向当前创建者业务责任方与当前全体负责人；负责人变更还 SHALL 包含新增及被移除人。提醒 SHALL 向当前创建者业务责任方与当前负责人。同次多字段更改 SHALL 一条消息汇总实际变化，保留任务标题、事件、时间及原申请绑定；同事件多身份去重且不排除本人；独立评论通知 SHALL 按评论专用矩阵去重并排除评论者本人。系统推送属于正式要求但本次延期，不得将站内投递声明为系统推送通过。

通知列表 SHALL 默认精简显示所属任务、通知类型、是否已读和通知时间四项，并可切换到含具体摘要的完整模式；正文在详情可读。非任务消息以所属对象或“无关联任务”占位，受限对象不暴露名称。通知类型区分需我审核、结果告知、提醒、评论与其他；需我审核仅包含当前用户仍可办理且未到期的待审消息。手机长标题不遮掉类型、已读和时间。撤回、屏蔽或权限变化 SHALL 不从原始载荷恢复受限内容。

正式接管后 SHALL 以接管人为后续创建者业务责任接收方，原创建者只保留历史来源，不继续承担新的办理/审核责任。固定创始人合法免审 SHALL 不生成待本人审核通知，仍生成真实生效事件和按去重矩阵适用的结果告知。改派与接管 SHALL 更新有效审核通知，旧审核按钮不得恢复失权责任。

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
- **THEN** 列表 SHALL 在精简模式显示所属任务、类型、已读和时间，完整模式补充实际摘要，待审核动作可辨；受限内容按可见边界裁剪，不由前端重建

#### Scenario: Notify the current business owner after takeover
- **WHEN** 管理员完成正式业务接管，后续有人提交进展或到达提醒节点
- **THEN** 待审核 SHALL 仅送实际申请人的当前直属上级，生效和提醒使用当前业务责任方与有效负责人矩阵，接管人不自动取得审核权；固定创始人合法免审不产生本人待审消息

### Requirement: Ordered reviewer routing and reassignment
创建、创建重提、基础/负责人/标签修改、每次进展、完成、重开及交接 SHALL 统一按实际触发操作的申请人当前直属上级审核。创建者、业务接管人、交接来源人、负责人排序或提议负责人 SHALL 不替代实际申请人。固定创始人的合法操作记录原因免审；其他员工缺少有效直属上级、上级停用/不可审核/跨公司、关系循环或损坏 SHALL 阻断，不跨级、不由创建者兜底、不自审。创始人身份 SHALL 取明确固定组织位置，管理员及任意无上级账号不因此免审。

预览、提交、详情、通知、待审刷新和实际决定 SHALL 使用同一规则并重新检查当前关系。权限范围、单待审冻结、排期/截止、版本、幂等、负责人及关联检查 SHALL 在免审路径同样执行；操作者是任务创建者或业务责任方不构成免审。

现有有效待审以及组织调整后的待审 SHALL 按保存的原申请人当前直属上级重算，记录前后审核人、时间、原因并更新通知；原申请人不因接管而改写。旧审核人立即失权，新增审核人仅取得该申请必要查看及比较权。申请人已停用/失去操作资格或其上级不可用时保持阻断，已终结/过期申请不得复活。已办结决定与历史审核人 SHALL 保留，不追溯改写。

#### Scenario: Preview all creator-based routes
- **WHEN** 任意固定职级员工预览任意类型合法操作
- **THEN** 系统 SHALL 非创始人返回其当前直属上级；固定创始人返回明确免审原因

#### Scenario: Block an unavailable configured manager
- **WHEN** 实际申请人的直属上级不存在、失效、不可审核、跨公司或关系损坏
- **THEN** 系统 SHALL 提交/决定返回可识别阻断，不跨级、不自审、不兜底

#### Scenario: Revalidate after an organization change
- **WHEN** 预览后或待审期间申请人的直属关系变化
- **THEN** 系统 SHALL 按当前上级重算并留痕，旧页面与通知不能授予旧审核人决定权

#### Scenario: Preserve ordered non-creation routes
- **WHEN** 非创建操作更换、排序或跨部门选择负责人
- **THEN** 系统 SHALL 保存负责人顺序，但审核人始终按实际申请人直属上级

#### Scenario: Require explicit non-creation self-review
- **WHEN** 非创始人创建者或业务责任方修改自己的任务
- **THEN** 系统 SHALL 必须交由其直属上级审核，不因创建者/责任方身份直接生效

#### Scenario: Persist order and route the first highest peer
- **WHEN** 同层负责人换序保存
- **THEN** 系统 SHALL 持久化顺序，任何负责人排序不影响申请人审核路线

#### Scenario: Review one's own application explicitly
- **WHEN** 固定创始人提交合法操作
- **THEN** 系统 SHALL 完整校验后直接生效且记录免审原因，不产生本人待审

#### Scenario: Change assignees using the proposed route
- **WHEN** 修改负责人或上级代办下属交接
- **THEN** 系统 SHALL 审核依据为本次点击提交的操作者，上级代办取该上级自己的直属上级；批准前原有效版不变

#### Scenario: Fall back or apply with a documented reason
- **WHEN** 非创始人无有效上级或仅业务责任方可用
- **THEN** 系统 SHALL 阻断并要求修复，不回退创建者/接管人；固定创始人例外须留因

#### Scenario: Reassign after organization changes
- **WHEN** 待审改派、停用、正式接管或截止与旧审核决定并发
- **THEN** 系统 SHALL 只提交一个合法最终结果，按原申请人重算权限并更新通知，不复活终态；接管不更换申请人

#### Scenario: Refresh preexisting pending requests
- **WHEN** 部署新规则时仍有旧规则有效待审
- **THEN** 系统 SHALL 按原申请人直属上级显式刷新并留痕，旧审核人失权，已办结记录保持原样

#### Scenario: Block an inactive applicant
- **WHEN** 原申请人已停用或失去该操作权限
- **THEN** 系统 SHALL 不以当前浏览者或接管人冒充申请人，不免审发布，不复活旧申请

### Requirement: Dedicated task handover
本人或其直属领导 SHALL 可预设交接对象并为其当前负责的任务发起专用交接申请；该权限 SHALL 仅改变负责人及其有序列表，不得用于修改任意基础字段。交接 SHALL 由实际发起交接操作者的直属上级审核，操作者为固定创始人时直接生效，否则审核通过生效，保留原创建者、创建时间、交接来源和全部历史。

专用交接 SHALL 仅允许被交接人本人或其直属上级发起，间接上级不自动代办；预设和接收候选 SHALL 以被交接人的工作关系圈为准：同部门、直属上级、直属下属，固定创始人可选公司全部有效业务员工。独立管理员、跨公司和无效人员不可作为接收人。普通负责人修改可全公司选人 SHALL 不扩大专用交接接收范围。

#### Scenario: A direct manager hands over a subordinate task
- **WHEN** 非原创建者的直属领导为下属的有效任务提交交接
- **THEN** 系统 SHALL 接受负责人交接并按操作者直属上级审核及固定创始人免审规则办理，夹带标题、排期等字段 SHALL 被拒绝；非直属领导 SHALL 无此专用权限

#### Scenario: Handover approval preserves provenance
- **WHEN** 实际操作者的当前直属上级批准交接或合法固定创始人免审直接生效
- **THEN** 系统 SHALL 切换负责人及权限并通知新旧相关人员，原创建者、创建时间及交接来源 SHALL 保留；未通过时 SHALL 保持原有效版本

#### Scenario: Distinguish direct manager handover from indirect management
- **WHEN** 间接上级和直属上级分别为同一下属发起交接，并尝试选择工作圈之外人员
- **THEN** 间接上级 SHALL 被拒，直属上级仅可选被交接人合法关系圈；管理员不代办业务，合法交接也不得夹带标题/排期修改

### Requirement: Shared single-select tags for tasks and logs
任务和日志 SHALL 共用本公司标签目录；任务可选择零到多个不同共用标签并保存稳定顺序，日志仍为零或一个。只有固定创始人员工可维护共用标签，其他员工仅在有对象编辑权时选择/清除；管理员和任意无上级账号不取得维护权。任务标签集合 SHALL 跟随任务提议、审核、有效版本和历史，日志仍受原冻结规则约束。私人标签保留已有数据和仅本人可见边界，维护权限以追加的创始人规则为准。

任务详情与有权查看的审核差异 SHALL 显示完整标签集合；改名改色更新当前引用且不重写已记录审计。删除为逻辑删除，禁止新引用，已有版本保留删除时名称颜色及“已删除”标记，可清除替换，不级联删除业务。任务日程在无私人覆盖时使用集合第一项颜色，有私人覆盖时优先私人颜色；无标签默认粉色，不因多选改写任务排期。

原单标签记录 SHALL 无损映射为一项集合，空值映射为空集合；旧单标签客户端读取首项投影。旧客户端未提供标签字段不得清空集合，对多标签任务显式以旧单标签字段写入 SHALL 返回明确冲突，要求使用支持集合的客户端；同时提供互相冲突的新旧字段 SHALL 拒绝，不能静默丢标签。

#### Scenario: Enforce root-only maintenance and single selection
- **WHEN** 创始人、其他员工、管理员维护标签，或任务选择多个而日志选择多个
- **THEN** 仅创始人 SHALL 可维护共用目录，合法任务多选持久化，日志仍拒绝多选；跨公司、私人冒充共用和越权引用拒绝

#### Scenario: Rename recolor and delete a referenced tag
- **WHEN** 集合中的标签改名改色或删除
- **THEN** 当前引用 SHALL 按规则更新，删除保留既有快照标记、禁止新关联，集合其他标签和业务历史不丢失

#### Scenario: Respect review freezing and calendar color
- **WHEN** 用户修改任务标签、查看尚未批准的提议或编辑冻结日志
- **THEN** 多标签 SHALL 整体随操作者直属上级审核规则生效，普通区域保留旧集合，冻结/越权日志拒绝；日程按私人覆盖、集合首项、默认粉色顺序取色

#### Scenario: Preserve legacy and historical tags
- **WHEN** 旧单标签数据升级、旧客户端读写或历史任务标签编辑后刷新
- **THEN** 系统 SHALL 无损回读，旧客户端不得将多个标签隐式截为一个；仅有当前查看权限者可读相应有效标签及授权提议

### Requirement: Persistent demonstration data for web and administration
系统 SHALL 准备手机号登录的员工演示账号及后端持久数据，按新固定组织重建演示身份与组织关系，业务使用稳定内部标识；十大公司重要事项为十条并能展示列表和卡片等样式，业务数据覆盖通知、待审核、任务表单、部门团队及下属日志任务，足以展示筛选、排序、分页及布局。同一账号 SHALL 按真实权限连续展示表单与下属日志任务，刷新仍可用，不用前端静态假数据替代，不按记录日期推算新演示日期。

演示组织 SHALL 含固定创始人、至少两个部门且每部门多个团队、完整单负责人/普通员工及必填职位/有效手机号，独立管理员不占员工位置。任务 SHALL 覆盖跨部门多负责人、仅创建不负责、专用交接及正式接管；审核覆盖全操作的操作者直属上级、固定创始人免审直接生效、拒绝、撤销、失效、完成/重开。

排期 SHALL 覆盖跨月/跨年/跨日、午夜截止、零时长、整日覆盖及超过五项重叠；表单超过两页以验全结果筛选排序分页。日志 SHALL 覆盖部门/团队直接及间接下属、近三天、冻结/删除重建；标签/评论/通知含撤权边界。准备流程 SHALL 显式指定目标演示库，可重复执行而无重复/非法组织，不在应用启动时清空任意数据库；刷新及重启后数据持久。演示重构可替换旧数据，但不是结构约束或升级验证的替代。

#### Scenario: Run a continuous demo after refresh
- **WHEN** 选定手机号账号登录后展示首页、通知、审核、表单和下属日志任务并刷新
- **THEN** 同一账号 SHALL 有对应合法数据权限，十条公司事项及业务数据仍在，可实际筛选排序分页，不需伪造身份

#### Scenario: Prepare a complete repeatable new-model demonstration
- **WHEN** 在显式指定的演示库连续准备两次并重启，使用四层账号及独立管理员展示
- **THEN** 系统 SHALL 不重复插入，所有规定组织、审核、接管、日历和超过两页表单用例可实际操作，标签/评论/通知/日志及十条公司事项持久，无前端伪造身份或静态结果

### Requirement: Atomic employee deactivation and formal business takeover
管理员 SHALL 在停用员工前一次安排完整业务结果：未完成任务负责人交接、负责人岗位继任和下属位置、未发布创建申请办结或撤销、待办审核承接，以及已发布任务后续修改/重开责任的正式接管；待审审核须按原申请人的当前直属上级承接。创始人不允许普通停用。接管人 SHALL 为公司有效业务员工，独立管理员不可接管或担任业务审核人。

正式业务接管 SHALL 独立记录对象、前后责任方、办理人、时间和原因，不覆盖原创建者/创建时间/历史来源；同任务任意时刻只允许一个当前创建者业务责任方。接管人 SHALL 按接管关系获得必要的正常任务访问、基础修改/负责人修改/重开权；审核权仅由实际申请人的直属上级关系确定，原创建者停用后不再承担后续责任，不能把接管任务计成接管人原始创建。

完整结果 SHALL 校验待审状态、截止、任务及组织版本和有效接收/接管人并原子提交，失败保留原组织及业务；必要交接申请在需他人审核时 SHALL 先办结，正式停用不得跳过既定任务审核。未发布创建申请的原申请人不被改写，无法在停用前办结者 SHALL 由原申请人或专用停用命令中的管理员撤销并留因，此管理例外仅限未发布创建申请，不转造接管人创建。业务接管 SHALL 同步重算仍有效待审与通知、更新权限版本及撤销停用人员会话，不产生停用审核人、双重责任或旧申请复活。

#### Scenario: Reopen taken-over completed work with active assignees
- **WHEN** 已完成任务的原负责人已停用，当前业务接管人重开任务并同步提交新的有效负责人及完整未来排期
- **THEN** 系统 SHALL 允许按全公司有效业务员工范围选择有序非空负责人并与重开经操作者直属上级批准后原子生效，操作者为固定创始人时校验后直接生效，保留原创建来源并增加执行轮次；缺有效负责人、排期或版本冲突 SHALL 拒绝整次重开，不自动将接管人添加为负责人

#### Scenario: Deactivate an employee only after all responsibilities are arranged
- **WHEN** 管理员停用同时是单位负责人、任务负责人、创建者及待审参与人的员工
- **THEN** 系统 SHALL 要求完整继任/交接/未发布申请处理/业务接管方案，未办结的必要审批或任何非法/过期/版本冲突均拒绝整次停用，成功后不存在无人负责岗位、无有效负责人任务或停用审核人

#### Scenario: Take over published work without impersonating its creator
- **WHEN** 管理员指定合法业务接管人接管已发布任务并停用原创建者
- **THEN** 接管人 SHALL 获必要访问及后续办理权，审核仍按实际操作者直属上级确定，原创建者和创建时间仍显示为原始来源，我创建筛选不把任务归给接管人，历史显示接管人/办理人/对象/时间/原因；管理员不获得业务权

#### Scenario: Refresh valid reviews and revoke old authority atomically
- **WHEN** 接管、组织调整、旧审核决定、截止扫描及相同请求重放发生竞争
- **THEN** 系统 SHALL 仅提交一个合法最终结果，旧审核人/停用会话无办理权，当前有效申请按原申请人当前直属上级刷新并留痕，过期或终态不复活，固定创始人免审只在全校验后直接生效

## ADDED Requirements

### Requirement: Notification list presentation and combined filters
通知中心 SHALL 提供精简/完整显示切换及“全部/未读/已读”和“全部/需我审核/结果告知/提醒/评论/其他”组合筛选。筛选针对当前全部可见通知，先过滤后分页/计数，保持时间倒序稳定排列；全局未读数不受筛选影响。打开消息才标已读，切换筛选不标已读，详情返回保留条件；账号切换清除旧会话数据。

#### Scenario: Filter across page boundaries
- **WHEN** 目标消息位于后续页，用户同时选择未读与结果告知
- **THEN** 列表 SHALL 返回完整匹配集合及正确总数，明确区分无通知与无匹配，并支持清空筛选

#### Scenario: Require actionable review classification
- **WHEN** 原待审已办结、过期、改派或撤回，用户筛选需我审核
- **THEN** 该消息 SHALL 不再列为当前需我审核，结果消息按结果类型可查；旧提交事件归其他且不能伪装成新结果事件，权限变化不恢复隐藏正文

#### Scenario: Return after opening an unread notification
- **WHEN** 用户从未读筛选打开详情后返回
- **THEN** 已读状态和未读数 SHALL 更新，原筛选保持，该消息退出未读集合；精简行只包含所属任务/对象、类型、已读、时间

### Requirement: Multi-select task tag controls
创建、创建重提及合法编辑任务的共用标签 SHALL 使用圆形/胶囊色块按钮，名称独立位于色块下方，先横向排列后纵向自动换行；点击选中、再次点击取消，支持同时选择多个。选中 SHALL 以描边及勾选等非纯颜色效果和可访问状态表达，键盘可操作；打开选人等子页返回保留草稿标签，失败不清空。

#### Scenario: Toggle and persist several tags
- **WHEN** 用户依次选择甲乙、取消甲、选择丙，提交后批准并刷新
- **THEN** 任务 SHALL 保存乙丙，表单及详情完整回显；手机长名称可换行不遮挡按钮，无标签显示明确空态

### Requirement: Responsive task schedule inputs
创建、编辑、重提及重开表单 SHALL 按“开始”“截止”分组，同组日期和时分对齐、窄屏自动换行且无横向溢出，点击区域可触达。日期与时刻均必填且始终可见，取消全天类型开关。额外“设为全天”按钮 SHALL 将开始日时刻设为00:00、所选截止日推进至次日00:00，仍允许手动修改；重复点击相同结果不累加一天。请求 SHALL 使用 allDay=false 及明确 startAt/dueAt。历史全天读取兼容，编辑时回显实际存储时刻。继续遵循组织时区和范围校验。

#### Scenario: Use a narrow mobile viewport
- **WHEN** 320px、390px 手机宽度及桌面填写跨日日期时间、使用全天快捷后修改时刻、打开选人后返回
- **THEN** 控件 SHALL 无重叠截断，开始/截止对应明确、草稿保留、提交值符合组织时区；截止早于开始须阻止提交并提示


### Requirement: Drag calendar schedule endpoints
月历和日视图横向排期轴 SHALL 允许具有基础编辑权限的操作者横向拖动任务条真实起止端点；月历按一天、日轴按15分钟的相对增量调整，未调整端点不变。跨周/月或跨日裁剪的续接端 SHALL 不冒充真实端点；零时长保留真实位置，不改工期。已完成、冻结或无编辑权任务不显示可操作手柄。日历原可见范围不扩大。

拖动 SHALL 实时显示完整起止预览，松开打开原编辑表单确认，填写原因后按操作者直属上级审核（创始人免审）；确认前及待审期间原有效排期不变。取消、Esc、pointercancel、失去捕获、逆序或无位移 SHALL 不保存、不误开日清单；键盘左右箭头提供相同粒度调整。提交仍检查最新权限、版本、期限与幂等；发现拖动期间版本变化 SHALL 提示并要求基于最新数据重新调整。

#### Scenario: Move dates across a month boundary
- **WHEN** 合法操作者将月历截止手柄向右移动一天并确认提交
- **THEN** 截止日期 SHALL 正确跨月/跨年且原时刻保留，开始不变；仅批准或创始人合法免审后发布

#### Scenario: Adjust precise times and cancel a drag
- **WHEN** 操作者在横向日轴移动开始或截止手柄，或按左右键调整，随后取消
- **THEN** 提议 SHALL 按15分钟相对增量并正确处理午夜；取消不改变服务端数据，零时长可操作，逆序不能提交

#### Scenario: Preserve permissions and concurrent updates
- **WHEN** 负责人无基础编辑权、任务冻结，或拖动后任务版本已变化
- **THEN** 系统 SHALL 不授予编辑权限，不覆盖新版本；待审提议不提前反映到有效日历


### Requirement: Personal task table and founder-only tag maintenance
任务表单 SHALL 仅显示本人原始创建或当前有效负责的授权任务，在搜索、计数和分页前排除仅可见的下属任务；不提供仅可见筛选。其他授权入口保持原范围。
标签目录创建、改名、改色、删除（包括私人标签） SHALL 仅固定创始人可执行，服务端校验与canEdit一致；其他人员仅在任务/日志编辑中选择或清除。日程 SHALL 移除标签管理及图例行，并保留已有私人覆盖、共用首项和默认任务颜色。

#### Scenario: Inspect a manager's task table
- **WHEN** 上级同时可见本人创建、本人负责和仅下属负责的任务
- **THEN** 表单 SHALL 只保留前两类，搜索和总数不能恢复第三类

#### Scenario: Reject tag maintenance without removing task colors
- **WHEN** 普通员工通过界面或直接API维护共用/私人标签
- **THEN** 系统 SHALL 拒绝维护，任务/日志编辑仍能选择清除；日程任务颜色保持，创始人在我的页面维护标签

### Requirement: Single creation entry for recent missing logs
写日志 SHALL 统一提供公司今天、昨天、前天尚未创建的日志日期；不再提供独立补写按钮。已存在日期 SHALL 不出现在创建选择中，所有日期已写提示从详情编辑。编辑 SHALL 通过显式日志ID进入；重复创建竞态不得自动转编辑或覆盖原记录。

#### Scenario: Create missing days and edit through detail
- **WHEN** 今天已写、昨天和前天未写，用户选择写日志
- **THEN** 系统 SHALL 只提供昨天和前天的创建选择；三天全部已写则提示，不进入编辑；详情编辑仍按作者与冻结权限校验
