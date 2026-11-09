## MODIFIED Requirements

### Requirement: Independent personal daily items
每日事项 SHALL 仅属于创建它的本人，以开始日、结束日、一段非空纯文本及完成状态保存，首尾日均包含且结束不得早于开始；默认未完成，支持完成和取消完成。业务详情 SHALL 只展示起止日期、完整文本、完成状态控件及编辑/删除/返回等必要操作，不增加标题、时刻、负责人、紧急程度、标签、提醒、审批、关联任务、评论或日志字段。正文 SHALL 保留换行，以纯文本安全呈现，去除首尾空白后限 1–2000 字符。

本人 SHALL 可为过去、今天或未来的合法日期创建多条事项，可编辑起止日期和正文、删除指定事项，不受原个人事项总共十条、每天一条或日志补写/冻结窗口限制。日期 SHALL 使用明确的公历日期，不因设备时区与公司时区不同而漂移；默认今天以公司业务日期为准。

事项 SHALL 与任务及日志无关联，维护和完成事项不得创建任务、审核申请、任务通知、日志或改变其状态、计数和排期。任何其他员工、上级及独立管理员 SHALL 不因组织管理权读取或维护他人每日事项；列表、日期计数、详情及写入均须执行本人及同组织限制。无日期的退休个人首页事项不恢复；现有已持久化的单日每日事项 SHALL 无损映射为 startDate=endDate=原日期，保留 ID、正文、完成、版本及真实创建/更新时间。跨日事项 SHALL 是同一记录，任一覆盖日完成一次则整条完成；不得复制为多条单日记录。

事项状态 SHALL 为 completed/open/overdue：完成优先；未完成且公司 businessDate 超过 endDate 才逾期，其余未完成。范围按公历日处理，不增加小时截止；过去/今天/未来合法起止日期均可使用，查询窗口上限不得限制事项自身可跨的月份。日志填充仅复制文本，不改变事项与日志无关联规则。

#### Scenario: Create more than ten independent items
- **WHEN** 本人累计或同一天已有十条每日事项，再创建第十一条
- **THEN** 合法输入 SHALL 保存成功且可重新读取，任务及日志数据不变，不触发旧个人事项十条上限或日志日期规则

#### Scenario: Edit the date and body of a specific item
- **WHEN** 本人在同日多条事项中选择一条，修改起止日期及多行正文后保存
- **THEN** 系统 SHALL 仅更新该标识事项，不再覆盖的日期清单移除、新覆盖日期清单出现，涉及日期数量标记同步，刷新保持，其他事项不受影响

#### Scenario: Complete and reopen an item
- **WHEN** 本人将事项设为完成后刷新，再取消完成
- **THEN** 完成状态 SHALL 持久化并可逆，日期摘要按完成状态更新，起止日期和正文保持，任何任务状态不变

#### Scenario: Keep dates stable across time zones
- **WHEN** 设备与公司时区不同，或事项日期跨月、跨年及闰日
- **THEN** 默认日期 SHALL 使用公司今天，明确保存的日期原样往返，非法日期或空白/超长正文拒绝且不部分保存

#### Scenario: Enforce private ownership on every operation
- **WHEN** 同公司其他员工、上级或管理员及跨公司用户请求某人的事项列表、计数、详情或维护接口
- **THEN** 系统 SHALL 不返回他人事项、正文或计数，越权写入被拒绝，不因组织管理或任务可见关系扩大访问

#### Scenario: Keep daily-item details minimal and safe
- **WHEN** 用户打开包含长文本、换行和类似 HTML 内容的事项详情
- **THEN** 详情 SHALL 安全显示完整日期和纯文本，提供完成状态及必要维护操作，不展示额外任务/日志字段，文本不作为脚本执行

#### Scenario: Preserve one ranged record across dates
- **WHEN** 本人创建跨周、跨月或跨年事项并从多个覆盖日读取，再在其中一天完成
- **THEN** 各日 SHALL 返回同一 ID 及完整原起止日，完成/取消完成在所有覆盖日一致，其他任务/日志/审核不变

#### Scenario: Expire after the inclusive end date
- **WHEN** 公司今天分别在事项开始前、范围内、结束日及结束次日，或事项已完成
- **THEN** 未完成项 SHALL 仅在超过结束日后为 overdue，完成项始终 completed，设备时区不改变判定

#### Scenario: Migrate dated daily items without data loss
- **WHEN** 含已完成、未完成和多行正文的既有单日记录升级
- **THEN** startDate/endDate SHALL 均等于原日期，原 ID、所有权、内容、完成、版本与真实时间不变，私有访问限制仍有效

### Requirement: Horizontal continuous daily-item calendar
A 阶段过渡员工 Web 的每日事项 SHALL 使用独立轻量月历，最左侧为横向滚动时固定的周一至周日七行表头；每个星期为一列，时间从左向右递增，每格公历日期数字在上、数量标记在下，不显示农历。各月 SHALL 作为独立月块排列，月间保留可辨留白；每月从1号所在周到月末所在周排列，首尾周不属于本月的位置留空，不显示或创建相邻月日期，也不跨月共用周列。空位 SHALL 不可激活且不参与日期键盘移动；同一真实日期只形成一个可交互日期格，按时间浏览无重复或遗漏。

