package cn.pandora.mobile;

import static cn.pandora.mobile.Json.*;

import android.app.*;
import android.widget.*;
import java.time.*;
import java.util.*;
import java.util.function.*;
import org.json.*;

final class TasksUi {
  final MainActivity a;
  final Ui u;

  TasksUi(MainActivity a) {
    this.a = a;
    u = a.u;
  }

  void list() {
    MainActivity.Panel p = a.panel("全部授权任务");
    Spinner relation = u.spinner(p.body, "本人关系", new String[] {"全部关系", "我负责", "我创建", "仅可见"}, 0);
    Spinner state = u.spinner(p.body, "执行状态", new String[] {"全部", "待开始", "进行中", "已完成"}, 0);
    Spinner completion = u.spinner(p.body, "是否完成", new String[] {"全部", "未完成", "已完成"}, 0);
    Spinner priority = u.spinner(p.body, "紧急程度", new String[] {"全部", "紧急", "高", "中", "低"}, 0);
    EditText query = u.field(p.body, "搜索任务名称", "", 200, false);
    CheckBox range = new CheckBox(a);
    range.setText("按任务排期日期范围筛选");
    p.body.addView(range);
    LocalDateTime[] dates = {
      LocalDate.now(CalendarUi.ZONE).withDayOfMonth(1).atStartOfDay(),
      LocalDate.now(CalendarUi.ZONE).plusMonths(1).withDayOfMonth(1).minusDays(1).atStartOfDay()
    };
    u.dateTime(p.body, "日期范围起（忽略时刻）", dates, 0);
    u.dateTime(p.body, "日期范围止（忽略时刻）", dates, 1);
    Spinner sort =
        u.spinner(p.body, "排序字段", new String[] {"开始时间", "截止时间", "创建时间", "任务名称", "紧急程度", "执行状态"}, 0);
    Spinner direction = u.spinner(p.body, "排序方向", new String[] {"升序", "降序"}, 0);
    LinearLayout results = u.column();
    int[] page = {0};
    Runnable render =
        () -> {
          results.removeAllViews();
          List<JSONObject> filtered = new ArrayList<>();
          String[] codes = {"", "todo", "doing", "done"},
              levels = {"", "urgent", "high", "medium", "low"};
          if (range.isChecked() && dates[1].toLocalDate().isBefore(dates[0].toLocalDate())) {
            p.error.setText("结束日期不得早于开始日期。");
            return;
          }
          p.error.setText("");
          for (JSONObject t : rows(a.tasks)) {
            boolean own = contains(arr(t, "assigneeIds"), a.uid()),
                created = a.uid().equals(s(t, "originalCreatorId")),
                done = "done".equals(s(t, "executionState"));
            int r = relation.getSelectedItemPosition();
            if (r == 1 && !own || r == 2 && !created || r == 3 && (own || created)) continue;
            if (state.getSelectedItemPosition() > 0
                && !codes[state.getSelectedItemPosition()].equals(s(t, "executionState"))) continue;
            if (completion.getSelectedItemPosition() == 1 && done
                || completion.getSelectedItemPosition() == 2 && !done) continue;
            if (priority.getSelectedItemPosition() > 0
                && !levels[priority.getSelectedItemPosition()].equals(s(t, "priority"))) continue;
            if (!s(t, "title")
                .toLowerCase(Locale.ROOT)
                .contains(Ui.value(query).toLowerCase(Locale.ROOT))) continue;
            if (range.isChecked())
              try {
                LocalDate start =
                    t.optBoolean("allDay")
                        ? LocalDate.parse(s(t, "startDate"))
                        : Instant.parse(s(t, "startAt")).atZone(CalendarUi.ZONE).toLocalDate();
                LocalDate due =
                    t.optBoolean("allDay")
                        ? LocalDate.parse(s(t, "dueDate"))
                        : Instant.parse(s(t, "dueAt")).atZone(CalendarUi.ZONE).toLocalDate();
                if (due.isBefore(dates[0].toLocalDate()) || start.isAfter(dates[1].toLocalDate()))
                  continue;
              } catch (Exception e) {
                continue;
              }
            filtered.add(t);
          }
          Comparator<JSONObject> order =
              switch (sort.getSelectedItemPosition()) {
                case 1 -> Comparator.comparing(t -> s(t, "dueAt"));
                case 2 -> Comparator.comparing(t -> s(t, "createdAt"));
                case 3 -> Comparator.comparing(t -> s(t, "title"));
                case 4 ->
                    Comparator.comparingInt(
                        t -> List.of("urgent", "high", "medium", "low").indexOf(s(t, "priority")));
                case 5 ->
                    Comparator.comparingInt(
                        t -> List.of("todo", "doing", "done").indexOf(s(t, "executionState")));
                default -> Comparator.comparing(t -> s(t, "startAt"));
              };
          if (direction.getSelectedItemPosition() == 1) order = order.reversed();
          filtered.sort(order.thenComparing(Json::id));
          long
              own = filtered.stream().filter(t -> contains(arr(t, "assigneeIds"), a.uid())).count(),
              created =
                  filtered.stream().filter(t -> a.uid().equals(s(t, "originalCreatorId"))).count(),
              done = filtered.stream().filter(t -> "done".equals(s(t, "executionState"))).count(),
              pending =
                  filtered.stream().filter(t -> "complete".equals(s(t, "pendingKind"))).count();
          long visible =
              filtered.stream()
                  .filter(
                      t ->
                          !contains(arr(t, "assigneeIds"), a.uid())
                              && !a.uid().equals(s(t, "originalCreatorId")))
                  .count();
          long overdue = filtered.stream().filter(this::overdue).count();
          u.note(
              results,
              "共 "
                  + filtered.size()
                  + " 项 · 我负责 "
                  + own
                  + " · 我创建 "
                  + created
                  + " · 已完成 "
                  + done
                  + " · 待完成审核 "
                  + pending
                  + " · 仅可见 "
                  + visible
                  + " · 已逾期 "
                  + overdue);
          int total = Math.max(1, (filtered.size() + 19) / 20);
          page[0] = Math.min(page[0], total - 1);
          u.note(results, "第 " + (page[0] + 1) + " / " + total + " 页，每页20项");
          for (JSONObject t :
              filtered.subList(page[0] * 20, Math.min(filtered.size(), (page[0] + 1) * 20)))
            taskItem(results, t);
          if (filtered.isEmpty()) u.note(results, "没有符合条件的任务");
        };
    u.button(
        p.body,
        "应用筛选与排序",
        true,
        () -> {
          page[0] = 0;
          render.run();
        });
    u.button(
        p.body,
        "清空筛选",
        false,
        () -> {
          relation.setSelection(0);
          state.setSelection(0);
          completion.setSelection(0);
          priority.setSelection(0);
          query.setText("");
          range.setChecked(false);
          sort.setSelection(0);
          direction.setSelection(0);
          page[0] = 0;
          render.run();
        });
    p.body.addView(results);
    u.button(
        p.body,
        "上一页",
        false,
        () -> {
          page[0] = Math.max(0, page[0] - 1);
          render.run();
        });
    u.button(
        p.body,
        "下一页",
        false,
        () -> {
          page[0]++;
          render.run();
        });
    render.run();
  }

