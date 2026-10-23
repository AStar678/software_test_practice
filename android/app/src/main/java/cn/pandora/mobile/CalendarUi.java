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
  LocalDate date = LocalDate.now(ZONE);
  String person = "";
  boolean day = false;
  int capacity = 1;

  CalendarUi(MainActivity a) {
    this.a = a;
    u = a.u;
  }

  void show() {
    LinearLayout box = a.page("日程");
    LinearLayout row = u.row();
    Button prev = new Button(a), pick = new Button(a), next = new Button(a);
    prev.setText("‹");
    prev.setContentDescription("上一月或上一日");
    next.setText("›");
    next.setContentDescription("下一月或下一日");
    pick.setText(day ? date.toString() : date.getYear() + "年" + date.getMonthValue() + "月");
    row.addView(prev, new LinearLayout.LayoutParams(u.dp(48), u.dp(48)));
    row.addView(pick, new LinearLayout.LayoutParams(0, u.dp(56), 1));
    row.addView(next, new LinearLayout.LayoutParams(u.dp(48), u.dp(48)));
    box.addView(row);
    prev.setOnClickListener(
        v -> {
          date = day ? date.minusDays(1) : date.minusMonths(1);
          show();
        });
    next.setOnClickListener(
        v -> {
          date = day ? date.plusDays(1) : date.plusMonths(1);
          show();
        });
    pick.setOnClickListener(
        v ->
            new DatePickerDialog(
                    a,
                    (picker, y, m, d) -> {
                      date = LocalDate.of(y, m + 1, d);
                      show();
                    },
                    date.getYear(),
                    date.getMonthValue() - 1,
                    date.getDayOfMonth())
                .show());
    LinearLayout controls = u.row();
    nativeButton(
        controls,
        "今天",
        () -> {
          date = LocalDate.now(ZONE);
          show();
        });
    nativeButton(
        controls,
        day ? "切换到月历" : "切换到日程",
        () -> {
          day = !day;
          show();
        });
    box.addView(controls);
    List<JSONObject> people = new ArrayList<>();
    people.add(a.me);
    people.addAll(rows(a.reports));
    String[] names = people.stream().map(p -> s(p, "displayName")).toArray(String[]::new);
    int index = 0;
    for (int i = 0; i < people.size(); i++) if (id(people.get(i)).equals(person)) index = i;
    Spinner owner = u.spinner(box, "查看负责人的日程", names, index);
    owner.setOnItemSelectedListener(
        new android.widget.AdapterView.OnItemSelectedListener() {
          public void onNothingSelected(android.widget.AdapterView<?> p) {}

          public void onItemSelected(android.widget.AdapterView<?> p, View v, int i, long id) {
            String selected = Json.id(people.get(i));
            if (!selected.equals(person) && !(person.isEmpty() && i == 0)) {
              person = selected;
              show();
            }
          }
        });
    LinearLayout actions = u.row();
    nativeButton(actions, "＋ 创建任务", () -> a.tasksUi.form(null, false));
    nativeButton(actions, "我的申请", () -> a.tasksUi.approvals("applicant"));
    nativeButton(actions, "任务筛选", a.tasksUi::list);
    box.addView(actions);
    if (day) {
      u.heading(box, "全天任务");
      boolean any = false;
      for (JSONObject t : visible())
        if (t.optBoolean("allDay") && hits(t, date)) {
          a.tasksUi.taskItem(box, t);
          any = true;
        }
      if (!any) u.note(box, "无全天任务");
      u.heading(box, "日时间轴");
      u.note(box, "每8小时一行，点击事件查看详情。重叠事件分行显示。");
      box.addView(new DayCanvas());
      u.heading(box, "当天任务列表");
      for (JSONObject task : visible()) if (hits(task, date)) a.tasksUi.taskItem(box, task);
      dayLogs(box, date);
    } else {
      u.note(box, "月历事件行数 · " + capacity + "行（拖动调节）");
      SeekBar density = new SeekBar(a);
      density.setMax(7);
      density.setProgress(capacity - 1);
      density.setContentDescription("月历事件行数");
      box.addView(density);
      MonthCanvas month = new MonthCanvas();
      box.addView(month);
      u.heading(box, "本月任务列表");
      for (JSONObject task : visible())
        if (ScheduleMath.hits(
            start(task),
            end(task),
            date.withDayOfMonth(1).atStartOfDay(ZONE).toInstant(),
            date.withDayOfMonth(1).plusMonths(1).atStartOfDay(ZONE).toInstant()))
          a.tasksUi.taskItem(box, task);
      density.setOnSeekBarChangeListener(
          new SeekBar.OnSeekBarChangeListener() {
            public void onStartTrackingTouch(SeekBar s) {}

            public void onStopTrackingTouch(SeekBar s) {}

            public void onProgressChanged(SeekBar s, int value, boolean user) {
              if (user) {
                capacity = value + 1;
                month.requestLayout();
                month.invalidate();
              }
            }
          });
    }
  }

  private void nativeButton(LinearLayout row, String title, Runnable click) {
    Button b = new Button(a);
    b.setText(title);
    b.setTextColor(Ui.PRIMARY);
    b.setAllCaps(false);
    b.setMinHeight(u.dp(48));
    b.setOnClickListener(v -> click.run());
    row.addView(b, new LinearLayout.LayoutParams(0, u.dp(48), 1));
  }

  List<JSONObject> visible() {
    String selected = person.isEmpty() ? a.uid() : person;
    List<JSONObject> out = new ArrayList<>();
    for (JSONObject t : rows(a.tasks)) if (contains(arr(t, "assigneeIds"), selected)) out.add(t);
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
    date = selected;
    MainActivity.Panel p = a.panel(selected.toString() + " · 日程");
    int count = 0;
    for (JSONObject t : visible())
      if (hits(t, selected)) {
        a.tasksUi.taskItem(p.body, t);
        count++;
      }
    if (count == 0) u.note(p.body, "这一天暂无任务");
    dayLogs(p.body, selected);
    u.button(
        p.actions,
        "查看当天时间轴",
        false,
        () -> {
          p.dialog.dismiss();
          day = true;
          show();
        });
  }

  private void dayLogs(LinearLayout body, LocalDate selected) {
    if (!person.isEmpty() && !person.equals(a.uid())) return;
    u.heading(body, "本人工作日志");
    boolean found = false;
    for (JSONObject l : rows(a.logs))
      if (selected.toString().equals(s(l, "businessDate"))) {
        u.item(body, s(l, "body"), "本人日志", () -> a.workspaceUi.logDetail(id(l)));
        found = true;
      }
    if (!found) u.note(body, "当天没有本人日志");
  }

  private final class Hit {
    RectF rect;
    JSONObject task;
    LocalDate day;

    Hit(RectF r, JSONObject t, LocalDate d) {
      rect = r;
      task = t;
      day = d;
    }
  }

  private abstract class ScheduleCanvas extends View {
    final Paint paint = new Paint(Paint.ANTI_ALIAS_FLAG);
    final List<Hit> hits = new ArrayList<>();
    float downX, downY;

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

    @Override
    public boolean onTouchEvent(android.view.MotionEvent e) {
      if (e.getAction() == MotionEvent.ACTION_DOWN) {
        downX = e.getX();
        downY = e.getY();
        return true;
      }
      if (e.getAction() == MotionEvent.ACTION_UP
          && Math.abs(downX - e.getX()) < dp(8)
          && Math.abs(downY - e.getY()) < dp(8)) {
        performClick();
        for (int i = hits.size() - 1; i >= 0; i--) {
          Hit h = hits.get(i);
          if (h.rect.contains(e.getX(), e.getY())) {
            if (h.task != null) a.tasksUi.detail(id(h.task));
            else dateDetail(h.day);
            return true;
          }
        }
        return true;
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
    LocalDate first() {
      return date.withDayOfMonth(1).with(TemporalAdjusters.previousOrSame(DayOfWeek.MONDAY));
    }

    int weeks() {
      return (int)
              (java.time.temporal.ChronoUnit.DAYS.between(
                      first(), date.withDayOfMonth(1).plusMonths(1).minusDays(1))
                  / 7)
          + 1;
    }

    @Override
    protected void onMeasure(int w, int h) {
      setMeasuredDimension(MeasureSpec.getSize(w), u.dp(32 + weeks() * (36 + capacity * 24 + 20)));
    }

    @Override
    protected void onDraw(Canvas c) {
      super.onDraw(c);
      hits.clear();
      float width = getWidth() / 7f, weekHeight = dp(36 + capacity * 24 + 20);
      String[] weekdays = {"一", "二", "三", "四", "五", "六", "日"};
      for (int i = 0; i < 7; i++)
        text(c, weekdays[i], width * i + width * .4f, dp(22), 12, Ui.MUTED);
      for (int week = 0; week < weeks(); week++) {
        LocalDate from = first().plusWeeks(week);
        float y = dp(32) + week * weekHeight;
        for (int d = 0; d < 7; d++) {
          LocalDate cell = from.plusDays(d);
          RectF r = new RectF(width * d, y, width * (d + 1), y + weekHeight);
          hits.add(new Hit(r, null, cell));
          if (cell.equals(LocalDate.now(ZONE)))
            fill(
                c,
                new RectF(
                    width * d + width * .5f - dp(14),
                    y + dp(2),
                    width * d + width * .5f + dp(14),
                    y + dp(30)),
                Ui.PRIMARY,
                16);
          text(
              c,
              String.valueOf(cell.getDayOfMonth()),
              width * d + width * .5f - dp(7),
              y + dp(23),
              14,
              cell.equals(LocalDate.now(ZONE))
                  ? Ui.SURFACE
                  : cell.getMonth() == date.getMonth() ? Ui.INK : Ui.MUTED);
          paint.setColor(Ui.LINE);
          c.drawLine(width * d, y, width * d, y + weekHeight, paint);
        }
        List<Instant> ends = new ArrayList<>();
        int[] hidden = new int[7];
        Instant lo = from.atStartOfDay(ZONE).toInstant(),
            hi = from.plusDays(7).atStartOfDay(ZONE).toInstant();
        for (JSONObject t : visible()) {
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
                  y + dp(34 + lane * 24),
                  width * right - dp(2),
                  y + dp(56 + lane * 24));
          fill(c, bar, t.optBoolean("pinned") ? Ui.CONTAINER : 0xffe2eaf1, 4);
          text(
              c,
              ellipsis(s(t, "title"), bar.width() - dp(6), 11),
              bar.left + dp(3),
              bar.top + dp(15),
              11,
              Ui.INK);
          hits.add(new Hit(bar, t, null));
        }
        for (int d = 0; d < 7; d++)
          if (hidden[d] > 0) {
            float top = y + dp(36 + capacity * 24);
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
    }
  }

  private final class DayCanvas extends ScheduleCanvas {
    final List<List<Event>> bands = new ArrayList<>();
    final int[] lanes = new int[3];
    final float[] tops = new float[3];
    float total;

    final class Event {
      JSONObject task;
      Instant from, to;
      int lane;

      Event(JSONObject t, Instant f, Instant to, int lane) {
        task = t;
        from = f;
        this.to = to;
        this.lane = lane;
      }
    }

    DayCanvas() {
      for (int band = 0; band < 3; band++) {
        Instant lo = date.atTime(band * 8, 0).atZone(ZONE).toInstant(),
            hi = lo.plusSeconds(8 * 3600);
        List<Event> events = new ArrayList<>();
        List<Instant> ends = new ArrayList<>();
        List<JSONObject> sorted = new ArrayList<>(visible());
        sorted.sort(Comparator.comparing(CalendarUi.this::start));
        for (JSONObject t : sorted)
          if (!t.optBoolean("allDay") && ScheduleMath.hits(start(t), end(t), lo, hi)) {
            Instant from = ScheduleMath.max(start(t), lo), to = ScheduleMath.min(end(t), hi);
            int lane = ScheduleMath.lane(ends, from, to.equals(from) ? to.plusNanos(1) : to);
            events.add(new Event(t, from, to, lane));
          }
        lanes[band] = Math.max(5, ends.size());
        bands.add(events);
        tops[band] = total;
        total += u.dp(40 + lanes[band] * 48 + 12);
      }
      setMinimumHeight((int) total);
    }

    @Override
    protected void onMeasure(int w, int h) {
      setMeasuredDimension(MeasureSpec.getSize(w), (int) total);
    }

    @Override
    protected void onDraw(Canvas c) {
      hits.clear();
      for (int band = 0; band < 3; band++) {
        float top = tops[band], width = getWidth() - dp(16);
        Instant lo = date.atTime(band * 8, 0).atZone(ZONE).toInstant(),
            hi = lo.plusSeconds(8 * 3600);
        for (int hour = 0; hour <= 8; hour++) {
          float x = dp(8) + width * hour / 8;
          text(
              c,
              String.format(Locale.ROOT, "%02d:00", band * 8 + hour),
              Math.min(x, getWidth() - dp(34)),
              top + dp(18),
              10,
              Ui.MUTED);
          paint.setColor(Ui.LINE);
          c.drawLine(x, top + dp(26), x, top + dp(32 + lanes[band] * 48), paint);
        }
        for (Event event : bands.get(band)) {
          float x = dp(8) + (float) ScheduleMath.fraction(event.from, lo, hi) * width;
          float end = dp(8) + (float) ScheduleMath.fraction(event.to, lo, hi) * width;
          float min = dp(44);
          if (end - x < min) {
            end = Math.min(getWidth() - dp(4), x + min);
            x = Math.min(x, end - min);
          }
          RectF rect =
              new RectF(x, top + dp(32 + event.lane * 48), end, top + dp(76 + event.lane * 48));
          fill(c, rect, Ui.CONTAINER, 8);
          text(
              c,
              ellipsis(s(event.task, "title"), rect.width() - dp(8), 12),
              rect.left + dp(4),
              rect.top + dp(18),
              12,
              Ui.INK);
          text(
              c,
              event.from.atZone(ZONE).toLocalTime().withSecond(0).withNano(0).toString(),
              rect.left + dp(4),
              rect.top + dp(35),
              10,
              Ui.MUTED);
          hits.add(new Hit(rect, event.task, null));
        }
      }
    }
  }
}
