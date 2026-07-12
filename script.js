// LogiCSmith — profile, Claude chat tutor, and optional ElevenLabs voice call
(function () {
  const cfg = window.LOGICSMITH_CONFIG || (typeof LOGICSMITH_CONFIG !== "undefined" ? LOGICSMITH_CONFIG : null);
  const P = window.LOGICSMITH_PROMPT;

  const chatConfigured = cfg && cfg.tutorProxyUrl;
  const voiceConfigured = cfg && cfg.agentId && cfg.agentId !== "YOUR_AGENT_ID_HERE";

  const PROFILE_KEY = "logicsmith_profile";
  const USAGE_KEY = "logicsmith_usage";          // voice seconds
  const TOKEN_USAGE_KEY = "logicsmith_token_usage"; // chat tokens/day
  const CHAT_KEY = "logicsmith_chat";            // conversation history
  const POLL_SECONDS = 5;
  const HISTORY_SENT = 30;   // messages sent to the model per request
  const HISTORY_KEPT = 200;  // messages kept on the device
  const IMG_SEND_DIM = 1568; // max long-edge px for the photo sent to Claude
  const IMG_THUMB_DIM = 480; // max long-edge px for the stored/displayed thumb

  // ---------- storage helpers ----------
  function loadJSON(key) {
    try { return JSON.parse(localStorage.getItem(key)); } catch (e) { return null; }
  }
  function saveJSON(key, v) { localStorage.setItem(key, JSON.stringify(v)); }

  function loadProfile() { return loadJSON(PROFILE_KEY); }
  function saveProfile(p) { saveJSON(PROFILE_KEY, p); }

  function today() { return new Date().toISOString().slice(0, 10); }

  // ---------- daily usage (voice minutes) ----------
  function loadVoiceUsage() {
    let u = loadJSON(USAGE_KEY);
    if (!u || u.date !== today()) u = { date: today(), seconds: 0 };
    return u;
  }
  function addVoiceUsage(seconds) {
    const u = loadVoiceUsage();
    u.seconds += seconds;
    saveJSON(USAGE_KEY, u);
    return u;
  }
  function voiceLimitSeconds() { return (cfg && cfg.dailyLimitMinutes ? cfg.dailyLimitMinutes : 20) * 60; }
  function voiceLimitReached() { return loadVoiceUsage().seconds >= voiceLimitSeconds(); }

  // ---------- daily usage (chat tokens) ----------
  // Metered by tokens (input + output) rather than a flat question count, so a
  // photo — which costs far more tokens — draws down the daily allowance more
  // than a typed line. Soft, per-device cap; the hard cap is the Anthropic
  // console spend limit.
  function loadTokenUsage() {
    let u = loadJSON(TOKEN_USAGE_KEY);
    if (!u || u.date !== today()) u = { date: today(), tokens: 0 };
    return u;
  }
  function addTokenUsage(n) {
    const u = loadTokenUsage();
    u.tokens += Math.max(0, n | 0);
    saveJSON(TOKEN_USAGE_KEY, u);
    return u;
  }
  function tokenBudget() { return (cfg && cfg.dailyTokenBudget ? cfg.dailyTokenBudget : 60000); }
  function chatLimitReached() { return loadTokenUsage().tokens >= tokenBudget(); }
  function maxImages() { return (cfg && cfg.maxImagesPerMessage ? cfg.maxImagesPerMessage : 4); }

  // ---------- chat history (multi-conversation, Claude-style sidebar) ----------
  // All chats live in localStorage on the device — storing them costs ZERO
  // API credits. Only the ACTIVE chat's last HISTORY_SENT messages are sent
  // per request, same as before.
  const CONVOS_KEY = "logicsmith_convos";
  const MAX_CONVOS = 20; // keep localStorage bounded (photo thumbs add up)

  function newConvo() {
    return { id: "c" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6), title: "", msgs: [], updatedAt: Date.now() };
  }

  function loadStore() {
    let s = loadJSON(CONVOS_KEY);
    if (!s || !Array.isArray(s.list)) {
      s = { activeId: null, list: [] };
      // migrate the old single-chat storage into the first conversation
      const legacy = loadJSON(CHAT_KEY);
      if (Array.isArray(legacy) && legacy.length) {
        const c = newConvo();
        c.msgs = legacy;
        s.list.push(c);
        s.activeId = c.id;
        saveJSON(CONVOS_KEY, s);
        try { localStorage.removeItem(CHAT_KEY); } catch (e) { /* ignore */ }
      }
    }
    return s;
  }
  function saveStore(s) { saveJSON(CONVOS_KEY, s); }

  function activeConvo(s) {
    let c = s.list.find(function (x) { return x.id === s.activeId; });
    if (!c) {
      c = newConvo();
      s.list.push(c);
      s.activeId = c.id;
    }
    return c;
  }

  function pruneConvos(s) {
    if (s.list.length <= MAX_CONVOS) return;
    s.list
      .filter(function (c) { return c.id !== s.activeId; })
      .sort(function (a, b) { return a.updatedAt - b.updatedAt; })
      .slice(0, s.list.length - MAX_CONVOS)
      .forEach(function (old) {
        s.list.splice(s.list.indexOf(old), 1);
      });
  }

  // ---------- automatic chat titles (topic-based, like Claude/GPT — free, local) ----------
  // We title a chat from its first question. A keyword bank maps common Singapore
  // MOE topics to a clean label; anything unmatched falls back to a tidied-up
  // version of what the student typed. No API call, so titling costs no credits.
  const TOPIC_HINTS = [
    [/\bfraction/i, "Fractions"],
    [/\bdecimal/i, "Decimals"],
    [/\bpercentage|percent\b/i, "Percentage"],
    [/\bratio\b|\brate\b/i, "Ratio & rate"],
    [/\baverage|\bmean\b/i, "Averages"],
    [/\bquadratic|discriminant|parabola/i, "Quadratic equations"],
    [/\balgebra|simultaneous|solve for|\bequation/i, "Algebra"],
    [/\btrigonometr|\bsine\b|\bcosine\b|\btangent\b|\bsin\b|\bcos\b|\btan\b/i, "Trigonometry"],
    [/\bdifferentiat|\bderivative/i, "Differentiation"],
    [/\bintegrat/i, "Integration"],
    [/\bvector/i, "Vectors"],
    [/\bprobabilit/i, "Probability"],
    [/\bstatistic|histogram|box.?plot|standard deviation/i, "Statistics"],
    [/\bgraph|coordinate|gradient|straight line/i, "Graphs"],
    [/\bspeed|\bdistance\b|\btime\b.*\bspeed\b/i, "Speed"],
    [/\bmoney|\bcost\b|profit|discount|\bgst\b/i, "Money problems"],
    [/\bangle|triangle|\bcircle\b|polygon|\barea\b|perimeter|\bvolume\b/i, "Geometry & measurement"],
    [/\bphotosynthesis/i, "Photosynthesis"],
    [/\bheat|temperature|thermal|conduction|convection/i, "Heat"],
    [/\blight|reflection|refraction|\blens\b/i, "Light"],
    [/\bforce|friction|gravity|\bmotion\b|newton/i, "Forces & motion"],
    [/\belectric|circuit|current|voltage|resistance/i, "Electricity"],
    [/\bmagnet/i, "Magnetism"],
    [/\bcell\b|digestive|respiratory|circulatory|\borgan\b/i, "Human body systems"],
    [/\bplant|\broot\b|\bstem\b|\bleaf\b|\bleaves\b|germinat/i, "Plants"],
    [/\banimal|life ?cycle|habitat|adaptation/i, "Animals & habitats"],
    [/\bmatter\b|\bsolid\b|\bliquid\b|\bgas\b|state of matter/i, "States of matter"],
    [/\bacid|\balkali|\bbase\b|\bph\b|neutralis/i, "Acids & alkalis"],
    [/\benergy\b/i, "Energy"],
    [/\becosystem|food ?chain|food ?web/i, "Ecosystems"],
    [/\bcomprehension|\bpassage\b|inference/i, "Comprehension"],
    [/\bcomposition|\bessay\b|narrative|write.*(story|essay)/i, "Composition writing"],
    [/\bsituational writing|\bemail\b|\bletter\b|\breport\b/i, "Situational writing"],
    [/\bgrammar|\btense\b|preposition|subject.?verb|singular|plural/i, "Grammar"],
    [/\bvocabular|synonym|antonym|meaning of/i, "Vocabulary"],
    [/\bsummary|summaris|summariz/i, "Summary writing"],
    [/\bcloze\b/i, "Cloze passage"],
    [/\boral\b|stimulus/i, "Oral"],
  ];

  function deriveTitle(text) {
    const t = (text || "").replace(/\s+/g, " ").trim();
    if (!t) return "";
    for (let i = 0; i < TOPIC_HINTS.length; i++) {
      if (TOPIC_HINTS[i][0].test(t)) return TOPIC_HINTS[i][1];
    }
    // Fallback: strip common lead-ins, then take the first few words.
    let s = t.replace(
      /^(hi|hey|hello|please|pls|plz|ok|okay|so|um|erm|can you|could you|would you|help me( with)?|i need help( with)?|how (do|can|would) i|how to|how does|what (is|are|does)|why (is|does|do)|explain|teach me|show me|tell me|i (don'?t|dont|do not) (get|understand|know)|i'?m (stuck|confused)( on| about| with)?)\b[\s,.:;-]*/i,
      ""
    ).trim();
    if (!s) s = t;
    const words = s.split(" ").slice(0, 7).join(" ");
    let title = words.length > 42 ? words.slice(0, 42).replace(/\s\S*$/, "") : words;
    title = title.replace(/[\s.?!,;:]+$/, "").trim();
    if (!title) return "";
    return title.charAt(0).toUpperCase() + title.slice(1);
  }

  function loadChat() { const s = loadStore(); return activeConvo(s).msgs; }

  // Returns the active conversation's id, persisting it if it was just created.
  // Message sends pin themselves to this id so a reply that finishes streaming
  // AFTER the student switched/started another chat still lands in the right one.
  function ensureActiveId() {
    const s = loadStore();
    const before = s.activeId;
    const c = activeConvo(s);
    if (s.activeId !== before) saveStore(s);
    return c.id;
  }

  function saveChat(msgs, convoId) {
    const s = loadStore();
    let c;
    if (convoId) {
      c = s.list.find(function (x) { return x.id === convoId; });
      if (!c) return; // conversation was deleted mid-stream — drop silently
    } else {
      c = activeConvo(s);
    }
    c.msgs = msgs.slice(-HISTORY_KEPT);
    c.updatedAt = Date.now();
    // Auto-title from the first question — unless the student renamed it.
    if (!c.title && !c.titleLocked) {
      const firstUser = c.msgs.find(function (m) { return m.role === "user" && m.content; });
      if (firstUser) c.title = deriveTitle(firstUser.content);
    }
    pruneConvos(s);
    saveStore(s);
    renderSidebar();
  }

  function startNewConvo() {
    const s = loadStore();
    const current = s.list.find(function (x) { return x.id === s.activeId; });
    if (current && current.msgs.length === 0) return; // already on a fresh chat
    const c = newConvo();
    s.list.push(c);
    s.activeId = c.id;
    pruneConvos(s);
    saveStore(s);
    renderSidebar();
  }

  function switchConvo(id) {
    const s = loadStore();
    if (!s.list.some(function (x) { return x.id === id; })) return;
    s.activeId = id;
    saveStore(s);
    renderSidebar();
  }

  function renameConvo(id, title) {
    const s = loadStore();
    const c = s.list.find(function (x) { return x.id === id; });
    if (!c) return;
    const clean = (title || "").replace(/\s+/g, " ").trim().slice(0, 60);
    if (!clean) return; // ignore blank rename — keep the existing title
    c.title = clean;
    c.titleLocked = true; // a manual name is never overwritten by auto-titling
    saveStore(s);
    renderSidebar();
  }

  function deleteConvo(id) {
    const s = loadStore();
    const i = s.list.findIndex(function (x) { return x.id === id; });
    if (i === -1) return;
    s.list.splice(i, 1);
    if (s.activeId === id) {
      const latest = s.list.slice().sort(function (a, b) { return b.updatedAt - a.updatedAt; })[0];
      s.activeId = latest ? latest.id : null;
    }
    saveStore(s);
    renderSidebar();
  }

  // set inside enterChat; used by sidebar clicks to re-render history
  let currentProfile = null;

  function closeSidebarDrawer() { document.body.classList.remove("sidebar-open"); document.getElementById("sidebar-backdrop").hidden = true; }

  function renderSidebar() {
    const nav = document.getElementById("convo-list");
    if (!nav) return;
    const s = loadStore();
    nav.innerHTML = "";
    s.list
      .slice()
      .sort(function (a, b) { return b.updatedAt - a.updatedAt; })
      .forEach(function (c) {
        const item = document.createElement("div");
        item.className = "convo-item" + (c.id === s.activeId ? " active" : "");
        const title = document.createElement("span");
        title.className = "convo-title";
        title.textContent = c.title || "New chat";
        item.appendChild(title);

        // Inline rename: turns the title into a text box the student can edit.
        function beginRename() {
          const inp = document.createElement("input");
          inp.type = "text";
          inp.className = "convo-rename";
          inp.value = c.title || "";
          inp.maxLength = 60;
          inp.setAttribute("aria-label", "Rename chat");
          let done = false;
          function commit(save) {
            if (done) return; done = true;
            if (save) renameConvo(c.id, inp.value);
            else renderSidebar();
          }
          inp.addEventListener("click", function (e) { e.stopPropagation(); });
          inp.addEventListener("keydown", function (e) {
            e.stopPropagation();
            if (e.key === "Enter") { e.preventDefault(); commit(true); }
            else if (e.key === "Escape") { e.preventDefault(); commit(false); }
          });
          inp.addEventListener("blur", function () { commit(true); });
          item.replaceChild(inp, title);
          inp.focus();
          inp.select();
        }

        const ren = document.createElement("button");
        ren.type = "button";
        ren.className = "convo-ren";
        ren.textContent = "✏️";
        ren.setAttribute("aria-label", "Rename chat");
        ren.setAttribute("title", "Rename chat");
        ren.addEventListener("click", function (e) { e.stopPropagation(); beginRename(); });
        item.appendChild(ren);

        const del = document.createElement("button");
        del.type = "button";
        del.className = "convo-del";
        del.textContent = "🗑";
        del.setAttribute("aria-label", "Delete chat");
        del.setAttribute("title", "Delete chat");
        del.addEventListener("click", function (e) {
          e.stopPropagation();
          deleteConvo(c.id);
          if (currentProfile) renderHistory(currentProfile);
        });
        item.appendChild(del);
        item.addEventListener("click", function () {
          switchConvo(c.id);
          if (currentProfile) renderHistory(currentProfile);
          closeSidebarDrawer();
        });
        // Double-clicking the title is a quick shortcut to rename.
        title.addEventListener("dblclick", function (e) { e.stopPropagation(); beginRename(); });
        nav.appendChild(item);
      });
  }

  // ---------- photo attachments ----------
  // pendingImages: photos staged for the NEXT message. Each item is
  // { mediaType, data (base64 for the API), thumbUrl (small dataURL to show) }.
  let pendingImages = [];

  function drawScaled(img, maxDim, quality) {
    let w = img.naturalWidth || img.width;
    let h = img.naturalHeight || img.height;
    const scale = Math.min(1, maxDim / Math.max(w, h));
    w = Math.max(1, Math.round(w * scale));
    h = Math.max(1, Math.round(h * scale));
    const canvas = document.createElement("canvas");
    canvas.width = w; canvas.height = h;
    canvas.getContext("2d").drawImage(img, 0, 0, w, h);
    const dataUrl = canvas.toDataURL("image/jpeg", quality);
    return { dataUrl: dataUrl, base64: dataUrl.split(",")[1] };
  }

  function fileToImage(file) {
    return new Promise(function (resolve, reject) {
      const url = URL.createObjectURL(file);
      const img = new Image();
      img.onload = function () {
        URL.revokeObjectURL(url);
        try {
          const full = drawScaled(img, IMG_SEND_DIM, 0.85);
          const thumb = drawScaled(img, IMG_THUMB_DIM, 0.8);
          resolve({ mediaType: "image/jpeg", data: full.base64, thumbUrl: thumb.dataUrl });
        } catch (e) { reject(e); }
      };
      img.onerror = function () { URL.revokeObjectURL(url); reject(new Error("bad image")); };
      img.src = url;
    });
  }

  async function addFiles(fileList) {
    const files = Array.prototype.slice.call(fileList || [])
      .filter(function (f) { return /^image\/(png|jpe?g|webp)$/i.test(f.type); });
    for (const f of files) {
      if (pendingImages.length >= maxImages()) { toast("Up to " + maxImages() + " photos at a time."); break; }
      if (f.size > 15 * 1024 * 1024) { toast("That photo is too large (max 15MB)."); continue; }
      try { pendingImages.push(await fileToImage(f)); }
      catch (e) { toast("Couldn't read that photo — try another."); }
    }
    renderPreviews();
  }

  function renderPreviews() {
    const wrap = document.getElementById("attach-previews");
    if (!wrap) return;
    wrap.innerHTML = "";
    wrap.hidden = pendingImages.length === 0;
    pendingImages.forEach(function (im, i) {
      const cell = document.createElement("div");
      cell.className = "attach-thumb";
      const thumb = document.createElement("img");
      thumb.src = im.thumbUrl;
      cell.appendChild(thumb);
      const x = document.createElement("button");
      x.type = "button";
      x.className = "attach-remove";
      x.textContent = "×";
      x.setAttribute("aria-label", "Remove photo");
      x.addEventListener("click", function () { pendingImages.splice(i, 1); renderPreviews(); });
      cell.appendChild(x);
      wrap.appendChild(cell);
    });
  }

  // ---------- views ----------
  function show(viewId) {
    ["profile-view", "chat-view"].forEach(function (id) {
      document.getElementById(id).hidden = id !== viewId;
    });
  }

  // ---------- profile form ----------
  function renderLevelOptions() {
    const sel = document.getElementById("f-level");
    Object.keys(P.LEVELS).forEach(function (stage) {
      const group = document.createElement("optgroup");
      group.label = stage === "JC" ? "Junior College" : stage;
      P.LEVELS[stage].forEach(function (lvl) {
        const opt = document.createElement("option");
        opt.value = lvl;
        opt.textContent = lvl;
        group.appendChild(opt);
      });
      sel.appendChild(group);
    });
  }

  function renderStyleOptions() {
    const sel = document.getElementById("f-style");
    P.LEARNING_STYLES.forEach(function (s) {
      const opt = document.createElement("option");
      opt.value = s.value;
      opt.textContent = s.label;
      sel.appendChild(opt);
    });
  }

  function renderSubjects(stage, selected) {
    const wrap = document.getElementById("f-subjects");
    wrap.innerHTML = "";
    if (!stage) {
      const hint = document.createElement("p");
      hint.className = "panel-sub small";
      hint.textContent = "Pick your level first 👆";
      wrap.appendChild(hint);
      return;
    }
    (P.SUBJECTS[stage] || []).forEach(function (subject) {
      const label = document.createElement("label");
      const cb = document.createElement("input");
      cb.type = "checkbox";
      cb.value = subject;
      cb.checked = (selected || []).indexOf(subject) !== -1;
      const span = document.createElement("span");
      span.textContent = subject;
      label.appendChild(cb);
      label.appendChild(span);
      wrap.appendChild(label);
    });
  }

  function fillForm(p) {
    if (!p) return;
    document.getElementById("f-name").value = p.name || "";
    document.getElementById("f-level").value = p.level || "";
    document.getElementById("f-style").value = p.style || "";
    document.getElementById("f-notes").value = p.notes || "";
    renderSubjects(p.level ? P.stageOf(p.level) : "", p.subjects ? p.subjects.split(", ") : []);
  }

  function readForm() {
    const subjects = [];
    document.querySelectorAll("#f-subjects input:checked").forEach(function (cb) {
      subjects.push(cb.value);
    });
    return {
      name: document.getElementById("f-name").value.trim(),
      level: document.getElementById("f-level").value,
      subjects: subjects.join(", "),
      style: document.getElementById("f-style").value,
      notes: document.getElementById("f-notes").value.trim(),
    };
  }

  // ---------- chat rendering ----------
  // renderMessageText: fast, safe partial render used WHILE a reply streams.
  function renderMessageText(el, text) {
    // minimal safe formatting: escape HTML, then **bold** and line breaks
    let html = text
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
      .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
      .replace(/\n/g, "<br>");
    el.innerHTML = html;
  }

  // ---- SVG diagram sanitizer (no dependency; uses the browser's DOMParser) ----
  // The tutor may draw bar models / geometry / graphs as SVG. Model output is
  // trusted less than our own code, so we allow ONLY a whitelist of geometric
  // and text elements + safe attributes, and drop everything else (scripts,
  // event handlers, external/js links, foreignObject, style, etc.).
  const SVG_TAGS = {
    svg: 1, g: 1, path: 1, line: 1, polyline: 1, polygon: 1, rect: 1,
    circle: 1, ellipse: 1, text: 1, tspan: 1, defs: 1, marker: 1, title: 1, desc: 1,
  };
  const SVG_ATTRS = {
    viewbox: 1, width: 1, height: 1, xmlns: 1, x: 1, y: 1, x1: 1, y1: 1, x2: 1, y2: 1,
    cx: 1, cy: 1, r: 1, rx: 1, ry: 1, d: 1, points: 1, fill: 1, stroke: 1,
    "stroke-width": 1, "stroke-linecap": 1, "stroke-linejoin": 1, "stroke-dasharray": 1,
    "fill-opacity": 1, "stroke-opacity": 1, opacity: 1, transform: 1, "text-anchor": 1,
    "dominant-baseline": 1, "font-size": 1, "font-family": 1, "font-weight": 1,
    "marker-end": 1, "marker-start": 1, id: 1, refx: 1, refy: 1,
    markerwidth: 1, markerheight: 1, orient: 1, dx: 1, dy: 1,
  };
  const UNSAFE_ATTR_VALUE = /javascript:|url\(\s*['"]?\s*[^#]/i; // block js: and non-fragment url(...)

  function scrubSVGNode(node) {
    const kids = Array.prototype.slice.call(node.childNodes);
    for (const c of kids) {
      if (c.nodeType === 1) {
        if (!SVG_TAGS[c.nodeName.toLowerCase()]) { node.removeChild(c); continue; }
        Array.prototype.slice.call(c.attributes).forEach(function (a) {
          const name = a.name.toLowerCase();
          if (!SVG_ATTRS[name] || UNSAFE_ATTR_VALUE.test(a.value)) c.removeAttribute(a.name);
        });
        scrubSVGNode(c);
      } else if (c.nodeType === 8) {
        node.removeChild(c); // strip comments
      }
    }
  }

  function sanitizeSVG(svgString) {
    if (/<!doctype|<!entity|<\?/i.test(svgString)) return ""; // no DTD/entities/PIs
    try {
      const doc = new DOMParser().parseFromString(svgString, "image/svg+xml");
      if (doc.getElementsByTagName("parsererror").length) return "";
      const root = doc.documentElement;
      if (!root || root.nodeName.toLowerCase() !== "svg") return "";
      scrubSVGNode(root);
      return new XMLSerializer().serializeToString(root);
    } catch (e) {
      return "";
    }
  }

  // Very small LaTeX->text cleanup, used ONLY if KaTeX failed to load, so the
  // fallback reads "1/2 × b × h" instead of raw "\frac{1}{2}\times b".
  function latexToPlain(s) {
    return s
      .replace(/\\frac\s*\{([^{}]*)\}\s*\{([^{}]*)\}/g, "($1)/($2)")
      .replace(/\\times/g, "×").replace(/\\cdot/g, "·").replace(/\\div/g, "÷")
      .replace(/\\pi/g, "π").replace(/\\sqrt/g, "√")
      .replace(/\\text\s*\{([^{}]*)\}/g, "$1")
      .replace(/\\left|\\right/g, "").replace(/\\[,;! ]/g, " ")
      .replace(/\\\$/g, "$") // \$ -> $  (literal dollar in LaTeX)
      .replace(/[{}]/g, "").replace(/\\[a-zA-Z]+/g, "");
  }

  // finalizeMessage: full render for a COMPLETED assistant message —
  // ---------- accurate function plotter (```plot blocks) ----------
  // Claude can't freehand an accurate curve, so instead of a hand-drawn SVG the
  // tutor emits a ```plot block naming the function(s) and domain, and WE draw
  // the true graph from the real maths — correct axes, ticks and asymptote
  // breaks. Expressions run through a tiny safe parser (no eval / Function).
  const PLOT_FUNCS = {
    sin: Math.sin, cos: Math.cos, tan: Math.tan,
    asin: Math.asin, acos: Math.acos, atan: Math.atan,
    sinh: Math.sinh, cosh: Math.cosh, tanh: Math.tanh,
    sqrt: Math.sqrt, cbrt: Math.cbrt, abs: Math.abs, exp: Math.exp, ln: Math.log,
    log: function (v) { return Math.log(v) / Math.LN10; },
    log10: function (v) { return Math.log(v) / Math.LN10; },
  };
  const PLOT_CONSTS = { pi: Math.PI, e: Math.E };

  function compileExpr(src) {
    const s = String(src).replace(/\s+/g, "");
    const toks = [];
    let i = 0;
    const isD = function (c) { return c >= "0" && c <= "9"; };
    const isA = function (c) { return (c >= "a" && c <= "z") || (c >= "A" && c <= "Z"); };
    while (i < s.length) {
      const c = s[i];
      if (isD(c) || (c === "." && isD(s[i + 1]))) {
        let j = i + 1; while (j < s.length && (isD(s[j]) || s[j] === ".")) j++;
        toks.push({ t: "num", v: parseFloat(s.slice(i, j)) }); i = j;
      } else if (isA(c)) {
        let j = i + 1; while (j < s.length && (isA(s[j]) || isD(s[j]))) j++;
        const name = s.slice(i, j).toLowerCase(); i = j;
        if (PLOT_FUNCS[name]) toks.push({ t: "func", v: name });
        else if (name === "x") toks.push({ t: "var" });
        else if (PLOT_CONSTS[name] != null) toks.push({ t: "num", v: PLOT_CONSTS[name] });
        else throw new Error("unknown " + name);
      } else if ("+-*/^(),".indexOf(c) !== -1) {
        toks.push({ t: "op", v: c }); i++;
      } else throw new Error("bad char " + c);
    }
    const ex = []; // insert implicit multiplication (2x, 2(x), )(, x( ...)
    for (let k = 0; k < toks.length; k++) {
      ex.push(toks[k]);
      const a = toks[k], b = toks[k + 1];
      if (!b) continue;
      const aEnd = a.t === "num" || a.t === "var" || (a.t === "op" && a.v === ")");
      const bStart = b.t === "num" || b.t === "var" || b.t === "func" || (b.t === "op" && b.v === "(");
      if (aEnd && bStart) ex.push({ t: "op", v: "*" });
    }
    const prec = { "u-": 3.5, "^": 4, "*": 3, "/": 3, "+": 2, "-": 2 };
    const right = { "^": true, "u-": true };
    const outq = [], st = [];
    let prev = null;
    for (const tk of ex) {
      if (tk.t === "num" || tk.t === "var") outq.push(tk);
      else if (tk.t === "func") st.push(tk);
      else if (tk.v === "(") st.push(tk);
      else if (tk.v === ")") {
        while (st.length && st[st.length - 1].v !== "(") outq.push(st.pop());
        if (!st.length) throw new Error("paren");
        st.pop();
        if (st.length && st[st.length - 1].t === "func") outq.push(st.pop());
      } else if (tk.v === ",") {
        while (st.length && st[st.length - 1].v !== "(") outq.push(st.pop());
      } else {
        const unary = (tk.v === "-" || tk.v === "+") && (prev === null || (prev.t === "op" && prev.v !== ")"));
        if (unary) { if (tk.v === "-") st.push({ t: "op", v: "u-" }); }
        else {
          while (st.length) {
            const top = st[st.length - 1];
            if (top.t === "func") { outq.push(st.pop()); }
            else if (top.t === "op" && top.v !== "(" && (prec[top.v] > prec[tk.v] || (prec[top.v] === prec[tk.v] && !right[tk.v]))) outq.push(st.pop());
            else break;
          }
          st.push(tk);
        }
      }
      prev = tk;
    }
    while (st.length) { const t = st.pop(); if (t.v === "(" || t.v === ")") throw new Error("paren"); outq.push(t); }
    if (!outq.length) throw new Error("empty");
    return function (x) {
      const v = [];
      for (const tk of outq) {
        if (tk.t === "num") v.push(tk.v);
        else if (tk.t === "var") v.push(x);
        else if (tk.t === "func") v.push(PLOT_FUNCS[tk.v](v.pop()));
        else if (tk.v === "u-") v.push(-v.pop());
        else { const b = v.pop(), a = v.pop(); v.push(tk.v === "+" ? a + b : tk.v === "-" ? a - b : tk.v === "*" ? a * b : tk.v === "/" ? a / b : Math.pow(a, b)); }
      }
      return v[v.length - 1];
    };
  }

  function parsePlot(spec) {
    const fns = [], colors = ["#c0392b", "#2f6fd6", "#1f9d55"];
    let xmin = null, xmax = null, ymin = null, ymax = null;
    const pair = function (str) {
      const m = str.match(/(-?\d+(?:\.\d+)?)\s*(?:,|to|;|\.\.|\s)\s*(-?\d+(?:\.\d+)?)/i);
      return m ? [parseFloat(m[1]), parseFloat(m[2])] : null;
    };
    String(spec).split(/\n/).forEach(function (raw) {
      const line = raw.trim();
      if (!line) return;
      const eq = line.indexOf("=");
      const head = (eq < 0 ? line : line.slice(0, eq)).trim().toLowerCase();
      if (eq >= 0 && /^(y|f\(x\)|f)$/.test(head)) {
        try { fns.push({ f: compileExpr(line.slice(eq + 1)), color: colors[fns.length % colors.length] }); } catch (e) { /* skip */ }
        return;
      }
      const low = line.toLowerCase();
      if (/^(domain|x)\b/.test(low)) { const p = pair(line); if (p) { xmin = p[0]; xmax = p[1]; } return; }
      if (/^(range|y)\b/.test(low)) { const p = pair(line); if (p) { ymin = p[0]; ymax = p[1]; } return; }
      if (/x/i.test(line)) { try { fns.push({ f: compileExpr(line), color: colors[fns.length % colors.length] }); } catch (e) { /* skip */ } }
    });
    if (xmin == null || xmax == null || !(xmax > xmin)) { xmin = -5; xmax = 5; }
    return { fns: fns, xmin: xmin, xmax: xmax, ymin: ymin, ymax: ymax };
  }

  function plotFmt(n) { n = Math.round(n * 1000) / 1000; if (Object.is(n, -0)) n = 0; return String(n); }
  function niceStep(span, target) {
    const raw = span / Math.max(1, target);
    const mag = Math.pow(10, Math.floor(Math.log10(raw)));
    const f = raw / mag;
    return (f < 1.5 ? 1 : f < 3 ? 2 : f < 7 ? 5 : 10) * mag;
  }

  function buildPlotSVG(spec) {
    let parsed;
    try { parsed = parsePlot(spec); } catch (e) { return ""; }
    if (!parsed || !parsed.fns.length) return "";
    const xmin = parsed.xmin, xmax = parsed.xmax;
    const W = 380, H = 260, mL = 30, mR = 16, mT = 12, mB = 20;
    const iw = W - mL - mR, ih = H - mT - mB, N = 320;
    const series = parsed.fns.map(function (fn) {
      const pts = [];
      for (let i = 0; i <= N; i++) {
        const x = xmin + (xmax - xmin) * i / N;
        let y; try { y = fn.f(x); } catch (e) { y = NaN; }
        pts.push([x, y]);
      }
      return { pts: pts, color: fn.color };
    });
    let ymin = parsed.ymin, ymax = parsed.ymax;
    if (ymin == null || ymax == null) {
      const all = [];
      series.forEach(function (s) { s.pts.forEach(function (p) { if (isFinite(p[1])) all.push(p[1]); }); });
      let lo, hi;
      if (!all.length) { lo = -1; hi = 1; }
      else {
        all.sort(function (a, b) { return a - b; });
        const q = function (f) { return all[Math.min(all.length - 1, Math.max(0, Math.round(f * (all.length - 1))))]; };
        lo = all[0]; hi = all[all.length - 1];
        // Asymptotes (tan, 1/x) make the raw range explode; if the data has a
        // very long tail vs its interquartile spread, clip to Tukey fences so
        // the interesting part of the curve fills the view.
        const q25 = q(0.25), q75 = q(0.75), iqr = Math.max(1e-9, q75 - q25);
        if ((hi - lo) > 6 * iqr) { lo = q25 - 1.5 * iqr; hi = q75 + 1.5 * iqr; }
      }
      if (Math.abs(hi - lo) < 1e-6) { lo -= 1; hi += 1; }
      const pad = (hi - lo) * 0.08; ymin = lo - pad; ymax = hi + pad;
    }
    const sx = function (x) { return mL + (x - xmin) / (xmax - xmin) * iw; };
    const sy = function (y) { return mT + (ymax - y) / (ymax - ymin) * ih; };
    const axisX = (xmin <= 0 && xmax >= 0) ? sx(0) : (xmin > 0 ? mL : mL + iw);
    const axisY = (ymin <= 0 && ymax >= 0) ? sy(0) : (ymin > 0 ? mT + ih : mT);
    const yLabelRight = axisX < mL + 16;
    const xs = niceStep(xmax - xmin, 8), ys = niceStep(ymax - ymin, 6);
    let g = "";
    for (let t = Math.ceil(xmin / xs) * xs; t <= xmax + 1e-9; t += xs) {
      const px = sx(t);
      g += '<line x1="' + px.toFixed(1) + '" y1="' + mT + '" x2="' + px.toFixed(1) + '" y2="' + (mT + ih) + '" stroke="#e7edf5" stroke-width="1"/>';
      if (Math.abs(t) > 1e-9) g += '<text x="' + px.toFixed(1) + '" y="' + (axisY + 13).toFixed(1) + '" font-size="10" fill="#4a5568" text-anchor="middle" font-family="sans-serif">' + plotFmt(t) + '</text>';
    }
    for (let t = Math.ceil(ymin / ys) * ys; t <= ymax + 1e-9; t += ys) {
      const py = sy(t);
      g += '<line x1="' + mL + '" y1="' + py.toFixed(1) + '" x2="' + (mL + iw) + '" y2="' + py.toFixed(1) + '" stroke="#e7edf5" stroke-width="1"/>';
      if (Math.abs(t) > 1e-9) g += '<text x="' + (yLabelRight ? axisX + 4 : axisX - 4).toFixed(1) + '" y="' + (py + 3).toFixed(1) + '" font-size="10" fill="#4a5568" text-anchor="' + (yLabelRight ? "start" : "end") + '" font-family="sans-serif">' + plotFmt(t) + '</text>';
    }
    g += '<line x1="' + mL + '" y1="' + axisY.toFixed(1) + '" x2="' + (mL + iw) + '" y2="' + axisY.toFixed(1) + '" stroke="#33415a" stroke-width="1.5"/>';
    g += '<line x1="' + axisX.toFixed(1) + '" y1="' + mT + '" x2="' + axisX.toFixed(1) + '" y2="' + (mT + ih) + '" stroke="#33415a" stroke-width="1.5"/>';
    const outLo = ymin - (ymax - ymin) * 1.5, outHi = ymax + (ymax - ymin) * 1.5;
    series.forEach(function (s) {
      let d = "", pen = false;
      s.pts.forEach(function (p) {
        const y = p[1];
        if (!isFinite(y) || y < outLo || y > outHi) { pen = false; return; }
        d += (pen ? "L" : "M") + sx(p[0]).toFixed(1) + " " + sy(y).toFixed(1); pen = true;
      });
      if (d) g += '<path d="' + d + '" fill="none" stroke="' + s.color + '" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/>';
    });
    g += '<text x="' + (axisX - 4).toFixed(1) + '" y="' + (axisY + 13).toFixed(1) + '" font-size="10" fill="#4a5568" text-anchor="end" font-family="sans-serif">0</text>';
    g += '<text x="' + (mL + iw + 3) + '" y="' + (axisY - 4).toFixed(1) + '" font-size="12" fill="#33415a" font-style="italic" font-family="sans-serif">x</text>';
    g += '<text x="' + (axisX + 5).toFixed(1) + '" y="' + (mT + 1) + '" font-size="12" fill="#33415a" font-style="italic" font-family="sans-serif">y</text>';
    return '<svg viewBox="0 0 ' + W + ' ' + H + '" xmlns="http://www.w3.org/2000/svg" width="100%" height="auto">' + g + "</svg>";
  }

  // diagrams + formulas. Used after streaming ends and when replaying history.
  function finalizeMessage(el, text) {
    const svgs = [];
    let work = text.replace(/```plot\s*([\s\S]*?)```/gi, function (_, spec) {
      const svg = buildPlotSVG(spec); // accurate, app-computed graph
      if (!svg) return "";
      svgs.push(svg);
      return "SVG" + (svgs.length - 1) + "";
    });
    work = work.replace(/```svg\s*([\s\S]*?)```/gi, function (_, code) {
      const clean = sanitizeSVG(code.trim());
      if (!clean) return ""; // drop anything unsafe or unparseable
      svgs.push(clean);
      return "SVG" + (svgs.length - 1) + "";
    });
    let html = work
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
      .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
      .replace(/\n/g, "<br>");
    html = html.replace(/SVG(\d+)/g, function (_, i) {
      return '<div class="diagram">' + svgs[+i] + "</div>";
    });
    el.innerHTML = html;

    if (window.renderMathInElement) {
      try {
        window.renderMathInElement(el, {
          delimiters: [
            { left: "\\[", right: "\\]", display: true },
            { left: "\\(", right: "\\)", display: false },
          ],
          throwOnError: false,
        });
      } catch (e) { /* leave as-is */ }
    } else {
      // KaTeX didn't load — degrade math to readable plain text
      el.innerHTML = el.innerHTML.replace(/\\\[([\s\S]*?)\\\]|\\\(([\s\S]*?)\\\)/g,
        function (_, a, b) { return latexToPlain(a != null ? a : b); });
    }
  }

  function addBubble(role, text, imageUrls) {
    const list = document.getElementById("chat-messages");
    const div = document.createElement("div");
    div.className = "bubble " + (role === "user" ? "bubble-user" : "bubble-tutor");
    if (role === "user") {
      if (imageUrls && imageUrls.length) {
        const gallery = document.createElement("div");
        gallery.className = "bubble-images";
        imageUrls.forEach(function (u) {
          const im = document.createElement("img");
          im.className = "bubble-image";
          im.src = u;
          gallery.appendChild(im);
        });
        div.appendChild(gallery);
      }
      if (text) {
        const t = document.createElement("div");
        renderMessageText(t, text);
        div.appendChild(t);
      }
    } else {
      // Assistant messages get the full diagram + formula render.
      finalizeMessage(div, text);
    }
    list.appendChild(div);
    list.scrollTop = list.scrollHeight;
    return div;
  }

  function renderHistory(profile) {
    const list = document.getElementById("chat-messages");
    list.innerHTML = "";
    const msgs = loadChat();
    if (msgs.length === 0) {
      addBubble("assistant",
        "Hey " + (profile.name || "there") + "! I'm your tutor. 👋\n" +
        "Ask me anything from your " + (profile.subjects || "school") + " work — " +
        "or tell me a topic you're stuck on and we'll break it down together.");
    } else {
      msgs.forEach(function (m) { addBubble(m.role, m.content, m.images); });
    }
  }

  // ---------- Claude streaming ----------
  async function streamReply(systemPrompt, messages, onDelta, opts) {
    const system = [{ type: "text", text: systemPrompt, cache_control: { type: "ephemeral" } }];
    if (opts && opts.extraSystem) system.push({ type: "text", text: opts.extraSystem });
    const res = await fetch(cfg.tutorProxyUrl, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        system: system,
        messages: messages.slice(-HISTORY_SENT),
      }),
    });
    if (!res.ok) {
      let detail = "";
      try { detail = (await res.text()).slice(0, 200); } catch (e) { /* ignore */ }
      throw new Error("Tutor unavailable (" + res.status + "). " + detail);
    }
    if (!res.body) throw new Error("Streaming not supported by this browser.");

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buf = "";
    let apiError = null;
    const usage = { inputTokens: 0, outputTokens: 0 };

    while (true) {
      const chunk = await reader.read();
      if (chunk.done) break;
      buf += decoder.decode(chunk.value, { stream: true });
      let idx;
      while ((idx = buf.indexOf("\n\n")) !== -1) {
        const block = buf.slice(0, idx);
        buf = buf.slice(idx + 2);
        block.split("\n").forEach(function (line) {
          if (line.indexOf("data:") !== 0) return;
          let ev = null;
          try { ev = JSON.parse(line.slice(5).trim()); } catch (e) { return; }
          if (ev.type === "content_block_delta" && ev.delta && ev.delta.type === "text_delta") {
            onDelta(ev.delta.text);
          } else if (ev.type === "message_start" && ev.message && ev.message.usage) {
            // uncached input (photos land here in full) — cached reads are cheap, so skip
            usage.inputTokens = ev.message.usage.input_tokens || 0;
          } else if (ev.type === "message_delta" && ev.usage && ev.usage.output_tokens != null) {
            usage.outputTokens = ev.usage.output_tokens; // cumulative
          } else if (ev.type === "error" && ev.error) {
            apiError = ev.error.message || "The tutor hit an error.";
          }
        });
      }
    }
    if (apiError) throw new Error(apiError);
    return usage;
  }

  // ---------- chat behavior ----------
  let sending = false;

  function setChatNote(text) {
    const note = document.getElementById("chat-note");
    note.hidden = !text;
    note.textContent = text || "";
  }

  function updateChatAvailability() {
    const input = document.getElementById("chat-input");
    const btn = document.getElementById("send-btn");
    if (!chatConfigured) {
      input.disabled = true; btn.disabled = true;
      setChatNote("Chat isn't set up yet — the site owner needs to add the tutor proxy URL in config.js.");
      return;
    }
    if (chatLimitReached()) {
      input.disabled = true; btn.disabled = true;
      const ab = document.getElementById("attach-btn"); if (ab) ab.disabled = true;
      setChatNote("🌙 That's your tutoring time for today! Your daily allowance resets at midnight — come back tomorrow.");
      return;
    }
    input.disabled = sending; btn.disabled = sending;
    const ab = document.getElementById("attach-btn"); if (ab) ab.disabled = sending;
    setChatNote("");
  }

  function renderUsagePill() {
    const pill = document.getElementById("usage-pill");
    if (!chatConfigured) { pill.hidden = true; return; }
    const used = loadTokenUsage().tokens;
    const leftPct = Math.max(0, Math.min(100, Math.round((1 - used / tokenBudget()) * 100)));
    pill.hidden = false;
    pill.textContent = leftPct + "%";
    pill.title = leftPct + "% of today's tutoring allowance left";
    pill.classList.toggle("low", leftPct <= 20);
  }


  // Build the messages array sent to Claude. Photos are attached to the CURRENT
  // turn only (via `images`, full base64) — older turns are sent as text so a
  // long history of photos doesn't blow up cost or the request size.
  function buildApiMessages(msgs, images) {
    const out = msgs.map(function (m, idx) {
      const isLast = idx === msgs.length - 1;
      if (isLast && images && images.length) {
        const content = images.map(function (im) {
          return { type: "image", source: { type: "base64", media_type: im.mediaType, data: im.data } };
        });
        content.push({ type: "text", text: m.content || "Please help me with this question." });
        return { role: "user", content: content };
      }
      if (m.images && m.images.length) {
        return { role: m.role, content: (m.content ? m.content + " " : "") + "[photo attached earlier]" };
      }
      return { role: m.role, content: m.content };
    });
    return out.slice(-HISTORY_SENT);
  }

  async function sendMessage(profile, text) {
    const images = pendingImages.slice();
    if (sending || (!text.trim() && !images.length) || !chatConfigured || chatLimitReached()) return;
    sending = true;
    stopDictation();  // finish any live dictation before we send
    stopSpeaking();   // silence a previous reply that's still being read out
    pendingImages = [];
    renderPreviews();
    updateChatAvailability();

    const convoId = ensureActiveId(); // pin this send to the current conversation
    const msgs = loadChat();
    const stored = { role: "user", content: text.trim() };
    if (images.length) stored.images = images.map(function (im) { return im.thumbUrl; });
    msgs.push(stored);
    saveChat(msgs, convoId);
    const userBubble = addBubble("user", text.trim(), stored.images);

    const bubble = addBubble("assistant", "…");
    // Anchor the student's question near the top of the chat window, so the
    // reply "types out" downward from there and they read it top-to-bottom
    // (instead of the view jumping to the bottom of a long reply). After this
    // we DON'T force-scroll while streaming — the student scrolls down to read.
    const list = document.getElementById("chat-messages");
    list.scrollTop = Math.max(0, userBubble.offsetTop - 10);

    let reply = "";
    const speaker = readAloudOn() ? makeSpeaker() : null; // read the reply aloud?
    try {
      const usage = await streamReply(
        P.buildSystemPrompt(profile),
        buildApiMessages(msgs, images),
        function (delta) {
          reply += delta;
          renderMessageText(bubble, reply);
          if (speaker) speaker.feed(reply);
        }
      );
      if (speaker) speaker.flush(); // speak any trailing partial sentence
      finalizeMessage(bubble, reply); // render diagrams + formulas once complete
      // Re-anchor now that the full reply exists below the question: pins the
      // question at the top so the student reads the reply top-to-bottom.
      // (Short replies that already fit stay put — scrollTop clamps to 0.)
      list.scrollTop = Math.max(0, userBubble.offsetTop - 10);
      msgs.push({ role: "assistant", content: reply });
      saveChat(msgs, convoId);
      addTokenUsage((usage.inputTokens || 0) + (usage.outputTokens || 0));
      renderUsagePill();
    } catch (err) {
      renderMessageText(bubble, "⚠️ " + (err && err.message ? err.message : "Something went wrong. Try again."));
      // drop the failed user turn so history stays valid for the next try
      msgs.pop();
      saveChat(msgs, convoId);
    } finally {
      sending = false;
      updateChatAvailability();
      document.getElementById("chat-input").focus();
    }
  }

  // ---------- in-chat voice: mic dictation + read-aloud (free browser speech) ----------
  // Voice lives INSIDE the text chat now: the 🎤 button dictates the student's
  // question into the composer (speech-to-text), and the 🔈 toggle reads the
  // tutor's replies aloud (text-to-speech). Both use the browser's built-in
  // engines, so they cost no voice-platform fees, and everything stays in the
  // one chat thread — no separate voice history.
  const SpeechRec = window.SpeechRecognition || window.webkitSpeechRecognition;
  let recog = null; // active dictation session, or null

  // Make a streamed reply speakable: drop diagrams, flatten LaTeX, expand symbols.
  function speakableText(t) {
    return latexToPlain(
      t.replace(/```svg[\s\S]*?```/gi, " I've drawn a diagram for you — take a look above. ")
       .replace(/\\\[([\s\S]*?)\\\]|\\\(([\s\S]*?)\\\)/g, function (_, a, b) { return " " + (a != null ? a : b) + " "; })
    )
      .replace(/\*\*/g, "")
      .replace(/×/g, " times ").replace(/÷/g, " divided by ")
      .replace(/√/g, " square root of ").replace(/π/g, " pi ")
      .replace(/\^/g, " to the power of ")
      .replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/gu, "")
      .replace(/\s+/g, " ").trim();
  }

  function pickVoice() {
    const voices = window.speechSynthesis ? window.speechSynthesis.getVoices() : [];
    return (
      voices.find(function (v) { return /en[-_](SG|GB)/i.test(v.lang) && /google/i.test(v.name); }) ||
      voices.find(function (v) { return /en[-_](SG|GB)/i.test(v.lang); }) ||
      voices.find(function (v) { return /^en/i.test(v.lang); }) ||
      null
    );
  }

  function speakChunk(text, onend) {
    if (!window.speechSynthesis) { if (onend) onend(); return; }
    const clean = speakableText(text);
    if (!clean) { if (onend) onend(); return; }
    const u = new SpeechSynthesisUtterance(clean);
    const v = pickVoice();
    if (v) u.voice = v;
    u.rate = 1.0;
    if (onend) u.onend = onend;
    window.speechSynthesis.speak(u);
  }

  function stopSpeaking() { if (window.speechSynthesis) window.speechSynthesis.cancel(); }

  // Incremental speaker: fed the growing reply during streaming, it speaks each
  // finished sentence as soon as it lands so read-aloud keeps pace with typing.
  function makeSpeaker() {
    let full = "", spokenUpTo = 0;
    function speakReady() {
      while (true) {
        const rest = full.slice(spokenUpTo);
        const m = rest.search(/[.!?](\s|$)|\n/);
        if (m === -1) break;
        const boundary = spokenUpTo + m + 1;
        const chunk = full.slice(spokenUpTo, boundary).trim();
        spokenUpTo = boundary;
        if (chunk) speakChunk(chunk);
      }
    }
    return {
      feed: function (text) { full = text; speakReady(); },
      flush: function () {
        const chunk = full.slice(spokenUpTo).trim();
        spokenUpTo = full.length;
        if (chunk) speakChunk(chunk);
      },
    };
  }

  // ---- read-aloud toggle (remembers the student's choice) ----
  const READ_ALOUD_KEY = "logicsmith_read_aloud";
  function readAloudOn() { return localStorage.getItem(READ_ALOUD_KEY) === "1"; }
  function setReadAloud(on) {
    localStorage.setItem(READ_ALOUD_KEY, on ? "1" : "0");
    const btn = document.getElementById("tts-btn");
    if (btn) {
      btn.classList.toggle("active", on);
      btn.setAttribute("aria-pressed", on ? "true" : "false");
      btn.textContent = on ? "🔊" : "🔈";
      btn.title = on ? "Reading replies aloud — tap to mute" : "Read replies aloud";
    }
    if (!on) stopSpeaking();
  }

  // ---- microphone dictation into the composer ----
  function setMicUI(listening) {
    const btn = document.getElementById("mic-btn");
    if (!btn) return;
    btn.classList.toggle("listening", !!listening);
    btn.textContent = listening ? "⏹️" : "🎤";
    btn.title = listening ? "Stop listening" : "Speak your question";
  }

  function stopDictation() {
    if (recog) { try { recog.abort(); } catch (e) { /* ignore */ } recog = null; }
    setMicUI(false);
  }

  // Called when leaving the chat or editing the profile: silence both engines.
  function stopVoiceOutput() { stopSpeaking(); stopDictation(); }

  function startDictation() {
    const input = document.getElementById("chat-input");
    if (!SpeechRec) { toast("Voice input needs Chrome, Edge or Safari on this device."); return; }
    if (!chatConfigured || chatLimitReached()) return;
    if (recog) { try { recog.stop(); } catch (e) { /* ignore */ } return; } // tap again = stop
    stopSpeaking(); // don't read aloud over the student while they speak

    // Append dictation after whatever's already typed, rather than replacing it.
    const base = input.value ? input.value.replace(/\s*$/, "") + " " : "";
    let finalText = "";
    recog = new SpeechRec();
    recog.lang = "en-SG";
    recog.interimResults = true;
    recog.maxAlternatives = 1;
    recog.onresult = function (ev) {
      let interim = "";
      for (let i = ev.resultIndex; i < ev.results.length; i++) {
        if (ev.results[i].isFinal) finalText += ev.results[i][0].transcript;
        else interim += ev.results[i][0].transcript;
      }
      input.value = base + finalText + interim;
    };
    recog.onerror = function (ev) {
      recog = null; setMicUI(false);
      if (ev.error === "not-allowed") toast("Allow microphone access to speak your question.");
      else if (ev.error !== "aborted" && ev.error !== "no-speech") toast("Didn't catch that — try again.");
    };
    recog.onend = function () { recog = null; setMicUI(false); input.focus(); };
    setMicUI(true);
    try { recog.start(); } catch (e) { recog = null; setMicUI(false); }
  }

  // ---------- voice widget ----------
  function mountWidget(profile) {
    const slot = document.getElementById("tutor-widget-slot");
    slot.innerHTML = "";
    if (!voiceConfigured) {
      const msg = document.createElement("p");
      msg.className = "panel-sub small";
      msg.style.padding = "20px";
      msg.textContent = "Voice calls aren't set up yet.";
      slot.appendChild(msg);
      return;
    }
    if (voiceLimitReached()) {
      const msg = document.createElement("p");
      msg.className = "panel-sub small";
      msg.style.padding = "20px";
      msg.textContent = "🌙 That's your call time for today — your minutes reset at midnight. You can keep chatting by text!";
      slot.appendChild(msg);
      return;
    }
    const widget = document.createElement("elevenlabs-convai");
    widget.setAttribute("agent-id", cfg.agentId);
    widget.setAttribute("variant", "expanded");
    widget.setAttribute("dynamic-variables", JSON.stringify({
      student_name: profile.name || "there",
      grade_level: profile.level || "not specified",
      subjects: profile.subjects || "not specified",
      learning_style: profile.style || "not specified",
      notes: profile.notes || "none",
    }));
    if (cfg.actionText) widget.setAttribute("action-text", cfg.actionText);
    if (cfg.startCallText) widget.setAttribute("start-call-text", cfg.startCallText);
    if (cfg.endCallText) widget.setAttribute("end-call-text", cfg.endCallText);
    if (cfg.orbColor1) widget.setAttribute("avatar-orb-color-1", cfg.orbColor1);
    if (cfg.orbColor2) widget.setAttribute("avatar-orb-color-2", cfg.orbColor2);
    widget.setAttribute("text-input", "false"); // this is a CALL — no text box
    slot.appendChild(widget);
    hideWidgetComposer(widget);
  }

  // The widget's built-in "send a message" text box clutters the call tab
  // (especially on mobile). Belt-and-braces: the text-input attribute above,
  // plus a style injected into the widget's (open) shadow DOM.
  function hideWidgetComposer(widget) {
    let tries = 0;
    const timer = setInterval(function () {
      tries += 1;
      if (widget.shadowRoot) {
        if (!widget.shadowRoot.getElementById("ls-hide-composer")) {
          const st = document.createElement("style");
          st.id = "ls-hide-composer";
          st.textContent = "textarea, input[type='text'] { display: none !important; }";
          widget.shadowRoot.appendChild(st);
        }
        clearInterval(timer);
      } else if (tries > 40 || !document.contains(widget)) {
        clearInterval(timer);
      }
    }, 250);
  }

  function unmountWidget() {
    const w = document.querySelector("elevenlabs-convai");
    if (w) w.remove();
  }

  function callIsActive() {
    const w = document.querySelector("elevenlabs-convai");
    if (!w || !w.shadowRoot) return false;
    const label = (cfg.endCallText || "End call").toLowerCase();
    const nodes = w.shadowRoot.querySelectorAll("button, [role='button']");
    for (let i = 0; i < nodes.length; i++) {
      const text = (nodes[i].textContent || "") + " " + (nodes[i].getAttribute("aria-label") || "");
      if (text.toLowerCase().indexOf(label) !== -1) return true;
    }
    return false;
  }

  function renderVoiceUsage() {
    const u = loadVoiceUsage();
    const limit = voiceLimitSeconds();
    const mins = Math.floor(u.seconds / 60);
    const limitMins = Math.round(limit / 60);
    const wrap = document.getElementById("usage-bar-wrap");
    wrap.hidden = false;
    document.getElementById("usage-bar-fill").style.width =
      Math.min(100, (u.seconds / limit) * 100) + "%";
    document.getElementById("usage-bar-label").textContent =
      Math.max(0, limitMins - mins) + " call min left today";
  }

  function startVoiceUsageWatcher() {
    setInterval(function () {
      if (document.getElementById("call-panel").hidden) return;
      if (callIsActive()) {
        addVoiceUsage(POLL_SECONDS);
        renderVoiceUsage();
        if (voiceLimitReached()) {
          unmountWidget();
          mountWidget(loadProfile() || {}); // re-renders the "come back tomorrow" state
        }
      }
    }, POLL_SECONDS * 1000);
  }

  // ---------- tabs (Text Chat / Call) ----------
  const TABS = [
    { name: "chat", tabId: "tab-chat", panelId: "chat-panel" },
    { name: "call", tabId: "tab-call", panelId: "call-panel" },
  ];

  function switchTab(tab, profile) {
    TABS.forEach(function (t) {
      document.getElementById(t.tabId).classList.toggle("active", t.name === tab);
      document.getElementById(t.panelId).hidden = t.name !== tab;
    });
    // leaving a mode: stop whatever it was doing
    if (tab !== "call") unmountWidget();
    if (tab !== "chat") stopVoiceOutput(); // silence mic/read-aloud outside chat
    if (tab === "call") {
      mountWidget(profile);
      renderVoiceUsage();
    }
    if (tab === "chat") {
      renderHistory(profile); // voice turns share the history — refresh bubbles
    }
  }

  // ---------- suggestions ----------
  function renderChips(profile) {
    const wrap = document.getElementById("chips");
    wrap.innerHTML = "";
    (cfg && cfg.suggestions ? cfg.suggestions : []).forEach(function (text) {
      const chip = document.createElement("button");
      chip.type = "button";
      chip.className = "chip";
      chip.textContent = "“" + text + "”";
      chip.addEventListener("click", function () {
        switchTab("chat", profile);
        const input = document.getElementById("chat-input");
        input.value = text;
        input.focus();
      });
      wrap.appendChild(chip);
    });
  }

  let toastTimer = null;
  function toast(msg) {
    const el = document.getElementById("toast");
    el.textContent = msg;
    el.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { el.hidden = true; }, 2600);
  }

  // ---------- boot ----------
  document.addEventListener("DOMContentLoaded", function () {
    renderLevelOptions();
    renderStyleOptions();
    renderSubjects("", []);

    document.getElementById("f-level").addEventListener("change", function (e) {
      renderSubjects(P.stageOf(e.target.value), []);
    });

    if (!chatConfigured) {
      document.getElementById("setup-banner").hidden = false;
    }

    const editBtn = document.getElementById("edit-profile-btn");
    editBtn.addEventListener("click", function () {
      document.getElementById("profile-title").textContent = "Update your profile ✏️";
      fillForm(loadProfile());
      unmountWidget();
      stopVoiceOutput();
      show("profile-view");
    });

    document.getElementById("profile-form").addEventListener("submit", function (e) {
      e.preventDefault();
      const p = readForm();
      saveProfile(p);
      enterChat(p);
    });

    function enterChat(profile) {
      currentProfile = profile;
      document.getElementById("greeting").textContent =
        "Hey " + (profile.name || "there") + "! What are we working on?";
      renderHistory(profile);
      renderSidebar();
      renderChips(profile);
      renderUsagePill();
      updateChatAvailability();
      editBtn.hidden = false;
      switchTab("chat", profile);
      show("chat-view");

      document.getElementById("tab-chat").onclick = function () { switchTab("chat", profile); };
      document.getElementById("tab-call").onclick = function () { switchTab("call", profile); };

      // ---- in-chat voice: mic dictation + read-aloud toggle ----
      const micBtn = document.getElementById("mic-btn");
      const ttsBtn = document.getElementById("tts-btn");
      if (!SpeechRec) { micBtn.hidden = true; } // no dictation on this browser
      else { micBtn.onclick = function () { startDictation(); }; }
      if (!window.speechSynthesis) { ttsBtn.hidden = true; } // no read-aloud here
      else {
        setReadAloud(readAloudOn()); // restore saved preference + button state
        ttsBtn.onclick = function () { setReadAloud(!readAloudOn()); };
      }

      // ---- sidebar: new chat, mobile drawer ----
      document.getElementById("sidebar-new").onclick = function () {
        startNewConvo();
        pendingImages = [];
        renderPreviews();
        renderHistory(profile);
        switchTab("chat", profile);
        closeSidebarDrawer();
        toast("Fresh start! Your older chats are in the sidebar. ✨");
      };
      const sidebarToggle = document.getElementById("sidebar-toggle");
      const backdrop = document.getElementById("sidebar-backdrop");
      sidebarToggle.hidden = false;
      sidebarToggle.onclick = function () {
        const open = document.body.classList.toggle("sidebar-open");
        backdrop.hidden = !open;
      };
      backdrop.onclick = closeSidebarDrawer;

      const composer = document.getElementById("composer");
      const input = document.getElementById("chat-input");
      composer.onsubmit = function (e) {
        e.preventDefault();
        const text = input.value;
        input.value = "";
        sendMessage(profile, text);
      };
      input.onkeydown = function (e) {
        if (e.key === "Enter" && !e.shiftKey) {
          e.preventDefault();
          composer.requestSubmit();
        }
      };

      // ---- photo attachments: button, paste, drag-and-drop ----
      const attachBtn = document.getElementById("attach-btn");
      const attachInput = document.getElementById("attach-input");
      attachBtn.onclick = function () { attachInput.click(); };
      attachInput.onchange = function () { addFiles(attachInput.files); attachInput.value = ""; };
      input.addEventListener("paste", function (e) {
        const items = (e.clipboardData && e.clipboardData.files) || null;
        if (items && items.length) { addFiles(items); }
      });
      ["dragover", "dragenter"].forEach(function (ev) {
        composer.addEventListener(ev, function (e) { e.preventDefault(); composer.classList.add("dragover"); });
      });
      ["dragleave", "drop"].forEach(function (ev) {
        composer.addEventListener(ev, function (e) { e.preventDefault(); composer.classList.remove("dragover"); });
      });
      composer.addEventListener("drop", function (e) {
        if (e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files.length) addFiles(e.dataTransfer.files);
      });

    }

    const existing = loadProfile();
    if (existing && existing.name) {
      enterChat(existing);
    } else {
      show("profile-view");
    }

    startVoiceUsageWatcher();
  });
})();
