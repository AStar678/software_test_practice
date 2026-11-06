'use strict';
const fs=require('fs'),path=require('path');
const {openBrowser,waitFor,sleep}=require('./browser_fixture');
const f=JSON.parse(process.env.PANDORA_ADMIN_PHONE_FIXTURE),q=JSON.stringify;
const out=path.resolve(__dirname,'../../output/apply-admin-phone');fs.mkdirSync(out,{recursive:true});
const report={checks:[]};
function check(name,pass,evidence){report.checks.push({name,pass:!!pass,evidence});console.log((pass?'PASS ':'FAIL ')+name);if(!pass)throw Error(name+' '+JSON.stringify(evidence));}
async function main(){
 const b=await openBrowser(f.base+'/admin.html',{width:1440,height:900,mobile:false}),ev=b.evaluate;
 try{
  check('admin login form ready',await waitFor(b,"!!document.getElementById('accountName')&&!!document.getElementById('loginButton')"));
  await ev(`document.getElementById('accountName').value=${q(f.admin.identifier)};document.getElementById('password').value='Fixture@123456';document.getElementById('loginButton').click()`);
  check('same-company admin console opens',await waitFor(b,"!document.getElementById('console').hidden&&document.querySelectorAll('#employeeRows tr').length>0",20000));
  const rowState=await ev(`(()=>{const row=[...document.querySelectorAll('#employeeRows tr')].find(r=>r.textContent.includes(${q(f.employeeName)}));return row?{cells:[...row.cells].map(c=>c.textContent),edit:!!row.querySelector('[data-edit]'),id:row.querySelector('[data-edit]')?.dataset.edit}:null})()`);
  check('management list shows the full login phone',!!rowState&&rowState.cells[1]===f.phone,rowState);
  await ev(`(()=>{const row=[...document.querySelectorAll('#employeeRows tr')].find(r=>r.textContent.includes(${q(f.employeeName)}));row.querySelector('[data-edit]').click()})()`);
  check('employee detail dialog opens',await waitFor(b,"!!document.getElementById('employeeDialog')&&document.getElementById('employeeDialog').open&&!!document.getElementById('fPhone')",20000));
  check('detail form reads back the same full login phone',await ev(`document.getElementById('fPhone').value===${q(f.phone)}&&document.getElementById('employeeDialogTitle').textContent.includes('登录手机号')`),await ev("({phone:document.getElementById('fPhone').value,title:document.getElementById('employeeDialogTitle').textContent})"));
  check('detail copy does not claim the phone is write-only',await ev("!/仅写入|只能写入|无法读取/.test(document.getElementById('employeeDialog').textContent)"));
  for(const width of [320,390,1440]){
   await b.viewport({width,height:width===1440?900:844,mobile:width!==1440});
   const fit=await ev("(()=>{const input=document.getElementById('fPhone').getBoundingClientRect(),dialog=document.getElementById('employeeDialog').getBoundingClientRect();return {value:document.getElementById('fPhone').value,input:{l:input.left,r:input.right,t:input.top,b:input.bottom},dialog:{l:dialog.left,r:dialog.right},width:innerWidth,height:innerHeight}})()");
   check('admin phone detail reachable at '+width,fit.value===f.phone&&fit.input.l>=0&&fit.input.r<=width+1&&fit.dialog.l>=0,fit);
   await b.screenshot(path.join(out,'admin-phone-'+width+'.png'));
  }
  check('no browser exceptions',b.errors.length===0,b.errors);
 }finally{fs.writeFileSync(path.join(out,'browser-report.json'),JSON.stringify(report,null,2));await b.kill();}
}
main().then(()=>process.exit(0)).catch(e=>{console.error(e&&e.stack||e);process.exit(1)});
