# 员工客户端共享契约交接索引

- 适用变更：`prepare-employee-client-contracts-and-business-upgrade`（A）。
- 索引来源：[Flutter 完整迁移盘点与 Change 边界](../../docs/reviews/潘多拉-Flutter完整迁移盘点与Change边界-2026-11-08.md)（90 项清单、54 条主规格映射、J01–J32）与 [11 月 8 日更改指导](../../docs/requirements/潘多拉-更改指导-2026-11-08.md)。
- 本文性质：A 的实施交接索引，不是独立验证 PASS，也不代表 Flutter/B 已交付。A 的代码与检查证据见 `openspec/changes/prepare-employee-client-contracts-and-business-upgrade/implementation-notes.md`；最终结论由独立 e13 验证给出。
- 阅读规则：一个清单 ID 只有一个落点。`复用→B` 表示服务端能力已存在，B 负责完整客户端实现与联调；`A+B` 表示 A 补契约/数据，B 落实呈现；`PC/A` 表示能力继续留在 PC；`B` 表示 A 不实现交互，只记录边界。未修改的 54 条主规格规则继续有效。

## 1. 12 项新指导的 A 落点

| 指导 | 清单 | A 本次实际落点 | B 仍负责 |
| --- | --- | --- | --- |
| 1 每日事项跨日 | D01–D05、N02 | `V32`、`GET/POST/PATCH/DELETE /daily-items`、范围清单/汇总、旧单日兼容 | 纵向连续月历、事项条、实际命中日清单 |
| 2 首页卡片 | H01–H03 | `GET /home` 数据范围与顺序保持不变 | 少量预览、整页滚动、先清单再详情 |
| 3 表单置顶 | F01–F05、C06 | `GET /tasks/table`、`PUT/DELETE /tasks/{id}/table-pin`、`tablePinned/canTablePin` | 独立按钮与列表呈现 |
| 4 节假日 | Q01、Q05、C10 | `V34` 缓存 + `V35` 失败状态；`GET /calendar/holidays/{year}`、管理员 `POST /admin/calendar/holidays/{year}/refresh`、后台当前/次年检查；来源/维护见 `backend/docs/holiday-calendar-source.md` | 月/日节假日名称与休/班标识 |
| 5 日志填充 | L06、D02、L03 | `GET /work-logs/fill-source` 只读完整名称源 | 主动追加、分组、合并正文与长度处理 |
| 6 手机拖动 | C08–C10 | 不改任务授权/版本/审核；不把日轴限制施加到通用排期 | 长按震动、二维拖动、自动滚动、日轴边界 |
| 7 入职时长 | P03、O01 | `V34 hire_date`、管理员维护、`hireDate/tenure` 投影 | 本人/下属资料呈现与空态 |
| 8 日志所属日 | L02、L05 | 继续复用 `businessDate`、首次创建时间与 24h 冻结 | 修正客户端重排 |
| 9 组织与联系方式 | P01、P04、S01 | 实际管理链授权详情补 `email`；目录/摘要不带 | 去身份展示、真实职务路径 |
| 10 人员日程 | S01–S04、N02 | 复用有权读取与分页；A 不新增人员月历接口 | 连续月历、固定清单操作、返回恢复 |
| 11 通知 | I01–I07 | 复用动态分类/组合过滤/全局未读与安全投影 | 六标签、三分段、单图标、返回状态 |
| 12 动画演示 | Q03、O02 | 第 9 章任务；稳定员工 ID 与真实组织规则不变 | 用真实账号展示新旧业务 |

## 2. 90 项迁移清单索引

`归属` 列中 `A` 为本次新增/修改，`A+B` 为 A 先补契约、B 呈现，`复用→B` 为已有服务复用，`PC/A` 为 PC 能力保留。

### 2.1 导航、会话与首页（12）

