import {
  DEFAULT_MODEL,
  MODELS,
  PROMPT_1,
  PROMPT_2,
  PROMPT_3,
  CHAT_PASSWORD
} from "./config.js";

function resp(body, contentType = "text/plain; charset=utf-8", status = 200, extraHeaders = {}) {
  return new Response(body, {
    status,
    headers: {
      "Content-Type": contentType,
      ...extraHeaders
    }
  });
}

function isAllowedModel(modelId) {
  return MODELS.some((m) => m.id === modelId);
}

function builtinPromptForModel(modelId) {
  const meta = MODELS.find((m) => m.id === modelId);
  const persona = meta?.persona ?? 1;
  if (persona === 3) return PROMPT_3;
  if (persona === 2) return PROMPT_2;
  return PROMPT_1;
}

function clientConfigJs() {
  const models = MODELS.map((m) => ({
    id: m.id,
    label: m.label
  }));

  return `window.APP_MODELS = ${JSON.stringify(models, null, 2)};
window.APP_DEFAULT_MODEL = ${JSON.stringify(DEFAULT_MODEL)};
window.APP_PASSWORD = ${JSON.stringify(CHAT_PASSWORD)};
`;
}

async function handleChat(request, env) {
  let payload;
  try {
    payload = await request.json();
  } catch {
    return resp("Bad JSON", "text/plain; charset=utf-8", 400);
  }

  const requestedModel = payload?.model;
  const model = isAllowedModel(requestedModel) ? requestedModel : DEFAULT_MODEL;

  const useBuiltinPersona = payload?.use_builtin_persona !== false;
  const customSystemPrompt =
    typeof payload?.custom_system_prompt === "string"
      ? payload.custom_system_prompt.trim()
      : "";

  const worldBookContext =
    typeof payload?.world_book_context === "string"
      ? payload.world_book_context.trim()
      : "";

  const messages = Array.isArray(payload?.messages) ? payload.messages : [];
  const upstreamMessages = [];

  // Build system prompt
  let systemContent = "";

  if (useBuiltinPersona) {
    systemContent = builtinPromptForModel(model);
  } else if (customSystemPrompt) {
    systemContent = customSystemPrompt;
  }

  // Append world book context to system prompt
  if (worldBookContext) {
    if (systemContent) {
      systemContent += "\n\n[World Context / Lorebook]\n" + worldBookContext;
    } else {
      systemContent = "[World Context / Lorebook]\n" + worldBookContext;
    }
  }

  if (systemContent) {
    upstreamMessages.push({
      role: "system",
      content: systemContent
    });
  }

  for (const msg of messages) {
    if (!msg || typeof msg !== "object") continue;
    if (msg.role !== "user" && msg.role !== "assistant") continue;

    upstreamMessages.push({
      role: msg.role,
      content: typeof msg.content === "string" ? msg.content : ""
    });
  }

  if (!env.NVIDIA_API_KEY) {
    return resp(
      "Missing NVIDIA_API_KEY (please set it with wrangler secret).",
      "text/plain; charset=utf-8",
      500
    );
  }

  // Build upstream request body
  const upstreamBody = {
    model,
    stream: true,
    stream_options: { include_usage: true },
    messages: upstreamMessages,
  };

  // Optional parameters from presets
  if (typeof payload?.temperature === "number") upstreamBody.temperature = payload.temperature;
  if (typeof payload?.top_p === "number") upstreamBody.top_p = payload.top_p;
  if (typeof payload?.max_tokens === "number") upstreamBody.max_tokens = payload.max_tokens;
  if (typeof payload?.frequency_penalty === "number") upstreamBody.frequency_penalty = payload.frequency_penalty;
  if (typeof payload?.presence_penalty === "number") upstreamBody.presence_penalty = payload.presence_penalty;

  const upstream = await fetch("https://integrate.api.nvidia.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${env.NVIDIA_API_KEY}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify(upstreamBody)
  });

  if (!upstream.ok) {
    const errorText = await upstream.text().catch(() => "");
    return resp(
      `Upstream error ${upstream.status}: ${errorText}`,
      "text/plain; charset=utf-8",
      502
    );
  }

  return new Response(upstream.body, {
    status: 200,
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      "Connection": "keep-alive"
    }
  });
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (request.method === "GET" && url.pathname === "/config.js") {
      return resp(clientConfigJs(), "text/javascript; charset=utf-8");
    }

    if (request.method === "POST" && url.pathname === "/api/chat") {
      return handleChat(request, env);
    }

    // Password validation API (optional)
    if (request.method === "POST" && url.pathname === "/api/verify-password") {
      let body;
      try { body = await request.json(); } catch { return resp("Bad JSON", "text/plain", 400); }
      if (body.password === CHAT_PASSWORD) {
        return resp(JSON.stringify({ ok: true }), "application/json");
      }
      return resp(JSON.stringify({ ok: false, error: "Wrong password" }), "application/json", 403);
    }

    if (env.ASSETS && typeof env.ASSETS.fetch === "function") {
      return env.ASSETS.fetch(request);
    }

    return resp(
      "Static assets binding 'ASSETS' is missing. Please configure [assets] in wrangler.toml.",
      "text/plain; charset=utf-8",
      500
    );
  }
};