各月年月 SHALL 完整显示在该月1号所在列上方，左侧与该列对齐，不与相邻月年月重叠；日期格右上角 SHALL 不再显示月份或年份角标，“每日事项”标题下 SHALL 无重复锚点年月副标题。初次进入及保留登录后的页面刷新 SHALL 定位公司今天所在月份且使今天可见。日历可操作后 SHALL 立即支持双向横向浏览，不要求用户先点击前后月、年月定位或回今天；宽屏能够容纳初始月份时 SHALL 自动提供足够的相邻月份及滚动余量，而非停留在不可滑动的固定三个月。容器尺寸变化及切页恢复后 SHALL 继续可滑动，恢复已保存的有效日期位置。

日历 SHALL 支持左右连续浏览前后月份及跨年，接近边界时补充相邻日期范围并保持视觉位置；不得仅用整页翻月或单独月份选择器代替连续滑动。补载失败 SHALL 保留已有内容并允许重试，不将未加载范围显示为已确认的零事项。年月定位和回今天 SHALL 可用，并有鼠标与键盘可操作方式。

过渡 Web 日历 SHALL 只呈现日期和每日事项数量，不复用公司页任务月历的事件条、跨度绘制、任务拖动、小时轴、日模式、密度调节、置顶、标签或审批能力；该绘制限制不禁止底层事项保存跨日起止日，各日期计数及清单 SHALL 包含覆盖当天的同一范围记录。左右滑动 SHALL 不误触日期清单；普通点击或键盘激活某天才打开当天清单。公司页月历的上下连续浏览 SHALL 保持。

本要求 SHALL 仅界定 A 阶段保留的 Web 过渡外观，不作为未来 Flutter 布局约束或纵向事项月历已交付的证明；最终 Flutter 的纵向连续月份、事项条及实际命中日清单 SHALL 由后续 B 单独规格化和验收。

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
A 阶段过渡 Web 每日事项日历 SHALL 在每个日期数字下最多显示一个数量标记，长度仅由当天全部事项总数决定，与是否完成无关。总数为零 SHALL 保留布局空间但不画标记；一条为圆点，二至四条逐渐加宽，五条及以上为固定最大宽度圆角条，标记高度始终一致。只要当天存在未完成事项，唯一标记 SHALL 为蓝色；当天总数大于零且全部完成时 SHALL 为灰色。混合状态 SHALL 合并为按总数绘制的一段蓝色标记，不并列显示蓝灰两段，不遮挡日期或相邻格。

数量 SHALL 覆盖当天全部事项，不仅统计已加载清单页；五条以上仅视觉宽度封顶，不截断数据或限制操作。日期可访问名称或等价文字 SHALL 提供完整日期及精确未完成/已完成数量，不能仅靠颜色表达状态。新增、完成/取消完成、修改日期和删除成功后 SHALL 更新所有受影响日期的标记。

范围事项 SHALL 在 startDate 到 endDate 的每个覆盖日计一次；openCount 包含未完成及逾期，completedCount 包含完成。过渡数量标记继续按是否全部完成着色，不覆盖详情的三态语义。数量和受影响日期 SHALL 从完整相交记录计算，修改范围/完成/删除后同时更新原范围与新范围；不能仅更新起点。此标记外观不约束后续 Flutter 事项条。

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

### Requirement: Daily-item lists details and reliable editing
点击任一天 SHALL 打开该日期事项清单弹层，显示日期、覆盖当天的全部事项的可分页/滚动列表、完成控件、必要新增及关闭操作；无事项 SHALL 显示空态并可按该日新增。清单 SHALL 同时保留完成及未完成事项，按创建时间升序、同值按事项标识稳定排序，切换完成状态不使条目跳位；行文本点击进入事项详情，完成控件不误触详情。

每日事项标题右侧的加号 SHALL 只打开每日事项创建界面，默认开始日和结束日均为选中日期、尚无选中日期时均用公司今天；起止日期可修改。加号 SHALL 与标题同一行，采用与年月/今天工具一致的圆角按钮形态，以有玻璃感的半透明薄荷绿填充及清晰高光/边框呈现，提供可读名称和可见键盘焦点；不得使用白色填充或继续悬浮在卡片右下方。标题栏入口 SHALL 在320宽窄屏仍可见可操作，不遮挡日期、导航或清单内容，日历底部不保留为旧悬浮按钮专用的空白区。表单 SHALL 仅要求起止日期和正文；详情可完成/取消完成、编辑起止日期/正文、经确认删除。所有操作 SHALL 使用真实事项标识。

详情返回 SHALL 恢复原日期清单及其滚动位置，清单关闭恢复过渡 Web 原日历日期、横向位置及触发焦点；支持按钮、返回/Esc及遮罩关闭且焦点不留在隐藏内容。事项移日后 SHALL 返回原日期清单并更新原范围与新范围的日期数量，不无提示跳到目标日。新增、编辑或完成失败 SHALL 保留草稿/原状态并提供重试，取消删除不写入。

更新与删除 SHALL 使用打开目标时取得的版本，版本冲突明确拒绝覆盖并允许回读处理；提交中防重复操作，响应丢失后的相同载荷重试 SHALL 不产生重复事项或重复状态变化。退出、会话失效或切账号 SHALL 清理每日事项缓存、草稿和弹层，旧请求不得覆盖新账号或新的日期查询。

清单/详情 SHALL 展示记录的完整起止范围及 completed/open/overdue 状态，单日可简写同一日；从覆盖日进入不把记录改成该日。新日期写入 SHALL 使用显式日期对，原行正文/完成独立更新不得丢范围；旧式 date 改期遇到跨日项 SHALL 明确冲突且不缩短记录。本人隐私、版本、幂等、纯文本和所有返回/焦点规则继续适用。A 阶段保留上述过渡外观，Flutter 最终清单/日历交互由 B 验收。

