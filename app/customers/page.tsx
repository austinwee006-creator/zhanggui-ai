"use client";

import { useMemo, useState } from "react";
import { useLanguage } from "../components/LanguageProvider";
import {
  channelOptions,
  customerAverageSpend,
  customerLastOrderDays,
  customerStageOptions,
  customerTier,
  customerValueScore,
  formatMoney,
  isCustomerFollowUpDue,
  isDormantCustomer,
  loadCustomerRecords,
  saveCustomerRecords,
  toNumber,
  type CustomerRecord,
} from "../lib/businessRecords";
import { fieldOr, loadRestaurantProfile, profileFallback } from "../lib/restaurantProfile";

const followUpFilters = ["全部", "今天要跟进", "高价值", "沉睡客", "VIP", "老顾客", "潜在客户", "资料不完整"];
const campaignOptions = ["日常回访", "沉睡客唤醒", "VIP感谢", "公司团餐", "生日/节日"];

function todayText() {
  return new Date().toISOString().slice(0, 10);
}

function dateAfter(days: number) {
  const next = new Date();
  next.setDate(next.getDate() + days);
  return next.toISOString().slice(0, 10);
}

function whatsappHref(phone: string) {
  const digits = phone.replace(/[^\d]/g, "");
  return digits ? `https://wa.me/${digits}` : "";
}

function buildFollowUpText({
  customer,
  campaign,
  fallbackName,
  fallbackPreference,
  profileName,
  profileSignature,
  language,
}: {
  customer?: CustomerRecord;
  campaign: string;
  fallbackName: string;
  fallbackPreference: string;
  profileName: string;
  profileSignature: string;
  language: "zh" | "en";
}) {
  const customerName = customer?.name || fallbackName || (language === "en" ? "Boss" : "老板");
  const preferenceText = customer?.preference || fallbackPreference || profileSignature;
  const brand = profileName;

  if (language === "en") {
    if (campaign === "沉睡客唤醒") {
      return `Hi ${customerName}, this is ${brand}.\n\nYou previously showed interest in ${preferenceText}. We have a few fresh options this week, so I wanted to send them to our past customers first.\n\nIf you have dine-in, pickup, delivery or group meal needs this week, I can help match 2-3 choices based on your headcount and budget.`;
    }

    if (campaign === "VIP感谢") {
      return `Hi ${customerName}, this is ${brand}.\n\nThank you for supporting us. I wanted to let you know first about this week's ${preferenceText} before we post it publicly.\n\nIf you need a table, pickup, delivery or event meal, I can reserve the timing for you first.`;
    }

    if (campaign === "公司团餐") {
      return `Hi ${customerName}, this is ${brand}.\n\nWe can arrange ${preferenceText} for office lunch, meetings, team meals or small events.\n\nIf you can share the date, time, headcount and budget, I can prepare a simple option list for your team.`;
    }

    if (campaign === "生日/节日") {
      return `Hi ${customerName}, this is ${brand}.\n\nIf you have an upcoming birthday, celebration or holiday meal, we can help prepare ${preferenceText} with pickup, delivery or dine-in arrangements.\n\nTell me the date, time, headcount and budget, and I will suggest a suitable plan.`;
    }

    return `Hi ${customerName}, this is ${brand}.\n\nI wanted to follow up on ${preferenceText}. If you still need help with dine-in, pickup, delivery or a group order, I can prepare 2-3 suitable options for you.\n\nMay I know the date, time, headcount and budget?`;
  }

  if (campaign === "沉睡客唤醒") {
    return `${customerName}您好，我是${brand}。\n\n之前您有关注/购买过${preferenceText}，最近我们有新的选择，想优先发给老顾客参考。\n\n如果这周有用餐、外送、自取或聚会需求，我可以帮您按人数和预算配一份简单方案。`;
  }

  if (campaign === "VIP感谢") {
    return `${customerName}您好，我是${brand}。\n\n谢谢您一直支持我们。这周我们主推${preferenceText}，我想先发给重要老顾客参考，还没公开发之前可以先帮您预留。\n\n如果要堂食、自取、外送或活动餐，我可以先帮您保留时间。`;
  }

  if (campaign === "公司团餐") {
    return `${customerName}您好，我是${brand}。\n\n我们可以安排${preferenceText}，适合办公室午餐、会议、员工餐或小型活动。\n\n如果方便，您给我日期、时间、人数和预算，我可以直接整理 2-3 个适合的方案给您。`;
  }

  if (campaign === "生日/节日") {
    return `${customerName}您好，我是${brand}。\n\n如果近期有生日、节日聚餐、家庭聚会或公司庆祝，我们可以帮您安排${preferenceText}，可堂食、自取或外送。\n\n您给我日期、时间、人数和预算，我帮您配一份适合的方案。`;
  }

  return `${customerName}您好，我是${brand}。\n\n上次您有咨询${preferenceText}，我想跟进一下是否还需要我们帮您安排。\n\n方便的话，您给我人数/数量、日期时间和预算，我可以直接整理 2-3 个适合的选择给您。`;
}

