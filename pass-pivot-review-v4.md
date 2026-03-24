# Pass-Pivot 第四次代码审查报告（Reviewer Agent）

**项目**: [LIznzn/pass-pivot](https://github.com/LIznzn/pass-pivot)  
**审查方式**: Reviewer Agent（安全漏洞 + 代码质量 + 性能 + 依赖链审计）  
**基准**: 第三次审查 (2026-03-24 02:00) → 本次 (2026-03-24 最新 commit `28459cb`)  
**变更量**: +1485/-353 行，28 文件  

---

## 一、前次遗留问题状态

| # | 问题 | 前次状态 | 本次状态 | 说明 |
|---|------|---------|---------|------|
| 🔴 | **登录暴力破解防护** | ❌ | ❌ **仍未修复** | 第1-4轮一直未修复，依然是唯一的严重安全问题 |
| 🟡 | **TransientStore 内存存储** | ❌ | ❌ **仍未修复** | 仍为 sync.Mutex + map |
| 🟡 | **CORS 每次查 DB** | ❌ | ❌ **仍未修复** | 无缓存层 |
| 🟡 | **SSRF 域名验证** | ❌ | ✅ **已修复** | 新增 `IsPrivateOrganizationDomainHost` + 自定义 `DialContext` 在连接层拦截内网 IP |
| 🟡 | **验证码 token 可重放** | ❌ | ✅ **已修复** | 新增 nonce 机制 + `consumeDefaultCaptchaNonce` 一次性消费 |
| 🟢 | 前端 token 在 localStorage | ❌ | ❌ **仍未修复** | |
| 🟢 | 日志无脱敏 | ❌ | ❌ **仍未修复** | |
| 🟢 | 无 Dockerfile | ❌ | ❌ **仍未修复** | |

---

## 二、新修复亮点

### ✅ SSRF 防护（修得非常好）

```go
// organization_console_settings.go:176
func IsPrivateOrganizationDomainHost(host string) bool {
    // 检查 localhost, *.localhost
    // 解析 IP 后检查:
    return ip.IsPrivate() ||
        ip.IsLoopback() ||
        ip.IsLinkLocalUnicast() ||
        ip.IsLinkLocalMulticast() ||
        ip.IsMulticast() ||
        ip.IsUnspecified()
}
```

在 `DialContext` 层拦截（而非 URL 解析层），能防止 DNS rebinding 攻击。同时 `CheckRedirect` 也验证了重定向目标。覆盖面全面，这是教科书级的 SSRF 防护。

### ✅ 验证码 Nonce 消费机制

```go
// default_captcha.go
func consumeDefaultCaptchaNonce(nonce string, expiresAtUnix, nowUnix int64) bool {
    // 清理过期 nonce
    // 检查是否已消费
    // 标记为已消费
}
```

使用内存 map 存储已消费 nonce，带过期清理。有效防止重放攻击。

### ✅ Device Auth UI 改为 Vue SPA

从上一轮的服务端手工拼 HTML 改为完整的 Vue 组件（DeviceApp.vue），前端用 `{{ }}` 模板语法渲染数据，天然防 XSS。

---

## 三、新发现问题

### 🔴 严重

#### S1. Bootstrap JSON 注入导致 XSS

**文件**: `internal/server/auth/handler/device_code_handler.go:248-250`

```go
html := `<!DOCTYPE html>
<html lang="en">
<head>
  <title>PPVT ` + bootstrap.Title + `</title>
  ...
  <script>window.__PPVT_DEVICE_BOOTSTRAP__ = ` + string(payload) + `;</script>
  ...`
```

两个 XSS 注入点：

**1) `bootstrap.Title` 直接拼入 `<title>` 标签**

`Title` 目前来自硬编码字符串 `"Device Verification"` / `"Device Verification Error"`，**暂时安全**。但如果未来 Title 引入用户可控数据（如应用名），就会被注入。

