package cn.pandora.mobile;

import android.app.*;
import android.content.*;
import android.content.res.ColorStateList;
import android.graphics.Typeface;
import android.graphics.drawable.*;
import android.text.*;
import android.view.*;
import android.widget.*;
import java.time.*;
import java.util.*;
import java.util.function.*;

/** Native Android Views styled with Material roles, shapes and 48dp minimum targets. */
final class Ui {
  static final int BG = 0xfff8faf8,
      SURFACE = 0xffffffff,
      INK = 0xff191c1b,
      MUTED = 0xff5f6964,
      PRIMARY = 0xff006b54,
      CONTAINER = 0xffc1ecd9,
      LINE = 0xffdbe5de,
      ERROR = 0xffba1a1a;
  final MainActivity a;

  Ui(MainActivity activity) {
    a = activity;
  }

  int dp(float v) {
    return Math.round(v * a.getResources().getDisplayMetrics().density);
  }

  LinearLayout column() {
    LinearLayout l = new LinearLayout(a);
    l.setOrientation(LinearLayout.VERTICAL);
    l.setLayoutParams(new LinearLayout.LayoutParams(-1, -2));
    return l;
  }

  LinearLayout row() {
    LinearLayout l = new LinearLayout(a);
    l.setGravity(Gravity.CENTER_VERTICAL);
    l.setLayoutParams(new LinearLayout.LayoutParams(-1, -2));
    return l;
  }

  TextView text(String value, int size, int color) {
    TextView t = new TextView(a);
    t.setText(value);
    t.setTextSize(size);
    t.setTextColor(color);
    t.setLineSpacing(dp(2), 1);
    t.setTextIsSelectable(true);
    return t;
  }

  void heading(LinearLayout into, String value) {
    TextView t = text(value, 20, INK);
    t.setPadding(0, dp(16), 0, dp(12));
    into.addView(t);
  }

  void note(LinearLayout into, String value) {
    TextView t = text(value, 14, MUTED);
    t.setPadding(0, dp(6), 0, dp(12));
    into.addView(t);
  }

  GradientDrawable shape(int color, int radius) {
    GradientDrawable d = new GradientDrawable();
    d.setColor(color);
    d.setCornerRadius(dp(radius));
    return d;
  }

  LinearLayout card(LinearLayout into) {
    LinearLayout c = column();
    c.setPadding(dp(16), dp(12), dp(16), dp(16));
    GradientDrawable d = shape(SURFACE, 16);
    d.setStroke(dp(1), LINE);
    c.setBackground(d);
    LinearLayout.LayoutParams lp = new LinearLayout.LayoutParams(-1, -2);
    lp.bottomMargin = dp(12);
    into.addView(c, lp);
    return c;
  }

  Button button(LinearLayout into, String label, boolean filled, Runnable action) {
    Button b = new Button(a);
    b.setText(label);
    b.setTextSize(14);
    b.setAllCaps(false);
    b.setTextColor(filled ? SURFACE : PRIMARY);
    b.setMinHeight(dp(48));
    b.setMinimumHeight(dp(48));
    b.setPadding(dp(16), dp(8), dp(16), dp(8));
    GradientDrawable d = shape(filled ? PRIMARY : 0xffeef3ed, 24);
    b.setBackground(new RippleDrawable(ColorStateList.valueOf(0x22006b54), d, null));
    LinearLayout.LayoutParams lp = new LinearLayout.LayoutParams(-1, -2);
    lp.topMargin = dp(8);
    into.addView(b, lp);
    b.setOnClickListener(
        v -> {
          if (!a.busy) action.run();
        });
    return b;
  }

  void item(LinearLayout into, String title, String detail, Runnable action) {
    LinearLayout box = column();
    box.setPadding(dp(4), dp(12), dp(4), dp(12));
    TextView t = text(title, 16, INK);
    t.setTypeface(null, Typeface.BOLD);
    t.setTextIsSelectable(false);
    box.addView(t);
    if (detail != null && !detail.isBlank()) {
      TextView meta = text(detail, 13, MUTED);
      meta.setTextIsSelectable(false);
      box.addView(meta);
    }
    if (action != null) {
      box.setBackground(
          new RippleDrawable(ColorStateList.valueOf(0x15006b54), shape(SURFACE, 8), null));
      box.setClickable(true);
      box.setFocusable(true);
      box.setContentDescription(title + "，" + (detail == null ? "" : detail));
      box.setOnClickListener(
          v -> {
            if (!a.busy) action.run();
          });
    }
    into.addView(box);
    View line = new View(a);
    line.setBackgroundColor(LINE);
    into.addView(line, new LinearLayout.LayoutParams(-1, dp(1)));
  }

