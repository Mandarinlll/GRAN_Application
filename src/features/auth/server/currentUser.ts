// セッションからログイン中ユーザーを解決し、ホーム画面用のビューモデルへ変換する。

import { getSession } from "@/lib/session";
import { findUserById } from "@/features/auth/server/userRepository";
import { granLevelToClassLabel } from "@/features/auth/utils/classLabel";
import type { CurrentUser } from "@/types/home";
import type { User } from "@/types/user";

// DB の User → ホーム画面の CurrentUser ビューモデルへ変換する。
function toCurrentUser(user: User): CurrentUser {
  // アバター表示用の1文字（本名先頭）。
  const avatarText = user.realName.trim().charAt(0) || "?";

  return {
    displayId: user.loginId,
    realName: user.realName,
    nickname: user.nickname,
    avatarText,
    granLevel: user.granLevel,
    classLabel: user.isLevelCalibrated
      ? granLevelToClassLabel(user.granLevel)
      : "査定中",
    rankInClass: 0, // 順位機能は未実装のため暫定 0。
    teamName: "", // チーム機能は未実装のため空。
    role: user.role,
    isAdminPreview: user.isAdmin,
  };
}

// 現在のログインユーザーを取得する。未ログイン/不整合時は null。
export async function getCurrentUser(): Promise<CurrentUser | null> {
  const session = await getSession();
  if (!session) return null;

  const user = findUserById(session.sub);
  if (!user) return null;

  return toCurrentUser(user);
}
