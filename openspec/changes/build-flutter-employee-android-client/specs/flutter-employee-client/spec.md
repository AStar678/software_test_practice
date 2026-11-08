## Purpose

定义潘多拉完整员工业务在 Flutter 安卓客户端的交付契约，使四类真实员工能够复用共享后端完成既有协作流程及新指导交互，并明确账号隔离、日期语义、上下文权限和可安装安卓产物的验收边界。

## ADDED Requirements

### Requirement: Complete employee migration and shared service dependency
Flutter 客户端 SHALL 覆盖迁移盘点中全部员工业务，而非只覆盖新指导或五页入口；创始人、部门负责人、团队负责人和普通员工均为正式支持角色。全部 90 项盘点、54 条既有主规格及 J01–J32 SHALL 有交付或明确 PC/A 依赖落点。共享后端继续唯一裁决业务；B 实施 SHALL 以 A 独立验证通过并归档后的实际契约为输入，存在漂移先修订本规划，不伪造接口成功。独立管理员继续 PC，系统推送继续延期，完整站内通知不得因此删减。

#### Scenario: Resolve the prerequisite before implementing the client
- **WHEN** 准备实施 B 而 A 尚未完成或最终契约与本提案不同
- **THEN** 实施者 SHALL 先完成 A 或协调规划差异，不以旧接口/本地假数据代替已约定契约，不将 B 宣称为可独立先交付

#### Scenario: Deliver more than the new guidance
- **WHEN** 四类员工使用 Flutter 完成验收
- **THEN** 除 12 项增量外 SHALL 能完成创建/审批/交接/重开/评论/标签/下属/历史消息/统计等全部原有员工流程，PC 保留项与 A 数据迁移分别取证

### Requirement: Employee authentication and restricted password sessions
客户端 SHALL 使用 employee、手机号和密码的严格登录契约，不提供管理员移动登录或自助注册。登录的 passwordChangeRequired 与会话的 mustChangePassword SHALL 正确归一；受限会话只允许会话读取、改密和退出，不发业务或刷新请求。改密 SHALL 校验原密码及至少十位、含字母数字、UTF-8 至多 72 字节的新密码，成功后清理本地会话并要求重新登录，不能复用任何旧 token。

正常会话 SHALL 只在当前 token 尚有效时按 expiresAt 合并刷新；已过期或撤销不得刷新恢复。刷新成功 SHALL 安全保存新凭证再释放队列，按凭证代次处理401，旧 token 的迟到失败不得撤销新会话。刷新结果不确定 SHALL 暂停业务并核验所持凭证；无有效凭证则重登，网络核验失败明确重试，不将 refresh 当支持业务幂等回放的端点。

#### Scenario: Enter with an initial or reset password
- **WHEN** 任一员工角色获得受限会话
- **THEN** 客户端 SHALL 只呈现改密/退出路径，不预取首页、资料、下属或通知；错误原密码保留输入并明确反馈，成功改密后重新登录

#### Scenario: Restore a normal or revoked session
- **WHEN** 应用重开或正常会话临近过期，而服务端会话仍有效、已撤销或账号已停用
- **THEN** 客户端 SHALL 经实际会话检查和允许的刷新恢复或转回登录，撤销/停用不得恢复旧业务内容

#### Scenario: Rotate a live token and reject a truly expired token
- **WHEN** 多请求同时遇到临期token，或启动时token已过期
- **THEN** 前者 SHALL 等待同一次有效刷新，后者统一进入重登而不循环刷新；受限改密会话仍不刷新

#### Scenario: Lose a refresh response or receive an old unauthorized response
- **WHEN** 刷新已在服务端提交但响应丢失/本地保存失败，或成功保存新token后旧代次请求返回401
- **THEN** 前者 SHALL 暂停业务并核验所持token，已撤销则重登、离线则提示重试；后者不得清除新token，按当前凭证与操作规则重新读取/确认，不盲重放写请求

### Requirement: Secure session storage and account isolation
持久化凭证 SHALL 使用安卓系统保护的安全存储，不放入明文偏好、日志或包资产；凭证与业务缓存不得从旧套壳导入。退出、撤销或账号切换 SHALL 取消待请求、清理账号数据/草稿/路由，丢弃迟到响应；组织或权限变化 SHALL 重新鉴权并清理失权正文。网络失败 SHALL 区别于失权和空数据，禁止离线写入后伪装服务端成功。

