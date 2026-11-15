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
  private LinearLayout root, body, toolbar;
  private FrameLayout content;
  private TextView title;
  private ProgressBar loading;
  private MaterialNavigation navigation;
  private Button bell;
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
    layout();
    login("");
    if (Build.VERSION.SDK_INT >= 33)
      getOnBackInvokedDispatcher()
          .registerOnBackInvokedCallback(
              android.window.OnBackInvokedDispatcher.PRIORITY_DEFAULT, this::back);
  }

  @SuppressWarnings("deprecation")
  private void layout() {
    root = u.column();
    root.setBackgroundColor(Ui.BG);
    toolbar = u.row();
    toolbar.setPadding(u.dp(16), 0, u.dp(8), 0);
    title = u.text("潘多拉", 22, Ui.INK);
    title.setId(R.id.screen_title);
    title.setGravity(Gravity.CENTER_VERTICAL);
    toolbar.addView(title, new LinearLayout.LayoutParams(0, u.dp(64), 1));
    bell = new Button(this);
    bell.setText("");
    bell.setPadding(u.dp(12), 0, u.dp(12), 0);
    bell.setBackgroundColor(android.graphics.Color.TRANSPARENT);
    bell.setCompoundDrawablesRelativeWithIntrinsicBounds(R.drawable.ic_notifications, 0, 0, 0);
    bell.setAllCaps(false);
    bell.setTextColor(Ui.PRIMARY);
    bell.setContentDescription("通知");
    bell.setOnClickListener(
        v -> {
          if (ready && !busy) workspaceUi.notifications();
        });
    toolbar.addView(bell, new LinearLayout.LayoutParams(u.dp(48), u.dp(48)));
    Button menu = new Button(this);
    menu.setText("⋮");
    menu.setTextSize(24);
    menu.setContentDescription("更多选项");
    menu.setBackgroundColor(android.graphics.Color.TRANSPARENT);
    menu.setOnClickListener(
        v -> {
          PopupMenu m = new PopupMenu(this, menu);
          m.getMenu().add("刷新数据").setEnabled(ready);
          m.getMenu().add("退出登录").setEnabled(ready);
          m.setOnMenuItemClickListener(
              i -> {
                if (!busy) {
                  if (i.getTitle().equals("刷新数据")) reload();
                  else logout();
                }
                return true;
              });
          m.show();
        });
    toolbar.addView(menu, new LinearLayout.LayoutParams(u.dp(48), u.dp(48)));
    root.addView(toolbar);
    loading = new ProgressBar(this, null, android.R.attr.progressBarStyleHorizontal);
    loading.setIndeterminate(true);
    loading.setVisibility(View.GONE);
    root.addView(loading, new LinearLayout.LayoutParams(-1, u.dp(3)));
    content = new FrameLayout(this);
    root.addView(content, new LinearLayout.LayoutParams(-1, 0, 1));
    navigation = new MaterialNavigation(this, this::navigate);
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
    title.setText(label);
    content.removeAllViews();
    ScrollView scroll = new ScrollView(this);
    scroll.setFillViewport(true);
    body = u.column();
    body.setPadding(u.dp(16), 0, u.dp(16), u.dp(24));
    scroll.addView(body);
    content.addView(scroll, new FrameLayout.LayoutParams(-1, -1));
    return body;
  }

  void navigate(String destination) {
    if (!ready || busy) return;
    page = destination;
    updateBell();
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
    long unread = rows(notifications).stream().filter(n -> s(n, "readAt").isEmpty()).count();
    bell.setCompoundDrawablesRelativeWithIntrinsicBounds(
        unread > 0 ? R.drawable.ic_notifications_unread : R.drawable.ic_notifications, 0, 0, 0);
    bell.setContentDescription("通知，" + unread + "条未读");
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
                    api.clear();
                    clear();
                    login("登录已过期，请重新登录。");
                  } else if (error instanceof ApiClient.Failure f
                      && "PASSWORD_CHANGE_REQUIRED".equals(f.code)) {
                    clear();
                    password(true);
                  } else
                    error(error.getMessage() == null ? "无法连接服务器，请检查网络后重试。" : error.getMessage());
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
          navigate(page);
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

  void login(String message) {
    ready = false;
    navigation.setVisibility(View.GONE);
    bell.setVisibility(View.GONE);
    LinearLayout box = page("登录");
    u.heading(box, "潘多拉");
    u.heading(box, "让每一天，有序向前。");
    u.note(box, "登录你的工作台，查看任务与团队动态。");
    if (!message.isEmpty()) u.note(box, message);
    EditText user = u.field(box, "工作账号", "", 100, false),
        password = u.field(box, "密码", "", 100, false);
    user.setId(R.id.login_username);
    password.setId(R.id.login_password);
    password.setInputType(InputType.TYPE_CLASS_TEXT | InputType.TYPE_TEXT_VARIATION_PASSWORD);
    u.button(
        box,
        "登录工作台",
        true,
        () -> {
          if (Ui.value(user).isEmpty() || password.getText().length() == 0) {
            error("请输入账号和密码。");
            return;
          }
          String usernameValue = Ui.value(user), passwordValue = password.getText().toString();
          run(
              () ->
                  api.post(
                      "/auth/sessions", obj("username", usernameValue, "password", passwordValue)),
              result -> {
                api.epoch++;
                api.token = s(result, "token");
                if (result.optBoolean("passwordChangeRequired")) {
                  password(true);
                  return;
                }
                run(
                    this::load,
                    v -> {
                      ready = true;
                      bell.setVisibility(View.VISIBLE);
                      navigation.setVisibility(View.VISIBLE);
                      page = "map";
                      navigate(page);
                    });
              });
        });
    u.note(box, "账号与密码由管理员提供，忘记密码请联系管理员。");
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
                api.clear();
                clear();
                login("密码已修改，请使用新密码登录。");
              });
        });
    if (forced) u.button(box, "退出登录", false, this::logout);
  }

  void logout() {
    run(
        () -> api.request("DELETE", "/auth/sessions/current", null, null, null),
        r -> {
          api.clear();
          clear();
          login("");
        });
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
    calendarUi.person = "";
    home = new JSONObject();
    analytics = new JSONObject();
    authors = new JSONObject();
    workspaceUi.reset();
  }

  void dashboard() {
    LinearLayout box = page("工作台");
    LinearLayout heading = u.row();
    java.time.LocalDate today = java.time.LocalDate.now(CalendarUi.ZONE);
    TextView date = u.text(today.getMonthValue() + "月" + today.getDayOfMonth() + "日", 26, Ui.INK);
    heading.addView(date, new LinearLayout.LayoutParams(0, u.dp(80), 1));
    date.setGravity(Gravity.CENTER_VERTICAL);
    box.addView(heading);
    LinearLayout shortcuts = u.card(box);
    long pending =
        rows(approvals).stream()
            .filter(
                r -> "pending".equals(s(r, "status")) && uid().equals(s(r, "currentReviewerId")))
            .count();
    LinearLayout actions = u.row();
    shortcuts.addView(actions);
    LinearLayout one = u.column(), two = u.column(), three = u.column();
    actions.addView(one, new LinearLayout.LayoutParams(0, -2, 1));
    actions.addView(two, new LinearLayout.LayoutParams(0, -2, 1));
    actions.addView(three, new LinearLayout.LayoutParams(0, -2, 1));
    u.button(one, "待我审核 · " + pending, false, () -> tasksUi.approvals("reviewer"));
    u.button(two, "我的申请", false, () -> tasksUi.approvals("applicant"));
    u.button(three, "全部授权任务", false, tasksUi::list);
    GridLayout modules = new GridLayout(this);
    modules.setColumnCount(2);
    box.addView(modules, new LinearLayout.LayoutParams(-1, -2));
    LinearLayout company = dashboardModule(modules, 0, R.id.dashboard_company, "公司事项");
    if (arr(home, "companyItems").length() == 0) u.note(company, "暂无公司信息");
    for (JSONObject item : rows(arr(home, "companyItems")))
      u.item(company, s(item, "body"), "统一发布", null);
    LinearLayout assigned = dashboardModule(modules, 1, R.id.dashboard_tasks, "我的待办");
    for (JSONObject t : rows(arr(home, "assignedTasks")))
      u.item(assigned, s(t, "title"), priority(t), () -> tasksUi.detail(s(t, "taskId")));
    if (arr(home, "assignedTasks").length() == 0) u.note(assigned, "暂无被派发的未完成任务");
    LinearLayout personal = dashboardModule(modules, 2, R.id.dashboard_personal, "个人事项");
    u.button(personal, "新增", false, () -> workspaceUi.personal(null));
    for (JSONObject item : rows(arr(home, "personalItems")))
      u.item(personal, s(item, "body"), "点击查看或编辑", () -> workspaceUi.personalDetail(id(item)));
    LinearLayout recent = dashboardModule(modules, 3, R.id.dashboard_logs, "工作记录");
    for (JSONObject log : rows(arr(home, "recentLogs")))
      u.item(recent, s(log, "body"), s(log, "businessDate"), () -> workspaceUi.logDetail(id(log)));
    if (arr(home, "recentLogs").length() == 0) u.note(recent, "近十天暂无日志");
  }

  /** Uniform tiles; long module contents scroll inside their own fixed-size body. */
  private LinearLayout dashboardModule(GridLayout grid, int index, int resourceId, String label) {
    LinearLayout tile = u.column();
    tile.setId(resourceId);
    tile.setPadding(u.dp(12), 0, u.dp(12), u.dp(12));
    android.graphics.drawable.GradientDrawable background = u.shape(Ui.SURFACE, 16);
    background.setStroke(u.dp(1), Ui.LINE);
    tile.setBackground(background);
    GridLayout.LayoutParams size =
        new GridLayout.LayoutParams(GridLayout.spec(index / 2), GridLayout.spec(index % 2, 1f));
    size.width = 0;
    size.height = Math.max(u.dp(180), (content.getHeight() - u.dp(216)) / 2);
    size.setMargins(u.dp(4), u.dp(4), u.dp(4), u.dp(4));
    grid.addView(tile, size);
    u.heading(tile, label);
    ScrollView scroll = new ScrollView(this);
    scroll.setNestedScrollingEnabled(true);
    LinearLayout contents = u.column();
    scroll.addView(contents, new ScrollView.LayoutParams(-1, -2));
    tile.addView(scroll, new LinearLayout.LayoutParams(-1, 0, 1));
    return contents;
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
    Panel p = new Panel(label);
    panels.add(p);
    p.dialog.show();
    Window w = p.dialog.getWindow();
    if (w != null) {
      w.setBackgroundDrawableResource(android.R.color.transparent);
      w.setLayout(-1, (int) (getResources().getDisplayMetrics().heightPixels * .92));
      w.setGravity(Gravity.BOTTOM);
      w.setSoftInputMode(WindowManager.LayoutParams.SOFT_INPUT_ADJUST_RESIZE);
    }
    return p;
  }

  final class Panel {
    final Dialog dialog;
    final LinearLayout body, actions;
    final TextView error;

    Panel(String label) {
      dialog = new Dialog(MainActivity.this);
      LinearLayout shell = u.column();
      shell.setBackground(u.shape(Ui.BG, 28));
      shell.setPadding(u.dp(16), u.dp(8), u.dp(16), u.dp(16));
      LinearLayout header = u.row();
      TextView h = u.text(label, 20, Ui.INK);
      header.addView(h, new LinearLayout.LayoutParams(0, -2, 1));
      Button close = new Button(MainActivity.this);
      close.setText("关闭");
      close.setContentDescription("关闭" + label);
      close.setOnClickListener(
          v -> {
            if (!busy) dialog.dismiss();
          });
      header.addView(close);
      shell.addView(header);
      error = u.text("", 14, Ui.ERROR);
      shell.addView(error);
      ScrollView scroll = new ScrollView(MainActivity.this);
      body = u.column();
      scroll.addView(body);
      shell.addView(scroll, new LinearLayout.LayoutParams(-1, 0, 1));
      actions = u.column();
      shell.addView(actions);
      dialog.setContentView(shell);
      dialog.setOnDismissListener(d -> panels.remove(this));
    }
  }

  void closePanels() {
    for (Panel p : new ArrayList<>(panels)) p.dialog.dismiss();
    panels.clear();
  }

  void back() {
    if (android.os.Build.VERSION.SDK_INT >= 30
        && getWindow().getDecorView().getRootWindowInsets() != null
        && getWindow()
            .getDecorView()
            .getRootWindowInsets()
            .isVisible(android.view.WindowInsets.Type.ime())) {
      getWindow().getInsetsController().hide(android.view.WindowInsets.Type.ime());
      return;
    }
    if (!panels.isEmpty()) {
      panels.get(panels.size() - 1).dialog.dismiss();
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
    for (Panel p : panels)
      if (p.dialog.getWindow() != null)
        p.dialog
            .getWindow()
            .setLayout(-1, (int) (getResources().getDisplayMetrics().heightPixels * .92));
    if (ready && panels.isEmpty()) navigate(page);
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
