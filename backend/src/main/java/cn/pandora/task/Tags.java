package cn.pandora.task;

import cn.pandora.auth.Access;
import cn.pandora.auth.Actor;
import cn.pandora.auth.CompanyTree;
import cn.pandora.common.ApiException;
import cn.pandora.common.Db;
import cn.pandora.common.Writes;
import org.springframework.stereotype.Service;

import java.sql.Timestamp;
import java.time.Clock;
import java.util.*;

import static cn.pandora.common.Db.*;

/**
 * The company tag catalogue shared by tasks and logs (chapters 8.1—8.3).
 *
 * Only the proven unique root of the employee tree maintains the catalogue; an administrator or any
 * other upper identity can only pick from it while editing an object they already own. A business
 * object holds at most one tag through a single nullable column, so a multi-tag submission is not
 * representable and is rejected before any write. Deleting a tag is logical: the row keeps the name and
 * colour that current references must keep displaying, the candidate list drops it, and new references
 * are refused while an existing reference can still be cleared or replaced.
 */
@Service
public class Tags {
    /** Fixed palette; the unmarked task pink is deliberately outside it. */
    public record PaletteColor(String color, String border, String label) {}
    public static final List<PaletteColor> PALETTE = List.of(
            new PaletteColor("#F6D5D2", "#C05B52", "珊瑚红"),
            new PaletteColor("#FBE3CB", "#C08547", "蜜杏"),
            new PaletteColor("#F8EFC8", "#B79B3A", "麦黄"),
            new PaletteColor("#DCEEE0", "#4E9067", "青瓷"),
            new PaletteColor("#D8EAF4", "#4C87A3", "湖蓝"),
            new PaletteColor("#E4DEF3", "#7A68AE", "雾紫"),
            new PaletteColor("#F2DFE9", "#AF6E92", "藕粉"),
            new PaletteColor("#E4E7EC", "#6B7686", "石灰"));

    private final Db db;
    private final Access access;
    private final CompanyTree companyTree;

    public Tags(Db db, Access access, CompanyTree companyTree) {
        this.db = db; this.access = access; this.companyTree = companyTree;
    }

    public static boolean paletteColor(String color) {
        return PALETTE.stream().anyMatch(entry -> entry.color().equalsIgnoreCase(String.valueOf(color)));
    }

    private static String borderOf(String color) {
        return PALETTE.stream().filter(entry -> entry.color().equalsIgnoreCase(String.valueOf(color)))
                .map(PaletteColor::border).findFirst().orElse("#8A8F98");
    }

    public List<Map<String, Object>> palette() {
        return PALETTE.stream().map(entry -> {
            Map<String, Object> item = new LinkedHashMap<>();
            item.put("color", entry.color());
            item.put("border", entry.border());
            item.put("label", entry.label());
            return item;
        }).toList();
    }

    /** Read side shared by tasks, logs and the "My" page; includes logically deleted tags by design. */
    public Map<String, Object> view(Actor a, String tagId) {
        if (tagId == null || tagId.isBlank()) return null;
        Map<String, Object> row = db.find("SELECT * FROM tags WHERE organization_id=? AND id=?", a.organizationId(), tagId);
        if (row == null) return null;
        return view(row);
    }

    public Map<String, Object> view(Map<String, Object> row) {
        if (row == null) return null;
        Map<String, Object> item = new LinkedHashMap<>();
        String color = s(row, "color");
        item.put("id", s(row, "id"));
        item.put("name", s(row, "name"));
        item.put("color", color);
        item.put("border", borderOf(color));
        item.put("deleted", row.get("deletedAt") != null);
        item.put("rowVersion", n(row, "rowVersion"));
        return item;
    }

    /**
     * Resolve the tag a write wants to store. A null request clears the tag. Keeping the tag a version
     * already holds is always allowed (a deleted tag stays attached), while attaching a deleted tag or
     * another company's tag is refused.
     */
    public Map<String, Object> resolveForWrite(Actor a, String tagId, String currentTagId) {
        String wanted = tagId == null || tagId.isBlank() ? null : tagId.trim();
        if (wanted == null) return null;
        Map<String, Object> row = db.find("SELECT * FROM tags WHERE organization_id=? AND id=?", a.organizationId(), wanted);
        if (row == null) throw new ApiException(400, "INVALID_TAG", "标签不存在或不属于本公司");
        if (row.get("deletedAt") != null && !wanted.equals(currentTagId)) {
            throw conflict("TAG_DELETED", "该标签已删除，不能再用于新的关联");
        }
        return row;
    }

