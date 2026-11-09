package cn.pandora.workspace;

import cn.pandora.common.ApiException;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RestController;

import java.io.IOException;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Clock;
import java.time.DateTimeException;
import java.time.Duration;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.List;
import java.util.TreeMap;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.atomic.AtomicBoolean;

@RestController
public class HolidayController {
    public record Day(String date, String name, boolean work) {}
    public record HolidayYear(int year, String status, boolean stale, List<Day> days) {}
    private record CachedYear(HolidayYear data, Instant refreshAt) {}

    private static final ZoneId CHINA = ZoneId.of("Asia/Shanghai");
    private static final Duration TIMEOUT = Duration.ofSeconds(4);
    private static final Duration SUCCESS_TTL = Duration.ofHours(1);
    private static final Duration MISSING_TTL = Duration.ofHours(1);
    private static final Duration ERROR_TTL = Duration.ofMinutes(2);

    private final HttpClient client = HttpClient.newBuilder().connectTimeout(TIMEOUT).build();
    private final ConcurrentHashMap<Integer,CachedYear> years = new ConcurrentHashMap<>();
    private final AtomicBoolean syncing = new AtomicBoolean();
    private final ObjectMapper mapper;
    private final Clock clock;
    private final URI source;

    public HolidayController(ObjectMapper mapper, Clock clock,
            @Value("${pandora.holidays.source}") String source) {
        this.mapper = mapper;
        this.clock = clock;
        this.source = URI.create(source.endsWith("/") ? source : source + "/");
    }

    @Scheduled(fixedDelayString="${pandora.holidays.sync-delay-ms:300000}",
            initialDelayString="${pandora.holidays.initial-delay-ms:0}")
    void syncPublishedYears() {
        if (!syncing.compareAndSet(false,true)) return;
        // Keep upstream network waits off the scheduler shared with notifications.
        Thread.startVirtualThread(() -> {
            try {
                int year = clock.instant().atZone(CHINA).getYear();
                cachedYear(year);
                cachedYear(year + 1);
            } finally {
                syncing.set(false);
            }
        });
    }

    @GetMapping("/api/v1/holidays/{year}")
    public HolidayYear year(@PathVariable int year) {
        if (year < 1900 || year > 9999) {
            throw new ApiException(400,"INVALID_HOLIDAY_YEAR","请输入有效的四位年份。");
        }
        var published = cachedYear(year);

        // A following year's notice can include the last days of this December.
        String prefix = year + "-";
        var days = new TreeMap<String,Day>();
        boolean stale = published.stale();
        for (var day : published.days()) {
            if (day.date().startsWith(prefix)) days.put(day.date(),day);
        }
        if (year < 9999) {
            var following = cachedYear(year + 1);
            for (var day : following.days()) {
                if (day.date().startsWith(prefix)) {
                    days.put(day.date(),day);
                    stale |= following.stale();
                }
            }
        }
        return new HolidayYear(year,days.isEmpty() ? published.status() : "available",stale,List.copyOf(days.values()));
    }

    private HolidayYear cachedYear(int year) {
        // Requests and the background sync share a single refresh per announcement year.
        return years.compute(year, (key, previous) -> {
            if (previous != null && clock.instant().isBefore(previous.refreshAt())) return previous;
            HolidayYear data = readYear(year);
            Duration ttl = switch (data.status()) {
                case "available" -> SUCCESS_TTL;
                case "unpublished" -> MISSING_TTL;
                default -> ERROR_TTL;
            };
            if (!"available".equals(data.status()) && previous != null && !previous.data().days().isEmpty()) {
                data = new HolidayYear(year,"available",true,previous.data().days());
                ttl = ERROR_TTL;
            }
            return new CachedYear(data,clock.instant().plus(ttl));
        }).data();
    }

    private HolidayYear readYear(int year) {
        var request = HttpRequest.newBuilder(source.resolve(year + ".json")).timeout(TIMEOUT)
                .header("Accept","application/json").GET().build();
        try {
            var response = client.send(request,HttpResponse.BodyHandlers.ofString());
            if (response.statusCode() == 404) return emptyYear(year,"unpublished");
            if (response.statusCode() != 200) return emptyYear(year,"unavailable");
            var body = mapper.readTree(response.body());
            if (body == null || !body.isObject()) return emptyYear(year,"unavailable");
            var rows = body.path("days");
            if (!body.path("year").isIntegralNumber() || body.path("year").asInt() != year || !rows.isArray() || rows.size() > 366) {
                return emptyYear(year,"unavailable");
            }
            var days = new TreeMap<String,Day>();
            for (var row : rows) {
                String date = row.path("date").asText();
                String name = row.path("name").asText().strip();
                var offDay = row.path("isOffDay");
                var dayDate = LocalDate.parse(date);
                boolean inNoticeYear = dayDate.getYear() == year || (dayDate.getYear() == year - 1 && dayDate.getMonthValue() == 12);
                if (!inNoticeYear || !dayDate.toString().equals(date) || name.isEmpty() || name.length() > 40 || !row.path("name").isTextual() || !offDay.isBoolean()) {
                    return emptyYear(year,"unavailable");
                }
                var day = new Day(date,name,!offDay.asBoolean());
                var previous = days.putIfAbsent(date,day);
                if (previous != null && !previous.equals(day)) return emptyYear(year,"unavailable");
            }
            if (days.isEmpty()) return emptyYear(year,"unpublished");
            return new HolidayYear(year,"available",false,List.copyOf(days.values()));
        } catch (InterruptedException error) {
            Thread.currentThread().interrupt();
        } catch (IOException | DateTimeException error) {
            return emptyYear(year,"unavailable");
        }
        return emptyYear(year,"unavailable");
    }

    private HolidayYear emptyYear(int year, String status) {
        return new HolidayYear(year,status,false,List.of());
    }
}
