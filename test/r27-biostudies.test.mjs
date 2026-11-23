// BioStudies 错误页 / 研究详情页下载与共享弹窗 / ORCID 认领（r27）回归：
// 词库结构、错误页整段、下载指令模板、共享与研究页新标签 + jsdom 渲染用例
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { JSDOM } from "jsdom";

const root = path.dirname(fileURLToPath(import.meta.url));
const srcEngine = fs.readFileSync(path.join(root, "../src/engine.js"), "utf8");
const createEngine = new Function(srcEngine + "; return createEngine;")();
const read = (f) => JSON.parse(fs.readFileSync(path.join(root, "../dict", f), "utf8"));

const dict = read("biostudies.json");
const SITE = { scope: "body", block: "pre, code", rescan: false };

function siteData() {
  const books = ["common.json", "string-atlas.json", "string-atlas2.json", "biostudies.json"];
  const exact = {}, rules = [], templates = [];
  for (const f of books) {
    if (!fs.existsSync(path.join(root, "../dict", f))) continue;
    const d = read(f);
    Object.assign(exact, d.exact || {});
    rules.push(...(d.rules || []));
    templates.push(...(d.templates || []));
  }
  return { exact, rules, templates };
}

function boot(html, url) {
  const dom = new JSDOM("<body>" + html + "</body>", {
    url: url || "https://www.ebi.ac.uk/biostudies/bioimages/studies/S-BSST1"
  });
  const engine = createEngine({
    document: dom.window.document,
    window: dom.window,
    data: siteData(),
    site: SITE
  });
  engine.start();
  return { dom, engine, doc: dom.window.document };
}

const NEW_EXACT = {
  "Password": "密码",
  "Error in parsing file list": "解析文件列表出错",
  "File Download": "文件下载",
  "Instruction for:": "操作说明（适用系统）：",
  "Download file list as JSON": "以 JSON 格式下载文件列表",
  "Download file list as XML": "以 XML 格式下载文件列表",
  "Download file list as PageTab": "以 PageTab 格式下载文件列表",
  "Click the button below to download the selected files as a zipped archive.": "点击下方按钮，把所选文件下载为 ZIP 压缩包。",
  "After initiating download, the requested files will be downloaded by Aspera and you can close this page.": "开始下载后，所请求的文件将由 Aspera 传输，您可以关闭此页面。",
  "You can manage downloading files by Aspera's connect management console which is located in taskbar of your operating system.": "您可以通过 Aspera Connect 管理控制台管理正在下载的文件，该控制台位于操作系统任务栏。",
  "Share Study": "共享研究",
  "You can share this study to be accessed without requiring any credentials using the URL below. Please note that all personal information will be visible to the viewer.": "您可以通过下方 URL 共享本研究，访问者无需任何凭据即可打开。请注意，所有个人信息都会对查看者可见。",
  "ORCID: Data claiming": "ORCID：数据认领",
  "sign-in to ORCID": "登录 ORCID",
  "Remember me on this computer": "在此计算机上记住我",
  "(sign out)": "（退出登录）",
  "Volume": "卷",
  "Issue": "期",
  "We’re sorry that the page or file you’ve requested is not present": "很抱歉，您请求的页面或文件不存在",
  "The resource may have been removed, had its name changed, or has restricted access.": "该资源可能已被移除、更名，或访问受限。",
  "It may take up to 24 hours after submission for any new studies to become available in the database.": "新提交的研究最多可能需要 24 小时才会出现在数据库中。",
  "Please login if the study has not been publicly released yet.": "如果该研究尚未公开发布，请先登录。",
  "Oops! Something has gone wrong with BioStudies": "糟糕！BioStudies 出了点问题",
  "The service you are trying to access is currently unavailable. We’re very sorry. Please try again later or use the feedback link to report if the problem persists.": "您尝试访问的服务目前不可用，非常抱歉。请稍后重试；如果问题持续存在，请通过反馈链接报告。",
  "OOPS! Something is wrong!": "糟糕！出错了！",
  "The resource you were looking for is not available now.": "您要查找的资源目前不可用。"
};

test("r27 词库：错误页、下载弹窗、共享与 ORCID 新增条目齐备", () => {
  assert.ok(Object.keys(dict.exact).length >= 258, "exact 条目不足: " + Object.keys(dict.exact).length);
  assert.ok(dict.rules.length >= 24, "rules 不足: " + dict.rules.length);
  assert.ok(dict.templates.length >= 22, "templates 不足: " + dict.templates.length);
  for (const [en, zh] of Object.entries(NEW_EXACT)) {
    assert.equal(dict.exact[en], zh, "词库缺条目或译法不符: " + en);
  }
  const { engine } = boot("");
  for (const [en, zh] of Object.entries(NEW_EXACT)) {
    assert.equal(engine.translateText(en), zh, "translateText 未命中: " + en);
  }
});

