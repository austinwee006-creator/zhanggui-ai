"use client";

import { useMemo, useState } from "react";
import { fieldOr, loadRestaurantProfile, profileFallback } from "../lib/restaurantProfile";

const audienceOptions = ["附近上班族", "家庭客", "学生", "公司团餐", "活动主办方", "老顾客回访"];
const goalOptions = ["今天要订单", "增加新客", "拉回老顾客", "推广新品", "做团购/套餐"];

const sourceTemplates = [
  {
    title: "附近企业和办公室",
    fit: "适合午餐、咖啡、便当、团餐、下午茶",
    action: "列出 20 间公司，发企业餐/下午茶套餐给行政、人事或老板。",
  },
  {
    title: "社区群和住宅区",
    fit: "适合家庭餐、甜品、外卖、自取、周末套餐",
    action: "准备 1 张清楚菜单图，主打方便、份量、价格和取餐时间。",
  },
  {
    title: "学校、补习中心、健身房",
    fit: "适合轻食、饮料、健康餐、点心、活动餐盒",
    action: "用合作价切入，问对方是否需要固定供应或会员优惠。",
  },
  {
    title: "活动公司和摄影/婚礼团队",
    fit: "适合 catering、蛋糕、甜品台、聚会套餐",
    action: "准备 3 个价位套餐，强调准时、摆盘、人数弹性和订金流程。",
  },
];

