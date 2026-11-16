package cn.pandora.mobile;

import static cn.pandora.mobile.Json.*;

import android.app.*;
import android.content.*;
import android.graphics.*;
import android.net.Uri;
import android.text.InputType;
import android.util.Base64;
import android.view.View;
import android.widget.*;
import java.io.*;
import java.time.*;
import java.util.*;
import org.json.*;

final class WorkspaceUi {
  private final MainActivity a;
  private final Ui u;
  private JSONObject analysis;
  private ProfileDraft profile;
  private LocalDate homeWeek;
  private int homeWeekEpoch = -1;

  WorkspaceUi(MainActivity a) {
    this.a = a;
    u = a.u;
  }

  void reset() {
    analysis = null;
    profile = null;
  }

  LocalDate businessDate() {
    String value = s(a.home, "businessDate");
    return value.isEmpty() ? LocalDate.now(CalendarUi.ZONE) : LocalDate.parse(value);
  }

  void dailyItems(LinearLayout calendar) {
    int epoch = a.api.epoch;
    LocalDate initial = homeWeekEpoch == epoch && homeWeek != null ? homeWeek : businessDate();
    HomeDailyCalendar view = new HomeDailyCalendar(a, businessDate(), date -> {
      homeWeekEpoch = epoch;
      homeWeek = date;
    }, this::openDailyDay);
    LinearLayout heading = u.row();
    calendar.addView(heading);
    heading.addView(u.text("每日事项", 18, Ui.INK), new LinearLayout.LayoutParams(0, -2, 1));
    LinearLayout add = u.column();
    heading.addView(add, new LinearLayout.LayoutParams(-2, -2));
    u.button(add, "＋", true, () -> {
      LocalDate start = view.visibleWeek();
      LocalDate today = businessDate();
      LocalDate date = !today.isBefore(start) && today.isBefore(start.plusWeeks(HomeDailyCalendar.VISIBLE_WEEKS))
          ? today : start;
      personal(null, date, view::invalidateCounts);
    }).setContentDescription("新增每日事项");
    view.attach(calendar, initial);
  }

  private void openDailyDay(LocalDate date, Runnable refreshCalendar) {
    a.run(() -> a.api.all("/daily-items?date=" + date), result -> {
      if (!"map".equals(a.page)) return;
      MainActivity.Panel list = a.panel(date + " 每日事项");
      boolean[] changed = {false};
      list.dialog.setOnDismissListener(dialog -> {
        a.panels.remove(list);
        if (changed[0]) refreshCalendar.run();
      });
      renderDailyDay(date, list, result, changed);
    });
  }

  private void renderDailyDay(LocalDate date, MainActivity.Panel list, JSONArray items, boolean[] changed) {
    list.body.removeAllViews();
    list.actions.removeAllViews();
    list.error.setText("");
    if (items.length() == 0) u.note(list.body, "这一天没有事项");
    Runnable refresh = () -> {
      changed[0] = true;
      a.run(() -> a.api.all("/daily-items?date=" + date), result -> {
        if (list.dialog.isShowing()) renderDailyDay(date, list, result, changed);
      });
    };
    for (JSONObject item : rows(items))
      u.item(list.body, s(item, "body"), dailyRange(item) + " · " + dailyStatus(item),
          () -> personalDetail(id(item), date, refresh));
    u.button(list.actions, "新增事项", true, () -> personal(null, date, refresh));
    u.button(list.actions, "刷新", false, refresh);
  }

  private String dailyRange(JSONObject item) {
    String start = s(item, "startDate"), end = s(item, "endDate");
    return start.equals(end) ? start : start + " 至 " + end;
  }

  private String dailyStatus(JSONObject item) {
    return switch (s(item, "status")) {
      case "completed" -> "已完成";
      case "overdue" -> "已逾期";
      default -> "待完成";
    };
  }

  private void pickDate(LocalDate initial, java.util.function.Consumer<LocalDate> onSelected) {
    u.dates.date("选择日期", initial, false, onSelected);
  }

  void personal(JSONObject item, LocalDate date, Runnable onSaved) {
    MainActivity.Panel p = a.panel(item == null ? "新增每日事项" : "编辑每日事项");
    LocalDate[] range = item == null ? new LocalDate[] {date, date} : new LocalDate[] {
        LocalDate.parse(s(item, "startDate")), LocalDate.parse(s(item, "endDate"))};
    for (int index = 0; index < range.length; index++) {
      int i = index;
      String label = i == 0 ? "开始日期" : "结束日期";
      u.heading(p.body, label);
      Button[] control = new Button[1];
      control[0] = u.button(p.body, range[i].toString(), false, () -> pickDate(range[i], selected -> {
        range[i] = selected;
        control[0].setText(selected.toString());
        control[0].setContentDescription(label + " " + selected);
      }));
      control[0].setContentDescription(label + " " + range[i]);
    }
    EditText text = u.field(p.body, "事项内容（最多2000字）", s(item, "body"), 2000, true);
    String slot = UUID.randomUUID().toString();
    u.button(p.actions, "保存", true, () -> {
      if (Ui.value(text).isEmpty() || range[1].isBefore(range[0])) {
        p.error.setText(Ui.value(text).isEmpty() ? "请填写事项内容。" : "结束日期不得早于开始日期。");
        return;
      }
      JSONObject data = obj("startDate", range[0].toString(), "endDate", range[1].toString(), "body", Ui.value(text));
      saveDaily(slot, item == null ? "POST" : "PATCH", item, data, () -> {
        p.dialog.dismiss();
        onSaved.run();
      });
    });
  }

  private void personalDetail(String id, LocalDate date, Runnable onSaved) {
    a.run(() -> a.api.get("/daily-items/" + ApiClient.q(id)), item -> {
      MainActivity.Panel p = a.panel("每日事项详情");
      u.note(p.body, dailyRange(item) + " · " + dailyStatus(item));
      p.body.addView(u.text(s(item, "body"), 16, Ui.INK));
      Runnable refresh = () -> { p.dialog.dismiss(); onSaved.run(); };
      u.button(p.actions, "编辑", true, () -> personal(item, date, refresh));
      boolean complete = item.optBoolean("completed");
      u.button(p.body, complete ? "取消完成" : "标为完成", false, () ->
          saveDaily("daily-complete:" + id, "PATCH", item, obj("completed", !complete), refresh));
      u.button(p.body, "删除事项", false, () -> confirm("删除这条每日事项？", () ->
          saveDaily("daily-delete:" + id, "DELETE", item, null, refresh)));
    });
  }

  private void saveDaily(String slot, String method, JSONObject item, JSONObject data, Runnable onSaved) {
    String path = "/daily-items" + (item == null ? "" : "/" + ApiClient.q(id(item)));
    a.run(() -> a.api.mutate(slot, method, path, data, item == null ? null : tag(item)), result -> {
      a.toast("事项已保存");
      onSaved.run();
    });
  }

