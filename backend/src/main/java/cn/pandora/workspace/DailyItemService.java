package cn.pandora.workspace;

import cn.pandora.auth.Access;
import cn.pandora.auth.Actor;
import cn.pandora.common.ApiException;
import cn.pandora.common.Db;
import cn.pandora.common.Events;
import cn.pandora.common.Writes;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Isolation;
import org.springframework.transaction.annotation.Transactional;

import java.sql.Date;
import java.time.Clock;
import java.time.LocalDate;
import java.time.format.DateTimeParseException;
import java.time.temporal.ChronoUnit;
import java.util.*;

import static cn.pandora.common.Db.*;

/**
 * Private daily items: one Gregorian date, one plain-text body and an explicit completed flag, owned by
 * one employee. No task, log, tag, assignee or approval is reachable from here, and every read and write
 * is filtered by organization and owner so上级、管理员及跨公司用户 cannot observe another person's items.
 */
@Service
public class DailyItemService {
    /** A single summary request stays inside one closed range of at most 93 days (a quarter). */
    public static final int MAX_SUMMARY_DAYS = 93;
    public static final int MAX_BODY = 2000;
    private static final int MAX_LIST_PAGE = 100;
    private static final Set<String> BUSINESS_ROLES = Set.of("founder", "department_head", "team_head", "employee");
    private final Db db;
    private final Access access;
    private final Events events;
    private final Clock clock;

    public DailyItemService(Db db, Access access, Events events, Clock clock) {
        this.db = db;
        this.access = access;
        this.events = events;
        this.clock = clock;
    }

    /* ---------------------------------------------------------------- reads */

    @Transactional(readOnly = true, isolation = Isolation.REPEATABLE_READ)
    public Map<String, Object> summary(Actor a, Map<String, String> filters) {
        business(a);
        if (!Set.of("from", "to").containsAll(filters.keySet()))
            throw bad("汇总接口当前仅支持 from、to");
        LocalDate from = date(filters.get("from"), "from");
        LocalDate to = date(filters.get("to"), "to");
        long days = ChronoUnit.DAYS.between(from, to) + 1;
        if (days < 1) throw bad("from 不能晚于 to");
        if (days > MAX_SUMMARY_DAYS) throw bad("汇总范围最多 " + MAX_SUMMARY_DAYS + " 天");
        var rows = db.list("SELECT item_date,SUM(completed=0) AS open_count,SUM(completed=1) AS completed_count "
                + "FROM daily_items WHERE organization_id=? AND owner_id=? AND item_date BETWEEN ? AND ? "
                + "GROUP BY item_date ORDER BY item_date",
                a.organizationId(), a.id(), Date.valueOf(from), Date.valueOf(to));
        List<Map<String, Object>> result = new ArrayList<>();
        for (var row : rows) {
            var day = new LinkedHashMap<String, Object>();
            day.put("date", s(row, "itemDate"));
            day.put("openCount", n(row, "openCount"));
            day.put("completedCount", n(row, "completedCount"));
            result.add(day);
        }
        // Days absent from the list are confirmed zero counts for that closed range; a failed request
        // never returns an empty 200 list, so callers cannot mistake a failure for "nothing to do".
        var response = new LinkedHashMap<String, Object>();
        response.put("from", from.toString());
        response.put("to", to.toString());
        response.put("maxDays", MAX_SUMMARY_DAYS);
        response.put("days", result);
        return response;
    }

    @Transactional(readOnly = true, isolation = Isolation.REPEATABLE_READ)
    public Map<String, Object> list(Actor a, Map<String, String> filters) {
        business(a);
        LocalDate day = date(filters.get("date"), "date");
        if (!Set.of("date", "limit", "offset").containsAll(filters.keySet()))
            throw bad("清单接口当前仅支持 date、limit、offset");
        int limit = number(filters, "limit", 50, 1, MAX_LIST_PAGE);
        int offset = number(filters, "offset", 0, 0, Integer.MAX_VALUE);
        long total = n(db.one("SELECT COUNT(*) AS c FROM daily_items WHERE organization_id=? AND owner_id=? AND item_date=?",
                a.organizationId(), a.id(), Date.valueOf(day)), "c");
        var rows = db.list("SELECT id,item_date,body,completed,row_version,created_at,updated_at FROM daily_items "
                + "WHERE organization_id=? AND owner_id=? AND item_date=? "
                + "ORDER BY created_at,id LIMIT ? OFFSET ?",
                a.organizationId(), a.id(), Date.valueOf(day), limit, offset);
        List<Map<String, Object>> items = rows.stream().map(this::view).toList();
        var response = new LinkedHashMap<String, Object>();
        response.put("date", day.toString());
        response.put("items", items);
        response.put("total", total);
        response.put("limit", limit);
        response.put("offset", offset);
        response.put("nextOffset", (long) offset + items.size() < total ? offset + items.size() : null);
        return response;
    }

    @Transactional(readOnly = true, isolation = Isolation.REPEATABLE_READ)
    public Map<String, Object> detail(Actor a, String itemId) {
        business(a);
        return view(read(a, itemId, false));
    }

    /* --------------------------------------------------------------- writes */

    public Map<String, Object> create(Actor a, Map<String, Object> body) {
        business(a);
        allowed(body, Set.of("date", "body"));
        LocalDate day = date(body.get("date"), "date");
        String content = required(body, "body", MAX_BODY);
        String itemId = id();
        db.update("INSERT INTO daily_items(id,organization_id,owner_id,item_date,body,completed,row_version) VALUES(?,?,?,?,?,FALSE,1)",
                itemId, a.organizationId(), a.id(), Date.valueOf(day), content);
        events.recordObject(a, null, "daily_item.created", List.of(),
                Map.of("dailyItemId", itemId, "date", day.toString()), null, null, null, null, "daily_item", itemId);
        return Map.of("id", itemId, "date", day.toString(), "rowVersion", 1);
    }

