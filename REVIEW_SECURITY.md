# 🛡️ MacroLens 安全与代码质量审计报告

**审计日期**: 2026-03-24  
**审计范围**: backend/app/\*\*, frontend/src/\*\*, docker-compose.yml, nginx.conf, Dockerfile, requirements.txt, package.json, .env / .env.example  
**项目概要**: 基于 FastAPI + React + SQLite 的宏观新闻情绪分析平台，集成多个新闻 API 和 LLM 提供商

---

## 📊 执行摘要

**总体评级: 🟠 高风险 — 存在严重的密钥泄露与多个安全薄弱环节，需立即修复**

| 严重程度 | 数量 |
|---------|------|
| 🔴 CRITICAL | 3 |
| 🟠 HIGH | 6 |
| 🟡 MEDIUM | 8 |
| 🔵 LOW | 5 |
| **合计** | **22** |

---

## 🔴 CRITICAL 级发现

---

### **🔴 [C-01] .env 文件包含真实 API 密钥且未受 Git 追踪保护验证**

- 📍 位置: `/.env`
- 🔍 问题: `.env` 文件中存储了 **7 个真实的 API 密钥**，包括:
  - `FINNHUB_API_KEY=d6bddj1r01qnr27kido0d6bddj1r01qnr27kidog`
  - `NEWSAPI_API_KEY=0af107e2f4e24d84bbfa1327c8c027ba`
  - `GNEWS_API_KEY=6c02f800468a63ad594f0adc28b755a2`
  - `OPENAI_API_KEY=sk-0jVeGCmlF3ihJsubAJX7FVoPwccbBtHeAontcHJo1xX3Wcvz`
  - `DEFAULT_LLM_API_KEY=sk-0jVeGCmlF3ihJsubAJX7FVoPwccbBtHeAontcHJo1xX3Wcvz`
  - `GROK_API_KEY=owu114`
  - `MASSIVE_API_KEY=HA6xrOXgGlfGbCMIPvMSm_mdm2E4N5HH`
  
  虽然 `.gitignore` 已包含 `.env` 规则，但该文件存在于工作目录中，且项目如果被拷贝、压缩分享或上传到公共仓库，所有密钥将全部暴露。此外，`OPENAI_BASE_URL` 指向第三方代理 `https://api.openweb-ui.xyz/v1`，存在 API Key 中间人窃取风险。
- 💥 影响:
  - 所有 API 密钥泄露，攻击者可滥用付费 API 产生高额费用
  - OpenAI 代理端点可截获所有 API 请求和密钥
  - 新闻 API 配额被恶意耗尽
- ✅ 修复:
  1. **立即轮换 (rotate) 所有已暴露的 API 密钥**
  2. 确认 `.env` 从未被提交到 Git 历史中 (`git log --all -- .env`)
  3. 使用环境变量注入或密钥管理服务 (如 HashiCorp Vault、AWS Secrets Manager)
  4. 审计 `OPENAI_BASE_URL` 指向的第三方代理是否可信
  ```bash
  # 检查 .env 是否曾被提交
  git log --all --diff-filter=A -- .env
  # 如果有记录，需要清除 Git 历史
  git filter-branch --force --index-filter 'git rm --cached --ignore-unmatch .env' -- --all
  ```
- 📎 Ref: CWE-798 (硬编码凭证), CWE-312 (明文存储敏感信息)

---

### **🔴 [C-02] 所有 API 端点零认证 — 任何人均可访问全部功能**

- 📍 位置: `backend/app/routers/` 下所有路由文件 (news.py, analysis.py, settings.py, x_sentiment.py, calendar.py, quotes.py)
- 🔍 问题: **所有 13 个 API 端点均无任何认证或鉴权机制**。没有 API Key 验证、JWT token、OAuth、HTTP Basic Auth 或任何形式的访问控制。关键操作端点包括:
  - `PUT /api/settings` — 可修改所有系统配置，包括 API 密钥
  - `POST /api/analysis/trigger` — 可触发 LLM 分析（消耗付费 API 配额）
  - `POST /api/x-sentiment/refresh` — 可触发 Grok API 调用
  - `POST /api/news/fetch` — 可触发所有新闻源抓取
  - `GET /api/settings` — 可读取系统配置（包含脱敏后的密钥尾部 4 位）
- 💥 影响:
  - 任何人可通过 `PUT /api/settings` 更改 LLM 提供商和 API 密钥，将请求转发到恶意服务器
  - 攻击者可反复调用 `/api/analysis/trigger` 消耗 LLM API 配额，造成经济损失
  - 可通过 `GET /api/settings` 获取密钥部分信息
