# pandora-requirements-aligned-prototype Specification

## Purpose

本规格用于约束潘多拉移动端交互原型只呈现需求文档定义的任务协作、工作日志、分级权限与统计信息，并以可操作的示例流程验证关键业务规则。

## Requirements

### Requirement: Five-page navigation
员工 Web SHALL 仅提供“首页”“公司”“日志”“统计”“我的”五个主业务页面，其中“首页”替代“工作台”（历史名称“导图”），“公司”替代“日程”（历史名称“视图”），“统计”对应历史“AI地图”。导航、当前页标题、页面可访问名称及登录/加载等仍引用这两个入口的静态文案 SHALL 使用新名称；不得批量改写业务正文中的相同文字。

固定导航切换 SHALL 保持真实认证身份；通知中心承接审核而非第六个主页面，任务创建/派发、现有任务日历与本人申请入口属于公司页，日志页只写看日志。任务表单 SHALL 作为公司页下的二级页面而非第六主导航，详情关闭后返回表单，表单返回保留日历模式与日期。演示身份选择 SHALL 经过实际认证且不得改变服务端权限。公司页改名 SHALL 不将任务日历扩大为全公司任务，也不改变其上下连续月视图、月/日模式、排期权限或原有任务详情流程；首页每日事项使用独立日期和浏览状态。

#### Scenario: Navigate with an authenticated identity
- **WHEN** 用户依次切换五页或从通知进入审核
- **THEN** 系统 SHALL 保持真实账号及组织权限，主导航为首页、公司、日志、统计、我的，仅选中当前页；通知不成为第六页

#### Scenario: Navigate across the prototype
- **WHEN** 用户从旧工作台入口进入首页，再切到原日程入口
- **THEN** 可见导航和标题 SHALL 显示新名称，原日程功能在公司页继续可用，任务范围及权限不因“公司”名称扩大

#### Scenario: Enter the task table as a secondary view
- **WHEN** 用户从公司页日历打开任务表单、进入任务详情并依次返回
- **THEN** 主导航 SHALL 始终仅有五项并选中公司，详情返回表单，表单返回此前日历模式、日期及浏览位置

#### Scenario: Keep independent calendars and business text
- **WHEN** 用户横向浏览每日事项后切到公司页，再返回首页，或业务正文包含“工作台”“日程”
- **THEN** 两处日期与滚动状态 SHALL 各自恢复，公司页月历仍上下连续浏览，业务正文原样保留

### Requirement: Three-section home dashboard
首页 SHALL 仅保留事件纪、任务看板、每日事项三个内容模块；事件纪位于原公司事项位置的上方左侧，任务看板位于原我的待办位置的上方右侧，每日事项通栏位于两者下方。首页 SHALL 移除个人日志展示及其原卡片和空白占位，不删除日志记录或日志页功能。上方两个模块内容超出时 SHALL 独立纵向滚动；每日事项 SHALL 在自己的日历区域横向连续滚动，不带动整页或上方模块横向移动。上方两个模块的内容区 SHALL 各至少容纳三条普通单行条目，不计标题、提示或被裁切的半条条目，以三至四条的高度为视觉目标；长条目自然换行并在模块内部滚动。每日事项 SHALL 不通过压缩上方内容到不足三行来获得高度。紧凑屏幕 SHALL 保证七个星期行、标题栏加号及导航可达，必要的页面纵向滚动不得截断内容，不以缩小日期交互目标代替空间分配。

事件纪 SHALL 仅更改员工首页原公司事项的名称；公司信息仍最多十条、按管理端设置顺序只读展示，包括上层无员工端维护入口，管理员的新增、修改、删除及调序规则保持。

任务看板 SHALL 展示本人当前为有效负责人、已正常发布且未完成的任务，不考虑创建者是谁，包含本人创建并负责的任务；仅创建而非当前负责、负责人已移除、已完成、待创建/未发布及仅有历史通知只读访问的任务 SHALL 排除。结果 SHALL 按实际派发给本人的时间倒序、同时间按任务标识升序稳定取最多十项，不按创建时间、紧急程度或截止排序；每任务只出现一次。条目 SHALL 只显示标题和右对齐紧急程度，点击进入原鉴权详情。长标题、窄屏及滚动条 SHALL 不遮挡紧急程度。

首页日期区域 SHALL 不恢复重复的“新建任务”按钮或其占位；公司页原任务创建加号保持，每日事项加号只创建每日事项。每日事项 SHALL 由下述独立要求约束，替代原个人信息列表及十条上限。

#### Scenario: Render three modules in their intended positions
- **WHEN** 用户进入首页
- **THEN** 事件纪和任务看板 SHALL 保留原左右位置，每日事项位于下半部分并横跨两列，无个人日志卡片或旧第四模块占位

#### Scenario: Scroll home modules independently
- **WHEN** 上方列表较长或用户左右连续滑动每日事项
- **THEN** 上方列表 SHALL 分别纵向滚动，每日事项只在自身区域横向移动，导航和其他模块不跟随横向移动，紧凑屏幕全部内容可达

#### Scenario: Include self-created assigned work
- **WHEN** 本人既有自己创建并负责的任务，也有他人创建并派发给自己的任务
- **THEN** 两类符合条件的任务 SHALL 一起按派发给本人的时间倒序参与前十项，不能按创建者排除其中一类

#### Scenario: Exclude work outside the board contract
- **WHEN** 本人有仅创建未负责、已移除负责关系、已完成、未发布及仅历史通知可读的任务
- **THEN** 这些任务 SHALL 不进入任务看板，其详情访问权仍分别遵循原规则

#### Scenario: Rank a newly assigned old task
- **WHEN** 旧任务今天新增本人为负责人，另一新任务昨天已派发给本人，且存在派发时间相同的多项任务
- **THEN** 今日派发的旧任务 SHALL 排在前面，同时间按任务标识稳定排序，刷新后最多十项且无重复，不改用创建时间、截止或紧急度排序

#### Scenario: Show concise tasks and read only company information
- **WHEN** 上层或普通员工进入首页并滚动长标题任务
- **THEN** 任务项 SHALL 仅展示标题和完整右侧紧急程度并可进入原详情，事件纪无员工编辑删除入口

#### Scenario: Reject company information above the limit
- **WHEN** 公司信息已十条且管理员新增，包括并发新增
- **THEN** 系统 SHALL 拒绝第十一条且提示上限；每日事项取消上限不影响该规则

#### Scenario: Remove only the home log presentation
- **WHEN** 用户已有本人日志并访问首页及日志页
- **THEN** 首页 SHALL 不再展示日志，日志页仍可按原权限查看和维护，日志正文和冻结规则不变

#### Scenario: Separate creation actions
- **WHEN** 用户点击首页每日事项加号或公司页任务加号
- **THEN** 前者 SHALL 创建独立每日事项，后者进入原任务表单；首页日期区不增加任务创建按钮

#### Scenario: Reserve three complete rows in both upper cards
- **WHEN** 事件纪和任务看板均有至少四条普通单行条目，用户在320×740、390×844、1440×900或390×600窗口进入首页
- **THEN** 两张上方卡片的内容区 SHALL 各至少完整容纳三条条目，标题不计入条目数，超出部分可独立滚动；短屏可纵向滚动页面以访问每日事项七行及导航

#### Scenario: Keep the daily header compact
- **WHEN** 用户查看每日事项标题和日历
- **THEN** 标题及其右侧新增按钮与月份工具 SHALL 在同一标题行，标题下无重复年月副标题，卡片右下无悬浮新增按钮及其专用空白区

### Requirement: Independent personal daily items
每日事项 SHALL 仅属于创建它的本人，以一个公历日期、一段非空纯文本及完成状态保存；默认未完成，支持完成和取消完成。业务详情 SHALL 只展示日期、完整文本、完成状态控件及编辑/删除/返回等必要操作，不增加标题、时刻、负责人、紧急程度、标签、提醒、审批、关联任务、评论或日志字段。正文 SHALL 保留换行，以纯文本安全呈现，去除首尾空白后限 1–2000 字符。

本人 SHALL 可为过去、今天或未来的合法日期创建多条事项，可编辑日期和正文、删除指定事项，不受原个人事项总共十条、每天一条或日志补写/冻结窗口限制。日期 SHALL 使用明确的公历日期，不因设备时区与公司时区不同而漂移；默认今天以公司业务日期为准。

事项 SHALL 与任务及日志无关联，维护和完成事项不得创建任务、审核申请、任务通知、日志或改变其状态、计数和排期。任何其他员工、上级及独立管理员 SHALL 不因组织管理权读取或维护他人每日事项；列表、日期计数、详情及写入均须执行本人及同组织限制。用户已确认无旧非生产个人事项保留要求，切换后 SHALL 不展示无日期旧事项，不为它们自动生成任务或日志。

#### Scenario: Create more than ten independent items
- **WHEN** 本人累计或同一天已有十条每日事项，再创建第十一条
- **THEN** 合法输入 SHALL 保存成功且可重新读取，任务及日志数据不变，不触发旧个人事项十条上限或日志日期规则

#### Scenario: Edit the date and body of a specific item
- **WHEN** 本人在同日多条事项中选择一条，修改日期及多行正文后保存
- **THEN** 系统 SHALL 仅更新该标识事项，旧日列表移除、新日列表出现，对应日期数量标记同步，刷新保持，其他事项不受影响

#### Scenario: Complete and reopen an item
- **WHEN** 本人将事项设为完成后刷新，再取消完成
- **THEN** 完成状态 SHALL 持久化并可逆，蓝色与灰色计数按对应状态更新，日期和正文保持，任何任务状态不变

#### Scenario: Keep dates stable across time zones
- **WHEN** 设备与公司时区不同，或事项日期跨月、跨年及闰日
- **THEN** 默认日期 SHALL 使用公司今天，明确保存的日期原样往返，非法日期或空白/超长正文拒绝且不部分保存

#### Scenario: Enforce private ownership on every operation
- **WHEN** 同公司其他员工、上级或管理员及跨公司用户请求某人的事项列表、计数、详情或维护接口
- **THEN** 系统 SHALL 不返回他人事项、正文或计数，越权写入被拒绝，不因组织管理或任务可见关系扩大访问

#### Scenario: Keep daily-item details minimal and safe
- **WHEN** 用户打开包含长文本、换行和类似 HTML 内容的事项详情
- **THEN** 详情 SHALL 安全显示完整日期和纯文本，提供完成状态及必要维护操作，不展示额外任务/日志字段，文本不作为脚本执行

### Requirement: Horizontal continuous daily-item calendar
每日事项 SHALL 使用独立轻量月历，最左侧为横向滚动时固定的周一至周日七行表头；每个星期为一列，时间从左向右递增，每格公历日期数字在上、数量标记在下，不显示农历。各月 SHALL 作为独立月块排列，月间保留可辨留白；每月从1号所在周到月末所在周排列，首尾周不属于本月的位置留空，不显示或创建相邻月日期，也不跨月共用周列。空位 SHALL 不可激活且不参与日期键盘移动；同一真实日期只形成一个可交互日期格，按时间浏览无重复或遗漏。

各月年月 SHALL 完整显示在该月1号所在列上方，左侧与该列对齐，不与相邻月年月重叠；日期格右上角 SHALL 不再显示月份或年份角标，“每日事项”标题下 SHALL 无重复锚点年月副标题。初次进入及保留登录后的页面刷新 SHALL 定位公司今天所在月份且使今天可见。日历可操作后 SHALL 立即支持双向横向浏览，不要求用户先点击前后月、年月定位或回今天；宽屏能够容纳初始月份时 SHALL 自动提供足够的相邻月份及滚动余量，而非停留在不可滑动的固定三个月。容器尺寸变化及切页恢复后 SHALL 继续可滑动，恢复已保存的有效日期位置。

日历 SHALL 支持左右连续浏览前后月份及跨年，接近边界时补充相邻日期范围并保持视觉位置；不得仅用整页翻月或单独月份选择器代替连续滑动。补载失败 SHALL 保留已有内容并允许重试，不将未加载范围显示为已确认的零事项。年月定位和回今天 SHALL 可用，并有鼠标与键盘可操作方式。

日历 SHALL 只呈现日期和每日事项数量，不复用公司页任务月历的事件条、跨日跨度、任务拖动、小时轴、日模式、密度调节、置顶、标签或审批能力。左右滑动 SHALL 不误触日期清单；普通点击或键盘激活某天才打开当天清单。公司页月历的上下连续浏览 SHALL 保持。

