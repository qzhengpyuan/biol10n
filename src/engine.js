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
    try { rules.push({ re: new RegExp(r.re), to: r.to, src: r.re }); } catch (e) { /* 坏规则直接跳过 */ }
  });

  var attrs = site.attrs && site.attrs.length ? site.attrs : DEFAULT_ATTRS;
  var processed = new WeakSet();
  var originals = new WeakMap();
  var misses = new Set();
  var stats = { nodes: 0, hitExact: 0, hitRule: 0, attrs: 0, skipped: 0 };
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

  /** 模板里的 $1..$9：能在词表里查到的就翻，查不到原样保留 */
  function translateCapture(seg) {
    var v = lookupExact(seg);
    if (v !== null) return v;
    var st = seg.replace(/^[\s"'“”‘’(\[]+|[\s"'“”‘’)\]]+$/g, "");
    if (st !== seg) {
      var v2 = lookupExact(st);
      if (v2 !== null) return v2;
    }
    return seg;
  }

  function translate(s) {
    var hitOnce = lookupExact(s);
    if (hitOnce !== null) { stats.hitExact++; return hitOnce; }
    for (var j = 0; j < rules.length; j++) {
      var m = rules[j].re.exec(s);
      if (m) {
        stats.hitRule++;
        var to = rules[j].to;
        return to.replace(/\$(\d)/g, function (_, d) {
          var seg = m[Number(d)];
          return seg === undefined ? "" : translateCapture(seg);
        });
      }
    }
    return null;
  }

  function recordMiss(text) {
    if (typeof onMiss === "function") onMiss(text);
    if (misses.size < 200 && text.length <= 80 && LETTER.test(text)) misses.add(text);
  }

  function skipNode(node) {
    var p = node.parentElement;
    var guard = 0;
    while (p && guard++ < 40) {
      if (SKIP_TAGS[p.tagName] === 1) return true;
      if (p.isContentEditable) return true;
      if (p.dataset && p.dataset.l10nScope === "off") return true;
      p = p.parentElement;
    }
    return false;
  }

  function inBlock(el) {
    if (!el || !el.closest) return false;
    try { return !!el.closest(BLOCK); } catch (e) { return false; }
  }

  function handleTextNode(node) {
    if (!enabled || processed.has(node)) return;
    var raw = node.nodeValue;
    if (!raw) return;
    var text = normalize(raw);
    if (text.length < 2) return;
    if (hasCJK(text)) return;
    if (!LETTER.test(text)) return;
    if (skipNode(node) || inBlock(node.parentElement)) { processed.add(node); return; }

    stats.nodes++;
    var out = translate(text);
    if (out === null) { recordMiss(text); processed.add(node); return; }

    var m = /^(\s*)([\s\S]*?)(\s*)$/.exec(raw);
    var lead = m ? m[1] : "";
    var trail = m ? m[3] : "";
    if (!originals.has(node)) originals.set(node, raw);
    node.nodeValue = lead + out + trail;
    processed.add(node);
  }

  function handleAttributes(el) {
    if (!enabled || !el || !el.getAttribute) return;
    for (var i = 0; i < attrs.length; i++) {
      var name = attrs[i];
      if (name === "value" && !(el.tagName === "INPUT" && /^(submit|button|reset)$/i.test(el.type))) continue;
      var v = el.getAttribute(name);
      if (!v) continue;
      var text = normalize(v);
      if (text.length < 2 || hasCJK(text) || !LETTER.test(text)) continue;
      if (skipNode(el) || inBlock(el)) continue;
      var out = translate(text);
      if (out === null) continue;
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

  function scan() {
    if (!enabled) return;
    var roots = scopeRoots();
    for (var i = 0; i < roots.length; i++) walk(roots[i]);
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
        setTimeout(scan, 400);
        return ret;
      };
    });
    win.addEventListener("popstate", function () { setTimeout(scan, 400); });
  }

  function restore() {
    doc.createTreeWalker(doc.body, 4, null, false);
    var nodes = [];
    var w = doc.createTreeWalker(doc.body, 4, null, false), n;
    while ((n = w.nextNode())) if (originals.has(n)) nodes.push(n);
    nodes.forEach(function (x) { x.nodeValue = originals.get(x); });
    doc.querySelectorAll("*").forEach(function (el) {
      var store = originals.get(el);
      if (!store) return;
      Object.keys(store).forEach(function (a) { el.setAttribute(a, store[a]); });
    });
  }

  function enable() { enabled = true; scan(); }
  function disable() { enabled = false; try { observer && observer.disconnect(); } catch (e) {} if (timer) clearTimeout(timer); restore(); }

  function start() {
    scan();
    startObserver();
    startRouteHooks();
    if (site.spa && site.waitFor) {
      var tries = 0;
      var iv = setInterval(function () {
        if (doc.querySelector(site.waitFor) || ++tries > 40) { clearInterval(iv); scan(); }
      }, 250);
    }
  }

  return {
    start: start, scan: scan, enable: enable, disable: disable,
    /** 干跑：只返回译文，不写 DOM，供覆盖率统计与词表调试使用 */
    translateText: function (s) { return translate(normalize(s)); },
    stats: stats,
    misses: function () { return Array.from(misses); },
    restore: restore
  };
}
