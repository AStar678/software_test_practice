package cn.pandora.mobile;

import static cn.pandora.mobile.Json.*;

import android.app.*;
import android.graphics.*;
import android.view.*;
import android.widget.*;
import java.time.*;
import java.time.temporal.TemporalAdjusters;
import java.util.*;
import org.json.*;

final class CalendarUi {
  static ZoneId ZONE = ZoneId.of("Asia/Shanghai");
  private final MainActivity a;
  private final Ui u;
  LocalDate date;
  String person = "";
  boolean day = false;
  int dayMode = 0;
  int capacity = 3;
  private ListView monthList;
  private Integer monthOffset;
  private boolean restoring;
  private static final int MONTH_LANE = 40;
  private LocalDate monthReturnDate;
  private Integer monthReturnOffset;
  private static final int STREAM_MIDDLE = 1200;
  private static final String[] WEEK = {"一", "二", "三", "四", "五", "六", "日"};
  private final String reportId;
  private JSONArray reportTasks = new JSONArray();
  private Runnable reloadWorkspace;


  CalendarUi(MainActivity a) {
    this(a, null);
  }

  CalendarUi(MainActivity a, String reportId) {
    this.a = a;
    this.reportId = reportId;
    u = a.u;
    if (reportId != null) {
      person = reportId;
      date = a.workspaceUi.businessDate();
    }
  }

  void reset() {
    person = "";
    date = null;
    day = false;
    dayMode = 0;
    capacity = 3;
    monthList = null;
    monthOffset = null;
    monthReturnDate = null;
    monthReturnOffset = null;
  }

  void show() {
    if (date == null) date = a.workspaceUi.businessDate();
    LinearLayout root = day ? a.page("公司") : a.fixedPage("公司");
    if (!day) root.setPadding(0, 0, 0, 0);
    render(root);
    a.floatingCreate(() -> a.tasksUi.form(null, false, day ? date : null));
  }

  void showWorkspace(LinearLayout box, JSONArray tasks, Runnable reload) {
    reportTasks = tasks;
    reloadWorkspace = reload;
    render(box);
  }

  private void refreshView() {
    if (reloadWorkspace != null) reloadWorkspace.run();
    else show();
  }

  private void render(LinearLayout box) {
    LinearLayout row = u.row();
    row.setPadding(u.dp(8), 0, u.dp(8), 0);
    if (day) {
      Button back = toolbarButton("‹ 返回", "返回月历", this::returnToMonth);
      row.addView(back, new LinearLayout.LayoutParams(u.dp(57), u.dp(48)));
    }
    Button pick = toolbarButton(monthTitle(YearMonth.from(date)) + " ⌄", "选择年月", this::pickDate);
    pick.setTextColor(Ui.INK);
    pick.setTextSize(18);
    pick.setTypeface(null, Typeface.BOLD);
    pick.setSingleLine(true);
    if (android.os.Build.VERSION.SDK_INT >= 26) pick.setAutoSizeTextTypeUniformWithConfiguration(
        11, 20, 1, android.util.TypedValue.COMPLEX_UNIT_SP);
    row.addView(pick, new LinearLayout.LayoutParams(0, u.dp(58), 1));
    row.addView(toolbarButton("‹", day ? "上一天" : "上一月",
        () -> go(day ? date.minusDays(1) : date.minusMonths(1))),
        new LinearLayout.LayoutParams(u.dp(32), u.dp(48)));
    row.addView(toolbarButton("今天", "今天", () -> go(a.workspaceUi.businessDate())),
        new LinearLayout.LayoutParams(u.dp(45), u.dp(48)));
    row.addView(toolbarButton("›", day ? "下一天" : "下一月",
        () -> go(day ? date.plusDays(1) : date.plusMonths(1))),
        new LinearLayout.LayoutParams(u.dp(32), u.dp(48)));
    if (reportId == null)
      row.addView(toolbarButton("任务表单", "任务表单", () -> new TaskTableUi(a).show()),
          new LinearLayout.LayoutParams(u.dp(75), u.dp(48)));
    box.addView(row);
    if (!day && reportId == null) {
      renderMonthStream(box, pick);
      return;
    }
    if (day) {
      LinearLayout strip = u.row();
      LocalDate monday = date.with(TemporalAdjusters.previousOrSame(DayOfWeek.MONDAY));
      for (int i = 0; i < 7; i++) {
        LocalDate selected = monday.plusDays(i);
        Button b = toolbarButton(WEEK[i] + "\n" + selected.getDayOfMonth(),
            selected + " 星期" + WEEK[i], () -> go(selected));
        b.setSelected(date.equals(selected));
        if (date.equals(selected)) b.setBackground(u.shape(Ui.CONTAINER, 12));
        strip.addView(b, new LinearLayout.LayoutParams(0, u.dp(56), 1));
      }
      box.addView(strip);
    }
    if (day) {
      LinearLayout modes = u.row();
      String[] labels = {"横向排期", "纵向时间轴", "任务清单"};
      for (int i = 0; i < labels.length; i++) {
        int mode = i;
        nativeButton(modes, labels[i], () -> { dayMode = mode; refreshView(); });
        Button button = (Button) modes.getChildAt(i);
        button.setSelected(mode == dayMode);
        if (mode == dayMode) button.setBackground(u.shape(Ui.CONTAINER, 13));
      }
      box.addView(modes);
      if (dayMode == 2) {
        renderDayList(box, date);
      } else {
        u.heading(box, "全天任务");
        boolean any = false;
        for (JSONObject t : visible()) if (fullDay(t, date) && hits(t, date)) {
          taskItem(box, t);
          any = true;
        }
        if (!any) u.note(box, "无全天任务");
        if (dayMode == 0) {
          HorizontalScrollView timeline = new HorizontalScrollView(a);
          timeline.setContentDescription("横向排期，左右滚动浏览 00:00 至 24:00");
          timeline.addView(new DayCanvas(), new FrameLayout.LayoutParams(u.dp(24 * 56 + 16), -2));
          box.addView(timeline);
          timeline.post(() -> timeline.scrollTo(u.dp(7 * 56), 0));
        } else {
          box.addView(new VerticalDayCanvas());
        }
      }
    } else {
      addWeekHeader(box);
      box.addView(new MonthCanvas(YearMonth.from(date)));
    }
  }

