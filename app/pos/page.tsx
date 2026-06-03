"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  closingGrossSales,
  formatMoney,
  loadDailyClosingRecords,
  loadPosConnectionSettings,
  loadPosImportRecords,
  saveDailyClosingRecords,
  savePosConnectionSettings,
  savePosImportRecords,
  type DailyClosingRecord,
  type PosConnectionSettings,
  type PosImportRecord,
} from "../lib/businessRecords";
import { getSupabase, isCloudEnabled } from "../lib/supabaseClient";
import {
  emptyParsedPos,
  parsePosReport,
  posGross,
  toPosNumber,
  upsertClosingFromPos,
  type ParsedPos,
} from "../lib/posIntegration";

const todayText = new Date().toISOString().slice(0, 10);
const sampleReport = `Date,2026-06-02
Cash Sales,1280.50
DuitNow / QR,860.00
Card Sales,420.00
GrabFood Sales,310.00
Foodpanda Sales,250.00
Platform Commission,72.00
Bills,86`;

export default function PosPage() {
  const [date, setDate] = useState(todayText);
  const [sourceName, setSourceName] = useState("POS");
  const [rawText, setRawText] = useState("");
  const [parsed, setParsed] = useState<ParsedPos>(() => emptyParsedPos(todayText, "POS"));
  const [imports, setImports] = useState<PosImportRecord[]>([]);
  const [closings, setClosings] = useState<DailyClosingRecord[]>([]);
  const [status, setStatus] = useState("");
  const [apiConfigured, setApiConfigured] = useState<boolean | null>(null);
  const [accountEmail, setAccountEmail] = useState<string | null>(null);
  const [posSettings, setPosSettings] = useState<PosConnectionSettings | null>(null);
  const [generatedToken, setGeneratedToken] = useState("");
  const [connectionStatus, setConnectionStatus] = useState("");

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setImports(loadPosImportRecords());
      setClosings(loadDailyClosingRecords());
      setPosSettings(loadPosConnectionSettings());
      fetch("/api/pos/ingest")
        .then((response) => response.json())
        .then((data: { configured?: boolean }) => setApiConfigured(Boolean(data.configured)))
        .catch(() => setApiConfigured(false));
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    const sb = getSupabase();
    if (!sb) return;
    sb.auth.getUser().then(({ data }) => setAccountEmail(data.user?.email ?? null));
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
  const hasParsedSales = grossSales > 0 || toPosNumber(parsed.platformFees) > 0 || toPosNumber(parsed.orderCount) > 0;
  const todayExisting = closings.find((record) => record.date === parsed.date);
  const cloudReady = isCloudEnabled() && Boolean(accountEmail);
  const tokenReady = Boolean(posSettings?.enabled && posSettings.tokenHash);
  const apiStatusLabel = apiConfigured === null ? "检查中" : apiConfigured === false ? "待配置" : !cloudReady ? "先登入账号" : tokenReady ? "店铺已接入" : "生成店铺密钥";
  const sampleApiBody = `POST /api/pos/ingest
Header: x-zg-pos-token: ${generatedToken || "<restaurant-pos-token>"}
Body:
{
  "date": "2026-06-02",
  "sourceName": "${posSettings?.sourceName || "StoreHub POS"}",
  "cashSales": 1280.5,
  "qrSales": 860,
  "cardSales": 420,
  "platformSales": 560,
  "platformFees": 72,
  "orderCount": 86,
  "externalId": "receipt-batch-2026-06-02"
}`;

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

  const generateConnectionToken = async () => {
    if (!cloudReady) {
      setConnectionStatus("请先用正式云端账号登入；店铺 POS 密钥要同步到云端后才可接收 webhook。");
      return;
    }

    const token = createPosToken();
    const now = new Date().toISOString();
    const settings: PosConnectionSettings = {
      enabled: true,
      sourceName: posSettings?.sourceName || "POS API",
      tokenHash: await sha256Hex(token),
      tokenHint: token.slice(-6),
      createdAt: posSettings?.createdAt || now,
      rotatedAt: now,
      notes: posSettings?.notes || "",
    };

    savePosConnectionSettings(settings);
    setPosSettings(settings);
    setGeneratedToken(token);
    setConnectionStatus("已生成店铺 POS 密钥。完整 token 只显示这一次，请复制给 POS 厂商或自动化工具。");
  };

  const disableConnection = () => {
    if (!posSettings) return;
    const settings = { ...posSettings, enabled: false, rotatedAt: new Date().toISOString() };
    savePosConnectionSettings(settings);
    setPosSettings(settings);
    setGeneratedToken("");
    setConnectionStatus("已停用店铺 POS webhook；旧 token 将不能再写入资料。");
  };

  const copyGeneratedToken = async () => {
    if (!generatedToken) return;
    await navigator.clipboard.writeText(generatedToken).catch(() => undefined);
    setConnectionStatus("已复制 token。");
  };

  const copyApiSample = async () => {
    await navigator.clipboard.writeText(sampleApiBody).catch(() => undefined);
    setConnectionStatus("已复制 POS 接入格式。");
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
          <Metric label="平台费用" value={formatMoney(toPosNumber(parsed.platformFees))} tone="amber" />
          <Metric label="订单数" value={`${toPosNumber(parsed.orderCount).toFixed(0)} 单`} />
        </section>

        <section className="rounded-2xl border border-amber-200 bg-amber-50 p-4 dark:border-amber-900/50 dark:bg-amber-950/30">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs font-medium text-amber-700 dark:text-amber-300">实体 POS 接入</p>
              <h2 className="mt-1 text-sm font-semibold leading-6 text-stone-900 dark:text-stone-100">
                POS 机可以用浏览器/PWA 打开掌柜 AI；如果 POS 厂商能发 webhook，就用这家店自己的密钥把日结数据 POST 到掌柜 AI。
              </h2>
            </div>
            <span className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-semibold ${apiConfigured ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300" : "bg-white text-amber-600 dark:bg-stone-950/60 dark:text-amber-300"}`}>
              {apiStatusLabel}
            </span>
          </div>
          <div className="mt-3 space-y-2 text-xs leading-5 text-amber-700/90 dark:text-amber-200/80">
            <p>1. POS 机/收银电脑：直接打开线上网址，加入主屏幕或桌面。</p>
            <p>2. POS 报表：上传 CSV，或贴日报文字。</p>
            <p>3. 自动接入：每家店生成自己的 POS 密钥，让 POS、Make、Zapier 或本地小工具呼叫 <span className="font-mono">POST /api/pos/ingest</span>。</p>
            {apiConfigured === false && <p className="font-medium">自动接入上线前，需要先在 Vercel 加 `SUPABASE_SERVICE_ROLE_KEY`。</p>}
            {apiConfigured && !cloudReady && <p className="font-medium">请先登入正式云端账号，POS 密钥才会同步到这家店的云端资料。</p>}
          </div>
          <div className="mt-4 space-y-3 border-t border-amber-200 pt-3 dark:border-amber-900/50">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="text-xs font-semibold text-stone-900 dark:text-stone-100">店铺 POS 密钥</p>
                <p className="mt-0.5 text-xs text-amber-700/80 dark:text-amber-200/70">
                  {tokenReady ? `已启用，结尾 ${posSettings?.tokenHint ? `••••${posSettings.tokenHint}` : "已隐藏"}` : "还未生成；生成后完整 token 只显示一次。"}
                </p>
              </div>
              <div className="flex gap-2">
                <button onClick={generateConnectionToken} disabled={!apiConfigured || !cloudReady} className="rounded-xl bg-stone-900 px-3 py-2 text-xs font-semibold text-white disabled:opacity-40 dark:bg-stone-100 dark:text-stone-950">
                  {tokenReady ? "重置密钥" : "生成密钥"}
                </button>
                {tokenReady && (
                  <button onClick={disableConnection} className="rounded-xl border border-amber-300 px-3 py-2 text-xs font-semibold text-amber-700 dark:border-amber-800 dark:text-amber-200">
                    停用
                  </button>
                )}
              </div>
            </div>
            {generatedToken && (
              <div className="rounded-xl bg-white/70 p-3 dark:bg-stone-950/40">
                <p className="text-[11px] font-medium text-amber-700 dark:text-amber-200">完整 token 只显示这一次</p>
                <p className="mt-1 break-all font-mono text-[11px] leading-5 text-stone-800 dark:text-stone-100">{generatedToken}</p>
                <button onClick={copyGeneratedToken} className="mt-2 rounded-lg bg-amber-400 px-3 py-1.5 text-[11px] font-semibold text-stone-950">
                  复制 token
                </button>
              </div>
            )}
            {connectionStatus && <p className="rounded-xl bg-white/70 px-3 py-2 text-xs leading-5 text-amber-700 dark:bg-stone-950/40 dark:text-amber-200">{connectionStatus}</p>}
          </div>
          <div className="mt-3 flex items-center justify-between gap-2">
            <p className="text-xs font-semibold text-stone-900 dark:text-stone-100">给 POS 厂商 / 自动化工具</p>
            <button onClick={copyApiSample} className="rounded-lg bg-white px-2.5 py-1.5 text-[11px] font-semibold text-amber-700 dark:bg-stone-950 dark:text-amber-200">
              复制格式
            </button>
          </div>
          <pre className="mt-2 overflow-x-auto rounded-xl bg-stone-950 px-3 py-3 text-[11px] leading-5 text-stone-100">{sampleApiBody}</pre>
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
                      <p className="mt-1 text-xs text-stone-400">订单 {toPosNumber(record.orderCount).toFixed(0)} 单 · 平台费用 {formatMoney(toPosNumber(record.platformFees))}</p>
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

function createPosToken() {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  const token = Array.from(bytes, (byte) => String.fromCharCode(byte)).join("");
  return `zgpos_${btoa(token).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "")}`;
}

async function sha256Hex(value: string) {
  const buffer = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(buffer), (byte) => byte.toString(16).padStart(2, "0")).join("");
}
