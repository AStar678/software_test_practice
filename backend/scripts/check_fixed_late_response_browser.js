#!/usr/bin/env node
'use strict';
const fs = require('fs');
const path = require('path');
const { openBrowser, waitFor, sleep } = require('./browser_fixture');
const fixture = JSON.parse(process.env.PANDORA_BROWSER_FIXTURE);
const ids = fixture.identities;
const output = path.resolve(__dirname, '../../audit/refactor-pandora-organization-and-workflows/late-response.json');
const report = { updated: new Date().toISOString(), checks: [] };
function check(name, condition, evidence) {
  report.checks.push({ check: name, pass: !!condition, evidence });
  console.log((condition ? 'PASS ' : 'FAIL ') + name);
  if (!condition) throw new Error(name + ' ' + JSON.stringify(evidence));
}
async function main() {
  const browser = await openBrowser(fixture.base + '/', { width: 390, height: 844, mobile: true });
  const ev = browser.evaluate;
  try {
    await waitFor(browser, "!!document.getElementById('backend-login')");
    await ev(`document.getElementById('login-user').value=${JSON.stringify(ids['alpha-one-employee'].identifier)};document.getElementById('login-password').value='Fixture@123456';document.getElementById('backend-login').requestSubmit()`);
    check('first employee session becomes ready', await waitFor(browser, `Pandora.ready&&Pandora.idle()&&Pandora.data.me.id===${JSON.stringify(ids['alpha-one-employee'].id)}`));
    await ev(`(()=>{const real=window.fetch;window.__realFetch=real;window.__lateFetch=null;window.fetch=(url,options)=>{const target=String(url);if(target.includes('/api/v1/tasks')){return new Promise((resolve,reject)=>{window.__lateFetch=()=>real(url,options).then(resolve,reject);setTimeout(()=>{if(window.__lateFetch){const release=window.__lateFetch;window.__lateFetch=null;release();}},30000);});}return real(url,options);};return true})()`);
    await ev('(Pandora.reload().catch(()=>{}),true)');
    const pending = await waitFor(browser, 'typeof window.__lateFetch==="function"', 10000);
    check('a task request is deliberately still in flight', pending);
    await ev('Pandora.logout()');
    check('logout returns to the login screen', await waitFor(browser, "!!document.getElementById('backend-login')"));
    await ev('window.fetch=window.__realFetch;true');
    await ev(`document.getElementById('login-user').value=${JSON.stringify(ids['founder'].identifier)};document.getElementById('login-password').value='Fixture@123456';document.getElementById('backend-login').requestSubmit()`);
    check('second account is fully loaded before the old response is released',
      await waitFor(browser, `Pandora.ready&&Pandora.idle()&&Pandora.data.me.id===${JSON.stringify(ids['founder'].id)}`));
    const before = await ev('({me:Pandora.data.me.id,token:Pandora.token,tasks:(Pandora.data.tasks||[]).length,epoch:Pandora.epoch})');
    await ev('(window.__lateFetch&&window.__lateFetch(),true)');
    await sleep(1200);
    const after = await ev('({me:Pandora.data.me.id,token:Pandora.token,tasks:(Pandora.data.tasks||[]).length,epoch:Pandora.epoch,idle:Pandora.idle()})');
    check('late task response cannot replace the new account identity', after.me === ids['founder'].id && after.me === before.me, { before, after });
    check('late task response cannot restore the old session token or epoch', after.token === before.token && after.epoch === before.epoch, { before, after });
    check('late response leaves the workspace idle and consistent', after.idle === true && after.tasks === before.tasks, { before, after });
    await ev("setPage('view');Pandora.taskForm.open()");
    await waitFor(browser, 'Pandora.taskForm.state.active');
    await ev('Pandora.logout()');
    await waitFor(browser, "!!document.getElementById('backend-login')");
    await ev(`document.getElementById('login-user').value=${JSON.stringify(ids['beta-two-employee'].identifier)};document.getElementById('login-password').value='Fixture@123456';document.getElementById('backend-login').requestSubmit()`);
    check('account switch resets the task form instead of keeping the old account state',
      await waitFor(browser, `Pandora.ready&&Pandora.idle()&&Pandora.data.me.id===${JSON.stringify(ids['beta-two-employee'].id)}`)
      && await ev('Pandora.taskForm.state.active===false&&Pandora.taskForm.state.rows.length===0'));
    check('browser has no exceptions during account switches', browser.errors.length === 0, browser.errors);
    report.result = 'PASS';
  } finally {
    browser.kill();
    fs.writeFileSync(output, JSON.stringify(report, null, 2) + '\n');
  }
}
main().catch((error) => {
  report.result = 'FAIL';
  report.error = error.message;
  fs.writeFileSync(output, JSON.stringify(report, null, 2) + '\n');
  console.error(error);
  process.exitCode = 1;
});
