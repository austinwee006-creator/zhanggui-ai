"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!password.trim() || loading) return;

    setLoading(true);
    setError("");

    try {
      const res = await fetch("/api/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });

      if (res.ok) {
        router.replace("/");
      } else {
        setError("密码错误，请重试");
        setPassword("");
      }
    } catch {
      setError("连线失败，请重试");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col items-center justify-center h-full bg-stone-50 dark:bg-[#111110] px-6">
      <div className="w-full max-w-xs">
        <div className="flex flex-col items-center mb-8">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center shadow-lg mb-4">
            <span className="text-white text-2xl font-bold leading-none">掌</span>
          </div>
          <h1 className="text-xl font-semibold text-stone-900 dark:text-stone-100">掌柜 AI</h1>
          <p className="text-sm text-stone-400 mt-1">输入访问密码继续</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3">
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="访问密码"
            autoFocus
            disabled={loading}
            className="w-full px-4 py-3 rounded-2xl border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-900/50 text-sm text-stone-900 dark:text-stone-100 placeholder-stone-400 focus:outline-none focus:border-amber-400/70 dark:focus:border-amber-500/50 transition-colors text-center tracking-widest disabled:opacity-50"
          />

          {error && (
            <p className="text-xs text-red-500 text-center">{error}</p>
          )}

          <button
            type="submit"
            disabled={!password.trim() || loading}
            className={`w-full py-3 rounded-2xl text-sm font-semibold transition-all ${
              password.trim() && !loading
                ? "bg-gradient-to-r from-amber-400 to-orange-500 text-white shadow-sm hover:opacity-90 active:scale-[0.98]"
                : "bg-stone-100 dark:bg-stone-800 text-stone-300 dark:text-stone-600 cursor-not-allowed"
            }`}
          >
            {loading ? "验证中..." : "进入"}
          </button>
        </form>
      </div>
    </div>
  );
}