export default function CustomersPage() {
  const { language } = useLanguage();
  const [profile] = useState(() => loadRestaurantProfile());
  const [records, setRecords] = useState<CustomerRecord[]>(() => loadCustomerRecords());
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [stage, setStage] = useState("潜在客户");
  const [source, setSource] = useState("WhatsApp");
  const [preference, setPreference] = useState("");
  const [lastOrder, setLastOrder] = useState("");
  const [totalSpend, setTotalSpend] = useState("");
  const [visitCount, setVisitCount] = useState("");
  const [birthday, setBirthday] = useState("");
  const [tags, setTags] = useState("");
  const [nextFollowUp, setNextFollowUp] = useState("");
  const [notes, setNotes] = useState("");
  const [filter, setFilter] = useState("全部");
  const [query, setQuery] = useState("");
  const [campaign, setCampaign] = useState("日常回访");
  const [selectedId, setSelectedId] = useState("");
  const [saved, setSaved] = useState(false);
  const [copied, setCopied] = useState(false);

  const profileName = fieldOr(profile.name, profileFallback.name);
  const profileSignature = fieldOr(profile.signature, profileFallback.signature);

  const filteredRecords = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();

    return records
      .filter((record) => {
        const isHighValue = customerValueScore(record) >= 55 || record.stage === "VIP";
        const missingInfo = !record.phone.trim() || !record.preference.trim();
        const haystack = [record.name, record.phone, record.stage, record.source, record.preference, record.tags, record.notes]
          .join(" ")
          .toLowerCase();

        if (normalizedQuery && !haystack.includes(normalizedQuery)) return false;
        if (filter === "今天要跟进") return isCustomerFollowUpDue(record);
        if (filter === "高价值") return isHighValue;
        if (filter === "沉睡客") return isDormantCustomer(record);
        if (filter === "资料不完整") return missingInfo;
        if (filter === "全部") return true;
        return record.stage === filter;
      })
      .sort((a, b) => {
        const priorityA = (isCustomerFollowUpDue(a) ? 1000 : 0) + (isDormantCustomer(a) ? 400 : 0) + customerValueScore(a);
        const priorityB = (isCustomerFollowUpDue(b) ? 1000 : 0) + (isDormantCustomer(b) ? 400 : 0) + customerValueScore(b);
        return priorityB - priorityA;
      });
  }, [filter, query, records]);

  const selectedCustomer = records.find((record) => record.id === selectedId) || filteredRecords[0] || records[0];

  const stats = useMemo(() => {
    return records.reduce(
      (acc, record) => {
        if (isCustomerFollowUpDue(record)) acc.due += 1;
        if (isDormantCustomer(record)) acc.dormant += 1;
        if (record.stage === "VIP" || customerValueScore(record) >= 55) acc.highValue += 1;
        if (record.stage === "VIP" || record.stage === "老顾客") acc.repeat += 1;
        if (!record.phone.trim() || !record.preference.trim()) acc.incomplete += 1;
        acc.spend += toNumber(record.totalSpend);
        acc.visits += toNumber(record.visitCount);
        return acc;
      },
      { due: 0, dormant: 0, highValue: 0, repeat: 0, incomplete: 0, spend: 0, visits: 0 }
    );
  }, [records]);

  const actionPlan = useMemo(() => {
    const actions = [];
    if (language === "en") {
      if (records.length === 0) {
        actions.push("Start by entering the latest 20 WhatsApp enquiries, repeat customers and corporate customers.");
        actions.push("For each customer, fill phone, preference, last order and next follow-up date.");
        return actions;
      }

      if (stats.due > 0) actions.push(`Follow up ${stats.due} due customers today, prioritizing repeat, VIP and corporate customers.`);
      if (stats.dormant > 0) actions.push(`Reactivate ${stats.dormant} dormant customers with a new item, bundle or holiday offer.`);
      if (stats.highValue > 0) actions.push(`Send reserved offers or thank-you scripts to ${stats.highValue} high-value customers to protect repeat sales.`);
      if (stats.incomplete > 0) actions.push(`Complete phone or preference details for ${stats.incomplete} customer profiles.`);
      if (actions.length === 0) actions.push("The customer pool looks healthy. Group repeat customers, send featured offers and schedule the next follow-ups.");
      return actions;
    }

    if (records.length === 0) {
      actions.push("先把最近 20 个 WhatsApp 询问、老客和公司客户录进来。");
      actions.push("每个客户至少填电话、偏好、最近订单和下次回访日期。");
      return actions;
    }

    if (stats.due > 0) actions.push(`今天先回访 ${stats.due} 个到期客户，优先老客、VIP 和公司客户。`);
    if (stats.dormant > 0) actions.push(`唤醒 ${stats.dormant} 个沉睡客户，用新品、套餐或节日方案重新开口。`);
    if (stats.highValue > 0) actions.push(`给 ${stats.highValue} 个高价值客户发专属预留或感谢话术，先保住复购。`);
    if (stats.incomplete > 0) actions.push(`补齐 ${stats.incomplete} 个客户的电话或偏好，否则很难长期追单。`);
    if (actions.length === 0) actions.push("客户池暂时健康，下一步把老客分组发主推产品，并把回访日期排满。");
    return actions;
  }, [language, records.length, stats.dormant, stats.due, stats.highValue, stats.incomplete]);

  const followUpText = useMemo(
    () =>
      buildFollowUpText({
        customer: selectedCustomer,
        campaign,
        fallbackName: name,
        fallbackPreference: preference,
        profileName,
        profileSignature,
        language,
      }),
    [campaign, language, name, preference, profileName, profileSignature, selectedCustomer]
  );

  const selectedScore = selectedCustomer ? customerValueScore(selectedCustomer) : 0;
  const selectedWhatsApp = selectedCustomer ? whatsappHref(selectedCustomer.phone) : "";
  const averageSpend = stats.visits > 0 ? stats.spend / stats.visits : 0;

  const saveCustomer = () => {
    const nextRecord: CustomerRecord = {
      id: String(Date.now()),
      name: name || "未填称呼",
      phone,
      stage,
      source,
      preference,
      lastOrder,
      totalSpend: totalSpend || "0",
      visitCount: visitCount || "0",
      birthday,
      tags,
      nextFollowUp,
      lastContactedAt: "",
      orderIds: [],
      notes,
      createdAt: new Date().toISOString(),
    };
    const nextRecords = [nextRecord, ...records].slice(0, 160);
    setRecords(nextRecords);
    saveCustomerRecords(nextRecords);
    setSelectedId(nextRecord.id);
    setSaved(true);
    setTimeout(() => setSaved(false), 1600);
  };

  const updateCustomer = (id: string, patch: Partial<CustomerRecord>) => {
    const nextRecords = records.map((record) => (record.id === id ? { ...record, ...patch } : record));
    setRecords(nextRecords);
    saveCustomerRecords(nextRecords);
  };

  const deleteCustomer = (id: string) => {
    const nextRecords = records.filter((record) => record.id !== id);
    setRecords(nextRecords);
    saveCustomerRecords(nextRecords);
    if (selectedId === id) setSelectedId("");
  };

  const copyText = async () => {
    await navigator.clipboard.writeText(followUpText);
    setCopied(true);
    setTimeout(() => setCopied(false), 1600);
  };

  return (
    <div className="h-full overflow-y-auto bg-stone-50 dark:bg-[#111110]">
      <header className="sticky top-0 z-10 border-b border-stone-200/70 bg-stone-50/90 px-4 py-3 backdrop-blur-md dark:border-stone-800/70 dark:bg-[#111110]/90">
        <h1 className="text-base font-semibold text-stone-900 dark:text-stone-100">客户经营</h1>
        <p className="mt-0.5 text-xs text-stone-400">追复购、唤醒沉睡客、管理 VIP 和公司客户</p>
      </header>

      <main className="space-y-5 px-4 py-5">
        <section className="grid grid-cols-3 gap-2.5">
          <MetricCard label="客户数" value={String(records.length)} />
          <MetricCard label="今天跟进" value={String(stats.due)} tone="amber" />
          <MetricCard label="客户价值" value={formatMoney(stats.spend)} />
        </section>

        <section className="rounded-2xl bg-stone-900 p-4 text-white dark:bg-stone-100 dark:text-stone-950">
          <p className="text-xs opacity-60">掌柜 AI 客户判断</p>
          <h2 className="mt-1 text-lg font-semibold leading-snug">{actionPlan[0]}</h2>
          <div className="mt-4 flex flex-wrap gap-2">
            <button onClick={copyText} className="rounded-xl bg-amber-400 px-3 py-2 text-xs font-semibold text-stone-950">
              {copied ? "已复制话术" : "复制客户话术"}
            </button>
            {selectedWhatsApp ? (
              <a href={selectedWhatsApp} target="_blank" rel="noreferrer" className="rounded-xl bg-white/10 px-3 py-2 text-xs font-semibold dark:bg-stone-950/10">
                打开 WhatsApp
              </a>
            ) : null}
            <a href="/leads" className="rounded-xl bg-white/10 px-3 py-2 text-xs font-semibold dark:bg-stone-950/10">
              开发新客
            </a>
          </div>
        </section>

        <section className="rounded-2xl border border-stone-200/70 bg-white p-4 dark:border-stone-800 dark:bg-stone-900/60">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-sm font-semibold text-stone-900 dark:text-stone-100">客户复购雷达</h2>
            <span className="text-xs text-stone-400">客单 {formatMoney(averageSpend)}</span>
          </div>
          <div className="mt-3 grid grid-cols-2 gap-2">
            <MiniStat label="沉睡客户" value={stats.dormant} danger={stats.dormant > 0} />
            <MiniStat label="高价值客户" value={stats.highValue} />
            <MiniStat label="老客/VIP" value={stats.repeat} />
            <MiniStat label="资料不完整" value={stats.incomplete} danger={stats.incomplete > 0} />
          </div>
          <div className="mt-3 space-y-2">
            {actionPlan.slice(1).map((item) => (
              <p key={item} className="rounded-xl bg-stone-100 px-3 py-2 text-xs leading-5 text-stone-600 dark:bg-stone-950 dark:text-stone-300">
                {item}
              </p>
            ))}
          </div>
        </section>

        <section className="space-y-4 rounded-2xl border border-stone-200/70 bg-white p-4 dark:border-stone-800 dark:bg-stone-900/60">
          <div className="grid grid-cols-1 gap-3">
            <Field label="客户称呼" value={name} onChange={setName} placeholder="顾客姓名、公司名或负责人" />
            <Field label="电话/WhatsApp" value={phone} onChange={setPhone} placeholder="方便一键复制后发送" inputMode="tel" />
          </div>

          <Segment label="客户阶段" options={customerStageOptions} value={stage} onChange={setStage} />
          <Segment label="来源渠道" options={channelOptions} value={source} onChange={setSource} tone="emerald" />

          <Field label="偏好/需求" value={preference} onChange={setPreference} placeholder="如：午餐套餐、生日蛋糕、公司下午茶、素食、不要辣" />

          <div className="grid grid-cols-2 gap-3">
            <Field label="最近一次订单" value={lastOrder} onChange={setLastOrder} type="date" />
            <Field label="累计消费 RM" value={totalSpend} onChange={setTotalSpend} inputMode="decimal" />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Field label="消费次数" value={visitCount} onChange={(value) => setVisitCount(value.replace(/\D/g, ""))} inputMode="numeric" />
            <Field label="生日/纪念日" value={birthday} onChange={setBirthday} type="date" />
          </div>

          <Field label="客户标签" value={tags} onChange={setTags} placeholder="如：公司客户、每周五、怕辣、要发票、生日客" />
          <Field label="下次回访日期" value={nextFollowUp} onChange={setNextFollowUp} type="date" />

          <div>
            <label className="text-xs font-medium text-stone-500 dark:text-stone-400">备注</label>
            <textarea value={notes} onChange={(event) => setNotes(event.target.value)} rows={3} placeholder="如：喜欢套餐 A、每周五订、公司有 30 人、对价格敏感" className="mt-1.5 w-full resize-none rounded-xl border border-stone-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-amber-400 dark:border-stone-700 dark:bg-stone-950" />
          </div>

          <button onClick={saveCustomer} className="w-full rounded-2xl bg-stone-900 py-3 text-sm font-semibold text-white transition-transform active:scale-[0.98] dark:bg-stone-100 dark:text-stone-950">
            {saved ? "已保存客户" : "保存客户资料"}
          </button>
        </section>

        <section className="overflow-hidden rounded-2xl border border-stone-200/70 bg-white dark:border-stone-800 dark:bg-stone-900/60">
          <div className="border-b border-stone-100 px-4 py-3 dark:border-stone-800">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h2 className="text-sm font-semibold text-stone-900 dark:text-stone-100">客户话术</h2>
                <p className="mt-1 text-xs text-stone-400">选择客户和场景后，话术会按客户价值和偏好调整。</p>
              </div>
              <span className="rounded-full bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-600 dark:bg-amber-950/30 dark:text-amber-300">
                分数 {selectedScore}
              </span>
            </div>
            <div className="mt-3 flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
              {campaignOptions.map((item) => (
                <button key={item} onClick={() => setCampaign(item)} className={`whitespace-nowrap rounded-full border px-3 py-1.5 text-xs font-medium ${campaign === item ? "border-stone-900 bg-stone-900 text-white dark:border-stone-100 dark:bg-stone-100 dark:text-stone-950" : "border-stone-200 bg-white text-stone-500 dark:border-stone-700 dark:bg-stone-900/60 dark:text-stone-400"}`}>
                  {item}
                </button>
              ))}
            </div>
          </div>
          <pre className="whitespace-pre-wrap px-4 py-3 font-sans text-sm leading-7 text-stone-700 dark:text-stone-300">{followUpText}</pre>
        </section>

        <section>
          <div className="mb-2.5 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-stone-900 dark:text-stone-100">客户名单</h2>
            <span className="text-xs text-stone-400">复购率：{records.length ? Math.round((stats.repeat / records.length) * 100) : 0}%</span>
          </div>
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="搜索姓名、电话、偏好、标签或备注" className="mb-3 w-full rounded-2xl border border-stone-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-amber-400 dark:border-stone-700 dark:bg-stone-900/60" />
          <div className="mb-3 flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
            {followUpFilters.map((item) => (
              <button key={item} onClick={() => setFilter(item)} className={`whitespace-nowrap rounded-full border px-3 py-1.5 text-xs font-medium ${filter === item ? "border-stone-900 bg-stone-900 text-white dark:border-stone-100 dark:bg-stone-100 dark:text-stone-950" : "border-stone-200 bg-white text-stone-500 dark:border-stone-700 dark:bg-stone-900/60 dark:text-stone-400"}`}>
                {item}
              </button>
            ))}
          </div>

          {filteredRecords.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-stone-300 bg-white px-4 py-6 text-center dark:border-stone-700 dark:bg-stone-900/60">
              <p className="text-sm font-medium text-stone-700 dark:text-stone-200">还没有客户资料</p>
              <p className="mt-1 text-xs leading-5 text-stone-400">把询问过、下过单、常回来的顾客都记下来，老板才不会一直只靠新客。</p>
            </div>
          ) : (
            <div className="space-y-2">
              {filteredRecords.map((record) => (
                <CustomerCard key={record.id} record={record} selected={record.id === selectedCustomer?.id} onSelect={setSelectedId} onPatch={updateCustomer} onDelete={deleteCustomer} />
              ))}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}

function MetricCard({ label, value, tone = "stone" }: { label: string; value: string; tone?: "stone" | "amber" }) {
  const color = tone === "amber" ? "text-amber-500" : "text-stone-900 dark:text-stone-100";
  return (
    <div className="rounded-2xl border border-stone-200/70 bg-white p-3 dark:border-stone-800 dark:bg-stone-900/60">
      <p className="text-xs text-stone-400">{label}</p>
      <p className={`mt-1 text-lg font-semibold ${color}`}>{value}</p>
    </div>
  );
}

function MiniStat({ label, value, danger = false }: { label: string; value: number; danger?: boolean }) {
  return (
    <div className="rounded-xl bg-stone-100 px-3 py-2 dark:bg-stone-950">
      <p className="text-[11px] text-stone-400">{label}</p>
      <p className={`mt-0.5 text-sm font-semibold ${danger ? "text-red-500" : "text-stone-900 dark:text-stone-100"}`}>{value}</p>
    </div>
  );
}

function Field({ label, value, onChange, placeholder, type = "text", inputMode }: { label: string; value: string; onChange: (value: string) => void; placeholder?: string; type?: string; inputMode?: "text" | "tel" | "numeric" | "decimal" }) {
  return (
    <div>
      <label className="text-xs font-medium text-stone-500 dark:text-stone-400">{label}</label>
      <input type={type} inputMode={inputMode} value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} className="mt-1.5 w-full rounded-xl border border-stone-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-amber-400 dark:border-stone-700 dark:bg-stone-950" />
    </div>
  );
}

