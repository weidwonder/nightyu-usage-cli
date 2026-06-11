# CLAUDE.md

## 项目概述

nightyu-usage-cli 是一个 CLI 工具，用于批量查询 nightyu / Claude Code Hub API key 的额度用量，并支持快速切换 Claude Code / Codex 本地凭据。

## 技术栈

- Node.js >= 18, TypeScript, ESM (`"type": "module"`)
- commander (CLI 解析), yaml (配置解析)
- 无测试框架（暂无测试）

## 常用命令

```bash
npm run dev           # tsx 开发运行
npm run build         # tsc 编译到 dist/
npm run typecheck     # 类型检查（不生成文件）
npm run dev -- --help # 查看 CLI 帮助
```

## 项目结构

```
src/
  index.ts       # CLI 入口，参数解析，主流程编排
  api.ts         # nightyu API 请求封装
  config.ts      # YAML 配置文件加载与校验
  local-auth.ts  # 本地凭据读写（Claude settings.json / Codex auth.json）
  display.ts     # 表格 / JSON 输出格式化
  types.ts       # 所有接口类型定义
  errors.ts      # CliError 自定义错误
  utils.ts       # 通用工具函数（掩码、格式化、路径展开等）
```

## 约定

- 配置字段用 `key`，兼容旧字段 `token`
- API 认证优先 Bearer，回退 Cookie
- 用量获取有三级回退：limit-usage:all → me/quota → getUserLimitUsage
- `-cc` / `-cx` 是 `--claude-key` / `--codex-key` 的自定义短写，在 `normalizeCliArgv` 中手动展开（非 commander 原生别名）
- 所有用户可见文本使用中文
