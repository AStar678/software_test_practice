"use strict";
/* 共用单选标签与平铺评论（第八章 8.2—8.4）：标签目录由创始人维护，任务/日志只持有一个标签；
   评论是对象详情底部的独立聚合，按发表时间稳定分页，作者可随时管理自己的评论。 */
(function () {
  const P = window.Pandora;
  if (!P) return;
  const previousOpenSheet = openSheet;
  const previousRunAction = runAction;
  const previousRenderMe = renderMe;
  const COMMENT_PAGE = 10;
  const commentState = new Map(); // objectType:objectId -> {items, total, nextCursor, loading, error, draft, editing}
  let tagEditing = null, pendingColor = null;
  function whenText(value) {
    if (!value) return '—';
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? '—' : date.getFullYear() + '年' + fmtDateTime(date);
  }

  function me() { return P.data && P.data.me; }
  function tags() { return ((P.data && P.data.tags) || {}).items || []; }
  function canManageTags() { return !!((P.data && P.data.tags) || {}).canManage; }
  function tagById(id) { return tags().find(tag => tag.id === id) || null; }
  function palette() { return ((P.data && P.data.tags) || {}).palette || []; }

  /* ---------- 标签呈现与表单控件 ---------- */
  P.tagPillHTML = function (tag) {
    if (!tag) return '';
    return '<span class="p-tag-pill' + (tag.deleted ? ' is-deleted' : '') + '" style="--tag-bg:' + esc(tag.color || '#ffe1ea') + ';--tag-bd:' + esc(tag.border || '#8a8f98') + '">' +
      esc(tag.name || '标签') + (tag.deleted ? '（已删除）' : '') + '</span>';
  };
  P.tagSelectHTML = function (prefix, current) {
    const list = tags().filter(tag => !tag.deleted || tag.id === current);
    return '<div class="field p-tag-field"><label for="' + prefix + '-tag">标签（单选，可清除）</label><select id="' + prefix + '-tag">' +
      '<option value=""' + (!current ? ' selected' : '') + '>无标签（默认粉色）</option>' +
      list.map(tag => '<option value="' + esc(tag.id) + '"' + (tag.id === current ? ' selected' : '') + '>' + esc(tag.name) + (tag.deleted ? '（已删除）' : '') + '</option>').join('') +
      '</select><span class="tiny muted">标签由创始人统一维护，每项任务或日志最多选择一个；删除的标签不能再用于新的关联。</span></div>';
  };
  P.readTagSelect = function (prefix) {
    const node = document.getElementById(prefix + '-tag');
    return node ? (node.value || null) : null;
  };

  /* ---------- 我的 → 标签管理（仅创始人） ---------- */
  function tagRowsHTML() {
    if (!tags().length) return '<div class="empty">还没有标签，可在下方新建并选择预定义颜色。</div>';
    return '<div class="stack">' + tags().map(tag =>
      '<div class="p-tag-row" data-tag-row="' + esc(tag.id) + '">' +
        '<span class="p-tag-swatch" style="background:' + esc(tag.color) + ';border-color:' + esc(tag.border) + '"></span>' +
        '<span class="p-tag-name">' + esc(tag.name) + (tag.deleted ? '（已删除）' : '') + '</span>' +
        '<span class="spacer"></span>' +
        (tag.deleted ? '<span class="tiny muted">已删除，保留既有引用</span>' :
          '<button type="button" class="btn tiny-btn" data-action="p-tag-edit" data-id="' + esc(tag.id) + '">改名/改色</button>' +
          '<button type="button" class="btn tiny-btn danger" data-action="p-tag-delete" data-id="' + esc(tag.id) + '">删除</button>') +
      '</div>').join('') + '</div>';
  }
  function paletteHTML(selected) {
    return '<div class="p-tag-palette" role="group" aria-label="选择标签颜色">' + palette().map(entry =>
      '<button type="button" class="p-tag-color" data-action="p-tag-color" data-color="' + esc(entry.color) + '" aria-pressed="' + (entry.color === selected) + '" aria-label="' + esc(entry.label) + '" style="background:' + esc(entry.color) + ';border-color:' + esc(entry.border) + '"></button>').join('') + '</div>';
  }
  function tagFormHTML(draft) {
    return '<div class="field"><label for="p-tag-name">标签名称（1—40字）</label><input id="p-tag-name" type="text" maxlength="40" value="' + esc(draft.name || '') + '" data-autofocus></div>' +
      '<div class="field"><label>颜色</label>' + paletteHTML(draft.color) + '</div>' +
      '<div class="callout" id="p-tag-error" hidden></div>';
  }
  function manageView() {
    return {
      title: '标签管理',
      body: '<p class="tiny muted">标签为全公司共用，任务和日志都可选择一个；改名改色会立即反映到当前引用，删除会保留既有引用的删除时名称与颜色。</p>' +
        tagRowsHTML() + '<div class="divider"></div><div class="card-head"><h2>新建标签</h2></div>' + tagFormHTML({ name: '', color: (palette()[0] || {}).color || '' }),
      foot: '<button type="button" class="btn primary" data-action="p-tag-create">新建标签</button>' + withBack('<button type="button" class="btn" data-action="sheet-close">关闭</button>')
    };
  }
  function openTagManagement() {
    if (!canManageTags()) { P.notice('只有公司员工组织树唯一根节点（创始人）可以维护标签。'); return; }
    tagEditing = null;
    openSheet(manageView());
  }
  function openTagEdit(id) {
    const tag = tagById(id);
    if (!tag || !canManageTags()) return;
    tagEditing = { id, name: tag.name, color: tag.color, rowVersion: tag.rowVersion };
    openSheet({ title: '编辑标签', body: tagFormHTML(tagEditing), foot: '<button type="button" class="btn primary" data-action="p-tag-save" data-id="' + esc(id) + '">保存</button>' + withBack('<button type="button" class="btn" data-action="sheet-close">关闭</button>') });
  }
  function saveTag(id) {
    const nameNode = document.getElementById('p-tag-name');
    const errorNode = document.getElementById('p-tag-error');
    if (!nameNode) return;
    const name = nameNode.value.trim();
    if (!name) { errorNode.textContent = '请填写标签名称。'; errorNode.hidden = false; return; }
    const pressed = document.querySelector('.p-tag-color[aria-pressed="true"]');
    const color = (tagEditing && tagEditing.color) || pendingColor || (pressed && pressed.dataset.color) || null;
    if (!color) { errorNode.textContent = '请选择标签颜色。'; errorNode.hidden = false; return; }
    const row = id ? tagById(id) : null;
    P.busy(async function () {
      const etag = row ? '"' + row.rowVersion + '"' : null;
      await P.mutation('tag:' + (id || 'new'), id ? 'PATCH' : 'POST', '/tags' + (id ? '/' + encodeURIComponent(id) : ''),
        id ? { name: name, color: color } : { name: name, color: color }, etag);
      tagEditing = null; pendingColor = null;
      await P.reload();
      closeSheet();
      P.notice('标签已保存。');
      if (state.page === 'me') renderAll();
    }, 'p-tag-error');
  }
  function deleteTag(id) {
    const row = tagById(id);
    if (!row) return;
    P.busy(async function () {
      await P.mutation('tag-delete:' + id, 'DELETE', '/tags/' + encodeURIComponent(id), null, '"' + row.rowVersion + '"');
      await P.reload();
      closeSheet();
      P.notice('标签已删除，既有引用保留并标记为已删除。');
      if (state.page === 'me') renderAll();
    }, 'p-tag-error');
  }

  /* ---------- 平铺评论 ---------- */
  function commentKey(objectType, objectId) { return objectType + ':' + objectId; }
  function commentStateFor(objectType, objectId) {
    const key = commentKey(objectType, objectId);
    if (!commentState.has(key)) commentState.set(key, { items: [], total: 0, nextCursor: null, loading: false, error: null, draft: '', editingId: null, loaded: false });
    return commentState.get(key);
  }
  function endpointFor(objectType, objectId) {
    return (objectType === 'task' ? '/tasks/' : '/work-logs/') + encodeURIComponent(objectId) + '/comments';
  }
  P.commentsHTML = function (objectType, objectId) {
    return '<section class="p-comments" data-object-type="' + esc(objectType) + '" data-object-id="' + esc(objectId) + '" aria-label="评论">' +
      '<div class="card-head"><h2>评论</h2><span class="hint" data-comments-count>—</span></div>' +
      '<div class="p-comment-list" data-comment-list><div class="empty">正在加载评论…</div></div>' +
      '<div class="p-comment-more" data-comment-more hidden><button type="button" class="btn tiny-btn" data-action="p-comment-more">加载更多</button></div>' +
      '<div class="p-comment-compose"><label class="p-comment-label" for="p-comment-input">发表评论（平铺，不支持回复层级）</label>' +
      '<textarea id="p-comment-input" maxlength="10000" placeholder="写下你的评论…"></textarea>' +
      '<div class="callout" id="p-comment-error" hidden></div>' +
      '<div class="row"><button type="button" class="btn primary tiny-btn" data-action="p-comment-submit">发表</button></div></div></section>';
  };
  function commentRowHTML(comment, editingId) {
    if (comment.id === editingId) {
      return '<article class="p-comment is-editing" data-comment-id="' + esc(comment.id) + '"><div class="field"><textarea class="p-comment-edit" maxlength="10000" data-comment-edit data-autofocus>' + esc(comment.body) + '</textarea></div>' +
        '<div class="row"><button type="button" class="btn primary tiny-btn" data-action="p-comment-save" data-id="' + esc(comment.id) + '">保存</button>' +
        '<button type="button" class="btn tiny-btn" data-action="p-comment-cancel" data-id="' + esc(comment.id) + '">取消</button></div>' +
        '<div class="callout" data-comment-row-error hidden></div></article>';
    }
    return '<article class="p-comment" data-comment-id="' + esc(comment.id) + '">' +
      '<header><strong>' + esc(comment.authorName || '相关成员') + '</strong><time>' + esc(whenText(comment.createdAt)) + '</time>' +
      (comment.edited ? '<span class="tiny muted">已编辑</span>' : '') + '<span class="spacer"></span>' +
      (comment.canManage ? '<button type="button" class="btn tiny-btn" data-action="p-comment-edit" data-id="' + esc(comment.id) + '">编辑</button>' +
        '<button type="button" class="btn tiny-btn danger" data-action="p-comment-delete" data-id="' + esc(comment.id) + '">删除</button>' : '') +
      '</header><p>' + esc(comment.body) + '</p></article>';
  }
  function paintComments(objectType, objectId) {
    const container = document.querySelector('.p-comments[data-object-type="' + objectType + '"][data-object-id="' + objectId + '"]');
    if (!container) return;
    const found = commentStateFor(objectType, objectId);
    const list = container.querySelector('[data-comment-list]');
    const more = container.querySelector('[data-comment-more]');
    const count = container.querySelector('[data-comments-count]');
    if (count) count.textContent = found.loaded ? '共 ' + found.total + ' 条' : (found.loading ? '加载中…' : '—');
    if (list) {
      if (found.loading && !found.items.length) list.innerHTML = '<div class="empty">正在加载评论…</div>';
      else if (found.error) list.innerHTML = '<div class="callout reject" role="alert">' + esc(found.error) + '</div><button type="button" class="btn tiny-btn primary" data-action="p-comment-retry">重试</button>';
      else if (!found.items.length) list.innerHTML = '<div class="empty">还没有评论，欢迎发表第一条。</div>';
      else list.innerHTML = found.items.map(comment => commentRowHTML(comment, found.editingId)).join('');
    }
    if (more) more.hidden = found.nextCursor == null || !!found.error;
  }
  async function loadComments(objectType, objectId, cursor) {
    const found = commentStateFor(objectType, objectId);
    if (found.loading) return;
    found.loading = true; found.error = null;
    paintComments(objectType, objectId);
    try {
      // Continue by the immutable (created_at, id) cursor, never by a positional offset: deleting an
      // earlier comment between loads must not skip an unseen one.
      const query = endpointFor(objectType, objectId) + '?limit=' + COMMENT_PAGE
        + (cursor ? '&cursor=' + encodeURIComponent(cursor) : '&offset=0');
      const result = await P.request(query);
      const rows = (result.items || []).map(item => Object.assign({ editing: false }, item));
      found.items = cursor ? found.items.concat(rows) : rows;
      found.total = result.total == null ? found.items.length : result.total;
      found.nextCursor = result.nextCursor == null ? null : result.nextCursor;
      found.loaded = true;
    } catch (error) {
      if (error.name === 'AbortError') return;
      found.error = error.message || '评论加载失败。';
    } finally {
      found.loading = false;
      paintComments(objectType, objectId);
    }
  }
  function activeCommentTarget(container) {
    if (!container) return null;
    return { objectType: container.dataset.objectType, objectId: container.dataset.objectId };
  }
  function hydrateComments() {
    const container = document.querySelector('.p-comments[data-object-type]');
    if (!container) return;
    const target = activeCommentTarget(container);
    const found = commentStateFor(target.objectType, target.objectId);
    paintComments(target.objectType, target.objectId);
    if (!found.loaded && !found.loading) loadComments(target.objectType, target.objectId, null);
  }
  openSheet = function (view) {
    previousOpenSheet(view);
    hydrateComments();
  };
  function findComment(objectType, objectId, id) {
    return commentStateFor(objectType, objectId).items.find(item => item.id === id) || null;
  }
  function currentCommentOwner(id) {
    for (const [key, value] of commentState) {
      const comment = value.items.find(item => item.id === id);
      if (comment) return { key, state: value, comment };
    }
    return null;
  }
  function submitComment(container) {
    const target = activeCommentTarget(container);
    if (!target) return;
    const input = document.getElementById('p-comment-input');
    if (!input) return;
    const body = input.value.trim();
    const error = document.getElementById('p-comment-error');
    if (!body) { if (error) { error.textContent = '请先填写评论内容。'; error.hidden = false; } return; }
    const found = commentStateFor(target.objectType, target.objectId);
    P.busy(async function () {
      await P.mutation('comment-new:' + target.objectType + ':' + target.objectId + ':' + P.epoch, 'POST',
        endpointFor(target.objectType, target.objectId), { body: body });
      if (error) error.hidden = true;
      input.value = '';
      found.items = []; found.nextCursor = null; found.loaded = false; found.total = 0;
      await loadComments(target.objectType, target.objectId, null);
      P.notice('评论已发表。');
    }, 'p-comment-error');
  }
  function editComment(id) {
    const owner = currentCommentOwner(id);
    if (!owner) return;
    owner.state.editingId = id;
    const parts = owner.key.split(':');
    paintComments(parts[0], parts.slice(1).join(':'));
    const area = document.querySelector('textarea[data-comment-edit]');
    if (area) area.focus();
  }
  function cancelComment(id) {
    const container = document.querySelector('.p-comments');
    if (!container) return;
    const found = commentStateFor(container.dataset.objectType, container.dataset.objectId);
    found.editingId = null;
    paintComments(container.dataset.objectType, container.dataset.objectId);
  }
  function saveComment(id) {
    const container = document.querySelector('.p-comments');
    if (!container) return;
    const found = commentStateFor(container.dataset.objectType, container.dataset.objectId);
    const comment = found.items.find(item => item.id === id);
    if (!comment) return;
    const node = document.querySelector('[data-comment-edit]');
    const body = node ? node.value.trim() : '';
    const rowError = container.querySelector('[data-comment-row-error]');
    if (!body) { if (rowError) { rowError.textContent = '评论内容不能为空。'; rowError.hidden = false; } return; }
    P.busy(async function () {
      const result = await P.mutation('comment-edit:' + id, 'PATCH', '/comments/' + encodeURIComponent(id),
        { body: body }, '"' + comment.rowVersion + '"');
      comment.body = body; comment.edited = true; found.editingId = null;
      comment.rowVersion = result.rowVersion == null ? comment.rowVersion : result.rowVersion;
      paintComments(container.dataset.objectType, container.dataset.objectId);
      P.notice('评论已更新。');
    }, 'p-comment-error');
  }
  function deleteComment(id) {
    const container = document.querySelector('.p-comments');
    if (!container) return;
    const found = commentStateFor(container.dataset.objectType, container.dataset.objectId);
    const comment = found.items.find(item => item.id === id);
    if (!comment) return;
    P.busy(async function () {
      await P.mutation('comment-delete:' + id, 'DELETE', '/comments/' + encodeURIComponent(id), null, '"' + comment.rowVersion + '"');
      found.items = found.items.filter(item => item.id !== id);
      found.total = Math.max(0, found.total - 1);
      paintComments(container.dataset.objectType, container.dataset.objectId);
      P.notice('评论已删除，正文不再展示。');
    }, 'p-comment-error');
  }

  runAction = function (element) {
    const action = element.dataset.action;
    if (action === 'p-manage-tags') { openTagManagement(); return; }
    if (action === 'p-tag-edit') { openTagEdit(element.dataset.id); return; }
    if (action === 'p-tag-create') {
      const pressed = document.querySelector('.p-tag-color[aria-pressed="true"]');
      pendingColor = pendingColor || (pressed && pressed.dataset.color) || (palette()[0] || {}).color || null;
      saveTag(null);
      return;
    }
    if (action === 'p-tag-save') { saveTag(element.dataset.id); return; }
    if (action === 'p-tag-delete') { deleteTag(element.dataset.id); return; }
    if (action === 'p-tag-color') {
      const color = element.dataset.color;
      if (tagEditing) tagEditing.color = color; else pendingColor = color;
      element.parentElement.querySelectorAll('.p-tag-color').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.color === color)));
      return;
    }
    if (action === 'p-comment-submit') { submitComment(element.closest('.p-comments')); return; }
    if (action === 'p-comment-more') {
      const container = element.closest('.p-comments');
      const found = commentStateFor(container.dataset.objectType, container.dataset.objectId);
      loadComments(container.dataset.objectType, container.dataset.objectId, found.nextCursor);
      return;
    }
    if (action === 'p-comment-retry') {
      const container = element.closest('.p-comments');
      loadComments(container.dataset.objectType, container.dataset.objectId, null);
      return;
    }
    if (action === 'p-comment-edit') { editComment(element.dataset.id); return; }
    if (action === 'p-comment-cancel') { cancelComment(element.dataset.id); return; }
    if (action === 'p-comment-save') { saveComment(element.dataset.id); return; }
    if (action === 'p-comment-delete') { deleteComment(element.dataset.id); return; }
    return previousRunAction(element);
  };
  document.addEventListener('input', function (event) {
    if (!event.target || !event.target.matches('[data-comment-edit]')) return;
    const container = event.target.closest('.p-comments');
    if (!container) return;
    const found = commentStateFor(container.dataset.objectType, container.dataset.objectId);
    const row = event.target.closest('[data-comment-id]');
    const comment = row && found.items.find(item => item.id === row.dataset.commentId);
    if (comment) comment.editBody = event.target.value;
  });

  /* “我的”页入口：仅创始人可见，但每次写入仍在服务端重新鉴权。 */
  renderMe = function () {
    previousRenderMe();
    if (!canManageTags()) return;
    const page = document.getElementById('page-me');
    if (!page) return;
    const card = document.createElement('section');
    card.className = 'card';
    card.innerHTML = '<div class="card-head"><h2>标签管理</h2><span class="hint">创始人维护</span></div>' +
      '<p class="tiny muted">维护全公司共用的任务/日志标签与配色，删除会保留既有引用。</p>' +
      '<button type="button" class="btn" data-action="p-manage-tags">打开标签管理</button>';
    page.appendChild(card);
  };
  RENDER.me = renderMe;

  P.sessionReset.push(function () { commentState.clear(); tagEditing = null; pendingColor = null; });
  /* Automation surface shared with the browser checks (the same page code is exercised). */
  P.tagsUi = { manage: openTagManagement, reload: () => P.reload(), comments: loadComments, state: commentState };
})();
