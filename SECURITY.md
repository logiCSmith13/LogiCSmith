# LogiCSmith — Security

This app is a **static website** (GitHub Pages) plus a **tiny proxy** (Cloudflare
Worker) that holds the Claude API key. There is no database and no server you own
that stores student data — chats live only in each student's browser.

Below is the threat model, what's already hardened in code, and the **manual
steps you must do in the dashboards** before opening it to everyone.

---

## The one attack that actually matters: an open AI proxy

The classic "AI app got hacked / huge bill" story is almost never a database
breach — it's someone finding your **proxy URL** and using it as a **free,
uncensored Claude** on your credits. Everything below is aimed at that.

Your defences, strongest first:

1. **A hard monthly spend cap in the Anthropic console.** This is the backstop
   that makes the worst case survivable. Even if everything else fails, your bill
   cannot exceed this. **Do this first.**
2. **A bot/human check (Cloudflare Turnstile) on the worker.** Stops scripted
   abuse — the actual fix for "someone is hammering my URL."
3. **Rate limiting** per IP (Cloudflare rule or the worker's built-in KV limiter).
4. **Origin allowlist + server-side caps** (already in `worker.js`).

---

## What's already hardened in the code

**`worker.js`** (you must **redeploy** it — paste the new version over the old):
- The Claude **API key never reaches the browser** — only the worker has it.
- **Model, output length, history length, per-message length, image count and
  request size are all clamped server-side**, so a tampered client can't ask for
  more (e.g. can't switch to a pricier model or request huge outputs).
- An **immutable safety guardrail** is appended to every request: the assistant
  stays a tutor for a minor and refuses unsafe/inappropriate content even if the
  client-sent prompt is tampered with.
- **Origin allowlist** (`ALLOWED_ORIGINS`) rejects requests from other sites.
- **Optional Turnstile** verification (set `TURNSTILE_SECRET`) and **optional
  per-IP rate limiting** (bind a KV namespace named `RATE_LIMIT`).
- Security headers (`X-Content-Type-Options`, `Referrer-Policy`, `no-store`).

**`index.html`**: a **Content-Security-Policy** restricts where scripts, styles,
fonts and network connections can come from — so an injected script can't phone
home to an attacker or load rogue code. `connect-src` is limited to your worker +
ElevenLabs.

**`script.js`**: all student and model text is **HTML-escaped** before display,
and model-drawn SVG passes a **strict whitelist sanitizer** (no scripts, event
handlers, or external references) — this is the main XSS defence.

**`prompt.js`**: the tutor is told it's talking to a possible child, to refuse
unsafe requests, not to role-play as another system, and never to collect
personal details.

---

## What YOU must do in the dashboards (checklist)

- [ ] **Anthropic console → Settings → Limits:** set a **monthly spend limit**
      you're comfortable with. This is the single most important control.
- [ ] **Redeploy `worker.js`** (Cloudflare → your worker → paste the new code →
      Deploy) so the server-side caps + guardrail take effect.
- [ ] **Confirm the worker's secrets/variables:** `ANTHROPIC_API_KEY` (Secret),
      `ALLOWED_ORIGINS` = `https://logicsmith13.github.io` (+ localhost while
      testing), `MODEL` = `claude-sonnet-5` (or your choice).
- [ ] **Cloudflare → Security → WAF → Rate limiting rules:** add a rule on the
      worker route, e.g. *more than 30 requests per minute per IP → Block for
      1 minute*. No code needed; effective immediately.
- [ ] **(Strongly recommended) Turnstile:** Cloudflare → Turnstile → create a
      widget for `logicsmith13.github.io`. Put the **secret** on the worker as
      `TURNSTILE_SECRET`. Then tell me the **site key** and I'll wire the small
      frontend piece (and we test it together) so every request proves it's a
      real person, not a script.
- [ ] **(Optional) Built-in rate limiter:** create a KV namespace, bind it to the
      worker as `RATE_LIMIT`. The worker then enforces ~20 req/min and 500/day
      per IP by itself.
- [ ] **ElevenLabs dashboard:** allowlist `logicsmith13.github.io`, set a max
      call duration and a **monthly** minute cap, keep overrides OFF.
- [ ] **Never commit the API key.** It lives only in the worker secret. If it was
      ever pasted somewhere public, **rotate it** in the Anthropic console.

---

## Optional: the question log (see what students ask)

Off by default. When enabled, the worker records each **question + the tutor's
answer** (with the student's **nickname, level, subject and timestamp**) so you
can review what to teach. **Because your users are minors, disclose it** — the
app's privacy note already says *"your tutor may review the questions you ask to
improve lessons."* Rows auto-delete after `LOG_RETENTION_DAYS` (default 30).

**Enable it (Cloudflare):**
1. **D1 → Create database** (e.g. `logicsmith-log`). Free tier is plenty.
2. Your worker → **Settings → Bindings → Add → D1 database**: variable name
   **`LOG_DB`**, pick that database.
3. Worker → **Settings → Variables and Secrets → Add secret** **`ADMIN_KEY`** —
   a long random password (this protects the viewer).
4. (Optional) variable `LOG_RETENTION_DAYS` (default 30).
5. **Deploy.** The table is created automatically on the first logged question.

**View them:** open `https://<your-worker-url>/admin` in a browser. It asks for a
login — username **`admin`**, password your **`ADMIN_KEY`**. You get a searchable
table (filter by subject or keyword). Keep `ADMIN_KEY` private; anyone with it can
read the log.

**Turn it off / wipe it:** remove the `LOG_DB` binding (logging stops) and/or drop
the `logs` table in the D1 console.

---

## Residual risks (by design — decide if they're acceptable)

- **Open access / no login.** Anyone with the link can use it. That's the current
  design. If you later want per-student control (or to stop strangers entirely),
  add sign-in — happy to build a simple access-code or account gate.
- **The in-app "🔋 % left today" cap is a soft, per-device guide only** — a user
  can reset it by clearing browser data. Your real cost ceiling is the Anthropic
  monthly limit + rate limiting above, not this number.
- **Chats are stored unencrypted in the browser's localStorage.** Anyone with
  physical access to an unlocked device could read that device's chats.
- **If the question log is enabled** (above), questions + answers + nicknames are
  stored in your Cloudflare D1 and readable by anyone who has your `ADMIN_KEY`.
  Keep that key private, keep retention short, and disclose the logging to
  students/parents. If it's disabled (no `LOG_DB`), nothing is synced anywhere.
- **Prompt content still goes to Anthropic** to generate answers (that's how the
  tutor works). Anthropic's API data-use terms apply.

---

## Reporting

Found a security issue? Contact the site owner directly — please don't open a
public GitHub issue with exploit details.
