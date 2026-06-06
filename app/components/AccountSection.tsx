"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useLanguage } from "./LanguageProvider";
import { getSupabase, isCloudEnabled } from "../lib/supabaseClient";
import { clearCloudBusinessData, clearLocalBusinessData, getCurrentTenantProfile, pushAllLocalToCloud, type TenantProfile } from "../lib/cloudSync";

export default function AccountSection() {
  const router = useRouter();
  const { language } = useLanguage();
  const isEnglish = language === "en";
  const cloud = isCloudEnabled();
  const [email, setEmail] = useState<string | null>(null);
  const [tenantProfile, setTenantProfile] = useState<TenantProfile | null>(null);
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);
  const [installReady, setInstallReady] = useState(false);
  const [standalone, setStandalone] = useState(false);

  useEffect(() => {
    const sb = getSupabase();
    if (!sb) return;
    sb.auth.getUser().then(({ data }) => setEmail(data.user?.email ?? null));
    getCurrentTenantProfile().then(setTenantProfile);
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const nav = window.navigator as Navigator & { standalone?: boolean };
      setInstallReady("serviceWorker" in navigator);
      setStandalone(window.matchMedia("(display-mode: standalone)").matches || Boolean(nav.standalone));
    }, 0);

    return () => window.clearTimeout(timer);
  }, []);

  const uploadLocal = async () => {
    if (busy) return;
    if (tenantProfile && !tenantProfile.isOwner) {
      setStatus(isEnglish ? "Only the owner can upload local data to cloud" : "只有老板账号可以上传本机资料到云端");
      return;
    }
    setBusy(true);
    setStatus("");
    const ok = await pushAllLocalToCloud();
    setStatus(ok ? (isEnglish ? "Local data uploaded to cloud" : "已把本机资料上传云端") : isEnglish ? "Upload failed. Please confirm you are signed in." : "上传失败，请确认已登入");
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

  const changePassword = () => {
    router.push("/login?reset=1");
  };

  const clearCloud = async () => {
    if (busy) return;
    if (tenantProfile && !tenantProfile.isOwner) {
      setStatus(isEnglish ? "Only the owner can clear cloud data" : "只有老板账号可以清除云端资料");
      return;
    }
    const confirmed = window.confirm(
      isEnglish
        ? "Clear cloud business data? This deletes orders, customers, cashbook, inventory, staff, bookings and supplier data. Download a backup first."
        : "确定清除云端业务资料？这会删除订单、客户、账目、库存、员工、预订和供应商资料。请先下载备份。"
    );
    if (!confirmed) return;

    setBusy(true);
    setStatus("");
    const ok = await clearCloudBusinessData();
    setStatus(ok ? (isEnglish ? "Cloud and local business data cleared" : "已清除云端和本机业务资料") : isEnglish ? "Clear failed. Please confirm you are signed in." : "清除失败，请确认已登入云端帐号");
    setBusy(false);
  };

  const checks = [
    {
      label: isEnglish ? "Cross-device Data" : "跨电脑资料",
      value: email ? (isEnglish ? "Enabled" : "已开启") : cloud ? (isEnglish ? "Enabled after login" : "登入帐号后开启") : isEnglish ? "Cloud not connected" : "未接云端",
      tone: email ? "good" : "warn",
    },
    {
      label: isEnglish ? "Customer Demo" : "客户演示",
      value: cloud ? (isEnglish ? "Demo available" : "可用 demo 进入") : isEnglish ? "Internal test only" : "只适合内部试用",
      tone: cloud ? "good" : "warn",
    },
    {
      label: isEnglish ? "Installable App" : "安装使用",
      value: standalone ? (isEnglish ? "Installed" : "已安装") : installReady ? (isEnglish ? "Installable" : "可安装") : isEnglish ? "Browser use" : "浏览器使用",
      tone: installReady ? "good" : "neutral",
    },
    {
      label: isEnglish ? "Backup Reminder" : "备份提醒",
      value: email ? (isEnglish ? "Cloud syncing" : "云端同步中") : isEnglish ? "Download backup" : "请下载备份",
      tone: email ? "good" : "warn",
    },
  ];
  const isOwner = tenantProfile?.isOwner !== false;

  return (
    <section className="rounded-2xl bg-white dark:bg-stone-900/60 border border-stone-200/70 dark:border-stone-800 p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold text-stone-900 dark:text-stone-100">{isEnglish ? "Account" : "帐号"}</h2>
          <p className="mt-1 text-xs leading-5 text-stone-400">
            {!cloud
              ? isEnglish
                ? "Cloud is not connected. Data only stays on this device."
                : "目前未接云端，资料只存这台设备。"
              : email
              ? isEnglish
                ? `Signed in as ${email}. ${tenantProfile?.isOwner === false ? "Staff account" : "Owner account"}; data syncs to cloud.`
                : `已登入：${email}（${tenantProfile?.isOwner === false ? "员工账号" : "老板账号"}，资料已云端同步）`
              : isEnglish
              ? "Demo / local mode. Data is not syncing to cloud yet."
              : "目前为 demo / 本机模式，资料尚未云端同步。"}
          </p>
        </div>
        {status && (
          <span className="shrink-0 rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] font-medium text-emerald-600 dark:bg-emerald-950/30 dark:text-emerald-300">
            {status}
          </span>
        )}
      </div>

      <div className="mt-4 grid grid-cols-2 gap-2">
        {checks.map((check) => (
          <div key={check.label} className="rounded-xl bg-stone-100 px-3 py-2 dark:bg-stone-950">
            <p className="text-[11px] text-stone-400">{check.label}</p>
            <p
              className={`mt-0.5 text-xs font-semibold ${
                check.tone === "good"
                  ? "text-emerald-600 dark:text-emerald-300"
                  : check.tone === "warn"
                  ? "text-amber-600 dark:text-amber-300"
                  : "text-stone-600 dark:text-stone-300"
              }`}
            >
              {check.value}
            </p>
          </div>
        ))}
      </div>

      {cloud && (
        <div className="mt-4 grid grid-cols-2 gap-2">
          {email && (
            <>
              {isOwner && (
                <button
                  onClick={uploadLocal}
                  disabled={busy}
                  className="rounded-xl border border-stone-200 px-3 py-2.5 text-xs font-semibold text-stone-600 disabled:opacity-50 dark:border-stone-700 dark:text-stone-300"
                >
                  {isEnglish ? "Upload local data to cloud" : "上传本机资料到云端"}
                </button>
              )}
              <button
                onClick={changePassword}
                disabled={busy}
                className={`${isOwner ? "" : "col-span-2"} rounded-xl border border-stone-200 px-3 py-2.5 text-xs font-semibold text-stone-600 disabled:opacity-50 dark:border-stone-700 dark:text-stone-300`}
              >
                {isEnglish ? "Change password" : "更改密码"}
              </button>
              {isOwner ? (
                <button
                  onClick={clearCloud}
                  disabled={busy}
                  className="col-span-2 rounded-xl border border-red-100 px-3 py-2.5 text-xs font-semibold text-red-500 disabled:opacity-50 dark:border-red-900/60 dark:text-red-300"
                >
                  {isEnglish ? "Clear cloud business data" : "清除云端业务资料"}
                </button>
              ) : (
                <p className="col-span-2 rounded-xl bg-stone-100 px-3 py-2.5 text-xs leading-5 text-stone-500 dark:bg-stone-950 dark:text-stone-400">
                  {isEnglish ? "Staff accounts cannot clear cloud data or overwrite the store cloud copy." : "员工账号不能清除云端资料，也不能用本机资料覆盖店铺云端资料。"}
                </p>
              )}
            </>
          )}
          <button
            onClick={logout}
            disabled={busy}
            className="col-span-2 rounded-xl border border-red-100 px-3 py-2.5 text-xs font-semibold text-red-500 disabled:opacity-50 dark:border-red-900/60 dark:text-red-300"
          >
            {email ? (isEnglish ? "Sign out" : "登出") : isEnglish ? "Back to login" : "返回登入页"}
          </button>
        </div>
      )}
    </section>
  );
}
