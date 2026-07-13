# ⚒️ LogiCSmith

A personal AI tutor for Singapore MOE students (Primary 1–6, Secondary 1–5, JC 1–2),
built to teach **the way you teach**: connect new concepts to old ones, narrow down
before explaining, check confidence out of 10, no fluff.

Students set up a one-time profile (name, level, MOE subjects, learning style based
on the 8 multiple intelligences), then **chat with the tutor by text or voice**
(powered by **Claude** — type, or tap 🎤 to speak and 🔈 to hear replies read back)
or **call it by voice** (powered by **ElevenLabs**).

Live site: `https://logicsmith13.github.io/LogiCSmith/`

---

## Which AI is which? (read this first)

| Feature | AI brain | Billed from |
| --- | --- | --- |
| 💬 **Text Chat** (main) | **Claude API** (Anthropic) | Your **Anthropic API** credits |
| 🎤 **Speak / 🔈 Read-aloud** (inside Text Chat) | **Claude API** — same thread and prompt as typing; the browser does the listening/speaking for free | Your **Anthropic API** credits (same daily token budget) |
| 📞 **Call** (ElevenLabs test tab) | **ElevenLabs Agents** (voice + its own LLM) | Your **ElevenLabs** call minutes (Free plan ≈ 15 min/month, shared) |

Students also get a **Claude-style sidebar of past chats**. Chats are stored in
the browser's localStorage only — storing them costs zero credits; each request
still sends only the active chat's recent messages.

Two important billing facts:

1. **The ElevenLabs widget never uses your Claude subscription.** Even if you pick
   "Claude" as the LLM inside the ElevenLabs dashboard, ElevenLabs pays Anthropic and
   re-bills you in ElevenLabs credits. If you have no ElevenLabs subscription, the
   voice tab is the thing that will run out — the chat tab is unaffected.