function Segment({ label, options, value, onChange, tone = "amber" }: { label: string; options: string[]; value: string; onChange: (value: string) => void; tone?: "amber" | "emerald" }) {
  return (
    <div>
      <label className="text-xs font-medium text-stone-500 dark:text-stone-400">{label}</label>
      <div className="mt-2 flex flex-wrap gap-2">
        {options.map((item) => (
          <button key={item} type="button" onClick={() => onChange(item)} className={`rounded-full border px-3 py-1.5 text-xs font-medium ${value === item ? tone === "emerald" ? "border-emerald-400 bg-emerald-50 text-emerald-600 dark:bg-emerald-950/30 dark:text-emerald-300" : "border-amber-400 bg-amber-50 text-amber-600 dark:bg-amber-950/30 dark:text-amber-300" : "border-stone-200 text-stone-500 dark:border-stone-700 dark:text-stone-400"}`}>
            {item}
          </button>
        ))}
      </div>
    </div>
  );
}

function CustomerCard({ record, selected, onSelect, onPatch, onDelete }: { record: CustomerRecord; selected: boolean; onSelect: (id: string) => void; onPatch: (id: string, patch: Partial<CustomerRecord>) => void; onDelete: (id: string) => void }) {
  const due = isCustomerFollowUpDue(record);
  const dormant = isDormantCustomer(record);
  const score = customerValueScore(record);
  const tier = customerTier(record);
  const lastOrderDays = customerLastOrderDays(record);

  return (
    <div className={`rounded-2xl border bg-white p-3 dark:bg-stone-900/60 ${selected ? "border-amber-400" : due || dormant ? "border-amber-300 dark:border-amber-900" : "border-stone-200/70 dark:border-stone-800"}`}>
      <button onClick={() => onSelect(record.id)} className="w-full text-left">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-sm font-semibold text-stone-900 dark:text-stone-100">{record.name}</p>
            <p className="mt-1 text-xs text-stone-400">{record.source || "未填来源"} · {record.phone || "未填电话"}</p>
          </div>
          <span className={`rounded-full px-2 py-1 text-[11px] ${due || dormant ? "bg-amber-50 text-amber-600 dark:bg-amber-950/30 dark:text-amber-300" : "bg-stone-100 text-stone-500 dark:bg-stone-800 dark:text-stone-300"}`}>
            {due ? "今天追" : dormant ? "沉睡" : record.stage}
          </span>
        </div>
        <p className="mt-2 text-sm leading-6 text-stone-600 dark:text-stone-300">{record.preference || "未填写偏好"}</p>
        <p className="mt-1 text-xs text-stone-400">
          {tier} · 分数 {score} · 消费 {formatMoney(toNumber(record.totalSpend))} · 客单 {formatMoney(customerAverageSpend(record))}
        </p>
        <p className="mt-1 text-xs text-stone-400">
          {record.nextFollowUp ? `回访 ${record.nextFollowUp}` : "未安排回访"}
          {lastOrderDays !== null ? ` · ${lastOrderDays} 天未下单` : ""}
          {record.lastContactedAt ? ` · 上次联系 ${record.lastContactedAt}` : ""}
        </p>
      </button>
      <div className="mt-3 flex flex-wrap gap-2">
        <button onClick={() => onPatch(record.id, { lastContactedAt: todayText(), nextFollowUp: dateAfter(7) })} className="rounded-full bg-stone-900 px-3 py-1.5 text-xs font-medium text-white dark:bg-stone-100 dark:text-stone-950">已联系+7天</button>
        <button onClick={() => onPatch(record.id, { nextFollowUp: dateAfter(30) })} className="rounded-full bg-stone-100 px-3 py-1.5 text-xs font-medium text-stone-600 dark:bg-stone-800 dark:text-stone-300">30天后追</button>
        <button onClick={() => onPatch(record.id, { stage: "老顾客" })} className="rounded-full bg-emerald-50 px-3 py-1.5 text-xs font-medium text-emerald-600 dark:bg-emerald-950/30 dark:text-emerald-300">变老客</button>
        <button onClick={() => onPatch(record.id, { stage: "VIP" })} className="rounded-full bg-amber-50 px-3 py-1.5 text-xs font-medium text-amber-600 dark:bg-amber-950/30 dark:text-amber-300">设 VIP</button>
        <button onClick={() => onPatch(record.id, { stage: "沉睡客" })} className="rounded-full bg-red-50 px-3 py-1.5 text-xs font-medium text-red-500 dark:bg-red-950/30 dark:text-red-300">设沉睡</button>
        <button onClick={() => onDelete(record.id)} className="rounded-full px-3 py-1.5 text-xs font-medium text-stone-400">删除</button>
      </div>
    </div>
  );
}
