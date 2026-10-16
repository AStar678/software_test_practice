"use strict";
/* 私人资料只通过本人接口读取和保存；不把联系人加入人员目录。 */
(function () {
  const P = window.Pandora;
  if (!P) throw new Error("请先加载潘多拉后端接入核心。");
  const previousAction = runAction;
  let profileDraft = null;
  let sequence = 0;

  function me() { return P.data.me || {}; }
  function current(draft) { return draft && draft.epoch === P.epoch && draft.userId === me().id; }
  function row(label, value) {
    return '<div class="profile-row"><span class="k">' + label + '</span><span class="v" style="min-width:0;overflow-wrap:anywhere">' + esc(value == null || value === "" ? "未填写" : value) + '</span></div>';
  }
  function button(action, label, style) { return '<button type="button" class="btn ' + (style || "") + '" data-action="' + action + '">' + label + '</button>'; }
  function superior(user) {
    if (user.managerName) return user.managerName;
    const person = user.managerId && personById(user.managerId);
    return person ? person.name : user.managerId ? "已分配直属上级" : "无";
  }
  function readonlyRows(user) {
    return row("公司", user.organizationName) + row("部门", user.departmentName) + row("职位", user.positionName) +
      row("独立团队", user.teamName) + row("直属上级", superior(user));
  }
  function field(id, type, label, value, max, autocomplete, required) {
    return '<div class="field"><label for="' + id + '">' + label + '</label><input id="' + id + '" type="' + type + '" value="' + esc(value || "") + '" maxlength="' + max + '" autocomplete="' + autocomplete + '"' + (required ? ' required data-autofocus' : '') + ' /></div>';
  }

  renderMe = function () {
    const user = me();
    document.getElementById("page-me").innerHTML = '<section class="card profile-card"><div class="profile-row"><div class="avatar">' +
      esc(Array.from(user.displayName || "")[0] || "") + '</div><div style="min-width:0;overflow-wrap:anywhere"><div class="v">' + esc(user.displayName) + '</div><div class="tiny muted">当前登录账号</div></div></div>' +
      row("姓名", user.displayName) + row("联系电话", user.phone) + row("邮箱", user.email) + readonlyRows(user) +
      '<div class="action-grid" style="margin-top:12px">' + button("p-edit-profile", "编辑个人资料", "primary") + button("p-change-password", "修改密码") + '</div></section>' +
      '<section class="card"><div class="card-head"><h2>账号与数据</h2></div><div class="action-grid">' + row("账号", user.username) + row("身份", ROLE_LABEL[user.role] || user.role) + button("p-refresh-workspace", "刷新数据") + button("p-logout", "退出登录") + '</div></section>';
  };

  function formView(draft) {
    const raw = draft.raw;
    return {
      title: "编辑个人资料",
      body: field("profile-display-name", "text", "姓名（必填）", raw.displayName, 100, "name", true) +
        field("profile-phone", "tel", "联系电话（选填）", raw.phone, 32, "tel", false) +
        field("profile-email", "email", "邮箱（选填）", raw.email, 254, "email", false) +
        '<p class="tiny muted">联系电话和邮箱仅在本人的个人资料中展示；留空可清除。</p><div class="divider"></div>' + readonlyRows(raw) +
        '<p class="tiny muted">账号、部门、身份和直属上级由管理员维护。</p><div class="callout reject" id="profile-error" role="alert" hidden></div>',
      foot: withBack(button("p-save-profile", "保存资料", "primary"))
    };
  }

  function openProfile() {
    return P.busy(async function () {
      const epoch = P.epoch, userId = me().id;
      const raw = await P.request("/me/profile");
      if (epoch !== P.epoch || userId !== me().id) return;
      sequence += 1;
      profileDraft = { raw: raw, epoch: epoch, userId: userId, etag: '"' + raw.rowVersion + '"', slot: "profile:" + epoch + ":" + sequence };
      openSheet(formView(profileDraft));
    });
  }

  function saveProfile() {
    return P.busy(async function () {
      const draft = profileDraft;
      if (!current(draft)) throw new Error("资料表单已失效，请重新打开。");
      const name = document.getElementById("profile-display-name");
      const phone = document.getElementById("profile-phone");
      const email = document.getElementById("profile-email");
      if (!name || !phone || !email) throw new Error("请重新打开个人资料表单。");
      const displayName = name.value.trim();
      if (!displayName || Array.from(displayName).length > 100) { name.focus(); throw new Error("姓名须为1至100字。"); }
      if (email.value.trim() && !email.checkValidity()) { email.focus(); throw new Error("请输入有效的邮箱地址。"); }
      const body = { displayName: displayName, phone: phone.value.trim(), email: email.value.trim() };
      await P.mutation(draft.slot, "PATCH", "/me/profile", body, draft.etag);
      // Keep both the form and its retry key if the write succeeds but refreshing fails.
      await P.reload();
      if (!current(draft)) return;
      profileDraft = null;
      closeSheet();
      P.notice("个人资料已保存。");
    }, "profile-error");
  }

  function passwordView() {
    return {
      title: "修改密码",
      body: '<div class="field"><label for="cp-current">当前密码</label><input id="cp-current" type="password" autocomplete="current-password" required data-autofocus></div>' +
        '<div class="field"><label for="cp-new">新密码</label><input id="cp-new" type="password" autocomplete="new-password" required></div>' +
        '<div class="field"><label for="cp-confirm">确认新密码</label><input id="cp-confirm" type="password" autocomplete="new-password" required></div>' +
        '<p class="tiny muted">至少10个字符，须同时包含字母和数字，UTF-8 长度不超过72字节。修改成功后包括当前会话在内的全部会话失效，需重新登录。</p>' +
        '<div class="callout reject" id="password-error" role="alert" hidden></div>',
      foot: withBack(button("p-save-password", "修改密码", "primary"))
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
    if (element.dataset.action === "p-edit-profile") return openProfile();
    if (element.dataset.action === "p-save-profile") return saveProfile();
    if (element.dataset.action === "p-change-password") return openPassword();
    if (element.dataset.action === "p-save-password") return savePassword();
    return previousAction(element);
  };
  RENDER.me = renderMe;
})();
