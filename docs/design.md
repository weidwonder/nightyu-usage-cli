---
date: '2026-06-02'
status: '已审阅并完成最小实现'
documentRole: 'design-and-plan'
---

# nightyu-usage-cli — 设计与实施计划

## 1. 用户故事与目标

**作为** nightyu.com (Claude Code Hub) 的用户，  
**我希望** 在终端运行一条命令就能看到自己所有 API Key 的用量概览，  
**以便于** 快速了解每个 Key 的日消耗和总消耗，无需打开浏览器登录控制台。

### 成功标准

- 运行一条命令即可查看所有配置 Key 的用量
- 每个 Key 显示：别名、日额度用量、总额度用量
- API Key 不硬编码在代码中，通过本地配置文件管理
- 支持多个 Key，每个 Key 可设置别名
- 从配置到首次运行 < 2 分钟

### 预期输出示例

```
nightyu-usage v0.1.0

  别名           日额度              总额度
  ─────────────  ─────────────────   ─────────────────
  工作Key        $1.20 / $5.00       $45.00 / $100.00
  个人Key        $0.50 / $3.00       $12.00 / $50.00
  测试Key        $0.00 / $2.00       $0.00 / 无限制

  更新时间: 2026-06-02 14:30:05
```

## 2. 目标站点分析

- **站点**：`https://api.nightyu.com`（Claude Code Hub 实例，v0.8.2）
- **GitHub**：`github.com/ding113/claude-code-hub`
- **登录方式**：API Key 单因素认证
- **API 文档**：OpenAPI 3.1.0，39 个 REST 端点
  - Swagger UI: `/api/actions/docs`
  - Scalar UI: `/api/actions/scalar`
  - OpenAPI JSON: `/api/actions/openapi.json`

## 3. 数据抓取/鉴权方案

> 实现修订说明（2026-06-02）
>
> - 已核对 `https://api.nightyu.com/api/actions/openapi.json` 与 Claude Code Hub 官方源码。
> - 当前最小可运行 CLI 已实现，优先使用 `POST /api/actions/users/getUsers` 与 `POST /api/actions/keys/getKeyLimitUsage`。
> - 当前实现不阻塞在“模拟登录”；若用户提供的只是原始 `sk_...` key 而非可用管理 token，会明确提示改用浏览器中的 `auth-token`。
> - `getUsers` 只返回 `maskedKey`，不会回传完整 key；CLI 已按同规则掩码（`前4 + •••••• + 后4`）匹配本地 token。

### 3.1 已确认的 API 端点

nightyu 基于 CCH，所有管理 API 均为 `POST` 方法，请求体为 JSON。

| 端点 | 用途 |
|------|------|
| `POST /api/actions/users/getUsers` | 获取用户信息 + Key 列表 + 用量（`includeUsage: true`） |
| `POST /api/actions/keys/getKeyLimitUsage` | 获取单个 Key 各维度限额使用详情 |
| `POST /api/actions/users/getUserLimitUsage` | 获取用户级别限额使用详情 |

### 3.2 认证方式

CCH API 支持两种认证（二选一）：
- **Cookie**: `Cookie: auth-token=<token>`
- **Bearer**: `Authorization: Bearer <token>`

两种方式使用相同的 token 值。

**实施策略（按优先级尝试）**：

1. **先尝试 Bearer 认证**：CLI 先用 `Authorization: Bearer <token>` 请求。
2. **自动回退 Cookie 认证**：若返回未认证，再用 `Cookie: auth-token=<token>` 重试。
3. **配置要求修订**：这里的 `token` 更准确地说应是“可用于管理接口的认证 token”。如果原始 `sk_...` 不能直接调用接口，用户需要先登录 Web UI 并提取 `auth-token`。
4. **暂不实现模拟登录**：当前版本不依赖逆向登录流程，避免把最小 CLI 实现阻塞在不稳定登录细节上。

### 3.3 关键响应数据结构

`getUsers` 响应中，每个 key 对象的关键字段（已从 OpenAPI spec 确认）：

