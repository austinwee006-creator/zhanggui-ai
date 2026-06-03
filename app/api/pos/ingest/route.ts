import { createHash, timingSafeEqual } from "crypto";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { hasActivePosToken, normalizePosConnectionSettings, posConnectionSettingsStorageKey } from "../../../lib/posConnection";
import {
  buildPosImportRecord,
  dailyClosingStorageKey,
  posFromPayload,
  posGross,
  posImportStorageKey,
  toPosNumber,
  upsertClosingFromPos,
  upsertPosImport,
  type DailyClosingRecordLike,
  type PosImportRecordLike,
} from "../../../lib/posIntegration";

const MAX_BODY_BYTES = 128 * 1024;

type DataDocumentRow = {
  key: string;
  payload: unknown;
};

type PosSettingsDocumentRow = {
  tenant_id: string;
  payload: unknown;
};

export async function GET() {
  return NextResponse.json({
    configured: Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY && process.env.NEXT_PUBLIC_SUPABASE_URL),
    tenantTokens: Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY && process.env.NEXT_PUBLIC_SUPABASE_URL),
    legacyTokenConfigured: Boolean(process.env.POS_INGEST_TOKEN),
  });
}

export async function POST(request: Request) {
  const legacyToken = process.env.POS_INGEST_TOKEN;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;

  if (!serviceRoleKey || !supabaseUrl) {
    return NextResponse.json(
      { error: "POS ingest is not configured. Set SUPABASE_SERVICE_ROLE_KEY." },
      { status: 501 }
    );
  }

  const receivedToken = request.headers.get("x-zg-pos-token") || request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!receivedToken) {
    return NextResponse.json({ error: "Invalid POS ingest token" }, { status: 401 });
  }

  const rawBody = await request.text();
  if (rawBody.length > MAX_BODY_BYTES) {
    return NextResponse.json({ error: "Payload too large" }, { status: 413 });
  }

  const body = parseBody(rawBody);
  if (!body) return NextResponse.json({ error: "Invalid JSON payload" }, { status: 400 });

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });

  const tokenTenantId = await resolveTenantIdFromPosToken(supabase, receivedToken);
  const tenantId = tokenTenantId || (legacyToken && safeStringEqual(receivedToken, legacyToken) ? await resolveTenantId(supabase, body) : "");
  if (!tenantId) {
    return NextResponse.json({ error: "Invalid POS ingest token or unknown tenant." }, { status: 401 });
  }

  const parsed = posFromPayload(body);
  if (posGross(parsed) <= 0 && toPosNumber(parsed.platformFees) <= 0 && toPosNumber(parsed.orderCount) <= 0) {
    return NextResponse.json({ error: "No POS sales, fees or order count found in payload" }, { status: 400 });
  }

  const externalId = stringValue(body.externalId) || `pos-api:${parsed.sourceName}:${parsed.date}`;
  const posRecord = buildPosImportRecord(parsed, { externalId });

  const { data, error: fetchError } = await supabase
    .from("data_documents")
    .select("key,payload")
    .eq("tenant_id", tenantId)
    .in("key", [posImportStorageKey, dailyClosingStorageKey]);

  if (fetchError) return NextResponse.json({ error: fetchError.message }, { status: 500 });

  const existingDocs = new Map((data as DataDocumentRow[] | null || []).map((row) => [row.key, row.payload]));
  const imports = normalizeArray<PosImportRecordLike>(existingDocs.get(posImportStorageKey));
  const closings = normalizeArray<DailyClosingRecordLike>(existingDocs.get(dailyClosingStorageKey));

  const nextImports = upsertPosImport(imports, posRecord);
  const nextClosings = upsertClosingFromPos(closings, posRecord);
  const updatedAt = new Date().toISOString();

  const { error: upsertError } = await supabase.from("data_documents").upsert(
    [
      { tenant_id: tenantId, key: posImportStorageKey, payload: nextImports, updated_at: updatedAt },
      { tenant_id: tenantId, key: dailyClosingStorageKey, payload: nextClosings, updated_at: updatedAt },
    ],
    { onConflict: "tenant_id,key" }
  );

  if (upsertError) return NextResponse.json({ error: upsertError.message }, { status: 500 });

  return NextResponse.json({
    success: true,
    tenantId,
    externalId,
    date: posRecord.date,
    sourceName: posRecord.sourceName,
    grossSales: posGross(posRecord),
    platformFees: toPosNumber(posRecord.platformFees),
    orderCount: toPosNumber(posRecord.orderCount),
  });
}

function parseBody(rawBody: string): Record<string, unknown> | null {
  try {
    const parsed = JSON.parse(rawBody) as unknown;
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed as Record<string, unknown> : null;
  } catch {
    return null;
  }
}

async function resolveTenantId(supabase: SupabaseClient, body: Record<string, unknown>) {
  const tenantId = stringValue(body.tenantId);
  if (tenantId) return tenantId;

  const tenantEmail = stringValue(body.tenantEmail || body.email);
  if (!tenantEmail) return "";

  const { data } = await supabase.from("profiles").select("tenant_id").eq("email", tenantEmail).maybeSingle();
  return typeof data?.tenant_id === "string" ? data.tenant_id : "";
}

async function resolveTenantIdFromPosToken(supabase: SupabaseClient, token: string) {
  const tokenHash = hashPosToken(token);
  const { data, error } = await supabase
    .from("data_documents")
    .select("tenant_id,payload")
    .eq("key", posConnectionSettingsStorageKey);

  if (error || !data) return "";

  for (const row of data as PosSettingsDocumentRow[]) {
    const settings = normalizePosConnectionSettings(row.payload);
    if (!settings || !hasActivePosToken(settings)) continue;
    if (safeStringEqual(settings.tokenHash, tokenHash)) return row.tenant_id;
  }

  return "";
}

function normalizeArray<T>(payload: unknown): T[] {
  return Array.isArray(payload) ? payload as T[] : [];
}

function stringValue(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function hashPosToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

function safeStringEqual(left: string, right: string) {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);
  return leftBuffer.length === rightBuffer.length && timingSafeEqual(leftBuffer, rightBuffer);
}
