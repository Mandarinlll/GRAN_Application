```markdown
# コーディング規約・開発ガイドライン
## 1. ディレクトリ・アーキテクチャ構成

将来的に50機能規模へ肥大化しても保守性を維持できるよう、**Feature-based（機能別）モジュラーモノリス構成**を採用します。

```text
src/
├── app/                        # ルーティング・エントリーポイント（Next.js App Router等）
│   ├── (auth)/                 # 認証系画面ルート（U-01, U-02等）
│   ├── (user)/                 # ユーザー向け画面ルート（U-03〜U-22）
│   └── admin/                  # 管理者向け画面ルート（A-01〜A-13）
├── features/                   # 機能別モジュール（50機能拡張の核）
│   ├── auth/                   # 認証・認可機能
│   ├── tournaments/            # 大会管理・スケジュール機能
│   ├── entries/                # エントリー・キャンセル待ち機能
│   ├── teams/                  # チーム管理機能
│   ├── rankings/               # 年間ランキング・GRANレベル機能
│   └── notifications/          # LINE通知・配信機能
│       # 各featureの内部構造:
│       ├── components/         # 機能専用UIコンポーネント
│       ├── hooks/              # カスタムフック・状態管理
│       ├── server/             # サーバーアクション / APIハンドラ
│       ├── types/              # 機能固有の型定義
│       └── utils/              # 機能固有の純粋関数・バリデーション
├── components/                 # 全機能共通のUIコンポーネント（Button, Modal, Toast等）
├── lib/                        # 外部クライアント・共通設定（Supabase, LINE SDK, Prisma等）
├── types/                      # アプリケーション全体の共通型定義・DB生成型
└── utils/                      # 全体共通のユーティリティ関数（日付処理, ロギング等）

```

### モジュール依存ルールの原則

1. **上位から下位への一方向依存**: `app` $\rightarrow$ `features` $\rightarrow$ `components/lib/utils` の依存のみを許可します。
2. **Feature間の直接インポート禁止**: 原則として `features/A` から `features/B` の内部コンポーネントを直接参照せず、共通層（`components` や `types`）を介すか、Props経由で注入します。

---

## 2. 命名規則（Naming Conventions）

| 対象 | 命名規則 | 例 | 備考 |
| --- | --- | --- | --- |
| **ディレクトリ名** | kebab-case | `tournament-detail/`, `auth/` | 小文字ハイフン区切り |
| **React/Vueコンポーネント** | PascalCase | `TournamentCard.tsx`, `EntryModal.vue` | 拡張子と一致させる |
| **カスタムフック** | camelCase | `useTournamentList.ts`, `useAuth.ts` | 接頭辞 `use` を必須とする |
| **ユーティリティ・関数** | camelCase | `formatDate.ts`, `calculateFee()` | 動詞から開始する |
| **定数 / 環境変数** | UPPER_SNAKE_CASE | `MAX_WAITLIST_LIMIT`, `LINE_CHANNEL_ID` | 不変値 |
| **TypeScript 型 / インターフェース** | PascalCase | `Tournament`, `EntryStatusEnum` | 接頭辞 `I` や `T` は付けない |
| **DBテーブル名 / カラム名** | snake_case | `tournament_results`, `leader_user_id` | 単数形・小文字アンダースコア |
| **真偽値変数 / プロパティ** | camelCase | `isAdmin`, `isPending`, `hasRegistered` | `is`, `has`, `should`, `can` を前置 |

---

## 3. TypeScript & 型安全性規約

1. **`any` 型の禁止**:
* `any` の使用は原則禁止とし、型が未確定な場合は `unknown` を使用した上で型ガード（Type Guard）を実装してください。


2. **DB生成型の直接活用**:
* Supabase / Prisma 等から自動生成された型定義（`Database['public']['Tables']['...']`）を単一の情報源（Single Source of Truth）として使用してください。


3. **Enum / リテラル型の整合性**:
* DB側のカスタムENUM型とTypeScript側の型定義を厳密に同期させてください。
* 例: `type TournamentCategory = 'MEN_TEAM' | 'WOMEN_TEAM' | 'MIX_TEAM' | 'SINGLES' | 'DOUBLES';`



---

## 4. コーディングスタイル & ベストプラクティス

### 4.1 関数・コンポーネント設計

* **単一責任の原則 (SRP)**: 1つの関数・コンポーネントは1つの責務のみを持つようにしてください。肥大化したコンポーネントは `features/<feature>/components` 配下へ早期に分割してください。
* **Early Return（早期リターン）**: ネストを浅く保つため、ガード節を用いた早期リターンを徹底してください。

```typescript
// 推奨
function checkEntryEligibility(user: User, tournament: Tournament) {
  if (!user.isActive) return { eligible: false, reason: 'ACCOUNT_SUSPENDED' };
  if (tournament.status !== 'OPEN') return { eligible: false, reason: 'NOT_OPEN' };
  return { eligible: true };
}

