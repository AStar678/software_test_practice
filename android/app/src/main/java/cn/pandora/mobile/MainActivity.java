package cn.pandora.mobile;

import static cn.pandora.mobile.Json.*;

import android.app.*;
import android.content.*;
import android.content.res.Configuration;
import android.graphics.Insets;
import android.os.*;
import android.text.InputType;
import android.view.*;
import android.widget.*;
import java.util.*;
import java.util.concurrent.*;
import java.util.function.*;
import org.json.*;

/** Entire client is built with native Android Views. */
public final class MainActivity extends Activity {
  ApiClient api;
  Ui u;
  TasksUi tasksUi;
  TaskTableUi taskTable;
  WorkspaceUi workspaceUi;
  CalendarUi calendarUi;
  JSONObject me = new JSONObject(),
      home = new JSONObject(),
      analytics = new JSONObject(),
      authors = new JSONObject();
  JSONArray tasks = new JSONArray(),
      users = new JSONArray(),
      approvals = new JSONArray(),
      logs = new JSONArray(),
      reports = new JSONArray(),
      notifications = new JSONArray();
  final Map<String, String> participantNames = new ConcurrentHashMap<>();
  boolean busy, ready, destroyed;
  String page = "map";
  private final ExecutorService worker = Executors.newSingleThreadExecutor();
  private LinearLayout root, body;
  private FrameLayout content;
  private ProgressBar loading;
  private MaterialNavigation navigation;
  private SessionStore sessions;
  private Button homeBell;
  final List<Panel> panels = new ArrayList<>();

  interface Job<T> {
    T run() throws Exception;
  }

  @Override
  public void onCreate(Bundle state) {
    super.onCreate(state);
    api = new ApiClient(BuildConfig.START_URL);
    u = new Ui(this);
    tasksUi = new TasksUi(this);
    workspaceUi = new WorkspaceUi(this);
    calendarUi = new CalendarUi(this);
    sessions = new SessionStore(this);
    layout();
    restoreSession();
    if (Build.VERSION.SDK_INT >= 33)
      getOnBackInvokedDispatcher()
          .registerOnBackInvokedCallback(
              android.window.OnBackInvokedDispatcher.PRIORITY_DEFAULT, this::back);
  }

  @SuppressWarnings("deprecation")
  private void layout() {
    root = u.column();
    root.setBackgroundColor(Ui.BG);
    loading = new ProgressBar(this, null, android.R.attr.progressBarStyleHorizontal);
    loading.setIndeterminate(true);
    loading.setVisibility(View.GONE);
    root.addView(loading, new LinearLayout.LayoutParams(-1, u.dp(3)));
    content = new FrameLayout(this);
    root.addView(content, new LinearLayout.LayoutParams(-1, 0, 1));
    navigation = new MaterialNavigation(this, this::navigate);
    navigation.setVisibility(View.GONE);
    root.addView(navigation, new LinearLayout.LayoutParams(-1, u.dp(80)));
    setContentView(root);
    if (Build.VERSION.SDK_INT >= 30) {
      getWindow().setDecorFitsSystemWindows(false);
      root.setOnApplyWindowInsetsListener(
          (v, insets) -> {
            Insets
                bars =
                    insets.getInsets(
                        WindowInsets.Type.systemBars() | WindowInsets.Type.displayCutout()),
                ime = insets.getInsets(WindowInsets.Type.ime());
            v.setPadding(bars.left, bars.top, bars.right, Math.max(bars.bottom, ime.bottom));
            navigation.setVisibility(ready && ime.bottom <= bars.bottom ? View.VISIBLE : View.GONE);
            return insets;
          });
      getWindow()
          .getInsetsController()
          .setSystemBarsAppearance(
              WindowInsetsController.APPEARANCE_LIGHT_STATUS_BARS
                  | WindowInsetsController.APPEARANCE_LIGHT_NAVIGATION_BARS,
              WindowInsetsController.APPEARANCE_LIGHT_STATUS_BARS
                  | WindowInsetsController.APPEARANCE_LIGHT_NAVIGATION_BARS);
    } else root.setFitsSystemWindows(true);
  }

