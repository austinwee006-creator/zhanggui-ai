"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  closingGrossSales,
  formatMoney,
  loadDailyClosingRecords,
  loadPosImportRecords,
  saveDailyClosingRecords,
  savePosImportRecords,
  toNumber,
  type DailyClosingRecord,
  type PosImportRecord,
} from "../lib/businessRecords";

const todayText = new Date().toISOString().slice(0, 10);
const sampleReport = `Date,2026-06-02
Cash Sales,1280.50
DuitNow / QR,860.00
Card Sales,420.00
GrabFood Sales,310.00
Foodpanda Sales,250.00
Platform Commission,72.00
Bills,86`;

type ParsedPos = Omit<PosImportRecord, "id" | "createdAt">;

const emptyParsed = (date: string, sourceName: string): ParsedPos => ({
  date,
  sourceName,
  rawText: "",
  cashSales: "0",
  qrSales: "0",
  cardSales: "0",
  platformSales: "0",
  otherSales: "0",
  platformFees: "0",
  orderCount: "0",
  notes: "",
});

export default function PosPage() {
  const [date, setDate] = useState(todayText);
  const [sourceName, setSourceName] = useState("POS");
  const [rawText, setRawText] = useState("");
  const [parsed, setParsed] = useState<ParsedPos>(() => emptyParsed(todayText, "POS"));
  const [imports, setImports] = useState<PosImportRecord[]>([]);
  const [closings, setClosings] = useState<DailyClosingRecord[]>([]);
  const [status, setStatus] = useState("");

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setImports(loadPosImportRecords());
      setClosings(loadDailyClosingRecords());
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  const previewClosing = useMemo<DailyClosingRecord>(() => ({
    id: "preview",
    date: parsed.date,
    cashSales: parsed.cashSales,
    qrSales: parsed.qrSales,
    cardSales: parsed.cardSales,
    platformSales: parsed.platformSales,
    otherSales: parsed.otherSales,
    cashInDrawer: "0",
    platformFees: parsed.platformFees,
    foodPurchase: "0",
    packagingCost: "0",
    staffCost: "0",
    rentUtility: "0",
    otherExpense: "0",
    wastage: "0",
    notes: parsed.notes,
    createdAt: new Date().toISOString(),
  }), [parsed]);

  const grossSales = closingGrossSales(previewClosing);
  const hasParsedSales = grossSales > 0 || toNumber(parsed.platformFees) > 0 || toNumber(parsed.orderCount) > 0;
  const todayExisting = closings.find((record) => record.date === parsed.date);

  const parseReport = () => {
    const next = parsePosReport(rawText, date, sourceName);
    setParsed(next);
    setStatus(next.notes);
  };

  const useSample = () => {
    setRawText(sampleReport);
    setDate("2026-06-02");
    setSourceName("POS CSV");
    setParsed(parsePosReport(sampleReport, "2026-06-02", "POS CSV"));
    setStatus("已载入示例，可直接保存测试。");
  };

  const importFile = async (file?: File) => {
    if (!file) return;
    const text = await file.text();
    setRawText(text);
    setSourceName(file.name.replace(/\.[^.]+$/, "") || "POS");
    const next = parsePosReport(text, date, file.name.replace(/\.[^.]+$/, "") || "POS");
    setParsed(next);
    setStatus("已读取文件并完成初步识别。");
  };

  const updateParsed = (key: keyof ParsedPos, value: string) => {
    setParsed((prev) => ({ ...prev, [key]: value }));
  };

  const saveImport = () => {
    const record: PosImportRecord = {
      ...parsed,
      rawText,
      id: String(Date.now()),
      createdAt: new Date().toISOString(),
    };
    const nextImports = [record, ...imports].slice(0, 80);
    const nextClosings = upsertClosingFromPos(closings, record);

    setImports(nextImports);
    setClosings(nextClosings);
    savePosImportRecords(nextImports);
    saveDailyClosingRecords(nextClosings);
    setStatus("已保存 POS 导入，并写入每日结算。");
  };

  return (
    <div className="h-full overflow-y-auto bg-stone-50 dark:bg-[#111110]">
      <header className="sticky top-0 z-10 border-b border-stone-200/70 bg-stone-50/90 px-4 py-3 backdrop-blur-md dark:border-stone-800/70 dark:bg-[#111110]/90">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h1 className="text-base font-semibold text-stone-900 dark:text-stone-100">POS 导入</h1>
            <p className="mt-0.5 text-xs text-stone-400">把 POS 日报转成每日结算，先支持 CSV / 文字报表。</p>
          </div>
          <Link href="/cashbook" className="rounded-xl border border-stone-200 px-3 py-1.5 text-xs font-medium text-stone-500 dark:border-stone-700 dark:text-stone-300">
            日结
          </Link>
        </div>
      </header>

      <main className="space-y-5 px-4 py-5">
        <section className="grid grid-cols-3 gap-2.5">
          <Metric label="识别营业额" value={formatMoney(grossSales)} />
          <Metric label="平台费用" value={formatMoney(toNumber(parsed.platformFees))} tone="amber" />
          <Metric label="订单数" value={`${toNumber(parsed.orderCount).toFixed(0)} 单`} />
        </section>

        <section className="rounded-2xl bg-stone-900 p-4 text-white dark:bg-stone-100 dark:text-stone-950">
          <p className="text-xs opacity-60">POS 接入方式</p>
          <h2 className="mt-1 text-lg font-semibold leading-snug">
            先把任何 POS 的日报导入进来，掌柜 AI 会把现金、QR、刷卡、外卖平台和抽佣写进每日结算。
          </h2>
          <div className="mt-4 grid grid-cols-2 gap-2">
            <label className="cursor-pointer rounded-xl bg-amber-400 px-3 py-2.5 text-center text-xs font-semibold text-stone-950">
              上传 CSV
              <input
                type="file"
                accept=".csv,.txt,text/csv,text/plain"
                className="hidden"
                onChange={(event) => {
                  importFile(event.target.files?.[0]);
                  event.currentTarget.value = "";
                }}
              />
            </label>
            <button onClick={useSample} className="rounded-xl bg-white/10 px-3 py-2.5 text-xs font-semibold dark:bg-stone-950/10">
              载入示例
            </button>
          </div>
        </section>

        <section className="space-y-4 rounded-2xl border border-stone-200/70 bg-white p-4 dark:border-stone-800 dark:bg-stone-900/60">
          <div className="grid grid-cols-2 gap-3">
            <Field label="日期" value={date} onChange={setDate} type="date" />
            <Field label="POS / 平台名称" value={sourceName} onChange={setSourceName} placeholder="如 StoreHub、Slurp、Foodpanda" />
          </div>
          <div>
            <label className="text-xs font-medium text-stone-500 dark:text-stone-400">贴上 POS 日报 / CSV 内容</label>
            <textarea
              value={rawText}
              onChange={(event) => setRawText(event.target.value)}
              rows={9}
              placeholder="例如：Cash Sales, 1280.50&#10;DuitNow, 860.00&#10;Card Sales, 420.00&#10;GrabFood Sales, 310.00&#10;Platform Commission, 72.00"
              className="mt-1.5 w-full resize-none rounded-xl border border-stone-200 bg-white px-3 py-2.5 font-mono text-xs leading-5 outline-none focus:border-amber-400 dark:border-stone-700 dark:bg-stone-950"
            />
          </div>
          <button onClick={parseReport} disabled={!rawText.trim()} className="w-full rounded-2xl bg-stone-900 py-3 text-sm font-semibold text-white disabled:opacity-40 dark:bg-stone-100 dark:text-stone-950">
            识别 POS 报表
          </button>
        </section>

        <section className="space-y-4 rounded-2xl border border-stone-200/70 bg-white p-4 dark:border-stone-800 dark:bg-stone-900/60">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="text-sm font-semibold text-stone-900 dark:text-stone-100">识别结果</h2>
              <p className="mt-1 text-xs leading-5 text-stone-400">
                保存前可以手动修正金额；保存后会覆盖同日期每日结算的收入和平台费用。
              </p>
            </div>
            {todayExisting && (
              <span className="rounded-full bg-amber-50 px-2.5 py-1 text-[11px] font-medium text-amber-600 dark:bg-amber-950/30 dark:text-amber-300">
                会更新日结
              </span>
            )}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="现金 RM" value={parsed.cashSales} onChange={(value) => updateParsed("cashSales", value)} inputMode="decimal" />
            <Field label="QR / DuitNow RM" value={parsed.qrSales} onChange={(value) => updateParsed("qrSales", value)} inputMode="decimal" />
            <Field label="刷卡 RM" value={parsed.cardSales} onChange={(value) => updateParsed("cardSales", value)} inputMode="decimal" />
            <Field label="外卖平台 RM" value={parsed.platformSales} onChange={(value) => updateParsed("platformSales", value)} inputMode="decimal" />
            <Field label="其他收入 RM" value={parsed.otherSales} onChange={(value) => updateParsed("otherSales", value)} inputMode="decimal" />
            <Field label="平台抽佣 RM" value={parsed.platformFees} onChange={(value) => updateParsed("platformFees", value)} inputMode="decimal" />
            <Field label="订单数" value={parsed.orderCount} onChange={(value) => updateParsed("orderCount", value)} inputMode="numeric" />
          </div>
          {status && <p className="rounded-xl bg-stone-100 px-3 py-2 text-xs leading-5 text-stone-500 dark:bg-stone-950 dark:text-stone-400">{status}</p>}
          <button onClick={saveImport} disabled={!hasParsedSales} className="w-full rounded-2xl bg-amber-400 py-3 text-sm font-semibold text-stone-950 disabled:opacity-40">
            保存并写入每日结算
          </button>
        </section>

        <section>
          <h2 className="mb-2.5 text-sm font-semibold text-stone-900 dark:text-stone-100">最近 POS 导入</h2>
          {imports.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-stone-300 bg-white px-4 py-6 text-center dark:border-stone-700 dark:bg-stone-900/60">
              <p className="text-sm font-medium text-stone-700 dark:text-stone-200">还没有 POS 导入</p>
              <p className="mt-1 text-xs leading-5 text-stone-400">先从 POS 导出日报 CSV，或直接贴日报文字。</p>
            </div>
          ) : (
            <div className="space-y-2">
              {imports.map((record) => (
                <div key={record.id} className="rounded-2xl border border-stone-200/70 bg-white p-3 dark:border-stone-800 dark:bg-stone-900/60">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-stone-900 dark:text-stone-100">{record.date} · {record.sourceName}</p>
                      <p className="mt-1 text-xs text-stone-400">订单 {toNumber(record.orderCount).toFixed(0)} 单 · 平台费用 {formatMoney(toNumber(record.platformFees))}</p>
                    </div>
                    <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] font-medium text-emerald-600 dark:bg-emerald-950/30 dark:text-emerald-300">
                      {formatMoney(posGross(record))}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}

function parsePosReport(text: string, date: string, sourceName: string): ParsedPos {
  const result = emptyParsed(date, sourceName);
  result.rawText = text;

  const lines = text.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  for (const line of lines) {
    const normalized = line.toLowerCase();
    const amount = amountFromLine(line);
    if (amount === null) continue;

    if (/(commission|fee|charge|抽佣|手续费|平台费)/i.test(normalized)) {
      result.platformFees = addMoney(result.platformFees, amount);
    } else if (/(grabfood|foodpanda|shopee|delivery|deliveroo|platform|外卖|平台)/i.test(normalized)) {
      result.platformSales = addMoney(result.platformSales, amount);
    } else if (/(cash|tunai|现金)/i.test(normalized)) {
      result.cashSales = addMoney(result.cashSales, amount);
    } else if (/(duitnow|qr|tng|touch.?n.?go|boost|grabpay|ewallet|e-wallet|wallet|电子钱包|扫码)/i.test(normalized)) {
      result.qrSales = addMoney(result.qrSales, amount);
    } else if (/(card|visa|master|debit|credit|amex|刷卡|银行卡|信用卡)/i.test(normalized)) {
      result.cardSales = addMoney(result.cardSales, amount);
    } else if (/(bill|receipt|transaction|order count|orders|pax|单数|订单数|账单)/i.test(normalized)) {
      result.orderCount = String(Math.round(amount));
    } else if (/(other|misc|others|其他)/i.test(normalized)) {
      result.otherSales = addMoney(result.otherSales, amount);
    }
  }

  const gross = posGross(result);
  result.notes = gross > 0
    ? `已识别 ${sourceName || "POS"} 报表：营业额 ${formatMoney(gross)}，订单 ${toNumber(result.orderCount).toFixed(0)} 单。`
    : "没有识别到营业额，请检查 POS 报表字段，或手动填写金额。";
  return result;
}

function amountFromLine(line: string) {
  const matches = line.match(/-?\d[\d,]*(?:\.\d+)?/g);
  if (!matches || matches.length === 0) return null;
  const last = matches[matches.length - 1].replace(/,/g, "");
  const value = Number(last);
  return Number.isFinite(value) ? value : null;
}

function addMoney(current: string, amount: number) {
  return (toNumber(current) + amount).toFixed(2);
}

function posGross(record: Pick<PosImportRecord, "cashSales" | "qrSales" | "cardSales" | "platformSales" | "otherSales">) {
  return toNumber(record.cashSales) + toNumber(record.qrSales) + toNumber(record.cardSales) + toNumber(record.platformSales) + toNumber(record.otherSales);
}

function upsertClosingFromPos(records: DailyClosingRecord[], pos: PosImportRecord) {
  const existing = records.find((record) => record.date === pos.date);
  const posNote = `POS 导入：${pos.sourceName}，营业额 ${formatMoney(posGross(pos))}，订单 ${toNumber(pos.orderCount).toFixed(0)} 单。`;
  const nextRecord: DailyClosingRecord = {
    id: existing?.id || String(Date.now() + 1),
    date: pos.date,
    cashSales: pos.cashSales,
    qrSales: pos.qrSales,
    cardSales: pos.cardSales,
    platformSales: pos.platformSales,
    otherSales: pos.otherSales,
    cashInDrawer: existing?.cashInDrawer || "0",
    platformFees: pos.platformFees,
    foodPurchase: existing?.foodPurchase || "0",
    packagingCost: existing?.packagingCost || "0",
    staffCost: existing?.staffCost || "0",
    rentUtility: existing?.rentUtility || "0",
    otherExpense: existing?.otherExpense || "0",
    wastage: existing?.wastage || "0",
    notes: existing?.notes ? `${existing.notes}\n${posNote}` : posNote,
    createdAt: existing?.createdAt || new Date().toISOString(),
  };

  return [nextRecord, ...records.filter((record) => record.date !== pos.date)].slice(0, 120);
}

function Metric({ label, value, tone = "stone" }: { label: string; value: string; tone?: "stone" | "amber" }) {
  const color = tone === "amber" ? "text-amber-500" : "text-stone-900 dark:text-stone-100";
  return (
    <div className="rounded-2xl border border-stone-200/70 bg-white p-3 dark:border-stone-800 dark:bg-stone-900/60">
      <p className="text-xs text-stone-400">{label}</p>
      <p className={`mt-1 text-base font-semibold ${color}`}>{value}</p>
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
