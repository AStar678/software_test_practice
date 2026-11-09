package cn.pandora.calendar;

import cn.pandora.auth.Access;
import cn.pandora.auth.Actor;
import cn.pandora.common.ApiException;
import cn.pandora.common.Db;
import cn.pandora.common.Writes;
import jakarta.annotation.PreDestroy;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;

import java.sql.Timestamp;
import java.time.*;
import java.util.*;
import java.util.concurrent.*;
import java.util.concurrent.atomic.AtomicInteger;

import static cn.pandora.common.Db.*;

/**
 * Project-owned annual holiday cache.
 *
 * <p>Reads never touch the network. A missing or expired year registers one bounded background
 * intent per year; repeats within the retry interval are ignored. An explicit administrator refresh
 * fetches and validates outside the write transaction, then commits the whole year atomically. A
 * failed fetch or invalid payload updates only the attempt/failure state and keeps the last
 * successful days/source/updatedAt.</p>
 */
@Service
public class HolidayCalendarService {
    private static final Logger log = LoggerFactory.getLogger(HolidayCalendarService.class);
    private static final String REGION = "CN";
    private static final ZoneId COMPANY_ZONE = ZoneId.of("Asia/Shanghai");
    private static final Duration RETRY_INTERVAL = Duration.ofHours(24);
    private static final Duration READY_REFRESH_INTERVAL = Duration.ofHours(24);

    private final Db db;
    private final HolidaySource source;
    private final Writes writes;
    private final Access access;
    private final Clock clock;
    private final TransactionTemplate tx;
    private final boolean backgroundEnabled;
    private final int workerThreads;
    private final ExecutorService executor;
    private final Set<Integer> inFlight = ConcurrentHashMap.newKeySet();

    public HolidayCalendarService(Db db, HolidaySource source, Writes writes, Access access, Clock clock,
                                  PlatformTransactionManager transactionManager,
                                  @Value("${pandora.holiday.background-enabled:true}") boolean backgroundEnabled,
                                  @Value("${pandora.holiday.worker-threads:2}") int workerThreads) {
        this.db = db;
        this.source = source;
        this.writes = writes;
        this.access = access;
        this.clock = clock;
        this.tx = new TransactionTemplate(transactionManager);
        this.backgroundEnabled = backgroundEnabled;
        this.workerThreads = Math.max(1, Math.min(4, workerThreads));
        AtomicInteger sequence = new AtomicInteger();
        this.executor = Executors.newFixedThreadPool(this.workerThreads, runnable -> {
            Thread thread = new Thread(runnable, "holiday-refresh-" + sequence.incrementAndGet());
            thread.setDaemon(true);
            return thread;
        });
    }

    public static int parseYear(String raw) {
        if (raw == null || !raw.matches("\\d{4}")) {
            throw new ApiException(400, "INVALID_YEAR", "年份须为 1900–9999 的四位公历年");
        }
        int year;
        try {
            year = Integer.parseInt(raw);
        } catch (NumberFormatException exception) {
            throw new ApiException(400, "INVALID_YEAR", "年份须为 1900–9999 的四位公历年");
        }
        if (year < 1900 || year > 9999) {
            throw new ApiException(400, "INVALID_YEAR", "年份须为 1900–9999 的四位公历年");
        }
        return year;
    }

    /** Read the local cache and register one background refresh intent when the year needs it. */
    public Map<String, Object> view(int year, boolean allowBackground) {
        validateYear(year);
        Map<String, Object> result = read(year);
        if (allowBackground) scheduleIfDue(year, false);
        return result;
    }

    /** Command used by the independent administrator; fetches outside the short write transaction. */
    public Map<String, Object> refreshNow(Actor actor, int year, String key) {
        access.requireAdmin(actor);
        validateYear(year);
        Map<String, Object> body = Map.of("year", year);
        String scope = "POST /admin/calendar/holidays/" + year + "/refresh";
        var replay = writes.replayIfPresent(actor, key, scope, body, null);
        if (replay != null) return replay;
        HolidayPayload.Year parsed;
        try {
            parsed = source.fetch(year);
        } catch (HolidaySourceException exception) {
            recordFailure(year, exception.safeCode());
            throw refreshFailure(exception.safeCode());
        }
        try {
            return writes.run(actor, key, scope, body, null, () -> {
                access.requireCurrent(actor);
                store(parsed);
                audit(actor, parsed);
                return read(year);
            });
        } catch (HolidaySourceException exception) {
            recordFailure(year, exception.safeCode());
            throw refreshFailure(exception.safeCode());
        }
    }