  boolean overdue(JSONObject task) {
    try {
      return !"done".equals(s(task, "executionState"))
          && Instant.parse(s(task, "dueAt")).isBefore(Instant.now());
    } catch (Exception invalid) {
      return false;
    }
  }

  void taskItem(LinearLayout into, JSONObject t) {
    u.item(
        into,
        s(t, "title"),
        Json.state(s(t, "executionState"))
            + " · "
            + priority(t)
            + " · "
            + schedule(t)
            + (t.optBoolean("frozen") ? " · 审核中" : "")
            + (overdue(t) ? " · 已逾期" : ""),
        () -> detail(id(t)));
  }

  static String when(String value) {
    try {
      return Instant.parse(value)
          .atZone(CalendarUi.ZONE)
          .toLocalDateTime()
          .toString()
          .replace('T', ' ');
    } catch (Exception e) {
      return value;
    }
  }

  static String schedule(JSONObject t) {
    if (!t.optBoolean("allDay") && s(t, "startAt").isEmpty()) return "查看任务排期";
    return t.optBoolean("allDay")
        ? s(t, "startDate") + " 至 " + s(t, "dueDate") + " · 全天"
        : when(s(t, "startAt")) + " 至 " + when(s(t, "dueAt"));
  }

  void detail(String id) {
    a.run(
        () -> a.api.get("/tasks/" + ApiClient.q(id)),
        t -> {
          a.remember(t);
          if (s(t, "currentVersionId").isEmpty()) {
            String request = s(t, "pendingRequestId");
            if (request.isEmpty()) request = s(t, "latestRequestId");
            if (!request.isEmpty()) approval(request);
            else a.error("任务尚未发布。");
            return;
          }
          showDetail(t, false);
        });
  }

