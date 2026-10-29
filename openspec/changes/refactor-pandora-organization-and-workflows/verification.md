# Implementation Verification

- Change: refactor-pandora-organization-and-workflows
- Schema: spec-driven
- Verdict: FAIL
- Verified at: 2026-10-29T03:39:58.164088+00:00
- Implementation roots: /Users/watuji/MyGitDev/software_test_practice
- Verified revision: `03ac4fcf4416bd113874e59d03733f7478990de9`; 开始及结束时仅本报告有未提交变更，源文件前后清单及哈希相同。
- Verification scope: 本轮用户授权补齐四组既有证据缺口；父任务及截止竞争通过；时间选择取消与日志无匹配空态发现V-002/V-003；V-001保持verified-resolved。

## Summary

四组既有缺口已补充执行证据，整体结论 **FAIL**，新增两个明确implementation finding：V-002（medium）原生时间下拉打开后按Esc，事件继续触发表单级返回/关闭，丢失草稿；V-003（low）日志层级搜索从有结果变为无匹配时不创建空态提示。V-001负责人默认值修复仍为 `verified-resolved`，本轮没有重新打开该问题。

当前源码JAR、真实MySQL隔离库和Chrome下，GS01补充API检查50/50通过，包括1/6/24层循环拒绝、截止前/恰好截止/截止后九轮审批—撤销—扫描竞争，以及排队等组织锁期间跨截止、错误响应不回滚失效、同键/旧页重试与重复扫描不二次生效、逾期按收件人去重。GS02页面89项断言完成，82通过、7失败：6个创建/编辑/重开×定时/全天准备场景的取消失败归V-002，1个日志动态空态失败归V-003；父任务14项全部通过，其他时间保存/全天切换/倒置校验/原始来源、日志权限/联动/同名及无团队人员/回顶/账号切换通过。GS03另用独立的可见Chrome窗口确认原生下拉在Esc捕获时 `select:open === true`，随后创建表单关闭且草稿清空，排除了仅因无头浏览器没有打开原生菜单而误报V-002的可能。

严格OpenSpec校验通过；274文件manifest与上轮完全相同，前后不变。原89个Maven测试、19组隔离套件和RV修复复验保留为先前独立证据，本轮只补上述缺口，没有重复宣称全量重跑。完整覆盖矩阵按本轮结果更新；此前仅为静态/部分的四组现在有实际通过或明确失败的证据，不再以原四组缺证为由保留BLOCKED。

执行根为源码逐字节相同的临时副本 `/var/folders/4p/qcjpbnz56m15bct40fb6pnn00000gn/T/pandora-v001-reverify-xq21wu5s`，复用RV01生成且源码匹配的JAR。新增探针只在 `/tmp`，真实fixture拥有并清理随机数据库、服务和Chrome进程。普通开发库、业务代码、项目测试、计划、任务勾选、implementation-notes和既有audit均未修改；只更新本报告，V-001 Repair notes原文保留。

## Verification Basis

本轮四组补验基线与上轮修复复验相同；`/tmp/pandora-gap-basis-before.json`及`/tmp/pandora-gap-basis-after.json`逐项相同，274文件manifest仍为`d24681e9bbc2ebb9c63298e47d93d221f3f12198ca3b1eca42d13384e4387a1a`，新增/删除/改变源码0。开始时本报告已有上轮未提交更新；本轮仅继续修改报告。下方原manifest复算命令同样适用。

| Path or scope | Revision / content fingerprint / file inventory |
| ------------- | ---------------------------------------------- |
| 当前项目根/HEAD | `/Users/watuji/MyGitDev/software_test_practice`; `03ac4fcf4416bd113874e59d03733f7478990de9` |
| 当前完整源码清单 | 274文件；SHA-256 manifest `d24681e9bbc2ebb9c63298e47d93d221f3f12198ca3b1eca42d13384e4387a1a`；执行前后完全相同；`/tmp/pandora-reverify-basis-before.json`及`/tmp/pandora-reverify-basis-after.json` |
| 对首轮完整manifest的内容比较 | 仅下列三个文件不同；无增删；proposal/design/tasks/delta spec及implementation-notes均未修改；Git diff额外变动仅历史audit和本报告 |
| `潘多拉-任务接入.js` | `ea0a4d6d3bc31ddcb1a021e5100c939e2355b6a3a541f2122458f926f1f8ecce` |
| `潘多拉-交互原型.html` | `86a64b6a50bd8d08e79455c40777cf14d49c26d0affa32bf5d298822cc788a91` |
| `backend/scripts/check_fixed_employee_browser.js` | `fb671d464374f2fa0b11998198d4b122e08e2bcd6d44f6161031dfad0d18ccb8` |
| 临时副本对应274文件 | 逐文件SHA-256对照当前项目，差异0；仅副本另加两份定向驱动脚本与临时构建/runtime/audit输出 |

以下为首轮历史基线及复算方法，保留供差异与证据来源审计；不是本轮HEAD：

| Path or scope | Revision / content fingerprint / file inventory |
| ------------- | ---------------------------------------------- |
| 原项目完整Git基线 | `1110dc84a16094cf95c2cf779767809ce037f13f`；验证开始/结束相同；未提交实现更改0 |
| 当前规划、代码、测试、配置、文档和文件清单 | 274个文件；SHA-256 manifest `a614f75083c49988bbc83e71c1d6b8a82349b8634ce51b0853c4e1f5a834f93c`；前后完全一致 |
| 临时可执行副本 | 对上列274个文件逐文件SHA-256比较，差异0；Git元数据复制以便历史迁移检查 |
| 规范与计划 | OpenSpec返回的proposal/design/tasks及`specs/pandora-requirements-aligned-prototype/spec.md`全部读取；另读主规格、`acceptance-traceability.md`、更改指导/当前文档和源码 |
| 排除项 | `audit/`（历史证据）、`android/`、`android-shell/`（明确非实现范围）；所有`implementation-notes.md`和`verification.md`（工作流所有）；Git忽略的runtime/target不属于源码基线 |
| Android范围审查 | `git diff 64ea994..HEAD --name-only -- android android-shell`为空；不宣称APK/设备验收 |

快照在源码检查和执行测试前采集；最后复算并对照。文件增删由Git已跟踪+非忽略未跟踪完整清单检测，已跟踪但被删文件记`MISSING`。以下在原项目根执行可精确复算上述manifest（无需临时文件）；输出变动即需重新核对覆盖：

```sh
python3 - <<'SNAPSHOT'
import pathlib, subprocess, hashlib, json
root = pathlib.Path.cwd()
paths = set(subprocess.check_output(['git','ls-files','-c','-o','--exclude-standard','-z']).decode().split('\0')) - {''}
files = {}
for p in sorted(paths):
    if p.startswith(('audit/','android/','android-shell/')) or p.endswith(('/implementation-notes.md','/verification.md')):
        continue
    f = root / p
    files[p] = hashlib.sha256(f.read_bytes()).hexdigest() if f.is_file() else 'MISSING'
basis = {'root':str(root),'revision':subprocess.check_output(['git','rev-parse','HEAD']).decode().strip(),'files':files}
raw = json.dumps(basis,ensure_ascii=False,sort_keys=True,indent=2) + '\n'
print(len(files), hashlib.sha256(raw.encode()).hexdigest())
SNAPSHOT
```

## Apply Handoff Review

四组补验补充处置：当前planning/handoff与上轮内容一致，revision声明仍是历史元数据。按delta日志约束及主规格保留的任务结构/时间/截止场景执行GS01–GS03；对应提醒现在由真实证据覆盖。原native/手势方法限制不泛化为物理设备验收；GS03只新增本机可见Chrome的原生select取消证据。所有既有提醒及先前处置继续保留，未从apply自报PASS推导本轮结论。

以下为前两轮handoff审查记录：

本轮重新读取原implementation-notes及修复者的V-001 Repair notes。handoff的change/schema/root匹配，revision仍为历史元数据，未用其自报结果充当本轮证据；当前HEAD与三文件改动由上表确认。原提醒处置保留如下，均属于首轮执行；修复相关的草稿默认值/移除语义/缓存交付声明由RV01–RV05确认。修复者自报Maven89、整套浏览器128、日历86不继承为本轮执行。

`implementation-notes.md`的change/schema/root与当前选择一致。其HEAD `6a0e3f3... + dirty worktree`属于旧元数据；当前HEAD为`1110dc8...`且已提交，因此不沿用该revision表述。其源码线索与首轮实现相符，所有适用命令在首轮独立重跑。原`final-2026-10-29`证据未作为本次执行结果使用。

| Reminder | 本次处置 |
| --- | --- |
| 必须独立验证，不能继承apply PASS/任务勾选 | 首轮发现V-001；本轮RV02独立重跑修复新增回归段，29/29，V-001 verified-resolved；整体既有证据缺口保留 |
| V25非可无损逆迁移；管理员历史业务冲突不得伪造修复 | C03实际备份/恢复至独立库、结构比较及管理员业务引用阻断通过；文档回退语义核对一致 |
| mapping只发计划，提交须新版本；多管理员不可猜测 | C23只读映射/blockers及C07真实HTTP版本化修复通过；无自动HTTP提交的虚假承诺 |
| 部分手势/Enter使用构造事件，补载错误为monthSection注入 | C16本轮重跑86项；明确保留此方法限制；其他触摸/鼠标/焦点/滚轮由真实CDP输入驱动，不代表物理设备 |
| 返回是页面返回/共享详情栈，未实现浏览器history路由 | delta/design明确的抽屉返回控件、嵌套详情返回与Esc由C16覆盖；没有新增浏览器/Android系统返回验收声明 |
| 180秒fixture改时间；月末单测；冻结用隔离时钟 | C12/C13真实接口/页面179/180秒，C01 EventsRetentionTest月末，C12隔离25h冻结评论；时间fixture不冒充真实等待 |
| 演示日期/稳定seed key；冻结fixture；无永久演示副作用 | C04独立重复准备/重启/13账号、真实编辑保留及integrity通过；首个公司业务日明确，不按任意记录日期猜测 |
| Android未改，后续客户端接入新契约 | I01 Git差异为空；README/API说明严格phone/accountName及破坏性客户端影响一致 |
| MySQL9.3/Flyway支持警告；无8.4/多浏览器/设备声明 | 本次同样使用本机MySQL9.3和Chrome；不扩展验证平台结论 |
| 日历空日异步草稿、pointer清理、全天滚动、inert重同步 | C16当前服务重跑相关路径通过；额外C22发现的是草稿默认负责人的独立缺陷V-001 |

## Checks

本轮补齐缺口的检查（GS编号）：

