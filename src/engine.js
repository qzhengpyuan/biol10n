/**
 * BioL10n engine
 * 纯离线：不发起任何网络请求，不读写 cookie/localStorage 之外的任何存储，
 * 只做两件事：替换文本节点的 nodeValue、替换白名单属性。
 */
function createEngine(options) {
  // normalize 的开销全在 5 个正则上：不需要归一化的串（纯 ASCII、首尾无空白、无连续空白）
  // 直接原样返回。这行必须在建词库（会先调 normalize）之前执行。
  var NEEDS_NORM = /[\u00a0\u2000-\u200b\u3000\u2018\u2019\u02bc\u201c\u201d]|[\t\n\r]|\s{2,}|^\s|\s$/;
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
  // summary 是表格的读屏说明（GTEx 用它放整句表说明），label 主要给 OPTGROUP 分组名用，
  // 两个都不在默认通道里时，HPA 的 85 条 optgroup 与 GTEx 的 63 条表说明永远是英文（r25 P1-A）。
  var DEFAULT_ATTRS = ["placeholder", "title", "aria-label", "alt", "data-original-title", "summary"];
  // 下载格式名：这些词既是选项文字又是提交值，翻了只会让下载格式变成中文（List → 列表）
  var FORMAT_OPTION = /^(FASTA( \([^)]*\))?|TSV( \(Excel\))?|Excel|JSON|XML|RDF\/XML|Text|Plain text|GFF3?|BED|CSV|PSL|WIG|List|Embeddings|PDB|PPI)$/i;
  var BLOCK = site.block || "pre, code, kbd, samp, textarea, [contenteditable=''], [contenteditable='true']";

  var exact = new Map();
  var lowerIndex = new Map(); // 大小写兜底：SEARCH / search → 同一个译文
  var keyIndex = new Map(); // 规范化后的键 -> 原键（用于命中统计）
  // 全大写缩写（AND / NOT / OR / DNA）不进大小写兜底：兜底会把正文里的小写 not/and/or
  // 也套上译文，STRING 的「your network does not have significantly more interactions」
  // 就被翻成「does 非 have」（r29）。大写的界面标签仍走 exact 精确命中。
  var CAPS_ABBR = /^[A-Z][A-Z0-9_]{1,7}$/;
  Object.keys(data.exact || {}).forEach(function (k) {
    exact.set(normalize(k), data.exact[k]);
    var lk = normalize(k).toLowerCase();
    if (!CAPS_ABBR.test(normalize(k)) && !lowerIndex.has(lk)) lowerIndex.set(lk, data.exact[k]);
    keyIndex.set(normalize(k), k);
  });

  var rules = [];
  var hasRepairRules = false;
  (data.rules || []).forEach(function (r) {
    // requireHit：句式里带全角标点或中文模板时，至少有一个捕获组得真的命中词表才替换，
    // 否则 "Pan-Lung Cancer (TCGA, Nat Genet 2016)" 这类纯英文专名会被套上全角括号（半中半英）。
    try { if (r.repair) hasRepairRules = true; rules.push({ re: new RegExp(r.re), to: r.to, src: r.re, requireHit: !!r.requireHit, mixed: !!r.mixed, repair: !!r.repair }); } catch (e) { /* 坏规则直接跳过 */ }
  });

  // 模板通道：段落被 <a>/<code>/<em> 切成片段时，逐节点翻会半中半英、整段替换会丢链接。
  // 词条存成带 {{n}} 占位符的模板，运行时按占位符把原来的内联元素放回新译文里，链接与事件都保留。
  // 功能词不做大小写折叠：站点正文里的 "from"/"and" 与词表里的标签 "From"/"AND" 是两个东西。
  // PubChem 的 "Available from … as of March 10" 就是被 "From => 从" 折叠命中成 "Available 从"。
  var NO_CASE_FOLD = { from: 1, to: 1, of: 1, and: 1, or: 1, with: 1, in: 1, by: 1, at: 1, as: 1, on: 1, the: 1, a: 1, an: 1, for: 1, is: 1, was: 1 };
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
  // 每轮扫描/一批 flush 内有效的节点级判定缓存：同一个元素会被成百上千个文本节点问到，
  // 不缓存的话 skipNode/inBlock/inSkip/inLongProse 的祖先链要重复爬（大页面上这是主要开销）。
  // 只在一轮内复用，页面重渲染后结论可能变，所以每轮开头重建。
  var skipCache = new WeakMap();
  var skipCacheNo = new WeakMap(); // skipNode(el, true)：属性通道不认 translate="no"
  var blockCache = new WeakMap();
  var skipElCache = new WeakMap();
  var proseFastCache = new WeakMap();
  var ATTR_NAMES = attrs.slice();
  var ATTR_SET = {};
  var ATTR_SELECTOR = "";
  for (var an = 0; an < attrs.length; an++) { ATTR_SET[attrs[an]] = 1; ATTR_SELECTOR += (an ? "," : "") + "[" + attrs[an] + "]"; }
  function resetNodeCaches() {
    skipCache = new WeakMap();
    skipCacheNo = new WeakMap();
    blockCache = new WeakMap();
    skipElCache = new WeakMap();
    skipUpCache = new WeakMap();
    skipUpNo = new WeakMap();
    blockUpCache = new WeakMap();
    proseHitCache = new WeakMap();
    blockAncCache = new WeakMap();
    proseFastCache = new WeakMap();
    proseBlockCache = new WeakMap();
    proseFlagsCache = new WeakMap();
    parasFlagsCache = new WeakMap();
    proseLenCache = new WeakMap();
    cjkCache = new WeakMap();
  }
  // 元素自己有没有「会翻的属性」：绝大多数元素只有 class/href，走一次属性表遍历就够，
  // 不必对 6 个属性逐个 getAttribute（大页面上是十几万次 DOM 调用）。
  // 逐属性 hasAttribute 比遍历 attributes 集合快 3 倍（36k 元素：14ms vs 40ms），
  // 也比一次属性选择器查询快 4 倍（58ms）。无属性的元素先用 hasAttributes 一次挡掉。
  function hasTargetAttr(el) {
    if (el.tagName === "OPTGROUP") return true;
    if (!el.hasAttributes || !el.hasAttributes()) return false;
    var list = ATTR_NAMES;
    for (var i = 0; i < list.length; i++) {
      if (el.hasAttribute(list[i])) return true;
    }
    return false;
  }

  var processed = new WeakSet();
  var originals = new WeakMap();
  var propOriginals = new WeakMap(); // 通过 el.value 写入的默认文字
  var blockOriginals = new WeakMap(); // 整块替换时摘下的原始子节点（disable 时要挂回去）
  // 「看一眼原文」：整块/模板替换前把当时的英文文本记下来，UI 悬停时直接显示，
  // 不必关脚本再刷新（用户明确要这个）。只记整块级，逐节点替换用 originals 推。
  var origText = new WeakMap();
  // 按选择器精确替换：导航标签这类「单词级」词条（Data / Tool / Entity）只该在
  // 指定的元素里生效，写进通用 exact 会漏进正文句子（0.10.65 那条 ^(.+) Tool$ 的教训）。
  // site.scopedExact = [{ sel: "a.md-tabs__link", exact: { "Data": "数据" } }]
  var scopedList = [];
  ((site && site.scopedExact) || []).forEach(function (e) {
    if (!e || !e.sel || !e.exact) return;
    var map = {};
    Object.keys(e.exact).forEach(function (k) { map[normalize(k)] = e.exact[k]; });
    scopedList.push({ sel: e.sel, map: map });
  });
  var scopedEls = new WeakMap(); // Element -> 该元素适用的精确表
  var svgTexts = []; // SVG <text> 的逐节点原文（元素不在文本节点还原范围内，单独记）
  var misses = new Set();
  // enabled 放在 stats 上而不是只做闭包变量：boot 的 toggle 靠它判断该开还是该关
  var stats = { nodes: 0, hitExact: 0, hitRule: 0, attrs: 0, skipped: 0, tpl: 0, scoped: 0, backlog: 0, enabled: true };
  var enabled = true;
  var observer = null;
  var queue = new Set();
  var timer = null;
  // 首扫分片：大页面上一轮 walk 能把主线程占住几百毫秒（真机 9.3k 节点 ≈ 136ms，
  // 36k 节点 ≈ 500ms）。scanBudgetMs > 0 时，walk 只处理前一段（文档顺序 ≈ 视口顺序），
  // 剩下的文本节点进 backlog，由空闲回调按同样预算分批补完。ui/boot 之外的调用方
  // 不传这个选项，行为与以前完全一致（测试与 CLI 都按整页扫）。
  var scanBudget = (options && typeof options.scanBudgetMs === "number") ? options.scanBudgetMs : 0;
  var textBacklog = [];
  var backlogAt = 0;
  var backlogTimer = null;
  var scanDeadline = 0;
  // 分片会把同一批节点重复排进 backlog：每次重扫/路由/rescan 的 walk 都会再看到它们。
  // 用 WeakSet 去重，已翻过的（processed）直接跳过——否则 UniProt 这种 9k 节点页
  // 5 秒内 backlog 能堆到 4 万条，全是白跑。
  var backlogQueued = new WeakSet();

  // 绝大多数要翻的串是纯 ASCII、无首尾空格、无连续空白：这种串过一遍 5 个 replace 结果是
  // 原样返回，但一次正则扫描都不做更省。大表格上 normalize 以前是 45–75 ms 纯开销。
  function normalize(s) {
    if (!NEEDS_NORM.test(s)) return s;
    return s
      .replace(/[\u00a0\u2000-\u200b\u3000]/g, " ")
      // 弯/直撇号、弯/直引号归一：站点 DOM 里是直撇号（you've），词库里有 103 条写成弯撇号（you’ve），
      // 不折叠就对不上（r30 P1-2 ClinVar .gov 横幅第二段）。词库键在 build 时也走这里，两侧一致。
      .replace(/[\u2018\u2019\u02bc]/g, "'")
      .replace(/[\u201c\u201d]/g, '"')
      .replace(/\s+/g, " ")
      .trim();
  }

  function hasCJK(s) { return CJK.test(s); }
  var CN_PREV = /[\u3400-\u9fff，。、；：！？）]/;
  var CN_NEXT = /[\u3400-\u9fff（]/;
  var WS_CODE = /\s/;

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

  /** 平面文件常量（KEGG dbentry 的 ENTRY / NAME / GENE / SEQUENCE）是固定名称，
   *  不能靠小写回退查成「条目 / 名称 / 基因」。四个字符以上的纯大写/数字/下划线串
   *  只认 exact 里登记的大写形态，不回退小写；ID / DOI / PMC 这类 2–3 字符缩写照旧。 */
  function isCapsConstant(s) {
    return /^[A-Z0-9_\-]{3,}$/.test(s);
  }

  /** 只在 exact 表里查一次，不进入 rules，避免递归 */
  /** 通用册里的 ≤3 字符纯小写英文（and / to / of / the / in …）是正文里的功能词，
   *  单独命中会把 TargetScan 的「and/or」翻成「且/或」（r21/r24/r25 连续三轮）。
   *  这类键只在规则通道里用（表单标签走大写 AND/OR 或带冒号的写法），exact 通道直接跳过。 */
  var SHORT_FUNC = /^[a-z]{1,3}$/;
  // 站点关掉功能词（site.funcWords === false）时，独立成节点的 and/or/of 一律保持英文：
  // TargetScan 的检索式 "and/or" 被译成「且/或」连续三轮被检查方点名（r21/r24/r25）。
  // 只挡功能词白名单，All / Any 这类真界面词不受影响。
  var FUNC_WORD_SET = { and: 1, or: 1, of: 1, to: 1, in: 1, for: 1, the: 1, a: 1, an: 1, from: 1, with: 1, by: 1, on: 1, at: 1, as: 1, is: 1, was: 1, are: 1 };
  function lookupExact(s) {
    if (!s) return null;
    if (site.funcWords === false) {
      var bare = String(s).trim().toLowerCase();
      if (FUNC_WORD_SET[bare]) return null;
    }
    var text = normalize(s);
    if (!text || hasCJK(text)) return null;
    // 只有站点显式关掉（site.funcWords === false）才跳过：TargetScan 这类正文里
    // 把 "and" 当独立文本节点的站点，功能词会被译成「且/或」（r25 P1-E）；
    // 但 CCDS 的 for/in/and 是真实表单标签，通用禁止会打断这些站点。
    if (site.funcWords === false && SHORT_FUNC.test(text)) return null;
    var cand = variants(text);
    for (var i = 0; i < cand.length; i++) {
      var hit = exact.get(cand[i]);
      if (hit !== undefined) return hit;
      if (isCapsConstant(cand[i])) continue;
      if (!NO_CASE_FOLD[cand[i].toLowerCase()]) {
        var low = lowerIndex.get(cand[i].toLowerCase());
        if (low !== undefined) return low;
      }
    }
    for (var j = 0; j < cand.length; j++) {
      var sg = singulars(cand[j]);
      for (var k = 0; k < sg.length; k++) {
        var hit2 = exact.get(sg[k]);
        if (hit2 !== undefined) return hit2;
        if (isCapsConstant(sg[k])) continue;
        if (!NO_CASE_FOLD[sg[k].toLowerCase()]) {
          var low2 = lowerIndex.get(sg[k].toLowerCase());
          if (low2 !== undefined) return low2;
        }
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

  // 同一段英文在大表格里会重复几千次（"...Somatic Mutation" / "Open" / "Search"）。
  // 查表 + 掩码 + 规则串扫描对同一个输入结果是确定的，所以按输入串缓存：
  // 只缓存顶层调用（depth=0），递归里的子串照常自己算，避免把上下文相关的中间结果钉死。
  var transCache = new Map();
  var lastHitRule = false;
  function translate(s, depth) {
    if (!depth) {
      var cv = transCache.get(s);
      if (cv !== undefined) {
        if (cv.out !== null) bumpHit(cv.rule);
        return cv.out;
      }
    }
    var cached = translateInner(s, depth);
    if (!depth && transCache.size < 20000) {
      transCache.set(s, { out: cached, rule: lastHitRule });
    }
    return cached;
  }

  function translateInner(s, depth) {
    // 规则通道同样要挡：dict 里还有 ^AND$ => 且 这类规则（TargetScan）
    if (site.funcWords === false && s) {
      var bareW = String(s).trim().toLowerCase();
      if (FUNC_WORD_SET[bareW]) return null;
    }
    // 首尾的箭头/伪元素符号先剥离，翻译完再贴回：PRIDE 的「or browse all datasets →」
    // 与 BioStudies 的「→PageTab↲」都是这个形态，带着符号查表永远 miss。
    // 只处理首尾带箭头的串：箭头在中间（ClinicalTrials 的「cancer → Tumours」、
    // UniProt 的「IRGRERFEMF → DQTSFQKENC」）时 head/tail 都是空串，core === s，
    // 走同 depth 递归会无限自调用直接爆栈（r24 P0-1）。
    if (ARROW_EDGE.test(s)) {
      // 词表里有的条目本来就带箭头（PRIDE「or browse all datasets →」），先按原样查。
      var arrowDirect = lookupExact(s);
      if (arrowDirect !== null) { bumpHit(false); return arrowDirect; }
      var head = (s.match(/^[\s\u2192\u21b2\u25b8\u25c2\u203a]+/) || [""])[0];
      var tail = (s.match(/[\s\u2192\u21b2\u25b8\u25c2\u203a]+$/) || [""])[0];
      var core = s.slice(head.length, s.length - tail.length);
      if (!core || core === s) return null;
      var coreOut = translate(core, depth);
      return coreOut === null ? null : head + coreOut + tail;
    }
    // 掩码只服务于规则 pass：d:d 被换成占位符后 exact 表永远查不到
    // （PubMed 帮助页「…2004;207:4147–4155.」整段因此永不翻译）。
    // 先用未掩码原文查一次 exact，命中就直接返回；未命中再走掩码后的规则通道。
    var masked = /\d:\d/.test(s);
    if (masked) {
      var direct = lookupExact(s);
      if (direct !== null) { bumpHit(false); return direct; }
    }
    var out = translateRules(masked ? maskTimeColons(s) : s, depth || 0);
    return masked && out !== null ? unmaskTimeColons(out) : out;
  }

  // 命中计数按通道分开：属性与 title 也会走 translate()，混在一个 hitExact 里会出现
  // 「hitExact 大于 nodes」（nodes 只统计文本通道），看报告时无法判断到底哪一类在涨。
  var hitChannel = "text";
  function bumpHit(rule) {
    lastHitRule = !!rule;
    if (hitChannel === "attr") { if (rule) stats.attrRule = (stats.attrRule || 0) + 1; else stats.attrHit = (stats.attrHit || 0) + 1; }
    else if (hitChannel === "title") { if (rule) stats.titleRule = (stats.titleRule || 0) + 1; else stats.titleHit = (stats.titleHit || 0) + 1; }
    else if (rule) stats.hitRule++; else stats.hitExact++;
  }

  // 「不必翻」的标识：带数字或 . _ - /（GSE331160、P04637、rs587780073、H3C2），
  // 或 6 个字母以内的全大写缩写（TCGA、DNA、CSV、QTL）。普通英文单词一律不算，
  // 否则 Study: TCGA 这种能翻的规则会误伤成「研究：LYMPHATIC」（0.9.32 的 GTEx 问题）。
  function isIdentifier(s) {
    if (!s) return false;
    if (/[0-9._\-\/]/.test(s)) return /^[A-Za-z0-9][A-Za-z0-9._\-\/]{0,23}$/.test(s);
    if (/^[A-Z]{1,6}$/.test(s)) return true;
    return false;
  }

  // 只跑词库里显式标了 mixed:true 的规则，用于「中文（英文缩写）」这种半翻节点。
  function translateMixed(s) {
    // 同一段半翻文本可能要先修括号、再修末尾百分比（cBio 饼图图例），
    // 所以多跑几轮，直到没有规则再改变它。
    var cur = s;
    for (var pass = 0; pass < 5; pass++) {
      var changed = false;
      for (var j = 0; j < rules.length; j++) {
        if (!rules[j].mixed) continue;
        var m = rules[j].re.exec(cur);
        if (!m) continue;
        var out = rules[j].to.replace(/\$(\d)/g, function (_, d) {
          var seg = m[Number(d)];
          return seg === undefined ? "" : translateCapture(seg, 0);
        });
        if (out !== cur) { cur = out; changed = true; break; }
      }
      if (!changed) break;
    }
    return cur === s ? null : cur;
  }

  /** 块模板拼出来的「中文标签 + 字面 tab + 英文正文」（KEGG 帮助页「通路图\t…」）：
   *  hasCJK 让这种节点第一次之后就再也不处理，正文永远留英文。
   *  只对「tab 前面有汉字、tab 后面是纯英文」的形态生效，正文必须是词表里收录的整条。 */
  function translateTabbed(s) {
    // 传进来的是节点原文（normalize 会把 \t 折叠成空格，必须在归一化之前切）
    var m = /^\s*([^\t\n]*[\u3400-\u9fff][^\t\n]*)\t([\s\S]+)$/.exec(s);
    if (!m) return null;
    var tail = normalize(m[2]);
    if (!tail || tail.length < 4 || hasCJK(tail) || !LETTER.test(tail)) return null;
    var out = lookupExact(tail);
    if (out === null) return null;
    return m[1] + "\t" + out;
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
            if (isIdentifier(segK.trim())) continue;
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

  // 伪元素箭头（BioStudies 的「→PageTab↲」、Reactome 的「▸」、PRIDE 的「or browse … →」）
  // 只在首尾当装饰：查表前剥掉、翻译后原样贴回，否则带箭头的整句永远进不了词表。
  var ARROW_GLYPH = /[\u2192\u21b2\u25b8\u25c2\u203a]/;
  var ARROW_EDGE = /^[\s\u2192\u21b2\u25b8\u25c2\u203a]+|[\s\u2192\u21b2\u25b8\u25c2\u203a]+$/;
  /** skipNode 的单轮结果缓存：同一父元素下的文本节点结论相同，
   *  大页面上（GDC 数据表 2 万节点）能把「爬 40 层祖先」的代价摊薄到几乎为零。 */
  function skipNode(node, skipTranslateNo) {
    var key = node && node.nodeType === 3 ? node.parentElement : node;
    if (!key) return skipNodeInner(node, skipTranslateNo);
    var cache = skipTranslateNo ? skipCacheNo : skipCache;
    var v = cache.get(key);
    if (v !== undefined) return v;
    v = skipNodeInner(node, skipTranslateNo);
    cache.set(key, v);
    return v;
  }

  /** 单个元素自己是否就是"整块跳过"的起点（与具体文本节点无关的那几类判据）。 */
  /** HTML 文档里 tagName 已是大写，只有 SVG/XML 才是小写：省掉一次字符串分配。 */
  function tagUpper(el) {
    var t = el.tagName;
    if (!t) return "";
    return t.charCodeAt(0) > 96 ? t.toUpperCase() : t;
  }

  function hardSkipEl(el) {
    var tagU = tagUpper(el);
    if (SKIP_TAGS[tagU] === 1) {
      // <title> 在 HTML 里是页面标题（必须挡），但 SVG 里的 <title> 是图表 tooltip
      // （cBio 饼图「Mixed Histology (NOS):30」），要按 SVG 文本照翻。
      if (tagU === "TITLE" && String(el.namespaceURI || "").indexOf("svg") >= 0) return false;
      return true;
    }
    // 无属性的元素占绝大多数：先一次 hasAttributes 挡掉后面的 3 次 hasAttribute + dataset
    if (!el.hasAttributes || !el.hasAttributes()) return false;
    if (el.isContentEditable) return true;
    if (el.hasAttribute("data-biol10n-ui") || el.hasAttribute("data-biol10n-block") || el.hasAttribute("data-biol10n-skip")) return true;
    if (el.getAttribute("data-l10n-scope") === "off") return true;
    return false;
  }

  /** 祖先结论的元素级缓存：h=从该元素（含）向上出现过"硬跳过"，t=最近的 translate="no" 屏障。
   *  大表格上同一行 6 个单元格共享 tr/tbody/table，每个新元素只需付自身 6 项检查。 */
  var skipUpCache = new WeakMap();
  /** 与 skipUpCache 配套：只有 bit2 置位时才在这张表里存最近的 translate="no" 元素。 */
  var skipUpNo = new WeakMap();

  function skipNodeInner(node, skipTranslateNo) {
    var p = node.parentElement;
    var chain = [];
    var h = false, tno = null;
    var guard = 0;
    while (p && guard++ < 40) {
      // 图表里的文字（<text>/<tspan>）照翻：HPA 的饼图图例、坐标轴标签都在 SVG 里。
      // 其余 SVG 内部节点（图形、路径）没有可读文本，照样跳过。SVG 子树结论与具体
      // 文本节点相关，不进上面的元素级缓存，逐层判定即可（SVG 节点数少）。
      if (p.tagName === "SVG" || p.tagName === "svg") {
        // 不能只看 node.parentElement.tagName：HPA 本体图是 <text><a>Brain</a></text>，
        // 文本节点的父级是 <a>，整批图例标签会被误判成图形节点跳过。
        var pe = node.parentElement;
        var t = pe && pe.closest ? pe.closest("text,tspan,title,desc") : null;
        return !(t && (p === t || p.contains(t)));
      }
      var c = skipUpCache.get(p);
      if (c !== undefined) {
        h = (c & 1) === 1;
        tno = (c & 2) === 2 ? (skipUpNo.get(p) || null) : null;
        break;
      }
      chain.push(p);
      p = p.parentElement;
    }
    // 从最外层往内收，把结论填给这一串新元素
    for (var i = chain.length - 1; i >= 0; i--) {
      var el = chain[i];
      if (!h && hardSkipEl(el)) h = true;
      if (!tno && el.hasAttributes && el.hasAttributes() && el.getAttribute("translate") === "no") tno = el;
      skipUpCache.set(el, (h ? 1 : 0) | (tno ? 2 : 0));
      if (tno) skipUpNo.set(el, tno);
    }
    if (h) return true;
    // 站点自己声明"这段别翻"（UniProt 的示例检索词按钮就是 <span translate="no">Human</span>）
    if (!skipTranslateNo && tno && !allowInsideNo(node, tno)) return true;
    // 内层 translate="no" 被放行时，外层可能还有一层（少见）：继续往上确认
    if (!skipTranslateNo && tno) {
      var up = tno.parentElement, g = 0;
      while (up && g++ < 40) {
        if (up.getAttribute && up.getAttribute("translate") === "no" && !allowInsideNo(node, up)) return true;
        up = up.parentElement;
      }
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

  /** BLOCK 选择器拆成「裸标签集合 + 剩余复杂选择器」：closest 一次要逐选择器 × 逐层匹配，
   *  大表格上（GDC 2 万单元格）是纯浪费。裸标签走 Set，剩下的才交给 matches。 */
  var BLOCK_TAG_SET = {}, BLOCK_COMPLEX = "";
  (function () {
    var parts = String(BLOCK).split(",");
    var rest = [];
    for (var i = 0; i < parts.length; i++) {
      var s = parts[i].trim();
      if (!s) continue;
      if (/^[a-zA-Z][a-zA-Z0-9-]*$/.test(s)) BLOCK_TAG_SET[s.toUpperCase()] = 1;
      else rest.push(s);
    }
    BLOCK_COMPLEX = rest.join(", ");
  })();
  /** 元素级「本元素到根之间有没有块级禁区」缓存（单调：命中即整棵子树都算）。 */
  var blockUpCache = new WeakMap();
  function inBlock(el) {
    if (!el) return false;
    var v = blockCache.get(el);
    if (v !== undefined) return v;
    var chain = [], cur = el, hit = false, guard = 0;
    while (cur && guard++ < 60) {
      var t = tagUpper(cur);
      if (BLOCK_TAG_SET[t] === 1) { hit = true; break; }
      if (BLOCK_COMPLEX && cur.matches) {
        try { if (cur.matches(BLOCK_COMPLEX)) { hit = true; break; } } catch (e) {}
      }
      var c = blockUpCache.get(cur);
      if (c !== undefined) { hit = c; break; }
      chain.push(cur);
      cur = cur.parentElement;
    }
    for (var i = 0; i < chain.length; i++) blockUpCache.set(chain[i], hit);
    blockCache.set(el, hit);
    return hit;
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
  var proseBlockCache = new WeakMap();
  var proseFlagsCache = new WeakMap();
  // 段落通道要判「里面有没有块级元素 / 链接」，原来是每个候选元素各跑一次 querySelector，
  // 在 20000 个单元格的页面上等于把整棵子树反复扫了 20000 遍。改成按元素记忆的位标记：
  // 每个元素只算一次，一次自底向上把 block(1)/anchor(2) 传给祖先。
  var parasFlagsCache = new WeakMap();
  var SUB_BLOCK = 1, SUB_ANCHOR = 2;
  var PARAS_BLOCK_TAGS = { P: 1, LI: 1, UL: 1, OL: 1, DIV: 1, TABLE: 1, PRE: 1, CODE: 1, TEXTAREA: 1 };
  function parasSubFlags(el, depth) {
    var c = parasFlagsCache.get(el);
    if (c !== undefined) return c;
    if ((depth || 0) > 200) return SUB_BLOCK | SUB_ANCHOR; // 超深结构按"有块级"处理，宁可不整段替换
    var f = 0;
    for (var k = el.firstElementChild; k; k = k.nextElementSibling) {
      var t = String(k.tagName || "").toUpperCase();
      if (PARAS_BLOCK_TAGS[t]) f |= SUB_BLOCK;
      if (t === "A") f |= SUB_ANCHOR;
      if ((f & (SUB_BLOCK | SUB_ANCHOR)) !== (SUB_BLOCK | SUB_ANCHOR)) {
        f |= parasSubFlags(k, (depth || 0) + 1);
      }
      if ((f & (SUB_BLOCK | SUB_ANCHOR)) === (SUB_BLOCK | SUB_ANCHOR)) break;
    }
    parasFlagsCache.set(el, f);
    return f;
  }

  var CTRL_TAGS = { BUTTON: 1, SUMMARY: 1, LABEL: 1, SELECT: 1, OPTION: 1, TH: 1 };
  var BLOCK_ANC_TAGS = { P: 1, BLOCKQUOTE: 1, DD: 1, DT: 1, LI: 1, TD: 1, FIGCAPTION: 1, DIV: 1, SECTION: 1, ARTICLE: 1 };
  /** 元素级「本元素及以上有没有控件祖先 / 站点放行块」：1 位。 */
  var proseHitCache = new WeakMap();
  function proseHitAbove(el) {
    var chain = [], cur = el, hit = 0, guard = 0;
    while (cur && guard++ < 60) {
      var v = proseHitCache.get(cur);
      if (v !== undefined) { hit = v; break; }
      var t = tagUpper(cur);
      if (CTRL_TAGS[t] === 1) { hit = 1; break; }
      if (cur.hasAttributes && cur.hasAttributes()) {
        var role = cur.getAttribute("role");
        if (role === "button") { hit = 1; break; }
        if (site.proseExempt && cur.matches) {
          try { if (cur.matches(site.proseExempt)) { hit = 1; break; } } catch (e) {}
        }
      }
      chain.push(cur);
      cur = cur.parentElement;
    }
    for (var i = 0; i < chain.length; i++) proseHitCache.set(chain[i], hit);
    return hit === 1;
  }

  /** 最近的块级容器（段落保护的作用域）：同样元素级缓存，命中祖先即整链复用。 */
  var blockAncCache = new WeakMap();
  function blockAnc(el) {
    var chain = [], cur = el, hit = null, guard = 0;
    while (cur && guard++ < 60) {
      if (BLOCK_ANC_TAGS[tagUpper(cur)] === 1) { hit = cur; break; }
      var c = blockAncCache.get(cur);
      if (c !== undefined) { hit = c; break; }
      chain.push(cur);
      cur = cur.parentElement;
    }
    for (var i = 0; i < chain.length; i++) blockAncCache.set(chain[i], hit);
    return hit;
  }

  function inLongProse(node) {
    if (site.proseGuard === false) return false;
    var el = node && node.nodeType === 3 ? node.parentElement : node;
    if (!el || !el.closest) return false;
    // 只按祖先就能定论的几种情况（控件/放行块/块容器太短）缓存起来：
    // 一个大段落里成百上千个文本节点会反复问同一个问题，祖先链爬一遍就够了。
    var fast = proseFastCache.get(el);
    if (fast === true) return false;
    var p = null;
    if (fast === undefined) {
      // 控件祖先 / 站点放行块：两条选择器 closest 以前每个元素各跑一次（大表格上占正文保护
      // 开销的大头）。改成「元素级单调缓存 + 裸标签集合」，同一行 6 个单元格只算一次。
      if (proseHitAbove(el)) { proseFastCache.set(el, true); return false; }
      // 段落类容器之外，KEGG 这类老站点把正文直接放在 <div> 里（"<b>KEGG PATHWAY</b> is a collection of…"），
      // 所以要找到最近的"块级容器"再判是不是成句正文。
      p = blockAnc(el);
      if (!p) { proseFastCache.set(el, true); return false; }
      var blk = String(p.textContent || "");
      proseLenCache.set(p, blk);
      if (blk.length <= (site.proseMax || 120)) { proseFastCache.set(el, true); return false; }
      proseFastCache.set(el, false);
      // 把块容器记在元素上，后续同元素的询问直接用
      proseBlockCache.set(el, p);
      // 元素级的 closest 判定一次算清：同一元素下的文本节点答案相同，
      // 原来每个节点都要重复爬 6 条祖先链（大页面里占正文保护开销的大头）。
      var badge = null, link = false, foot = false, cell = false, inl = false;
      try { badge = el.closest("strong, em, b"); } catch (e1) { badge = null; }
      try { link = !!el.closest("a"); } catch (e2) { link = false; }
      try { foot = !!el.closest("footer, figcaption, .copyright"); } catch (e3) { foot = false; }
      try { cell = !!el.closest("td, th, dt"); } catch (e4) { cell = false; }
      if (site.inlineExact) { try { inl = !!el.closest("a, span, em, strong, b, i"); } catch (e5) { inl = false; } }
      proseFlagsCache.set(el, { badge: badge, badgeInLi: !!(badge && badge.closest && badge.closest("li")), link: link, foot: foot, cell: cell, inline: inl });
    } else {
      p = proseBlockCache.get(el);
      if (!p) { proseFastCache.set(el, true); return false; }
    }
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
    var flags = proseFlagsCache.get(el) || {};
    if (own && own.length <= 32 && lookupExact(own) !== null) {
      if (flags.badgeInLi) return false;
      // 结果列表里的「more...」是链接的标签文字（GEO 搜索结果 18 处），不是句子成分。
      // 只放行以省略号结尾的链接标签：正文里「… browser. Contact Us」这种链接必须继续挡，
      // 否则一句英文里会冒出「联系我们」。
      if (flags.link && /(\.\.\.|…)$/.test(own)) return false;
      // 页脚/图注里的短标签（Web Policies、Careers、Data source）是导航不是正文，
      // 整条命中词表就翻；页脚里的长句仍按正文处理。
      if (flags.foot && own.length <= 40) return false;
      // 表格单元格里的短标签：HPA 的 td.summary_info 整块几千字符，标签（DNA sequence）
      // 却是独立单元格，整条命中词库就该翻；单元格里的长句仍被正文保护挡住。
      if (flags.cell) return false;
      // 文档站（GEO FAQ、PubMed 帮助页）的长段里夹着的链接文字：「please <a>watch a tutorial video</a>.」
      // 整条命中词库、长度也短，但前一个字符是字母就被当句子成分挡住，于是词库有译文也不翻。
      // 只对显式开 inlineExact 的站点放行内联元素，避免正文链接被拆成半中半英（通用站点保持原判据）。
      if (site.inlineExact && flags.inline && own.length <= 40) return false;
    }
    // 逐词拆分的引文（PubChem 的 .pc-word-break：一个单词一个文本节点、中间夹空白节点）
    // 必须从文本节点本身取相邻文本；传父元素的话 inlineRoot 拿到的还是块容器，
    // 兄弟文本永远是块外的，整句会被判成「不是正文」而逐词翻译（Production 卷 Information 已提交…）。
    var ctx = inlineRoot(node);
    var nxt = nextTextAfter(ctx);
    var prv = prevTextBefore(ctx);
    // 已经变成中文的句子：块里还有零星英文单词（RCSB 检索构建器的
    // 「选择一个 attribute 进行检索（例如：物种，实验方法，Resolution）」），
    // 这些短词整条命中词库、且前后都不像被夹在英文句中，就该补翻，否则永远半中半英。
    if (own && own.length <= 32 && lookupExact(own) !== null && /[\u3400-\u9fff]/.test(blockText)) {
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
    var cached = skipElCache.get(el);
    if (cached !== undefined) return cached;
    var v = inSkipInner(el);
    skipElCache.set(el, v);
    return v;
  }

  function inSkipInner(el) {
    var hit = false;
    try { hit = !!el.closest(site.skip); } catch (e) { return false; }
    if (!hit) return false;
    // skip 是"整块别碰"，但块里常夹着纯界面元素（GEO 结果行的 dt「Accession:」标签）。
    // site.skipFree 列出"即使祖先在 skip 里也照翻"的选择器。
    var free = site.skipFree || [];
    for (var i = 0; i < free.length; i++) {
      try { if (el.closest(free[i])) return false; } catch (e2) {}
    }
    return true;
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
    // 纯数字/标点节点先挡掉：BioMart 这类大表页面里成千上万个坐标、ID、分隔符节点
    // 每个都要过 handleSvgText/handleSplitText/handleBrJoin 三道闸，单次扫描被拖到几十秒。
    var quick = node.nodeValue;
    if (quick == null) return;
    // 只挡「含数字、没有字母也没有汉字」的节点（坐标、ID、百分数、日期片段）；
    // 纯标点是 localizePunct 的活儿，不能一起挡掉。
    if (!/[A-Za-z\u3400-\u9fff]/.test(quick) && /\d/.test(quick)) return;
    // parentElement 在 jsdom 里是一次接口包装访问，后面五六处都要用，只取一次
    var pe = node.parentElement;
    if (handleSvgText(node)) return;
    if (handleSplitText(node, pe)) return;
    if (handleBrJoin(node, pe)) return;
    var raw = node.nodeValue;
    if (!raw) return;
    var text = normalize(raw);
    if (text.length < 2) { localizePunct(node, text); return; }
    if (hasCJK(text)) {
      // 已经翻过一半的节点（「乳腺浸润性癌（NOS）」）按 hasCJK 整条跳过，
      // 词库里只有 NOS 这种键就永远改不到里面。给词条留一个显式的 mixed 规则通道：
      // 只跑标了 mixed 的锚定规则，其它规则一律不碰含中文的节点。
      var mixedOut = translateMixed(text);
      if (mixedOut === null && raw.indexOf("\t") >= 0) mixedOut = translateTabbed(raw);
      if (mixedOut !== null) {
        if (!originals.has(node)) originals.set(node, raw);
        node.nodeValue = mixedOut;
        stats.mixed = (stats.mixed || 0) + 1;
        processed.add(node);
      }
      return;
    }
    if (!LETTER.test(text)) return;
    // 下载格式名（FASTA/TSV/List…）是约定俗成的标识，不翻；其余 <option> 照翻文字、
    // 但绝不碰 value 属性——筛选器的 value 和显示文字常常一模一样，按 value 一刀切会把
    // 「Mutagenesis」这类该翻的筛选项整类留下（UniProt 就这样）。
    var opt = pe;
    if (opt && opt.tagName === "OPTION" && FORMAT_OPTION.test(text)) { processed.add(node); return; }
    // 公式碎片：Log<sub>2</sub>、10<sup>-6</sup> 这类，前一半单独翻会变成「对数2」
    var nsEl = node.nextSibling;
    while (nsEl && nsEl.nodeType === 3 && !String(nsEl.nodeValue || "").trim()) nsEl = nsEl.nextSibling;
    // 只挡真正的数字上标（Log<sub>2</sub>、10<sup>-6</sup>）；字母上标是 HPA 的帮助图标
    // <sup class="help_i">i</sup>，挡掉会把整类标签（Tissue specificity 等）留在英文。
    if (nsEl && nsEl.nodeType === 1 && /^(SUB|SUP)$/.test(nsEl.tagName) && /^[+\-]?[\d.]+$/.test(String(nsEl.textContent || "").trim())) { processed.add(node); return; }
    if (skipNode(node) || inBlock(pe) || inSkip(pe)) { processed.add(node); return; }
    // 正文保护挡下的节点不记入 processed：块内容会随其它节点被翻译而变中文
    // （RCSB 构建器先被翻成「选择一个 attribute 进行检索…」），下一轮补扫要能重新判一次。
    // 但词库里明确收录的整段（帮助页、FAQ、首页简介）是人工核对过的译文，
    // 命中就照翻——否则这些"固定说明句"永远进不来。查表用 count=false，避免命中数翻倍。
    if (inLongProse(node)) {
      // 只放行"整句/整段"级别的命中（>= 40 字符）。英文句子里的短链接（"… browser. Contact Us"）
      // 即使词典里有 Contact Us，也不能在一句英文中间冒出一小块中文。
      if (text.length < 40 || lookupExact(text) === null) { recordMiss(text, node, true); return; }
    }

    stats.nodes++;
    // 按选择器精确替换优先：导航标签里的 Data/Tool 这类单词只在该元素里翻，
    // 不影响正文句子（通用 exact 里放这种词会把「… with GDC Data Transfer Tool」翻成半中半英）。
    var scopedMap = scopedFor(pe);
    var out = scopedMap && scopedMap[text] !== undefined ? scopedMap[text] : null;
    if (out !== null) stats.scoped = (stats.scoped || 0) + 1;
    if (out === null) out = translate(text);
    if (out === null) { recordMiss(text); processed.add(node); return; }

    // 首尾空白用下标扫描（原来是一条惰性量词正则，每个命中节点都跑一遍）
    var l0 = 0, l1 = raw.length;
    while (l0 < l1 && WS_CODE.test(raw.charAt(l0))) l0++;
    while (l1 > l0 && WS_CODE.test(raw.charAt(l1 - 1))) l1--;
    var lead = l0 ? raw.slice(0, l0) : "";
    var trail = l1 < raw.length ? raw.slice(l1) : "";
    // 中英混排里最常见的瑕疵：源 DOM 把空格放在独立的纯空白文本节点里
    //（" as a" + " " + <a>），译文是中文时这些空格留着就会变成「作为 蛋白名称」。
    // 译文以中文开头就吃掉前面的空格节点、以中文结尾就吃掉后面的。
    // 只清相邻的纯空白兄弟节点，不动本节点内部的首尾空白（那是 HTML 缩进，删了会破坏排版）
    if (/^[\u3400-\u9fff]/.test(out)) blankSibling(node, "previousSibling");
    if (/[\u3400-\u9fff]$/.test(out)) blankSibling(node, "nextSibling");
    // 节点自带的空格要看"另一侧是谁"：
    // 中文接中文 → 丢掉空格（「， 基因本体」）；中文接数字/英文 → 保留（「59,140 结果」）。
    // neighborChar 要读兄弟节点链，只有「本节点带着空白、且译文贴边是汉字」时才需要问
    if (lead && /^[\u3400-\u9fff（「【]/.test(out) && CN_PREV.test(neighborChar(node, -1))) lead = "";
    if (trail && /[\u3400-\u9fff，。、；：！？]$/.test(out) && CN_NEXT.test(neighborChar(node, 1))) trail = "";
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
    if (/[\u3400-\u9fff]/.test(out)) fixVerticalLabel(node.parentElement);
  }

  /** ClinVar 的「胚系 / 体细胞」区块标题是 vertical-rl + rotate(180deg) 做的竖排
   *  （英文旋转 180 后仍能读，汉字转 180 就是倒的）。
   *  译文含汉字时把最近的竖排祖先的 transform 清掉：竖排照旧、字正过来。 */
  function fixVerticalLabel(el) {
    if (!el || !win || !win.getComputedStyle) return;
    // getComputedStyle 会强制一次样式重算：大表格里每个译文节点都调一次是几百毫秒的开销
    //（实测 1.6 万次替换 = 460 ms）。先用内联样式/class 名做便宜预判，只有竖排站（ClinVar）
    // 才在站点配置里打开 site.fixVertical 全量兜底。
    if (site.fixVertical !== true) {
      var hint = false;
      for (var h = 0, hs = el; hs && h < 3 && hs.nodeType === 1; h++, hs = hs.parentElement) {
        if (hs.getAttribute) {
          var st = hs.getAttribute("style");
          if (st && /vertical|rotate|transform/i.test(st)) { hint = true; break; }
        }
        var cn = typeof hs.className === "string" ? hs.className : "";
        if (cn && /vertical|rotate|sideways/i.test(cn)) { hint = true; break; }
      }
      if (!hint) return;
    }
    for (var i = 0; i < 3 && el && el.nodeType === 1; i++, el = el.parentElement) {
      var cs;
      try { cs = win.getComputedStyle(el); } catch (e) { return; }
      if (!cs) return;
      var vertical = /^vertical/.test(String(cs.writingMode || ""));
      var rotated = /matrix\(-1,\s*0,\s*0,\s*-1|rotate\(180deg\)|rotate\(-180deg\)/.test(String(cs.transform || ""));
      if (!vertical && !rotated) continue;
      try {
        if (cs.transform && cs.transform !== "none") el.style.setProperty("transform", "none", "important");
        if (vertical && /sideways/.test(String(cs.textOrientation || ""))) el.style.setProperty("text-orientation", "upright", "important");
      } catch (e2) {}
      return;
    }
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
    // 便宜的命名空间闸：HTML 元素的命名空间是 xhtml，没有 SVG 命名空间祖先，
    // 不必为每个文本节点跑一次 closest("text")（大表格上 3–5 万次）。
    var ns = pe.namespaceURI;
    if (!ns || ns.indexOf("svg") < 0) return false;
    var t = null;
    try { t = pe.closest("text"); } catch (e) { return false; }
    if (!t) return false;
    // 已经被翻过、但翻坏了括号的标签：svgDone 会挡住后续所有处理，
    // 所以修复必须放在这里，且不受 svgDone 约束。
    try {
      var rw = doc.createTreeWalker(t, 4, null, false), rn;
      while ((rn = rw.nextNode())) {
        var rv = String(rn.nodeValue || "");
        var rv2 = repairText(rv);
        if (rv2 !== rv) {
          if (!originals.has(rn)) originals.set(rn, rv);
          rn.nodeValue = rv2;
        }
      }
    } catch (e3) { /* 修复失败不影响后续 */ }
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

  /** 屏幕阅读器专用 / tooltip 子树：不进 <br> 拼接的文本（ClinVar 的 dt 里藏着一整段帮助说明）。
   *  ClinVar 的字段说明挂在 .total-help-icon > .pointer-triangle-parent > p 里，
   *  只认 usa-sr-only 不够，会把整段中文说明拼进标签，导致 hasCJK 判成「已是中文」而弃权。 */
  function isHiddenSubtree(el) {
    try {
      var cl = el.classList;
      if (cl) {
        if (cl.contains("usa-sr-only") || cl.contains("sr-only") || cl.contains("visually-hidden") || cl.contains("visuallyhidden")) return true;
        if (cl.contains("tooltip") || cl.contains("popover") || cl.contains("pointer-triangle-parent")) return true;
        var cn = String(el.className || "");
        if (/help-(icon|text|tip)|-help-icon|total-help|help-icon/.test(cn)) return true;
      }
      if (el.getAttribute) {
        if (el.getAttribute("role") === "tooltip") return true;
        if (el.getAttribute("aria-hidden") === "true") return true;
        var id = String(el.id || "");
        if (/-icon$|help-icon/.test(id)) return true;
        if (el.hasAttribute("data-biol10n-block") && /help|tooltip/i.test(String(el.className || "") + " " + id)) return true;
        var st = el.getAttribute("style") || "";
        if (/display\s*:\s*none|visibility\s*:\s*hidden/.test(st)) return true;
      }
    } catch (e) { /* 判定失败就当可见 */ }
    return false;
  }

  /** <br> 拆开的标题（"The Housekeeping" + <br> + "Proteome"）：整段拼接后再查表 */
  function hasHiddenDescendant(el) {
    for (var c = el.firstChild; c; c = c.nextSibling) {
      if (c.nodeType !== 1) continue;
      if (isHiddenSubtree(c)) return true;
      if (hasHiddenDescendant(c)) return true;
    }
    return false;
  }

  var brDone = new WeakSet();
  /** 递归拼可见文本：tooltip / 屏幕阅读器子树可能嵌在多层容器里（ClinVar 的 dt），
   *  只在直接子节点上判 isHiddenSubtree 会把整段中文说明拼进标签。 */
  function visibleJoinedText(el, acc) {
    for (var c = el.firstChild; c; c = c.nextSibling) {
      if (c.nodeType === 3) acc.push(c.nodeValue);
      else if (c.nodeType === 1) {
        if (c.tagName === "BR") acc.push(" ");
        else if (!isHiddenSubtree(c)) visibleJoinedText(c, acc);
      }
    }
    return acc;
  }
  function brJoinedText(el) {
    return normalize(visibleJoinedText(el, []).join(""));
  }
  /** 同一元素里的文本被站点拆成多个文本节点（cBioPortal 的 <h4>Horizontal\nAxis</h4>），
   *  整串比对才命得中词表。只在元素没有子元素时动手，替换后按整块记录，disable 能还原。 */
  function handleSplitText(node, el) {
    if (!el) el = node.parentElement;
    // 用 firstChild.nextSibling 判"至少两个子节点"：childNodes.length 每次都新建 NodeList 包装，
    // 大表格上 3 万多个文本节点光这一句就是几十毫秒。
    if (!el || !el.firstChild || !el.firstChild.nextSibling) return false;
    if (skipNode(node) || inBlock(el) || inSkip(el)) return false;
    // 子元素全是内联标签时也拼（UALCAN 的校名被 <font> 切成 6 段、PubMed 的
    // <span>09</span>:<span>15</span>）；<a> 与表单控件不在此列——把链接/input 拍平成文本
    // 等于拆掉站点的可点区域，而且关脚本也回不来。
    // 形态判定只走一遍子节点：有 <a>/控件/注释就立刻放弃（这是最常见的分支），
    // 文本本身交给原生 textContent 一次取回，比逐节点拼字符串快得多。
    var kidCount = 0, shapeOk = true;
    for (var si = 0; si < el.childNodes.length; si++) {
      var sc = el.childNodes[si];
      if (sc.nodeType === 3) { if (String(sc.nodeValue || "").trim()) kidCount++; continue; }
      if (sc.nodeType !== 1) { shapeOk = false; break; }
      if (!INLINE_TAGS[sc.tagName] || /^(A|INPUT|BUTTON|SELECT|TEXTAREA|IMG|SVG)$/.test(sc.tagName)) { shapeOk = false; break; }
      if (sc.firstChild) kidCount++;
    }
    if (!shapeOk || kidCount < 2) return false;
    var flat = String(el.textContent || "").replace(/\s+/g, " ").trim();
    // 整句 exact 上限放到 400：ClinVar 帮助页那种「The <b>comprehensive data extractions</b>
    // occur weekly, so that …」把一句话切成三段，长度 120–300，若连 exact 都不许拼，
    // 人工核对过的整句译文永远进不来。规则通道仍限 120（见下），不让长正文靠规则拼。
    var SPLIT_EXACT_MAX = 400;
    if (flat.length < 3 || flat.length > SPLIT_EXACT_MAX) return false;
    if (hasCJK(flat) || !LETTER.test(flat)) return false;
    // 与 handleBrJoin 同一个坑：「Accession: … First in ClinVar: … Last updated: …」
    // 拍平后一条贪婪规则会把后面几个「标签: 值」全吞进 $1，然后整块锁定成单节点。
    var splitLabels = flat.match(/(?:^|\s)[A-Z][A-Za-z0-9 ()]{1,28}:\s/g);
    if (splitLabels && splitLabels.length >= 2) return false;
    // 长句只在整条命中词表时才拼（脚注被站点拆成「¹ 」+ 句子两段）；
    // 短标签仍允许走规则，避免长正文靠规则拼出半中半英。
    var out = lookupExact(flat);
    var full = flat, alt = null;
    if (out === null) {
      // 拼接时不能一律补空格：UALCAN 的标题被 <font> 从单词中间切开
      //（"The " + <font>U</font> + "niversity of " …），补空格会变成 "U niversity"。
      // 所以主候选是原样拼（flat），查不到才退到「逐段加空格」的变体（cBio 的换行分段）。
      var parts = [];
      for (var pi = 0; pi < el.childNodes.length; pi++) {
        var pc = el.childNodes[pi];
        var pt = String(pc.nodeType === 3 ? pc.nodeValue || "" : pc.textContent || "").trim();
        if (pt) parts.push(pt);
      }
      full = parts.join(" ");
      alt = full !== flat ? full : null;
      if (alt !== null) out = lookupExact(alt);
    }
    // 规则通道的触发上限提到 120（与上面的长度闸一致）：r31 实测 61–120 字符、
    // 被 <b>/<a>/<span> 切成 2–3 段的整句（InterPro 的 Found an exact gene match for P53…）
    // 原先既没有整串 exact、也进不了规则通道，规则写了却永不命中。
    // 规则通道先试"原样拼"（flat）：OMIM®: 这种上标被 <span> 拆开、拼回去不能加空格，
    // 只试加空格变体会让规则永远不命中。再试加空格的变体（cBio 的换行分段）。
    if (out === null && flat.length <= 120) out = translate(flat);
    if (out === null && alt !== null && full.length <= 120) out = translate(full);
    if (out === null) return false;
    if (!blockOriginals.has(el)) {
      blockOriginals.set(el, Array.prototype.slice.call(el.childNodes));
      origText.set(el, String(el.textContent || ""));
    }
    try { el.setAttribute("data-biol10n-block", "1"); } catch (e) { /* ignore */ }
    while (el.firstChild) el.removeChild(el.firstChild);
    el.appendChild(doc.createTextNode(out));
    stats.split = (stats.split || 0) + 1;
    return true;
  }

  function handleBrJoin(node, el) {
    if (!el) el = node.parentElement;
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
    // 元数据块（ClinVar 提交块的 "Accession: SCV… First in ClinVar: … Last updated: …"）：
    // 拼接后一条 ^Accession: (.+)$ 会把后面两个「标签: 值」一起吞进 $1，
    // 然后整块被替换并打 data-biol10n-block，子节点永远没机会翻。
    // 同一块里出现 ≥2 个「标签:」时放弃拼接，让每个子节点各自走 exact/规则。
    var labelHits = full.match(/(?:^|\s)[A-Z][A-Za-z0-9 ()]{1,28}:\s/g);
    if (labelHits && labelHits.length >= 2) return false;
    var out = translate(full);
    if (out === null) return false;
    // dt 里挂着 tooltip/帮助图标（ClinVar 的 GMAF）：整块 textContent 覆盖会把说明气泡和
    // 图标一起删掉。这种元素只改可见文本节点，隐藏子树原样留在 DOM 里。
    if (hasHiddenDescendant(el)) {
      var seen = false;
      (function writeVisible(node) {
        for (var c = node.firstChild; c; ) {
          var next = c.nextSibling;
          if (c.nodeType === 3) {
            if (!seen) { if (!originals.has(c)) originals.set(c, c.nodeValue); c.nodeValue = out; seen = true; }
            else { if (!originals.has(c)) originals.set(c, c.nodeValue); c.nodeValue = ""; }
          } else if (c.nodeType === 1) {
            if (c.tagName === "BR") { node.removeChild(c); }
            else if (!isHiddenSubtree(c)) writeVisible(c);
          }
          c = next;
        }
      })(el);
      if (seen) { brDone.add(el); stats.br = (stats.br || 0) + 1; return true; }
    }
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
    if (!blockOriginals.has(el)) {
      blockOriginals.set(el, Array.prototype.slice.call(el.childNodes));
      origText.set(el, String(el.textContent || ""));
    }
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
      if (!el || /^(SCRIPT|STYLE|NOSCRIPT|TEXTAREA|PRE|CODE)$/i.test(el.tagName)) continue;
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

  /** 只修「已经被翻坏」的中文串（括号错配、半角残留）。
   *  cleanupPass 跑在翻译之后，且不看 processed 标记——坏串往往是上一轮
   *  就已经写进节点的，普通规则不会再碰它。 */
  function repairText(s) {
    if (!hasRepairRules) return String(s || "");
    var cur = String(s || "");
    if (!hasCJK(cur)) return cur;
    for (var pass = 0; pass < 4; pass++) {
      var changed = false;
      for (var j = 0; j < rules.length; j++) {
        if (!rules[j].repair) continue;
        var m = rules[j].re.exec(cur);
        if (!m) continue;
        var out = rules[j].to.replace(/\$(\d)/g, function (_, d) {
          var seg = m[Number(d)];
          return seg === undefined ? "" : seg;
        });
        if (out !== cur) { cur = out; changed = true; break; }
      }
      if (!changed) break;
    }
    return cur;
  }

  /** 无条件修复扫描：站点图表库会在我们翻完之后把标签重组成半翻串
  *  （cBio 饼图图例「混合组织学（非特指：30 (2.8%）」），这类节点已经被
  *  标记为 processed，普通通道不会再碰，只能每轮扫一遍。 */
  function repairSweep(root) {
    if (!hasRepairRules || !root || !root.querySelectorAll) return;
    var w = doc.createTreeWalker(root, 4, null, false), n;
    while ((n = w.nextNode())) {
      var v = String(n.nodeValue || "");
      if (!v || !hasCJK(v)) continue;
      var fixed = repairText(v);
      if (fixed === v) continue;
      if (!originals.has(n)) originals.set(n, v);
      n.nodeValue = fixed;
      stats.repair = (stats.repair || 0) + 1;
    }
  }
  function cleanupPass(root) {
    if (!root || !root.querySelectorAll) return;
    var w = doc.createTreeWalker(root, 4, null, false), n;
    while ((n = w.nextNode())) {
      var v = String(n.nodeValue || "");
      if (!v) continue;
      // 本通道只修中文标点、重复句号与字面 <br>：成段英文/编号（表格数据占绝大多数）
      // 直接跳过，省掉后面每条正则。纯空白与 ≤2 字符的标点节点必须放行（它们是修复对象）。
      if (v.length > 2 && v.indexOf("<") < 0 && !CJK.test(v) && !/^\s*[)\]]/.test(v) && !/^\s+$/.test(v)) continue;
      // 页面把转义标签当文本渲染出来（NCBI MeSH 的 brieflinkpopdesc 里是字面 <br/>）：
      // 不清理的话用户看到的是「…factors.<br/>Year introduced: 1966」。
      if (/<\s*br\s*\/?>/i.test(v) && !inBlock(n.parentElement) && !inSkip(n.parentElement)) {
        var fixed = v.replace(/\s*<\s*br\s*\/?>\s*/gi, " ");
        if (!originals.has(n)) originals.set(n, v);
        n.nodeValue = fixed;
        v = fixed;
      }
      var repaired = repairText(v);
      if (repaired !== v) {
        if (!originals.has(n)) originals.set(n, v);
        n.nodeValue = repaired;
        v = repaired;
      }
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
      // 前一个字符是「（」也要吃掉后面的空格：「…多个文件（ 文件数上限）」
      if (lead && /[\u3400-\u9fff，。、；：！？）（]$/.test(neighborChar(n, -1)) && /^[\u3400-\u9fff，。、；：！？）]/.test(changed.replace(/^\s+/, ""))) {
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

  /** 属性里的字面 <br>：HPA 的 title="Myonuclei c-0<br>Reliability: High<br>19.1 nuclei"
   *  把换行写进了属性值，整串查表永远不中。按 <br> 切开逐段翻，再用 · 连接（r25 P1-A）。 */
  function translateBrAttr(raw) {
    var parts = String(raw).split(/<br\s*\/?>/i);
    if (parts.length < 2) return null;
    // 先试整串：站点有时只是为了让文字换行而插 <br />，一句完整的话被切成两段后
    // 每段都不是完整句（HPA 的 "…in kidney" + "shows microvilli localization…"），
    // 逐段查表两边都落空。整串（<br> 换成空格）能命中词库时优先用整串。
    // 只试整串查表（lookupExact），不放规则进来：规则是"句首模板 + 贪婪捕获"，
    // 对"细胞类型<br>器官<br><br>数值 nCPM"这种多段 tooltip 会整串吞掉（r32 HPA 实测）。
    var whole = normalize(parts.join(" "));
    if (whole && !hasCJK(whole) && LETTER.test(whole)) {
      var wholeOut = lookupExact(whole);
      if (wholeOut !== null) return wholeOut;
    }
    var any = false;
    var out = parts.map(function (p) {
      var t = normalize(p);
      if (!t || hasCJK(t) || !LETTER.test(t)) return p;
      var v = translate(t);
      if (v === null) return p;
      any = true;
      return v;
    });
    if (!any) return null;
    // 连续 <br> 会切出空段，直接 join 会出现「神经元 · 眼 ·  · 细胞名」的双分隔符（r32 HPA）。
    return out.filter(function (p) { return normalize(p).length > 0; }).join(" · ");
  }

  /** 属性里的 HTML 片段（UCSC hgTracks 的 <b>Transcript:</b> ENST… <br><b>Strand:</b> +、
   *  hgGeneGraph 的 <b>INS-PRKAG1</b> <ul><li>No curated information</ul>）：整串不可能命中，
   *  <br> 分段又只处理换行。按标签切开、只翻文本段，标签原样拼回。 */
  function translateHtmlAttr(raw) {
    var parts = String(raw).split(/(<[^>]*>)/);
    if (parts.length < 3) return null;
    var any = false;
    for (var i = 0; i < parts.length; i += 2) {
      var seg = parts[i];
      if (!seg) continue;
      // 段首尾的空白与 &nbsp; 实体不参与查表，但要原样留着（UCSC 用两个 &nbsp; 做缩进）
      var m = /^([\s]*(?:&nbsp;[\s]*)*)(.*?)((?:[\s]*&nbsp;)*[\s]*)$/.exec(seg);
      if (!m) continue;
      var lead = m[1], core = m[2], tail = m[3];
      var t = normalize(core);
      if (!t || hasCJK(t) || !LETTER.test(t)) continue;
      var v = translate(t);
      if (v === null) continue;
      // 标签式键（Transcript: / Strand:）的冒号会被通用「Transcript」词条吃掉，这里补回
      if (/:$/.test(core) && !/[:：]$/.test(v)) v += "：";
      parts[i] = lead + v + tail;
      any = true;
    }
    return any ? parts.join("") : null;
  }

  function handleAttributesInner(el) {
    if (!enabled || !el || !el.getAttribute) return;
    // OPTGROUP 的分组名只在 label 属性里，不在默认属性表里；OPTION[value] 是提交参数，绝不能动。
    if (el.tagName === "OPTGROUP" && el.getAttribute) {
      var lab = el.getAttribute("label");
      if (lab) {
        var labText = normalize(lab);
        if (labText.length >= 2 && !hasCJK(labText) && LETTER.test(labText)) {
          var labOut = translate(labText);
          if (labOut !== null) {
            var labStore = originals.get(el) || {};
            if (!("label" in labStore)) labStore.label = lab;
            originals.set(el, labStore);
            el.setAttribute("label", labOut);
            stats.attrs++;
          }
        }
      }
    }
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
      // GTEx 的 <table summary="false"> 是布尔占位，不是说明句
      if (name === "summary" && /^(true|false)$/i.test(String(v).trim())) continue;
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
      // 站点 skip 有时挡掉整块（cBio 的 h3 数据集名），但块里的按钮/链接说明仍该翻；
      // site.attrSkipFree 列出「即使祖先在 skip 里，属性也照样处理」的选择器。
      if (inSkip(el)) {
        var free = (site && site.attrSkipFree) || [];
        var rescued = false;
        for (var fi = 0; fi < free.length; fi++) {
          try { if (el.closest(free[fi])) { rescued = true; break; } } catch (e5) { /* 选择器写错就当没写 */ }
        }
        if (!rescued) continue;
      }
      var out = translate(text);
      // 字面 <br> 的属性值（HPA 图例 tooltip）：整串不中时再按段翻一次
      if (out === null && /<br\s*\/?>/i.test(String(v))) out = translateBrAttr(v);
      // 更一般的属性内 HTML（<b>/<ul>/<i> 等）：按标签切段、只翻文本段
      if (out === null && /<[a-z][^>]*>/i.test(String(v))) out = translateHtmlAttr(v);
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
      // React 受控输入：属性改了但 property 没改，用户看到的还是英文
      // （RCSB 检索框 value 属性已是中文，input.value 仍是 Text search inside all attributes）。
      // 只同步 property，不派发 input/change 事件，避免触发站点的 onChange 去发请求。
      if (name === "value" && site.valueText && el.tagName === "INPUT") {
        try { el.value = out; } catch (e3) {}
        // React 受控输入会在下一次 render 把 property 重置回英文（RCSB 检索框）。
        // 只在「值又变回英文原文、且没有被聚焦」时补写一次；用户手动输入过的不覆盖。
        var keepWatch = function (delay) {
          setTimeout(function () {
            try {
              if (!el.isConnected || el === doc.activeElement) return;
              if (el.value === v) el.value = out;
            } catch (e4) {}
          }, delay);
        };
        keepWatch(60);
        keepWatch(400);
      }
      stats.attrs++;
    }
  }

  function walk(root, preEls) {
    if (!root) return;
    if (root.nodeType === 3) { handleTextNode(root); return; }
    if (root.nodeType !== 1 && root.nodeType !== 9 && root.nodeType !== 11) return;
    // shadow root 是 DocumentFragment（nodeType 11），没有 handleAttributes 自己那一层，
    // 但它的后代照样要走属性通道（InterPro 的按钮 title、输入框 placeholder 都在 shadow 里）。
    // preEls 是 scan 已经查好的元素表：一次 querySelectorAll("*") 同时供段落、模板、属性三条通道用，
    // 省掉两轮全量选择器查询（大页面上是几百毫秒）。
    if (root.nodeType === 1 || root.nodeType === 11) {
      if (root.nodeType === 1 && hasTargetAttr(root)) handleAttributes(root);
      // 属性通道复用 scan 已经查好的元素表：hasAttribute 探测比再一次属性选择器
      // 全量查询快得多（36k 元素：14ms vs 58ms）。
      if (preEls) {
        for (var pi = 0; pi < preEls.length; pi++) {
          var pe2 = preEls[pi];
          if (hasTargetAttr(pe2)) handleAttributes(pe2);
        }
      } else {
        var sub;
        try {
          sub = root.querySelectorAll ? root.querySelectorAll(ATTR_SELECTOR) : [];
        } catch (e) { sub = []; }
        for (var i = 0; i < sub.length; i++) handleAttributes(sub[i]);
      }
      // OPTGROUP 的 label 不在默认属性表里，单独补一遍
      if (root.querySelector) {
        var ogs;
        try { ogs = root.querySelectorAll("optgroup[label]"); } catch (e2) { ogs = []; }
        for (var oi = 0; oi < ogs.length; oi++) handleAttributes(ogs[oi]);
      }
    }
    var walker = doc.createTreeWalker(root, 4 /* SHOW_TEXT */, null, false);
    var batch = [];
    var n;
    while ((n = walker.nextNode())) batch.push(n);
    if (!scanBudget || batch.length < 40) {
      for (var k0 = 0; k0 < batch.length; k0++) handleTextNode(batch[k0]);
      return;
    }
    // scan() 开头定了一个总截止时间：本轮预算用完就把整批节点排进 backlog。
    // 文档顺序基本等于从上到下，所以首屏/视口附近的文字天然先翻。
    var t0b = Date.now();
    // scan() 里的 walk 共用同一个总截止时间；flush()/mutation 触发的 walk 没有 scan 上下文
    //（或 scanDeadline 已过期），各自从调用时刻起算一份预算。
    var dl = scanDeadline > t0b ? scanDeadline : t0b + scanBudget;
    var cut = -1;
    for (var k = 0; k < batch.length; k++) {
      if (Date.now() >= dl || (k && k % 50 === 0 && Date.now() - t0b >= scanBudget)) { cut = k; break; }
      handleTextNode(batch[k]);
    }
    if (cut >= 0) {
      for (var r = cut; r < batch.length; r++) enqueueBacklog(batch[r]);
      stats.backlog = textBacklog.length - backlogAt;
      scheduleBacklog();
    }
  }

  function enqueueBacklog(n) {
    if (processed.has(n) || backlogQueued.has(n)) return;
    backlogQueued.add(n);
    textBacklog.push(n);
  }

  /** backlog 的下一段从 backlogAt 开始消费；整批清空时把数组一起丢掉，避免无限增长。 */
  function scheduleBacklog() {
    if (!enabled || backlogAt >= textBacklog.length || backlogTimer) return;
    var run = function () { backlogTimer = null; drainBacklog(); };
    if (win.requestIdleCallback) backlogTimer = win.requestIdleCallback(run, { timeout: 500 });
    else backlogTimer = setTimeout(run, 16);
  }
  function drainBacklog() {
    if (!enabled) return;
    var t = Date.now(), n = 0;
    while (backlogAt < textBacklog.length) {
      var bk = textBacklog[backlogAt++];
      backlogQueued.delete(bk);
      handleTextNode(bk);
      if (++n % 50 === 0 && Date.now() - t >= scanBudget) break;
    }
    if (backlogAt >= textBacklog.length) { textBacklog = []; backlogAt = 0; }
    stats.backlog = textBacklog.length - backlogAt;
    if (backlogAt < textBacklog.length) scheduleBacklog();
  }

  /** 把 site.scopedExact 里各选择器命中的元素登记下来（Element -> 该元素适用的精确表）。 */
  function markScoped(root) {
    if (!scopedList.length || !root || !root.querySelectorAll) return;
    for (var i = 0; i < scopedList.length; i++) {
      var entry = scopedList[i], els;
      try { els = root.querySelectorAll(entry.sel); } catch (e) { continue; }
      for (var j = 0; j < els.length; j++) scopedEls.set(els[j], entry.map);
    }
  }

  /** 从文本节点的父元素往上找最多 3 层，看它是否落在某个 scoped 选择器里。 */
  function scopedFor(el) {
    var hops = 0;
    while (el && hops < 3) {
      var m = scopedEls.get(el);
      if (m) return m;
      el = el.parentElement;
      hops++;
    }
    return null;
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
  var PARAS_TAGS = { P: 1, DD: 1, LI: 1, TD: 1, TH: 1, SPAN: 1 };
  function translateParagraphs(root, preEls) {
    if (!root || !root.querySelectorAll) return;
    var els;
    if (preEls) els = preEls;
    else {
      try { els = root.querySelectorAll("p, dd, li, td, th, span"); } catch (e) { return; }
    }
    for (var i = 0; i < els.length; i++) {
      var el = els[i];
      if (preEls && !PARAS_TAGS[String(el.tagName || "").toUpperCase()]) continue;
      if (el.getAttribute && el.getAttribute("data-biol10n-block")) continue;
      // 先按原串长度粗筛：整段文案至少 100 字符。大表格里绝大多数单元格是短标签，
      // 这一句把它们挡在 inBlock/inSkip/parasSubFlags（三次 closest）之前。
      var raw = el.textContent || "";
      if (raw.length < 100) continue;
      if (inBlock(el) || inSkip(el)) continue;
      var subFlags = parasSubFlags(el, 0);
      if (subFlags & SUB_BLOCK) continue;
      // 列表项整段替换会连里面的链接一起抹掉，所以只收没有链接的 li
      if (String(el.tagName || "").toUpperCase() === "LI" && (subFlags & SUB_ANCHOR)) continue;
      var text = normalize(raw);
      if (text.length < 100 || text.length > 1800 || hasCJK(text)) continue;
      var hit = lookupExact(text);
      if (hit === null || !hasCJK(hit)) continue;
      if (!blockOriginals.has(el)) {
        blockOriginals.set(el, Array.prototype.slice.call(el.childNodes));
        origText.set(el, String(el.textContent || ""));
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
      // 链接里嵌的内联 <svg> 图标（GDC 的「Download <svg/>」、EMBL-EBI 的箭头）：它没有可翻文本，
      // 整节点搬回去即可，不该让整段模板作废（r30 GDC 开发者页两段因此长期留英文）。
      if (k.tagName === "SVG" || k.tagName === "svg") continue;
      if (!k.tagName || !INLINE_TAGS[k.tagName]) return false;
      if (!isInlineSubtree(k)) return false;
    }
    return true;
  }

  /** 把块拆成「文本片段 + 内联元素占位符」的模板串；只收纯内联结构，遇到嵌套块返回 null。 */
  function buildTemplate(el) {
    if (!el || !el.firstChild) return null;
    var parts = [], slots = [], extras = [], tails = null;
    for (var c = el.firstChild; c; c = c.nextSibling) {
      if (c.nodeType === 3) { parts.push(String(c.nodeValue || "")); continue; }
      // 注释节点不渲染，但不该让整段模板失配（NCBI 的 <p> 里夹着 <!-- ... -->，
      // ClinVar FAQ 的「two variations submitted together in cis ...」就这样整段落空，
      // 逐节点翻完变成「前缀英文 + 尾巴中文」）。
      if (c.nodeType === 8) continue;
      if (c.nodeType !== 1) return null;
      var tn = c.tagName;
      // 图片按钮（Expression Atlas 下载页「… using the <img> button」）当普通槽位：
      // 模板里的 {{n}} 就是它的原位，译文放回图片它才不会丢。IMG 不在 INLINE_TAGS 里，
      // 走 extras 又拿不到位置（extras 没有对应占位符），所以单独放行。
      if (tn === "IMG") { slots.push(c); parts.push("{{" + slots.length + "}}"); continue; }
      // 正文里嵌的纯文字按钮（UCSC 首页「The <button>Reverse</button> button below the
      // tracks image…」）：整段只有按钮一个控件，模板替换会把原按钮放回 {{n}}，控件不丢。
      // 必须放在 INLINE_TAGS 闸之前——BUTTON 不在内联表里，走下面那条会被当成 tail 截断，
      // 模板只剩前缀文本、slots=0 直接作废（第一版就是这么写的，jsdom 里 tpl 一直是 0）。
      // handleSplitText 里 BUTTON 另有黑名单，不会把按钮拍平成文本。
      if (tn === "BUTTON" && !c.children.length) { slots.push(c); parts.push("{{" + slots.length + "}}"); continue; }
      // 块级子元素不再让整段作废：记下从它开始的兄弟节点当 tail，只给「内联前缀 + 尾部块级内容」
      // 这种形态建模板（ClinicalTrials 术语表的定义是「前缀文本 + <span class=term> + 结尾 <p>/<ul>」）。
      if (!tn || !INLINE_TAGS[tn]) { tails = []; for (var tb = c; tb; tb = tb.nextSibling) tails.push(tb); break; }
      // 只有图标的空内联元素（<a><svg/></a>、复制邮箱按钮）不占槽位：否则模板里多出一个
      // 空 {{n}}，写的模板永远对不上（MedGen 公告条尾部那个复制图标就是这种）。
      // 必须在 isInlineSubtree 之前判：<a> 里是 <svg>，它不是内联文本标签，否则整段模板直接作废。
      if (tn !== "BR" && !String(c.textContent || "").trim()) {
        extras.push({ after: slots.length, node: c });
        continue;
      }
      // <a><em>x</em></a> 允许（整节点当一个槽位）；<a><div>…</div></a> 拒绝
      if (tn !== "BR" && !isInlineSubtree(c)) return null;
      slots.push(c);
      parts.push("{{" + slots.length + "}}");
    }
    if (!slots.length) return null;
    var pat = normalize(parts.join(""));
    if (!pat || hasCJK(pat)) return null;
    if (pat.length < 20 || pat.length > 2200) return null;
    return { pat: pat, slots: slots, extras: extras, tails: tails };
  }

  var TPL_SELECTOR = "p, dd, dt, li, td, th, caption, figcaption, blockquote, span, div, " +
    "h1, h2, h3, h4, h5, h6, small, strong, b, em, i, label, section, article";
  /** 模板通道：整段命中带占位符的模板后，把 {{n}} 换成原来的内联元素，其余换成译文文本。
   *  占位符必须是 1..N 的一一对应，否则不替换（宁可留英文，也不丢链接）。 */
  // 模板通道的标签集合：与 TPL_SELECTOR 一一对应，供「共享元素表」快速分派
  var TPL_TAGS = {
    P: 1, DD: 1, DT: 1, LI: 1, TD: 1, TH: 1, CAPTION: 1, FIGCAPTION: 1, BLOCKQUOTE: 1,
    SPAN: 1, DIV: 1, H1: 1, H2: 1, H3: 1, H4: 1, H5: 1, H6: 1,
    SMALL: 1, STRONG: 1, B: 1, EM: 1, I: 1, LABEL: 1, SECTION: 1, ARTICLE: 1
  };
  function translateTemplates(root, preEls) {
    if (!root || !root.querySelectorAll || !tplMap.size) return;
    var els;
    // 模板会把内联元素放回中文里，所以 div 也安全；段落通道不行（它会整块换成纯文本，链路就没了）。
    // 内联文本容器同样要覆盖：ENA 检索页的「Uses <a>EBI Search</a> to perform …」挂在 <small> 上，
    // 旧选择器只有 p/li/span/div 等块级标签，这一整句模板写了却永远不会被尝试。
    if (preEls) els = preEls;
    else {
      try { els = root.querySelectorAll(TPL_SELECTOR); } catch (e) { return; }
    }
    for (var i = 0; i < els.length; i++) {
      var el = els[i];
      if (preEls && !TPL_TAGS[String(el.tagName || "").toUpperCase()]) continue;
      // 模板必须有「文字 + 至少一个槽位元素」才可能成立（单个 {{1}} 只有 6 字符，
      // 永远过不了 pat ≥20 的闸）：先看子节点形态，绝大多数表格单元格在这里就出局，
      // 不必构造 pat 字符串。
      var c0 = el.firstChild;
      if (!c0 || !c0.nextSibling) continue;
      var hasElem = false, hasText = false;
      for (var cc = c0; cc; cc = cc.nextSibling) {
        if (cc.nodeType === 1) hasElem = true;
        else if (cc.nodeType === 3 && String(cc.nodeValue || "").trim()) hasText = true;
        if (hasElem && hasText) break;
      }
      if (!hasElem || !hasText) continue;
      if (el.getAttribute && el.getAttribute("data-biol10n-block")) continue;
      // 已经按模板替换过的元素正常跳过；但站点框架会把整块重渲染回英文（ENA 的 Angular
      // 就把 {{1}} 链接换回 <a>Query Syntax documentation</a>），此后中文消失、标记还在，
      // 原逻辑会让这块永远是英文。判据只看现在还有没有汉字：没有就当作重渲染，允许再翻一次。
      if (el.getAttribute && el.getAttribute("data-biol10n-tpl")) {
        var nowVis = normalize(visibleJoinedText(el, []).join(""));
        if (hasCJK(nowVis)) continue;
        try { el.removeAttribute("data-biol10n-tpl"); } catch (e0) { /* ignore */ }
      }
      if (inBlock(el) || inSkip(el)) continue;
      // 含块级子元素的容器也放行：buildTemplate 只给内联前缀建模板，尾部块级节点原序补回。
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
        origText.set(el, String(el.textContent || ""));
      }
      var frag = doc.createDocumentFragment();
      var last = 0;
      re.lastIndex = 0;
      // 空图标元素（复制邮箱按钮之类）不占槽位，但要留在原地：挂在前面那个槽位后面
      var extras = t.extras || [], ei = 0, slotCount = 0;
      function pushExtras(after) {
        while (ei < extras.length && extras[ei].after <= after) { frag.appendChild(extras[ei].node); ei++; }
      }
      pushExtras(0);
      while ((m = re.exec(zh))) {
        var txt = zh.slice(last, m.index);
        if (txt) frag.appendChild(doc.createTextNode(txt));
        frag.appendChild(t.slots[Number(m[1]) - 1]);
        slotCount++;
        pushExtras(slotCount);
        last = m.index + m[0].length;
      }
      if (last < zh.length) frag.appendChild(doc.createTextNode(zh.slice(last)));
      while (el.firstChild) el.removeChild(el.firstChild);
      el.appendChild(frag);
      // 「内联前缀 + 尾部块级内容」形态：尾部节点按原序挂回，链接与事件都还在
      if (t.tails && t.tails.length) {
        for (var ti = 0; ti < t.tails.length; ti++) el.appendChild(t.tails[ti]);
      }
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
          origText.set(el, String(el.textContent || ""));
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
  /** 开放 shadow root 里的界面（InterPro 首页 8 个、ClinGen 1 个）：主文档的
   *  querySelectorAll / TreeWalker 都穿不过 shadow 边界，只能逐个根单独跑一遍。
   *  shadow root 里的选择器（p/li/td…）在局部同样有效，所以通道可以原样复用。 */
  var shadowSeen = new WeakSet();
  function collectShadowRoots(root, out) {
    if (!root || !root.querySelectorAll) return;
    var els;
    try { els = root.querySelectorAll("*"); } catch (e) { return; }
    for (var i = 0; i < els.length; i++) {
      var sr = els[i].shadowRoot;
      if (!sr || shadowSeen.has(sr)) continue;
      shadowSeen.add(sr);
      out.push(sr);
    }
  }

  function translateShadowRoots(root) {
    var roots = [];
    collectShadowRoots(root, roots);
    if (!roots.length) return;
    for (var i = 0; i < roots.length; i++) {
      var sr = roots[i];
      try {
        if (observer) {
          try {
            observer.observe(sr, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: attrs });
          } catch (e0) { /* ignore */ }
        }
        markScoped(sr);
        translateTemplates(sr);
        walk(sr);
        translateInlineInCJK(sr);
        cleanupPass(sr);
        stats.shadow = (stats.shadow || 0) + 1;
      } catch (e1) { /* shadow 里的异常不能打断主文档 */ }
      translateShadowRoots(sr);
    }
  }

  /** 同源 iframe（Ensembl BioMart 的 martview 就是把工具嵌在自己的 iframe 里）：
   *  主文档的选择器穿不过 frame 边界，但同源时 contentDocument 可访问，按 shadow 同样的
   *  通道各跑一遍。跨域 frame 的 contentDocument 读取会抛错或为 null，直接跳过。 */
  var frameSeen = new WeakSet();
  function collectFrames(root, out) {
    if (!root || !root.querySelectorAll) return;
    var els;
    try { els = root.querySelectorAll("iframe, frame"); } catch (e) { return; }
    for (var i = 0; i < els.length; i++) {
      var d = null;
      try { d = els[i].contentDocument; } catch (e2) { d = null; }
      if (!d) continue;
      var body = null;
      try { body = d.body || d.documentElement; } catch (e3) { body = null; }
      if (!body) continue;
      out.push(body);
    }
  }

  function translateFrames(root) {
    var bodies = [];
    collectFrames(root, bodies);
    if (!bodies.length) return;
    for (var i = 0; i < bodies.length; i++) {
      var body = bodies[i];
      try {
        // 一个 frame 文档只挂一次 observer；但内容每次都要重跑一遍：
        // frame 从 about:blank 换成真文档、或站内路由把内容整体替换时，旧 body 已经不在。
        if (observer && !frameSeen.has(body)) {
          frameSeen.add(body);
          try {
            observer.observe(body, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: attrs });
          } catch (e0) { /* ignore */ }
        }
        markScoped(body);
        translateParagraphs(body);
        translateTemplates(body);
        walk(body);
        translateInlineInCJK(body);
        cleanupPass(body);
        translateShadowRoots(body);
        stats.frames = (stats.frames || 0) + 1;
      } catch (e1) { /* frame 里的异常不能打断主文档 */ }
      translateFrames(body);
    }
  }

  /** 返回某个元素（或它最近的已替换祖先）被翻之前的英文文本；没有则 null。
   *  UI 的「对照」模式靠它悬停显示原文，用户不必关脚本刷新。 */
  function originalText(el) {
    if (!el || el.nodeType !== 1) return null;
    var cur = el, hops = 0;
    while (cur && hops < 6) {
      if (origText.has(cur)) return origText.get(cur);
      if (blockOriginals.has(cur)) return joinOrigKids(blockOriginals.get(cur));
      cur = cur.parentElement;
      hops++;
    }
    var parts = [], found = false;
    var w = doc.createTreeWalker(el, 4, null, false), n;
    while ((n = w.nextNode())) {
      if (originals.has(n)) { parts.push(String(originals.get(n))); found = true; }
      else if (processed.has(n)) parts.push(String(n.nodeValue || ""));
    }
    return found ? parts.join("") : null;
  }

  /** 按英文原文拼出正文：已翻译的节点取 originals，没翻的取现状。
   *  给「复制原文」用，不写 DOM、不重扫，避免闪烁。 */
  function englishText(root) {
    var body = root || doc.body;
    if (!body) return "";
    var SKIP = "script,style,noscript,template,svg,textarea,[data-biol10n-ui]";
    var w = doc.createTreeWalker(body, 4, null, false), n, parts = [];
    while ((n = w.nextNode())) {
      var p = n.parentElement;
      if (p && p.closest && p.closest(SKIP)) continue;
      parts.push(String((originals.has(n) ? originals.get(n) : n.nodeValue) || ""));
    }
    return parts.join("").replace(/[ \t\u00a0]+/g, " ").replace(/[ \t]*\n[ \t]*/g, "\n").trim();
  }

  function joinOrigKids(kids) {
    var s = "";
    for (var i = 0; i < kids.length; i++) s += String((kids[i] && kids[i].textContent) || "");
    return s;
  }

  function debugWhy(node) {
    if (!node || node.nodeType !== 3) return { error: "not a text node" };
    var raw = node.nodeValue, text = normalize(raw);
    var r = {
      raw: String(raw).slice(0, 60), text: String(text).slice(0, 60),
      processed: processed.has(node), connected: node.isConnected !== false,
      cjk: hasCJK(text), letter: LETTER.test(text), len: text.length,
      skip: skipNode(node), block: inBlock(node.parentElement), inSkip: inSkip(node.parentElement),
      prose: inLongProse(node),
      exact: lookupExact(text), parent: node.parentElement ? node.parentElement.tagName + "." + (node.parentElement.className || "") : null,
      split: node.parentElement ? node.parentElement.children.length : null, kids: node.parentElement ? node.parentElement.childNodes.length : null
    };
    return r;
  }

  function scan() {
    if (!enabled) return;
    resetNodeCaches();
    scanDeadline = scanBudget ? Date.now() + scanBudget : 0;
    var now = (typeof performance !== "undefined" && performance.now) ? function () { return performance.now(); } : function () { return 0; };
    var T = [now()];
    applyBlocks();
    var roots = scopeRoots();
    T.push(now());
    // 每个 root 只查一次元素表：段落、模板、属性三条通道共用，
    // 原来三条通道各查一次全量选择器，大页面上光查询就是几百毫秒。
    var elSets = [];
    for (var eq = 0; eq < roots.length; eq++) {
      // 转成真数组再传下去：jsdom 的 HTMLCollection/NodeList 每次按下标取元素都要新建一次
      // 接口包装（36k 元素上 22ms vs 数组 5ms），三条通道各遍历一遍就白付三次。
      var nl = roots[eq].querySelectorAll ? roots[eq].querySelectorAll("*") : null;
      elSets.push(nl && nl.length ? Array.prototype.slice.call(nl) : []);
    }
    for (var q = 0; q < roots.length; q++) { markScoped(roots[q]); translateParagraphs(roots[q], elSets[q]); }
    for (var tq = 0; tq < roots.length; tq++) translateTemplates(roots[tq], elSets[tq]);
    T.push(now());
    for (var i = 0; i < roots.length; i++) walk(roots[i], elSets[i]);
    scanDeadline = 0;
    T.push(now());
    for (var k = 0; k < roots.length; k++) translateInlineInCJK(roots[k]);
    T.push(now());
    for (var j = 0; j < roots.length; j++) cleanupPass(roots[j]);
    for (var rj = 0; rj < roots.length; rj++) repairSweep(roots[rj]);
    // shadow DOM 里的界面节点在主文档选择器之外，最后单独跑一遍（可嵌套）
    for (var sj = 0; sj < roots.length; sj++) translateShadowRoots(roots[sj]);
    // 同源 iframe（Ensembl BioMart）里的界面同样在主文档之外
    for (var fj = 0; fj < roots.length; fj++) translateFrames(roots[fj]);
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

  /** 上一轮 flush 因时间预算没用完的节点，下一拍接着处理。 */
  var flushPending = [];
  function flush() {
    timer = null;
    if (!enabled) { flushPending = []; return; }
    var items = flushPending.length ? flushPending.concat(Array.from(queue)) : Array.from(queue);
    flushPending = [];
    queue.clear();
    // 一屏渲染常在同一批里塞进几十个互相嵌套的节点（React 先插容器、再逐个填表），
    // 逐个 walk 会把同一棵子树重复翻十几遍。祖先已在队列里的直接跳过。
    if (items.length > 1) {
      var inQueue = new Set(items);
      items = items.filter(function (n) {
        var up = n.parentNode, hops = 0;
        while (up && hops++ < 10) {
          if (inQueue.has(up)) return false;
          up = up.parentNode;
        }
        return true;
      });
    }
    // 时间预算：页面持续渲染时（CELLxGENE 的数据集表格一秒能插上千行）一次 flush
    // 处理完所有节点会把主线程占住好几秒。超过 120ms 就把剩下的留到下一拍，
    // 翻译变成渐进式，滚动和点击不再卡顿。
    var budgetStart = 0;
    if (items.length > 40) budgetStart = Date.now();
    var pendingFrom = -1;
    for (var fi = 0; fi < items.length; fi++) {
      var n = items[fi];
      if (budgetStart && fi % 20 === 19 && Date.now() - budgetStart > 120) { pendingFrom = fi; break; }
      if (!n.isConnected && n !== doc) continue;
      var host = n.nodeType === 1 ? n : n.parentNode;
      // 动态插入的整块（NCBI 的改版公告、MedGen 公告条）必须也过一遍模板通道：
      // 否则只有 walk 的逐节点命中，会出现「根据第 14434 号行政令, federal agencies are …」这种半中半英。
      if (host && host.nodeType === 1) {
        var up = host.parentNode;
        translateTemplates(up && up.nodeType === 1 && up !== doc.body ? up : host);
      }
      walk(host);
      // 运行时才挂上的 shadow root（React 组件后插）不会被 scan 看到，flush 里补一次
      translateShadowRoots(host);
    }
    if (pendingFrom >= 0) {
      flushPending = items.slice(pendingFrom);
      if (!timer) timer = setTimeout(flush, 16);
    }
    translateFrames(doc.documentElement);
    // SPA 路由后 <title> 由 React Helmet 之类改写，改的是 head 里的文本节点：
    // 它不在 scope 内，walk 拿不到，也不会再触发 scan()，标题就停在占位串
    //（cBioPortal 的 "::Helmet"）。每次 flush 顺手校正一次标题，代价只是字符串比较。
    translateTitle();
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
    return splitTitle(t, 0);
  }

  var TITLE_SEPS = [" — ", " – ", " | ", " :: ", " · ", ": ", " - ", " < ", " / "];

  function splitTitle(t, depth) {
    for (var s = 0; s < TITLE_SEPS.length; s++) {
      var sep = TITLE_SEPS[s];
      if (t.indexOf(sep) < 0) continue;
      var parts = t.split(sep);
      if (parts.length < 2 || parts.length > 4) continue;
      var out = [], kept = [], ok = true, changed = false;
      for (var i = 0; i < parts.length; i++) {
        var p = String(parts[i]).trim();
        if (!p || p.length > 60) { ok = false; break; }
        var tr = lookupExact(p);
        if (tr !== null) { out.push(tr); changed = true; continue; }
        // 只切一层会留下半中半英：HPA 的 "Search: TP53 - The Human Protein Atlas"
        // 先被 ": " 切成 "Search" + "TP53 - The Human Protein Atlas"，后半段整段落进 kept，
        // 标题就成了「检索：TP53 - The Human Protein Atlas」。未命中的段再按其余分隔符
        // 拆一层（最多两层），拆不动就照旧整段保留。
        if (depth < 2) {
          var sub = splitTitle(p, depth + 1);
          if (sub) { out.push(sub.text); kept = kept.concat(sub.kept); changed = true; continue; }
        }
        out.push(p); kept.push(p);
      }
      if (!ok || !changed) continue;
      var bad = false;
      for (var q = 0; q < kept.length; q++) if (!keptOk(kept[q])) { bad = true; break; }
      if (bad) continue;
      return { text: out.join(sep === ": " ? "：" : sep), kept: kept };
    }
    return null;
  }

  var TITLE_BRANDS = {
    NCBI: 1, NLM: 1, PubMed: 1, GEO: 1, GDS: 1, GSE: 1, GDV: 1, BLAST: 1, SRA: 1, PMC: 1,
    Ensembl: 1, UniProt: 1, UniProtKB: 1, "RCSB": 1, PDB: 1, HPA: 1, UALCAN: 1, TIMER: 1,
    GTEx: 1, GDC: 1, "cBioPortal": 1, cBioPortal: 1, GEPIA: 1, KEGG: 1, UCSC: 1,
    miRBase: 1, TCGA: 1, EMBL: 1, EBI: 1, HGNC: 1, NCI: 1, "GEO DataSets": 1,
    ClinVar: 1, Clinvar: 1, HGVS: 1, MANE: 1, SPDI: 1, GMAF: 1, VCV: 1, RCV: 1, SCV: 1,
    dbSNP: 1, RefSeq: 1, "ClinGen": 1, "OMIM": 1, PharmGKB: 1,
    // 新站与 NCBI 目录站：标题里保留这些品牌名，否则整条标题会被 titleAcceptable 丢掉
    MedGen: 1, Medgen: 1, dbVar: 1, MeSH: 1, ORFfinder: 1, PubChem: 1, dbGaP: 1,
    BioSample: 1, CCDS: 1, STRING: 1, gnomAD: 1, ClinPGx: 1, GXA: 1, GenBank: 1,
    InterPro: 1, BioMart: 1, Europe: 1, Reactome: 1, PRIDE: 1, Expasy: 1, neXtProt: 1,
    Homepage: 1, Expression: 1, Atlas: 1, Genome: 1, Browser: 1, BioStudies: 1,
    AmiGO: 1, QuickGO: 1, ClinicalTrials: 1, Targets: 1, TargetScan: 1,
    AlphaFold: 1, PDBe: 1, HPO: 1, Rfam: 1, Ontology: 1, Resource: 1,
    Open: 1, Platform: 1, Gene: 1, Browser: 1,
    // r24 P1-1：这几类词出现在标题尾部（Home - Rfam Database、Expasy Help、
    // The NCBI Handbook - NCBI Bookshelf、Glossary Terms）时整条标题被判英文弃掉。
    Database: 1, Handbook: 1, Bookshelf: 1, Help: 1, Glossary: 1, Terms: 1,
    Study: 1, Studies: 1, Details: 1, Home: 1,
    // CT 的 ``List Results`` / ``Table Results`` 视图：没有规则时整条标题会被判英文
    List: 1, Table: 1, Results: 1,
    // GDC 流程页标题里保留的测序术语：整条标题已由词库翻成中文，只有这些缩写留下，
    // 不在白名单里就会被 titleAcceptable 整条退回（mRNA/miRNA 不是全大写，绕不过大小写兜底）。
    mRNA: 1, miRNA: 1, rRNA: 1, tRNA: 1, ncRNA: 1, lncRNA: 1, "DNA-Seq": 1, "RNA-Seq": 1
  };
  /** 标题里允许剩下的英文：品牌名、全大写缩写、带数字的标识符。 */
  /** 没有翻译、原样保留的标题分段：只允许"含品牌名/全大写/带数字"的段整段留下，
   *  避免 "breast cancer - GEO 数据集 - NCBI" 这种半截标题被当成合格结果。 */
  function keptOk(seg) {
    if (!seg || seg.length > 60) return false;
    var ws = seg.match(/[A-Za-z][A-Za-z0-9.+#-]*/g) || [];
    if (!ws.length) return true;
    // 段里带登录号（Kringle (IPR000001)、GCF_…）时，首字母大写的专名也算可保留；
    // 纯词组（breast cancer）没有编号，仍然拒绝，避免接受半截标题。
    var hasId = /[A-Za-z]*\d/.test(seg) || /\([A-Za-z]{2,}\d/.test(seg);
    var brandSeen = false;
    for (var i = 0; i < ws.length; i++) {
      var w = ws[i];
      if (TITLE_BRANDS[w] || w === w.toUpperCase() || /\d/.test(w) || w.length <= 2) { brandSeen = true; continue; }
      if (hasId && /^[A-Z]/.test(w)) { brandSeen = true; continue; }
      // 域名形态（ClinicalTrials.gov）：点是站点名的一部分，整段放行。
      if (/\./.test(w) && /^[A-Z][A-Za-z0-9-]*\.[a-z]{2,6}$/.test(w)) { brandSeen = true; continue; }
      return false;
    }
    return brandSeen;
  }
  function titleAcceptable(v, kept) {
    if (!hasCJK(v)) return false;
    var words = String(v).match(/[A-Za-z][A-Za-z0-9.+#-]*/g) || [];
    var allowed = {};
    (kept || []).forEach(function (seg) {
      var ws = String(seg).match(/[A-Za-z][A-Za-z0-9.+#-]*/g) || [];
      ws.forEach(function (w) { allowed[w] = 1; });
    });
    for (var i = 0; i < words.length; i++) {
      var w = words[i];
      if (allowed[w]) continue;
      if (TITLE_BRANDS[w]) continue;
      if (/\d/.test(w)) continue;
      if (w.length <= 2) continue;
      if (w === w.toUpperCase()) continue;
      if (/^[A-Z][A-Za-z0-9-]*\.[a-z]{2,6}$/.test(w)) continue;
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
    // 标题被 titleAcceptable 拒掉时，translate() 里已给 titleHit/titleRule 记了账。
    // 记的是"尝试过"而不是"翻成了"，会让 GEO 这种整条没翻的页面也显示 titleRule:8，回滚掉。
    var prevTitleHit = stats.titleHit || 0, prevTitleRule = stats.titleRule || 0;
    var v = lookupExact(t);
    var keptTitle = null;
    // 分段结果不合格时不能直接放弃：整条标题规则（HPA 的
    // "^Tissue expression of (.+) - Summary - The Human Protein Atlas$"）往往能一次翻完，
    // 原来 titleBySegments 返回半中半英后就被 titleAcceptable 丢掉，规则永远轮不到。
    if (v === null) {
      var segT = titleBySegments(t);
      if (segT !== null && titleAcceptable(segT.text, segT.kept)) { v = segT.text; keptTitle = segT.kept; }
    }
    if (v === null) v = translate(t);
    // 规则兜底也只接受"没剩下英文单词"的结果：剩下 ≥3 字母的小写单词说明只翻了半截
    // （"breast cancer - GEO 数据集 - NCBI"），宁可整条不动。
    // 例外：整条标题被某条规则命中（stats.titleRule 涨了）时，规则已经吃掉了整串，
    // 剩下的英文是槽位里的数据（ClinicalTrials 的检索词、Open Targets 的基因名），
    // 不能因为槽位是英文就整条退回。
    var ruleHit = (stats.titleRule || 0) > prevTitleRule;
    if (v !== null && !ruleHit && !titleAcceptable(v, keptTitle)) v = null;
    if (v === null) {
      stats.titleHit = prevTitleHit || undefined;
      stats.titleRule = prevTitleRule || undefined;
      return;
    }
    // 命中走的是 lookupExact / titleBySegments 时没有经过 translate()，
    // 不补一次记账，统计里只看得到规则命中、看不到直译命中（GTEx 标题就是这样漏的）。
    if (v !== t && (stats.titleHit || 0) === prevTitleHit && (stats.titleRule || 0) === prevTitleRule) bumpHit(false);
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
    flushPending = [];
    // 未消费的分片在关闭后不再翻：否则用户刚点「关闭」，几百毫秒后页面又冒出中文。
    if (backlogTimer) {
      if (win.cancelIdleCallback) { try { win.cancelIdleCallback(backlogTimer); } catch (e1) {} }
      clearTimeout(backlogTimer);
      backlogTimer = null;
    }
    textBacklog = [];
    backlogAt = 0;
    stats.backlog = 0;
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
    originalText: originalText,
    englishText: englishText,
    stats: stats,
    misses: function () { return Array.from(misses); },
    restore: restore
  };
}
