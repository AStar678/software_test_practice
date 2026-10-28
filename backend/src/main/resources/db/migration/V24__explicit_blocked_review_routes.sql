-- A broken route is frozen explicitly, never treated as an exemption or assigned to an inactive user.
-- Historical terminal records remain valid. Administrative withdrawals must carry their reason.
ALTER TABLE approval_requests DROP CHECK ck_request_reviewer;
ALTER TABLE approval_requests ADD CONSTRAINT ck_request_reviewer CHECK (
 current_reviewer_id IS NOT NULL
 OR (status<>'pending' AND COALESCE(CHAR_LENGTH(TRIM(exemption_reason)),0)>0)
 OR COALESCE(route_reason,'') IN ('applicant-unavailable','business-owner-unavailable',
     'organization-tree','manager-missing','manager-unavailable','manager-inactive',
     'manager-admin','manager-cycle','creator-missing','creator-unavailable','route-blocked')
 OR (status='withdrawn' AND COALESCE(CHAR_LENGTH(TRIM(comment)),0)>0)
);
