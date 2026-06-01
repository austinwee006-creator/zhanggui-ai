"use client";

import { getSupabase } from "./supabaseClient";

// 需要在云端同步的业务资料 key（语言偏好等纯 UI 设定不同步）。
// 与 businessRecords.ts / restaurantProfile.ts 的 storageKey 保持一致。
export const SYNC_KEYS = [
  "zg_order_records_v2",
  "zg_customer_records_v1",
  "zg_daily_closing_records_v1",
  "zg_inventory_items_v1",
  "zg_staff_shift_records_v1",
  "zg_booking_records_v1",
  "zg_supplier_records_v1",
  "zg_supplier_purchase_records_v1",
  "zg_operation_task_records_v1",
  "zg_restaurant_profile_v2",
] as const;

const SYNC_KEY_SET = new Set<string>(SYNC_KEYS);

let tenantIdCache: string | null = null;
const pushTimers = new Map<string, ReturnType<typeof setTimeout>>();

// 取得当前帐号的 tenant_id；profile 不存在时补建（客户端安全网，trigger 也会建）。
async function getTenantId(): Promise<string | null> {
  if (tenantIdCache) return tenantIdCache;
  const sb = getSupabase();
  if (!sb) return null;

  const {
    data: { session },
  } = await sb.auth.getSession();
  if (!session) return null;

  const userId = session.user.id;
  const { data } = await sb.from("profiles").select("tenant_id").eq("user_id", userId).maybeSingle();

  if (data?.tenant_id) {
    tenantIdCache = data.tenant_id as string;
    return tenantIdCache;
  }

  // 没有 profile：建立一个，tenant_id 默认 = 自己的 user id（餐厅老板）
  await sb.from("profiles").insert({ user_id: userId, tenant_id: userId, email: session.user.email });
  tenantIdCache = userId;
  return tenantIdCache;
}

export function resetTenantCache() {
  tenantIdCache = null;
}

// 登入后：把本地业务资料「精确镜像」成云端的样子，避免上一个帐号的资料残留。
// 拉取失败（断网）时不动本地，保证离线可用。返回是否成功 hydrate。
export async function hydrateFromCloud(): Promise<boolean> {
  const sb = getSupabase();
  if (!sb || typeof window === "undefined") return false;

  const tenantId = await getTenantId();
  if (!tenantId) return false;

  const { data, error } = await sb.from("data_documents").select("key,payload").eq("tenant_id", tenantId);
  if (error || !data) return false;

  const cloudByKey = new Map<string, unknown>();
  for (const row of data) {
    if (SYNC_KEY_SET.has(row.key)) cloudByKey.set(row.key, row.payload);
  }

  for (const key of SYNC_KEYS) {
    try {
      if (cloudByKey.has(key)) {
        localStorage.setItem(key, JSON.stringify(cloudByKey.get(key)));
      } else {
        localStorage.removeItem(key);
      }
    } catch {
      /* ignore quota / serialization errors */
    }
  }
  return true;
}

// 每次本地写入后调用：防抖（按 key）后 upsert 到云端。未登入/未配置则静默跳过。
export function pushDocument(key: string, value: unknown) {
  if (typeof window === "undefined") return;
  if (!SYNC_KEY_SET.has(key)) return;
  const sb = getSupabase();
  if (!sb) return;

  const existing = pushTimers.get(key);
  if (existing) clearTimeout(existing);

  pushTimers.set(
    key,
    setTimeout(async () => {
      pushTimers.delete(key);
      const tenantId = await getTenantId();
      if (!tenantId) return;
      try {
        await sb.from("data_documents").upsert(
          { tenant_id: tenantId, key, payload: value, updated_at: new Date().toISOString() },
          { onConflict: "tenant_id,key" }
        );
      } catch {
        /* 离线时静默失败，资料仍在本地，下次写入或重连后再推 */
      }
    }, 600)
  );
}

// 登出：清掉本地业务资料，避免下一个登入者看到上一个人的资料。
export function clearLocalBusinessData() {
  if (typeof window === "undefined") return;
  for (const key of SYNC_KEYS) {
    try {
      localStorage.removeItem(key);
    } catch {
      /* ignore */
    }
  }
  resetTenantCache();
}

// 手动把目前本机资料整批上传到云端（给「把现有资料搬上云」的场景用）。
export async function pushAllLocalToCloud(): Promise<boolean> {
  const sb = getSupabase();
  if (!sb || typeof window === "undefined") return false;
  const tenantId = await getTenantId();
  if (!tenantId) return false;

  const rows: { tenant_id: string; key: string; payload: unknown; updated_at: string }[] = [];
  for (const key of SYNC_KEYS) {
    const raw = localStorage.getItem(key);
    if (!raw) continue;
    try {
      rows.push({ tenant_id: tenantId, key, payload: JSON.parse(raw), updated_at: new Date().toISOString() });
    } catch {
      /* skip malformed */
    }
  }
  if (rows.length === 0) return true;
  const { error } = await sb.from("data_documents").upsert(rows, { onConflict: "tenant_id,key" });
  return !error;
}
