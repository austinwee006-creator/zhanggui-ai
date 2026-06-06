"use client";

import { useEffect, useState } from "react";
import { getCurrentTenantProfile, hydrateFromCloud, resetTenantCache, type TenantProfile } from "../lib/cloudSync";
import { getSupabase, isCloudEnabled } from "../lib/supabaseClient";

type InviteResponse = {
  code?: string;
  expiresAt?: string;
  error?: string;
};

export default function TeamSection() {
  const cloud = isCloudEnabled();
  const [profile, setProfile] = useState<TenantProfile | null>(null);
  const [inviteCode, setInviteCode] = useState("");
  const [joinCode, setJoinCode] = useState("");
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!cloud) return;
    getCurrentTenantProfile().then(setProfile);
  }, [cloud]);

  const createInvite = async () => {
    if (busy) return;
    setBusy(true);
    setStatus("");

    const accessToken = await getAccessToken();
    if (!accessToken) {
      setStatus("请先登入正式云端账号。");
      setBusy(false);
      return;
    }

    const response = await fetch("/api/team/invite", {
      method: "POST",
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    const data = (await response.json().catch(() => ({}))) as InviteResponse;

    if (!response.ok || !data.code) {
      setStatus(data.error || "生成邀请码失败。");
    } else {
      setInviteCode(data.code);
      setStatus(`员工邀请码已生成，${data.expiresAt ? `${formatDate(data.expiresAt)} 前有效。` : "7 天内有效。"}`);
    }
    setBusy(false);
  };

  const acceptInvite = async () => {
    if (busy || !joinCode.trim()) return;
    setBusy(true);
    setStatus("");

    const accessToken = await getAccessToken();
    if (!accessToken) {
      setStatus("请先登入正式云端账号。");
      setBusy(false);
      return;
    }

    const response = await fetch("/api/team/accept", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ code: joinCode.trim() }),
    });
    const data = (await response.json().catch(() => ({}))) as InviteResponse;

    if (!response.ok) {
      setStatus(data.error || "加入店铺失败。");
      setBusy(false);
      return;
    }

    resetTenantCache();
    await hydrateFromCloud();
    setProfile(await getCurrentTenantProfile());
    setJoinCode("");
    setStatus("已加入店铺，资料已同步。");
    setBusy(false);
  };

  if (!cloud) return null;

  const isOwner = profile?.isOwner === true;
  const isStaff = profile && !profile.isOwner;

  return (
    <section className="rounded-2xl border border-stone-200/70 bg-white p-4 dark:border-stone-800 dark:bg-stone-900/60">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold text-stone-900 dark:text-stone-100">团队账号</h2>
          <p className="mt-1 text-xs leading-5 text-stone-400">
            {isOwner
              ? "老板可以邀请员工加入同一家店，员工用自己的邮箱登入。"
              : isStaff
              ? "你是员工账号，可以读取这家店的云端资料。"
              : "登入正式云端账号后，可管理团队邀请。"}
          </p>
        </div>
        <span className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-semibold ${isOwner ? "bg-emerald-50 text-emerald-600 dark:bg-emerald-950/30 dark:text-emerald-300" : "bg-stone-100 text-stone-500 dark:bg-stone-950 dark:text-stone-300"}`}>
          {isOwner ? "老板" : isStaff ? "员工" : "未登入"}
        </span>
      </div>

      {isOwner && (
        <div className="mt-4 space-y-3 border-t border-stone-100 pt-3 dark:border-stone-800">
          <button onClick={createInvite} disabled={busy} className="w-full rounded-xl bg-stone-900 px-3 py-2.5 text-xs font-semibold text-white disabled:opacity-50 dark:bg-stone-100 dark:text-stone-950">
            {busy ? "处理中..." : "生成员工邀请码"}
          </button>
          {inviteCode && (
            <div className="rounded-xl bg-stone-100 px-3 py-2 dark:bg-stone-950">
              <p className="text-[11px] text-stone-400">复制给员工</p>
              <p className="mt-1 font-mono text-lg font-semibold tracking-wide text-stone-900 dark:text-stone-100">{inviteCode}</p>
            </div>
          )}
        </div>
      )}

      {!isOwner && (
        <div className="mt-4 grid grid-cols-[1fr_auto] gap-2 border-t border-stone-100 pt-3 dark:border-stone-800">
          <input
            value={joinCode}
            onChange={(event) => setJoinCode(event.target.value.toUpperCase())}
            placeholder="输入老板给的邀请码"
            disabled={busy}
            className="min-w-0 rounded-xl border border-stone-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-amber-400 disabled:opacity-50 dark:border-stone-700 dark:bg-stone-950"
          />
          <button onClick={acceptInvite} disabled={busy || !joinCode.trim()} className="rounded-xl bg-amber-400 px-3 py-2.5 text-xs font-semibold text-stone-950 disabled:opacity-40">
            加入
          </button>
        </div>
      )}

      {status && <p className="mt-3 rounded-xl bg-stone-100 px-3 py-2 text-xs leading-5 text-stone-500 dark:bg-stone-950 dark:text-stone-400">{status}</p>}
    </section>
  );
}

async function getAccessToken() {
  const sb = getSupabase();
  if (!sb) return "";
  const { data } = await sb.auth.getSession();
  return data.session?.access_token ?? "";
}

function formatDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toISOString().slice(0, 10);
}
