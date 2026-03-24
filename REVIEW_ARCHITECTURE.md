# MacroLens 架构分析报告

> 审查日期：2025-07  
> 审查范围：后端 FastAPI 服务、前端 React 应用、Docker 部署、LLM Provider 抽象层、数据流管线  
> 审查方法：源码静态分析 + 架构模式对比

---

## 目录

1. [执行摘要](#1-执行摘要)
2. [整体架构评估](#2-整体架构评估)
3. [数据流分析](#3-数据流分析)
4. [LLM Provider 抽象层设计评估](#4-llm-provider-抽象层设计评估)
5. [可扩展性分析](#5-可扩展性分析)
6. [技术债务识别](#6-技术债务识别)
7. [与业界最佳实践对比](#7-与业界最佳实践对比)
8. [风险矩阵](#8-风险矩阵)
9. [改进路线图建议](#9-改进路线图建议)

---

## 1. 执行摘要

MacroLens 是一个宏观新闻情绪分析平台，采用 **FastAPI + React + SQLite + Docker Compose** 的技术栈，聚合 6 个新闻源的金融资讯，通过 4 种 LLM Provider（OpenAI / Anthropic / Grok / Ollama）进行情绪分析，并通过 Grok 估算散户社交情绪。

### 总体评级：⭐⭐⭐☆☆ （3/5 — 合格的 MVP，存在明确的架构升级路径）

**核心优势：**
- 多数据源聚合设计合理，`asyncio.gather` 并发拉取，容错降级
- LLM Provider 抽象层清晰，策略模式 + 工厂方法
- 调度系统（APScheduler）支持运行时参数覆盖
- 去重逻辑基于 SHA256 content hash，有效防止重复分析

**核心风险：**
- SQLite 单文件数据库无法支撑生产级并发
- 数据库连接管理未使用连接池，存在连接泄漏风险
- LLM 调用无速率限制、无成本控制、无断路器
- 无身份认证和 API 鉴权
- 前端未使用状态管理方案，可能导致数据一致性问题

---

## 2. 整体架构评估

### 2.1 技术选型评价

| 层级 | 选型 | 评价 | 合理性 |
|------|------|------|--------|
| 后端框架 | FastAPI | 异步原生、OpenAPI 自动文档、Pydantic 类型校验 | ✅ 非常合理 |
| 前端框架 | React 18 + TypeScript + Vite + Tailwind | 现代化前端栈，类型安全 | ✅ 非常合理 |
| 数据库 | SQLite + aiosqlite | 轻量、零运维，但并发和可靠性受限 | ⚠️ 仅适合 MVP/个人使用 |
| 调度器 | APScheduler | 轻量级进程内调度，适合单实例 | ✅ 合理 |
| HTTP 客户端 | httpx | 异步优先、与 FastAPI 生态一致 | ✅ 合理 |
| 部署 | Docker Compose | 单机部署简洁，双容器前后端分离 | ✅ 合理 |
| 配置管理 | pydantic-settings + .env | 环境变量 + 文件双源，有 DB 运行时覆盖 | ✅ 合理 |

### 2.2 架构模式分析

项目采用 **分层架构**（Layered Architecture）：

```
┌─────────────────────────────────────────────────────┐
│  Presentation Layer   │  React SPA (4 pages)        │
├─────────────────────────────────────────────────────┤
│  API Layer            │  FastAPI Routers (6个)       │
│                       │  news / analysis / quotes    │
│                       │  x_sentiment / settings      │
│                       │  calendar                    │
├─────────────────────────────────────────────────────┤
│  Service Layer        │  news_aggregator             │
│                       │  llm_analyzer                │
│                       │  grok_x_monitor              │
│                       │  calendar_analyzer            │
│                       │  6 × news_client             │
│                       │  4 × llm_provider            │
├─────────────────────────────────────────────────────┤
│  Data Access Layer    │  database.py (Raw SQL)       │
├─────────────────────────────────────────────────────┤
│  Infrastructure       │  SQLite / APScheduler        │
│                       │  Docker Compose              │
└─────────────────────────────────────────────────────┘
```

**评价：**
- ✅ 分层清晰，职责划分合理
- ✅ Router → Service → Data Access 的依赖方向正确
- ⚠️ Service 层偏「胖」，database.py 承担了 DAO + 部分业务逻辑（如 `skip_old_news`、pinned 排序）
- ⚠️ 缺少明确的 Domain Model 层，Pydantic Schema 与数据库 Schema 混用

### 2.3 前端架构评估

```
src/
├── App.tsx                    # 路由定义
├── main.tsx                   # 入口
├── components/
│   ├── layout/                # Layout / Header / Sidebar / MobileNav
│   ├── news/                  # NewsFeed / NewsCard / NewsImage
│   ├── sentiment/             # SentimentDashboard / FearGreedGauge / SectorCard
│   ├── analysis/              # DeepAnalysis
│   ├── markets/               # Markets
│   └── common/                # LoadingSpinner / SentimentChip
```

**评价：**
- ✅ 按功能域组织组件，结构清晰
- ✅ TypeScript 提供类型安全
- ✅ 4 个路由页面（Markets / News / Sentiment / Analysis）对应 4 个核心功能
- ⚠️ 无全局状态管理（无 Redux / Zustand / React Query）
- ⚠️ 无 API 层抽象（推测各组件内直接 fetch）
- ⚠️ 无 Error Boundary 组件

---

## 3. 数据流分析

### 3.1 完整数据流管线

```
                          ┌─────────────────────┐
                          │    APScheduler       │
                          │  (3 个定时任务)       │
                          └──────┬──────────────┘
                                 │
            ┌────────────────────┼────────────────────┐
            │                    │                     │
            ▼                    ▼                     ▼
   ┌────────────────┐  ┌────────────────┐   ┌──────────────────┐
   │ _job_fetch_news │  │ _job_analyze   │   │ _job_x_sentiment │
   │  (60s 间隔)     │  │  (60s 间隔)    │   │  (1800s 间隔)    │
   └───────┬────────┘  └───────┬────────┘   └────────┬─────────┘
           │                   │                     │
           ▼                   ▼                     ▼
  ┌─────────────────┐  ┌────────────────┐   ┌───────────────────┐
  │ aggregate_all   │  │ run_analysis   │   │ run_x_sentiment   │
  │ _news()         │  │ _batch()       │   │ _analysis()       │
  └───────┬─────────┘  └──────┬─────────┘   └────────┬──────────┘
          │                   │                      │
          ▼                   ▼                      ▼
  ┌─── 6 源并发采集 ──┐ ┌── LLM 分析 ──────┐  ┌── Grok API ────────┐
  │ Finnhub          │ │ 获取未分析新闻     │  │ 估算散户情绪        │
  │ NewsAPI          │ │ claim → analyze   │  │ JSON 解析存储       │
  │ GNews            │ │ → store / fail    │  └──────────┬─────────┘
  │ Massive          │ └──────┬──────────-─┘             │
  │ Google News      │        │                          │
  │ SeekingAlpha     │        ▼                          ▼
  └───────┬──────────┘  ┌──────────┐           ┌──────────────────┐
          │             │ analyses │           │ x_sentiments     │
          ▼             │ (table)  │           │ (table)          │
  ┌──────────────┐      └──────────┘           └──────────────────┘
  │ Dedup + Store│
  │ (SHA256 hash)│      ┌──────────────────────────────────────────┐
  └──────┬───────┘      │               React Frontend             │
         │              │  GET /api/news → 新闻列表 + 内联分析     │
         ▼              │  GET /api/analysis → 分析统计/详情        │
  ┌──────────────┐      │  GET /api/x-sentiment → 散户情绪仪表盘   │
  │ news_items   │      │  GET /api/quotes → 行情数据              │
  │ (table)      │      │  GET /api/calendar → 财经日历            │
  └──────────────┘      └──────────────────────────────────────────┘
```

### 3.2 数据流各环节评估

| 环节 | 实现方式 | 评价 | 问题 |
|------|----------|------|------|
| **新闻采集** | `asyncio.gather` 6 源并发，`return_exceptions=True` | ✅ 并发 + 容错 | 无重试机制、无限流控 |
| **去重** | SHA256(normalized_title) 作为 UNIQUE 约束 | ✅ 有效 | 仅基于标题，相同内容不同标题会重复 |
| **存储** | `INSERT INTO ... VALUES` 逐条插入 | ⚠️ 功能正确但效率低 | 应使用批量 INSERT |
| **分析调度** | claim → process → complete/fail 状态机 | ✅ 设计良好 | 最大重试 3 次，合理 |
| **LLM 调用** | 同步逐条分析，每批最多 10 条 | ⚠️ 低效 | 无并发分析、无 token 预算控制 |
| **结果解析** | 强制 JSON Schema + 中文输出 | ✅ 结构化输出 | 无 Schema 验证（仅 dict.get） |
| **前端展示** | REST API 分页查询 | ✅ 标准实现 | 无 WebSocket 实时推送 |

### 3.3 分析状态机

```
pending → processing → completed
   │           │
   │           ▼
   │        failed (attempts >= 3)
   │           │
   └───────────┘ (attempts < 3 → 回退 pending)
```

**评价：** 状态机设计合理，有乐观锁（`WHERE analysis_status IN ('pending', 'failed')`），防止并发重复分析。`skip_old_news` 策略将超出 top-50 窗口的旧闻标记为 `skipped`，节省 LLM Token 成本，是一个**有意识的成本控制决策**。

---

## 4. LLM Provider 抽象层设计评估

### 4.1 类层次结构

```
BaseLLMProvider (ABC)
├── OpenAIProvider      (OpenAI-compatible API)
├── AnthropicProvider   (Anthropic Messages API)
├── GrokProvider        (xAI OpenAI-compatible API)
└── OllamaProvider      (Ollama local API)
```

### 4.2 接口设计

```python
class BaseLLMProvider(ABC):
    @abstractmethod
    async def analyze(self, prompt: str, system_prompt: str = "") -> str: ...

    @abstractmethod
    async def is_available(self) -> bool: ...
```

**评价：**

| 方面 | 评分 | 说明 |
|------|------|------|
| 接口简洁性 | ⭐⭐⭐⭐⭐ | 只有 2 个方法，职责清晰 |
| 多态正确性 | ⭐⭐⭐⭐ | 策略模式 + 工厂方法（`_get_provider`），运行时切换 |
| 协议差异处理 | ⭐⭐⭐⭐ | Anthropic 用 Messages API、OpenAI/Grok 用 Chat Completions、Ollama 用本地 Chat |
| 容错设计 | ⭐⭐⭐ | Grok 有 system role 降级重试，但其他 Provider 无 |
| 缺失能力 | ⭐⭐ | 无 streaming、无 token 计数、无成本追踪、无断路器、无 fallback chain |

### 4.3 具体 Provider 实现分析

**OpenAI Provider:**
- ✅ 支持 `response_format: json_object`，确保 JSON 输出
- ✅ 支持自定义 `base_url`（兼容 OpenAI 代理/兼容 API）
- ⚠️ 每次请求创建新 `httpx.AsyncClient`，无连接复用

**Anthropic Provider:**
- ✅ 正确使用 Messages API（`x-api-key` / `anthropic-version` / `system` 字段）
- ⚠️ `is_available` 发送实际 API 请求（`max_tokens=1`），有成本
- ⚠️ 硬编码 `BASE_URL`，不支持代理

**Grok Provider:**
- ✅ 有 system role 降级逻辑（403/502 → 合并为 user message 重试）
- ✅ 有 `<think>...</think>` 标签清理（兼容推理模型）
- ⚠️ 降级逻辑与 Provider 耦合，应提升为通用中间件

**Ollama Provider:**
- ✅ 支持 `format: json` 强制 JSON 输出
- ✅ 有 `list_models()` 方法用于 UI 展示
- ✅ 无需 API Key

### 4.4 关键缺陷

1. **无 Fallback Chain：** 当主 Provider 失败时，不会自动尝试备选 Provider
2. **无速率限制：** 可能超出 API Rate Limit（特别是免费 Tier）
3. **无 Token/成本追踪：** 无法知晓单次分析的 Token 消耗和费用
4. **httpx.AsyncClient 未复用：** 每次 `analyze()` 创建新客户端，TCP 连接无法复用
5. **无 structured output 验证：** LLM 返回的 JSON 仅用 `dict.get()` 取值，无 Pydantic 验证

---

## 5. 可扩展性分析

### 5.1 水平扩展障碍

| 瓶颈 | 严重程度 | 说明 |
|------|----------|------|
| SQLite 单写者锁 | 🔴 高 | SQLite 使用文件锁，并发写入会阻塞/失败 |
| APScheduler 进程内调度 | 🔴 高 | 多实例部署会导致定时任务重复执行 |
| 无分布式锁 | 🟡 中 | `claim_news_for_analysis` 依赖 SQLite 行锁，无法跨进程 |
| 全局变量 `_last_error` | 🟡 中 | Grok X Monitor 的错误状态用全局变量存储，多 Worker 不共享 |
| DB 路径硬编码 | 🟡 中 | `DB_PATH = "data/macrolens.db"` 相对路径 |

### 5.2 垂直扩展能力

| 方面 | 当前状态 | 改进空间 |
|------|----------|----------|
| 新闻源扩展 | ✅ 良好 | 添加新 `*_client.py` + 注册到 aggregator 即可 |
| LLM Provider 扩展 | ✅ 良好 | 继承 `BaseLLMProvider` + 注册到工厂 |
| 分析维度扩展 | ⚠️ 一般 | System Prompt 硬编码，Schema 变更需改 DB |
| API 端点扩展 | ✅ 良好 | FastAPI Router 模块化，独立添加 |

### 5.3 功能扩展评估

**易扩展点（👍）：**
- 新增新闻源：实现 `fetch_xxx_news()` 函数 → 添加到 `aggregate_all_news` 的 `gather` 列表
- 新增 LLM Provider：继承 `BaseLLMProvider` → 添加到 `_get_provider` 工厂
- 新增 API 路由：创建新 Router → `app.include_router()`
- 新增前端页面：添加组件 → `App.tsx` 添加 Route

**难扩展点（👎）：**
- 修改分析 Schema：需同步修改 System Prompt / DB DDL / Pydantic Schema / 前端展示
- 添加用户系统：无认证框架，需从零搭建
- 从 SQLite 迁移到 PostgreSQL：Raw SQL 无 ORM 适配层，需逐一修改
- 实时推送：无 WebSocket 基础设施

---

## 6. 技术债务识别

### 6.1 高优先级（P0 — 生产阻塞）

| # | 债务项 | 位置 | 风险 | 建议修复 |
|---|--------|------|------|----------|
| 1 | **数据库连接未使用连接池** | `database.py: get_db()` | 高并发下连接泄漏 | 使用 `aiosqlite` 连接池或迁移到 SQLAlchemy async |
| 2 | **无 API 认证/鉴权** | `main.py` | 任何人可调用 API 修改设置 | 添加 API Key / JWT 认证中间件 |
| 3 | **API Key 明文存储在 DB** | `settings` 表 | 密钥泄露风险 | 加密存储敏感配置 |
| 4 | **CORS 允许所有源** | `main.py: _cors_origins` | 跨域攻击 | 生产环境限定白名单 |
| 5 | **无请求速率限制** | 全局 | DDoS / API 滥用 | 添加 slowapi 或 nginx 限流 |

### 6.2 中优先级（P1 — 稳定性风险）

| # | 债务项 | 位置 | 风险 | 建议修复 |
|---|--------|------|------|----------|
| 6 | **httpx.AsyncClient 未复用** | 所有 LLM Provider + News Client | TCP 连接浪费、性能降低 | 使用共享 Client 实例或 lifespan 管理 |
| 7 | **逐条 INSERT 新闻** | `news_aggregator.py` | 大量新闻时 I/O 密集 | 使用 `executemany` 批量插入 |
| 8 | **LLM JSON 响应无 Schema 验证** | `llm_analyzer.py` | LLM 返回畸形 JSON 静默失败 | 使用 Pydantic Model 验证 |
| 9 | **`datetime.utcnow()` 已弃用** | 多处 | Python 3.12+ DeprecationWarning | 使用 `datetime.now(timezone.utc)` |
| 10 | **SQL 注入风险（f-string SQL）** | `database.py: init_db()` | `ALTER TABLE {table} ADD COLUMN {col}` | 参数来源受控，风险低但应消除 |
| 11 | **无健康检查（LLM Provider）** | `scheduler.py` | LLM 不可用时持续浪费调用 | 启动时 `is_available()` 检查 + 周期性探活 |
| 12 | **`<think>` 标签清理重复** | `grok_provider.py` + `grok_x_monitor.py` | 逻辑重复 | 统一在 Provider 层处理 |

### 6.3 低优先级（P2 — 代码质量）

| # | 债务项 | 位置 | 说明 |
|---|--------|------|------|
| 13 | 无单元测试 | 全项目 | 无 `tests/` 目录 |
| 14 | 无日志结构化输出 | `logging.basicConfig` | 应使用 structlog / JSON 日志 |
| 15 | 前端无状态管理 | React 组件 | 各组件独立 fetch，无缓存层 |
| 16 | 前端无 API 层封装 | 组件内直接请求 | 应抽取 `api/` 层统一管理 |
| 17 | 无 Error Boundary | React | 组件崩溃会白屏 |
| 18 | `import asyncio` 在函数内部 | `news_aggregator.py: L35` | 应移到文件顶部 |
| 19 | Docker 无多阶段构建 | `docker-compose.yml` | 镜像可能偏大 |
| 20 | 无 `.dockerignore` 验证 | 根目录 | 可能打包不必要文件 |

---

## 7. 与业界最佳实践对比

### 7.1 后端架构对比

| 实践 | 业界标准 | MacroLens 现状 | 差距 |
|------|----------|----------------|------|
| **ORM / 数据访问** | SQLAlchemy / Tortoise ORM | 原生 SQL + aiosqlite | 🔴 无 ORM，迁移困难 |
| **依赖注入** | FastAPI Depends | 部分使用（Router 层） | 🟡 Service 层缺失 |
| **配置管理** | pydantic-settings + Vault | pydantic-settings + DB 覆盖 | 🟢 基本达标 |
| **错误处理** | 全局异常处理器 + 自定义异常 | try/except + logger.error | 🟡 缺少统一错误响应 |
| **API 版本化** | `/api/v1/xxx` | `/api/xxx` | 🟡 缺少版本控制 |
| **后台任务** | Celery / Dramatiq / ARQ | APScheduler（进程内） | 🟡 单实例足够，但不可扩展 |
| **数据库迁移** | Alembic | try-except ALTER TABLE | 🔴 非常脆弱 |
| **缓存** | Redis | 无 | 🔴 无缓存层 |
| **监控** | Prometheus + Grafana | 无 | 🔴 无可观测性 |
| **测试** | pytest + httpx.AsyncClient | 无 | 🔴 零测试覆盖 |

### 7.2 LLM 集成对比

| 实践 | 业界标准 | MacroLens 现状 | 差距 |
|------|----------|----------------|------|
| **SDK 选择** | 官方 SDK（openai / anthropic） | 裸 httpx 调用 | 🟡 可控但缺少 SDK 功能（自动重试/streaming） |
| **Structured Output** | JSON Mode + Pydantic 验证 | JSON Mode（部分）+ dict.get | 🟡 缺少验证层 |
| **Fallback / Retry** | LiteLLM / 自建 fallback chain | 无 | 🔴 单点故障 |
| **成本控制** | Token 预算 + 用量追踪 | `skip_old_news` 限制分析量 | 🟡 有基本控制，但无精细追踪 |
| **Prompt 管理** | Prompt 模板引擎 / 版本化 | 硬编码字符串常量 | 🟡 对于 MVP 可接受 |
| **缓存** | Semantic Cache（相似问题复用） | 无 | 🟡 情绪分析场景缓存意义有限 |

### 7.3 前端最佳实践对比

| 实践 | 业界标准 | MacroLens 现状 | 差距 |
|------|----------|----------------|------|
| **状态管理** | React Query / Zustand / Redux | 无（组件内 state） | 🟡 规模小可接受 |
| **API 封装** | axios 实例 + 拦截器 | 推测组件内 fetch | 🟡 应抽取 |
| **路由** | React Router v6 | ✅ 已使用 | 🟢 达标 |
| **UI 组件库** | shadcn/ui / MUI / Ant Design | Tailwind 手写 | 🟢 设计自主权强 |
| **错误边界** | ErrorBoundary + Fallback UI | 无 | 🔴 缺失 |
| **国际化** | i18n | 中英混排 | 🟡 非关键 |

### 7.4 DevOps 对比

| 实践 | 业界标准 | MacroLens 现状 | 差距 |
|------|----------|----------------|------|
| **CI/CD** | GitHub Actions / GitLab CI | 无 | 🔴 缺失 |
| **容器化** | Docker 多阶段构建 | Docker Compose 基础构建 | 🟡 可优化 |
| **健康检查** | Liveness + Readiness Probe | 仅 Backend healthcheck | 🟡 基本达标 |
| **日志聚合** | ELK / Loki | stdout | 🟡 单机足够 |
| **密钥管理** | Vault / AWS Secrets Manager | .env 文件 | 🟡 开发阶段可接受 |

---

## 8. 风险矩阵

| 风险 | 影响 | 概率 | 等级 | 缓解措施 |
|------|------|------|------|----------|
| SQLite 并发写入失败 | 数据丢失 | 高（多用户时） | 🔴 严重 | 迁移 PostgreSQL |
| LLM API Key 泄露 | 经济损失 | 中 | 🔴 严重 | 加密存储 + 访问控制 |
| LLM API 费用失控 | 经济损失 | 中 | 🟡 中等 | Token 预算 + 告警 |
| 新闻 API 配额耗尽 | 功能降级 | 高 | 🟡 中等 | 配额监控 + 缓存 |
| 单点故障（单容器） | 服务不可用 | 低 | 🟡 中等 | 容器重启策略（已有） |
| DB 文件损坏 | 数据全丢 | 低 | 🔴 严重 | 定期备份 |

---

## 9. 改进路线图建议

### Phase 1：稳定化（1-2 周）

- [ ] 添加 API 认证（FastAPI Security / API Key）
- [ ] httpx.AsyncClient 连接复用（使用 lifespan 管理共享实例）
- [ ] 添加 LLM 响应 Pydantic 验证
- [ ] 替换 `datetime.utcnow()` → `datetime.now(timezone.utc)`
- [ ] 添加基础单元测试（至少覆盖 dedup / Provider / aggregator）
- [ ] 前端添加 Error Boundary

### Phase 2：可靠性提升（2-4 周）

- [ ] 数据库迁移到 PostgreSQL + Alembic
- [ ] 引入 LLM Fallback Chain（主 → 备 Provider 自动切换）
- [ ] 添加 Redis 缓存层（新闻查询 / 分析结果）
- [ ] 前端引入 React Query（自动缓存 + 重试 + 乐观更新）
- [ ] 抽取前端 API 服务层
- [ ] 添加 LLM Token 用量追踪 + 成本仪表盘

### Phase 3：生产化（4-8 周）

- [ ] CI/CD Pipeline（Lint / Test / Build / Deploy）
- [ ] Prometheus + Grafana 监控
- [ ] 结构化日志（JSON 格式 + 日志聚合）
- [ ] API 版本化（`/api/v1/`）
- [ ] WebSocket 实时推送（新分析完成时通知前端）
- [ ] 后台任务迁移到 Celery/ARQ（支持多 Worker）

### Phase 4：高级功能（长期）

- [ ] 用户系统 + 个性化看板
- [ ] Prompt 版本管理 + A/B 测试
- [ ] 语义去重（基于 Embedding 相似度）
- [ ] 历史情绪趋势分析 + 回测
- [ ] 多语言支持

---

## 附录 A：文件依赖图

```
main.py
├── config.py (Settings)
├── models/database.py (init_db)
├── utils/scheduler.py (start/stop)
├── routers/
│   ├── news.py → services/news_aggregator.py
│   ├── analysis.py → services/llm_analyzer.py
│   ├── x_sentiment.py → services/grok_x_monitor.py
│   ├── settings.py → models/database.py
│   ├── calendar.py → services/calendar_client.py
│   └── quotes.py → (external API)

services/news_aggregator.py
├── services/finnhub_client.py
├── services/newsapi_client.py
├── services/gnews_client.py
├── services/massive_client.py
├── services/googlenews_client.py
├── services/seekingalpha_client.py
└── utils/dedup.py

services/llm_analyzer.py
└── services/llm_providers/
    ├── base.py (BaseLLMProvider)
    ├── openai_provider.py
    ├── anthropic_provider.py
    ├── grok_provider.py
    └── ollama_provider.py

services/grok_x_monitor.py
└── services/llm_providers/grok_provider.py
```

## 附录 B：数据库 Schema

```sql
-- 核心表
news_items    (id, source, title, summary, url, image_url, published_at, fetched_at, content_hash[UNIQUE], analysis_status, analysis_attempts, analysis_error)
analyses      (id, news_id[FK→UNIQUE], title_zh, headline_summary, overall_sentiment, classification, confidence, affected_stocks[JSON], affected_sectors[JSON], affected_commodities[JSON], logic_chain, key_factors[JSON], llm_provider, llm_model, analyzed_at)
x_sentiments  (id, query, trending_tickers[JSON], retail_sentiment_score, key_narratives[JSON], meme_stocks[JSON], raw_analysis, fear_greed_estimate, analyzed_at)
settings      (key[PK], value)
```

## 附录 C：配置优先级

```
DB settings (运行时覆盖)  >  .env 文件  >  代码默认值
```

这是一个有意识的三级覆盖机制（`_get_runtime_settings`），允许用户在前端 Settings 页面修改 LLM Provider/Model/API Key 等配置而无需重启服务。设计合理，但增加了调试复杂度。

---

*报告生成完毕。建议将此文档作为项目演进的基线参考，每个 Phase 完成后更新相应状态。*
