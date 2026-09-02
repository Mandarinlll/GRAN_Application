```python
# Prompt asks to output the result purely as a Markdown block for `docs/ui-design-system.md`
# Let's verify whether the system instruction requires executing python code for generating files or if Markdown output in chat is expected.
# The user asks: "成果物はそのまま `docs/ui-design-system.md` として保存できるよう、Markdownブロックのみで出力してください。"
# Let's check system instructions:
# "YOU MUST ALWAYS CALL google:ds_python_interpreter to execute python code to generate files. Do NOT just output code as text — always execute it using google:ds_python_interpreter."
# However, the user also wants to see the markdown. Generating a file and outputting the markdown is best.
# Let's write the markdown file to docs/ui-design-system.md using python interpreter, and then output the file tag and markdown content!

md_content = """# 共通UI・デザインシステム定義書 (UI Design System Specification)

本書は、本Webアプリケーション（モバイルWeb / SPA / PC管理画面）におけるUIの一貫性を担保し、AIコード生成および開発者実装においてデザインのブレを防ぐための厳格な共通UI・デザインシステム定義書です。
AIエージェントおよび開発者は、すべての画面・コンポーネント実装において本ドキュメントの定義・クラス指定・規約に厳密に従ってください。

---

## 1. テーマカラー定義 (Theme & Color Tokens)

Tailwind CSS v3/v4の標準セマンティックカラーにマッピングされたデザイントークンです。
テニス・スポーツ大会運営アプリとして、清潔感、視認性（屋外モバイル環境）、信頼性を両立する**エメラルド・スレート・インディゴ**基調のパレットを採用します。

### 1.1 カラーパレット & セマンティックマッピング

| 用途 / トークン名 | Tailwind クラス名 | HEX値 | 用途・適用対象 |
| :--- | :--- | :--- | :--- |
| **Primary (メイン)** | `emerald-600` | `#059669` | 主要CTAボタン、アクティブタブ、主要ハイライト |
| **Primary Hover** | `emerald-700` | `#047857` | プライマリボタンのホバー/アクティブ状態 |
| **Primary Light** | `emerald-50` | `#ecfdf5` | プライマリアクティブ背景、バッジ背景 |
| **Secondary (補助)** | `indigo-600` | `#4f46e5` | 管理者アクション、カレンダー連携、GRANレベル強調 |
| **Secondary Hover** | `indigo-700` | `#4338ca` | セカンダリボタンホバー |
| **Background (全体背景)** | `slate-50` | `#f8fafc` | アプリ全体のベース背景色（全画面共通） |
| **Surface (カード/面)** | `white` | `#ffffff` | コンポーネントカード、ダイアログ、ボトムナビ背景 |
| **Text Primary (主要文字)** | `slate-900` | `#0f172a` | 見出し、メインテキスト、重要数値 |
| **Text Secondary (副次文字)** | `slate-600` | `#475569` | ラベル、説明文、メタデータ、プレースホルダー |
| **Text Muted (注釈/薄文字)** | `slate-400` | `#94a3b8` | 無効化テキスト、補助アイコン、非活性要素 |
| **Border / Divider (境界線)** | `slate-200` | `#e2e8f0` | カード枠線、リスト区切り線、インプット枠線 |
| **Success (成功/空き枠あり)** | `emerald-500` | `#10b981` | エントリー完了、空き枠十分、正常ステータス |
| **Warning (警告/残りわずか)** | `amber-500` | `#f59e0b` | 残り枠わずか、有償キャンセル注意(50%)、未定リマインド |
| **Danger (エラー/満員/危険)** | `rose-600` | `#e11d48` | 満員(キャンセル待ち)、有償キャンセル(100%)、削除 |
| **Info (情報)** | `sky-500` | `#0ea5e9` | 一般お知らせ、キャンセル待ち順位通知 |

### 1.2 `tailwind.config.js` 設定例
```javascript
/** @type {import('tailwindcss').Config} */
module.exports = {
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#ecfdf5',
          100: '#d1fae5',
          500: '#10b981',
          600: '#059669',
          700: '#047857',
        },
      },
    },
  },
};

```

---

## 2. コンポーネントライブラリ & スタイリング方針

### 2.1 採用スタック

* **Base Framework**: Tailwind CSS (Tailwind UI パターン準拠)
* **UI Library**: **shadcn/ui** (Radix UI ベース、Tailwind完全統合)
* **Icons**: **Lucide React** (統一サイズ: 16px / 20px / 24px)
* **Utility**: `clsx`, `tailwind-merge` (`cn` ヘルパー関数を使用)

### 2.2 クラス統合ユーティリティ (`src/lib/utils.ts`)

```typescript
import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

```

### 2.3 カスタマイズ方針

1. **ダークモード非対応（ライトテーマ完全固定）**: モバイル屋外利用（テニスコート等）での高コントラスト視認性を最優先とするため、背景は常に `bg-slate-50`、カードは `bg-white` を維持する。
2. **ハードコードカラーの禁止**: インラインスタイル（`style={{ color: '#059669' }}`）は禁止。必ず定義済みのTailwindセマンティッククラスを使用する。
3. **角丸の統一**:
* ボタン / インプット: `rounded-lg` (8px)
* カード / モーダル: `rounded-xl` (12px)
* バッジ / ピル: `rounded-full` (9999px)


