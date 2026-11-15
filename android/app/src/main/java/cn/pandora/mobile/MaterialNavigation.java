package cn.pandora.mobile;

import android.content.Context;
import android.content.res.ColorStateList;
import android.graphics.Color;
import android.graphics.Typeface;
import android.graphics.drawable.GradientDrawable;
import android.graphics.drawable.RippleDrawable;
import android.view.Gravity;
import android.view.View;
import android.widget.ImageView;
import android.widget.LinearLayout;
import android.widget.TextView;
import java.util.function.Consumer;

/** Five destinations with Material 3 active pills, touch targets and spoken selected states. */
final class MaterialNavigation extends LinearLayout {
  private final String[] pages = {"map", "view", "log", "ai", "me"};
  private final LinearLayout[] tabs = new LinearLayout[5];
  private final ImageView[] icons = new ImageView[5];
  private final TextView[] labels = new TextView[5];

  MaterialNavigation(Context context, Consumer<String> navigate) {
    super(context);
    setOrientation(HORIZONTAL);
    setGravity(Gravity.CENTER_VERTICAL);
    setBackgroundColor(Color.rgb(238, 243, 237));
    setPadding(dp(4), dp(8), dp(4), dp(8));
    String[] names = {"工作台", "日程", "记录", "统计", "我的"};
    int[] resources = {
      R.drawable.ic_home,
      R.drawable.ic_calendar,
      R.drawable.ic_log,
      R.drawable.ic_analytics,
      R.drawable.ic_person
    };
    for (int i = 0; i < pages.length; i++) {
      final String page = pages[i];
      LinearLayout tab = new LinearLayout(context);
      tabs[i] = tab;
      tab.setOrientation(VERTICAL);
      tab.setGravity(Gravity.CENTER);
      tab.setContentDescription(names[i]);
      tab.setFocusable(true);
      tab.setBackground(new RippleDrawable(ColorStateList.valueOf(0x19006b54), null, null));
      tab.setOnClickListener(v -> navigate.accept(page));
      ImageView icon = new ImageView(context);
      icons[i] = icon;
      icon.setImageResource(resources[i]);
      icon.setPadding(dp(20), dp(4), dp(20), dp(4));
      icon.setImportantForAccessibility(View.IMPORTANT_FOR_ACCESSIBILITY_NO);
      tab.addView(icon, new LayoutParams(dp(64), dp(32)));
      TextView label = new TextView(context);
      labels[i] = label;
      label.setText(names[i]);
      label.setTextSize(12);
      label.setGravity(Gravity.CENTER);
      label.setImportantForAccessibility(View.IMPORTANT_FOR_ACCESSIBILITY_NO);
      LayoutParams textParams = new LayoutParams(LayoutParams.MATCH_PARENT, dp(24));
      textParams.topMargin = dp(4);
      tab.addView(label, textParams);
      addView(tab, new LayoutParams(0, LayoutParams.MATCH_PARENT, 1));
    }
    select("map");
  }

  void select(String page) {
    for (int i = 0; i < pages.length; i++) {
      boolean selected = pages[i].equals(page);
      tabs[i].setSelected(selected);
      GradientDrawable pill = new GradientDrawable();
      pill.setCornerRadius(dp(20));
      pill.setColor(selected ? 0xffc1ecd9 : Color.TRANSPARENT);
      icons[i].setBackground(pill);
      icons[i].setColorFilter(selected ? 0xff002117 : 0xff3f4945);
      labels[i].setTextColor(selected ? 0xff191c1b : 0xff3f4945);
      labels[i].setTypeface(null, selected ? Typeface.BOLD : Typeface.NORMAL);
    }
  }

  private int dp(int value) {
    return Math.round(value * getResources().getDisplayMetrics().density);
  }
}