- ✅ 修复:
  ```python
  # backend/app/dependencies.py — 新建认证依赖
  from fastapi import Depends, HTTPException, Security
  from fastapi.security import APIKeyHeader
  
  API_KEY_HEADER = APIKeyHeader(name="X-API-Key")
  
  async def verify_api_key(api_key: str = Security(API_KEY_HEADER)):
      expected = os.environ.get("MACROLENS_API_KEY")
      if not expected or api_key != expected:
          raise HTTPException(status_code=403, detail="Invalid API key")
  
  # 在路由中使用:
  @router.put("", dependencies=[Depends(verify_api_key)])
  async def update_settings(body: SettingsUpdateRequest):
      ...
  ```
- 📎 Ref: CWE-306 (缺失关键功能的认证), CWE-862 (缺失授权)

---

### **🔴 [C-03] Settings API 暴露 API 密钥且无权限控制**

- 📍 位置: `backend/app/routers/settings.py:81-88` (GET /api/settings) 及 `settings.py:91-119` (PUT /api/settings)
- 🔍 问题:
  1. `GET /api/settings` 返回所有 API 密钥的脱敏值 (`****` + 最后4位字符)，泄露密钥结构和尾部信息
  2. `PUT /api/settings` 允许任何人 **无认证地修改** 所有系统设置，包括:
     - 所有 LLM API 密钥和端点
     - 所有新闻源 API 密钥
     - 调度间隔等系统参数
  3. 脱敏逻辑 (`_redact`) 仅隐藏前面部分，**最后 4 位字符仍暴露**
  4. 通过 PUT 写入的密钥以明文存储在 SQLite 数据库中
- 💥 影响:
  - 攻击者可将 `openai_base_url` 改为恶意服务器，截获所有后续 LLM 请求（含 API 密钥）
  - 攻击者可替换 API 密钥为自己的，窃取分析数据
  - 密钥最后 4 位泄露有助于暴力破解
  - SQLite 数据库文件被访问即暴露所有明文密钥
- ✅ 修复:
  1. 为 Settings API 添加强认证（见 C-02 修复方案）
  2. 对 GET 响应中的密钥完全脱敏 (仅返回 `"已配置" / "未配置"`)
  3. 对数据库中存储的密钥使用加密（如 Fernet 对称加密）
  ```python
  def _redact(key: str, value: Any) -> Any:
      if key in REDACT_KEYS and isinstance(value, str) and value:
          return "••••••••(已配置)"  # 不暴露任何部分
      return value
  ```
- 📎 Ref: CWE-200 (信息暴露), CWE-311 (缺失敏感数据加密)

---

## 🟠 HIGH 级发现

---

### **🟠 [H-01] CORS 配置默认允许所有来源 (allow_origins=["*"])**

- 📍 位置: `backend/app/main.py:51-61`
- 🔍 问题: 当 `CORS_ORIGINS` 环境变量为空（默认情况），`_cors_origins` 回退为 `["*"]`，即允许任何域名的跨域请求。同时 `allow_methods=["*"]` 和 `allow_headers=["*"]` 过于宽松。`.env.example` 中 `CORS_ORIGINS` 被注释掉，用户很可能不会配置。
- 💥 影响: 任何恶意网站可通过用户浏览器向 MacroLens API 发起跨域请求，执行 CSRF 攻击，窃取数据或触发 LLM 分析消耗配额
- ✅ 修复:
  ```python
  # main.py — 强制在生产环境设置 CORS
  _cors_origins = [o.strip() for o in app_settings.cors_origins.split(",") if o.strip()]
  if not _cors_origins:
      import os
      if os.getenv("ENV", "development") == "production":
          raise ValueError("CORS_ORIGINS must be set in production!")
      _cors_origins = ["http://localhost:3000"]  # 仅允许本地开发前端
  
  app.add_middleware(
      CORSMiddleware,
      allow_origins=_cors_origins,
      allow_credentials=True,
      allow_methods=["GET", "POST", "PUT"],  # 仅允许必需方法
      allow_headers=["Content-Type", "X-API-Key"],  # 仅允许必需头
  )
  ```
- 📎 Ref: CWE-942 (CORS 策略过于宽松)

---

### **🟠 [H-02] 数据库连接未使用连接池 — 资源泄漏风险**

