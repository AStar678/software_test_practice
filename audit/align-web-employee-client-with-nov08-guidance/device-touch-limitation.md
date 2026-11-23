# 实际设备触摸/震动核验记录

- 更新时间：2026-11-12T22:55:00+08:00
- 范围：`align-web-employee-client-with-nov08-guidance` 8.2 / 11.3
- 结论：**本机没有可用的实际手机浏览器；实际触摸滚动接管与真机震动未验证，不宣称通过。**

## 已执行的替代性证据

| 项目 | 内容 |
| --- | --- |
| 浏览器 | macOS 上的 Google Chrome headless，通过 CDP 驱动 |
| 触摸 | `Emulation.setTouchEmulationEnabled` + `Input.dispatchTouchEvent`，视口 390×844 |
| 拖动用例 | `backend/scripts/check_web_alignment_drag.py` / `check_web_alignment_drag_browser.js`，44 项 PASS |
| 长按状态机 | 激活阈值 500ms；移动超容差、滚动、多触点、取消、无位移均撤销/清理 |
| 能力探测 | `Pandora.dragSupport = {longPressMs:500, touch:true, vibrate:true}` |
| 震动调用 | CDP 触摸仿真下 `navigator.vibrate(12)` 返回成功，记录为 `haptic:"called"` |
| 非被动接管 | 激活后注册非被动 `touchmove` 并阻止默认滚动；与 Pointer 路径共用单一坐标系 |
| 桌面 | 鼠标、键盘按天/按小时调整由 `check_schedule_drag.py` 132 项 PASS 覆盖 |

证据文件：

- `output/web-alignment-drag/browser-report.json`（含 `haptic`、浮起、目标日期、边缘补载、日边界用例）
- `audit/prepare-employee-client-contracts-and-business-upgrade/chapter8-browser.json`
- `audit/refine-home-daily-items-layout-and-scrolling/daily-items-run.json`

## 未覆盖与限制

- 无 Android 设备：`adb` 不在 PATH，`adb devices` 不可用；无 iOS 设备或 Safari 实机。
- 未在真实手机上验证浏览器何时把触摸判定为滚动、何时交给页面；CDP 触摸事件不能替代该判定。
- 未验证实际振动马达：`navigator.vibrate` 在桌面 Chrome 返回可调用不等于真机震动。
- 未构建 APK、未验证 WebView/套壳桥接、未验证系统推送；这些仍不在本 change 范围。
- 不能把上述仿真结果写成“真机触摸/震动通过”；验证报告应保留此限制。
