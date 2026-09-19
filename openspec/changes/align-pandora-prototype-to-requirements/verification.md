# Implementation Verification

- Change: align-pandora-prototype-to-requirements
- Schema: spec-driven
- Verdict: FAIL
- Verified revision: `337ad0e8584cc6b31bff874a258f0f5319b2200f` (implementation worktree was clean before this report was created)

## Summary

OpenSpec strict validation passes, and independent headless-Chrome checks passed 25 of 26 normative scenarios. The principal task, log, review, notification, consultation, AI-map, and strict-scope workflows execute without runtime exceptions. Three actionable implementation findings remain: related-task details bypass the lower-role visibility boundary, the task form cannot preserve or create abstract-parent relationships, and the preview toolbar pushes the bottom navigation below every tested viewport. No repository test suite exists; browser evidence was collected through Chrome DevTools Protocol against the directly opened HTML file.

## Checks

| Command or inspection | Result | Notes |
| --------------------- | ------ | ----- |
| `openspec validate "align-pandora-prototype-to-requirements" --type change --strict --json --no-interactive` | PASS | Change valid; zero structural issues. |
| Context, implementation, Git revision, and task-state inspection | PASS | All context files reread; 19/19 tasks checked; implementation commit is `337ad0e`; no unrelated worktree changes existed before report creation. |
| Static scope scan of `潘多拉-交互原型.html` | PASS | Single document; no iframe, browser storage, external resources, or prohibited legacy feature strings/actions found. |
| Headless Chrome scenario harness at 390x844 | FAIL | 25/26 normative scenarios passed; unauthorized related-task metadata was reproducibly visible. No runtime exceptions occurred. |
| Headless Chrome task-relationship form inspection | FAIL | Abstract task `t1` is absent from create/edit parent options; saving child `t2` without changing fields changed `parentId` from `t1` to `null`. |
| Headless Chrome viewport inspection at 375x812, 390x844, 430x932, and 1280x900 | FAIL | Screenshots were nonblank, but bottom navigation was below the viewport in all four sizes. |
| Repository test/build command discovery | NOT AVAILABLE | No package manifest, automated tests, CI configuration, or documented test command is present outside OpenSpec artifacts. |

## Requirement Coverage

| Requirement / scenario | Evidence | Result |
| ---------------------- | -------- | ------ |
| Five-page navigation / Navigate across the prototype | Browser clicked all five tabs; each selected exactly one matching page and retained actor `u1`. | PASS |
| Four-quadrant dashboard / View the four dashboard quadrants | Lower-role render contained four quadrants, 10 company items, four assigned unfinished tasks, three personal excerpts, and ordered today/yesterday logs. | PASS |
| Four-quadrant dashboard / Edit personal information | Browser changed a personal excerpt to `个人摘录验证`; its source log remained byte-for-byte unchanged. | PASS |
| Four-quadrant dashboard / Executive maintains company information | Upper-role edit propagated after switching to middle; middle had zero company edit buttons. | PASS |
| Calendar task views / Switch time granularity | Month showed “精确到天”; week/day showed “精确到时刻”; each mode had one active segment. | PASS |
| Calendar task views / Handle crowded time slots | Current-month crowded cell rendered `+N`; activating it opened four hidden authorized tasks. | PASS |
| Role-scoped visibility / Compare role visibility | Browser observed upper 18 tasks/12 logs, middle 14/8, and lower 7/3 with role-specific page content. | PASS |
| Role-scoped visibility / Prevent unauthorized detail access | Direct unrelated task/log detail checks returned null, but lower-role task `t3` exposed invisible parent `t1` and sibling `t2` titles/status metadata. | FAIL (V-001) |
| Role-scoped task creation / Manager assigns a departmental task | Middle form offered only `m1,e1,e2`; publishing to `e1` produced active `todo` task and creator/assignee notification. | PASS |
| Role-scoped task creation / Employee submits a self-created task | Lower form offered only `e1`; saved task entered visibly distinct `pending-create`. | PASS |
| Role-scoped task creation / Superior reviews a self-created task | Middle approved a new lower task to `todo`; a separate pending task was rejected, retained its reason, and left the execution list. | PASS |
| Task structure and attributes / Parent-child support | Static and browser inspection found parent rendering, but create/edit forms exclude abstract parents and editing existing child `t2` removed `parentId=t1`. | FAIL (V-002) |
| Task structure and attributes / Inspect a child task | Authorized upper-role child detail displayed parent and sibling navigation. | PASS |
| Task structure and attributes / Inspect an abstract task | Abstract `t1` displayed ordinary children and derived progress with no update-progress or submit-complete action. | PASS |
| Task editing and completion / Assignee updates progress | Lower assignee changed `t4` to 55% with a note; title remained unchanged and no task-definition edit permission was available. | PASS |
| Task editing and completion / Creator approves completion | Assignee submission entered `pending-complete`; creator approval changed it to `done`. | PASS |
| Task editing and completion / Superior rejects completion | Middle rejection changed the self/assigned completion request back to `doing` and retained `需补材料`. | PASS |
| Task editing and completion / Upper self-created direct completion | Upper self-created `t12` had no reviewer and changed directly to `done`. | PASS |
| Required notifications / Notify on task creation | New assigned task notified creator and assignee; approved lower self-task notified its deduplicated creator/assignee identity. | PASS |
| Required notifications / Surface due and emergency notices | Lower inbox contained create, due, and emergency types; seeded recipients include each task creator and all assignees. | PASS |
| Personal work logs / Write an unlinked log | Lower created a log with `taskId=null`, then edited its content successfully. | PASS |
| Personal work logs / Superior reads a subordinate log | Middle opened the lower log read-only; no edit action was present and the detail stated author-only editing. | PASS |
| Manager consultation / Manager submits a consultation | Middle submitted to `u1`; upper inbox received it and replying changed status to `replied`. | PASS |
| Manager consultation / Employee cannot submit a consultation | Lower log page contained no consultation action. | PASS |
| Role-scoped AI map / View employee AI map | Lower page showed `本人范围`, `部门聚合`, and `个人向`; corrected scoped inspection found zero task/log detail links. | PASS |
| Role-scoped AI map / View executive AI map | Upper page showed `全公司范围`, `公司聚合`, and `公司级` with no record links. | PASS |
| Minimal profile / View profile | Middle page showed name, department, and role only; no edit, preference, account, guide, reset, or identity-switch action appeared inside the page. | PASS |
| Strict prototype scope / Inspect available actions | Full static/UI inspection found none of the prohibited legacy capabilities; HTML uses in-memory state and no external resources. | PASS |
| Design/task constraint / Multi-viewport containment | DOM geometry and screenshots at all required phone widths were nonblank, but navigation ended 97.5px below each mobile viewport because the preview bar remained in flow above a `100dvh` phone. | FAIL (V-003) |
| Design/task constraint / Keyboard and dialog behavior | New-log dialog autofocus, Escape close, focus restoration, accessible labels, and non-color task/status labels passed browser inspection. | PASS |