  void showDetail(JSONObject t, boolean historical) {
    MainActivity.Panel p = a.panel(historical ? "历史只读详情" : s(t, "title"));
    snapshot(p.body, t);
    if (historical && !s(t, "notice").isEmpty()) u.note(p.body, s(t, "notice"));
    if (t.optBoolean("frozen")) u.note(p.body, "任务有待审核申请，当前展示有效版本；审核结束前不能修改。");
    if (!historical) {
      u.note(p.body, "创建者：" + a.person(s(t, "originalCreatorId")));
      u.note(
          p.body, "审核人：" + (s(t, "reviewerId").isEmpty() ? "无需审核" : a.person(s(t, "reviewerId"))));
      route(p.body, child(t, "route"));
      if (!s(t, "parentTaskId").isEmpty())
        u.button(
                p.body,
                "上级任务" + (t.optBoolean("parentUnavailable") ? "（当前不可查看）" : ""),
                false,
                () -> detail(s(t, "parentTaskId")))
            .setEnabled(!t.optBoolean("parentUnavailable"));
      if (arr(t, "children").length() > 0) {
        u.heading(p.body, "子任务");
        for (JSONObject c : rows(arr(t, "children"))) taskItem(p.body, c);
        u.note(p.body, "父子任务独立推进，完成状态不会自动联动。");
      }
      if (!s(t, "parentTaskId").isEmpty())
        for (JSONObject sibling : rows(a.tasks))
          if (!id(t).equals(id(sibling)) && s(t, "parentTaskId").equals(s(sibling, "parentTaskId")))
            taskItem(p.body, sibling);
      records(p.body, arr(t, "records"));
      String taskId = id(t);
      boolean frozen = t.optBoolean("frozen") || t.optBoolean("pending"),
          creator = a.uid().equals(s(t, "originalCreatorId")),
          active = !"done".equals(s(t, "executionState"));
      if (!frozen && creator && active) u.button(p.actions, "编辑任务", true, () -> form(t, false));
      if (!frozen && active && contains(arr(t, "assigneeIds"), a.uid())) {
        u.button(p.body, "更新进展", false, () -> action(t, "progress"));
        u.button(p.body, "提交完成", false, () -> action(t, "complete"));
      }
      if (!frozen && creator && !active) u.button(p.body, "重开任务", false, () -> form(t, true));
      if (t.optBoolean("canHandover")) u.button(p.body, "专用交接", false, () -> handover(t));
      u.button(
          p.body,
          t.optBoolean("pinned") ? "取消置顶" : "置顶到我的月视图",
          false,
          () ->
              a.write(
                  "pin:" + taskId,
                  t.optBoolean("pinned") ? "DELETE" : "PUT",
                  "/tasks/" + ApiClient.q(taskId) + "/pin",
                  null,
                  null));
      if (!s(t, "pendingRequestId").isEmpty())
        u.button(p.body, "查看当前申请", false, () -> approval(s(t, "pendingRequestId")));
    }
  }

  void snapshot(LinearLayout body, JSONObject t) {
    if (!s(t, "createdAt").isEmpty()) u.note(body, "创建时间：" + when(s(t, "createdAt")));
    u.heading(body, s(t, "title"));
    u.note(body, "任务说明");
    body.addView(u.text(s(t, "description"), 16, Ui.INK));
    u.note(body, "完成标准");
    body.addView(u.text(s(t, "acceptanceCriteria"), 16, Ui.INK));
    u.note(body, "排期：" + schedule(t));
    u.note(body, "紧急程度：" + priority(t) + " · 执行状态：" + state(s(t, "executionState")));
    u.note(
        body,
        "负责人："
            + (arr(t, "assigneeIds").length() > 0
                ? a.people(arr(t, "assigneeIds"))
                : names(arr(t, "assignees"))));
    u.note(body, "当前进展：" + (s(t, "progressNote").isEmpty() ? "暂无" : s(t, "progressNote")));
  }

