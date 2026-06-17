// ==UserScript==
// @name         Douban Group Reply Image Broadcaster
// @namespace    https://github.com/xupeng/share-comment
// @version      0.1.9
// @description  Share a single Douban group topic reply as an image for a personal broadcast.
// @author       xupeng
// @match        https://www.douban.com/group/topic/*
// @match        https://m.douban.com/group/topic/*
// @require      https://cdn.jsdelivr.net/npm/html-to-image@1.11.11/dist/html-to-image.min.js
// @grant        GM_addStyle
// @grant        GM_download
// @grant        GM_notification
// @grant        GM_setClipboard
// @run-at       document-idle
// ==/UserScript==

(function bootstrap(root, factory) {
  "use strict";

  const api = factory(root);

  if (typeof module === "object" && module.exports) {
    module.exports = api;
  }

  if (root && root.document && !root.__DOUBAN_REPLY_IMAGE_SHARE_TEST__) {
    api.init(root);
  }
})(typeof globalThis !== "undefined" ? globalThis : this, function createApi(root) {
  "use strict";

  const BUTTON_CLASS = "sc-share-reply-button";
  const COPY_BUTTON_CLASS = "sc-copy-reply-button";
  const ACTIONS_CLASS = "sc-share-reply-actions";
  const SEPARATOR_CLASS = "sc-share-reply-separator";
  const INJECTED_ATTR = "data-sc-share-reply-injected";
  const STYLE_ID = "sc-share-comment-style";
  const STAGE_ID = "sc-share-comment-stage";
  const TOPIC_URL_RE = /^https:\/\/(?:www|m)\.douban\.com\/group\/topic\/\d+\/?/;

  const REPLY_SELECTORS = [
    "ul.topic-reply > li.comment-item",
    "ul.topic-reply > li.reply-item",
    "#comments > li.comment-item",
    "#comments > li.reply-item",
    "#comments > li",
    "#comments .comment-item",
    ".comment-list .comment-item",
    "li.comment-item",
    ".reply-list .reply-item",
    "div[id^='comment-']",
  ];

  const CONTENT_SELECTORS = [
    ".reply-content",
    ".comment-content",
    ".topic-reply-content",
    ".reply-doc .content",
    ".comment-doc .content",
    ".reply-doc p",
    ".comment-doc p",
    ".content",
  ];

  const ACTION_SELECTORS = [
    ".operation",
    ".actions",
    ".comment-actions",
    ".reply-actions",
    ".reply-doc",
    ".comment-doc",
  ];

  const STYLE_TEXT = `
    .${ACTIONS_CLASS} {
      display: inline-block;
      margin-top: 8px;
    }
    .${BUTTON_CLASS},
    .${COPY_BUTTON_CLASS} {
      appearance: none;
      background: transparent;
      border: 0;
      color: #337a2c;
      cursor: pointer;
      font: inherit;
      margin: 0;
      padding: 0;
      vertical-align: baseline;
    }
    .${BUTTON_CLASS}:hover,
    .${COPY_BUTTON_CLASS}:hover {
      background: transparent;
      color: #2f7d32;
      text-decoration: underline;
    }
    .${SEPARATOR_CLASS} {
      color: #aaa;
      margin: 0 6px;
    }
    .sc-share-overlay {
      align-items: center;
      background: rgba(0, 0, 0, 0.42);
      bottom: 0;
      display: flex;
      justify-content: center;
      left: 0;
      padding: 24px;
      position: fixed;
      right: 0;
      top: 0;
      z-index: 2147483647;
    }
    .sc-share-dialog {
      background: #fff;
      border-radius: 8px;
      box-shadow: 0 16px 50px rgba(0, 0, 0, 0.28);
      color: #222;
      font: 13px/1.6 -apple-system, BlinkMacSystemFont, "Helvetica Neue", Helvetica, Arial, sans-serif;
      max-height: calc(100vh - 48px);
      overflow: auto;
      padding: 18px;
      width: min(760px, calc(100vw - 48px));
    }
    .sc-share-dialog h2 {
      color: #111;
      font-size: 16px;
      font-weight: 600;
      line-height: 1.4;
      margin: 0 0 12px;
    }
    .sc-share-preview {
      background: #f7f7f7;
      border: 1px solid #e5e5e5;
      border-radius: 6px;
      margin: 12px 0;
      max-height: 62vh;
      overflow: auto;
      padding: 12px;
      text-align: center;
    }
    .sc-share-preview img {
      background: #fff;
      box-shadow: 0 2px 10px rgba(0, 0, 0, 0.08);
      height: auto;
      max-width: 100%;
    }
    .sc-share-dialog-actions {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      justify-content: flex-end;
      margin-top: 12px;
    }
    .sc-share-dialog-actions button {
      appearance: none;
      border: 1px solid #d6d6d6;
      border-radius: 4px;
      background: #fff;
      color: #222;
      cursor: pointer;
      font-size: 13px;
      line-height: 1.4;
      padding: 6px 12px;
    }
    .sc-share-dialog-actions .sc-share-primary {
      background: #2e8b57;
      border-color: #2e8b57;
      color: #fff;
    }
    .sc-share-hint {
      color: #666;
      margin: 8px 0 0;
    }
    .sc-share-error {
      color: #b00020;
      margin: 8px 0 0;
      white-space: pre-wrap;
    }
    .sc-share-toast {
      background: rgba(0, 0, 0, 0.78);
      border-radius: 4px;
      bottom: 28px;
      color: #fff;
      font: 13px/1.5 -apple-system, BlinkMacSystemFont, "Helvetica Neue", Helvetica, Arial, sans-serif;
      left: 50%;
      max-width: min(520px, calc(100vw - 48px));
      padding: 8px 12px;
      position: fixed;
      transform: translateX(-50%);
      z-index: 2147483647;
    }
    #${STAGE_ID} {
      left: -10000px;
      position: fixed;
      top: 0;
      width: 390px;
      z-index: -1;
    }
    .sc-share-card {
      background: #fff;
      border: 1px solid #e4e4e4;
      border-radius: 8px;
      box-sizing: border-box;
      color: #222;
      font: 16px/1.75 -apple-system, BlinkMacSystemFont, "Helvetica Neue", Helvetica, Arial, sans-serif;
      padding: 18px;
      width: 390px;
    }
    .sc-share-card-header {
      align-items: center;
      display: flex;
      gap: 12px;
      margin-bottom: 16px;
    }
    .sc-share-card-label {
      color: #777;
      font-size: 12px;
      line-height: 1.4;
    }
    .sc-share-card-author {
      color: #111;
      font-size: 15px;
      font-weight: 600;
      line-height: 1.4;
      margin-top: 2px;
    }
    .sc-share-card-time {
      color: #888;
      font-size: 12px;
      line-height: 1.4;
      margin-top: 2px;
    }
    .sc-share-card-content {
      color: #222;
      font-size: 16px;
      overflow-wrap: anywhere;
      white-space: normal;
    }
    .sc-share-card-content img {
      border-radius: 4px;
      height: auto;
      max-width: 100%;
    }
    .sc-share-card-image-placeholder {
      background: #f7f7f7;
      border: 1px dashed #d8d8d8;
      border-radius: 4px;
      color: #666;
      font-size: 13px;
      margin: 10px 0;
      overflow-wrap: anywhere;
      padding: 10px 12px;
    }
    .sc-share-card-image-url {
      color: #888;
      font-size: 12px;
      margin-top: 4px;
    }
    .sc-share-card-source {
      border-top: 1px solid #eee;
      color: #666;
      font-size: 12px;
      line-height: 1.5;
      margin-top: 18px;
      overflow-wrap: anywhere;
      padding-top: 12px;
    }
    .sc-share-card-topic {
      color: #333;
      font-weight: 600;
      margin-bottom: 4px;
    }
  `;

  function normalizeText(value) {
    return String(value || "").replace(/\s+/g, " ").trim();
  }

  function isDoubanGroupTopicUrl(href) {
    try {
      const url = new URL(href);
      return TOPIC_URL_RE.test(url.href);
    } catch (error) {
      return false;
    }
  }

  function getTopicInfo(document, locationLike) {
    const titleNode = document.querySelector("h1");
    const documentTitle = String(document.title || "").replace(/\s*\(豆瓣\)\s*$/, "");
    const title = normalizeText(titleNode && titleNode.textContent) || normalizeText(documentTitle) || "豆瓣小组讨论";
    const url = new URL(locationLike.href);
    url.search = "";
    url.hash = "";
    return { title, url: url.href };
  }

  function uniqueElements(elements) {
    return Array.from(new Set(elements));
  }

  function firstMatching(rootNode, selectors) {
    for (const selector of selectors) {
      const node = rootNode.querySelector(selector);
      if (node) return node;
    }
    return null;
  }

  function hasReplyContent(element) {
    if (!element || element.nodeType !== 1) return false;
    if (element.querySelector(`.${BUTTON_CLASS}`)) return true;
    const content = firstMatching(element, CONTENT_SELECTORS);
    const text = normalizeText((content || element).textContent);
    return text.length > 0;
  }

  function removeNestedElements(elements) {
    return elements.filter((element) => !elements.some((other) => other !== element && other.contains(element)));
  }

  function findReplyItems(document) {
    const found = [];
    for (const selector of REPLY_SELECTORS) {
      found.push(...document.querySelectorAll(selector));
    }
    return removeNestedElements(uniqueElements(found).filter(hasReplyContent));
  }

  function findActionContainer(replyElement) {
    return firstMatching(replyElement, ACTION_SELECTORS) || replyElement;
  }

  function insertShareActions(replyElement, shareButton, copyButton) {
    const actionContainer = findActionContainer(replyElement);
    const document = actionContainer.ownerDocument;
    const actions = document.createElement("span");
    actions.className = ACTIONS_CLASS;

    const separator = document.createElement("span");
    separator.className = SEPARATOR_CLASS;
    separator.textContent = " | ";

    actions.appendChild(shareButton);
    actions.appendChild(separator);
    actions.appendChild(copyButton);
    actionContainer.appendChild(actions);
  }

  function injectShareButtons(document, onShare, runtimeRoot) {
    let injected = 0;
    const currentRoot = runtimeRoot || document.defaultView || root;

    for (const reply of findReplyItems(document)) {
      if (reply.getAttribute(INJECTED_ATTR) === "1" || reply.querySelector(`.${BUTTON_CLASS}`)) {
        continue;
      }

      const button = document.createElement("button");
      button.type = "button";
      button.className = BUTTON_CLASS;
      button.textContent = "分享为图片";
      button.addEventListener("click", (event) => {
        event.preventDefault();
        event.stopPropagation();
        onShare(reply);
      });

      const copyButton = document.createElement("button");
      copyButton.type = "button";
      copyButton.className = COPY_BUTTON_CLASS;
      copyButton.textContent = "复制";
      copyButton.addEventListener("click", async (event) => {
        event.preventDefault();
        event.stopPropagation();
        try {
          const message = await copyReplyMarkdown(currentRoot, reply);
          notify(currentRoot, message);
        } catch (error) {
          notify(currentRoot, `复制失败：${error && error.message ? error.message : String(error)}`);
        }
      });

      insertShareActions(reply, button, copyButton);
      reply.setAttribute(INJECTED_ATTR, "1");
      injected += 1;
    }

    return injected;
  }

  function getAuthorInfo(replyElement) {
    const authorLink =
      replyElement.querySelector(".author a[href*='/people/']") ||
      replyElement.querySelector("h4 a[href*='/people/']") ||
      replyElement.querySelector("a[href*='/people/']");
    const timeNode = replyElement.querySelector("time, .pubtime, .reply-time, .timestamp, .created_at");

    return {
      name: normalizeText(authorLink && authorLink.textContent) || "豆瓣用户",
      url: authorLink ? authorLink.href : "",
      time: normalizeText((timeNode && (timeNode.getAttribute("datetime") || timeNode.textContent)) || ""),
    };
  }

  function removeUnwantedNodes(rootNode) {
    const selectors = [
      `.${BUTTON_CLASS}`,
      ".operation",
      ".actions",
      ".comment-actions",
      ".reply-actions",
      "script",
      "style",
      "noscript",
      "iframe",
      "button",
      "input",
      "textarea",
      "select",
    ];

    for (const node of rootNode.querySelectorAll(selectors.join(","))) {
      node.remove();
    }
  }

  function replaceImagesWithPlaceholders(document, rootNode) {
    for (const image of Array.from(rootNode.querySelectorAll("img"))) {
      const placeholder = document.createElement("div");
      placeholder.className = "sc-share-card-image-placeholder";
      const alt = normalizeText(image.getAttribute("alt"));
      const src = normalizeText(image.getAttribute("src"));
      placeholder.textContent = alt ? `回复里有图片：${alt}` : "回复里有图片";
      if (src && /^https?:\/\//.test(src)) {
        const link = document.createElement("div");
        link.className = "sc-share-card-image-url";
        link.textContent = src;
        placeholder.appendChild(link);
      }
      image.replaceWith(placeholder);
    }
  }

  function findReplyContentRoot(replyElement) {
    for (const selector of CONTENT_SELECTORS) {
      const content = replyElement.querySelector(selector);
      if (content) return content;
    }
    return replyElement;
  }

  function cloneReplyContent(document, replyElement) {
    const clone = findReplyContentRoot(replyElement).cloneNode(true);

    removeUnwantedNodes(clone);
    replaceImagesWithPlaceholders(document, clone);

    for (const link of clone.querySelectorAll("a")) {
      link.removeAttribute("onclick");
      link.setAttribute("target", "_blank");
      link.setAttribute("rel", "noreferrer");
    }

    if (!normalizeText(clone.textContent)) {
      const fallback = document.createElement("p");
      fallback.textContent = normalizeText(replyElement.textContent);
      return fallback;
    }

    return clone;
  }

  function appendText(document, parent, className, text) {
    const element = document.createElement("div");
    element.className = className;
    element.textContent = text;
    parent.appendChild(element);
    return element;
  }

  function buildShareCard(document, replyElement, topicInfo) {
    const author = getAuthorInfo(replyElement);
    const card = document.createElement("article");
    card.className = "sc-share-card";

    const header = document.createElement("div");
    header.className = "sc-share-card-header";

    const meta = document.createElement("div");
    appendText(document, meta, "sc-share-card-label", "豆瓣小组回应");
    appendText(document, meta, "sc-share-card-author", author.name);
    if (author.time) {
      appendText(document, meta, "sc-share-card-time", author.time);
    }
    header.appendChild(meta);
    card.appendChild(header);

    const content = document.createElement("div");
    content.className = "sc-share-card-content";
    content.appendChild(cloneReplyContent(document, replyElement));
    card.appendChild(content);

    const source = document.createElement("div");
    source.className = "sc-share-card-source";
    appendText(document, source, "sc-share-card-topic", topicInfo.title);
    appendText(document, source, "sc-share-card-url", topicInfo.url);
    card.appendChild(source);

    return card;
  }

  function escapeMarkdownText(value) {
    return String(value || "")
      .replace(/\\/g, "\\\\")
      .replace(/([`*_{}\[\]<>#])/g, "\\$1");
  }

  function escapeMarkdownUrl(value) {
    return String(value || "").replace(/\s+/g, "%20").replace(/\)/g, "%29");
  }

  function normalizeMarkdownLine(value) {
    return String(value || "")
      .replace(/[ \t]+/g, " ")
      .replace(/ *\n */g, "\n")
      .trim();
  }

  function childInlineMarkdown(node) {
    return normalizeMarkdownLine(Array.from(node.childNodes).map(inlineMarkdown).join(""));
  }

  function imagePlaceholderMarkdown(node) {
    const textNode = Array.from(node.childNodes).find((child) => child.nodeType === 3);
    const label = normalizeMarkdownLine(textNode && textNode.textContent);
    const urlNode = node.querySelector(".sc-share-card-image-url");
    const url = normalizeMarkdownLine(urlNode && urlNode.textContent);
    return [label, url].filter(Boolean).join("\n");
  }

  function inlineMarkdown(node) {
    if (!node) return "";
    if (node.nodeType === 3) return escapeMarkdownText(String(node.textContent || "").replace(/\s+/g, " "));
    if (node.nodeType !== 1) return "";

    const tagName = node.tagName.toLowerCase();
    if (tagName === "br") return "\n";
    if (tagName === "strong" || tagName === "b") return `**${childInlineMarkdown(node)}**`;
    if (tagName === "em" || tagName === "i") return `*${childInlineMarkdown(node)}*`;
    if (tagName === "code") return `\`${String(node.textContent || "").replace(/`/g, "\\`")}\``;
    if (tagName === "a") {
      const text = childInlineMarkdown(node) || escapeMarkdownText(node.href || node.getAttribute("href") || "");
      const href = normalizeText(node.href || node.getAttribute("href"));
      return href ? `[${text}](${escapeMarkdownUrl(href)})` : text;
    }
    return Array.from(node.childNodes).map(inlineMarkdown).join("");
  }

  function listItemMarkdown(item) {
    const inlineParts = [];
    const nestedLists = [];

    for (const child of item.childNodes) {
      if (child.nodeType === 1 && ["ul", "ol"].includes(child.tagName.toLowerCase())) {
        nestedLists.push(blockMarkdown(child).split("\n").map((line) => `  ${line}`).join("\n"));
      } else {
        inlineParts.push(inlineMarkdown(child));
      }
    }

    return [normalizeMarkdownLine(inlineParts.join("")), ...nestedLists].filter(Boolean).join("\n");
  }

  function tableCellMarkdown(cell) {
    return normalizeMarkdownLine(childBlockMarkdown(cell) || childInlineMarkdown(cell))
      .replace(/\n+/g, "<br>")
      .replace(/\|/g, "\\|");
  }

  function markdownTableRow(cells, columnCount) {
    const normalizedCells = cells.slice(0, columnCount);
    while (normalizedCells.length < columnCount) normalizedCells.push("");
    return `| ${normalizedCells.join(" | ")} |`;
  }

  function tableMarkdown(table) {
    const rows = Array.from(table.querySelectorAll("tr"))
      .map((row) => ({
        cells: Array.from(row.children)
          .filter((cell) => ["td", "th"].includes(cell.tagName.toLowerCase()))
          .map(tableCellMarkdown),
      }))
      .filter((row) => row.cells.length > 0);

    if (!rows.length) return "";

    const columnCount = Math.max(...rows.map((row) => row.cells.length));
    const [header, ...bodyRows] = rows;
    const separator = Array.from({ length: columnCount }, () => "---");

    return [
      markdownTableRow(header.cells, columnCount),
      markdownTableRow(separator, columnCount),
      ...bodyRows.map((row) => markdownTableRow(row.cells, columnCount)),
    ].join("\n");
  }

  function childBlockMarkdown(node) {
    return Array.from(node.childNodes)
      .map(blockMarkdown)
      .map((text) => text.trim())
      .filter(Boolean)
      .join("\n\n");
  }

  function blockMarkdown(node) {
    if (!node) return "";
    if (node.nodeType === 3) return normalizeMarkdownLine(escapeMarkdownText(node.textContent));
    if (node.nodeType !== 1) return "";

    const tagName = node.tagName.toLowerCase();
    if (["a", "strong", "b", "em", "i", "code", "span"].includes(tagName)) return inlineMarkdown(node);
    if (tagName === "table") return tableMarkdown(node);
    if (node.classList && node.classList.contains("sc-share-card-image-placeholder")) {
      return imagePlaceholderMarkdown(node);
    }
    if (tagName === "p") return childInlineMarkdown(node);
    if (tagName === "br") return "";
    if (tagName === "ul") {
      return Array.from(node.children)
        .filter((child) => child.tagName.toLowerCase() === "li")
        .map((child) => `- ${listItemMarkdown(child)}`)
        .join("\n");
    }
    if (tagName === "ol") {
      return Array.from(node.children)
        .filter((child) => child.tagName.toLowerCase() === "li")
        .map((child, index) => `${index + 1}. ${listItemMarkdown(child)}`)
        .join("\n");
    }
    if (tagName === "li") return `- ${listItemMarkdown(node)}`;
    if (tagName === "blockquote") {
      return childBlockMarkdown(node)
        .split("\n")
        .map((line) => `> ${line}`)
        .join("\n");
    }
    if (tagName === "pre") return `\`\`\`\n${String(node.textContent || "").trim()}\n\`\`\``;
    if (/^h[1-6]$/.test(tagName)) {
      return `${"#".repeat(Number(tagName.slice(1)))} ${childInlineMarkdown(node)}`;
    }

    return childBlockMarkdown(node) || childInlineMarkdown(node);
  }

  function buildReplyMarkdown(document, replyElement) {
    const content = cloneReplyContent(document, replyElement);
    return blockMarkdown(content) || normalizeText(replyElement.textContent);
  }

  function getGmApi(runtimeRoot) {
    return (runtimeRoot && runtimeRoot.GM) || {};
  }

  function ensureStyle(document, runtimeRoot) {
    if (document.getElementById(STYLE_ID)) return;

    if (runtimeRoot && typeof runtimeRoot.GM_addStyle === "function") {
      runtimeRoot.GM_addStyle(STYLE_TEXT);
      const marker = document.createElement("meta");
      marker.id = STYLE_ID;
      marker.setAttribute("name", STYLE_ID);
      document.head.appendChild(marker);
      return;
    }

    const gm = getGmApi(runtimeRoot);
    if (gm && typeof gm.addStyle === "function") {
      gm.addStyle(STYLE_TEXT);
      const marker = document.createElement("meta");
      marker.id = STYLE_ID;
      marker.setAttribute("name", STYLE_ID);
      document.head.appendChild(marker);
      return;
    }

    const style = document.createElement("style");
    style.id = STYLE_ID;
    style.textContent = STYLE_TEXT;
    document.head.appendChild(style);
  }

  function getStage(document) {
    let stage = document.getElementById(STAGE_ID);
    if (!stage) {
      stage = document.createElement("div");
      stage.id = STAGE_ID;
      document.body.appendChild(stage);
    }
    return stage;
  }

  function waitForImages(container) {
    const images = Array.from(container.querySelectorAll("img"));
    return Promise.all(
      images.map((image) => {
        if (image.complete) return Promise.resolve();
        return new Promise((resolve) => {
          image.addEventListener("load", resolve, { once: true });
          image.addEventListener("error", resolve, { once: true });
        });
      }),
    );
  }

  async function renderReplyToBlob(runtimeRoot, replyElement) {
    const document = replyElement.ownerDocument;
    ensureStyle(document, runtimeRoot);

    if (!runtimeRoot.htmlToImage || typeof runtimeRoot.htmlToImage.toBlob !== "function") {
      throw new Error("html-to-image 没有加载成功，请刷新页面后重试。");
    }

    const topicInfo = getTopicInfo(document, runtimeRoot.location);
    const card = buildShareCard(document, replyElement, topicInfo);
    const stage = getStage(document);
    stage.replaceChildren(card);

    await waitForImages(card);

    const blob = await runtimeRoot.htmlToImage.toBlob(card, {
      backgroundColor: "#ffffff",
      cacheBust: true,
      fontEmbedCSS: "",
      pixelRatio: 2,
      skipFonts: true,
    });

    if (!blob) {
      throw new Error("没有生成图片数据，请换一条回复或刷新页面后重试。");
    }

    stage.replaceChildren();
    return blob;
  }

  function blobToDataUrl(runtimeRoot, blob) {
    return new Promise((resolve, reject) => {
      const reader = new runtimeRoot.FileReader();
      reader.addEventListener("load", () => resolve(String(reader.result || "")));
      reader.addEventListener("error", () => reject(reader.error || new Error("读取图片失败。")));
      reader.readAsDataURL(blob);
    });
  }

  async function copyBlobToClipboard(runtimeRoot, blob) {
    if (
      runtimeRoot.navigator &&
      runtimeRoot.navigator.clipboard &&
      typeof runtimeRoot.navigator.clipboard.write === "function" &&
      typeof runtimeRoot.ClipboardItem === "function"
    ) {
      await runtimeRoot.navigator.clipboard.write([new runtimeRoot.ClipboardItem({ [blob.type]: blob })]);
      return "图片已复制，可以去广播发布框粘贴。";
    }

    if (typeof runtimeRoot.GM_setClipboard === "function") {
      const dataUrl = await blobToDataUrl(runtimeRoot, blob);
      runtimeRoot.GM_setClipboard(dataUrl, "text");
      return "当前浏览器不支持直接复制图片，已复制图片 data URL。";
    }

    const gm = getGmApi(runtimeRoot);
    if (gm && typeof gm.setClipboard === "function") {
      const dataUrl = await blobToDataUrl(runtimeRoot, blob);
      await gm.setClipboard(dataUrl, "text");
      return "当前浏览器不支持直接复制图片，已复制图片 data URL。";
    }

    throw new Error("当前浏览器不支持复制图片，请使用下载按钮保存 PNG。");
  }

  async function copyReplyMarkdown(runtimeRoot, replyElement) {
    const document = replyElement.ownerDocument;
    const markdown = buildReplyMarkdown(document, replyElement);

    if (
      runtimeRoot.navigator &&
      runtimeRoot.navigator.clipboard &&
      typeof runtimeRoot.navigator.clipboard.writeText === "function"
    ) {
      await runtimeRoot.navigator.clipboard.writeText(markdown);
      return "已复制 Markdown。";
    }

    if (typeof runtimeRoot.GM_setClipboard === "function") {
      runtimeRoot.GM_setClipboard(markdown, "text");
      return "已复制 Markdown。";
    }

    const gm = getGmApi(runtimeRoot);
    if (gm && typeof gm.setClipboard === "function") {
      await gm.setClipboard(markdown, "text");
      return "已复制 Markdown。";
    }

    throw new Error("当前浏览器不支持剪贴板写入。");
  }

  function sanitizeFilename(value) {
    const filename = normalizeText(value).replace(/[\\/:*?"<>|]+/g, "-").slice(0, 80);
    return filename || "douban-reply";
  }

  function downloadBlob(runtimeRoot, blob, filename) {
    const url = runtimeRoot.URL.createObjectURL(blob);

    if (typeof runtimeRoot.GM_download === "function") {
      runtimeRoot.GM_download({
        url,
        name: filename,
        saveAs: true,
        onerror: () => triggerAnchorDownload(runtimeRoot, url, filename),
        onload: () => runtimeRoot.setTimeout(() => runtimeRoot.URL.revokeObjectURL(url), 30000),
      });
      return;
    }

    const gm = getGmApi(runtimeRoot);
    if (gm && typeof gm.download === "function") {
      gm.download({ url, name: filename, saveAs: true }).catch(() => {
        triggerAnchorDownload(runtimeRoot, url, filename);
      });
      return;
    }

    triggerAnchorDownload(runtimeRoot, url, filename);
    runtimeRoot.setTimeout(() => runtimeRoot.URL.revokeObjectURL(url), 30000);
  }

  function triggerAnchorDownload(runtimeRoot, url, filename) {
    const anchor = runtimeRoot.document.createElement("a");
    anchor.href = url;
    anchor.download = filename;
    runtimeRoot.document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
  }

  function showToast(runtimeRoot, message) {
    const toast = runtimeRoot.document.createElement("div");
    toast.className = "sc-share-toast";
    toast.textContent = message;
    runtimeRoot.document.body.appendChild(toast);
    runtimeRoot.setTimeout(() => toast.remove(), 2600);
  }

  function notify(runtimeRoot, message) {
    if (typeof runtimeRoot.GM_notification === "function") {
      runtimeRoot.GM_notification({ title: "豆瓣回应分享", text: message, timeout: 2400 });
      return;
    }

    const gm = getGmApi(runtimeRoot);
    if (gm && typeof gm.notification === "function") {
      gm.notification({ title: "豆瓣回应分享", text: message, timeout: 2400 });
      return;
    }

    showToast(runtimeRoot, message);
  }

  function createDialog(runtimeRoot) {
    const document = runtimeRoot.document;
    const overlay = document.createElement("div");
    overlay.className = "sc-share-overlay";
    overlay.innerHTML = `
      <div class="sc-share-dialog" role="dialog" aria-modal="true" aria-label="分享豆瓣回应">
        <h2>分享回应为图片广播</h2>
        <div class="sc-share-body">正在生成图片...</div>
        <div class="sc-share-dialog-actions">
          <button type="button" data-action="close">关闭</button>
        </div>
      </div>
    `;
    overlay.addEventListener("click", (event) => {
      if (event.target === overlay) overlay.remove();
    });
    overlay.querySelector("[data-action='close']").addEventListener("click", () => overlay.remove());
    document.body.appendChild(overlay);
    return overlay;
  }

  function setDialogError(overlay, error) {
    const body = overlay.querySelector(".sc-share-body");
    body.innerHTML = "";
    const errorNode = overlay.ownerDocument.createElement("div");
    errorNode.className = "sc-share-error";
    errorNode.textContent = error && error.message ? error.message : String(error);
    body.appendChild(errorNode);
  }

  async function openShareDialog(runtimeRoot, replyElement) {
    const document = runtimeRoot.document;
    const overlay = createDialog(runtimeRoot);
    const body = overlay.querySelector(".sc-share-body");
    const actions = overlay.querySelector(".sc-share-dialog-actions");

    try {
      const topicInfo = getTopicInfo(document, runtimeRoot.location);
      const blob = await renderReplyToBlob(runtimeRoot, replyElement);
      const imageUrl = runtimeRoot.URL.createObjectURL(blob);
      const filename = `${sanitizeFilename(topicInfo.title)}-reply.png`;

      body.innerHTML = "";
      const preview = document.createElement("div");
      preview.className = "sc-share-preview";
      const image = document.createElement("img");
      image.src = imageUrl;
      image.alt = "生成的回应图片";
      preview.appendChild(image);
      body.appendChild(preview);

      const hint = document.createElement("p");
      hint.className = "sc-share-hint";
      hint.textContent = "复制图片后打开豆瓣首页，在广播发布框粘贴图片，确认后发布。";
      body.appendChild(hint);

      actions.innerHTML = `
        <button type="button" data-action="copy" class="sc-share-primary">复制图片</button>
        <button type="button" data-action="download">下载 PNG</button>
        <button type="button" data-action="broadcast">打开广播页</button>
        <button type="button" data-action="close">关闭</button>
      `;

      actions.querySelector("[data-action='copy']").addEventListener("click", async () => {
        try {
          const message = await copyBlobToClipboard(runtimeRoot, blob);
          notify(runtimeRoot, message);
        } catch (error) {
          setDialogError(overlay, error);
        }
      });

      actions.querySelector("[data-action='download']").addEventListener("click", () => {
        downloadBlob(runtimeRoot, blob, filename);
      });

      actions.querySelector("[data-action='broadcast']").addEventListener("click", () => {
        runtimeRoot.open("https://www.douban.com/", "_blank", "noopener,noreferrer");
      });

      actions.querySelector("[data-action='close']").addEventListener("click", () => {
        runtimeRoot.URL.revokeObjectURL(imageUrl);
        overlay.remove();
      });
    } catch (error) {
      setDialogError(overlay, error);
    }
  }

  function init(runtimeRoot) {
    if (!runtimeRoot || !runtimeRoot.document || !isDoubanGroupTopicUrl(runtimeRoot.location.href)) {
      return false;
    }

    ensureStyle(runtimeRoot.document, runtimeRoot);
    injectShareButtons(runtimeRoot.document, (reply) => openShareDialog(runtimeRoot, reply), runtimeRoot);

    const observer = new runtimeRoot.MutationObserver(() => {
      injectShareButtons(runtimeRoot.document, (reply) => openShareDialog(runtimeRoot, reply), runtimeRoot);
    });
    observer.observe(runtimeRoot.document.body, { childList: true, subtree: true });

    return true;
  }

  return {
    BUTTON_CLASS,
    COPY_BUTTON_CLASS,
    CONTENT_SELECTORS,
    REPLY_SELECTORS,
    buildReplyMarkdown,
    buildShareCard,
    copyReplyMarkdown,
    findReplyItems,
    getTopicInfo,
    injectShareButtons,
    isDoubanGroupTopicUrl,
    normalizeText,
    renderReplyToBlob,
    init,
  };
});