| ID | 现有契约 / A 落点 | 归属 | J |
| --- | --- | --- | --- |
| N01 | 五页导航与二级入口；`POST /auth/sessions`、`GET /me` | 复用→B | J01、J30 |
| N02 | 返回栈、日期/筛选/滚动位置；客户端状态，A 只保证数据可分页读取 | B | J14、J16、J24、J26 |
| N03 | 加载/空态/失权/失败分离；统一错误码与 `complete` 语义 | A+B | J02、J03 |
| N04 | 文案、窄屏、可访问名称；A 不新增界面文案 | B | J25、J30 |
| A01 | 手机号 + `accountType=employee` 登录 | 复用→B | J01 |
| A02 | 初始/重置密码强制改密会话 | 复用→B | J01 |
| A03 | 刷新/退出/改密撤销全部会话 | 复用→B | J02 |
| A04 | Bearer、`If-Match`、`Idempotency-Key`；见第 4.8 节 | 复用→B | J03 |
| A05 | 切账号清理缓存与旧响应；B 的会话存储 | B | J02、J30 |
| H01 | `GET /home` 三模块 | 复用→B | J04 |
| H02 | 公司事件纪共享、最多十条、只读 | 复用→B | J04、J28 |
| H03 | 首页任务看板：本人负责、已发布、未完成、倒序最多十条 | 复用→B | J04 |

### 2.2 独立每日事项（5）

| ID | 现有契约 / A 落点 | 归属 | J |
| --- | --- | --- | --- |
| D01 | 本人私有事项；`/daily-items` 每组读写按 `organization_id+owner_id` | 复用+A+B | J05、J06 |
| D02 | `startDate/endDate` 首尾包含；`V32`；旧 `date` 单日映射；同 ID 一条记录 | A+B | J05、J29 |
| D03 | 纵向连续月历、事项条；A 只提供覆盖日读取 | A+B | J05 |
| D04 | 命中日清单/详情；A 提供 `GET /daily-items?date=` 与稳定分页 | B | J05、J06 |
| D05 | 新增/编辑/删除/完成/版本冲突；A 提供日期对、`status`、`nextOffset` | A+B | J05、J06 |

### 2.3 任务、负责人及审核（33）

| ID | 现有契约 / A 落点 | 归属 | J |
| --- | --- | --- | --- |
| T01 | `POST /tasks` 创建普通任务、多负责人、排期、父任务、多标签 | 复用→B | J07 |
| T02 | `GET /assignee-candidates?purpose=create|edit` 公司有效员工；摘要无电话/邮箱 | 复用→B | J07 |
| T03 | 需审创建未发布；`GET /approval-requests?mine=applicant` | 复用→B | J08 |
| T04 | `GET /tasks/{id}` 有效版/来源/审核意见；不附带提议 diff | 复用→B | J09、J11 |
| T05 | `editableFields` 字段级编辑资格 | 复用→B | J09、J24 |
| T06 | 一次提交的原子申请与专用 diff | 复用→B | J09 |
| T07 | 父任务搜索、防环与独立授权 | 复用→B | J10 |
| T08 | 进展/完成命令与审核状态机 | 复用→B | J11 |
| T09 | 重开命令、轮次与新排期 | 复用→B | J11、J12 |
| T10 | 明确定时/旧 `allDay`；日期结束次日 00:00 仅一次 | 复用→B | J07、J15 |
| R01 | 当前直属上级审核、创始人免审留因 | 复用→B | J08、J12 |
| R02 | 预览非凭证、提交时重算审核人 | 复用→B | J12 |
| R03 | 同任务一个待审、冻结业务写入、评论仍可用 | 复用→B | J09、J12 |
| R04 | 我的申请/审核详情/批准/拒绝/撤销/失效 | 复用→B | J08、J11、J12 |
| R05 | 专用 diff 仅当前有权审核人 | 复用→B | J09、J12 |
| R06 | 改派/资格变化/到期重验 | 复用→B | J12 |
| R07 | `POST /tasks/{id}/handover` 专用交接 | 复用→B | J13 |
| R08 | `handover-targets`/手交预设；下属只读无按钮 | 复用→B | J13、J24 |
| C01 | 仅本人当前负责已发布任务的日历数据 | 复用→B | J15 |
| C02 | 月/日模式、抽屉、表单、悬浮创建 | B | J16、J30 |
| C03 | 连续跨月/年、补载、密度 | 复用→B | J15、J16 |
| C04 | 命中日清单/详情返回 | B | J16 |
| C05 | 日视图时间轴与重叠 | 复用→B | J15 |
| C06 | 日历个人置顶 `PUT/DELETE /tasks/{id}/pin` | 复用→B | J14、J15 |
| C07 | 待审排期投影只读虚线 | 复用→B | J19 |
| C08 | 手机长按进入拖动 | B | J17、J18、J30 |
| C09 | 二维跨月拖动与确认 | B | J17 |
| C10 | 日轴小时拖动边界 | B | J18、J31 |
| F01 | 表单只含本人原始创建/当前负责 | A | J14 |
| F02 | 服务端 `GET /tasks/table` 全条件筛选、计数后分页 | A | J14 |
| F03 | 六列排序、同值 ID 升序、每页 50 | A | J14 |
| F04 | 独立表单置顶分组（`tablePinned`） | A | J14 |
| F05 | 条件保留、账号隔离、残留偏好不扩权 | A+B | J02、J14、J24、J26 |

