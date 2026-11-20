// チームの閲覧サービス（一覧・詳細）。各関数は冒頭で accounts.manage を検証する。

import {
  getTeamDetail as repoGetTeamDetail,
  listTeams as repoListTeams,
} from "@/features/accounts/server/teamAdminRepository";
import { MSG_NOT_FOUND, withAccountsManage } from "@/features/accounts/server/accessResult";
import type { ServiceResult, TeamDetail, TeamListRow } from "@/features/accounts/types/account";
import type { TeamListQuery } from "@/features/accounts/utils/listQuery";

export interface TeamListPage {
  rows: TeamListRow[];
  total: number;
  page: number;
}

export async function listTeams(query: TeamListQuery): Promise<ServiceResult<TeamListPage>> {
  return withAccountsManage(() => repoListTeams(query));
}

export async function getTeamDetail(id: string): Promise<ServiceResult<TeamDetail>> {
  const r = await withAccountsManage(() => repoGetTeamDetail(id));
  if (!r.ok) return r;
  if (r.data === null) return { ok: false, code: "NOT_FOUND", message: MSG_NOT_FOUND };
  return { ok: true, data: r.data };
}