  LinearLayout page(String label) {
    if (Build.VERSION.SDK_INT >= 28) content.setAccessibilityPaneTitle(label);
    homeBell = null;
    content.removeAllViews();
    ScrollView scroll = new ScrollView(this);
    scroll.setFillViewport(true);
    body = u.column();
    body.setPadding(u.dp(16), 0, u.dp(16), u.dp(24));
    scroll.addView(body);
    content.addView(scroll, new FrameLayout.LayoutParams(-1, -1));
    return body;
  }

  LinearLayout fixedPage(String label) {
    if (Build.VERSION.SDK_INT >= 28) content.setAccessibilityPaneTitle(label);
    homeBell = null;
    content.removeAllViews();
    body = u.column();
    body.setPadding(u.dp(12), 0, u.dp(12), 0);
    content.addView(body, new FrameLayout.LayoutParams(-1, -1));
    return body;
  }

  void floatingCreate(Runnable create) {
    Button button = new Button(this);
    button.setText("＋");
    button.setTextSize(26);
    button.setTextColor(Ui.SURFACE);
    button.setContentDescription("创建任务");
    button.setPadding(0, 0, 0, 0);
    button.setBackground(u.shape(Ui.PRIMARY, 20));
    button.setElevation(u.dp(4));
    button.setOnClickListener(v -> { if (!busy) create.run(); });
    FrameLayout.LayoutParams lp = new FrameLayout.LayoutParams(
        u.dp(52), u.dp(52), Gravity.BOTTOM | Gravity.END);
    lp.setMargins(0, 0, u.dp(18), u.dp(20));
    content.addView(button, lp);
  }

  void navigate(String destination) {
    if (!ready || busy) return;
    taskTable = null;
    page = destination;
    navigation.select(page);
    switch (page) {
      case "view" -> calendarUi.show();
      case "log" -> workspaceUi.logsPage();
      case "ai" -> workspaceUi.stats();
      case "me" -> workspaceUi.profilePage();
      default -> dashboard();
    }
  }

  void updateBell() {
    if (homeBell == null) return;
    long unread = rows(notifications).stream().filter(n -> s(n, "readAt").isEmpty()).count();
    homeBell.setCompoundDrawablesRelativeWithIntrinsicBounds(
        unread == 0 ? R.drawable.ic_notifications : R.drawable.ic_notifications_unread, 0, 0, 0);
    homeBell.setContentDescription(unread == 0 ? "通知" : "通知，" + unread + "条未读");
  }

  void reload() {
    run(
        this::load,
        unused -> {
          workspaceUi.reset();
          navigate(page);
        });
  }

  private Void load() throws Exception {
    JSONObject nextMe = api.get("/me");
    if ("admin".equals(s(nextMe, "role")))
      throw new IllegalArgumentException("此应用供业务账号使用，请使用业务账号登录。");
    JSONArray nextTasks = api.all("/tasks"),
        nextUsers = api.all("/users"),
        nextApprovals = api.all("/approval-requests?mine=all"),
        nextLogs = api.all("/work-logs?scope=self");
    JSONArray nextNotifications = api.all("/notifications");
    JSONObject nextHome = api.get("/home"),
        nextStats = api.get("/analytics/task-summary?scope=visible"),
        nextAuthors = api.get("/work-log-authors");
    JSONArray nextReports = arr(api.get("/me/reports"), "items");
    try {
      CalendarUi.ZONE = java.time.ZoneId.of(s(nextMe, "organizationTimeZone"));
    } catch (Exception invalid) {
      throw new java.io.IOException("公司时区无效，请联系管理员。");
    }
    participantNames.clear();
    me = nextMe;
    tasks = nextTasks;
    users = nextUsers;
    approvals = nextApprovals;
    logs = nextLogs;
    home = nextHome;
    analytics = nextStats;
    authors = nextAuthors;
    reports = nextReports;
    notifications = nextNotifications;
    return null;
  }

