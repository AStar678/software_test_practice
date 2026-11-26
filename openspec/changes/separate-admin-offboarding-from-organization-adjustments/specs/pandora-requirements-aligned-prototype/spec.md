## ADDED Requirements

### Requirement: Synthetic identity documents in the default demo

显式准备当前版本的新演示库或受控重建演示库时，默认演示员工 SHALL 有互不重复、通过入职同等格式及校验位校验的合成身份证号，不使用真实个人号码，不给独立管理员生成员工证件。演示职位「总导演」 SHALL 改为「创始人」，仅改展示名称，不更改组织身份、位置、汇报关系、账号或权限。正式业务库、普通启动、保留模式及重复准备已存在的演示库 SHALL 保留已有编辑，不补写或替换证件和职位。

#### Scenario: Prepare a fresh demonstration directory
- **WHEN** 用当前种子显式准备演示库，管理员打开员工列表和详情
- **THEN** 演示员工的证件 SHALL 按既有规则脱敏与展示，完整号码可精确搜索；展示职位为「创始人」，真实创始人身份与权限没有因改名而改变

#### Scenario: Preserve existing data
- **WHEN** 在正常业务环境启动，或在已编辑的演示库上用保留模式重复准备
- **THEN** 系统 SHALL NOT 写入演示职位或合成证件，也不覆盖已有值

## MODIFIED Requirements

### Requirement: Organization and administration

系统 SHALL 提供独立 PC 浏览器 Web 管理端（`/admin.html`），仅独立管理员可维护员工、部门、团队、负责人、展示职位和人员位置，并查询完整任务历史、维护公司信息与通知。组织 SHALL 固定为一位 Founder → 每部门一位 Department Head → 每团队一位 Team Head → Employee；每人仅一个位置，不兼任、副职、联合负责人或多管理链，普通员工必须归团队、团队必须归部门。直属上级和层级 SHALL 从位置唯一推导，创始人身份有明确固定依据，不用任意无上级根节点猜测；普通管理流程不提供创始人交接、调任或停用。创始人为公司层、部门负责人为部门层、团队负责人及普通员工为部门团队层；所有业务员工职位必填且仅用于展示，不作为授权来源。每公司一位独立管理员，不占员工位置且无默认员工业务权。

员工 App SHALL 保持五个主导航且不嵌入完整管理员维护模块，管理员入口提示 SHALL 指向真实 PC 管理端。管理端能在窄屏打开不改变其 PC Web 交付定位；管理员身份 SHALL 不自动授予员工业务权限，业务账号直连管理 API SHALL 仍被拒绝。

创建部门/团队 SHALL 同时安排有效负责人，负责人可为首位且唯一成员；可在编辑草稿准备完整结构方案，正式保存不得出现无人负责单位。新员工 SHALL 从独立入职流程同时提交合法位置与职位。调岗直接切换，更换负责人同时安排新旧负责人和下属，删除单位先安排人员去向。跨多人/单位调整 SHALL 校验完整最终结果后原子提交，失败保留原组织；并发版本与唯一性校验 SHALL 防止双负责人、无人负责、跨部门团队、环和悬空链，权限版本及待审刷新同事务完成，读取只观察合法旧/新状态。

组织调整页面和保存接口 SHALL 只受理部门、团队、岗位负责人和人员位置等组织结构变更，SHALL NOT 接受入职、停用、任务执行交接、任务管理权接管或撤销申请的指令。组织调整 SHALL NOT 自动重写已发布任务的执行负责人、任务管理权或已办结审批；有效待审审核人和可见范围仍 SHALL 随当前组织关系更新。页面 SHALL 只在存在组织异常时展示具体问题和可执行下一步，不常驻「正常」卡或停用、接管、撤销草稿摘要。

系统 SHALL 删除“角色与授权”、自定义业务范围及员工团队管理入口，不以可编辑旧角色、能力、等级作为第二权限来源；固定四层标记仅可展示。员工直接调用旧团队/组织/授权写入口 SHALL 被后端拒绝。

管理员 SHALL 在正式 PC 员工独立入职和既有员工编辑入口维护真实 `hireDate`，各入口保留各自既定必填或可空约束。允许缺省的字段适用既有规则：合法 ISO 日期不得晚于公司今天；省略字段保留既有值，允许清除时显式 `null` 表示未设置。存量未知日期 SHALL 保持 `null`，不由账号创建时间填造。日期提交 SHALL 与其他创建/资料字段一起版本校验、原子保存；员工本人和业务管理者不得维护，非法或旧版本输入不部分写入、不半建账号。

