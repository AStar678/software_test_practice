package cn.pandora.calendar;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.boot.context.event.ApplicationReadyEvent;
import org.springframework.context.event.EventListener;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

/**
 * Background current-year/next-year check. Both entry points only register bounded, de-duplicated
 * per-year intents; the HTTP endpoints never wait for the external source.
 *
 * <p>The startup hook must tolerate a database that is intentionally migrated only up to a baseline
 * (the V31 upgrade witness): the holiday tables do not exist there. A missing background table must
 * never fail the whole application, and the next normal write migration will make the daily check
 * work again.</p>
 */
@Component
@ConditionalOnProperty(name = "pandora.holiday.background-enabled", havingValue = "true", matchIfMissing = true)
public class HolidayCalendarScheduler {
    private static final Logger log = LoggerFactory.getLogger(HolidayCalendarScheduler.class);
    private final HolidayCalendarService holidays;

    public HolidayCalendarScheduler(HolidayCalendarService holidays) {
        this.holidays = holidays;
    }

    @EventListener(ApplicationReadyEvent.class)
    public void afterStartup() {
        try {
            holidays.checkCurrentAndNext();
        } catch (RuntimeException exception) {
            log.warn("Holiday startup check skipped: {}", exception.getClass().getSimpleName());
        }
    }

    @Scheduled(cron = "${pandora.holiday.check-cron:0 15 3 * * *}", zone = "UTC")
    public void daily() {
        try {
            holidays.checkCurrentAndNext();
        } catch (RuntimeException exception) {
            log.warn("Holiday daily check skipped: {}", exception.getClass().getSimpleName());
        }
    }
}
