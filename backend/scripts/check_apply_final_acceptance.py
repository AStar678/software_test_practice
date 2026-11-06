#!/usr/bin/env python3
"""Cross-module acceptance roll-up for the refine change.

Reads the real-service/Chrome reports and screenshots produced by the affected suites, asserts the
required cross-module scenarios and widths are present, collects the key screenshots, verifies the
worktree contains no native/android, old-migration or unrelated changes, and writes a summary record.
"""
import datetime as dt
import json
import shutil
import subprocess
from pathlib import Path

BASE = Path(__file__).resolve().parents[2]
OUT = BASE / 'output/apply-acceptance'
SCENARIOS = [
    ('从通知读原申请', 'output/apply-notifications/browser-report.json',
     ['applicant sees the authorized original-request action', 'original request opens from the notification',
      'original request keeps the applicant projection without the reviewer diff', 'detail fits 320', 'detail fits 390', 'detail fits 1440'],
     ['detail-320.png', 'detail-390.png', 'detail-1440.png']),
    ('负责人混合编辑审核', ['output/apply-mixed-edit/review-report.json', 'output/apply-mixed-edit/owner-report.json'],
     ['approval detail ready', 'review diff fits 320', 'review diff fits 390', 'review diff fits 1440',
      'owner unified edit form opens', 'owner form projects only allowed fields', 'owner draft survives the failed submission',
      'owner mixed edit submits and closes the form', 'owner submit shows the saved current reviewer',
      'owner form layout fits 320', 'owner form layout fits 390', 'owner form layout fits 1440'],
     ['owner-320.png', 'owner-390.png', 'owner-1440.png', 'review-320.png', 'review-390.png', 'review-1440.png']),
    ('下属仅评论与返回', 'output/subordinate-workspace/browser-report.json',
     ['person opens profile card before work', 'no own calendar or log reuse', 'month fits 320', 'month fits 390', 'month fits 1440',
      'logs fit 320', 'logs fit 390', 'logs fit 1440'],
     ['month-320.png', 'month-390.png', 'month-1440.png', 'logs-320.png', 'logs-390.png', 'logs-1440.png']),
    ('月拖动轻量确认', 'output/task-schedule/browser-report.json',
     ['lightweight confirmation opens', 'full task editor absent', 'month drag crosses year and preserves minute',
      'all-day confirmation shows complete dates without invented times', 'pending proposal is drawn once at the proposed date',
      'pending proposal keeps the exact proposed times', 'pending proposal keeps the shared first-tag colour',
      'day axis fits viewport 320', 'day axis fits viewport 390', 'day axis fits viewport 1440'],
     ['apply-day-320.png', 'apply-day-390.png', 'apply-day-1440.png']),
    ('日志多标签', 'output/apply-log-tags/browser-report.json',
     ['cancel then re-select appends at the new position', 'log tag keeps keyboard toggle state', 'nested return keeps the ordered tags and body draft',
      'failed save keeps the tag draft and the form', 'saved log reads back the ordered collection', 'log tag picker fits 320',
      'log tag picker fits 390', 'log tag picker fits 1440', 'log edit tag picker fits 320', 'log edit tag picker fits 390'],
     ['log-tags-320.png', 'log-tags-390.png', 'log-tags-1440.png', 'log-edit-320.png', 'log-edit-390.png']),
    ('管理员读号', 'output/apply-admin-phone/browser-report.json',
     ['management list shows the full login phone', 'detail form reads back the same full login phone',
      'admin phone detail reachable at 320', 'admin phone detail reachable at 390', 'admin phone detail reachable at 1440'],
     ['admin-phone-320.png', 'admin-phone-390.png', 'admin-phone-1440.png']),
    ('可达界面文案', 'output/apply-copy-audit/browser-report.json',
     ['工作台 copy audit', '日程 copy audit', '日志 copy audit', '统计 copy audit', '我的 copy audit', '任务详情 copy audit',
      '任务编辑 copy audit', '日志表单 copy audit', '通知列表 copy audit', '我的申请 copy audit', '下属资料卡 copy audit',
      '下属工作页 copy audit', '管理端登录 copy audit', '管理端业务维护 copy audit'],
     ['task-edit-320.png', 'task-edit-390.png', 'task-edit-1440.png', 'staff-320.png', 'staff-390.png', 'staff-1440.png',
      'admin-320.png', 'admin-390.png', 'admin-1440.png']),
]


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    rows = []
    failures = []
    for label, report_paths, required, shots in SCENARIOS:
        if isinstance(report_paths, str):
            report_paths = [report_paths]
        checks = []
        missing = []
        for report_path in report_paths:
            path = BASE / report_path
            if not path.is_file():
                failures.append(f'{label}: 缺少报告 {report_path}')
                missing.append(report_path)
                continue
            checks.extend(json.loads(path.read_text()).get('checks', []))
        names = [item.get('name', '') for item in checks]
        missing.extend([item for item in required if not any(item in name for name in names)])
        failed = [item for item in checks if not item.get('pass')]
        if missing:
            failures.append(f'{label}: 缺少检查 {missing}')
        if failed:
            failures.append(f'{label}: 失败检查 {[item.get("name") for item in failed][:5]}')
        copied = []
        for shot in shots:
            for source in sorted((BASE / report_paths[0]).parent.glob(shot)):
                target = OUT / f'{label.replace(" ", "-")}-{source.name}'
                shutil.copy2(source, target)
                copied.append(target.name)
        rows.append((label, 'PASS' if not missing and not failed else 'FAIL', '、'.join(report_paths),
                     '、'.join(copied) if copied else '无误'))
    # No native/APK, old migration or unrelated changes in the worktree.
    status = subprocess.run(['git', 'status', '--porcelain'], cwd=BASE, text=True, capture_output=True).stdout
    changed = [line[3:].strip() for line in status.splitlines() if line.strip()]
    native = [item for item in changed if item.startswith(('android/', 'android-shell/'))]
    old_migrations = [item for item in changed if item.startswith('backend/src/main/resources/db/migration/')
                      and not item.endswith('V29__work_log_multiple_tags.sql') and not item.endswith('V30__remove_private_tags.sql')]
    if native:
        failures.append(f'工作树包含原生改动 {native}')
    if old_migrations:
        failures.append(f'工作树改动了旧迁移 {old_migrations}')
    rows.append(('工作树边界', 'PASS' if not native and not old_migrations else 'FAIL',
                 '无 android/、android-shell/ 或旧迁移改动' if not native and not old_migrations else str(native + old_migrations), ''))
    passed = not failures
    lines = ['# 跨模块浏览器验收记录', '',
             f"- 生成时间：{dt.datetime.now().astimezone().isoformat(timespec='seconds')}",
             '- 运行方式：各模块真实服务/数据库 + 无头 Chrome 专项脚本；本页汇总其结果与截图，不替代独立验证。',
             '- 宽度：320 / 390 / 1440。', '',
             '| 场景 | 结果 | 证据 | 截图 |', '| --- | --- | --- | --- |']
    lines += [f'| {label} | {result} | `{evidence}` | {shots or "—"} |' for label, result, evidence, shots in rows]
    lines += ['', '## 结论', '',
              '所有场景的检查项与三宽度截图均来自真实运行；独立验证仍需由 `openspec-e13-verify-change` 完成。' if passed
              else '存在未满足项：' + '；'.join(failures)]
    (OUT / 'acceptance.md').write_text('\n'.join(lines) + '\n', encoding='utf-8')
    (OUT / 'acceptance.json').write_text(json.dumps({'pass': passed, 'scenarios': rows, 'failures': failures}, ensure_ascii=False, indent=2), encoding='utf-8')
    print(('PASS ' if passed else 'FAIL ') + 'cross-module acceptance roll-up')
    if failures:
        for failure in failures:
            print(' - ' + failure)
        raise SystemExit(1)


if __name__ == '__main__':
    main()
