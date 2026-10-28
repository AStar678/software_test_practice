#!/usr/bin/env python3
"""Current independent employee/admin lifecycle checks; owns a disposable database and built JAR.

The shared account contract suite covers both credential namespaces, session refresh/logout,
password policy/all-session revocation, forced initial/reset gates, company boundaries and receipts.
Initial employee creation with a complete placement is covered by check_organization_plans.py.
"""
from check_login_identity_collision import main

if __name__=='__main__': raise SystemExit(main())
