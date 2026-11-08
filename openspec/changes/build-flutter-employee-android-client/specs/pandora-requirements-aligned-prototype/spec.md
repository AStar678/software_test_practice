## MODIFIED Requirements

### Requirement: Five-page navigation
Flutter 员工客户端及过渡员工 Web SHALL 仅提供“首页”“公司”“日志”“统计”“我的”五个主业务页面，其中“首页”替代“工作台”（历史名称“导图”），“公司”替代“日程”（历史名称“视图”），“统计”对应历史“AI地图”。导航、当前页标题、页面可访问名称及登录/加载等仍引用这两个入口的静态文案 SHALL 使用新名称；不得批量改写业务正文中的相同文字。

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
- **WHEN** 用户浏览每日事项后切到公司页，再返回首页，或业务正文包含“工作台”“日程”
- **THEN** 两处日期与滚动状态 SHALL 各自恢复，公司页月历仍上下连续浏览，业务正文原样保留

### Requirement: Three-section home dashboard
本要求的模块、数据范围及 PC 维护规则 SHALL 适用于 Flutter 和过渡 Web。Flutter 首页 SHALL 仅保留事件纪、任务看板、每日事项三个内容模块；上方两卡左右排列、每日事项通栏在下，无个人日志卡片或旧第四模块占位。上方两卡 SHALL 显示约三条少量预览且无内部纵滚，普通字号下至少三条普通单行数据可完整显示；长文本/字体放大允许自然增高并整页滚动，不缩小交互目标或截断内容。Flutter 事项 SHALL 使用纵向连续月份，与首页协调纵向滚动、保留独立月份锚点，全部内容及导航可达。卡片和预览条 SHALL 一律先进入对应完整清单，再从清单进详情，逐层返回保留位置。过渡 Web SHALL 可保留 A 时卡片内滚动、预览直接详情及横向计数事项外观，这些旧交互不作为 Flutter 验收标准。

事件纪 SHALL 仅更改员工首页原公司事项的名称；公司信息仍最多十条、按管理端设置顺序只读展示，包括上层无员工端维护入口，管理员的新增、修改、删除及调序规则保持。

任务看板 SHALL 展示本人当前为有效负责人、已正常发布且未完成的任务，不考虑创建者是谁，包含本人创建并负责的任务；仅创建而非当前负责、负责人已移除、已完成、待创建/未发布及仅有历史通知只读访问的任务 SHALL 排除。结果 SHALL 按实际派发给本人的时间倒序、同时间按任务标识升序稳定取最多十项，不按创建时间、紧急程度或截止排序；每任务只出现一次。条目 SHALL 只显示标题和右对齐紧急程度；Flutter 点击先进入完整看板清单，再由清单进入原鉴权详情，过渡 Web 可保留原详情入口。长标题、窄屏及滚动条 SHALL 不遮挡紧急程度。

首页日期区域 SHALL 不恢复重复的“新建任务”按钮或其占位；公司页原任务创建加号保持，每日事项加号只创建每日事项。每日事项 SHALL 由下述独立要求约束，替代原个人信息列表及十条上限。

#### Scenario: Render three modules in their intended positions
- **WHEN** 用户进入首页
- **THEN** 事件纪和任务看板 SHALL 保留原左右位置，每日事项位于下半部分并横跨两列，无个人日志卡片或旧第四模块占位

#### Scenario: Scroll home modules independently
- **WHEN** 上方列表较长或用户左右连续滑动每日事项
- **THEN** Flutter 上方卡片 SHALL 无内部纵滚，整页及事项月份可连续纵向浏览；过渡 Web 保留原滚动方式，两个客户端全部内容均可达且不误触清单

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
- **THEN** 任务项 SHALL 仅展示标题和完整右侧紧急程度；Flutter 先到完整清单再进原详情，过渡 Web 可直接详情，事件纪无员工编辑删除入口

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
- **THEN** 普通字号下两张上方卡片 SHALL 各完整预览至少三条条目，标题不计入；Flutter 超出内容在完整清单，卡片不内滚，短屏整页滚动访问事项月份和导航；过渡 Web 保留原内滚及七行事项外观

#### Scenario: Keep the daily header compact
- **WHEN** 用户查看每日事项标题和日历
- **THEN** 标题及其右侧新增按钮与月份工具 SHALL 在同一标题行，标题下无重复年月副标题，卡片右下无悬浮新增按钮及其专用空白区

