# テニス大会運営システム「GRAN」コーディング規約・開発ガイドライン

本書は、テニス大会運営Webアプリケーション「GRAN」（LIFF / モバイルWeb / PC管理画面）の品質・保守性・安全性を高水準で維持するためのコーディング規約および開発標準です。
開発者およびAIエージェントは、すべての実装において本規約を遵守してください。

---

## 1. システム全体アーキテクチャ & ディレクトリ構成

将来的な機能拡張（50機能規模へのスケール）に対応するため、**Feature-based（機能別）モジュラーモノリス構成**を採用します。

### 1.1 ディレクトリ構成標準

```text
src/
├── app/                        # ルーティング・エントリーポイント（Next.js App Router）
│   ├── (auth)/                 # 認証系画面（ログイン、新規登録、PWリセット）
│   ├── (user)/                 # 一般ユーザー・代表者向け画面（LIFF/モバイルWeb: U-01〜U-22）
│   │   ├── tournaments/        # 大会一覧・詳細・カレンダー
│   │   ├── entries/            # 申込・マイスケジュール・キャンセル
│   │   ├── teams/              # チーム作成・メンバー管理
│   │   └── rankings/           # 年間ランキング・GRANレベル
│   └── admin/                  # 管理者・運営者向け管理画面（PC/Web: A-01〜A-13）
│       ├── dashboard/          # 集客KPI・損益管理・アラート
│       ├── tournaments/        # 大会登録・コピー・ドロー作成
│       ├── entries/            # 代理登録・有償キャンセル精算
│       └── results/            # スコア入力・レーティング/ランキング反映
├── features/                   # 機能別独立モジュール（ドメインロジックの核）
│   ├── auth/                   # 認証・認可・2FA
│   ├── tournaments/            # 大会管理・募集状態管理
│   ├── entries/                # 申込・定員排他制御・キャンセル待ちキュー
│   ├── teams/                  # チーム・メンバー権限
│   ├── ratings/                # イロレーティング（GRANレベル）・年間ポイント計算
│   └── notifications/          # LINE Messaging API連携・自動配信バッチ
│       # 各 feature の内部構成:
│       ├── components/         # 機能固有のUIコンポーネント
│       ├── hooks/              # カスタムフック・UI状態管理
│       ├── server/             # Server Actions / バックエンドAPIハンドラ
│       ├── types/              # 機能固有の型定義・Zodスキーマ
│       └── utils/              # 機能固有の計算・純粋関数（レート計算、キャンセル料率判定等）
├── components/                 # 全機能共通UIコンポーネント（shadcn/ui, Button, Modal, Toast等）
│   └── ui/                     # 基本アトミックコンポーネント
├── lib/                        # 外部クライアント・共通設定（Supabase, LINE SDK, Prisma, 日付ライブラリ等）
├── types/                      # アプリケーション全体の共通型・DB自動生成型
└── utils/                      # 全体共通の純粋ユーティリティ（cn, 日付フォーマット, ロガー等）
```

### 1.2 モジュール依存性ルール

1. **上位から下位への一方向依存**:
   - `app` $\rightarrow$ `features` $\rightarrow$ `components / lib / types / utils`
2. **Feature間の直接クロスインポート禁止**:
   - `features/tournaments` から `features/entries` のプライベートな内部モジュールを直接インポートしてはなりません。
   - 機能間で共有が必要なロジック・型は、ルートの `components` / `types` / `utils` へ昇格させるか、Props / Context 経由で注入してください。

---

## 2. 命名規則（Naming Conventions）

| 対象 | 命名規則 | 適用例 | 備考 |
| :--- | :--- | :--- | :--- |
| **ディレクトリ名** | `kebab-case` | `tournament-detail/`, `entry-form/` | 小文字ハイフン区切り |
| **Reactコンポーネント** | `PascalCase` | `TournamentCard.tsx`, `CancelModal.tsx` | ファイル名とコンポーネント名を一致 |
| **カスタムフック** | `camelCase` | `useTournamentList.ts`, `useAuth.ts` | 接頭辞 `use` を必須 |
| **ユーティリティ・関数** | `camelCase` | `calculateCancelFee()`, `formatDate()` | 原則として「動詞＋名詞」で開始 |
| **定数 / 環境変数** | `UPPER_SNAKE_CASE` | `MAX_WAITLIST_LIMIT`, `LINE_CHANNEL_ID` | 再代入不可・静的設定値 |
| **TypeScript 型 / インターフェース** | `PascalCase` | `Tournament`, `EntryMember` | 接頭辞 `I` や `T`（`ITournament`等）は禁止 |
| **Zod バリデーションスキーマ** | `camelCase` | `tournamentCreateSchema`, `userProfileSchema` | 末尾に `Schema` を付与 |
| **真偽値変数 / プロパティ** | `camelCase` | `isAdmin`, `isLevelCalibrated`, `hasPaid` | `is`, `has`, `can`, `should` を前置 |
| **DBテーブル名 / カラム名** | `snake_case` | `tournament_results`, `leader_user_id` | 単数形または統一された物理名 |

