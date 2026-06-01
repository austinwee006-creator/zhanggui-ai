"use client";

import { useEffect, useMemo, useState } from "react";
import {
  formatMoney,
  isSupplierPurchaseDue,
  isSupplierPurchaseOverdue,
  isSupplierPurchasePaid,
  loadSupplierPurchaseRecords,
  loadSupplierRecords,
  saveSupplierPurchaseRecords,
  saveSupplierRecords,
  supplierCategoryOptions,
  supplierOutstandingTotal,
  supplierPurchaseBalance,
  supplierPurchaseStatusOptions,
  toNumber,
  type SupplierPurchaseRecord,
  type SupplierRecord,
} from "../lib/businessRecords";
import { useLanguage } from "../components/LanguageProvider";
import { defaultRestaurantProfile, fieldOr, loadRestaurantProfile, profileFallback } from "../lib/restaurantProfile";

const todayText = new Date().toISOString().slice(0, 10);
const filterOptions = ["全部", "待付款", "逾期", "3天内到期", "已付款"];

function addDays(days: number) {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
}

export default function SuppliersPage() {
  const { language } = useLanguage();
  const [profile, setProfile] = useState(defaultRestaurantProfile);
  const [suppliers, setSuppliers] = useState<SupplierRecord[]>([]);
  const [purchases, setPurchases] = useState<SupplierPurchaseRecord[]>([]);
  const [supplierName, setSupplierName] = useState("");
  const [supplierCategory, setSupplierCategory] = useState("食材");
  const [supplierPhone, setSupplierPhone] = useState("");
  const [paymentTerms, setPaymentTerms] = useState("");
  const [supplierNotes, setSupplierNotes] = useState("");
  const [selectedSupplierId, setSelectedSupplierId] = useState("");
  const [purchaseSupplierName, setPurchaseSupplierName] = useState("");
  const [purchaseCategory, setPurchaseCategory] = useState("食材");
  const [purchaseDate, setPurchaseDate] = useState(todayText);
  const [dueDate, setDueDate] = useState(addDays(7));
  const [items, setItems] = useState("");
  const [amount, setAmount] = useState("");
  const [paidAmount, setPaidAmount] = useState("");
  const [status, setStatus] = useState("未付款");
  const [purchaseNotes, setPurchaseNotes] = useState("");
  const [filter, setFilter] = useState("全部");
  const [savedSupplier, setSavedSupplier] = useState(false);
  const [savedPurchase, setSavedPurchase] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setProfile(loadRestaurantProfile());
      setSuppliers(loadSupplierRecords());
      setPurchases(loadSupplierPurchaseRecords());
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  const selectedSupplier = useMemo(() => suppliers.find((supplier) => supplier.id === selectedSupplierId), [selectedSupplierId, suppliers]);

  const stats = useMemo(() => {
    const outstanding = supplierOutstandingTotal(purchases);
    const unpaid = purchases.filter((record) => !isSupplierPurchasePaid(record) && supplierPurchaseBalance(record) > 0);
    const dueSoon = purchases.filter((record) => isSupplierPurchaseDue(record) && !isSupplierPurchaseOverdue(record));
    const overdue = purchases.filter((record) => isSupplierPurchaseOverdue(record));
    const supplierBalances = suppliers
      .map((supplier) => ({
        supplier,
        balance: supplierOutstandingTotal(purchases, supplier.id),
      }))
      .filter((item) => item.balance > 0)
      .sort((a, b) => b.balance - a.balance);

    const unknownBalance = purchases.reduce((sum, record) => {
      if (record.supplierId) return sum;
      return sum + supplierPurchaseBalance(record);
    }, 0);

    return { outstanding, unpaid, dueSoon, overdue, supplierBalances, unknownBalance };
  }, [purchases, suppliers]);

  const filteredPurchases = useMemo(() => {
    return purchases
      .filter((record) => {
        if (filter === "待付款") return !isSupplierPurchasePaid(record) && supplierPurchaseBalance(record) > 0;
        if (filter === "逾期") return isSupplierPurchaseOverdue(record);
        if (filter === "3天内到期") return isSupplierPurchaseDue(record) && !isSupplierPurchaseOverdue(record);
        if (filter === "已付款") return isSupplierPurchasePaid(record);
        return true;
      })
      .slice()
      .sort((a, b) => `${a.dueDate || "9999-99-99"} ${a.purchaseDate}`.localeCompare(`${b.dueDate || "9999-99-99"} ${b.purchaseDate}`));
  }, [filter, purchases]);

  const messageText = useMemo(() => {
    const brand = fieldOr(profile.name, profileFallback.name);
    const supplier = selectedSupplier?.name || purchaseSupplierName || supplierName || "供应商";
    const balance = Math.max(0, toNumber(amount) - toNumber(paidAmount));
    const itemText = items || "采购内容待确认";
    const noteText = purchaseNotes ? `\n备注：${purchaseNotes}` : "";

    if (language === "en") {
      return `Hello ${supplier}, this is ${brand}.\n\nPurchase/payable confirmation:\nPurchase date: ${purchaseDate || "Not set"}\nPayment due: ${dueDate || "Not set"}\nItems: ${items || "Purchase items to confirm"}\nAmount: ${formatMoney(toNumber(amount))}\nPaid: ${formatMoney(toNumber(paidAmount))}\nBalance: ${formatMoney(balance)}\nStatus: ${status}${purchaseNotes ? `\nNotes: ${purchaseNotes}` : ""}\n\nPlease confirm whether the details above are correct. Thank you.`;
    }

    return `${supplier}您好，这里是${brand}。\n\n采购/账款确认：\n采购日期：${purchaseDate || "未填"}\n付款到期：${dueDate || "未填"}\n内容：${itemText}\n金额：${formatMoney(toNumber(amount))}\n已付：${formatMoney(toNumber(paidAmount))}\n余额：${formatMoney(balance)}\n状态：${status}${noteText}\n\n请帮忙确认以上资料是否正确。谢谢。`;
  }, [amount, dueDate, items, language, paidAmount, profile.name, purchaseDate, purchaseNotes, purchaseSupplierName, selectedSupplier?.name, status, supplierName]);

  const advice = useMemo(() => {
    if (language === "en") {
      if (purchases.length === 0) return "Enter regular suppliers and purchase payables first so the system can remind you when to pay.";
      if (stats.overdue.length > 0) return `${stats.overdue.length} supplier payments are overdue. Handle suppliers that affect supply first.`;
      if (stats.dueSoon.length > 0) return `${stats.dueSoon.length} payments are due within 3 days. Arrange payment or confirm payment terms first.`;
      if (stats.outstanding > 0) return `Supplier payables are ${formatMoney(stats.outstanding)}. Prioritize payments by due date.`;
      return "Supplier payables have no obvious risk right now. Keep recording purchases and payments.";
    }

    if (purchases.length === 0) return "先把常用供应商和采购欠款录进去，系统才会提醒什么时候要付款。";
    if (stats.overdue.length > 0) return `${stats.overdue.length} 笔供应商款项已逾期，先处理会影响供货的供应商。`;
    if (stats.dueSoon.length > 0) return `${stats.dueSoon.length} 笔款项 3 天内到期，先安排付款或确认账期。`;
    if (stats.outstanding > 0) return `供应商待付款 ${formatMoney(stats.outstanding)}，建议按到期日排付款顺序。`;
    return "供应商账款目前没有明显风险，继续记录采购和付款。";
  }, [language, purchases.length, stats.dueSoon.length, stats.outstanding, stats.overdue.length]);

  const chooseSupplier = (supplier: SupplierRecord) => {
    setSelectedSupplierId(supplier.id);
    setPurchaseSupplierName(supplier.name);
    setPurchaseCategory(supplier.category);
  };

  const deleteSupplier = (id: string) => {
    const nextSuppliers = suppliers.filter((supplier) => supplier.id !== id);
    const nextPurchases = purchases.map((record) => (record.supplierId === id ? { ...record, supplierId: "" } : record));
    setSuppliers(nextSuppliers);
    setPurchases(nextPurchases);
    saveSupplierRecords(nextSuppliers);
    saveSupplierPurchaseRecords(nextPurchases);
    if (selectedSupplierId === id) {
      setSelectedSupplierId("");
    }
  };

  const saveSupplier = () => {
    const nextSupplier: SupplierRecord = {
      id: String(Date.now()),
      name: supplierName || "未填供应商",
      category: supplierCategory,
      phone: supplierPhone,
      paymentTerms,
      notes: supplierNotes,
      createdAt: new Date().toISOString(),
    };
    const nextSuppliers = [nextSupplier, ...suppliers].slice(0, 120);
    setSuppliers(nextSuppliers);
    saveSupplierRecords(nextSuppliers);
    chooseSupplier(nextSupplier);
    setSavedSupplier(true);
    setTimeout(() => setSavedSupplier(false), 1600);
  };

  const savePurchase = () => {
    const supplier = selectedSupplier;
    const nextRecord: SupplierPurchaseRecord = {
      id: String(Date.now()),
      supplierId: supplier?.id || "",
      supplierName: supplier?.name || purchaseSupplierName || supplierName || "未填供应商",
      category: supplier?.category || purchaseCategory,
      purchaseDate,
      dueDate,
      items,
      amount: amount || "0",
      paidAmount: paidAmount || "0",
      status,
      notes: purchaseNotes,
      createdAt: new Date().toISOString(),
    };
    const nextPurchases = [nextRecord, ...purchases].slice(0, 200);
    setPurchases(nextPurchases);
    saveSupplierPurchaseRecords(nextPurchases);
    setSavedPurchase(true);
    setTimeout(() => setSavedPurchase(false), 1600);
  };

  const updatePurchase = (id: string, patch: Partial<SupplierPurchaseRecord>) => {
    const nextPurchases = purchases.map((record) => (record.id === id ? { ...record, ...patch } : record));
    setPurchases(nextPurchases);
    saveSupplierPurchaseRecords(nextPurchases);
  };

  const deletePurchase = (id: string) => {
    const nextPurchases = purchases.filter((record) => record.id !== id);
    setPurchases(nextPurchases);
    saveSupplierPurchaseRecords(nextPurchases);
  };

  const copyMessage = async () => {
    await navigator.clipboard.writeText(messageText);
    setCopied(true);
    setTimeout(() => setCopied(false), 1600);
  };

  return (
    <div className="h-full overflow-y-auto bg-stone-50 dark:bg-[#111110]">
      <header className="sticky top-0 z-10 border-b border-stone-200/70 bg-stone-50/90 px-4 py-3 backdrop-blur-md dark:border-stone-800/70 dark:bg-[#111110]/90">
        <h1 className="text-base font-semibold text-stone-900 dark:text-stone-100">供应商账款</h1>
        <p className="mt-0.5 text-xs text-stone-400">记录供应商、采购欠款、付款到期和逾期风险</p>
      </header>

      <main className="space-y-5 px-4 py-5">
        <section className="grid grid-cols-3 gap-2.5">
          <MetricCard label="供应商" value={String(suppliers.length)} />
          <MetricCard label="待付款" value={formatMoney(stats.outstanding)} tone={stats.outstanding > 0 ? "red" : "stone"} />
          <MetricCard label="逾期" value={String(stats.overdue.length)} tone={stats.overdue.length > 0 ? "red" : "stone"} />
        </section>

        <section className="rounded-2xl bg-stone-900 p-4 text-white dark:bg-stone-100 dark:text-stone-950">
          <p className="text-xs opacity-60">掌柜 AI 账款判断</p>
          <h2 className="mt-1 text-lg font-semibold leading-snug">{advice}</h2>
          <div className="mt-4 grid grid-cols-3 gap-2">
            <RiskBox label="待付款笔数" value={stats.unpaid.length} danger={stats.unpaid.length > 0} />
            <RiskBox label="3天内到期" value={stats.dueSoon.length} danger={stats.dueSoon.length > 0} />
            <RiskBox label="已逾期" value={stats.overdue.length} danger={stats.overdue.length > 0} />
          </div>
        </section>

        <section className="space-y-4 rounded-2xl border border-stone-200/70 bg-white p-4 dark:border-stone-800 dark:bg-stone-900/60">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-sm font-semibold text-stone-900 dark:text-stone-100">供应商资料</h2>
            <span className="text-xs text-stone-400">先建名单，再记采购</span>
          </div>
          <Field label="供应商名称" value={supplierName} onChange={setSupplierName} placeholder="如：肉类、海鲜、蔬菜、包装供应商" />
          <Segment label="类别" options={supplierCategoryOptions} value={supplierCategory} onChange={setSupplierCategory} />
          <div className="grid grid-cols-2 gap-3">
            <Field label="电话/WhatsApp" value={supplierPhone} onChange={setSupplierPhone} inputMode="tel" />
            <Field label="付款条件" value={paymentTerms} onChange={setPaymentTerms} placeholder="如：7 天内付款、月结、COD" />
          </div>
          <div>
            <label className="text-xs font-medium text-stone-500 dark:text-stone-400">备注</label>
            <textarea value={supplierNotes} onChange={(event) => setSupplierNotes(event.target.value)} rows={2} placeholder="如：送货时间、最低订单、联系人、发票习惯" className="mt-1.5 w-full resize-none rounded-xl border border-stone-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-amber-400 dark:border-stone-700 dark:bg-stone-950" />
          </div>
          <button onClick={saveSupplier} className="w-full rounded-2xl bg-stone-900 py-3 text-sm font-semibold text-white transition-transform active:scale-[0.98] dark:bg-stone-100 dark:text-stone-950">
            {savedSupplier ? "已保存供应商" : "保存供应商"}
          </button>
        </section>

        {suppliers.length > 0 && (
          <section className="overflow-hidden rounded-2xl border border-stone-200/70 bg-white dark:border-stone-800 dark:bg-stone-900/60">
            <div className="border-b border-stone-100 px-4 py-3 dark:border-stone-800">
              <h2 className="text-sm font-semibold text-stone-900 dark:text-stone-100">供应商余额</h2>
              <p className="mt-1 text-xs text-stone-400">点击供应商可带入下方采购记录。</p>
            </div>
            <div className="divide-y divide-stone-100 dark:divide-stone-800">
              {suppliers.slice(0, 8).map((supplier) => {
                const balance = supplierOutstandingTotal(purchases, supplier.id);
                const active = selectedSupplierId === supplier.id;
                return (
                  <div key={supplier.id} className={`flex items-start justify-between gap-3 px-4 py-3 ${active ? "bg-amber-50 dark:bg-amber-950/20" : ""}`}>
                    <button onClick={() => chooseSupplier(supplier)} className="min-w-0 flex-1 text-left">
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-stone-900 dark:text-stone-100">{supplier.name}</p>
                        <p className="mt-1 text-xs text-stone-400">{supplier.category} · {supplier.paymentTerms || "未填付款条件"}{supplier.phone ? ` · ${supplier.phone}` : ""}</p>
                      </div>
                    </button>
                    <div className="flex flex-shrink-0 flex-col items-end gap-1">
                      <span className={`text-sm font-semibold ${balance > 0 ? "text-red-500" : "text-stone-400"}`}>{formatMoney(balance)}</span>
                      <button onClick={() => deleteSupplier(supplier.id)} className="text-xs font-medium text-stone-400">删除</button>
                    </div>
                  </div>
                );
              })}
            </div>
            {stats.unknownBalance > 0 && (
              <div className="border-t border-stone-100 px-4 py-3 text-xs text-stone-500 dark:border-stone-800 dark:text-stone-400">
                未绑定供应商的欠款：<span className="font-semibold text-red-500">{formatMoney(stats.unknownBalance)}</span>
              </div>
            )}
          </section>
        )}

        <section className="space-y-4 rounded-2xl border border-stone-200/70 bg-white p-4 dark:border-stone-800 dark:bg-stone-900/60">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-sm font-semibold text-stone-900 dark:text-stone-100">采购/欠款记录</h2>
            <span className="text-xs text-stone-400">{selectedSupplier ? `当前：${selectedSupplier.name}` : "可不绑定供应商"}</span>
          </div>

          <Field label="供应商名称" value={selectedSupplier?.name || purchaseSupplierName} onChange={(value) => { setSelectedSupplierId(""); setPurchaseSupplierName(value); }} placeholder="没有建供应商也可以直接填写" />
          <Segment label="采购类别" options={supplierCategoryOptions} value={selectedSupplier?.category || purchaseCategory} onChange={setPurchaseCategory} />

          <div className="grid grid-cols-2 gap-3">
            <Field label="采购日期" value={purchaseDate} onChange={setPurchaseDate} type="date" />
            <Field label="付款到期日" value={dueDate} onChange={setDueDate} type="date" />
          </div>
          <div className="-mt-2 flex flex-wrap gap-2">
            <QuickDateButton label="今天到期" onClick={() => setDueDate(todayText)} />
            <QuickDateButton label="3天后" onClick={() => setDueDate(addDays(3))} />
            <QuickDateButton label="标记逾期" onClick={() => setDueDate(addDays(-1))} />
          </div>

          <div>
            <label className="text-xs font-medium text-stone-500 dark:text-stone-400">采购内容</label>
            <textarea value={items} onChange={(event) => setItems(event.target.value)} rows={2} placeholder="如：鸡腿 20kg、米 10 包、打包盒 5 箱" className="mt-1.5 w-full resize-none rounded-xl border border-stone-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-amber-400 dark:border-stone-700 dark:bg-stone-950" />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Field label="金额 RM" value={amount} onChange={setAmount} placeholder="采购总额" inputMode="decimal" />
            <Field label="已付 RM" value={paidAmount} onChange={setPaidAmount} placeholder="未付填 0" inputMode="decimal" />
          </div>
          <div className="rounded-xl bg-stone-100 px-3 py-2 text-sm text-stone-600 dark:bg-stone-950 dark:text-stone-300">
            采购余额：<span className="font-semibold text-red-500">{formatMoney(Math.max(0, toNumber(amount) - toNumber(paidAmount)))}</span>
          </div>

          <Segment label="付款状态" options={supplierPurchaseStatusOptions} value={status} onChange={setStatus} tone="emerald" />

          <div>
            <label className="text-xs font-medium text-stone-500 dark:text-stone-400">备注</label>
            <textarea value={purchaseNotes} onChange={(event) => setPurchaseNotes(event.target.value)} rows={2} placeholder="如：等发票、价格有争议、下次送货一起付" className="mt-1.5 w-full resize-none rounded-xl border border-stone-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-amber-400 dark:border-stone-700 dark:bg-stone-950" />
          </div>

          <button onClick={savePurchase} className="w-full rounded-2xl bg-stone-900 py-3 text-sm font-semibold text-white transition-transform active:scale-[0.98] dark:bg-stone-100 dark:text-stone-950">
            {savedPurchase ? "已保存采购/欠款" : "保存采购/欠款"}
          </button>
        </section>

        <section className="overflow-hidden rounded-2xl border border-stone-200/70 bg-white dark:border-stone-800 dark:bg-stone-900/60">
          <div className="flex items-center justify-between border-b border-stone-100 px-4 py-3 dark:border-stone-800">
            <h2 className="text-sm font-semibold text-stone-900 dark:text-stone-100">付款提醒 / 采购单</h2>
            <button onClick={copyMessage} className="text-xs font-medium text-amber-500">{copied ? "已复制" : "复制"}</button>
          </div>
          <pre className="whitespace-pre-wrap px-4 py-3 font-sans text-sm leading-7 text-stone-700 dark:text-stone-300">{messageText}</pre>
        </section>

        <section>
          <div className="mb-2.5 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-stone-900 dark:text-stone-100">采购清单</h2>
            <span className="text-xs text-stone-400">待付款 {formatMoney(stats.outstanding)}</span>
          </div>
          <div className="mb-3 flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
            {filterOptions.map((item) => (
              <button key={item} onClick={() => setFilter(item)} className={`whitespace-nowrap rounded-full border px-3 py-1.5 text-xs font-medium ${filter === item ? "border-stone-900 bg-stone-900 text-white dark:border-stone-100 dark:bg-stone-100 dark:text-stone-950" : "border-stone-200 bg-white text-stone-500 dark:border-stone-700 dark:bg-stone-900/60 dark:text-stone-400"}`}>
                {item}
              </button>
            ))}
          </div>

          {filteredPurchases.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-stone-300 bg-white px-4 py-6 text-center dark:border-stone-700 dark:bg-stone-900/60">
              <p className="text-sm font-medium text-stone-700 dark:text-stone-200">还没有对应采购/欠款</p>
              <p className="mt-1 text-xs leading-5 text-stone-400">把赊账、月结和未付采购记下来，系统才会提醒到期付款。</p>
            </div>
          ) : (
            <div className="space-y-2">
              {filteredPurchases.map((record) => (
                <PurchaseCard key={record.id} record={record} onUpdate={updatePurchase} onDelete={deletePurchase} />
              ))}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}

function MetricCard({ label, value, tone = "stone" }: { label: string; value: string; tone?: "stone" | "red" }) {
  const color = tone === "red" ? "text-red-500" : "text-stone-900 dark:text-stone-100";
  return (
    <div className="rounded-2xl border border-stone-200/70 bg-white p-3 dark:border-stone-800 dark:bg-stone-900/60">
      <p className="text-xs text-stone-400">{label}</p>
      <p className={`mt-1 text-lg font-semibold ${color}`}>{value}</p>
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

function QuickDateButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className="rounded-full border border-stone-200 px-3 py-1.5 text-xs font-medium text-stone-500 dark:border-stone-700 dark:text-stone-400">
      {label}
    </button>
  );
}

function PurchaseCard({ record, onUpdate, onDelete }: { record: SupplierPurchaseRecord; onUpdate: (id: string, patch: Partial<SupplierPurchaseRecord>) => void; onDelete: (id: string) => void }) {
  const balance = supplierPurchaseBalance(record);
  const overdue = isSupplierPurchaseOverdue(record);
  const due = isSupplierPurchaseDue(record) && !overdue;
  const paid = isSupplierPurchasePaid(record);
  const border = overdue ? "border-red-300 dark:border-red-900" : due ? "border-amber-300 dark:border-amber-900" : "border-stone-200/70 dark:border-stone-800";

  return (
    <div className={`rounded-2xl border bg-white p-3 dark:bg-stone-900/60 ${border}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-stone-900 dark:text-stone-100">{record.supplierName} · {record.category}</p>
          <p className="mt-1 text-xs text-stone-400">采购 {record.purchaseDate || "未填"} · 到期 {record.dueDate || "未填"}</p>
        </div>
        <span className={`rounded-full px-2 py-1 text-[11px] ${overdue ? "bg-red-50 text-red-500 dark:bg-red-950/30 dark:text-red-300" : due ? "bg-amber-50 text-amber-600 dark:bg-amber-950/30 dark:text-amber-300" : "bg-stone-100 text-stone-500 dark:bg-stone-800 dark:text-stone-300"}`}>
          {overdue ? "逾期" : due ? "到期" : paid ? "已付款" : record.status}
        </span>
      </div>

      <div className="mt-3 grid grid-cols-3 gap-2 text-xs">
        <MiniBox label="金额" value={formatMoney(toNumber(record.amount))} />
        <MiniBox label="已付" value={formatMoney(toNumber(record.paidAmount))} />
        <MiniBox label="余额" value={formatMoney(balance)} danger={balance > 0} />
      </div>

      {(record.items || record.notes) && (
        <p className="mt-3 text-xs leading-5 text-stone-500 dark:text-stone-400">
          {record.items ? `内容：${record.items}` : ""}{record.notes ? ` · 备注：${record.notes}` : ""}
        </p>
      )}

      <div className="mt-3 flex flex-wrap gap-2">
        <button onClick={() => onUpdate(record.id, { paidAmount: record.amount, status: "已付款" })} className="rounded-full bg-emerald-50 px-3 py-1.5 text-xs font-medium text-emerald-600 dark:bg-emerald-950/30 dark:text-emerald-300">标记已付款</button>
        <button onClick={() => onUpdate(record.id, { status: "有争议" })} className="rounded-full bg-stone-100 px-3 py-1.5 text-xs font-medium text-stone-600 dark:bg-stone-800 dark:text-stone-300">有争议</button>
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
