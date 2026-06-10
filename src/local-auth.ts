import fs from "node:fs";
import path from "node:path";
import { loadConfig, resolveConfigPath } from "./config.js";
import { CliError } from "./errors.js";
import type { ConfigKeyEntry } from "./types.js";
import { expandHome, maskToken } from "./utils.js";

type JsonObject = Record<string, unknown>;

const CLAUDE_SETTINGS_PATH = "~/.claude/settings.json";
const CODEX_AUTH_PATH = "~/.codex/auth.json";

export interface AuthSwitchResult {
  alias: string;
  keyMask: string;
  sourceConfigPath: string;
  targetPath: string;
}

export function readConfigFile(explicitPath?: string): { path: string; content: string } {
  const resolvedPath = resolveConfigPath(explicitPath);
  return {
    path: resolvedPath,
    content: fs.readFileSync(resolvedPath, "utf8"),
  };
}

function findConfigEntry(selector: string, explicitPath?: string): { sourceConfigPath: string; entry: ConfigKeyEntry } {
  const normalizedSelector = selector.trim();
  if (normalizedSelector === "") {
    throw new CliError("目标 key 或 alias 不能为空", "INVALID_ARGUMENT");
  }

  const { path: sourceConfigPath, config } = loadConfig(explicitPath);
  const matchedByAlias = config.keys.find((item) => item.alias === normalizedSelector);
  if (matchedByAlias) {
    return { sourceConfigPath, entry: matchedByAlias };
  }

  const matchedByKey = config.keys.find((item) => item.key === normalizedSelector);
  if (matchedByKey) {
    return { sourceConfigPath, entry: matchedByKey };
  }

  throw new CliError(
    `配置文件 ${sourceConfigPath} 中未找到匹配的 alias 或 key：${normalizedSelector}`,
    "KEY_NOT_FOUND"
  );
}

function loadJsonObject(filePath: string): { path: string; json: JsonObject } {
  const resolvedPath = path.resolve(expandHome(filePath));
  if (!fs.existsSync(resolvedPath)) {
    return { path: resolvedPath, json: {} };
  }

  const content = fs.readFileSync(resolvedPath, "utf8").trim();
  if (content === "") {
    return { path: resolvedPath, json: {} };
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(content);
  } catch (error) {
    throw new CliError(
      `JSON 解析失败：${resolvedPath}，${error instanceof Error ? error.message : "未知错误"}`,
      "CONFIG_INVALID"
    );
  }

  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new CliError(`JSON 文件必须是对象：${resolvedPath}`, "CONFIG_INVALID");
  }

  return { path: resolvedPath, json: parsed as JsonObject };
}

function saveJsonObject(filePath: string, json: JsonObject): void {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(json, null, 2)}\n`, "utf8");
}

export function switchClaudeAuthToken(selector: string, explicitPath?: string): AuthSwitchResult {
  const { sourceConfigPath, entry } = findConfigEntry(selector, explicitPath);
  const { path: targetPath, json } = loadJsonObject(CLAUDE_SETTINGS_PATH);

  const envCandidate = json.env;
  if (envCandidate !== undefined && (!envCandidate || typeof envCandidate !== "object" || Array.isArray(envCandidate))) {
    throw new CliError(`~/.claude/settings.json 中的 env 字段必须是对象`, "CONFIG_INVALID");
  }

  const env = (envCandidate ?? {}) as JsonObject;
  env.ANTHROPIC_AUTH_TOKEN = entry.key;
  json.env = env;

  if (Object.prototype.hasOwnProperty.call(json, "ANTHROPIC_AUTH_TOKEN")) {
    json.ANTHROPIC_AUTH_TOKEN = entry.key;
  }

  saveJsonObject(targetPath, json);

  return {
    alias: entry.alias,
    keyMask: maskToken(entry.key),
    sourceConfigPath,
    targetPath,
  };
}

export function switchCodexAuthToken(selector: string, explicitPath?: string): AuthSwitchResult {
  const { sourceConfigPath, entry } = findConfigEntry(selector, explicitPath);
  const { path: targetPath, json } = loadJsonObject(CODEX_AUTH_PATH);

  json.OPENAI_API_KEY = entry.key;
  saveJsonObject(targetPath, json);

  return {
    alias: entry.alias,
    keyMask: maskToken(entry.key),
    sourceConfigPath,
    targetPath,
  };
}