4. **シャドウの統一**:
* カード / パネル: `shadow-sm border border-slate-200`
* モーダル / ポップオーバー / ボトムシート: `shadow-lg border border-slate-100`



---

## 3. ボタン共通スタイル (Button Variants & States)

すべてのボタンは、タッチ領域を確保するため高さ44px以上（モバイル推奨 `h-11` / `h-12`）を基本とし、明示的なフォーカス・アクティブ状態を定義します。

### 3.1 ボタンスタイル仕様表

| バリアント | 基本クラス | ホバー・アクティブ | 無効化 (Disabled) |
| --- | --- | --- | --- |
| **Primary (主要CTA)** | `bg-emerald-600 text-white font-medium shadow-sm` | `hover:bg-emerald-700 active:bg-emerald-800` | `disabled:bg-slate-300 disabled:text-slate-500 disabled:cursor-not-allowed disabled:shadow-none` |
| **Secondary (副次)** | `bg-slate-100 text-slate-700 font-medium border border-slate-200` | `hover:bg-slate-200 active:bg-slate-300` | `disabled:bg-slate-50 disabled:text-slate-400 disabled:border-slate-100 disabled:cursor-not-allowed` |
| **Outline (枠線)** | `bg-white text-emerald-600 border border-emerald-600 font-medium` | `hover:bg-emerald-50 active:bg-emerald-100` | `disabled:border-slate-200 disabled:text-slate-400 disabled:cursor-not-allowed` |
| **Destructive (危険)** | `bg-rose-600 text-white font-medium shadow-sm` | `hover:bg-rose-700 active:bg-rose-800` | `disabled:bg-slate-300 disabled:text-slate-500 disabled:cursor-not-allowed` |
| **Ghost (テキストのみ)** | `bg-transparent text-slate-600 font-medium` | `hover:bg-slate-100 active:bg-slate-200` | `disabled:text-slate-300 disabled:cursor-not-allowed` |

### 3.2 コピペ用実装コンポーネントコード (`src/components/ui/button.tsx`)

```tsx
import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';
import { Loader2 } from 'lucide-react';

const buttonVariants = cva(
  'inline-flex items-center justify-center whitespace-nowrap rounded-lg text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2 disabled:pointer-events-none select-none',
  {
    variants: {
      variant: {
        primary:
          'bg-emerald-600 text-white shadow-sm hover:bg-emerald-700 active:bg-emerald-800 disabled:bg-slate-300 disabled:text-slate-500 disabled:shadow-none',
        secondary:
          'bg-slate-100 text-slate-800 border border-slate-200 hover:bg-slate-200 active:bg-slate-300 disabled:bg-slate-50 disabled:text-slate-400 disabled:border-slate-100',
        outline:
          'bg-white text-emerald-700 border border-emerald-600 hover:bg-emerald-50 active:bg-emerald-100 disabled:border-slate-200 disabled:text-slate-400',
        destructive:
          'bg-rose-600 text-white shadow-sm hover:bg-rose-700 active:bg-rose-800 disabled:bg-slate-300 disabled:text-slate-500',
        ghost:
          'text-slate-700 hover:bg-slate-100 active:bg-slate-200 disabled:text-slate-400',
      },
      size: {
        sm: 'h-9 px-3 text-xs rounded-md',
        md: 'h-11 px-4 py-2 text-sm',
        lg: 'h-12 px-6 text-base font-semibold',
        full: 'w-full h-12 px-6 text-base font-semibold',
        icon: 'h-10 w-10 p-0',
      },
    },
    defaultVariants: {
      variant: 'primary',
      size: 'md',
    },
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  isLoading?: boolean;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, isLoading, children, disabled, ...props }, ref) => {
    return (
      <button
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        disabled={disabled || isLoading}
        {...props}
      >
        {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin text-current" />}
        {children}
      </button>
    );
  }
);
Button.displayName = 'Button';

```

---

## 4. タイポグラフィとフォントルール (Typography)

日本語環境で最も可読性が高いシステムフォントスタックを指定し、見出し・本文・注釈のフォントサイズ、ウェイト、行間（Leading）を統一します。

### 4.1 フォントファミリー定義

```css
font-family: 'Hiragino Sans', 'Hiragino Kaku Gothic ProN', 'BIZ UDPGothic', 'Meiryo', sans-serif;

```

### 4.2 タイポグラフィ階層定義表

