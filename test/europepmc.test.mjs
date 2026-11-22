// Europe PMC 词库（europepmc）回归：顶栏 / 检索过滤 / 结果条目 / 文章页 / 登录 / 导出对话框 / 模板
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { JSDOM } from "jsdom";

const root = path.dirname(fileURLToPath(import.meta.url));
const srcEngine = fs.readFileSync(path.join(root, "../src/engine.js"), "utf8");
const createEngine = new Function(srcEngine + "; return createEngine;")();
const book = JSON.parse(fs.readFileSync(path.join(root, "../dict/europepmc.json"), "utf8"));

// 站点条目以 config/sites.json 为准（里面有 europepmc 就用它，没有就用这里约定的同款配置），
// 只额外补上本册必须的站点选项 attrs:["value"]，其余选项与条目本身保持一致。
const projectedSite = {
  id: "europepmc",
  name: "Europe PMC",
  hosts: ["europepmc.org", "www.europepmc.org"],
  dicts: ["common", "europepmc"],
  scope: "body",
  attrs: ["value"],
  spa: true,
  waitFor: "#home-page, .search-results, .search-filters, .article-menu, .epmc_pageHolder, #data-protection-banner-left",
  proseExempt: "#data-protection-banner-left, .partnership-and-funding, .feature p"
};
const sites = JSON.parse(fs.readFileSync(path.join(root, "../config/sites.json"), "utf8")).sites;
const configSite = sites.find((s) => s.id === "europepmc");
// attrs:["value"] 是硬性要求：引擎默认只翻 placeholder/title/aria-label/alt，input 按钮的 value
// （cookie 条「I agree, dismiss this banner」、导出面板的「Download」）不列进来就永远留英文。
// spa+waitFor / proseExempt 是加固项：等 Vue 晚挂载的头部与 cookie 条，并放行两处固定长句。
const site = Object.assign({}, configSite || projectedSite, {
  id: "europepmc",
  dicts: (configSite && configSite.dicts && configSite.dicts.length) ? configSite.dicts : ["common", "europepmc"],
  scope: (configSite && configSite.scope) || "body",
  attrs: ["value"],
  spa: true,
  waitFor: "#home-page, .search-results, .search-filters, .article-menu, .epmc_pageHolder, #data-protection-banner-left",
  proseExempt: "#data-protection-banner-left, .partnership-and-funding, .feature p"
});
const dictIds = Array.isArray(site.dicts) && site.dicts.length ? site.dicts : ["common", "europepmc"];

const data = { exact: {}, rules: [], templates: [] };
for (const id of dictIds) {
  const b = JSON.parse(fs.readFileSync(path.join(root, "../dict", id + ".json"), "utf8"));
  Object.assign(data.exact, b.exact || {});
  data.rules = data.rules.concat(b.rules || []);
  data.templates = data.templates.concat(b.templates || []);
}

