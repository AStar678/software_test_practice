# B 全量迁移、规格和验收映射

本表为 [design D9](design.md) 的规划附件，源条目及完整含义见[已确认盘点](../../../docs/reviews/潘多拉-Flutter完整迁移盘点与Change边界-2026-11-08.md)。规格标题对应 [Flutter 能力](specs/flutter-employee-client/spec.md)，修改原规则时另以[共享 delta](specs/pandora-requirements-aligned-prototype/spec.md)为准；任务编号对应 [tasks](tasks.md)。所有任务尚未实施，本表不是验收记录。

“PC/A”条目继续由原平台/A 交付，B 任务检查移动端依赖和跨端回读，不移植管理员界面；其余条目均包含 B 的实际客户端交付。验收证据分自动逻辑/组件、真实后端集成、安卓设备和 A/PC 依赖，不能互相替代。实施时逐行在实施记录中给出证据位置或具体阻塞，禁止因“已有 Web”直接完成 Flutter 项。

业务列保留调查原文，含“当前无字段”“A 设计”等调查时差距描述；具体增量契约以 A 最终归档结果和 B design D5 为准，不把旧调查中的备选方案当作已选择的实现。

## 1. 全部 90 项业务迁移

| 盘点 ID | 业务（完整约束见盘点） | 责任 / 契约 | Flutter 规格 Requirement | B 任务 | 验收路径 |
| --- | --- | --- | --- | --- | --- |
| N01 | 五个主页面及原有二级入口；四类员工角色按权利展示内容，独立管理员不进入员工端。 | 复用→B / K01、K02 | Navigation restoration and immutable read contexts | 2.7 | J01、J30 |
| N02 | 页面、详情、清单、表单的返回栈；保留日期、筛选、显示方式、密度及滚动位置；不同人员和独立日历状态不串用。 | B | Navigation restoration and immutable read contexts | 2.7 | J14、J16、J24、J26 |
| N03 | 加载中、空态、失权、失败与可重试分开；失败不伪装为空列表，旧响应不覆盖新账号/新查询状态。 | B / K16 | Versioned idempotent requests and complete pagination | 2.2, 2.6 | J02、J03 |
| N04 | 产品文案简洁，保留状态、真实审核人、错误原因等决策信息；长名称、窄屏、触摸及可访问名称可用，不复制 Web 调试说明。 | B | Android coexistence and reproducible delivery | 2.8 | J25、J30 |
| A01 | 员工手机号登录，严格使用 employee 契约；四类员工均覆盖，不新增注册、手机号自助修改或管理员移动入口。 | 复用→B / K01 | Employee authentication and restricted password sessions | 2.4 | J01 |
| A02 | 初始/重置密码受限会话，必须改密后重新登录；受限期间不能通过业务请求或刷新绕过。 | 复用→B / K01 | Employee authentication and restricted password sessions | 2.5 | J01 |
| A03 | 正常会话恢复、刷新、退出；密码变更撤销全部会话，停用/组织权限变化即时以服务端为准。 | 复用→B / K01 | Secure session storage and account isolation | 2.4, 2.6 | J02 |
| A04 | 携带 Bearer、对象版本和幂等键；网络重试不重复提交，不以客户端本地结果替代服务端成功。 | 复用→B / K16 | Versioned idempotent requests and complete pagination | 2.3 | J03 |
| A05 | 登录切换、退出、被停用清理账号相关缓存及未完成请求；草稿不能泄漏给下一账号。安卓会话存储与恢复需在 B 设计。 | B / K01、K16 | Secure session storage and account isolation | 2.6 | J02、J30 |
| H01 | 首页仍为事件纪、任务看板、每日事项三个模块；上方两卡片少量预览、无内部纵滚，手势滚动整页；点击预览也先开完整清单。 | B / K03 | Home previews and list-first entry | 3.1 | J04 |
| H02 | 事件纪保持公司共享内容、原顺序和最多十项；员工仅阅读，维护仍在 PC。 | 复用→B / K03、K15 | Home previews and list-first entry | 3.1, 10.4 | J04、J28 |
| H03 | 任务看板只含本人负责、已发布且未完成任务，按当前分派时间倒序及稳定标识、最多十项；包含自建且本人负责项，不能扩成全部可见任务。清单→详情→返回原清单。 | 复用→B / K03 | Home previews and list-first entry | 3.1 | J04 |
| D01 | 本人私有独立事项；原内容、完成状态、真实 ID 保留，不引入任务负责人、标签、审核、评论或小时截止。本人外含管理者/管理员不得读取。 | 复用+A+B / K04 | Private range daily-item workflows | 3.2 | J05、J06 |
| D02 | 增加起止业务日期、首尾包含；旧单日数据 start=end 原日期；一条跨日事项只存一条记录，在任一覆盖日完成即整体完成。 | A+B / K04 | Private range daily-item workflows | 3.2 | J05、J29 |
| D03 | 纵向连续月历、跨年、直接显示事项条和名称、跨周/月切段，允许条外名称；密集/长标题完整清单可达，不依赖双指缩放。 | A+B / K04 | Private range daily-item workflows | 3.3 | J05 |
| D04 | 日期/空白/条/溢出均先开实际命中日全量清单，包含已完成、按 ID 去重；文本开详情，一键完成不误开详情；返回恢复位置，不做拖动。 | B / K04 | Private range daily-item workflows | 3.4 | J05、J06 |
| D05 | 新增、编辑、删除、完成/取消完成可靠保存并支持版本冲突；超过结束日仍未完成才逾期，完成优先显示完成色。范围数据分页/完备性由 A 明确，不能用计数猜条目。 | A+B / K04、K16 | Private range daily-item workflows | 3.2, 3.4 | J05、J06 |
| T01 | 创建普通独立可执行任务：标题、说明、有序多负责人、排期、紧急程度、可选父任务和多标签；无抽象任务、百分比或新建完成标准输入。 | 复用→B / K05、K06、K10 | Task creation assignees and parent relationships | 4.1 | J07 |
| T02 | 创建与有权的负责人变更均可选本公司有效员工；创建普通员工默认本人且可移除，三类管理者初始为空；至少一位，真实组织树、多选顺序、搜索/取消回滚正确。候选目录不带电话邮箱。 | 复用→B / K05 | Task creation assignees and parent relationships | 4.2 | J07 |
| T03 | 创建需审时不发布、不进正常列表/日历/首页/分析；原申请人可跟踪、拒绝/失效后按新请求重提；不把未发布任务当执行任务。 | 复用→B / K05、K07 | Task creation assignees and parent relationships | 4.1, 4.7 | J08 |
| T04 | 正常详情保留原创建者/时间、有效资料、文字进展、合法关联及审核意见；隐藏内部业务责任方及无当前申请的固定审核人；不恢复员工完整执行历史。 | 复用→B / K05 | Field-sensitive task editing and provenance | 4.4 | J09、J11 |
| T05 | 按 `editableFields` 等权利提示统一编辑；创建者在任/正式接管人可改负责人和顺序，当前负责人可改其他有权字段，进展只限当前负责人；仅正常查看者仅排期，下属路径仅评论。 | 复用→B / K05 | Field-sensitive task editing and provenance | 4.4 | J09、J24 |
| T06 | 资料与进展可一次提交成一个原子申请；未改负责人不要求负责人管理权，偷偷换序须拒绝；不能用 reschedule 夹带资料、状态或交接字段。 | 复用→B / K05、K07 | Field-sensitive task editing and provenance | 4.4, 4.8 | J09 |
| T07 | 名称搜索父任务、清空、深层防环；父/子独立授权与执行，隐藏关联不自动清除，父状态不跟随子完成。 | 复用→B / K05 | Task creation assignees and parent relationships | 4.3 | J10 |
| T08 | 当前负责人提交文字进展/完成；首次有效进展才待开始→进行中，完成批准→已完成、退回须意见→进行中、撤销恢复原状态。 | 复用→B / K05、K07 | Progress completion and reopening workflows | 4.5 | J11 |
| T09 | 当前创建者业务责任方按专用流程重开，可提交完整新排期；通过进入进行中并加轮次，拒绝/撤销/失效保留完成及原排期；不改创建来源。 | 复用→B / K05、K07 | Progress completion and reopening workflows | 4.6 | J11、J12 |
| T10 | 新任务及全天快捷输入采用明确起止时刻；日期范围结束推进至次日 00:00 仅一次。兼容读取旧 allDay，不将旧全天字段误解释成新定时任务。 | 复用→B / K05、K16 | Company dates and effective schedule separation | 4.1, 2.1 | J07、J15 |
| R01 | 创建、编辑、每次进展、完成、重开、交接按实际申请人的当前直属上级审核；只有固定创始人合法免审并留因。缺直属上级阻断，不按创建人/第一负责人兜底。 | 复用→B / K05、K07 | Actual-applicant review and application lifecycle | 4.7 | J08、J12 |
| R02 | 审核人预览只供提示，不是授权凭证；成功以保存申请的实际审核人为准，组织调整后刷新，免审显示已生效。 | 复用→B / K05、K07 | Actual-applicant review and application lifecycle | 4.7 | J12 |
| R03 | 同任务最多一个待审，冻结任务业务写入；仅申请人撤销、改提议先撤销再重提。独立评论仍可用；特殊停用处置保留在 PC。 | 复用→B / K07、K11、K15 | Actual-applicant review and application lifecycle | 4.9 | J09、J12 |
| R04 | 我的申请、审核详情、批准/拒绝/撤销/失效及旧按钮不可复活；返回原上下文，拒绝理由、结果和当前执行状态分开。 | 复用→B / K07 | Actual-applicant review and application lifecycle | 4.7, 4.9 | J08、J11、J12 |
| R05 | 专用原版/提议 diff 仅当前有权审核身份读取；只展示变更字段、原值上新值下，有序负责人/标签可辨；申请人看自身提议及结果，旁观者无完整提议。 | 复用→B / K07 | Actual-applicant review and application lifecycle | 4.8 | J09、J12 |
| R06 | 审核改派、资格变化、到期失效均服务端重验；旧审核人不能办理，当前到期处理提交前完成，错误响应不能回滚失效。 | 复用→B / K07、K16 | Actual-applicant review and application lifecycle | 4.9, 10.4 | J12 |
| R07 | 专用任务交接保留来源位置、目标资格、原因与原审核；不等于改全体负责人，不能夹带其他字段；仅本人或相关人员的直属管理者有相应办理资格。 | 复用→B / K08 | Dedicated handover and default target preferences | 4.10 | J13 |
| R08 | 默认交接对象的读取/保存/清除及候选；范围与直接管理关系重验。正常有权入口保留，下属只读树的嵌套路径不暴露管理按钮。 | 复用→B / K08 | Dedicated handover and default target preferences | 4.10, 8.5 | J13、J24 |
| C01 | 仅本人当前有效负责的已发布正常任务，含完成；本人只创建、组织可见、待创建、历史通知例外均不入日历。不恢复人员切换或周视图。 | 复用→B / K05 | Complete personal month and day calendars | 5.1 | J15 |
| C02 | 月/日模式、日期选择、回今天、侧抽屉、我的申请、任务表单及悬浮创建；抽屉局部覆盖且不改底层尺寸，关闭恢复焦点和位置。 | B | Complete personal month and day calendars | 5.3 | J16、J30 |
| C03 | 公司月历连续滚动跨月/年、边界补载、日期定位、密度调节与保存；长标题、跨周/月条、真实溢出数量及失败重试完整可达。 | 复用→B / K05 | Complete personal month and day calendars | 5.2 | J15、J16 |
| C04 | 普通点击统一打开实际命中日清单，再开详情或进入日视图；已完成项、跨日 ID 去重、空日创建及手柄/遮罩/返回关闭；返回不丢状态。 | B / K05 | Complete personal month and day calendars | 5.3 | J16 |
| C05 | 日视图横轴每任务一行、可切纵轴；00:00—24:00、所有重叠分栏、旧全天及整日覆盖区、午夜无次日副本、零时长可识别，显示不改真实排期。 | 复用→B / K05、K16 | Complete personal month and day calendars | 5.4 | J15 |
| C06 | 现有月视图个人置顶独立保存，仅本人负责任务可置顶；月格/清单置顶组优先、组内开始升序及稳定 ID，日轴不改变时刻。 | 复用→B / K09 | Server-wide task table and independent pins | 5.6 | J14、J15 |
| C07 | 待审日历投影只在提议排期显示一份虚线，框与时间说明一致；普通详情、表单、提醒仍旧有效版，结束申请后恢复正确版本。 | 复用→B / K05、K07 | Company dates and effective schedule separation | 5.5 | J19 |
| C08 | 手机长按约 500ms 成功进入拖动轻震一次；激活前滚动，取消/无位移/系统中断/无效落点不保存、不误开详情；键盘替代可用。 | B / K05 | Touch scheduling and final day bounds | 5.7 | J17、J18、J30 |
| C09 | 月历二维跨行/月/年拖动与边缘自动滚动，按抓取日差平移完整任务并保留时刻工期，续接段不作真实端点；仍确认、填原因、提交原审核流程。现有实现不能直接视为已满足。 | B / K05 | Touch scheduling and final day bounds | 5.8 | J17 |
| C10 | 日轴仅原本完整落当天的普通定时任务可拖，按小时相对调整保留分钟；最终范围也必须在当日 00:00—24:00，键盘/确认同样校验。详情排期仍允许合法跨日，不全局收紧 API。节假日月/日显示另见 Q05。 | B / K05、K16 | Touch scheduling and final day bounds | 5.9 | J18、J31 |
| F01 | 任务表单只纳入本人原始创建或当前负责的正常授权任务；正式接管不伪装“我创建”，不能直接显示后端全部可见列表。 | 复用→B / K05 | Server-wide task table and independent pins | 6.1 | J14 |
| F02 | “全部/我负责/我创建”关系、“全部/未完成/已完成”、名称及可单端起止日期同时筛选；名称去首尾空格/不分大小写/最多 200 字，日期默认全部且独立于日历月份，按公司日期相交。先完整筛选再计数/排序/分页，完成待审仍未完成；不恢复仅可见、分类统计或顶栏刷新。 | A 设计+B / K05 | Server-wide task table and independent pins | 6.1 | J14 |
| F03 | 六种排序：名称/创建/开始/截止/紧急程度/状态，两方向，同值 ID 始终升序；默认开始升序、每页 50，改条件回首页。固定任务名和表头，可横滚“概览/排期/资料/全部列”；规定的关系/负责人/来源/说明/历史标准/排期/状态/完成/紧急度/进展/待审冻结/逾期/合法父任务均可达，不提供单元格直改。 | A 设计+B / K05 | Server-wide task table and independent pins | 6.2 | J14 |
| F04 | 新“表单置顶”与日历置顶分存；本人创建或负责的合法表单项可置顶；完整筛选后分置顶/非置顶组，各组原排序后分页，不强行显示筛掉项。 | A+B / K09 | Server-wide task table and independent pins | 6.3 | J14 |
| F05 | 表单刷新/返回保留条件、列组和位置，账号隔离；残留任一种置顶不能恢复失权任务，历史/下属只读路径无置顶权。 | A+B / K09、K16 | Server-wide task table and independent pins | 6.3, 2.6 | J02、J14、J24、J26 |
| L01 | 本人日志主页面，唯一撰写入口；只列今天/昨天/前天尚未创建的业务日，一人一天唯一，创建模式不因已有记录暗变编辑；不恢复全公司作者筛选。 | 复用→B / K12 | Work-log lifecycle by business date | 7.1, 7.2 | J20 |
| L02 | 详情显式编辑/删除，业务日期不可改，首次创建后真实 24 小时冻结；删除重建不重置窗口。失败/冲突保留正文、标签、关联任务草稿。 | 复用→B / K12、K16 | Work-log lifecycle by business date | 7.2 | J20 |
| L03 | 正文、零到多标签及可选关联任务独立授权；选择任务返回保留草稿，不因有日志权获得关联任务权；冻结后仍按评论原权利操作。 | 复用→B / K10、K11、K12 | Work-log lifecycle by business date | 7.2, 7.4 | J20、J22、J23 |
| L04 | 保留本人单一日志内容范围、整卡进入详情/评论、内部编辑/关联按钮不误触整卡、阅读排版、刷新/回顶及合法人员入口；创建/编辑全屏且保存返回可达，去掉旧弹窗模式混用或无关日志月历。 | B / K12 | Work-log lifecycle by business date | 7.1, 7.2 | J20、J24 |
| L05 | 卡片和相对日期用日志所属 businessDate，按该日倒序；真实 createdAt 在详情明确展示、冻结不变。后端已有排序，不能复制 Web 按创建时间再排的错误。 | 复用→B / K12 | Work-log lifecycle by business date | 7.1 | J20、J21 |
| L06 | 用户主动把日志所属日覆盖的本人事项/正常负责任务名称追加正文，含完成、按 ID 去重、分两组；不覆盖、不改关联或状态。新建/可编辑界面同口径，空/失败保留正文。 | A 契约+B / K04、K05、K12 | Active append-only log name filling | 7.3 | J21 |
| G01 | 公司共用标签目录；仅固定创始人在“我的”维护，其他员工选用、管理员不因身份获得维护权，不迁移私人标签/颜色。 | 复用→B / K10 | Ordered shared tags and founder maintenance | 7.5 | J22 |
| G02 | 任务及日志有序多选，任务随审批、日志直接写且受冻结；省略保留、空集合清空，取消重选顺序及已删除快照保留，不用旧单选字段丢数据。 | 复用→B / K10 | Ordered shared tags and founder maintenance | 7.4 | J09、J22 |
| G03 | 第一项共用标签稳定决定日程色，逻辑删除保留快照；无任何有效/保留标签统一默认粉色，跨详情/清单/月/日一致，非只依赖颜色。 | 复用→B / K10 | Ordered shared tags and founder maintenance | 7.4, 5.1 | J15、J22 |
| M01 | 任务/日志平铺评论，时间正序、稳定游标、作者时间正文、无楼中楼；有当前正常对象查看权才可读写。 | 复用→B / K11 | Flat comments and revoked-access safety | 7.6 | J23 |
| M02 | 作者仍有访问权时可编辑/删除本人评论，不受任务完成/待审、日志冻结约束；非作者不可管理他人评论，不改变业务状态。 | 复用→B / K11 | Flat comments and revoked-access safety | 7.6 | J23 |
| M03 | 评论仅通知当前负责人或日志作者，排除本人去重；删除/失权隐藏摘要及跳转，历史消息例外不能恢复评论内容或评论权限。 | 复用→B / K11、K13 | Flat comments and revoked-access safety | 7.6, 9.4 | J23、J26 |
| P01 | 本人头像、姓名、电话、邮箱、组织信息和必要设置入口；姓名/电话管理员维护，本人仅改头像/邮箱；设置中旧“身份”展示也需评估，保留内部授权数据。 | 复用→B / K02、K14 | Profiles avatars and actual organization paths | 8.1 | J25 |
| P02 | 保留 rabbit/cat/bear/panda 预设与照片；照片选择/裁剪/压缩后用已有 data URI 契约提交，不直接上传 10MB 原图或另造 multipart 端点。 | 复用→B / K14 | Profiles avatars and actual organization paths | 8.2 | J25、J30 |
| P03 | 管理员维护真实入职日期，员工只读；按公司今天计算完整经过年月日，不用账号创建日或 365/30 折算；缺失显式空态，下属资料同算法。当前无入职字段。 | A+B / K02、K14、K15 | Profiles avatars and actual organization paths | 8.1 | J25、J28 |
| P04 | 隐藏组织身份标签；人员树、资料、工作页用真实“部门 ▸ 团队 ▸ 实际职位”，缺层省略；授权下属详情新增邮箱，电话/邮箱不进入普通树摘要，不扩大通讯录权。 | A+B / K02 | Profiles avatars and actual organization paths | 8.1, 8.3 | J24、J25 |
| S01 | 从“我的”进入真实直属及间接下属树→人员资料/工作区→日程/日志；保留人员、页签、日期与浏览状态，非管理链拒绝。 | 复用→B / K02、K05、K12 | Complete subordinate read-only workspaces | 8.3 | J24 |
| S02 | 整条嵌套下属路径仅阅读与合法评论；即使本人同时是创建者/负责人，也不在此路径恢复编辑、完成、重开、审核、交接、预设或置顶。正常本人入口按原权利。 | 复用→B / K05、K11、K12 | Complete subordinate read-only workspaces | 8.5 | J24 |
| S03 | 人员日程月/日视图与实际命中日全量清单；新要求连续月滚动/跨年/补载，替换当前单月方式；清单标题及“进入日视图/关闭”固定可见。 | B / K05 | Complete subordinate read-only workspaces | 8.4 | J24 |
| S04 | 下属日志继续列表，不新增日志月历；任务/日志详情返回原人员、日期、月历及清单位置；加载失败可重试，人员状态与本人独立。 | B / K05、K12 | Complete subordinate read-only workspaces | 8.4, 8.5 | J24 |
| I01 | 完整站内通知列表、未读数、详情、结果/提醒/评论/其他内容，任务或申请的合法主要动作；不以通知被读/删改变业务状态。 | 复用→B / K13 | Complete in-app notification lifecycle | 9.2 | J26 |
| I02 | 顶部六类型标签+已读三段按钮+一个可访问几何图标切换精简/完整，筛选固定、条件存在才重置；窄屏可横滚，未读不只靠颜色。 | B / K13 | Complete in-app notification lifecycle | 9.1 | J26、J30 |
| I03 | 类型与已读组合先在全量合法通知过滤再计数/分页；需我审核是当前仍可办且未到期，不能按旧类型静态判定；全局未读数独立。 | 复用→B / K13 | Complete in-app notification lifecycle | 9.1 | J26 |
| I04 | 真正打开才标已读，GET/过滤/切模式不标读；返回保留条件、模式和位置，未读筛选同步移除已读项。 | 复用→B / K13 | Complete in-app notification lifecycle | 9.2 | J26 |
| I05 | 消息绑定原 requestId，区分 canReadRequest、canReview、任务读取及合法变更摘要；旧消息不跳最新申请，不泄露专用 diff/已失权内容。 | 复用→B / K07、K13 | Complete in-app notification lifecycle | 9.2 | J12、J26 |
| I06 | 个人隐藏、事件严格 180 秒内撤回、业务申请撤销是三种不同动作；撤回后的上级例外只读安全摘要，三个月为日历月保留口径。 | 复用→B / K13 | Complete in-app notification lifecycle | 9.3 | J26 |
| I07 | 普通有效送达历史任务消息只通过专用入口只读当前任务摘要，不扩散到正常列表、日历、搜索、评论或写入；评论撤权/删除例外不能复用。系统推送明确延期。 | 复用→B / K13 | Isolated historical-notification task access | 9.4 | J23、J26 |
| X01 | 统计使用真实待开始/进行中/完成/待完成审核/冻结/逾期等口径及四档紧急程度，不用演示常量或把审核状态混成执行状态。 | 复用→B / K14 | Real analytics recommendations and holiday labels | 10.1 | J27 |
| X02 | 创始人公司范围、部门/团队负责人对应聚合及个人建议、员工本人范围；统计时间范围和可见任务重验，不能客户端只隐藏按钮。 | 复用→B / K14 | Real analytics recommendations and holiday labels | 10.1 | J27 |
| X03 | 现有 AI 图谱/建议任务、关键词提取、结果来源与跳转授权；当前为后端本地规则实现，不自行引入外部模型或虚构建议。 | 复用→B / K14 | Real analytics recommendations and holiday labels | 10.1 | J27 |
| O01 | PC 独立管理员账号/改密、员工账号及重置密码、真实组织/部门/团队/职位维护继续可用；入职日期新增维护和回读。 | PC/A / K01、K15 | Existing PC operations and real demonstration interoperability | 10.4 | J01、J28 |
| O02 | 固定一个创始人、单位负责人唯一、员工单一职位、显示职位不代替授权；组织调整按最终原子结果计划，不绕回员工端管理入口。 | PC 保留/A 回归 / K15 | Existing PC operations and real demonstration interoperability | 10.4 | J28 |
| O03 | 停用需接任/任务交接/未决申请受控处置和正式业务接管，保留原始创建来源；移动端刷新权限、审核人和业务责任。 | PC 保留/A 回归 / K15 | Existing PC operations and real demonstration interoperability | 10.4 | J02、J12、J28 |
| O04 | PC 公司事件纪维护/顺序、任务完整操作历史、通知治理和审计继续保留；员工无完整历史，通知清理不删审计。 | PC 保留/A 回归 / K15 | Existing PC operations and real demonstration interoperability | 10.4 | J26、J28 |
| Q01 | 公司时区、businessDate、精确时段/旧 allDay/午夜边界一致；剩余工期 20%/10%/5% 各提醒一次及逾期一次，完成/待审不发常规提醒，迟扫只补最近节点，按任务/接收人/轮次/有效排期去重。不能因日历或节假日改变语义。 | 复用→B / K03、K05、K16 | Company dates and effective schedule separation | 2.1, 5.1, 9.1 | J12、J15、J19 |
| Q02 | 保留已有 Flyway 历史校验和，新增迁移，空库/升级库收敛，备份恢复与稳定业务 ID；每日事项及新增偏好/入职/缓存不能破坏旧数据。 | A | Complete employee migration and shared service dependency | 1.1, 10.4 | J29 |
| Q03 | 稳定真实演示账号/标识及幂等准备，重启不覆盖修改；四角色动画公司业务主线替换默认极限数据，极限/权限数据另作测试夹具。 | A+B 展示 / K15 | Existing PC operations and real demonstration interoperability | 10.3 | J29、J32 |
| Q04 | Flutter 可复现构建并安装运行；会话持久化、系统返回、键盘、安全区、拍照/选图、长按震动、前后台/进程重建及真实 API 连通。包标识/签名/最低版本在 B 定案。 | B | Android coexistence and reproducible delivery | 1.3, 11.2, 11.3 | J30 |
| Q05 | 新后端按年校验/缓存国务院公布口径的节假日休/班数据，Flutter 月/日显示；失败保留缓存、无数据明确降级，不预测未来。数据源尚未核验。 | A+B / K17 | Real analytics recommendations and holiday labels | 10.2 | J31 |
| Q06 | 过渡 Web 与 A 的日期范围、表单偏好、入职/邮箱等契约兼容必须有方案；PC 不受破坏。开发/演示/生产地址与 TLS、日志脱敏、发布和回退说明需随交付明确。 | A+B / K16 | Existing PC operations and real demonstration interoperability | 10.4, 11.3 | J02、J29、J30 |

