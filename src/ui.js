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
  // 0.11.0 起新增：contrast（悬停对照原文）、paused（记住暂停的站点）、pos（悬浮球位置）
  var def = { log: false, badge: true, open: false, contrast: false, paraOrig: true, paused: [], pos: null };
  var ls = bioL10nLS();
  if (!ls) return def;
  try {
    var raw = ls.getItem("biol10n:settings");
    if (!raw) return def;
    var v = JSON.parse(raw);
    if (v && typeof v === "object") {
      def.log = !!v.log;
      def.badge = v.badge !== false;
      def.contrast = !!v.contrast;
      def.paraOrig = v.paraOrig !== false;
      if (Array.isArray(v.paused)) def.paused = v.paused.filter(function (h) { return typeof h === "string" && h; }).slice(-50);
      if (v.pos && typeof v.pos.x === "number" && typeof v.pos.y === "number") def.pos = { x: v.pos.x, y: v.pos.y };
    }
  } catch (e) { /* 隐私模式/禁用存储时用默认值 */ }
  return def;
}

function bioL10nSaveSettings(s) {
  var ls = bioL10nLS();
  if (!ls) return;
  try {
    ls.setItem("biol10n:settings", JSON.stringify({
      log: !!s.log,
      badge: s.badge !== false,
      contrast: !!s.contrast,
      paraOrig: s.paraOrig !== false,
      paused: (s.paused || []).slice(-50),
      pos: s.pos || null
    }));
  } catch (e) {}
}