  <T> void run(Job<T> job, Consumer<T> success) {
    run(job, success, this::error);
  }

  <T> void run(Job<T> job, Consumer<T> success, Consumer<String> failure) {
    if (busy || destroyed) return;
    busy = true;
    loading.setVisibility(View.VISIBLE);
    int epoch = api.epoch;
    worker.execute(
        () -> {
          try {
            T result = job.run();
            runOnUiThread(
                () -> {
                  if (destroyed || epoch != api.epoch) return;
                  busy = false;
                  loading.setVisibility(View.GONE);
                  success.accept(result);
                });
          } catch (Exception error) {
            runOnUiThread(
                () -> {
                  if (destroyed || epoch != api.epoch) return;
                  busy = false;
                  loading.setVisibility(View.GONE);
                  if (error instanceof ApiClient.Failure f
                      && f.status == 401
                      && !api.token.isEmpty()) {
                    sessions.forget();
                    api.clear();
                    clear();
                    login("登录已过期，请重新登录。");
                  } else if (error instanceof ApiClient.Failure f
                      && "PASSWORD_CHANGE_REQUIRED".equals(f.code)) {
                    clear();
                    password(true);
                  } else
                    failure.accept(error.getMessage() == null ? "无法连接服务器，请检查网络后重试。" : error.getMessage());
                });
          }
        });
  }

  void write(String slot, String method, String endpoint, JSONObject data, String etag) {
    run(
        () -> {
          JSONObject result = api.mutate(slot, method, endpoint, data, etag);
          load();
          return result;
        },
        result -> {
          workspaceUi.reset();
          closePanels();
          if (taskTable == null) navigate(page);
          else taskTable.refresh();
          toast(s(result, "message").isEmpty() ? "操作已保存" : s(result, "message"));
        });
  }

  void error(String message) {
    if (!panels.isEmpty()) panels.get(panels.size() - 1).error.setText(message);
    else {
      u.note(body, message);
    }
    toast(message);
  }

  void toast(String message) {
    Toast.makeText(this, message, Toast.LENGTH_LONG).show();
  }

  private void restoreSession() {
    String saved = sessions.restore();
    if (saved.isEmpty()) {
      login("");
      return;
    }
    api.epoch++;
    api.token = saved;
    loadSignedInWorkspace("正在恢复登录…");
  }

  private void loadSignedInWorkspace(String message) {
    LinearLayout box = page("正在进入工作台");
    u.heading(box, "潘多拉");
    u.note(box, message);
    run(this::load, unused -> {
      ready = true;
      navigation.setVisibility(View.VISIBLE);
      navigate("map");
    }, error -> {
      if (!box.isAttachedToWindow()) return;
      u.note(box, error);
      u.button(box, "重试", true, () -> loadSignedInWorkspace("正在恢复登录…"));
      u.button(box, "换个账号登录", false, this::logout);
    });
  }

  void login(String message) {
    ready = false;
    navigation.setVisibility(View.GONE);
    LinearLayout box = page("登录");
    u.heading(box, "潘多拉");
    u.heading(box, "让每一天，有序向前。");
    u.note(box, "登录你的工作台，查看任务与团队动态。");
    if (!message.isEmpty()) u.note(box, message);
    EditText user = u.field(box, "登录手机号", "", 80, false),
        password = u.field(box, "密码", "", 100, false);
    user.setId(R.id.login_username);
    user.setInputType(InputType.TYPE_CLASS_PHONE);
    password.setId(R.id.login_password);
    password.setInputType(InputType.TYPE_CLASS_TEXT | InputType.TYPE_TEXT_VARIATION_PASSWORD);
    u.button(
        box,
        "登录工作台",
        true,
        () -> {
          if (Ui.value(user).isEmpty() || password.getText().length() == 0) {
            error("请输入手机号和密码。");
            return;
          }
          String phone = Ui.value(user), passwordValue = password.getText().toString();
          run(
              () ->
                  api.post(
                      "/auth/sessions",
                      obj("accountType", "employee", "phone", phone, "password", passwordValue)),
              result -> {
                api.epoch++;
                api.token = s(result, "token");
                boolean saved = sessions.save(api.token);
                if (!saved) toast("本机暂时无法保存登录状态。");
                if (result.optBoolean("passwordChangeRequired")
                    || child(result, "user").optBoolean("mustChangePassword")) {
                  password(true);
                  return;
                }
                loadSignedInWorkspace("正在加载工作台…");
              });
        });
    u.note(box, "使用管理员登记的手机号登录。忘记密码请联系管理员。");
  }

