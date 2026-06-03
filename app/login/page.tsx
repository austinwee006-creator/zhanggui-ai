"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getSupabase, isCloudEnabled } from "../lib/supabaseClient";
import { hydrateFromCloud, pushDocumentNow, resetTenantCache } from "../lib/cloudSync";
import {
  defaultRestaurantProfile,
  loadRestaurantProfile,
  restaurantProfileStorageKey,
  saveRestaurantProfile,
  type RestaurantProfile,
} from "../lib/restaurantProfile";

type AuthMode = "login" | "register";
type Mode = AuthMode | "reset" | "new-password";
const AUTH_MODES: AuthMode[] = ["login", "register"];
const pendingRegistrationProfileKey = "zg_pending_registration_profile_v1";

export default function LoginPage() {
  const router = useRouter();
  const cloud = isCloudEnabled();

  const [mode, setMode] = useState<Mode>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [restaurantName, setRestaurantName] = useState("");
  const [signature, setSignature] = useState("");
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [loading, setLoading] = useState(false);

  // 共享密码（降级模式或内部登入）
  const [sharedOpen, setSharedOpen] = useState(false);
  const [sharedPassword, setSharedPassword] = useState("");

  useEffect(() => {
    if (!cloud) return;

    const sb = getSupabase();
    if (!sb) return;

    const timer = window.setTimeout(() => {
      const params = new URLSearchParams(window.location.search);
      if (params.get("reset") === "1" || window.location.hash.includes("type=recovery")) {
        setMode("new-password");
        setError("");
        setInfo("请输入新密码。");
      }
    }, 0);

    const { data } = sb.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") {
        setMode("new-password");
        setError("");
        setInfo("请输入新密码。");
      }
    });

    return () => {
      window.clearTimeout(timer);
      data.subscription.unsubscribe();
    };
  }, [cloud]);

  async function setGateAndEnter(payload: Record<string, unknown>) {
    const res = await fetch("/api/auth", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!res.ok) throw new Error("登入验证失败");
  }

  const handleCloudAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading || !email.trim() || !password.trim()) return;
    const sb = getSupabase();
    if (!sb) return;

    setLoading(true);
    setError("");
    setInfo("");

    try {
      let accessToken: string | null = null;

      if (mode === "register") {
        const onboardingProfile = buildOnboardingProfile(restaurantName, signature);
        const { data, error: err } = await sb.auth.signUp({
          email: email.trim(),
          password,
          options: {
            data: {
              restaurant_name: onboardingProfile.name,
              restaurant_signature: onboardingProfile.signature,
            },
          },
        });
        if (err) {
          setError(err.message);
          return;
        }
        if (!data.session) {
          savePendingRegistrationProfile(email.trim(), onboardingProfile);
          // 开启了 email 验证：提示去信箱确认
          setInfo("注册成功，请到邮箱点击确认信后再登入。");
          setMode("login");
          return;
        }
        accessToken = data.session.access_token;
        if (data.user) {
          await sb.from("profiles").upsert(
            {
              user_id: data.user.id,
              tenant_id: data.user.id,
              email: data.user.email,
              restaurant_name: onboardingProfile.name || null,
            },
            { onConflict: "user_id" }
          );
        }
      } else {
        const { data, error: err } = await sb.auth.signInWithPassword({
          email: email.trim(),
          password,
        });
        if (err) {
          setError("邮箱或密码错误");
          return;
        }
        accessToken = data.session?.access_token ?? null;
      }

      if (!accessToken) {
        const { data } = await sb.auth.getSession();
        accessToken = data.session?.access_token ?? null;
      }

      if (!accessToken) {
        setError("登入已完成，但账号验证未建立，请重新登入。");
        return;
      }

      // 已有 session：设 gate cookie → 拉云端资料 → 进入
      resetTenantCache();
      await setGateAndEnter({ authed: true, accessToken });
      await hydrateFromCloud();
      if (mode === "register") {
        await applyOnboardingProfile(buildOnboardingProfile(restaurantName, signature));
      } else {
        await applyOnboardingProfile(takePendingRegistrationProfile(email.trim()));
      }
      router.replace("/");
    } catch {
      setError("登入验证失败，请重试");
    } finally {
      setLoading(false);
    }
  };

  const handleResetRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading || !email.trim()) return;
    const sb = getSupabase();
    if (!sb) return;

    setLoading(true);
    setError("");
    setInfo("");

    try {
      const { error: err } = await sb.auth.resetPasswordForEmail(email.trim(), {
        redirectTo: `${window.location.origin}/login?reset=1`,
      });

      if (err) {
        setError("重设邮件发送失败，请确认邮箱后重试。");
        return;
      }

      setInfo("已发送重设密码邮件，请到邮箱点击链接。");
      setPassword("");
    } catch {
      setError("连线失败，请重试");
    } finally {
      setLoading(false);
    }
  };

  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading) return;
    const sb = getSupabase();
    if (!sb) return;

    if (newPassword.length < 8) {
      setError("新密码至少 8 个字符。");
      return;
    }
    if (newPassword !== confirmPassword) {
      setError("两次输入的新密码不一致。");
      return;
    }

    setLoading(true);
    setError("");
    setInfo("");

    try {
      const { data: sessionData } = await sb.auth.getSession();
      if (!sessionData.session) {
        setError("重设链接已过期，请重新发送邮件。");
        setMode("reset");
        return;
      }

      const { error: err } = await sb.auth.updateUser({ password: newPassword });
      if (err) {
        setError("密码更新失败，请重试。");
        return;
      }

      resetTenantCache();
      await setGateAndEnter({ authed: true, accessToken: sessionData.session.access_token });
      await hydrateFromCloud();
      router.replace("/");
    } catch {
      setError("密码更新失败，请重试。");
    } finally {
      setLoading(false);
    }
  };

  const handleDemo = async () => {
    if (loading) return;
    setLoading(true);
    setError("");
    try {
      await setGateAndEnter({ demo: true });
      router.replace("/");
    } catch {
      setError("连线失败，请重试");
      setLoading(false);
    }
  };

  const handleShared = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading || !sharedPassword.trim()) return;
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: sharedPassword }),
      });
      if (res.ok) {
        router.replace("/");
      } else {
        setError("密码错误，请重试");
        setSharedPassword("");
        setLoading(false);
      }
    } catch {
      setError("连线失败，请重试");
      setLoading(false);
    }
  };

  const inputCls =
    "w-full px-4 py-3 rounded-2xl border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-900/50 text-sm text-stone-900 dark:text-stone-100 placeholder-stone-400 focus:outline-none focus:border-amber-400/70 dark:focus:border-amber-500/50 transition-colors disabled:opacity-50";
  const primaryBtn = (enabled: boolean) =>
    `w-full py-3 rounded-2xl text-sm font-semibold transition-all ${
      enabled
        ? "bg-gradient-to-r from-amber-400 to-orange-500 text-white shadow-sm hover:opacity-90 active:scale-[0.98]"
        : "bg-stone-100 dark:bg-stone-800 text-stone-300 dark:text-stone-600 cursor-not-allowed"
    }`;

  return (
    <div className="flex flex-col items-center justify-center h-full bg-stone-50 dark:bg-[#111110] px-6 overflow-y-auto py-10">
      <div className="w-full max-w-xs">
        <div className="flex flex-col items-center mb-8">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center shadow-lg mb-4">
            <span className="text-white text-2xl font-bold leading-none">掌</span>
          </div>
          <h1 className="text-xl font-semibold text-stone-900 dark:text-stone-100">掌柜 AI</h1>
          <p className="text-sm text-stone-400 mt-1">
            {cloud ? "餐厅老板的 AI 生意助手" : "输入访问密码继续"}
          </p>
        </div>

        {cloud ? (
          <>
            {/* 登入 / 注册 切换 */}
            {mode !== "reset" && mode !== "new-password" && (
              <div className="flex rounded-2xl bg-stone-100 dark:bg-stone-800 p-1 mb-4">
                {AUTH_MODES.map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => {
                      setMode(m);
                      setError("");
                      setInfo("");
                    }}
                    className={`flex-1 py-2 rounded-xl text-sm font-medium transition-all ${
                      mode === m
                        ? "bg-white dark:bg-stone-900 text-stone-900 dark:text-stone-100 shadow-sm"
                        : "text-stone-400"
                    }`}
                  >
                    {m === "login" ? "登入" : "注册"}
                  </button>
                ))}
              </div>
            )}

            {mode === "reset" ? (
              <form onSubmit={handleResetRequest} className="space-y-3">
                <div className="text-center">
                  <h2 className="text-sm font-semibold text-stone-900 dark:text-stone-100">重设密码</h2>
                  <p className="mt-1 text-xs leading-5 text-stone-400">输入注册邮箱，我们会发送重设链接。</p>
                </div>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="邮箱"
                  autoComplete="email"
                  disabled={loading}
                  className={inputCls}
                />
                {error && <p className="text-xs text-red-500 text-center">{error}</p>}
                {info && <p className="text-xs text-emerald-600 dark:text-emerald-400 text-center">{info}</p>}
                <button
                  type="submit"
                  disabled={!email.trim() || loading}
                  className={primaryBtn(Boolean(email.trim() && !loading))}
                >
                  {loading ? "发送中..." : "发送重设邮件"}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setMode("login");
                    setError("");
                    setInfo("");
                  }}
                  className="w-full text-xs font-medium text-stone-400 hover:text-stone-600 dark:hover:text-stone-200"
                >
                  返回登入
                </button>
              </form>
            ) : mode === "new-password" ? (
              <form onSubmit={handleUpdatePassword} className="space-y-3">
                <div className="text-center">
                  <h2 className="text-sm font-semibold text-stone-900 dark:text-stone-100">设置新密码</h2>
                  <p className="mt-1 text-xs leading-5 text-stone-400">新密码设置后，可在任何电脑登入同一帐号。</p>
                </div>
                <input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="新密码"
                  autoComplete="new-password"
                  disabled={loading}
                  className={inputCls}
                />
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="再次输入新密码"
                  autoComplete="new-password"
                  disabled={loading}
                  className={inputCls}
                />
                {error && <p className="text-xs text-red-500 text-center">{error}</p>}
                {info && <p className="text-xs text-emerald-600 dark:text-emerald-400 text-center">{info}</p>}
                <button
                  type="submit"
                  disabled={!newPassword || !confirmPassword || loading}
                  className={primaryBtn(Boolean(newPassword && confirmPassword && !loading))}
                >
                  {loading ? "更新中..." : "更新密码并进入"}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setMode("login");
                    setError("");
                    setInfo("");
                  }}
                  className="w-full text-xs font-medium text-stone-400 hover:text-stone-600 dark:hover:text-stone-200"
                >
                  返回登入
                </button>
              </form>
            ) : (
              <form onSubmit={handleCloudAuth} className="space-y-3">
                {mode === "register" && (
                  <>
                    <input
                      type="text"
                      value={restaurantName}
                      onChange={(e) => setRestaurantName(e.target.value)}
                      placeholder="餐厅/品牌名称"
                      autoComplete="organization"
                      disabled={loading}
                      className={inputCls}
                    />
                    <input
                      type="text"
                      value={signature}
                      onChange={(e) => setSignature(e.target.value)}
                      placeholder="主推产品/服务（可选）"
                      disabled={loading}
                      className={inputCls}
                    />
                  </>
                )}
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="邮箱"
                  autoComplete="email"
                  disabled={loading}
                  className={inputCls}
                />
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="密码"
                  autoComplete={mode === "register" ? "new-password" : "current-password"}
                  disabled={loading}
                  className={inputCls}
                />

                {error && <p className="text-xs text-red-500 text-center">{error}</p>}
                {info && <p className="text-xs text-emerald-600 dark:text-emerald-400 text-center">{info}</p>}

                <button
                  type="submit"
                  disabled={!canSubmitCloudAuth(mode, email, password, restaurantName) || loading}
                  className={primaryBtn(Boolean(canSubmitCloudAuth(mode, email, password, restaurantName) && !loading))}
                >
                  {loading ? "处理中..." : mode === "login" ? "登入" : "注册并进入"}
                </button>
                {mode === "login" && (
                  <button
                    type="button"
                    onClick={() => {
                      setMode("reset");
                      setError("");
                      setInfo("");
                    }}
                    className="w-full text-xs font-medium text-stone-400 hover:text-stone-600 dark:hover:text-stone-200"
                  >
                    忘记密码？
                  </button>
                )}
              </form>
            )}

            <div className="flex items-center gap-3 my-5">
              <div className="flex-1 h-px bg-stone-200 dark:bg-stone-800" />
              <span className="text-[11px] text-stone-400">或</span>
              <div className="flex-1 h-px bg-stone-200 dark:bg-stone-800" />
            </div>

            <button
              type="button"
              onClick={handleDemo}
              disabled={loading}
              className="w-full py-3 rounded-2xl text-sm font-medium border border-stone-200 dark:border-stone-700 text-stone-600 dark:text-stone-300 hover:bg-stone-100 dark:hover:bg-stone-800 transition-colors disabled:opacity-50"
            >
              先看看 · demo 一键进入
            </button>

            <button
              type="button"
              onClick={() => setSharedOpen((v) => !v)}
              className="w-full mt-3 text-[11px] text-stone-400 hover:text-stone-500"
            >
              用内部密码登入
            </button>
            {sharedOpen && (
              <form onSubmit={handleShared} className="space-y-3 mt-3">
                <input
                  type="password"
                  value={sharedPassword}
                  onChange={(e) => setSharedPassword(e.target.value)}
                  placeholder="内部访问密码"
                  disabled={loading}
                  className={`${inputCls} text-center tracking-widest`}
                />
                <button
                  type="submit"
                  disabled={!sharedPassword.trim() || loading}
                  className={primaryBtn(Boolean(sharedPassword.trim() && !loading))}
                >
                  进入
                </button>
              </form>
            )}
          </>
        ) : (
          // 降级模式：未配置 Supabase，沿用单一密码
          <form onSubmit={handleShared} className="space-y-3">
            <input
              type="password"
              value={sharedPassword}
              onChange={(e) => setSharedPassword(e.target.value)}
              placeholder="访问密码"
              autoFocus
              disabled={loading}
              className={`${inputCls} text-center tracking-widest`}
            />
            {error && <p className="text-xs text-red-500 text-center">{error}</p>}
            <button
              type="submit"
              disabled={!sharedPassword.trim() || loading}
              className={primaryBtn(Boolean(sharedPassword.trim() && !loading))}
            >
              {loading ? "验证中..." : "进入"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}

function canSubmitCloudAuth(mode: Mode, email: string, password: string, restaurantName: string) {
  if (!email.trim() || !password.trim()) return false;
  if (mode === "register" && !restaurantName.trim()) return false;
  return true;
}

function buildOnboardingProfile(restaurantName: string, signature: string): RestaurantProfile {
  return {
    ...defaultRestaurantProfile,
    name: restaurantName.trim(),
    signature: signature.trim(),
    tone: "亲切、专业、直接成交",
  };
}

async function applyOnboardingProfile(profile: RestaurantProfile | null) {
  if (!profile || (!profile.name.trim() && !profile.signature.trim())) return;

  const current = loadRestaurantProfile();
  const next: RestaurantProfile = {
    ...current,
    name: current.name.trim() || profile.name,
    signature: current.signature.trim() || profile.signature,
    tone: current.tone.trim() || profile.tone,
  };

  saveRestaurantProfile(next);
  await pushDocumentNow(restaurantProfileStorageKey, next);
}

function savePendingRegistrationProfile(email: string, profile: RestaurantProfile) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(
      pendingRegistrationProfileKey,
      JSON.stringify({ email: email.trim().toLowerCase(), profile })
    );
  } catch {
    /* ignore storage failures */
  }
}

function takePendingRegistrationProfile(email: string): RestaurantProfile | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(pendingRegistrationProfileKey);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { email?: string; profile?: Partial<RestaurantProfile> };
    if (parsed.email !== email.trim().toLowerCase()) return null;
    window.localStorage.removeItem(pendingRegistrationProfileKey);
    return { ...defaultRestaurantProfile, ...parsed.profile };
  } catch {
    return null;
  }
}
