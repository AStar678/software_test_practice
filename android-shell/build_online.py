#!/usr/bin/env python3
"""Rebuild the browser shell loading the live website page instead of bundled assets.

The website page is fetched from the server on every launch, so frontend updates
ship without rebuilding the app. Only the Android presentation adapter
(assets/app/android-runtime.js and assets/app/website-shell.css) stays inside the
APK and is injected into the online page after it loads.
"""
import argparse
import json
import os
from pathlib import Path
import shutil
from urllib.parse import quote
import zipfile

from build_theme import (BASE_SHA, HERE, ROOT, checked, digest, patch_native, run,
                         signing_certificate, website_palette)

VERSION = "0.2.3"
PAGE_NAME = "潘多拉-交互原型.html"
ADAPTERS = ("android-runtime.js", "website-shell.css")

# Runs in the page after it finishes loading. Adds the presentation adapter the
# same way the bundled page used to reference it. Plain ASCII only, single quotes.
INJECTION = ("(function(){var h=document.head;"
             "if(!h||navigator.userAgent.indexOf('PandoraAndroid')<0)return;"
             "if(!document.querySelector('link[data-android-shell]')){"
             "var l=document.createElement('link');l.rel='stylesheet';"
             "l.href='__android__/website-shell.css';"
             "l.setAttribute('data-android-shell','1');h.appendChild(l);}"
             "if(!document.querySelector('script[data-android-shell]')){"
             "var s=document.createElement('script');"
             "s.src='__android__/android-runtime.js';"
             "s.setAttribute('data-android-shell','1');h.appendChild(s);}})()")

# Uri.Builder.encodedPath needs the percent-encoded form of the page name.
ENCODED_PAGE_PATH = "/" + quote(PAGE_NAME)
# Uri.getPath() returns the decoded form; smali strings escape non-ASCII as \\uXXXX.
DECODED_PAGE_CONST = "/" + "".join(
    char if ord(char) < 128 else "\\u%04x" % ord(char) for char in PAGE_NAME)


def patch_app_page(decoded):
    main = decoded / "smali_classes2/cn/pandora/mobile/MainActivity.smali"
    source = main.read_text()

    app_url_old = ('const-string v1, "/__android__/index.html"\n\n'
                   '    invoke-virtual {v0, v1}, '
                   'Landroid/net/Uri$Builder;->encodedPath(Ljava/lang/String;)Landroid/net/Uri$Builder;')
    app_url_new = (f'const-string v1, "{ENCODED_PAGE_PATH}"\n\n'
                   '    invoke-virtual {v0, v1}, '
                   'Landroid/net/Uri$Builder;->encodedPath(Ljava/lang/String;)Landroid/net/Uri$Builder;')
    checked(source.count(app_url_old) == 1, "Expected one appUrl() path constant")
    source = source.replace(app_url_old, app_url_new)

    bundled_old = ('const-string v1, "/__android__/index.html"\n\n'
                   '    invoke-virtual {v1, v0}, '
                   'Ljava/lang/String;->equals(Ljava/lang/Object;)Z')
    bundled_new = (f'const-string v1, "{DECODED_PAGE_CONST}"\n\n'
                   '    invoke-virtual {v1, v0}, '
                   'Ljava/lang/String;->equals(Ljava/lang/Object;)Z')
    checked(source.count(bundled_old) == 1, "Expected one bundledPage() path constant")
    source = source.replace(bundled_old, bundled_new)
    main.write_text(source)

    client = decoded / "smali_classes2/cn/pandora/mobile/MainActivity$BrowserClient.smali"
    source = client.read_text()
    anchor = ('if-nez v0, :cond_0\n\n'
              '    iget-object v0, p0, Lcn/pandora/mobile/MainActivity$BrowserClient;->this$0:'
              'Lcn/pandora/mobile/MainActivity;\n\n'
              '    invoke-static {v0}, Lcn/pandora/mobile/MainActivity;->'
              '-$$Nest$fgetprogress(Lcn/pandora/mobile/MainActivity;)Landroid/widget/ProgressBar;')
    replacement = ('if-nez v0, :cond_0\n\n'
                   f'    const-string v0, "{INJECTION}"\n\n'
                   '    const/4 v1, 0x0\n\n'
                   '    invoke-virtual {p1, v0, v1}, Landroid/webkit/WebView;->'
                   'evaluateJavascript(Ljava/lang/String;Landroid/webkit/ValueCallback;)V\n\n'
                   '    iget-object v0, p0, Lcn/pandora/mobile/MainActivity$BrowserClient;->this$0:'
                   'Lcn/pandora/mobile/MainActivity;\n\n'
                   '    invoke-static {v0}, Lcn/pandora/mobile/MainActivity;->'
                   '-$$Nest$fgetprogress(Lcn/pandora/mobile/MainActivity;)Landroid/widget/ProgressBar;')
    checked(source.count(anchor) == 1, "Expected one onPageFinished() insertion point")
    client.write_text(source.replace(anchor, replacement))


