package cn.pandora.common;

import java.time.*;
import java.util.stream.Stream;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.*;
import static org.junit.jupiter.api.Assertions.*;

/** Acceptance matrix: equivalence classes and exact limits, independent of SQL mocks. */
class CoreBoundaryMatrixTest {
    @ParameterizedTest
    @ValueSource(longs = {0, 1, Long.MAX_VALUE})
    void exactVersionIsAccepted(long version) {
        assertDoesNotThrow(() -> Writes.checkVersion("\"" + version + "\"", version));
    }

    @ParameterizedTest
    @NullAndEmptySource
    @ValueSource(strings = {" ", "\t"})
    void missingVersionRequiresPrecondition(String header) {
        ApiException e = assertThrows(ApiException.class, () -> Writes.checkVersion(header, 1));
        assertEquals(428, e.status); assertEquals("PRECONDITION_REQUIRED", e.code);
    }

    @ParameterizedTest
    @ValueSource(strings = {"1", "\"01\"", "W/\"1\"", "*", "\"0\"", "\"2\"", "\"-1\""})
    void malformedOrStaleVersionNeverWrites(String header) {
        ApiException e = assertThrows(ApiException.class, () -> Writes.checkVersion(header, 1));
        assertEquals(412, e.status); assertEquals("VERSION_CONFLICT", e.code);
    }

    @ParameterizedTest
    @ValueSource(longs = {0, 1, 86400})
    void clockZoneChangePreservesTheCurrentInstant(long advanceSeconds) {
        Instant base = Instant.parse("2024-02-29T23:59:59Z");
        ControllableClock clock = new ControllableClock(base).advance(Duration.ofSeconds(advanceSeconds));
        Clock changed = clock.withZone(ZoneId.of("Asia/Shanghai"));
        assertEquals(clock.instant(), changed.instant(), "Clock.withZone must change the zone without losing elapsed time");
        assertEquals(ZoneId.of("Asia/Shanghai"), changed.getZone());
    }

    @ParameterizedTest
    @ValueSource(longs = {0, 1, 86400})
    void clockAdvanceAndResetAreExact(long seconds) {
        Instant base = Instant.parse("2026-12-31T23:59:59Z");
        ControllableClock clock = new ControllableClock(base);
        assertSame(clock, clock.advance(Duration.ofSeconds(seconds)));
        assertEquals(base.plusSeconds(seconds), clock.instant());
        clock.reset(base.minusSeconds(1));
        assertEquals(Duration.ZERO, clock.offset());
        assertEquals(base.minusSeconds(1), clock.instant());
    }

    static Stream<Duration> invalidDurations() {
        return Stream.of(null, Duration.ofNanos(-1), Duration.ofDays(-1));
    }

    @ParameterizedTest
    @MethodSource("invalidDurations")
    void negativeOrMissingClockAdvanceIsRejected(Duration duration) {
        var clock = new ControllableClock(Instant.EPOCH);
        assertThrows(IllegalArgumentException.class, () -> clock.advance(duration));
        assertEquals(Instant.EPOCH, clock.instant());
    }
}