#### Scenario: Receive a late response after account switch
- **WHEN** A 账号退出后 B 账号登录，A 的列表、详情或写响应才返回
- **THEN** 响应 SHALL 不进入 B 的界面、缓存、草稿或未读数，恢复栈也不得暴露 A 的数据

#### Scenario: Recover after process recreation
- **WHEN** 安卓进程被重建
- **THEN** 客户端 SHALL 先重新检查安全存储的会话；仅恢复当前账号合法偏好和经重取授权的浏览位置，不恢复业务正文快照、待提交写入或上次拖动

### Requirement: Versioned idempotent requests and complete pagination
请求 SHALL 遵守各端点的 Bearer、ETag/If-Match 和幂等规则；同一操作、请求体和版本的网络不确定重试沿用同键，改变内容或目标后换键。缺版本、旧版本、业务冲突或失权 SHALL 不自动覆盖或无限重试，保留可用的当前账号草稿。任务偏移字符串、评论 ID 游标及各 nextOffset SHALL 按真实契约分别处理，跨页按 ID 去重并隔离账号/人员/条件的查询代次；未加载完或失败不得宣称全量。

#### Scenario: Retry an uncertain write
- **WHEN** 写响应丢失且用户重试同一提交，或修改了草稿后再次提交
- **THEN** 前者 SHALL 沿用同一幂等键并核对服务器结果，后者使用新键；版本冲突要求回读处理，不重复建立申请、不自动将旧差量套到新版本

#### Scenario: Change queries during a paged load
- **WHEN** 后页尚未返回时用户切人、切条件或刷新
- **THEN** 旧代次 SHALL 被取消或丢弃，新集合不混页；加载中、真实空态、失败重试和失权分别呈现

### Requirement: Company dates and effective schedule separation
客户端 SHALL 区分公司 date-only、日志 businessDate、精确时间戳、旧 allDay 及待审投影，不由设备时区重新解释日期。定时时段按半开区间绘制，午夜截止不占次日，零时长归所属日；旧全天按既有日期包含规则读取。全天快捷输入 SHALL 生成明确时刻且只将结束日推进到次日零点一次，新建不写旧全天标记。详情、表单及提醒继续读取有效排期，pendingSchedule 仅用于日历显示，不能改变提醒轮次/比例/去重。

#### Scenario: Cross midnight in another device timezone
- **WHEN** 设备时区不同于公司，任务截止为公司次日 00:00，另有零时长和旧全天任务
- **THEN** 公司日期及占用 SHALL 不漂移，定时任务无次日副本，零时长可点，旧全天不被改写为新定时工期

#### Scenario: Show pending versus effective time
- **WHEN** 已发布任务的排期修改待审
- **THEN** 日历 SHALL 仅在提议位置画一次虚线且说明同源，详情/表单仍旧有效值；批准、拒绝、撤销或失效后正确刷新

### Requirement: Navigation restoration and immutable read contexts
Flutter SHALL 保持五页及完整二级流程，按账号、人员、日历种类隔离日期、模式、密度、筛选与位置。正常本人、下属浏览、历史通知只读 SHALL 是不可在嵌套跳转/评论返回中自行升级的上下文。系统返回 SHALL 依次处理当前输入、浮层/清单和路由；下属详情返回原人员路径，表单详情返回原表单，不跳回根页面。恢复状态不得代替当前服务端授权。

#### Scenario: Traverse nested read-only routes
- **WHEN** 下属或历史只读详情继续打开父子任务、关联日志或原申请并返回
- **THEN** 整条路径 SHALL 保留限制；下属仅允许当前合法评论，历史例外无评论/写权，不能因本人同时负责该任务恢复操作按钮

#### Scenario: Return through normal secondary views
- **WHEN** 用户从日清单或任务表单进入详情，或从通知进入申请后逐层系统返回
- **THEN** 客户端 SHALL 恢复原页条件、日期及位置并关闭正确层级，账号或权限已变则清除失效状态