  private Button toolbarButton(String text, String description, Runnable click) {
    Button b = new Button(a);
    styleCalendarButton(b);
    b.setText(text);
    b.setTextSize(13);
    b.setContentDescription(description);
    b.setOnClickListener(v -> { if (!a.busy) click.run(); });
    return b;
  }

  private void dismissStreamOffset() { monthOffset = null; }

  private void go(LocalDate value) {
    date = value;
    dismissStreamOffset();
    refreshView();
  }

  private String monthTitle(YearMonth month) {
    return month.getYear() + "年" + month.getMonthValue() + "月";
  }

  private void pickDate() {
    u.dates.date(day ? "选择日期" : "选择年月", date, !day, this::go);
  }

  void returnToMonth() {
    day = false;
    if (monthReturnDate == null) monthOffset = null;
    else {
      date = monthReturnDate;
      monthOffset = monthReturnOffset;
    }
    monthReturnDate = null;
    monthReturnOffset = null;
    refreshView();
  }

  private void addWeekHeader(LinearLayout box) {
    LinearLayout row = u.row();
    for (String name : WEEK) {
      TextView label = u.text(name, 13, "六".equals(name) || "日".equals(name) ? Ui.PRIMARY : Ui.MUTED);
      label.setGravity(Gravity.CENTER);
      label.setTextIsSelectable(false);
      row.addView(label, new LinearLayout.LayoutParams(0, u.dp(31), 1));
    }
    row.setBackgroundColor(0xfffcf5fa);
    box.addView(row);
  }

  private void renderMonthStream(LinearLayout box, Button monthButton) {
    addWeekHeader(box);
    YearMonth center = YearMonth.from(date);
    ListView list = new ListView(a);
    monthList = list;
    list.setDivider(null);
    list.setPadding(0, 0, 0, u.dp(72));
    list.setClipToPadding(false);
    list.setItemsCanFocus(true);
    list.setSelector(android.R.color.transparent);
    list.setAdapter(new BaseAdapter() {
      @Override public int getCount() { return STREAM_MIDDLE * 2 + 1; }
      @Override public YearMonth getItem(int i) { return center.plusMonths(i - STREAM_MIDDLE); }
      @Override public long getItemId(int i) { return i; }
      @Override public View getView(int i, View old, android.view.ViewGroup parent) {
        if (old instanceof MonthCanvas canvas) {
          canvas.bind(getItem(i));
          return canvas;
        }
        MonthCanvas canvas = new MonthCanvas(getItem(i));
        canvas.setLayoutParams(new AbsListView.LayoutParams(-1, -2));
        return canvas;
      }
    });
    box.addView(list, new LinearLayout.LayoutParams(-1, 0, 1));
    restoring = true;
    int week = (date.getDayOfMonth() + center.atDay(1).getDayOfWeek().getValue() - 2) / 7;
    int anchor = monthOffset == null ? (week == 0 ? 0 : -u.dp(37 + week * (56 + capacity * MONTH_LANE))) : monthOffset;
    list.setSelectionFromTop(STREAM_MIDDLE, anchor);
    list.post(() -> { if (monthList == list) restoring = false; });
    list.setOnScrollListener(new AbsListView.OnScrollListener() {
      @Override public void onScrollStateChanged(AbsListView view, int state) {}
      @Override public void onScroll(AbsListView view, int first, int count, int total) {
        if (list != monthList || restoring || count == 0) return;
        YearMonth next = center.plusMonths(first - STREAM_MIDDLE);
        if (!next.equals(YearMonth.from(date))) {
          date = next.atDay(1);
          monthButton.setText(monthTitle(next) + " ⌄");
        }
        View firstMonth = list.getChildAt(0);
        if (firstMonth != null) monthOffset = firstMonth.getTop();
      }
    });
  }

  private void styleCalendarButton(Button button) {
    button.setAllCaps(false);
    button.setTextColor(Ui.PRIMARY);
    button.setMinWidth(0);
    button.setMinimumWidth(0);
    button.setPadding(u.dp(4), 0, u.dp(4), 0);
    button.setStateListAnimator(null);
    button.setBackground(new android.graphics.drawable.RippleDrawable(
        android.content.res.ColorStateList.valueOf(Ui.CONTAINER), u.shape(Ui.SURFACE, 13), null));
  }

  private void nativeButton(LinearLayout row, String title, Runnable click) {
    Button b = new Button(a);
    styleCalendarButton(b);
    b.setText(title);
    b.setTextColor(Ui.PRIMARY);
    b.setAllCaps(false);
    b.setMinHeight(u.dp(48));
    b.setOnClickListener(v -> { if (!a.busy) click.run(); });
    row.addView(b, new LinearLayout.LayoutParams(0, u.dp(48), 1));
  }