| ID / command or inspection | Result | Evidence / SHA-256 |
| -------------------------- | ------ | ------------------ |
| GS00: `openspec validate refactor-pandora-organization-and-workflows --type change --strict --json --no-interactive` | valid=true; issues=[]; exit0 | 原项目根，本轮重新执行 |
| GS01: `python3 /private/tmp/pandora_gap_api.py` | 50/50，exit0；父循环及截止API/事务竞争 | `/tmp/pandora-gap-api.json`; `99ec8de92801a2dbf9833c0f6baf98d92aac6d2fac13b02b1e735277b38d21a6`；stdout `/tmp/pandora-gap-api.log`; `3f9bfacd01b4da61128665b5b6c5e24fc8528d673ab796996e3064f25ffe1faa` |
| GS02: `python3 /private/tmp/pandora_gap_browser.py` | 89断言，82通过/7失败，所有8个分组完成，exit1；失败对应V-002×6及V-003×1 | `/tmp/pandora-gap-browser.json`; `69e75b3ebb5e0beb5510384bb8e31c3d384010201aa0175a8f3690abbb539266`；stdout `/tmp/pandora-gap-browser.log`; `a4a212c503ea6f44512cb8d9a81e1ecedb522398219ba0aebb87ae8659f2ac3c` |
| GS03: `PANDORA_GAP_HEADFUL=1 python3 /private/tmp/pandora_gap_native.py` | 探针exit0；对规范比较为FAIL：原生下拉打开时Esc导致overlay=false、draft=false | `/tmp/pandora-gap-native-headed.json`; `bb185088863a40e27a5a5d9dea9869ffcf0df38a5700814b5f504d907f487dac`；stdout `/tmp/pandora-gap-native-headed.log`; `3b43d79fd2679f552ad8ddfe6543a95cc8c2a7cadba677be9738cb8995c8b15a` |
| GS04: 全文件清单/哈希对比、相关源码追踪 | 当前274文件与上轮及执行前后均相同；错误定位到共享Esc处理和动态空态更新 | `/tmp/pandora-gap-basis-before.json`、`/tmp/pandora-gap-basis-after.json`；digest见Verification Basis |
| GS05: 日志空态截图 | 无匹配候选时没有提示；权威完整DOM/状态见GS02 | `/tmp/pandora-gap-log-empty.png`; `6a390870fff8e8ae1a316911f66e050b0c305e3563d05d69ea5ae2b4e4ef4fd6` |

GS01使用Fixture(port18217, worker=true, controllable=true)及服务端固定时刻+合法管理员advance接口，准确覆盖`now==deadline`；九轮三方竞争覆盖截止前/相等/之后各三轮。截止前实际观察到approved及withdrawn，截止相等/之后全部expired；每请求rowVersion只增加一次、终态事件只有一条。另持有真实MySQL组织行锁，先让审批/撤销/扫描/提交排队，再推进11秒并释放锁，确认不能按排队前旧时刻生效。未修改系统时间。

GS02使用Fixture(port18218)；API创建真实13层父任务链、不可见父任务/可见子任务、未发布及跨公司任务、编辑和已完成重开任务；为11名本公司员工通过真实API创建33条近三日日志。仅为同名/无团队搜索设置隔离fixture展示名。每分组用新Chrome进程避免原生菜单阻塞跨用；时分精确值23:41→次日00:07、全天首尾日期、倒置拒绝和创建来源由提交后的实际API核对。键盘输入由CDP真实按键/insertText驱动，390×480视口模拟键盘占用后的可用布局；不宣称物理手机系统键盘或Android验收。

GS02观察到六次Esc退出表单，但无头Chrome不能可靠展示原生菜单，故没有仅凭这些输出确认原生取消缺陷。GS03用Fixture(port18219)及一个独立可见Chrome窗口补证；捕获阶段在小时select上记录`expanded:true`，相同Esc随后进入共享处理，overlay/draft均false。其余无头mouse/touch/AltDown/showPicker探针见`/tmp/pandora-gap-native.json`（`8d2ca2be6552291dcc3c574fc41d6ff8217b56090fcf15f34b7b72731088f312`），只用作诊断，不计额外通过数。

早期驱动准备失败不计验收结果：沙箱localhost连接被拒后获准重跑；首个API驱动误用非本次审核人读取创建申请，改用合法审核人；浏览器首载等待、新原生菜单下截图阻塞及回顶平滑动画等待均在临时驱动中调整。没有改项目代码/测试来消除失败。以上GS01/GS02最终结果及GS03证据才是本轮结论依据。

复现驱动SHA-256：`/tmp/pandora_gap_api.py`=`5a615bcca38b599bc42735c733a05f3bb0d73993be3f60d30c1d7aa3ebb06eac`；`pandora_gap_browser.py`=`72dccd6c14e9399f8a906dde45790c21545125704b8f3f02249a52ef0223b540`；`pandora_gap_browser.js`=`0e5fbb0290a72e5ba62c48d5997cff5565bf126d534993a3e7b67841d9b7f780`；`pandora_gap_native.py`=`76f27b90bebf0191bcf048e0a930a6af1ee455a8078f75167e7c9c44d532720c`；`pandora_gap_native.js`=`22ecd349843b36151a673a41dadccea3a4a9df83a9a3ae307ad1414cf7cfd5fb`。驱动通过`/tmp/pandora-v001-reverify-root`定位逐字节匹配的临时副本，私有runtime凭据不进入报告。`/tmp/pandora_browser_fixture_headed.js`仅从已有browser_fixture去掉`--headless`，其hash为`00f31e036a78f97608abf1c429039fdf880147dedcb48e0f0ba5c39303b02e1f`。

以下RV编号为上一轮修复定向检查，保留独立证据及原执行范围：

本轮修复定向检查（RV编号）；只执行新增V-001段及其必要fixture/login/picker helper，没有重跑原有100项员工检查、管理员套件、日历套件或19组全量流程。后端未改，仅为实际静态资源重新打包，明确跳过Maven单元测试。

| ID / command or inspection | Result | Evidence / SHA-256 |
| -------------------------- | ------ | ------------------ |
| RV00: `openspec validate refactor-pandora-organization-and-workflows --type change --strict --json --no-interactive` | valid=true; issues=[]; exit0 | 当前项目根执行 |
| RV01: `mvn -o -B -ntp -Dmaven.repo.local=.runtime/m2 -DskipTests package` | BUILD SUCCESS; 未执行单元测试 | 临时副本backend/；`/tmp/pandora-v001-reverify-build.log`; `3596407cf7a9c118b8a6cc2102364e5ab924507e1ce0a1215f81f00680eaa6eb` |
| RV02: `python3 backend/scripts/verify_v001_only.py` | PASS; 29/29; 无浏览器异常 | 临时副本；`audit/refactor-pandora-organization-and-workflows/employee-browser.json`; `c1cbef9688492975f4836684fd3d388fb9d6957eb9fe6f2cbcf763dbb7fd1ca6`；stdout `/tmp/pandora-v001-reverify-browser.log`; `a64f4c011facfcc5dd4318983a48baf2f3c351f59fe6e25c4b4a60e97a39afcc` |
| RV03: `python3 backend/scripts/check_web_resources.py --repo . --jar backend/target/pandora-backend-0.1.0.jar --output /tmp/pandora-v001-reverify-resources.json` | 14/14，当前HTML哈希、模块顺序、JAR资源字节一致 | 临时副本；`/tmp/pandora-v001-reverify-resources.json`; `dbfb6e74fcaa470726480f84547262d7062b8d6988ced0240ec97f80acaad754` |
| RV04: `node --check 潘多拉-任务接入.js`; `node --check backend/scripts/check_fixed_employee_browser.js`; 修复三文件`git diff --check 1110dc8 -- ...` | 全部exit0 | 当前项目根执行 |
| RV05: 静态追踪taskDraftFrom/openTaskForm/saveTask/resubmitCreate及前后manifest比较 | 只在mode=create初始化；提交复制当前有序选择，不补本人；编辑/重提走rawFormDraft读取有效版/原提议；HTML版本匹配ea0a4d6d3bc3；验证期间源码无变化 | `任务接入.js:179–202,284–346,616–635`; `交互原型.html:87`; 当前manifest见Verification Basis |

RV02使用已有 `fixed_model_fixture.Fixture(port=18206)`，真实迁移后的随机隔离库、真实手机号登录、真实HTTP与Chrome页面。初次沙箱内因localhost MySQL连接被拒而中止；获准后同一命令重跑退出0，数据库/临时服务已清理。未使用mock替代负责人或审核接口。

定向脚本仅在临时副本生成：保留 `check_fixed_employee_browser.js` 中 `try{` 前的原helper，等待真实登录页，然后拼接 `/* -------- V-001:` 到文件末尾的原新增回归段（包含原finally清理），不执行旧测试段。`verify_v001_only.js` SHA-256为 `71a5c24d5946203d48a86fc30bac7e6ea23622f641e8aef0dfb3a4f8f6855976`；`verify_v001_only.py` 为 `87e89c7cd8a488c91a0bc4defcf8b1b814cf5d4f8b3220ee0586d07de820c922`。Python驱动在Fixture内传入base/identities/database给该Node脚本；使用与项目fixture相同的私有本机runtime配置，不把凭据写入证据。保留的临时脚本可用上表命令直接复跑。

四层真实表单的本轮决定性结果：

| Account position | Expected initial assignees | Observed draft / DOM |
| --- | --- | --- |
| founder | `[]` | `[]`；0 chip；显示“尚未选择负责人” |
| department_head | `[]` | `[]`；0 chip；显示“尚未选择负责人” |
| team_head | `[]` | `[]`；0 chip；显示“尚未选择负责人” |
| employee | `[本人ID]` | `[4ce9a359-10d8-524d-8232-c73416f398d0]`；1 chip；显示本人 |

以下C00–C23及I01为首轮 `1110dc8...` 的历史检查记录（包括修复前C22的失败），本轮不重复执行；不要把历史C22当作当前缺陷。首轮原始方法/结果保留：

全部C02–C19及C23由`python3 backend/scripts/check_final_workflow.py --phase all`顺序调用，`final-all-run.json`记录19/19退出0。首轮cwd为 `/var/folders/4p/qcjpbnz56m15bct40fb6pnn00000gn/T/pandora-independent-verify-p_8_6wca`，C01 cwd为其`backend/`；命令在原项目同样可复跑但会按工具默认路径写audit，所以首轮在副本执行。工具版本为当前项目Java21/Spring Boot3.5.16、本机MySQL9.3、Chrome。Maven离线缓存复用，连接凭据仅复制到私有临时runtime，不写入报告。

初次套件因沙箱禁止本机MySQL连接中止；获准后首组在末尾因临时副本无Git历史中止。补齐相同Git元数据后完整19组从头干净重跑，下面仅计最终成功执行；两次准备失败不算实现缺陷或通过证据。