### Requirement: Private range daily-item workflows
Flutter SHALL 消费 A 的 startDate/endDate 范围事项，保留一条真实 ID、纯文本及全范围完成状态。纵向连续月份 SHALL 显示跨日名称条、跨周/月续接及真实命中日期；点日期、空白、条或溢出均先进入该日完整含完成清单，清单文本开详情，完成控件不误开详情。创建/编辑/完成/取消完成/确认删除 SHALL 使用实际版本和 ID；range 查询窗口至多 93 日，读完所有页后才视为完整，跨窗口去重，失败区域不伪装无事项。事项不得拥有任务拖动、标签、评论、审核或他人读取。

#### Scenario: Act on a continuation in another month
- **WHEN** 用户点跨月事项在后一个月某日的续接条并完成
- **THEN** SHALL 先打开实际命中日清单、使用同一事项 ID 完成，全部覆盖日同步更新；详情返回保留原日清单和月份位置

#### Scenario: Handle dense private records and conflicts
- **WHEN** 某日超过一页且含超长正文，或编辑收到旧版本/失权错误
- **THEN** 全部本人记录 SHALL 可到达，失败不截断为全量或覆盖新数据；他人、实际管理者、管理员均无读取入口，错误不泄露他人正文

### Requirement: Home previews and list-first entry
Flutter 首页 SHALL 保留事件纪、任务看板、每日事项三模块及主规格的数据范围。上方卡片显示约三条少量预览且无内部纵滚，整页可滚；卡片及预览条均先开相应完整清单，再开详情。事件纪最多十条按 PC 顺序只读，任务看板最多十条按本人分派时间倒序及 ID 升序，只含当前负责的正常未完成任务，包含自建自负责；独立事项不受十条限制。

#### Scenario: Open a board preview with more than ten source tasks
- **WHEN** 本人存在超过十条合法任务及仅创建未负责、未发布、完成任务
- **THEN** 看板 SHALL 按原范围稳定取十项，卡片只预览少量、点击先到这十项完整清单；滚动整页和逐层返回保留位置

### Requirement: Task creation assignees and parent relationships
Flutter SHALL 实现普通任务标题、说明、有序多负责人、排期、紧急程度、可选父任务及有序共用标签，不恢复抽象任务、百分比或新建完成标准。普通员工创建默认本人且可移除，三类管理者初始负责人为空；可选择本公司有效员工含跨部门、上级和创始人，至少一人，搜索、顺序和取消回滚可靠，候选不含联系方式。父任务名称搜索、清空和合法保留 SHALL 支持独立授权，不以不可见字段缺失自动清除隐藏关系，不允许深层循环或用子完成改父状态。

#### Scenario: Create across the organization
- **WHEN** 四类员工分别创建任务，搜索并调整负责人、父任务与标签后保存
- **THEN** 默认值及有序集合 SHALL 正确；创建不带 acceptanceCriteria，历史标准仍可读/按权编辑，越界候选、循环和无负责人明确拒绝并保草稿

#### Scenario: Submit a create requiring review
- **WHEN** 非创始人提交创建
- **THEN** 任务 SHALL 以申请方式跟踪且不进入正常首页/日历/表单/统计，原申请人可在拒绝/失效后按新请求重提；只有固定创始人合法免审直接发布

### Requirement: Field-sensitive task editing and provenance
详情 SHALL 保留原创建者/时间、有效资料、文字进展、合法关联及相关审核意见，隐藏内部业务责任概念、无当前申请的固定审核人和完整执行历史。编辑 SHALL 按服务端字段能力实施：当前负责人可改有权普通资料及进展；在任创建者/正式接管人可改负责人及顺序；仅正常查看者只改排期。资料与进展一次提交 SHALL 成为一个原子申请，省略/清空集合区分；不通过 reschedule 夹带资料、状态或交接。交接、接管、重开不得改变原创建来源或“我创建”。

#### Scenario: Edit metadata and progress atomically
- **WHEN** 非创建者当前负责人改合法资料和进展但保留负责人顺序
- **THEN** SHALL 允许一次原子申请，待审有效值不提前变；擅自换序、越权字段或混入状态则明确拒绝，不部分写入

#### Scenario: Open with normal schedule-only rights
- **WHEN** 有正常查看但无普通编辑权的员工经正常详情编辑
- **THEN** SHALL 仅提供排期，按实际操作者审核；下属/历史入口不因该员工有另一身份恢复编辑