  private String names(JSONArray people) {
    List<String> names = new ArrayList<>();
    for (JSONObject p : rows(people)) names.add(s(p, "displayName"));
    return String.join("、", names);
  }

  void records(LinearLayout body, JSONArray records) {
    if (records.length() == 0) return;
    u.heading(body, "执行记录");
    for (JSONObject r : rows(records))
      u.item(
          body,
          s(r, "body"),
          kind(s(r, "kind"))
              + " · "
              + a.person(s(r, "authorId"))
              + " · "
              + when(s(r, "effectiveAt").isEmpty() ? s(r, "createdAt") : s(r, "effectiveAt")),
          null);
  }

  void route(LinearLayout body, JSONObject route) {
    a.remember(route);
    if (route.length() == 0) return;
    String reason = s(route, "reasonText");
    if (reason.isEmpty()) reason = s(route, "reason");
    u.note(body, "审核路线：" + reason);
    JSONArray path = arr(route, "path");
    if (path.length() > 0) u.note(body, a.people(path));
    if (!s(route, "basisAssigneeId").isEmpty())
      u.note(body, "路线依据人：" + a.person(s(route, "basisAssigneeId")));
  }

  private LocalDateTime time(JSONObject t, String key) {
    try {
      return Instant.parse(s(t, key)).atZone(CalendarUi.ZONE).toLocalDateTime();
    } catch (Exception e) {
      return LocalDateTime.now(CalendarUi.ZONE).withSecond(0).withNano(0);
    }
  }