| ID / command or inspection | Result | Evidence / SHA-256 |
| -------------------------- | ------ | ------------------ |
| C00: `openspec validate refactor-pandora-organization-and-workflows --type change --strict --json --no-interactive` | PASS: valid=true, issues=[], exit0 | 原项目根执行；严格结构校验，不充当实现行为证据 |
| C01: `mvn -o -B -ntp -Dmaven.repo.local=.runtime/m2 test package` | 89 tests; 0 failures/errors/skipped; BUILD SUCCESS | `/tmp/pandora-independent-maven.log`; `45737cafd252961c97a5e629cd6f12afdbee53452666fad452c7890d19323230` |
| C02: `python3 backend/scripts/check_fixed_organization_migration.py` | 51/51 | `/var/folders/4p/qcjpbnz56m15bct40fb6pnn00000gn/T/pandora-independent-verify-p_8_6wca/audit/refactor-pandora-organization-and-workflows/placement-migration.json`; `bd911d72bc8536abe0ae25e7fef316362c8c87b53fa8d0ef81a6533545ee178c` |
| C03: `python3 backend/scripts/check_final_migration.py` | 13/13; packaged Flyway fresh/V20/backup/restore/schema | `/var/folders/4p/qcjpbnz56m15bct40fb6pnn00000gn/T/pandora-independent-verify-p_8_6wca/audit/refactor-pandora-organization-and-workflows/final-migration.json`; `d78ad9afbd82e2ab9b55be44062ca4cf15304029cf1e76d40437de6bef9f7cc2` |
| C04: `python3 backend/scripts/check_final_demo.py` | 54/54 + integrity18/18 | `/var/folders/4p/qcjpbnz56m15bct40fb6pnn00000gn/T/pandora-independent-verify-p_8_6wca/audit/refactor-pandora-organization-and-workflows/final-demo.json`; `acba49fd810652ccdcfc4376fa4f0c53f1bdc8ec636b52403b249d23868a58ce` |
| C05: `python3 backend/scripts/check_login_identity_collision.py` | 74/74 | `/var/folders/4p/qcjpbnz56m15bct40fb6pnn00000gn/T/pandora-independent-verify-p_8_6wca/audit/refactor-pandora-organization-and-workflows/account-contract.json`; `01de9f4196a864aaa075e35d7ab61621d646fcbc33ea2802842bd6e19e8bb55d` |
| C06: `python3 backend/scripts/check_profile_phone_matrix.py` | 32/32 | `/var/folders/4p/qcjpbnz56m15bct40fb6pnn00000gn/T/pandora-independent-verify-p_8_6wca/audit/refactor-pandora-organization-and-workflows/profile-phone-matrix.json`; `4553b0eb4e1024edcc635192e5ea7c34887128e407e35507081f7868d6d9b031` |
| C07: `python3 backend/scripts/check_organization_plans.py` | 30/30 | `/var/folders/4p/qcjpbnz56m15bct40fb6pnn00000gn/T/pandora-independent-verify-p_8_6wca/audit/refactor-pandora-organization-and-workflows/organization-plans.json`; `1aa74e536316b0d90ba4dea88a437529120a3de9c8d50669003c4ab74ffd7d2a` |
| C08: `python3 backend/scripts/check_review_routing.py` | 192/192 | `/var/folders/4p/qcjpbnz56m15bct40fb6pnn00000gn/T/pandora-independent-verify-p_8_6wca/audit/refactor-pandora-organization-and-workflows/review-routing.json`; `3765ec0583140f13abdda164cf3db2a4461a14f45612b0ee3866c8ce80a3e370` |
| C09: `python3 backend/scripts/check_auto_apply_authorization.py` | 18/18 | `/var/folders/4p/qcjpbnz56m15bct40fb6pnn00000gn/T/pandora-independent-verify-p_8_6wca/audit/refactor-pandora-organization-and-workflows/auto-apply-authorization.json`; `0f8ffa1a15a9cd18334275b7e1d27c91253025ea4628ff1ff123319fdc773aad` |
| C10: `python3 backend/scripts/check_business_takeover.py` | 74/74 | `/var/folders/4p/qcjpbnz56m15bct40fb6pnn00000gn/T/pandora-independent-verify-p_8_6wca/audit/refactor-pandora-organization-and-workflows/business-takeover.json`; `adb3d5031569897838f258b1d0a24217af674374614c51a20a2a08a7f6a594e4` |
| C11: `python3 backend/scripts/check_fixed_workspace_access.py` | 62/62 | `/var/folders/4p/qcjpbnz56m15bct40fb6pnn00000gn/T/pandora-independent-verify-p_8_6wca/audit/refactor-pandora-organization-and-workflows/workspace-access.json`; `d2ba4062d7a2b5bc61010a5e4da868ff069007bdd55117bfc33ea06d55b67937` |
| C12: `python3 backend/scripts/check_fixed_notifications.py` | 44/44 | `/var/folders/4p/qcjpbnz56m15bct40fb6pnn00000gn/T/pandora-independent-verify-p_8_6wca/audit/refactor-pandora-organization-and-workflows/fixed-notifications.json`; `b8d4f562089e6a4dbe43972ca2932539beaa62dd034cd82a5c02859735bc3497` |
| C13: `python3 backend/scripts/check_admin_contract.py` | 40/40 API + 43/43 browser | `/var/folders/4p/qcjpbnz56m15bct40fb6pnn00000gn/T/pandora-independent-verify-p_8_6wca/audit/refactor-pandora-organization-and-workflows/admin-contract-check.json`; `c58b39d4daa7abc925954f6c1807edbe11a1cda1f9f7423dbf568194fe304b45` |
| C14: `python3 backend/scripts/check_handover_chain.py` | 23/23 browser | `/var/folders/4p/qcjpbnz56m15bct40fb6pnn00000gn/T/pandora-independent-verify-p_8_6wca/audit/refactor-pandora-organization-and-workflows/handover-chain.json`; `e0791d0cdb8ba71ae6c78288bc89217057679ee3982859c26f0b9403dcdcb799` |
| C15: `python3 backend/scripts/check_fixed_web.py` | 15/15 admin + 100/100 employee + HTTP bytes19/19 | `/var/folders/4p/qcjpbnz56m15bct40fb6pnn00000gn/T/pandora-independent-verify-p_8_6wca/audit/refactor-pandora-organization-and-workflows/employee-browser.json`; `3b4488a71fa27ea822f252c805b3c68f68cacf1b6ad4e177a01ab0348b09cf7b` |
| C16: `python3 backend/scripts/check_calendar_drawer.py` | 86/86 browser | `/var/folders/4p/qcjpbnz56m15bct40fb6pnn00000gn/T/pandora-independent-verify-p_8_6wca/audit/refactor-pandora-organization-and-workflows/calendar-drawer.json`; `58c7cd68909bae390ade2e7ddc8deceb6dd52ae3c901df26b5192e7af28fb5c9` |
| C17: `python3 backend/scripts/check_fixed_late_response.py` | 9/9 browser | `/var/folders/4p/qcjpbnz56m15bct40fb6pnn00000gn/T/pandora-independent-verify-p_8_6wca/audit/refactor-pandora-organization-and-workflows/late-response.json`; `10df36b0f0d2edb266daeae553257db01ab75649998b38dbbaf3915f0e7f480e` |
| C18: `python3 backend/scripts/check_log_backfill_entry.py` | 8/8 browser | `/var/folders/4p/qcjpbnz56m15bct40fb6pnn00000gn/T/pandora-independent-verify-p_8_6wca/audit/refactor-pandora-organization-and-workflows/log-backfill-entry.json`; `7515318d54de871cd91b2ec67dcffb572a166b6f627c6288f62c46c51f110437` |
| C19: `python3 backend/scripts/check_fixed_communication_web.py` | 23/23 browser | `/var/folders/4p/qcjpbnz56m15bct40fb6pnn00000gn/T/pandora-independent-verify-p_8_6wca/audit/refactor-pandora-organization-and-workflows/communication-browser.json`; `c942b875250b986803fa96eb0cd40c8a746c808744d25718805544e288e76efb` |
| C20: `python3 backend/scripts/check_web_resources.py --repo . --jar backend/target/pandora-backend-0.1.0.jar --output /tmp/pandora-independent-web-resources.json` | 14/14 | `/tmp/pandora-independent-web-resources.json`; `4ceba09c98368b1191c7eceffb20020add08794f43e0d571c1dc3cd495a6ea3c` |
| C21: `node backend/scripts/check_calendar_sort.js --output /tmp/pandora-independent-calendar-sort.json` | 4/4 | `/tmp/pandora-independent-calendar-sort.json`; `b5cbe8f1b9ed738ff9286ae45ed2d7d555360a3baf24c5a93dc0f61a0e9db4bb` |
| C22: `四层真实账号 → openTaskForm('create') → 读取 drafts.task.assigneeIds / 实际DOM` | FAIL: employee预期本人，实际[]；其余三层为空符合预期 | `/tmp/pandora-independent-initial-assignees.json`; `a7e73518326295632b1803d946e21d5d95b9413dfca960415c1746ff27b8cb6c` |
| C23: `python3 backend/scripts/check_legacy_mapping.py` | 81/81 | `/var/folders/4p/qcjpbnz56m15bct40fb6pnn00000gn/T/pandora-independent-verify-p_8_6wca/audit/refactor-pandora-organization-and-workflows/legacy-mapping.json`; `3aea1e8bc3d92cf99400cfe7e3a33a7208903b924f380bf5f1f4a637d23f36ee` |
| I01: 当前实现/设计/57项完成任务、退休字段引用、Android范围、资源链及上述快照前后比较 | 见覆盖矩阵；发现V-001；其余无新增确认偏差 | 源码基线同Verification Basis；未凭checkbox证明完成 |

C22决定性输出（退出0表示探针成功运行，不表示断言通过；对规范的比较为3/4符合、1/4失败）：

| Account position | Expected initial assignees | Observed |
| --- | --- | --- |
| founder | `[]` | `[]` |
| department_head | `[]` | `[]` |
| team_head | `[]` | `[]` |
| employee | `[当前员工ID]` | `[]`，实际DOM显示“尚未选择负责人” |

## Requirement Coverage

证据ID见Checks。本轮GS01–GS03补充R10及保留任务结构/时间/截止的四组缺口；R06沿用RV修复复验，其他未变区域保留首轮独立证据，未重新执行。以下每个R行列出实现路径、验收证据和已观察行为；其后的场景行继承相同R的实现路径。`支持`表示相应实现已核查并有列出的当前执行证据支持，不能替代整体PASS；`静态/部分`明确说明未独立执行的细节。重复场景名称按当前WHEN/THEN处理，未按名称恢复旧规则。

