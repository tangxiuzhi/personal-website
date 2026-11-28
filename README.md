# 唐修治的个人网站

文章、游戏、新闻来源导航和工作流登录台，统一提供管理后台入口。静态 HTML、CSS 和原生 JavaScript，无运行时依赖、无构建步骤。沿用 GitHub Pages、`main` 分支根目录和自定义域名 `tangxiuzhi.com`。

## 页面

- `index.html`：首页。
- `articles/index.html`、`articles/read.html?id=…`：文章列表与正文。
- `games/index.html`、`games/play.html?id=…`：游戏列表与隔离运行容器。
- `games/seasons-valley/index.html`：保留原有《四季河谷的漫步》。直接打开时也提供管理后台入口。
- `news/index.html`：新华网、澎湃新闻、IT之家、36氪的来源导航，不伪造实时新闻。
- `admin/index.html`：管理员登录、文章和游戏的发布、编辑、预览、删除。
- `data/content.json`：公开的文章正文与游戏目录。

日记页面和导航已移除。工作流登录台仍链接至原有独立授权登录页面，其账号与业务数据不受本站后台管理。

## 本地查看

```sh
python3 -m http.server 8080
```

打开 `http://127.0.0.1:8080/`。页面采用相对路径，兼容自定义域名和 GitHub Pages 项目路径。内容页通过 `fetch` 读取目录，因此请使用 HTTP 服务，不要直接双击文件。

## 管理后台

1. 打开网站任意页面的「管理后台」。
2. 使用有 `tangxiuzhi/personal-website` 写入权限的 GitHub 账号，在 [GitHub 设置](https://github.com/settings/personal-access-tokens/new) 创建 Fine-grained personal access token。
3. Resource owner 选择 `tangxiuzhi`；仅授权 `personal-website` 仓库，将 Repository permissions → Contents 设为 **Read and write**。Metadata 的读取权限由 GitHub 自动提供。不需要授权其他仓库。
4. 在后台粘贴凭证连接，发布或管理内容。

授权凭证只在页面模块内存中保留，不写入 localStorage、sessionStorage、Cookie、URL、源码或仓库；输入框在提交连接时立即清空。退出、刷新或离开页面后需重新连接。后台仅向固定的 `https://api.github.com` 发出授权请求，并拒绝跟随重定向。请在可信设备上操作，使用适当到期时间的凭证，离开时退出登录。

后台校验 GitHub 账号及仓库写入权限。每次保存通过 GitHub Git Database API 建立一次原子提交，内容目录与游戏文件一并更新，最后以 `force: false` 更新 `main`。检测到其他修改时拒绝覆盖，保留草稿并提示先刷新。网络中断时请先刷新确认提交结果，避免重复发布。

GitHub Pages 由 `main` 的提交触发，完成部署后访客才会看到更新。后台的保存成功表示仓库已接收提交，不表示 Pages 部署已经完成。可在仓库 Pages / Actions 中检查部署状态。如果分支保护禁止直接写入，需按仓库规则调整发布流程；后台会显示错误，不会绕过保护。

### 文章

填写标题、一句话介绍和正文，支持发布与编辑。正文按纯文本呈现，空行分段，HTML 也作为文字显示，不会执行。没有文章时保留真实的空状态。

### 游戏

- **游戏链接**：发布 HTTPS 地址，前台在新窗口打开，使用 `noopener noreferrer`。
- **上传 HTML 游戏**：支持不超过 5 MB 的单个 `.html` 或 `.htm` 文件，保存至 `games/uploads/`。图片、样式和脚本需内嵌或使用完整 HTTPS 地址，不支持多文件 ZIP。
- 本站游戏从列表进入时在 `sandbox="allow-scripts allow-pointer-lock allow-downloads"` 的 iframe 中运行，不授予 `allow-same-origin`、弹窗或顶层导航权限。依赖同源存储、弹窗登录或独立服务器的游戏可能需要改用外部链接。
- 后台上传预览禁用脚本和外部网络，只预览静态画面；正式游戏页可运行脚本。
- 删除上传游戏时，目录条目和上传文件同时删除。删除既有《四季河谷的漫步》条目只会从列表下架，保留原始源文件。

### 删除与恢复

删除前显示二次确认。删除会提交到 GitHub，所有内容都可通过 Git 历史恢复。公开仓库中的旧文章和游戏即使从当前网站删除，仍可能存在于历史提交中，请只发布准备公开的内容。

## 开发与验证

页面不需要安装 npm 依赖即可托管。开发测试使用 Node.js 22+ 和 jsdom：

```sh
npm ci
npm test
```

测试覆盖目录校验、中文编码、安全 URL、权限拒绝、原子发布/删除、并发冲突及后台交互；使用模拟 GitHub 请求，不修改真实仓库。

`css/style.css` 统一视觉样式。公共内容用 `js/content.js` 读取，`js/model.js` 负责共享校验，后台交互在 `js/admin.js`，GitHub 提交逻辑在 `js/github.js`。不要把任何授权凭证加入文件。

`.openai/hosting.json` 和 `dist/` 仅用于受管环境本地预览，已被忽略，不参与 GitHub Pages 发布。原域名 `CNAME` 和 `.nojekyll` 保持有效。
