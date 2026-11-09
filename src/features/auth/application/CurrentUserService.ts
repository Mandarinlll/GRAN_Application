// 現在ログイン中ユーザーの解決・ビューモデル変換を担うアプリケーションサービス
// （oop-architecture.md §2.5 / §5）。
//
// 現行 auth/server/currentUser.ts の getCurrentUser / toCurrentUser を移設した。
// toCurrentUser は階級ラベル算出に共有ドメイン基盤の GranLevel.toClassLabel() を用いる。
// セッション取得（getSession）は Next.js 固有のため、アダプタ（currentUser.ts）が
// 解決した SessionPayload を受け取る形にし、本サービス自体は Next 非依存に保つ。

import type { UserRepository } from "@/features/auth/domain/UserRepository";
import { GranLevel } from "@/domain/GranLevel";
import type { CurrentUser } from "@/types/home";
import type { SessionPayload, User } from "@/types/user";

export class CurrentUserService {
  constructor(private readonly users: UserRepository) {}

  // DB の User → ホーム画面の CurrentUser ビューモデルへ変換する。
  toCurrentUser(user: User): CurrentUser {
    // アバター表示用の1文字（本名先頭）。
    const avatarText = user.realName.trim().charAt(0) || "?";

    return {
      displayId: user.loginId,
      realName: user.realName,
      nickname: user.nickname,
      avatarText,
      granLevel: user.granLevel,
      classLabel: user.isLevelCalibrated
        ? new GranLevel(user.granLevel).toClassLabel()
        : "査定中",
      rankInClass: 0, // 順位機能は未実装のため暫定 0。
      teamName: "", // チーム機能は未実装のため空。
      role: user.role,
      isAdminPreview: user.isAdmin,
    };
  }

  // セッションからログイン中ユーザーを解決する。未ログイン/不整合時は null。
  getCurrentUser(session: SessionPayload | null): CurrentUser | null {
    if (!session) return null;

    const user = this.users.findById(session.sub);
    if (!user) return null;

    return this.toCurrentUser(user);
  }
}
