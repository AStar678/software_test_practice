# Implementation Verification

- Change: `align-web-employee-client-with-nov08-guidance`
- Schema: `spec-driven`
- Verdict: BLOCKED
- Verified at: 2026-11-13T00:03:00+08:00
- Implementation roots: `/Users/watuji/MyGitDev/software_test_practice`（根目录员工Web与backend；规划在同一根内）
- Verified revision: `cae5c99d3d4073ee366765829877284cc4b0c0e6` 加本轮未提交修复；以输入快照SHA-256为精确内容基准。

## Summary

四项实现finding V-001–V-004 已由修复代理处理，并由本轮独立验证标为 `verified-resolved`。修复后的独立副本通过后端129项、补充浏览器100项、演示89项及四角色浏览器50项、通知77项、下属89项、填充契约74项、四视口smoke52项和JAR资源15项检查；原始反例的独立复测也通过。通知类型组合还覆盖了无关联申请通知的空值异常修复。没有待修复的已确认实现问题。

整体仍为 **BLOCKED**：V-005真实手机触摸/滚动交接与实际浏览器能力证据无法在当前环境获得；不能将桌面/CDP通过写成全面PASS。用户已明确授权“除了验证不了的都pass后，提交、推送”，因此该证据限制保留在报告，提交推送可继续；不归档。公网年度源连通与用户实际演示目标/回退部署仍未执行，不以本地夹具证明部署条件。超过12月挂载的拖动源保留本轮已补可控浏览器检查，实际手机边缘长拖动仍归V-005。

## Verification Basis

| Path or scope | Revision / content fingerprint / file inventory |
| --- | --- |
| 当前实现及控制规划 | 上述revision加8个修改文件、2个新增回归脚本；共976个输入文件；proposal/design/specs/tasks/指导未变化。报告/状态不计入输入。 |
| `verification-state.json` | SHA-256 `aeab69eb5d78cdc823fba6dd37e43b90ab45b421d3485e6bc5ac4bf5918767ba`；脚本生成的完整输入清单，不是全部文件逐项测试通过证明。 |
| 上轮独立基线 | `8a09d141a1423520a92b274c83e9da6b64da8cb19b4137fcb931038bd6bc9f70`，974文件；原报告四项失败保持未解决，直到本轮各自复测通过。 |
| 增量输入 | 新增`check_web_verification_repairs.py`及browser脚本；修改DemoSeed、WorkspaceService、WorkspaceBatchReadTest、demo两脚本、个人资料/工作区JS及HTML资源版本；无删除/范围变化。 |
| 执行副本 | `/private/tmp/pandora-reverify-gsju_0sn/repo`，从当前工作树逐文件复制（包含未提交修复），按快照逐一核对哈希；976文件匹配。全新独立MySQL凭据/数据目录与随机夹具库，没有使用原业务库。 |
| 检查中输入变化 | 起始快照`3f2b9fbc35920c7a9c2bcd8ccd581147ca0a994112fb1838a30a7bf8ab4192ed`后仅demo角色脚本和新增修复browser脚本调整断言；逐文件同步后重跑它们（89/50及100项）。生产代码/后端测试/资源没变，因此先完成的Maven129及资源15证据仍有效。 |
| 最终检查 | 更新后快照与最终after比较 `changed:false`，exit0；最终状态JSON直接复制，未手填哈希清单。临时服务已停止。 |

使用唯一根`/Users/watuji/MyGitDev/software_test_practice`（实现与规划同仓库），inventory为`git-tracked-and-unignored`。排除运行产物/缓存：`backend/.runtime/*`、`backend/target/*`、`output/*`、`**/__pycache__/*`、`audit/**/*.log`。脚本自动排除.git、implementation-notes.md、verification.md、verification-state.json；implementation-notes另行审阅。所有控制规划、配置、依赖声明、测试仍在清单内。

```sh
python3 .agents/skills/openspec-e13-verify-change/scripts/verification_snapshot.py capture \
  --root /Users/watuji/MyGitDev/software_test_practice \
  --exclude 'backend/.runtime/*' --exclude 'backend/target/*' \
  --exclude 'output/*' --exclude '**/__pycache__/*' --exclude 'audit/**/*.log' \
  --output /tmp/pandora-reverify-before.json
python3 .agents/skills/openspec-e13-verify-change/scripts/verification_snapshot.py compare \
  openspec/changes/align-web-employee-client-with-nov08-guidance/verification-state.json \
  /tmp/pandora-reverify-before.json
# exit1：8修改+2新增，按影响重验。
# 同参数capture updated/after，然后比较：
python3 .agents/skills/openspec-e13-verify-change/scripts/verification_snapshot.py compare \
  /tmp/pandora-reverify-updated.json /tmp/pandora-reverify-after.json
# exit0 changed:false。after原样复制为本change verification-state.json。
```

本轮为增量独立验证：重跑全部修复领域及共享通知后端、资源/集成检查。复用上轮本代理独立获得的E02事项265、E05拖动44及通用跨日API200、E06排期133、E07 table172/daily41/hire42、E08假日37、E10chapter8 33；它们的控制规划、对应服务/测试/配置/核心模块及执行条件未变化。修改的工作区JS仅日志填充与通知刷新，个人资料JS仅人员读取/失权，未改变事项/日历几何、排期提交、表单排序置顶或任职算法；当前E03/E04/E07 fill/E11/E13补受影响集成，因此不盲目重跑全部。E01 current通知分类单元与E04/E13/P3覆盖共享服务唯一变更。不复用apply/修复代理的PASS作为独立通过证据；其交接只用于确定检查路径。

## Apply Handoff Review

已审阅当前`implementation-notes.md`和修复代理写入的repair字段。apply notes仍记`29f4f73 plus dirty`，相对当前基线/修复属于旧描述；backend“无业务修复”的原声明也已被通知分类最小修复取代。本轮以当前代码和独立证据为准，未改动apply-owned notes。

| Reminder | Disposition |
| --- | --- |
| 实机触摸/震动 | 未解决，V-005；当前工具仍无实际手机，CDP调用不证明马达/浏览器原生滚动交接。 |
| 通知契约、切换和账号 | 本轮E04/E13/P3通过；原V-004已解决，含120条、类型/未读/模式、第二页失败原子保留与重试；审核分类保留。无task/request通知category筛选当前200。 |
| 事项键盘/关闭锚点/手机边缘 | 复用有效E02，当前E11补四窗口集成；手机滚动衔接仍V-005。 |
| 拖动>12月来源卸载 | 本轮E14在真实桌面浏览器保持活动拖动、强制跨12月挂载、保留源与预览、Esc后版本不变；普通边缘补载由原E05支持。不是实际手机长距离手势证据。 |
| 人员失败与失权 | 本轮E03/E13及原P2复测通过，V-003已解决；目录/详情/日志网络Error及500可原地重试，403/目录移除清空。故障为可控请求拒绝，没有声称现场断网。 |
| 演示目标/准备与回退 | 本轮E09/P1新空随机库准备两次/重启/修改保留通过；四人日轴短任务及正常逾期详情真实可读，非主角额外日志为0，V-001已解决。没有替换实际演示目标/清理旧库，部署时仍须显式新目标并保留旧库回退。 |
| 旧检查维护/witness | 当前与旧独立证据按影响使用；不恢复横向事项/下拉通知/日轴越午夜等冲突断言。完整witness未运行，不宣称通过；V30→V35仍有有效E02证据。smoke缺失年度用本地关闭端口保持前提。 |
| 作用域 | 改动只涉及根Web、必要backend、回归与验证报告；没有Flutter/Android/桥接/APK/系统推送、schema迁移或归档A修改。此前用户已明确Web优先暂缓Flutter。 |