#### Scenario: Read the transposed calendar
- **WHEN** 用户进入每日事项并水平滚动
- **THEN** 左侧周一至周日 SHALL 固定，星期列按时间向右排列，每格日期和标记上下排列，无农历，年月归属清楚

#### Scenario: Browse continuously across months and years
- **WHEN** 用户从十二月末向右连续浏览一月再向左返回，或定位远处月份继续滑动
- **THEN** 实际日期 SHALL 按时间连续、无重复或缺失，月块间保留分隔和非日期空位，补载不跳动，星期对齐，所选年月和返回位置正确

#### Scenario: Recover a failed range load
- **WHEN** 相邻月份请求失败后重试
- **THEN** 已有日历和事项标记 SHALL 保留，失败范围明确可重试，不能将加载失败伪装成空月份，重试成功后无重复日期

#### Scenario: Separate sliding from activation
- **WHEN** 用户在日期格上开始触摸横滑，再用普通点击或键盘激活日期
- **THEN** 滑动 SHALL 只移动日历，不打开清单、不修改事项；普通激活才打开所选真实日期清单，鼠标与键盘同样可浏览相邻日期范围

#### Scenario: Separate months and align the month heading
- **WHEN** 用户查看1号分别落在周一或周日的月份、四至六周的月份、闰年二月或跨年月份
- **THEN** 各月 SHALL 只显示本月真实日期，首尾其他位置为空且不响应日期操作，年月完整显示在该月1号所在列上方，1号无月份角标，月间有留白；全部真实日期唯一、无遗漏，七个星期行对齐

#### Scenario: Slide immediately after a page refresh
- **WHEN** 用户已登录并在320×740、390×844、1440×900或390×600窗口刷新页面，首页日历完成加载后直接向左或向右滑动，未先点击任何月份控制
- **THEN** 日历 SHALL 从公司今天所在月份开始即可双向移动并继续补载初始范围外的月份，不停留在三个不可滑动的静态月份；真实横滑不打开日期清单，补载保持可见位置

#### Scenario: Keep browsing after a viewport resize and page return
- **WHEN** 用户将窗口从窄屏扩大到可容纳多个整月的宽屏，或横向浏览后切到公司页再返回首页
- **THEN** 每日事项 SHALL 保留有效日期锚点及像素位置并提供足够的双向浏览范围，固定星期表头、前后月、年月定位及回今天继续可用，公司页日期与滚动状态独立

### Requirement: Daily-item status count markers
每日事项日历 SHALL 在每个日期数字下最多显示一个数量标记，长度仅由当天全部事项总数决定，与是否完成无关。总数为零 SHALL 保留布局空间但不画标记；一条为圆点，二至四条逐渐加宽，五条及以上为固定最大宽度圆角条，标记高度始终一致。只要当天存在未完成事项，唯一标记 SHALL 为蓝色；当天总数大于零且全部完成时 SHALL 为灰色。混合状态 SHALL 合并为按总数绘制的一段蓝色标记，不并列显示蓝灰两段，不遮挡日期或相邻格。

数量 SHALL 覆盖当天全部事项，不仅统计已加载清单页；五条以上仅视觉宽度封顶，不截断数据或限制操作。日期可访问名称或等价文字 SHALL 提供完整日期及精确未完成/已完成数量，不能仅靠颜色表达状态。新增、完成/取消完成、修改日期和删除成功后 SHALL 更新所有受影响日期的标记。

#### Scenario: Render zero through saturated counts
- **WHEN** 不同日期分别有零、一、二、三、四、五及超过五条同状态事项
- **THEN** 标记 SHALL 按规则从无点、圆点、逐渐加宽到固定圆角条，所有高度一致，超过五条仍有准确数量和完整清单

#### Scenario: Show mixed and completed-only days
- **WHEN** 某天既有未完成也有已完成事项，另一日全部完成
- **THEN** 前者 SHALL 只显示一个按当天总数决定长度的蓝色标记，后者只显示一个按当天总数决定长度的灰色标记，精确未完成及已完成数量可被辅助技术读取

#### Scenario: Update both dates after a move or deletion
- **WHEN** 事项完成、取消完成、移到另一日或删除当天最后一条
- **THEN** 涉及日期的计数及标记 SHALL 同步改变，最后一条删除后无残留点，刷新保持

#### Scenario: Use the total count for a mixed day
- **WHEN** 某天有1条未完成和4条已完成，另一日有5条未完成，另一日有5条已完成
- **THEN** 三日标记 SHALL 等长且达到五条的封顶长度，前两日为单段蓝色，最后一日为单段灰色；总数相同不得因状态占比不同而改变长度或拆成多段

#### Scenario: Preserve marker width when only completion changes
- **WHEN** 用户将当天部分或全部事项完成，再取消其中一项完成，期间没有新增、删除或移日
- **THEN** 唯一标记长度 SHALL 始终不变，只有全部完成时变灰、存在未完成时变蓝，精确状态数量及完整清单同步更新

#### Scenario: Count all pages in one marker
- **WHEN** 当天有超过100条事项、包含两种状态，用户只加载清单首屏或继续分页
- **THEN** 日期 SHALL 始终只显示一个按全日总数封顶的蓝色标记，精确状态数量覆盖全部事项，不随清单分页改变

### Requirement: Daily-item lists details and reliable editing
点击任一天 SHALL 打开该日期事项清单弹层，显示日期、当天全部事项的可分页/滚动列表、完成控件、必要新增及关闭操作；无事项 SHALL 显示空态并可按该日新增。清单 SHALL 同时保留完成及未完成事项，按创建时间升序、同值按事项标识稳定排序，切换完成状态不使条目跳位；行文本点击进入事项详情，完成控件不误触详情。

每日事项标题右侧的加号 SHALL 只打开每日事项创建界面，默认选中日期、尚无选中日期时用公司今天；日期可修改。加号 SHALL 与标题同一行，采用与年月/今天工具一致的圆角按钮形态，以有玻璃感的半透明薄荷绿填充及清晰高光/边框呈现，提供可读名称和可见键盘焦点；不得使用白色填充或继续悬浮在卡片右下方。标题栏入口 SHALL 在320宽窄屏仍可见可操作，不遮挡日期、导航或清单内容，日历底部不保留为旧悬浮按钮专用的空白区。表单 SHALL 仅要求日期和正文；详情可完成/取消完成、编辑日期/正文、经确认删除。所有操作 SHALL 使用真实事项标识。

详情返回 SHALL 恢复原日期清单及其滚动位置，清单关闭恢复原日历日期、横向位置及触发焦点；支持按钮、返回/Esc及遮罩关闭且焦点不留在隐藏内容。事项移日后 SHALL 返回原日期清单并更新原日期与目标日期数量，不无提示跳到目标日。新增、编辑或完成失败 SHALL 保留草稿/原状态并提供重试，取消删除不写入。

更新与删除 SHALL 使用打开目标时取得的版本，版本冲突明确拒绝覆盖并允许回读处理；提交中防重复操作，响应丢失后的相同载荷重试 SHALL 不产生重复事项或重复状态变化。退出、会话失效或切账号 SHALL 清理每日事项缓存、草稿和弹层，旧请求不得覆盖新账号或新的日期查询。

#### Scenario: Open an empty day and create with the floating button
- **WHEN** 用户选择无事项日期，再通过清单或每日事项标题右侧加号新增
- **THEN** 创建界面 SHALL 默认该日期，只需日期和正文，成功后清单和标记更新；从未选日期时默认公司今天，不创建任务

#### Scenario: Read every item and return through the layers
- **WHEN** 某日有超过一页事项，用户加载后打开详情并依次返回和关闭
- **THEN** 全部条目 SHALL 可达且不重复，完成项仍在原稳定位置，返回恢复列表滚动、日历横向位置和焦点

#### Scenario: Edit and delete only the selected item
- **WHEN** 多条内容相同的事项中用户编辑或确认删除一条，或取消删除
- **THEN** 保存/删除 SHALL 仅作用于所选真实标识，取消无写入；移日后返回原日期清单，两个日期标记正确

#### Scenario: Preserve drafts and reject stale versions
- **WHEN** 保存遇到网络错误、版本冲突或其他会话已修改/删除目标
- **THEN** 系统 SHALL 保留当前草稿并明确反馈，不静默覆盖新版本、不把编辑转为新增，相同请求重试不会重复创建或重复执行

#### Scenario: Isolate sessions and out-of-order responses
- **WHEN** 用户快速切换日期或在请求未完成时退出、失效及切换账号
- **THEN** 系统 SHALL 清除旧账号事项及草稿，丢弃过时响应，当前日期清单不会被另一日期结果覆盖

#### Scenario: Keep controls usable on compact screens
- **WHEN** 用户在320、390及1440宽度、较矮窗口使用日历、清单、详情和表单
- **THEN** 星期及七行日期 SHALL 可达，长文本可换行，标题栏加号和保存/返回不遮挡内容及导航，键盘操作与焦点恢复可用

#### Scenario: Create from the mint glass header control
- **WHEN** 用户在320、390或1440宽度查看每日事项，并通过点击或键盘激活标题右侧的新增按钮
- **THEN** 按钮 SHALL 与标题同一行，使用与年月/今天一致形态及可辨的半透明薄荷绿填充，打开原每日事项创建表单；取消或保存后按原流程返回并恢复正确焦点，不在卡片底部留下浮动按钮或专用空白区

### Requirement: Calendar task views
日历 SHALL 仅有月、日两种模式，默认月模式，月模式按月、日模式按天前后导航；日模式可保留可点的一周日期行，但 SHALL 不新增周视图或整周滑动要求。所有月格、日轴、全天区、跨日任务及当日清单 SHALL 仅展示本人当前为有效负责人的正常任务，含已完成任务；本人仅创建、仅组织可见、待创建、未发布和历史通知只读例外 SHALL 不进入日历。日历 SHALL 移除下属日程切换，其他入口合法权限 SHALL 不被收窄。

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

### Requirement: Authorized task table page
系统 SHALL 从视图提供“任务表单”二级页面，使用一行一项任务、表头与网格对齐的表格展示本人原始创建或当前有效负责且有正常查看权的任务。表格 SHALL 支持纵向及窄屏横向滚动，并使表头、任务名称、返回和分页操作可定位及操作。每项 SHALL 显示任务名称、本人关系、有序负责人、原创建者、创建时间、说明、历史任务已有的完成标准（新建无此字段）、开始/截止日期时间、全天标记、执行状态、是否完成、紧急程度、进展备注、当前待审类型/冻结、逾期标记及有权查看的上级任务；长文本可预览并从详情查看全文，全天 SHALL 不伪造时刻，无权父任务 SHALL 不泄露标识或标题。

列表、搜索及计数 SHALL 只纳入本人原始创建或当前有效负责、当前有正常查看权且已有有效版本的任务；先排除仅下属/组织可见任务，再执行完整结果的搜索、筛选、排序、计数和分页，按任务标识去重。已生效任务待审 SHALL 展示旧有效版及待审标记，不泄露提议或专用 diff；待创建及其他未发布申请、仅有历史通知只读访问权的任务 SHALL 不纳入。任务操作 SHALL 进入原鉴权详情及审核流程，不提供单元格直接改写。返回日历 SHALL 保留此前模式和日期；关闭详情 SHALL 保留表单条件及当前位置。

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
- **THEN** 首屏 SHALL 优先任务识别及主要处理信息，低优先级详情靠右仍完整可达，表头行对应、详情易点；筛选排序计数 SHALL 基于完整的本人创建或有效负责结果后再分页，本人创建且负责分别计数但行不重复

#### Scenario: Simplify visible copy while retaining spreadsheet operations
- **WHEN** 用户在窄屏打开任务表单、筛选排序翻页、进入详情并返回
- **THEN** 两句指定说明及分类统计 SHALL 不展示，名称列固定和列头排序仍可用，详情返回保留条件、页码和浏览位置

#### Scenario: Exclude merely visible subordinate tasks before paging
- **WHEN** 上级可见本人创建、本人负责及仅下属负责三类任务，目标任务分布在多页
- **THEN** 表单 SHALL 仅纳入前两类，搜索、关系筛选、刷新、总数和分页不能恢复第三类；其他入口的正常查看权不被撤销

