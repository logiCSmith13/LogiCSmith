// LogiCSmith — injects the ElevenLabs voice widget into the hero panel
(function () {
  const cfg = window.LOGICSMITH_CONFIG || (typeof LOGICSMITH_CONFIG !== "undefined" ? LOGICSMITH_CONFIG : null);
  const configured = cfg && cfg.agentId && cfg.agentId !== "YOUR_AGENT_ID_HERE";

  document.addEventListener("DOMContentLoaded", function () {
    if (!configured) {
      document.getElementById("setup-banner").hidden = false;
      return;
    }

    const widget = document.createElement("elevenlabs-convai");
    widget.setAttribute("agent-id", cfg.agentId);
    widget.setAttribute("variant", "expanded");
    if (cfg.actionText) widget.setAttribute("action-text", cfg.actionText);
    if (cfg.startCallText) widget.setAttribute("start-call-text", cfg.startCallText);
    if (cfg.endCallText) widget.setAttribute("end-call-text", cfg.endCallText);
    if (cfg.orbColor1) widget.setAttribute("avatar-orb-color-1", cfg.orbColor1);
    if (cfg.orbColor2) widget.setAttribute("avatar-orb-color-2", cfg.orbColor2);

    document.getElementById("tutor-widget-slot").appendChild(widget);
  });
})();