    public Map<String, Object> change(Actor a, String itemId, String ifMatch, Map<String, Object> body) {
        business(a);
        allowed(body, Set.of("date", "body", "completed"));
        var item = read(a, itemId, true);
        Writes.checkVersion(ifMatch, n(item, "rowVersion"));
        LocalDate day = body.containsKey("date") ? date(body.get("date"), "date") : date(s(item, "itemDate"), "date");
        String content = body.containsKey("body") ? required(body, "body", MAX_BODY) : s(item, "body");
        boolean completed = body.containsKey("completed") ? bool(body.get("completed")) : flag(item.get("completed"));
        long next = n(item, "rowVersion") + 1;
        db.update("UPDATE daily_items SET item_date=?,body=?,completed=?,row_version=?,updated_at=CURRENT_TIMESTAMP(6) "
                + "WHERE organization_id=? AND owner_id=? AND id=?", Date.valueOf(day), content, completed, next,
                a.organizationId(), a.id(), itemId);
        events.recordObject(a, null, "daily_item.updated", List.of(),
                Map.of("dailyItemId", itemId, "date", day.toString()), null, null, null, null, "daily_item", itemId);
        return Map.of("id", itemId, "date", day.toString(), "completed", completed, "rowVersion", next);
    }

    public Map<String, Object> delete(Actor a, String itemId, String ifMatch) {
        business(a);
        var item = read(a, itemId, true);
        Writes.checkVersion(ifMatch, n(item, "rowVersion"));
        db.update("DELETE FROM daily_items WHERE organization_id=? AND owner_id=? AND id=?", a.organizationId(), a.id(), itemId);
        events.recordObject(a, null, "daily_item.deleted", List.of(),
                Map.of("dailyItemId", itemId, "date", s(item, "itemDate")), null, null, null, null, "daily_item", itemId);
        return Map.of("id", itemId, "deleted", true);
    }

    /* --------------------------------------------------------------- helpers */

    /** An employee principal whose session still matches the current company authority snapshot. */
    private void business(Actor a) {
        if (a.administrator()) throw new ApiException(403, "BUSINESS_ROLE_REQUIRED", "管理员请使用管理端接口");
        access.requireCurrent(a);
        if (!BUSINESS_ROLES.contains(a.role()))
            throw new ApiException(403, "BUSINESS_ROLE_REQUIRED", "仅本公司有效业务账号可维护每日事项");
    }

    private Map<String, Object> read(Actor a, String itemId, boolean lock) {
        if (itemId == null || itemId.isBlank()) throw ApiException.notFound();
        return db.one("SELECT id,item_date,body,completed,row_version,created_at,updated_at FROM daily_items "
                + "WHERE organization_id=? AND owner_id=? AND id=?" + (lock ? " FOR UPDATE" : ""),
                a.organizationId(), a.id(), itemId);
    }

    private Map<String, Object> view(Map<String, Object> row) {
        var out = new LinkedHashMap<String, Object>();
        out.put("id", s(row, "id"));
        out.put("date", s(row, "itemDate"));
        out.put("body", s(row, "body"));
        out.put("completed", flag(row.get("completed")));
        out.put("rowVersion", n(row, "rowVersion"));
        out.put("createdAt", s(row, "createdAt"));
        out.put("updatedAt", s(row, "updatedAt"));
        return out;
    }

    /** Strict ISO calendar date; never a UTC midnight timestamp that can drift with the device zone. */
    private static LocalDate date(Object value, String field) {
        if (!(value instanceof String text) || text.isBlank())
            throw bad(field + " 必须为 YYYY-MM-DD 有效日期");
        try {
            LocalDate parsed = LocalDate.parse(text.trim());
            if (!parsed.toString().equals(text.trim())) throw new DateTimeParseException("非规范日期", text, 0);
            return parsed;
        } catch (DateTimeParseException error) {
            throw bad(field + " 必须为 YYYY-MM-DD 有效日期");
        }
    }

    private static boolean bool(Object value) {
        if (!(value instanceof Boolean)) throw bad("completed 必须为布尔值");
        return (Boolean) value;
    }

    private static ApiException bad(String message) {
        return new ApiException(400, "INVALID_INPUT", message);
    }

    private static void allowed(Map<String, Object> body, Set<String> keys) {
        if (!keys.containsAll(body.keySet())) throw bad("请求含不支持的字段");
    }

    private static String required(Map<String, Object> body, String key, int max) {
        if (!(body.get(key) instanceof String)) throw bad(key + " 必须为文字");
        String value = s(body, key);
        value = value == null ? null : value.trim();
        if (value == null || value.isEmpty() || value.length() > max)
            throw bad(key + " 不能为空且不得超过 " + max + " 字");
        return value;
    }

    private static int number(Map<String, String> filters, String key, int fallback, int min, int max) {
        try {
            int value = Integer.parseInt(filters.getOrDefault(key, Integer.toString(fallback)));
            if (value < min || value > max) throw new NumberFormatException();
            return value;
        } catch (Exception error) {
            throw bad(key + " 超出允许范围");
        }
    }

    private static boolean flag(Object value) {
        if (value instanceof Boolean b) return b;
        if (value instanceof Number number) return number.intValue() != 0;
        if (value instanceof String text) return "1".equals(text) || "true".equalsIgnoreCase(text);
        return false;
    }
}
