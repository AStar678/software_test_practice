# Implementation Verification

- Change: `fix-pandora-formal-requirement-deviations`
- Schema: `spec-driven`
- Verdict: **FAIL**
- Verified at: 2026-10-21T19:05:52+08:00
- Implementation roots: `/Users/watuji/MyGitDev/software_test_practice`（根目录前端与 `backend/`）
- OpenSpec root: 同仓库 `openspec/`，repo-local，未使用独立 store。
- Verified revision: `87f272bb155c28ccffd5d0e6ba5c7db5d053d536`；开始工作树干净，结束仅本报告修改。

## Summary

按用户允许采用增量复验。完整路径清单及SHA-256逐文件比较确认，相对前次独立基线a5c29ee，仅 `潘多拉-任务接入.js` 与 `backend/scripts/check_handover_browser.js` 两个实施/测试文件改变。全部规划、后端、迁移及其他代码未变；重查全部差异，保留明确归属前轮的未受影响独立证据及完整147场景矩阵。

**V-010仍为pending / medium，但缺口已收窄**：专用交接普通预览现已正确显示并随目标更新；保存预设与预览请求并发时，表单重绘恢复旧审核人，响应完成只更新脱离页面的旧元素。真实页面仍显示李敏，而真实预览API及提交的pending均为王海。沿用V-010的提交前实际审核人条件，不新增编号。V-001—V-009维持verified-resolved。

本轮strict通过，Java **65/65** + package；交接浏览器 **22/22×3**（320×740、390×844、1440×900）；数据库完整性 **18/18**。独立异步补充 **6/7**，唯一失败即上述可见预览过时；快速切换的乱序响应隔离及实际提交路线通过。320首次Chrome启动失败，重试22/22，未作为产品缺陷或未验证场景。

仅更新本报告，保留所有Repair notes原文。DEV-029系统推送及A-25/真机相关部分继续授权延期；Chrome视口模拟不计真机证据。

## Verification Basis

| Path or scope | Revision / content fingerprint / file inventory |
| --- | --- |
| 当前实施/规划/配置/测试/非忽略新增文件 | Git `87f272bb155c28ccffd5d0e6ba5c7db5d053d536`；220路径；完整清单+内容SHA-256 `03739c589626358296853b62c45432f5adb1e6e7f3ab3d83ddd0e095cdfa53b8` |
| 最近独立基线 | `a5c29eed1f0b522769d2c57f33f98ccf828e485b`；220路径；SHA-256 `e371dc602c1ac20392f9eacb582431ff1a1794a07014363dabe1a2c228f6685a`；对应报告在当前HEAD历史中 |
| 更早保留独立基线 | `cb1bfc3cbbd1f8980f45371580d9283f2fa968e3`；217路径；SHA-256 `4f1af0ab5b0657ef7e0812029e2bffa95e1ef86acbd4fd46fd6a7b7bc7104a1b`；报告提交ddfa318 |
| 本轮差异（2路径） | `潘多拉-任务接入.js`：完整有序负责人替换后调用既有reviewer-preview、初始化/目标change预览及序列隔离；`backend/scripts/check_handover_browser.js`：增加4个正常预览断言并改用change事件 |
| 不变范围 | 全部contextFiles与proposal/design/tasks/delta spec、后端代码/测试/配置、V1—V14、其他页面均与a5c29ee一致；35DEV/150AUD/25A追踪源不变 |
| 本轮产物 | `/tmp/pandora-e13-verify-87f272b/`：basis-start/end.json、maven.log、handover-{390,1440}.json、handover-320-retry.json、browser-database.json、preview-extra.json/js/log、preview-after-save.png |
| 保留产物 | `/tmp/pandora-e13-verify-a5c29ee/`、`/tmp/pandora-e13-verify-cb1bfc3/`；证据归属见Checks，均为独立verify结果，不使用apply自报JSON代替 |
| 排除项 | basename `verification.md`、`implementation-notes.md`及Git忽略runtime/构建产物；当前jar由本轮源码package |

开始/结束完整清单的revision、files、digest完全一致；没有验证期间输入变化。逐路径比较而非仅commit比较，确认只有上述两文件改变。复算方式如下；临时产物不是永久证据库，相关后续修改须重新核查受影响覆盖。

```python
import subprocess, hashlib, json, pathlib
root = pathlib.Path.cwd()
paths = subprocess.check_output(['git','ls-files','-co','--exclude-standard','-z']).decode().split('\0')
files = {
    p: hashlib.sha256((root/p).read_bytes()).hexdigest() if (root/p).is_file() else 'MISSING'
    for p in sorted(set(paths))
    if p and pathlib.Path(p).name not in ('verification.md','implementation-notes.md')
}
print(len(files))  # 220
print(hashlib.sha256(json.dumps(files, sort_keys=True, separators=(',',':')).encode()).hexdigest())
```

## Apply Handoff Review

重读全部contextFiles、implementation-notes及现有报告。65/65勾选是实施声明。handoff变更名/schema正确，但Windows路径、29e3f99+dirty、60测试及V12过时；当前为Mac、87f272b、65测试及V14。全部Repair notes原文保留。

| Handoff claim / reminder | 独立处置 |
| --- | --- |
| 专用交接及提交前预览已交付 | NBH22×3确认普通预览；NBP确认保存期间重绘竞争，V-010 pending；a5的NH/NP及NBX成功项保留预设/入口/权限覆盖 |
| Java21/package、资源白名单 | 本轮package65/65；实际构建服务加载当前新预览 |
| 隔离库、时钟/worker与套件顺序 | 本轮2个fresh隔离库，13426临时MySQL，18560/18561服务；worker暂停自动运行，未连接用户库 |
| HTTP/数据库/秘密与日志边界 | 本轮D18；未变O/R/P/PC/E/S及A/L证据按下表归属保留 |
| 通知重放/原申请/自动已读 | 未变E/BN/PX保留独立证据；本轮NBP只确认实际pending路线，不把无断言的worker请求称通知验证 |
| 新空库/V4映射阻断、顺序/派发估计、无法绑定旧通知 | V1—V14及所有相关代码未改；保留a5的V14映射10/10、18+4旧日志，以及cb两映射顺序/来源只读证据 |
| 234px/全屏日志/冻结/管理端/日历 | 两文件影响追踪完成；交接/搜索入口本轮实跑，其余保留对应未变的浏览器/真实指针证据 |
| strict两个长描述警告 | 过时，本轮valid:true、issues:[] |
| 推送/真机延期，不自宣归档 | DEFERRED保留；本轮FAIL，不归档 |

## Checks

本轮macOS、Java21、离线Maven、MySQL9.3、Node24、headless Chrome。复用临时隔离MySQL数据目录及端口13426，两个新库 `e13c_preview_browser`、`e13c_preview_supplement`；服务18560/18561，正常seed，受控时钟开关仅用于验证，自动worker延迟3600000ms。检查结束关闭临时服务/MySQL。

构建在backend运行：

```sh
JAVA_HOME=/opt/homebrew/opt/openjdk@21/libexec/openjdk.jdk/Contents/Home \
  mvn -o -B -ntp -Dmaven.repo.local=.runtime/m2 package
```

| 本轮命令/检查 | Result | Notes |
| --- | --- | --- |
| OpenSpec status/instructions apply及全文重读 | 完整 | spec-driven；all_done，65/65 |
| `openspec validate fix-pandora-formal-requirement-deviations --type change --strict --json --no-interactive` | PASS | valid:true、issues:[] |
| Java21 Maven package含test | PASS65/65 | 无failure/error/skip；BUILD SUCCESS |
| NBH `node scripts/check_handover_browser.js`，分别 `--width 320 --height 740`、390/844、1440/900 | PASS22/22×3 | 本人/非创建者直属领导、保存/使用预设、目标切换实际审核人及pending一致；真实页面/HTTP，不称真机 |
| D `python3 scripts/check_database.py`，临时client.cnf及浏览器库 | PASS18/18 | browser-database.json，read_only |
| NBP `node /tmp/pandora-e13-verify-87f272b/preview-extra.js --base-url http://127.0.0.1:18561 --width 390 --height 844 --output /tmp/pandora-e13-verify-87f272b/preview-extra.json` | **6/7；FAIL V-010** | 真实响应只延迟/乱序交付；最新选择隔离通过，保存后重绘只更新脱离DOM的旧元素，截图证实可见旧审核人；后端预览与实际pending一致 |
| 全差异/完整清单/全部规范矩阵影响检查 | 部分FAIL V-010 | 初始化预览、完整有序负责人、上下文/序列隔离正确；保存重绘与pending回调衔接错误 |

临时编排为 `/tmp/pandora-e13-verify-cb1bfc3/preview-verify.py`（通过run.py exec），产物输出本轮目录；各套件独立JSON/日志为依据，共享编排stdout会被覆盖，不作结果证据。320首次启动Chrome时`no page target`，同一当前jar的补充库重试22/22；本地连接受sandbox限制后按工具授权执行成功，无环境阻断。NBP没有伪造后端路由，也没有改仓库测试或产品。

保留且**本轮未重跑**的a5c29ee独立证据：NH29、O58、R64、P26、PC5、E91、S53、D18×6、NP8、M14映射10及V4升级/旧日志18+4；NBX23个成功项（本人刷新预设、人员详情保存/清除等）。旧NBX预览完全缺失的失败由本轮NBH/NBP取代；旧NBH18×3由本轮22×3取代。

保留且**本轮未重跑**的cb1bfc3独立证据：A47、L17、H12、I18、BA15×3、BL22×3、BN21×3、BH33、BC45、AU11、LK5、另一V4映射顺序10、UI4、CS4、CT42真实指针、NB空通知键盘3、PX精确时间/三方竞争8、PR26。它们对应实现/测试/配置/规划均无变化；完整差异影响分析表明可保留未受影响覆盖。前次探针夹具/断言错误不当作产品finding。

## Requirement Coverage

完整保留21条有效要求、147场景及1移除要求，不以抽样替代覆盖。NBH、NBP及本轮D指87f272b；NH/NP/M14与S/O/R/P/PC/E和历史D指a5c29ee；A/H/I/L及旧浏览器/专项别名指cb1bfc3；X为AU/LK/M/PX/CT/NB等保留证据。T为完整差异影响检查。所有证据归属以上述Checks为准；旧finding中的“本轮cb1bfc3”是该历史复验，不表示本次重跑。Java路径前缀backend/src/main/java/cn/pandora/。