#### Scenario: Enter complete Flutter lists before details
- **WHEN** Flutter 用户点事件纪或任务看板卡片、预览条并逐层返回
- **THEN** SHALL 先进入原范围最多十项的完整清单，再从清单进详情，返回恢复两层位置；预览不直达任务详情

### Requirement: Horizontal continuous daily-item calendar
A 阶段过渡员工 Web 的每日事项 SHALL 使用独立轻量月历，最左侧为横向滚动时固定的周一至周日七行表头；每个星期为一列，时间从左向右递增，每格公历日期数字在上、数量标记在下，不显示农历。各月 SHALL 作为独立月块排列，月间保留可辨留白；每月从1号所在周到月末所在周排列，首尾周不属于本月的位置留空，不显示或创建相邻月日期，也不跨月共用周列。空位 SHALL 不可激活且不参与日期键盘移动；同一真实日期只形成一个可交互日期格，按时间浏览无重复或遗漏。

各月年月 SHALL 完整显示在该月1号所在列上方，左侧与该列对齐，不与相邻月年月重叠；日期格右上角 SHALL 不再显示月份或年份角标，“每日事项”标题下 SHALL 无重复锚点年月副标题。初次进入及保留登录后的页面刷新 SHALL 定位公司今天所在月份且使今天可见。日历可操作后 SHALL 立即支持双向横向浏览，不要求用户先点击前后月、年月定位或回今天；宽屏能够容纳初始月份时 SHALL 自动提供足够的相邻月份及滚动余量，而非停留在不可滑动的固定三个月。容器尺寸变化及切页恢复后 SHALL 继续可滑动，恢复已保存的有效日期位置。

日历 SHALL 支持左右连续浏览前后月份及跨年，接近边界时补充相邻日期范围并保持视觉位置；不得仅用整页翻月或单独月份选择器代替连续滑动。补载失败 SHALL 保留已有内容并允许重试，不将未加载范围显示为已确认的零事项。年月定位和回今天 SHALL 可用，并有鼠标与键盘可操作方式。

过渡 Web 日历 SHALL 只呈现日期和每日事项数量，不复用公司页任务月历的事件条、跨度绘制、任务拖动、小时轴、日模式、密度调节、置顶、标签或审批能力；该绘制限制不禁止底层事项保存跨日起止日，各日期计数及清单 SHALL 包含覆盖当天的同一范围记录。左右滑动 SHALL 不误触日期清单；普通点击或键盘激活某天才打开当天清单。公司页月历的上下连续浏览 SHALL 保持。

以上横向、七行及计数限制 SHALL 仅适用于 A 保留的过渡 Web。Flutter 每日事项 SHALL 使用周一至周日七列、上下连续月份及跨年浏览，首次定位公司今天；边界补载、年月定位、回今天、尺寸变化及返回恢复保持有效日期锚点，同一真实日期无重复遗漏。Flutter SHALL 直接绘制事项名称与跨日条，跨周/月续接可辨，允许条外显示名称，不用计数替代事项、不依赖双指缩放。密集记录由准确溢出和完整日清单承接；失败区域不伪装零事项。日期、空白、条及溢出普通激活 SHALL 先打开实际命中日清单，不按条起点代替点击日；事项不具备拖动、小时轴、审批、标签或置顶。以下横向场景 SHALL 仅在过渡 Web 验收，Flutter 按本段和新增场景验收。

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

#### Scenario: Browse vertical range-item months in Flutter
- **WHEN** Flutter 用户连续上下浏览跨年月份并点某条跨月事项的续接段中间日
- **THEN** SHALL 按七列实际日期绘制同一 ID 范围条和名称，先开实际命中日含完成记录的完整清单；返回恢复月锚点，不复制为每日多记录，滚动不误开清单

#### Scenario: Keep dense Flutter ranges complete
- **WHEN** Flutter 范围数据跨窗口、多页或补载失败
- **THEN** SHALL 按 ID 去重、读完各页才视为完整，失败保留已有内容并可重试；长名称和溢出记录均可达，无事项拖动

### Requirement: Daily-item status count markers
A 阶段过渡 Web 每日事项日历 SHALL 在每个日期数字下最多显示一个数量标记，长度仅由当天全部事项总数决定，与是否完成无关。总数为零 SHALL 保留布局空间但不画标记；一条为圆点，二至四条逐渐加宽，五条及以上为固定最大宽度圆角条，标记高度始终一致。只要当天存在未完成事项，唯一标记 SHALL 为蓝色；当天总数大于零且全部完成时 SHALL 为灰色。混合状态 SHALL 合并为按总数绘制的一段蓝色标记，不并列显示蓝灰两段，不遮挡日期或相邻格。