### 2.4 日志、标签与评论（15）

| ID | 现有契约 / A 落点 | 归属 | J |
| --- | --- | --- | --- |
| L01 | 本人日志主页面、近三日唯一入口 | 复用→B | J20 |
| L02 | 首次创建 24h 冻结、业务日期不可改 | 复用→B | J20 |
| L03 | 正文/多标签/可选任务独立授权 | 复用→B | J20、J22、J23 |
| L04 | 日志编辑/详情/评论排版与返回 | B | J20、J24 |
| L05 | 以 `businessDate` 倒序、显示真实 `createdAt` | 复用→B | J20、J21 |
| L06 | `GET /work-logs/fill-source?businessDate=` 完整 id/name | A+B | J21 |
| G01 | 公司共用标签目录、仅创始人维护 | 复用→B | J22 |
| G02 | 任务/日志有序多标签 | 复用→B | J09、J22 |
| G03 | 首项标签色与删除快照 | 复用→B | J15、J22 |
| M01 | 平铺评论、稳定 ID 游标 | 复用→B | J23 |
| M02 | 作者编辑/删除自己的评论 | 复用→B | J23 |
| M03 | 评论定向通知与撤权掩码 | 复用→B | J23、J26 |
| P01 | 本人头像/邮箱/资料；姓名电话仅管理员 | 复用→B | J25 |
| P02 | 预设/照片 data URI 头像 | 复用→B | J25、J30 |
| P03 | `hireDate`/统一 `tenure` 投影 | A+B | J25、J28 |

### 2.5 个人资料、下属、通知、统计与 PC（25）