### Requirement: Combined task table filters and search
任务表单 SHALL 提供“全部/我负责/我创建”关系、“全部/未完成/已完成”完成、任务名称及可选起止日期条件，全部条件同时生效。本人为有效负责人即“我负责”，本人为原创建者即“我创建”（包括同时负责），两者均否的任务 SHALL 在过滤前排除，不提供“仅可见”选项；行 SHALL 可同时标记负责和创建但不重复。完成 SHALL 仅由有效执行状态判断，待完成审核仍属未完成。

名称搜索 SHALL 对整个本人原始创建或当前有效负责的授权正常任务集做去首尾空格、不区分大小写的包含匹配，最多 200 字符；日历 SHALL 不保留普通任务搜索。日期默认全部，不继承日历月份，支持只填一端，按公司时区任务首尾日期与所选闭合日期范围相交筛选；全天首尾日期均包含，定时任务用实际开始及截止所属公司日期。结束早于开始 SHALL 提示错误且不发布错误结果。人员、日志及编辑中的关联任务查找 SHALL 保持原有用途及权限。

#### Scenario: Find a task created and assigned to oneself
- **WHEN** 本人同时为一个任务的创建者和负责人，分别选择我负责、我创建或全部
- **THEN** 三个筛选 SHALL 各包含该任务一次且不提供仅可见选项，关系标记 SHALL 可同时显示负责和创建

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
- **THEN** 系统 SHALL 拒绝或裁剪受限数据；手机号仅本人资料、具备当前资料查看权且层级更高的实际管理链上级所读人员详情，以及本公司独立管理员的员工管理列表/详情 SHALL 可返回，其他 DTO SHALL 不含号码；知晓 ID 或前端角色按钮 SHALL 不授予权限

#### Scenario: Compare role visibility
- **WHEN** 两部门人员共同负责一个已发布任务
- **THEN** 两部门获授权管理者 SHALL 可见，创建者部门 SHALL 不决定任务部门归属；查看权 SHALL 不自动授予派发、修改或审核权

#### Scenario: Prevent unauthorized detail access
- **WHEN** 无权用户直接访问任务、日志、关联、统计明细或他人资料
- **THEN** 系统 SHALL 拒绝或裁剪受限数据；手机号仅本人资料、具备当前资料查看权且层级更高的实际管理链上级所读人员详情，以及本公司独立管理员的员工管理列表/详情 SHALL 可返回，其他 DTO SHALL 不含号码；知晓 ID 或前端角色按钮 SHALL 不授予权限

#### Scenario: Retain own cross-scope tasks and deny teammate access
- **WHEN** 部门/团队负责人创建任务但全部负责人在其他部门/团队，普通员工搜索同团队无关任务
- **THEN** 管理者 SHALL 仍可读本人创建的正常任务，普通员工无关任务不在列表、详情、计数和分析中

#### Scenario: Revoke management access after an atomic move
- **WHEN** 人员调岗后旧上级用缓存、旧请求、旧分析及相同幂等键访问
- **THEN** 所有入口 SHALL 按新组织拒绝旧范围，不返回旧数据或旧成功载荷，新的合法管理链可按当前矩阵访问

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

#### Scenario: Show candidates without a department or team
- **WHEN** 创建者在负责人树中查看无部门的固定创始人、有部门无团队的负责人及跨团队同名员工
- **THEN** 职位、真实部门和团队 SHALL 分别正确显示；公司层无部门者显示公司层，不将职位或团队冒充部门，不显示空值/多余分隔符，树路径和确认后的选择保持正确

### Requirement: Task structure and attributes
任务 SHALL 展示标题、说明、原创建者、独立创建时间、有序多负责人、起止排期、全天、紧急/高/中/低紧急程度、离散执行状态、当前文字进展、可选父任务及有权读取的相关审核意见。系统 SHALL 不提供抽象任务类型、百分比进度或进度条；父子任务独立执行，父状态不由子任务自动改变或计算百分比。父任务搜索 SHALL 按名称在当前正常可见且无环候选中匹配、允许清空，并独立检查关联详情权限。定时任务 SHALL 使用精确时刻，全天只填写日期且首尾均包含，截止不得早于开始；转交、排期修改与重开 SHALL 不改变原创建者或创建时间。

创建和创建申请重提 SHALL 移除完成标准输入及必填校验，未提供该字段可正常提交；历史完成标准 SHALL 保留展示、合法编辑及审计，不因新建移除而清空。说明区及历史任务仍存在的完成标准编辑区 SHALL 保持至少 234px 最小高度，窄屏其他字段与提交可达。

普通任务详情 SHALL 不展示“当前业务责任方”等内部责任概念，不展示无当前申请对应的固定审核人。实际责任、接管和历史来源仍用于服务端裁决及后台审计。需审提交成功 SHALL 提示该已保存申请的实际审核人；待审申请 SHALL 展示当前审核人，改派后刷新，免审直接显示已生效，阻断时不给出虚构人选。

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

#### Scenario: Show the saved current reviewer without an internal owner label
- **WHEN** 用户提交后审核人因组织调整变化，或固定创始人合法直接生效
- **THEN** 普通详情 SHALL 无内部责任方及固定审核人行；需审成功提示及待审申请使用当前实际审核人，免审显示已生效，原创建者和创建时间保持真实

### Requirement: Task editing and completion review
系统 SHALL 为正常任务提供统一信息编辑入口，按字段权限显示可编辑内容。当前有效负责人以及创建者在任时的创建者、正式接管后的接管人 SHALL 可申请修改名称、说明、历史已有完成标准、紧急程度、排期、共用标签及父任务；负责人列表的增删、替换及排序 SHALL 仅由创建者在任时的创建者、正式接管后的接管人修改。当前文字进展 SHALL 仍仅当前有效负责人可申请修改，可与其有权修改的其他资料一次提交为一个申请并原子审核生效。创建来源、时间、执行状态及轮次 SHALL 不作为普通编辑字段。仅有正常查看权者保留既有仅排期资格，不因此获得其他字段编辑权；下属浏览上下文 SHALL 依下属工作区要求仅提供评论。完成、交接及重开 SHALL 保持专用流程和原资格，不混入普通信息编辑。

需要他人审核的创建、修改、每次进展、完成、重开及交接 SHALL 先待审；申请人为固定创始人时 SHALL 校验通过后直接生效并保留免审原因，不留本人待审。需审 SHALL 同任务唯一待审并冻结其他任务业务变更（有正常查看权者独立评论除外），只有申请人能撤销；仅停用前未发布创建申请适用专用管理处置撤销并留因，不开放任意业务代撤。修改提议须先撤销再重提。普通详情、任务表单和提醒 SHALL 保留原有效版本，日历仅按待审排期投影显示提议位置与虚线。申请人可看自己的提交内容、状态及结果，只有对应授权审核人可获得原版与提议的专用 diff，服务端必须裁剪字段。

统一编辑 SHALL 对本次实际字段差异逐项检查资格，并在提交、待审刷新和批准时重验；负责人列表未修改不要求其管理权，但无该权者任何换序亦拒绝，不能以纯排期命令夹带其他字段。混合资料与进展修改 SHALL 只建一个申请、一次决定、同事务全部生效或全部保留原版；进展首次合法生效才按原语义从待开始进入进行中，资料单独生效不改变状态。

执行状态 SHALL 为待开始/进行中/已完成，与待审/通过/拒绝或退回/撤销/失效分开。首次进展审核通过或合法直接生效后待开始变进行中；完成通过变已完成、退回变进行中且须意见、撤销恢复提交前状态；当前创建者业务责任方重开可一并提出完整有效排期，通过回到进行中并增加轮次，拒绝/撤销保留已完成。普通修改或进展拒绝/撤销 SHALL 保留原版；待审到期按失效要求保留提交前状态并解冻。

#### Scenario: Freeze and cancel an application
- **WHEN** 多名负责人同时提交进展/完成，或非申请人尝试撤销
- **THEN** 系统 SHALL 最多产生一个待审并冻结其他任务业务变更（独立评论除外），只有申请人可撤销，原创建者或审核人 SHALL 不能替他撤销；仅未发布创建申请适用停用管理处置的受控例外

#### Scenario: Restrict comparison data to the reviewer
- **WHEN** 申请人、审核人及普通任务查看者分别读取同一变更
- **THEN** 审核人 SHALL 可看逐项 diff，申请人仅看提交内容及结果而无专用原版对比字段，普通人在详情/表单 SHALL 只见旧有效版和冻结，日历仅显示允许的排期投影与虚线而不获得完整提议或 diff；固定创始人免审的合法操作 SHALL 已直接生效，不生成待本人决定的申请；历史对比仍仅授权审核身份

#### Scenario: Distinguish completion outcomes
- **WHEN** 负责人提交完成后分别发生通过、退回或撤销
- **THEN** 系统 SHALL 分别进入已完成、进行中或恢复提交前执行状态，退回 SHALL 要求意见，所有路径 SHALL 解除待审冻结并保留结果

#### Scenario: Reopen with a new schedule
- **WHEN** 当前创建者业务责任方对已完成任务提出重开及新排期且全部校验通过
- **THEN** 系统 SHALL 在操作者直属上级批准或固定创始人合法免审后同时发布新排期、进入进行中及下一轮次；任何失败保留原完成状态和排期，其他人无重开权

#### Scenario: Assignee updates progress
- **WHEN** 当前负责人每次新增或修改文字进展
- **THEN** 系统 SHALL 按本次操作者当前直属上级审核；非创始人先待审冻结，固定创始人直接生效并留因，首次进展生效才变进行中，有效负责人可按本要求修改其他资料，但无负责人列表修改权，除非同时具备创建者/正式接管资格

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
- **THEN** 页面 SHALL 默认只展示后端授权的实际变化字段，每项字段原值在上、新值在下，并完整展示有序负责人，不把换序视为无变化；创建换序不描述为改变创建审核人，申请人及旁观者不因展示扩权

#### Scenario: Reopen an overdue completed task from the web form
- **WHEN** 当前创建者业务责任方对旧截止已过的已完成任务填写重开原因及明确到日期时刻的完整未来排期
- **THEN** Web SHALL 一并提交排期并按操作者直属上级审核及固定创始人免审规则处理，通过则新排期、进行中和新轮次生效且提醒按新轮次排期去重，拒绝撤销失效保留原已完成状态及有效排期

#### Scenario: Resubmit an expired creation as a new request
- **WHEN** 失效创建的原申请人选择修改并重提并调整排期
- **THEN** 页面 SHALL 清楚展示失效及原提议，提交建立新申请并重算创建路线，旧申请保持失效；他人、重复并发重提及旧审核按钮不能复活旧申请或多次生效

#### Scenario: Validate a direct application as strictly as a reviewed change
- **WHEN** 当前创建者业务责任方修改资料或重开，或其作为负责人提交进展/完成
- **THEN** 操作 SHALL 在权限、版本、幂等、有效负责人、排期/截止、冻结、关联全部合法后，由操作者直属上级审核生效；仅固定创始人合法免审时一次生效并留历史和免审原因

#### Scenario: Submit information and progress together
- **WHEN** 当前有效负责人一次修改名称、说明、标签、排期和当前进展，并保留负责人列表
- **THEN** 系统 SHALL 仅创建一个按实际操作者直属上级审核的申请，未批准前普通资料仍为旧版，批准后全部原子生效并保留字段审计及有效进展；拒绝、撤销、失效不得部分发布

#### Scenario: Restrict owner replacement and order
- **WHEN** 非创建者且非接管人的有效负责人更换、增删或重排负责人，或创建者在任/正式接管人合法修改同一列表
- **THEN** 前者 SHALL 在提交和生效阶段均被拒绝且不部分保存，后者 SHALL 按非空、有序、有效员工及原审核规则处理；正式接管不改原创建者

#### Scenario: Preserve special operations and revalidate the applicant
- **WHEN** 用户通过普通信息编辑直接改完成状态、混入交接/重开，或申请人在批准前失去本次变更字段资格
- **THEN** 系统 SHALL 拒绝非法变更或阻断生效，完成、交接、重开仅由各自专用流程办理，免审亦不能跳过字段权限与版本校验

#### Scenario: Stack only authorized changed values
- **WHEN** 审核人查看多字段、仅负责人换序或多标签申请，申请人和普通查看者也读取同一申请/任务
- **THEN** 审核人 SHALL 默认只见变化字段且原值在上新值在下，顺序变化可辨；申请人仅得其提议和结果，普通查看者不得获得专用差异，创建申请无旧版时不伪造原值

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

