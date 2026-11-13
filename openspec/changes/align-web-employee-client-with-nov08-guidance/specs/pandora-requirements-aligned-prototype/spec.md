## MODIFIED Requirements

### Requirement: Three-section home dashboard
首页 SHALL 仅保留事件纪、任务看板、每日事项三个内容模块；事件纪上方左侧，任务看板上方右侧，每日事项通栏位于两者下方。首页 SHALL 无个人日志卡片或第四块空占位，不删除日志及日志页功能。上方两卡 SHALL 各显示约三条普通条目的少量预览，不提供内部纵向滚动；长标题可换行，在卡片上纵向滑动 SHALL 滚动整个首页。点击卡片含预览内容 SHALL 先打开对应完整二级清单，更多内容在弹窗内滚动，不增加明显“更多”入口或“点击查看清单”等教学文案。每日事项 SHALL 使用独立纵向连续月历，短屏全部模块、标题栏加号及导航可达，不以缩小交互目标获得空间。

事件纪 SHALL 仅更改员工首页原公司事项的名称；公司信息仍最多十条、按管理端设置顺序只读展示，包括上层无员工端维护入口，管理员的新增、修改、删除及调序规则保持。

任务看板 SHALL 展示本人当前为有效负责人、已正常发布且未完成的任务，不考虑创建者是谁，包含本人创建并负责的任务；仅创建而非当前负责、负责人已移除、已完成、待创建/未发布及仅有历史通知只读访问的任务 SHALL 排除。结果 SHALL 按实际派发给本人的时间倒序、同时间按任务标识升序稳定取最多十项，不按创建时间、紧急程度或截止排序；每任务只出现一次。条目 SHALL 只显示标题和右对齐紧急程度，点击卡片预览先进入清单，再点击清单任务进入原鉴权详情，返回恢复原清单位置。长标题及窄屏 SHALL 不遮挡紧急程度。

首页日期区域 SHALL 不恢复重复的“新建任务”按钮或其占位；公司页原任务创建加号保持，每日事项加号只创建每日事项。每日事项 SHALL 由下述独立要求约束，替代原个人信息列表及十条上限。

#### Scenario: Render three modules in their intended positions
- **WHEN** 用户进入首页
- **THEN** 事件纪和任务看板 SHALL 保留原左右位置，每日事项位于下半部分并横跨两列，无个人日志卡片或旧第四模块占位

#### Scenario: Scroll home modules independently
- **WHEN** 上方内容超过预览数量或用户在卡片上纵向滑动后点击预览
- **THEN** 本轮 SHALL 以首页整体滚动和独立二级清单替换原卡片内部滚动：滑动滚动首页且不误开内容，点击卡片先开对应完整清单，卡片无内部滚动，紧凑屏幕全部内容可达

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
- **THEN** 任务项 SHALL 仅展示标题和完整右侧紧急程度，经清单进入原详情，事件纪无员工编辑删除入口

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
- **THEN** 两张上方卡片 SHALL 各显示约三条完整普通预览，标题不计入条目数，更多内容在二级清单访问；短屏可滚动首页访问事项月历及导航

#### Scenario: Keep the daily header compact
- **WHEN** 用户查看每日事项标题和日历
- **THEN** 标题及其右侧新增按钮与月份工具 SHALL 在同一标题行，标题下无重复年月副标题，卡片右下无悬浮新增按钮及其专用空白区

#### Scenario: Restore the board list after detail
- **WHEN** 用户从任务看板清单中间进入详情、返回后关闭清单
- **THEN** 系统 SHALL 恢复原清单及首页位置，仍使用原最多十项范围和派发顺序，不扩大为全部任务表单

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
- **THEN** 系统 SHALL 仅更新该标识事项，不再覆盖的日期清单移除、新覆盖日期清单出现，涉及日期事项条、状态及清单同步，刷新保持，其他事项不受影响

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

### Requirement: Daily-item lists details and reliable editing
点击日期数字、空白、事项条或溢出入口 SHALL 先打开命中日期事项清单弹层，显示日期、覆盖当天全部事项的可分页/滚动列表、完成控件、必要新增及关闭操作；无事项 SHALL 显示空态并可按该日新增。清单 SHALL 含完成及未完成事项，按创建时间升序、同值按事项标识稳定排序，按真实ID去重，切换完成不跳位。跨日条 SHALL 以实际命中位置对应日期开清单，不固定使用开始日；文本点击才进入详情，完成控件不误触详情。

每日事项标题右侧的加号 SHALL 只打开每日事项创建界面，默认开始日和结束日均为选中日期、尚无选中日期时均用公司今天；起止日期可修改。加号 SHALL 与标题同一行，采用与年月/今天工具一致的圆角按钮形态，以有玻璃感的半透明薄荷绿填充及清晰高光/边框呈现，提供可读名称和可见键盘焦点；不得使用白色填充或继续悬浮在卡片右下方。标题栏入口 SHALL 在320宽窄屏仍可见可操作，不遮挡日期、导航或清单内容，日历底部不保留为旧悬浮按钮专用的空白区。表单 SHALL 仅要求起止日期和正文；详情可完成/取消完成、编辑起止日期/正文、经确认删除。所有操作 SHALL 使用真实事项标识。