  void confirm(String title, Runnable action) {
    new AlertDialog.Builder(a)
        .setTitle(title)
        .setMessage("操作提交后将同步到服务器。")
        .setNegativeButton("取消", null)
        .setPositiveButton("确认", (d, w) -> action.run())
        .show();
  }

  void logsPage() {
    LinearLayout box = a.page("日志");
    LinearLayout heading = u.row();
    TextView title = u.text("日志", 22, Ui.INK);
    title.setTypeface(null, android.graphics.Typeface.BOLD);
    heading.addView(title, new LinearLayout.LayoutParams(0, -2, 1));
    Button write = u.button(heading, "写日志", true, () -> editLog(null));
    write.setLayoutParams(new LinearLayout.LayoutParams(-2, u.dp(48)));
    box.addView(heading);

    LinearLayout list = u.card(box);
    LinearLayout label = u.row();
    TextView mine = u.text("我的日志", 18, Ui.INK);
    mine.setTypeface(null, android.graphics.Typeface.BOLD);
    label.addView(mine, new LinearLayout.LayoutParams(0, -2, 1));
    List<JSONObject> logs = new ArrayList<>();
    for (JSONObject log : rows(a.logs)) {
      if (a.uid().equals(s(log, "authorId"))) logs.add(log);
    }
    logs.sort(Comparator.comparing((JSONObject log) -> s(log, "createdAt")).reversed()
        .thenComparing(log -> s(log, "businessDate"), Comparator.reverseOrder()));
    label.addView(u.text("本人日志 · " + logs.size() + " 条", 13, Ui.MUTED));
    list.addView(label);
    if (logs.isEmpty()) u.note(list, "暂无个人日志");
    for (JSONObject log : logs) logCard(list, log);
  }

  private void logCard(LinearLayout list, JSONObject log) {
    LinearLayout card = u.card(list);
    LinearLayout meta = u.row();
    String date = s(log, "businessDate");
    String relative = "";
    try {
      long age = java.time.temporal.ChronoUnit.DAYS.between(LocalDate.parse(date), businessDate());
      relative = age == 0 ? " · 今天" : age == 1 ? " · 昨天" : age == 2 ? " · 前天" : "";
    } catch (java.time.format.DateTimeParseException ignored) {}
    TextView name = u.text(s(log, "authorName") + "\n" + date + relative, 13, Ui.MUTED);
    meta.addView(name, new LinearLayout.LayoutParams(0, -2, 1));
    if (log.optBoolean("editable")) {
      Button edit = u.button(meta, "编辑", false, () ->
          a.run(() -> a.api.get("/work-logs/" + ApiClient.q(id(log))), this::editLog));
      edit.setLayoutParams(new LinearLayout.LayoutParams(-2, u.dp(44)));
    } else meta.addView(u.text(log.optBoolean("frozen") ? "已冻结" : "只读", 12, Ui.MUTED));
    card.addView(meta);
    String labels = logTagLabels(log);
    if (!labels.isBlank()) u.note(card, labels);
    u.item(card, s(log, "body"), "", () -> logDetail(id(log)));
    String taskId = s(log, "taskId");
    if (taskId.isEmpty()) u.note(card, log.has("taskId") ? "未关联任务" : "关联任务当前不可见");
    else {
      Button linked = u.button(card, "关联任务：" + taskLabel(taskId, false), false, () -> a.tasksUi.detail(taskId));
      linked.setLayoutParams(new LinearLayout.LayoutParams(-2, -2));
    }
  }

  private String logTagLabels(JSONObject log) {
    return rows(arr(log, "tags")).stream().map(t -> s(t, "name")
        + (t.optBoolean("deleted") ? "（已删除）" : ""))
        .collect(java.util.stream.Collectors.joining(" · "));
  }

  void logDetail(String id) {
    logDetail(id, null);
  }

  private void logDetail(String id, String reportId) {
    a.run(
        () -> {
          if (reportId != null) requireReport(reportId);
          JSONObject log = a.api.get("/work-logs/" + ApiClient.q(id));
          if (reportId != null && !reportId.equals(s(log, "authorId")))
            throw new IOException("这条日志不属于当前人员。");
          return log;
        },
        log -> {
          MainActivity.Panel p = a.panel("日志详情");
          u.note(p.body, "作者　" + s(log, "authorName"));
          u.note(p.body, "日志日期　" + s(log, "businessDate"));
          u.note(p.body, "创建时间　" + TasksUi.when(s(log, "createdAt")));
          if (!s(log, "frozenAt").isEmpty())
            u.note(p.body, log.optBoolean("frozen") ? "已冻结" : "可编辑至 " + TasksUi.when(s(log, "frozenAt")));
          String labels = logTagLabels(log);
          if (!labels.isBlank()) u.note(p.body, labels);
          p.body.addView(u.text(s(log, "body"), 16, Ui.INK));
          if (!s(log, "taskId").isEmpty())
            u.button(p.body, "查看关联任务", false, () -> a.tasksUi.detail(s(log, "taskId"), reportId));
          if (reportId != null) {
            new MemberCommentsUi(a, reportId, "/work-logs/" + ApiClient.q(id) + "/comments")
                .attach(p.body);
            return;
          }
          if (log.optBoolean("editable")) {
            u.button(p.actions, "编辑", true, () -> editLog(log));
            u.button(
                p.body,
                "删除日志",
                false,
                () ->
                    confirm(
                        "删除这条日志？",
                        () ->
                            a.write(
                                "delete-log:" + id,
                                "DELETE",
                                "/work-logs/" + ApiClient.q(id),
                                null,
                                tag(log))));
          } else u.note(p.body, "历史日志只读，无法编辑。");
          new MemberCommentsUi(a, null, "/work-logs/" + ApiClient.q(id) + "/comments").attach(p.body);
        });
  }

  void editLog(JSONObject log) {
    if (log != null) {
      logForm(log, List.of(LocalDate.parse(s(log, "businessDate"))), businessDate());
      return;
    }
    a.run(() -> {
      LocalDate today = LocalDate.parse(s(a.api.get("/home"), "businessDate"));
      List<JSONObject> existing = rows(a.api.all("/work-logs?scope=self&from="
          + today.minusDays(2) + "&to=" + today));
      Set<String> occupied = new HashSet<>();
      for (JSONObject row : existing) occupied.add(s(row, "businessDate"));
      List<LocalDate> available = new ArrayList<>();
      for (int age = 0; age < 3; age++) {
        LocalDate date = today.minusDays(age);
        if (!occupied.contains(date.toString())) available.add(date);
      }
      return new LogDates(today, available);
    }, dates -> {
      if (dates.available().isEmpty())
        a.error("今天、昨天和前天都已有日志，请从日志详情进入编辑。");
      else logForm(null, dates.available(), dates.today());
    });
  }

  private record LogDates(LocalDate today, List<LocalDate> available) {}