## Findings

### V-001: Related-task rendering leaks out-of-scope task metadata

- Category: implementation
- Severity: high
- Requirement: Role-scoped visibility / Prevent unauthorized detail access
- Evidence: `visibleTasks()` correctly limits lower `e1` to `t3,t4,t6,t8,t9,t16,t18` at `潘多拉-交互原型.html:625`, but `taskDetailView()` reads raw parent, child, and sibling collections at lines 1243-1245 and renders them at lines 1274-1296 without applying that visibility set. In Chrome, lower `e1` opening authorized child `t3` saw invisible parent `尝试涉足新产品` (`t1`) and sibling `开辟北交校徽产线` (`t2`), including status, urgency, and deadline metadata.
- Expected: Lower users see only tasks they are responsible for; all related-task sections and navigation must respect the same visibility rule as direct detail access.
- Actual: An authorized child detail exposes metadata for unauthorized parent and sibling tasks, although activating those links is later blocked.
- Repair guidance: Filter parent, children, and siblings through `visibleTasks(actor())` before rendering; omit inaccessible relations or replace them with a non-identifying relationship indicator.
- Acceptance checks: As lower `e1`, open `t3` and confirm neither `t1` nor `t2` identifying metadata is present; as upper, confirm authorized parent/child/sibling navigation still works; direct unauthorized task/log detail checks must remain blocked.
- Repair status: pending
- Repair notes: None yet.
- Reverification notes: Initial verification reproduced this in Chrome and by static trace.

### V-002: Task editing destroys abstract-parent relationships

- Category: implementation
- Severity: medium
- Requirement: Task structure and attributes / parent-child and abstract-task composition
- Evidence: `parentCandidates()` only returns normal tasks at `潘多拉-交互原型.html:643-646`, so abstract task `t1` never appears as a parent candidate. The edit form also filters parent candidates at line 1384. In Chrome, `t2.parentId` was `t1` before opening its creator-authorized edit form; `t1` was absent from the select, and saving unchanged fields set `t2.parentId` to `null` through lines 1592 and 1616.
- Expected: Users authorized to create/edit task structure can associate ordinary children with an abstract task, and saving unrelated edits preserves an existing valid parent.
- Actual: Abstract parents cannot be selected, and editing an existing abstract child silently removes the relationship.
- Repair guidance: Include visible abstract tasks as valid parent candidates for ordinary tasks, preserve the current parent in edit options, and prevent invalid cycles without excluding the current valid relationship.
- Acceptance checks: Create an ordinary child under `t1`; edit and save existing children `t2`/`t3` without changing parent; confirm `parentId` remains `t1` and abstract derived progress/children update correctly.
- Repair status: pending
- Repair notes: None yet.
- Reverification notes: Initial verification reproduced both missing selection and silent relationship removal in Chrome.

### V-003: Preview toolbar pushes primary navigation below tested viewports

- Category: implementation
- Severity: medium
- Requirement: Design goals and tasks 1.1, 4.3 / narrow-screen direct viewport and stable navigation
- Evidence: At `潘多拉-交互原型.html:280-284`, the phone receives `height:100dvh` on narrow screens, while the preview bar at lines 289-297 remains in normal flow above it. Chrome geometry measured the preview bar ending at 89.5px, phone starting at 97.5px, and navigation bottoms at 909.5/941.5/1029.5px for 375x812, 390x844, and 430x932 respectively. `nav.bottom > innerHeight` in every required mobile viewport; 1280x900 also required page scrolling to reach the navigation.
- Expected: The direct-open prototype fits the active phone experience within the tested viewport, with stable five-page navigation available without scrolling the outer document.
- Actual: The phone consumes a full viewport below the preview toolbar, making the primary navigation initially off-screen and increasing document height by about 98px on mobile.
- Repair guidance: Account for preview-bar height in the phone/stage layout, or make the preview controls overlay/collapsible on narrow screens while keeping role switching clearly outside product UI.
- Acceptance checks: Recheck 375x812, 390x844, 430x932, and desktop; require the phone and bottom navigation to remain within the viewport, while internal page/timeline scrolling and all three preview identities remain usable.
- Repair status: pending
- Repair notes: None yet.
- Reverification notes: Initial verification reproduced the geometry failure and captured nonblank screenshots at all four sizes.
