import {
  MAX_GAME_BYTES,
  safeGameURL,
  isLocalGame,
  formatDate,
  renderText,
  emptyState,
} from "./model.js";
import { GitHubStore } from "./github.js";
const $ = (id) => document.getElementById(id);
let store = null,
  snapshot = null,
  editing = null,
  busy = false;
const status = (message, kind = "") => {
  $("admin-status").textContent = message;
  $("admin-status").className = `status-message ${kind}`;
};
function setBusy(value) {
  busy = value;
  document
    .querySelectorAll(
      "#dashboard button, #dashboard input, #dashboard textarea, #dashboard select, #login-form button",
    )
    .forEach((el) => {
      el.disabled = value;
    });
  if (!value) updateFields();
}
function resetEditor() {
  editing = null;
  $("content-form").reset();
  $("content-type").disabled = false;
  $("editor-heading").textContent = "发布新内容";
  $("publish-button").textContent = "发布内容";
  $("cancel-edit").hidden = true;
  $("preview-panel").hidden = true;
  $("preview-body").replaceChildren();
  updateFields();
}
function updateFields() {
  const article = $("content-type").value === "article";
  $("article-fields").hidden = !article;
  $("game-fields").hidden = article;
  $("body").required = article;
  const upload = $("game-mode").value === "file";
  $("url-field").hidden = upload;
  $("file-field").hidden = !upload;
  $("game-url").required = !article && !upload;
  $("game-file").required = !article && upload && !editing?.item.managedPath;
  // Hidden invalid controls must not block native form validation.
  $("body").disabled = busy || !article;
  $("game-mode").disabled = busy || article;
  $("game-url").disabled = busy || article || upload;
  $("game-file").disabled = busy || article || !upload;
  $("content-type").disabled = busy || !!editing;
}
function row(item, kind) {
  const box = document.createElement("article");
  box.className = "managed-item";
  const type = document.createElement("span");
  type.className = "small-label";
  type.textContent = kind === "article" ? "文章" : "游戏";
  const title = document.createElement("h3");
  title.textContent = item.title;
  const note = document.createElement("p");
  note.textContent = [formatDate(item.publishedAt), item.summary]
    .filter(Boolean)
    .join(" · ");
  const actions = document.createElement("div");
  actions.className = "managed-actions";
  const edit = document.createElement("button");
  edit.type = "button";
  edit.textContent = "编辑";
  edit.setAttribute("aria-label", `编辑${item.title}`);
  edit.addEventListener("click", () => editItem(item, kind));
  const remove = document.createElement("button");
  remove.type = "button";
  remove.textContent = "删除";
  remove.className = "delete-button";
  remove.setAttribute("aria-label", `删除${item.title}`);
  remove.addEventListener("click", () => confirmDelete(item, kind));
  actions.append(edit, remove);
  box.append(type, title, note, actions);
  return box;
}
function renderManaged() {
  const list = $("managed-content");
  list.replaceChildren();
  for (const article of snapshot.catalog.articles)
    list.append(row(article, "article"));
  for (const game of snapshot.catalog.games) list.append(row(game, "game"));
  if (!list.childElementCount)
    list.append(
      emptyState("还没有发布内容。", "在左侧写下第一篇文章，或发布一个游戏。"),
    );
}
function editItem(item, kind) {
  if (busy) return;
  resetEditor();
  editing = { item, kind };
  $("content-type").value = kind;
  $("content-type").disabled = true;
  $("title").value = item.title;
  $("summary").value = item.summary;
  if (kind === "article") $("body").value = item.body;
  else if (item.managedPath) $("game-mode").value = "file";
  else {
    $("game-mode").value = "url";
    $("game-url").value = safeGameURL(item.url);
  }
  $("editor-heading").textContent = "编辑内容";
  $("publish-button").textContent = "保存修改";
  $("cancel-edit").hidden = false;
  updateFields();
  $("title").focus();
}
async function readGameFile() {
  const file = $("game-file").files[0];
  if (!file) return null;
  if (!/\.html?$/i.test(file.name) || file.size > MAX_GAME_BYTES || !file.size)
    throw new Error("请选择不超过 5 MB 的非空 HTML 游戏文件。");
  const text = await file.text();
  if (!/<(?:!doctype\s+html|html|body|script|canvas)(?:\s|>)/i.test(text))
    throw new Error("文件内容不像 HTML 游戏，请检查文件。");
  return text;
}
async function draft() {
  const kind = $("content-type").value;
  const title = $("title").value.trim(),
    summary = $("summary").value.trim();
  if (!title) throw new Error("请填写标题。");
  const item = {
    id: editing?.item.id || `${kind}-${crypto.randomUUID()}`,
    title,
    summary,
    publishedAt: editing?.item.publishedAt || new Date().toISOString(),
  };
  let fileChange;
  if (kind === "article") {
    item.body = $("body").value.trim();
    if (!item.body) throw new Error("请写下文章正文。");
  } else if ($("game-mode").value === "file") {
    const content = await readGameFile();
    if (content === null && !editing?.item.managedPath)
      throw new Error("请选择要发布的 HTML 游戏文件。");
    item.url = item.managedPath =
      editing?.item.managedPath || `games/uploads/${item.id}.html`;
    if (content !== null) fileChange = { path: item.managedPath, content };
  } else {
    const raw = $("game-url").value.trim();
    // Preserve existing relative paths when only title or summary changes.
    item.url =
      editing?.kind === "game" &&
      isLocalGame(editing.item) &&
      safeGameURL(editing.item.url) === raw
        ? editing.item.url
        : safeGameURL(raw);
    if (editing?.item.managedPath)
      fileChange = { path: editing.item.managedPath, remove: true };
  }
  return { kind, item, fileChange };
}
$("login-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  if (busy) return;
  const token = $("github-token").value.trim();
  $("github-token").value = "";
  if (!token) return;
  setBusy(true);
  status("正在验证权限并读取内容…");
  const pending = new GitHubStore(token);
  try {
    const login = await pending.authenticate();
    const state = await pending.snapshot();
    store?.dispose();
    store = pending;
    snapshot = state;
    $("admin-user").textContent = `${login} · 已连接网站仓库`;
    $("login-panel").hidden = true;
    $("dashboard").hidden = false;
    renderManaged();
    status("已连接，可以开始创作。", "success");
  } catch (error) {
    pending.dispose();
    status(error.message, "error");
  } finally {
    setBusy(false);
  }
});
$("logout").addEventListener("click", () => {
  if (busy) return;
  store?.dispose();
  store = null;
  snapshot = null;
  resetEditor();
  $("managed-content").replaceChildren();
  $("admin-user").textContent = "";
  $("dashboard").hidden = true;
  $("login-panel").hidden = false;
  status("已退出登录。");
  $("github-token").focus();
});
$("content-type").addEventListener("change", () => {
  updateFields();
  $("preview-panel").hidden = true;
});
$("game-mode").addEventListener("change", updateFields);
$("cancel-edit").addEventListener("click", resetEditor);
$("refresh-content").addEventListener("click", async () => {
  if (busy) return;
  setBusy(true);
  status("正在刷新…");
  try {
    snapshot = await store.snapshot();
    renderManaged();
    status("已读取仓库最新内容，当前草稿仍保留。", "success");
  } catch (error) {
    status(error.message, "error");
  } finally {
    setBusy(false);
    $("content-type").disabled = !!editing;
  }
});
$("preview-button").addEventListener("click", async () => {
  if (busy) return;
  try {
    const { kind, item, fileChange } = await draft();
    $("preview-title").textContent = item.title;
    $("preview-summary").textContent = item.summary;
    $("preview-body").replaceChildren();
    if (kind === "article") renderText($("preview-body"), item.body);
    else if (fileChange && !fileChange.remove) {
      // Sandboxing without scripts provides a safe visual preview while a credential is held.
      const frame = document.createElement("iframe");
      frame.title = "游戏静态预览";
      frame.setAttribute("sandbox", "");
      frame.srcdoc =
        "<meta http-equiv=\"Content-Security-Policy\" content=\"default-src 'none'; style-src 'unsafe-inline'; img-src data:;\">" +
        fileChange.content;
      const note = document.createElement("p");
      note.textContent = "此处仅预览静态画面。发布后可在游戏页运行。";
      $("preview-body").append(note, frame);
    } else $("preview-body").textContent = "游戏地址：" + safeGameURL(item.url);
    $("preview-panel").hidden = false;
  } catch (error) {
    status(error.message, "error");
  }
});
$("content-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  if (busy) return;
  setBusy(true);
  status("正在保存到网站仓库，请保持页面打开…");
  let saved = false;
  try {
    const { kind, item, fileChange } = await draft();
    const catalog = structuredClone(snapshot.catalog);
    const key = kind === "article" ? "articles" : "games";
    const index = catalog[key].findIndex((entry) => entry.id === item.id);
    if (editing && index < 0)
      throw new Error("这项内容已被删除，请取消编辑后重新发布。");
    if (index < 0) catalog[key].unshift(item);
    else catalog[key][index] = item;
    snapshot = await store.save(
      snapshot,
      catalog,
      `${editing ? "Update" : "Publish"} ${kind}: ${item.title}`,
      fileChange,
    );
    saved = true;
    renderManaged();
    status(
      "已提交到网站仓库。GitHub Pages 部署完成后，访客即可看到更新。",
      "success",
    );
  } catch (error) {
    status(
      error.message === "Failed to fetch"
        ? "网络连接中断，提交结果尚未确认。请先刷新内容确认是否已发布，再决定是否重试。"
        : error.message,
      "error",
    );
  } finally {
    setBusy(false);
    if (saved) resetEditor();
    else $("content-type").disabled = !!editing;
  }
});
function confirmDelete(item, kind) {
  if (busy) return;
  const dialog = $("delete-dialog");
  $("delete-description").textContent =
    `「${item.title}」将从网站移除。${item.managedPath ? "上传的 HTML 游戏文件也会一并删除。" : ""}`;
  dialog.returnValue = "cancel";
  dialog.addEventListener(
    "close",
    async () => {
      if (dialog.returnValue !== "confirm" || busy) return;
      setBusy(true);
      status("正在删除内容…");
      try {
        const catalog = structuredClone(snapshot.catalog);
        const key = kind === "article" ? "articles" : "games";
        catalog[key] = catalog[key].filter((entry) => entry.id !== item.id);
        snapshot = await store.save(
          snapshot,
          catalog,
          `Delete ${kind}: ${item.title}`,
          item.managedPath
            ? { path: item.managedPath, remove: true }
            : undefined,
        );
        renderManaged();
        if (editing?.item.id === item.id) resetEditor();
        status("删除已提交。网站将在 GitHub Pages 部署完成后更新。", "success");
      } catch (error) {
        status(error.message, "error");
      } finally {
        setBusy(false);
        $("content-type").disabled = !!editing;
      }
    },
    { once: true },
  );
  dialog.showModal();
}
// A restored history page must not retain an authenticated editor session.
addEventListener("pagehide", () => {
  store?.dispose();
  store = null;
  snapshot = null;
});
addEventListener("pageshow", (event) => {
  if (event.persisted) location.reload();
});
updateFields();