## Checks

本轮服务/浏览器检查在独立临时副本和新MySQL中运行，最终全部exit0。下面明确区分本轮与上轮有效独立证据；临时日志不是长期依赖，关键观察已保存在报告。原仓库审计文件未被覆盖。

| ID / Command or inspection | Result | Notes |
| --- | --- | --- |
| 当前OpenSpec status/instructions apply | complete / all_done | spec-driven，49/49勾选仅作声明。 |
| `openspec validate align-web-employee-client-with-nov08-guidance --type change --strict --json --no-interactive` | 本轮PASS | 无结构问题。 |
| E01 `mvn -o -q -Dmaven.repo.local=/Users/watuji/MyGitDev/software_test_practice/backend/.runtime/m2 test package` | 本轮PASS 129 | 0 failures/errors，含无申请通知immutable Set空值回归，构建JAR。 |
| E03 `python3 scripts/check_subordinate_workspace.py` | 本轮PASS 89 | 人员/只读评论/嵌套返回/真正失权。 |
| E04 `python3 scripts/check_apply_notifications.py` | 本轮PASS 77 | 24 API+53 browser，动态审核/提醒、组合筛选、打开才标读、会话/快速切换。 |
| E07 fill `python3 scripts/check_employee_contracts_upgrade.py --skip-witness --only fill --port 18314` | 本轮PASS 74 | 完整源、业务日/午夜、超近三日但仍合法窗口、冻结不影响源本身可读；源可读不授予草稿追加资格。 |
| E09 原`check_final_demo.py` main + 独立只读prepare观察包装器 | 本轮PASS 89，角色browser50 | 新空目标准备/重启/两次准备、四人本人日轴拖动目标和逾期详情、编辑保留；独立SQL三次读回同日定时33、已逾期未完成4、只有四主角各3日志。 |
| E11 `PANDORA_HOLIDAY_SOURCE_URL_TEMPLATE='http://127.0.0.1:1/{year}.json' python3 audit/align-web-employee-client-with-nov08-guidance/smoke/apply_smoke.py` | 本轮PASS 52 | 320×740、390×844、1440×900、390×600；真实本地ready/missing年度、日志创建填充/原子溢出、首页/人员/事项等。 |
| E12 `python3 scripts/check_web_resources.py --repo .. --jar target/pandora-backend-0.1.0.jar --output /tmp/pandora-reverify-resources.json` | 本轮PASS 15/15 | 当前内容版本/顺序/白名单与JAR字节一致。 |
| E13 `python3 scripts/check_web_verification_repairs.py` | 本轮PASS 100 | 审阅后独立执行，合法编辑填充、读源途中推进86401秒后失效、直接动作、过期保存；人员3处网络/500/403/目录移除；125通知、120已加载、四组合返回及第二页故障保留/重试/全部读完无重复。 |
| P2 原始冻结/人员反例复测 | 本轮PASS | 冻结后正文前后完全一致，提示只读；临时读取失败不再报无权，恢复网络后保留3个月份。 |
| P3 独立121通知反例及扩展 | 本轮PASS | 120条详情返回仍120；other+unread+full返回119；第二页失败后118条保留，重试118；所有请求limit≤100。 |
| E14 强制>12月活动拖动probe | 本轮PASS | 桌面真实事件激活，挂载跨年月份超过12仍保留源/活动预览；Esc无写入/无弹层/无残留。直接调用现有补载入口施加卸载压力，不冒充实机持续边缘长拖动。 |
| E02 `check_daily_items.py` | 复用上轮PASS 265 | 73 API/迁移+192 browser；对应实现/测试/迁移不变，当前E11再验集成。 |
| E05 `check_web_alignment_drag.py` / E06 `check_schedule_drag.py` | 复用上轮PASS 44+API200 / 133 | 日历/调时/资格核心未变，本轮E14补先前长挂载缺口；手机仍未验证。 |
| E07 table/daily/hire | 复用上轮PASS 172/41/42 | 服务全局排序/两独立pin/本人范围/资料隐私与时长；相关契约/测试没变。 |
| E08 `check_holidays.py` / E10 `check_chapter8_web.py` | 复用上轮PASS 37 / 33 | 年度服务、日期语义、资料和表单契约未变；当前smoke用本地源重验UI。 |
| S 当前diff/代码与输入比较 | 本轮符合 | 冻结门禁、过期响应、失败/失权分离、合法分页/原子替换、种子审批版本/历史时间、资源版本逐项追踪；最终输入比较无变化。 |

修复代理曾在默认公网异步源下运行smoke，缺失年已被后台获取，导致“应missing”前提不成立。本代理从一开始用关闭的本地源端口运行当前smoke，保留脚本显式写入的有效年度，缺失年度确定为missing；本轮52项全部通过。没有修改产品或旧断言来获得通过，也不宣称公网源连通。E14临时探针首次误把合法创建201视为失败；校正为接受200/201后，活动拖动挂载35个月、源节点与预览仍在，取消不写入。该失败属于探针断言，未改产品代码。完整witness、实际演示库部署、实际手机仍未获得证据。

## Requirement Coverage

覆盖两份delta全部17项要求（含2项删除）、109个场景。E编号见Checks，S为当前静态追踪；每个规范整体及场景均显式列出。未变行为使用仍有效的上轮独立证据，受影响行已由本轮检查更新。`符合`不包含已明确列出的手机/部署环境限制，整体BLOCKED不能被局部通过抵销。

