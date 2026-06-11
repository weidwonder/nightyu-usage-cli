# nightyu-usage-cli

一个 Node.js + TypeScript CLI，用于从本地配置文件读取多个 nightyu / Claude Code Hub API key，批量查询并展示每个 key 的日额度与总额度用量。同时支持快速切换 Claude Code / Codex 的本地凭据。

## 安装

要求 Node.js >= 18。

```bash
npm install
npm run build
```

## 配置

配置文件按以下顺序查找（命中即停）：

1. `--config` 显式指定
2. `./nightyu-usage.yaml`
3. `./nightyu-usage.yml`
4. `~/.config/nightyu-usage/config.yaml`
5. `~/.config/nightyu-usage/config.yml`

示例配置（见 `nightyu-usage.example.yaml`）：

```yaml
baseUrl: "https://api.nightyu.com"

keys:
  - alias: "工作Key"
    key: "sk-your-work-key"
  - alias: "个人Key"
    key: "sk-your-personal-key"
```

> 配置项名为 `key`，也兼容旧字段 `token`。请勿将真实 key 提交到仓库。

## 用法

```bash
# 开发运行
npm run dev

# 构建后运行
node dist/index.js

# 或全局安装后
nightyu-usage
```

### 查询用量（默认行为）

```bash
nightyu-usage                          # 查询所有 key 的用量
nightyu-usage --alias 工作Key          # 仅查询指定 alias
nightyu-usage --alias 工作Key 个人Key  # 查询多个 alias
nightyu-usage --json                   # 以 JSON 格式输出
nightyu-usage --timeout 8000           # 自定义请求超时（默认 5000ms）
```

输出示例：

```text
nightyu-usage v0.1.0

别名        日额度              总额度
──────────  ──────────────────  ──────────────────
工作Key     $6.06 / 无限制      $104.05 / $200.00
个人Key     $0.50 / $3.00       $12.00 / 无限制

更新时间: 2026-06-02 11:00:00
```

### 查看配置

```bash
nightyu-usage -l                       # 输出当前命中的配置文件内容
```

### 切换 Claude Code 凭据

将 `~/.claude/settings.json` 中的 `ANTHROPIC_AUTH_TOKEN` 切换为配置中对应的 key：

```bash
nightyu-usage -cc 工作Key              # 按 alias 切换
nightyu-usage -cc sk-your-work-key     # 按 key 值切换
```

### 切换 Codex 凭据

将 `~/.codex/auth.json` 中的 `OPENAI_API_KEY` 切换为配置中对应的 key：

```bash
nightyu-usage -cx 工作Key              # 按 alias 切换
nightyu-usage -cx sk-your-work-key     # 按 key 值切换
```

> `-l`、`-cc`、`-cx` 三者互斥，不能同时使用。

### 完整参数

| 参数 | 短写 | 说明 |
|------|------|------|
| `--config <path>` | `-c` | 指定配置文件路径 |
| `--alias <alias...>` | `-a` | 仅查询指定 alias（可多个） |
| `--list-config` | `-l` | 输出当前配置文件内容 |
| `--claude-key <keyOrAlias>` | `-cc` | 切换 Claude Code 凭据 |
| `--codex-key <keyOrAlias>` | `-cx` | 切换 Codex 凭据 |
| `--json` | | 以 JSON 格式输出 |
| `--timeout <ms>` | | 单次请求超时毫秒数（默认 5000） |

## 实现策略

对每个 key，按优先级依次尝试以下接口获取用量数据：

1. `GET /api/v1/users/{id}/limit-usage:all` — 最贴近网页"用户配额使用区域"
2. `GET /api/v1/me/quota` — 回退方案
3. `POST /api/actions/users/getUserLimitUsage` — 最终回退，仅能获取日额度

认证方式优先使用 `Authorization: Bearer <key>`，失败后回退 `Cookie: auth-token=<key>`。

## 开发

```bash
npm run dev           # 使用 tsx 直接运行
npm run typecheck     # 类型检查
npm run build         # 编译到 dist/
```

## License

MIT