- 📍 位置: `backend/app/models/database.py:72-75` (`get_db()` 函数)
- 🔍 问题: 每次调用 `get_db()` 都创建一个新的 `aiosqlite.connect()` 连接，并依赖调用方在 `finally` 块中手动关闭。这种模式存在问题:
  1. 无连接池 — 高并发下创建大量数据库连接
  2. 连接关闭完全依赖调用方 — 如果路由处理函数异常但未在 finally 中关闭，连接将泄漏
  3. 路由中的 try/finally 模式不够健壮，应使用 `async with` 或 FastAPI Depends
- 💥 影响: 高并发下数据库连接耗尽，导致服务不可用 (DoS)
- ✅ 修复:
  ```python
  # 使用 FastAPI Depends 管理连接生命周期
  async def get_db_dep():
      db = await aiosqlite.connect(DB_PATH)
      db.row_factory = aiosqlite.Row
      try:
          yield db
      finally:
          await db.close()
  
  # 路由中使用依赖注入
  @router.get("")
  async def list_news(db: aiosqlite.Connection = Depends(get_db_dep)):
      total, items = await get_news_items(db, ...)
      return {...}
  ```
- 📎 Ref: CWE-400 (资源消耗不受控制), CWE-404 (资源未正确释放)

---

### **🟠 [H-03] XML 解析未禁用外部实体 — XXE 攻击风险**

- 📍 位置: `backend/app/services/googlenews_client.py:79` 及 `backend/app/services/seekingalpha_client.py:72`
- 🔍 问题: 使用 `xml.etree.ElementTree.fromstring()` 解析外部 RSS 数据，未禁用外部实体 (External Entities)。虽然 `ElementTree` 默认不处理 DTD 中的外部实体引用（相比 lxml 安全性更高），但如果 RSS 源被劫持或恶意构造，仍存在风险。
- 💥 影响: 潜在的 XML 外部实体注入 (XXE)，可能导致服务器文件读取、SSRF
- ✅ 修复:
  ```python
  import defusedxml.ElementTree as ET  # 替换标准库
  # 或者明确禁用
  from xml.etree.ElementTree import XMLParser
  parser = XMLParser()
  parser.entity = {}  # 禁用实体
  tree = ET.fromstring(resp.text, parser=parser)
  ```
  同时在 `requirements.txt` 中添加: `defusedxml>=0.7.1`
- 📎 Ref: CWE-611 (XML 外部实体引用), 置信度: 中等 (ElementTree 默认较安全但仍推荐加固)

---

### **🟠 [H-04] Docker 容器以 root 用户运行**

- 📍 位置: `backend/Dockerfile` 及 `frontend/Dockerfile`
- 🔍 问题: 两个 Dockerfile 均未指定非 root 用户，容器默认以 root 身份运行所有进程
- 💥 影响: 容器逃逸漏洞时攻击者直接获得主机 root 权限
- ✅ 修复:
  ```dockerfile
  # backend/Dockerfile
  FROM python:3.12-slim
  RUN useradd --create-home --shell /bin/bash appuser
  WORKDIR /app
  COPY requirements.txt .
  RUN pip install --no-cache-dir -r requirements.txt
  COPY . .
  RUN mkdir -p data && chown -R appuser:appuser /app
  USER appuser
  EXPOSE 8000
  CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
  
  # frontend/Dockerfile
  FROM node:20-alpine AS build
  WORKDIR /app
  COPY package*.json ./
  RUN npm install
  COPY . .
  RUN npm run build
  
  FROM nginx:alpine
  RUN adduser -D -g '' nginxuser
  COPY --from=build /app/dist /usr/share/nginx/html
  COPY nginx.conf /etc/nginx/conf.d/default.conf
  USER nginxuser
  EXPOSE 80
  CMD ["nginx", "-g", "daemon off;"]
  ```
- 📎 Ref: CWE-250 (以不必要的权限执行)

---

### **🟠 [H-05] 未对用户可控的 POST 端点设置速率限制**

- 📍 位置: `backend/app/routers/analysis.py:86-90` (`POST /api/analysis/trigger`), `x_sentiment.py:28-32` (`POST /api/x-sentiment/refresh`), `news.py:45-49` (`POST /api/news/fetch`)
- 🔍 问题: 三个 POST 端点可触发消耗外部 API 配额的操作（LLM 分析、新闻抓取），但完全没有速率限制。攻击者可以发送大量请求:
  - `/api/analysis/trigger` — 每次消耗 LLM API token
  - `/api/x-sentiment/refresh` — 每次调用 Grok API
  - `/api/news/fetch` — 每次消耗 4 个新闻 API 的配额