### Requirement: Personal work logs
日志 SHALL 归作者并按公司业务日期同人同日唯一，新建允许公司今天、昨天、前天，不允许更早或未来；写日志 SHALL 只提供近三天尚未创建且可创建的日期，不提供独立补写按钮；已有日期不进入创建选择，三天均已有日志时提示从详情编辑。编辑 SHALL 通过显式日志标识进入，重复创建冲突不得自动转为编辑或覆盖原记录。日志创建后 SHALL 不改业务日期。冻结 SHALL 为真实首次创建时间加 24 小时，编辑不重置计时，服务端达到冻结点立即只读，跨零点不提前冻结。编辑和删除 SHALL 仅作者且共用该窗口，删除重建 SHALL 不重置首次创建时间或清除同人同日冻结约束。

前后端 SHALL 一致显示可编辑性、冻结时间和重复/到期反馈，旧页面到期提交及并发 SHALL 不绕过限制；存量日志保留真实创建时间，冻结和他人日志不显示正文编辑/删除。新建编辑 SHALL 保留全屏表单、伸展正文和可达保存/返回/关闭，离开恢复其他弹层布局。

日志 SHALL 可选关联一项作者当前正常可见任务，支持名称搜索、空结果和清空，关联详情独立鉴权。创始人看公司、部门负责人看本人及本部门全部直接/间接下属、团队负责人看本人及本团队员工、普通员工看本人，上级不能编辑正文，同团队/同任务不授予日志权；关联任务失权 SHALL 裁剪跳转但保留有权正文。标签 SHALL 同受日志编辑冻结规则，独立评论按评论要求处理。

日志日期转换 SHALL 使用日志模块可访问的统一公司业务日期方法，不依赖日程私有函数或偶然脚本加载顺序。详情“编辑日志” SHALL 传入真实日志标识，写日志及关闭保存入口操作和样式正确；从人员资料进入目标日志 SHALL 使用独立人员工作页/详情按当前日志权限查询，不修改本人日志页范围或恢复旧人员筛选。

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
- **WHEN** 用户在真实服务中通过写日志创建近三天缺失日期、从详情编辑并保存/关闭，随后从人员资料进入某人日志
- **THEN** 系统 SHALL 无 dateKey 作用域异常，真实日志标识及日期正确，人员阅读与本人列表隔离且目标人员不被旧筛选隐藏；三天窗口、同日唯一、首次24小时冻结及删除重建约束仍生效

#### Scenario: Keep creation separate from an existing log
- **WHEN** 今天已有日志、昨天和前天未写，或创建时同日记录被另一请求抢先创建
- **THEN** 写日志 SHALL 仅提供缺失可创建日期，已有记录从显式详情编辑；重复创建保持草稿和明确冲突，不覆盖已有日志、不自动切换编辑，全部日期已写时不打开编辑界面

### Requirement: Log page single-content filtering and scroll return
日志功能的Web导航、标题、首页和相关入口 SHALL 统一称日志。日志页 SHALL 仅列当前登录者本人日志，不混入任务创建、审核、申请、请示或他人日志；移除部门、团队、人员及范围内全部筛选。计数、刷新、回顶、账号切换及历史筛选状态 SHALL 始终使用本人范围。

人员资料的已有合法日志阅读 SHALL 使用独立弹层，不切换日志页作者或扩大当前权限；详情回读和返回不得将他人记录混入本人列表。上级只能按服务端现有范围阅读，不能修改他人正文；任务关联与评论仍独立鉴权。无本人日志 SHALL 显示明确个人空态。

日志卡片 SHALL 移除查看与评论按钮，直接点击正文/空白或聚焦后按Enter/Space进入原详情与评论。卡片内编辑及关联任务按钮 SHALL 仅执行自身动作，不能重复打开日志详情。编辑、冻结和评论权限仍由服务端校验。

创建和编辑日志的日期、标签 SHALL 使用一致的字段标题、间距和控件高度；桌面同排对齐，窄屏同列边缘对齐，无截断或横溢。写日志继续沿用先前变更的三天内缺失日期创建入口，已有记录从明确编辑入口进入。

#### Scenario: Search each hierarchy within authorization
- **WHEN** 用户进入日志页，或旧状态仍保存他人、部门、团队与作者搜索条件
- **THEN** 页面 SHALL 不提供作者层级筛选，只显示当前本人日志和正确计数；无本人日志显示个人空态，合法他人阅读仅从资料独立进入

#### Scenario: Reset invalid children and restore self
- **WHEN** 用户进入日志页，或旧状态仍保存他人、部门、团队与作者搜索条件
- **THEN** 页面 SHALL 不提供作者层级筛选，只显示当前本人日志和正确计数；无本人日志显示个人空态，合法他人阅读仅从资料独立进入

#### Scenario: Use consistent names and the selected log date
- **WHEN** 用户从导航或首页进入日志或执行日志创建命令
- **THEN** 页面 SHALL 统一称日志并只列本人，写日志沿用近三天缺失日期创建，编辑从明确编辑入口进入

#### Scenario: Enter with self and filter a direct report
- **WHEN** 用户进入日志页，或旧状态仍保存他人、部门、团队与作者搜索条件
- **THEN** 页面 SHALL 不提供作者层级筛选，只显示当前本人日志和正确计数；无本人日志显示个人空态，合法他人阅读仅从资料独立进入

#### Scenario: Return to the top without mixing workflows
- **WHEN** 用户滚动本人日志并回到顶部
- **THEN** 系统 SHALL 保留本人列表与滚动功能，不恢复人员筛选或混入其他工作流

#### Scenario: Enter the log page
- **WHEN** 用户从导航或首页进入日志或执行日志创建命令
- **THEN** 页面 SHALL 统一称日志并只列本人，写日志沿用近三天缺失日期创建，编辑从明确编辑入口进入

#### Scenario: Select pending reviews
- **WHEN** 用户寻找待我审核事项
- **THEN** 审核 SHALL 从通知中心进入，日志页只写看本人日志，不混入待审标签

#### Scenario: Switch between role-specific content filters
- **WHEN** 用户进入日志页，或旧状态仍保存他人、部门、团队与作者搜索条件
- **THEN** 页面 SHALL 不提供作者层级筛选，只显示当前本人日志和正确计数；无本人日志显示个人空态，合法他人阅读仅从资料独立进入

#### Scenario: Invoke a log-page command
- **WHEN** 用户从导航或首页进入日志或执行日志创建命令
- **THEN** 页面 SHALL 统一称日志并只列本人，写日志沿用近三天缺失日期创建，编辑从明确编辑入口进入

#### Scenario: Toggle own logs
- **WHEN** 用户进入日志页，或旧状态仍保存他人、部门、团队与作者搜索条件
- **THEN** 页面 SHALL 不提供作者层级筛选，只显示当前本人日志和正确计数；无本人日志显示个人空态，合法他人阅读仅从资料独立进入

#### Scenario: Restore the visible log scope
- **WHEN** 用户进入日志页，或旧状态仍保存他人、部门、团队与作者搜索条件
- **THEN** 页面 SHALL 不提供作者层级筛选，只显示当前本人日志和正确计数；无本人日志显示个人空态，合法他人阅读仅从资料独立进入

#### Scenario: Search logs by author
- **WHEN** 用户进入日志页，或旧状态仍保存他人、部门、团队与作者搜索条件
- **THEN** 页面 SHALL 不提供作者层级筛选，只显示当前本人日志和正确计数；无本人日志显示个人空态，合法他人阅读仅从资料独立进入

#### Scenario: Show no matching authors
- **WHEN** 用户进入日志页，或旧状态仍保存他人、部门、团队与作者搜索条件
- **THEN** 页面 SHALL 不提供作者层级筛选，只显示当前本人日志和正确计数；无本人日志显示个人空态，合法他人阅读仅从资料独立进入

#### Scenario: Keep log finding separate and scoped
- **WHEN** 用户进入日志页，或旧状态仍保存他人、部门、团队与作者搜索条件
- **THEN** 页面 SHALL 不提供作者层级筛选，只显示当前本人日志和正确计数；无本人日志显示个人空态，合法他人阅读仅从资料独立进入

#### Scenario: Return to the top of log content
- **WHEN** 用户滚动本人日志并回到顶部
- **THEN** 系统 SHALL 保留本人列表与滚动功能，不恢复人员筛选或混入其他工作流

#### Scenario: Reset old filters when opening logs from a person profile
- **WHEN** 用户从人员资料进入有权阅读的日志
- **THEN** 日志 SHALL 在独立弹层按当前权限读取，旧筛选不隐藏目标，返回日志页仍只有本人日志

#### Scenario: Keep the log page personal after reading another person
- **WHEN** 上级旧状态指向下属，或通过人员资料阅读下属日志后返回、刷新
- **THEN** 日志页 SHALL 只列本人日志且无人员筛选，条数与本人集合一致，合法人员阅读保留在独立弹层

#### Scenario: Show a personal empty state
- **WHEN** 当前用户无本人日志但有阅读下属日志权限
- **THEN** 日志页 SHALL 显示暂无个人日志，不展示下属正文或提示调整已不存在的人员筛选

#### Scenario: Open details and comments directly
- **WHEN** 点击日志正文/空白或用Enter/Space激活卡片
- **THEN** 系统 SHALL 打开对应日志详情和评论，合法用户可按原权限发表评论

#### Scenario: Preserve nested controls
- **WHEN** 作者点击卡片编辑按钮或有权用户点击关联任务按钮
- **THEN** 系统 SHALL 分别打开该日志编辑或关联任务详情，不额外触发日志详情

#### Scenario: Align metadata in creation and editing
- **WHEN** 在320、390和1440宽度创建或编辑日志
- **THEN** 日期和标签 SHALL 相同控件高度、同排顶边或同列左右边对齐，无溢出；正文及保存关闭入口可用

#### Scenario: Keep workflow and identity boundaries
- **WHEN** 用户回顶、刷新或切换账号后进入日志页
- **THEN** 页面 SHALL 只写看当前用户日志，审核从通知进入，旧账号数据和筛选不能保留

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
“我的” SHALL 展示本人姓名、部门、职位、独立团队、直属上级和手机号，并展示由位置推导的四层身份，提供编辑本人头像/邮箱、修改密码、退出；姓名与手机号 SHALL 仅由管理员修改，本人字段不可借混合请求越权修改。组织及授权字段 SHALL 只能通过管理流程维护。管理层下属资料入口 SHALL 覆盖当前实际管理链全部直接和间接下级，不扩大资料范围或开放公司通讯录、资料卡派发按钮。人员详情 SHALL 按账户与联系方式规则独立检查手机号权限。日志 SHALL 继续独立鉴权，部门负责人含本部门全部下级、团队负责人含本团队员工，创始人含全公司。

页面 SHALL 移除员工团队管理入口，不展示员工用户名；创始人公司层、部门负责人部门层、团队负责人/普通员工部门与团队层 SHALL 分别按实际位置展示，不伪造缺失组织字段。手机号仅本人及实际管理链上级在授权详情中可读，邮箱仅本人；目录不得成为全公司联系方式目录。

本人及下属人员资料 SHALL 在单公司场景移除“公司”资料行，仍按真实位置表达公司层/部门/团队。身份、职位、部门 SHALL 分别取实际组织数据，不能以职位推导身份、用团队替代部门或展示伪造的“员工 · 部门负责人 · —”。组织或资料更新后重新读取 SHALL 刷新已有人员，只有姓名的摘要不得覆盖完整资料，退出/切换账号及失权不得复用原人员联系方式或旧范围。

#### Scenario: Read and edit the required profile
- **WHEN** 本人打开“我的”并修改联系方式
- **THEN** 系统 SHALL 不显示公司行，显示独立部门/职位/团队字段并保存允许的本人字段，组织/权限修改 SHALL 被拒绝，改密及退出 SHALL 可用

#### Scenario: Open a subordinate within both profile scope and the management chain
- **WHEN** 管理层从“我的”查看直属或间接下属资料和日志
- **THEN** 列表 SHALL 仅含当前资料权限与实际管理链同时允许的下属；详情 SHALL 重新检查资料权和手机号权，不提供派发按钮；间接下属日志 SHALL 按当前固定组织矩阵独立裁决，非管理链人员 SHALL 不出现在该入口

#### Scenario: View profile
- **WHEN** 本人打开“我的”并修改联系方式
- **THEN** 系统 SHALL 不显示公司行，显示独立部门/职位/团队字段并保存允许的本人字段，组织/权限修改 SHALL 被拒绝，改密及退出 SHALL 可用

