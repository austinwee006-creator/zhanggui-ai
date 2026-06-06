import { randomBytes } from "crypto";
import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { normalizeTeamInvites, teamInviteStorageKey, type TeamInviteRecord } from "../../../lib/team";

type ProfileRow = {
  user_id: string;
  tenant_id: string;
  email: string | null;
};

type InviteDocumentRow = {
  payload: unknown;
};

export async function POST(request: Request) {
  const service = getServiceClient();
  if (!service) return NextResponse.json({ error: "Team API is not configured." }, { status: 501 });

  const accessToken = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  const user = await getUser(accessToken);
  if (!user) return NextResponse.json({ error: "Not signed in." }, { status: 401 });

  const profile = await getProfile(service, user.id);
  if (!profile) return NextResponse.json({ error: "Profile not found." }, { status: 404 });
  if (profile.tenant_id !== profile.user_id) {
    return NextResponse.json({ error: "Only the owner account can invite staff." }, { status: 403 });
  }

  const { data } = await service
    .from("data_documents")
    .select("payload")
    .eq("tenant_id", profile.tenant_id)
    .eq("key", teamInviteStorageKey)
    .maybeSingle();

  const now = new Date();
  const activeInvites = normalizeTeamInvites((data as InviteDocumentRow | null)?.payload).filter((invite) => {
    return !invite.usedAt && new Date(invite.expiresAt).getTime() > now.getTime();
  });
  const invite = createInvite(now);
  const nextInvites = [invite, ...activeInvites].slice(0, 12);

  const { error } = await service.from("data_documents").upsert(
    {
      tenant_id: profile.tenant_id,
      key: teamInviteStorageKey,
      payload: nextInvites,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "tenant_id,key" }
  );

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({
    code: invite.code,
    expiresAt: invite.expiresAt,
    role: invite.role,
  });
}

function getServiceClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceRoleKey) return null;
  return createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

async function getUser(accessToken?: string) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !anonKey || !accessToken) return null;

  const client = createClient(supabaseUrl, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data, error } = await client.auth.getUser(accessToken);
  return error ? null : data.user;
}

async function getProfile(service: NonNullable<ReturnType<typeof getServiceClient>>, userId: string) {
  const { data } = await service.from("profiles").select("user_id,tenant_id,email").eq("user_id", userId).maybeSingle();
  return data as ProfileRow | null;
}

function createInvite(now: Date): TeamInviteRecord {
  const expiresAt = new Date(now.getTime() + 1000 * 60 * 60 * 24 * 7).toISOString();
  return {
    id: String(now.getTime()),
    code: `ZG-${randomBytes(4).toString("hex").toUpperCase()}`,
    role: "staff",
    createdAt: now.toISOString(),
    expiresAt,
    usedAt: "",
    usedBy: "",
  };
}
