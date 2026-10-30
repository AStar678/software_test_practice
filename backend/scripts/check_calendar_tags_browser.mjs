import fs from 'node:fs/promises';
import path from 'node:path';
import {homedir} from 'node:os';
import {createRequire} from 'node:module';
import {pathToFileURL} from 'node:url';
const f=JSON.parse(process.env.PANDORA_TAG_FIXTURE||'{}');
const origin=new URL(f.base);
if(origin.hostname!=='127.0.0.1'||origin.port!=='18199'||!/^pandora_precheck_model_[a-f0-9]{16}$/.test(f.database)) throw Error('Disposable fixture required');
let modulePath;try{modulePath=createRequire(import.meta.url).resolve('playwright');}catch{modulePath=process.env.PLAYWRIGHT_MODULE||path.join(homedir(),'.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs');}
const {chromium}=await import(pathToFileURL(modulePath).href);
const browser=await chromium.launch({headless:true});
const context=await browser.newContext({viewport:{width:390,height:844}});
await context.route('**/*',route=>new URL(route.request().url()).origin!==origin.origin?route.abort():route.continue());
const page=await context.newPage(),report={checks:[],errors:[]};
page.on('pageerror',e=>report.errors.push(e.message));
function check(name,condition,evidence){report.checks.push({check:name,pass:!!condition,evidence});console.log((condition?'PASS ':'FAIL ')+name);if(!condition)throw Error(name);}
async function idle(){await page.waitForFunction(()=>Pandora.ready&&Pandora.idle());}
async function login(phone){await page.goto(f.base);await page.locator('#login-user').fill(phone);await page.locator('#login-password').fill('Fixture@123456');await page.locator('#backend-login button[type=submit]').click();await idle();await page.evaluate(()=>setPage('view'));}
async function shot(name){await page.screenshot({path:path.join(f.output,name+'.png'),fullPage:true});}
async function close(){await page.locator('#sheetClose').click();await page.locator('#overlay').waitFor({state:'hidden'});}
async function fit(name){check(name,await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));}
try{
 await login(f.phone);
 check('month view has visible edit tags button',await page.locator('.p-edit-tags').isVisible());
 await page.locator('.p-edit-tags').click();
 check('employee creates personal tags only',await page.locator('#p-tag-scope option').count()===1&&await page.locator('#p-tag-scope').inputValue()==='personal');
 check('shared tag is readable but has no edit button',await page.locator(`[data-tag-row="${f.sharedTag}"]`).getByText('创始人维护').isVisible()&&await page.locator(`[data-tag-row="${f.sharedTag}"] [data-action=p-tag-edit]`).count()===0);
 await page.locator('#p-tag-name').fill('我的重要事项');
 await page.locator('[data-action=p-tag-color][data-color="#E4DEF3"]').click();
 await shot('mobile-editor');await fit('mobile editor fits viewport');
 // Slow the real POST to check immediate feedback while the network is pending.
 await page.route('**/api/v1/tags',async route=>{if(route.request().method()==='POST')await new Promise(r=>setTimeout(r,1200));await route.continue();});
 await page.locator('[data-action=p-tag-create]').click();
 check('save immediately signals network activity',await page.evaluate(()=>!Pandora.idle()));
 await page.waitForFunction(()=>Pandora.idle()&&Pandora.data.tags.items.some(t=>t.name==='我的重要事项'));
 await page.unroute('**/api/v1/tags');
 const tag=await page.evaluate(()=>Pandora.data.tags.items.find(t=>t.name==='我的重要事项'));
 check('new personal tag appears in calendar colour legend',await page.locator('.p-calendar-tag-legend').textContent().then(t=>t.includes('我的重要事项 · 私人')));
 await page.evaluate(id=>openTaskDetail(id),f.taskId);await page.locator('#p-personal-task-tag').waitFor();
 await page.locator('#p-personal-task-tag').selectOption(tag.id);
 await page.locator('[data-action=p-personal-tag-save]').click();await idle();
 await page.waitForFunction(()=>document.querySelector('.p-tag-pill')&&document.querySelector('#sheetBody').textContent.includes('我的重要事项 · 仅我'));
 await shot('mobile-personal-task');await close();
 await page.waitForFunction(id=>Array.from(document.querySelectorAll('[data-task]')).some(e=>e.dataset.task===id&&e.style.getPropertyValue('--tc-bg')==='#E4DEF3'),f.taskId);
 await shot('mobile-month');await fit('mobile month fits viewport');
 await page.locator('[data-action=schedule-side-toggle]').click();await page.locator('[data-action=schedule-mode][data-mode=day]').click();await page.locator('[data-action=schedule-side-close]').last().click();
 check('day view keeps edit tags and return to month visible',await page.locator('.p-edit-tags').isVisible()&&await page.locator('[data-action=schedule-return-month]').isVisible());
 await shot('mobile-day');await page.locator('[data-action=schedule-return-month]').click();
 for(const size of [{width:320,height:740},{width:844,height:390},{width:1440,height:900}]){
  await page.setViewportSize(size);await fit('calendar fits '+size.width);await shot('calendar-'+size.width);
  await page.locator('.p-edit-tags').click();await fit('tag editor fits '+size.width);await shot('editor-'+size.width);await close();
 }
 await page.reload();await idle();
 check('private colour persists after reload',await page.evaluate(id=>Pandora.data.rawTasks.some(t=>t.id===id&&t.personalTag?.name==='我的重要事项'),f.taskId));
 await page.evaluate(()=>Pandora.logout());await login(f.colleaguePhone);
 check('account switch clears other employee personal catalogue',await page.evaluate(()=>!Pandora.data.tags.items.some(t=>t.name==='我的重要事项')));
 await page.evaluate(id=>openTaskDetail(id),f.taskId);await page.locator('#p-personal-task-tag').waitFor();
 check('coworker sees no private label in task detail',!(await page.locator('#sheetBody').textContent()).includes('我的重要事项'));
 check('no browser runtime errors',report.errors.length===0,report.errors);
 report.passed=true;
}catch(error){report.passed=false;report.error=error.message;await shot('failure').catch(()=>{});console.error(error);}
finally{await fs.writeFile(path.join(f.output,'browser-report.json'),JSON.stringify(report,null,2)+'\n');await browser.close();}
process.exitCode=report.passed?0:1;
