import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { setImmediate as tick } from "node:timers/promises";
import { JSDOM } from "jsdom";
import { encodeBase64 } from "../js/model.js";

const html = await readFile(
  new URL("../admin/index.html", import.meta.url),
  "utf8",
);
const dom = new JSDOM(html, { url: "https://tangxiuzhi.com/admin/index.html" });
const { window } = dom;
globalThis.document = window.document;
globalThis.addEventListener = window.addEventListener.bind(window);
globalThis.location = window.location;
const $ = (id) => document.getElementById(id);
let repoCatalog = { version: 1, articles: [], games: [] },
  head = "commit-0",
  lastTree,
  nextCatalog,
  calls = [],
  blocked = false;
globalThis.fetch = async (url, options) => {
  calls.push({ url, options });
  assert.ok(url.startsWith("https://api.github.com/"));
  assert.equal(options.headers.Authorization, "Bearer test-only");
  const path = url.replace("https://api.github.com", ""),
    body = options.body ? JSON.parse(options.body) : null;
  let data;
  if (path === "/user") {
    if (blocked) return { ok: false, status: 401 };
    data = { login: "test-editor" };
  } else if (path === "/repos/tangxiuzhi/personal-website")
    data = { permissions: { push: true } };
  else if (path.includes("/git/ref/heads/")) data = { object: { sha: head } };
  else if (path.includes("/contents/"))
    data = {
      encoding: "base64",
      content: encodeBase64(JSON.stringify(repoCatalog)),
    };
  else if (path.endsWith("/git/blobs")) data = { sha: "upload-blob" };
  else if (path.endsWith("/git/trees")) {
    lastTree = body.tree;
    nextCatalog = JSON.parse(
      body.tree.find((file) => file.path === "data/content.json").content,
    );
    data = { sha: "new-tree" };
  } else if (path.endsWith("/git/commits"))
    data = { sha: `commit-${calls.length}` };
  else if (path.includes("/git/commits/")) data = { tree: { sha: "old-tree" } };
  else if (path.includes("/git/refs/heads/")) {
    assert.equal(body.force, false);
    head = body.sha;
    repoCatalog = nextCatalog;
    data = {};
  } else throw new Error(`Unexpected endpoint: ${path}`);
  return { ok: true, status: 200, json: async () => data };
};
// jsdom does not implement the native modal API; keep its close event semantics.
$("delete-dialog").showModal = function () {
  this.open = true;
};
$("delete-dialog").close = function (value) {
  this.returnValue = value;
  this.open = false;
  this.dispatchEvent(new window.Event("close"));
};
await import("../js/admin.js");
const submit = (id) =>
  $(id).dispatchEvent(
    new window.Event("submit", { bubbles: true, cancelable: true }),
  );
async function settled() {
  for (let i = 0; i < 100; i++) {
    await tick();
    if (
      !$("publish-button").disabled &&
      !$("login-form").querySelector("button").disabled
    )
      return;
  }
  throw new Error("UI never left the busy state");
}
async function login() {
  $("github-token").value = "test-only";
  submit("login-form");
  await settled();
}
function change(id, value) {
  $(id).value = value;
  $(id).dispatchEvent(new window.Event("change", { bubbles: true }));
}

test("admin rejects invalid login, publishes and edits text, uploads and deletes games, and logs out", async () => {
  blocked = true;
  await login();
  assert.match($("admin-status").textContent, /无效或已过期/);
  assert.equal($("dashboard").hidden, true);
  assert.equal($("github-token").value, "");
  blocked = false;
  await login();
  assert.equal($("dashboard").hidden, false);
  assert.equal($("login-panel").hidden, true);
  assert.equal($("github-token").value, "");
  assert.equal(window.localStorage.length, 0);
  assert.equal(window.sessionStorage.length, 0);

  $("title").value = "中文文章 🌿";
  $("summary").value = "一段介绍";
  $("body").value = '<img src=x onerror="alert(1)">\n\n第二段';
  $("game-url").value = "not a URL";
  assert.equal($("game-url").disabled, true);
  assert.equal($("content-form").checkValidity(), true);
  $("preview-button").click();
  await tick();
  assert.equal($("preview-body").querySelector("img"), null);
  assert.match($("preview-body").textContent, /<img/);
  submit("content-form");
  await settled();
  assert.equal(repoCatalog.articles.length, 1);
  assert.equal(repoCatalog.articles[0].title, "中文文章 🌿");
  assert.equal(
    repoCatalog.articles[0].body,
    '<img src=x onerror="alert(1)">\n\n第二段',
  );
  assert.match($("admin-status").textContent, /已提交到网站仓库/);
  assert.equal($("title").value, "");

  document.querySelector(".managed-actions button").click();
  assert.equal($("content-type").disabled, true);
  $("title").value = "编辑过的文章";
  submit("content-form");
  await settled();
  assert.equal(repoCatalog.articles.length, 1);
  assert.equal(repoCatalog.articles[0].title, "编辑过的文章");
  assert.equal($("content-type").disabled, false);

  change("content-type", "game");
  assert.equal($("body").disabled, true);
  assert.equal($("game-url").disabled, false);
  $("title").value = "外部游戏";
  $("game-url").value = "https://example.com/play";
  submit("content-form");
  await settled();
  assert.equal(repoCatalog.games[0].url, "https://example.com/play");
  assert.equal(repoCatalog.games.length, 1);

  change("content-type", "game");
  change("game-mode", "file");
  assert.equal($("game-url").disabled, true);
  $("title").value = "上传游戏";
  Object.defineProperty($("game-file"), "files", {
    configurable: true,
    value: [
      {
        name: "game.html",
        size: 80,
        text: async () => "<!doctype html><title>测试</title><canvas></canvas>",
      },
    ],
  });
  submit("content-form");
  await settled();
  assert.equal(repoCatalog.games.length, 2);
  assert.match(repoCatalog.games[0].managedPath, /^games\/uploads\/game-/);
  assert.equal(lastTree.length, 2);
  assert.equal(lastTree[1].sha, "upload-blob");

  // The destructive action must wait for the explicit modal confirmation.
  const uploaded = document.querySelectorAll(".managed-item")[1];
  const priorCalls = calls.length;
  uploaded.querySelector(".delete-button").click();
  assert.equal(calls.length, priorCalls);
  assert.equal($("delete-dialog").open, true);
  $("delete-dialog").close("cancel");
  await tick();
  assert.equal(calls.length, priorCalls);
  uploaded.querySelector(".delete-button").click();
  $("delete-dialog").close("confirm");
  await settled();
  assert.equal(repoCatalog.games.length, 1);
  assert.equal(lastTree[1].sha, null);

  // Leave a real draft in place when another writer changes the branch.
  $("title").value = "尚未发布";
  $("body").value = "草稿";
  head = "someone-elses-commit";
  const priorArticles = repoCatalog.articles.length;
  submit("content-form");
  await settled();
  assert.match($("admin-status").textContent, /仓库已有新的修改/);
  assert.equal($("body").value, "草稿");
  assert.equal(repoCatalog.articles.length, priorArticles);
  $("refresh-content").click();
  await settled();
  submit("content-form");
  await settled();
  assert.equal(repoCatalog.articles.length, priorArticles + 1);

  $("logout").click();
  assert.equal($("dashboard").hidden, true);
  assert.equal($("login-panel").hidden, false);
  assert.equal($("body").value, "");
  assert.equal($("managed-content").childElementCount, 0);
  assert.equal(window.localStorage.length, 0);
  assert.equal(window.sessionStorage.length, 0);
  assert.equal(document.cookie, "");
});