  List<JSONObject> visible() {
    String selected = person.isEmpty() ? a.uid() : person;
    List<JSONObject> out = new ArrayList<>();
    Set<String> seen = new HashSet<>();
    for (JSONObject task : rows(reportId == null ? a.tasks : reportTasks)) {
      if (!contains(arr(task, "assigneeIds"), selected) || !task.optBoolean("published")
          || !seen.add(id(task))) continue;
      JSONObject schedule = task.optJSONObject("pendingSchedule");
      if (schedule == null) {
        out.add(task);
      } else {
        try {
          JSONObject projected = new JSONObject(task.toString());
          for (String key : List.of("allDay", "startAt", "dueAt", "startDate", "dueDate"))
            projected.put(key, schedule.opt(key));
          projected.put("calendarProposal", true);
          out.add(projected);
        } catch (JSONException invalid) {
          out.add(task);
        }
      }
    }
    out.sort(
        Comparator.<JSONObject>comparingInt(t -> t.optBoolean("pinned") ? 0 : 1)
            .thenComparing(t -> start(t))
            .thenComparing(Json::id));
    return out;
  }

  Instant start(JSONObject t) {
    try {
      return t.optBoolean("allDay")
          ? LocalDate.parse(s(t, "startDate")).atStartOfDay(ZONE).toInstant()
          : Instant.parse(s(t, "startAt"));
    } catch (Exception e) {
      return Instant.EPOCH;
    }
  }

  Instant end(JSONObject t) {
    try {
      return t.optBoolean("allDay")
          ? LocalDate.parse(s(t, "dueDate")).plusDays(1).atStartOfDay(ZONE).toInstant()
          : Instant.parse(s(t, "dueAt"));
    } catch (Exception e) {
      return Instant.EPOCH;
    }
  }

  boolean hits(JSONObject t, LocalDate day) {
    return ScheduleMath.hits(
        start(t),
        end(t),
        day.atStartOfDay(ZONE).toInstant(),
        day.plusDays(1).atStartOfDay(ZONE).toInstant());
  }

  void dateDetail(LocalDate selected) {
    String label = selected.getMonthValue() + "月" + selected.getDayOfMonth() + "日  星期"
        + WEEK[selected.getDayOfWeek().getValue() - 1];
    MainActivity.Panel p = a.panel(label, 1, .37f, Gravity.BOTTOM, "✕");
    FrameLayout handleTouch = new FrameLayout(a);
    View handle = new View(a);
    handle.setBackground(u.shape(0xffc6c3cb, 4));
    handleTouch.addView(handle, new FrameLayout.LayoutParams(u.dp(40), u.dp(5), Gravity.CENTER));
    p.shell.addView(handleTouch, 0, new LinearLayout.LayoutParams(-1, u.dp(17)));
    handleTouch.setOnTouchListener(new View.OnTouchListener() {
      float down;
      @Override public boolean onTouch(View v, MotionEvent e) {
        if (e.getActionMasked() == MotionEvent.ACTION_DOWN) down = e.getRawY();
        if (e.getActionMasked() == MotionEvent.ACTION_UP) {
          v.performClick();
          if (e.getRawY() - down > u.dp(28)) p.dialog.dismiss();
        }
        return true;
      }
    });
    Button view = toolbarButton("查看日视图 ›", "查看日视图", () -> {
      p.dialog.dismiss();
      if (!day) {
        monthReturnDate = date;
        monthReturnOffset = monthOffset;
      }
      day = true;
      dayMode = 0;
      go(selected);
    });
    p.header.addView(view, 1);
    renderDayList(p.body, selected);
  }

  private void renderDayList(LinearLayout body, LocalDate selected) {
    List<JSONObject> matches = new ArrayList<>();
    for (JSONObject task : visible()) if (hits(task, selected)) matches.add(task);
    if (matches.isEmpty()) {
      TextView empty = u.text("这一天还没有任务", 15, Ui.MUTED);
      empty.setGravity(Gravity.CENTER);
      empty.setPadding(0, u.dp(26), 0, u.dp(12));
      body.addView(empty);
      if (ownCalendar()) {
        Button create = toolbarButton("创建任务", "创建任务", () -> a.tasksUi.form(null, false, selected));
        body.addView(create, new LinearLayout.LayoutParams(-1, u.dp(48)));
      }
      return;
    }
    u.note(body, "共 " + matches.size() + " 项日程");
    for (JSONObject t : matches) {
      Instant lo = selected.atStartOfDay(ZONE).toInstant();
      Instant hi = selected.plusDays(1).atStartOfDay(ZONE).toInstant();
      var clock = java.time.format.DateTimeFormatter.ofPattern("HH:mm").withZone(ZONE);
      String time = t.optBoolean("allDay") ? "全天" :
          (start(t).isBefore(lo) ? "前日延续" : clock.format(start(t))) + " – "
          + (!end(t).isBefore(hi) ? "24:00" : clock.format(end(t)))
          + (end(t).isAfter(hi) ? " · 跨日" : "");
      LinearLayout card = u.card(body);
      u.item(card, (t.optBoolean("pinned") ? "★ " : "") + s(t, "title"), time
          + " · " + state(s(t, "executionState")) + " · " + priority(t)
          + (t.optBoolean("frozen") ? " · 审核中" : ""),
          () -> a.tasksUi.detail(id(t), viewedReport()));
    }
  }

