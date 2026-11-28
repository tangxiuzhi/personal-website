import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  validateCatalog,
  safeGameURL,
  encodeBase64,
  decodeBase64,
} from "../js/model.js";
import { GitHubStore } from "../js/github.js";
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
function mockTransport(responses) {
  const calls = [];
  const send = async (url, options) => {
    calls.push({
      url,
      options,
      body: options.body ? JSON.parse(options.body) : undefined,
    });
    const next = responses.shift();
    assert.ok(next, `Unexpected request: ${url}`);
    return {
      ok: !next.status || next.status < 400,
      status: next.status || 200,
      json: async () => next.data,
    };
  };
  return { calls, send };
}
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
test("a concurrent edit is detected before any write", async () => {
  const mock = mockTransport([{ data: { object: { sha: "newer" } } }]);
  const store = new GitHubStore("test-only", mock.send);
  await assert.rejects(
    store.save({ head: "old", tree: "old-tree" }, catalog(), "publish"),
    /仓库已有新的修改/,
  );
  assert.equal(mock.calls.length, 1);
  assert.equal(mock.calls[0].options.method, "GET");
});
test("upload and catalog publish in a single non-forced commit", async () => {
  const mock = mockTransport([
    { data: { object: { sha: "old" } } },
    { data: { sha: "game-blob" } },
    { data: { sha: "new-tree" } },
    { data: { sha: "new-commit" } },
    { data: {} },
  ]);
  const store = new GitHubStore("test-only", mock.send);
  const data = catalog();
  data.games.push({
    id: "game-test",
    title: "游戏",
    summary: "",
    url: "games/uploads/game-test.html",
    managedPath: "games/uploads/game-test.html",
  });
  const result = await store.save(
    { head: "old", tree: "old-tree" },
    data,
    "publish",
    {
      path: "games/uploads/game-test.html",
      content: "<!doctype html><title>游戏</title>",
    },
  );
  assert.equal(result.head, "new-commit");
  assert.equal(mock.calls[2].body.base_tree, "old-tree");
  assert.equal(mock.calls[2].body.tree.length, 2);
  assert.equal(mock.calls[2].body.tree[1].sha, "game-blob");
  assert.deepEqual(mock.calls[3].body.parents, ["old"]);
  assert.deepEqual(mock.calls[4].body, { sha: "new-commit", force: false });
  assert.ok(
    mock.calls.every(
      (call) =>
        call.options.credentials === "omit" &&
        call.options.redirect === "error",
    ),
  );
});
test("deleting an uploaded game atomically removes its file and catalog entry", async () => {
  const mock = mockTransport([
    { data: { object: { sha: "old" } } },
    { data: { sha: "new-tree" } },
    { data: { sha: "new-commit" } },
    { data: {} },
  ]);
  const store = new GitHubStore("test-only", mock.send);
  await store.save({ head: "old", tree: "old-tree" }, catalog(), "delete", {
    path: "games/uploads/game-test.html",
    remove: true,
  });
  assert.deepEqual(mock.calls[1].body.tree[1], {
    path: "games/uploads/game-test.html",
    mode: "100644",
    type: "blob",
    sha: null,
  });
});
test("file changes cannot escape the uploads directory", async () => {
  const mock = mockTransport([{ data: { object: { sha: "old" } } }]);
  await assert.rejects(
    new GitHubStore("test-only", mock.send).save(
      { head: "old", tree: "tree" },
      catalog(),
      "bad",
      { path: "index.html", content: "bad" },
    ),
    /不允许/,
  );
  assert.equal(mock.calls.length, 1);
});
test("a ref race or branch rule rejection never reports a successful save", async () => {
  const mock = mockTransport([
    { data: { object: { sha: "old" } } },
    { data: { sha: "tree" } },
    { data: { sha: "commit" } },
    { status: 422 },
  ]);
  await assert.rejects(
    new GitHubStore("test-only", mock.send).save(
      { head: "old", tree: "tree" },
      catalog(),
      "race",
    ),
    /提交未完成/,
  );
});
test("snapshot reads from an immutable commit and preserves Unicode", async () => {
  const mock = mockTransport([
    { data: { object: { sha: "exact-head" } } },
    { data: { tree: { sha: "tree" } } },
    {
      data: {
        encoding: "base64",
        content: encodeBase64(JSON.stringify(catalog())),
      },
    },
  ]);
  const state = await new GitHubStore("test-only", mock.send).snapshot();
  assert.equal(state.catalog.articles[0].title, article.title);
  assert.ok(mock.calls[2].url.endsWith("?ref=exact-head"));
});
test("revoking the in-memory token prevents subsequent requests", async () => {
  const mock = mockTransport([]);
  const store = new GitHubStore("test-only", mock.send);
  store.dispose();
  await assert.rejects(store.snapshot(), /重新登录/);
  assert.equal(mock.calls.length, 0);
});
test("accounts without repository write permissions cannot authenticate", async () => {
  const mock = mockTransport([
    { data: { login: "reader" } },
    { data: { permissions: { push: false } } },
  ]);
  await assert.rejects(
    new GitHubStore("test-only", mock.send).authenticate(),
    /没有.*写入权限/,
  );
});
