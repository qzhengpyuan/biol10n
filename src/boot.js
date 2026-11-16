/**
 * BioL10n boot：由构建脚本注入 DICT 与 SITES，运行时不做任何网络请求。
 */
(function () {
  "use strict";

  var DICT = __BIOL10N_DICT__;
  var SITES = __BIOL10N_SITES__;

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
    var d = DICT[id];
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
      spa: !!site.spa,
      waitFor: site.waitFor || ""
    }
  });

  engine.start();

  // 调试接口：控制台里 __BIOL10N.stats() / __BIOL10N.misses()
  try {
    window.__BIOL10N = {
      stats: function () { return engine.stats; },
      misses: function () {
        var m = engine.misses();
        console.table(m);
        return m.length;
      },
      toggle: function () { engine.disable(); }
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