```

### 4.2 非同期処理とエラーハンドリング

* 非同期処理は `async/await` を使用し、Promiseチェーン（`.then().catch()`）は避けてください。
* 外部API（LINE Messaging API、DB通信）呼び出し時は必ず `try-catch` で捕捉し、構造化ログを出力してください。
* ユーザーにシステムエラー詳細（スタックトレース等）を生のまま返却せず、適切なユーザー向けメッセージに変換してください。

### 4.3 コメントとドキュメント

* 「コードを見ればわかること（What）」ではなく、「なぜその実装にしたのか（Why）」をJSDoc形式で記載してください。
* ビジネスルール（例: キャンセル料率の分岐基準、定員排他制御）には必ず対応する要件番号や仕様根拠をコメントに残してください。

---

## 5. Git & バージョン管理規約（VS Code運用）

### 5.1 ブランチ戦略（GitHub Flow準拠）

* `main`: 常に本番デプロイ可能な保護ブランチ（直接Push禁止）。
* `feature/<feature-id>-<short-description>`: 機能開発ブランチ（例: `feature/U-03-tournament-list`）。
* `fix/<issue-id>-<short-description>`: バグ修正ブランチ（例: `fix/A-05-ranking-calc-error`）。

### 5.2 コミットメッセージ規約（Conventional Commits）

コミットメッセージは以下の接頭辞フォーマットを厳守してください。

```text
<type>(<scope>): <subject>

[任意: 詳細説明]

```

* **`feat`**: 新機能追加（例: `feat(entries): U-10 エントリー申込バリデーションを実装`）
* **`fix`**: バグ修正（例: `fix(cancellations): 7日前キャンセル料率の計算不具合を修正`）
* **`refactor`**: リファクタリング（機能追加やバグ修正を含まないコード変更）
* **`docs`**: ドキュメントのみの変更
* **`style`**: フォーマットの変更（空白、セミコロン等、動作に影響しない修正）
* **`test`**: テストコードの追加・修正
* **`chore`**: ビルドツールや設定の変更

---

## 6. Antigravity & AI連携ガイドライン

Antigravity等のAIエージェントを活用した開発を効率化するため、以下の規約を遵守してください。

1. **コンテキストファイルの配置**:
* 新機能実装時は、関連する機能仕様（画面ID、DB定義、ビジネスルール）をプロンプトまたは作業コンテキストに明示的に含めてください。


2. **自動生成コードのレビュー基準**:
* AIが生成したコードに対して、以下の3点を必ず検証してからコミットしてください：
* ① DB制約（例: `leader_user_id` のユニーク性、ENUM整合性）が崩れていないか。
* ② 本コーディング規約の命名規則・ディレクトリ構造に合致しているか。
* ③ `any` 型の混入や不要なライブラリの追加がないか。




3. **設定の共通化**:
* プロジェクトルートに `.editorconfig`, `.prettierrc`, `tsconfig.json`, `eslint.config.js` を配置し、エディタ・AI・CI環境でコードフォーマットの不一致が発生しないようにします。



---

## 7. 静的解析・リンター設定値

| ツール | 用途 | 推奨ルール |
| --- | --- | --- |
| **ESLint** | コード品質・規約チェック | `@typescript-eslint/recommended`, `no-explicit-any: error` |
| **Prettier** | 自動コード整形 | `semi: true`, `singleQuote: true`, `tabWidth: 2`, `printWidth: 100` |
| **TypeScript** | 型検査 | `strict: true`, `noImplicitAny: true`, `strictNullChecks: true` |

```

```