---

## 3. TypeScript & 型安全性規約

### 3.1 `any` 型の完全禁止と型ガードの徹底
- `any` 型の使用は禁止です。
- 型が不明な外部入力（LINE Webhookペイロード、未知のAPIレスポンス等）は `unknown` で受け取り、Zod または Type Guard 関数でバリデーションを行ってください。

```typescript
// ❌ 非推奨: any の使用
function handleWebhook(payload: any) {
  console.log(payload.events[0].source.userId);
}

// ⭕ 推奨: Zod または 型ガードによる安全な検証
import { z } from 'zod';

const lineWebhookSchema = z.object({
  events: z.array(
    z.object({
      type: z.string(),
      source: z.object({
        userId: z.string(),
      }),
    })
  ),
});

function handleWebhook(payload: unknown) {
  const result = lineWebhookSchema.safeParse(payload);
  if (!result.success) {
    throw new Error('Invalid LINE webhook payload');
  }
  const userId = result.data.events[0].source.userId;
}
```

### 3.2 データベース生成型の Single Source of Truth
- Supabase / Prisma 等から自動生成された型定義（`Database['public']['Tables']['...']`）を最上位の型定義元として使用します。
- UIやAPIレスポンス用の型は、生成型から `Pick`, `Omit`, `Partial` を用いて派生させてください。

### 3.3 DB ENUM型と同期したリテラル型定義

```typescript
// 権限区分（4段階）
export type UserRole = 'ADMIN' | 'OPERATOR' | 'LEADER' | 'USER';

// 大会種目区分
export type TournamentCategory = 
  | 'MEN_TEAM' 
  | 'WOMEN_TEAM' 
  | 'MIX_TEAM' 
  | 'SINGLES' 
  | 'DOUBLES';

// 大会ステータス
export type TournamentStatus = 
  | 'DRAFT' 
  | 'UPCOMING' 
  | 'OPEN' 
  | 'CLOSED' 
  | 'FINISHED' 
  | 'CANCELLED';

// エントリーステータス
export type EntryStatus = 'CONFIRMED' | 'WAITING' | 'CANCELLED' | 'ATTENDED';

// キャンセル対応ステータス
export type CancellationAdminStatus = 
  | 'NOT_REQUIRED' 
  | 'UNCONTACTED' 
  | 'IN_CONSULTATION' 
  | 'PAID_CONFIRMED' 
  | 'WAIVED';

// 成績・年間pt区分 (1pt: 参加, 2pt: 2位トーナメント優勝/1位トーナメント準優勝, 3pt: 1位トーナメント優勝)
export type ResultRank = 'PARTICIPATED' | 'L2_WINNER' | 'T1_RUNNER_UP' | 'T1_WINNER';
```

---

## 4. UI & デザインシステム実装規約

`docs/ui-design-system.md` の定義を厳格に順守してください。

### 4.1 UI技術スタック
- **Base Framework**: Tailwind CSS
- **Component Library**: **shadcn/ui**（Radix UI ベース）
- **Icon Library**: **Lucide React**（サイズ標準: 16px / 20px / 24px）
- **Class Utility**: `cn(...)`（`clsx` + `tailwind-merge`）

### 4.2 デザイントークン & テーマカラー規約
- **屋外モバイル環境の視認性確保のため、ライトテーマ固定（ダークモード非対応）**。
- インラインスタイル（`style={{ color: '#059669' }}`）や任意クラス（`bg-[#059669]`）の直接指定は禁止。必ず以下のセマンティックトークンクラスを使用してください。

