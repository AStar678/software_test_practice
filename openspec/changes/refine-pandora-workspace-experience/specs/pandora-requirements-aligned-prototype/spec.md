# Spec Delta

## ADDED Requirements

### Requirement: Vertical continuous daily-item calendar
每日事项 SHALL 复用公司月视图的全部通用样式，包括年月、星期表头、七列日期网格、日期状态、间距、色彩和密度控件。内容为本人每日事项数量标记和清单。上下连续浏览月份，补载保持日期锚点；初次进入和刷新定位公司今天，提供前后月、跳转和回今天。首页月历浏览与公司月历独立。

#### Scenario: Browse across months without activating a date
- **WHEN** 用户从十二月连续滚入次年一月再返回，或在窄屏点击日期、使用键盘、切页再回来
- **THEN** 月历 SHALL 与公司月视图具有相同视觉布局，各真实日期只有一个所属月的可操作格，按正确星期对齐；滚动不打开弹窗，点击才打开当天事项清单，返回恢复日期和位置

#### Scenario: Retry loading an adjacent month
- **WHEN** 相邻月份加载失败、重试成功或窗口尺寸变化
- **THEN** 原位置和已加载计数 SHALL 保留，失败月份明确可重试，成功后无遗漏或重复日期，支持继续双向浏览

### Requirement: Public holiday and adjusted workday calendar
公司日程与首页每日事项 SHALL 从共用接口按年读取节假日和补班数据，按国务院公布的年度安排显示节日名称、“休”和“班”。已公布的具体日期覆盖普通工作周标记，未知年份不推算放假或补班。公司月格、日视图及每日事项月格按公司业务日期一致呈现，标记可读且只提供日历信息。

#### Scenario: Show an official holiday and a makeup workday
- **WHEN** 查看同一节日的休假工作日、调休周末及普通周末，或跨年进入尚无公告数据的年份
- **THEN** 公告休假 SHALL 显示休，公告补班 SHALL 显示班，普通周末和未知年份保持常规日历；日期不随设备时区漂移，任务仍可按原规则排期，每日事项数量及当日清单继续可用

#### Scenario: Retrieve holiday data and handle provider downtime
- **WHEN** 用户打开或跨年浏览日历，且接口返回年度数据、未发布状态或暂时不可用
- **THEN** 两处日历 SHALL 异步显示接口返回的日期标记。故障时沿用已有成功结果，缺少可用数据时日历仍可浏览和操作。年份数据更新无需改动前端日期表

#### Scenario: Synchronize a newly published or revised notice
- **WHEN** 跟踪国务院公告的上游发布当年或次年的新安排或修订，期间没有用户请求该年节假日接口
- **THEN** 服务运行期间 SHALL 定时发现并同步变动，按日期显示新增、变更和移除的放假及补班标记，次年公告覆盖当年十二月的日期按实际日期归入当年。已打开的日历定期更新，保留所在月份、滚动位置和焦点

### Requirement: Employment duration and start date
首页 SHALL 按公司业务日期显示本人入职天数。以登记入职日为第 1 天，后续按公历自然日计算，未登记显示“未登记”，未来入职显示“尚未入职”。授权员工资料 SHALL 显示登记入职日期与按同一规则计算的天数，入职日期由有权管理员维护。

#### Scenario: Read tenure from the official start date
- **WHEN** 本人在入职当天及次日查看首页，或授权上级查看跨闰日入职的员工资料
- **THEN** 天数 SHALL 分别按第 1 天、第 2 天和实际自然日计算；缺失值不从建号日期猜测，刷新后与管理端登记一致

### Requirement: Automatic references for cross-day schedule entries
跨日任务 SHALL 是作者正常有权读取且当前有效负责、已发布并实际占用至少两个公司业务日期的任务。日志关联按有效排期与所属日的相交判断，以任务标识去重。关联在新建提交时确定，按读取者当前对象权限裁剪。

#### Scenario: Apply interval boundaries and permission checks
- **WHEN** 任务跨数日、恰在所选日零点截止、尚未发布、只存在排期提案、同日开始结束或属于他人且本人不负责
- **THEN** 只有有效排期确实覆盖所选日且符合条件的跨日任务 SHALL 关联，截止零点不占次日，提议时间不代替有效时间；失权后隐藏关联对象，日志正文仍按原权限展示

### Requirement: Log previews show their business date
日志卡片、列表预览及相对日期文案 SHALL 使用日志所属公司业务日期。所属日期只显示公历日期或对应相对日期；真实创建时间继续用于冻结判定及明确标为创建时间的展示。

