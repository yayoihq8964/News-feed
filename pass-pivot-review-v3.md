# Pass-Pivot 第三次代码审查报告

**项目**: [LIznzn/pass-pivot](https://github.com/LIznzn/pass-pivot)  
**基准**: 第二次审查 (2026-03-21) → 本次 (2026-03-24)  
**审查方式**: 安全/后端/前端三路 Agent 并行审查 + 人工汇总  
**更新提交**: ~7 commits，+2847/-2215 行变更  

---

## 一、上次问题修复情况

### ✅ 已修复

| # | 原问题 | 说明 |
|---|--------|------|
| 🔴2 (部分) | **暴力破解防护** | Device Code Flow 的轮询接口实现了 `slow_down` 机制（按间隔拒绝过频请求），但**主登录接口仍无 rate limit**。详见下方「仍未修复」 |
| 🟡3 | **RSA 密钥未持久化** | ✅ **彻底重构了**。新增 `OrganizationSigningKey` 和 `ApplicationKey` 模型，密钥持久化到数据库，通过 `loadOrganizationSigningKey` 从 DB 加载。每个组织和应用有独立的 RSA 密钥对，支持密钥轮转（`status = "active"`, `ORDER BY created_at DESC`）。重启不再丢失密钥。修得非常好 |
| 🟡4 | **web/portal/.env 被 git 追踪** | ✅ 文件已删除，不再被追踪 |
| 🟡5 | **CORS 每次查 DB** | ⚠️ **有改进但未完全解决**。CORS 白名单逻辑改为基于组织的已验证域名（`domain.Verified`），不再查所有应用的 redirect_uri，查询范围更精确。但仍是每次请求查 DB，无缓存 |
| 🟢N4 | **DefaultCaptchaProvider 语义不清** | ✅ 实现了完整的内置验证码系统（SVG 图形验证码），有 HMAC 签名的 token、5分钟过期，不再是空 `return true`。集成到了登录流程中。GeeTest 已移除（精简了不需要的 provider） |
| 🟢12 | **零测试** | ✅ **从 0 增加到 5 个测试文件**，详见新功能分析 |

### ❌ 仍未修复

| # | 原问题 | 状态 |
|---|--------|------|
| 🔴2 | **主登录接口无暴力破解防护** | ❌ `/api/authn/v1/session/create` 仍无 rate limit / 账号锁定。Device Code 轮询有 `slow_down`，但核心密码登录接口仍然裸奔 |
| 🟡6 | **TransientStore 内存存储** | ❌ 仍在进程内存，结构未变（新增的 Device Code 也用内存存储） |
| 🟢13 | **日志无脱敏** | ❌ logger 未变 |
| 🟢14 | **前端 Token 在 localStorage** | ❌ portal 仍用 localStorage 存 access/refresh token |
| 🟢17 | **无 Dockerfile** | ❌ 仍无 |

---

## 二、新功能审查

### 🆕 Device Code Flow (OAuth 2.0 Device Authorization Grant)

**文件**: `internal/server/auth/service/device_code.go`, `internal/server/auth/handler/device_code_handler.go`

**RFC 8628 合规性评估**: 

| 要求 | 状态 |
|------|------|
| Device Authorization Endpoint | ✅ `/auth/device_authorization` |
| User Code 生成 (8字符，排除歧义字符) | ✅ BCDFGHJKLMNPQRSTVWXZ 字母表，XXXX-XXXX 格式 |
| `verification_uri` + `verification_uri_complete` | ✅ 都实现了 |
| Polling interval (默认5秒) | ✅ `deviceAuthorizationInterval = 5` |
| `slow_down` 响应 | ✅ 检查 `LastPolledAt` 间隔，过频返回 `slow_down` |
| `authorization_pending` 响应 | ✅ |
| `expired_token` 响应 | ✅ 10分钟过期 |
| `access_denied` 响应 | ✅ 用户拒绝时返回 |
| User Code 规范化 | ✅ 大小写/空格/短横线容错处理 |
| 验证页面支持已登录+未登录 | ✅ 有 session cookie 检查 |

整体实现质量很高，RFC 合规度好。

**安全注意点**:

🟡 **N1. Device Code 存储也在内存中**

```go
var deviceCodeStore = &DeviceCodeStore{
    entries: make(map[string]*DeviceCodeRecord),
}
```

与 TransientStore 同样的问题。Device Code 的有效期10分钟，影响稍小，但在多实例部署下仍会失败。

🟢 **N2. 验证页面用服务端渲染 HTML**

`buildDeviceVerificationPage` 手工拼接 HTML，虽然用了 `html.EscapeString` 做转义（安全），但维护性差。建议用 `html/template`。

---

### 🆕 内置验证码系统 (Default Captcha)

**文件**: `internal/server/core/service/default_captcha.go`

这个实现挺有想法——不依赖外部服务的 SVG 图形验证码：
- 生成5位验证码，排除歧义字符（234567ACDEFGHJKLMNPQRTUVWXYZ）
- 用 HMAC-SHA256 + 服务端密钥签名，token 内含过期时间
- SVG 渲染有噪声线、噪声圆、噪声方块干扰
- 5分钟过期

🟡 **N3. 内置验证码可被 OCR 轻松破解**

SVG 验证码的噪声都是透明度很低的几何图形，字符排列规则。对于现代 OCR（Tesseract / 简单 CNN）基本无抵抗力。如果这只是作为「比没有强」的基础保护还行，但不应作为安全防线。

🟢 **N4. Token 校验无 nonce / 一次性消费机制**

```go
// provider/captcha/default.go
func (captcha *DefaultCaptchaProvider) VerifyCaptcha(token, clientId, clientSecret string) (bool, error) {
    // HMAC 验签 + 过期检查
}
```

同一个 captcha token 在过期前可以被多次使用（无服务端 nonce 记录）。攻击者解一次验证码可以重放多次。

---

### 🆕 域名验证系统

**文件**: `internal/server/core/service/organization_console_settings.go`, `manage_service.go`

支持两种验证方式：
- **HTTP File**: 在域名根目录放置 `/.well-known/ppvt-verification` 文件
- **DNS TXT**: 添加 `_ppvt-verification.{domain}` TXT 记录

实现合理，同时尝试 HTTPS 和 HTTP（graceful fallback），DNS 查询有超时控制。

🟡 **N5. HTTP File 验证请求未限制内网访问 (SSRF)**

```go
client := &http.Client{Timeout: 10 * time.Second}
resp, err := client.Get(target)  // target 来自用户输入的域名
```

用户可以提交 `localhost:8090`、`127.0.0.1`、`10.0.0.1` 等内网地址作为域名，服务端会向这些地址发 HTTP 请求。这是一个 **Server-Side Request Forgery (SSRF)** 向量。

**修复建议**: 解析目标 URL 的 IP，拒绝私有/回环/链路本地地址。参考：
```go
ip := net.ParseIP(host)
if ip.IsPrivate() || ip.IsLoopback() || ip.IsLinkLocalUnicast() { reject }
```

🟡 **N6. CORS 白名单引入已验证域名 — 域名劫持风险**

CORS 白名单现在基于组织的已验证域名。如果一个域名通过验证后，DNS 过期或被他人注册（dangling domain），攻击者控制该域名后自动获得 CORS 白名单权限。

**建议**: 域名验证应有定期重新验证机制（如每90天重新验证），或在域名 DNS 变更时触发重新验证。

---

### 🆕 测试文件分析

| 文件 | 测试数 | 内容 |
|------|--------|------|
| `device_code_test.go` | 2 | OIDC metadata 包含 device endpoint、user code 规范化 |
| `oauth_oidc_standard_test.go` | 4 | redirect URI 验证、PKCE S256、code challenge 校验、Basic auth 解析 |
| `manage_service_test.go` | 2 | 密码策略校验、应用协议验证 |
| `api_guard_authz_test.go` | 1 | policy check 路径跳过逻辑 |
| `access_context_test.go` | 1 | 用户自身目标 ID 校验 |

**评价**: 🟡

从 0 到 10 个测试用例，方向对了。但：
- 覆盖面仍然很薄（核心认证流程、token 签发/验证、MFA 流程 未测试）
- 全部是单元测试，没有集成测试
- 缺少负向测试（恶意输入、过期 token、篡改 JWT 等）

---

## 三、新发现问题汇总

### 🟡 中等

| # | 问题 | 位置 |
|---|------|------|
| N1 | Device Code Store 也在内存中 | `device_code.go` |
| N3 | 内置验证码抗 OCR 能力弱 | `default_captcha.go` |
| N4 | 验证码 token 可重放 | `provider/captcha/default.go` |
| N5 | 域名验证 HTTP 请求有 SSRF 风险 | `manage_service.go:740` |
| N6 | CORS 域名白名单无定期重验证 | `cors.go` + domain verification |

### 🟢 建议

| # | 问题 | 位置 |
|---|------|------|
| N2 | Device Code 页面手工拼 HTML | `device_code_handler.go` |
| N7 | CORS 仍每次请求查 DB | `cors.go` |
| N8 | 测试覆盖仍然很薄 | 全局 |

---

## 四、三轮审查趋势

| 指标 | 第一轮 (3/20) | 第二轮 (3/21) | 第三轮 (3/24) |
|------|--------------|--------------|--------------|
| 🔴 严重 | 5 | 1 | **1** (同一个) |
| 🟡 中等 | 6 | 4 | **6** (1遗留+5新) |
| 🟢 建议 | 6 | 6 | **6** (3遗留+3新) |
| 测试文件 | 0 | 0 | **5** |
| 新功能 | — | — | Device Code、内置验证码、域名验证 |
| 密钥管理 | 内存生成 | 内存生成 | **DB 持久化** ✅ |

---

## 五、总评

你朋友的迭代速度和改进质量都很不错。这一轮的亮点：

1. **密钥持久化做得很专业** — Organization + Application 级别的密钥管理，支持轮转，这是生产级的设计
2. **Device Code Flow RFC 合规度高** — 不是随便糊弄的，各种 edge case（slow_down、expired、denied）都覆盖了
3. **内置验证码系统** — 不依赖外部服务的 SVG 验证码，虽然安全性一般但作为默认方案合理
4. **域名验证** — HTTP File + DNS TXT 双模式，是正经的域名所有权验证

**最该优先做的**:
1. 🔴 **给登录接口加 Rate Limit** — 三轮了还没修，这是唯一剩下的严重安全问题
2. 🟡 **SSRF 防护** — 域名验证的 HTTP 请求需要过滤内网地址
3. 🟡 **验证码加 nonce** — 防止重放
4. 🟡 **把内存存储搬到 Redis** — TransientStore + DeviceCodeStore
