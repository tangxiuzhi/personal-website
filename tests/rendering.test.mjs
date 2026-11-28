import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { JSDOM } from "jsdom";
import { CONTENT_SERVICE } from "../js/model.js";
let counter = 0;
async function render(path, catalog, search = "", fail = false) {
  const dom = new JSDOM(
    await readFile(new URL("../" + path, import.meta.url), "utf8"),
    { url: "https://tangxiuzhi.com/" + path + search },
  );
  globalThis.document = dom.window.document;
  globalThis.location = dom.window.location;
  globalThis.fetch = async (url) => {
    assert.equal(url, CONTENT_SERVICE + "/api/content");
    return { ok: !fail, json: async () => catalog };
  };
  await import("../js/content.js?test=" + counter++);
  return dom.window.document;
}
test("article reader fetches hosted content and renders markup as text", async () => {
  const catalog = {
    version: 1,
    articles: [
      {
        id: "article-new",
        title: "新文章",
        summary: "介绍",
        body: "<img src=x onerror=alert(1)>\n\n第二段",
      },
    ],
    games: [],
  };
  const doc = await render("articles/read.html", catalog, "?id=article-new");
  assert.equal(doc.querySelector("#article-title").textContent, "新文章");
  assert.equal(doc.querySelector("#article-body img"), null);
  assert.match(doc.querySelector("#article-body").textContent, /<img/);
  assert.equal(doc.querySelector("#load-status").hidden, true);
});
test("uploaded game opens the backend file in a sandboxed player", async () => {
  const game = {
    id: "game-new",
    title: "新游戏",
    summary: "",
    url: "games/uploads/game-new.html",
    managedPath: "games/uploads/game-new.html",
  };
  const doc = await render(
    "games/play.html",
    { version: 1, articles: [], games: [game] },
    "?id=game-new",
  );
  const frame = doc.querySelector("#game-player iframe");
  assert.equal(frame.src, CONTENT_SERVICE + "/games/uploads/game-new.html");
  assert.ok(!frame.getAttribute("sandbox").includes("allow-same-origin"));
});
test("unavailable service reports failure without showing obsolete seed content", async () => {
  const doc = await render("games/index.html", null, "", true);
  assert.match(doc.querySelector("#load-status").textContent, /未能加载/);
  assert.equal(doc.querySelector("#game-list").childElementCount, 0);
});
test("static admin entrance forwards to the password service and has no token field", async () => {
  const doc = new JSDOM(
    await readFile(new URL("../admin/index.html", import.meta.url), "utf8"),
  ).window.document;
  assert.match(
    doc.querySelector('meta[http-equiv="refresh"]').content,
    /tangxiuzhi-content-admin/,
  );
  assert.equal(doc.querySelector("#github-token"), null);
});