**2) `string(payload)` — JSON 注入到 `<script>` 上下文** 🔴

`payload` 是 `json.Marshal(bootstrap)` 的结果，其中包含 `ApplicationName`、`OrganizationName`、`Error`、`UserCode` 等字段。这些字段中如果包含 `</script>` 标签，攻击者可以闭合 script 块并注入任意 JS。

例如：如果应用名设置为 `</script><script>alert(1)</script>`，`json.Marshal` 会编码 `<` 为 `\u003c`（Go 的 json.Marshal 默认 HTML 转义），所以 **Go 默认行为下恰好安全**。但这是一个隐式依赖，非常脆弱——如果有人换用 `json.NewEncoder` 并设置 `SetEscapeHTML(false)`，或使用第三方 JSON 库，这个防护就消失了。

**修复建议**: 
- 使用 `html/template` 渲染 HTML，或
- 对注入到 `<script>` 的 JSON 额外做 `strings.ReplaceAll(payload, "</", "<\\/")`

---

### 🟡 中等

#### M1. 测试文件全部删除 — 回归到零测试状态

5 个测试文件全部删除：
- `device_code_test.go` ❌ 删除
- `oauth_oidc_standard_test.go` ❌ 删除
- `manage_service_test.go` ❌ 删除
- `api_guard_authz_test.go` ❌ 删除
- `access_context_test.go` ❌ 删除

对于一个认证系统，删除测试是很危险的信号。上一轮花精力写的测试应该保留并持续扩充，而不是删除。

#### M2. Captcha Nonce Store 也在内存中

```go
var defaultCaptchaNonceStore = struct {
    mu   sync.Mutex
    used map[string]int64
}{used: make(map[string]int64)}
```

与 TransientStore 同样的问题。多实例部署下验证码在 A 实例生成，验证请求打到 B 实例会失败。

#### M3. Device Code 静态资源未鉴权

```go
// static_asset_handler.go
mux.Handle("GET /auth/device/", http.StripPrefix("/auth/device/", http.FileServer(http.FS(deviceFS))))
```

Device Code 的静态资源（JS/CSS）直接用 `http.FileServer` 暴露，无鉴权。虽然静态资源不含敏感数据，但 `http.FileServer` 默认会列出目录内容，可能泄露文件结构。

**修复建议**: 禁用目录列表，或确认 `embed.FS` 只嵌入了必要文件。

#### M4. Dashboard.vue 请求未做统一错误处理

`Dashboard.vue`（488+ 行）中大量 API 请求使用 `.catch(() => {})` 静默吞掉错误：

```vue
// Dashboard.vue 中多处类似模式
organizationStore.loadOrganization().catch(() => {})
```

管理后台的 API 错误不应静默，至少应有 toast 提示。

---

### 🟢 建议

#### L1. 硬编码 Badge 文字

```vue
<!-- DeviceApp.vue -->
<div class="device-badge">P</div>
```

应该用组织 logo 或可配置的文字。

#### L2. 缺少 CSP Header

Device Code 验证页注入了 `<script>window.__PPVT_DEVICE_BOOTSTRAP__`，但未设置 Content-Security-Policy header。建议添加 CSP 限制内联脚本（配合 nonce）。

#### L3. vite.config.ts 多入口

```typescript
// web/auth/vite.config.ts
input: {
  main: resolve(__dirname, 'index.html'),
  device: resolve(__dirname, 'device.html'),
}
```

新增了 device 入口点，OK。但 output 的 `assetFileNames` 和 `entryFileNames` 硬编码了路径格式，缓存 busting 可能有问题。

---

## 四、依赖 CVE 审计

