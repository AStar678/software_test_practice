# pandora-requirements-aligned-prototype Specification

## Purpose

本规格用于约束潘多拉移动端交互原型只呈现需求文档定义的任务协作、工作日志、分级权限与统计信息，并以可操作的示例流程验证关键业务规则。

## Requirements

### Requirement: Five-page navigation
原型 SHALL 提供且仅提供“导图”“视图”“日志”“AI地图”“我的”五个业务页面，并允许用户通过固定导航在五页之间切换且保持当前演示身份。

#### Scenario: Navigate across the prototype
- **WHEN** 用户依次点击五个导航项
- **THEN** 原型 SHALL 展示对应页面，并且导航中始终只有当前页面处于选中状态

### Requirement: Four-quadrant dashboard
导图页 SHALL 以四象限展示公司统一信息、本人被派发且尚未完成的前十项任务、最多十条个人信息以及本人今天和前一天的日志。公司信息由上层统一维护的示例内容呈现；个人信息 SHALL 可由本人编辑，并在尚未编辑时由本人的日志内容生成初始摘录；近期日志 SHALL 按时间倒序展示原始日志，从而与个人摘录形成明确差异。

#### Scenario: View the four dashboard quadrants
- **WHEN** 任一业务角色进入导图页
- **THEN** 页面 SHALL 同时呈现四个语义清晰、内容互不混淆的象限

#### Scenario: Edit personal information
- **WHEN** 用户修改个人信息象限中的一条内容并保存
- **THEN** 原型 SHALL 更新该象限，且不得改写对应的原始日志

#### Scenario: Executive maintains company information
- **WHEN** 上层修改公司信息象限中的一条内容并保存
- **THEN** 原型 SHALL 更新所有身份可见的公司信息；中层和下层 SHALL 仅能查看该象限

### Requirement: Calendar task views
视图页 SHALL 提供月、周、日三种类甘特视图；月视图精确到日期，周视图和日视图精确到时刻。页面 SHALL 对本人负责和本人派发的任务使用可辨识的视觉差异；同一展示位置存在多项任务时，SHALL 按紧急程度与距截止时间的综合优先级排列，并以“+N”表示因空间不足而隐藏的其余任务。

#### Scenario: Switch time granularity
- **WHEN** 用户在月、周、日分段控件间切换
- **THEN** 任务 SHALL 按所选粒度重新展示，且周、日视图包含时刻信息

#### Scenario: Handle crowded time slots
- **WHEN** 一个时间位置的任务数量超过可展示容量
- **THEN** 原型 SHALL 优先展示综合优先级较高的任务，并显示可操作的“+N”入口查看其余任务

### Requirement: Role-scoped visibility
原型 SHALL 按角色限制业务数据：上层可查看全公司任务与日志；中层可查看本部门任务与日志；下层仅可查看本人负责的任务和本人日志。管理员属于独立管理端角色，本次业务端原型 SHALL 不提供文档未定义的管理员操作。

#### Scenario: Compare role visibility
- **WHEN** 预览者通过原型外层身份控件分别选择上层、中层和下层示例身份
- **THEN** 五个业务页面中的任务、日志和汇总数据 SHALL 随角色切换到对应可见范围

#### Scenario: Prevent unauthorized detail access
- **WHEN** 当前身份尝试打开超出其可见范围的任务或日志
- **THEN** 原型 SHALL 不展示该记录的详情或修改入口

### Requirement: Role-scoped task creation and assignment
上层 SHALL 能给自己创建任务，并能向中层或下层派发任务；中层 SHALL 能向本部门下层派发任务，也能给自己创建任务；下层 SHALL 只能给自己创建任务。中层和下层的自建任务 SHALL 先进入待直属上级审核状态，审核通过后才成为执行中的任务；上层自建任务因没有更高审批角色而直接生效。

#### Scenario: Manager assigns a departmental task
- **WHEN** 中层创建任务并选择本部门下层为负责人
- **THEN** 任务 SHALL 直接发布给所选负责人，且不得出现其他部门或上层人员作为可选负责人

#### Scenario: Employee submits a self-created task
- **WHEN** 下层为自己提交任务
- **THEN** 任务 SHALL 进入待直属中层审核状态，并在审核前与已生效任务明确区分

#### Scenario: Superior reviews a self-created task
- **WHEN** 直属上级批准或拒绝一项自建任务
- **THEN** 批准时任务 SHALL 进入可执行状态，拒绝时 SHALL 保留拒绝结果且不进入执行任务列表

### Requirement: Task structure and attributes
每项普通任务 SHALL 展示名称、截止日期、紧急程度、完成情况、进度备注、创建者和一个或多个负责人。任务 SHALL 支持父子关系。抽象任务 SHALL 标明其不可直接执行，由一个或多个普通子任务组成，并通过子任务状态汇总进展而不提供直接更新进度或直接完成的操作。

#### Scenario: Inspect a child task
- **WHEN** 用户打开具有上级任务的普通任务
- **THEN** 详情 SHALL 展示其上级任务，并允许返回查看该上级任务及同级关系