def reset_assets(decoded):
    assets = decoded / "assets/app"
    checked((assets / "android-runtime.js").is_file(), "Baseline adapter script is missing")
    for path in assets.iterdir():
        if path.is_file() and path.name not in ADAPTERS:
            path.unlink()
    shutil.copy2(HERE / "theme/website-shell.css", assets / "website-shell.css")


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
    checked(args.apktool.is_file() and digest(args.apktool) ==
            "66cf4524a4a45a7f56567d08b2c9b6ec237bcdd78cee69fd4a59c8a0243aeafa",
            "APK tool checksum differs from the official release")
    checked(args.keystore.is_file(), "Provide the original debug signing keystore")
    checked((ROOT / PAGE_NAME).is_file(), "The online page source is missing from the project root")
    theme_source, palette = website_palette()

    build = HERE / ".build"
    decoded = build / "decoded-online"
    framework = build / "framework"
    if not build.is_dir():
        build.mkdir()
    run(java, "-jar", args.apktool, "d", base, "-o", decoded, "-p", framework, "-f")
    reset_assets(decoded)
    patch_app_page(decoded)
    patch_native(decoded, palette)

    config = decoded / "apktool.yml"
    text = config.read_text().replace("versionCode: 3\n", "versionCode: 5\n")
    text = text.replace("versionName: 0.2.1\n", f"versionName: {VERSION}\n")
    checked("versionCode: 5\n" in text and f"versionName: {VERSION}\n" in text, "Version update failed")
    config.write_text(text)

    tools = args.sdk / "build-tools/35.0.0"
    unsigned = build / "unsigned-online.apk"
    aligned = build / "aligned-online.apk"
    run(java, "-jar", args.apktool, "b", decoded, "-p", framework,
        "--aapt", tools / "aapt2", "-o", unsigned)
    run(tools / "zipalign", "-f", "4", unsigned, aligned)
    output = ROOT / "output/android-shell-online"
    output.mkdir(parents=True, exist_ok=True)
    apk = output / f"pandora-shell-{VERSION}-online.apk"
    run(tools / "apksigner", "sign", "--ks", args.keystore, "--ks-key-alias", "androiddebugkey",
        "--ks-pass", "pass:android", "--key-pass", "pass:android", "--out", apk, aligned)
    run(tools / "apksigner", "verify", "--verbose", apk)
    checked(signing_certificate(tools / "apksigner", base)
            == signing_certificate(tools / "apksigner", apk),
            "Update certificate must match the original shell")

    with zipfile.ZipFile(apk) as archive:
        names = archive.namelist()
        kept = {name for name in names if name.startswith("assets/app/")}
        expected = {f"assets/app/{name}" for name in ADAPTERS}
        checked(kept == expected, f"Unexpected bundled assets: {sorted(kept)}")
        checked(archive.read("assets/app/website-shell.css")
                == (HERE / "theme/website-shell.css").read_bytes(),
                "Layout adapter differs from source")
    (output / "build-verification.json").write_text(json.dumps({
        "version": VERSION, "mode": "online", "page": PAGE_NAME,
        "pagePathEncoded": ENCODED_PAGE_PATH,
        "baselineSha256": BASE_SHA, "apkSha256": digest(apk),
        "websiteThemeSha256": digest(theme_source), "palette": palette,
        "bundledAssets": list(ADAPTERS), "injectionInjectedOnPageFinish": True,
        "nativeColorsFromWebsite": True,
    }, ensure_ascii=False, indent=2) + "\n")
    print(apk)


if __name__ == "__main__":
    main()