| 要素 | Tailwind クラス群 | サイズ / 行間 / 太さ | 用途 |
| --- | --- | --- | --- |
| **Page Title (H1)** | `text-xl sm:text-2xl font-bold text-slate-900 leading-tight` | 20px / 24px (sm: 24px/32px) Bold | 画面最上部タイトル、ヘッダー |
| **Section Title (H2)** | `text-lg sm:text-xl font-bold text-slate-800 leading-snug` | 18px / 28px Bold | カード見出し、ブロック区切り |
| **Card / Sub Title (H3)** | `text-base font-semibold text-slate-800 leading-normal` | 16px / 24px Semibold | 大会カード名、チーム名、モーダル題名 |
| **Body (本文)** | `text-sm font-normal text-slate-700 leading-relaxed` | 14px / 20px Normal | 一般説明文、要項本文、フォームラベル |
| **Body Medium (強調本文)** | `text-sm font-medium text-slate-900 leading-relaxed` | 14px / 20px Medium | 項目名、強調データ、テーブルヘッダー |
| **Caption (注釈/補足)** | `text-xs font-normal text-slate-500 leading-normal` | 12px / 16px Normal | 日時補足、残り枠数注釈、免責事項 |
| **Badge / Stat (数値強調)** | `text-xs font-bold uppercase tracking-wider` | 12px Bold / 字間広め | GRANレベル数値、ステータスタグ |

---

## 5. レイアウト & 余白規則 (Spacing & Layout Grid)

8px（0.5rem = `p-2` / `m-2`）を基本スケールとする **8pxグリッドシステム**（微調整時は4px = `1`）を厳格に適用します。

### 5.1 余白スケール基準表

| トークン | サイズ | Tailwind クラス | 適用対象の標準ルール |
| --- | --- | --- | --- |
| **3xs** | 2px | `gap-0.5`, `p-0.5` | 微細ボーダー調整、極小アイコン余白 |
| **2xs** | 4px | `gap-1`, `p-1`, `space-y-1` | バッジ内パディング、インライン要素間 |
| **xs** | 8px | `gap-2`, `p-2`, `space-y-2` | フォームラベルとインプットの間、アイコンとテキスト間 |
| **sm** | 12px | `gap-3`, `p-3`, `space-y-3` | コンパクトカード内パディング、リスト行間 |
| **md** | 16px | `gap-4`, `p-4`, `space-y-4` | **標準カード内パディング**、フォームフィールド間隔 |
| **lg** | 24px | `gap-6`, `p-6`, `space-y-6` | セクション間の余白、モーダル内パディング |
| **xl** | 32px | `gap-8`, `py-8`, `space-y-8` | ページメインブロック間の余白 |

### 5.2 画面コンテナ & ページ構造ルール

* **モバイル画面**:
* ルートラッパー: `min-h-screen bg-slate-50 pb-20` (※ボトムナビの被りを防ぐため `pb-20` 必須)
* 水平パディング: `px-4` (16px)
* 最大幅制限: `max-w-md mx-auto` (モバイル画面をPCでプレビューした際の中央寄せ)


* **管理者 Web 画面**:
* ルートラッパー: `min-h-screen bg-slate-50`
* メインコンテンツ幅: `max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8`



---

## 6. レスポンシブ対応基準 (Responsive Breakpoints)

本システムは **モバイルファースト（Mobile-First）** を原則とします。ベースクラスはスマートフォン（モバイル環境: 375px〜430px）向けに記述し、管理者画面やタブレット向けにブレイクポイント接頭辞を付与します。

### 6.1 ブレイクポイント定義

| 接頭辞 | 最小幅 | 主なターゲットデバイス | レイアウト指針 |
| --- | --- | --- | --- |
| *(None)* | `0px` | スマートフォン (iOS / Android) | 1カラム構成、フルワイドボタン、下部固定ボトムナビ |
| `sm:` | `640px` | 大型スマホ / 小型タブレット | カードパディング拡張 (`p-6`)、ボタン幅の自動調整 |
| `md:` | `768px` | タブレット / 管理画面サブPC | 2カラムグリッド (`grid-cols-2`)、サイドバーナビ表示切替 |
| `lg:` | `1024px` | デスクトップ PC (管理画面メイン) | 3〜4カラムグリッド、テーブル全列表示、固定サイドメニュー |

---

## 7. 実装コードサンプル集 (AIコピペ用標準コンポーネント)

AIが画面を生成する際、以下のコード構造・クラスパターンをそのまま使用してください。

### 7.1 大会情報カードコンポーネント (`TournamentCard.tsx`)

```tsx
import React from 'react';
import { Calendar, MapPin, Users, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface TournamentCardProps {
  id: string;
  title: string;
  category: '男子団体' | '女子団体' | 'ミックス団体' | 'シングルス' | 'ダブルス';
  eventDate: string;
  venue: string;
  capacity: number;
  remainingSlots: number;
  entryFee: number;
  status: 'OPEN' | 'FULL' | 'CLOSED';
  onEntry: (id: string) => void;
}

export const TournamentCard: React.FC<TournamentCardProps> = ({
  id,
  title,
  category,
  eventDate,
  venue,
  capacity,
  remainingSlots,
  entryFee,
  status,
  onEntry,
}) => {
  const isFull = remainingSlots <= 0 || status === 'FULL';

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm hover:border-slate-300 transition-shadow">
      {/* ヘッダー: カテゴリバッジ & 残り枠 */}
      <div className="flex items-center justify-between gap-2 mb-2">
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
          {category}
        </span>
        {isFull ? (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-rose-50 text-rose-700 border border-rose-200">
            満員 (キャンセル待ち受付中)
          </span>
        ) : (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200">
            残り {remainingSlots} 枠
          </span>
        )}
      </div>

      {/* 大会名 */}
      <h3 className="text-base font-bold text-slate-900 leading-snug mb-3">
        {title}
      </h3>

      {/* 日時・場所・料金情報 */}
      <div className="space-y-1.5 text-xs text-slate-600 mb-4">
        <div className="flex items-center gap-2">
          <Calendar className="w-4 h-4 text-slate-400 shrink-0" />
          <span>{eventDate}</span>
        </div>
        <div className="flex items-center gap-2">
          <MapPin className="w-4 h-4 text-slate-400 shrink-0" />
          <span className="truncate">{venue}</span>
        </div>
        <div className="flex items-center gap-2">
          <Users className="w-4 h-4 text-slate-400 shrink-0" />
          <span>定員 {capacity} チーム / ¥{entryFee.toLocaleString()}(税込)</span>
        </div>
      </div>

      {/* アクションボタン */}
      <Button
        variant={isFull ? 'secondary' : 'primary'}
        size="full"
        onClick={() => onEntry(id)}
      >
        {isFull ? 'キャンセル待ちを申し込む' : 'エントリーへ進む'}
        <ChevronRight className="w-4 h-4 ml-1" />
      </Button>
    </div>
  );
};

```

