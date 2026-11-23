## ADDED Requirements

### Requirement: Flutter task form inline company tag creation

固定创始人在拥有任务标签编辑权时 SHALL 可直接在新建或编辑任务表单中创建公司标签，不需要离开表单或前往“我的-标签管理”。内联创建 SHALL 复用公司标签的名称长度、公司内唯一和八色预设规则；创建成功后 SHALL 立即加入当前目录并选中，失败 SHALL 保留任务已填写的标题、说明、排期、负责人、标签、父任务及其他草稿内容。

普通员工和独立管理员 SHALL 不显示该内联创建入口，也不能通过任务表单取得标签维护权；他们仍只能在合法任务编辑权内选择和清除现有标签。内联创建不改变“只有固定创始人可维护公司标签”的权限，也不改变已删除标签、冻结任务及审核中的既有规则。

#### Scenario: Create and select a tag without leaving the task form
- **WHEN** 固定创始人在已填写部分任务内容的表单中新建合法名称和颜色的公司标签
- **THEN** 标签 SHALL 创建成功并立即出现在当前选择区、处于选中状态，任务表单不关闭且所有已填字段、负责人顺序和标签顺序保持不变

#### Scenario: Preserve the task draft when tag creation fails
- **WHEN** 创始人内联创建同名、超长、非法颜色或网络失败的公司标签
- **THEN** 系统 SHALL 显示可理解的中文错误，原任务草稿完整保留，当前已选标签不丢失，可修改后重试

#### Scenario: Hide inline creation from non-founders
- **WHEN** 普通员工、部门负责人、团队负责人或独立管理员打开任务表单
- **THEN** SHALL 不出现新建公司标签入口；直接调用标签维护接口仍按原权限拒绝

### Requirement: Employee task soft deletion and deleted references

已发布任务 SHALL 支持软删除，不物理删除任务版本、申请、审核、评论、日志关联、通知、交接或操作历史。当前业务责任方或原创建者 SHALL 可删除任务；其他人包括仅可见者、下属浏览者、历史通知只读访问者和独立管理员 SHALL 不能通过员工端删除。存在未结申请时 SHALL 先撤销或办结，删除请求被拒绝且不改变任务。

删除 SHALL 校验当前任务版本并使用幂等写入；成功后 SHALL 记录删除人、删除时间和可追溯历史，任务从本人及下属日历、任务看板、任务表单、搜索、统计、父任务候选和新建/编辑入口中排除。已存在的通知、申请、日志关联和评论 SHALL 保留对象引用，不级联删除或改写原业务记录。

从通知、审核申请、日志关联或历史记录打开已删除任务时，系统 SHALL 明确显示“任务已删除”并停止进入正常任务详情、评论或业务操作；不得把已删除伪装成无权访问、空任务或仍可编辑的任务。管理端完整任务操作历史 SHALL 继续可按任务标识查询已删除任务的版本、申请、审核、交接、业务接管和删除记录；管理端页面工作不在本 change 范围。员工 Web 不新增删除入口，但共享接口 SHALL 对既有链接返回可识别的已删除状态。

#### Scenario: Delete a task from the calendar day list or task form
- **WHEN** 当前业务责任方或原创建者从月视图当天清单、任务详情或任务表单确认删除一个没有未结申请的任务
- **THEN** 任务 SHALL 软删除并从日历、看板、表单和候选中消失，其他通知、申请、评论和日志不变，重新刷新后仍保持已删除

#### Scenario: Block deletion while a request is pending
- **WHEN** 任务存在待审申请时当前业务责任方或原创建者尝试删除
- **THEN** 系统 SHALL 拒绝删除并提示先处理申请，任务、版本、申请和通知均不改变

#### Scenario: Show a deleted notice from preserved references
- **WHEN** 用户从旧通知、审核申请、日志关联或历史入口打开已删除任务
- **THEN** 系统 SHALL 显示“任务已删除”，不展示正常详情或写操作；通知、申请、日志关联和管理端历史仍可独立读取

