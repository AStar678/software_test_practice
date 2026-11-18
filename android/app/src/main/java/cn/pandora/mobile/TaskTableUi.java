package cn.pandora.mobile;

import static cn.pandora.mobile.Json.*;

import android.app.AlertDialog;
import android.graphics.Typeface;
import android.os.Handler;
import android.os.Looper;
import android.text.Editable;
import android.text.InputFilter;
import android.text.TextWatcher;
import android.view.Gravity;
import android.view.View;
import android.widget.*;
import java.time.LocalDate;
import java.util.List;
import org.json.JSONObject;

/** The company task table uses the server's authorized, sorted and paginated task set. */
final class TaskTableUi {
  private static final int PAGE_SIZE = 20;
  private static final String[] SORT_KEYS = {"startAt", "dueAt", "title", "createdAt", "priority", "state"};
  private static final String[] SORT_LABELS = {"开始时间", "截止时间", "任务名称", "创建时间", "紧急程度", "执行状态"};

  private final MainActivity a;
  private final Ui u;
  private final Handler timer = new Handler(Looper.getMainLooper());
  private final Runnable query = this::request;
  private EditText name;
  private TableLayout rows;
  private ScrollView vertical;
  private Button prev, next;
  private TextView pager, message;
  private int page, generation;
  private boolean desc;
  private String relation = "all", completion = "all", sort = "startAt";
  private LocalDate from, to;
  private JSONObject result;

  TaskTableUi(MainActivity activity) { a = activity; u = a.u; }

  void show() {
    a.taskTable = this;
    LinearLayout root = a.fixedPage("公司");
    LinearLayout heading = u.row();
    heading.addView(button("返回日历", () -> a.navigate("view")), new LinearLayout.LayoutParams(-2, u.dp(48)));
    TextView title = u.text("任务表单", 20, Ui.INK);
    title.setTypeface(null, Typeface.BOLD);
    title.setPadding(u.dp(10), 0, 0, 0);
    heading.addView(title);
    root.addView(heading);
    LinearLayout search = u.row();
    name = new EditText(a);
    name.setTextSize(15);
    name.setSingleLine(true);
    u.configureKeyboard(name, false);
    name.setHint("搜索任务名称");
    name.setContentDescription("搜索任务名称");
    name.setFilters(new InputFilter[] {new InputFilter.LengthFilter(200)});
    name.setPadding(u.dp(10), 0, u.dp(10), 0);
    var input = u.shape(Ui.SURFACE, 12);
    input.setStroke(u.dp(1), Ui.LINE);
    name.setBackground(input);
    search.addView(name, new LinearLayout.LayoutParams(0, u.dp(42), 1));
    search.addView(button("筛选", this::filters), new LinearLayout.LayoutParams(u.dp(58), u.dp(48)));
    root.addView(search);
    root.setFocusableInTouchMode(true);
    root.requestFocus();
    name.addTextChangedListener(new TextWatcher() {
      @Override public void beforeTextChanged(CharSequence s, int start, int count, int after) {}
      @Override public void onTextChanged(CharSequence s, int start, int before, int count) { changed(); }
      @Override public void afterTextChanged(Editable s) {}
    });

    message = u.text("", 13, Ui.ERROR);
    root.addView(message);
    message.setVisibility(View.GONE);
    TableLayout head = new TableLayout(a);
    TableRow columns = new TableRow(a);
    columns.setBackgroundColor(Ui.CONTAINER);
    tableCell(columns, "任务", 39, true);
    tableCell(columns, "负责人", 18, true);
    tableCell(columns, "状态", 17, true);
    tableCell(columns, "排期", 26, true);
    head.addView(columns, new TableLayout.LayoutParams(-1, -2));
    root.addView(head);
    vertical = new ScrollView(a);
    vertical.setFillViewport(true);
    rows = new TableLayout(a);
    vertical.addView(rows);
    root.addView(vertical, new LinearLayout.LayoutParams(-1, 0, 1));

    LinearLayout controls = u.row();
    pager = u.text("", 12, Ui.MUTED);
    controls.addView(pager, new LinearLayout.LayoutParams(0, -2, 1));
    prev = button("上一页", () -> { if (page > 0) { page--; refresh(); } });
    next = button("下一页", () -> { if (next.isEnabled()) { page++; refresh(); } });
    controls.addView(prev, new LinearLayout.LayoutParams(u.dp(64), u.dp(46)));
    controls.addView(next, new LinearLayout.LayoutParams(u.dp(64), u.dp(46)));
    root.addView(controls);
    render();
    request();
  }

