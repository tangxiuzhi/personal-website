# 唐修治的个人网站

公开的文章、小游戏、每日新闻选读和独立工作流登录台。前台沿用 GitHub Pages 与自定义域名 `tangxiuzhi.com`，管理后台改为服务端账号密码登录。

## 管理内容

点击任意页面的「管理后台」即可前往 [内容管理服务](https://tangxiuzhi-content-admin.tangteng626764.chatgpt.site/admin/index.html)。输入管理员账号与密码后，可发布、编辑、预览和删除文章与游戏。不再需要 GitHub personal access token。

登录验证在服务端完成，密码使用 PBKDF2-SHA256 加盐哈希，运行时通过 `ADMIN_USERNAME` 和 `ADMIN_PASSWORD_HASH` 两个秘密配置提供；公开仓库与浏览器不保存密码哈希或明文密码。登录成功后使用 `Secure`、`HttpOnly`、`SameSite=Strict` Cookie，每次管理操作都校验服务端会话和请求来源。登录有失败次数限制，退出登录会立即撤销服务端会话。

文章与游戏目录保存在服务端 D1 数据库，HTML 游戏按块保存，保存后立即生效。前台读取 `/api/content` 的公开内容，管理接口不会开放跨域写入。版本校验与数据库批处理防止并发覆盖，并保证游戏文件与目录同步修改。文章仍按纯文本显示，游戏隔离运行。

只发布准备公开的内容。删除内容后立即下架，当前没有回收站。原有《四季河谷的漫步》和工作台登录地址保留。新闻栏目已移除四个站点导航，保留约五分钟的每日新闻选读；选读先交付作者审阅，确认后再发布。

## 本地查看与开发

```sh
python3 -m http.server 8080
```

浏览器打开 `http://127.0.0.1:8080/`。无需构建和运行时依赖。前台文章与游戏列表通过 `js/content.js` 读取托管内容服务；不要双击 HTML 文件运行。

```sh
npm ci
npm test
```

测试验证内容目录、中文编码、安全游戏链接和各页面导航。后台服务的源码在其独立 Sites 源码仓库中，本次工作区路径为 `/workspace/sites/personal-admin`，其中 `npm test` 覆盖密码验证、会话、来源校验、登录限流、内容发布、游戏隔离、并发冲突与退出撤销。

`js/model.js` 中的 `CONTENT_SERVICE` 是公开的服务地址，不是凭证。`data/content.json` 作为初始内容种子保留，前台不再把它作为实时数据源。`.openai/hosting.json` 和 `dist/` 仅用于本地受管预览，不参与 GitHub Pages 发布。