### 7.2 GRANレベル表示 & ユーザーアバター (`UserRatingBadge.tsx`)

```tsx
import React from 'react';

interface UserRatingBadgeProps {
  name: string;
  avatarUrl?: string | null;
  granLevel: number;
}

export const UserRatingBadge: React.FC<UserRatingBadgeProps> = ({
  name,
  avatarUrl,
  granLevel,
}) => {
  return (
    <div className="inline-flex items-center gap-2.5 bg-white border border-slate-200 rounded-lg p-2 shadow-sm">
      <div className="relative w-9 h-9 rounded-full bg-slate-100 overflow-hidden border border-slate-200 shrink-0">
        {avatarUrl ? (
          <img src={avatarUrl} alt={name} className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-slate-400 font-bold text-xs">
            {name.slice(0, 1)}
          </div>
        )}
      </div>
      <div className="flex flex-col">
        <span className="text-sm font-semibold text-slate-800 leading-tight">
          {name}
        </span>
        <div className="flex items-center gap-1.5 mt-0.5">
          <span className="text-[10px] uppercase font-bold tracking-wider text-slate-500">
            GRAN Level
          </span>
          <span className="text-xs font-black text-indigo-600 bg-indigo-50 px-1.5 py-0.2 rounded border border-indigo-100">
            {granLevel}
          </span>
        </div>
      </div>
    </div>
  );
};

```

### 7.3 共通ボトムナビゲーション (モバイル専用: `BottomNav.tsx`)

```tsx
import React from 'react';
import { Trophy, Calendar, CalendarCheck, Award, Users, User } from 'lucide-react';

interface NavItem {
  id: string;
  label: string;
  icon: React.ElementType;
  active: boolean;
}

export const BottomNav: React.FC<{ activeTab: string; onChange: (id: string) => void }> = ({
  activeTab,
  onChange,
}) => {
  const navItems: NavItem[] = [
    { id: 'tournaments', label: '大会一覧', icon: Trophy, active: activeTab === 'tournaments' },
    { id: 'schedule', label: '日程', icon: Calendar, active: activeTab === 'schedule' },
    { id: 'my-schedule', label: 'マイ大会', icon: CalendarCheck, active: activeTab === 'my-schedule' },
    { id: 'ranking', label: '順位', icon: Award, active: activeTab === 'ranking' },
    { id: 'team', label: 'チーム', icon: Users, active: activeTab === 'team' },
    { id: 'profile', label: 'マイ頁', icon: User, active: activeTab === 'profile' },
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-white/95 backdrop-blur-md border-t border-slate-200 max-w-md mx-auto">
      <div className="grid grid-cols-6 h-16 items-center px-1">
        {navItems.map((item) => {
          const Icon = item.icon;
          return (
            <button
              key={item.id}
              onClick={() => onChange(item.id)}
              className={`flex flex-col items-center justify-center py-1 transition-colors ${
                item.active
                  ? 'text-emerald-600 font-semibold'
                  : 'text-slate-400 hover:text-slate-600 font-normal'
              }`}
            >
              <Icon className={`w-5 h-5 mb-1 ${item.active ? 'stroke-[2.5px]' : 'stroke-[1.75px]'}`} />
              <span className="text-[10px] tracking-tight leading-none">{item.label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
};

```

---

## 8. AIバイブコーディング時の厳格チェックリスト

AIが画面やコンポーネントコードを出力する際、以下の項目を必ず自己検証してください。

