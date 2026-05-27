# Unlimited AI

本地 AI 聊天服务，支持 DeepSeek 和 OpenAI 多模型，提供 Web 界面和 OpenAI 兼容 API。DeepSeek效果更好

## 功能

- **Web 聊天界面** — 密码保护的聊天 UI，支持多模型切换
- **OpenAI 兼容 API** (`/v1/chat/completions`) — 可接入 SillyTavern 等第三方前端
- **SSE 流式响应** — 实时 token 输出
- **CloudFlare Worker 版** — 可部署到 CloudFlare 边缘网络
- **内置角色提示词** — Asuka AI 角色预设

## 项目结构

```
├── unlimited-ai-local/   # 本地 Express 服务（主力开发）
│   ├── server.js         # Express 服务入口
│   ├── config.js         # 模型、提示词、密码配置
│   ├── public/           # Web 前端静态文件
│   └── tests/            # 测试
├── unlimited-ai/         # CloudFlare Worker 版
│   ├── server.js         # Worker 开发服务器
│   ├── src/worker.js     # Worker 入口
│   └── public/           # PWA 前端
└── docs/                 # 设计文档与规格
```

## 快速开始

### 本地版 (unlimited-ai-local)

```bash
cd unlimited-ai-local
npm install
cp .env.example .env    # 编辑 .env 填入 API Key
npm start
```

### CloudFlare Worker 版 (unlimited-ai)

```bash
cd unlimited-ai
npm install -g wrangler
wrangler login
wrangler secret put NVIDIA_API_KEY
wrangler deploy
```

## 环境变量

在 `.env` 文件中配置：

```env
DEEPSEEK_API_KEY=your_deepseek_api_key
OPENAI_API_KEY=your_openai_api_key
CHAT_PASSWORD=your_password
SERVER_API_KEY=sk-asuka-local-bridge
PORT=3000
```

## 密码

- **Web UI 默认访问密码**: `Qjz123456`（可通过 `.env` 的 `CHAT_PASSWORD` 修改）
- **API 默认密钥**: `sk-asuka-local-bridge`（可通过 `.env` 的 `SERVER_API_KEY` 修改）

## 接入 SillyTavern

1. SillyTavern 中添加 Chat Completion 源
2. API 地址填: `http://localhost:3000/v1/chat/completions`
3. API Key 填: `sk-asuka-local-bridge`（或你自定义的 `SERVER_API_KEY`）

## 技术栈

- Node.js / Express
- OpenAI SDK (DeepSeek & OpenAI 兼容)
- CloudFlare Workers
- SSE Streaming
- PWA (Worker 版)

## License

MIT
