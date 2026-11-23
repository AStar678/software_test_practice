# Archive Decision

- Change: `fix-web-calendar-notification-and-demo-polish`
- Archived on: 2026-11-13
- Implementation revision at archive: `51dfca1`
- Decision: 按用户明确要求，与前置Web change依次同步规格并归档；后续实机证据若暴露问题，另开新change处理。

归档开始时，独立验证报告为PASS、V-001为verified-resolved，当前输入与保存快照比较 `changed:false`，SHA-256为 `4fb2fec99de0cdc8c85c1a94c61987f58cc13e5e8c2445e2c9bfdb118caa3a56`。原报告和快照完整保留为该基准的历史证据。

前置 `2026-11-13-align-web-employee-client-with-nov08-guidance` 已先同步并归档；其真机环境发现V-005及历史BLOCKED结论保留，用户已明确接受该证据限制。本轮不新增实机通过结论。

随后已将本change的6项MODIFIED要求合并到主规格，逐块检查与delta一致，保留其他要求与已有场景。两个主规格严格校验通过，原先主规格缺少 `Daily-item span labels and status` 的依赖已消除。依据用户本次明确授权，规格同步、归档说明和目录迁移这些预期文档变化不触发新一轮整套verify；不刷新原验证快照或改写历史结论。产品实现未在本次归档中修改。