```typescript
interface CCHKeyData {
  id: number;
  name: string;
  maskedKey: string;
  status: "enabled" | "disabled";

  // 今日用量
  todayUsage: number;        // 今日已用金额 (USD)
  todayCallCount: number;    // 今日调用次数
  todayTokens: number;       // 今日 token 数

  // 各维度限额配置
  limitDailyUsd: number | null;     // 日限额 (null = 无限制)
  limit5hUsd: number | null;        // 5小时限额
  limitWeeklyUsd: number | null;    // 周限额
  limitMonthlyUsd: number | null;   // 月限额
  limitTotalUsd: number | null;     // 总限额

  // 重置相关
  dailyResetMode: "fixed" | "rolling";
  dailyResetTime: string;           // "HH:mm"
  costResetAt: string | null;

  lastUsedAt: string | null;
  lastProviderName: string | null;
}
```

### 3.4 数据获取流程

```
对每个配置的 Key:
  1. 使用 token 认证（Bearer 或 Cookie）
  2. POST /api/actions/users/getUsers { includeUsage: true }
     → 普通用户只返回自己的数据（API 文档已确认）
  3. 从响应中提取 keys 数组，用 maskedKey 与本地 token 掩码匹配当前 Key
  4. 读取字段:
     - 日额度: todayUsage / limitDailyUsd
     - 总额度: 从 getKeyLimitUsage 获取累计用量 / limitTotalUsd
  5. 如需总累计用量:
     POST /api/actions/keys/getKeyLimitUsage { keyId }
```

### 3.5 显示映射

| 显示列 | 数据来源 | null 处理 |
|--------|----------|-----------|
| 别名 | 配置文件 alias | — |
| 日额度用量 | `todayUsage` / `limitDailyUsd` | 限额 null → "无限制" |
| 总额度用量 | `getKeyLimitUsage` 累计值 / `limitTotalUsd` | 限额 null → "无限制" |

## 4. 配置格式

配置文件路径（按优先级）：
1. `./nightyu-usage.yaml`（当前目录）
2. `~/.config/nightyu-usage/config.yaml`（全局）

```yaml
# nightyu-usage.yaml
baseUrl: "https://api.nightyu.com"

keys:
  - alias: "工作Key"
    token: "paste-your-auth-token-here"
  - alias: "个人Key"
    token: "paste-another-auth-token-here"
  - alias: "测试Key"
    token: "paste-third-auth-token-here"
```

> **token 获取方式**：登录 Web UI (`baseUrl/zh-CN/my-usage`) → 浏览器 DevTools → Application → Cookies → 复制 `auth-token` 的值。如果原始 `sk_...` key 能直接通过 Bearer 认证，也可以直接填入。

**安全**：`.gitignore` 已排除 `nightyu-usage.yaml` 和 `*.local.yaml`。

## 5. CLI 运行方式

```bash
# 查看所有 Key 用量
npx nightyu-usage

# 指定配置文件
npx nightyu-usage --config ./my-config.yaml

# 只查某个 Key
npx nightyu-usage --alias "工作Key"

# JSON 输出
npx nightyu-usage --json

# 指定超时
npx nightyu-usage --timeout 8000
```

## 6. 错误处理与边界情况

| 场景 | 处理 |
|------|------|
| 配置文件不存在 | 提示创建，打印模板 |
| Key 无效 / 401 | 标记该 Key "认证失败"，提示优先填写 `auth-token`，继续其余 |
| Key 已过期 | 显示 "已过期" |
| 网络超时 | 5s 超时（`--timeout` 可调），标记 "网络错误" |
| 限额为 null | 显示 "无限制" |
| base_url 不可达 | 报错退出，提示检查网络 |
| 鉴权方案 A 失败 | 自动尝试方案 B |
| 配置文件权限过宽 | 当前未实现，列为后续增强项 |

**部分成功策略**：多 Key 时，某 Key 失败不影响其他。失败 Key 单独标记原因。退出码：全部成功 0，部分失败 1，全部失败 2。

## 7. 推荐技术栈

**Node.js + TypeScript**

| 依赖 | 用途 |
|------|------|
| `typescript` + `tsx` | 类型安全 + 直接运行 TS |
| `yaml` | 解析配置 |
| `commander` | CLI 参数 |
| Node 原生输出 | 纯文本表格输出，减少依赖 |

选择理由：Node 18+ 内置 fetch，与 CCH 技术栈一致，可 `npx` 运行。

### 项目结构

