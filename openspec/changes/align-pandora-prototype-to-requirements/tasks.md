## 1. Prototype Foundation

- [ ] 1.1 Replace the nested iframe/JSON implementation in `潘多拉-交互原型.html` with a single-document phone prototype, a preview-only role selector, and exactly five business navigation items; verify the file opens directly and each navigation item selects one corresponding page.
- [ ] 1.2 Define minimal in-memory seed data for people, company/personal items, ordinary and abstract tasks, logs, notifications, and consultations using dates relative to page load; verify a refresh restores representative today, yesterday, due-soon, urgent, pending-review, and completed examples.
- [ ] 1.3 Implement centralized visibility, assignment, edit, and reviewer rule helpers for upper, middle, and lower roles; verify switching the preview identity changes record counts and available assignees without exposing an out-of-scope task or log detail.

## 2. Five Business Pages

- [ ] 2.1 Build the 导图 2×2 layout with company information, top-ten unfinished assigned tasks, editable personal information initialized from logs, and reverse-chronological today/yesterday logs; verify upper users can edit company information, all users can edit only their personal information, and raw logs remain unchanged.
- [ ] 2.2 Build the 视图 month/week/day segmented views with date/time precision, distinct “我负责” and “我派发” treatments, urgency/deadline ordering, and an interactive `+N` overflow item; verify all three modes render the same permitted tasks at the required granularity and a crowded slot reveals its hidden tasks.
- [ ] 2.3 Build the 日志 page with role-scoped log lists plus entry points for writing logs, creating/assigning tasks, reviewing self-created tasks, and middle-role consultation; verify upper sees company logs, middle sees department logs, lower sees only personal logs, and non-authors have no edit control.
- [ ] 2.4 Build the AI地图 page from role-filtered task data with task statistics, scoped CSS word cloud, and prewritten AI advice; verify lower and middle advice is personal, upper advice is company-wide, and no aggregate view links to unauthorized record details.
- [ ] 2.5 Build the minimal 我的 page showing only name, department, and role; verify it contains no identity switch, profile editing, preferences, account administration, guide, or reset actions.

## 3. Task And Log Workflows

- [ ] 3.1 Implement task detail rendering for required attributes, multiple assignees, parent/child navigation, and abstract-task derived progress; verify the abstract example has ordinary children and exposes neither direct progress editing nor direct completion.
- [ ] 3.2 Implement role-scoped task creation and creator editing from the 日志 page; verify upper can assign company-wide, middle can assign only department subordinates, lower can only choose self, and an assignee cannot edit task-definition fields.
- [ ] 3.3 Implement self-created task approval so middle/lower submissions enter `pending-create` for their direct superior while upper self-created tasks activate immediately; verify approve and reject actions produce the specified active or rejected outcomes.
- [ ] 3.4 Implement assignee progress updates and completion submission, followed by creator or direct-superior approval/rejection; verify approval marks the task done, rejection returns it to doing, and an upper self-created task without a reviewer completes directly.
- [ ] 3.5 Implement personal log creation/editing with optional visible-task association; verify an unlinked log saves successfully, authors can edit it, and superior viewers remain read-only.
- [ ] 3.6 Implement middle-to-direct-upper consultation with pending and replied examples; verify the middle role can submit and view a result, the upper role can process its subordinate's request, and the lower role has no consultation entry point.
- [ ] 3.7 Implement the minimal notification list for task creation, due-soon, and emergency events, notifying creators and all assignees with task links; verify each type is visible to the intended example users and opens an authorized task detail.

## 4. Scope And Quality Verification

- [ ] 4.1 Remove legacy local storage, global search, drafts, personal focus/sort, log-to-task conversion, cancellation, field-change requests, schedule conflict checking, workspace controls, notification preferences, account toggles, guide, and reset code; verify static text/action searches and a full UI walkthrough find none of these capabilities.
- [ ] 4.2 Verify every scenario in `specs/pandora-requirements-aligned-prototype/spec.md` through direct browser interaction for upper, middle, and lower identities, recording any mismatch before considering implementation complete.
- [ ] 4.3 Inspect desktop and 375×812, 390×844, and 430×932 phone viewports for nonblank rendering, readable 2×2 quadrants, usable horizontal timelines, stable navigation, and modal/drawer containment; verify screenshots show no clipped text, incoherent overlap, or controls outside the viewport.
- [ ] 4.4 Validate keyboard focus, labels, dialog closing, and non-color task/status distinctions, then run `openspec validate align-pandora-prototype-to-requirements --strict`; verify the HTML interaction checks and strict OpenSpec validation both pass.