  EditText field(LinearLayout into, String label, String value, int max, boolean multiline) {
    TextView l = text(label, 13, MUTED);
    l.setPadding(0, dp(12), 0, dp(6));
    into.addView(l);
    EditText e = new EditText(a);
    e.setTextSize(16);
    e.setTextColor(INK);
    e.setSingleLine(!multiline);
    e.setInputType(
        multiline
            ? android.text.InputType.TYPE_CLASS_TEXT
                | android.text.InputType.TYPE_TEXT_FLAG_MULTI_LINE
            : android.text.InputType.TYPE_CLASS_TEXT);
    e.setText(value);
    e.setFilters(new InputFilter[] {new InputFilter.LengthFilter(max)});
    e.setGravity(Gravity.TOP | Gravity.START);
    e.setMinHeight(dp(multiline ? 112 : 56));
    e.setPadding(dp(14), dp(14), dp(14), dp(14));
    GradientDrawable d = shape(SURFACE, 4);
    d.setStroke(dp(1), MUTED);
    e.setBackground(d);
    e.setContentDescription(label);
    into.addView(e, new LinearLayout.LayoutParams(-1, -2));
    l.setLabelFor(e.getId() == View.NO_ID ? generateId(e) : e.getId());
    return e;
  }

  private int generateId(View v) {
    int id = View.generateViewId();
    v.setId(id);
    return id;
  }

  Spinner spinner(LinearLayout into, String label, String[] values, int selected) {
    note(into, label);
    Spinner s = new Spinner(a, Spinner.MODE_DIALOG);
    s.setContentDescription(label);
    ArrayAdapter<String> adapter =
        new ArrayAdapter<>(a, android.R.layout.simple_spinner_dropdown_item, values);
    s.setAdapter(adapter);
    s.setSelection(Math.max(0, selected));
    s.setMinimumHeight(dp(48));
    into.addView(s, new LinearLayout.LayoutParams(-1, -2));
    return s;
  }

  void search(LinearLayout into, String hint, Consumer<String> update) {
    EditText e = field(into, hint, "", 200, false);
    e.setHint(hint);
    e.addTextChangedListener(
        new TextWatcher() {
          public void beforeTextChanged(CharSequence s, int start, int count, int after) {}

          public void onTextChanged(CharSequence s, int start, int before, int count) {
            update.accept(s.toString());
          }

          public void afterTextChanged(Editable e) {}
        });
  }

  void dateTime(LinearLayout into, String label, LocalDateTime[] value, int index) {
    LinearLayout row = row();
    Button date = new Button(a), time = new Button(a);
    date.setAllCaps(false);
    time.setAllCaps(false);
    Runnable show =
        () -> {
          date.setText(value[index].toLocalDate().toString());
          time.setText(value[index].toLocalTime().withSecond(0).withNano(0).toString());
        };
    show.run();
    date.setContentDescription(label + "日期");
    time.setContentDescription(label + "时刻");
    date.setOnClickListener(
        v -> {
          LocalDate d = value[index].toLocalDate();
          new DatePickerDialog(
                  a,
                  (p, y, m, day) -> {
                    value[index] =
                        value[index]
                            .withDayOfMonth(1)
                            .withYear(y)
                            .withMonth(m + 1)
                            .withDayOfMonth(day);
                    show.run();
                  },
                  d.getYear(),
                  d.getMonthValue() - 1,
                  d.getDayOfMonth())
              .show();
        });
    time.setOnClickListener(
        v ->
            new TimePickerDialog(
                    a,
                    (p, h, m) -> {
                      value[index] = value[index].withHour(h).withMinute(m);
                      show.run();
                    },
                    value[index].getHour(),
                    value[index].getMinute(),
                    true)
                .show());
    note(into, label);
    row.addView(date, new LinearLayout.LayoutParams(0, dp(56), 1));
    row.addView(time, new LinearLayout.LayoutParams(0, dp(56), 1));
    into.addView(row);
  }

  static String value(EditText e) {
    return e.getText().toString().trim();
  }
}