  private Button button(String text, Runnable action) {
    Button b = new Button(a);
    b.setText(text);
    b.setAllCaps(false);
    b.setTextSize(13);
    b.setTextColor(Ui.PRIMARY);
    b.setMinimumWidth(0);
    b.setMinWidth(0);
    b.setPadding(u.dp(4), 0, u.dp(4), 0);
    b.setBackground(u.shape(Ui.SURFACE, 10));
    b.setStateListAnimator(null);
    b.setOnClickListener(v -> { if (!a.busy) action.run(); });
    return b;
  }

  private void filters() {
    MainActivity.Panel panel = a.panel("筛选", 1, .76f, Gravity.BOTTOM, "关闭");
    String[] relations = {"all", "assigned", "created"}, completions = {"all", "unfinished", "completed"};
    Spinner r = u.spinner(panel.body, "关系", new String[] {"全部", "我负责", "我创建"},
        List.of(relations).indexOf(relation));
    Spinner c = u.spinner(panel.body, "完成", new String[] {"全部", "未完成", "已完成"},
        List.of(completions).indexOf(completion));
    Spinner order = u.spinner(panel.body, "排序字段", SORT_LABELS, List.of(SORT_KEYS).indexOf(sort));
    Spinner direction = u.spinner(panel.body, "排序方向", new String[] {"升序", "降序"}, desc ? 1 : 0);
    LocalDate[] dates = {from, to};
    for (int i = 0; i < dates.length; i++) {
      int index = i;
      String label = i == 0 ? "日期从" : "日期至";
      LinearLayout line = u.row();
      panel.body.addView(line);
      Button date = button(filterDateLabel(label, dates[index]), () -> {
        LocalDate initial = dates[index] == null ? a.workspaceUi.businessDate() : dates[index];
        u.dates.date(label, initial, false, chosen -> {
          dates[index] = chosen;
          Button control = line.findViewWithTag(label);
          control.setText(filterDateLabel(label, chosen));
        });
      });
      date.setTag(label);
      line.addView(date, new LinearLayout.LayoutParams(0, u.dp(48), 1));
      line.addView(button("设为不限", () -> {
        dates[index] = null;
        date.setText(filterDateLabel(label, null));
      }), new LinearLayout.LayoutParams(u.dp(86), u.dp(48)));
    }
    u.button(panel.actions, "应用筛选", true, () -> {
      if (dates[0] != null && dates[1] != null && dates[1].isBefore(dates[0])) {
        panel.error.setText("结束日期不得早于开始日期。");
        return;
      }
      relation = relations[r.getSelectedItemPosition()];
      completion = completions[c.getSelectedItemPosition()];
      sort = SORT_KEYS[order.getSelectedItemPosition()];
      desc = direction.getSelectedItemPosition() == 1;
      from = dates[0]; to = dates[1];
      panel.dialog.dismiss();
      page = 0;
      refresh();
    });
    u.button(panel.actions, "清空筛选", false, () -> {
      relation = "all"; completion = "all"; from = null; to = null;
      name.setText("");
      panel.dialog.dismiss();
      page = 0;
      refresh();
    });
  }

  private String filterDateLabel(String label, LocalDate date) {
    return label + "　" + (date == null ? "不限" : date.toString());
  }

  private void changed() {
    page = 0;
    generation++;
    timer.removeCallbacks(query);
    timer.postDelayed(query, 220);
  }

  void refresh() {
    generation++;
    timer.removeCallbacks(query);
    request();
  }

  private void request() {
    if (a.taskTable != this || a.destroyed) return;
    if (a.busy) { timer.postDelayed(query, 140); return; }
    int revision = generation;
    String path = "/tasks/table?relation=" + relation + "&completion=" + completion + "&sort=" + sort
        + "&direction=" + (desc ? "desc" : "asc") + "&limit=" + PAGE_SIZE + "&offset=" + page * PAGE_SIZE
        + "&q=" + ApiClient.q(Ui.value(name)) + (from == null ? "" : "&from=" + from)
        + (to == null ? "" : "&to=" + to);
    message.setVisibility(View.GONE);
    a.run(() -> a.api.get(path), data -> {
      if (a.taskTable != this || revision != generation) return;
      int last = Math.max(0, (data.optInt("total") - 1) / PAGE_SIZE);
      if (page > last) { page = last; refresh(); return; }
      result = data;
      render();
      vertical.scrollTo(0, 0);
    }, error -> {
      if (a.taskTable != this || revision != generation) return;
      result = null;
      render();
      message.setText(error + "　点击重试");
      message.setVisibility(View.VISIBLE);
      message.setOnClickListener(v -> refresh());
    });
  }

