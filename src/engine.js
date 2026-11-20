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
    TEXTAREA: 1, SVG: 1, MATH: 1,
    // <title> 只走 translateTitle 一条路：让文本漫游再翻一遍，rules 会把
    // "breast cancer - GEO DataSets - NCBI" 局部替换成半中半英（检查方 P0-3）。
    TITLE: 1
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

  // 模板通道：段落被 <a>/<code>/<em> 切成片段时，逐节点翻会半中半英、整段替换会丢链接。
  // 词条存成带 {{n}} 占位符的模板，运行时按占位符把原来的内联元素放回新译文里，链接与事件都保留。
  var INLINE_TAGS = {
    A: 1, ABBR: 1, B: 1, BDI: 1, BDO: 1, BR: 1, CITE: 1, CODE: 1, DATA: 1, DEL: 1, DFN: 1,
    EM: 1, I: 1, INS: 1, KBD: 1, MARK: 1, Q: 1, S: 1, SAMP: 1, SMALL: 1, SPAN: 1,
    FONT: 1, STRONG: 1, SUB: 1, SUP: 1, TIME: 1, U: 1, VAR: 1, WBR: 1
  };
  var tplMap = new Map();
  (data.templates || []).forEach(function (t) {
    if (!t || typeof t.pat !== "string" || typeof t.zh !== "string") return;
    var key = normalize(t.pat);
    if (!key || !hasCJK(t.zh)) return;
    tplMap.set(key, t.zh);
  });

  // 站级 attrs 是追加，不是覆盖：覆盖会让站点漏掉 title/aria-label 之外的默认通道。
  var attrs = DEFAULT_ATTRS.slice();
  if (site.attrs && site.attrs.length) {
    for (var ai = 0; ai < site.attrs.length; ai++) {
      if (attrs.indexOf(site.attrs[ai]) < 0) attrs.push(site.attrs[ai]);
    }
  }
  var processed = new WeakSet();
  var originals = new WeakMap();
  var propOriginals = new WeakMap(); // 通过 el.value 写入的默认文字
  var blockOriginals = new WeakMap(); // 整块替换时摘下的原始子节点（disable 时要挂回去）
  var svgTexts = []; // SVG <text> 的逐节点原文（元素不在文本节点还原范围内，单独记）
  var misses = new Set();
  // enabled 放在 stats 上而不是只做闭包变量：boot 的 toggle 靠它判断该开还是该关
  var stats = { nodes: 0, hitExact: 0, hitRule: 0, attrs: 0, skipped: 0, tpl: 0, enabled: true };
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

  /** 规则替换会把任意 "X: Y" 的冒号换成全角，连 "09:15" 里的时间冒号也一起吃掉
   *  （cBio 的 ^(.+): (.+)$ 命中 "Time: 09:15" 后，$2 又被 ^(.+):\s*([\d,]+)$ 咬掉）。
   *  做法：进规则前把 数字:数字 的冒号临时换成占位符，出规则再还原。 */
  var TIME_COLON = "\u0001";
  function maskTimeColons(s) { return s.replace(/(\d):(\d)/g, "$1" + TIME_COLON + "$2"); }
  function unmaskTimeColons(s) { return s.indexOf(TIME_COLON) < 0 ? s : s.split(TIME_COLON).join(":"); }

  function translate(s, depth) {
    var masked = /\d:\d/.test(s);
    var out = translateRules(masked ? maskTimeColons(s) : s, depth || 0);
    return masked && out !== null ? unmaskTimeColons(out) : out;
  }

  // 命中计数按通道分开：属性与 title 也会走 translate()，混在一个 hitExact 里会出现
  // 「hitExact 大于 nodes」（nodes 只统计文本通道），看报告时无法判断到底哪一类在涨。
  var hitChannel = "text";
  function bumpHit(rule) {
    if (hitChannel === "attr") { if (rule) stats.attrRule = (stats.attrRule || 0) + 1; else stats.attrHit = (stats.attrHit || 0) + 1; }
    else if (hitChannel === "title") { if (rule) stats.titleRule = (stats.titleRule || 0) + 1; else stats.titleHit = (stats.titleHit || 0) + 1; }
    else if (rule) stats.hitRule++; else stats.hitExact++;
  }

  function translateRules(s, depth) {
    var hitOnce = lookupExact(s);
    if (hitOnce !== null) { bumpHit(false); return hitOnce; }
    for (var j = 0; j < rules.length; j++) {
      var m = rules[j].re.exec(s);
      if (m) {
        if (rules[j].requireHit) {
          // 带字母的捕获组必须全部命中，否则整条放弃：
          // 只要求任一命中，会把「上皮细胞（ALVEOLAR TYPE I）」拼成半中半英。
          // 纯数字/标点的捕获组（$2 = 499）不参与这条判断。
          var anyHit = false, allOk = true;
          for (var k = 1; k < m.length; k++) {
            var segK = m[k];
            if (segK === undefined) continue;
            // 站点模板拼出来的残句（"instead of undefined"）整条放弃，翻出来只会更怪。
            if (/^(undefined|null|NaN)$/i.test(segK.trim())) { allOk = false; break; }
            if (translateCapture(segK, depth) !== segK) { anyHit = true; continue; }
            if (!/[A-Za-z]/.test(segK)) continue;           // 纯数字/标点不参与
            // 单个大写标识（TCGA、GSE331160、H3C2）算"不必翻"，不能算没命中；
            // 但带空格的大写短语（ALVEOLAR TYPE I）仍要挡住，否则又出「上皮细胞（ALVEOLAR TYPE I）」。
            // 括号模板（$1（$2））例外：GTEx 的「Endothelial cells (LYMPHATIC)」里 $2 是
            // 纯字母大写词，不是标识，放行会拼出「内皮细胞（LYMPHATIC）」。
            if (/^[A-Z]{4,}$/.test(segK.trim()) && /[（）]/.test(rules[j].to)) { allOk = false; break; }
            if (/^[A-Za-z0-9][A-Za-z0-9._\-\/]{0,11}$/.test(segK.trim())) continue;
            allOk = false;
          }
          if (!anyHit || !allOk) continue;
        }
        bumpHit(true);
        var to = rules[j].to;
        return to.replace(/\$(\d)/g, function (_, d) {
          var seg = m[Number(d)];
          return seg === undefined ? "" : translateCapture(seg, depth);
        });
      }
    }
    return null;
  }

  function recordMiss(text, node, isProse) {
    stats.miss = (stats.miss || 0) + 1;
    if (typeof onMiss === "function") {
      var el = node && node.nodeType === 3 ? node.parentElement : node;
      try {
        var skipLog = false;
        if (site.logSkip && el && el.closest) { try { skipLog = !!el.closest(site.logSkip); } catch (e2) {} }
        onMiss(text, {
          prose: !!isProse,
          skipLog: skipLog,
          tag: el && el.tagName ? el.tagName : "",
          cls: el && typeof el.className === "string" ? el.className.slice(0, 80) : ""
        });
      } catch (e) { /* 记录失败不影响翻译 */ }
    }
    if (!isProse && misses.size < 200 && text.length <= 80 && LETTER.test(text)) misses.add(text);
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
      // 设置面板自己的文字（BioL10n 等英文标签）永远不参与翻译
      if (p.hasAttribute && p.hasAttribute("data-biol10n-ui")) return true;
      if (p.hasAttribute && p.hasAttribute("data-biol10n-block")) return true;
      // 页面/用户自己标注的数据区：<div data-biol10n-skip> 里的内容一律不翻。
      // 给「数据集名、专有名词、动态渲染的列表」留一个不依赖站点配置的出口。
      if (p.hasAttribute && p.hasAttribute("data-biol10n-skip")) return true;
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

  var proseLenCache = new WeakMap();
  var cjkCache = new WeakMap();

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
    // 同一个块容器在一次扫描里会被成百上千个文本节点问到；textContent 会拼接整棵子树，
    // 不缓存的话大页面上是 O(n²)（PubMed 帮助页能到 2–5 秒）。长度只用于阈值判断，缓存安全。
    var blockText = proseLenCache.get(p);
    if (blockText === undefined) {
      blockText = String(p.textContent || "");
      proseLenCache.set(p, blockText);
    }
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
      // 结果列表里的「more...」是链接的标签文字（GEO 搜索结果 18 处），不是句子成分。
      // 只放行以省略号结尾的链接标签：正文里「… browser. Contact Us」这种链接必须继续挡，
      // 否则一句英文里会冒出「联系我们」。
      try { if (el.closest("a") && /(\.\.\.|…)$/.test(own)) return false; } catch (e) { /* ignore */ }
      // 页脚/图注里的短标签（Web Policies、Careers、Data source）是导航不是正文，
      // 整条命中词表就翻；页脚里的长句仍按正文处理。
      try { if (el.closest("footer, figcaption, .copyright") && own.length <= 40 && lookupExact(own) !== null) return false; } catch (e) { /* ignore */ }
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
    // 时间 / 比例里的冒号绝不能全角化：DOM 若把 "09:15" 拆成 09 + ":" + 15，
    // 前面的"时间"已翻成中文、下面的数字跳过逻辑又会回看到上一步刚换的"："
    // 判成中文语境，于是 "09:15" 变成 "09：15"（检查方回归用例 1）。
    // 邻居要把元素也算进来：<span>09</span>:<span>15</span> 两侧都是元素，
    // 只看文本兄弟节点会拿到空串，守卫就失效了。
    if (raw === ":") {
      var pAny = "", nAny = "";
      for (var pa = node.previousSibling; pa; pa = pa.previousSibling) {
        var ps = pa.nodeType === 3 ? String(pa.nodeValue || "").trim() : String(pa.textContent || "").trim();
        if (ps) { pAny = ps; break; }
      }
      for (var na = node.nextSibling; na; na = na.nextSibling) {
        var ns = na.nodeType === 3 ? String(na.nodeValue || "").trim() : String(na.textContent || "").trim();
        if (ns) { nAny = ns; break; }
      }
      if (/\d$/.test(pAny) && /^\d/.test(nAny)) return;
    }
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
    // 但词库里明确收录的整段（帮助页、FAQ、首页简介）是人工核对过的译文，
    // 命中就照翻——否则这些"固定说明句"永远进不来。查表用 count=false，避免命中数翻倍。
    if (inLongProse(node.parentElement)) {
      // 只放行"整句/整段"级别的命中（>= 40 字符）。英文句子里的短链接（"… browser. Contact Us"）
      // 即使词典里有 Contact Us，也不能在一句英文中间冒出一小块中文。
      if (text.length < 40 || lookupExact(text) === null) { recordMiss(text, node, true); return; }
    }

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
    if (out === null) {
      recordMiss(full);
      // 整段没命中时按 tspan 兜底：只翻首尾无空格的完整词，
      // 避免把 Bone + marrow 这种跨节点断词翻成半个。
      // UCSC 网关的物种树是 <text><tspan>Human</tspan><tspan>Homo sapiens</tspan></text>，
      // 整段 HumanHomo sapiens 不可能命中，但 Human 本身有词条。
      try {
        var w2 = doc.createTreeWalker(t, 4, null, false);
        var kid;
        while ((kid = w2.nextNode())) {
          var rawv = String(kid.nodeValue || "");
          var trv = rawv.trim();
          if (!trv || trv !== rawv || /\s/.test(trv) || !LETTER.test(trv) || hasCJK(trv)) continue;
          var vv = translate(trv);
          if (vv === null) continue;
          if (!originals.has(kid)) originals.set(kid, rawv);
          kid.nodeValue = vv;
          processed.add(kid);
          stats.svg = (stats.svg || 0) + 1;
        }
      } catch (e2) { /* 兜底失败不影响其它节点 */ }
      return true;
    }
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
    if (!el || el.childNodes.length < 2) return false;
    if (skipNode(node) || inBlock(el) || inSkip(el)) return false;
    // 子元素全是内联标签时也拼（UALCAN 的校名被 <font> 切成 6 段、PubMed 的
    // <span>09</span>:<span>15</span>）；<a> 与表单控件不在此列——把链接/input 拍平成文本
    // 等于拆掉站点的可点区域，而且关脚本也回不来。
    var parts = [], raw = "";
    for (var i = 0; i < el.childNodes.length; i++) {
      var c = el.childNodes[i];
      if (c.nodeType === 3) {
        raw += c.nodeValue || "";
        var t = String(c.nodeValue || "").trim();
        if (t) parts.push(t);
        continue;
      }
      if (c.nodeType !== 1) return false;
      if (!INLINE_TAGS[c.tagName] || /^(A|INPUT|BUTTON|SELECT|TEXTAREA|IMG|SVG)$/.test(c.tagName)) return false;
      var ct = String(c.textContent || "");
      raw += ct;
      var tt = ct.trim();
      if (tt) parts.push(tt);
    }
    if (parts.length < 2) return false;
    // 拼接时不能一律补空格：UALCAN 的标题被 <font> 从单词中间切开
    //（"The " + <font>U</font> + "niversity of " …），补空格会变成 "U niversity"。
    // 所以先用原样拼接（空白归一）当主候选，查不到再退到「逐段加空格」的旧拼法（cBio 的换行分段）。
    var flat = raw.replace(/\s+/g, " ").trim();
    var full = parts.join(" ");
    var alt = flat !== full ? full : null;
    full = flat;
    if (full.length < 3 || full.length > 120) return false;
    if (hasCJK(full) || !LETTER.test(full)) return false;
    // 长句只在整条命中词表时才拼（脚注被站点拆成「¹ 」+ 句子两段）；
    // 短标签仍允许走规则，避免长正文靠规则拼出半中半英。
    var out = lookupExact(full);
    if (out === null && alt !== null) out = lookupExact(alt);
    if (out === null && full.length <= 60) {
      out = translate(full);
      if (out === null && alt !== null) out = translate(alt);
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
    if (!el) return false;
    // 只看直接子节点里的 <br>：以前用 el.querySelector("br")，节点在带 <br> 的大容器里时
    // 每次都要扫整棵子树，PubMed 帮助页这种长文档上是 O(n²)。
    var hasBr = false;
    for (var bc = el.firstChild; bc; bc = bc.nextSibling) {
      if (bc.nodeType === 1 && bc.tagName === "BR") { hasBr = true; break; }
    }
    if (!hasBr) return false;
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
      if (!/^(BR|SPAN|B|I|EM|STRONG|SMALL|SUP|SUB|FONT|U)$/.test(kids[k].tagName)) { guardTag = 1; break; }
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

  /** 段落已经被整段译成中文后，里面残留的内联短词（链接、<strong> 标签）
   *  往往会因为"正文保护 + 本身太短"被跳过，留下半中半英。
   *  这里只处理"所在块已经是中文"的内联节点，且必须整条命中词表，避免误伤数据。 */
  function translateInlineInCJK(root) {
    if (!root || !root.querySelectorAll) return;
    var w = doc.createTreeWalker(root, 4, null, false), n;
    while ((n = w.nextNode())) {
      if (!n.isConnected) continue;
      var raw = n.nodeValue;
      if (!raw) continue;
      var text = normalize(raw);
      if (text.length < 2 || text.length > 60 || hasCJK(text) || !LETTER.test(text)) continue;
      if (processed.has(n)) continue;
      var el = n.parentElement;
      if (!el || /^(SCRIPT|STYLE|NOSCRIPT|TEXTAREA|PRE|CODE)$/.test(el.tagName)) continue;
      var block = null;
      try { block = el.closest("p, li, dd, dt, td, th, figcaption"); } catch (e) { block = null; }
      if (!block) continue;
      var bcj = cjkCache.get(block);
      if (bcj === undefined) { bcj = hasCJK(block.textContent || ""); cjkCache.set(block, bcj); }
      if (!bcj) continue;
      if (skipNode(n) || inBlock(el) || inSkip(el)) continue;
      var v = lookupExact(text);
      if (v === null) continue;
      var m = /^(\s*)([\s\S]*?)(\s*)$/.exec(raw);
      if (!originals.has(n)) originals.set(n, raw);
      if (/^[\u3400-\u9fff]/.test(v)) blankSibling(n, "previousSibling");
      if (/[\u3400-\u9fff]$/.test(v)) blankSibling(n, "nextSibling");
      n.nodeValue = (m ? m[1] : "") + v + (m ? m[3] : "");
      processed.add(n);
      stats.inline = (stats.inline || 0) + 1;
    }
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
      if (lead && /[\u3400-\u9fff，。、；：！？）]$/.test(neighborChar(n, -1)) && /^[\u3400-\u9fff，。、；：！？）]/.test(changed.replace(/^\s+/, ""))) {
        changed = changed.replace(/^\s+/, "");
      }
      if (trail && /^[\u3400-\u9fff（，。、；：！？]/.test(neighborChar(n, 1)) && /[\u3400-\u9fff，。、；：！？]$/.test(changed.replace(/\s+$/, ""))) {
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
    var prev = hitChannel;
    hitChannel = "attr";
    try { handleAttributesInner(el); } finally { hitChannel = prev; }
  }

  function handleAttributesInner(el) {
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
      // 站点 skip 是"这一块整体别碰"：cBio 数据集名在 table.simple-table td:nth-child(1) 里，
      // 文本已经跳过了，但同一条 <a> 的 aria-label 之前还会被翻成中文（半中半英的元数据）。
      if (inSkip(el)) continue;
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
    var roots = [], zeros = [];
    // 逐个选择器统计：站点的 scope 里写了一个当前页根本不存在的选择器时（GDV 的
    // #universal_header / #gdv-root），页头页脚会整块漏翻而没有任何提示。
    // 这里把 0 命中的选择器记进 stats.scopeZero，配 tools/scope-check.mjs 一起看。
    try {
      var parts = String(sel).split(",");
      for (var i = 0; i < parts.length; i++) {
        var one = parts[i].trim();
        if (!one) continue;
        var n = 0;
        try { n = doc.querySelectorAll(one).length; } catch (e2) { zeros.push(one + "（非法）"); continue; }
        if (!n) { zeros.push(one); continue; }
        doc.querySelectorAll(one).forEach(function (el) { roots.push(el); });
      }
    } catch (e) { /* 站点 scope 整体坏掉时退回 body */ }
    if (zeros.length) stats.scopeZero = zeros;
    return roots.length ? roots : [doc.body];
  }

  /** 整段静态文案：被链接、加粗、<br> 切碎的段落，逐节点打不中词条，改用整段文本查表。
   *  只处理内部没有嵌套块的静态容器；命中后整块换成中文（与 applyBlocks 共用原文备份，disable 可还原）。 */
  function translateParagraphs(root) {
    if (!root || !root.querySelectorAll) return;
    var els;
    try { els = root.querySelectorAll("p, dd, li"); } catch (e) { return; }
    for (var i = 0; i < els.length; i++) {
      var el = els[i];
      if (el.getAttribute && el.getAttribute("data-biol10n-block")) continue;
      if (inBlock(el) || inSkip(el)) continue;
      if (el.querySelector("p, li, ul, ol, div, table, pre, code, textarea")) continue;
      // 列表项整段替换会连里面的链接一起抹掉，所以只收没有链接的 li
      if (el.tagName === "LI" && el.querySelector("a")) continue;
      var text = normalize(el.textContent || "");
      if (text.length < 100 || text.length > 1800 || hasCJK(text)) continue;
      var hit = lookupExact(text);
      if (hit === null || !hasCJK(hit)) continue;
      if (!blockOriginals.has(el)) {
        blockOriginals.set(el, Array.prototype.slice.call(el.childNodes));
      }
      while (el.firstChild) el.removeChild(el.firstChild);
      el.appendChild(doc.createTextNode(hit));
      try { el.setAttribute("data-biol10n-block", "1"); } catch (e) { /* ignore */ }
      stats.paras = (stats.paras || 0) + 1;
    }
  }

  /** 内联元素里再套内联（<a><em>x</em></a>）是安全的：整个外层节点当一个占位符搬回去即可。
   *  只有里面藏了块级元素才放弃——那说明这一段并不是一个可整块替换的句子。 */
  function isInlineSubtree(el) {
    var kids = el.children;
    if (!kids) return true;
    for (var i = 0; i < kids.length; i++) {
      var k = kids[i];
      if (!k.tagName || !INLINE_TAGS[k.tagName]) return false;
      if (!isInlineSubtree(k)) return false;
    }
    return true;
  }

  /** 把块拆成「文本片段 + 内联元素占位符」的模板串；只收纯内联结构，遇到嵌套块返回 null。 */
  function buildTemplate(el) {
    if (!el || !el.firstChild) return null;
    var parts = [], slots = [];
    for (var c = el.firstChild; c; c = c.nextSibling) {
      if (c.nodeType === 3) { parts.push(String(c.nodeValue || "")); continue; }
      if (c.nodeType !== 1) return null;
      var tn = c.tagName;
      if (!tn || !INLINE_TAGS[tn]) return null;
      // <a><em>x</em></a> 允许（整节点当一个槽位）；<a><div>…</div></a> 拒绝
      if (tn !== "BR" && !isInlineSubtree(c)) return null;
      slots.push(c);
      parts.push("{{" + slots.length + "}}");
    }
    if (!slots.length) return null;
    var pat = normalize(parts.join(""));
    if (!pat || hasCJK(pat)) return null;
    if (pat.length < 20 || pat.length > 2200) return null;
    return { pat: pat, slots: slots };
  }

  /** 模板通道：整段命中带占位符的模板后，把 {{n}} 换成原来的内联元素，其余换成译文文本。
   *  占位符必须是 1..N 的一一对应，否则不替换（宁可留英文，也不丢链接）。 */
  function translateTemplates(root) {
    if (!root || !root.querySelectorAll || !tplMap.size) return;
    var els;
    try { els = root.querySelectorAll("p, dd, li"); } catch (e) { return; }
    for (var i = 0; i < els.length; i++) {
      var el = els[i];
      if (el.getAttribute && (el.getAttribute("data-biol10n-tpl") || el.getAttribute("data-biol10n-block"))) continue;
      if (inBlock(el) || inSkip(el)) continue;
      if (el.querySelector("p, li, ul, ol, div, table, pre, textarea")) continue;
      var t = buildTemplate(el);
      if (!t) continue;
      var zh = tplMap.get(t.pat);
      if (!zh) continue;
      var used = [], m, re = /\{\{(\d+)\}\}/g;
      while ((m = re.exec(zh))) used.push(Number(m[1]));
      if (used.length !== t.slots.length) continue;
      var sorted = used.slice().sort(function (a, b) { return a - b; });
      var ok = true;
      for (var u = 0; u < sorted.length; u++) if (sorted[u] !== u + 1) { ok = false; break; }
      if (!ok) continue;

      // 先备份整块子节点，disable 时原样挂回
      if (!blockOriginals.has(el)) {
        blockOriginals.set(el, Array.prototype.slice.call(el.childNodes));
      }
      var frag = doc.createDocumentFragment();
      var last = 0;
      re.lastIndex = 0;
      while ((m = re.exec(zh))) {
        var txt = zh.slice(last, m.index);
        if (txt) frag.appendChild(doc.createTextNode(txt));
        frag.appendChild(t.slots[Number(m[1]) - 1]);
        last = m.index + m[0].length;
      }
      if (last < zh.length) frag.appendChild(doc.createTextNode(zh.slice(last)));
      while (el.firstChild) el.removeChild(el.firstChild);
      el.appendChild(frag);
      try { el.setAttribute("data-biol10n-tpl", "1"); } catch (e) { /* ignore */ }
      stats.tpl++;
    }
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
    proseLenCache = new WeakMap();
    cjkCache = new WeakMap();
    var now = (typeof performance !== "undefined" && performance.now) ? function () { return performance.now(); } : function () { return 0; };
    var T = [now()];
    applyBlocks();
    var roots = scopeRoots();
    T.push(now());
    for (var q = 0; q < roots.length; q++) translateParagraphs(roots[q]);
    for (var tq = 0; tq < roots.length; tq++) translateTemplates(roots[tq]);
    T.push(now());
    for (var i = 0; i < roots.length; i++) walk(roots[i]);
    T.push(now());
    for (var k = 0; k < roots.length; k++) translateInlineInCJK(roots[k]);
    T.push(now());
    for (var j = 0; j < roots.length; j++) cleanupPass(roots[j]);
    T.push(now());
    stats.time = {
      blocks: Math.round(T[1] - T[0]),
      paras: Math.round(T[2] - T[1]),
      walk: Math.round(T[3] - T[2]),
      inline: Math.round(T[4] - T[3]),
      cleanup: Math.round(T[5] - T[4])
    };
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
    // 脚本也可能被注入到 SVG 图片帧（HPA 的 man.svg / woman.svg）：那里没有 documentElement，
    // 直接 observe(null) 会在控制台刷 "parameter 1 is not of type 'Node'"。
    if (!doc.documentElement) return;
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
    doc.querySelectorAll("[data-biol10n-tpl]").forEach(function (el) {
      var kids = blockOriginals.get(el);
      if (kids) {
        while (el.firstChild) el.removeChild(el.firstChild);
        for (var i = 0; i < kids.length; i++) el.appendChild(kids[i]);
      }
      try { el.removeAttribute("data-biol10n-tpl"); } catch (e) { /* ignore */ }
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
  /** 标题按 " — " / " | " / ": " 分段翻译。
   *  整串只查 exact，不跑 rules——旧实现让 ^(.+): (.+)$ 这类规则局部替换标题，
   *  结果是中文品牌名后面挂一截英文（"…in Breast Invasive Carcinoma（TCGA，泛癌图谱）"）。
   *  分段时每段也只用 exact：命中的段换成中文，没命中的（品牌名）原样留着。 */
  function titleBySegments(t) {
    var seps = [" — ", " – ", " | ", " :: ", " · ", ": ", " - "];
    for (var s = 0; s < seps.length; s++) {
      var sep = seps[s];
      if (t.indexOf(sep) < 0) continue;
      var parts = t.split(sep);
      if (parts.length < 2 || parts.length > 4) continue;
      var out = [], ok = true, changed = false;
      for (var i = 0; i < parts.length; i++) {
        var p = String(parts[i]).trim();
        if (!p || p.length > 60) { ok = false; break; }
        var tr = lookupExact(p);
        if (tr !== null) { out.push(tr); changed = true; } else { out.push(p); }
      }
      if (ok && changed) return out.join(sep === ": " ? "：" : sep);
    }
    return null;
  }

  var TITLE_BRANDS = {
    NCBI: 1, NLM: 1, PubMed: 1, GEO: 1, GDS: 1, GSE: 1, GDV: 1, BLAST: 1, SRA: 1, PMC: 1,
    Ensembl: 1, UniProt: 1, UniProtKB: 1, "RCSB": 1, PDB: 1, HPA: 1, UALCAN: 1, TIMER: 1,
    GTEx: 1, GDC: 1, "cBioPortal": 1, cBioPortal: 1, GEPIA: 1, KEGG: 1, UCSC: 1,
    miRBase: 1, TCGA: 1, EMBL: 1, EBI: 1, HGNC: 1, NCI: 1, "GEO DataSets": 1
  };
  /** 标题里允许剩下的英文：品牌名、全大写缩写、带数字的标识符。 */
  function titleAcceptable(v) {
    if (!hasCJK(v)) return false;
    var words = String(v).match(/[A-Za-z][A-Za-z0-9.+#-]*/g) || [];
    for (var i = 0; i < words.length; i++) {
      var w = words[i];
      if (TITLE_BRANDS[w]) continue;
      if (/\d/.test(w)) continue;
      if (w.length <= 2) continue;
      if (w === w.toUpperCase()) continue;
      return false;
    }
    return true;
  }

  function translateTitle() {
    var prev = hitChannel;
    hitChannel = "title";
    try { translateTitleInner(); } finally { hitChannel = prev; }
  }

  function translateTitleInner() {
    if (!enabled) return;
    var t = doc.title;
    if (!t) return;
    if (translatedTitle !== null && t === translatedTitle) return;
    if (hasCJK(t)) { translatedTitle = t; return; }
    var v = lookupExact(t);
    // 分段结果不合格时不能直接放弃：整条标题规则（HPA 的
    // "^Tissue expression of (.+) - Summary - The Human Protein Atlas$"）往往能一次翻完，
    // 原来 titleBySegments 返回半中半英后就被 titleAcceptable 丢掉，规则永远轮不到。
    if (v === null) {
      var segT = titleBySegments(t);
      if (segT !== null && titleAcceptable(segT)) v = segT;
    }
    if (v === null) v = translate(t);
    // 规则兜底也只接受"没剩下英文单词"的结果：剩下 ≥3 字母的小写单词说明只翻了半截
    // （"breast cancer - GEO 数据集 - NCBI"），宁可整条不动。
    if (v !== null && !titleAcceptable(v)) v = null;
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