function run(html) {
  const dom = new JSDOM("<body>" + html + "</body>");
  const engine = createEngine({ document: dom.window.document, window: dom.window, data, site });
  engine.start();
  return dom.window.document;
}
function plain(doc) {
  return doc.body.textContent.replace(/\s+/g, " ").trim();
}
function raw(html) {
  return new JSDOM("<body>" + html + "</body>").window.document;
}
// 真实页面快照（2026-11-22 取自 europepmc.org，已清掉 data-v-* 与 base64 图片）
const F = {
  "nav": "<ul class=\"dropdown\">\n<li>\n<a href=\"./About\" onclick=\"return navDrop(this);\">\n<span>About</span>\n</a>\n<ul class=\"sub_menu\">\n<li class=\"citation_navigation_unselected\">\n<a href=\"./About\">\n<span>About Europe PMC</span>\n</a>\n</li><li class=\"citation_navigation_unselected\">\n<a href=\"./Preprints\">\n<span>Preprints in Europe PMC</span>\n</a>\n</li><li class=\"citation_navigation_unselected\">\n<a href=\"./governanceAndFunding\">\n<span>Governance &amp; funding</span>\n</a>\n</li><li class=\"citation_navigation_unselected\">\n<a href=\"./Roadmap\">\n<span>Mission &amp; roadmap</span>\n</a>\n</li><li class=\"citation_navigation_unselected\">\n<a href=\"./Outreach\">\n<span>Outreach</span>\n</a>\n</li>\n</ul>\n</li><li>\n<a href=\"./tools\" onclick=\"return navDrop(this);\">\n<span>Tools</span>\n</a>\n<ul class=\"sub_menu\">\n<li class=\"citation_navigation_unselected\">\n<a href=\"./tools\">\n<span>Tools overview</span>\n</a>\n</li><li class=\"citation_navigation_unselected\">\n<a href=\"./ArticleStatusMonitor\">\n<span>Article status monitor</span>\n</a>\n</li><li class=\"citation_navigation_unselected\">\n<a href=\"./orcid/import\">\n<span>ORCID article claiming</span>\n</a>\n</li><li class=\"citation_navigation_unselected\">\n<a href=\"./grantfinder\">\n<span>Grant finder</span>\n</a>\n</li><li class=\"citation_navigation_unselected\">\n<a href=\"./LabsLink\">\n<span>External links service</span>\n</a>\n</li><li class=\"citation_navigation_unselected\">\n<a href=\"./RssFeeds\">\n<span>RSS feeds</span>\n</a>\n</li><li class=\"citation_navigation_unselected\">\n<a href=\"./Annotations\">\n<span>About SciLite annotations</span>\n</a>\n</li><li class=\"citation_navigation_unselected\">\n<a href=\"./AnnotationsSubmission\">\n<span>Annotations submission service</span>\n</a>\n</li>\n</ul>\n</li><li>\n<a href=\"./developers\" onclick=\"return navDrop(this);\">\n<span>Developers</span>\n</a>\n<ul class=\"sub_menu\">\n<li class=\"citation_navigation_unselected\">\n<a href=\"./developers\">\n<span>Developer resources</span>\n</a>\n</li><li class=\"citation_navigation_unselected\">\n<a href=\"./RestfulWebService\">\n<span>Articles RESTful API</span>\n</a>\n</li><li class=\"citation_navigation_unselected\">\n<a href=\"./GristAPI\">\n<span>Grants RESTful API</span>\n</a>\n</li><li class=\"citation_navigation_unselected\">\n<a href=\"./API-case-studies\">\n<span>API case studies</span>\n</a>\n</li><li class=\"citation_navigation_unselected\">\n<a href=\"./SoapWebServices\">\n<span>SOAP web service</span>\n</a>\n</li><li class=\"citation_navigation_unselected\">\n<a href=\"./AnnotationsApi\">\n<span>Annotations API</span>\n</a>\n</li><li class=\"citation_navigation_unselected\">\n<a href=\"./OaiService\">\n<span>OAI service</span>\n</a>\n</li><li class=\"citation_navigation_unselected\">\n<a href=\"./downloads\">\n<span>Bulk downloads</span>\n</a>\n</li><li class=\"citation_navigation_unselected\">\n<a href=\"https://groups.google.com/a/ebi.ac.uk/forum/#!forum/epmc-webservices\">\n<span>Developers Forum</span>\n</a>\n</li>\n</ul>\n</li><li>\n<a href=\"./userGuide\" onclick=\"return navDrop(this);\">\n<span>Support</span>\n</a>\n<ul class=\"sub_menu\">\n<li class=\"citation_navigation_unselected\">\n<a href=\"./userGuide\">\n<span>User guide</span>\n</a>\n</li><li class=\"citation_navigation_unselected\">\n<a href=\"./searchSyntaxGuide\">\n<span>Search syntax guide</span>\n</a>\n</li><li class=\"citation_navigation_unselected\">\n<a href=\"./ContactUs\">\n<span>Contact us</span>\n</a>\n</li>\n</ul>\n</li><li class=\"contact-us\">\n<a href=\"/ContactUs\" onclick=\"return navDrop(this);\">\n<span>Contact us</span>\n</a>\n<ul class=\"sub_menu\">\n<li>\n<a href=\"/ContactUs\">\n<span>Helpdesk</span>\n</a>\n</li>\n<li>\n<a href=\"/feedback?url=\" onclick=\"var w = window.open('/feedback?url='+getReferredUrl(), 'ukpmc_feedback', 'scrollbars=no,location=no,menuBar=yes,resizable=yes,status=no,toolbar=yes,width=1050,height=810'); try {if (w.blur) w.focus();}catch(ignore){}; return false;\"><span>Feedback</span></a>\n</li>\n<li>\n<a href=\"https://twitter.com/EuropePMC_news\">\n<span>Twitter</span>\n</a>\n</li>\n<li>\n<a href=\"http://blog.europepmc.org\">\n<span>Blog</span>\n</a>\n</li>\n<li>\n<a href=\"//europepmc.github.io/techblog/\">\n<span>Tech blog</span>\n</a>\n</li>\n<li>\n<a href=\"//groups.google.com/a/ebi.ac.uk/forum/#!forum/epmc-webservices\">\n<span>Developer Forum</span>\n</a>\n</li>\n</ul>\n</li><li class=\"last\">\n<a href=\"https://plus.europepmc.org/\" target=\"epmcplus\" onmouseover=\"TipAllowed('Submit your manuscripts, manage your grants and publish your research impact using &lt;b&gt;Europe PMC plus&lt;/b&gt;')\" onmouseout=\"UnTipAllowed()\">\n<span>Europe PMC plus</span>\n</a>\n</li>\n</ul>",
  "featuresIntro": "<p>\n              Intuitive and powerful search tools, linked resources and author\n              services help you stay on top of the cutting edge of science. To\n              learn more, see\n              <a href=\"/About#why-use-europe-pmc\">Why use Europe PMC</a>.\n            </p>",
  "cookie": "<div id=\"data-protection-banner-left\">\n        This website requires cookies, and the limited processing of your\n        personal data in order to function. By using the site you are agreeing\n        to this as outlined in our\n        <a href=\"/PrivacyNotice\">privacy notice and cookie policy</a>.\n      </div>",
  "footer": "<p>\n        Europe PMC is developed by\n        <a href=\"https://www.ebi.ac.uk/\">EMBL-EBI</a> with support from the\n        <a href=\"https://europepmc.org/Funders/\">Europe PMC Funders' Group</a>, in collaboration with the\n        <a href=\"https://www.nlm.nih.gov/\">National Library of Medicine (NLM)</a>, as part of the\n        <a href=\"https://www.ncbi.nlm.nih.gov/pmc/about/pmci/\">PubMed Central International</a>\n        archive network.\n      </p>",
  "facets": "<fieldset style=\"\"><legend><div id=\"search-results--filter--subSection-Free-full-text-access\" class=\"h4\" style=\"margin: auto;\">\n          Free access\n          <span><span tabindex=\"0\" style=\"display: none;\"><div class=\"popper light\" style=\"width: 340px; max-width: 340px; margin: 0px 0px 0px 12px;\"><!----><div class=\"content small\">\n            Free access articles accessible in, or from Europe PMC may be filtered by:\n            <ol><li><b>Full text: In Europe PMC:</b> All articles that are freely\n                available to read within Europe PMC. To filter for open access\n                license types, see\n                <a href=\"/advancesearch\">Advanced search</a>.\n              </li><li><b>Full text: Unpaywall link:</b> All articles with a known\n                link to a free and legal copy of the full text, but that are\n                not available to read within Europe PMC. These links are\n                usually provided by\n                <a href=\"https://unpaywall.org/\">Unpaywall</a></li></ol></div></div></span><span class=\"\"><i class=\"far fa-question-circle\"></i></span></span></div></legend><!----><ul><li class=\"\"><input id=\"search-results--filter--fulltext\" name=\"Free full text access\" type=\"checkbox\" value=\"0\"><label for=\"search-results--filter--fulltext\" class=\"\" style=\"padding-left: 0.5rem;\">Full text: In Europe PMC\n            <span class=\"extra-small\">(3,309,824)</span></label></li><li class=\"\"><input id=\"search-results--filter--link-to-free-full-text\" name=\"Free full text access\" type=\"checkbox\" value=\"1\"><label for=\"search-results--filter--link-to-free-full-text\" class=\"\" style=\"padding-left: 0.5rem;\">Full text: Unpaywall link\n            <span class=\"extra-small\">(556,893)</span></label></li></ul><hr style=\"margin-top: 16px;\"></fieldset>\n<fieldset style=\"\"><legend><div id=\"search-results--filter--subSection-Type\" class=\"h4\" style=\"margin: auto;\">\n          Type\n          <span><span tabindex=\"0\" style=\"display: none;\"><div class=\"popper light\" style=\"width: 340px; max-width: 340px; margin: 0px 0px 0px 12px;\"><!----><div class=\"content small\">\n            To limit your search to specific article types, select one or more of the filters below:\n            <ol><li><b>Research articles:</b> articles presenting the results of\n                experimental research.\n              </li><li><b>Reviews:</b> reviews on a topic covering a broad set of\n                previously published articles.\n              </li><li><b>Preprints:</b> research articles that have not yet\n                undergone formal peer-review and have been submitted to public\n                preprint servers.\n                <ol style=\"list-style-type: disc;\"><li><b>Reviewed:</b> preprints that have reviews,\n                    recommendations or commentary from expert sources.\n                  </li><li><b>Journal published:</b> journal published articles that\n                    have been connected to their previously posted preprints.\n                  </li></ol></li><li><b>Books &amp; documents:</b> The NCBI bookshelf's collection of\n                books, reports, and databases, etc., in the areas of biology,\n                medicine, and the life sciences.\n              </li></ol></div></div></span><span class=\"\"><i class=\"far fa-question-circle\"></i></span></span></div></legend><!----><ul><li class=\"\"><input id=\"search-results--filter--research-articles\" name=\"Type\" type=\"checkbox\" value=\"0\"><label for=\"search-results--filter--research-articles\" class=\"\" style=\"padding-left: 0.5rem;\">Research articles\n            <span class=\"extra-small\">(4,557,652)</span></label></li><li class=\"\"><input id=\"search-results--filter--reviews\" name=\"Type\" type=\"checkbox\" value=\"1\"><label for=\"search-results--filter--reviews\" class=\"\" style=\"padding-left: 0.5rem;\">Review articles\n            <span class=\"extra-small\">(893,007)</span></label></li><li class=\"\"><input id=\"search-results--filter--preprints\" name=\"Type\" type=\"checkbox\" value=\"2\"><label for=\"search-results--filter--preprints\" class=\"\" style=\"padding-left: 0.5rem;\">Preprints\n            <span class=\"extra-small\">(112,246)</span></label></li><li class=\"sub-filter\" style=\"display: none;\"><input id=\"search-results--filter--Reviewed\" name=\"Type\" type=\"checkbox\" value=\"3\"><label for=\"search-results--filter--Reviewed\" class=\"\" style=\"padding-left: 0.5rem;\">Reviewed\n            <span class=\"extra-small\">(2,921)</span></label></li><li class=\"sub-filter\" style=\"display: none;\"><input id=\"search-results--filter--journal-published\" name=\"Type\" type=\"checkbox\" value=\"4\"><label for=\"search-results--filter--journal-published\" class=\"\" style=\"padding-left: 0.5rem;\">Journal published\n            <span class=\"extra-small\">(48,166)</span></label></li><li class=\"\"><input id=\"search-results--filter--books-and-documents\" name=\"Type\" type=\"checkbox\" value=\"5\"><label for=\"search-results--filter--books-and-documents\" class=\"\" style=\"padding-left: 0.5rem;\">Books &amp; documents\n            <span class=\"extra-small\">(4,755)</span></label></li></ul><hr style=\"margin-top: 16px;\"></fieldset>\n<fieldset style=\"\"><legend><div id=\"search-results--filter--subSection-Date-published\" class=\"h4\" style=\"margin: auto;\">\n          Date published\n          <!----></div></legend><div class=\"timeline\"><span role=\"button\" tabindex=\"0\" class=\"action small semi-bold\" id=\"reset--timeline\" style=\"display: none;\"><!----><span class=\"action-icon \"></span><span>Reset</span></span><div class=\"chart-box\"><span class=\"expand-icon\"><i class=\"fa fa-expand\"></i></span><div id=\"histogram\" aria-label=\"Date timeline histogram\" style=\"\"><canvas width=\"265\" height=\"132\" style=\"display: block; width: 265px; height: 132px;\" class=\"chartjs-render-monitor\"></canvas></div></div><div class=\"slider\"><div class=\"noUi-target noUi-ltr noUi-horizontal noUi-txt-dir-ltr\"><div class=\"noUi-base\"><div class=\"noUi-connects\"><div class=\"noUi-connect noUi-draggable\" style=\"transform: translate(0%, 0px) scale(1, 1);\"></div></div><div class=\"noUi-origin\" style=\"transform: translate(-100%, 0px); z-index: 5;\"><div class=\"noUi-handle noUi-handle-lower\" data-handle=\"0\" tabindex=\"0\" role=\"slider\" aria-orientation=\"horizontal\" aria-valuemin=\"1781.0\" aria-valuemax=\"2028.0\" aria-valuenow=\"1781.0\" aria-valuetext=\"1781\"><div class=\"noUi-touch-area\"></div><div class=\"noUi-tooltip\">1781</div></div></div><div class=\"noUi-origin\" style=\"transform: translate(0%, 0px); z-index: 4;\"><div class=\"noUi-handle noUi-handle-upper\" data-handle=\"1\" tabindex=\"0\" role=\"slider\" aria-orientation=\"horizontal\" aria-valuemin=\"1781.0\" aria-valuemax=\"2028.0\" aria-valuenow=\"2028.0\" aria-valuetext=\"2028\"><div class=\"noUi-touch-area\"></div><div class=\"noUi-tooltip\">2028</div></div></div></div></div></div></div><ul><li class=\"\"><input id=\"search-results--filter--last-year\" name=\"Date published\" type=\"radio\" value=\"0\"><label for=\"search-results--filter--last-year\" class=\"\" style=\"padding-left: 0.5rem;\">The last year\n            <span class=\"extra-small\">(694,557)</span></label></li><li class=\"\"><input id=\"search-results--filter--last-three-years\" name=\"Date published\" type=\"radio\" value=\"1\"><label for=\"search-results--filter--last-three-years\" class=\"\" style=\"padding-left: 0.5rem;\">The last 3 years\n            <span class=\"extra-small\">(1,377,303)</span></label></li><li class=\"\"><input id=\"search-results--filter--last-five-years\" name=\"Date published\" type=\"radio\" value=\"2\"><label for=\"search-results--filter--last-five-years\" class=\"\" style=\"padding-left: 0.5rem;\">The last 5 years\n            <span class=\"extra-small\">(2,076,821)</span></label></li><li class=\"\"><input id=\"search-results--filter--custom-date-filter\" name=\"Date published\" type=\"radio\" value=\"3\"><label for=\"search-results--filter--custom-date-filter\" class=\"custom-dates\" style=\"padding-left: 0.5rem;\"><label for=\"search-results--filter--dateFrom\" class=\"alt-text\">Start year</label><input id=\"search-results--filter--dateFrom\" type=\"text\" placeholder=\"YYYY\" maxlength=\"4\">\n            to\n            <label for=\"search-results--filter--dateTo\" class=\"alt-text\">End year</label><input id=\"search-results--filter--dateTo\" type=\"text\" placeholder=\"YYYY\" maxlength=\"4\"><span role=\"button\" tabindex=\"0\" class=\"action small semi-bold\" id=\"search-results--filter–searchButton\" style=\"display: none;\"><!----><span class=\"action-icon \"><i class=\"fas fa-search\"></i></span></span><!----></label></li></ul><!----></fieldset>",
  "emptyState": "<div class=\"search-results\"><!----><!----><!----><!----><div><h2 class=\"alt-text\">Search results</h2></div><!----><!----><!----><span class=\"notification small informative\"><i class=\"fas fa-info-circle\"></i>\n          There are no citations matching your query.\n        </span></div>",
  "resultItem": "<li class=\"separated-list-item\"><div class=\"citation\" id=\"search-results--single--block-43064585\"><div style=\"display: flex; justify-content: space-between;\"><div><h3 id=\"citation--article--title-43064585\" class=\"citation-title\"><a href=\"/article/MED/43064585\" class=\"\">Beyond the binary: vaping and the changing face of perioperative pulmonary risk. </a></h3><p class=\"citation-author-list\"><a href=\"/search?query=AUTH%3A%22van%20Meenen%20DMP%22\" class=\"router-link-active\">\n            van Meenen DMP</a>,\n        <a href=\"/search?query=AUTH%3A%22Hemmes%20SNT%22\" class=\"router-link-active\">\n            Hemmes SNT</a>,\n        <a href=\"/search?query=AUTH%3A%22Buiteman-Kruizinga%20LA%22\" class=\"router-link-active\">\n            Buiteman-Kruizinga LA</a>\n        <!---->\n        \n        <!---->\n        \n      </p><p><a href=\"/search?query=JOURNAL%3A%22Br%20J%20Anaesth%22\" class=\"router-link-active\" id=\"citation--publisher--name-43064585\">\n          Br J Anaesth</a>, S0007-0912(26)00612-4,  \n        <span id=\"citation--id--pub-date-43064585\">\n          15 Sep 2028\n        </span></p><div></div><p><!---->\n        Cited by: 0  articles\n\n         | \n        <span id=\"citation--id--pmid-43064585\">PMID: 43064585</span><!----></p><p class=\"citation-labels small\"></p><div style=\"display: flex; gap: 30px;\"><div><span role=\"button\" tabindex=\"0\" class=\"action small semi-bold\"><!----><span class=\"action-icon icon-left\"><i class=\"fa-regular fa-bookmark\"></i></span>Save\n  </span><!----><!----><!----></div><span role=\"button\" tabindex=\"0\" class=\"action small semi-bold\" id=\"search-results--addTo--exportList-43064585\"><!----><span class=\"action-icon icon-left\"><i class=\"fas fa-plus\"></i></span>Add to export list\n                  </span></div><span class=\"labels\"><!----><!----><!----><!----><!----><!----><span class=\"last-slot\"></span></span><p></p></div><div class=\"clearIconContainer\"><!----></div></div></div><hr class=\"\"></li>",
  "exportModal": "<div id=\"export--main--panel\" class=\"export-content\"><h3>1. Select citations for export?</h3><div><span class=\"small semi-bold regular disabled\">\n    Export list (0)\n  </span><span class=\"small semi-bold selected\">\n    Search results (5,665,204)\n  </span></div><div id=\"export-number-input\">\n      Export the first\n      <input type=\"text\">\n      results (up to 10000)\n      <!----></div><h3>2. Select format</h3><div class=\"export-format-buttons\"><div><input id=\"export--text--format-BIBTEXT\" name=\"exportformat\" type=\"radio\" value=\"[object Object]\"><label for=\"export--text--format-BIBTEXT\">BibTex (Mendeley, Papers)</label></div><div><input id=\"export--text--format-RIS\" name=\"exportformat\" type=\"radio\" value=\"[object Object]\"><label for=\"export--text--format-RIS\">RIS (EndNote, Mendeley, Refworks)</label></div><div><input id=\"export--text--format-TEXT_CITATION\" name=\"exportformat\" type=\"radio\" value=\"[object Object]\"><label for=\"export--text--format-TEXT_CITATION\">Text (citation)</label></div><div><input id=\"export--text--format-EUROPEPMC_XML\" name=\"exportformat\" type=\"radio\" value=\"[object Object]\"><label for=\"export--text--format-EUROPEPMC_XML\">XML (abstracts)</label></div><div><input id=\"export--text--format-EUROPEPMC_FULLTEXT_XML\" name=\"exportformat\" type=\"radio\" value=\"[object Object]\"><label for=\"export--text--format-EUROPEPMC_FULLTEXT_XML\">XML (open access full text)</label></div><div><input id=\"export--text--format-CSV\" name=\"exportformat\" type=\"radio\" value=\"[object Object]\"><label for=\"export--text--format-CSV\">Excel, comma separated (CSV)</label></div><div><input id=\"export--text--format-ID_LIST\" name=\"exportformat\" type=\"radio\" value=\"[object Object]\"><label for=\"export--text--format-ID_LIST\">ID list</label></div></div><!----><div><input id=\"export--start--download\" type=\"button\" value=\"Download\" class=\"disabled\"><a id=\"export-link\" href=\"#\" download=\"\" class=\"alt-text\">Export</a></div><!----></div>",
  "articleMenu": "<ul id=\"epmc-menu\" class=\"article-menu\"><li class=\"highlighted \"><a id=\"article--side-menu--item-abstract\" href=\"#abstract\" class=\"abstract\"><span>Abstract\n          <!----></span></a><!----></li><li class=\" \"><a id=\"article--side-menu--item-full-text-links\" href=\"//doi.org/10.1007/s00484-022-02407-x\" class=\"full-text-link\"><span><span tabindex=\"0\" style=\"display: none;\"><div class=\"popper light\" style=\"width: auto; max-width: 340px; margin: 0px 0px 0px 12px;\"><!----><div class=\"content small\">Available from publisher site using DOI. A subscription may be\n          required.</div></div></span><span class=\"\"><span>Full text<i class=\"fas fa-external-link-alt\"></i></span></span></span></a></li><li class=\" \"><a id=\"article--side-menu--item-references\" href=\"#references\" class=\"references\"><span>References\n          <!----></span></a><!----></li><li class=\" data-section\"><a id=\"article--side-menu--item-impact\" href=\"#impact\" class=\"impact\"><span>Citations &amp; impact\n          <!----></span></a><!----></li><li class=\" data-section\"><a id=\"article--side-menu--item-similar-articles\" href=\"#similar-articles\" class=\"similar-articles\"><span>Similar Articles\n          <!----></span></a><!----></li><li class=\" data-section\"><a id=\"article--side-menu--item-funding\" href=\"#funding\" class=\"funding\"><span>Funding\n          <!----></span></a><!----></li></ul>",
  "articleActions": "<ul class=\"separated-list\"><li class=\"separated-list-item\"><div id=\"unsaved_article\"><span role=\"button\" tabindex=\"0\" class=\"action small semi-bold\"><!----><span class=\"action-icon icon-left\"><i class=\"fa-regular fa-bookmark action-bar-icon\"></i></span>\n        Save\n      </span><!----></div><hr class=\"\"></li><li class=\"separated-list-item\"><div id=\"get_citation\"><span role=\"button\" tabindex=\"0\" class=\"action small semi-bold\"><!----><span class=\"action-icon icon-left\"><i class=\"fas fa-quote-left action-bar-icon\"></i></span>\n        Get citation\n      </span><!----></div><hr class=\"\"></li><li class=\"separated-list-item\"><div id=\"claim_article\"><span role=\"button\" tabindex=\"0\" class=\"action small semi-bold\"><!----><span class=\"action-icon icon-left\"><i class=\"fab fa-orcid action-bar-icon\"></i></span>\n        Claim to ORCID\n      </span><!----></div><!----></li></ul>",
  "login": "<div class=\"epmc_pageHolder\">\n\n<div class=\"pageErrorFeedback error_text\" id=\"id18\">\n\n</div>\n<div class=\"epmc_registration_multiline_header\">\n<h2>Sign in</h2>\n</div>\n<div>\n\n\n</div>\n<div id=\"login--signin-area\">\n<div id=\"login--login-area\">\n<p>Sign in with an Europe PMC account</p>\n<form method=\"post\" id=\"login--epmc-login-form\" action=\"./login?12-1.-epmcLoginForm\" onsubmit=\"onEpmcLogin(event)\"><div id=\"login--epmc-login-form_hf_0\" hidden=\"\" class=\"hidden-fields\"></div>\n<div class=\"validation--api-feedback\" id=\"id19\">\n\n</div>\n<div>\n<p><label for=\"login--email\">Email</label></p>\n<div><input class=\"login--input-box\" type=\"text\" id=\"login--email\" name=\"email\" value=\"\"></div>\n<div class=\"validation--error-message\" id=\"email-invalid-message\"></div>\n</div>\n<div>\n<p><label for=\"login--password\">Password</label></p>\n<div><input class=\"login--input-box\" type=\"password\" id=\"login--password\" name=\"password\" value=\"\"></div>\n<div class=\"validation--error-message\" id=\"password-invalid-message\"></div>\n<p><a id=\"login--forgot-password\" class=\"forgottenPassword\" href=\"/accounts/ForgottenPassword\">Forgotten your\npassword?</a></p>\n</div>\n<p id=\"login--epmc-signin-logo\" class=\"login--signin-link\">\n<button id=\"login--epmc-signin-button\" type=\"submit\" class=\"login--signin-button\" title=\"Sign in with your Europe PMC account details. This is not the same as a Europe PMC Plus account.\">\nSign in to Europe PMC\n</button>\n</p>\n<p>New to Europe PMC? <a href=\"/accounts/registration\" id=\"login--create-account\">Create an account</a>.</p>\n</form>\n</div>\n<div id=\"login--vertical-separator\">Or\n<div class=\"vertical-divider\"></div>\n</div>\n<div id=\"login--horizontal-separator\">\n<div></div>\n<span>Or</span>\n<div></div>\n</div>\n<div id=\"login--third-party-area\">\n<p>Sign in with a different account</p>\n<div id=\"id1b\">\n<div>\n\n</div>\n<div class=\"login--signin-link\">\n<button id=\"orcid--signin-button\" class=\"secondary login--signin-button not-active\" href=\"#\">\nSign in with ORCID\n</button>\n</div>\n</div>\n<form id=\"login--twitter-form\" class=\"login--signin-link\" action=\"/signin/twitter\" method=\"POST\">\n<input type=\"hidden\" name=\"force_login\" value=\"false\">\n<button disabled=\"true\" id=\"login--twitter-signin\" class=\"secondary login--signin-button\" onclick=\"submitTwitterForm()\">\nSign in with Twitter\n</button>\n<div style=\"color: #b4b6b8; font-size: 14px;\">Twitter login is not working as expected.</div>\n</form>\n<div class=\"login--signin-link\">\n<button id=\"login--pmc-plus-signin\" class=\"secondary login--signin-button\" onclick=\"signWithPlus()\">\nSign in with PMC Plus\n</button>\n</div>\n</div>\n<div id=\"login--keep-me-signedin\">\n<p>\n<input type=\"checkbox\" name=\"remember_me\" id=\"remember_me\">\n<label for=\"remember_me\">Keep me signed in</label>\n<img alt=\"\" onmouseout=\"UnTipAllowed()\" src=\"/images/qmark.png\" onmouseover=\"TipAllowed('With this box ticked you will stay signed in and can access your Europe PMC account features, until you choose to sign out. If you do not access the site for more than 2 weeks, you will be automatically signed out. If you are accessing this website from a public computer, for example in a library or University, we recommend you untick this box and sign out when you have finished using the site. ');\">\n</p>\n</div>\n</div>\n<script type=\"text/javascript\" src=\".././Scripts/account_epmc_login_validation.js\"></script>\n<script type=\"text/javascript\">\n/*<![CDATA[*/\n\nvar oauthWindow;\nfunction openORCID() {\nif (false) {\nvar oauthWindow = window.open(\"https://sandbox.orcid.org/oauth/authorize?client_id=0000-0002-1223-3173&response_type=code&scope=/authenticate&redirect_uri=http://localhost:8080/accounts/login\", \"_blank\", \"toolbar=yes, scrollbars=yes, width=500, height=600, top=500, left=500\");\n}\nonLogin();\n}\nfunction onEpmcLogin(e) {\nconsole.log(e)\nonLogin();\ne.preventDefault();\n}\nfunction submitTwitterForm() {\nonLogin();\ndocument.getElementById(\"login--twitter-form\").submit();\n}\nfunction signWithPlus() {\nonLogin();\nwindow.location.href = \"/accounts/plus\";\n}\nfunction submitGoogleForm() {\ndocument.getElementById(\"google_form\").submit();\n}\nfunction submitLinkedinForm() {\ndocument.getElementById(\"linkedin_form\").submit();\n}\nfunction onLogin() {\nvar x = document.getElementById(\"remember_me\").checked;\nif (x) {\nvar now = new Date();\nvar time = now.getTime();\nvar expireTime = time + 1000 * 3600 * 24 * 14;\nnow.setTime(expireTime);\n// document.cookie = 'cookie=ok;expires='+now.toGMTString()+';path=/';\n// document.cookie = \"REMEMBER_ME_COOKIE_FLAG=true; expires=Thu, 2 Mar 2034 10:30:00 UTC; path=/\";\ndocument.cookie = 'REMEMBER_ME_COOKIE_FLAG=true;expires=' + now.toGMTString() + ';path=/';\n}\n}\n$(document).ready(function (event) {\n$('#orcid--signin-button').addClass(\"not-active\");\n$('#orcid--signin-button').click(function () {\nonLogin();\n});\n// document.cookie = \"REMEMBER_ME_COOKIE_FLAG=; expires=Thu, 01 Jan 1970 00:00:00 UTC\";\n// document.cookie = 'REMEMBER_ME_COOKIE_FLAG=; expires=Thu, 01 Jan 1970 00:00:01 GMT;';\n// document.cookie = \"REMEMBER_ME_COOKIE_FLAG=true; expires=Thu, 2 Mar 2034 10:30:00 UTC; path=/\";\ndocument.cookie = \"REMEMBER_ME_COOKIE_FLAG=true; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/\";\n});\n\n/*]]>*/\n</script>\n\n</div>",
  "share": "<div id=\"article--social--sharepanel\" class=\"share-panel semi-bold\">\n  Share this article\n  <span tabindex=\"0\" data-link=\"mailto:?subject=Seasonal%20and%20climatic%20factors%20have%20a%20significant%20influence%20on%20fertility%20associated%20sperm%20phenomic%20attributes%20in%20crossbred%20breeding%20bulls%20(Bos%20taurus%E2%80%89%C3%97%E2%80%89Bos%20indicus).&amp;body=https%3A%2F%2Feuropepmc.org%2Farticle%2FMED%2F36400976%0D%0A%0D%0A\" id=\"article--social--shareicon-email\"><i class=\"fas fa-envelope\"><span class=\"alt-text\">Share with email</span></i></span><span tabindex=\"0\" data-link=\"#share-twitter\" id=\"article--social--shareicon-twitter\"><i class=\"fab fa-twitter\"><span class=\"alt-text\">Share with twitter</span></i></span><span tabindex=\"0\" data-link=\"#share-linkedin\" id=\"article--social--shareicon-linkedin\"><i class=\"fab fa-linkedin\"><span class=\"alt-text\">Share with linkedin</span></i></span><span tabindex=\"0\" data-link=\"#share-facebook\" id=\"article--social--shareicon-facebook\"><i class=\"fab fa-facebook-f\"><span class=\"alt-text\">Share with facebook</span></i></span><!----></div>",
  "similarIntro": "<p class=\"small italic\">\n    To arrive at the top five similar articles we use a word-weighted\n    algorithm to compare words from the Title and Abstract of each citation.\n  </p>",
  "refsHead": "<p class=\"small italic\">\n    Articles referenced by this article (34)\n  </p>",
  "showMore": "",
  "citationLine": "<p class=\"metadata--citation\"><!---->\n      \n      <span id=\"article--publisher--name\" itemprop=\"isPartOf\" itemscope=\"itemscope\" itemtype=\"http://schema.org/Periodical\" class=\"metadata--source-title\"><span itemprop=\"name\">International Journal of Biometeorology</span></span>,\n    <span itemprop=\"datepublished\">19 Nov 2022</span>, 67(2):<span itemprop=\"pagination\">311-320</span><!----><br><span class=\"metadata--doi\"><a id=\"article--doi--link-metadataSec\" href=\"//doi.org/10.1007/s00484-022-02407-x\">https://doi.org/10.1007/s00484-022-02407-x</a>&nbsp;</span><span class=\"metadata--pmid\">PMID: 36400976&nbsp;</span><!----></p>",
  "authorInfo": "<h2 class=\"metadata--dropdown-title\"><span role=\"button\" tabindex=\"0\" class=\"action small semi-bold\" id=\"article--expand--authInformation\">\n          Author information<span class=\"action-icon icon-right\"><i class=\"fas fa-caret-right\"></i></span><!----></span></h2>",
  "authorsCount": "<span class=\"metadata--authors-count\">(8 authors)</span><span class=\"metadata--authors-count\">(1 author)</span>",
  "citationModal": "<div tabindex=\"0\" class=\"modal large\"><div class=\"modal-wrapper\"><div class=\"modal-container\"><div class=\"vue-focus-loop\"><div tabindex=\"0\" aria-hidden=\"true\"></div> <div><div class=\"modal-header\"><i role=\"button\" class=\"fas fa-times\"><span class=\"alt-text\">Close</span></i><span role=\"heading\" aria-level=\"2\" class=\"modal-title\">\n      Export citations\n    </span></div><div class=\"modal-content\"><!----><div id=\"export--main--panel\" class=\"export-content\"><div class=\"export-quick-save\"><h3>\n      Quick save\n      <div id=\"quick-save-buttons\"><span role=\"button\" tabindex=\"0\" class=\"action small semi-bold\"><!----><span class=\"action-icon icon-left\"><i class=\"fas fa-plus\"></i></span>Add to export list\n        </span><span role=\"button\" tabindex=\"0\" class=\"action small semi-bold\"><!----><span class=\"action-icon icon-left\"><i class=\"fas fa-copy\"></i></span>Copy\n        </span><a href=\"mailto:?subject=Europe PMC citation&amp;body=Tripathi%20UK%2C%20Kumaresan%20A%2C%20Saraf%20KK%2C%20et%20al.%20Seasonal%20and%20climatic%20factors%20have%20a%20significant%20influence%20on%20fertility%20associated%20sperm%20phenomic%20attributes%20in%20crossbred%20breeding%20bulls%20(Bos%20taurus%E2%80%89%C3%97%E2%80%89Bos%20indicus).%20International%20Journal%20of%20Biometeorology.%202023%20Feb%3B67(2)%3A311-320.%20DOI%3A%2010.1007%2Fs00484-022-02407-x.%20PMID%3A%2036400976.\" target=\"_self\" class=\"action small semi-bold\"><!----><span class=\"action-icon icon-left\"><i class=\"fas fa-envelope\"></i></span>Email\n        </a></div></h3><!----><div id=\"exportCitation\">\n      Tripathi UK, Kumaresan A, Saraf KK, et al. Seasonal and climatic factors have a significant influence on fertility associated sperm phenomic attributes in crossbred breeding bulls (Bos taurus × Bos indicus). International Journal of Biometeorology. 2023 Feb;67(2):311-320. DOI: 10.1007/s00484-022-02407-x. PMID: 36400976.\n    </div><h3>Or, select format and export</h3></div><div class=\"export-format-buttons\"><div><input id=\"export--text--format-BIBTEXT\" name=\"exportformat\" type=\"radio\" value=\"[object Object]\"><label for=\"export--text--format-BIBTEXT\">BibTex (Mendeley, Papers)</label></div><div><input id=\"export--text--format-RIS\" name=\"exportformat\" type=\"radio\" value=\"[object Object]\"><label for=\"export--text--format-RIS\">RIS (EndNote, Mendeley, Refworks)</label></div><div><input id=\"export--text--format-TEXT_CITATION\" name=\"exportformat\" type=\"radio\" value=\"[object Object]\"><label for=\"export--text--format-TEXT_CITATION\">Text (citation)</label></div><div><input id=\"export--text--format-EUROPEPMC_XML\" name=\"exportformat\" type=\"radio\" value=\"[object Object]\"><label for=\"export--text--format-EUROPEPMC_XML\">XML (abstracts)</label></div></div><!----><div><input id=\"export--start--download\" type=\"button\" value=\"Download\" class=\"disabled\"><a id=\"export-link\" href=\"#\" download=\"\" class=\"alt-text\">Export</a></div><!----></div></div></div> <div tabindex=\"0\" aria-hidden=\"true\"></div></div></div></div></div>"
};

