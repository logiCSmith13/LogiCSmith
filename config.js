// ============================================================
// LogiCSmith configuration
// ============================================================
// tutorProxyUrl: URL of your deployed Claude proxy worker
//   (see worker.js + README.md section 2). The text chat is
//   powered by Claude through this proxy. Leave "" to disable
//   the chat until you've deployed it.
// agentId: ElevenLabs agent for the optional voice call tab,
//   from https://elevenlabs.io/app/agents
// dailyChatMessages: soft cap on chat questions per device/day.
// dailyLimitMinutes: soft cap on voice-call minutes per device/day.
//   Also set hard limits in the ElevenLabs dashboard (README).
// suggestions: the "tap to ask" starter questions shown in the app.
// ============================================================

const LOGICSMITH_CONFIG = {
  tutorProxyUrl: "https://logicsmith-tutor.cs1415319.workers.dev",

  agentId: "agent_4501kwxfp7emfxtb957xknpf6xqt",

  dailyChatMessages: 60,
  dailyLimitMinutes: 20,

  suggestions: [
    "I don't understand decimals at all",
    "Help me with this algebra question",
    "How do I answer 'explain' questions in Science?",
    "Quiz me on heat energy",
    "How do I write a better compo introduction?",
    "Why do I keep losing marks in Paper 2?",
  ],

  // Voice widget labels + brand colors
  actionText: "Prefer to talk it out?",
  startCallText: "Call your tutor",
  endCallText: "End call",
  orbColor1: "#6c5ce7",
  orbColor2: "#00cec9",
};
