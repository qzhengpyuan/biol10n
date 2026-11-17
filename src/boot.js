/**
 * BioL10n boot：由构建脚本注入 DICT 与 SITES，运行时不做任何网络请求。
 */
(function () {
  "use strict";

  // 每本词库是独立的 JSON 字符串，只有本站用到的才会被解析（见 parseDict）。
  var DICT_SRC = __BIOL10N_DICT__;
  var SITES = __BIOL10N_SITES__;
  var parsedDicts = {};
  function parseDict(id) {
    if (parsedDicts[id] !== undefined) return parsedDicts[id];
    var s = DICT_SRC[id];
    var d = null;
    if (s) {
      try { d = JSON.parse(s); } catch (e) { d = null; }
    }
    parsedDicts[id] = d;
    return d;
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

  var exact = {};
  var rules = [];
  (site.dicts || ["common"]).forEach(function (id) {
    var d = parseDict(id);
    if (!d) return;
    Object.keys(d.exact || {}).forEach(function (k) { exact[k] = d.exact[k]; });
    if (d.rules) rules = rules.concat(d.rules);
  });

  var engine = createEngine({
    document: document,
    window: window,
    data: { exact: exact, rules: rules },
    site: {
      scope: site.scope || "",
      block: (SITES.defaults && SITES.defaults.block) || "",
      attrs: (SITES.defaults && SITES.defaults.attrs) || [],
      skip: site.skip || "",
      proseGuard: site.proseGuard !== false,
      proseMax: site.proseMax || 120,
      proseExempt: site.proseExempt || "",
      valueText: !!site.valueText,
      translateNoAllow: site.translateNoAllow || [],
      punctFix: site.punctFix !== false,
      rescan: site.rescan,
      blocks: site.blocks || [],
      spa: !!site.spa,
      waitFor: site.waitFor || ""
    }
  });

  engine.start();

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
      enable: function () { engine.enable(); }
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
})();