#### Scenario: Open an empty day and create with the floating button
- **WHEN** 用户选择无事项日期，再通过清单或每日事项标题右侧加号新增
- **THEN** 创建界面 SHALL 默认该日期，只需起止日期和正文，成功后清单和标记更新；从未选日期时默认公司今天，不创建任务

#### Scenario: Read every item and return through the layers
- **WHEN** 某日有超过一页事项，用户加载后打开详情并依次返回和关闭
- **THEN** 全部条目 SHALL 可达且不重复，完成项仍在原稳定位置，返回恢复列表滚动、日历横向位置和焦点

#### Scenario: Edit and delete only the selected item
- **WHEN** 多条内容相同的事项中用户编辑或确认删除一条，或取消删除
- **THEN** 保存/删除 SHALL 仅作用于所选真实标识，取消无写入；移日后返回原日期清单，原范围与新范围各日期标记正确

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

#### Scenario: Preserve a range when completing from a middle day
- **WHEN** 用户从跨日事项中间某天清单完成、取消完成、编辑正文或返回
- **THEN** 操作 SHALL 使用同一真实 ID 并保留完整起止日，所有覆盖日同步状态，返回仍是原命中日清单与位置

#### Scenario: Reject a stale single-date reschedule on a ranged item
- **WHEN** 未更新的旧页用 date 字段提交对当前跨日事项的改期
- **THEN** 服务 SHALL 返回 409 DAILY_ITEM_RANGE_REQUIRED，不改日期/正文/完成/版本，允许用户回读后使用完整日期对处理

### Requirement: Global task table sorting and counts
表单 SHALL 至少支持按名称、创建时间、开始、截止、紧急程度和执行状态的列头升降序排序并显示方向；默认开始升序，切换新列先升序，同列再次切换降序，同值始终按任务标识升序稳定排列。紧急程度升序 SHALL 为紧急/高/中/低，执行状态升序 SHALL 为待开始/进行中/已完成，原日历置顶 SHALL 不影响表格排序；独立表单置顶 SHALL 先将完整筛选结果分为置顶/非置顶两组，置顶组在前，每组再按当前列/方向和同值 ID 升序排序。筛选、表单置顶分组和组内排序 SHALL 在整个结果集完成后再分页，每页默认 50 条，改变条件/排序回第一页。

表单 SHALL 移除负责、创建、仅可见、待完成审核、已完成、逾期等分类统计展示及仅为该展示进行的无用计算；分页 SHALL 保留完整组合筛选结果总项数、当前页码及翻页操作。总数 SHALL 按任务标识跨日/跨分页去重，不随页大小和排序改变；完成待审仍属未完成，逐行逾期标记仍按当前时刻超过真实有效截止且未完成判断，不因移除统计改变过滤或任务状态。

#### Scenario: Sort all filtered rows before paging
- **WHEN** 超过两页 API 的授权任务分布着不同开始时间、同名、不同紧急程度及状态，用户分别切换六列排序并翻表格页
- **THEN** 各页连起来 SHALL 等于完整筛选结果的表单置顶分组及组内全局排序，同值按任务标识升序，方向可辨；日历置顶不改变该序列

#### Scenario: Count overlapping relationships without duplicate totals
- **WHEN** 唯一筛选结果是一个跨日、本人创建且负责的任务
- **THEN** 分页总数 SHALL 为1，行可保留负责与创建关系标记，不显示各分类统计，不因关系重叠或跨日重复计数

#### Scenario: Recompute counts after all filters
- **WHEN** 用户叠加名称、关系、完成和日期条件，随后翻页或改排序
- **THEN** 分页总数 SHALL 基于完整去重结果，翻页和排序不改变总项数，不展示或单独计算已移除分类统计

#### Scenario: Separate pending completion done and overdue
- **WHEN** 结果中有完成待审、已完成过截止和全天未到/已过有效截止任务
- **THEN** 完成待审 SHALL 仍属未完成，已完成不显示逾期，全天逐行逾期依有效截止判断；分类计数栏不再展示

#### Scenario: Pin a matching task from a later page
- **WHEN** 符合筛选的任务超过两页，用户将后页某项表单置顶并重新读取
- **THEN** 任务 SHALL 按置顶组及组内当前排序参与第一页到末页完整序列，不能只在原页前移，总数不变，不符合筛选的置顶项仍排除

#### Scenario: Keep calendar and table order independent
- **WHEN** 同一任务仅日历置顶、仅表单置顶、两者置顶或取消其中一种
- **THEN** 两种偏好 SHALL 独立保存，表单只受表单偏好分组影响，组内同值 ID 在两个方向均升序，不按最近置顶时间排序

### Requirement: Minimal profile page
“我的” SHALL 展示本人姓名、部门、职位、独立团队、直属上级和手机号，并展示由位置推导的四层身份，提供编辑本人头像/邮箱、修改密码、退出；姓名与手机号 SHALL 仅由管理员修改，本人字段不可借混合请求越权修改。组织及授权字段 SHALL 只能通过管理流程维护。管理层下属资料入口 SHALL 覆盖当前实际管理链全部直接和间接下级，不扩大资料范围或开放公司通讯录、资料卡派发按钮。人员详情 SHALL 按账户与联系方式规则独立检查手机号权限。日志 SHALL 继续独立鉴权，部门负责人含本部门全部下级、团队负责人含本团队员工，创始人含全公司。