  void password(boolean forced) {
    LinearLayout box;
    Panel panel = null;
    if (forced) {
      ready = false;
      navigation.setVisibility(View.GONE);
      box = page("修改初始密码");
    } else {
      panel = panel("修改密码");
      box = panel.body;
    }
    EditText current = u.field(box, "当前密码", "", 100, false),
        next = u.field(box, "新密码", "", 100, false),
        confirm = u.field(box, "确认新密码", "", 100, false);
    for (EditText e : List.of(current, next, confirm))
      e.setInputType(InputType.TYPE_CLASS_TEXT | InputType.TYPE_TEXT_VARIATION_PASSWORD);
    u.note(box, "至少10个字符，同时包含字母和数字，UTF-8 长度不超过72字节。修改后需重新登录。");
    u.button(
        box,
        "修改密码",
        true,
        () -> {
          String value = next.getText().toString();
          if (!value.equals(confirm.getText().toString())) {
            error("两次新密码不一致。");
            return;
          }
          if (value.length() < 10
              || value.getBytes(java.nio.charset.StandardCharsets.UTF_8).length > 72
              || !value.matches("(?s).*[A-Za-z].*")
              || !value.matches("(?s).*[0-9].*")) {
            error("新密码不符合要求。");
            return;
          }
          String currentValue = current.getText().toString();
          run(
              () ->
                  api.post(
                      "/auth/password", obj("currentPassword", currentValue, "newPassword", value)),
              r -> {
                sessions.forget();
                api.clear();
                clear();
                login("密码已修改，请使用新密码登录。");
              });
        });
    if (forced) u.button(box, "退出登录", false, this::logout);
  }

  void logout() {
    if (busy) return;
    sessions.forget();
    Runnable finish = () -> {
      api.clear();
      clear();
      login("");
    };
    run(() -> api.request("DELETE", "/auth/sessions/current", null, null, null),
        response -> finish.run(), error -> finish.run());
  }

  private void clear() {
    participantNames.clear();
    closePanels();
    ready = false;
    me = new JSONObject();
    tasks = new JSONArray();
    users = new JSONArray();
    logs = new JSONArray();
    approvals = new JSONArray();
    reports = new JSONArray();
    notifications = new JSONArray();
    calendarUi.reset();
    taskTable = null;
    home = new JSONObject();
    analytics = new JSONObject();
    authors = new JSONObject();
    workspaceUi.reset();
  }

