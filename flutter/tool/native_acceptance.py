"""Local emulator evidence helper; run commands in tool/native-acceptance.md. No installs/downloads automatically."""
import json, os, re, subprocess, sys, time, xml.etree.ElementTree as ET
from pathlib import Path
ADB=os.environ.get('ADB', '/opt/homebrew/share/android-commandlinetools/platform-tools/adb')
SERIAL=os.environ.get('ANDROID_SERIAL', 'emulator-5554')
OUT=Path(__file__).resolve().parents[2]/'output/flutter-client-2026-11-17/native'
OUT.mkdir(parents=True,exist_ok=True)

def adb(*args):
    return subprocess.check_output([ADB,'-s',SERIAL,*map(str,args)],stderr=subprocess.STDOUT)

def nodes():
    adb('shell','uiautomator','dump','/sdcard/pandora-window.xml')
    raw=adb('shell','cat','/sdcard/pandora-window.xml')
    return list(ET.fromstring(raw).iter('node'))

def label(n): return n.get('content-desc') or n.get('text') or n.get('hint') or ''
def dump():
    for n in nodes():
        if label(n): print(json.dumps({'label':label(n),'bounds':n.get('bounds'),'class':n.get('class')},ensure_ascii=False))
def tap(text, exact=False):
    matches=[n for n in nodes() if (label(n)==text if exact else text in label(n))]
    if not matches: raise AssertionError('Missing accessible element: '+text)
    n=next((n for n in matches if n.get('clickable')=='true'),matches[0])
    x1,y1,x2,y2=map(int,re.findall(r'\d+',n.get('bounds')))
    adb('shell','input','tap',(x1+x2)//2,(y1+y2)//2)
    time.sleep(.4)

def snap(name):
    (OUT/(name+'.png')).write_bytes(adb('exec-out','screencap','-p'))
    tree=nodes()
    # Store accessibility text only; never persist password fields.
    (OUT/(name+'.json')).write_text(json.dumps([{'label':label(n),'bounds':n.get('bounds')} for n in tree if label(n) and n.get('password')!='true'],ensure_ascii=False,indent=2))

def wait(text):
    for _ in range(8):
        if any(text in label(n) for n in nodes()): return
        time.sleep(.5)
    raise AssertionError('Timed out waiting for '+text)

def login(phone='13800000001'):
    tap('手机号',True)
    adb('shell','input','text',phone)
    tap('密码',True)
    adb('shell','input','text',os.environ.get('PANDORA_DEMO_PASSWORD','111'))
    adb('shell','input','keyevent','4')
    tap('登录',True)
    wait('首页')
    snap('01-login-home')
    print('Real emulator login succeeded.')
if __name__=='__main__':
    action=sys.argv[1]
    if action=='dump': dump()
    elif action=='login': login(*sys.argv[2:])
    elif action=='tap': tap(sys.argv[2])
    elif action=='snap': snap(sys.argv[2])
    elif action=='back': adb('shell','input','keyevent','4')