- 💥 影响: 攻击者通过反复调用消耗付费 API 配额，造成经济损失；DoS 攻击导致服务不可用
- ✅ 修复:
  ```python
  # 安装: pip install slowapi
  from slowapi import Limiter
  from slowapi.util import get_remote_address
  
  limiter = Limiter(key_func=get_remote_address)
  
  @router.post("/trigger")
  @limiter.limit("5/minute")
  async def trigger_analysis(request: Request, ...):
      ...
  ```
  同时在 nginx.conf 中添加限流:
  ```nginx
  limit_req_zone $binary_remote_addr zone=api:10m rate=10r/s;
  location /api/ {
      limit_req zone=api burst=20 nodelay;
      proxy_pass http://backend:8000;
  }
  ```
- 📎 Ref: CWE-770 (无限制的资源分配)

---

### **🟠 [H-06] Finnhub API 密钥通过 URL 查询参数传输**

- 📍 位置: `backend/app/services/finnhub_client.py:51,71`
- 🔍 问题: Finnhub API 密钥作为 URL 查询参数 `token=api_key` 传输。URL 参数会被记录在:
  - Web 服务器访问日志
  - 代理服务器日志
  - 浏览器历史记录
  - CDN 日志
  - 网络监控设备
- 💥 影响: API 密钥通过日志或网络监控泄露
- ✅ 修复: 这是 Finnhub API 设计的限制（它要求通过查询参数传递 token）。缓解措施:
  1. 确保所有 HTTP 日志不记录查询参数
  2. 使用 Finnhub 支持的 Header 认证方式 (如果可用)
  3. 定期轮换 API 密钥
  ```python
  # Finnhub 也支持 Header 方式:
  response = await client.get(
      f"{BASE_URL}/news",
      params={"category": category},
      headers={"X-Finnhub-Token": api_key},
  )
  ```
- 📎 Ref: CWE-598 (通过 GET 请求查询字符串传递信息)

---

## 🟡 MEDIUM 级发现

---

### **🟡 [M-01] database.py 中使用 f-string 构建 SQL 语句（非用户输入但属反模式）**

- 📍 位置: `backend/app/models/database.py:96` (init_db 迁移), `database.py:144,152-166` (get_news_items)
- 🔍 问题: 
  1. 迁移代码 `db.execute(f"ALTER TABLE {table} ADD COLUMN {col} {definition}")` 使用 f-string 构建 DDL。虽然 `table`、`col`、`definition` 来自硬编码常量，不存在注入风险，但这是危险的反模式。
  2. `get_news_items` 中的 `f"SELECT COUNT(*) FROM news_items {where}"` 及后续查询使用 f-string 拼接 WHERE 子句。虽然 `where` 由代码生成而非直接来自用户输入，但这种模式容易在后续修改中引入漏洞。
- 💥 影响: 当前无直接注入风险，但代码维护中可能引入 SQL 注入漏洞
- ✅ 修复: 对 f-string 构建的 SQL 添加注释警告，或改用查询构建器
  ```python
  # 迁移建议: 使用白名单验证
  ALLOWED_TABLES = {"news_items", "analyses", "x_sentiments"}
  ALLOWED_COLS = {"analysis_status", "analysis_attempts", "analysis_error", ...}
  for table, col, definition in migrations:
      assert table in ALLOWED_TABLES, f"Invalid table: {table}"
      assert col in ALLOWED_COLS, f"Invalid column: {col}"
      await db.execute(f"ALTER TABLE {table} ADD COLUMN {col} {definition}")
  ```
- 📎 Ref: CWE-89 (SQL 注入 — 间接风险)

---

### **🟡 [M-02] 异常处理吞没错误 — 静默失败**

- 📍 位置: 
  - `backend/app/models/database.py:97-98` — `except Exception: pass`
  - `backend/app/services/finnhub_client.py:79-80` — `except Exception: pass`
  - `backend/app/utils/scheduler.py:57-58` — `except Exception: pass`
  - `backend/app/services/llm_providers/ollama_provider.py:55-56` — `except Exception: pass`
- 🔍 问题: 多处使用裸 `except Exception: pass` 或 `except Exception: break`，完全吞没异常，不记录任何错误信息。特别是数据库迁移中的 `pass` 可能隐藏了真正的错误（如磁盘空间不足、权限问题）。
- 💥 影响: 生产环境中故障难以排查，安全事件无法追踪
- ✅ 修复:
  ```python
  # 区分预期异常和意外异常
  try:
      await db.execute(f"ALTER TABLE {table} ADD COLUMN {col} {definition}")
  except Exception as e:
      if "duplicate column" in str(e).lower():
          pass  # 列已存在，预期行为
      else:
          logger.warning(f"Migration failed for {table}.{col}: {e}")
  ```