页面 SHALL 移除员工团队管理入口，不展示员工用户名；创始人公司层、部门负责人部门层、团队负责人/普通员工部门与团队层 SHALL 分别按实际位置展示，不伪造缺失组织字段。手机号与邮箱仅本人及当前实际管理链上级在通过原资料详情授权后可读；目录不得成为全公司联系方式目录。

本人及下属人员资料 SHALL 在单公司场景移除“公司”资料行，仍按真实位置表达公司层/部门/团队。身份、职位、部门 SHALL 分别取实际组织数据，不能以职位推导身份、用团队替代部门或展示伪造的“员工 · 部门负责人 · —”。组织或资料更新后重新读取 SHALL 刷新已有人员，只有姓名的摘要不得覆盖完整资料，退出/切换账号及失权不得复用原人员联系方式或旧范围。

本人及授权下属详情 SHALL 增加由管理员维护的可空 hireDate 及统一 tenure（years/months/days/asOfDate）投影；员工只读，不用账号创建时间代替。缺失日期时显示“入职日期未设置”，不能虚构时长；公司今天计算完整经过的年、月、日，闰日/月末按合法周年和月锚点截月末，不用 365/30 换算。普通目录、下属树摘要、负责人候选 SHALL 不附带电话、邮箱、入职日或时长。

A 阶段过渡 Web SHALL 补齐上述详情字段和空态，既有组织身份/分散组织字段展示暂时保留；11 月 8 日指导中的隐藏组织身份与统一职务路径由后续 Flutter B 替换其呈现要求。内部组织身份与位置继续用于授权，不能改用职位名。

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

#### Scenario: Read contact details only inside the actual management chain
- **WHEN** 本人、实际直接/间接上级、同级、其他管理链或跨公司人员请求详情或普通摘要
- **THEN** 仅本人及通过原详情授权的实际链上级 SHALL 得到电话/邮箱和入职投影；其他人员不新增读取权，摘要及候选不带这些字段，失去链上资格后旧读取不得继续

#### Scenario: Calculate completed tenure at calendar boundaries
- **WHEN** 入职日为闰日/月末，今天位于周年前后或不同设备时区，或入职日为空
- **THEN** tenure SHALL 使用公司今天及约定的周年/月锚点算法，年/月/日均为完整经过量且不越过今天，缺失为 null，不采用固定天数折算

### Requirement: Strict prototype scope
A SHALL 以 2026-11-08 更改指导、Flutter 完整迁移盘点及本增量作为共享服务升级依据；本增量修改的规则取代旧冲突，未修改的完整员工业务继续有效，旧 PRD/旧清单只用于不冲突行为追溯。此前归档 change 不作为当前待完成事项。A 范围 SHALL 为共享后端/契约、数据迁移、必要独立 PC 管理维护、演示与安全 Web 过渡；完整 Flutter 员工客户端 SHALL 在后续 B 提出和实施，A 不创建 B。Android 套壳资源、Java 原生、Flutter 工程、安装包及设备交付不属于 A。

系统 SHALL 使用真实认证、持久化及事件调度验收，保留五个主页面、任务表单二级页、个人置顶、冲突建议和账户维护。旧 Android Web 套壳和安卓原生新版工程及其 UI/APK、系统推送、Android WebView/真机验收 SHALL 不纳入本次修改。时间选择业务控件 SHALL 使用 Web 实现并在移动浏览器验收；套壳未交付 SHALL 不作为本 change 完成或归档的前置阻塞，Web 证据 SHALL 不代表套壳或真机验证通过。员工停用及业务接管 SHALL 按本轮要求实施；请示回复、一人多团队、任务私人草稿、任务取消、公司草稿/定时发布、日志转待办、外部模型与 MBTI SHALL 继续不纳入本轮。

项目尚在开发且未交付，本轮 SHALL 直接统一新账号/API 契约并更新当前范围内使用方，不为旧员工 username 请求保留兼容入口。共用后端变更 SHALL 记录后续 Flutter 采用的完整员工契约及原业务回归，不以只交付 12 项增量代替完整迁移范围，也不能扩大为 A 内安卓实施任务。规划完成不等于代码、数据重建或整体验收通过，旧 PASS、已修复项和旧任务勾选不得代替本次共享契约升级的独立验证。

员工 Web SHALL 在 B 上线前保留安全过渡，不要求在 A 同步完成 12 项新的客户端交互；横向事项日历、首页卡片原交互、人员单月浏览及通知布局等尚未被 A 替换的 UI 不作为 Flutter 最终验收标准。系统推送继续延期，完整站内通知仍属于后续员工端必迁业务。A 的服务/浏览器证据 SHALL 不冒充 Flutter、WebView 或真机交付。

#### Scenario: Validate against the selected checklist
- **WHEN** 实施者或验证者检查本变更
- **THEN** 验收 SHALL 使用更改指导和本增量规格，不能要求旧周视图、受限创建派发或午夜冻结，也不能宣称尚未实施的 Flutter 已通过；静态示例、旧报告及任务勾选 SHALL 不替代当前真实服务证据

#### Scenario: Keep native Android outside the change
- **WHEN** 检查修改文件和交付记录
- **THEN** `android/` 和 `android-shell/` SHALL 均不在修改范围，资源同步、容器/桥接适配、APK 构建签名、升级及设备验证 SHALL 由后续 B 或各自明确的交付范围负责；共用后端兼容影响 SHALL 如实记录，不将移出范围的事项标为已交付或已验证

