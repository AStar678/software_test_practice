## 1. Static File Separation

- [x] 1.1 Extract the current inline stylesheet into adjacent `潘多拉-交互原型.css`, replace the style block with a relative stylesheet link, and verify the HTML contains no application style block and the direct-open page retains its existing layout.
- [x] 1.2 Extract the current inline script into adjacent `潘多拉-交互原型.js`, load it as a deferred classic script, and verify `node --check 潘多拉-交互原型.js` passes and all five pages render from the unchanged HTML entry over `file://`.
- [x] 1.3 Smoke-test the extracted baseline before behavioral edits by switching all three demo identities, opening each main page plus a task and log detail sheet, and verify the browser console and resource load log contain no errors.

## 2. Compact Task Encoding

- [x] 2.1 Add a broad multi-hue low-saturation task palette and deterministic task-to-color assignment, including dynamically created tasks, and verify multiple visible tasks use stable distinct colors until the palette is exhausted.
- [x] 2.2 Replace the exclusive task relationship helper with the specified assignee-first precedence for `👤 我负责`, `📤 我分配`, and `👁️ 仅可见`, and verify upper, middle, and lower demo identities each receive the correct marker without changing task visibility.
- [x] 2.3 Update shared bar rendering and the visible legend so month, week, and day bars contain only the emoji prefix and task name while retaining a complete accessible button name and full detail sheet; verify descriptions and other metadata do not appear inside any task bar.

## 3. Month Grid And Overflow

- [x] 3.1 Add displayed-month range helpers covering complete Monday-to-Sunday weeks, query tasks against that grid rather than only the natural month, and verify leading/trailing adjacent-month dates and their intersecting tasks appear for months that start or end midweek.
- [x] 3.2 Implement pure per-date task selection using the existing stable sort: select up to five tasks when the count is at most five, otherwise select four and register the remaining tasks for date-specific overflow; verify fixture cases for 0, 5, and 6+ tasks produce no overflow, five bars, and four bars plus the correct `+N`, respectively.
- [x] 3.3 Convert selected daily occurrences into weekly contiguous segments and greedily assign at most five lanes, and verify a cross-day task remains continuous until a view or capacity boundary and resumes with the same color, relationship marker, title, and target after any overflow interruption.
- [x] 3.4 Replace the month HTML/CSS with seven in-cell date buttons per week above five stable task rows, size the date band to approximately 1.5 task-row heights, remove the week gutter and duplicate weekday header, and verify the grid has no horizontal overflow at the 390px phone width.
- [x] 3.5 Scope each month `+N` entry to one ISO date and its permission-visible hidden tasks, and verify clicking it opens the correct dated overflow list and each listed task opens its existing detail sheet.
- [x] 3.6 Limit month-to-week event handling to date-header buttons carrying the containing week's anchor, and verify clicking any date header opens the correct week while clicking blank task space does nothing and clicking a task opens only its detail.
- [x] 3.7 Re-run week/day navigation and time-geometry checks, and verify week blank-day drill-down, previous/next navigation, upward navigation, and day/hour rendering remain behaviorally unchanged apart from compact colored task labels.

## 4. Log Finding Controls

- [x] 4.1 Add `logsMineOnly` and normalized `logAuthorQuery` state, reset both on identity changes, and implement a filtering pipeline that starts with `visibleLogs(actor)` before applying both predicates; verify no query can return an author outside the current role's permission scope.
- [x] 4.2 Render an independent “日志查找” card only for upper/middle identities when the active content is “日志”, with an `aria-pressed` self toggle, labeled author search input, and clear action; verify lower users and all non-log content lists do not show or consume these controls.
- [x] 4.3 Add toggle and delegated input handling that updates the log results/count without rebuilding the focused search field, and verify repeated toggle clicks restore the prior authorized scope and continuous multi-character typing does not lose focus or cursor position.
- [x] 4.4 Render the intersection of self and author conditions, distinguish no-visible-logs from no-matching-logs empty states, and verify searches for self, another authorized author, an unauthorized author, and a nonexistent name produce the specified results while other content-filter counts remain unchanged.
- [x] 4.5 Verify switching away from and back to “日志” preserves the current identity's finding conditions, switching identities resets them, and the existing return-to-top action preserves the active content and log-finding state.

## 5. Integrated Verification

- [x] 5.1 Run JavaScript syntax and OpenSpec validation checks, and verify the split prototype contains no external runtime dependency, network request, build prerequisite, or unintended inline application CSS/JavaScript.
- [x] 5.2 Use the repository's headless Chrome/CDP workflow to exercise month, week, day, overflow, task detail, own-log toggle, and author-search interactions for all three identities, and verify there are no console errors, unauthorized records, accidental month blank-space drill-downs, or broken direct-file resources.
- [x] 5.3 Capture and inspect desktop and narrow-mobile screenshots of a populated month view and the upper/middle log page, and verify dates, five fixed lanes, low-saturation task colors, emoji markers, `+N`, search controls, text, and navigation neither overlap nor cause horizontal scrolling.
- [x] 5.4 Review keyboard and accessible behavior for date buttons, task bars, overflow entries, self toggle, search input, clear action, and sheets, and verify focus indicators, text/ARIA relationship labels, activation, and task-detail separation work without relying on color alone.
