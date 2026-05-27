// server.js
// Express 服务 — 替代原 Cloudflare Worker
import "dotenv/config";
import express from "express";
import OpenAI from "openai";
import {
  CHAT_PASSWORD,
  DEFAULT_MODEL,
  MODELS,
  PORT,
  UNIVERSAL_PROMPT,
  isAllowedModel,
  builtinPromptForModel,
  clientConfig,
  getModelMeta,
} from "./config.js";

const app = express();
app.use(express.json());

// 动态 /config.js — 下发模型列表给前端（必须在静态文件之前）
app.get("/config.js", (_req, res) => {
  res.type("text/javascript").send(clientConfig());
});

// 静态文件
app.use(express.static("public"));

// 密码校验
app.post("/api/verify-password", (req, res) => {
  const { password } = req.body || {};
  if (password === CHAT_PASSWORD) {
    res.json({ ok: true });
  } else {
    res.status(401).json({ ok: false, error: "密码错误" });
  }
});

// 聊天接口 — SSE streaming
app.post("/api/chat", async (req, res) => {
  const payload = req.body || {};

  if (payload.password !== CHAT_PASSWORD) {
    return res.status(401).json({ error: "密码错误" });
  }

  const requestedModel = payload?.model;
  const model = isAllowedModel(requestedModel) ? requestedModel : DEFAULT_MODEL;
  const meta = getModelMeta(model);
  const provider = meta?.provider || "deepseek";

  let apiKey, baseURL;
  if (provider === "openai") {
    apiKey = process.env.OPENAI_API_KEY;
    baseURL = "https://api.openai.com/v1";
  } else {
    apiKey = process.env.DEEPSEEK_API_KEY;
    baseURL = "https://api.deepseek.com/v1";
  }

  if (!apiKey) {
    res.type("text/plain; charset=utf-8");
    return res.status(500).send(`Missing API key for provider: ${provider}`);
  }

  const client = new OpenAI({ apiKey, baseURL });

  const useBuiltinPersona = payload?.use_builtin_persona !== false;
  const customSystemPrompt =
    typeof payload?.custom_system_prompt === "string"
      ? payload.custom_system_prompt.trim()
      : "";

  const messages = Array.isArray(payload?.messages) ? payload.messages : [];
  const upstreamMessages = [];

  if (useBuiltinPersona) {
    upstreamMessages.push({
      role: "system",
      content: builtinPromptForModel(model),
    });
  } else if (customSystemPrompt) {
    upstreamMessages.push({
      role: "system",
      content: customSystemPrompt,
    });
  }

  for (const msg of messages) {
    if (!msg || typeof msg !== "object") continue;
    if (msg.role !== "user" && msg.role !== "assistant") continue;
    upstreamMessages.push({
      role: msg.role,
      content: typeof msg.content === "string" ? msg.content : "",
    });
  }

  try {
    const stream = await client.chat.completions.create({
      model,
      messages: upstreamMessages,
      stream: true,
      stream_options: { include_usage: true },
    });

    res.setHeader("Content-Type", "text/event-stream; charset=utf-8");
    res.setHeader("Cache-Control", "no-cache, no-transform");
    res.setHeader("Connection", "keep-alive");

    for await (const chunk of stream) {
      const data = JSON.stringify(chunk);
      res.write(`data: ${data}\n\n`);
    }
    res.end();
  } catch (err) {
    console.error("Upstream error:", err);
    if (!res.headersSent) {
      res.type("text/plain; charset=utf-8");
      res.status(502).send(`Upstream error: ${err.message}`);
    } else {
      res.end();
    }
  }
});

// ─── OpenAI 兼容端点（供 SillyTavern 等前端接入） ───
const SERVER_API_KEY = process.env.SERVER_API_KEY || "sk-asuka-local-bridge";

function extractApiKey(req) {
  const auth = req.headers.authorization || "";
  const m = auth.match(/^Bearer\s+(.+)$/i);
  return m ? m[1] : null;
}

function requireApiKey(req, res, next) {
  const key = extractApiKey(req);
  if (!key || key !== SERVER_API_KEY) {
    return res.status(401).json({ error: "Invalid API key" });
  }
  next();
}

// GET /v1/models — 返回模型列表
app.get("/v1/models", requireApiKey, (_req, res) => {
  const data = MODELS.map((m) => ({
    id: m.id,
    object: "model",
    owned_by: m.provider || "asuka",
  }));
  res.json({ object: "list", data });
});

// POST /v1/chat/completions — OpenAI 兼容的越狱代理
app.post("/v1/chat/completions", requireApiKey, async (req, res) => {
  const payload = req.body || {};
  const requestedModel = payload?.model;
  const model = isAllowedModel(requestedModel) ? requestedModel : DEFAULT_MODEL;
  const meta = getModelMeta(model);
  const provider = meta?.provider || "deepseek";

  let apiKey, baseURL;
  if (provider === "openai") {
    apiKey = process.env.OPENAI_API_KEY;
    baseURL = "https://api.openai.com/v1";
  } else {
    apiKey = process.env.DEEPSEEK_API_KEY;
    baseURL = "https://api.deepseek.com/v1";
  }

  if (!apiKey) {
    return res.status(500).json({ error: `Missing API key for provider: ${provider}` });
  }

  const client = new OpenAI({ apiKey, baseURL });

  // 注入通用越狱提示词（角色无关，保留 ST 传来的角色定义）
  const upstreamMessages = [];
  upstreamMessages.push({
    role: "system",
    content: UNIVERSAL_PROMPT,
  });

  const messages = Array.isArray(payload?.messages) ? payload.messages : [];
  for (const msg of messages) {
    if (!msg || typeof msg !== "object") continue;
    if (msg.role !== "user" && msg.role !== "assistant" && msg.role !== "system") continue;
    upstreamMessages.push({
      role: msg.role,
      content: typeof msg.content === "string" ? msg.content : "",
    });
  }

  const isStream = payload?.stream === true;

  try {
    if (isStream) {
      const stream = await client.chat.completions.create({
        model,
        messages: upstreamMessages,
        stream: true,
        stream_options: { include_usage: true },
      });

      res.setHeader("Content-Type", "text/event-stream; charset=utf-8");
      res.setHeader("Cache-Control", "no-cache, no-transform");
      res.setHeader("Connection", "keep-alive");

      for await (const chunk of stream) {
        res.write(`data: ${JSON.stringify(chunk)}\n\n`);
      }
      res.write("data: [DONE]\n\n");
      res.end();
    } else {
      const result = await client.chat.completions.create({
        model,
        messages: upstreamMessages,
      });
      res.json(result);
    }
  } catch (err) {
    console.error("Upstream error:", err);
    if (!res.headersSent) {
      res.status(502).json({ error: `Upstream error: ${err.message}` });
    } else {
      res.end();
    }
  }
});

app.listen(PORT, () => {
  console.log(`Asuka AI running at http://localhost:${PORT}`);
  console.log(`OpenAI-compatible endpoint: http://localhost:${PORT}/v1/chat/completions`);
});