#### Scenario: Keep identity fields read-only to employees
- **WHEN** 员工尝试从页面或直接 API 改姓名/手机号，同时打开头像、邮箱、改密入口
- **THEN** 姓名/手机号修改 SHALL 被拒绝，其余合法本人维护可用，无员工用户名和团队管理入口；职位改名不改变任何业务权限

#### Scenario: Refresh a known person without losing organization fields
- **WHEN** 已缓存某人员后其组织身份、职位或部门更新，随后收到仅姓名摘要、读取完整资料并刷新
- **THEN** 人员展示 SHALL 使用最新合法完整资料，摘要不将身份重置为员工、不丢真实部门，空值安全表达，手机号邮箱不进入普通摘要缓存；本人及下属资料无公司行

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
账号 SHALL 由管理员手动创建，不开放自助注册；员工使用本人手机号登录，独立管理员使用独立管理员账号名和密码模型。手机号 SHALL 统一规范化并在认证可识别范围唯一，不得歧义登录；非演示升级迁移保留员工 ID、原凭据和业务历史，组织关系按显式合法位置映射转换；非演示不得以新建任意账号替代原身份，演示库可按受控流程重建。管理员建号和管理员合法改号 SHALL 同步登录标识，空号与重复号有明确处理反馈。系统 SHALL 生成随机初始密码并强制首次改密；管理员重置密码 SHALL 再次强制改密。新密码 SHALL 至少 10 个字符、含字母与数字且 UTF-8 长度不超过 72 字节。强制改密会话 SHALL 仅可办理本人改密及退出，不能读取或修改业务数据；日常改密 SHALL 校验旧密码，成功后撤销包括当前会话在内的全部会话并要求重新登录。管理员 SHALL 可录入/覆盖员工手机号，并在本公司专用员工管理列表及详情读取完整登录手机号；普通目录和审计不得回显他人手机号；本人仅可编辑头像、邮箱和密码，姓名与手机号仅管理员可改。

按 2026-10-19 调整，员工业务中的手机号 SHALL 仅本人及实际管理链上的上级可见；本公司独立管理员另可通过员工管理列表及详情读取完整登录手机号；他人读取 SHALL 同时满足当前资料查看权、同组织有效人员关系及更高组织层级，且仅通过鉴权人员详情返回。邮箱 SHALL 仍仅本人可见。同级、下属、其他管理链或仅有公司/部门资料范围 SHALL 不因此取得手机号权；管理员仅通过专用同组织员工管理接口读取，不能扩散到业务目录。目录、任务人员摘要、日志筛选、通知、分析、审计、outbox 及普通人员缓存 SHALL 不含号码；历史通知只读例外 SHALL 不授予手机号权。

员工 SHALL 用明确手机号字段登录，以姓名展示、稳定内部标识关联任务/日志/组织/通知，最终员工结构、索引、当前接口字段/解析、生成器、搜索、展示、准备脚本及当前测试不再依赖员工用户名。历史已应用迁移和历史文档不机械删改，但通过新迁移清除最终结构中的用户名及映射残留；不得用手机号充当公开用户名。手机号建号必填、不可清空、规范化且在无租户选择的员工认证范围唯一；管理员改号同步登录键且员工 ID 不变。

管理员凭据 SHALL 独立于员工用户名存储，每公司一个账号，在“管理员账号”区域维护，不出现在员工名单、组织树、任务候选、日志目录或业务审核，不要求员工部门/团队/职位。登录 SHALL 显式区分 employee/admin，不跨类型回退；缺失类型或旧员工 username 载荷返回明确契约错误且不创建会话，拒绝歧义身份及重复员工手机号，保留显式管理员修复入口。改号 SHALL 撤销该员工既有会话，管理员凭据更新也撤销其原会话；首登和密码策略、重置、日常改密规则继续生效。

管理员员工列表、详情及编辑回读 SHALL 显示真实完整登录手机号以核对账号，缺失时明确未设置，不以普通联系电话或公开用户名替代。改号 SHALL 仍规范化并校验唯一性、保留员工 ID、更新登录键及撤销原会话。管理手机号 SHALL 不进入普通人员缓存、任务参与人、候选、日志、通知、分析、审计或事件载荷；读取管理权限和同组织范围必须由服务端校验。

#### Scenario: Initial login cannot enter business pages
- **WHEN** 新员工用生成的初始密码登录并尝试直接访问业务接口
- **THEN** 系统 SHALL 提示必须改密并拒绝业务访问，改密成功后旧会话失效，使用新密码重新登录后方可进入

#### Scenario: Password validation and reset
- **WHEN** 本人提交错误旧密码、少于 10 字符、缺字母/数字或超过 72 UTF-8 字节的新密码
- **THEN** 系统 SHALL 拒绝修改；管理员重置后 SHALL 生成新初始密码、撤销旧会话并恢复首次改密门禁

#### Scenario: Edit contacts without exposing another employee phone
- **WHEN** 管理员录入员工号码或其他用户读取目录、人员摘要、日志筛选、通知及分析
- **THEN** 系统 SHALL 允许管理员授权写入并在员工管理列表/详情读取登录号，其他上述读取结果 SHALL 不含号码；本人资料接口 SHALL 可读取自己姓名/手机号并编辑邮箱、头像，姓名和手机号由管理员维护

#### Scenario: Read phones only through authorized person details
- **WHEN** 本人、直属上级、间接上级、同级、下属、其他管理链上级及管理员读取人员详情
- **THEN** 本人 SHALL 可读自己的手机号；直属或间接上级 SHALL 仅在具有当前资料权且组织层级更高时可读下属号码；本公司管理员 SHALL 仅从专用员工管理列表/详情读取登录号，其余人不获得号码，业务资料权不足 SHALL 拒绝整个详情，任何他人详情 SHALL 不返回邮箱

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

#### Scenario: Verify the stored login phone after an administrator change
- **WHEN** 本公司管理员读取员工管理列表和详情，合法改号并重新读取，同时普通员工或跨组织管理员直连同一数据
- **THEN** 合法管理员 SHALL 在两处看到当前完整登录号，改号后登录键和会话处理按原规则；其他人越权请求拒绝，公共DTO及审计不含新增号码字段

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

### Requirement: Complete task operation history
管理端 SHALL 可按任务追溯具体字段前后值、有序负责人变化、申请/版本、申请人与审核人、决定意见、改派、失效、交接、完成、重开和无需审核原因。App SHALL 仅展示当前有效资料、有效进展、相关申请及审核意见，不开放完整历史。通知删除/撤回/清理 SHALL 不删除业务历史，历史 SHALL 不包含密码或他人手机号。

历史 SHALL 独立保存固定组织调整、正式业务接管对象/前后责任方、时间、管理员办理人和原因，以及本人直接生效的真实操作者和免审原因；原创建者及创建时间不覆盖，接管任务不标成接管人原始创建。管理员来源 SHALL 可追溯但不伪装成业务申请人或审核人。

员工 Web 任务详情 SHALL 移除历次进展与执行记录时间线，只展示当前有效进展及当前用户有权读取的相关申请/审核意见；员工任务投影 SHALL 不返回历次执行记录集合。相关审核意见不得变相扩成完整历史。记录移出员工端 SHALL 不删除进展、执行或字段审计，管理端完整历史继续可追溯。

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

#### Scenario: Keep current progress without an execution timeline
- **WHEN** 同一任务有多轮进展、完成、重开及审核意见，员工和管理员分别读取
- **THEN** 员工 SHALL 只得当前进展及其有权相关审核意见，无历次执行记录时间线或完整历史接口权；管理员仍可查完整原记录，通知清理也不删除历史

### Requirement: Shared single-select tags for tasks and logs
任务和日志 SHALL 共用本公司标签目录；任务和日志均可选择零到多个不同共用标签并保存稳定顺序。只有固定创始人员工可维护共用标签，其他员工仅在有对象编辑权时选择/清除；管理员和任意无上级账号不取得维护权。任务标签集合 SHALL 跟随任务提议、审核、有效版本和历史，日志标签集合 SHALL 随作者合法编辑直接保存并受原冻结规则约束，不引入日志审核。系统 SHALL 仅提供公司共用标签，移除私人标签和私人颜色覆盖；旧私人目录及覆盖不得自动转为共用标签或公开内容。

任务及日志列表/详情、人员日志和有权查看的任务审核差异 SHALL 显示完整标签集合；改名改色更新当前引用且不重写已记录审计。删除为逻辑删除，禁止新引用，已有版本保留删除时名称颜色及“已删除”标记，可清除替换，不级联删除业务。任务日程 SHALL 使用共用集合第一项颜色，不提供私人覆盖；无标签默认粉色，不因多选改写任务排期。

原任务及日志单标签数据 SHALL 无损映射为一项集合，空值映射为空集合，不改变对象标识、正文、创建时间、日期、冻结或审计。日志接口 SHALL 统一输入标签标识集合、输出有序标签集合，编辑省略标签保留全体，空集合清空；重复标识、跨公司、已移除私人标识、已删除新引用及不支持的请求字段 SHALL 拒绝且不部分保存。项目尚未交付，本次 SHALL 不增加旧单标签客户端兼容、首项投影或双写要求；原生端适配另行处理。

日志多选 SHALL 复用任务色块按钮的选择体验，名称、换行、描边/勾选、可访问状态和键盘行为一致；创建/编辑模式独立，选择关联任务后返回或保存失败保留标签及正文草稿。选中顺序 SHALL 稳定，取消再选按新加入位置，不按目录排序重排。已有删除标签 SHALL 保留快照和位置并可移除，移除后不能再次新挂回。

#### Scenario: Enforce root-only maintenance and single selection
- **WHEN** 创始人、其他员工、管理员维护标签，或任务和日志选择多个标签
- **THEN** 仅创始人 SHALL 可维护共用目录，合法任务及日志多选均按保存顺序持久化；跨公司、已移除私人标识和越权引用拒绝

#### Scenario: Rename recolor and delete a referenced tag
- **WHEN** 集合中的标签改名改色或删除
- **THEN** 当前引用 SHALL 按规则更新，删除保留既有快照标记、禁止新关联，集合其他标签和业务历史不丢失

#### Scenario: Respect review freezing and calendar color
- **WHEN** 用户修改任务标签、查看尚未批准的提议或编辑冻结日志
- **THEN** 多标签 SHALL 整体随操作者直属上级审核规则生效，普通区域保留旧集合，冻结/越权日志拒绝；日程按共用集合首项、默认粉色顺序取色且无私人覆盖

#### Scenario: Preserve legacy and historical tags
- **WHEN** 已有单标签数据升级，或历史任务/日志标签编辑后刷新
- **THEN** 系统 SHALL 无损回读有序全体标签，省略字段不清空集合、空集合显式清除；仅当前查看权限者可读有效标签及授权提议，日志日期和冻结时间不因迁移/编辑变化

#### Scenario: Save and read multiple log tags
- **WHEN** 作者在未冻结日志依次选择甲乙、取消甲、选择丙，保存、刷新并由有权上级阅读
- **THEN** 日志 SHALL 保存并完整显示乙丙，所有授权列表/详情和人员日志顺序一致，不因目录排序或页面切换重排；未授权者不得获得日志或私人标签

#### Scenario: Keep log constraints with collection writes
- **WHEN** 作者提交多标签日志遇到24小时冻结、同日创建冲突、旧版本或网络失败，或上级尝试改标签
- **THEN** 服务端 SHALL 按日志原资格及冻结规则拒绝非法写入且不部分保存，Web保留当前模式的正文/标签/关联草稿，不重置真实首次创建时间，独立评论仍按原规则办理

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

### Requirement: Convergent organization and identity schema upgrades
系统 SHALL 通过新增数据库迁移达到固定创始人/组织位置、必填展示职位、独立管理员、员工用户名清理及业务接管目标结构；不修改已应用历史迁移。新建库与从当前结构升级的库 SHALL 获得一致最终结构与约束，不要求必须重建演示库才能运行。

非演示升级 SHALL 保留稳定员工和业务历史标识，以显式映射处理旧组织；无法证明的创始人、负责人、位置、管理员或重复手机号 SHALL 报告并阻断相关正式业务，不任意猜测、不赋予免审或旧授权。迁移准备/修复不依赖员工用户名生成或残留旧授权。最终结构 SHALL 以外键、唯一性、位置约束和完整结果事务防止非法关系，账号拆分后管理操作来源仍可追溯。