| ID | 现有契约 / A 落点 | 归属 | J |
| --- | --- | --- | --- |
| P04 | 实际管理链授权详情可读邮箱；目录/摘要不带 | A+B | J24、J25 |
| S01 | `GET /me/reports`、`GET /users/{id}` 真实下属树 | 复用→B | J24 |
| S02 | 下属嵌套路径只读 + 合法评论 | 复用→B | J24 |
| S03 | 人员日程月/日与命中日清单 | B | J24 |
| S04 | 下属日志列表与返回恢复 | B | J24 |
| I01 | `GET /notifications`、详情、打开 | 复用→B | J26 |
| I02 | 六类型 + 已读三段筛选 UI | B | J26、J30 |
| I03 | 全量过滤后计数/分页、需我审核动态判断 | 复用→B | J26 |
| I04 | 真正打开才标读、返回保留条件 | 复用→B | J26 |
| I05 | 绑定原 `requestId`、`canReadRequest` 与专用 diff | 复用→B | J12、J26 |
| I06 | 隐藏/180 秒撤回/申请撤销、历史例外 | 复用→B | J26 |
| I07 | 历史通知专用只读任务摘要、不扩权 | 复用→B | J23、J26 |
| X01 | 统计使用真实执行/审核口径 | 复用→B | J27 |
| X02 | 公司/部门/团队/本人统计范围 | 复用→B | J27 |
| X03 | 本地规则 AI 图谱/建议 | 复用→B | J27 |
| O01 | PC 管理员账号、员工、组织、重置密码、入职日期维护 | PC/A | J01、J28 |
| O02 | 固定创始人、唯一负责人、原子组织计划 | PC 保留/A 回归 | J28 |
| O03 | 停用、交接、业务接管 | PC 保留/A 回归 | J02、J12、J28 |
| O04 | 公司事件纪、任务历史、通知治理、审计 | PC 保留/A 回归 | J26、J28 |
| Q01 | 公司时区/businessDate/提醒节点不变 | 复用→B | J12、J15、J19 |
| Q02 | Flyway 历史校验和、空库/升级库收敛、备份恢复 | A | J29 |
| Q03 | 稳定演示账号/幂等准备；动画主线 | A+B 展示 | J29、J32 |
| Q04 | Flutter 构建、安装、生命周期、真机 | B | J30 |
| Q05 | 官方年度节假日缓存与读取 | A+B | J31 |
| Q06 | 过渡 Web/PC 兼容、地址/TLS/脱敏/回退 | A+B | J02、J29、J30 |

## 3. 54 条主规格的承接位置

序号与标题沿用主规格；`本次` 只列 A 的修改/确认，未列的旧场景继续有效。

