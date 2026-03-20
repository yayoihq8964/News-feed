# 🔭 MacroLens — 宏观新闻情绪分析平台

实时聚合多源财经新闻，利用大语言模型分析宏观经济事件对美股和贵金属的影响。

## ✨ 功能

- **多源新闻聚合** — Finnhub / NewsAPI / GNews 三大免费新闻源
- **LLM 智能分析** — 支持 OpenAI / Claude / Grok / Ollama，可自定义模型
- **情绪评分** — -100 到 +100 精准量化，含置信度
- **股票影响** — 自动识别受影响个股及影响逻辑
- **贵金属追踪** — 黄金、白银、铂金、钯金影响分析
- **X 情绪监控** — 通过 Grok API 监控散户情绪面和关注热点
- **逻辑链推理** — 展示从新闻事件到市场影响的完整推理链

## 🚀 快速开始

### 1. 配置环境变量

```bash
cp .env.example .env
# 编辑 .env 填入你的 API Keys
```

### 2. Docker 启动

```bash
docker-compose up -d
```

### 3. 访问

- 前端面板: http://localhost:3000
- 后端 API: http://localhost:8000
- API 文档: http://localhost:8000/docs

## 📦 API Keys 获取

| 服务 | 地址 | 免费额度 |
|------|------|----------|
| Finnhub | https://finnhub.io | 60次/分钟 |
| NewsAPI | https://newsapi.org | 100次/天 |
| GNews | https://gnews.io | 100次/天 |
| OpenAI | https://platform.openai.com | 按量付费 |
| Anthropic | https://console.anthropic.com | 按量付费 |
| xAI (Grok) | https://console.x.ai | 按量付费 |

## 🏗️ 架构

```
┌─────────────────────────────────────────────────┐
│                   Frontend (React)               │
│            http://localhost:3000                  │
├─────────────────────────────────────────────────┤
│                   Nginx Reverse Proxy            │
├─────────────────────────────────────────────────┤
│                   Backend (FastAPI)               │
│            http://localhost:8000                  │
│  ┌──────────┐ ┌──────────┐ ┌──────────────────┐ │
│  │ 新闻聚合  │ │ LLM分析  │ │   X情绪监控      │ │
│  │ Finnhub  │ │ OpenAI   │ │   Grok API       │ │
│  │ NewsAPI  │ │ Claude   │ │                  │ │
│  │ GNews    │ │ Grok     │ │                  │ │
│  │          │ │ Ollama   │ │                  │ │
│  └──────────┘ └──────────┘ └──────────────────┘ │
│  ┌──────────────────────────────────────────────┐│
│  │              SQLite Database                  ││
│  └──────────────────────────────────────────────┘│
└─────────────────────────────────────────────────┘
```

## 🔧 本地开发

### 后端
```bash
cd backend
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

### 前端
```bash
cd frontend
npm install
npm run dev
```

## 📋 环境变量说明

| 变量 | 必填 | 说明 |
|------|------|------|
| `FINNHUB_API_KEY` | 推荐 | Finnhub 新闻源 |
| `NEWSAPI_API_KEY` | 推荐 | NewsAPI 新闻源 |
| `GNEWS_API_KEY` | 推荐 | GNews 新闻源 |
| `DEFAULT_LLM_PROVIDER` | 是 | 默认 LLM: openai/anthropic/grok/ollama |
| `DEFAULT_LLM_MODEL` | 是 | 默认模型名 |
| `DEFAULT_LLM_API_KEY` | 是 | 默认 LLM 的 API Key |
| `GROK_API_KEY` | X监控用 | xAI Grok Key，用于 X 情绪分析 |
| `OLLAMA_BASE_URL` | Ollama用 | 默认 http://host.docker.internal:11434 |
| `NEWS_POLL_INTERVAL` | 否 | 新闻拉取间隔秒数，默认 120 |

## 📝 License

MIT