| Requirement / scenario | Evidence | Result |
| --- | --- | --- |
| **R01 Five-page navigation（要求正文）** | 前端主页面/认证导航；auth/AuthFilter.java、auth/AuthService.java；S、BA、BC、BL、BN | **PASS** |
| R01.S01 Navigate with an authenticated identity | 前端主页面/认证导航；auth/AuthFilter.java、auth/AuthService.java；S、BA、BC、BL、BN | PASS（所列执行证据及 T） |
| R01.S02 Navigate across the prototype | 前端主页面/认证导航；auth/AuthFilter.java、auth/AuthService.java；S、BA、BC、BL、BN | PASS（所列执行证据及 T） |
| **R02 Four-quadrant dashboard（要求正文）** | workspace/WorkspaceService.java、导图前端布局；H、O、BH、T | **PASS** |
| R02.S01 Scroll independent quadrants | workspace/WorkspaceService.java、导图前端布局；H、O、BH、T | PASS（所列执行证据及 T） |
| R02.S02 Rank a newly assigned old task | workspace/WorkspaceService.java、导图前端布局；H、O、BH、T | PASS（所列执行证据及 T） |
| R02.S03 Show concise tasks and read only company information | workspace/WorkspaceService.java、导图前端布局；H、O、BH、T | PASS（所列执行证据及 T） |
| R02.S04 Maintain personal items through detail | workspace/WorkspaceService.java、导图前端布局；H、O、BH、T | PASS（所列执行证据及 T） |
| R02.S05 Use the ten day log window | workspace/WorkspaceService.java、导图前端布局；H、O、BH、T | PASS（所列执行证据及 T） |
| R02.S06 View the four dashboard quadrants | workspace/WorkspaceService.java、导图前端布局；H、O、BH、T | PASS（所列执行证据及 T） |
| R02.S07 Scroll one dashboard quadrant | workspace/WorkspaceService.java、导图前端布局；H、O、BH、T | PASS（所列执行证据及 T） |
| R02.S08 Read an assigned task without clipping | workspace/WorkspaceService.java、导图前端布局；H、O、BH、T | PASS（所列执行证据及 T） |
| R02.S09 Executive maintains company information | workspace/WorkspaceService.java、导图前端布局；H、O、BH、T | PASS（所列执行证据及 T） |
| R02.S10 Reject company information above the limit | workspace/WorkspaceService.java、导图前端布局；H、O、BH、T | PASS（所列执行证据及 T） |
| R02.S11 Edit personal information | workspace/WorkspaceService.java、导图前端布局；H、O、BH、T | PASS（所列执行证据及 T） |
| R02.S12 Reject personal information above the limit | workspace/WorkspaceService.java、导图前端布局；H、O、BH、T | PASS（所列执行证据及 T） |
| **R03 Calendar task views（要求正文）** | H/BH/T/CS/CT；当前排序及42次真实指针 | **PASS** |
| R03.S01 Use the required calendar entry points | `潘多拉-日程视图.js`、task/TaskService.java；H、BH、T；日列表实函数探测 | PASS（所列执行证据及 T） |
| R03.S02 Read a month and open a complete day list | `潘多拉-日程视图.js`、task/TaskService.java；H、BH、T；日列表实函数探测 | PASS（所列执行证据及 T） |
| R03.S03 Pin only one's own ordering | H/BH 的跨用户 pin；CS 实际函数 4/4；原 V-007 反例已正确排序 | PASS（V-007 verified-resolved） |
| R03.S04 Split a timed cross day task | `潘多拉-日程视图.js`、task/TaskService.java；H、BH、T；日列表实函数探测 | PASS（所列执行证据及 T） |
| R03.S05 Display every overlapping and all day task | CT 42/42：4重叠+3全天，320/390/1440各周/日逐项真实指针 | PASS |
| R03.S06 Switch a whole week while preserving weekday | `潘多拉-日程视图.js`、task/TaskService.java；H、BH、T；日列表实函数探测 | PASS（所列执行证据及 T） |
| R03.S07 Count mutually exclusive relationships | `潘多拉-日程视图.js`、task/TaskService.java；H、BH、T；日列表实函数探测 | PASS（所列执行证据及 T） |
| R03.S08 Open the default month view | `潘多拉-日程视图.js`、task/TaskService.java；H、BH、T；日列表实函数探测 | PASS（所列执行证据及 T） |
| R03.S09 Select a year and month | `潘多拉-日程视图.js`、task/TaskService.java；H、BH、T；日列表实函数探测 | PASS（所列执行证据及 T） |
| R03.S10 Drill from month to week | `潘多拉-日程视图.js`、task/TaskService.java；H、BH、T；日列表实函数探测 | PASS（所列执行证据及 T） |
| R03.S11 Ignore blank month task space | `潘多拉-日程视图.js`、task/TaskService.java；H、BH、T；日列表实函数探测 | PASS（所列执行证据及 T） |
| R03.S12 Drill from week to day | `潘多拉-日程视图.js`、task/TaskService.java；H、BH、T；日列表实函数探测 | PASS（所列执行证据及 T） |
| R03.S13 Ignore blank week task space | `潘多拉-日程视图.js`、task/TaskService.java；H、BH、T；日列表实函数探测 | PASS（所列执行证据及 T） |
| R03.S14 Switch time granularity | `潘多拉-日程视图.js`、task/TaskService.java；H、BH、T；日列表实函数探测 | PASS（所列执行证据及 T） |
| R03.S15 Keep task clicks distinct from drill-down | `潘多拉-日程视图.js`、task/TaskService.java；H、BH、T；日列表实函数探测 | PASS（所列执行证据及 T） |
| R03.S16 Navigate and return from a week | `潘多拉-日程视图.js`、task/TaskService.java；H、BH、T；日列表实函数探测 | PASS（所列执行证据及 T） |
| R03.S17 Navigate and return from a day | `潘多拉-日程视图.js`、task/TaskService.java；H、BH、T；日列表实函数探测 | PASS（所列执行证据及 T） |
| R03.S18 Render a spanning task bar | `潘多拉-日程视图.js`、task/TaskService.java；H、BH、T；日列表实函数探测 | PASS（所列执行证据及 T） |
| R03.S19 Render an all-day task | CT 42/42，全量全天条逐个真实点击；BH/T 全天与定时区分 | PASS |
| R03.S20 Distinguish visible tasks | `潘多拉-日程视图.js`、task/TaskService.java；H、BH、T；日列表实函数探测 | PASS（所列执行证据及 T） |
| R03.S21 Identify the current user's task relationship | `潘多拉-日程视图.js`、task/TaskService.java；H、BH、T；日列表实函数探测 | PASS（所列执行证据及 T） |
| R03.S22 Show only task names in bars | `潘多拉-日程视图.js`、task/TaskService.java；H、BH、T；日列表实函数探测 | PASS（所列执行证据及 T） |
| R03.S23 Order visible task lanes | CS 同 pin 组按真实开始/id；H/BH 置顶私有性 | PASS（V-007 verified-resolved） |
| R03.S24 Fill five monthly task rows | `潘多拉-日程视图.js`、task/TaskService.java；H、BH、T；日列表实函数探测 | PASS（所列执行证据及 T） |
| R03.S25 Handle crowded time slots | `潘多拉-日程视图.js`、task/TaskService.java；H、BH、T；日列表实函数探测 | PASS（所列执行证据及 T） |
| R03.S26 Open overflow tasks for one date | `潘多拉-日程视图.js`、task/TaskService.java；H、BH、T；日列表实函数探测 | PASS（所列执行证据及 T） |
| **R04 Role-scoped visibility（要求正文）** | Access/TaskService/WorkspaceService；O、P、PC、R、L、I、S、E、T | **PASS（原 V-001/V-004 已解决）** |
| R04.S01 Read a task crossing departments | auth/Access.java、task/TaskService.java、workspace/WorkspaceService.java；O、P、R、L、I、S、T | PASS（所列执行证据及 T） |
| R04.S02 Separate direct reports from teammates | auth/Access.java、task/TaskService.java、workspace/WorkspaceService.java；O、P、R、L、I、S、T | PASS（所列执行证据及 T） |
| R04.S03 Deny unauthorized detail and privacy leakage | P/PC/A/I/R/S/E；异常链及普通通知送达前失权回归 | PASS（V-001/V-004 verified-resolved） |
| R04.S04 Compare role visibility | auth/Access.java、task/TaskService.java、workspace/WorkspaceService.java；O、P、R、L、I、S、T | PASS（所列执行证据及 T） |
| R04.S05 Prevent unauthorized detail access | P/PC/E 的当前详情拒绝/通知脱敏与 T | PASS（V-001/V-004 verified-resolved） |
| **R05 Role-scoped task creation and assignment（要求正文）** | O/R/S/UI/AU；当前范围及自动/显式生效共用校验 | **PASS（V-008 已解决）** |
| R05.S01 Select and order authorized assignees | auth/Access.java、task/TaskService.java、负责人选择前端；O、R、S、T | PASS（所列执行证据及 T） |
| R05.S02 Enforce dispatch independently from viewing | O/UI 独立范围配置；AU 11/11 显式403及自动拒绝，合法对照 | PASS |
| R05.S03 Isolate an unpublished creation | auth/Access.java、task/TaskService.java、负责人选择前端；O、R、S、T | PASS（所列执行证据及 T） |
| R05.S04 Executive selects assignees across departments | O/R 跨部门派发；AU 权限收回后旧申请不发布 | PASS |
| R05.S05 Manager assigns a departmental task | auth/Access.java、task/TaskService.java、负责人选择前端；O、R、S、T | PASS（所列执行证据及 T） |
| R05.S06 Cancel assignee selection | auth/Access.java、task/TaskService.java、负责人选择前端；O、R、S、T | PASS（所列执行证据及 T） |
| R05.S07 Search for an unavailable assignee | auth/Access.java、task/TaskService.java、负责人选择前端；O、R、S、T | PASS（所列执行证据及 T） |
| R05.S08 Employee submits a self-created task | auth/Access.java、task/TaskService.java、负责人选择前端；O、R、S、T | PASS（所列执行证据及 T） |
| R05.S09 Superior reviews a self-created task | auth/Access.java、task/TaskService.java、负责人选择前端；O、R、S、T | PASS（所列执行证据及 T） |
| **R06 Task structure and attributes（要求正文）** | task/TaskService.java、任务表单；R、E、S、BC、TaskServiceTest、T | **PASS** |
| R06.S01 Edit task text in expanded fields | task/TaskService.java、任务表单；R、E、S、BC、TaskServiceTest、T | PASS（所列执行证据及 T） |
| R06.S02 Validate schedules and preserve provenance | task/TaskService.java、任务表单；R、E、S、BC、TaskServiceTest、T | PASS（所列执行证据及 T） |
| R06.S03 Search, clear or reject a parent relation | task/TaskService.java、任务表单；R、E、S、BC、TaskServiceTest、T | PASS（所列执行证据及 T） |
| R06.S04 Keep parents independently executable | task/TaskService.java、任务表单；R、E、S、BC、TaskServiceTest、T | PASS（所列执行证据及 T） |
| R06.S05 Create a timed task | task/TaskService.java、任务表单；R、E、S、BC、TaskServiceTest、T | PASS（所列执行证据及 T） |
| R06.S06 Create an all-day task | task/TaskService.java、任务表单；R、E、S、BC、TaskServiceTest、T | PASS（所列执行证据及 T） |
| R06.S07 Reject an inverted task range | task/TaskService.java、任务表单；R、E、S、BC、TaskServiceTest、T | PASS（所列执行证据及 T） |
| R06.S08 Preserve task creation time | task/TaskService.java、任务表单；R、E、S、BC、TaskServiceTest、T | PASS（所列执行证据及 T） |
| R06.S09 Search and select a parent task | task/TaskService.java、任务表单；R、E、S、BC、TaskServiceTest、T | PASS（所列执行证据及 T） |
| R06.S10 Show no matching parent tasks | task/TaskService.java、任务表单；R、E、S、BC、TaskServiceTest、T | PASS（所列执行证据及 T） |
| R06.S11 Inspect a child task | task/TaskService.java、任务表单；R、E、S、BC、TaskServiceTest、T | PASS（所列执行证据及 T） |
| R06.S12 Inspect a parent task | task/TaskService.java、任务表单；R、E、S、BC、TaskServiceTest、T | PASS（所列执行证据及 T） |
| R06.S13 Inspect an abstract task | task/TaskService.java、任务表单；R、E、S、BC、TaskServiceTest、T | PASS（所列执行证据及 T） |
| **R07 Task editing and completion review（要求正文）** | TaskService/Writes；R/S/E/BC/LK/PX/T | **PASS（V-002 已解决）** |
| R07.S01 Freeze and cancel an application | R/S/E；LK锁等待跨截止解冻；PX三方竞争唯一终态 | PASS |
| R07.S02 Restrict comparison data to the reviewer | task/TaskService.java、common/Writes.java、有效版前端；R、S、BC、T | PASS（所列执行证据及 T） |
| R07.S03 Distinguish completion outcomes | task/TaskService.java、common/Writes.java、有效版前端；R、S、BC、T | PASS（所列执行证据及 T） |
| R07.S04 Reopen with a new schedule | task/TaskService.java、common/Writes.java、有效版前端；R、S、BC、T | PASS（所列执行证据及 T） |
| R07.S05 Assignee updates progress | task/TaskService.java、common/Writes.java、有效版前端；R、S、BC、T | PASS（所列执行证据及 T） |
| R07.S06 Show status without numeric progress | task/TaskService.java、common/Writes.java、有效版前端；R、S、BC、T | PASS（所列执行证据及 T） |
| R07.S07 Creator approves completion | task/TaskService.java、common/Writes.java、有效版前端；R、S、BC、T | PASS（所列执行证据及 T） |
| R07.S08 Superior rejects completion | task/TaskService.java、common/Writes.java、有效版前端；R、S、BC、T | PASS（所列执行证据及 T） |
| **R08 Required notifications（要求正文）** | Events/EventsWorker/WorkspaceService；E/D/BN/T | **PASS 已执行站内矩阵（V-001 已解决）；系统推送 DEFERRED** |
| R08.S01 Deliver the submission and result matrix | common/Events.java、workspace/EventsWorker.java、workspace/WorkspaceService.java；E、D、BN、T | PASS（所列执行证据及 T） |
| R08.S02 Summarize multiple changes and preserve removed recipients | common/Events.java、workspace/EventsWorker.java、workspace/WorkspaceService.java；E、D、BN、T | PASS（所列执行证据及 T） |
| R08.S03 Use actual events without synthetic urgency | common/Events.java、workspace/EventsWorker.java、workspace/WorkspaceService.java；E、D、BN、T | PASS（所列执行证据及 T） |
| R08.S04 Inspect task change notification coverage | common/Events.java、workspace/EventsWorker.java、workspace/WorkspaceService.java；E、D、BN、T | PASS（所列执行证据及 T） |
| R08.S05 Notify on task creation | common/Events.java、workspace/EventsWorker.java、workspace/WorkspaceService.java；E、D、BN、T | PASS（所列执行证据及 T） |
| R08.S06 Surface due and emergency notices | common/Events.java、workspace/EventsWorker.java、workspace/WorkspaceService.java；E、D、BN、T | PASS（所列执行证据及 T） |
| R08.S07 Notify people affected by assignment changes | common/Events.java、workspace/EventsWorker.java、workspace/WorkspaceService.java；E、D、BN、T | PASS（所列执行证据及 T） |
| R08.S08 Surface review and consultation requests | common/Events.java、workspace/EventsWorker.java、workspace/WorkspaceService.java；E、D、BN、T | PASS（所列执行证据及 T） |
| R08.S09 Represent urgent work without a synthetic title | common/Events.java、workspace/EventsWorker.java、workspace/WorkspaceService.java；E、D、BN、T | PASS（所列执行证据及 T） |
| **R09 Personal work logs（要求正文）** | workspace/WorkspaceService.java、全屏日志前端、V8/V11 迁移；L、S、BL、BC、D、T | **PASS** |
| R09.S01 Write and edit a log in a full-screen sheet | workspace/WorkspaceService.java、全屏日志前端、V8/V11 迁移；L、S、BL、BC、D、T | PASS（所列执行证据及 T） |
| R09.S02 Enforce one log under concurrent distinct keys | workspace/WorkspaceService.java、全屏日志前端、V8/V11 迁移；L、S、BL、BC、D、T | PASS（所列执行证据及 T） |
| R09.S03 Freeze across the midnight boundary | workspace/WorkspaceService.java、全屏日志前端、V8/V11 迁移；L、S、BL、BC、D、T | PASS（所列执行证据及 T） |
| R09.S04 Link, clear or redact tasks independently | workspace/WorkspaceService.java、全屏日志前端、V8/V11 迁移；L、S、BL、BC、D、T | PASS（所列执行证据及 T） |
| R09.S05 Search and link a visible task | workspace/WorkspaceService.java、全屏日志前端、V8/V11 迁移；L、S、BL、BC、D、T | PASS（所列执行证据及 T） |
| R09.S06 Clear a linked task | workspace/WorkspaceService.java、全屏日志前端、V8/V11 迁移；L、S、BL、BC、D、T | PASS（所列执行证据及 T） |
| R09.S07 Show no matching linked tasks | workspace/WorkspaceService.java、全屏日志前端、V8/V11 迁移；L、S、BL、BC、D、T | PASS（所列执行证据及 T） |
| R09.S08 Write an unlinked log | workspace/WorkspaceService.java、全屏日志前端、V8/V11 迁移；L、S、BL、BC、D、T | PASS（所列执行证据及 T） |
| R09.S09 Superior reads a subordinate log | workspace/WorkspaceService.java、全屏日志前端、V8/V11 迁移；L、S、BL、BC、D、T | PASS（所列执行证据及 T） |
| **R10 Log page single-content filtering and scroll return（要求正文）** | workspace/WorkspaceService.java、日志筛选/回顶前端；O、L、BL、BC、T | **PASS** |
| R10.S01 Enter with self and filter a direct report | workspace/WorkspaceService.java、日志筛选/回顶前端；O、L、BL、BC、T | PASS（所列执行证据及 T） |
| R10.S02 Return to the top without mixing workflows | workspace/WorkspaceService.java、日志筛选/回顶前端；O、L、BL、BC、T | PASS（所列执行证据及 T） |
| R10.S03 Enter the log page | workspace/WorkspaceService.java、日志筛选/回顶前端；O、L、BL、BC、T | PASS（所列执行证据及 T） |
| R10.S04 Select pending reviews | workspace/WorkspaceService.java、日志筛选/回顶前端；O、L、BL、BC、T | PASS（所列执行证据及 T） |
| R10.S05 Switch between role-specific content filters | workspace/WorkspaceService.java、日志筛选/回顶前端；O、L、BL、BC、T | PASS（所列执行证据及 T） |
| R10.S06 Invoke a log-page command | workspace/WorkspaceService.java、日志筛选/回顶前端；O、L、BL、BC、T | PASS（所列执行证据及 T） |
| R10.S07 Toggle own logs | workspace/WorkspaceService.java、日志筛选/回顶前端；O、L、BL、BC、T | PASS（所列执行证据及 T） |
| R10.S08 Restore the visible log scope | workspace/WorkspaceService.java、日志筛选/回顶前端；O、L、BL、BC、T | PASS（所列执行证据及 T） |
| R10.S09 Search logs by author | workspace/WorkspaceService.java、日志筛选/回顶前端；O、L、BL、BC、T | PASS（所列执行证据及 T） |
| R10.S10 Show no matching authors | workspace/WorkspaceService.java、日志筛选/回顶前端；O、L、BL、BC、T | PASS（所列执行证据及 T） |
| R10.S11 Keep log finding separate and scoped | workspace/WorkspaceService.java、日志筛选/回顶前端；O、L、BL、BC、T | PASS（所列执行证据及 T） |
| R10.S12 Return to the top of log content | workspace/WorkspaceService.java、日志筛选/回顶前端；O、L、BL、BC、T | PASS（所列执行证据及 T） |
| **R11 Role-scoped AI map（要求正文）** | workspace/WorkspaceService.java、AI 前端；I、BC、WorkspaceAnalysisTest、T | **PASS** |
| R11.S01 Generate personal and department results separately | workspace/WorkspaceService.java、AI 前端；I、BC、WorkspaceAnalysisTest、T | PASS（所列执行证据及 T） |
| R11.S02 Extract new words and required metrics | workspace/WorkspaceService.java、AI 前端；I、BC、WorkspaceAnalysisTest、T | PASS（所列执行证据及 T） |
| R11.S03 Refresh suggestions and deny stale details | workspace/WorkspaceService.java、AI 前端；I、BC、WorkspaceAnalysisTest、T | PASS（所列执行证据及 T） |
| R11.S04 View employee AI map | workspace/WorkspaceService.java、AI 前端；I、BC、WorkspaceAnalysisTest、T | PASS（所列执行证据及 T） |
| R11.S05 View executive AI map | workspace/WorkspaceService.java、AI 前端；I、BC、WorkspaceAnalysisTest、T | PASS（所列执行证据及 T） |
| **R12 Minimal profile page（要求正文）** | Access/ProfileService/WorkspaceService；A/P/PC/BL/BN/T | **PASS（V-004 已解决）** |
| R12.S01 Read and edit the required profile | auth/Access.java、profile/ProfileService.java、workspace/WorkspaceService.java、资料前端；A、P、BL、BN、T | PASS（所列执行证据及 T） |
| R12.S02 Open a subordinate within both profile scope and the management chain | P/PC/BL/BN；循环链不返回他人号码、恢复有效链后上级可读 | PASS（V-004 verified-resolved） |
| R12.S03 View profile | auth/Access.java、profile/ProfileService.java、workspace/WorkspaceService.java、资料前端；A、P、BL、BN、T | PASS（所列执行证据及 T） |
| **R13 Strict prototype scope（要求正文）** | S/NBH/NBP；真实交接可操作，保存预设重绘时预览可过时 | **FAIL V-010（交接预览缺口）** |
| R13.S01 Validate the real service and declared scope | S/NBH/NBP；保存/提交通过，异步预览重绘失败 | FAIL V-010 |
| R13.S02 Inspect available actions | NBH/NBP；本人/直属领导入口及普通预览通过，重绘后预览过时 | FAIL V-010 |
| R13.S03 Open the split static prototype | 当前打包服务、auth/AuthFilter.java、README、历史追踪；S、BC、全部 HTTP/浏览器检查、T | PASS（所列执行证据及 T） |
| **R14 Organization and administration（要求正文）** | OrganizationService/Constraints/AdminController/RoleCatalog/admin.html；O/M/AU/UI/D/T | **PASS（V-008/V-009 已解决）** |
| R14.S01 Maintain an employee through the administrator interface | O/UI；M两独立V4库补齐、约束收紧、写恢复，各10/10 | PASS |
| R14.S02 Maintain teams independently of departments | O团队独立维护；M员工优先/团队优先均恢复写 | PASS |
| R14.S03 Transfer updates independent scopes | O/R当前授权；AU 11/11收回派发后不再自动发布 | PASS |
| R14.S04 Maintain and reorder company information | admin/OrganizationService.java、OrganizationConstraints.java、RoleCatalog.java、AdminController.java、`admin.html`、V5—V12；O、D、BC、M、T | PASS（所列执行证据及 T） |
| **R15 Account password lifecycle（要求正文）** | Access/AuthService/Credentials/ProfileService；A/P/PC/BA/BN/D/T | **PASS（V-004 已解决）** |
| R15.S01 Initial login cannot enter business pages | auth/Access.java、auth/AuthService.java、admin/Credentials.java、profile/ProfileService.java；A、P、BA、BN、D、T | PASS（所列执行证据及 T） |
| R15.S02 Password validation and reset | auth/Access.java、auth/AuthService.java、admin/Credentials.java、profile/ProfileService.java；A、P、BA、BN、D、T | PASS（所列执行证据及 T） |
| R15.S03 Edit contacts without exposing another employee phone | auth/Access.java、auth/AuthService.java、admin/Credentials.java、profile/ProfileService.java；A、P、BA、BN、D、T | PASS（所列执行证据及 T） |
| R15.S04 Read phones only through authorized person details | auth/Access.java、auth/AuthService.java、admin/Credentials.java、profile/ProfileService.java；A、P、BA、BN、D、T | PASS（所列执行证据及 T） |
| R15.S05 Recheck the management chain after an organization change | P/PC 当前有效全链验证、循环裁剪、自读及恢复对照；AccessTest/T | PASS（V-004 verified-resolved） |
| **R16 Ordered reviewer routing and reassignment（要求正文）** | TaskService/OrganizationService；R/E/D/NBH/NBP及保留AU | **FAIL V-010（交接提交前预览）；V-008仍已解决** |
| R16.S01 Persist order and route the first highest peer | task/TaskService.java、admin/OrganizationService.java；R、E、D、TaskServiceTest、T | PASS（所列执行证据及 T） |
| R16.S02 Review one's own application explicitly | task/TaskService.java、admin/OrganizationService.java；R、E、D、TaskServiceTest、T | PASS（所列执行证据及 T） |
| R16.S03 Change assignees using the proposed route | task/TaskService.java、admin/OrganizationService.java；R、E、D、TaskServiceTest、T | PASS（所列执行证据及 T） |
| R16.S04 Fall back or apply with a documented reason | R合法无审核人direct；AU失权负向不发布且合法对照通过 | PASS |
| R16.S05 Reassign after organization changes | R/E持久化改派；AU失权旧申请不自动发布 | PASS |
| **R17 Dedicated task handover（要求正文）** | NH/NBH/NP通过预设、入口和交接；NBP确认保存期间异步预览过时 | **FAIL V-010（原验收条件中的提交前预览；R16正文/design§4）** |
| R17.S01 A direct manager hands over a subordinate task | NH/NBH/NP/R：非创建者直属领导预设/提交、越权/夹带字段拒绝；预览缺口另见V-010 | PASS（HTTP命令子场景） |
| R17.S02 Handover approval preserves provenance | NH/NP/R/E/D：新路线批准、旧有序有效版、原创建者/时间/来源保留 | PASS（HTTP命令子场景） |
| **R18 Deadline expiration of pending applications（要求正文）** | ExpiryService/TaskService/Writes；E/S/D/LK/PX/T | **PASS（V-002 已解决，三方竞争已补）** |
| R18.S01 Reject expired submission and approval before the scan | E创建/交接4xx后失效；LK等待组织锁跨截止后expired/解冻 | PASS |
| R18.S02 Use the applicable deadline and preserve the effective version | workspace/ExpiryService.java、task/TaskService.java、common/Writes.java；E、S、D、X、T | PASS（所列执行证据及 T） |
| R18.S03 Expire and backfill overdue once | workspace/ExpiryService.java、task/TaskService.java、common/Writes.java；E、S、D、X、T | PASS（所列执行证据及 T） |
| R18.S04 Resolve the deadline race once | PX真实并发批准+撤销+扫描，截止前withdrawn、恰好/之后expired；各SQL一条终态事件，重放稳定 | PASS |
| **R19 Proportional schedule reminders（要求正文）** | workspace/ReminderService.java、EventsWorker.java、TaskService.java、公司截止设置；E、O、D、ReminderNodeTest、T | **PASS** |
| R19.S01 Remind a ten hour task | workspace/ReminderService.java、EventsWorker.java、TaskService.java、公司截止设置；E、O、D、ReminderNodeTest、T | PASS（所列执行证据及 T） |
| R19.S02 Skip stale nodes after a late scan | workspace/ReminderService.java、EventsWorker.java、TaskService.java、公司截止设置；E、O、D、ReminderNodeTest、T | PASS（所列执行证据及 T） |
| R19.S03 Reset the schedule identity and handle zero duration | workspace/ReminderService.java、EventsWorker.java、TaskService.java、公司截止设置；E、O、D、ReminderNodeTest、T | PASS（所列执行证据及 T） |
| **R20 Notification lifecycle and historical access（要求正文）** | WorkspaceService/EventsWorker/Events/通知前端；E/BN/D/EventsRetentionTest/PX/NB/T | **PASS（V-001已解决，边界/空态已补）** |
| R20.S01 Close a notification list without footer actions | BN三视口无footer及关闭；NB空态Tab到header close并Enter退出3/3 | PASS |
| R20.S02 Open an old review notification | workspace/WorkspaceService.java、EventsWorker.java、common/Events.java、通知前端；E、BN、D、EventsRetentionTest、X、T | PASS（所列执行证据及 T） |
| R20.S03 Enforce withdrawal and calendar month boundaries | PX179.999秒200、180秒409；EventsRetentionTest月末/闰年/公司时区；E到期读取拒绝 | PASS |
| R20.S04 Distinguish hide and withdraw | workspace/WorkspaceService.java、EventsWorker.java、common/Events.java、通知前端；E、BN、D、EventsRetentionTest、X、T | PASS（所列执行证据及 T） |
| R20.S05 Retain access solely through a delivered notification | workspace/WorkspaceService.java、EventsWorker.java、common/Events.java、通知前端；E、BN、D、EventsRetentionTest、X、T | PASS（所列执行证据及 T） |
| R20.S06 End the exception and block undelivered access | E 91/91 含送达前失权字段脱敏、列表/详情/open 及 /task 拒绝 | PASS（V-001 verified-resolved） |
| **R21 Complete task operation history（要求正文）** | TaskService/管理历史接口/V6/V9/V12；R/E/D/A/AU/T | **PASS（已执行历史及授权负向不写direct记录）** |
| R21.S01 Inspect an ordered assignee change and reassignment | task/TaskService.java、管理端历史接口、V6/V9/V12；R、E、D、A、T | PASS（所列执行证据及 T） |
| R21.S02 Retain history after message removal | task/TaskService.java、管理端历史接口、V6/V9/V12；R、E、D、A、T | PASS（所列执行证据及 T） |

