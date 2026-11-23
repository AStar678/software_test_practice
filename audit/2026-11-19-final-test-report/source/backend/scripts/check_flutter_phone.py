#!/usr/bin/env python3
"""Own-package Flutter phone checks against the disposable demo on host port 8080."""
import hashlib
import json
import os
from pathlib import Path
import re
import shutil
import subprocess
import tempfile
import time
import xml.etree.ElementTree as ET

ROOT = Path(__file__).resolve().parents[2]
ADB = ROOT / 'android/.toolchain/sdk/platform-tools/adb'
PACKAGE = 'cn.pandora.employee.flutter.qa'
PRODUCTION = 'cn.pandora.employee.flutter.debug'
SERIAL = 'ANMY022317002757'
BASE = [str(ADB), '-s', SERIAL]
OUTPUT = Path(os.environ['PANDORA_TEST_OUTPUT'])
CHECKS = []


def adb(*args, binary=False):
    return subprocess.check_output(BASE + list(args), text=not binary, stderr=subprocess.PIPE)


def check(name, passed, detail=None):
    CHECKS.append({'check': name, 'pass': bool(passed), 'detail': detail})
    (OUTPUT / 'phone-checks.json').write_text(json.dumps(CHECKS, ensure_ascii=False, indent=2))
    print(('PASS ' if passed else 'FAIL ') + name, flush=True)
    if not passed:
        raise AssertionError(name)


def texts(root):
    return [n.get('text') or n.get('content-desc') or '' for n in root.iter('node') if n.get('password') != 'true']


def ui():
    active = adb('shell', 'dumpsys', 'activity', 'activities')
    top = '\n'.join(line for line in active.splitlines() if 'topResumedActivity=' in line)
    if PACKAGE not in top:
        raise RuntimeError('Test app is not foreground (device locked or user switched apps); no input sent')
    adb('shell', 'uiautomator', 'dump', '/sdcard/pandora-qa-ui.xml')
    return ET.fromstring(adb('exec-out', 'cat', '/sdcard/pandora-qa-ui.xml', binary=True))