export default function LeadsPage() {
  const [profile] = useState(() => loadRestaurantProfile());
  const [audience, setAudience] = useState("附近上班族");
  const [goal, setGoal] = useState("今天要订单");
  const [area, setArea] = useState("");
  const [offer, setOffer] = useState("");
  const [copied, setCopied] = useState(false);

  const outreachText = useMemo(() => {
    const areaText = area.trim() || "附近区域";
    const offerText = fieldOr(offer, fieldOr(profile.signature, profileFallback.signature));
    const nameText = fieldOr(profile.name, profileFallback.name);
    const cuisineText = fieldOr(profile.cuisine, profileFallback.cuisine);

    return `您好，我是${nameText}。\n\n我们主要做${cuisineText}，现在想给${areaText}的${audience}提供${offerText}。\n\n如果你们近期有用餐、外送、自取、聚会或活动餐饮需求，我可以先发一份适合你们预算和人数的选择给你参考。\n\n方便的话，我想了解：\n1. 大概几个人/几份？\n2. 需要什么日期和时间？\n3. 预算大概多少？`;
  }, [area, audience, offer, profile.cuisine, profile.name, profile.signature]);

  const weeklyPlan = [
    `第 1 天：在${area.trim() || "附近"}列出 20 个可能客源，先从${audience}开始。`,
    `第 2 天：用${fieldOr(offer, fieldOr(profile.signature, profileFallback.signature))}做 1 张清楚菜单图和 1 条短视频。`,
    "第 3 天：主动联系 10 个潜在合作对象，记录回应和下次跟进时间。",
    "第 4 天：回访老顾客，问是否需要本周预订、外送或活动餐。",
    "第 5 天：把有兴趣但未下单的人集中追问一次，给明确截止时间。",
    "第 6 天：整理成交来源，保留有效话术，删掉没反应渠道。",
    "第 7 天：复盘哪一种客群最容易成交，下周集中打同一个方向。",
  ];

  const copyOutreach = async () => {
    await navigator.clipboard.writeText(outreachText);
    setCopied(true);
    setTimeout(() => setCopied(false), 1600);
  };

  return (
    <div className="h-full overflow-y-auto bg-stone-50 dark:bg-[#111110]">
      <header className="sticky top-0 z-10 border-b border-stone-200/70 dark:border-stone-800/70 bg-stone-50/90 dark:bg-[#111110]/90 backdrop-blur-md px-4 py-3">
        <h1 className="text-base font-semibold text-stone-900 dark:text-stone-100">客源开发</h1>
        <p className="text-xs text-stone-400 mt-0.5">找客人、写邀约、安排跟进动作</p>
      </header>

      <main className="px-4 py-5 space-y-5">
        <section className="rounded-2xl bg-white dark:bg-stone-900/60 border border-stone-200/70 dark:border-stone-800 p-4 space-y-4">
          <div>
            <label className="text-xs font-medium text-stone-500 dark:text-stone-400">目标客群</label>
            <div className="mt-2 flex flex-wrap gap-2">
              {audienceOptions.map((item) => (
                <button key={item} type="button" onClick={() => setAudience(item)} className={`rounded-full border px-3 py-1.5 text-xs font-medium ${audience === item ? "border-amber-400 bg-amber-50 text-amber-600 dark:bg-amber-950/30 dark:text-amber-300" : "border-stone-200 dark:border-stone-700 text-stone-500 dark:text-stone-400"}`}>
                  {item}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="text-xs font-medium text-stone-500 dark:text-stone-400">目标</label>
            <div className="mt-2 flex flex-wrap gap-2">
              {goalOptions.map((item) => (
                <button key={item} type="button" onClick={() => setGoal(item)} className={`rounded-full border px-3 py-1.5 text-xs font-medium ${goal === item ? "border-emerald-400 bg-emerald-50 text-emerald-600 dark:bg-emerald-950/30 dark:text-emerald-300" : "border-stone-200 dark:border-stone-700 text-stone-500 dark:text-stone-400"}`}>
                  {item}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3">
            <div>
              <label className="text-xs font-medium text-stone-500 dark:text-stone-400">区域</label>
              <input value={area} onChange={(e) => setArea(e.target.value)} placeholder="如：Mid Valley 附近、学校区、办公室区" className="mt-1.5 w-full rounded-xl border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-950 px-3 py-2.5 text-sm outline-none focus:border-amber-400" />
            </div>
            <div>
              <label className="text-xs font-medium text-stone-500 dark:text-stone-400">这次主推</label>
              <input value={offer} onChange={(e) => setOffer(e.target.value)} placeholder="如：午餐套餐、咖啡配甜点、生日蛋糕、活动餐盒" className="mt-1.5 w-full rounded-xl border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-950 px-3 py-2.5 text-sm outline-none focus:border-amber-400" />
            </div>
          </div>
        </section>

        <section className="rounded-2xl bg-stone-900 p-4 text-white dark:bg-stone-100 dark:text-stone-950">
          <p className="text-xs opacity-60">{goal}</p>
          <h2 className="mt-1 text-lg font-semibold leading-snug">先从 {audience} 下手，把主推产品变成可复制的邀约话术。</h2>
          <button onClick={copyOutreach} className="mt-4 rounded-xl bg-amber-400 px-3 py-2 text-xs font-semibold text-stone-950">
            {copied ? "已复制话术" : "复制邀约话术"}
          </button>
        </section>

        <section className="rounded-2xl bg-white dark:bg-stone-900/60 border border-stone-200/70 dark:border-stone-800 overflow-hidden">
          <div className="flex items-center justify-between border-b border-stone-100 dark:border-stone-800 px-4 py-3">
            <h2 className="text-sm font-semibold text-stone-900 dark:text-stone-100">邀约话术</h2>
          </div>
          <pre className="whitespace-pre-wrap px-4 py-3 text-sm leading-7 text-stone-700 dark:text-stone-300 font-sans">{outreachText}</pre>
        </section>

        <section>
          <h2 className="text-sm font-semibold text-stone-900 dark:text-stone-100 mb-2.5">可以去哪里挖客人</h2>
          <div className="space-y-2">
            {sourceTemplates.map((source) => (
              <div key={source.title} className="rounded-2xl bg-white dark:bg-stone-900/60 border border-stone-200/70 dark:border-stone-800 p-3">
                <p className="text-sm font-semibold text-stone-900 dark:text-stone-100">{source.title}</p>
                <p className="mt-1 text-xs leading-5 text-stone-400">{source.fit}</p>
                <p className="mt-2 text-sm leading-6 text-stone-600 dark:text-stone-300">{source.action}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="rounded-2xl bg-white dark:bg-stone-900/60 border border-stone-200/70 dark:border-stone-800 p-4">
          <h2 className="text-sm font-semibold text-stone-900 dark:text-stone-100">7 天获客动作</h2>
          <div className="mt-3 space-y-2">
            {weeklyPlan.map((item, index) => (
              <div key={item} className="flex gap-2 text-sm text-stone-600 dark:text-stone-300">
                <span className="flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full bg-amber-100 text-xs font-semibold text-amber-700 dark:bg-amber-950/40 dark:text-amber-300">
                  {index + 1}
                </span>
                <span>{item}</span>
              </div>
            ))}
          </div>
        </section>
      </main>
    </div>
  );
}
