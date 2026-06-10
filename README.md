# nightyu-usage-cli

一个 Node.js + TypeScript CLI，用于从本地配置文件读取多个 `{ alias, key }`，并输出每个别名对应的：

- 日额度用量
- 总额度用量

这两个值对齐 `https://api.nightyu.com/zh-CN/my-usage` 页面里的“用户配额使用区域”。

## 本次真实验证结论

我已使用用户提供的测试 key 仅做本地调试验证，且未写入仓库文件。

已确认：

- `POST /api/actions/users/getUsers` 可直接用 `Authorization: Bearer <key>` 调通
- `POST /api/actions/users/getUserLimitUsage` 可获取用户当日额度用量
- `GET /api/v1/me/quota` 可返回完整的用户/Key 配额快照
- `GET /api/v1/users/{id}/limit-usage:all` 可直接返回：
  - `limitDaily.usage / limitDaily.limit`
  - `limitTotal.usage / limitTotal.limit`

对测试 key 来说，更稳定且最贴近网页“用户配额使用区域”的路径是：

1. `getUsers` → 获取 `userId`
2. `GET /api/v1/users/{id}/limit-usage:all` → 读取日额度/总额度
3. 如该接口不可用，再回退 `GET /api/v1/me/quota`

同时也确认：

- `POST /api/actions/keys/getKeyLimitUsage`
- `GET /api/v1/keys/{keyId}/limit-usage`

对这个测试 key 会返回 `401`，因此不能把“总额度”主路径建立在 key 级限额接口上。

## 安装

要求：

- Node.js `>= 18`

安装依赖：

```bash
npm install
```

构建：

```bash
npm run build
```

## 配置

配置文件查找顺序：

1. `--config` 显式指定
2. `./nightyu-usage.yaml`
3. `./nightyu-usage.yml`
4. `~/.config/nightyu-usage/config.yaml`
5. `~/.config/nightyu-usage/config.yml`

示例配置：

```yaml
baseUrl: "https://api.nightyu.com"

keys:
  - alias: "工作Key"
    key: "sk-your-first-key"
  - alias: "个人Key"
    key: "sk-your-second-key"
```

说明：

- 配置项名为 `key`
- 当前实现也兼容旧字段 `token`，但 README 与示例统一以 `key` 为准
- 不要把真实 key 提交到仓库

## 用法

开发运行：

```bash
npm run dev -- --help
```

直接运行：

```bash
npm run dev
```

构建后运行：

```bash
node dist/index.js
```

常用参数：

```bash
nightyu-usage --config ./nightyu-usage.yaml
nightyu-usage --alias 工作Key
nightyu-usage -l
nightyu-usage -cc 工作Key
nightyu-usage -cx 工作Key
nightyu-usage --json
nightyu-usage --timeout 8000
```

其中：

- `-l` 等同于直接输出当前命中的配置文件内容
- `-cc <key或alias>` 会把 `~/.claude/settings.json` 里的 `ANTHROPIC_AUTH_TOKEN` 切到配置中对应的 key
- `-cx <key或alias>` 会把 `~/.codex/auth.json` 里的 `OPENAI_API_KEY` 切到配置中对应的 key

## 输出

表格输出：

```text
nightyu-usage v0.1.0

别名        日额度              总额度
──────────  ──────────────────  ──────────────────
工作Key     $6.06 / 无限制      $104.05 / $200.00
个人Key     $0.50 / $3.00       $12.00 / 无限制

更新时间: 2026-06-02 11:00:00
```

JSON 输出会包含：

- `alias`
- `userName`
- `keyName`
- `dailyUsed`
- `dailyLimit`
- `totalUsed`
- `totalLimit`
- `dataSource`

## 实现策略

对每个配置项：

1. 调用 `POST /api/actions/users/getUsers`，请求体 `{ "includeUsage": true }`
2. 用 key 掩码匹配当前 key，拿到 `userId`
3. 优先调用 `GET /api/v1/users/{id}/limit-usage:all`
4. 若失败，则回退调用 `GET /api/v1/me/quota`
5. 若仍失败，则回退 `POST /api/actions/users/getUserLimitUsage`

说明：

- 第 3 步最贴近网页“用户配额使用区域”
- 第 5 步只能稳定拿到“日额度用量”，拿不到“总额度已用”时会退化输出

认证策略：

- 优先 `Authorization: Bearer <key>`
- 若失败，再尝试 `Cookie: auth-token=<key>`

## 验证命令

```bash
npm run typecheck
npm run build
npm run dev -- --help
```

若你已经在本地创建配置文件：

```bash
npm run dev -- --config ./nightyu-usage.yaml
```

## 调试说明

可用以下命令单独验证接口：

```bash
curl -X POST https://api.nightyu.com/api/actions/users/getUsers \
  -H "Authorization: Bearer <YOUR_KEY>" \
  -H "Content-Type: application/json" \
  -d '{"includeUsage": true}'
```

```bash
curl https://api.nightyu.com/api/v1/me/quota \
  -H "Authorization: Bearer <YOUR_KEY>"
```

```bash
curl https://api.nightyu.com/api/v1/users/<USER_ID>/limit-usage:all \
  -H "Authorization: Bearer <YOUR_KEY>"
```

## 本次加载的规则 / 技能

- 未发现仓库内 `.claude/rules/`
- 已加载技能：`code-security`、`native-data-fetching`
