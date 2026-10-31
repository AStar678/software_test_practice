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
 * The founder maintains shared tags; each employee separately owns their personal tags and marks.
 * Private names never enter shared task versions, logs, notifications or audit snapshots. A business
 * log holds at most one shared tag; task versions hold ordered shared tag collections. Deleting a tag is logical: the row keeps the name and
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
        if (row == null || s(row,"ownerId") != null && !a.id().equals(s(row,"ownerId"))) return null;
        return view(row);
    }

    public Map<String, Object> view(Map<String, Object> row) {
        if (row == null) return null;
        Map<String, Object> item = new LinkedHashMap<>();
        String color = s(row, "color");
        item.put("id", s(row, "id"));
        item.put("scope", s(row,"ownerId") == null ? "shared" : "personal");
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
        if (row == null || s(row,"ownerId") != null) throw new ApiException(400, "INVALID_TAG", "请选择公司共用标签；私人标签请在任务详情中单独设置");
        if (row.get("deletedAt") != null && !wanted.equals(currentTagId)) {
            throw conflict("TAG_DELETED", "该标签已删除，不能再用于新的关联");
        }
        return row;
    }

    public Map<String, Object> list(Actor a, Map<String, String> filters) {
        business(a);
        String query = filters.getOrDefault("q", "").strip().toLowerCase(Locale.ROOT);
        boolean includeDeleted = "true".equals(filters.get("includeDeleted"));
        var items = db.list("SELECT * FROM tags WHERE organization_id=? AND (owner_id IS NULL OR owner_id=?) ORDER BY owner_id IS NULL,deleted_at IS NOT NULL,name,id", a.organizationId(),a.id())
                .stream()
                .filter(row -> includeDeleted || row.get("deletedAt") == null)
                .filter(row -> query.isEmpty() || s(row, "name").toLowerCase(Locale.ROOT).contains(query))
                .map(row -> {var item=view(row);item.put("canEdit",companyTree.isFounder(a));return item;}).toList();
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("items", items);
        result.put("palette", palette());
        result.put("canManage", companyTree.isFounder(a));
        result.put("canCreatePersonal", true);
        result.put("defaultColor", "#FFE1EA");
        result.put("empty", items.isEmpty());
        return result;
    }

    public Map<String, Object> create(Actor a, Map<String, Object> body) {
        business(a);access.requireCurrent(a);requireFounder(a);
        Map<String, Object> input = copy(body);
        if (!input.keySet().stream().allMatch(key -> Set.of("name","color","scope").contains(key))) throw bad("请求含不支持的字段");
        Object scope=input.getOrDefault("scope","shared");
        if (!(scope instanceof String) || !Set.of("shared","personal").contains(scope)) throw bad("请选择共用或私人标签");
        String owner="personal".equals(scope)?a.id():null;
        if(owner==null) requireFounder(a);
        String name = name(input);
        String color = color(input);
        requireNameFree(a, name, null,owner);
        String tagId = id();
        db.update("INSERT INTO tags(id,organization_id,name,color,owner_id) VALUES(?,?,?,?,?)", tagId, a.organizationId(), name, color,owner);
        return Map.of("tagId", tagId, "rowVersion", 1, "tag", view(a, tagId));
    }

    public Map<String, Object> change(Actor a, String tagId, String ifMatch, Map<String, Object> body) {
        business(a);access.requireCurrent(a);requireFounder(a);
        Map<String, Object> input = copy(body);
        if (input.isEmpty()) throw bad("请提供要修改的标签字段");
        if (!input.keySet().stream().allMatch(key -> Set.of("name", "color").contains(key))) throw bad("请求含不支持的字段");
        Map<String, Object> row = editable(a,tagId);
        if (row.get("deletedAt") != null) throw conflict("TAG_DELETED", "该标签已删除，不能再修改");
        long version = n(row, "rowVersion");
        Writes.checkVersion(ifMatch, version);
        String name = input.containsKey("name") ? name(input) : s(row, "name");
        String color = input.containsKey("color") ? color(input) : s(row, "color");
        requireNameFree(a, name, tagId,s(row,"ownerId"));
        db.update("UPDATE tags SET name=?,color=?,row_version=row_version+1,updated_at=UTC_TIMESTAMP(6) WHERE organization_id=? AND id=?",
                name, color, a.organizationId(), tagId);
        // Current references resolve the catalogue, so a rename or recolour is visible immediately; the
        // immutable snapshot columns on task versions are deliberately not rewritten (chapter 8.3).
        return Map.of("tagId", tagId, "rowVersion", version + 1, "tag", view(a, tagId));
    }

    public Map<String, Object> delete(Actor a, String tagId, String ifMatch) {
        business(a);access.requireCurrent(a);
        Map<String, Object> row = editable(a,tagId);
        long version = n(row, "rowVersion");
        Writes.checkVersion(ifMatch, version);
        if (row.get("deletedAt") == null) {
            if(s(row,"ownerId")!=null) db.update("DELETE FROM personal_task_tags WHERE organization_id=? AND user_id=? AND tag_id=?",a.organizationId(),a.id(),tagId);
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

    private Map<String,Object> editable(Actor a,String id) {
        requireFounder(a);
        var row=db.find("SELECT * FROM tags WHERE organization_id=? AND id=? AND (owner_id IS NULL OR owner_id=?) FOR UPDATE",a.organizationId(),id,a.id());
        if(row==null) throw ApiException.notFound();
        if(s(row,"ownerId")==null) requireFounder(a);
        return row;
    }

    public Map<String,Object> personalForWrite(Actor a,String id) {
        var row=db.find("SELECT * FROM tags WHERE organization_id=? AND owner_id=? AND id=?",a.organizationId(),a.id(),id);
        if(row==null) throw ApiException.notFound();
        if(row.get("deletedAt")!=null) throw conflict("TAG_DELETED","该私人标签已删除");
        return view(row);
    }

    public Map<String,Map<String,Object>> personalTaskTags(Actor a) {
        Map<String,Map<String,Object>> result=new HashMap<>();
        for(var row:db.list("SELECT t.*,p.task_id FROM personal_task_tags p JOIN tags t ON t.organization_id=p.organization_id AND t.owner_id=p.user_id AND t.id=p.tag_id WHERE p.organization_id=? AND p.user_id=? AND t.deleted_at IS NULL",a.organizationId(),a.id())) result.put(s(row,"taskId"),view(row));
        return result;
    }

    private void requireNameFree(Actor a, String name, String selfId,String ownerId) {
        Map<String, Object> existing = db.find("SELECT id FROM tags WHERE organization_id=? AND owner_id <=> ? AND name=?", a.organizationId(),ownerId, name);
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