- 📎 Ref: CWE-391 (未检查的错误条件)

---

### **🟡 [M-03] nginx.conf 缺少安全响应头**

- 📍 位置: `frontend/nginx.conf`
- 🔍 问题: nginx 配置缺少关键安全响应头:
  - 无 `X-Content-Type-Options: nosniff`
  - 无 `X-Frame-Options: DENY`
  - 无 `Content-Security-Policy`
  - 无 `X-XSS-Protection`
  - 无 `Strict-Transport-Security` (HSTS)
  - 无 `Referrer-Policy`
  - 未隐藏 nginx 版本 (`server_tokens off`)
- 💥 影响: 点击劫持、MIME 嗅探攻击、XSS 攻击面增大
- ✅ 修复:
  ```nginx
  server {
      listen 80;
      server_tokens off;
      root /usr/share/nginx/html;
      index index.html;
  
      # 安全头
      add_header X-Content-Type-Options "nosniff" always;
      add_header X-Frame-Options "DENY" always;
      add_header X-XSS-Protection "1; mode=block" always;
      add_header Referrer-Policy "strict-origin-when-cross-origin" always;
      add_header Content-Security-Policy "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' https: data:; connect-src 'self' http://backend:8000" always;
  
      location / {
          try_files $uri $uri/ /index.html;
      }
  
      location /api/ {
          proxy_pass http://backend:8000;
          proxy_set_header Host $host;
          proxy_set_header X-Real-IP $remote_addr;
          proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
          proxy_set_header X-Forwarded-Proto $scheme;
          proxy_read_timeout 60s;
      }
  }
  ```
- 📎 Ref: CWE-1021 (不当的框架限制渲染), CWE-693 (保护机制失效)

---

### **🟡 [M-04] docker-compose.yml 直接暴露后端端口**

- 📍 位置: `docker-compose.yml:7`
- 🔍 问题: 后端服务映射 `ports: "8000:8000"` 将 FastAPI 直接暴露到主机网络。前端已通过 nginx 反向代理 `/api/` 到后端，因此后端不应该直接暴露。
- 💥 影响: 攻击者可绕过 nginx 直接访问后端 API，规避任何 nginx 层面的安全策略（如速率限制、安全头）
- ✅ 修复:
  ```yaml
  services:
    backend:
      build: ./backend
      container_name: macrolens-backend
      # 移除 ports 映射，仅通过 Docker 内部网络暴露
      expose:
        - "8000"
      volumes:
        - ./backend/data:/app/data
      env_file:
        - .env
      restart: unless-stopped
      networks:
        - internal
  
    frontend:
      build: ./frontend
      container_name: macrolens-frontend
      ports:
        - "3000:80"  # 仅前端暴露
      depends_on:
        - backend
      restart: unless-stopped
      networks:
        - internal
  
  networks:
    internal:
      driver: bridge
  ```
- 📎 Ref: CWE-668 (将资源暴露到错误的范围)

---

### **🟡 [M-05] OpenAI 请求通过不受信第三方代理**

- 📍 位置: `/.env` → `OPENAI_BASE_URL=https://api.openweb-ui.xyz/v1`
- 🔍 问题: 所有 OpenAI API 请求（包含 API Key 和用户数据）都被转发到第三方代理 `api.openweb-ui.xyz`。此代理可以:
  1. 记录并窃取 API 密钥
  2. 拦截和修改 LLM 响应
  3. 收集用户发送的所有新闻数据和分析请求
- 💥 影响: 中间人攻击、数据泄露、API 密钥被盗用
- ✅ 修复:
  ```env
  # 使用官方 API 端点
  OPENAI_BASE_URL=https://api.openai.com/v1
  ```
  如必须使用代理（如网络限制），应确认代理的安全性和可信度。
- 📎 Ref: CWE-300 (中间人攻击通道)

---

### **🟡 [M-06] 日志中可能打印敏感配置信息**

- 📍 位置: `backend/app/config.py:57-66` (`validate_config` 方法)
- 🔍 问题: 配置验证函数在警告日志中打印 API Key 的前 30 个字符:
  ```python
  f"GROK_API_KEY looks like a URL ('{self.grok_api_key[:30]}...')"
  ```
  如果配置错误（如 key 和 URL 互换），日志中会暴露密钥内容。
- 💥 影响: 密钥部分内容通过日志泄露
- ✅ 修复:
  ```python
  warnings.append(
      "GROK_API_KEY looks like a URL. Did you swap GROK_API_KEY and GROK_BASE_URL?"
  )  # 不要打印值的任何部分
  ```