### Requirement: Progress completion and reopening workflows
Flutter SHALL 保留每次文字进展审核、首次有效进展进入进行中、完成的批准/退回/撤销分支及退回必填意见。重开 SHALL 使用专用流程，仅合法业务责任方发起并可提交完整新排期及有序负责人；可用本公司有效员工候选替换已停用旧负责人，至少一人，不自动添加接管人。负责人及排期 SHALL 随同一申请原子生效，拒绝/撤销/失效均保留旧负责人和排期；通过增加轮次并进入进行中，拒绝/撤销/失效仍保持完成，不改原创建者/时间。执行状态与审核状态 SHALL 分别展示，不用本地按钮直接改最终状态。

#### Scenario: Resolve completion and reopen
- **WHEN** 当前负责人提交完成，随后合法责任方重开，而审核分别批准、拒绝、撤销或失效
- **THEN** 各分支 SHALL 遵守原状态机和原子排期规则；不允许客户端绕过批准，也不因失败丢掉原完成状态

#### Scenario: Reopen taken-over work with inactive former assignees
- **WHEN** PC 完成业务接管后，合法接管人在 Flutter 重开旧负责人已停用的已完成任务
- **THEN** SHALL 能选择/调整有序有效负责人并与完整新排期一次提交，批准后两者及新轮次同时生效；空集合/失效/跨公司候选拒绝，失败保草稿，拒绝/撤销/失效保留旧版，不需先对已完成任务做普通编辑，不改原创建来源

### Requirement: Actual-applicant review and application lifecycle
创建、编辑、进展、完成、重开与交接 SHALL 按实际申请人的当前直属上级审核；只有固定创始人合法免审，缺上级阻断。预览不代表提交授权，成功展示实际保存审核人。同任务最多一待审，冻结业务写入且评论独立；仅申请人撤销，修改先撤后重提。我的申请、详情、批准/拒绝及失效反馈 SHALL 完整；diff 仅当前有权审核人看，按变更字段原上新下、有序集合可辨；申请人看合法自身提议及结果，旁观者不泄漏完整提议。改派、资格、期限、并发决定 SHALL 服务端重验，旧按钮不可复活。

#### Scenario: Reroute while a review is open
- **WHEN** 提交预览后或旧审核人打开详情后发生组织变更、停用或准确截止
- **THEN** 客户端 SHALL 以实际服务响应刷新审核人/能力/终态，旧审核人不能决定，失效后解冻，不重复提交或回滚服务端失效

#### Scenario: Read a field diff without widening visibility
- **WHEN** 当前审核人、申请人和普通查看者分别打开同一申请
- **THEN** SHALL 分别看到有权 diff、自身提议/结果或安全摘要，不以普通任务响应拼出未授权完整提议；批准/拒绝/撤销后刷新关联页面

### Requirement: Dedicated handover and default target preferences
Flutter SHALL 提供专用交接、合法来源位置和目标候选、原因及原审核流程，并支持默认交接对象读/存/清除。本人或相关人员直属管理者按当前资格办理，不借全公司创建候选扩大交接权；交接只替换来源在有序负责人的位置，不夹带资料，不改变创建来源。下属浏览链 SHALL 无交接和预设管理入口。

#### Scenario: Handover with a remembered target
- **WHEN** 用户正常入口读取/更新预设并交接，或预设目标、直接管理关系已失效
- **THEN** SHALL 使用专用候选重验，不合法时提示重新选择；间接上级、同级及下属浏览路径不能因此操作，批准后仅合法来源被替换

### Requirement: Complete personal month and day calendars
Flutter 公司日历 SHALL 只包含本人当前有效负责的正常已发布任务含完成，支持连续双向月份/跨年、补载重试、定位/今天、密度保存、日期完整清单、默认横向且可切纵向日轴、局部侧抽屉、申请/表单及创建入口。月条按天占用，日轴 00:00—24:00 按真实时间，所有重叠任务含超过五项均可到达，横向轴对旧全天及整日覆盖任务仍各显示一行，不另设全天区；仅纵向将旧全天/整日覆盖放独立全天区、不在轴重复，其他定时任务全量分栏，完成和待审可辨。日格/条/空白/溢出 SHALL 先开真实命中日完整清单，去重含完成；抽屉约占 40%–45% 视口且不改变底层布局。置顶不改日轴时间，共用首标签颜色及快照语义保持。

