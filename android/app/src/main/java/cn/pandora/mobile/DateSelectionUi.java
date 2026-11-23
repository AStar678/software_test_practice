package cn.pandora.mobile;

import android.view.Gravity;
import android.view.View;
import android.widget.AdapterView;
import android.widget.Button;
import android.widget.LinearLayout;
import android.widget.Spinner;
import android.widget.TextView;
import java.time.LocalDate;
import java.time.LocalTime;
import java.time.YearMonth;
import java.util.function.Consumer;

/** Date and time selection built from the app's own controls. */
final class DateSelectionUi {
  private final MainActivity a;
  private final Ui u;

  DateSelectionUi(MainActivity a, Ui u) {
    this.a = a;
    this.u = u;
  }

  void date(String label, LocalDate initial, boolean monthOnly, Consumer<LocalDate> accepted) {
    MainActivity.Panel panel = a.panel(label, 1, monthOnly ? .47f : .76f, Gravity.BOTTOM, "取消");
    LinearLayout selectors = u.row();
    panel.body.addView(selectors);
    int firstYear = Math.max(1, initial.getYear() - 100);
    int lastYear = Math.min(9999, initial.getYear() + 100);
    Spinner year = part(selectors, "年", firstYear, lastYear, initial.getYear(), false);
    Spinner month = part(selectors, "月", 1, 12, initial.getMonthValue(), false);

    int[] selectedDay = {initial.getDayOfMonth()};
    if (!monthOnly) {
      LinearLayout grid = u.column();
      panel.body.addView(grid);
      Runnable render = () -> {
        YearMonth selected = selectedMonth(year, month, firstYear);
        selectedDay[0] = Math.min(selectedDay[0], selected.lengthOfMonth());
        grid.removeAllViews();
        LinearLayout weekdays = u.row();
        for (String weekday : new String[] {"一", "二", "三", "四", "五", "六", "日"}) {
          TextView text = u.text(weekday, 13, Ui.MUTED);
          text.setGravity(Gravity.CENTER);
          weekdays.addView(text, new LinearLayout.LayoutParams(0, u.dp(34), 1));
        }
        grid.addView(weekdays);
        int leading = selected.atDay(1).getDayOfWeek().getValue() - 1;
        for (int week = 0; week * 7 < selected.lengthOfMonth() + leading; week++) {
          LinearLayout row = u.row();
          grid.addView(row);
          for (int col = 0; col < 7; col++) {
            int day = week * 7 + col - leading + 1;
            LinearLayout.LayoutParams slot = new LinearLayout.LayoutParams(0, u.dp(45), 1);
            if (day < 1 || day > selected.lengthOfMonth()) {
              row.addView(new View(a), slot);
              continue;
            }
            Button cell = new Button(a);
            cell.setText(String.valueOf(day));
            cell.setContentDescription(selected.atDay(day).toString());
            cell.setTextColor(Ui.INK);
            cell.setPadding(0, 0, 0, 0);
            cell.setMinimumWidth(0);
            cell.setMinWidth(0);
            cell.setStateListAnimator(null);
            cell.setSelected(day == selectedDay[0]);
            cell.setBackground(u.shape(cell.isSelected() ? Ui.CONTAINER : Ui.SURFACE, 9));
            cell.setOnClickListener(v -> {
              selectedDay[0] = day;
              for (int r = 1; r < grid.getChildCount(); r++) {
                LinearLayout weekRow = (LinearLayout) grid.getChildAt(r);
                for (int i = 0; i < weekRow.getChildCount(); i++) {
                  if (weekRow.getChildAt(i) instanceof Button button) {
                    button.setSelected(button == cell);
                    button.setBackground(u.shape(button == cell ? Ui.CONTAINER : Ui.SURFACE, 9));
                  }
                }
              }
            });
            row.addView(cell, slot);
          }
        }
      };
      AdapterView.OnItemSelectedListener changes = new AdapterView.OnItemSelectedListener() {
        @Override public void onItemSelected(AdapterView<?> parent, View view, int position, long id) {
          render.run();
        }

        @Override public void onNothingSelected(AdapterView<?> parent) {}
      };
      year.setOnItemSelectedListener(changes);
      month.setOnItemSelectedListener(changes);
      render.run();
    }

    u.button(panel.actions, "确定", true, () -> {
      YearMonth selected = selectedMonth(year, month, firstYear);
      LocalDate date = selected.atDay(monthOnly ? 1 : Math.min(selectedDay[0], selected.lengthOfMonth()));
      panel.dialog.dismiss();
      accepted.accept(date);
    });
  }

  void time(String label, LocalTime initial, Consumer<LocalTime> accepted) {
    MainActivity.Panel panel = a.panel(label, 1, .44f, Gravity.BOTTOM, "取消");
    LinearLayout selectors = u.row();
    panel.body.addView(selectors);
    Spinner hour = part(selectors, "时", 0, 23, initial.getHour(), true);
    Spinner minute = part(selectors, "分", 0, 59, initial.getMinute(), true);
    u.button(panel.actions, "确定", true, () -> {
      panel.dialog.dismiss();
      accepted.accept(LocalTime.of(hour.getSelectedItemPosition(), minute.getSelectedItemPosition()));
    });
  }

  private Spinner part(LinearLayout row, String label, int first, int last, int selected, boolean padded) {
    LinearLayout column = u.column();
    row.addView(column, new LinearLayout.LayoutParams(0, -2, 1));
    String[] labels = new String[last - first + 1];
    for (int i = first; i <= last; i++) {
      labels[i - first] = (padded && i < 10 ? "0" : "") + i + label;
    }
    return u.spinner(column, label, labels, selected - first);
  }

  private YearMonth selectedMonth(Spinner year, Spinner month, int firstYear) {
    return YearMonth.of(firstYear + Math.max(0, year.getSelectedItemPosition()),
        1 + Math.max(0, month.getSelectedItemPosition()));
  }
}
