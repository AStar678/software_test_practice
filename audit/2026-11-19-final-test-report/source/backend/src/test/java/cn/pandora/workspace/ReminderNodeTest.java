package cn.pandora.workspace;

import org.junit.jupiter.api.Test;

import java.time.Duration;
import java.time.Instant;

import static org.junit.jupiter.api.Assertions.*;

/** DEV-014: 20/10/5 percent nodes, stale-node skip and zero-duration overdue. */
class ReminderNodeTest {
    private static final Instant START = Instant.parse("2026-10-20T09:00:00Z");
    private static final Instant DUE = Instant.parse("2026-10-20T19:00:00Z");

    @Test
    void selectsTheTenHourSampleNodesInOrder() {
        assertNull(ReminderService.chooseNode(START, DUE, Instant.parse("2026-10-20T16:59:59Z")));
        var twenty = ReminderService.chooseNode(START, DUE, Instant.parse("2026-10-20T17:00:00Z"));
        assertEquals("20", twenty.node());
        assertTrue(twenty.stale().isEmpty());
        var ten = ReminderService.chooseNode(START, DUE, Instant.parse("2026-10-20T18:00:00Z"));
        assertEquals("10", ten.node());
        assertEquals(java.util.List.of(20), ten.stale());
        var five = ReminderService.chooseNode(START, DUE, Instant.parse("2026-10-20T18:30:00Z"));
        assertEquals("5", five.node());
        assertEquals(java.util.List.of(20, 10), five.stale());
    }

    @Test
    void aLateFirstScanSkipsTheEarlierNode() {
        var late = ReminderService.chooseNode(START, DUE, Instant.parse("2026-10-20T18:10:00Z"));
        assertEquals("10", late.node());
        assertEquals(java.util.List.of(20), late.stale());
        assertEquals("10", ReminderService.chooseNode(START, DUE, Instant.parse("2026-10-20T18:20:00Z")).node());
    }

    @Test
    void overdueReplacesAllProportionalNodesAndZeroDurationOnlyOverdues() {
        var overdue = ReminderService.chooseNode(START, DUE, Instant.parse("2026-10-20T19:00:01Z"));
        assertEquals("overdue", overdue.node());
        assertEquals(java.util.List.of(20, 10, 5), overdue.stale());
        assertNull(ReminderService.chooseNode(START, START, START));
        // A zero-duration task sends no proportional node; it is overdue strictly after its deadline.
        assertEquals("overdue", ReminderService.chooseNode(START, START, START.plus(Duration.ofSeconds(1))).node());
    }
}