  private void logForm(JSONObject log, List<LocalDate> dates, LocalDate today) {
    if (log != null && (!log.optBoolean("editable") || log.optBoolean("frozen"))) {
      a.error("这条日志只读。");
      return;
    }
    MainActivity.Panel p = a.panel(log == null ? "写日志" : "编辑日志", 1, 1,
        android.view.Gravity.BOTTOM, "✕");
    p.scroll.setFillViewport(true);
    String[] prefixes = {"今天", "昨天", "前天"};
    Spinner datePicker;
    if (log == null) {
      String[] labels = dates.stream().map(d -> {
        int age = (int) java.time.temporal.ChronoUnit.DAYS.between(d, today);
        return prefixes[Math.max(0, Math.min(2, age))] + " · " + d.getMonthValue() + "月" + d.getDayOfMonth() + "日";
      }).toArray(String[]::new);
      datePicker = u.spinner(p.body, "日志日期", labels, 0);
      datePicker.setBackgroundTintList(android.content.res.ColorStateList.valueOf(Ui.PRIMARY));
      datePicker.setPadding(u.dp(8), 0, u.dp(14), 0);
    } else {
      datePicker = null;
      u.note(p.body, "日志日期");
      TextView d = u.text(dates.get(0).toString(), 16, Ui.INK);
      d.setPadding(u.dp(12), u.dp(12), u.dp(12), u.dp(12));
      d.setBackground(u.shape(Ui.SURFACE, 12));
      p.body.addView(d);
    }
    SharedTagsUi tags = new SharedTagsUi(a, p.body, log);
    EditText body = u.field(p.body, "日志内容", s(log, "body"), 10000, true);
    body.setId(R.id.log_content);
    body.setMinHeight(u.dp(225));
    body.setMinLines(9);
    body.setMaxLines(16);
    var paper = u.shape(0xfffdf9fc, 12);
    paper.setStroke(u.dp(1), Ui.LINE);
    body.setBackground(paper);
    body.setVerticalScrollBarEnabled(true);
    Map<LocalDate, Set<String>> appended = new HashMap<>();
    java.util.function.Supplier<LocalDate> selectedDate = () -> dates.get(
        datePicker == null ? 0 : Math.max(0, datePicker.getSelectedItemPosition()));
    Button names = u.button(p.body, "追加当日名称", false, () -> {
      String[] options = {"追加当日事项名称", "追加当日任务名称"};
      new AlertDialog.Builder(a).setTitle("追加当日名称").setItems(options, (dialog, which) -> {
        LocalDate chosen = selectedDate.get();
        fillLog(p, body, chosen, which == 0 ? "dailyItems" : "tasks",
            appended.computeIfAbsent(chosen, ignored -> new HashSet<>()));
      }).setNegativeButton("取消", null).show();
    });
    p.body.removeView(names);
    LinearLayout editorLabel = u.row();
    int index = p.body.indexOfChild(body) - 1;
    android.view.View label = p.body.getChildAt(index);
    p.body.removeViewAt(index);
    editorLabel.addView(label, new LinearLayout.LayoutParams(0, -2, 1));
    editorLabel.addView(names, new LinearLayout.LayoutParams(-2, u.dp(42)));
    p.body.addView(editorLabel, index);
    if (datePicker != null) {
      TextView fillStatus = u.text("", 13, Ui.MUTED);
      fillStatus.setVisibility(View.GONE);
      p.body.addView(fillStatus, p.body.indexOfChild(body));
      LogTaskFill autoFill = new LogTaskFill(p, body, fillStatus, selectedDate, appended);
      datePicker.setOnItemSelectedListener(new android.widget.AdapterView.OnItemSelectedListener() {
        @Override public void onItemSelected(android.widget.AdapterView<?> parent, View view, int pos, long id) {
          autoFill.schedule();
        }

        @Override public void onNothingSelected(android.widget.AdapterView<?> parent) {}
      });
      autoFill.schedule();
    }
    u.note(p.body, "关联任务（可选）");
    String[] task = {s(log, "taskId")};
    boolean[] changed = {false};
    TextView selected = u.text("", 14, Ui.INK);
    selected.setPadding(u.dp(12), u.dp(10), u.dp(12), u.dp(10));
    selected.setBackground(u.shape(0xfff4edf4, 12));
    p.body.addView(selected);
    LinearLayout actions = u.row();
    Button choose = u.button(actions, "选择关联任务", false, () ->
        a.tasksUi.chooseTask("", task[0], id -> {
          task[0] = id;
          changed[0] = true;
          selected.setText(taskLabel(id, false));
          actions.getChildAt(1).setVisibility(id.isEmpty() ? android.view.View.GONE : android.view.View.VISIBLE);
        }));
    choose.setLayoutParams(new LinearLayout.LayoutParams(-2, -2));
    Button clear = u.button(actions, "清空关联", false, () -> {
      task[0] = "";
      changed[0] = true;
      selected.setText(taskLabel("", false));
      actions.getChildAt(1).setVisibility(android.view.View.GONE);
    });
    clear.setLayoutParams(new LinearLayout.LayoutParams(-2, -2));
    boolean hidden = log != null && !log.has("taskId");
    clear.setVisibility(task[0].isEmpty() ? android.view.View.GONE : android.view.View.VISIBLE);
    selected.setText(taskLabel(task[0], hidden));
    p.body.addView(actions);
    if (!s(log, "frozenAt").isEmpty())
      u.note(p.body, "日志将在 " + TasksUi.when(s(log, "frozenAt")) + " 后冻结");
    TextView saveError = u.text("", 14, Ui.ERROR);
    p.body.addView(saveError);
    String slot = "log:" + UUID.randomUUID();
    u.button(p.actions, "保存日志", true, () -> {
      if (Ui.value(body).isEmpty()) {
        saveError.setText("请填写日志内容。");
        return;
      }
      LocalDate businessDate = selectedDate.get();
      JSONObject data = obj("body", Ui.value(body));
      try {
        if (log == null) data.put("businessDate", businessDate.toString());
        if (log == null || changed[0]) data.put("taskId", task[0].isEmpty() ? JSONObject.NULL : task[0]);
        if (log == null || tags.touched()) data.put("tagIds", tags.ids());
      } catch (JSONException invalid) { throw new IllegalStateException(invalid); }
      saveError.setText("");
      p.error.setText("");
      a.run(() -> {
        try {
          return a.api.mutate(slot, log == null ? "POST" : "PATCH",
              "/work-logs" + (log == null ? "" : "/" + ApiClient.q(id(log))), data,
              log == null ? null : tag(log));
        } catch (ApiClient.Failure error) {
          if ("WORK_LOG_EXISTS".equals(error.code))
            throw new IOException("该日期已有日志。草稿已保留，请到日志详情查看原记录。", error);
          if ("WORK_LOG_FROZEN".equals(error.code))
            throw new IOException("日志已冻结，未能保存。正文仍在页面上，可以复制。", error);
          throw error;
        }
      }, result -> {
        reset();
        a.closePanels();
        a.reload();
        a.toast("日志已保存。");
      }, message -> p.error.setText(message));
    });
    tags.load();
  }

