import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { isInviteActive, normalizeTeamInvites, teamInviteStorageKey } from "../../../lib/team";

type ProfileRow = {
  user_id: string;
  tenant_id: string;
  email: string | null;
};

type InviteDocumentRow = {
  tenant_id: string;
  payload: unknown;
};

export async function POST(request: Request) {
  const service = getServiceClient();
  if (!service) return NextResponse.json({ error: "Team API is not configured." }, { status: 501 });

  const accessToken = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  const user = await getUser(accessToken);
  if (!user) return NextResponse.json({ error: "Not signed in." }, { status: 401 });

  const body = (await request.json().catch(() => ({}))) as { code?: string };
  const code = normalizeCode(body.code);
  if (!code) return NextResponse.json({ error: "Invite code is required." }, { status: 400 });

  const currentProfile = await getProfile(service, user.id);
  if (!currentProfile) return NextResponse.json({ error: "Profile not found." }, { status: 404 });

  const match = await findInvite(service, code);
  if (!match) return NextResponse.json({ error: "Invite code is invalid or expired." }, { status: 404 });
  if (match.tenantId === currentProfile.tenant_id) {
    return NextResponse.json({ error: "This account is already in that store." }, { status: 409 });
  }

  const now = new Date().toISOString();
  const nextInvites = match.invites.map((invite) => {
    if (invite.code !== code) return invite;
    return { ...invite, usedAt: now, usedBy: user.email ?? user.id };
  });

  const { error: updateProfileError } = await service
    .from("profiles")
    .update({ tenant_id: match.tenantId, email: user.email })
    .eq("user_id", user.id);

  if (updateProfileError) return NextResponse.json({ error: updateProfileError.message }, { status: 500 });

  const { error: updateInviteError } = await service.from("data_documents").upsert(
    {
      tenant_id: match.tenantId,
      key: teamInviteStorageKey,
      payload: nextInvites,
      updated_at: now,
    },
    { onConflict: "tenant_id,key" }
  );

  if (updateInviteError) return NextResponse.json({ error: updateInviteError.message }, { status: 500 });

  return NextResponse.json({ success: true, tenantId: match.tenantId });
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

async function findInvite(service: NonNullable<ReturnType<typeof getServiceClient>>, code: string) {
  const { data, error } = await service
    .from("data_documents")
    .select("tenant_id,payload")
    .eq("key", teamInviteStorageKey);

  if (error || !data) return null;

  for (const row of data as InviteDocumentRow[]) {
    const invites = normalizeTeamInvites(row.payload);
    const invite = invites.find((item) => item.code === code && isInviteActive(item));
    if (invite) return { tenantId: row.tenant_id, invite, invites };
  }

  return null;
}

function normalizeCode(value: unknown) {
  return typeof value === "string" ? value.trim().toUpperCase().replace(/\s+/g, "") : "";
}
