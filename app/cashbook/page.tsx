"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  closingCashGap,
  closingExpenses,
  closingGrossSales,
  closingNetCash,
  formatMoney,
  isSupplierPurchaseDue,
  isSupplierPurchaseOverdue,
  loadDailyClosingRecords,
  loadSupplierPurchaseRecords,
  saveDailyClosingRecords,
  supplierOutstandingTotal,
  supplierPurchaseBalance,
  toNumber,
  type DailyClosingRecord,
  type SupplierPurchaseRecord,
} from "../lib/businessRecords";

const todayText = new Date().toISOString().slice(0, 10);
const drawerDenominations = [
  { key: "rm100", label: "RM100", value: 100 },
  { key: "rm50", label: "RM50", value: 50 },
  { key: "rm20", label: "RM20", value: 20 },
  { key: "rm10", label: "RM10", value: 10 },
  { key: "rm5", label: "RM5", value: 5 },
  { key: "rm1", label: "RM1", value: 1 },
  { key: "coins", label: "零钱金额", value: 1 },
] as const;

type DrawerKey = (typeof drawerDenominations)[number]["key"];
const emptyDrawerCounts: Record<DrawerKey, string> = {
  rm100: "",
  rm50: "",
  rm20: "",
  rm10: "",
  rm5: "",
  rm1: "",
  coins: "",
};