#### Scenario: Reject deletion by unauthorized readers
- **WHEN** 仅可见者、下属浏览者、历史只读访问者、独立管理员或其他员工尝试删除任务
- **THEN** 系统 SHALL 拒绝且不修改任务、申请、通知、评论或历史

### Requirement: Employee app navigation and page data freshness

员工 App 底部导航的每个入口每次被点击时 SHALL 触发目标主页的数据刷新，包括再次点击当前入口；刷新 SHALL 重新读取会变化的业务数据，而不是只重建页面外观。刷新期间和刷新失败 SHALL 保留当前可见内容、滚动位置、筛选条件、分页游标、当前日期、选中人员及未提交草稿，不得因刷新清空页面或跳回顶部。

没有底部导航但承载可变数据的关键页面，包括通知和我的下属及其工作浏览，SHALL 提供可见的下拉刷新或等价显式刷新入口；刷新结果 SHALL 受当前账号、人员、筛选和日期保护，迟到响应不得覆盖新状态。任务、日志、每日事项、标签、评论、审核或通知写入成功后，相关页面 SHALL 在返回或再次进入时展示已保存结果，不要求用户退出重进。

#### Scenario: Refresh every bottom navigation entry
- **WHEN** 用户在其他端修改数据后依次点击底部导航的首页、公司、日志、统计、我的，并再次点击当前入口
- **THEN** 每个目标主页 SHALL 重新读取数据，已变化内容可见；再次点击当前入口也刷新

#### Scenario: Preserve browsing state while refreshing
- **WHEN** 用户在已滚动、已筛选或已翻页的日历、日志、通知或任务表单触发刷新
- **THEN** 刷新 SHALL 保留原滚动位置、条件、分页和草稿；失败时保留旧内容并显示可重试提示

#### Scenario: Refresh pages without bottom navigation
- **WHEN** 用户在通知、我的下属或下属工作浏览中下拉或使用显式刷新
- **THEN** 系统 SHALL 按当前账号、人员、筛选和日期重新读取，不把旧人员或旧账号响应混入当前页面

### Requirement: Home chronicle and task board ordinal indicators

事件纪和任务看板的首页预览及对应完整清单 SHALL 在每条左端显示按当前展示顺序生成的连续序号。序号 SHALL 从 1 开始，各预览和各完整清单分别编号，不读取或冒充任务的真实业务标识，不改变服务端排序、筛选、上限或点击行为。长标题、窄屏和放大字体下序号 SHALL 保持可辨并与正文分离。

#### Scenario: Number every home row in display order
- **WHEN** 首页事件纪和任务看板各有三条预览，用户打开任一完整清单
- **THEN** 预览和清单 SHALL 分别按当前顺序显示 1..N，清单顺序与未编号前一致，点击仍进入原目标

#### Scenario: Keep ordinals stable across short and long titles
- **WHEN** 窄屏或放大字体下事件纪正文或任务名很长
- **THEN** 左端序号 SHALL 不与正文重叠或被渐隐，完整清单和预览均保持当前顺序

### Requirement: Flutter assignee candidate leadership-first ordering

任务负责人候选的同一组织分组内 SHALL 按负责人优先排列，顺序为固定创始人、部门负责人、团队负责人、普通员工，再按姓名和稳定人员标识排序。部门内无团队节点和团队内人员均适用；搜索 SHALL 只过滤候选，不改变当前排序规则。已选负责人的手动顺序、上移下移和提交顺序 SHALL 不受候选排序影响。

#### Scenario: Put leaders first inside the same group
- **WHEN** 同一部门或团队同时包含负责人和普通员工，用户打开新建或编辑任务负责人选择
- **THEN** 部门负责人或团队负责人 SHALL 排在该组普通员工之前，同角色再按姓名及稳定标识排序

#### Scenario: Search without changing the saved order
- **WHEN** 用户搜索候选人并选中多人，再调整已选顺序或返回表单
- **THEN** 相似候选人 SHALL 按同一负责人优先规则显示，已选负责人的手动顺序和提交顺序保持不变