移除要求 `Manager consultation`：PASS。当前业务页面/日志/通知不再提供请示回复入口（BL、S、T）；没有新增请示样例来满足已移除要求，历史数据不作破坏性删除。

正文/设计额外约束检查：V1—V4 未重写；V4 预检只读、两种映射顺序恢复正式写；旧日志18+4保留原文；旧负责人顺序/通知/派发估计保持有来源兼容，不声称恢复缺失历史。密码一次交付、缓存无秘密由A/D验证；234px表单、全屏日志、通知无footer、旧有效版冻结、资料/日志分权均已执行。预设/真实用户入口及普通预览已验证；剩余为R16正文及V-010原验收条件的保存预设与异步预览竞争：可见审核人过时。未新增验收需求。

## Findings


### V-001: 普通事件在送达前失去权限仍泄露任务标题和实际变更摘要

- Category: implementation
- Severity: high
- Requirement: `Notification lifecycle and historical access`（End the exception and block undelivered access）；`Required notifications`；design §7；task 7.2（DEV-030/033）。
- Evidence: **上轮历史（110ebe0 基线，非本轮结果）**： `backend/src/main/java/cn/pandora/workspace/EventsWorker.java:98`—120 无权限且非移除事件时虽清空任务/标题，仍保存 `event.changeSummary`；`WorkspaceService.java:420`—423 又从 domain event 回填被清空的 title/摘要；taskId 为空的副本在 :458 仍可列出。独立 HTTP 在 `e13_probe` 暂停 worker：middle 创建 employee 负责的任务并批准；随后改标题、把负责人换为 colleague 并批准；employee 普通任务详情已 404；再驱动 worker，employee 通知列表仍返回普通 `task.create.approved`。
- Expected: 普通消息送达前已经失权的候选人不得因此取得保留原受限标题/实际摘要的历史例外；合法负责人移除事件须按其明确的事实授权单独处理。
- Actual: **上轮历史**： 返回 `taskId:null, relationLost:false, readonly:true, title:"E13 confidential undelivered title"`、泛化 summary，同时 `changeSummary:"任务《E13 confidential undelivered title》的创建申请已通过。"`，并携带 `requestStatus:"approved"`。这是普通旧事件，不是允许向被移除人发送的移除通知。禁用了跳转仍没有阻止内容泄露。
- Repair guidance: 对送达前已失权的普通事件执行字段级脱敏或不投递，读取层不得从事件回填受限内容；同时审查原申请元数据的权限。保留合法已送达及移除事件所需摘要。
- Acceptance checks: 在独立库重做上述暂停/改权/投递顺序，检查列表、消息详情、消息 task 入口及已读响应均无受限内容/历史权；对照已送达后撤权、真正移除事件仍保留受限只读例外；其他查询持续排除。
- Repair status: verified-resolved
- Repair notes: 修复：新增 V13__mask_undelivered_notification_content.sql（notifications.content_masked 及旧副本回填）；EventsWorker.deliver 对未撤销、送达前已失权且非移除事件的副本清空 title/change_summary/request_id/task_version_id 并写入泛化摘要；WorkspaceService.safeNotification 对 content_masked 行不再从 domain_event 回填标题/摘要/申请元数据，taskId/requestId 置空、canOpenTask=false，/task 入口不可用。回归：check_deadline_reminder_notification.py 新增“创建通过后改标题并改派→原负责人失权→再投递”用例，断言列表、详情、/task 入口与 open 响应均无受限内容，真实移除事件仍保留只读摘要；E 91/91，mvn test 62/62。
- Reverification notes: **本轮 cb1bfc3**：E 91/91 独立重跑普通事件排队期间失权：列表/详情/open不返回受限title/changeSummary/request元数据，/task拒绝；真实移除事件仍保留例外。V13及safeNotification屏蔽一致。维持 verified-resolved。

