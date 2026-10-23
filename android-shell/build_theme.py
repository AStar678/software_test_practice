#!/usr/bin/env python3
"""Rebuild the preserved browser shell with the website as its only theme source."""
import argparse
import hashlib
import json
import os
from pathlib import Path
import re
import shutil
import subprocess
import xml.etree.ElementTree as ET
import zipfile

HERE = Path(__file__).resolve().parent
ROOT = HERE.parent
BASE_SHA = "8407b22f3b99f8da38ccb9ec64cfd61c699a46a5bcf3760737aff8e556439154"
TOOL_SHA = "66cf4524a4a45a7f56567d08b2c9b6ec237bcdd78cee69fd4a59c8a0243aeafa"
VERSION = "0.2.2"


def checked(condition, message):
    if not condition:
        raise RuntimeError(message)


def digest(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def run(*args):
    subprocess.run([str(arg) for arg in args], check=True)


def signing_certificate(apksigner, apk):
    text = subprocess.check_output(
        [str(apksigner), "verify", "--print-certs", str(apk)], text=True)
    match = re.search(r"certificate SHA-256 digest: ([0-9a-f]+)", text)
    checked(match is not None, "Cannot read the APK signing certificate")
    return match.group(1)


def website_palette():
    source = ROOT / "潘多拉-手账主题.css"
    root_block = re.search(r":root\s*\{([^}]+)\}", source.read_text()).group(1)
    variables = dict(re.findall(r"(--[\w-]+)\s*:\s*([^;]+);", root_block))

    def resolve(name):
        value = variables[name].strip()
        for _ in range(8):
            alias = re.fullmatch(r"var\((--[\w-]+)\)", value)
            if not alias:
                break
            value = variables[alias.group(1)].strip()
        checked(bool(re.fullmatch(r"#[0-9a-fA-F]{3}(?:[0-9a-fA-F]{3})?", value)),
                f"Expected a CSS color for {name}: {value}")
        if len(value) == 4:
            value = "#" + "".join(char * 2 for char in value[1:])
        return value.lower()

    return source, {name: resolve("--" + name) for name in
                    ("bg", "card", "ink", "ink-2", "muted", "brand", "brand-soft", "urgent")}


def smali_color(color, alpha=255):
    value = (alpha << 24) | int(color[1:], 16)
    if value >= 2**31:
        value -= 2**32
    return ("-0x" + format(-value, "x")) if value < 0 else ("0x" + format(value, "x"))


def replace_rgb_calls(source, colors):
    # Replacing the pure Color.rgb call and its result leaves preceding register
    # assignments intact. Smali reassembly recalculates offsets and branch targets.
    pattern = re.compile(
        r"invoke-static \{[^}]+\}, Landroid/graphics/Color;->rgb\(III\)I"
        r"\s*\n\s*move-result (v\d+)")
    checked(len(pattern.findall(source)) == len(colors), "Unexpected native RGB call count")
    values = iter(colors)
    return pattern.sub(lambda match: f"const {match.group(1)}, {smali_color(next(values))}", source)


def patch_native(decoded, palette):
    package = decoded / "smali_classes2/cn/pandora/mobile"
    main = package / "MainActivity.smali"
    main.write_text(replace_rgb_calls(main.read_text(),
                    [palette["ink"], palette["brand"], palette["card"], palette["muted"]]))
    navigation = package / "MaterialNavigation.smali"
    source = replace_rgb_calls(navigation.read_text(), [palette["card"]])
    colors = {
        0x19006b54: smali_color(palette["brand"], 25),
        -0x3e1327: smali_color(palette["brand-soft"]),
        -0xc0b6bb: smali_color(palette["muted"]),
        -0xffdee9: smali_color(palette["brand"]),
        -0xe6e3e5: smali_color(palette["brand"]),
    }
    counts = {key: 0 for key in colors}

    def replace(match):
        value = int(match.group(2), 16)
        if value not in colors:
            return match.group(0)
        counts[value] += 1
        return match.group(1) + colors[value]

    source = re.sub(r"(\bconst v\d+, )(-?0x[0-9a-f]+)", replace, source)
    checked(all(count == 1 for count in counts.values()), "Unexpected navigation color constants")
    navigation.write_text(source)

    # Match website roles for native vector icons, launch surface and dialogs.
    resource_colors = {
        "#ff006b54": "#ff" + palette["brand"][1:],
        "#fff8faf8": "#ff" + palette["bg"][1:],
        "#ff3f4945": "#ff" + palette["ink-2"][1:],
        "#ffba1a1a": "#ff" + palette["urgent"][1:],
    }
    for path in (decoded / "res").rglob("*.xml"):
        text = path.read_text()
        for old, new in resource_colors.items():
            text = text.replace(old, new)
        path.write_text(text)
    styles = decoded / "res/values/styles.xml"
    tree = ET.parse(styles)
    for item in tree.getroot().iter("item"):
        if item.get("name") in ("android:statusBarColor", "android:navigationBarColor"):
            item.text = "#ff" + palette["card"][1:]
    tree.write(styles, encoding="utf-8", xml_declaration=True)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--sdk", type=Path, default=ROOT / "android/.toolchain/sdk")
    parser.add_argument("--apktool", type=Path,
                        default=ROOT / "android/.toolchain/downloads/apktool-2.12.1.jar")
    parser.add_argument("--keystore", type=Path,
                        default=ROOT / "android/.toolchain/android-user/debug.keystore")
    args = parser.parse_args()
    java = Path(os.environ.get("JAVA_HOME", "/Library/Java/JavaVirtualMachines/jdk-21.jdk/Contents/Home")) / "bin/java"
    base = HERE / "baseline/pandora-shell-0.2.1.apk"
    checked(digest(base) == BASE_SHA, "The baseline APK does not match the preserved 0.2.1 build")
    checked(digest(args.apktool) == TOOL_SHA, "APK tool checksum differs from the official release")
    checked(args.keystore.is_file(), "Provide the original debug signing keystore")
    theme_source, palette = website_palette()
    build = HERE / ".build"
    decoded = build / "decoded"
    framework = build / "framework"
    build.mkdir(exist_ok=True)
    run(java, "-jar", args.apktool, "d", base, "-o", decoded, "-p", framework, "-f")

    assets = decoded / "assets/app"
    html = assets / "index.html"
    text = html.read_text()
    checked(text.count('href="android-material.css"') == 1, "Expected exactly one old theme override")
    text = text.replace('href="android-material.css"', 'href="website-shell.css"')
    text = re.sub(r"(潘多拉-手账主题\.css\?v=)[0-9a-f]+", r"\g<1>" + digest(theme_source)[:12], text)
    html.write_text(text)
    (assets / "android-material.css").unlink()
    shutil.copy2(HERE / "theme/website-shell.css", assets / "website-shell.css")
    shutil.copy2(theme_source, assets / theme_source.name)
    patch_native(decoded, palette)
    config = decoded / "apktool.yml"
    text = config.read_text().replace("versionCode: 3\n", "versionCode: 4\n")
    text = text.replace("versionName: 0.2.1\n", f"versionName: {VERSION}\n")
    checked("versionCode: 4\n" in text and f"versionName: {VERSION}\n" in text, "Version update failed")
    config.write_text(text)

    tools = args.sdk / "build-tools/35.0.0"
    unsigned = build / "unsigned.apk"
    aligned = build / "aligned.apk"
    run(java, "-jar", args.apktool, "b", decoded, "-p", framework,
        "--aapt", tools / "aapt2", "-o", unsigned)
    run(tools / "zipalign", "-f", "4", unsigned, aligned)
    output = ROOT / "output/android-shell-theme"
    output.mkdir(parents=True, exist_ok=True)
    apk = output / f"pandora-shell-{VERSION}-website-theme.apk"
    run(tools / "apksigner", "sign", "--ks", args.keystore, "--ks-key-alias", "androiddebugkey",
        "--ks-pass", "pass:android", "--key-pass", "pass:android", "--out", apk, aligned)
    run(tools / "apksigner", "verify", "--verbose", apk)
    checked(signing_certificate(tools / "apksigner", base)
            == signing_certificate(tools / "apksigner", apk),
            "Update certificate must match the original shell")
    with zipfile.ZipFile(apk) as archive:
        checked("assets/app/android-material.css" not in archive.namelist(), "Old theme remains in APK")
        checked(archive.read("assets/app/website-shell.css") == (HERE / "theme/website-shell.css").read_bytes(),
                "Layout adapter differs from source")
    (output / "build-verification.json").write_text(json.dumps({
        "version": VERSION, "baselineSha256": BASE_SHA, "apkSha256": digest(apk),
        "websiteThemeSha256": digest(theme_source), "palette": palette,
        "oldOverrideRemoved": True, "nativeColorsFromWebsite": True,
    }, ensure_ascii=False, indent=2) + "\n")
    print(apk)


if __name__ == "__main__":
    main()