### Requirement: Employee app user-facing error safety

员工 App 的用户可见错误 SHALL 使用中文、面向操作者的说明，不得直接显示原始异常、堆栈、HTTP 状态、数据库或框架信息、内部错误码或英文请求字段名。系统 SHALL 保留网络、超时、校验、权限、未找到、版本冲突、服务不可用和会话失效等可区分状态，并提供重试、修改输入、刷新或重新登录等可执行下一步。

共享后端 SHALL 对未预期异常提供安全兜底响应，不把服务端异常文本原样返回客户端；已知校验错误 SHALL 使用中文字段名称或业务对象名称。Flutter 的事件、日志、每日事项、任务、标签、评论、通知、登录和资料等主要流程 SHALL 统一通过错误展示层呈现，技术细节只能进入不面向用户的诊断记录。

#### Scenario: Hide an unexpected server exception
- **WHEN** 后端发生未预期异常或返回非业务错误结构
- **THEN** App SHALL 显示中文通用失败说明和重试入口，不出现原始异常类名、堆栈、状态码或英文技术字段

#### Scenario: Translate validation and conflict states
- **WHEN** 用户提交缺少字段、非法时间、重复名称、版本冲突或无权限操作
- **THEN** App SHALL 分别显示可理解的中文校验、冲突或权限提示，不显示 `startDate`、`tagIds` 等内部字段名，并保留原草稿

#### Scenario: Keep recoverable network failures actionable
- **WHEN** 请求超时、断网、会话失效或服务暂时不可用
- **THEN** App SHALL 明确提示网络、登录或服务状态，并提供符合当前操作的重试或重新登录路径，不伪装成空数据

## MODIFIED Requirements

### Requirement: Independent personal daily items

每日事项 SHALL 仅属于创建它的本人，以开始日期、截止日期、全天或定时模式、一段非空纯文本及完成状态保存，首尾日均包含且截止不得早于开始；定时事项 SHALL 另带同一公司时区下的精确开始时刻和截止时刻。默认未完成，支持完成和取消完成。业务详情 SHALL 只展示起止日期、定时模式下必要的起止时刻、完整文本、完成状态控件及编辑/删除/返回等必要操作，不增加标题、负责人、紧急程度、标签、提醒、审批、关联任务、评论或日志字段。正文 SHALL 保留换行，以纯文本安全呈现，去除首尾空白后限 1–2000 字符。

本人 SHALL 可为过去、今天或未来的合法日期创建多条事项，可编辑起止日期、全天/定时模式和正文、删除指定事项，不受原个人事项总共十条、每天一条或日志补写/冻结窗口限制。字符串日期 SHALL 使用明确的公历日期，不因设备时区与公司时区不同而漂移；定时时刻 SHALL 按公司时区解释；默认今天以公司业务日期为准。旧客户端只提交日期时 SHALL 继续作为全天事项处理，既有日期接口语义保持兼容。

事项 SHALL 与任务及日志无关联，维护和完成事项不得创建任务、审核申请、任务通知、日志或改变其状态、计数和排期。任何其他员工、上级及独立管理员 SHALL 不因组织管理权读取或维护他人每日事项；列表、日期计数、详情及写入均须执行本人及同组织限制。无日期的退休个人首页事项不恢复；现有已持久化的单日每日事项 SHALL 无损映射为全天记录，startDate=endDate=原日期，保留 ID、正文、完成、版本及真实创建/更新时间。跨日事项 SHALL 是同一记录，任一覆盖日完成一次则整条完成；不得复制为多条单日记录。