详情返回及完成操作后 SHALL 恢复原日期清单及滚动位置，清单关闭恢复原日历日期、纵向月份位置及触发焦点；支持按钮、返回/Esc及遮罩关闭且焦点不留在隐藏内容。事项移日后 SHALL 返回原日期清单，更新原范围与新范围的事项条、状态和清单，不无提示跳到目标日。新增、编辑或完成失败 SHALL 保留草稿/原状态并提供重试，取消删除不写入。

更新与删除 SHALL 使用打开目标时取得的版本，版本冲突明确拒绝覆盖并允许回读处理；提交中防重复操作，响应丢失后的相同载荷重试 SHALL 不产生重复事项或重复状态变化。退出、会话失效或切账号 SHALL 清理每日事项缓存、草稿和弹层，旧请求不得覆盖新账号或新的日期查询。

清单/详情 SHALL 展示记录完整起止范围及 completed/open/overdue 状态，单日可简写；从覆盖日进入不把记录改成该日。新日期写入 SHALL 使用显式日期对，正文/完成独立更新不丢范围；旧式 date 改期遇跨日项明确冲突且不缩短。本人隐私、版本、幂等、纯文本和返回/焦点规则继续适用。本要求适用于本次员工Web，Flutter独立验收。

#### Scenario: Open an empty day and create with the floating button
- **WHEN** 用户选择无事项日期，再通过清单或每日事项标题右侧加号新增
- **THEN** 创建界面 SHALL 默认该日期，只需起止日期和正文，成功后清单和事项条更新；从未选日期时默认公司今天，不创建任务

#### Scenario: Read every item and return through the layers
- **WHEN** 某日有超过一页事项，用户加载后打开详情并依次返回和关闭
- **THEN** 全部条目 SHALL 可达且不重复，完成项仍在原稳定位置，返回恢复列表滚动、日历纵向位置和焦点

#### Scenario: Edit and delete only the selected item
- **WHEN** 多条内容相同的事项中用户编辑或确认删除一条，或取消删除
- **THEN** 保存/删除 SHALL 仅作用于所选真实标识，取消无写入；移日后返回原日期清单，原范围与新范围各日期事项条及状态正确

#### Scenario: Preserve drafts and reject stale versions
- **WHEN** 保存遇到网络错误、版本冲突或其他会话已修改/删除目标
- **THEN** 系统 SHALL 保留当前草稿并明确反馈，不静默覆盖新版本、不把编辑转为新增，相同请求重试不会重复创建或重复执行

#### Scenario: Isolate sessions and out-of-order responses
- **WHEN** 用户快速切换日期或在请求未完成时退出、失效及切换账号
- **THEN** 系统 SHALL 清除旧账号事项及草稿，丢弃过时响应，当前日期清单不会被另一日期结果覆盖

#### Scenario: Keep controls usable on compact screens
- **WHEN** 用户在320、390及1440宽度、较矮窗口使用日历、清单、详情和表单
- **THEN** 七列星期及纵向月份 SHALL 可达，长文本可换行，标题栏加号和保存/返回不遮挡内容及导航，键盘操作与焦点恢复可用

#### Scenario: Create from the mint glass header control
- **WHEN** 用户在320、390或1440宽度查看每日事项，并通过点击或键盘激活标题右侧的新增按钮
- **THEN** 按钮 SHALL 与标题同一行，使用与年月/今天一致形态及可辨的半透明薄荷绿填充，打开原每日事项创建表单；取消或保存后按原流程返回并恢复正确焦点，不在卡片底部留下浮动按钮或专用空白区

#### Scenario: Preserve a range when completing from a middle day
- **WHEN** 用户从跨日事项中间某天清单完成、取消完成、编辑正文或返回
- **THEN** 操作 SHALL 使用同一真实 ID 并保留完整起止日，所有覆盖日同步状态，返回仍是原命中日清单与位置

#### Scenario: Reject a stale single-date reschedule on a ranged item
- **WHEN** 未更新的旧页用 date 字段提交对当前跨日事项的改期
- **THEN** 服务 SHALL 返回 409 DAILY_ITEM_RANGE_REQUIRED，不改日期/正文/完成/版本，允许用户回读后使用完整日期对处理

#### Scenario: Open a continued item at its actual hit date
- **WHEN** 用户点击跨周或跨月事项续接条中间某天，再完成事项或进入详情返回
- **THEN** 系统 SHALL 先开实际命中日完整清单，完成只改变同一真实记录，文本点击才进入详情，完成及返回保持清单位置