  private boolean fullDay(JSONObject task, LocalDate selected) {
    return task.optBoolean("allDay") || (!start(task).isAfter(selected.atStartOfDay(ZONE).toInstant())
        && !end(task).isBefore(selected.plusDays(1).atStartOfDay(ZONE).toInstant()));
  }

  private boolean ownCalendar() {
    return reportId == null && (person.isEmpty() || person.equals(a.uid()));
  }

  private String viewedReport() {
    return ownCalendar() ? null : person;
  }

  private void taskItem(LinearLayout list, JSONObject task) {
    a.tasksUi.taskItem(list, task, viewedReport());
  }

  private int calendarColor(JSONObject task) {
    for (JSONObject tag : rows(arr(task, "tags"))) {
      try { return Color.parseColor(s(tag, "color")); } catch (IllegalArgumentException ignored) {}
    }
    int[] shades = {0xfff4d5e1, 0xffe1eafb, 0xffdfefe7, 0xffefe4f8, 0xfff8e8d7, 0xfffae3e6};
    return shades[Math.floorMod(id(task).hashCode(), shades.length)];
  }

  private boolean canDrag(JSONObject task) {
    return ownCalendar() && task.optBoolean("published") && task.optBoolean("canReschedule")
        && !task.optBoolean("frozen") && !"done".equals(s(task, "executionState"));
  }

  private ScheduleMath.Range range(JSONObject task) {
    return new ScheduleMath.Range(start(task), end(task));
  }

  private String rangeText(JSONObject task, ScheduleMath.Range range) {
    if (task.optBoolean("allDay"))
      return range.start().atZone(ZONE).toLocalDate() + " 至 "
          + range.end().minusNanos(1).atZone(ZONE).toLocalDate();
    return TasksUi.when(range.start().toString()) + " 至 " + TasksUi.when(range.end().toString());
  }

  private void confirmSchedule(JSONObject task, ScheduleMath.Range proposal) {
    MainActivity.Panel panel = a.panel("确认排期调整");
    u.heading(panel.body, s(task, "title"));
    u.note(panel.body, "原排期：" + rangeText(task, range(task)));
    u.note(panel.body, "新排期：" + rangeText(task, proposal));
    EditText reason = u.field(panel.body, "调整原因（必填）", "", 500, true);
    String slot = "calendar:" + UUID.randomUUID();
    u.button(panel.actions, "提交排期", true, () -> {
      String message = Ui.value(reason);
      if (message.isEmpty()) {
        panel.error.setText("请填写调整原因。");
        return;
      }
      boolean allDay = task.optBoolean("allDay");
      JSONObject changes = allDay
          ? obj("command", "reschedule", "allDay", true, "reason", message,
              "startDate", proposal.start().atZone(ZONE).toLocalDate().toString(),
              "dueDate", proposal.end().minusNanos(1).atZone(ZONE).toLocalDate().toString())
          : obj("command", "reschedule", "allDay", false, "reason", message,
              "startAt", proposal.start().toString(), "dueAt", proposal.end().toString());
      a.write(slot, "PATCH", "/tasks/" + ApiClient.q(id(task)), changes, tag(task));
    });
  }

  private final class Hit {
    RectF rect;
    JSONObject task;
    LocalDate day;
    boolean startHandle, endHandle;

    Hit handles(boolean start, boolean end) {
      startHandle = start;
      endHandle = end;
      return this;
    }

    Hit(RectF r, JSONObject t, LocalDate d) {
      rect = r;
      task = t;
      day = d;
    }
  }

  private abstract class ScheduleCanvas extends View {
    final Paint paint = new Paint(Paint.ANTI_ALIAS_FLAG);
    final List<Hit> hits = new ArrayList<>();
    float downX, downY, dragX, dragY;
    Hit pressed;
    boolean dragging, moved;
    ScheduleMath.Edge edge;
    ScheduleMath.Range proposal;
    boolean verticalAxis() { return false; }

    final Runnable activate = () -> {
      if (pressed == null || pressed.task == null || a.busy || !canDrag(pressed.task)) return;
      if (day && !hourEligible(pressed.task)) return;
      dragging = true;
      getParent().requestDisallowInterceptTouchEvent(true);
      performHapticFeedback(HapticFeedbackConstants.LONG_PRESS);
      dragX = downX;
      dragY = downY;
      proposal = range(pressed.task);
      invalidate();
    };

    ScheduleCanvas() {
      super(a);
      setFocusable(true);
      setClickable(true);
      setContentDescription("日历画布，任务的无障碍列表位于下方");
    }

    float dp(float v) {
      return u.dp(v);
    }

    void text(Canvas c, String value, float x, float y, int size, int color) {
      paint.setColor(color);
      paint.setTextSize(dp(size));
      paint.setTypeface(Typeface.create("sans-serif", Typeface.NORMAL));
      c.drawText(value, x, y, paint);
    }

    void fill(Canvas c, RectF r, int color, int radius) {
      paint.setColor(color);
      c.drawRoundRect(r, dp(radius), dp(radius), paint);
    }

    String ellipsis(String value, float width, int size) {
      paint.setTextSize(dp(size));
      int count = paint.breakText(value, true, Math.max(0, width), null);
      return count < value.length()
          ? (count > 1 ? value.substring(0, count - 1) + "…" : "")
          : value;
    }

    boolean hourEligible(JSONObject task) {
      if (task.optBoolean("allDay")) return false;
      ScheduleMath.Range r = range(task);
      Instant from = date.atStartOfDay(ZONE).toInstant();
      Instant to = date.plusDays(1).atStartOfDay(ZONE).toInstant();
      return ScheduleMath.shift(r, ScheduleMath.Edge.MOVE, 0, ZONE, date) != null
          && !(r.start().equals(from) && r.end().equals(to));
    }