    /** Enqueue the current and next calendar year after startup and on the daily maintenance tick. */
    public void checkCurrentAndNext() {
        int current = LocalDate.now(clock.withZone(COMPANY_ZONE)).getYear();
        scheduleIfDue(current, true);
        if (current < 9999) scheduleIfDue(current + 1, true);
    }

    /** Visible for deterministic tests: schedule only if the stored state says another try is due. */
    public boolean scheduleIfDue(int year, boolean includeReady) {
        validateYear(year);
        if (!backgroundEnabled) return false;
        if (!due(year, includeReady)) return false;
        return schedule(year);
    }

    private boolean schedule(int year) {
        if (!inFlight.add(year)) return false;
        try {
            executor.submit(() -> {
                try {
                    refreshBackground(year);
                } catch (RuntimeException exception) {
                    log.warn("Holiday refresh for {} failed: {}", year, exception.getClass().getSimpleName());
                } finally {
                    inFlight.remove(year);
                }
            });
            return true;
        } catch (RejectedExecutionException exception) {
            inFlight.remove(year);
            return false;
        }
    }

    private void refreshBackground(int year) {
        try {
            HolidayPayload.Year parsed = source.fetch(year);
            store(parsed);
        } catch (HolidaySourceException exception) {
            recordFailure(year, exception.safeCode());
        } catch (RuntimeException exception) {
            recordFailure(year, "HOLIDAY_REFRESH_INTERNAL");
            log.warn("Holiday refresh for {} failed: {}", year, exception.getClass().getSimpleName());
        }
    }

    private boolean due(int year, boolean includeReady) {
        Map<String, Object> header = db.find(
                "SELECT fetched_at,last_attempt_at,last_failure_at FROM holiday_calendar_years WHERE region=? AND year=?",
                REGION, year);
        if (header == null) return true;
        Instant now = clock.instant();
        Instant lastAttempt = instant(header.get("lastAttemptAt"));
        Instant lastFailure = instant(header.get("lastFailureAt"));
        Instant fetched = instant(header.get("fetchedAt"));
        if (lastAttempt != null && lastAttempt.plus(RETRY_INTERVAL).isAfter(now)) return false;
        if (lastFailure != null && lastFailure.plus(RETRY_INTERVAL).isAfter(now)) return false;
        if (fetched == null) return true;
        return includeReady && (lastAttempt == null || !lastAttempt.plus(READY_REFRESH_INTERVAL).isAfter(now));
    }

    private Map<String, Object> read(int year) {
        Map<String, Object> header = db.find(
                "SELECT source,fetched_at,last_failure_at,last_failure_code FROM holiday_calendar_years WHERE region=? AND year=?",
                REGION, year);
        List<Map<String, Object>> days = new ArrayList<>();
        String status = "missing";
        String sourceName = source.sourceName();
        Object updatedAt = null;
        String reason = null;
        if (header != null) {
            sourceName = Objects.toString(header.get("source"), sourceName);
            Instant fetched = instant(header.get("fetchedAt"));
            Instant failure = instant(header.get("lastFailureAt"));
            if (fetched != null) {
                status = failure != null && failure.isAfter(fetched) ? "stale" : "ready";
                updatedAt = header.get("fetchedAt");
                if ("stale".equals(status)) reason = Objects.toString(header.get("lastFailureCode"), null);
                for (Map<String, Object> row : db.list(
                        "SELECT holiday_date,name,is_off_day FROM holiday_calendar_days WHERE region=? AND year=? ORDER BY holiday_date",
                        REGION, year)) {
                    Map<String, Object> day = new LinkedHashMap<>();
                    day.put("date", row.get("holidayDate"));
                    day.put("name", row.get("name"));
                    Object off = row.get("isOffDay");
                    boolean offDay = off instanceof Boolean flag ? flag
                            : off instanceof Number number && number.intValue() != 0;
                    day.put("isOffDay", offDay);
                    days.add(day);
                }
            } else {
                reason = Objects.toString(header.get("lastFailureCode"), null);
            }
        }
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("year", year);
        result.put("region", REGION);
        result.put("status", status);
        result.put("days", days);
        result.put("source", sourceName);
        result.put("updatedAt", updatedAt);
        if (reason != null) result.put("reason", reason);
        return result;
    }

