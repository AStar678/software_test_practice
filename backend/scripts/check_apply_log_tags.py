#!/usr/bin/env python3
"""Real-service regression for ordered shared work-log tags in a disposable database."""
import datetime as dt
import uuid

from fixed_model_fixture import Fixture


def main():
    with Fixture(port=18227) as fixture:
        tokens = {name: fixture.login(name)[1]['token'] for name in ('founder', 'alpha-one-employee', 'alpha-one-head', 'beta-one-employee', 'other-founder')}
        def call(who, method, path, body=None, version=None):
            return fixture.call(method, path, body, tokens[who], uuid.uuid4().hex if method != 'GET' else None, version)
        def ok(who, method, path, body=None, version=None):
            status, value = call(who, method, path, body, version)
            assert status in (200, 201), (method, path, status, value)
            return value
        def check(label, condition):
            print(('PASS ' if condition else 'FAIL ') + label, flush=True)
            assert condition, label

        tags = [ok('founder', 'POST', '/tags', {'name': name, 'color': color})['tagId'] for name, color in (
            ('日志甲', '#F6D5D2'), ('日志乙', '#D8EAF4'), ('日志丙', '#DCEEE0'))]
        foreign = ok('other-founder', 'POST', '/tags', {'name': '其他公司', 'color': '#FBE3CB'})['tagId']
        day = dt.datetime.now().date().isoformat()
        created = ok('alpha-one-employee', 'POST', '/work-logs', {'body': '有序标签日志', 'businessDate': day, 'tagIds': tags[:2]})
        log_id = created['logId']
        def detail(who='alpha-one-employee'):
            return ok(who, 'GET', '/work-logs/' + log_id)
        original = detail()
        check('create preserves both tag IDs and order', original['tagIds'] == tags[:2] and [tag['id'] for tag in original['tags']] == tags[:2])
        home = ok('alpha-one-employee', 'GET', '/home')
        check('home recent logs use ordered collection', next(item for item in home['recentLogs'] if item['id'] == log_id)['tagIds'] == tags[:2])
        listed = ok('alpha-one-head', 'GET', '/work-logs?scope=visible&authorId=' + fixture.identities['alpha-one-employee']['id'])
        check('manager list reads same ordered collection', next(item for item in listed['items'] if item['id'] == log_id)['tagIds'] == tags[:2])
        for offset in (1,2):
            other_day=(dt.date.fromisoformat(day)-dt.timedelta(days=offset)).isoformat()
            ok('alpha-one-employee', 'POST', '/work-logs', {'body':'分页日志'+str(offset),'businessDate':other_day,'tagIds':[tags[offset]]})
        pages=[ok('alpha-one-head','GET','/work-logs?scope=visible&authorId='+fixture.identities['alpha-one-employee']['id']+'&limit=1&offset='+str(offset)) for offset in (0,1,2)]
        check('manager pages retain independent ordered tag sets',all(page['total']==3 and len(page['items'])==1 and len(page['items'][0]['tagIds'])>=1 for page in pages)
              and {page['items'][0]['id'] for page in pages}=={item['id'] for item in ok('alpha-one-head','GET','/work-logs?scope=visible&authorId='+fixture.identities['alpha-one-employee']['id'])['items']})
        ok('alpha-one-employee', 'PATCH', '/work-logs/' + log_id, {'body': '只改正文'}, original['rowVersion'])
        original=detail()
        check('omitted tagIds preserve existing collection', original['tagIds']==tags[:2] and original['body']=='只改正文')
        check('unrelated colleague cannot read log', call('beta-one-employee', 'GET', '/work-logs/' + log_id)[0] == 404)
        check('old singular tag field is rejected', call('alpha-one-employee', 'PATCH', '/work-logs/' + log_id, {'tagId': tags[0]}, original['rowVersion'])[0] == 400)
        check('duplicate IDs reject whole edit', call('alpha-one-employee', 'PATCH', '/work-logs/' + log_id, {'body': 'must not persist', 'tagIds': [tags[0], tags[0]]}, original['rowVersion'])[0] == 400 and detail()['body'] == original['body'])
        check('cross-company tag rejects whole edit', call('alpha-one-employee', 'PATCH', '/work-logs/' + log_id, {'body': 'must not persist', 'tagIds': [foreign]}, original['rowVersion'])[0] == 400 and detail()['body'] == original['body'])
        check('manager cannot alter author tags', call('alpha-one-head', 'PATCH', '/work-logs/' + log_id, {'tagIds': [tags[2]]}, original['rowVersion'])[0] in (403, 404))
        ok('alpha-one-employee', 'PATCH', '/work-logs/' + log_id, {'tagIds': [tags[1], tags[2]]}, original['rowVersion'])
        check('remove and append retains selection order', detail()['tagIds'] == [tags[1], tags[2]])
        current = detail()
        ok('founder', 'PATCH', '/tags/' + tags[1], {'name': '日志乙改名', 'color': '#E4DEF3'}, 1)
        check('live catalogue change refreshes log tag', detail()['tags'][0]['name'] == '日志乙改名' and detail()['tags'][0]['color'] == '#E4DEF3')
        ok('founder', 'DELETE', '/tags/' + tags[1], version=2)
        check('deleted reference stays visible', detail()['tags'][0]['deleted'] is True)
        check('deleted tag cannot be newly attached', call('alpha-one-employee', 'POST', '/work-logs', {'body': 'another', 'businessDate': day, 'tagIds': [tags[1]]})[0] in (400, 409))
        ok('alpha-one-employee', 'PATCH', '/work-logs/' + log_id, {'body': 'still valid', 'tagIds': [tags[1], tags[2]]}, current['rowVersion'])
        check('unchanged deleted reference can remain', detail()['tagIds'] == [tags[1], tags[2]])
        check('stale version leaves body and tags unchanged', call('alpha-one-employee', 'PATCH', '/work-logs/' + log_id, {'body': 'stale', 'tagIds': []}, current['rowVersion'])[0] == 412 and detail()['body'] == 'still valid')
        latest = detail()
        ok('alpha-one-employee', 'PATCH', '/work-logs/' + log_id, {'tagIds': []}, latest['rowVersion'])
        check('explicit empty collection clears tags', detail()['tagIds'] == [])


if __name__ == '__main__':
    main()