    Hit hit(float x, float y) {
      for (int i = hits.size() - 1; i >= 0; i--)
        if (hits.get(i).rect.contains(x, y)) return hits.get(i);
      return null;
    }

    int dragSteps(float x, float y) {
      return verticalAxis() ? Math.round((y - downY) / dp(48))
          : Math.round((x - downX) / dp(56));
    }

    boolean canDrop(float x, float y) { return true; }

    ScheduleMath.Range proposalAt(float x, float y) {
      if (!canDrop(x, y)) return null;
      ScheduleMath.Range next = ScheduleMath.shift(
          range(pressed.task), edge, dragSteps(x, y), ZONE, day ? date : null);
      return next != null && (!pressed.task.optBoolean("allDay") || next.end().isAfter(next.start()))
          ? next : null;
    }

    void drawDrag(Canvas canvas) {
      if (!dragging || pressed == null) return;
      float top = Math.max(dp(4), pressed.rect.top - dp(32));
      float left = getParent() instanceof HorizontalScrollView timeline ? timeline.getScrollX() + dp(4) : dp(4);
      float width = getParent() instanceof HorizontalScrollView timeline ? timeline.getWidth() : getWidth();
      RectF label = new RectF(left, top, left + width - dp(8), top + dp(30));
      fill(canvas, label, Ui.PRIMARY, 8);
      String line = proposal == null ? "超出可调整范围" : rangeText(pressed.task, proposal);
      text(canvas, ellipsis(line, label.width() - dp(16), 12), left + dp(8), top + dp(20), 12, Ui.SURFACE);
    }

    void drawHandles(Canvas canvas, Hit hit) {
      if (!canDrag(hit.task) || (day && !hourEligible(hit.task))) return;
      RectF rect = hit.rect;
      if (verticalAxis()) {
        if (hit.startHandle) fill(canvas, new RectF(rect.left + dp(4), rect.top, rect.right - dp(4), rect.top + dp(3)), Ui.PRIMARY, 2);
        if (hit.endHandle) fill(canvas, new RectF(rect.left + dp(4), rect.bottom - dp(3), rect.right - dp(4), rect.bottom), Ui.PRIMARY, 2);
        return;
      }
      if (hit.startHandle) fill(canvas, new RectF(rect.left, rect.top + dp(4), rect.left + dp(3), rect.bottom - dp(4)), Ui.PRIMARY, 2);
      if (hit.endHandle) fill(canvas, new RectF(rect.right - dp(3), rect.top + dp(4), rect.right, rect.bottom - dp(4)), Ui.PRIMARY, 2);
    }

    void drawPending(Canvas canvas, RectF rect, JSONObject task) {
      if (task.optBoolean("calendarProposal")) strokeDashed(canvas, rect, Ui.PRIMARY);
    }

    void strokeDashed(Canvas canvas, RectF rect, int color) {
      paint.setColor(color);
      paint.setStyle(Paint.Style.STROKE);
      paint.setStrokeWidth(dp(1));
      paint.setPathEffect(new DashPathEffect(new float[] {dp(4), dp(3)}, 0));
      canvas.drawRoundRect(rect, dp(4), dp(4), paint);
      paint.setPathEffect(null);
      paint.setStyle(Paint.Style.FILL);
    }

    void clearDrag() {
      removeCallbacks(activate);
      if (dragging && getParent() != null) getParent().requestDisallowInterceptTouchEvent(false);
      dragging = false;
      moved = false;
      pressed = null;
      proposal = null;
      invalidate();
    }

    @Override
    public void onWindowFocusChanged(boolean focused) {
      super.onWindowFocusChanged(focused);
      if (!focused) clearDrag();
    }

    @Override
    protected void onDetachedFromWindow() {
      clearDrag();
      super.onDetachedFromWindow();
    }

    @Override
    public boolean onTouchEvent(MotionEvent event) {
      float x = event.getX(), y = event.getY();
      switch (event.getActionMasked()) {
        case MotionEvent.ACTION_DOWN -> {
          clearDrag();
          downX = x;
          downY = y;
          pressed = hit(x, y);
          if (pressed != null && pressed.task != null && canDrag(pressed.task)) {
            boolean vertical = verticalAxis();
            float handle = Math.min(dp(12), (vertical ? pressed.rect.height() : pressed.rect.width()) / 3);
            float startDistance = vertical ? y - pressed.rect.top : x - pressed.rect.left;
            float endDistance = vertical ? pressed.rect.bottom - y : pressed.rect.right - x;
            edge = pressed.startHandle && startDistance < handle ? ScheduleMath.Edge.START
                : pressed.endHandle && endDistance <= handle ? ScheduleMath.Edge.END
                : ScheduleMath.Edge.MOVE;
            postDelayed(activate, ViewConfiguration.getLongPressTimeout());
          }
        }
        case MotionEvent.ACTION_MOVE -> {
          if (dragging) {
            dragX = x;
            dragY = y;
            proposal = proposalAt(x, y);
            invalidate();
          } else if (Math.hypot(x - downX, y - downY) > ViewConfiguration.get(a).getScaledTouchSlop()) {
            moved = true;
            removeCallbacks(activate);
          }
        }
        case MotionEvent.ACTION_UP -> {
          Hit target = pressed;
          boolean wasDragging = dragging;
          int distance = wasDragging ? dragSteps(x, y) : 0;
          ScheduleMath.Range result = wasDragging && distance != 0
              ? proposalAt(x, y) : null;
          Hit up = hit(x, y);
          boolean click = !wasDragging && !moved && target != null && up != null
              && (target.task == null ? up.task == null && Objects.equals(target.day, up.day)
                  : up.task != null && id(target.task).equals(id(up.task)));
          clearDrag();
          if (result != null)
            confirmSchedule(target.task, result);
          else if (wasDragging && distance != 0) a.toast("超出可调整范围，请重试");
          else if (click) {
            performClick();
            if (target.task != null) a.tasksUi.detail(id(target.task), viewedReport());
            else dateDetail(target.day);
          }
        }
        case MotionEvent.ACTION_CANCEL, MotionEvent.ACTION_POINTER_DOWN -> clearDrag();
      }
      return true;
    }

