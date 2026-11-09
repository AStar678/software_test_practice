package cn.pandora.calendar;

import cn.pandora.auth.Actor;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

/** Explicit administrator maintenance for one year; the source URL is never accepted from a client. */
@RestController
@RequestMapping("/api/v1/admin/calendar/holidays")
public class HolidayCalendarAdminController {
    private final HolidayCalendarService holidays;

    public HolidayCalendarAdminController(HolidayCalendarService holidays) {
        this.holidays = holidays;
    }

    @PostMapping("/{year}/refresh")
    public Map<String, Object> refresh(@RequestAttribute("actor") Actor actor, @PathVariable String year,
            @RequestHeader(value = "Idempotency-Key", required = false) String key) {
        return holidays.refreshNow(actor, HolidayCalendarService.parseYear(year), key);
    }
}
