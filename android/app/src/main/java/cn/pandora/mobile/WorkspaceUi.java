package cn.pandora.mobile;

import static cn.pandora.mobile.Json.*;

import android.app.*;
import android.content.*;
import android.graphics.*;
import android.net.Uri;
import android.text.InputType;
import android.util.Base64;
import android.widget.*;
import java.io.*;
import java.time.*;
import java.util.*;
import org.json.*;

final class WorkspaceUi {
  private final MainActivity a;
  private final Ui u;
  private JSONArray logRows;
  private String logAuthor = "", logQuery = "", logFrom = "", logTo = "", department = "";
  private JSONObject analysis;
  private ProfileDraft profile;
  private LocalDate homeWeek;
  private int homeWeekEpoch = -1;

  WorkspaceUi(MainActivity a) {
    this.a = a;
    u = a.u;
  }

  void reset() {
    logRows = null;
    logAuthor = "";
    logQuery = "";
    logFrom = "";
    logTo = "";
    department = "";
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
    new DatePickerDialog(a, (picker, y, m, d) -> onSelected.accept(LocalDate.of(y, m + 1, d)),
        initial.getYear(), initial.getMonthValue() - 1, initial.getDayOfMonth()).show();
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
    LinearLayout box = a.page("记录");
    u.heading(
        box,
        logAuthor.isEmpty() || logAuthor.equals(a.uid())
            ? "我的日志"
            : logAuthor.equals("*") ? "授权范围内的日志" : a.person(logAuthor) + "的日志");
    u.button(box, "写日志", true, () -> editLog(null));
    u.button(box, "选择人员或部门", false, this::authorPicker);
    EditText query = u.field(box, "搜索日志内容", logQuery, 200, false);
    u.button(
        box,
        "搜索",
        false,
        () -> {
          logQuery = Ui.value(query);
          logsPage();
        });
    u.note(
        box,
        "日期范围：" + (logFrom.isEmpty() ? "全部" : logFrom) + " 至 " + (logTo.isEmpty() ? "全部" : logTo));
    u.button(box, "设置日期范围", false, this::logDates);
    u.button(
        box,
        "清除筛选",
        false,
        () -> {
          logQuery = "";
          logFrom = "";
          logTo = "";
          logAuthor = "";
          logRows = null;
          department = "";
          logsPage();
        });
    JSONArray list = logRows == null ? a.logs : logRows;
    int count = 0;
    for (JSONObject log : rows(list)) {
      if (!department.isEmpty()
          && rows(arr(a.authors, "items")).stream()
              .noneMatch(
                  author ->
                      s(author, "departmentName").equals(department)
                          && id(author).equals(s(log, "authorId")))) continue;
      if (!s(log, "body").toLowerCase(Locale.ROOT).contains(logQuery.toLowerCase(Locale.ROOT)))
        continue;
      if (!logFrom.isEmpty() && s(log, "businessDate").compareTo(logFrom) < 0) continue;
      if (!logTo.isEmpty() && s(log, "businessDate").compareTo(logTo) > 0) continue;
      u.item(
          box,
          s(log, "body"),
          s(log, "authorName")
              + " · "
              + s(log, "businessDate")
              + (log.optBoolean("editable") ? " · 可编辑" : " · 只读"),
          () -> logDetail(id(log)));
      count++;
    }
    if (count == 0) u.note(box, "没有符合条件的日志");
  }

  private void logDates() {
    MainActivity.Panel p = a.panel("日志日期范围");
    LocalDate now = LocalDate.now(CalendarUi.ZONE);
    LocalDateTime[] dates = {
      logFrom.isEmpty()
          ? now.minusMonths(1).atStartOfDay()
          : LocalDate.parse(logFrom).atStartOfDay(),
      logTo.isEmpty() ? now.atStartOfDay() : LocalDate.parse(logTo).atStartOfDay()
    };
    u.dateTime(p.body, "开始日期（忽略时刻）", dates, 0);
    u.dateTime(p.body, "结束日期（忽略时刻）", dates, 1);
    u.button(
        p.actions,
        "应用范围",
        true,
        () -> {
          if (dates[1].isBefore(dates[0])) {
            p.error.setText("结束日期不得早于开始日期。");
            return;
          }
          logFrom = dates[0].toLocalDate().toString();
          logTo = dates[1].toLocalDate().toString();
          p.dialog.dismiss();
          logsPage();
        });
  }

