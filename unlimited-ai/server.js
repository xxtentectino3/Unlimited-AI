// server.js - Local desktop server for 酱味大鸡
// Run: node server.js        → proxies API to Cloudflare Worker
// Run: node server.js direct → calls NVIDIA API directly (needs NVIDIA_API_KEY in .env)
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { exec } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = 8000;
const PUBLIC_DIR = path.join(__dirname, 'public');

// Load .env if exists
const envPath = path.join(__dirname, '.env');
if (fs.existsSync(envPath)) {
  const lines = fs.readFileSync(envPath, 'utf8').split('\n');
  for (const line of lines) {
    const m = line.match(/^\s*([^#=]+?)\s*=\s*(.+?)\s*$/);
    if (m) process.env[m[1]] = m[2];
  }
}

const WORKER_URL = process.env.WORKER_URL || '';
const NVIDIA_API_KEY = process.env.NVIDIA_API_KEY || '';
const USE_DIRECT = process.argv.includes('direct') && NVIDIA_API_KEY;

// Load builtin config from src/config.js
let BUILTIN_CONFIG = null;
try {
  const configPath = path.join(__dirname, 'src', 'config.js');
  const configRaw = fs.readFileSync(configPath, 'utf8');
  // Extract values using regex (ES module → plain values)
  const extract = (name) => {
    const re = new RegExp(`export const ${name}\\s*=\\s*(.+?);`, 's');
    const m = configRaw.match(re);
    if (!m) return null;
    try { return eval(`(${m[1]})`); } catch { return m[1]; }
  };
  BUILTIN_CONFIG = {
    MODELS: extract('MODELS'),
    DEFAULT_MODEL: extract('DEFAULT_MODEL'),
    PROMPT_1: extract('PROMPT_1'),
    PROMPT_2: extract('PROMPT_2'),
    PROMPT_3: extract('PROMPT_3'),
    CHAT_PASSWORD: extract('CHAT_PASSWORD'),
  };
} catch { BUILTIN_CONFIG = null; }

// MIME types
const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
};

function serveStatic(filePath) {
  try {
    const data = fs.readFileSync(filePath);
    const ext = path.extname(filePath);
    return { data, contentType: MIME[ext] || 'application/octet-stream' };
  } catch { return null; }
}

function isAllowedModel(modelId) {
  return (BUILTIN_CONFIG?.MODELS || []).some(m => m.id === modelId);
}

function builtinPromptForModel(modelId) {
  const models = BUILTIN_CONFIG?.MODELS || [];
  const meta = models.find(m => m.id === modelId);
  const persona = meta?.persona ?? 1;
  if (persona === 3) return BUILTIN_CONFIG?.PROMPT_3 || '';
  if (persona === 2) return BUILTIN_CONFIG?.PROMPT_2 || '';
  return BUILTIN_CONFIG?.PROMPT_1 || '';
}

function buildConfigJs() {
  const models = (BUILTIN_CONFIG?.MODELS || []).map(m => ({ id: m.id, label: m.label }));
  return `window.APP_MODELS = ${JSON.stringify(models, null, 2)};
window.APP_DEFAULT_MODEL = ${JSON.stringify(BUILTIN_CONFIG?.DEFAULT_MODEL || '')};
window.APP_PASSWORD = ${JSON.stringify(BUILTIN_CONFIG?.CHAT_PASSWORD || '123456')};
`;
}

async function handleDirectChat(payload, res) {
  const model = isAllowedModel(payload?.model) ? payload.model : (BUILTIN_CONFIG?.DEFAULT_MODEL);

  const useBuiltin = payload?.use_builtin_persona !== false;
  const customPrompt = (typeof payload?.custom_system_prompt === 'string') ? payload.custom_system_prompt.trim() : '';
  const worldBookCtx = (typeof payload?.world_book_context === 'string') ? payload.world_book_context.trim() : '';
  const messages = Array.isArray(payload?.messages) ? payload.messages : [];

  let systemContent = '';
  if (useBuiltin) {
    systemContent = builtinPromptForModel(model);
  } else if (customPrompt) {
    systemContent = customPrompt;
  }
  if (worldBookCtx) {
    systemContent = systemContent ? `${systemContent}\n\n[World Context]\n${worldBookCtx}` : `[World Context]\n${worldBookCtx}`;
  }

  const upstreamMessages = [];
  if (systemContent) upstreamMessages.push({ role: 'system', content: systemContent });
  for (const msg of messages) {
    if (!msg || (msg.role !== 'user' && msg.role !== 'assistant')) continue;
    upstreamMessages.push({ role: msg.role, content: typeof msg.content === 'string' ? msg.content : '' });
  }

  const upstreamBody = {
    model, stream: true, stream_options: { include_usage: true }, messages: upstreamMessages,
  };
  if (typeof payload?.temperature === 'number') upstreamBody.temperature = payload.temperature;
  if (typeof payload?.top_p === 'number') upstreamBody.top_p = payload.top_p;
  if (typeof payload?.max_tokens === 'number') upstreamBody.max_tokens = payload.max_tokens;
  if (typeof payload?.frequency_penalty === 'number') upstreamBody.frequency_penalty = payload.frequency_penalty;
  if (typeof payload?.presence_penalty === 'number') upstreamBody.presence_penalty = payload.presence_penalty;

  const upstream = await fetch('https://integrate.api.nvidia.com/v1/chat/completions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${NVIDIA_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(upstreamBody),
  });

  if (!upstream.ok) {
    const errText = await upstream.text().catch(() => '');
    res.writeHead(502);
    res.end(`NVIDIA API error ${upstream.status}: ${errText}`);
    return;
  }

  res.writeHead(200, {
    'Content-Type': 'text/event-stream; charset=utf-8',
    'Cache-Control': 'no-cache, no-transform',
    'Connection': 'keep-alive',
  });

  const reader = upstream.body.getReader();
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    res.write(value);
  }
  res.end();
}