| # | Requirement | 本次 A 落点 / 接续 |
| --- | --- | --- |
| 01 | Five-page navigation | 复用；五页与二级入口由 B 承接（N01/N02） |
| 02 | Three-section home dashboard | `GET /home` 不改（H01–H03） |
| 03 | Independent personal daily items | 修改为日期范围、三态、无私人上限（D01–D05） |
| 04 | Horizontal continuous daily-item calendar | A 保留过渡外观；B 替换为纵向（D03/D04） |
| 05 | Daily-item status count markers | 计数按覆盖日；外观仍为过渡（D03–D05） |
| 06 | Daily-item lists details and reliable editing | 清单/详情/版本/幂等承接到范围记录（D04/D05） |
| 07 | Calendar task views | 复用月/日语义；B 增加节假日与手势（C01–C10、Q05） |
| 08 | Authorized task table page | 服务端全局管线（F01/F03/F05） |
| 09 | Combined task table filters and search | 组合筛选与独立置顶（F02/F04） |
| 10 | Global task table sorting and counts | 六列稳定排序、计数后分页（F02–F04） |
| 11 | Task table refresh and account isolation | 客户端隔离；服务每次重验（F05、A05） |
| 12 | Role-scoped visibility | 原有正常/下属/历史差异保留（T04、S01、S02、X02、I07） |
| 13 | Role-scoped task creation and assignment | 复用公司有效员工候选（T01–T03） |
| 14 | Task structure and attributes | 复用历史字段；不恢复新建完成标准（T01、T04、T07、T10、R02） |
| 15 | Task editing and completion review | 字段资格/原子审批/状态机不变（T05、T06、T08、T09、R01–R06） |
| 16 | Required notifications | 站内通知保留；系统推送仍延期（I01、I05–I07、M03、Q01） |
| 17 | Personal work logs | 复用唯一/近三日/冻结/关联；新增只读填充源（L01–L03、L05、L06） |
| 18 | Log page single-content filtering and scroll return | 复用；B 呈现（L04、N02） |
| 19 | Role-scoped AI map | 复用统计/建议范围（X01–X03） |
| 20 | Minimal profile page | 修改：入职日期/时长、授权邮箱、目录不带（P01–P04） |
| 21 | Strict prototype scope | A 只做共享服务/迁移/PC/过渡；B 另立（N01、N04、Q04） |
| 22 | Organization and administration | PC 保留；新增入职日期维护与回读（O01–O04、P03） |
| 23 | Account password lifecycle | 保留；邮箱规则改为实际管理链授权详情（A01–A05、O01） |
| 24 | Ordered reviewer routing and reassignment | 保留（R01、R02、R05、R06） |
| 25 | Dedicated task handover | 保留（R07、R08、S02） |
| 26 | Deadline expiration of pending applications | 保留（R03、R04、R06、Q01） |
| 27 | Proportional schedule reminders | 保留；节假日不改变语义（Q01、C07） |
| 28 | Notification lifecycle and historical access | 保留（I04–I07、M03） |
| 29 | Complete task operation history | PC 完整历史；员工仅当前可读（T04、O04） |
| 30 | Shared single-select tags for tasks and logs | 正文已是有序多选；按正文而非标题（G01–G03、L03） |
| 31 | Flat comments with author control and targeted notifications | 保留（M01–M03、S02） |
| 32 | Persistent demonstration data for web and administration | 第 9 章动画主线（Q03） |
| 33 | Atomic employee deactivation and formal business takeover | PC 保留（O03、T04、R06） |
| 34 | Convergent organization and identity schema upgrades | 新迁移与历史校验和（Q02、O02） |
| 35 | Notification list presentation and combined filters | 服务端组合语义保留；UI 由 B 替换（I02–I04） |
| 36 | Generated notification content and one object destination | 保留（I01、I05、M03） |
| 37 | Multi-select task tag controls | 保留（G02、G03） |
| 38 | Responsive task schedule inputs | B 实现；A 不改 API（T10、N04、Q04） |
| 39 | Personal task table and founder-only tag maintenance | 新增独立表单置顶（F01–F05、G01） |
| 40 | Single creation entry for recent missing logs | 保留（L01、L02） |
| 41 | Hierarchical subordinate workspace | 保留 + 授权邮箱（S01、S02、P04） |
| 42 | Subordinate calendar month and day views | B 连续月历；A 不新增（S03、S04） |
| 43 | Consistent log reading typography | B（L04、N04） |
| 44 | Calendar dragging by presentation | B（C08–C10） |
| 45 | Pending review calendar projection | 保留（C07、R03） |
| 46 | Reschedule every visible active task | 保留字段资格；不扩到下属/历史（T05、S02） |
| 47 | Day-scale bars in the month calendar | B（C03、C09） |
| 48 | Write requests work on ordinary HTTP origins | 现有幂等键保留；B 网络策略（A04、Q04、Q06） |
| 49 | Pending frame and caption use the proposed time together | 保留（C07） |
| 50 | Distinct log creation and editing interfaces | 保留；填充源两侧同口径（L01、L02、L06） |
| 51 | Production interface copy without redundant implementation explanations | B（N04、T04、R02） |
| 52 | Personal calendar pin eligibility | 月置顶不变；新增独立表单置顶（C06、F04） |
| 53 | Stable shared tag color across task presentations | 保留（G03） |
| 54 | Company shared tags without private overrides | 保留（G01–G03） |

## 4. A 新增/修改的共享契约

### 4.1 每日事项日期范围

- `V32` 将 `daily_items.item_date` 承接为 `start_date`，新增非空 `end_date` 并回填 `start=end=原日期`；保留 ID、owner、body、completed、row_version、created_at/updated_at；新增 `CHECK(end_date>=start_date)` 与 `(organization_id,owner_id,start_date,end_date,created_at,id)` 索引。
- `POST /daily-items`：新 `{startDate,endDate,body}`；旧 `{date,body}` 等价单日；混用 400；缺半个日期对 400；倒置 400。
- `PATCH /daily-items/{id}`：日期对必须同时提供或同时省略；省略保留原范围；旧 `date` 仅当前单日可用；对跨日项返回 `409 DAILY_ITEM_RANGE_REQUIRED` 且不写任何字段。
- `GET /daily-items?date=D`：返回覆盖 D 的全部记录；`from/to` 为相交模式，两端必填、与 `date` 互斥、窗口最多 93 天；返回完整的原日期对，不按窗口截断记录。
- 响应行：`id,startDate,endDate,date(旧起点投影),body,completed,status,rowVersion,createdAt,updatedAt`；列表另含 `items,total,limit,offset,nextOffset,date|from,to,businessDate,organizationTimeZone`。
- `status`：`completed` 优先；否则公司 `businessDate > endDate` 为 `overdue`，其余 `open`。
- `GET /daily-items/summary?from=F&to=T`：按每条记录实际覆盖的每一天各计一次；`openCount` 含未完成与逾期，`completedCount` 只计完成；缺省日仍表示已确认零。