- 📎 Ref: CWE-532 (将敏感信息写入日志)

---

### **🟡 [M-07] LLM 错误响应中打印原始内容到日志**

- 📍 位置: 
  - `backend/app/services/llm_analyzer.py:113` — `logger.error(f"...Raw: {raw_response[:500]}")`
  - `backend/app/services/grok_x_monitor.py:71` — `logger.error(f"...Raw: {raw[:500]}")`
  - `backend/app/services/calendar_analyzer.py:142` — `logger.error(f"...Raw: {raw_response[:500]}")`
- 🔍 问题: 当 LLM 返回非 JSON 内容时，将原始响应的前 500 字符打印到日志。LLM 响应可能包含用户输入的新闻标题、敏感分析内容或 LLM 的幻觉输出。
- 💥 影响: 日志中暴露潜在敏感信息
- ✅ 修复: 仅记录解析错误本身，不记录原始响应内容：
  ```python
  logger.error(f"Failed to parse LLM JSON for news_id={news_id}: {e}")
  # 原始响应仅在 DEBUG 级别记录
  logger.debug(f"Raw LLM response: {raw_response[:200]}")
  ```
- 📎 Ref: CWE-532 (将敏感信息写入日志)

---

### **🟡 [M-08] SQLite 数据库文件权限可能过于宽松**

- 📍 位置: `backend/app/models/database.py:10` — `DB_PATH = "data/macrolens.db"`; `docker-compose.yml:9` — `volumes: ./backend/data:/app/data`
- 🔍 问题: 
  1. SQLite 数据库以卷挂载方式持久化在主机 `./backend/data/` 目录
  2. 数据库中存储了通过 Settings API 写入的**明文 API 密钥**
  3. 没有对数据库文件设置限制性权限
- 💥 影响: 主机上的其他用户或进程可读取数据库文件，获取所有 API 密钥
- ✅ 修复:
  ```dockerfile
  # Dockerfile 中设置目录权限
  RUN mkdir -p data && chmod 700 data
  ```
  同时对存储在数据库中的密钥使用加密存储。
- 📎 Ref: CWE-276 (不正确的默认权限)

---

## 🔵 LOW 级发现

---

### **🔵 [L-01] 使用已弃用的 datetime.utcnow()**

- 📍 位置:
  - `backend/app/services/llm_analyzer.py:135`
  - `backend/app/services/grok_x_monitor.py:96`
  - `backend/app/services/news_aggregator.py:54`
  - `backend/app/services/finnhub_client.py:23,66`
- 🔍 问题: `datetime.utcnow()` 在 Python 3.12 中已弃用，因其返回不含时区信息的 datetime 对象，容易导致时区处理错误
- 💥 影响: 时间记录可能不准确，未来 Python 版本可能报错
- ✅ 修复: 使用 `datetime.now(timezone.utc)` 替代
  ```python
  from datetime import datetime, timezone
  analyzed_at = datetime.now(timezone.utc).isoformat()
  ```
- 📎 Ref: Python 3.12 弃用警告

---

### **🔵 [L-02] 前端 API 基础 URL 硬编码回退为空字符串**

- 📍 位置: `frontend/src/services/api.ts:12`
- 🔍 问题: `const BASE_URL = import.meta.env.VITE_API_BASE_URL || '';` 回退为空字符串。这在开发模式下通过 Vite 代理工作正常，但如果部署时忘记配置 `VITE_API_BASE_URL`，API 请求将发送到前端域名，可能被恶意拦截。
- 💥 影响: 部署配置错误时 API 请求可能发送到错误地址
- ✅ 修复:
  ```typescript
  const BASE_URL = import.meta.env.VITE_API_BASE_URL;
  if (!BASE_URL && import.meta.env.PROD) {
    console.warn('⚠️ VITE_API_BASE_URL not configured for production build');
  }
  ```
- 📎 Ref: CWE-16 (配置)

---

### **🔵 [L-03] docker-compose.yml 使用已弃用的 version 字段**

- 📍 位置: `docker-compose.yml:1`
- 🔍 问题: `version: "3.9"` 在新版 Docker Compose (v2+) 中已弃用，虽然不影响功能
- 💥 影响: 将来可能出现兼容性警告
- ✅ 修复: 移除 `version` 行即可

---

### **🔵 [L-04] 缺少健康检查端点的信息暴露**

