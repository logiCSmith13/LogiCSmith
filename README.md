# ⚒️ LogiCSmith

An AI voice tutor for students — talk through homework and questions out loud
with a tutor that guides you to the answer instead of just handing it over.

Built as a simple static site with the [ElevenLabs Agents](https://elevenlabs.io/app/agents)
embeddable voice widget. No build tools, no server required.

## Files

| File         | Purpose                                                        |
| ------------ | -------------------------------------------------------------- |
| `index.html` | Landing page with the embedded voice widget                    |
| `config.js`  | **← put your ElevenLabs agent ID here**                        |
| `script.js`  | Injects the widget from config; shows a setup banner until then |
| `styles.css` | All styling                                                    |

## 5-minute setup

### 1. Create your tutor agent

1. Sign up / log in at [elevenlabs.io](https://elevenlabs.io) (free tier works).
2. Go to **Agents** → **Create agent** → start from a blank agent.
3. Name it **LogiCSmith Tutor** and paste this as the **system prompt**:

   ```
   You are LogiCSmith, a warm and encouraging voice tutor for students from
   middle school through early college. Your job is to help with homework and
   questions in any subject — math, science, writing, coding, history,
   languages — using the Socratic method.

   Rules:
   - Never just give the final answer to a homework problem. Guide the student
     there with hints, leading questions, and worked examples of SIMILAR
     problems.
   - Start by asking what subject and grade level they're working on if you
     don't know, and adapt your vocabulary and depth to match.
   - Break problems into small steps. After each step, check understanding
     with a quick question before moving on.
   - Celebrate progress genuinely but briefly. If the student is frustrated,
     slow down and simplify.
   - Keep spoken responses short (2–4 sentences) since this is a voice
     conversation — don't lecture in long paragraphs.
   - If asked to write an essay or do an assignment wholesale, decline kindly
     and offer to brainstorm, outline, or review their draft instead.
   - Stay on educational topics. If the student needs help beyond tutoring
     (personal issues, safety concerns), gently suggest they talk to a
     trusted adult, teacher, or counselor.
   ```

4. Set a **first message**, e.g.:
   > "Hey, I'm LogiCSmith! What are you working on today?"
5. Pick a friendly **voice** you like in the Voice tab.

### 2. Make the agent embeddable

1. In the agent's **Advanced** tab: enable **public agent** (authentication
   disabled) — the embedded widget requires this.
2. (Recommended, before going live) In the **Security** tab, add your site's
   domain to the **Allowlist** so only your site can use the agent.

### 3. Connect it to the site

1. Copy the **Agent ID** from the agent's settings.
2. Open `config.js` and replace `YOUR_AGENT_ID_HERE` with it.
3. Open the site in a browser — the tutor appears embedded in the hero
   panel at the top. Press "Start a call", allow microphone access, and talk.

> Tip: browsers only allow microphone access on `https://` or `localhost`.
> For local testing, serve the folder instead of double-clicking the file:
> `npx serve .` (then open the printed localhost URL).

## Deploying

It's a static folder — host it anywhere:

- **Netlify / Vercel**: drag-and-drop the folder or connect a repo.
- **GitHub Pages**: push to a repo, enable Pages.
- **Cloudflare Pages**: same idea.

After deploying, add your production domain to the agent's **Allowlist**
(step 2.2) so other sites can't embed your agent and burn your credits.

## Customizing the widget

`config.js` also lets you tweak the widget's button text and orb colors.
More attributes (avatar image, language overrides, expanded variant, dynamic
variables) are documented in the
[ElevenLabs widget docs](https://elevenlabs.io/docs/eleven-agents/customization/widget).