#### Scenario: Preview a backfilled log
- **WHEN** 用户今天补写昨天的日志，并分别从本人或授权员工日志月历查看
- **THEN** 预览 SHALL 显示昨天的所属日期，冻结仍从实际首次创建时间计算，设备时区不改变所属日期

### Requirement: Continuous employee log month browsing
员工工作页的日志页签 SHALL 使用纵向连续月历，按所属业务日期展示授权日志，默认公司今天所在月，向前后补载并支持年月跳转及回今天。打开日志后返回 SHALL 恢复人员、页签、日期锚点、位置及焦点。

#### Scenario: Load multiple months with isolated access
- **WHEN** 上级跨年滚动员工日志，打开补写日志后返回，随后切换员工或失去查看权限
- **THEN** 授权月份 SHALL 可连续浏览，失败范围可重试，空日期与加载失败可区分；切人、失权或换账号清理旧范围并丢弃旧响应

## MODIFIED Requirements

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
- **WHEN** 用户纵向浏览每日事项后切到公司页，再返回首页，或业务正文包含“工作台”“日程”
- **THEN** 两处日期与滚动状态 SHALL 各自恢复，公司页月历仍上下连续浏览，业务正文原样保留

### Requirement: Three-section home dashboard
首页 SHALL 保留事件纪、任务看板、每日事项三个内容模块，并在顶部日期区显示本人入职天数；事件纪位于原公司事项位置的上方左侧，任务看板位于原我的待办位置的上方右侧，每日事项通栏位于两者下方。首页 SHALL 移除个人日志展示及其原卡片和空白占位，不删除日志记录或日志页功能。上方两个模块内容超出时 SHALL 独立纵向滚动；每日事项 SHALL 在自己的日历区域纵向连续滚动，浏览时保持其他模块各自的滚动位置。上方两个模块的内容区 SHALL 各至少容纳三条普通单行条目，不计标题、提示或被裁切的半条条目，以三至四条的高度为视觉目标；长条目自然换行并在模块内部滚动。每日事项 SHALL 不通过压缩上方内容到不足三行来获得高度。紧凑屏幕 SHALL 保证完整月历、标题栏加号及导航可达，必要的页面纵向滚动不得截断内容，不以缩小日期交互目标代替空间分配。

事件纪 SHALL 展示公司发布的信息，点击条目打开只读二级详情弹窗，显示完整标题、正文及实际发布时间，提供同层阅读其他公告的入口；公司信息最多十条、按管理端设置顺序只读展示，包括上层无员工端维护入口，管理员的新增、修改、删除及调序规则保持。

任务看板 SHALL 展示本人当前为有效负责人、已正常发布且未完成的任务，不考虑创建者是谁，包含本人创建并负责的任务；仅创建而非当前负责、负责人已移除、已完成、待创建/未发布及仅有历史通知只读访问的任务 SHALL 排除。结果 SHALL 按实际派发给本人的时间倒序、同时间按任务标识升序稳定取最多十项，不按创建时间、紧急程度或截止排序；每任务只出现一次。条目 SHALL 只显示标题和右对齐紧急程度，点击以二级弹窗打开原鉴权任务详情，显示完整说明、状态、负责人、排期、进展以及已有的本人派发时间和最近更新时间。长标题、窄屏及滚动条 SHALL 不遮挡紧急程度。

首页日期区域 SHALL 不恢复重复的“新建任务”按钮或其占位；公司页原任务创建加号保持，每日事项加号只创建每日事项。每日事项 SHALL 由下述独立要求约束，替代原个人信息列表及十条上限。

#### Scenario: Render three modules in their intended positions
- **WHEN** 用户进入首页
- **THEN** 事件纪和任务看板 SHALL 保留原左右位置，每日事项位于下半部分并横跨两列，无个人日志卡片或旧第四模块占位

#### Scenario: Scroll home modules independently
- **WHEN** 上方列表较长或用户上下连续滑动每日事项
- **THEN** 上方列表 SHALL 分别纵向滚动，每日事项在自身区域纵向浏览月份，导航和其他模块保留各自位置，紧凑屏幕全部内容可达

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
- **THEN** 两张上方卡片的内容区 SHALL 各至少完整容纳三条条目，标题不计入条目数，超出部分可独立滚动；短屏可纵向滚动页面以访问每日事项完整月历及导航

#### Scenario: Keep the daily header compact
- **WHEN** 用户查看每日事项标题和日历
- **THEN** 标题及其右侧新增按钮与月份工具 SHALL 在同一标题行，标题下无重复年月副标题，卡片右下无悬浮新增按钮及其专用空白区

