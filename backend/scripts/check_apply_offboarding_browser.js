"use strict";
// Real Chrome acceptance for the single-entry offboarding page, administrator search and cleaned copy.
const {openBrowser, waitFor} = require("./browser_fixture");
const fixture = JSON.parse(process.env.PANDORA_OFFBOARDING_FIXTURE || "{}");
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
      await waitFor(browser, "!document.getElementById('console').hidden && state.employeeTotal===" + fixture.fullTotal, 20000));
    await evaluate("document.querySelector('[data-tab=organization]').click()");
    check("an abnormal organization names the affected team and how to fix it",
      await evaluate(`!$('healthCard').hidden && $('healthCard').textContent.includes('团队缺少负责人：缺负责人测试组')
        && $('planUnits').textContent.includes('请在下方安排负责人')`));
    await evaluate(`document.querySelector('[data-remove-unit="${fixture.emptyTeam}"]').click();
      $('planReason').value='移除未使用的测试组'; $('planSave').click()`);
    check("a structure-only save repairs the organization from the browser",
      await waitFor(browser, "$('healthCard').hidden && $('consoleOk').textContent.includes('完整组织结果已保存')"),
      await evaluate("$('planError').textContent"));
    await evaluate("document.querySelector('[data-tab=employees]').click()");

    // ---- Search owns a line and supports exact identity lookup through the request body.
    const searchRow = await evaluate(`(()=>{const input=document.getElementById('employeeQuery'),row=input.parentElement;
      return {children:row.children.length,className:row.className,label:input.labels[0].textContent,
        right:input.getBoundingClientRect().right,width:window.innerWidth,scrollWidth:row.scrollWidth,clientWidth:row.clientWidth}})()`);
    check("employee search occupies its own row and names the identity lookup",
      searchRow.children === 1 && searchRow.className.includes("employee-search")
      && searchRow.label.includes("完整身份证号"), searchRow);
    await browser.viewport({width: 320, height: 800, deviceScaleFactor: 1, mobile: false});
    const narrow = await evaluate(`(()=>{const input=document.getElementById('employeeQuery');
      const label=input.labels[0],range=document.createRange();range.selectNodeContents(label);
      return {right:input.getBoundingClientRect().right,width:window.innerWidth,labelRight:range.getBoundingClientRect().right,
        labelVisible:label.getBoundingClientRect().height>0}})()`);
    check("the search field fits a narrow window without truncation",
      narrow.right <= narrow.width + 1 && narrow.labelRight <= narrow.width + 1 && narrow.labelVisible, narrow);
    await browser.viewport({width: 1440, height: 900, deviceScaleFactor: 1, mobile: false});
    await evaluate(`document.getElementById('employeeQuery').value=${JSON.stringify(fixture.idCardLower)};loadEmployees();`);
    check("a complete identity number finds exactly one masked employee row",
      await waitFor(browser, "state.employeeTotal===1 && document.querySelectorAll('#employeeRows tr').length===1"),
      await evaluate("state.employeeTotal"));
    const maskedCell = await evaluate("document.querySelector('#employeeRows tr').cells[2].textContent.trim()");
    check("the directory still masks the identity number", maskedCell === fixture.idCardMasked, maskedCell);
    check("the page never contains the complete identity number",
      !(await evaluate("document.body.textContent")).includes(fixture.idCard)
      && !(await evaluate("document.body.textContent")).includes(fixture.idCardLower));
    check("the match count is expressed without filter instructions",
      await evaluate("document.getElementById('employeeHint').textContent==='共 1 名员工。'"),
      await evaluate("document.getElementById('employeeHint').textContent"));
    await evaluate("$('employeeDepartment').value='fixture-company-alpha';$('employeeDepartment').onchange()");
    check("the identity match is excluded by a different department", await waitFor(browser, "state.employeeTotal===0"));
    await evaluate(`$('employeeDepartment').value='fixture-company-beta';$('employeeDepartment').onchange();
      $('employeeTeam').value='fixture-company-beta-two';$('employeeTeam').onchange();
      $('employeePlacement').value='employee';$('employeePlacement').onchange();
      $('employeeActive').value='true';$('employeeActive').onchange();
      $('employeePosition').value='fixture-company-title';$('employeePosition').onchange()`);
    check("exact identity search combines with the directory filters",
      await waitFor(browser, "state.employeeTotal===1 && $('employeeHint').textContent==='共 1 名员工。'"));
    await evaluate("document.getElementById('employeeClear').click();");
    check("clearing the search restores the complete directory",
      await waitFor(browser, "state.employeeTotal===" + fixture.fullTotal), await evaluate("state.employeeTotal"));
    await evaluate("document.getElementById('employeeQuery').value='no-such-employee-anywhere';loadEmployees();");
    check("a no-match search shows the explicit empty state",
      await waitFor(browser, "state.employeeTotal===0 && document.querySelector('#employeeRows').textContent.includes('没有符合条件的员工')"));
    await evaluate("document.getElementById('employeeClear').click();");
    await waitFor(browser, "state.employeeTotal===" + fixture.fullTotal);
    await evaluate("window.__pandoraFetch=window.fetch;window.fetch=()=>Promise.reject(new TypeError('Failed to fetch'));loadEmployees();");
    check("a failed search keeps the previous rows and shows a retryable hint",
      await waitFor(browser, "state.employeeTotal===" + fixture.fullTotal
        + " && document.getElementById('employeeHint').textContent.includes('搜索加载失败')"));
    check("a failed search surfaces one safe Chinese message",
      await waitFor(browser, "document.getElementById('messageDialog').open")
      && !/[A-Za-z]/.test(await evaluate("document.getElementById('messageText').textContent")));
    await evaluate("document.getElementById('messageAccept').click();window.fetch=window.__pandoraFetch;delete window.__pandoraFetch;loadEmployees();");
    await waitFor(browser, "state.employeeTotal===" + fixture.fullTotal);

    // ---- No responsibility: direct confirmation, cancellation writes nothing.
    await evaluate(`document.querySelector('[data-offboard="${ids[fixture.nonWork]}"]').click()`);
    check("an employee without responsibilities reaches the direct confirmation",
      await waitFor(browser, "$('messageDialog').open && $('messageTitle').textContent==='确认离职' && !$('messageField').hidden")
      && await evaluate("state.offboarding==null && $('tab-employees').classList.contains('active')"));
    await evaluate("$('messageCancel').click()");
    check("cancelling the direct confirmation stays in the directory",
      await waitFor(browser, "!$('messageDialog').open && $('tab-employees').classList.contains('active')"));
    const untouched = await evaluate(`(async()=>{const r=await fetch('/api/v1/admin/employees/${ids[fixture.nonWork]}',
      {headers:{Authorization:'Bearer '+state.token}});const body=await r.json();return {status:r.status,active:body.active}})()`);
    check("cancelling leaves the employee active", untouched.status === 200 && (untouched.active === true || untouched.active === 1), untouched);
    check("the retired responsibility takeover navigation no longer exists",
      await evaluate("!state.tabs.some(([id])=>id==='takeover') && !document.querySelector('[data-tab=\"takeover\"]')")
      && !(await evaluate("document.body.textContent")).includes("业务责任盘点与接管"));
    await evaluate(`document.querySelector('[data-offboard="${ids[fixture.blockedEmployee]}"]').click()`);
    check("a third-party proposed assignee blocks offboarding with the task and next step",
      await waitFor(browser, `state.offboarding?.inventory.employeeId==='${ids[fixture.blockedEmployee]}'`)
      && await evaluate(`$('offboardingSave').disabled && $('offboardingBody').textContent.includes('third-party proposed owner')
        && $('offboardingBody').textContent.includes('先由业务方撤回或办结')`));
    await evaluate("$('offboardingBack').click()");
    check("leaving the handover page keeps the organization draft structure-only",
      await evaluate("state.offboarding===null && !('newEmployees' in state.planDraft) && !('businessTransfers' in state.planDraft)"));

    // ---- Unit-head offboarding page: separate succession, two handover kinds and pending outcomes.
    await evaluate(`document.querySelector('[data-offboard="${ids[fixture.head]}"]').click()`);
    check("the unit-head offboarding page opens with the bound inventory",
      await waitFor(browser, "state.offboarding && document.getElementById('tab-offboarding').classList.contains('active')"),
      await evaluate("document.getElementById('offboardingError').textContent"));
    const inventory = await evaluate("state.offboarding.inventory");
    const pageText = await evaluate("document.getElementById('offboardingBody').textContent");
    check("the page separates execution handover, management takeover and succession",
      pageText.includes("任务执行交接") && pageText.includes("任务管理权接管") && pageText.includes("岗位继任"));
    check("the two handover kinds use independent candidate selectors",
      (await evaluate("document.querySelectorAll('[data-candidate-kind=\"handover\"]').length")) === inventory.executionAssignments.length
      && (await evaluate("document.querySelectorAll('[data-candidate-kind=\"takeover\"]').length")) === inventory.managedTasks.length
      && (await evaluate("document.querySelectorAll('[data-candidate-kind=\"successor\"]').length")) === 1);
    const uniqueRow = await evaluate(`(()=>{const task=state.offboarding.inventory.executionAssignments
      .find(row=>row.title==='unique head task');const select=document.querySelector('[data-handover-task="'+task.taskId+'"]');
      return {required:task.replacementRequired,values:Array.from(select.options).map(o=>o.value),
        text:document.getElementById('offboardingBody').textContent}})()`);
    check("a unique live owner cannot choose removal and blocks submit until replaced",
      uniqueRow.required === true && !uniqueRow.values.includes("remove") && uniqueRow.text.includes("必须指定接手人")
      && await evaluate("document.getElementById('offboardingSave').disabled===true"), uniqueRow);
    const candidateInfo = await evaluate(`(()=>{const select=document.querySelector('[data-candidate-kind="takeover"]');
      return {labels:Array.from(select.options).map(o=>o.textContent),values:Array.from(select.options).map(o=>o.value)}})()`);
    check("same-named candidates are distinguishable by department and team",
      candidateInfo.labels.some(text => text === '同名员工（beta / beta one）')
      && candidateInfo.labels.some(text => text === '同名员工（beta / beta two）'), candidateInfo.labels);
    check("candidate selectors exclude the departing employee",
      !candidateInfo.values.includes(ids[fixture.head])
      && await evaluate("Array.from(document.querySelectorAll('[data-handover-task] option')).every(o=>o.value!==state.offboarding.inventory.employeeId)"),
      candidateInfo.values);
    check("the task selectors exclude admin and cross-company accounts",
      await evaluate(`Array.from(document.querySelectorAll('[data-handover-task] option,[data-takeover-task] option'))
        .every(option=>!${JSON.stringify([ids.admin, ids['other-admin'], ids['other-founder']])}.includes(option.value))`));
    check("the offboarding surface exposes no identity document data",
      !(await evaluate("document.getElementById('tab-offboarding').textContent")).includes(fixture.idCard)
      && !(await evaluate("document.getElementById('tab-offboarding').textContent")).includes(fixture.idCardMasked));
    const ownCard = pageText.includes("本人提交，确认后撤销（共 " + fixture.ownCount + " 项）");
    check("self-submitted requests are grouped with an explicit withdraw result",
      ownCard && fixture.ownTitles.every(title => pageText.includes(title))
      && pageText.includes("创建申请") && pageText.includes("进展申请"), pageText.slice(0, 400));
    check("a third-party request reviewed by the departing employee is shown as a reassignment",
      pageText.includes("subordinate pending") && pageText.includes("重新分配"));
    const bodyText = await evaluate("document.getElementById('offboardingBody').textContent");
    check("the page shows no request id or English application kind code",
      fixture.requestIds.every(requestId => !bodyText.includes(requestId))
      && fixture.kindCodes.every(code => !new RegExp("\\b" + code + "\\b").test(bodyText)), bodyText.slice(0, 500));
    check("the final confirmation is gated on the own-request confirmation",
      await evaluate("document.getElementById('offboardingConfirmOwn') && !document.getElementById('offboardingConfirmOwn').checked")
      && await evaluate("document.getElementById('offboardingSave').disabled===true"));

    // ---- Candidate search keeps the current choice even when it no longer matches the filter.
    const filterResult = await evaluate(`(()=>{
      const select=document.querySelector('[data-candidate-kind="takeover"]');
      select.value=${JSON.stringify(ids['beta-two-employee'])};select.onchange();
      const input=document.querySelector('[data-candidate-filter][data-target="'+select.id+'"]');
      const allCount=select.options.length;
      input.value='alpha-one-head';input.oninput();
      const filtered={value:select.value,count:select.options.length,allCount,
        selectedPresent:Array.from(select.options).some(o=>o.value===${JSON.stringify(ids['beta-two-employee'])})};
      input.value='';input.oninput();return filtered})()`);
    check("filtering candidates refuses to drop an existing selection",
      filterResult.value === ids['beta-two-employee'] && filterResult.selectedPresent
      && filterResult.count < filterResult.allCount, filterResult);

    // ---- Version conflict keeps every entered choice and asks for an explicit re-read.
    async function fillAll() {
      return evaluate(`(()=>{
        const inv=state.offboarding.inventory;
        const pick=(title,listName)=>inv[listName].find(row=>row.title===title);
        const set=(select,value)=>{select.value=value;select.onchange();};
        set(document.querySelector('[data-handover-task="'+pick('shared head task','executionAssignments').taskId+'"]'),'remove');
        set(document.querySelector('[data-handover-task="'+pick('unique head task','executionAssignments').taskId+'"]'),${JSON.stringify(ids['beta-one-employee'])});
        set(document.querySelector('[data-handover-task="'+pick('owned live head','executionAssignments').taskId+'"]'),${JSON.stringify(ids['beta-two-employee'])});
        set(document.querySelector('[data-takeover-task="'+pick('owned done head','managedTasks').taskId+'"]'),${JSON.stringify(ids['beta-one-employee'])});
        set(document.querySelector('[data-takeover-task="'+pick('owned live head','managedTasks').taskId+'"]'),${JSON.stringify(ids['beta-two-employee'])});
        set(document.getElementById('offboardingSuccessor'),${JSON.stringify(ids[fixture.successor])});
        const confirm=document.getElementById('offboardingConfirmOwn');
        if(confirm){confirm.checked=true;confirm.onchange();}
        document.getElementById('offboardingReason').value='浏览器验收离职';
        return !document.getElementById('offboardingSave').disabled;
      })()`);
    }
    check("a complete arrangement enables the final confirmation", await fillAll() === true,
      await evaluate(`({blockers:state.offboarding.inventory.blockers.map(blocker=>blocker.message),
        missing:Array.from(document.querySelectorAll('[data-handover-task],[data-takeover-task],#offboardingSuccessor'))
          .filter(select=>!select.value).map(select=>select.dataset.placeholder)})`));
    const bump = await evaluate(`(async()=>{const r=await fetch('/api/v1/admin/positions',{method:'POST',
      headers:{'Content-Type':'application/json',Authorization:'Bearer '+state.token,'Idempotency-Key':'bump-'+Date.now()},
      body:JSON.stringify({name:'并发占用 '+Date.now()})});return r.status})()`);
    check("the organization version can advance before submission", bump === 200, bump);
    const beforeConflict = await evaluate(`(()=>({values:Array.from(document.querySelectorAll('[data-handover-task]')).map(s=>s.value),
      version:state.offboarding.inventory.rowVersion}))()`);
    await evaluate("void document.getElementById('offboardingSave').onclick();");
    check("the first confirmation opens before the stale-version submission",
      await waitFor(browser, "document.getElementById('messageDialog').open"));
    await evaluate("document.getElementById('messageAccept').click()");
    check("a stale version shows a refresh instruction without clearing choices",
      await waitFor(browser, "document.getElementById('offboardingError').textContent.includes('重新读取')", 10000),
      await evaluate("document.getElementById('offboardingError').textContent"));
    check("the conflict keeps the entered handover choices",
      JSON.stringify(await evaluate("Array.from(document.querySelectorAll('[data-handover-task]')).map(s=>s.value)"))
      === JSON.stringify(beforeConflict.values) && await evaluate("!document.getElementById('offboardingReloadRow').hidden"));
    await evaluate("document.getElementById('offboardingReload').click()");
    check("the explicit re-read binds a newer organization version",
      await waitFor(browser, "state.offboarding && state.offboarding.inventory.rowVersion > " + beforeConflict.version),
      await evaluate("state.offboarding && state.offboarding.inventory.rowVersion"));
    check("the refreshed page can be completed again", await fillAll() === true);
    await evaluate("void document.getElementById('offboardingSave').onclick();");
    const confirmationOpened = await waitFor(browser, "document.getElementById('messageDialog').open");
    const confirmationText = await evaluate("document.getElementById('messageText').textContent");
    check("the final confirmation lists exactly the own requests to withdraw",
      confirmationOpened && confirmationText.includes("2 项本人待审申请")
      && fixture.ownTitles.every(title => confirmationText.includes(title))
      && !/subordinate pending|expired own request|third-party proposed owner/.test(confirmationText), confirmationText);
    await evaluate("document.getElementById('messageAccept').click()");
    check("the confirmed offboarding succeeds and returns to the directory",
      await waitFor(browser, "state.offboarding===null && document.getElementById('tab-employees').classList.contains('active')", 20000)
      && await waitFor(browser, "document.getElementById('consoleOk').textContent.includes('已办理离职')", 10000),
      await evaluate("document.getElementById('offboardingError').textContent"));
    const deactivated = await evaluate(`(async()=>{const r=await fetch('/api/v1/admin/employees/${ids[fixture.head]}',
      {headers:{Authorization:'Bearer '+state.token}});const body=await r.json();return {active:body.active,status:r.status}})()`);
    check("the departed head is deactivated", deactivated.active === false || deactivated.active === 0, deactivated);
    await evaluate(`document.querySelector('[data-tab=history]').click();void openTaskHistory('${fixture.completedTask}')`);
    check("completed work still shows the task and its management takeover in history",
      await waitFor(browser, "!$('historyDetail').hidden && $('historyDetail').textContent.includes('owned done head')"
        + " && $('historyDetail').textContent.includes('正式业务接管') && $('historyDetail').textContent.includes('浏览器验收离职')"));

    // ---- Organization copy, health visibility and unchanged company content/reorder.
    await evaluate("document.querySelector('[data-tab=\"organization\"]').click();");
    check("the organization page shows no normal-state card", await evaluate("document.getElementById('healthCard').hidden===true"));
    check("the retired deactivation/takeover summary is gone",
      await evaluate("!document.getElementById('planDepartures')")
      && !(await evaluate("document.getElementById('tab-organization').textContent")).includes("停用与业务责任安排"));
    const companyText = await evaluate("document.getElementById('companyLimit').textContent");
    check("company information keeps the limit without restating the sorting control",
      companyText.includes("当前") && companyText.includes("/ 10 条") && !companyText.includes("默认按创建顺序")
      && !companyText.includes("可人工调序"), companyText);
    const firstBody = await evaluate("document.querySelector('#companyRows tr td:nth-child(2)').textContent");
    check("existing company content is unchanged", firstBody === "第一条公司信息", firstBody);
    await evaluate("document.querySelectorAll('[data-company-up]')[1].click()");
    check("company information reordering still saves and re-renders",
      await waitFor(browser, "document.querySelector('#companyRows tr td:nth-child(2)').textContent==='第二条公司信息'", 12000),
      await evaluate("document.querySelector('#companyRows tr td:nth-child(2)').textContent"));
    const storedOrder = await evaluate(`(async()=>{const r=await fetch('/api/v1/admin/company',{headers:{Authorization:'Bearer '+state.token}});
      return (await r.json()).items.map(item=>item.body)})()`);
    check("the new order is persisted", storedOrder[0] === "第二条公司信息", storedOrder);
    await evaluate("document.querySelector('[data-company-delete]').click()");
    check("a dangerous company-information action still asks for confirmation",
      await waitFor(browser, "document.getElementById('messageDialog').open")
      && (await evaluate("document.getElementById('messageTitle').textContent")).includes("删除"));
    await evaluate("document.getElementById('messageCancel').click()");
    check("cancelling the danger confirmation keeps the company information",
      await waitFor(browser, "!document.getElementById('messageDialog').open")
      && (await evaluate("document.querySelectorAll('#companyRows tr').length")) === 2);

    await evaluate(`document.querySelector('[data-tab=employees]').click();openOnboarding();
      $('oDisplayName').value='联合回归入职员工';$('oPhone').value='13988880001';
      $('oIdCard').value='110101198910100101';$('oHireDate').value='2025-02-03';
      $('oDepartment').value='fixture-company-beta';$('oDepartment').onchange();
      $('oTeam').value='fixture-company-beta-one';$('oPosition').value='fixture-company-title';$('onboardingSave').click()`);
    check("independent onboarding still creates an account after organization repair and offboarding",
      await waitFor(browser, "!$('onboardingDialog').open && state.employees.some(e=>e.displayName==='联合回归入职员工')"
        + " && $('employeeSecret').textContent.includes('初始密码仅显示一次')"),
      await evaluate("$('onboardingError').textContent"));

    check("the console produced no browser exceptions or error logs", browser.errors.length === 0, browser.errors.slice(0, 3));

    const employee = await openBrowser(fixture.base + '/', {width: 390, height: 844, mobile: true});
    try {
      check("the employee login form is ready",
        await waitFor(employee, "['backend-login','login-user','login-password'].every(id=>document.getElementById(id))"),
        employee.errors.slice(0,3));
      await employee.evaluate(`document.getElementById('login-user').value=${JSON.stringify(fixture.employeeIdentifier)};
        document.getElementById('login-password').value=${JSON.stringify(fixture.password)};
        document.getElementById('backend-login').requestSubmit()`);
      check("an active employee can log into the employee app after offboarding",
        await waitFor(employee, `Pandora.ready&&Pandora.idle()&&Pandora.data.me.id===${JSON.stringify(ids['beta-one-employee'])}`));
      await employee.evaluate(`void openTaskDetail(${JSON.stringify(fixture.ordinaryTask)})`);
      check("the employee task still exposes the ordinary handover entry",
        await waitFor(employee, "!!document.querySelector('[data-action=p-open-handover]')"));
      await employee.evaluate("document.querySelector('[data-action=p-open-handover]').click()");
      check("employee handover offers an eligible same-department assignee",
        await waitFor(employee, `!!document.querySelector('[data-handover-target] option[value="${ids['beta-two-employee']}"]')`));
      await employee.evaluate(`const target=document.querySelector('[data-handover-target]');
        target.value=${JSON.stringify(ids['beta-two-employee'])};target.dispatchEvent(new Event('change',{bubbles:true}));
        document.getElementById('ho-reason').value='普通员工交接回归'`);
      check("the employee can submit after the reviewer preview settles",
        await waitFor(employee, "Pandora.idle() && !document.querySelector('[data-action=p-confirm-handover]').disabled"
          + " && document.querySelector('[id^=ho-preview-]').textContent.includes('提交后由该审核人处理')"),
        await employee.evaluate("document.querySelector('[id^=ho-preview-]')?.textContent"));
      const submitPoint = await employee.evaluate(`(()=>{
        const button=document.querySelector('[data-action=p-confirm-handover]');
        button.scrollIntoView({block:'center',behavior:'instant'});
        const box=button.getBoundingClientRect(),x=box.left+box.width/2,y=box.top+box.height/2;
        return {x,y,hit:document.elementFromPoint(x,y)?.closest('button')===button};
      })()`);
      check("the employee handover submit control can be clicked", submitPoint.hit, submitPoint);
      const {x, y} = submitPoint;
      await employee.send("Input.dispatchMouseEvent", {type: "mousePressed", x, y, button: "left", clickCount: 1});
      await employee.send("Input.dispatchMouseEvent", {type: "mouseReleased", x, y, button: "left", clickCount: 1});
      check("employee handover submits and closes its form",
        await waitFor(employee, "overlayEl.hidden && Pandora.idle()"),
        {page:await employee.evaluate(`({error:document.getElementById('handover-error')?.textContent,
          sheet:document.getElementById('sheetTitle')?.textContent,idle:Pandora.idle(),
          writes:performance.getEntriesByType('resource').filter(entry=>entry.name.endsWith('/handover')).length})`),
        errors:employee.errors.slice(0,3)});
    } finally {
      employee.kill();
    }
  } catch (error) {
    console.log("FAIL  " + (error && error.message || error));
    console.log((error && error.stack) || "");
    process.exitCode = 1;
  } finally {
    try { await browser.screenshot(process.env.PANDORA_OFFBOARDING_SCREENSHOT || "/tmp/admin-offboarding-browser.png"); } catch (ignored) {}
    browser.kill();
  }
})();