    private void store(HolidayPayload.Year parsed) {
        Timestamp now = Timestamp.from(clock.instant());
        tx.executeWithoutResult(status -> {
            db.update("INSERT INTO holiday_calendar_years(region,year,source,source_hash,official_notice,fetched_at,last_attempt_at,last_failure_at,last_failure_code) "
                            + "VALUES(?,?,?,?,?,?,?,NULL,NULL) ON DUPLICATE KEY UPDATE source=VALUES(source),source_hash=VALUES(source_hash),"
                            + "official_notice=VALUES(official_notice),fetched_at=VALUES(fetched_at),last_attempt_at=VALUES(last_attempt_at),"
                            + "last_failure_at=NULL,last_failure_code=NULL",
                    REGION, parsed.year(), source.sourceName(), parsed.sourceHash(), parsed.officialNotice(), now, now);
            db.update("DELETE FROM holiday_calendar_days WHERE region=? AND year=?", REGION, parsed.year());
            for (HolidayPayload.Day day : parsed.days()) {
                db.update("INSERT INTO holiday_calendar_days(region,year,holiday_date,name,is_off_day) VALUES(?,?,?,?,?)",
                        REGION, parsed.year(), day.date(), day.name(), day.offDay());
            }
        });
    }

    private void recordFailure(int year, String safeCode) {
        Timestamp now = Timestamp.from(clock.instant());
        tx.executeWithoutResult(status -> {
            Map<String, Object> header = db.find(
                    "SELECT year FROM holiday_calendar_years WHERE region=? AND year=? FOR UPDATE", REGION, year);
            if (header == null) {
                db.update("INSERT INTO holiday_calendar_years(region,year,source,fetched_at,last_attempt_at,last_failure_at,last_failure_code) "
                                + "VALUES(?,?,?,NULL,?,?,?)",
                        REGION, year, source.sourceName(), now, now, safeCode);
            } else {
                db.update("UPDATE holiday_calendar_years SET last_attempt_at=?,last_failure_at=?,last_failure_code=? WHERE region=? AND year=?",
                        now, now, safeCode, REGION, year);
            }
        });
    }

    private void audit(Actor actor, HolidayPayload.Year parsed) {
        Map<String, Object> details = new LinkedHashMap<>();
        details.put("year", parsed.year());
        details.put("source", source.sourceName());
        details.put("sourceHash", parsed.sourceHash());
        details.put("officialNotice", parsed.officialNotice());
        details.put("days", parsed.days().size());
        db.update("INSERT INTO audit_logs(id,organization_id,actor_id,object_id,action,details_json) VALUES(?,?,?,?,?,?)",
                id(), actor.organizationId(), actor.id(), null, "holiday.calendar.refreshed", db.json(details));
    }

    private static ApiException refreshFailure(String safeCode) {
        return new ApiException(502, "HOLIDAY_REFRESH_FAILED",
                "节假日数据刷新失败，已保留现有缓存", Map.of("reason", safeCode));
    }

    private static void validateYear(int year) {
        if (year < 1900 || year > 9999) {
            throw new ApiException(400, "INVALID_YEAR", "年份须为 1900–9999 的四位公历年");
        }
    }

    private static Instant instant(Object value) {
        if (value == null) return null;
        if (value instanceof Instant instant) return instant;
        if (value instanceof Timestamp timestamp) return timestamp.toInstant();
        if (value instanceof java.time.LocalDateTime local) return local.toInstant(ZoneOffset.UTC);
        try {
            return Instant.parse(value.toString());
        } catch (RuntimeException exception) {
            return null;
        }
    }

    @PreDestroy
    void shutdown() {
        executor.shutdownNow();
    }
}