#### Scenario: Browse dense and boundary schedules
- **WHEN** 本人有跨周/月/年、午夜截止、零时长、旧全天及超过五重叠任务
- **THEN** 月/日/清单 SHALL 全量可达且语义一致，只创建未负责/未发布/历史例外不混入，任一续接点打开实际日期清单，返回保持日期/密度/位置

#### Scenario: Preserve distinct horizontal and vertical all-day layouts
- **WHEN** 同一天含旧全天、整日覆盖、部分跨日和超过五项重叠任务，用户切换日轴方向
- **THEN** 横向 SHALL 每任务一行且包含旧全天/整日覆盖；纵向仅在全天区显示旧全天/整日覆盖，其余真实覆盖分栏，均全量可点且不重复，切换不改变排期或拖动资格

#### Scenario: Cancel an overlay without changing the canvas
- **WHEN** 用户打开抽屉、日期清单或详情后关闭/系统返回
- **THEN** SHALL 恢复正确层级、焦点与位置，底层不因抽屉开闭缩放、误点击或改变本人日期

### Requirement: Touch scheduling and final day bounds
Flutter 拖动 SHALL 遵守修订后的主规格：约 500ms 长按激活、一次轻震、激活前自然滚动；月历二维跨行/月/年并边缘自动滚动，按实际抓取日差平移完整任务，只有真实端点能缩放；日轴按小时相对变化保留分钟且最终全区间仍在当前日 00:00—24:00。轻量确认 SHALL 显示完整旧/新排期、原因和实际审核提示，不提前保存。取消、系统中断、无位移、无效落点或失权不得写入或误开详情。键盘/可访问替代 SHALL 使用同一规则；详情合法跨日排期不受日轴限制。

#### Scenario: Drag across a month boundary on a device
- **WHEN** 真机上从续接片段长按激活、移入边缘自动滚动并跨年落到另一日期
- **THEN** SHALL 只轻震一次、按实际日期差移动整条保留时刻工期，确认才调用原排期接口；取消/中断不建申请且不误开清单

#### Scenario: Reject a final day-axis crossing
- **WHEN** 原本当日内任务按小时移动或拉端后超出 00:00—24:00，包含键盘和确认路径
- **THEN** SHALL 拒绝并不切换日期或发写请求，合法边界可保存且分钟保留，旧全天/整日覆盖/跨日片段无日轴调时

### Requirement: Server-wide task table and independent pins
Flutter 任务表单 SHALL 使用 A 的全局管线：正常授权下原创建或当前负责并集，完整关系/完成/名称/单端日期组合过滤，表单置顶组先于组内六字段排序和 ID 始终升序，再计数及每页默认 50 条分页。固定标题列/表头、可横滚概览/排期/资料/全部列 SHALL 保留规定字段，无单元格直改，不恢复“仅可见”、分类统计或顶栏刷新。表单置顶 SHALL 独立持久化，创建或负责可用；日历置顶仍仅当前负责，二者不改任务版本或审批。筛选/返回/刷新状态独立于通用任务缓存，失权/下属/历史路径不能借残留偏好写入。

#### Scenario: Pin work from a later page
- **WHEN** 超过一百条数据中后页的合法任务被表单置顶并重新读取
- **THEN** SHALL 在完整过滤后的置顶前组按所选方向及 ID 稳定排序，不只重排当前页；筛掉任务不强制显示，计数和分页一致

#### Scenario: Pin an original-created task without current assignment
- **WHEN** 本人正常可读原创建任务但不再负责
- **THEN** SHALL 仅允许表单置顶，不开放日历置顶；接管不改变原创建关系，两种偏好切换不相互污染

### Requirement: Work-log lifecycle by business date
日志主页面 SHALL 仅本人日志，卡片和排序按 businessDate 倒序，详情展示真实 createdAt。唯一创建入口只列公司今天/昨天/前天尚缺日期，一人一天唯一；重复创建不自动切编辑。创建和显式 ID 编辑 SHALL 分开全屏组织，正文、标签和可选任务关联独立；业务日期不变，首次创建后真实 24 小时冻结、删除重建不延期。失败/返回 SHALL 保草稿和来源位置；完成或冻结不阻断原合法评论，下属日志仍列表且不得编辑。