数量 SHALL 覆盖当天全部事项，不仅统计已加载清单页；五条以上仅视觉宽度封顶，不截断数据或限制操作。日期可访问名称或等价文字 SHALL 提供完整日期及精确未完成/已完成数量，不能仅靠颜色表达状态。新增、完成/取消完成、修改日期和删除成功后 SHALL 更新所有受影响日期的标记。

范围事项 SHALL 在 startDate 到 endDate 的每个覆盖日计一次；openCount 包含未完成及逾期，completedCount 包含完成。过渡数量标记继续按是否全部完成着色，不覆盖详情的三态语义。数量和受影响日期 SHALL 从完整相交记录计算，修改范围/完成/删除后同时更新原范围与新范围；不能仅更新起点。以上标记外观及下列计数标记场景 SHALL 仅约束过渡 Web。Flutter 条/清单 SHALL 按同一事项三态显示：完成优先灰色，未完成且公司今天超过 endDate 为逾期红色，其他未完成为蓝色；状态同时提供文字/可访问语义，不用唯一数量标记替代事项条。

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

#### Scenario: Count a ranged item once per covered day
- **WHEN** 同一事项覆盖月底三天，且其中一天清单尚未加载或存在多页
- **THEN** 每个覆盖日摘要 SHALL 各计一次且跨月一致，完成后所有覆盖日完成计数变化，范围外不计入

#### Scenario: Prioritize completion on every Flutter range segment
- **WHEN** 同一跨月事项已过 endDate，在 Flutter 任一覆盖日完成再取消完成
- **THEN** 全部续接段 SHALL 同步完成灰色再恢复逾期红色；未过 endDate 的未完成项蓝色，不由设备时区或当前清单页决定

### Requirement: Minimal profile page
“我的” SHALL 展示本人姓名、真实组织/职位、直属上级和手机号，提供编辑本人头像/邮箱、修改密码、退出；过渡 Web 可保留位置推导的四层身份，Flutter 不显示身份标签而使用真实职务路径。姓名与手机号 SHALL 仅由管理员修改，本人字段不可借混合请求越权修改。组织及授权字段 SHALL 只能通过管理流程维护。管理层下属资料入口 SHALL 覆盖当前实际管理链全部直接和间接下级，不扩大资料范围或开放公司通讯录、资料卡派发按钮。人员详情 SHALL 按账户与联系方式规则独立检查手机号权限。日志 SHALL 继续独立鉴权，部门负责人含本部门全部下级、团队负责人含本团队员工，创始人含全公司。

页面 SHALL 移除员工团队管理入口，不展示员工用户名；创始人公司层、部门负责人部门层、团队负责人/普通员工部门与团队层 SHALL 分别按实际位置展示，不伪造缺失组织字段。手机号与邮箱仅本人及当前实际管理链上级在通过原资料详情授权后可读；目录不得成为全公司联系方式目录。

本人及下属人员资料 SHALL 在单公司场景移除“公司”资料行，按真实位置表达部门/团队/职位；内部身份、职位、部门数据分别取实际组织值，不能以职位推导身份、用团队替代部门或展示伪造的“员工 · 部门负责人 · —”。组织或资料更新后重新读取 SHALL 刷新已有人员，只有姓名的摘要不得覆盖完整资料，退出/切换账号及失权不得复用原人员联系方式或旧范围。

本人及授权下属详情 SHALL 增加由管理员维护的可空 hireDate 及统一 tenure（years/months/days/asOfDate）投影；员工只读，不用账号创建时间代替。缺失日期时显示“入职日期未设置”，不能虚构时长；公司今天计算完整经过的年、月、日，闰日/月末按合法周年和月锚点截月末，不用 365/30 换算。普通目录、下属树摘要、负责人候选 SHALL 不附带电话、邮箱、入职日或时长。