  void dashboard() {
    LinearLayout homePage = fixedPage("工作台");
    homePage.setPadding(u.dp(16), 0, u.dp(16), 0);
    LinearLayout heading = u.row();
    heading.setPadding(0, u.dp(8), 0, 0);
    java.time.LocalDate today = workspaceUi.businessDate();
    String weekday = today.getDayOfWeek().getDisplayName(
        java.time.format.TextStyle.FULL, Locale.SIMPLIFIED_CHINESE);
    LinearLayout dateBlock = u.column();
    heading.addView(dateBlock, new LinearLayout.LayoutParams(0, -2, 1));
    heading.setGravity(Gravity.TOP);
    homeBell = new Button(this);
    homeBell.setId(R.id.home_notifications);
    homeBell.setPadding(u.dp(12), 0, 0, 0);
    homeBell.setGravity(Gravity.CENTER_VERTICAL | Gravity.START);
    homeBell.setStateListAnimator(null);
    homeBell.setBackground(u.shape(Ui.CONTAINER, 20));
    homeBell.setOnClickListener(v -> {
      if (ready && !busy) workspaceUi.notifications();
    });
    heading.addView(homeBell, new LinearLayout.LayoutParams(u.dp(48), u.dp(48)));
    updateBell();
    TextView date = u.text(today.getMonthValue() + "月" + today.getDayOfMonth() + "日", 26, Ui.INK);
    date.setTypeface(null, android.graphics.Typeface.BOLD);
    dateBlock.addView(date);
    u.note(dateBlock, weekday);
    homePage.addView(heading);
    ScrollView scroll = new ScrollView(this);
    LinearLayout box = u.column();
    box.setPadding(0, 0, 0, u.dp(24));
    scroll.addView(box);
    homePage.addView(scroll, new LinearLayout.LayoutParams(-1, 0, 1));
    List<JSONObject> events = rows(arr(home, "companyItems"));
    List<JSONObject> assigned = rows(arr(home, "assignedTasks"));
    LinearLayout previews = u.row();
    previews.setBaselineAligned(false);
    previews.setGravity(Gravity.TOP);
    box.addView(previews);
    LinearLayout company = dashboardPreview(previews, R.id.dashboard_company, "事件纪", "统一发布");
    if (events.isEmpty()) u.note(company, "暂无公司事件");
    for (JSONObject event : events.subList(0, Math.min(3, events.size())))
      preview(company, s(event, "body").isBlank() ? eventTitle(event) : s(event, "body"),
          () -> openHomeEvents(events));

    LinearLayout board = dashboardPreview(previews, R.id.dashboard_tasks, "任务看板", assigned.size() + "/10");
    if (assigned.isEmpty()) u.note(board, "暂无本人负责的未完成任务");
    for (JSONObject task : assigned.subList(0, Math.min(3, assigned.size())))
      preview(board, s(task, "title"), () -> openHomeBoard(assigned));


    LinearLayout personal = u.card(box);
    personal.setId(R.id.dashboard_personal);
    workspaceUi.dailyItems(personal);

  }

  private LinearLayout dashboardPreview(LinearLayout row, int id, String heading, String detail) {
    LinearLayout shell = u.column();
    LinearLayout.LayoutParams params = new LinearLayout.LayoutParams(0, -2, 1);
    params.setMargins(u.dp(3), 0, u.dp(3), 0);
    row.addView(shell, params);
    LinearLayout card = u.card(shell);
    card.setId(id);
    card.setMinimumHeight(u.dp(208));
    TextView title = u.text(heading, 18, Ui.INK);
    title.setTypeface(null, android.graphics.Typeface.BOLD);
    card.addView(title);
    TextView subtitle = u.text(detail, 12, Ui.MUTED);
    card.addView(subtitle);
    return card;
  }

  private void preview(LinearLayout card, String label, Runnable open) {
    TextView entry = u.text(label, 14, Ui.INK);
    entry.setMaxLines(2);
    entry.setEllipsize(android.text.TextUtils.TruncateAt.END);
    entry.setTextIsSelectable(false);
    entry.setGravity(Gravity.CENTER_VERTICAL);
    entry.setMinHeight(u.dp(48));
    entry.setPadding(u.dp(4), u.dp(4), u.dp(4), u.dp(4));
    entry.setBackground(new android.graphics.drawable.RippleDrawable(
        android.content.res.ColorStateList.valueOf(Ui.CONTAINER), null, u.shape(Ui.SURFACE, 8)));
    entry.setFocusable(true);
    entry.setOnClickListener(view -> { if (!busy) open.run(); });
    card.addView(entry);
  }

  private String eventTitle(JSONObject event) {
    return s(event, "title").isBlank() ? s(event, "body") : s(event, "title");
  }

  private void openHomeEvents(List<JSONObject> events) {
    Panel list = panel("事件纪");
    for (JSONObject event : events) {
      u.item(list.body, eventTitle(event), "公司发布", () -> {
        Panel detail = panel(eventTitle(event));
        detail.body.addView(u.text(s(event, "body"), 16, Ui.INK));
      });
    }
  }