## 2. 全部 54 条原主规格

这里保留原标题，包含历史命名中的 single-select、prototype 等；实际行为按最新正文及 A/B 增量承接，不按旧标题倒退。原始场景逐个仍为业务验收输入；MODIFIED block 保留原场景并明确替换的载体/交互。

| 原序号 | 原 Requirement 标题 | 承接/替换依据 | B 任务 |
| --- | --- | --- | --- |
| 01 | Five-page navigation | N01、N02：承接五页和二级入口，调整客户端载体。 | 2.7 |
| 02 | Three-section home dashboard | H01–H03：保留三模块/数据范围，替换卡片内滚动和预览直达详情。 | 3.1 |
| 03 | Independent personal daily items | D01、D02、D05：保留私有独立模型，单日扩为起止日。 | 3.2 |
| 04 | Horizontal continuous daily-item calendar | D03、D04：替换为纵向连续月历和跨日条，移除冲突的横向/七行/仅计数要求。 | 3.3, 3.4 |
| 05 | Daily-item status count markers | D03–D05：三种状态保留；数量标记不再作为主展示，不保留禁止事项条规则。 | 3.2, 3.3 |
| 06 | Daily-item lists details and reliable editing | D01、D04、D05：承接可靠维护/清单，增加跨日同记录及返回。 | 3.2, 3.4 |
| 07 | Calendar task views | C01–C10、G03、Q05：承接全部月/日语义，叠加节假日和手机拖动，重新表述 Web 手势/样式约束。 | 5.1, 5.2, 5.3, 5.4 |
| 08 | Authorized task table page | F01、F03、F05：承接个人表单及列组/入口。 | 6.1, 6.2 |
| 09 | Combined task table filters and search | F02、F04：承接组合筛选，全量结果置顶分组。 | 6.1 |
| 10 | Global task table sorting and counts | F02–F04：保留全局排序计数，新增组前置，不能页内排序。 | 6.1, 6.3 |
| 11 | Task table refresh and account isolation | F05、A05：承接刷新返回与隔离，不恢复已取消顶栏刷新。 | 6.3, 2.6 |
| 12 | Role-scoped visibility | T04、S01、S02、X02、I07：保留正常权利/下属上下文/历史例外区别。 | 4.4, 8.5, 9.4 |
| 13 | Role-scoped task creation and assignment | T01–T03：按最新正文公司有效员工范围，不按旧场景标题缩回旧角色范围。 | 4.1, 4.2 |
| 14 | Task structure and attributes | T01、T04、T07、T10、R02：保留历史完成标准/来源，不恢复新建完成标准；移动时间输入等效设计。 | 4.1, 4.3, 4.4 |
| 15 | Task editing and completion review | T05、T06、T08、T09、R01–R06：整套字段资格、原子审批及状态机承接。 | 4.4, 4.5, 4.6, 4.8 |
| 16 | Required notifications | I01、I05–I07、M03、Q01：保留完整站内通知，系统推送继续延期。 | 9.1, 9.2, 9.3, 9.4 |
| 17 | Personal work logs | L01–L03、L05、L06：承接唯一/近三日/冻结/关联，叠加所属日及填充。 | 7.1, 7.2, 7.3 |
| 18 | Log page single-content filtering and scroll return | L04、N02：承接本人主页面、筛选和滚动返回。 | 7.1 |
| 19 | Role-scoped AI map | X01–X03：保留真实统计/建议和范围，不擅自升级为外部 LLM。 | 10.1 |
| 20 | Minimal profile page | P01–P04：保留资料维护，隐藏身份、加入职时长及授权联系方式。 | 8.1, 8.2 |
| 21 | Strict prototype scope | N01、N04、Q04：保留功能边界，修订只做原型及原生另行处理的载体限制。 | 1.1, 11.3 |
| 22 | Organization and administration | O01–O04、P03：PC 保留，新增真实入职维护和下属邮箱读取规则。 | 10.4 |
| 23 | Account password lifecycle | A01–A05、O01：原服务端生命周期完整承接。 | 2.4, 2.5, 2.6 |
| 24 | Ordered reviewer routing and reassignment | R01、R02、R05、R06：按当前直属关系，不以过时注释/标题改变路由。 | 4.7, 4.9 |
| 25 | Dedicated task handover | R07、R08、S02：专用流程承接，不因全公司创建候选而扩权。 | 4.10 |
| 26 | Deadline expiration of pending applications | R03、R04、R06、Q01：到期终态和解冻承接。 | 4.9 |
| 27 | Proportional schedule reminders | Q01、C07：原提醒时点/轮次去重，节假日和投影不改变有效排期。 | 5.1, 9.1, 10.4 |
| 28 | Notification lifecycle and historical access | I04–I07、M03：保留三日历月/撤回/只读例外及评论排除。 | 9.3, 9.4 |
| 29 | Complete task operation history | T04、O04：PC 完整审计，员工仅当前进展及有权审核意见。 | 4.4, 10.4 |
| 30 | Shared single-select tags for tasks and logs | G01–G03、L03：正文已为双方有序多选；标题和部分旧场景需纠正，不能照标题做单选。 | 7.4, 7.5 |
| 31 | Flat comments with author control and targeted notifications | M01–M03、S02：整套评论/通知/撤权规则承接。 | 7.6 |
| 32 | Persistent demonstration data for web and administration | Q03：承接稳定持久化，默认数据改动画四角色，极限夹具单列。 | 10.3 |
| 33 | Atomic employee deactivation and formal business takeover | O03、T04、R06：PC 操作保留、移动权利及时刷新。 | 10.4 |
| 34 | Convergent organization and identity schema upgrades | Q02、O02：保持迁移历史及空库/升级库收敛。 | 1.1, 10.4 |
| 35 | Notification list presentation and combined filters | I02–I04：替换旧三个下拉框，保留组合语义。 | 9.1 |
| 36 | Generated notification content and one object destination | I01、I05、M03：合法摘要/明确对象/原申请绑定承接。 | 9.2 |
| 37 | Multi-select task tag controls | G02、G03：有序多选及可访问选中态，Flutter 等效控件。 | 7.4 |
| 38 | Responsive task schedule inputs | T10、N04、Q04：窄屏键盘/取消保草稿承接，不机械照搬 Web DOM 输入控件。 | 4.1, 2.8 |
| 39 | Personal task table and founder-only tag maintenance | F01–F05、G01：保留个人关系/创始人维护，加入独立表单置顶。 | 6.1, 6.2, 6.3, 7.5 |
| 40 | Single creation entry for recent missing logs | L01、L02：唯一创建入口和近三日缺失日期承接。 | 7.1, 7.2 |
| 41 | Hierarchical subordinate workspace | S01、S02、P04：承接真实树及全路径只读评论，替换身份显示并补授权邮箱。 | 8.3, 8.5 |
| 42 | Subordinate calendar month and day views | S03、S04：保留月/日，增加连续跨月与固定清单操作。 | 8.4 |
| 43 | Consistent log reading typography | L04、N04：跨入口阅读层级及排版一致。 | 2.8, 7.1 |
| 44 | Calendar dragging by presentation | C08–C10：原天/小时增量规则保留，增加长按、二维跨月及最终日边界。 | 5.7, 5.8, 5.9 |
| 45 | Pending review calendar projection | C07、R03：原有效版和投影分离承接。 | 5.5 |
| 46 | Reschedule every visible active task | T05、C08–C10、S02：保留正常入口仅排期资格，不扩至下属/历史路径，不等于所有可见任务都能日轴拖动。 | 4.4, 5.7, 8.5 |
| 47 | Day-scale bars in the month calendar | C03、C09：原按天跨度/真实端点保留，跨行抓取仍移动完整任务。 | 5.2, 5.8 |
| 48 | Write requests work on ordinary HTTP origins | A04、Q04、Q06：现有 Web 幂等键不依赖安全上下文的要求保留；Flutter 安全随机/网络策略单独设计，不等于开放生产明文 HTTP。 | 2.3, 11.3 |
| 49 | Pending frame and caption use the proposed time together | C07：提议框及说明一致，不提前改普通资料。 | 5.5 |
| 50 | Distinct log creation and editing interfaces | L01、L02、L06：创建/编辑明确分开，追加填充口径相同。 | 7.2, 7.3 |
| 51 | Production interface copy without redundant implementation explanations | N04、T04、R02：移除多余实现说明，保留必要业务反馈。 | 2.8 |
| 52 | Personal calendar pin eligibility | C06、F04：月置顶资格不变；新表单资格独立，旧“不影响表格排序”限制须收窄。 | 5.6, 6.3 |
| 53 | Stable shared tag color across task presentations | G03：首项色、删除快照、默认粉色承接。 | 7.4, 5.1 |
| 54 | Company shared tags without private overrides | G01–G03：继续不提供私人目录或覆盖，不把旧私人数据公开。 | 7.4, 7.5 |

