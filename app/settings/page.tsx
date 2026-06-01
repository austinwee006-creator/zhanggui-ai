"use client";

import { useEffect, useState } from "react";
import { useLanguage } from "../components/LanguageProvider";
import AccountSection from "../components/AccountSection";
import {
  backupDataItems,
  clearBusinessData,
  createBackupPayload,
  downloadBackupFile,
  getStoredRecordCount,
  parseBackupFile,
  restoreBackupPayload,
} from "../lib/dataBackup";
import {
  defaultRestaurantProfile,
  hasConfiguredRestaurantProfile,
  loadRestaurantProfile,
  restaurantProfileSummary,
  saveRestaurantProfile,
  type RestaurantProfile,
} from "../lib/restaurantProfile";

export default function SettingsPage() {
  const { language, setLanguage } = useLanguage();
  const [profile, setProfile] = useState<RestaurantProfile>(defaultRestaurantProfile);
  const [saved, setSaved] = useState(false);
  const [dataVersion, setDataVersion] = useState(0);
  const [backupStatus, setBackupStatus] = useState("");

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setProfile(loadRestaurantProfile());
      setDataVersion((value) => value + 1);
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  const dataCounts = backupDataItems.map((item) => ({
    ...item,
    count: getStoredRecordCount(item.key),
  }));

  const update = (key: keyof RestaurantProfile, value: string) => {
    setProfile((prev) => ({ ...prev, [key]: value }));
    setSaved(false);
  };

  const save = () => {
    saveRestaurantProfile(profile);
    setDataVersion((value) => value + 1);
    setSaved(true);
    setTimeout(() => setSaved(false), 1800);
  };

  const reset = () => {
    setProfile(defaultRestaurantProfile);
    setSaved(false);
  };

  const exportBackup = () => {
    const payload = createBackupPayload();
    downloadBackupFile(payload);
    setBackupStatus("已下载备份文件");
  };

  const restoreBackup = async (file?: File) => {
    if (!file) return;

    try {
      const text = await file.text();
      const payload = parseBackupFile(text);
      restoreBackupPayload(payload);
      setProfile(loadRestaurantProfile());
      setDataVersion((value) => value + 1);
      setBackupStatus("已恢复备份");
    } catch {
      setBackupStatus("备份文件格式不正确");
    }
  };

  const clearData = () => {
    if (!window.confirm("确定清空这台设备的业务数据？请先下载备份。")) return;

    clearBusinessData();
    setProfile(defaultRestaurantProfile);
    setDataVersion((value) => value + 1);
    setBackupStatus("已清空业务数据");
  };

  return (
    <div className="h-full overflow-y-auto bg-stone-50 dark:bg-[#111110]">
      <header className="sticky top-0 z-10 border-b border-stone-200/70 dark:border-stone-800/70 bg-stone-50/90 dark:bg-[#111110]/90 backdrop-blur-md px-4 py-3">
        <h1 className="text-base font-semibold text-stone-900 dark:text-stone-100">品牌资料</h1>
        <p className="text-xs text-stone-400 mt-0.5">让 AI 更像懂你生意的老员工</p>
      </header>

      <main className="px-4 py-5 space-y-5">
        <AccountSection />

        <section data-version={dataVersion} className="rounded-2xl bg-white dark:bg-stone-900/60 border border-stone-200/70 dark:border-stone-800 p-4">
          <h2 className="text-sm font-semibold text-stone-900 dark:text-stone-100">语言 / Language</h2>
          <p className="mt-1 text-xs leading-5 text-stone-400">切换后会套用到整个 app，并保存在这台设备。</p>
          <div className="mt-3 grid grid-cols-2 gap-2">
            <button onClick={() => setLanguage("zh")} className={`rounded-xl px-3 py-2.5 text-sm font-semibold ${language === "zh" ? "bg-stone-900 text-white dark:bg-stone-100 dark:text-stone-950" : "border border-stone-200 text-stone-500 dark:border-stone-700 dark:text-stone-400"}`}>
              中文
            </button>
            <button onClick={() => setLanguage("en")} className={`rounded-xl px-3 py-2.5 text-sm font-semibold ${language === "en" ? "bg-stone-900 text-white dark:bg-stone-100 dark:text-stone-950" : "border border-stone-200 text-stone-500 dark:border-stone-700 dark:text-stone-400"}`}>
              English
            </button>
          </div>
        </section>

        <section className="rounded-2xl bg-white dark:bg-stone-900/60 border border-stone-200/70 dark:border-stone-800 p-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="text-sm font-semibold text-stone-900 dark:text-stone-100">数据备份</h2>
              <p className="mt-1 text-xs leading-5 text-stone-400">
                这个 app 目前使用本地保存，老板换设备或清浏览器前一定要先备份。
              </p>
            </div>
            {backupStatus && (
              <span className="shrink-0 rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] font-medium text-emerald-600 dark:bg-emerald-950/30 dark:text-emerald-300">
                {backupStatus}
              </span>
            )}
          </div>

          <div className="mt-3 grid grid-cols-3 gap-2">
            {dataCounts.map((item) => (
              <div key={item.key} className="rounded-xl bg-stone-100 px-3 py-2 dark:bg-stone-950">
                <p className="truncate text-[11px] text-stone-400">{item.label}</p>
                <p className="mt-0.5 text-sm font-semibold text-stone-900 dark:text-stone-100">{item.count}</p>
              </div>
            ))}
          </div>

          <div className="mt-4 grid grid-cols-3 gap-2">
            <button onClick={exportBackup} className="rounded-xl bg-stone-900 px-3 py-2.5 text-xs font-semibold text-white dark:bg-stone-100 dark:text-stone-950">
              下载备份
            </button>
            <label className="cursor-pointer rounded-xl border border-stone-200 px-3 py-2.5 text-center text-xs font-semibold text-stone-600 dark:border-stone-700 dark:text-stone-300">
              导入恢复
              <input
                type="file"
                accept="application/json,.json"
                className="hidden"
                onChange={(event) => {
                  restoreBackup(event.target.files?.[0]);
                  event.currentTarget.value = "";
                }}
              />
            </label>
            <button onClick={clearData} className="rounded-xl border border-red-100 px-3 py-2.5 text-xs font-semibold text-red-500 dark:border-red-900/60 dark:text-red-300">
              清空业务数据
            </button>
          </div>
        </section>

        {!hasConfiguredRestaurantProfile(profile) && (
          <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 dark:border-amber-900/50 dark:bg-amber-950/30">
            <p className="text-sm font-medium text-amber-700 dark:text-amber-300">先填店名和主推产品</p>
            <p className="mt-1 text-xs leading-5 text-amber-600/90 dark:text-amber-300/80">
              填好后，AI 生成的回复、文案和客源话术才会自动带上你的品牌，不会出现空白占位。
            </p>
          </div>
        )}

        <section className="rounded-2xl bg-white dark:bg-stone-900/60 border border-stone-200/70 dark:border-stone-800 p-4 space-y-4">
          <Field label="品牌/店名" value={profile.name} onChange={(v) => update("name", v)} placeholder="如：咖啡店、甜品店、外卖品牌、catering 品牌名称" />
          <Field label="业态/定位" value={profile.cuisine} onChange={(v) => update("cuisine", v)} placeholder="如：咖啡店、火锅、快餐、甜品、中央厨房、活动餐饮" />
          <Field label="地址/服务范围" value={profile.address} onChange={(v) => update("address", v)} placeholder="方便生成顾客回复、外送说明和广告文案" />
          <Field label="营业时间" value={profile.hours} onChange={(v) => update("hours", v)} placeholder="如：周一至周日 11:00–22:00" />
          <TextField label="主推产品/服务" value={profile.signature} onChange={(v) => update("signature", v)} placeholder="如：招牌叻沙、商业午餐、生日蛋糕、活动 catering" />
          <TextField label="接待/出餐能力" value={profile.capacity} onChange={(v) => update("capacity", v)} placeholder="如：座位数、每日出餐量、外送范围、接单容量" />
          <Field label="回复语气" value={profile.tone} onChange={(v) => update("tone", v)} placeholder="亲切、专业、直接成交" />
        </section>

        <section className="rounded-2xl bg-white dark:bg-stone-900/60 border border-stone-200/70 dark:border-stone-800 p-4">
          <h2 className="text-sm font-semibold text-stone-900 dark:text-stone-100">AI 记忆预览</h2>
          <p className="text-sm text-stone-500 dark:text-stone-400 leading-6 mt-2">
            这些资料会带入 AI 对话、内容工具、客源开发和接单助手，生成内容会自动贴近你的餐饮业态。
          </p>
          <pre className="mt-3 whitespace-pre-wrap rounded-xl bg-stone-100 dark:bg-stone-950 px-3 py-3 text-xs leading-5 text-stone-600 dark:text-stone-300 font-sans">
            {restaurantProfileSummary(profile)}
          </pre>
          <button onClick={reset} className="mt-3 text-xs font-medium text-stone-400 hover:text-stone-700 dark:hover:text-stone-200">
            清空全部资料
          </button>
        </section>
      </main>

      <div className="sticky bottom-0 border-t border-stone-100 dark:border-stone-800 bg-stone-50/95 dark:bg-[#111110]/95 backdrop-blur-md px-4 py-3">
        <button onClick={save} className="w-full rounded-2xl bg-gradient-to-r from-amber-400 to-orange-500 py-3 text-sm font-semibold text-white shadow-sm active:scale-[0.98] transition-transform">
          {saved ? "已保存" : "保存品牌资料"}
        </button>
      </div>
    </div>
  );
}

function Field({ label, value, onChange, placeholder }: { label: string; value: string; onChange: (value: string) => void; placeholder?: string }) {
  return (
    <div>
      <label className="text-xs font-medium text-stone-500 dark:text-stone-400">{label}</label>
      <input value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} className="mt-1.5 w-full rounded-xl border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-950 px-3 py-2.5 text-sm outline-none focus:border-amber-400" />
    </div>
  );
}

function TextField({ label, value, onChange, placeholder }: { label: string; value: string; onChange: (value: string) => void; placeholder?: string }) {
  return (
    <div>
      <label className="text-xs font-medium text-stone-500 dark:text-stone-400">{label}</label>
      <textarea value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} rows={3} className="mt-1.5 w-full resize-none rounded-xl border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-950 px-3 py-2.5 text-sm outline-none focus:border-amber-400" />
    </div>
  );
}