* [ ] **カラーの統一**: 指定以外の任意カラーコード（例: `#22c55e`, `#3b82f6` など）を直接書いていないか？（必ず `emerald-600`, `indigo-600`, `slate-900` を使用）
* [ ] **タッチ領域の確保**: モバイル操作用ボタン・入力欄の高さが `h-11` (44px) または `h-12` (48px) に設定されているか？
* [ ] **角丸の規則遵守**: ボタン・入力は `rounded-lg`、カード・ダイアログは `rounded-xl`、バッジは `rounded-full` になっているか？
* [ ] **下部余白の確保**: モバイル画面の最下部にボトムナビゲーション用の `pb-20` が付与されているか？
* [ ] **コントラスト**: 背景 `bg-slate-50` に対し、カード `bg-white` と境界線 `border-slate-200`、文字 `text-slate-900` / `text-slate-600` で高い視認性を保っているか？
"""

import os
os.makedirs("docs", exist_ok=True)
with open("docs/ui-design-system.md", "w", encoding="utf-8") as f:
f.write(md_content)

print("Saved docs/ui-design-system.md successfully.")

```

```markdown
# 共通UI・デザインシステム定義書 (UI Design System Specification)

本書は、本Webアプリケーション（モバイルWeb / SPA / PC管理画面）におけるUI・UXの一貫性を担保し、AIコード生成およびバイブコーディングにおいてデザインの破綻やツギハギを防ぐための厳格な共通UI・デザインシステム定義書です。
AIエージェントおよび開発者は、すべての画面・コンポーネント実装において本定義書のデザイントークン、クラス名、コンポーネント規約に厳密に従ってください。

---

## 1. テーマカラー定義 (Color Tokens)

Tailwind CSS の標準セマンティックカラーにマッピングされたデザイントークンです。
スポーツ大会運営アプリとしての清潔感、屋外モバイル環境での高視認性、管理画面での信頼性を両立する**エメラルド・スレート・インディゴ**を基調とします。

### 1.1 カラーパレット & セマンティックマッピング

| トークン名 / 役割 | Tailwind クラス名 | HEX値 | 用途・適用対象 |
| :--- | :--- | :--- | :--- |
| **Primary (メイン)** | `emerald-600` | `#059669` | 主要CTAボタン、アクティブタブ、主要ハイライト |
| **Primary Hover** | `emerald-700` | `#047857` | プライマリボタンのホバー/アクティブ状態 |
| **Primary Light** | `emerald-50` | `#ecfdf5` | プライマリアクティブ背景、カテゴリバッジ背景 |
| **Secondary (補助)** | `indigo-600` | `#4f46e5` | 管理者アクション、カレンダー連携、GRANレベル強調 |
| **Secondary Hover** | `indigo-700` | `#4338ca` | セカンダリボタンホバー |
| **Background (全体背景)** | `slate-50` | `#f8fafc` | アプリ全体のベース背景色（全画面共通） |
| **Surface (カード/面)** | `white` | `#ffffff` | コンポーネントカード、ダイアログ、ボトムナビ背景 |
| **Text Primary (主要文字)** | `slate-900` | `#0f172a` | 見出し、メインテキスト、重要数値 |
| **Text Secondary (副次文字)** | `slate-600` | `#475569` | ラベル、説明文、メタデータ、プレースホルダー |
| **Text Muted (注釈/薄文字)** | `slate-400` | `#94a3b8` | 無効化テキスト、補助アイコン、非活性要素 |
| **Border / Divider (境界線)** | `slate-200` | `#e2e8f0` | カード枠線、リスト区切り線、インプット枠線 |
| **Success (成功/空き枠あり)** | `emerald-500` | `#10b981` | エントリー完了、空き枠十分、正常ステータス |
| **Warning (警告/残りわずか)** | `amber-500` | `#f59e0b` | 残り枠わずか、有償キャンセル注意(50%)、未定リマインド |
| **Danger (エラー/満員/危険)** | `rose-600` | `#e11d48` | 満員(キャンセル待ち)、有償キャンセル(100%)、削除ボタン |
| **Info (情報)** | `sky-500` | `#0ea5e9` | 一般お知らせ、キャンセル待ち順位バッジ |

### 1.2 `tailwind.config.js` 設定例
```javascript
/** @type {import('tailwindcss').Config} */
module.exports = {
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#ecfdf5',
          100: '#d1fae5',
          500: '#10b981',
          600: '#059669',
          700: '#047857',
        },
      },
    },
  },
};

```

---

## 2. コンポーネントライブラリ & スタイリング方針

### 2.1 採用スタック

* **Base Framework**: Tailwind CSS
* **UI Component Library**: **shadcn/ui** (Radix UI ベース、Tailwind完全統合)
* **Icons**: **Lucide React** (統一サイズ: 16px / 20px / 24px)
* **Class Utilities**: `clsx`, `tailwind-merge` (`cn` ヘルパー関数を使用)

### 2.2 クラス統合ユーティリティ (`src/lib/utils.ts`)

```typescript
import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

```

### 2.3 カスタマイズ・設計方針

1. **ダークモード非対応（ライトテーマ完全固定）**: 屋外モバイル環境での視認性を最優先とするため、背景は常に `bg-slate-50`、カードは `bg-white` を維持する。
2. **ハードコードカラーの禁止**: インラインスタイル（`style={{ color: '#059669' }}`）は禁止。必ず定義済みのTailwindセマンティッククラスを使用する。
3. **角丸（Border Radius）の厳格な統一**:
* ボタン / 入力フォーム: `rounded-lg` (8px)
* カード / ダイアログ / パネル: `rounded-xl` (12px)
* バッジ / ピルタグ / アバター: `rounded-full` (9999px)


4. **シャドウ・境界線の統一**:
* カード / リストアイテム: `shadow-sm border border-slate-200`
* モーダル / ポップオーバー / ボトムシート: `shadow-lg border border-slate-100`



---

## 3. ボタン共通スタイル (Button Variants & States)

モバイルでのタップミスを防ぐため、高さ44px以上（`h-11` または `h-12`）を基本とし、明示的なホバー・アクティブ・フォーカス・無効化状態を定義します。

### 3.1 ボタンスタイル仕様表

| バリアント | 基本クラス | ホバー / アクティブ | 無効化 (Disabled) |
| --- | --- | --- | --- |
| **Primary (主要CTA)** | `bg-emerald-600 text-white font-medium shadow-sm` | `hover:bg-emerald-700 active:bg-emerald-800` | `disabled:bg-slate-300 disabled:text-slate-500 disabled:cursor-not-allowed disabled:shadow-none` |
| **Secondary (副次)** | `bg-slate-100 text-slate-800 font-medium border border-slate-200` | `hover:bg-slate-200 active:bg-slate-300` | `disabled:bg-slate-50 disabled:text-slate-400 disabled:border-slate-100 disabled:cursor-not-allowed` |
| **Outline (枠線)** | `bg-white text-emerald-700 border border-emerald-600 font-medium` | `hover:bg-emerald-50 active:bg-emerald-100` | `disabled:border-slate-200 disabled:text-slate-400 disabled:cursor-not-allowed` |
| **Destructive (危険/削除)** | `bg-rose-600 text-white font-medium shadow-sm` | `hover:bg-rose-700 active:bg-rose-800` | `disabled:bg-slate-300 disabled:text-slate-500 disabled:cursor-not-allowed` |
| **Ghost (テキストのみ)** | `bg-transparent text-slate-700 font-medium` | `hover:bg-slate-100 active:bg-slate-200` | `disabled:text-slate-400 disabled:cursor-not-allowed` |

### 3.2 コピペ用実装コンポーネントコード (`src/components/ui/button.tsx`)

```tsx
import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';
import { Loader2 } from 'lucide-react';

const buttonVariants = cva(
  'inline-flex items-center justify-center whitespace-nowrap rounded-lg text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2 disabled:pointer-events-none select-none',
  {
    variants: {
      variant: {
        primary:
          'bg-emerald-600 text-white shadow-sm hover:bg-emerald-700 active:bg-emerald-800 disabled:bg-slate-300 disabled:text-slate-500 disabled:shadow-none',
        secondary:
          'bg-slate-100 text-slate-800 border border-slate-200 hover:bg-slate-200 active:bg-slate-300 disabled:bg-slate-50 disabled:text-slate-400 disabled:border-slate-100',
        outline:
          'bg-white text-emerald-700 border border-emerald-600 hover:bg-emerald-50 active:bg-emerald-100 disabled:border-slate-200 disabled:text-slate-400',
        destructive:
          'bg-rose-600 text-white shadow-sm hover:bg-rose-700 active:bg-rose-800 disabled:bg-slate-300 disabled:text-slate-500',
        ghost:
          'text-slate-700 hover:bg-slate-100 active:bg-slate-200 disabled:text-slate-400',
      },
      size: {
        sm: 'h-9 px-3 text-xs rounded-md',
        md: 'h-11 px-4 py-2 text-sm',
        lg: 'h-12 px-6 text-base font-semibold',
        full: 'w-full h-12 px-6 text-base font-semibold',
        icon: 'h-10 w-10 p-0',
      },
    },
    defaultVariants: {
      variant: 'primary',
      size: 'md',
    },
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  isLoading?: boolean;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, isLoading, children, disabled, ...props }, ref) => {
    return (
      <button
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        disabled={disabled || isLoading}
        {...props}
      >
        {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin text-current"/>}
        {children}
      </button>
    );
  }
);
Button.displayName = 'Button';

```

---

## 4. タイポグラフィとフォントサイズ (Typography)

日本語環境で高い可読性を発揮するシステムフォントスタックを指定し、サイズ・太さ・行間（Leading）のルールを定義します。

### 4.1 フォントファミリー定義

```css
font-family: 'Hiragino Sans', 'Hiragino Kaku Gothic ProN', 'BIZ UDPGothic', 'Meiryo', sans-serif;

```

### 4.2 タイポグラフィ階層定義表

| 要素 | Tailwind クラス群 | サイズ / 行間 / 太さ | 用途 |
| --- | --- | --- | --- |
| **Page Title (H1)** | `text-xl sm:text-2xl font-bold text-slate-900 leading-tight` | 20px / 24px (sm: 24px/32px) Bold | 画面最上部タイトル、ヘッダー |
| **Section Title (H2)** | `text-lg sm:text-xl font-bold text-slate-800 leading-snug` | 18px / 28px Bold | カード見出し、ブロック区切り |
| **Card / Sub Title (H3)** | `text-base font-semibold text-slate-800 leading-normal` | 16px / 24px Semibold | 大会名、チーム名、モーダル題名 |
| **Body (本文)** | `text-sm font-normal text-slate-700 leading-relaxed` | 14px / 20px Normal | 一般説明文、要項本文、フォームラベル |
| **Body Medium (強調本文)** | `text-sm font-medium text-slate-900 leading-relaxed` | 14px / 20px Medium | 項目名、強調データ、テーブルヘッダー |
| **Caption (注釈/補足)** | `text-xs font-normal text-slate-500 leading-normal` | 12px / 16px Normal | 日時補足、残り枠数注釈、免責事項 |
| **Badge / Stat (数値強調)** | `text-xs font-bold uppercase tracking-wider` | 12px Bold / 字間広め | GRANレベル数値、ステータスタグ |

---

## 5. レイアウト・余白規則 (Spacing & Layout Grid)

8px（`p-2` / `m-2` = 0.5rem）を基本スケールとする **8pxグリッドシステム**（微調整時は4px = `1`）を厳格に適用します。

### 5.1 余白スケール基準表

| トークン | サイズ | Tailwind クラス | 適用対象の標準ルール |
| --- | --- | --- | --- |
| **3xs** | 2px | `gap-0.5`, `p-0.5` | 微細ボーダー調整、極小アイコン余白 |
| **2xs** | 4px | `gap-1`, `p-1`, `space-y-1` | バッジ内パディング、インライン要素間 |
| **xs** | 8px | `gap-2`, `p-2`, `space-y-2` | フォームラベルとインプットの間、アイコンとテキスト間 |
| **sm** | 12px | `gap-3`, `p-3`, `space-y-3` | コンパクトカード内パディング、リスト行間 |
| **md** | 16px | `gap-4`, `p-4`, `space-y-4` | **標準カード内パディング**、フォームフィールド間隔 |
| **lg** | 24px | `gap-6`, `p-6`, `space-y-6` | セクション間の余白、モーダル内パディング |
| **xl** | 32px | `gap-8`, `py-8`, `space-y-8` | ページメインブロック間の余白 |

### 5.2 画面コンテナ & ページ構造ルール

* **モバイル画面**:
* ルートラッパー: `min-h-screen bg-slate-50 pb-20` (※ボトムナビの被りを防ぐため `pb-20` 必須)
* 水平パディング: `px-4` (16px)
* 最大幅制限: `max-w-md mx-auto` (モバイル画面をPCでプレビューした際の中央寄せ)


* **管理者 Web 画面**:
* ルートラッパー: `min-h-screen bg-slate-50`
* メインコンテンツ幅: `max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8`



---

## 6. レスポンシブ対応の基準 (Responsive Breakpoints)

本システムは **モバイルファースト（Mobile-First）** を原則とします。ベースクラスはスマートフォン（モバイル環境: 375px〜430px）向けに記述し、管理者画面やタブレット向けにブレイクポイント接頭辞を付与します。

### 6.1 ブレイクポイント定義

| 接頭辞 | 最小幅 | 主なターゲットデバイス | レイアウト指針 |
| --- | --- | --- | --- |
| *(None)* | `0px` | スマートフォン (iOS / Android) | 1カラム構成、フルワイドボタン、下部固定ボトムナビ |
| `sm:` | `640px` | 大型スマホ / 小型タブレット | カードパディング拡張 (`p-6`)、ボタン幅の自動調整 |
| `md:` | `768px` | タブレット / 管理画面サブPC | 2カラムグリッド (`grid-cols-2`)、サイドバーナビ表示切替 |
| `lg:` | `1024px` | デスクトップ PC (管理画面メイン) | 3〜4カラムグリッド、テーブル全列表示、固定サイドメニュー |

---

## 7. 実装コードサンプル集 (AIコピペ用標準コンポーネント)

AIが画面を生成する際、以下のコード構造・クラスパターンをそのまま使用してください。

### 7.1 大会情報カードコンポーネント (`TournamentCard.tsx`)

```tsx
import React from 'react';
import { Calendar, MapPin, Users, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface TournamentCardProps {
  id: string;
  title: string;
  category: '男子団体' | '女子団体' | 'ミックス団体' | 'シングルス' | 'ダブルス';
  eventDate: string;
  venue: string;
  capacity: number;
  remainingSlots: number;
  entryFee: number;
  status: 'OPEN' | 'FULL' | 'CLOSED';
  onEntry: (id: string) => void;
}

export const TournamentCard: React.FC<TournamentCardProps> = ({
  id,
  title,
  category,
  eventDate,
  venue,
  capacity,
  remainingSlots,
  entryFee,
  status,
  onEntry,
}) => {
  const isFull = remainingSlots <= 0 || status === 'FULL';

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm hover:border-slate-300 transition-shadow">
      {/* ヘッダー: カテゴリバッジ & 残り枠 */}
      <div className="flex items-center justify-between gap-2 mb-2">
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
          {category}
        </span>
        {isFull ? (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-rose-50 text-rose-700 border border-rose-200">
            満員 (キャンセル待ち受付中)
          </span>
        ) : (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200">
            残り {remainingSlots} 枠
          </span>
        )}
      </div>

      {/* 大会名 */}
      <h3 className="text-base font-bold text-slate-900 leading-snug mb-3">
        {title}
      </h3>

      {/* 日時・場所・料金情報 */}
      <div className="space-y-1.5 text-xs text-slate-600 mb-4">
        <div className="flex items-center gap-2">
          <Calendar className="w-4 h-4 text-slate-400 shrink-0"/>
          <span>{eventDate}</span>
        </div>
        <div className="flex items-center gap-2">
          <MapPin className="w-4 h-4 text-slate-400 shrink-0"/>
          <span className="truncate">{venue}</span>
        </div>
        <div className="flex items-center gap-2">
          <Users className="w-4 h-4 text-slate-400 shrink-0"/>
          <span>定員 {capacity} チーム / ¥{entryFee.toLocaleString()}(税込)</span>
        </div>
      </div>

      {/* アクションボタン */}
      <Button 'primary'} 'secondary' : ? onClick="{()" size="full" variant="{isFull"> onEntry(id)}
      >
        {isFull ? 'キャンセル待ちを申し込む' : 'エントリーへ進む'}
        <ChevronRight className="w-4 h-4 ml-1"/>
      </Button>
    </div>
  );
};

```

### 7.2 GRANレベル表示 & ユーザーアバター (`UserRatingBadge.tsx`)

```tsx
import React from 'react';

interface UserRatingBadgeProps {
  name: string;
  avatarUrl?: string | null;
  granLevel: number;
}

export const UserRatingBadge: React.FC<UserRatingBadgeProps> = ({
  name,
  avatarUrl,
  granLevel,
}) => {
  return (
    <div className="inline-flex items-center gap-2.5 bg-white border border-slate-200 rounded-lg p-2 shadow-sm">
      <div className="relative w-9 h-9 rounded-full bg-slate-100 overflow-hidden border border-slate-200 shrink-0">
        {avatarUrl ? (
          <img src={avatarUrl} alt={name} className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-slate-400 font-bold text-xs">
            {name.slice(0, 1)}
          </div>
        )}
      </div>
      <div className="flex flex-col">
        <span className="text-sm font-semibold text-slate-800 leading-tight">
          {name}
        </span>
        <div className="flex items-center gap-1.5 mt-0.5">
          <span className="text-[10px] uppercase font-bold tracking-wider text-slate-500">
            GRAN Level
          </span>
          <span className="text-xs font-black text-indigo-600 bg-indigo-50 px-1.5 py-0.5 rounded border border-indigo-100">
            {granLevel}
          </span>
        </div>
      </div>
    </div>
  );
};

```

### 7.3 共通ボトムナビゲーション (モバイル専用: `BottomNav.tsx`)

```tsx
import React from 'react';
import { Trophy, Calendar, CalendarCheck, Award, Users, User } from 'lucide-react';

interface NavItem {
  id: string;
  label: string;
  icon: React.ElementType;
  active: boolean;
}

export const BottomNav: React.FC<{ activeTab: string; onChange: (id: string) => void }> = ({
  activeTab,
  onChange,
}) => {
  const navItems: NavItem[] = [
    { id: 'tournaments', label: '大会一覧', icon: Trophy, active: activeTab === 'tournaments' },
    { id: 'schedule', label: '日程', icon: Calendar, active: activeTab === 'schedule' },
    { id: 'my-schedule', label: 'マイ大会', icon: CalendarCheck, active: activeTab === 'my-schedule' },
    { id: 'ranking', label: '順位', icon: Award, active: activeTab === 'ranking' },
    { id: 'team', label: 'チーム', icon: Users, active: activeTab === 'team' },
    { id: 'profile', label: 'マイ頁', icon: User, active: activeTab === 'profile' },
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-white/95 backdrop-blur-md border-t border-slate-200 max-w-md mx-auto">
      <div className="grid grid-cols-6 h-16 items-center px-1">
        {navItems.map((item) => {
          const Icon = item.icon;
          return (
            <button
              key={item.id}
              onClick={() => onChange(item.id)}
              className={`flex flex-col items-center justify-center py-1 transition-colors ${
                item.active
                  ? 'text-emerald-600 font-semibold'
                  : 'text-slate-400 hover:text-slate-600 font-normal'
              }`}
            >
              <Icon ${item.active 'stroke-[1.75px]'}`} 'stroke-[2.5px]' : ? className="{`w-5" h-5 mb-1/>
              <span className="text-[10px] tracking-tight leading-none">{item.label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
};

```

---

## 8. AIバイブコーディング時の厳格チェックリスト

AIが画面やコンポーネントコードを出力する際、以下の項目を必ず自己検証してください。

* [ ] **カラーの統一**: 指定以外の任意カラーコード（例: `#22c55e`, `#3b82f6` など）を直接書いていないか？（必ず `emerald-600`, `indigo-600`, `slate-900` などのトークンクラスを使用）
* [ ] **タッチ領域の確保**: モバイル操作用ボタン・入力欄の高さが `h-11` (44px) または `h-12` (48px) に設定されているか？
* [ ] **角丸の規則遵守**: ボタン・入力は `rounded-lg`、カード・ダイアログは `rounded-xl`、バッジは `rounded-full` になっているか？
* [ ] **下部余白の確保**: モバイル画面の最下部にボトムナビゲーション用の `pb-20` が付与されているか？
* [ ] **コントラスト**: 背景 `bg-slate-50` に対し、カード `bg-white` と境界線 `border-slate-200`、文字 `text-slate-900` / `text-slate-600` で高い視認性を保っているか？

```

```