| Requirement / scenario | Evidence | Result |
| ---------------------- | -------- | ------ |
| **R01: Four-quadrant dashboard** (`delta:3`) | `WorkspaceService.home/createHomeItem; 工作区接入.js; 界面调整.css`；C11,C13,C15。四象限几何/优先级、个人事项真实ID、十项限制和管理顺序通过；派发时间及十天窗口另核 SQL。 | 支持；见各场景证据范围 |
| R01 / Scroll independent quadrants (`delta:8`) | C11,C13,C15 | 支持 |
| R01 / Rank a newly assigned old task (`delta:12`) | C11,C13,C15 | 支持 |
| R01 / Show concise tasks and read only company information (`delta:16`) | C11,C13,C15 | 支持 |
| R01 / Maintain personal items through detail (`delta:20`) | C11,C13,C15 | 支持 |
| R01 / Use the ten day log window (`delta:24`) | C11,C13,C15 | 支持 |
| R01 / View the four dashboard quadrants (`delta:28`) | C11,C13,C15 | 支持 |
| R01 / Scroll one dashboard quadrant (`delta:32`) | C11,C13,C15 | 支持 |
| R01 / Read an assigned task without clipping (`delta:36`) | C11,C13,C15 | 支持 |
| R01 / Executive maintains company information (`delta:40`) | C11,C13,C15 | 支持 |
| R01 / Reject company information above the limit (`delta:44`) | C11,C13,C15；C13顺序第11项拒绝；并发上限另核Writes公司锁 | 支持 |
| R01 / Edit personal information (`delta:48`) | C11,C13,C15 | 支持 |
| R01 / Reject personal information above the limit (`delta:52`) | C11,C13,C15 | 支持 |
| R01 / Remove duplicate creation and protect priority (`delta:56`) | C11,C13,C15 | 支持 |
| **R02: Calendar task views** (`delta:60`) | `日程视图.js; api.js companyDayStart; 日历.css`；C08,C15,C16,C21。日历全部场景逐一核对；月/日范围、真实几何命中、返回/手势、全天投影及完整分栏通过；重复旧标题按当前 THEN 判定。 | 支持；见各场景证据范围 |
| R02 / Filter the calendar without revoking other access (`delta:77`) | C08,C15,C16,C21 | 支持 |
| R02 / Reach sidebar creation applications and task table (`delta:81`) | C08,C15,C16,C21 | 支持 |
| R02 / Scroll across month and year boundaries (`delta:85`) | C08,C15,C16,C21 | 支持 |
| R02 / Preserve adjustable cells and complete overflow access (`delta:89`) | C08,C15,C16,C21 | 支持 |
| R02 / Show timed cross-day midnight and point tasks (`delta:93`) | C08,C15,C16,C21 | 支持 |
| R02 / Show more than five overlapping and all-day tasks (`delta:97`) | C08,C15,C16,C21 | 支持 |
| R02 / Pin and color without moving time (`delta:101`) | C08,C15,C16,C21 | 支持 |
| R02 / Use the required calendar entry points (`delta:105`) | C08,C15,C16,C21 | 支持 |
| R02 / Read a month and open a complete day list (`delta:109`) | C08,C15,C16,C21 | 支持 |
| R02 / Pin only one's own ordering (`delta:113`) | C08,C15,C16,C21 | 支持 |
| R02 / Split a timed cross day task (`delta:117`) | C08,C15,C16,C21 | 支持 |
| R02 / Display every overlapping and all day task (`delta:121`) | C08,C15,C16,C21 | 支持 |
| R02 / Switch a whole week while preserving weekday (`delta:125`) | C08,C15,C16,C21 | 支持 |
| R02 / Count mutually exclusive relationships (`delta:129`) | C08,C15,C16,C21 | 支持 |
| R02 / Open the default month view (`delta:133`) | C08,C15,C16,C21 | 支持 |
| R02 / Select a year and month (`delta:137`) | C08,C15,C16,C21 | 支持 |
| R02 / Drill from month to week (`delta:141`) | C08,C15,C16,C21 | 支持 |
| R02 / Ignore blank month task space (`delta:145`) | C08,C15,C16,C21 | 支持 |
| R02 / Drill from week to day (`delta:149`) | C08,C15,C16,C21 | 支持 |
| R02 / Ignore blank week task space (`delta:153`) | C08,C15,C16,C21 | 支持 |
| R02 / Switch time granularity (`delta:157`) | C08,C15,C16,C21 | 支持 |
| R02 / Keep task clicks distinct from drill-down (`delta:161`) | C08,C15,C16,C21 | 支持 |
| R02 / Navigate and return from a week (`delta:165`) | C08,C15,C16,C21 | 支持 |
| R02 / Navigate and return from a day (`delta:169`) | C08,C15,C16,C21 | 支持 |
| R02 / Render a spanning task bar (`delta:173`) | C08,C15,C16,C21 | 支持 |
| R02 / Render an all-day task (`delta:177`) | C08,C15,C16,C21 | 支持 |
| R02 / Distinguish visible tasks (`delta:181`) | C08,C15,C16,C21 | 支持 |
| R02 / Identify the current user's task relationship (`delta:185`) | C08,C15,C16,C21 | 支持 |
| R02 / Show only task names in bars (`delta:189`) | C08,C15,C16,C21 | 支持 |
| R02 / Order visible task lanes (`delta:193`) | C08,C15,C16,C21 | 支持 |
| R02 / Fill five monthly task rows (`delta:197`) | C08,C15,C16,C21 | 支持 |
| R02 / Handle crowded time slots (`delta:201`) | C08,C15,C16,C21 | 支持 |
| R02 / Open overflow tasks for one date (`delta:205`) | C08,C15,C16,C21 | 支持 |
| R02 / Preserve calendar navigation after table return (`delta:209`) | C08,C15,C16,C21 | 支持 |
| R02 / Overlay a narrow accessible schedule drawer (`delta:213`) | C08,C15,C16,C21 | 支持 |
| R02 / Open a sheet from every part of a monthly date (`delta:217`) | C08,C15,C16,C21 | 支持 |
| R02 / Return through nested detail and dismiss without losing context (`delta:221`) | C08,C15,C16,C21 | 支持 |
| R02 / Classify full-day coverage without changing schedules (`delta:225`) | C08,C15,C16,C21 | 支持 |
| **R03: Authorized task table page** (`delta:229`) | `任务表单.js/css; TaskService.list/detail`；C08,C15。109项/三页、有效版/冻结、固定名称列、筛选分页及详情返回通过；受限父任务裁剪另核 TaskService.snapshotView。 | 支持；见各场景证据范围 |
| R03 / Browse the authorized spreadsheet on a narrow screen (`delta:236`) | C08,C15 | 支持 |
| R03 / Inspect effective data while review is pending (`delta:240`) | C08,C15 | 支持 |
| R03 / Open detail and return without losing context (`delta:244`) | C08,C15 | 支持 |
| R03 / Prioritize mobile columns without changing the data pipeline (`delta:248`) | C08,C15 | 支持 |
| R03 / Simplify visible copy while retaining spreadsheet operations (`delta:252`) | C08,C15 | 支持 |
| **R04: Global task table sorting and counts** (`delta:256`) | `任务表单.js; TaskService.list`；C15。六列全局升降序/稳定ID/第三页及组合筛选、跨日去重通过；待完成/逾期按有效状态核实现。 | 支持；见各场景证据范围 |
| R04 / Sort all filtered rows before paging (`delta:261`) | C15 | 支持 |
| R04 / Count overlapping relationships without duplicate totals (`delta:265`) | C15 | 支持 |
| R04 / Recompute counts after all filters (`delta:269`) | C15 | 支持 |
| R04 / Separate pending completion done and overdue (`delta:273`) | C15 | 支持 |
| **R05: Role-scoped visibility** (`delta:277`) | `Access; CompanyTree; TaskService; WorkspaceService`；C06,C07,C08,C11,C17。两部门多团队、本人跨范围关系、下属层级、隐私及撤权/旧重放矩阵通过。 | 支持；见各场景证据范围 |
| R05 / Read a task crossing departments (`delta:282`) | C06,C07,C08,C11,C17 | 支持 |
| R05 / Separate direct reports from teammates (`delta:286`) | C06,C07,C08,C11,C17 | 支持 |
| R05 / Deny unauthorized detail and privacy leakage (`delta:290`) | C06,C07,C08,C11,C17 | 支持 |
| R05 / Compare role visibility (`delta:294`) | C06,C07,C08,C11,C17 | 支持 |
| R05 / Prevent unauthorized detail access (`delta:298`) | C06,C07,C08,C11,C17 | 支持 |
| R05 / Retain own cross-scope tasks and deny teammate access (`delta:302`) | C06,C07,C08,C11,C17 | 支持 |
| R05 / Revoke management access after an atomic move (`delta:306`) | C06,C07,C08,C11,C17 | 支持 |
| **R06: Role-scoped task creation and assignment** (`delta:310`) | `Access.creationCandidates; TaskService.create; 任务接入.js taskDraftFrom; 交互原型.js:1711`；首轮C05,C08及本轮RV02,RV05。四角色真实表单默认值、移除/换序/取消、空列表及实际审核路线均通过；未发布隔离及其他候选边界沿用首轮证据。 | V-001已验证解决；其余沿用首轮 |
| R06 / Assign across departments and upward (`delta:315`) | C05,C08,C22 | 支持 |
| R06 / Remove the creator and preserve selection order (`delta:319`) | 首轮C05,C08；本轮RV02,RV05 | PASS（修复范围）：默认本人/其余为空，移除、换序、取消及实际提交通过；V-001 verified-resolved |
| R06 / Keep dispatch separate from unrelated access (`delta:323`) | C05,C08,C22 | 支持 |
| R06 / Isolate an unpublished creation (`delta:327`) | C05,C08,C22 | 支持 |
| R06 / Select and order authorized assignees (`delta:331`) | 首轮C05,C08；本轮RV02,RV05 | PASS（修复范围）：默认本人/其余为空，移除、换序、取消及实际提交通过；V-001 verified-resolved |
| R06 / Enforce dispatch independently from viewing (`delta:335`) | C05,C08,C22 | 支持 |
| R06 / Executive selects assignees across departments (`delta:339`) | C05,C08,C22 | 支持 |
| R06 / Manager assigns a departmental task (`delta:343`) | C05,C08,C22 | 支持 |
| R06 / Cancel assignee selection (`delta:347`) | 首轮C05,C08；本轮RV02,RV05 | PASS（修复范围）：默认本人/其余为空，移除、换序、取消及实际提交通过；V-001 verified-resolved |
| R06 / Search for an unavailable assignee (`delta:351`) | C05,C08,C22 | 支持 |
| R06 / Employee submits a self-created task (`delta:355`) | 首轮C05,C08；本轮RV02,RV05 | PASS（修复范围）：默认本人/其余为空，移除、换序、取消及实际提交通过；V-001 verified-resolved |
| R06 / Superior reviews a self-created task (`delta:359`) | C05,C08,C22 | 支持 |
| R06 / Select company members during a later owner change (`delta:363`) | C05,C08,C22 | 支持 |
| **R07: Task editing and completion review** (`delta:367`) | `TaskService.change/submit/decide/validateApplicationEffect; 任务接入.js`；C08,C09,C10,C14,C15。操作身份、直接生效/有效版/唯一待审、重开换负责人/轮次、diff及历史通过；具体截止竞争的证据范围见保留行为补充。 | 支持；见各场景证据范围 |
| R07 / Freeze and cancel an application (`delta:372`) | C08,C09,C10,C14,C15 | 支持 |
| R07 / Restrict comparison data to the reviewer (`delta:376`) | C08,C09,C10,C14,C15 | 支持 |
| R07 / Distinguish completion outcomes (`delta:380`) | C08,C09,C10,C14,C15 | 支持 |
| R07 / Reopen with a new schedule (`delta:384`) | C08,C09,C10,C14,C15 | 支持 |
| R07 / Assignee updates progress (`delta:388`) | C08,C09,C10,C14,C15 | 支持 |
| R07 / Show status without numeric progress (`delta:392`) | C08,C09,C10,C14,C15 | 支持 |
| R07 / Creator approves completion (`delta:396`) | C08,C09,C10,C14,C15 | 支持 |
| R07 / Superior rejects completion (`delta:400`) | C08,C09,C10,C14,C15 | 支持 |
| R07 / Render authorized field-by-field differences in saved order (`delta:404`) | C08,C09,C10,C14,C15 | 支持 |
| R07 / Reopen an overdue completed task from the web form (`delta:408`) | C08,C09,C10,C14,C15 | 支持 |
| R07 / Resubmit an expired creation as a new request (`delta:412`) | C08,C09,C10,C14,C15 | 支持 |
| R07 / Validate a direct application as strictly as a reviewed change (`delta:416`) | C08,C09,C10,C14,C15 | 支持 |
| **R08: Required notifications** (`delta:420`) | `TaskService.recipients; Events; EventsWorker; ReminderService; WorkspaceService.safeNotification`；C08,C10,C12,C19。真实worker提交/结果/接管/提醒矩阵、请求绑定、去重及撤权裁剪通过；通知用途渲染核前端。 | 支持；见各场景证据范围 |
| R08 / Deliver the submission and result matrix (`delta:427`) | C08,C10,C12,C19 | 支持 |
| R08 / Summarize multiple changes and preserve removed recipients (`delta:431`) | C08,C10,C12,C19 | 支持 |
| R08 / Use actual events without synthetic urgency (`delta:435`) | C08,C10,C12,C19 | 支持 |
| R08 / Inspect task change notification coverage (`delta:439`) | C08,C10,C12,C19 | 支持 |
| R08 / Notify on task creation (`delta:443`) | C08,C10,C12,C19 | 支持 |
| R08 / Surface due and emergency notices (`delta:447`) | C08,C10,C12,C19 | 支持 |
| R08 / Notify people affected by assignment changes (`delta:451`) | C08,C10,C12,C19 | 支持 |
| R08 / Surface review and consultation requests (`delta:455`) | C08,C10,C12,C19 | 支持 |
| R08 / Represent urgent work without a synthetic title (`delta:459`) | C08,C10,C12,C19 | 支持 |
| R08 / Understand the event without opening its detail (`delta:463`) | C08,C10,C12,C19 | 支持 |
| R08 / Notify the current business owner after takeover (`delta:467`) | C08,C10,C12,C19 | 支持 |
| **R09: Personal work logs** (`delta:471`) | `WorkspaceService.createLog/changeLog/deleteLog/log; 工作区接入.js`；C11,C12,C15,C18。真实新建/补写/编辑/同日冲突/删除重建/25h冻结、上级只读及目标人员入口通过。 | 支持；见各场景证据范围 |
| R09 / Backfill three dates with a full window (`delta:480`) | C11,C12,C15,C18 | 支持 |
| R09 / Freeze after twenty-four hours instead of midnight (`delta:484`) | C11,C12,C15,C18 | 支持 |
| R09 / Preserve the daily slot under concurrency and deletion (`delta:488`) | C11,C12,C15,C18 | 支持 |
| R09 / Preserve full-screen editing and independent links (`delta:492`) | C11,C12,C15,C18 | 支持 |
| R09 / Write and edit a log in a full-screen sheet (`delta:496`) | C11,C12,C15,C18 | 支持 |
| R09 / Enforce one log under concurrent distinct keys (`delta:500`) | C11,C12,C15,C18 | 支持 |
| R09 / Freeze across the midnight boundary (`delta:504`) | C11,C12,C15,C18 | 支持 |
| R09 / Link, clear or redact tasks independently (`delta:508`) | C11,C12,C15,C18 | 支持 |
| R09 / Search and link a visible task (`delta:512`) | C11,C12,C15,C18 | 支持 |
| R09 / Clear a linked task (`delta:516`) | C11,C12,C15,C18 | 支持 |
| R09 / Show no matching linked tasks (`delta:520`) | C11,C12,C15,C18 | 支持 |
| R09 / Write an unlinked log (`delta:524`) | C11,C12,C15,C18 | 支持 |
| R09 / Superior reads a subordinate log (`delta:528`) | C11,C12,C15,C18 | 支持 |
| R09 / Regress actual log entry and the selected editor (`delta:532`) | C11,C12,C15,C18 | 支持 |
| **R10: Log page single-content filtering and scroll return** (`delta:536`) | `WorkspaceService.logs/logAuthors; 工作区接入.js`；C11,C15,C17,C18；本轮GS02。真实层级联动、同名及无团队搜索、授权计数、回顶和账号隔离通过；从有候选搜索到无匹配时空态缺失。 | FAIL V-003 |
| R10 / Search each hierarchy within authorization (`delta:543`) | C11,C15,C17,C18；GS02 | 支持：本轮真实页面补验通过；明确无匹配空态另见V-003 |
| R10 / Reset invalid children and restore self (`delta:547`) | C11,C15,C17,C18；GS02 | 支持：本轮真实页面补验通过；明确无匹配空态另见V-003 |
| R10 / Use consistent names and the selected log date (`delta:551`) | C11,C15,C17,C18 | 支持 |
| R10 / Enter with self and filter a direct report (`delta:555`) | C11,C15,C17,C18；GS02 | 支持：本轮真实页面补验通过；明确无匹配空态另见V-003 |
| R10 / Return to the top without mixing workflows (`delta:559`) | C11,C15,C17,C18；GS02 | 支持：本轮真实页面补验通过；明确无匹配空态另见V-003 |
| R10 / Enter the log page (`delta:563`) | C11,C15,C17,C18 | 支持 |
| R10 / Select pending reviews (`delta:567`) | C11,C15,C17,C18 | 支持 |
| R10 / Switch between role-specific content filters (`delta:571`) | C11,C15,C17,C18；GS02 | 支持：本轮真实页面补验通过；明确无匹配空态另见V-003 |
| R10 / Invoke a log-page command (`delta:575`) | C11,C15,C17,C18 | 支持 |
| R10 / Toggle own logs (`delta:579`) | C11,C15,C17,C18；GS02 | 支持：本轮真实页面补验通过；明确无匹配空态另见V-003 |
| R10 / Restore the visible log scope (`delta:583`) | C11,C15,C17,C18；GS02 | 支持：本轮真实页面补验通过；明确无匹配空态另见V-003 |
| R10 / Search logs by author (`delta:587`) | C11,C15,C17,C18；GS02 | 支持：本轮真实页面补验通过；明确无匹配空态另见V-003 |
| R10 / Show no matching authors (`delta:591`) | C11,C15,C17,C18；GS02 | FAIL V-003：真实搜索无匹配后缺少明确空态 |
| R10 / Keep log finding separate and scoped (`delta:595`) | C11,C15,C17,C18；GS02 | 支持：本轮真实页面补验通过；明确无匹配空态另见V-003 |
| R10 / Return to the top of log content (`delta:599`) | C11,C15,C17,C18；GS02 | 支持：本轮真实页面补验通过；明确无匹配空态另见V-003 |
| R10 / Reset old filters when opening logs from a person profile (`delta:603`) | C11,C15,C17,C18 | 支持 |
| **R11: Role-scoped AI map** (`delta:607`) | `WorkspaceService.statistics/createAiJob/aiJob/visibleTasks; WorkspaceAnalysisTest`；C01,C11。四层真实任务统计范围与建议分离、旧分析失权通过；真实中文提词/规则指标由单测和实现核查支持。 | 支持；见各场景证据范围 |
| R11 / Generate personal and department results separately (`delta:610`) | C01,C11 | 支持 |
| R11 / Extract new words and required metrics (`delta:614`) | C01,C11 | 支持 |
| R11 / Refresh suggestions and deny stale details (`delta:618`) | C01,C11 | 支持 |
| R11 / View employee AI map (`delta:622`) | C01,C11 | 支持 |
| R11 / View executive AI map (`delta:626`) | C01,C11 | 支持 |
| R11 / Scope team analytics independently from personal suggestions (`delta:630`) | C01,C11 | 支持 |
| **R12: Minimal profile page** (`delta:634`) | `ProfileService; WorkspaceService.person/reports; 个人资料.js`；C01,C06,C11,C15。四层字段/只读身份/间接下属、手机号及本人邮箱/头像维护规则通过；密码入口另由账号套件覆盖。 | 支持；见各场景证据范围 |
| R12 / Read and edit the required profile (`delta:639`) | C01,C06,C11,C15 | 支持 |
| R12 / Open a subordinate within both profile scope and the management chain (`delta:643`) | C01,C06,C11,C15 | 支持 |
| R12 / View profile (`delta:647`) | C01,C06,C11,C15 | 支持 |
| R12 / Keep identity fields read-only to employees (`delta:651`) | C01,C06,C11,C15 | 支持 |
| **R13: Strict prototype scope** (`delta:655`) | `proposal/design; README; Maven资源白名单; current-checks.md`；C01,C03,C04,C13–C20,I01。真实构建服务和认证验收；五页/二级页可见；Android自提案基线无变更；未声明系统推送/真机/新APK。 | 支持；见各场景证据范围 |
| R13 / Validate against the selected checklist (`delta:662`) | C01,C03,C04,C13–C20,I01 | 支持 |
| R13 / Keep native Android outside the change (`delta:666`) | C01,C03,C04,C13–C20,I01 | 支持 |
| R13 / Validate the real service and declared scope (`delta:670`) | C01,C03,C04,C13–C20,I01 | 支持 |
| R13 / Inspect available actions (`delta:674`) | C01,C03,C04,C13–C20,I01 | 支持 |
| R13 / Open the split static prototype (`delta:678`) | C01,C03,C04,C13–C20,I01 | 支持 |
| **R14: Organization and administration** (`delta:682`) | `OrganizationPlans; OrganizationConstraints; CompanyTree; OrganizationService; admin.html`；C02,C03,C07,C13,C14,C15。完整最终状态、合法首位负责人、换岗/继任/删除/回滚/并发、职位仅展示、退休接口及管理页面通过。 | 支持；见各场景证据范围 |
| R14 / Maintain an employee through the administrator interface (`delta:691`) | C02,C03,C07,C13,C14,C15 | 支持 |
| R14 / Maintain teams independently of departments (`delta:695`) | C02,C03,C07,C13,C14,C15 | 支持 |
| R14 / Transfer updates independent scopes (`delta:699`) | C02,C03,C07,C13,C14,C15 | 支持 |
| R14 / Maintain and reorder company information (`delta:703`) | C02,C03,C07,C13,C14,C15 | 支持 |
| R14 / Use the independent PC administration interface (`delta:707`) | C02,C03,C07,C13,C14,C15 | 支持 |
| R14 / Manage teams from a restricted employee web entry (`delta:711`) | C02,C03,C07,C13,C14,C15 | 支持 |
| R14 / Manage notifications in the formal PC console (`delta:715`) | C02,C03,C07,C13,C14,C15 | 支持 |
| R14 / Keep the founder fixed and positions independent of titles (`delta:719`) | C02,C03,C07,C13,C14,C15 | 支持 |
| **R15: Account password lifecycle** (`delta:723`) | `AuthService/AuthFilter; LoginKeyConstraints; ProfileService; OrganizationService; admin.html`；C01,C03,C05,C06,C13,C15。严格类型命名空间、歧义/旧载荷拒绝、改号会话撤销/稳定ID、密码门禁/一次性凭据及私密字段通过。 | 支持；见各场景证据范围 |
| R15 / Initial login cannot enter business pages (`delta:732`) | C01,C03,C05,C06,C13,C15 | 支持 |
| R15 / Password validation and reset (`delta:736`) | C01,C03,C05,C06,C13,C15 | 支持 |
| R15 / Edit contacts without exposing another employee phone (`delta:740`) | C01,C03,C05,C06,C13,C15 | 支持 |
| R15 / Read phones only through authorized person details (`delta:744`) | C01,C03,C05,C06,C13,C15 | 支持 |
| R15 / Recheck the management chain after an organization change (`delta:748`) | C01,C03,C05,C06,C13,C15 | 支持 |
| R15 / Authenticate the original employee by phone after migration (`delta:752`) | C01,C03,C05,C06,C13,C15 | 支持 |
| R15 / Do not publish phone identifiers as usernames (`delta:756`) | C01,C03,C05,C06,C13,C15 | 支持 |
| R15 / Use the new phone contract and isolate administrator credentials (`delta:760`) | C01,C03,C05,C06,C13,C15 | 支持 |
| R15 / Reject duplicate phones and preserve administrator repair access (`delta:764`) | C01,C03,C05,C06,C13,C15 | 支持 |
| R15 / Remove employee username without breaking internal references (`delta:768`) | C01,C03,C05,C06,C13,C15 | 支持 |
| R15 / Let only administrators change employee identity (`delta:772`) | C01,C03,C05,C06,C13,C15 | 支持 |
| **R16: Ordered reviewer routing and reassignment** (`delta:776`) | `TaskService.creationRoute/route/currentRoute/refreshPendingRoutes`；C01,C07,C08,C09,C10。创建仅直属/固定创始人，非创建仅当前责任方；顺序无影响、阻断/重算/过期/旧按钮拒绝及单终态通过。 | 支持；见各场景证据范围 |
| R16 / Preview all creator-based routes (`delta:785`) | C01,C07,C08,C09,C10 | 支持 |
| R16 / Block an unavailable configured manager (`delta:789`) | C01,C07,C08,C09,C10 | 支持 |
| R16 / Revalidate after an organization change (`delta:793`) | C01,C07,C08,C09,C10 | 支持 |
| R16 / Preserve ordered non-creation routes (`delta:797`) | C01,C07,C08,C09,C10 | 支持 |
| R16 / Require explicit non-creation self-review (`delta:801`) | C01,C07,C08,C09,C10 | 支持 |
| R16 / Persist order and route the first highest peer (`delta:805`) | C01,C07,C08,C09,C10 | 支持 |
| R16 / Review one's own application explicitly (`delta:809`) | C01,C07,C08,C09,C10 | 支持 |
| R16 / Change assignees using the proposed route (`delta:813`) | C01,C07,C08,C09,C10 | 支持 |
| R16 / Fall back or apply with a documented reason (`delta:817`) | C01,C07,C08,C09,C10 | 支持 |
| R16 / Reassign after organization changes (`delta:821`) | C01,C07,C08,C09,C10 | 支持 |
| **R17: Dedicated task handover** (`delta:825`) | `Access.canHandover/canBeHandoverTarget; TaskService.handover/preset; 任务接入.js`；C08,C10,C14。直属代办与间接只读分离、工作圈接收/夹带字段拒绝、审批/接管/停用连续浏览器链通过。 | 支持；见各场景证据范围 |
| R17 / A direct manager hands over a subordinate task (`delta:830`) | C08,C10,C14 | 支持 |
| R17 / Handover approval preserves provenance (`delta:834`) | C08,C10,C14 | 支持 |
| R17 / Distinguish direct manager handover from indirect management (`delta:838`) | C08,C10,C14 | 支持 |
| **R18: Complete task operation history** (`delta:842`) | `TaskService.taskHistory/recordHistory; BusinessTakeovers; admin.html`；C03,C08,C10,C12,C13,C14。顺序/字段前后值、路由变动、接管办理人/原因、原始来源和通知清理后的管理历史通过。 | 支持；见各场景证据范围 |
| R18 / Inspect an ordered assignee change and reassignment (`delta:847`) | C03,C08,C10,C12,C13,C14 | 支持 |
| R18 / Retain history after message removal (`delta:851`) | C03,C08,C10,C12,C13,C14 | 支持 |
| R18 / Locate a task in the formal PC history interface (`delta:855`) | C03,C08,C10,C12,C13,C14 | 支持 |
| R18 / Trace takeover and direct application without rewriting provenance (`delta:859`) | C03,C08,C10,C12,C13,C14 | 支持 |
| **R19: Shared single-select tags for tasks and logs** (`delta:863`) | `Tags; TaskService.validateForm; WorkspaceService; 标签评论.js`；C12,C16,C19。固定创始人维护、跨公司/多选拒绝、改名改色/逻辑删除、冻结规则及日历颜色通过。 | 支持；见各场景证据范围 |
| R19 / Enforce root-only maintenance and single selection (`delta:868`) | C12,C16,C19 | 支持 |
| R19 / Rename recolor and delete a referenced tag (`delta:872`) | C12,C16,C19 | 支持 |
| R19 / Respect review freezing and calendar color (`delta:876`) | C12,C16,C19 | 支持 |
| **R20: Notification lifecycle and historical access** (`delta:880`) | `Events; WorkspaceService.safeNotification/notificationTask/withdrawEvent; 工作区接入.js`；C01,C08,C12,C13,C19。原申请绑定、严格180秒/月末保留期、撤回上级例外、评论裁剪及普通任务历史只读通过；无页脚与焦点核当前UI。 | 支持；见各场景证据范围 |
| R20 / Close a notification list without footer actions (`delta:891`) | C01,C08,C12,C13,C19 | 支持 |
| R20 / Open an old review notification (`delta:895`) | C01,C08,C12,C13,C19 | 支持 |
| R20 / Enforce withdrawal and calendar month boundaries (`delta:899`) | C01,C08,C12,C13,C19 | 支持 |
| R20 / Distinguish hide and withdraw (`delta:903`) | C01,C08,C12,C13,C19 | 支持 |
| R20 / Retain access solely through a delivered notification (`delta:907`) | C01,C08,C12,C13,C19 | 支持 |
| R20 / End the exception and block undelivered access (`delta:911`) | C01,C08,C12,C13,C19 | 支持 |
| R20 / Preserve restricted manager access to withdrawn summaries (`delta:915`) | C01,C08,C12,C13,C19 | 支持 |
| R20 / Never revive inaccessible comments through old notifications (`delta:919`) | C01,C08,C12,C13,C19 | 支持 |
| **R21: Flat comments with author control and targeted notifications** (`delta:923`) | `CommentService; WorkspaceService.canReadTaskForComments; 标签评论.js`；C01,C12,C19。任务待审/冻结日志独立评论、作者专有修改、目标收件去重、删除游标稳定及失权/缺失裁剪通过。 | 支持；见各场景证据范围 |
| R21 / Comment while business fields are read-only (`delta:932`) | C01,C12,C19 | 支持 |
| R21 / Manage only one's own flat comments (`delta:936`) | C01,C12,C19 | 支持 |
| R21 / Deliver only the targeted new-comment notification (`delta:940`) | C01,C12,C19 | 支持 |
| R21 / Page comments in stable publication order (`delta:944`) | C01,C12,C19 | 支持 |
| R21 / Preserve comment redaction under new organization scopes (`delta:948`) | C01,C12,C19 | 支持 |
| **R22: Persistent demonstration data for web and administration** (`delta:952`) | `DemoSeed; prepare_demo.py; V26; start.sh`；C04,C13,C14。目标/marker防护、重复准备/重启/真实编辑保留、13真实身份及组织/任务/日志/标签通知/144任务场景通过。 | 支持；见各场景证据范围 |
| R22 / Run a continuous demo after refresh (`delta:959`) | C04,C13,C14 | 支持 |
| R22 / Prepare a complete repeatable new-model demonstration (`delta:963`) | C04,C13,C14 | 支持 |
| **R23: Atomic employee deactivation and formal business takeover** (`delta:969`) | `EmployeeDeactivations; BusinessTakeovers; OrganizationPlans; TaskService`；C07,C08,C10,C14,C15。完整停用/岗位/未发布处置、唯一业务责任/来源、会话撤销/回滚/并发及接管重开通过。 | 支持；见各场景证据范围 |
| R23 / Reopen taken-over completed work with active assignees (`delta:976`) | C07,C08,C10,C14,C15 | 支持 |
| R23 / Deactivate an employee only after all responsibilities are arranged (`delta:980`) | C07,C08,C10,C14,C15 | 支持 |
| R23 / Take over published work without impersonating its creator (`delta:984`) | C07,C08,C10,C14,C15 | 支持 |
| R23 / Refresh valid reviews and revoke old authority atomically (`delta:988`) | C07,C08,C10,C14,C15 | 支持 |
| **R24: Convergent organization and identity schema upgrades** (`delta:992`) | `V21–V26; migration_precheck.py; flyway_migrate.py; OrganizationConstraints`；C02,C03。空库/V20升级结构一致、真实备份恢复、稳定ID/文本/凭据/管理员审计保留、历史迁移校验和及非法映射阻断通过。 | 支持；见各场景证据范围 |
| R24 / Compare fresh installation with an upgraded database (`delta:997`) | C02,C03 | 支持 |
| R24 / Block an unresolvable mapping without fabricating identity (`delta:1001`) | C02,C03 | 支持 |
| **主规格未修改要求：以下32个场景同时检查不冲突保留行为** | 当前main spec与delta共同判定 | 不沿用旧审核/账号/组织规则 |
| **Retained: Five-page navigation** (`main:9`) | `交互原型.html; api.js; task form return stack`；C15,C17 | 支持 |
| Five-page navigation / Navigate with an authenticated identity (`main:12`) | C15,C17 | 支持 |
| Five-page navigation / Navigate across the prototype (`main:16`) | C15,C17 | 支持 |
| Five-page navigation / Enter the task table as a secondary view (`main:20`) | C15,C17 | 支持 |
| **Retained: Combined task table filters and search** (`main:243`) | `任务表单.js; TaskService.list/scheduleDate`；C15 | 支持；公司时区/错误范围另核过滤实现 |
| Combined task table filters and search / Find a task created and assigned to oneself (`main:248`) | C15 | 支持；公司时区/错误范围另核过滤实现 |
| Combined task table filters and search / Apply relation completion title and date together (`main:252`) | C15 | 支持；公司时区/错误范围另核过滤实现 |
| Combined task table filters and search / Search beyond the first API page (`main:256`) | C15 | 支持；公司时区/错误范围另核过滤实现 |
| Combined task table filters and search / Use company dates independently of device timezone (`main:260`) | C15 | 支持；公司时区/错误范围另核过滤实现 |
| **Retained: Task table refresh and account isolation** (`main:285`) | `任务表单.js; api.js epoch fencing`；C08,C15,C17 | 支持 |
| Task table refresh and account isolation / Apply effective assignee changes (`main:290`) | C08,C15,C17 | 支持 |
| Task table refresh and account isolation / Revoke all normal access (`main:294`) | C08,C15,C17 | 支持 |
| Task table refresh and account isolation / Fail a later page and retry (`main:298`) | C08,C15,C17 | 支持 |
| Task table refresh and account isolation / Ignore stale account and refresh responses (`main:302`) | C08,C15,C17 | 支持 |
| **Retained: Task structure and attributes** (`main:382`) | `TaskService.validateForm/validateParent; 任务接入.js; 正式版.css`；C01,C08,C09,C14,C15,C22 | FAIL V-002（时间取消）；其余见GS01/GS02及既有证据 |
| Task structure and attributes / Edit task text in expanded fields (`main:387`) | C01,C08,C09,C14,C15,C22 | 支持（部分细节见场景行） |
| Task structure and attributes / Validate schedules and preserve provenance (`main:391`) | C01,C08,C09,C14,C15,C22 | 支持（部分细节见场景行） |
| Task structure and attributes / Search, clear or reject a parent relation (`main:395`) | C01,C08,C09,C14,C15,C22；GS01,GS02 | 支持：本轮搜索/空态/确认取消/持久化清除、深环拒绝、父子独立执行和独立授权已执行；普通类型由六组API快照确认 |
| Task structure and attributes / Keep parents independently executable (`main:399`) | C01,C08,C09,C14,C15,C22；GS01,GS02 | 支持：本轮搜索/空态/确认取消/持久化清除、深环拒绝、父子独立执行和独立授权已执行；普通类型由六组API快照确认 |
| Task structure and attributes / Create a timed task (`main:403`) | C01,C08,C09,C14,C15,C22 | 支持（部分细节见场景行） |
| Task structure and attributes / Create an all-day task (`main:407`) | C01,C08,C09,C14,C15,C22 | 支持（部分细节见场景行） |
| Task structure and attributes / Reject an inverted task range (`main:411`) | C01,C08,C09,C14,C15,C22 | 支持（部分细节见场景行） |
| Task structure and attributes / Preserve task creation time (`main:415`) | C01,C08,C09,C14,C15,C22 | 支持（部分细节见场景行） |
| Task structure and attributes / Search and select a parent task (`main:419`) | C01,C08,C09,C14,C15,C22；GS01,GS02 | 支持：本轮搜索/空态/确认取消/持久化清除、深环拒绝、父子独立执行和独立授权已执行；普通类型由六组API快照确认 |
| Task structure and attributes / Show no matching parent tasks (`main:423`) | C01,C08,C09,C14,C15,C22；GS01,GS02 | 支持：本轮搜索/空态/确认取消/持久化清除、深环拒绝、父子独立执行和独立授权已执行；普通类型由六组API快照确认 |
| Task structure and attributes / Inspect a child task (`main:427`) | C01,C08,C09,C14,C15,C22；GS01,GS02 | 支持：本轮搜索/空态/确认取消/持久化清除、深环拒绝、父子独立执行和独立授权已执行；普通类型由六组API快照确认 |
| Task structure and attributes / Inspect a parent task (`main:431`) | C01,C08,C09,C14,C15,C22；GS01,GS02 | 支持：本轮搜索/空态/确认取消/持久化清除、深环拒绝、父子独立执行和独立授权已执行；普通类型由六组API快照确认 |
| Task structure and attributes / Inspect an abstract task (`main:435`) | C01,C08,C09,C14,C15,C22；GS01,GS02 | 支持：本轮搜索/空态/确认取消/持久化清除、深环拒绝、父子独立执行和独立授权已执行；普通类型由六组API快照确认 |
| Task structure and attributes / Choose time through a mobile web control (`main:439`) | C01,C08,C09,C14,C15,C22；GS02,GS03 | FAIL V-002：取消原生时分下拉丢失表单草稿；其余六组时值/全天/校验/保存检查通过 |
| **Retained: Deadline expiration of pending applications** (`main:848`) | `ExpiryService; TaskController.expireBeforeSubmit; TaskService.decide`；C08,C09,C10；GS01 | 支持：本轮补齐三方九轮竞争、精确截止及锁等待跨截止、持久终态/有效版隔离、重复扫描及重试证据 |
| Deadline expiration of pending applications / Reject expired submission and approval before the scan (`main:851`) | C08,C09,C10；GS01 | 支持：本轮补齐三方九轮竞争、精确截止及锁等待跨截止、持久终态/有效版隔离、重复扫描及重试证据 |
| Deadline expiration of pending applications / Use the applicable deadline and preserve the effective version (`main:855`) | C08,C09,C10；GS01 | 支持：本轮补齐三方九轮竞争、精确截止及锁等待跨截止、持久终态/有效版隔离、重复扫描及重试证据 |
| Deadline expiration of pending applications / Expire and backfill overdue once (`main:859`) | C08,C09,C10；GS01 | 支持：本轮补齐三方九轮竞争、精确截止及锁等待跨截止、持久终态/有效版隔离、重复扫描及重试证据 |
| Deadline expiration of pending applications / Resolve the deadline race once (`main:863`) | C08,C09,C10；GS01 | 支持：本轮补齐三方九轮竞争、精确截止及锁等待跨截止、持久终态/有效版隔离、重复扫描及重试证据 |
| **Retained: Proportional schedule reminders** (`main:867`) | `ReminderService.chooseNode; TaskService.applyVersion; EventsWorker`；C01,C08 | 支持；比例节点单测及真实worker轮次/排期去重 |
| Proportional schedule reminders / Remind a ten hour task (`main:870`) | C01,C08 | 支持；比例节点单测及真实worker轮次/排期去重 |
| Proportional schedule reminders / Skip stale nodes after a late scan (`main:874`) | C01,C08 | 支持；比例节点单测及真实worker轮次/排期去重 |
| Proportional schedule reminders / Reset the schedule identity and handle zero duration (`main:878`) | C01,C08 | 支持；比例节点单测及真实worker轮次/排期去重 |

