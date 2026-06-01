"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getSupabase, isCloudEnabled } from "../lib/supabaseClient";
import { clearLocalBusinessData, pushAllLocalToCloud } from "../lib/cloudSync";

export default function AccountSection() {
  const router = useRouter();
  const cloud = isCloudEnabled();
  const [email, setEmail] = useState<string | null>(null);
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const sb = getSupabase();
    if (!sb) return;
    sb.auth.getUser().then(({ data }) => setEmail(data.user?.email ?? null));
  }, []);

  const uploadLocal = async () => {
    if (busy) return;
    setBusy(true);
    setStatus("");
    const ok = await pushAllLocalToCloud();
    setStatus(ok ? "已把本机资料上传云端" : "上传失败，请确认已登入");
    setBusy(false);
  };

  const logout = async () => {
    if (busy) return;
    setBusy(true);
    const sb = getSupabase();
    if (sb) await sb.auth.signOut().catch(() => undefined);
    clearLocalBusinessData();
    await fetch("/api/auth", { method: "DELETE" }).catch(() => undefined);
    router.replace("/login");
  };

  return (
    <section className="rounded-2xl bg-white dark:bg-stone-900/60 border border-stone-200/70 dark:border-stone-800 p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold text-stone-900 dark:text-stone-100">帐号</h2>
          <p className="mt-1 text-xs leading-5 text-stone-400">
            {!cloud
              ? "目前未接云端，资料只存这台设备。"
              : email
              ? `已登入：${email}（资料已云端同步，换设备登入同帐号即可看到）`
              : "目前为 demo / 本机模式，资料尚未云端同步。"}
          </p>
        </div>
        {status && (
          <span className="shrink-0 rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] font-medium text-emerald-600 dark:bg-emerald-950/30 dark:text-emerald-300">
            {status}
          </span>
        )}
      </div>

      {cloud && (
        <div className="mt-4 grid grid-cols-2 gap-2">
          {email && (
            <button
              onClick={uploadLocal}
              disabled={busy}
              className="rounded-xl border border-stone-200 px-3 py-2.5 text-xs font-semibold text-stone-600 disabled:opacity-50 dark:border-stone-700 dark:text-stone-300"
            >
              上传本机资料到云端
            </button>
          )}
          <button
            onClick={logout}
            disabled={busy}
            className={`rounded-xl border border-red-100 px-3 py-2.5 text-xs font-semibold text-red-500 disabled:opacity-50 dark:border-red-900/60 dark:text-red-300 ${
              email ? "" : "col-span-2"
            }`}
          >
            {email ? "登出" : "返回登入页"}
          </button>
        </div>
      )}
    </section>
  );
}
