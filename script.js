// LogiCSmith — profile setup, personalized widget, and daily usage cap
(function () {
  const cfg = window.LOGICSMITH_CONFIG || (typeof LOGICSMITH_CONFIG !== "undefined" ? LOGICSMITH_CONFIG : null);
  const configured = cfg && cfg.agentId && cfg.agentId !== "YOUR_AGENT_ID_HERE";

  const PROFILE_KEY = "logicsmith_profile";
  const USAGE_KEY = "logicsmith_usage";
  const POLL_SECONDS = 5;

  // ---------- profile storage ----------
  function loadProfile() {
    try { return JSON.parse(localStorage.getItem(PROFILE_KEY)); } catch (e) { return null; }
  }
  function saveProfile(p) {
    localStorage.setItem(PROFILE_KEY, JSON.stringify(p));
  }

  // ---------- daily usage storage ----------
  function today() {
    return new Date().toISOString().slice(0, 10);
  }
  function loadUsage() {
    let u = null;
    try { u = JSON.parse(localStorage.getItem(USAGE_KEY)); } catch (e) { /* fall through */ }
    if (!u || u.date !== today()) u = { date: today(), seconds: 0 };
    return u;
  }
  function addUsage(seconds) {
    const u = loadUsage();
    u.seconds += seconds;
    localStorage.setItem(USAGE_KEY, JSON.stringify(u));
    return u;
  }
  function limitSeconds() {
    return (cfg && cfg.dailyLimitMinutes ? cfg.dailyLimitMinutes : 20) * 60;
  }
  function limitReached() {
    return loadUsage().seconds >= limitSeconds();
  }

  // ---------- views ----------
  function show(viewId) {
    ["profile-view", "chat-view", "limit-view"].forEach(function (id) {
      document.getElementById(id).hidden = id !== viewId;
    });
  }

  // ---------- profile form ----------
  function fillForm(p) {
    if (!p) return;
    document.getElementById("f-name").value = p.name || "";
    document.getElementById("f-grade").value = p.grade || "";
    document.getElementById("f-confidence").value = p.confidence || "";
    document.getElementById("f-style").value = p.style || "";
    document.getElementById("f-notes").value = p.notes || "";
    const subjects = p.subjects ? p.subjects.split(", ") : [];
    document.querySelectorAll("#f-subjects input").forEach(function (cb) {
      cb.checked = subjects.indexOf(cb.value) !== -1;
    });
  }

  function readForm() {
    const subjects = [];
    document.querySelectorAll("#f-subjects input:checked").forEach(function (cb) {
      subjects.push(cb.value);
    });
    return {
      name: document.getElementById("f-name").value.trim(),
      grade: document.getElementById("f-grade").value,
      subjects: subjects.join(", "),
      confidence: document.getElementById("f-confidence").value,
      style: document.getElementById("f-style").value,
      notes: document.getElementById("f-notes").value.trim(),
    };
  }

  // ---------- widget ----------
  function mountWidget(profile) {
    const slot = document.getElementById("tutor-widget-slot");
    slot.innerHTML = "";
    const widget = document.createElement("elevenlabs-convai");
    widget.setAttribute("agent-id", cfg.agentId);
    widget.setAttribute("variant", "expanded");
    widget.setAttribute("dynamic-variables", JSON.stringify({
      student_name: profile.name || "there",
      grade_level: profile.grade || "not specified",
      subjects: profile.subjects || "not specified",
      confidence: profile.confidence || "not specified",
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

  // A call is "active" while the widget shows our end-call label anywhere
  // in its shadow DOM. Heuristic, but survives widget re-renders.
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

  // ---------- usage UI ----------
  function renderUsage() {
    const u = loadUsage();
    const limit = limitSeconds();
    const mins = Math.floor(u.seconds / 60);
    const limitMins = Math.round(limit / 60);
    const pill = document.getElementById("usage-pill");
    pill.hidden = false;
    pill.textContent = "⏱️ " + mins + " / " + limitMins + " min today";
    const wrap = document.getElementById("usage-bar-wrap");
    wrap.hidden = false;
    document.getElementById("usage-bar-fill").style.width =
      Math.min(100, (u.seconds / limit) * 100) + "%";
    document.getElementById("usage-bar-label").textContent =
      Math.max(0, limitMins - mins) + " min left today";
  }

  function startUsageWatcher() {
    setInterval(function () {
      if (document.getElementById("chat-view").hidden) return;
      if (callIsActive()) {
        addUsage(POLL_SECONDS);
        renderUsage();
        if (limitReached()) {
          unmountWidget();
          show("limit-view");
          document.getElementById("edit-profile-btn").hidden = true;
        }
      }
    }, POLL_SECONDS * 1000);
  }

  // ---------- suggestions ----------
  function renderChips() {
    const wrap = document.getElementById("chips");
    (cfg && cfg.suggestions ? cfg.suggestions : []).forEach(function (text) {
      const chip = document.createElement("button");
      chip.type = "button";
      chip.className = "chip";
      chip.textContent = "“" + text + "”";
      chip.addEventListener("click", function () {
        if (navigator.clipboard && navigator.clipboard.writeText) {
          navigator.clipboard.writeText(text).then(function () {
            toast("Copied! Say it or paste it in the chat 🎙️");
          }, function () {
            toast("Just say: " + text);
          });
        } else {
          toast("Just say: " + text);
        }
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
    if (!configured) {
      document.getElementById("setup-banner").hidden = false;
      show("profile-view");
      return;
    }

    renderChips();

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
      if (limitReached()) {
        show("limit-view");
        return;
      }
      document.getElementById("greeting").textContent =
        "Hey " + (profile.name || "there") + "! What are we working on?";
      mountWidget(profile);
      editBtn.hidden = false;
      renderUsage();
      show("chat-view");
    }

    const existing = loadProfile();
    if (existing && existing.name) {
      enterChat(existing);
    } else {
      show("profile-view");
    }

    startUsageWatcher();
  });
})();
