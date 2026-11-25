"use strict";
// Real Chrome check for the formal admin.html hire-date maintenance (task 6.4).
const {openBrowser, waitFor, sleep} = require("./browser_fixture");
const fixture = JSON.parse(process.env.PANDORA_ADMIN_HIRE_FIXTURE || "{}");

(async () => {
  const browser = await openBrowser(fixture.base + "/admin.html", {width: 1440, height: 900, mobile: false});
  const check = (name, condition, evidence) => {
    console.log((condition ? "PASS  " : "FAIL  ") + name + (condition ? "" : " -> " + JSON.stringify(evidence)));
    if (!condition) throw new Error(name);
  };
  try {
    await waitFor(browser, "!!document.getElementById('accountName') && typeof login === 'function'");
    await browser.evaluate(`document.getElementById('accountName').value=${JSON.stringify(fixture.identifier)};
      document.getElementById('password').value=${JSON.stringify(fixture.password)};
      login();`);
    const opened = await waitFor(browser, "document.getElementById('login').hidden && !document.getElementById('console').hidden");
    if (!opened) console.log("LOGIN DEBUG " + JSON.stringify(await browser.evaluate("({error:document.getElementById('loginError').textContent,loginHidden:document.getElementById('login').hidden,consoleHidden:document.getElementById('console').hidden,who:document.getElementById('who').textContent})")) + " JS " + JSON.stringify(browser.errors));
    check("administrator console opens with a real session", opened, "login");
    check("the employees table renders the hire-date column",
      await waitFor(browser, "document.querySelector('#employeeRows') && document.querySelector('#employeeRows').textContent.includes('未设置')"), "column");
    const read = async () => browser.evaluate(`fetch('/api/v1/admin/employees/${fixture.employeeId}',{headers:{Authorization:'Bearer '+state.token}}).then(r=>r.json())`);
    // Set through the real dialog.
    await browser.evaluate(`document.querySelector('[data-edit="${fixture.employeeId}"]').click()`);
    check("the edit dialog opens and shows the clearable date input",
      await waitFor(browser, "document.getElementById('employeeDialog').open && document.getElementById('fHireDate').type==='date'"), "dialog");
    await browser.evaluate(`document.getElementById('fHireDate').value='2024-02-29';document.getElementById('employeeSave').click();`);
    check("saving closes the dialog and refreshes the employee row",
      await waitFor(browser, `!document.getElementById('employeeDialog').open && document.querySelector('#employeeRows').textContent.includes('2024-02-29')`), "saved");
    check("the saved date is read back from the real service", (await read()).hireDate === "2024-02-29", await read());
    // Cancel must not write.
    await browser.evaluate(`document.querySelector('[data-edit="${fixture.employeeId}"]').click()`);
    await sleep(150);
    await browser.evaluate(`document.getElementById('fHireDate').value='2020-01-01';document.getElementById('employeeCancel').click()`);
    check("cancel keeps the stored date unchanged", (await read()).hireDate === "2024-02-29", await read());
    // Validation error keeps the input.
    await browser.evaluate(`document.querySelector('[data-edit="${fixture.employeeId}"]').click()`);
    await waitFor(browser, "document.getElementById('employeeDialog').open");
    await browser.evaluate(`document.getElementById('fHireDate').value='2999-01-01';document.getElementById('employeeSave').click();`);
    check("a future date keeps the dialog open with the invalid input and an error",
      await waitFor(browser, "document.getElementById('employeeDialog').open && document.getElementById('fHireDate').value==='2999-01-01' && document.getElementById('employeeError').textContent.length>0"), "error");
    check("the rejected future date does not change the stored value", (await read()).hireDate === "2024-02-29", await read());
    await browser.evaluate(`document.getElementById('employeeCancel').click()`);
    // Clearing through the same dialog.
    await browser.evaluate(`document.querySelector('[data-edit="${fixture.employeeId}"]').click()`);
    await waitFor(browser, "document.getElementById('employeeDialog').open");
    await browser.evaluate(`document.getElementById('fHireDate').value='';document.getElementById('employeeSave').click();`);
    check("an empty date clears the value through the real service",
      await waitFor(browser, "!document.getElementById('employeeDialog').open") && (await read()).hireDate === null, await read());
    check("clearing restores the absent-date row state",
      await waitFor(browser, "document.querySelector('#employeeRows').textContent.includes('未设置')"), "cleared");
    // The employee page now onboards directly: no organization-adjustment draft is created.
    await browser.evaluate(`document.getElementById('employeeNew').click()`);
    await waitFor(browser, "document.getElementById('onboardingDialog').open");
    await browser.evaluate(`document.getElementById('oDisplayName').value='独立入职员工';
      document.getElementById('oPhone').value='13977770077';
      document.getElementById('oIdCard').value='440301198708080087';
      document.getElementById('oHireDate').value='2022-02-02';
      document.getElementById('oPlacement').value='employee';
      document.getElementById('oDepartment').value='fixture-company-alpha';
      document.getElementById('oDepartment').onchange();
      document.getElementById('oTeam').value='fixture-company-alpha-one';
      document.getElementById('oPosition').value='fixture-company-title';
      document.getElementById('onboardingSave').click();`);
    check("independent onboarding creates the account, location and hire date immediately",
      await waitFor(browser, "!document.getElementById('onboardingDialog').open && state.employees.some(e=>e.displayName==='独立入职员工' && e.hireDate==='2022-02-02')"), "onboarded");
    check("independent onboarding shows the one-time initial password",
      await waitFor(browser, "document.getElementById('employeeSecret').textContent.includes('初始密码仅显示一次')"), "password");
    check("independent onboarding writes no organization-adjustment draft",
      await browser.evaluate("state.planDraft && state.planDraft.newEmployees.length===0"), "no draft");
    check("the new account is readable through the administrator detail",
      await browser.evaluate("fetch('/api/v1/admin/employees?q=独立入职员工',{headers:{Authorization:'Bearer '+state.token}}).then(r=>r.json()).then(j=>j.total===1 && j.items[0].idCardNoMasked && j.items[0].idCardNo===undefined)"), "listed");
    check("no uncaught browser errors occurred", browser.errors.length === 0, browser.errors);
  } finally {
    browser.kill();
  }
})().catch((error) => { console.error(error.stack || error); process.exit(1); });