#### Scenario: Maintain an employee through the administrator interface
- **WHEN** 管理员创建不同位置员工并设置合法组织与必填展示职位
- **THEN** 保存 SHALL 持久化唯一合法位置及推导上级，创始人不要求部门团队、部门负责人不要求团队；缺职位、普通员工无团队、第二创始人/管理员或非法引用拒绝

#### Scenario: Maintain teams independently of departments
- **WHEN** 管理员创建部门与团队并同时安排负责人，负责人是新单位首位成员
- **THEN** 系统 SHALL 允许无普通员工但有合法负责人单位，团队必属部门，每单位一负责人且每人一位置，正式保存无负责人拒绝

#### Scenario: Transfer updates independent scopes
- **WHEN** 管理员调岗或替换负责人，且一个待审申请的申请人直属上级因此改变
- **THEN** 合法完整结构 SHALL 原子生效，旧版本冲突不写入；有效待审 SHALL 改派并撤销旧审核人的权限，可见范围按新结构更新，任务负责人、任务管理权和已办结审批不改

#### Scenario: Refuse lifecycle and task writes in organization adjustments
- **WHEN** 旧客户端向组织调整提交入职、停用、执行交接、管理权接管或撤销安排
- **THEN** 接口 SHALL 拒绝整次保存，不部分执行结构或业务变更；页面只在有组织阻断时显示可处理的问题

#### Scenario: Maintain and reorder company information
- **WHEN** 管理员增改删公司信息或调整展示顺序
- **THEN** App SHALL 只读展示管理顺序，默认按创建时间排序；并发新增也 SHALL NOT 超过十条，业务账号的维护请求 SHALL 被拒绝

#### Scenario: Use the independent PC administration interface
- **WHEN** 管理员在电脑浏览器建号并完成组织、公司信息、离职交接、任务历史和通知管理，员工从 App 使用业务或直连管理 API
- **THEN** 管理端 SHALL 承接已授权管理流程，App SHALL 不出现完整管理模块，员工 SHALL 无法越权调用管理 API，管理员误入业务页提示 SHALL 指向 `/admin.html`

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
- **WHEN** 管理员独立入职或编辑既有员工的入职日期
- **THEN** 各路径 SHALL 保持既有可空性并采用同一日期校验；回读与本人/授权下属详情一致，组织/位置不变量和初始密码一次回显不变

#### Scenario: Keep hire-date updates atomic and administrator-only
- **WHEN** 管理员以旧版本提交姓名/日期，独立建号含非法日期，或员工/其他公司请求维护
- **THEN** 系统 SHALL 拒绝且不部分修改或建号，既有凭证、原始时间及组织关系不被日期字段绕过，员工读取接口保持只读

### Requirement: Atomic employee deactivation and formal business takeover

管理员 SHALL 在同一离职提交中处理未完成任务的执行负责人、部门/团队负责人继任及下属位置、本人待审申请、他人待审审核改派和已发布任务管理权，并停用账号和撤销会话。固定创始人不允许普通离职。接手人和接管人 SHALL 是本公司有效业务员工且不能是离职人；独立管理员不获得任务执行、管理或审核权限。

当前未完成任务 SHALL 在提交后保留至少一位有效负责人。有其他有效负责人时，管理员 SHALL 可明确选择仅移除离职员工，也可指定接手人；没有其他有效负责人时 SHALL 必须指定接手人。此离职动作 SHALL 只调整该员工的执行指派、记录原因和前后负责人，不改任务内容或当作普通任务申请获批。已完成任务的历史执行负责人 SHALL 保留，重开时按现行规则校验。

附属于该员工的已发布任务管理权 SHALL 逐项转移，包括已完成任务，不因其同时是执行负责人而合并。正式接管 SHALL 留存对象、前后责任方、办理人、时间和原因，不覆盖原创建者、创建时间或历史来源，同任务只允许一个当前管理权持有人。接管人 SHALL 获得现有正常访问、任务资料/负责人修改、重开及适用的软删除权；不自动成为执行负责人、原创建人或审核人，不计入其「我创建」。已软删除任务不作为需要重新分配的活跃对象，其历史保留。

管理员确认后，离职员工本人提交且仍有效的待审申请 SHALL 以「因离职撤销」统一办结，保存原申请人、申请记录、办理人、时间和原因，不冒名转交、通过或伪装成自然到期。已批准、已撤销或已过期的申请 SHALL 不改写。由离职员工负责审批的他人待审 SHALL 按原申请人的当前直属上级改派，原审核人失权；不得自动撤销或由任务接管人兜底。若仍有效的第三方申请在最终结果中无法合法改派、包含离职拟任负责人或与交接后的任务版本冲突，SHALL 提示具体申请及阻断原因，不静默替换拟任人、改写提案或撤销申请。

