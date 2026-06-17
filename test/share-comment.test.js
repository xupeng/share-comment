const assert = require("node:assert/strict");
const test = require("node:test");
const { JSDOM } = require("jsdom");

const script = require("../share-comment.user.js");

function createTopicDom() {
  return new JSDOM(
    `<!doctype html>
    <html>
      <head><title>测试讨论</title></head>
      <body>
        <div id="content">
          <h1>一个小组讨论标题</h1>
          <ul id="comments" class="topic-reply">
            <li id="comment-101" class="comment-item">
              <div class="pic"><a href="/people/alice/"><img src="https://img1.doubanio.com/icon/u1.jpg" alt="alice"></a></div>
              <div class="reply-doc">
                <h4>
                  <a href="https://www.douban.com/people/alice/">Alice</a>
                  <span class="pubtime">2026-06-17 13:00:00</span>
                </h4>
                <div class="reply-content">
                  <p>这是一条值得分享的回应。</p>
                  <p><strong>给出理由，并接受理由的检验。</strong></p>
                  <ul>
                    <li>说理 ≠ 说服。说服可以用修辞，情感，权威，说理只认论证质量</li>
                    <li>说理 ≠ 解释。解释可以只讲因果，说理必须讲凭什么该信你</li>
                  </ul>
                  <p>这跟你一直看重的那几样东西是一回事。</p>
                  <img src="https://img1.doubanio.com/view/group_topic/l/public/test.jpg" alt="回复图片">
                </div>
                <div class="operation-div">
                  <div class="operation-more"><a href="#">删除</a></div>
                  <a rel="nofollow" href="javascript:void(0);" class="comment-vote lnk-fav lnk-reaction">赞 </a>
                  <a href="https://www.douban.com/group/topic/490000001/?cid=101#last" class="lnk-reply">回复</a>
                </div>
              </div>
            </li>
            <li id="comment-102" class="comment-item">
              <div class="reply-doc">
                <h4><a href="https://www.douban.com/people/bob/">Bob</a></h4>
                <p class="reply-content">另一条回应。</p>
              </div>
            </li>
          </ul>
        </div>
      </body>
    </html>`,
    { url: "https://www.douban.com/group/topic/490000001/?start=100#comments" },
  );
}

test("recognizes Douban group topic URLs only", () => {
  assert.equal(script.isDoubanGroupTopicUrl("https://www.douban.com/group/topic/490000001/"), true);
  assert.equal(script.isDoubanGroupTopicUrl("https://www.douban.com/group/topic/490000001/?start=100"), true);
  assert.equal(script.isDoubanGroupTopicUrl("https://m.douban.com/group/topic/490000001/"), true);
  assert.equal(script.isDoubanGroupTopicUrl("https://www.douban.com/group/blabla/"), false);
});

test("extracts stable topic info from a topic page", () => {
  const dom = createTopicDom();

  const topicInfo = script.getTopicInfo(dom.window.document, dom.window.location);

  assert.deepEqual(topicInfo, {
    title: "一个小组讨论标题",
    url: "https://www.douban.com/group/topic/490000001/",
  });
});

test("finds reply items and injects one share button per reply", () => {
  const dom = createTopicDom();
  const document = dom.window.document;

  const replies = script.findReplyItems(document);
  assert.equal(replies.length, 2);

  const firstCount = script.injectShareButtons(document, () => {});
  const secondCount = script.injectShareButtons(document, () => {});

  assert.equal(firstCount, 2);
  assert.equal(secondCount, 0);
  assert.equal(document.querySelectorAll(".sc-share-reply-button").length, 2);
  assert.equal(document.querySelector("#comment-101 .sc-share-reply-button").textContent, "分享为图片");
});

test("places the share button after the operation row in the reply body", () => {
  const dom = createTopicDom();
  const document = dom.window.document;

  script.init(dom.window);

  const operation = document.querySelector("#comment-101 .operation-div");
  const replyDoc = document.querySelector("#comment-101 .reply-doc");
  const directChildren = Array.from(replyDoc.children);
  const styleText = document.querySelector("#sc-share-comment-style").textContent;

  assert.equal(operation.querySelector(".sc-share-reply-button"), null);
  assert.equal(directChildren.at(-1).className, "sc-share-reply-button");
  assert.equal(directChildren.at(-1).textContent, "分享为图片");
  assert.match(styleText, /\.sc-share-reply-button \{[\s\S]*color: #337a2c;/);
  assert.match(styleText, /\.sc-share-reply-button \{[\s\S]*background: transparent;/);
  assert.match(styleText, /\.sc-share-reply-button \{[\s\S]*border: 0;/);
});

test("builds a clean share card with author, content, topic title, and source URL", () => {
  const dom = createTopicDom();
  const document = dom.window.document;
  const reply = document.querySelector("#comment-101");
  const topicInfo = script.getTopicInfo(document, dom.window.location);

  const card = script.buildShareCard(document, reply, topicInfo);

  assert.match(card.textContent, /Alice/);
  assert.match(card.textContent, /这是一条值得分享的回应。/);
  assert.equal((card.textContent.match(/给出理由，并接受理由的检验。/g) || []).length, 1);
  assert.equal((card.textContent.match(/说理 ≠ 说服/g) || []).length, 1);
  assert.equal((card.textContent.match(/这跟你一直看重的那几样东西是一回事。/g) || []).length, 1);
  assert.match(card.textContent, /一个小组讨论标题/);
  assert.match(card.textContent, /douban.com\/group\/topic\/490000001/);
  assert.equal(card.querySelectorAll(".sc-share-reply-button").length, 0);
});

test("builds a self-contained share card without remote images", () => {
  const dom = createTopicDom();
  const document = dom.window.document;
  const reply = document.querySelector("#comment-101");
  const topicInfo = script.getTopicInfo(document, dom.window.location);

  const card = script.buildShareCard(document, reply, topicInfo);

  assert.equal(card.querySelectorAll("img").length, 0);
  assert.match(card.textContent, /回复里有图片/);
});

test("renders one reply card to a PNG blob through html-to-image", async () => {
  const dom = createTopicDom();
  const document = dom.window.document;
  const reply = document.querySelector("#comment-102");
  const expectedBlob = new dom.window.Blob(["png"], { type: "image/png" });
  const calls = [];

  dom.window.htmlToImage = {
    toBlob: async (node, options) => {
      calls.push({ node, options });
      assert.match(node.textContent, /Bob/);
      assert.match(node.textContent, /另一条回应。/);
      return expectedBlob;
    },
  };

  const blob = await script.renderReplyToBlob(dom.window, reply);

  assert.equal(blob, expectedBlob);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].options.backgroundColor, "#ffffff");
  assert.equal(calls[0].options.fontEmbedCSS, "");
  assert.equal(calls[0].options.pixelRatio, 2);
  assert.match(document.querySelector("#sc-share-comment-style").textContent, /\.sc-share-card \{[\s\S]*width: 390px;/);
  assert.match(document.querySelector("#sc-share-comment-style").textContent, /#sc-share-comment-stage \{[\s\S]*width: 390px;/);
  assert.equal(document.querySelector("#sc-share-comment-stage").childElementCount, 0);
});