#### Scenario: Compare fresh installation with an upgraded database
- **WHEN** 分别在隔离空库执行完整迁移、在当前版本结构及映射数据上执行新增迁移
- **THEN** 最终组织/身份/接管结构和约束 SHALL 一致，无员工用户名字段/索引和旧授权运行依赖，升级保留业务内部标识、原始创建来源及管理员审计

#### Scenario: Block an unresolvable mapping without fabricating identity
- **WHEN** 升级发现缺失负责人、孤立根节点、重复手机号或管理员与员工来源不能合法拆分
- **THEN** 系统 SHALL 报告具体映射阻断并提供受控管理员修复，未解决前相关正式业务不开放，不猜测创始人/上级、跳过外键或以无人审核直接生效

### Requirement: Notification list presentation and combined filters
通知中心 SHALL 提供精简/完整显示切换及“全部/未读/已读”和“全部/需我审核/结果告知/提醒/评论/其他”组合筛选。筛选针对当前全部可见通知，先过滤后分页/计数，保持时间倒序稳定排列；全局未读数不受筛选影响。打开消息才标已读，切换筛选不标已读，详情返回保留条件；账号切换清除旧会话数据。

实际生成的临期20%、10%、5%及逾期提醒 SHALL 归“提醒”，详情用途与列表、筛选、分页总数 SHALL 一致；不能因事件名格式不同落入“其他”。修正既有消息的读取分类 SHALL 不重投递、重复计数或改变已读状态。

#### Scenario: Filter across page boundaries
- **WHEN** 目标消息位于后续页，用户同时选择未读与结果告知
- **THEN** 列表 SHALL 返回完整匹配集合及正确总数，明确区分无通知与无匹配，并支持清空筛选

#### Scenario: Require actionable review classification
- **WHEN** 原待审已办结、过期、改派或撤回，用户筛选需我审核
- **THEN** 该消息 SHALL 不再列为当前需我审核，结果消息按结果类型可查；旧提交事件归其他且不能伪装成新结果事件，权限变化不恢复隐藏正文

#### Scenario: Return after opening an unread notification
- **WHEN** 用户从未读筛选打开详情后返回
- **THEN** 已读状态和未读数 SHALL 更新，原筛选保持，该消息退出未读集合；精简行只包含所属任务/对象、类型、已读、时间

#### Scenario: Classify actual reminder events across pages
- **WHEN** 收件箱多页中有真实临期20%、10%、5%和逾期事件，用户组合选择提醒及已读条件
- **THEN** 全部合法匹配消息 SHALL 归提醒且完整计数，详情表明提醒用途，其他分类不重复包含；修复前已存在消息同样正确，不重新发消息或标已读

### Requirement: Generated notification content and one object destination
当前业务通知的对象名称、类型、已读状态、时间、标题及实际变更摘要 SHALL 从合法业务对象、事件快照、申请或接收人记录自动取得，不要求用户另外填写通知正文。用户提交的任务、进展、审核意见和评论可作为真实事件内容来源；缺失对象、撤回或失权 SHALL 使用安全占位并按权限移除跳转，不能恢复受限正文或编造业务结果。

同一通知详情指向同一任务的普通跳转 SHALL 合并为一个“查看任务”入口；日志通知使用“查看日志”。评论消息 SHALL 优先提供定位所属对象评论区的“查看评论”，不额外重复同对象普通跳转。审核/查看原申请结果是独立动作，历史通知只读例外 SHALL 继续使用专用只读入口，不能因合并取得普通访问权。

通知详情 SHALL 将真实事件结果和具体变化置于主要信息区，任务/对象名称和通知时间各展示一次，避免标题、结果、用途与长正文重复。申请状态 SHALL 简短可辨；无可证明结构化变化的历史消息保留合法摘要，不猜测原值或编造变化。通知变化展示 SHALL 仅包含该接收人本来可读的事件内容，不等同于审核专用差异。

任务可读、原申请可读与可审核 SHALL 独立裁决。仅当原申请存在、属于该通知绑定对象且当前用户有该申请读取权时，系统 SHALL 提供原申请入口；可审核还须当前有权、待审、未到期。普通结果接收人不得因收到通知获得申请/提议/diff 权，无权原申请 SHALL 隐藏入口并提供简短不可查看反馈。有权申请人/对应审核人仍能读取准确原申请及结果，不能跳转到同任务后续申请。

详情 SHALL 明确一个主要操作：优先当前审核，其次有权查看原申请，再其次查看关联对象；其他合法导航降低强调，同对象不重复。撤回通知、删除消息及申请人的撤销申请 SHALL 收进“更多”，命名区分，各自权限、时限、确认与业务后果保持；无资格操作不显示。键盘、触摸和返回后的焦点 SHALL 可用。撤回、失权、评论删除及到期时，结构化结果/变化和按钮 SHALL 同步按原生命周期裁剪。

#### Scenario: Open one task destination from an ordinary task message
- **WHEN** 正常任务通知同时绑定所属任务和相同的业务对象
- **THEN** 详情 SHALL 只显示一个任务跳转，不同时显示重复的查看任务/查看对象；原申请审核或结果入口按原权限独立保留

#### Scenario: Locate the notified comment
- **WHEN** 合法接收人打开任务或日志的评论消息
- **THEN** 详情 SHALL 提供一个定位相应评论区的入口；评论删除或对象失权后隐藏受限正文和跳转，不以普通任务入口绕过

#### Scenario: Generate each supported notification from its event
- **WHEN** 系统生成当前支持的审核提交/结果、提醒、评论及其他通知，包括无任务、对象缺失、撤回或失权情形
- **THEN** 展示字段 SHALL 可追溯到真实事件/对象/申请/接收人状态或安全兜底，不出现独立手填通知步骤、原始空值或不可安全访问的对象名称

#### Scenario: Read a concise multi-field result
- **WHEN** 结果接收人打开一次修改名称、排期和标签的通知
- **THEN** 详情 SHALL 优先显示真实事件结果与合法具体变化，任务名及通知时间各一次，申请状态简短，主要操作明确，删除/撤回等次要操作位于更多；业务原文不因去重被改写

#### Scenario: Separate result delivery from request access
- **WHEN** 申请人、对应审核人、普通结果接收人及仅历史任务可读者分别打开绑定同一申请的通知
- **THEN** 仅有原申请读取权者 SHALL 看到有效原申请入口，仅当前合法审核人可办理待审；其他人保留各自合法结果摘要或历史只读入口，无无效申请按钮，不取得提议/diff 或后续申请权限

#### Scenario: Recheck stale request links and redact new fields
- **WHEN** 原申请不存在、绑定不一致、改派、办结或权限变化，或通知撤回/到期/评论删除
- **THEN** 系统 SHALL 重验原申请和通知各自访问权，隐藏无效操作并按原规则裁剪结果、变化及正文；旧按钮不得办理新申请或恢复受限内容

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

### Requirement: Personal task table and founder-only tag maintenance
任务表单 SHALL 仅显示本人原始创建或当前有效负责的授权任务，在搜索、计数和分页前排除仅可见的下属任务；不提供仅可见筛选。其他授权入口保持原范围。
公司共用标签目录创建、改名、改色、删除 SHALL 仅固定创始人可执行，服务端校验与canEdit一致；其他人员仅在任务/日志编辑中选择或清除。日程 SHALL 移除标签管理及图例行，任务只使用共用首项和默认颜色，全局移除私人标签及私人颜色覆盖。

#### Scenario: Inspect a manager's task table
- **WHEN** 上级同时可见本人创建、本人负责和仅下属负责的任务
- **THEN** 表单 SHALL 只保留前两类，搜索和总数不能恢复第三类

#### Scenario: Reject tag maintenance without removing task colors
- **WHEN** 普通员工通过界面或直接API维护共用标签或尝试创建已移除的私人标签
- **THEN** 系统 SHALL 拒绝维护，任务/日志编辑仍能选择清除；日程任务颜色保持，创始人在我的页面维护标签

### Requirement: Single creation entry for recent missing logs
写日志 SHALL 统一提供公司今天、昨天、前天尚未创建的日志日期；不再提供独立补写按钮。已存在日期 SHALL 不出现在创建选择中，所有日期已写提示从详情编辑。编辑 SHALL 通过显式日志ID进入；重复创建竞态不得自动转编辑或覆盖原记录。

#### Scenario: Create missing days and edit through detail
- **WHEN** 今天已写、昨天和前天未写，用户选择写日志
- **THEN** 系统 SHALL 只提供昨天和前天的创建选择；三天全部已写则提示，不进入编辑；详情编辑仍按作者与冻结权限校验

### Requirement: Hierarchical subordinate workspace
我的下属资料 SHALL 按真实直属关系排列全部合法下属及其下属，分层展开/收起与点击人员分离，姓名、职级/职位和真实部门/团队分别可辨，不能有职位时省略组织；公司层无部门者显示公司层，不伪造组织。展开状态不跨账号泄漏。不能仅按职级名称猜测关系或扩展人员权限。

点击下属 SHALL 先打开独立人员资料卡，展示授权资料并提供“日程”“日志”入口；进入工作浏览后复用本人相应浏览体验，明确所选人员。日程遵循月/日视图和日期清单要求，日志 SHALL 按业务日期/时间倒序显示授权记录，可分页加载并进入全文，不把人员资料与工作内容混排。

任务和日志 SHALL 可进入原鉴权详情/评论，返回保留人员、日期和页签；本人页面数据范围不变。下属日程页面 SHALL 不提供整条平移、端点拖动、画布上的独立调时操作或任务表单入口；从下属入口进入的任务、日志及其父子/关联任务、嵌套申请详情 SHALL 保持业务只读，仅允许按正常对象及作者权限读取、发表和维护本人评论；不提供编辑、排期、进展、完成、交接、交接预设、重开、置顶、申请提交/撤销或审核等其他写操作。独立本人授权入口仍按其字段/专用权限办理，来源模式不得增加服务端权限。无数据、加载、失败、重试和失权状态 SHALL 明确，不保留失权正文。组织/账号变化重验权限，旧响应不能串到另一人或账号。

下属工作浏览 SHALL 使用独立于本人页面的人员、日期、模式、日轴方向、页签、分页及滚动状态；工作详情的返回、头部关闭、Esc 和可用遮罩退出 SHALL 只退出当前层并恢复原人员工作页及焦点，不清空导航链退回“我的”。评论保存后也 SHALL 保留来源只读模式；失权后清空正文并明确反馈，不能靠恢复快照继续读取。

#### Scenario: Expand descendants and select independently
- **WHEN** 创始人或管理者展开直接下属、再展开其下属
- **THEN** 目录 SHALL 显示真实父子关系及所有合法层级，展开不自动进入人员，点击人员先进入其资料卡，再选择日程或日志

#### Scenario: Read a person's schedule on a small screen
- **WHEN** 在320/390/1440宽度切换日期查看所选下属日程
- **THEN** 月历及日视图时间轴/清单 SHALL 无横溢遮挡，午夜截止无次日副本，零时长可识别，只有此人负责且有权任务展示

#### Scenario: Read logs and return from details
- **WHEN** 切日志页签、加载更多并打开日志或任务详情后返回
- **THEN** 工作页 SHALL 保留人员/日期/页签，长内容可读，全部日志可达，本人日志/日历范围不变化

#### Scenario: Revalidate access and session
- **WHEN** 当前人无下属、选择无权人员、组织权限变化或快速换人/换账号
- **THEN** 系统 SHALL 显示合适空态或失权反馈，拒绝跨组织/同级越权，清空失权内容，丢弃旧响应并允许合法重试

#### Scenario: Keep the subordinate canvas non-draggable and details normally authorized
- **WHEN** 用户查看下属月历、日轴、全天区或清单，然后进入其任务详情
- **THEN** 下属页面 SHALL 无拖动/端点/独立调时及任务表单入口，鼠标/触摸/键盘不触发调时；下属路径详情及嵌套详情仅允许评论，不显示或触发其他写操作，即使查看者同时是创建者/负责人亦然；返回保留人员/日期/页签

#### Scenario: Show organization alongside position
- **WHEN** 树中人员同时有职位、部门和团队，或固定创始人无部门
- **THEN** 每个节点 SHALL 保留姓名、职级/职位及真实组织信息，公司层有清楚占位，不用职位覆盖部门/团队，不显示原始空值

