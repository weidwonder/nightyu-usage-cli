import { HttpError } from "./errors.js";
import type {
  MeQuotaResponseBody,
  UserLimitUsageAllResponseBody,
  UserLimitUsageResponseBody,
  UsageKeySummary,
  UsageUserSummary,
  UsersResponseBody,
} from "./types.js";
import { maskToken, normalizeBaseUrl } from "./utils.js";

interface RequestOptions {
  timeoutMs: number;
}

type AuthMode = "bearer" | "cookie";

interface RequestSuccess<T> {
  body: T;
  authMode: AuthMode;
}

function isUnauthorizedStatus(status: number): boolean {
  return status === 401 || status === 403;
}

async function parseText(response: Response): Promise<string> {
  try {
    return await response.text();
  } catch {
    return "";
  }
}

async function requestJson<T>(
  url: string,
  token: string,
  body: Record<string, unknown>,
  options: RequestOptions,
  method: "GET" | "POST" = "POST"
): Promise<RequestSuccess<T>> {
  const modes: AuthMode[] = ["bearer", "cookie"];
  let lastError: Error | null = null;

  for (const mode of modes) {
    try {
      const parsed = await requestJsonWithMode<T>(url, token, body, mode, options, method);
      return { body: parsed, authMode: mode };
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      if (error instanceof HttpError && !isUnauthorizedStatus(error.status)) {
        throw error;
      }
    }
  }

  throw (
    lastError ??
    new Error(`请求失败：${url}，token=${maskToken(token)}，请检查 token 是否有效`)
  );
}

async function requestJsonWithMode<T>(
  url: string,
  token: string,
  body: Record<string, unknown>,
  mode: AuthMode,
  options: RequestOptions,
  method: "GET" | "POST"
): Promise<T> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), options.timeoutMs);

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Accept: "application/json",
  };

  if (mode === "bearer") {
    headers.Authorization = `Bearer ${token}`;
  } else {
    headers.Cookie = `auth-token=${token}`;
  }

  try {
    const response = await fetch(url, {
      method,
      headers,
      body: method === "POST" ? JSON.stringify(body) : undefined,
      signal: controller.signal,
    });

    const text = await parseText(response);
    if (!response.ok) {
      throw new HttpError(
        `HTTP ${response.status} ${response.statusText}：${text || "无响应内容"}`,
        response.status,
        text
      );
    }

    try {
      return JSON.parse(text) as T;
    } catch (error) {
      throw new Error(
        `接口返回了非 JSON 内容：${error instanceof Error ? error.message : "未知解析错误"}`
      );
    }
  } finally {
    clearTimeout(timeout);
  }
}

export async function fetchUsersWithUsage(
  baseUrl: string,
  token: string,
  options: RequestOptions
): Promise<{ users: UsageUserSummary[]; authMode: AuthMode }> {
  const url = `${normalizeBaseUrl(baseUrl)}/api/actions/users/getUsers`;
  const { body, authMode } = await requestJson<UsersResponseBody>(
    url,
    token,
    { includeUsage: true },
    options
  );

  if (!body.ok) {
    throw new Error(body.error || "获取用户信息失败");
  }

  if (!Array.isArray(body.data)) {
    throw new Error("getUsers 响应缺少 data 数组");
  }

  return {
    users: body.data,
    authMode,
  };
}

export async function fetchUserLimitUsage(
  baseUrl: string,
  token: string,
  userId: number,
  options: RequestOptions
): Promise<{ usage: NonNullable<UserLimitUsageResponseBody["data"]>; authMode: AuthMode }> {
  const url = `${normalizeBaseUrl(baseUrl)}/api/actions/users/getUserLimitUsage`;
  const { body, authMode } = await requestJson<UserLimitUsageResponseBody>(
    url,
    token,
    { userId },
    options
  );

  if (!body.ok) {
    throw new Error(body.error || `获取 userId=${userId} 用户日额度失败`);
  }

  if (!body.data) {
    throw new Error(`getUserLimitUsage 未返回 data，userId=${userId}`);
  }

  return {
    usage: body.data,
    authMode,
  };
}

export async function fetchMeQuota(
  baseUrl: string,
  token: string,
  options: RequestOptions
): Promise<{ quota: MeQuotaResponseBody; authMode: AuthMode }> {
  const url = `${normalizeBaseUrl(baseUrl)}/api/v1/me/quota`;
  const { body, authMode } = await requestJson<MeQuotaResponseBody>(url, token, {}, options, "GET");
  return { quota: body, authMode };
}

export async function fetchUserLimitUsageAll(
  baseUrl: string,
  token: string,
  userId: number,
  options: RequestOptions
): Promise<{ usage: UserLimitUsageAllResponseBody; authMode: AuthMode }> {
  const url = `${normalizeBaseUrl(baseUrl)}/api/v1/users/${userId}/limit-usage:all`;
  const { body, authMode } = await requestJson<UserLimitUsageAllResponseBody>(
    url,
    token,
    {},
    options,
    "GET"
  );
  return { usage: body, authMode };
}

export function findMatchingKey(users: UsageUserSummary[], token: string): {
  user: UsageUserSummary;
  key: UsageKeySummary;
} {
  const expectedMask = maskToken(token);
  const matches: Array<{ user: UsageUserSummary; key: UsageKeySummary }> = [];

  for (const user of users) {
    for (const key of user.keys) {
      if (key.maskedKey === expectedMask) {
        matches.push({ user, key });
      }
    }
  }

  if (matches.length === 0) {
    throw new Error(
      `未在 getUsers 返回结果中找到 maskedKey=${expectedMask}。这通常表示：1) token 无法访问该用户；2) 配置的不是对应登录 token；3) 站点掩码规则已变化`
    );
  }

  if (matches.length > 1) {
    throw new Error(
      `找到多个 maskedKey=${expectedMask} 的 key，无法唯一匹配。建议改用更明确的 token，或后续扩展配置增加 keyName 进行辅助匹配`
    );
  }

  return matches[0];
}