事项状态 SHALL 为 completed/open/overdue：完成优先；全天未完成事项在公司 businessDate 超过 endDate 后逾期；定时未完成事项在公司当前时刻严格超过其截止日期与截止时刻后逾期，在此之前即使已过截止日 00:00 也不提前逾期。日历、日期计数和摘要 SHALL 继续按天显示事项覆盖范围，不改变天级展示精度；表单、详情和状态判定 SHALL 使用真实时刻。过去/今天/未来合法起止日期均可使用，查询窗口上限不得限制事项自身可跨的月份。日志填充仅复制文本，不改变事项与日志无关联规则。

#### Scenario: Create more than ten independent items
- **WHEN** 本人累计或同一天已有十条每日事项，再创建第十一条
- **THEN** 合法输入 SHALL 保存成功且可重新读取，任务及日志数据不变，不触发旧个人事项十条上限或日志日期规则

#### Scenario: Edit the date and body of a specific item
- **WHEN** 本人在同日多条事项中选择一条，修改起止日期、全天/定时模式及多行正文后保存
- **THEN** 系统 SHALL 仅更新该标识事项，不再覆盖的日期清单移除、新覆盖日期清单出现，涉及日期事项条、状态及清单同步，刷新保持，其他事项不受影响

#### Scenario: Complete and reopen an item
- **WHEN** 本人将事项设为完成后刷新，再取消完成
- **THEN** 完成状态 SHALL 持久化并可逆，日期摘要按完成状态更新，起止日期、时刻和正文保持，任何任务状态不变

#### Scenario: Keep dates stable across time zones
- **WHEN** 设备与公司时区不同，或事项日期或定时时刻跨月、跨年及闰日
- **THEN** 默认日期 SHALL 使用公司今天，明确保存的日期和时刻按公司时区原样往返，非法日期、非法时刻或空白/超长正文拒绝且不部分保存

#### Scenario: Enforce private ownership on every operation
- **WHEN** 同公司其他员工、上级或管理员及跨公司用户请求某人的事项列表、计数、详情或维护接口
- **THEN** 系统 SHALL 不返回他人事项、正文、时刻或计数，越权写入被拒绝，不因组织管理或任务可见关系扩大访问

#### Scenario: Keep daily-item details minimal and safe
- **WHEN** 用户打开包含长文本、换行和类似 HTML 内容的事项详情
- **THEN** 详情 SHALL 安全显示完整日期、定时事项的必要时刻和纯文本，提供完成状态及必要维护操作，不展示额外任务/日志字段，文本不作为脚本执行

#### Scenario: Preserve one ranged record across dates
- **WHEN** 本人创建跨周、跨月或跨年的全天或定时事项并从多个覆盖日读取，再在其中一天完成
- **THEN** 各日 SHALL 返回同一 ID 及完整原起止日期和模式，完成/取消完成在所有覆盖日一致，其他任务/日志/审核不变

#### Scenario: Expire after the inclusive end date
- **WHEN** 公司今天分别在未完成全天事项的开始前、范围内、结束日及结束次日，或事项已完成
- **THEN** 未完成全天项 SHALL 仅在超过结束日后为 overdue，完成项始终 completed，设备时区不改变判定

#### Scenario: Expire a timed item at its exact deadline
- **WHEN** 公司当前时刻分别在未完成定时事项的开始前、范围内、截止日当天截止时刻之前、恰好等于截止时刻及超过截止时刻
- **THEN** 仅严格超过截止时刻后才 SHALL 为 overdue，恰好等于截止时刻仍为 open；完成项始终 completed，设备时区不改变判定

#### Scenario: Migrate dated daily items without data loss
- **WHEN** 含已完成、未完成和多行正文的既有单日或跨日记录升级
- **THEN** 原记录 SHALL 保持全天模式、原起止日期、原 ID、所有权、内容、完成、版本与真实时间不变，私有访问限制仍有效

### Requirement: Daily-item lists details and reliable editing

点击日期数字、空白、事项条或溢出入口 SHALL 先打开命中日期事项清单弹层，显示日期、覆盖当天全部事项的可分页/滚动列表、完成控件、必要新增及关闭操作；无事项 SHALL 显示空态并可按该日新增。清单 SHALL 含完成及未完成事项，按创建时间升序、同值按事项标识稳定排序，按真实ID去重，切换完成不跳位。跨日条 SHALL 以实际命中位置对应日期开清单，不固定使用开始日；文本点击才进入详情，完成控件不误触详情。