#### Scenario: Open and return from home details
- **WHEN** 用户滑动事件纪或任务看板，再点击其中一条并返回
- **THEN** 滑动 SHALL 只滚动相应卡片，点击打开可滚动的完整详情；关闭 SHALL 恢复卡片滚动位置和触发焦点，任务详情仍重验权限

### Requirement: Independent personal daily items
每日事项 SHALL 仅属于创建它的本人，以一个公历日期、一段非空纯文本及完成状态保存；默认未完成，支持完成和取消完成。业务详情 SHALL 只展示日期、完整文本、完成状态控件及编辑/删除/返回等必要操作，不增加标题、时刻、负责人、紧急程度、标签、提醒、审批、关联任务、评论或日志字段。正文 SHALL 保留换行，以纯文本安全呈现，去除首尾空白后限 1–2000 字符。

本人 SHALL 可为过去、今天或未来的合法日期创建多条事项，可编辑日期和正文、删除指定事项，不受原个人事项总共十条、每天一条或日志补写/冻结窗口限制。日期 SHALL 使用明确的公历日期，不因设备时区与公司时区不同而漂移；默认今天以公司业务日期为准。

事项 SHALL 与任务独立；日志只可从作者侧引用本人对应日期事项，事项侧无反向入口，维护和完成事项不得创建任务、审核申请、任务通知、日志或改变其状态、计数和排期。任何其他员工、上级及独立管理员 SHALL 不因组织管理权读取或维护他人每日事项；列表、日期计数、详情及写入均须执行本人及同组织限制。用户已确认无旧非生产个人事项保留要求，切换后 SHALL 不展示无日期旧事项，不为它们自动生成任务或日志。

#### Scenario: Create more than ten independent items
- **WHEN** 本人累计或同一天已有十条每日事项，再创建第十一条
- **THEN** 合法输入 SHALL 保存成功且可重新读取，任务和已保存的日志关联不变，不触发旧个人事项十条上限或日志日期规则

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

### Requirement: Daily-item lists details and reliable editing
点击任一天 SHALL 打开该日期事项清单弹层，显示日期、当天全部事项的可分页/滚动列表、完成控件、必要新增及关闭操作；无事项 SHALL 显示空态并可按该日新增。清单 SHALL 同时保留完成及未完成事项，按创建时间升序、同值按事项标识稳定排序，切换完成状态不使条目跳位；行文本点击进入事项详情，完成控件不误触详情。

每日事项标题右侧的加号 SHALL 只打开每日事项创建界面，默认选中日期、尚无选中日期时用公司今天；日期可修改。加号 SHALL 与标题同一行，采用与年月/今天工具一致的圆角按钮形态，以有玻璃感的半透明薄荷绿填充及清晰高光/边框呈现，提供可读名称和可见键盘焦点；不得使用白色填充或继续悬浮在卡片右下方。标题栏入口 SHALL 在320宽窄屏仍可见可操作，不遮挡日期、导航或清单内容，日历底部不保留为旧悬浮按钮专用的空白区。表单 SHALL 仅要求日期和正文；详情可完成/取消完成、编辑日期/正文、经确认删除。所有操作 SHALL 使用真实事项标识。

详情返回 SHALL 恢复原日期清单及其滚动位置，清单关闭恢复原日历日期、纵向位置及触发焦点；支持按钮、返回/Esc及遮罩关闭且焦点不留在隐藏内容。事项移日后 SHALL 返回原日期清单并更新原日期与目标日期数量，不无提示跳到目标日。新增、编辑或完成失败 SHALL 保留草稿/原状态并提供重试，取消删除不写入。

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

### Requirement: Global task table sorting and counts
表单 SHALL 至少支持按名称、创建时间、开始、截止、紧急程度和执行状态的列头升降序排序并显示方向；默认开始升序，切换新列先升序，同列再次切换降序，同值始终按任务标识升序稳定排列。紧急程度升序 SHALL 为紧急/高/中/低，执行状态升序 SHALL 为待开始/进行中/已完成，本人在表单中置顶的匹配任务 SHALL 整体排在未置顶任务之前，两组分别应用相同的列排序；本人月历置顶状态独立。筛选和排序 SHALL 在整个结果集完成后再分页，每页默认 50 条，改变条件/排序回第一页。

表单 SHALL 移除负责、创建、仅可见、待完成审核、已完成、逾期等分类统计展示及仅为该展示进行的无用计算；分页 SHALL 保留完整组合筛选结果总项数、当前页码及翻页操作。总数 SHALL 按任务标识跨日/跨分页去重，不随页大小和排序改变；完成待审仍属未完成，逐行逾期标记仍按当前时刻超过真实有效截止且未完成判断，不因移除统计改变过滤或任务状态。

