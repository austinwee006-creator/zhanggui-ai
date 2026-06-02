"use client";

import { useEffect, useState } from "react";
import { getSupabase, isCloudEnabled } from "../lib/supabaseClient";
import { backupDataItems, getStoredRecordCount } from "../lib/dataBackup";
import { posImportStorageKey } from "../lib/businessRecords";
import { hasConfiguredRestaurantProfile, type RestaurantProfile } from "../lib/restaurantProfile";
import type { Language } from "../lib/i18n";

type PublicReadinessSectionProps = {
  profile: RestaurantProfile;
  language: Language;
  dataVersion: number;
};

type ChecklistItem = {
  label: string;
  detail: string;
  done: boolean;
  optional?: boolean;
};

export default function PublicReadinessSection({ profile, language, dataVersion }: PublicReadinessSectionProps) {
  const cloud = isCloudEnabled();
  const [email, setEmail] = useState<string | null>(null);
  const [installReady, setInstallReady] = useState(false);
  const [standalone, setStandalone] = useState(false);

  useEffect(() => {
    const sb = getSupabase();
    if (!sb) return;

    sb.auth.getUser().then(({ data }) => setEmail(data.user?.email ?? null));
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const nav = window.navigator as Navigator & { standalone?: boolean };
      setInstallReady("serviceWorker" in navigator);
      setStandalone(window.matchMedia("(display-mode: standalone)").matches || Boolean(nav.standalone));
    }, 0);

    return () => window.clearTimeout(timer);
  }, []);

  const businessItems = backupDataItems.filter((item) => item.label !== "语言");
  const counts = {
    totalRecords: businessItems.reduce((sum, item) => sum + getStoredRecordCount(item.key), 0),
    posImports: getStoredRecordCount(posImportStorageKey),
  };

  const profileReady = hasConfiguredRestaurantProfile(profile);
  const accountReady = Boolean(cloud && email);
  const pwaReady = standalone || installReady;
  const isEnglish = language === "en";

  const requiredItems: ChecklistItem[] = [
    {
      label: isEnglish ? "Cloud Account" : "正式云端账号",
      detail: accountReady
        ? isEnglish
          ? `Signed in as ${email}`
          : `已登入 ${email}`
        : cloud
        ? isEnglish
          ? "Customers must sign up or log in before cross-device sync works"
          : "客户注册或登入后才会跨设备同步"
        : isEnglish
        ? "Cloud is not connected; internal demo only"
        : "还没接云端，只适合内部演示",
      done: accountReady,
    },
    {
      label: isEnglish ? "Cross-device Data" : "跨设备资料",
      detail: accountReady
        ? isEnglish
          ? "The same account can read cloud data on another computer, phone or OS"
          : "同一个账号换电脑、手机或系统都能读取云端资料"
        : isEnglish
        ? "Currently relies on this device or backup files"
        : "目前仍要靠本机资料或备份文件",
      done: accountReady,
    },
    {
      label: isEnglish ? "Store Profile" : "店铺资料",
      detail: profileReady
        ? isEnglish
          ? "Store name and signature items are filled, so AI output matches the customer brand"
          : "店名和主推产品已填写，AI 输出会贴近客户品牌"
        : isEnglish
        ? "Fill store name and signature items first so customers do not see blank placeholders"
        : "先填店名和主推产品，避免客户看到空白占位",
      done: profileReady,
    },
    {
      label: isEnglish ? "Bilingual Version" : "双语版本",
      detail: isEnglish ? "Currently English; can switch back to Chinese" : "当前为中文，可切换 English",
      done: true,
    },
    {
      label: isEnglish ? "Backup and Restore" : "备份恢复",
      detail:
        counts.totalRecords > 0
          ? isEnglish
            ? `${counts.totalRecords} local business records can be backed up`
            : `已有 ${counts.totalRecords} 份本机业务资料可备份`
          : isEnglish
          ? "Download backup and restore import are ready"
          : "下载备份和导入恢复功能已准备好",
      done: true,
    },
  ];

  const optionalItems: ChecklistItem[] = [
    {
      label: isEnglish ? "POS Import" : "POS 导入",
      detail:
        counts.posImports > 0
          ? isEnglish
            ? `${counts.posImports} POS import records saved`
            : `已保存 ${counts.posImports} 份 POS 导入记录`
          : isEnglish
          ? "Can import POS daily reports; test once with the customer's POS report before handoff"
          : "可导入 POS 日报；建议交付前先用客户 POS 报表测试一次",
      done: counts.posImports > 0,
      optional: true,
    },
    {
      label: isEnglish ? "Installable App" : "安装使用",
      detail: standalone
        ? isEnglish
          ? "Opened in app mode"
          : "已用 App 模式打开"
        : pwaReady
        ? isEnglish
          ? "Can be added to home screen or desktop"
          : "可加入主屏幕或桌面使用"
        : isEnglish
        ? "Can be used in the browser first"
        : "可先用浏览器使用",
      done: pwaReady,
      optional: true,
    },
  ];

  const completedRequired = requiredItems.filter((item) => item.done).length;
  const readyForCustomer = accountReady && profileReady;
  const modeLabel = readyForCustomer
    ? isEnglish
      ? "Ready for Customer Trial"
      : "可交付客户试用"
    : cloud
    ? isEnglish
      ? "Finish Account and Profile First"
      : "先完成正式账号和店铺资料"
    : isEnglish
    ? "Internal Demo Mode"
    : "内部演示模式";

  return (
    <section data-version={dataVersion} className="rounded-2xl border border-stone-200/70 bg-white p-4 dark:border-stone-800 dark:bg-stone-900/60">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold text-stone-900 dark:text-stone-100">{isEnglish ? "Launch Checklist" : "上线检查"}</h2>
          <p className="mt-1 text-xs leading-5 text-stone-400">
            {isEnglish
              ? "Check this before selling to a customer: account, cross-device sync, language, backup and POS flow."
              : "卖给客户前先看这里，确认正式账号、跨设备、语言、备份和 POS 流程是否准备好。"}
          </p>
        </div>
        <div className={`shrink-0 rounded-xl px-3 py-2 text-right ${readyForCustomer ? "bg-emerald-50 dark:bg-emerald-950/30" : "bg-amber-50 dark:bg-amber-950/30"}`}>
          <p className={`text-[11px] font-medium ${readyForCustomer ? "text-emerald-600 dark:text-emerald-300" : "text-amber-600 dark:text-amber-300"}`}>
            {modeLabel}
          </p>
          <p className="mt-0.5 text-xs font-semibold text-stone-900 dark:text-stone-100">
            {isEnglish ? "Done" : "完成"} {completedRequired}/{requiredItems.length}
          </p>
        </div>
      </div>

      <div className="mt-4 space-y-2">
        {[...requiredItems, ...optionalItems].map((item) => (
          <div key={item.label} className="flex items-start gap-3 rounded-xl bg-stone-100 px-3 py-2.5 dark:bg-stone-950">
            <span
              className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[11px] font-bold ${
                item.done
                  ? "bg-emerald-500 text-white"
                  : item.optional
                  ? "bg-stone-200 text-stone-500 dark:bg-stone-800 dark:text-stone-400"
                  : "bg-amber-500 text-white"
              }`}
            >
              {item.done ? "✓" : item.optional ? "!" : "!"}
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <p className="text-xs font-semibold text-stone-800 dark:text-stone-100">{item.label}</p>
                {item.optional && <span className="rounded-full bg-white px-2 py-0.5 text-[10px] font-medium text-stone-400 dark:bg-stone-900">{language === "en" ? "Recommended" : "建议"}</span>}
              </div>
              <p className="mt-0.5 text-xs leading-5 text-stone-400">{item.detail}</p>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
