## MODIFIED Requirements

### Requirement: Holiday labels do not change task time semantics

节假日服务 SHALL 仅提供日历标识，不改变任务开始/截止、工期、全天语义、有效排期与待审投影、日志日期或提醒节点。员工Web公司月格和日视图日期标题 SHALL 使用同一后端年度安排，显示官方节日名称及“休/班”，跨年按实际年份读取；普通周末不伪造官方标识，不由手机直连外源或前端预测。ready使用有效数据，stale保留原有效数据，missing不伪造安排并提供可理解的无数据状态；客户端读取失败可重试并保留已知有效年度，不阻断任务日历。

本次 SHALL 核对实际Web月/日标识与服务缓存；A服务成功不代替本次UI验收，Web结果不代表Flutter、旧套壳或真机交付。

#### Scenario: Keep schedules and reminders unchanged after a refresh
- **WHEN** 缓存新增或修订某日为休假或调班，同时存在覆盖该日的任务及比例提醒
- **THEN** 任务排期、自然工期、提醒时点/去重、执行/申请状态 SHALL 均保持原业务规则，不自动跳过休息日

#### Scenario: Show one annual arrangement in both Web views
- **WHEN** 月历查看官方休假及周末调班并打开相应日视图，再连续浏览跨年
- **THEN** 月格和日标题 SHALL 显示一致名称及休/班，按年份读取项目自有接口，普通周末不伪造标识，任务/提醒时点不变

#### Scenario: Preserve cached labels when another year is unavailable
- **WHEN** 已缓存年度刷新失败，另一个年份未公布/未缓存或客户端年度读取失败
- **THEN** 已知有效年度 SHALL 保留，缺失年无虚构安排且状态明确，失败可重试，正常任务日历不被阻断
