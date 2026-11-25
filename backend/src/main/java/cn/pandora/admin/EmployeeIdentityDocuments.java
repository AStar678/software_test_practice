package cn.pandora.admin;

import cn.pandora.auth.Actor;
import cn.pandora.common.ApiException;
import cn.pandora.common.Db;
import org.springframework.dao.DuplicateKeyException;
import org.springframework.stereotype.Service;

import java.util.LinkedHashMap;
import java.util.Map;

import static cn.pandora.common.Db.s;

/**
 * Administrator-only store for identity documents. It lives in its own table so the wide employee
 * directory and every employee-facing projection keep selecting from {@code users} only. Callers must
 * already hold the administrator check and the company write transaction.
 */
@Service
public class EmployeeIdentityDocuments {
    private final Db db;

    public EmployeeIdentityDocuments(Db db) {
        this.db = db;
    }

    /** Masked values keyed by employee id for the administrator employee list. Never full numbers. */
    public Map<String, String> maskedByEmployee(Actor actor) {
        Map<String, String> masked = new LinkedHashMap<>();
        for (Map<String, Object> row : db.list("SELECT employee_id,id_card_no FROM employee_identity_documents WHERE organization_id=?",
                actor.organizationId())) {
            masked.put(s(row, "employeeId"), IdCardNumbers.mask(s(row, "idCardNo")));
        }
        return masked;
    }

    /** Full value for the administrator detail/edit entry only. {@code null} when not recorded yet. */
    public String full(Actor actor, String employeeId) {
        Map<String, Object> row = db.find("SELECT id_card_no FROM employee_identity_documents WHERE organization_id=? AND employee_id=?",
                actor.organizationId(), employeeId);
        return row == null ? null : s(row, "idCardNo");
    }

    /** Same-company uniqueness with the acting employee exempted for a correction of their own number. */
    public void requireAvailable(Actor actor, String normalized, String exceptEmployeeId) {
        Map<String, Object> existing = db.find("SELECT employee_id FROM employee_identity_documents WHERE organization_id=? AND id_card_no=?",
                actor.organizationId(), normalized);
        if (existing != null && !s(existing, "employeeId").equals(exceptEmployeeId)) {
            throw new ApiException(409, "ID_CARD_TAKEN", "该身份证号已被其他员工使用");
        }
    }

    /** Insert or correct one document inside the caller's transaction. */
    public void put(Actor actor, String employeeId, String normalized) {
        Map<String, Object> existing = db.find("SELECT row_version FROM employee_identity_documents WHERE organization_id=? AND employee_id=?",
                actor.organizationId(), employeeId);
        try {
            if (existing == null) {
                db.update("INSERT INTO employee_identity_documents(organization_id,employee_id,id_card_no) VALUES(?,?,?)",
                        actor.organizationId(), employeeId, normalized);
            } else {
                db.update("UPDATE employee_identity_documents SET id_card_no=?,row_version=row_version+1,updated_at=CURRENT_TIMESTAMP(6) "
                        + "WHERE organization_id=? AND employee_id=?", normalized, actor.organizationId(), employeeId);
            }
        } catch (DuplicateKeyException duplicate) {
            throw new ApiException(409, "ID_CARD_TAKEN", "该身份证号已被其他员工使用");
        }
    }
}
