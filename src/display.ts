import type { AliasUsageFailure, AliasUsageSuccess } from "./types.js";
import { formatQuota, formatTimestamp, padRight } from "./utils.js";

function toWidth(values: string[], minWidth: number): number {
  return Math.max(minWidth, ...values.map((value) => value.length));
}

function formatQuotaDisplay(used: number, limit: number | null): string {
  if (Number.isNaN(used)) {
    return `暂不可得 / ${limit === null ? "无限制" : `$${limit.toFixed(2)}`}`;
  }
  return formatQuota(used, limit);
}

export function renderTable(successes: AliasUsageSuccess[], failures: AliasUsageFailure[]): string {
  const lines: string[] = [];
  lines.push("nightyu-usage v0.1.0");
  lines.push("");

  if (successes.length > 0) {
    const aliasWidth = toWidth(["别名", ...successes.map((item) => item.alias)], 8);
    const dailyWidth = toWidth(
      ["日额度", ...successes.map((item) => formatQuotaDisplay(item.dailyUsed, item.dailyLimit))],
      18
    );
    const totalWidth = toWidth(
      ["总额度", ...successes.map((item) => formatQuotaDisplay(item.totalUsed, item.totalLimit))],
      18
    );

    lines.push(
      `${padRight("别名", aliasWidth)}  ${padRight("日额度", dailyWidth)}  ${padRight("总额度", totalWidth)}`
    );
    lines.push(
      `${"─".repeat(aliasWidth)}  ${"─".repeat(dailyWidth)}  ${"─".repeat(totalWidth)}`
    );

    for (const item of successes) {
      lines.push(
        `${padRight(item.alias, aliasWidth)}  ${padRight(formatQuotaDisplay(item.dailyUsed, item.dailyLimit), dailyWidth)}  ${padRight(formatQuotaDisplay(item.totalUsed, item.totalLimit), totalWidth)}`
      );
    }

    lines.push("");
    lines.push(`更新时间: ${formatTimestamp(new Date())}`);
  }

  if (failures.length > 0) {
    if (successes.length > 0) {
      lines.push("");
    }
    lines.push("错误:");
    for (const item of failures) {
      lines.push(`- ${item.alias} (${item.keyMask}): ${item.error}`);
    }
  }

  return lines.join("\n");
}

export function renderJson(successes: AliasUsageSuccess[], failures: AliasUsageFailure[]): string {
  return JSON.stringify(
    {
      generatedAt: new Date().toISOString(),
      successes,
      failures,
    },
    null,
    2
  );
}
