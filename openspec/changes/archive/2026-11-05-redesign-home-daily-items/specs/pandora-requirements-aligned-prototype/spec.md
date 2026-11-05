## REMOVED Requirements

### Requirement: Four-quadrant dashboard
**Reason**: 用户明确用三模块首页替换四象限，移除首页日志和个人事项十条上限，且任务看板不再排除本人创建的任务；旧四象限及其日志窗口、个人项拒绝第十一条场景不再是验收目标。

**Migration**: 由新增的 `Three-section home dashboard` 及独立每日事项要求替代。公司事项的十条上限、管理顺序、员工只读和任务派发时间排序/标题紧急程度可读性在新要求中保留；日志业务留在日志页。用户确认旧个人事项为非生产数据且无需迁移保留，切换后使用有日期和完成状态的每日事项；不清理公司信息、任务或日志。

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
- **WHEN** 用户横向浏览每日事项后切到公司页，再返回首页，或业务正文包含“工作台”“日程”
- **THEN** 两处日期与滚动状态 SHALL 各自恢复，公司页月历仍上下连续浏览，业务正文原样保留

## ADDED Requirements

### Requirement: Three-section home dashboard
首页 SHALL 仅保留事件纪、任务看板、每日事项三个内容模块；事件纪位于原公司事项位置的上方左侧，任务看板位于原我的待办位置的上方右侧，每日事项通栏位于两者下方。首页 SHALL 移除个人日志展示及其原卡片和空白占位，不删除日志记录或日志页功能。上方两个模块内容超出时 SHALL 独立纵向滚动；每日事项 SHALL 在自己的日历区域横向连续滚动，不带动整页或上方模块横向移动。紧凑屏幕 SHALL 保证七个星期行、悬浮加号及导航可达，必要的页面纵向滚动不得截断内容。

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
每日事项 SHALL 使用独立轻量月历，最左侧为横向滚动时固定的周一至周日七行表头；每个星期为一列，时间从左向右递增，每格公历日期数字在上、数量标记在下，不显示农历。初次进入 SHALL 定位公司今天所在月份，显示清楚的年月及跨月/年边界；同一真实日期只形成一个可交互日期格，不重复月份边界日。

日历 SHALL 支持左右连续浏览前后月份及跨年，接近边界时补充相邻日期范围并保持视觉位置；不得仅用整页翻月或单独月份选择器代替连续滑动。补载失败 SHALL 保留已有内容并允许重试，不将未加载范围显示为已确认的零事项。年月定位和回今天 SHALL 可用，并有鼠标与键盘可操作方式。

日历 SHALL 只呈现日期和每日事项数量，不复用公司页任务月历的事件条、跨日跨度、任务拖动、小时轴、日模式、密度调节、置顶、标签或审批能力。左右滑动 SHALL 不误触日期清单；普通点击或键盘激活某天才打开当天清单。公司页月历的上下连续浏览 SHALL 保持。

#### Scenario: Read the transposed calendar
- **WHEN** 用户进入每日事项并水平滚动
- **THEN** 左侧周一至周日 SHALL 固定，星期列按时间向右排列，每格日期和标记上下排列，无农历，年月归属清楚

#### Scenario: Browse continuously across months and years
- **WHEN** 用户从十二月末向右连续浏览一月再向左返回，或定位远处月份继续滑动
- **THEN** 日期 SHALL 连续、无重复或缺失，补载不跳动，星期对齐，所选年月和返回位置正确

#### Scenario: Recover a failed range load
- **WHEN** 相邻月份请求失败后重试
- **THEN** 已有日历和事项标记 SHALL 保留，失败范围明确可重试，不能将加载失败伪装成空月份，重试成功后无重复日期

#### Scenario: Separate sliding from activation
- **WHEN** 用户在日期格上开始触摸横滑，再用普通点击或键盘激活日期
- **THEN** 滑动 SHALL 只移动日历，不打开清单、不修改事项；普通激活才打开所选真实日期清单，鼠标与键盘同样可浏览相邻日期范围

### Requirement: Daily-item status count markers
每日事项日历 SHALL 在每个日期数字下用蓝色表示未完成数、灰色表示已完成数，分别计算各状态的实际总条数。每种状态为零 SHALL 不显示该色标记；一条为圆点，二至四条逐渐加宽，五条及以上为固定最大宽度圆角条，标记高度始终一致。混合状态 SHALL 在日期下同一标记行并列显示两种颜色且不遮挡日期或相邻格；全部为零保留布局空间但不画点。

数量 SHALL 覆盖当天全部事项，不仅统计已加载清单页；五条以上仅视觉宽度封顶，不截断数据或限制操作。日期可访问名称或等价文字 SHALL 提供完整日期及精确未完成/已完成数量，不能仅靠颜色表达状态。新增、完成/取消完成、修改日期和删除成功后 SHALL 更新所有受影响日期的标记。

#### Scenario: Render zero through saturated counts
- **WHEN** 不同日期分别有零、一、二、三、四、五及超过五条同状态事项
- **THEN** 标记 SHALL 按规则从无点、圆点、逐渐加宽到固定圆角条，所有高度一致，超过五条仍有准确数量和完整清单

#### Scenario: Show mixed and completed-only days
- **WHEN** 某天既有未完成也有已完成事项，另一日全部完成
- **THEN** 前者 SHALL 在日期下并列显示蓝色和灰色标记，后者只显示灰色，精确数量可被辅助技术读取

#### Scenario: Update both dates after a move or deletion
- **WHEN** 事项完成、取消完成、移到另一日或删除当天最后一条
- **THEN** 涉及日期的计数及标记 SHALL 同步改变，最后一条删除后无残留点，刷新保持

### Requirement: Daily-item lists details and reliable editing
点击任一天 SHALL 打开该日期事项清单弹层，显示日期、当天全部事项的可分页/滚动列表、完成控件、必要新增及关闭操作；无事项 SHALL 显示空态并可按该日新增。清单 SHALL 同时保留完成及未完成事项，按创建时间升序、同值按事项标识稳定排序，切换完成状态不使条目跳位；行文本点击进入事项详情，完成控件不误触详情。

每日事项区域右下悬浮加号 SHALL 只打开每日事项创建界面，默认选中日期、尚无选中日期时用公司今天；日期可修改。它 SHALL 不遮挡底部导航、最后一行日期/标记或清单内容。表单 SHALL 仅要求日期和正文；详情可完成/取消完成、编辑日期/正文、经确认删除。所有操作 SHALL 使用真实事项标识。

详情返回 SHALL 恢复原日期清单及其滚动位置，清单关闭恢复原日历日期、横向位置及触发焦点；支持按钮、返回/Esc及遮罩关闭且焦点不留在隐藏内容。事项移日后 SHALL 返回原日期清单并更新原日期与目标日期数量，不无提示跳到目标日。新增、编辑或完成失败 SHALL 保留草稿/原状态并提供重试，取消删除不写入。

更新与删除 SHALL 使用打开目标时取得的版本，版本冲突明确拒绝覆盖并允许回读处理；提交中防重复操作，响应丢失后的相同载荷重试 SHALL 不产生重复事项或重复状态变化。退出、会话失效或切账号 SHALL 清理每日事项缓存、草稿和弹层，旧请求不得覆盖新账号或新的日期查询。

#### Scenario: Open an empty day and create with the floating button
- **WHEN** 用户选择无事项日期，再通过清单或悬浮加号新增
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
- **THEN** 星期及七行日期 SHALL 可达，长文本可换行，悬浮加号和保存/返回不遮挡内容及导航，键盘操作与焦点恢复可用
