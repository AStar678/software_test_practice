"use strict";
/* 本人资料可编辑；下属资料由后端逐次检查查看权限和手机号权限。 */
(function () {
  const P = window.Pandora;
  if (!P) throw new Error("请先加载潘多拉后端接入核心。");
  const previousAction = runAction;
  let profileDraft = null;
  let sequence = 0;
  const folds = { organization: true, reports: false };
  const avatarPresets = { rabbit: "🐰", cat: "🐱", bear: "🐻", panda: "🐼" };
  function avatarHTML(user) {
    if (avatarPresets[user.avatar]) return '<span class="avatar-emoji" aria-hidden="true">' + avatarPresets[user.avatar] + '</span>';
    if (/^data:image\/(png|jpeg);base64,[A-Za-z0-9+/=]+$/.test(user.avatar || "")) return '<img src="' + esc(user.avatar) + '" alt="' + esc(user.displayName || "本人") + '的头像">';
    return esc(Array.from(user.displayName || "")[0] || "我");
  }
  const gear = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m9 3-.5 2-2 1.2-2-.6-2 3.5 1.5 1.5v2.8L2.5 15l2 3.5 2-.6 2 1.1.5 2h4l.5-2 2-1.1 2 .6 2-3.5-1.5-1.6v-2.8L20.5 9l-2-3.5-2 .6-2-1.2L14 3Z"/><circle cx="11.5" cy="12" r="3"/></svg>';

  function me() { return P.data.me || {}; }
  function current(draft) { return draft && draft.epoch === P.epoch && draft.userId === me().id; }
  function row(label, value) {
    return '<div class="profile-row"><span class="k">' + label + '</span><span class="v" style="min-width:0;overflow-wrap:anywhere">' + esc(value == null || value === "" ? "未填写" : value) + '</span></div>';
  }
  function button(action, label, style, id) { return '<button type="button" class="btn ' + (style || "") + '" data-action="' + action + '"' + (id ? ' data-id="' + esc(id) + '"' : '') + '>' + esc(label) + '</button>'; }
  function superior(user) {
    if (user.managerName) return user.managerName;
    const person = user.managerId && personById(user.managerId);
    return person ? person.name : user.managerId ? "已分配直属上级" : "无";
  }
  function identityLabel(user) { return ({founder:"创始人",department_head:"部门负责人",team_head:"团队负责人",employee:"员工"})[user.placementType || user.role] || "员工"; }
  function readonlyRows(user) {
    return row("公司", user.organizationName) + row("组织身份", identityLabel(user)) +
      (user.departmentName ? row("部门", user.departmentName) : "") + row("职位", user.positionName) +
      (user.teamName ? row("团队", user.teamName) : "") + row("直属上级", superior(user));
  }
  function field(id, type, label, value, max, autocomplete, required) {
    return '<div class="field"><label for="' + id + '">' + label + '</label><input id="' + id + '" type="' + type + '" value="' + esc(value || "") + '" maxlength="' + max + '" autocomplete="' + autocomplete + '"' + (required ? ' required data-autofocus' : '') + ' /></div>';
  }

  function reports() {
    return ((P.data.reports || {}).items || []);
  }

  function reportsSection() {
    const list = reports();
    if (!list.length) return "";
    return '<details class="card profile-fold" data-profile-fold="reports"' + (folds.reports ? ' open' : '') + '><summary><span>下属资料</span><span class="fold-hint">' + list.length + ' 人</span><span class="fold-chevron" aria-hidden="true">⌄</span></summary><div class="stack fold-content">' +
      list.map(person => button("p-open-person", person.displayName, "", person.id)).join("") + '</div></details>';
  }

  function openPerson(id) {
    return P.busy(async function () {
      const person = await P.request("/users/" + encodeURIComponent(id));
      const detail = row("姓名", person.displayName) + row("组织身份", identityLabel(person)) +
        (person.departmentName ? row("部门", person.departmentName) : "") +
        (person.positionName ? row("职位", person.positionName) : "") +
        (person.teamName ? row("独立团队", person.teamName) : "") +
        row("直属上级", person.managerName || superior(person)) +
        (Object.prototype.hasOwnProperty.call(person, "phone") ? row("手机号", person.phone) : "");
      const foot = withBack((person.canReadLogs ? button("p-open-person-logs", "查看日志", "primary", id) : "") +
        (person.canSetHandoverPreset ? '<button type="button" class="btn" data-action="p-open-handover-preset" data-id="' + esc(id) +
          '" data-name="' + esc(person.displayName) + '">设置交接预设</button>' : '') +
        button("sheet-close", "关闭"));
      openSheet({ title: "人员资料", body: detail, foot: foot });
    });
  }

  function openPersonLogs(id) {
    return P.busy(async function () {
      closeSheet();
      state.logAll = false;
      state.logAuthorQuery = "";
      state.logAuthorId = id;
      await P.openLogsFor(id);
    });
  }

  renderMe = function () {
    const user = me();
    document.getElementById("page-me").innerHTML = '<section class="card profile-card"><div class="profile-hero"><div class="avatar">' +
      avatarHTML(user) + '</div><div class="profile-heading"><p class="eyebrow">MY WORKSPACE</p><h2>' + esc(user.displayName) + '</h2><p>' + esc(user.positionName || ROLE_LABEL[user.role] || "团队成员") + '</p></div>' +
      '<button type="button" class="profile-settings" data-action="p-open-settings" aria-label="个人设置">' + gear + '</button></div>' +
      '<div class="profile-details">' + row("联系电话", user.phone) + row("邮箱", user.email) + '</div></section>' +
      '<details class="card profile-fold" data-profile-fold="organization"' + (folds.organization ? ' open' : '') + '><summary><span>组织信息</span><span class="fold-hint">由管理员维护</span><span class="fold-chevron" aria-hidden="true">⌄</span></summary><div class="profile-details fold-content">' + readonlyRows(user) + '</div></details>' + reportsSection();
  };

  function openSettings() {
    const user = me();
    openSheet({ title: "个人设置", body: '<div class="settings-menu">' + button("p-edit-profile", "编辑资料与头像", "primary") +
      '<div class="settings-section"><h3>账号与安全</h3>' + row("登录手机号", user.phone) + row("身份", identityLabel(user)) +
      '<div class="action-grid">' + button("p-change-password", "修改密码") + button("p-refresh-workspace", "刷新数据") +
      '<button type="button" class="btn" data-action="p-open-handover-preset" data-id="' + esc(user.id) + '" data-name="' + esc(user.displayName) + '">交接预设</button></div></div>' +
      button("p-logout", "退出登录", "danger") + '</div>' });
  }

  function formView(draft) {
    const raw = draft.raw;
    return {
      title: "编辑个人资料",
      body: '<section class="avatar-editor" aria-label="修改头像"><div class="avatar avatar-preview">' + avatarHTML(raw) + '</div><div><h3>个人头像</h3><p class="tiny muted">选择一个头像，或上传自己的照片</p></div></section>' +
        '<div class="avatar-options" role="group" aria-label="选择头像">' +
        '<button type="button" class="avatar-option" data-action="p-select-avatar" data-avatar="" aria-label="使用姓名头像" aria-pressed="' + !raw.avatar + '">' + esc(Array.from(raw.displayName || "我")[0]) + '</button>' +
        Object.keys(avatarPresets).map(key => '<button type="button" class="avatar-option" data-action="p-select-avatar" data-avatar="' + key + '" aria-label="' + ({rabbit:'兔子',cat:'小猫',bear:'小熊',panda:'熊猫'})[key] + '头像" aria-pressed="' + (raw.avatar === key) + '">' + avatarPresets[key] + '</button>').join('') + '</div>' +
        '<div class="field avatar-upload"><label for="profile-avatar-file">上传照片（PNG / JPG，最大10MB）</label><input id="profile-avatar-file" type="file" accept="image/png,image/jpeg"><p class="tiny muted" id="avatar-upload-status" role="status">' + (/^data:image\//.test(raw.avatar || "") ? '照片已选好，保存资料后生效。' : '照片会自动裁成方形，保存资料后生效。') + '</p></div>' +
        row("姓名", raw.displayName) + row("登录手机号", raw.phone) +
        field("profile-email", "email", "邮箱（选填）", raw.email, 254, "email", false) +
        '<p class="tiny muted">姓名和登录手机号由管理员维护。邮箱仅本人可见，可留空清除。</p><div class="divider"></div>' + readonlyRows(raw) +
        '<p class="tiny muted">账号、部门、身份和直属上级由管理员维护。</p><div class="callout reject" id="profile-error" role="alert" hidden></div>',
      foot: button("sheet-back", "返回设置") + button("p-save-profile", "保存资料", "primary")
    };
  }

  function openProfile() {
    return P.busy(async function () {
      const epoch = P.epoch, userId = me().id;
      const raw = await P.request("/me/profile");
      if (epoch !== P.epoch || userId !== me().id) return;
      sequence += 1;
      profileDraft = { raw: raw, originalAvatar: raw.avatar || null, epoch: epoch, userId: userId, etag: '"' + raw.rowVersion + '"', slot: "profile:" + epoch + ":" + sequence };
      openSheet(formView(profileDraft));
    });
  }

  function saveProfile() {
    return P.busy(async function () {
      const draft = profileDraft;
      if (!current(draft)) throw new Error("资料表单已失效，请重新打开。");
      const email = document.getElementById("profile-email");
      if (!email) throw new Error("请重新打开个人资料表单。");
      if (email.value.trim() && !email.checkValidity()) { email.focus(); throw new Error("请输入有效的邮箱地址。"); }
      const body = { email: email.value.trim() };
      if (draft.avatarLoading) throw new Error("头像正在处理，请稍候再保存。");
      if ((draft.raw.avatar || null) !== draft.originalAvatar) body.avatar = draft.raw.avatar || null;
      await P.mutation(draft.slot, "PATCH", "/me/profile", body, draft.etag);
      // Keep both the form and its retry key if the write succeeds but refreshing fails.
      await P.reload();
      if (!current(draft)) return;
      profileDraft = null;
      closeSheet();
      P.notice("个人资料已保存。");
    }, "profile-error");
  }

  function syncProfileDraft() {
    if (!current(profileDraft)) return;
    for (const [field, id] of [["email", "profile-email"]]) {
      const input = document.getElementById(id);
      if (input) profileDraft.raw[field] = input.value;
    }
  }
  function selectAvatar(value) {
    if (!current(profileDraft) || profileDraft.avatarLoading || (value && !avatarPresets[value])) return;
    syncProfileDraft(); profileDraft.raw.avatar = value || null;
    replaceTopSheet(formView(profileDraft));
  }
  document.addEventListener("change", async function (event) {
    if (event.target.id !== "profile-avatar-file" || !current(profileDraft)) return;
    const draft = profileDraft, file = event.target.files[0];
    if (!file) return;
    const status = document.getElementById("avatar-upload-status");
    try {
      if (!["image/png", "image/jpeg"].includes(file.type) || file.size > 10 * 1024 * 1024) throw new Error("请选择10MB以内的 PNG 或 JPG 照片。");
      draft.avatarLoading = true; status.textContent = "正在处理头像…";
      const data = await new Promise((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(reader.result); reader.onerror = () => reject(new Error("照片读取失败，请重新选择。")); reader.readAsDataURL(file); });
      const image = await new Promise((resolve, reject) => { const img = new Image(); img.onload = () => resolve(img); img.onerror = () => reject(new Error("照片无法打开，请重新选择。")); img.src = data; });
      if (!current(draft) || profileDraft !== draft || !document.getElementById("profile-email")) return;
      const canvas = document.createElement("canvas"); canvas.width = canvas.height = 256;
      const context = canvas.getContext("2d"); context.fillStyle = "#fff9fc"; context.fillRect(0, 0, 256, 256);
      const size = Math.min(image.width, image.height);
      context.drawImage(image, (image.width - size) / 2, (image.height - size) / 2, size, size, 0, 0, 256, 256);
      syncProfileDraft(); draft.raw.avatar = canvas.toDataURL("image/jpeg", .9);
      replaceTopSheet(formView(draft));
    } catch (error) { if (status.isConnected) status.textContent = error.message; }
    finally { draft.avatarLoading = false; }
  });
  document.addEventListener("toggle", function (event) {
    if (event.target.matches?.("[data-profile-fold]")) folds[event.target.dataset.profileFold] = event.target.open;
  }, true);
  P.sessionReset.push(function () { profileDraft = null; folds.organization = true; folds.reports = false; });

  function passwordView() {
    return {
      title: "修改密码",
      body: '<div class="field"><label for="cp-current">当前密码</label><input id="cp-current" type="password" autocomplete="current-password" required data-autofocus></div>' +
        '<div class="field"><label for="cp-new">新密码</label><input id="cp-new" type="password" autocomplete="new-password" required></div>' +
        '<div class="field"><label for="cp-confirm">确认新密码</label><input id="cp-confirm" type="password" autocomplete="new-password" required></div>' +
        '<p class="tiny muted">至少10个字符，须同时包含字母和数字，UTF-8 长度不超过72字节。修改成功后包括当前会话在内的全部会话失效，需重新登录。</p>' +
        '<div class="callout reject" id="password-error" role="alert" hidden></div>',
      foot: button("sheet-back", "返回设置") + button("p-save-password", "修改密码", "primary")
    };
  }

  function openPassword() { return P.busy(async function () { openSheet(passwordView()); }); }

  function savePassword() {
    return P.busy(async function () {
      const current = document.getElementById("cp-current");
      const next = document.getElementById("cp-new");
      const confirm = document.getElementById("cp-confirm");
      if (!current || !next || !confirm) throw new Error("请重新打开修改密码表单。");
      const reject = message => {
        const el = document.getElementById("password-error");
        el.textContent = message; el.hidden = false; el.scrollIntoView({ block: "nearest" });
      };
      if (next.value !== confirm.value) return reject("两次输入的新密码不一致。");
      await P.request("/auth/password", { method: "POST", body: { currentPassword: current.value, newPassword: next.value } });
      closeSheet();
      P.reLogin("密码已修改，请使用新密码重新登录。");
    }, "password-error");
  }

  runAction = function (element) {
    if (element.dataset.action === "p-open-settings") return openSettings();
    if (element.dataset.action === "p-select-avatar") return selectAvatar(element.dataset.avatar);
    if (element.dataset.action === "p-open-person") return openPerson(element.dataset.id);
    if (element.dataset.action === "p-open-person-logs") return openPersonLogs(element.dataset.id);
    if (element.dataset.action === "p-edit-profile") return openProfile();
    if (element.dataset.action === "p-save-profile") return saveProfile();
    if (element.dataset.action === "p-change-password") return openPassword();
    if (element.dataset.action === "p-save-password") return savePassword();
    return previousAction(element);
  };
  RENDER.me = renderMe;
})();