async function proxyChat(payload, res) {
  if (!WORKER_URL) {
    res.writeHead(500);
    res.end('未配置 WORKER_URL。请在 .env 中设置 WORKER_URL=你的worker地址，或使用 node server.js direct 模式。');
    return;
  }
  try {
    const upstream = await fetch(`${WORKER_URL}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    res.writeHead(upstream.status, {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    });
    const reader = upstream.body.getReader();
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      res.write(value);
    }
    res.end();
  } catch (err) {
    res.writeHead(502);
    res.end(`Worker 连接失败: ${err.message}`);
  }
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);

  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  // /api/chat
  if (req.method === 'POST' && url.pathname === '/api/chat') {
    const chunks = [];
    req.on('data', c => chunks.push(c));
    req.on('end', async () => {
      try {
        const payload = JSON.parse(Buffer.concat(chunks).toString());
        if (USE_DIRECT) {
          await handleDirectChat(payload, res);
        } else {
          await proxyChat(payload, res);
        }
      } catch (err) {
        res.writeHead(400);
        res.end(`Bad request: ${err.message}`);
      }
    });
    return;
  }

  // /config.js
  if (url.pathname === '/config.js') {
    if (!USE_DIRECT && WORKER_URL) {
      try {
        const upstream = await fetch(`${WORKER_URL}/config.js`);
        if (upstream.ok) {
          res.writeHead(200, { 'Content-Type': 'text/javascript; charset=utf-8' });
          res.end(await upstream.text());
          return;
        }
      } catch {}
    }
    res.writeHead(200, { 'Content-Type': 'text/javascript; charset=utf-8' });
    res.end(buildConfigJs());
    return;
  }

  // Static files
  let filePath = url.pathname === '/' ? '/index.html' : url.pathname;
  let fullPath = path.join(PUBLIC_DIR, filePath);
  if (!fullPath.startsWith(PUBLIC_DIR)) {
    res.writeHead(403); res.end('Forbidden'); return;
  }
  const served = serveStatic(fullPath);
  if (served) {
    res.writeHead(200, { 'Content-Type': served.contentType });
    res.end(served.data);
  } else {
    const index = serveStatic(path.join(PUBLIC_DIR, 'index.html'));
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(index.data);
  }
});

server.listen(PORT, () => {
  const url = `http://localhost:${PORT}`;
  const mode = USE_DIRECT ? '直连 NVIDIA API (direct)' : (WORKER_URL ? `代理 → ${WORKER_URL}` : '⚠ WORKER_URL 未配置，API 不可用');
  console.log(`\n  酱味大鸡 已启动！`);
  console.log(`  地址: ${url}`);
  console.log(`  模式: ${mode}\n`);

  if (!USE_DIRECT && !WORKER_URL) {
    console.log('  配置方式:');
    console.log('    1) 在 .env 中设置 WORKER_URL=你的workers地址');
    console.log('    2) 在 .env 中设置 NVIDIA_API_KEY=你的key，然后用 node server.js direct 启动\n');
  }

  const cmd = process.platform === 'win32'
    ? `start "" "${url}"` : process.platform === 'darwin'
    ? `open "${url}"` : `xdg-open "${url}"`;
  exec(cmd, () => {});
});
