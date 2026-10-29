# 更改指导第14节逐条追溯

来源：[更改指导第14节](../../../docs/reviews/更改指导.md#14-验收清单)。以下编号为各小节从上到下的条目序号，原需求文档未改勾选。Delta 场景标题对应 [本change spec](specs/pandora-requirements-aligned-prototype/spec.md)。本表是 apply 交接，不是独立验收结论。

证据统一位于新目录 [final-2026-10-29](../../../audit/refactor-pandora-organization-and-workflows/final-2026-10-29/)，其中 `final-all-run.json` 记录当前完整19组脚本的实际退出码；`final-provenance.json` 记录构建与各文件哈希。旧历史报告不用于本轮勾选。代码/检查入口见 [implementation-notes](implementation-notes.md)。

| 条目 | 验收内容 | Delta scenario | Task | 本轮证据（目录内文件） |
| --- | --- | --- | --- | --- |
| 14.1.1 | 工作台新建入口/长标题优先级 | Remove duplicate creation and protect priority | 8.1 | employee-browser.json；dashboard-{320,390,1440}.png |
| 14.1.2 | 窄覆盖抽屉/说明/关闭 | Overlay a narrow accessible schedule drawer | 9.1–9.2 | calendar-drawer.json；calendar-drawer-{320,390,1440}.png |
| 14.1.3 | 日期/空白/任务条/+N几何命中 | Open a sheet from every part of a monthly date | 9.3 | calendar-drawer.json：number/blank/bar/+N/cross-week/cross-month/keyboard |
| 14.1.4 | 完整清单/去重/详情与日视图返回 | Return through nested detail and dismiss without losing context | 9.4 | calendar-drawer.json：content/dedupe/pin/detail return/day view/empty create；calendar-day-sheet-*.png |
| 14.1.5 | 正文滚动/顶部拉下/手柄/遮罩 | Return through nested detail and dismiss without losing context | 9.5 | calendar-drawer.json：handle/cancel/multi-touch/body pull/normal scroll/Esc/logout |
| 14.1.6 | 整日覆盖/首尾/午夜/点 | Classify full-day coverage without changing schedules | 10.1–10.2 | calendar-drawer.json；employee-browser.json；calendar-day-projection.png |
| 14.1.7 | 只读投影不改原排期与提醒 | Classify full-day coverage without changing schedules | 10.2 | calendar-drawer.json：API before/after unchanged；review-routing.json：reminder schedule/round matrix |
| 14.1.8 | 表单说明移除/分页排序筛选返回 | Simplify visible copy while retaining spreadsheet operations; Sort all filtered rows before paging | 8.2 | employee-browser.json：109 rows/3 pages/six sorts/filters/effective version/context/error retry |
| 14.1.9 | 实际新建补写保存/冻结唯一性 | Regress actual log entry and the selected editor | 8.4 | employee-browser.json；log-backfill-entry.json；log-backfill-service.log |
| 14.1.10 | 正确日志/人员旧筛选/个人事项ID | Reset old filters when opening logs from a person profile; Maintain personal items through detail | 8.4 | employee-browser.json；employee-person-logs.png；employee-personal.png |
| 14.2.1 | 四层/固定创始人/单位负责人/单位置 | Keep the founder fixed and positions independent of titles | 1.1,3.1–3.3 | placement-migration.json；organization-plans.json；final-schema.json |
| 14.2.2 | 职位必填且名称不授权 | Keep the founder fixed and positions independent of titles | 3.1–3.2,6.3 | organization-plans.json；admin-contract-check.json；admin-contract-browser.json |
| 14.2.3 | 组织增调换删/并发原子性 | Revoke management access after an atomic move; Keep the founder fixed and positions independent of titles | 3.2,6.1–6.2 | organization-plans.json：rollback/swap/concurrency/read snapshot；admin-browser.json |
| 14.2.4 | 直连旧团队写拒绝 | Keep the founder fixed and positions independent of titles | 3.4 | admin-contract-check.json：all employee layers retired writes；current-reference-review.json |
| 14.2.5 | 本人跨范围任务/同团队隔离 | Retain own cross-scope tasks and deny teammate access | 4.1 | review-routing.json：two-department/multi-team list/detail/candidates matrix |
| 14.2.6 | 直接/间接下属日志只读 | Search each hierarchy within authorization; Retain own cross-scope tasks and deny teammate access | 4.2 | workspace-access.json：descendant authors/body edit denial；profile-phone-matrix.json |
| 14.2.7 | 联系信息/撤权/旧页面 | Revoke management access after an atomic move; Recheck the management chain after an organization change | 4.3,4.5 | profile-phone-matrix.json；organization-plans.json；late-response.json；workspace-access.json |
| 14.2.8 | 评论失权删除缺失/撤回上级/普通历史 | Never revive inaccessible comments through old notifications; Preserve comment redaction under new organization scopes | 12.4 | fixed-notifications.json；communication-browser.json；Maven NotificationCommentAccessTest/WithdrawnNotificationTest |
| 14.2.9 | AI聚合/词云/建议/旧结果 | Scope team analytics independently from personal suggestions | 4.4 | workspace-access.json：company/department/team/personal scope and stale results；WorkspaceAnalysisTest |
| 14.3.1 | 创建/重提直属上级/创始人免审 | Preview all creator-based routes | 5.1 | review-routing.json；final-demo.json |
| 14.3.2 | 非创建由当前业务责任方审核 | Trace takeover and direct application without rewriting provenance | 5.1–5.2,7.1 | review-routing.json；business-takeover.json |
| 14.3.3 | 本人直接生效/原因历史/无本人待审 | Validate a direct application as strictly as a reviewed change | 5.3–5.4 | auto-apply-authorization.json；review-routing.json；demo-integrity.json |
| 14.3.4 | 负责人换序/跨部门不改审核路线 | Preview all creator-based routes | 5.1,5.4 | review-routing.json：order/scope/preview/actual reviewer parity |
| 14.3.5 | 不可用/截止/版本/关系损坏阻断 | Block an unavailable configured manager; Revalidate after an organization change | 5.3,5.5 | review-routing.json；auto-apply-authorization.json；business-takeover.json：single terminal/reroute/expiry races |
| 14.3.6 | 专用交接范围/唯一接管/来源 | Distinguish direct manager handover from indirect management; Refresh valid reviews and revoke old authority atomically | 5.6,7.1–7.4 | review-routing.json；business-takeover.json；handover-chain.json：browser handover→approval→deactivate→edit/reopen/review→history |
| 14.3.7 | 管理员改姓名手机号/本人头像邮箱密码 | Let only administrators change employee identity; Keep identity fields read-only to employees | 2.2,2.4,8.3 | account-contract.json；profile-phone-matrix.json；employee-browser.json |
| 14.3.8 | 最终username移除/手机号登录 | Remove employee username without breaking internal references | 2.1,11.1–11.2 | final-migration.json；final-schema.json；current-reference-review.json；account-contract.json；served-resources-final.json |
| 14.3.9 | 独立管理员登录维护/无员工位置 | Use the new phone contract and isolate administrator credentials | 1.2,2.5,6.3 | account-contract.json；admin-contract-browser.json；admin-browser.json；final-demo.json |
| 14.3.10 | 命名空间隔离/重复号拒绝/客户端影响 | Reject duplicate phones and preserve administrator repair access; Use the new phone contract and isolate administrator credentials | 2.1–2.2,12.7 | account-contract.json；profile-phone-matrix.json；backend/README.md 与 docs/api-examples.http（位于仓库） |
| 14.3.11 | 重复演示/完整新模型场景 | Prepare a complete repeatable new-model demonstration | 11.3–11.5 | final-demo.json：54 checks，含repeat/restart/real edit/admin rename；demo-integrity.json |
| 14.3.12 | 新建升级一致/资源/无安卓交付 | Compare fresh installation with an upgraded database; Keep native Android outside the change | 11.1,12.2,12.5–12.7 | final-migration.json；final-schema.json；web-resources-final.json；served-resources-final.json；final-provenance.json |

触摸/键盘、失败补载和映射工具的复现边界详见 implementation-notes 的 Verification Reminders，不能据此豁免规格要求。