  void form(JSONObject raw, boolean reopen) {
    boolean editing = raw != null;
    JSONObject t =
        editing && s(raw, "currentVersionId").isEmpty()
            ? child(raw, "proposedVersion")
            : raw == null ? new JSONObject() : raw;
    MainActivity.Panel p = a.panel(reopen ? "重开任务" : editing ? "编辑任务" : "创建任务");
    String slot = UUID.randomUUID().toString();
    EditText title = null, desc = null, criteria = null;
    Spinner urgency = null;
    List<String> owners = new ArrayList<>();
    for (int i = 0; i < arr(t, "assigneeIds").length(); i++)
      owners.add(arr(t, "assigneeIds").optString(i));
    if (!editing) owners.add(a.uid());
    String[] parent = {s(t, "parentTaskId")};
    boolean[] parentChanged = {false};
    if (!reopen) {
      title = u.field(p.body, "任务名称（必填，最多80字）", s(t, "title"), 80, false);
      desc = u.field(p.body, "任务说明（必填）", s(t, "description"), 5000, true);
      criteria = u.field(p.body, "完成标准（必填）", s(t, "acceptanceCriteria"), 2000, true);
      String[] priorities = {"urgent", "high", "medium", "low"};
      urgency =
          u.spinner(
              p.body,
              "紧急程度",
              new String[] {"紧急", "高", "中", "低"},
              Math.max(
                  0,
                  Arrays.asList(priorities)
                      .indexOf(s(t, "priority").isEmpty() ? "medium" : s(t, "priority"))));
      TextView selected = u.text("负责人：" + a.people(new JSONArray(owners)), 14, Ui.INK);
      p.body.addView(selected);
      u.button(
          p.body,
          "选择负责人",
          false,
          () ->
              a.run(
                  () -> a.api.get("/assignee-candidates"),
                  r ->
                      choosePeople(
                          "选择负责人",
                          arr(r, "items"),
                          owners,
                          () -> selected.setText("负责人：" + a.people(new JSONArray(owners))))));
      u.button(
          p.body,
          "查看审核路线预览",
          false,
          () -> {
            JSONObject body = obj("assigneeIds", new JSONArray(owners));
            if (editing && !s(raw, "currentVersionId").isEmpty())
              try {
                body.put("taskId", id(raw));
              } catch (JSONException ignored) {
              }
            a.run(
                () -> a.api.post("/tasks/reviewer-preview", body),
                r -> {
                  MainActivity.Panel route = a.panel("审核路线预览");
                  route(route.body, child(r, "route"));
                  u.note(
                      route.body,
                      r.optBoolean("requiresApproval")
                          ? "审核人：" + a.person(s(r, "reviewerId"))
                          : "该路线无需审核，提交后直接生效。");
                });
          });
      TextView parentLabel =
          u.text("上级任务：" + (parent[0].isEmpty() ? "无" : s(a.task(parent[0]), "title")), 14, Ui.INK);
      p.body.addView(parentLabel);
      u.button(
          p.body,
          "选择上级任务",
          false,
          () ->
              chooseTask(
                  editing ? id(raw) : "",
                  parent[0],
                  choice -> {
                    parent[0] = choice;
                    parentChanged[0] = true;
                    parentLabel.setText(
                        "上级任务：" + (choice.isEmpty() ? "无" : s(a.task(choice), "title")));
                  }));
    }
    CheckBox allDay = new CheckBox(a);
    allDay.setText("全天任务");
    allDay.setChecked(t.optBoolean("allDay"));
    p.body.addView(allDay);
    LocalDateTime start = time(t, "startAt"), due = time(t, "dueAt");
    if (t.optBoolean("allDay")) {
      try {
        start = LocalDate.parse(s(t, "startDate")).atTime(9, 0);
        due = LocalDate.parse(s(t, "dueDate")).atTime(18, 0);
      } catch (Exception ignored) {
      }
    }
    if (!editing) due = start.plusDays(1).withHour(18).withMinute(0);
    LocalDateTime[] dates = {start, due};
    u.dateTime(p.body, "开始", dates, 0);
    u.dateTime(p.body, "截止", dates, 1);
    u.note(p.body, "全天任务仅使用日期，截止时刻遵循公司的下班时间设置。");
    EditText reason =
        editing ? u.field(p.body, reopen ? "重开原因（必填）" : "变更原因（必填）", "", 500, true) : null;
    final EditText fTitle = title, fDesc = desc, fCriteria = criteria;
    final Spinner fUrgency = urgency;
    u.button(
        p.actions,
        reopen ? "提交重开" : editing ? "提交变更" : "提交任务",
        true,
        () -> {
          if (editing && Ui.value(reason).isEmpty()) {
            p.error.setText("请填写原因。");
            return;
          }
          if (!reopen
              && (Ui.value(fTitle).isEmpty()
                  || Ui.value(fDesc).isEmpty()
                  || Ui.value(fCriteria).isEmpty()
                  || owners.isEmpty())) {
            p.error.setText("请填写名称、说明、完成标准，并选择负责人。");
            return;
          }
          if (dates[1].isBefore(dates[0])
              && (!allDay.isChecked() || dates[1].toLocalDate().isBefore(dates[0].toLocalDate()))) {
            p.error.setText("截止不得早于开始。");
            return;
          }
          JSONObject body = obj("allDay", allDay.isChecked());
          try {
            if (allDay.isChecked()) {
              body.put("startDate", dates[0].toLocalDate().toString());
              body.put("dueDate", dates[1].toLocalDate().toString());
            } else {
              body.put("startAt", dates[0].atZone(CalendarUi.ZONE).toInstant().toString());
              body.put("dueAt", dates[1].atZone(CalendarUi.ZONE).toInstant().toString());
            }
            if (reopen) body.put("command", "reopen");
            else {
              body.put("title", Ui.value(fTitle));
              body.put("description", Ui.value(fDesc));
              body.put("acceptanceCriteria", Ui.value(fCriteria));
              body.put(
                  "priority",
                  new String[] {"urgent", "high", "medium", "low"}
                      [fUrgency.getSelectedItemPosition()]);
              body.put("assigneeIds", new JSONArray(owners));
              if (!t.optBoolean("parentUnavailable") || parentChanged[0])
                body.put("parentTaskId", parent[0].isEmpty() ? JSONObject.NULL : parent[0]);
              if (editing)
                body.put("command", s(raw, "currentVersionId").isEmpty() ? "create" : "change");
            }
            if (editing) body.put("reason", Ui.value(reason));
          } catch (JSONException e) {
            a.error(e.getMessage());
            return;
          }
          a.write(
              slot,
              editing ? "PATCH" : "POST",
              "/tasks" + (editing ? "/" + ApiClient.q(id(raw)) : ""),
              body,
              editing ? tag(raw) : null);
        });
  }

