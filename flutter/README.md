# 潘多拉 Flutter 员工端

原生 Flutter Android 客户端，业务、信息层级及操作顺序按当前员工 Web。首页、公司日程、日志、统计、我的及其二级流程共用真实 `/api/v1`，不包含移动管理员或运行时假后端。

## 环境与离线构建

锁定 Flutter **3.47.9 stable / Dart 3.13.7**（`.fvmrc`、`pubspec.lock`），JDK **21**、Gradle **9.3.1**；最低 API **26**，compile/target **36**。本机 SDK `/opt/homebrew/share/android-commandlinetools`。

**热点协作时不下载大文件。** 使用者已准备构建缓存，课程构建只用已有缓存，关闭 Gradle 联网和 SDK 自动下载：

```sh
cd flutter
./tool/build_demo.sh
```

输出 `build/app/outputs/flutter-apk/app-debug.apk`，默认连 `https://8.141.96.122:6644/api/v1`，显式使用 6644 端口，ARM64 Android 运行库。默认参数 `PANDORA_DEMO_TARGET_PLATFORMS=android-arm64`；其他架构须先由使用者在合适网络准备依赖。本次只验收已有的 `employee_api36` ARM64 模拟器，不用为其他版本下载镜像。

如果离线构建提示缺依赖，保存报错，交给使用者切换网络单独准备；不要自动改成联网构建，也不要清除现有缓存。首次其他机器准备 Flutter、pub、Android/Gradle依赖需自行下载，按锁文件使用，不计入热点操作。

## 本地后端与安装

在仓库 `backend/` 使用保留模式：

```sh
./scripts/start-demo.sh --keep
```

连接本机 MySQL 13306 的 `pandora_demo`，保留已有修改。**不要省略 `--keep`，裸命令会重建演示数据。** 无需重编译已有 JAR 时可设置 `PANDORA_SKIP_BUILD=1`。宿主机 API 是 `http://127.0.0.1:8080/api/v1`。账号见 [backend README](../backend/README.md)，演示密码由服务配置，未内置客户端。

使用本机后端联调时需显式覆盖地址：模拟器构建设置 `PANDORA_DEMO_API_URL=http://10.0.2.2:8080/api/v1`；真机需使用手机可访问的本机地址。未覆盖时仍连接上述 6644 服务器。

启动已有 AVD 后安装（`adb` 不在 PATH 时使用 SDK/platform-tools/adb）：

```sh
adb -s emulator-5554 install -r build/app/outputs/flutter-apk/app-debug.apk
adb -s emulator-5554 shell am start -n cn.pandora.employee.flutter.debug/cn.pandora.employee.flutter.MainActivity
```

包名 **cn.pandora.employee.flutter.debug**，版本 **1.0.0-dev / code 1**，自动 debug 签名，与旧包独立，首次安装须重新登录。`install -r` 同签名升级保留本包数据；签名冲突时先备份需要的信息再卸载本包重装（卸载会清除本机登录和偏好，服务端数据不删）。回退可安装保存的同签名旧 APK；不保证跨数据结构降级，必要时退出后重装。

## 后续服务器与手机展示

这是课程演示包，支持显式 **HTTP**，不要求服务器证书。由使用者/组员部署后端、开放实际端口并检查手机到服务器的网络，再替换地址离线构建：

```sh
PANDORA_DEMO_API_URL=http://服务器IP:8080/api/v1 ./tool/build_demo.sh
```

把“服务器IP”替换为实际 IP 或域名。手机不能用 `localhost`、`127.0.0.1` 或模拟器专用 `10.0.2.2` 访问远端服务器。地址必须含 `/api/v1`，不能含账号密码、查询或片段。相同参数同时进入 Dart 和生成的 Android 网络配置，只对选定 HTTP 主机放行；HTTPS 继续采用系统证书校验。构建时已用文档示例 IP `192.0.2.10` 验证配置和离线构建，**没有把它当成真实服务器连通结果**。替换后用新 APK 在手机安装、登录。

无法连接时依次检查服务 `/health`、API路径/端口、服务器防火墙及手机网络；确认 APK 构建地址正确。断网启动会要求联网重试，不显示旧敏感内容。可重新登录排除已撤销会话。

服务器部署、远程连通、手机/厂商实测、第二 Android 版本、真实振感、专用 release 签名、HTTPS及生产运维演练由使用者/组员在后续展示阶段负责，未实测且不阻塞本 change。可选 `tool/build_release.sh` 保留仓库外密钥与 HTTPS 要求，不是本次演示入口，勿覆盖已有私钥。

## 检查与证据

在真实本地演示服务运行时，从 `flutter/` 执行：

```sh
flutter analyze --no-pub
flutter test --no-pub --reporter expanded
python3 tool/check_managed_backend.py
node tool/check_web_parity.cjs
python3 tool/check_demo_readback.py
```

完整测试 **196 项通过**，含宿主机真实演示 API **29 项（无跳过）**；另有临时隔离 MySQL/JAR 上的 Flutter 管理联调 **5 项通过**。管理脚本只创建/清理自己的随机库，依赖本机既有 MySQL/JAR，不重置演示库。普通真实 API 测试会创建/清理测试记录、回读并恢复事件纪；目标必须为隔离演示库，无后端时明确跳过，不能算验收通过。宿主机 API 测试与模拟器 UI 分层取证。

模拟器复现步骤见 [native-acceptance.md](tool/native-acceptance.md)；模块和 J01–J32 证据、最终 APK 哈希见 [implementation notes](../openspec/changes/build-flutter-employee-android-client/implementation-notes.md) 及 [验收索引](../openspec/changes/build-flutter-employee-android-client/acceptance-index.md)。原始本机输出在 `output/flutter-client-2026-11-17/`（不提交大型截图/日志/APK，保留本机供复查）。功能取舍见 [简记](../openspec/changes/build-flutter-employee-android-client/function-decisions.md)。这些是 apply 证据，不是独立 e13 验证结论。