| Requirement / scenario | Evidence | Result |
| --- | --- | --- |
| **Holiday labels do not change task time semantics（规范整体）**<br>`specs/china-holiday-calendar/spec.md:3` | `潘多拉-日程视图.js`年度加载/重绘与后端Holiday服务；E01/E08/E11；S同映射/任务与提醒不变 | 年度名称及休/班、缓存/失败保留、无任务时间语义变化符合；公网源连通未验证 |
| Keep schedules and reminders unchanged after a refresh | `潘多拉-日程视图.js`年度加载/重绘与后端Holiday服务；E01/E08/E11；S同映射/任务与提醒不变 | 符合（当前执行及所列静态追踪） |
| Show one annual arrangement in both Web views | `潘多拉-日程视图.js`年度加载/重绘与后端Holiday服务；E01/E08/E11；S同映射/任务与提醒不变 | 符合（当前执行及所列静态追踪） |
| Preserve cached labels when another year is unavailable | `潘多拉-日程视图.js`年度加载/重绘与后端Holiday服务；E01/E08/E11；S同映射/任务与提醒不变 | 符合（当前执行及所列静态追踪） |
| **Three-section home dashboard（规范整体）**<br>`specs/pandora-requirements-aligned-prototype/spec.md:3` | `潘多拉-工作区接入.js`、`潘多拉-正式版.css`；E01/E09/E11；S追踪`WorkspaceService.home`及公司信息限额/排序/鉴权 | 三模块、预览→清单、最多十项派发排序、只读事件纪及创建入口符合；手机滑动仍V-005 |
| Render three modules in their intended positions | `潘多拉-工作区接入.js`、`潘多拉-正式版.css`；E01/E09/E11；S追踪`WorkspaceService.home`及公司信息限额/排序/鉴权 | 符合（当前执行及所列静态追踪） |
| Scroll home modules independently | `潘多拉-工作区接入.js`、`潘多拉-正式版.css`；E01/E09/E11；S追踪`WorkspaceService.home`及公司信息限额/排序/鉴权 | 符合（当前执行及所列静态追踪） |
| Include self-created assigned work | `潘多拉-工作区接入.js`、`潘多拉-正式版.css`；E01/E09/E11；S追踪`WorkspaceService.home`及公司信息限额/排序/鉴权 | 符合（当前执行及所列静态追踪） |
| Exclude work outside the board contract | `潘多拉-工作区接入.js`、`潘多拉-正式版.css`；E01/E09/E11；S追踪`WorkspaceService.home`及公司信息限额/排序/鉴权 | 符合（当前执行及所列静态追踪） |
| Rank a newly assigned old task | `潘多拉-工作区接入.js`、`潘多拉-正式版.css`；E01/E09/E11；S追踪`WorkspaceService.home`及公司信息限额/排序/鉴权 | 符合（当前执行及所列静态追踪） |
| Show concise tasks and read only company information | `潘多拉-工作区接入.js`、`潘多拉-正式版.css`；E01/E09/E11；S追踪`WorkspaceService.home`及公司信息限额/排序/鉴权 | 符合（当前执行及所列静态追踪） |
| Reject company information above the limit | `潘多拉-工作区接入.js`、`潘多拉-正式版.css`；E01/E09/E11；S追踪`WorkspaceService.home`及公司信息限额/排序/鉴权 | 符合（当前执行及所列静态追踪） |
| Remove only the home log presentation | `潘多拉-工作区接入.js`、`潘多拉-正式版.css`；E01/E09/E11；S追踪`WorkspaceService.home`及公司信息限额/排序/鉴权 | 符合（当前执行及所列静态追踪） |
| Separate creation actions | `潘多拉-工作区接入.js`、`潘多拉-正式版.css`；E01/E09/E11；S追踪`WorkspaceService.home`及公司信息限额/排序/鉴权 | 符合（当前执行及所列静态追踪） |
| Reserve three complete rows in both upper cards | `潘多拉-工作区接入.js`、`潘多拉-正式版.css`；E01/E09/E11；S追踪`WorkspaceService.home`及公司信息限额/排序/鉴权 | 符合（当前执行及所列静态追踪） |
| Keep the daily header compact | `潘多拉-工作区接入.js`、`潘多拉-正式版.css`；E01/E09/E11；S追踪`WorkspaceService.home`及公司信息限额/排序/鉴权 | 符合（当前执行及所列静态追踪） |
| Restore the board list after detail | `潘多拉-工作区接入.js`、`潘多拉-正式版.css`；E01/E09/E11；S追踪`WorkspaceService.home`及公司信息限额/排序/鉴权 | 符合（当前执行及所列静态追踪） |
| **Independent personal daily items（规范整体）**<br>`specs/pandora-requirements-aligned-prototype/spec.md:60` | `潘多拉-每日事项.js`及后端范围事项服务/迁移；E02/E07 daily；S权限/日期/纯文本 | 范围记录、本人隐私、三态、无任务副作用、迁移符合 |
| Create more than ten independent items | `潘多拉-每日事项.js`及后端范围事项服务/迁移；E02/E07 daily；S权限/日期/纯文本 | 符合（当前执行及所列静态追踪） |
| Edit the date and body of a specific item | `潘多拉-每日事项.js`及后端范围事项服务/迁移；E02/E07 daily；S权限/日期/纯文本 | 符合（当前执行及所列静态追踪） |
| Complete and reopen an item | `潘多拉-每日事项.js`及后端范围事项服务/迁移；E02/E07 daily；S权限/日期/纯文本 | 符合（当前执行及所列静态追踪） |
| Keep dates stable across time zones | `潘多拉-每日事项.js`及后端范围事项服务/迁移；E02/E07 daily；S权限/日期/纯文本 | 符合（当前执行及所列静态追踪） |
| Enforce private ownership on every operation | `潘多拉-每日事项.js`及后端范围事项服务/迁移；E02/E07 daily；S权限/日期/纯文本 | 符合（当前执行及所列静态追踪） |
| Keep daily-item details minimal and safe | `潘多拉-每日事项.js`及后端范围事项服务/迁移；E02/E07 daily；S权限/日期/纯文本 | 符合（当前执行及所列静态追踪） |
| Preserve one ranged record across dates | `潘多拉-每日事项.js`及后端范围事项服务/迁移；E02/E07 daily；S权限/日期/纯文本 | 符合（当前执行及所列静态追踪） |
| Expire after the inclusive end date | `潘多拉-每日事项.js`及后端范围事项服务/迁移；E02/E07 daily；S权限/日期/纯文本 | 符合（当前执行及所列静态追踪） |
| Migrate dated daily items without data loss | `潘多拉-每日事项.js`及后端范围事项服务/迁移；E02/E07 daily；S权限/日期/纯文本 | 符合（当前执行及所列静态追踪） |
| **Daily-item lists details and reliable editing（规范整体）**<br>`specs/pandora-requirements-aligned-prototype/spec.md:105` | `潘多拉-每日事项.js/.css`；E02/E10/E11；S弹层/草稿/会话/真实ID | 清单/维护/薄荷加号/返回及可靠写入符合；手机滚动仍V-005 |
| Open an empty day and create with the floating button | `潘多拉-每日事项.js/.css`；E02/E10/E11；S弹层/草稿/会话/真实ID | 符合（当前执行及所列静态追踪） |
| Read every item and return through the layers | `潘多拉-每日事项.js/.css`；E02/E10/E11；S弹层/草稿/会话/真实ID | 符合（当前执行及所列静态追踪） |
| Edit and delete only the selected item | `潘多拉-每日事项.js/.css`；E02/E10/E11；S弹层/草稿/会话/真实ID | 符合（当前执行及所列静态追踪） |
| Preserve drafts and reject stale versions | `潘多拉-每日事项.js/.css`；E02/E10/E11；S弹层/草稿/会话/真实ID | 符合（当前执行及所列静态追踪） |
| Isolate sessions and out-of-order responses | `潘多拉-每日事项.js/.css`；E02/E10/E11；S弹层/草稿/会话/真实ID | 符合（当前执行及所列静态追踪） |
| Keep controls usable on compact screens | `潘多拉-每日事项.js/.css`；E02/E10/E11；S弹层/草稿/会话/真实ID | 符合（当前执行及所列静态追踪） |
| Create from the mint glass header control | `潘多拉-每日事项.js/.css`；E02/E10/E11；S弹层/草稿/会话/真实ID | 符合（当前执行及所列静态追踪） |
| Preserve a range when completing from a middle day | `潘多拉-每日事项.js/.css`；E02/E10/E11；S弹层/草稿/会话/真实ID | 符合（当前执行及所列静态追踪） |
| Reject a stale single-date reschedule on a ranged item | `潘多拉-每日事项.js/.css`；E02/E10/E11；S弹层/草稿/会话/真实ID | 符合（当前执行及所列静态追踪） |
| Open a continued item at its actual hit date | `潘多拉-每日事项.js/.css`；E02/E10/E11；S弹层/草稿/会话/真实ID | 符合（当前执行及所列静态追踪） |
| **Personal work logs（规范整体）**<br>`specs/pandora-requirements-aligned-prototype/spec.md:156` | E01/E03/E07 fill/E09/E11/E13/P2；当前工作区/人员JS及WorkspaceService | 符合所属日/窗口/服务端与旧页冻结；V-002已解决 |
| Backfill three dates with a full window | `潘多拉-工作区接入.js`、`潘多拉-个人资料.js`、`WorkspaceService`；E01/E03/E07 fill/E09/E11；S日志日期/窗口/创建编辑/关联任务 | 符合（当前执行及所列静态追踪） |
| Freeze after twenty-four hours instead of midnight | E01/E13/P2；服务真实冻结、旧编辑页/进行中响应与直接动作 | 符合；V-002 verified-resolved |
| Preserve the daily slot under concurrency and deletion | `潘多拉-工作区接入.js`、`潘多拉-个人资料.js`、`WorkspaceService`；E01/E03/E07 fill/E09/E11；S日志日期/窗口/创建编辑/关联任务 | 符合（当前执行及所列静态追踪） |
| Preserve full-screen editing and independent links | `潘多拉-工作区接入.js`、`潘多拉-个人资料.js`、`WorkspaceService`；E01/E03/E07 fill/E09/E11；S日志日期/窗口/创建编辑/关联任务 | 符合（当前执行及所列静态追踪） |
| Write and edit a log in a full-screen sheet | `潘多拉-工作区接入.js`、`潘多拉-个人资料.js`、`WorkspaceService`；E01/E03/E07 fill/E09/E11；S日志日期/窗口/创建编辑/关联任务 | 符合（当前执行及所列静态追踪） |
| Enforce one log under concurrent distinct keys | `潘多拉-工作区接入.js`、`潘多拉-个人资料.js`、`WorkspaceService`；E01/E03/E07 fill/E09/E11；S日志日期/窗口/创建编辑/关联任务 | 符合（当前执行及所列静态追踪） |
| Freeze across the midnight boundary | E01/E13/P2；真实首次创建+24h，不按午夜提前冻结 | 符合；V-002 verified-resolved |
| Link, clear or redact tasks independently | `潘多拉-工作区接入.js`、`潘多拉-个人资料.js`、`WorkspaceService`；E01/E03/E07 fill/E09/E11；S日志日期/窗口/创建编辑/关联任务 | 符合（当前执行及所列静态追踪） |
| Search and link a visible task | `潘多拉-工作区接入.js`、`潘多拉-个人资料.js`、`WorkspaceService`；E01/E03/E07 fill/E09/E11；S日志日期/窗口/创建编辑/关联任务 | 符合（当前执行及所列静态追踪） |
| Clear a linked task | `潘多拉-工作区接入.js`、`潘多拉-个人资料.js`、`WorkspaceService`；E01/E03/E07 fill/E09/E11；S日志日期/窗口/创建编辑/关联任务 | 符合（当前执行及所列静态追踪） |
| Show no matching linked tasks | `潘多拉-工作区接入.js`、`潘多拉-个人资料.js`、`WorkspaceService`；E01/E03/E07 fill/E09/E11；S日志日期/窗口/创建编辑/关联任务 | 符合（当前执行及所列静态追踪） |
| Write an unlinked log | `潘多拉-工作区接入.js`、`潘多拉-个人资料.js`、`WorkspaceService`；E01/E03/E07 fill/E09/E11；S日志日期/窗口/创建编辑/关联任务 | 符合（当前执行及所列静态追踪） |
| Superior reads a subordinate log | `潘多拉-工作区接入.js`、`潘多拉-个人资料.js`、`WorkspaceService`；E01/E03/E07 fill/E09/E11；S日志日期/窗口/创建编辑/关联任务 | 符合（当前执行及所列静态追踪） |
| Regress actual log entry and the selected editor | `潘多拉-工作区接入.js`、`潘多拉-个人资料.js`、`WorkspaceService`；E01/E03/E07 fill/E09/E11；S日志日期/窗口/创建编辑/关联任务 | 符合（当前执行及所列静态追踪） |
| Keep creation separate from an existing log | `潘多拉-工作区接入.js`、`潘多拉-个人资料.js`、`WorkspaceService`；E01/E03/E07 fill/E09/E11；S日志日期/窗口/创建编辑/关联任务 | 符合（当前执行及所列静态追踪） |
| Display and sort a backfilled log by business date | `潘多拉-工作区接入.js`、`潘多拉-个人资料.js`、`WorkspaceService`；E01/E03/E07 fill/E09/E11；S日志日期/窗口/创建编辑/关联任务 | 符合（当前执行及所列静态追踪） |
| **Minimal profile page（规范整体）**<br>`specs/pandora-requirements-aligned-prototype/spec.md:231` | `潘多拉-个人资料.js`、`ProfileService`、`Tenure`；E01/E03/E07 hire/E10；S组织路径/字段权限 | 隐藏身份、保留真实组织、联系方式/空态/时长及权限符合 |
| Read and edit the required profile | `潘多拉-个人资料.js`、`ProfileService`、`Tenure`；E01/E03/E07 hire/E10；S组织路径/字段权限 | 符合（当前执行及所列静态追踪） |
| Open a subordinate within both profile scope and the management chain | `潘多拉-个人资料.js`、`ProfileService`、`Tenure`；E01/E03/E07 hire/E10；S组织路径/字段权限 | 符合（当前执行及所列静态追踪） |
| View profile | `潘多拉-个人资料.js`、`ProfileService`、`Tenure`；E01/E03/E07 hire/E10；S组织路径/字段权限 | 符合（当前执行及所列静态追踪） |
| Keep identity fields read-only to employees | `潘多拉-个人资料.js`、`ProfileService`、`Tenure`；E01/E03/E07 hire/E10；S组织路径/字段权限 | 符合（当前执行及所列静态追踪） |
| Refresh a known person without losing organization fields | `潘多拉-个人资料.js`、`ProfileService`、`Tenure`；E01/E03/E07 hire/E10；S组织路径/字段权限 | 符合（当前执行及所列静态追踪） |
| Read contact details only inside the actual management chain | `潘多拉-个人资料.js`、`ProfileService`、`Tenure`；E01/E03/E07 hire/E10；S组织路径/字段权限 | 符合（当前执行及所列静态追踪） |
| Calculate completed tenure at calendar boundaries | `潘多拉-个人资料.js`、`ProfileService`、`Tenure`；E01/E03/E07 hire/E10；S组织路径/字段权限 | 符合（当前执行及所列静态追踪） |
| Hide identity while retaining actual organization and permissions | `潘多拉-个人资料.js`、`ProfileService`、`Tenure`；E01/E03/E07 hire/E10；S组织路径/字段权限 | 符合（当前执行及所列静态追踪） |
| Show empty subordinate contacts and tenure | `潘多拉-个人资料.js`、`ProfileService`、`Tenure`；E01/E03/E07 hire/E10；S组织路径/字段权限 | 符合（当前执行及所列静态追踪） |
| **Strict prototype scope（规范整体）**<br>`specs/pandora-requirements-aligned-prototype/spec.md:280` | proposal/design；当前diff；E01–E12；真实Fixture/事件路径；S作用域与退休登录检查 | Web真实服务及范围符合；要求的真实手机验证未完成，V-005 |
| Validate against the selected checklist | proposal/design；当前diff；E01–E12；真实Fixture/事件路径；S作用域与退休登录检查 | 符合（当前执行及所列静态追踪） |
| Keep native Android outside the change | proposal/design；当前diff；E01–E12；真实Fixture/事件路径；S作用域与退休登录检查 | 符合（当前执行及所列静态追踪） |
| Validate the real service and declared scope | proposal/design；当前diff；E01–E12；真实Fixture/事件路径；S作用域与退休登录检查 | 符合（当前执行及所列静态追踪） |
| Inspect available actions | proposal/design；当前diff；E01–E12；真实Fixture/事件路径；S作用域与退休登录检查 | 符合（当前执行及所列静态追踪） |
| Open the split static prototype | proposal/design；当前diff；E01–E12；真实Fixture/事件路径；S作用域与退休登录检查 | 符合（当前执行及所列静态追踪） |
| **Persistent demonstration data for web and administration（规范整体）**<br>`specs/pandora-requirements-aligned-prototype/spec.md:309` | 当前DemoSeed/prepare；E09/P1与E07隔离夹具 | 符合；短任务/逾期/日志分离及修改保留已确认，V-001已解决 |
| Run a continuous demo after refresh | `DemoSeed.java`、`prepare_demo.py`；E09/P1；E07隔离极限夹具 | 符合（当前执行及所列静态追踪） |
| Prepare a complete repeatable new-model demonstration | `DemoSeed.java`、`prepare_demo.py`；E09/P1；E07隔离极限夹具 | 符合（当前执行及所列静态追踪） |
| Follow the four real animation roles | `DemoSeed.java`、`prepare_demo.py`；E09/P1；E07隔离极限夹具 | 符合（当前执行及所列静态追踪） |
| Preserve edits and keep extreme fixtures separate | E09/P1；四主角日志12，非主角日志0，修改保留 | 符合；V-001 verified-resolved |
| Demonstrate every protagonist's own work and task chain | `DemoSeed.java`、`prepare_demo.py`；E09/P1；E07隔离极限夹具 | 符合（当前执行及所列静态追踪） |
| Exercise the new Web interactions using real records | E09/P1；四人真实短任务拖动入口/逾期详情、4逾期任务 | 符合；V-001 verified-resolved |
| Prepare a current dataset without resetting edited data | `DemoSeed.java`、`prepare_demo.py`；E09/P1；E07隔离极限夹具 | 符合（当前执行及所列静态追踪） |
| **Notification list presentation and combined filters（规范整体）**<br>`specs/pandora-requirements-aligned-prototype/spec.md:354` | 当前工作区JS及WorkspaceService；E04/E13/P3 | 符合；120条恢复/错误保留及类型空值已修复，V-004已解决 |
| Filter across page boundaries | E04/E13/P3；合法100+20/19页，类型组合/动态审核 | 符合；V-004 verified-resolved |
| Require actionable review classification | `潘多拉-工作区接入.js`、`潘多拉-api.js`、`潘多拉-手账主题.css`及`WorkspaceService`；E04/P3 | 符合（当前执行及所列静态追踪） |
| Return after opening an unread notification | E04/E13/P3；标读正确，未读移除，120条范围恢复 | 符合；V-004 verified-resolved |
| Classify actual reminder events across pages | `潘多拉-工作区接入.js`、`潘多拉-api.js`、`潘多拉-手账主题.css`及`WorkspaceService`；E04/P3 | 符合（当前执行及所列静态追踪） |
| Keep narrow-screen filters available while scrolling | `潘多拉-工作区接入.js`、`潘多拉-api.js`、`潘多拉-手账主题.css`及`WorkspaceService`；E04/P3 | 符合（当前执行及所列静态追踪） |
| Restore mode filters and position after reading | E13/P3；other+all/unread及compact/full，位置/第二页失败重试 | 符合；V-004 verified-resolved |
| **Hierarchical subordinate workspace（规范整体）**<br>`specs/pandora-requirements-aligned-prototype/spec.md:387` | 当前个人资料JS/下属来源模式；E03/E13/P2 | 符合；临时错误与真失权分离，V-003已解决 |
| Expand descendants and select independently | `潘多拉-个人资料.js`、任务/日志下属来源模式；E03/E07 hire；P2 | 符合（当前执行及所列静态追踪） |
| Read a person's schedule on a small screen | `潘多拉-个人资料.js`、任务/日志下属来源模式；E03/E07 hire；P2 | 符合（当前执行及所列静态追踪） |
| Read logs and return from details | `潘多拉-个人资料.js`、任务/日志下属来源模式；E03/E07 hire；P2 | 符合（当前执行及所列静态追踪） |
| Revalidate access and session | E03/E13/P2；临时错误可重试、403/目录移除真失权清空、旧请求失效 | 符合；V-003 verified-resolved |
| Keep the subordinate canvas non-draggable and details normally authorized | `潘多拉-个人资料.js`、任务/日志下属来源模式；E03/E07 hire；P2 | 符合（当前执行及所列静态追踪） |
| Show organization alongside position | `潘多拉-个人资料.js`、任务/日志下属来源模式；E03/E07 hire；P2 | 符合（当前执行及所列静态追踪） |
| Return through nested subordinate details | `潘多拉-个人资料.js`、任务/日志下属来源模式；E03/E07 hire；P2 | 符合（当前执行及所列静态追踪） |
| Keep overlapping identities read-only in subordinate context | `潘多拉-个人资料.js`、任务/日志下属来源模式；E03/E07 hire；P2 | 符合（当前执行及所列静态追踪） |
| **Subordinate calendar month and day views（规范整体）**<br>`specs/pandora-requirements-aligned-prototype/spec.md:428` | E03/E11/E13/P2；连续月份/投影/固定清单与状态隔离 | 符合；跨页签临时错误不再清空授权月份，V-003已解决 |
| Navigate months days and overflow | `潘多拉-个人资料.js`与共用日历投影；E03/E11；P2 | 符合（当前执行及所列静态追踪） |
| Distinguish completed and pending tasks in every presentation | `潘多拉-个人资料.js`与共用日历投影；E03/E11；P2 | 符合（当前执行及所列静态追踪） |
| Reuse personal calendar browsing without changing its owner | `潘多拉-个人资料.js`与共用日历投影；E03/E11；P2 | 符合（当前执行及所列静态追踪） |
| Continue across years and recover a failed adjacent load | E03/E13/P2；相邻月失败重试及跨页签错误均保留授权月份 | 符合；V-003 verified-resolved |
| Keep long-list actions visible | `潘多拉-个人资料.js`与共用日历投影；E03/E11；P2 | 符合（当前执行及所列静态追踪） |
| **Calendar dragging by presentation（规范整体）**<br>`specs/pandora-requirements-aligned-prototype/spec.md:455` | E05/E06有效独立证据，当前E03/E14，S权限/草稿 | 桌面/仿真符合并补>12月源保留；真实手机仍V-005 |
| Move an entire month bar by dates | `潘多拉-日程视图.js`、`潘多拉-任务接入.js`、`潘多拉-日历.css`；E05/E06/E03；S权限/草稿/trimStream | 符合（当前执行及所列静态追踪） |
| Resize a month endpoint by days | `潘多拉-日程视图.js`、`潘多拉-任务接入.js`、`潘多拉-日历.css`；E05/E06/E03；S权限/草稿/trimStream | 符合（当前执行及所列静态追踪） |
| Adjust day events and the all-day section by hours | `潘多拉-日程视图.js`、`潘多拉-任务接入.js`、`潘多拉-日历.css`；E05/E06/E03；S权限/草稿/trimStream | 符合（当前执行及所列静态追踪） |
| Separate canvas interactions from task-detail permissions | `潘多拉-日程视图.js`、`潘多拉-任务接入.js`、`潘多拉-日历.css`；E05/E06/E03；S权限/草稿/trimStream | 符合（当前执行及所列静态追踪） |
| Preserve cancellation and stale-version boundaries | `潘多拉-日程视图.js`、`潘多拉-任务接入.js`、`潘多拉-日历.css`；E05/E06/E03；S权限/草稿/trimStream | 符合（当前执行及所列静态追踪） |
| Prevent dragging any clipped cross-day segment | `潘多拉-日程视图.js`、`潘多拉-任务接入.js`、`潘多拉-日历.css`；E05/E06/E03；S权限/草稿/trimStream | 符合（当前执行及所列静态追踪） |
| Confirm a monthly drop in a lightweight sheet | `潘多拉-日程视图.js`、`潘多拉-任务接入.js`、`潘多拉-日历.css`；E05/E06/E03；S权限/草稿/trimStream | 符合（当前执行及所列静态追踪） |
| Preserve the lightweight draft on failure | `潘多拉-日程视图.js`、`潘多拉-任务接入.js`、`潘多拉-日历.css`；E05/E06/E03；S权限/草稿/trimStream | 符合（当前执行及所列静态追踪） |
| Activate a mobile drag only after a long press | E05仿真44项；S非被动touchmove；未有真实手机 | 未充分验证 V-005 |
| Drag a continued segment across rows months and years | E05/E06有效独立证据；本轮E14补>12月源保留/取消 | 桌面/仿真符合；实机边界仍V-005 |
| Reject day-view proposals crossing midnight | `潘多拉-日程视图.js`、`潘多拉-任务接入.js`、`潘多拉-日历.css`；E05/E06/E03；S权限/草稿/trimStream | 符合（当前执行及所列静态追踪） |
| **Vertical continuous daily-item calendar（规范整体）**<br>`specs/pandora-requirements-aligned-prototype/spec.md:516` | `潘多拉-每日事项.js/.css`；E02/E11；S每月全分页、范围ID合并/锚点 | 纵向七列、补载/完整范围、独立锚点符合；真实触摸边缘衔接未验证V-005 |
| Browse vertically immediately after refresh | `潘多拉-每日事项.js/.css`；E02/E11；S每月全分页、范围ID合并/锚点 | 符合（当前执行及所列静态追踪） |
| Read every range intersection and page | `潘多拉-每日事项.js/.css`；E02/E11；S每月全分页、范围ID合并/锚点 | 符合（当前执行及所列静态追踪） |
| Retain separate calendar anchors | `潘多拉-每日事项.js/.css`；E02/E11；S每月全分页、范围ID合并/锚点 | 符合（当前执行及所列静态追踪） |
| **Daily-item span labels and status（规范整体）**<br>`specs/pandora-requirements-aligned-prototype/spec.md:535` | `潘多拉-每日事项.js/.css`及范围服务；E02/E11；本轮320宽截图 | 名称、完整跨度、三态颜色+文字、溢出及点击入口符合 |
| Change one record's state across every covered date | `潘多拉-每日事项.js/.css`及范围服务；E02/E11；本轮320宽截图 | 符合（当前执行及所列静态追踪） |
| Read long names and dense days without pinch gestures | `潘多拉-每日事项.js/.css`及范围服务；E02/E11；本轮320宽截图 | 符合（当前执行及所列静态追踪） |
| **Append log-day work names in editable Web forms（规范整体）**<br>`specs/pandora-requirements-aligned-prototype/spec.md:548` | 当前工作区JS及fill-source；E07 fill/E11/E13/P2 | 符合；原子追加/旧响应/服务冻结回读，V-002已解决 |
| Append the selected day's complete work to a live draft | `潘多拉-工作区接入.js:325`、`:449`与fill-source；E07 fill/E11/P2；S草稿版本/epoch | 符合（当前执行及所列静态追踪） |
| Keep the draft intact on failure overflow or stale reads | `潘多拉-工作区接入.js:325`、`:449`与fill-source；E07 fill/E11/P2；S草稿版本/epoch | 符合（当前执行及所列静态追踪） |
| Preserve the real freeze boundary | E13/P2；请求途中冻结、过期保存、直接动作均不追加 | 符合；V-002 verified-resolved |
| **Horizontal continuous daily-item calendar（规范整体）**<br>`specs/pandora-requirements-aligned-prototype/spec.md:567` | S当前每日事项布局及E02/E11；旧数据由E02迁移证据覆盖 | 符合：旧横向/唯一数量呈现被替换，未删除事项业务数据 |
| **Daily-item status count markers（规范整体）**<br>`specs/pandora-requirements-aligned-prototype/spec.md:571` | S当前每日事项布局及E02/E11；旧数据由E02迁移证据覆盖 | 符合：旧横向/唯一数量呈现被替换，未删除事项业务数据 |