- 📍 位置: `backend/app/main.py:72-74` (`/health`), `main.py:77-89` (`/`)
- 🔍 问题: 根端点 `/` 返回了所有 API 路径列表，帮助攻击者快速发现攻击面。`/docs` (Swagger UI) 在生产环境中默认开启。
- 💥 影响: 降低攻击者信息收集成本
- ✅ 修复:
  ```python
  # 生产环境禁用文档
  import os
  docs_url = "/docs" if os.getenv("ENV") != "production" else None
  app = FastAPI(title="MacroLens API", docs_url=docs_url, redoc_url=None)
  
  @app.get("/")
  async def root():
      return {"service": "MacroLens API", "status": "running"}
  ```
- 📎 Ref: CWE-200 (信息暴露)

---

### **🔵 [L-05] 前端缺少 API 错误信息过滤**

- 📍 位置: `frontend/src/services/api.ts:28-29`
- 🔍 问题: API 错误时直接将后端返回的原始文本作为错误信息展示给用户:
  ```typescript
  const text = await res.text().catch(() => res.statusText);
  throw new ApiError(res.status, text);
  ```
  后端可能返回包含堆栈跟踪、数据库路径等敏感信息的错误文本
- 💥 影响: 向用户暴露内部实现细节
- ✅ 修复:
  ```typescript
  const text = await res.text().catch(() => res.statusText);
  const safeMessage = res.status >= 500 ? '服务器内部错误，请稍后重试' : text;
  throw new ApiError(res.status, safeMessage);
  ```
- 📎 Ref: CWE-209 (通过错误消息暴露信息)

---

## 📦 依赖审计

### 后端 (requirements.txt)

| 包名 | 版本 | 风险评估 |
|------|------|---------|
| fastapi | 0.115.0 | ✅ 相对较新，建议升级到最新 |
| uvicorn[standard] | 0.30.0 | ✅ 正常 |
| pydantic-settings | 2.5.0 | ✅ 正常 |
| httpx | 0.27.0 | ✅ 正常 |
| aiosqlite | 0.20.0 | ✅ 正常 |
| apscheduler | 3.10.4 | ⚠️ APScheduler v3 已停止维护，v4 为当前活跃版本 |
| python-dotenv | 1.0.1 | ✅ 正常 |
| yfinance | >=0.2.36 | ⚠️ 使用 `>=` 范围约束，可能引入不兼容版本；yfinance 经常因 Yahoo 反爬变更而破坏 |

**缺失的安全依赖:**
- 无 `defusedxml` — XML 解析安全加固
- 无 `slowapi` / `fastapi-limiter` — 速率限制
- 无 `cryptography` / `fernet` — 敏感数据加密

### 前端 (package.json)

| 包名 | 版本 | 风险评估 |
|------|------|---------|
| react | ^18.2.0 | ✅ 正常 |
| react-dom | ^18.2.0 | ✅ 正常 |
| react-router-dom | ^6.22.0 | ✅ 正常 |
| vite | ^5.1.0 | ✅ 正常 |
| typescript | ^5.2.2 | ✅ 正常 |
| tailwindcss | ^3.4.1 | ✅ 正常 |

**前端评估:** 依赖较轻量且均为主流库，风险较低。React 默认防 XSS（无 `dangerouslySetInnerHTML` 使用）。

---

## 🗺️ 攻击面地图