#### Scenario: Validate the real service and declared scope
- **WHEN** 实施者或验证者检查本变更
- **THEN** 验收 SHALL 使用更改指导和本增量规格，不能要求旧周视图、受限创建派发或午夜冻结，也不能宣称尚未实施的 Flutter 已通过；静态示例、旧报告及任务勾选 SHALL 不替代当前真实服务证据

#### Scenario: Inspect available actions
- **WHEN** 实施者或验证者检查本变更
- **THEN** 验收 SHALL 使用更改指导和本增量规格，不能要求旧周视图、受限创建派发或午夜冻结，也不能宣称尚未实施的 Flutter 已通过；静态示例、旧报告及任务勾选 SHALL 不替代当前真实服务证据

#### Scenario: Open the split static prototype
- **WHEN** 从文件系统打开旧静态页面或直接读取未构建脚本
- **THEN** 验收 SHALL 使用真实服务、认证、持久化及事件路径，静态内容不视为通过，本次按更改指导及本增量规格判定

### Requirement: Account password lifecycle
账号 SHALL 由管理员手动创建，不开放自助注册；员工使用本人手机号登录，独立管理员使用独立管理员账号名和密码模型。手机号 SHALL 统一规范化并在认证可识别范围唯一，不得歧义登录；非演示升级迁移保留员工 ID、原凭据和业务历史，组织关系按显式合法位置映射转换；非演示不得以新建任意账号替代原身份，演示库可按受控流程重建。管理员建号和管理员合法改号 SHALL 同步登录标识，空号与重复号有明确处理反馈。系统 SHALL 生成随机初始密码并强制首次改密；管理员重置密码 SHALL 再次强制改密。新密码 SHALL 至少 10 个字符、含字母与数字且 UTF-8 长度不超过 72 字节。强制改密会话 SHALL 仅可办理本人改密及退出，不能读取或修改业务数据；日常改密 SHALL 校验旧密码，成功后撤销包括当前会话在内的全部会话并要求重新登录。管理员 SHALL 可录入/覆盖员工手机号，并在本公司专用员工管理列表及详情读取完整登录手机号；普通目录和审计不得回显他人手机号；本人仅可编辑头像、邮箱和密码，姓名与手机号仅管理员可改。

按 2026-10-19 调整，员工业务中的手机号 SHALL 仅本人及实际管理链上的上级可见；本公司独立管理员另可通过员工管理列表及详情读取完整登录手机号；他人读取 SHALL 同时满足当前资料查看权、同组织有效人员关系及更高组织层级，且仅通过鉴权人员详情返回。邮箱 SHALL 仅本人，以及同时满足当前资料查看权、同组织有效人员关系和更高组织层级的实际管理链上级，在授权人员详情中可见；不因管理员身份自动开放业务邮箱。同级、下属、其他管理链或仅有公司/部门资料范围 SHALL 不因此取得手机号权；管理员仅通过专用同组织员工管理接口读取，不能扩散到业务目录。目录、任务人员摘要、日志筛选、通知、分析、审计、outbox 及普通人员缓存 SHALL 不含号码；历史通知只读例外 SHALL 不授予手机号权。

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
- **THEN** 本人 SHALL 可读自己的手机号；直属或间接上级 SHALL 仅在具有当前资料权且组织层级更高时可读下属号码；本公司管理员 SHALL 仅从专用员工管理列表/详情读取登录号，其余人不获得号码，业务资料权不足 SHALL 拒绝整个详情，邮箱 SHALL 仅本人及上述有权实际链上级在授权详情读取，同级、下属、其他管理链及普通目录不得获得邮箱

#### Scenario: Recheck the management chain after an organization change
- **WHEN** 员工转岗、管理关系变化、链上中间账号失效，或管理链出现环/跨公司引用
- **THEN** 后续人员详情请求 SHALL 按当前有效关系鉴权，旧上级及无法证明有效上级关系者 SHALL 不再获得号码或邮箱；旧页面或缓存 SHALL 不构成继续读取的凭据

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

#### Scenario: Keep subordinate email out of summaries
- **WHEN** 实际链上级读取授权下属详情，再读取树、负责人候选、任务参与人摘要，或同级/其他链用户读取该人员
- **THEN** 邮箱 SHALL 仅在当前有权详情出现；所有普通摘要和候选不附带邮箱，其他链/同级无邮箱读取权，账号或组织变化后不得从旧缓存恢复

### Requirement: Organization and administration
系统 SHALL 提供独立 PC 浏览器 Web 管理端（`/admin.html`），仅独立管理员可维护员工、部门、团队、负责人、展示职位和人员位置，并查询完整任务历史、维护公司信息与通知。组织 SHALL 固定为一位 Founder → 每部门一位 Department Head → 每团队一位 Team Head → Employee；每人仅一个位置，不兼任、副职、联合负责人或多管理链，普通员工必须归团队、团队必须归部门。直属上级和层级 SHALL 从位置唯一推导，创始人身份有明确固定依据，不用任意无上级根节点猜测；普通管理流程不提供创始人交接、调任或停用。创始人为公司层、部门负责人为部门层、团队负责人及普通员工为部门团队层；所有业务员工职位必填且仅用于展示，不作为授权来源。每公司一位独立管理员，不占员工位置且无默认员工业务权。

员工 App SHALL 保持五个主导航且不嵌入完整管理员维护模块，管理员入口提示 SHALL 指向真实 PC 管理端。管理端能在窄屏打开不改变其 PC Web 交付定位；管理员身份 SHALL 不自动授予员工业务权限，业务账号直连管理 API SHALL 仍被拒绝。

