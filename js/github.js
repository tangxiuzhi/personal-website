import {
  REPO,
  BRANCH,
  CATALOG,
  validateCatalog,
  encodeBase64,
  decodeBase64,
} from "./model.js";
const API = "https://api.github.com";
const ROOT = `/repos/${REPO}`;
const conflictMessage =
  "仓库已有新的修改。请先刷新已发布内容，再检查并重新发布；当前草稿仍保留。";
export class GitHubStore {
  #token;
  constructor(token, transport = fetch) {
    this.#token = token;
    this.transport = transport;
  }
  dispose() {
    this.#token = "";
  }
  async request(path, method = "GET", body) {
    if (!this.#token) throw new Error("请重新登录管理后台。");
    const response = await this.transport(`${API}${path}`, {
      method,
      credentials: "omit",
      redirect: "error",
      cache: "no-store",
      headers: {
        Accept: "application/vnd.github+json",
        Authorization: `Bearer ${this.#token}`,
        "X-GitHub-Api-Version": "2022-11-28",
        ...(body ? { "Content-Type": "application/json" } : {}),
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
    if (!response.ok) {
      if (response.status === 401)
        throw new Error("授权凭证无效或已过期，请退出并重新登录。");
      if (response.status === 403)
        throw new Error(
          "GitHub 拒绝了操作。请确认凭证有本仓库 Contents 读写权限，且未超过 API 调用限额。",
        );
      if (response.status === 404)
        throw new Error(
          "找不到仓库或内容，请确认凭证已授权 personal-website 仓库。",
        );
      if (response.status === 409 || response.status === 422)
        throw new Error(
          "提交未完成。仓库可能已有更新，或 main 分支限制直接写入。请刷新内容并检查仓库规则后重试。",
        );
      throw new Error(`GitHub 请求未完成（${response.status}），请稍后重试。`);
    }
    return response.status === 204 ? null : response.json();
  }
  async authenticate() {
    const user = await this.request("/user");
    const repo = await this.request(ROOT);
    if (!repo.permissions?.push)
      throw new Error("该账号没有网站仓库的写入权限。");
    return user.login;
  }
  async snapshot() {
    const ref = await this.request(`${ROOT}/git/ref/heads/${BRANCH}`);
    const head = ref.object.sha;
    const commit = await this.request(`${ROOT}/git/commits/${head}`);
    const file = await this.request(
      `${ROOT}/contents/${CATALOG}?ref=${encodeURIComponent(head)}`,
    );
    const blob =
      file.encoding === "base64"
        ? file
        : await this.request(`${ROOT}/git/blobs/${file.sha}`);
    if (blob.encoding !== "base64")
      throw new Error("目录编码无效，无法读取内容。");
    return {
      head,
      tree: commit.tree.sha,
      catalog: validateCatalog(JSON.parse(decodeBase64(blob.content))),
    };
  }
  async save(snapshot, catalog, message, fileChange) {
    validateCatalog(catalog);
    const current = await this.request(`${ROOT}/git/ref/heads/${BRANCH}`);
    if (current.object.sha !== snapshot.head) throw new Error(conflictMessage);
    const files = [
      {
        path: CATALOG,
        mode: "100644",
        type: "blob",
        content: JSON.stringify(catalog, null, 2) + "\n",
      },
    ];
    if (fileChange) {
      if (!/^games\/uploads\/[a-z0-9-]+\.html$/.test(fileChange.path))
        throw new Error("不允许修改该游戏文件路径。");
      if (fileChange.remove)
        files.push({
          path: fileChange.path,
          mode: "100644",
          type: "blob",
          sha: null,
        });
      else {
        const blob = await this.request(`${ROOT}/git/blobs`, "POST", {
          content: encodeBase64(fileChange.content),
          encoding: "base64",
        });
        files.push({
          path: fileChange.path,
          mode: "100644",
          type: "blob",
          sha: blob.sha,
        });
      }
    }
    const tree = await this.request(`${ROOT}/git/trees`, "POST", {
      base_tree: snapshot.tree,
      tree: files,
    });
    const commit = await this.request(`${ROOT}/git/commits`, "POST", {
      message,
      tree: tree.sha,
      parents: [snapshot.head],
    });
    // Non-forced update rejects a concurrent writer, keeping both catalog and upload atomic.
    await this.request(`${ROOT}/git/refs/heads/${BRANCH}`, "PATCH", {
      sha: commit.sha,
      force: false,
    });
    return { head: commit.sha, tree: tree.sha, catalog };
  }
}