  void choosePeople(String title, JSONArray candidates, List<String> selected, Runnable done) {
    List<String> working = new ArrayList<>(selected);
    MainActivity.Panel panel = a.panel(title);
    LinearLayout results = u.column();
    u.search(
        panel.body,
        "搜索姓名或部门",
        query -> {
          results.removeAllViews();
          peopleChoices(results, candidates, working, query);
        });
    panel.body.addView(results);
    peopleChoices(results, candidates, working, "");
    u.button(
        panel.actions,
        "确定选择",
        true,
        () -> {
          selected.clear();
          selected.addAll(working);
          done.run();
          panel.dialog.dismiss();
        });
  }

  private void peopleChoices(
      LinearLayout into, JSONArray candidates, List<String> selected, String query) {
    for (JSONObject person : rows(candidates)) {
      if (!(s(person, "displayName") + s(person, "departmentName")).contains(query)) continue;
      CheckBox check = new CheckBox(a);
      String personId = id(person);
      check.setText(s(person, "displayName") + " · " + s(person, "departmentName"));
      check.setMinHeight(u.dp(48));
      check.setChecked(selected.contains(personId));
      check.setOnCheckedChangeListener(
          (b, on) -> {
            if (on && !selected.contains(personId)) selected.add(personId);
            if (!on) selected.remove(personId);
          });
      into.addView(check);
    }
  }

  void chooseTask(String exclude, String current, Consumer<String> done) {
    MainActivity.Panel p = a.panel("选择关联任务");
    LinearLayout results = u.column();
    Consumer<String> render =
        query -> {
          results.removeAllViews();
          u.button(
              results,
              "不关联任务",
              false,
              () -> {
                done.accept("");
                p.dialog.dismiss();
              });
          for (JSONObject t : rows(a.tasks)) {
            if (id(t).equals(exclude)
                || descendant(id(t), exclude)
                || !s(t, "title").contains(query)) continue;
            u.item(
                results,
                s(t, "title"),
                state(s(t, "executionState")),
                () -> {
                  done.accept(id(t));
                  p.dialog.dismiss();
                });
          }
        };
    u.search(p.body, "搜索任务名称", render);
    p.body.addView(results);
    render.accept("");
  }

  private boolean descendant(String id, String ancestor) {
    if (ancestor.isEmpty()) return false;
    Set<String> visited = new HashSet<>();
    while (!id.isEmpty() && visited.add(id)) {
      id = s(a.task(id), "parentTaskId");
      if (id.equals(ancestor)) return true;
    }
    return false;
  }

  void action(JSONObject task, String command) {
    MainActivity.Panel p = a.panel(kind(command));
    EditText note =
        u.field(p.body, command.equals("complete") ? "完成说明（必填）" : "进展备注（必填）", "", 2000, true);
    String slot = UUID.randomUUID().toString();
    u.button(
        p.actions,
        "提交",
        true,
        () -> {
          if (Ui.value(note).isEmpty()) {
            p.error.setText("请填写说明。");
            return;
          }
          a.write(
              slot,
              "PATCH",
              "/tasks/" + ApiClient.q(id(task)),
              obj(
                  "command",
                  command,
                  command.equals("complete") ? "completionNote" : "progressNote",
                  Ui.value(note)),
              tag(task));
        });
  }

  void approvals(String scope) {
    a.run(
        () -> a.api.all("/approval-requests?mine=" + scope),
        rows -> {
          MainActivity.Panel p =
              a.panel(
                  scope.equals("reviewer") ? "待我审核" : scope.equals("applicant") ? "我的申请" : "全部申请");
          if (rows.length() == 0) u.note(p.body, "暂无申请");
          for (JSONObject r : Json.rows(rows)) {
            if (scope.equals("reviewer") && !"pending".equals(s(r, "status"))) continue;
            u.item(
                p.body,
                s(r, "title"),
                kind(s(r, "kind"))
                    + " · "
                    + state(s(r, "status"))
                    + " · "
                    + when(s(r, "createdAt")),
                () -> approval(s(r, "requestId").isEmpty() ? s(r, "id") : s(r, "requestId")));
          }
        });
  }

