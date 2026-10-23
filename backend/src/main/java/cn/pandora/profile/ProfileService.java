package cn.pandora.profile;

import cn.pandora.auth.Actor;
import cn.pandora.common.ApiException;
import cn.pandora.common.Db;
import cn.pandora.common.Events;
import cn.pandora.common.Writes;
import org.springframework.stereotype.Service;

import java.util.*;
import java.util.regex.Pattern;
import java.io.ByteArrayInputStream;
import javax.imageio.ImageIO;

import static cn.pandora.common.Db.*;

@Service
public class ProfileService {
    private static final Set<String> EDITABLE = Set.of("displayName", "phone", "email", "avatar");
    private static final Set<String> AVATARS = Set.of("rabbit", "cat", "bear", "panda");
    private static final Pattern EMAIL = Pattern.compile("^[A-Za-z0-9.!#$%&'*+/=?^_`{|}~-]+@[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?(?:\\.[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?)+$");
    private final Db db;
    private final Events events;

    public ProfileService(Db db, Events events) { this.db = db; this.events = events; }

    public Map<String, Object> get(Actor actor) {
        Map<String, Object> row = db.one("SELECT u.id,u.username,u.display_name,u.phone,u.email,u.avatar,u.profile_version,u.role,"
                + "u.team_id,u.manager_id,o.name AS organization_name,d.name AS department_name,"
                + "p.name AS position_name,t.name AS team_name,m.display_name AS manager_name "
                + "FROM users u LEFT JOIN organizations o ON o.id=u.organization_id "
                + "LEFT JOIN departments d ON d.organization_id=u.organization_id AND d.id=u.department_id "
                + "LEFT JOIN positions p ON p.organization_id=u.organization_id AND p.id=u.position_id "
                + "LEFT JOIN teams t ON t.organization_id=u.organization_id AND t.id=u.team_id "
                + "LEFT JOIN users m ON m.organization_id=u.organization_id AND m.id=u.manager_id "
                + "WHERE u.organization_id=? AND u.id=? AND u.active=1", actor.organizationId(), actor.id());
        row.put("rowVersion", n(row, "profileVersion"));
        return row;
    }

    /** Called exclusively inside Writes.run; client IDs and organization fields are never accepted. */
    public Map<String, Object> update(Actor actor, String ifMatch, Map<String, Object> input) {
        Map<String, Object> values = validate(input);
        Map<String, Object> current = db.one("SELECT display_name,phone,email,avatar,profile_version FROM users WHERE organization_id=? AND id=? AND active=1 FOR UPDATE", actor.organizationId(), actor.id());
        long version = n(current, "profileVersion");
        Writes.checkVersion(ifMatch, version);
        String name = values.containsKey("displayName") ? (String) values.get("displayName") : s(current, "displayName");
        String phone = values.containsKey("phone") ? (String) values.get("phone") : s(current, "phone");
        String email = values.containsKey("email") ? (String) values.get("email") : s(current, "email");
        String avatar = values.containsKey("avatar") ? (String) values.get("avatar") : s(current, "avatar");
        int changed = db.update("UPDATE users SET display_name=?,phone=?,email=?,avatar=?,profile_version=profile_version+1 WHERE organization_id=? AND id=? AND active=1 AND profile_version=?", name, phone, email, avatar, actor.organizationId(), actor.id(), version);
        if (changed != 1) throw new ApiException(412, "VERSION_CONFLICT", "个人资料已更新，请重新读取后再保存");
        // Audit only which fields changed. Contact values are not copied into audit/outbox/idempotency payloads.
        events.record(actor, null, "profile.updated", List.of(), Map.of("userId", actor.id(), "fields", values.keySet()));
        return Map.of("id", actor.id(), "rowVersion", version + 1, "profileVersion", version + 1);
    }

    static Map<String, Object> validate(Map<String, Object> input) {
        if (input == null || input.isEmpty() || !EDITABLE.containsAll(input.keySet())) throw bad("仅可修改姓名、联系电话、邮箱和头像，请至少填写一项");
        Map<String, Object> result = new LinkedHashMap<>();
        if (input.containsKey("displayName")) {
            String name = text(input.get("displayName"), "姓名", 100, false);
            result.put("displayName", name);
        }
        if (input.containsKey("phone")) {
            String phone = text(input.get("phone"), "联系电话", 32, true);
            if (phone != null) {
                long digits = phone.chars().filter(Character::isDigit).count();
                if (!phone.matches("[+0-9() .-]+") || digits < 3 || digits > 20 || phone.indexOf('+') > 0 || phone.lastIndexOf('+') != phone.indexOf('+'))
                    throw bad("联系电话须含3至20位数字，可使用开头的+、空格、括号或短横线");
            }
            result.put("phone", phone);
        }
        if (input.containsKey("email")) {
            String email = text(input.get("email"), "邮箱", 254, true);
            if (email != null) {
                int at = email.indexOf('@');
                String local = at < 0 ? "" : email.substring(0, at);
                if (!EMAIL.matcher(email).matches() || local.length() > 64 || local.startsWith(".") || local.endsWith(".") || local.contains("..")) throw bad("请输入有效的邮箱地址");
            }
            result.put("email", email);
        }
        if (input.containsKey("avatar")) result.put("avatar", avatar(input.get("avatar")));
        return result;
    }

    private static String avatar(Object value) {
        if (value == null || "".equals(value)) return null;
        if (!(value instanceof String string)) throw bad("请选择有效的头像");
        if (AVATARS.contains(string)) return string;
        if (string.length() > 400_000 || !(string.startsWith("data:image/png;base64,") || string.startsWith("data:image/jpeg;base64,")))
            throw bad("头像须为 PNG 或 JPEG 图片，大小不超过300KB");
        try {
            byte[] bytes = Base64.getDecoder().decode(string.substring(string.indexOf(',') + 1));
            if (bytes.length > 300_000) throw bad("头像图片过大");
            try (var stream = ImageIO.createImageInputStream(new ByteArrayInputStream(bytes))) {
                var readers = ImageIO.getImageReaders(stream);
                if (!readers.hasNext()) throw bad("无法读取头像图片");
                var reader = readers.next();
                try {
                    reader.setInput(stream);
                    String format = reader.getFormatName().toLowerCase(Locale.ROOT);
                    if (!Set.of("png", "jpeg").contains(format) || !string.startsWith("data:image/" + format + ";base64,")
                        || reader.getWidth(0) < 1 || reader.getHeight(0) < 1 || reader.getWidth(0) > 512 || reader.getHeight(0) > 512
                        || reader.read(0) == null) throw bad("头像图片须不超过512×512像素");
                } finally { reader.dispose(); }
            }
            return string;
        } catch (ApiException error) { throw error; }
        catch (Exception error) { throw bad("无法读取头像图片，请重新选择 PNG 或 JPEG 图片"); }
    }

    private static String text(Object value, String label, int max, boolean optional) {
        if (value == null && optional) return null;
        if (!(value instanceof String string)) throw bad(label + "必须为文字");
        String text = string.strip();
        if (text.isEmpty()) {
            if (optional) return null;
            throw bad("姓名不能为空");
        }
        if (text.codePointCount(0, text.length()) > max || text.codePoints().anyMatch(Character::isISOControl)) throw bad(label + "格式不正确或超过" + max + "字");
        return text;
    }

    private static ApiException bad(String message) { return new ApiException(400, "INVALID_INPUT", message); }
}