  private void render() {
    rows.removeAllViews();
    List<JSONObject> items = rows(arr(result, "items"));
    int index = 0;
    for (JSONObject task : items) renderRow(task, index++);
    if (result != null && items.isEmpty()) {
      TextView empty = u.text("没有符合条件的任务", 14, Ui.MUTED);
      empty.setPadding(u.dp(8), u.dp(18), 0, 0);
      rows.addView(empty);
    }
    int total = result == null ? 0 : result.optInt("total");
    int end = page * PAGE_SIZE + items.size();
    pager.setText(total == 0 ? "共 0 条" : (page * PAGE_SIZE + 1) + "–" + end + " 条 / 共 " + total
        + " 条 · " + (page + 1) + "/" + ((total - 1) / PAGE_SIZE + 1) + " 页");
    prev.setEnabled(page > 0);
    next.setEnabled(end < total);
    prev.setAlpha(prev.isEnabled() ? 1f : .45f);
    next.setAlpha(next.isEnabled() ? 1f : .45f);
  }

  private void renderRow(JSONObject task, int index) {
    a.remember(task);
    TableRow row = new TableRow(a);
    row.setGravity(Gravity.CENTER_VERTICAL);
    int color = index % 2 == 0 ? Ui.SURFACE : 0xfffcf5fa;
    row.setBackground(new android.graphics.drawable.RippleDrawable(
        android.content.res.ColorStateList.valueOf(0x22a34470), u.shape(color, 0), null));

    String title = (task.optBoolean("tablePinned") ? "★ " : "") + s(task, "title");
    boolean assigned = contains(arr(task, "assigneeIds"), a.uid());
    boolean created = a.uid().equals(s(task, "originalCreatorId"));
    String relation = assigned && created ? "我创建、我负责" : assigned ? "我负责" : created ? "我创建" : "";
    TextView name = tableCell(row, title + (relation.isEmpty() ? "" : "\n" + relation), 39, false);
    name.setTextColor(Ui.PRIMARY);
    tableCell(row, a.people(arr(task, "assigneeIds")), 18, false);
    String stateText = state(s(task, "executionState")) + "\n" + priority(task);
    if (task.optBoolean("frozen")) stateText += "\n待审";
    if (a.tasksUi.overdue(task)) stateText += "\n逾期";
    tableCell(row, stateText, 17, false);

    boolean allDay = task.optBoolean("allDay");
    String start = allDay ? s(task, "startDate") : TasksUi.whenMinute(s(task, "startAt"));
    String due = allDay ? s(task, "dueDate") : TasksUi.whenMinute(s(task, "dueAt"));
    String schedule = displayDate(start) + (start.equals(due) ? "" : "\n" + displayDate(due));
    tableCell(row, schedule + (allDay ? "\n全天" : ""), 26, false);
    row.setMinimumHeight(u.dp(66));
    row.setFocusable(true);
    row.setOnClickListener(v -> { if (!a.busy) a.tasksUi.detail(id(task)); });
    if (task.optBoolean("canTablePin")) {
      row.setOnLongClickListener(v -> {
        if (!a.busy) pin(task);
        return true;
      });
    }
    rows.addView(row, new TableLayout.LayoutParams(-1, -2));
    View line = new View(a);
    line.setBackgroundColor(Ui.LINE);
    rows.addView(line, new TableLayout.LayoutParams(-1, u.dp(1)));
  }

  private TextView tableCell(TableRow row, String value, int weight, boolean heading) {
    TextView cell = u.text(value.isBlank() ? "—" : value, heading ? 13 : 12, Ui.INK);
    cell.setTextIsSelectable(false);
    cell.setPadding(u.dp(6), u.dp(9), u.dp(4), u.dp(9));
    if (heading) {
      cell.setTypeface(null, Typeface.BOLD);
      if (android.os.Build.VERSION.SDK_INT >= 28) cell.setAccessibilityHeading(true);
    }
    row.addView(cell, new TableRow.LayoutParams(0, -2, weight));
    return cell;
  }

  private String displayDate(String value) {
    if (value.length() < 10) return value;
    String day = value.substring(5, 10).replace('-', '/');
    String organizationYear = String.valueOf(a.workspaceUi.businessDate().getYear());
    if (!value.startsWith(organizationYear + "-")) day = value.substring(0, 4) + "/" + day;
    return value.length() >= 16 ? day + " " + value.substring(11, 16) : day;
  }

  private void pin(JSONObject task) {
    boolean pinned = task.optBoolean("tablePinned");
    String label = pinned ? "取消表单置顶" : "置顶到任务表单";
    new AlertDialog.Builder(a).setTitle(s(task, "title")).setItems(new String[] {label}, (d, i) -> {
      String id = id(task);
      a.run(() -> a.api.mutate("table-pin:" + id, pinned ? "DELETE" : "PUT",
          "/tasks/" + ApiClient.q(id) + "/table-pin", null, null), result -> refresh());
    }).setNegativeButton("取消", null).show();
  }

}
