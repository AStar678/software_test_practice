package cn.pandora.mobile;

import java.util.*;
import org.json.*;

final class Json {
  static JSONObject obj(Object... pairs) {
    JSONObject o = new JSONObject();
    try {
      for (int i = 0; i < pairs.length; i += 2)
        o.put((String) pairs[i], pairs[i + 1] == null ? JSONObject.NULL : pairs[i + 1]);
    } catch (JSONException e) {
      throw new IllegalArgumentException(e);
    }
    return o;
  }

  static String s(JSONObject o, String k) {
    return o == null || o.isNull(k) ? "" : o.optString(k, "");
  }

  static JSONArray arr(JSONObject o, String k) {
    JSONArray a = o == null ? null : o.optJSONArray(k);
    return a == null ? new JSONArray() : a;
  }

  static JSONObject child(JSONObject o, String k) {
    JSONObject c = o == null ? null : o.optJSONObject(k);
    return c == null ? new JSONObject() : c;
  }

  static List<JSONObject> rows(JSONArray a) {
    List<JSONObject> r = new ArrayList<>();
    for (int i = 0; i < a.length(); i++) {
      JSONObject o = a.optJSONObject(i);
      if (o != null) r.add(o);
    }
    return r;
  }

  static boolean contains(JSONArray a, String v) {
    for (int i = 0; i < a.length(); i++) if (v.equals(a.optString(i))) return true;
    return false;
  }

  static String id(JSONObject o) {
    String id = s(o, "id");
    return id.isEmpty() ? s(o, "taskId") : id;
  }

  static String tag(JSONObject o) {
    return o.has("__etag") ? s(o, "__etag") : "\"" + o.optLong("rowVersion") + "\"";
  }

  static String state(String s) {
    return switch (s) {
      case "todo" -> "待开始";
      case "doing" -> "进行中";
      case "done" -> "已完成";
      case "pending" -> "待审核";
      case "approved" -> "已通过";
      case "rejected" -> "已退回";
      case "withdrawn" -> "已撤销";
      case "expired" -> "已失效";
      case "direct" -> "已生效";
      default -> s;
    };
  }

  static String kind(String s) {
    return switch (s) {
      case "create" -> "创建任务";
      case "change" -> "修改任务";
      case "progress" -> "更新进展";
      case "complete" -> "提交完成";
      case "reopen" -> "重开任务";
      case "handover" -> "专用交接";
      default -> s;
    };
  }

  static String priority(JSONObject o) {
    return switch (s(o, "priority")) {
      case "urgent" -> "紧急";
      case "high" -> "高";
      case "low" -> "低";
      default -> "中";
    };
  }
}