  void approval(String id) {
    a.run(
        () -> a.api.get("/approval-requests/" + ApiClient.q(id)),
        r -> {
          a.remember(r);
          MainActivity.Panel p = a.panel("申请详情");
          u.heading(p.body, s(r, "title"));
          u.note(p.body, kind(s(r, "kind")) + " · " + state(s(r, "status")));
          u.note(
              p.body,
              "申请人："
                  + a.person(s(r, "applicantId"))
                  + " · 审核人："
                  + a.person(s(r, "currentReviewerId")));
          u.note(p.body, "适用截止：" + when(s(r, "applicableDeadline")));
          if (!s(r, "comment").isEmpty()) u.note(p.body, "审核意见：" + s(r, "comment"));
          snapshot(p.body, child(r, "proposedVersion"));
          if (r.has("baseVersion") && !r.isNull("baseVersion"))
            u.button(
                p.body,
                "查看申请前有效版本",
                false,
                () -> {
                  MainActivity.Panel base = a.panel("申请前有效版本");
                  snapshot(base.body, child(r, "baseVersion"));
                });
          if (!s(r, "exemptionReason").isEmpty()) u.note(p.body, "免审原因：" + s(r, "exemptionReason"));
          route(p.body, child(r, "route"));
          if (arr(r, "diff").length() > 0) {
            u.heading(p.body, "有效版本与申请差异");
            for (JSONObject diff : rows(arr(r, "diff")))
              u.item(
                  p.body,
                  fieldName(s(diff, "field")),
                  s(diff, "before") + " → " + s(diff, "after"),
                  null);
          }
          records(p.body, arr(r, "records"));
          if ("pending".equals(s(r, "status"))) {
            if (a.uid().equals(s(r, "currentReviewerId"))) {
              decisionButton(p, r, id, "approve", "通过申请");
              decisionButton(p, r, id, "reject", "退回申请");
            }
            if (a.uid().equals(s(r, "applicantId"))) decisionButton(p, r, id, "withdraw", "撤销申请");
          } else if (a.uid().equals(s(r, "applicantId"))
              && "create".equals(s(r, "kind"))
              && List.of("rejected", "withdrawn").contains(s(r, "status")))
            u.button(
                p.body,
                "编辑任务并重新提交",
                true,
                () ->
                    a.run(
                        () -> a.api.get("/tasks/" + ApiClient.q(s(r, "taskId"))),
                        t -> form(t, false)));
        });
  }

  private String fieldName(String field) {
    return switch (field) {
      case "title" -> "任务名称";
      case "description" -> "任务说明";
      case "acceptanceCriteria" -> "完成标准";
      case "assigneeIds" -> "负责人";
      case "startAt", "startDate" -> "开始时间";
      case "dueAt", "dueDate" -> "截止时间";
      case "priority" -> "紧急程度";
      case "parentTaskId" -> "上级任务";
      default -> field;
    };
  }

  private void decisionButton(
      MainActivity.Panel panel, JSONObject request, String id, String decision, String label) {
    u.button(
        panel.body,
        label,
        decision.equals("approve"),
        () -> {
          MainActivity.Panel p = a.panel(label);
          EditText comment =
              u.field(p.body, decision.equals("reject") ? "退回意见（必填）" : "说明（选填）", "", 2000, true);
          String slot = UUID.randomUUID().toString();
          u.button(
              p.actions,
              "确认" + label,
              true,
              () -> {
                if (decision.equals("reject") && Ui.value(comment).isEmpty()) {
                  p.error.setText("退回申请须填写意见。");
                  return;
                }
                a.write(
                    slot,
                    "PATCH",
                    "/approval-requests/" + ApiClient.q(id),
                    obj("decision", decision, "comment", Ui.value(comment)),
                    tag(request));
              });
        });
  }

