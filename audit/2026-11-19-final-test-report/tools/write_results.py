from pathlib import Path
import json
OUT=Path('/Users/aoxiang/Desktop/软件测试/audit/2026-11-19-final-test-report');p=OUT/'测试报告.md';s=json.loads((OUT/'summary.json').read_text());old=json.loads((OUT/'evidence/initial-findings.json').read_text());suites=json.loads((OUT/'suites.json').read_text())
with p.open('a') as f:
 f.write('''## 7. 执行结果、重跑与缺陷闭环

### 7.1 分层统计

| 层次 | 最终实际执行 | 通过 | 失败 | 原始证据 |
|---|---:|---:|---:|---|
| 后端 JUnit | 225 | 225 | 0 | evidence/final/junit-reports、backend.log |
| pytest 真实接口 | 139 | 139 | 0 | evidence/final/api/results.xml、pytest-cases.jsonl |
| Flutter 单元 / 组件 | 248 | 248 | 0 | evidence/final/flutter.jsonl |
| Flutter 管理联动真实后端 | 5 | 5 | 0 | evidence/final/flutter-real/flutter-managed.jsonl |
| Flutter 员工业务真实后端 | 32 | 32 | 0 | evidence/final/flutter-real/flutter-real-backend.jsonl |
| 原生安卓 JVM | 25 | 25 | 0 | evidence/final/native-reports |
| 框架合计 | 674 | 674 | 0 | summary.json |
| 业务 / 网页 / 迁移套件，另计 | 41 套 | 41 套 | 0 | 41套回归结果.csv |
| 打印业务断言，另计 | 3105 | 3105 | 0 | 逐项测试结果.csv |
| 独立包真机检查，另计 | 16 项 | 16 项 | 0 | evidence/final/flutter-real/phone-checks.json |

默认 Flutter 命令把 32 条需要真实服务的用例记为 SKIP；这些用例已经在独立真实后端运行全部执行通过。`默认运行跳过记录.csv` 原样保留这批记录，不将它们重复加进 674，也不把真实的 SKIP 改成 PASS。报告表格中的“实际执行”排除这批默认跳过记录，但包括另一次真实运行的 32 条。

原生安卓 lint 和 assemble 成功，仍有 38 条既有警告，包括 DrawAllocation 18、SetTextI18n 7、ExifInterface 4、ObsoleteSdkInt 2、ClickableViewAccessibility 2，其他五类各一；不能写成零警告。Flutter analyze 的 LSP 工具曾异常退出，后用独立 `dart analyze --format machine lib` 完成 lib 静态核验。它不是全工程所有目录的同义替代，相关工具日志均保留。

### 7.2 两项不稳定执行与最终采用结果

| 首轮现象 | 处理方式 | 最终结果 | 最终采用证据 |
|---|---|---|---|
| 每日事项在已通过 141 条检查后 Runtime.evaluate 通信超时 | 其余套件继续，另起独立夹具完整重跑，不改断言 | 385 条检查通过 | evidence/final/daily-recheck |
| 日志标签未在等待窗口内进入 founder 已认证状态 | 独立夹具重跑整个标签套件，不改预期 | 45 条检查通过 | evidence/final/log-tags-recheck |

首轮失败说明自动化运行存在等待 / 通信不稳定性，不能抹掉或宣称已证明绝无间歇性问题。最终用例通过证明对应重跑完成了断言，不能据此证明所有时序组合都稳定。后续若频繁复现，应收集当时网络、服务延迟和浏览器状态，进一步区分应用竞态与测试同步问题。

### 7.3 九类问题闭环

下表“失败数”是修复前的复现输入或断言数，不能再加到最终通过数量中。

| 编号 | 问题与等级 | 修复前失败数 | 修复与复测 | 结论 |
|---|---|---:|---|---|
''')
 fixes={
 'F01':'查询现行 department_id；正常 / 非法分页及权限回归均通过（TC-19）',
 'F02':'新增 / 编辑先要求字符串；错误类型 8 组及长度边界通过（TC-13、14）',
 'F03':'显示分隔符规范化与前导 + 规则统一，提交规范化号码（TC-01）',
 'F04':'前端字母 / 数字分类与服务端约定对照，中文样本通过（TC-02）',
 'F05':'密码最小值按码点；9 码点 emoji 混合样本拒绝（TC-02）',
 'F06':'补载远月后继续定位具体目标日；四种时序 / 宽度场景通过（TC-22）',
 'F07':'精确整数转换后再检查范围，分数和 2^64 拒绝（TC-20）',
 'F08':'withZone 保留 offset，推进后 instant 不变（TC-20）',
 'F09':'只接受精确数值 0 / 1，不再依赖 intValue 截断；辅助方法负例通过',
 }
 for r in old:f.write(f"| {r['id']} | {r['title']}（{r['priority']}） | {r['cases']} | {fixes[r['id']]} | 已修复、复测通过 |\n")
 f.write('''
F07、F08 属于受控测试时钟路径；默认生产系统时钟不支持业务账号推进。F09 原本已有 HTTP allDay 严格 Boolean 校验保护，本次修复内部辅助方法，不据此前现象声称发生过 HTTP 校验绕过。F02 的证据为错误类型被当作文本接受，没有证据支持“已执行 SQL / 代码”等更强结论。

## 8. 覆盖率与截图

### 8.1 采集方法和口径

本报告对修复版 class 文件重新生成 JaCoCo。单元覆盖来自本次 clean 构建的 JUnit；“合并覆盖”只合并该单元执行数据与本轮业务回归中产生的 39 个后端 agent 执行文件。并非所有层次都启用了 agent：139 条 pytest、Flutter 真实服务、部分独立重跑与线上验证不在这次合并数据内。它们的功能结果仍单独记录，不能把“未纳入该覆盖采集”误写成“没有测试”。

使用 JaCoCo CLI 合并后，关联当前 `backend/target/classes` 和源文件，生成 HTML / XML / CSV；生成日志未报告 class 不匹配。覆盖输入文件及哈希见 `coverage/inputs.json`。Flutter LCOV 来自修复版单元 / 组件运行，按 DA 行记录统计。

| 指标 | 仅 JUnit：命中 / 总数（比例） | 本轮采集合并：命中 / 总数（比例） |
|---|---:|---:|
''')
 for kind,label in [('LINE','行'),('BRANCH','分支'),('INSTRUCTION','指令'),('METHOD','方法'),('CLASS','类'),('COMPLEXITY','复杂度')]:
  a=s['coverageUnit'][kind];b=s['coverageCombined'][kind]
  f.write(f"| {label} | {a['covered']} / {a['covered']+a['missed']}（{a['percent']}%） | {b['covered']} / {b['covered']+b['missed']}（{b['percent']}%） |\n")
 fc=s['coverageFlutter'];f.write(f"\nFlutter LCOV 行覆盖：{fc['covered']} / {fc['total']}，**{fc['percent']}%**。\n")
 f.write('''
修复前报告曾使用另一套更广的 agent 文件集合。由于源代码和采集集合不同，不应直接比较两个百分数的升降，也不沿用旧数值宣称修复版覆盖。合并指标不是“纯单元覆盖”，更不是路径覆盖、条件组合覆盖或 MC/DC。

### 8.2 覆盖率截图

下图为本次修复版报告的实际渲染截图，不是示意图。绿色代表被执行，未命中的行 / 分支需要结合业务价值继续补测。

![修复版后端合并覆盖率](coverage/后端合并覆盖率.png)

![修复版纯 JUnit 覆盖率](coverage/JUnit覆盖率.png)

Flutter 行覆盖截图与按文件统计，见随附总览页和 LCOV 文件。可交互的 JaCoCo 明细位于 `coverage/java-combined/index.html`、`coverage/java-unit/index.html`；逐方法统计另见 `逐方法覆盖与复核.csv`。

### 8.3 未覆盖与解释

本次合并仍有 476 行、1184 个分支未命中；单元覆盖约三分之一，不能用合并九成以上的行覆盖替代补强核心业务单元测试。1019 个可执行方法中 85 个在此次合并数据中未命中，包含哪些退役入口、构造器或当前重要行为，须按明细人工判断。

覆盖率只证明代码执行，不证明断言足够强，也不证明“每核心方法至少三条用例”。例如对对象存在性只看 200 的弱断言，即使覆盖多行，也不足以验证读回值、无越权字段和无重复副作用。

## 9. 部署、数据一致性、手机与重启验证

### 9.1 两套实例分别发布

| 入口 | 服务 | 新库 | 保留旧库 |
|---|---|---|---|
| HTTPS 443 | pandora.service | pandorarel20261119fixes | pandorarel2026110630ca59d |
| HTTPS 6644 | pandora-web-version.service | pandorademo20261119fixes | pandora_demo |

两服务最终使用 `/opt/pandora/releases/20261119-tested-fixes/server.jar`，与本地修复版 JAR 哈希一致。6644 路由继续使用独立的 18091 后端，443 使用 18090；没有把 Flutter 切换为 443 或改用另一套数据。

两个受限备份目录分别为 `/opt/pandora/backups/20261119-final-cutover` 与 `/opt/pandora/backups/20261119-web-final-cutover`，保留 SQL、配置和发布记录；报告不附数据库密码、哈希或真实用户手机号。

### 9.2 关键记录迁移核对

| 表 / 对象 | 443 升级前 → 后 | 6644 升级前 → 后 |
|---|---:|---:|
''')
 d1=json.loads((OUT/'evidence/final/deployment.json').read_text());d2=json.loads((OUT/'evidence/final/deployment-6644.json').read_text())
 for t,n in [('users','员工'),('admin_accounts','独立管理员'),('employee_placements','组织位置'),('tasks','任务'),('task_versions','任务版本'),('approval_requests','申请'),('work_logs','日志'),('home_items','公司信息'),('task_log_comments','评论'),('notifications','通知')]:
  f.write(f"| {n} / {t} | {d1['before'][t]} → {d1['afterMigration'][t]} | {d2['before'][t]} → {d2['afterMigration'][t]} |\n")
 f.write('''
上述均一致。候选服务确认升级至 V36 和健康后才切换；原服务配置与旧发布保留。临时升级副本及候选端口随后已清理。

### 9.3 线上与手机核验结果

- 443 / 6644 严格 HTTPS 健康请求均为 200，应用状态 UP，数据库 MySQL；未通过关闭证书校验制造通过。
- 两个入口获取的每日事项 JavaScript 与本地修复文件 SHA-256 一致，证明“今天”修复确实在线上提供；6644 版本标识为 20261119-f3182ca9。
- Nginx 配置检查通过，原 TLS、入口及数据路由保持对应。
- Flutter APK 已安装到 `cn.pandora.employee.flutter.debug`，安装后字节指纹与构建一致，地址明确为 `https://8.141.96.122:6644/api/v1`。
- 最终重新启动手机应用后检测到真实已登录任务看板，无连接错误提示。仅记录布尔状态，没有把真实任务内容截图放入报告。
- 用户重启服务器后再次只读核验：三项服务均 active 且 enabled；443 / 6644 健康均 UP；两套应用仍指向修复版发布目录。这项来自本会话重启后核验，未额外计入 674 或 16。

![隔离真机夹具的 Flutter 日视图](evidence/final/flutter-real/phone-screenshots/employee-day-view.png)

图示来自隔离演示数据：展示日视图周选择、入口与空态，不冒充最终线上真实用户内容或非空日程叠放截图。

## 10. 局限、人工复核和验收安排

### 10.1 已知范围限制

本轮没有执行高并发容量、数日稳定性、真实弱网丢包 / 高延迟、全部 Android 型号 / 系统版本、iOS、完整 TalkBack、字体缩放及折叠 / 展开过程的兼容矩阵，也没有执行完整渗透测试。原生旧客户端只做 JVM、lint、构建，没有另行覆盖安装旧客户端。

固定时钟与转发移除可以稳定复现时间 / 断网边界，却不能替代真实运营商网络全部故障。有限样本的随机密码唯一性测试只能发现样本内碰撞，不能证明绝无碰撞。服务器真实数据副本核验是在当前小规模部署上完成，不能据此承诺大库迁移耗时。

### 10.2 人工逐条审核

组员需利用用例 CSV、测试源码和原始结果逐条确认：需求是否仍有效、输入是否到达目标层、预期是否独立于实现、正常 / 边界 / 异常是否齐全、断言是否足够强、数据与状态是否隔离，以及失败与重跑解释是否成立。

“报告已完成”不表示人工签字已完成；“自动化范围通过”不表示课程所有过程性要求已由程序代为满足。共享文件夹上传、组员姓名与审核意见由小组完成。

### 10.3 验收演示建议（20–30 分钟）

| 时间 | 演示内容 | 目的 |
|---|---|---|
| 0–4 分钟 | 系统边界、角色矩阵与最终统计 | 解释测了什么及数量口径 |
| 4–11 分钟 | TC-02、TC-05、TC-13、TC-19 的源码 / 断言 | 展示边界、并发和真实缺陷闭环 |
| 11–17 分钟 | 日历“今天”回归与手机断网恢复证据 | 展示时序和端到端方法 |
| 17–22 分钟 | 覆盖率页面、未命中行与逐方法审核 | 说明覆盖率含义及空白 |
| 22–27 分钟 | 两实例升级、数据一致性与自启动 | 证明发布的是已测试版本 |
| 27–30 分钟 | 提问与人工审核说明 | 明确限制，不把通过夸大为无缺陷 |

## 11. 复现操作与证据索引

### 11.1 可重复执行的准备

使用完整项目，配置 JDK、Maven 缓存、Flutter / SDK、MySQL 和实际 Edge。运行工具依赖项目已有随机库夹具，并非无需配置的通用一键环境。测试输出请创建新的绝对路径目录，不覆盖本报告证据。

```sh
# 项目根目录，推荐独立 Python 环境
python3 -m venv /tmp/pandora-test-venv
/tmp/pandora-test-venv/bin/pip install -r backend/tests/requirements.txt
mkdir -p /absolute/new-output

# 后端 JUnit 与覆盖率
cd backend
mvn -Ptest-coverage clean verify
cd ..

# 当前 JAR + 随机数据库：139 条真实接口
PANDORA_TEST_OUTPUT=/absolute/new-output /tmp/pandora-test-venv/bin/python -m pytest backend/tests -q --junitxml=/absolute/new-output/results.xml

# 41 套回归；可用 --only 指定当前套件
python3 backend/scripts/run_comprehensive_tests.py --output /absolute/new-regression

# Flutter 单元 / 组件；需要真实服务的用例由下一步执行
cd flutter
flutter test --no-pub --coverage --reporter json
cd ..
FLUTTER_BIN=/absolute/flutter/bin/flutter python3 backend/scripts/run_flutter_acceptance.py --output /absolute/new-flutter-real
```

真机完整复现需再配置 Android SDK、Gradle / PUB 缓存并连接授权设备，向 Flutter 真实服务工具传 `--phone-command backend/scripts/check_flutter_phone.py`。该工具使用独立测试包、隔离库、自己的转发，拒绝覆盖已有专用端口。报告阶段没有为做文档再修改或重新部署服务器。

### 11.2 证据目录

| 交付物 | 内容与用法 |
|---|---|
| 测试报告.pdf / 测试报告.md | 最终正式报告与可编辑文本 |
| 测试总览.html | 离线筛选逐项记录、查看方法和覆盖率 |
| 逐项测试结果.csv / .json | 3795 条具名记录；分层标明结果和 evidence 路径 |
| 默认运行跳过记录.csv | 32 条默认 Flutter SKIP，已由独立真实服务执行补齐 |
| 详细方法用例卡.json | 24 组前提、输入、步骤、预期和证据入口 |
| 41套回归结果.csv | 最终采用的 41 套结果，包含明确重跑来源 |
| 逐方法覆盖与复核.csv | 1019 个可执行方法及人工三类用例确认栏 |
| coverage/ | 当前 class 对应的 HTML / XML / CSV / LCOV、采集输入与截图 |
| evidence/final/ | 原始框架输出、首轮与重跑、真机、线上及部署核验 |
| evidence/initial-* | 修复前缺陷和统计，防止历史与最终状态混淆 |
| source/ | 测试源码副本，供逐条审核；执行需完整项目依赖 |

## 12. 附录：提示词、审核表与统计定义

### 附录 A：实际请求与可复用设计模板

实际用户测试请求：“对项目进行完整测试，参考这两个文档，注意测试要详细，包含各种极端情况”。后续请求为修复所有错误、再测试并重新部署，以及完成包含详细测试方法的报告。

本轮没有独立外部模型逐条提示调用日志。下面是将实际设计规则整理成的可复用模板，不伪称一次历史逐字调用：

> 阅读当前代码、需求与两份验收资料，先确定每项约束的输入类型、长度口径、范围、角色与状态。用等价类和精确边界设计正常、边界、异常用例，覆盖 Unicode、时区与日期、错误 JSON 类型、跨组织权限、版本、幂等、并发和恢复。分别运行 JUnit、隔离真实 MySQL 接口、网页、Flutter 与手机。检查状态码之外的读回值、行版本、对象数、事件数、可见内容和无敏感字段。保留修复前失败与修复后结果，区分过时预期、工具故障和产品问题。报告列出执行证据、采集范围和局限，不把跳过、重跑、覆盖率或模块用例数量误作每个核心方法已人工审核。由小组逐条确认并签字。

### 附录 B：人工审核记录模板

| 核心方法 / 需求编号 | 正常用例 ID | 边界用例 ID | 异常用例 ID | 输入确实到达该层 | 预期依据 / 修改意见 | 审核人 / 日期 |
|---|---|---|---|---|---|---|
| 待填写 |  |  |  |  |  |  |
| 待填写 |  |  |  |  |  |  |
| 待填写 |  |  |  |  |  |  |

审核意见应可定位到具体参数和断言。若某异常在认证层提前拒绝，不能不加说明就把它当作服务内部方法的异常分支覆盖。未审核的行保持待审核，不预填“通过”。

### 附录 C：统计与结论用语

- **用例通过：** 对应框架具名实际执行记录通过；参数化每组输入各计一条。
- **套件通过：** 整个脚本最终退出成功，不仅是前面出现了几条 PASS。
- **打印断言：** 原日志中可观察的 PASS 行数，是未打印断言的下界统计，不能当作独立业务功能数。
- **跳过：** 没有在该默认运行执行；另行执行后须保留两个上下文，不直接改写原 SKIP。
- **复测通过：** 修复后原复现输入符合预期，且相关回归完成；不是证明所有潜在缺陷已消失。
- **覆盖率：** 指明 class、采集输入和层次；行 / 分支 / 方法覆盖各有含义，不能互相替代。
- **部署通过：** 当前服务器实例确实运行所测二进制，入口、数据隔离、健康与应用启动已核验；不替代容量与安全承诺。

本报告完成于 2026-11-19，已提供可审核的测试方法、实际结果、缺陷闭环和部署证据。共享与验收前请组员补齐人工复核记录。
''')
print('Report text complete')
