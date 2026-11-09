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
    // Organization-draft path: the new-employee dialog must carry the real date into the draft.
    await browser.evaluate(`document.getElementById('employeeNew').click()`);
    await waitFor(browser, "document.getElementById('employeeDialog').open");
    await browser.evaluate(`document.getElementById('fDisplayName').value='草稿入职员工';
      document.getElementById('fPhone').value='13977770077';
      document.getElementById('fHireDate').value='2022-02-02';
      document.getElementById('employeeSave').click();`);
    check("the organization draft carries the entered hire date",
      await waitFor(browser, "!document.getElementById('employeeDialog').open && state.planDraft.newEmployees.some(e=>e.displayName==='草稿入职员工' && e.hireDate==='2022-02-02')"), "draft");
    check("the draft form did not create an account before the plan is saved",
      await browser.evaluate("fetch('/api/v1/admin/employees?q=草稿入职员工',{headers:{Authorization:'Bearer '+state.token}}).then(r=>r.json()).then(j=>j.total===0)"), "no account");
    check("no uncaught browser errors occurred", browser.errors.length === 0, browser.errors);
  } finally {
    browser.kill();
  }
})().catch((error) => { console.error(error.stack || error); process.exit(1); });