#### Scenario: Sort all filtered rows before paging
- **WHEN** 超过两页 API 的授权任务分布着不同开始时间、同名、不同紧急程度及状态，用户分别切换六列排序并翻表格页
- **THEN** 各页连起来 SHALL 等于完整筛选结果的全局排序，同值按任务标识稳定排序，方向可辨识，本人表单置顶优先且组内保持该排序，月历置顶 SHALL 不改变该序列

#### Scenario: Count overlapping relationships without duplicate totals
- **WHEN** 唯一筛选结果是一个跨日、本人创建且负责的任务
- **THEN** 分页总数 SHALL 为1，行可保留负责与创建关系标记，不显示各分类统计，不因关系重叠或跨日重复计数

#### Scenario: Recompute counts after all filters
- **WHEN** 用户叠加名称、关系、完成和日期条件，随后翻页或改排序
- **THEN** 分页总数 SHALL 基于完整去重结果，翻页和排序不改变总项数，不展示或单独计算已移除分类统计

#### Scenario: Separate pending completion done and overdue
- **WHEN** 结果中有完成待审、已完成过截止和全天未到/已过有效截止任务
- **THEN** 完成待审 SHALL 仍属未完成，已完成不显示逾期，全天逐行逾期依有效截止判断；分类计数栏不再展示

### Requirement: Personal task table and founder-only tag maintenance
任务表单 SHALL 仅显示本人原始创建或当前有效负责的授权任务，在搜索、计数和分页前排除仅可见的下属任务；不提供仅可见筛选。表单行 SHALL 支持置顶和取消置顶，按账号与组织持久保存；当前表单资格失效的任务不可再显示或写入其置顶。其他授权入口保持原范围。
公司共用标签目录创建、改名、改色、删除 SHALL 仅固定创始人可执行，服务端校验与canEdit一致；其他人员仅在任务/日志编辑中选择或清除。日程 SHALL 移除标签管理及图例行，任务只使用共用首项和默认颜色，全局移除私人标签及私人颜色覆盖。

#### Scenario: Inspect a manager's task table
- **WHEN** 上级同时可见本人创建、本人负责和仅下属负责的任务
- **THEN** 表单 SHALL 只保留前两类，搜索和总数不能恢复第三类

#### Scenario: Reject tag maintenance without removing task colors
- **WHEN** 普通员工通过界面或直接API维护共用标签或尝试创建已移除的私人标签
- **THEN** 系统 SHALL 拒绝维护，任务/日志编辑仍能选择清除；日程任务颜色保持，创始人在我的页面维护标签

#### Scenario: Pin a filtered task across pages
- **WHEN** 用户把后续页中一条本人仅创建或当前负责的任务置顶，再更改列排序、刷新或切换账号
- **THEN** 匹配的置顶任务 SHALL 排到其账号筛选结果最前，组内排序与总数正确；取消置顶恢复普通排序，其他用户与本人月历的置顶不受影响

### Requirement: Personal work logs
日志 SHALL 归作者并按公司业务日期同人同日唯一，新建允许公司今天、昨天、前天，不允许更早或未来；写日志 SHALL 只提供近三天尚未创建且可创建的日期，不提供独立补写按钮；已有日期不进入创建选择，三天均已有日志时提示从详情编辑。编辑 SHALL 通过显式日志标识进入，重复创建冲突不得自动转为编辑或覆盖原记录。日志创建后 SHALL 不改业务日期。冻结 SHALL 为真实首次创建时间加 24 小时，编辑不重置计时，服务端达到冻结点立即只读，跨零点不提前冻结。编辑和删除 SHALL 仅作者且共用该窗口，删除重建 SHALL 不重置首次创建时间或清除同人同日冻结约束。

前后端 SHALL 一致显示可编辑性、冻结时间和重复/到期反馈，旧页面到期提交及并发 SHALL 不绕过限制；存量日志保留真实创建时间，冻结和他人日志不显示正文编辑/删除。新建编辑 SHALL 保留全屏表单、伸展正文和可达保存/返回/关闭，离开恢复其他弹层布局。