  private final class LogTaskFill {
    final MainActivity.Panel panel;
    final EditText body;
    final TextView status;
    final java.util.function.Supplier<LocalDate> selectedDate;
    final Map<LocalDate, Set<String>> appended;
    final Runnable pending = this::load;
    String generated = "";
    LocalDate generatedDate;
    Set<String> generatedKeys = Set.of();

    LogTaskFill(MainActivity.Panel panel, EditText body, TextView status,
        java.util.function.Supplier<LocalDate> selectedDate, Map<LocalDate, Set<String>> appended) {
      this.panel = panel;
      this.body = body;
      this.status = status;
      this.selectedDate = selectedDate;
      this.appended = appended;
    }

    void schedule() {
      body.removeCallbacks(pending);
      status.setVisibility(View.GONE);
      if (!generated.equals(body.getText().toString())) return;
      if (generatedDate != null && !generatedDate.equals(selectedDate.get())) {
        Set<String> old = appended.get(generatedDate);
        if (old != null) old.removeAll(generatedKeys);
        generatedDate = null;
        generatedKeys = Set.of();
        generated = "";
        body.setText("");
      }
      body.postDelayed(pending, 100);
    }

    void load() {
      if (!panel.dialog.isShowing() || !generated.equals(body.getText().toString())) return;
      if (a.busy) {
        body.postDelayed(pending, 120);
        return;
      }
      LocalDate date = selectedDate.get();
      if (date.equals(generatedDate)) return;
      a.run(() -> a.api.get("/work-logs/fill-source?businessDate=" + date), source -> {
        if (!stillCurrent(date)) return;
        if (!source.optBoolean("complete") || !date.toString().equals(s(source, "businessDate"))) {
          retry("暂时无法自动填充当日任务，点击重试");
          return;
        }
        Map<String, String> names = new LinkedHashMap<>();
        for (JSONObject task : rows(arr(source, "tasks"))) {
          if (!id(task).isEmpty() && !s(task, "name").isEmpty())
            names.putIfAbsent("tasks:" + id(task), s(task, "name"));
        }
        String next = String.join("\n", names.values());
        if (next.length() > 10000) {
          status.setText("当日任务名称超过正文上限，可从「追加当日名称」打开预览。");
          status.setOnClickListener(null);
          status.setVisibility(View.VISIBLE);
          return;
        }
        generated = next;
        generatedDate = date;
        generatedKeys = Set.copyOf(names.keySet());
        appended.computeIfAbsent(date, ignored -> new HashSet<>()).addAll(generatedKeys);
        body.setText(generated);
        body.setSelection(body.length());
        status.setVisibility(View.GONE);
      }, message -> {
        if (stillCurrent(date)) retry("暂时无法自动填充当日任务，点击重试");
      });
    }

    private boolean stillCurrent(LocalDate date) {
      return panel.dialog.isShowing() && date.equals(selectedDate.get())
          && generated.equals(body.getText().toString());
    }

    private void retry(String message) {
      status.setText(message);
      status.setOnClickListener(v -> schedule());
      status.setVisibility(View.VISIBLE);
    }
  }

  private String taskLabel(String taskId, boolean hidden) {
    if (hidden) return "关联任务当前不可见，保留原关系";
    if (taskId.isEmpty()) return "未关联任务";
    String title = s(a.task(taskId), "title");
    return title.isEmpty() ? "已关联任务" : title;
  }

  private void fillLog(MainActivity.Panel panel, EditText body, LocalDate date, String group,
      Set<String> appended) {
    panel.error.setText("");
    a.run(() -> a.api.get("/work-logs/fill-source?businessDate=" + date), source -> {
      if (!panel.dialog.isShowing()) return;
      if (!source.optBoolean("complete") || !date.toString().equals(s(source, "businessDate"))) {
        panel.error.setText("无法读取完整的当日名称，请重试。");
        return;
      }
      Map<String, String> names = new LinkedHashMap<>();
      for (JSONObject item : rows(arr(source, group))) {
        String key = group + ":" + id(item);
        if (!id(item).isEmpty() && !s(item, "name").isEmpty() && !appended.contains(key))
          names.putIfAbsent(key, s(item, "name"));
      }
      if (names.isEmpty()) {
        a.toast("没有可追加的新名称");
        return;
      }
      String current = body.getText().toString();
      String addition = String.join("\n", names.values());
      String separator = current.isEmpty() || current.endsWith("\n") ? "" : "\n";
      if (current.length() + separator.length() + addition.length() > 10000) {
        MainActivity.Panel preview = a.panel("追加后将超过日志长度上限");
        u.note(preview.body, "原正文已保留。可复制所需内容，再返回日志编辑。");
        preview.body.addView(u.text(addition, 16, Ui.INK));
        return;
      }
      body.append(separator + addition);
      appended.addAll(names.keySet());
    });
  }

  private static final String[] NOTICE_TYPES = {"all", "review", "result", "reminder", "comment", "other"};
  private static final String[] NOTICE_LABELS = {"全部类型", "需我审核", "结果告知", "提醒", "评论", "其他"};
  private int noticeEpoch = -1;
  private int noticeRead, noticeCategory, noticeMode;