创建部门/团队 SHALL 同时安排有效负责人，负责人可为首位且唯一成员；可在编辑草稿准备完整方案，正式保存不得出现无人负责单位。新员工 SHALL 同时提交合法位置与职位；调岗直接切换，更换负责人同时安排新旧负责人和下属，删除单位或停用负责人前处理全部去向、继任及业务责任。跨多人/单位调整 SHALL 校验完整最终结果后原子提交，失败保留原组织；并发版本与唯一性校验 SHALL 防止双负责人、无人负责、跨部门团队、环和悬空链，权限版本及待审刷新同事务完成，读取只观察合法旧/新状态。

系统 SHALL 删除“角色与授权”、自定义业务范围及员工团队管理入口，不以可编辑旧角色、能力、等级作为第二权限来源；固定四层标记仅可展示。员工直接调用旧团队/组织/授权写入口 SHALL 被后端拒绝。

管理员 SHALL 在正式 PC 员工新增、完整组织计划中的新员工及既有员工编辑入口维护可空真实 hireDate。合法 ISO 日期不得晚于公司今天；省略字段保留既有值，新员工缺省/显式 null 表示未设置，管理员可清除。存量未知日期 SHALL 保持 null，不由账号创建时间填造。日期提交 SHALL 与其他创建/资料字段一起版本校验、原子保存；员工本人和业务管理者不得维护，非法或旧版本输入不部分写入、不半建账号。

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

#### Scenario: Maintain hire dates through every formal PC employee path
- **WHEN** 管理员通过正式 PC 组织草稿新增员工、直接创建 API 或既有员工编辑保存/清除 hireDate
- **THEN** 各路径 SHALL 使用同一日期规则，省略保留、null 清除、未来/非法日期拒绝，回读与本人/授权下属详情一致；组织/位置不变量和初始密码一次回显不变

#### Scenario: Keep hire-date updates atomic and administrator-only
- **WHEN** 管理员以旧版本提交姓名/日期或完整建号计划中有非法日期，或员工/其他公司请求维护
- **THEN** 系统 SHALL 拒绝且不部分修改或建号，既有凭证、原始时间及组织关系不被日期字段绕过，员工读接口只读

### Requirement: Persistent demonstration data for web and administration
系统 SHALL 准备手机号登录的员工演示账号及后端持久数据，按新固定组织重建演示身份与组织关系，业务使用稳定内部标识；十大公司重要事项为十条并能展示列表和卡片等样式，业务数据覆盖通知、待审核、任务表单、部门团队及下属日志任务，足以展示筛选、排序及布局，超两页分页由独立极限夹具验证。同一账号 SHALL 按真实权限连续展示表单与下属日志任务，刷新仍可用，不用前端静态假数据替代，不按记录日期推算新演示日期。

演示组织 SHALL 含固定创始人、至少两个部门且每部门多个团队、完整单负责人/普通员工及必填职位/有效手机号，独立管理员不占员工位置。任务 SHALL 覆盖跨部门多负责人、仅创建不负责、专用交接及正式接管；审核覆盖全操作的操作者直属上级、固定创始人免审直接生效、拒绝、撤销、失效、完成/重开。

默认演示排期 SHALL 以近期连贯业务及少量跨日/周/月为主；跨年、午夜截止、零时长、整日覆盖、超过五项重叠及超两页表单 SHALL 由可单独运行的隔离极限夹具覆盖，不向默认单个员工集中灌入上百条测试任务。日志 SHALL 覆盖部门/团队直接及间接下属、近三天、冻结/删除重建；标签/评论/通知含撤权边界。准备流程 SHALL 显式指定目标演示库，可重复执行而无重复/非法组织，不在应用启动时清空任意数据库；刷新及重启后数据持久。演示重构可替换旧数据，但不是结构约束或升级验证的替代。

默认演示 SHALL 以动画公司项目串联真实四层主角：upper 苏景昕 → middle 苏格拉底 → product-head-1 柏拉图 → employee 亚里士多德，沿用稳定真实账号/内部标识及对应原演示身份。每人约 10–20 条有意义任务作为起点，四人均有自己的事项、近期日志、通知及真实审批/执行流程，其他人员保留合法位置而不专门填充个人业务。共享事件纪、部门/团队/职位和正文 SHALL 与动画主题一致，不用“分页事项/接口检查/待审”等测试或纯状态词拼接冒充默认业务名。

准备 SHALL 指定演示目标库、可重复且不覆盖已有业务修改，普通启动/重启不清库、不随日期重写现有业务。替换旧演示内容只经显式演示重建操作；结构迁移不执行内容重建。默认主线和极限/越权夹具 SHALL 分离，旧有多页/密集/权限验证不能因演示改造而删除。

#### Scenario: Run a continuous demo after refresh
- **WHEN** 选定手机号账号登录后展示首页、通知、审核、表单和下属日志任务并刷新
- **THEN** 同一账号 SHALL 有对应合法数据权限，十条公司事项及业务数据仍在，可实际筛选排序分页，不需伪造身份

#### Scenario: Prepare a complete repeatable new-model demonstration
- **WHEN** 在显式指定的演示库连续准备两次并重启，使用四层账号及独立管理员展示
- **THEN** 系统 SHALL 不重复插入，默认主线的规定组织、审核、接管和日历用例可实际操作，独立极限夹具可验证超过两页表单，标签/评论/通知/日志及十条公司事项持久，无前端伪造身份或静态结果

