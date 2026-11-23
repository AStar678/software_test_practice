"""Detailed equivalence partitions, exact limits, real writes, concurrency and privacy."""
import base64
from concurrent.futures import ThreadPoolExecutor
import datetime as dt
import struct
import uuid
import zlib
import pytest
from fixed_model_fixture import PASSWORD


def call(f, method, path, body=None, who='founder', version=None, key=None):
    return f.call(method, path, body, f.test_tokens[who], key or uuid.uuid4().hex, version)


def ok(f, method, path, body=None, **kwargs):
    status, data = call(f, method, path, body, **kwargs)
    assert status in (200, 201), (method, path, status, data.get('code'))
    return data


def task_body(f):
    day = dt.date.fromisoformat(ok(f, 'GET', '/home')['businessDate']) + dt.timedelta(days=5)
    return {'title': '验收-' + uuid.uuid4().hex[:8], 'description': '隔离测试任务', 'priority': 'medium',
            'allDay': False, 'startAt': str(day) + 'T09:00:00+08:00',
            'dueAt': str(day) + 'T18:00:00+08:00', 'assigneeIds': [f.identities['founder']['id']]}


@pytest.mark.parametrize('payload,expected', [
    ({'accountType': 'employee', 'phone': '', 'password': 'x'}, 401),
    ({'accountType': 'employee', 'phone': '001', 'password': ''}, 401),
    ({'accountType': 'employee', 'phone': [], 'password': 'x'}, 400),
    ({'accountType': 'employee', 'phone': '001', 'password': 123}, 400),
    ({'accountType': 'root', 'phone': '001', 'password': 'x'}, 400),
    ({'phone': '001', 'password': 'x'}, 400),
    ({'accountType': 'employee', 'username': 'founder', 'password': 'x'}, 400),
    ({'accountType': 'employee', 'phone': '001', 'password': 'x', 'accountName': 'admin'}, 400),
])
def test_login_rejects_invalid_equivalence_classes(service, payload, expected):
    """AuthService.login: missing/ambiguous identifiers and wrong JSON types."""
    assert service.call('POST', '/auth/sessions', payload)[0] == expected


@pytest.mark.parametrize('size,expected', [(0, 400), (1, 200), (79, 200), (80, 200), (81, 400)])
def test_task_title_unicode_code_point_boundaries(service, size, expected):
    """TaskService.create: empty, typical, upper-1, upper, upper+1 emoji title."""
    body = task_body(service); body['title'] = '😀' * size
    status, result = call(service, 'POST', '/tasks', body)
    assert (status in (200, 201)) if expected == 200 else status == expected
    if expected == 200:
        assert ok(service, 'GET', '/tasks/' + result['taskId'])['title'] == body['title']


@pytest.mark.parametrize('value', [None, 0, 1, 0.5, 1.5, 4294967296, 'true', [], {}])
def test_task_all_day_requires_real_json_boolean(service, value):
    """TaskService.create/validateForm: numeric coercion must not enter the HTTP form."""
    body = task_body(service); body['allDay'] = value
    assert call(service, 'POST', '/tasks', body)[0] == 400


@pytest.mark.parametrize('size,expected', [(0, 400), (1, 200), (1999, 200), (2000, 200), (2001, 400)])
def test_daily_item_text_exact_boundaries(service, size, expected):
    """DailyItemService.create: 1..2000 Unicode code points and first outside values."""
    body = {'startDate': '2026-12-31', 'endDate': '2027-01-01', 'body': '汉' * size}
    status, result = call(service, 'POST', '/daily-items', body)
    assert (status in (200, 201)) if expected == 200 else status == expected
    if expected == 200:
        row = ok(service, 'GET', '/daily-items/' + result['id'])
        assert row['body'] == body['body'] and row['endDate'] == '2027-01-01'


@pytest.mark.parametrize('days,expected', [(1, 200), (92, 200), (93, 200), (94, 400)])
def test_daily_summary_inclusive_range_boundary(service, days, expected):
    """DailyItemService.summary: inclusive 93-day limit over a leap-day interval."""
    start = dt.date(2024, 2, 1); end = start + dt.timedelta(days=days - 1)
    assert call(service, 'GET', f'/daily-items/summary?from={start}&to={end}')[0] == expected


@pytest.mark.parametrize('limit,expected', [(0, 400), (1, 200), (100, 200), (101, 400), (2147483647, 400)])
def test_daily_list_page_limit(service, limit, expected):
    """DailyItemService.list: lower/upper pagination bounds and integer extreme."""
    assert call(service, 'GET', '/daily-items?date=2026-11-19&limit=' + str(limit))[0] == expected


