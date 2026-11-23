"""为6644实例临时采集真实JaCoCo数据；恢复原启动配置，不操作数据库。"""
import hashlib,json,os,shlex,time,zipfile,xml.etree.ElementTree as ET
from pathlib import Path
import paramiko
from IPython.display import display,Markdown,HTML,Image
from output_display import fold_raw
HOST='8.141.96.122'
UNIT='pandora-web-version.service'
JAVA='/opt/pandora/runtime/java/bin/java'
DROPIN='/run/systemd/system/pandora-web-version.service.d/90-notebook-jacoco.conf'

def ratio(counter):
    covered=int(counter.get('covered',0));missed=int(counter.get('missed',0));total=covered+missed
    return {'covered':covered,'missed':missed,'total':total,'percent':round(100*covered/total,2) if total else None}

class CloudCoverage:
    def __init__(self,root,run):
        self.root=Path(root);self.out=Path(run)/'coverage';self.out.mkdir()
        self.remote='/opt/pandora/coverage/'+Path(run).name
        self.client=None;self.installed=False;self.metadata={};self.summary=None
    def command(self,command,timeout=120):
        _,stdout,stderr=self.client.exec_command(command,timeout=timeout)
        output=stdout.read().decode();error=stderr.read().decode();status=stdout.channel.recv_exit_status()
        if status:raise RuntimeError(f'覆盖率远程命令失败({status})：'+error[-1200:])
        return output+error
    def python(self,source):return self.command("python3 - <<'COVERAGE_PY'\n"+source+"\nCOVERAGE_PY")
    def start(self,password):
        # 拒绝未知主机密钥；只使用本机已有SSH信任，不自动接受陌生服务器。
        self.client=paramiko.SSHClient();self.client.load_system_host_keys()
        self.client.set_missing_host_key_policy(paramiko.RejectPolicy())
        self.client.connect(HOST,username='root',password=password,look_for_keys=False,allow_agent=False,timeout=20)
        self.client.get_transport().set_keepalive(15)
        info=json.loads(self.python("import json,subprocess,pathlib\npid=subprocess.check_output(['systemctl','show','--value','-p','MainPID',"+repr(UNIT)+"]).decode().strip()\nargs=pathlib.Path('/proc/'+pid+'/cmdline').read_bytes().decode().split('\\0')[:-1]\nprint(json.dumps({'pid':pid,'args':args}))"))
        args=info['args']
        assert args[0]==JAVA and '-jar' in args and not any('-javaagent:' in x for x in args),'实例启动方式变化或已有agent，停止避免覆盖配置'
        self.jar=args[args.index('-jar')+1]
        assert self.jar.startswith('/opt/pandora/releases/') and self.jar.endswith('/server.jar')
        self.command('test ! -e '+shlex.quote(DROPIN))
        assert not self.command("ss -ltn | awk '$4 ~ /:6300$/ {print $4}'").strip(),'6300端口已占用'
        self.metadata={'target':'https://8.141.96.122:6644/api/v1','unit':UNIT,'deployedJar':self.jar,'deployedJarSha256':self.command('sha256sum '+shlex.quote(self.jar)).split()[0],'jacocoVersion':'0.8.13','agentBind':'127.0.0.1:6300','source':'云端实际JVM；测试前reset，测试后dump','classDenominator':'部署JAR内所有cn.pandora应用类，不按结果过滤类','scopeLimit':'共享云端采集窗口可能包含后台任务或其他请求，无法逐探针归因于pytest；未混入本地JUnit或历史exec。'}
        self.command('mkdir -p '+shlex.quote(self.remote)+' '+shlex.quote(str(Path(DROPIN).parent)))
        sftp=self.client.open_sftp()
        try:
            for local,name in [('jacoco-agent-0.8.13.jar','agent.jar'),('jacococli-0.8.13.jar','cli.jar')]:
                path=self.root/'tools/jacoco'/local;sftp.put(str(path),self.remote+'/'+name)
                assert self.command('sha256sum '+shlex.quote(self.remote+'/'+name)).split()[0]==hashlib.sha256(path.read_bytes()).hexdigest()
            option='-javaagent:'+self.remote+'/agent.jar=output=tcpserver,address=127.0.0.1,port=6300,includes=cn.pandora.*,sessionid='+Path(self.remote).name+',dumponexit=false'
            override='[Service]\nExecStart=\nExecStart='+shlex.join([args[0],option,*args[1:]])+'\n'
            with sftp.open(DROPIN,'w') as f:f.write(override)
            self.installed=True
        finally:sftp.close()
        try:
            self.command('systemctl daemon-reload\nsystemctl restart '+UNIT)
            self.wait_health()
            log=self.command(f'{JAVA} -jar {self.remote}/cli.jar dump --address 127.0.0.1 --port 6300 --reset --retry 1 --destfile {self.remote}/startup-discard.exec')
            (self.out/'startup-reset.log').write_text(log)
            self.metadata['windowStartUtc']=self.python("import datetime;print(datetime.datetime.now(datetime.timezone.utc).isoformat())").strip()
            (self.out/'provenance.json').write_text(json.dumps(self.metadata,ensure_ascii=False,indent=2))
            print('6644覆盖采集已开始；监听仅回环地址，启动阶段数据已reset。部署包SHA256：',self.metadata['deployedJarSha256'])
        except BaseException:
            self.restore();raise
    def wait_health(self):
        self.python("import urllib.request,json,time\nfor n in range(65):\n try:\n  r=json.load(urllib.request.urlopen('http://127.0.0.1:18091/health',timeout=2))\n  if r.get('status')=='UP':break\n except Exception:pass\n time.sleep(1)\nelse:raise RuntimeError('6644实例未恢复健康')")
    def restore(self):
        if self.installed:
            self.command('rm -- '+shlex.quote(DROPIN)+'\nsystemctl daemon-reload\nsystemctl restart '+UNIT)
            self.wait_health();self.installed=False
            assert not self.command("ss -ltn | awk '$4 ~ /:6300$/ {print $4}'").strip()
            self.metadata['restoredOriginalStartup']=True
            (self.out/'provenance.json').write_text(json.dumps(self.metadata,ensure_ascii=False,indent=2))
    def finish(self,specs):
        try:
            assert self.command('sha256sum '+shlex.quote(self.jar)).split()[0]==self.metadata['deployedJarSha256'],'测试期间部署版本变化'
            dump=self.command(f'{JAVA} -jar {self.remote}/cli.jar dump --address 127.0.0.1 --port 6300 --retry 1 --destfile {self.remote}/cloud.exec')
            (self.out/'dump.log').write_text(dump)
            self.metadata['windowEndUtc']=self.python("import datetime;print(datetime.datetime.now(datetime.timezone.utc).isoformat())").strip()
            # 直接读取部署JAR的字节码，绝不拿本地其他版本的class文件替代。
            self.python("from pathlib import Path\nimport zipfile\nbase=Path("+repr(self.remote)+")\nwith zipfile.ZipFile("+repr(self.jar)+") as jar:\n for name in jar.namelist():\n  prefix='BOOT-INF/classes/'\n  if name.startswith(prefix+'cn/pandora/') and name.endswith('.class'):\n   relative=name[len(prefix):]\n   target=(base/'classes'/relative).resolve()\n   assert target.is_relative_to((base/'classes').resolve())\n   target.parent.mkdir(parents=True,exist_ok=True);target.write_bytes(jar.read(name))")
            log=self.command(f'{JAVA} -jar {self.remote}/cli.jar report {self.remote}/cloud.exec --classfiles {self.remote}/classes --name Cloud6644-backend --html {self.remote}/html --xml {self.remote}/jacoco.xml --csv {self.remote}/jacoco.csv')
            assert 'does not match' not in log and '[WARN]' not in log,log
            (self.out/'report.log').write_text(log)
            self.python("from pathlib import Path\nimport zipfile\nbase=Path("+repr(self.remote)+")\nwith zipfile.ZipFile(base/'coverage.zip','w',zipfile.ZIP_DEFLATED) as z:\n for path in base.rglob('*'):\n  if path.is_file() and (path.parts[len(base.parts)] in ['html','classes'] or path.name in ['cloud.exec','jacoco.xml','jacoco.csv']):z.write(path,path.relative_to(base))")
            sftp=self.client.open_sftp()
            try:sftp.get(self.remote+'/coverage.zip',str(self.out/'coverage.zip'))
            finally:sftp.close()
            with zipfile.ZipFile(self.out/'coverage.zip') as z:
                for name in z.namelist():assert (self.out/name).resolve().is_relative_to(self.out.resolve())
                z.extractall(self.out)
            self.summary=self.parse(specs)
            return self.summary
        finally:
            self.restore()
            if self.client:self.client.close()
    def parse(self,specs):
        root=ET.parse(self.out/'jacoco.xml').getroot()
        counters={c.get('type'):ratio(c.attrib) for c in root.findall('counter')}
        # 每个条目精确匹配实际HTTP调用的Java方法签名，避免重载混淆。
        actor='Lcn/pandora/auth/Actor;';mp='Ljava/util/Map;';string='Ljava/lang/String;'
        desc={
          'AuthService.login':'('+mp+')'+mp,
          'DailyItemService.change':'('+actor+string+string+mp+')'+mp,
          'DailyItemService.delete':'('+actor+string+string+')'+mp,
          'WorkspaceService.users':'('+actor+mp+'Z)'+mp,
          'TaskService.assigneeCandidates':'('+actor+string+string+')'+mp,
          'TaskService.approvals':'('+actor+string+string+string+')'+mp}
        rows=[]
        for spec in specs:
            klass,name=spec['method'].split('.')
            classes=[c for c in root.iter('class') if c.get('name').split('/')[-1]==klass]
            assert len(classes)==1
            signature=desc.get(spec['method'],'('+actor+mp+')'+mp)
            methods=[m for m in classes[0].findall('method') if m.get('name')==name and m.get('desc')==signature]
            assert len(methods)==1,(spec['method'],signature)
            rows.append({'method':spec['method'],'class':classes[0].get('name'),'descriptor':signature,'counters':{c.get('type'):ratio(c.attrib) for c in methods[0].findall('counter')}})
        result={'status':'COLLECTED','target':self.metadata['target'],'deployedJarSha256':self.metadata['deployedJarSha256'],'counters':counters,'selectedMethods':rows,'scopeLimit':self.metadata['scopeLimit']}
        (self.out/'覆盖率摘要.json').write_text(json.dumps(result,ensure_ascii=False,indent=2))
        return result