### V-002: 提交在组织锁上等待跨过截止后，旧待审仍未失效和解冻

- Category: implementation
- Severity: medium
- Requirement: `Deadline expiration of pending applications`（Reject expired submission and approval before the scan）；`Task editing and completion review`；design §6 明确“竞争检查在获得锁后取当前时刻”，tasks 5.2/5.3。
- Evidence: **前轮历史（4b53a15 基线，非本轮结果）**： `backend/src/main/java/cn/pandora/task/TaskService.java:188` 的 `expireBeforeSubmit` 在获取锁前传入 `clock.instant()`；`workspace/ExpiryService.java:45` 在独立事务中等待 organizations FOR UPDATE 后，仍用旧的 `now`。本轮 `independent-probes.json.submitLockDeadline`：task `6b40b3d7-b86c-4f85-ba3c-a0f40b47c28f`，request `04b78240-c67b-459b-9f72-5f1be0131d1f`。
- Reproduction: 暂停 worker，新建截止 now+60s 的本人创建待审并读取任务 ETag；另一 MySQL 事务持有该组织行锁；并发 PATCH 该任务 change；从 information_schema.processlist 确认其已等待组织锁，再将服务时钟推进 61s 并释放锁。`organizationLockWaitObserved:true`；实际当前时刻 `2026-10-21T09:24:37.288792Z` 已晚于适用截止 `2026-10-21T09:24:36.245725Z`。
- Expected: 锁后用实际当前时刻判断；无论后续命令返回何种 4xx，旧申请应持久化 expired、解冻，未发布任务不能发布，不能等后台扫描才满足提交入口要求。
- Actual: **前轮历史**： PATCH `409 TASK_FROZEN`；随后 GET 旧申请仍 `pending`、任务 `frozen:true`。原修复把失效放在独立事务，确已消除原 412 回滚；但锁等待时使用过时的时间，仍违反同一提交截止验收要求。
- Repair guidance: 保留独立提交终态机制，在获得相关锁之后采样受控服务时钟并完成到期判定；保持 ETag、授权、幂等、锁序及终态唯一性，不以忽略过时 ETag 消除症状。
- Acceptance checks: 重跑 E；新增可重复的组织锁阻塞→跨截止→释放场景，创建及已发布任务/交接共享入口均验证终态落库、解冻、有效版保持、未发布不发布、事件去重；同键重试/扫描不能重复改变业务。批准+撤销+扫描三方竞争仍需独立证据。
- Repair status: verified-resolved
- Repair notes: 修复：ExpiryService 注入统一 Clock，expirePendingBeforeSubmit 在 organizations 行锁获取成功后才采样 clock.instant() 并完成到期判定/失效提交；TaskService.expireBeforeSubmit 不再在锁前传入旧时刻。回归：新增 backend/scripts/check_submit_lock_deadline.py，用独立 MySQL 会话持有组织行锁、并发 PATCH 在锁上排队、推进受控时钟后释放；连续两次 5/5，PATCH 等待后被拒，旧申请 expired、未发布任务不发布且解冻。E 91/91 复验创建/交接 412 后终态持久化。
- Reverification notes: **本轮 cb1bfc3**：LK 5/5 在当前jar全新库实跑：锁等待约3.5秒，受控时钟跨截止后PATCH 412 VERSION_CONFLICT；GET原申请expired，任务published=false、pending=false、frozen=false。ExpiryService在组织锁之后采样Clock，独立事务提交。E 91/91覆盖普通创建/交接到期提交；PX三方竞争截止前/恰好/之后各唯一终态，重放/扫描稳定。原回滚及锁前时间采样两部分均解决，标记 verified-resolved。

### V-003: 失去最后审核人的待审改派存在 SQL 参数错误并回滚组织维护

