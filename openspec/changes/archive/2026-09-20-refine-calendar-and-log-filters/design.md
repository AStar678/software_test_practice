## Context

See `proposal.md` for motivation. The prototype is a single 2366-line HTML file: lines 6-338 contain all CSS, lines 414-2363 contain all data and behavior, and the static body between them supplies stable DOM anchors. It has no package manifest, build system, external dependency, persistence, or automated test suite. View rendering is string-based and uses document-level event delegation; log content is derived from in-memory role-scoped data.

The existing month renderer computes week rows but filters tasks to the natural month, uses a separate week-range gutter, and puts one invisible drill-down button behind each whole week row. It also caps the entire week at three lanes. The existing log renderer has one state value for its single-choice content filter and always renders every role-visible log.

## Goals / Non-Goals

**Goals:**

- Preserve the directly-openable, dependency-free prototype while separating structure, presentation, and behavior.
- Give the month view a deterministic, testable date-cell and lane model that can represent cross-month dates, spanning tasks, per-date overflow, and explicit drill-down targets.
- Keep task identity color separate from the current user's relationship to the task.
- Compose log author controls after permission filtering without disrupting the existing content-filter model or typing focus.

**Non-Goals:**

- Introducing modules, a bundler, framework, package manager, backend, persistence, or URL routing.
- Changing task visibility, sorting, task details, week/day time geometry, or existing log permissions.
- Building a general search service or searching log bodies and linked tasks.

## Decisions

### 1. Keep the HTML entry name and extract adjacent classic resources

Retain `潘多拉-交互原型.html` as the entry point, move its style block verbatim into `潘多拉-交互原型.css`, and move its script block into `潘多拉-交互原型.js`. The HTML head will load the stylesheet with a relative `link` and the classic script with `defer`.

Classic deferred JavaScript is chosen over an ES module because the prototype must continue to work from a `file://` URL without a server or module-origin restrictions. The split preserves current global ordering and DOM IDs, so it does not require an application architecture rewrite. Keeping the existing filename also avoids invalidating documentation and bookmarks.

Alternative considered: retain one file. This avoids two requests but leaves unrelated CSS, data, renderers, forms, and event handlers coupled in a file already too large for safe incremental editing.

### 2. Model the month as a complete displayed grid range

The selected natural month remains the toolbar anchor and label. A separate displayed range will run from the Monday at or before the first day through the Monday after the final displayed Sunday. Task intersection for month rendering will use this displayed range, allowing adjacent-month dates and tasks to render normally. Adjacent-month cells will use reduced text emphasis plus an accessible class/name rather than opacity or color alone.

Each week row will contain:

- a seven-column date-header band with one real button per date;
- a seven-column background grid;
- five fixed-height task lanes below the date band.

The date button will carry the week's Monday in `data-drill-week`. No drill target will cover the task area, which removes accidental blank-space navigation. A CSS variable will define one task-row height; the date band will derive an approximately 1.5x minimum height from it so sizing stays stable across viewports.

Alternative considered: retain the weekday axis and left week-range gutter. That duplicates date information and consumes the narrow mobile width the requested in-cell date header needs.

### 3. Compute per-date visibility, then merge adjacent task segments

For each displayed date, intersect visible tasks with that date and apply the existing stable sort. Dates with up to five tasks select all five. Dates with more than five select the first four and create an overflow item containing every remaining task for that date; therefore `+N` is `activeCount - 4`.

Selected occurrences will be converted into contiguous weekly segments. Consecutive dates for the same selected task are merged when a lane can remain stable; an occurrence hidden by overflow ends the segment, and a later visible occurrence starts another. A greedy interval-lane assignment can use at most five lanes because each date contributes at most five visible items, including the overflow item. This retains continuous Gantt bars wherever capacity permits while making overflow genuinely date-specific.

Overflow groups will include the ISO date in their key and dialog title, rather than the current week-wide grouping. Existing permission-checked task detail opening remains the only destination from overflow results.

Alternative considered: render five independent task snippets inside every date cell. That makes overflow simple but discards the defining cross-date continuity of a Gantt view.

### 4. Use a stable low-saturation task palette and orthogonal relation markers

Define a sufficiently varied low-saturation palette as paired background/border CSS custom properties. Assign a task's palette index from a stable task-ID registry in task insertion order, modulo palette length; colors therefore remain stable during a session and repeat only after the palette is allocated. Dynamically created tasks join the same registry.

The mutually exclusive relationship helper will use this precedence:

1. current user is among the assignees: `👤` and “我负责”;
2. otherwise current user is the creator: `📤` and “我分配”;
3. otherwise the task is visible only by role scope: `👁️` and “仅可见”.

Bars in all three time views will render only the relation emoji and title. The emoji will be hidden from assistive technology inside the bar, while the button's full accessible name and the visible text legend convey the relationship in words. Task descriptions and other metadata stay in the detail sheet and accessible button label, not in visible bar text.

Alternative considered: encode relationship with border style as today. It remains useful but competes visually with unique task colors and is harder to parse in narrow bars; the compact semantic prefix is more direct.

### 5. Add log-finding state after authorization and isolate result updates

Add `logsMineOnly` and `logAuthorQuery` to UI state and reset both on identity changes. `visibleLogs(actor)` remains the authorization boundary. The log-result pipeline will then apply the self predicate and normalized author-name substring predicate, followed by the existing reverse-time ordering.

Render the new “日志查找” card only for upper/middle roles while the single-choice content filter is `logs`. The existing content-filter count continues to represent the total permission-visible log count; the results heading reports the filtered count. Other lists and their counts never consume the new predicates.

The toggle uses `aria-pressed`; the author field uses `type="search"`, an explicit label, and a clear affordance. A delegated `input` handler updates only the results section and count instead of rebuilding the entire page, preserving cursor and focus while typing. Empty results distinguish “no matching logs” from “no visible logs.”

Alternative considered: make authors another radio content filter. That would mix a combinable query with mutually exclusive business lists and recreate the organization problem called out in the request.

## Risks / Trade-offs

- [Month interval layout is more complex than week-wide lanes] → Keep date selection, segment merging, lane allocation, and HTML rendering as separate pure helpers; cover dense and cross-month fixtures explicitly.
- [A long task may be visually interrupted on an overcrowded date] → Only split at a real per-date overflow boundary and preserve the same color, emoji, title, and task target when it resumes.
- [Emoji appearance varies by platform] → Pair each symbol with a text legend and accessible relationship label; reserve fixed marker width so glyph differences do not shift the bar geometry.
- [Many globally known tasks eventually reuse colors] → Use a broad multi-hue low-saturation palette and keep relation meaning independent of fill color.
- [External files can be moved apart] → Keep all three filenames adjacent and verify direct `file://` loading; the HTML entry should fail visibly rather than silently if a resource is missing.
- [String-rendered search updates can lose input focus] → Re-render only the results container on `input`, and test continuous multi-character entry.

## Migration Plan

1. Extract CSS and JavaScript without behavioral edits, reference both from the unchanged HTML entry, and verify all five pages and sheets still load from `file://`.
2. Introduce task palette/relation helpers and reduce visible bar content across month, week, and day views.
3. Replace only the month renderer and month drill event target, retaining shared detail and overflow entry behavior.
4. Add log-finding state, card, result pipeline, and focused input/result event handling.
5. Run syntax/static checks and browser interaction/visual checks at desktop and narrow mobile sizes for all three identities.

Rollback is a normal source revert: restore the inline style/script blocks and previous renderers together. No stored user data or schema migration is involved.