    @Override
    public boolean performClick() {
      super.performClick();
      return true;
    }
  }

  private final class MonthCanvas extends ScheduleCanvas {
    private YearMonth month;
    private int describedCapacity;
    private boolean resizing;
    private boolean spanActive;
    private int initialCapacity;
    private float initialSpan;

    MonthCanvas(YearMonth month) { bind(month); }

    void bind(YearMonth month) {
      if (month.equals(this.month) && describedCapacity == capacity) return;
      clearDrag();
      this.month = month;
      updateCapacityDescription();
      requestLayout();
    }

    private void updateCapacityDescription() {
      describedCapacity = capacity;
      setContentDescription(monthTitle(month) + "月历，当前显示 " + capacity + " 行事件。双指上下张开或合拢调整行数。");
    }

    @Override
    public boolean onTouchEvent(MotionEvent event) {
      int action = event.getActionMasked();
      if (action == MotionEvent.ACTION_DOWN) resizing = false;
      if (action == MotionEvent.ACTION_POINTER_DOWN && !resizing) {
        clearDrag();
        resizing = true;
        spanActive = true;
        initialCapacity = capacity;
        initialSpan = verticalSpan(event);
        getParent().requestDisallowInterceptTouchEvent(true);
      }
      if (!resizing) return super.onTouchEvent(event);
      if (action == MotionEvent.ACTION_POINTER_UP || event.getPointerCount() > 2) spanActive = false;
      if (action == MotionEvent.ACTION_MOVE && spanActive && event.getPointerCount() == 2) {
        int next = ScheduleMath.monthCapacity(initialCapacity, verticalSpan(event) - initialSpan, dp(48));
        if (next != capacity) {
          capacity = next;
          updateCapacityDescription();
          if (monthList != null && getParent() == monthList) {
            for (int i = 0; i < monthList.getChildCount(); i++)
              if (monthList.getChildAt(i) instanceof MonthCanvas canvas && canvas != this) {
                canvas.updateCapacityDescription();
                canvas.requestLayout();
                canvas.invalidate();
              }
          }
          requestLayout();
          invalidate();
        }
      }
      // Keep this gesture consumed after the first finger lifts so it cannot open a day or drag a task.
      if (action == MotionEvent.ACTION_UP || action == MotionEvent.ACTION_CANCEL) {
        resizing = false;
        getParent().requestDisallowInterceptTouchEvent(false);
      }
      return true;
    }

    private float verticalSpan(MotionEvent event) {
      return Math.abs(event.getY(0) - event.getY(1));
    }

    private float weekHeight() { return dp(36 + capacity * MONTH_LANE + 20); }
    private float headerHeight() { return reportId == null ? dp(37) : 0; }

    @Override
    boolean canDrop(float x, float y) {
      int cell = ScheduleMath.monthCell(x, y, getWidth(), headerHeight(), weekHeight(), weeks());
      return cell >= 0 && YearMonth.from(first().plusDays(cell)).equals(month);
    }

    @Override
    int dragSteps(float x, float y) {
      int source = ScheduleMath.monthCell(downX, downY, getWidth(), headerHeight(), weekHeight(), weeks());
      int target = ScheduleMath.monthCell(x, y, getWidth(), headerHeight(), weekHeight(), weeks());
      return target < 0 || source < 0 ? 0 : target - source;
    }

    @Override
    void drawDrag(Canvas canvas) {
      if (!dragging || pressed == null) return;
      int index = ScheduleMath.monthCell(dragX, dragY, getWidth(), headerHeight(), weekHeight(), weeks());
      if (index < 0 || !canDrop(dragX, dragY)) return;
      float column = getWidth() / 7f;
      float left = index % 7 * column, top = headerHeight() + index / 7 * weekHeight();
      RectF ghost = new RectF(left + dp(2), top + dp(33), left + column - dp(2), top + weekHeight() - dp(4));
      fill(canvas, ghost, proposal == null ? 0xffffeee9 : 0xfffceaf2, 6);
      strokeDashed(canvas, ghost, proposal == null ? Ui.ERROR : Ui.PRIMARY);
      String value = proposal == null ? "日期无效" : s(pressed.task, "title");
      text(canvas, ellipsis(value, ghost.width() - dp(8), 11), ghost.left + dp(4), ghost.top + dp(15), 11, Ui.INK);
      if (proposal != null && !pressed.task.optBoolean("allDay")) {
        String time = proposal.start().atZone(ZONE).toLocalTime().withSecond(0).withNano(0) + "–"
            + proposal.end().atZone(ZONE).toLocalTime().withSecond(0).withNano(0);
        text(canvas, ellipsis(time, ghost.width() - dp(8), 10), ghost.left + dp(4), ghost.top + dp(31), 10, Ui.PRIMARY);
      }
    }