#### Scenario: Follow the four real animation roles
- **WHEN** 四位主角依次真实登录展示自己工作、逐级派发/进展/审核、下属资料和公司事件纪
- **THEN** 姓名/位置/职位/上级链及稳定账号 SHALL 来源于持久数据，各人有连贯业务及合法本人数据，不能前端假改身份/姓名或用虚假状态替代真实申请

#### Scenario: Preserve edits and keep extreme fixtures separate
- **WHEN** 在显式演示库准备两次、修改一条业务再重启，并另外运行多页/密集场景
- **THEN** 普通准备/重启 SHALL 不覆盖修改或重复插入，极限数据仅在隔离夹具出现，默认四人仍各约 10–20 条有意义任务，结构迁移和普通启动不重置演示库

## ADDED Requirements

### Requirement: Range daily-item retrieval and legacy compatibility

系统 SHALL 提供本人事项的覆盖日及 from/to 相交读取，含完成项、原始完整起止日与真实 ID，稳定按 createdAt/id 升序分页。覆盖日读取用 date；from/to 两端均必填、与 date 互斥且窗口最多 93 天，窗口不限制记录自身跨度。响应含 items/total/limit/offset/nextOffset、查询范围、公司业务日期及时区，计数覆盖完整结果。新写入用 startDate/endDate/body，旧 date/body 映射单日；混合格式、缺端点、非法/倒置日期 400。PATCH 日期对一起提供或省略；旧 date 改期跨日项 409 DAILY_ITEM_RANGE_REQUIRED 且不部分写入；现有版本/幂等/本人同组织权限继续适用。

#### Scenario: Read all intersections across month boundaries
- **WHEN** 查询范围内有开始早于窗口、结束晚于窗口、已完成和超一页的本人事项
- **THEN** 全部相交记录 SHALL 可分页读完、单页不重复且返回原完整日期对，total 精确，范围外/他人记录排除

#### Scenario: Enforce bounded valid queries without truncating records
- **WHEN** 用户查询超过 93 天、混合 date/from/to、缺端点、倒置或非法日期，或在合法窗口查很长跨度事项
- **THEN** 非法请求 SHALL 400 拒绝；合法相交事项不得因自身超过 93 天被丢弃，失败不返回空成功

#### Scenario: Keep legacy single-day writes safe
- **WHEN** 旧式请求创建或修改单日项，随后同一项已被合法扩为多日又收到旧 date 改期
- **THEN** 前者 SHALL 等价保存单日，后者 409 拒绝且保留完整原状态；仅改正文/完成并省略日期仍可保留范围

#### Scenario: Retain current concurrency and ownership fences
- **WHEN** 同项旧版本修改、同键网络重试、跨账号/跨公司按 ID 或范围请求
- **THEN** 服务 SHALL 按既有版本/幂等/当前授权裁决，不重复创建、不覆盖新版、不泄露他人事项或计数

### Requirement: Server-side personal task table query

GET `/tasks/table` SHALL 提供原始创建或当前负责且有正常读取权的已发布有效任务并集，排除仅组织/下属可见、未发布及历史通知例外。参数支持 relation、completion、q、单端 from/to、六种 sort、direction、limit/offset，默认 all/all/全部日期/startAt/asc/50，limit≤100；未知或非法参数 400。系统先授权/关系限域，再完整筛选/去重，按 tablePinned 分组及六列稳定排序，计数后分页；行含 tablePinned/canTablePin，不含未授权提议/diff。名称用固定简体中文 Java Collator（TERTIARY、CANONICAL_DECOMPOSITION），数字按文本、同值 ID 升序；Web/Flutter 消费同一顺序，过渡 Web 不再局部重排当前页。

#### Scenario: Sort Chinese and mixed titles consistently
- **WHEN** 多页结果含“阿”“波”“分镜2”“分镜10”、a/A、规范等价文本及同名异 ID，客户端设备语言不同
- **THEN** 同一请求 SHALL 得到固定中文比较器顺序，“阿”在“波”前、“分镜10”在“分镜2”前；降序只反转标题比较，同值 ID 仍升序，置顶分组和分页不改变比较规则

#### Scenario: Search and pin beyond the first backend pages
- **WHEN** 个人任务超过 100 条，名称命中或置顶任务在后续页，并组合关系/完成/日期条件
- **THEN** 服务 SHALL 在完整个人结果处理全部条件和置顶分组，所有页拼合等于全局正确序列，total 不随页大小/排序变化

#### Scenario: Separate creation provenance and normal visibility
- **WHEN** 当前用户可见原创建、当前负责、接管但未创建未负责及仅下属四类任务
- **THEN** 表单 SHALL 仅包含前两类且并集去重，正式接管不改我创建，普通通用任务读取仍按原权利

#### Scenario: Preserve effective data during review
- **WHEN** 多字段/排期待审、完成待审和未发布创建并存
- **THEN** 已发布行 SHALL 返回旧有效资料及冻结，完成待审仍 unfinished，未发布不入结果，提议和专用 diff 不泄露

#### Scenario: Revalidate cached pins and query permissions
- **WHEN** 负责人或正常查看权被移除、账号切换，或客户端重取多页表单
- **THEN** 每次查询 SHALL 使用当前授权，残留偏好不恢复任务，失败不得作为部分全量成功；过渡 Web 丢弃旧账号/旧查询响应

### Requirement: Independent personal task table pin