新建日志 SHALL 按所选业务日期自动关联作者当日全部每日事项和符合覆盖规则的跨日任务。存量日志的已有关联任务继续可读，关联详情独立鉴权。创始人看公司、部门负责人看本人及本部门全部直接/间接下属、团队负责人看本人及本团队员工、普通员工看本人，上级不能编辑正文，同团队/同任务不授予日志权；关联任务失权 SHALL 裁剪跳转但保留有权正文。标签 SHALL 同受日志编辑冻结规则，独立评论按评论要求处理。

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
- **WHEN** 作者全屏写日志、切换日期查看关联预览、上级阅读或迁移存量数据
- **THEN** 正文和真实创建时间 SHALL 保留，无权关联不泄露信息，上级无正文写权，全屏及退出布局正常

#### Scenario: Write and edit a log in a full-screen sheet
- **WHEN** 作者全屏写日志、切换日期查看关联预览、上级阅读或迁移存量数据
- **THEN** 正文和真实创建时间 SHALL 保留，无权关联不泄露信息，上级无正文写权，全屏及退出布局正常

#### Scenario: Enforce one log under concurrent distinct keys
- **WHEN** 同人同日以不同幂等键并发新建，或窗口内删除重建后跨冻结点重试
- **THEN** 系统 SHALL 最多一篇活动日志且重复反馈明确，重建沿用首次创建时间，冻结后 SHALL 不能重建、编辑或删除绕过

#### Scenario: Freeze across the midnight boundary
- **WHEN** 昨晚创建日志跨零点但未满 24 小时，随后服务端到达冻结点
- **THEN** 作者前一时刻 SHALL 可编辑删除，到期立即只读且旧页面提交被拒，编辑 SHALL 不延后冻结

#### Scenario: Link, clear or redact tasks independently
- **WHEN** 作者全屏写日志、切换日期查看关联预览、上级阅读或迁移存量数据
- **THEN** 正文和真实创建时间 SHALL 保留，无权关联不泄露信息，上级无正文写权，全屏及退出布局正常

#### Scenario: Search and link a visible task
- **WHEN** 作者补写昨天，昨天有已完成和未完成的本人事项、跨日任务以及其他员工事项，并在表单中查看自动关联预览
- **THEN** 系统 SHALL 直接列出可关联项而无需按名称搜索，并在提交时保存昨天的全部本人事项引用和符合日期及权限的跨日任务引用，切换日期刷新预览，排除今天独有数据及他人事项

#### Scenario: Clear a linked task
- **WHEN** 作者编辑日志正文或关联事项被删除、移动日期、关联任务失权
- **THEN** 系统 SHALL 保留日志正文和原首次创建时间，正文编辑不会重新生成关联；不可读或已删除对象不暴露正文、标识或跳转

#### Scenario: Show no matching linked tasks
- **WHEN** 所选业务日无符合条件的每日事项或跨日任务
- **THEN** 系统 SHALL 显示空态且允许不关联，不能泄露无权任务

#### Scenario: Write an unlinked log
- **WHEN** 作者在公司近三天某日没有可关联记录时新建日志
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

#### Scenario: Keep daily items private when a superior reads a log
- **WHEN** 上级在资料、日志详情、列表、通知或直接请求中读取含有关联的下属日志
- **THEN** 系统 SHALL 只返回当前权限允许的日志和独立可读任务，省略每日事项正文、数量、状态、标识与跳转；作者仍可通过日志读取本人可用事项引用

### Requirement: Distinct log creation and editing interfaces
创建和编辑日志 SHALL 使用分别组织的界面及独立操作模式，不能仅替换标题并禁用创建控件来充当编辑界面。“写日志” SHALL 只列公司今天、昨天、前天尚未创建且可创建的日期；已有记录从显式日志标识的编辑入口进入，编辑界面 SHALL 以不可修改的日期展示字段呈现原业务日期，不显示创建日期候选、补写或新建入口。

创建与编辑界面 SHALL 分别提供当前操作所需的标签、正文、关联展示及保存/返回/关闭，创建自动预览所选日期的关联，编辑展示已保存关联，日期与标签保留统一标题、间距及对齐：桌面同排对齐，窄屏同列边缘对齐，日期展示字段与标签控件视觉对齐，不出现冗余禁用日期下拉框。全屏正文、滚动、焦点和嵌套关联对象详情返回 SHALL 可用；两种模式的草稿及提交目标不串用。

编辑 SHALL 只修改显式目标日志的允许字段，业务日期和真实首次创建时间不可改，成功编辑不重置首次24小时冻结。服务端作者、唯一性、冻结、版本及关联任务权限 SHALL 保持原规则；不能通过界面分离获得他人正文编辑权。失败/重复创建/过期或版本冲突 SHALL 保留当前操作的草稿并明确反馈，不自动切换创建与编辑、不覆盖别人的记录。删除重建继续沿用原冻结约束。

