'use strict';
const fs = require('fs'), path = require('path');
const {openBrowser, waitFor, sleep} = require('./browser_fixture');
const f = JSON.parse(process.env.PANDORA_REPAIR_FIXTURE), js = JSON.stringify;
const report = {checks: []};
function check(name, pass, evidence) {
  report.checks.push({name, pass: !!pass, evidence});
  console.log((pass ? 'PASS ' : 'FAIL ') + name);
  if (!pass) throw Error(name + ' ' + JSON.stringify(evidence));
}
async function main() {
  const b = await openBrowser(f.base + '/', {width: 390, height: 844, mobile: true}), ev = b.evaluate;
  const idle = () => waitFor(b, 'Pandora.ready&&Pandora.idle()', 20000);
  async function closeAll() { await ev('while(sheetStack.length)closeSheet()'); }
  async function advance(seconds) {
    const response = await fetch(f.base + '/api/v1/admin/clock/advance', {
      method: 'POST', headers: {Authorization: 'Bearer ' + f.adminToken, 'Content-Type': 'application/json'},
      body: JSON.stringify({seconds})
    });
    check('isolated service clock advances', response.status === 200);
  }
  async function staffOpen() {
    await closeAll();
    await ev(`runAction({dataset:{action:'p-open-person',id:${js(f.identities['alpha-one-employee'].id)}}})`);
    await waitFor(b, "!!document.querySelector('[data-action=p-staff-enter]')&&Pandora.idle()", 15000);
    await ev("document.querySelector('[data-action=p-staff-enter][data-tab=schedule]').click()");
    check('authorized staff months load', await waitFor(b, "document.querySelectorAll('[data-staff-month].is-ready').length>=3&&Pandora.idle()", 15000));
  }
  async function inbox() {
    await closeAll(); await ev('openNotifications()');
    check('notification first page loads', await waitFor(b, "document.querySelectorAll('.p-notice-row').length===20&&Pandora.idle()", 15000));
  }
  async function load120() {
    for (let count = 40; count <= 120; count += 20) {
      await ev("document.querySelector('[data-action=p-notice-more]').click()");
      check('notification page reaches ' + count, await waitFor(b, `document.querySelectorAll('.p-notice-row').length===${count}&&Pandora.idle()`, 15000));
    }
  }
  try {
    await waitFor(b, "!!document.getElementById('backend-login')", 20000);
    await ev(`document.getElementById('login-user').value=${js(f.identities.founder.identifier)};document.getElementById('login-password').value='Fixture@123456';document.getElementById('backend-login').requestSubmit()`);
    check('real founder logs in', await idle());
    await ev(`openLogForm(${js(f.log)})`);
    check('editable log opens', await waitFor(b, "!!document.getElementById('lf-content')&&Pandora.idle()"));
    await ev("document.getElementById('lf-content').value='Legal edit';document.getElementById('lf-fill-button').click()");
    check('legal edit fill appends while preserving existing content', await waitFor(b, "document.getElementById('lf-content').value.includes('Legal edit')&&document.getElementById('lf-content').value.includes('Source item')&&document.getElementById('lf-fill-status').textContent.includes('已追加')&&Pandora.idle()"));
    await ev("document.getElementById('lf-content').value='Preserved unsaved text';window.originalRequest=Pandora.request;Pandora.request=function(p,...a){if(p.startsWith('/work-logs/fill-source'))return originalRequest.call(this,p,...a).then(r=>new Promise(resolve=>{window.releaseFill=()=>resolve(r)}));return originalRequest.call(this,p,...a)};document.getElementById('lf-fill-button').click()");
    check('fill response is held after its real read', await waitFor(b, '!!window.releaseFill'));
    await advance(86401);
    await ev('window.releaseFill()');
    check('in-flight fill becomes read-only after server freeze', await waitFor(b, "document.getElementById('lf-fill-button').disabled&&document.getElementById('lf-content').readOnly&&Pandora.idle()"));
    check('late fill preserves unsaved text', await ev("document.getElementById('lf-content').value==='Preserved unsaved text'"));
    await ev("Pandora.request=originalRequest;runAction({dataset:{action:'fill-log-source'}})");
    check('direct fill action cannot bypass read-only', await ev("document.getElementById('lf-content').value==='Preserved unsaved text'"));
    await ev("document.querySelector('[data-action=save-log]').click()");
    check('expired save stays rejected with draft preserved', await waitFor(b, "!document.getElementById('lf-error').hidden&&document.getElementById('lf-error').textContent.includes('24小时')&&Pandora.idle()") && await ev("document.getElementById('lf-content').value==='Preserved unsaved text'&&document.getElementById('lf-fill-button').disabled"));
    await closeAll();
    await ev(`openLogDetail(${js(f.log)})`);
    check('opening a frozen log has no edit entry', await waitFor(b, "document.getElementById('sheetTitle').textContent==='日志详情'&&Pandora.idle()") && await ev("!document.querySelector('[data-action=edit-log]')"));

    const staffId = f.identities['alpha-one-employee'].id;
    const stages = ['/me/reports', '/users/' + staffId, '/work-logs?scope=visible&authorId='];
    for (const stage of stages) {
      for (const status of [0, 500]) {
        await staffOpen();
        const months = await ev("document.querySelectorAll('[data-staff-month]').length");
        await ev(`window.originalRequest=Pandora.request;Pandora.request=function(p,...a){if(p.startsWith(${js(stage)}))return Promise.reject(Object.assign(new Error('temporary outage'),{status:${status}}));return originalRequest.call(this,p,...a)};document.querySelector('[data-action=p-staff-tab][data-tab=logs]').click()`);
        check('transient staff failure offers retry ' + stage + '/' + status, await waitFor(b, "!!document.querySelector('[data-action=p-staff-retry]')&&Pandora.idle()") && await ev("!document.querySelector('.staff-content').textContent.includes('无权')"));
        await ev("Pandora.request=originalRequest;document.querySelector('[data-action=p-staff-retry]').click()");
        check('staff log retry recovers ' + stage + '/' + status, await waitFor(b, "!document.querySelector('[data-action=p-staff-retry]')&&document.querySelector('.staff-content').textContent.includes('暂无')&&Pandora.idle()"));
        await ev("document.querySelector('[data-action=p-staff-tab][data-tab=schedule]').click()");
        check('authorized month window survives ' + stage + '/' + status, await idle() && await ev(`document.querySelectorAll('[data-staff-month]').length===${months}`));
      }
    }
    for (const stage of stages) {
      await staffOpen();
      await ev(`window.originalRequest=Pandora.request;Pandora.request=function(p,...a){if(p.startsWith(${js(stage)}))return Promise.reject(Object.assign(new Error('forbidden'),{status:403}));return originalRequest.call(this,p,...a)};document.querySelector('[data-action=p-staff-tab][data-tab=logs]').click()`);
      check('confirmed staff access loss clears content ' + stage, await waitFor(b, "document.querySelector('.staff-content').textContent.includes('无权')&&Pandora.idle()"));
      await ev("Pandora.request=originalRequest;document.querySelector('[data-action=p-staff-tab][data-tab=schedule]').click()");
      check('revoked staff months cannot be restored ' + stage, await ev("document.querySelectorAll('[data-staff-month]').length===0"));
    }
    await staffOpen();
    await ev("window.originalRequest=Pandora.request;Pandora.request=function(p,...a){if(p==='/me/reports')return Promise.resolve({items:[]});return originalRequest.call(this,p,...a)};document.querySelector('[data-action=p-staff-tab][data-tab=logs]').click()");
    check('directory removal is confirmed access loss', await waitFor(b, "document.querySelector('.staff-content').textContent.includes('无权')"));
    await ev('Pandora.request=originalRequest');

    for (const read of ['all', 'unread']) {
      for (const mode of ['compact', 'full']) {
        await inbox();
        await ev(`document.querySelector('[data-action=p-notice-category][data-value=other]').click();document.querySelector('[data-action=p-notice-read][data-value=${read}]').click()`);
        check('combined inbox filter is ready', await waitFor(b, "document.querySelectorAll('.p-notice-row').length===20&&!!document.querySelector('[data-action=p-notice-more]')&&Pandora.idle()", 15000), await ev("document.getElementById('p-notice-content').textContent"));
        if (await ev(`document.querySelector('[data-action=p-notice-mode]').getAttribute('aria-pressed')!==${js(String(mode === 'full'))}`)) {
          await ev("document.querySelector('[data-action=p-notice-mode]').click()");
        }
        await load120();
        await ev("window.noticeCalls=[];window.originalRequest=Pandora.request;Pandora.request=function(p,...a){if(p.startsWith('/notifications?'))noticeCalls.push(p);return originalRequest.call(this,p,...a)};document.getElementById('sheetBody').scrollTop=900;document.querySelectorAll('.p-notice-row')[110].click()");
        check('deep notification opens', await waitFor(b, "document.getElementById('sheetTitle').textContent!=='通知'&&Pandora.idle()", 15000));
        await ev('backSheet()');
        check('deep notification return preserves populated list ' + read + '/' + mode, await waitFor(b, "document.querySelectorAll('.p-notice-row').length>=119&&Pandora.idle()", 15000));
        check('refresh uses legal server pages', await ev("noticeCalls.length>=2&&noticeCalls.every(p=>Number(new URLSearchParams(p.split('?')[1]).get('limit'))<=100)"));
        check('query and position survive detail', await ev(`document.querySelector('[data-action=p-notice-category][data-value=other]').getAttribute('aria-selected')==='true'&&document.querySelector('[data-action=p-notice-read][data-value=${read}]').getAttribute('aria-pressed')==='true'&&document.getElementById('sheetBody').scrollTop>0`));
        await ev('Pandora.request=originalRequest');
      }
    }
    // Fail the second refresh page; old valid rows must remain until a complete retry succeeds.
    await inbox();
    await ev("document.querySelector('[data-action=p-notice-reset]').click()");
    check('unfiltered retry fixture is ready', await waitFor(b, "document.querySelectorAll('.p-notice-row').length===20&&!!document.querySelector('[data-action=p-notice-more]')&&Pandora.idle()", 15000));
    await load120();
    await ev("window.originalRequest=Pandora.request;Pandora.request=function(p,...a){if(p.startsWith('/notifications?')&&new URLSearchParams(p.split('?')[1]).get('offset')==='100')return Promise.reject(new Error('second page outage'));return originalRequest.call(this,p,...a)};document.querySelectorAll('.p-notice-row')[110].click()");
    await waitFor(b, "document.getElementById('sheetTitle').textContent!=='通知'&&Pandora.idle()", 15000);
    await ev('backSheet()');
    check('partial refresh failure retains 120 valid rows', await waitFor(b, "!!document.querySelector('[data-action=p-notice-retry]')&&Pandora.idle()") && await ev("document.querySelectorAll('.p-notice-row').length===120"));
    await ev("Pandora.request=originalRequest;document.querySelector('[data-action=p-notice-retry]').click()");
    check('refresh retry replaces range and can continue loading', await waitFor(b, "!document.querySelector('[data-action=p-notice-retry]')&&document.querySelectorAll('.p-notice-row').length===120&&Pandora.idle()") && await ev("!!document.querySelector('[data-action=p-notice-more]')"));
    await ev("document.querySelector('[data-action=p-notice-more]').click()");
    check('page after restored range remains reachable without duplicates', await waitFor(b, "document.querySelectorAll('.p-notice-row').length===125&&Pandora.idle()") && await ev("new Set([...document.querySelectorAll('.p-notice-row')].map(r=>r.dataset.id)).size===125"));
    check('browser has no unexpected exceptions', b.errors.length === 0, b.errors);
    report.result = 'PASS';
  } catch (error) { report.result = 'FAIL'; report.error = error.message; throw error; }
  finally {
    fs.writeFileSync(path.resolve(__dirname, '../../output/web-verification-repairs/browser.json'), JSON.stringify(report, null, 2));
    await b.kill();
  }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