A 阶段过渡 Web SHALL 补齐上述详情字段和空态，可保留原组织身份/分散字段。上文关于可见四层身份及独立部门/职位/团队行的外观 SHALL 仅适用于过渡 Web；Flutter 的我的、设置、人员树、资料和工作页 SHALL 隐藏组织身份标签，统一使用实际“部门 ▸ 团队 ▸ 实际职位”，实心三角分隔且缺层省略、不伪造公司/团队/职位占位。长路径可读，姓名、手机号及实际直属上级等合法资料继续可达。内部组织身份与位置继续用于授权，不能改用职位名。Flutter SHALL 渲染服务端 tenure/asOfDate，不自行重算；以下独立字段场景在 Flutter 中以等效真实职务路径承接，联系方式范围和所有业务限制不变。

#### Scenario: Read and edit the required profile
- **WHEN** 本人打开“我的”并修改联系方式
- **THEN** 系统 SHALL 不显示公司行，Flutter 显示真实职务路径、过渡 Web 可保留独立部门/职位/团队字段，并保存允许的本人字段；组织/权限修改 SHALL 被拒绝，改密及退出 SHALL 可用

#### Scenario: Open a subordinate within both profile scope and the management chain
- **WHEN** 管理层从“我的”查看直属或间接下属资料和日志
- **THEN** 列表 SHALL 仅含当前资料权限与实际管理链同时允许的下属；详情 SHALL 重新检查资料权和手机号权，不提供派发按钮；间接下属日志 SHALL 按当前固定组织矩阵独立裁决，非管理链人员 SHALL 不出现在该入口

#### Scenario: View profile
- **WHEN** 本人打开“我的”并修改联系方式
- **THEN** 系统 SHALL 不显示公司行，Flutter 显示真实职务路径、过渡 Web 可保留独立部门/职位/团队字段，并保存允许的本人字段；组织/权限修改 SHALL 被拒绝，改密及退出 SHALL 可用

#### Scenario: Keep identity fields read-only to employees
- **WHEN** 员工尝试从页面或直接 API 改姓名/手机号，同时打开头像、邮箱、改密入口
- **THEN** 姓名/手机号修改 SHALL 被拒绝，其余合法本人维护可用，无员工用户名和团队管理入口；职位改名不改变任何业务权限

#### Scenario: Refresh a known person without losing organization fields
- **WHEN** 已缓存某人员后其组织身份、职位或部门更新，随后收到仅姓名摘要、读取完整资料并刷新
- **THEN** 人员展示 SHALL 使用最新合法完整资料，摘要不将身份重置为员工、不丢真实部门，空值安全表达，手机号邮箱不进入普通摘要缓存；本人及下属资料无公司行

#### Scenario: Read contact details only inside the actual management chain
- **WHEN** 本人、实际直接/间接上级、同级、其他管理链或跨公司人员请求详情或普通摘要
- **THEN** 仅本人及通过原详情授权的实际链上级 SHALL 得到电话/邮箱和入职投影；其他人员不新增读取权，摘要及候选不带这些字段，失去链上资格后旧读取不得继续

#### Scenario: Calculate completed tenure at calendar boundaries
- **WHEN** 入职日为闰日/月末，今天位于周年前后或不同设备时区，或入职日为空
- **THEN** tenure SHALL 使用公司今天及约定的周年/月锚点算法，年/月/日均为完整经过量且不越过今天，缺失为 null，不采用固定天数折算

#### Scenario: Hide visible identity without altering authorization
- **WHEN** Flutter 用户查看自己/下属资料、树、设置及工作页且实际缺少部门或团队
- **THEN** SHALL 无组织身份徽标，路径仅保留真实存在层级且长路径可读；服务端角色/管理链授权仍有效，摘要及候选不得获得联系方式

### Requirement: Strict prototype scope
系统 SHALL 以 2026-11-08 更改指导、完整迁移盘点及顺序归档的 A/B 增量为依据；新明确规则取代旧冲突，未改的完整员工规则继续有效，旧 PRD/静态原型不覆盖新规则。A SHALL 负责共享后端/契约、迁移、必要 PC/Web 过渡及演示；B SHALL 负责完整 Flutter 员工 Android 客户端。用户已允许 A 尚未完成时先规划 B，实施顺序仍 A → B；B 实施前核对 A 的独立验证、归档后规格和真实交接契约，发生漂移先协调规划，不将规划完成当实现完成。旧归档 change 不作当前待完成事项。