### Requirement: Personal work logs
日志 SHALL 归作者并按公司业务日期同人同日唯一，新建允许公司今天、昨天、前天，不允许更早或未来；写日志 SHALL 只提供近三天尚未创建且可创建的日期，不提供独立补写按钮；已有日期不进入创建选择，三天均已有日志时提示从详情编辑。编辑 SHALL 通过显式日志标识进入，重复创建冲突不得自动转为编辑或覆盖原记录。日志创建后 SHALL 不改业务日期。冻结 SHALL 为真实首次创建时间加 24 小时，编辑不重置计时，服务端达到冻结点立即只读，跨零点不提前冻结。编辑和删除 SHALL 仅作者且共用该窗口，删除重建 SHALL 不重置首次创建时间或清除同人同日冻结约束。

前后端 SHALL 一致显示可编辑性、冻结时间和重复/到期反馈，旧页面到期提交及并发 SHALL 不绕过限制；存量日志保留真实创建时间，冻结和他人日志不显示正文编辑/删除。新建编辑 SHALL 保留全屏表单、伸展正文和可达保存/返回/关闭，离开恢复其他弹层布局。

日志 SHALL 可选关联一项作者当前正常可见任务，支持名称搜索、空结果和清空，关联详情独立鉴权。创始人看公司、部门负责人看本人及本部门全部直接/间接下属、团队负责人看本人及本团队员工、普通员工看本人，上级不能编辑正文，同团队/同任务不授予日志权；关联任务失权 SHALL 裁剪跳转但保留有权正文。标签 SHALL 同受日志编辑冻结规则，独立评论按评论要求处理。

日志日期转换 SHALL 使用日志模块可访问的统一公司业务日期方法，不依赖日程私有函数或偶然脚本加载顺序。详情“编辑日志” SHALL 传入真实日志标识，写日志及关闭保存入口操作和样式正确；从人员资料进入目标日志 SHALL 使用独立人员工作页/详情按当前日志权限查询，不修改本人日志页范围或恢复旧人员筛选。

Web本人及合法人员阅读入口复用的日志卡片 SHALL 显示完整所属日期（如“2026年11月6日”），今天/昨天/前天按businessDate与公司今天比较。列表 SHALL 按businessDate从新到旧，同日按真实创建时间倒序及ID稳定排序；补写旧日志不因创建较晚提前。详情继续明确显示真实创建时间，首次24小时冻结不变。

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

#### Scenario: Display and sort a backfilled log by business date
- **WHEN** 今天晚些时候补写前天日志，从本人或合法人员阅读入口查看
- **THEN** 卡片 SHALL 显示前天完整所属日期和相对日，排在昨天和今天之后，详情显示真实创建时间，编辑窗口仍从真实首次创建起算

### Requirement: Minimal profile page
“我的” SHALL 展示本人姓名、部门、职位、独立团队、直属上级和手机号，隐藏与职位混淆的组织身份展示，提供编辑本人头像/邮箱、修改密码、退出；姓名与手机号 SHALL 仅由管理员修改，本人字段不可借混合请求越权修改。组织及授权字段 SHALL 只能通过管理流程维护。管理层下属资料入口 SHALL 覆盖当前实际管理链全部直接和间接下级，不扩大资料范围或开放公司通讯录、资料卡派发按钮。人员详情 SHALL 按账户与联系方式规则独立检查手机号权限。日志 SHALL 继续独立鉴权，部门负责人含本部门全部下级、团队负责人含本团队员工，创始人含全公司。

页面 SHALL 移除员工团队管理入口，不展示员工用户名；创始人公司层、部门负责人部门层、团队负责人/普通员工部门与团队层 SHALL 分别按实际位置展示，不伪造缺失组织字段。手机号与邮箱仅本人及当前实际管理链上级在通过原资料详情授权后可读；目录不得成为全公司联系方式目录。

本人及下属人员资料 SHALL 在单公司场景移除“公司”资料行，仍按真实位置表达公司层/部门/团队。内部身份、职位、部门 SHALL 分别取实际组织数据，不能以职位推导身份、用团队替代部门或展示伪造的“员工 · 部门负责人 · —”。组织或资料更新后重新读取 SHALL 刷新已有人员，只有姓名的摘要不得覆盖完整资料，退出/切换账号及失权不得复用原人员联系方式或旧范围。

本人及授权下属详情 SHALL 增加由管理员维护的可空 hireDate 及统一 tenure（years/months/days/asOfDate）投影；员工只读，不用账号创建时间代替。缺失日期时显示“入职日期未设置”，不能虚构时长；公司今天计算完整经过的年、月、日，闰日/月末按合法周年和月锚点截月末，不用 365/30 换算。普通目录、下属树摘要、负责人候选 SHALL 不附带电话、邮箱、入职日或时长。

员工资料界面 SHALL 隐藏组织身份，包括本人组织信息、下属树、下属资料卡及人员日程/日志工作页。下属树姓名下、资料卡原分散组织/职位信息和人员工作页姓名下 SHALL 统一为真实“部门 ▸ 团队 ▸ 职位”路径；分隔符为朝右小实心三角，末端为实际职位名，缺层省略，不伪造部门、团队、公司层占位或身份，不显示原始空值，不提供路径逐级跳转，窄屏长路径可读。本人组织信息其余不冲突字段继续可读。内部组织身份与位置继续用于授权，不能改用职位名。