    LocalDate first() {
      return month.atDay(1).with(TemporalAdjusters.previousOrSame(DayOfWeek.MONDAY));
    }

    int weeks() {
      return (int)
              (java.time.temporal.ChronoUnit.DAYS.between(
                      first(), month.atEndOfMonth())
                  / 7)
          + 1;
    }

    @Override
    protected void onMeasure(int w, int h) {
      setMeasuredDimension(MeasureSpec.getSize(w), Math.round(headerHeight() + weeks() * weekHeight()));
    }

    @Override
    protected void onDraw(Canvas c) {
      super.onDraw(c);
      hits.clear();
      float width = getWidth() / 7f, weekHeight = weekHeight();
      fill(c, new RectF(0, 0, getWidth(), getHeight()), Ui.SURFACE, 12);
      if (reportId == null) text(c, monthTitle(month), dp(10), dp(24), 16, Ui.INK);
      List<JSONObject> tasks = visible();
      for (int week = 0; week < weeks(); week++) {
        LocalDate from = first().plusWeeks(week);
        float y = headerHeight() + week * weekHeight;
        for (int d = 0; d < 7; d++) {
          LocalDate cell = from.plusDays(d);
          if (!YearMonth.from(cell).equals(month)) continue;
          RectF r = new RectF(width * d, y, width * (d + 1), y + weekHeight);
          hits.add(new Hit(r, null, cell));
          if (cell.equals(a.workspaceUi.businessDate())) {
            fill(c, r, 0xfffdf2f8, 0);
            fill(
                c,
                new RectF(
                    width * d + width * .5f - dp(14),
                    y + dp(2),
                    width * d + width * .5f + dp(14),
                    y + dp(30)),
                Ui.PRIMARY,
                11);
          }
          text(
              c,
              String.valueOf(cell.getDayOfMonth()),
              width * d + width * .5f - dp(cell.getDayOfMonth() < 10 ? 5 : 10),
              y + dp(23),
              20,
              cell.equals(a.workspaceUi.businessDate())
                  ? Ui.SURFACE
                  : Ui.INK);
          paint.setColor(Ui.LINE);
          c.drawLine(width * d, y, width * d, y + weekHeight, paint);
        }
        List<Instant> ends = new ArrayList<>();
        int[] hidden = new int[7];
        Instant lo = ScheduleMath.max(from.atStartOfDay(ZONE).toInstant(),
                month.atDay(1).atStartOfDay(ZONE).toInstant()),
            hi = ScheduleMath.min(from.plusDays(7).atStartOfDay(ZONE).toInstant(),
                month.plusMonths(1).atDay(1).atStartOfDay(ZONE).toInstant());
        for (JSONObject t : tasks) {
          if (!ScheduleMath.hits(start(t), end(t), lo, hi)) continue;
          Instant begin = ScheduleMath.max(start(t), lo), finish = ScheduleMath.min(end(t), hi);
          int left =
              (int)
                  java.time.temporal.ChronoUnit.DAYS.between(
                      from, begin.atZone(ZONE).toLocalDate());
          int right =
              Math.min(
                  7,
                  (int)
                          java.time.temporal.ChronoUnit.DAYS.between(
                              from,
                              finish
                                  .minusNanos(finish.isAfter(begin) ? 1 : 0)
                                  .atZone(ZONE)
                                  .toLocalDate())
                      + 1);
          left = Math.max(0, left);
          right = Math.max(left + 1, right);
          int lane =
              ScheduleMath.lane(
                  ends,
                  from.plusDays(left).atStartOfDay(ZONE).toInstant(),
                  from.plusDays(right).atStartOfDay(ZONE).toInstant());
          if (lane >= capacity) {
            for (int d = left; d < right && d < 7; d++) hidden[d]++;
            continue;
          }
          RectF bar =
              new RectF(
                  width * left + dp(2),
                  y + dp(34 + lane * MONTH_LANE),
                  width * right - dp(2),
                  y + dp(70 + lane * MONTH_LANE));
          fill(c, bar, calendarColor(t), 5);
          drawPending(c, bar, t);
          text(
              c,
              ellipsis(s(t, "title"), bar.width() - dp(6), 11),
              bar.left + dp(3),
              bar.top + dp(15),
              11,
              Ui.INK);
          Hit hit = new Hit(bar, t, null).handles(!start(t).isBefore(lo), !end(t).isAfter(hi));
          hits.add(hit);
          drawHandles(c, hit);
          text(c, ellipsis(TasksUi.schedule(t), bar.width() - dp(6), 9),
              bar.left + dp(3), bar.top + dp(27), 9, Ui.MUTED);
        }
        for (int d = 0; d < 7; d++)
          if (hidden[d] > 0) {
            float top = y + dp(36 + capacity * MONTH_LANE);
            text(c, "+" + hidden[d], d * width + dp(6), top + dp(15), 11, Ui.PRIMARY);
            hits.add(
                new Hit(
                    new RectF(d * width, top, (d + 1) * width, top + dp(20)),
                    null,
                    from.plusDays(d)));
          }
        paint.setColor(Ui.LINE);
        c.drawLine(0, y + weekHeight, getWidth(), y + weekHeight, paint);
      }
      drawDrag(c);
    }
  }

  private final class DayCanvas extends ScheduleCanvas {
    private record Event(JSONObject task, Instant from, Instant to, int lane) {}
    private final List<Event> events = new ArrayList<>();
    private final Instant first = date.atStartOfDay(ZONE).toInstant();
    private final Instant last = date.plusDays(1).atStartOfDay(ZONE).toInstant();
    private final int laneCount;

