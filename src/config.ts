import fs from "node:fs";
import path from "node:path";
import YAML from "yaml";
import { CliError } from "./errors.js";
import type { AppConfig, ConfigKeyEntry } from "./types.js";
import { expandHome, normalizeBaseUrl } from "./utils.js";

const DEFAULT_CONFIG_CANDIDATES = [
  "./nightyu-usage.yaml",
  "./nightyu-usage.yml",
  "~/.config/nightyu-usage/config.yaml",
  "~/.config/nightyu-usage/config.yml",
];

function validateKeyEntry(entry: unknown, index: number): ConfigKeyEntry {
  if (!entry || typeof entry !== "object") {
    throw new CliError(`配置文件中 keys[${index}] 不是有效对象`, "CONFIG_INVALID");
  }

  const maybeAlias = "alias" in entry ? entry.alias : undefined;
  const maybeKey = "key" in entry ? entry.key : "token" in entry ? entry.token : undefined;

  if (typeof maybeAlias !== "string" || maybeAlias.trim() === "") {
    throw new CliError(`配置文件中 keys[${index}].alias 缺失或为空`, "CONFIG_INVALID");
  }

  if (typeof maybeKey !== "string" || maybeKey.trim() === "") {
    throw new CliError(`配置文件中 keys[${index}].key 缺失或为空`, "CONFIG_INVALID");
  }

  const key = maybeKey.trim();
  if (!/^[\x20-\x7E]+$/.test(key)) {
    throw new CliError(
      `配置文件中 keys[${index}].key 包含非 ASCII 字符，请替换为真实 API key`,
      "CONFIG_INVALID"
    );
  }

  return {
    alias: maybeAlias.trim(),
    key,
  };
}

export function resolveConfigPath(explicitPath?: string): string {
  const candidates = explicitPath ? [explicitPath] : DEFAULT_CONFIG_CANDIDATES;

  for (const candidate of candidates) {
    const expanded = expandHome(candidate);
    const absolutePath = path.resolve(expanded);
    if (fs.existsSync(absolutePath)) {
      return absolutePath;
    }
  }

  throw new CliError(
    explicitPath
      ? `未找到配置文件：${explicitPath}`
      : `未找到配置文件。请创建 ${DEFAULT_CONFIG_CANDIDATES[0]}，或使用 --config 指定路径`,
    "CONFIG_NOT_FOUND"
  );
}

export function loadConfig(explicitPath?: string): { path: string; config: AppConfig } {
  const resolvedPath = resolveConfigPath(explicitPath);
  const content = fs.readFileSync(resolvedPath, "utf8");

  let parsed: unknown;
  try {
    parsed = YAML.parse(content);
  } catch (error) {
    throw new CliError(
      `配置文件 YAML 解析失败：${error instanceof Error ? error.message : "未知错误"}`,
      "CONFIG_INVALID"
    );
  }

  if (!parsed || typeof parsed !== "object") {
    throw new CliError("配置文件内容不能为空", "CONFIG_INVALID");
  }

  const baseUrlCandidate =
    "baseUrl" in parsed
      ? parsed.baseUrl
      : "base_url" in parsed
        ? parsed.base_url
        : undefined;

  if (typeof baseUrlCandidate !== "string" || baseUrlCandidate.trim() === "") {
    throw new CliError("配置文件缺少 baseUrl/base_url", "CONFIG_INVALID");
  }

  let url: URL;
  try {
    url = new URL(baseUrlCandidate.trim());
  } catch {
    throw new CliError(`baseUrl 非法：${baseUrlCandidate}`, "CONFIG_INVALID");
  }

  if (!["https:", "http:"].includes(url.protocol)) {
    throw new CliError("baseUrl 只支持 http 或 https", "CONFIG_INVALID");
  }

  const keyEntries = "keys" in parsed ? parsed.keys : undefined;
  if (!Array.isArray(keyEntries) || keyEntries.length === 0) {
    throw new CliError("配置文件缺少非空 keys 数组", "CONFIG_INVALID");
  }

  const keys = keyEntries.map((entry, index) => validateKeyEntry(entry, index));
  const aliasSet = new Set<string>();
  for (const item of keys) {
    if (aliasSet.has(item.alias)) {
      throw new CliError(`alias 重复：${item.alias}`, "CONFIG_INVALID");
    }
    aliasSet.add(item.alias);
  }

  return {
    path: resolvedPath,
    config: {
      baseUrl: normalizeBaseUrl(baseUrlCandidate.trim()),
      keys,
    },
  };
}