本人联系电话、邮箱下方 SHALL 显示“已入职”时长；下属资料卡 SHALL 同样显示联系电话、邮箱、已入职，合法可读字段缺失时显示对应未填写/未设置空态，不因空值隐藏整行，不把联系方式放进人员树。

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

#### Scenario: Hide identity while retaining actual organization and permissions
- **WHEN** 本人或下属资料、下属树和人员工作页存在完整或缺层组织数据
- **THEN** 界面 SHALL 无组织身份，下属相关位置显示真实部门 ▸ 团队 ▸ 职位，缺层省略，不以身份冒充职位，内部授权和管理员维护权限不变

#### Scenario: Show empty subordinate contacts and tenure
- **WHEN** 合法上级打开电话、邮箱或入职日期为空的下属资料
- **THEN** 详情 SHALL 分别显示对应未填写/未设置空态，有入职日时沿用本人统一算法，普通树摘要仍无联系方式

### Requirement: Strict prototype scope
本次员工Web改造 SHALL 以2026-11-08更改指导及本增量为准，替换横向事项日历、数量标记、卡片内滚动及其他本轮冲突呈现，未修改业务继续有效。历史PRD、归档A与旧PASS仅作追溯，不代替当前证据；既有Flutter change不作为本次Web交付前置条件。

系统 SHALL 使用真实认证、持久化及事件调度验收，保留五页、任务表单二级页、两种独立置顶、冲突建议、账户维护、停用及正式接管。实施范围 SHALL 为根目录员工前端及确有必要的backend服务修复、演示数据、检查和资源打包；flutter/、android/、android-shell/、桥接、APK构建签名、系统推送均不修改，不重做PC管理端。时间控件 SHALL 使用Web实现，在桌面与手机浏览器验证；震动能力、实际触摸和WebView/APK交付分别报告，无震动能力时保留视觉反馈并记录设备限制，不新增桥接。桌面模拟、API调用成功和Web截图不证明真机震动或套壳交付。请示回复、一人多团队、任务私人草稿、任务取消、公司草稿/定时发布、日志转待办、外部模型与MBTI继续不在本轮。

本轮 SHALL 保持A已交付共享契约兼容，退休员工username登录不得恢复；确有后端修复才最小调整并回归受影响原业务，不把日视图边界施加到通用排期。不改历史归档或现有Flutter change，不以本次Web验收宣称完整Flutter迁移完成。规划、数据准备说明及任务勾选 SHALL 不代替当前独立验证。

本次员工Web SHALL 按本增量交付12项指导的范围内行为，不再以A阶段保留过渡外观作为缺失交互的豁免；本轮未实施的Flutter、桥接和安装包能力继续独立交付。系统推送仍延期，完整站内通知保留。

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

### Requirement: Persistent demonstration data for web and administration
系统 SHALL 准备手机号登录的员工演示账号及后端持久数据，按新固定组织重建演示身份与组织关系，业务使用稳定内部标识；十大公司重要事项为十条并能展示列表和卡片等样式，业务数据覆盖通知、待审核、任务表单、部门团队及下属日志任务，足以展示筛选、排序及布局，超两页分页由独立极限夹具验证。同一账号 SHALL 按真实权限连续展示表单与下属日志任务，刷新仍可用，不用前端静态假数据替代，不按记录日期推算新演示日期。

演示组织 SHALL 含固定创始人、至少两个部门且每部门多个团队、完整单负责人/普通员工及必填职位/有效手机号，独立管理员不占员工位置。任务 SHALL 覆盖跨部门多负责人、仅创建不负责、专用交接及正式接管；审核覆盖全操作的操作者直属上级、固定创始人免审直接生效、拒绝、撤销、失效、完成/重开。

默认演示排期 SHALL 以近期连贯业务及少量跨日/周/月为主；跨年、午夜截止、零时长、整日覆盖、超过五项重叠及超两页表单 SHALL 由可单独运行的隔离极限夹具覆盖，不向默认单个员工集中灌入上百条测试任务。默认四人日志 SHALL 覆盖近三天及部门/团队直接和间接下属的合法阅读；冻结/删除重建及标签/评论/通知撤权边界 SHALL 由隔离夹具覆盖。准备流程 SHALL 显式指定目标演示库，可重复执行而无重复/非法组织，不在应用启动时清空任意数据库；刷新及重启后数据持久。演示重构可替换旧数据，但不是结构约束或升级验证的替代。

默认演示 SHALL 以动画公司项目串联真实四层主角：upper 苏景昕 → middle 苏格拉底 → product-head-1 柏拉图 → employee 亚里士多德，沿用稳定真实账号/内部标识及对应原演示身份。每人约 10–20 条有意义任务作为起点，四人均有自己的事项、近期日志、通知及真实审批/执行流程，其他人员保留合法位置而不专门填充个人业务。共享事件纪、部门/团队/职位和正文 SHALL 与动画主题一致，不用“分页事项/接口检查/待审”等测试或纯状态词拼接冒充默认业务名。