  void notifications() {
    a.run(() -> a.api.all("/notifications"), list -> {
      a.notifications = list;
      a.updateBell();
      if (noticeEpoch != a.api.epoch) {
        noticeEpoch = a.api.epoch;
        noticeRead = noticeCategory = noticeMode = 0;
      }
      MainActivity.Panel panel = a.panel("通知");
      LinearLayout filters = u.row();
      panel.body.addView(filters);
      Spinner read = noticeFilter(filters, "已读状态", new String[] {"全部", "未读", "已读"}, noticeRead);
      String[] categoryOptions = NOTICE_LABELS.clone();
      categoryOptions[0] = "全部";
      Spinner category = noticeFilter(filters, "通知类型", categoryOptions, noticeCategory);
      Spinner mode = noticeFilter(filters, "显示方式", new String[] {"精简", "完整"}, noticeMode);
      LinearLayout actions = u.row();
      panel.body.addView(actions);
      TextView count = u.text("", 13, Ui.MUTED);
      actions.addView(count, new LinearLayout.LayoutParams(0, -2, 1));
      LinearLayout results = u.column();
      panel.body.addView(results);
      Runnable render = new Runnable() {
        @Override public void run() {
          if (!panel.dialog.isShowing()) return;
          noticeRead = Math.max(0, read.getSelectedItemPosition());
          noticeCategory = Math.max(0, category.getSelectedItemPosition());
          noticeMode = Math.max(0, mode.getSelectedItemPosition());
          results.removeAllViews();
          int matched = 0;
          for (JSONObject n : rows(a.notifications)) {
            boolean unread = s(n, "readAt").isEmpty();
            if (noticeRead == 1 && !unread || noticeRead == 2 && unread) continue;
            int type = List.of(NOTICE_TYPES).indexOf(s(n, "category"));
            if (type <= 0) type = NOTICE_TYPES.length - 1;
            if (noticeCategory != 0 && noticeCategory != type) continue;
            String title = s(n, "objectName");
            if (title.isEmpty()) title = s(n, "title");
            if (title.isEmpty()) title = s(n, "taskId").isEmpty() ? "无关联任务" : "关联任务不可查看";
            String meta = NOTICE_LABELS[type] + " · " + (unread ? "未读" : "已读")
                + (n.optBoolean("revoked") ? " · 已撤回" : "") + " · " + TasksUi.whenMinute(s(n, "createdAt"));
            if (noticeMode == 1) {
              String summary = s(n, "summary");
              String purpose = s(n, "purpose");
              meta += "\n" + (purpose.isEmpty() ? "" : purpose + " · ") + summary;
            }
            u.item(results, title, meta, () -> notification(id(n), this));
            matched++;
          }
          count.setText(matched + " 条通知");
          if (matched == 0) u.note(results, a.notifications.length() == 0 ? "暂无通知" : "没有符合筛选条件的通知");
        }
      };
      Button clear = u.button(actions, "清空筛选", false, () -> {
        read.setSelection(0);
        category.setSelection(0);
        mode.setSelection(0);
        render.run();
      });
      clear.setLayoutParams(new LinearLayout.LayoutParams(-2, u.dp(45)));
      android.widget.AdapterView.OnItemSelectedListener filterChanged = new android.widget.AdapterView.OnItemSelectedListener() {
        @Override public void onItemSelected(android.widget.AdapterView<?> parent, View view, int pos, long id) {
          render.run();
        }

        @Override public void onNothingSelected(android.widget.AdapterView<?> parent) {}
      };
      read.setOnItemSelectedListener(filterChanged);
      category.setOnItemSelectedListener(filterChanged);
      mode.setOnItemSelectedListener(filterChanged);
      render.run();
    });
  }

  private Spinner noticeFilter(LinearLayout filters, String label, String[] values, int current) {
    LinearLayout column = u.column();
    filters.addView(column, new LinearLayout.LayoutParams(0, -2, 1));
    return u.spinner(column, label, values, current);
  }

  private void notification(String id, Runnable refreshList) {
    a.run(
        () -> {
          a.api.mutate(
              "notification-open:" + id,
              "POST",
              "/notifications/" + ApiClient.q(id) + "/open",
              null,
              null);
          JSONObject detail = a.api.get("/notifications/" + ApiClient.q(id));
          a.notifications = a.api.all("/notifications");
          return detail;
        },
        n -> {
          a.updateBell();
          refreshList.run();
          MainActivity.Panel p = a.panel("通知详情");
          u.note(p.body, TasksUi.when(s(n, "createdAt")));
          boolean revoked = n.optBoolean("revoked");
          if (revoked && !n.optBoolean("canReadWithdrawnDetails")) {
            u.note(p.body, "该通知已被撤回。");
            return;
          }
          if (revoked) u.note(p.body, "已撤回，仅供只读查看。");
          u.heading(p.body, s(n, "title"));
          p.body.addView(u.text(s(n, "summary"), 16, Ui.INK));
          if (!s(n, "changeSummary").isEmpty()) u.note(p.body, s(n, "changeSummary"));
          if (!s(n, "requestStatus").isEmpty())
            u.note(
                p.body, "原申请：" + kind(s(n, "requestKind")) + " · " + state(s(n, "requestStatus")));
          if (n.optBoolean("relationLost")) u.note(p.body, "任务关系已变化，仅可查看历史摘要。");
          if (!revoked) {
            if (!s(n, "requestId").isEmpty())
              u.button(
                  p.body,
                  n.optBoolean("canReview") ? "审核此申请" : "查看原申请结果",
                  false,
                  () -> a.tasksUi.approval(s(n, "requestId")));
            if (!s(n, "taskId").isEmpty())
              u.button(
                  p.body,
                  "查看相关任务",
                  true,
                  () -> {
                    if (n.optBoolean("relationLost") || n.optBoolean("readonly"))
                      a.run(
                          () -> a.api.get("/notifications/" + ApiClient.q(id) + "/task"),
                          t -> a.tasksUi.showDetail(t, true));
                    else a.tasksUi.detail(s(n, "taskId"));
                  });
            if (n.optBoolean("canWithdraw"))
              u.button(
                  p.body,
                  "撤回通知",
                  false,
                  () ->
                      confirm(
                          "撤回通知？业务结果不变。",
                          () ->
                              a.write(
                                  "notification-withdraw:" + id,
                                  "POST",
                                  "/notifications/" + ApiClient.q(id) + "/withdraw",
                                  obj("reason", "发起人撤回"),
                                  null)));
            u.button(
                p.body,
                "删除此消息",
                false,
                () ->
                    confirm(
                        "删除此消息？",
                        () ->
                            a.write(
                                "notification-delete:" + id,
                                "PATCH",
                                "/notifications/" + ApiClient.q(id),
                                obj("action", "delete"),
                                tag(n))));
          }
        });
  }

  void stats() {
    renderStats();
    generateAnalysis();
  }