#### Scenario: Return through nested subordinate details
- **WHEN** 用户从人员资料卡进入特定日期的月历清单或日轴，再开任务、关联任务或日志并发表评论，随后逐层返回/关闭
- **THEN** 系统 SHALL 恢复同一人员、页签、模式、日期、日轴方向、已加载位置、滚动和焦点，不退回我的或更改本人日历/日志；全链路仅评论可写，旧草稿和残留按钮不能触发业务写请求

#### Scenario: Keep overlapping identities read-only in subordinate context
- **WHEN** 下属任务同时由当前查看者创建或负责，该查看者经下属路径及其嵌套详情操作
- **THEN** 该路径 SHALL 仅能评论且无其他编辑性操作；从独立本人正常入口重新打开时按当前字段及专用权限办理，直接越权请求仍被服务端拒绝

### Requirement: Subordinate calendar month and day views
所选人员日程 SHALL 参考本人日历设计并适配人员工作页，默认月视图，可切日视图。月历 SHALL 周一至周日排列，按占用公司日期绘制连续日级任务条，不按小时缩窄或偏移首尾，午夜截止不多占次日，零时长可辨；溢出及日期/任务条普通点击按本人月历体验进入完整当日清单，清单提供日视图入口。日视图 SHALL 提供00:00至24:00真实时段时间轴、重叠分栏、独立全天区及可切换任务清单。前后按月或天导航，可跳转日期和回今天；界面无单独周模式。

日程 SHALL 按公司日期读取所选人员当前负责且查看者有权的正常已发布任务，完整分页后投影；跨月、跨周、午夜、零时长正确且全部任务可达。月历、日轴、全天区和清单 SHALL 均能辨识完成状态。已发布任务进入任意后续审核 SHALL 显示虚线外框和待审提示，排期有变化时仅在提议位置出现；普通详情/提醒仍使用有效数据。任务详情返回 SHALL 保留人员、模式及日期，不改变本人页面状态；页面不提供拖动，详情按下属浏览上下文仅允许评论。

#### Scenario: Navigate months days and overflow
- **WHEN** 用户切换月/日模式、跨年翻月、选择日期、点击任务条或点击+N
- **THEN** 月历 SHALL 展示完整月份网格，跨日/跨周任务连续可辨，溢出和普通月格点击进入当日完整清单，清单可进入日视图，日轴重叠分栏且午夜无多余副本；返回详情保留模式、日期和人员

#### Scenario: Distinguish completed and pending tasks in every presentation
- **WHEN** 所选下属有已完成、未完成及后续审核中的已发布任务，用户切换月历、日轴、全天区和清单
- **THEN** 完成状态 SHALL 在所有呈现可辨；待审任务虚线显示，有新排期则只绘制提议位置，刷新后保持，待审结束后按有效排期恢复；显示不生成下属页面调时入口

#### Scenario: Reuse personal calendar browsing without changing its owner
- **WHEN** 用户从下属资料卡进入日程，在月格日期数字、任务条、空白和+N打开日期清单，再进入日视图/详情并返回
- **THEN** 系统 SHALL 按实际点击日期展示所选人员的完整授权任务，复用本人月/日浏览体验但无拖动及其他编辑操作；返回保留人员/日期/模式/滚动，不改本人范围

### Requirement: Consistent log reading typography
本人日志列表及日志详情正文 SHALL 与下属日志正文使用一致的15px字号和1.55行高，在320/390及桌面宽度可读、可换行且无横溢。正文不因卡片和详情容器不同退回旧字号；编辑输入、评论及元信息保留各自用途。

#### Scenario: Read self and subordinate logs
- **WHEN** 用户从本人或下属入口阅读日志并打开详情
- **THEN** 正文 SHALL 具有一致阅读字号与行高，无截断或横溢，详情阅读全文及评论行为保持

### Requirement: Calendar dragging by presentation
拖动 SHALL 仅在本人月/日视图对正常可见、已发布、未完成、非待审且有现有仅排期权限的任务提供。本人视图仍仅展示当前有效负责人任务；任务表单及下属日程 SHALL 不提供整条或端点拖动，也不提供画布上的独立调时按钮，但可进入鉴权任务详情；独立正常入口按字段权限办理，下属浏览路径仅允许评论。历史通知的受限只读详情不得因此取得操作权。

本人月历 SHALL 按公司日期以一天为步长：整条平移保留原日内起止时刻和工期；真实开始/截止端点分别按天调整对应日期、保留该端日内时刻与另一端不变，允许改变工期。跨周/月续接段不冒充真实端点，但可整体平移完整任务；按抓取日期和目标日期计算差量，不把续接片段误当原始开始。

本人横向/纵向日轴 SHALL 仅对完整起止区间位于当前公司业务日内且非全天/整日覆盖的普通定时任务提供拖动，以一小时相对差量保留原分钟，整条平移保持工期、端点保持另一端不变；当日零时长任务真实两端可分别命中。历史全天、全天区、整日覆盖和跨日任务首尾/中间截取片段 SHALL 均不提供整条、端点及键盘调时，从独立正常详情精确调整；只读下属详情不提供调整。午夜截止可为普通当日任务真实终点，不生成次日副本。

拖动 SHALL 实时显示完整起止日期时刻，松开进入轻量仅排期确认，主体只展示原排期、提议排期、原因和提交，不进入完整任务表单；审核仍按实际操作者直属上级，固定创始人按原规则免审。月历键盘按天、日轴键盘按小时。取消、Esc、pointercancel、失去捕获、逆序或无位移 SHALL 不写入、不误开详情/日期清单，正常触摸滚动继续可用。提交 SHALL 重验权限、冻结、完成、期限、版本与幂等，未提交前保留有效位置。

#### Scenario: Move an entire month bar by dates
- **WHEN** 用户在本人月历将任务整条移动两个公司日期，包括跨周/月/年或抓取续接片段
- **THEN** 起止日期 SHALL 同步平移两天，日内时刻及工期保持；预览完整排期，确认后按原原因/审核流程提交，不能按小时抖动或误重设片段开始日

#### Scenario: Resize a month endpoint by days
- **WHEN** 用户拖动本人月历真实开始或截止端点一天，或用对应方向键调整
- **THEN** 该端日期 SHALL 改变一天且保留原日内时刻，另一端不变，工期相应变化；逆序拒绝，跨月/年与午夜正确

#### Scenario: Adjust day events and the all-day section by hours
- **WHEN** 用户在本人横向/纵向日视图操作普通定时、零时长、历史全天或完整覆盖当天的定时任务
- **THEN** 普通日内任务及当日零时长任务 SHALL 可用指针或键盘按小时调整并确认保存，分钟保持；全天/整日覆盖及跨日截取片段无拖动和键盘调时，可从独立正常详情精确调整，全天仍不重复进时间轴

#### Scenario: Separate canvas interactions from task-detail permissions
- **WHEN** 同一任务从本人视图、任务表单或下属页面展示并进入详情
- **THEN** 只有本人月/日视图 SHALL 提供拖动；另外两种入口不触发拖动，独立正常详情按字段权限办理，下属路径详情仅允许评论，不因可见扩大基础字段或审核权限

#### Scenario: Preserve cancellation and stale-version boundaries
- **WHEN** 拖动取消、离屏释放、失去捕获、逆序，或任务失权/完成/待审/版本变化
- **THEN** 操作 SHALL 安全取消或明确拒绝，原业务数据不被覆盖；正常点击和滚动可用，旧页面不能通过重放写入

#### Scenario: Prevent dragging any clipped cross-day segment
- **WHEN** 一个任务从周二20:00到周四10:00，在横向及纵向日视图分别呈现周二首段、周三整日、周四尾段
- **THEN** 三段 SHALL 均无整条/端点拖动和键盘调时，点击仍可读详情，不修改完整任务；本人独立正常详情可按原资格精确编辑，月历按天拖动规则保持

#### Scenario: Confirm a monthly drop in a lightweight sheet
- **WHEN** 用户按天移动月历任务或真实端点后松手
- **THEN** 系统 SHALL 只打开含旧/新完整排期、原因和提交的轻量确认，不出现完整信息表单；未提交不写入，取消恢复原位置，成功按实际审核结果刷新待审投影或有效排期

#### Scenario: Preserve the lightweight draft on failure
- **WHEN** 排期确认遇到网络失败、版本变化、失权、完成或冻结
- **THEN** 系统 SHALL 保留可用草稿并明确拒绝/重试，不能把旧差量自动套到最新版本或部分保存；同一提交重试不得重复建申请

### Requirement: Pending review calendar projection
已发布任务进入任意后续审核 SHALL 显示虚线外包围线、淡底及可辨审核提示，并保留标签颜色。若申请包含新排期，本人和授权下属日程 SHALL 只在提议位置显示一次，按投影排期查询日期范围并同步框体及文字；无排期变化则在有效位置虚线显示。月历按日级跨度绘制，日轴按真实时段绘制。实际有效排期、提醒、任务详情、表单和其他业务权限 SHALL 不提前改变；未发布创建申请不进入日程。

待审期间 SHALL 冻结原有任务业务修改和拖动，独立评论仍依原权限。提交成功后刷新/重新登录保持提议位置；通过后按新有效排期显示实线，驳回/撤回/失效后恢复仍有效排期。固定创始人合法免审 SHALL 直接显示新有效实线，不伪造待审阶段。

#### Scenario: Move a task while waiting for approval
- **WHEN** 已发布任务通过拖动或详情提交新排期且需要他人审核
- **THEN** 本人/下属日程 SHALL 在提议位置显示唯一虚线任务，原位置无副本，框体/文字一致，刷新重登保持；普通详情/表单/提醒仍有效版且待审不可再次拖动

#### Scenario: Any subsequent review and its resolution
- **WHEN** 已发布任务提交修改、进展、完成、重开或交接申请，随后通过、驳回、撤回或失效
- **THEN** 日程 SHALL 在待审期间显示虚线及审核提示，没有新排期时位置不变；终态按仍有效或新有效排期恢复实线，跨日跨月、下属范围、标签颜色与完成状态正确

#### Scenario: Keep unpublished tasks out and apply founder changes directly
- **WHEN** 创建申请尚未发布，或固定创始人合法免审调整已发布任务
- **THEN** 前者 SHALL 不进入正常日程，后者直接显示新有效实线；不能为展示虚线而制造未发布任务或自审待办

### Requirement: Reschedule every visible active task
拥有正常查看权的已发布、未完成、非待审任务 SHALL 继续允许提交既有仅排期修改，无论是否创建人、当前业务责任方或负责人。服务端仅排期资格 SHALL 与页面是否提供拖动分开；不能因为本人视图仅列负责人任务而将接口收紧为仅负责人。基础资料及进展 SHALL 按本次字段权限办理，普通查看权不授予基础编辑；负责人列表仅创建者在任/正式接管人可改，执行状态仍走专用流程。

独立正常任务详情 SHALL 通过统一编辑入口提供精确排期，有更多字段权限时同表单展示；下属入口及嵌套详情仅允许评论，不提供排期编辑。审核仍按实际操作者直属上级，创始人按原规则免审；生效前重验正常可见性及仅排期差异，版本/冻结/完成限制保持。历史通知只读例外不是正常查看权，不能用于提交。

#### Scenario: Propose a schedule from an authorized detail without editing other fields
- **WHEN** 用户能正常查看有效任务但不能编辑其资料，从表单等独立正常入口进入任务详情，并按既有仅排期权限提交
- **THEN** SHALL 可提交日期/时刻与原因，待审新位置虚线显示；页面本身无拖动，夹带资料/负责人/标签、失权/完成/冻结/旧版本或仅有历史只读权的请求拒绝

#### Scenario: Separate normal rescheduling from subordinate browsing
- **WHEN** 同一有正常查看权者分别从独立正常入口和下属工作浏览打开任务
- **THEN** 独立正常入口 SHALL 依当前资格保留精确排期编辑，下属路径仅允许评论，不发起排期或其他业务写入；仅排期接口不接受越权资料及负责人变更

### Requirement: Day-scale bars in the month calendar
本人及下属月历 SHALL 按公司日期中任务实际占用的日期绘制日级任务条，不按日内小时缩窄或偏移。例如09:00—12:00占当天一个日期格，跨日任务连续覆盖占用日期；截止恰好00:00不多占截止日，零时长在所属日明确标识且不改变真实工期。具体起止时刻可从日视图或详情查看，日级绘图不得改写业务排期、全天属性、提醒或有效版本。

