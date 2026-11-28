import test from "node:test";
import assert from "node:assert/strict";
import { readFile, access } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { JSDOM } from "jsdom";
const root = new URL("../", import.meta.url);
const pages = [
  "index.html",
  "articles/index.html",
  "articles/read.html",
  "games/index.html",
  "games/play.html",
  "news/index.html",
  "admin/index.html",
];
for (const path of pages) {
  test(`${path}: valid local links, complete navigation, and no diary entry`, async () => {
    const source = await readFile(new URL(path, root), "utf8");
    const doc = new JSDOM(source).window.document;
    assert.equal(doc.documentElement.lang, "zh-CN");
    assert.ok(doc.querySelector('meta[name="viewport"]'));
    assert.equal(doc.querySelectorAll("h1").length, 1);
    assert.ok(doc.querySelector("main#content"));
    assert.ok(
      doc.querySelector('nav[aria-label="主导航"] a[href*="news/index.html"]'),
    );
    assert.ok(doc.querySelector('header a[href*="admin/index.html"]'));
    assert.ok(
      doc.querySelector(
        'nav a[href="https://yongzhou-transmission-workflow.tangteng626764.chatgpt.site/login"]',
      ),
    );
    assert.ok(!source.includes("diary/"));
    assert.ok(!source.includes("日记"));
    for (const el of doc.querySelectorAll("a[href],link[href],script[src]")) {
      const href = el.getAttribute("href") ?? el.getAttribute("src");
      if (/^https:|^#/.test(href)) continue;
      assert.ok(!href.startsWith("/"), `root-relative link: ${href}`);
      const url = new URL(href, new URL(path, root));
      url.search = "";
      url.hash = "";
      await assert.doesNotReject(
        access(fileURLToPath(url)),
        `${path}: broken reference ${href}`,
      );
    }
  });
}
test("standalone game preserves its original bundle and offers the admin entrance", async () => {
  const source = await readFile(
    new URL("games/seasons-valley/index.html", root),
    "utf8",
  );
  assert.ok(source.includes('id="audition-bundle"'));
  assert.ok(source.includes('href="../../admin/index.html"'));
});
test("diary is removed and custom domain retained", async () => {
  await assert.rejects(access(new URL("diary/index.html", root)));
  assert.equal(
    (await readFile(new URL("CNAME", root), "utf8")).trim(),
    "tangxiuzhi.com",
  );
});
