// ユーザーの閲覧サービス（一覧・詳細）。各関数は冒頭で accounts.manage を検証する。

import {
  getUserDetail as repoGetUserDetail,
  listUsers as repoListUsers,
  type UserListPage,
} from "@/features/accounts/server/userAdminRepository";
import { MSG_NOT_FOUND, withAccountsManage } from "@/features/accounts/server/accessResult";
import type { ServiceResult, UserDetail } from "@/features/accounts/types/account";
import type { UserListQuery } from "@/features/accounts/utils/listQuery";

export async function listUsers(query: UserListQuery): Promise<ServiceResult<UserListPage>> {
  return withAccountsManage(() => repoListUsers(query));
}

export async function getUserDetail(id: string): Promise<ServiceResult<UserDetail>> {
  const r = await withAccountsManage(() => repoGetUserDetail(id));
  if (!r.ok) return r;
  if (r.data === null) return { ok: false, code: "NOT_FOUND", message: MSG_NOT_FOUND };
  return { ok: true, data: r.data };
}
