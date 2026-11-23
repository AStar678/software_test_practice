# 测试报告

[打开Jupyter报告](测试报告.ipynb) · [阅读HTML报告](测试报告.html) · [安装与运行说明](运行说明.md) · [依赖清单](requirements.txt)

被测目标：`https://8.141.96.122:6644/api/v1`。

## 目标与范围

根据用户确认，选择有明确输入边界的17个核心方法。每个方法至少3个用例，至少包含1个正常输入、1个合法边界输入、1个异常输入；本版实际126例，正常19例、边界44例、异常63例，三类全部执行并通过。

经HTTP验证Service入口，是黑盒/集成测试，不是Java私有方法单元测试，不宣称项目全部方法已覆盖。实际范围为AuthService.login、DailyItemService的list/summary/create/change/delete、WorkspaceService的users/logs/notifications/adminTeams/audit/adminNotifications、TaskService的list/table/adminTasks/assigneeCandidates/approvals。WorkspaceService.users另测管理员分支。无业务输入、已退役、需要真实组织或账号变更的正向操作不强行凑三类，

## 用例设计方法

先划分有效与无效等价类：正确整数、非整数、超范围整数、合法/非法字符串、正确/错误JSON类型、有效/错误凭据、匹配/陈旧/缺失版本。再从输入域选取内部代表值、精确下界、精确上界和首次越界：limit20、1/100、0/101；offset最大2147483647及2147483648；正文20、1/2000、0/2001码点；含首尾日期30、1/93、0/94天；候选检索10、0/100、101字符。

登录的合法边界是原始identifier恰好80字符（69个可去除空格+11位有效手机号），81首次越界，不能误称80位手机号码。删除的边界是对象生命周期初始行版本1，正常例先更新至版本2，异常用例用0或缺版本。正常与合法边界都预期200；异常按400/401/412/428等明确拒绝，不把负例当正常或边界成功。

每个方法有功能说明、输入域与源码位置、用例设计表、可编辑代码、实际测试过程、完整原始数据、三类覆盖统计及一段结论分析。

## 测试过程

隐藏读取六个员工和独立管理员密码，健康预检只连接6644并校验证书、拒绝重定向；准备7个共享会话。按方法即时生成当前单元格的pytest源码并执行，逐例断言HTTP状态和业务读回/不变性。成功创建事项立即登记ID，方法结束按拥有者和当前版本清理。每个方法按实际pytest参数检查三类均已执行且通过。最后退出7个共享会话，并生成总表和真实截图。

本次共216次真实HTTP请求。只创建本次个人事项，不改现有任务/组织/账号或密码。密码和令牌脱敏，业务响应完整保留并默认折叠；结果摘要、三类表与分析保持展开。审计/幂等历史可能保留。

## 实际结论

17个方法，126 passed，0 failed，0 skipped，整体PASS。17/17方法的正常、边界、异常三类均达标。新建15条个人事项已全部清理，未决项为空，7个共享会话退出均200。登录专项额外成功签发的会话在各用例finally中立即退出，不混入共享会话计数。

已采集6644真实JVM代码覆盖率：全体cn.pandora应用类的行覆盖1561/5645（27.65%），分支覆盖1088/4634（23.48%）。JaCoCo截图是实际代码覆盖率报告；另有pytest三类用例执行截图。部署类文件直接来自云端实际JAR，未使用本地其他版本类文件。此次PASS仅覆盖所列方法、输入类和断言，不能证明全部分支或负载能力。

证据：`runs/matrix6644-20261120-001908-614fac`。根目录的两个CSV分别给出逐方法达标表和126条设计/结果。

## 复现

在VS Code打开此目录，选择上级`notebooks/backend/.venv/bin/python`内核（本机已安装），打开`测试报告.ipynb`，重启内核并运行全部。独立解压环境可运行`bash 启动Jupyter.sh`安装requirements.txt并打开JupyterLab；无需JDK、MySQL或本地后端。生成器需要原仓库来核对源码位置，直接运行Notebook只需本目录文件。

隐藏输入员工应用密码和管理员应用密码；管理员留空沿用员工密码，管理员账号名默认admin，可用PANDORA_CLOUD_ADMIN_NAME覆盖。自动执行可临时设置PANDORA_CLOUD_PASSWORD与PANDORA_CLOUD_ADMIN_PASSWORD；不要将密码写入代码格。不存在的07/08已排除。

每次从新内核完整运行产生独立runs目录。同一次RUN目录存在则拒绝覆盖，不混用旧结果。需要浏览器仅用于渲染静态测试报告截图，本机使用Edge；其他系统可在环境中执行`python -m playwright install chromium`。若手动中断或网络超时，先按每方法created-items.json及write-intents.json核查清理，不按日期或通配符删除数据。

## 真实覆盖率采集与复现

Notebook隐藏读取PANDORA_SSH_PASSWORD或SSH密码输入；用于临时给pandora-web-version.service加载JaCoCo0.8.13，仅监听127.0.0.1:6300。会短暂重启6644实例，启动就绪后reset，测试结束dump，使用同一部署JAR的cn.pandora类生成HTML/XML/CSV及17个入口方法精确签名表，随后恢复原启动配置并重启确认健康。SSH凭据不落盘，使用本机已有known_hosts并拒绝未知主机密钥。首次连接请先用常规SSH核实服务器身份。

若SSH输入留空，本轮仅测试接口并明确标未采集，不复用旧报告。生成新报告无需本机JDK，Java报告在服务器运行。覆盖率采集窗口可能包含后台任务或其他请求，不能将所有探针严格归因于pytest；不混入启动阶段、本地JUnit或历史exec。入口方法表不含其下游私有方法，整体报告包含全部cn.pandora类；N/A表示方法没有分支。

官方选项依据：[JaCoCo Agent](https://www.jacoco.org/jacoco/trunk/doc/agent.html)与[JaCoCo CLI](https://www.jacoco.org/jacoco/trunk/doc/cli.html)。每次证据目录下coverage含cloud.exec、classes、html/index.html、jacoco.xml/csv、报告日志、provenance.json与实际截图。
