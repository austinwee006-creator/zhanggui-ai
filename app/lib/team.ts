export const teamInviteStorageKey = "zg_team_invites_v1";

export type TeamInviteRecord = {
  id: string;
  code: string;
  role: "staff";
  createdAt: string;
  expiresAt: string;
  usedAt: string;
  usedBy: string;
};

export function normalizeTeamInvites(payload: unknown): TeamInviteRecord[] {
  if (!Array.isArray(payload)) return [];
  return payload.map(normalizeTeamInvite).filter((invite) => invite.code);
}

export function isInviteActive(invite: TeamInviteRecord, now = new Date()) {
  return !invite.usedAt && new Date(invite.expiresAt).getTime() > now.getTime();
}

function normalizeTeamInvite(record: Partial<TeamInviteRecord>): TeamInviteRecord {
  return {
    id: stringValue(record.id),
    code: stringValue(record.code).toUpperCase(),
    role: "staff",
    createdAt: stringValue(record.createdAt),
    expiresAt: stringValue(record.expiresAt),
    usedAt: stringValue(record.usedAt),
    usedBy: stringValue(record.usedBy),
  };
}

function stringValue(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}
