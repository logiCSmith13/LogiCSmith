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

  // ---------- chat history ----------
  function loadChat() { return loadJSON(CHAT_KEY) || []; }
  function saveChat(msgs) { saveJSON(CHAT_KEY, msgs.slice(-HISTORY_KEPT)); }

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
  // diagrams + formulas. Used after streaming ends and when replaying history.
  function finalizeMessage(el, text) {
    const svgs = [];
    let work = text.replace(/```svg\s*([\s\S]*?)```/gi, function (_, code) {
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
  async function streamReply(systemPrompt, messages, onDelta) {
    const res = await fetch(cfg.tutorProxyUrl, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        system: [{ type: "text", text: systemPrompt, cache_control: { type: "ephemeral" } }],
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
    pill.textContent = (leftPct > 20 ? "🔋 " : "🪫 ") + leftPct + "% left today";
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
    pendingImages = [];
    renderPreviews();
    updateChatAvailability();

    const msgs = loadChat();
    const stored = { role: "user", content: text.trim() };
    if (images.length) stored.images = images.map(function (im) { return im.thumbUrl; });
    msgs.push(stored);
    saveChat(msgs);
    const userBubble = addBubble("user", text.trim(), stored.images);

    const bubble = addBubble("assistant", "…");
    // Anchor the student's question near the top of the chat window, so the
    // reply "types out" downward from there and they read it top-to-bottom
    // (instead of the view jumping to the bottom of a long reply). After this
    // we DON'T force-scroll while streaming — the student scrolls down to read.
    const list = document.getElementById("chat-messages");
    list.scrollTop = Math.max(0, userBubble.offsetTop - 10);

    let reply = "";
    try {
      const usage = await streamReply(
        P.buildSystemPrompt(profile),
        buildApiMessages(msgs, images),
        function (delta) {
          reply += delta;
          renderMessageText(bubble, reply);
        }
      );
      finalizeMessage(bubble, reply); // render diagrams + formulas once complete
      // Re-anchor now that the full reply exists below the question: pins the
      // question at the top so the student reads the reply top-to-bottom.
      // (Short replies that already fit stay put — scrollTop clamps to 0.)
      list.scrollTop = Math.max(0, userBubble.offsetTop - 10);
      msgs.push({ role: "assistant", content: reply });
      saveChat(msgs);
      addTokenUsage((usage.inputTokens || 0) + (usage.outputTokens || 0));
      renderUsagePill();
    } catch (err) {
      renderMessageText(bubble, "⚠️ " + (err && err.message ? err.message : "Something went wrong. Try again."));
      // drop the failed user turn so history stays valid for the next try
      msgs.pop();
      saveChat(msgs);
    } finally {
      sending = false;
      updateChatAvailability();
      document.getElementById("chat-input").focus();
    }
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
    slot.appendChild(widget);
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
      if (document.getElementById("voice-panel").hidden) return;
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

  // ---------- tabs ----------
  function switchTab(tab, profile) {
    const chatTab = document.getElementById("tab-chat");
    const voiceTab = document.getElementById("tab-voice");
    const chatPanel = document.getElementById("chat-panel");
    const voicePanel = document.getElementById("voice-panel");
    const isChat = tab === "chat";
    chatTab.classList.toggle("active", isChat);
    voiceTab.classList.toggle("active", !isChat);
    chatPanel.hidden = !isChat;
    voicePanel.hidden = isChat;
    if (isChat) {
      unmountWidget();
    } else {
      mountWidget(profile);
      renderVoiceUsage();
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
      show("profile-view");
    });

    document.getElementById("profile-form").addEventListener("submit", function (e) {
      e.preventDefault();
      const p = readForm();
      saveProfile(p);
      enterChat(p);
    });

    function enterChat(profile) {
      document.getElementById("greeting").textContent =
        "Hey " + (profile.name || "there") + "! What are we working on?";
      renderHistory(profile);
      renderChips(profile);
      renderUsagePill();
      updateChatAvailability();
      editBtn.hidden = false;
      switchTab("chat", profile);
      show("chat-view");

      document.getElementById("tab-chat").onclick = function () { switchTab("chat", profile); };
      document.getElementById("tab-voice").onclick = function () { switchTab("voice", profile); };

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

      document.getElementById("new-chat-btn").onclick = function () {
        saveChat([]);
        pendingImages = [];
        renderPreviews();
        renderHistory(profile);
        toast("Fresh start! Your tutor still remembers your profile. ✨");
      };
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
