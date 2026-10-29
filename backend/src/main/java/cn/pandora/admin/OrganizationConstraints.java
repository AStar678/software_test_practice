package cn.pandora.admin;

import cn.pandora.auth.CompanyTree;
import cn.pandora.common.Db;
import org.slf4j.LoggerFactory;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;
import java.util.*;
import static cn.pandora.common.Db.*;

/** Reports fixed-model readiness. Runtime maintenance never executes constraint-changing DDL. */
@Component
@Order(OrganizationConstraints.ORDER)
public class OrganizationConstraints implements ApplicationRunner {
    public static final int ORDER=100;
    private final Db db;
    public OrganizationConstraints(Db db) {this.db=db;}
    @Override public void run(ApplicationArguments args) {
        LoggerFactory.getLogger(OrganizationConstraints.class).info("Fixed organization readiness: {}",status());
    }
    public Map<String,Object> status() {
        List<Map<String,Object>> companies=new ArrayList<>();
        for(var company:db.list("SELECT id FROM organizations ORDER BY id")) companies.add(status(s(company,"id")));
        return Map.of("companies",companies,"formalWritesReady",companies.stream().allMatch(c->Boolean.TRUE.equals(c.get("formalWritesReady"))),
                "runtimeDdlEnabled",false);
    }
    public Map<String,Object> status(String organizationId) {
        var tree=new CompanyTree(db).of(organizationId);
        List<String> blockers=new ArrayList<>(tree.blockers());
        if(n(db.one("SELECT COUNT(*) AS c FROM admin_accounts a JOIN principals p ON p.organization_id=a.organization_id AND p.id=a.id "
                + "WHERE a.organization_id=? AND a.active=1 AND p.active=1 AND p.account_type='admin'",organizationId),"c")!=1)
            blockers.add("INDEPENDENT_ADMIN_REQUIRED");
        if(n(db.one("SELECT COUNT(*) AS c FROM users u JOIN principals p ON p.organization_id=u.organization_id AND p.id=u.id "
                + "WHERE u.organization_id=? AND p.account_type='admin'",organizationId),"c")>0)
            blockers.add("ADMIN_BUSINESS_REFERENCE_REPAIR_REQUIRED");
        if(n(db.one("SELECT COUNT(*) AS c FROM users u JOIN principals p ON p.organization_id=u.organization_id AND p.id=u.id "
                + "WHERE u.organization_id=? AND u.active=1 AND p.account_type='employee' AND (u.login_phone IS NULL OR u.login_phone='')",organizationId),"c")>0)
            blockers.add("EMPLOYEE_LOGIN_PHONE_REQUIRED");
        if(n(db.one("SELECT COUNT(*) AS c FROM users u WHERE u.organization_id=? AND u.active=1 AND u.login_phone IS NOT NULL "
                + "AND EXISTS (SELECT 1 FROM users x JOIN principals p ON p.organization_id=x.organization_id AND p.id=x.id "
                + "WHERE x.login_phone=u.login_phone AND x.id<>u.id AND x.active=1 AND p.account_type='employee')",organizationId),"c")>0)
            blockers.add("EMPLOYEE_LOGIN_PHONE_DUPLICATE");
        return Map.of("organizationId",organizationId,"formalWritesReady",blockers.isEmpty(),"blockers",List.copyOf(blockers),
                "runtimeDdlEnabled",false);
    }
    public boolean formalWritesReady(String organizationId) {return Boolean.TRUE.equals(status(organizationId).get("formalWritesReady"));}
    public boolean formalWritesReady() {return Boolean.TRUE.equals(status().get("formalWritesReady"));}
    /** Retained during controller cutover. All schema changes belong to forward migrations. */
    public boolean tryTighten() {return false;}
}