    public Map<String, Object> list(Actor a, Map<String, String> filters) {
        business(a);
        String query = filters.getOrDefault("q", "").strip().toLowerCase(Locale.ROOT);
        boolean includeDeleted = "true".equals(filters.get("includeDeleted"));
        var items = db.list("SELECT * FROM tags WHERE organization_id=? ORDER BY deleted_at IS NOT NULL,name,id", a.organizationId())
                .stream()
                .filter(row -> includeDeleted || row.get("deletedAt") == null)
                .filter(row -> query.isEmpty() || s(row, "name").toLowerCase(Locale.ROOT).contains(query))
                .map(this::view).toList();
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("items", items);
        result.put("palette", palette());
        result.put("canManage", companyTree.isFounder(a));
        result.put("defaultColor", "#FFE1EA");
        result.put("empty", items.isEmpty());
        return result;
    }

    public Map<String, Object> create(Actor a, Map<String, Object> body) {
        requireFounder(a);
        Map<String, Object> input = copy(body);
        String name = name(input);
        String color = color(input);
        requireNameFree(a, name, null);
        String tagId = id();
        db.update("INSERT INTO tags(id,organization_id,name,color) VALUES(?,?,?,?)", tagId, a.organizationId(), name, color);
        return Map.of("tagId", tagId, "rowVersion", 1, "tag", view(a, tagId));
    }

    public Map<String, Object> change(Actor a, String tagId, String ifMatch, Map<String, Object> body) {
        requireFounder(a);
        Map<String, Object> input = copy(body);
        if (input.isEmpty()) throw bad("请提供要修改的标签字段");
        if (!input.keySet().stream().allMatch(key -> Set.of("name", "color").contains(key))) throw bad("请求含不支持的字段");
        Map<String, Object> row = db.one("SELECT * FROM tags WHERE organization_id=? AND id=? FOR UPDATE", a.organizationId(), tagId);
        if (row.get("deletedAt") != null) throw conflict("TAG_DELETED", "该标签已删除，不能再修改");
        long version = n(row, "rowVersion");
        Writes.checkVersion(ifMatch, version);
        String name = input.containsKey("name") ? name(input) : s(row, "name");
        String color = input.containsKey("color") ? color(input) : s(row, "color");
        requireNameFree(a, name, tagId);
        db.update("UPDATE tags SET name=?,color=?,row_version=row_version+1,updated_at=UTC_TIMESTAMP(6) WHERE organization_id=? AND id=?",
                name, color, a.organizationId(), tagId);
        // Current references resolve the catalogue, so a rename or recolour is visible immediately; the
        // immutable snapshot columns on task versions are deliberately not rewritten (chapter 8.3).
        return Map.of("tagId", tagId, "rowVersion", version + 1, "tag", view(a, tagId));
    }

    public Map<String, Object> delete(Actor a, String tagId, String ifMatch) {
        requireFounder(a);
        Map<String, Object> row = db.one("SELECT * FROM tags WHERE organization_id=? AND id=? FOR UPDATE", a.organizationId(), tagId);
        long version = n(row, "rowVersion");
        Writes.checkVersion(ifMatch, version);
        if (row.get("deletedAt") == null) {
            db.update("UPDATE tags SET deleted_at=UTC_TIMESTAMP(6),row_version=row_version+1,updated_at=UTC_TIMESTAMP(6) WHERE organization_id=? AND id=?",
                    a.organizationId(), tagId);
            version += 1;
        }
        return Map.of("tagId", tagId, "deleted", true, "rowVersion", version, "tag", view(a, tagId));
    }

    public void requireFounder(Actor a) {
        business(a);
        if (!companyTree.isFounder(a)) {
            throw new ApiException(403, "TAG_MAINTENANCE_FORBIDDEN", "只有公司员工组织树唯一根节点（创始人）可以维护标签");
        }
    }

    private void requireNameFree(Actor a, String name, String selfId) {
        Map<String, Object> existing = db.find("SELECT id FROM tags WHERE organization_id=? AND name=?", a.organizationId(), name);
        if (existing != null && !s(existing, "id").equals(selfId)) {
            throw conflict("TAG_NAME_TAKEN", "已有同名标签，请换一个名称");
        }
    }

    private static Map<String, Object> copy(Map<String, Object> body) {
        return body == null ? new LinkedHashMap<>() : new LinkedHashMap<>(body);
    }

    private static String name(Map<String, Object> body) {
        Object value = body.get("name");
        if (!(value instanceof String text)) throw bad("name 必须为文字");
        String name = text.strip();
        if (name.isEmpty() || name.length() > 40) throw bad("标签名称须为1至40字");
        return name;
    }

    private static String color(Map<String, Object> body) {
        Object value = body.get("color");
        if (!(value instanceof String text) || !paletteColor(text)) throw bad("请选择预定义色板中的颜色");
        return PALETTE.stream().filter(entry -> entry.color().equalsIgnoreCase(text))
                .map(PaletteColor::color).findFirst().orElseThrow();
    }

    static ApiException bad(String message) { return new ApiException(400, "INVALID_INPUT", message); }

    static ApiException conflict(String code, String message) { return new ApiException(409, code, message); }

    static void business(Actor a) {
        if ("admin".equals(a.role())) throw new ApiException(403, "BUSINESS_ROLE_REQUIRED", "管理员请使用管理端接口");
    }
}
