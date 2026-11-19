package cn.pandora.task;

import cn.pandora.common.ApiException;
import java.time.*;
import java.util.*;
import java.util.stream.*;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.*;
import static org.junit.jupiter.api.Assertions.*;

class TaskGuardBoundaryMatrixTest {
    @ParameterizedTest @ValueSource(ints = {1, 79, 80})
    void taskTextLimitsCountCodePointsNotUtf16Units(int count) {
        String title = "😀".repeat(count);
        assertEquals(title, TaskService.requiredText(Map.of("title", title), "title", 80));
    }
    static Stream<Object> invalidTitles() {
        return Stream.of("", " \n ", "😀".repeat(81), "bad\0text", 42, List.of("title"));
    }
    @ParameterizedTest @MethodSource("invalidTitles")
    void invalidTitleClassesAreRejected(Object value) {
        assertThrows(ApiException.class, () -> TaskService.requiredText(Map.of("title", value), "title", 80));
    }
    @ParameterizedTest @ValueSource(ints = {1, 99, 100})
    void assigneeListAcceptsExactSupportedCardinalities(int count) {
        var ids = IntStream.range(0, count).mapToObj(i -> String.format("00000000-0000-0000-0000-%012x", i)).toList();
        assertEquals(ids, TaskService.ids(ids));
    }
    @ParameterizedTest @ValueSource(ints = {0, 101, 1000})
    void emptyOrOversizedAssigneeListIsRejected(int count) {
        var ids = IntStream.range(0, count).mapToObj(i -> String.format("00000000-0000-0000-0000-%012x", i)).toList();
        assertThrows(ApiException.class, () -> TaskService.ids(ids));
    }
    @ParameterizedTest @ValueSource(strings = {"1000-01-01", "2000-02-29", "2024-02-29", "9998-12-31"})
    void supportedDateAndLeapYearBoundariesAreAccepted(String date) {
        assertEquals(LocalDate.parse(date), TaskService.requiredDate(date, "day"));
    }
    @ParameterizedTest @ValueSource(strings = {"0999-12-31", "9999-01-01", "1900-02-29", "2026-02-29", "2026-04-31", "2026-1-1", "2026-01-01T00:00:00Z"})
    void illegalCalendarAndFirstOutsideYearsAreRejected(String date) {
        assertThrows(ApiException.class, () -> TaskService.requiredDate(date, "day"));
    }
    @ParameterizedTest @ValueSource(strings = {"1000-01-01T00:00:00Z", "9998-12-31T23:59:59Z", "2026-11-18T23:59:59.123456789+08:00"})
    void zonedInstantsNormalizeAndRoundDownToMysqlMicroseconds(String raw) {
        Instant expected = OffsetDateTime.parse(raw).toInstant().truncatedTo(java.time.temporal.ChronoUnit.MICROS);
        assertEquals(expected, TaskService.instant(raw, "time"));
    }
    @ParameterizedTest @ValueSource(strings = {"2026-11-18T12:00:00", "2026-11-18", "0999-12-31T23:59:59Z", "9999-01-01T00:00:00Z", "not-a-time"})
    void timezoneFreeMalformedAndUnsupportedTimesAreRejected(String raw) {
        assertThrows(ApiException.class, () -> TaskService.instant(raw, "time"));
    }
    static Stream<Object> invalidBooleans() {
        return Stream.of("true", 2, -1, 0.5, 1.5, 4294967296L);
    }
    @ParameterizedTest @MethodSource("invalidBooleans")
    void fractionalAndOverflowingNumbersCannotMasqueradeAsBooleans(Object value) {
        assertThrows(ApiException.class, () -> TaskService.bool(value, "allDay"));
    }
}
