# china-holiday-calendar Specification

## Purpose

为员工月历、日视图及后续跨平台客户端提供统一的中国大陆年度法定放假与调休标识，集中处理可核对来源、年度校验、持久缓存和失败降级，使每台客户端无需直接依赖外部数据源，并保持原有任务排期、工期和提醒语义。

## Requirements

### Requirement: Authoritative annual holiday arrangements

系统 SHALL 按中国大陆国务院已公布的年度放假安排提供节日名称和休/班日期，区分普通周末与官方调休。数据 SHALL 通过后端按年获取和来源适配，启用前记录来源地址、格式/年度样本、维护/使用条件及对应官方通知核对依据；候选年度公开数据集未经核验不得标为已接入。前端不得直接访问外部源，不得按星期推导官方休/班或预测未公布年份。

#### Scenario: Check a published year's official holiday and working weekend
- **WHEN** 后端接入一个已公布年份，其安排包含法定休假和周末调班
- **THEN** 已验证年度记录 SHALL 与官方通知一致，包含日期、名称及 isOffDay，普通未特别安排周末不被伪装成官方调休

#### Scenario: Keep an unavailable future year honest
- **WHEN** 合法年份没有可核对的已公布数据或候选源无法提供年度记录
- **THEN** 系统 SHALL 明确无可用安排，不推算未来、不填造休/班，不将候选源 404 当作已验证完整年度数据

### Requirement: Atomic validated annual cache

后端 SHALL 在替换年度缓存前校验请求年份与数据年份一致、日期合法且属于该年、名称非空、休班值合法，并拒绝重复日期、冲突安排及缺少可核对官方依据的发布结果。整年成功校验后 SHALL 原子更新可读缓存并记录来源标识/版本或内容哈希、官方通知依据和成功更新时间；部分下载/无效年度不得部分覆盖。已成功缓存的历史年份 SHALL 持久可读。

#### Scenario: Reject invalid or conflicting annual payloads
- **WHEN** 更新载荷含非法/跨年日期、重复、休班冲突、非布尔休班、空名称或无核对依据
- **THEN** 更新 SHALL 拒绝，既有年度内容和成功更新时间不变，不发布部分数据

#### Scenario: Replace a year without exposing an intermediate state
- **WHEN** 已验证年度更新与多个客户端读取并发
- **THEN** 读取 SHALL 只观察完整旧版或完整新版，版本/来源和日期集合一致，重启后成功结果仍可读

### Requirement: Protected local annual read contract

GET `/api/v1/calendar/holidays/{year}` SHALL 供当前有效员工及独立管理员读取，年份为 1900–9999 的四位公历年；非法年份为 400，失效/无权请求按现有认证拒绝。响应 SHALL 包含 year、region=CN、status、days、source、updatedAt，days 按日期升序，每项为 date/name/isOffDay。ready 表示有有效缓存；stale 表示最近刷新失败但继续提供原有效缓存；missing 表示无有效缓存，此时 days 为空且 updatedAt 为 null，不冒充已确认无假日。

普通读取 SHALL 只依赖项目自己的持久缓存，不等待每个请求实时访问外网。缺失与失败反馈 SHALL 使用安全状态/原因，不泄露外部原始响应或敏感配置。服务只提供特殊年度安排，客户端可独立辨认普通周末，不得自动把全部周末补进官方 days。

#### Scenario: Read cached data while the external source is down
- **WHEN** 年度已有有效缓存且后续外部刷新失败
- **THEN** GET SHALL 仍成功返回原完整 days/来源/成功更新时间及 stale，外源失败不清空缓存或使客户端逐次等待外网

#### Scenario: Distinguish missing data from a verified year
- **WHEN** 请求一个合法但尚未成功载入的年份
- **THEN** GET SHALL 返回该年份的 missing/空 days/null updatedAt，既不返回伪造预测，也不声称完整年度没有假期

### Requirement: Bounded refresh and explicit administration

后端 SHALL 提供自动按年获取/维护：后台检查当前年与次年，对其他缺失年按需登记去重获取；同年自动失败尝试间隔至少 24 小时，网络有超时、大小上限、有限重试和按年并发控制，不因客户端重复读取放大外源请求。已缓存历史年保持可读，未知/未公布年份稳定无数据。

仅独立管理员 SHALL 可 POST `/api/v1/admin/calendar/holidays/{year}/refresh` 明确刷新，使用当前管理员认证及幂等键，记录维护结果；请求不得指定任意外源 URL。成功为已验证缓存结果，外源获取/校验失败 SHALL 返回 502 安全错误并保留原缓存及成功更新时间。部署说明 SHALL 包含来源配置、年度维护、失败恢复及管理调用方法，不要求额外手机管理端或完整 PC 数据编辑器。

#### Scenario: Coalesce repeated missing-year reads
- **WHEN** 多台客户端连续请求同一缺失年且外源一直不可用
- **THEN** 后台 SHALL 合并同年意图并遵守失败重试间隔，不逐 GET 拉取或产生无限任务，读请求继续稳定 missing

#### Scenario: Restrict refresh to the independent administrator
- **WHEN** 管理员合法按年刷新并同键重试，或员工/失效管理员/带任意 URL 的请求尝试维护
- **THEN** 合法请求 SHALL 按幂等及当前授权处理，其他请求拒绝；失败不覆盖原数据，维护结果可追踪而不泄露凭证

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
