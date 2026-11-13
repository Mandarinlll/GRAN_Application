export interface OpponentMember {
  memberType: "REGISTERED" | "GUEST" | "PENDING";
  nickname: string | null;
}

/**
 * 対戦相手の表示名。ゲスト氏名・実名は受け取らず、固定文言で匿名化する。
 * 団体戦はチーム名優先（未設定なら個人表示にフォールバック）。
 */
export function opponentLabel(args: {
  isTeamMatch: boolean;
  teamName: string | null;
  members: OpponentMember[];
}): string {
  if (args.isTeamMatch && args.teamName && args.teamName.trim() !== "") {
    return args.teamName;
  }
  return args.members
    .map((m) => {
      if (m.memberType === "GUEST") return "ゲスト";
      if (m.memberType === "PENDING") return "未定";
      return m.nickname && m.nickname !== "" ? m.nickname : "未定";
    })
    .join("・");
}