覆盖清点：17项要求（含2项删除）、109个场景；按上述增量范围复用有效独立证据。

规范补充：保留契约中的公司十条并发/日志唯一和首次slot约束有当前代码及E01证据；未新增真实并发压力测试。两种独立置顶、表单全量排序与本人范围有有效E07证据，当前E03/E11保持集成。手机触摸不能由窄屏尺寸通过推断；环境缺口见V-005。

## Findings

以下V-001–V-004的Evidence/Actual保留首次失败复现，作为已修复缺陷的追溯；当前结论见Repair status及Reverification notes。Repair notes原样保留修复代理交接。V-005仍未解决。

### V-001: 默认演示缺少日内/逾期任务，并为非主角额外填充日志

- Category: implementation
- Severity: high
- Requirement: `Persistent demonstration data for web and administration`规范要求至少当天普通短任务、正常逾期任务，且非主角不专门填充个人日志；场景`Exercise the new Web interactions using real records`、`Preserve edits and keep extreme fixtures separate`；design决策9、tasks 10.3–10.5。
- Evidence: `backend/src/main/java/cn/pandora/seed/DemoSeed.java:156`为四主角之外的`colleague`、`marketing`各创建近三天日志；`:197`基础任务全部跨日且截止为today+3..10；`:281`特殊任务默认today09:00到today+7日18:00。E09实际新空库准备日为2026-11-12，独立只读SQL三次观察一致：58条已发布/当前版本任务中，同日普通定时任务0、准备日之前截止且未完成任务0；四主角各3篇日志，colleague和marketing也各3篇。manifest总任务62包含未发布记录，不将58/62差别误报为丢数据。
- Expected: 默认主线登录即可在本人日轴演示合法短任务拖动，展示正常逾期业务；非主角保留必要组织/协作，不额外填充个人日志。
- Actual: 所有默认定时样本跨天，日轴规则正常拒绝其拖动，无法用默认数据演示本轮关键日内交互；没有正常逾期任务；两名非主角有6篇额外日志。官方79项检查仍PASS，未断言这些要求。
- Repair guidance: 在显式新目标的默认主线中补充有业务意义、真实持久化的当天短任务及正常逾期任务，保留真实流程/约10–20起点/跨月样例；将无关非主角日志移到独立夹具，不让普通重启或重复准备重置已有用户修改。本轮不把个人任务并集21当作约10–20的硬失败。
- Acceptance checks: 新空目标准备后查询下列统计，并用四主角真实日轴/详情确认样例可操作；重复准备/重启保留修改，原E09和隔离极限检查继续通过。
- Repair status: verified-resolved
- Repair notes: 2026-11-12 repair：`DemoSeed.java`仅为四主角填充12篇日志；四人各一条当天90分钟普通短任务、各一条正常未完成逾期任务，其余排期以单日及少量跨日为主。过期提交仍由正常服务拒绝；仅在显式新空目标初始化事务内补历史排期，同步有效/提议版本、审批deadline、提交/决定/派发、审计及事件时间/保留期，已准备目标仍直接返回，不重排已有修改。加强`check_final_demo.py`与`check_demo_roles_browser.js`：`python3 scripts/check_final_demo.py`89/89通过，角色浏览器50/50通过，四人真实日轴均有可用短任务拖动目标、正常逾期详情可读，历史审批/版本一致，重复准备和重启保留业务及管理员修改。后端`mvn -o -q -Dmaven.repo.local=/Users/watuji/MyGitDev/software_test_practice/backend/.runtime/m2 test package`129项通过。全部在`/private/tmp/pwv-kbgdt71x/repo`及其独立MySQL/随机夹具库执行；原库未变，服务已停止。
- Reverification notes: 本轮独立新空库：E09 89/89、角色browser50/50；三次SQL读回同日定时33、逾期未完成4、四主角各3日志且无非主角日志；四人当日日轴真实短任务入口及逾期详情通过，重复准备/重启/修改保留通过。已独立解决。

