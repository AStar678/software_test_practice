#!/usr/bin/env node
'use strict';
const fs = require('fs');
const path = require('path');
const { openBrowser, waitFor } = require('./browser_fixture');
const fixture = JSON.parse(process.env.PANDORA_BROWSER_FIXTURE);
const ids = fixture.identities;
const output = path.resolve(__dirname, '../../audit/refactor-pandora-organization-and-workflows/log-backfill-entry.json');
const report = { updated: new Date().toISOString(), checks: [] };
function check(name, condition, evidence) {
  report.checks.push({ check: name, pass: !!condition, evidence });
  console.log((condition ? 'PASS ' : 'FAIL ') + name);
  if (!condition) throw new Error(name + ' ' + JSON.stringify(evidence));
}
const shift = (date, days) => {
  const parsed = new Date(date + 'T00:00:00Z');
  parsed.setUTCDate(parsed.getUTCDate() + days);
  return parsed.toISOString().slice(0, 10);
};
async function main() {
  const browser = await openBrowser(fixture.base + '/', { width: 390, height: 844, mobile: true });
  const ev = browser.evaluate;
  try {
    await waitFor(browser, "!!document.getElementById('backend-login')");
    await ev(`document.getElementById('login-user').value=${JSON.stringify(ids['alpha-one-employee'].identifier)};document.getElementById('login-password').value='Fixture@123456';document.getElementById('backend-login').requestSubmit()`);
    check('employee session is ready', await waitFor(browser, `Pandora.ready&&Pandora.idle()&&Pandora.data.me.id===${JSON.stringify(ids['alpha-one-employee'].id)}`));
    await ev("setPage('log')");
    await waitFor(browser, "state.page==='log'&&Pandora.idle()&&!!document.getElementById('logResults')");
    const today = await ev('Pandora.data.home.businessDate');
    const yesterday = shift(today, -1), preday = shift(today, -2);
    async function open(action) {
      await ev(`document.querySelector('[data-action=${action}]').click()`);
      return waitFor(browser, "!document.getElementById('overlay').hidden&&!!document.getElementById('lf-content')&&Pandora.idle()");
    }
    async function save(content) {
      await ev(`document.getElementById('lf-content').value=${JSON.stringify(content)};document.querySelector('#sheetFoot [data-action=save-log]').click()`);
      await waitFor(browser, "document.getElementById('overlay').hidden&&Pandora.idle()", 20000);
    }
    check('today log entry opens for the first write', await open('new-log') && await ev(`document.getElementById('lf-date').value===${JSON.stringify(today)}`));
    await save('Backfill entry today');
    check('today log is persisted before backfilling', await ev(`Pandora.request('/work-logs?scope=self&from=${today}&to=${today}&limit=1').then(r=>r.items.length===1)`));
    check('backfill entry opens yesterday instead of today\'s edit', await open('backfill-log')
      && await ev(`document.getElementById('lf-date').value===${JSON.stringify(yesterday)}&&!document.getElementById('lf-date').disabled&&document.getElementById('sheetTitle').textContent==='写日志'&&document.getElementById('lf-content').value===''`));
    await save('Backfill entry yesterday');
    check('backfill entry then opens the day before', await open('backfill-log')
      && await ev(`document.getElementById('lf-date').value===${JSON.stringify(preday)}&&!document.getElementById('lf-date').disabled&&document.getElementById('sheetTitle').textContent==='写日志'`));
    await save('Backfill entry day before');
    const all = await ev(`Pandora.request('/work-logs?scope=self&limit=10').then(r=>r.items.map(l=>l.businessDate))`);
    check('all three business days hold one real log each', [today, yesterday, preday].every(day => all.includes(day)) && new Set(all).size === 3, all);
    await ev("document.querySelector('[data-action=backfill-log]').click()");
    check('backfill entry reports that all three days are already written',
      await waitFor(browser, "document.getElementById('appNotice').textContent.includes('都已有日志')") && await ev("document.getElementById('overlay').hidden"));
    check('backfill entry has no browser exceptions', browser.errors.length === 0, browser.errors);
    report.result = 'PASS';
  } finally {
    browser.kill();
    fs.writeFileSync(output, JSON.stringify(report, null, 2) + '\n');
  }
}
main().catch((error) => {
  report.result = 'FAIL'; report.error = error.message;
  fs.writeFileSync(output, JSON.stringify(report, null, 2) + '\n');
  console.error(error); process.exitCode = 1;
});