2. **A Claude.ai subscription (Pro/Max) is NOT the same as Claude API credits.**
   The chat tutor calls the Claude **API**, which is billed separately, pay-as-you-go,
   at [console.anthropic.com](https://console.anthropic.com). You need to create an
   API key there and add a small amount of credit (US$5–10 goes a long way for text
   tutoring). Set a monthly spend limit in the console so there are no surprises.

## Files

| File | Purpose |
| --- | --- |
| `index.html` | The app: profile setup → chat tab (Claude) + call tab (ElevenLabs) |
| `prompt.js` | **Your teaching style.** The system prompt, MOE levels/subjects, 8 learning styles |
| `script.js` | Profile storage, chat streaming, history, daily limits, voice widget |
| `worker.js` | Tiny Cloudflare Worker that keeps your Claude API key secret |
| `mock-proxy.js` | Local fake tutor brain — test the app with no API key (see Local development) |
| `config.js` | Proxy URL, ElevenLabs agent ID, daily caps, starter questions |
| `styles.css` | All styling |
| `SECURITY.md` | **Read before going public** — threat model + a dashboard checklist (spend cap, rate limiting, Turnstile) |

---

## 1. Get a Claude API key

1. Go to [console.anthropic.com](https://console.anthropic.com) (sign in with any account —
   this is separate from claude.ai).
2. Add billing / buy a small amount of credit, and set a **monthly spend limit**
   under Settings → Limits.
3. Create an API key (Settings → API keys). Copy it — you'll paste it into the
   worker in the next step, **never** into the website code.

## 2. Deploy the proxy worker (once, ~5 minutes, free)

GitHub Pages is a static host — any key placed in the site's code is public, and
anyone could drain your credits. The fix is a tiny free proxy that holds the key:

1. Sign up at [dash.cloudflare.com](https://dash.cloudflare.com) → **Workers & Pages**
   → **Create Worker**. Name it e.g. `logicsmith-tutor`.
2. Replace the default code with the contents of `worker.js` from this repo → **Deploy**.
3. In the worker's **Settings → Variables and Secrets**, add:
   - `ANTHROPIC_API_KEY` (type: **Secret**) — your key from step 1
   - `ALLOWED_ORIGINS` (type: Text) — `https://logicsmith13.github.io,http://localhost:3000`
   - `MODEL` (type: Text, optional) — defaults to `claude-opus-4-8` (smartest teaching).
     To cut cost you can use `claude-sonnet-5` (~40% of the price, still excellent) or
     `claude-haiku-4-5` (cheapest, noticeably simpler explanations).
4. Copy the worker URL (`https://logicsmith-tutor.<your-account>.workers.dev`) into
   `config.js` → `tutorProxyUrl`. Commit and push.

Only your website (and localhost) can call the worker, the model and token limits
are enforced server-side, and the key never touches the browser.

## 3. Make it teach like YOU (`prompt.js`)

There is **no "training" or fine-tuning involved** — the model isn't retrained on
your files. Instead, its behavior is 100% controlled by the **system prompt** in
`prompt.js`, which already encodes:

- **Connect-to-prior-knowledge analogies** (the 3D → 2D → 1D differentiation /
  integration analogy is in there verbatim as the signature example)
- **Narrow-down questioning** (the "which part of volume?" dialogue is in there
  as the template)
- **The confidence loop** — "out of 10, how confident are you now?" with your exact
  branching: 1–6 re-teach differently, 7–9 ask what would make it a 10, 10 move on
- **Name usage, no fluff, short messages, one idea at a time**
- **Singapore MOE grounding** — PSLE / O-Level / A-Level context per level, bar
  models before algebra for primary, etc.
- **The 8 learning styles** (Linguistic, Logical-mathematical, Spatial,
  Bodily-kinesthetic, Musical, Naturalist, Interpersonal, Intrapersonal) — each has
  its own teaching instruction, chosen by the student in their profile
- **Guide, don't give** — never hands over homework answers

### What "files" should you prepare to improve it?

Write these up (plain text / Markdown is ideal) and fold them into `prompt.js` —
the model imitates concrete examples far better than abstract instructions:

1. **An analogy bank** — for each topic you teach, your go-to analogy, written the
   way you'd say it. Add them under rule 1 in the prompt.
2. **Example mini-dialogues** — 2–3 real exchanges per subject showing a student
   question and *your* exact reply. Add them next to the "volume" example.
3. **Common-mistakes lists** — the pitfalls you see every year, per topic, so the
   tutor warns students about exactly those.
4. **Your sectioning of each topic** — how YOU break "volume" or "differentiation"
   into sub-parts. This makes the narrow-down questions match your teaching flow.

Keep `prompt.js` focused (a few thousand words is fine). The improvement loop:
students use it → you skim conversations with them / ask for feedback → you spot a
reply that doesn't sound like you → you add a rule or example that fixes it. A few
weekly rounds of this converge surprisingly fast.

(If the prompt grows very large later — e.g. full notes for every topic — the next
step up is retrieval: the worker picks the relevant topic notes per question. Not
needed to start.)

## 4. Keep the voice tutor consistent (ElevenLabs)

The call tab still uses your ElevenLabs agent. To make it teach the same way:

1. Generate the voice version of the prompt (it converts `prompt.js` into the
   ElevenLabs format automatically, with `{{student_name}}` etc. as dynamic
   variables and spoken-conversation rules appended):

   ```
   node make-voice-prompt.js > voice-prompt.txt
   ```

   Paste the output into [your agent](https://elevenlabs.io/app/agents) →
   **Agent** tab → system prompt. Re-run and re-paste whenever `prompt.js` changes.
2. In the agent's LLM setting you can pick a Claude model — it improves quality but
   is still billed in ElevenLabs credits.
3. **Knowledge Base** tab: upload lesson notes, worked examples, and common-mistakes
   lists (PDF/docx/txt) and enable RAG — the voice agent retrieves them mid-call.

### Protecting your ElevenLabs credits

In the dashboard: **Security tab** → allowlist `logicsmith13.github.io` (+ `localhost`),
keep overrides OFF. **Advanced tab** → max call duration ~10–15 min, daily call limit
sized to your usage, burst pricing OFF. Set a workspace usage alert. In this app,
`dailyLimitMinutes` in `config.js` adds a per-device soft cap.

## 5. Daily limits in the app

- `dailyTokenBudget` (default 60000) — Claude usage per device per day, metered
  in **tokens** (input + output). Because a photo costs far more tokens than a
  typed line, this reflects real cost better than a flat question count.
  ~60000 ≈ 40 typed questions or ~15 with photos. Shown to students as a
  friendly "🔋 % left today" battery.
- `maxImagesPerMessage` (default 4) — photos a student can attach to one question.
- `dailyLimitMinutes` (default 20) — voice-call minutes per device per day

These are soft, per-device limits (a tech-savvy student can clear localStorage).
The real protection is the worker origin allowlist + your Anthropic console spend
limit + the ElevenLabs dashboard limits.

### Photo upload

Students can attach photos of a question (📎 button, paste, or drag-and-drop) —
handy for worksheets and handwritten working. Photos are downscaled in the
browser before sending (to control cost and storage), sent to Claude with the
question, and shown in the chat. A photo is attached to that one message only;
older photos aren't re-sent, so the tutor is prompted to restate the key part of
a photo in text as you work through it. Only images (jpg/png/webp) are supported
for now.

## Scaling beyond Singapore later

The MOE grounding lives in exactly two places: the level/subject lists at the top of
`prompt.js`, and the `CURRICULUM` block inside `buildSystemPrompt`. To add another
country, add its levels/subjects and a matching curriculum paragraph, plus a
"curriculum" question on the profile form — nothing else changes.

## Local development

```
npx serve .        # any static server; mic access needs localhost or https
```

Add `http://localhost:3000` (or whatever port) to the worker's `ALLOWED_ORIGINS`.

### Test the chat with NO API key (mock proxy)

`mock-proxy.js` is a fake tutor brain that runs on your machine and streams
canned replies in the exact format the real Claude API uses. It lets you test
the whole app — profile, chat streaming, history, daily limits, error states —
with zero API spend and no Cloudflare/Anthropic account:

```
node mock-proxy.js               # starts http://localhost:8788
```

Then temporarily set `tutorProxyUrl: "http://localhost:8788"` in `config.js`
and open the locally served site. Type `!error`, `!fail` or `!long` as chat
messages to test the error and long-reply paths. **Revert `tutorProxyUrl`
before pushing** — the live site should point at the real worker (or stay `""`).

Note: the mock tests the app's plumbing, not the tutor's intelligence. To
preview the actual teaching behavior for free, paste the system prompt from
`prompt.js` into a conversation at claude.ai.

## Deploying changes

```
git add -A
git commit -m "your message"
git push
```

GitHub Pages redeploys automatically in ~1 minute.
