// 設定機能のユニットテスト（スキーマ / 氏名分割 / 設定の永続化 / ユーザー更新）。
import { describe, it, expect } from "vitest";
import {
  appSettingsSchema,
  passwordChangeSchema,
  profileSchema,
} from "@/features/settings/types/schema";
import { joinName, splitName } from "@/features/settings/utils/name";
import {
  getSettings,
  saveSettings,
} from "@/features/settings/server/settingsRepository";
import { DEFAULT_SETTINGS } from "@/features/settings/types/settings";
import {
  createUser,
  emailTakenByOther,
  findUserById,
  updateUserProfile,
} from "@/features/auth/server/userRepository";

const validProfile = {
  lastName: "佐藤",
  firstName: "健太",
  lastKana: "サトウ",
  firstKana: "ケンタ",
  nickname: "ケンタ",
  phoneNumber: "090-1234-5678",
  email: "kenta@example.com",
};

function makeUser(email: string) {
  return createUser({
    email,
    passwordHash: "hash",
    realName: "佐藤 健太",
    kanaName: "サトウ ケンタ",
    nickname: "ケンタ",
    gender: "MALE",
    birthDate: "1990-01-01",
    phoneNumber: null,
    declaredClass: "C",
    granLevel: 500,
  });
}

describe("profileSchema", () => {
  it("正しい入力を受理する", () => {
    expect(profileSchema.safeParse(validProfile).success).toBe(true);
  });
  it("電話番号は空でもよいが、数字とハイフン以外は拒否する", () => {
    expect(profileSchema.safeParse({ ...validProfile, phoneNumber: "" }).success).toBe(true);
    expect(profileSchema.safeParse({ ...validProfile, phoneNumber: "abc" }).success).toBe(false);
  });
  it("フリガナは全角カタカナのみ", () => {
    expect(profileSchema.safeParse({ ...validProfile, lastKana: "さとう" }).success).toBe(false);
  });
  it("ニックネームは必須・40文字以内", () => {
    expect(profileSchema.safeParse({ ...validProfile, nickname: " " }).success).toBe(false);
    expect(profileSchema.safeParse({ ...validProfile, nickname: "あ".repeat(41) }).success).toBe(false);
  });
  it("メール形式を検証する", () => {
    expect(profileSchema.safeParse({ ...validProfile, email: "bad" }).success).toBe(false);
  });
});

describe("passwordChangeSchema", () => {
  const ok = { currentPassword: "oldpass1", newPassword: "newpass12", newPasswordConfirm: "newpass12" };
  it("正しい入力を受理する", () => {
    expect(passwordChangeSchema.safeParse(ok).success).toBe(true);
  });
  it("確認用と不一致なら拒否する", () => {
    expect(passwordChangeSchema.safeParse({ ...ok, newPasswordConfirm: "x" }).success).toBe(false);
  });
  it("現在と同じパスワードは拒否する", () => {
    const same = { currentPassword: "samepass1", newPassword: "samepass1", newPasswordConfirm: "samepass1" };
    expect(passwordChangeSchema.safeParse(same).success).toBe(false);
  });
  it("英字・数字・8文字以上を要求する", () => {
    expect(passwordChangeSchema.safeParse({ ...ok, newPassword: "short1", newPasswordConfirm: "short1" }).success).toBe(false);
    expect(passwordChangeSchema.safeParse({ ...ok, newPassword: "onlyletters", newPasswordConfirm: "onlyletters" }).success).toBe(false);
    expect(passwordChangeSchema.safeParse({ ...ok, newPassword: "12345678", newPasswordConfirm: "12345678" }).success).toBe(false);
  });
});

describe("appSettingsSchema", () => {
  it("未定義の値を拒否する", () => {
    expect(appSettingsSchema.safeParse({ ...DEFAULT_SETTINGS, fontSize: "HUGE" }).success).toBe(false);
    expect(appSettingsSchema.safeParse({ ...DEFAULT_SETTINGS, colorMode: "RED" }).success).toBe(false);
    expect(appSettingsSchema.safeParse(DEFAULT_SETTINGS).success).toBe(true);
  });
});

describe("splitName / joinName", () => {
  it("半角・全角スペースで姓名を分割する", () => {
    expect(splitName("佐藤 健太")).toEqual({ last: "佐藤", first: "健太" });
    expect(splitName("佐藤　健太")).toEqual({ last: "佐藤", first: "健太" });
    expect(splitName("佐藤")).toEqual({ last: "佐藤", first: "" });
  });
  it("結合すると半角スペース区切りになる", () => {
    expect(joinName("佐藤", "健太")).toBe("佐藤 健太");
  });
});

describe("settingsRepository", () => {
  it("行が無ければ既定値を返し、保存後は保存値を返す（上書きも可）", () => {
    const u = makeUser("settings-repo@example.com");
    expect(getSettings(u.id)).toEqual(DEFAULT_SETTINGS);
    saveSettings(u.id, { notifyReminder: false, notifyMemberAssign: true, fontSize: "LARGE", colorMode: "DARK" });
    expect(getSettings(u.id)).toEqual({ notifyReminder: false, notifyMemberAssign: true, fontSize: "LARGE", colorMode: "DARK" });
    saveSettings(u.id, DEFAULT_SETTINGS);
    expect(getSettings(u.id)).toEqual(DEFAULT_SETTINGS);
  });
});

describe("プロフィール更新", () => {
  it("項目を更新し、空の電話番号は NULL になる", () => {
    const u = makeUser("profile-update@example.com");
    updateUserProfile(u.id, {
      realName: "鈴木 一郎",
      kanaName: "スズキ イチロウ",
      nickname: "イチ",
      phoneNumber: null,
      email: "Ichi@Example.com",
    });
    const after = findUserById(u.id)!;
    expect(after.realName).toBe("鈴木 一郎");
    expect(after.nickname).toBe("イチ");
    expect(after.phoneNumber).toBeNull();
    expect(after.email).toBe("ichi@example.com");
  });
  it("他ユーザーのメールは重複扱い、自分のメールは重複扱いにならない", () => {
    const a = makeUser("dup-a@example.com");
    const b = makeUser("dup-b@example.com");
    expect(emailTakenByOther("dup-a@example.com", b.id)).toBe(true);
    expect(emailTakenByOther("dup-a@example.com", a.id)).toBe(false);
  });
});