#### Scenario: Backfill and later edit a log
- **WHEN** 今天补写前天，次日仍在首次创建后 24 小时内，随后到准确冻结点
- **THEN** 卡片 SHALL 仍归前天，真实创建时间只在详情明确；冻结前合法编辑可用，冻结后拒绝，删除重建不能重置窗口

#### Scenario: Select a linked task and return
- **WHEN** 日志编辑中进入独立鉴权的任务选择后返回，或创建撞到唯一/版本约束
- **THEN** SHALL 保留正文和有序标签/关联草稿，不误进其他日志、不因日志权限获得任务权、不自动将重复创建改为编辑

### Requirement: Active append-only log name filling
新建及仍有编辑权的日志 SHALL 提供用户主动填充，使用该日志 businessDate 的 A 完整名称源，含完成事项与正常当前负责任务、按各组 ID 去重、保留服务顺序。追加 SHALL 以“每日事项”“任务”分组及逐项换行接在现有正文后，用户可继续修改；不覆盖正文、不更改关联/状态/审批。源失败/不完整 SHALL 不追加部分文本，空集合明确提示；填充资格按日志编辑窗口，不错误限于近三日。不得在冻结后或下属只读路径填充。

追加 SHALL 保持现有日志正文 10000 个 UTF-16 code unit 上限，包含分组/换行/原正文，按服务端 Java String.trim 去首尾 U+0000–U+0020 后计算长度，不能使用更宽泛的 Dart Unicode trim 代替；此计数不改写界面原文。事项多行 body 不截首行。合并超限 SHALL 保留原正文并提供完整待追加文本的独立临时预览和超限反馈，允许用户主动删减后确认；不得自动截断、部分追加冒称完整。确认时重验最新正文合并长度、目标/会话及当前编辑资格；取消或仍超限不改原文，不扩大后端上限。

#### Scenario: Fill a still-editable backfilled log beyond the creation window
- **WHEN** 日志所属日已不在近三日而首次创建未满 24 小时，用户点击填充
- **THEN** SHALL 按其所属日完整追加两组名称，午夜截止不多算一天、跨日事项同 ID 一次，不修改原有关联；冻结则拒绝追加

#### Scenario: Keep user text on fill failure
- **WHEN** 名称源为空、失败或用户在等待中修改正文
- **THEN** SHALL 保留当前正文；成功仅在当前编辑目标仍合法时追加到最新正文，不覆盖等待期间输入，失败不产生半组或重复自动重放

#### Scenario: Review an oversized fill without losing the existing log
- **WHEN** 原正文接近上限或名称源含六条接近2000字的多行事项，分组拼接后超过10000个UTF-16 code unit
- **THEN** SHALL 不直接改变原文，完整候选可预览并由用户主动删减，取消保原文；确认时重新校验，合法文本一次追加，不静默截断或改关联

#### Scenario: Count separators and supplementary characters at the limit
- **WHEN** 填充包含多行、分组标题、emoji，或预览期间原正文变化/日志冻结
- **THEN** SHALL 按UTF-16长度检查合并后10000可保存、10001拒绝，等待期间输入保留；冻结/目标改变不得追加，既有正文不丢失

### Requirement: Ordered shared tags and founder maintenance
任务和日志 SHALL 使用共用有序多标签，零项/省略保留/显式清空区分，取消选择回滚。只有固定创始人在“我的”维护目录，管理员和其他员工无此权；不提供私人标签/颜色覆盖。任务标签随审批，日志受冻结；合法删除快照保留且首项决定稳定颜色，移除后不能新挂回已删除项。详情/清单/月日历 SHALL 同源颜色并同时以文字表达状态。

#### Scenario: Keep ordered deleted tag snapshots
- **WHEN** 首标签已删除但保留在历史任务，用户查看或合法编辑标签
- **THEN** SHALL 保留首项快照颜色及删除状态，目录重排不变色，可移除但不能重新新增删除项；日志同样不得降级为单选

#### Scenario: Restrict catalog management
- **WHEN** 创始人、其余三类员工或独立管理员尝试维护共用目录
- **THEN** SHALL 仅创始人员工入口可用且服务端重验，其他角色仅按对象权选用

### Requirement: Flat comments and revoked-access safety
任务/日志评论 SHALL 平铺、时间正序及稳定 ID 游标，当前对象访问权独立检查，作者在仍有权时可改/删本人评论。任务完成/待审和日志冻结 SHALL 不冻结独立评论，不提供楼中楼/他人管理权。评论通知仅面向当前负责人或日志作者且排除本人；删除/失权后清理摘要及跳转，不借历史消息例外恢复评论。发表评论返回 SHALL 保留原路由上下文。

