## ADDED Requirements

### Requirement: Distinct log creation and editing interfaces
创建和编辑日志 SHALL 使用分别组织的界面及独立操作模式，不能仅替换标题并禁用创建控件来充当编辑界面。“写日志” SHALL 只列公司今天、昨天、前天尚未创建且可创建的日期；已有记录从显式日志标识的编辑入口进入，编辑界面 SHALL 以不可修改的日期展示字段呈现原业务日期，不显示创建日期候选、补写或新建入口。

创建与编辑界面 SHALL 分别提供当前操作所需的标签、正文、可选关联任务及保存/返回/关闭，日期与标签保留统一标题、间距及对齐：桌面同排对齐，窄屏同列边缘对齐，日期展示字段与标签控件视觉对齐，不出现冗余禁用日期下拉框。全屏正文、滚动、焦点和嵌套关联任务选择返回 SHALL 可用；两种模式的草稿及提交目标不串用。

编辑 SHALL 只修改显式目标日志的允许字段，业务日期和真实首次创建时间不可改，成功编辑不重置首次24小时冻结。服务端作者、唯一性、冻结、版本及关联任务权限 SHALL 保持原规则；不能通过界面分离获得他人正文编辑权。失败/重复创建/过期或版本冲突 SHALL 保留当前操作的草稿并明确反馈，不自动切换创建与编辑、不覆盖别人的记录。删除重建继续沿用原冻结约束。

#### Scenario: Create only a missing recent log
- **WHEN** 今天已有日志、昨天和前天缺失，作者点击写日志
- **THEN** 创建界面 SHALL 只提供缺失可创建日期及创建所需内容，不进入已有日志编辑；三天都已写时提示从详情编辑，不打开伪创建/编辑混合界面

#### Scenario: Edit one explicit record without creation controls
- **WHEN** 作者从未冻结日志的编辑入口进入
- **THEN** 编辑界面 SHALL 展示该日志内容及只读业务日期，不出现近三天候选、日期切换/补写/新建控件；保存只更新该记录允许字段，日期和首次冻结时刻不变

#### Scenario: Preserve the draft through nested navigation and failed saves
- **WHEN** 创建或编辑时选择/清除关联任务后返回，或提交遇到重复日期、冻结、版本冲突或网络失败
- **THEN** 当前界面 SHALL 保留自己的日期、标签、正文及关联草稿，明确可执行反馈，不能把创建冲突转成编辑或把编辑保存成新日志；关联失权按原安全规则处理

#### Scenario: Align both interfaces and keep the personal page intact
- **WHEN** 在320、390和1440宽度分别创建、编辑日志，再进入卡片详情或人员日志后返回
- **THEN** 日期与标签 SHALL 按屏宽对齐、无截断横溢，正文和保存返回可达；本人日志列表、计数、直接点击详情、嵌套按钮和人员阅读隔离保持原规则

#### Scenario: Reject editing another author or an expired record
- **WHEN** 上级尝试编辑下属日志正文，或作者通过旧页面/直接请求修改已冻结记录
- **THEN** 系统 SHALL 拒绝并保留合法阅读/独立评论能力；不能借日志界面分离重置24小时窗口或绕过权限

### Requirement: Production interface copy without redundant implementation explanations
员工 Web 五个主页面、二级页/弹层、登录与账号流程及独立 PC 管理端的当前可达界面 SHALL 使用简洁、面向操作的正式文案。冗余业务规则长说明、原型/演示开发解释和内部技术标识 SHALL 移除或改写，不向用户描述组件复用、接口字段、实现限制或未交付工作的开发过程。不得仅按关键词批量删除所有说明。

标签选择区 SHALL 不再显示“标签由创始人统一维护，日志最多选择一个，任务支持多选；删除的标签不能再用于新的关联。”及相同用途的长说明；日志表单 SHALL 不再重复展示本人归属、上级只读及仅作者可编辑的规则段落。实际选择能力、标签状态和维护权限 SHALL 继续由控件/状态与服务端规则表达，不删除标签颜色或已删除标记。

必要字段名称、空态、校验错误、失败重试、破坏性操作确认，以及帮助用户判断的待审、冻结、只读、失权和审核结果 SHALL 保留并简洁呈现。分析页仍 SHALL 按原要求表达真实统计范围、生成时间及用户能理解的方法/来源，不展示原始方法代码，不删除 AI 地图功能或伪装外部模型能力。

本要求 SHALL 只改变产品静态文案/安全显示表达，不删除或改写任务、日志、评论、审核原因、历史及其他真实业务内容，不修改权限或业务规则。代码注释、历史迁移、规划和审计原文不作为可见文案批量清理对象。

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