复现：在独立空演示目标运行原`check_final_demo.py`的准备流程（显式database/marker/initialize），于prepare返回后运行以下只读SQL，随后用四角色正常入口查看。当前关键结果为`0 / 0`和六人各`3`篇：

```sql
SELECT COUNT(*) FROM tasks t JOIN task_versions v ON v.id=t.current_version_id
WHERE v.all_day=FALSE
  AND DATE(v.start_at+INTERVAL 8 HOUR)=DATE(v.due_at+INTERVAL 8 HOUR);
SELECT COUNT(*) FROM tasks t JOIN task_versions v ON v.id=t.current_version_id
JOIN demo_database_identity d ON d.singleton=1
WHERE t.execution_state <> 'done'
  AND v.due_at < d.business_date-INTERVAL 8 HOUR;
SELECT k.seed_key,COUNT(*) FROM work_logs l JOIN demo_seed_keys k
ON k.object_id=l.author_id AND k.object_type='employee'
GROUP BY k.seed_key ORDER BY k.seed_key;
```

### V-002: 已知冻结的日志编辑页仍提供有效追加

- Category: implementation
- Severity: medium
- Requirement: `Append log-day work names in editable Web forms / Preserve the real freeze boundary`；`Personal work logs`前后端只读一致；design决策4、task 3.4。
- Evidence: `潘多拉-工作区接入.js:403`收到`WORK_LOG_FROZEN`后置`d.frozen=true`并重建表单，但`:325`字段组件始终渲染填充按钮；`:449`及回调只验草稿/epoch/日期/请求序号，不验frozen/frozenAt/editable。P2真实浏览器+可控时钟：创建当日日志及事项`Source item`，打开编辑并输入`Preserved unsaved text`；服务时钟推进86401秒，服务GET确认冻结，保存拒绝；再次点击填充，正文变为`Preserved unsaved text\n\n每日事项：\n· Source item`，状态显示“已追加 1 项每日事项、0 项任务；可继续编辑。”。
- Expected: 冻结/只读后没有有效追加能力；迟到填充也不再改变正文，仍保留未保存内容供复制，保存继续拒绝。
- Actual: 界面已明确提示“该日志已满24小时，只能查看”，却仍能追加并告诉用户继续编辑。服务器保存仍拒绝；没有复现持久化冻结绕过。
- Repair guidance: 在按钮、动作与异步响应落地前统一检查真实冻结资格；收到冻结或到达真实边界时使进行中的填充失效。保留用户未保存文本，不延长窗口、不改变关联，也不把合法但超近三日的新建窗口的编辑误禁用。
- Acceptance checks: 在可控时钟真实服务中分别测试打开时只读、旧页跨冻结点、明确WORK_LOG_FROZEN后、填充请求途中冻结；按钮/直接动作/迟到结果均不能追加，文本可复制且过期保存拒绝；合法编辑及创建两处追加/超长/旧响应回归通过。
- Repair status: verified-resolved
- Repair notes: 2026-11-12 repair：`潘多拉-工作区接入.js`统一按钮/动作/落地前冻结资格，编辑填充开始及追加前回读真实日志；真实frozenAt定时禁用，明确WORK_LOG_FROZEN使请求序号失效、正文只读并保留复制内容。新增`backend/scripts/check_web_verification_repairs.py`及浏览器脚本：`python3 scripts/check_web_verification_repairs.py`100/100通过，含合法编辑追加、真实服务时钟推进86401秒使已读取源的进行中填充失效、直接动作不得绕过、过期保存拒绝及只读入口；原四视口`apply_smoke.py`52项通过，创建填充/10000 UTF-16原子溢出仍有效。smoke采用进程环境`PANDORA_HOLIDAY_SOURCE_URL_TEMPLATE=http://127.0.0.1:1/{year}.json`保持缺失年度前提；默认公网异步源运行曾使其缺失年断言不成立，并非日志失败。HTML内容版本已更新，`check_web_resources.py --repo .. --jar target/pandora-backend-0.1.0.jar`15/15通过。检查均在独立临时副本执行，未修改原审计产物。
- Reverification notes: 本轮E13 100项及原P2复测：合法编辑能追加；已读源的请求途中服务时钟+86401秒，迟到结果不追加且正文保留，直接动作禁用、过期保存拒绝；原P2 frozen后before=after=Preserved unsaved text，当前按钮只读。E07 fill74及smoke52支持正常创建/编辑与原子失败。已独立解决。