def tap_node(node):
    x1, y1, x2, y2 = map(int, re.findall(r'\d+', node.get('bounds')))
    adb('shell', 'input', 'tap', str((x1 + x2) // 2), str((y1 + y2) // 2))


def tap_label(label, bottom=False):
    root = ui()
    matches = [n for n in root.iter('node') if (n.get('text') or n.get('content-desc') or '').split('\n')[0] == label]
    if bottom:
        matches.sort(key=lambda n: int(re.findall(r'\d+', n.get('bounds'))[1]), reverse=True)
    if not matches:
        raise RuntimeError('Visible control not found: ' + label)
    tap_node(matches[0])


def wait_login_state(signed_in):
    last = []
    for _ in range(10):
        try:
            last = texts(ui())
            found = any('任务看板' in t or '每日事项' in t for t in last)
            if found == signed_in:
                return True
        except (subprocess.CalledProcessError, ET.ParseError, RuntimeError):
            pass
        time.sleep(.5)
    return False


def screenshot(name):
    (OUTPUT / 'phone-screenshots').mkdir(exist_ok=True)
    # This foldable has two physical displays; the outer screen is the current logical display 0.
    displays = adb('shell', 'dumpsys', 'display')
    active = next((line for line in displays.splitlines() if 'DisplayDeviceInfo{' in line and 'state ON' in line), '')
    physical = re.search(r'uniqueId="local:(\d+)"', active)
    args = ['exec-out', 'screencap', '-p']
    if physical:
        args.extend(['-d', physical.group(1)])
    data = adb(*args, binary=True)
    start = data.find(b'\x89PNG\r\n\x1a\n')
    if start < 0:
        raise RuntimeError('Device did not return a PNG screenshot')
    (OUTPUT / 'phone-screenshots' / (name + '.png')).write_bytes(data[start:])


def login(phone, password):
    assert PACKAGE.endswith('.qa')
    adb('shell', 'pm', 'clear', PACKAGE)
    adb('shell', 'am', 'start', '-n', PACKAGE + '/cn.pandora.employee.flutter.MainActivity')
    for _ in range(8):
        try:
            root = ui()
            fields = [n for n in root.iter('node') if n.get('class') == 'android.widget.EditText']
            if len(fields) == 2:
                break
        except (subprocess.CalledProcessError, ET.ParseError, RuntimeError):
            pass
        time.sleep(.5)
    else:
        raise RuntimeError('Login fields unavailable')
    for attempt in range(3):
        root = ui()
        phone_field = next(n for n in root.iter('node') if n.get('class') == 'android.widget.EditText' and n.get('password') != 'true')
        tap_node(phone_field)
        time.sleep(.5)
        # Verify focus before sending text; input-method startup can discard early key events.
        root = ui()
        phone_field = next(n for n in root.iter('node') if n.get('class') == 'android.widget.EditText' and n.get('password') != 'true')
        if phone_field.get('focused') != 'true':
            continue
        adb('shell', 'input', 'keyevent', '123', *(['67'] * 24))
        for digit in phone:
            adb('shell', 'input', 'text', digit)
        root = ui()
        actual = next(n for n in root.iter('node') if n.get('class') == 'android.widget.EditText' and n.get('password') != 'true').get('text')
        if actual == phone:
            break
    else:
        screenshot('phone-input-delivery-failure')
        raise RuntimeError('Phone input was not delivered exactly; refusing a misleading login assertion')
    field = next(n for n in root.iter('node') if n.get('class') == 'android.widget.EditText' and n.get('password') == 'true')
    tap_node(field)
    time.sleep(.5)
    adb('shell', 'input', 'text', password)
    if 'mInputShown=true' in adb('shell', 'dumpsys', 'input_method'):
        adb('shell', 'input', 'keyevent', '4')
    tap_label('登录')
    success = wait_login_state(True)
    if not success:
        screenshot('login-result-failure')
        (OUTPUT / 'login-visible-state.json').write_text(json.dumps(texts(ui()), ensure_ascii=False, indent=2))
    return success


def installed_hash(package):
    lines = adb('shell', 'pm', 'path', package).strip().splitlines()
    if not lines:
        return None
    return adb('shell', 'sha256sum', lines[0].removeprefix('package:')).split()[0]


def main():
    global SERIAL, BASE
    connected = [line.split()[0] for line in subprocess.check_output([str(ADB), 'devices'], text=True).splitlines()
                 if len(line.split()) >= 2 and line.split()[1] == 'device']
    if SERIAL not in connected and len(connected) == 1:
        SERIAL = connected[0]; BASE = [str(ADB), '-s', SERIAL]
    if SERIAL not in connected:
        (OUTPUT / 'phone-status.json').write_text(json.dumps({'status': 'BLOCKED', 'reason': 'No authorized connected Android device'}))
        print('BLOCKED phone not connected or not authorized', flush=True)
        return 75
    original_hash = installed_hash(PRODUCTION)
    env = dict(os.environ)
    with tempfile.TemporaryDirectory(prefix='pandora-phone-build-') as temporary:
        root = Path(temporary)
        for name in ('lib', 'assets'):
            (root / name).symlink_to(ROOT / 'flutter' / name, target_is_directory=True)
        for name in ('pubspec.yaml', 'pubspec.lock', '.metadata'):
            if (ROOT / 'flutter' / name).exists(): shutil.copy2(ROOT / 'flutter' / name, root / name)
        shutil.copytree(ROOT / 'flutter/android', root / 'android',
                        ignore=shutil.ignore_patterns('.gradle', 'build', 'local.properties', 'key.properties'))
        gradle = root / 'android/app/build.gradle.kts'
        body = gradle.read_text()
        assert body.count('applicationIdSuffix = ".debug"') == 1
        gradle.write_text(body.replace('applicationIdSuffix = ".debug"', 'applicationIdSuffix = ".qa"'))
        manifest = root / 'android/app/src/debug/AndroidManifest.xml'
        manifest.write_text(manifest.read_text().replace('潘多拉开发版', '潘多拉测试版'))
        (root / 'android/local.properties').write_text('flutter.sdk=/tmp/pandora-flutter-install/toolchain/flutter\nsdk.dir=/tmp/pandora-flutter-install/android-sdk\n')
        if env.get('PANDORA_TEST_PHONE_APK'):
            apk = Path(env['PANDORA_TEST_PHONE_APK'])
            assert hashlib.sha256(apk.read_bytes()).hexdigest() == env['PANDORA_TEST_PHONE_APK_SHA256']
            (OUTPUT / 'phone-apk-build.log').write_text('Reusing the verified APK from the preceding build; see phone-current/phone-apk-build.log.\n')
        else:
            with (OUTPUT / 'phone-apk-build.log').open('w') as log:
                for args in [
                    ['pub', 'get', '--offline', '--enforce-lockfile'],
                    ['build', 'apk', '--no-pub', '--debug', '--target-platform', 'android-arm64',
                     '--dart-define=API_BASE_URL=http://127.0.0.1:18585/api/v1'],
                ]:
                    subprocess.run([env['FLUTTER_BIN'], *args], cwd=root, env=env, stdout=log, stderr=subprocess.STDOUT, check=True)
            apk = root / 'build/app/outputs/flutter-apk/app-debug.apk'
            shutil.copy2(apk, '/tmp/pandora-comprehensive-20261118/phone-test.apk')
        (OUTPUT / 'phone-apk-sha256.txt').write_text(hashlib.sha256(apk.read_bytes()).hexdigest() + '\n')
        existing = adb('reverse', '--list')
        check('dedicated device forwarding port is unused', 'tcp:18585' not in existing)
        adb('reverse', 'tcp:18585', 'tcp:8080')
        try:
            adb('install', '-r', str(apk))
            for role, phone in [('employee', '13800000004'), ('team-head', '13800000011'),
                                ('department-head', '13800000002'), ('founder', '13800000001')]:
                check('real phone employee login: ' + role, login(phone, env['PANDORA_DEMO_PASSWORD']))
                screenshot(role + '-home')
                if role == 'employee':
                    for label in ['公司', '日志', '统计', '我的', '首页']:
                        tap_label(label, bottom=True)
                        time.sleep(.5)
                        root_ui = ui()
                        check('employee tab renders without login redirect: ' + label,
                              not any(t == '登录' for t in texts(root_ui)))
                        screenshot('employee-' + label)
                        if label == '公司':
                            tap_label('日视图')
                            time.sleep(.5)
                            check('real phone day view opens with a return-to-month control',
                                  any('返回月历' in t for t in texts(ui())))
                            screenshot('employee-day-view')
                            tap_label('返回月历')
            adb('shell', 'am', 'force-stop', PACKAGE)
            adb('shell', 'am', 'start', '-n', PACKAGE + '/cn.pandora.employee.flutter.MainActivity')
            check('process death restores verified account session', wait_login_state(True))
            adb('reverse', '--remove', 'tcp:18585')
            adb('shell', 'am', 'force-stop', PACKAGE)
            adb('shell', 'am', 'start', '-n', PACKAGE + '/cn.pandora.employee.flutter.MainActivity')
            time.sleep(2)
            state = texts(ui())
            check('offline startup does not show prior sensitive dashboard', not any('任务看板' in t for t in state))
            screenshot('offline-session-check')
            adb('reverse', 'tcp:18585', 'tcp:8080')
            root_ui = ui()
            retries = [n for n in root_ui.iter('node')
                       if (n.get('text') or n.get('content-desc') or '') == '重试' and n.get('clickable') == 'true']
            check('offline state provides an explicit retry control', bool(retries))
            tap_node(retries[0])
            check('network restoration revalidates the same session', wait_login_state(True))
        finally:
            subprocess.run(BASE + ['reverse', '--remove', 'tcp:18585'], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
            subprocess.run(BASE + ['uninstall', PACKAGE], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
            after_hash = installed_hash(PRODUCTION)
            (OUTPUT / 'original-app-integrity.json').write_text(json.dumps({'before': original_hash, 'after': after_hash}, indent=2))
            check('original installed Flutter app remains byte-identical', original_hash == after_hash)
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
