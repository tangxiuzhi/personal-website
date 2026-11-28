import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  validateCatalog,
  safeGameURL,
  encodeBase64,
  decodeBase64,
} from "../js/model.js";
const original = JSON.parse(
  await readFile(new URL("../data/content.json", import.meta.url), "utf8"),
);
const article = {
  id: "article-test",
  title: "中文与 emoji 🌿",
  summary: "介绍",
  body: "正文\n\n第二段",
  publishedAt: "2026-11-28T00:00:00Z",
};
const catalog = () => ({ version: 1, articles: [{ ...article }], games: [] });
test("existing game catalog remains valid", () =>
  assert.equal(validateCatalog(original), original));
test("Chinese and emoji survive GitHub base64 round-trip", () =>
  assert.equal(
    decodeBase64(encodeBase64(article.body + article.title)),
    article.body + article.title,
  ));
test("reject executable, credential-bearing, protocol-relative and traversal game URLs", () => {
  for (const url of [
    "javascript:alert(1)",
    "data:text/html,test",
    "http://example.com",
    "https://user:secret@example.com/",
    "//example.com/a",
    "games/../admin/index.html",
    "games/uploads/../../index.html",
  ])
    assert.throws(() => safeGameURL(url));
});
test("accept HTTPS games and the two supported local game paths", () => {
  assert.equal(
    safeGameURL("https://example.com/play"),
    "https://example.com/play",
  );
  assert.match(
    safeGameURL("games/seasons-valley/index.html"),
    /games\/seasons-valley\/index.html$/,
  );
  assert.match(
    safeGameURL("games/uploads/game-test.html"),
    /games\/uploads\/game-test.html$/,
  );
});
test("reject duplicate identifiers and unsafe managed paths", () => {
  const data = catalog();
  data.articles.push({ ...article });
  assert.throws(() => validateCatalog(data));
  data.articles.pop();
  data.games.push({
    id: "game-test",
    title: "test",
    summary: "",
    url: "https://example.com/",
    managedPath: "index.html",
  });
  assert.throws(() => validateCatalog(data));
});
