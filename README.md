# Share Comment

把豆瓣小组帖子下的单条回应渲染成 PNG 图片，用于发布个人广播。

## 安装

1. 安装 Greasemonkey、Violentmonkey 或 Tampermonkey。
2. 在脚本管理器里新建脚本。
3. 粘贴 [share-comment.user.js](./share-comment.user.js) 的完整内容并保存。
4. 打开 `https://www.douban.com/group/topic/.../` 形式的小组讨论页。

## 使用

1. 每条回应旁会出现 `分享为图片 | 复制`。
2. 点击 `分享为图片` 后，脚本会生成一张包含作者、回应内容、讨论标题和原帖链接的图片。
3. 在预览窗口点击 `复制图片`。
4. 点击 `打开广播页`，在豆瓣首页的广播发布框粘贴图片。
5. 检查内容后手动发布广播。
6. 点击 `复制` 会把这条回应转换成 Markdown 文本并写入剪贴板。

## 说明

- 脚本默认不自动发布广播，最后一步必须由你在豆瓣发布框里确认。
- 如果浏览器不允许直接复制图片，可以使用 `下载 PNG` 保存图片后手动上传。
- 生成图片依赖 `html-to-image`，由 userscript 的 `@require` 从 jsDelivr 加载。
- 为避免豆瓣跨域图片和远程 CSS 导致控制台报错，生成图不会抓取头像或回复内图片；回复内图片会显示为文字占位和原图链接。

## 开发验证

```bash
NPM_CONFIG_CACHE=/private/tmp/share-comment-npm-cache npm install
NPM_CONFIG_CACHE=/private/tmp/share-comment-npm-cache npm test
node --check share-comment.user.js
```
