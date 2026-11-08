# 部署生产构建

使用 Node.js 24 和仓库中的 npm 锁文件。

```sh
npm ci
npm run build
```

静态输出位于 `dist/`。Vite 使用相对资源路径，支持站点根目录与仓库子路径。可先用 `npm exec vite preview` 在本机检查生产构建。

## GitHub Pages

在仓库的 Pages 设置中选择 GitHub Actions。工作流应检出源代码，设置 Node.js 24，运行 `npm ci` 与 `npm run build`，然后将 `dist/` 上传为 Pages artifact 并部署。打开仓库的 Pages 子路径，检查主画布和工具栏。[GitHub Pages 官方说明](https://docs.github.com/en/pages/getting-started-with-github-pages/configuring-a-publishing-source-for-your-github-pages-site)

## Cloudflare Pages

连接源仓库并选择静态站点。构建命令为 `npm run build`，输出目录为 `dist`，设置 `NODE_VERSION=24`。也可以通过 Direct Upload 上传 `dist/` 中的产物。[构建环境](https://developers.cloudflare.com/pages/configuration/build-image/) · [直接上传](https://developers.cloudflare.com/pages/get-started/direct-upload/)

## 发布后检查

- 首页返回 HTTP 200，JavaScript 和 CSS 资源路径可加载。
- 支持 WebGL2 的浏览器能绘制黑洞，禁用 WebGL2 时显示降级提示。
- 桌面与移动端可操作画布和参数面板，PNG 与 WebM 依浏览器能力提供。
- 参数和收藏按浏览器来源保存。更换域名或从本地迁移时，可通过 JSON 转移当前参数。