  private void loadAuthor(String author) {
    String path =
        "/work-logs?scope="
            + (author.isEmpty() || author.equals(a.uid()) ? "self" : "visible")
            + (author.isEmpty() || author.equals("*") ? "" : "&authorId=" + ApiClient.q(author));
    a.run(
        () -> a.api.all(path),
        r -> {
          logRows = r;
          logAuthor = author;
          a.closePanels();
          a.page = "log";
          a.navigate("log");
        });
  }

  private void authorPicker() {
    MainActivity.Panel p = a.panel("日志人员与部门");
    List<JSONObject> candidates = rows(arr(a.authors, "items"));
    List<String> departments = new ArrayList<>();
    departments.add("全部部门");
    for (JSONObject author : candidates)
      if (!departments.contains(s(author, "departmentName")))
        departments.add(s(author, "departmentName"));
    Spinner dep =
        u.spinner(
            p.body,
            "部门",
            departments.toArray(new String[0]),
            Math.max(0, departments.indexOf(department)));
    EditText query = u.field(p.body, "搜索姓名或账号", "", 100, false);
    LinearLayout results = u.column();
    p.body.addView(results);
    Runnable render =
        () -> {
          results.removeAllViews();
          String chosen =
              dep.getSelectedItemPosition() == 0 ? "" : String.valueOf(dep.getSelectedItem());
          department = chosen;
          u.button(results, "我的日志", false, () -> loadAuthor(a.uid()));
          u.button(results, "全部授权人员", false, () -> loadAuthor("*"));
          for (JSONObject author : candidates)
            if ((chosen.isEmpty() || chosen.equals(s(author, "departmentName")))
                && (s(author, "displayName") + s(author, "username")).contains(Ui.value(query)))
              u.item(
                  results,
                  s(author, "displayName"),
                  s(author, "departmentName"),
                  () -> loadAuthor(id(author)));
        };
    u.button(p.body, "筛选人员", false, render);
    render.run();
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
          u.note(p.body, s(log, "authorName") + " · " + s(log, "businessDate"));
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
        });
  }

  void editLog(JSONObject log) {
    if (log != null) {
      logForm(log, LocalDate.parse(s(log, "businessDate")));
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
      return available;
    }, available -> {
      MainActivity.Panel dates = a.panel("选择日志日期");
      if (available.isEmpty()) u.note(dates.body, "最近三天都已写过日志，可从日志详情打开可编辑的记录。");
      for (LocalDate date : available)
        u.button(dates.body, date.toString(), false, () -> {
          dates.dialog.dismiss();
          logForm(null, date);
        });
    });
  }

  private void logForm(JSONObject log, LocalDate businessDate) {
    if (log != null && (!log.optBoolean("editable") || log.optBoolean("frozen"))) {
      a.error("这条日志只读。");
      return;
    }
    MainActivity.Panel p = a.panel(log == null ? "写日志" : "编辑日志");
    u.note(p.body, "所属日期：" + businessDate);
    EditText body = u.field(p.body, "日志内容（必填）", s(log, "body"), 10000, true);
    body.setId(R.id.log_content);
    body.setMinLines(12);
    body.setMaxLines(16);
    body.setMinHeight(u.dp(320));
    body.setGravity(android.view.Gravity.TOP | android.view.Gravity.START);
    body.setVerticalScrollBarEnabled(true);
    Set<String> appended = new HashSet<>();
    u.button(p.body, "追加当日事项名称", false,
        () -> fillLog(p, body, businessDate, "dailyItems", appended));
    u.button(p.body, "追加当日任务名称", false,
        () -> fillLog(p, body, businessDate, "tasks", appended));
    String[] task = {s(log, "taskId")};
    boolean[] changed = {false};
    TextView selected =
        u.text(
            task[0].isEmpty() ? "未关联任务（原关系不可见时将保留）" : "关联任务：" + s(a.task(task[0]), "title"),
            14,
            Ui.MUTED);
    p.body.addView(selected);
    u.button(
        p.body,
        "选择或清除关联任务",
        false,
        () ->
            a.tasksUi.chooseTask(
                "",
                task[0],
                id -> {
                  task[0] = id;
                  changed[0] = true;
                  selected.setText(id.isEmpty() ? "不关联任务" : s(a.task(id), "title"));
                }));
    String slot = UUID.randomUUID().toString();
    u.button(
        p.actions,
        "保存日志",
        true,
        () -> {
          if (Ui.value(body).isEmpty()) {
            p.error.setText("请填写日志内容。");
            return;
          }
          JSONObject data = log == null
              ? obj("body", Ui.value(body), "businessDate", businessDate.toString(),
                    "taskId", task[0].isEmpty() ? JSONObject.NULL : task[0])
              : changed[0]
                  ? obj("body", Ui.value(body), "taskId", task[0].isEmpty() ? JSONObject.NULL : task[0])
                  : obj("body", Ui.value(body));
          a.run(
              () -> {
                try {
                  return a.api.mutate(slot, log == null ? "POST" : "PATCH",
                      "/work-logs" + (log == null ? "" : "/" + ApiClient.q(id(log))), data,
                      log == null ? null : tag(log));
                } catch (ApiClient.Failure error) {
                  if ("WORK_LOG_EXISTS".equals(error.code))
                    throw new IOException("该日期已有日志。当前草稿已保留，可返回日志列表查看原记录。", error);
                  throw error;
                }
              },
              r -> {
                reset();
                a.closePanels();
                a.reload();
                a.toast("日志已保存。");
              });
        });
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

  void notifications() {
    a.run(
        () -> a.api.all("/notifications"),
        list -> {
          a.notifications = list;
          a.updateBell();
          MainActivity.Panel p = a.panel("通知");
          if (list.length() == 0) u.note(p.body, "暂无通知");
          for (JSONObject n : rows(list))
            u.item(
                p.body,
                s(n, "title").isEmpty() ? s(n, "summary") : s(n, "title"),
                TasksUi.when(s(n, "createdAt"))
                    + " · "
                    + (n.optBoolean("revoked") ? "已撤回" : s(n, "readAt").isEmpty() ? "未读" : "已读"),
                () -> notification(id(n)));
        });
  }

  private void notification(String id) {
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
          u.button(p.actions, "查看日程", true, () -> {
            if (self) {
              a.closePanels();
              a.calendarUi.person = "";
              a.navigate("view");
            } else new MemberWorkspace(r, false).open();
          });
          if (r.optBoolean("canReadLogs")) u.button(p.actions, "查看日志", false, () -> {
            if (self) loadAuthor(id);
            else new MemberWorkspace(r, true).open();
          });
          if (r.optBoolean("canSetHandoverPreset"))
            u.button(p.body, "设置交接预设", false, () -> a.tasksUi.preset(id));
        });
  }

  void requireReport(String reportId) throws Exception {
    JSONArray directory = arr(a.api.get("/me/reports"), "items");
    if (rows(directory).stream().noneMatch(person -> reportId.equals(id(person))))
      throw new IOException("当前无权查看此人的工作区。");
  }

  private final class MemberWorkspace {
    final String reportId;
    final CalendarUi calendar;
    JSONObject member;
    boolean logs;
    MainActivity.Panel panel;
    LinearLayout content;
    Button more;

    MemberWorkspace(JSONObject member, boolean logs) {
      this.member = member;
      this.logs = logs;
      reportId = id(member);
      calendar = new CalendarUi(a, reportId);
    }

    void open() {
      panel = a.panel(s(member, "displayName") + "的工作");
      u.button(panel.actions, "刷新", false, this::refresh);
      render();
    }

    void render() {
      panel.body.removeAllViews();
      u.note(panel.body, placement(member));
      LinearLayout tabs = u.row();
      panel.body.addView(tabs);
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
      panel.body.addView(content);
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
          return obj("person", latest, "data", a.api.get("/work-logs?scope=visible&authorId="
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
