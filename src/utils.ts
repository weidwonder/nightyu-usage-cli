import os from "node:os";
import path from "node:path";

export function expandHome(filePath: string): string {
  if (filePath === "~") {
    return os.homedir();
  }
  if (filePath.startsWith("~/")) {
    return path.join(os.homedir(), filePath.slice(2));
  }
  return filePath;
}

export function normalizeBaseUrl(baseUrl: string): string {
  return baseUrl.replace(/\/+$/, "");
}

export function maskToken(token: string): string {
  if (!token || token.length <= 8) {
    return "••••••";
  }
  return `${token.slice(0, 4)}••••••${token.slice(-4)}`;
}

export function formatUsd(value: number | null): string {
  if (value === null) {
    return "无限制";
  }
  return `$${value.toFixed(2)}`;
}

export function formatQuota(used: number, limit: number | null): string {
  if (limit === null) {
    return `${formatUsd(used)} / 无限制`;
  }
  return `${formatUsd(used)} / ${formatUsd(limit)}`;
}

export function formatTimestamp(date: Date): string {
  const formatter = new Intl.DateTimeFormat("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });

  const parts = formatter.formatToParts(date);
  const get = (type: string) => parts.find((part) => part.type === type)?.value ?? "";
  return `${get("year")}-${get("month")}-${get("day")} ${get("hour")}:${get("minute")}:${get("second")}`;
}

export function padRight(value: string, width: number): string {
  if (value.length >= width) {
    return value;
  }
  return value + " ".repeat(width - value.length);
}