复现服务使用现有`fixed_model_fixture.Fixture(controllable=True)`：真实登录创始人，POST `/work-logs`和`/daily-items`，浏览器打开该真实logId编辑；管理员POST `/admin/clock/advance`，body `{"seconds":86401}`；GET日志确认frozen后点击保存，再点击“填入当日事项与任务”。这里时钟仅控制隔离测试服务，不修改系统时间或真实演示库。

### V-003: 人员日志临时读取失败被当成失权，无法原地重试

- Category: implementation
- Severity: medium
- Requirement: `Hierarchical subordinate workspace`明确区分失败/重试/失权，保留仍授权内容；`Subordinate calendar month and day views`补载/返回时保留已有授权月份；design决策1/7。
- Evidence: `潘多拉-个人资料.js:564`的`loadStaffLogs`先读取`/me/reports`、人员详情、日志；`:584`对任意非AbortError调用`:590 loseStaffAccess`，清空records/dayRows/logRows和联系方式，设置accessLost。P2先加载合法人员日程（3个月份），只对`Pandora.request('/me/reports')`注入一次普通Error，再切“日志”；页面显示“你已无权查看该人员的日程或日志，请关闭后重新打开。”。恢复原request后切“日程”，月份0且仍只显示失权/关闭，没有重试。服务端组织/权限没有改变。
- Expected: 临时网络/服务失败显示加载失败和可重试，保留此前有权数据/月份/定位；只有确认目录移除、权限响应等真实失权才清除无权正文。
- Actual: 临时失败破坏整个人员工作页状态，误报无权且恢复网络不能原地恢复，需退出重开。真实失权清空本身正确。
- Repair guidance: 区分普通读取失败与权限撤销；普通失败恢复可重试状态并保留仍授权的工作页/联系信息及锚点；真实失权继续清空，不允许快照绕过撤权或旧会话响应串入。
- Acceptance checks: 分别对目录/人员详情/日志查询注入网络错误、500与真实403/人员移除；前者保留已有月份与页签/位置并能重试，后者清空正文；换人/账号和迟到响应、原E03只读/评论测试继续通过。
- Repair status: verified-resolved
- Repair notes: 2026-11-12 repair：`潘多拉-个人资料.js`把普通读取失败与403/404、目录移除、canReadLogs=false区分；前者显示可重试并保留有权月份/记录/定位及资料，重试保留原分页意图；后者清除正文和联系方式、失效日程/日志/清单序号并阻止重新加载旧窗口。新增真实浏览器回归对目录、人员详情、日志查询逐一注入普通网络Error和500，验证原地重试与三个月份保留；逐一403及目录移除验证清空且不得恢复。`python3 scripts/check_web_verification_repairs.py`100/100、`python3 scripts/check_subordinate_workspace.py`89/89通过，包含原嵌套只读/评论/返回边界。HTML哈希及JAR资源15/15通过，全部使用独立临时数据库。
- Reverification notes: 本轮E03 89项、E13及原P2：目录/人员/日志的网络Error、500可原地重试并保留三个月份；403/目录移除清空且不能恢复旧正文；恢复原request后原反例仍有3个月份、无错误失权。已独立解决。