#### Scenario: Create only a missing recent log
- **WHEN** 今天已有日志、昨天和前天缺失，作者点击写日志
- **THEN** 创建界面 SHALL 只提供缺失可创建日期及创建所需内容，不进入已有日志编辑；三天都已写时提示从详情编辑，不打开伪创建/编辑混合界面

#### Scenario: Edit one explicit record without creation controls
- **WHEN** 作者从未冻结日志的编辑入口进入
- **THEN** 编辑界面 SHALL 展示该日志内容及只读业务日期，不出现近三天候选、日期切换/补写/新建控件；保存只更新该记录允许字段，日期和首次冻结时刻不变

#### Scenario: Preserve the draft through nested navigation and failed saves
- **WHEN** 创建或编辑时打开关联详情后返回，或提交遇到重复日期、冻结、版本冲突或网络失败
- **THEN** 当前界面 SHALL 保留自己的日期、标签、正文及关联展示状态，明确可执行反馈，不能把创建冲突转成编辑或把编辑保存成新日志；关联失权按原安全规则处理

#### Scenario: Align both interfaces and keep the personal page intact
- **WHEN** 在320、390和1440宽度分别创建、编辑日志，再进入卡片详情或人员日志后返回
- **THEN** 日期与标签 SHALL 按屏宽对齐、无截断横溢，正文和保存返回可达；本人日志列表、计数、直接点击详情、嵌套按钮和人员阅读隔离保持原规则

#### Scenario: Reject editing another author or an expired record
- **WHEN** 上级尝试编辑下属日志正文，或作者通过旧页面/直接请求修改已冻结记录
- **THEN** 系统 SHALL 拒绝并保留合法阅读/独立评论能力；不能借日志界面分离重置24小时窗口或绕过权限

### Requirement: Minimal profile page
“我的” SHALL 展示本人姓名、部门、职位、独立团队、直属上级和手机号，并按本人与下属资料的显示规则呈现组织位置，提供编辑本人头像/邮箱、修改密码、退出；姓名与手机号 SHALL 仅由管理员修改，本人字段不可借混合请求越权修改。组织及授权字段 SHALL 只能通过管理流程维护。管理层下属资料入口 SHALL 覆盖当前实际管理链全部直接和间接下级，不扩大资料范围或开放公司通讯录、资料卡派发按钮。人员详情 SHALL 按账户与联系方式规则独立检查手机号权限。日志 SHALL 继续独立鉴权，部门负责人含本部门全部下级、团队负责人含本团队员工，创始人含全公司。

页面 SHALL 移除员工团队管理入口，不展示员工用户名；创始人公司层、部门负责人部门层、团队负责人/普通员工部门与团队层 SHALL 分别按实际位置展示，不伪造缺失组织字段。手机号仅本人及实际管理链上级在授权详情中可读，邮箱仅本人；目录不得成为全公司联系方式目录。

本人及下属人员资料 SHALL 在单公司场景移除“公司”资料行，仍按真实位置表达公司层/部门/团队。职位、部门、团队 SHALL 分别取实际组织数据；下属资料使用部门、团队、职位面包屑，省略独立组织身份字段，不能以职位推导身份、用团队替代部门或展示伪造的“员工 · 部门负责人 · —”。组织或资料更新后重新读取 SHALL 刷新已有人员，只有姓名的摘要不得覆盖完整资料，退出/切换账号及失权不得复用原人员联系方式或旧范围。

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

#### Scenario: Show authorized staff employment details
- **WHEN** 授权上级查看有部门和团队的员工、仅部门的负责人或公司层员工
- **THEN** 资料 SHALL 按实际存在的部门、团队、职位组成面包屑，显示授权手机号及“入职日期 YYYY年MM月DD日”和“入职天数 N 天”；未登记日期时明确显示未登记

### Requirement: Hierarchical subordinate workspace
我的下属资料 SHALL 按真实直属关系排列全部合法下属及其下属，分层展开/收起与点击人员分离，姓名、职级/职位和真实部门/团队分别可辨，不能有职位时省略组织；公司层无部门者显示公司层，不伪造组织。展开状态不跨账号泄漏。不能仅按职级名称猜测关系或扩展人员权限。

点击下属 SHALL 先打开独立人员资料卡，展示授权资料并提供“日程”“日志”入口；进入工作浏览后复用本人相应浏览体验，明确所选人员。日程遵循月/日视图和日期清单要求，日志 SHALL 使用按业务日期归档的连续月历展示授权记录，可打开某日完整日志，不把人员资料与工作内容混排。

