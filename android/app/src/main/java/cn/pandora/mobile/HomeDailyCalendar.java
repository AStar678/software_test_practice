package cn.pandora.mobile;

import static cn.pandora.mobile.Json.*;

import android.content.res.ColorStateList;
import android.graphics.drawable.RippleDrawable;
import android.util.LruCache;
import android.view.*;
import android.widget.*;
import java.time.LocalDate;
import java.time.temporal.ChronoUnit;
import java.util.HashMap;
import java.util.HashSet;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.function.BiConsumer;
import java.util.function.Consumer;
import org.json.JSONObject;

/** Two weeks under a fixed weekday header. Rows and date counts are loaded on demand. */
final class HomeDailyCalendar {
  private static final LocalDate FIRST = LocalDate.of(1, 1, 1);
  private static final LocalDate LAST = LocalDate.of(9999, 12, 31);
  static final int WEEK_COUNT = weekPosition(LAST) + 1;
  static final int VISIBLE_WEEKS = 2;
  private static final int WEEKS_PER_REQUEST = 8;
  private static final String[] WEEKDAYS = {"一", "二", "三", "四", "五", "六", "日"};

  private final MainActivity a;
  private final Ui u;
  private final LocalDate today;
  private final Consumer<LocalDate> onWeekChanged;
  private final BiConsumer<LocalDate, Runnable> onDay;
  private final int rowHeight;
  private final LruCache<Integer, Map<LocalDate, JSONObject>> counts = new LruCache<>(6);
  private final Runnable loadVisible = this::loadVisible;
  private ListView list;
  private TextView month, retry;
  private Weeks adapter;
  private int currentPosition;
  private final Set<Integer> failedBlocks = new HashSet<>();
  private boolean fetching;

  HomeDailyCalendar(MainActivity activity, LocalDate today, Consumer<LocalDate> onWeekChanged,
                    BiConsumer<LocalDate, Runnable> onDay) {
    a = activity;
    u = a.u;
    this.today = today;
    this.onWeekChanged = onWeekChanged;
    this.onDay = onDay;
    rowHeight = u.dp(52);
  }

  static int weekPosition(LocalDate date) {
    return (int) (ChronoUnit.DAYS.between(FIRST, date) / 7);
  }

  static LocalDate weekStart(int position) {
    return FIRST.plusWeeks(position);
  }

  void attach(LinearLayout card, LocalDate initial) {
    currentPosition = Math.min(weekPosition(initial), WEEK_COUNT - VISIBLE_WEEKS);
    card.setPadding(u.dp(6), card.getPaddingTop(), u.dp(6), card.getPaddingBottom());
    month = u.text(monthLabel(visibleWeek()), 14, Ui.MUTED);
    month.setTextIsSelectable(false);
    month.setPadding(u.dp(6), u.dp(4), 0, u.dp(8));
    card.addView(month);
    LinearLayout weekdays = u.row();
    for (String weekday : WEEKDAYS) {
      TextView label = u.text(weekday, 13, Ui.MUTED);
      label.setTextIsSelectable(false);
      label.setGravity(Gravity.CENTER);
      weekdays.addView(label, new LinearLayout.LayoutParams(0, u.dp(28), 1));
    }
    card.addView(weekdays);
    list = new ListView(a) {
      @Override public boolean dispatchTouchEvent(android.view.MotionEvent event) {
        int action = event.getActionMasked();
        if (action == MotionEvent.ACTION_DOWN) getParent().requestDisallowInterceptTouchEvent(true);
        boolean handled = super.dispatchTouchEvent(event);
        if (!handled || action == MotionEvent.ACTION_UP || action == MotionEvent.ACTION_CANCEL)
          getParent().requestDisallowInterceptTouchEvent(false);
        return handled;
      }
    };
    list.setPadding(0, 0, 0, 0);
    list.setDivider(null);
    list.setDividerHeight(0);
    list.setVerticalScrollBarEnabled(false);
    list.setItemsCanFocus(true);
    list.setContentDescription("每日事项周历，上下滑动浏览日期");
    adapter = new Weeks();
    list.setAdapter(adapter);
    list.setSelection(currentPosition);
    card.addView(list, new LinearLayout.LayoutParams(-1, VISIBLE_WEEKS * rowHeight));
    retry = u.button(card, "重新读取事项数量", false, () -> {
      failedBlocks.clear();
      retry.setVisibility(View.GONE);
      loadVisible();
    });
    retry.setVisibility(View.GONE);
    list.setOnScrollListener(new AbsListView.OnScrollListener() {
      @Override public void onScroll(AbsListView parent, int first, int visible, int total) {
        if (visible > 0 && parent.getChildCount() > 0) showPosition(nearestWeek(first));
      }

      @Override public void onScrollStateChanged(AbsListView parent, int state) {
        if (state != SCROLL_STATE_IDLE || parent.getChildCount() == 0) return;
        int position = nearestWeek(parent.getFirstVisiblePosition());
        if (parent.getChildAt(0).getTop() != 0) list.setSelectionFromTop(position, 0);
        showPosition(position);
      }
    });
    scheduleRead();
  }

  private int nearestWeek(int firstPosition) {
    int offset = -list.getChildAt(0).getTop();
    return Math.min(WEEK_COUNT - VISIBLE_WEEKS,
        firstPosition + (offset * 2 >= rowHeight ? 1 : 0));
  }

