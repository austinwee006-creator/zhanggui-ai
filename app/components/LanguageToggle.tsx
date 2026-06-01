"use client";

import { useLanguage } from "./LanguageProvider";

export default function LanguageToggle() {
  const { language, toggleLanguage } = useLanguage();

  return (
    <button
      type="button"
      data-zg-no-translate
      onClick={toggleLanguage}
      className="fixed bottom-[4.6rem] right-3 z-30 flex items-center gap-1 rounded-full border border-stone-200 bg-white/95 p-1 text-[11px] font-semibold shadow-sm backdrop-blur-md dark:border-stone-700 dark:bg-stone-900/95"
      aria-label={language === "zh" ? "Switch to English" : "切换到中文"}
    >
      <span className={`rounded-full px-2 py-1 ${language === "zh" ? "bg-stone-900 text-white dark:bg-stone-100 dark:text-stone-950" : "text-stone-400"}`}>中文</span>
      <span className={`rounded-full px-2 py-1 ${language === "en" ? "bg-stone-900 text-white dark:bg-stone-100 dark:text-stone-950" : "text-stone-400"}`}>EN</span>
    </button>
  );
}