test("r27 规则：下载计数、提交提示、作者展开与 ORCID 认领", () => {
  const { engine } = boot("");
  assert.equal(
    engine.translateText("Please select how you want to download your requested 3 files."),
    "请选择如何下载所请求的 3 个文件。"
  );
  assert.equal(
    engine.translateText("Please select how you want to download your requested 1 file."),
    "请选择如何下载所请求的 1 个文件。"
  );
  assert.equal(
    engine.translateText("This is the currently available version of S-BSST1. Any recent updates can take a around 24 hours to appear here."),
    "这是 S-BSST1 当前可用的版本；最近的更新可能需要约 24 小时才会出现在此处。"
  );
  assert.equal(engine.translateText("+ 3 more"), "+ 另有 3 位");
  assert.equal(engine.translateText("Claim S-BSST1 into your ORCID"), "将 S-BSST1 认领到您的 ORCID");
  assert.equal(
    engine.translateText("You have claimed S-BSST1 into your ORCID."),
    "您已将 S-BSST1 认领到您的 ORCID。"
  );
  assert.equal(
    engine.translateText("open ORCID profile: https://orcid.org/0000-0002-1825-0097"),
    "打开 ORCID 主页：https://orcid.org/0000-0002-1825-0097"
  );
});

test("r27 jsdom：404 错误页整段翻译，保留换行与联系链接", () => {
  const { doc } = boot(
    '<section id="error-message">' +
      "<h3>We’re sorry that the page or file you’ve requested is not present</h3>" +
      "<p>The resource may have been removed, had its name changed, or has restricted access. <br> " +
      "It may take up to 24 hours after submission for any new studies to become available in the database. <br> " +
      "Please login if the study has not been publicly released yet.</p>" +
      "<p>If you require further assistance locating missing page or file, please " +
      '<a href="mailto://biostudies@ebi.ac.uk" class="feedback">contact us</a> and we will look into it\n            for you.</p>' +
      "</section>",
    "https://www.ebi.ac.uk/biostudies/arrayexpress/studies/E-GEOD-1"
  );
  const h3 = doc.querySelector("h3");
  assert.equal(h3.textContent, "很抱歉，您请求的页面或文件不存在");
  const p1 = doc.querySelectorAll("p")[0];
  assert.equal(
    p1.textContent,
    "该资源可能已被移除、更名，或访问受限。新提交的研究最多可能需要 24 小时才会出现在数据库中。如果该研究尚未公开发布，请先登录。"
  );
  assert.equal(p1.querySelectorAll("br").length, 2, "两处换行应保留");
  const p2 = doc.querySelectorAll("p")[1];
  assert.equal(p2.textContent, "如果您在查找缺失的页面或文件时需要进一步帮助，请联系我们，我们会为您查看。");
  const link = doc.querySelector("a.feedback");
  assert.equal(link.textContent, "联系我们");
  assert.equal(link.getAttribute("href"), "mailto://biostudies@ebi.ac.uk");
});

test("r27 jsdom：下载弹窗标题、计数说明与 FTP 指令逐行翻译", () => {
  const { doc } = boot(
    '<div class="reveal" id="batchdl-popup">' +
      "<div><p>File Download</p></div>" +
      "<div><p>Please select how you want to download your requested 2 files.</p></div>" +
      '<li class="accordion-item"><a href="#" class="accordion-title">Download as a ZIP file</a>' +
      '<div class="accordion-content">' +
      "<p>Click the button below to download the selected files as a zipped archive. </p>" +
      '</div></li>' +
      "<ol>" +
      "<li>Click the button below to download the script and save it to the folder where you want to download your files e.g. <code>/home/x/dl</code></li>" +
      "<li>Run downloaded script file in cmd with this command: <code>./S-BSST1.sh</code></li>" +
      "<li>Change your console directory to the place that you put downloaded script e.g. <code>cd /tmp</code> .</li>" +
      "</ol></div>"
  );
  const texts = [...doc.querySelectorAll("p")].map((p) => p.textContent.trim());
  assert.deepEqual(texts, [
    "文件下载",
    "请选择如何下载所请求的 2 个文件。",
    "点击下方按钮，把所选文件下载为 ZIP 压缩包。"
  ]);
  const lis = [...doc.querySelectorAll("ol li")].map((li) => li.textContent);
  assert.equal(lis[0], "点击下方按钮下载脚本，并保存到您想存放下载文件的文件夹，例如 /home/x/dl");
  assert.equal(lis[1], "在 cmd 中运行下载的脚本文件，命令为：./S-BSST1.sh");
  assert.equal(lis[2], "把控制台目录切换到下载脚本所在位置，例如 cd /tmp。");
  assert.equal(doc.querySelectorAll("ol code").length, 3, "code 内联元素应保留");
  assert.equal(doc.querySelectorAll("ol code")[0].textContent, "/home/x/dl");
});

