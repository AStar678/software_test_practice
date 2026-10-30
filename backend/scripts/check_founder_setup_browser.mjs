#!/usr/bin/env node
// Only invoked by check_founder_setup.py with its freshly created fixture database.
import fs from 'node:fs/promises';
import path from 'node:path';
import {homedir} from 'node:os';
import {createRequire} from 'node:module';
import {pathToFileURL} from 'node:url';
import {randomUUID} from 'node:crypto';

const fixture = JSON.parse(process.env.PANDORA_FOUNDER_FIXTURE || '{}');
const origin = new URL(fixture.base);
if (origin.hostname !== '127.0.0.1' || origin.port !== '18189'
    || !/^pandora_precheck_model_[a-f0-9]{16}$/.test(fixture.database)) {
  throw new Error('Requires the owned disposable founder fixture on port 18189');
}
const require = createRequire(import.meta.url);
let playwrightPath;
try { playwrightPath = require.resolve('playwright'); }
catch { playwrightPath = process.env.PLAYWRIGHT_MODULE || path.join(homedir(), '.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs'); }
const {chromium} = await import(pathToFileURL(playwrightPath).href);
const report = {updated: new Date().toISOString(), checks: [], errors: [], cancelledEmployeeIds: []};
const password = 'Fixture@123456';
const founderPhone = '13900000991';
const browser = await chromium.launch({headless: true});
const context = await browser.newContext({viewport: {width: 1440, height: 900}});
await context.route('**/*', route => {
  const url = new URL(route.request().url());
  return url.protocol.startsWith('http') && url.origin !== origin.origin ? route.abort() : route.continue();
});
const page = await context.newPage();
page.on('pageerror', error => report.errors.push(error.message));
let adminToken;
function check(name, condition, evidence) {
  report.checks.push({check: name, pass: !!condition, ...(evidence === undefined ? {} : {evidence})});
  console.log((condition ? 'PASS ' : 'FAIL ') + name);
  if (!condition) throw new Error(name);
}
async function api(method, route, body, token = adminToken, extra = {}) {
  const response = await fetch(origin.origin + '/api/v1' + route, {method,
    headers: {'Content-Type': 'application/json', ...(token ? {Authorization: 'Bearer ' + token} : {}), ...extra},
    ...(body === undefined ? {} : {body: JSON.stringify(body)})});
  return {status: response.status, body: await response.json()};
}
async function loginAdmin(accountName) {
  await page.goto(origin.origin + '/admin.html');
  await page.locator('#accountName').fill(accountName);
  await page.locator('#password').fill(password);
  await page.locator('#loginButton').click();
  await page.waitForFunction(() => state.structure && state.planDraft);
  adminToken = await page.evaluate(() => state.token);
  await page.locator('[data-tab="organization"]').click();
}
async function addFounder(name = 'Fixture First Founder', phone = founderPhone) {
  await page.locator('#planNewFounder').click();
  await page.locator('#fDisplayName').fill(name);
  await page.locator('#fPhone').fill(phone);
  await page.locator('#employeeSave').click();
  await page.locator('#planCancelFounder').waitFor();
  return page.evaluate(() => state.planDraft.founderEmployeeId);
}
async function expectEmpty(name) {
  const result = await api('GET', '/admin/organization-plans');
  check(name, result.status === 200 && !result.body.organization.founderEmployeeId
    && result.body.employees.length === 0 && result.body.placements.length === 0,
    {status: result.status, employees: result.body.employees?.length, placements: result.body.placements?.length,
      founder: result.body.organization?.founderEmployeeId || null});
}
async function savePlan() {
  const pending = page.waitForResponse(response => response.url().endsWith('/api/v1/admin/organization-plans')
    && response.request().method() === 'POST');
  await page.locator('#planSave').click();
  const response = await pending;
  return {status: response.status(), body: await response.json()};
}
async function shot(name) {
  await page.screenshot({path: path.join(fixture.output, name + '.png'), fullPage: true,
    mask: [page.locator('#employeeSecret')]});
}
try {
  await loginAdmin(fixture.emptyAdmin);
  check('empty organization offers first-founder creation', await page.locator('#planNewFounder').isVisible());
  await shot('empty-organization');
  await page.locator('#planNewFounder').click();
  await page.locator('#fDisplayName').fill('Cancelled Dialog Founder');
  await page.locator('#fPhone').fill(founderPhone);
  await page.locator('#employeeCancel').click();
  check('cancelling the dialog creates no draft person', await page.evaluate(() => state.planDraft.newEmployees.length === 0));
  await expectEmpty('cancelling the dialog leaves the server empty');

  report.cancelledEmployeeIds.push(await addFounder('Cancelled Founder Draft'));
  await expectEmpty('adding a founder to the draft creates no server account');
  check('a draft founder has company placement and no second creation entry', await page.evaluate(() => {
    const p = state.planDraft.placements.find(p => p.employeeId === state.planDraft.founderEmployeeId);
    return p.placementType === 'founder' && p.departmentId === null && p.teamId === null
      && !document.querySelector('#planNewFounder');
  }));
  await page.locator('#planCancelFounder').click();
  check('cancelling founder draft removes person and placement', await page.evaluate(() => !state.planDraft.founderEmployeeId
    && !state.planDraft.newEmployees.length && !state.planDraft.placements.length));
  await expectEmpty('cancelling founder draft leaves no server account');

  report.cancelledEmployeeIds.push(await addFounder('Discarded Founder Draft'));
  page.once('dialog', dialog => dialog.accept());
  await page.locator('#planReload').click();
  await page.locator('#planNewFounder').waitFor();
  await expectEmpty('discarding the complete draft leaves no server account');

  const founderId = await addFounder();
  report.createdEmployeeId = founderId;
  await page.locator('#planReason').fill('Initialize the first fixed founder in the disposable fixture');
  const failed = await savePlan();
  await page.locator('#planError').filter({hasText: /./}).waitFor();
  check('missing display position is refused by the real backend', failed.status >= 400 && failed.status < 500,
    {status: failed.status, code: failed.body.code});
  check('failed save retains the editable founder draft', await page.evaluate(id =>
    state.planDraft.founderEmployeeId === id && state.planDraft.newEmployees.length === 1, founderId));
  await expectEmpty('failed save commits no account, placement or founder pointer');
  await shot('failed-save-retains-draft');
  await page.locator(`[data-place="${founderId}"][data-field="positionId"]`).selectOption(fixture.positionId);
  const saved = await savePlan();
  const initialPassword = saved.body.initialPasswords?.[founderId];
  check('valid complete plan creates exactly one founder and returns an initial credential', saved.status === 200
    && saved.body.createdEmployeeIds?.length === 1 && saved.body.createdEmployeeIds[0] === founderId && !!initialPassword,
    {status: saved.status, createdCount: saved.body.createdEmployeeIds?.length});
  await page.waitForFunction(id => state.structure?.organization.founderEmployeeId === id, founderId);
  check('saved founder has no add or cancel-founder controls', await page.locator('#planNewFounder').count() === 0
    && await page.locator('#planCancelFounder').count() === 0);
  const structure = await api('GET', '/admin/organization-plans');
  const employee = structure.body.employees.find(employee => employee.id === founderId);
  check('founder is the highest business level with no parent', structure.status === 200
    && structure.body.organization.founderEmployeeId === founderId && employee?.role === 'founder'
    && employee.rankLevel === 1 && employee.managerId === null && employee.departmentId === null && employee.teamId === null,
    {role: employee?.role, rankLevel: employee?.rankLevel, managerId: employee?.managerId});

  const login = await api('POST', '/auth/sessions', {accountType: 'employee', phone: founderPhone, password: initialPassword}, null);
  check('new founder can really log in with the returned initial credential', login.status === 200
    && login.body.user?.id === founderId && login.body.user.role === 'founder' && login.body.passwordChangeRequired === true,
    {status: login.status, role: login.body.user?.role, passwordChangeRequired: login.body.passwordChangeRequired});
  const changed = await api('POST', '/auth/password', {currentPassword: initialPassword, newPassword: password}, login.body.token);
  check('initial password can be changed through the real lifecycle', changed.status === 200, {status: changed.status});
  const relogin = await api('POST', '/auth/sessions', {accountType: 'employee', phone: founderPhone, password}, null);
  const me = await api('GET', '/me', undefined, relogin.body.token);
  check('normal founder login retains company-wide business access', relogin.status === 200 && me.status === 200
    && relogin.body.user.role === 'founder' && relogin.body.user.managerId === null
    && relogin.body.user.scopes.task_view === 'company' && !relogin.body.passwordChangeRequired,
    {loginStatus: relogin.status, meStatus: me.status, role: relogin.body.user?.role, taskView: relogin.body.user?.scopes?.task_view});
  await api('DELETE', '/auth/sessions/current', undefined, relogin.body.token);

  await page.reload();
  await page.waitForFunction(id => state.structure?.organization.founderEmployeeId === id, founderId);
  await page.locator('[data-tab="organization"]').click();
  check('reload preserves the fixed founder without repeating the credential', await page.locator('#planNewFounder').count() === 0
    && !(await page.locator('#employeeSecret').textContent()).trim());
  await shot('saved-fixed-founder');

  const secondId = randomUUID();
  report.rejectedSecondEmployeeId = secondId;
  const draft = structure.body;
  const duplicate = await api('POST', '/admin/organization-plans', {reason: 'Verify rejection of a second founder',
    founderEmployeeId: founderId, departments: draft.departments, teams: draft.teams,
    expectedEmployees: draft.expectedEmployees,
    placements: [...draft.placements, {employeeId: secondId, placementType: 'founder', departmentId: null,
      teamId: null, positionId: fixture.positionId}],
    newEmployees: [{id: secondId, displayName: 'Rejected Second Founder', phone: '13900000992'}]}, adminToken,
    {'If-Match': '"' + draft.rowVersion + '"', 'Idempotency-Key': 'founder-test-' + randomUUID()});
  check('backend also refuses a second founder in a complete plan', duplicate.status === 409
    && duplicate.body.code === 'INVALID_ORGANIZATION_PLAN', {status: duplicate.status, code: duplicate.body.code});
  const afterDuplicate = await api('GET', '/admin/organization-plans');
  check('second-founder failure preserves exactly one founder account', afterDuplicate.body.employees.length === 1
    && afterDuplicate.body.organization.founderEmployeeId === founderId && afterDuplicate.body.placements.length === 1);

  await api('DELETE', '/auth/sessions/current');
  await context.clearCookies();
  await page.evaluate(() => localStorage.clear());
  await loginAdmin(fixture.existingAdmin);
  check('existing-founder organization renders normally without creation entry', await page.evaluate(id =>
    state.structure.organization.founderEmployeeId === id && state.structure.employees.length === 11
    && !document.querySelector('#planNewFounder') && document.querySelector('#planFounder').textContent.includes('固定创始人'), fixture.existingFounder));
  check('existing founder identity is immutable in the placement editor',
    await page.locator(`[data-place="${fixture.existingFounder}"][data-field="placementType"]`).count() === 0);
  await shot('existing-founder-unchanged');
  await api('DELETE', '/auth/sessions/current');
  check('browser regression raises no JavaScript errors', report.errors.length === 0, report.errors);
  report.passed = true;
} catch (error) {
  report.passed = false;
  report.error = error.message;
  await shot('failure').catch(() => {});
} finally {
  await fs.mkdir(fixture.output, {recursive: true});
  await fs.writeFile(path.join(fixture.output, 'browser-report.json'), JSON.stringify(report, null, 2) + '\n');
  await browser.close();
}
process.exitCode = report.passed ? 0 : 1;