  private void showPosition(int position) {
    if (currentPosition == position) return;
    currentPosition = position;
    failedBlocks.removeIf(block -> block < firstVisibleBlock() || block > lastVisibleBlock());
    onWeekChanged.accept(visibleWeek());
    month.setText(monthLabel(visibleWeek()));
    updateRetry();
    scheduleRead();
  }

  private String monthLabel(LocalDate start) {
    LocalDate end = start.plusWeeks(VISIBLE_WEEKS).minusDays(1);
    if (end.isAfter(LAST)) end = LAST;
    String label = start.getYear() + "年" + start.getMonthValue() + "月";
    if (start.getYear() != end.getYear()) return label + " – " + end.getYear() + "年" + end.getMonthValue() + "月";
    return start.getMonth() == end.getMonth() ? label : label + " – " + end.getMonthValue() + "月";
  }

  LocalDate visibleWeek() { return weekStart(currentPosition); }

  void invalidateCounts() {
    if (!list.isAttachedToWindow()) return;
    counts.evictAll();
    failedBlocks.clear();
    updateRetry();
    adapter.notifyDataSetChanged();
    scheduleRead();
  }

  private void updateRetry() {
    retry.setVisibility(failedBlocks.contains(firstVisibleBlock()) || failedBlocks.contains(lastVisibleBlock())
        ? View.VISIBLE : View.GONE);
  }

  private int firstVisibleBlock() { return currentPosition / WEEKS_PER_REQUEST; }

  private int lastVisibleBlock() { return (currentPosition + VISIBLE_WEEKS - 1) / WEEKS_PER_REQUEST; }

  private void scheduleRead() {
    list.removeCallbacks(loadVisible);
    list.postDelayed(loadVisible, 100);
  }

  private void loadVisible() {
    if (!list.isAttachedToWindow() || fetching) return;
    int missing = firstVisibleBlock();
    int lastBlock = lastVisibleBlock();
    while (missing <= lastBlock && (counts.get(missing) != null || failedBlocks.contains(missing))) missing++;
    if (missing > lastBlock) return;
    final int block = missing;
    if (a.busy) {
      scheduleRead();
      return;
    }
    LocalDate first = weekStart(block * WEEKS_PER_REQUEST);
    LocalDate end = first.plusWeeks(WEEKS_PER_REQUEST).minusDays(1);
    LocalDate last = end.isAfter(LAST) ? LAST : end;
    fetching = true;
    a.run(() -> a.api.get("/daily-items/summary?from=" + first + "&to=" + last), result -> {
      fetching = false;
      if (!list.isAttachedToWindow()) return;
      Map<LocalDate, JSONObject> days = new HashMap<>();
      for (JSONObject day : rows(arr(result, "days"))) days.put(LocalDate.parse(s(day, "date")), day);
      counts.put(block, days);
      adapter.notifyDataSetChanged();
      scheduleRead();
    }, message -> {
      fetching = false;
      if (!list.isAttachedToWindow()) return;
      failedBlocks.add(block);
      updateRetry();
      scheduleRead();
    });
  }

  private final class Weeks extends BaseAdapter {
    @Override public int getCount() { return WEEK_COUNT; }
    @Override public LocalDate getItem(int position) { return weekStart(position); }
    @Override public long getItemId(int position) { return position; }
    @Override public boolean hasStableIds() { return true; }

    @Override public View getView(int position, View recycled, ViewGroup parent) {
      LinearLayout week = recycled instanceof LinearLayout row ? row : makeRow();
      Map<LocalDate, JSONObject> days = counts.get(position / WEEKS_PER_REQUEST);
      for (int index = 0; index < 7; index++) {
        Button button = (Button) week.getChildAt(index);
        LocalDate date = getItem(position).plusDays(index);
        JSONObject info = days == null ? null : days.get(date);
        int open = info == null ? 0 : info.optInt("openCount");
        int done = info == null ? 0 : info.optInt("completedCount");
        boolean isToday = date.equals(today);
        button.setVisibility(date.isAfter(LAST) ? View.INVISIBLE : View.VISIBLE);
        button.setText(String.format(Locale.ROOT, "%d%s", date.getDayOfMonth(),
            open + done == 0 ? "" : "\n•"));
        button.setTextColor(isToday ? Ui.PRIMARY : Ui.INK);
        button.setContentDescription(date + "，周" + WEEKDAYS[index] + (isToday ? "，今天" : "")
            + (days == null ? "，事项数量待读取" : "，未完成 " + open + " 项，已完成 " + done + " 项"));
        button.setBackground(new RippleDrawable(ColorStateList.valueOf(Ui.CONTAINER),
            u.shape(isToday ? Ui.CONTAINER : Ui.SURFACE, 10), null));
        button.setOnClickListener(v -> { if (!a.busy) onDay.accept(date, HomeDailyCalendar.this::invalidateCounts); });
      }
      return week;
    }

    private LinearLayout makeRow() {
      LinearLayout week = u.row();
      week.setLayoutParams(new AbsListView.LayoutParams(-1, rowHeight));
      for (int i = 0; i < 7; i++) {
        Button cell = new Button(a);
        cell.setAllCaps(false);
        cell.setTextSize(14);
        cell.setMinWidth(0);
        cell.setMinimumWidth(0);
        cell.setPadding(0, 0, 0, 0);
        cell.setStateListAnimator(null);
        week.addView(cell, new LinearLayout.LayoutParams(0, -1, 1));
      }
      return week;
    }
  }
}