  private void renderStats() {
    LinearLayout box = a.page("统计");
    JSONObject summary = analysis == null ? a.analytics : child(analysis, "summary");
    u.heading(box, "任务数据统计");
    u.note(box, s(summary, "scopeLabel"));
    String[][] metrics = {
      {"任务总数", "total"},
      {"进行中", "doing"},
      {"待开始", "todo"},
      {"已完成", "done"},
      {"待完成审核", "pendingComplete"},
      {"全部待审冻结", "frozen"},
      {"逾期未完成", "overdue"}
    };
    GridLayout grid = new GridLayout(a);
    int columns = a.getResources().getConfiguration().screenWidthDp >= 600 ? 3 : 2;
    grid.setColumnCount(columns);
    box.addView(grid, new LinearLayout.LayoutParams(-1, -2));
    int metricIndex = 0;
    for (String[] metric : metrics) {
      LinearLayout cell = u.column();
      cell.setPadding(u.dp(12), u.dp(12), u.dp(12), u.dp(12));
      cell.setBackground(u.shape(Ui.SURFACE, 16));
      cell.addView(u.text(String.valueOf(summary.optInt(metric[1])), 28, Ui.PRIMARY));
      cell.addView(u.text(metric[0], 13, Ui.MUTED));
      GridLayout.LayoutParams lp =
          new GridLayout.LayoutParams(
              GridLayout.spec(metricIndex / columns), GridLayout.spec(metricIndex % columns, 1f));
      lp.width = 0;
      lp.setMargins(u.dp(4), u.dp(4), u.dp(4), u.dp(4));
      grid.addView(cell, lp);
      metricIndex++;
    }
    u.heading(box, "紧急程度分布");
    JSONObject levels = child(summary, "priority");
    for (String[] level :
        new String[][] {{"紧急", "urgent"}, {"高", "high"}, {"中", "medium"}, {"低", "low"}}) {
      u.note(box, level[0] + " · " + levels.optInt(level[1]));
      ProgressBar bar = new ProgressBar(a, null, android.R.attr.progressBarStyleHorizontal);
      bar.setMax(Math.max(1, summary.optInt("total")));
      bar.setProgress(levels.optInt(level[1]));
      bar.setContentDescription(level[0] + " " + levels.optInt(level[1]) + "项");
      box.addView(bar, new LinearLayout.LayoutParams(-1, u.dp(12)));
    }
    u.heading(box, "关键词词云");
    u.note(box, "从授权任务标题和说明提取，不读取私人日志。");
    LinearLayout cloud = u.row();
    int count = 0;
    for (JSONObject word : rows(arr(summary, "keywords"))) {
      if (count % 3 == 0) {
        cloud = u.row();
        box.addView(cloud);
      }
      TextView text =
          u.text(
              s(word, "word") + " · " + word.optInt("count"),
              Math.min(24, 14 + word.optInt("count")),
              Ui.PRIMARY);
      text.setPadding(u.dp(4), u.dp(8), u.dp(4), u.dp(8));
      cloud.addView(text, new LinearLayout.LayoutParams(0, -2, 1));
      count++;
    }
    if (count == 0) u.note(box, "暂无关键词");
    u.heading(box, "规则建议");
    u.note(box, analysis == null ? "正在按当前权限生成分析…" : s(analysis, "suggestionScopeLabel"));
    u.button(box, "刷新并重算", true, this::generateAnalysis);
    if (analysis != null) {
      u.note(box, "生成于 " + TasksUi.when(s(analysis, "generatedAt")));
      JSONArray suggestions = arr(analysis, "suggestions");
      for (JSONObject item : rows(suggestions)) {
        LinearLayout card = u.card(box);
        u.heading(card, s(item, "title"));
        card.addView(u.text(s(item, "message"), 15, Ui.INK));
        JSONArray ids = arr(item, "sourceTaskIds");
        if (ids.length() == 0 && !s(item, "taskId").isEmpty()) ids.put(s(item, "taskId"));
        for (int i = 0; i < ids.length(); i++) {
          String id = ids.optString(i);
          if (a.task(id).length() > 0)
            u.button(card, "查看「" + s(a.task(id), "title") + "」", false, () -> a.tasksUi.detail(id));
        }
      }
      if (suggestions.length() == 0) u.note(box, "当前没有触发临期、逾期、排期冲突或高紧急规则。");
    }
  }

  private void generateAnalysis() {
    String slot = UUID.randomUUID().toString();
    a.run(
        () -> {
          JSONObject job = a.api.mutate(slot, "POST", "/ai-jobs", obj("scopeType", "auto"), null);
          return a.api.get("/ai-jobs/" + ApiClient.q(s(job, "jobId")));
        },
        r -> {
          analysis = child(r, "result");
          if (a.page.equals("ai")) renderStats();
        });
  }

  void profilePage() {
    LinearLayout box = a.page("我的");
    LinearLayout card = u.card(box);
    avatar(card, s(a.me, "avatar"), s(a.me, "displayName"));
    u.heading(card, s(a.me, "displayName"));
    u.note(card, s(a.me, "positionName") + " · " + s(a.me, "departmentName"));
    u.button(card, "个人设置", true, this::settings);
    u.button(card, "组织成员", false, this::showOrganizationMembers);
    organization(box, a.me);
    if (a.reports.length() > 0) {
      u.heading(box, "下属资料");
      for (JSONObject p : rows(a.reports))
        u.item(box, s(p, "displayName"), s(p, "departmentName"), () -> person(id(p)));
    }
    u.button(box, "任务与审批", false, () -> {
      MainActivity.Panel work = a.panel("任务与审批");
      u.button(work.body, "待我审核", false, () -> a.tasksUi.approvals("reviewer"));
      u.button(work.body, "我的申请", false, () -> a.tasksUi.approvals("applicant"));
      u.button(work.body, "全部授权任务", false, a.tasksUi::list);
    });
  }

  private void showOrganizationMembers() {
    a.run(() -> obj("members", arr(a.api.get("/assignee-candidates?purpose=create"), "items"),
        "reports", arr(a.api.get("/me/reports"), "items")), result -> {
      if (!"me".equals(a.page)) return;
      MainActivity.Panel panel = a.panel("组织成员");
      List<JSONObject> members = rows(arr(result, "members"));
      if (members.isEmpty()) u.note(panel.body, "暂无可显示的组织成员");
      Set<String> reports = new HashSet<>();
      for (JSONObject report : rows(arr(result, "reports"))) reports.add(id(report));
      for (JSONObject member : members) {
        String memberId = id(member);
        String name = s(member, "displayName") + (memberId.equals(a.uid()) ? "（我）" : "");
        boolean canView = reports.contains(memberId) || memberId.equals(a.uid());
        u.item(panel.body, name, placement(member),
            () -> { if (canView) person(memberId); else memberSummary(member); });
      }
    });
  }

  private String placement(JSONObject member) {
    List<String> path = new ArrayList<>();
    for (String field : List.of("departmentName", "teamName", "positionName")) {
      String value = s(member, field);
      if (!value.isEmpty()) path.add(value);
    }
    return String.join(" · ", path);
  }

  private void memberSummary(JSONObject member) {
    MainActivity.Panel panel = a.panel("人员资料");
    u.heading(panel.body, s(member, "displayName"));
    u.note(panel.body, placement(member));
    u.note(panel.body, "当前可查看此人的组织职务。日程和日志仅向本人及有权限的上级开放。");
  }

  private void organization(LinearLayout box, JSONObject p) {
    LinearLayout card = u.card(box);
    u.heading(card, "组织信息");
    for (String[] field :
        new String[][] {
          {"公司", "organizationName"},
          {"部门", "departmentName"},
          {"职位", "positionName"},
          {"独立团队", "teamName"},
          {"直属上级", "managerName"}
        }) u.note(card, field[0] + "：" + (s(p, field[1]).isEmpty() ? "未设置" : s(p, field[1])));
  }

  private void settings() {
    MainActivity.Panel p = a.panel("个人设置");
    u.note(p.body, "账号：" + s(a.me, "username"));
    u.button(
        p.body, "编辑资料与头像", true, () -> a.run(() -> a.api.get("/me/profile"), this::profileForm));
    u.button(p.body, "修改密码", false, () -> a.password(false));
    u.button(
        p.body,
        "刷新数据",
        false,
        () -> {
          p.dialog.dismiss();
          reset();
          a.reload();
        });
    u.button(p.body, "交接预设", false, () -> a.tasksUi.preset(a.uid()));
    u.button(p.body, "退出登录", false, a::logout);
  }