系统 SHALL 使用真实认证、持久化及事件调度验收，保留完整五页与全部二级员工业务。独立管理员继续 PC；新 Flutter 工程、其 Android 宿主、APK 构建签名与真实设备交付 SHALL 纳入 B，不受 A 的原生/APK/设备排除条款限制。旧 android/ Java、android-shell/ 改造不在 B 范围；新包独立共存，不覆盖旧套壳或导入本地凭证。Flutter 时间控件 SHALL 使用适配手机的 Flutter 界面，不受旧 Web DOM/CSS 限定。系统推送继续延期，完整站内通知保留。请示回复、一人多团队、任务私人草稿、任务取消、公司草稿/定时发布、日志转待办、外部模型与 MBTI SHALL 继续不纳入，不新增离线业务写入或移动管理员。

账号/API SHALL 沿用严格契约，不恢复员工 username 兼容；共享后端仍唯一裁决授权、版本、幂等及状态机，B 不重写移动审批引擎。Flutter SHALL 以完整迁移及 12 项增量验收，不以静态样例、本地假状态、旧 APK、Web/后端 PASS 或旧任务勾选替代当前独立验证和安卓设备证据。A 不因 B 的交付责任扩大为 A 内安卓实现。

员工 Web SHALL 继续安全过渡，不要求长期对等维护全部 Flutter 新交互；B 不自动下线旧入口。横向事项、卡片内滚、人员单月和旧通知布局仅适用于过渡 Web，不作为 Flutter 最终标准。PC 保持正式独立管理端，跨端组织变动和服务数据需联调回归。

#### Scenario: Validate against the selected checklist
- **WHEN** 实施者或验证者检查本变更
- **THEN** 验收 SHALL 使用更改指导和本增量规格，不能要求旧周视图、受限创建派发或午夜冻结，也不能宣称尚未实施的 Flutter 已通过；静态示例、旧报告及任务勾选 SHALL 不替代当前真实服务证据

#### Scenario: Keep native Android outside the change
- **WHEN** 检查修改文件和交付记录
- **THEN** 旧 `android/` 和 `android-shell/` SHALL 不在 B 修改范围；独立 Flutter Android 工程、共存 APK 构建签名及设备验证属于 B，旧工程排除不得用来免除 Flutter 交付，共享服务及过渡兼容影响如实记录

#### Scenario: Validate the real service and declared scope
- **WHEN** 实施者或验证者检查本变更
- **THEN** 验收 SHALL 使用更改指导和本增量规格，不能要求旧周视图、受限创建派发或午夜冻结，也不能宣称尚未实施的 Flutter 已通过；静态示例、旧报告及任务勾选 SHALL 不替代当前真实服务证据

#### Scenario: Inspect available actions
- **WHEN** 实施者或验证者检查本变更
- **THEN** 验收 SHALL 使用更改指导和本增量规格，不能要求旧周视图、受限创建派发或午夜冻结，也不能宣称尚未实施的 Flutter 已通过；静态示例、旧报告及任务勾选 SHALL 不替代当前真实服务证据

#### Scenario: Open the split static prototype
- **WHEN** 从文件系统打开旧静态页面或直接读取未构建脚本
- **THEN** 验收 SHALL 使用真实服务、认证、持久化及事件路径，静态内容不视为通过，本次按更改指导及本增量规格判定

#### Scenario: Plan B ahead but implement after A
- **WHEN** B 已提出而 A 未独立验证归档，或 A 最终契约偏离 B 规划
- **THEN** SHALL 允许审阅 B，但先完成 A、按归档后真实契约重核四块重叠规格及接口，漂移先协调规划，不提前同步覆盖 A

### Requirement: Notification list presentation and combined filters
通知中心 SHALL 提供精简/完整显示切换及“全部/未读/已读”和“全部/需我审核/结果告知/提醒/评论/其他”组合筛选。筛选针对当前全部可见通知，先过滤后分页/计数，保持时间倒序稳定排列；全局未读数不受筛选影响。打开消息才标已读，切换筛选不标已读，详情返回保留条件；账号切换清除旧会话数据。

Flutter 筛选区 SHALL 固定在列表顶部，类型使用六标签、已读使用三分段，窄屏类型可横滚；精简/完整用一个几何图标切换，具有可访问名称与当前模式语义，未读不只靠颜色；有条件才显示重置，详情返回保留条件、模式与位置。过渡 Web 可保持原筛选外观，过滤及授权语义不变。

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

#### Scenario: Use sticky Flutter six-by-three controls
- **WHEN** Flutter 用户在窄屏切换六类型、三读态和精简/完整并滚动
- **THEN** 筛选区 SHALL 固定，类型均可达，单几何切换图标有名称及模式语义；切模式不标读，详情返回条件/模式/位置保持

