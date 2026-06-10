export interface ConfigKeyEntry {
  alias: string;
  key: string;
}

export interface AppConfig {
  baseUrl: string;
  keys: ConfigKeyEntry[];
}

export interface UsageKeySummary {
  id: number;
  name: string;
  maskedKey: string;
  status: "enabled" | "disabled";
  todayUsage: number;
  todayCallCount: number;
  todayTokens: number;
  limitDailyUsd: number | null;
  limitTotalUsd: number | null;
  lastUsedAt: string | null;
  lastProviderName: string | null;
}

export interface UsageUserSummary {
  id: number;
  name: string;
  limitTotalUsd?: number | null;
  keys: UsageKeySummary[];
}

export interface UsersResponseBody {
  ok: boolean;
  data?: UsageUserSummary[];
  error?: string;
  errorCode?: string;
}

export interface UserLimitUsageResponseBody {
  ok: boolean;
  data?: {
    rpm?: { current: number; limit: number | null; window: string };
    dailyCost?: { current: number; limit: number | null; resetAt?: string };
    activeSessions?: number;
    concurrentSessions?: { current: number; limit: number | null };
    currentConcurrentSessions?: number;
  };
  error?: string;
  errorCode?: string;
}

export interface MeQuotaResponseBody {
  keyLimit5hUsd: number | null;
  keyLimitDailyUsd: number | null;
  keyLimitWeeklyUsd: number | null;
  keyLimitMonthlyUsd: number | null;
  keyLimitTotalUsd: number | null;
  keyCurrent5hUsd: number;
  keyCurrentDailyUsd: number;
  keyCurrentWeeklyUsd: number;
  keyCurrentMonthlyUsd: number;
  keyCurrentTotalUsd: number;
  userLimit5hUsd: number | null;
  userLimitDailyUsd: number | null;
  userLimitWeeklyUsd: number | null;
  userLimitMonthlyUsd: number | null;
  userLimitTotalUsd: number | null;
  userCurrent5hUsd: number;
  userCurrentDailyUsd: number;
  userCurrentWeeklyUsd: number;
  userCurrentMonthlyUsd: number;
  userCurrentTotalUsd: number;
  userName: string;
  keyName: string;
}

export interface UserLimitUsageAllResponseBody {
  limit5h: { usage: number; limit: number | null };
  limitDaily: { usage: number; limit: number | null };
  limitWeekly: { usage: number; limit: number | null };
  limitMonthly: { usage: number; limit: number | null };
  limitTotal: { usage: number; limit: number | null };
}

export interface AliasUsageSuccess {
  alias: string;
  keyMask: string;
  userName: string;
  keyName: string;
  userId: number;
  dailyUsed: number;
  dailyLimit: number | null;
  totalUsed: number;
  totalLimit: number | null;
  fetchedAt: string;
  dataSource: "user-limit-usage-all" | "me-quota" | "getUsers+userLimitUsage";
}

export interface AliasUsageFailure {
  alias: string;
  keyMask: string;
  error: string;
}

export type AliasUsageResult =
  | { ok: true; value: AliasUsageSuccess }
  | { ok: false; value: AliasUsageFailure };