## 3. 全部 12 条新指导

| 指导 | 对应业务 | A 前置 | B 交付 | B 任务 |
| --- | --- | --- | --- | --- |
| 1 每日事项 | D01–D05、N02 | 起止日模型、旧单日迁移、范围读取/完备性和状态 | 纵向连续事项月历、跨日条及实际命中日清单，替换横向计数日历 | 3.2, 3.3, 3.4 |
| 2 首页卡片 | H01–H03 | 原数据范围和顺序不变，确认契约即可 | 少量预览、整页滚动、先清单再详情，替换卡片内滚动/直接详情 | 3.1 |
| 3 表单置顶 | F01–F05、C06 | 独立偏好存储与授权，完整筛选结果分组/排序/分页策略 | 新详情按钮及独立状态，不复用月视图置顶 | 6.1, 6.3 |
| 4 节假日 | Q01、Q05、C10 | 来源核验、按年获取、校验缓存、自有接口、维护说明 | 月/日展示节名及休/班，不改变排期与提醒 | 10.2 |
| 5 日志填充 | L06、D02、L03 | A 提供 `/work-logs/fill-source` 完整两组名称及明确失败语义 | 主动追加、分组去重、含完成、不动关系状态、失败保留正文 | 7.3 |
| 6 手机拖动 | C08–C10 | 原授权/版本/审核保留；不把日轴限制错误施加给全部排期接口 | 长按/震动、二维全局月拖、自动滚动及日轴最终边界，含取消/键盘路径 | 5.7, 5.8, 5.9 |
| 7 入职时长 | P03、O01 | 真实日期维护/访问范围及公司日期下完整年月日 tenure 投影 | 直接渲染服务端 tenure/asOfDate，缺失空态，自己/下属统一，不独立重算 | 8.1, 10.4 |
| 8 日志所属日 | L02、L05 | 复用现有 businessDate 排序和真实首次创建时间 | 修正客户端重排与卡片日期，不改变冻结窗口 | 7.1, 7.2 |
| 9 组织与联系方式 | P01、P04、S01 | 实际管理链下属详情邮箱扩权，普通摘要不泄露 | 去身份展示、实际职务路径/实心三角、长路径可读 | 8.1, 8.3 |
| 10 人员日程 | S01–S04、N02 | 复用有权人员日程数据及分页，确认连续范围可完整加载 | 连续月历、固定清单操作、返回恢复，只读且日志仍是列表 | 8.4, 8.5 |
| 11 通知 | I01–I07 | 复用动态分类/组合过滤/全局未读及安全投影，回归关键状态 | 六标签/三分段/单切换图标/固定筛选/返回状态，保留生命周期 | 9.1, 9.2, 9.3, 9.4 |
| 12 动画演示 | Q03、O02 | 稳定真实四角色管理链，持久业务种子，极限夹具分离 | 用真实账号完整展示新旧业务，不用临时 UI 改名/假状态 | 10.3 |