任务和日志 SHALL 可进入原鉴权详情/评论，返回保留人员、日期和页签；本人页面数据范围不变。下属日程页面 SHALL 不提供整条平移、端点拖动、画布上的独立调时操作或任务表单入口；从下属入口进入的任务、日志及其父子/关联任务、嵌套申请详情 SHALL 保持业务只读，仅允许按正常对象及作者权限读取、发表和维护本人评论；不提供编辑、排期、进展、完成、交接、交接预设、重开、置顶、申请提交/撤销或审核等其他写操作。独立本人授权入口仍按其字段/专用权限办理，来源模式不得增加服务端权限。无数据、加载、失败、重试和失权状态 SHALL 明确，不保留失权正文。组织/账号变化重验权限，旧响应不能串到另一人或账号。

下属工作浏览 SHALL 使用独立于本人页面的人员、日期、模式、日轴方向、页签、分页及滚动状态；工作详情的返回、头部关闭、Esc 和可用遮罩退出 SHALL 只退出当前层并恢复原人员工作页及焦点，不清空导航链退回“我的”。评论保存后也 SHALL 保留来源只读模式；失权后清空正文并明确反馈，不能靠恢复快照继续读取。

#### Scenario: Expand descendants and select independently
- **WHEN** 创始人或管理者展开直接下属、再展开其下属
- **THEN** 目录 SHALL 显示真实父子关系及所有合法层级，展开不自动进入人员，点击人员先进入其资料卡，再选择日程或日志

#### Scenario: Continuously browse a person's schedule by month
- **WHEN** 查看员工日程并上下滑过月界或年界、打开当日清单和详情再返回
- **THEN** 日程月历 SHALL 双向补载相邻月份并保留浏览位置，每个日期仅在所属月可点，跨月任务在所覆盖日期可读，详情返回保留人员、日期和滚动位置。补载失败时保留已加载月份并支持重试，失权时清理数据

#### Scenario: Read a person's schedule on a small screen
- **WHEN** 在320/390/1440宽度切换日期查看所选下属日程
- **THEN** 月历及日视图时间轴/清单 SHALL 无横溢遮挡，午夜截止无次日副本，零时长可识别，只有此人负责且有权任务展示

#### Scenario: Read logs and return from details
- **WHEN** 切日志页签、连续滚动多月并打开日志详情后返回，或在日程页签打开任务后返回
- **THEN** 工作页 SHALL 保留人员/日期/页签、月历滚动和焦点，长内容可读，全部日志可达，本人日志/日历范围不变化

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

### Requirement: Calendar dragging by presentation
拖动 SHALL 仅在本人月/日视图对正常可见、已发布、未完成、非待审且有现有仅排期权限的任务提供。本人视图仍仅展示当前有效负责人任务；任务表单及下属日程 SHALL 不提供整条或端点拖动，也不提供画布上的独立调时按钮，但可进入鉴权任务详情；独立正常入口按字段权限办理，下属浏览路径仅允许评论。历史通知的受限只读详情不得因此取得操作权。

本人月历 SHALL 支持长按抓取、跨屏移动和边缘滚动，并按公司日期以一天为步长：整条平移保留原日内起止时刻和工期；真实开始/截止端点分别按天调整对应日期、保留该端日内时刻与另一端不变，允许改变工期。跨周/月续接段不冒充真实端点，但可整体平移完整任务；按抓取日期和目标日期计算差量，不把续接片段误当原始开始。

本人横向/纵向日轴 SHALL 仅对完整起止区间位于当前公司业务日内且非全天/整日覆盖的普通定时任务提供拖动，以一小时相对差量保留原分钟，整条平移保持工期、端点保持另一端不变；当日零时长任务真实两端可分别命中。历史全天、全天区、整日覆盖和跨日任务首尾/中间截取片段 SHALL 均不提供整条、端点及键盘调时，从独立正常详情精确调整；只读下属详情不提供调整。午夜截止可为普通当日任务真实终点，不生成次日副本。

本人月历与日轴的合资格任务 SHALL 可用长按抓取，触摸移动早于抓取时继续原生滚动；激活时提供可见反馈，环境支持时短震动一次。拖动保持在本人日程内，靠近边缘按当前视图方向滚动。拖动 SHALL 实时显示完整起止日期时刻，松开进入轻量仅排期确认，主体只展示原排期、提议排期、原因和提交，不进入完整任务表单；审核仍按实际操作者直属上级，固定创始人按原规则免审。月历键盘按天、日轴键盘按小时。取消、Esc、pointercancel、失去捕获、逆序或无位移 SHALL 不写入、不误开详情/日期清单，正常触摸滚动继续可用。提交 SHALL 重验权限、冻结、完成、期限、版本与幂等，未提交前保留有效位置。

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