  private void person(String id) {
    boolean self = id.equals(a.uid());
    a.run(
        () -> {
          if (!self) requireReport(id);
          return a.api.get("/users/" + ApiClient.q(id));
        },
        r -> {
          MainActivity.Panel p = a.panel("人员资料");
          u.heading(p.body, s(r, "displayName"));
          u.note(p.body, placement(r));
          if (!s(r, "phone").isEmpty()) u.note(p.body, "手机号：" + s(r, "phone"));
          if (!s(r, "email").isEmpty()) u.note(p.body, "邮箱：" + s(r, "email"));
          if (!s(r, "hireDate").isEmpty()) u.note(p.body, "入职日期：" + s(r, "hireDate"));
          if (r.optBoolean("canSetHandoverPreset"))
            u.button(p.body, "设置交接预设", false, () -> a.tasksUi.preset(id));
          new MemberWorkspace(r, p).render();
        });
  }

  void requireReport(String reportId) throws Exception {
    if (reportId.equals(a.uid())) return;
    JSONArray directory = arr(a.api.get("/me/reports"), "items");
    if (rows(directory).stream().noneMatch(person -> reportId.equals(id(person))))
      throw new IOException("当前无权查看此人的工作区。");
  }

  private final class MemberWorkspace {
    final String reportId;
    final CalendarUi calendar;
    JSONObject member;
    boolean logs;
    final MainActivity.Panel panel;
    final LinearLayout section;
    LinearLayout content;
    Button more;

    MemberWorkspace(JSONObject member, MainActivity.Panel panel) {
      this.member = member;
      this.panel = panel;
      reportId = id(member);
      calendar = new CalendarUi(a, reportId);
      section = u.column();
      panel.body.addView(section);
    }

    void render() {
      section.removeAllViews();
      LinearLayout tabs = u.row();
      section.addView(tabs);
      for (boolean logTab : new boolean[] {false, true}) {
        LinearLayout cell = u.column();
        tabs.addView(cell, new LinearLayout.LayoutParams(0, -2, 1));
        Button tab = u.button(cell, logTab ? "日志" : "日程", logTab == logs, () -> {
          if (logs != logTab) {
            logs = logTab;
            render();
          }
        });
        tab.setSelected(logTab == logs);
        tab.setEnabled(!logTab || member.optBoolean("canReadLogs"));
      }
      content = u.column();
      section.addView(content);
      refresh();
    }

    void refresh() {
      panel.error.setText("");
      content.removeAllViews();
      more = null;
      u.note(content, logs ? "正在读取日志…" : "正在读取日程…");
      load(0, false);
    }

    void load(int offset, boolean append) {
      LocalDate first = calendar.day ? calendar.date : calendar.date.withDayOfMonth(1)
          .with(java.time.temporal.TemporalAdjusters.previousOrSame(DayOfWeek.MONDAY));
      LocalDate last = calendar.day ? calendar.date : calendar.date.withDayOfMonth(calendar.date.lengthOfMonth())
          .with(java.time.temporal.TemporalAdjusters.nextOrSame(DayOfWeek.SUNDAY));
      a.run(() -> {
        requireReport(reportId);
        JSONObject latest = a.api.get("/users/" + ApiClient.q(reportId));
        if (logs) {
          if (!latest.optBoolean("canReadLogs")) throw new IOException("当前无权查看此人的日志。");
          String scope = reportId.equals(a.uid()) ? "self" : "visible";
          return obj("person", latest, "data", a.api.get("/work-logs?scope=" + scope + "&authorId="
              + ApiClient.q(reportId) + "&limit=20&offset=" + offset));
        }
        return obj("person", latest, "items", a.api.all("/tasks?assigneeId=" + ApiClient.q(reportId)
            + "&calendarPreview=true&from=" + first + "&to=" + last));
      }, result -> {
        if (!panel.dialog.isShowing()) return;
        if (!append) content.removeAllViews();
        if (more != null) content.removeView(more);
        more = null;
        member = child(result, "person");
        if (!logs) {
          calendar.showWorkspace(content, arr(result, "items"), this::refresh);
          return;
        }
        JSONObject page = child(result, "data");
        List<JSONObject> entries = rows(arr(page, "items"));
        if (!append && entries.isEmpty()) u.note(content, "暂无工作日志");
        for (JSONObject entry : entries)
          u.item(content, s(entry, "body"), s(entry, "businessDate"), () -> logDetail(id(entry), reportId));
        if (!page.isNull("nextOffset")) {
          int next = page.optInt("nextOffset");
          if (next > offset) more = u.button(content, "加载更早日志", false, () -> load(next, true));
        }
      }, message -> {
        if (!panel.dialog.isShowing()) return;
        content.removeAllViews();
        panel.error.setText(message);
        u.button(content, "重新读取", false, this::refresh);
      });
    }
  }

  private static final int PHOTO = 70;

  private final class ProfileDraft {
    JSONObject raw;
    MainActivity.Panel panel;
    EditText name, phone, email;
    String avatar;
    int epoch;
    LinearLayout preview;
    boolean photoLoading;
  }

  private void profileForm(JSONObject raw) {
    ProfileDraft draft = new ProfileDraft();
    profile = draft;
    draft.raw = raw;
    draft.avatar = s(raw, "avatar");
    draft.epoch = a.api.epoch;
    draft.panel = a.panel("编辑个人资料");
    LinearLayout body = draft.panel.body;
    draft.preview = u.column();
    body.addView(draft.preview);
    avatar(draft.preview, draft.avatar, s(raw, "displayName"));
    u.note(body, "选择头像，或上传10MB以内的 PNG / JPG 图片。");
    String[] preset = {"", "rabbit", "cat", "bear", "panda"},
        names = {"使用姓名头像", "兔子", "小猫", "小熊", "熊猫"};
    for (int i = 0; i < preset.length; i++) {
      String value = preset[i];
      u.button(
          body,
          names[i],
          false,
          () -> {
            draft.avatar = value;
            draft.preview.removeAllViews();
            avatar(draft.preview, value, Ui.value(draft.name));
          });
    }
    u.button(
        body,
        "从手机选择照片",
        false,
        () -> {
          Intent picker = new Intent(Intent.ACTION_OPEN_DOCUMENT);
          picker.addCategory(Intent.CATEGORY_OPENABLE);
          picker.setType("image/*");
          picker.putExtra(Intent.EXTRA_MIME_TYPES, new String[] {"image/png", "image/jpeg"});
          try {
            a.startActivityForResult(picker, PHOTO);
          } catch (ActivityNotFoundException e) {
            a.error("未找到照片选择器。");
          }
        });
    draft.name = u.field(body, "姓名（必填）", s(raw, "displayName"), 100, false);
    draft.phone = u.field(body, "联系电话（选填）", s(raw, "phone"), 32, false);
    draft.phone.setInputType(InputType.TYPE_CLASS_PHONE);
    draft.email = u.field(body, "邮箱（选填）", s(raw, "email"), 254, false);
    draft.email.setInputType(
        InputType.TYPE_CLASS_TEXT | InputType.TYPE_TEXT_VARIATION_EMAIL_ADDRESS);
    u.note(body, "手机号仅本人及管理链上的上级可见，邮箱仅本人可见。留空可清除。组织信息由管理员维护。");
    organization(body, raw);
    String slot = UUID.randomUUID().toString();
    u.button(
        draft.panel.actions,
        "保存资料",
        true,
        () -> {
          if (draft.epoch != a.api.epoch) {
            a.error("会话已变化，请重新打开。");
            return;
          }
          if (draft.photoLoading) {
            a.error("照片正在处理。");
            return;
          }
          if (Ui.value(draft.name).isEmpty()) {
            a.error("请填写姓名。");
            return;
          }
          String email = Ui.value(draft.email);
          if (!email.isEmpty() && !android.util.Patterns.EMAIL_ADDRESS.matcher(email).matches()) {
            a.error("请输入有效邮箱。");
            return;
          }
          JSONObject data =
              obj(
                  "displayName",
                  Ui.value(draft.name),
                  "phone",
                  Ui.value(draft.phone),
                  "email",
                  email);
          if (!draft.avatar.equals(s(raw, "avatar")))
            try {
              data.put("avatar", draft.avatar.isEmpty() ? JSONObject.NULL : draft.avatar);
            } catch (JSONException ignored) {
            }
          a.write(slot, "PATCH", "/me/profile", data, tag(raw));
        });
  }