系统 SHALL 重新校验申请状态和截止、任务及组织版本、继任、有效接手/接管人及全部最终结果。交接、接管、申请撤销/改派、岗位继任、会话撤销及相关历史通知 SHALL 原子提交；任何必要项缺失或冲突 SHALL 拒绝整次离职，保留未提交状态与原数据。普通员工端交接和审核仍按现行授权及审批执行。

#### Scenario: Keep a live task assigned when an employee leaves
- **WHEN** 一项任务还有其他有效负责人，另一项任务只有离职员工一位有效负责人
- **THEN** 第一项 SHALL 可仅移除离职人或选择接手人，第二项 SHALL 拒绝缺接手人的提交；成功后保留有序有效负责人及交接记录

#### Scenario: Take over published work without impersonating its creator
- **WHEN** 管理员为包含已完成任务的已发布任务逐项指定有效接管人
- **THEN** 接管人 SHALL 获后续管理权，原创建者及创建时间不变，接管人不自动加入任务负责人或取得审批权，管理员不获得业务权

#### Scenario: Reopen taken-over completed work with active assignees
- **WHEN** 已完成任务保留已停用的历史负责人，接管人重开并提交有效负责人及完整未来排期
- **THEN** 系统 SHALL 按实际申请人直属上级审批及固定创始人免审规则办理，保留创建来源并增加执行轮次；缺有效负责人、排期或版本冲突时不生效，不自动把接管人加入负责人列表

#### Scenario: Withdraw own pending requests and reassign others
- **WHEN** 离职人同时提交了不同类型的有效待审申请，并审核其他员工的待审申请，且确认统一撤销本人申请
- **THEN** 只有本人有效待审 SHALL 标记为因离职撤销并留痕，撤销与停用共同生效；其他仍合法的待审 SHALL 改派并保留原申请人、原提案与改派记录，已终结或到期的申请不复活

#### Scenario: Deactivate an employee only after all responsibilities are arranged
- **WHEN** 缺继任、有效接手人、管理权接管人、本人撤销确认，或存在无法改派/涉及离职拟任人的他人申请、待审决定或版本冲突
- **THEN** 系统 SHALL 指出受阻对象，拒绝整次离职，不部分改派、交接、停用或撤销会话

#### Scenario: Refresh valid reviews and revoke old authority atomically
- **WHEN** 离职接管、组织调整、旧审核决定、截止扫描或相同请求重放发生竞争
- **THEN** 系统 SHALL 仅提交一个合法最终结果，有效申请按原申请人当前直属上级刷新并留痕，旧审核人和停用会话立即失权，过期或终态不复活，固定创始人免审只在全校验后直接生效

### Requirement: Admin dedicated employee offboarding

员工列表的「办理离职」 SHALL 是唯一离职入口。管理员选择员工后，系统 SHALL 读取该员工的当前责任；没有交接、继任或申请事项时直接进入离职确认，有事项时打开该员工专属的「离职交接」，不要求重新选离职员工或保存组织调整草稿。旧独立「业务责任盘点与接管」导航和可绕开离职的管理员接管写入口 SHALL 不再可用；已存在的接管历史和权限不被删除。

页面 SHALL 分开展示任务执行交接、任务管理权接管和必要的岗位继任。执行接手人和管理权接管人 SHALL 支持按姓名搜索，候选展示部门/团队以区分同名员工，切换搜索不丢已有选择，只提供符合该项资格的员工。待审列表 SHALL 显示任务名称、中文申请类型和明确处理结果，区分「本人提交，确认后撤销」和「由本人审批，将重新分配」，对第三方申请中的拟任负责人冲突或不可改派给出单独阻断。页面 SHALL NOT 显示申请内部编号、英文类型码或将审核笼统描述为由任务接管人承接。最终确认 SHALL 明确列出将撤销的本人申请及数量，未经确认不能撤销。

离职成功后 SHALL 保留原创建者、创建时间、任务历史、申请、通知、评论和业务接管记录；离职与组织调整、业务交接、审核决定及重复提交并发时只允许一个合法最终结果。固定创始人 SHALL NOT 通过普通离职停用；失败 SHALL 保留原组织、账号及业务状态，并提示如何处理或刷新。

#### Scenario: Enter only the workflow needed for the selected employee
- **WHEN** 管理员分别为无责任事项员工、存在交接或继任事项员工从员工列表办理离职
- **THEN** 前者 SHALL 直接进入确认，后者 SHALL 打开该员工的离职交接；取消或离开都不把安排暂存到组织调整

