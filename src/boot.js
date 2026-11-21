/**
 * BioL10n boot：由构建脚本注入 DICT 与 SITES，运行时不做任何网络请求。
 * 词库在构建时 gzip + base64 打包，运行时只解压本站用到的那几本。
 */
(function () {
  "use strict";

  var DICT_SRC = __BIOL10N_DICT__;
  var SITES = __BIOL10N_SITES__;
  var VERSION = "__BIOL10N_VERSION__";
  var parsedDicts = {};
  var dictPromises = {};
  var t0 = (typeof performance !== "undefined" && performance.now) ? performance.now() : Date.now();
  var timing = { dict: 0, start: 0 };

  function decodeB64(s) {
    var bin = atob(s);
    var n = bin.length;
    var bytes = new Uint8Array(n);
    for (var i = 0; i < n; i++) bytes[i] = bin.charCodeAt(i);
    return bytes;
  }

  // 浏览器原生解压（Chrome 80+ / Firefox 113+ / Safari 16.4+）
  var canInflate = typeof DecompressionStream === "function" && typeof Blob === "function" && typeof Response === "function";

  function loadDict(id) {
    if (dictPromises[id]) return dictPromises[id];
    var b64 = DICT_SRC[id];
    if (!b64) return Promise.resolve(null);
    dictPromises[id] = new Response(
      new Blob([decodeB64(b64)]).stream().pipeThrough(new DecompressionStream("gzip"))
    ).text().then(function (text) {
      return JSON.parse(text);
    }).catch(function (e) {
      console.warn("[BioL10n] 词库解压失败:", id, e);
      return null;
    }).then(function (d) {
      parsedDicts[id] = d;
      return d;
    });
    return dictPromises[id];
  }

  var host = location.hostname || "";
  var path = location.pathname || "";

  function pick(list) {
    for (var i = 0; i < list.length; i++) {
      var s = list[i];
      var hosts = s.hosts || [];
      var ok = hosts.some(function (h) {
        return h === host || (h.charAt(0) === "*" && host.slice(-(h.length - 1)) === h.slice(1));
      });
      if (!ok) continue;
      if (s.path && !(new RegExp(s.path).test(path))) continue;
      return s;
    }
    return null;
  }

  var site = pick(SITES.sites);
  if (!site) return;
  if (!canInflate) {
    console.warn("[BioL10n] 当前浏览器不支持 DecompressionStream，脚本未启用");
    return;
  }

  Promise.all((site.dicts || ["common"]).map(loadDict)).then(function () {
    timing.dict = Math.round(((typeof performance !== "undefined" && performance.now) ? performance.now() : Date.now()) - t0);
    var exact = {};
    var rules = [];
    var templates = [];
    var dictInfo = [];
    (site.dicts || ["common"]).forEach(function (id) {
      var d = parsedDicts[id];
      if (!d) return;
      dictInfo.push({ id: id, count: Object.keys(d.exact || {}).length });
      Object.keys(d.exact || {}).forEach(function (k) { exact[k] = d.exact[k]; });
      if (d.rules) rules = rules.concat(d.rules);
      if (d.templates) templates = templates.concat(d.templates);
    });

    // 面板先建好：引擎第一次扫描就会产生"漏翻"回调，晚建会丢掉首页那一批。
    var ui = createBioL10nUI({
      site: { id: site.id, name: site.name || site.id },
      dicts: dictInfo,
      version: VERSION
    });

    var engine = createEngine({
      document: document,
      window: window,
      data: { exact: exact, rules: rules, templates: templates },
      site: {
        scope: site.scope || "",
        block: (SITES.defaults && SITES.defaults.block) || "",
        attrs: (SITES.defaults && SITES.defaults.attrs) || [],
        skip: site.skip || "",
        skipFree: site.skipFree || [],
        attrSkipFree: site.attrSkipFree || [],
        proseGuard: site.proseGuard !== false,
        proseMax: site.proseMax || 120,
        proseExempt: site.proseExempt || "",
        logSkip: site.logSkip || "",
        valueText: !!site.valueText,
        translateNoAllow: site.translateNoAllow || [],
        punctFix: site.punctFix !== false,
        rescan: site.rescan,
        blocks: site.blocks || [],
        spa: !!site.spa,
        waitFor: site.waitFor || ""
      },
      onMiss: function (text, ctx) { ui.addMiss(text, ctx); }
    });

    ui.attach(engine);
    engine.start();
    timing.start = Math.round(((typeof performance !== "undefined" && performance.now) ? performance.now() : Date.now()) - t0);

    // 调试接口：控制台里 __BIOL10N.stats() / __BIOL10N.misses()
    try {
      window.__BIOL10N = {
        stats: function () { return engine.stats; },
        scan: function () { engine.scan(); return engine.stats; },
        why: function (el) {
          var n = el && el.nodeType === 3 ? el : el && el.firstChild;
          return engine.debugWhy(n);
        },
        misses: function () {
          var m = engine.misses();
          console.table(m);
          return m.length;
        },
        // 真正的开关：关时 restore，再开时重新扫（engine.enable 会重置 processed）
        toggle: function () {
          if (engine.stats && engine.stats.enabled === false) engine.enable();
          else engine.disable();
          return engine.stats && engine.stats.enabled !== false;
        },
        disable: function () { engine.disable(); },
        enable: function () { engine.enable(); },
        ui: ui,
        tpl: function () { return { count: templates.length }; },
        timing: function () { return timing; }
      };
    } catch (e) { /* 页面可能禁止写 window */ }

    // Alt+Shift+L 一键切回英文
    window.addEventListener("keydown", function (e) {
      if (e.altKey && e.shiftKey && (e.key === "L" || e.key === "l")) {
        editorToggle(engine);
      }
    }, true);

    var chinese = true;
    function editorToggle(eng) {
      if (chinese) { eng.disable(); chinese = false; }
      else { eng.enable(); chinese = true; }
    }
  });
})();
