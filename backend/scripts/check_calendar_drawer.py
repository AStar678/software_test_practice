#!/usr/bin/env python3
"""Owns a disposable current-schema service for the calendar drawer / day-sheet / month-stream checks.

Covers change tasks 9.1-9.5 and 10.2-10.3 against the packaged service and a real Chrome page:
the overlay drawer, the unified month-cell day sheet, its gestures/focus/return behaviour, the
full-day projection without touching schedules, and the continuous month stream. Evidence is written
to audit/refactor-pandora-organization-and-workflows/calendar-drawer.json plus screenshots.
"""
import datetime as dt
import json
import os
import subprocess
import uuid

from fixed_model_fixture import Fixture
from migration_precheck import BASE

ZONE = dt.timezone(dt.timedelta(hours=8))
REPORT = BASE.parent / 'audit/refactor-pandora-organization-and-workflows'


def main():
    fixture = Fixture(port=18193)
    fixture.log_path = REPORT / 'calendar-service.log'
    with fixture as f:
        tokens = {key: f.login(key)[1]['token'] for key in
                  ('founder', 'alpha-head', 'alpha-one-head', 'alpha-one-employee', 'beta-one-employee')}
        ids = {key: value['id'] for key, value in f.identities.items()}
        today = dt.datetime.now(ZONE).date()
        day = today + dt.timedelta(days=3)
        month_start = day.replace(day=1)
        # Future spans: the service rejects schedules whose effective deadline already passed.
        week_start = day + dt.timedelta(days=10)
        week_end = week_start + dt.timedelta(days=8)
        span_month = (day + dt.timedelta(days=60)).replace(day=1)
        month_last = span_month + dt.timedelta(days=27)
        month_span_end = month_last + dt.timedelta(days=4)
        concurrent = day + dt.timedelta(days=1)

        def instant(date, hour, minute=0):
            return dt.datetime.combine(date, dt.time(hour, minute), ZONE).isoformat()

        def call(method, path, body=None, who='founder', version=None):
            status, result = f.call(method, path, body, tokens[who], 'calendar-' + uuid.uuid4().hex, version)
            if status not in (200, 201):
                raise AssertionError((method, path, status, result))
            return result

        def form(title, owners, start, due, all_day=False):
            body = {'title': title, 'description': 'Calendar browser acceptance task', 'priority': 'medium',
                    'allDay': all_day, 'assigneeIds': [ids[owner] for owner in owners]}
            if all_day:
                body.update(startDate=str(start), dueDate=str(due))
            else:
                body.update(startAt=start, dueAt=due)
            return body

        day_tasks = [call('POST', '/tasks', form('Calendar day task %02d' % index, ['alpha-one-employee'],
                                                 instant(day, 9), instant(day, 18)))['taskId'] for index in range(12)]
        special = {}
        special['cross'] = call('POST', '/tasks', form('Calendar cross', ['alpha-one-employee'], instant(day, 20),
                                                       instant(day + dt.timedelta(days=2), 10)))['taskId']
        special['point'] = call('POST', '/tasks', form('Calendar point', ['alpha-one-employee'],
                                                       instant(concurrent, 15), instant(concurrent, 15)))['taskId']
        special['allday'] = call('POST', '/tasks', form('Calendar all day', ['alpha-one-employee'], day,
                                                        concurrent, True))['taskId']
        special['week'] = call('POST', '/tasks', form('Calendar week span', ['alpha-one-employee'],
                                                      instant(week_start, 10), instant(week_end, 12)))['taskId']
        special['month'] = call('POST', '/tasks', form('Calendar month span', ['alpha-one-employee'],
                                                       instant(month_last, 10), instant(month_span_end, 12)))['taskId']
        pinned = call('POST', '/tasks', form('Calendar pinned', ['alpha-one-employee'], instant(day, 11),
                                             instant(day, 12)))['taskId']
        call('PUT', '/tasks/' + pinned + '/pin', None, 'alpha-one-employee')
        # Other people's work on the same day must never enter this person's calendar.
        other_tasks = [call('POST', '/tasks', form('Calendar other owner %d' % index, ['beta-one-employee'],
                                                   instant(day, 10), instant(day, 11)))['taskId'] for index in range(3)]
        # A completed task stays visible on the calendar day list.
        created = call('POST', '/tasks', form('Calendar completed', ['alpha-one-employee'], instant(day, 14),
                                              instant(day, 15)), 'alpha-one-employee')
        request = call('GET', '/approval-requests/' + created['requestId'], who='alpha-one-head')
        call('PATCH', '/approval-requests/' + created['requestId'], {'decision': 'approve'}, 'alpha-one-head',
             request['rowVersion'])
        view = call('GET', '/tasks/' + created['taskId'], who='alpha-one-employee')
        call('PATCH', '/tasks/' + created['taskId'], {'command': 'complete', 'completionNote': 'Calendar completed note'},
             'alpha-one-employee', view['rowVersion'])
        # Concurrent and all-day load for the day view (10.2): more than five of each.
        for index in range(7):
            call('POST', '/tasks', form('Calendar overlap %d' % index, ['alpha-one-employee'],
                                        instant(concurrent, 9), instant(concurrent, 10)))
        for index in range(20):
            call('POST', '/tasks', form('Calendar allday %02d' % index, ['alpha-one-employee'],
                                        concurrent, concurrent, True))
        manifest = {'base': 'http://127.0.0.1:%d' % f.port, 'identities': f.identities,
                    'day': str(day), 'concurrent': str(concurrent), 'weekStart': str(week_start),
                    'weekEnd': str(week_end), 'monthLast': str(month_last), 'monthSpanEnd': str(month_span_end),
                    'monthStart': str(month_start), 'special': special, 'pinned': pinned,
                    'completed': created['taskId'], 'dayTasks': day_tasks, 'otherTasks': other_tasks,
                    'database': f.database}
        env = {**os.environ, 'PANDORA_BROWSER_FIXTURE': json.dumps(manifest)}
        subprocess.run(['node', str(BASE / 'scripts/check_calendar_drawer_browser.js')], env=env, check=True)


if __name__ == '__main__':
    main()
