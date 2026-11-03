## ADDED Requirements

### Requirement: Reminder notification classification
通知 SHALL 将实际临期与逾期事件分类为提醒，列表、详情、筛选及数量一致；不改变投递对象、触发节点或保留期限。

#### Scenario: Filter emitted reminder events
- **WHEN** 用户筛选提醒且收到 task.reminder_20、task.reminder_10、task.reminder_5 或 task.overdue
- **THEN** 这些通知 SHALL 全部显示为提醒，不能归入其他

### Requirement: Permission-aware original request entries
通知 SHALL 绑定原申请并按当前申请访问权限决定入口。有权者可查看原申请和既有授权字段；无权者 SHALL 保留合法结果摘要并移除无效申请入口，不因接收结果取得申请、提议或比较权限。

#### Scenario: Follow a result to the exact original request
- **WHEN** 申请人或原审核人打开已办结申请的结果通知，任务另有后续申请
- **THEN** 入口 SHALL 打开通知绑定的原申请，状态与决定正确且无有效审核操作

#### Scenario: Receive a result without request access
- **WHEN** 普通相关负责人可读结果通知但无权查看原申请，或申请不存在、通知已撤回、对象已失权
- **THEN** 页面 SHALL 按既有摘要和历史只读规则展示，并隐藏无效申请入口；直接申请接口仍拒绝越权

### Requirement: Current personnel presentation
人员展示 SHALL 使用已授权的最新组织身份、职位及真实部门，缓存重复读取须更新已有条目，字段不完整的姓名摘要不能将已知身份降为员工或清空组织信息；人员资料 SHALL 不再展示公司行。

#### Scenario: Refresh a cached responsible person
- **WHEN** 先收到仅姓名的参与者摘要，再收到部门负责人或团队负责人的完整授权资料，随后再次收到姓名摘要
- **THEN** 所有负责人展示 SHALL 保留最新身份、职位和部门，不显示错误的“员工 · 部门负责人 · —”组合；资料无公司行

### Requirement: Subordinate task return context
从下属日程打开任务及其后续详情时，返回、头部退出和 Esc SHALL 逐层恢复原人员日程、月日模式、选中日期及可用浏览位置，不能直接跳回我的页面；重新读取仍重验当前权限。

#### Scenario: Return to a subordinate day or month
- **WHEN** 用户查看指定下属的非今日月或日模式，打开任务再返回或点击头部退出
- **THEN** 页面 SHALL 恢复同一下属、日期和模式，权限失效显示安全错误，不展示旧受限数据

### Requirement: Useful personal calendar pin entries
任务详情 SHALL 仅为本人当前有效负责且已发布的正常任务提供个人月历置顶入口；仅创建、组织可见、下属及历史只读任务均不得显示无效置顶按钮。

#### Scenario: Read an authorized task outside the personal calendar
- **WHEN** 用户打开仅可见或仅创建但不负责的任务，再打开本人有效负责的任务
- **THEN** 前者 SHALL 无置顶入口，后者保留置顶及取消置顶操作

### Requirement: Concise employee product copy
员工产品页面 SHALL 删除开发解释与冗长规则说明，保留必要输入校验、权限变化提示、业务状态、操作结果及简短统计来源。日志详情 SHALL 不展示编辑权限行，通过编辑按钮、冻结状态和冻结时间表达可操作性。

#### Scenario: Read a log and navigate normal product pages
- **WHEN** 用户查看可编辑本人日志、冻结日志、下属日志，以及任务、通知、个人资料和分析页面
- **THEN** 编辑按钮仅在原权限允许时出现，冻结状态可辨，无编辑权限行、重复公司行和开发实现解释；校验、结果与必要统计来源仍可读
