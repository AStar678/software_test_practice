package cn.pandora.task;

import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.*;

class TaskTableCollationTest {
    @Test
    void locksTheSimplifiedChineseTitleOrderAndTextualNumbers() {
        assertTrue(TaskService.compareTitle("阿", "波") < 0);
        assertTrue(TaskService.compareTitle("分镜10", "分镜2") < 0);
        assertTrue(TaskService.compareTitle("a任务", "波任务") < 0);
        assertNotEquals(0, TaskService.compareTitle("a", "A"));
    }

    @Test
    void canonicalEquivalentsCompareEqualSoCallersFallBackToIdAscending() {
        // "café" (NFC) and "cafe" + combining acute (NFD) are the same text at canonical decomposition.
        assertEquals(0, TaskService.compareTitle("caf\u00e9", "cafe\u0301"));
        assertTrue(TaskService.compareTitle("cafe\u0301", "caff") < 0);
    }
}