最小注入方法（在人员日程已加载后；仅隔离浏览器）：

```js
const original = Pandora.request;
Pandora.request = function (path, ...args) {
  if (path === '/me/reports') return Promise.reject(new Error('probe temporary network failure'));
  return original.call(this, path, ...args);
};
// 点击该人员“日志”，观察错误；随后还原并切回日程。
Pandora.request = original;
```

### V-004: 加载超过100条通知后，详情刷新使用非法limit并清空列表

- Category: implementation
- Severity: medium
- Requirement: `Notification list presentation and combined filters / Filter across page boundaries`、`Return after opening an unread notification`、`Restore mode filters and position after reading`；design决策8。
- Evidence: `潘多拉-工作区接入.js:642`刷新时`limit=Math.max(NOTICE_PAGE,q.items.length)`，请求前清空items/total；`:781`打开详情后触发`noticeFetch('refresh')`。后端`backend/src/main/java/cn/pandora/workspace/WorkspaceService.java:1498`限定limit为1–100。P3夹具持久化121条合法`account.created`通知及关联domain_events，真实登录/读取六页：`已显示 120 / 121 条 · 全部未读 121 条`。点击第111条并返回，记录到`/notifications?limit=120&offset=0`；后端400“limit 超出允许范围”，界面0条、`已显示 0 / 0 条 · 全部未读 120 条`。
- Expected: 任意已加载页数下，打开详情只标读该条，返回保留类型/已读/模式及有效相邻位置；刷新遵循分页契约，失败不清空仍有效列表。
- Actual: 第六页之后打开详情稳定触发非法请求，原列表和位置丢失；全局已读变化成功，但通知列表恢复失败。原E04数据规模未覆盖此边界。
- Repair guidance: 用合法分页重新获取需要恢复的范围并正确去重/offset，而非将全部已加载数量塞入单次limit；刷新失败保留有效列表及计数/定位，维护查询序号/账号保护与已读过滤移除语义。
- Acceptance checks: 至少121条、先加载120条，在全部/未读、类型组合及两种模式下打开靠后通知并返回；所有limit<=100、列表可继续加载、计数/位置正确；刷新中途失败能重试，切账号/快速切条件不串数据，E04保持通过。
- Repair status: verified-resolved
- Repair notes: 2026-11-12 repair：`潘多拉-工作区接入.js`将刷新原加载范围拆成limit≤100的合法分页，完整成功后原子替换，第二页失败保留原有效列表/计数/位置，并按原refresh模式重试，继续保留查询/账号/序号保护。类型组合验收同时真实复现：无taskId/requestId的合法account.created通知在category=other触发`WorkspaceService.notificationMetadataCategory`的immutable Set.contains(null) NPE；`WorkspaceService.java`补requestId非空门禁，`WorkspaceBatchReadTest.java`新增无申请通知类型筛选回归（真实LEFT JOIN空值语义）。`python3 scripts/check_web_verification_repairs.py`100/100通过：125条合法持久通知，加载120条，在other＋全部/未读及精简/完整四组合打开第111条并返回，合法100＋20/19分页、位置和筛选保留，第二页故障保留120条，重试后可继续读完125条且无重复。`python3 scripts/check_apply_notifications.py`77项通过，后端129项及资源15/15通过。验收在独立临时副本和随机夹具库进行，未放宽后端limit。
- Reverification notes: 本轮E04 77项、E13及独立P3：120条返回120；other+unread+full返回119；第二页失败保留118条，重试恢复118；所有请求limit<=100。125条四组合/位置/继续加载无重复通过；无task/request的account.created在category=other正常返回，review分类及原审核通知回归通过。已独立解决。

