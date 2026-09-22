## 1. Unify the Task Model

- [x] 1.1 Update task defaults and every seed task with immutable `createdAt`, explicit `allDay`, valid start/due values and at least one assignee; convert or remove the abstract example and remove system-style title prefixes, then verify all seed tasks satisfy the unified model in the three role views.
- [x] 1.2 Remove task `type`, numeric `progress`, abstract aggregation/status helpers and their compatibility branches while retaining `parentId`, discrete `status` and text `progressNote`; verify JavaScript searches outside archived OpenSpec files find no live abstract/progress model branches.
- [x] 1.3 Add common task-range, formatting and descendant-detection helpers for timed/all-day intersection, inclusive all-day end dates and arbitrary-depth parent-cycle prevention; verify same-day, multi-day, cross-month and descendant candidates produce the expected ranges and exclusions.

## 2. Add Searchable Selection Workflows

- [x] 2.1 Introduce short-lived task and log form draft state, synchronize form inputs before nested navigation, restore forms from drafts, and clear drafts on outer cancel or identity change; verify unsaved text, time, urgency and selections survive nested picker return but do not leak after cancel or role switch.
- [x] 2.2 Replace the log-linked-task and parent-task native selects with the reusable searchable task picker, including current selection, clear, confirm/cancel and empty states; verify case-insensitive title filtering, permission scoping, log unlinking and exclusion of self/all descendants.
- [x] 2.3 Build the separate assignee picker with an authorized department control, per-department name search, checkbox multi-select and persistent selected summary; verify upper users can confirm selections across departments, middle users only see self and lower users in their department, and lower users remain fixed to self without the picker.
- [x] 2.4 Revalidate selected task/person IDs, at least one assignee, parent cycles and actor permissions in save handlers rather than trusting rendered controls; verify tampered or stale draft IDs are rejected with a clear form error.
- [x] 2.5 Add responsive styles for picker search rows, department selection, fixed-size result items, selected-person summaries and empty states; verify long task/person names fit without overlap at 375, 390 and 430 pixel viewport widths.

## 3. Separate Creation Time From Task Scheduling

- [x] 3.1 Replace the deadline-only task inputs with an all-day toggle and start/end date controls plus conditional time controls, preserving appropriate date/time draft values when toggled; verify valid timed and all-day tasks save while inverted ranges are blocked inline.
- [x] 3.2 Record `createdAt` only on creation and show it read-only alongside a separately formatted schedule in task details; verify editing dates, times or all-day mode changes the schedule without changing creation time.
- [x] 3.3 Route month, week and day filtering, sorting and bar geometry through the common task-range helper, using full date columns for all-day tasks; verify timed and all-day tasks spanning view boundaries render from their planned starts through their deadlines.
- [x] 3.4 Add a stable all-day band to day view and keep timed tasks in hourly lanes, including task opening and overflow behavior; verify a task covering the selected day appears exactly once in the correct band and does not fabricate 00:00/24:00 labels.
- [x] 3.5 Replace week-axis labels with accessible weekday/date buttons and remove the transparent task-body drill layer and related CSS; verify only a header click opens that day while task clicks open details and blank week-body clicks do nothing.

## 4. Use Status-Only Completion Tracking

- [x] 4.1 Remove initial/current percentage inputs, progress validation/calculation, progress bars and percentage text from forms, dashboard items, task lists, details, child summaries and review lists; verify each surface shows status plus optional text notes with no numeric progress UI.
- [x] 4.2 Rename the assignee action to “更新进展”, save only the text note and move `todo` to `doing` on the first saved note; verify submission, approval, rejection and direct upper-level completion still follow the existing discrete status transitions.
- [x] 4.3 Render parent and child tasks as the same executable type, with visible-child status rows and optional completed-count summary only; verify parents retain their own assignees, actions and status and are not completed by child state changes.

## 5. Correct Notification and Requirement Semantics

- [x] 5.1 Generalize notification seed records and rendering to task, review and consultation targets with event labels for creation, information changes, urgency changes, status/completion, due reminders, review requests/results and consultation/replies; verify each role sees only recipient records and authorized targets open correctly.
- [x] 5.2 Include representative recipient sets for creators, current/new/removed assignees, reviewers and consultation participants, remove the `emergency` category and partial runtime notification generation, and verify urgent examples use real titles plus the urgency attribute and an urgency-change record.
- [x] 5.3 Revise `需求初步整理.md` to describe unified parent/child tasks, creation/start/deadline/all-day fields, status-only completion and broad task/review/consultation notification semantics while stating that the prototype does not implement notification triggers; verify the document no longer asserts abstract-task or percentage-progress requirements.

## 6. Validate the Integrated Prototype

- [x] 6.1 Run `node --check 潘多拉-交互原型.js` and `openspec validate refine-task-workflows-and-notifications --strict`, resolving every syntax or specification error.
- [x] 6.2 Scan current prototype, current requirements and active specs for `abstract`, `抽象任务`, numeric-progress UI, `progress-track`, `临时紧急` and body-level week drill targets; verify any remaining matches are intentional field names for text notes or historical archived artifacts only.
- [x] 6.3 Open `潘多拉-交互原型.html` directly and exercise desktop plus 375x812, 390x844 and 430x932 layouts for upper, middle and lower identities; verify picker search/rollback, permission boundaries, timed/all-day creation, creation-time preservation, header-only drill-down, status/review flows, notifications and absence of overlap or horizontal scrolling.
