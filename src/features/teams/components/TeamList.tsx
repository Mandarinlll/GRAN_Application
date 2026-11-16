// チーム一覧（クライアント）。種目・階級で絞り込み、該当チームを表示する。
"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Users } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  CATEGORY_LABEL,
  TIER_LABEL,
  type TournamentCategory,
  type TournamentTier,
} from "@/features/tournaments/types/tournament";
import {
  CategoryBadge,
  TierBadge,
} from "@/features/tournaments/components/badges";
import type { TeamListItem } from "@/features/teams/types/team";
import { filterTeams } from "@/features/teams/utils/filter";
import { membershipStateFor } from "@/features/teams/utils/membership";
import { MembershipButton } from "@/features/teams/components/MembershipButton";
import { TeamAvatar } from "@/features/teams/components/TeamAvatar";

const CATEGORIES = Object.keys(CATEGORY_LABEL) as TournamentCategory[];
const TIERS = Object.keys(TIER_LABEL) as TournamentTier[];

const SELECT_CLS =
  "min-h-[44px] rounded-xl border border-slate-200 bg-white px-3 text-xs font-bold text-slate-700";

export function TeamList({
  teams,
  userId,
  myTeamId,
  pendingTeamIds,
}: {
  teams: TeamListItem[];
  userId: string;
  myTeamId: string | null;
  pendingTeamIds: string[];
}) {
  const [category, setCategory] = useState<TournamentCategory | "ALL">("ALL");
  const [tier, setTier] = useState<TournamentTier | "ALL">("ALL");

  // 所属チームを先頭に固定し、他は元の順（チーム名順）を保つ。
  const visible = useMemo(() => {
    const filtered = filterTeams(teams, category, tier);
    return [
      ...filtered.filter((t) => t.id === myTeamId),
      ...filtered.filter((t) => t.id !== myTeamId),
    ];
  }, [teams, category, tier, myTeamId]);

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap gap-3" role="group" aria-label="チームの絞り込み">
        <label className="flex flex-col gap-1 text-xs font-bold text-slate-600">
          種目
          <select
            className={SELECT_CLS}
            value={category}
            onChange={(e) => setCategory(e.target.value as TournamentCategory | "ALL")}
          >
            <option value="ALL">すべて</option>
            {CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {CATEGORY_LABEL[c]}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-xs font-bold text-slate-600">
          階級
          <select
            className={SELECT_CLS}
            value={tier}
            onChange={(e) => setTier(e.target.value as TournamentTier | "ALL")}
          >
            <option value="ALL">すべて</option>
            {TIERS.map((t) => (
              <option key={t} value={t}>
                {TIER_LABEL[t]}
              </option>
            ))}
          </select>
        </label>
        <p className="self-end pb-3 text-xs text-slate-500 tabular-nums">
          {visible.length}チーム
        </p>
      </div>

      {visible.length === 0 ? (
        <div className="bg-white rounded-xl border border-slate-200 p-8 flex flex-col items-center text-center gap-2 shadow-sm">
          <Users className="w-8 h-8 text-slate-300" />
          <p className="text-sm font-bold text-slate-600">
            該当するチームはありません
          </p>
        </div>
      ) : (
        <ul className="space-y-3">
          {visible.map((t) => (
            <li
              key={t.id}
              className={cn(
                "bg-white rounded-xl border shadow-sm p-4 flex flex-wrap items-center gap-3",
                t.id === myTeamId ? "border-emerald-300" : "border-slate-200",
              )}
            >
              <Link
                href={`/team/${t.id}`}
                className="flex-1 min-w-[200px] flex items-center gap-3 rounded-lg hover:opacity-80 transition"
              >
                <TeamAvatar teamId={t.id} name={t.name} avatarKey={t.avatarKey} />
                <div className="space-y-1.5 min-w-0">
                <div className="text-sm font-bold text-slate-900">{t.name}</div>
                <div className="text-xs text-slate-500">
                  代表者 {t.leaderNickname} ・ {t.memberCount}名
                  {t.averageGranLevel !== null && ` ・ 平均Rate ${t.averageGranLevel}`}
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {t.tier && <TierBadge tier={t.tier} />}
                  {t.categories.map((c) => (
                    <CategoryBadge key={c} category={c} />
                  ))}
                </div>
                </div>
              </Link>
              <MembershipButton
                teamId={t.id}
                state={membershipStateFor({
                  teamId: t.id,
                  leaderUserId: t.leaderUserId,
                  userId,
                  myTeamId,
                  pendingTeamIds,
                })}
              />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
