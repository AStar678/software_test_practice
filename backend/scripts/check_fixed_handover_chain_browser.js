#!/usr/bin/env node
'use strict';
const fs = require('fs');
const path = require('path');
const { openBrowser, waitFor, sleep } = require('./browser_fixture');
const fixture = JSON.parse(process.env.PANDORA_BROWSER_FIXTURE);
const ids = fixture.identities;
const base = fixture.base;
const output = path.resolve(__dirname, '../../audit/refactor-pandora-organization-and-workflows/handover-chain.json');
const report = { updated: new Date().toISOString(), checks: [] };
function check(name, condition, evidence) {
  report.checks.push({ check: name, pass: !!condition, evidence });
  console.log((condition ? 'PASS ' : 'FAIL ') + name);
  if (!condition) throw new Error(name + ' ' + JSON.stringify(evidence));
}
async function api(method, route, { token, body, key, etag, accountType = 'employee', identifier } = {}) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers.Authorization = 'Bearer ' + token;
  if (key) headers['Idempotency-Key'] = key;
  if (etag) headers['If-Match'] = etag;
  const response = await fetch(base + route, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
  const text = await response.text();
  return { status: response.status, body: text ? JSON.parse(text) : {}, headers: Object.fromEntries(response.headers) };
}
async function loginApi(key) {
  const person = ids[key];
  const body = { accountType: person.accountType, password: 'Fixture@123456' };
  body[person.accountType === 'admin' ? 'accountName' : 'phone'] = person.identifier;
  const result = await api('POST', '/api/v1/auth/sessions', { body });
  if (result.status !== 200) throw new Error('api login ' + key + ' ' + result.status);
  return result.body.token;
}
async function loginBrowser(browser, key) {
  const person = ids[key];
  await waitFor(browser, "!!document.getElementById('backend-login')||!!document.getElementById('loginButton')");
  const admin = await browser.evaluate("!!document.getElementById('loginButton')");
  if (admin) {
    await browser.evaluate(`document.getElementById('accountName').value=${JSON.stringify(person.identifier)};document.getElementById('password').value='Fixture@123456';document.getElementById('loginButton').click()`);
    return waitFor(browser, `state.user&&state.user.accountType==='admin'&&state.structure&&document.querySelectorAll('#employeeRows tr').length>0`);
  }
  await browser.evaluate(`document.getElementById('login-user').value=${JSON.stringify(person.identifier)};document.getElementById('login-password').value='Fixture@123456';document.getElementById('backend-login').requestSubmit()`);
  return waitFor(browser, `Pandora.ready&&Pandora.idle()&&Pandora.data.me.id===${JSON.stringify(person.id)}`);
}
async function main() {
  const adminToken = await loginApi('admin');
  const employeeToken = await loginApi('beta-two-employee');
  const alphaToken = await loginApi('alpha-one-employee');
  const admin = await openBrowser(base + '/admin.html', { width: 1440, height: 900, mobile: false });
  const employee = await openBrowser(base + '/', { width: 390, height: 844, mobile: true });
  const ae = admin.evaluate, ee = employee.evaluate;
  try {
    check('administrator browser logs into the real console', await loginBrowser(admin, 'admin'));
    await ae("selectTab('takeover',document.querySelector('[data-tab=takeover]'))");
    await ae(`$('inventoryEmployee').value=${JSON.stringify(ids['alpha-two-employee'].id)};$('inventoryLoad').click()`);
    check('administrator loads the departure responsibility inventory', await waitFor(admin, "state.inventory&&document.getElementById('stageDeactivate')"));
    await ae(`document.querySelectorAll('[data-takeover-task]').forEach(select=>select.value=${JSON.stringify(ids['beta-two-employee'].id)});document.querySelectorAll('[data-cancel-request]').forEach(input=>input.checked=true);$('takeoverReason').value='Browser complete departure chain';$('stageDeactivate').click()`);
    check('administrator stages handover, unpublished cancellation and deactivation in one draft', await waitFor(admin, "state.planDraft&&state.planDraft.deactivateEmployees.length===1&&state.planDraft.businessTransfers.length>=2&&state.planDraft.cancelUnpublishedRequests.length===1"));
    const handover = await openBrowser(base + '/', { width: 390, height: 844, mobile: true });
    const he = handover.evaluate;
    try {
      check('current owner logs into the real employee app', await loginBrowser(handover, 'alpha-one-employee'));
      await he(`openTaskDetail(${JSON.stringify(fixture.active)})`);
      check('current owner opens the dedicated handover entry', await waitFor(handover, "!!document.querySelector('[data-action=p-open-handover]')"));
      await he("document.querySelector('[data-action=p-open-handover]').click()");
      const opened = await waitFor(handover, "!!document.querySelector('[data-handover-target]')&&!!document.getElementById('ho-reason')");
      if (!opened) console.log('DEBUG handover sheet', await he("({body:(document.getElementById('sheetBody')||{}).textContent,title:(document.getElementById('sheetTitle')||{}).textContent,errors:Pandora.errors||null})"), handover.errors);
      check('dedicated handover renders a target choice and preview', opened);
      const targetIds = await he(`Array.from(document.querySelectorAll('[data-handover-target] option')).map(option=>option.value)`);
      check('handover target list stays in the work circle and refuses the ordinary company-wide candidate',
        targetIds.includes(ids['alpha-two-employee'].id) && !targetIds.includes(ids['beta-one-employee'].id) && !targetIds.includes(ids['beta-two-employee'].id), targetIds);
      await he('closeSheet()');
    } finally {
      handover.kill();
    }
    await ae("$('planReason').value='Browser final complete departure';$('planSave').click()");
    check('complete final plan deactivates the employee atomically', await waitFor(admin, `state.employees.some(e=>e.id===${JSON.stringify(ids['alpha-two-employee'].id)}&&!e.active)`));
    const deadLogin = await api('POST', '/api/v1/auth/sessions', { body: { accountType: 'employee', phone: ids['alpha-two-employee'].identifier, password: 'Fixture@123456' } });
    check('deactivated employee can no longer authenticate', deadLogin.status === 401, deadLogin);

    check('takeover recipient logs into the employee app', await loginBrowser(employee, 'beta-two-employee'));
    await ee(`openTaskDetail(${JSON.stringify(fixture.active)})`);
    check('takeover recipient opens the active written-off task', await waitFor(employee, "!!document.querySelector('[data-action=edit-task]')"));
    await ee("document.querySelector('[data-action=edit-task]').click()");
    check('takeover recipient reaches the real edit form', await waitFor(employee, "!!document.getElementById('tf-title')"));
    await ee("document.getElementById('tf-title').value='Chain active edited by takeover recipient';document.getElementById('tf-reason').value='Takeover recipient continues base maintenance';document.querySelector('[data-action=save-task]').click()");
    check('takeover recipient directly edits the active task', await waitFor(employee, `Pandora.idle()&&TASKS.some(t=>t.id===${JSON.stringify(fixture.active)}&&t.title==='Chain active edited by takeover recipient')`));
    const activeDetail = await api('GET', '/api/v1/tasks/' + fixture.active, { token: employeeToken });
    const progress = await api('PATCH', '/api/v1/tasks/' + fixture.active, {
      token: alphaToken, key: 'chain-progress-' + Date.now(),
      etag: '"' + activeDetail.body.rowVersion + '"',
      body: { command: 'progress', progressNote: 'Progress after takeover' },
    });
    check('assignee progress waits for the takeover business owner', progress.status === 200 && progress.body.outcome === 'pending', progress);
    await ee(`Pandora.openApproval(${JSON.stringify(progress.body.requestId)})`);
    check('takeover recipient opens the real review sheet', await waitFor(employee, "!!document.querySelector('[data-action=p-approve-request]')"));
    await ee("document.querySelector('[data-action=p-approve-request]').click()");
    check('takeover recipient approves the pending progress', await waitFor(employee, `Pandora.idle()&&TASKS.find(t=>t.id===${JSON.stringify(fixture.active)}).progressNote==='Progress after takeover'`));

    await ee(`openTaskDetail(${JSON.stringify(fixture.completed)})`);
    check('takeover recipient opens the original completed task', await waitFor(employee, "!!document.querySelector('[data-action=p-reopen-task]')"));
    await ee("document.querySelector('[data-action=p-reopen-task]').click()");
    check('reopen offers ordered replacement assignees', await waitFor(employee, "!!document.getElementById('rp-owner-add')"));
    const future = new Date(Date.now() + 5 * 24 * 3600 * 1000);
    const later = new Date(Date.now() + 6 * 24 * 3600 * 1000);
    const date = (value) => value.toISOString().slice(0, 10);
    await ee(`document.querySelectorAll('[data-action=rp-owner-remove]').forEach(button=>button.click());document.getElementById('rp-owner-add').value=${JSON.stringify(ids['alpha-one-employee'].id)};document.querySelector('[data-action=rp-owner-add]').click();document.getElementById('rp-start-date').value=${JSON.stringify(date(future))};document.getElementById('rp-end-date').value=${JSON.stringify(date(later))};document.getElementById('rp-start-time-hour').value='09';document.getElementById('rp-start-time-minute').value='00';document.getElementById('rp-end-time-hour').value='18';document.getElementById('rp-end-time-minute').value='00';document.getElementById('reopen-reason').value='Takeover recipient reopens original completed work';document.querySelector('[data-action=p-confirm-reopen]').click()`);
    check('takeover recipient reopens with a new round and active assignee', await waitFor(employee, `Pandora.idle()&&TASKS.find(t=>t.id===${JSON.stringify(fixture.completed)}).status!=='done'`) && await ee(`(()=>{const t=TASKS.find(t=>t.id===${JSON.stringify(fixture.completed)});return t.assigneeIds.length===1&&t.assigneeIds[0]===${JSON.stringify(ids['alpha-one-employee'].id)}&&t.businessOwnerId===${JSON.stringify(ids['beta-two-employee'].id)}&&t.creatorId===${JSON.stringify(ids['alpha-two-employee'].id)}})()`));

    await ae("selectTab('history',document.querySelector('[data-tab=history]'));loadHistory(0)");
    check('administrator locates the completed task in formal history', await waitFor(admin, `!!document.querySelector('[data-history-task="${fixture.completed}"]')`));
    await ae(`document.querySelector('[data-history-task="${fixture.completed}"]').click()`);
    check('history shows original creator, administrator takeover and continued work',
      await waitFor(admin, `!$('historyDetail').hidden && $('historyDetail').textContent.includes(${JSON.stringify(fixture.completed)})`)
      && await ae(`(()=>{const text=$('historyDetail').textContent;return text.includes('正式业务接管')&&text.includes('Administrator')&&text.includes('alpha-two-employee')&&text.includes('beta-two-employee')})()`));
    await ae(`document.querySelector('[data-history-task="${fixture.active}"]').click()`);
    check('history keeps the dedicated handover and business applicant separate from the administrator',
      await waitFor(admin, `$('historyDetail').textContent.includes(${JSON.stringify(fixture.active)})`)
      && await ae(`(()=>{const text=$('historyDetail').textContent;return text.includes('交接')&&text.includes('alpha-one-employee')&&text.includes('Administrator')&&(text.includes('进展')||text.includes('修改'))})()`));
    check('administrator console and employee continuation have no browser exceptions', admin.errors.length === 0 && employee.errors.length === 0, { admin: admin.errors, employee: employee.errors });
    report.result = 'PASS';
  } finally {
    admin.kill();
    employee.kill();
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
