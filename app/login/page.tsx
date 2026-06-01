"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { getSupabase, isCloudEnabled } from "../lib/supabaseClient";
import { hydrateFromCloud, resetTenantCache } from "../lib/cloudSync";

type Mode = "login" | "register";

export default function LoginPage() {
  const router = useRouter();
  const cloud = isCloudEnabled();

  const [mode, setMode] = useState<Mode>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [restaurantName, setRestaurantName] = useState("");
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [loading, setLoading] = useState(false);

  // 共享密码（降级模式或内部登入）
  const [sharedOpen, setSharedOpen] = useState(false);
  const [sharedPassword, setSharedPassword] = useState("");

  async function setGateAndEnter(payload: Record<string, unknown>) {
    const res = await fetch("/api/auth", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!res.ok) throw new Error("gate");
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
      if (mode === "register") {
        const { data, error: err } = await sb.auth.signUp({
          email: email.trim(),
          password,
          options: { data: { restaurant_name: restaurantName.trim() } },
        });
        if (err) {
          setError(err.message);
          return;
        }
        if (!data.session) {
          // 开启了 email 验证：提示去信箱确认
          setInfo("注册成功，请到邮箱点击确认信后再登入。");
          setMode("login");
          return;
        }
      } else {
        const { error: err } = await sb.auth.signInWithPassword({
          email: email.trim(),
          password,
        });
        if (err) {
          setError("邮箱或密码错误");
          return;
        }
      }

      // 已有 session：设 gate cookie → 拉云端资料 → 进入
      resetTenantCache();
      await setGateAndEnter({ authed: true });
      await hydrateFromCloud();
      router.replace("/");
    } catch {
      setError("连线失败，请重试");
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
            <div className="flex rounded-2xl bg-stone-100 dark:bg-stone-800 p-1 mb-4">
              {(["login", "register"] as Mode[]).map((m) => (
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

            <form onSubmit={handleCloudAuth} className="space-y-3">
              {mode === "register" && (
                <input
                  type="text"
                  value={restaurantName}
                  onChange={(e) => setRestaurantName(e.target.value)}
                  placeholder="餐厅名称（可选）"
                  disabled={loading}
                  className={inputCls}
                />
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
                disabled={!email.trim() || !password.trim() || loading}
                className={primaryBtn(Boolean(email.trim() && password.trim() && !loading))}
              >
                {loading ? "处理中..." : mode === "login" ? "登入" : "注册并进入"}
              </button>
            </form>

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
