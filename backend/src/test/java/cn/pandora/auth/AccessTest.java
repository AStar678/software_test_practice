package cn.pandora.auth;

import cn.pandora.common.Db;
import org.junit.jupiter.api.Test;

import java.util.*;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

class AccessTest {
    private static final Actor UNASSIGNED_MIDDLE = new Actor("manager", "org", "middle", null, "upper", 2);

    @Test
    void missingDepartmentDoesNotCreateAManagementScopeOverUnassignedPeople() {
        Access access = new Access(mock(Db.class));
        Map<String, Object> person = new HashMap<>();
        person.put("id", "employee");
        person.put("organizationId", "org");
        person.put("teamId", null);
        assertFalse(access.canSeePerson(UNASSIGNED_MIDDLE, person));
        person.put("id", "manager");
        assertTrue(access.canSeePerson(UNASSIGNED_MIDDLE, person), "self visibility is independent of management scope");
    }

    @Test
    void missingDepartmentCannotRevealOtherUnassignedPeoplesTasks() {
        Db db = mock(Db.class);
        Access access = new Access(db);
        Map<String, Object> task = Map.of("id", "task", "organizationId", "org",
                "originalCreatorId", "someone-else", "currentVersionId", "version");
        assertFalse(access.canSeeTask(UNASSIGNED_MIDDLE, task, Map.of("id", "version"), List.of("employee")));
        verifyNoInteractions(db);
        assertTrue(access.canSeeTask(UNASSIGNED_MIDDLE, task, Map.of("id", "version"), List.of("manager")),
                "an explicitly assigned manager still has participant access");
    }

    @Test
    void organizationBoundaryIsCheckedBeforeIdentityAndBroadRole() {
        Access access = new Access(mock(Db.class));
        Actor upper = new Actor("upper", "org-a", "upper", null, null, 1);
        assertFalse(access.canSeePerson(upper, Map.of("id", "upper", "organizationId", "org-b")));
        Map<String, Object> otherTask = Map.of("id", "task", "organizationId", "org-b",
                "originalCreatorId", "upper", "currentVersionId", "version");
        assertFalse(access.canSeeTask(upper, otherTask, Map.of("id", "version"), List.of("upper")));
    }
}
