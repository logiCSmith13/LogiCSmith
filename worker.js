// ============================================================
// LogiCSmith — Claude API proxy (deploy on Cloudflare Workers)
// ============================================================
// GitHub Pages is a static host: any key you put in the website's
// code is public, and anyone could drain your Claude credits.
// This tiny worker holds the key instead. The website calls the
// worker; the worker calls the Claude API and streams the answer
// back. Deploy it once (free tier) — see README.md, section 2.
//
// Secrets / variables to set on the worker:
//   ANTHROPIC_API_KEY  (secret)   your key from console.anthropic.com
//   ALLOWED_ORIGINS    (variable) https://logicsmith13.github.io,http://localhost:3000
//   MODEL              (variable) optional — defaults to claude-opus-4-8
// ============================================================

export default {
  async fetch(request, env) {
    const origin = request.headers.get("Origin") || "";
    const allowed = (env.ALLOWED_ORIGINS || "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    const originAllowed = allowed.indexOf(origin) !== -1;

    const cors = {
      "Access-Control-Allow-Origin": originAllowed ? origin : "null",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "content-type",
      "Vary": "Origin",
    };

    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: cors });
    }
    if (request.method !== "POST") {
      return new Response("Method not allowed", { status: 405, headers: cors });
    }
    if (!originAllowed) {
      return new Response("Origin not allowed", { status: 403, headers: cors });
    }

    let body;
    try {
      body = await request.json();
    } catch (e) {
      return new Response("Bad request", { status: 400, headers: cors });
    }

    // Only forward the fields the app is supposed to send.
    // Model and token caps are enforced HERE so the client can't be abused.
    const payload = {
      model: env.MODEL || "claude-opus-4-8",
      max_tokens: 2048,
      stream: true,
      system: body.system,
      messages: Array.isArray(body.messages) ? body.messages.slice(-40) : [],
    };
    if (payload.messages.length === 0) {
      return new Response("No messages", { status: 400, headers: cors });
    }

    const upstream = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": env.ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify(payload),
    });

    return new Response(upstream.body, {
      status: upstream.status,
      headers: {
        ...cors,
        "content-type": upstream.headers.get("content-type") || "text/event-stream",
        "cache-control": "no-store",
      },
    });
  },
};
