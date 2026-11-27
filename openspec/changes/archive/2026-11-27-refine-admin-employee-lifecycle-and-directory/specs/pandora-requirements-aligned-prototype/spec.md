## ADDED Requirements

### Requirement: Admin employee directory search and filters

管理端员工列表 SHALL 保留搜索并增加可组合筛选，至少包含部门、团队、组织身份、在职状态及展示职位。搜索和筛选 SHALL 由服务端按同一条件计算列表与总数，结果使用稳定排序；清空条件后 SHALL 恢复完整员工目录。筛选选项 SHALL 来自当前组织与展示职位，不伪造不存在的部门、团队或身份，不因管理员身份扩大到业务人员目录之外。

筛选不得改变手机号、身份证号或员工详情权限；列表只显示该管理接口原本允许的字段。无匹配结果、加载失败和权限失败 SHALL 有明确状态，失败不得伪装成空列表。

#### Scenario: Combine directory filters and search
- **WHEN** 管理员选择部门、团队、组织身份、在职状态和展示职位中的多项，再输入姓名或手机号搜索
- **THEN** 列表和总数 SHALL 只包含同时满足全部条件的员工，顺序稳定；清空后恢复完整目录

#### Scenario: Keep filter options and failures truthful
- **WHEN** 组织调整后重新打开员工筛选，或筛选请求失败
- **THEN** 选项 SHALL 反映当前组织与职位，失败 SHALL 保留已有列表并显示可重试错误，不返回伪造空目录或越权人员

### Requirement: Admin employee identity document privacy

管理端入职 SHALL 要求填写身份证号，并校验 18 位格式及校验位；同一公司内非空身份证号 SHALL 唯一。身份证号只在管理员员工详情和受控编辑入口完整显示，员工列表 SHALL 脱敏显示，不得在普通日志、操作历史详情、通知、任务、人员摘要或公共错误中回显完整号码。

身份证号 SHALL 不进入员工 App、员工 Web、任务候选人、负责人摘要、日志、通知、统计、分析或普通人员目录的接口投影；只有本公司独立管理员通过专用员工管理接口可读取。管理员更正身份证号 SHALL 使用版本校验并记录字段变更事实，不记录完整号码值；非法、重复或旧版本输入 SHALL 整体拒绝且不部分保存。

#### Scenario: Validate and mask an identity number
- **WHEN** 管理员创建或更正员工并提交合法、非法、重复或旧版本的身份证号
- **THEN** 合法且唯一的号码 SHALL 原子保存；非法、重复或版本冲突 SHALL 拒绝并给出中文提示，列表显示脱敏值，管理员详情可读完整值

#### Scenario: Keep identity numbers out of employee projections
- **WHEN** 员工 App、员工 Web、负责人候选、通知、日志或统计读取员工资料
- **THEN** 响应 SHALL 不含身份证号字段，普通管理员以外的身份也不能通过员工管理接口读取

### Requirement: Admin dedicated employee onboarding

管理端员工页 SHALL 提供独立入职流程，直接完成员工账号与组织位置创建，不要求先进入或保存整张“组织调整”计划。入职 SHALL 同时收集姓名、登录手机号、身份证号、真实入职日期、组织身份、必要部门/团队及必填展示职位，并沿用现有手机号规范化、唯一性、初始密码和首次改密规则。

独立入职 SHALL 复用现有组织、负责人、职位、版本和初始密码原子校验；普通员工、团队负责人和部门负责人按其位置规则校验。若新增会制造第二创始人、替换既有单位负责人、跨部门团队或其他需要同时安排多人去向的结构变化，系统 SHALL 拒绝单独入职并提示到组织调整处理，不得静默覆盖负责人或留下中间状态。

入职失败 SHALL 不创建账号、不写组织位置、不消耗初始密码或产生孤立人员；成功后 SHALL 一次性显示初始密码，员工列表和本人资料立即按新位置回读。独立入职 SHALL 与并发组织调整、重复手机号、重复身份证号和组织版本冲突安全竞争，只提交一个合法结果。

#### Scenario: Create an employee directly from the employee page
- **WHEN** 管理员在已有合法部门/团队下独立入职一名普通员工并提交完整资料
- **THEN** 系统 SHALL 立即创建账号、合法位置和展示职位，显示一次性初始密码；员工页与组织树按新结果刷新，不要求保存组织调整草稿

#### Scenario: Route structural conflicts to organization adjustment
- **WHEN** 管理员独立入职时选择已占用单位负责人位置、第二创始人、跨部门团队或其他需要多人同时调整的位置
- **THEN** 系统 SHALL 拒绝该次独立入职并说明转组织调整，不修改原负责人、账号或组织版本

#### Scenario: Fail onboarding atomically
- **WHEN** 独立入职遇到重复手机号、重复身份证号、非法日期、旧组织版本或并发组织调整
- **THEN** 系统 SHALL 不创建部分账号、位置或密码，原组织与业务保持不变，管理员可按最新数据重试

