# 本地课程验收索引

2026-11-17 apply 证据索引，revision `738dd52` 加当前dirty工作树；不代表独立e13 PASS。当前范围是本地真实服务+组件/逻辑+单台API36 ARM64模拟器。完整业务仍保留，设备/部署/运维移出项见末尾。原90/54/12/32映射保持完整，coverage每行通过任务和旅程链接到本文；测试不等价于每条旅程都在设备重走。

## 证据位置与复现

从仓库根执行，已有本地MySQL13306、打好的后端JAR和本机Chrome；不联网下载、不重新打服务包、不清演示库。常用演示后端用 `backend/scripts/start-demo.sh --keep` 保留启动。

| 代号 | 当前命令 / 证据 |
| --- | --- |
| F | `cd flutter && flutter test --no-pub --reporter expanded`；196通过，含29真实API无skip。`output/flutter-client-2026-11-17/checks/flutter-tests.log`。下文“组件”文件在flutter/test/features/，“core”在flutter/test/core/；与真实服务证据明确分列 |
| R | F中的 `flutter/test/integration/real_backend_test.dart`，宿主真实演示API 8080。每项中文测试名含J编号；负责认证/DTO/请求/版本/分页/业务读写，不能冒充模拟器UI |
| M | `python3 flutter/tool/check_managed_backend.py`，独立随机MySQL/JAR18295；`managed/flutter-tests.log`；Flutter真实适配器+管理API。测试代码`flutter/tool/tests/managed_backend_test.dart`，含四层审核、父子、组织失权/重置、停用接管重开、头像 |
| C | `check_employee_contracts_upgrade.py --skip-witness`，本次输出重定向`contracts/`，**329通过/0失败**；daily/table/fill/hire当前契约及真实Chrome管理员入职；不运行升级/备份见证 |
| T | `python3 backend/scripts/check_review_routing.py`，**204/0**；`output/task-creation-refinement/review-routing.json` |
| B | Python导入`check_business_takeover`，OUTPUT重定向`output/flutter-client-2026-11-17/takeover.json`后`main()`；**87/0** |
| X | Python导入`check_demo_extremes`，AUDIT重定向`output/flutter-client-2026-11-17/extremes`后`main()`；**130/0** |
| N | Python导入`check_fixed_notifications`，OUTPUT重定向`output/flutter-client-2026-11-17/notifications.json`后`main()`；**49/0** |
| H | 当前daily/home API **72断言**；`current-daily-home-api.json`与`/tmp/pandora-current-daily-api-20261117.log`，覆盖正文/完整排序/真实区间与私密性 |
| W | `node flutter/tool/check_web_parity.cjs`，真实同founder同demo数据，320/390×640；`web-parity/report.json`/截图。带`PANDORA_PARITY_DAILY_ID`时额外验证native新日期；本轮最终**25检查通过**（基础23+同ID改期2） |
| D | `python3 flutter/tool/check_demo_readback.py`；`demo-current.json`。只读四角色任务/事项/日志/通知，ID稳定，不seed/reset。4条旧联调任务不计有意义主线也不擅自删除 |
| A | 已归档A `../archive/2026-11-09-prepare-employee-client-contracts-and-business-upgrade/verification.md`，revision36d15b6；只引用共享迁移/备份、官方源与既有PC契约的历史依赖证据，不算本轮Flutter结果 |
| V | `output/flutter-client-2026-11-17/native/` 的PNG和脱敏可访问文本；API36模拟器，最终APK见实施记录；复现步骤`flutter/tool/native-acceptance.md`。截图22/23为未完成尝试，48/49为最终边缘/取消。截图14只记录发现问题，不算修复通过 |

导入重定向例（同样适用于B/X/N，将模块和常量换为表中所列）：

```sh
python3 - <<'PY'
import sys
from pathlib import Path
sys.path.insert(0, 'backend/scripts')
import check_employee_contracts_upgrade as c
c.AUDIT = Path('output/flutter-client-2026-11-17/contracts').resolve()
sys.argv = ['check_employee_contracts_upgrade.py', '--skip-witness', '--port', '18270']
c.main()
PY
```

## J01–J32 分层覆盖

