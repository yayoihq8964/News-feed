# MacroLens 代码审查报告

审查日期：2026-03-22
项目路径：`/Users/admin/Downloads/新闻`
审查方式：静态代码审查 + 前端构建验证 + 后端语法检查

## 结论

当前项目整体结构清晰，前后端职责划分也比较直接：

- 后端：FastAPI + SQLite + 定时抓取/分析任务
- 前端：React + Vite + Tailwind
- 部署：Docker Compose

但我确认了 4 个比较明确的问题，其中 1 个会导致干净环境直接启动失败，2 个属于数据/兼容性风险，1 个属于产品层面的路由与文档不一致。

建议优先级：

1. 先修启动失败问题
2. 再补数据库迁移
3. 再统一时间处理
4. 最后修路由文案和 README

## Findings

### 1. High: 干净环境下后端可能直接启动失败

问题：

- `backend/app/main.py` 在启动时直接导入 `quotes` 路由
- `backend/app/routers/quotes.py` 顶层立即 `import yfinance as yf`
- 但 `backend/requirements.txt` 中没有 `yfinance`
- `backend/Dockerfile` 只安装 `requirements.txt` 里的依赖

结果：

- 在当前机器上如果全局环境恰好装过 `yfinance`，可能感觉“没问题”
- 但在新机器、Docker 容器、CI、Claude 新环境里，会直接因为缺依赖而启动失败
- 失败形式大概率是 `ModuleNotFoundError: No module named 'yfinance'`

证据：

- `backend/app/main.py:11-12`
- `backend/app/main.py:69`
- `backend/app/routers/quotes.py:5`
- `backend/requirements.txt:1-7`
- `backend/Dockerfile:3-4`

建议修复：

- 把 `yfinance` 加入 `backend/requirements.txt`
- 如果想进一步降低耦合，可以把 `yfinance` 的导入延迟到路由函数内部，避免整个应用因为一个可选行情接口启动失败

---

### 2. Medium: SQLite 迁移不完整，旧数据库升级有风险

问题：

当前 schema 已经依赖以下字段：

- `analyses.title_zh`
- `analyses.headline_summary`
- `x_sentiments.fear_greed_estimate`

但 `init_db()` 里只补了：

- `news_items.analysis_status`
- `news_items.analysis_attempts`
- `news_items.analysis_error`
- `analyses.title_zh`

没有补：

- `analyses.headline_summary`
- `x_sentiments.fear_greed_estimate`

结果：

- 你仓库当前自带的 `backend/data/macrolens.db` 已经有这些列，所以本地未必马上复现
- 但旧库升级时会出现兼容性问题
- 典型表现是：
  - 查询 `a.headline_summary` 时报错
  - 插入 `fear_greed_estimate` 时报错

证据：

- `backend/app/models/database.py:29-47`
- `backend/app/models/database.py:50-61`
- `backend/app/models/database.py:85-99`
- `backend/app/models/database.py:155-157`
- `backend/app/models/database.py:181-182`
- `backend/app/models/database.py:271-277`
- `backend/app/models/database.py:436-438`

补充说明：

- 我检查了当前仓库里的 `backend/data/macrolens.db`
- 这份库目前已经包含上述字段，所以问题是“迁移逻辑不完整”，不是“当前这份 DB 已损坏”

建议修复：

- 在 `init_db()` 中继续补齐缺失列的 `ALTER TABLE`
- 至少补：
  - `analyses.headline_summary TEXT DEFAULT ''`
  - `x_sentiments.fear_greed_estimate INTEGER DEFAULT 50`
- 最好把迁移逻辑整理成统一列表，避免以后继续漏字段

---

### 3. Medium: 时间处理不一致，前端会把部分 UTC 时间当成本地时间

问题链路：

- Finnhub 数据写库时使用的是无时区的 UTC ISO 字符串，例如 `2026-03-22T09:59:48`
- 前端原本想在“没有时区信息”时补 `Z`
- 但当前判断条件写成了：
  - 只要字符串里有 `T`，就不补 `Z`
- 结果是这类 UTC 时间会被浏览器按“本地时间”解释

这会影响：

- 新闻流中的相对时间
- 首页中的新闻时间
- 情绪页中的新闻时间

结果：

- 同一条新闻在不同时区浏览器里可能显示错误时间
- 你的环境是 `Asia/Tokyo`，用户常见目标又偏美国市场，这个误差会比较明显

证据：

- `backend/app/services/finnhub_client.py:19-24`
- `backend/app/services/news_aggregator.py:48`
- `frontend/src/components/news/NewsCard.tsx:9-27`
- `frontend/src/components/markets/Markets.tsx:115`
- `frontend/src/components/markets/Markets.tsx:167`
- `frontend/src/components/sentiment/SentimentDashboard.tsx:216`

建议修复：

- 后端统一输出带时区的 ISO 时间，最好直接输出 UTC `Z`
- 或者前端统一使用一个安全的时间解析函数，不要重复散落在多个组件里
- 判断逻辑应该是：
  - 已有 `Z` 或显式 offset 才按原样解析
  - 只有形如 `YYYY-MM-DDTHH:mm:ss` 时要补 `Z`

---

### 4. Low: 深度分析页导航与 README 描述不一致

问题：

- 现在 `/` 实际渲染的是 `Markets`
- 不是新闻流 `NewsFeed`
- 但深度分析页里多个“返回新闻”操作都跳回 `/`
- README 也仍然写 `/` 是 News Feed

结果：

- 用户点击“Back to News”实际回到的是市场总览，不是新闻流
- 文档和实现不一致，会增加后续维护和协作成本

证据：

- `frontend/src/App.tsx:12-15`
- `frontend/src/components/analysis/DeepAnalysis.tsx:92-96`
- `frontend/src/components/analysis/DeepAnalysis.tsx:125`
- `frontend/src/components/analysis/DeepAnalysis.tsx:433-437`
- `README.md:96-100`

建议修复：

- 如果产品设计上 `/` 就是市场总览：
  - 把分析页中的返回链接改到 `/news`
  - 把 breadcrumb 文案也改准确
  - 更新 README 路由说明
- 如果产品设计上 `/` 应该是新闻流：
  - 那就恢复 `App.tsx` 的首页路由

## 已完成验证

我实际做过的验证：

- 前端构建通过：`npm run build`
- 后端语法检查通过：`python3 -m compileall backend/app`
- 检查了项目自带 SQLite 文件的表结构

说明：

- 这次没有跑依赖真实 API key 的端到端流程
- 项目里也没有看到自己的测试文件

## 建议 Claude 直接执行的修复顺序

### 第一轮

- 给后端补上 `yfinance` 依赖
- 确保 Docker 干净环境能正常启动

### 第二轮

- 补齐 SQLite 缺失迁移
- 验证旧库兼容逻辑

### 第三轮

- 统一后端时间输出或前端时间解析
- 把所有时间显示点都改成同一套工具函数

### 第四轮

- 修正深度分析页返回路径
- 同步更新 README 路由说明

## 我建议 Claude 额外顺手检查的点

- `quotes` 路由是否应该作为可选功能降级，而不是阻塞整个后端启动
- 前端是否需要统一的 `formatDate/parseUtcDate` 工具，避免各组件各自处理
- `database.py` 中后续新增字段是否要改成集中式迁移清单
- 是否需要最基本的 smoke test，至少覆盖：
  - 后端能启动
  - `/health` 可访问
  - 前端能构建