@pytest.mark.parametrize('start,end,expected', [
    ('2024-02-29', '2024-02-29', 200), ('2000-02-29', '2000-03-01', 200),
    ('2026-12-31', '2027-01-01', 200), ('1900-02-29', '1900-03-01', 400),
    ('2026-04-31', '2026-05-01', 400), ('2026-11-20', '2026-11-19', 400),
])
def test_daily_date_equivalence_partitions(service, start, end, expected):
    """DailyItemService.create: leap-century, cross-year, invalid date and reversed interval."""
    status, _ = call(service, 'POST', '/daily-items', {'startDate': start, 'endDate': end, 'body': '日期边界'})
    assert (status in (200, 201)) if expected == 200 else status == expected


@pytest.mark.parametrize('who,expected', [('founder', 200), ('alpha-one-employee', 404), ('other-founder', 404), ('admin', 403)])
def test_daily_item_is_private_even_from_managers(service, who, expected):
    """DailyItemService.detail: owner, peer, foreign company and non-business admin."""
    row = ok(service, 'POST', '/daily-items', {'date': '2026-11-19', 'body': '本人私有事项'})
    assert call(service, 'GET', '/daily-items/' + row['id'], who=who)[0] == expected


@pytest.mark.parametrize('version,expected', [(None, 428), (0, 412), (1, 200), (9223372036854775807, 412)])
def test_daily_update_version_fence(service, version, expected):
    """DailyItemService.change/Writes: missing, stale, exact and extreme If-Match."""
    row = ok(service, 'POST', '/daily-items', {'date': '2026-11-19', 'body': '修改前'})
    status, _ = call(service, 'PATCH', '/daily-items/' + row['id'], {'body': '修改后'}, version=version)
    assert status == expected
    current = ok(service, 'GET', '/daily-items/' + row['id'])
    assert current['body'] == ('修改后' if expected == 200 else '修改前')


def test_same_idempotency_key_replays_once_and_rejects_changed_body(service):
    """Writes.run: one key/one payload replays, changed payload is 409, no duplicate row."""
    key = uuid.uuid4().hex
    body = {'date': '2026-11-19', 'body': '幂等重试-' + key}
    first = ok(service, 'POST', '/daily-items', body, key=key)
    assert ok(service, 'POST', '/daily-items', body, key=key)['id'] == first['id']
    assert call(service, 'POST', '/daily-items', {**body, 'body': '不同正文'}, key=key)[0] == 409
    assert service.db.scalar("SELECT COUNT(*) FROM daily_items WHERE id='" + first['id'] + "'") == 1


def test_eight_concurrent_identical_writes_have_one_effect(service):
    """Writes.run: concurrent same-key requests produce one object and one create event."""
    key = uuid.uuid4().hex
    body = {'date': '2026-11-19', 'body': '并发幂等-' + key}
    with ThreadPoolExecutor(max_workers=8) as pool:
        results = list(pool.map(lambda _: call(service, 'POST', '/daily-items', body, key=key), range(8)))
    assert all(s in (200, 201) for s, _ in results), [(s, r.get('code')) for s, r in results]
    ids = {r['id'] for _, r in results}
    assert len(ids) == 1
    item = next(iter(ids))
    assert service.db.scalar("SELECT COUNT(*) FROM domain_events WHERE event_type='daily_item.created' AND JSON_UNQUOTE(JSON_EXTRACT(details_json,'$.dailyItemId'))='" + item + "'") == 1


def test_two_stale_concurrent_updates_do_not_silently_overwrite(service):
    """DailyItemService.change: same version + different keys allows only one winner."""
    row = ok(service, 'POST', '/daily-items', {'date': '2026-11-19', 'body': '并发前'})
    with ThreadPoolExecutor(max_workers=2) as pool:
        results = list(pool.map(lambda text: call(service, 'PATCH', '/daily-items/' + row['id'], {'body': text}, version=1), ['方案一', '方案二']))
    assert sorted(status for status, _ in results) == [200, 412]
    assert ok(service, 'GET', '/daily-items/' + row['id'])['rowVersion'] == 2


@pytest.mark.parametrize('text,who,expected', [
    ('x', 'alpha-one-employee', 200), ('x' * 9999, 'alpha-two-employee', 200),
    ('x' * 10000, 'beta-one-employee', 200), ('😀' * 5000, 'beta-two-employee', 200),
    ('', 'alpha-one-head', 400), ('x' * 10001, 'alpha-one-head', 400), ('😀' * 5001, 'alpha-one-head', 400),
], ids=['min1', 'upper9999', 'upper10000', 'utf16-10000', 'empty', 'first10001', 'utf16-10002'])
def test_work_log_utf16_contract(service, text, who, expected):
    """WorkspaceService.createLog: Java UTF-16 count, including supplementary emoji."""
    status, _ = call(service, 'POST', '/work-logs', {'body': text}, who=who)
    assert (status in (200, 201)) if expected == 200 else status == expected


