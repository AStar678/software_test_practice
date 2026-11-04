'use strict';
const fs=require('fs'),path=require('path');
const {openBrowser,waitFor}=require('./browser_fixture');
const f=JSON.parse(process.env.PANDORA_MIXED_FIXTURE),q=JSON.stringify;
const out=path.resolve(__dirname,'../../output/apply-mixed-edit');fs.mkdirSync(out,{recursive:true});
const report={checks:[]};
function check(name,pass,evidence){report.checks.push({name,pass:!!pass,evidence});console.log((pass?'PASS ':'FAIL ')+name);if(!pass)throw Error(name+' '+JSON.stringify(evidence));}
async function main(){
 const b=await openBrowser(f.base+'/'+encodeURIComponent('潘多拉-交互原型.html'),{width:390,height:844,mobile:true}),ev=b.evaluate;
 try{
  check('login form',await waitFor(b,"!!document.getElementById('backend-login')"));
  await ev(`document.getElementById('login-user').value=${q(f.reviewer)};document.getElementById('login-password').value='Fixture@123456';document.getElementById('backend-login').requestSubmit()`);
  check('reviewer authenticated',await waitFor(b,'Pandora.ready&&Pandora.idle()',20000));
  await ev(`Pandora.openApproval(${q(f.requestId)})`);
  check('approval detail ready',await waitFor(b,"Pandora.idle()&&!!document.querySelector('.p-review-diffs')",20000));
  check('title and progress have original above proposed',await ev("(()=>{const rows=[...document.querySelectorAll('.p-review-diff')];return rows.length>=2&&rows.every(row=>{const before=row.querySelector('.p-review-before'),after=row.querySelector('.p-review-after');return before&&after&&before.compareDocumentPosition(after)&Node.DOCUMENT_POSITION_FOLLOWING})&&rows.some(row=>row.textContent.includes('混合编辑原题')&&row.textContent.includes('混合编辑新题'))&&rows.some(row=>row.textContent.includes('完成首轮'))})()"));
  check('complete snapshots start collapsed',await ev("[...document.querySelectorAll('.p-review-snapshot')].every(x=>!x.open)"));
  for(const width of [320,390,1440]){
   await b.viewport({width,height:width===1440?900:844,mobile:width!==1440});
   check('review diff fits '+width,await ev("document.documentElement.scrollWidth<=innerWidth+1"));
   await b.screenshot(path.join(out,'review-'+width+'.png'));
  }
  check('review actions remain reachable',await ev("!!document.querySelector('[data-action=p-approve-request]')&&!!document.querySelector('[data-action=p-reject-request]')"));
  check('no browser exceptions',b.errors.length===0,b.errors);
 }finally{fs.writeFileSync(path.join(out,'browser-report.json'),JSON.stringify(report,null,2));await b.kill();}
}
main().catch(error=>{console.error(error);process.exitCode=1});
