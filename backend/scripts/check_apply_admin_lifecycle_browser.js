"use strict";
// Real Chrome acceptance for the refined administrator employee lifecycle and directory page.
const fs = require("fs"), path = require("path");
const {openBrowser, waitFor, sleep} = require("./browser_fixture");
const fixture = JSON.parse(process.env.PANDORA_ADMIN_LIFECYCLE_FIXTURE || "{}");
const ids = fixture.ids || {};

(async () => {
  const browser = await openBrowser(fixture.base + "/admin.html", {width: 1440, height: 900, mobile: false});
  const evaluate = browser.evaluate;
  const check = (name, condition, evidence) => {
    console.log((condition ? "PASS  " : "FAIL  ") + name + (condition ? "" : " -> " + JSON.stringify(evidence)));
    if (!condition) throw new Error(name);
  };
  try {
    await waitFor(browser, "typeof login==='function'");
    await evaluate(`document.getElementById('accountName').value=${JSON.stringify(fixture.identifier)};
      document.getElementById('password').value=${JSON.stringify(fixture.password)};
      document.getElementById('loginButton').click();`);
    check("administrator console loads the complete employee directory",
      await waitFor(browser, "!document.getElementById('console').hidden && state.employees && state.employees.length===11 && state.employeeTotal===11", 20000));

    // ---- Combined filters, search, clearing, empty state and failure retention.
    const hasControls = await evaluate(`['employeeQuery','employeeDepartment','employeeTeam','employeePlacement','employeeActive','employeePosition','employeeClear']
      .every(id=>!!document.getElementById(id))`);
    check("employee page exposes search, department, team, identity, active, position filters and clearing", hasControls);
    await evaluate(`document.getElementById('employeeDepartment').value='fixture-company-alpha';
      document.getElementById('employeeDepartment').onchange();`);
    check("department filter narrows rows and total together",
      await waitFor(browser, "state.employeeTotal===5 && document.querySelectorAll('#employeeRows tr').length===5"), await evaluate("state.employeeTotal"));
    await evaluate(`document.getElementById('employeeTeam').value='fixture-company-alpha-one';
      document.getElementById('employeeTeam').onchange();`);
    check("team filter combines with the department filter",
      await waitFor(browser, "state.employeeTotal===2 && document.querySelectorAll('#employeeRows tr').length===2"), await evaluate("state.employeeTotal"));
    await evaluate(`document.getElementById('employeePlacement').value='employee';
      document.getElementById('employeePlacement').onchange();`);
    check("identity filter combines with department and team",
      await waitFor(browser, "state.employeeTotal===1 && document.querySelector('#employeeRows tr').textContent.includes('alpha-one-employee')"),
      await evaluate("document.querySelector('#employeeRows tr').textContent"));
    await evaluate(`document.getElementById('employeePosition').value='fixture-company-title';
      document.getElementById('employeePosition').onchange();`);
    check("display position filter keeps the matching employee",
      await waitFor(browser, "state.employeeTotal===1"), await evaluate("state.employeeTotal"));
    await evaluate(`document.getElementById('employeeQuery').value=state.allEmployees.find(e=>e.id===${JSON.stringify(ids['alpha-one-employee'])}).loginPhone;
      scheduleEmployeeLoad();`);
    check("search combines with the remaining filters",
      await waitFor(browser, "state.employeeTotal===1"), await evaluate("state.employeeTotal"));
    await evaluate("document.getElementById('employeeClear').click()");
    check("clearing all conditions restores the complete directory",
      await waitFor(browser, "state.employeeTotal===11 && state.employees.length===11"), await evaluate("state.employeeTotal"));
    await evaluate("document.getElementById('employeeQuery').value='no-such-employee-in-this-company';scheduleEmployeeLoad();");
    check("no-match state is an explicit empty result",
      await waitFor(browser, "state.employeeTotal===0 && document.querySelector('#employeeRows').textContent.includes('没有符合条件的员工')"), await evaluate("state.employeeTotal"));
    await evaluate("document.getElementById('employeeClear').click()");
    await waitFor(browser, "state.employeeTotal===11");
    const previousTotal = await evaluate("state.employeeTotal");
    await evaluate("window.__pandoraFetch=window.fetch;window.fetch=()=>Promise.reject(new TypeError('Failed to fetch'));loadEmployees();");
    check("a failed filter keeps the previous list and shows a retryable hint",
      await waitFor(browser, "state.employeeTotal===11 && document.getElementById('employeeHint').textContent.includes('筛选加载失败') && document.querySelectorAll('#employeeRows tr').length===11"),
      await evaluate("document.getElementById('employeeHint').textContent"));
    check("a failed filter surfaces one safe Chinese error dialog",
      await waitFor(browser, "document.getElementById('messageDialog').open && document.getElementById('messageText').textContent.length>0"), await evaluate("document.getElementById('messageText').textContent"));
    const networkMessage = await evaluate("document.getElementById('messageText').textContent");
    check("network failure copy contains no raw browser exception", !/[A-Za-z]/.test(networkMessage), networkMessage);
    await evaluate("document.getElementById('messageAccept').click();window.fetch=window.__pandoraFetch;delete window.__pandoraFetch;");
    await evaluate("loadEmployees()");
    check("the directory recovers after the failure", await waitFor(browser, "state.employeeTotal===" + previousTotal));

    // ---- Identity masking in the list and full value in the administrator detail.
    const maskedCell = await evaluate(`(()=>{const row=Array.from(document.querySelectorAll('#employeeRows tr')).find(r=>r.querySelector('[data-edit="${ids['alpha-one-employee']}"]'));return row?row.cells[2].textContent.trim():null})()`);
    check("employee list shows the masked identity number", maskedCell === "110105********002X", maskedCell);
    check("employee list does not include the full identity number", !(await evaluate("document.getElementById('employeeRows').textContent")).includes(fixture.idCard));
    await evaluate(`document.querySelector('[data-edit="${ids['alpha-one-employee']}"]').click()`);
    check("administrator edit detail reads the full identity number",
      await waitFor(browser, `document.getElementById('employeeDialog').open && document.getElementById('fIdCard').value===${JSON.stringify(fixture.idCard)}`),
      await evaluate("document.getElementById('fIdCard').value"));
    await evaluate("document.getElementById('employeeDialog').close()");

    // ---- Independent onboarding writes no organization draft.
    await evaluate("openOnboarding()");
    await waitFor(browser, "document.getElementById('onboardingDialog').open");
    await evaluate(`document.getElementById('oDisplayName').value='浏览器入职员工';
      document.getElementById('oPhone').value='13988880001';
      document.getElementById('oIdCard').value='320102198809090098';
      document.getElementById('oHireDate').value='2025-02-03';
      document.getElementById('oPlacement').value='employee';
      document.getElementById('oDepartment').value='fixture-company-beta';
      document.getElementById('oDepartment').onchange();
      document.getElementById('oTeam').value='fixture-company-beta-one';
      document.getElementById('oPosition').value='fixture-company-title';
      document.getElementById('onboardingSave').click();`);
    check("employee-page onboarding creates the account and shows one initial password",
      await waitFor(browser, "!document.getElementById('onboardingDialog').open && state.employees.some(e=>e.displayName==='浏览器入职员工') && document.getElementById('employeeSecret').textContent.includes('初始密码仅显示一次')", 20000),
      await evaluate("document.getElementById('onboardingError').textContent"));
    check("independent onboarding writes no organization-adjustment draft",
      await evaluate("state.planDraft && state.planDraft.newEmployees.length===0"));

    // ---- A structural conflict is refused and keeps every entered value.
    await evaluate("openOnboarding()");
    await waitFor(browser, "document.getElementById('onboardingDialog').open");
    await evaluate(`document.getElementById('oDisplayName').value='浏览器冲突员工';
      document.getElementById('oPhone').value='13988880002';
      document.getElementById('oIdCard').value='110101198910100101';
      document.getElementById('oPlacement').value='team_head';
      document.getElementById('oDepartment').value='fixture-company-alpha';
      document.getElementById('oDepartment').onchange();
      document.getElementById('oTeam').value='fixture-company-alpha-one';
      document.getElementById('oPosition').value='fixture-company-title';
      document.getElementById('onboardingSave').click();`);
    check("an occupied head position is refused with a route to organization adjustment",
      await waitFor(browser, "document.getElementById('onboardingDialog').open && document.getElementById('onboardingError').textContent.includes('组织调整')"),
      await evaluate("document.getElementById('onboardingError').textContent"));
    check("the refused onboarding keeps the entered employee data",
      await evaluate("document.getElementById('oDisplayName').value==='浏览器冲突员工' && document.getElementById('oIdCard').value==='110101198910100101'"));
    await evaluate("document.getElementById('onboardingCancel').click()");

    // ---- Independent offboarding: plain employee, fixed founder and unit head with successor.
    await evaluate(`document.querySelector('[data-offboard="${ids['beta-one-employee']}"]').click()`);
    check("offboarding dialog reads the existing responsibility inventory",
      await waitFor(browser, "document.getElementById('offboardingDialog').open && document.getElementById('offboardingBody').textContent.includes('未完成任务负责人交接')"),
      await evaluate("document.getElementById('offboardingBody').textContent.slice(0,200)"));
    await evaluate("document.getElementById('offboardingReason').value='浏览器普通离职';document.getElementById('offboardingSave').click();");
    check("plain employee offboarding completes and refreshes the directory",
      await waitFor(browser, `!document.getElementById('offboardingDialog').open && !state.allEmployees.find(e=>e.id===${JSON.stringify(ids['beta-one-employee'])}).active && state.employeeTotal===12`, 20000),
      await evaluate("state.employeeTotal"));
    check("offboarded employee row shows the inactive state",
      await waitFor(browser, `(()=>{const row=Array.from(document.querySelectorAll('#employeeRows tr')).find(r=>r.textContent.includes('beta-one-employee'));return row&&row.textContent.includes('已停用')})()`));

    await evaluate(`document.querySelector('[data-offboard="${ids['founder']}"]').click()`);
    check("fixed founder offboarding is refused inside the dialog",
      await waitFor(browser, "document.getElementById('offboardingDialog').open && document.getElementById('offboardingBody').textContent.includes('固定创始人不能办理普通离职') && document.getElementById('offboardingSave').disabled"),
      await evaluate("document.getElementById('offboardingBody').textContent.slice(0,200)"));
    await evaluate("document.getElementById('offboardingCancel').click()");

    await evaluate(`document.querySelector('[data-offboard="${ids['alpha-one-head']}"]').click()`);
    check("unit head offboarding asks for a successor",
      await waitFor(browser, "document.getElementById('offboardingDialog').open && !!document.getElementById('offboardingSuccessor')"));
    await evaluate("document.getElementById('offboardingReason').value='浏览器负责人离职';document.getElementById('offboardingSave').click();");
    check("missing successor keeps the dialog open with a Chinese explanation",
      await waitFor(browser, "document.getElementById('offboardingDialog').open && document.getElementById('offboardingError').textContent.includes('请选择继任人')"),
      await evaluate("document.getElementById('offboardingError').textContent"));
    await evaluate(`document.getElementById('offboardingSuccessor').value=${JSON.stringify(ids['alpha-one-employee'])};
      document.getElementById('offboardingSave').click();`);
    check("head offboarding with a successor promotes the successor",
      await waitFor(browser, `!document.getElementById('offboardingDialog').open && state.allEmployees.find(e=>e.id===${JSON.stringify(ids['alpha-one-employee'])}).placementType==='team_head'`, 20000),
      await evaluate("state.allEmployees.find(e=>e.id===" + JSON.stringify(ids['alpha-one-employee']) + ").placementType"));

    // ---- Deleted-task history: filter, read-only detail and provenance.
    await evaluate("selectTab('history',document.querySelector('[data-tab=history]'))");
    await waitFor(browser, "document.querySelectorAll('#historyRows tr').length>=1");
    await evaluate("document.getElementById('historyDeleted').value='true';document.getElementById('historyDeleted').onchange();");
    check("deleted filter lists the deleted task with its state",
      await waitFor(browser, `document.getElementById('historyRows').textContent.includes(${JSON.stringify(fixture.deletedTitle)}) && document.getElementById('historyRows').textContent.includes('已删除')`),
      await evaluate("document.getElementById('historyRows').textContent.slice(0,300)"));
    await evaluate(`(()=>{const row=Array.from(document.querySelectorAll('#historyRows tr')).find(r=>r.textContent.includes(${JSON.stringify(fixture.deletedTitle)}));row.querySelector('[data-history-task]').click()})()`);
    check("deleted history opens read-only with deletion time, actor and reason",
      await waitFor(browser, "!document.getElementById('historyDetail').hidden && document.getElementById('historyDetail').textContent.includes('该任务已删除') && document.getElementById('historyDetail').textContent.includes('删除人') && document.getElementById('historyDetail').textContent.includes('只读')"),
      await evaluate("document.getElementById('historyDetail').textContent.slice(0,300)"));
    check("deleted history exposes no normal business write control",
      await evaluate("!document.getElementById('historyDetail').querySelector('[data-edit],[data-offboard],[data-reset],button.primary')"));
    await evaluate("document.getElementById('historyClose').click();document.getElementById('historyDeleted').value='false';document.getElementById('historyDeleted').onchange();");
    check("normal-task filter hides the deleted task",
      await waitFor(browser, `!document.getElementById('historyRows').textContent.includes(${JSON.stringify(fixture.deletedTitle)})`));
    await evaluate("document.getElementById('historyReset').click()");

    // ---- Unified safe error copy.
    const messages = await evaluate(`[
      safeAdminMessage({status:500,message:'org.springframework.dao.DataIntegrityViolationException: startDate'}),
      safeAdminMessage({status:400,message:'startDate 无效'}),
      safeAdminMessage({code:'ID_CARD_TAKEN',message:'duplicate id_card_no'}),
      safeAdminMessage({status:401,message:'Unauthorized'}),
      safeAdminMessage('该位置需要同时调整其他人员或单位，请到组织调整办理')
    ]`);
    check("safe error mapping hides technical detail and keeps actionable Chinese",
      messages.every((text) => text && !/[A-Za-z]/.test(text)) && messages[2] === "该身份证号已被其他员工使用。"
      && messages[3].includes("重新登录") && messages[4].includes("组织调整"), messages);

    // ---- Static copy audit and required business labels.
    const loginText = await evaluate("document.getElementById('login').textContent");
    check("login copy no longer carries a defensive boundary explanation", !loginText.includes("仅管理员账号可登录"), loginText);
    await evaluate("selectTab('organization',document.querySelector('[data-tab=organization]'))");
    const organizationText = await evaluate("document.getElementById('tab-organization').textContent");
    check("organization adjustment no longer offers employee creation",
      await evaluate("!document.getElementById('planNewEmployee') && !document.getElementById('planNewFounder')"));
    check("organization adjustment keeps unit, founder and final-placement structure",
      organizationText.includes("部门") && organizationText.includes("团队") && organizationText.includes("公司创始人")
      && organizationText.includes("人员最终位置") && organizationText.includes("保存并生效"), organizationText.slice(0, 300));
    check("organization copy keeps the business note without defensive persistence text",
      !organizationText.includes("未保存的调整仅保留") && organizationText.includes("调整保存后生效"), organizationText.slice(0, 200));
    const consoleText = await evaluate("document.getElementById('console').textContent");
    check("admin console copy contains no prototype or development explanation",
      !/原型|演示|组件复用|接口字段|实现限制|开发过程|种子数据|安全边界|尚未交付|仅写入/.test(consoleText), consoleText.slice(0, 300));
    const labels = await evaluate(`({
      nav: document.querySelector('nav').textContent,
      employees: document.getElementById('tab-employees').textContent,
      history: document.getElementById('tab-history').textContent
    })`);
    check("required administrator labels remain visible",
      labels.nav.includes("员工") && labels.nav.includes("组织调整") && labels.nav.includes("任务历史")
      && labels.employees.includes("办理入职") && labels.employees.includes("办理离职")
      && labels.history.includes("删除状态"), labels);

    // ---- The refined directory stays usable at the supported widths.
    const output = path.resolve(__dirname, "../../output/apply-admin-lifecycle");
    fs.mkdirSync(output, {recursive: true});
    for (const width of [1440, 390, 320]) {
      await browser.viewport({width: width, height: width === 1440 ? 900 : 844, mobile: width !== 1440});
      await evaluate("selectTab('employees',document.querySelector('[data-tab=employees]'))");
      const fits = await evaluate("(()=>{const section=document.getElementById('tab-employees');return section.scrollWidth<=section.clientWidth+1})()");
      check("employee directory fits " + width, fits);
      await browser.screenshot(path.join(output, "employees-" + width + ".png"));
    }
    await browser.viewport({width: 1440, height: 900, mobile: false});
    check("no uncaught browser exception occurred", browser.errors.length === 0, browser.errors);
  } finally {
    browser.kill();
  }
})().catch((error) => { console.error(error.stack || error); process.exit(1); });