- Category: implementation
- Severity: high
- Requirement: `Ordered reviewer routing and reassignment`（Fall back or apply with a documented reason；Reassign after organization changes）；`Organization and administration`；task 4.4。
- Evidence: **上轮历史（110ebe0 基线，非本轮结果）**： `backend/src/main/java/cn/pandora/task/TaskService.java:678`—688 的 `applyWithoutReviewer` UPDATE 有 8 个占位符，却传入 9 个参数（重复 `now, now`）。在独立库由 upper 创建自己负责的任务并保持显式待审，原创建者也是最后可用审核人；admin 使用当前员工 ETag PATCH `reviewerAvailable:false`。`final-probes.json`：原申请 `135311a2-3d8f-43af-a7c1-9dc7327ee61a`，组织维护 `500`，随后请求仍 `pending`。`browser.log` / `e13_probe.log` 记录 `Parameter index out of range (9 > number of parameters, which is 8)`，栈在该方法。
- Expected: 合法组织变动成功；按同一算法上溯/创建者兜底，确无审核人时留存原因直接生效，并保留路由/操作历史；不得留下空审核人的待审。
- Actual: **上轮历史**： org 更新事务 500 回滚，申请保持 pending；新建时原本无审核人的正向用例通过，但已有待审转入该分支失败。
- Repair guidance: 修正该分支的 SQL/参数契约，并确保无审核人直接生效仍执行有效截止、授权和历史规则。
- Acceptance checks: 重做待审失去最后审核人的接口流程，组织变更成功，申请 direct/原因可追溯，内容及状态正确生效；覆盖有替代审核人、确无审核人、损坏链阻断、已过截止，旧审核人/旧页面不能越权决定。
- Repair status: verified-resolved
- Repair notes: 修复：applyWithoutReviewer 的 UPDATE 参数由 9 个改为 8 个以匹配占位符，并提取 NO_REVIEWER_APPLY_SQL 与 noReviewerApplyArgs 常量/构造器；TaskServiceTest 新增占位符数等于参数数断言。HTTP：check_review_routing.py 新增 boss 自建待审、admin 关闭最后审核人场景，组织更新 200、申请 direct 且原因可查、任务发布；R 64/64。
- Reverification notes: **本轮 cb1bfc3**：R 64/64 当前真实库再次确认失去最后审核人时组织维护200、申请direct/留因、任务发布，无SQL参数异常；AU合法对照亦通过。维持 verified-resolved。

### V-004: 手机号鉴权在遇到查看者时提前成功，未识别后续管理链循环

- Category: implementation
- Severity: medium
- Requirement: `Account password lifecycle`（Recheck the management chain after an organization change）；`Role-scoped visibility`；`Minimal profile page`；design §3、task 3.5。
- Evidence: **上轮历史（110ebe0 基线，非本轮结果）**： `backend/src/main/java/cn/pandora/auth/Access.java:180`—195，:189 遇到 actor 即 return true，未验证余下链。仅在一次性库通过 SQL 设置损坏数据 `employee -> middle -> upper -> middle`，保留 middle 的当前资料权和较高组织层级；用 middle GET employee 人员详情实际返回 200 并包含测试号码 `13900009999`，记录于 `independent-probes.json`（`phoneReturned:true`）。
- Expected: 对环、跨公司、失效等不能证明有效关系的管理链不授予他人手机号；每次请求使用当前有效链。
- Actual: **上轮历史**： 访问者出现在循环之前时被当作有效上级，循环没有触发拒绝。组织维护 API 拒绝新建环并不能满足规格明确要求的损坏数据防御。
- Repair guidance: 在授予号码前完成相关管理链有效性校验，错误链 fail closed；正常本人、直属和有资料权的间接上级仍按既有规则读取。
- Acceptance checks: 在隔离库构造 actor 位于环内/环前/环外、失效中间人、跨组织引用、转岗后旧关系，确保详情或号码被拒绝/裁剪；重跑 P/A 及下属浏览器矩阵，目录/audit/outbox 无号码。
- Repair status: verified-resolved
- Repair notes: 修复：Access.canReadPhone 遍历整条当前 manager_id 链到根并全程防环，只有完整有效链且查看者确为上级才返回 true；循环、失效、跨公司或缺失中间人一律 fail closed。回归：AccessTest 新增查看者位于环内、环上及环外的用例；新增 backend/scripts/check_phone_cycle.py，在隔离库构造 employee→middle→upper→middle，middle/upper 人员详情均无号码、本人可读，恢复有效链后直接上级恢复读取；5/5，P 26/26。
- Reverification notes: **本轮 cb1bfc3**：P 26/26、PC 5/5、PR 26/26及63项Java通过；循环链下他人号码裁剪，本人可读，恢复正常链后上级可读，详情/列表/日志各自授权。维持 verified-resolved。

### V-005: V4 组织映射阻断未解决时仍接受正式业务写入

- Category: implementation
- Severity: high
- Requirement: design `Migration Plan` §2 明确“缺映射或重复数据生成可审查报告，未解决不启用正式写流程”；`Organization and administration` 部门/职位必填；task 1.2。
- Evidence: **上轮历史（110ebe0 基线，非本轮结果）**： 将 V4 快照恢复到隔离副本并执行 `backend/scripts/migration_precheck.py`，预检前后指纹相同，报告 7 用户缺部门/职位等阻断。当前 jar `seed=false` 启动，Flyway V1—V12 成功；仍有 7 个未映射用户及 2 条 open mapping blocker；worker 暂停。用 employee 提交明日排期的正常本人任务，POST `/api/v1/tasks` 返回 **201，outcome=pending**（`independent-probes.json`）。`admin/OrganizationConstraints.java` 在映射缺失时只记录并 return；通用写入口/任务写未执行正式就绪门禁。
- Expected: 允许管理端补齐映射/查看阻断，但阻断未解除前不能启用依赖正式组织模型的业务写流程。禁止凭旧团队名称编造部门。
- Actual: **上轮历史**： 缺正式组织字段仍可建立新任务/申请。迁移能启动及 blocker 可见不等于业务已被阻止。
- Repair guidance: 将就绪状态纳入正式写入口，保留受权管理修复通路；完成映射、验证和约束收紧后才能解除门禁，旧页面与幂等重放也不能绕过。
- Acceptance checks: 同一 V4 副本未映射时业务写明确拒绝，管理补齐仍可用；清障后 NOT NULL/其他约束就绪且正式写恢复；新空库不回归；预检仍只读、旧日志无损合并、旧顺序/旧通知兼容不造假。
- Repair status: verified-resolved
- Repair notes: 修复：Writes.runOutcome 在幂等缓存之前、对非 /admin/ 作用域调用 OrganizationConstraints.formalWritesReady，未完成映射返回 409 ORGANIZATION_MAPPING_INCOMPLETE；管理端修复通路豁免。OrganizationConstraints 增加 mappingBlockers/formalWritesReady；AdminController 在员工/团队写事务提交后调用 tryTighten，清障后收紧 NOT NULL；同时修复 updateTeam 在 leadUserId 为空时 Map.of 抛 NPE，保证映射修复通路可用。验收：V4 快照恢复到隔离库 e13r_gate 并由 Flyway 升至 V13，seed=false；新增 check_mapping_write_gate.py：未映射时 task/home 写 409、管理端可建部门职位并映射 7 员工/3 团队、清障后约束收紧、同一任务写 201、管理通路仍可用，10/10。
- Reverification notes: **本轮 cb1bfc3**：本轮两独立V4副本各10/10：未映射task/home均409，管理补齐通道可用；之后约束收紧且task201/home200。旧日志18正常+4归档，V1—V4未改。维持 verified-resolved。

### V-006: 管理端无法分别配置任务查看范围和派发范围

- Category: implementation
- Severity: high
- Requirement: `Organization and administration` 正文 SHALL 提供分别配置的任务查看/派发权限；design §2；tasks 2.2/2.6（DEV-002）。
- Evidence: **上轮历史（110ebe0 基线，非本轮结果）**： `admin.html:97`—99 是只读角色表，:335—339 只渲染 scopes 文本；员工维护只选固定角色。`backend/src/main/java/cn/pandora/admin/AdminController.java:84` 只有 GET roles，无 scope 定义写接口；`OrganizationService.java:576`—584 将 roleCodes 限于固定四种。`RoleCatalog.java`：executive 的 task_view/task_dispatch 均 company，manager 均 department，employee 均 self，admin 均无，合并角色各取最大仍保持两者相同。实际 GET `/api/v1/admin/organization` 的固定角色配置已记录在 `final-probes.json`，服务管理页也实际加载检查。
- Expected: 管理员通过受权管理流程能分别配置查看与派发，例如公司可见但仅本人派发；服务端候选、提交、批准、旧请求权限校验服从该配置。
- Actual: **上轮历史**： 存在两种 scope 列及不同 Access 检查函数，但管理端/API 不能产生不同的范围组合；只能直接改 SQL。现有 Access 单测手工构造“部门可见/仅本人派发”Actor，不能证明配置流程已实现。
- Repair guidance: 补齐可操作的受权独立配置与持久化途径，更新权限版本并即时重算候选/写权限；不要求特定新增 endpoint 名称。
- Acceptance checks: 无直接 SQL，在管理界面/API 配置 company-view+self-dispatch 及 department-view+self-dispatch；重新登录/刷新后保留，能看却不能派发，越权请求和权限改变前的旧页面/批准/幂等重放被拒绝；仅有管理员不能取得员工业务权。
- Repair status: verified-resolved
- Repair notes: 修复：新增 PATCH /api/v1/admin/roles/{code}/scopes（OrganizationService.updateRoleScopes），分别持久化 task_view/task_dispatch/log_read/profile_read，校验范围级别、拒绝给 admin 角色员工范围，并递增 authz_version 使旧页面、旧候选、批准与幂等回放失效；admin.html 角色表改为四个范围下拉加保存按钮，健康页展示 formalWritesReady。验收：O 新增 executive company-view+self-dispatch 配置、持久化与版本递增、配置前幂等键重放 409 AUTHORIZATION_CHANGED、候选仅本人、公司任务仍可见、越权派发 403、admin 范围 400、恢复公司派发后候选恢复；O 58/58。
- Reverification notes: **本轮 cb1bfc3**：O 58/58及UI 4/4重新通过：真实管理页独立company/self、department/self配置、保存重载、恢复；旧幂等及越权派发拒绝。AU另确认旧申请自动路径不扩权。维持 verified-resolved。

### V-007: 完整日列表强制全天优先，破坏同置顶组的时间顺序

- Category: implementation
- Severity: low
- Requirement: `Calendar task views`（Pin only one's own ordering；Order visible task lanes）要求本人月格与完整日列表同置顶组按开始时间、同时间任务标识排序；task 9.4。
- Evidence: **上轮历史（110ebe0 基线，非本轮结果）**： `潘多拉-日程视图.js:52`—61 的 `dayListSort` 对所有全天任务使用排序时间 `-1`，而 `monthSortTasks` 使用实际 start。Node 读取并执行当前文件原函数（不是另写排序实现），输入同为 `pinned:false` 的前日 20:00 开始并延续到所选日 10:00 的定时任务 `earlier-timed`，及所选日 00:00 开始的全天任务 `later-all-day`。
- Expected: 同组先 `earlier-timed` 再 `later-all-day`，按实际 start；置顶仍优先，同 start 按 id 稳定排序。
- Actual: **上轮历史**： 原函数返回 `['later-all-day','earlier-timed']`；月格与当日列表采用不同顺序。
- Repair guidance: 日列表与月格使用相同的置顶/真实开始时间/稳定 ID 规则，不改变全天区或时间轴实际位置。
- Acceptance checks: 覆盖跨日定时与稍后全天混排、相同 start、不同 pin、刷新持久化及另一账号排序，完整日列表和月格一致；时间轴仍不随 pin 移位。
- Repair status: verified-resolved
- Repair notes: 修复：潘多拉-日程视图.js 的 dayListSort 与 monthSortTasks 统一为置顶优先→真实 start→id 稳定排序，去掉全天 -1 偏移，时间轴位置不变。新增 check_calendar_sort.js 直接加载实际文件函数，覆盖跨日定时与稍后全天混排、相同 start、置顶及另一账号输入；4/4，且以修复前文件运行 4/4 失败。回归：H 12/12、BH 33/33（含置顶私有性、跨日分段、全天/重叠逐项、三视口 FAB）。
- Reverification notes: **本轮 cb1bfc3**：CS 4/4当前源码排序、H12/12、BH33/33重跑；CT42/42补完所有三视口周/日实际点击。原真实开始时间/置顶/稳定ID排序仍正确。维持 verified-resolved。

