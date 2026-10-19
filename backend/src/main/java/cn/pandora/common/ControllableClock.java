package cn.pandora.common;

import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.ZoneId;
import java.time.ZoneOffset;
import java.util.concurrent.atomic.AtomicReference;

/**
 * Testable clock used by the deadline, reminder and notification rules (DEV-012, DEV-014, DEV-032).
 *
 * Production keeps {@link Clock#systemUTC()}. When {@code pandora.clock.controllable=true} the
 * application exposes this clock to the administration-only test endpoint, so a verification run can
 * advance time without changing the operating system clock. A fixed-time property is also supported
 * for one-shot runs that never need to advance. Without a fixed base, the clock keeps following the
 * system time and only adds the test offset.
 */
public final class ControllableClock extends Clock {
    private volatile Instant fixedBase;
    private final ZoneId zone;
    private final AtomicReference<Duration> offset;

    public ControllableClock(Instant fixedBase, ZoneId zone) {
        this.fixedBase = fixedBase;
        this.zone = zone == null ? ZoneOffset.UTC : zone;
        this.offset = new AtomicReference<>(Duration.ZERO);
    }

    public ControllableClock(Instant fixedBase) {
        this(fixedBase, ZoneOffset.UTC);
    }

    public ControllableClock advance(Duration duration) {
        if (duration == null || duration.isNegative()) throw new IllegalArgumentException("时钟只能向前推进");
        offset.updateAndGet(current -> current.plus(duration));
        return this;
    }

    public ControllableClock reset(Instant base) {
        offset.set(Duration.ZERO);
        fixedBase = base;
        return this;
    }

    public Instant base() {
        return fixedBase == null ? Instant.now() : fixedBase;
    }

    public Duration offset() {
        return offset.get();
    }

    @Override
    public ZoneId getZone() {
        return zone;
    }

    @Override
    public Clock withZone(ZoneId replacement) {
        return new ControllableClock(fixedBase, replacement);
    }

    @Override
    public Instant instant() {
        return (fixedBase == null ? Instant.now() : fixedBase).plus(offset.get());
    }
}