#### Scenario: Drag past the visible calendar
- **WHEN** 用户长按本人月历一条合法任务后拖到边缘，滚入其他月份后释放在目标日期
- **THEN** 系统 SHALL 在抓取时给出视觉反馈及可用震动，按实际抓取日和释放日计算位移；日轴边缘仅滚动当前日期轴且仍按小时，成功松手后进入原排期确认，离开有效区域不写入

### Requirement: Notification list presentation and combined filters
通知中心 SHALL 在列表顶部提供“全部”“未读”“需我审核”快捷入口及“筛选”入口，并支持精简/完整切换及“全部/未读/已读”和“全部/需我审核/结果告知/提醒/评论/其他”两维组合。已生效条件与清除操作 SHALL 可见。筛选针对当前全部可见通知，先过滤后分页/计数，保持时间倒序稳定排列；全局未读数不受筛选影响。打开消息才标已读，切换筛选不标已读，详情返回保留条件；账号切换清除旧会话数据。

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

#### Scenario: Use quick filters and refine them on mobile
- **WHEN** 用户在窄屏从未读快捷入口进入更多筛选并选择需我审核，再返回详情或清除条件
- **THEN** 列表 SHALL 显示两个生效条件、匹配项和正确总数；两维可分别更改，全部快捷入口可清空两维，焦点可达且无横向溢出

### Requirement: Persistent demonstration data for web and administration
系统 SHALL 准备手机号登录的员工演示账号及后端持久数据，按新固定组织重建演示身份与组织关系，业务使用稳定内部标识；十大公司重要事项为十条并能展示列表和卡片等样式，业务数据覆盖通知、待审核、任务表单、部门团队及下属日志任务，足以展示筛选、排序、分页及布局。同一账号 SHALL 按真实权限连续展示表单与下属日志任务，刷新仍可用，不用前端静态假数据替代，不按记录日期推算新演示日期。

演示 SHALL 以同一虚构企业的业务推进贯穿四层角色，首页事项、任务、日志、审批与通知在负责人、时序、标题及结果上互相对应。演示组织 SHALL 含固定创始人、至少两个部门且每部门多个团队、完整单负责人/普通员工及必填职位/有效手机号，独立管理员不占员工位置。任务 SHALL 覆盖跨部门多负责人、仅创建不负责、专用交接及正式接管；审核覆盖全操作的操作者直属上级、固定创始人免审直接生效、拒绝、撤销、失效、完成/重开。

排期 SHALL 覆盖跨月/跨年/跨日、午夜截止、零时长、整日覆盖及超过五项重叠；表单超过两页以验全结果筛选排序分页。日志 SHALL 覆盖部门/团队直接及间接下属、近三天、冻结/删除重建；标签/评论/通知含撤权边界。准备流程 SHALL 显式指定目标演示库，可重复执行而无重复/非法组织，不在应用启动时清空任意数据库；刷新及重启后数据持久。演示重构可替换旧数据，但不是结构约束或升级验证的替代。

#### Scenario: Run a continuous demo after refresh
- **WHEN** 选定手机号账号登录后展示首页、通知、审核、表单和下属日志任务并刷新
- **THEN** 同一账号 SHALL 有对应合法数据权限，十条公司事项及业务数据仍在，可实际筛选排序分页，不需伪造身份

#### Scenario: Prepare a complete repeatable new-model demonstration
- **WHEN** 在显式指定的演示库连续准备两次并重启，使用四层账号及独立管理员展示
- **THEN** 系统 SHALL 不重复插入，所有规定组织、审核、接管、日历和超过两页表单用例可实际操作，标签/评论/通知/日志及十条公司事项持久，无前端伪造身份或静态结果

#### Scenario: Present the same work from all four roles
- **WHEN** 按创始人、部门负责人、团队负责人和员工分别登录同一演示库，展示一次项目目标下达、任务执行、日报和审批结果
- **THEN** 每个角色 SHALL 看到其真实权限允许且语义连贯的工作、资料和通知；同一任务的来源、执行和审核可串联，其他团队与部门的数据按权限隔离

## REMOVED Requirements

### Requirement: Horizontal continuous daily-item calendar
**Reason** 原横向周列式布局由与公司页一致的纵向月视图替代。
**Migration** 保留每日事项及日期数据，切换后以公司今天建立纵向锚点，旧横向位置由新月历会话位置接替。
