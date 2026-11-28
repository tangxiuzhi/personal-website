import {
  CONTENT_SERVICE,
  validateCatalog,
  safeGameURL,
  isLocalGame,
  formatDate,
  emptyState,
  renderText,
} from "./model.js";
const status = document.querySelector("#load-status");
function node(tag, className, text) {
  const el = document.createElement(tag);
  if (className) el.className = className;
  if (text) el.textContent = text;
  return el;
}
try {
  const response = await fetch(CONTENT_SERVICE + "/api/content", {
    cache: "no-cache",
  });
  if (!response.ok) throw new Error("读取失败");
  const content = validateCatalog(await response.json());
  const articles = document.querySelector("#article-list");
  if (articles) {
    document.querySelector("#content-count").textContent =
      `${content.articles.length} 篇文章`;
    if (!content.articles.length)
      articles.append(
        emptyState(
          "还没有文章，下一篇从这里开始。",
          "写好的文字，会慢慢出现在这里。",
        ),
      );
    for (const article of content.articles) {
      const link = node("a", "article-card");
      link.href = `read.html?id=${encodeURIComponent(article.id)}`;
      const date = node("time", "", formatDate(article.publishedAt));
      if (article.publishedAt) date.dateTime = article.publishedAt;
      link.append(
        node("h3", "", article.title),
        node("p", "", article.summary),
        date,
      );
      articles.append(link);
    }
  }
  const games = document.querySelector("#game-list");
  if (games) {
    document.querySelector("#content-count").textContent =
      `${content.games.length} 个游戏`;
    if (!content.games.length)
      games.append(
        emptyState("游戏架暂时空着。", "新的小游戏发布后会出现在这里。"),
      );
    for (const game of content.games) {
      const card = node("article", "game-card");
      const cover = node(
        "div",
        `game-illustration${game.id === "seasons-valley" ? "" : " generic"}`,
      );
      cover.setAttribute("aria-hidden", "true");
      cover.append(
        node("span", "game-sun"),
        node(
          "span",
          "game-cover-label",
          game.id === "seasons-valley"
            ? "四季流转，\n慢慢漫游。"
            : "一点好奇，\n一个新世界。",
        ),
      );
      const info = node("div", "game-card-content");
      const link = node(
        "a",
        "button primary",
        isLocalGame(game) ? "开始游戏" : "打开游戏 · 新窗口",
      );
      link.href = isLocalGame(game)
        ? `play.html?id=${encodeURIComponent(game.id)}`
        : safeGameURL(game.url);
      if (!isLocalGame(game)) {
        link.target = "_blank";
        link.rel = "noopener noreferrer";
      }
      info.append(
        node("h3", "", game.title),
        node("p", "", game.summary),
        link,
      );
      card.append(cover, info);
      games.append(card);
    }
  }
  const articleDetail = document.querySelector("#article-detail");
  if (articleDetail) {
    const article = content.articles.find(
      (item) => item.id === new URLSearchParams(location.search).get("id"),
    );
    if (!article) {
      status.textContent = "这篇文章不存在或已删除。";
    } else {
      document.title = `${article.title} · 唐修治`;
      document.querySelector("#article-title").textContent = article.title;
      document.querySelector("#article-summary").textContent = article.summary;
      document.querySelector("#article-summary").hidden = !article.summary;
      document.querySelector("#article-date").textContent = formatDate(
        article.publishedAt,
      );
      renderText(document.querySelector("#article-body"), article.body);
      articleDetail.hidden = false;
    }
    if (!article) throw new Error("not-found");
  }
  const player = document.querySelector("#game-player");
  if (player) {
    const game = content.games.find(
      (item) => item.id === new URLSearchParams(location.search).get("id"),
    );
    if (!game) {
      status.textContent = "这个游戏不存在或已下架。";
      throw new Error("not-found");
    }
    document.title = `${game.title} · 唐修治`;
    document.querySelector("#game-title").textContent = game.title;
    if (!isLocalGame(game)) {
      const link = node("a", "button primary", "在新窗口打开游戏");
      link.href = safeGameURL(game.url);
      link.target = "_blank";
      link.rel = "noopener noreferrer";
      player.append(link);
    } else {
      const frame = node("iframe");
      frame.title = game.title;
      frame.src = safeGameURL(game.url);
      frame.setAttribute(
        "sandbox",
        "allow-scripts allow-pointer-lock allow-downloads",
      );
      frame.allow = "fullscreen";
      player.append(frame);
      const full = document.querySelector("#fullscreen");
      full.hidden = !player.requestFullscreen;
      full.addEventListener("click", async () => {
        try {
          await player.requestFullscreen();
        } catch {
          status.textContent = "当前浏览器不支持全屏，请在页面中继续游戏。";
          status.hidden = false;
        }
      });
    }
  }
  status.hidden = true;
} catch (error) {
  if (error.message !== "not-found")
    status.textContent = "内容暂时未能加载，请刷新重试。";
}
