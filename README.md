# ⚒️ LogiCSmith

A chat-style AI voice tutor for students (12–18). Students set up a one-time
profile (grade, subjects, confidence, learning style) and the tutor adapts to
them from the first word. Powered by the
[ElevenLabs Agents](https://elevenlabs.io/app/agents) voice widget — static
site, no server needed.

Live site: `https://logicsmith13.github.io/LogiCSmith/`

## Files

| File         | Purpose                                                            |
| ------------ | ------------------------------------------------------------------ |
| `index.html` | The app: profile setup → tutor chat view → daily-limit view        |
| `config.js`  | Agent ID, daily minutes cap, and the suggested starter questions   |
| `script.js`  | Profile storage, widget mounting with dynamic variables, usage cap |
| `styles.css` | All styling                                                        |

---

## 1. Connect the student profile to your agent (do this once)

The app collects a profile and passes it to your agent as **dynamic
variables**. For the agent to actually use them, your agent's prompt must
reference them with `{{double_braces}}`.

In [your agent's](https://elevenlabs.io/app/agents) **Agent** tab:

**Replace the system prompt** with this (edit the persona freely, but keep the
`{{variables}}`):

```
You are LogiCSmith, a warm and encouraging voice tutor for students from
middle school through college. You help with homework and questions in any
subject using the Socratic method.

About the student you are tutoring right now:
- Name: {{student_name}}
- Grade level: {{grade_level}}
- Subjects they want help with: {{subjects}}
- Their confidence level: {{confidence}}
- How they like to learn: {{learning_style}}
- Notes from the student: {{notes}}

Adapt everything to this student: vocabulary, pacing, difficulty, and
examples must match their grade level and confidence. Teach in the style
they asked for ({{learning_style}}).

Rules:
- Never just give the final answer to a homework problem. Guide the student
  there with hints, leading questions, and worked examples of SIMILAR problems.
- Break problems into small steps. After each step, check understanding with
  a quick question before moving on.
- Celebrate progress genuinely but briefly. If the student is frustrated,
  slow down and simplify.
- Keep spoken responses short (2–4 sentences) — this is a voice conversation.
- If asked to write an essay or do an assignment wholesale, decline kindly
  and offer to brainstorm, outline, or review their draft instead.
- Stay on educational topics. If the student needs help beyond tutoring,
  gently suggest they talk to a trusted adult, teacher, or counselor.
```

**Set the first message** to something like:

```
Hey {{student_name}}! Ready to work on some {{subjects}}? What are we tackling today?
```

**Set default values** for each dynamic variable (the dashboard prompts you
for `dynamic_variable_placeholders`) — e.g. `there` for `student_name`,
`not specified` for the rest. This keeps the dashboard "Test agent" button
working when no profile is passed.

The profile is stored only in the student's browser (`localStorage`) — it
never touches a server, and they can edit it anytime via **My profile**.

---

## 2. Teach the agent YOUR way (knowledge + style)

Two mechanisms carry your personal teaching approach into the agent:

### A. Your style → the system prompt

The system prompt is where your mentoring personality lives. Make it concrete:

1. **Write down how you actually teach.** Not "be encouraging" but the real
   moves: *"When a student is stuck, I first ask them to re-read the problem
   out loud and tell me what it's asking. I never introduce a formula before
   showing a real-life situation that needs it."*
2. **Add your signature phrases and analogies.** If you always explain
   fractions with pizza or variables as "mystery boxes," write those into the
   prompt: *"Explain variables as 'mystery boxes' the first time they come up."*
3. **Add 2–3 example mini-dialogues** at the bottom of the prompt showing a
   student question and how YOU would respond. The model imitates examples
   far better than it follows abstract instructions.
4. **Iterate from real transcripts.** The ElevenLabs dashboard keeps every
   conversation (Agents → your agent → Conversations / Call history). Read a
   few sessions weekly, spot where the tutor didn't sound like you, and add a
   rule or example that corrects it. This loop is how the agent converges on
   your voice.

### B. Your knowledge → the Knowledge Base (RAG)

In your agent's **Knowledge Base** tab you can upload files, URLs, or text.
The agent retrieves relevant passages during conversation (enable **RAG** in
the Knowledge Base settings when prompted):

- Upload your **lesson notes, worked examples, cheat sheets, and study
  guides** (PDF, docx, txt, html all work).
- Structure documents around *how you explain things*, not just facts —
  e.g. "My 3-step method for word problems," with a worked example of each
  step, teaches the agent your method.
- Add your **grading rubrics or common-mistakes lists** so the tutor warns
  students about the exact pitfalls you see every year.
- Keep documents focused (one topic per file); retrieval works better than
  with one giant file.

Prompt + knowledge base together = the agent explains things using your
materials, in your style. Test it by asking a question you have a strong
opinion about how to teach, and refine until the answer sounds like you.

---

## 3. Protecting your credits (do ALL of these)

The widget requires a public agent, so the protection is layered limits, not
secrecy. In the [dashboard](https://elevenlabs.io/app/agents), open your agent:

**Security tab**
1. **Allowlist** — add `logicsmith13.github.io` (and `localhost` while
   developing). Only these hosts can start conversations with your agent.
   This is the single most important setting.
2. **Overrides — keep OFF.** If overrides are on, anyone embedding your
   agent could replace your system prompt and use your credits as a general
   chatbot.

**Advanced tab → Call Limits**
3. **Max conversation duration** — set ~10–15 minutes. Hard stop per call,
   even if a student leaves a tab open.
4. **Daily call limit** — cap how many conversations the agent accepts per
   day, sized to your expected usage (e.g. 20–50 while testing).
5. **Burst pricing — keep OFF** so traffic spikes can't bill at double rate.

**Workspace level**
6. Set a **usage budget / alerts** in your ElevenLabs account settings so
   you get an email before credits run dry.

**In this app (client-side)**
7. `dailyLimitMinutes` in `config.js` (default 20) caps tutoring minutes per
   day per device; the app tracks call time and swaps in a "come back
   tomorrow" screen at the limit. It's a soft limit (a tech-savvy student
   can clear localStorage), so treat the dashboard limits above as the real
   enforcement — this one just keeps honest kids honest.

**If you ever need bulletproof enforcement** (per-student accounts, server-
side quotas): switch the agent to private and mint conversation tokens from a
tiny serverless function (Cloudflare Workers / Vercel functions have free
tiers). That requires real hosting rather than GitHub Pages — worth it only
if the layered limits above prove insufficient.

---

## Local development

Serve the folder (mic access needs `localhost` or `https`):

```
npx serve .        # or any static server
```

## Deploying changes

```
git add -A
git commit -m "your message"
git push
```

GitHub Pages redeploys automatically in ~1 minute.