### 4.2 个人任务表单 `GET /tasks/table`

参数仅允许：`relation=all|assigned|created`（默认 all）、`completion=all|unfinished|completed`（默认 all）、`q`（去首尾空白、不区分大小写、≤200）、`from`、`to`（可单端）、`sort=title|createdAt|startAt|dueAt|priority|state`（默认 startAt）、`direction=asc|desc`（默认 asc）、`limit=1..100`（默认 50）、`offset≥0`（默认 0）。其他参数、非法枚举、倒置日期均 400。

处理顺序：当前正常授权 → 原始创建/当前负责并集 → 关系/完成/名称/日期 → ID 去重 → `tablePinned` 分组（true 在前）→ 当前排序（同值 ID 始终升序）→ 总数与分页。响应 `{items,total,limit,offset,nextOffset}`；行沿用正常任务安全投影并带 `tablePinned,canTablePin`，不带提案排期或专用 diff。通用 `GET /tasks` 的可见范围与 `nextCursor` 不变。

名称排序固定为服务端 `java.text.Collator.getInstance(Locale.SIMPLIFIED_CHINESE)`、`TERTIARY`、`CANONICAL_DECOMPOSITION`，按原始标题比较；数字按文本比较（`分镜10` 在 `分镜2` 前），大小写参与三级比较，规范等价文本（NFC/NFD）比较相等后按 ID 升序；客户端不得二次重排。锁定运行时为 OpenJDK 21.0.7（Homebrew），实现类 `java.text.RuleBasedCollator`；样例与强度见 `audit/prepare-employee-client-contracts-and-business-upgrade/collator-runtime.txt`。

### 4.3 独立表单置顶

- `V33` 新建 `user_task_table_pins(organization_id,user_id,task_id,pinned_at)` 复合主键，不迁移/双写 `user_task_pins`。
- `PUT/DELETE /tasks/{id}/table-pin`：Bearer + `Idempotency-Key`，不要求任务 `If-Match`，返回 `{taskId,tablePinned}`；不改任务版本/排期/紧急度，不建审核或通知。
- 资格：当前正常已发布且可读，并且本人原始创建或当前有效负责（含完成与已有有效版的待审）。残留偏好保留在库中，但失权后不出现在查询/计数中，也不能授权写入。
- 正常详情/表单返回 `tablePinned,canTablePin`；日历 `pinned,canPin` 语义不变。历史通知专用入口与下属嵌套只读路径不提供动作。

### 4.4 日志日期名称源 `GET /work-logs/fill-source`

- 参数仅 `businessDate=YYYY-MM-DD`，不接受 `userId`；不套用日志新建的近三日窗口；缺日期/非法日期 400。
- 响应 `{businessDate,organizationTimeZone,dailyItems:[{id,name}],tasks:[{id,name}],complete:true}`。
- 事项：本人范围内覆盖该日的全部记录，`name` 为完整 `body` 原文，不新增标题、不截取首行；按 `createdAt,id` 升序。
- 任务：已发布、当前有效负责、实际时段覆盖该日的任务，含完成；`name` 为有效版标题；按有效 `startAt,id` 升序并按 ID 去重。
- 覆盖算法：旧全天首尾包含；定时 `[start,due)` 与 `[dayStart,nextDayStart)` 相交；午夜截止不进入次日；零时长归其开始日；不使用待审投影。
- 纯读取，不修改正文/关联/完成/冻结/审批；任一源失败整体错误，不返回部分 `complete:true`；两组无数据为空数组。日志正文 10000 个 UTF-16 code unit 上限不变，聚合不截断。

