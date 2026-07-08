// ============================================================
// LogiCSmith — MOCK tutor proxy (local testing, no API key)
// ============================================================
// This is NOT the real proxy (that's worker.js, deployed on
// Cloudflare with your Claude API key). This mock runs on YOUR
// machine and replies with canned tutor-style messages in the
// exact same streaming format the real Claude API uses — so you
// can test the whole app (profile → chat → streaming → history
// → daily limits → error states) with zero API spend.
//
// Run:
//   node mock-proxy.js            → listens on http://localhost:8788
//
// Then in config.js, temporarily set:
//   tutorProxyUrl: "http://localhost:8788",
// and serve the site locally (npx serve .). Revert tutorProxyUrl
// before pushing — the live site should point at the real worker.
//
// Test triggers (type these as your chat message):
//   !error   → streams a Claude-style error event (tests the ⚠️ path)
//   !fail    → returns HTTP 500 (tests the "Tutor unavailable" path)
//   !long    → streams a long reply (tests scrolling + formatting)
// ============================================================

const http = require("http");

const PORT = process.env.PORT || 8788;

// Canned replies that exercise the app's formatting: **bold**,
// line breaks, numbered lists, and the confidence-loop question.
const REPLIES = [
  "Good question! Let's narrow it down first.\n" +
    "Which part exactly?\n" +
    "1) The **definition** — what it actually means\n" +
    "2) The **method** — the steps to solve it\n" +
    "3) The **exam angle** — how it's asked in papers\n" +
    "Which one trips you up?",
  "Nice, that's the right thing to ask about.\n" +
    "Think of it like this: **start from what you already know** and build one small step up.\n" +
    "Step 1: recall the earlier topic.\n" +
    "Step 2: see how this new idea is just that, one level up.\n" +
    "Out of 10, how confident are you in this now?",
  "Almost there! Two quick things to check:\n" +
    "1) Did you convert the **units** first?\n" +
    "2) Did you write down what the question is actually asking?\n" +
    "Try the first step and tell me what you get.",
  "**Great progress!** 🎯\n" +
    "One quick practice question to lock it in:\n" +
    "If the base area is 20 cm^2 and the volume is 100 cm^3, what's the height?\n" +
    "(Hint: volume ÷ base area)",
];

const LONG_REPLY =
  "Here's a longer reply to test scrolling and streaming.\n" +
  Array.from({ length: 12 }, (_, i) =>
    "Step " + (i + 1) + ": this is a **numbered step** with enough text to wrap onto multiple lines on a phone screen, so you can check spacing and readability."
  ).join("\n") +
  "\nOut of 10, how confident are you now?";

let replyIndex = 0;

// One SSE event in the exact shape script.js parses.
function sseDelta(text) {
  return (
    "data: " +
    JSON.stringify({
      type: "content_block_delta",
      delta: { type: "text_delta", text: text },
    }) +
    "\n\n"
  );
}

function sseError(message) {
  return (
    "data: " +
    JSON.stringify({ type: "error", error: { type: "mock_error", message: message } }) +
    "\n\n"
  );
}

function corsHeaders(req) {
  return {
    "Access-Control-Allow-Origin": req.headers.origin || "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "content-type",
    "Vary": "Origin",
  };
}

http
  .createServer(function (req, res) {
    const cors = corsHeaders(req);

    if (req.method === "OPTIONS") {
      res.writeHead(204, cors);
      return res.end();
    }
    if (req.method !== "POST") {
      res.writeHead(405, cors);
      return res.end("Method not allowed");
    }

    let raw = "";
    req.on("data", function (c) { raw += c; });
    req.on("end", function () {
      let body = {};
      try { body = JSON.parse(raw); } catch (e) { /* keep {} */ }

      const messages = Array.isArray(body.messages) ? body.messages : [];
      const last = messages.length ? String(messages[messages.length - 1].content || "") : "";
      const trigger = last.trim().toLowerCase();

      if (trigger === "!fail") {
        res.writeHead(500, cors);
        return res.end("Mock: simulated server failure");
      }

      res.writeHead(200, Object.assign({}, cors, {
        "content-type": "text/event-stream",
        "cache-control": "no-store",
      }));

      if (trigger === "!error") {
        res.write(sseError("Mock: simulated Claude API error (e.g. credit balance too low)."));
        return res.end();
      }

      let reply;
      if (trigger === "!long") {
        reply = LONG_REPLY;
      } else {
        reply =
          "🧪 (mock, " + messages.length + " msgs of history received)\n" +
          REPLIES[replyIndex % REPLIES.length];
        replyIndex += 1;
      }

      // Stream a few words at a time, like the real API does.
      const words = reply.split(" ");
      let i = 0;
      const timer = setInterval(function () {
        if (i >= words.length) {
          clearInterval(timer);
          return res.end();
        }
        const chunk = words.slice(i, i + 3).join(" ") + (i + 3 < words.length ? " " : "");
        res.write(sseDelta(chunk));
        i += 3;
      }, 40);

      // res 'close' fires if the browser disconnects mid-stream
      // (req 'close' fires as soon as the body is read — too early)
      res.on("close", function () { clearInterval(timer); });
    });
  })
  .listen(PORT, function () {
    console.log("LogiCSmith mock tutor proxy running on http://localhost:" + PORT);
    console.log('Point config.js → tutorProxyUrl at it, e.g. "http://localhost:' + PORT + '"');
  });
