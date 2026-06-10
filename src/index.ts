#!/usr/bin/env node

import { Command } from "commander";
import {
  fetchMeQuota,
  fetchUserLimitUsage,
  fetchUserLimitUsageAll,
  fetchUsersWithUsage,
  findMatchingKey,
} from "./api.js";
import { loadConfig } from "./config.js";
import { CliError } from "./errors.js";
import { readConfigFile, switchClaudeAuthToken, switchCodexAuthToken } from "./local-auth.js";
import { renderJson, renderTable } from "./display.js";
import type { AliasUsageFailure, AliasUsageResult, AliasUsageSuccess, ConfigKeyEntry } from "./types.js";
import { maskToken } from "./utils.js";

interface CliOptions {
  config?: string;
  alias?: string[];
  json?: boolean;
  listConfig?: boolean;
  claudeKey?: string;
  codexKey?: string;
  timeout?: string;
}

function normalizeCliArgv(argv: string[]): string[] {
  const normalized = argv.slice(0, 2);
  let passthrough = false;

  for (const arg of argv.slice(2)) {
    if (passthrough) {
      normalized.push(arg);
      continue;
    }

    if (arg === "--") {
      passthrough = true;
      normalized.push(arg);
      continue;
    }

    if (arg === "-cc") {
      normalized.push("--claude-key");
      continue;
    }

    if (arg.startsWith("-cc=")) {
      normalized.push(`--claude-key=${arg.slice(4)}`);
      continue;
    }

    if (arg === "-cx") {
      normalized.push("--codex-key");
      continue;
    }

    if (arg.startsWith("-cx=")) {
      normalized.push(`--codex-key=${arg.slice(4)}`);
      continue;
    }

    normalized.push(arg);
  }

  return normalized;
}

function parseTimeout(input: string | undefined): number {
  if (!input) {
    return 5000;
  }
  const parsed = Number(input);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new CliError(`--timeout 非法：${input}`, "INVALID_ARGUMENT");
  }
  return parsed;
}

async function fetchOne(
  baseUrl: string,
  entry: ConfigKeyEntry,
  timeoutMs: number
): Promise<AliasUsageResult> {
  const keyMask = maskToken(entry.key);

  try {
    const { users } = await fetchUsersWithUsage(baseUrl, entry.key, { timeoutMs });
    const matched = findMatchingKey(users, entry.key);

    try {
      const { usage } = await fetchUserLimitUsageAll(baseUrl, entry.key, matched.user.id, { timeoutMs });
      const success: AliasUsageSuccess = {
        alias: entry.alias,
        keyMask,
        userName: matched.user.name,
        keyName: matched.key.name,
        userId: matched.user.id,
        dailyUsed: usage.limitDaily.usage,
        dailyLimit: usage.limitDaily.limit,
        totalUsed: usage.limitTotal.usage,
        totalLimit: usage.limitTotal.limit,
        fetchedAt: new Date().toISOString(),
        dataSource: "user-limit-usage-all",
      };
      return { ok: true, value: success };
    } catch {}

    try {
      const { quota } = await fetchMeQuota(baseUrl, entry.key, { timeoutMs });
      const success: AliasUsageSuccess = {
        alias: entry.alias,
        keyMask,
        userName: quota.userName || matched.user.name,
        keyName: quota.keyName || matched.key.name,
        userId: matched.user.id,
        dailyUsed: quota.userCurrentDailyUsd,
        dailyLimit: quota.userLimitDailyUsd,
        totalUsed: quota.userCurrentTotalUsd,
        totalLimit: quota.userLimitTotalUsd,
        fetchedAt: new Date().toISOString(),
        dataSource: "me-quota",
      };
      return { ok: true, value: success };
    } catch {}

    const { usage } = await fetchUserLimitUsage(baseUrl, entry.key, matched.user.id, { timeoutMs });

    const success: AliasUsageSuccess = {
      alias: entry.alias,
      keyMask,
      userName: matched.user.name,
      keyName: matched.key.name,
      userId: matched.user.id,
      dailyUsed: usage.dailyCost?.current ?? matched.key.todayUsage,
      dailyLimit: usage.dailyCost?.limit ?? matched.key.limitDailyUsd,
      totalUsed: Number.NaN,
      totalLimit: matched.user.limitTotalUsd ?? matched.key.limitTotalUsd,
      fetchedAt: new Date().toISOString(),
      dataSource: "getUsers+userLimitUsage",
    };

    return { ok: true, value: success };
  } catch (error) {
    const failure: AliasUsageFailure = {
      alias: entry.alias,
      keyMask,
      error: error instanceof Error ? error.message : String(error),
    };
    return { ok: false, value: failure };
  }
}

