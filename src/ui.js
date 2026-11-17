/**
 * BioL10n 设置面板：悬浮按钮 + 站点/词库/统计 + 未翻译文本收集（默认关闭）。
 * 设计约束：全部离线、不联网；不碰页面功能；面板自身文字永不参与翻译。
 */
function bioL10nLS() {
  try {
    return (typeof window !== "undefined" && window.localStorage) || null;
  } catch (e) { return null; }
}

function bioL10nReadSettings() {
  var def = { log: false, badge: true, open: false };
  var ls = bioL10nLS();
  if (!ls) return def;
  try {
    var raw = ls.getItem("biol10n:settings");
    if (!raw) return def;
    var v = JSON.parse(raw);
    if (v && typeof v === "object") {
      def.log = !!v.log;
      def.badge = v.badge !== false;
    }
  } catch (e) { /* 隐私模式/禁用存储时用默认值 */ }
  return def;
}

function bioL10nSaveSettings(s) {
  var ls = bioL10nLS();
  if (!ls) return;
  try { ls.setItem("biol10n:settings", JSON.stringify({ log: !!s.log, badge: s.badge !== false })); } catch (e) {}
}

function createBioL10nUI(opts) {
  opts = opts || {};
  var doc = document;
  var win = window;
  var site = opts.site || {};
  var dicts = opts.dicts || [];
  var version = opts.version || "";
  var settings = bioL10nReadSettings();
  var engine = null;
  var settingsOpen = false;
  var logKey = "biol10n:log:" + (win.location.hostname || "");
  var entries = [];
  var persistTimer = null;
  var badge = null, panel = null;
  var dirty = true;
  var nodes = {};

  // ---------- 未翻译文本收集 ----------
  function loadEntries() {
    try {
      var raw = win.localStorage.getItem(logKey);
      var arr = raw ? JSON.parse(raw) : [];
      if (Array.isArray(arr)) entries = arr.filter(function (x) { return x && typeof x.t === "string"; }).slice(-400);
    } catch (e) { entries = []; }
  }
  function persist() {
    if (persistTimer) return;
    persistTimer = win.setTimeout(function () {
      persistTimer = null;
      try { win.localStorage.setItem(logKey, JSON.stringify(entries)); } catch (e) { /* 配额满就只留内存 */ }
    }, 600);
  }
  /** 引擎对每个没命中的文本节点都会调这里；开关关着时直接丢，不占内存。 */
  function addMiss(text, ctx) {
    if (!settings.log) return;
    if (ctx && ctx.skipLog) return;
    var t = String(text || "").replace(/\s+/g, " ").trim();
    if (t.length < 3 || t.length > 400) return;
    if (/[\u3400-\u4dbf\u4e00-\u9fff\uf900-\ufaff]/.test(t)) return;
    var page = win.location.pathname || "/";
    for (var i = entries.length - 1; i >= 0 && i >= entries.length - 60; i--) {
      if (entries[i].t === t && entries[i].p === page) return;
    }
    entries.push({ t: t, p: page, g: ctx && ctx.tag ? ctx.tag : "", ts: Date.now() });
    if (entries.length > 400) entries = entries.slice(-400);
    dirty = true;
    persist();
    if (settingsOpen) refresh();
  }

  // ---------- DOM ----------
  function el(tag, cls, text) {
    var n = doc.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  }

  var CSS = [
    "[data-biol10n-ui]{box-sizing:border-box;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,'PingFang SC','Microsoft YaHei',sans-serif}",
    "[data-biol10n-ui] *{box-sizing:border-box}",
    ".bl-badge{position:fixed;right:14px;bottom:14px;width:32px;height:32px;border-radius:50%;border:1px solid rgba(0,0,0,.15);background:#1a73e8;color:#fff;font-size:14px;line-height:30px;text-align:center;cursor:pointer;z-index:2147483647;box-shadow:0 2px 8px rgba(0,0,0,.25);opacity:.72;transition:opacity .15s,transform .15s;padding:0;user-select:none}",
    ".bl-badge:hover{opacity:1;transform:scale(1.06)}",
    ".bl-badge.bl-off{background:#6b7280}",
    ".bl-panel{position:fixed;right:14px;bottom:54px;width:340px;max-height:72vh;overflow:auto;background:#fff;color:#1f2328;border:1px solid #d0d7de;border-radius:10px;box-shadow:0 8px 28px rgba(0,0,0,.28);z-index:2147483647;font-size:12px;line-height:1.55;padding:0}",
    ".bl-hd{display:flex;align-items:center;gap:6px;padding:9px 11px;border-bottom:1px solid #eaeef2;font-weight:600;font-size:13px;position:sticky;top:0;background:#fff;border-radius:10px 10px 0 0}",
    ".bl-hd .bl-v{font-weight:400;color:#8c959f;font-size:11px}",
    ".bl-x{margin-left:auto;cursor:pointer;color:#8c959f;font-size:16px;line-height:1;padding:0 2px;background:none;border:0}",
    ".bl-x:hover{color:#1f2328}",
    ".bl-body{padding:9px 11px}",
    ".bl-row{display:flex;gap:6px;margin-bottom:5px}",
    ".bl-k{color:#6e7781;flex:0 0 44px}",
    ".bl-vv{flex:1;min-width:0;word-break:break-all}",
    ".bl-chips{display:flex;flex-wrap:wrap;gap:4px}",
    ".bl-chip{background:#eef4ff;border:1px solid #c9ddff;color:#12408c;border-radius:5px;padding:0 5px;font-size:11px;line-height:17px}",
    ".bl-stats{display:flex;gap:10px;flex-wrap:wrap;margin:6px 0 2px;color:#24292f}",
    ".bl-stats b{font-weight:600}",
    ".bl-sec{border-top:1px solid #eaeef2;margin-top:8px;padding-top:8px}",
    ".bl-title{font-weight:600;margin-bottom:5px;display:flex;align-items:center;gap:6px}",
    ".bl-switch{margin-left:auto;display:inline-flex;align-items:center;gap:5px;font-weight:400;color:#57606a;cursor:pointer}",
    ".bl-hint{color:#8c959f;font-size:11px;margin:2px 0 6px}",
    ".bl-list{max-height:170px;overflow:auto;border:1px solid #eaeef2;border-radius:6px;background:#fafbfc}",
    ".bl-item{padding:4px 6px;border-bottom:1px solid #f0f2f4;cursor:copy;word-break:break-word}",
    ".bl-item:last-child{border-bottom:0}",
    ".bl-item:hover{background:#eef4ff}",
    ".bl-item .bl-p{color:#8c959f;font-size:10px;margin-left:4px}",
    ".bl-empty{padding:10px;color:#8c959f;text-align:center}",
    ".bl-btns{display:flex;gap:6px;margin-top:7px;flex-wrap:wrap}",
    ".bl-btn{border:1px solid #d0d7de;background:#f6f8fa;color:#24292f;border-radius:6px;padding:3px 8px;font-size:11px;cursor:pointer}",
    ".bl-btn:hover{background:#eef1f4}",
    ".bl-btn.bl-primary{background:#1a73e8;border-color:#1a73e8;color:#fff}",
    ".bl-btn.bl-primary:hover{background:#1667d2}",
    ".bl-ft{color:#8c959f;font-size:10px;padding:6px 11px 8px;border-top:1px solid #eaeef2}",
    ".bl-toast{position:fixed;right:14px;bottom:54px;background:#24292f;color:#fff;border-radius:6px;padding:6px 10px;font-size:11px;z-index:2147483647;opacity:0;transition:opacity .2s}",
    "@media (prefers-color-scheme:dark){.bl-panel{background:#161b22;color:#e6edf3;border-color:#30363d}.bl-hd{background:#161b22;border-color:#30363d}.bl-x:hover{color:#e6edf3}.bl-chip{background:#12233d;border-color:#1f4b85;color:#9ecbff}.bl-list{background:#0d1117;border-color:#30363d}.bl-item{border-color:#21262d}.bl-item:hover{background:#12233d}.bl-btn{background:#21262d;border-color:#30363d;color:#e6edf3}.bl-sec,.bl-ft{border-color:#30363d}}"
  ].join("");

  function injectCSS() {
    if (doc.getElementById("biol10n-ui-css")) return;
    var st = doc.createElement("style");
    st.id = "biol10n-ui-css";
    st.setAttribute("data-biol10n-ui", "1");
    st.textContent = CSS;
    (doc.head || doc.documentElement).appendChild(st);
  }

  function makeBadge() {
    badge = el("button", "bl-badge", "中");
    badge.type = "button";
    badge.setAttribute("data-biol10n-ui", "1");
    badge.setAttribute("aria-label", "BioL10n 设置");
    badge.addEventListener("click", function (e) { e.preventDefault(); e.stopPropagation(); togglePanel(); });
    (doc.body || doc.documentElement).appendChild(badge);
  }

  function statLine() {
    var s = (engine && engine.stats) || {};
    return { nodes: s.nodes || 0, exact: s.hitExact || 0, rule: s.hitRule || 0, attrs: s.attrs || 0, miss: s.miss || 0 };
  }

  function buildPanel() {
    panel = el("div", "bl-panel");
    panel.setAttribute("data-biol10n-ui", "1");
    panel.setAttribute("role", "dialog");

    var hd = el("div", "bl-hd");
    hd.appendChild(el("span", null, "BioL10n 汉化设置"));
    hd.appendChild(el("span", "bl-v", version ? "v" + version : ""));
    var x = el("button", "bl-x", "\u00d7");
    x.type = "button";
    x.title = "关闭";
    x.addEventListener("click", function () { togglePanel(false); });
    hd.appendChild(x);
    panel.appendChild(hd);

    var body = el("div", "bl-body");

    var rowSite = el("div", "bl-row");
    rowSite.appendChild(el("span", "bl-k", "站点"));
    nodes.site = el("span", "bl-vv");
    rowSite.appendChild(nodes.site);
    body.appendChild(rowSite);

    var rowDict = el("div", "bl-row");
    rowDict.appendChild(el("span", "bl-k", "词库"));
    nodes.dict = el("span", "bl-vv");
    rowDict.appendChild(nodes.dict);
    body.appendChild(rowDict);

    nodes.stats = el("div", "bl-stats");
    body.appendChild(nodes.stats);

    var sec = el("div", "bl-sec");
    var title = el("div", "bl-title");
    title.appendChild(el("span", null, "未翻译文本"));
    var lab = el("label", "bl-switch");
    nodes.logInput = doc.createElement("input");
    nodes.logInput.type = "checkbox";
    nodes.logInput.checked = !!settings.log;
    nodes.logInput.addEventListener("change", function () {
      settings.log = nodes.logInput.checked;
      bioL10nSaveSettings(settings);
      updateTitle();
      refresh();
    });
    lab.appendChild(nodes.logInput);
    lab.appendChild(el("span", null, "记录"));
    title.appendChild(lab);
    sec.appendChild(title);
    sec.appendChild(el("div", "bl-hint", "开启后只在本机记录本页没被词库命中的文字，用于补词库；默认关闭。"));

    nodes.list = el("div", "bl-list");
    sec.appendChild(nodes.list);

    var btns = el("div", "bl-btns");
    nodes.copyBtn = el("button", "bl-btn", "复制全部");
    nodes.copyBtn.type = "button";
    nodes.copyBtn.addEventListener("click", copyAll);
    nodes.clearBtn = el("button", "bl-btn", "清空");
    nodes.clearBtn.type = "button";
    nodes.clearBtn.addEventListener("click", function () {
      entries = [];
      try { win.localStorage.removeItem(logKey); } catch (e) {}
      dirty = true;
      refresh();
    });
    btns.appendChild(nodes.copyBtn);
    btns.appendChild(nodes.clearBtn);
    sec.appendChild(btns);
    body.appendChild(sec);

    var sec2 = el("div", "bl-sec");
    var btns2 = el("div", "bl-btns");
    nodes.pauseBtn = el("button", "bl-btn", "暂停本页汉化");
    nodes.pauseBtn.type = "button";
    nodes.pauseBtn.addEventListener("click", function () {
      if (!engine) return;
      var on = !(engine.stats && engine.stats.enabled === false);
      if (on) engine.disable(); else engine.enable();
      updateTitle();
      refresh();
    });
    btns2.appendChild(nodes.pauseBtn);
    var hide = el("button", "bl-btn", "隐藏悬浮按钮");
    hide.type = "button";
    hide.addEventListener("click", function () {
      settings.badge = false;
      bioL10nSaveSettings(settings);
      if (badge) badge.style.display = "none";
      togglePanel(false);
      toast("已隐藏，按 Alt+Shift+B 可重新显示");
    });
    btns2.appendChild(hide);
    sec2.appendChild(btns2);
    body.appendChild(sec2);

    panel.appendChild(body);
    var ft = el("div", "bl-ft", "快捷键 Alt+Shift+L 中英切换 · 本脚本不联网");
    panel.appendChild(ft);
    (doc.body || doc.documentElement).appendChild(panel);
  }

  function toast(msg) {
    var t = el("div", "bl-toast", msg);
    t.setAttribute("data-biol10n-ui", "1");
    (doc.body || doc.documentElement).appendChild(t);
    win.requestAnimationFrame(function () { t.style.opacity = "1"; });
    win.setTimeout(function () {
      t.style.opacity = "0";
      win.setTimeout(function () { t.remove(); }, 250);
    }, 1600);
  }

  function copyAll() {
    var payload = entries.map(function (e) { return e.t + (e.p && e.p !== "/" ? "\t" + e.p : ""); }).join("\n");
    if (!payload) { toast("还没有记录"); return; }
    var done = function () { toast("已复制 " + entries.length + " 条"); };
    var fail = function () { toast("复制失败，请手动选中"); };
    if (win.navigator && win.navigator.clipboard && win.navigator && win.navigator.clipboard.writeText) {
      win.navigator && win.navigator.clipboard.writeText(payload).then(done, function () { legacyCopy(payload) ? done() : fail(); });
    } else {
      legacyCopy(payload) ? done() : fail();
    }
  }
  function legacyCopy(text) {
    try {
      var ta = doc.createElement("textarea");
      ta.value = text;
      ta.setAttribute("data-biol10n-ui", "1");
      ta.style.cssText = "position:fixed;left:-9999px;top:0";
      doc.body.appendChild(ta);
      ta.select();
      var ok = doc.execCommand("copy");
      ta.remove();
      return ok;
    } catch (e) { return false; }
  }

  function updateTitle() {
    if (!badge) return;
    var s = statLine();
    var on = !engine || !engine.stats || engine.stats.enabled !== false;
    badge.className = "bl-badge" + (on ? "" : " bl-off");
    badge.textContent = on ? "中" : "英";
    badge.title = "BioL10n" + (on ? "：本页已汉化 " + s.nodes + " 处" : "：本页已切回英文") +
      (settings.log ? " · 记录中（" + entries.length + " 条）" : "");
  }

  function renderList() {
    if (!nodes.list) return;
    nodes.list.textContent = "";
    if (!entries.length) {
      nodes.list.appendChild(el("div", "bl-empty", settings.log ? "本页暂未发现漏翻文本" : "记录未开启（已发现漏翻 " + ((engine && engine.stats && engine.stats.miss) || 0) + " 条，开启后显示明细）"));
      return;
    }
    var frag = doc.createDocumentFragment();
    for (var i = entries.length - 1; i >= 0 && i >= entries.length - 120; i--) {
      var e = entries[i];
      var it = el("div", "bl-item", e.t);
      it.title = "点击复制：" + e.t;
      if (e.p && e.p !== "/") it.appendChild(el("span", "bl-p", e.p.length > 34 ? e.p.slice(0, 34) + "…" : e.p));
      (function (txt) {
        it.addEventListener("click", function () {
          if (win.navigator && win.navigator.clipboard && win.navigator && win.navigator.clipboard.writeText) win.navigator && win.navigator.clipboard.writeText(txt).then(function () { toast("已复制"); }, function () { legacyCopy(txt); toast("已复制"); });
          else { legacyCopy(txt); toast("已复制"); }
        });
      })(e.t);
      frag.appendChild(it);
    }
    nodes.list.appendChild(frag);
  }

  function refresh() {
    if (!panel || !settingsOpen) return;
    var s = statLine();
    nodes.site.textContent = (site.name || site.id || "本站") + (win.location.hostname ? "（" + win.location.hostname + "）" : "");
    nodes.dict.textContent = "";
    var chips = el("span", "bl-chips");
    if (dicts.length) {
      dicts.forEach(function (d) {
        chips.appendChild(el("span", "bl-chip", d.id + " " + d.count + " 条"));
      });
    } else {
      chips.appendChild(el("span", "bl-chip", "通用词库"));
    }
    nodes.dict.appendChild(chips);
    nodes.stats.textContent = "";
    var parts = [["已替换", s.nodes], ["整条命中", s.exact], ["规则命中", s.rule], ["属性", s.attrs], ["漏翻", s.miss]];
    parts.forEach(function (p) {
      var d = el("span", null);
      d.appendChild(el("b", null, String(p[1])));
      d.appendChild(doc.createTextNode(" " + p[0]));
      nodes.stats.appendChild(d);
    });
    nodes.pauseBtn.textContent = (engine && engine.stats && engine.stats.enabled === false) ? "恢复汉化" : "暂停本页汉化";
    dirty = false;
    renderList();
    updateTitle();
  }

  function togglePanel(force) {
    var want = force === undefined ? !settingsOpen : !!force;
    if (want && !panel) buildPanel();
    settingsOpen = want;
    if (panel) panel.style.display = want ? "" : "none";
    if (want) refresh();
  }

  function onKey(e) {
    if (e.key === "Escape" && settingsOpen) { togglePanel(false); return; }
    if (e.altKey && e.shiftKey && (e.key === "B" || e.key === "b")) {
      settings.badge = !settings.badge;
      bioL10nSaveSettings(settings);
      if (badge) badge.style.display = settings.badge ? "" : "none";
      if (!settings.badge) togglePanel(false);
    }
  }

  function mount() {
    injectCSS();
    if (settings.badge) makeBadge();
    updateTitle();
    doc.addEventListener("keydown", onKey, true);
    // 统计与漏翻列表是活的：面板开着时每秒刷新一次
    win.setInterval(function () { if (settingsOpen) refresh(); }, 1000);
  }

  function attach(eng) {
    engine = eng;
    updateTitle();
    if (settingsOpen) refresh();
  }

  loadEntries();
  if (doc.body) mount();
  else doc.addEventListener("DOMContentLoaded", mount, { once: true });

  return {
    settings: settings,
    attach: attach,
    addMiss: addMiss,
    toggle: togglePanel,
    badge: function () { return badge; },
    panel: function () { return panel; },
    entries: function () { return entries.slice(); }
  };
}
