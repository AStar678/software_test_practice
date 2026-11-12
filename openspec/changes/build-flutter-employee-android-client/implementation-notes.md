# Implementation Notes

> 本文件是本 change 的 **apply 交接文档**：由实施者在完成或暂停时更新，供下一位实施者/独立验证者定位证据。它不是 schema artifact，不是验证结论，也不能用来豁免需求或降低验收标准。

- Change: build-flutter-employee-android-client
- Schema: spec-driven
- Store: local repo (`/home/rmy/桌面/panDuola`)
- Implementation roots: `flutter/` (new Flutter Android client), with read-only consumption of `backend/docs/employee-client-contracts.md` and the archived A change
- Updated: 2026-11-12T19:25:00+08:00
- Implementation revision: repo `56313ba` plus module commits `e2781c8..ecb6b8c` (this docs commit records the task-table batch)
- Progress: **36/62** tasks checked. `1.4`, `4.1`, `4.9`, `5.1`–`5.6`, `5.8`, `5.9`, `6.1`–`6.3` are closed. `5.7` remains open only for the missing physical-device perception acceptance; chapter 7 and `2.7` remain open.
- The 2026-11-10 macOS sections below are historical; the 2026-11-12 Linux supplement at the end supersedes their environment/build status.

## Chapter 1–4 findings and decisions

### 1.1 prerequisite A (archived)

- Archive: `openspec/changes/archive/2026-11-09-prepare-employee-client-contracts-and-business-upgrade/`.
- A's verification report: verdict **PASS**, verified at `2026-11-09T22:46:00+08:00`, revision `36d15b6` plus main-spec sync. Its evidence included 128 Maven tests, 307 contract checks (V31→V35 witness), 37 holiday checks, 33 real-Chrome checks, 130 extreme-fixture checks, 15 web-resource checks. A was verified on a Windows host; no Flutter/APK/device evidence is claimed by A.
- Read after archive: main specs (`openspec/specs/pandora-requirements-aligned-prototype/spec.md`, `china-holiday-calendar`), `backend/docs/employee-client-contracts.md`, `backend/docs/api-examples.http`, archived A notes, and the demo manifest (`backend/.runtime/demo-manifest.json`).
- The four overlapping MODIFIED blocks in B's delta (`Horizontal continuous daily-item calendar`, `Daily-item status count markers`, `Minimal profile page`, `Strict prototype scope`) were compared line-by-line with the post-A main spec. Every difference is B's intended replacement of A's “future B” wording (Flutter vertical calendar/bar semantics, Flutter role path and hidden identity, Flutter inclusion in scope) plus B's added scenarios. A's tenure/hire-date/authorized-email additions and the “A 保留过渡 Web” boundary remain intact. **No drift; B's planning artifacts were not edited.**
- A's `Account password lifecycle` email revision (self + actual-chain superiors only; directories/summaries/candidates never carry contact data) is inherited unchanged; the Flutter client relies on server-side `email` presence and never derives it.
- Chinese collation (contract §4.2: Java `Collator` SIMPLIFIED_CHINESE/TERTIARY/CANONICAL_DECOMPOSITION, numbers as text, NFC/NFD tie → ID asc; client must not re-sort) and log-body limit (10,000 UTF-16 code units, Java `trim` U+0000–U+0020) are consistent with B's tasks 6.1/7.3. The Flutter client provides `PasswordPolicy.utf16Length/javaTrim` ready for the chapter-7 fill merge; no re-sort is implemented.
- Consequence: implementation used the current contract, not the plan's guesses. No main-spec sync was performed (that happens only when B is archived).

### 1.2 web baseline, isolated backend, fixtures