#### Scenario: Search candidates and understand pending work
- **WHEN** 管理员搜索同名接手人，并查看离职人的创建、完成申请及其代审的他人申请
- **THEN** 选人 SHALL 可凭部门/团队区分且保留已选项；申请 SHALL 以任务名称与中文类型展示，明确撤销、改派或阻断结果，不展示英文类型码和内部编号

#### Scenario: Offboard an employee with tasks and pending work
- **WHEN** 管理员为同时负责任务、管理任务和参与待审的员工办完离职安排并确认
- **THEN** 系统 SHALL 原子生效各项处理、停用账号与撤销会话，保留历史并刷新受影响的权限与通知

#### Scenario: Refuse incomplete offboarding
- **WHEN** 必要交接、接管、申请确认或继任缺失，员工是固定创始人，或版本不再有效
- **THEN** 系统 SHALL 不改原数据，指出具体缺项，版本变化时提示重新读取

#### Scenario: Compete safely with organization changes
- **WHEN** 离职与组织调整、交接审核、重复提交或旧版本请求并发
- **THEN** 系统 SHALL 只提交一个合法最终结果，不产生已停用审核人、重复应用或申请复活

### Requirement: Admin employee directory search and filters

员工列表 SHALL 提供独占一行的搜索框，窄宽窗口中支持字段名称不得被截断。搜索 SHALL 支持姓名、部门、登录手机号和完整身份证号；身份证号 SHALL 只由本公司独立管理员在服务端规范化后整号精确匹配（末位 `x` 和 `X` 等价），不得提供证件部分号匹配。列表 SHALL 仍脱敏且不得在列表响应、地址栏、日志或错误中回显完整身份证号；详情及既有入职必填、格式校验、唯一性和权限规则保持不变。

部门、团队、组织身份、在职状态和展示职位筛选 SHALL 可与搜索组合使用。列表和总数 SHALL 使用同一条件、结果稳定排序，清空后恢复完整目录。筛选选项 SHALL 来自当前组织与职位，不伪造选项或扩大权限。无匹配、加载失败和权限失败 SHALL 有明确且可区分的状态；失败不得伪装为无结果。

#### Scenario: Combine an exact identity lookup with directory filters
- **WHEN** 管理员选择部门等筛选并输入完整身份证号（含小写 `x`）或仅输入证件片段
- **THEN** 完整匹配 SHALL 只返回符合筛选条件的本公司员工，记录仍脱敏；证件片段不匹配证件，清空条件后恢复目录，非管理员无法使用该查找

#### Scenario: Combine directory filters and search
- **WHEN** 管理员同时选择多项筛选，并以姓名、部门或登录手机号查询
- **THEN** 列表和总数 SHALL 按组合条件计算且有稳定顺序，清空条件后恢复完整目录

#### Scenario: Keep filter options and failures truthful
- **WHEN** 窄宽窗口打开员工页，组织调整后刷新，或员工查找请求失败
- **THEN** 搜索 SHALL 独占一行且提示可读，筛选反映当前组织和职位；失败保留已有结果并显示可重试提示

### Requirement: Admin console error and irrelevant copy safety

管理端用户可见错误 SHALL 使用中文、面向管理员的说明，不得直接显示原始异常、堆栈、HTTP 状态、数据库或框架信息、内部错误码或英文请求字段名。校验、权限、版本冲突、组织约束、服务失败和会话失效 SHALL 保持可区分，并提供修改输入、刷新、重新读取或重新登录等可执行下一步。

管理端 SHALL 移除无关 AI 式、原型、开发过程、防御性说明，以及控件自身已表达的筛选、清空和排序说明，例如员工目录筛选提示及公司信息默认排序/可调序提示。结果数量、有意义的上限、必要字段、空态、阻断原因、危险确认、待审/冻结/失权提示、接管原因和历史来源 SHALL 保留并简洁呈现。清理 SHALL NOT 删除真实业务内容、审核意见、公司信息、任务正文或历史记录。

#### Scenario: Hide raw administrative failures
- **WHEN** 管理端接口返回未预期异常、校验失败、组织约束冲突或旧版本
- **THEN** 页面 SHALL 显示中文可操作提示，不出现原始异常文本、英文请求字段、堆栈或内部技术标识

#### Scenario: Remove unrelated defensive copy without losing business context
- **WHEN** 管理员访问员工、组织调整、离职、任务历史、通知、公司信息或账号界面，包括筛选员工和调整公司信息顺序
- **THEN** 页面 SHALL 不复述筛选或排序控件行为，搜索条件、计数、限制、必要风险说明和可处理原因仍可见，排序和真实业务内容不变