准备 SHALL 指定演示目标库、可重复且不覆盖已有业务修改，普通启动/重启不清库、不随日期重写现有业务。替换旧演示内容只经显式演示重建操作；结构迁移不执行内容重建。默认主线和极限/越权夹具 SHALL 分离，旧有多页/密集/权限验证不能因演示改造而删除。

四位主角 SHALL 各有能在本人首页/日历读取的正常负责任务，约10–20条有意义个人任务作为起点，不能仅以本人创建量证明本人工作可演示。主线 SHALL 通过真实父子任务串联逐级拆解和直属审核；四人均有电话、邮箱、真实格式入职日、适量相互独立的表单/月历置顶、单日/跨日/完成/逾期事项、含补写的近期日志及已读/未读多类型通知。至少准备当天普通短任务及正常逾期任务，不全部灌入跨天任务。

非主角 SHALL 只保留必要合法位置和主线协作关系，不专门填充个人日志或无关测试业务；冻结/删除重建、撤权及极端密度等专用验证用隔离夹具承接。默认业务名 SHALL 不以“待审/已拒绝/权限验证”等纯状态或测试措辞填充。

检查准备 SHALL 明确准备日、目标库及版本；旧库重复准备不默默改期、不清库或覆盖用户修改。需更新主线时 SHALL 显式选择新空演示库或明确受控重建，不把普通重复准备当成重建成功，旧库保留可回退。

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

#### Scenario: Demonstrate every protagonist's own work and task chain
- **WHEN** 四人分别登录本人首页、日历、表单、资料、日志和通知，再逐级浏览下属
- **THEN** 各人 SHALL 有近期正常负责任务，入职时长及两种置顶可展示，父子任务和审核真实可操作，不把员工负责的任务误算成所有上级的本人工作

#### Scenario: Exercise the new Web interactions using real records
- **WHEN** 在明确准备日演示事项三态、补写日志、置顶、通知筛选及当天短任务拖动
- **THEN** 规定样本 SHALL 实际存在并持久化，完成及申请走真实业务，名称无纯界面状态填充，日内拖动不因样本全跨天而不可演示

#### Scenario: Prepare a current dataset without resetting edited data
- **WHEN** 旧准备库已有用户修改，需按新准备日检查，再重复准备并重启
- **THEN** 普通准备 SHALL 保留旧日期和修改，仅显式新空库或受控重建形成新主线，目标/日期/版本可核对，新库重复执行无重复，旧库可回退

### Requirement: Notification list presentation and combined filters
通知中心 SHALL 提供精简/完整显示切换及“全部/未读/已读”和“全部/需我审核/结果告知/提醒/评论/其他”组合筛选。筛选针对当前全部可见通知，先过滤后分页/计数，保持时间倒序稳定排列；全局未读数不受筛选影响。打开消息才标已读，切换筛选不标已读，详情返回保留条件；账号切换清除旧会话数据。

实际生成的临期20%、10%、5%及逾期提醒 SHALL 归“提醒”，详情用途与列表、筛选、分页总数 SHALL 一致；不能因事件名格式不同落入“其他”。修正既有消息的读取分类 SHALL 不重投递、重复计数或改变已读状态。

Web类型 SHALL 用顶部“全部、需我审核、结果告知、提醒、评论、其他”六标签，窄屏横向滑动、当前类型选中明确。已读 SHALL 用紧凑“全部/未读/已读”分段，与类型组合；筛选区固定在消息列表上方，滚动时仍可用，有类型或已读条件才显示“重置”，不再并列三个下拉框。

精简/完整 SHALL 用同一个直接切换的小图标按钮，精简为简单几何、完整为更繁复可辨几何，有足够触摸范围和当前模式可访问名称。精简突出对象名、用途、时间，完整补充原合法摘要；未读用圆点及字重，已读适当弱化，不仅靠颜色。详情返回 SHALL 恢复类型、已读条件、模式及有效列表位置，并按当前筛选反映已读变化。

#### Scenario: Filter across page boundaries
- **WHEN** 目标消息位于后续页，用户同时选择未读与结果告知
- **THEN** 列表 SHALL 返回完整匹配集合及正确总数，明确区分无通知与无匹配，并支持清空筛选

#### Scenario: Require actionable review classification
- **WHEN** 原待审已办结、过期、改派或撤回，用户筛选需我审核
- **THEN** 该消息 SHALL 不再列为当前需我审核，结果消息按结果类型可查；旧提交事件归其他且不能伪装成新结果事件，权限变化不恢复隐藏正文

#### Scenario: Return after opening an unread notification
- **WHEN** 用户从未读筛选打开详情后返回
- **THEN** 已读状态和未读数 SHALL 更新，原筛选保持，该消息退出未读集合；精简行突出所属对象、用途和时间，以圆点及字重区分未读

