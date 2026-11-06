## MODIFIED Requirements

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

### Requirement: Reschedule every visible active task
拥有正常查看权的已发布、未完成、非待审任务 SHALL 继续允许提交既有仅排期修改，无论是否创建人、当前业务责任方或负责人。服务端仅排期资格 SHALL 与页面是否提供拖动分开；不能因为本人视图仅列负责人任务而将接口收紧为仅负责人。基础资料及进展 SHALL 按本次字段权限办理，普通查看权不授予基础编辑；负责人列表仅创建者在任/正式接管人可改，执行状态仍走专用流程。

独立正常任务详情 SHALL 通过统一编辑入口提供精确排期，有更多字段权限时同表单展示；下属入口及嵌套详情仅允许评论，不提供排期编辑。审核仍按实际操作者直属上级，创始人按原规则免审；生效前重验正常可见性及仅排期差异，版本/冻结/完成限制保持。历史通知只读例外不是正常查看权，不能用于提交。

#### Scenario: Propose a schedule from an authorized detail without editing other fields
- **WHEN** 用户能正常查看有效任务但不能编辑其资料，从表单等独立正常入口进入任务详情，并按既有仅排期权限提交
- **THEN** SHALL 可提交日期/时刻与原因，待审新位置虚线显示；页面本身无拖动，夹带资料/负责人/标签、失权/完成/冻结/旧版本或仅有历史只读权的请求拒绝

#### Scenario: Separate normal rescheduling from subordinate browsing
- **WHEN** 同一有正常查看权者分别从独立正常入口和下属工作浏览打开任务
- **THEN** 独立正常入口 SHALL 依当前资格保留精确排期编辑，下属路径仅允许评论，不发起排期或其他业务写入；仅排期接口不接受越权资料及负责人变更

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

### Requirement: Personal task table and founder-only tag maintenance
任务表单 SHALL 仅显示本人原始创建或当前有效负责的授权任务，在搜索、计数和分页前排除仅可见的下属任务；不提供仅可见筛选。其他授权入口保持原范围。
公司共用标签目录创建、改名、改色、删除 SHALL 仅固定创始人可执行，服务端校验与canEdit一致；其他人员仅在任务/日志编辑中选择或清除。日程 SHALL 移除标签管理及图例行，任务只使用共用首项和默认颜色，全局移除私人标签及私人颜色覆盖。

#### Scenario: Inspect a manager's task table
- **WHEN** 上级同时可见本人创建、本人负责和仅下属负责的任务
- **THEN** 表单 SHALL 只保留前两类，搜索和总数不能恢复第三类

#### Scenario: Reject tag maintenance without removing task colors
- **WHEN** 普通员工通过界面或直接API维护共用标签或尝试创建已移除的私人标签
- **THEN** 系统 SHALL 拒绝维护，任务/日志编辑仍能选择清除；日程任务颜色保持，创始人在我的页面维护标签

## ADDED Requirements

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