test("词库结构：条数、键值形态、规则可编译、模板槽位连续", () => {
  assert.equal(book.meta.family, "europepmc");
  assert.ok(book.meta.sites.includes("europepmc.org"));
  assert.ok(book.meta.sites.includes("www.europepmc.org"));
  assert.ok(Object.keys(book.exact).length >= 150, "exact 至少 150 条");
  assert.ok(book.rules.length >= 15, "rules 至少 15 条");
  assert.ok(book.templates.length >= 8, "templates 至少 8 条");
  const seen = new Set();
  for (const [k, v] of Object.entries(book.exact)) {
    assert.ok(!/[\u4e00-\u9fff]/.test(k), "键里不能有中文: " + k);
    // 导出格式名（BibTex (Mendeley, Papers)）只做全角标点规范化，不含汉字，单独放行
    assert.ok(/[\u4e00-\u9fff（）、]/.test(v), "译文里必须有中文: " + k);
    assert.notEqual(k, v, "自映射: " + k);
    assert.equal(k, k.trim(), "键首尾不能有空白: " + JSON.stringify(k));
    assert.equal(v, v.trim(), "译文首尾不能有空白: " + k);
    assert.ok(!/https?:\/\//.test(v), "译文里不能有明文 URL: " + k);
    assert.ok(!seen.has(k), "重复键: " + k);
    seen.add(k);
  }
  for (const r of book.rules) {
    assert.doesNotThrow(() => new RegExp(r.re), "规则编译失败: " + r.re);
    assert.ok(/[\u4e00-\u9fff]/.test(r.to), "规则译文里必须有中文: " + r.re);
    assert.ok(/\$\d/.test(r.to), "带捕获组的规则要用 $n: " + r.re);
  }
  for (const t of book.templates) {
    const used = [...t.pat.matchAll(/\{\{(\d+)\}\}/g)].map((m) => Number(m[1]));
    assert.ok(used.length >= 1, "模板要带槽位: " + t.pat);
    used.slice().sort((a, b) => a - b).forEach((n, i) => assert.equal(n, i + 1, "槽位必须从 1 连续: " + t.pat));
    const zhUsed = [...t.zh.matchAll(/\{\{(\d+)\}\}/g)].map((m) => Number(m[1]));
    assert.deepEqual(zhUsed.slice().sort((a, b) => a - b), used.slice().sort((a, b) => a - b), "中英槽位要一致");
    assert.ok(/[\u4e00-\u9fff]/.test(t.zh), "模板译文要有中文: " + t.pat);
  }
});

test("顶栏导航：六个下拉菜单、账号入口与菜单顺序都不动", () => {
  const before = raw(F.nav);
  const hrefs = [...before.querySelectorAll("a[href]")].map((a) => a.getAttribute("href"));
  const doc = run(F.nav);
  const t = plain(doc);
  for (const zh of ["关于 Europe PMC", "Europe PMC 中的预印本", "治理与资助", "使命与路线图", "工具概览", "文章状态监控", "基金检索", "外部链接服务", "RSS 订阅源", "开发者资源", "批量下载", "开发者论坛", "用户指南", "检索语法指南", "联系我们", "帮助台", "技术博客"]) {
    assert.ok(t.includes(zh), "顶栏缺译文: " + zh);
  }
  assert.ok(t.includes("工具") && t.includes("开发者") && t.includes("支持"), "三个一级菜单要翻");
  assert.equal(doc.querySelectorAll("ul.dropdown").length, before.querySelectorAll("ul.dropdown").length, "下拉菜单数量不能变");
  assert.deepEqual([...doc.querySelectorAll("a[href]")].map((a) => a.getAttribute("href")), hrefs, "链接地址不能动");
});

test("检索过滤面板：四个字段集、各档计数与过滤说明", () => {
  const doc = run(F.facets);
  const t = plain(doc);
  for (const zh of ["免费获取", "全文：Europe PMC 内（3,309,824）", "全文：Unpaywall 链接（556,893）", "类型", "研究论文（4,557,652）", "综述（893,007）", "预印本（112,246）", "已审阅（2,921）", "期刊发表（48,166）", "图书与文档（4,755）", "出版日期", "最近一年（694,557）", "最近 3 年（1,377,303）", "最近 5 年（2,076,821）", "起始年份", "结束年份", "起始年份至结束年份"]) {
    assert.ok(t.includes(zh), "过滤面板缺译文: " + zh);
  }
  assert.ok(t.includes("所有可免费在 Europe PMC 内阅读的文章"), "第一条过滤说明没翻");
  assert.ok(t.includes("这些链接通常由Unpaywall提供"), "第二条过滤说明没翻");
  assert.ok(!t.includes("All articles that are freely available"), "过滤说明残留英文");
  assert.ok(!t.includes("To filter for open access license types"), "过滤说明残留英文");
  assert.equal(doc.querySelectorAll('input[type="checkbox"]').length, 8, "文章类型/全文来源复选框不能丢");
  assert.equal(doc.querySelectorAll('input[type="radio"]').length, 4, "日期档位单选框不能丢");
  assert.equal(doc.querySelectorAll('input[type="text"]').length, 2, "起止年份输入框不能丢");
});

test("检索结果头：条数区间、排序项与分页", () => {
  const html = [
    '<div class="search-results"><h2 class="alt-text">Search results</h2>',
    '<span class="small">1-25 of 5,665,205 results</span></div>',
    '<div class="sort-bar"><label for="sort">Sort by:</label>',
    '<select id="sort" name="sort"><option>Relevance</option><option>Times cited</option><option>Date</option></select></div>',
    '<ul class="pagination"><li><a href="#" class="prev">Previous</a></li><li><a href="#" class="current">1</a></li><li><a href="#" class="next">Next</a></li></ul>'
  ].join("");
  const doc = run(html);
  const t = plain(doc);
  assert.ok(t.includes("检索结果"));
  assert.ok(t.includes("第 1–25 条，共 5,665,205 条结果"), "条数区间没走规则: " + t);
  assert.ok(t.includes("排序方式"), "Sort by 没翻");
  assert.ok(t.includes("相关度") && t.includes("被引次数") && t.includes("日期"), "排序项没翻");
  assert.ok(t.includes("上一页") && t.includes("下一页"), "分页没翻");
  assert.equal(doc.querySelectorAll("option").length, 3, "排序项数量不能变");
});

test("空状态与检索页操作按钮", () => {
  const html = F.emptyState +
    '<div class="actions"><span class="action small">Save &amp; create alert</span>' +
    '<span class="action small">Export citations</span>' +
    '<span class="action small">Subscribe to RSS</span></div>';
  const doc = run(html);
  const t = plain(doc);
  assert.ok(t.includes("检索结果"));
  assert.ok(t.includes("没有与您的检索式匹配的引文。"), "空状态句没翻");
  assert.ok(t.includes("保存并创建提醒"));
  assert.ok(t.includes("导出引文"));
  assert.ok(t.includes("订阅 RSS"));
  assert.ok(!t.includes("There are no citations"), "空状态残留英文");
});

test("结果条目：引用计数、动作按钮，题录保持原样", () => {
  const doc = run(F.resultItem);
  const t = plain(doc);
  assert.ok(t.includes("被引：0 篇 |"), "Cited by 带竖线的那条规则没命中: " + t);
  assert.ok(t.includes("保存") && t.includes("加入导出列表"), "结果条目动作按钮没翻");
  assert.equal(doc.querySelector(".citation-title").textContent.trim(), "Beyond the binary: vaping and the changing face of perioperative pulmonary risk.");
  assert.ok(doc.querySelector(".citation-author-list").textContent.includes("van Meenen DMP"), "作者名不能被改");
  assert.equal(doc.querySelector(".citation-title a").getAttribute("href"), "/article/MED/43064585");
  assert.ok(doc.querySelector("#citation--id--pmid-43064585").textContent.includes("PMID: 43064585"));
  assert.ok(plain(run("<p>Cited by: 1 article</p>")).includes("被引：1 篇"), "单数形式没命中");
});

test("文章页侧栏分区与操作按钮", () => {
  const doc = run(F.articleMenu + F.articleActions);
  const t = plain(doc);
  for (const zh of ["摘要", "全文", "参考文献", "引文与影响力", "相似文章", "资助", "保存", "获取引文", "认领到 ORCID"]) {
    assert.ok(t.includes(zh), "文章页缺译文: " + zh);
  }
  assert.ok(t.includes("可通过 DOI 在出版商网站获取"), "DOI 提示句没翻");
  assert.equal(doc.querySelectorAll("#epmc-menu.article-menu > li").length, 6, "侧栏分区数量不能变");
  assert.ok(doc.querySelector("#get_citation"), "Get citation 动作节点丢了");
  assert.ok(doc.querySelector("#article--side-menu--item-impact"), "侧栏锚点 id 不能变");
  assert.equal(doc.querySelector("#epmc-menu a.full-text-link").getAttribute("href"), "//doi.org/10.1007/s00484-022-02407-x");
  // PMC 全文页多出来的固定标签（Footnotes / References (80) / 版权许可信息）
  const ft = plain(run('<div class="article-menu"><span>References (80)</span><span>Footnotes</span>' +
    '<span>Author affiliations &amp; information</span><span>Article notes</span>' +
    '<span>Copyright and license information</span><span>EPMC Copyright notice</span></div>'));
  for (const zh of ["参考文献（80）", "脚注", "作者单位与信息", "文章注释", "版权与许可信息", "EPMC 版权声明"]) {
    assert.ok(ft.includes(zh), "全文页固定标签缺译文: " + zh);
  }
});

test("作者信息、分享面板与相似文章说明句", () => {
  const doc = run(F.authorInfo + F.authorsCount + F.share + F.similarIntro);
  const t = plain(doc);
  assert.ok(t.includes("作者信息"));
  assert.ok(t.includes("（8 位作者）") && t.includes("（1 位作者）"), "作者计数规则没命中");
  assert.ok(t.includes("分享本文"));
  for (const zh of ["通过邮件分享", "通过 Twitter 分享", "通过 LinkedIn 分享", "通过 Facebook 分享"]) {
    assert.ok(t.includes(zh), "分享项缺译文: " + zh);
  }
  assert.ok(t.includes("为找出前五篇相似文章"), "相似文章说明句没翻");
  assert.equal(doc.querySelectorAll("#article--social--sharepanel span[data-link]").length, 4, "分享按钮不能丢");
});

test("参考文献区与全文链接", () => {
  const extra = '<div class="section-content"><span class="references--articles-link action">Show 10 more references (10 of 34)</span></div>' +
    '<div class="content-section"><h2 class="hide section-title"><span>Full text links</span></h2>' +
    '<p>Read article at publisher\'s site:</p></div>';
  const doc = run(F.refsHead + extra);
  const t = plain(doc);
  assert.ok(t.includes("本文引用的文献（34）"), "references 标题没走规则");
  assert.ok(t.includes("再显示 10 条参考文献（10/34）"), "show-more 规则没命中");
  assert.ok(t.includes("全文链接"));
  assert.ok(t.includes("在出版商网站阅读原文："));
});

test("登录页：账号登录与第三方登录文案", () => {
  const doc = run(F.login);
  const t = plain(doc);
  for (const zh of ["登录", "使用 Europe PMC 账户登录", "电子邮件", "密码", "忘记密码？", "登录 Europe PMC", "还没有 Europe PMC 账户？", "创建账户。", "使用其他账户登录", "使用 ORCID 登录", "使用 Twitter 登录", "Twitter 登录暂时无法正常工作。", "使用 PMC Plus 登录", "保持登录状态"]) {
    assert.ok(t.includes(zh), "登录页缺译文: " + zh);
  }
  assert.ok(doc.querySelector('input[name="password"]'), "密码框不能丢");
  assert.ok(doc.querySelector('input[name="email"]'), "邮箱框不能丢");
  assert.ok(doc.querySelector('input[name="remember_me"]'), "保持登录复选框不能丢");
});

test("导出对话框：步骤标题、导出范围、七种格式与下载按钮", () => {
  const doc = run(F.exportModal);
  const t = plain(doc);
  assert.ok(t.includes("1. 选择要导出的引文？"), "导出步骤 1 没翻");
  assert.ok(t.includes("2. 选择格式"), "导出步骤 2 没翻");
  assert.ok(t.includes("导出列表（0）"), "导出列表计数没翻");
  assert.ok(t.includes("检索结果（5,665,204）"), "检索结果计数没翻");
  for (const zh of ["BibTex（Mendeley、Papers）", "文本（引文）", "XML（摘要）", "XML（开放获取全文）", "Excel，逗号分隔（CSV）", "ID 列表"]) {
    assert.ok(t.includes(zh), "导出格式缺译文: " + zh);
  }
  assert.equal(doc.querySelectorAll('input[name="exportformat"]').length, 7, "七种导出格式不能少");
  assert.equal(doc.querySelector("#export--start--download").getAttribute("value"), "下载", "下载按钮的 value 要走 attrs:[\"value\"]");
  assert.equal(doc.querySelector("#export--start--download").getAttribute("type"), "button", "下载按钮类型不能变");
});

test("引文弹窗：快速保存区、格式选择与导出", () => {
  const doc = run(F.citationModal);
  const t = plain(doc);
  assert.ok(t.includes("导出引文"), "弹窗标题没翻");
  assert.ok(t.includes("关闭"), "Close 没翻");
  assert.ok(t.includes("快速保存"), "Quick save 没翻");
  assert.ok(t.includes("加入导出列表") && t.includes("复制") && t.includes("电子邮件"), "快速保存按钮没翻: " + t.slice(0, 120));
  assert.ok(t.includes("或选择格式并导出"), "Or, select format and export 没翻");
  assert.ok(t.includes("文本（引文）"), "格式名没翻");
  const cite = doc.querySelector("#exportCitation").textContent.replace(/\s+/g, " ").trim();
  assert.ok(cite.includes("DOI: 10.1007/s00484-022-02407-x") && cite.includes("PMID: 36400976."), "引文正文不能改");
  assert.equal(doc.querySelectorAll('.export-format-buttons input[name="exportformat"]').length, 4, "四个格式按钮不能丢");
  const mail = doc.querySelector('a[href^="mailto:"]');
  assert.ok(mail && mail.getAttribute("href").startsWith("mailto:?subject=Europe PMC citation"), "邮件链接不能丢");
});

test("模板通道：cookie 横幅与页脚固定句保留链接", () => {
  const bannerBtn = '<div><input id="data-protection-agree" type="button" value="I agree, dismiss this banner" class="secondary"></div>';
  const doc = run(F.cookie + bannerBtn + '<div class="partnership-and-funding">' + F.footer + "</div>" + F.featuresIntro);
  const t = plain(doc);
  assert.ok(t.includes("本网站需要使用 Cookie"), "cookie 横幅模板没命中");
  assert.ok(t.includes("隐私声明与 Cookie 政策"), "cookie 政策链接没翻");
  assert.ok(t.includes("Europe PMC 由") && t.includes("开发，并得到"), "页脚第一句模板没命中: " + t.slice(0, 200));
  assert.ok(t.includes("存档网络的一部分"), "页脚第一句尾部没翻");
  assert.ok(t.includes("直观而强大的检索工具"), "首页创新块模板没命中");
  assert.equal(doc.querySelectorAll("#data-protection-banner-left a").length, 1, "cookie 链接不能丢");
  assert.equal(doc.querySelector("#data-protection-banner-left a").getAttribute("href"), "/PrivacyNotice", "cookie 链接地址不能变");
  assert.equal(doc.querySelectorAll(".partnership-and-funding a").length, 4, "页脚四个外链不能丢");
  assert.ok(t.includes("EMBL-EBI") && t.includes("National Library of Medicine (NLM)"), "机构名保持原文");
  assert.equal(doc.querySelector("#data-protection-agree").getAttribute("value"), "我同意，关闭此提示", "cookie 同意按钮的 value 要走 attrs:[\"value\"]");
  assert.ok(!t.includes("This website requires cookies"), "cookie 横幅残留英文");
  assert.ok(!t.includes("is developed by"), "页脚残留英文");
});

test("数据不动：期刊名、DOI、PMID 与作者保持原样", () => {
  const doc = run(F.citationLine);
  assert.equal(doc.querySelector(".metadata--source-title").textContent.trim(), "International Journal of Biometeorology");
  assert.ok(doc.querySelector(".metadata--doi").textContent.includes("10.1007/s00484-022-02407-x"), "DOI 不能改");
  assert.ok(doc.querySelector(".metadata--pmid").textContent.replace(/\s+/g, " ").trim().startsWith("PMID: 36400976"), "PMID 不能改");
  assert.equal(doc.querySelector(".metadata--doi a").getAttribute("href"), "//doi.org/10.1007/s00484-022-02407-x");
  assert.ok(!/[\u4e00-\u9fff]/.test(doc.querySelector(".metadata--source-title").textContent), "期刊名里不能出现中文");
});