#### Scenario: Comment while business edits are frozen
- **WHEN** 对象完成、待审或日志冻结，但当前员工仍有正常读取与评论资格
- **THEN** SHALL 允许评论及本人评论维护、不改变业务状态；下属路径保留只读业务模式，历史只读例外不可评论

#### Scenario: Reopen a deleted or revoked comment notification
- **WHEN** 原评论已删除或当前对象失权
- **THEN** SHALL 不显示旧正文、摘要或评论入口，不通过历史任务路由恢复内容

### Requirement: Profiles avatars and actual organization paths
Flutter 本人资料 SHALL 允许改头像/邮箱、改密和退出，姓名/电话/组织/入职日期只读。预设 rabbit/cat/bear/panda 与 PNG/JPG 源图至多 10MB SHALL 支持，中心裁剪压缩为 256px JPEG，再满足服务端二进制至多 300000 字节、尺寸至多 512px、data URI 至多 400000 字符；取消/权限失败可恢复，不使用不存在的 multipart 接口。本人及授权下属详情 SHALL 渲染服务端 tenure 年/月/日/asOfDate，空值显示未设置，不用账号创建日或本地 365/30 算法；身份标签隐藏，展示实际“部门 ▸ 团队 ▸ 实际职位”，缺层省略。联系方式仅在有权本人/实际链上级详情读取，不进入树或候选。

#### Scenario: Read tenure and a partial position path
- **WHEN** 入职日为空或位于闰日/月末，或真实组织缺部门/团队
- **THEN** SHALL 使用服务投影和真实缺层路径，不伪造身份、层级或时长；普通目录不因缓存完整详情获得联系方式

#### Scenario: Cancel or reject an image selection
- **WHEN** 用户选图取消、系统拒绝权限、源图超限或处理后仍超服务限制
- **THEN** SHALL 保留原头像和其他资料草稿并明确提示，合法图片以原 data URI 契约提交，过程不上传原大图或泄露其他字段

### Requirement: Complete subordinate read-only workspaces
Flutter SHALL 从“我的”提供真实直接及间接下属树，展开与选人分开，人员资料→日程/日志路径清楚。人员日程 SHALL 连续上下跨月/年、补载重试、月/日模式及实际命中日完整清单，清单标题与进入日视图/关闭固定可见；人员日志继续分页列表。本人及各人员浏览状态 SHALL 独立；整条关联任务/日志/申请路径仅允许原正常权下的评论，不恢复编辑、交接/预设、审核、置顶或提交，即使本人同时负责。组织变化/失权 SHALL 清理原正文与旧响应。

#### Scenario: Return through a subordinate's nested task
- **WHEN** 管理者跨年浏览某间接下属、开日清单、任务及关联任务并评论后逐层返回
- **THEN** SHALL 保留同一人员/页签/日期/模式/位置，标题和清单按钮仍可达，全链仅评论可写，其他人员及本人状态不变

### Requirement: Complete in-app notification lifecycle
Flutter SHALL 提供六类型标签、三读态分段和一个具有可访问名称/状态的几何图标切换精简/完整，过滤区固定、窄屏可达。组合条件按完整授权集过滤后分页/计数，需我审核只含当前可办未到期申请，全局未读独立。GET/筛选/切模式不标读，真正打开才标读并正确更新未读筛选。详情 SHALL 绑定原 requestId，分别尊重 canReadRequest/canReview/对象权限，不跳最新申请或泄漏 diff。个人隐藏、事件严格 180 秒内撤回、申请撤销 SHALL 分开；三个月为日历月，撤回上级例外只读安全摘要。

#### Scenario: Filter and open a notification on a later page
- **WHEN** 用户在六类×三读态任一组合切模式、加载后页并打开未读通知后返回
- **THEN** SHALL 返回正确总数和动态分类，只打开导致标读；保留筛选/模式/位置、更新全局未读，已读消息退出未读集合

#### Scenario: Separate lifecycle actions at boundaries
- **WHEN** 用户隐藏个人消息、发送者在 180 秒边界撤回事件或申请人撤销业务申请
- **THEN** SHALL 调用各自动作，不互相替代；180 秒及之后不能事件撤回，原申请/上级安全摘要及三日历月口径保持

