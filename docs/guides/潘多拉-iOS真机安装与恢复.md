# 潘多拉 iOS 真机安装与恢复

适用场景：用 Xcode 把仓库里的 Flutter 员工端装到自己的 iPhone，后端运行在同一局域网的 Mac 上。不经过 App Store 或 TestFlight。本文使用本次跑通的方式：由 Flutter 生成配置，再由 Xcode 构建、签名和安装。

## 第一次安装

### 1. 在 Mac 上准备工具

1. 从 Mac App Store 或 [Apple Developer](https://developer.apple.com/xcode/) 安装与 Mac 和 iPhone 系统兼容的完整版 Xcode。本次使用的是 Xcode 27.2、iOS 27.2 和 Flutter 3.47.9。打开 Xcode，完成首次初始化和 iOS 平台支持的安装。只装真机，不需要另外下载模拟器运行时。
2. 在 Mac 终端选择完整版 Xcode，并确认 iOS SDK 可用：

   ```bash
   sudo xcode-select -s /Applications/Xcode.app/Contents/Developer
   sudo xcodebuild -runFirstLaunch
   xcodebuild -showsdks
   ```

3. 使用 [项目锁定的 Flutter 版本](../../flutter/.fvmrc)。这台 Mac 已经装好 Flutter、Java 21、Maven 和 MySQL；在另一台 Mac 从头准备时，按 [Flutter 安装指南](https://docs.flutter.dev/platform-integration/ios/setup) 和 [项目后端说明](../../backend/README.md#启动与演示) 准备。本项目的 iOS 依赖由 Swift Package Manager 处理，这条流程不用安装 CocoaPods。

### 2. 启动 Mac 上的演示后端

1. 让 iPhone 和 Mac 连同一个可信 Wi‑Fi。在 Mac 的「系统设置 → 网络 → Wi‑Fi → 详细信息」查看局域网 IP。下文用 `192.168.1.23` 举例，每次都换成 Mac 的实际地址。
2. 从仓库根目录运行以下命令。`--keep` 复用本机已有演示库，保留已有编辑；不要省略。全新环境尚无演示库时，先按[后端说明](../../backend/README.md#启动与演示)准备演示数据。

   ```bash
   cd backend
   PANDORA_BIND_ADDRESS=0.0.0.0 ./scripts/start-demo.sh --keep
   ```

3. 在 iPhone 的 Safari 打开 `http://192.168.1.23:8080/health`，确认能看到后端返回的健康状态。iPhone 通过 Wi‑Fi 访问 API；USB 用于配对和安装。只在可信局域网使用演示数据，不把 HTTP 端口转发到公网。

### 3. 配对 iPhone 并开启开发者模式

1. 用 USB 数据线连接 Mac 和 iPhone，解锁 iPhone。Mac 的 Finder 或 Xcode 提示时点「信任」；在 iPhone 点「信任此电脑」并输入锁屏密码。这一步授权的是 **Mac**，不是 App 的签名开发者。
2. 让 Xcode 识别手机。然后在 iPhone 打开「设置 → 隐私与安全性 → 开发者模式」，打开开关并按提示重启。重启解锁后，再点「打开」确认。
3. 保持手机亮屏、解锁和 USB 连接，等 Xcode 完成设备准备。

### 4. 生成配置、签名并安装

1. 从仓库根目录打开另一个终端执行以下命令。`--config-only` 生成供 Xcode 使用的配置，实际编译交给 Xcode。API 地址要保留 `/api/v1`，不能用 `localhost` 或 `127.0.0.1` 代替 Mac 的地址。

   ```bash
   cd flutter
   flutter build ios --debug --config-only \
     --dart-define=API_BASE_URL=http://192.168.1.23:8080/api/v1
   open ios/Runner.xcworkspace
   ```

2. 在 **Xcode → Settings → Accounts** 登录自己的 Apple 账号。在工程里选中 **Runner** target，打开 **Signing & Capabilities**，勾选 **Automatically manage signing**，Team 选自己的 **Personal Team**。本项目使用 Bundle ID `cn.pandora.pandoraEmployee`。
3. 在 Xcode 顶部选 **Runner** 和实际连接的 iPhone 作为运行目标。按 `⌘R`，由 Xcode 自动配置开发签名、构建并安装 **Pandora Employee**。出现 **Register Device** 时按提示注册。
4. iPhone 首次要求信任开发者时，打开「设置 → 通用 → VPN 与设备管理」，在「开发者 App」里选择与 Xcode 签名一致的自己的账号，按页面提示点「信任」或完成验证；如系统要求重启，重启并解锁后回 Xcode 再按 `⌘R`。这一步授权的是 **App 签名开发者**，即使是自己的账号，也与「信任此电脑」分开。
5. App 弹出局域网访问提示时选「允许」。用已有演示员工账号登录，确认首页加载到 Mac 后端的真实数据。看到 App 图标只代表已安装，能登录并读到数据才算联调完成。

## 清理手机后，恢复到可运行状态

### 在 iPhone 上清理

1. 长按 **Pandora Employee** 图标，选择「移除 App → 删除 App」，不要只选「从主屏幕移除」。删除 App 不会删除 Mac 上的演示数据库。
2. 到「设置 → 通用 → VPN 与设备管理」查看对应的「开发者 App」条目。如果删除潘多拉后该条目已消失，就不用再操作。如果条目仍关联其他同一开发者签名的 App，要撤销这位开发者的信任，需删除该条目下的其他 App；不想卸载那些 App，可以保留信任，不影响重装潘多拉。
3. 到「设置 → 隐私与安全性 → 开发者模式」关闭开关，并按系统提示重启。
4. 仅当你也想让 iPhone 忘记 **对 Mac 的信任** 时，才用「设置 → 通用 → 传输或还原 iPhone → 还原 → 还原位置与隐私」。这会重置所有已信任电脑及其他隐私权限，不只影响潘多拉；仅撤销 App 开发者信任不需要做这一步。参见 [Apple 的电脑信任说明](https://support.apple.com/109054)。

### 重新装回去

1. 不用重装 Xcode、Flutter 或后端，也不用删除 Mac 上的签名证书。让 Mac 后端继续运行或用 `start-demo.sh --keep` 启动，确认 iPhone 能访问 `/health`。
2. 用 USB 重新连接 iPhone。若之前还原过位置与隐私，重新点「信任此电脑」。重新开启开发者模式，按提示重启，并在重启后确认开启。
3. 重新执行上面的 `flutter build ios --debug --config-only`，使用 Mac 当前的 IP。打开 `Runner.xcworkspace`，用原来的 **Personal Team** 和 Bundle ID，选中 iPhone 后按 `⌘R` 重装。
4. 手机上如再次要求信任开发者，去「VPN 与设备管理」信任自己的签名账号，再从 Xcode 启动。按提示允许局域网访问，用演示员工账号登录并确认首页有数据。

免费 **Personal Team** 的开发描述文件有效期为 7 天；到期后用 Xcode 重新构建和安装即可，不用先卸载 App 或重置手机信任。参见 [Apple 会员类型对比](https://developer.apple.com/support/compare-memberships/)。