export default function CashbookPage() {
  const [records, setRecords] = useState<DailyClosingRecord[]>([]);
  const [supplierPurchases, setSupplierPurchases] = useState<SupplierPurchaseRecord[]>([]);
  const [date, setDate] = useState(todayText);
  const [cashSales, setCashSales] = useState("");
  const [qrSales, setQrSales] = useState("");
  const [cardSales, setCardSales] = useState("");
  const [platformSales, setPlatformSales] = useState("");
  const [otherSales, setOtherSales] = useState("");
  const [cashInDrawer, setCashInDrawer] = useState("");
  const [platformFees, setPlatformFees] = useState("");
  const [foodPurchase, setFoodPurchase] = useState("");
  const [packagingCost, setPackagingCost] = useState("");
  const [staffCost, setStaffCost] = useState("");
  const [rentUtility, setRentUtility] = useState("");
  const [otherExpense, setOtherExpense] = useState("");
  const [wastage, setWastage] = useState("");
  const [notes, setNotes] = useState("");
  const [drawerCounts, setDrawerCounts] = useState<Record<DrawerKey, string>>(emptyDrawerCounts);
  const [saved, setSaved] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setRecords(loadDailyClosingRecords());
      setSupplierPurchases(loadSupplierPurchaseRecords());
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  const draft = useMemo<DailyClosingRecord>(() => ({
    id: "draft",
    date,
    cashSales: cashSales || "0",
    qrSales: qrSales || "0",
    cardSales: cardSales || "0",
    platformSales: platformSales || "0",
    otherSales: otherSales || "0",
    cashInDrawer: cashInDrawer || "0",
    platformFees: platformFees || "0",
    foodPurchase: foodPurchase || "0",
    packagingCost: packagingCost || "0",
    staffCost: staffCost || "0",
    rentUtility: rentUtility || "0",
    otherExpense: otherExpense || "0",
    wastage: wastage || "0",
    notes,
    createdAt: new Date().toISOString(),
  }), [cardSales, cashInDrawer, cashSales, date, foodPurchase, notes, otherExpense, otherSales, packagingCost, platformFees, platformSales, qrSales, rentUtility, staffCost, wastage]);

  const grossSales = closingGrossSales(draft);
  const expenses = closingExpenses(draft);
  const netCash = closingNetCash(draft);
  const cashGap = closingCashGap(draft);
  const foodCostRate = grossSales > 0 ? ((toNumber(foodPurchase) + toNumber(wastage)) / grossSales) * 100 : 0;
  const platformRate = toNumber(platformSales) > 0 ? (toNumber(platformFees) / toNumber(platformSales)) * 100 : 0;
  const nonCashSales = toNumber(qrSales) + toNumber(cardSales) + toNumber(platformSales) + toNumber(otherSales);
  const cashSalesRate = grossSales > 0 ? (toNumber(cashSales) / grossSales) * 100 : 0;
  const drawerCountTotal = drawerDenominations.reduce((sum, item) => sum + toNumber(drawerCounts[item.key]) * item.value, 0);
  const hasDrawerCount = Object.values(drawerCounts).some((value) => value.trim() !== "");

  const monthly = useMemo(() => {
    const month = date.slice(0, 7);
    return records
      .filter((record) => record.date.startsWith(month))
      .reduce(
        (acc, record) => {
          acc.sales += closingGrossSales(record);
          acc.expenses += closingExpenses(record);
          acc.net += closingNetCash(record);
          return acc;
        },
        { sales: 0, expenses: 0, net: 0 }
      );
  }, [date, records]);

  const supplierRisk = useMemo(() => {
    const dueSoon = supplierPurchases.filter((record) => isSupplierPurchaseDue(record) && !isSupplierPurchaseOverdue(record));
    const overdue = supplierPurchases.filter((record) => isSupplierPurchaseOverdue(record));
    const dueBalance = [...dueSoon, ...overdue].reduce((sum, record) => sum + supplierPurchaseBalance(record), 0);
    return {
      outstanding: supplierOutstandingTotal(supplierPurchases),
      dueSoon,
      overdue,
      dueBalance,
      netAfterDue: netCash - dueBalance,
    };
  }, [netCash, supplierPurchases]);

  const advice = useMemo(() => {
    const items = [];
    if (grossSales <= 0) items.push("先填今天各渠道营业额，结算才会有判断。");
    if (Math.abs(cashGap) > 5) items.push(`现金差额 ${formatMoney(cashGap)}，今晚先查收银、找零和员工代收。`);
    if (supplierRisk.overdue.length > 0) items.push(`${supplierRisk.overdue.length} 笔供应商款项逾期，关店前要决定明天先付谁。`);
    if (supplierRisk.dueBalance > 0 && supplierRisk.netAfterDue < 0) items.push(`扣掉到期供应商款 ${formatMoney(supplierRisk.dueBalance)} 后现金不足，明天先控采购和折扣。`);
    if (foodCostRate > 38) items.push(`食材/损耗占比 ${foodCostRate.toFixed(1)}%，偏高，明天要查采购量、报废和份量。`);
    if (platformRate > 25) items.push(`平台抽佣占平台销售 ${platformRate.toFixed(1)}%，考虑把老客导到自取或 WhatsApp 下单。`);
    if (netCash > 0 && items.length === 0) items.push("今天账目健康，重点保留有效客源和高毛利产品。");
    if (netCash < 0) items.push("今天现金流为负，先暂停低毛利折扣，检查采购和人工排班。");
    return items;
  }, [cashGap, foodCostRate, grossSales, netCash, platformRate, supplierRisk.dueBalance, supplierRisk.netAfterDue, supplierRisk.overdue.length]);

  const closingText = useMemo(() => {
    return `每日结算交接\n日期：${date}\n\n收入：${formatMoney(grossSales)}\n- 现金：${formatMoney(toNumber(cashSales))}\n- QR / DuitNow：${formatMoney(toNumber(qrSales))}\n- 刷卡：${formatMoney(toNumber(cardSales))}\n- 外卖平台：${formatMoney(toNumber(platformSales))}\n- 其他：${formatMoney(toNumber(otherSales))}\n\n支出：${formatMoney(expenses)}\n- 平台抽佣：${formatMoney(toNumber(platformFees))}\n- 食材采购：${formatMoney(toNumber(foodPurchase))}\n- 包装耗材：${formatMoney(toNumber(packagingCost))}\n- 人工/兼职：${formatMoney(toNumber(staffCost))}\n- 租金水电：${formatMoney(toNumber(rentUtility))}\n- 报废损耗：${formatMoney(toNumber(wastage))}\n- 其他支出：${formatMoney(toNumber(otherExpense))}\n\n现金流：${formatMoney(netCash)}\n钱箱现金：${formatMoney(toNumber(cashInDrawer))}\n现金差额：${formatMoney(cashGap)}\n食材/损耗占比：${foodCostRate.toFixed(1)}%\n平台抽佣率：${platformRate.toFixed(1)}%\n供应商待付款：${formatMoney(supplierRisk.outstanding)}\n到期/逾期供应商款：${formatMoney(supplierRisk.dueBalance)}\n\n老板提醒：${advice.join(" ")}\n备注：${notes || "无"}`;
  }, [advice, cardSales, cashGap, cashInDrawer, cashSales, date, expenses, foodCostRate, foodPurchase, grossSales, netCash, notes, otherExpense, otherSales, packagingCost, platformFees, platformRate, platformSales, qrSales, rentUtility, staffCost, supplierRisk.dueBalance, supplierRisk.outstanding, wastage]);

  const saveRecord = () => {
    const nextRecord = { ...draft, id: String(Date.now()), createdAt: new Date().toISOString() };
    const nextRecords = [nextRecord, ...records.filter((record) => record.date !== date)].slice(0, 120);
    setRecords(nextRecords);
    saveDailyClosingRecords(nextRecords);
    setSaved(true);
    setTimeout(() => setSaved(false), 1600);
  };

  const loadRecordToForm = (record: DailyClosingRecord) => {
    setDate(record.date);
    setCashSales(record.cashSales);
    setQrSales(record.qrSales);
    setCardSales(record.cardSales);
    setPlatformSales(record.platformSales);
    setOtherSales(record.otherSales);
    setCashInDrawer(record.cashInDrawer);
    setPlatformFees(record.platformFees);
    setFoodPurchase(record.foodPurchase);
    setPackagingCost(record.packagingCost);
    setStaffCost(record.staffCost);
    setRentUtility(record.rentUtility);
    setOtherExpense(record.otherExpense);
    setWastage(record.wastage);
    setNotes(record.notes);
  };

  const deleteRecord = (id: string) => {
    const nextRecords = records.filter((record) => record.id !== id);
    setRecords(nextRecords);
    saveDailyClosingRecords(nextRecords);
  };

  const updateDrawerCount = (key: DrawerKey, value: string) => {
    setDrawerCounts((prev) => ({ ...prev, [key]: value.replace(/[^\d.]/g, "") }));
  };

  const applyDrawerCount = () => {
    setCashInDrawer(drawerCountTotal.toFixed(2));
  };

  const resetDrawerCount = () => {
    setDrawerCounts(emptyDrawerCounts);
  };

  const copyClosing = async () => {
    await navigator.clipboard.writeText(closingText);
    setCopied(true);
    setTimeout(() => setCopied(false), 1600);
  };

  return (
    <div className="h-full overflow-y-auto bg-stone-50 dark:bg-[#111110]">
      <header className="sticky top-0 z-10 border-b border-stone-200/70 bg-stone-50/90 px-4 py-3 backdrop-blur-md dark:border-stone-800/70 dark:bg-[#111110]/90">
        <h1 className="text-base font-semibold text-stone-900 dark:text-stone-100">每日结算</h1>
        <p className="mt-0.5 text-xs text-stone-400">记录营业额、支出、现金差额和经营风险</p>
      </header>

      <main className="space-y-5 px-4 py-5">
        <section className="grid grid-cols-3 gap-2.5">
          <MetricCard label="今日营业额" value={formatMoney(grossSales)} />
          <MetricCard label="今日支出" value={formatMoney(expenses)} tone="amber" />
          <MetricCard label="现金流" value={formatMoney(netCash)} tone={netCash < 0 ? "red" : "stone"} />
        </section>

        <section className="rounded-2xl bg-stone-900 p-4 text-white dark:bg-stone-100 dark:text-stone-950">
          <p className="text-xs opacity-60">掌柜 AI 结算判断</p>
          <h2 className="mt-1 text-lg font-semibold leading-snug">{advice[0]}</h2>
          <div className="mt-4 grid grid-cols-2 gap-2">
            <Insight label="现金差额" value={formatMoney(cashGap)} danger={Math.abs(cashGap) > 5} />
            <Insight label="食材/损耗" value={`${foodCostRate.toFixed(1)}%`} danger={foodCostRate > 38} />
            <Insight label="到期供应商" value={formatMoney(supplierRisk.dueBalance)} danger={supplierRisk.dueBalance > 0} />
            <Insight label="扣到期后" value={formatMoney(supplierRisk.netAfterDue)} danger={supplierRisk.netAfterDue < 0} />
          </div>
        </section>

        <section className="rounded-2xl border border-stone-200/70 bg-white p-4 dark:border-stone-800 dark:bg-stone-900/60">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="text-sm font-semibold text-stone-900 dark:text-stone-100">关店速查</h2>
              <p className="mt-1 text-xs leading-5 text-stone-400">先看现金、平台抽佣、供应商款，避免今天赚了明天现金不够。</p>
            </div>
            <button onClick={copyClosing} className="rounded-xl bg-amber-400 px-3 py-2 text-xs font-semibold text-stone-950">
              {copied ? "已复制" : "复制交接"}
            </button>
          </div>
          <div className="mt-3 grid grid-cols-2 gap-2">
            <MiniStat label="非现金收入" value={formatMoney(nonCashSales)} />
            <MiniStat label="现金占比" value={`${cashSalesRate.toFixed(0)}%`} />
            <MiniStat label="供应商待付" value={formatMoney(supplierRisk.outstanding)} danger={supplierRisk.outstanding > 0} />
            <MiniStat label="逾期/到期" value={`${supplierRisk.overdue.length}/${supplierRisk.dueSoon.length} 笔`} danger={supplierRisk.overdue.length + supplierRisk.dueSoon.length > 0} />
          </div>
          {(supplierRisk.overdue.length > 0 || supplierRisk.dueSoon.length > 0) && (
            <Link href="/suppliers" className="mt-3 block rounded-xl bg-red-50 px-3 py-2 text-xs font-medium text-red-600 dark:bg-red-950/30 dark:text-red-300">
              处理供应商付款：逾期 {supplierRisk.overdue.length} 笔，3 天内到期 {supplierRisk.dueSoon.length} 笔
            </Link>
          )}
        </section>

        <section className="space-y-4 rounded-2xl border border-stone-200/70 bg-white p-4 dark:border-stone-800 dark:bg-stone-900/60">
          <Field label="结算日期" value={date} onChange={setDate} type="date" />

          <div>
            <h2 className="text-sm font-semibold text-stone-900 dark:text-stone-100">收入</h2>
            <div className="mt-3 grid grid-cols-2 gap-3">
              <Field label="现金收入 RM" value={cashSales} onChange={setCashSales} inputMode="decimal" />
              <Field label="QR / DuitNow RM" value={qrSales} onChange={setQrSales} inputMode="decimal" />
              <Field label="刷卡收入 RM" value={cardSales} onChange={setCardSales} inputMode="decimal" />
              <Field label="外卖平台 RM" value={platformSales} onChange={setPlatformSales} inputMode="decimal" />
              <Field label="其他收入 RM" value={otherSales} onChange={setOtherSales} inputMode="decimal" />
              <Field label="钱箱现金 RM" value={cashInDrawer} onChange={setCashInDrawer} inputMode="decimal" />
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-sm font-semibold text-stone-900 dark:text-stone-100">钱箱盘点</h2>
              <span className="text-xs text-stone-400">盘点 {formatMoney(drawerCountTotal)}</span>
            </div>
            <div className="mt-3 grid grid-cols-2 gap-3">
              {drawerDenominations.map((item) => (
                <Field key={item.key} label={item.key === "coins" ? item.label : `${item.label} 张数`} value={drawerCounts[item.key]} onChange={(value) => updateDrawerCount(item.key, value)} inputMode="decimal" />
              ))}
            </div>
            <div className="mt-3 flex gap-2">
              <button type="button" onClick={applyDrawerCount} disabled={!hasDrawerCount} className="flex-1 rounded-xl bg-stone-900 px-3 py-2.5 text-xs font-semibold text-white disabled:opacity-40 dark:bg-stone-100 dark:text-stone-950">
                套用到钱箱现金
              </button>
              <button type="button" onClick={resetDrawerCount} className="rounded-xl border border-stone-200 px-3 py-2.5 text-xs font-medium text-stone-500 dark:border-stone-700 dark:text-stone-400">
                清空
              </button>
            </div>
          </div>

          <div>
            <h2 className="text-sm font-semibold text-stone-900 dark:text-stone-100">支出</h2>
            <div className="mt-3 grid grid-cols-2 gap-3">
              <Field label="平台抽佣 RM" value={platformFees} onChange={setPlatformFees} inputMode="decimal" />
              <Field label="食材采购 RM" value={foodPurchase} onChange={setFoodPurchase} inputMode="decimal" />
              <Field label="包装耗材 RM" value={packagingCost} onChange={setPackagingCost} inputMode="decimal" />
              <Field label="人工/兼职 RM" value={staffCost} onChange={setStaffCost} inputMode="decimal" />
              <Field label="租金水电 RM" value={rentUtility} onChange={setRentUtility} inputMode="decimal" />
              <Field label="报废损耗 RM" value={wastage} onChange={setWastage} inputMode="decimal" />
            </div>
            <Field label="其他支出 RM" value={otherExpense} onChange={setOtherExpense} inputMode="decimal" />
          </div>

          <div>
            <label className="text-xs font-medium text-stone-500 dark:text-stone-400">备注</label>
            <textarea value={notes} onChange={(event) => setNotes(event.target.value)} rows={3} placeholder="如：今天下雨、人手不足、平台订单多、某个产品卖得特别好" className="mt-1.5 w-full resize-none rounded-xl border border-stone-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-amber-400 dark:border-stone-700 dark:bg-stone-950" />
          </div>

          <button onClick={saveRecord} className="w-full rounded-2xl bg-stone-900 py-3 text-sm font-semibold text-white transition-transform active:scale-[0.98] dark:bg-stone-100 dark:text-stone-950">
            {saved ? "已保存结算" : "保存今日结算"}
          </button>
        </section>

        <section className="rounded-2xl border border-stone-200/70 bg-white p-4 dark:border-stone-800 dark:bg-stone-900/60">
          <h2 className="text-sm font-semibold text-stone-900 dark:text-stone-100">本月概览</h2>
          <div className="mt-3 grid grid-cols-3 gap-2">
            <MiniStat label="营业额" value={formatMoney(monthly.sales)} />
            <MiniStat label="支出" value={formatMoney(monthly.expenses)} />
            <MiniStat label="现金流" value={formatMoney(monthly.net)} danger={monthly.net < 0} />
          </div>
        </section>

        <section className="overflow-hidden rounded-2xl border border-stone-200/70 bg-white dark:border-stone-800 dark:bg-stone-900/60">
          <div className="flex items-center justify-between border-b border-stone-100 px-4 py-3 dark:border-stone-800">
            <h2 className="text-sm font-semibold text-stone-900 dark:text-stone-100">可复制关店交接</h2>
            <button onClick={copyClosing} className="text-xs font-medium text-amber-500">{copied ? "已复制" : "复制"}</button>
          </div>
          <pre className="whitespace-pre-wrap px-4 py-3 font-sans text-sm leading-7 text-stone-700 dark:text-stone-300">{closingText}</pre>
        </section>

        <section>
          <h2 className="mb-2.5 text-sm font-semibold text-stone-900 dark:text-stone-100">结算记录</h2>
          {records.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-stone-300 bg-white px-4 py-6 text-center dark:border-stone-700 dark:bg-stone-900/60">
              <p className="text-sm font-medium text-stone-700 dark:text-stone-200">还没有结算记录</p>
              <p className="mt-1 text-xs leading-5 text-stone-400">每天关店前保存一次，老板就能看出收入、支出和现金差额。</p>
            </div>
          ) : (
            <div className="space-y-2">
              {records.map((record) => (
                <ClosingCard key={record.id} record={record} onEdit={loadRecordToForm} onDelete={deleteRecord} />
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
      <p className={`mt-1 text-base font-semibold ${color}`}>{value}</p>
    </div>
  );
}

function Insight({ label, value, danger }: { label: string; value: string; danger: boolean }) {
  return (
    <div className="rounded-xl bg-white/10 px-3 py-2 dark:bg-stone-950/10">
      <p className="text-[11px] opacity-60">{label}</p>
      <p className={`mt-0.5 text-sm font-semibold ${danger ? "text-red-300 dark:text-red-500" : ""}`}>{value}</p>
    </div>
  );
}

function Field({ label, value, onChange, placeholder, type = "text", inputMode }: { label: string; value: string; onChange: (value: string) => void; placeholder?: string; type?: string; inputMode?: "text" | "tel" | "numeric" | "decimal" }) {
  return (
    <div className="mt-3 first:mt-0">
      <label className="text-xs font-medium text-stone-500 dark:text-stone-400">{label}</label>
      <input type={type} inputMode={inputMode} value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} className="mt-1.5 w-full rounded-xl border border-stone-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-amber-400 dark:border-stone-700 dark:bg-stone-950" />
    </div>
  );
}

function MiniStat({ label, value, danger = false }: { label: string; value: string; danger?: boolean }) {
  return (
    <div className="rounded-xl bg-stone-100 px-3 py-2 dark:bg-stone-950">
      <p className="text-[11px] text-stone-400">{label}</p>
      <p className={`mt-0.5 text-sm font-semibold ${danger ? "text-red-500" : "text-stone-900 dark:text-stone-100"}`}>{value}</p>
    </div>
  );
}

function ClosingCard({ record, onEdit, onDelete }: { record: DailyClosingRecord; onEdit: (record: DailyClosingRecord) => void; onDelete: (id: string) => void }) {
  const gross = closingGrossSales(record);
  const expenses = closingExpenses(record);
  const net = closingNetCash(record);
  const gap = closingCashGap(record);

  return (
    <div className="rounded-2xl border border-stone-200/70 bg-white p-3 dark:border-stone-800 dark:bg-stone-900/60">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-stone-900 dark:text-stone-100">{record.date}</p>
          <p className="mt-1 text-xs text-stone-400">营业额 {formatMoney(gross)} · 支出 {formatMoney(expenses)}</p>
        </div>
        <span className={`rounded-full px-2 py-1 text-[11px] ${net < 0 ? "bg-red-50 text-red-500 dark:bg-red-950/30" : "bg-emerald-50 text-emerald-600 dark:bg-emerald-950/30 dark:text-emerald-300"}`}>
          {formatMoney(net)}
        </span>
      </div>
      <div className="mt-3 grid grid-cols-2 gap-2">
        <MiniStat label="现金差额" value={formatMoney(gap)} danger={Math.abs(gap) > 5} />
        <MiniStat label="平台销售" value={formatMoney(toNumber(record.platformSales))} />
      </div>
      {record.notes && <p className="mt-3 text-xs leading-5 text-stone-500 dark:text-stone-400">{record.notes}</p>}
      <div className="mt-3 flex flex-wrap gap-2">
        <button onClick={() => onEdit(record)} className="rounded-full bg-stone-100 px-3 py-1.5 text-xs font-medium text-stone-600 dark:bg-stone-800 dark:text-stone-300">载入修改</button>
        <button onClick={() => onDelete(record.id)} className="rounded-full px-3 py-1.5 text-xs font-medium text-stone-400">删除</button>
      </div>
    </div>
  );
}