复现不依赖特定通知标题：在独立夹具为同一合法收件人准备121条当前可见通知（关联真实domain_events/FK），点击铃铛，连续“加载更多”至120条，打开第111条，返回。请求日志中`limit=120`及服务400足以确认根因，不需要生产账号数据。

### V-005: 缺少真实手机触摸与浏览器能力证据

- Category: environment
- Severity: medium
- Requirement: `Strict prototype scope`要求桌面与手机浏览器验证；`Calendar dragging by presentation / Activate a mobile drag only after a long press`；design决策3/6、task 11.3。
- Evidence: 当前 `audit/align-web-employee-client-with-nov08-guidance/device-touch-limitation.md`明确无实际手机、adb不可用；本轮可调用的浏览器检查仍为桌面Chrome/CDP。E05支持候选取消/500ms激活/浮起/目标/一次haptic调用，但没有真实触摸滚动竞争、物理震动或事项月历边界滚动证据。
- Expected: 在真实手机浏览器验证长按前滑动正常滚动、激活后可靠拖动/取消/无误点击、跨月边缘补载及事项区域与首页滚动衔接，并记录实际浏览器震动支持结果；不支持震动可保留视觉反馈如实通过该能力限制。
- Actual: 尚无实机结果，不能从桌面仿真推出手机滚动接管正确，也不能把navigator.vibrate可调用当成马达震动。没有确认手机实现缺陷。
- Repair guidance: 提供可操作的Android或iOS真实手机浏览器及型号/系统/浏览器版本，完成上述操作并记录结果；若不支持震动，记录限制及视觉反馈。无需新增桥接、APK或套壳，也不要求这些范围外交付。
- Acceptance checks: 实机证据记录设备/版本、长按前滚动/长按激活后拖动/取消/跨月边缘、事项日历边缘衔接、实际震动支持/视觉后备；把证据交给独立verify复核后才能关闭。若手机操作发现缺陷，另立implementation finding。
- Repair status: blocked
- Repair notes: none；当前环境无实机。
- Reverification notes: 首轮独立验证仍无实机证据；自动化重新通过不解除此缺口。

## Next Action

当前可在本环境验证的实现项全部通过，V-005继续blocked。按用户追加授权，提交并推送修复与本次报告；不宣称完整PASS或归档。后续提供真实手机设备/浏览器记录后运行 `$openspec-e13-verify-change align-web-employee-client-with-nov08-guidance` 复核V-005；实现/配置/测试有相关修改时也须重验。恢复Flutter工作时继续按当前主规格协调共享delta。
