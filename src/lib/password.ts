// パスワードのハッシュ化・照合ユーティリティ。
// db-schema.md の password_hash CHAR(60) に合わせ bcrypt を使用する。

import bcrypt from "bcryptjs";

const SALT_ROUNDS = 10;

// 平文パスワードを bcrypt ハッシュ（60文字）へ変換する。
export async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, SALT_ROUNDS);
}

// 平文パスワードとハッシュを照合する。
export async function verifyPassword(
  plain: string,
  hash: string,
): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}
