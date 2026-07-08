// LogiCSmith — profile, Claude chat tutor, and optional ElevenLabs voice call
(function () {
  const cfg = window.LOGICSMITH_CONFIG || (typeof LOGICSMITH_CONFIG !== "undefined" ? LOGICSMITH_CONFIG : null);
  const P = window.LOGICSMITH_PROMPT;

  const chatConfigured = cfg && cfg.tutorProxyUrl;
  const voiceConfigured = cfg && cfg.agentId && cfg.agentId !== "YOUR_AGENT_ID_HERE";

  const PROFILE_KEY = "logicsmith_profile";
  const USAGE_KEY = "logicsmith_usage";        // voice seconds
  const CHAT_USAGE_KEY = "logicsmith_chat_usage"; // chat messages
  const CHAT_KEY = "logicsmith_chat";          // conversation history
  const POLL_SECONDS = 5;
  const HISTORY_SENT = 30;   // messages sent to the model per request
  const HISTORY_KEPT = 200;  // messages kept on the device

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

  // ---------- daily usage (chat messages) ----------
  function loadChatUsage() {
    let u = loadJSON(CHAT_USAGE_KEY);
    if (!u || u.date !== today()) u = { date: today(), count: 0 };
    return u;
  }
  function addChatUsage() {
    const u = loadChatUsage();
    u.count += 1;
    saveJSON(CHAT_USAGE_KEY, u);
    return u;
  }
  function chatLimit() { return (cfg && cfg.dailyChatMessages ? cfg.dailyChatMessages : 60); }
  function chatLimitReached() { return loadChatUsage().count >= chatLimit(); }

  // ---------- chat history ----------
  function loadChat() { return loadJSON(CHAT_KEY) || []; }
  function saveChat(msgs) { saveJSON(CHAT_KEY, msgs.slice(-HISTORY_KEPT)); }

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
  function renderMessageText(el, text) {
    // minimal safe formatting: escape HTML, then **bold** and line breaks
    let html = text
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
      .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
      .replace(/\n/g, "<br>");
    el.innerHTML = html;
  }

  function addBubble(role, text) {
    const list = document.getElementById("chat-messages");
    const div = document.createElement("div");
    div.className = "bubble " + (role === "user" ? "bubble-user" : "bubble-tutor");
    renderMessageText(div, text);
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
      msgs.forEach(function (m) { addBubble(m.role, m.content); });
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
          } else if (ev.type === "error" && ev.error) {
            apiError = ev.error.message || "The tutor hit an error.";
          }
        });
      }
    }
    if (apiError) throw new Error(apiError);
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
      setChatNote("🌙 That's all your questions for today! Your questions reset at midnight — come back tomorrow.");
      return;
    }
    input.disabled = sending; btn.disabled = sending;
    setChatNote("");
  }

  function renderUsagePill() {
    const pill = document.getElementById("usage-pill");
    if (!chatConfigured) { pill.hidden = true; return; }
    const left = Math.max(0, chatLimit() - loadChatUsage().count);
    pill.hidden = false;
    pill.textContent = "💬 " + left + " questions left today";
  }

  async function sendMessage(profile, text) {
    if (sending || !text.trim() || !chatConfigured || chatLimitReached()) return;
    sending = true;
    updateChatAvailability();

    const msgs = loadChat();
    msgs.push({ role: "user", content: text.trim() });
    saveChat(msgs);
    addBubble("user", text.trim());
    addChatUsage();
    renderUsagePill();

    const bubble = addBubble("assistant", "…");
    let reply = "";
    try {
      await streamReply(
        P.buildSystemPrompt(profile),
        msgs.map(function (m) { return { role: m.role, content: m.content }; }),
        function (delta) {
          reply += delta;
          renderMessageText(bubble, reply);
          const list = document.getElementById("chat-messages");
          list.scrollTop = list.scrollHeight;
        }
      );
      msgs.push({ role: "assistant", content: reply });
      saveChat(msgs);
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

      document.getElementById("new-chat-btn").onclick = function () {
        saveChat([]);
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
