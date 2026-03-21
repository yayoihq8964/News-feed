# MacroLens — 宏观新闻情绪分析平台

> AI-powered macro news sentiment analysis dashboard

## ✨ Features

- **News Feed** — 聚合多源金融新闻，配图展示，AI 情绪分析标签
- **Sentiment Dashboard** — Fear & Greed 指数、行业情绪分布、市场脉搏
- **Deep Analysis** — 单篇新闻 AI 深度分析，影响股票/行业/大宗商品拆解
- **Dark/Light Mode** — Material Design 3 色彩系统，自动/手动切换
- **Responsive** — 桌面三栏布局 + 手机底部导航适配
- **News Images** — 自动抓取新闻配图（NewsAPI/GNews/Finnhub）
- **Social Sentiment Estimation** — 通过 Grok LLM 估算散户情绪（非实时社交数据）

## 🎨 Design System

- **Typography**: Manrope (headlines) + Inter (body)
- **Colors**: Material Design 3 tokens with violet primary (#6a1cf6)
- **Glass effects**: backdrop-blur surfaces
- **Icons**: Material Symbols Outlined

## 📦 Tech Stack

| Layer | Tech |
|-------|------|
| Frontend | React 18 + TypeScript + Vite + Tailwind CSS |
| Backend | Python FastAPI + SQLite |
| Analysis | OpenAI / Anthropic / Grok / Ollama |
| News Sources | Finnhub, NewsAPI, GNews |
| Deploy | Docker Compose |

## 🔑 API Keys

| Service | URL | Free Tier |
|---------|-----|-----------|
| Finnhub | https://finnhub.io | 60次/分 |
| NewsAPI | https://newsapi.org | 100次/天 |
| GNews | https://gnews.io | 100次/天 |
| OpenAI | https://platform.openai.com | 按量付费 |
| Anthropic | https://console.anthropic.com | 按量付费 |
| xAI (Grok) | https://console.x.ai | 按量付费 |

## 🏗️ Architecture

```
┌────────────────────────────────────────────────────┐
│              Frontend (React + Vite)                │
│           http://localhost:3000                      │
│  ┌──────────┐  ┌───────────────┐  ┌──────────────┐ │
│  │ News Feed │  │   Sentiment   │  │ Deep Analysis│ │
│  │  + Images │  │  Dashboard    │  │   + AI Score │ │
│  └──────────┘  └───────────────┘  └──────────────┘ │
├────────────────────────────────────────────────────┤
│              Backend (FastAPI)                       │
│           http://localhost:8000                      │
│  ┌──────────┐ ┌──────────┐ ┌──────────────────────┐│
│  │ 新闻聚合  │ │ LLM分析  │ │   X情绪监控          ││
│  │ Finnhub  │ │ OpenAI   │ │   Grok API           ││
│  │ NewsAPI  │ │ Claude   │ │                      ││
│  │ GNews    │ │ Grok     │ │                      ││
│  │          │ │ Ollama   │ │                      ││
│  └──────────┘ └──────────┘ └──────────────────────┘│
│  ┌────────────────────────────────────────────────┐│
│  │              SQLite Database                    ││
│  └────────────────────────────────────────────────┘│
└────────────────────────────────────────────────────┘
```

## 🚀 Quick Start

### Docker
```bash
cp .env.example .env
# Fill in your API keys
docker-compose up -d
```

### Local Development

**Backend:**
```bash
# Run from project root (so .env is found automatically)
pip install -r backend/requirements.txt
cd backend && uvicorn app.main:app --reload --port 8000
```

**Frontend:**
```bash
cd frontend
npm install
npm run dev
```

## 📱 Pages

| Route | Page | Description |
|-------|------|-------------|
| `/` | News Feed | Main news timeline with images & sentiment |
| `/sentiment` | Sentiment Dashboard | Fear/Greed index, sector breakdown |
| `/analysis/:id?` | Deep Analysis | AI-powered news deep dive |

## 📝 License

MIT
