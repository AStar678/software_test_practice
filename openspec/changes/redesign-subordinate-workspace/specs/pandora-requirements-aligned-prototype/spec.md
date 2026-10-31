# Spec Delta

## ADDED Requirements

### Requirement: Hierarchical subordinate workspace
我的下属资料 SHALL 按真实直属关系排列全部合法下属及其下属，分层展开/收起与点击人员分离，姓名、职级/职位和组织可辨；展开状态不跨账号泄漏。不能仅按职级名称猜测关系或扩展人员权限。

点击下属 SHALL 打开独立适合小屏的工作查看页，明确所选人员并提供日程和日志切换。日程遵循下述月/日视图要求，日志 SHALL 按业务日期/时间倒序显示授权记录，可分页加载并进入全文。

任务和日志 SHALL 可进入原鉴权详情/评论，返回保留人员、日期和页签；本人页面数据范围不变。无数据、加载、失败、重试和失权状态 SHALL 明确，不保留失权正文。组织/账号变化重验权限，旧响应不能串到另一人或账号；界面不因查看下属提供额外正文编辑或排期拖动权限。

#### Scenario: Expand descendants and select independently
- **WHEN** 创始人或管理者展开直接下属、再展开其下属
- **THEN** 目录 SHALL 显示真实父子关系及所有合法层级，展开不自动进入人员，点击人员进入其工作页

#### Scenario: Read a person's schedule on a small screen
- **WHEN** 在320/390/1440宽度切换日期查看所选下属日程
- **THEN** 月历及日视图时间轴/清单 SHALL 无横溢遮挡，午夜截止无次日副本，零时长可识别，只有此人负责且有权任务展示

#### Scenario: Read logs and return from details
- **WHEN** 切日志页签、加载更多并打开日志或任务详情后返回
- **THEN** 工作页 SHALL 保留人员/日期/页签，长内容可读，全部日志可达，本人日志/日历范围不变化

#### Scenario: Revalidate access and session
- **WHEN** 当前人无下属、选择无权人员、组织权限变化或快速换人/换账号
- **THEN** 系统 SHALL 显示合适空态或失权反馈，拒绝跨组织/同级越权，清空失权内容，丢弃旧响应并允许合法重试


### Requirement: Subordinate calendar month and day views
所选人员日程 SHALL 参考本人日历设计并适配人员工作页，默认月视图，可切日视图。月历 SHALL 周一至周日排列、显示连续跨日任务条，溢出可进入完整日视图。日视图 SHALL 提供00:00至24:00时间轴、重叠分栏、独立全天区及可切换任务清单。前后按月或天导航，可跳转日期和回今天；界面无单独周模式。

日程 SHALL 按公司日期读取所选人员当前负责且查看者有权的正常已发布任务，完整分页后投影；跨月、跨周、午夜、零时长、完成状态正确且全部任务可达。任务详情返回 SHALL 保留人员、模式及日期，不改变本人页面状态或授予排期修改权。

#### Scenario: Navigate months days and overflow
- **WHEN** 用户切换月/日模式、跨年翻月、选择日期或点击+N
- **THEN** 月历 SHALL 展示完整月份网格，跨日/跨周任务连续可辨，溢出进入全部日内任务，日轴重叠分栏且午夜无多余副本；返回详情保留模式、日期和人员
