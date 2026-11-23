"""Close coverage gaps in reachable company-management, audit and compatibility reads."""
import uuid
import pytest
from test_acceptance_extremes import call, ok


@pytest.mark.parametrize('value,expected', [
    ('18:00', 200), ('00:00', 200), ('23:59:59', 200),
    ('24:00', 400), ('23:60', 400), ('1:00', 400), ('12:00:60', 400), ('', 400),
])
def test_off_work_time_exact_endpoints_and_malformed_values(service, value, expected):
    """OrganizationService.setOffWorkTime: normal, 00:00/23:59:59, first illegal hour/minute/second."""
    try:
        assert call(service, 'PUT', '/admin/company/off-work-time', {'offWorkTime': value}, who='admin')[0] == expected
    finally:
        assert call(service, 'PUT', '/admin/company/off-work-time', {'offWorkTime': '18:00'}, who='admin')[0] == 200


@pytest.mark.parametrize('who', ['founder', 'alpha-head', 'alpha-one-employee'])
def test_company_clock_is_admin_only(service, who):
    """OrganizationService.setOffWorkTime: business roles cannot mutate shared company settings."""
    assert call(service, 'PUT', '/admin/company/off-work-time', {'offWorkTime': '18:00'}, who=who)[0] == 403


@pytest.mark.parametrize('version,expected', [(1, 200), (None, 428), (2, 412)])
def test_company_delete_preconditions(service, version, expected):
    """OrganizationService.deleteCompanyItem: correct/missing/stale versions and real row deletion."""
    item=ok(service, 'POST', '/admin/company/items', {'body':'owned delete witness'}, who='admin')['id']
    try:
        status,_=call(service,'DELETE','/admin/company/items/'+item,who='admin',version=version)
        assert status==expected
        visible=call(service,'GET','/home/items/'+item)[0]
        assert visible==(404 if expected==200 else 200)
    finally:
        call(service,'DELETE','/admin/company/items/'+item,who='admin',version=1)


@pytest.mark.parametrize('who,missing,expected', [('founder',False,200),('alpha-one-employee',False,200),('other-founder',False,404),('founder',True,404)])
def test_company_home_item_detail_scope(service, who, missing, expected):
    """WorkspaceService.homeItem: readable company item, missing UUID and company isolation."""
    item=ok(service,'POST','/admin/company/items',{'body':'read-only company witness'},who='admin')['id']
    try:
        status,data=call(service,'GET','/home/items/'+(str(uuid.uuid4()) if missing else item),who=who)
        assert status==expected
        if status==200:assert data['editable'] is False and 'ownerId' not in data and 'organizationId' not in data
    finally:
        call(service,'DELETE','/admin/company/items/'+item,who='admin',version=1)


@pytest.mark.parametrize('path', ['/admin/teams','/admin/audit-logs'])
@pytest.mark.parametrize('limit,expected', [('1',200),('100',200),('0',400),('101',400),('-1',400),('x',400)])
def test_admin_directory_and_audit_pagination(service,path,limit,expected):
    """WorkspaceService.adminTeams/audit: normal/exact limits and malformed pagination."""
    status,data=call(service,'GET',path+'?limit='+limit,who='admin')
    assert status==expected
    if status==200:assert len(data['items'])<=int(limit)


@pytest.mark.parametrize('path', ['/admin/teams','/admin/audit-logs'])
@pytest.mark.parametrize('who', ['founder','alpha-head','alpha-one-employee'])
def test_admin_audit_and_team_reads_reject_business_roles(service,path,who):
    """WorkspaceService.adminTeams/audit: founder, manager and employee have no independent-admin authority."""
    assert call(service,'GET',path,who=who)[0]==403
