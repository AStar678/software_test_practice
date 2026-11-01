# Spec Delta

## MODIFIED Requirements

### Requirement: Log page single-content filtering and scroll return
日志功能的Web导航、标题、首页和相关入口 SHALL 统一称日志。日志页 SHALL 仅列当前登录者本人日志，不混入任务创建、审核、申请、请示或他人日志；移除部门、团队、人员及范围内全部筛选。计数、刷新、回顶、账号切换及历史筛选状态 SHALL 始终使用本人范围。

人员资料的已有合法日志阅读 SHALL 使用独立弹层，不切换日志页作者或扩大当前权限；详情回读和返回不得将他人记录混入本人列表。上级只能按服务端现有范围阅读，不能修改他人正文；任务关联与评论仍独立鉴权。无本人日志 SHALL 显示明确个人空态。

日志卡片 SHALL 移除查看与评论按钮，直接点击正文/空白或聚焦后按Enter/Space进入原详情与评论。卡片内编辑及关联任务按钮 SHALL 仅执行自身动作，不能重复打开日志详情。编辑、冻结和评论权限仍由服务端校验。

创建和编辑日志的日期、标签 SHALL 使用一致的字段标题、间距和控件高度；桌面同排对齐，窄屏同列边缘对齐，无截断或横溢。写日志继续沿用先前变更的三天内缺失日期创建入口，已有记录从明确编辑入口进入。

#### Scenario: Keep the log page personal after reading another person
- **WHEN** 上级旧状态指向下属，或通过人员资料阅读下属日志后返回、刷新
- **THEN** 日志页 SHALL 只列本人日志且无人员筛选，条数与本人集合一致，合法人员阅读保留在独立弹层

#### Scenario: Show a personal empty state
- **WHEN** 当前用户无本人日志但有阅读下属日志权限
- **THEN** 日志页 SHALL 显示暂无个人日志，不展示下属正文或提示调整已不存在的人员筛选

#### Scenario: Open details and comments directly
- **WHEN** 点击日志正文/空白或用Enter/Space激活卡片
- **THEN** 系统 SHALL 打开对应日志详情和评论，合法用户可按原权限发表评论

#### Scenario: Preserve nested controls
- **WHEN** 作者点击卡片编辑按钮或有权用户点击关联任务按钮
- **THEN** 系统 SHALL 分别打开该日志编辑或关联任务详情，不额外触发日志详情

#### Scenario: Align metadata in creation and editing
- **WHEN** 在320、390和1440宽度创建或编辑日志
- **THEN** 日期和标签 SHALL 相同控件高度、同排顶边或同列左右边对齐，无溢出；正文及保存关闭入口可用

#### Scenario: Keep workflow and identity boundaries
- **WHEN** 用户回顶、刷新或切换账号后进入日志页
- **THEN** 页面 SHALL 只写看当前用户日志，审核从通知进入，旧账号数据和筛选不能保留

#### Scenario: Search each hierarchy within authorization
- **WHEN** 用户进入日志页，或旧状态仍保存他人、部门、团队与作者搜索条件
- **THEN** 页面 SHALL 不提供作者层级筛选，只显示当前本人日志和正确计数；无本人日志显示个人空态，合法他人阅读仅从资料独立进入

#### Scenario: Reset invalid children and restore self
- **WHEN** 用户进入日志页，或旧状态仍保存他人、部门、团队与作者搜索条件
- **THEN** 页面 SHALL 不提供作者层级筛选，只显示当前本人日志和正确计数；无本人日志显示个人空态，合法他人阅读仅从资料独立进入

#### Scenario: Use consistent names and the selected log date
- **WHEN** 用户从导航或首页进入日志或执行日志创建命令
- **THEN** 页面 SHALL 统一称日志并只列本人，写日志沿用近三天缺失日期创建，编辑从明确编辑入口进入

#### Scenario: Enter with self and filter a direct report
- **WHEN** 用户进入日志页，或旧状态仍保存他人、部门、团队与作者搜索条件
- **THEN** 页面 SHALL 不提供作者层级筛选，只显示当前本人日志和正确计数；无本人日志显示个人空态，合法他人阅读仅从资料独立进入

#### Scenario: Return to the top without mixing workflows
- **WHEN** 用户滚动本人日志并回到顶部
- **THEN** 系统 SHALL 保留本人列表与滚动功能，不恢复人员筛选或混入其他工作流

#### Scenario: Enter the log page
- **WHEN** 用户从导航或首页进入日志或执行日志创建命令
- **THEN** 页面 SHALL 统一称日志并只列本人，写日志沿用近三天缺失日期创建，编辑从明确编辑入口进入

#### Scenario: Select pending reviews
- **WHEN** 用户寻找待我审核事项
- **THEN** 审核 SHALL 从通知中心进入，日志页只写看本人日志，不混入待审标签

#### Scenario: Switch between role-specific content filters
- **WHEN** 用户进入日志页，或旧状态仍保存他人、部门、团队与作者搜索条件
- **THEN** 页面 SHALL 不提供作者层级筛选，只显示当前本人日志和正确计数；无本人日志显示个人空态，合法他人阅读仅从资料独立进入

#### Scenario: Invoke a log-page command
- **WHEN** 用户从导航或首页进入日志或执行日志创建命令
- **THEN** 页面 SHALL 统一称日志并只列本人，写日志沿用近三天缺失日期创建，编辑从明确编辑入口进入

#### Scenario: Toggle own logs
- **WHEN** 用户进入日志页，或旧状态仍保存他人、部门、团队与作者搜索条件
- **THEN** 页面 SHALL 不提供作者层级筛选，只显示当前本人日志和正确计数；无本人日志显示个人空态，合法他人阅读仅从资料独立进入

#### Scenario: Restore the visible log scope
- **WHEN** 用户进入日志页，或旧状态仍保存他人、部门、团队与作者搜索条件
- **THEN** 页面 SHALL 不提供作者层级筛选，只显示当前本人日志和正确计数；无本人日志显示个人空态，合法他人阅读仅从资料独立进入

#### Scenario: Search logs by author
- **WHEN** 用户进入日志页，或旧状态仍保存他人、部门、团队与作者搜索条件
- **THEN** 页面 SHALL 不提供作者层级筛选，只显示当前本人日志和正确计数；无本人日志显示个人空态，合法他人阅读仅从资料独立进入

#### Scenario: Show no matching authors
- **WHEN** 用户进入日志页，或旧状态仍保存他人、部门、团队与作者搜索条件
- **THEN** 页面 SHALL 不提供作者层级筛选，只显示当前本人日志和正确计数；无本人日志显示个人空态，合法他人阅读仅从资料独立进入

#### Scenario: Keep log finding separate and scoped
- **WHEN** 用户进入日志页，或旧状态仍保存他人、部门、团队与作者搜索条件
- **THEN** 页面 SHALL 不提供作者层级筛选，只显示当前本人日志和正确计数；无本人日志显示个人空态，合法他人阅读仅从资料独立进入

#### Scenario: Return to the top of log content
- **WHEN** 用户滚动本人日志并回到顶部
- **THEN** 系统 SHALL 保留本人列表与滚动功能，不恢复人员筛选或混入其他工作流

#### Scenario: Reset old filters when opening logs from a person profile
- **WHEN** 用户从人员资料进入有权阅读的日志
- **THEN** 日志 SHALL 在独立弹层按当前权限读取，旧筛选不隐藏目标，返回日志页仍只有本人日志