### 4.5 入职日期、统一时长与授权邮箱

- `V34 users.hire_date DATE NULL`；存量保持 NULL，不用 `created_at` 回填。
- 管理员直接 `POST /admin/employees`、组织计划 `newEmployees`、`PATCH /admin/employees/{id}` 均接受 `hireDate`：严格 ISO `YYYY-MM-DD`、不得晚于公司今天、显式 `null` 清除、省略保留；与非日期字段同一版本/事务，失败不半写/不半建号。员工和其他公司调用返回 403。
- `GET /me`、`GET /me/profile`、有权 `GET /users/{id}` 增加 `hireDate` 与 `tenure`；`tenure` 为 `null` 或 `{years,months,days,asOfDate}`。算法：先取完整周年（闰日截当月最后一天），再从周年锚点取 0–11 个完整月（月末截断），最后取剩余天数；每步不越过公司今天，不用 365/30，不用账号创建日。
- 邮箱：本人，以及同时满足当前资料查看权、同组织有效人员和实际管理链上级的详情读取者可在 `GET /users/{id}` 得到 `email`（可空）；同级、下属、其他链、跨公司不读。普通目录、下属树摘要、负责人候选、任务参与人摘要均不带电话/邮箱/入职日/时长。管理员不通过业务详情自动获得邮箱。

### 4.6 节假日缓存、读取与维护

- `V34 holiday_calendar_years(region,year,source,source_version,source_hash,official_notice,fetched_at,last_attempt_at,last_failure_at,last_failure_code)`；`V35` 允许失败状态行的 `fetched_at` 为 NULL，使缺失年也能跨重启保留 24 小时重试间隔。
- `V34 holiday_calendar_days(region,year,holiday_date,name,is_off_day)`，主键 `(region,year,holiday_date)`；整年验证通过才在同一短事务内原子替换。
- `GET /api/v1/calendar/holidays/{year}`：当前有效员工及独立管理员；只读本地缓存，返回 `year,region,status,days,source,updatedAt`，stale/missing 另带安全 `reason`。`ready` 有有效缓存；`stale` 最近刷新失败但仍返回原完整数据；`missing` 为 `days=[]`、`updatedAt=null`，不预测。
- `POST /api/v1/admin/calendar/holidays/{year}/refresh`：仅独立管理员，必须 `Idempotency-Key`；固定来源配置，不接受客户端 URL；成功写 `audit_logs` 的 `holiday.calendar.refreshed`，失败 502 `HOLIDAY_REFRESH_FAILED` 并保留旧缓存/成功时间。
- 后台启动后及每日检查当前年/次年；缺失年按年去重，失败后至少 24 小时再试；普通 GET 不逐次访问外网。真实来源核验、年度样本和当前 Windows 实施机无法访问 GitHub raw 的限制见 `backend/docs/holiday-calendar-source.md`。

### 4.7 数据迁移与回退边界

- 只新增 `V32`–`V35`，不修改 V1–V31 的历史文件与校验和；空库与从当前基线升级收敛到同一结构。
- 四类新增结构：事项日期范围、表单偏好、入职日、节假日缓存；`V35` 只把节假日年度头的 `fetched_at` 放宽为可空以保存缺失年失败状态。存量单日事项 `start=end`，表单偏好空，入职日 NULL，日历置顶保留。
- 已存跨日记录后，旧二进制不认识 `start_date/end_date`，不能直接作为安全回退：先停止写入、导出新增数据，按第 11 章记录升级前备份在隔离库演练后恢复；不得静默压缩跨日事项。

### 4.8 错误、版本与分页边界

