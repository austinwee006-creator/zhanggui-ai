"use client";

import type { ReactNode } from "react";
import { useEffect, useMemo, useState } from "react";
import {
  bookingBalance,
  bookingStatusOptions,
  formatMoney,
  hasBookingConflict,
  isBookingInFutureWindow,
  isBookingUnpaidDeposit,
  loadBookingRecords,
  orderTypeOptions,
  saveBookingRecords,
  toNumber,
  type BookingRecord,
} from "../lib/businessRecords";
import { useLanguage } from "../components/LanguageProvider";
import { defaultRestaurantProfile, fieldOr, loadRestaurantProfile, profileFallback } from "../lib/restaurantProfile";

const todayText = new Date().toISOString().slice(0, 10);
const filterOptions = ["全部", "今天", "明天", "未来7天", "撞时段", "未收订金"];

function addDays(days: number) {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
}

const tomorrowText = addDays(1);

export default function CalendarPage() {
  const { language } = useLanguage();
  const [profile, setProfile] = useState(defaultRestaurantProfile);
  const [records, setRecords] = useState<BookingRecord[]>([]);
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [orderType, setOrderType] = useState("堂食预订");
  const [date, setDate] = useState(todayText);
  const [startTime, setStartTime] = useState("18:00");
  const [endTime, setEndTime] = useState("20:00");
  const [pax, setPax] = useState("10");
  const [amount, setAmount] = useState("");
  const [deposit, setDeposit] = useState("");
  const [owner, setOwner] = useState("");
  const [status, setStatus] = useState("新预订");
  const [notes, setNotes] = useState("");
  const [filter, setFilter] = useState("全部");
  const [saved, setSaved] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setProfile(loadRestaurantProfile());
      setRecords(loadBookingRecords());
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  const stats = useMemo(() => {
    const futureBookings = records.filter((record) => isBookingInFutureWindow(record));
    const unpaidDeposits = records.filter((record) => isBookingUnpaidDeposit(record));
    const conflicts = records.filter((record) => hasBookingConflict(record, records));
    const missingOwner = records.filter((record) => isBookingInFutureWindow(record) && record.owner.trim() === "");
    const todayBookings = records.filter((record) => record.date === todayText && record.status !== "已取消");
    const tomorrowBookings = records.filter((record) => record.date === tomorrowText && record.status !== "已取消");
    const depositBalance = unpaidDeposits.reduce((sum, record) => sum + bookingBalance(record), 0);
    return { futureBookings, unpaidDeposits, conflicts, missingOwner, todayBookings, tomorrowBookings, depositBalance };
  }, [records]);

  const filteredRecords = useMemo(() => {
    return records
      .filter((record) => {
        if (filter === "今天") return record.date === todayText;
        if (filter === "明天") return record.date === tomorrowText;
        if (filter === "未来7天") return isBookingInFutureWindow(record);
        if (filter === "撞时段") return hasBookingConflict(record, records);
        if (filter === "未收订金") return isBookingUnpaidDeposit(record);
        return true;
      })
      .slice()
      .sort((a, b) => `${a.date} ${a.startTime}`.localeCompare(`${b.date} ${b.startTime}`));
  }, [filter, records]);

  const confirmationText = useMemo(() => {
    const brand = fieldOr(profile.name, profileFallback.name);
    const balance = Math.max(0, toNumber(amount) - toNumber(deposit));
    const amountLine = amount ? `\n金额：${formatMoney(toNumber(amount))}` : "";
    const depositLine = amount ? `\n已收订金：${formatMoney(toNumber(deposit))}\n待收尾款：${formatMoney(balance)}` : "";
    const ownerLine = owner ? `\n负责人：${owner}` : "";
    const noteLine = notes ? `\n备注：${notes}` : "";

    if (language === "en") {
      return `Hello ${customerName || "boss"}, this is ${brand}.\n\nI have confirmed your booking details:\nType: ${orderType}\nDate: ${date || "Date not set"}\nTime: ${startTime || "Not set"}-${endTime || "Not set"}\nPax/Qty: ${pax || "0"}${amount ? `\nAmount: ${formatMoney(toNumber(amount))}` : ""}${amount ? `\nDeposit received: ${formatMoney(toNumber(deposit))}\nBalance due: ${formatMoney(balance)}` : ""}${owner ? `\nOwner: ${owner}` : ""}\nStatus: ${status}${notes ? `\nNotes: ${notes}` : ""}\n\nPlease check the details above. Once confirmed, we will reserve this slot for you.`;
    }

    return `${customerName || "老板"}您好，这里是${brand}。\n\n我帮您确认预订资料：\n类型：${orderType}\n日期：${date || "未定日期"}\n时间：${startTime || "未定"}-${endTime || "未定"}\n人数/数量：${pax || "0"}${amountLine}${depositLine}${ownerLine}\n状态：${status}${noteLine}\n\n请您核对以上资料。确认后我们会按这个时间帮您预留档期。`;
  }, [amount, customerName, date, deposit, endTime, language, notes, orderType, owner, pax, profile.name, startTime, status]);

  const advice = useMemo(() => {
    if (language === "en") {
      if (records.length === 0) return "Enter future bookings first so the system can flag conflicts, deposits and owners.";
      if (stats.conflicts.length > 0) return `${stats.conflicts.length} bookings have time conflicts. Check tables, staffing and kitchen capacity first.`;
      if (stats.unpaidDeposits.length > 0) return `${stats.unpaidDeposits.length} bookings have no deposit. Send the confirmation message first to reduce cancellations.`;
      if (stats.missingOwner.length > 0) return `${stats.missingOwner.length} future bookings still have no owner and may be missed.`;
      return `There are ${stats.futureBookings.length} bookings in the next 7 days. The schedule has no obvious risk right now.`;
    }

    if (records.length === 0) return "先把未来预订录进去，系统才会提醒撞单、订金和负责人。";
    if (stats.conflicts.length > 0) return `${stats.conflicts.length} 个预订有撞时段风险，先确认桌位、人手和出餐能力。`;
    if (stats.unpaidDeposits.length > 0) return `${stats.unpaidDeposits.length} 个预订未收订金，先发确认话术避免临时取消。`;
    if (stats.missingOwner.length > 0) return `${stats.missingOwner.length} 个未来预订还没安排负责人，容易漏跟。`;
    return `未来 7 天有 ${stats.futureBookings.length} 个预订，档期目前没有明显风险。`;
  }, [language, records.length, stats.conflicts.length, stats.futureBookings.length, stats.missingOwner.length, stats.unpaidDeposits.length]);

  const saveRecord = () => {
    const nextRecord: BookingRecord = {
      id: String(Date.now()),
      customerName: customerName || "未填称呼",
      customerPhone,
      orderType,
      date,
      startTime,
      endTime,
      pax: pax || "0",
      amount: amount || "0",
      deposit: deposit || "0",
      owner,
      status,
      notes,
      sourceOrderId: "",
      createdAt: new Date().toISOString(),
    };
    const nextRecords = [nextRecord, ...records].slice(0, 160);
    setRecords(nextRecords);
    saveBookingRecords(nextRecords);
    setSaved(true);
    setTimeout(() => setSaved(false), 1600);
  };

  const updateRecord = (id: string, patch: Partial<BookingRecord>) => {
    const nextRecords = records.map((record) => (record.id === id ? { ...record, ...patch } : record));
    setRecords(nextRecords);
    saveBookingRecords(nextRecords);
  };

  const deleteRecord = (id: string) => {
    const nextRecords = records.filter((record) => record.id !== id);
    setRecords(nextRecords);
    saveBookingRecords(nextRecords);
  };

  const copyConfirmation = async () => {
    await navigator.clipboard.writeText(confirmationText);
    setCopied(true);
    setTimeout(() => setCopied(false), 1600);
  };

  return (
    <div className="h-full overflow-y-auto bg-stone-50 dark:bg-[#111110]">
      <header className="sticky top-0 z-10 border-b border-stone-200/70 bg-stone-50/90 px-4 py-3 backdrop-blur-md dark:border-stone-800/70 dark:bg-[#111110]/90">
        <h1 className="text-base font-semibold text-stone-900 dark:text-stone-100">预订日历</h1>
        <p className="mt-0.5 text-xs text-stone-400">看未来档期、避免撞单漏单、追订金和负责人</p>
      </header>

      <main className="space-y-5 px-4 py-5">
        <section className="grid grid-cols-3 gap-2.5">
          <MetricCard label="今日预订" value={String(stats.todayBookings.length)} />
          <MetricCard label="明日预订" value={String(stats.tomorrowBookings.length)} />
          <MetricCard label="未来7天" value={String(stats.futureBookings.length)} />
        </section>

        <section className="rounded-2xl bg-stone-900 p-4 text-white dark:bg-stone-100 dark:text-stone-950">
          <p className="text-xs opacity-60">掌柜 AI 档期判断</p>
          <h2 className="mt-1 text-lg font-semibold leading-snug">{advice}</h2>
          <div className="mt-4 grid grid-cols-3 gap-2">
            <RiskBox label="撞时段" value={stats.conflicts.length} danger={stats.conflicts.length > 0} />
            <RiskBox label="未收订金" value={stats.unpaidDeposits.length} danger={stats.unpaidDeposits.length > 0} />
            <RiskBox label="缺负责人" value={stats.missingOwner.length} danger={stats.missingOwner.length > 0} />
          </div>
        </section>

        <section className="space-y-4 rounded-2xl border border-stone-200/70 bg-white p-4 dark:border-stone-800 dark:bg-stone-900/60">
          <div className="grid grid-cols-1 gap-3">
            <Field label="顾客/公司" value={customerName} onChange={setCustomerName} placeholder="如：顾客姓名、公司名、活动负责人" />
            <Field label="电话/WhatsApp" value={customerPhone} onChange={setCustomerPhone} placeholder="方便确认订金和提醒到店" inputMode="tel" />
          </div>

          <Segment label="订单类型" options={orderTypeOptions} value={orderType} onChange={setOrderType} />

          <div className="grid grid-cols-2 gap-3">
            <Field label="日期" value={date} onChange={setDate} type="date" />
            <Field label="人数/数量" value={pax} onChange={(value) => setPax(value.replace(/\D/g, ""))} inputMode="numeric" />
            <Field label="开始时间" value={startTime} onChange={setStartTime} type="time" />
            <Field label="结束时间" value={endTime} onChange={setEndTime} type="time" />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Field label="金额 RM" value={amount} onChange={setAmount} placeholder="预计或确认金额" inputMode="decimal" />
            <Field label="已收订金 RM" value={deposit} onChange={setDeposit} placeholder="未收填 0" inputMode="decimal" />
          </div>
          <div className="rounded-xl bg-stone-100 px-3 py-2 text-sm text-stone-600 dark:bg-stone-950 dark:text-stone-300">
            待收尾款：<span className="font-semibold text-red-500">{formatMoney(Math.max(0, toNumber(amount) - toNumber(deposit)))}</span>
          </div>

          <Field label="负责人" value={owner} onChange={setOwner} placeholder="谁负责确认、接待、出餐或送餐" />
          <Segment label="预订状态" options={bookingStatusOptions} value={status} onChange={setStatus} tone="emerald" />

          <div>
            <label className="text-xs font-medium text-stone-500 dark:text-stone-400">备注</label>
            <textarea value={notes} onChange={(event) => setNotes(event.target.value)} rows={3} placeholder="如：包厢、儿童椅、不要辣、送餐地址、发票、过敏提醒" className="mt-1.5 w-full resize-none rounded-xl border border-stone-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-amber-400 dark:border-stone-700 dark:bg-stone-950" />
          </div>

          <button onClick={saveRecord} className="w-full rounded-2xl bg-stone-900 py-3 text-sm font-semibold text-white transition-transform active:scale-[0.98] dark:bg-stone-100 dark:text-stone-950">
            {saved ? "已保存预订" : "保存预订"}
          </button>
        </section>

        <section className="overflow-hidden rounded-2xl border border-stone-200/70 bg-white dark:border-stone-800 dark:bg-stone-900/60">
          <div className="flex items-center justify-between border-b border-stone-100 px-4 py-3 dark:border-stone-800">
            <h2 className="text-sm font-semibold text-stone-900 dark:text-stone-100">确认话术</h2>
            <button onClick={copyConfirmation} className="text-xs font-medium text-amber-500">{copied ? "已复制" : "复制"}</button>
          </div>
          <pre className="whitespace-pre-wrap px-4 py-3 font-sans text-sm leading-7 text-stone-700 dark:text-stone-300">{confirmationText}</pre>
        </section>

        <section>
          <div className="mb-2.5 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-stone-900 dark:text-stone-100">预订记录</h2>
            <span className="text-xs text-stone-400">未收订金 {formatMoney(stats.depositBalance)}</span>
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
              <p className="text-sm font-medium text-stone-700 dark:text-stone-200">还没有对应预订</p>
              <p className="mt-1 text-xs leading-5 text-stone-400">先把未来档期记下来，系统才会提醒撞时段、订金和负责人。</p>
            </div>
          ) : (
            <div className="space-y-2">
              {filteredRecords.map((record) => (
                <BookingCard key={record.id} record={record} conflict={hasBookingConflict(record, records)} onUpdate={updateRecord} onDelete={deleteRecord} />
              ))}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}

function MetricCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-stone-200/70 bg-white p-3 dark:border-stone-800 dark:bg-stone-900/60">
      <p className="text-xs text-stone-400">{label}</p>
      <p className="mt-1 text-lg font-semibold text-stone-900 dark:text-stone-100">{value}</p>
    </div>
  );
}

