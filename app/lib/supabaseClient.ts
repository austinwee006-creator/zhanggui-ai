"use client";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

// 单例 Supabase 浏览器客户端。
// 缺少环境变量时返回 null，整个 App 自动降级为纯本地（localStorage）模式，
// 这样 demo 不接云端也能跑，老板注册功能则在配好 env 后自动开启。
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

let client: SupabaseClient | null = null;

export function getSupabase(): SupabaseClient | null {
  if (typeof window === "undefined") return null;
  if (!url || !anonKey) return null;
  if (!client) {
    client = createClient(url, anonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    });
  }
  return client;
}

// 是否已配置云端（用于 UI 判断要不要显示注册/登入）
export function isCloudEnabled(): boolean {
  return Boolean(url && anonKey);
}
