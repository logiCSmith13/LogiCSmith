// ============================================================
// LogiCSmith — ElevenLabs voice prompt generator
// ============================================================
// The voice tutor should teach exactly like the chat tutor.
// Instead of maintaining two prompts by hand, run this after any
// prompt.js change and paste the output into your ElevenLabs
// agent's system prompt (Agent tab):
//
//   node make-voice-prompt.js > voice-prompt.txt
//
// It reuses buildSystemPrompt with ElevenLabs {{dynamic_variables}}
// in place of the profile (the app passes student_name, grade_level,
// subjects, confidence, learning_style and notes into the widget —
// see mountWidget in script.js), swaps the parts that JS normally
// resolves per-student (exam context, learning-style instruction)
// for all-cases text, and appends voice-conversation rules.
// ============================================================

global.window = {};
require("./prompt.js");
const P = global.window.LOGICSMITH_PROMPT;

let p = P.buildSystemPrompt({
  name: "{{student_name}}",
  level: "{{grade_level}}",
  subjects: "{{subjects}}",
  confidence: "{{confidence}}",
  style: "{{learning_style}}",
  notes: "{{notes}}",
});

// buildSystemPrompt can't branch on a template variable, so it emits
// the Secondary exam context and the fallback learning style. Replace
// both with all-cases instructions the voice agent applies itself.
const SECONDARY_EXAM =
  "They are working towards the O-Levels (or N-Levels). Build on what they learnt in primary school and earlier secondary years.";
const ALL_LEVELS_EXAM =
  "If {{grade_level}} is a Primary level: they are working towards the PSLE — use primary school methods only (bar models / model drawing for word problems, NOT algebra). " +
  "If Secondary: they are working towards the O-Levels (or N-Levels), building on primary and earlier secondary years. " +
  "If JC: they are working towards the A-Levels — you can assume O-Level foundations.";

const FALLBACK_STYLE = P.STYLE_INSTRUCTIONS["Logical-mathematical"];
const ALL_STYLES =
  "Apply the instruction that matches {{learning_style}}:\n" +
  Object.keys(P.STYLE_INSTRUCTIONS)
    .map(function (k) { return "- " + k + ": " + P.STYLE_INSTRUCTIONS[k]; })
    .join("\n");

[
  [SECONDARY_EXAM, ALL_LEVELS_EXAM],
  [FALLBACK_STYLE, ALL_STYLES],
].forEach(function (pair) {
  if (p.indexOf(pair[0]) === -1) {
    console.error("WARNING: expected text not found in prompt.js output — update make-voice-prompt.js:\n" + pair[0]);
    process.exitCode = 1;
  }
  p = p.replace(pair[0], pair[1]);
});

p += `

VOICE RULES — this is a spoken phone conversation, not text:
- Keep spoken responses to 2-4 sentences, then pause and let ${"{{student_name}}"} respond.
- Never read out formatting characters — no asterisks, no markdown, no bullet symbols.
- Say maths naturally: "x squared", "two thirds", "y divided by x" — never spell out symbols.
- For anything the student should SEE (long working, graphs), do it step by step verbally and suggest they write it down as you go.
- If the student goes quiet, gently re-engage with one short question.`;

console.log(p);