async function main(): Promise<void> {
  const program = new Command();
  program
    .name("nightyu-usage")
    .description("查看多个 nightyu / Claude Code Hub token 的日额度与总额度使用情况")
    .option("-c, --config <path>", "指定配置文件路径")
    .option("-a, --alias <alias...>", "仅查询指定 alias，可传多个")
    .option("-l, --list-config", "直接输出当前配置文件内容")
    .option("--claude-key <keyOrAlias>", "切换 ~/.claude/settings.json 的 ANTHROPIC_AUTH_TOKEN，也支持短写 -cc")
    .option("--codex-key <keyOrAlias>", "切换 ~/.codex/auth.json 的 OPENAI_API_KEY，也支持短写 -cx")
    .option("--json", "以 JSON 输出")
    .option("--timeout <ms>", "单次请求超时毫秒数，默认 5000");

  program.parse(normalizeCliArgv(process.argv));
  const options = program.opts<CliOptions>();

  const actionCount = [options.listConfig, Boolean(options.claudeKey), Boolean(options.codexKey)].filter(Boolean).length;
  if (actionCount > 1) {
    throw new CliError("`-l`、`-cc`、`-cx` 不能同时使用", "INVALID_ARGUMENT");
  }

  if (options.listConfig) {
    const { content } = readConfigFile(options.config);
    process.stdout.write(content.endsWith("\n") ? content : `${content}\n`);
    return;
  }

  if (options.claudeKey) {
    const result = switchClaudeAuthToken(options.claudeKey, options.config);
    console.log(
      `已切换 Claude 凭据为 ${result.alias} (${result.keyMask})，来源配置：${result.sourceConfigPath}，目标文件：${result.targetPath}`
    );
    return;
  }

  if (options.codexKey) {
    const result = switchCodexAuthToken(options.codexKey, options.config);
    console.log(
      `已切换 Codex 凭据为 ${result.alias} (${result.keyMask})，来源配置：${result.sourceConfigPath}，目标文件：${result.targetPath}`
    );
    return;
  }

  const timeoutMs = parseTimeout(options.timeout);
  const { path: configPath, config } = loadConfig(options.config);

  const aliasFilter = options.alias && options.alias.length > 0 ? new Set(options.alias) : null;
  const selectedKeys = aliasFilter
    ? config.keys.filter((entry) => aliasFilter.has(entry.alias))
    : config.keys;

  if (selectedKeys.length === 0) {
    throw new CliError(
      aliasFilter
        ? `配置文件 ${configPath} 中没有匹配 --alias 的条目`
        : `配置文件 ${configPath} 中没有可用 key 条目`,
      "NO_KEYS"
    );
  }

  const results = await Promise.all(selectedKeys.map((entry) => fetchOne(config.baseUrl, entry, timeoutMs)));
  const successes = results.filter((item): item is { ok: true; value: AliasUsageSuccess } => item.ok).map((item) => item.value);
  const failures = results.filter((item): item is { ok: false; value: AliasUsageFailure } => !item.ok).map((item) => item.value);

  const output = options.json ? renderJson(successes, failures) : renderTable(successes, failures);
  console.log(output);

  if (failures.length === 0) {
    process.exitCode = 0;
    return;
  }

  process.exitCode = successes.length > 0 ? 1 : 2;
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`错误: ${message}`);
  process.exitCode = 2;
});