#### Scenario: Classify actual reminder events across pages
- **WHEN** 收件箱多页中有真实临期20%、10%、5%和逾期事件，用户组合选择提醒及已读条件
- **THEN** 全部合法匹配消息 SHALL 归提醒且完整计数，详情表明提醒用途，其他分类不重复包含；修复前已存在消息同样正确，不重新发消息或标已读

#### Scenario: Keep narrow-screen filters available while scrolling
- **WHEN** 手机组合选择需我审核及未读，滚动消息后切换显示模式
- **THEN** 六标签 SHALL 横向可达，分段及单图标仍可操作，图案/名称反映模式，有条件才显示重置，切换不标读且全局未读不变

#### Scenario: Restore mode filters and position after reading
- **WHEN** 从某类型完整模式清单打开消息后返回
- **THEN** 条件与模式 SHALL 保留，恢复有效滚动位置，未读集合变化时回合理相邻位置，不重置为全部消息

### Requirement: Hierarchical subordinate workspace
我的下属资料 SHALL 按真实直属关系排列全部合法下属及其下属，分层展开/收起与点击人员分离，姓名和真实部门 ▸ 团队 ▸ 职位路径可辨，不能有职位时省略实际存在的组织；缺层省略，不伪造组织或公司层占位，不展示组织身份。展开状态不跨账号泄漏。不能仅按职级名称猜测关系或扩展人员权限。

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
- **THEN** 每个节点 SHALL 保留姓名及真实部门 ▸ 团队 ▸ 职位路径，无组织身份，缺层省略，不伪造公司层路径或显示原始空值，隐藏展示不改变实际管理链授权

#### Scenario: Return through nested subordinate details
- **WHEN** 用户从人员资料卡进入特定日期的月历清单或日轴，再开任务、关联任务或日志并发表评论，随后逐层返回/关闭
- **THEN** 系统 SHALL 恢复同一人员、页签、模式、日期、日轴方向、已加载位置、滚动和焦点，不退回我的或更改本人日历/日志；全链路仅评论可写，旧草稿和残留按钮不能触发业务写请求

#### Scenario: Keep overlapping identities read-only in subordinate context
- **WHEN** 下属任务同时由当前查看者创建或负责，该查看者经下属路径及其嵌套详情操作
- **THEN** 该路径 SHALL 仅能评论且无其他编辑性操作；从独立本人正常入口重新打开时按当前字段及专用权限办理，直接越权请求仍被服务端拒绝

### Requirement: Subordinate calendar month and day views
所选人员日程 SHALL 参考本人日历设计，默认月视图，可切日视图。月历 SHALL 周一至周日排列，按占用公司日期绘制连续日级任务条，不按小时缩窄或偏移首尾，午夜截止不多占次日，零时长可辨；溢出、空白、日期数字及任务条 SHALL 按实际命中日先开完整清单。日视图 SHALL 提供00:00至24:00真实时间轴、重叠分栏、独立全天区及可切任务清单。月历 SHALL 上下连续浏览前后月份及跨年，接近边界自动补载并保持日期锚点，不能只用单月滚动或整页翻月；保留按月/天定位、日期跳转和回今天，无单独周模式。

日程 SHALL 按公司日期读取所选人员当前负责且查看者有权的正常已发布任务，完整分页后投影；跨月、跨周、午夜、零时长正确且全部任务可达。月历、日轴、全天区和清单 SHALL 均能辨识完成状态。已发布任务进入任意后续审核 SHALL 显示虚线外框和待审提示，排期有变化时仅在提议位置出现；普通详情/提醒仍使用有效数据。任务详情返回 SHALL 保留人员、模式及日期，不改变本人页面状态；页面不提供拖动，详情按下属浏览上下文仅允许评论。

清单标题和“进入日视图/关闭” SHALL 始终可见，仅条目区滚动。详情返回 SHALL 恢复同一人员、日期、月份流及清单位置，各人员与本人状态独立。补载失败 SHALL 可重试，保留已有授权月份，不当成无任务；失权仍清空无权正文。

#### Scenario: Navigate months days and overflow
- **WHEN** 用户切换月/日模式、跨年翻月、选择日期、点击任务条或点击+N
- **THEN** 月历 SHALL 展示完整月份网格，跨日/跨周任务连续可辨，溢出和普通月格点击进入当日完整清单，清单可进入日视图，日轴重叠分栏且午夜无多余副本；返回详情保留模式、日期和人员

#### Scenario: Distinguish completed and pending tasks in every presentation
- **WHEN** 所选下属有已完成、未完成及后续审核中的已发布任务，用户切换月历、日轴、全天区和清单
- **THEN** 完成状态 SHALL 在所有呈现可辨；待审任务虚线显示，有新排期则只绘制提议位置，刷新后保持，待审结束后按有效排期恢复；显示不生成下属页面调时入口

#### Scenario: Reuse personal calendar browsing without changing its owner
- **WHEN** 用户从下属资料卡进入日程，在月格日期数字、任务条、空白和+N打开日期清单，再进入日视图/详情并返回
- **THEN** 系统 SHALL 按实际点击日期展示所选人员的完整授权任务，复用本人月/日浏览体验但无拖动及其他编辑操作；返回保留人员/日期/模式/滚动，不改本人范围

