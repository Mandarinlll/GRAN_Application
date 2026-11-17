import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SessionPayload, User } from "@/types/user";

// セッションとユーザー取得をモックし、ガードの分岐だけを検証する。
const getSessionMock = vi.fn<() => Promise<SessionPayload | null>>();
const findUserByIdMock = vi.fn<(id: string) => User | null>();

vi.mock("@/lib/session", () => ({ getSession: () => getSessionMock() }));
vi.mock("@/features/auth/server/userRepository", () => ({
  findUserById: (id: string) => findUserByIdMock(id),
}));

// redirect / notFound は Next 内部の例外を投げる。遷移先が分かるようモックで置き換える。
vi.mock("next/navigation", () => ({
  redirect: (url: string) => {
    throw new Error(`REDIRECT:${url}`);
  },
  notFound: () => {
    throw new Error("NOT_FOUND");
  },
}));

import {
  AdminAccessError,
  getAdminAccess,
  requireAdmin,
  requireAdminPage,
  withAdminAction,
  withAdminApi,
} from "@/features/admin/server/guard";

function makeUser(over: Partial<User> = {}): User {
  return {
    id: "u1",
    loginId: "000001",
    email: "a@example.com",
    role: "USER",
    isAdmin: false,
    status: "ACTIVE",
    isInitialLogin: false,
    realName: "テスト 太郎",
    kanaName: "テスト タロウ",
    nickname: "t",
    avatarUrl: null,
    gender: null,
    birthDate: null,
    phoneNumber: null,
    declaredClass: null,
    granLevel: 500,
    isLevelCalibrated: true,
    ratedMatchCount: 0,
    lastLoginAt: null,
    createdAt: "",
    updatedAt: "",
    ...over,
  };
}

function loginAs(user: User, sessionRole: User["role"] = user.role) {
  getSessionMock.mockResolvedValue({
    sub: user.id,
    loginId: user.loginId,
    role: sessionRole,
    isAdmin: user.isAdmin,
  });
  findUserByIdMock.mockReturnValue(user);
}

beforeEach(() => {
  getSessionMock.mockReset();
  findUserByIdMock.mockReset();
});

describe("一般ユーザーの /admin アクセス拒否", () => {
  it("ページ: USER は 404 になる", async () => {
    loginAs(makeUser({ role: "USER" }));
    await expect(requireAdminPage()).rejects.toThrow("NOT_FOUND");
  });

  it("ページ: LEADER は 404 になる", async () => {
    loginAs(makeUser({ role: "LEADER" }));
    await expect(requireAdminPage()).rejects.toThrow("NOT_FOUND");
  });

  it("ページ: 未ログインはログインへリダイレクト", async () => {
    getSessionMock.mockResolvedValue(null);
    await expect(requireAdminPage()).rejects.toThrow("REDIRECT:/login");
  });

  it("Server Action: USER は本体が実行されず ok:false", async () => {
    loginAs(makeUser({ role: "USER" }));
    const body = vi.fn(async () => ({ ok: true as const }));
    const result = await withAdminAction("console.access", body)();
    expect(result.ok).toBe(false);
    expect(body).not.toHaveBeenCalled();
  });

  it("API Route: USER は 403、未ログインは 401 で本体が実行されない", async () => {
    const body = vi.fn(() => Response.json({}));
    const handler = withAdminApi("console.access", body);

    loginAs(makeUser({ role: "USER" }));
    expect((await handler(new Request("http://x/api/admin/me"), {})).status).toBe(403);

    getSessionMock.mockResolvedValue(null);
    expect((await handler(new Request("http://x/api/admin/me"), {})).status).toBe(401);

    expect(body).not.toHaveBeenCalled();
  });

  it("requireAdmin: USER は AdminAccessError(FORBIDDEN)", async () => {
    loginAs(makeUser({ role: "USER" }));
    const err = await requireAdmin().catch((e) => e);
    expect(err).toBeInstanceOf(AdminAccessError);
    expect(err.reason).toBe("FORBIDDEN");
  });
});

describe("管理者・運営者の許可と権限差", () => {
  it("ADMIN / OPERATOR はページに入れる", async () => {
    loginAs(makeUser({ role: "ADMIN" }));
    await expect(requireAdminPage()).resolves.toMatchObject({ role: "ADMIN" });
    loginAs(makeUser({ role: "OPERATOR" }));
    await expect(requireAdminPage()).resolves.toMatchObject({ role: "OPERATOR" });
  });

  it("OPERATOR は ADMIN 専用の Action / API を拒否される", async () => {
    loginAs(makeUser({ role: "OPERATOR" }));

    const body = vi.fn(async () => ({ ok: true as const }));
    const actionResult = await withAdminAction("accounts.manage", body)();
    expect(actionResult.ok).toBe(false);
    expect(body).not.toHaveBeenCalled();

    const apiBody = vi.fn(() => Response.json({}));
    const res = await withAdminApi("tournaments.manage", apiBody)(new Request("http://x"), {});
    expect(res.status).toBe(403);
    expect(apiBody).not.toHaveBeenCalled();
  });

  it("ADMIN は ADMIN 専用 Action を実行できる", async () => {
    loginAs(makeUser({ role: "ADMIN" }));
    const body = vi.fn(async () => ({ ok: true as const }));
    const result = await withAdminAction("accounts.manage", body)();
    expect(result.ok).toBe(true);
    expect(body).toHaveBeenCalledTimes(1);
  });
});

describe("セッションが古い場合は DB の最新状態で判定する", () => {
  it("JWT は ADMIN でも DB 上で USER に降格済みなら拒否", async () => {
    loginAs(makeUser({ role: "USER" }), "ADMIN");
    expect(await getAdminAccess()).toEqual({ ok: false, reason: "FORBIDDEN" });
  });

  it("DB 上で停止中なら拒否", async () => {
    loginAs(makeUser({ role: "ADMIN", status: "SUSPENDED" }));
    expect(await getAdminAccess()).toEqual({ ok: false, reason: "FORBIDDEN" });
  });

  it("ユーザーが削除済みなら UNAUTHENTICATED", async () => {
    getSessionMock.mockResolvedValue({ sub: "gone", loginId: "x", role: "ADMIN", isAdmin: true });
    findUserByIdMock.mockReturnValue(null);
    expect(await getAdminAccess()).toEqual({ ok: false, reason: "UNAUTHENTICATED" });
  });
});
