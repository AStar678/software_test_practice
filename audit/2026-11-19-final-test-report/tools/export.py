from pathlib import Path
import json
from playwright.sync_api import sync_playwright
OUT=Path('/Users/aoxiang/Desktop/软件测试/audit/2026-11-19-final-test-report')
with sync_playwright() as p:
 b=p.chromium.launch(executable_path='/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',headless=True)
 page=b.new_page(viewport={'width':1440,'height':1100},device_scale_factor=1);errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
 for directory,name in [('java-combined','后端合并覆盖率.png'),('java-unit','JUnit覆盖率.png')]:
  page.goto((OUT/'coverage'/directory/'index.html').as_uri());page.wait_for_selector('#coveragetable');page.screenshot(path=str(OUT/'coverage'/name),full_page=True)
 page.goto((OUT/'测试总览.html').as_uri());page.wait_for_selector('#rows tr');assert '3795' in page.locator('#count').inner_text()
 page.locator('#layer').select_option('pytest real API');assert '139 /' in page.locator('#count').inner_text()
 page.locator('#query').fill('test_comment_rejects_non_text_json');assert '4 /' in page.locator('#count').inner_text()
 page.locator('#reset').click();assert '3795 / 3795' in page.locator('#count').inner_text()
 page.locator('details summary').first.click();assert page.locator('details').first.get_attribute('open') is not None
 page.locator('details summary').first.click();page.screenshot(path=str(OUT/'测试总览.png'),full_page=False)
 page.goto((OUT/'测试报告.html').as_uri());page.wait_for_load_state('networkidle');page.locator('h1').wait_for()
 assert page.locator('h3').filter(has_text='TC-').count()==24
 assert page.locator('img').count()==3
 assert page.evaluate('Array.from(document.images).every(i=>i.complete && i.naturalWidth>0)')
 page.evaluate('''()=>{for(const table of document.querySelectorAll('table')){const hs=[...table.querySelectorAll('thead th')].map(n=>n.textContent);let widths;if(hs[0]==='编号')widths=[7,30,11,40,12];else if(hs[0]==='方法 / 业务组')widths=[23,18,19,25,15];else if(hs[0]==='层次')widths=[23,12,12,12,41];else if(hs[0]==='项目'||hs[0]==='层次')widths=[23,77];if(widths&&widths.length===hs.length){const group=document.createElement('colgroup');for(const w of widths){const col=document.createElement('col');col.style.width=w+'%';group.append(col)}table.prepend(group)}}}''')
 # Keep the exported HTML visually consistent with the PDF's refined column widths.
 (OUT/'测试报告.html').write_text(page.content())
 page.pdf(path=str(OUT/'测试报告.pdf'),format='A4',print_background=True,display_header_footer=True,outline=True,tagged=True,
  header_template='<span></span>',footer_template='<div style="font-size:8px;font-family:Arial;width:100%;text-align:center;color:#6d8193">Pandora · Final Test Report · <span class="pageNumber"></span> / <span class="totalPages"></span></div>')
 page.screenshot(path=str(OUT/'报告预览.png'),full_page=False)
 assert not errors,errors
 (OUT/'render-validation.json').write_text(json.dumps({'dashboardFilter139':'PASS','dashboardSearch4':'PASS','dashboardReset3795':'PASS','methodCards':24,'imagesLoaded':3,'browserErrors':errors},ensure_ascii=False,indent=2))
 b.close()