async def show_coverage(collector):
    if collector is None:
        display(Markdown('**云端Java代码覆盖率：未采集。** 本次未提供覆盖采集的SSH连接，不复用旧报告。'));return
    data=collector.summary
    display(Markdown('### 云端Java代码覆盖率（JaCoCo）\n\n源自6644实际JVM及对应部署类文件；Python测试驱动覆盖率不计入下表。'))
    table='|指标|已覆盖|未覆盖|总数|覆盖率|\n|---|---:|---:|---:|---:|\n'
    for name in ['LINE','BRANCH','INSTRUCTION','METHOD','CLASS']:
        c=data['counters'][name];table+=f"|{name}|{c['covered']}|{c['missed']}|{c['total']}|{c['percent'] if c['percent'] is not None else 'N/A'}%|\n"
    display(Markdown(table))
    table='|选定入口方法|行覆盖率|分支覆盖率|\n|---|---:|---:|\n'
    for row in data['selectedMethods']:
        line=row['counters'].get('LINE',{}).get('percent');branch=row['counters'].get('BRANCH',{}).get('percent')
        table+=f"|{row['method']}|{line if line is not None else 'N/A'}%|{str(branch)+'%' if branch is not None else 'N/A（无分支）'}|\n"
    display(Markdown(table+'\n入口方法表不包含其下游私有方法；整体报告包含全部cn.pandora部署类。'+data['scopeLimit']))
    fold_raw((collector.out/'report.log').read_text(),'展开JaCoCo原始报告日志')
    from playwright.async_api import async_playwright
    async with async_playwright() as pw:
        edge=Path('/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge')
        browser=await pw.chromium.launch(executable_path=str(edge) if edge.exists() else None,headless=True)
        page=await browser.new_page(viewport={'width':1500,'height':1050})
        await page.goto((collector.out/'html/index.html').as_uri())
        await page.screenshot(path=str(collector.out/'JaCoCo云端代码覆盖率.png'),full_page=True)
        await browser.close()
    display(Image(filename=str(collector.out/'JaCoCo云端代码覆盖率.png')))
    line=data['counters']['LINE'];branch=data['counters']['BRANCH'];classes=data['counters']['CLASS'];methods=data['counters']['METHOD']
    analysis=f"实际行覆盖为{line['covered']}/{line['total']}（{line['percent']}%），尚有{line['missed']}行未执行；实际分支覆盖{branch['covered']}/{branch['total']}（{branch['percent']}%），尚有{branch['missed']}个分支未执行。{classes['covered']}/{classes['total']}个应用类、{methods['covered']}/{methods['total']}个方法有执行。因而126项专项断言通过只能支持所列场景，不能代表全部后端分支已覆盖；共享窗口还可能含后台请求。原启动配置已恢复。"
    display(Markdown('**覆盖率分析：** '+analysis))