```
nightyu-usage-cli/
├── src/
│   ├── index.ts          # CLI 入口
│   ├── config.ts         # 配置加载与校验
│   ├── api.ts            # CCH API 客户端（含鉴权回退）
│   ├── display.ts        # 终端表格渲染
│   ├── errors.ts         # CliError / HttpError
│   ├── utils.ts          # maskToken / formatUsd / padRight 等
│   └── types.ts          # TypeScript 类型定义
├── docs/
│   └── design.md         # 本文档
├── package.json
├── tsconfig.json
├── .gitignore
└── nightyu-usage.example.yaml
```

## 8. 给 Codex 的实施步骤

### Step 0: 项目初始化

1. `npm init -y`，设置 `name: "nightyu-usage-cli"`、`type: "module"`
2. `npm i typescript tsx yaml commander`
3. `npm i -D @types/node`
4. 创建 `tsconfig.json`（target: ES2022, module: Node16, outDir: dist）
5. `.gitignore`：`node_modules/`, `dist/`, `nightyu-usage.yaml`, `config.yaml`
6. 创建 `nightyu-usage.example.yaml` 配置模板
7. `package.json` 中 `"bin": { "nightyu-usage": "./dist/index.js" }`, `"scripts": { "dev": "tsx src/index.ts", "build": "tsc -p tsconfig.json" }`

### Step 1: 类型定义 (`src/types.ts`)

```typescript
export interface Config {
  baseUrl: string;
  keys: Array<{ token: string; alias: string }>;
}

export interface KeyUsageResult {
  alias: string;
  dailyUsed: number;
  dailyLimit: number | null;
  totalUsed: number;
  totalLimit: number | null;
  error?: string;
}
```

### Step 2: 配置模块 (`src/config.ts`)

- `loadConfig(configPath?: string): Config`
  - 查找顺序：`--config` 参数 → `./nightyu-usage.yaml` → `~/.config/nightyu-usage/config.yaml`
  - YAML 解析 + 校验必填字段
- 当前版本未实现环境变量覆盖，优先保证本地配置文件路径可运行
- 当前版本未实现文件权限检查，可作为后续增强项

### Step 3: 鉴权验证（已合并进 `src/api.ts`）

**关键验证**：
```bash
curl -X POST https://api.nightyu.com/api/actions/users/getUsers \
  -H "Authorization: Bearer sk_YOUR_KEY" \
  -H "Content-Type: application/json" \
  -d '{"includeUsage": true}'
```
如果返回 200 + JSON，说明该 token 可用；如果 Bearer 失败但 Cookie 成功，CLI 会自动回退；如果两者都失败，应改用浏览器中的 `auth-token`。

### Step 4: API 客户端 (`src/api.ts`)

- `fetchUsersWithUsage(baseUrl, token): Promise<UserResponse>`
  - `POST /api/actions/users/getUsers` with `{ includeUsage: true }`
  - 从响应用户列表中提取 keys
  - 用 `maskedKey` 匹配本地 token
- `fetchKeyLimitUsage(baseUrl, token, keyId): Promise<LimitUsage>`
  - `POST /api/actions/keys/getKeyLimitUsage` with `{ keyId }`
  - 提取 `costTotal.current / costTotal.limit`
- 统一 5s 超时
- 检查 `response.ok` 和 JSON 中的 `ok` 字段

### Step 5: 显示模块 (`src/display.ts`)

- 表格渲染：别名 | 日额度 | 总额度
- 金额格式化：`$X.XX / $Y.YY`，null 限额 → "无限制"
- `--json` 模式输出 JSON 数组

### Step 6: CLI 入口 (`src/index.ts`)

- commander 定义：`--config`、`--alias`、`--json`
- 流程：加载配置 → 并行请求 → 渲染
- 退出码：0 全部成功，1 部分失败，2 全部失败

### Step 7: 收尾

- README.md（安装、配置、使用）
- 本地验证：`npm run typecheck`、`npm run build`、`npm run dev -- --help`

## 9. 显式假设清单

| # | 假设 | 验证方式 | 如不成立 |
|---|------|----------|----------|
| A | 配置中的 token 可直接用于 Bearer 或 Cookie 认证 | curl / CLI 实测 | 改用浏览器中的 `auth-token` |
| B | `getKeyLimitUsage` 返回各维度累计已用量 | 实际调用 | 需从 `todayUsage` 累加或查日志 |
| C | 普通用户 `getUsers` 只返回自己 | API 文档已确认 | 低风险 |
| D | 多个 Key 可能属于同一用户 | 用户确认 | 可能只需认证一次 |
| E | 用户环境有 Node.js 18+ | 用户确认 | 改用 Python |