### Requirement: Admin dedicated employee offboarding

管理端员工页 SHALL 提供独立“办理离职”流程，不要求编辑整张组织调整计划。离职 SHALL 复用现有责任盘点和原子停用规则，处理未完成任务负责人交接、单位负责人继任、下属去向、未发布创建申请办结或撤销、待审审核承接、已发布任务后续修改/重开责任及业务接管，并撤销离职员工会话。

离职 SHALL 校验员工当前组织版本、任务版本、单位负责人继任、合法接管人、待审状态和未发布申请；任一必要环节未安排、版本过期、权限不足或并发变化 SHALL 拒绝整次离职，不产生无人负责单位、无负责人任务、停用审核人或双重业务责任。固定创始人 SHALL NOT 通过普通离职停用。

离职成功后 SHALL 保留原创建者、创建时间、任务历史、申请、通知、评论和业务接管记录；接管人得到既有约定权限，独立管理员不取得员工业务权。离职流程 SHALL 与组织调整、交接申请、审核决定及重复提交安全竞争，只提交一个合法结果。

#### Scenario: Offboard an employee with tasks and pending work
- **WHEN** 管理员从员工页为同时负责任务、待审申请和未发布创建的员工办理离职并完成各责任安排
- **THEN** 系统 SHALL 原子停用账号、撤销会话、生效交接/接管和申请处理，保留历史并刷新受影响的权限与通知

#### Scenario: Refuse incomplete offboarding
- **WHEN** 离职缺少单位继任、任务接收人、必要申请处理，或员工是固定创始人、版本已变化
- **THEN** 系统 SHALL 拒绝整次离职并指出缺失项，账号、组织、任务、申请和会话均不改变

#### Scenario: Compete safely with organization changes
- **WHEN** 离职与组织调整、交接审核、重复提交或旧版本请求并发
- **THEN** 系统 SHALL 只提交一个合法最终结果，失败方保留原组织与业务，不产生已停用审核人或复活旧申请

### Requirement: Admin soft-deleted task history

管理端任务历史 SHALL 识别并筛选已软删除任务，显示删除状态、删除时间和删除人；任务版本、字段变更、申请、审核决定、改派、交接、业务接管、评论及删除记录 SHALL 继续可查。已删除任务在历史列表中 SHALL 与正常任务区分，不能因删除而消失，也不能重新开放任务详情、评论或其他正常业务写操作。

已删除任务的历史 SHALL 不包含完整身份证号、密码或他人手机号之外新增的敏感字段；任务删除不级联删除通知、申请或日志，历史查询 SHALL 按原任务标识稳定返回。管理端查询删除任务历史 SHALL 使用现有任务历史权限，不扩大管理员业务权。

#### Scenario: Locate and inspect a deleted task
- **WHEN** 管理员在任务历史中筛选已删除任务并打开一条有版本、申请和接管的记录
- **THEN** 系统 SHALL 显示删除状态及完整历史，正常业务入口不可用，其他任务和通知/申请记录不受影响

#### Scenario: Keep deleted history separate from live work
- **WHEN** 管理员在历史列表同时查看正常任务与已删除任务
- **THEN** 两类 SHALL 有明确状态区分，已删除任务不能被误当成可编辑任务，正常任务历史不受影响

### Requirement: Admin console error and irrelevant copy safety

管理端用户可见错误 SHALL 使用中文、面向管理员的说明，不得直接显示原始异常、堆栈、HTTP 状态、数据库或框架信息、内部错误码或英文请求字段名。校验、权限、版本冲突、组织约束、服务失败和会话失效 SHALL 保持可区分，并提供修改输入、刷新、重新读取或重新登录等可执行下一步。

管理端当前可达界面 SHALL 清理与当前业务操作无关的 AI 式提示、防御性声明和“只为避免误解”的说明文字，不保留原型、开发过程或内部实现解释；必要字段名称、空态、校验、危险确认、待审/冻结/失权状态、业务接管原因和历史来源 SHALL 保留并简洁呈现。清理不得删除真实业务内容、审核意见、公司信息、任务正文或历史记录。

#### Scenario: Hide raw administrative failures
- **WHEN** 管理端接口返回未预期异常、校验失败、组织约束冲突或旧版本
- **THEN** 页面 SHALL 显示中文可操作提示，不出现原始异常文本、英文请求字段、堆栈或内部技术标识

#### Scenario: Remove unrelated defensive copy without losing business context
- **WHEN** 管理员访问员工、组织调整、离职、任务历史、通知、公司信息和账号等当前可达界面
- **THEN** 与业务无关的 AI 式或防御性说明 SHALL 被移除或改写，必要操作说明、危险确认、状态、原因和历史仍完整可读