```
┌─────────────────────────────────────────────────────────────────┐
│                      外部攻击面                                  │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  用户浏览器 ──HTTP:3000──▶ Nginx (前端)                          │
│                            │                                    │
│                            ├── /api/* ──▶ FastAPI (后端:8000)    │
│                            │              ├── GET  /api/news    │
│                            │              ├── POST /api/news/fetch ⚠️ 触发API调用 │
│                            │              ├── GET  /api/analysis │
│                            │              ├── POST /api/analysis/trigger ⚠️ 消耗LLM │
│                            │              ├── GET  /api/x-sentiment │
│                            │              ├── POST /api/x-sentiment/refresh ⚠️ 消耗LLM │
│                            │              ├── GET  /api/settings 🔴 泄露密钥 │
│                            │              ├── PUT  /api/settings 🔴 无认证修改 │
│                            │              ├── GET  /api/settings/providers │
│                            │              ├── POST /api/settings/test-llm │
│                            │              ├── GET  /api/quotes │
│                            │              ├── GET  /api/calendar │
│                            │              ├── POST /api/calendar/analyze │
│                            │              ├── GET  /health │
│                            │              └── GET  /docs 📖 Swagger暴露 │
│                            │                                    │
│  ⚠️ 后端端口 8000 也直接暴露 (docker-compose ports)              │
│                                                                 │
├─────────────────────────────────────────────────────────────────┤
│                      外部出站连接                                │
├─────────────────────────────────────────────────────────────────┤
│  后端 ──HTTPS──▶ Finnhub API (密钥在URL中)                      │
│  后端 ──HTTPS──▶ NewsAPI.org                                    │
│  后端 ──HTTPS──▶ GNews.io                                      │
│  后端 ──HTTPS──▶ Massive.com API                                │
│  后端 ──HTTPS──▶ Google News RSS (无认证)                        │
│  后端 ──HTTPS──▶ Seeking Alpha RSS (无认证)                      │
│  后端 ──HTTPS──▶ api.openweb-ui.xyz ⚠️ 第三方OpenAI代理          │
│  后端 ──HTTP───▶ 38.75.216.28:8000 ⚠️ 未加密的Grok代理           │
│  后端 ──HTTPS──▶ api.anthropic.com                              │
│  后端 ──HTTP───▶ host.docker.internal:11434 (Ollama)            │
│  后端 ──HTTPS──▶ faireconomy.media (经济日历)                    │
│  后端 ──HTTPS──▶ Yahoo Finance (yfinance)                       │
│                                                                 │
├─────────────────────────────────────────────────────────────────┤
│                      数据存储                                    │
├─────────────────────────────────────────────────────────────────┤
│  SQLite: data/macrolens.db (含明文API密钥、新闻数据、分析结果)     │
│  .env 文件 (含所有API密钥明文)                                    │
└─────────────────────────────────────────────────────────────────┘

信任边界:
  [A] 浏览器 ←→ Nginx: 无 HTTPS、无 HSTS
  [B] Nginx ←→ FastAPI: 内部网络，无认证
  [C] FastAPI ←→ 外部API: API密钥通过各种方式传输
  [D] FastAPI ←→ SQLite: 本地文件，无加密
  [E] Grok代理连接使用 HTTP 明文传输 ⚠️ 严重
```

---

## 🔧 修复路线图

### 第一优先级 — 立即执行 (0-24小时)

| # | 任务 | 关联发现 |
|---|------|---------|
| 1 | **轮换所有已暴露的 API 密钥** | C-01 |
| 2 | 为 Settings API 添加认证 (至少 API Key) | C-02, C-03 |
| 3 | 将 CORS 默认值改为仅允许前端域名 | H-01 |
| 4 | 审计 Grok 代理的 HTTP 明文传输，改为 HTTPS 或直连 | M-05 |
| 5 | 检查 `.env` 是否曾被提交到 Git 历史 | C-01 |

### 第二优先级 — 本周完成 (1-7天)

| # | 任务 | 关联发现 |
|---|------|---------|
| 6 | 为所有 POST 端点添加速率限制 | H-05 |
| 7 | 改用 FastAPI Depends 管理数据库连接 | H-02 |
| 8 | 在 nginx.conf 添加安全响应头 | M-03 |
| 9 | 移除 docker-compose 中后端的 ports 映射 | M-04 |
| 10 | Dockerfile 添加非 root 用户 | H-04 |
| 11 | 对存储在数据库中的 API 密钥加密 | C-03 |

### 第三优先级 — 持续改进 (1-4周)

| # | 任务 | 关联发现 |
|---|------|---------|
| 12 | 引入 `defusedxml` 替换 `xml.etree` | H-03 |
| 13 | 修复日志中的敏感信息泄露 | M-06, M-07 |
| 14 | 替换 `datetime.utcnow()` | L-01 |
| 15 | 生产环境禁用 Swagger 文档 | L-04 |
| 16 | 修复异常吞没问题 | M-02 |
| 17 | 添加自动化安全扫描 (bandit, safety) 到 CI | 全局 |
| 18 | 前端添加 API 错误信息过滤 | L-05 |

---

## 📌 备注

- **审计方法**: 逐文件人工审查 + 模式匹配分析
- **未审查范围**: `node_modules/` (第三方依赖内部代码), 前端 UI 组件的具体渲染逻辑 (已确认无 `dangerouslySetInnerHTML` 使用)
- **积极发现**: 
  - SQL 查询主体使用参数化绑定 `?`，核心查询无注入风险 ✅
  - 前端 React 默认防 XSS ✅
  - `.gitignore` 已包含 `.env` 和 `*.db` ✅
  - 新闻 API 客户端使用了超时设置 ✅
  - LLM 分析有失败重试机制和最大尝试次数限制 ✅
  - 设置 API 返回值做了密钥脱敏 (虽然不够彻底) ✅

---

*报告生成者: Reviewer (代码安全审计 Agent)*  
*审计时间: 2026-03-24*