个人表单置顶 SHALL 独立于日历 pin 持久化，只影响本人表单完整筛选结果的分组，不改变其他用户、任务排期/紧急度/版本/审核。PUT/DELETE `/tasks/{id}/table-pin` SHALL 设置/清除本人 tablePinned，使用当前认证及幂等键，返回 taskId/tablePinned，不要求任务 If-Match。当前正常发布且可读、本人原始创建或当前负责的任务（含完成及已有有效版待审）才有资格；残留偏好不是授权。

正常任务详情/表单 SHALL 提供独立 tablePinned/canTablePin，原 pinned/canPin 保持日历语义。历史通知例外和下属嵌套只读浏览 SHALL 不提供表单置顶动作；原日历置顶仍只限本人负责。两种状态刷新/重登后独立保持，不新增按置顶时间排序或收起置顶组。

#### Scenario: Pin a created but unassigned task only in the table
- **WHEN** 本人原创建且仍正常可读，但当前不是负责人
- **THEN** 表单置顶 SHALL 可用并持久化，月视图置顶仍拒绝，任务不因此加入本人日历

#### Scenario: Keep preference writes separate from business mutations
- **WHEN** 用户设置/清除任一种置顶并以同键重试
- **THEN** 两种偏好 SHALL 不联动，不改任务版本、不建申请/通知，重复操作不产生重复偏好

#### Scenario: Never regain access from a stale pin
- **WHEN** 当前资格被撤销后重试旧置顶请求或通过历史通知/下属只读路径打开
- **THEN** 服务 SHALL 重验资格并拒绝不合法写入，安全投影/客户端路径不提供动作，查询不恢复失权任务

### Requirement: Read-only log date fill source

GET `/work-logs/fill-source?businessDate=D` SHALL 只供当前有效员工读取指定合法公历业务日的本人完整名称源，不接受 userId，不受日志创建近三日窗口限制；能否追加仍按日志当前写权限，前天补写后次日未满 24 小时的合法编辑仍可读取。响应含业务日/公司时区、dailyItems/tasks 两组 id/name 与 complete=true；不分页截断、不省略完成项、不因日志 10000 UTF-16 上限截短或放宽写入，无数据为空组，任一读取失败为整体错误。事项取覆盖 D 的本人记录并用完整纯文本 body；任务取正常发布、本人当前有效负责且有效时段覆盖 D 的任务并用有效标题，按真实 ID 去重；旧全天首尾包含，定时按半开区间，午夜不多算次日，零时长归所在日，组内稳定升序。接口纯读取，不修改正文/关联/完成/冻结/审批。

#### Scenario: Read a backfilled day and include completed work
- **WHEN** 今天读取昨天或前天的日志填充源，存在跨日事项/任务及完成项
- **THEN** 服务 SHALL 按指定日志日返回所有覆盖项并各按 ID 去重，不误用今天或仅返回未完成/首屏

#### Scenario: Respect midnight point and effective-version semantics
- **WHEN** 任务午夜截止、零时长、旧全天或排期待审
- **THEN** 名称集合 SHALL 按实际有效覆盖计算，午夜无次日项、点任务归该日、全天首尾包含，不使用提议排期

#### Scenario: Fail safely without granting edit or foreign access
- **WHEN** 请求带 userId、缺失/非法日期、管理员/失效身份，或任一源读取失败
- **THEN** 请求 SHALL 拒绝或整体错误，不泄露他人数据、不返回 complete=true 的部分结果，日志/事项/任务状态不变

#### Scenario: Keep a still-editable backfilled log usable after midnight
- **WHEN** 前天的日志在昨天才首次创建，今天已不属于可新建近三日但仍未满真实 24 小时
- **THEN** 名称源 SHALL 仍能按该日志 businessDate 返回，不能以新建窗口阻止合法编辑填充，也不因此延长日志冻结时间

### Requirement: Complete employee client contract handoff

A SHALL 提供以完整迁移盘点 90 项和现有 54 条需求为索引的交接材料，逐项说明现有接口/权限/分页/日期、A 增量、PC 保留及 B 呈现责任，包含可对照真实服务的脱敏示例与适用检查。认证强制改密、任务字段/审批/交接/来源、日志唯一/首次24h、多标签/评论、通知原申请绑定/历史例外、下属只读和统计建议等既有能力 SHALL 保留，不因未新增接口从迁移范围消失。

错误与写入文档 SHALL 说明既有 Bearer、If-Match/版本、同操作重试幂等键、当前授权重验，以及任务 offset 字符串 cursor、评论 ID cursor、其他 nextOffset 的区别。A SHALL 验证受影响服务和 Web/PC 过渡的真实请求及失败路径，不把历史 PASS、静态示例、后端检查或 Web 截图当 Flutter/安卓安装证据。交接不得保存会话 token、密码或真实私密联系方式。

#### Scenario: Account for every baseline and new behavior
- **WHEN** A 的交接材料和检查报告被用于准备 B
- **THEN** 90 项及 54 条映射 SHALL 均有明确落点/责任，12 项增量有服务或 B 呈现去向，不能把原有审批/交接/评论/分析等留作无记录的以后补充

#### Scenario: Preserve representative baseline regressions
- **WHEN** 新增范围/表单/资料/演示后对当前真实服务回归
- **THEN** 认证、字段权限/原子审批/路由、到期/提醒、交接/接管、日志冻结、多标签/评论、通知生命周期、下属只读、统计及 PC 组织不变量 SHALL 仍满足未修改的主规格，并记录本次实际证据及适用范围