四组原证据缺口现已由GS01–GS03补验，父关联及截止竞争支持规范，时间取消与日志动态空态分别确认V-002/V-003；整体FAIL。无需要planning决定的规格矛盾，亦无仍阻止这些检查执行的environment问题。无头/键盘占位及物理平台边界如Checks所述保留，不冒充物理设备验收。

Proposal/design/完成任务补充核对：位置为唯一组织事实、固定创始人、共同principal与员工专用FK分离、当前唯一业务责任/原始来源、公司锁原子最终计划、严格登录契约、退休旧授权/username、非破坏显式演示、资源最终覆盖顺序、文档和Android范围分别由R05/R14/R15/R16/R23/R24及I01覆盖。57个完成checkbox只作待验证声明；创建UI的完成声明首轮被V-001推翻，本轮RV02确认该缺陷已修复。无独立发现的额外范围承诺缺失。

## Findings

### V-001: 普通员工创建任务未默认选中本人

- Category: implementation
- Severity: medium
- Requirement: delta `Role-scoped task creation and assignment`（约第310行）；`Remove the creator and preserve selection order`、`Select and order authorized assignees`、`Cancel assignee selection`、`Employee submits a self-created task`明确普通员工初始负责人为本人，其他三层初始为空；本人可以移除且不能被自动补回。
- Evidence: 以下为首轮修复前证据，历史失败保留；本轮当前证据见RV02/RV05。`潘多拉-交互原型.js:1711`仍使用`a.role === "lower" ? [a.id] : []`；当前`潘多拉-api.js:245`映射真实身份为`employee`；`潘多拉-任务接入.js:176`的最终`taskDraftFrom`调用原草稿但未纠正负责人默认值，`:277`创建入口直接使用该结果。C22用当前JAR、独立MySQL、四种真实账号及Chrome打开实际表单：founder/department_head/team_head均`[]`，普通员工`actor().role === "employee"`且`drafts.task.assigneeIds === []`，DOM“尚未选择负责人”。普通员工稳定ID`4ce9a359-10d8-524d-8232-c73416f398d0`，预期`[该ID]`。原始首轮结构证据见Checks C22及其SHA-256。
- Expected: 普通员工每次打开新建表单，初始有且仅有本人；其他三层为空。之后手工删除本人、另选和取消选择仍保持用户决定，不自动加回；提交仍要求至少一位有效员工。
- Actual: 修复后，employee初始仅本人，其他三层为空；后续移除/换序/取消不补回，空列表拒绝，合法实际提交路线正确（RV02，29/29）。首轮修复前：四层一律初始为空；普通员工必须额外手工选择自己，未选择则提交被“至少选择一位负责人”拒绝。直接API套件总是显式提供assigneeIds，故现有19组全部通过仍漏检该UI默认值。
- Repair guidance: 在实际生效的草稿初始化链按当前固定位置设置新建默认值，并保持后续用户移除/取消/有序多选语义；同步实际HTML缓存版本和打包资源检查。不要通过提交时强行补回本人绕过此问题。
- Acceptance checks: 当前源码重新构建JAR，用四种真实账号从日程加号打开创建；观察`actor().role`和`drafts.task.assigneeIds`/页面。断言employee初始为本人，founder/department_head/team_head为空；移除本人并选择其他部门员工、换序、打开选择器后取消，确认顺序与移除结果保留；空列表提交拒绝；合法提交按创建者直属上级/固定创始人规则办理。重跑`check_fixed_web.py`及`check_web_resources.py`并独立复验。
- Repair status: verified-resolved
- Repair notes: 在生效的草稿初始化链`潘多拉-任务接入.js`的`window.taskDraftFrom`中新增`creationDefaultAssignees()`：仅`create`模式按当前固定位置设置初始负责人，`employee`为`[本人ID]`，founder/department_head/team_head为`[]`；编辑/重提仍读取有效版或原提议，后续移除、取消和有序多选只由用户草稿决定，渲染与提交均不补回本人。同步更新`潘多拉-交互原型.html`中该脚本的内容哈希缓存版本为`ea0a4d6d3bc3`。在`backend/scripts/check_fixed_employee_browser.js`新增V-001回归段：经日程加号对founder/alpha-head/alpha-two-head/alpha-one-employee四个真实账号断言`actor().role`、`drafts.task.assigneeIds`与DOM；覆盖员工移除本人后跨部门选人、换序、取消还原、空列表提交拒绝、创建预览与实际申请均路由创建人直属上级，以及固定创始人初始为空、直接生效并留`direct`免审原因。修复前以同一隔离fixture复现employee`[]`，修复后为`["4ce9a359-10d8-524d-8232-c73416f398d0"]`。检查结果：`mvn -o -B -ntp -Dmaven.repo.local=.runtime/m2 test package`89 tests/0 failure；重建JAR后`python3 backend/scripts/check_fixed_web.py`PASS（admin-browser 15/15、employee-browser 128/128、served resources 19/19）；`python3 backend/scripts/check_web_resources.py --repo . --jar backend/target/pandora-backend-0.1.0.jar`14/14；`python3 backend/scripts/check_calendar_drawer.py`86/86；`openspec validate refactor-pandora-organization-and-workflows --type change --strict`valid=true。套件按默认路径更新了`audit/refactor-pandora-organization-and-workflows/`下的浏览器/资源证据（快照基线本就排除`audit/`）。未改proposal/specs/design/tasks/任务勾选或本报告结论。
- Reverification notes: 上轮修复定向复验（下述BLOCKED为当时结论，本轮四组补验已由V-002/V-003确认偏差，V-001仍resolved）：2026-10-29，HEAD `03ac4fc...`。按用户限定只复核修复三文件，以新建隔离库、当前源码新构建JAR及真实Chrome独立执行新增V-001段，29/29通过；四角色draft/DOM、用户后续选择语义及真实创建审核均符合预期，资源14/14和严格校验通过。默认值仅初始化create；编辑/重提路径静态确认不受影响。V-001 verified-resolved；原C22失败保留为修复前历史，不再作为pending缺陷。原要求整套check_fixed_web的复跑按用户范围缩减为其新增修复段及必要setup。整体仍因首轮既有非修复证据缺口BLOCKED。

