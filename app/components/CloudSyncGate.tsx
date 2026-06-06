"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { getSupabase, isCloudEnabled } from "../lib/supabaseClient";
import { clearLocalBusinessData, hydrateFromCloud, resetTenantCache } from "../lib/cloudSync";

// 在渲染受保护页面前，先把云端资料同步到本地（让页面 useState 读到最新资料）。
// 登入页不 gate（无需同步）；未配置 Supabase 或未登入时立即渲染（纯本地/demo 模式）。
export default function CloudSyncGate({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isLogin = pathname === "/login";
  const cloudEnabled = isCloudEnabled();
  const [readyPathname, setReadyPathname] = useState(() => (isLogin || !cloudEnabled ? pathname : ""));
  const ready = isLogin || !cloudEnabled || readyPathname === pathname;

  useEffect(() => {
    if (isLogin) return;
    const sb = getSupabase();
    if (!sb) return;

    let cancelled = false;
    // 兜底：hydrate 卡住也不要白屏超过 4 秒
    const fallback = setTimeout(() => !cancelled && setReadyPathname(pathname), 4000);

    sb.auth.getSession().then(async ({ data: { session } }) => {
      if (session) await hydrateFromCloud();
      if (!cancelled) {
        clearTimeout(fallback);
        setReadyPathname(pathname);
      }
    });

    const { data: sub } = sb.auth.onAuthStateChange(async (event) => {
      if (event === "SIGNED_OUT") {
        clearLocalBusinessData();
        return;
      }
      if (event === "SIGNED_IN" || event === "TOKEN_REFRESHED") {
        resetTenantCache();
        await hydrateFromCloud();
      }
    });

    return () => {
      cancelled = true;
      clearTimeout(fallback);
      sub.subscription.unsubscribe();
    };
  }, [isLogin, pathname]);

  if (isLogin) return <>{children}</>;

  if (!ready) {
    return (
      <div className="flex flex-col items-center justify-center h-full bg-stone-50 dark:bg-[#111110] gap-3">
        <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center shadow-lg animate-pulse">
          <span className="text-white text-lg font-bold leading-none">掌</span>
        </div>
        <p className="text-xs text-stone-400">同步资料中…</p>
      </div>
    );
  }

  return <>{children}</>;
}
