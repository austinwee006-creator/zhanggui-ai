"use client";

import {
  bookingRecordStorageKey,
  customerRecordStorageKey,
  dailyClosingStorageKey,
  inventoryStorageKey,
  legacyOrderRecordStorageKey,
  operationTaskStorageKey,
  orderRecordStorageKey,
  posConnectionSettingsStorageKey,
  posImportStorageKey,
  staffShiftStorageKey,
  supplierPurchaseRecordStorageKey,
  supplierRecordStorageKey,
} from "./businessRecords";
import { languageStorageKey } from "./i18n";
import { restaurantProfileStorageKey } from "./restaurantProfile";

export const backupVersion = 1;

export const backupDataItems = [
  { key: restaurantProfileStorageKey, label: "品牌资料" },
  { key: orderRecordStorageKey, label: "订单" },
  { key: legacyOrderRecordStorageKey, label: "旧订单备份" },
  { key: customerRecordStorageKey, label: "客户" },
  { key: dailyClosingStorageKey, label: "结算" },
  { key: inventoryStorageKey, label: "库存" },
  { key: staffShiftStorageKey, label: "员工" },
  { key: operationTaskStorageKey, label: "营运任务" },
  { key: bookingRecordStorageKey, label: "预订" },
  { key: supplierRecordStorageKey, label: "供应商" },
  { key: supplierPurchaseRecordStorageKey, label: "采购/欠款" },
  { key: posImportStorageKey, label: "POS 导入" },
  { key: posConnectionSettingsStorageKey, label: "POS 接入" },
  { key: languageStorageKey, label: "语言" },
] as const;

export type BackupPayload = {
  app: "zhanggui-ai";
  version: number;
  exportedAt: string;
  data: Record<string, string | null>;
};

export function canUseBrowserStorage() {
  return typeof window !== "undefined" && typeof window.localStorage !== "undefined";
}

export function getStoredRecordCount(key: string) {
  if (!canUseBrowserStorage()) return 0;
  const raw = window.localStorage.getItem(key);
  if (!raw) return 0;

  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.length : 1;
  } catch {
    return 1;
  }
}

export function createBackupPayload(): BackupPayload {
  const data = backupDataItems.reduce<Record<string, string | null>>((acc, item) => {
    acc[item.key] = canUseBrowserStorage() ? window.localStorage.getItem(item.key) : null;
    return acc;
  }, {});

  return {
    app: "zhanggui-ai",
    version: backupVersion,
    exportedAt: new Date().toISOString(),
    data,
  };
}

export function downloadBackupFile(payload: BackupPayload) {
  if (typeof window === "undefined") return;

  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `zhanggui-ai-backup-${payload.exportedAt.slice(0, 10)}.json`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.URL.revokeObjectURL(url);
}

export function parseBackupFile(text: string): BackupPayload {
  const parsed = JSON.parse(text) as Partial<BackupPayload>;
  if (parsed.app !== "zhanggui-ai" || !parsed.data || typeof parsed.data !== "object") {
    throw new Error("Invalid Zhanggui AI backup file");
  }

  return {
    app: "zhanggui-ai",
    version: Number(parsed.version) || backupVersion,
    exportedAt: parsed.exportedAt || new Date().toISOString(),
    data: parsed.data as Record<string, string | null>,
  };
}

export function restoreBackupPayload(payload: BackupPayload) {
  if (!canUseBrowserStorage()) return;

  backupDataItems.forEach((item) => {
    const value = payload.data[item.key];
    if (typeof value === "string") {
      window.localStorage.setItem(item.key, value);
    } else if (value === null) {
      window.localStorage.removeItem(item.key);
    }
  });
}

export function clearBusinessData() {
  if (!canUseBrowserStorage()) return;

  backupDataItems
    .filter((item) => item.key !== languageStorageKey)
    .forEach((item) => window.localStorage.removeItem(item.key));
}