### Requirement: Isolated historical-notification task access
有效送达普通历史任务消息的例外 SHALL 仅经专用通知任务读取入口显示当前安全只读摘要，不写入正常任务缓存/表单/日历/搜索/父任务候选。历史上下文 SHALL 无评论、置顶、排期、交接、审核及其他业务写入；评论通知删除/失权不得走该例外。通知对原申请的只读能力不得等同当前办理能力。

#### Scenario: Follow a historical task after losing ordinary access
- **WHEN** 员工从仍有效的普通历史消息读取对象
- **THEN** SHALL 仅看到专用当前只读摘要，返回后正常列表仍无该任务；不恢复完整申请 diff、评论或任何操作按钮

### Requirement: Real analytics recommendations and holiday labels
统计与 AI 图谱 SHALL 使用后端真实结果，区分执行状态、待完成审核/冻结及逾期、四档紧急程度；创始人公司、部门/团队聚合及个人、普通员工本人范围及时间筛选不扩大。现有本地规则建议 SHALL 保留关键词/来源/生成时间和授权跳转，不虚构固定数字或外部模型。月/日历 SHALL 使用 A 的按年官方休班数据，ready/stale/missing 正确表达，未公布年不预测，失败保留已有标签；标签不改变排期、提醒或统计。

#### Scenario: Revalidate analytical sources after organization changes
- **WHEN** 不同角色查询范围并打开建议来源，期间组织权限变化
- **THEN** SHALL 按当前权限刷新范围与跳转，无权内容不继续读取，空/失败有清楚反馈，数字可对应真实任务

#### Scenario: Browse a missing or stale holiday year
- **WHEN** 跨年到 missing 年份或刷新后缓存 stale
- **THEN** SHALL 不伪造休班、保留最近有效标签并表达状态，不让外部源故障阻止任务日历，任务和提醒不被改动

### Requirement: Android coexistence and reproducible delivery
首轮 SHALL 提供原生 Flutter Android APK，使用独立包名与旧 `cn.pandora.mobile.debug` 共存，不覆盖旧应用或读取其登录数据；安装后以真实账号重登共享后端。交付 SHALL 记录 Flutter/Dart/JDK/Android SDK、构建命令、版本/签名指纹/APK 哈希、网络配置及真实设备版本；密钥和凭证不入库。正式配置 SHALL 使用有效 TLS，开发 HTTP 例外明确限定且不绕过证书验证；不内置演示密码或明文业务日志。真实安卓设备 SHALL 验证长按轻震、系统返回、键盘/安全区/字体放大、选图、前后台/进程重建、断网重试/重登与账号隔离；仅模拟或 Web 证据不得冒充设备通过。

#### Scenario: Install alongside the transition shell
- **WHEN** 安装交付 APK 到已有旧套壳的安卓设备
- **THEN** SHALL 两个独立应用均可保留，新应用无旧凭证；真实登录与后端写入可在过渡 Web 回读，不自动停用旧入口

#### Scenario: Audit evidence and a missing device
- **WHEN** 检查交付包，或实施环境暂缺 SDK/签名/设备
- **THEN** SHALL 有可复现环境和实际完成的证据；缺项明确记录为未完成阻塞，不以旧原生 APK、mock、截图或历史 PASS 宣称本次交付通过

### Requirement: Existing PC operations and real demonstration interoperability
B SHALL 复用 A 的真实四角色动画链、稳定账号/ID 和业务数据，不用本地改名或假状态演示。PC 的入职维护、组织调整、停用/接管、密码重置、事件纪及审计继续可用；Flutter SHALL 在这些操作后正确刷新权限、资料、审核路由和来源。默认演示与极限夹具分开，普通应用启动不得重灌数据；A 的数据库迁移/备份检查与 B 的跨端读写分别取证。

#### Scenario: Demonstrate and react to PC changes
- **WHEN** 苏景昕→苏格拉底→柏拉图→亚里士多德四账号完成真实业务，PC 调整组织/停用/接管或重置密码
- **THEN** Flutter SHALL 展示真实链和结果、及时失效原资格并保留创建来源；已有业务修改不因启动/演示准备被覆盖，极限分页/密集数据可独立验证
