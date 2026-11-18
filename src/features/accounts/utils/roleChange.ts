import type { UserRole } from "@/types/user";

export type RolePlan =
  | { kind: "APPLY"; isAdmin: boolean }
  | { kind: "INVALID_VALUE" }
  | { kind: "SELF_TARGET" }
  | { kind: "UNCHANGED" }
  | { kind: "LEADER_NEEDS_TEAM" }
  | { kind: "LEADER_ROLE_REQUIRED" };

const ROLES: readonly UserRole[] = ["ADMIN", "OPERATOR", "LEADER", "USER"];

function isUserRole(v: unknown): v is UserRole {
  return typeof v === "string" && (ROLES as readonly string[]).includes(v);
}

// 判定順: 自己 → 値不正 → 変更なし → LEADER は代表者のみ → 代表者は USER 不可 → 適用
export function planRoleChange(input: {
  actorId: string;
  targetId: string;
  current: UserRole;
  requested: unknown;
  isTeamLeader: boolean;
}): RolePlan {
  const { actorId, targetId, current, requested, isTeamLeader } = input;
  if (targetId === actorId) return { kind: "SELF_TARGET" };
  if (!isUserRole(requested)) return { kind: "INVALID_VALUE" };
  if (requested === current) return { kind: "UNCHANGED" };
  if (requested === "LEADER" && !isTeamLeader) return { kind: "LEADER_NEEDS_TEAM" };
  if (requested === "USER" && isTeamLeader) return { kind: "LEADER_ROLE_REQUIRED" };
  return { kind: "APPLY", isAdmin: requested === "ADMIN" };
}