  private void openHomeBoard(List<JSONObject> assigned) {
    Panel list = panel("任务看板");
    for (JSONObject task : assigned)
      u.item(list.body, s(task, "title"), priority(task), () -> tasksUi.detail(s(task, "taskId")));
  }

  String uid() {
    return s(me, "id");
  }

  void remember(JSONObject record) {
    for (JSONObject person : rows(arr(record, "participants")))
      if (!id(person).isEmpty()) participantNames.put(id(person), s(person, "displayName"));
  }

  String person(String id) {
    if (participantNames.containsKey(id)) return participantNames.get(id);
    if (id.equals(uid())) return s(me, "displayName");
    for (JSONObject p : rows(users)) if (id.equals(id(p))) return s(p, "displayName");
    for (JSONObject t : rows(tasks))
      for (JSONObject p : rows(arr(t, "participants")))
        if (id.equals(id(p))) return s(p, "displayName");
    return "相关人员";
  }

  String people(JSONArray ids) {
    List<String> names = new ArrayList<>();
    for (int i = 0; i < ids.length(); i++) names.add(person(ids.optString(i)));
    return String.join("、", names);
  }

  JSONObject task(String id) {
    for (JSONObject t : rows(tasks)) if (id.equals(id(t))) return t;
    return new JSONObject();
  }

  Panel panel(String label) {
    return panel(label, 1, .92f, Gravity.BOTTOM, "关闭");
  }

  Panel panel(String label, float width, float height, int gravity, String closeLabel) {
    Panel p = new Panel(label, closeLabel, width, height);
    panels.add(p);
    p.dialog.show();
    if (Build.VERSION.SDK_INT >= 33) {
      p.dialog.getOnBackInvokedDispatcher().registerOnBackInvokedCallback(
          android.window.OnBackInvokedDispatcher.PRIORITY_DEFAULT, () -> {
            if (!hideVisibleKeyboard(p.dialog.getWindow()) && !busy) p.dialog.dismiss();
          });
    }
    Window w = p.dialog.getWindow();
    if (w != null) {
      w.setBackgroundDrawableResource(android.R.color.transparent);
      p.resize();
      w.setGravity(gravity);
      w.setSoftInputMode(WindowManager.LayoutParams.SOFT_INPUT_ADJUST_RESIZE
          | WindowManager.LayoutParams.SOFT_INPUT_STATE_ALWAYS_HIDDEN);
    }
    return p;
  }

  final class Panel {
    final Dialog dialog;
    final LinearLayout body, actions, shell, header;
    final ScrollView scroll;
    final TextView error;
    final float width, height;

    void resize() {
      Window w = dialog.getWindow();
      if (w != null) w.setLayout(
          width == 1 ? -1 : Math.round(getResources().getDisplayMetrics().widthPixels * width),
          height == 1 ? -1 : Math.round(getResources().getDisplayMetrics().heightPixels * height));
    }