test("r27 jsdom：Aspera 指令与 ORCID 认领模板保留链接", () => {
  const { doc } = boot(
    "<ol>" +
      '<li>Download IBM aspera command line interface from <a href="https://www.ibm.com/products/aspera/downloads">https://www.ibm.com/products/aspera/downloads</a> and unzip downloaded file in e.g. <code>/opt/aspera</code></li>' +
      "<li>Edit script <code>S-BSST1-win.bat</code> and change default directory address of <b>asperaweb_id_dsa.openssh</b> with the directory that you have installed your Aspera client e.g. <code>/opt/aspera/cli</code></li>" +
      "<li>Run downloaded script from command line <code>./S-BSST1-win.bat</code></li>" +
      "</ol>" +
      '<div class="orcid-claim">You can <a href="#" class="thor_a_generate_signinLink">sign-in to ORCID</a> to claim your data</div>'
  );
  const lis = [...doc.querySelectorAll("ol li")].map((li) => li.textContent);
  assert.equal(
    lis[0],
    "从 https://www.ibm.com/products/aspera/downloads 下载 IBM Aspera 命令行客户端，并把下载的文件解压到例如 /opt/aspera"
  );
  assert.equal(
    lis[1],
    "编辑脚本 S-BSST1-win.bat，把 asperaweb_id_dsa.openssh 的默认目录地址改为您安装 Aspera 客户端的位置，例如 /opt/aspera/cli"
  );
  assert.equal(lis[2], "在命令行中运行下载的脚本 ./S-BSST1-win.bat");
  assert.equal(doc.querySelector("ol a").getAttribute("href"), "https://www.ibm.com/products/aspera/downloads");
  const claim = doc.querySelector(".orcid-claim");
  assert.equal(claim.textContent, "您可以登录 ORCID来认领您的数据");
  assert.equal(claim.querySelector("a").getAttribute("href"), "#");
});

test("r27 jsdom：共享弹窗、登录占位符与文件列表按钮标题", () => {
  const { doc } = boot(
    '<section id="biostudies-secret"><h2>Share Study</h2>' +
      '<p class="large-centered">You can share this study to be accessed without requiring any credentials using the URL below. Please note that all personal information will be visible to the viewer.</p>' +
      '<a id="copy-secret" class="button small" href="#">Copy to Clipboard</a></section>' +
      '<div class="popup" id="login-form"><input id="pass-field" type="password" placeholder="Password">' +
      "<label>Remember me on this computer</label></div>" +
      '<a href="#" title="Download file list as JSON">{JSON}</a>' +
      '<a href="#" title="Download file list as PageTab">→PageTab</a>' +
      '<div class="callout"><p>OOPS! Something is wrong!</p><p>The resource you were looking for is not available now.</p></div>'
  );
  assert.equal(doc.querySelector("h2").textContent, "共享研究");
  assert.equal(
    doc.querySelector("#biostudies-secret p").textContent,
    "您可以通过下方 URL 共享本研究，访问者无需任何凭据即可打开。请注意，所有个人信息都会对查看者可见。"
  );
  assert.equal(doc.querySelector("#copy-secret").textContent, "复制到剪贴板");
  assert.equal(doc.querySelector("#pass-field").getAttribute("placeholder"), "密码");
  assert.equal(doc.querySelector("label").textContent, "在此计算机上记住我");
  const links = [...doc.querySelectorAll("a[title]")];
  assert.equal(links[0].getAttribute("title"), "以 JSON 格式下载文件列表");
  assert.equal(links[1].getAttribute("title"), "以 PageTab 格式下载文件列表");
  const callout = [...doc.querySelectorAll(".callout p")].map((p) => p.textContent);
  assert.deepEqual(callout, ["糟糕！出错了！", "您要查找的资源目前不可用。"]);
});
