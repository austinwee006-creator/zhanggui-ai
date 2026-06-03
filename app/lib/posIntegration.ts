export type PosImportRecordLike = {
  id: string;
  date: string;
  sourceName: string;
  rawText: string;
  cashSales: string;
  qrSales: string;
  cardSales: string;
  platformSales: string;
  otherSales: string;
  platformFees: string;
  orderCount: string;
  notes: string;
  createdAt: string;
  externalId?: string;
};

export type ParsedPos = Omit<PosImportRecordLike, "id" | "createdAt" | "externalId">;

export type DailyClosingRecordLike = {
  id: string;
  date: string;
  cashSales: string;
  qrSales: string;
  cardSales: string;
  platformSales: string;
  otherSales: string;
  cashInDrawer: string;
  platformFees: string;
  foodPurchase: string;
  packagingCost: string;
  staffCost: string;
  rentUtility: string;
  otherExpense: string;
  wastage: string;
  notes: string;
  createdAt: string;
};

export const posImportStorageKey = "zg_pos_import_records_v1";
export const dailyClosingStorageKey = "zg_daily_closing_records_v1";

export function emptyParsedPos(date: string, sourceName: string): ParsedPos {
  return {
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
  };
}

export function parsePosReport(text: string, date: string, sourceName: string): ParsedPos {
  const result = emptyParsedPos(date, sourceName);
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
    ? `已识别 ${sourceName || "POS"} 报表：营业额 ${formatPosMoney(gross)}，订单 ${toPosNumber(result.orderCount).toFixed(0)} 单。`
    : "没有识别到营业额，请检查 POS 报表字段，或手动填写金额。";
  return result;
}

export function posFromPayload(payload: Record<string, unknown>): ParsedPos {
  const date = stringValue(payload.date) || new Date().toISOString().slice(0, 10);
  const sourceName = stringValue(payload.sourceName) || stringValue(payload.source) || "POS API";
  const reportText = stringValue(payload.reportText) || stringValue(payload.rawText);
  const parsed = reportText ? parsePosReport(reportText, date, sourceName) : emptyParsedPos(date, sourceName);

  return {
    ...parsed,
    rawText: reportText || JSON.stringify(payload),
    cashSales: moneyValue(payload.cashSales, parsed.cashSales),
    qrSales: moneyValue(payload.qrSales ?? payload.duitNowSales ?? payload.ewalletSales, parsed.qrSales),
    cardSales: moneyValue(payload.cardSales, parsed.cardSales),
    platformSales: moneyValue(payload.platformSales ?? payload.deliverySales, parsed.platformSales),
    otherSales: moneyValue(payload.otherSales, parsed.otherSales),
    platformFees: moneyValue(payload.platformFees ?? payload.commission ?? payload.fees, parsed.platformFees),
    orderCount: integerValue(payload.orderCount ?? payload.orders ?? payload.bills, parsed.orderCount),
    notes: stringValue(payload.notes) || parsed.notes,
  };
}

export function buildPosImportRecord(parsed: ParsedPos, options: { id?: string; createdAt?: string; externalId?: string } = {}): PosImportRecordLike {
  return {
    ...parsed,
    id: options.id || String(Date.now()),
    createdAt: options.createdAt || new Date().toISOString(),
    externalId: options.externalId || undefined,
  };
}

export function upsertPosImport(records: PosImportRecordLike[], pos: PosImportRecordLike) {
  const filtered = records.filter((record) => {
    if (pos.externalId && record.externalId) return record.externalId !== pos.externalId;
    return record.id !== pos.id;
  });
  return [pos, ...filtered].slice(0, 80);
}

export function upsertClosingFromPos<T extends DailyClosingRecordLike>(records: T[], pos: Pick<PosImportRecordLike, "date" | "sourceName" | "cashSales" | "qrSales" | "cardSales" | "platformSales" | "otherSales" | "platformFees" | "orderCount">): T[] {
  const existing = records.find((record) => record.date === pos.date);
  const posNote = `POS 导入：${pos.sourceName}，营业额 ${formatPosMoney(posGross(pos))}，订单 ${toPosNumber(pos.orderCount).toFixed(0)} 单。`;
  const nextRecord = {
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
  } as T;

  return [nextRecord, ...records.filter((record) => record.date !== pos.date)].slice(0, 120);
}

export function posGross(record: Pick<PosImportRecordLike, "cashSales" | "qrSales" | "cardSales" | "platformSales" | "otherSales">) {
  return toPosNumber(record.cashSales) + toPosNumber(record.qrSales) + toPosNumber(record.cardSales) + toPosNumber(record.platformSales) + toPosNumber(record.otherSales);
}

export function toPosNumber(value: unknown) {
  return Number(String(value ?? "").replace(/[^\d.-]/g, "")) || 0;
}

export function formatPosMoney(value: number) {
  return `RM ${value.toFixed(2)}`;
}

function amountFromLine(line: string) {
  const matches = line.match(/-?\d[\d,]*(?:\.\d+)?/g);
  if (!matches || matches.length === 0) return null;
  const last = matches[matches.length - 1].replace(/,/g, "");
  const value = Number(last);
  return Number.isFinite(value) ? value : null;
}

function addMoney(current: string, amount: number) {
  return (toPosNumber(current) + amount).toFixed(2);
}

function stringValue(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function moneyValue(value: unknown, fallback: string) {
  if (value === undefined || value === null || value === "") return fallback;
  return toPosNumber(value).toFixed(2);
}

function integerValue(value: unknown, fallback: string) {
  if (value === undefined || value === null || value === "") return fallback;
  return String(Math.max(0, Math.round(toPosNumber(value))));
}