## 4. 全部 J01–J32 验收路径

各任务先完成局部验证，11.1 使用真实服务汇总全部旅程，11.2/11.3 补真实设备和构建证据，11.4/11.5 回填完整映射与实际命令。下列任务不能只用截图证明；路径中的失败、失权、并发、返回及日期边界同为范围。

| 旅程 | 验收对象 | 主要 B 任务 | 证据层/依赖 |
| --- | --- | --- | --- |
| J01 | 登录与改密: 四类员工真实账号登录；初始/重置强制改密只能访问允许接口，密码边界/旧密码错误；改密重新登录；PC 管理员仍独立可用，员工端不接受管理员账号。 | 2.4, 2.5 | Flutter + real API + Android device |
| J02 | 会话、权限与账号隔离: 正常恢复/刷新/退出，改密撤销全部会话、停用/改组织后旧页面失权；A 账号退出后 B 账号看不到缓存、草稿或迟到响应。 | 2.4, 2.6, 10.4 | Flutter + real API + Android device |
| J03 | 并发与网络不确定: 同一写请求超时后同键重试只生效一次，改体换键；缺/旧版本给明确反馈且保留草稿；旧权限缓存不返回旧成功；切筛选/人员的迟到响应不混入当前列表。 | 2.2, 2.3, 2.6 | Flutter + real API |
| J04 | 首页完整关系: 创建超十条各类任务，验证本人当前负责/未完成/分派时间顺序及十项上限；卡片约三条预览、无内滚，整页可滚；卡片→全清单→任务详情→原位置，事件纪 PC 维护回读。 | 3.1 | Flutter + real API + Android device |
| J05 | 跨日事项: 升级旧单日保留内容/完成/ID；新建跨周/月/年范围，多日清单是同 ID；命中续接段按实际日开清单；已完成也可读，一次完成所有日期一致，按结束日逾期，取消/删除和返回稳定。 | 3.2, 3.3, 3.4 | Flutter + real API + Android device |
| J06 | 事项私密及全量维护: 他人/实际上级/管理员均不能通过 ID/范围获取私有事项；超一页、长标题、密集事项全量可达，失效版本不覆盖，完成按钮不误开详情，滚动不误点。 | 3.2, 3.4 | Flutter + real API |
| J07 | 创建、候选与输入: 四角色初始负责人不同，可移除本人、跨部门/上级/创始人选择并保存顺序；取消选择回滚，失效/跨公司拒绝，无联系方式泄露；无新建完成标准，历史标准可读/合法编辑，全天快捷和分钟值正确。 | 4.1, 4.2 | Flutter + real API + Android device |
| J08 | 创建审批与重提: 非创始人提交不进正常列表/首页/日历/分析；直属上级审批发布；拒绝/失效原申请人改后建新请求，旧按钮不可生效；创始人合法免审留因，其他无上级阻断。 | 4.1, 4.7, 4.9 | Flutter + real API |
| J09 | 字段编辑与单一申请: 非创建者当前负责人可改普通资料+进展一次审批，但不能换序/改负责人；创建者在任/接管人合法改有序负责人；待审冻结、有效版不提前改，diff 仅审核人可见、变化字段原上新下，批准原子生效，拒绝/撤销不部分写。 | 4.4, 4.8, 4.9 | Flutter + real API |
| J10 | 父子关系: 名称搜索、清空、同名候选、深层循环拒绝；隐藏关联不因编辑自动丢失；父子各自授权，子完成不自动改变父状态或生成百分比。 | 4.3 | Flutter + real API |
| J11 | 进展、完成、重开与来源: 首次有效进展进入进行中，完成批准/退回/撤销三分支；仅有权业务责任方重开，带完整新排期/轮次；失败仍完成，接管/交接/重开不改原创建者/时间或“我创建”。 | 4.5, 4.6 | Flutter + real API |
| J12 | 审核路由、改派和截止: 四层真实链按申请人直属上级路由；审核前组织变更、申请人失资格、旧审核人/并发决定、准确截止失效/解冻；申请结果和专用 diff 裁剪，提交预览不代替保存结果；提醒分别验证剩余 20%/10%/5%、迟扫跳旧节点、完成/待审静默、零工期及排期/轮次去重，通知创建者/当前负责人不重复。 | 4.7, 4.8, 4.9, 9.1, 10.4 | Flutter + real API + A/PC evidence |
| J13 | 交接和预设: 本人/直属管理者合法候选及预设读写清除，间接上级或同级不越权；专用交接仅替换来源位置，不夹带资料，不通过全公司创建候选扩权，按申请人审核。 | 4.10 | Flutter + real API |
| J14 | 全局表单与两种置顶: 使用超 100 条且跨多后端页数据，验证本人原创建/负责并集去重、组合筛选、六排序及相同值 ID 升序、计数/50 条分页；后页任务置顶能进入前组且筛掉仍不显示；月置顶与表单置顶资格/状态独立，重登保留且失权不复活。 | 5.6, 6.1, 6.2, 6.3 | Flutter + real API + Android device |
| J15 | 日历时间与显示: 仅本人负责含完成，排除只创建/待创建/历史任务；跨年/月/周、午夜截止、零时长、旧全天、定时整日覆盖；超五重叠和全天项全部可点，第一标签色/删除快照/默认粉色稳定，显示不改提醒排期。 | 2.1, 5.1, 5.4, 7.4 | Flutter + real API + Android device |
| J16 | 本人日历完整入口: 月连续补载/失败重试及密度保存，日期定位/回今天/侧栏/申请/表单/创建入口；命中条中间日期→日清单→详情/日轴→返回，保留月位置/清单滚动，抽屉关闭恢复焦点且底层不误操作。 | 5.2, 5.3 | Flutter + real API + Android device |
| J17 | 手机月历拖动: 真机长按后仅一次轻震，激活前滚动；二维跨星期行/月/年及边缘自动滚动；续接段整条平移保留工期、真实端点才缩放；原因确认/审核，取消/无位移/系统中断/无效目标不提交、不误开详情。 | 5.7, 5.8, 11.2 | Flutter + real API + Android device |
| J18 | 日轴最终边界: 横/纵两模式及键盘路径：初始资格正确，按小时增量保留分钟，移动/拉端后 00:00/24:00 可为边界，跨零点拒绝且不换日；旧全天/跨日/整日覆盖不可因此拖动；详情合法跨日编辑仍可提交。 | 5.9, 11.2 | Flutter + real API + Android device |
| J19 | 待审投影闭环: 需审重排只在提议位置一份虚线且说明一致，详情/表单/提醒旧版；批准、拒绝、撤销、失效分别回到正确位置及解冻，不泄露完整提议/diff。 | 5.5, 4.9 | Flutter + real API |
| J20 | 日志全生命周期: 今天/昨天/前天缺失日创建，一天唯一，重复不自动变编辑；列表/卡片按 businessDate，详情标真实 createdAt，首次创建+24h 边界、删除重建不延长；冻结不编辑、仍合法评论，任务选择和失败返回保草稿。 | 7.1, 7.2 | Flutter + real API + Android device |
| J21 | 日志填充: 今天补昨天/前天，按所属日提取全部本人事项及正常负责任务，含完成，跨日 ID 去重、午夜不多算一天；分组追加到已有正文且可改，不改关联/状态；无内容、读失败和冻结界面正确。 | 7.3 | Flutter + real API + Android device |
| J22 | 标签维护与历史: 只有固定创始人能维护目录，管理员/其他员工拒绝；任务/日志有序多选、取消重选、省略/清空、逻辑删除快照和新引用拒绝；任务随审核、日志受冻结，跨入口顺序/颜色相同，无私人覆盖。 | 7.4, 7.5 | Flutter + real API |
| J23 | 评论与失权消息: 当前有权对象平铺分页，作者编辑/删除本人评论，完成/待审/日志冻结不阻断独立评论；仅目标负责人/日志作者接通知且排除本人，删评论/撤权后摘要及历史跳转均不恢复，不能借通知评论。 | 7.6, 9.4 | Flutter + real API |
| J24 | 下属完整只读路径: 真实直接/间接下属树、资料、日程、日志可用；同一任务本人也有创建/负责身份时，嵌套路径仍仅评论且无交接预设/置顶/审核；连续跨年补载、日清单标题/按钮固定、详情返回保持人员/日期/滚动，各人独立，日志不变月历。 | 8.3, 8.4, 8.5 | Flutter + real API + Android device |
| J25 | 资料、联系方式和时长: 仅本人改头像/邮箱，预设/选图/压缩错误可恢复；姓名电话只读；闰日/月末/周年/业务时区边界与缺失入职日期；去身份显示、真实职务路径缺层不造值；实际链上级仅下属详情看邮箱，同级/摘要不泄露。 | 8.1, 8.2 | Flutter + real API + Android device |
| J26 | 通知全生命周期: 六类×三已读状态跨页过滤计数，动态需我审核和全局未读；切模式不标读、打开才标读，返回保状态；绑定原申请、合法差异和对象跳转，隐藏/严格 180 秒撤回/申请撤销分别验证，三日历月清理；普通历史任务仅专用只读，失效评论不能走例外。 | 9.1, 9.2, 9.3, 9.4 | Flutter + real API + Android device |
| J27 | 统计与建议: 四角色范围/时间/状态/紧急程度及实际关键词/来源可核对；无权来源不跳转，组织变更后重新授权；无数据/失败可解释，不用前端固定数字。 | 10.1 | Flutter + real API + Android device |
| J28 | PC 与跨端组织变化: 管理员维护入职日期、账号/重置密码、职位/组织计划、负责人唯一等不变量；停用需接任/交接/未决处置/正式接管，移动权限和审核更新；公司事件纪、完整任务历史/免审原因/审计仍可查，员工不能查询完整历史。 | 10.4 | Flutter + real API + A/PC evidence |
| J29 | 迁移与持续运行: 空库和既有库升级结果一致，历史 Flyway 校验不变；旧事项/标签/日志/任务来源无损，备份恢复；准备/重启不覆盖业务修改，普通启动不重置库；过渡 Web 不损坏跨日数据，失败可安全回退。 | 1.1, 10.3, 10.4 | Flutter + real API + A/PC evidence |
| J30 | 安卓交付与系统行为: 记录 Flutter/SDK/构建及 APK 安装证据，真机连真实后端；系统返回先关闭正确层级、键盘/安全区/长名称/字体放大可用；选图取消/权限失败、长按震动、前后台/进程重建、断网重试/重登和有效网络/TLS 配置，无跨账号残留。 | 11.2, 11.3 | Flutter + real API + Android device |
| J31 | 节假日: 已公布年度的节名及休/班与权威安排一致；普通周末与调休区分，跨年、非法日期/重复冲突拒绝、刷新失败保缓存、未知/未公布年无伪造数据；月/日同步、任务/提醒结果不因标识改变。 | 10.2 | Flutter + real API + A/PC evidence |
| J32 | 动画四角色演示: upper 苏景昕→middle 苏格拉底→product-head-1 柏拉图→employee 亚里士多德为真实链，稳定 ID/真实账号；每人约 10–20 条有意义任务及自己的事项/日志/通知、近期真实排期与审批主线；普通演示不灌满测试用语，极限夹具仍可独立加载验证 J06/J14/J15。 | 10.3 | Flutter + real API + A/PC evidence + Android device |
