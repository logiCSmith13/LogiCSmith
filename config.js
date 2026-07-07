// ============================================================
// LogiCSmith configuration
// ============================================================
// agentId: from https://elevenlabs.io/app/agents (see README.md)
// dailyLimitMinutes: soft daily cap on tutoring time per device.
//   Also set hard limits in the ElevenLabs dashboard — see the
//   "Protecting your credits" section of README.md.
// suggestions: the "tap to copy" starter questions shown in the app.
// ============================================================

const LOGICSMITH_CONFIG = {
  agentId: "agent_4501kwxfp7emfxtb957xknpf6xqt",

  dailyLimitMinutes: 20,

  suggestions: [
    "Explain photosynthesis like I'm 12",
    "Help me solve 3x + 5 = 20",
    "Is my thesis statement any good?",
    "Quiz me on World War II",
    "Why does my code loop forever?",
    "How do I study for a math test?",
  ],

  // Widget button labels + brand colors for the voice orb
  actionText: "Need homework help?",
  startCallText: "Start tutoring session",
  endCallText: "End session",
  orbColor1: "#6c5ce7",
  orbColor2: "#00cec9",
};