| 用途 | 指定クラス | 代表的な用途 |
| :--- | :--- | :--- |
| **全体背景** | `bg-slate-50` | 画面全体のベース背景 |
| **カード / 面** | `bg-white` | コンポーネント、モーダル、ボトムシート |
| **Primary (メイン)** | `emerald-600` / `hover:bg-emerald-700` | 主要CTAボタン、アクティブタブ、残枠十分バッジ |
| **Secondary (補助)** | `indigo-600` / `hover:bg-indigo-700` | 管理画面アクション、カレンダー、GRANレベル強調 |
| **Text (主要/副次/注釈)** | `text-slate-900` / `text-slate-600` / `text-slate-400` | 見出し / ラベル・説明 / プレースホルダー・非活性 |
| **Border** | `border-slate-200` | カード外枠、リスト区切り線、インプット枠 |
| **Warning** | `amber-500` / `bg-amber-50` | 残りわずか、キャンセル料50%警告 |
| **Danger** | `rose-600` / `bg-rose-50` | 満員（キャンセル待ち）、キャンセル料100%警告、削除操作 |

### 4.3 スタイリング統一基準
- **角丸**:
  - ボタン・入力欄: `rounded-lg` (8px)
  - カード・ダイアログ: `rounded-xl` (12px)
  - バッジ・ピル: `rounded-full`
- **タップターゲット（モバイル）**:
  - モバイル操作ボタンは最小タップ領域 `h-11` (44px) 以上を確保。
- **クラス結合**:
  - クラスの条件分岐・上書きには必ず `cn(...)` を使用する。

```tsx
import { cn } from '@/lib/utils';

interface BadgeProps {
  status: 'OPEN' | 'FEW' | 'FULL';
  className?: string;
}

export function CapacityBadge({ status, className }: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold',
        status === 'OPEN' && 'bg-emerald-50 text-emerald-700 border border-emerald-200',
        status === 'FEW' && 'bg-amber-50 text-amber-700 border border-amber-200',
        status === 'FULL' && 'bg-rose-50 text-rose-700 border border-rose-200',
        className
      )}
    >
      {status === 'OPEN' ? '空き枠あり' : status === 'FEW' ? '残りわずか' : '満員 (キャンセル待ち)'}
    </span>
  );
}
```

---

## 5. ドメイン別ビジネスロジック実装規約

仕様書（`requirements-detail-user.md`, `requirements-detail-administrator.md`, `db-schema.md`）に規定された重要ビジネスルールは、以下の共通仕様に則って実装してください。

### 5.1 キャンセル料率 & 請求計算規約
開催日までの残日数（`days_before`）に応じて厳格に料率を判定します。

```typescript
export interface CancelFeeResult {
  feeRate: 0 | 50 | 100;
  feeAmount: number;
  isPaid: boolean;
  adminStatus: CancellationAdminStatus;
}

export function calculateCancelFee(eventDate: Date, cancelDate: Date, entryFee: number): CancelFeeResult {
  // 日付差分（日単位）の算出
  const diffTime = eventDate.setHours(0, 0, 0, 0) - cancelDate.setHours(0, 0, 0, 0);
  const daysBefore = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

  if (daysBefore >= 8) {
    return { feeRate: 0, feeAmount: 0, isPaid: false, adminStatus: 'NOT_REQUIRED' };
  }
  if (daysBefore >= 3 && daysBefore <= 7) {
    return { feeRate: 50, feeAmount: Math.floor(entryFee * 0.5), isPaid: true, adminStatus: 'UNCONTACTED' };
  }
  return { feeRate: 100, feeAmount: entryFee, isPaid: true, adminStatus: 'UNCONTACTED' };
}
```

### 5.2 GRANレベル（イロレーティング）更新規約
- レート範囲制約: **100 〜 999**（CHECK制約に準拠）。
- 消化公式戦数（`rated_match_count`）による変動係数 $K$ の切り替え：
  - 1〜5戦目（初期査定期間）: $K = 32$
  - 6戦目以降（通常運用期間）: $K = 16$
- 計算前後の値（`pre_gran_level`, `gran_level_diff`, `post_gran_level`）を必ず `tournament_results` テーブルへ記録すること。

