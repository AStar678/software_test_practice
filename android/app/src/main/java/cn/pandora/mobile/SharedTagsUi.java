package cn.pandora.mobile;

import static cn.pandora.mobile.Json.*;

import android.content.res.ColorStateList;
import android.graphics.Color;
import android.widget.*;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.Map;
import java.util.Set;
import org.json.JSONArray;
import org.json.JSONObject;

/** Company tag choices shared by the task and log editors. */
final class SharedTagsUi {
  private final MainActivity a;
  private final Ui u;
  private final JSONObject record;
  private final Set<String> selected = new LinkedHashSet<>();
  private final LinearLayout chips;
  private boolean touched;

  SharedTagsUi(MainActivity a, LinearLayout parent, JSONObject record) {
    this.a = a;
    u = a.u;
    this.record = record;
    JSONArray ids = arr(record, "tagIds");
    for (int i = 0; i < ids.length(); i++) if (!ids.optString(i).isEmpty()) selected.add(ids.optString(i));
    u.note(parent, "共用标签（可多选）");
    HorizontalScrollView strip = new HorizontalScrollView(a);
    strip.setContentDescription("共用标签");
    strip.setHorizontalScrollBarEnabled(false);
    chips = u.row();
    strip.addView(chips, new FrameLayout.LayoutParams(-2, -2));
    parent.addView(strip);
    u.note(chips, "正在读取标签…");
  }

  void load() {
    a.run(() -> a.api.get("/tags"), tags -> {
      if (chips.isAttachedToWindow()) render(arr(tags, "items"));
    }, error -> {
      if (!chips.isAttachedToWindow()) return;
      render(new JSONArray());
      u.button(chips, "重试读取标签", false, this::load)
          .setLayoutParams(new LinearLayout.LayoutParams(-2, -2));
    });
  }

  boolean touched() { return touched; }
  JSONArray ids() { return new JSONArray(selected); }

  private void render(JSONArray tags) {
    Map<String, JSONObject> choices = new LinkedHashMap<>();
    for (JSONObject item : rows(tags)) choices.put(id(item), item);
    for (JSONObject item : rows(arr(record, "tags")))
      if (selected.contains(id(item))) choices.putIfAbsent(id(item), item);
    chips.removeAllViews();
    for (JSONObject item : choices.values()) {
      String id = id(item);
      boolean deleted = item.optBoolean("deleted");
      if (deleted && !selected.contains(id)) continue;
      CheckBox chip = new CheckBox(a);
      chip.setText(s(item, "name") + (deleted ? "（已删除）" : ""));
      chip.setTextColor(Ui.INK);
      chip.setTextSize(14);
      chip.setMinHeight(u.dp(44));
      chip.setPadding(u.dp(4), 0, u.dp(10), 0);
      chip.setChecked(selected.contains(id));
      int accent = Ui.PRIMARY;
      try { accent = Color.parseColor(s(item, "border")); } catch (IllegalArgumentException ignored) {}
      chip.setButtonTintList(ColorStateList.valueOf(accent));
      var fill = u.shape(Ui.SURFACE, 10);
      try { fill.setColor(Color.parseColor(s(item, "color"))); } catch (IllegalArgumentException ignored) {}
      chip.setBackground(fill);
      chip.setOnCheckedChangeListener((view, checked) -> {
        if (checked && deleted) { view.setChecked(false); return; }
        if (checked) selected.add(id);
        else selected.remove(id);
        touched = true;
      });
      LinearLayout.LayoutParams lp = new LinearLayout.LayoutParams(-2, -2);
      lp.setMarginEnd(u.dp(7));
      chips.addView(chip, lp);
    }
    if (chips.getChildCount() == 0) u.note(chips, "暂无共用标签");
  }
}