#### Scenario: Continue across years and recover a failed adjacent load
- **WHEN** 上下浏览人员月历跨年，补载失败重试，再从日期清单进入详情返回
- **THEN** 月份 SHALL 连续且补载不跳动，失败保留旧授权月份，清单含全部命中日任务，返回恢复同人员/日期/月历/清单位置，不改本人范围

#### Scenario: Keep long-list actions visible
- **WHEN** 窄屏某日很多任务，用户滚动清单到中间
- **THEN** 标题、进入日视图和关闭 SHALL 始终可见，仅内容滚动，无拖动或业务写操作

### Requirement: Calendar dragging by presentation
拖动 SHALL 仅在本人月/日视图对正常可见、已发布、未完成、非待审且有现有仅排期权限的任务提供。本人视图仍仅展示当前有效负责人任务；任务表单及下属日程 SHALL 不提供整条或端点拖动，也不提供画布上的独立调时按钮，但可进入鉴权任务详情；独立正常入口按字段权限办理，下属浏览路径仅允许评论。历史通知的受限只读详情不得因此取得操作权。

本人月历 SHALL 按公司日期以一天为步长：整条平移保留原日内起止时刻和工期；真实开始/截止端点分别按天调整对应日期、保留该端日内时刻与另一端不变，允许改变工期。跨周/月续接段不冒充真实端点，但可整体平移完整任务；按抓取日期和目标日期计算差量，不把续接片段误当原始开始。

本人横向/纵向日轴 SHALL 仅对完整起止区间位于当前公司业务日内且非全天/整日覆盖的普通定时任务提供拖动，以一小时相对差量保留原分钟，整条平移保持工期、端点保持另一端不变；当日零时长任务真实两端可分别命中。历史全天、全天区、整日覆盖和跨日任务首尾/中间截取片段 SHALL 均不提供整条、端点及键盘调时，从独立正常详情精确调整；只读下属详情不提供调整。午夜截止可为普通当日任务真实终点，不生成次日副本。

拖动 SHALL 实时显示完整起止日期时刻，松开进入轻量仅排期确认，主体只展示原排期、提议排期、原因和提交，不进入完整任务表单；审核仍按实际操作者直属上级，固定创始人按原规则免审。月历键盘按天、日轴键盘按小时。取消、Esc、pointercancel、失去捕获、逆序或无位移 SHALL 不写入、不误开详情/日期清单，正常触摸滚动继续可用。提交 SHALL 重验权限、冻结、完成、期限、版本与幂等，未提交前保留有效位置。

手机在合法任务或真实端点上按住约半秒 SHALL 才激活拖动；激活前滑动正常滚动，普通点击沿用清单/详情。激活 SHALL 有浮起和目标日期/时间反馈，浏览器具备可用震动能力时轻震一次；不支持时保留视觉反馈、记录实际设备结果，不新增桥接。

月历 SHALL 按抓取日与实际目标日差量支持上下左右、跨星期行/月/年，靠上下边缘自动滚动并补载可达月份，续接段仍移动完整任务。无效目标、中断、取消、无位移 SHALL 不隐式保存，结束不误开清单。

日视图指针及键盘调整后起止 SHALL 仍完整位于原公司业务日00:00–24:00，截止可恰为24:00，开始不迁入次日；预览、确认及提交前拒绝越界，不换日或滚往其他天。边界 SHALL 只约束日视图手势/键盘草稿，不限制通用排期API及正常详情的合法跨日编辑。

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

#### Scenario: Activate a mobile drag only after a long press
- **WHEN** 手机快速滑过任务，再按住合法任务约半秒，随后取消或无位移松手
- **THEN** 前者 SHALL 正常滚动，后者才浮起并显示目标反馈，具备震动能力时只在激活轻震一次，取消/无位移无写入且不误开内容

#### Scenario: Drag a continued segment across rows months and years
- **WHEN** 抓取续接段，拖至另一星期行并靠边滚动到另一月或年
- **THEN** 提议 SHALL 按抓取日与目标日差量移动完整任务，保留时刻/工期和真实端点资格，松手只开轻量确认，原因/审核/版本不变

#### Scenario: Reject day-view proposals crossing midnight
- **WHEN** 当天22:30–23:30任务尝试移动一小时、端点越过24:00或键盘产生同类提议
- **THEN** 系统 SHALL 拒绝越界且不提交，合法调整保留分钟和整条工期，当天24:00截止可用，正常详情仍可合法编辑跨日任务

## ADDED Requirements

### Requirement: Vertical continuous daily-item calendar
员工Web首页每日事项 SHALL 复用公司月视图视觉排布：星期横排、每周七列、月份上下连续滚动，可跨月/跨年、日期定位及回公司今天，初始化今天可见。同一真实日期 SHALL 仅有一个可交互日期格；补载/卸载保持日期及像素偏移，尺寸变化和切页后继续浏览，状态与公司日历独立。

