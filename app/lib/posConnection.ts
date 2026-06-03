export const posConnectionSettingsStorageKey = "zg_pos_connection_settings_v1";

export type PosConnectionSettings = {
  enabled: boolean;
  sourceName: string;
  tokenHash: string;
  tokenHint: string;
  createdAt: string;
  rotatedAt: string;
  notes: string;
};

export function normalizePosConnectionSettings(payload: unknown): PosConnectionSettings | null {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) return null;

  const record = payload as Partial<PosConnectionSettings>;
  return {
    enabled: record.enabled === true,
    sourceName: stringValue(record.sourceName) || "POS API",
    tokenHash: stringValue(record.tokenHash),
    tokenHint: stringValue(record.tokenHint),
    createdAt: stringValue(record.createdAt) || new Date().toISOString(),
    rotatedAt: stringValue(record.rotatedAt),
    notes: stringValue(record.notes),
  };
}

export function hasActivePosToken(settings: PosConnectionSettings | null) {
  return Boolean(settings?.enabled && settings.tokenHash);
}

function stringValue(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}