| 场景 | 约定 |
| --- | --- |
| 每日事项混用日期格式 / 缺端点 / 倒置 / 超 93 天 | 400 `INVALID_INPUT` |
| 旧 `date` 改期当前跨日项 | 409 `DAILY_ITEM_RANGE_REQUIRED`，不部分修改 |
| 旧 `If-Match` 版本 | 412，保留服务端新版本 |
| 表单未知参数/非法枚举/倒置日期/q>200 | 400 `INVALID_INPUT` |
| 表单置顶未发布 | 409 `TASK_NOT_PUBLISHED` |
| 日历置顶非当前负责 | 403 |
| 入职日期未来/非法 | 400 `INVALID_INPUT`，不半写 |
| 非管理员维护员工 | 403 |
| 日志填充源缺/非法日期、未知参数 | 400 |
| 管理员读取员工填充源 | 403 `BUSINESS_ROLE_REQUIRED` |
| 节假日年份非 1900–9999 四位数字 | 400 `INVALID_YEAR` |
| 节假日刷新失败/年份未公布 | 502 `HOLIDAY_REFRESH_FAILED` + 安全 `reason`，保留旧缓存 |
| 员工或非当前管理员刷新节假日 | 403 |

分页形式保留三类区别：通用 `/tasks` 为 `nextCursor` 字符串（offset 的字符串形式）；评论为稳定 ID 游标；每日事项、表单、通知等为 `nextOffset` 数字。新接口不统一改写既有三类。

### 4.9 升级前备份与恢复演练步骤

升级见证（`audit/prepare-employee-client-contracts-and-business-upgrade/upgrade-witness.json`）从 V31 基线写入真实任务、标签、日志、日历置顶和单日事项，升级到 V34 后核对行级不变；同一数据库还执行了一次 `mysqldump` → 独立库导入 → 关键业务表行指纹比对。正式环境按以下顺序操作：

1. 停止业务写入（停新入口或维护窗口），记录当前 `flyway_schema_history` 最大成功版本与校验和。
2. `mysqldump --single-transaction --no-tablespaces --set-gtid-purged=OFF --column-statistics=0 <db> > backup-before-v32-v34.sql`，保存 SHA-256。
3. 启动新版本完成 V32–V34；核对四个新增结构、历史表行数/ID/稳定标识、任务/日志/审计/共享标签不变。
4. 恢复演练：把备份导入隔离库，比对关键业务表行指纹；演练通过前不要让新客户端写入。
5. 回退优先级：先停止新入口/回退新读取与适配器，保留新增数据并使用兼容修复版；若必须恢复旧结构，先停止写入并导出跨日/入职/偏好/缓存数据，按备份在隔离库演练后再恢复。不得用旧二进制直接打开新结构，也不得静默把跨日事项压缩为单日。

## 5. 权限与数据边界摘要

- 每日事项：本人 + 同组织；上级、管理员、跨公司不因组织权读取/维护。
- 表单查询：先正常任务读取权，再限本人原始创建/当前负责并集；不等于“所有可见任务”。
- 表单置顶：本人偏好，不是任务写入，也不授予任何任务/人员读取权。
- 日志填充源：只读本人范围，不做跨人聚合，不打开日志写权限。
- 入职/时长/邮箱：只进授权详情；目录/摘要/候选不带；组织变化后按当前链重验。
- 节假日：只提供标识，不改变任务排期、工期、全天语义、日志日期或提醒节点。

## 6. 交接完成度自检

- 90 个清单 ID：N01–N04、A01–A05、H01–H03、D01–D05、T01–T10、R01–R08、C01–C10、F01–F05、L01–L06、G01–G03、M01–M03、P01–P04、S01–S04、I01–I07、X01–X03、O01–O04、Q01–Q06，本文各出现一次。
- 54 条主规格：第 3 节逐条承接，未修改项继续以主规格正文为准。
- 12 项新指导：第 1 节逐条给出 A 落点与 B 责任。
- 第 7–10 章已在 A 内实现并按 `implementation-notes.md` 的检查记录验证：节假日、员工 Web 过渡、动画演示、完整回归；仍未交付的是 B 的 Flutter 工程、APK、真机手势和系统推送。
- 本文件是 A 交接资料，不是独立验证 PASS；最终结论以 e13 验证报告为准。