| 依赖 | 版本 | 状态 |
|------|------|------|
| go | 1.26.0 | ✅ 最新 |
| golang.org/x/crypto | v0.49.0 | ✅ 无已知 CVE |
| github.com/golang-jwt/jwt/v5 | v5.3.1 | ✅ 无已知 CVE |
| github.com/go-jose/go-jose/v4 | v4.1.3 | ✅ |
| github.com/go-webauthn/webauthn | v0.16.1 | ✅ |
| github.com/casbin/casbin/v2 | v2.135.0 | ✅ |
| github.com/redis/go-redis/v9 | v9.7.1 | ✅ |
| gorm.io/gorm | v1.31.0 | ✅ |
| github.com/jackc/pgx/v5 | v5.6.0 | ⚠️ 建议升级到 v5.7+（v5.6.0 有一个连接泄漏修复在 v5.7 中） |

依赖整体健康，无严重 CVE。

---

## 五、攻击面总结

```
                                    ┌──────────────────────┐
                                    │   Internet / Client   │
                                    └──────────┬───────────┘
                                               │
                    ┌──────────────────────────┼──────────────────────────┐
                    │                          │                          │
            ┌───────▼────────┐   ┌─────────────▼──────────┐   ┌─────────▼────────┐
            │   ppvt-auth    │   │       ppvt-core         │   │  Web Frontends   │
            │  :8091         │   │       :8090             │   │ (auth/console/   │
            │                │   │                         │   │  portal)         │
            │ • OAuth/OIDC   │   │ • /api/authn/* [JWT]    │   │                  │
            │ • Device Code  │──▶│ • /api/manage/* [Token] │   │ • localStorage   │
            │ • WebAuthn     │   │ • /api/authz/* [JWT]    │   │   tokens ⚠️      │
            │ • External IDP │   │ • /api/user/* [Token]   │   │ • No CSP ⚠️      │
            └────────────────┘   └────────────┬────────────┘   └──────────────────┘
                                              │
                    ┌─────────────────────────┼──────────────────────────┐
                    │                         │                          │
            ┌───────▼────────┐   ┌────────────▼──────────┐   ┌─────────▼────────┐
            │    MySQL/PG    │   │       Redis            │   │   Domain Verify  │
            │                │   │ (sessions only)        │   │   HTTP/DNS       │
            │ • Keys in DB ✅ │   │ ⚠️ TransientStore     │   │ • SSRF 防护 ✅    │
            │ • ORM (GORM)   │   │    NOT using Redis     │   │ • Redirect 校验   │
            └────────────────┘   └────────────────────────┘   └──────────────────┘
```

**最薄弱环节**: 
1. 登录接口 — 无速率限制（可暴力破解）
2. 内存存储 — auth code / MFA / device code / captcha nonce 全在内存

---

## 六、四轮审查趋势

| 指标 | 第1轮 | 第2轮 | 第3轮 | 第4轮 |
|------|-------|-------|-------|-------|
| 🔴 严重 | 5 | 1 | 1 | **1+1** |
| 🟡 中等 | 6 | 4 | 6 | **4** |
| 🟢 建议 | 6 | 6 | 6 | **3** |
| 测试文件 | 0 | 0 | 5 | **0** ⬇️ |
| 密钥管理 | 内存 | 内存 | DB | **DB** ✅ |
| SSRF | — | — | ❌ | **✅** |
| 验证码防重放 | — | — | ❌ | **✅** |

---

## 七、总体评分

**6.5 / 10**

**扣分项**:
- -1.5 暴力破解防护（四轮未修）
- -0.5 测试从5个回退到0
- -0.5 TransientStore 仍在内存
- -0.5 Script 注入隐患
- -0.5 CORS 无缓存 / localStorage token / 无 Docker

**加分项**:
- +1 SSRF 防护修得很专业（DialContext 层拦截 + redirect 校验）
- +1 密钥持久化 + 组织/应用级隔离
- +0.5 验证码 nonce 一次性消费
- +0.5 Device Code UI 改为 Vue SPA
- +0.5 OAuth2/OIDC 协议实现完整度高

**一句话总结**: 架构和协议层面已经是一个相当专业的认证平台了，但 "Rate Limit" 这个基础安全能力缺失四轮了，应该最高优先级补上。