    DayCanvas() {
      List<Instant> ends = new ArrayList<>();
      List<JSONObject> tasks = new ArrayList<>(visible());
      tasks.sort(Comparator.comparing(CalendarUi.this::start));
      for (JSONObject task : tasks) {
        if (fullDay(task, date) || !hits(task, date)) continue;
        Instant from = ScheduleMath.max(start(task), first), to = ScheduleMath.min(end(task), last);
        int lane = ScheduleMath.lane(ends, from, to.equals(from) ? to.plusNanos(1) : to);
        events.add(new Event(task, from, to, lane));
      }
      laneCount = Math.max(3, ends.size());
    }

    @Override
    protected void onMeasure(int width, int height) {
      setMeasuredDimension(u.dp(24 * 56 + 16), u.dp(40 + laneCount * 41));
    }

    @Override
    protected void onDraw(Canvas canvas) {
      hits.clear();
      float width = dp(24 * 56), origin = dp(8);
      for (int hour = 0; hour <= 24; hour++) {
        float x = origin + dp(hour * 56);
        text(canvas, String.format(Locale.ROOT, "%02d:00", hour),
            Math.min(x, getWidth() - dp(35)), dp(22), 11, Ui.MUTED);
        paint.setColor(Ui.LINE);
        canvas.drawLine(x, dp(31), x, getHeight(), paint);
      }
      if (events.isEmpty()) text(canvas, "当天暂无任务", dp(7 * 56 + 20), dp(70), 14, Ui.MUTED);
      for (Event event : events) {
        float x = origin + (float) ScheduleMath.fraction(event.from(), first, last) * width;
        float right = origin + (float) ScheduleMath.fraction(event.to(), first, last) * width;
        right = Math.min(getWidth(), Math.max(right, x + dp(42)));
        x = Math.min(x, right - dp(42));
        float top = dp(36 + event.lane() * 41);
        RectF rect = new RectF(x, top, right, top + dp(35));
        fill(canvas, rect, calendarColor(event.task()), 8);
        drawPending(canvas, rect, event.task());
        text(canvas, ellipsis(s(event.task(), "title"), rect.width() - dp(12), 12),
            rect.left + dp(6), rect.top + dp(17), 12, Ui.INK);
        text(canvas, event.from().atZone(ZONE).toLocalTime().withSecond(0).withNano(0).toString(),
            rect.left + dp(6), rect.top + dp(34), 10, Ui.MUTED);
        Hit hit = new Hit(rect, event.task(), null).handles(
            event.from().equals(start(event.task())), event.to().equals(end(event.task())));
        hits.add(hit);
        drawHandles(canvas, hit);
      }
      drawDrag(canvas);
    }
  }

  private final class VerticalDayCanvas extends ScheduleCanvas {
    @Override boolean verticalAxis() { return true; }

    @Override
    protected void onMeasure(int width, int height) {
      setMeasuredDimension(MeasureSpec.getSize(width), u.dp(24 * 48 + 44));
    }

    @Override
    protected void onDraw(Canvas canvas) {
      hits.clear();
      float top = dp(18), hour = dp(48), left = dp(52);
      Instant first = date.atStartOfDay(ZONE).toInstant();
      Instant last = date.plusDays(1).atStartOfDay(ZONE).toInstant();
      for (int h = 0; h <= 24; h++) {
        float y = top + h * hour;
        text(canvas, String.format(Locale.ROOT, "%02d:00", h), dp(4), y + dp(4), 11, Ui.MUTED);
        paint.setColor(Ui.LINE);
        canvas.drawLine(left, y, getWidth(), y, paint);
      }
      List<JSONObject> tasks = new ArrayList<>(visible());
      tasks.sort(Comparator.comparing(CalendarUi.this::start));
      List<Instant> ends = new ArrayList<>();
      List<Hit> events = new ArrayList<>();
      List<Integer> lanes = new ArrayList<>();
      for (JSONObject task : tasks) {
        if (fullDay(task, date) || !hits(task, date)) continue;
        Instant from = ScheduleMath.max(start(task), first), to = ScheduleMath.min(end(task), last);
        int lane = ScheduleMath.lane(ends, from, to.equals(from) ? to.plusNanos(1) : to);
        float y = top + (float) ScheduleMath.fraction(from, first, last) * 24 * hour;
        float bottom = top + (float) ScheduleMath.fraction(to, first, last) * 24 * hour;
        Hit event = new Hit(new RectF(0, y, 0, Math.max(y + dp(28), bottom)), task, null)
            .handles(from.equals(start(task)), to.equals(end(task)));
        events.add(event);
        lanes.add(lane);
      }
      float laneWidth = (getWidth() - left) / Math.max(1, ends.size());
      for (int i = 0; i < events.size(); i++) {
        Hit event = events.get(i);
        event.rect.left = left + laneWidth * lanes.get(i) + dp(1);
        event.rect.right = event.rect.left + laneWidth - dp(2);
        fill(canvas, event.rect, Ui.CONTAINER, 6);
        drawPending(canvas, event.rect, event.task);
        text(canvas, ellipsis(s(event.task, "title"), event.rect.width() - dp(10), 12),
            event.rect.left + dp(5), event.rect.top + dp(19), 12, Ui.INK);
        hits.add(event);
        drawHandles(canvas, event);
      }
      drawDrag(canvas);
    }
  }
}