```typescript
export function calculateNewGranLevel(
  currentLevel: number,
  opponentLevel: number,
  isWin: boolean,
  matchCount: number
): { nextLevel: number; diff: number } {
  const K = matchCount < 5 ? 32 : 16;
  const expectedScore = 1 / (1 + Math.pow(10, (opponentLevel - currentLevel) / 400));
  const actualScore = isWin ? 1 : 0;
  
  const rawDiff = Math.round(K * (actualScore - expectedScore));
  const nextLevel = Math.max(100, Math.min(999, currentLevel + rawDiff));
  const diff = nextLevel - currentLevel;

  return { nextLevel, diff };
}
```

### 5.3 年間ランキングポイント付与規約
- 成績区分（`result_rank_enum`）に応じた固定ポイント：
  - 参加（予選敗退等）: `1pt`
  - 2位トーナメント優勝 / 1位トーナメント準優勝: `2pt`
  - 1位トーナメント優勝: `3pt`

### 5.4 権限管理 & アクセス制御（4段階ロール）
- **`ADMIN`（管理者）**: 全操作可能（大会設定、料金変更、アカウント強制削除、権限付与）。
- **`OPERATOR`（運営者）**: 当日ドロー進行、スコア入力、エントリー確認のみ可能（設定変更・削除は不可）。
- **`LEADER`（代表者）**: チーム作成・編集、メンバー招待・除名、団体戦エントリー・キャンセル。
- **`USER`（一般ユーザー）**: 個人戦エントリー、所属チームの閲覧、自己プロフィール編集。

---

## 6. データベース・サーバーサイド実装規約

### 6.1 トランザクション & 排他制御の徹底
以下の処理はデータ不整合を防ぐため、必ずDBトランザクション（Supabase RPC または PostgreSQL トランザクション）内で実行してください。
1. **エントリー確定処理**: 定員枠（`capacity`）の排他チェックと `entries` / `waitlists` への割り当て。
2. **キャンセル待ち繰り上がり承諾**: 辞退・承諾時のステータス更新と新エントリー生成の整合性担保。
3. **試合結果確定 & レート更新**: `tournament_matches`, `tournament_results`, `users.gran_level` の一括アトミック更新。

### 6.2 監査・通知ログの記録義務
- LINE通知（エントリー完了、キャンセル待ち繰り上がり、10日前督促等）送信時は、成否を問わず必ず `notification_logs` テーブルにログを記録してください。

---

## 7. エラーハンドリング & セキュリティ規約

1. **早期リターン（Early Return / Guard Clauses）**:
   - ネストを浅く保つため、バリデーションや前提条件チェックは関数の冒頭で早期リターンしてください。
2. **安全なエラーメッセージ返却**:
   - クライアント側へDBエラーや内部スタックトレースを直接返却せず、ユーザーフレンドリーなメッセージ（例: `「エントリーの受付期間外です」`）へマッピングしてください。
3. **機密情報の保護**:
   - `password_hash` や LINE Channel Secret 等はクライアントサイドに露出させてはなりません。

---

## 8. Git & バージョン管理・コミット規約

### 8.1 ブランチ命名規則（GitHub Flow）
- `main`: 常に本番デプロイ可能な保護ブランチ。
- `feature/<画面/機能ID>-<概要>`: 機能開発（例: `feature/U-03-tournament-list`, `feature/A-05-ranking-calc`）
- `fix/<画面/機能ID>-<概要>`: 不具合修正（例: `fix/U-10-cancel-fee-rounding`）

### 8.2 コミットメッセージ規約（Conventional Commits）

```text
<type>(<scope>): <subject>

[任意: 詳細説明]
```

- `feat`: 新機能追加（例: `feat(entries): U-10 エントリー申込バリデーションを実装`）
- `fix`: バグ修正（例: `fix(ratings): K値判定における消化試合数の計算不具合を修正`）
- `refactor`: リファクタリング（挙動を変えないコード整理）
- `docs`: ドキュメント・規約の更新
- `style`: コード整形（Prettier等）
- `test`: テストコードの追加・修正
- `chore`: ビルドツールや設定ファイルの変更

---

## 9. 静的解析 & フォーマット設定値

| ツール | 推奨設定 | 適用ルール |
| :--- | :--- | :--- |
| **TypeScript** | `strict: true` | `noImplicitAny: true`, `strictNullChecks: true` |
| **ESLint** | `@typescript-eslint/recommended` | `@typescript-eslint/no-explicit-any: error` |
| **Prettier** | `.prettierrc` | `semi: true`, `singleQuote: true`, `tabWidth: 2`, `printWidth: 100`, `trailingComma: 'es5'` |