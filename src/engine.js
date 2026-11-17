/**
 * BioL10n engine
 * 纯离线：不发起任何网络请求，不读写 cookie/localStorage 之外的任何存储，
 * 只做两件事：替换文本节点的 nodeValue、替换白名单属性。
 */
function createEngine(options) {
  var doc = options.document;
  var win = options.window;
  var data = options.data || {};
  var site = options.site || {};
  var onMiss = options.onMiss;

  var CJK = /[\u3400-\u4DBF\u4E00-\u9FFF\uF900-\uFAFF]/;
  var LETTER = /[A-Za-z]/;
  var SKIP_TAGS = {
    SCRIPT: 1, STYLE: 1, NOSCRIPT: 1, CODE: 1, PRE: 1, KBD: 1, SAMP: 1,
    TEXTAREA: 1, SVG: 1, MATH: 1, TITLE_IGNORE: 0
  };
  var DEFAULT_ATTRS = ["placeholder", "title", "aria-label", "alt"];
  // 下载格式名：这些词既是选项文字又是提交值，翻了只会让下载格式变成中文（List → 列表）
  var FORMAT_OPTION = /^(FASTA( \([^)]*\))?|TSV( \(Excel\))?|Excel|JSON|XML|RDF\/XML|Text|Plain text|GFF3?|BED|CSV|PSL|WIG|List|Embeddings|PDB|PPI)$/i;
  var BLOCK = site.block || "pre, code, kbd, samp, textarea, [contenteditable=''], [contenteditable='true']";

  var exact = new Map();
  var lowerIndex = new Map(); // 大小写兜底：SEARCH / search → 同一个译文
  var keyIndex = new Map(); // 规范化后的键 -> 原键（用于命中统计）
  Object.keys(data.exact || {}).forEach(function (k) {
    exact.set(normalize(k), data.exact[k]);
    var lk = normalize(k).toLowerCase();
    if (!lowerIndex.has(lk)) lowerIndex.set(lk, data.exact[k]);
    keyIndex.set(normalize(k), k);
  });

  var rules = [];
  (data.rules || []).forEach(function (r) {
    // requireHit：句式里带全角标点或中文模板时，至少有一个捕获组得真的命中词表才替换，
    // 否则 "Pan-Lung Cancer (TCGA, Nat Genet 2016)" 这类纯英文专名会被套上全角括号（半中半英）。
    try { rules.push({ re: new RegExp(r.re), to: r.to, src: r.re, requireHit: !!r.requireHit }); } catch (e) { /* 坏规则直接跳过 */ }
  });

  var attrs = site.attrs && site.attrs.length ? site.attrs : DEFAULT_ATTRS;
  var processed = new WeakSet();
  var originals = new WeakMap();
  var propOriginals = new WeakMap(); // 通过 el.value 写入的默认文字
  var blockOriginals = new WeakMap(); // 整块替换时摘下的原始子节点（disable 时要挂回去）
  var svgTexts = []; // SVG <text> 的逐节点原文（元素不在文本节点还原范围内，单独记）
  var misses = new Set();
  // enabled 放在 stats 上而不是只做闭包变量：boot 的 toggle 靠它判断该开还是该关
  var stats = { nodes: 0, hitExact: 0, hitRule: 0, attrs: 0, skipped: 0, enabled: true };
  var enabled = true;
  var observer = null;
  var queue = new Set();
  var timer = null;

  function normalize(s) {
    return s.replace(/[\u00a0\u2000-\u200b\u3000]/g, " ").replace(/\s+/g, " ").trim();
  }

  function hasCJK(s) { return CJK.test(s); }

  /** 去掉句尾标点后再试一次（"Search:" 也要能命中 "Search"） */
  function variants(s) {
    var out = [s];
    var v = s.replace(/^[•·\-–—*]\s*/, "");
    if (v !== s) out.push(v);
    var v2 = v.replace(/[\s:：.。,，;；!！?？…]+$/, "");
    if (v2 && v2 !== v) out.push(v2);
    return out;
  }

  /** 复数退化：只在能查到时才用，避免把 Yes 砍成 Ye */
  function singulars(s) {
    var out = [];
    if (/ies$/.test(s)) out.push(s.slice(0, -3) + "y");
    if (/[^s]s$/.test(s)) out.push(s.slice(0, -1));
    if (/(ses|xes|zes|ches|shes)$/.test(s)) out.push(s.slice(0, -2));
    return out;
  }

  /** 只在 exact 表里查一次，不进入 rules，避免递归 */
  function lookupExact(s) {
    if (!s) return null;
    var text = normalize(s);
    if (!text || hasCJK(text)) return null;
    var cand = variants(text);
    for (var i = 0; i < cand.length; i++) {
      var hit = exact.get(cand[i]);
      if (hit !== undefined) return hit;
      var low = lowerIndex.get(cand[i].toLowerCase());
      if (low !== undefined) return low;
    }
    for (var j = 0; j < cand.length; j++) {
      var sg = singulars(cand[j]);
      for (var k = 0; k < sg.length; k++) {
        var hit2 = exact.get(sg[k]);
        if (hit2 !== undefined) return hit2;
        var low2 = lowerIndex.get(sg[k].toLowerCase());
        if (low2 !== undefined) return low2;
      }
    }
    return null;
  }

  /** 模板里的 $1..$9：先查词表，再按规则递归翻一层（"Thu, 4 Jun 2026" 里的 "4 Jun 2026" 就是靠这层），
   *  深度上限 2 防止规则互相咬死。 */
  function translateCapture(seg, depth) {
    var v = lookupExact(seg);
    if (v !== null) return v;
    var st = seg.replace(/^[\s"'“”‘’(\[]+|[\s"'“”‘’)\]]+$/g, "");
    if (st !== seg) {
      var v2 = lookupExact(st);
      if (v2 !== null) return v2;
    }
    if ((depth || 0) < 2) {
      var v3 = translate(seg, (depth || 0) + 1);
      if (v3 !== null) return v3;
    }
    return seg;
  }

  function translate(s, depth) {
    depth = depth || 0;
    var hitOnce = lookupExact(s);
    if (hitOnce !== null) { stats.hitExact++; return hitOnce; }
    for (var j = 0; j < rules.length; j++) {
      var m = rules[j].re.exec(s);
      if (m) {
        if (rules[j].requireHit) {
          var anyHit = false;
          for (var k = 1; k < m.length; k++) {
            if (m[k] !== undefined && translateCapture(m[k], depth) !== m[k]) { anyHit = true; break; }
          }
          if (!anyHit) continue;
        }
        stats.hitRule++;
        var to = rules[j].to;
        return to.replace(/\$(\d)/g, function (_, d) {
          var seg = m[Number(d)];
          return seg === undefined ? "" : translateCapture(seg, depth);
        });
      }
    }
    return null;
  }

  function recordMiss(text) {
    if (typeof onMiss === "function") onMiss(text);
    if (misses.size < 200 && text.length <= 80 && LETTER.test(text)) misses.add(text);
  }

  function skipNode(node, skipTranslateNo) {
    var p = node.parentElement;
    var guard = 0;
    while (p && guard++ < 40) {
      // 图表里的文字（<text>/<tspan>）照翻：HPA 的饼图图例、坐标轴标签都在 SVG 里。
      // 其余 SVG 内部节点（图形、路径）没有可读文本，照样跳过。
      if (p.tagName === "SVG" || p.tagName === "svg") {
        // 不能只看 node.parentElement.tagName：HPA 本体图是 <text><a>Brain</a></text>，
        // 文本节点的父级是 <a>，整批图例标签会被误判成图形节点跳过。
        var pe = node.parentElement;
        var t = pe && pe.closest ? pe.closest("text,tspan,title,desc") : null;
        return !t;
      }
      if (SKIP_TAGS[p.tagName] === 1) return true;
      if (p.isContentEditable) return true;
      if (p.dataset && p.dataset.l10nScope === "off") return true;
      if (p.hasAttribute && p.hasAttribute("data-biol10n-block")) return true;
      // 站点自己声明"这段别翻"（UniProt 的示例检索词按钮就是 <span translate="no">Human</span>）
      if (!skipTranslateNo && p.getAttribute && p.getAttribute("translate") === "no") {
        if (!allowInsideNo(node, p)) return true;
      }
      p = p.parentElement;
    }
    return false;
  }

  /** translate="no" 里也有该翻的界面控件：UniProt 把疾病与变异的整张表包在 translate="no" 里，
   *  但里面的「N 篇文献」证据按钮、header 的 Align 链接都是界面骨架。站点可以在 config 里用
   *  translateNoAllow 列出放行的选择器；命中的元素必须落在当前这层 translate="no" 之内。 */
  function allowInsideNo(node, barrier) {
    var list = site.translateNoAllow;
    if (!list || !list.length || !node.parentElement) return false;
    for (var i = 0; i < list.length; i++) {
      var hit = null;
      try { hit = node.parentElement.closest(list[i]); } catch (e) { hit = null; }
      if (hit && (hit === barrier || (barrier.contains && barrier.contains(hit)))) return true;
    }
    return false;
  }

  function inBlock(el) {
    if (!el || !el.closest) return false;
    try { return !!el.closest(BLOCK); } catch (e) { return false; }
  }

  /** 长正文保护：段落里的零散单词不翻，避免中英混排（正文整段留英文比半翻更好读）。
   *  article 不算段落容器：它是结果条目的外壳（PubMed 每条结果 article.full-docsum 上千字符），
   *  里面照样有按钮、引文徽标这类该翻的界面元素。 */
  /** 判断一段文字是不是"成句的正文"：连续三个以上小写英文单词，或小写字母后接句末标点。
   *  观感标签（"1. Metabolism"、"Including:"、"Jump to:"）不会命中。 */
  function looksLikeProse(text) {
    var t = String(text || "").trim();
    if (!t) return false;
    if (t.length <= 80) return false;               // 短块本身就是标签
    if (/[a-z]{2,}[ \t]+[a-z]{2,}[ \t]+[a-z]{2,}/.test(t)) return true;
    return /[a-z][.!?]["')\]]?\s/.test(t);
  }

  /** 一路向上跳出内联元素（a/b/i/em/strong/span…），返回最外层的那个内联祖先 */
  var INLINE = { A: 1, B: 1, I: 1, EM: 1, STRONG: 1, SPAN: 1, SMALL: 1, SUP: 1, SUB: 1, FONT: 1, U: 1 };
  function inlineRoot(el) {
    var cur = el, guard = 0;
    while (cur && cur.parentElement && INLINE[cur.parentElement.tagName] && guard++ < 6) {
      cur = cur.parentElement;
    }
    return cur || el;
  }

  /** 取元素之后、同一块级容器内的第一段非空文本（用于判断"这句还没说完"） */
  function nextTextAfter(el) {
    var n = el && el.nextSibling;
    var guard = 0;
    while (n && guard++ < 6) {
      if (n.nodeType === 1) break;           // 下一个元素 = 另一个标签项，不是同一句话
      if (n.nodeType === 3) {
        var t = (n.nodeValue || "").trim();
        if (t) return t;
      }
      n = n.nextSibling;
    }
    return "";
  }

  /** 取元素之前、同一块级容器内的第一段非空文本 */
  function prevTextBefore(el) {
    var n = el && el.previousSibling;
    var guard = 0;
    while (n && guard++ < 6) {
      if (n.nodeType === 1) break;           // 上一个元素 = 另一个标签项
      if (n.nodeType === 3) {
        var t = (n.nodeValue || "").trim();
        if (t) return t;
      }
      n = n.previousSibling;
    }
    return "";
  }

  function inLongProse(node) {
    if (site.proseGuard === false) return false;
    var el = node && node.nodeType === 3 ? node.parentElement : node;
    if (!el || !el.closest) return false;
    // 交互控件与表单说明永远翻，不受正文保护影响
    try {
      if (el.closest("button, summary, label, select, option, th, [role='button']")) return false;
      // 站点指定的固定提示语（免责声明、cookie 条、公告）：整块放行，但如果这块本身是成句的正文，
      // 放行会把"英文句子里的名词"逐词翻成中英混排，所以按句读特征再挡一次。
      if (site.proseExempt) {
        // 站点显式点名要翻的块（免责声明、cookie 条、.gov 横幅）：无条件放行
        if (el.closest(site.proseExempt)) return false;
      }
    } catch (e) { /* ignore */ }
    // 段落类容器之外，KEGG 这类老站点把正文直接放在 <div> 里（"<b>KEGG PATHWAY</b> is a collection of…"），
    // 所以要找到最近的"块级容器"再判是不是成句正文。
    var p = el.closest("p, blockquote, dd, dt, li, td, figcaption, div, section, article");
    if (!p) return false;
    var blockText = String(p.textContent || "");
    if (blockText.length <= (site.proseMax || 120)) return false;
    // 关键判据：这个文本节点后面紧跟着小写英文单词，说明它处在句子中间
    // （"<a>KEGG PATHWAY</a> is a collection of…"），单独翻它必然造成中英混排。
    // 列表项后面跟的是 <br>/<a>/空白，不会命中。
    // 上下文要跳出内联包裹：<a><b>重建</b></a> is the basic mapping tool… 里的 <b> 自己
    // 没有兄弟节点，光看它会误判成"独立标签"。取最外层内联元素的兄弟文本才算数。
    // 强调型徽标不算正文：cBioPortal 新闻 <li>（整块 1454 字符）里的 <strong>Added data</strong>
    // 是状态徽标不是句子成分，整条命中词库就该翻；但正文段落里的普通 <a>（"…browser. Contact Us"）
    // 保持英文，否则会变成半中半英。所以只放行 strong/em/b 且挂在列表项下的短节点。
    var own = String(node && node.nodeType === 3 ? node.nodeValue : el.textContent || "").trim();
    if (own && own.length <= 24 && lookupExact(own) !== null) {
      var badge = null;
      try { badge = el.closest("strong, em, b"); } catch (e) { badge = null; }
      if (badge && badge.closest("li")) return false;
      // 表格单元格里的短标签：HPA 的 td.summary_info 整块几千字符，标签（DNA sequence）
      // 却是独立单元格，整条命中词库就该翻；单元格里的长句仍被正文保护挡住。
      try { if (el.closest("td, th, dt")) return false; } catch (e) { /* ignore */ }
    }
    var ctx = inlineRoot(el);
    var nxt = nextTextAfter(ctx);
    var prv = prevTextBefore(ctx);
    // 已经变成中文的句子：块里还有零星英文单词（RCSB 检索构建器的
    // 「选择一个 attribute 进行检索（例如：物种，实验方法，Resolution）」），
    // 这些短词整条命中词库、且前后都不像被夹在英文句中，就该补翻，否则永远半中半英。
    if (own && own.length <= 24 && lookupExact(own) !== null && /[\u3400-\u9fff]/.test(blockText)) {
      var midAfter = !!nxt && /^[a-z]/.test(nxt);
      var midBefore = !!prv && /[A-Za-z]$/.test(prv);
      // 两侧都得是中文语境：否则英文句子里的 <a>contact us</a> 会被单独翻成半中半英
      var prevCN = !!prv && /[\u3400-\u9fff][，。：；、）]?$/.test(prv);
      var nextCN = !!nxt && /^[（「]?[\u3400-\u9fff]/.test(nxt);
      if (!midAfter && !midBefore && prevCN && nextCN) return false;
    }
    if (nxt && /^[a-z]/.test(nxt)) return true;
    // 反过来看前文：前面是英文单词/逗号，说明这个节点被夹在句子中间
    //（"…5 digit number (see <a>KEGG identifier</a>). The prefix…"），单独翻就是半中半英。
    if (prv && /[A-Za-z,;.!?]$/.test(prv)) return true;
    // 后面没有文本（标签项后面通常是 <br>/<a>）：按标签处理，照翻
    return false;
  }

  /** 站点配置里的 skip 选择器：这些区块里的文字不翻（长正文/中英混排源） */
  function inSkip(el) {
    if (!site.skip || !el || !el.closest) return false;
    try { return !!el.closest(site.skip); } catch (e) { return false; }
  }

  /** 中文语境下的标点本地化：链接/按钮被单独包在元素里时，紧跟的 "." "," 常常是独立文本节点 */
  var PUNCT = { ".": "。", ",": "，", ";": "；", ":": "：", "?": "？", "!": "！", ")": "）", "(": "（" };
  function localizePunct(node, text) {
    if (site.punctFix === false) return;
    if (!text || text.length > 2) return;
    // 复数后缀：站点把 " result" + "s" 拆成两个节点做 i18n，中文里不需要这个 s
    var raw = String(text || "").trim();
    if (raw === "s" || raw === "es") {
      // 只看紧邻的前一个文本节点是否以中文结尾（"59,140 结果" + "s"），
      // 不能用父块整体判：英文段落里任意一处中文都会把词尾的 s 吞掉（entries → entrie）
      var prev = node.previousSibling;
      var prevText = "";
      while (prev && prev.nodeType !== 3) prev = prev.previousSibling;
      if (prev) prevText = String(prev.nodeValue || "").trim();
      if (/[\u4e00-\u9fff]$/.test(prevText)) {
        if (!originals.has(node)) originals.set(node, node.nodeValue);
        node.nodeValue = "";
        processed.add(node);
        stats.punct = (stats.punct || 0) + 1;
      }
      return;
    }
    var out = PUNCT[text.trim()];
    if (!out) return;
    // 上下文取整个父块：标点常跟在一个 <a> 后面（"…<a>Reactome</a>)"），
    // 这时前一个兄弟节点是元素，只看它会漏掉前面那句中文。
    // 判据从"父块里有中文"收紧到"紧邻的中文语境"：示例词 "Insulin, APP, Human"
    // 之间那个逗号不该被换成全角（父块因为「示例：」三个字被判成中文语境）。
    var nearPrev = "", nearNext = "";
    for (var pv = node.previousSibling; pv; pv = pv.previousSibling) {
      if (pv.nodeType === 3 && String(pv.nodeValue || "").trim()) { nearPrev = String(pv.nodeValue).trim(); break; }
    }
    for (var nx = node.nextSibling; nx; nx = nx.nextSibling) {
      if (nx.nodeType === 3 && String(nx.nodeValue || "").trim()) { nearNext = String(nx.nodeValue).trim(); break; }
    }
    var cnEnd = /[\u3400-\u9fff，。：；、）」】]$/.test(nearPrev);
    var cnStart = /^[（「【\u3400-\u9fff]/.test(nearNext);
    // 标点紧跟一个刚被翻译的元素（<a>More information</a>.）时，前一个"文本"其实是元素内容
    var prevEl = node.previousSibling;
    while (prevEl && prevEl.nodeType === 3 && !String(prevEl.nodeValue || "").trim()) prevEl = prevEl.previousSibling;
    if (prevEl && prevEl.nodeType === 1 && /[\u3400-\u9fff]$/.test(String(prevEl.textContent || "").trim())) cnEnd = true;
    // 跨元素回看：把纯数字/计数的节点（<span>0</span>、"59k"）跳过去，再看前面是不是中文。
    // 下载抽屉的 DOM 是 "Download selected (" + <span>0</span> + ")"，只看紧邻一节永远看不到中文。
    if (!cnEnd) {
      var digits = /^[\d,.\s%kKmMbB()（）]+$/;
      var probe = node.previousSibling;
      for (var g = 0; probe && g < 5; g++) {
        var seg = probe.nodeType === 3 ? String(probe.nodeValue || "").trim() : String(probe.textContent || "").trim();
        if (!seg) { probe = probe.previousSibling; continue; }
        if (digits.test(seg)) { probe = probe.previousSibling; continue; }
        if (/[\u3400-\u9fff，。、；：！？）]$/.test(seg)) cnEnd = true;
        break;
      }
    }
    if (!cnEnd && !cnStart) return;
    if (!originals.has(node)) originals.set(node, node.nodeValue);
    // 中文标点后面紧跟中文时，把节点自带的尾随空格丢掉（"…基因名称, 基因本体" → "…基因名称，基因本体"）
    var pv2 = node.nodeValue.replace(text.trim(), out);
    if (cnStart) pv2 = pv2.replace(/[ \t]+$/, "");
    node.nodeValue = pv2;
    processed.add(node);
    stats.punct = (stats.punct || 0) + 1;
  }

  function handleTextNode(node) {
    if (!enabled || processed.has(node)) return;
    if (node.isConnected === false) return;
    if (handleSvgText(node)) return;
    if (handleSplitText(node)) return;
    if (handleBrJoin(node)) return;
    var raw = node.nodeValue;
    if (!raw) return;
    var text = normalize(raw);
    if (text.length < 2) { localizePunct(node, text); return; }
    if (hasCJK(text)) return;
    if (!LETTER.test(text)) return;
    // 下载格式名（FASTA/TSV/List…）是约定俗成的标识，不翻；其余 <option> 照翻文字、
    // 但绝不碰 value 属性——筛选器的 value 和显示文字常常一模一样，按 value 一刀切会把
    // 「Mutagenesis」这类该翻的筛选项整类留下（UniProt 就这样）。
    var opt = node.parentElement;
    if (opt && opt.tagName === "OPTION" && FORMAT_OPTION.test(text)) { processed.add(node); return; }
    // 公式碎片：Log<sub>2</sub>、10<sup>-6</sup> 这类，前一半单独翻会变成「对数2」
    var nsEl = node.nextSibling;
    while (nsEl && nsEl.nodeType === 3 && !String(nsEl.nodeValue || "").trim()) nsEl = nsEl.nextSibling;
    // 只挡真正的数字上标（Log<sub>2</sub>、10<sup>-6</sup>）；字母上标是 HPA 的帮助图标
    // <sup class="help_i">i</sup>，挡掉会把整类标签（Tissue specificity 等）留在英文。
    if (nsEl && nsEl.nodeType === 1 && /^(SUB|SUP)$/.test(nsEl.tagName) && /^[+\-]?[\d.]+$/.test(String(nsEl.textContent || "").trim())) { processed.add(node); return; }
    if (skipNode(node) || inBlock(node.parentElement) || inSkip(node.parentElement)) { processed.add(node); return; }
    // 正文保护挡下的节点不记入 processed：块内容会随其它节点被翻译而变中文
    // （RCSB 构建器先被翻成「选择一个 attribute 进行检索…」），下一轮补扫要能重新判一次。
    if (inLongProse(node.parentElement)) return;

    stats.nodes++;
    var out = translate(text);
    if (out === null) { recordMiss(text); processed.add(node); return; }

    var m = /^(\s*)([\s\S]*?)(\s*)$/.exec(raw);
    var lead = m ? m[1] : "";
    var trail = m ? m[3] : "";
    // 中英混排里最常见的瑕疵：源 DOM 把空格放在独立的纯空白文本节点里
    //（" as a" + " " + <a>），译文是中文时这些空格留着就会变成「作为 蛋白名称」。
    // 译文以中文开头就吃掉前面的空格节点、以中文结尾就吃掉后面的。
    // 只清相邻的纯空白兄弟节点，不动本节点内部的首尾空白（那是 HTML 缩进，删了会破坏排版）
    if (/^[\u3400-\u9fff]/.test(out)) blankSibling(node, "previousSibling");
    if (/[\u3400-\u9fff]$/.test(out)) blankSibling(node, "nextSibling");
    // 节点自带的空格要看"另一侧是谁"：
    // 中文接中文 → 丢掉空格（「， 基因本体」）；中文接数字/英文 → 保留（「59,140 结果」）。
    var prevCh = neighborChar(node, -1);
    var nextCh = neighborChar(node, 1);
    var cnPrev = /[\u3400-\u9fff，。、；：！？）]/.test(prevCh);
    var cnNext = /[\u3400-\u9fff（]/.test(nextCh);
    if (/^\s+$/.test(lead) && /^[\u3400-\u9fff（「【]/.test(out) && cnPrev) lead = "";
    if (/^\s+$/.test(trail) && /[\u3400-\u9fff，。、；：！？]$/.test(out) && cnNext) trail = "";
    // 译文自带句末标点、原句尾还挂着一个 "。" 的独立节点 → 吞掉，避免「肿瘤缩写。。」
    if (/[。！？，、；：]$/.test(out)) {
      var nxtNode = node.nextSibling;
      while (nxtNode && nxtNode.nodeType === 3 && !String(nxtNode.nodeValue || "").trim()) nxtNode = nxtNode.nextSibling;
      if (nxtNode && nxtNode.nodeType === 3 && /^[。．.！？]\s*$/.test(String(nxtNode.nodeValue || "").trim())) {
        if (!originals.has(nxtNode)) originals.set(nxtNode, nxtNode.nodeValue);
        nxtNode.nodeValue = "";
      }
    }
    if (!originals.has(node)) originals.set(node, raw);
    node.nodeValue = lead + out + trail;
    processed.add(node);
  }

  /** SVG <text> 整块翻：tspan 会把 "Bone marrow" 拆成 "Bone " + "marrow"，
   *  逐节点翻就变成「骨marrow」。以整个 <text> 为单位查表，命中后写回第一个文本节点。 */
  var svgDone = new WeakSet();
  /** <text> 的两种拼接：原样 textContent、以及相邻片段缺空格时补一个空格 */
  function svgCandidates(t) {
    var plain = normalize(t.textContent || "");
    var parts = [];
    for (var c = t.firstChild; c; c = c.nextSibling) {
      if (c.nodeType === 3) parts.push(c.nodeValue);
      else if (c.nodeType === 1) parts.push(c.textContent || "");
    }
    var spaced = "";
    for (var i = 0; i < parts.length; i++) {
      var seg = parts[i];
      if (!seg) continue;
      if (spaced && !/\s$/.test(spaced) && !/^\s/.test(seg)) spaced += " ";
      spaced += seg;
    }
    spaced = normalize(spaced);
    return plain === spaced ? [plain] : [plain, spaced];
  }
  function handleSvgText(node) {
    var pe = node.parentElement;
    if (!pe || !pe.closest) return false;
    var t = null;
    try { t = pe.closest("text"); } catch (e) { return false; }
    if (!t) return false;
    if (svgDone.has(t)) return true;
    svgDone.add(t);
    // tspan 既可能在空格处断（"Bone " + "marrow"），也可能在词中间断（"Bone" + "marrow"），
    // 两种拼接都试一次，取命中的那个，避免出现 "Bonemarrow" 或 "骨marrow"。
    var cands = svgCandidates(t);
    var out = null, full = cands[0];
    for (var ci = 0; ci < cands.length; ci++) {
      if (!cands[ci] || hasCJK(cands[ci]) || !LETTER.test(cands[ci])) continue;
      var rci = translate(cands[ci]);
      if (rci !== null) { out = rci; full = cands[ci]; break; }
    }
    if (out === null) { recordMiss(full); return true; }
    var nodes = [];
    var w = doc.createTreeWalker(t, 4, null, false);
    var n;
    while ((n = w.nextNode())) nodes.push(n);
    if (!nodes.length) return true;
    // 逐节点存原文：<text> 里可能有多个 tspan，还原时要各自回到原值，
    // 不能只存整段 textContent（那是元素级快照，text 节点上还原不到）。
    svgTexts.push({ nodes: nodes.map(function (x) { return x; }), vals: nodes.map(function (x) { return x.nodeValue; }) });
    nodes[0].nodeValue = out;
    for (var i = 1; i < nodes.length; i++) nodes[i].nodeValue = "";
    nodes.forEach(function (x) { processed.add(x); });
    stats.svg = (stats.svg || 0) + 1;
    return true;
  }

  /** <br> 拆开的标题（"The Housekeeping" + <br> + "Proteome"）：整段拼接后再查表 */
  var brDone = new WeakSet();
  function brJoinedText(el) {
    var parts = [];
    for (var c = el.firstChild; c; c = c.nextSibling) {
      if (c.nodeType === 3) parts.push(c.nodeValue);
      else if (c.nodeType === 1) {
        if (c.tagName === "BR") parts.push(" ");
        else parts.push(c.textContent || "");
      }
    }
    return normalize(parts.join(""));
  }
  /** 同一元素里的文本被站点拆成多个文本节点（cBioPortal 的 <h4>Horizontal\nAxis</h4>），
   *  整串比对才命得中词表。只在元素没有子元素时动手，替换后按整块记录，disable 能还原。 */
  function handleSplitText(node) {
    var el = node.parentElement;
    if (!el || el.children.length || el.childNodes.length < 2) return false;
    if (skipNode(node) || inBlock(el) || inSkip(el)) return false;
    var parts = [], raw = "";
    for (var i = 0; i < el.childNodes.length; i++) {
      var c = el.childNodes[i];
      if (c.nodeType !== 3) return false;
      raw += c.nodeValue || "";
      var t = String(c.nodeValue || "").trim();
      if (t) parts.push(t);
    }
    if (parts.length < 2) return false;
    var full = parts.join(" ");
    var flat = raw.replace(/\s+/g, " ").trim();
    if (full.length < 3 || full.length > 120) return false;
    if (hasCJK(full) || !LETTER.test(full)) return false;
    // 长句只在整条命中词表时才拼（脚注被站点拆成「¹ 」+ 句子两段）；
    // 短标签仍允许走规则，避免长正文靠规则拼出半中半英。
    var out = lookupExact(full);
    if (out === null && flat !== full) out = lookupExact(flat);
    if (out === null && full.length <= 60) {
      out = translate(full);
      if (out === null && flat !== full) out = translate(flat);
    }
    if (out === null) return false;
    if (!blockOriginals.has(el)) blockOriginals.set(el, Array.prototype.slice.call(el.childNodes));
    try { el.setAttribute("data-biol10n-block", "1"); } catch (e) { /* ignore */ }
    while (el.firstChild) el.removeChild(el.firstChild);
    el.appendChild(doc.createTextNode(out));
    stats.split = (stats.split || 0) + 1;
    return true;
  }

  function handleBrJoin(node) {
    var el = node.parentElement;
    if (!el || !el.querySelector || !el.querySelector("br")) return false;
    if (brDone.has(el)) return false;
    var full = brJoinedText(el);
    if (!full || full.length > 120 || hasCJK(full) || !LETTER.test(full)) return false;
    var out = translate(full);
    if (out === null) return false;
    // 只有拼接成功才记账：早期版本在查表前就 brDone.add，拼接失败的元素后半段
    // 会被 brDone 永久跳过（HPA 的 Total<br>elevated → 「总计elevated」）
    // 容器里若还有输入框/按钮/链接这类活控件，绝不能 textContent 覆盖（HPA 的
    // 「Interacting gene (ensg_id)<br><input>」会把 <input> 一起删掉，且关脚本也回不来）。
    var kids = el.children, guardTag = 0;
    for (var k = 0; k < kids.length; k++) {
      if (!/^(BR|SPAN|B|I|EM|STRONG|SMALL|SUP|SUB)$/.test(kids[k].tagName)) { guardTag = 1; break; }
    }
    if (guardTag) return false;
    brDone.add(el);
    if (!blockOriginals.has(el)) blockOriginals.set(el, Array.prototype.slice.call(el.childNodes));
    try { el.setAttribute("data-biol10n-block", "1"); } catch (e) { /* ignore */ }
    while (el.firstChild) el.removeChild(el.firstChild);
    el.appendChild(doc.createTextNode(out));
    stats.br = (stats.br || 0) + 1;
    return true;
  }

  /**
   * 收尾规范化：跨元素的空白与重复标点。
   * 站点的 DOM 常是「中文 空白 元素 空白 中文」（表达中位数：<span>肿瘤</span> 和\n   <span>正常</span>），
   * 单节点翻译时两侧还没变中文，裁不掉；这里在每次扫描末尾按邻居再看一遍。
   */
  /** 同一块容器内、这个节点之前的最后一段文本（跨内联元素拼接，用于判断括号配对） */
  function beforeText(n, limit) {
    var el = n.parentElement, out = "", guard = 0;
    if (!el) return out;
    try { el = el.closest("p, div, li, td, th, h1, h2, h3, h4, span") || el; } catch (e) { /* ignore */ }
    var w = doc.createTreeWalker(el, 4, null, false), cur;
    while ((cur = w.nextNode())) {
      if (cur === n) break;
      out += cur.nodeValue || "";
    }
    return out.slice(-(limit || 200));
  }

  /** 被 <a>/<span> 切开的括号：前半句已经是全角「（」，后半截却以半角 ) 开头，
   *  cBioPortal 的「全部样本（1084 样本/患者) - TP53」就是这种。配对不上时补成全角。 */
  function fixUnpairedParen(n) {
    var v = String(n.nodeValue || "");
    if (!/^\s*[)\]]/.test(v)) return;
    var prev = beforeText(n);
    var open = Math.max(prev.lastIndexOf("（"), prev.lastIndexOf("［"));
    if (open < 0) return;
    var close = Math.max(prev.lastIndexOf("）"), prev.lastIndexOf("］"));
    if (close > open) return;
    var lead = v.match(/^\s*/)[0];
    var body = v.slice(lead.length);
    var fixed = lead + body.replace(/^([)\]])/, function (m) { return m === ")" ? "）" : "］"; });
    if (fixed === v) return;
    if (!originals.has(n)) originals.set(n, v);
    n.nodeValue = fixed;
  }

  function cleanupPass(root) {
    if (!root || !root.querySelectorAll) return;
    var w = doc.createTreeWalker(root, 4, null, false), n;
    while ((n = w.nextNode())) {
      var v = String(n.nodeValue || "");
      if (!v) continue;
      fixUnpairedParen(n);
      v = String(n.nodeValue || "");
      if (/^\s+$/.test(v)) {
        // 纯空白节点：两侧都是中文就清空
        var pc = neighborChar(n, -1), nc = neighborChar(n, 1);
        if (/[\u3400-\u9fff，。、；：！？）]$/.test(pc) && /^[\u3400-\u9fff（]/.test(nc)) {
          if (!originals.has(n)) originals.set(n, v);
          n.nodeValue = "";
        }
        continue;
      }
      // 重复句末标点先查：这一节只有标点、而前文已经以同一个中文标点结尾就清空
      if (/^[。．.！？]\s*$/.test(v)) {
        var before = neighborChar(n, -1);
        if (/[。！？]/.test(before)) {
          if (!originals.has(n)) originals.set(n, v);
          n.nodeValue = "";
        }
        continue;
      }
      var lead = v.match(/^\s+/), trail = v.match(/\s+$/);
      if (!lead && !trail) continue;
      var changed = v;
      if (lead && /[\u3400-\u9fff，。、；：！？）]$/.test(neighborChar(n, -1)) && /^[\u3400-\u9fff（「【]/.test(changed.replace(/^\s+/, ""))) {
        changed = changed.replace(/^\s+/, "");
      }
      if (trail && /^[\u3400-\u9fff（]/.test(neighborChar(n, 1)) && /[\u3400-\u9fff，。、；：！？]$/.test(changed.replace(/\s+$/, ""))) {
        changed = changed.replace(/\s+$/, "");
      }
      if (changed !== v) {
        if (!originals.has(n)) originals.set(n, v);
        n.nodeValue = changed;
      }
    }
  }

  /** 跳过纯空白节点，取这一侧第一个有内容的字符（元素取 textContent） */
  function neighborChar(node, dir) {
    // 注意：不能用 node[dir]/-1 取前一节点，DOM 没有负索引，这样取永远是 undefined
    var step = function (x) { return dir < 0 ? x.previousSibling : x.nextSibling; };
    var n = step(node);
    var guard = 0;
    while (n && guard++ < 6) {
      if (n.nodeType === 3) {
        var t = String(n.nodeValue || "");
        if (t.trim()) return dir < 0 ? t.trim().slice(-1) : t.trim().charAt(0);
      } else if (n.nodeType === 1) {
        var et = String(n.textContent || "").trim();
        if (et) return dir < 0 ? et.slice(-1) : et.charAt(0);
      }
      n = step(n);
    }
    return "";
  }

  /** 把相邻的纯空白文本节点清空（只在"另一侧也是中文"时做，数字/英文旁边保留空格） */
  function blankSibling(node, dir) {
    var ch = neighborChar(node, dir);
    var want = dir < 0 ? /[\u3400-\u9fff，。、；：！？）]$/.test(ch) : /^[\u3400-\u9fff（]/.test(ch);
    if (!want) return;
    var n = dir < 0 ? node.previousSibling : node.nextSibling;
    var guard = 0;
    while (n && n.nodeType === 3 && guard++ < 3) {
      if (String(n.nodeValue || "").trim() !== "") return;
      if (!originals.has(n)) originals.set(n, n.nodeValue);
      n.nodeValue = "";
      n = dir < 0 ? n.previousSibling : n.nextSibling;
    }
  }

  function handleAttributes(el) {
    if (!enabled || !el || !el.getAttribute) return;
    for (var i = 0; i < attrs.length; i++) {
      var name = attrs[i];
      // value 只翻"可见按钮"和"文本框默认值"：
      // <option value>、<button value>、<li value> 是提交参数，翻了就会把表单值改成中文（PubMed format=摘要 直接报错、NCBI db=组装 404）
      if (name === "value") {
        if (el.tagName !== "INPUT") continue;
        var t = (el.type || "text").toLowerCase();
        var isButton = /^(submit|button|reset)$/.test(t);
        var isText = /^(text|search|email|url|tel|)$/.test(t);
        if (isButton) { /* 按钮可见文字，翻 */ }
        else if (isText && site.valueText && el !== doc.activeElement) { /* 站点声明了才翻默认值 */ }
        else continue;
      }
      var v = el.getAttribute(name);
      // 有些站点的默认文字是 el.value = "..." 写进去的（只有 JS 属性，没有 value 属性）
      var fromProp = false;
      if (!v && name === "value" && el.tagName === "INPUT") {
        v = el.value;
        fromProp = !!v;
      }
      if (!v) continue;
      var text = normalize(v);
      if (text.length < 2 || hasCJK(text) || !LETTER.test(text)) continue;
      // 属性是"控件说明"不是内容：textarea 的 placeholder、代码块的 title 都该翻，
      // 所以这里只跳代码/脚本类祖先，不看 BLOCK
      // SVG 里的 aria-label/title 是可读标签（GDC 首页 "Adrenal Gland, 774 cases"），单独放行：
      // skipNode 对 SVG 只放行 <text>/<tspan> 文本节点，属性路径会被整体跳过。
      var inSvg = false;
      try { inSvg = !!(el.closest && el.closest("svg")); } catch (e) { inSvg = false; }
      // 属性是界面提示（title/aria-label），即使元素标了 translate="no" 也该翻
      if (!inSvg && skipNode(el, true)) continue;
      var out = translate(text);
      if (out === null) continue;
      if (fromProp) {
        if (!propOriginals.has(el)) propOriginals.set(el, v);
        el.value = out;
        stats.attrs++;
        continue;
      }
      var store = originals.get(el);
      if (!store) { store = {}; originals.set(el, store); }
      if (!(name in store)) store[name] = v;
      el.setAttribute(name, out);
      stats.attrs++;
    }
  }

  function walk(root) {
    if (!root) return;
    if (root.nodeType === 3) { handleTextNode(root); return; }
    if (root.nodeType !== 1 && root.nodeType !== 9 && root.nodeType !== 11) return;
    if (root.nodeType === 1) {
      handleAttributes(root);
      var sub = root.querySelectorAll ? root.querySelectorAll("*") : [];
      for (var i = 0; i < sub.length; i++) handleAttributes(sub[i]);
    }
    var walker = doc.createTreeWalker(root, 4 /* SHOW_TEXT */, null, false);
    var batch = [];
    var n;
    while ((n = walker.nextNode())) batch.push(n);
    for (var k = 0; k < batch.length; k++) handleTextNode(batch[k]);
  }

  function scopeRoots() {
    var sel = site.scope;
    if (!sel) return [doc.body];
    var roots = [];
    try {
      doc.querySelectorAll(sel).forEach(function (el) { roots.push(el); });
    } catch (e) { /* 选择器写错就当全域 */ }
    return roots.length ? roots : [doc.body];
  }

  // 整块替换：给被拆成逐字母 span / 被内嵌链接切碎的块用（词条打不中时）
  function applyBlocks() {
    var list = site.blocks;
    if (!list || !list.length) return;
    for (var i = 0; i < list.length; i++) {
      var b = list[i];
      var els;
      try { els = doc.querySelectorAll(b.sel); } catch (e) { continue; }
      for (var j = 0; j < els.length; j++) {
        var el = els[j];
        var cur = String(el.textContent || "").replace(/\s+/g, " ").trim();
        if (cur === b.text) continue;
        // 选择器可能命中多个同结构的块（首页三张卡片都是 div.col-12.col-lg-3 > p），
        // 用 match 限定只替换内容里含这个特征的块，避免把别的块写成同一段话。
        if (b.match && cur.indexOf(b.match) < 0) continue;
        // 先把原始子节点摘下来存着，disable 时原样挂回去（保留链接与事件）
        if (!blockOriginals.has(el)) {
          blockOriginals.set(el, Array.prototype.slice.call(el.childNodes));
        }
        while (el.firstChild) el.removeChild(el.firstChild);
        el.appendChild(doc.createTextNode(b.text));
        // 标记：整块替换过的元素，其子节点不再参与漫游翻译
        //（否则 option 文本会被压回英文后又被词条翻成中文，来回打架）
        try { el.setAttribute("data-biol10n-block", "1"); } catch (e) { /* ignore */ }
        stats.blocks = (stats.blocks || 0) + 1;
      }
    }
  }

  /** 调试：解释某个文本节点为什么没被翻（不改变 DOM）。 */
  function debugWhy(node) {
    if (!node || node.nodeType !== 3) return { error: "not a text node" };
    var raw = node.nodeValue, text = normalize(raw);
    var r = {
      raw: String(raw).slice(0, 60), text: String(text).slice(0, 60),
      processed: processed.has(node), connected: node.isConnected !== false,
      cjk: hasCJK(text), letter: LETTER.test(text), len: text.length,
      skip: skipNode(node), block: inBlock(node.parentElement), inSkip: inSkip(node.parentElement),
      prose: inLongProse(node.parentElement),
      exact: lookupExact(text), parent: node.parentElement ? node.parentElement.tagName + "." + (node.parentElement.className || "") : null,
      split: node.parentElement ? node.parentElement.children.length : null, kids: node.parentElement ? node.parentElement.childNodes.length : null
    };
    return r;
  }

  function scan() {
    if (!enabled) return;
    applyBlocks();
    var roots = scopeRoots();
    for (var i = 0; i < roots.length; i++) walk(roots[i]);
    for (var j = 0; j < roots.length; j++) cleanupPass(roots[j]);
    // SPA 站路由后 React 会重写 <title>；任何一次重扫都顺带校正标题
    translateTitle();
  }

  function flush() {
    timer = null;
    if (!enabled) return;
    var items = Array.from(queue);
    queue.clear();
    items.forEach(function (n) {
      if (!n.isConnected && n !== doc) return;
      walk(n.nodeType === 1 ? n : n.parentNode);
    });
  }

  function schedule(node) {
    queue.add(node);
    if (!queue.size) return;
    var run = function () { if (!timer) timer = setTimeout(flush, 200); };
    if (win.requestIdleCallback) win.requestIdleCallback(run, { timeout: 500 });
    else run();
  }

  function startObserver() {
    if (observer || !win.MutationObserver) return;
    observer = new win.MutationObserver(function (records) {
      for (var i = 0; i < records.length; i++) {
        var r = records[i];
        if (r.type === "childList") {
          for (var j = 0; j < r.addedNodes.length; j++) {
            var n = r.addedNodes[j];
            if (n.nodeType === 1 || n.nodeType === 3) schedule(n.parentNode || n);
          }
        } else if (r.type === "characterData") {
          // 页面把同一个文本节点的内容重写了（React 过滤/搜索后回填英文），
          // 节点还是那个节点，WeakSet 会一直拦着它。先放回待处理队列。
          processed.delete(r.target);
          schedule(r.target);
        } else if (r.type === "attributes") {
          schedule(r.target);
        }
      }
    });
    observer.observe(doc.documentElement, {
      childList: true, subtree: true, characterData: true,
      attributes: true, attributeFilter: attrs
    });
  }

  function startRouteHooks() {
    var hist = win.history;
    if (!hist || hist.__biol10n) return;
    hist.__biol10n = true;
    ["pushState", "replaceState"].forEach(function (m) {
      var orig = hist[m];
      if (!orig) return;
      hist[m] = function () {
        var ret = orig.apply(this, arguments);
        setTimeout(function () { scan(); translateTitle(); }, 400);
        return ret;
      };
    });
    win.addEventListener("popstate", function () { setTimeout(function () { scan(); translateTitle(); }, 400); });
  }

  function restore() {
    // 先还原整块：块里原来挂着子节点（<b>/<br>/<a>），挂回去之后它们才会被下面的文本遍历看见
    doc.querySelectorAll("[data-biol10n-block]").forEach(function (el) {
      var kids = blockOriginals.get(el);
      if (kids) {
        while (el.firstChild) el.removeChild(el.firstChild);
        for (var i = 0; i < kids.length; i++) el.appendChild(kids[i]);
      }
      try { el.removeAttribute("data-biol10n-block"); } catch (e) { /* ignore */ }
    });
    var nodes = [];
    var w = doc.createTreeWalker(doc.body, 4, null, false), n;
    while ((n = w.nextNode())) if (originals.has(n)) nodes.push(n);
    nodes.forEach(function (x) { x.nodeValue = originals.get(x); });
    // SVG <text>：把每个 tspan 文本节点写回原文
    svgTexts.forEach(function (rec) {
      for (var i = 0; i < rec.nodes.length; i++) {
        if (rec.nodes[i] && rec.nodes[i].isConnected !== false) rec.nodes[i].nodeValue = rec.vals[i];
      }
    });
    doc.querySelectorAll("*").forEach(function (el) {
      var prop = propOriginals.get(el);
      if (prop !== undefined) el.value = prop;
      var store = originals.get(el);
      if (!store) return;
      Object.keys(store).forEach(function (a) { el.setAttribute(a, store[a]); });
    });
  }

  // SPA 站（Ensembl/GDC/cBioPortal）站内跳转后 React 会把 <title> 写回英文，
  // 早期版本只在首次翻一次（origTitle !== null 就 return），路由后标题永远是英文。
  // 现在记住"我们写进去的那一版"，只要标题变了就重新翻。
  var origTitle = null;
  var translatedTitle = null;
  function translateTitle() {
    if (!enabled) return;
    var t = doc.title;
    if (!t) return;
    if (translatedTitle !== null && t === translatedTitle) return;
    var v = lookupExact(t);
    if (v === null) v = translate(t);
    if (v === null) return;
    origTitle = t;
    translatedTitle = v;
    doc.title = v;
  }

  function enable() {
    if (enabled) return;
    enabled = true;
    stats.enabled = true;
    // 关掉再开：restore() 把原文写回去过，processed/originals 里还留着上一轮的记录，
    // 不清空的话 scan() 会被 processed.has(node) 整片早退（实测 GTEx 开关后 8/8 仍是英文）。
    processed = new WeakSet();
    brDone = new WeakSet();
    svgDone = new WeakSet();
    try { observer && observer.disconnect(); } catch (e) {}
    observer = null;
    startObserver();
    scan();
    translateTitle();
  }
  function disable() {
    enabled = false;
    stats.enabled = false;
    try { observer && observer.disconnect(); } catch (e) {}
    if (timer) clearTimeout(timer);
    restore();
    // SPA 可能在中间又改写过 <title>（GDC 的首页就是这样），导致 doc.title 不再等于
    // translatedTitle；只要当前标题还是中文，就说明它仍是我们写的，照原样还回去。
    if (origTitle !== null && (doc.title === translatedTitle || CJK.test(doc.title))) doc.title = origTitle;
    origTitle = null;
    translatedTitle = null;
    svgTexts = [];
  }

  function start() {
    scan();
    translateTitle();
    startObserver();
    startRouteHooks();
    if (site.spa && site.waitFor) {
      var tries = 0;
      var iv = setInterval(function () {
        if (doc.querySelector(site.waitFor) || ++tries > 40) { clearInterval(iv); scan(); }
      }, 250);
    }
    // 延迟补扫：很多站点的横幅、计数器、下载菜单是异步注入的，
    // 注入时刻晚于 MutationObserver 首次绑定，容易漏掉（实测 GDS 的 Download data 3/6 次漏翻）。
    var rescan = site.rescan;
    if (rescan !== false) {
      var delays = Array.isArray(rescan) ? rescan : [3000, 8000, 15000];
      delays.forEach(function (ms) {
        setTimeout(function () { if (enabled) { scan(); translateTitle(); } }, ms);
      });
    }
  }

  return {
    start: start, scan: scan, enable: enable, disable: disable,
    /** 干跑：只返回译文，不写 DOM，供覆盖率统计与词表调试使用 */
    translateText: function (s) { return translate(normalize(s)); },
    debugWhy: debugWhy,
    stats: stats,
    misses: function () { return Array.from(misses); },
    restore: restore
  };
}