月历标题及显示的日期信息 SHALL 位于日级框内，窄屏可裁切并提供完整提示与详情；跨周/月续接可辨、溢出数量及完整日清单正确。本人框体/真实边缘提供按天操作，下属同样绘图但不提供拖动。日视图仍按真实时段展示，不因共用月历算法扩大成全天。

#### Scenario: Draw short tasks and midnight endings by dates
- **WHEN** 本人或下属月历展示09:00—12:00、跨日且午夜截止、跨周任务及零时长任务
- **THEN** 短任务 SHALL 占当天日格而非3/24宽，跨日覆盖正确且午夜无次日副本，点任务工期仍为零；320/390/桌面标题可达，详情及日轴保留精确时刻

### Requirement: Write requests work on ordinary HTTP origins
公共写入入口 SHALL 在普通HTTP页面没有crypto.randomUUID时仍能使用安全随机请求标识提交。支持原生randomUUID的页面保持兼容；随机标识必须符合服务端幂等键要求，不改变权限/审核/ETag或请求载荷。

#### Scenario: Submit and retry from a non-localhost HTTP page
- **WHEN** 用户通过HTTP IP或域名提交排期，原生randomUUID不可用，且首次请求已提交但响应丢失
- **THEN** SHALL 正常生成标识并发送，同一内容重试复用标识且只产生一笔申请；修改内容或新操作生成新标识，不丢失失败后的表单

### Requirement: Pending frame and caption use the proposed time together
任务排期调整提交后的虚线框 SHALL 使用提议起止确定展示位置和跨度，标题及日期/时刻信息位于框内并随框移动；月历采用日级框，日轴采用真实时段框，不残留旧框或框外独立标题。本人及下属日程画布 SHALL 不显示独立“调时、起、止”按钮；仅本人视图的合法任务提供框体平移及透明边缘操作，普通详情保留现有精确排期操作。

#### Scenario: Review a rescheduled task at its proposed position
- **WHEN** 跨日/月任务提交新排期并待审，随后刷新或切换本人/下属视图
- **THEN** 框体与文字 SHALL 一致取提议排期，月历按日期跨度、日轴按实际时段，不显示旧位置或外部标题；待审不提供拖动，下属无论是否待审均无画布调时，通过/驳回/撤回后按有效排期恢复

### Requirement: Distinct log creation and editing interfaces
创建和编辑日志 SHALL 使用分别组织的界面及独立操作模式，不能仅替换标题并禁用创建控件来充当编辑界面。“写日志” SHALL 只列公司今天、昨天、前天尚未创建且可创建的日期；已有记录从显式日志标识的编辑入口进入，编辑界面 SHALL 以不可修改的日期展示字段呈现原业务日期，不显示创建日期候选、补写或新建入口。

创建与编辑界面 SHALL 分别提供当前操作所需的标签、正文、可选关联任务及保存/返回/关闭，日期与标签保留统一标题、间距及对齐：桌面同排对齐，窄屏同列边缘对齐，日期展示字段与标签控件视觉对齐，不出现冗余禁用日期下拉框。全屏正文、滚动、焦点和嵌套关联任务选择返回 SHALL 可用；两种模式的草稿及提交目标不串用。

编辑 SHALL 只修改显式目标日志的允许字段，业务日期和真实首次创建时间不可改，成功编辑不重置首次24小时冻结。服务端作者、唯一性、冻结、版本及关联任务权限 SHALL 保持原规则；不能通过界面分离获得他人正文编辑权。失败/重复创建/过期或版本冲突 SHALL 保留当前操作的草稿并明确反馈，不自动切换创建与编辑、不覆盖别人的记录。删除重建继续沿用原冻结约束。

#### Scenario: Create only a missing recent log
- **WHEN** 今天已有日志、昨天和前天缺失，作者点击写日志
- **THEN** 创建界面 SHALL 只提供缺失可创建日期及创建所需内容，不进入已有日志编辑；三天都已写时提示从详情编辑，不打开伪创建/编辑混合界面

#### Scenario: Edit one explicit record without creation controls
- **WHEN** 作者从未冻结日志的编辑入口进入
- **THEN** 编辑界面 SHALL 展示该日志内容及只读业务日期，不出现近三天候选、日期切换/补写/新建控件；保存只更新该记录允许字段，日期和首次冻结时刻不变

#### Scenario: Preserve the draft through nested navigation and failed saves
- **WHEN** 创建或编辑时选择/清除关联任务后返回，或提交遇到重复日期、冻结、版本冲突或网络失败
- **THEN** 当前界面 SHALL 保留自己的日期、标签、正文及关联草稿，明确可执行反馈，不能把创建冲突转成编辑或把编辑保存成新日志；关联失权按原安全规则处理

#### Scenario: Align both interfaces and keep the personal page intact
- **WHEN** 在320、390和1440宽度分别创建、编辑日志，再进入卡片详情或人员日志后返回
- **THEN** 日期与标签 SHALL 按屏宽对齐、无截断横溢，正文和保存返回可达；本人日志列表、计数、直接点击详情、嵌套按钮和人员阅读隔离保持原规则

#### Scenario: Reject editing another author or an expired record
- **WHEN** 上级尝试编辑下属日志正文，或作者通过旧页面/直接请求修改已冻结记录
- **THEN** 系统 SHALL 拒绝并保留合法阅读/独立评论能力；不能借日志界面分离重置24小时窗口或绕过权限

### Requirement: Production interface copy without redundant implementation explanations
员工 Web 五个主页面、二级页/弹层、登录与账号流程及独立 PC 管理端的当前可达界面 SHALL 使用简洁、面向操作的正式文案。冗余业务规则长说明、原型/演示开发解释和内部技术标识 SHALL 移除或改写，不向用户描述组件复用、接口字段、实现限制或未交付工作的开发过程。不得仅按关键词批量删除所有说明。

标签选择区 SHALL 不再显示“标签由创始人统一维护，日志最多选择一个，任务支持多选；删除的标签不能再用于新的关联。”及相同用途的长说明；日志表单 SHALL 不再重复展示本人归属、上级只读及仅作者可编辑的规则段落。实际选择能力、标签状态和维护权限 SHALL 继续由控件/状态与服务端规则表达，不删除标签颜色或已删除标记。

必要字段名称、空态、校验错误、失败重试、破坏性操作确认，以及帮助用户判断的待审、冻结、只读、失权和审核结果 SHALL 保留并简洁呈现。分析页仍 SHALL 按原要求表达真实统计范围、生成时间及用户能理解的方法/来源，不展示原始方法代码，不删除 AI 地图功能或伪装外部模型能力。

本要求 SHALL 只改变产品静态文案/安全显示表达，不删除或改写任务、日志、评论、审核原因、历史及其他真实业务内容，不修改权限或业务规则。代码注释、历史迁移、规划和审计原文不作为可见文案批量清理对象。

日志详情 SHALL 不再显示“编辑权限”资料行，以可用编辑按钮及必要的简短冻结/只读状态表达，不以冗长权限说明替代。人员公司行、内部业务责任概念及固定审核人展示 SHALL 按本增量各自要求移除；文案清理本身不得删除其底层业务关系和权限裁决。

#### Scenario: Choose a tag and edit a log without rule paragraphs
- **WHEN** 创始人或普通员工打开任务/日志标签选择和日志创建/编辑界面
- **THEN** 页面 SHALL 无指定标签长说明及重复日志归属规则段落，选择/清除、权限、已删除标记和保存反馈仍正确，日程任务颜色保留

#### Scenario: Review reachable employee and administrator flows
- **WHEN** 用户访问员工五页及其可达二级/账号流程，管理员访问PC管理端业务维护流程
- **THEN** 可见静态文案 SHALL 无原型/开发解释或原始内部技术标识，必要标签、空态、验证及确认可用；不能只清理首页而遗漏弹层/错误状态

#### Scenario: Keep useful state explanations and analysis provenance
- **WHEN** 用户看到待审/冻结/历史只读/失权内容或查看分析页
- **THEN** 界面 SHALL 保留必要原因和操作结果，真实范围/生成时间/可理解的方法信息可读，原始方法代码不可见；不能因清理说明而隐藏状态或夸大分析能力

#### Scenario: Preserve user-authored and historical content
- **WHEN** 真实业务正文或审核意见包含“标签”“原型”或其他与清理关键词相同的词
- **THEN** 内容 SHALL 原样保留，静态说明清理不能过滤用户输入、删除历史或改变对象权限

#### Scenario: Remove the redundant log permission row
- **WHEN** 本人查看可编辑/冻结日志或上级查看他人日志
- **THEN** 详情 SHALL 无编辑权限行，可编辑作者有编辑入口，冻结有必要状态，越权者无正文/标签写入口；评论按独立权限保持

#### Scenario: Audit reachable copy while retaining concise provenance
- **WHEN** 用户访问员工五页、通知、申请、表单、个人/下属资料、账号和PC管理端当前可达二级界面
- **THEN** 静态开发解释和冗长规则 SHALL 被移除或简化，必要校验、状态、操作结果及简短统计范围/来源/生成时间保留；任务、日志、评论和审核意见原文不按关键词过滤

### Requirement: Personal calendar pin eligibility
个人置顶 SHALL 仅在任务属于本人正常日历范围时可操作：本人是当前有效负责人、任务正常已发布且有正常查看权，包含已完成任务。仅创建、仅组织可见、未发布、历史通知只读及下属只读浏览 SHALL 不显示“置顶到我的月视图”或取消置顶按钮，也不得通过残留动作写入。服务端 SHALL 重验当前日历资格，置顶仅改变本人排序，不改紧急程度、排期或他人顺序。

#### Scenario: Hide pins for tasks outside the personal calendar
- **WHEN** 用户打开仅创建/仅下属可见任务或历史只读任务，再打开本人有效负责任务
- **THEN** 前者 SHALL 无置顶入口且旧写请求拒绝，后者可在独立正常入口按本人排序置顶；下属浏览即使重叠本人负责人也无置顶操作

### Requirement: Stable shared tag color across task presentations
任务所有正常呈现 SHALL 使用相同取色顺序：稳定有序共用标签的第一项颜色，无有效或合法保留标签时默认粉色。已删除但合法保留的首项 SHALL 沿用保留颜色及状态，不跳到另一个标签、不依目录排序改变；任务详情 SHALL 展示全部共用标签及相应状态。颜色不能是关系和状态的唯一表达，不重排任务时间。

#### Scenario: Preserve ordered color with multiple tags and private overrides
- **WHEN** 多标签任务的目录排序改变、首项改色/逻辑删除，或旧私人颜色覆盖已被移除，用户切换月/日、任务清单和详情
- **THEN** 各呈现 SHALL 取相同优先级的颜色，首标签顺序稳定，合法删除快照保留，无私人覆盖参与取色，详情显示全部共用标签，同一任务不因用户私人设置改变共用底色

### Requirement: Company shared tags without private overrides
系统 SHALL 统一移除私人标签及私人颜色覆盖，包括私人标签管理/选择入口、创建与维护能力、任务个人标签写入接口、响应中的私人标签及覆盖字段、私人目录和覆盖数据模型。标签维护 SHALL 仅固定创始人管理本公司共用目录；任务、日志按各自对象权限选择共用标签。系统不得为未交付旧版本保留私人能力兼容入口。

升级 SHALL 保留公司共用标签、任务/日志有序共用引用及已删除快照、业务正文、创建来源、排期、冻结、审计和个人置顶，移除私人目录项及个人任务覆盖；不得把私人项转换为公司公开标签。若发现私人项被异常引用到共用业务关系，升级 SHALL 明确报告并阻断该清理，不自动公开或静默丢弃共用引用。旧已应用迁移不得改写，空库及升级库 SHALL 达到同一仅共用目录结构。

#### Scenario: Remove private capabilities from every active interface
- **WHEN** 创始人或普通员工打开标签管理、任务/日志详情和日程，或直接提交私人标签/颜色覆盖请求
- **THEN** 系统 SHALL 无私人入口、私人DTO字段或可用私人写操作，仅能按权限使用公司共用标签；所有任务颜色使用共用首项或默认粉色，个人置顶排序仍有效

#### Scenario: Upgrade private data without publishing it
- **WHEN** 含私人标签和任务颜色覆盖的现有数据库升级，或空库执行完整迁移
- **THEN** 最终 SHALL 仅有公司共用目录及对象共用引用，个人目录/覆盖移除，共用快照、正文、排期、冻结、审计及个人置顶保留；异常私人共用引用明确阻断，不把私人内容转公开