日历 SHALL 用可见范围完整本人相交记录绘制整天跨度条，保留完整首尾日及真实ID，跨天/周/月同一记录，不按小时绘制、不只用数量摘要。加载失败 SHALL 明确可重试，已有授权月份保留，不将失败或首屏结果冒充全量。普通滚动不打开清单；日期数字、空白、事项条与溢出均先开实际命中日清单。

界面 SHALL 不要求双指缩放，不引入小时轴、事项拖动、审核、负责人、紧急度、标签或置顶；旧单日记录以相同首尾日展示，维护沿用可靠保存规则。

#### Scenario: Browse vertically immediately after refresh
- **WHEN** 已登录用户在320×740、390×844、1440×900或390×600刷新后直接上下浏览跨年
- **THEN** 星期 SHALL 横排，今天初始可见，相邻月份连续可达且日期唯一，补载不跳动，滚动不误开清单，不保留横向转置七行布局

#### Scenario: Read every range intersection and page
- **WHEN** 可见月份含始于上月结束于下月、已完成及超一页事项
- **THEN** 事项条 SHALL 按完整日期范围相交绘制，全量可达、跨窗口ID去重，不因分页或查询窗口截断原记录，不泄露他人事项

#### Scenario: Retain separate calendar anchors
- **WHEN** 首页浏览其他月份后切公司日历，再返回或改变窗口大小
- **THEN** 事项月历 SHALL 恢复自己的有效日期与偏移并可继续补载，公司日期/滚动不受影响

### Requirement: Daily-item span labels and status
事项条 SHALL 显示名称，允许条外名称；长名称和密集事项有命中日完整清单入口。侧边颜色 SHALL 区分完成、未完成、逾期，同时有可读/可访问状态，不仅靠颜色；完成优先，未完成且公司今天超过含首尾的结束日才逾期。

新增、改范围、完成/取消和删除 SHALL 同步更新所有受影响已加载日期的事项条、状态与清单，不只更新开始日；清单包含完成项，同日真实ID唯一。名称跨度展示 SHALL 替代唯一数量标记长度及蓝灰规则，必要溢出数量反映完整集合。

#### Scenario: Change one record's state across every covered date
- **WHEN** 事项到结束日、次日仍未完成，随后从中间覆盖日完成
- **THEN** 状态 SHALL 先未完成、次日逾期、完成后全部覆盖日完成，名称跨度保留，同日无重复

#### Scenario: Read long names and dense days without pinch gestures
- **WHEN** 窄屏某日事项很多且名称很长，点击条外名称或溢出
- **THEN** 系统 SHALL 先开实际命中日完整清单，全部名称可读、含完成项，不以双指缩放作为访问前提

### Requirement: Append log-day work names in editable Web forms
日志创建及合法编辑界面 SHALL 在正文旁提供“填入当日事项与任务”，只在主动点击时读取当前日志businessDate的完整本人源，两处同口径，不自动填入；仍在真实编辑窗口但已超新建近三日的日志仍可用。

名称 SHALL 按“每日事项”“任务”两组追加至当时已有正文，一项一行，组内按真实ID去重，包含完成及覆盖所属日的跨日项；只复制文本，不改原任务关联、事项完成、任务/审核状态。请求期间日期、会话或草稿变化 SHALL 丢弃旧响应，期间新输入不得被旧正文覆盖。失败、空结果或完整追加超10000 UTF-16上限 SHALL 明确反馈并保留原文，不截断或部分追加；成功可自由编辑，冻结/他人只读不获编辑权。

#### Scenario: Append the selected day's complete work to a live draft
- **WHEN** 用户在补写昨天创建表单或合法编辑表单主动填充，读取期间继续输入
- **THEN** 系统 SHALL 追加昨天完整去重的两组名称至最新正文，午夜截止不多算次日，原关联与全部业务状态不变

#### Scenario: Keep the draft intact on failure overflow or stale reads
- **WHEN** 源为空、失败、追加超长，或请求期间换日期/关闭草稿/切账号
- **THEN** 系统 SHALL 保留当前正文，空/失败/超长有明确反馈，旧响应不污染新日期/账号，无部分追加成功

#### Scenario: Preserve the real freeze boundary
- **WHEN** 日志只读或达到真实冻结点，旧编辑页尝试追加或保存
- **THEN** 界面 SHALL 无有效追加能力，保存仍拒绝过期写入，不延长窗口或修改关联

## REMOVED Requirements

### Requirement: Horizontal continuous daily-item calendar
**Reason**: 本次Web以纵向连续事项月历替换A阶段横向转置日期/数量外观。
**Migration**: 使用 Vertical continuous daily-item calendar，保留真实ID、完整范围、本人权限、可靠保存和独立浏览状态，不迁移删除业务数据。

### Requirement: Daily-item status count markers
**Reason**: 唯一蓝灰数量标记不能表达本轮名称、跨度和三态侧边颜色。
**Migration**: 使用 Daily-item span labels and status，保留完整清单和准确溢出数量，不限制事项总数。
