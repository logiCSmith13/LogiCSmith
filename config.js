// ============================================================
// LogiCSmith configuration
// ============================================================
// tutorProxyUrl: URL of your deployed Claude proxy worker
//   (see worker.js + README.md section 2). The text chat is
//   powered by Claude through this proxy. Leave "" to disable
//   the chat until you've deployed it.
// agentId: ElevenLabs agent for the optional voice call tab,
//   from https://elevenlabs.io/app/agents
// dailyTokenBudget: soft per-device daily cap on Claude usage, in tokens
//   (input + output). Photos cost far more tokens than a typed line, so this
//   reflects real cost better than a flat question count. ~60000 ≈ 40 typed
//   questions or ~15 with photos. SOFT cap only — a student can reset it by
//   clearing browser data. Your HARD ceiling is the monthly spend limit in the
//   Anthropic console. Change this number freely.
// maxImagesPerMessage: how many photos a student can attach to one question.
// dailyLimitMinutes: soft cap on voice-call minutes per device/day.
//   IMPORTANT: voice calls are billed by ElevenLabs in MINUTES from your plan's
//   included ElevenAgents allowance (Free = ~15 min/MONTH, shared across ALL
//   students), NOT from the 10k TTS credits. This per-device DAILY cap does not
//   protect that shared monthly pool — set a hard MONTHLY limit in the
//   ElevenLabs dashboard too (README). Kept low on the free plan.
// suggestions: the "tap to ask" starter questions shown in the app.
// ============================================================

const LOGICSMITH_CONFIG = {
  tutorProxyUrl: "https://logicsmith-tutor.cs1415319.workers.dev",

  agentId: "agent_4501kwxfp7emfxtb957xknpf6xqt",

  dailyTokenBudget: 60000,
  maxImagesPerMessage: 4,
  dailyLimitMinutes: 5,

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