  private void avatar(LinearLayout into, String value, String name) {
    if (value.startsWith("data:image/")) {
      try {
        byte[] bytes = Base64.decode(value.substring(value.indexOf(',') + 1), Base64.DEFAULT);
        Bitmap bitmap = BitmapFactory.decodeByteArray(bytes, 0, bytes.length);
        if (bitmap != null) {
          ImageView image = new ImageView(a);
          image.setImageBitmap(bitmap);
          image.setContentDescription(name + "的头像");
          into.addView(image, new LinearLayout.LayoutParams(u.dp(80), u.dp(80)));
          return;
        }
      } catch (Exception ignored) {
      }
    }
    String emoji =
        switch (value) {
          case "rabbit" -> "🐰";
          case "cat" -> "🐱";
          case "bear" -> "🐻";
          case "panda" -> "🐼";
          default -> name.isEmpty() ? "我" : name.substring(0, name.offsetByCodePoints(0, 1));
        };
    TextView text = u.text(emoji, 36, Ui.PRIMARY);
    text.setGravity(android.view.Gravity.CENTER);
    text.setBackground(u.shape(Ui.CONTAINER, 40));
    into.addView(text, new LinearLayout.LayoutParams(u.dp(80), u.dp(80)));
  }

  void photoResult(int request, int result, Intent data) {
    if (request != PHOTO
        || result != Activity.RESULT_OK
        || data == null
        || data.getData() == null
        || profile == null) return;
    ProfileDraft draft = profile;
    if (!draft.panel.dialog.isShowing() || draft.epoch != a.api.epoch) return;
    Uri uri = data.getData();
    draft.photoLoading = true;
    a.run(
        () -> {
          try (InputStream in = a.getContentResolver().openInputStream(uri);
              ByteArrayOutputStream out = new ByteArrayOutputStream()) {
            if (in == null) throw new IOException("无法读取照片。");
            byte[] buffer = new byte[8192];
            int read;
            while ((read = in.read(buffer)) != -1) {
              out.write(buffer, 0, read);
              if (out.size() > 10 * 1024 * 1024) throw new IOException("请选择10MB以内的图片。");
            }
            byte[] bytes = out.toByteArray();
            BitmapFactory.Options bounds = new BitmapFactory.Options();
            bounds.inJustDecodeBounds = true;
            BitmapFactory.decodeByteArray(bytes, 0, bytes.length, bounds);
            if (bounds.outWidth <= 0 || bounds.outHeight <= 0) throw new IOException("无法读取图片。");
            BitmapFactory.Options options = new BitmapFactory.Options();
            while (Math.max(bounds.outWidth, bounds.outHeight)
                    / (Math.max(1, options.inSampleSize) * 2)
                > 2048) options.inSampleSize = Math.max(1, options.inSampleSize) * 2;
            Bitmap source = BitmapFactory.decodeByteArray(bytes, 0, bytes.length, options);
            if (source == null) throw new IOException("无法解码图片。");
            try {
              android.media.ExifInterface exif =
                  new android.media.ExifInterface(new ByteArrayInputStream(bytes));
              int orientation =
                  exif.getAttributeInt(
                      android.media.ExifInterface.TAG_ORIENTATION,
                      android.media.ExifInterface.ORIENTATION_NORMAL);
              Matrix matrix = new Matrix();
              switch (orientation) {
                case 2 -> matrix.setScale(-1, 1);
                case 3 -> matrix.setRotate(180);
                case 4 -> matrix.setScale(1, -1);
                case 5 -> {
                  matrix.setRotate(90);
                  matrix.postScale(-1, 1);
                }
                case 6 -> matrix.setRotate(90);
                case 7 -> {
                  matrix.setRotate(270);
                  matrix.postScale(-1, 1);
                }
                case 8 -> matrix.setRotate(270);
                default -> {}
              }
              if (!matrix.isIdentity()) {
                Bitmap rotated =
                    Bitmap.createBitmap(
                        source, 0, 0, source.getWidth(), source.getHeight(), matrix, true);
                if (rotated != source) source.recycle();
                source = rotated;
              }
            } catch (IOException ignored) {
            }
            int size = Math.min(source.getWidth(), source.getHeight());
            Bitmap square =
                Bitmap.createBitmap(
                    source,
                    (source.getWidth() - size) / 2,
                    (source.getHeight() - size) / 2,
                    size,
                    size);
            Bitmap scaled = Bitmap.createScaledBitmap(square, 256, 256, true);
            ByteArrayOutputStream jpeg = new ByteArrayOutputStream();
            scaled.compress(Bitmap.CompressFormat.JPEG, 90, jpeg);
            if (scaled != square) scaled.recycle();
            if (square != source) square.recycle();
            source.recycle();
            return "data:image/jpeg;base64,"
                + Base64.encodeToString(jpeg.toByteArray(), Base64.NO_WRAP);
          } finally {
            draft.photoLoading = false;
          }
        },
        value -> {
          if (profile == draft && draft.panel.dialog.isShowing()) {
            draft.avatar = value;
            draft.preview.removeAllViews();
            avatar(draft.preview, value, Ui.value(draft.name));
            u.note(draft.preview, "照片已选好，保存资料后生效。");
          }
        });
  }
}