#### Scenario: Inspect an abstract task
- **WHEN** 用户打开抽象任务
- **THEN** 详情 SHALL 展示其普通子任务与汇总进展，且不显示直接执行或直接完成入口

### Requirement: Task editing and completion review
任务创建者 SHALL 能修改任务信息。任务负责人 SHALL 只能更新进度备注和提交完成状态，不能修改任务定义字段。任一负责人提交完成后，任务 SHALL 进入待审核状态；派发任务由创建者审核，自建任务由直属上级审核。审核通过后任务才 SHALL 标记为已完成，审核退回后 SHALL 恢复为进行中。上层为自己创建且不存在审核人的任务提交完成后 SHALL 直接完成。

#### Scenario: Assignee updates progress
- **WHEN** 负责人保存进度和进度备注
- **THEN** 原型 SHALL 更新任务进展，但不得允许其改写名称、截止日期、紧急程度或负责人

#### Scenario: Creator approves completion
- **WHEN** 派发任务的任一负责人提交完成且创建者批准
- **THEN** 任务 SHALL 从待完成审核变为已完成

#### Scenario: Superior rejects completion
- **WHEN** 审核人退回完成申请
- **THEN** 任务 SHALL 恢复进行中并保留新的审核结果供负责人查看

### Requirement: Required notifications
原型 SHALL 提供最小化的站内通知列表，用于演示任务创建、任务临近截止和临时紧急情况三类通知。相关通知 SHALL 同时面向任务负责人和任务创建者，并可从通知记录进入对应任务。

#### Scenario: Notify on task creation
- **WHEN** 一项任务发布或自建任务审核通过
- **THEN** 原型 SHALL 为创建者与全部负责人生成任务创建通知

#### Scenario: Surface due and emergency notices
- **WHEN** 示例任务临近截止或被标记为临时紧急情况
- **THEN** 创建者与全部负责人 SHALL 在通知列表中看到对应类型、任务名称和时间信息

### Requirement: Personal work logs
日志 SHALL 归属于唯一作者；作者 SHALL 能创建和编辑自己的日志，并可选择是否关联其可见任务。上层 SHALL 能查看全公司日志，中层 SHALL 能查看本部门日志，下层 SHALL 只能查看自己的日志；查看权限不得赋予非作者编辑权。

#### Scenario: Write an unlinked log
- **WHEN** 用户填写日志内容但不选择所属任务并保存
- **THEN** 原型 SHALL 保存个人日志，且不强制建立任务关联

#### Scenario: Superior reads a subordinate log
- **WHEN** 中层打开本部门下层的日志
- **THEN** 原型 SHALL 展示日志内容，但不显示编辑操作

### Requirement: Manager consultation
中层 SHALL 能向直属上层发起请示并查看示例处理结果；下层 SHALL 不显示发起请示的入口。请示仅演示需求中明确的上下级沟通，不扩展为通用审批或任务字段变更系统。

#### Scenario: Manager submits a consultation
- **WHEN** 中层填写请示内容并提交给直属上层
- **THEN** 原型 SHALL 显示该请示处于待回复状态，并向对应上层展示待处理记录

#### Scenario: Employee cannot submit a consultation
- **WHEN** 当前身份为下层
- **THEN** 日志页及任务详情 SHALL 不显示发起请示入口

### Requirement: Role-scoped AI map
AI地图页 SHALL 集成任务数据统计、关键词词云和 AI 建议。下层的任务统计和 AI 建议 SHALL 仅基于本人数据；中层的任务统计 SHALL 基于本部门数据且 AI 建议仅面向本人；上层的任务统计和 AI 建议 SHALL 基于全公司数据。词云范围 SHALL 为上层查看公司、中层查看部门、下层查看所在部门的聚合词云，且不得暴露无权查看的单条任务或日志。

#### Scenario: View employee AI map
- **WHEN** 下层进入 AI地图页
- **THEN** 页面 SHALL 展示本人的任务统计与个人建议，以及不包含个人明细的部门聚合词云

#### Scenario: View executive AI map
- **WHEN** 上层进入 AI地图页
- **THEN** 页面 SHALL 展示全公司的任务统计、公司词云和公司级建议

### Requirement: Minimal profile page
我的页面 SHALL 仅展示当前用户的常规个人身份信息，包括姓名、部门和角色。角色切换 SHALL 仅存在于包裹原型的预览控件中，不得伪装为正式产品设置。

#### Scenario: View profile
- **WHEN** 用户进入我的页面
- **THEN** 页面 SHALL 展示姓名、部门和角色，且不显示资料编辑、通知偏好、账号管理、指南或数据重置功能

### Requirement: Strict prototype scope
业务界面 SHALL 不提供需求文档未提出的全局搜索、任务草稿、个人重点或排序、日志转待办、任务取消、任务关键字段变更申请、排期冲突检查、工作空间切换或账号启停功能。原型 SHALL 保持单文件、静态示例数据和适度可交互的验证用途，不要求真实后端持久化。

#### Scenario: Inspect available actions
- **WHEN** 预览者遍历五个页面、任务详情、日志详情和审核入口
- **THEN** 可见操作 SHALL 仅覆盖本规格定义的页面与业务流程