复现探针无需修改代码：在隔离fixture或显式已准备的演示服务中，以普通员工手机号登录员工Web，点击日程加号；浏览器控制台运行：

```js
({ role: actor().role, id: actor().id, initialAssignees: drafts.task.assigneeIds,
   text: document.getElementById('sheetBody').textContent })
// 首轮修复前：role:'employee', initialAssignees:[]，DOM显示“尚未选择负责人”。
// 本轮实测及预期：initialAssignees:[actor().id]，页面显示一个本人chip。
```

### V-002: 取消原生时分下拉触发表单返回并丢失草稿

- Category: implementation
- Severity: medium
- Requirement: 保留主规格 `Task structure and attributes / Choose time through a mobile web control`（main:439）；选时取消 SHALL 保留草稿且不误提交，适用于创建、编辑、重开非全天任务。
- Evidence: GS02六个创建/编辑/重开×后续定时/全天准备场景中，小时select聚焦后Esc均退出当前表单；创建时`draftPresent=false`且overlay隐藏，编辑/重开回到详情、时间字段消失。由于无头浏览器菜单表现不可靠，追加GS03真实可见Chrome：手机号登录founder→实际创建表单→输入未保存标题→原生鼠标点击小时下拉箭头→Esc；捕获阶段事件target为`tf-start-time-hour`且`expanded:true`（真实`select:open`），随后`overlay:false`、`draft:false`，原始证据及hash见Checks。
- Expected: 已打开的时间下拉取消时只取消本次选择，仍停留原任务表单，保留先前日期、时分和其他草稿字段，不提交申请。
- Actual: 同一次Esc同时进入`潘多拉-交互原型.js:2744–2748`的共享处理，不区分原生下拉取消，调用backSheet/closeSheet；`:1485–1494`随之清理草稿。真实菜单仍打开时的取消直接丢失创建草稿。编辑/重开相同共享路径也被GS02观察为退出当前表单。
- Repair guidance: 让原生时分选择的取消优先在控件内结束，保留所在任务草稿；保持其他弹层既有返回/关闭语义。同步实际HTML缓存版本和打包资源，不通过误提交或自动保存绕过取消。
- Acceptance checks: 用实际构建JAR与可见Chrome，在创建、编辑、重开表单分别修改标题/说明/原因、日期及精确时分；确认原生下拉已打开，取消后仍是同一表单且所有值保留、无新申请；继续定时跨日/全天切换、倒置拒绝和真实保存。`PANDORA_GAP_HEADFUL=1 python3 /private/tmp/pandora_gap_native.py`可复现原生取消；扩展该同等探针覆盖修复后的三种表单，再跑相关资源检查。
- Repair status: addressed-awaiting-verification
- Repair notes: 在`潘多拉-交互原型.js`共享`document keydown`的Esc分支前增加判断：事件目标或当前焦点位于`[data-time-part]`（`Pandora.timeControl`生成的时分select）时直接返回，不`preventDefault`、不调用`backSheet/closeSheet`，把取消交给原生下拉并保留任务草稿；其他元素与弹层的Esc返回语义不变。同步`潘多拉-交互原型.html`中该脚本缓存版本为`4f6d5ebc7711`。在`backend/scripts/check_fixed_employee_browser.js`新增回归：聚焦`tf-start-time-hour`后按Esc断言表单仍开、`drafts.task`及标题保留、时间仍`09:00`；焦点移到说明后按Esc仍关闭表单。验证用当前源码重建JAR，并把修复同步到验证者临时副本后运行其驱动的同名副本：`python3 /tmp/pandora_fix2_browser.py`（`/private/tmp/pandora_gap_browser.py`的路径适配版，断言不变）89/89 PASS，六个create/edit/reopen×timed/all-day取消场景全部通过；`PANDORA_GAP_HEADFUL=1 python3 /tmp/pandora_fix2_native.py`在真实可见Chrome下仍观察到`select:open=true`，Esc后`overlay=true`、`draft=true`且标题保留；`python3 backend/scripts/check_fixed_web.py`PASS（admin 15/15、employee 132/132）；`python3 backend/scripts/check_calendar_drawer.py`86/86；`mvn -o -B -ntp -Dmaven.repo.local=.runtime/m2 test package`89 tests/0 failure；`check_web_resources.py`14/14；`openspec validate ... --strict`valid=true。
- Reverification notes: 2026-10-29新增；不是V-001回归。原先无头模拟的疑问已通过GS03真实原生下拉`expanded:true`消除；未声明手机/WebView物理设备行为。