- Final Web entry: `index.html` immediately replaces the location with `潘多拉-交互原型.html` (file:// → `http://127.0.0.1:8080/`). That page loads, in order and with `defer`:
  1. `潘多拉-交互原型.js` 2. `潘多拉-api.js` 3. `潘多拉-任务接入.js` 4. `潘多拉-工作区接入.js` 5. `潘多拉-日程视图.js` 6. `潘多拉-任务表单.js` 7. `潘多拉-个人资料.js` 8. `潘多拉-标签评论.js` 9. `潘多拉-每日事项.js`.
  Later scripts override earlier ones; that final state is the behavior baseline.
- Isolated backend: `backend/scripts/start-demo.sh` rebuilt `pandora_demo` on 2026-11-10 and started it on `http://127.0.0.1:8080` (API `/api/v1`, businessDate 2026-11-10, `Asia/Shanghai`). It drops/recreates only the demo DB; the normal `pandora` DB is untouched. Reproducible: `cd backend && ./scripts/start-demo.sh`; stop with `./scripts/stop.sh`. Demo password is the documented `Demo@123456`; demo manifest IDs are under `backend/.runtime/demo-manifest.json` (not committed).
- Four real roles used: founder 13800000001, department head 13800000002, team head 13800000011, ordinary employee 13800000004 (verified login/`/me` for all four in the real-service test); further demo employees exist for subordinate browsing.
- Fixtures: 28 sanitized real responses under `flutter/test/fixtures/api/`, captured by `flutter/tool/capture_api_fixtures.py` (no tokens stored). This includes tasks, task detail, table, home, daily items (range/day/paged/summary), approvals (applicant/reviewer), notification, candidates, handover preset, comments.
- Coverage integrity re-checked against the same change artifacts (not edited): `coverage.md` still has 90 business rows, 54 main-spec rows, 12 guidance rows and 32 J-path rows. Chapter 1–4 tasks land them as mapped; chapters 5–11 remain the landing points for the rest.
- B acceptance evidence index: fixtures + `test/integration/real_backend_test.dart` (real service) + widget tests + this file. No fabricated acceptance record.

### 1.3 toolchain

- Flutter 3.47.9 stable, Dart 3.13.7 (`/opt/homebrew/share/flutter`), JDK 21.0.7 (Homebrew), Maven 3.9.9, MySQL 26.10 Homebrew.
- Android SDK at `/opt/homebrew/share/android-commandlinetools`: platform `android-36`, build-tools `36.0.0`, emulator 37.2.13.0, adb 1.0.41; **all licences accepted**; `flutter doctor` passes Android toolchain. Target/compile SDK follows Flutter stable (36), `minSdk = 26`, ABI default.
- Devices: `adb devices` shows no attached device. One AVD exists (`employee_api36`, API 36). No API-26 system image is installed, so the Android 8 boundary cannot be checked on this host yet.
- SDK pin added as `flutter/.fvmrc` (`flutter: 3.47.9`); dependencies locked by `flutter/pubspec.lock`: riverpod 3.5.0, go_router 18.1.4, dio 5.11.1, flutter_secure_storage 11.2.0, timezone 0.11.2, image_picker 1.2.4, image 4.12.0, shared_preferences 2.5.6, intl 0.20.3, flutter_svg 2.2.3.
- **Build attempt (after the user approved the work)**: the wrapper bootstrap was solved by pre-seeding the approved Tencent mirror copy of `gradle-9.3.1-all.zip` (SHA-256 `17f277867f6914d61b1aa02efab1ba7bb439ad652ca485cd8ca6842fccec6e43`) into a workspace-local `GRADLE_USER_HOME`. This proved the blocker was toolchain bootstrap, not Flutter code. Two real config bugs then surfaced and were fixed:
  1. `android/app/build.gradle.kts` release block set `isMinifyEnabled = false` while the Flutter Gradle plugin enables `shrinkResources`; AGP rejects that combination. The line was removed and replaced with a comment explaining the plugin owns release minify/shrink.
  2. `android/app/src/debug/AndroidManifest.xml` set a different `android:label` from the main manifest; the third build reached manifest merging and failed. Fixed with `xmlns:tools` + `tools:replace="android:label"`.
- Build #1 failed in 6m50s at configuration; build #2 failed in 5m23s at `processDebugMainManifest`; during these runs Gradle downloaded ~2.6GB of plugins/dependencies, Android SDK Platform 35 and NDK 28.2.13676358 (~2.8GB). Build #3 was still running when the user asked to stop; no APK was produced and **task 1.4 stays unchecked**.
- **Cleanup performed at the user's request**: killed the build and emulator, removed `flutter/build`, `flutter/.gradle`, `flutter/android/.gradle`, the `~/.gradle` wrapper leftovers, the auto-installed Android `platforms/android-35` and `ndk/28.2.13676358`, and stopped the emulator. The workspace `.gitignore` now ignores `.gradle/`. Android SDK is back to its pre-build state (only `platforms/android-36`, build-tools 36.0.0). The demo backend was left running for the verifier.
- Next build needs the Gradle distribution again (removed), will re-download NDK/platform 35 unless they are intentionally installed, and must record the source/checksum of any mirror together with the resulting APK/install evidence.

### 1.4 project shape

- New `flutter/` project, package identity `cn.pandora.employee.flutter`, debug suffix `.debug`, version `1.0.0+1`, app label 潘多拉 / 潘多拉开发版. Old apps stay independent: root `android/` uses `cn.pandora.workspace` (+`.debug`), the transition shell is `cn.pandora.mobile.debug`; no shared signature/config, no local credential import.
- Layering: `lib/core/{company,config,errors,net,preferences,router,session,theme,widgets}` plus `lib/features/{auth,home,daily_items,tasks,approvals,people,comments,shell,stub}`. No WebView, no business fake backend in `lib/` (the fixed-response adapter lives only under `test/support/`), no keys/tokens in the repo.
- Android: `network_security_config` denies cleartext and trusts only the system store in release; the debug variant permits cleartext only for 10.0.2.2/127.0.0.1/localhost. Release signing reads an external `key.properties` if present (not committed) and falls back to debug signing otherwise — the signed-release requirement remains for chapter 11.

## Implementation Map

| Task / requirement / scenario | Code and tests | Decisions / context |
| --- | --- | --- |
| 1.1 A prerequisite recheck | `openspec/changes/archive/2026-11-09-.../verification.md`, `backend/docs/employee-client-contracts.md`; finding above | Read-only; B plans untouched; no main-spec sync |
| 1.2 Web/backend/fixtures | `潘多拉-交互原型.html` script order; `backend/scripts/start-demo.sh`; `flutter/tool/capture_api_fixtures.py`, `flutter/test/fixtures/api/*` | Demo DB isolation documented; sanitized fixtures only |
| 1.3 toolchain | `.fvmrc`, `pubspec.lock`, doctor output | Build blocked at Gradle download; no device attached |
| 1.4 scaffold | `flutter/android/app/build.gradle.kts`, `AndroidManifest.xml`, `MainActivity.kt`, asset `assets/brand/pandora-mark.svg`; `flutter analyze` | Package coexistence verified; APK/run not yet evidenced |
| 2.1 dates/DTO/cursors | `core/company/company_date.dart`, `company_time.dart`, `features/tasks/domain/task_record.dart`, `features/daily_items/domain/daily_item.dart`, `features/approvals/domain/approval_request.dart`, `features/comments/domain/comment_record.dart`, `features/tasks/data/tasks_api.dart` (`TaskCursorPage`), `test/features/adapter_test.dart`, `test/core/company_date_test.dart`, `test/core/schedule_coverage_test.dart` | Date-only never converted through device TZ; all-day vs timed half-open; three cursor kinds kept separate |
| 2.2 request layer/paging states | `core/net/api_client.dart`, `pagination.dart`, `http_error_mapper.dart`, `core/widgets/state_views.dart`; `test/core/pagination_idempotency_test.dart`, `test/features/daily_items_ui_test.dart` (503 ≠ empty) | Generation-tagged windows discard late pages; `complete` only after all pages; error/empty/forbidden distinct |
| 2.3 ETag/idempotency/version | `core/net/version_registry.dart`, `idempotency.dart`, `operation_keys.dart`, `api_client.dart`; unit keys test; real 412/重复同键 tests | Per-endpoint ETags; pins use no task If-Match; same body+version reuses key; 403 never auto-retried |
| 2.4 login/secure session/refresh | `core/session/session_manager.dart`, `secure_credential_store.dart`, `features/auth/data/auth_api.dart`, `presentation/login_page.dart`; `test/core/session_manager_test.dart`; real four-role login test | Serial single-flight refresh, persist-before-release, late 401 by credential generation, expired token re-login, restricted sessions get no business token |
| 2.5 restricted password state | `features/auth/domain/password_policy.dart`, `presentation/password_change_page.dart`, router redirect; policy tests + session restricted test | Flags normalized client-side; only session/password/logout reachable; errors keep inputs |
| 2.6 account epoch/restore | `core/session/session_manager.dart`, `core/providers.dart` (`accountEpochProvider`), `core/preferences/app_preferences.dart`; `test/features/account_scope_test.dart`; startup/restore session tests | Logout/login/expiry bump epoch → account-scoped providers rebuild; only whitelisted non-sensitive prefs persist |
| 2.8 theme/input/accessibility | `core/theme/pandora_theme.dart`, `core/widgets/*`, calendar/day forms with native pickers and Semantics; 320-width test, error/empty semantics | Handjournal palette, system fonts, state never color-only; formal copy |
| 3.1 home | `features/home/presentation/home_page.dart`, `home_lists.dart`, `home_providers.dart`; `test/integration/real_backend_test.dart` home test | Three modules; 3-row previews, no inner scroll; previews open full ten-item lists; board → authorized detail |
| 3.2 range daily items | `features/daily_items/data/daily_items_api.dart`, `presentation/daily_items_providers.dart`, `daily_item_pages.dart`; real create/range/complete/delete + 93-day guard; widget day tests | Same ID across range, inclusive dates, If-Match on writes, refresh old+new months, draft kept on failure |
| 3.3 continuous item months | `features/daily_items/domain/month_layout.dart`, `presentation/daily_items_calendar.dart`; `test/features/month_layout_test.dart` | Seven columns, fixed six-week blocks, week/month continuation, 3 lanes + accurate overflow, retry per month |
| 3.4 hit-day list | `presentation/daily_items_day_page.dart`; day-list widget tests incl. 320 width and failure state | Day cell/bar/overflow all open the real hit day; completion control independent; list includes completed |
| 4.2 assignees | `features/tasks/presentation/assignee_picker.dart`, task form defaults; form widget test | Ordered multi-select, search, reorder, remove self, duplicate names numbered; manager defaults empty, employee self |
| 4.3 parent task | `task_form_page.dart` picker/search/clear, detail parent navigation with same `ReadContext` | Hidden unchanged parent is omitted from PATCH; cycles rejected by service and draft kept |
| 4.4 field-sensitive edit | `task_detail_page.dart`, `task_form_page.dart`, `domain/task_record.dart`; form payload tests | Only `editableFields` submitted; schedule-only reschedule path; metadata+progress one change; historical criterion only when allowed |
| 4.5 progress/completion | `task_detail_page.dart` actions, `approvals_pages.dart` decide flow | Notes required; review outcome reloads task; no local final-state writes |
| 4.6 reopen | `task_action_pages.dart` (`TaskReopenPage`) | Complete schedule + ordered valid assignees + reason; button only for current business owner (`businessOwnerId`) |
| 4.7 reviewer preview/applications | `tasks_api.preview`, `task_form_page.dart` outcome dialog, `approvals_pages.dart` | Preview is non-binding; after submit the real reviewer is read back from the request; founder direct outcome shown |
| 4.8 diff/audience | `approvals_pages.dart` (`_DiffRow`, `_ProposalSummary`) and widget test | Reviewer sees field diff and order-only marker; applicant sees own proposal; bystander sees summary only |
| 4.10 handover | `task_action_pages.dart` (`TaskHandoverPage`) | Source/target lists, preset read/save/clear, reason, task-version If-Match; no handover action in read-only contexts |
| 2.7 / 4.1 / 4.9 | 2.7 route skeleton still partial; 4.1/4.9 real closed paths are in `real_backend_test.dart` (resubmit, concurrent decision, pending comments) | 4.1/4.9 checked 2026-11-12; 2.7 still open |
| App-level navigation smoke | `test/features/app_navigation_test.dart` | Real providers/router with fixed responses: five-branch shell loads home, three modules, board list (all ≤10), task detail, then back through both layers |
| Header width fix | `home_page.dart` `_DailyItemsHeader` | Found by the 390-width navigation test: compact/`FittedBox` month controls so `每日事项` title, add and month tools stay on one row without overflow |

## Checks Run

| Command | Working directory / setup | Result / evidence | Run time |
| --- | --- | --- | --- |
| `openspec validate build-flutter-employee-android-client --strict --json` | repo root | valid 1/1, no issues | 2026-11-10 20:35 |
| `flutter doctor -v` | `flutter/` | Flutter 3.47.9, Android SDK 36.0.0, licences accepted; no device; Xcode incomplete (not needed) | 2026-11-10 19:47 |
| `flutter analyze` | `flutter/` | **No issues found** | 2026-11-10 20:35 |
| `flutter test` | `flutter/` | **69 tests passed** (unit, adapter, layout, widget, real-service, app navigation) | 2026-11-10 20:51 |
| `flutter test test/integration/real_backend_test.dart` | `flutter/`, demo backend on 8080 | 12 tests passed: four-role login, home, range create/read/complete/delete, 93-day guard, same-key replay, stale If-Match 412, task detail, reviewer preview, approvals paging/detail, auth error mapping | 2026-11-10 20:30 |
| `python3 tool/capture_api_fixtures.py` | `flutter/`, demo backend | 28 sanitized fixtures captured from the real 2026-11-10 demo | 2026-11-10 19:49 |
| `backend/scripts/start-demo.sh` | `backend/` | `pandora_demo` rebuilt, backend up on 8080; users 14, tasks 58, logs 18, notifications 272; businessDate 2026-11-10 | 2026-11-10 19:46 |
| `flutter build apk --debug` (3 attempts) | `flutter/`, workspace `GRADLE_USER_HOME`, seeded mirror | #1 failed at `shrinkResources`/minify config (6m50s); #2 failed at debug label manifest merge (5m23s); both config bugs fixed; #3 stopped at the user's request before producing an APK. Gradle bootstrap itself worked with the seeded distribution. | 2026-11-10 20:38–21:11 |
| `adb devices` / `emulator -list-avds` | Android SDK | AVD `employee_api36` booted headlessly and was reachable as `emulator-5554`; no physical device; no API-26 image. Emulator was stopped during cleanup. | 2026-11-10 20:47–21:13 |
| Cross-check of coverage counts | repo root | 90 / 54 / 12 / 32 rows present in `coverage.md` | 2026-11-10 20:30 |

Failed/skipped honestly (historical macOS note): Android build/device run were not done then. They were completed on 2026-11-12; see the Linux supplement. API-26 boundary and physical-device work remain untested.

## 接手前环境重检（给下一位实施者 / 验证者）

不要直接沿用本文件记录的“本机已通过”；也不要在未确认来源的情况下复用别人的 Gradle/Android 缓存或镜像。先独立重跑下列检查，把实际版本、命令和结果补回本文件，再继续实施或验证。

| 检查 | 目的 / 记录内容 |
| --- | --- |
| `flutter --version`、`dart --version`、`flutter doctor -v` | 确认 Flutter/Dart 版本与 Android toolchain、licences、设备；本项目锁定 Flutter 3.47.9（见 `flutter/.fvmrc`），但换机器需重新确认可用 stable 版本 |
| `java -version`、`mvn -v`、`mysql --version` | 后端/DB 工具链；A 的验证在 Windows，B 的实施与真机证据必须在本机重建 |
| `adb devices`、`emulator -list-avds` | 是否有真机；有哪些 AVD/系统镜像（API 26 边界需要单独镜像） |
| 检查 `flutter/android/gradle/wrapper/gradle-wrapper.properties` 与 `which gradle`、`~/.gradle/wrapper/dists` | 确认 Gradle 分发来源与本机缓存状态；记录是否可下载、是否需要镜像、镜像 URL/大小/校验和 |
| `cd backend && ./scripts/start-demo.sh`、`curl http://127.0.0.1:8080/health` | 隔离演示后端可启动；核对 `businessDate`、账号与演示数据；普通 `pandora` 库不应被重建 |
| `cd flutter && flutter pub get && flutter analyze && flutter test` | 依赖锁定与静态检查/自动测试；真服务集成测试需要 demo 后端在 8080 |
| `cd flutter && flutter build apk --debug`（或 release） | 真正能出包后才可勾选 1.4/11.x 的构建部分；记录 SDK/JDK/Gradle/AGP 版本与产物路径 |
| `adb install` + 启动应用 | 确认包名 `cn.pandora.employee.flutter.debug` 与旧 `cn.pandora.workspace(.debug)`/套壳共存；检查基本导航、登录、返回 |

环境注意事项：

- 本机当前没有可用 Gradle 分发，默认 wrapper 重定向到 GitHub release CDN 不可达；若改用镜像或本地 Gradle，请先与用户确认，记录来源（URL、字节数/SHA-256、放置位置），并确保本地缓存目录（如 `flutter/.gradle/`）不被提交。
- 不要在未启动隔离后端时把集成测试“跳过”当成通过；记录跳过原因。
- 没有真机/模拟器时，1.4 的“运行基础导航”和后续 11.2/11.3 不能以组件测试替代。
- A 的 PASS 是 Windows 上的共享服务/Web 证据，不覆盖 Flutter、APK 或安卓设备；B 的验证必须在当前机器重新取证。

## 2026-11-12 Linux 实施续接（当前状态）

### Environment / build evidence

- Host: Linux, repo `/home/rmy/桌面/panDuola`, branch `feature-rmy`; dragging commits `c8734ea..2a5b829` continue on top of `478d954`.
- Flutter 3.47.9 / Dart 3.13.7 at `/home/rmy/development/flutter`.
- Android SDK `/home/rmy/Android/Sdk`: API 36, build-tools 36.0.0, platform-tools, emulator. AVD `pandora_api36` booted as `emulator-5554`.
- Demo backend/MySQL running; `/health` returns 200. Debug app uses emulator host `10.0.2.2:8080`; host unit/integration tests use `127.0.0.1:8080`.
- `flutter build apk --debug` succeeded: `flutter/build/app/outputs/flutter-apk/app-debug.apk`.
- Installed `cn.pandora.employee.flutter.debug`, launched on `pandora_api36`, logged in as founder `13800000001`, and traversed home → company calendar → task table → logs → log detail/comments.
- Session restore after force-stop was re-tested and now returns to authenticated home.
- Android build currently needs the local Tencent Gradle mirror while bootstrapping; the wrapper file was restored to the repository URL after building. Build env used `GRADLE_USER_HOME=/home/rmy/development/gradle-home` and Flutter China mirrors.
- `flutter analyze` still crashes its analysis server on this host; `dart analyze` is the working equivalent and reports no issues. `flutter doctor`/self-update still hangs on GitHub access.

### Implementation landed in this session

- Chapter 5 baseline: `features/schedule/**` with continuous month blocks, month/day list, pending projection, calendar pin, month drag, permission guards, real grab-day detection, all-day move, and initial/current-month positioning plus “今天”.
- Chapter 6 baseline: `TaskTablePage`, `/tasks/table`, relation/completion/name/single-end date filters, six sort keys/two directions, 50-item paging, independent table pin, and additional columns (priority, parent, tags, freeze, createdAt).
- Chapter 7 baseline: `features/work_logs/**`, `features/comments/**`, `features/tags/**`; list/detail/create/edit/delete, fill-source, optional linked task, ordered multi-tag editing, author comment edit/delete, and founder tag management.
- 4.1/4.9 closure: existing rejected creation is resubmitted to a new request and the old request stays rejected; concurrent approval decisions produce one success and one 412; pending-task comments remain independent, non-author edit returns 403, and author delete succeeds.
- Chapter 5 browsing closure: pure `CalendarTask`/`DayAxisLayout` projections, preferences-backed mode/density/last date, 42%-width end drawer, actual hit-day mapping for continued bars, horizontal/vertical 24-hour axes with all-day separation and collision lanes, dashed pending proposal borders, forced visible-month refresh, and pinned-first month/day ordering.
- Bug fixes verified this session:
  - comment create response uses `commentId`; parser now accepts it, and edit/delete send the record’s own `rowVersion` as If-Match;
  - work-log fill refuses incomplete sources, uses Java-compatible trim and UTF-16 10,000 limit, preserves original text, and shows an editable over-limit preview instead of truncating;
  - `SessionManager.initialize()`/retry/revalidate now notify listeners after a successful session read (previously state became authenticated while router stayed on “核验登录状态” forever);
  - session verification has a 15-second outer timeout;
  - debug Android default API host is `10.0.2.2` (matching the code comment) while host tests stay explicit `127.0.0.1`;
  - calendar opens at the current business month instead of 12 months earlier.

### Checks run (2026-11-12)

| Command | Result |
| --- | --- |
| `cd flutter && dart analyze` | No issues found |
| `cd flutter && flutter test` | **94 tests passed** (unit/widget/real backend, including calendar projection/UI/axis, preferences, 4.1 resubmit, 4.9 concurrency/comment, pending schedule, and calendar pin tests) |
| `flutter build apk --debug` | succeeded; APK path above |
| `adb install -r …/app-debug.apk` + launch + login + force-stop/restore | succeeded on API 36 AVD; session restore reached home |
| Android UI smoke | home/company current-month calendar, 42% end drawer, list/day-axis toggles, task table, logs, log detail/comments opened against demo backend |
| `openspec validate build-flutter-employee-android-client --strict` | valid |

### Still open / not overclaimed

- 5.7: implementation and component evidence exist, but physical-device haptic/gesture perception remains for 11.2. `5.8`/`5.9` are closed on component/build evidence.
- 6.1–6.3: closed with a 120-row fake backend pagination test, fixed title/header layout, column groups, independent filter/page/scroll persistence, pin reset to the first filtered group, and calendar-cache isolation assertions.
- 7.1–7.6: pagination/refresh/return restore, exact freeze boundaries, all fill edge cases, task-tag approval interplay, and comment cursor/non-author real tests remain.
- 2.7 notification/people/subordinate routes still use stubs.
- 4.1/4.9 have real backend evidence, but expired-creation resubmit, organization changes, and all old-button variants remain for the broader J08/J09/J12 journey.
- No physical device; 11.2/11.3 release signing/API26 work is untouched.
- `implementation-notes.md` is not a verification PASS.

## 2026-11-12 拖动批次（5.7–5.9）

### Implemented

- `CalendarDragCalculator` pure rules for month whole-bar moves, real start/end resize, all-day moves, day-axis move/resize, zero duration, midnight/time-zone boundaries and reverse/out-of-range rejection.
- Month bars: 500ms long press, one haptic, actual grab-day mapping for continuation segments, real endpoint handles only on true start/end, live old/new schedule overlay, lightweight reason confirmation, forced current-task ETag read before write, edge auto-scroll, background cancellation.
- Day axis: long press whole/endpoint drag, hour snapping with preserved minutes, final `[dayStart, nextDayStart]` bounds, whole-day/cross-day/clipped exclusion, no write before confirmation.
- Accessibility: Semantics custom actions for month day moves and day-axis hour moves, reusing the same confirmation/write path.
- Tests: pure drag model, no-activation before 500ms, single haptic, confirm-before-write, month move, month endpoint resize, axis move, axis endpoint resize, edge auto-scroll, lifecycle cancellation, actual hit-day drawer behavior.

### Checks

| Command | Result |
| --- | --- |
| `cd flutter && dart analyze` | No issues found |
| `cd flutter && flutter test` | **109 tests passed** |
| `flutter build apk --debug` | succeeded; APK installed on API 36 AVD |
| Android smoke | current-month calendar after session restore; founder demo has no assigned tasks, so gesture drag was not exercised on the emulator |

### Remaining in this area

- `5.7` stays unchecked because its task text explicitly requires 11.2 physical-device perception; component tests prove the 500ms/haptic/no-write state machine, but no physical device is attached.
- Haptic feedback and edge auto-scroll on real hardware, plus system-level pointer cancellation, remain for 11.2.
- `5.8`/`5.9` have model, widget and build evidence; no real-device recording is claimed.

## 2026-11-12 任务表单批次（6.1–6.3）

### Implemented

- `/tasks/table` remains the only data source; client never locally re-sorts server rows.
- 50-item page model with previous/next controls, request generation guard for stale filter responses, and total/page count.
- Independent relation/completion/name/single-end-date filters backed by account preferences.
- Fixed title column and fixed header; right-side columns scroll horizontally, title/body vertical lists are synchronized.
- Column groups: 概览/排期/资料/全部列; pin column remains visible.
- Full fields: relation, state, schedule, priority, ordered owners, original creator, parent link, tags, progress, historical acceptance criteria, freeze/pending, overdue, execution round, createdAt, dueAt, pin.
- Pin from any page resets to the first filtered page so the pinned task enters the first group; no calendar request is made.
- `canTablePin=false` leaves the action disabled and writes nothing.
- Added preference keys for filters, column group, page index and scroll offset.

### Checks

| Command | Result |
| --- | --- |
| `cd flutter && dart analyze` | No issues found |
| `cd flutter && flutter test` | **115 tests passed** |
| `flutter build apk --debug` | succeeded; installed on API 36 AVD |
| Android smoke | task table opened from company; fixed title/header, pin column and overview columns rendered |
| `openspec validate build-flutter-employee-android-client --strict` | valid |

### Remaining / not overclaimed

- The 120-row pagination, stale filter, column-group, fixed header/title and state-restoration evidence uses the fixed-response test backend; real demo has only 15 table rows.
- Chinese collator parity is consumed from the backend contract, not independently re-derived in Flutter.
- No physical device.

## Verification Reminders

- **1.4 is closed (2026-11-12)**: debug APK built, installed and run on API 36 AVD, login/navigation and session restore verified.
- **2.7 remains open**: all secondary routes are registered and the implemented task/daily-item flows return correctly, but notifications, people/subordinate workspace, logs and comments still show `StubPage`; their nested-return and read-only propagation cannot be verified until chapters 7–9.
- **4.1 is closed for the rejected real path (2026-11-12)**: original applicant resubmits to a new request; old request remains rejected. Expired-creation variant still belongs to the broader journey.
- **4.9 is closed for concurrency + pending comments (2026-11-12)**: one of two concurrent decisions succeeded, the other got 412; pending-task comments stayed independent and non-author edit got 403. Frozen-log/org-change variants remain in later journeys.
- Calendar upward browsing: the page opens with the home cards and today's month; earlier months are reached with the month selector/prev arrow, then scrolling is continuous downward across years. There is no infinite upward prepend. Layout/cross-year data handling is correct; this interaction difference should be judged explicitly in verification.
- The daily-items month grid always renders six weeks to keep block heights and anchors stable; out-of-month cells are inert blanks (no duplicated dates).
- Month data is loaded lazily per calendar month and all its pages are fetched; no >93-day request is ever issued. A real ">100 items in one month" fixture was not exercised (the code loops `nextOffset`); use the extreme fixture in chapter 11.
- Home card/preview → full list navigation has no dedicated widget test (real `/home` shape is tested). Board → task detail is wired but only the task detail read path is real-service tested.
- Token refresh, restricted-session request traces and refresh-response-loss/secure-storage failure are covered by unit tests with a fake auth gateway, not against the live service. No real admin password reset was performed.
- Native Android evidence (haptics, back/keyboard/safe-area, lifecycle, image picker, process death) is entirely absent; chapters 5–11 own it.
- The chapter 1–7 Flutter changes were committed by module on 2026-11-12 (`e2781c8..eab94eb`); this docs commit records status. Demo backend tests create/delete their own rows but do not reset the demo DB; use `start-demo.sh` if a clean demo is needed.
- Do not treat this file as a verification verdict; `openspec-e13-verify-change` must independently check the above gaps.
