"use client";

import { useMemo, useState } from "react";
import {
  daysUntil,
  formatMoney,
  inventoryCategoryOptions,
  inventoryValue,
  isExpiringSoon,
  isLowStock,
  loadInventoryItems,
  saveInventoryItems,
  toNumber,
  type InventoryItem,
} from "../lib/businessRecords";

const unitOptions = ["kg", "g", "L", "ml", "包", "箱", "个", "份"];
const filterOptions = ["全部", "低库存", "快过期", "食材", "包装", "饮料"];

export default function InventoryPage() {
  const [items, setItems] = useState<InventoryItem[]>(() => loadInventoryItems());
  const [name, setName] = useState("");
  const [category, setCategory] = useState("食材");
  const [unit, setUnit] = useState("kg");
  const [currentQty, setCurrentQty] = useState("");
  const [minQty, setMinQty] = useState("");
  const [unitCost, setUnitCost] = useState("");
  const [supplier, setSupplier] = useState("");
  const [expiryDate, setExpiryDate] = useState("");
  const [lastPurchaseDate, setLastPurchaseDate] = useState("");
  const [notes, setNotes] = useState("");
  const [filter, setFilter] = useState("全部");
  const [saved, setSaved] = useState(false);
  const [copied, setCopied] = useState(false);

  const stats = useMemo(() => {
    return items.reduce(
      (acc, item) => {
        if (isLowStock(item)) acc.low += 1;
        if (isExpiringSoon(item)) acc.expiring += 1;
        acc.value += inventoryValue(item);
        return acc;
      },
      { low: 0, expiring: 0, value: 0 }
    );
  }, [items]);

  const filteredItems = useMemo(() => {
    return items.filter((item) => {
      if (filter === "低库存") return isLowStock(item);
      if (filter === "快过期") return isExpiringSoon(item);
      if (filter === "全部") return true;
      return item.category === filter;
    });
  }, [filter, items]);

  const purchaseList = useMemo(() => {
    return items
      .filter((item) => isLowStock(item))
      .map((item) => {
        const suggestedQty = Math.max(0, toNumber(item.minQty) * 2 - toNumber(item.currentQty));
        return `${item.name}：建议补 ${suggestedQty.toFixed(1)} ${item.unit}${item.supplier ? `，供应商：${item.supplier}` : ""}`;
      });
  }, [items]);

  const advice = useMemo(() => {
    if (items.length === 0) return "先把常用食材、包装和饮料录进去，系统才会提醒缺货和快过期。";
    if (stats.expiring > 0) return `${stats.expiring} 个库存快过期，今天先做成主推、员工餐或减少采购。`;
    if (stats.low > 0) return `${stats.low} 个库存低于安全线，先补关键食材，避免接了订单却出不了货。`;
    return "库存暂时健康，继续控制采购量，避免现金压在库存里。";
  }, [items.length, stats.expiring, stats.low]);

  const saveItem = () => {
    const nextItem: InventoryItem = {
      id: String(Date.now()),
      name: name || "未命名物品",
      category,
      unit,
      currentQty: currentQty || "0",
      minQty: minQty || "0",
      unitCost: unitCost || "0",
      supplier,
      expiryDate,
      lastPurchaseDate,
      notes,
      createdAt: new Date().toISOString(),
    };
    const nextItems = [nextItem, ...items].slice(0, 160);
    setItems(nextItems);
    saveInventoryItems(nextItems);
    setSaved(true);
    setTimeout(() => setSaved(false), 1600);
  };

  const updateItem = (id: string, patch: Partial<InventoryItem>) => {
    const nextItems = items.map((item) => (item.id === id ? { ...item, ...patch } : item));
    setItems(nextItems);
    saveInventoryItems(nextItems);
  };

  const deleteItem = (id: string) => {
    const nextItems = items.filter((item) => item.id !== id);
    setItems(nextItems);
    saveInventoryItems(nextItems);
  };

  const copyPurchaseList = async () => {
    const text = purchaseList.length > 0 ? purchaseList.join("\n") : "今天没有低库存采购建议。";
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1600);
  };

  return (
    <div className="h-full overflow-y-auto bg-stone-50 dark:bg-[#111110]">
      <header className="sticky top-0 z-10 border-b border-stone-200/70 bg-stone-50/90 px-4 py-3 backdrop-blur-md dark:border-stone-800/70 dark:bg-[#111110]/90">
        <h1 className="text-base font-semibold text-stone-900 dark:text-stone-100">库存采购</h1>
        <p className="mt-0.5 text-xs text-stone-400">管食材、包装、供应商、缺货和快过期</p>
      </header>

      <main className="space-y-5 px-4 py-5">
        <section className="grid grid-cols-3 gap-2.5">
          <MetricCard label="低库存" value={String(stats.low)} tone={stats.low > 0 ? "red" : "stone"} />
          <MetricCard label="快过期" value={String(stats.expiring)} tone={stats.expiring > 0 ? "amber" : "stone"} />
          <MetricCard label="库存金额" value={formatMoney(stats.value)} />
        </section>

        <section className="rounded-2xl bg-stone-900 p-4 text-white dark:bg-stone-100 dark:text-stone-950">
          <p className="text-xs opacity-60">掌柜 AI 库存判断</p>
          <h2 className="mt-1 text-lg font-semibold leading-snug">{advice}</h2>
          <button onClick={copyPurchaseList} className="mt-4 rounded-xl bg-amber-400 px-3 py-2 text-xs font-semibold text-stone-950">
            {copied ? "已复制采购单" : "复制采购单"}
          </button>
        </section>

        <section className="space-y-4 rounded-2xl border border-stone-200/70 bg-white p-4 dark:border-stone-800 dark:bg-stone-900/60">
          <Field label="物品名称" value={name} onChange={setName} placeholder="如：鸡腿、米、杯盖、牛奶、辣椒酱" />
          <Segment label="分类" options={inventoryCategoryOptions} value={category} onChange={setCategory} />
          <Segment label="单位" options={unitOptions} value={unit} onChange={setUnit} tone="emerald" />

          <div className="grid grid-cols-2 gap-3">
            <Field label="现有数量" value={currentQty} onChange={setCurrentQty} inputMode="decimal" />
            <Field label="安全库存" value={minQty} onChange={setMinQty} inputMode="decimal" />
            <Field label="单价 RM" value={unitCost} onChange={setUnitCost} inputMode="decimal" />
            <Field label="供应商" value={supplier} onChange={setSupplier} placeholder="如：固定菜商、批发店、平台" />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Field label="过期/最佳使用日" value={expiryDate} onChange={setExpiryDate} type="date" />
            <Field label="最近采购日" value={lastPurchaseDate} onChange={setLastPurchaseDate} type="date" />
          </div>

          <div>
            <label className="text-xs font-medium text-stone-500 dark:text-stone-400">备注</label>
            <textarea value={notes} onChange={(event) => setNotes(event.target.value)} rows={3} placeholder="如：只能放冷冻、周一三五送货、涨价、容易坏" className="mt-1.5 w-full resize-none rounded-xl border border-stone-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-amber-400 dark:border-stone-700 dark:bg-stone-950" />
          </div>

          <button onClick={saveItem} className="w-full rounded-2xl bg-stone-900 py-3 text-sm font-semibold text-white transition-transform active:scale-[0.98] dark:bg-stone-100 dark:text-stone-950">
            {saved ? "已保存库存" : "保存库存物品"}
          </button>
        </section>

        <section className="rounded-2xl border border-stone-200/70 bg-white p-4 dark:border-stone-800 dark:bg-stone-900/60">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-sm font-semibold text-stone-900 dark:text-stone-100">今日采购单</h2>
            <span className="text-xs text-stone-400">{purchaseList.length} 项</span>
          </div>
          {purchaseList.length === 0 ? (
            <p className="mt-2 text-sm leading-6 text-stone-400">没有低库存物品。保存库存后，低于安全线的物品会自动出现在这里。</p>
          ) : (
            <div className="mt-3 space-y-2">
              {purchaseList.map((item) => (
                <div key={item} className="rounded-xl bg-stone-100 px-3 py-2 text-sm leading-6 text-stone-700 dark:bg-stone-950 dark:text-stone-300">
                  {item}
                </div>
              ))}
            </div>
          )}
        </section>

        <section>
          <div className="mb-2.5 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-stone-900 dark:text-stone-100">库存清单</h2>
            <span className="text-xs text-stone-400">{items.length} 个物品</span>
          </div>
          <div className="mb-3 flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
            {filterOptions.map((item) => (
              <button key={item} onClick={() => setFilter(item)} className={`whitespace-nowrap rounded-full border px-3 py-1.5 text-xs font-medium ${filter === item ? "border-stone-900 bg-stone-900 text-white dark:border-stone-100 dark:bg-stone-100 dark:text-stone-950" : "border-stone-200 bg-white text-stone-500 dark:border-stone-700 dark:bg-stone-900/60 dark:text-stone-400"}`}>
                {item}
              </button>
            ))}
          </div>

          {filteredItems.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-stone-300 bg-white px-4 py-6 text-center dark:border-stone-700 dark:bg-stone-900/60">
              <p className="text-sm font-medium text-stone-700 dark:text-stone-200">还没有对应库存</p>
              <p className="mt-1 text-xs leading-5 text-stone-400">先录常用食材和包装，系统才会知道什么该补、什么快过期。</p>
            </div>
          ) : (
            <div className="space-y-2">
              {filteredItems.map((item) => (
                <InventoryCard key={item.id} item={item} onUpdate={updateItem} onDelete={deleteItem} />
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

function InventoryCard({ item, onUpdate, onDelete }: { item: InventoryItem; onUpdate: (id: string, patch: Partial<InventoryItem>) => void; onDelete: (id: string) => void }) {
  const low = isLowStock(item);
  const expiring = isExpiringSoon(item);
  const expiryDays = daysUntil(item.expiryDate);
  const quickAdd = Math.max(1, toNumber(item.minQty));

  return (
    <div className={`rounded-2xl border bg-white p-3 dark:bg-stone-900/60 ${low || expiring ? "border-amber-300 dark:border-amber-900" : "border-stone-200/70 dark:border-stone-800"}`}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-stone-900 dark:text-stone-100">{item.name}</p>
          <p className="mt-1 text-xs text-stone-400">{item.category} · {item.supplier || "未填供应商"}</p>
        </div>
        <span className={`rounded-full px-2 py-1 text-[11px] ${low ? "bg-red-50 text-red-500 dark:bg-red-950/30" : expiring ? "bg-amber-50 text-amber-600 dark:bg-amber-950/30 dark:text-amber-300" : "bg-stone-100 text-stone-500 dark:bg-stone-800 dark:text-stone-300"}`}>
          {low ? "低库存" : expiring ? "快过期" : "正常"}
        </span>
      </div>
      <div className="mt-3 grid grid-cols-3 gap-2">
        <MiniStat label="现有" value={`${toNumber(item.currentQty).toFixed(1)} ${item.unit}`} danger={low} />
        <MiniStat label="安全线" value={`${toNumber(item.minQty).toFixed(1)} ${item.unit}`} />
        <MiniStat label="金额" value={formatMoney(inventoryValue(item))} />
      </div>
      <p className="mt-3 text-xs leading-5 text-stone-500 dark:text-stone-400">
        {item.expiryDate ? `过期/最佳使用日：${item.expiryDate}${expiryDays !== null ? `（${expiryDays < 0 ? "已过期" : `${expiryDays} 天` }）` : ""}` : "未填写过期/最佳使用日"}
        {item.notes ? ` · ${item.notes}` : ""}
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        <button onClick={() => onUpdate(item.id, { currentQty: String(toNumber(item.currentQty) + quickAdd), lastPurchaseDate: new Date().toISOString().slice(0, 10) })} className="rounded-full bg-emerald-50 px-3 py-1.5 text-xs font-medium text-emerald-600 dark:bg-emerald-950/30 dark:text-emerald-300">已补货</button>
        <button onClick={() => onUpdate(item.id, { currentQty: String(Math.max(0, toNumber(item.currentQty) - 1)) })} className="rounded-full bg-stone-100 px-3 py-1.5 text-xs font-medium text-stone-600 dark:bg-stone-800 dark:text-stone-300">用掉 1</button>
        <button onClick={() => onDelete(item.id)} className="rounded-full px-3 py-1.5 text-xs font-medium text-stone-400">删除</button>
      </div>
    </div>
  );
}

function MiniStat({ label, value, danger = false }: { label: string; value: string; danger?: boolean }) {
  return (
    <div className="rounded-xl bg-stone-100 px-2.5 py-2 dark:bg-stone-950">
      <p className="text-[11px] text-stone-400">{label}</p>
      <p className={`mt-0.5 text-xs font-semibold ${danger ? "text-red-500" : "text-stone-800 dark:text-stone-100"}`}>{value}</p>
    </div>
  );
}