    Panel(String label, String closeLabel, float width, float height) {
      this.width = width;
      this.height = height;
      dialog = new Dialog(MainActivity.this) {
        @Override public boolean dispatchTouchEvent(MotionEvent event) {
          View focused = getCurrentFocus();
          boolean handled = super.dispatchTouchEvent(event);
          dismissKeyboardOutside(event, focused, getCurrentFocus());
          return handled;
        }

        @Override
        @android.annotation.SuppressLint("GestureBackNavigation")
        @SuppressWarnings("deprecation")
        public void onBackPressed() {
          if (!hideVisibleKeyboard(getWindow()) && !busy) super.onBackPressed();
        }
      };
      shell = u.column();
      shell.setFocusableInTouchMode(true);
      shell.setBackground(u.shape(Ui.BG, 28));
      shell.setPadding(u.dp(16), u.dp(8), u.dp(16), u.dp(16));
      header = u.row();
      TextView h = u.text(label, 20, Ui.INK);
      header.addView(h, new LinearLayout.LayoutParams(0, -2, 1));
      Button close = new Button(MainActivity.this);
      close.setText(closeLabel);
      close.setAllCaps(false);
      close.setContentDescription(closeLabel + "，" + label);
      close.setOnClickListener(
          v -> {
            if (!busy) dialog.dismiss();
          });
      header.addView(close);
      shell.addView(header);
      error = u.text("", 14, Ui.ERROR);
      error.setVisibility(View.GONE);
      error.addTextChangedListener(new android.text.TextWatcher() {
        @Override public void beforeTextChanged(CharSequence s, int start, int count, int after) {}
        @Override public void onTextChanged(CharSequence s, int start, int before, int count) {
          error.setVisibility(s.length() == 0 ? View.GONE : View.VISIBLE);
        }
        @Override public void afterTextChanged(android.text.Editable s) {}
      });
      shell.addView(error);
      scroll = new ScrollView(MainActivity.this);
      body = u.column();
      scroll.addView(body);
      shell.addView(scroll, new LinearLayout.LayoutParams(-1, 0, 1));
      actions = u.column();
      shell.addView(actions);
      dialog.setContentView(shell);
      shell.requestFocus();
      dialog.setOnDismissListener(d -> panels.remove(this));
    }
  }

  void closePanels() {
    for (Panel p : new ArrayList<>(panels)) p.dialog.dismiss();
    panels.clear();
  }

  @Override
  public boolean dispatchTouchEvent(MotionEvent event) {
    View focused = getCurrentFocus();
    boolean handled = super.dispatchTouchEvent(event);
    dismissKeyboardOutside(event, focused, getCurrentFocus());
    return handled;
  }

  private void dismissKeyboardOutside(MotionEvent event, View previous, View current) {
    if (event.getActionMasked() != MotionEvent.ACTION_UP || previous != current
        || !(current instanceof EditText editor)) return;
    int[] origin = new int[2];
    editor.getLocationOnScreen(origin);
    float x = event.getRawX() - origin[0], y = event.getRawY() - origin[1];
    if (x < 0 || x >= editor.getWidth() || y < 0 || y >= editor.getHeight()) u.dismissKeyboard(editor);
  }

  private boolean hideVisibleKeyboard(Window window) {
    if (window == null || Build.VERSION.SDK_INT < 30) return false;
    WindowInsets insets = window.getDecorView().getRootWindowInsets();
    if (insets == null || !insets.isVisible(WindowInsets.Type.ime())) return false;
    WindowInsetsController controller = window.getInsetsController();
    if (controller == null) return false;
    controller.hide(WindowInsets.Type.ime());
    return true;
  }

  void back() {
    Window window = panels.isEmpty() ? getWindow() : panels.get(panels.size() - 1).dialog.getWindow();
    if (hideVisibleKeyboard(window)) return;
    if (!panels.isEmpty()) {
      panels.get(panels.size() - 1).dialog.dismiss();
      return;
    }
    if (taskTable != null) {
      navigate("view");
      return;
    }
    if ("view".equals(page) && calendarUi.day) {
      calendarUi.returnToMonth();
      return;
    }
    if (ready && !"map".equals(page)) {
      navigate("map");
      return;
    }
    finish();
  }

  // API 33+ gestures use the registered OnBackInvokedCallback; this fallback supports Android 8–12.
  @Override
  @android.annotation.SuppressLint("GestureBackNavigation")
  @SuppressWarnings("deprecation")
  public void onBackPressed() {
    back();
  }

  @Override
  public void onConfigurationChanged(Configuration config) {
    super.onConfigurationChanged(config);
    root.requestApplyInsets();
    for (Panel p : panels) p.resize();
    if (ready && panels.isEmpty() && taskTable == null) navigate(page);
  }

  @Override
  protected void onActivityResult(int request, int result, Intent data) {
    super.onActivityResult(request, result, data);
    workspaceUi.photoResult(request, result, data);
  }

  @Override
  protected void onDestroy() {
    destroyed = true;
    closePanels();
    worker.shutdownNow();
    api.clear();
    super.onDestroy();
  }
}
