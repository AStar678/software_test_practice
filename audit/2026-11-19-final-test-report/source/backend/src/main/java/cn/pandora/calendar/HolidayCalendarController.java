package cn.pandora.calendar;

import cn.pandora.auth.Actor;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

/** Protected local holiday labels for the employee calendar; never a live external call. */
@RestController
@RequestMapping("/api/v1")
public class HolidayCalendarController {
    private final HolidayCalendarService holidays;

    public HolidayCalendarController(HolidayCalendarService holidays) {
        this.holidays = holidays;
    }

    @GetMapping("/calendar/holidays/{year}")
    public Map<String, Object> year(@RequestAttribute("actor") Actor actor, @PathVariable String year) {
        // Authentication is enforced by AuthFilter. Both active employees and the independent
        // administrator may read the shared official labels, but only this read route is opened to
        // administrators; all business routes remain employee-only.
        return holidays.view(HolidayCalendarService.parseYear(year), true);
    }
}