每日事项标题右侧的加号 SHALL 只打开每日事项创建界面，默认开始日和结束日均为选中日期、尚无选中日期时均用公司今天；起止日期可修改。新建 SHALL 默认沿用全天模式，可切换定时；定时模式 SHALL 要求合法的开始和截止日期时刻，截止不得早于开始。表单 SHALL 在非全天时只接受公司时区下的有效日期和时刻。加号 SHALL 与标题同一行，采用与年月/今天工具一致的圆角按钮形态，以有玻璃感的半透明薄荷绿填充及清晰高光/边框呈现，提供可读名称和可见键盘焦点；不得使用白色填充或继续悬浮在卡片右下方。标题栏入口 SHALL 在320宽窄屏仍可见可操作，不遮挡日期、导航或清单内容，日历底部不保留为旧悬浮按钮专用的空白区。详情可完成/取消完成、编辑起止日期、模式与时刻/正文、经确认删除。所有操作 SHALL 使用真实事项标识。

详情返回及完成操作后 SHALL 恢复原日期清单及滚动位置，清单关闭恢复原日历日期、纵向月份位置及触发焦点；支持按钮、返回/Esc及遮罩关闭且焦点不留在隐藏内容。事项移日后 SHALL 返回原日期清单，更新原范围与新范围的事项条、状态和清单，不无提示跳到目标日。新增、编辑或完成失败 SHALL 保留草稿/原状态并提供重试，取消删除不写入。

更新与删除 SHALL 使用打开目标时取得的版本，版本冲突明确拒绝覆盖并允许回读处理；提交中防重复操作，响应丢失后的相同载荷重试 SHALL 不产生重复事项或重复状态变化。退出、会话失效或切账号 SHALL 清理每日事项缓存、草稿和弹层，旧请求不得覆盖新账号或新的日期查询。

清单/详情 SHALL 展示记录完整起止范围、全天/定时模式及 completed/open/overdue 状态，定时记录可显示必要时刻，单日可简写；从覆盖日进入不把记录改成该日。新日期写入 SHALL 使用显式日期对，正文/完成独立更新不丢范围；旧式 date 改期遇跨日项明确冲突且不缩短。本人隐私、版本、幂等、纯文本和返回/焦点规则继续适用。本要求适用于本次员工Web，Flutter独立验收。

#### Scenario: Open an empty day and create with the floating button
- **WHEN** 用户选择无事项日期，再通过清单或每日事项标题右侧加号新增
- **THEN** 创建界面 SHALL 默认该日期为全天，或由用户切换为定时并填写有效时刻，成功后清单和事项条更新；从未选日期时默认公司今天，不创建任务

#### Scenario: Read every item and return through the layers
- **WHEN** 某日有超过一页事项，用户加载后打开详情并依次返回和关闭
- **THEN** 全部条目 SHALL 可达且不重复，完成项仍在原稳定位置，返回恢复列表滚动、日历纵向位置和焦点

#### Scenario: Edit and delete only the selected item
- **WHEN** 多条内容相同的事项中用户编辑或确认删除一条，或取消删除
- **THEN** 保存/删除 SHALL 仅作用于所选真实标识，取消无写入；移日后返回原日期清单，原范围与新范围各日期事项条及状态正确

#### Scenario: Create and edit a timed daily item
- **WHEN** 用户把每日事项切换为定时，选择开始和截止日期时刻，保存后在截止前、截止时刻及截止后查看
- **THEN** 系统 SHALL 原样回读同一记录的开始/截止时刻和定时模式，日历仍按覆盖日期显示，状态按精确截止时刻判定，非法或截止早于开始的输入不保存