### V-008: 无审核人自动生效绕过权限变更后的派发校验

- Category: implementation
- Severity: high
- Requirement: `Role-scoped task creation and assignment` 正文及 Enforce dispatch independently from viewing（权限变更后的批准拒绝越权派发）；`Ordered reviewer routing and reassignment` 的无审核人/组织改派规则；design §2/§4、task 2.5。免审核人并不豁免当前业务授权。
- Evidence: **前轮历史（4b53a15 基线，非本轮结果）**： `backend/src/main/java/cn/pandora/task/TaskService.java:431` 的显式批准会重新加载 applicant 并 validateAssignable；`:651` 的 refreshPendingRoutes 转入 `:694` 的 applyWithoutReviewer 后直接更新 direct 并 applyVersion，没有相同的申请人/派发鉴权。本轮 `independent-probes.json.revokedDispatchAutoApply`，task `a33cbfee-c971-4384-a4e3-f6ea6f80cb1a`、request `f2327ccc-aacf-4447-b377-b949a5ef630d`。
- Reproduction: upper 创建负责人按序为 upper+employee 的任务，保持待审，upper 为最后可用审核人/原创建者；admin 用角色范围 API 将 executive 设置为 company-view+self-dispatch（200），当前候选仅 upper；upper 用新版本请求显式 approve，返回 `403 DISPATCH_NOT_ALLOWED` 且仍待审；admin 再用最新员工 ETag 设置 upper `reviewerAvailable:false`，触发无审核人分支。
- Expected: 旧提议不能在当前申请人已无权派发给 employee 时发布；自动生效路径须服从当前派发/有效参与人/任务资格等适用规则，同时按规范保留合法组织维护与审计结果。
- Actual: **前轮历史**： 组织维护返回 200，旧申请变为 `direct`，原因“依据人管理链与原创建者均不可承接，记录原因后直接生效”；任务 `published:true`，upper 与 employee 均成为有效负责人。同一提议显式批准被拒，自动处理却绕过相同授权。
- Repair guidance: 对无审核人的自动生效重用与显式生效相同的当前申请人、负责人、父任务、专用交接等适用资格校验；不能借管理员的管理能力代替申请人的业务权。保持合法组织维护可完成，越权提议不能生效；具体无效申请处置服从现有规格。
- Acceptance checks: 本轮步骤中显式批准与自动生效均不能越权发布；覆盖范围收回、转岗、失效参与人及专用交接资格，核对原有效版/来源/历史/事件；合法未失权的无审核人路径继续成功，重跑 O/R/E。
- Repair status: verified-resolved
- Repair notes: 修复：提取 validateApplicationEffect，显式批准与 applyWithoutReviewer 共用当前申请人有效、负责人有效、create/change 派发权、handover 专用资格、父任务及申请人参与资格校验；自动路径校验失败时保持申请 pending/frozen、不发布、不写 no_reviewer 历史，组织维护本身仍提交成功。回归：新增 check_auto_apply_authorization.py 复现报告场景（upper 建 upper+employee 待审→收回 executive 派发→显式批准 403→撤销最后审核人），确认自动路径不 direct/不发布，合法本人无审核人路径仍 direct；11/11。TaskServiceTest 新增自动路径复用派发校验单测；O 58/58、R 64/64、E 91/91、mvn test 63/63。
- Reverification notes: **本轮 cb1bfc3**：AU 11/11当前新库实际重做撤回executive派发→显式403→撤销最后审核人，组织维护200，但原申请保持pending/frozen、任务未发布，且无no_reviewer历史；合法本人无审核人对照仍direct/留因/发布。源码validateApplicationEffect由显式批准与自动路径共享，对active owner/applicant、派发、父任务、交接资格、申请人参与均重新检查；R/E/O与63项Java通过。标记 verified-resolved；不将有效提议因无审核人直通与无权提议混为一谈。

### V-009: V4 最后补齐团队映射后，业务写门禁仍持续关闭

- Category: implementation
- Severity: medium
- Requirement: `Organization and administration` 的独立员工/团队维护；design Migration Plan §2 的受控映射/清障后启用正式流程及 task 1.2；V-005 修复承诺的管理修复通路与完成后恢复。
- Evidence: **前轮历史（4b53a15 基线，非本轮结果）**： `backend/src/main/java/cn/pandora/admin/AdminController.java:106/118/129` 仅员工 create/update/transfer 提交后触发 tightenOrganizationConstraints；`:199` 的 updateTeam 提交后未触发。`OrganizationConstraints.java:70`—82 的 formalWritesReady 还要求 mappingBlockers=0；`:99` 的 tryTighten 才收紧约束并清除映射阻断。本轮 `extra-probes.json.mappingTeamsLast`，全新隔离副本 `pandora_precheck_e13v_teamlast`（当前 jar，seed=false，V1—V13）。
- Reproduction: 经管理 API 建立真实部门/职位；先 PATCH 全部 7 员工补齐部门/职位，teamId=null（合法独立关系），全部 200；再 PATCH 全部 3 团队补齐部门，全部 200；读取结构健康并由 employee 提交明日正常本人任务。所有映射变更均走受权 API，没有 SQL 修复映射；SQL 只复核缺失计数。
- Expected: 合法补齐顺序不影响恢复结果；全部真实映射完成后自动复核、清除已解决 blocker、收紧约束并恢复正式写入，不依赖再次保存无关员工或重启。
- Actual: **前轮历史**： usersMissingDepartment=0、usersMissingPosition=0、teamsMissingDepartment=0（独立 SQL 同样为 0/0），但 mappingBlockers=2、tighteningApplied=false、formalWritesReady=false；POST task `409 ORGANIZATION_MAPPING_INCOMPLETE`。原 M 脚本先团队后员工，10/10，遗漏最后保存团队的顺序。
- Repair guidance: 所有可能完成映射的受权管理路径（含团队更新）在适当的提交后阶段触发同源、幂等的复核/收紧及 blocker 清理；保留真实缺映射时的门禁与管理修复通路，避免把 DDL 混入原业务事务。
- Acceptance checks: 两个独立 V4 副本分别员工优先/团队优先，最后一步后无需额外编辑或重启即 mappingBlockers=0、约束收紧、业务写恢复；覆盖无团队员工/空团队和新空库；未补齐时 task/home 仍 409，原预检保持只读。
- Repair status: verified-resolved
- Repair notes: 修复：PATCH /admin/teams/{id} 提交后也调用 tightenOrganizationConstraints，与员工 create/update/transfer 同源、幂等、事务外收紧；最后补齐团队即可清 blocker、收紧 NOT NULL 并恢复正式写，无需再次编辑员工或重启。回归：check_mapping_write_gate.py 增加 --order employees-first|teams-first；两个独立 V4 副本分别员工优先/团队优先均 10/10，mappingBlockers=0、tighteningApplied=true、task 201，未补齐时 task/home 仍 409 且管理通路可用。
- Reverification notes: **本轮 cb1bfc3**：M两独立V4副本员工优先/团队优先各10/10：所有映射API200；最后一步即mappingBlockers=0、tighteningApplied=true、formalWritesReady=true，task201/home200，无额外编辑/重启。当前AdminController.updateTeam在写事务提交后同源收紧。标记 verified-resolved。

### V-010: 专用交接保存预设期间，异步审核预览留在旧审核人

- Category: implementation
- Severity: medium
- Requirement: delta `Dedicated task handover`；`Ordered reviewer routing and reassignment` 正文“提交前及详情 SHALL 展示实际审核人”；`Strict prototype scope`；design §4/§5；tasks 4.3/4.6；DEV-004/010、AUD-ORG-009/REV-008、A-06/08。沿用原V-010，原预设/入口及普通预览已补齐，剩余为同一预览验收条件。
- Evidence: `潘多拉-任务接入.js:483` 在请求前捕获预览DOM元素；`:490`—499的成功/失败回调只更新该捕获元素。`:566`保存预设后 `replaceTopSheet(handoverFormView())` 重建DOM，同时`:518`读取尚未更新的 `ctx.previews[source]`。请求完成后缓存虽正确，回调更新的是已脱离页面的旧元素，可见表单仍显示旧审核人。当前仓库浏览器22项等待预览完成后才保存，不覆盖这一顺序。
- Reproduction: 本轮隔离服务18561、真实构建页面390×844；upper创建employee负责的任务，middle批准；employee保存colleague预设并从搜索打开专用交接，初始审核人李敏。目标切为middle（李敏）后，临时浏览器探针仅延迟返回真实 `/tasks/reviewer-preview` 响应给应用，不伪造响应或修改产品；在预览待完成时点击“保存为预设”，等待保存及表单重绘，再释放真实响应。JSON、截图和临时可重放脚本见本轮目录的 `preview-extra.json`、`preview-after-save.png`、`preview-extra.js`。
- Expected: 保存/重绘后可见预览应对应当前选中的完整有序负责人；待请求完成后显示王海，与同源预览API和实际提交的审核人一致；不能把旧目标的审核人当作当前结果展示。
- Actual: 目标为李敏，预设已真实持久化；请求完成后可见文字仍为“审核人：李敏（提交后由该审核人处理）”。旧元素 `isConnected:false`，其文字已更新为“审核人：王海…”。直接真实预览API和随后实际UI提交的pending申请均为王海。task `ab7e4611-ef46-4249-8596-694c68769c30`，request `b426915b-dcaa-4a2c-87eb-d9ff7c788db0`，actual reviewer `6d533bec-53e5-4632-a4a7-9aeb90f1a6b5`。因此是可见预览错误，不是后端路由错误。
- Repair guidance: 使预览状态与目标及当前表单DOM保持一致，保存预设重绘不能恢复旧预览；异步成功/错误及加载状态均应作用于当前有效表单。保留已有序列/上下文隔离和事务内重新计算，不扩大预设/权限修复范围。
- Acceptance checks: 普通本人/非创建者直属领导初始及目标切换预览仍正确；延迟真实预览响应→保存预设→重绘→释放响应后，可见审核人与实际预览/提交/通知路线一致。覆盖快速切换乱序响应、成功/失败、关闭重开及三视口；保留已验证的保存/重读/清除、授权、有序有效版和来源约束。
- Repair status: addressed-awaiting-verification
- Repair notes: 修复：新增 V14__handover_presets.sql（user_id→target_user_id、set_by_user_id、row_version）；TaskService 增加 handoverTargets / handoverPreset / saveHandoverPreset / clearHandoverPreset，本人或直属领导可保存、重读和清除，目标按被交接人的部门/直属上级/直属下属/公司范围校验并排除本人、管理员、失效与越界账号；handover 命令在未提供 target 时使用持久化预设，并在提交及批准时重新校验目标有效性与范围。TaskController 增加 /handover-targets 与 /users/{id}/handover-preset（GET/PUT/DELETE），任务详情返回 canHandover/handoverSources/handoverPresets，人员详情返回 canSetHandoverPreset。前端在“我的”、人员资料和任务详情接入“交接预设”和“专用交接”表单，支持预设预选、保存、清除、原因与提交；交接表单打开及目标变更时调用现有 reviewer-preview 显示实际新路线审核人（确无审核人时显示原因），预览缓存按目标绑定，异步成功/失败均重新读取当前表单元素，保存预设重绘期间不会把旧目标审核人当作当前结果。提交事务仍重算路线。回归：新增 check_handover_preset.py 29/29（本人/非原创建者直属领导保存与使用预设、非直属/无直接关系/本人/管理员/越界/失效目标拒绝、夹带基础字段 400、提交冻结保留有效有序负责人、新路线批准、拒绝/撤销恢复旧有序负责人与来源历史）；新增 check_handover_browser.js 在 320×740、390×844、1440×900 各 23/23（“我的”保存预设、任务搜索入口、预设预选、提交前审核人在同级同事与直属领导间由 middle 切换为 upper 且与实际 pending 审核人一致、保存预设期间延迟真实预览并重绘后可见审核人仍为当前目标、领导保存与提交）；AccessTest 新增 2 项；O 58/58、R 64/64、E 91/91、smoke 53/53、D 18/18；V4 副本升级至 V14 后 gate 10/10；mvn test 65/65。
- Reverification notes: **87f272b本轮**：NBH三视口各22/22，已确认初始预览、目标colleague→middle→colleague时审核人middle→upper→middle、本人/领导及实际pending一致。NBP独立补充6/7：乱序响应隔离、保存及实际提交通过，唯一失败为保存重绘后可见预览过时。V-010普通预览缺失已修复，但原预览正确性验收仍未完整满足，维持pending/medium。前轮a5c29ee的NH29/29、NP8/8、NBX23项成功继续支持预设与实际用户入口；旧NBX“完全不显示预览”的失败已被本轮证据取代。V-001—V-009不受两文件差异影响。

