# 从新克隆的仓库运行 Flutter iOS 模拟器

适用于已经装好 Flutter、完整 Xcode 和至少一个 iOS Simulator Runtime 的 Mac。不需要连接实体 iPhone，也不需要现成的 `build/`、`.dart_tool/` 或编译好的 `.app`。下面先验证应用能启动到登录页，不要求启动后端。

## 1. 检查环境并恢复依赖

在仓库根目录执行：

```sh
cd flutter
flutter --version
xcode-select -p
xcrun simctl list devices available
flutter pub get --enforce-lockfile
```

- 项目锁定 Flutter **3.47.9 stable** / Dart **3.13.7**（见 [.fvmrc](.fvmrc) 和 [pubspec.yaml](pubspec.yaml)）。
- `xcode-select -p` 应指向完整 Xcode 的 `Contents/Developer`；如果显示 `/Library/Developer/CommandLineTools`，在 Xcode 的 **Settings → Locations → Command Line Tools** 选择已安装的 Xcode。
- `simctl` 应列出至少一个可用的 iPhone 模拟器。如果没有，检查 Xcode 的 **Settings → Components** 是否安装了 iOS 运行时。
- 首次获取依赖可能需要联网；如果本机已有完整的包缓存，可以用 `flutter pub get --offline --enforce-lockfile`。两种方式都使用仓库提交的 `pubspec.lock`。

## 2. 启动模拟器并运行

从上一步的列表找一个 iPhone 模拟器，复制它括号里的 UUID。在同一个终端执行（把 `替换为模拟器 UUID` 整段换成实际值）：

```sh
SIM_ID='替换为模拟器 UUID'
xcrun simctl bootstatus "$SIM_ID" -b
flutter run -d "$SIM_ID" --no-pub \
  --dart-define=API_BASE_URL=http://127.0.0.1:8080/api/v1
```

`bootstatus -b` 会在需要时启动模拟器，并等它完成开机。`flutter run` 会从源码构建、安装并启动 App；看到「潘多拉」登录页，就验证了启动。这里显式使用本地 API 地址，避免使用项目预设的远端后端。没有后端时可以看登录页，但不能登录；联调时把 `API_BASE_URL` 换成模拟器能访问的真实 API 地址（保留 `/api/v1`），后端配置见 [后端 README](../backend/README.md)。

如果没有自动看到设备窗口，可从 Xcode 打开模拟器界面。在 Xcode 27.2 上可用 `open "$(xcode-select -p)/../Applications/DeviceHub.app"`；使用独立 Simulator 的旧版 Xcode 可用 `open -a Simulator`。

## 3. 停止应用并关闭模拟器

1. **结束 Flutter 调试**：在运行 `flutter run` 的终端按 `q`。这不会关闭模拟器；要继续开发时，可以直接再次运行 `flutter run`。
2. **关闭指定模拟器**：回到 shell 后执行下面的命令。若换了终端，先重新设置 `SIM_ID`，或直接把 `"$SIM_ID"` 换成设备 UUID。

```sh
xcrun simctl shutdown "$SIM_ID"
xcrun simctl list devices booted
```

目标设备不再出现在 `booted` 列表里，就已关机。关机不会抹掉模拟器里的 App 和数据；仅关窗口不能代替这一步。下次继续开发，重复第 2 节即可；依赖有变化时再运行 `flutter pub get --enforce-lockfile`。