### Requirement: Hierarchical subordinate workspace
我的下属资料 SHALL 按真实直属关系排列全部合法下属及其下属，分层展开/收起与点击人员分离，姓名及真实组织/职位可辨。Flutter SHALL 隐藏组织身份标签，按实际“部门 ▸ 团队 ▸ 实际职位”缺层省略；过渡 Web 可保留分列和公司层表达，均不伪造组织。展开状态不跨账号泄漏。不能仅按职级名称猜测关系或扩展人员权限。

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
- **THEN** 每个节点 SHALL 保留姓名和真实组织/职位；Flutter 用实际职务路径省略缺层并隐藏身份，过渡 Web 可保留公司层占位，不用职位覆盖部门/团队，不显示原始空值

#### Scenario: Return through nested subordinate details
- **WHEN** 用户从人员资料卡进入特定日期的月历清单或日轴，再开任务、关联任务或日志并发表评论，随后逐层返回/关闭
- **THEN** 系统 SHALL 恢复同一人员、页签、模式、日期、日轴方向、已加载位置、滚动和焦点，不退回我的或更改本人日历/日志；全链路仅评论可写，旧草稿和残留按钮不能触发业务写请求

#### Scenario: Keep overlapping identities read-only in subordinate context
- **WHEN** 下属任务同时由当前查看者创建或负责，该查看者经下属路径及其嵌套详情操作
- **THEN** 该路径 SHALL 仅能评论且无其他编辑性操作；从独立本人正常入口重新打开时按当前字段及专用权限办理，直接越权请求仍被服务端拒绝

### Requirement: Subordinate calendar month and day views
所选人员日程 SHALL 参考本人日历设计并适配人员工作页，默认月视图，可切日视图。月历 SHALL 周一至周日排列，按占用公司日期绘制连续日级任务条，不按小时缩窄或偏移首尾，午夜截止不多占次日，零时长可辨；溢出及日期/任务条普通点击按本人月历体验进入完整当日清单，清单提供日视图入口。日视图 SHALL 提供00:00至24:00真实时段时间轴、重叠分栏、独立全天区及可切换任务清单。Flutter 月历 SHALL 上下连续跨月/年、边界补载保持可见锚点，补载失败保留已有内容可重试，不以单月翻页替代连续浏览；过渡 Web 可保留前后按月。日视图按天导航，均可定位日期/回今天，无单独周模式。Flutter 当日清单 SHALL 内容独立滚动，标题及“进入日视图/关闭”固定可见。

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

#### Scenario: Browse continuous Flutter subordinate months
- **WHEN** Flutter 用户上下浏览下属日程跨年并打开超过一屏的日清单
- **THEN** SHALL 连续补载保持人员/锚点，失败可重试，清单标题与进入日视图/关闭始终可见；嵌套详情返回原位置，日志仍列表且业务只读

### Requirement: Calendar dragging by presentation
拖动 SHALL 仅在本人月/日视图对正常可见、已发布、未完成、非待审且有现有仅排期权限的任务提供。本人视图仍仅展示当前有效负责人任务；任务表单及下属日程 SHALL 不提供整条或端点拖动，也不提供画布上的独立调时按钮，但可进入鉴权任务详情；独立正常入口按字段权限办理，下属浏览路径仅允许评论。历史通知的受限只读详情不得因此取得操作权。

本人月历 SHALL 按公司日期以一天为步长：整条平移保留原日内起止时刻和工期；真实开始/截止端点分别按天调整对应日期、保留该端日内时刻与另一端不变，允许改变工期。跨周/月续接段不冒充真实端点，但可整体平移完整任务；按抓取日期和目标日期计算差量，不把续接片段误当原始开始。

本人横向/纵向日轴 SHALL 仅对完整起止区间位于当前公司业务日内且非全天/整日覆盖的普通定时任务提供拖动，以一小时相对差量保留原分钟，整条平移保持工期、端点保持另一端不变；当日零时长任务真实两端可分别命中。历史全天、全天区、整日覆盖和跨日任务首尾/中间截取片段 SHALL 均不提供整条、端点及键盘调时，从独立正常详情精确调整；只读下属详情不提供调整。午夜截止可为普通当日任务真实终点，不生成次日副本。

