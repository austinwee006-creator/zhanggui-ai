"use client";

import { useEffect, useMemo, useState } from "react";
import { defaultRestaurantProfile, fieldOr, loadRestaurantProfile, profileFallback } from "../lib/restaurantProfile";

function toNumber(value: string) {
  return Number(value.replace(/[^\d.]/g, "")) || 0;
}

export default function MenuProfitPage() {
  const [profile, setProfile] = useState(defaultRestaurantProfile);
  const [dishName, setDishName] = useState("");
  const [price, setPrice] = useState("38");
  const [foodCost, setFoodCost] = useState("13");
  const [packagingCost, setPackagingCost] = useState("1.5");
  const [platformRate, setPlatformRate] = useState("0");
  const [targetMargin, setTargetMargin] = useState("65");

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const savedProfile = loadRestaurantProfile();
      setProfile(savedProfile);
      setDishName((current) => current || savedProfile.signature.split(/[、,，]/)[0] || "");
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  const result = useMemo(() => {
    const sellingPrice = toNumber(price);
    const cost = toNumber(foodCost) + toNumber(packagingCost);
    const commission = sellingPrice * (toNumber(platformRate) / 100);
    const totalCost = cost + commission;
    const profit = sellingPrice - totalCost;
    const margin = sellingPrice > 0 ? (profit / sellingPrice) * 100 : 0;
    const target = toNumber(targetMargin) / 100;
    const suggestedPrice = target < 1 ? totalCost / (1 - target) : sellingPrice;

    return { sellingPrice, totalCost, profit, margin, suggestedPrice };
  }, [foodCost, packagingCost, platformRate, price, targetMargin]);

  const status =
    result.margin >= toNumber(targetMargin)
      ? "这个产品毛利健康，可以作为主推。"
      : result.margin >= 50
      ? "毛利中等，适合搭配饮料或套餐提高客单价。"
      : "毛利偏低，建议调价、减低食材损耗，或不要长期做折扣。";

  const takeawayPrice = result.suggestedPrice * 1.12;

  return (
    <div className="h-full overflow-y-auto bg-stone-50 dark:bg-[#111110]">
      <header className="sticky top-0 z-10 border-b border-stone-200/70 dark:border-stone-800/70 bg-stone-50/90 dark:bg-[#111110]/90 backdrop-blur-md px-4 py-3">
        <h1 className="text-base font-semibold text-stone-900 dark:text-stone-100">利润计算</h1>
        <p className="text-xs text-stone-400 mt-0.5">算清每个产品该不该卖、该卖多少钱</p>
      </header>

      <main className="px-4 py-5 space-y-5">
        <section className="rounded-2xl bg-white dark:bg-stone-900/60 border border-stone-200/70 dark:border-stone-800 p-4 space-y-4">
          <div>
            <label className="text-xs font-medium text-stone-500 dark:text-stone-400">产品/菜品名</label>
            <input value={dishName} onChange={(e) => setDishName(e.target.value)} placeholder="如：午餐套餐、拿铁、生日蛋糕、活动餐盒" className="mt-1.5 w-full rounded-xl border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-950 px-3 py-2.5 text-sm outline-none focus:border-amber-400" />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <MoneyInput label="售价 RM" value={price} onChange={setPrice} />
            <MoneyInput label="食材成本 RM" value={foodCost} onChange={setFoodCost} />
            <MoneyInput label="包装/杂费 RM" value={packagingCost} onChange={setPackagingCost} />
            <MoneyInput label="平台抽佣 %" value={platformRate} onChange={setPlatformRate} />
          </div>

          <div>
            <label className="text-xs font-medium text-stone-500 dark:text-stone-400">目标毛利率：{targetMargin}%</label>
            <input type="range" min="40" max="80" value={targetMargin} onChange={(e) => setTargetMargin(e.target.value)} className="mt-2 w-full accent-amber-500" />
          </div>
        </section>

        <section className="rounded-2xl bg-stone-900 p-4 text-white dark:bg-stone-100 dark:text-stone-950">
          <p className="text-xs opacity-60">{dishName || "这个产品"} 分析</p>
          <div className="mt-3 grid grid-cols-3 gap-3">
            <Metric label="毛利" value={`RM ${result.profit.toFixed(2)}`} />
            <Metric label="毛利率" value={`${result.margin.toFixed(1)}%`} />
            <Metric label="总成本" value={`RM ${result.totalCost.toFixed(2)}`} />
          </div>
          <div className="mt-4 rounded-2xl bg-white/10 dark:bg-stone-950/10 p-3">
            <p className="text-sm font-semibold leading-6">{status}</p>
            <p className="text-xs opacity-70 mt-2">
              若要达到 {targetMargin}% 毛利率，建议售价约 RM {result.suggestedPrice.toFixed(2)}。
            </p>
          </div>
        </section>

        <section className="rounded-2xl bg-white dark:bg-stone-900/60 border border-stone-200/70 dark:border-stone-800 p-4">
          <h2 className="text-sm font-semibold text-stone-900 dark:text-stone-100">老板动作</h2>
          <ul className="mt-3 space-y-2 text-sm text-stone-600 dark:text-stone-300">
            <li>1. 毛利低于 50% 的产品，不要拿去做长期折扣。</li>
            <li>2. 高毛利主推产品放在菜单、外卖平台和社媒内容最前面，尤其适合 {fieldOr(profile.cuisine, profileFallback.cuisine)} 的主推区。</li>
            <li>3. 低毛利但受欢迎的产品，搭配饮料、小食、加料或套餐卖。</li>
            <li>4. 若上外卖平台，建议标价至少 RM {takeawayPrice.toFixed(2)}，预留平台抽佣和包装损耗。</li>
          </ul>
        </section>

        <section className="rounded-2xl bg-white dark:bg-stone-900/60 border border-stone-200/70 dark:border-stone-800 p-4">
          <h2 className="text-sm font-semibold text-stone-900 dark:text-stone-100">本店菜单定位</h2>
          <p className="mt-2 text-sm leading-6 text-stone-500 dark:text-stone-400">
            目前资料显示本店主打 {fieldOr(profile.signature, profileFallback.signature)}。建议把高毛利产品做成「主推必点」，低毛利但吸客的产品做成套餐入口，不要单独长期打折。
          </p>
        </section>
      </main>
    </div>
  );
}

function MoneyInput({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return (
    <div>
      <label className="text-xs font-medium text-stone-500 dark:text-stone-400">{label}</label>
      <input inputMode="decimal" value={value} onChange={(e) => onChange(e.target.value)} className="mt-1.5 w-full rounded-xl border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-950 px-3 py-2.5 text-sm outline-none focus:border-amber-400" />
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs opacity-60">{label}</p>
      <p className="text-lg font-semibold mt-1">{value}</p>
    </div>
  );
}
