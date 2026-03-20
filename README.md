# 🔭 MacroLens — 宏观新闻情绪分析平台

实时聚合多源财经新闻，利用大语言模型分析宏观经济事件对美股和贵金属的影响。

## ✨ 功能

- **多源新闻聚合** — Finnhub / NewsAPI / GNews 三大免费新闻源
- **LLM 智能分析** — 支持 OpenAI / Claude / Grok / Ollama，可自定义模型
- **AI 中文翻译** — 新闻标题和摘要自动翻译为中文
- **情绪评分** — -100 到 +100 精准量化，含置信度
- **股票影响** — 自动识别受影响个股及影响逻辑链
- **贵金属追踪** — 黄金、白银、铂金、钯金影响分析
- **X 情绪监控** — 通过 Grok API 监控散户情绪面和关注热点
- **宏观经济日历** — 全球主要经济体事件 + AI 利多利空分析
- **市场时钟** — 美股交易所时间 + 本地时间 + 开盘状态
- **重大新闻置顶** — 高影响力新闻自动置顶 4 小时
- **暗蓝主题** — 深色/浅色双主题，暗蓝色调护眼设计

## 🚀 快速开始

### 一键部署（推荐）

```bash
git clone https://github.com/yayoihq8964/News-feed.git
cd News-feed
chmod +x setup.sh
./setup.sh
```

脚本会引导你配置 API Keys，然后自动构建并启动 Docker 容器。

### 手动配置

```bash
cp .env.example .env
# 编辑 .env 填入你的 API Keys
docker-compose up -d
```

### 访问

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

## 📝 License

MIT
