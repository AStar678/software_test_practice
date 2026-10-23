# 旧套壳：沿用网站主题

此目录更新手机上的“潘多拉”旧套壳（`cn.pandora.mobile.debug`），版本为 0.2.2。页面、按钮、卡片、字体和背景沿用根目录网站样式；顶部和底部原生控件的颜色由同一份 `潘多拉-手账主题.css` 生成。

`theme/website-shell.css` 仅适配容器宽高和隐藏由原生导航替代的网页导航，不定义配色。

## 构建

旧 0.2.1 的 Java 源码已不在当前 Git 历史中。`baseline/pandora-shell-0.2.1.apk` 是从用户手机备份的原始包，作为可校验的重建输入；脚本在独立的 `.build/` 内解码并仅替换展示层，不改当前 `android/` 原生新版工程。

需要 Python 3、JDK 17/21、Android SDK Build Tools 35.0.0，以及 [官方 Apktool 2.12.1](https://github.com/iBotPeaches/Apktool/releases/tag/v2.12.1)。脚本按该发行版的 SHA-256 校验工具，并校验原 APK。

```sh
python3 android-shell/build_theme.py
```

可用 `--sdk`、`--apktool`、`--keystore` 指定工具和原调试签名路径。密钥不放在本目录。输出为 `output/android-shell-theme/pandora-shell-0.2.2-website-theme.apk`。

使用与原版相同的签名和包名覆盖安装，保留应用数据：

```sh
adb install -r output/android-shell-theme/pandora-shell-0.2.2-website-theme.apk
```

基线 SHA-256：`8407b22f3b99f8da38ccb9ec64cfd61c699a46a5bcf3760737aff8e556439154`。基线与本项目最初测试包的签名证书一致，仅声明 INTERNET 权限。

在荣耀手机上更新自建测试包后，系统可能再次关闭该应用的网络。遇到“无法连接本地后端”时，应先检查系统管家中该应用的“连接网络”设置。
