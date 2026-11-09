import fs from 'node:fs';
import path from 'node:path';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
const {openBrowser,waitFor}=require('./browser_fixture.js');
const f=JSON.parse(process.env.PANDORA_TAG_FIXTURE),q=JSON.stringify;
const report={checks:[]};
function check(name,pass,evidence){report.checks.push({name,pass:!!pass,evidence});console.log((pass?'PASS ':'FAIL ')+name);if(!pass)throw Error(name+' '+JSON.stringify(evidence));}
async function main(){
 const b=await openBrowser(f.base+'/'+encodeURIComponent('潘多拉-交互原型.html'),{width:390,height:844,mobile:true}),ev=b.evaluate;
 async function login(phone){
  check('login form ready',await waitFor(b,"!!document.getElementById('backend-login')"));
  await ev(`document.getElementById('login-user').value=${q(phone)};document.getElementById('login-password').value='Fixture@123456';document.getElementById('backend-login').requestSubmit()`);
  check('authenticated',await waitFor(b,'Pandora.ready&&Pandora.idle()',20000));
 }
 try{
  await login(f.employee);
  check('employee sees only shared catalogue fields',await ev("Pandora.data.tags.items.every(t=>!('scope' in t)&&!('ownerId' in t))"));
  check('first shared tag drives each task color after reordering',await ev(`(()=>{const first=taskById(${q(f.taskId)}),other=taskById(${q(f.reordered)});return first&&other&&taskColorVars(first).includes('#F6D5D2')&&taskColorVars(other).includes('#E4DEF3')})()`));
  await ev(`openTaskDetail(${q(f.taskId)})`);
  check('task detail has both ordered tags',await waitFor(b,`(()=>{const p=[...document.querySelectorAll('#sheetBody .p-tag-pill')].map(x=>x.textContent);return p.length>=2&&p[0].includes('首选更新')&&p[1].includes('其他工作')})()`));
  check('deleted tag visibly retained',await ev("!!document.querySelector('#sheetBody .p-tag-pill.is-deleted')"));
  check('no private tag control',await ev("!document.getElementById('p-personal-task-tag')&&!document.querySelector('[data-action=p-personal-tag-save]')"));
  for(const width of [320,390,1440]){
   await b.viewport({width,height:width===1440?900:844,mobile:width!==1440});
   check('tag detail fits '+width,await ev("document.documentElement.scrollWidth<=innerWidth+1"));
   await b.screenshot(path.join(f.output,'shared-tags-'+width+'.png'));
  }
  check('no browser exceptions',b.errors.length===0,b.errors);
 }finally{fs.writeFileSync(path.join(f.output,'browser-report.json'),JSON.stringify(report,null,2));await b.kill();}
}
main().catch(error=>{console.error(error);process.exitCode=1});