### V-003: 日志动态搜索无匹配时缺少明确空态

- Category: implementation
- Severity: low
- Requirement: delta `Log page single-content filtering and scroll return`（delta:536）及`Show no matching authors`（delta:591）：逐层名称搜索没有授权匹配人员时 SHALL 显示明确空态并保留有效输入。
- Evidence: GS02真实founder日志页，初始部门/团队/作者候选均非空；选择alpha部门和无团队负责人后，依次输入`no-such-department`、`no-such-team`、`no-such-person`。三层候选都只剩“全部”默认项，搜索输入完整保留，但`#logFindingCard .empty`不存在，页面没有“当前权限内没有匹配的部门或人员”提示。GS02 JSON保存完整DOM文本/选项/状态；GS05截图，重复隔离运行一致。
- Expected: 从有匹配动态变为没有授权匹配时，立即显示明确空态，保留输入；恢复匹配后空态正确消失，候选继续受权限裁剪，不错误更改已选作者或日志正文范围。
- Actual: `潘多拉-工作区接入.js:200`仅在首次渲染恰好无匹配时插入`.empty`；`:203–220`输入后刷新只尝试切换已存在元素的hidden，初始有候选时没有节点可更新，因此动态无匹配没有提示。
- Repair guidance: 使动态候选刷新能够创建/更新/清除空态，与初始渲染保持一致；保留当前合法选择、输入、权限和计数语义。
- Acceptance checks: 在真实服务日志页从有候选输入无匹配部门/团队/姓名（包括全部层均无匹配），断言明确可见空态及输入保留；清除搜索恢复候选和提示状态；重新检查同名/无团队选择、联动清理、回顶保留及账号重置。GS02的`all hierarchy searches retain their values and show an explicit no-match state`应通过。
- Repair status: addressed-awaiting-verification
- Repair notes: 将`潘多拉-工作区接入.js`的`refreshLogFindingOptions`从“仅切换已存在空态”改为：筛选卡内没有`.empty`时创建与初始渲染同文案的节点，再按`departments.length>0||people.length>0`设置`hidden`；保留输入值、已选作者、权限裁剪与计数逻辑。同步`潘多拉-交互原型.html`中该脚本缓存版本为`648d4afc4e2d`。在`backend/scripts/check_fixed_employee_browser.js`的founder日志页新增回归：三层输入无匹配值后断言`.empty`可见且文案含“没有匹配”、输入与仅“全部”的候选保留；清空搜索后空态隐藏且候选恢复。验证：`python3 /tmp/pandora_fix2_browser.py`（验证者GS02驱动路径适配版）89/89 PASS，含`all hierarchy searches retain their values and show an explicit no-match state`；`python3 backend/scripts/check_fixed_web.py`PASS（admin 15/15、employee 132/132）；`python3 backend/scripts/check_log_backfill_entry.py`8/8；`check_web_resources.py`14/14；`mvn ... test package`89 tests/0 failure；严格OpenSpec校验valid=true。
- Reverification notes: 2026-10-29新增；其余日志联动、当前权限/计数、33条真实日志、回顶动画完成后状态保留及账号切换均已通过，不把准备阶段过早读取平滑滚动位置的驱动失败算作实现问题。

下一步：`$openspec-e13-fix-change refactor-pandora-organization-and-workflows`，仅修复pending的V-002/V-003，再独立复验受影响行为。当前FAIL不可归档；V-001修复已确认，无需无依据地重新打开；相关源码修改需重新核对基线与覆盖。