@pytest.mark.parametrize('value', [42, True, ['text'], {'text': 'comment'}])
def test_comment_rejects_non_text_json(service, value):
    """CommentService.create: JSON numbers/booleans/arrays/objects are not plain text."""
    task = ok(service, 'POST', '/tasks', task_body(service))['taskId']
    assert call(service, 'POST', '/tasks/' + task + '/comments', {'body': value})[0] == 400


@pytest.mark.parametrize('value', [42, True, ['text'], {'text': 'comment'}])
def test_comment_change_rejects_non_text_json(service, value):
    """CommentService.change: editing must enforce the same plain-text JSON contract as creation."""
    task = ok(service, 'POST', '/tasks', task_body(service))['taskId']
    comment = ok(service, 'POST', '/tasks/' + task + '/comments', {'body': 'original'})
    assert call(service, 'PATCH', '/comments/' + comment['commentId'], {'body': value}, version=1)[0] == 400


@pytest.mark.parametrize('editing', [False, True])
@pytest.mark.parametrize('text,expected', [
    ('x', 200), ('x' * 10000, 200), ('x' * 10001, 400),
    ('', 400), ('   ', 400), ('😀' * 5000, 200), ('😀' * 5001, 400),
])
def test_comment_create_and_change_length_boundaries(service, editing, text, expected):
    """CommentService.create/change: normal, empty/whitespace, 10000/10001 UTF-16, emoji boundaries."""
    task = ok(service, 'POST', '/tasks', task_body(service))['taskId']
    if editing:
        comment = ok(service, 'POST', '/tasks/' + task + '/comments', {'body': 'original'})
        status, _ = call(service, 'PATCH', '/comments/' + comment['commentId'], {'body': text}, version=1)
    else:
        status, _ = call(service, 'POST', '/tasks/' + task + '/comments', {'body': text})
    assert (status in (200, 201)) if expected == 200 else status == expected


def png(width, height):
    def chunk(kind, data):
        return struct.pack('!I', len(data)) + kind + data + struct.pack('!I', zlib.crc32(kind + data) & 0xffffffff)
    pixels = (b'\0' + b'\x40\x80\xc0\xff' * max(width, 1)) * max(height, 1)
    return b'\x89PNG\r\n\x1a\n' + chunk(b'IHDR', struct.pack('!2I5B', width, height, 8, 6, 0, 0, 0)) + chunk(b'IDAT', zlib.compress(pixels)) + chunk(b'IEND', b'')


@pytest.mark.parametrize('width,height,expected', [(1, 1, 200), (512, 1, 200), (512, 512, 200), (513, 1, 400), (1, 513, 400), (0, 1, 400)])
def test_avatar_actual_decode_and_dimension_boundaries(service, width, height, expected):
    """ProfileService.update/avatar: real PNG decode at 1/512/513-pixel limits."""
    profile = ok(service, 'GET', '/me/profile')
    value = 'data:image/png;base64,' + base64.b64encode(png(width, height)).decode()
    assert call(service, 'PATCH', '/me/profile', {'avatar': value}, version=profile['rowVersion'])[0] == expected


@pytest.mark.parametrize('email,expected', [
    ('person+pdl@example.test', 200), ('a' * 64 + '@example.test', 200),
    ('a' * 65 + '@example.test', 400), ('.person@example.test', 400),
    ('person..name@example.test', 400), ('person@example', 400), ('not-an-email', 400), ('', 200),
])
def test_email_equivalence_and_local_part_boundary(service, email, expected):
    """ProfileService.update: ordinary/plus/64/65 local-part and malformed addresses."""
    profile = ok(service, 'GET', '/me/profile')
    assert call(service, 'PATCH', '/me/profile', {'email': email}, version=profile['rowVersion'])[0] == expected


@pytest.mark.parametrize('seconds,expected', [(0, 200), (0.5, 400), (-0.5, 400), (-1, 400), (34560001, 400), (18446744073709551616, 400), (34560000, 200)])
def test_admin_clock_seconds_are_bounded_integers(service, seconds, expected):
    """AdminController.advanceClock: integer lower/upper bounds and coercion/overflow negatives."""
    token = service.login('admin')[1]['token']
    assert service.call('POST', '/admin/clock/advance', {'seconds': seconds}, token)[0] == expected