日轴拖动、键盘/可访问调整和确认 SHALL 同时保证最终完整区间仍在当前公司日 00:00—24:00 且起止有序，边界可为当日零点或次日零点；越界不换日、不提交。此限制不收紧正常详情合法跨日排期。Flutter 触摸 SHALL 在约 500ms 长按成功激活后才拖动并轻震一次，激活前保持自然滚动；无震动设备保留可辨激活反馈。月历 SHALL 二维映射星期列与周行、跨行/月/年并边缘自动滚动补载，用实际抓取日与实际落点日差移动完整任务，不能以纵向距离代替日期；仅真实端点能缩放。取消、后台/系统中断、无位移或无效落点 SHALL 清除预览、不写、不误开详情。键盘及无拖动的可访问路径遵守同样天/小时增量和日轴最终边界。

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

#### Scenario: Activate once and drag through Flutter month edges
- **WHEN** 真机长按成功激活后从续接段移动到月历边缘并自动滚动跨行/月/年
- **THEN** SHALL 只轻震一次、按实际日期差移动完整任务保时刻工期，松手只进入轻量原因确认；激活前滚动、取消/无位移/后台中断不写或误开详情

#### Scenario: Reject final day-axis overflow in every adjustment path
- **WHEN** 原本当日内普通任务按小时平移/拉端后越过当前日00:00—24:00，包含键盘、可访问动作和确认
- **THEN** SHALL 拒绝且无写请求、不换日；合法边界可保存并保分钟，旧全天/整日覆盖/跨日片段无日轴调时，正常详情跨日资格不变

### Requirement: Personal work logs
日志 SHALL 归作者并按公司业务日期同人同日唯一，新建允许公司今天、昨天、前天，不允许更早或未来；写日志 SHALL 只提供近三天尚未创建且可创建的日期，不提供独立补写按钮；已有日期不进入创建选择，三天均已有日志时提示从详情编辑。编辑 SHALL 通过显式日志标识进入，重复创建冲突不得自动转为编辑或覆盖原记录。日志创建后 SHALL 不改业务日期。冻结 SHALL 为真实首次创建时间加 24 小时，编辑不重置计时，服务端达到冻结点立即只读，跨零点不提前冻结。编辑和删除 SHALL 仅作者且共用该窗口，删除重建 SHALL 不重置首次创建时间或清除同人同日冻结约束。

前后端 SHALL 一致显示可编辑性、冻结时间和重复/到期反馈，旧页面到期提交及并发 SHALL 不绕过限制；存量日志保留真实创建时间，冻结和他人日志不显示正文编辑/删除。新建编辑 SHALL 保留全屏表单、伸展正文和可达保存/返回/关闭，离开恢复其他弹层布局。

日志 SHALL 可选关联一项作者当前正常可见任务，支持名称搜索、空结果和清空，关联详情独立鉴权。创始人看公司、部门负责人看本人及本部门全部直接/间接下属、团队负责人看本人及本团队员工、普通员工看本人，上级不能编辑正文，同团队/同任务不授予日志权；关联任务失权 SHALL 裁剪跳转但保留有权正文。标签 SHALL 同受日志编辑冻结规则，独立评论按评论要求处理。

日志日期转换 SHALL 使用日志模块可访问的统一公司业务日期方法，不依赖日程私有函数或偶然脚本加载顺序。详情“编辑日志” SHALL 传入真实日志标识，写日志及关闭保存入口操作和样式正确；从人员资料进入目标日志 SHALL 使用独立人员工作页/详情按当前日志权限查询，不修改本人日志页范围或恢复旧人员筛选。

Flutter 卡片、相对日期及排序 SHALL 按 businessDate 倒序，详情单独显示真实 createdAt，不以创建时刻重排补写日期。创建和仍可编辑日志 SHALL 支持用户主动按该 businessDate 读取完整本人事项/正常负责任务名称，含完成、按组内 ID 去重后分组追加正文，不覆盖、不改关联/状态。源失败/空结果保正文，冻结不允许追加；填充资格按实际编辑窗口，不错误限制为近三日创建窗口。

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

#### Scenario: Keep Flutter log date and fill eligibility independent
- **WHEN** 今天补写前天后次日仍未满首次创建24小时，用户打开该日志编辑并主动填充
- **THEN** 卡片/排序 SHALL 仍归前天businessDate，详情显示真实createdAt，按所属日完整追加名称且保原正文；不因已超近三日阻止合法编辑填充，到冻结点则拒绝，关联/状态不变