function createBioL10nUI(opts) {
  opts = opts || {};
  var doc = document;
  var win = window;
  var site = opts.site || {};
  var dicts = opts.dicts || [];
  var version = opts.version || "";
  var missNoise = (opts.site && opts.site.missNoise) || [];
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
    ".bl-pop{position:fixed;width:214px;max-height:66vh;overflow:auto;background:#fff;color:#1f2328;border:1px solid #d0d7de;border-radius:10px;box-shadow:0 8px 28px rgba(0,0,0,.28);z-index:2147483647;font-size:12px;line-height:1.5;padding:8px}",
    ".bl-pop-mini{display:flex;gap:5px;margin-top:8px}",
    ".bl-pop-sbtn{flex:1;border:1px solid #d0d7de;background:#f6f8fa;color:#24292f;border-radius:6px;padding:5px 2px;font-size:11.5px;cursor:pointer;white-space:nowrap}",
    ".bl-pop-sbtn:hover{background:#eef1f4}",
    ".bl-card{position:fixed;z-index:2147483647;width:520px;max-width:90vw;max-height:56vh;overflow:auto;background:#fff;color:#1f2328;border:1px solid #d0d7de;border-radius:10px;box-shadow:0 8px 28px rgba(0,0,0,.3);font-size:12.5px;line-height:1.6;padding:10px 12px}",
    ".bl-card-hd{display:flex;align-items:center;gap:8px;color:#6e7781;font-size:11px;margin-bottom:5px}",
    ".bl-card-bd{white-space:pre-wrap;word-break:break-word;margin-bottom:8px;max-height:38vh;overflow:auto}",
    ".bl-card-x{margin-left:auto;border:0;background:none;color:#8c959f;font-size:16px;line-height:1;cursor:pointer;padding:0 2px}",
    ".bl-card-x:hover{color:#1f2328}",
    ".bl-pop-hd{display:flex;align-items:center;gap:6px;color:#6e7781;font-size:11px;margin:0 0 6px 2px}",
    ".bl-pop-btn{display:block;width:100%;border:1px solid #1a73e8;background:#1a73e8;color:#fff;border-radius:7px;padding:7px 8px;font-size:12.5px;font-weight:600;cursor:pointer;text-align:center}",
    ".bl-pop-btn:hover{background:#1667d2}",
    ".bl-pop-btn.bl-off{background:#f6f8fa;border-color:#d0d7de;color:#24292f}",
    ".bl-pop-row{display:flex;align-items:center;gap:7px;margin-top:6px;padding:3px 2px;cursor:pointer;color:#24292f;border-radius:5px}",
    ".bl-pop-row:hover{background:#f0f4f9}",
    ".bl-pop-row input{margin:0;flex:0 0 auto}",
    ".bl-pop-row span{flex:1;min-width:0}",
    ".bl-pop-sep{border-top:1px solid #eaeef2;margin:7px 0 0}",
    ".bl-pop-more{border:0;background:none;color:#1a73e8;font-size:11.5px;cursor:pointer;padding:6px 2px 0;display:block;width:100%;text-align:left}",
    ".bl-pop-more:hover{text-decoration:underline}",
    "@media (prefers-color-scheme:dark){.bl-card{background:#161b22;color:#e6edf3;border-color:#30363d}.bl-card-x:hover{color:#e6edf3}.bl-pop-sbtn{background:#21262d;border-color:#30363d;color:#e6edf3}.bl-pop-sbtn:hover{background:#30363d}}",
    ".bl-orig{position:fixed;z-index:2147483647;max-width:480px;background:#24292f;color:#fff;border-radius:6px;padding:6px 9px;font-size:12px;line-height:1.5;box-shadow:0 4px 14px rgba(0,0,0,.3);pointer-events:none;white-space:pre-wrap;word-break:break-word}",
    ".bl-orig[hidden]{display:none}",
    "@media (prefers-color-scheme:dark){.bl-pop{background:#161b22;color:#e6edf3;border-color:#30363d}.bl-pop-hd{color:#8b949e}.bl-pop-row:hover{background:#21262d}.bl-pop-sep{border-color:#30363d}.bl-pop-btn.bl-off{background:#21262d;border-color:#30363d;color:#e6edf3}.bl-orig{background:#e6edf3;color:#0d1117}}",
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

  function placeBadge() {
    if (!badge) return;
    if (settings.pos) {
      badge.style.left = Math.max(0, Math.min(win.innerWidth - 36, settings.pos.x)) + "px";
      badge.style.top = Math.max(0, Math.min(win.innerHeight - 36, settings.pos.y)) + "px";
      badge.style.right = "auto";
      badge.style.bottom = "auto";
    } else {
      badge.style.left = "";
      badge.style.top = "";
      badge.style.right = "14px";
      badge.style.bottom = "14px";
    }
  }

  function makeBadge() {
    badge = el("button", "bl-badge", "中");
    badge.type = "button";
    badge.setAttribute("data-biol10n-ui", "1");
    badge.setAttribute("aria-label", "BioL10n 快捷菜单（拖动可移动）");
    placeBadge();

    // 单击=快捷菜单；双击=立即中英切换；按住拖动=挪位置（移动超过 4px 就不算点击）
    var drag = null;
    badge.addEventListener("pointerdown", function (e) {
      if (e.button !== 0) return;
      var r = badge.getBoundingClientRect();
      drag = { id: e.pointerId, x: e.clientX, y: e.clientY, left: r.left, top: r.top, moved: false };
      try { badge.setPointerCapture(e.pointerId); } catch (err) {}
    });
    badge.addEventListener("pointermove", function (e) {
      if (!drag || e.pointerId !== drag.id) return;
      var dx = e.clientX - drag.x, dy = e.clientY - drag.y;
      if (!drag.moved && Math.abs(dx) + Math.abs(dy) < 4) return;
      drag.moved = true;
      settings.pos = { x: drag.left + dx, y: drag.top + dy };
      placeBadge();
      if (pop && pop) positionPop();
    });
    badge.addEventListener("pointerup", function (e) {
      if (!drag || e.pointerId !== drag.id) return;
      var moved = drag.moved;
      drag = null;
      try { badge.releasePointerCapture(e.pointerId); } catch (err) {}
      if (moved) {
        if (settings.pos) {
          settings.pos = {
            x: Math.max(0, Math.min(win.innerWidth - 36, settings.pos.x)),
            y: Math.max(0, Math.min(win.innerHeight - 36, settings.pos.y))
          };
          placeBadge();
        }
        bioL10nSaveSettings(settings);
        return;
      }
      toggleQuick();
    });
    badge.addEventListener("dblclick", function (e) {
      e.preventDefault();
      e.stopPropagation();
      if (pop) toggleQuick(false);
      toggleLanguage();
    });
    (doc.body || doc.documentElement).appendChild(badge);
  }

  // ---------- 快捷菜单（悬浮球单击） ----------
  var pop = null;
  var popOpen = false;

  function positionPop() {
    if (!pop || !badge) return;
    var r = badge.getBoundingClientRect();
    var w = 208;
    var left = Math.min(Math.max(6, r.left + r.width / 2 - w / 2), win.innerWidth - w - 6);
    var top = r.top - (pop.offsetHeight || 170) - 8;
    if (top < 6) top = Math.min(win.innerHeight - (pop.offsetHeight || 170) - 6, r.bottom + 8);
    pop.style.left = Math.round(left) + "px";
    pop.style.top = Math.round(top) + "px";
  }

  function langOn() {
    return !(engine && engine.stats && engine.stats.enabled === false);
  }

  function toggleLanguage() {
    if (!engine) { toast("页面还在初始化，稍后再试"); return; }
    if (langOn()) engine.disable(); else engine.enable();
    refreshState();
    toast(langOn() ? "已切回中文" : "已切回原文");
  }

  function hostPaused() {
    var h = win.location.hostname || "";
    return (settings.paused || []).indexOf(h) >= 0;
  }

  function setPaused(on) {
    var h = win.location.hostname || "";
    settings.paused = (settings.paused || []).filter(function (x) { return x !== h; });
    if (on) settings.paused.push(h);
    bioL10nSaveSettings(settings);
    if (!engine) return;
    if (on && langOn()) engine.disable();
    if (!on && !langOn()) engine.enable();
    refreshState();
    toast(on ? "本站已记住：默认显示原文" : "本站已恢复：默认显示中文");
  }

  function buildPop() {
    pop = el("div", "bl-pop");
    pop.setAttribute("data-biol10n-ui", "1");
    pop.setAttribute("role", "menu");

    var hd = el("div", "bl-pop-hd");
    hd.appendChild(el("span", null, "BioL10n 快捷菜单"));
    pop.appendChild(hd);

    nodes.langBtn = el("button", "bl-pop-btn", "切回原文");
    nodes.langBtn.type = "button";
    nodes.langBtn.addEventListener("click", function (e) { e.stopPropagation(); toggleLanguage(); });
    pop.appendChild(nodes.langBtn);

    nodes.contrast = popRow("对照模式（悬停看原文）", function (box) {
      settings.contrast = box.checked;
      bioL10nSaveSettings(settings);
      applyContrast();
    });
    pop.appendChild(nodes.contrast.row);

    nodes.pauseRow = popRow("本站暂停（记住）", function (box) { setPaused(box.checked); });
    pop.appendChild(nodes.pauseRow.row);

    nodes.paraRow = popRow("段落看原文（按住 Alt 点击）", function (box) {
      settings.paraOrig = box.checked;
      bioL10nSaveSettings(settings);
      toast(box.checked ? "按住 Alt 点任意段落即可看原文" : "已关闭段落看原文");
    });
    pop.appendChild(nodes.paraRow.row);

    var mini = el("div", "bl-pop-mini");
    var cZh = el("button", "bl-pop-sbtn", "复制中文");
    cZh.type = "button";
    cZh.title = "复制当前选区；没选区就复制整页中文";
    cZh.addEventListener("click", function (e) { e.stopPropagation(); copyKind("zh"); });
    mini.appendChild(cZh);
    var cEn = el("button", "bl-pop-sbtn", "复制原文");
    cEn.type = "button";
    cEn.title = "复制当前选区；没选区就复制整页英文原文";
    cEn.addEventListener("click", function (e) { e.stopPropagation(); copyKind("en"); });
    mini.appendChild(cEn);
    var cMiss = el("button", "bl-pop-sbtn", "收集漏翻");
    cMiss.type = "button";
    cMiss.title = "扫出本页仍是英文的短句，存到本机并复制，攒够一批可并进词库";
    cMiss.addEventListener("click", function (e) { e.stopPropagation(); reportMisses(); });
    mini.appendChild(cMiss);
    pop.appendChild(mini);

    pop.appendChild(el("div", "bl-pop-sep"));
    var more = el("button", "bl-pop-more", "更多设置与漏翻记录…");
    more.type = "button";
    more.addEventListener("click", function (e) {
      e.stopPropagation();
      toggleQuick(false);
      togglePanel(true);
    });
    pop.appendChild(more);

    pop.addEventListener("pointerdown", function (e) { e.stopPropagation(); });
    (doc.body || doc.documentElement).appendChild(pop);
    applyContrast();
    refreshState();
  }

  function popRow(label, onChange) {
    var row = el("label", "bl-pop-row");
    var box = doc.createElement("input");
    box.type = "checkbox";
    box.addEventListener("change", function () { onChange(box); });
    row.appendChild(box);
    row.appendChild(el("span", null, label));
    return { row: row, box: box };
  }

  function toggleQuick(force) {
    var want = force === undefined ? !popOpen : !!force;
    if (want && !pop) buildPop();
    if (!pop) return;
    popOpen = want;
    pop.style.display = want ? "" : "none";
    if (want) {
      refreshState();
      positionPop();
    }
  }

  function refreshState() {
    var on = langOn();
    if (badge) {
      badge.className = "bl-badge" + (on ? "" : " bl-off");
      badge.textContent = on ? "中" : "英";
    }
    if (nodes.langBtn) {
      nodes.langBtn.textContent = on ? "切回原文" : "显示中文";
      nodes.langBtn.className = "bl-pop-btn" + (on ? "" : " bl-off");
    }
    if (nodes.contrast && nodes.contrast.box) nodes.contrast.box.checked = !!settings.contrast;
    if (nodes.pauseRow && nodes.pauseRow.box) nodes.pauseRow.box.checked = hostPaused();
    if (nodes.paraRow && nodes.paraRow.box) nodes.paraRow.box.checked = settings.paraOrig !== false;
    updateTitle();
  }

  // ---------- 对照模式：悬停看英文原文 ----------
  var origTip = null;
  var contrastBound = false;

  function showOrig(x, y, text) {
    if (!origTip) {
      origTip = el("div", "bl-orig");
      origTip.setAttribute("data-biol10n-ui", "1");
      origTip.hidden = true;
      (doc.body || doc.documentElement).appendChild(origTip);
    }
    origTip.textContent = text;
    origTip.hidden = false;
    var w = origTip.offsetWidth, h = origTip.offsetHeight;
    origTip.style.left = Math.max(6, Math.min(win.innerWidth - w - 6, x - w / 2)) + "px";
    origTip.style.top = (y - h - 12 < 6 ? y + 18 : y - h - 12) + "px";
  }

  function hideOrig() {
    if (origTip) origTip.hidden = true;
  }

  function onHover(e) {
    if (!settings.contrast || !engine) return;
    var el0 = e.target;
    for (var i = 0; i < 4 && el0; i++) {
      try {
        if (el0.getAttribute && el0.getAttribute("data-biol10n-ui")) return;
        var orig = engine.originalText(el0);
        var now = (el0.textContent || "").replace(/\s+/g, " ").trim();
        if (orig && orig !== now && /[A-Za-z]/.test(orig)) {
          showOrig(e.clientX, e.clientY, orig.length > 600 ? orig.slice(0, 600) + "…" : orig);
          return;
        }
      } catch (err) {}
      el0 = el0.parentElement;
    }
    hideOrig();
  }

  function applyContrast() {
    if (settings.contrast && !contrastBound) {
      doc.addEventListener("mousemove", onHover, true);
      contrastBound = true;
    } else if (!settings.contrast && contrastBound) {
      doc.removeEventListener("mousemove", onHover, true);
      contrastBound = false;
      hideOrig();
    }
  }

  function statLine() {
    var s = (engine && engine.stats) || {};
    return { nodes: s.nodes || 0, exact: s.hitExact || 0, rule: s.hitRule || 0, attrs: s.attrs || 0, attrHit: s.attrHit || 0, titleHit: s.titleHit || 0, paras: s.paras || 0, tpl: s.tpl || 0, inline: s.inline || 0, miss: s.miss || 0 };
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
    if (typeof win.requestAnimationFrame === "function") win.requestAnimationFrame(function () { t.style.opacity = "1"; });
    else t.style.opacity = "1";
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


  // ---------- 复制正文 / 收集漏翻 / 段落看原文（0.11.2） ----------
  var PAGE_SKIP = "script,style,noscript,template,svg,textarea,[data-biol10n-ui]";

  function visibleText() {
    var body = doc.body;
    if (!body) return "";
    var w = doc.createTreeWalker(body, 4, null, false), n, parts = [];
    while ((n = w.nextNode())) {
      var p = n.parentElement;
      if (p && p.closest && p.closest(PAGE_SKIP)) continue;
      parts.push(String(n.nodeValue || ""));
    }
    return parts.join("").replace(/[ \t\u00a0]+/g, " ").replace(/[ \t]*\n[ \t]*/g, "\n").trim();
  }

  /** 有选区就复制选区；否则整页（英文走引擎的原文拼装，不需要关脚本刷新）。 */
  function pickText(kind) {
    var sel = "";
    try { sel = String(win.getSelection ? win.getSelection().toString() : ""); } catch (e) {}
    if (sel && /\S/.test(sel)) return sel.trim();
    if (kind === "en" && engine && typeof engine.englishText === "function") {
      try {
        var t = engine.englishText();
        if (t) return t;
      } catch (e) {}
    }
    return visibleText();
  }

  function copyPayload(payload, okMsg) {
    if (!payload) { toast("没有可复制的内容"); return false; }
    // 页面没焦点时 navigator.clipboard.writeText 可能一直 pending（不 resolve 也不 reject），
    // 用户点了按钮却看不到任何反馈；900ms 后换 execCommand 兜底，保证一定有提示。
    var settled = false;
    var done = function () { if (settled) return; settled = true; toast(okMsg || "已复制"); };
    var fail = function () { if (settled) return; settled = true; toast("复制失败，请手动选中"); };
    var fallback = function () { if (settled) return; legacyCopy(payload) ? done() : fail(); };
    if (win.navigator && win.navigator.clipboard && win.navigator.clipboard.writeText) {
      win.setTimeout(fallback, 900);
      win.navigator.clipboard.writeText(payload).then(done, fallback);
    } else {
      fallback();
    }
    return true;
  }

  function copyKind(kind) {
    var t = pickText(kind);
    if (!t) { toast("这一页没有可复制的文字"); return ""; }
    copyPayload(t, (kind === "en" ? "已复制原文" : "已复制中文") + " " + t.length + " 字");
    return t;
  }

  var MISS_KEY = "biol10n:misses";

  function looksUntranslated(t) {
    if (!t || t.length < 3 || t.length > 90) return false;
    if (/[\u3400-\u4dbf\u4e00-\u9fff\uf900-\ufaff]/.test(t)) return false;
    if (/[：，。；！？、（）「」【】《》]/.test(t)) return false;   // 全角标点：已中文化或标识符
    if (!/[A-Za-z]{2}/.test(t)) return false;
    if (/^[\s\dA-Za-z._:/-]+$/.test(t) && !/ /.test(t)) return false;   // 纯编号/ID/文件名
    if (/@|https?:\/\/|www\./i.test(t)) return false;                  // 邮箱/URL
    return true;
  }

  /** 站级噪音名单：流程名/工具名/品牌这类「本来就不翻」的词，不进漏翻清单。 */
  function isNoise(t) {
    if (!missNoise.length) return false;
    var s = String(t).toLowerCase();
    for (var i = 0; i < missNoise.length; i++) {
      var n = String(missNoise[i] || "").toLowerCase().trim();
      if (n && s.indexOf(n) >= 0) return true;
    }
    return false;
  }

  /** 扫本页仍是英文的短句（跳过代码块、UI 自身与站级噪音名单）；返回去重后的条目。 */
  function collectMisses() {
    var body = doc.body;
    if (!body) return [];
    var SKIP = "script,style,noscript,template,svg,pre,code,kbd,samp,textarea,[data-biol10n-ui]";
    var out = [], seen = Object.create(null);
    var w = doc.createTreeWalker(body, 4, null, false), n;
    while ((n = w.nextNode())) {
      var p = n.parentElement;
      if (!p || (p.closest && p.closest(SKIP))) continue;
      var t = String(n.nodeValue || "").replace(/\s+/g, " ").trim();
      if (!looksUntranslated(t) || seen[t] || isNoise(t)) continue;
      try {
        var cs = win.getComputedStyle(p);
        if (cs && (cs.display === "none" || cs.visibility === "hidden")) continue;
      } catch (e1) {}
      seen[t] = 1;
      var blk = p.closest("p,li,td,th,dd,dt,div,section,article,h1,h2,h3,h4,h5,h6,label,button,a,figcaption,caption");
      var cls = blk && typeof blk.className === "string" ? blk.className.split(/\s+/)[0] : "";
      out.push({
        t: t,
        host: win.location.hostname || "",
        p: win.location.pathname || "/",
        tag: p.tagName.toLowerCase(),
        at: blk ? blk.tagName.toLowerCase() + (cls ? "." + cls : "") : ""
      });
      if (out.length >= 200) break;
    }
    return out;
  }

  function saveMisses(list) {
    var all = [];
    try {
      var raw = win.localStorage.getItem(MISS_KEY);
      all = raw ? JSON.parse(raw) : [];
    } catch (e) { all = []; }
    if (!Array.isArray(all)) all = [];
    var key = Object.create(null);
    all.forEach(function (x) { if (x && x.t) key[x.host + "\u0001" + x.p + "\u0001" + x.t] = 1; });
    var added = 0;
    list.forEach(function (x) {
      var k = x.host + "\u0001" + x.p + "\u0001" + x.t;
      if (key[k]) return;
      key[k] = 1;
      all.push({ t: x.t, host: x.host, p: x.p, tag: x.tag, at: x.at, ts: Date.now() });
      added++;
    });
    if (all.length > 800) all = all.slice(-800);
    try { win.localStorage.setItem(MISS_KEY, JSON.stringify(all)); } catch (e2) {}
    return { added: added, total: all.length, all: all };
  }

  function reportMisses() {
    var list = collectMisses();
    var res = saveMisses(list);
    var payload = list.map(function (x) { return x.t + "\t" + x.host + x.p.replace(/\/$/, "") + (x.at ? "\t" + x.at : ""); }).join("\n");
    if (!list.length) {
      toast("本页没扫到明显漏翻（累计已记 " + res.total + " 条）");
      return { found: 0, added: 0, total: res.total, list: list };
    }
    copyPayload(payload, "本页 " + list.length + " 条，新记 " + res.added + " 条（累计 " + res.total + "），已复制");
    return { found: list.length, added: res.added, total: res.total, list: list };
  }

  // ---------- 段落看原文：按住 Alt 点段落，弹出英文原文卡片 ----------
  var cardEl = null;

  function hideCard() {
    if (cardEl) { try { cardEl.remove(); } catch (e) {} cardEl = null; }
  }

  function showCard(text, x, y) {
    hideCard();
    cardEl = el("div", "bl-card");
    cardEl.setAttribute("data-biol10n-ui", "1");
    cardEl.setAttribute("role", "dialog");
    var hd = el("div", "bl-card-hd");
    hd.appendChild(el("span", null, "英文原文"));
    var x2 = el("button", "bl-card-x", "\u00d7");
    x2.type = "button";
    x2.title = "关闭（Esc）";
    x2.addEventListener("click", hideCard);
    hd.appendChild(x2);
    cardEl.appendChild(hd);
    cardEl.appendChild(el("div", "bl-card-bd", text));
    var btns = el("div", "bl-btns");
    var c1 = el("button", "bl-btn", "复制英文");
    c1.type = "button";
    c1.addEventListener("click", function () { copyPayload(text, "已复制英文"); });
    btns.appendChild(c1);
    cardEl.appendChild(btns);
    (doc.body || doc.documentElement).appendChild(cardEl);
    var w = cardEl.offsetWidth || 360, h = cardEl.offsetHeight || 200;
    var left = Math.max(6, Math.min(win.innerWidth - w - 6, (x || 12) - 24));
    var top = (y || 12) + 16;
    if (top + h > win.innerHeight - 8) top = Math.max(6, (y || 12) - h - 16);
    cardEl.style.left = Math.round(left) + "px";
    cardEl.style.top = Math.round(top) + "px";
  }

  function onAltClick(e) {
    if (!settings.paraOrig || !e.altKey || !engine) return;
    var t = e.target;
    if (!t || !t.closest || t.closest("[data-biol10n-ui]")) return;
    if (engine.stats && engine.stats.enabled === false) { toast("当前显示的就是原文"); return; }
    var blk = t.closest("p,li,td,th,dd,dt,div,section,article,h1,h2,h3,h4,h5,h6,figcaption,caption,label,blockquote,summary");
    if (!blk) return;
    var orig = null;
    try { orig = engine.originalText(blk); } catch (e1) {}
    if (!orig) {
      var cur = blk.parentElement, hops = 0;
      while (cur && hops < 4 && !orig) {
        try { orig = engine.originalText(cur); } catch (e2) {}
        cur = cur.parentElement;
        hops++;
      }
    }
    var now = (blk.textContent || "").replace(/\s+/g, " ").trim();
    if (!orig || orig === now) { toast("这段没有可还原的原文"); return; }
    e.preventDefault();
    e.stopPropagation();
    // 原文常带缩进/换行（HTML 里的制表符与换行），卡片里折成单行更好读
    showCard(String(orig).replace(/\s+/g, " ").trim(), e.clientX, e.clientY);
  }

  function updateTitle() {
    if (!badge) return;
    var s = statLine();
    var on = !engine || !engine.stats || engine.stats.enabled !== false;
    badge.className = "bl-badge" + (on ? "" : " bl-off");
    var mark = on ? "中" : "英";
    if (badge.textContent !== mark) badge.textContent = mark;
    // 计数要按通道求和：RCSB/GTEx 这类页面大部分命中走规则与属性，
    // 只看 nodes 会让徽标长期显示 0（检查方反馈）。
    var total = (s.nodes || 0) + (s.attrHit || 0) + (s.titleHit || 0);
    var tip = "BioL10n" + (on ? "：本页已汉化 " + total + " 处" : "：本页已切回英文") +
      (settings.log ? " · 记录中（" + entries.length + " 条）" : "");
    if (badge.title !== tip) badge.title = tip;
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
    var parts = [["已替换", s.nodes], ["整条命中", s.exact], ["规则命中", s.rule], ["整段", s.paras], ["模板", s.tpl], ["属性", s.attrs], ["漏翻", s.miss]];
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
    if (e.key === "Escape") {
      if (cardEl) { hideCard(); return; }
      if (settingsOpen) { togglePanel(false); return; }
      if (popOpen) { toggleQuick(false); return; }
    }
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
    refreshState();
    applyContrast();
    doc.addEventListener("keydown", onKey, true);
    // 按住 Alt 点段落 = 就地看该段英文原文（不整页切换、不刷新）
    doc.addEventListener("click", onAltClick, true);
    // 点空白处收起快捷菜单与原文卡片
    doc.addEventListener("pointerdown", function (e) {
      var t = e.target;
      if (cardEl && !cardEl.contains(t)) hideCard();
      if (!popOpen) return;
      if (t === badge || (pop && pop.contains(t)) || (badge && badge.contains(t))) return;
      toggleQuick(false);
    }, true);
    win.addEventListener("resize", function () { if (popOpen) positionPop(); });
    // 徽标/统计/面板都是活数据：每秒刷一次（只在文案变化时才写 DOM）
    win.setInterval(function () { refreshState(); if (settingsOpen) refresh(); }, 1000);
  }

  function attach(eng) {
    engine = eng;
    // 记住过「本站暂停」的站点，刷新后直接保持原文
    if (hostPaused() && langOn()) engine.disable();
    applyContrast();
    refreshState();
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
    toggleLanguage: toggleLanguage,
    refreshState: refreshState,
    badge: function () { return badge; },
    panel: function () { return panel; },
    entries: function () { return entries.slice(); },
    // 0.11.2：复制与漏翻上报（暴露出来给单测与排查用）
    textOf: pickText,
    copyKind: copyKind,
    collectMisses: collectMisses,
    reportMisses: reportMisses,
    card: function () { return cardEl; },
    misses: function () {
      try { return JSON.parse(win.localStorage.getItem(MISS_KEY) || "[]"); } catch (e) { return []; }
    }
  };
}
