export const CONTENT_SERVICE =
  "https://tangxiuzhi-content-admin.tangteng626764.chatgpt.site";
export const BRANCH = "main";
export const CATALOG = "data/content.json";
export const MAX_GAME_BYTES = 5 * 1024 * 1024;
export const SITE_ROOT = new URL("../", import.meta.url);

export function validateCatalog(value) {
  if (
    !value ||
    value.version !== 1 ||
    !Array.isArray(value.articles) ||
    !Array.isArray(value.games)
  )
    throw new Error("内容目录格式无效，请检查 data/content.json。");
  const ids = new Set();
  for (const [kind, items] of [
    ["article", value.articles],
    ["game", value.games],
  ]) {
    for (const item of items) {
      if (
        !item ||
        typeof item.id !== "string" ||
        !/^[a-z0-9][a-z0-9-]{0,99}$/.test(item.id) ||
        ids.has(item.id)
      )
        throw new Error("内容编号无效或重复。");
      ids.add(item.id);
      if (
        typeof item.title !== "string" ||
        !item.title.trim() ||
        item.title.length > 120 ||
        typeof item.summary !== "string" ||
        item.summary.length > 500
      )
        throw new Error("内容标题或介绍格式无效。");
      if (
        kind === "article" &&
        (typeof item.body !== "string" ||
          !item.body.trim() ||
          item.body.length > 200000)
      )
        throw new Error("文章正文无效。");
      if (kind === "game") {
        safeGameURL(item.url);
        if (
          item.managedPath !== undefined &&
          (!/^games\/uploads\/[a-z0-9-]+\.html$/.test(item.managedPath) ||
            item.url !== item.managedPath)
        )
          throw new Error("游戏文件路径无效。");
      }
    }
  }
  return value;
}

export function safeGameURL(value) {
  if (typeof value !== "string" || !value || value.length > 2048)
    throw new Error("请输入有效的游戏网址。");
  if (
    /^games\/(?:seasons-valley\/index|uploads\/[a-z0-9-]+)\.html$/.test(value)
  )
    return new URL(
      value,
      value.startsWith("games/uploads/") ? CONTENT_SERVICE + "/" : SITE_ROOT,
    ).href;
  const url = new URL(value);
  if (url.protocol !== "https:" || url.username || url.password)
    throw new Error("外部游戏必须使用不包含账号密码的 HTTPS 地址。");
  return url.href;
}

export function isLocalGame(game) {
  return game.url.startsWith("games/");
}
export function formatDate(value) {
  if (!value || Number.isNaN(Date.parse(value))) return "";
  return new Intl.DateTimeFormat("zh-CN", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "long",
    day: "numeric",
  }).format(new Date(value));
}
export function encodeBase64(value) {
  const bytes = new TextEncoder().encode(value);
  let binary = "";
  for (let i = 0; i < bytes.length; i += 8192)
    binary += String.fromCharCode(...bytes.subarray(i, i + 8192));
  return btoa(binary);
}
export function decodeBase64(value) {
  return new TextDecoder().decode(
    Uint8Array.from(atob(value.replace(/\s/g, "")), (char) =>
      char.charCodeAt(0),
    ),
  );
}
export function emptyState(title, detail) {
  const box = document.createElement("div");
  box.className = "empty";
  const h = document.createElement("h3");
  h.textContent = title;
  const p = document.createElement("p");
  p.textContent = detail;
  box.append(h, p);
  return box;
}
export function renderText(container, text) {
  container.replaceChildren();
  for (const paragraph of text.split(/\n\s*\n/)) {
    const p = document.createElement("p");
    p.textContent = paragraph;
    container.append(p);
  }
}