#### Scenario: Preserve drafts and reject stale versions
- **WHEN** 保存遇到网络错误、版本冲突或其他会话已修改/删除目标
- **THEN** 系统 SHALL 保留当前草稿并明确反馈，不静默覆盖新版本、不把编辑转为新增，相同请求重试不会重复创建或重复执行

#### Scenario: Isolate sessions and out-of-order responses
- **WHEN** 用户快速切换日期或在请求未完成时退出、失效及切换账号
- **THEN** 系统 SHALL 清除旧账号事项及草稿，丢弃过时响应，当前日期清单不会被另一日期结果覆盖

#### Scenario: Keep controls usable on compact screens
- **WHEN** 用户在320、390及1440宽度、较矮窗口使用日历、清单、详情和表单
- **THEN** 七列星期及纵向月份 SHALL 可达，长文本可换行，全天/定时、日期时刻控件及标题栏加号和保存/返回不遮挡内容及导航，键盘操作与焦点恢复可用

#### Scenario: Create from the mint glass header control
- **WHEN** 用户在320、390或1440宽度查看每日事项，并通过点击或键盘激活标题右侧的新增按钮
- **THEN** 按钮 SHALL 与标题同一行，使用与年月/今天一致形态及可辨的半透明薄荷绿填充，打开原每日事项创建表单；取消或保存后按原流程返回并恢复正确焦点，不在卡片底部留下浮动按钮或专用空白区

#### Scenario: Preserve a range when completing from a middle day
- **WHEN** 用户从跨日事项中间某天清单完成、取消完成、编辑正文或返回
- **THEN** 操作 SHALL 使用同一真实 ID 并保留完整起止日期、模式及定时时刻，所有覆盖日同步状态，返回仍是原命中日清单与位置

#### Scenario: Reject a stale single-date reschedule on a ranged item
- **WHEN** 未更新的旧页用 date 字段提交对当前跨日事项的改期
- **THEN** 服务 SHALL 返回 409 DAILY_ITEM_RANGE_REQUIRED，不改日期/正文/完成/版本，允许用户回读后使用完整日期对处理

#### Scenario: Open a continued item at its actual hit date
- **WHEN** 用户点击跨周或跨月事项续接条中间某天，再完成事项或进入详情返回
- **THEN** 系统 SHALL 先开实际命中日完整清单，完成只改变同一真实记录，文本点击才进入详情，完成及返回保持清单位置

### Requirement: Flutter compact chronicles and fading names

Flutter 首页事件纪 SHALL 仍先进入完整二级清单；清单折叠正文最多两行，每条紧凑排布。正文超出可见区域才在正文旁显示展开箭头，整条可展开、收起，且展开状态互相独立；未截断的正文 SHALL 不显示箭头、不留空位、不提供伪展开操作。管理顺序、原始正文及换行保持不变。

任务名与每日事项名在有行数限制的月历条、清单、看板及任务表单预览中，实际截断时 SHALL 不用省略号，仅让最后一个完整可见字符从左到右渐透明；未截断不渐隐。不得显示半个字符、遮住状态标识或为渐隐额外空出一个字符位置；同一个末字 SHALL 只绘制一次，不得因渐隐遮罩或分层绘制出现阴影、重影或重复字形；完整标题仍可在完整内容区及无障碍名称获取。此规则 SHALL 不用于日志正文或事件纪正文。

#### Scenario: Fit and expand chronicle bodies independently
- **WHEN** 清单包含完整两行、因窄屏刚好溢出及多行长正文，并依次展开两条长正文
- **THEN** 仅确实溢出者 SHALL 显示同行箭头，不额外占用一行，展开后保持原文及换行，操作一条不折叠另一条

#### Scenario: Fade only a clipped task or daily item name
- **WHEN** 受限预览恰好容纳名称，或同一布局因长中文、混排字符或字体放大而截断
- **THEN** 完整显示时 SHALL 无效果；截断时只渐隐末个完整可见字符且不重复绘制该字，不出现省略号、半字、阴影或重影，点开与无障碍读取仍得到完整原文