## Historical Traceability Cross-check


以下为增量复验结论索引；证据归属按Checks说明（87f272b重跑、a5c29ee或cb1bfc3保留），保持原 `traceability.md` 及原始审计不变。以本次 delta 为验收准绳；旧审计“他人手机号一律不可见”“仅直属下属”等表述已被 2026-10-19 规则替代，不据旧规则制造新缺陷。`PASS` 仅指对应本轮范围与证据；有子条件缺证的行保留 UNVERIFIED，延期不折算完成率。

### DEV 35 项

| DEV | 本轮证据 | 独立结论 |
| --- | --- | --- |
| DEV-001 | O/A/BC/M；R14；AU/LK/M/PX当前复验 | PASS（原V-002/V-008/V-009均verified-resolved，按相关项） |
| DEV-002 | O/UI/P/AccessTest/X；R05/R14；AU/LK/M/PX当前复验 | PASS（原V-002/V-008/V-009均verified-resolved，按相关项） |
| DEV-003 | A/BA/D；R15 | PASS |
| DEV-004 | NH/NBH/NP通过预设/交接；NBP异步预览重绘失败；R16/R17 | FAIL V-010（预设/入口/普通预览已修复，剩余重绘竞争） |
| DEV-005 | O/L/BL/AccessTest；R09/R10 | PASS |
| DEV-006 | R/TaskServiceTest；R16 | PASS 顺序/最高层 |
| DEV-007 | R/S；R16 | PASS 显式自审 |
| DEV-008 | R；R16 | PASS 新路线 |
| DEV-009 | R/X；R16；AU/LK/M/PX当前复验 | PASS（原V-002/V-008/V-009均verified-resolved，按相关项） |
| DEV-010 | R/E及保留改派证据；NBH普通预览通过；NBP重绘过时 | FAIL V-010（后端路由/改派通过，重绘后预览过时） |
| DEV-011 | R/S/BC；R07 | PASS |
| DEV-012 | E/S/X；R18；AU/LK/M/PX当前复验 | PASS（原V-002/V-008/V-009均verified-resolved，按相关项） |
| DEV-013 | R/E；R07 | PASS |
| DEV-014 | E/ReminderNodeTest；R19 | PASS |
| DEV-015 | O/E；R19 | PASS |
| DEV-016 | R/E/D；R21 | PASS 已执行历史 |
| DEV-017 | H/BH；R02 | PASS |
| DEV-018 | O/H/BH；R02 | PASS |
| DEV-019 | H/BH/T；R03 | PASS 已执行入口 |
| DEV-020 | H/BH/X；R03 | PASS（V-007 已解决；CS/H/BH） |
| DEV-021 | BH/T；R03 | PASS 已执行跨日 |
| DEV-022 | BH/T；R03；CT42/42 | PASS（三视口逐项真实指针已补） |
| DEV-023 | BH/T；R03 | PASS 浏览器手势 |
| DEV-024 | H/BH/I；R03/R11 | PASS |
| DEV-025 | L/D/BL/BC；R09 | PASS |
| DEV-026 | L/WorkspaceLogAndReportsTest；R09 | PASS |
| DEV-027 | L/BL/BC；R10 | PASS |
| DEV-028 | A/P/BL/BN/X；R12 | PASS（V-004 已解决；P/PC） |
| DEV-029 | 范围授权延期 | DEFERRED 系统推送/真机未验证 |
| DEV-030 | E/BN/X；R08 | PASS（V-001 已解决；E） |
| DEV-031 | E/BN；R20 | PASS 已读/原申请 |
| DEV-032 | E/BN/EventsRetentionTest；R20；PX8/8、NB3/3 | PASS（精确撤回/空列表路径已补） |
| DEV-033 | E/BN/X；R20 | PASS（V-001 已解决；E） |
| DEV-034 | I/BC/WorkspaceAnalysisTest；R11 | PASS |
| DEV-035 | NH/NBH/NP通过预设/交接；NBP异步预览重绘失败；R16/R17 | FAIL V-010（预设/入口/普通预览已修复，剩余重绘竞争） |

### AUD 150 项

每个历史编号保留独立行；本轮与保留证据归属见Checks，不引用apply JSON替代独立证据。V-001—V-009仍已解决；V-010的预设/入口已补齐，普通预览已修复，剩余为保存期间重绘后的过时审核人。

