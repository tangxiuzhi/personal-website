# 唐修治的个人网站

这是一个公开的静态网站，只有 HTML 和 CSS。没有构建步骤，没有登录，没有数据库，也没有第三方统计。

现在可以在本地打开。还没有开启 GitHub Pages，也没有添加 `CNAME` 或绑定域名。

公开日记还没有内容。游戏栏目现有《四季河谷的漫步》，文件在 `games/seasons-valley/index.html`。文章栏有三篇 X 收藏摘读，放在 `articles/`，不是唐修治的原创文章。空状态是如实写的，不要改成还没发生的经历、作品或日期。

## 本地查看

在仓库根目录执行：

```bash
python3 -m http.server 8080
```

浏览器打开 `http://127.0.0.1:8080/`。

直接双击 `index.html` 也能看栏目页。游戏若带脚本，用上面的本地服务器看更可靠，有的浏览器会限制 `file://` 页面里的脚本。

## 页面

| 文件 | 作用 |
| --- | --- |
| `index.html` | 首页 |
| `articles/index.html` | 文章列表 |
| `diary/index.html` | 公开日记列表 |
| `games/index.html` | 游戏列表 |
| `css/style.css` | 全站样式 |
| `.nojekyll` | 若以后使用 GitHub Pages，告诉它不要用 Jekyll 处理这个仓库 |

栏目页带有内容安全策略，禁止这些页面加载脚本。文章和日记沿用同样的限制。游戏是独立 HTML，不要把这行策略复制进去，否则游戏自己的脚本跑不了。

## 路径

页面之间只用相对路径，不要写成以 `/` 开头的地址。

这样三处都能用同一套链接：

- 本地静态服务器，不管仓库放在哪个目录
- 以后的 GitHub Pages 项目站点，地址形如 `https://<用户名>.github.io/personal-website/`
- 以后若改用自定义域名，站点在域名根目录

以 `/articles/` 这种根路径为例：在项目站点里会跳到用户主站的根目录，而不是本仓库。自定义域名的根目录则又能打开。相对路径两边都对。

| 当前文件 | 首页 | 文章列表 | 日记列表 | 游戏列表 | 样式 |
| --- | --- | --- | --- | --- | --- |
| `index.html` | `index.html` | `articles/index.html` | `diary/index.html` | `games/index.html` | `css/style.css` |
| `articles/index.html` 或 `articles/某篇.html` | `../index.html` | `index.html` | `../diary/index.html` | `../games/index.html` | `../css/style.css` |
| `diary/index.html` 或 `diary/某篇.html` | `../index.html` | `../articles/index.html` | `index.html` | `../games/index.html` | `../css/style.css` |
| `games/某游戏/index.html` | `../../index.html` | `../../articles/index.html` | `../../diary/index.html` | `../index.html` | 游戏可不使用全站样式 |

## 添加一篇文章

1. 在 `articles/` 新建文件，例如 `articles/note.html`。文件名用简短英文或拼音，避免空格。
2. 把下面的骨架放进去，改标题和正文。
3. 打开 `articles/index.html`，在列表里加上链接。若列表还是空状态，先去掉「还没有文章。」。
4. 只提交准备公开的文字。

```html
<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta http-equiv="Content-Security-Policy" content="default-src 'self'; style-src 'self'; img-src 'self'; font-src 'self'; script-src 'none'; object-src 'none'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'">
  <title>文章标题 · 唐修治的个人网站</title>
  <link rel="stylesheet" href="../css/style.css">
</head>
<body>
  <a class="skip" href="#content">跳到内容</a>
  <header class="site-header">
    <div class="wrap header-inner">
      <a class="site-name" href="../index.html">唐修治</a>
      <nav aria-label="栏目">
        <ul>
          <li><a href="../index.html">首页</a></li>
          <li><a href="index.html" aria-current="page">文章</a></li>
          <li><a href="../diary/index.html">日记</a></li>
          <li><a href="../games/index.html">游戏</a></li>
        </ul>
      </nav>
    </div>
  </header>
  <main id="content" class="wrap">
    <h1>文章标题</h1>
    <p>正文写在这里。</p>
  </main>
  <footer class="site-footer">
    <div class="wrap">
      <p>这些页面是公开的静态文件。</p>
    </div>
  </footer>
</body>
</html>
```

`articles/index.html` 里的列表示例：

```html
<ul class="entries">
  <li>
    <a href="note.html">文章标题</a>
    <p>一句自己写的说明。</p>
  </li>
</ul>
```

有文章之后，首页对应卡片上的「还没有文章。」可以改成你自己的简短说明，也可以留着，直到你愿意改。

## 添加一篇公开日记

做法和文章相同，目录换成 `diary/`。

日记页没有隐藏开关。写进 `diary/` 并出现在列表里的内容，任何人都能阅读。不想公开的文字不要放进这个仓库。

列表仍写在 `diary/index.html`。有日记后，去掉「还没有公开日记。」

## 添加一个本地 HTML 游戏

1. 建目录 `games/游戏目录名/`，里面放该游戏的 `index.html`。图片、脚本、样式都放在这个目录里，用相对路径引用。
2. 打开 `games/index.html`，在现有列表里加上指向 `游戏目录名/index.html` 的链接。若列表还是空状态，先去掉「还没有游戏。」。
3. 游戏页是完整的独立页面，不必套用栏目页的导航和内容安全策略。
4. 若要链回本站，用相对路径。回到游戏列表是 `../index.html`，回到首页是 `../../index.html`。

```html
<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>游戏名称</title>
</head>
<body>
  <p><a href="../index.html">返回游戏列表</a></p>
</body>
</html>
```

`games/index.html` 里的列表示例：

```html
<ul class="entries">
  <li>
    <a href="游戏目录名/index.html">游戏名称</a>
    <p>一句自己写的说明。</p>
  </li>
</ul>
```

不要默认引用其他网站上的脚本。游戏需要的文件放在它自己的目录里，离线打开和以后放到静态托管上都更稳。

## 更新导航

导航没有单独的生成步骤，写在每个栏目页、文章页和日记页里。改名称或增减栏目时，把现有这些文件里的 `<nav>` 改成同一套链接，并按该文件所在目录调整 `../`：

- `index.html`
- `articles/index.html`
- `diary/index.html`
- `games/index.html`
- 之后新增的每篇文章、每篇日记

当前页的链接加上 `aria-current="page"`。文章正文算在「文章」下，日记正文算在「日记」下。

游戏页默认不加这套导航。要加的话，按 `games/某游戏/index.html` 那一行的相对路径自己写。

## 现在没有的东西

- 没有可视化写作后台。更新就是改 HTML，再提交到仓库。
- 没有登录，也没有只给自己看的区域。
- 没有访问统计。
- 没有开启 GitHub Pages，没有 `CNAME`，没有改域名解析。这些要另外决定，不在这次的页面里。