  void handover(JSONObject t) {
    JSONArray sources = arr(t, "handoverSources");
    if (sources.length() == 0) {
      a.error("当前没有可以交接的负责人。");
      return;
    }
    MainActivity.Panel p = a.panel("专用交接");
    u.note(p.body, "交接只替换一个负责人位置，审核通过后生效。");
    for (int i = 0; i < sources.length(); i++) {
      Object source = sources.opt(i);
      String sourceId =
          source instanceof JSONObject ? s((JSONObject) source, "id") : String.valueOf(source);
      u.button(
          p.body,
          "交接 " + a.person(sourceId) + " 的负责位置",
          false,
          () ->
              a.run(
                  () -> a.api.get("/handover-targets?subjectId=" + ApiClient.q(sourceId)),
                  r -> {
                    MainActivity.Panel choose = a.panel("交接对象");
                    List<JSONObject> candidates = rows(arr(r, "items"));
                    if (candidates.isEmpty()) {
                      u.note(choose.body, "暂无合法交接对象");
                      return;
                    }
                    String[] names =
                        candidates.stream()
                            .map(v -> s(v, "displayName") + " · " + s(v, "departmentName"))
                            .toArray(String[]::new);
                    int defaultTarget = 0;
                    for (int ci = 0; ci < candidates.size(); ci++)
                      if (id(candidates.get(ci)).equals(s(child(t, "handoverPresets"), sourceId)))
                        defaultTarget = ci;
                    Spinner target = u.spinner(choose.body, "交接对象", names, defaultTarget);
                    u.button(
                        choose.body,
                        "保存为该人员的交接预设",
                        false,
                        () ->
                            a.run(
                                () ->
                                    a.api.mutate(
                                        "preset-from-handover:" + sourceId,
                                        "PUT",
                                        "/users/" + ApiClient.q(sourceId) + "/handover-preset",
                                        obj(
                                            "targetUserId",
                                            id(candidates.get(target.getSelectedItemPosition()))),
                                        null),
                                v -> a.toast("交接预设已保存")));
                    EditText reason = u.field(choose.body, "交接原因", "", 500, true);
                    String slot = UUID.randomUUID().toString();
                    u.button(
                        choose.actions,
                        "提交交接",
                        true,
                        () ->
                            a.write(
                                slot,
                                "POST",
                                "/tasks/" + ApiClient.q(id(t)) + "/handover",
                                obj(
                                    "sourceUserId",
                                    sourceId,
                                    "targetUserId",
                                    id(candidates.get(target.getSelectedItemPosition())),
                                    "reason",
                                    Ui.value(reason).isEmpty() ? "专用交接" : Ui.value(reason)),
                                tag(t)));
                  }));
    }
  }

  void preset(String subject) {
    a.run(
        () ->
            obj(
                "preset",
                a.api.get("/users/" + ApiClient.q(subject) + "/handover-preset"),
                "targets",
                a.api.get("/handover-targets?subjectId=" + ApiClient.q(subject))),
        r -> {
          MainActivity.Panel p = a.panel("交接预设");
          JSONObject preset = child(r, "preset");
          List<JSONObject> targets = rows(arr(child(r, "targets"), "items"));
          u.note(p.body, "预设仅用于专用交接申请，实际交接仍按新路线审核。");
          if (!s(preset, "targetUserId").isEmpty())
            u.note(p.body, "当前预设：" + s(child(preset, "target"), "displayName"));
          if (!targets.isEmpty()) {
            Spinner target =
                u.spinner(
                    p.body,
                    "预设交接对象",
                    targets.stream().map(v -> s(v, "displayName")).toArray(String[]::new),
                    0);
            u.button(
                p.actions,
                "保存预设",
                true,
                () ->
                    a.write(
                        "preset:" + subject,
                        "PUT",
                        "/users/" + ApiClient.q(subject) + "/handover-preset",
                        obj("targetUserId", id(targets.get(target.getSelectedItemPosition()))),
                        null));
          } else u.note(p.body, "没有可用的交接对象");
          if (!s(preset, "targetUserId").isEmpty())
            u.button(
                p.body,
                "清除预设",
                false,
                () ->
                    a.write(
                        "preset-clear:" + subject,
                        "DELETE",
                        "/users/" + ApiClient.q(subject) + "/handover-preset",
                        null,
                        null));
        });
  }
}