| AUD | 本轮证据/当前规则 | 独立结论 |
| --- | --- | --- |
| AUD-SCP-001 | S/BC/T；R01/R13 | PASS 当前范围声明 |
| AUD-SCP-002 | O/BC/X；R14 | PASS（V-006 已解决；O/UI） |
| AUD-SCP-003 | S/BC/T；R01/R13 | PASS 当前范围声明 |
| AUD-ORG-001 | O/M/D；R14；AU/LK/M/PX当前复验 | PASS（原V-002/V-008/V-009均verified-resolved，按相关项） |
| AUD-ORG-002 | O/R/P/D/BC/T；R14/R16/R17 | PASS |
| AUD-ORG-003 | O/R/P/D/BC/T；R14/R16/R17 | PASS |
| AUD-ORG-004 | O/BC/X；R14 | PASS（V-006 已解决；O/UI） |
| AUD-ORG-005 | O/AccessTest/X；R14 | PASS（V-006 已解决；O/UI） |
| AUD-ORG-006 | O/R/P/D/BC/T；R14/R16/R17 | PASS |
| AUD-ORG-007 | O/R/P/D/BC/T；R14/R16/R17 | PASS |
| AUD-ORG-008 | O/R/P/D/BC/T；R14/R16/R17 | PASS |
| AUD-ORG-009 | NH/NBH/NP通过预设/交接；NBP异步预览重绘失败；R16/R17 | FAIL V-010（预设/入口/普通预览已修复，剩余重绘竞争） |
| AUD-ORG-010 | R/X；R16/R17；AU/LK/M/PX当前复验 | PASS（原V-002/V-008/V-009均verified-resolved，按相关项） |
| AUD-ACC-001 | A/BA/O/D/T；R15 | PASS |
| AUD-ACC-002 | A/BA/O/D/T；R15 | PASS |
| AUD-ACC-003 | A/BA/O/D/T；R15 | PASS |
| AUD-ACC-004 | A/BA/O/D/T；R15 | PASS |
| AUD-ACC-005 | A/BA/O/D/T；R15 | PASS |
| AUD-PER-001 | O/P/R/L/I/S/T；R04/R05/R12 | PASS |
| AUD-PER-002 | O/P/R/L/I/S/T；R04/R05/R12 | PASS |
| AUD-PER-003 | O/P/R/L/I/S/T；R04/R05/R12 | PASS |
| AUD-PER-004 | O/P/R/L/I/S/T；R04/R05/R12 | PASS |
| AUD-PER-005 | O/P/R/L/I/S/T；R04/R05/R12 | PASS |
| AUD-PER-006 | O/P/R/L/I/S/T；R04/R05/R12 | PASS |
| AUD-PER-007 | O/P/R/L/I/S/T；R04/R05/R12 | PASS |
| AUD-PER-008 | O/P/R/L/I/S/T；R04/R05/R12 | PASS |
| AUD-PER-009 | A/P/X；R15 以新管理链手机号规则替代旧仅本人规则 | PASS（V-004 已解决；P/PC） |
| AUD-PER-010 | S/P/R/I/E/X；R04/R20 | PASS（V-001/V-004 已解决；E/PC） |
| AUD-PER-011 | P/BL/T；R12 以新资料权∩管理链规则替代旧仅直属规则 | PASS（正常与损坏链 P/PC；V-004 已解决） |
| AUD-ADM-001 | O/R/E/D/BH/T；R02/R21 | PASS |
| AUD-ADM-002 | O/R/E/D/BH/T；R02/R21 | PASS |
| AUD-ADM-003 | O/R/E/D/BH/T；R02/R21 | PASS |
| AUD-ADM-004 | O/R/E/D/BH/T；R02/R21 | PASS |
| AUD-TSK-001 | R/S/E/BC/TaskServiceTest/T；R05/R06/R07 | PASS |
| AUD-TSK-002 | R/S/E/BC/TaskServiceTest/T；R05/R06/R07 | PASS |
| AUD-TSK-003 | R/S/E/BC/TaskServiceTest/T；R05/R06/R07 | PASS |
| AUD-TSK-004 | R/S/E/BC/TaskServiceTest/T；R05/R06/R07 | PASS |
| AUD-TSK-005 | R/S/E/BC/TaskServiceTest/T；R05/R06/R07 | PASS |
| AUD-TSK-006 | R/S/E/BC/TaskServiceTest/T；R05/R06/R07 | PASS |
| AUD-TSK-007 | R/S/E/BC/TaskServiceTest/T；R05/R06/R07 | PASS |
| AUD-TSK-008 | R/S/E/BC/TaskServiceTest/T；R05/R06/R07 | PASS |
| AUD-TSK-009 | R/S/E/BC/TaskServiceTest/T；R05/R06/R07 | PASS |
| AUD-TSK-010 | R/S/E/BC/TaskServiceTest/T；R05/R06/R07 | PASS |
| AUD-REV-001 | R/E/TaskServiceTest/T；R16 | PASS |
| AUD-REV-002 | R/TaskServiceTest/X；R16；AU/LK/M/PX当前复验 | PASS（原V-002/V-008/V-009均verified-resolved，按相关项） |
| AUD-REV-003 | R/X；R16；AU/LK/M/PX当前复验 | PASS（原V-002/V-008/V-009均verified-resolved，按相关项） |
| AUD-REV-004 | R/E/TaskServiceTest/T；R16 | PASS |
| AUD-REV-005 | R/E/TaskServiceTest/T；R16 | PASS |
| AUD-REV-006 | R/E/TaskServiceTest/T；R16 | PASS |
| AUD-REV-007 | R/E/TaskServiceTest/T；R16 | PASS |
| AUD-REV-008 | R/E及保留改派证据；NBH普通预览通过；NBP重绘过时 | FAIL V-010（后端路由/改派通过，重绘后预览过时） |
| AUD-FLW-001 | R/S/E/BC/D/T；R05/R07/R18 | PASS |
| AUD-FLW-002 | R/S/E/BC/D/T；R05/R07/R18 | PASS |
| AUD-FLW-003 | R/S/E/BC/D/T；R05/R07/R18 | PASS |
| AUD-FLW-004 | R/S/E/BC/D/T；R05/R07/R18 | PASS |
| AUD-FLW-005 | R/S/E/BC/D/T；R05/R07/R18 | PASS |
| AUD-FLW-006 | R/S/E/BC/D/T；R05/R07/R18 | PASS |
| AUD-FLW-007 | R/S/E/BC/D/T；R05/R07/R18 | PASS |
| AUD-FLW-008 | R/S/E/BC/D/T；R05/R07/R18 | PASS |
| AUD-FLW-009 | R/S/E/BC/D/T；R05/R07/R18 | PASS |
| AUD-FLW-010 | R/S/E/BC/D/T；R05/R07/R18 | PASS |
| AUD-FLW-011 | R/S/E/BC/D/T；R05/R07/R18 | PASS |
| AUD-FLW-012 | R/S/E/BC/D/T；R05/R07/R18 | PASS |
| AUD-FLW-013 | R/S/E/BC/D/T；R05/R07/R18 | PASS |
| AUD-FLW-014 | R/S/E/BC/D/T；R05/R07/R18 | PASS |
| AUD-FLW-015 | E/X；R18；AU/LK/M/PX当前复验 | PASS（原V-002/V-008/V-009均verified-resolved，按相关项） |
| AUD-FLW-016 | R/S/E/BC/D/T；R05/R07/R18 | PASS |
| AUD-FLW-017 | R/S/E/D/T；R18；PX8/8 | PASS（三方并发已补） |
| AUD-HIS-001 | R/E/D/A/T；R21 | PASS 已执行历史 |
| AUD-HIS-002 | R/E/D/A/T；R21 | PASS 已执行历史 |
| AUD-HIS-003 | R/E/D/A/T；R21 | PASS 已执行历史 |
| AUD-HOM-001 | H/O/BH/T；R02 | PASS |
| AUD-HOM-002 | H/O/BH/T；R02 | PASS |
| AUD-HOM-003 | H/O/BH/T；R02 | PASS |
| AUD-HOM-004 | H/O/BH/T；R02 | PASS |
| AUD-HOM-005 | H/O/BH/T；R02 | PASS |
| AUD-HOM-006 | H/O/BH/T；R02 | PASS |
| AUD-CAL-001 | H/BH/T；R03 | PASS 已执行浏览器检查 |
| AUD-CAL-002 | H/BH/T；R03 | PASS 已执行浏览器检查 |
| AUD-CAL-003 | H/BH/T；R03 | PASS 已执行浏览器检查 |
| AUD-CAL-004 | H/BH/T；R03 | PASS 已执行浏览器检查 |
| AUD-CAL-005 | H/BH/T；R03 | PASS 已执行浏览器检查 |
| AUD-CAL-006 | H/BH/T；R03 | PASS 已执行浏览器检查 |
| AUD-CAL-007 | H/BH/T；R03 | PASS 已执行浏览器检查 |
| AUD-CAL-008 | H/BH/X；R03 | PASS（V-007 已解决；CS/H/BH） |
| AUD-TMV-001 | BH/H/I/T；R03 | PASS 已执行浏览器检查 |
| AUD-TMV-002 | BH/H/I/T；R03 | PASS 已执行浏览器检查 |
| AUD-TMV-003 | BH/H/I/T；R03 | PASS 已执行浏览器检查 |
| AUD-TMV-004 | BH/H/I/T；R03 | PASS 已执行浏览器检查 |
| AUD-TMV-005 | BH/H/I/T；R03 | PASS 已执行浏览器检查 |
| AUD-TMV-006 | BH/H/I/T；R03 | PASS 已执行浏览器检查 |
| AUD-TMV-007 | BH/T；R03；CT42/42 | PASS（三视口逐项真实指针已补） |
| AUD-TMV-008 | BH/T；R03；CT42/42 | PASS（三视口逐项真实指针已补） |
| AUD-TMV-009 | BH/H/I/T；R03 | PASS 已执行浏览器检查 |
| AUD-TMV-010 | BH/H/I/T；R03 | PASS 已执行浏览器检查 |
| AUD-TMV-011 | BH/H/I/T；R03 | PASS 已执行浏览器检查 |
| AUD-LOG-001 | L/O/S/BL/BC/WorkspaceLogAndReportsTest/T；R09/R10 | PASS |
| AUD-LOG-002 | L/O/S/BL/BC/WorkspaceLogAndReportsTest/T；R09/R10 | PASS |
| AUD-LOG-003 | L/O/S/BL/BC/WorkspaceLogAndReportsTest/T；R09/R10 | PASS |
| AUD-LOG-004 | L/O/S/BL/BC/WorkspaceLogAndReportsTest/T；R09/R10 | PASS |
| AUD-LOG-005 | L/O/S/BL/BC/WorkspaceLogAndReportsTest/T；R09/R10 | PASS |
| AUD-LOG-006 | L/O/S/BL/BC/WorkspaceLogAndReportsTest/T；R09/R10 | PASS |
| AUD-LOG-007 | L/O/S/BL/BC/WorkspaceLogAndReportsTest/T；R09/R10 | PASS |
| AUD-AIM-001 | I/BC/WorkspaceAnalysisTest/T；R11 | PASS |
| AUD-AIM-002 | I/BC/WorkspaceAnalysisTest/T；R11 | PASS |
| AUD-AIM-003 | I/BC/WorkspaceAnalysisTest/T；R11 | PASS |
| AUD-AIM-004 | I/BC/WorkspaceAnalysisTest/T；R11 | PASS |
| AUD-AIM-005 | I/BC/WorkspaceAnalysisTest/T；R11 | PASS |
| AUD-AIM-006 | I/BC/WorkspaceAnalysisTest/T；R11 | PASS |
| AUD-ME-001 | A/P/BL/BN/T；R12/R15 | PASS |
| AUD-ME-002 | P/BL/BN/X；R12 以新规则替代旧“无他人手机号” | PASS（V-004 已解决；PC） |
| AUD-ME-003 | A/P/BL/BN/T；R12/R15 | PASS |
| AUD-NTF-001 | E/BN；R08 | DEFERRED 系统推送；仅站内部分有证据 |
| AUD-NTF-002 | E/BN/D/T；R08 | PASS 已执行站内矩阵 |
| AUD-NTF-003 | E/BN/D/T；R08；NH/NBH真实交接已测；预览另见V-010 | PASS 已执行站内矩阵 |
| AUD-NTF-004 | E/BN/D/T；R08 | PASS 已执行站内矩阵 |
| AUD-NTF-005 | E/BN/D/T；R08 | PASS 已执行站内矩阵 |
| AUD-NTF-006 | E/BN/D/T；R08 | PASS 已执行站内矩阵 |
| AUD-NTF-007 | E/BN/D/T；R08 | PASS 已执行站内矩阵 |
| AUD-NTF-008 | E/BN/D/T；R08 | PASS 已执行站内矩阵 |
| AUD-NTF-009 | E/D；R08 | DEFERRED 系统推送；站内去重通过 |
| AUD-TIM-001 | E/O/D/ReminderNodeTest/T；R18/R19 | PASS |
| AUD-TIM-002 | E/O/D/ReminderNodeTest/T；R18/R19 | PASS |
| AUD-TIM-003 | E/O/D/ReminderNodeTest/T；R18/R19 | PASS |
| AUD-TIM-004 | E/X；R18；AU/LK/M/PX当前复验 | PASS（原V-002/V-008/V-009均verified-resolved，按相关项） |
| AUD-TIM-005 | E/O/D/ReminderNodeTest/T；R18/R19 | PASS |
| AUD-TIM-006 | E/X；R18；AU/LK/M/PX当前复验 | PASS（原V-002/V-008/V-009均verified-resolved，按相关项） |
| AUD-TIM-007 | E/O/D/ReminderNodeTest/T；R18/R19 | PASS |
| AUD-TIM-008 | E/O/D/ReminderNodeTest/T；R18/R19 | PASS |
| AUD-TIM-009 | E/O/D/ReminderNodeTest/T；R18/R19 | PASS |
| AUD-TIM-010 | E/O/D/ReminderNodeTest/T；R18/R19 | PASS |
| AUD-TIM-011 | E/O/D/ReminderNodeTest/T；R18/R19 | PASS |
| AUD-TIM-012 | S/E/D/T；R18；PX8/8 | PASS（三方并发已补） |
| AUD-MSG-001 | E/BN/EventsRetentionTest/T；R20 | PASS |
| AUD-MSG-002 | E/BN/EventsRetentionTest/T；R20 | PASS |
| AUD-MSG-003 | E/BN/EventsRetentionTest/T；R20 | PASS |
| AUD-MSG-004 | E/BN/EventsRetentionTest/T；R20 | PASS |
| AUD-MSG-005 | E/T；R20；PX8/8、NB3/3 | PASS（精确撤回/空列表路径已补） |
| AUD-MSG-006 | E/BN/EventsRetentionTest/T；R20 | PASS |
| AUD-NTH-001 | E/BN/D/T；R20 | PASS 已送达只读例外 |
| AUD-NTH-002 | E/BN/D/T；R20 | PASS 已送达只读例外 |
| AUD-NTH-003 | E/BN/D/T；R20 | PASS 已送达只读例外 |
| AUD-NTH-004 | E/BN/D/T；R20 | PASS 已送达只读例外 |
| AUD-NTH-005 | X；R20 | PASS（V-001 已解决；E） |
| AUD-NTH-006 | E/BN/D/T；R20 | PASS 已送达只读例外 |
| AUD-UX-001 | BH/BL/BC/BN；R03/R09/R10 | DEFERRED 真机；浏览器部分有证据 |
| AUD-UX-002 | BH/BL/BC/BN；R03/R09/R10 | DEFERRED 真机；浏览器部分有证据 |
| AUD-UX-003 | BH/BL/BC/BN；R03/R09/R10 | DEFERRED 真机；浏览器部分有证据 |
| AUD-UX-004 | 只有桌面 Chrome 视口模拟 | DEFERRED 真机未验证 |
| AUD-UX-005 | BH/BL/BC/BN；R03/R09/R10 | DEFERRED 真机；浏览器部分有证据 |

### A 25 项

| A | 本轮证据 | 独立结论 |
| --- | --- | --- |
| A-01 | A/BA/O/D | PASS |
| A-02 | O/M/BC/X；AU/LK/M/PX当前复验 | PASS（原V-002/V-008/V-009均verified-resolved，按相关项） |
| A-03 | O/R/AccessTest；AU/LK/M/PX当前复验 | PASS（原V-002/V-008/V-009均verified-resolved，按相关项） |
| A-04 | P/L/BL/X | PASS（V-004 已解决；P/PC） |
| A-05 | O/H/BH | PASS |
| A-06 | R/E及保留改派证据；NBH普通预览通过；NBP重绘过时 | FAIL V-010（后端路由/改派通过，重绘后预览过时） |
| A-07 | R/S | PASS |
| A-08 | NH/NBH/NP通过预设/交接；NBP异步预览重绘失败；R16/R17 | FAIL V-010（预设/入口/普通预览已修复，剩余重绘竞争） |
| A-09 | S/E/H/I/BC/T | PASS 已执行隔离矩阵 |
| A-10 | R/S/BC | PASS |
| A-11 | R/E/D/T | PASS 已执行历史 |
| A-12 | H/O/BH/T | PASS |
| A-13 | H/BH/T | PASS 已执行导航/计数 |
| A-14 | H/BH/X | PASS（V-007 已解决；CS/H/BH） |
| A-15 | BH/T；CT42/42 | PASS（三视口逐项真实指针已补） |
| A-16 | BH/T；CT42/42 | PASS（三视口逐项真实指针已补） |
| A-17 | L/O/BL/BC/D | PASS |
| A-18 | A/P/BL/BN/X | PASS（V-004 已解决；P/PC） |
| A-19 | E/BN/D | DEFERRED 系统推送；站内与PX三方竞争通过 |
| A-20 | E/O/D/ReminderNodeTest | PASS |
| A-21 | E/S/X；AU/LK/M/PX当前复验 | PASS（原V-002/V-008/V-009均verified-resolved，按相关项） |
| A-22 | E/BN/EventsRetentionTest/T；PX8/8、NB3/3 | PASS（精确撤回/空列表路径已补） |
| A-23 | E/BN/X | PASS（V-001 已解决；E） |
| A-24 | I/BC/WorkspaceAnalysisTest | PASS |
| A-25 | 三视口浏览器证据仅作模拟 | DEFERRED 真机未验证 |


## Next Action

执行 `$openspec-e13-fix-change fix-pandora-formal-requirement-deviations`，仅修复V-010保存预设与异步预览重绘竞争，补延迟真实响应的浏览器验证；保留普通预览的序列/上下文隔离和事务重算。预设/入口与正常预览已确认，不再报告为缺失。保持V-001—V-009及全部Repair notes；修复后可按完整指纹继续增量独立verify。当前FAIL，不能归档。
