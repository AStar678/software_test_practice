package cn.pandora.mobile;

import static cn.pandora.mobile.Json.*;

import android.app.AlertDialog;
import android.widget.*;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.UUID;
import org.json.JSONObject;

/** Comments are writable on an authorized task or log, including from a member's work area. */
final class MemberCommentsUi {
  private final MainActivity a;
  private final Ui u;
  private final String reportId, path;
  private final Map<String, JSONObject> comments = new LinkedHashMap<>();
  private LinearLayout items;
  private String cursor = "";

  MemberCommentsUi(MainActivity a, String reportId, String path) {
    this.a = a;
    u = a.u;
    this.reportId = reportId;
    this.path = path;
  }

  void attach(LinearLayout parent) {
    u.heading(parent, "评论");
    items = u.column();
    parent.addView(items);
    u.button(parent, "写评论", false, () -> edit(null));
    load(true);
  }

  private void load(boolean reset) {
    final String query = reset ? "" : "&cursor=" + ApiClient.q(cursor);
    a.run(() -> {
      a.workspaceUi.requireReport(reportId);
      return a.api.get(path + "?limit=20" + query);
    }, result -> {
      if (!items.isAttachedToWindow()) return;
      if (reset) comments.clear();
      for (JSONObject comment : rows(arr(result, "items"))) comments.put(id(comment), comment);
      cursor = s(result, "nextCursor");
      render();
    }, message -> {
      if (!items.isAttachedToWindow()) return;
      items.removeAllViews();
      u.note(items, message);
      u.button(items, "重新读取评论", false, () -> load(true));
    });
  }

  private void render() {
    items.removeAllViews();
    if (comments.isEmpty()) u.note(items, "暂无评论");
    for (JSONObject comment : comments.values()) {
      boolean manage = comment.optBoolean("canManage");
      u.item(items, s(comment, "body"), s(comment, "authorName") + " · "
          + TasksUi.when(s(comment, "createdAt")) + (comment.optBoolean("edited") ? " · 已编辑" : ""),
          manage ? () -> edit(comment) : null);
    }
    if (!cursor.isEmpty()) u.button(items, "加载更多评论", false, () -> load(false));
  }

  private void edit(JSONObject comment) {
    MainActivity.Panel draft = a.panel(comment == null ? "写评论" : "编辑我的评论");
    EditText body = u.field(draft.body, "评论内容", s(comment, "body"), 10000, true);
    String slot = "member-comment:" + UUID.randomUUID();
    String target = comment == null ? path : "/comments/" + ApiClient.q(id(comment));
    String version = comment == null ? null : tag(comment);
    u.button(draft.actions, "保存评论", true, () -> {
      String content = Ui.value(body);
      if (content.isEmpty()) {
        draft.error.setText("请填写评论内容。");
        return;
      }
      save(draft, slot, comment == null ? "POST" : "PATCH", target, obj("body", content), version);
    });
    if (comment != null) u.button(draft.actions, "删除评论", false,
        () -> new AlertDialog.Builder(a).setTitle("删除这条评论？")
            .setNegativeButton("取消", null)
            .setPositiveButton("删除", (d, w) -> save(draft, slot, "DELETE", target, null, version)).show());
  }

  private void save(MainActivity.Panel draft, String slot, String method, String target,
                    JSONObject data, String version) {
    a.run(() -> {
      a.workspaceUi.requireReport(reportId);
      return a.api.mutate(slot, method, target, data, version);
    }, ignored -> {
      draft.dialog.dismiss();
      if (items.isAttachedToWindow()) load(true);
    });
  }
}
