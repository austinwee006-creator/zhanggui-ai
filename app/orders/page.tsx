"use client";

import { useMemo, useState } from "react";
import {
  channelOptions,
  formatMoney,
  loadOrderRecords,
  orderBalance,
  orderStatusOptions,
  orderTypeOptions,
  saveOrderRecords,
  syncOrderToBusinessRecords,
  toNumber,
  type OrderRecord,
} from "../lib/businessRecords";
import { fieldOr, loadRestaurantProfile, profileFallback } from "../lib/restaurantProfile";

const budgetOptions = ["RM 20/人", "RM 50/人", "RM 300 总预算", "客户还没说"];
const filterOptions = ["全部", "今天", "待跟进", "未收订金", "未收尾款"];

export default function OrdersPage() {
  const [profile] = useState(() => loadRestaurantProfile());
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [pax, setPax] = useState("10");
  const [orderType, setOrderType] = useState("堂食预订");
  const [channel, setChannel] = useState("WhatsApp");
  const [status, setStatus] = useState("新询问");
  const [budget, setBudget] = useState("客户还没说");
  const [amount, setAmount] = useState("");
  const [deposit, setDeposit] = useState("");
  const [owner, setOwner] = useState("");
  const [nextFollowUp, setNextFollowUp] = useState("");
  const [notes, setNotes] = useState("");
  const [copied, setCopied] = useState(false);
  const [saved, setSaved] = useState(false);
  const [syncResult, setSyncResult] = useState<{ customer: string; booking: string } | null>(null);
  const [filter, setFilter] = useState("全部");
  const [records, setRecords] = useState<OrderRecord[]>(() => loadOrderRecords());

  const serviceGroupCount = Math.max(1, Math.ceil(Number(pax || 0) / 10));
  const balance = Math.max(0, toNumber(amount) - toNumber(deposit));

  const stats = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10);
    return records.reduce(
      (acc, record) => {
        const recordBalance = orderBalance(record);
        if (record.date === today) acc.today += 1;
        if (record.nextFollowUp && record.nextFollowUp <= today && record.status !== "已完成") acc.followUp += 1;
        if (toNumber(record.amount) > 0 && toNumber(record.deposit) <= 0 && record.status !== "已取消") acc.noDeposit += 1;
        if (recordBalance > 0 && record.status !== "已取消") acc.balance += recordBalance;
        if (record.status === "已确认" || record.status === "已完成") acc.confirmed += toNumber(record.amount);
        return acc;
      },
      { today: 0, followUp: 0, noDeposit: 0, balance: 0, confirmed: 0 }
    );
  }, [records]);

  const filteredRecords = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10);
    return records.filter((record) => {
      if (filter === "今天") return record.date === today;
      if (filter === "待跟进") return record.nextFollowUp && record.nextFollowUp <= today && record.status !== "已完成";
      if (filter === "未收订金") return toNumber(record.amount) > 0 && toNumber(record.deposit) <= 0 && record.status !== "已取消";
      if (filter === "未收尾款") return orderBalance(record) > 0 && toNumber(record.deposit) > 0 && record.status !== "已取消";
      return true;
    });
  }, [filter, records]);

  const quote = useMemo(() => {
    const name = customerName || "老板";
    const dateText = date || "指定日期";
    const timeText = time || "指定时间";
    const budgetText = budget.trim() || "客户还未确认";
    const amountText = amount ? `\n预计金额：RM ${toNumber(amount).toFixed(2)}` : "";
    const depositText = amount ? `\n建议订金：RM ${toNumber(deposit || String(Math.ceil(toNumber(amount) * 0.3))).toFixed(2)}` : "";
    const noteText = notes ? `\n\n特别备注：${notes}` : "";

    return `${name}您好，这里是${fieldOr(profile.name, profileFallback.name)}。感谢您咨询${orderType}。\n\n我先帮您记录：\n来源：${channel}\n日期：${dateText}\n时间：${timeText}\n人数/数量：约 ${pax || 0}（参考 ${serviceGroupCount} 组安排）\n预算：${budgetText}${amountText}${depositText}\n状态：${status}\n\n我们主要做${fieldOr(profile.cuisine, profileFallback.cuisine)}，主推${fieldOr(profile.signature, profileFallback.signature)}。${profile.capacity ? `${profile.capacity}。` : ""}${profile.hours ? `营业时间：${profile.hours}。` : ""}\n\n下一步我建议先确认菜单/产品选择、取餐/送餐方式和订金。您确认后，我这边马上帮您预留档期。${noteText}`;
  }, [amount, budget, channel, customerName, date, deposit, notes, orderType, pax, profile.capacity, profile.cuisine, profile.hours, profile.name, profile.signature, serviceGroupCount, status, time]);

  const saveRecord = () => {
    const nextRecord: OrderRecord = {
      id: String(Date.now()),
      customerName: customerName || "未填称呼",
      customerPhone,
      orderType,
      channel,
      date: date || "未定日期",
      time: time || "未定时间",
      pax: pax || "0",
      budget: budget.trim() || "客户还未确认",
      amount: amount || "0",
      deposit: deposit || "0",
      status,
      owner,
      nextFollowUp,
      notes,
      createdAt: new Date().toISOString(),
    };
    const nextRecords = [nextRecord, ...records].slice(0, 80);
    setRecords(nextRecords);
    saveOrderRecords(nextRecords);
    setSyncResult(syncOrderToBusinessRecords(nextRecord));
    setSaved(true);
    setTimeout(() => setSaved(false), 1600);
  };

  const updateRecord = (id: string, patch: Partial<OrderRecord>) => {
    let updatedRecord: OrderRecord | null = null;
    const nextRecords = records.map((record) => {
      if (record.id !== id) return record;
      updatedRecord = { ...record, ...patch };
      return updatedRecord;
    });
    setRecords(nextRecords);
    saveOrderRecords(nextRecords);
    if (updatedRecord) setSyncResult(syncOrderToBusinessRecords(updatedRecord));
  };

  const deleteRecord = (id: string) => {
    const nextRecords = records.filter((record) => record.id !== id);
    setRecords(nextRecords);
    saveOrderRecords(nextRecords);
  };

  const copyQuote = async () => {
    await navigator.clipboard.writeText(quote);
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };

  return (
    <div className="h-full overflow-y-auto bg-stone-50 dark:bg-[#111110]">
      <header className="sticky top-0 z-10 border-b border-stone-200/70 bg-stone-50/90 px-4 py-3 backdrop-blur-md dark:border-stone-800/70 dark:bg-[#111110]/90">
        <h1 className="text-base font-semibold text-stone-900 dark:text-stone-100">订单中枢</h1>
        <p className="mt-0.5 text-xs text-stone-400">记录询问、订金、尾款、交付和下次跟进</p>
      </header>

      <main className="space-y-5 px-4 py-5">
        <section className="grid grid-cols-3 gap-2.5">
          <MetricCard label="今日订单" value={String(stats.today)} />
          <MetricCard label="待跟进" value={String(stats.followUp)} tone="amber" />
          <MetricCard label="未收尾款" value={formatMoney(stats.balance)} tone="red" />
        </section>

        <section className="rounded-2xl border border-stone-200/70 bg-white p-4 dark:border-stone-800 dark:bg-stone-900/60">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="text-sm font-semibold text-stone-900 dark:text-stone-100">成交漏斗</h2>
              <p className="mt-1 text-xs leading-5 text-stone-400">老板最怕漏单、忘追、漏收钱，这里直接提醒。</p>
            </div>
            <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-600 dark:bg-emerald-950/30 dark:text-emerald-300">
              已确认 {formatMoney(stats.confirmed)}
            </span>
          </div>
          <div className="mt-3 grid grid-cols-3 gap-2">
            <MiniStat label="未收订金" value={stats.noDeposit} />
            <MiniStat label="需跟进" value={stats.followUp} />
            <MiniStat label="记录数" value={records.length} />
          </div>
        </section>

        <section className="space-y-4 rounded-2xl border border-stone-200/70 bg-white p-4 dark:border-stone-800 dark:bg-stone-900/60">
          <div className="grid grid-cols-1 gap-3">
            <Field label="顾客/公司称呼" value={customerName} onChange={setCustomerName} placeholder="如：顾客姓名、公司名、活动负责人" />
            <Field label="电话/WhatsApp" value={customerPhone} onChange={setCustomerPhone} placeholder="方便后续回访和确认订金" inputMode="tel" />
          </div>

          <Segment label="订单类型" options={orderTypeOptions} value={orderType} onChange={setOrderType} />

          <div className="grid grid-cols-2 gap-3">
            <Field label="日期" value={date} onChange={setDate} type="date" />
            <Field label="时间" value={time} onChange={setTime} type="time" />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Field label="人数/数量" value={pax} onChange={(value) => setPax(value.replace(/\D/g, ""))} inputMode="numeric" />
            <Field label="负责人" value={owner} onChange={setOwner} placeholder="谁负责跟进" />
          </div>
          <p className="-mt-2 text-xs text-stone-400">系统参考：可按 {serviceGroupCount} 组/桌/套餐沟通</p>

          <Segment label="来源渠道" options={channelOptions} value={channel} onChange={setChannel} />

          <div>
            <label className="text-xs font-medium text-stone-500 dark:text-stone-400">预算（可自定义）</label>
            <div className="mt-2 flex flex-wrap gap-2">
              {budgetOptions.map((item) => (
                <button key={item} type="button" onClick={() => setBudget(item)} className={`rounded-full border px-3 py-1.5 text-xs font-medium ${budget === item ? "border-amber-400 bg-amber-50 text-amber-600 dark:bg-amber-950/30 dark:text-amber-300" : "border-stone-200 text-stone-500 dark:border-stone-700 dark:text-stone-400"}`}>
                  {item}
                </button>
              ))}
            </div>
            <input value={budget} onChange={(event) => setBudget(event.target.value)} placeholder="如：RM 500/人、RM 3000 总预算、客户还没说预算" className="mt-2 w-full rounded-xl border border-stone-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-amber-400 dark:border-stone-700 dark:bg-stone-950" />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Field label="订单金额 RM" value={amount} onChange={setAmount} placeholder="预计或确认金额" inputMode="decimal" />
            <Field label="已收订金 RM" value={deposit} onChange={setDeposit} placeholder="未收填 0" inputMode="decimal" />
          </div>
          <div className="rounded-xl bg-stone-100 px-3 py-2 text-sm text-stone-600 dark:bg-stone-950 dark:text-stone-300">
            还需收款：<span className="font-semibold text-red-500">{formatMoney(balance)}</span>
          </div>

          <Segment label="订单状态" options={orderStatusOptions} value={status} onChange={setStatus} tone="emerald" />

          <Field label="下次跟进日期" value={nextFollowUp} onChange={setNextFollowUp} type="date" />

          <div>
            <label className="text-xs font-medium text-stone-500 dark:text-stone-400">特别备注</label>
            <textarea value={notes} onChange={(event) => setNotes(event.target.value)} rows={3} placeholder="如：不要辣、需要送餐、要发票、活动主题、过敏提醒" className="mt-1.5 w-full resize-none rounded-xl border border-stone-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-amber-400 dark:border-stone-700 dark:bg-stone-950" />
          </div>

          <button onClick={saveRecord} className="w-full rounded-2xl bg-stone-900 py-3 text-sm font-semibold text-white transition-transform active:scale-[0.98] dark:bg-stone-100 dark:text-stone-950">
            {saved ? "已保存订单" : "保存订单记录"}
          </button>
          {syncResult && (
            <div className="rounded-2xl bg-emerald-50 px-3 py-2 text-xs leading-5 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-300">
              自动同步：客户资料 {syncResult.customer === "skipped" ? "未同步" : syncResult.customer === "created" ? "已新增" : "已更新"} · 预订日历 {syncResult.booking === "skipped" ? "未同步" : syncResult.booking === "created" ? "已新增" : "已更新"}
            </div>
          )}
        </section>

        <section className="overflow-hidden rounded-2xl border border-stone-200/70 bg-white dark:border-stone-800 dark:bg-stone-900/60">
          <div className="flex items-center justify-between border-b border-stone-100 px-4 py-3 dark:border-stone-800">
            <h2 className="text-sm font-semibold text-stone-900 dark:text-stone-100">WhatsApp 回复</h2>
            <button onClick={copyQuote} className="text-xs font-medium text-amber-500">{copied ? "已复制" : "复制"}</button>
          </div>
          <pre className="whitespace-pre-wrap px-4 py-3 font-sans text-sm leading-7 text-stone-700 dark:text-stone-300">{quote}</pre>
        </section>

        <section>
          <div className="mb-2.5 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-stone-900 dark:text-stone-100">订单记录</h2>
            <span className="text-xs text-stone-400">保存在这台设备</span>
          </div>
          <div className="mb-3 flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
            {filterOptions.map((item) => (
              <button key={item} onClick={() => setFilter(item)} className={`whitespace-nowrap rounded-full border px-3 py-1.5 text-xs font-medium ${filter === item ? "border-stone-900 bg-stone-900 text-white dark:border-stone-100 dark:bg-stone-100 dark:text-stone-950" : "border-stone-200 bg-white text-stone-500 dark:border-stone-700 dark:bg-stone-900/60 dark:text-stone-400"}`}>
                {item}
              </button>
            ))}
          </div>

          {filteredRecords.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-stone-300 bg-white px-4 py-6 text-center dark:border-stone-700 dark:bg-stone-900/60">
              <p className="text-sm font-medium text-stone-700 dark:text-stone-200">还没有对应订单</p>
              <p className="mt-1 text-xs leading-5 text-stone-400">先把 WhatsApp、电话、Walk-in 的询问记下来，系统才会提醒跟进和收款。</p>
            </div>
          ) : (
            <div className="space-y-2">
              {filteredRecords.map((record) => (
                <OrderCard key={record.id} record={record} onUpdate={updateRecord} onDelete={deleteRecord} />
              ))}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}

function MetricCard({ label, value, tone = "stone" }: { label: string; value: string; tone?: "stone" | "amber" | "red" }) {
  const color = tone === "red" ? "text-red-500" : tone === "amber" ? "text-amber-500" : "text-stone-900 dark:text-stone-100";
  return (
    <div className="rounded-2xl border border-stone-200/70 bg-white p-3 dark:border-stone-800 dark:bg-stone-900/60">
      <p className="text-xs text-stone-400">{label}</p>
      <p className={`mt-1 text-lg font-semibold ${color}`}>{value}</p>
    </div>
  );
}

function MiniStat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl bg-stone-100 px-3 py-2 dark:bg-stone-950">
      <p className="text-[11px] text-stone-400">{label}</p>
      <p className="mt-0.5 text-base font-semibold text-stone-900 dark:text-stone-100">{value}</p>
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

function OrderCard({ record, onUpdate, onDelete }: { record: OrderRecord; onUpdate: (id: string, patch: Partial<OrderRecord>) => void; onDelete: (id: string) => void }) {
  const balance = orderBalance(record);
  const due = record.nextFollowUp && record.nextFollowUp <= new Date().toISOString().slice(0, 10) && record.status !== "已完成";

  return (
    <div className={`rounded-2xl border bg-white p-3 dark:bg-stone-900/60 ${due ? "border-amber-300 dark:border-amber-900" : "border-stone-200/70 dark:border-stone-800"}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-stone-900 dark:text-stone-100">{record.customerName} · {record.orderType}</p>
          <p className="mt-1 text-xs text-stone-400">{record.channel} · {record.date} {record.time} · {record.pax} 人/份</p>
          {record.customerPhone && <p className="mt-1 text-xs text-stone-400">电话：{record.customerPhone}</p>}
        </div>
        <span className="rounded-full bg-stone-100 px-2 py-1 text-[11px] text-stone-500 dark:bg-stone-800 dark:text-stone-300">{record.status}</span>
      </div>
      <div className="mt-3 grid grid-cols-3 gap-2 text-xs">
        <MoneyBox label="金额" value={formatMoney(toNumber(record.amount))} />
        <MoneyBox label="订金" value={formatMoney(toNumber(record.deposit))} />
        <MoneyBox label="尾款" value={formatMoney(balance)} danger={balance > 0} />
      </div>
      {(record.nextFollowUp || record.owner || record.notes) && (
        <p className="mt-3 text-xs leading-5 text-stone-500 dark:text-stone-400">
          {record.nextFollowUp ? `跟进：${record.nextFollowUp}` : ""}{record.owner ? ` · 负责人：${record.owner}` : ""}{record.notes ? ` · ${record.notes}` : ""}
        </p>
      )}
      <div className="mt-3 flex flex-wrap gap-2">
        <button onClick={() => onUpdate(record.id, { status: "已确认" })} className="rounded-full bg-emerald-50 px-3 py-1.5 text-xs font-medium text-emerald-600 dark:bg-emerald-950/30 dark:text-emerald-300">已确认</button>
        <button onClick={() => onUpdate(record.id, { deposit: record.amount, status: "已完成" })} className="rounded-full bg-stone-100 px-3 py-1.5 text-xs font-medium text-stone-600 dark:bg-stone-800 dark:text-stone-300">收完款</button>
        <button onClick={() => onDelete(record.id)} className="rounded-full px-3 py-1.5 text-xs font-medium text-stone-400">删除</button>
      </div>
    </div>
  );
}

function MoneyBox({ label, value, danger = false }: { label: string; value: string; danger?: boolean }) {
  return (
    <div className="rounded-xl bg-stone-100 px-2.5 py-2 dark:bg-stone-950">
      <p className="text-[11px] text-stone-400">{label}</p>
      <p className={`mt-0.5 font-semibold ${danger ? "text-red-500" : "text-stone-800 dark:text-stone-100"}`}>{value}</p>
    </div>
  );
}