function RiskBox({ label, value, danger = false }: { label: string; value: number; danger?: boolean }) {
  return (
    <div className="rounded-xl bg-white/10 px-3 py-2 dark:bg-stone-950/10">
      <p className="text-[11px] opacity-60">{label}</p>
      <p className={`mt-0.5 text-base font-semibold ${danger ? "text-red-300 dark:text-red-500" : ""}`}>{value}</p>
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

function BookingCard({ record, conflict, onUpdate, onDelete }: { record: BookingRecord; conflict: boolean; onUpdate: (id: string, patch: Partial<BookingRecord>) => void; onDelete: (id: string) => void }) {
  const unpaidDeposit = isBookingUnpaidDeposit(record);
  const missingOwner = isBookingInFutureWindow(record) && record.owner.trim() === "";
  const border = conflict || unpaidDeposit || missingOwner ? "border-amber-300 dark:border-amber-900" : "border-stone-200/70 dark:border-stone-800";

  return (
    <div className={`rounded-2xl border bg-white p-3 dark:bg-stone-900/60 ${border}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-stone-900 dark:text-stone-100">{record.date} · {record.startTime}-{record.endTime}</p>
          <p className="mt-1 text-xs text-stone-400">{record.customerName} · {record.orderType} · {record.pax} 人/份</p>
          {record.customerPhone && <p className="mt-1 text-xs text-stone-400">电话：{record.customerPhone}</p>}
        </div>
        <span className="rounded-full bg-stone-100 px-2 py-1 text-[11px] text-stone-500 dark:bg-stone-800 dark:text-stone-300">{record.status}</span>
      </div>

      <div className="mt-3 grid grid-cols-3 gap-2 text-xs">
        <MiniBox label="金额" value={formatMoney(toNumber(record.amount))} />
        <MiniBox label="订金" value={formatMoney(toNumber(record.deposit))} danger={unpaidDeposit} />
        <MiniBox label="尾款" value={formatMoney(bookingBalance(record))} danger={bookingBalance(record) > 0} />
      </div>

      <div className="mt-3 flex flex-wrap gap-1.5">
        {conflict && <Tag tone="red">撞时段</Tag>}
        {unpaidDeposit && <Tag tone="amber">未收订金</Tag>}
        {missingOwner && <Tag tone="amber">未安排负责人</Tag>}
        {record.owner && <Tag tone="stone">负责人：{record.owner}</Tag>}
      </div>

      {record.notes && <p className="mt-3 text-xs leading-5 text-stone-500 dark:text-stone-400">备注：{record.notes}</p>}

      <div className="mt-3 flex flex-wrap gap-2">
        <button onClick={() => onUpdate(record.id, { status: "已确认" })} className="rounded-full bg-emerald-50 px-3 py-1.5 text-xs font-medium text-emerald-600 dark:bg-emerald-950/30 dark:text-emerald-300">已确认</button>
        <button onClick={() => onUpdate(record.id, { status: "已完成" })} className="rounded-full bg-stone-100 px-3 py-1.5 text-xs font-medium text-stone-600 dark:bg-stone-800 dark:text-stone-300">已完成</button>
        <button onClick={() => onDelete(record.id)} className="rounded-full px-3 py-1.5 text-xs font-medium text-stone-400">删除</button>
      </div>
    </div>
  );
}

function MiniBox({ label, value, danger = false }: { label: string; value: string; danger?: boolean }) {
  return (
    <div className="rounded-xl bg-stone-100 px-2.5 py-2 dark:bg-stone-950">
      <p className="text-[11px] text-stone-400">{label}</p>
      <p className={`mt-0.5 font-semibold ${danger ? "text-red-500" : "text-stone-800 dark:text-stone-100"}`}>{value}</p>
    </div>
  );
}

function Tag({ children, tone }: { children: ReactNode; tone: "red" | "amber" | "stone" }) {
  const color =
    tone === "red"
      ? "bg-red-50 text-red-600 dark:bg-red-950/30 dark:text-red-300"
      : tone === "amber"
        ? "bg-amber-50 text-amber-600 dark:bg-amber-950/30 dark:text-amber-300"
        : "bg-stone-100 text-stone-500 dark:bg-stone-800 dark:text-stone-300";
  return <span className={`rounded-full px-2 py-1 text-[11px] ${color}`}>{children}</span>;
}