| 旅程 | 当前Flutter实现与组件/逻辑 | 当前真实服务 / 依赖 | 核心UI / 差异结论 |
| --- | --- | --- | --- |
| J01 登录/强制改密 | auth；core/session_manager、errors_and_policy | R四角色/管理员拒绝；M reset→受限→改密重登 | V01/35–38真实登录和切换；不新增移动管理员 |
| J02 会话/隔离/失权 | core/session_manager；account_scope/navigation_context | R真实session/四角色；M转组/旧上级失权/停用与reset；B | V30–38前后台/进程/断网重试/新账号资料；响应丢失和存储失败用适配测试 |
| J03 版本/幂等/迟到响应 | core/pagination_idempotency；schedule_confirmation；account_scope | R同键创建、412、绝对改期；T并发/冻结 | 失败保草稿；不把网络未知结果当成功 |
| J04 三模块/清单/排序 | home_web_parity、app_navigation；home_copy | R/home与管理事件纪回读；H完整排序 | W两行/按ID展开/顺序/严格红底；V01、02与native首页 |
| J05 跨日事项/返回 | daily_calendar_web_parity、daily_items_ui、month_layout | R范围CRUD与完成跨年绝对改期；C daily；X | V44–46真实三日整条平移；W同ID新范围，native-move-cleanup.json清理自有项 |
| J06 事项私密/分页/失败 | daily_items_ui、daily_calendar_web_parity | R旧版本/93天；C隐私/分页；X>100和跨账号拒绝 | 三态、隐藏项+n真实列组件；不把API异常当空 |
| J07 创建/有序负责人/输入 | task_form、task_actions_web_parity、tags_ui | R被拒重提；T候选/跨公司/换序/四角色；M四层创建 | 原生选择取消保草稿；当前字段资格请求，不发新建历史标准 |
| J08 创建审批/未发布/重提 | approvals_ui、task_actions_web_parity | R拒绝后新request；M四层保存/发布；T缺上级/免审/冻结 | 自动预览非授权，保存后读取实际审核人 |
| J09 字段编辑/原子diff | task_form、approvals_ui、task_actions_web_parity | R并发与独立评论；T字段/提议/受众/拒绝；B | 只审核人有旧新diff；普通DTO/申请人不拼完整diff |
| J10 父子独立 | task_form/detail；navigation_context | M真实搜索/深层循环/保留/清空/子完成不改父 | 隐藏未变关联省略，不因表单缺候选误清；原生选择/返回适配 |
| J11 进展/完成/重开/来源 | task_actions_web_parity；task_action_pages | R进展→完成→重开；M停用接管后新名单+排期、拒绝保旧；T/B | 服务原子结果，原创建来源/轮次保留 |
| J12 路由/改派/截止/提醒 | task_review；approvals_ui/adapter | M四层/组织改派旧审核人失权；T204、B87，20/10/5/逾期与迟扫去重 | 无创建者/第一负责人fallback；固定保存requestId |
| J13 交接/预设 | task_actions_web_parity；TaskHandoverPage | R有序交接预览/提交/撤回；T自/直属管理者/非法来源 | 来源和候选单独授权，失效预设重新选，不夹带资料 |
| J14 表单/两种pin | task_table_ui、app_preferences、secondary_web_parity | R表单过滤分页/日历pin/版本；C排序/中文collation/后页pin；X>100 | W320/390整行同蓝；V26/27键盘/字体150；表单不覆盖日历仓库 |
| J15 时间/全天/碰撞 | core/company_date/schedule_coverage；day_axis_layout/task_calendar | R本人日历/有效提议；C date-only；X六重叠/全天/午夜/点 | V50/51横纵切换；双时轴不同全天布局，不用清单替代轴 |
| J16 连续月/实际日抽屉 | task_calendar_ui、task_calendar、app_preferences | R日历资格；X边界密集 | V15–17/42及短按复测；42%抽屉，固定进入/关闭，稀疏溢出独立命中 |
| J17 长按/月拖/取消 | task_calendar_drag_ui、calendar_drag、schedule_confirmation | R原版本保护/提议；T审批 | V20/21确认取消，V48边缘滚到跨年，49取消/恢复不确认；单次触觉用组件，真实振感后续 |
| J18 日轴边界 | calendar_drag、task_calendar_drag_ui、day_axis_layout | R排期请求；T有效/提议边界 | V50/51横纵，V53按小时调时确认，V55合法00:00确认并取消，V56超午夜不提交；24:00等其余边界用指针/领域分层 |
| J19 待审单份投影 | task_calendar/analytics_calendar_regressions | R提议位置/有效版未改/撤销；T批准/拒绝/失效 | 实线与虚线同几何；只展示授权提议，不泄漏专用diff |
| J20 日志生命周期 | work_logs_ui、secondary_web_parity；create/edit/read页面 | R唯一创建/填充/评论；C businessDate/冻结与填充 | W真实日志日期；V39–41下属冻结只读详情/createdAt/返回 |
| J21 主动追加/超限 | work_logs/work_log_fill、work_logs_ui | R真实fill-source；C长源/时段/权限与10000单位 | 原文不覆盖，超限完整预览主动删减；保留Flutter明确额外适配 |
| J22 共用标签 | tags_ui/task_form/work_logs_ui | R创始人维护/非创始人拒绝；N快照/有序/删除；T任务审核 | 无私人目录；取消回滚，旧首项不截断集合 |
| J23 平铺评论/撤权 | comments_ui/navigation_context | R评论目标投递/并发待审独立；N49冻结/删/撤权历史安全 | V16/40下属详情合法评论；员工只有发表/本人编辑，服务删除保留 |
| J24 下属完整只读 | navigation_context、task_calendar_ui、chapter_8_10 | R四角色资料/summary范围；M改组织旧上级失权；T/N | V10–18、39–42树→资料→日历/日志→详情→原人；从下属路径不升级业务写权 |
| J25 资料/邮箱/头像 | chapter_8_10、profile_save、secondary_web_parity | R四角色授权详情/摘要；M JPEG保存/非法尺寸原子拒绝；C tenure/邮箱 | V04–08系统选图/取消；预设、失败草稿、10MB和编码上限有适配/逻辑；无截至后缀 |
| J26 通知/历史 | chapter_8_10、secondary_web_parity、navigation_context | R18组合全分页/未读；N49标读/隐藏/179与180秒/撤权 | W320/390稳定sheet与模式；组件验证空/错/少/多/分页，历史独立缓存只读 |
| J27 统计/建议 | analytics_calendar_regressions、chapter_8_10 | R四角色真实统计/本地规则建议 | V02统计；自动范围/进入刷新重算，额外筛选与仅本人按用户明确舍弃 |
| J28 管理联动/接管 | profile/people/session/tasks动作 | M入职/转组/停用正式接管/重置密码；B/T；R事件纪body-only管理回读恢复；C管理Chrome | 不增加移动管理。完整审计/组织不变量由当前服务和A/PC依赖承担 |
| J29 迁移/持续运行 | DTO兼容、API不双写；安全启动脚本 | A历史迁移/Flyway/备份；本轮C skip-witness、D只读、独立fixtures | 本轮未重置常用库；生产迁移/恢复演练已移出，不伪装本次通过 |
| J30 Android/生命周期 | app_config/session/profile/drag/返回组件 | 真实本地API、debug离线APK，安装/签名/哈希见notes | V01–61真实登录/返回/键盘/安全区/font150/选图/进程/断网/账号；第二版本/厂商/振感移交 |
| J31 节假日 | analytics_calendar_regressions；holidays provider/cache | R ready/stale/missing；A官方来源/解析历史证据 | V42/47可见stale说明，跨年加载；不推测未知年，不改任务/提醒 |
| J32 四角色课程主线 | 五页原生UI、分层API | D当前稳定管理链、任务12/16/16/20及每人事项/3日志/通知；X极限隔离 | V founder+employee及下属真实数据；四角色均由R/M真实请求验证，不要求四台设备或远程展示 |

