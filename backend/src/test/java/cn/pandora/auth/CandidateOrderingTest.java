package cn.pandora.auth;

import org.junit.jupiter.api.Test;

import java.util.Map;

import static org.junit.jupiter.api.Assertions.*;

class CandidateOrderingTest {
    @Test
    void fixedRolesHaveAStableLeadershipFirstRank() {
        int founder = Access.candidateRank(Map.of("rankLevel", 1));
        int departmentHead = Access.candidateRank(Map.of("rankLevel", 2));
        int teamHead = Access.candidateRank(Map.of("rankLevel", 3));
        int employee = Access.candidateRank(Map.of("rankLevel", 4));

        assertTrue(founder < departmentHead);
        assertTrue(departmentHead < teamHead);
        assertTrue(teamHead < employee);
        assertEquals(5, Access.candidateRank(null));
    }
}