## 失败、限制与交接

- 旧完整Web每日事项浏览器复跑在“今天”定位检查失败（390宽，锚点Nov1而非可见Nov17），因此其后续检查没有执行；本次W为单独实测通过的检查集合，不能宣称旧全套Web通过。Flutter采用真实可见日/偏移的恢复逻辑，相关反例组件通过。
- Web通知首次测量误用了会随正文增长的content高度；改为测量真正sheet框体后23基础项通过。新增父子测试首次向complete传reason不符合note契约，修正后以最终M日志为准。最初profile选图测试的ProviderScope/fakeAsync、Gradle资源注册问题均在当前实现修正，旧失败不重标通过。
- 测试曾误放integration_test目录，触发设备测试构建而不是宿主测试；随后移到tool/tests，仅宿主测试，最终APK通过离线脚本重建/重装。没有证据表明下载了新大文件；不能声称每次历史构建均带--offline。
- API36系统照片picker不提供传统权限拒绝对话框；该分支以可替换picker适配测试覆盖。模拟器真实振感、API26第二系统/厂商、手机、远程HTTP服务器及生产证书/签名/运维由使用者/组员后续演示前自行检查，未实测、不作为本change门槛。
- 原始输出在本机output目录，未提交APK、截图和大日志；独立验证者应运行上述入口及native步骤获得自己的证据。apply不编辑verification.md、不设独立结论、不归档。
